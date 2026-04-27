#!/usr/bin/env bash
# Build and push the backup-monitor image to Docker Hub.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${IMAGE:-rainingman/scheduler-monitor:latest}"

cd "$ROOT/backup-monitor"

echo "==> docker build $IMAGE"
docker build --platform linux/amd64 -t "$IMAGE" .

echo "==> docker push $IMAGE"
docker push "$IMAGE"

echo "==> done"
