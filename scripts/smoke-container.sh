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
WEB_HEALTH_LOG="sentinel-web-health-log-${SUFFIX}"
WEB_NO_ACCESS="sentinel-web-no-access-${SUFFIX}"
PORT=${PORT:-18080}
READONLY_PORT=${READONLY_PORT:-18081}
UNAVAILABLE_PORT=${UNAVAILABLE_PORT:-18082}
HEALTH_LOG_PORT=${HEALTH_LOG_PORT:-18083}
NO_ACCESS_PORT=${NO_ACCESS_PORT:-18084}
WORK=$(mktemp -d)

cleanup() {
  docker rm -f "$WEB_NO_ACCESS" "$WEB_HEALTH_LOG" "$WEB_UNAVAILABLE" "$WEB_READONLY" "$WEB" "$UPSTREAM" >/dev/null 2>&1 || true
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

request_id_from_headers() {
  awk 'BEGIN { IGNORECASE=1 } /^X-Request-ID:/ { print $2 }' "$WORK/headers" | tr -d '\r'
}

assert_request_id() {
  value=$1
  printf '%s' "$value" | grep -Eq '^[0-9a-f]{32}$'
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
header "http://127.0.0.1:${PORT}/healthz"
assert_request_id "$(request_id_from_headers)"
header "http://127.0.0.1:${PORT}/"
grep -q "Sentinel" "$WORK/body"
grep -qi '^Cache-Control: no-cache' "$WORK/headers"
assert_request_id "$(request_id_from_headers)"
cp "$WORK/body" "$WORK/index.html"

header "http://127.0.0.1:${PORT}/discovery"
cmp "$WORK/index.html" "$WORK/body"

ASSET=$(sed -n 's/.*\(\/assets\/[^" ]*\.js\).*/\1/p' "$WORK/index.html" | head -n 1)
test -n "$ASSET"
header "http://127.0.0.1:${PORT}${ASSET}"
grep -qi '^Cache-Control: public, max-age=31536000, immutable' "$WORK/headers"
assert_request_id "$(request_id_from_headers)"

header "http://127.0.0.1:${PORT}/api/v1/catalog/segments?x=1"
test "$(cat "$WORK/body")" = "GET /api/v1/catalog/segments?x=1 "
assert_request_id "$(request_id_from_headers)"
header "http://127.0.0.1:${PORT}/health/live"
test "$(cat "$WORK/body")" = "GET /health/live "

curl --silent --show-error --dump-header "$WORK/headers" --output "$WORK/body" \
  -H 'X-Request-ID: web_trace_11' \
  "http://127.0.0.1:${PORT}/api/v1/echo-request?secret=valor"
test "$(request_id_from_headers)" = "web_trace_11"
grep -q '"request_id": "web_trace_11"' "$WORK/body"
grep -q '"query": "secret=valor"' "$WORK/body"

curl --silent --show-error --dump-header "$WORK/headers" --output "$WORK/body" \
  -H 'X-Request-ID: invalid value' \
  "http://127.0.0.1:${PORT}/api/v1/echo-request"
INVALID_ID=$(request_id_from_headers)
assert_request_id "$INVALID_ID"
test "$INVALID_ID" != "invalid value"

LONG_ID=$(printf 'a%.0s' $(seq 1 65))
curl --silent --show-error --dump-header "$WORK/headers" --output "$WORK/body" \
  -H "X-Request-ID: ${LONG_ID}" \
  "http://127.0.0.1:${PORT}/api/v1/echo-request"
assert_request_id "$(request_id_from_headers)"

POST_STATUS=$(curl --silent --show-error --output "$WORK/body" --write-out '%{http_code}' \
  --request POST --data 'probe=1' "http://127.0.0.1:${PORT}/api/v1/catalog/segments?x=1")
test "$POST_STATUS" = "200"
test "$(cat "$WORK/body")" = "POST /api/v1/catalog/segments?x=1 probe=1"

STATUS=$(curl --silent --show-error --output "$WORK/body" --write-out '%{http_code}' \
  "http://127.0.0.1:${PORT}/api/v1/upstream-503")
test "$STATUS" = "503"
test "$(cat "$WORK/body")" = "GET /api/v1/upstream-503 "
curl --silent --show-error --dump-header "$WORK/headers" --output "$WORK/body" \
  "http://127.0.0.1:${PORT}/api/v1/upstream-503"
assert_request_id "$(request_id_from_headers)"

docker logs "$WEB" > "$WORK/web.log" 2>&1
grep -q 'web.request | requisição concluída' "$WORK/web.log"
grep -q 'request_id: web_trace_11' "$WORK/web.log"
grep -q 'path: /api/v1/echo-request' "$WORK/web.log"
grep -q 'upstream_status: 200' "$WORK/web.log"
grep -q 'duration_seconds:' "$WORK/web.log"
grep -q '^$' "$WORK/web.log"
! grep -q 'secret=valor\|Authorization:\|Cookie:' "$WORK/web.log"
! grep -q 'path: /healthz\|path: /health/live' "$WORK/web.log"

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

set +e
INVALID_OUTPUT=$(docker run --rm -e SENTINEL_WEB_LOG_FORMAT=json "$IMAGE" 2>&1)
INVALID_STATUS=$?
set -e
test "$INVALID_STATUS" = "64"
printf '%s' "$INVALID_OUTPUT" | grep -q 'SENTINEL_WEB_LOG_FORMAT must be human'

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
header "http://127.0.0.1:${UNAVAILABLE_PORT}/api/v1/catalog/segments"
assert_request_id "$(request_id_from_headers)"

docker run --detach --rm --name "$WEB_HEALTH_LOG" --network "$NETWORK" \
  -e SENTINEL_API_UPSTREAM="http://${UPSTREAM}:8000" \
  -e SENTINEL_WEB_LOG_HEALTH=true \
  -p "127.0.0.1:${HEALTH_LOG_PORT}:8080" "$IMAGE" >/dev/null
wait_for "http://127.0.0.1:${HEALTH_LOG_PORT}/healthz"
curl --silent --show-error "http://127.0.0.1:${HEALTH_LOG_PORT}/healthz" >/dev/null
docker logs "$WEB_HEALTH_LOG" > "$WORK/health.log" 2>&1
grep -q 'path: /healthz' "$WORK/health.log"

docker run --detach --rm --name "$WEB_NO_ACCESS" --network "$NETWORK" \
  -e SENTINEL_API_UPSTREAM="http://${UPSTREAM}:8000" \
  -e SENTINEL_WEB_ACCESS_LOG=false \
  -p "127.0.0.1:${NO_ACCESS_PORT}:8080" "$IMAGE" >/dev/null
wait_for "http://127.0.0.1:${NO_ACCESS_PORT}/healthz"
curl --silent --show-error "http://127.0.0.1:${NO_ACCESS_PORT}/api/v1/catalog/segments" >/dev/null
docker logs "$WEB_NO_ACCESS" > "$WORK/no-access.log" 2>&1
! grep -q 'web.request' "$WORK/no-access.log"

docker stop --time 10 "$WEB" >/dev/null
echo "Container smoke passed: request ID, human logs, health/access toggles, proxy, non-root, no Node/npm, and read-only runtime."
