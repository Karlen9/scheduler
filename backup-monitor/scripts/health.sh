#!/bin/bash
# Hit the main server's /health endpoint. One curl miss triggers a 5s retry;
# only a second failure alerts, with the exact errors from both attempts.
set -eo pipefail

# Load /etc/environment as fallback only (don't overwrite existing env,
# so `docker exec -e VAR=...` overrides still work for ad-hoc testing).
if [ -f /etc/environment ]; then
    while IFS='=' read -r _k _v; do
        [ -z "$_k" ] && continue
        [ -n "${!_k}" ] && continue
        _v="${_v%\"}"; _v="${_v#\"}"
        export "$_k=$_v"
    done < /etc/environment
fi

: "${HEALTH_URL:?HEALTH_URL env required}"

log() { echo "[$(date -Iseconds)] $*"; }

REASON=""
check() {
    local err_file body_file http_code curl_exit body err
    err_file=$(mktemp)
    body_file=$(mktemp)
    curl_exit=0

    http_code=$(curl -sS --max-time 10 -o "$body_file" -w '%{http_code}' "${HEALTH_URL}" 2>"$err_file") || curl_exit=$?

    err=$(cat "$err_file" 2>/dev/null || true)
    body=$(head -c 1500 "$body_file" 2>/dev/null || true)
    rm -f "$err_file" "$body_file"

    if [ "$curl_exit" -ne 0 ]; then
        REASON="curl exit ${curl_exit}: ${err:-no stderr}"
        return 1
    fi
    if [ -z "$http_code" ] || [ "$http_code" -lt 200 ] || [ "$http_code" -ge 300 ]; then
        REASON="HTTP ${http_code:-000}
${body:-(empty body)}"
        return 1
    fi
    REASON=""
    return 0
}

if check; then
    log "health=up url=${HEALTH_URL}"
    exit 0
fi
FIRST="${REASON}"
log "health=down attempt=1 reason=${FIRST}"

sleep 5

if check; then
    log "health=up url=${HEALTH_URL} (recovered after retry)"
    exit 0
fi
SECOND="${REASON}"
log "health=down attempt=2 reason=${SECOND}"

/usr/local/bin/telegram.sh "🔴 Bot server DOWN — ${HEALTH_URL}
$(date -u '+%Y-%m-%d %H:%M UTC')

── Attempt 1 ──
${FIRST}

── Attempt 2 ──
${SECOND}" "none"
