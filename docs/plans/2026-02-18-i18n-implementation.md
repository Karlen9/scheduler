# i18n Implementation Plan (Russian + English)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-user language selection (ru/en) to both the Go bot and Next.js mini-app using go-i18n v2 and next-intl.

**Architecture:** Bot uses go-i18n v2 with embedded JSON translation files and per-request Localizer via context. Mini-app uses next-intl v4 in "without i18n routing" mode — locale stored in cookie, set by thin middleware from `?lang=` URL param on first load.

**Tech Stack:** go-i18n v2, next-intl v4, Next.js middleware, server actions, SWR

---

## Task 1: Database — Add `language` Column

**Files:**
- Modify: `bot/internal/models/models.go:8-45`
- Modify: `bot/internal/db/db.go:195-234` (SQLite alters)
- Modify: `bot/internal/db/db.go:462-497` (Postgres alters)
- Modify: `bot/internal/db/trainers.go:21-58` (scanTrainer + trainerColumns)
- Modify: `bot/internal/db/clients.go:12-42` (scanClient + all SELECT queries)

**Step 1: Add Language field to models**

In `bot/internal/models/models.go`, add `Language` field to both structs:

```go
// Trainer struct — add after GymLongitude (line 23), before AvailableDurations (line 24):
Language            string    `json:"language,omitempty"`

// Client struct — add after PreferredDuration (line 38), before IsGhost (line 39):
Language            string    `json:"language,omitempty"`
```

**Step 2: Add migration for both DB drivers**

In `bot/internal/db/db.go`, append to SQLite `alterMigrations` (after line 229):
```go
`ALTER TABLE trainers ADD COLUMN language TEXT DEFAULT 'ru'`,
`ALTER TABLE clients ADD COLUMN language TEXT DEFAULT 'ru'`,
```

Append to Postgres `alterMigrations` (after line 496):
```go
`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ru'`,
`ALTER TABLE clients ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ru'`,
```

**Step 3: Update trainerColumns and scanTrainer**

In `bot/internal/db/trainers.go`:

Update `trainerColumns` (line 58) — append `, language` after `created_at`:
```go
const trainerColumns = `id, telegram_user_id, bot_token, bot_username, webhook_secret, name, timezone, cancel_cutoff_hrs, telegram_handle, phone, specialization, bio, photo_url, gym_latitude, gym_longitude, gym_address, available_durations, notify_new_bookings, notify_cancellations, is_active, created_at, language`
```

Update `scanTrainer` (lines 21-56) — add `language sql.NullString` var and scan it after `&t.CreatedAt`:
```go
var telegramHandle, phone, specialization, bio, photoURL, gymAddress, availableDurations, language sql.NullString
```
Add `&language` after `&t.CreatedAt` in the Scan call. After existing null string assignments, add:
```go
t.Language = language.String
if t.Language == "" {
    t.Language = "ru"
}
```

**Step 4: Update client SELECT queries and scanClient**

In `bot/internal/db/clients.go`:

All SELECT column lists (lines 42, 59, 134) must add `, language` after `created_at`. There are 4 locations:
- `GetClientByTelegramID` (line 42)
- `GetClientByID` (line 59)
- `GetClientsByTrainerID` (line 134)

Update `scanClient` (lines 12-37):
- Add `var language sql.NullString` to declarations
- Add `&language` after `&c.CreatedAt` in Scan
- Add after existing assignments:
```go
c.Language = language.String
if c.Language == "" {
    c.Language = "ru"
}
```

**Step 5: Add UpdateClientLanguage and UpdateTrainerLanguage DB functions**

In `bot/internal/db/clients.go`, add:
```go
func UpdateClientLanguage(clientID, language string) error {
	_, err := DB.Exec(Q(`UPDATE clients SET language = ? WHERE id = ?`), language, clientID)
	return err
}
```

In `bot/internal/db/trainers.go`, add:
```go
func UpdateTrainerLanguage(trainerID, language string) error {
	_, err := DB.Exec(Q(`UPDATE trainers SET language = ? WHERE id = ?`), language, trainerID)
	return err
}
```

**Step 6: Verify bot compiles**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`
Expected: Success

**Step 7: Commit**

```
feat: add language column to clients and trainers tables
```

---

## Task 2: Bot — go-i18n Core Module

**Files:**
- Create: `bot/internal/i18n/i18n.go`
- Create: `bot/internal/i18n/locales/active.ru.json`
- Create: `bot/internal/i18n/locales/active.en.json`

**Step 1: Install go-i18n**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go get github.com/nicksnyder/go-i18n/v2/i18n`

**Step 2: Create translation files**

Create `bot/internal/i18n/locales/active.ru.json` with ALL bot strings extracted from `messages.go` (lines 89-642) and API error messages. Key structure:

```json
{
  "Welcome.Client": "Добро пожаловать! Нажмите кнопку ниже, чтобы открыть приложение для записи.",
  "Welcome.Trainer": "👋 С возвращением!\n\n🔧 Панель управления — настройки, расписание и записи клиентов.\n📅 Записаться — посмотреть как видят бота ваши клиенты.",
  "Help.Client": "Это бот для онлайн-записи к тренеру.\n\nЧто можно делать:\n• Выбрать удобную дату и время\n• Записаться на тренировку\n• Посмотреть и отменить свои записи\n• Создать регулярное расписание\n\nНажмите кнопку «Запись» внизу или /start чтобы открыть приложение.",
  "Help.Trainer": "Вы — владелец этого бота.\n\nКак настроить:\n1. Откройте «Управление» — Профиль — заполните имя, фото, описание\n2. Услуги и цены — добавьте виды тренировок\n3. Расписание — укажите рабочие часы\n4. Выходные дни — отметьте нерабочие даты\n\nКак работает запись:\n• Клиент записывается — вы получаете уведомление\n• Подтвердите или отклоните прямо в чате\n• Все записи видны в панели управления\n\nСсылка для клиентов (отправьте им):\n<code>%s</code>\n\nКоманды:\n/start — Главное меню\n/admin — Панель управления\n/help — Эта справка",

  "Btn.OpenApp": "Запись",
  "Btn.OpenAdmin": "Управление",
  "Btn.Confirm": "✅ Подтвердить",
  "Btn.Reject": "❌ Отклонить",
  "Btn.Accept": "✅ Принять",
  "Btn.Decline": "❌ Отклонить",

  "Booking.New": "📅 Новая заявка на запись\n\n👤 Клиент: {{.ClientName}}\n📋 {{.Service}}\n🕐 Время: {{.DateTime}}",
  "Booking.NewWithMessage": "📅 Новая заявка на запись\n\n👤 Клиент: {{.ClientName}}\n📋 {{.Service}}\n🕐 Время: {{.DateTime}}\n💬 Сообщение: {{.Message}}",
  "Booking.ConfirmedTrainer": "✅ Запись подтверждена\n\n👤 Клиент: {{.ClientName}}\n📋 {{.Service}}\n🕐 Время: {{.DateTime}}",
  "Booking.RejectedTrainer": "❌ Запись отклонена\n\n👤 Клиент: {{.ClientName}}\n📋 {{.Service}}\n🕐 Время: {{.DateTime}}",
  "Booking.ConfirmedClient": "✅ Ваша запись подтверждена!\n\n📋 {{.Service}}\n🕐 {{.DateTime}}",
  "Booking.RejectedClient": "❌ К сожалению, ваша заявка отклонена",
  "Booking.RejectedClientWithReason": "❌ К сожалению, ваша заявка отклонена\n\n💬 Причина: {{.Reason}}",
  "Booking.RejectedClientRetry": "\n\nПопробуйте выбрать другое время.",
  "Booking.CancelledByTrainerClient": "❌ Ваша запись отменена тренером\n\n📋 {{.Service}}\n🕐 {{.DateTime}}",
  "Booking.CancelledByTrainerClientRetry": "\n\nВы можете записаться на другое время.",
  "Booking.PendingClient": "⏳ Ваша заявка отправлена!\n\n📋 {{.Service}}\n🕐 {{.DateTime}}\n\nОжидайте подтверждения от тренера.",
  "Booking.ReminderClient": "🔔 Напоминание: через 1 час у вас тренировка!\n\n📋 {{.Service}}\n🕐 {{.DateTime}}\n\nХорошей тренировки! 💪",
  "Booking.CancelledForTrainer": "❌ Клиент отменил запись\n\n👤 {{.ClientName}}\n📋 {{.Service}}\n🕐 {{.DateTime}}",
  "Booking.CancelledForClient": "❌ Тренер отменил вашу запись\n\n📋 {{.Service}}\n🕐 {{.DateTime}}",
  "Booking.CancelReason": "\n💬 Причина: {{.Reason}}",
  "Booking.TrainerCreatedClient": "📅 Тренер записал вас на тренировку\n\n📋 {{.Service}}\n🕐 {{.DateTime}}",
  "Booking.ClientAcceptedTrainer": "✅ Клиент подтвердил запись\n\n👤 Клиент: {{.ClientName}}\n📋 {{.Service}}\n🕐 {{.DateTime}}",
  "Booking.ClientDeclinedTrainer": "❌ Клиент отклонил запись\n\n👤 Клиент: {{.ClientName}}\n📋 {{.Service}}\n🕐 {{.DateTime}}",

  "Move.RequestForTrainer": "🔄 Запрос на перенос\n\n👤 {{.ClientName}}\n📋 {{.Service}}\n🕐 Было: {{.OldDateTime}}\n🕐 Новое: {{.NewDateTime}}",
  "Move.RequestForClient": "🔄 Тренер предлагает перенести тренировку\n\n📋 {{.Service}}\n🕐 Было: {{.OldDateTime}}\n🕐 Новое: {{.NewDateTime}}",
  "Move.Approved": "✅ Перенос подтверждён\n\n👤 {{.ClientName}}\n📋 {{.Service}}\n🕐 Было: {{.OldDateTime}}\n🕐 Новое: {{.NewDateTime}}",
  "Move.Declined": "↩️ Перенос отклонён\n\n👤 {{.ClientName}}\n📋 {{.Service}}\n🕐 {{.DateTime}}\n\nТренировка остаётся в расписании.",

  "Recurring.Request": "🔄 Новое расписание\n\n👤 {{.ClientName}}\n📋 {{.Service}}\n📅 {{.Schedule}}\n📆 {{.DateRange}}",
  "Recurring.RequestForClient": "📅 Тренер предлагает регулярное расписание\n\n📋 {{.Service}}\n📅 {{.Schedule}}\n📆 {{.DateRange}}",
  "Recurring.Approved": "✅ Расписание подтверждено\n\n👤 {{.ClientName}}\n📋 {{.Service}}\n📅 {{.Schedule}}\n📆 {{.DateRange}}\n📊 {{.Count}} записей создано",
  "Recurring.ApprovedClient": "✅ Ваше расписание подтверждено!\n\n📋 {{.Service}}\n📅 {{.Schedule}}\n📆 {{.DateRange}}\n📊 {{.Count}} записей создано",
  "Recurring.Declined": "❌ Расписание отклонено\n\n👤 {{.ClientName}}\n📋 {{.Service}}\n📅 {{.Schedule}}\n📆 {{.DateRange}}",
  "Recurring.DeclinedClient": "❌ К сожалению, ваше расписание отклонено\n\n📋 {{.Service}}\n📅 {{.Schedule}}\n📆 {{.DateRange}}",
  "Recurring.WorkoutCount": { "one": "\n📊 {{.Count}} тренировка", "few": "\n📊 {{.Count}} тренировки", "many": "\n📊 {{.Count}} тренировок", "other": "\n📊 {{.Count}} тренировок" },

  "Hint.OpenApp": "\n\nОткройте приложение для подтверждения или отклонения.",
  "Hint.DefaultWorkout": "Тренировка",

  "Callback.UseApp": "Используйте приложение",
  "Callback.NotFound": "Запись не найдена",
  "Callback.AlreadyProcessed": "Заявка уже обработана",
  "Callback.Error": "Ошибка, попробуйте через приложение",
  "Callback.Confirmed": "✅ Запись подтверждена",
  "Callback.Rejected": "❌ Запись отклонена",

  "Handler.ConfigError": "Ошибка конфигурации бота",
  "Handler.TrainerOnly": "⛔ Эта команда доступна только тренеру.",

  "Date.Sun": "Вс", "Date.Mon": "Пн", "Date.Tue": "Вт", "Date.Wed": "Ср", "Date.Thu": "Чт", "Date.Fri": "Пт", "Date.Sat": "Сб",
  "Date.Jan": "янв", "Date.Feb": "фев", "Date.Mar": "мар", "Date.Apr": "апр", "Date.May": "мая", "Date.Jun": "июн",
  "Date.Jul": "июл", "Date.Aug": "авг", "Date.Sep": "сен", "Date.Oct": "окт", "Date.Nov": "ноя", "Date.Dec": "дек",
  "Duration.Hour": "ч",

  "Version": "\n\n📌 Версия {{.Version}}",
  "Changelog": "\n🆕 Что нового:\n{{.Changelog}}",
  "BotFatherLink": "\n\n⚙️ Ссылка для настройки Menu Button в @BotFather:\n<code>{{.URL}}</code>",

  "Lang.Choose": "🌐 Выберите язык / Choose language:",
  "Lang.Russian": "🇷🇺 Русский",
  "Lang.English": "🇬🇧 English",

  "Error.NotFound": "Не найдено",
  "Error.Unauthorized": "Необходима авторизация",
  "Error.TelegramAuth": "Ошибка авторизации Telegram",
  "Error.Forbidden": "Нет доступа",
  "Error.Internal": "Внутренняя ошибка сервера",
  "Error.BadRequest": "Неверный формат запроса",
  "Error.BadDate": "Неверный формат даты",
  "Error.FieldTooLong": "Превышена максимальная длина поля",
  "Error.BookingNotFound": "Запись не найдена",
  "Error.BookingConflict": "Это время уже занято",
  "Error.BookingDuplicate": "У вас уже есть запись на этот день",
  "Error.BookingCannotCancel": "Запись не может быть отменена",
  "Error.BookingCannotReject": "Запись не может быть отклонена",
  "Error.BookingCannotConfirm": "Запись не может быть подтверждена",
  "Error.BookingCannotReschedule": "Запись не может быть перенесена",
  "Error.ClientNotFound": "Клиент не найден",
  "Error.ClientSelect": "Выберите клиента",
  "Error.TrainerNotFound": "Тренер не найден",
  "Error.TrainerNotConfigured": "Тренер не настроен",
  "Error.ServiceNotFound": "Услуга не найдена",
  "Error.NoServices": "Нет настроенных услуг",
  "Error.ScheduleNotFound": "Расписание не найдено",
  "Error.ScheduleProcessed": "Расписание уже обработано",
  "Error.ScheduleCancelled": "Расписание уже отменено",
  "Error.ScheduleCannotCancel": "Расписание не может быть отменено",
  "Error.DayOffDuplicate": "Выходной на эту дату уже добавлен",
  "Error.NoMoveRequest": "Нет запроса на перенос",
  "Error.DeleteClientBookings": "Не удалось удалить клиента. Возможно, у него есть записи.",
  "Error.BookingCannotModify": "Нельзя изменить эту запись",
  "Error.MissingDate": "Укажите дату",
  "Error.MissingDateTime": "Укажите дату и время",
  "Error.MissingTimeRange": "Укажите время начала и окончания",
  "Error.MissingDuration": "Укажите длительность",
  "Error.MissingClientName": "Укажите имя клиента",
  "Error.InvalidDuration": "Неверная длительность",
  "Error.InvalidDayOfWeek": "Неверный день недели",
  "Error.InvalidBookingID": "Неверный ID записи",
  "Error.InvalidStatus": "Неверный статус",
  "Error.DayOfWeekRange": "День недели должен быть от 0 до 6",

  "Master.Welcome": "👋 Привет! Я помогу создать бота для онлайн-записи ваших клиентов.\n\n🎯 Что вы получите:\n• Личный бот с вашим именем (@vashe_imya_bot)\n• Клиенты записываются сами — вы только подтверждаете\n• Календарь, услуги и цены — всё настраивается\n• Уведомления о новых записях прямо в Telegram\n\n⏱ Настройка займёт 2 минуты.\n\n📝 Первый шаг — создать бота в Telegram:\n\n1. Откройте @BotFather (нажмите на ссылку)\n2. Отправьте команду /newbot\n3. Введите название (например: \"Тренер Иван\")\n4. Введите username (например: trener_ivan_bot)\n5. Скопируйте токен — длинную строку с цифрами и буквами\n\nОтправьте мне токен вашего бота:",
  "Master.Help": "🤖 Этот бот помогает создать бота для записи клиентов.\n\nКоманды:\n/start - Начать создание бота\n/cancel - Отменить текущую операцию\n\nЕсли у вас уже есть бот, отправьте /start чтобы проверить статус.",
  "Master.HelpAdmin": "🤖 Этот бот помогает создать бота для записи клиентов.\n\nКоманды:\n/start - Начать создание бота\n/cancel - Отменить текущую операцию\n\n👑 Админ-команды:\n/trainers - Список всех тренеров\n/stats - Статистика",
  "Master.Unknown": "Не понимаю. Используйте /start чтобы начать или /help для справки.",
  "Master.Error": "❌ Произошла ошибка. Попробуйте позже.",
  "Master.Cancelled": "❌ Отменено. Отправьте /start чтобы начать заново.",
  "Master.InvalidToken": "❌ Неверный токен. Убедитесь, что вы скопировали токен полностью из сообщения BotFather.\n\nТокен выглядит примерно так:\n123456789:ABCdefGHIjklMNOpqrsTUVwxyz\n\nПопробуйте ещё раз:",
  "Master.TokenAlreadyUsed": "❌ Этот бот уже зарегистрирован. Если это ваш бот, обратитесь в поддержку.",
  "Master.TokenAccepted": "✅ Бот @%s найден.\n\n⚠️ Регистрация ещё не завершена! Чтобы бот заработал, введите ваше имя (как вас будут видеть клиенты):",
  "Master.NameTooShort": "❌ Имя слишком короткое. Введите ваше полное имя:",
  "Master.Success": "🎉 Поздравляем, %s!\n\nВаш бот @%s готов к работе.\n\n🚀 Что делать дальше:\n\n1️⃣ Откройте @%s → отправьте /start\n2️⃣ Настройте услуги и расписание под себя\n3️⃣ Отправьте ссылку t.me/%s клиентам\n\nКлиенты смогут выбрать время и записаться, а вы получите уведомление с кнопками \"Подтвердить\" или \"Отклонить\".\n\nУдачи! 💪",
  "Master.AlreadyRegistered": "✅ У вас уже есть бот: @%s\n\nОткройте его и отправьте /start чтобы использовать.",
  "Master.RegistrationFailed": "⚠️ Бот @%s создан, но не удалось запустить обработку сообщений.\n\nПопробуйте отправить /start ещё раз — система попробует подключить бота повторно. Если не поможет — напишите в поддержку."
}
```

Create `bot/internal/i18n/locales/active.en.json` with English translations for every key above. Use natural English (not machine-translated). Key examples:
- `"Welcome.Client"`: `"Welcome! Press the button below to open the booking app."`
- `"Booking.New"`: `"📅 New booking request\n\n👤 Client: {{.ClientName}}\n📋 {{.Service}}\n🕐 Time: {{.DateTime}}"`
- `"Error.Internal"`: `"Internal server error"`
- `"Btn.OpenApp"`: `"Book"`
- `"Btn.OpenAdmin"`: `"Manage"`
- ALL keys must exist in both files

**Step 3: Create i18n.go module**

Create `bot/internal/i18n/i18n.go`:

```go
package i18n

import (
	"context"
	"embed"
	"encoding/json"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"golang.org/x/text/language"
)

//go:embed locales/active.*.json
var localeFS embed.FS

var bundle *i18n.Bundle

type localizerKey struct{}

func Init() error {
	bundle = i18n.NewBundle(language.Russian)
	bundle.RegisterUnmarshalFunc("json", json.Unmarshal)

	if _, err := bundle.LoadMessageFileFS(localeFS, "locales/active.ru.json"); err != nil {
		return err
	}
	if _, err := bundle.LoadMessageFileFS(localeFS, "locales/active.en.json"); err != nil {
		return err
	}
	return nil
}

func NewLocalizer(langs ...string) *i18n.Localizer {
	return i18n.NewLocalizer(bundle, langs...)
}

func Default() *i18n.Localizer {
	return i18n.NewLocalizer(bundle, "ru")
}

func WithLocalizer(ctx context.Context, loc *i18n.Localizer) context.Context {
	return context.WithValue(ctx, localizerKey{}, loc)
}

func L(ctx context.Context) *i18n.Localizer {
	if loc, ok := ctx.Value(localizerKey{}).(*i18n.Localizer); ok {
		return loc
	}
	return Default()
}

func T(loc *i18n.Localizer, messageID string) string {
	s, err := loc.Localize(&i18n.LocalizeConfig{MessageID: messageID})
	if err != nil {
		return messageID
	}
	return s
}

func Tf(loc *i18n.Localizer, messageID string, data map[string]interface{}) string {
	s, err := loc.Localize(&i18n.LocalizeConfig{
		MessageID:    messageID,
		TemplateData: data,
	})
	if err != nil {
		return messageID
	}
	return s
}

func Tp(loc *i18n.Localizer, messageID string, count int, data map[string]interface{}) string {
	s, err := loc.Localize(&i18n.LocalizeConfig{
		MessageID:    messageID,
		PluralCount:  count,
		TemplateData: data,
	})
	if err != nil {
		return messageID
	}
	return s
}
```

**Step 4: Verify build**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`
Expected: Success

**Step 5: Commit**

```
feat: add go-i18n core module with ru/en translation files
```

---

## Task 3: Bot — Integrate i18n into Telegram Handlers

**Files:**
- Modify: `bot/internal/telegram/messages.go` (refactor Format functions to accept localizer)
- Modify: `bot/internal/telegram/handlers.go:49-93` (handleStart language selection)
- Modify: `bot/internal/telegram/master.go` (master bot messages)
- Modify: `bot/main.go` (init i18n)

**Step 1: Initialize i18n in main.go**

In `bot/main.go`, add import and call `i18n.Init()` early in `main()`:
```go
import myI18n "scheduler-bot/internal/i18n"

// In main(), before any handler setup:
if err := myI18n.Init(); err != nil {
    log.Fatalf("Failed to load translations: %v", err)
}
```

**Step 2: Refactor messages.go Format functions**

Add `*i18n.Localizer` as first parameter to every Format function. Replace hardcoded Russian strings with `i18n.T()` / `i18n.Tf()` calls.

Example refactoring for `FormatNewBookingMessage`:
```go
func FormatNewBookingMessage(loc *i18n.Localizer, booking *models.Booking) string {
    data := map[string]interface{}{
        "ClientName": booking.ClientName,
        "Service":    bookingServiceDisplay(loc, booking),
        "DateTime":   formatDateTime(loc, booking.StartsAt),
    }
    msg := myI18n.Tf(loc, "Booking.New", data)
    if booking.ClientMessage != "" {
        msg += "\n💬 " + myI18n.T(loc, "Label.Message") + ": " + booking.ClientMessage
    }
    return msg
}
```

Refactor `formatDateTime`, `weekdayNames`, `monthNames`, `dayNamesShort` to use locale-aware lookups:
```go
func formatDateTime(loc *i18n.Localizer, t time.Time) string {
    weekdays := []string{"Date.Sun", "Date.Mon", "Date.Tue", "Date.Wed", "Date.Thu", "Date.Fri", "Date.Sat"}
    months := []string{"", "Date.Jan", "Date.Feb", "Date.Mar", "Date.Apr", "Date.May", "Date.Jun", "Date.Jul", "Date.Aug", "Date.Sep", "Date.Oct", "Date.Nov", "Date.Dec"}
    return fmt.Sprintf("%s, %d %s %02d:%02d",
        myI18n.T(loc, weekdays[t.Weekday()]),
        t.Day(),
        myI18n.T(loc, months[t.Month()]),
        t.Hour(),
        t.Minute(),
    )
}
```

Apply the same pattern to ALL ~26 Format functions. Each gets `loc *i18n.Localizer` as first param.

**Step 3: Update all callers in handlers.go**

Every call site that invokes a Format function must now pass a localizer. In `handleStart`:
```go
// Create localizer from user's stored language or Telegram language_code
lang := "ru"
if client != nil && client.Language != "" {
    lang = client.Language
} else if msg.From.LanguageCode != "" {
    lang = msg.From.LanguageCode
}
loc := myI18n.NewLocalizer(lang)
```

**Step 4: Add language selection on first /start**

In `handleStart`, for new clients (after trainer lookup, before client welcome):
```go
// For new users, show language selection inline keyboard
client, _ := db.GetClientByTelegramID(msg.From.ID, trainer.ID)
if client == nil {
    // New user — ask language preference
    keyboard := &InlineKeyboardMarkup{
        InlineKeyboard: [][]InlineKeyboardButton{
            {
                {Text: "🇷🇺 Русский", CallbackData: "lang:ru:" + trainer.ID},
                {Text: "🇬🇧 English", CallbackData: "lang:en:" + trainer.ID},
            },
        },
    }
    _, _ = h.Bot.SendMessage(msg.Chat.ID, "🌐 Выберите язык / Choose language:", keyboard)
    return
}
```

Add callback handler for `lang:` prefix in `handleCallbackQuery`:
```go
if strings.HasPrefix(data, "lang:") {
    parts := strings.SplitN(data, ":", 3)
    lang := parts[1]
    trainerID := parts[2]
    // Create client with chosen language
    client, err := db.GetOrCreateClient(update.CallbackQuery.From.ID, trainerID, update.CallbackQuery.From.FirstName)
    if err == nil && client != nil {
        db.UpdateClientLanguage(client.ID, lang)
    }
    // Send welcome in chosen language
    loc := myI18n.NewLocalizer(lang)
    // ... send welcome message using loc
}
```

**Step 5: Update master.go to use i18n**

Replace all `MasterMsgXxx` constant references with `myI18n.T(loc, "Master.Xxx")`. Create localizer from `msg.From.LanguageCode` for master bot (no DB record during onboarding).

**Step 6: Update all notification callbacks in main.go**

Each notification callback (4 total) creates a localizer from the **recipient's** language:
```go
// For client notifications:
loc := myI18n.NewLocalizer(client.Language)
// For trainer notifications:
loc := myI18n.NewLocalizer(trainer.Language)
```

**Step 7: Verify build and test**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`

**Step 8: Commit**

```
feat: integrate go-i18n into all Telegram handlers and messages
```

---

## Task 4: Bot — Localize API Error Messages

**Files:**
- Modify: `bot/internal/api/middleware.go` (add i18n middleware)
- Modify: `bot/internal/api/router.go` (wire middleware)
- Modify: `bot/internal/api/handlers.go` (replace hardcoded error strings)
- Modify: `bot/internal/api/admin_handlers.go` (same)
- Modify: `bot/internal/api/recurring_handlers.go` (same)

**Step 1: Add i18n middleware**

In `bot/internal/api/middleware.go`, add:
```go
func I18nMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        lang := "ru"
        if client := GetClientFromContext(r); client != nil {
            lang = client.Language
        } else if trainer := GetTrainerFromContext(r); trainer != nil {
            lang = trainer.Language
        }
        loc := myI18n.NewLocalizer(lang)
        ctx := myI18n.WithLocalizer(r.Context(), loc)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

**Note:** This middleware must run AFTER auth middleware (needs client/trainer in context). Wire it in `router.go` after `TelegramAuthMiddleware`.

**Step 2: Create localized error helper**

Add helper in `handlers.go`:
```go
func httpError(w http.ResponseWriter, r *http.Request, msgID string, code int) {
    loc := myI18n.L(r.Context())
    http.Error(w, myI18n.T(loc, msgID), code)
}
```

**Step 3: Replace all `http.Error(w, "Russian string", code)` with `httpError(w, r, "Error.XXX", code)`**

Across all 3 handler files (~52 error messages). Example:
```go
// Before:
http.Error(w, "Запись не найдена", http.StatusNotFound)
// After:
httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
```

**Step 4: Add `language` to profile responses**

In `handlers.go` `ClientProfileResponse` struct (line 503), add:
```go
Language            string `json:"language"`
```
Populate it in `HandleGetClientProfile` and `HandleUpdateClientProfile`.

In `handlers.go` `TrainerResponse` struct (line 36), add:
```go
Language    string  `json:"language,omitempty"`
```
Populate it in `HandleGetProfile` (admin) and `HandleGetTrainer` (public — only for admin context).

**Step 5: Accept `language` in profile update requests**

In `handlers.go` `UpdateClientProfileRequest` (line 515), add:
```go
Language          string `json:"language,omitempty"`
```
In `HandleUpdateClientProfile`, if `req.Language` is `"ru"` or `"en"`, call `db.UpdateClientLanguage()`.

In `admin_handlers.go` `UpdateProfileRequest` (line 872), add:
```go
Language       string   `json:"language,omitempty"`
```
In `HandleUpdateProfile`, if `req.Language` is `"ru"` or `"en"`, call `db.UpdateTrainerLanguage()`.

**Step 6: Verify build**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`

**Step 7: Commit**

```
feat: localize API error messages, add language to profile endpoints
```

---

## Task 5: Mini-App — next-intl Setup

**Files:**
- Modify: `mini-app/next.config.ts`
- Create: `mini-app/src/i18n/request.ts`
- Create: `mini-app/src/middleware.ts`
- Create: `mini-app/src/actions/locale.ts`
- Modify: `mini-app/src/app/layout.tsx`
- Create: `mini-app/messages/ru.json`
- Create: `mini-app/messages/en.json`

**Step 1: Install next-intl**

Run: `cd /Users/user/Documents/karlen/scheduler/mini-app && bun add next-intl`

**Step 2: Update next.config.ts**

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  output: "standalone",
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
```

**Step 3: Create i18n/request.ts**

```ts
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const supportedLocales = ["ru", "en"];

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("locale")?.value || "ru";
  const locale = supportedLocales.includes(raw) ? raw : "ru";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

**Step 4: Create middleware.ts (thin, for ?lang= cookie setting)**

```ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang");
  const hasLocaleCookie = request.cookies.has("locale");

  if (lang && !hasLocaleCookie && ["ru", "en"].includes(lang)) {
    const url = new URL(request.url);
    url.searchParams.delete("lang");
    const response = NextResponse.redirect(url);
    response.cookies.set("locale", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
```

**Step 5: Create server action for locale switching**

Create `mini-app/src/actions/locale.ts`:
```ts
"use server";

import { cookies } from "next/headers";

export async function setLocale(locale: string) {
  const supported = ["ru", "en"];
  const safe = supported.includes(locale) ? locale : "ru";
  const store = await cookies();
  store.set("locale", safe, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}
```

**Step 6: Update layout.tsx**

Make it async, add NextIntlClientProvider:
```tsx
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SWRProvider } from "@/hooks/swr";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scheduler",
  description: "Online booking",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=localStorage.getItem('theme-preference'),r=document.documentElement,s=r.style;if(p==='dark'){r.classList.add('dark');s.setProperty('--tg-theme-bg-color','#1e1e1e');s.setProperty('--tg-theme-text-color','#ffffff');s.setProperty('--tg-theme-hint-color','#999999');s.setProperty('--tg-theme-secondary-bg-color','#2a2a2a')}else if(p==='light'){r.classList.remove('dark');s.setProperty('--tg-theme-bg-color','#ffffff');s.setProperty('--tg-theme-text-color','#000000');s.setProperty('--tg-theme-secondary-bg-color','#efeff4')}else{var t=window.Telegram&&window.Telegram.WebApp;if(t&&t.colorScheme==='dark'){r.classList.add('dark')}}}catch(e){}})()` }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SWRProvider>
            {children}
          </SWRProvider>
        </NextIntlClientProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
```

**Step 7: Create initial message files**

Create `mini-app/messages/ru.json` and `mini-app/messages/en.json` with a minimal test key:
```json
{
  "Common": {
    "save": "Сохранить",
    "saving": "Сохранение...",
    "cancel": "Отмена",
    "loading": "Загрузка..."
  }
}
```

**Step 8: Verify build**

Run: `cd /Users/user/Documents/karlen/scheduler/mini-app && bun run build`
Expected: Success

**Step 9: Commit**

```
feat: setup next-intl with cookie-based locale detection and middleware
```

---

## Task 6: Mini-App — Translation Files (Full)

**Files:**
- Modify: `mini-app/messages/ru.json` (complete all ~350 strings)
- Modify: `mini-app/messages/en.json` (complete all ~350 strings)

**Step 1: Create complete ru.json**

Extract ALL hardcoded Russian strings from every page and component into namespaced JSON. Key namespaces:

- `Common` — save, cancel, loading, back, confirm, delete, error, success
- `Status` — pending, confirmed, rejected, cancelled, completed, cancelRequested, reschedulePending, active, declined
- `Navigation` — bookings, book, profile, schedule (tab bar labels)
- `Dates` — months short (12), months full (12), days short (7), days full (7)
- `Duration` — hour unit, minute unit, formatting patterns
- `HomePage` — all strings from `(client)/page.tsx`
- `BookingForm` — all strings from `BookingForm.tsx` (~60)
- `BookingsPage` — all strings from `bookings/page.tsx`
- `RecurringPage` — strings from recurring pages
- `ProfilePage` — strings from client profile
- `ServicesPage` — strings from services page
- `AdminDashboard` — admin main page
- `AdminSettings` — settings menu items
- `AdminProfile` — admin profile form
- `AdminSchedule` — schedule settings
- `AdminServices` — services management
- `AdminDaysOff` — days off page
- `AdminNotifications` — notification settings
- `AdminClients` — clients list
- `AdminHelp` — help page with FAQ
- `Errors` — toast error messages
- `Success` — toast success messages

Every string currently hardcoded in JSX/TSX must have a key in both files.

**Step 2: Create complete en.json**

Natural English translations for every key. Not machine-translated — proper phrasing.

**Step 3: Verify both files parse**

Run: `cd /Users/user/Documents/karlen/scheduler/mini-app && node -e "require('./messages/ru.json'); require('./messages/en.json'); console.log('OK')"`

**Step 4: Commit**

```
feat: add complete ru/en translation files for mini-app (~350 strings each)
```

---

## Task 7: Mini-App — Replace Hardcoded Strings in Components

**Files:**
- Modify: `mini-app/src/components/StatusBadge.tsx`
- Modify: `mini-app/src/components/BookingCard.tsx`
- Modify: `mini-app/src/components/PendingBookingCard.tsx`
- Modify: `mini-app/src/components/ConfirmDialog.tsx`
- Modify: `mini-app/src/components/ThemeSelector.tsx`
- Modify: `mini-app/src/components/DurationSelector.tsx`
- Modify: `mini-app/src/components/Calendar.tsx`
- Modify: `mini-app/src/components/MonthCalendar.tsx`
- Modify: `mini-app/src/components/WeekGrid.tsx`
- Modify: `mini-app/src/components/BookingForm.tsx`
- Modify: `mini-app/src/components/RecurringScheduleCard.tsx`
- Modify: `mini-app/src/components/BottomTabBar.tsx`
- Modify: `mini-app/src/components/TopBar.tsx`
- Modify: Any other components with hardcoded Russian text

**Step 1: Pattern for each component**

Add `import { useTranslations } from "next-intl"` and `const t = useTranslations("Namespace")` at the top. Replace every hardcoded string with `t("key")`.

Example for StatusBadge:
```tsx
import { useTranslations } from "next-intl";

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("Status");
  // status keys match: "pending", "confirmed", etc.
  return <span>{t(status)}</span>;
}
```

Example for Calendar month/day names:
```tsx
const t = useTranslations("Dates");
const monthNames = [t("jan"), t("feb"), t("mar"), ...];
const dayNames = [t("mon"), t("tue"), ...];
```

**Step 2: Replace toLocaleString("ru-RU") with dynamic locale**

```tsx
import { useLocale } from "next-intl";
const locale = useLocale();
price.toLocaleString(locale === "en" ? "en-US" : "ru-RU")
```

**Step 3: Verify build**

Run: `cd /Users/user/Documents/karlen/scheduler/mini-app && bun run build`

**Step 4: Commit**

```
feat: replace hardcoded strings in components with next-intl translations
```

---

## Task 8: Mini-App — Replace Hardcoded Strings in Pages

**Files:**
- Modify: ALL page files in `mini-app/src/app/`
- Both `(client)/` pages and `admin/` pages

**Step 1: Client pages**

For each client page (`page.tsx`, `profile/page.tsx`, `bookings/page.tsx`, `book/page.tsx`, `services/page.tsx`, `recurring/page.tsx`, `recurring/[id]/page.tsx`):
- Add `useTranslations` with page-specific namespace
- Replace all hardcoded strings
- Replace toast messages with translated versions

**Step 2: Admin pages**

For each admin page (`page.tsx`, `clients/page.tsx`, `settings/page.tsx`, `settings/profile/page.tsx`, `settings/schedule/page.tsx`, `settings/services/page.tsx`, `settings/days-off/page.tsx`, `settings/notifications/page.tsx`, `settings/help/page.tsx`):
- Same pattern as client pages
- FAQ content in help page goes under `AdminHelp.faq.q1`, `AdminHelp.faq.a1`, etc.

**Step 3: Verify build**

Run: `cd /Users/user/Documents/karlen/scheduler/mini-app && bun run build`

**Step 4: Commit**

```
feat: replace hardcoded strings in all pages with next-intl translations
```

---

## Task 9: Mini-App — Language Selector Component + Settings Integration

**Files:**
- Create: `mini-app/src/components/LanguageSelector.tsx`
- Modify: `mini-app/src/app/(client)/profile/page.tsx`
- Modify: `mini-app/src/app/admin/settings/notifications/page.tsx`
- Modify: `mini-app/src/lib/types.ts`
- Modify: `mini-app/src/lib/api.ts`

**Step 1: Add `language` to TypeScript types**

In `mini-app/src/lib/types.ts`, add to `ClientProfile` (line 56):
```ts
language?: string;
```

Add to `Trainer` (line 1):
```ts
language?: string;
```

**Step 2: Update API client**

In `mini-app/src/lib/api.ts`, update `updateProfile` to accept `language`:
```ts
async updateProfile(data: { name?: string; phone?: string; preferredDuration?: number; language?: string }): Promise<ClientProfile> {
```

Add admin profile language update if not already present.

**Step 3: Create LanguageSelector component**

```tsx
"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/actions/locale";
import { api } from "@/lib/api";

const options = [
  { value: "ru", label: "🇷🇺 RU" },
  { value: "en", label: "🇬🇧 EN" },
];

export function LanguageSelector({ isAdmin }: { isAdmin?: boolean }) {
  const locale = useLocale();
  const router = useRouter();

  const handleSelect = async (lang: string) => {
    if (lang === locale) return;
    // Update DB
    if (isAdmin) {
      await api.updateAdminProfile({ language: lang });
    } else {
      await api.updateProfile({ language: lang });
    }
    // Update cookie
    await setLocale(lang);
    // Re-render
    router.refresh();
  };

  return (
    <div className="flex gap-1 bg-card rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => handleSelect(opt.value)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            locale === opt.value
              ? "bg-brand text-white"
              : "text-muted-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 4: Add to client profile page**

After the theme selector section, add a language section:
```tsx
<div className="bg-card rounded-2xl p-4">
  <h3 className="text-sm font-medium text-secondary mb-3">{t("language")}</h3>
  <LanguageSelector />
</div>
```

**Step 5: Add to admin notifications page**

Same pattern, after theme selector:
```tsx
<div className="bg-card rounded-2xl p-4">
  <h3 className="text-sm font-medium text-secondary mb-3">{t("language")}</h3>
  <LanguageSelector isAdmin />
</div>
```

**Step 6: Add cross-device sync**

In a shared hook or in profile pages, compare SWR profile `language` vs current locale cookie:
```tsx
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/actions/locale";

// Inside profile page useEffect or a dedicated hook:
const locale = useLocale();
useEffect(() => {
  if (profile?.language && profile.language !== locale) {
    setLocale(profile.language).then(() => router.refresh());
  }
}, [profile?.language]);
```

**Step 7: Verify build**

Run: `cd /Users/user/Documents/karlen/scheduler/mini-app && bun run build`

**Step 8: Commit**

```
feat: add LanguageSelector component and integrate into settings pages
```

---

## Task 10: Bot — Add `?lang=` to Mini-App URLs

**Files:**
- Modify: `bot/internal/telegram/handlers.go:49-93` (handleStart)

**Step 1: Append `&lang=` to all mini-app URLs**

In `handleStart`, after determining the user's language, append it to URLs:
```go
lang := client.Language
if lang == "" {
    lang = "ru"
}

// For trainer:
adminURL := h.WebAppURL + "/admin?trainer=" + trainer.ID + "&lang=" + lang
clientURL := h.WebAppURL + "?trainer=" + trainer.ID + "&lang=" + lang

// For client:
webAppURL := h.WebAppURL + "?trainer=" + trainer.ID + "&lang=" + lang
```

Also update `SetChatMenuButton` URLs to include `&lang=`.

**Step 2: Same for language selection callback**

When user picks language via inline keyboard, the welcome message URLs include `&lang=`:
```go
webAppURL := h.WebAppURL + "?trainer=" + trainerID + "&lang=" + lang
```

**Step 3: Verify build**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`

**Step 4: Commit**

```
feat: pass user language as ?lang= param in mini-app URLs
```

---

## Task 11: Final Verification

**Step 1: Build both**

```bash
cd /Users/user/Documents/karlen/scheduler/bot && go build ./...
cd /Users/user/Documents/karlen/scheduler/mini-app && bun run build
```

**Step 2: Lint mini-app**

Run: `cd /Users/user/Documents/karlen/scheduler/mini-app && bun lint`
Fix any issues.

**Step 3: Verify no remaining hardcoded Russian in components**

Search for Cyrillic text in tsx/ts files (excluding messages/ dir):
```bash
grep -r '[а-яА-Я]' mini-app/src/ --include='*.tsx' --include='*.ts' | grep -v 'node_modules' | grep -v '.next'
```
Any remaining Russian text that isn't in a comment or import path needs to be extracted.

**Step 4: Verify all message keys used in code exist in both JSON files**

Spot check key namespaces match usage.

**Step 5: Final commit**

```
chore: final i18n cleanup and verification
```
