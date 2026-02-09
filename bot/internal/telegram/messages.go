package telegram

import (
	"fmt"
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
	if booking.DurationMinutes > 0 {
		return formatDuration(booking.DurationMinutes)
	}
	if booking.SessionType != nil {
		return booking.SessionType.Name
	}
	return "Тренировка"
}

func bookingServiceDisplay(booking *models.Booking) string {
	if booking.DurationMinutes > 0 {
		return fmt.Sprintf("Тренировка %s", formatDuration(booking.DurationMinutes))
	}
	if booking.SessionType != nil {
		return booking.SessionType.Name
	}
	return "Тренировка"
}

// MsgWelcome is the welcome message for /start (clients)
const MsgWelcome = "Добро пожаловать! Нажмите кнопку ниже, чтобы открыть приложение для записи."

// MsgWelcomeTrainer is the welcome message for /start (trainer)
const MsgWelcomeTrainer = `👋 С возвращением!

🔧 Панель управления — настройки, расписание и записи клиентов.
📅 Записаться — посмотреть как видят бота ваши клиенты.`

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

// BtnAccept is the accept button text
const BtnAccept = "✅ Подтвердить"

// BtnReject is the reject button text
const BtnReject = "❌ Отклонить"

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
func FormatBookingRejectedClient() string {
	return `❌ К сожалению, ваша заявка отклонена

Попробуйте выбрать другое время.`
}

// FormatBookingCancelledByTrainerClient creates a message for client when trainer cancels a booking
func FormatBookingCancelledByTrainerClient(booking *models.Booking) string {
	return fmt.Sprintf(`❌ Ваша запись отменена тренером

📋 %s
🕐 %s

Вы можете записаться на другое время.`,
		bookingServiceDisplay(booking),
		formatDateTime(booking.StartsAt),
	)
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
const MasterMsgTokenAccepted = `✅ Отлично! Бот @%s подключён.

Теперь введите ваше имя (как вас будут видеть клиенты):`

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
