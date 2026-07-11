#!/bin/sh
set -eu

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

if [ -z "${SENTINEL_API_UPSTREAM:-}" ]; then
  echo "SENTINEL_API_UPSTREAM must not be empty." >&2
  exit 64
fi

case "$SENTINEL_API_UPSTREAM" in
  http://*|https://*) ;;
  *)
    echo "SENTINEL_API_UPSTREAM must start with http:// or https://." >&2
    exit 64
    ;;
esac

if ! command -v envsubst >/dev/null 2>&1; then
  echo "envsubst is required to render the Nginx upstream configuration." >&2
  exit 70
fi

envsubst '${SENTINEL_API_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /tmp/default.conf

exec nginx -c /etc/nginx/nginx.conf -g 'daemon off;'
