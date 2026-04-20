# Scheduler Bot (Telegram)

## Environment variables

### Required

- `PUBLIC_BASE_URL` - public HTTPS base URL reachable by Telegram (e.g. `https://api.example.com`)
- `WEB_APP_URL` - URL of the deployed mini-app
- `MASTER_BOT_TOKEN` - Telegram bot token for the master onboarding bot
- `MASTER_WEBHOOK_SECRET` - fixed webhook secret for the master bot

### Optional

- `PORT` - HTTP server port (default `8080`)
- `DATABASE_PATH` - SQLite file path (default `./data/scheduler.db`)
- `DATABASE_URL` - PostgreSQL connection string; if set, overrides `DATABASE_PATH`
- `ENCRYPTION_KEY` - hex-encoded 32-byte AES key for encrypting bot tokens at rest
- `ADMIN_IDS` - comma-separated Telegram user IDs that unlock the master bot's admin analytics panel and can reply inside support topics
- `SUPPORT_GROUP_ID` - numeric chat ID of a supergroup (with forum topics enabled) where the master bot relays operator conversations. Leave unset to disable the operator relay. See "Operator support relay" below.
- `DB_PASSWORD` - Postgres password used in docker-compose (default `scheduler`)

### Legacy (single-bot setup)

- `TELEGRAM_BOT_TOKEN`
- `SPECIALIST_TELEGRAM_ID`
- `SPECIALIST_NAME` (default `Specialist`)

## Database

The bot supports two database backends:

|              | SQLite                     | PostgreSQL                  |
| ------------ | -------------------------- | --------------------------- |
| **Default**  | Yes                        | No (opt-in)                 |
| **Config**   | `DATABASE_PATH`            | `DATABASE_URL`              |
| **Use case** | Production (single server) | Dev/staging, future scaling |
| **Driver**   | `modernc.org/sqlite`       | `jackc/pgx/v5`              |

Detection is automatic: if `DATABASE_URL` starts with `postgres`, PostgreSQL is used; otherwise SQLite.

### SQLite mode (default)

```bash
DATABASE_PATH=./data/scheduler.db go run .
```

### PostgreSQL mode

```bash
# Start Postgres
docker compose up db -d

# Run bot with Postgres
DATABASE_URL=postgres://scheduler:scheduler@localhost:5432/scheduler?sslmode=disable go run .
```

## Migrating from SQLite to PostgreSQL

### Option 1: pgloader (recommended)

```bash
brew install pgloader

# Start fresh Postgres
docker compose up db -d

# Start the bot once to create tables, then stop it
DATABASE_URL=postgres://scheduler:scheduler@localhost:5432/scheduler?sslmode=disable go run .
# Ctrl+C after "Database initialized (PostgreSQL)"

# Truncate all tables (pgloader will repopulate)
psql postgres://scheduler:scheduler@localhost:5432/scheduler -c "
  TRUNCATE recurring_schedules, waitlist, days_off, bookings, working_hours, session_types, clients, specialists CASCADE;
"

# Load data from SQLite
pgloader ./data/scheduler.db \
  postgres://scheduler:scheduler@localhost:5432/scheduler
```

### Option 2: Manual INSERT dump

```bash
# Start Postgres and create tables (same as above)
docker compose up db -d
DATABASE_URL=postgres://scheduler:scheduler@localhost:5432/scheduler?sslmode=disable go run .
# Ctrl+C

# Dump INSERT statements from SQLite and load into Postgres
sqlite3 ./data/scheduler.db .dump | \
  grep '^INSERT' | \
  sed 's/INSERT INTO recurring_schedules(\([^)]*\)time,/INSERT INTO recurring_schedules(\1"time",/g' | \
  psql postgres://scheduler:scheduler@localhost:5432/scheduler
```

### Option 3: Remote server migration

If the SQLite file is on a remote server:

```bash
# Copy SQLite file from server
scp user@server:/path/to/bot-data/scheduler.db ./scheduler-remote.db

# Then use Option 1 or 2 with the local copy
pgloader ./scheduler-remote.db \
  postgres://scheduler:scheduler@localhost:5432/scheduler
```

### Verify migration

```bash
# Check tables exist
docker exec $(docker compose ps -q db) psql -U scheduler -c '\dt'

# Check row counts
docker exec $(docker compose ps -q db) psql -U scheduler -c "
  SELECT 'specialists' as t, count(*) FROM specialists
  UNION ALL SELECT 'clients', count(*) FROM clients
  UNION ALL SELECT 'bookings', count(*) FROM bookings
  UNION ALL SELECT 'session_types', count(*) FROM session_types;
"
```

## Docker

### Production (SQLite)

```bash
docker compose up bot -d
```

### Development (PostgreSQL)

```bash
# Start Postgres + dev bot
docker compose up db bot-dev -d

# View logs
docker compose logs -f bot-dev
```

### Build and push

```bash
cd bot
docker build --platform linux/amd64 -t rainingman/scheduler-bot:dev .
docker push rainingman/scheduler-bot:dev
```

## Local webhook testing

You need a public HTTPS URL that forwards to your local bot port:

1. Start a tunnel:
   ```bash
   ngrok http 8080
   ```
2. Use the HTTPS URL as `PUBLIC_BASE_URL`:
   ```bash
   PUBLIC_BASE_URL=https://xxxx.ngrok.io go run .
   ```

## Verify webhook configuration

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | jq
```

## Operator support relay

The master bot doubles as a help-desk: specialists tap "💬 Talk to operator" in the `/start` menu and the bot relays their DMs into forum topics inside a supergroup you (the owner) control.

### One-time setup

1. Create a Telegram supergroup. In Settings → "Topics" → enable topics.
2. Add the master bot to the group and promote it to admin with at least `Manage Topics` and `Send Messages` rights.
3. Post anything in the group, forward it to [@userinfobot](https://t.me/userinfobot) and copy the chat ID it returns (a negative number, e.g. `-1001234567890`).
4. Set `SUPPORT_GROUP_ID` to that chat ID and restart the bot.
5. Add your personal Telegram ID to `ADMIN_IDS` so replies you type inside topics are relayed to users (only admins can use the analytics panel; all participants of the group can chat in topics, but the bot only relays messages from non-bots).

### How it works

- First time a user taps "Talk to operator", the bot creates a new topic named `First Last · @handle · id:123` and posts a breadcrumb inside it.
- Every subsequent DM from that user is copied into the matching topic (`copyMessage` — no "forwarded from" header, keeps media and captions).
- Any message typed inside the topic by operators is copied back to the user's DM.
- Commands typed in the topic are **not** relayed, so `/ban` etc. stay internal.
- `/close` inside a topic closes the thread. The user is notified, the topic is closed (history preserved), and the next DM from that user creates a fresh topic.
- Messages outside mapped topics (or without `message_thread_id`) are ignored.
- A conservative substring spam filter drops obvious junk (shortlinks, crypto-shill keywords) before relay. Messages over 4000 characters are bounced back to the user with a "trim and retry" notice.

### Owner analytics panel

Users listed in `ADMIN_IDS` see an extra `📊 Admin panel` button in the master bot `/start` menu (also reachable via `/admin`). Sections: Platform, Bookings, Clients, Recurring, Referrals, Top specialists, Durations, Specialist list. All queries are platform-wide and live in `bot/internal/db/owner_stats.go`.

## Architecture

```
bot/
  main.go                  # HTTP server, bot manager, background workers
  internal/
    config/config.go       # Environment configuration
    db/
      db.go                # Dual Init (SQLite/Postgres), migrations
      compat.go            # Q(), BoolVal(), DateNow() driver helpers
      specialists.go       # Specialist CRUD
      clients.go           # Client CRUD
      bookings.go          # Booking CRUD
      session_types.go     # Session type CRUD
      working_hours.go     # Working hours CRUD
      days_off.go          # Days off CRUD
      waitlist.go          # Waitlist CRUD
      recurring.go         # Recurring schedule CRUD
      owner_stats.go       # Platform-wide stats for the master bot's owner panel
      support.go           # support_threads CRUD (operator relay mapping)
    api/                   # REST API handlers + middleware
    telegram/              # Bot logic, webhook handling, notifications
      master.go            # Master bot entrypoint + onboarding state machine
      master_menu.go       # /start main menu + FAQ screens
      master_support.go    # Operator support relay (DM ↔ forum topic)
      master_admin.go      # Owner analytics panel
    crypto/                # Token encryption/hashing
    models/                # Shared data structures
```
