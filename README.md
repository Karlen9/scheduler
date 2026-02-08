# Scheduler - Telegram Mini App for Fitness Trainers

A multi-tenant scheduling platform where fitness trainers register their own Telegram bots via a master bot, and clients book sessions through a Telegram Mini App.

## Architecture

```
scheduler/
├── bot/              # Go backend (Telegram webhooks + REST API)
├── mini-app/         # Next.js 15 frontend (Telegram Mini App)
├── db-viewer/        # Drizzle Studio for DB inspection
├── docker-compose.yml
└── bot-data/         # SQLite database (created on VPS, gitignored)
```

### How it works

1. Trainer opens master bot (`@sportappmasterbot`) → registers their own bot
2. Client opens trainer's bot → `/start` → "Open Scheduler" button
3. Mini-app loads → client picks date/time → booking created (status: pending)
4. Trainer gets Telegram notification with Accept/Reject buttons
5. Trainer responds → client notified

### Infrastructure

| Component | Where | URL |
|-----------|-------|-----|
| Bot (Go) | VPS (Docker) | `sport-app.rainingman.online` |
| Mini-app (Next.js) | Vercel | deployed via `bunx vercel` |
| SSL | Caddy (VPS) | auto-TLS, proxies to `:8080` |
| DB | SQLite | `/root/bot-data/scheduler.db` on VPS |
| Images | Docker Hub | `rainingman/scheduler-bot` |

---

## Day-to-day Operations

### Updating the Mini-app (Next.js)

```bash
# 1. Make changes in mini-app/
cd mini-app

# 2. Test locally
bun dev

# 3. Deploy to Vercel
bunx vercel --prod

# That's it - no Docker needed for frontend changes
```

### Updating the Bot (Go backend)

```bash
# 1. Make changes in bot/

# 2. Test locally
cd bot && go build ./...

# 3. Build Docker image and push to Docker Hub (from project root)
docker buildx build --platform linux/amd64 \
  -t rainingman/scheduler-bot:latest \
  -f bot/Dockerfile bot --push

# 4. On VPS: pull and restart
ssh root@your-vps
cd /root/sport-app
docker compose pull bot
docker compose down && docker compose up -d

# 5. Verify
docker compose logs --tail 20 bot
```

### Quick reference: VPS commands

```bash
# Check status
docker compose ps
docker compose logs --tail 50 bot

# Restart bot
docker compose restart bot

# Full restart (if port issues)
docker compose down
sudo fuser -k 8080/tcp    # kill anything on port 8080
docker compose up -d

# Check what's on port 8080
sudo ss -tlnp | grep 8080
```

---

## VPS Setup

### Directory structure on VPS

```
/root/sport-app/
├── docker-compose.yml
├── bot/
│   └── .env              # environment variables
└── bot-data/
    └── scheduler.db      # SQLite database (persistent)
```

### docker-compose.yml

```yaml
services:
  bot:
    image: rainingman/scheduler-bot:latest
    network_mode: host
    volumes:
      - ./bot-data:/data
    env_file:
      - bot/.env
    environment:
      - DATABASE_PATH=/data/scheduler.db
    restart: unless-stopped
```

Key points:
- `network_mode: host` — container shares host network (avoids Docker DNS issues)
- `DATABASE_PATH=/data/scheduler.db` — always set in compose, never relies on `.env`
- `./bot-data:/data` — SQLite persists on host at `./bot-data/scheduler.db`

### bot/.env

```env
PUBLIC_BASE_URL=https://sport-app.rainingman.online
WEB_APP_URL=https://your-vercel-url.vercel.app
MASTER_BOT_TOKEN=your-master-bot-token
MASTER_WEBHOOK_SECRET=your-fixed-secret-hex-string
ADMIN_IDS=[your-telegram-id]
ENCRYPTION_KEY=your-64-char-hex-string
```

Generate secrets once and never change them:
```bash
openssl rand -hex 32   # for MASTER_WEBHOOK_SECRET
openssl rand -hex 32   # for ENCRYPTION_KEY
```

### Caddy config (`/etc/caddy/Caddyfile`)

```
sport-app.rainingman.online {
    reverse_proxy localhost:8080
}
```

Caddy handles SSL automatically.

---

## Database

### Viewing with Drizzle Studio

Drizzle Studio lets you browse the database via a web UI.

**Option 1: Locally with SSH tunnel**
```bash
# Terminal 1: SSH tunnel to copy DB
scp root@your-vps:/root/sport-app/bot-data/scheduler.db ./bot-data/scheduler.db

# Terminal 2: Open Drizzle Studio
cd db-viewer
bunx drizzle-kit studio
```

**Option 2: On VPS with port forward**
```bash
# SSH with port forwarding
ssh -L 4983:localhost:4983 root@your-vps

# On VPS
cd /root/sport-app/db-viewer
DB_PATH=/root/sport-app/bot-data/scheduler.db bunx drizzle-kit studio
```

### Direct SQLite queries

```bash
# On VPS, via Docker
docker compose exec bot sh -c "sqlite3 /data/scheduler.db \"SELECT name, telegram_handle FROM trainers;\""

# Or directly
sqlite3 /root/sport-app/bot-data/scheduler.db "SELECT * FROM trainers;"
```

### Backups

```bash
# Manual backup from VPS
scp root@your-vps:/root/sport-app/bot-data/scheduler.db ./backups/scheduler-$(date +%Y%m%d).db

# On VPS: local backup
cp /root/sport-app/bot-data/scheduler.db /root/sport-app/bot-data/scheduler-backup-$(date +%Y%m%d).db
```

Set up automatic daily backups with cron on VPS:
```bash
crontab -e
# Add this line:
0 3 * * * cp /root/sport-app/bot-data/scheduler.db /root/sport-app/bot-data/backups/scheduler-$(date +\%Y\%m\%d).db
```

Create the backups directory:
```bash
mkdir -p /root/sport-app/bot-data/backups
```

### Schema migrations

The bot auto-migrates on startup. New columns are added via `ALTER TABLE` statements in `bot/internal/db/db.go` that silently skip if the column already exists. No manual migration needed.

### Token encryption at rest

Bot tokens stored in the `trainers` table are encrypted with AES-256-GCM when `ENCRYPTION_KEY` is set. Lookups use a SHA-256 hash (`bot_token_hash` column) instead of the raw token.

- **Without `ENCRYPTION_KEY`**: tokens stored in plain text (backwards compatible, warning logged)
- **With `ENCRYPTION_KEY`**: existing plain-text tokens are automatically encrypted on startup
- **Key removal after encryption**: the app will fail to decrypt tokens (intentional — set the key back or re-create trainers)

Encrypted values in the DB are prefixed with `enc:` so the migration is idempotent and safe to run repeatedly.

---

## Troubleshooting

### Bot not responding to messages
1. Check webhook: `curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | python3 -m json.tool`
2. Check logs: `docker compose logs --tail 30 bot`
3. Verify bot is running: `docker compose ps`

### "address already in use" on port 8080
```bash
docker compose down
sudo fuser -k 8080/tcp
docker compose up -d
```

### "network is unreachable" in logs
Make sure `docker-compose.yml` uses `network_mode: host` instead of port mapping.

### Webhook 401 Unauthorized
The `MASTER_WEBHOOK_SECRET` in `.env` must be set. Without it, a random secret is generated on each restart, causing mismatches.

### Database appears empty in Drizzle Studio
- Make sure you're pointing to the correct file (`/root/sport-app/bot-data/scheduler.db`)
- If the DB was recreated, re-register via the master bot (`/start`)

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_BASE_URL` | Yes | VPS public URL (e.g., `https://sport-app.rainingman.online`) |
| `WEB_APP_URL` | Yes | Vercel mini-app URL |
| `MASTER_BOT_TOKEN` | Yes | Master bot token from BotFather |
| `MASTER_WEBHOOK_SECRET` | Yes | Fixed hex secret for webhook (generate once with `openssl rand -hex 32`) |
| `ADMIN_IDS` | No | Telegram user IDs with admin access (e.g., `[123456789]`) |
| `ENCRYPTION_KEY` | No | Hex-encoded 32-byte AES key for encrypting bot tokens at rest (generate with `openssl rand -hex 32`) |
| `DATABASE_PATH` | Set in compose | Always `/data/scheduler.db` (set in docker-compose.yml) |
| `PORT` | No | HTTP port (default: `8080`) |

## Development

### Mini-app
```bash
cd mini-app
bun install
bun dev           # http://localhost:3000
bun build         # production build
```

### Bot
```bash
cd bot
go run .          # requires env vars
go build ./...    # verify compilation
```
