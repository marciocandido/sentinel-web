#!/bin/sh
set -eu

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

if [ -z "${SENTINEL_API_UPSTREAM:-}" ]; then
  echo "SENTINEL_API_UPSTREAM must not be empty." >&2
  exit 64
fi

normalize_boolean() {
  name=$1
  value=$2
  case "$value" in
    true|1|yes) printf '1\n' ;;
    false|0|no) printf '0\n' ;;
    *)
      echo "$name must be true/false, 1/0 or yes/no." >&2
      exit 64
      ;;
  esac
}

case "${SENTINEL_WEB_LOG_LEVEL:-info}" in
  info|notice|warn|error|crit) SENTINEL_WEB_LOG_LEVEL=${SENTINEL_WEB_LOG_LEVEL:-info} ;;
  *)
    echo "SENTINEL_WEB_LOG_LEVEL must be info, notice, warn, error or crit." >&2
    exit 64
    ;;
esac

case "${SENTINEL_WEB_LOG_FORMAT:-human}" in
  human) SENTINEL_WEB_LOG_FORMAT=human ;;
  *)
    echo "SENTINEL_WEB_LOG_FORMAT must be human; JSON is outside this image scope." >&2
    exit 64
    ;;
esac

SENTINEL_WEB_ACCESS_LOG=$(normalize_boolean SENTINEL_WEB_ACCESS_LOG "${SENTINEL_WEB_ACCESS_LOG:-true}")
SENTINEL_WEB_LOG_HEALTH=$(normalize_boolean SENTINEL_WEB_LOG_HEALTH "${SENTINEL_WEB_LOG_HEALTH:-false}")
export SENTINEL_WEB_LOG_LEVEL SENTINEL_WEB_ACCESS_LOG SENTINEL_WEB_LOG_HEALTH

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

envsubst '${SENTINEL_WEB_LOG_LEVEL}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /tmp/nginx.conf

envsubst '${SENTINEL_WEB_ACCESS_LOG} ${SENTINEL_WEB_LOG_HEALTH}' \
  < /etc/nginx/templates/logging.conf.template \
  > /tmp/logging.conf

exec nginx -c /tmp/nginx.conf -g 'daemon off;'
