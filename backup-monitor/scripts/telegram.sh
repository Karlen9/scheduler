#!/bin/bash
# Send a message via the alert Telegram bot.
# Usage: telegram.sh "message text" [parse_mode]
# parse_mode defaults to "Markdown"; pass "none" or "" for plain text.
set -eo pipefail

# Load env vars written by entrypoint (cron shells don't inherit docker env)
[ -f /etc/environment ] && set -a && . /etc/environment && set +a

: "${TELEGRAM_ALERT_BOT_TOKEN:?}"
: "${TELEGRAM_ALERT_CHAT_ID:?}"

msg="${1:-}"
parse_mode="${2-Markdown}"
[ -z "$msg" ] && exit 0

args=(
    -X POST "https://api.telegram.org/bot${TELEGRAM_ALERT_BOT_TOKEN}/sendMessage"
    --data-urlencode "chat_id=${TELEGRAM_ALERT_CHAT_ID}"
    --data-urlencode "text=${msg}"
    -d "disable_web_page_preview=true"
)
if [ -n "$parse_mode" ] && [ "$parse_mode" != "none" ]; then
    args+=(-d "parse_mode=${parse_mode}")
fi

curl -sS --max-time 10 "${args[@]}" > /dev/null
