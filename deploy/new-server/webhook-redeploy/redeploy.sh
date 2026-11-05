#!/bin/sh
echo "Redeploying bot..."
docker pull rainingman/scheduler-bot:latest
cd /srv/scheduler && docker compose up -d bot
echo "Done."
