#!/bin/bash
# Pull a gzipped pg_dump from the main server via SSH and rotate old backups.
set -eo pipefail

if [ -f /etc/environment ]; then
    while IFS='=' read -r _k _v; do
        [ -z "$_k" ] && continue
        [ -n "${!_k}" ] && continue
        _v="${_v%\"}"; _v="${_v#\"}"
        export "$_k=$_v"
    done < /etc/environment
fi

: "${SSH_HOST:?SSH_HOST env required}"
: "${SSH_USER:=root}"
: "${SSH_PORT:=22}"
: "${DB_CONTAINER:=sport-app-db-1}"
: "${DB_USER:=scheduler}"
: "${DB_NAME:=scheduler_prod}"
: "${RETENTION_HOURS:=336}"   # 14 days * 24

TS=$(date -u +%Y-%m-%dT%H-%M-%SZ)
OUT="/backups/${DB_NAME}_${TS}.sql.gz"
TMP="${OUT}.partial"

log() { echo "[$(date -Iseconds)] $*"; }

log "backup start: ${SSH_HOST} -> ${OUT}"

SSH_OPTS=(
    -o "StrictHostKeyChecking=accept-new"
    -o "UserKnownHostsFile=/var/lib/monitor/known_hosts"
    -o "BatchMode=yes"
    -o "ConnectTimeout=15"
    -p "${SSH_PORT}"
)

if ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" \
    "docker exec -i ${DB_CONTAINER} pg_dump -U ${DB_USER} ${DB_NAME}" \
    | gzip -9 > "${TMP}"; then

    SIZE=$(stat -c%s "${TMP}" 2>/dev/null || echo 0)
    if [ "${SIZE}" -lt 500 ]; then
        rm -f "${TMP}"
        log "FAIL: dump too small (${SIZE}B)"
        /usr/local/bin/telegram.sh "🚨 Backup FAILED — dump too small (${SIZE}B). Check pg_dump on ${SSH_HOST}."
        exit 1
    fi

    mv "${TMP}" "${OUT}"
    HUMAN_SIZE=$(du -h "${OUT}" | awk '{print $1}')
    log "backup ok: ${OUT} (${HUMAN_SIZE})"
else
    rm -f "${TMP}"
    log "FAIL: ssh/pg_dump error"
    /usr/local/bin/telegram.sh "🚨 Backup FAILED — ssh/pg_dump error from ${SSH_HOST}."
    exit 1
fi

# Rotate: keep newest RETENTION_HOURS files
cd /backups
COUNT=$(ls -1 "${DB_NAME}"_*.sql.gz 2>/dev/null | wc -l)
if [ "${COUNT}" -gt "${RETENTION_HOURS}" ]; then
    REMOVE=$((COUNT - RETENTION_HOURS))
    ls -1t "${DB_NAME}"_*.sql.gz | tail -n "${REMOVE}" | xargs -r rm -f
    log "rotated ${REMOVE} old backup(s), kept ${RETENTION_HOURS}"
fi

# Disk usage warning at >80%
USED_PCT=$(df /backups | tail -1 | awk '{print $5}' | tr -d '%')
if [ "${USED_PCT}" -gt 80 ]; then
    log "WARN: /backups is ${USED_PCT}% full"
    /usr/local/bin/telegram.sh "⚠️ Backup disk at ${USED_PCT}% — consider shorter retention or bigger disk."
fi
