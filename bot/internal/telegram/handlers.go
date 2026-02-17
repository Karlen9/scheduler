package telegram

import (
	"fmt"
	"log"
	"strings"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

// Handler handles Telegram updates
type Handler struct {
	Bot       *Bot
	WebAppURL string
	Version   string
	Changelog string
}

// NewHandler creates a new Handler
func NewHandler(bot *Bot, webAppURL string) *Handler {
	return &Handler{
		Bot:       bot,
		WebAppURL: webAppURL,
	}
}

// HandleUpdate processes an incoming update
func (h *Handler) HandleUpdate(update Update) {
	if update.Message != nil {
		h.handleMessage(update.Message)
	}
	if update.CallbackQuery != nil {
		h.handleCallbackQuery(update.CallbackQuery)
	}
}

func (h *Handler) handleMessage(msg *Message) {
	switch msg.Text {
	case "/start":
		h.handleStart(msg)
	case "/admin":
		h.handleAdmin(msg)
	case "/help":
		h.handleHelp(msg)
	}
}

func (h *Handler) handleStart(msg *Message) {
	// Get trainer by bot token to include trainer ID in URL
	trainer, err := db.GetTrainerByBotToken(h.Bot.Token)
	if err != nil || trainer == nil {
		log.Printf("Error getting trainer for bot: %v", err)
		_, _ = h.Bot.SendMessage(msg.Chat.ID, "Ошибка конфигурации бота", nil)
		return
	}

	// Check if the user is the trainer (owner of this bot)
	if trainer.TelegramUserID == msg.From.ID {
		adminURL := h.WebAppURL + "/admin?trainer=" + trainer.ID
		clientURL := h.WebAppURL + "?trainer=" + trainer.ID

		// Set persistent menu button for trainer (opens admin panel)
		if err := h.Bot.SetChatMenuButton(msg.Chat.ID, BtnOpenAdmin, adminURL); err != nil {
			log.Printf("Error setting trainer menu button: %v", err)
		}

		keyboard := &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{{Text: BtnOpenAdmin, WebApp: &WebAppInfo{URL: adminURL}}},
				{{Text: BtnOpenApp, WebApp: &WebAppInfo{URL: clientURL}}},
			},
		}
		_, err = h.Bot.SendMessageHTML(msg.Chat.ID, FormatWelcomeTrainer(h.Version, h.Changelog, clientURL), keyboard)
		if err != nil {
			log.Printf("Error sending trainer start message: %v", err)
		}
		return
	}

	// Regular client
	webAppURL := h.WebAppURL + "?trainer=" + trainer.ID

	// Set persistent menu button for client (opens booking app)
	if err := h.Bot.SetChatMenuButton(msg.Chat.ID, BtnOpenApp, webAppURL); err != nil {
		log.Printf("Error setting client menu button: %v", err)
	}

	_, err = h.Bot.SendWebAppButton(msg.Chat.ID, FormatWelcome(h.Version, h.Changelog), webAppURL)
	if err != nil {
		log.Printf("Error sending start message: %v", err)
	}
}

func (h *Handler) handleAdmin(msg *Message) {
	// Check if user is the trainer (owner of this bot)
	trainer, err := db.GetTrainerByBotToken(h.Bot.Token)
	if err != nil {
		log.Printf("Error getting trainer: %v", err)
		return
	}

	if trainer == nil || trainer.TelegramUserID != msg.From.ID {
		_, err := h.Bot.SendMessage(msg.Chat.ID, "⛔ Эта команда доступна только тренеру.", nil)
		if err != nil {
			log.Printf("Error sending admin denied message: %v", err)
		}
		return
	}

	// Open admin panel with trainer ID
	adminURL := h.WebAppURL + "/admin?trainer=" + trainer.ID
	_, err = h.Bot.SendWebAppButton(msg.Chat.ID, "Открыть панель управления", adminURL)
	if err != nil {
		log.Printf("Error sending admin message: %v", err)
	}
}

func (h *Handler) handleHelp(msg *Message) {
	trainer, err := db.GetTrainerByBotToken(h.Bot.Token)
	if err != nil || trainer == nil {
		_, _ = h.Bot.SendMessage(msg.Chat.ID, MsgHelpClient, nil)
		return
	}

	if trainer.TelegramUserID == msg.From.ID {
		clientURL := "https://t.me/" + h.Bot.Username
		_, err = h.Bot.SendMessageHTML(msg.Chat.ID, FormatHelpTrainer(clientURL), nil)
	} else {
		_, err = h.Bot.SendMessage(msg.Chat.ID, MsgHelpClient, nil)
	}
	if err != nil {
		log.Printf("Error sending help message: %v", err)
	}
}

func (h *Handler) handleCallbackQuery(cq *CallbackQuery) {
	parts := strings.SplitN(cq.Data, ":", 2)
	if len(parts) != 2 {
		h.Bot.AnswerCallbackQuery(cq.ID, "Используйте приложение")
		return
	}

	action, bookingID := parts[0], parts[1]
	if action != "accept" && action != "reject" {
		h.Bot.AnswerCallbackQuery(cq.ID, "Используйте приложение")
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil || booking == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запись не найдена")
		return
	}

	if booking.Status != models.BookingStatusPending {
		h.Bot.AnswerCallbackQuery(cq.ID, "Заявка уже обработана")
		// Remove stale buttons
		if cq.Message != nil {
			h.UpdateBookingNotificationMessage(cq.Message.Chat.ID, cq.Message.MessageID, booking)
		}
		return
	}

	var newStatus models.BookingStatus
	var toastText string
	if action == "accept" {
		newStatus = models.BookingStatusConfirmed
		toastText = "✅ Запись подтверждена"
	} else {
		newStatus = models.BookingStatusRejected
		toastText = "❌ Запись отклонена"
	}

	if err := db.UpdateBookingStatus(bookingID, newStatus); err != nil {
		log.Printf("Error updating booking via callback: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка, попробуйте через приложение")
		return
	}

	h.Bot.AnswerCallbackQuery(cq.ID, toastText)

	// Refresh booking for notification messages
	booking, _ = db.GetBookingByID(bookingID)
	if booking == nil {
		return
	}

	// Edit the trainer's message to remove buttons and show new status
	if cq.Message != nil {
		h.UpdateBookingNotificationMessage(cq.Message.Chat.ID, cq.Message.MessageID, booking)
	}

	// Notify client about status change
	h.NotifyClientStatusChange(booking, string(newStatus))
}

// NotifyClientStatusChange sends a notification to client when booking status changes via admin panel
func (h *Handler) NotifyClientStatusChange(booking *models.Booking, newStatus string) error {
	client, err := db.GetClientByID(booking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("error getting client: %w", err)
	}

	var text string
	switch models.BookingStatus(newStatus) {
	case models.BookingStatusConfirmed:
		text = FormatBookingConfirmedClient(booking)
	case models.BookingStatusRejected:
		text = FormatBookingRejectedClient(booking)
	case models.BookingStatusCancelled:
		text = FormatBookingCancelledByTrainerClient(booking)
	default:
		return nil
	}

	_, err = h.Bot.SendMessage(client.TelegramUserID, text, nil)
	return err
}

// NotifyTrainerNewBooking sends a notification to trainer about a new booking
func (h *Handler) NotifyTrainerNewBooking(booking *models.Booking) error {
	trainer, err := db.GetTrainerByID(booking.TrainerID)
	if err != nil || trainer == nil {
		return err
	}

	text := FormatNewBookingMessage(booking)
	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: "✅ Подтвердить", CallbackData: "accept:" + booking.ID},
				{Text: "❌ Отклонить", CallbackData: "reject:" + booking.ID},
			},
		},
	}
	msg, err := h.Bot.SendMessage(trainer.TelegramUserID, text, keyboard)
	if err != nil {
		return err
	}

	// Save message info so admin panel can edit it later
	if msg != nil {
		db.SaveBookingNotificationInfo(booking.ID, trainer.TelegramUserID, msg.MessageID)
	}
	return nil
}

// UpdateBookingNotificationMessage edits the trainer's original booking notification
// to reflect the new status (removes inline buttons)
func (h *Handler) UpdateBookingNotificationMessage(chatID int64, messageID int, booking *models.Booking) error {
	var text string
	switch booking.Status {
	case models.BookingStatusConfirmed:
		text = FormatBookingAcceptedTrainer(booking)
	case models.BookingStatusRejected:
		text = FormatBookingRejectedTrainer(booking)
	case models.BookingStatusCancelled:
		text = fmt.Sprintf("❌ Запись отменена\n\n👤 Клиент: %s\n📋 %s\n🕐 Время: %s",
			booking.ClientName,
			bookingServiceDisplay(booking),
			formatDateTime(booking.StartsAt))
	default:
		text = FormatNewBookingMessage(booking)
	}
	return h.Bot.EditMessageText(chatID, messageID, text, nil)
}

// NotifyTrainerRecurringSchedule sends a recurring schedule approval request to trainer
func (h *Handler) NotifyTrainerRecurringSchedule(schedule *models.RecurringSchedule, previewCount int) error {
	trainer, err := db.GetTrainerByID(schedule.TrainerID)
	if err != nil || trainer == nil {
		return fmt.Errorf("error getting trainer: %v", err)
	}
	text := FormatRecurringScheduleRequest(schedule, previewCount)
	_, err = h.Bot.SendNotification(trainer.TelegramUserID, text)
	return err
}

// NotifyClientRecurringSchedule sends a recurring schedule confirmation request to client
func (h *Handler) NotifyClientRecurringSchedule(schedule *models.RecurringSchedule, previewCount int) error {
	client, err := db.GetClientByID(schedule.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("error getting client: %v", err)
	}
	text := FormatRecurringScheduleRequestForClient(schedule, previewCount)
	_, err = h.Bot.SendNotification(client.TelegramUserID, text)
	return err
}

// ========== Trainer-Initiated Booking Handlers ==========

// NotifyClientTrainerBooking sends a trainer-created booking confirmation request to client
func (h *Handler) NotifyClientTrainerBooking(booking *models.Booking) error {
	client, err := db.GetClientByID(booking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("error getting client: %v", err)
	}

	text := FormatTrainerCreatedBookingClient(booking)
	_, err = h.Bot.SendNotification(client.TelegramUserID, text)
	return err
}

// NotifyTrainerBookingCancelled sends a cancellation notification to the trainer
func (h *Handler) NotifyTrainerBookingCancelled(booking *models.Booking) error {
	trainer, err := db.GetTrainerByID(booking.TrainerID)
	if err != nil || trainer == nil {
		return fmt.Errorf("trainer not found")
	}
	text := FormatBookingCancelledForTrainer(booking)
	_, err = h.Bot.SendMessage(trainer.TelegramUserID, text, nil)
	return err
}

// NotifyClientBookingCancelled sends a cancellation notification to the client
func (h *Handler) NotifyClientBookingCancelled(booking *models.Booking) error {
	client, err := db.GetClientByID(booking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("client not found")
	}
	text := FormatBookingCancelledForClient(booking)
	_, err = h.Bot.SendMessage(client.TelegramUserID, text, nil)
	return err
}

// NotifyMoveRequest sends a move request notification with approval buttons
func (h *Handler) NotifyMoveRequest(newBooking, oldBooking *models.Booking, requestedBy string) error {
	if requestedBy == "client" {
		// Notify trainer
		trainer, err := db.GetTrainerByID(oldBooking.TrainerID)
		if err != nil || trainer == nil {
			return fmt.Errorf("trainer not found")
		}
		text := FormatMoveRequestForTrainer(newBooking, oldBooking)
		_, err = h.Bot.SendNotification(trainer.TelegramUserID, text)
		return err
	}
	// Notify client
	client, err := db.GetClientByID(oldBooking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("client not found")
	}
	text := FormatMoveRequestForClient(newBooking, oldBooking)
	_, err = h.Bot.SendNotification(client.TelegramUserID, text)
	return err
}

// NotifyTrainerClientBookingResponse is the public API for notifying the trainer
// when a client confirms or declines a trainer-created booking via the REST API.
func (h *Handler) NotifyTrainerClientBookingResponse(booking *models.Booking, accepted bool) error {
	h.notifyTrainerClientResponse(booking, accepted)
	return nil
}

func (h *Handler) notifyTrainerClientResponse(booking *models.Booking, accepted bool) {
	trainer, err := db.GetTrainerByID(booking.TrainerID)
	if err != nil || trainer == nil {
		log.Printf("Error getting trainer: %v", err)
		return
	}

	var text string
	if accepted {
		text = FormatClientAcceptedBookingTrainer(booking)
	} else {
		text = FormatClientDeclinedBookingTrainer(booking)
	}

	_, err = h.Bot.SendMessage(trainer.TelegramUserID, text, nil)
	if err != nil {
		log.Printf("Error notifying trainer: %v", err)
	}
}
