# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegram Mini App scheduler for specialists (trainers, teachers, beauty professionals, etc.). Two main components:
- **bot/** - Go Telegram bot that serves as entry point
- **mini-app/** - Next.js 15 frontend (Telegram Mini App) for booking UI

Language: Russian UI throughout the mini-app.

## Commands

### Mini App (Next.js)
```bash
cd mini-app
bun install       # Install dependencies
bun dev           # Dev server on http://localhost:3000
bun build         # Production build
bun lint          # ESLint
```

### Bot (Go)
```bash
cd bot
go run .          # Run server (webhook + API)
go build -o scheduler-bot  # Build binary
```

Required env vars: `TELEGRAM_BOT_TOKEN`, `WEB_APP_URL`, `PUBLIC_BASE_URL`, `WEBHOOK_SECRET`, `SPECIALIST_TELEGRAM_ID`, `SPECIALIST_NAME`

### Deployment
```bash
cd mini-app
bunx vercel       # Deploy to Vercel
```

## Architecture

### Mini App Structure (mini-app/src/)
- **app/** - Next.js App Router pages
  - `page.tsx` - Home screen (specialist info, action buttons)
  - `book/page.tsx` - Booking flow (calendar, time slots)
  - `bookings/page.tsx` - User's bookings list with cancel/reschedule
- **components/** - Reusable UI components (Calendar, TimeSlots, BookingCard, etc.)
- **lib/** - Core utilities
  - `telegram.ts` - Telegram WebApp SDK integration (theme, user data, navigation buttons)
  - `api.ts` - API client connecting to Go backend
  - `types.ts` - TypeScript interfaces (Specialist, SessionType, Booking, TimeSlot, WorkingHours)

### Bot Structure (bot/)
- `main.go` - HTTP server with Telegram webhook + REST API on single port
- `internal/telegram/` - Bot logic, webhook handling, message templates
- `internal/api/` - REST API handlers, middleware, router
- `internal/db/` - SQLite database layer
- `internal/config/` - Environment configuration

### Data Flow
1. User opens specialist's Telegram bot → /start → "Open Scheduler" button
2. Mini-app loads → `initTelegramApp()` → applies Telegram theme colors
3. User selects date/time → `api.createBooking()` → booking created with status "pending"
4. Specialist receives Telegram notification with Accept/Reject buttons
5. Specialist clicks button → webhook → booking status updated → user notified

### Webhook Setup
Bot uses Telegram webhooks (not long polling):
- Webhook URL: `{PUBLIC_BASE_URL}/tg/webhook/{WEBHOOK_SECRET}`
- Secret token validated via `X-Telegram-Bot-Api-Secret-Token` header
- For local dev, use ngrok: `ngrok http 8080` and set `PUBLIC_BASE_URL`

### Telegram Integration
The mini-app uses the Telegram WebApp SDK (`telegram.org/js/telegram-web-app.js`):
- BackButton for navigation
- MainButton for primary actions
- Theme params applied as CSS variables (--tg-theme-*)
- User data from initDataUnsafe

## Key Patterns

- Backend serves both webhook (`/tg/webhook/*`) and REST API (`/api/*`) on single port
- Telegram theme colors set via CSS custom properties in root element
- All timestamps in ISO format, working hours use "HH:MM" strings
- UUIDs for all database primary keys
- Session types: `personal`, `pair`, `consultation` (enum)
- One booking per client per day limit enforced server-side
