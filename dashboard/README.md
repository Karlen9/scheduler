# Scheduler Owner Dashboard

Next.js owner console for platform analytics and specialist administration.

## Features

- Platform analytics: bookings, clients, recurring schedules, referrals, revenue, retention, capacity, funnel, cancellations, and notification health.
- Operations: global search, live activity, audit log, calendar, booking CSV export, conflict detector, system health, and admin allowlist.
- Specialist administration: profile, services, bookings, clients, recurring schedules, schedule, notifications, referrals, and enable/disable state. Whole-bot deletion is intentionally excluded.

## Environment

Copy `.env.example` to `.env.local` and fill:

| Variable                            | Description                                                      |
| ----------------------------------- | ---------------------------------------------------------------- |
| `BACKEND_BASE_URL`                  | Go backend base URL                                              |
| `BACKEND_SUPERADMIN_SECRET`         | Same value as backend `SUPERADMIN_SECRET`                        |
| `DASHBOARD_SESSION_SECRET`          | Random secret for signed dashboard cookies                       |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Master bot username linked to this dashboard domain in BotFather |

Telegram Login Widget requires linking the dashboard domain to the master bot with BotFather `/setdomain`.
Use the bot username only, for example `scheduler_admin_bot`. Do not use the bot token, a Telegram account username, an `@` prefix, or a `t.me` link.
The widget must be opened from the same public HTTPS domain that is linked in BotFather. It will not work from `http://localhost`, so use a deployed domain or an HTTPS tunnel for local testing.

## Usage

```bash
bun install
bun run dev
```

## Scripts

| Command                | Description                |
| ---------------------- | -------------------------- |
| `bun run dev`          | Start dev server (webpack) |
| `bun run build`        | Production build (webpack) |
| `bun run start`        | Start production server    |
| `bun run lint`         | Run ESLint                 |
| `bun run lint:fix`     | ESLint with auto-fix       |
| `bun run format:check` | Check Prettier formatting  |
| `bun run typecheck`    | TypeScript type checking   |
