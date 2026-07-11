# Node 22.22.0 satisfies Vite 8's Node.js requirement and keeps the build
# environment reproducible. Nginx is intentionally confined to the runtime
# stage so Node and npm do not ship with the application.
FROM node:22.22.0-alpine3.22@sha256:7aa86fa052f6e4b101557ccb56717cb4311be1334381f526fe013418fe157384 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY src ./src

# An empty value keeps the production bundle same-origin. Runtime API routing
# is handled by Nginx, never by a Vite variable embedded in the bundle.
ENV VITE_SENTINEL_API_URL=""
RUN npm run build

# nginxinc/nginx-unprivileged runs as uid 101 and listens on an unprivileged
# port by default. Pinning the tag prevents an implicit "latest" upgrade.
FROM nginxinc/nginx-unprivileged:1.28.0-alpine@sha256:c97ff0bf7cbae369953c6da1232ec14ad9f971d66360c5698db0856a4cd657a0 AS runtime

ENV SENTINEL_API_UPSTREAM="http://api:8000"

COPY docker/nginx.conf /etc/nginx/templates/nginx.conf.template
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/logging.conf.template /etc/nginx/templates/logging.conf.template
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/sentinel-web-entrypoint
COPY --from=build /app/dist /usr/share/nginx/html

USER 101:101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --output-document=/dev/null http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/sentinel-web-entrypoint"]
