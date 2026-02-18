# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant Telegram Mini App scheduler for specialists (trainers, teachers, beauty professionals, etc.). Two main components:
- **bot/** - Go backend (chi router, SQLite/PostgreSQL, Telegram webhooks + REST API)
- **mini-app/** - Next.js 15 frontend (Telegram Mini App) for booking UI

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

### Bot (Go)
```bash
cd bot
go run .          # Run server (webhook + API)
go build ./...    # Verify compilation
go test ./...     # Run tests
```

Required env vars (master bot): `MASTER_BOT_TOKEN`, `WEB_APP_URL`, `PUBLIC_BASE_URL`
Optional: `ADMIN_IDS`, `MASTER_WEBHOOK_SECRET`, `ENCRYPTION_KEY`
Legacy (single-bot): `TELEGRAM_BOT_TOKEN`, `SPECIALIST_TELEGRAM_ID`, `SPECIALIST_NAME`

### Deployment
```bash
# Frontend
cd mini-app && bunx vercel --prod

# Backend
docker build --platform linux/amd64 -t rainingman/scheduler-bot:latest -f bot/Dockerfile bot/
docker push rainingman/scheduler-bot:latest
```

## Architecture

### Mini App Structure (mini-app/src/)
- **app/(client)/** - Client-facing pages (home, book, bookings, recurring, profile, services)
- **app/admin/** - Admin pages (dashboard, bookings, clients, recurring, settings/*)
- **components/** - Reusable UI (Calendar, TimeSlots, BookingCard, StatusBadge, DurationSelector, etc.)
- **hooks/** - SWR cache keys, query hooks, mutation/invalidation helpers
- **lib/** - Core utilities
  - `telegram.ts` - Telegram WebApp SDK (theme, user data, navigation)
  - `api.ts` - API client connecting to Go backend
  - `types.ts` - TypeScript interfaces (Specialist, SessionType, Booking, RecurringSchedule, etc.)

### Bot Structure (bot/)
- `main.go` - HTTP server, bot manager, background workers (reminders, notifications)
- `internal/telegram/` - Bot handlers, master bot onboarding, message templates
- `internal/api/` - REST API handlers, middleware, router
- `internal/db/` - Database layer (SQLite + PostgreSQL dual driver)
- `internal/config/` - Environment configuration
- `internal/i18n/` - Backend i18n (embedded locale files)
- `internal/crypto/` - Token encryption/hashing
- `internal/models/` - Shared data structures

### Data Flow
1. Specialist registers via master bot → gets their own Telegram bot
2. Client opens specialist's bot → /start → "Open Scheduler" button
3. Mini-app loads → client picks date/time/duration → booking created (status: pending)
4. Specialist receives Telegram notification with Accept/Reject buttons
5. Specialist clicks button → webhook → booking status updated → client notified

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
- Auth via `X-Specialist-ID` header and `X-Telegram-Init-Data`
- Ghost clients get negative `telegram_user_id` (preserves UNIQUE constraint)
- Recurring schedules use `day_times` JSON for per-day time selection
- Pre-commit hooks: gofmt, prettier, eslint, go test, vitest (via Husky + lint-staged)
