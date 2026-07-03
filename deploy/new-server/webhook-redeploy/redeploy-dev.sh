#!/bin/sh
if ! grep -q '^\s*bot-dev:' /srv/scheduler/docker-compose.yml 2>/dev/null; then
	echo "No bot-dev service configured on this server, nothing to do."
	exit 0
fi
echo "Redeploying dev bot..."
docker pull rainingman/scheduler-bot:dev
cd /srv/scheduler && docker compose up -d bot-dev
echo "Done."
