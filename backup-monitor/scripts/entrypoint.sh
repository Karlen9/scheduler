#!/bin/bash
set -e

mkdir -p /backups /var/lib/monitor /var/log

if [ -d /root/.ssh ]; then
    chmod 700 /root/.ssh || true
    find /root/.ssh -type f -exec chmod 600 {} \; 2>/dev/null || true
fi

# Export env to /etc/environment so cron jobs see it
printenv | grep -E '^(SSH_|DB_|HEALTH_|TELEGRAM_|RETENTION_|BACKUP_)' \
    | sed 's/^/export /' > /etc/profile.d/monitor-env.sh
printenv | grep -E '^(SSH_|DB_|HEALTH_|TELEGRAM_|RETENTION_|BACKUP_)' \
    > /etc/environment

touch /var/log/cron.log /var/log/backup.log /var/log/health.log

echo "[$(date -Iseconds)] backup-monitor started" | tee -a /var/log/cron.log

# Startup sanity check — don't alert on failure, just log
/usr/local/bin/health.sh || true

# Start cron in background
crond -f -l 8 >> /var/log/cron.log 2>&1 &
CRON_PID=$!

# Tail all logs to stdout so `docker logs` shows activity
tail -F /var/log/cron.log /var/log/backup.log /var/log/health.log &

wait $CRON_PID
