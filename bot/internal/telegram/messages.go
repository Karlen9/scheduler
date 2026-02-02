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

// MsgWelcome is the welcome message for /start
const MsgWelcome = "Добро пожаловать! Нажмите кнопку ниже, чтобы открыть приложение для записи."

// MsgHelp is the help message
const MsgHelp = "Используйте /start чтобы открыть приложение для записи."

// BtnOpenApp is the button text for opening the mini-app
const BtnOpenApp = "📅 Открыть расписание"

// BtnAccept is the accept button text
const BtnAccept = "✅ Подтвердить"

// BtnReject is the reject button text
const BtnReject = "❌ Отклонить"

// FormatNewBookingMessage creates a message for trainer about new booking request
func FormatNewBookingMessage(booking *models.Booking) string {
	msg := fmt.Sprintf(`📅 Новая заявка на запись

👤 Клиент: %s
📋 Услуга: %s
🕐 Время: %s
💰 Стоимость: %s`,
		booking.ClientName,
		booking.SessionType.Name,
		formatDateTime(booking.StartsAt),
		formatPrice(booking.SessionType.Price, booking.SessionType.Currency),
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
📋 Услуга: %s
🕐 Время: %s`,
		booking.ClientName,
		booking.SessionType.Name,
		formatDateTime(booking.StartsAt),
	)
}

// FormatBookingRejectedTrainer creates a message for trainer after rejecting
func FormatBookingRejectedTrainer(booking *models.Booking) string {
	return fmt.Sprintf(`❌ Запись отклонена

👤 Клиент: %s
📋 Услуга: %s
🕐 Время: %s`,
		booking.ClientName,
		booking.SessionType.Name,
		formatDateTime(booking.StartsAt),
	)
}

// FormatBookingConfirmedClient creates a message for client when booking is confirmed
func FormatBookingConfirmedClient(booking *models.Booking) string {
	return fmt.Sprintf(`✅ Ваша запись подтверждена!

📋 %s
🕐 %s`,
		booking.SessionType.Name,
		formatDateTime(booking.StartsAt),
	)
}

// FormatBookingRejectedClient creates a message for client when booking is rejected
func FormatBookingRejectedClient() string {
	return `❌ К сожалению, ваша заявка отклонена

Попробуйте выбрать другое время.`
}

// FormatBookingPendingClient creates a message for client after booking creation
func FormatBookingPendingClient(booking *models.Booking) string {
	return fmt.Sprintf(`⏳ Ваша заявка отправлена!

📋 %s
🕐 %s

Ожидайте подтверждения от тренера.`,
		booking.SessionType.Name,
		formatDateTime(booking.StartsAt),
	)
}
