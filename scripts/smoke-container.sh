#!/bin/sh
set -eu

IMAGE=${IMAGE:-sentinel-web:test}
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SUFFIX=$$
NETWORK="sentinel-web-smoke-${SUFFIX}"
UPSTREAM="sentinel-web-upstream-${SUFFIX}"
WEB="sentinel-web-${SUFFIX}"
WEB_READONLY="sentinel-web-readonly-${SUFFIX}"
WEB_UNAVAILABLE="sentinel-web-unavailable-${SUFFIX}"
PORT=${PORT:-18080}
READONLY_PORT=${READONLY_PORT:-18081}
UNAVAILABLE_PORT=${UNAVAILABLE_PORT:-18082}
WORK=$(mktemp -d)

cleanup() {
  docker rm -f "$WEB_UNAVAILABLE" "$WEB_READONLY" "$WEB" "$UPSTREAM" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

wait_for() {
  url=$1
  attempts=0
  until curl --fail --silent --show-error "$url" >/dev/null; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "Timed out waiting for $url" >&2
      return 1
    fi
    sleep 1
  done
}

header() {
  curl --silent --show-error --dump-header "$WORK/headers" --output "$WORK/body" "$1"
}

wait_for_upstream() {
  attempts=0
  until docker run --rm --network "$NETWORK" python:3.12.13-alpine3.22 \
    python -c 'from urllib.request import urlopen; urlopen("http://'$UPSTREAM':8000/health/live")' \
    >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "Timed out waiting for the fake upstream" >&2
      return 1
    fi
    sleep 1
  done
}

wait_for_docker_health() {
  container=$1
  attempts=0
  until [ "$(docker inspect --format '{{.State.Health.Status}}' "$container")" = "healthy" ]; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      docker logs "$container" >&2 || true
      echo "Timed out waiting for Docker health on $container" >&2
      return 1
    fi
    sleep 1
  done
}

docker network create "$NETWORK" >/dev/null
docker run --detach --rm --name "$UPSTREAM" --network "$NETWORK" \
  --mount "type=bind,src=$ROOT/scripts/fake-upstream.py,dst=/srv/fake-upstream.py,readonly" \
  python:3.12.13-alpine3.22 python /srv/fake-upstream.py >/dev/null
wait_for_upstream

docker run --detach --rm --name "$WEB" --network "$NETWORK" \
  -e SENTINEL_API_UPSTREAM="http://${UPSTREAM}:8000" \
  -p "127.0.0.1:${PORT}:8080" "$IMAGE" >/dev/null
wait_for "http://127.0.0.1:${PORT}/healthz"
wait_for_docker_health "$WEB"

test "$(curl --silent --show-error "http://127.0.0.1:${PORT}/healthz")" = "ok"
header "http://127.0.0.1:${PORT}/"
grep -q "Sentinel" "$WORK/body"
grep -qi '^Cache-Control: no-cache' "$WORK/headers"
cp "$WORK/body" "$WORK/index.html"

header "http://127.0.0.1:${PORT}/discovery"
cmp "$WORK/index.html" "$WORK/body"

ASSET=$(sed -n 's/.*\(\/assets\/[^" ]*\.js\).*/\1/p' "$WORK/index.html" | head -n 1)
test -n "$ASSET"
header "http://127.0.0.1:${PORT}${ASSET}"
grep -qi '^Cache-Control: public, max-age=31536000, immutable' "$WORK/headers"

header "http://127.0.0.1:${PORT}/api/v1/catalog/segments?x=1"
test "$(cat "$WORK/body")" = "GET /api/v1/catalog/segments?x=1 "
header "http://127.0.0.1:${PORT}/health/live"
test "$(cat "$WORK/body")" = "GET /health/live "

POST_STATUS=$(curl --silent --show-error --output "$WORK/body" --write-out '%{http_code}' \
  --request POST --data 'probe=1' "http://127.0.0.1:${PORT}/api/v1/catalog/segments?x=1")
test "$POST_STATUS" = "200"
test "$(cat "$WORK/body")" = "POST /api/v1/catalog/segments?x=1 probe=1"

STATUS=$(curl --silent --show-error --output "$WORK/body" --write-out '%{http_code}' \
  "http://127.0.0.1:${PORT}/api/v1/upstream-503")
test "$STATUS" = "503"
test "$(cat "$WORK/body")" = "GET /api/v1/upstream-503 "

test "$(docker run --rm --entrypoint id "$IMAGE" -u)" != "0"
! docker run --rm --entrypoint sh "$IMAGE" -c 'command -v node || command -v npm'
! docker run --rm --entrypoint sh "$IMAGE" -c 'grep -R "127.0.0.1:8000" /usr/share/nginx/html'
! docker run --rm --entrypoint sh "$IMAGE" -c 'find /usr/share/nginx/html -name "*.map" -print -quit | grep -q .'

set +e
INVALID_OUTPUT=$(docker run --rm -e SENTINEL_API_UPSTREAM='' "$IMAGE" 2>&1)
INVALID_STATUS=$?
set -e
test "$INVALID_STATUS" = "64"
printf '%s' "$INVALID_OUTPUT" | grep -q 'SENTINEL_API_UPSTREAM must not be empty'

docker run --detach --rm --name "$WEB_READONLY" --network "$NETWORK" --read-only \
  --tmpfs /tmp -e SENTINEL_API_UPSTREAM="http://${UPSTREAM}:8000" \
  -p "127.0.0.1:${READONLY_PORT}:8080" "$IMAGE" >/dev/null
wait_for "http://127.0.0.1:${READONLY_PORT}/healthz"
wait_for_docker_health "$WEB_READONLY"
header "http://127.0.0.1:${READONLY_PORT}/"
grep -q "Sentinel" "$WORK/body"

docker run --detach --rm --name "$WEB_UNAVAILABLE" --network "$NETWORK" \
  -e SENTINEL_API_UPSTREAM=http://127.0.0.1:9 \
  -p "127.0.0.1:${UNAVAILABLE_PORT}:8080" "$IMAGE" >/dev/null
wait_for "http://127.0.0.1:${UNAVAILABLE_PORT}/healthz"
UNAVAILABLE_STATUS=$(curl --silent --show-error --output "$WORK/body" --write-out '%{http_code}' \
  "http://127.0.0.1:${UNAVAILABLE_PORT}/api/v1/catalog/segments")
test "$UNAVAILABLE_STATUS" = "502"
grep -q '502 Bad Gateway' "$WORK/body"

docker stop --time 10 "$WEB" >/dev/null
echo "Container smoke passed: healthz, SPA fallback, cache, proxy, non-root, no Node/npm, and read-only runtime."
