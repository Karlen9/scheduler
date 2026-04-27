#!/usr/bin/env bash
# Build, test, and push the bot image to Docker Hub.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${IMAGE:-rainingman/scheduler-bot:latest}"

cd "$ROOT/bot"
echo "==> go build"
go build ./...
echo "==> go test"
go test ./...

cd "$ROOT"
echo "==> docker build $IMAGE"
docker build --platform linux/amd64 -t "$IMAGE" -f bot/Dockerfile bot/

echo "==> docker push $IMAGE"
docker push "$IMAGE"

echo "==> done"
