# Admin Layout Design

## Overview

Add trainer-facing admin interface to the mini-app for managing bookings and settings.

## Entry Point

- Trainer sends `/admin` command to Telegram bot
- Bot opens mini-app with URL parameter: `?mode=admin`
- Mini-app checks `mode` param and renders admin UI

## Route Structure

```
/admin                        → Schedule (dashboard)
/admin/settings               → Settings menu
/admin/settings/profile       → Edit trainer profile
/admin/settings/services      → Manage services
/admin/settings/schedule      → Working hours configuration
/admin/settings/notifications → Notification preferences
/admin/settings/help          → Help/FAQ
```

## Navigation

**Bottom Navigation (fixed):**

- Left: Calendar icon → `/admin` (schedule)
- Right: Settings icon → `/admin/settings`

## Pages

### 1. Schedule Page (`/admin`)

**Nearest Booking Section:**

- Card showing next upcoming booking
- Displays: client name, service type, "через X минут", time range
- Tap opens booking detail modal
- Hidden if no upcoming bookings

**Tabs:**

- "День" (Day) | "Неделя" (Week)
- Default: Day view

**Day View:**

- Date header: "29 Января, Пятница"
- Date picker to change date (reuse WeekDatePicker)
- Timeline from working hours start to end
- Hour labels on left (09:00, 10:00, etc.)
- Booking cards positioned by time

**Week View:**

- 7-day horizontal grid (Mon-Sun)
- Compact booking indicators per day
- Tap day → switches to Day view for that date

### 2. Booking Detail Modal

**Triggered by:** Tapping any booking card

**Content:**

- Client name (large)
- Service type + duration
- Date and time range
- Client contact info (if available)
- Status badge (confirmed, pending)

**Actions:**

- "Изменить" (Reschedule) - opens date/time picker flow
- "Отменить" (Cancel) - confirmation dialog with optional reason

### 3. Settings Menu (`/admin/settings`)

List with icons and chevrons:

1. Профиль (Profile)
2. Услуги и цены (Services)
3. Расписание (Working hours)
4. Уведомления (Notifications)
5. Помощь (Help)

### 4. Profile Page (`/admin/settings/profile`)

- Photo upload/change
- Name input
- Specialization input
- Bio textarea
- Phone input
- Telegram handle input
- "Сохранить" button

### 5. Services Page (`/admin/settings/services`)

**List View:**

- "Добавить услугу" button at top
- Service cards showing: name, price, duration
- Edit icon on each card

**Add/Edit Form:**

- Name input
- Price input (number)
- Duration picker (minutes)
- "Добавить услугу" / "Сохранить" button

### 6. Working Hours Page (`/admin/settings/schedule`)

- Start time picker (e.g., 09:00)
- End time picker (e.g., 23:00)
- Checkbox: "Разрешить клиентам меняться временем"
- Checkbox: "Блокировать возможность отмены занятия за N времени до начала"
- Number input: cancel cutoff hours
- "Сохранить изменения" button

### 7. Notifications Page (`/admin/settings/notifications`)

Toggle switches:

- New booking notifications
- Cancellation notifications
- Reminder before session

### 8. Help Page (`/admin/settings/help`)

- FAQ section (accordion or static)
- Contact support link/button

## New Components

| Component            | Description                       |
| -------------------- | --------------------------------- |
| `AdminLayout`        | Wrapper with bottom navigation    |
| `AdminBottomNav`     | Fixed bottom bar with 2 icons     |
| `NearestBookingCard` | Highlighted upcoming booking      |
| `ScheduleTabs`       | Day/Week tab switcher             |
| `DayTimeline`        | Vertical timeline with hour slots |
| `WeekGrid`           | 7-day horizontal grid             |
| `BookingDetailModal` | Modal with booking info + actions |
| `SettingsMenuItem`   | Row with icon, label, chevron     |
| `TimePickerModal`    | Hour selection grid               |
| `ServiceCard`        | Service display card              |
| `ServiceForm`        | Add/edit service form             |

## Reusable Components

- `TopBar` - header with back button
- `WeekDatePicker` - date selection
- `ConfirmDialog` - confirmation dialogs
- `PrimaryButton` - action buttons
- `BottomSafeArea` - safe area spacing

## API Endpoints Needed

```
GET    /api/admin/bookings          → List trainer's bookings
PATCH  /api/admin/bookings/:id      → Update booking (reschedule)
DELETE /api/admin/bookings/:id      → Cancel booking

GET    /api/admin/profile           → Get trainer profile
PUT    /api/admin/profile           → Update trainer profile

GET    /api/admin/services          → List services
POST   /api/admin/services          → Create service
PUT    /api/admin/services/:id      → Update service
DELETE /api/admin/services/:id      → Delete service

GET    /api/admin/working-hours     → Get working hours
PUT    /api/admin/working-hours     → Update working hours

GET    /api/admin/notifications     → Get notification settings
PUT    /api/admin/notifications     → Update notification settings
```

## Authentication

Admin endpoints require trainer authentication:

- Telegram init data must contain trainer's user ID
- Backend validates against `trainers.telegram_user_id`
