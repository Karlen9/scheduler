# Scheduler - Telegram Mini App for Specialists

A multi-tenant scheduling platform where professionals (fitness trainers, teachers, beauty specialists, etc.) register their own Telegram bots via a master bot, and clients book sessions through a Telegram Mini App.

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

1. Specialist opens master bot (`@sportappmasterbot`) → registers their own bot
2. Client opens specialist's bot → `/start` → "Open Scheduler" button
3. Mini-app loads → client picks date/time/duration → booking created (status: pending)
4. Specialist gets Telegram notification with Accept/Reject buttons
5. Specialist responds → client notified via Telegram

### Key features

- **Multi-tenant**: each specialist gets their own Telegram bot via master bot onboarding
- **Dual booking flow**: clients create bookings (specialist approves) or specialist creates bookings (client approves)
- **Recurring schedules**: weekly repeating bookings with per-day time selection and two-sided approval
- **Duration-based booking**: clients pick duration (1h, 1.5h, etc.) instead of rigid session types
- **Ghost clients**: specialists can create bookings for clients without Telegram accounts
- **Display names**: specialists can set custom display names for clients
- **i18n**: Russian and English, both backend (go-i18n) and frontend (next-intl)
- **Light/dark theme**: auto-detected from Telegram's color scheme
- **Token encryption**: bot tokens encrypted at rest with AES-256-GCM

### Infrastructure

| Component | Where | URL |
|-----------|-------|-----|
| Bot (Go) | VPS (Docker) | `sport-app.rainingman.online` |
| Mini-app (Next.js) | Vercel | deployed via `bunx vercel` |
| SSL | Caddy (VPS) | auto-TLS, proxies to `:8080` |
| DB | SQLite | `/root/bot-data/scheduler.db` on VPS |
| Images | Docker Hub | `rainingman/scheduler-bot` |

### Tech stack

| Component | Technology |
|-----------|-----------|
| Backend | Go 1.24, chi router |
| Database | SQLite (default) / PostgreSQL (opt-in) |
| Frontend | Next.js 15, React 19, Tailwind CSS 4, SWR |
| i18n | go-i18n (backend), next-intl (frontend) |
| Testing | `go test` (backend), Vitest + happy-dom (frontend) |
| Linting | gofmt, ESLint 9, Prettier |
| Pre-commit | Husky + lint-staged + test runners |

---

## Day-to-day Operations

### Updating the Mini-app (Next.js)

```bash
cd mini-app
bun dev               # test locally
bunx vercel --prod    # deploy to Vercel
```

### Updating the Bot (Go backend)

```bash
# 1. Test locally
cd bot && go build ./... && go test ./...

# 2. Build and push Docker image
docker build --platform linux/amd64 -t rainingman/scheduler-bot:latest -f bot/Dockerfile bot/
docker push rainingman/scheduler-bot:latest

# 3. On VPS: pull and restart
ssh root@your-vps
cd /root/sport-app
docker compose pull bot
docker compose down && docker compose up -d

# 4. Verify
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
sudo fuser -k 8080/tcp
docker compose up -d

# Check what's on port 8080
sudo ss -tlnp | grep 8080
```

---

## Mini-app Pages

### Client pages

| Route | Description |
|-------|-------------|
| `/` | Home screen — specialist profile, bio, contact, services list, location map |
| `/services` | Full services listing with prices and durations |
| `/book` | Booking flow — calendar, time slots, duration picker |
| `/bookings` | Client's bookings list with cancel/confirm/decline actions |
| `/recurring` | Client's recurring schedules list |
| `/recurring/[id]` | Recurring schedule detail with per-booking management |
| `/profile` | Client profile and notification preferences |

### Admin pages

| Route | Description |
|-------|-------------|
| `/admin` | Dashboard — today's timeline, pending bookings, quick actions |
| `/admin/bookings` | All bookings with status filters |
| `/admin/book` | Create booking for a client (or ghost client) |
| `/admin/clients` | Client list with display name editing and ghost client creation |
| `/admin/recurring` | Recurring schedules management with approve/decline |
| `/admin/recurring/[id]` | Recurring schedule detail with per-booking move/cancel |
| `/admin/settings` | Settings hub |
| `/admin/settings/profile` | Specialist profile (name, bio, photo, location, phone) |
| `/admin/settings/schedule` | Working hours per day of week |
| `/admin/settings/services` | Session types with price, duration, image |
| `/admin/settings/days-off` | Days off management |
| `/admin/settings/notifications` | Notification preferences |
| `/admin/settings/help` | Help page |

---

## API Routes

### Public

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/photo/{fileId}` | Photo proxy (no auth) |

### Client (auth via Telegram initData)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/specialist` | Specialist profile |
| `GET` | `/api/services` | Session types list |
| `GET` | `/api/working-hours` | Working hours |
| `GET` | `/api/availability` | Available time slots for a date |
| `GET` | `/api/days-off` | Days off |
| `GET` | `/api/durations` | Available booking durations |
| `GET` | `/api/bookings` | Client's bookings |
| `POST` | `/api/bookings` | Create booking |
| `DELETE` | `/api/bookings/{id}` | Cancel booking |
| `PUT` | `/api/bookings/{id}/confirm` | Confirm specialist-created booking |
| `PUT` | `/api/bookings/{id}/decline` | Decline specialist-created booking |
| `GET/PUT` | `/api/profile` | Client profile |
| `PUT` | `/api/profile/notifications` | Notification preferences |
| `POST` | `/api/upload/photo` | Upload photo |
| `GET/POST` | `/api/recurring` | Recurring schedules |
| `POST` | `/api/recurring/preview` | Preview recurring bookings |
| `GET/DELETE` | `/api/recurring/{id}` | Recurring schedule detail |
| `PUT` | `/api/recurring/{scheduleId}/bookings/{bookingId}/cancel-request` | Request cancel |
| `POST` | `/api/recurring/{scheduleId}/bookings/{bookingId}/move` | Request move |

### Admin (requires specialist auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET/PUT` | `/api/admin/settings` | Specialist settings |
| `GET/PUT` | `/api/admin/profile` | Specialist profile |
| `GET/PUT` | `/api/admin/notifications` | Notification preferences |
| `GET` | `/api/admin/durations` | Available durations |
| `GET/POST` | `/api/admin/services` | Services CRUD |
| `PUT/DELETE` | `/api/admin/services/{id}` | Service update/delete |
| `GET/PUT` | `/api/admin/working-hours` | Working hours |
| `PUT/DELETE` | `/api/admin/working-hours/{day}` | Per-day working hours |
| `GET/POST` | `/api/admin/bookings` | Bookings management |
| `PUT` | `/api/admin/bookings/{id}/status` | Update booking status |
| `PUT` | `/api/admin/bookings/{id}/reschedule` | Reschedule booking |
| `GET/POST` | `/api/admin/days-off` | Days off CRUD |
| `DELETE` | `/api/admin/days-off/{id}` | Delete day off |
| `GET/POST` | `/api/admin/clients` | Clients list / create ghost client |
| `PUT/DELETE` | `/api/admin/clients/{id}` | Update/delete client |
| `GET/POST` | `/api/admin/recurring` | Recurring schedules |
| `POST` | `/api/admin/recurring/preview` | Preview recurring bookings |
| `GET/DELETE` | `/api/admin/recurring/{id}` | Recurring schedule detail |
| `PUT` | `/api/admin/recurring/{id}/approve` | Approve recurring schedule |
| `PUT` | `/api/admin/recurring/{id}/decline` | Decline recurring schedule |
| `POST` | `/api/admin/upload/photo` | Upload photo |

---

## Master Bot Commands

| Command | Access | Description |
|---------|--------|-------------|
| `/start` | Anyone | Begin specialist onboarding (provide bot token, then name) |
| `/cancel` | Anyone | Cancel current onboarding session |
| `/help` | Anyone | Show help (admins see extended help) |
| `/specialists` | Admin | List all registered specialists |
| `/stats` | Admin | Show total specialist count |

On registration, each specialist is seeded with default session types (personal, pair, consultation) and working hours (Mon-Fri 09:00-18:00, Sat 10:00-15:00).

---

## VPS Setup

### Directory structure on VPS

```
/root/sport-app/
├── docker-compose.yml
├── .env                  # production env
├── .env.dev              # dev env
├── bot-data/
│   └── scheduler.db      # production database
└── bot-data-dev/
    └── scheduler.db      # dev database
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
      - .env
    environment:
      - DATABASE_PATH=/data/scheduler.db
    restart: unless-stopped

  bot-dev:
    image: rainingman/scheduler-bot:dev
    network_mode: host
    volumes:
      - ./bot-data-dev:/data
    env_file:
      - .env.dev
    environment:
      - DATABASE_PATH=/data/scheduler.db
      - PORT=8081
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    ports:
      - "127.0.0.1:5432:5432"
    environment:
      POSTGRES_USER: scheduler
      POSTGRES_PASSWORD: scheduler
      POSTGRES_DB: scheduler
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Key points:
- `network_mode: host` — container shares host network (avoids Docker DNS issues)
- `DATABASE_PATH=/data/scheduler.db` — always set in compose, never relies on `.env`
- Production and dev have completely separate databases and env files
- Production on port 8080, dev on port 8081
- `db` service is PostgreSQL for local dev/staging only

### .env (production)

```env
PUBLIC_BASE_URL=https://sport-app.rainingman.online
WEB_APP_URL=https://your-vercel-url.vercel.app
MASTER_BOT_TOKEN=your-master-bot-token
MASTER_WEBHOOK_SECRET=your-fixed-secret-hex-string
ADMIN_IDS=[your-telegram-id]
ENCRYPTION_KEY=your-64-char-hex-string
```

### .env.dev

```env
TELEGRAM_BOT_TOKEN=your-dev-bot-token
SPECIALIST_TELEGRAM_ID=your-telegram-id
SPECIALIST_NAME=Your Name
PUBLIC_BASE_URL=https://dev-sport-app.rainingman.online
WEB_APP_URL=https://your-vercel-preview-url
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

dev-sport-app.rainingman.online {
    reverse_proxy localhost:8081
}
```

Caddy handles SSL automatically.

---

## Database

### Dual database support

| | SQLite | PostgreSQL |
|---|---|---|
| **Default** | Yes | No (opt-in) |
| **Config** | `DATABASE_PATH` | `DATABASE_URL` |
| **Use case** | Production (single server) | Dev/staging |
| **Driver** | `modernc.org/sqlite` | `jackc/pgx/v5` |

Detection is automatic: if `DATABASE_URL` starts with `postgres`, PostgreSQL is used; otherwise SQLite.

### Schema

| Table | Description |
|-------|-------------|
| `specialists` | Registered specialists (name, bot token, webhook, profile, location, durations) |
| `clients` | Clients per specialist (name, display_name, preferences, ghost flag) |
| `session_types` | Service types with price, duration, image |
| `working_hours` | Per-day working hours |
| `bookings` | All bookings (pending/confirmed/rejected/cancelled/completed) |
| `days_off` | Days off per specialist |
| `recurring_schedules` | Weekly recurring booking schedules with per-day times |
| `waitlist` | Schema kept for compat, feature removed |

Migrations run automatically on startup via idempotent `ALTER TABLE` statements.

### Viewing with Drizzle Studio

**Option 1: Locally with SSH tunnel**
```bash
scp root@your-vps:/root/sport-app/bot-data/scheduler.db ./bot-data/scheduler.db
cd db-viewer
bunx drizzle-kit studio
```

**Option 2: On VPS with port forward**
```bash
ssh -L 4983:localhost:4983 root@your-vps
cd /root/sport-app/db-viewer
DB_PATH=/root/sport-app/bot-data/scheduler.db bunx drizzle-kit studio
```

### Direct SQLite queries

```bash
# On VPS, via Docker
docker compose exec bot sh -c "sqlite3 /data/scheduler.db \"SELECT name, telegram_handle FROM specialists;\""

# Or directly
sqlite3 /root/sport-app/bot-data/scheduler.db "SELECT * FROM specialists;"
```

### Backups

```bash
# Manual backup from VPS
scp root@your-vps:/root/sport-app/bot-data/scheduler.db ./backups/scheduler-$(date +%Y%m%d).db

# On VPS: local backup
cp /root/sport-app/bot-data/scheduler.db /root/sport-app/bot-data/scheduler-backup-$(date +%Y%m%d).db
```

Automatic daily backups with cron:
```bash
crontab -e
# Add:
0 3 * * * cp /root/sport-app/bot-data/scheduler.db /root/sport-app/bot-data/backups/scheduler-$(date +\%Y\%m\%d).db
```

### Token encryption at rest

Bot tokens in the `specialists` table are encrypted with AES-256-GCM when `ENCRYPTION_KEY` is set. Lookups use a SHA-256 hash (`bot_token_hash` column).

- **Without `ENCRYPTION_KEY`**: tokens stored in plain text (warning logged)
- **With `ENCRYPTION_KEY`**: existing plain-text tokens are automatically encrypted on startup
- **Key removal after encryption**: the app will fail to decrypt tokens (set the key back or re-register)

Encrypted values in the DB are prefixed with `enc:` so the migration is idempotent.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_BASE_URL` | Yes | VPS public URL (e.g., `https://sport-app.rainingman.online`) |
| `WEB_APP_URL` | Yes | Vercel mini-app URL |
| `MASTER_BOT_TOKEN` | Yes | Master bot token from BotFather |
| `MASTER_WEBHOOK_SECRET` | Recommended | Fixed hex secret for master bot webhook (generate with `openssl rand -hex 32`) |
| `ADMIN_IDS` | No | Telegram user IDs with admin access (e.g., `[123456789]`) |
| `ENCRYPTION_KEY` | No | Hex-encoded 32-byte AES key for encrypting bot tokens |
| `DATABASE_PATH` | Set in compose | SQLite file path (default: `./data/scheduler.db`) |
| `DATABASE_URL` | No | PostgreSQL connection string; if set, overrides `DATABASE_PATH` |
| `PORT` | No | HTTP port (default: `8080`) |
| `TELEGRAM_BOT_TOKEN` | Legacy | Single-bot token (dev without master bot) |
| `SPECIALIST_TELEGRAM_ID` | Legacy | Specialist Telegram ID (single-bot setup) |
| `SPECIALIST_NAME` | Legacy | Specialist display name (single-bot setup, default: `Specialist`) |

---

## Development

### Local development

#### Mini-app
```bash
cd mini-app
bun install
bun dev           # http://localhost:3000
bun build         # production build
bun lint          # ESLint
```

#### Bot
```bash
cd bot
go run .          # requires env vars (see bot/.env.example)
go build ./...    # verify compilation
go test ./...     # run tests
```

### Pre-commit hooks

Husky + lint-staged run automatically on `git commit`:
- **Go files**: `gofmt -w` + `go test ./...`
- **TypeScript/TSX**: `prettier --write` + `eslint --fix` + `vitest related --run`
- **CSS**: `prettier --write`

### Testing

**Backend** (Go):
```bash
cd bot && go test ./...
```

**Frontend** (Vitest + happy-dom):
```bash
cd mini-app && bunx vitest run       # all tests
cd mini-app && bunx vitest           # watch mode
```

Test files: `mini-app/src/**/*.test.{ts,tsx}` (currently covers API client, BookingCard, StatusBadge).

### Webhook testing locally

```bash
# Start a tunnel
ngrok http 8080

# Use the HTTPS URL
PUBLIC_BASE_URL=https://xxxx.ngrok.io go run .
```

Verify webhook configuration:
```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | jq
```

### Versioning

Update `bot/version.go` before each production release:
- Bump `Version` (semver, current: `1.3.0`)
- Changelog content managed via i18n locale files

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
