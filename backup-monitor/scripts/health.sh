#!/bin/bash
# Hit the main server's /health endpoint. Alert on state transitions.
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

STATE_FILE="/var/lib/monitor/health_state"
FAIL_COUNT_FILE="/var/lib/monitor/health_fail_count"
mkdir -p /var/lib/monitor

log() { echo "[$(date -Iseconds)] $*"; }

# Determine current state
if curl -fsS --max-time 10 "${HEALTH_URL}" > /dev/null 2>&1; then
    STATE="up"
else
    STATE="down"
fi

PREV="unknown"
[ -f "${STATE_FILE}" ] && PREV=$(cat "${STATE_FILE}")

log "health=${STATE} (prev=${PREV}) url=${HEALTH_URL}"

case "${STATE}_${PREV}" in
    down_up|down_unknown)
        # First failure — alert immediately
        echo 1 > "${FAIL_COUNT_FILE}"
        /usr/local/bin/telegram.sh "🔴 *Bot server DOWN*
URL: ${HEALTH_URL}
Time: $(date -u '+%Y-%m-%d %H:%M UTC')"
        ;;
    down_down)
        # Continuing failure — remind every 6 hours
        FAILS=1
        [ -f "${FAIL_COUNT_FILE}" ] && FAILS=$(cat "${FAIL_COUNT_FILE}")
        FAILS=$((FAILS + 1))
        echo "${FAILS}" > "${FAIL_COUNT_FILE}"
        if [ $((FAILS % 6)) -eq 0 ]; then
            HOURS=$((FAILS))
            /usr/local/bin/telegram.sh "🔴 Still DOWN — ${HOURS} consecutive hourly checks failed. (${HEALTH_URL})"
        fi
        ;;
    up_down)
        # Recovery
        /usr/local/bin/telegram.sh "✅ *Bot server recovered*
URL: ${HEALTH_URL}
Time: $(date -u '+%Y-%m-%d %H:%M UTC')"
        rm -f "${FAIL_COUNT_FILE}"
        ;;
    up_up|up_unknown)
        : # no-op
        ;;
esac

echo "${STATE}" > "${STATE_FILE}"
