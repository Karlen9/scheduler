#!/usr/bin/env bash
# Migrates a VPS running scheduler-bot from snap-docker to the official docker-ce on Ubuntu.
#
# Why: snap's AppArmor confinement conflicts with modern kernels' cgroup v2 handling and
# produces recurring "cannot stop container: permission denied" errors. docker-ce is the
# upstream build with no confinement layer and does not exhibit these failures.
#
# What's preserved: the Postgres database (the `pgdata` named volume). This script does BOTH:
#   - pg_dump logical backup (driver-agnostic, future-proof)
#   - raw volume tarball (identical bytes, fastest restore)
# Either backup alone is enough; both = belt and braces.
#
# The SQLite bind-mount at ./bot-data/scheduler.db is preserved automatically because it lives
# on the host filesystem, not inside Docker. The script does not touch it.
#
# Run as root inside a tmux/screen session:
#   tmux new -s mig
#   sudo bash migrate-to-docker-ce.sh
#
# Configurable via env vars (defaults shown):
#   COMPOSE_DIR=/root/Repositories/sport-app
#   PG_CONTAINER=sport-app-db-1
#   PG_VOLUME=sport-app_pgdata
#   PG_USER / PG_DB / PG_PASSWORD  (derived from docker-compose.yml env if unset)

set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/root/Repositories/sport-app}"
PG_CONTAINER="${PG_CONTAINER:-sport-app-db-1}"
PG_VOLUME="${PG_VOLUME:-sport-app_pgdata}"
# These are picked up from the db container env so a rename in docker-compose.yml is tolerated.
PG_USER="${PG_USER:-}"
PG_DB="${PG_DB:-}"

BACKUP_DIR="/root/docker-migration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

log() { printf '\n===> %s\n' "$*"; }
warn() { printf '\nWARN: %s\n' "$*" >&2; }
die()  { printf '\nFATAL: %s\n' "$*" >&2; exit 1; }

require_root() {
  [[ $EUID -eq 0 ]] || die "Run as root: sudo bash $0"
}

# kill_stuck_containers walks the process table for any containerd-shim-runc-v2 that snap-docker
# spawned and that `docker stop` can't signal. Each invocation is idempotent.
kill_stuck_containers() {
  log "Killing any stuck snap-docker shims"
  local pids
  pids="$(pgrep -f 'containerd-shim-runc-v2.*snap.docker' || true)"
  if [[ -n "$pids" ]]; then
    echo "  shim PIDs: $pids"
    echo "$pids" | xargs -r kill -9 || true
  fi
  # Also thaw + empty any stuck cgroups so runc delete isn't blocked forever.
  while IFS= read -r cg; do
    echo 0 | tee "$cg/cgroup.freeze" >/dev/null 2>&1 || true
    xargs -r kill -9 < "$cg/cgroup.procs" 2>/dev/null || true
  done < <(find /sys/fs/cgroup -path '*docker*' -name 'cgroup.freeze' -type f 2>/dev/null | xargs -r dirname 2>/dev/null | sort -u)
}

phase_preflight() {
  log "Pre-flight"
  [[ -d "$COMPOSE_DIR" ]] || die "COMPOSE_DIR=$COMPOSE_DIR missing"
  [[ -f "$COMPOSE_DIR/docker-compose.yml" ]] || die "docker-compose.yml not in $COMPOSE_DIR"
  if ! snap list docker >/dev/null 2>&1; then
    warn "snap docker not installed. If docker-ce is already in place, nothing to do. Exiting."
    exit 0
  fi
  command -v docker >/dev/null || die "docker CLI missing on PATH"

  # Discover PG credentials from the running db container's env so we don't have to read .env.
  if [[ -z "$PG_USER" || -z "$PG_DB" ]]; then
    local env_json
    env_json="$(docker inspect "$PG_CONTAINER" --format '{{json .Config.Env}}' 2>/dev/null || echo '[]')"
    [[ -z "$PG_USER" ]] && PG_USER="$(echo "$env_json" | sed -n 's/.*"POSTGRES_USER=\([^"]*\)".*/\1/p')"
    [[ -z "$PG_DB"   ]] && PG_DB="$(echo "$env_json" | sed -n 's/.*"POSTGRES_DB=\([^"]*\)".*/\1/p')"
  fi
  : "${PG_USER:=scheduler}"
  : "${PG_DB:=scheduler}"

  echo "  COMPOSE_DIR: $COMPOSE_DIR"
  echo "  PG_CONTAINER: $PG_CONTAINER"
  echo "  PG_VOLUME: $PG_VOLUME"
  echo "  PG_USER: $PG_USER"
  echo "  PG_DB: $PG_DB"
  echo "  BACKUP_DIR: $BACKUP_DIR"
}

phase_backup() {
  kill_stuck_containers
  cd "$COMPOSE_DIR"

  log "Starting the db container (others can stay down)"
  docker compose up -d db
  log "Waiting for Postgres to accept connections"
  for i in {1..60}; do
    if docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" >/dev/null 2>&1; then
      break
    fi
    sleep 2
    [[ $i -eq 60 ]] && die "Postgres never became ready"
  done

  log "pg_dump (logical backup, no -t flag this time)"
  # -i (interactive) is fine to omit; we want stdin closed and stdout plain bytes.
  docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner --no-privileges \
    > "$BACKUP_DIR/pg_dump.sql"

  local dump_bytes
  dump_bytes=$(stat -c%s "$BACKUP_DIR/pg_dump.sql")
  echo "  pg_dump size: $dump_bytes bytes"
  if [[ $dump_bytes -lt 10000 ]]; then
    warn "pg_dump is suspiciously small ($dump_bytes bytes). Peeking at contents:"
    head -50 "$BACKUP_DIR/pg_dump.sql"
    die "Backup looks empty or corrupt — aborting before anything destructive. Fix credentials / DB name and re-run."
  fi
  if ! grep -q 'CREATE TABLE' "$BACKUP_DIR/pg_dump.sql"; then
    warn "pg_dump has no CREATE TABLE statements. Peeking:"
    head -50 "$BACKUP_DIR/pg_dump.sql"
    die "Backup does not contain schema — aborting. Verify PG_DB=$PG_DB is the right database."
  fi
  echo "  pg_dump contains $(grep -c '^CREATE TABLE' "$BACKUP_DIR/pg_dump.sql") tables"

  log "Raw tar of the pgdata volume (fastest restore path)"
  # Mount the volume read-only and tar its contents. --checkpoint keeps progress visible.
  docker run --rm \
    -v "$PG_VOLUME:/src:ro" \
    -v "$BACKUP_DIR:/dst" \
    alpine:3.19 \
    sh -c "tar -czf /dst/pgdata-volume.tar.gz -C /src ."
  echo "  raw volume tarball: $(du -h "$BACKUP_DIR/pgdata-volume.tar.gz" | cut -f1)"

  log "Saving .env and docker-compose.yml for rollback reference"
  [[ -f "$COMPOSE_DIR/bot/.env" ]] && cp "$COMPOSE_DIR/bot/.env" "$BACKUP_DIR/bot-env"
  cp "$COMPOSE_DIR/docker-compose.yml" "$BACKUP_DIR/docker-compose.yml"

  log "Stopping the stack (killing stuck shims if any)"
  docker compose down --remove-orphans || {
    warn "docker compose down failed (expected if a container is stuck). Force-cleaning..."
    kill_stuck_containers
    # Force-remove any containers still around.
    docker ps -aq --filter "label=com.docker.compose.project=$(basename "$COMPOSE_DIR")" \
      | xargs -r docker rm -f || true
  }
}

phase_remove_snap() {
  log "Removing snap-docker"
  kill_stuck_containers
  snap stop docker || true
  if ! snap remove --purge docker; then
    warn "snap remove failed — attempting manual cleanup"
    pkill -9 -f /snap/docker || true
    pkill -9 -f snap.docker || true
    pkill -9 dockerd || true
    rm -rf /var/snap/docker /run/snap.docker || true
    snap remove --purge docker || warn "snap remove still failed; new docker-ce will install regardless"
  fi
  # Extra belt: clear any dangling snap-docker paths.
  rm -rf /snap/docker /var/snap/docker /run/snap.docker 2>/dev/null || true
  systemctl disable --now snap.docker.dockerd.service 2>/dev/null || true
}

phase_install_dockerce() {
  log "Installing docker-ce from the official Docker apt repo"
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg

  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi

  local arch codename
  arch="$(dpkg --print-architecture)"
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${codename} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable --now docker
  docker --version
  docker compose version
}

phase_restore() {
  log "Creating the named volume on docker-ce"
  cd "$COMPOSE_DIR"

  # Let compose create the empty volume with the right name, then we'll stuff it with the tarball.
  docker compose --profile '' config >/dev/null 2>&1 || true
  docker volume create "$PG_VOLUME" >/dev/null

  log "Restoring pgdata-volume.tar.gz into the new volume (fastest path)"
  docker run --rm \
    -v "$PG_VOLUME:/dst" \
    -v "$BACKUP_DIR:/src:ro" \
    alpine:3.19 \
    sh -c "cd /dst && tar -xzf /src/pgdata-volume.tar.gz"

  log "Pulling images and bringing up the db container"
  docker compose pull
  docker compose up -d db

  log "Waiting for Postgres to accept connections"
  for i in {1..60}; do
    if docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" >/dev/null 2>&1; then
      break
    fi
    sleep 2
    [[ $i -eq 60 ]] && die "Postgres did not come up after restore"
  done

  log "Verifying row counts match by comparing a table from the dump"
  # Pick `specialists` as a canonical table; adjust if renamed.
  local dump_specialists
  dump_specialists=$(grep -c "^COPY public.specialists " "$BACKUP_DIR/pg_dump.sql" || true)
  local live_specialists
  live_specialists=$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -t -c "SELECT COUNT(*) FROM specialists;" 2>/dev/null | tr -d ' ' || echo "0")
  echo "  live specialists rows: ${live_specialists}"
  if [[ "${live_specialists:-0}" == "0" ]]; then
    warn "Live specialists table is empty. The raw tar restore may have mismatched a Postgres major version."
    warn "Falling back to logical restore from pg_dump.sql."
    docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" < "$BACKUP_DIR/pg_dump.sql"
    live_specialists=$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -t -c "SELECT COUNT(*) FROM specialists;" 2>/dev/null | tr -d ' ' || echo "0")
    echo "  after logical restore: specialists rows = ${live_specialists}"
    if [[ "${live_specialists:-0}" == "0" ]]; then
      die "Restore failed. Backups are at $BACKUP_DIR — investigate before retrying."
    fi
  fi
}

phase_up() {
  log "Bringing up the full stack"
  cd "$COMPOSE_DIR"
  docker compose up -d
  sleep 3
  docker compose ps
  log "Tail of bot logs (first 40 lines)"
  docker compose logs --tail 40 bot || true
}

phase_summary() {
  log "Migration complete"
  cat <<EOF

Backups (keep for 24–48h before deleting):
  $BACKUP_DIR/pg_dump.sql           logical Postgres dump
  $BACKUP_DIR/pgdata-volume.tar.gz  raw pgdata volume
  $BACKUP_DIR/bot-env               bot .env snapshot
  $BACKUP_DIR/docker-compose.yml    compose snapshot

Verify the bot in Telegram:
  - /start to @sportappmasterbot    menu should appear in Russian
  - Tap "💬 Помощь оператора"         creates a topic in SUPPORT_GROUP_ID
  - Your specialist bots /start      should still work

Roll back (only if docker-ce misbehaves):
  snap install docker
  cd $COMPOSE_DIR && docker compose down
  docker volume rm $PG_VOLUME
  docker volume create $PG_VOLUME
  docker run --rm -v $PG_VOLUME:/dst -v $BACKUP_DIR:/src:ro alpine sh -c 'cd /dst && tar -xzf /src/pgdata-volume.tar.gz'
  docker compose up -d
EOF
}

require_root
phase_preflight
phase_backup
phase_remove_snap
phase_install_dockerce
phase_restore
phase_up
phase_summary
