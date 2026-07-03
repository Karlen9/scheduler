# Migrating the scheduler backend to a new VPS

This guide walks through moving the Go backend + Postgres database + backup
monitor from the old server to a fresh VPS, using the bundle in this
directory (`deploy/new-server/`).

## Placeholders used in this guide

Defined once here, used consistently everywhere below:

- `OLD_IP` — the current/old server's IP address (or hostname).
- `NEW_IP` — the new VPS's IP address (or hostname).
- `DOMAIN` — the public API domain (e.g. `api.example.com`). This does
  **not** change during the migration — only its DNS A/AAAA record is
  re-pointed from `OLD_IP` to `NEW_IP`.

Wherever a command below shows `OLD_IP`, `NEW_IP`, or `DOMAIN`, substitute
the real value.

---

## 0. What moves and what doesn't

| Component                       | Moves?     | Notes                                                                                                                                                               |
| ------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mini-app (Vercel)               | No         | Frontend stays on Vercel, unaffected by the VPS migration.                                                                                                          |
| Owner dashboard (Vercel)        | No         | Same as above.                                                                                                                                                      |
| Docker Hub images               | No         | `rainingman/scheduler-bot`, `rainingman/scheduler-monitor` are pulled fresh on the new box; the registry itself doesn't move.                                       |
| Go backend container            | Yes        | Redeployed on the new VPS as the `bot` compose service.                                                                                                             |
| Postgres data                   | Yes        | Dumped on the old server, restored on the new one.                                                                                                                  |
| Legacy SQLite `bot-data` volume | Yes        | Rsynced across — kept for backward compat even though the backend runs on Postgres.                                                                                 |
| Caddy / TLS                     | Yes        | Re-provisioned as a compose service (`caddy`) instead of a host-level Caddy install.                                                                                |
| Redeploy webhook                | Yes        | Moves from adnanh/webhook-in-old-setup to a host-level `webhook` process + systemd unit on the new server. Tokens are rotated (mandatory — see step 8).             |
| Backup monitor                  | Yes        | Redeployed, initially on the same box; ideally moved to a third box later (see step 9's warning).                                                                   |
| DNS A/AAAA record               | Re-pointed | Only the IP target changes; the domain name itself is unchanged.                                                                                                    |
| Telegram webhook URLs           | Unchanged  | Because `DOMAIN` doesn't change, registered webhook URLs stay valid. The bot's webhook self-healer re-registers anything that comes back with errors after cutover. |

Target architecture:

```
                      Internet
                         |
                         v
              +---------------------+
              | Caddy (compose)     |  :443, :80
              | reverse_proxy       |
              +----------+----------+
                 |                 |
     /hooks/*    |                 |  everything else
                 v                 v
   host.docker.internal:9000   bot:8080 (compose, no published ports)
   (host-level `webhook`            |
    process, systemd)               v
                              Postgres (compose)
                              127.0.0.1:5432 only

   monitor sidecar (compose, --profile monitor):
   SSHes back into this same host (or ideally a separate box)
   and runs `docker exec ... pg_dump` to take backups.

   Vercel apps (mini-app, owner dashboard) and Docker Hub registry
   sit outside this diagram entirely — unaffected by this migration.
```

---

## 1. Inventory the old server first

Do this _before_ renting anything new. From your local machine, pull
everything you'll need into a local archive directory:

```bash
mkdir -p old-server-archive
scp root@OLD_IP:/root/sport-app/docker-compose.yml old-server-archive/
scp root@OLD_IP:/root/sport-app/bot/.env old-server-archive/bot.env.REAL
scp root@OLD_IP:/etc/caddy/Caddyfile old-server-archive/Caddyfile.old
scp root@OLD_IP:/root/sport-app/hooks.json old-server-archive/hooks.json.old
# Optional — only if these exist on your old server. The new bundle
# already ships working replacements (see webhook-redeploy/), so it's
# fine if nothing comes back here.
rsync -avz "root@OLD_IP:/scripts/redeploy*.sh" old-server-archive/ 2>/dev/null || true
```

Notes on each item:

- **`/root/sport-app/docker-compose.yml`** — the _live_ compose file on the
  old server. It differs from the repo's root `docker-compose.yml`: the
  live one has an extra `bot-dev` service that isn't checked in. Confirm
  this when you copy it, since it affects whether `redeploy-dev.sh` has
  anything to do on the new server.
- **`/root/sport-app/bot/.env`** — contains `ENCRYPTION_KEY`, which is
  irreplaceable. If this is lost, every specialist's stored Telegram bot
  token becomes permanently undecryptable. Treat this file as the single
  most important thing to copy correctly.
- **Caddy config + certs** — the old server runs Caddy at the host level
  (not in a container), so:
  - Caddyfile: `/etc/caddy/Caddyfile`
  - Cert storage: typically `/var/lib/caddy/.local/share/caddy`
    If it turns out Caddy was containerized instead on the box you're
    migrating, the equivalent cert storage would be a `caddy_data` docker
    volume instead — check which actually applies before assuming.
- **`hooks.json` + `/scripts/redeploy*.sh`** — adnanh/webhook's hook
  definitions and the scripts they invoke on the old server, _if_ that
  redeploy flow is actually running there. This item is optional to
  recover: the new bundle already ships its own working
  `redeploy.sh` / `redeploy-dev.sh` (see `webhook-redeploy/`), so if
  `/scripts/redeploy*.sh` doesn't exist on your old server, or nothing
  is listening on the webhook port, just skip this and set the hook up
  fresh in Section 8 instead. If the old scripts _do_ exist, check the
  file you downloaded (`old-server-archive/hooks.json.old`) for the
  real `execute-command` paths first — they may not match
  `/scripts/...` if the live deployment has drifted from what's
  checked into the repo's git history.
- **Confirm the real DB name in use**:

  ```bash
  ssh root@OLD_IP "docker exec sport-app-db-1 psql -U scheduler -l"
  ```

- **Anything not in compose** — check crontab as root and as any other
  relevant user:

  ```bash
  ssh root@OLD_IP "crontab -l"
  ssh root@OLD_IP "crontab -l -u deploy" # or whatever other users exist
  ```

---

## 2. T-24h: drop DNS TTL

At least 24 hours before the planned cutover, lower the TTL on `DOMAIN`'s
A (and AAAA, if set) record to 60-300 seconds. This is what makes the
actual cutover in step 7 propagate quickly instead of taking hours.

---

## 3. Rent + provision the new VPS

- OS: Ubuntu 24.04 LTS.
- Size: >=1 vCPU / 1GB RAM minimum; 2GB is comfortable.
- Add your SSH public key at creation time (most providers offer this at
  the "create server" step).

First login as root:

```bash
scp setup-server.sh root@NEW_IP:/root/
ssh root@NEW_IP
chmod +x /root/setup-server.sh
/root/setup-server.sh
```

**Before closing this root session**, open a _second_ terminal and verify:

```bash
ssh deploy@NEW_IP
```

works. `setup-server.sh` prints this same warning after it hardens SSH —
do not skip this check. If password auth gets disabled and the `deploy`
key doesn't work, you'd otherwise lock yourself out entirely.

---

## 4. Lay out the app directory

As the `deploy` user, copy this bundle to the new server:

```bash
rsync -avz /Users/user/Documents/karlen/scheduler/deploy/new-server/ deploy@NEW_IP:/srv/scheduler/
```

Then, on the new server inside `/srv/scheduler`:

```bash
cd /srv/scheduler

cp .env.example .env
# edit .env: set DOMAIN, ACME_EMAIL, and generate DB_PASSWORD with:
openssl rand -hex 24

cp bot.env.example bot.env
# REPLACE bot.env's contents entirely with the REAL bot/.env pulled from
# the old server in step 1 (old-server-archive/bot.env.REAL). Do not
# hand-fill placeholders — see the warning block at the top of
# bot.env.example. If that real .env happens to contain a stray
# DATABASE_URL line, it's harmless: docker-compose.yml's `environment:`
# block for the bot service always overrides values loaded from env_file.

cp monitor.env.example monitor.env
# fill in real values (see step 9 for SSH_HOST/SSH_USER specifics)

mkdir -p bot-data backups monitor-state ssh
mv webhook-redeploy hooks

docker compose pull
```

---

## 5. Rehearse the DB restore

Do this before the actual cutover — it carries zero risk to production
since it targets a throwaway volume.

```bash
docker compose up -d db
```

Take a fresh dump from the OLD server:

```bash
ssh root@OLD_IP "docker exec -i sport-app-db-1 pg_dump -U scheduler scheduler_prod" | gzip > rehearsal.sql.gz
```

Restore it into the new (empty) db:

```bash
gunzip -c rehearsal.sql.gz | docker compose exec -T db psql -U scheduler -d scheduler_prod
```

Sanity-check the restore:

```bash
docker compose exec db psql -U scheduler -d scheduler_prod -c "select count(*) from specialists;"
docker compose exec db psql -U scheduler -d scheduler_prod -c "select count(*) from bookings;"
```

Once you're satisfied the restore process works, wipe it clean again so
the real cutover starts from a fresh volume:

```bash
docker compose rm -sf db
docker volume rm scheduler_pgdata
```

(The volume is named `scheduler_pgdata` — `<compose-name>_<volume-name>` —
because `docker-compose.yml` sets the top-level `name: scheduler`.)

---

## 6. Pre-stage certificates (optional, zero cert-gap)

This step avoids any ACME issuance delay by copying the old server's
already-valid certificate into the new Caddy's data volume _before_ the
DNS flip, so the new Caddy can serve HTTPS immediately on first request.

Since the old server runs Caddy at the host level (see step 1), lead with
that case:

```bash
# On the old server: package up Caddy's cert storage
ssh root@OLD_IP "tar czf - -C /var/lib/caddy/.local/share/caddy ." > caddy-data.tar.gz

# Copy it into the new server's caddy_data docker volume via a throwaway
# helper container (run this on the new server, in /srv/scheduler):
scp caddy-data.tar.gz deploy@NEW_IP:/srv/scheduler/
ssh deploy@NEW_IP
cd /srv/scheduler
docker volume create scheduler_caddy_data # created automatically by `docker compose up`, but safe to pre-create
docker run --rm \
  -v scheduler_caddy_data:/data \
  -v "$(pwd)":/backup \
  alpine sh -c "tar xzf /backup/caddy-data.tar.gz -C /data"
```

If instead the old server ran Caddy as a container with its own
`caddy_data` volume, skip the tar/ssh step above and instead copy volume
to volume, e.g. by mounting both an old-server backup and the new volume
into one throwaway `alpine` container and `cp -a`'ing between them.

**Alternative**: skip this step entirely and accept ~10-60 seconds of
fresh ACME certificate issuance immediately after the DNS flip in step 7.
Simpler, and the gap is brief — many teams just accept this.

---

## 7. Cutover (the maintenance window, ~5-15 min)

1. Announce/pick a quiet hour.
2. On the **old** server, stop the bot(s) so nothing writes to the old DB
   during the migration:

   ```bash
   ssh root@OLD_IP "cd /root/sport-app && docker compose stop bot bot-dev"
   ```

   Bookings pause during this window. Telegram queues webhook updates for
   a while, so messages/interactions from clients during the window
   aren't lost — they just arrive late once the new webhook comes online.

3. Final dump + transfer + restore into the new db (repeat the rehearsed
   commands from step 5, but this time against the freshly recreated
   `scheduler_pgdata` volume):

   ```bash
   ssh root@OLD_IP "docker exec -i sport-app-db-1 pg_dump -U scheduler scheduler_prod" | gzip > final.sql.gz
   docker compose up -d db
   gunzip -c final.sql.gz | docker compose exec -T db psql -U scheduler -d scheduler_prod
   ```

4. Rsync the old legacy SQLite `bot-data/` volume across:

   ```bash
   rsync -avz root@OLD_IP:/root/sport-app/bot-data/ deploy@NEW_IP:/srv/scheduler/bot-data/
   ```

5. Bring the rest of the stack up on the new server (this starts `caddy`,
   `bot`, `db` — **not** `monitor`, which is a separate profile started
   later in step 9):

   ```bash
   docker compose up -d
   ```

6. Pre-DNS smoke test:

   ```bash
   curl --resolve DOMAIN:443:NEW_IP https://DOMAIN/health
   ```

   This works cleanly if certificates were pre-staged in step 6. If they
   were **not** pre-staged, be aware this smoke test may fail with a TLS
   error at this point — Caddy's automatic certificate issuance requires
   HTTP-01 validation, which requires `DOMAIN` to already resolve to
   `NEW_IP`.
   Since DNS hasn't flipped yet, issuance can't complete until step 7.7.
   Don't panic if this step returns a TLS error when certs weren't
   pre-staged; it's expected and resolves itself right after the DNS flip.

7. Flip the A (and AAAA, if set) record for `DOMAIN` to `NEW_IP`. Watch
   propagation and confirm health:

   ```bash
   dig +short DOMAIN
   docker compose logs -f caddy
   curl https://DOMAIN/health
   ```

8. Verify Telegram end-to-end:

   ```bash
   curl "https://api.telegram.org/bot$MASTER_BOT_TOKEN/getWebhookInfo"
   ```

   Check `last_error_date` / `pending_update_count` look sane (no pileup,
   no persistent errors). Then:
   - Send `/start` to the master bot.
   - Make one full test booking through a specialist bot end-to-end.

   The bot's webhook self-healer background loop re-registers any
   specialist bot webhooks that come back with errors, so isolated stale
   webhooks should self-correct within its normal poll interval — no
   manual intervention needed for those.

---

## 8. Re-establish the redeploy hooks

The `webhook-redeploy/` assets should already be at `/srv/scheduler/hooks/`
from step 4.

Generate two fresh tokens:

```bash
openssl rand -hex 32   # prod token
openssl rand -hex 32   # dev token
```

Edit `/srv/scheduler/hooks/hooks.json`, replacing
`REPLACE_WITH_NEW_TOKEN_PROD` and `REPLACE_WITH_NEW_TOKEN_DEV` with the
two values you just generated.

**New tokens are mandatory, not optional**: the old tokens are permanently
visible in this repository's git history at `deploy/hooks.json` and must
be treated as compromised forever, regardless of whether that file is
later deleted or rotated in-place — git history retains it.

Install the systemd unit:

```bash
sudo cp /srv/scheduler/hooks/webhook.service /etc/systemd/system/webhook.service
sudo systemctl daemon-reload
sudo systemctl enable --now webhook
```

Test it:

```bash
curl "https://DOMAIN/hooks/redeploy?token=NEW_TOKEN"
```

Finally, update any CI/deploy script that referenced the old hook
URL/token with the new `DOMAIN` + rotated token.

---

## 9. Backup monitor on the new box

Generate a dedicated SSH keypair for the monitor to use:

```bash
ssh-keygen -t ed25519 -f /srv/scheduler/ssh/id_ed25519 -N ""
```

Append the resulting `.pub` key to `deploy`'s own authorized_keys (the
monitor SSHes back into the **same** host it runs on, as
`SSH_HOST=NEW_IP`, `SSH_USER=deploy` — `deploy` is already in the `docker`
group from `setup-server.sh`, so `docker exec` inside that SSH session
works):

```bash
cat /srv/scheduler/ssh/id_ed25519.pub >> /home/deploy/.ssh/authorized_keys
```

Fill in `monitor.env` from the example: `SSH_HOST=NEW_IP`,
`SSH_USER=deploy`, `DB_CONTAINER=scheduler-db-1`, etc.

Copy over the old backup archive for continuity:

```bash
rsync -avz root@OLD_IP:/root/sport-app/backup-monitor/backups/ deploy@NEW_IP:/srv/scheduler/backups/
```

Start the monitor:

```bash
docker compose --profile monitor up -d monitor
```

Force a first run immediately rather than waiting for the hourly cron:

```bash
docker compose exec monitor /usr/local/bin/backup.sh
docker compose exec monitor /usr/local/bin/health.sh
```

Confirm a fresh `.sql.gz` lands in `backups/` and that no Telegram alert
fires (the alert scripts use 🚨/⚠️/🔴-style messages — seeing one here
means something's wrong with the run, not a false positive to ignore).

> **Warning**: a monitor running on the SAME host it's protecting cannot
> alert you when the whole host is down — it can't SSH out, and its cron
> isn't running either if the box is off. Pair it with a free external
> uptime check (e.g. UptimeRobot) hitting `https://DOMAIN/health`, or,
> better, run the monitor container on any OTHER machine you control —
> it only needs outbound SSH access to the target server.

---

## 10. Observation + rollback plan

Keep the OLD server rented, but with its bot service **stopped**, for
3-7 days after cutover. Never run both bots simultaneously — the
background reminder workers on both would double-send Telegram messages
to clients.

**Rollback procedure**, if something is badly wrong with the new server:

1. Dump anything written on the NEW server since cutover:

   ```bash
   docker compose exec -T db pg_dump --clean --if-exists -U scheduler scheduler_prod | gzip > rollback.sql.gz
   ```

   `--clean --if-exists` makes the restore drop and recreate objects before
   loading them, so it safely overwrites the old server's stale data instead
   of failing with "relation already exists" errors against its
   already-populated `scheduler_prod`.

2. Restore it into the OLD server's db:

   ```bash
   gunzip -c rollback.sql.gz | ssh root@OLD_IP "docker exec -i sport-app-db-1 psql -U scheduler -d scheduler_prod"
   ```

3. Point DNS back to `OLD_IP`.

4. Bring the old stack back up:

   ```bash
   ssh root@OLD_IP "cd /root/sport-app && docker compose up -d"
   ```

---

## 11. Decommission

After the observation window passes with no issues:

```bash
ssh root@OLD_IP "tar czf /root/old-server-final.tar.gz /root/sport-app/bot/.env /root/sport-app/*.sql.gz /root/sport-app/backup-monitor/backups"
scp root@OLD_IP:/root/old-server-final.tar.gz ./old-server-archive/
```

Then:

- Destroy the old VPS via your hosting provider's dashboard/CLI.
- Remove its entry from local known_hosts: `ssh-keygen -R OLD_IP`
- Restore `DOMAIN`'s DNS TTL back to a normal value (3600 or higher).
- Remove the old server's SSH key from anywhere it was authorized (any
  deploy/CI system that had access to `OLD_IP`).

---

## 12. Day-2 operations cheat-sheet

- **Deploy an update**: run `deploy/build-and-push.sh` from the repo root
  to push a new image, then either hit the redeploy webhook
  (`curl "https://DOMAIN/hooks/redeploy?token=NEW_TOKEN"`) or manually:

  ```bash
  docker compose pull bot && docker compose up -d bot
  ```

- **Tail logs**: `docker compose logs -f bot`
- **Check disk**: `df -h`
- **Verify backups are fresh**: `ls -lt backups | head`
- **Quarterly restore drill**: periodically repeat the rehearsal steps
  from step 5 against a scratch volume, to confirm backups are actually
  restorable and not just present.
- **Reclaim disk space occasionally**: `docker system prune -f`
- OS security patches are already handled automatically by
  `unattended-upgrades`, enabled by `setup-server.sh`.
