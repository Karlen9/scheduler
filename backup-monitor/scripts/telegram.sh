#!/bin/bash
# Send a message via the alert Telegram bot.
# Usage: telegram.sh "message text"
set -eo pipefail

# Load env vars written by entrypoint (cron shells don't inherit docker env)
[ -f /etc/environment ] && set -a && . /etc/environment && set +a

: "${TELEGRAM_ALERT_BOT_TOKEN:?}"
: "${TELEGRAM_ALERT_CHAT_ID:?}"

msg="${1:-}"
[ -z "$msg" ] && exit 0

curl -sS --max-time 10 \
    -X POST "https://api.telegram.org/bot${TELEGRAM_ALERT_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_ALERT_CHAT_ID}" \
    --data-urlencode "text=${msg}" \
    -d "parse_mode=Markdown" \
    -d "disable_web_page_preview=true" \
    > /dev/null
