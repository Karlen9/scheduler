#!/bin/sh
echo "Redeploying dev bot..."
docker pull rainingman/scheduler-bot:dev
cd /root/sport-app && docker compose up -d bot-dev
echo "Done."
