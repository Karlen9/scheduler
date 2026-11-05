# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant Telegram Mini App scheduler for specialists (trainers, teachers, beauty professionals, etc.). Three main components:

- **bot/** - Go backend (chi router, SQLite/PostgreSQL, Telegram webhooks + REST API)
- **mini-app/** - Next.js 15 frontend (Telegram Mini App) for booking UI
- **landing/** - Next.js 16 marketing site for specialists (ru at `/`, en at `/en`), static, Vercel Root Directory = `landing`; prices/trial/theme tokens are drift-tested against `bot/internal/config/config.go` and `mini-app/src/styles/theme.css`

Language: Russian UI throughout, English supported via i18n (go-i18n backend, next-intl frontend).

## Commands

### Mini App (Next.js)

```bash
cd mini-app
bun install       # Install dependencies
bun dev           # Dev server on http://localhost:3000
bun build         # Production build
bun lint          # ESLint
bunx vitest run   # Run tests
```

### Landing (Next.js)

```bash
cd landing
bun install
bun dev           # http://localhost:3000
bun run build     # must report the locale pages as static
bun run lint && bunx tsc --noEmit && bunx vitest run
```

Copy lives in `landing/messages/*.json`; product name, bot link and legal entity in `landing/src/lib/site.ts`; see `landing/README.md` for screenshots and email setup.

### Bot (Go)

```bash
cd bot
go run .          # Run server (webhook + API)
go build ./...    # Verify compilation
go test ./...     # Run tests
```

Required env vars (master bot): `MASTER_BOT_TOKEN`, `WEB_APP_URL`, `PUBLIC_BASE_URL`
Optional: `ADMIN_IDS`, `MASTER_WEBHOOK_SECRET`, `ENCRYPTION_KEY`, `ROTATE_ENCRYPTION_KEY_FROM` (one-shot key rotation: set to the old key while `ENCRYPTION_KEY` is the new key, remove after the run), `SUPPORT_GROUP_ID` (forum-topic supergroup chat id; enables the master bot's operator relay)
Legacy (single-bot): `TELEGRAM_BOT_TOKEN`, `SPECIALIST_TELEGRAM_ID`, `SPECIALIST_NAME`

### Deployment

```bash
# Frontend
cd mini-app && bunx vercel --prod

# Backend
docker build --platform linux/amd64 -t <dockerhub-user>/scheduler-bot:latest -f bot/Dockerfile bot/
docker push <dockerhub-user>/scheduler-bot:latest
```

Real image namespace/registry comes from the `IMAGE` env var in `deploy/build-and-push.sh`.

## Architecture

### Mini App Structure (mini-app/src/)

- **app/(client)/** - Client-facing pages: home, book, profile, services, analytics, `(activity)` group (bookings, recurring)
- **app/admin/** - Admin pages: dashboard (`page.tsx`), bookings, clients, recurring, analytics, settings/
  - **settings/** - profile, schedule, services, days-off, notifications, referrals, help
- **components/** - Reusable UI. Notable: Calendar, MonthCalendar, CalendarView, TimeSlotGrid, BookingCard, BookingDetailModal, BookingForm/, PendingBookingCard, RecurringScheduleCard, ClientDetailModal, ClientAvatar, StatusBadge, Switch, ConfirmDialog, BottomSheet, BottomTabBar, TopBar, ServiceCard, ServiceSelector, WallpaperPicker, PhotoEditor, TimePickerModal, RescheduleSheet, ThemeSelector, LanguageSelector, SettingsMenuItem, StatCard/StatBar/BarChart, TelegramBackButtonProvider, AppBootstrap, ToastProvider
- **hooks/** - `swr.tsx` provider, `cache-keys.ts`, `queries.ts`, `mutations.ts`, `cache-sync.tsx`, `useDebounce`, `useRescheduleActions`
- **lib/** - Core utilities
  - `telegram.ts` - Telegram WebApp SDK (theme, user data, navigation)
  - `api.ts` - API client connecting to Go backend; `mock-api.ts` for mock test routes
  - `types.ts` - TypeScript interfaces (Specialist, SessionType, Booking, RecurringSchedule, etc.)
  - `helpers.ts` - `parseDateParam`, `nextDateForWeekday`, date/format helpers
  - `routes.ts`, `colors.ts`, `constants.ts`, `mappings.ts`, `mutation-events.ts`, `request-cache.ts`

### Bot Structure (bot/)

- `main.go` - HTTP server, bot manager, background workers (reminders, notifications, webhook self-healer)
- `internal/telegram/` - Bot handlers and message templates. Master bot is split into: `master.go` (entrypoint + onboarding state machine), `master_menu.go` (`/start` inline menu + FAQ screens), `master_support.go` (operator support relay via forum topics), `master_admin.go` (owner analytics panel). Also: per-specialist bot handlers, persistent reply keyboard.
- `internal/api/` - REST API handlers, middleware, router. Notable: `admin_handlers`, `recurring_handlers`, `photo_handlers`, `referral_handlers`, `change_handlers`, `delete_bot_handler`, `stats`, `ratelimit`, `cache`, `metrics`, `security`
- `internal/db/` - Database layer (SQLite + PostgreSQL dual driver): specialists, clients, bookings, recurring, working_hours, days_off, session_types, stats, `owner_stats` (platform-wide metrics for master bot admin panel), `support` (support_threads mapping), compat, query_helpers
- `internal/changes/` - Change events helper
- `internal/config/` - Environment configuration
- `internal/i18n/` - Backend i18n (embedded locale files)
- `internal/crypto/` - Token encryption/hashing
- `internal/models/` - Shared data structures

### Data Flow

1. Specialist registers via master bot → gets their own Telegram bot
2. Client opens specialist's bot → /start → "Open Scheduler" web*app button (deep links supported, e.g. `ref*<code>`, preselected service/date via query params)
3. Mini-app loads → client picks date/duration/time → booking created (status: pending)
4. Specialist receives Telegram notification with Accept/Reject buttons
5. Specialist clicks button → webhook → booking status updated → client notified
6. Admin reschedule of a confirmed booking requires client re-approval; all cancellations are immediate with a notification to the counterpart

### Webhook Setup

Bot uses Telegram webhooks (not long polling):

- Master bot: `{PUBLIC_BASE_URL}/master/{MASTER_WEBHOOK_SECRET}/webhook`
- Per-specialist bots: `{PUBLIC_BASE_URL}/specialist/{id}/{secret}/webhook`
- Secret token validated via `X-Telegram-Bot-Api-Secret-Token` header
- For local dev, use ngrok: `ngrok http 8080` and set `PUBLIC_BASE_URL`

## Key Patterns

- Dual database: SQLite (default) + PostgreSQL (opt-in via `DATABASE_URL`)
- `db/compat.go`: `Q()` translates `?` → `$N` for Postgres, `DateNow()`, `BoolVal()`
- DB migrations: idempotent `ALTER TABLE` with ignored errors on startup
- `specialistColumns` const in `specialists.go` must match `scanSpecialist` field order
- SWR caching with centralized cache keys and invalidation helpers
- All timestamps in ISO format, working hours use "HH:MM" strings
- UUIDs for all database primary keys
- Auth via `X-Specialist-ID` header (falls back to `X-Trainer-ID`) and `X-Telegram-Init-Data`; query params also accept `?specialist=` (falls back to `?trainer=`)
- Ghost clients get negative `telegram_user_id` (preserves UNIQUE constraint); admin bookings for ghosts auto-confirm; all notification callbacks skip ghosts
- Duration-based booking: clients pick duration (1h, 1.5h, etc.); `available_durations` on specialists, `preferred_duration` on clients, `duration_minutes` on bookings
- Recurring schedules use `day_times` JSON for per-day time selection; two-sided approval between creator and counterpart
- Admin reschedule of a confirmed booking pushes it back to pending and requires client approval; all cancellations are immediate
- Clients can be blocked (`is_blocked`); blocked clients cannot create bookings, specialist may auto-cancel their active bookings/recurring via `PUT /api/admin/clients/{id}/block` (ghosts excluded). Deleting a client supports cascade-delete of their data.
- Specialist profiles support `wallpaper` customization (shown in client home header)
- Specialist photo falls back to Telegram user photo when no custom photo is set
- Per-specialist referral system: `specialists.referral_code`, `clients.referred_via_code`; share link `https://t.me/<bot>?start=ref_<code>`; admin UI at `/admin/settings/referrals`
- Specialist bot has a persistent reply keyboard (Профиль, Информация); web_app launches happen via inline keyboard to preserve init data (reply-keyboard web_app would break admin auth)
- Delete-bot flow: confirmation phrase + 2s hold-to-delete button; cascades through all specialist data and removes the Telegram bot webhook
- Webhook self-healer: background loop detects and re-registers broken Telegram webhooks
- Master bot doubles as help-desk + owner analytics. `/start` shows an inline menu (Create my bot / FAQ / Talk to operator / Admin panel). Operator relay copies DMs into a forum topic inside `SUPPORT_GROUP_ID` (one topic per user, mapping in `support_threads`); admin replies in the topic are copied back. `/close` in a topic closes the thread; a conservative substring spam filter drops obvious junk before relay. Admin panel (users in `ADMIN_IDS` only) drills into platform/bookings/clients/recurring/referrals/top-specialists/durations/specialist-list.
- Theme: light/dark via Telegram `colorScheme` — `theme.css` has `:root` light defaults and `:root.dark` overrides; status colors exposed via `@theme inline` for Tailwind
- Light frontend data sync + SWR cache retention across route switches; infinite scroll for admin bookings; URL-backed filters on bookings list
- Pre-commit hooks: gofmt, prettier, eslint, go test, vitest (via Lefthook)

## Public Repository Hygiene

- The repo is public (renamed `scheduler`).
- Never commit `.env*` (only `*.example`), DB dumps/backups (`*.sql`, `*.sql.gz`, `*.db`), tokens, or prod hostnames/IPs/paths. Use placeholders (`api.example.com`, `/srv/scheduler`, `<dockerhub-user>`).
- Docs and comments must stay generic.
- `final.sql.gz` and `rehearsal.sql.gz` in the repo root are production-data dumps: they must be removed from the tree and purged from git history (tracked in history via commit 18e204f), and every secret they could contain rotated.
- Ask the maintainer before any history rewrite or force-push.
