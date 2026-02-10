package telegram

import (
	"fmt"
	"log"
	"strings"
	"time"

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
		keyboard := &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{{Text: BtnOpenAdmin, WebApp: &WebAppInfo{URL: adminURL}}},
				{{Text: BtnOpenApp, WebApp: &WebAppInfo{URL: clientURL}}},
			},
		}
		_, err = h.Bot.SendMessage(msg.Chat.ID, FormatWelcomeTrainer(h.Version, h.Changelog), keyboard)
		if err != nil {
			log.Printf("Error sending trainer start message: %v", err)
		}
		return
	}

	// Regular client
	webAppURL := h.WebAppURL + "?trainer=" + trainer.ID
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
	case "wl_accept":
		h.handleWaitlistAccept(cq, bookingID) // bookingID is actually entryID
	case "wl_decline":
		h.handleWaitlistDecline(cq, bookingID) // bookingID is actually entryID
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

// ========== Waitlist Handlers ==========

func (h *Handler) handleWaitlistAccept(cq *CallbackQuery, entryID string) {
	entry, err := db.GetWaitlistByID(entryID)
	if err != nil {
		log.Printf("Error getting waitlist entry: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при получении записи")
		return
	}

	if entry == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запись не найдена")
		return
	}

	if entry.Status != models.WaitlistStatusOffered {
		h.Bot.AnswerCallbackQuery(cq.ID, "Предложение больше не актуально")
		if cq.Message != nil {
			h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
				FormatWaitlistDeclinedClient(entry), nil)
		}
		return
	}

	// Check if slot is in the past
	if entry.StartsAt.Before(time.Now().UTC()) {
		db.UpdateWaitlistStatus(entryID, models.WaitlistStatusExpired)
		h.Bot.AnswerCallbackQuery(cq.ID, "Это время уже прошло")
		if cq.Message != nil {
			h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
				FormatWaitlistExpiredClient(entry), nil)
		}
		return
	}

	// Check slot is still free
	hasConflict, err := db.HasConflictingBooking(entry.TrainerID, entry.StartsAt, entry.EndsAt, "")
	if err != nil || hasConflict {
		db.UpdateWaitlistStatus(entryID, models.WaitlistStatusExpired)
		h.Bot.AnswerCallbackQuery(cq.ID, "Это время уже занято")
		if cq.Message != nil {
			h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
				"❌ К сожалению, это время уже было занято.", nil)
		}
		return
	}

	// Check client doesn't already have booking on this day
	hasBooking, err := db.ClientHasBookingOnDate(entry.ClientID, entry.StartsAt)
	if err != nil || hasBooking {
		db.UpdateWaitlistStatus(entryID, models.WaitlistStatusDeclined)
		h.Bot.AnswerCallbackQuery(cq.ID, "У вас уже есть запись на этот день")
		if cq.Message != nil {
			h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
				"❌ У вас уже есть запись на этот день.", nil)
		}
		return
	}

	// Find session type for FK
	services, err := db.GetSessionTypesByTrainerID(entry.TrainerID)
	if err != nil || len(services) == 0 {
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка конфигурации")
		return
	}
	sessionTypeID := services[0].ID
	for _, s := range services {
		if s.DurationMinutes == entry.DurationMinutes {
			sessionTypeID = s.ID
			break
		}
	}

	// Create booking
	booking, err := db.CreateBooking(entry.TrainerID, entry.ClientID, sessionTypeID,
		entry.StartsAt, entry.EndsAt, entry.ClientName, "", entry.DurationMinutes)
	if err != nil {
		log.Printf("Error creating booking from waitlist: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при создании записи")
		return
	}

	// Update waitlist status
	db.UpdateWaitlistStatus(entryID, models.WaitlistStatusBooked)
	db.CancelWaitlistEntriesForSlot(entry.ClientID, entry.TrainerID, entry.StartsAt, entry.EndsAt)

	log.Printf("📋 WAITLIST ACCEPTED (TG) [%s] Client: %s → Booking [%s]",
		entryID[:8], entry.ClientName, booking.ID[:8])

	h.Bot.AnswerCallbackQuery(cq.ID, "Место забронировано!")

	// Update message
	if cq.Message != nil {
		h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
			FormatWaitlistBookedClient(entry), nil)
	}

	// Notify trainer about new booking
	h.NotifyTrainerNewBooking(booking)
}

func (h *Handler) handleWaitlistDecline(cq *CallbackQuery, entryID string) {
	entry, err := db.GetWaitlistByID(entryID)
	if err != nil {
		log.Printf("Error getting waitlist entry: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при получении записи")
		return
	}

	if entry == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запись не найдена")
		return
	}

	if entry.Status != models.WaitlistStatusOffered {
		h.Bot.AnswerCallbackQuery(cq.ID, "Предложение больше не актуально")
		return
	}

	db.UpdateWaitlistStatus(entryID, models.WaitlistStatusDeclined)

	log.Printf("📋 WAITLIST DECLINED (TG) [%s] Client: %s", entryID[:8], entry.ClientName)

	h.Bot.AnswerCallbackQuery(cq.ID, "Вы отказались от предложения")

	// Update message
	if cq.Message != nil {
		h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
			FormatWaitlistDeclinedClient(entry), nil)
	}

	// Offer to next person in queue
	go func() {
		hasConflict, _ := db.HasConflictingBooking(entry.TrainerID, entry.StartsAt, entry.EndsAt, "")
		if hasConflict {
			return
		}

		entries, err := db.GetWaitlistForSlot(entry.TrainerID, entry.StartsAt, entry.EndsAt)
		if err != nil || len(entries) == 0 {
			return
		}

		next := entries[0]
		if err := db.OfferWaitlistEntry(next.ID); err != nil {
			log.Printf("Error offering waitlist entry: %v", err)
			return
		}

		h.NotifyClientWaitlistOffer(&next)
	}()
}

// NotifyClientWaitlistOffer sends a waitlist offer notification to a client
func (h *Handler) NotifyClientWaitlistOffer(entry *models.WaitlistEntry) error {
	client, err := db.GetClientByID(entry.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("error getting client: %v", err)
	}

	text := FormatWaitlistOfferClient(entry)
	_, err = h.Bot.SendWaitlistOfferMessage(client.TelegramUserID, entry.ID, text)
	return err
}

// NotifyClientWaitlistExpired sends an expiry notification to a client
func (h *Handler) NotifyClientWaitlistExpired(entry *models.WaitlistEntry) error {
	client, err := db.GetClientByID(entry.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("error getting client: %v", err)
	}

	text := FormatWaitlistExpiredClient(entry)
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
