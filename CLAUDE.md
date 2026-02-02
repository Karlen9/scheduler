# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegram Mini App scheduler for fitness trainers. Two main components:
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
go run main.go    # Run bot (requires TELEGRAM_BOT_TOKEN and WEB_APP_URL env vars)
go build -o scheduler-bot  # Build binary
```

### Deployment
```bash
cd mini-app
bunx vercel       # Deploy to Vercel
```

## Architecture

### Mini App Structure (mini-app/src/)
- **app/** - Next.js App Router pages
  - `page.tsx` - Home screen (trainer info, action buttons)
  - `book/page.tsx` - Booking flow (calendar, time slots)
  - `bookings/page.tsx` - User's bookings list with cancel/reschedule
- **components/** - Reusable UI components (Calendar, TimeSlots, BookingCard, etc.)
- **lib/** - Core utilities
  - `telegram.ts` - Telegram WebApp SDK integration (theme, user data, navigation buttons)
  - `api.ts` - Mock API client (currently uses mock-data.ts, to be replaced with real backend)
  - `types.ts` - TypeScript interfaces (Trainer, SessionType, Booking, TimeSlot, WorkingHours)

### Bot Structure (bot/)
- `main.go` - Long-polling bot that handles /start and /help commands, opens mini-app via inline keyboard

### Data Flow
1. User opens trainer's Telegram bot → /start → "Open Scheduler" button
2. Mini-app loads → `initTelegramApp()` → applies Telegram theme colors
3. User selects date/time → `api.createBooking()` → confirmation

### Telegram Integration
The mini-app uses the Telegram WebApp SDK (`telegram.org/js/telegram-web-app.js`):
- BackButton for navigation
- MainButton for primary actions
- Theme params applied as CSS variables (--tg-theme-*)
- User data from initDataUnsafe

## Key Patterns

- Mock API in `api.ts` simulates backend with delay - replace endpoints when backend is ready
- Telegram theme colors set via CSS custom properties in root element
- All timestamps in ISO format, working hours use "HH:MM" strings
- Booking conflicts checked client-side against existing bookings
