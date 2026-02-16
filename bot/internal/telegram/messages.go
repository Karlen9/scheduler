package telegram

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"scheduler-bot/internal/models"
)

// Russian weekday names
var weekdayNames = map[time.Weekday]string{
	time.Sunday:    "Вс",
	time.Monday:    "Пн",
	time.Tuesday:   "Вт",
	time.Wednesday: "Ср",
	time.Thursday:  "Чт",
	time.Friday:    "Пт",
	time.Saturday:  "Сб",
}

// Russian month names
var monthNames = map[time.Month]string{
	time.January:   "янв",
	time.February:  "фев",
	time.March:     "мар",
	time.April:     "апр",
	time.May:       "мая",
	time.June:      "июн",
	time.July:      "июл",
	time.August:    "авг",
	time.September: "сен",
	time.October:   "окт",
	time.November:  "ноя",
	time.December:  "дек",
}

func formatDateTime(t time.Time) string {
	return fmt.Sprintf("%s, %d %s %02d:%02d",
		weekdayNames[t.Weekday()],
		t.Day(),
		monthNames[t.Month()],
		t.Hour(),
		t.Minute(),
	)
}

func formatPrice(price int, currency string) string {
	return fmt.Sprintf("%d %s", price, currency)
}

func formatDuration(minutes int) string {
	if minutes <= 0 {
		return ""
	}
	hours := float64(minutes) / 60.0
	if hours == float64(int(hours)) {
		return fmt.Sprintf("%d ч", int(hours))
	}
	return fmt.Sprintf("%.1g ч", hours)
}

func bookingDurationDisplay(booking *models.Booking) string {
	if booking.SessionType != nil {
		return booking.SessionType.Name
	}
	if booking.DurationMinutes > 0 {
		return formatDuration(booking.DurationMinutes)
	}
	return "Тренировка"
}

func bookingServiceDisplay(booking *models.Booking) string {
	if booking.SessionType != nil {
		if booking.DurationMinutes > 0 {
			return fmt.Sprintf("%s (%s)", booking.SessionType.Name, formatDuration(booking.DurationMinutes))
		}
		return booking.SessionType.Name
	}
	if booking.DurationMinutes > 0 {
		return fmt.Sprintf("Тренировка %s", formatDuration(booking.DurationMinutes))
	}
	return "Тренировка"
}

// MsgWelcome is the welcome message for /start (clients).
// Use FormatWelcome() to include version info.
const MsgWelcome = "Добро пожаловать! Нажмите кнопку ниже, чтобы открыть приложение для записи."

// FormatWelcome creates a welcome message with version and changelog
func FormatWelcome(version, changelog string) string {
	if version == "" {
		return MsgWelcome
	}
	msg := MsgWelcome + fmt.Sprintf("\n\n📌 Версия %s", version)
	if changelog != "" {
		msg += "\n🆕 Что нового:\n" + changelog
	}
	return msg
}

// FormatWelcomeTrainer creates a trainer welcome message with version and changelog
func FormatWelcomeTrainer(version, changelog string) string {
	msg := `👋 С возвращением!

🔧 Панель управления — настройки, расписание и записи клиентов.
📅 Записаться — посмотреть как видят бота ваши клиенты.`

	if version != "" {
		msg += fmt.Sprintf("\n\n📌 Версия %s", version)
		if changelog != "" {
			msg += "\n🆕 Что нового:\n" + changelog
		}
	}
	return msg
}

// MsgHelp is the help message
const MsgHelp = `Используйте /start чтобы открыть приложение для записи.

Команды:
/start — Главное меню
/admin — Панель управления (только для тренера)
/help — Справка`

// BtnOpenApp is the button text for opening the mini-app
const BtnOpenApp = "📅 Записаться"

// BtnOpenAdmin is the button text for opening admin panel
const BtnOpenAdmin = "🔧 Панель управления"

// MsgOpenAppHint is the hint to open the app for actions
const MsgOpenAppHint = "\n\nОткройте приложение для подтверждения или отклонения."

// FormatNewBookingMessage creates a message for trainer about new booking request
func FormatNewBookingMessage(booking *models.Booking) string {
	msg := fmt.Sprintf(`📅 Новая заявка на запись

👤 Клиент: %s
📋 %s
🕐 Время: %s`,
		booking.ClientName,
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)

	if booking.ClientMessage != "" {
		msg += fmt.Sprintf("\n💬 Сообщение: %s", booking.ClientMessage)
	}

	return msg
}

// FormatBookingAcceptedTrainer creates a message for trainer after accepting
func FormatBookingAcceptedTrainer(booking *models.Booking) string {
	return fmt.Sprintf(`✅ Запись подтверждена

👤 Клиент: %s
📋 %s
🕐 Время: %s`,
		booking.ClientName,
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)
}

// FormatBookingRejectedTrainer creates a message for trainer after rejecting
func FormatBookingRejectedTrainer(booking *models.Booking) string {
	return fmt.Sprintf(`❌ Запись отклонена

👤 Клиент: %s
📋 %s
🕐 Время: %s`,
		booking.ClientName,
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)
}

// FormatBookingConfirmedClient creates a message for client when booking is confirmed
func FormatBookingConfirmedClient(booking *models.Booking) string {
	return fmt.Sprintf(`✅ Ваша запись подтверждена!

📋 %s
🕐 %s`,
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)
}

// FormatBookingRejectedClient creates a message for client when booking is rejected
func FormatBookingRejectedClient(booking *models.Booking) string {
	msg := `❌ К сожалению, ваша заявка отклонена`

	if booking.CancelReason != "" {
		msg += fmt.Sprintf("\n\n💬 Причина: %s", booking.CancelReason)
	}

	msg += "\n\nПопробуйте выбрать другое время."
	return msg
}

// FormatBookingCancelledByTrainerClient creates a message for client when trainer cancels a booking
func FormatBookingCancelledByTrainerClient(booking *models.Booking) string {
	msg := fmt.Sprintf(`❌ Ваша запись отменена тренером

📋 %s
🕐 %s`,
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)

	if booking.CancelReason != "" {
		msg += fmt.Sprintf("\n\n💬 Причина: %s", booking.CancelReason)
	}

	msg += "\n\nВы можете записаться на другое время."
	return msg
}

// FormatBookingPendingClient creates a message for client after booking creation
func FormatBookingPendingClient(booking *models.Booking) string {
	return fmt.Sprintf(`⏳ Ваша заявка отправлена!

📋 %s
🕐 %s

Ожидайте подтверждения от тренера.`,
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)
}

// FormatReminderClient creates a reminder message for client 1h before session
func FormatReminderClient(booking *models.Booking) string {
	return fmt.Sprintf(`🔔 Напоминание: через 1 час у вас тренировка!

📋 %s
🕐 %s

Хорошей тренировки! 💪`,
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)
}

// ========== Recurring Schedule Messages ==========

var dayNamesShort = map[int]string{
	0: "Вс", 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб",
}

func formatDaysOfWeekMsg(daysOfWeek string) string {
	if daysOfWeek == "" {
		return "?"
	}
	parts := strings.Split(daysOfWeek, ",")
	names := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		var d int
		fmt.Sscanf(p, "%d", &d)
		if name, ok := dayNamesShort[d]; ok {
			names = append(names, name)
		}
	}
	return strings.Join(names, ", ")
}

// formatDayTimesMsg formats per-day times like "Пн 09:00, Ср 10:30"
func formatDayTimesMsg(dayTimesJSON string) string {
	if dayTimesJSON == "" {
		return ""
	}
	var m map[string]string
	if err := json.Unmarshal([]byte(dayTimesJSON), &m); err != nil {
		return ""
	}
	// Sort by day number
	keys := make([]int, 0, len(m))
	for k := range m {
		d, _ := strconv.Atoi(k)
		keys = append(keys, d)
	}
	sort.Ints(keys)

	parts := make([]string, 0, len(keys))
	for _, d := range keys {
		name := dayNamesShort[d]
		t := m[strconv.Itoa(d)]
		parts = append(parts, fmt.Sprintf("%s %s", name, t))
	}
	return strings.Join(parts, ", ")
}

// scheduleTimeLine returns the schedule line for days+time display
func scheduleTimeLine(schedule *models.RecurringSchedule) string {
	if schedule.DayTimes != "" {
		if s := formatDayTimesMsg(schedule.DayTimes); s != "" {
			return s
		}
	}
	return formatDaysOfWeekMsg(schedule.DaysOfWeek) + " · " + schedule.Time
}

func formatScheduleDateRange(startDate, endDate string) string {
	if startDate == "" || endDate == "" {
		return ""
	}
	start, err1 := time.Parse("2006-01-02", startDate)
	end, err2 := time.Parse("2006-01-02", endDate)
	if err1 != nil || err2 != nil {
		return ""
	}
	return fmt.Sprintf("%d %s — %d %s",
		start.Day(), monthNames[start.Month()],
		end.Day(), monthNames[end.Month()])
}

func scheduleServiceDisplay(schedule *models.RecurringSchedule) string {
	if schedule.SessionType != nil {
		if schedule.DurationMinutes > 0 {
			return fmt.Sprintf("%s (%s)", schedule.SessionType.Name, formatDuration(schedule.DurationMinutes))
		}
		return schedule.SessionType.Name
	}
	if schedule.DurationMinutes > 0 {
		return fmt.Sprintf("Тренировка %s", formatDuration(schedule.DurationMinutes))
	}
	return "Тренировка"
}

// FormatRecurringScheduleRequest creates a message for trainer about new recurring schedule request from client
func FormatRecurringScheduleRequest(schedule *models.RecurringSchedule, count int) string {
	msg := fmt.Sprintf("🔄 Новое расписание\n\n👤 %s\n📋 %s\n📅 %s\n📆 %s",
		schedule.ClientName,
		scheduleServiceDisplay(schedule),
		scheduleTimeLine(schedule),
		formatScheduleDateRange(schedule.StartDate, schedule.EndDate),
	)
	if count > 0 {
		msg += fmt.Sprintf("\n📊 %d тренировок", count)
	}
	msg += MsgOpenAppHint
	return msg
}

// FormatRecurringScheduleRequestForClient creates a message for client about trainer-created schedule
func FormatRecurringScheduleRequestForClient(schedule *models.RecurringSchedule, count int) string {
	msg := fmt.Sprintf("📅 Тренер предлагает регулярное расписание\n\n📋 %s\n📅 %s\n📆 %s",
		scheduleServiceDisplay(schedule),
		scheduleTimeLine(schedule),
		formatScheduleDateRange(schedule.StartDate, schedule.EndDate),
	)
	if count > 0 {
		msg += fmt.Sprintf("\n📊 %d тренировок", count)
	}
	msg += MsgOpenAppHint
	return msg
}

// FormatRecurringScheduleApproved creates a message shown to trainer after approving (or shown to trainer when client approves)
func FormatRecurringScheduleApproved(schedule *models.RecurringSchedule, count int) string {
	return fmt.Sprintf("✅ Расписание подтверждено\n\n👤 %s\n📋 %s\n📅 %s\n📆 %s\n📊 %d записей создано",
		schedule.ClientName,
		scheduleServiceDisplay(schedule),
		scheduleTimeLine(schedule),
		formatScheduleDateRange(schedule.StartDate, schedule.EndDate),
		count,
	)
}

// FormatRecurringScheduleApprovedClient creates a message for client about approved schedule
func FormatRecurringScheduleApprovedClient(schedule *models.RecurringSchedule, count int) string {
	return fmt.Sprintf("✅ Ваше расписание подтверждено!\n\n📋 %s\n📅 %s\n📆 %s\n📊 %d записей создано",
		scheduleServiceDisplay(schedule),
		scheduleTimeLine(schedule),
		formatScheduleDateRange(schedule.StartDate, schedule.EndDate),
		count,
	)
}

// FormatRecurringScheduleDeclined creates a message shown to trainer after declining
func FormatRecurringScheduleDeclined(schedule *models.RecurringSchedule) string {
	return fmt.Sprintf("❌ Расписание отклонено\n\n👤 %s\n📋 %s\n📅 %s\n📆 %s",
		schedule.ClientName,
		scheduleServiceDisplay(schedule),
		scheduleTimeLine(schedule),
		formatScheduleDateRange(schedule.StartDate, schedule.EndDate),
	)
}

// FormatRecurringScheduleDeclinedClient creates a message for client about declined schedule
func FormatRecurringScheduleDeclinedClient(schedule *models.RecurringSchedule) string {
	return fmt.Sprintf("❌ К сожалению, ваше расписание отклонено\n\n📋 %s\n📅 %s\n📆 %s",
		scheduleServiceDisplay(schedule),
		scheduleTimeLine(schedule),
		formatScheduleDateRange(schedule.StartDate, schedule.EndDate),
	)
}

// ========== Cancellation Notification Messages ==========

// FormatBookingCancelledForTrainer creates a notification for trainer when client cancels
func FormatBookingCancelledForTrainer(booking *models.Booking) string {
	msg := fmt.Sprintf("❌ Клиент отменил запись\n\n👤 %s\n📋 %s\n🕐 %s",
		booking.ClientName,
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)
	if booking.CancelReason != "" {
		msg += fmt.Sprintf("\n💬 Причина: %s", booking.CancelReason)
	}
	return msg
}

// FormatBookingCancelledForClient creates a notification for client when trainer cancels
func FormatBookingCancelledForClient(booking *models.Booking) string {
	msg := fmt.Sprintf("❌ Тренер отменил вашу запись\n\n📋 %s\n🕐 %s",
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)
	if booking.CancelReason != "" {
		msg += fmt.Sprintf("\n💬 Причина: %s", booking.CancelReason)
	}
	return msg
}

// FormatMoveRequestForTrainer creates a message for trainer when client requests booking move
func FormatMoveRequestForTrainer(newBooking, oldBooking *models.Booking) string {
	return fmt.Sprintf("🔄 Запрос на перенос\n\n👤 %s\n📋 %s\n🕐 Было: %s\n🕐 Новое: %s%s",
		oldBooking.ClientName,
		bookingServiceDisplay(oldBooking),
		formatDateTime(oldBooking.StartsAt),
		formatDateTime(newBooking.StartsAt),
		MsgOpenAppHint,
	)
}

// FormatMoveRequestForClient creates a message for client when trainer requests booking move
func FormatMoveRequestForClient(newBooking, oldBooking *models.Booking) string {
	return fmt.Sprintf("🔄 Тренер предлагает перенести тренировку\n\n📋 %s\n🕐 Было: %s\n🕐 Новое: %s%s",
		bookingServiceDisplay(oldBooking),
		formatDateTime(oldBooking.StartsAt),
		formatDateTime(newBooking.StartsAt),
		MsgOpenAppHint,
	)
}

// FormatMoveApproved creates a message after move is approved
func FormatMoveApproved(newBooking, oldBooking *models.Booking) string {
	return fmt.Sprintf("✅ Перенос подтверждён\n\n👤 %s\n📋 %s\n🕐 Было: %s\n🕐 Новое: %s",
		oldBooking.ClientName,
		bookingServiceDisplay(oldBooking),
		formatDateTime(oldBooking.StartsAt),
		formatDateTime(newBooking.StartsAt),
	)
}

// FormatMoveDeclined creates a message after move is declined
func FormatMoveDeclined(oldBooking *models.Booking) string {
	return fmt.Sprintf("↩️ Перенос отклонён\n\n👤 %s\n📋 %s\n🕐 %s\n\nТренировка остаётся в расписании.",
		oldBooking.ClientName,
		bookingServiceDisplay(oldBooking),
		formatDateTime(oldBooking.StartsAt),
	)
}

// ========== Trainer-Initiated Booking Messages ==========

// FormatTrainerCreatedBookingClient creates a message for client when trainer books them
func FormatTrainerCreatedBookingClient(booking *models.Booking) string {
	msg := fmt.Sprintf(`📅 Тренер записал вас на тренировку

📋 %s
🕐 %s`,
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)

	if booking.ClientMessage != "" {
		msg += fmt.Sprintf("\n💬 Сообщение: %s", booking.ClientMessage)
	}

	msg += MsgOpenAppHint
	return msg
}

// FormatClientAcceptedBookingTrainer creates a message for trainer when client accepts
func FormatClientAcceptedBookingTrainer(booking *models.Booking) string {
	return fmt.Sprintf(`✅ Клиент подтвердил запись

👤 Клиент: %s
📋 %s
🕐 %s`,
		booking.ClientName,
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)
}

// FormatClientDeclinedBookingTrainer creates a message for trainer when client declines
func FormatClientDeclinedBookingTrainer(booking *models.Booking) string {
	return fmt.Sprintf(`❌ Клиент отклонил запись

👤 Клиент: %s
📋 %s
🕐 %s`,
		booking.ClientName,
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)
}

// Master bot messages for trainer onboarding

// MasterMsgWelcome is sent when trainer starts onboarding
const MasterMsgWelcome = `👋 Привет! Я помогу создать бота для онлайн-записи ваших клиентов.

🎯 Что вы получите:
• Личный бот с вашим именем (@vashe_imya_bot)
• Клиенты записываются сами — вы только подтверждаете
• Календарь, услуги и цены — всё настраивается
• Уведомления о новых записях прямо в Telegram

⏱ Настройка займёт 2 минуты.

📝 Первый шаг — создать бота в Telegram:

1. Откройте @BotFather (нажмите на ссылку)
2. Отправьте команду /newbot
3. Введите название (например: "Тренер Иван")
4. Введите username (например: trener_ivan_bot)
5. Скопируйте токен — длинную строку с цифрами и буквами

Отправьте мне токен вашего бота:`

// MasterMsgHelp is the help message for master bot
const MasterMsgHelp = `🤖 Этот бот помогает создать бота для записи клиентов.

Команды:
/start - Начать создание бота
/cancel - Отменить текущую операцию

Если у вас уже есть бот, отправьте /start чтобы проверить статус.`

// MasterMsgHelpAdmin is the help message for admin
const MasterMsgHelpAdmin = `🤖 Этот бот помогает создать бота для записи клиентов.

Команды:
/start - Начать создание бота
/cancel - Отменить текущую операцию

👑 Админ-команды:
/trainers - Список всех тренеров
/stats - Статистика`

// MasterMsgUnknown is sent for unknown messages
const MasterMsgUnknown = `Не понимаю. Используйте /start чтобы начать или /help для справки.`

// MasterMsgError is sent on server errors
const MasterMsgError = `❌ Произошла ошибка. Попробуйте позже.`

// MasterMsgCancelled is sent when user cancels
const MasterMsgCancelled = `❌ Отменено. Отправьте /start чтобы начать заново.`

// MasterMsgInvalidToken is sent when token is invalid
const MasterMsgInvalidToken = `❌ Неверный токен. Убедитесь, что вы скопировали токен полностью из сообщения BotFather.

Токен выглядит примерно так:
123456789:ABCdefGHIjklMNOpqrsTUVwxyz

Попробуйте ещё раз:`

// MasterMsgTokenAlreadyUsed is sent when token is already registered
const MasterMsgTokenAlreadyUsed = `❌ Этот бот уже зарегистрирован. Если это ваш бот, обратитесь в поддержку.`

// MasterMsgTokenAccepted is sent when token is valid (with bot username)
const MasterMsgTokenAccepted = `✅ Бот @%s найден.

⚠️ Регистрация ещё не завершена! Чтобы бот заработал, введите ваше имя (как вас будут видеть клиенты):`

// MasterMsgNameTooShort is sent when name is too short
const MasterMsgNameTooShort = `❌ Имя слишком короткое. Введите ваше полное имя:`

// MasterMsgSuccess is sent when onboarding is complete
const MasterMsgSuccess = `🎉 Поздравляем, %s!

Ваш бот @%s готов к работе.

🚀 Что делать дальше:

1️⃣ Откройте @%s → отправьте /start
2️⃣ Настройте услуги и расписание под себя
3️⃣ Отправьте ссылку t.me/%s клиентам

Клиенты смогут выбрать время и записаться, а вы получите уведомление с кнопками "Подтвердить" или "Отклонить".

Удачи! 💪`

// MasterMsgAlreadyRegistered is sent when user already has a bot
const MasterMsgAlreadyRegistered = `✅ У вас уже есть бот: @%s

Откройте его и отправьте /start чтобы использовать.`

// MasterMsgRegistrationFailed is sent when bot handler registration fails
const MasterMsgRegistrationFailed = `⚠️ Бот @%s создан, но не удалось запустить обработку сообщений.

Попробуйте отправить /start ещё раз — система попробует подключить бота повторно. Если не поможет — напишите в поддержку.`
