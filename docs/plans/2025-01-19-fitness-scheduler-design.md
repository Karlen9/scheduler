# Fitness Scheduler - Design Document

## Overview

SaaS platform for fitness trainers to manage client bookings via Telegram Mini App. Each trainer gets their own branded Telegram bot, all connected to a shared multi-tenant backend.

## Key Decisions

| Decision           | Choice                                                              |
| ------------------ | ------------------------------------------------------------------- |
| Deployment model   | SaaS for many trainers                                              |
| Client acquisition | Trainers bring their own clients (no marketplace)                   |
| Access method      | Unique Telegram bot per trainer                                     |
| Backend            | Shared backend with isolated data (multi-tenant)                    |
| Scheduling model   | Working hours + duration                                            |
| Session types      | Multiple types with different durations and prices                  |
| Payments           | Display prices only, payment outside app                            |
| Cancellation       | Time-based cutoff, both parties can cancel/reschedule with comments |
| Notifications      | Confirmation, cancellation, reminders (24h, 1h)                     |
| Language           | Russian                                                             |

## Architecture

```
+-----------------------------------------------------------+
|                    SHARED BACKEND (Go)                     |
|  +--------------+  +--------------+  +------------------+  |
|  | Bot Manager  |  |  Scheduler   |  |  Notification    |  |
|  |  (webhook)   |  |   Engine     |  |    Service       |  |
|  +--------------+  +--------------+  +------------------+  |
|                          |                                 |
|                 +--------+--------+                        |
|                 |   PostgreSQL    |                        |
|                 |  (multi-tenant) |                        |
|                 +-----------------+                        |
+-----------------------------------------------------------+
          ^               ^               ^
          |               |               |
   @CoachJohnBot    @FitSarahBot    @TrainerMikeBot
          |               |               |
     +----+----+     +----+----+     +----+----+
     | Clients |     | Clients |     | Clients |
     +---------+     +---------+     +---------+
```

## Data Model

### trainers

| Column            | Type      | Description                            |
| ----------------- | --------- | -------------------------------------- |
| id                | UUID      | Primary key                            |
| telegram_user_id  | BIGINT    | Trainer's Telegram ID                  |
| bot_token         | TEXT      | Bot token (encrypted)                  |
| bot_username      | TEXT      | Bot username                           |
| name              | TEXT      | Display name                           |
| timezone          | TEXT      | e.g., "Europe/Moscow"                  |
| cancel_cutoff_hrs | INT       | Hours before session client can cancel |
| created_at        | TIMESTAMP |                                        |

### clients

| Column           | Type      | Description          |
| ---------------- | --------- | -------------------- |
| id               | UUID      | Primary key          |
| telegram_user_id | BIGINT    | Client's Telegram ID |
| trainer_id       | UUID      | FK to trainers       |
| name             | TEXT      | Display name         |
| created_at       | TIMESTAMP |                      |

### working_hours

| Column      | Type | Description               |
| ----------- | ---- | ------------------------- |
| id          | UUID | Primary key               |
| trainer_id  | UUID | FK to trainers            |
| day_of_week | INT  | 0 (Sunday) - 6 (Saturday) |
| start_time  | TIME | e.g., 09:00               |
| end_time    | TIME | e.g., 18:00               |

### session_types

| Column           | Type    | Description                     |
| ---------------- | ------- | ------------------------------- |
| id               | UUID    | Primary key                     |
| trainer_id       | UUID    | FK to trainers                  |
| name             | TEXT    | e.g., "Персональная тренировка" |
| duration_minutes | INT     | e.g., 60                        |
| price            | DECIMAL | e.g., 5000.00                   |
| currency         | TEXT    | e.g., "RUB"                     |
| active           | BOOLEAN | Soft delete                     |

### bookings

| Column          | Type      | Description                     |
| --------------- | --------- | ------------------------------- |
| id              | UUID      | Primary key                     |
| trainer_id      | UUID      | FK to trainers                  |
| client_id       | UUID      | FK to clients                   |
| session_type_id | UUID      | FK to session_types             |
| starts_at       | TIMESTAMP | Booking start time              |
| ends_at         | TIMESTAMP | Booking end time                |
| status          | TEXT      | confirmed, cancelled, completed |
| cancel_reason   | TEXT      | Optional comment                |
| cancelled_by    | TEXT      | "client" or "trainer"           |
| created_at      | TIMESTAMP |                                 |

## Authentication

Telegram Mini App provides authentication via `initData`:

1. User opens mini-app from Telegram bot
2. Telegram passes signed initData containing user.id, user.first_name, hash
3. Backend validates signature using bot token
4. User is authenticated without passwords

## User Flows

### Client Flow (Mini App)

1. **Entry**: Click "Открыть расписание" in trainer's bot
2. **Home**: Choose "Записаться" or "Мои записи"
3. **Booking**: Select service -> Select date -> Select time -> Confirm
4. **My Bookings**: View upcoming, reschedule or cancel with reason

### Trainer Flow (Bot Commands)

| Command   | Description                     |
| --------- | ------------------------------- |
| /start    | Welcome message + mini app link |
| /admin    | Enter admin mode                |
| /hours    | Set working hours               |
| /services | Manage session types            |
| /schedule | View upcoming bookings          |
| /settings | Cancel cutoff, timezone         |

## Notifications (Russian)

### Client Receives

| Event               | Message                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Booking confirmed   | "Запись подтверждена: {service} с тренером {name}, {date} в {time} ({duration} мин). Цена: {price}" |
| Reminder 24h        | "Напоминание: {service} завтра в {time} с тренером {name}"                                          |
| Reminder 1h         | "Скоро начало: {service} через 1 час"                                                               |
| Trainer cancelled   | "Отменено тренером: {service} {date} в {time}. Причина: {reason}"                                   |
| Trainer rescheduled | "Перенесено тренером: с {old_date} {old_time} на {new_date} {new_time}. Причина: {reason}"          |

### Trainer Receives

| Event              | Message                                                                                |
| ------------------ | -------------------------------------------------------------------------------------- |
| New booking        | "Новая запись: {client} записался на {service}, {date} в {time}"                       |
| Client cancelled   | "Отмена: {client} отменил {service} {date} в {time}. Причина: {reason}"                |
| Client rescheduled | "Перенос: {client} перенёс {service} с {old_date} {old_time} на {new_date} {new_time}" |

## API Endpoints

### Webhook

```
POST /webhook/{bot_token}     # Telegram webhook for each bot
```

### Mini App API (client)

```
GET  /api/trainer             # Get trainer info
GET  /api/services            # List session types
GET  /api/availability        # Get available slots for date range
POST /api/bookings            # Create booking
GET  /api/bookings            # List client's bookings
PUT  /api/bookings/:id        # Reschedule
DELETE /api/bookings/:id      # Cancel
```

### Admin API (trainer)

```
GET  /api/admin/schedule      # Trainer's upcoming bookings
PUT  /api/admin/hours         # Update working hours
POST /api/admin/services      # Create session type
PUT  /api/admin/services/:id  # Update session type
PUT  /api/admin/settings      # Update settings
PUT  /api/admin/bookings/:id  # Trainer reschedule
DELETE /api/admin/bookings/:id # Trainer cancel
```

## Technical Stack

- **Backend**: Go + PostgreSQL
- **Mini App**: Next.js + Tailwind CSS
- **Bot**: Webhook-based (single endpoint handles all trainer bots)

## Project Structure

```
scheduler/
├── bot/
│   ├── main.go
│   ├── handlers/
│   │   ├── webhook.go
│   │   ├── commands.go
│   │   └── callbacks.go
│   ├── services/
│   │   ├── booking.go
│   │   ├── scheduler.go
│   │   └── notifications.go
│   ├── db/
│   │   ├── postgres.go
│   │   ├── trainers.go
│   │   ├── clients.go
│   │   ├── bookings.go
│   │   └── migrations/
│   └── jobs/
│       └── reminders.go
│
├── mini-app/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   ├── book/
│   │   │   │   └── page.tsx
│   │   │   ├── bookings/
│   │   │   │   └── page.tsx
│   │   │   └── api/
│   │   ├── components/
│   │   │   ├── Calendar.tsx
│   │   │   ├── TimeSlots.tsx
│   │   │   └── BookingCard.tsx
│   │   └── lib/
│   │       ├── telegram.ts
│   │       └── api.ts
│   └── ...
│
└── docker-compose.yml
```

## Availability Logic

1. Get trainer's working hours for requested date
2. Get existing bookings for that date
3. Generate available time slots based on session duration
4. Exclude slots that conflict with existing bookings
5. Return available slots
