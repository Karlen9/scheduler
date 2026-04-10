# Navigation & Analytics Design Spec

## Overview

Two changes: (1) expand bottom navigation from 3 to 5 tabs on both client and admin sides, (2) add analytics pages for both client and specialist with dedicated backend endpoints.

---

## 1. Navigation Changes

### Client Bottom Navigation (5 tabs)

| #   | Key        | Label (ru/en)           | Icon            | Route        | Match Paths               |
| --- | ---------- | ----------------------- | --------------- | ------------ | ------------------------- |
| 1   | specialist | Специалист / Specialist | `UserRound`     | `/`          | exact `/` only            |
| 2   | bookings   | Записи / Bookings       | `ClipboardList` | `/bookings`  | `/bookings`, `/recurring` |
| 3   | book       | (no label)              | `Plus`          | `/book`      | `/book` (center button)   |
| 4   | analytics  | Аналитика / Analytics   | `BarChart3`     | `/analytics` | `/analytics`              |
| 5   | profile    | Профиль / Profile       | `User`          | `/profile`   | `/profile`                |

### Admin Bottom Navigation (5 tabs)

| #   | Key       | Label (ru/en)         | Icon            | Route              | Match Paths                   |
| --- | --------- | --------------------- | --------------- | ------------------ | ----------------------------- |
| 1   | home      | Записи / Bookings     | `ClipboardList` | `/admin`           | `/admin`, `/admin/recurring`  |
| 2   | clients   | Клиенты / Clients     | `Users`         | `/admin/clients`   | `/admin/clients`              |
| 3   | book      | (no label)            | `Plus`          | `/admin/book`      | `/admin/book` (center button) |
| 4   | analytics | Аналитика / Analytics | `BarChart3`     | `/admin/analytics` | `/admin/analytics`            |
| 5   | profile   | Настройки / Settings  | `Settings`      | `/admin/settings`  | `/admin/settings`             |

### BottomTabBar Changes

The `BottomTabBar` component currently calculates the sliding indicator position assuming only 2 side tabs (left/right of center). With 4 side tabs, the indicator logic needs updating to support N side tabs with dynamic left offset: `left = 6 + activeSideIndex * sideTabW`.

Tab button width will need to shrink from 96px to fit 5 tabs. Proposed: 72px width for side tabs when there are 4+ side tabs, keeping the center button at 56px logical + 82px visual.

---

## 2. Client Analytics Page

### Route: `/analytics`

### Data: `GET /api/stats`

Returns pre-computed stats for the authenticated client, scoped to their bookings with the current specialist.

### Response Type: `TClientStats`

```typescript
type TClientStats = {
  // Activity summary
  totalSessions: number; // completed bookings count
  totalHours: number; // sum of duration_minutes / 60, rounded to 1 decimal
  completionRate: number; // completed / (completed + cancelled + rejected), 0-100
  sessionsThisMonth: number; // completed bookings in current calendar month
  sessionsLastMonth: number; // completed bookings in previous calendar month

  // Patterns & streaks
  currentStreak: number; // consecutive weeks (ending this week) with >= 1 completed session
  longestStreak: number; // max consecutive weeks with >= 1 completed session
  mostCommonDay: number | null; // 0=Sunday..6=Saturday, null if no data
  mostCommonTimeSlot: string | null; // "morning" | "afternoon" | "evening" | null

  // Session breakdown
  averageDuration: number; // average duration_minutes of completed bookings
  durationBreakdown: { duration: number; count: number }[]; // grouped by duration_minutes
  monthlyTrend: { month: string; count: number }[]; // last 6 months, format "2026-04"
};
```

### UI Layout

```
+----------------------------------+
|         Аналитика                |
+----------------------------------+
|  [Total]  [Hours]  [Rate]  [Mo]  |   <- 4 stat cards in 2x2 grid
|  [12]     [18.5]   [85%]   [3]   |
+----------------------------------+
|  Паттерны                        |   <- Section header
|  ┌──────────────────────────┐    |
|  │ Текущая серия    3 нед.  │    |   <- streak row
|  │ Лучшая серия     8 нед.  │    |   <- best streak row
|  │ Частый день      Пн      │    |   <- most common day
|  │ Частое время     Утро    │    |   <- most common time
|  └──────────────────────────┘    |
+----------------------------------+
|  По длительности                 |   <- Section header
|  ┌──────────────────────────┐    |
|  │ 60 мин  ████████████  8  │    |   <- horizontal bar
|  │ 90 мин  ████████     5   │    |
|  │ 120 мин ████         3   │    |
|  └──────────────────────────┘    |
+----------------------------------+
|  По месяцам                      |   <- Section header
|  ┌──────────────────────────┐    |
|  │   █                      │    |   <- simple bar chart
|  │ █ █   █                  │    |   <- last 6 months
|  │ █ █ █ █ █ █              │    |
|  │ N D J F M A              │    |
|  └──────────────────────────┘    |
+----------------------------------+
```

Components:

- Top 4 stat cards: reuse existing `StatCard` component in a `grid-cols-2 gap-3` grid
- Patterns section: `bg-card rounded-xl p-4` card with rows
- Duration breakdown: `bg-card rounded-xl p-4` card with horizontal bars (CSS-only, no chart library)
- Monthly trend: `bg-card rounded-xl p-4` card with simple vertical bars (CSS-only)

---

## 3. Admin Analytics Page

### Route: `/admin/analytics`

### Data: `GET /api/admin/stats`

Returns pre-computed stats for the specialist's entire business.

### Response Type: `TAdminStats`

```typescript
type TAdminStats = {
  // Business overview
  totalBookings: number; // all-time booking count (any status)
  activeClients: number; // clients with completed booking in last 30 days
  completionRate: number; // completed / (completed + cancelled + rejected), 0-100
  bookingsThisMonth: number; // all bookings created this month
  bookingsLastMonth: number; // all bookings created last month

  // Client insights
  totalClients: number; // total unique clients
  newClientsThisMonth: number; // clients whose first booking was this month
  topClients: { name: string; count: number; photoUrl?: string }[]; // top 5 by completed count
  returningRate: number; // % of clients with 2+ completed bookings

  // Schedule utilization
  busiestDay: number | null; // 0=Sunday..6=Saturday
  busiestTimeSlot: string | null; // "morning" | "afternoon" | "evening"
  avgBookingsPerWeek: number; // average over last 4 weeks
  cancellationRate: number; // cancelled / total, 0-100

  // Revenue (computed from session_types prices if available)
  revenueThisMonth: number; // sum of session type prices for completed bookings
  revenueLastMonth: number;
  revenueCurrency: string; // from first session type, or "" if none
  revenueByMonth: { month: string; revenue: number }[]; // last 6 months
  revenueByService: { name: string; revenue: number }[]; // grouped by service
};
```

### UI Layout

Same card-based design as client analytics, with 4 sections:

1. **Business Overview** - 2x2 grid of `StatCard` (total bookings, active clients, completion rate, bookings this month with trend indicator)
2. **Client Insights** - card with total/new clients, top 5 client list (avatar + name + count), returning rate
3. **Schedule** - card with busiest day, time, avg/week, cancellation rate
4. **Revenue** - card with this month/last month, bar chart by month, breakdown by service (only shown if any session type has price > 0)

---

## 4. Backend Endpoints

### `GET /api/stats` (client)

- Auth: `TelegramAuthMiddleware` (existing)
- Handler: `HandleGetClientStats` in new file `bot/internal/api/stats.go`
- DB: `GetClientStats(specialistID, clientID)` in new file `bot/internal/db/stats.go`
- All aggregation in SQL (single query or few queries)
- Streak calculation in Go (simpler than SQL window functions, works on both SQLite and Postgres)

### `GET /api/admin/stats` (specialist)

- Auth: `AdminAuthMiddleware` (existing)
- Handler: `HandleGetAdminStats` in same `stats.go`
- DB: `GetAdminStats(specialistID)` in same `db/stats.go`

### Time slot classification

```
morning:   06:00-11:59
afternoon: 12:00-16:59
evening:   17:00-23:59
```

---

## 5. Files to Change

### Modified Files

| File                                       | Change                                                                                                                                                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mini-app/src/app/(client)/layout.tsx`     | Update `clientTabs` from 3 to 5 tabs: add specialist (`/`) and analytics (`/analytics`) tabs. Import `UserRound` and `BarChart3` icons.                                                                           |
| `mini-app/src/components/AdminLayout.tsx`  | Update `adminTabs` from 3 to 5 tabs: add clients (`/admin/clients`) and analytics (`/admin/analytics`) tabs. Import `Users`, `BarChart3`, `Settings` icons. Replace `User` icon with `Settings` for settings tab. |
| `mini-app/src/components/BottomTabBar.tsx` | Update indicator position logic to support N side tabs (not just 2). Reduce `TabButton` width from 96px to ~72px. Calculate `left = 6 + activeSideIndex * sideTabW` instead of hardcoded left/right.              |
| `mini-app/src/lib/types.ts`                | Add `TClientStats` and `TAdminStats` type definitions.                                                                                                                                                            |
| `mini-app/src/lib/api.ts`                  | Add `getClientStats()` method and `admin.getAdminStats()` method.                                                                                                                                                 |
| `mini-app/src/hooks/cache-keys.ts`         | Add `clientStats` and `adminStats` cache keys.                                                                                                                                                                    |
| `mini-app/src/hooks/queries.ts`            | Add `useClientStats()` and `useAdminStats()` hooks with `staticConfig`.                                                                                                                                           |
| `mini-app/src/hooks/mutations.ts`          | Add `invalidateClientStats()` and `invalidateAdminStats()` functions. Call them from `invalidateBookings()` since booking changes affect stats.                                                                   |
| `mini-app/messages/ru.json`                | Add `Navigation.specialist`, `Navigation.analytics`, `Navigation.clients`, `Navigation.settings` keys. Add `Analytics` section with all stat labels. Add `AdminAnalytics` section.                                |
| `mini-app/messages/en.json`                | Same keys as ru.json in English.                                                                                                                                                                                  |
| `bot/internal/api/router.go`               | Add `r.Get("/stats", HandleGetClientStats)` to client routes. Add `r.Get("/stats", HandleGetAdminStats)` to admin routes.                                                                                         |

### New Files

| File                                              | Purpose                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `mini-app/src/app/(client)/analytics/page.tsx`    | Client analytics page component                                  |
| `mini-app/src/app/(client)/analytics/loading.tsx` | Loading skeleton for client analytics                            |
| `mini-app/src/app/admin/analytics/page.tsx`       | Admin analytics page component                                   |
| `mini-app/src/app/admin/analytics/loading.tsx`    | Loading skeleton for admin analytics                             |
| `mini-app/src/components/StatBar.tsx`             | Horizontal bar component for duration breakdown (reusable)       |
| `mini-app/src/components/BarChart.tsx`            | Simple vertical bar chart for monthly trends (CSS-only, no deps) |
| `bot/internal/api/stats.go`                       | `HandleGetClientStats` and `HandleGetAdminStats` handlers        |
| `bot/internal/db/stats.go`                        | `GetClientStats` and `GetAdminStats` DB query functions          |
| `bot/internal/models/stats.go`                    | `ClientStats` and `AdminStats` Go structs                        |

### Test Files

| File                                                          | Purpose                               |
| ------------------------------------------------------------- | ------------------------------------- |
| `mini-app/src/app/(client)/analytics/__tests__/page.test.tsx` | Client analytics page tests           |
| `mini-app/src/app/admin/analytics/__tests__/page.test.tsx`    | Admin analytics page tests            |
| `bot/internal/db/stats_test.go`                               | DB stats query tests                  |
| `bot/internal/api/stats_test.go`                              | API handler tests for stats endpoints |

---

## 6. SWR Caching Strategy

- `clientStats` and `adminStats` use `staticConfig` (60s dedup, no revalidation) — stats are not time-critical
- `invalidateBookings()` also invalidates stats caches (booking changes affect all stats)
- No optimistic updates needed (read-only data)

---

## 7. i18n Keys

### Navigation (additions to existing section)

```json
// ru.json Navigation
"specialist": "Специалист",
"analytics": "Статистика",
"clients": "Клиенты",
"settings": "Настройки"

// en.json Navigation
"specialist": "Specialist",
"analytics": "Analytics",
"clients": "Clients",
"settings": "Settings"
```

### Analytics (new section)

```json
// ru.json Analytics
"title": "Аналитика",
"totalSessions": "Всего сеансов",
"totalHours": "Всего часов",
"completionRate": "Завершено",
"sessionsThisMonth": "В этом месяце",
"patterns": "Паттерны",
"currentStreak": "Текущая серия",
"longestStreak": "Лучшая серия",
"weeks": "нед.",
"mostCommonDay": "Частый день",
"mostCommonTime": "Частое время",
"morning": "Утро",
"afternoon": "День",
"evening": "Вечер",
"byDuration": "По длительности",
"minutes": "мин",
"byMonth": "По месяцам",
"noData": "Недостаточно данных",
"trend": "+{count} к прошлому месяцу"
```

### AdminAnalytics (new section)

```json
// ru.json AdminAnalytics
"title": "Аналитика",
"totalBookings": "Всего записей",
"activeClients": "Активные клиенты",
"completionRate": "Завершено",
"bookingsThisMonth": "В этом месяце",
"clientInsights": "Клиенты",
"totalClients": "Всего клиентов",
"newClients": "Новых в этом месяце",
"topClients": "Топ клиенты",
"returningRate": "Возвращаемость",
"schedule": "Расписание",
"busiestDay": "Загруженный день",
"busiestTime": "Загруженное время",
"avgPerWeek": "Среднее в неделю",
"cancellationRate": "Отмены",
"revenue": "Доход",
"revenueThisMonth": "В этом месяце",
"revenueLastMonth": "В прошлом месяце",
"byService": "По услугам",
"sessions": "сеансов"
```

---

## 8. Empty States

- Client analytics with no bookings: `EmptyState` component with `BarChart3` icon, "Недостаточно данных" title, "Запишитесь на сеанс, чтобы увидеть статистику" description
- Admin analytics with no bookings: `EmptyState` component with `BarChart3` icon, "Недостаточно данных" title, "Статистика появится после первых записей" description
- Revenue section hidden entirely when no session types have prices

---

## 9. Design Tokens (existing, reused)

- Cards: `bg-card rounded-xl p-4`
- Section headers: `text-foreground text-base font-semibold`
- Muted labels: `text-muted-foreground text-xs`
- Brand accent: `text-brand`, `bg-brand/20`
- Grid: `grid grid-cols-2 gap-3`
- Page padding: `p-4 space-y-4`
