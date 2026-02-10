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
		keyboard := &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{{Text: BtnOpenAdmin, WebApp: &WebAppInfo{URL: adminURL}}},
				{{Text: BtnOpenApp, WebApp: &WebAppInfo{URL: clientURL}}},
			},
		}
		_, err = h.Bot.SendMessage(msg.Chat.ID, MsgWelcomeTrainer, keyboard)
		if err != nil {
			log.Printf("Error sending trainer start message: %v", err)
		}
		return
	}

	// Regular client
	webAppURL := h.WebAppURL + "?trainer=" + trainer.ID
	_, err = h.Bot.SendWebAppButton(msg.Chat.ID, MsgWelcome, webAppURL)
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
	_, err = h.Bot.SendWebAppButton(msg.Chat.ID, "🔧 Панель управления", adminURL)
	if err != nil {
		log.Printf("Error sending admin message: %v", err)
	}
}

func (h *Handler) handleHelp(msg *Message) {
	_, err := h.Bot.SendMessage(msg.Chat.ID, MsgHelp, nil)
	if err != nil {
		log.Printf("Error sending help message: %v", err)
	}
}

func (h *Handler) handleCallbackQuery(cq *CallbackQuery) {
	parts := strings.SplitN(cq.Data, ":", 2)
	if len(parts) != 2 {
		h.Bot.AnswerCallbackQuery(cq.ID, "Неверный формат данных")
		return
	}

	action := parts[0]
	bookingID := parts[1]

	switch action {
	case "accept":
		h.handleAcceptBooking(cq, bookingID)
	case "reject":
		h.handleRejectBooking(cq, bookingID)
	default:
		h.Bot.AnswerCallbackQuery(cq.ID, "Неизвестное действие")
	}
}

func (h *Handler) handleAcceptBooking(cq *CallbackQuery, bookingID string) {
	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при получении записи")
		return
	}

	if booking == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запись не найдена")
		return
	}

	if booking.Status != models.BookingStatusPending {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запись уже обработана")
		// Update message to remove buttons
		h.updateBookingMessage(cq, booking)
		return
	}

	// Update booking status
	if err := db.UpdateBookingStatus(bookingID, models.BookingStatusConfirmed); err != nil {
		log.Printf("Error updating booking status: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при обновлении статуса")
		return
	}

	// Refresh booking
	booking, _ = db.GetBookingByID(bookingID)

	// Answer callback
	h.Bot.AnswerCallbackQuery(cq.ID, "Запись подтверждена!")

	// Update trainer's message
	h.updateBookingMessage(cq, booking)

	// Notify client
	h.notifyClient(booking, true)
}

func (h *Handler) handleRejectBooking(cq *CallbackQuery, bookingID string) {
	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при получении записи")
		return
	}

	if booking == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запись не найдена")
		return
	}

	if booking.Status != models.BookingStatusPending {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запись уже обработана")
		h.updateBookingMessage(cq, booking)
		return
	}

	// Update booking status
	if err := db.UpdateBookingStatus(bookingID, models.BookingStatusRejected); err != nil {
		log.Printf("Error updating booking status: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при обновлении статуса")
		return
	}

	// Refresh booking
	booking, _ = db.GetBookingByID(bookingID)

	// Answer callback
	h.Bot.AnswerCallbackQuery(cq.ID, "Запись отклонена")

	// Update trainer's message
	h.updateBookingMessage(cq, booking)

	// Notify client
	h.notifyClient(booking, false)
}

func (h *Handler) updateBookingMessage(cq *CallbackQuery, booking *models.Booking) {
	if cq.Message == nil {
		return
	}

	var text string
	switch booking.Status {
	case models.BookingStatusConfirmed:
		text = FormatBookingAcceptedTrainer(booking)
	case models.BookingStatusRejected:
		text = FormatBookingRejectedTrainer(booking)
	default:
		text = FormatNewBookingMessage(booking)
	}

	err := h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID, text, nil)
	if err != nil {
		log.Printf("Error editing message: %v", err)
	}
}

func (h *Handler) notifyClient(booking *models.Booking, accepted bool) {
	client, err := db.GetClientByID(booking.ClientID)
	if err != nil || client == nil {
		log.Printf("Error getting client: %v", err)
		return
	}

	var text string
	if accepted {
		text = FormatBookingConfirmedClient(booking)
	} else {
		text = FormatBookingRejectedClient(booking)
	}

	_, err = h.Bot.SendMessage(client.TelegramUserID, text, nil)
	if err != nil {
		log.Printf("Error notifying client: %v", err)
	}
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
	_, err = h.Bot.SendBookingApprovalMessage(trainer.TelegramUserID, booking.ID, text)
	return err
}
