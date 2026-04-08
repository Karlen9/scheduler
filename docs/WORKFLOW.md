# Scheduler — Full System Workflow

A complete step-by-step guide to how the Telegram Mini App scheduler works, from the first pixel the user sees to the last database query and security check.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Frontend — Mini App (Next.js 15)](#2-frontend--mini-app-nextjs-15)
3. [Backend — Bot Server (Go)](#3-backend--bot-server-go)
4. [Telegram Bot Integration](#4-telegram-bot-integration)
5. [Database Layer](#5-database-layer)
6. [Data Flows — End to End](#6-data-flows--end-to-end)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Security](#8-security)
9. [Internationalization (i18n)](#9-internationalization-i18n)
10. [Testing](#10-testing)
11. [Build, Deploy & Infrastructure](#11-build-deploy--infrastructure)
12. [Configuration Reference](#12-configuration-reference)

---

## 1. System Overview

The scheduler is a **multi-tenant Telegram Mini App** for specialists (trainers, teachers, beauty professionals, etc.) to manage client bookings. It has two main components:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Telegram                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│  │ Master Bot   │   │ Specialist   │   │ Telegram Mini    │   │
│  │ (onboarding) │   │ Bot (per-    │   │ App (WebView)    │   │
│  │              │   │  specialist) │   │                  │   │
│  └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘   │
└─────────┼──────────────────┼────────────────────┼──────────────┘
          │ webhooks         │ webhooks           │ HTTPS
          ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Go Backend (chi router)                     │
│  ┌────────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ /master/…/     │  │ /tg/…/      │  │ /api/*              │ │
│  │ webhook        │  │ webhook     │  │ REST API            │ │
│  └────────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Database (SQLite default / PostgreSQL opt-in)          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Universal naming convention** used everywhere: "specialist" (not trainer), "session" (not workout), "location" (not gym).

---

## 2. Frontend — Mini App (Next.js 15)

### 2.1 Tech Stack

| Layer           | Technology                             |
| --------------- | -------------------------------------- |
| Framework       | Next.js 15 (App Router)                |
| Language        | TypeScript (strict)                    |
| Styling         | Tailwind CSS 4 + CSS custom properties |
| State/Cache     | SWR (stale-while-revalidate)           |
| i18n            | next-intl (Russian/English)            |
| Testing         | Vitest + React Testing Library         |
| Package manager | bun                                    |
| Icons           | Lucide React                           |
| Toasts          | sonner                                 |
| Image crop      | react-easy-crop                        |

### 2.2 Directory Structure

```
mini-app/src/
├── app/
│   ├── layout.tsx                    # Root layout (theme, SWR, i18n, Telegram SDK)
│   ├── (client)/                     # Client-facing routes
│   │   ├── page.tsx                  # Home (specialist card, services, map)
│   │   ├── profile/page.tsx          # Client profile settings
│   │   ├── services/page.tsx         # Browse services
│   │   └── (activity)/
│   │       ├── layout.tsx            # Activity tabs wrapper
│   │       ├── book/page.tsx         # New booking flow
│   │       ├── bookings/page.tsx     # My bookings list
│   │       ├── recurring/page.tsx    # Recurring schedules
│   │       └── recurring/[id]/       # Recurring detail
│   └── admin/                        # Specialist admin panel
│       ├── layout.tsx                # Admin layout + bottom tabs
│       ├── page.tsx                  # Dashboard
│       ├── book/page.tsx             # Create booking for client
│       ├── bookings/page.tsx         # All bookings (filter/manage)
│       ├── clients/page.tsx          # Client management
│       ├── recurring/page.tsx        # Recurring schedules
│       ├── recurring/[id]/page.tsx   # Recurring detail
│       └── settings/
│           ├── page.tsx              # Settings hub
│           ├── profile/page.tsx      # Specialist profile
│           ├── schedule/page.tsx     # Working hours
│           ├── services/page.tsx     # Session types
│           ├── days-off/page.tsx     # Days off calendar
│           ├── notifications/page.tsx # Notification prefs
│           └── help/page.tsx         # Help/FAQ
├── components/                       # Reusable UI (see §2.4)
├── hooks/                            # SWR hooks (see §2.5)
├── lib/
│   ├── api.ts                        # API client (see §2.6)
│   ├── telegram.ts                   # Telegram WebApp SDK
│   ├── types.ts                      # TypeScript interfaces
│   └── colors.ts                     # Avatar color utils
├── i18n/
│   ├── request.ts                    # next-intl config
│   └── messages/
│       ├── ru.json                   # Russian translations
│       └── en.json                   # English translations
└── middleware.ts                      # next-intl routing
```

### 2.3 App Initialization Flow

When the mini-app opens inside Telegram:

```
1. Telegram injects WebApp SDK into the WebView
2. layout.tsx loads:
   a. Injects <script src="telegram-web-app.js">
   b. Detects colorScheme from Telegram (light/dark)
   c. Applies theme class to <html> (`:root` or `:root.dark`)
   d. Wraps app in SWRProvider (cache layer)
   e. Wraps in ToastProvider (notifications)
   f. Initializes next-intl with user's language
3. Client page.tsx renders:
   a. Fetches specialist data (useSpecialist hook)
   b. If user IS the specialist → redirect to /admin
   c. Otherwise → show specialist card, services, location map
```

### 2.4 Component Library

**Layout & Navigation:**

- `TopBar` — Header with title, language selector, Telegram SafeArea
- `BottomTabBar` — 5 tabs: Home, Book, Bookings, Recurring, Profile
- `ActivityTabs` — Sub-tabs within activity section
- `AdminLayout` — Admin page wrapper
- `BottomSafeArea` — Padding for device notches

**Booking & Calendar:**

- `Calendar` / `MonthCalendar` — Month picker with day selection
- `TimeSlotGrid` / `TimeSlotPicker` — 30-min increment time slots
- `DurationSelector` — Pick booking length (1h, 1.5h, 2h…)
- `BookingCard` — Single booking display with status + actions
- `BookingDetailModal` — Full detail with accept/reject/cancel/reschedule
- `PendingBookingCard` — Quick accept/reject card
- `RescheduleSheet` — Bottom sheet for rescheduling
- `UpcomingBookingCard` / `NearestBookingCard` — Dashboard cards

**Recurring:**

- `RecurringScheduleCard` — Recurring schedule summary
- `ScheduleTabs` — Weekly/bi-weekly/monthly tabs

**Admin:**

- `ServiceCard` — Session type card
- `StatCard` — Icon + number + label (dashboard stats)
- `SettingsMenuItem` — Settings menu item

**Common UI:**

- `PrimaryButton` — Brand-colored action button
- `StatusBadge` — Status indicator (pending/confirmed/rejected/cancelled/completed)
- `EmptyState` — No-data placeholder
- `LoadingSkeleton` — Skeleton loading animation
- `ConfirmDialog` — Modal with confirm/cancel
- `BottomSheet` — Swipeable bottom sheet
- `LanguageSelector` / `ThemeSelector` — User preferences
- `PhotoEditor` — Crop/resize before upload

### 2.5 SWR Caching System

Located in `hooks/`:

**Cache Keys** (`cache-keys.ts`):

```
specialist       — public specialist info
adminProfile     — specialist as admin
profile          — client profile
bookings         — client bookings
adminBookings    — all bookings (admin)
recurringSchedules / adminRecurringSchedules
sessionTypes / adminServices
workingHours / adminWorkingHours
daysOff / adminDaysOff
durations        — available booking durations
adminClients     — all clients
```

**Query Hooks** (`queries.ts`):

- Static data (60s dedup): `useSpecialist()`, `useWorkingHours()`, `useDaysOff()`, `useDurations()`, `useSessionTypes()`, `useAdminProfile()`, `useAdminWorkingHours()`, `useAdminDaysOff()`, `useAdminServices()`, `useAdminNotifications()`
- User data (30s dedup): `useProfile()`, `useClients()`
- Dynamic data (no dedup): `useBookings()`, `useAdminBookings()`, `useRecurringSchedules()`, `useAdminRecurringSchedules()`

**Mutation Helpers** (`mutations.ts`) — After writes, invalidate relevant caches:

- `invalidateBookings()` — Both client and admin booking caches
- `invalidateWorkingHours()`, `invalidateDaysOff()`, `invalidateServices()`
- `invalidateSpecialist()`, `invalidateProfile()`, `invalidateClients()`
- `invalidateRecurring()`, `invalidateAdminNotifications()`

### 2.6 API Client (`lib/api.ts`)

Central HTTP client that connects the frontend to the Go backend.

**How it works:**

1. Reads `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_DEV_API_URL` for the backend URL
2. Every request injects two headers:
   - `X-Telegram-Init-Data` — Telegram auth payload (from WebApp SDK)
   - `X-Specialist-ID` — Which specialist's context (from URL param `?specialist=`)
3. Provides two namespaces:

**Public methods** (client-facing):

```
getSpecialist()          getSessionTypes()       getDaysOff()
getAvailableSlots()      getDurations()          getBookings()
createBooking()          cancelBooking()         confirmBooking()
declineBooking()         uploadPhoto()           getProfile()
updateProfile()          updateNotificationPrefs()
getRecurringSchedules()  createRecurringSchedule()
previewRecurringSchedule()  cancelRecurringSchedule()
requestCancelBooking()   requestMoveBooking()
```

**Admin methods** (`admin.*`):

```
getProfile()             updateProfile()          uploadPhoto()
getServices()            createService()          updateService()         deleteService()
getWorkingHours()        updateWorkingHours()     setWorkingHoursForDay() deleteWorkingHoursForDay()
getDaysOff()             createDayOff()           deleteDayOff()
getBookings()            updateBookingStatus()    cancelBooking()         rescheduleBooking()
getDurations()           getClients()             createGhostClient()
updateClient()           deleteClient()           createBooking()
getRecurringSchedules()  createRecurringSchedule()  previewRecurringSchedule()
approveRecurringSchedule()  declineRecurringSchedule()  cancelRecurringSchedule()
requestCancelBooking()   requestMoveBooking()
approveMoveBooking()     declineMoveBooking()
getNotificationPrefs()   updateNotificationPrefs()
```

**Photo proxy**: `getPhotoUrl(fileId)` routes through `/api/photo/{fileId}` to proxy Telegram-hosted images.

### 2.7 Telegram SDK Integration (`lib/telegram.ts`)

- `getTelegramWebApp()` — Access `window.Telegram.WebApp`
- `getInitData()` — Get `X-Telegram-Init-Data` string for backend auth
- `getSpecialistId()` — Read specialist param from URL or header
- `useWebAppReady()` — React hook for WebApp ready state
- `useTelegramTheme()` — React hook for dark/light detection via `Telegram.WebApp.colorScheme`

### 2.8 Theme System

No hardcoded `className="dark"`. Instead:

1. Telegram provides `colorScheme` ("light" or "dark")
2. `layout.tsx` adds `.dark` class to `<html>` if dark
3. `theme.css` defines:
   - `:root` — Light theme defaults (CSS custom properties)
   - `:root.dark` — Dark overrides
4. All colors are CSS variables, exposed via `@theme inline` for Tailwind

---

## 3. Backend — Bot Server (Go)

### 3.1 Tech Stack

| Layer         | Technology                                        |
| ------------- | ------------------------------------------------- |
| Language      | Go 1.24                                           |
| Router        | chi v5                                            |
| Database      | SQLite (modernc.org/sqlite) + PostgreSQL (pgx/v5) |
| Encryption    | AES-256-GCM (crypto/aes + crypto/cipher)          |
| i18n          | go-i18n v2 (embedded JSON)                        |
| Telegram      | Direct HTTP API calls                             |
| Rate limiting | golang.org/x/time/rate                            |
| UUID          | github.com/google/uuid                            |
| Env           | github.com/joho/godotenv                          |

### 3.2 Directory Structure

```
bot/
├── main.go                          # Entry point, server, BotManager, workers
├── internal/
│   ├── config/config.go             # Environment config loading
│   ├── models/models.go             # Data structures + enums
│   ├── crypto/crypto.go             # AES encryption + SHA-256 hashing
│   ├── i18n/i18n.go                 # Backend translations
│   │   └── locales/
│   │       ├── active.ru.json       # Russian locale
│   │       └── active.en.json       # English locale
│   ├── db/
│   │   ├── db.go                    # Init, migrations, dual-driver setup
│   │   ├── compat.go                # Q(), BoolVal(), DateNow() helpers
│   │   ├── specialists.go           # Specialist CRUD
│   │   ├── clients.go               # Client CRUD + ghost clients
│   │   ├── bookings.go              # Booking CRUD + availability
│   │   ├── recurring.go             # Recurring schedule CRUD + generation
│   │   ├── session_types.go         # Session type CRUD
│   │   ├── working_hours.go         # Working hours CRUD
│   │   └── days_off.go              # Days off CRUD
│   ├── api/
│   │   ├── router.go                # Route definitions
│   │   ├── handlers.go              # Client-facing API handlers
│   │   ├── admin_handlers.go        # Admin API handlers
│   │   ├── middleware.go            # Auth, CORS, i18n, security headers
│   │   └── ratelimit.go            # Global + per-IP rate limiting
│   └── telegram/
│       ├── bot.go                   # Telegram Bot API client
│       ├── handlers.go              # Specialist bot webhook handlers
│       ├── master.go                # Master bot (onboarding) handlers
│       └── messages.go              # Message templates + formatting
├── Dockerfile                       # Multi-stage Go build
└── go.mod / go.sum                  # Dependencies
```

### 3.3 Server Startup (`main.go`)

```
1. Load config from .env / environment
2. Initialize encryption (crypto.Init)
3. Initialize database (db.Init)
   → Auto-detect SQLite vs PostgreSQL
   → Run all idempotent migrations
4. Initialize i18n (embedded locales)
5. Seed legacy data if needed (single-bot mode)
6. Create BotManager (in-memory registry of active bots)
7. Load all active specialists from DB
   → For each: create Bot + Handler, register webhook, store in BotManager
8. Set up master bot (if MASTER_BOT_TOKEN configured)
   → Register master webhook
9. Create chi router with all middleware + routes
10. Wire callback hooks (notification functions)
11. Start background workers:
    → Reminder worker (every 1 min, sends 24h reminders)
12. Start HTTP server on configured port
```

### 3.4 BotManager

In-memory registry that maps webhook secrets to bot instances:

```go
type BotManager struct {
    bots map[string]*BotEntry  // webhookSecret → {Bot, Handler, Specialist}
    mu   sync.RWMutex
}
```

- **At startup**: loads all active specialists, registers their bots
- **On webhook**: looks up bot by secret from URL path
- **Lazy loading**: if webhook arrives for unknown secret, tries DB lookup (handles new registrations)
- **Dynamic registration**: when a new specialist onboards via master bot, registers immediately

### 3.5 Callback Hooks

The API layer and main.go are decoupled through callback functions. `main.go` registers these on the API handlers:

| Callback                          | Trigger                                             | Effect                                                       |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| `NotifyBookingFunc`               | Client creates booking                              | Sends specialist Telegram message with Accept/Reject buttons |
| `NotifyStatusChangeFunc`          | Specialist accepts/rejects via admin                | Sends client status update message                           |
| `UpdateSpecialistMessageFunc`     | Status changes in admin panel                       | Edits specialist's original Telegram message                 |
| `NotifySpecialistBookingFunc`     | Specialist creates booking                          | Sends client Telegram message with Accept/Decline buttons    |
| `NotifyClientBookingResponseFunc` | Client confirms/declines specialist-created booking | Notifies specialist of response                              |
| `NotifyRecurringScheduleFunc`     | Recurring schedule created                          | Sends counterpart Approve/Decline message                    |
| `NotifyCancellationFunc`          | Any cancellation                                    | Notifies other party (respects notification prefs)           |
| `NotifyMoveRequestFunc`           | Reschedule request                                  | Notifies counterpart                                         |

### 3.6 Background Workers

**Reminder Worker** (runs every 1 minute):

1. Query `GetBookingsNeedingReminder()` — bookings 24h before start, `reminder_sent = false`
2. For each booking:
   - Check `client.NotifyReminders` preference
   - Look up specialist's bot
   - Format reminder message (`FormatReminderClient()`)
   - Send via specialist's Telegram bot
   - Mark `reminder_sent = true` in DB

---

## 4. Telegram Bot Integration

### 4.1 Bot Architecture

There are two types of bots:

**Master Bot** — Single bot for specialist onboarding:

- Path: `/master/{MASTER_WEBHOOK_SECRET}/webhook`
- Handles `/start`, `/register` commands
- Creates new specialist accounts
- Issues per-specialist bot tokens

**Specialist Bots** — One bot per specialist:

- Path: `/tg/{webhookSecret}/webhook`
- Each specialist has their own Telegram bot (created during onboarding)
- Bot token stored encrypted in DB
- Webhook secret is a random UUID

### 4.2 Webhook Setup

Telegram sends updates via HTTPS POST to the webhook URL:

```
Master:     {PUBLIC_BASE_URL}/master/{MASTER_WEBHOOK_SECRET}/webhook
Specialist: {PUBLIC_BASE_URL}/specialist/{id}/{webhookSecret}/webhook
```

Security: Telegram includes `X-Telegram-Bot-Api-Secret-Token` header, validated server-side.

### 4.3 Specialist Bot — Message Handling (`telegram/handlers.go`)

When a user sends a message to a specialist's bot:

```
HandleUpdate()
├── Message?
│   ├── /start
│   │   ├── Is specialist (owner)?
│   │   │   → Show "Admin Panel" + "Client App" buttons + version
│   │   ├── Is new client?
│   │   │   → Show language selection (Russian / English)
│   │   └── Is returning client?
│   │       → Show "Open Scheduler" button + help text
│   ├── /admin
│   │   → Open admin panel link
│   └── /help
│       → Show help/FAQ text
└── CallbackQuery? (button clicks)
    ├── lang_ru / lang_en
    │   → Set client language, show welcome + "Open Scheduler" button
    ├── approve_{bookingID}
    │   → UpdateBookingStatus(confirmed), notify client
    ├── reject_{bookingID}
    │   → UpdateBookingStatus(rejected), notify client
    ├── approve_recurring_{scheduleID}
    │   → ApproveAndGenerateBookings(), notify client
    ├── decline_recurring_{scheduleID}
    │   → UpdateRecurringScheduleStatus(declined), notify client
    ├── confirm_{bookingID} (client confirming specialist booking)
    │   → UpdateBookingStatus(confirmed), notify specialist
    └── decline_{bookingID} (client declining specialist booking)
        → UpdateBookingStatus(rejected), notify specialist
```

### 4.4 Master Bot — Onboarding (`telegram/master.go`)

```
/start → Show specialist registration prompt
/register → Begin registration flow:
  1. Ask for bot token (user creates via @BotFather)
  2. Validate token
  3. Create specialist in DB
  4. Register webhook for new bot
  5. Add to BotManager
  6. Confirm success
```

### 4.5 Message Templates (`telegram/messages.go`)

Formatted Telegram messages with HTML markup:

- `FormatWelcomeSpecialist()` — Start message for specialist
- `FormatWelcomeClient()` — Start message for client
- `FormatNewBookingNotification()` — "New booking from {client}" with details
- `FormatBookingStatusNotification()` — "Your booking was {accepted/rejected}"
- `FormatCancellation()` — "{user} cancelled the booking" with reason
- `FormatReminderClient()` — "Reminder: you have a session tomorrow at {time}"

Helpers: `formatDateTime()` (localized), `formatPrice()`, `formatDuration()`, `bookingDurationDisplay()`, `localizeCancelReason()`

### 4.6 Bot API Client (`telegram/bot.go`)

Direct HTTP calls to Telegram Bot API:

```go
type Bot struct {
    Token    string
    Username string
}

Methods:
  SendMessage(chatID, text, replyMarkup)
  SendMessageHTML(chatID, htmlText, replyMarkup)
  EditMessageText(chatID, messageID, text, replyMarkup)
  SetWebhook(url, secretToken)
  DeleteWebhook()
  GetWebhookInfo()
  GetFile(fileID)
  AnswerCallbackQuery(queryID, text)
```

---

## 5. Database Layer

### 5.1 Dual Driver Support

```
DATABASE_URL set? ──yes──→ PostgreSQL (pgx/v5/stdlib)
        │
        no
        │
        ▼
   SQLite (modernc.org/sqlite)
   File: ./data/scheduler.db
```

**Compatibility layer** (`db/compat.go`):

| Function     | SQLite            | PostgreSQL                            |
| ------------ | ----------------- | ------------------------------------- |
| `Q(query)`   | No-op (keeps `?`) | Translates `?` → `$1, $2, …`          |
| `BoolVal(b)` | `1` or `0`        | `1` or `0` (INTEGER columns for both) |
| `DateNow()`  | `date('now')`     | `CURRENT_DATE`                        |

All parameterized queries are wrapped in `Q()`. No raw `?` placeholders anywhere.

### 5.2 Schema

**Tables:**

```sql
specialists (
  id TEXT PRIMARY KEY,
  telegram_user_id INTEGER UNIQUE,
  bot_token TEXT,
  bot_token_hash TEXT,
  bot_username TEXT,
  webhook_secret TEXT UNIQUE,
  name TEXT,
  timezone TEXT DEFAULT 'Europe/Moscow',
  cancel_cutoff_hours INTEGER DEFAULT 24,
  telegram_handle TEXT,
  phone TEXT,
  specialization TEXT,
  bio TEXT,
  photo_url TEXT,
  location_latitude REAL DEFAULT 0,
  location_longitude REAL DEFAULT 0,
  available_durations TEXT DEFAULT '',
  language TEXT DEFAULT 'ru',
  notify_new_bookings INTEGER DEFAULT 1,
  notify_cancellations INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

clients (
  id TEXT PRIMARY KEY,
  telegram_user_id INTEGER,
  specialist_id TEXT REFERENCES specialists(id),
  name TEXT,
  display_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  preferred_duration INTEGER DEFAULT 60,
  language TEXT DEFAULT 'ru',
  is_ghost INTEGER DEFAULT 0,
  notify_booking_status INTEGER DEFAULT 1,
  notify_reminders INTEGER DEFAULT 1,
  notify_days_off INTEGER DEFAULT 0,
  notify_cancellations INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(telegram_user_id, specialist_id)
)

bookings (
  id TEXT PRIMARY KEY,
  specialist_id TEXT REFERENCES specialists(id),
  client_id TEXT REFERENCES clients(id),
  session_type_id TEXT REFERENCES session_types(id),
  starts_at DATETIME,
  ends_at DATETIME,
  client_name TEXT,
  client_message TEXT DEFAULT '',
  status TEXT CHECK(status IN ('pending','confirmed','rejected','cancelled','completed','cancel_requested','reschedule_pending')),
  cancel_reason TEXT DEFAULT '',
  cancelled_by TEXT CHECK(cancelled_by IN ('client','specialist') OR cancelled_by IS NULL),
  duration_minutes INTEGER DEFAULT 60,
  created_by TEXT DEFAULT 'client' CHECK(created_by IN ('client','specialist')),
  recurring_schedule_id TEXT DEFAULT '',
  replaces_booking_id TEXT DEFAULT '',
  notification_chat_id INTEGER DEFAULT 0,
  notification_message_id INTEGER DEFAULT 0,
  reminder_sent INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

recurring_schedules (
  id TEXT PRIMARY KEY,
  specialist_id TEXT REFERENCES specialists(id),
  client_id TEXT REFERENCES clients(id),
  client_name TEXT,
  day_of_week INTEGER,           -- legacy compat (single day)
  "time" TEXT,                   -- quoted: reserved word in Postgres
  duration_minutes INTEGER DEFAULT 60,
  status TEXT CHECK(status IN ('pending','active','declined','cancelled')),
  created_by TEXT DEFAULT 'client' CHECK(created_by IN ('client','specialist')),
  session_type_id TEXT DEFAULT '',
  days_of_week TEXT DEFAULT '',  -- comma-separated: "1,3,5"
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  day_times TEXT DEFAULT '',     -- JSON: {"1":"09:00","3":"10:30"}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

session_types (
  id TEXT PRIMARY KEY,
  specialist_id TEXT REFERENCES specialists(id),
  type TEXT DEFAULT 'custom',
  name TEXT,
  duration_minutes INTEGER,
  price REAL DEFAULT 0,
  currency TEXT DEFAULT 'RUB',
  image_url TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

working_hours (
  id TEXT PRIMARY KEY,
  specialist_id TEXT REFERENCES specialists(id),
  day_of_week INTEGER,           -- 0=Sunday … 6=Saturday
  start_time TEXT,               -- "09:00"
  end_time TEXT,                 -- "18:00"
  UNIQUE(specialist_id, day_of_week)
)

days_off (
  id TEXT PRIMARY KEY,
  specialist_id TEXT REFERENCES specialists(id),
  date TEXT,                     -- "YYYY-MM-DD"
  reason TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### 5.3 Migrations

All migrations are **idempotent** — safe to run on every startup.

**SQLite strategy:**

- `ALTER TABLE … ADD COLUMN` — errors silently ignored if column exists
- `CREATE TABLE IF NOT EXISTS` for new tables
- Table rename: `ALTER TABLE trainers RENAME TO specialists` (ignore error if already renamed)
- Column rename: `ALTER TABLE … RENAME COLUMN gym_latitude TO location_latitude`
- Enum migration: rebuild entire table (SQLite can't alter CHECK constraints)

**PostgreSQL strategy:**

- `ALTER TABLE … ADD COLUMN IF NOT EXISTS`
- Dynamic constraint drop/recreate via PL/pgSQL `DO $$ BEGIN … END $$`
- Direct `UPDATE` for enum value migration

**Enum migration** (`migrateTrainerEnumSQLite` / `migrateTrainerEnumPostgres`):

- Changes `'trainer'` → `'specialist'` in `created_by` and `cancelled_by` columns
- SQLite: creates new table, copies data, drops old, renames new
- PostgreSQL: drops constraints, updates data, recreates constraints

### 5.4 Key Database Patterns

**Column ordering**: `specialistColumns` and `bookingColumns` constants must exactly match `scanSpecialist()` / `scanBookings()` field order.

**COALESCE joins**: Booking and recurring queries use subqueries to join client display_name and photo_url:

```sql
(SELECT COALESCE(NULLIF(c.display_name,''), c.name) FROM clients c WHERE c.id = b.client_id) as client_display_name,
(SELECT c.photo_url FROM clients c WHERE c.id = b.client_id) as client_photo_url
```

**Ghost clients**: Negative `telegram_user_id` from `-time.Now().UnixNano()`, preserving `UNIQUE(telegram_user_id, specialist_id)`.

**Encrypted tokens**: `bot_token` stored as `"enc:base64(nonce+ciphertext)"`, with `bot_token_hash` (SHA-256) indexed for O(1) lookups.

---

## 6. Data Flows — End to End

### 6.1 Client Creates a Booking

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client   │     │ Mini App  │     │ Go API   │     │ Telegram │
│  (user)   │     │ (Next.js) │     │ (chi)    │     │ (Bot API)│
└────┬──────┘     └────┬──────┘     └────┬──────┘     └────┬─────┘
     │                 │                 │                  │
     │ 1. Pick duration│                 │                  │
     │────────────────>│                 │                  │
     │                 │ 2. GET /api/    │                  │
     │                 │  availability   │                  │
     │                 │────────────────>│                  │
     │                 │                 │ 3. Query working │
     │                 │                 │    hours, booked │
     │                 │                 │    slots, days   │
     │                 │                 │    off           │
     │                 │  4. Available   │                  │
     │                 │     slots       │                  │
     │                 │<────────────────│                  │
     │ 5. Pick date    │                 │                  │
     │    + time       │                 │                  │
     │────────────────>│                 │                  │
     │                 │ 6. POST /api/   │                  │
     │                 │    bookings     │                  │
     │                 │────────────────>│                  │
     │                 │                 │ 7. CreateBooking │
     │                 │                 │    (pending)     │
     │                 │                 │                  │
     │                 │                 │ 8. Notify        │
     │                 │                 │    specialist    │
     │                 │                 │────────────────>│
     │                 │                 │                  │ 9. Send message
     │                 │                 │                  │    with Accept/
     │                 │                 │                  │    Reject buttons
     │                 │  10. Booking    │                  │
     │                 │      created    │                  │
     │                 │<────────────────│                  │
     │ 11. Show        │                 │                  │
     │     confirmation│                 │                  │
     │<────────────────│                 │                  │
```

**Specialist accepts:**

```
Specialist clicks "Accept" in Telegram
  → Telegram sends callback_query to webhook
  → handlers.go: handleCallbackQuery("approve_{id}")
  → db.UpdateBookingStatus(id, "confirmed")
  → NotifyStatusChangeFunc → SendMessage to client: "Your booking is confirmed!"
  → UpdateSpecialistMessageFunc → EditMessageText (removes buttons, shows "Confirmed")
```

### 6.2 Specialist Creates a Booking (Admin Panel)

```
1. Specialist opens admin → "Book for client"
2. Selects client (or creates ghost client)
3. Picks duration, date, time
4. POST /api/admin/bookings {clientId, duration, date, time}
5. Backend creates booking (status=pending, createdBy=specialist)
6. If ghost client → auto-confirm (status=confirmed), no notification
7. If real client → NotifySpecialistBookingFunc → Telegram message to client
   with Accept/Decline buttons
8. Client clicks Accept → callback_query → status=confirmed → notify specialist
```

### 6.3 Recurring Schedule — Full Cycle

```
1. Client selects days (Mon, Wed, Fri), per-day times, duration, period (8 weeks)
2. POST /api/recurring {dayTimes: {"1":"09:00","3":"14:00","5":"10:00"}, period: "8w"}
3. Backend: CreateRecurringScheduleFull (status=pending, createdBy=client)
4. NotifyRecurringScheduleFunc → Specialist gets Approve/Decline message
5. Specialist clicks "Approve"
6. handleCallbackQuery("approve_recurring_{id}")
7. ApproveAndGenerateBookings():
   a. Parse dayTimes JSON
   b. For each week in period:
      - For each day (Mon=1, Wed=3, Fri=5):
        - Get time from dayTimes (Mon→09:00, Wed→14:00, Fri→10:00)
        - Calculate starts_at and ends_at
        - CreateBooking (status=confirmed, createdBy=specialist, recurringScheduleID=id)
   c. Update schedule status to "active"
8. Client sees generated bookings in their bookings list
```

### 6.4 Cancellation Flow

```
ALL cancellations are immediate (no approval step):

Client cancels:
  DELETE /api/bookings/{id} {reason: "…"}
  → CancelBooking(id, reason, "client")
  → status=cancelled, cancelledBy=client
  → NotifyCancellationFunc:
    if specialist.NotifyCancellations → send specialist message
    (skip if client is ghost)

Specialist cancels (admin panel):
  PUT /api/admin/bookings/{id}/status {status: "cancelled", reason: "…"}
  → UpdateBookingStatusWithReason(id, "cancelled", reason, "specialist")
  → NotifyCancellationFunc:
    if client.NotifyCancellations → send client message
    (skip if client is ghost)
```

### 6.5 Availability Calculation

`HandleGetAvailability(date, duration)`:

```
1. Get specialist's working hours for date's day-of-week
2. If no working hours → return empty
3. Check if date is a day off → return empty
4. Generate 30-minute slots from start_time to end_time
5. For each slot:
   a. Calculate end_time = slot + duration
   b. Check if end_time exceeds working hours → unavailable
   c. Check cancellation cutoff (if slot is within cancelCutoffHrs of now) → unavailable
   d. Query GetConflictingBookings(specialistID, slotStart, slotEnd)
   e. If conflicts exist → unavailable
   f. Otherwise → available
6. Return slot list with availability flags
```

---

## 7. Authentication & Authorization

### 7.1 Telegram Mini App Auth

```
Telegram WebApp SDK                    Go Backend
─────────────────                      ──────────
window.Telegram.WebApp                 TelegramAuthMiddleware
  .initData                            ┌──────────────────────┐
  (query_id, user, auth_date, hash)    │ 1. Parse initData    │
           │                           │ 2. Extract hash      │
           │ X-Telegram-Init-Data      │ 3. Compute HMAC:     │
           │ header on every request   │    key = HMAC-SHA256( │
           ├──────────────────────────>│      "WebAppData",   │
           │                           │      bot_token)      │
           │                           │    sig = HMAC-SHA256( │
           │                           │      key,            │
           │                           │      data_check_str) │
           │                           │ 4. Compare sig==hash │
           │                           │ 5. Check auth_date   │
           │                           │    (< 1 hour old)    │
           │                           │ 6. Extract user ID   │
           │                           │ 7. GetOrCreateClient │
           │                           │ 8. Set context:      │
           │                           │    client + specialist│
           │                           └──────────────────────┘
```

### 7.2 Admin Authorization

After Telegram auth passes:

```
AdminAuthMiddleware:
  1. Get client from context (set by TelegramAuthMiddleware)
  2. Get specialist from context
  3. If client.TelegramUserID == specialist.TelegramUserID → allow
  4. Otherwise → 403 Forbidden
```

This ensures only the specialist who owns the bot can access admin routes.

### 7.3 Superadmin Authorization

For hidden management endpoints:

```
SuperadminAuthMiddleware:
  1. Check if SUPERADMIN_SECRET is configured
  2. If not → return 404 (endpoint doesn't exist)
  3. Read Authorization header
  4. Validate "Bearer {token}" == SUPERADMIN_SECRET
  5. Allow or 401
```

### 7.4 Specialist Identification

Every API request needs to know which specialist's context to use:

```
1. Frontend sends X-Specialist-ID header (from URL param ?specialist=)
2. Backend middleware reads header
3. Falls back to X-Trainer-ID (legacy cached URLs)
4. Falls back to ?specialist= query param
5. Falls back to ?trainer= query param (legacy)
6. Looks up specialist in DB by ID
7. Stores in request context
```

---

## 8. Security

### 8.1 Rate Limiting (`api/ratelimit.go`)

Two layers of protection:

**Global Rate Limiter:**

- 100 requests/second, burst of 200
- Single `rate.Limiter` for all traffic
- Returns `429 Too Many Requests` when exceeded

**Per-IP Rate Limiter:**

- 20 requests/second per IP, burst of 40
- Tracks `map[string]*rateLimiterEntry` with timestamps
- Cleanup goroutine every 5 minutes (removes IPs inactive for 10+ minutes)
- Returns `429 Too Many Requests` per-IP when exceeded

### 8.2 Token Encryption (`crypto/crypto.go`)

Bot tokens are sensitive (full bot control). Protected at rest:

```
Encrypt(plaintext):
  1. Generate 12-byte random nonce
  2. AES-256-GCM encrypt with nonce
  3. Return "enc:" + base64(nonce + ciphertext)

Decrypt(value):
  1. If no "enc:" prefix → return as-is (plaintext fallback)
  2. Decode base64
  3. Extract nonce (first 12 bytes)
  4. AES-256-GCM decrypt
  5. Return plaintext

HashToken(token):
  → SHA-256 hex digest (for indexed lookups without decryption)
```

**Storage**: `bot_token` column holds encrypted value, `bot_token_hash` column holds SHA-256 hash for fast lookups.

### 8.3 Security Headers (`api/middleware.go`)

```
X-Content-Type-Options: nosniff    — Prevents MIME sniffing
X-Frame-Options: DENY              — Prevents clickjacking
```

### 8.4 CORS (`api/middleware.go`)

```
Allowed Origins:  WebAppURL (production) + http://localhost:3000 (dev)
Allowed Methods:  GET, POST, PUT, DELETE, OPTIONS
Allowed Headers:  Accept, Authorization, Content-Type,
                  X-Telegram-Init-Data, X-Specialist-ID, X-Trainer-ID
Max Age:          300 seconds
```

### 8.5 Webhook Security

Telegram webhooks are verified via:

1. **URL secret**: Each specialist has a random UUID webhook secret in the URL path
2. **Header validation**: Telegram sends `X-Telegram-Bot-Api-Secret-Token` header, matched against stored secret

### 8.6 Ghost Client Safety

Ghost clients (created by admin for non-Telegram users):

- Get negative `telegram_user_id` = `-time.Now().UnixNano()`
- Preserves `UNIQUE(telegram_user_id, specialist_id)` constraint
- All 4 notification callbacks skip ghost clients (`if client.IsGhost → return nil`)
- No Telegram messages ever sent to ghost clients

---

## 9. Internationalization (i18n)

### 9.1 Backend (`internal/i18n/`)

- Library: `go-i18n v2`
- Locales embedded in binary via Go `embed` directive
- Files: `active.ru.json`, `active.en.json`
- `Init()` loads both locales at startup
- `NewLocalizer(lang)` creates a localizer for given language
- `T(localizer, key, params...)` translates a key
- `WithLocalizer(ctx, loc)` / `L(ctx)` — context-based localizer injection
- Default: Russian ("ru")

**I18nMiddleware** reads language from client/specialist model, stores localizer in context.

### 9.2 Frontend (`mini-app/src/i18n/`)

- Library: `next-intl`
- Files: `messages/ru.json`, `messages/en.json`
- `request.ts` configures server-side locale
- `middleware.ts` handles routing
- Components use `useTranslations('namespace')` hook

### 9.3 Language Selection

- New clients choose language on first `/start` (Telegram bot shows ru/en buttons)
- Language stored in `clients.language` and `specialists.language`
- Can be changed in profile settings (mini-app)

---

## 10. Testing

### 10.1 Backend Tests (Go)

Run with `go test ./...` from `bot/`.

| File                    | Coverage                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `config_test.go`        | Config loading from env, default values, admin ID parsing                                                             |
| `crypto/crypto_test.go` | AES init (valid/invalid/empty key), encrypt/decrypt round-trip, plaintext fallback, hash determinism, `IsEncrypted()` |
| `db/compat_test.go`     | `Q()` placeholder translation (`?` → `$1,$2`), `BoolVal()`, `DateNow()`                                               |
| `i18n_test.go`          | Localizer creation, translation with params, Russian fallback                                                         |
| `models_test.go`        | JSON serialization, DayOff custom date marshaling                                                                     |
| `api/ratelimit_test.go` | Global rate limiting (burst, sustained), per-IP tracking, cleanup                                                     |

### 10.2 Frontend Tests (Vitest)

Run with `bunx vitest run` from `mini-app/`.

| File                                        | Coverage                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `components/__tests__/BookingCard.test.tsx` | Renders booking info, status badge, action buttons                                 |
| `components/__tests__/StatusBadge.test.tsx` | Correct color/icon per status (pending, confirmed, rejected, cancelled, completed) |
| `lib/__tests__/api.test.ts`                 | Fetch helper header injection, error handling, photo URL proxying                  |

**Test setup** (`__tests__/setup.ts`): Vitest config, Happy DOM environment, mock utilities.

### 10.3 Pre-commit Hooks (Husky + lint-staged)

Before every commit:

1. `gofmt` — Go formatting check
2. `prettier` — Frontend formatting
3. `eslint` — Frontend linting
4. `go test ./...` — All Go tests must pass
5. `vitest run` — All frontend tests must pass

### 10.4 Docker Build Checks

The Dockerfile runs checks during build:

```dockerfile
RUN gofmt -l . | head -20 && test -z "$(gofmt -l .)"
RUN go vet ./...
RUN go test ./...
```

Build fails if any check fails.

---

## 11. Build, Deploy & Infrastructure

### 11.1 Frontend Deployment (Vercel)

```bash
cd mini-app
bunx vercel --prod
```

- Next.js standalone output mode
- Environment: `NEXT_PUBLIC_API_URL` points to Go backend

### 11.2 Backend Deployment (Docker)

```bash
# Build
docker build --platform linux/amd64 \
  -t rainingman/scheduler-bot:latest \
  -f bot/Dockerfile bot/

# Push
docker push rainingman/scheduler-bot:latest
```

**Dockerfile stages:**

1. **Builder**: `golang:1.24-alpine` — builds binary with `CGO_ENABLED=0`, runs gofmt/vet/test
2. **Runtime**: `alpine:latest` — minimal image with `ca-certificates` + `tzdata`
3. Exposes port 8080, creates `/data` for SQLite

### 11.3 Docker Compose (Development)

```yaml
services:
  db: # PostgreSQL 16
  bot: # Production mode (SQLite)
  bot-dev: # Dev mode (PostgreSQL via DATABASE_URL)
```

PostgreSQL: `scheduler:scheduler@localhost:5432/scheduler`

### 11.4 Local Development

**Backend:**

```bash
cd bot
# Set env vars in .env file
go run .
# For webhooks: ngrok http 8080 → set PUBLIC_BASE_URL
```

**Frontend:**

```bash
cd mini-app
bun install
bun dev   # http://localhost:3000
```

---

## 12. Configuration Reference

### 12.1 Backend Environment Variables

| Variable                 | Required | Default               | Description                            |
| ------------------------ | -------- | --------------------- | -------------------------------------- |
| `PUBLIC_BASE_URL`        | Yes      | —                     | Public HTTPS URL for webhooks          |
| `WEB_APP_URL`            | Yes      | —                     | Mini-app URL (for Telegram buttons)    |
| `MASTER_BOT_TOKEN`       | Yes      | —                     | Telegram master bot token              |
| `MASTER_WEBHOOK_SECRET`  | Yes      | —                     | Fixed secret for master webhook URL    |
| `PORT`                   | No       | `8080`                | HTTP server port                       |
| `DATABASE_PATH`          | No       | `./data/scheduler.db` | SQLite file path                       |
| `DATABASE_URL`           | No       | —                     | PostgreSQL URL (enables Postgres mode) |
| `ENCRYPTION_KEY`         | No       | —                     | Hex-encoded 32-byte AES key            |
| `ADMIN_IDS`              | No       | —                     | Comma-separated Telegram admin IDs     |
| `SUPERADMIN_SECRET`      | No       | —                     | Bearer token for /superadmin/\*        |
| `TELEGRAM_BOT_TOKEN`     | Legacy   | —                     | Single-bot mode token                  |
| `SPECIALIST_TELEGRAM_ID` | Legacy   | —                     | Single-bot specialist ID               |
| `SPECIALIST_NAME`        | Legacy   | —                     | Single-bot specialist name             |

### 12.2 Frontend Environment Variables

| Variable                  | Description              |
| ------------------------- | ------------------------ |
| `NEXT_PUBLIC_API_URL`     | Production API base URL  |
| `NEXT_PUBLIC_DEV_API_URL` | Development API base URL |

### 12.3 Key Go Dependencies

| Package                            | Purpose                  |
| ---------------------------------- | ------------------------ |
| `github.com/go-chi/chi/v5`         | HTTP router + middleware |
| `github.com/go-chi/cors`           | CORS handling            |
| `github.com/google/uuid`           | UUID generation          |
| `github.com/jackc/pgx/v5`          | PostgreSQL driver        |
| `modernc.org/sqlite`               | SQLite driver (pure Go)  |
| `github.com/joho/godotenv`         | .env file loading        |
| `github.com/nicksnyder/go-i18n/v2` | Backend i18n             |
| `golang.org/x/time/rate`           | Rate limiting            |

### 12.4 Key Frontend Dependencies

| Package             | Purpose                 |
| ------------------- | ----------------------- |
| `next` (15.x)       | React framework         |
| `react` (19.x)      | UI library              |
| `swr`               | Data fetching + caching |
| `next-intl`         | Frontend i18n           |
| `sonner`            | Toast notifications     |
| `lucide-react`      | Icons                   |
| `react-easy-crop`   | Image cropping          |
| `tailwindcss` (4.x) | Utility-first CSS       |

---

_This document describes the system as of February 2026._
