# Scheduler - Telegram Mini App for Specialists

A multi-tenant scheduling platform where professionals (fitness trainers, teachers, beauty specialists, etc.) register their own Telegram bots via a master bot, and clients book sessions through a Telegram Mini App.

## Architecture

```
scheduler/
├── bot/              # Go backend (Telegram webhooks + REST API)
├── mini-app/         # Next.js 15 frontend (Telegram Mini App)
├── backup-monitor/   # DB backup + /health watchdog with Telegram alerts
├── load-tests/       # k6 scripts + Prometheus/Grafana config
├── deploy/           # build/push scripts and VPS redeploy helpers
├── docs/             # implementation plans and workflow docs
├── docker-compose.yml
└── docker-compose.loadtest.yml
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
- **Flexible schedule grid**: multiple working intervals per weekday, days off, and availability preview
- **Ghost clients**: specialists can create bookings for clients without Telegram accounts
- **Display names**: specialists can set custom display names for clients
- **Block clients**: specialists can block abusive clients, optionally auto-cancelling their active bookings and recurring schedules
- **Client detail modal**: admin views client contact info and booking history inline from the clients list
- **Profile customization**: specialists pick a wallpaper shown in the client home header; Telegram photo auto-fallback when no custom photo is set
- **Analytics**: client and admin stats endpoints with mini-app dashboard cards
- **Frontend cache sync**: lightweight change versions for refreshing mutated resources
- **i18n**: Russian and English, both backend (go-i18n) and frontend (next-intl)
- **Light/dark theme**: auto-detected from Telegram's color scheme
- **Token encryption**: bot tokens encrypted at rest with AES-256-GCM
- **Observability and load testing**: Prometheus HTTP metrics, Grafana dashboards, k6 smoke/load/stress scripts

### Infrastructure

| Component          | Where        | URL                                            |
| ------------------ | ------------ | ---------------------------------------------- |
| Bot (Go)           | VPS (Docker) | `sport-app.rainingman.online`                  |
| Mini-app (Next.js) | Vercel       | deployed via `bunx vercel`                     |
| SSL                | Caddy (VPS)  | auto-TLS, proxies to `:8080`                   |
| DB                 | SQLite       | `/root/sport-app/bot-data/scheduler.db` on VPS |
| Images             | Docker Hub   | `rainingman/scheduler-bot`                     |

### Tech stack

| Component  | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| Backend    | Go 1.24, chi router                                               |
| Database   | SQLite (default) / PostgreSQL (opt-in)                            |
| Frontend   | Next.js 15, React 19, Tailwind CSS 4, SWR                         |
| i18n       | go-i18n (backend), next-intl (frontend)                           |
| Testing    | `go test` (backend), Vitest + happy-dom (frontend), k6 load tests |
| Linting    | gofmt, ESLint 8, Prettier                                         |
| Pre-commit | Lefthook with Prettier + ESLint                                   |

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
# 1. Build, test, and push (locally)
./deploy/build-and-push.sh

# 2. On VPS: pull and restart
ssh root@your-vps
cd /root/sport-app
docker compose pull bot
docker compose down && docker compose up -d

# 3. Verify
docker compose logs --tail 20 bot
```

`build-and-push.sh` runs `go build ./...`, `go test ./...`, then builds and pushes
`rainingman/scheduler-bot:latest`. Override the tag with `IMAGE=...` if needed.

### Updating the backup-monitor

```bash
# 1. Build and push (locally)
./deploy/build-and-push-monitor.sh

# 2. On VPS: pull and restart
ssh root@your-vps
cd /root/sport-app/backup-monitor   # or wherever it lives on your VPS
docker compose pull monitor
docker compose up -d monitor
```

If the VPS still has the old `build: .` line in `backup-monitor/docker-compose.yml`,
swap it for `image: rainingman/scheduler-monitor:latest` so it pulls instead of
building locally.

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

| Route             | Description                                                                 |
| ----------------- | --------------------------------------------------------------------------- |
| `/`               | Home screen — specialist profile, bio, contact, services list, location map |
| `/services`       | Full services listing with prices and durations                             |
| `/book`           | Booking flow — calendar, time slots, duration picker                        |
| `/bookings`       | Client's bookings list with cancel/confirm/decline actions                  |
| `/recurring`      | Client's recurring schedules list                                           |
| `/recurring/[id]` | Recurring schedule detail with per-booking management                       |
| `/profile`        | Client profile and notification preferences                                 |

### Admin pages

| Route                           | Description                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `/admin`                        | Dashboard — today's timeline, pending bookings, quick actions                                 |
| `/admin/analytics`              | Admin analytics and operational stats                                                         |
| `/admin/bookings`               | All bookings with status filters                                                              |
| `/admin/book`                   | Create booking for a client (or ghost client)                                                 |
| `/admin/clients`                | Client list with display name editing, ghost client creation, block/unblock, and detail modal |
| `/admin/recurring`              | Recurring schedules management with approve/decline                                           |
| `/admin/recurring/[id]`         | Recurring schedule detail with per-booking move/cancel                                        |
| `/admin/settings`               | Settings hub                                                                                  |
| `/admin/settings/profile`       | Specialist profile (name, bio, photo, location, phone)                                        |
| `/admin/settings/schedule`      | Working hours per day of week                                                                 |
| `/admin/settings/services`      | Session types with price, duration, image                                                     |
| `/admin/settings/days-off`      | Days off management                                                                           |
| `/admin/settings/notifications` | Notification preferences                                                                      |
| `/admin/settings/help`          | Help page                                                                                     |

### Test routes

The mini-app has browser-only test routes backed by `mini-app/src/lib/mock-api.ts`. These routes are useful for UI checks outside Telegram because API calls are resolved by the mock API instead of the Go backend.

| Route              | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `/test/client`     | Mocked client home page                              |
| `/test/client/...` | Mocked client pages, preserving the normal path      |
| `/test/admin`      | Mocked admin dashboard                               |
| `/test/admin/...`  | Mocked admin pages, preserving the normal admin path |

Examples:

```text
/test/client/book
/test/client/bookings
/test/client/recurring
/test/client/profile
/test/admin/book
/test/admin/bookings
/test/admin/analytics
/test/admin/settings/schedule
```

---

## API Routes

### Public and operational

| Method | Path                      | Description                                 |
| ------ | ------------------------- | ------------------------------------------- |
| `GET`  | `/health`                 | Health check                                |
| `GET`  | `/metrics`                | Prometheus metrics; internal or superadmin  |
| `GET`  | `/api/photo/{fileId}`     | Telegram photo proxy; no app auth           |
| `GET`  | `/superadmin/specialists` | List all specialists; bearer token required |

### Client (Telegram initData auth)

| Method       | Path                                                              | Description                        |
| ------------ | ----------------------------------------------------------------- | ---------------------------------- |
| `GET`        | `/api/specialist`                                                 | Specialist profile                 |
| `GET`        | `/api/services`                                                   | Services/session types list        |
| `GET`        | `/api/working-hours`                                              | Working hours                      |
| `GET`        | `/api/schedule-context`                                           | Working hours, services, days off  |
| `GET`        | `/api/availability`                                               | Available time slots for a date    |
| `GET`        | `/api/days-off`                                                   | Public days off                    |
| `GET`        | `/api/durations`                                                  | Available booking durations        |
| `GET`        | `/api/bookings`                                                   | Client's bookings                  |
| `POST`       | `/api/bookings`                                                   | Create booking                     |
| `DELETE`     | `/api/bookings/{id}`                                              | Cancel booking                     |
| `PUT`        | `/api/bookings/{id}/reschedule`                                   | Reschedule client booking          |
| `PUT`        | `/api/bookings/{id}/confirm`                                      | Confirm specialist-created booking |
| `PUT`        | `/api/bookings/{id}/decline`                                      | Decline specialist-created booking |
| `GET`        | `/api/stats`                                                      | Client analytics                   |
| `GET`        | `/api/changes`                                                    | Resource version counters          |
| `GET/PUT`    | `/api/profile`                                                    | Client profile                     |
| `PUT`        | `/api/profile/notifications`                                      | Notification preferences           |
| `POST`       | `/api/upload/photo`                                               | Upload client photo                |
| `GET/POST`   | `/api/recurring`                                                  | Recurring schedules                |
| `POST`       | `/api/recurring/preview`                                          | Preview recurring bookings         |
| `GET/DELETE` | `/api/recurring/{id}`                                             | Recurring schedule detail/cancel   |
| `PUT`        | `/api/recurring/{scheduleId}/bookings/{bookingId}/cancel-request` | Request recurring booking cancel   |
| `POST`       | `/api/recurring/{scheduleId}/bookings/{bookingId}/move`           | Request recurring booking move     |

### Admin (specialist auth)

| Method       | Path                                                                    | Description                                    |
| ------------ | ----------------------------------------------------------------------- | ---------------------------------------------- |
| `GET/PUT`    | `/api/admin/profile`                                                    | Specialist profile                             |
| `GET/PUT`    | `/api/admin/notifications`                                              | Notification preferences                       |
| `GET`        | `/api/admin/durations`                                                  | Available durations                            |
| `GET/POST`   | `/api/admin/services`                                                   | Services list/create                           |
| `PUT/DELETE` | `/api/admin/services/{id}`                                              | Service update/delete                          |
| `GET/PUT`    | `/api/admin/working-hours`                                              | Working hours                                  |
| `GET`        | `/api/admin/schedule-context`                                           | Working hours, services, days off              |
| `GET/POST`   | `/api/admin/bookings`                                                   | Bookings list/create                           |
| `GET`        | `/api/admin/stats`                                                      | Admin analytics                                |
| `PUT`        | `/api/admin/bookings/{id}/status`                                       | Update booking status                          |
| `PUT`        | `/api/admin/bookings/{id}/reschedule`                                   | Reschedule booking                             |
| `GET`        | `/api/admin/days-off`                                                   | Days off list                                  |
| `POST`       | `/api/admin/days-off/batch`                                             | Batch create days off                          |
| `DELETE`     | `/api/admin/days-off/{id}`                                              | Delete day off                                 |
| `GET/POST`   | `/api/admin/clients`                                                    | Clients list / create ghost client             |
| `PUT/DELETE` | `/api/admin/clients/{id}`                                               | Update/delete client                           |
| `PUT`        | `/api/admin/clients/{id}/block`                                         | Block/unblock client (optional cascade cancel) |
| `GET/POST`   | `/api/admin/recurring`                                                  | Recurring schedules list/create                |
| `POST`       | `/api/admin/recurring/preview`                                          | Preview recurring bookings                     |
| `GET/DELETE` | `/api/admin/recurring/{id}`                                             | Recurring schedule detail/cancel               |
| `PUT`        | `/api/admin/recurring/{id}/approve`                                     | Approve recurring schedule                     |
| `PUT`        | `/api/admin/recurring/{id}/decline`                                     | Decline recurring schedule                     |
| `PUT`        | `/api/admin/recurring/{scheduleId}/bookings/{bookingId}/cancel-request` | Request recurring booking cancel               |
| `POST`       | `/api/admin/recurring/{scheduleId}/bookings/{bookingId}/move`           | Request recurring booking move                 |
| `PUT`        | `/api/admin/recurring/{scheduleId}/bookings/{bookingId}/approve-move`   | Approve recurring booking move                 |
| `PUT`        | `/api/admin/recurring/{scheduleId}/bookings/{bookingId}/decline-move`   | Decline recurring booking move                 |
| `POST`       | `/api/admin/upload/photo`                                               | Upload specialist photo                        |

---

## Master Bot Commands

| Command        | Access | Description                                                |
| -------------- | ------ | ---------------------------------------------------------- |
| `/start`       | Anyone | Begin specialist onboarding (provide bot token, then name) |
| `/cancel`      | Anyone | Cancel current onboarding session                          |
| `/help`        | Anyone | Show help (admins see extended help)                       |
| `/specialists` | Admin  | List all registered specialists                            |
| `/stats`       | Admin  | Show total specialist count                                |

On registration, each specialist is seeded with default session types (personal, pair, consultation) and working hours (Mon-Fri 09:00-18:00, Sat 10:00-15:00).

---

## VPS Setup

### Directory structure on VPS

```
/root/sport-app/
├── docker-compose.yml
├── bot/
│   ├── .env              # production env
│   └── .env.dev          # dev env
├── bot-data/
│   └── scheduler.db      # production database
└── pgdata/               # PostgreSQL volume managed by Docker
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

  bot-dev:
    image: rainingman/scheduler-bot:dev
    network_mode: host
    env_file:
      - bot/.env.dev
    environment:
      - DATABASE_URL=postgres://scheduler:${DB_PASSWORD:-scheduler}@localhost:5432/scheduler?sslmode=disable
      - PORT=8081
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: scheduler
      POSTGRES_USER: scheduler
      POSTGRES_PASSWORD: ${DB_PASSWORD:-scheduler}
    ports:
      - "127.0.0.1:5432:5432"

volumes:
  pgdata:
```

Key points:

- `network_mode: host` — container shares host network (avoids Docker DNS issues)
- `DATABASE_PATH=/data/scheduler.db` — always set in compose, never relies on `.env`
- Production and dev have separate env files and databases
- Production uses SQLite on port 8080, dev uses PostgreSQL on port 8081
- `db` service is PostgreSQL for dev/staging and local migration checks
- `DB_PASSWORD` is read by Docker Compose from the shell or project-root `.env`; it defaults to `scheduler`

### .env (production)

```env
PUBLIC_BASE_URL=https://sport-app.rainingman.online
WEB_APP_URL=https://your-vercel-url.vercel.app
MASTER_BOT_TOKEN=your-master-bot-token
MASTER_WEBHOOK_SECRET=your-fixed-secret-hex-string
ADMIN_IDS=[your-telegram-id]
ENCRYPTION_KEY=your-64-char-hex-string
SUPERADMIN_SECRET=your-superadmin-bearer-secret
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

|              | SQLite                     | PostgreSQL     |
| ------------ | -------------------------- | -------------- |
| **Default**  | Yes                        | No (opt-in)    |
| **Config**   | `DATABASE_PATH`            | `DATABASE_URL` |
| **Use case** | Production (single server) | Dev/staging    |
| **Driver**   | `modernc.org/sqlite`       | `jackc/pgx/v5` |

Detection is automatic: if `DATABASE_URL` starts with `postgres`, PostgreSQL is used; otherwise SQLite.

### Schema

| Table                 | Description                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `specialists`         | Registered specialists (name, bot token, webhook, profile, location, durations, wallpaper) |
| `clients`             | Clients per specialist (name, display_name, preferences, ghost/blocked flags)              |
| `session_types`       | Service types with price, duration, image                                                  |
| `working_hours`       | Per-day working-hour intervals                                                             |
| `bookings`            | All bookings (pending/confirmed/rejected/cancelled/completed)                              |
| `days_off`            | Days off per specialist                                                                    |
| `recurring_schedules` | Weekly recurring booking schedules with per-day times                                      |

Migrations run automatically on startup via idempotent `ALTER TABLE` statements.

### Direct database queries

```bash
# On VPS, via Docker
docker compose exec bot sh -c "sqlite3 /data/scheduler.db \"SELECT name, telegram_handle FROM specialists;\""

# Or directly
sqlite3 /root/sport-app/bot-data/scheduler.db "SELECT * FROM specialists;"

# Dev PostgreSQL
psql "postgres://scheduler:${DB_PASSWORD:-scheduler}@localhost:5432/scheduler?sslmode=disable"
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

### Backup-monitor service

`backup-monitor/` is a small Alpine container that runs two cron jobs and posts to
Telegram on failure:

| Job      | Schedule | What it does                                                                       |
| -------- | -------- | ---------------------------------------------------------------------------------- |
| `backup` | hourly   | Pulls a DB snapshot to `/backups`, applies retention                               |
| `health` | hourly   | `GET ${HEALTH_URL}`; on failure, retries once after 5s and alerts with exact error |

Health alert format includes the curl exit code + stderr (for connection errors) or
the HTTP status + first 1500 bytes of the body (for non-2xx responses), sent without
Markdown so raw error text comes through clean.

Required env (in `backup-monitor/.env`):

```env
HEALTH_URL=https://sport-app.rainingman.online/health
TELEGRAM_ALERT_BOT_TOKEN=...
TELEGRAM_ALERT_CHAT_ID=...
# plus SSH_/DB_/RETENTION_/BACKUP_ vars used by backup.sh
```

Manual health check (without waiting for cron):

```bash
docker compose exec monitor /usr/local/bin/health.sh
```

### Token encryption at rest

Bot tokens in the `specialists` table are encrypted with AES-256-GCM when `ENCRYPTION_KEY` is set. Lookups use a SHA-256 hash (`bot_token_hash` column).

- **Without `ENCRYPTION_KEY`**: tokens stored in plain text (warning logged)
- **With `ENCRYPTION_KEY`**: existing plain-text tokens are automatically encrypted on startup
- **Key removal after encryption**: the app will fail to decrypt tokens (set the key back or re-register)

Encrypted values in the DB are prefixed with `enc:` so the migration is idempotent.

---

## Environment Variables Reference

| Variable                 | Required       | Description                                                                    |
| ------------------------ | -------------- | ------------------------------------------------------------------------------ |
| `PUBLIC_BASE_URL`        | Yes            | VPS public URL (e.g., `https://sport-app.rainingman.online`)                   |
| `WEB_APP_URL`            | Yes            | Vercel mini-app URL                                                            |
| `MASTER_BOT_TOKEN`       | Yes            | Master bot token from BotFather                                                |
| `MASTER_WEBHOOK_SECRET`  | Recommended    | Fixed hex secret for master bot webhook (generate with `openssl rand -hex 32`) |
| `ADMIN_IDS`              | No             | Telegram user IDs with admin access (e.g., `[123456789]`)                      |
| `ENCRYPTION_KEY`         | No             | Hex-encoded 32-byte AES key for encrypting bot tokens                          |
| `SUPERADMIN_SECRET`      | No             | Bearer token for `/superadmin/*` endpoints and remote `/metrics` access        |
| `DATABASE_PATH`          | Set in compose | SQLite file path (default: `./data/scheduler.db`)                              |
| `DATABASE_URL`           | No             | PostgreSQL connection string; if set, overrides `DATABASE_PATH`                |
| `PORT`                   | No             | HTTP port (default: `8080`)                                                    |
| `LOAD_TEST_MODE`         | Test only      | Enables `X-Test-User-ID` auth bypass and seeded load-test specialist           |
| `DB_PASSWORD`            | Dev compose    | PostgreSQL password used by `docker-compose.yml`                               |
| `TELEGRAM_BOT_TOKEN`     | Legacy         | Single-bot token (dev without master bot)                                      |
| `SPECIALIST_TELEGRAM_ID` | Legacy         | Specialist Telegram ID (single-bot setup)                                      |
| `SPECIALIST_NAME`        | Legacy         | Specialist display name (single-bot setup, default: `Specialist`)              |

### Mini-app environment

| Variable  | Required | Description                                                               |
| --------- | -------- | ------------------------------------------------------------------------- |
| `API_URL` | No       | Backend URL for Next.js API rewrites; defaults to `http://localhost:8080` |

---

## Development

### Local development

#### Mini-app

```bash
cd mini-app
bun install
bun run dev       # http://localhost:3000
bun run build     # production build
bun run lint      # ESLint
bun run test      # Vitest
```

When the dev server is running, use `/test/client` and `/test/admin` for mocked UI testing without Telegram initData or backend access.

#### Bot

```bash
cd bot
go run .          # requires env vars (see bot/.env.example)
go build ./...    # verify compilation
go test ./...     # run tests
```

### Pre-commit hooks

Lefthook runs automatically on `git commit`:

- **JS/TS/TSX/CSS/MD/JSON**: `prettier --write`
- **JS/TS/TSX**: `eslint --fix` followed by `eslint`

### Testing

**Backend** (Go):

```bash
cd bot && go test ./...
```

Backend tests cover route/auth behavior, security headers, rate limiting, stats endpoints, config parsing, token crypto, database compatibility, booking completion, and i18n.

**Frontend** (Vitest + happy-dom):

```bash
cd mini-app && bun run test          # all tests
cd mini-app && bun run test:watch    # watch mode
```

Frontend tests cover the API client, mock API, time-slot helpers, BookingCard, and StatusBadge.

**Load tests** (k6 + Prometheus + Grafana):

```bash
# Start load-test stack: Postgres, bot in LOAD_TEST_MODE, Prometheus, Grafana
docker compose -f docker-compose.loadtest.yml up db bot prometheus grafana -d

# Smoke test
docker compose -f docker-compose.loadtest.yml run --rm k6 /scripts/smoke.js

# Sustained load test
docker compose -f docker-compose.loadtest.yml run --rm k6 /scripts/load.js

# Stress test up to 1000 VUs
docker compose -f docker-compose.loadtest.yml run --rm k6 /scripts/stress.js
```

Load-test auth uses `LOAD_TEST_MODE=true` plus `X-Test-User-ID`; do not enable it in production.

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

### Database appears empty

- Make sure you're pointing to the correct file (`/root/sport-app/bot-data/scheduler.db`)
- If the DB was recreated, re-register via the master bot (`/start`)
