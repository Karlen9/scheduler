package telegram

import (
	"fmt"
	"log"
	"strings"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

// Handler handles Telegram updates
type Handler struct {
	Bot       *Bot
	WebAppURL string
	Version   string
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
		h.handleCallbackQuery(update)
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
		loc := myI18n.Default()
		_, _ = h.Bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "Handler.ConfigError"), nil)
		return
	}

	// Check if the user is the trainer (owner of this bot)
	if trainer.TelegramUserID == msg.From.ID {
		lang := trainer.Language
		if lang == "" {
			lang = "ru"
		}
		loc := myI18n.NewLocalizer(lang)
		adminURL := h.WebAppURL + "/admin?trainer=" + trainer.ID + "&lang=" + lang
		clientURL := h.WebAppURL + "?trainer=" + trainer.ID + "&lang=" + lang

		// Set persistent menu button for trainer (opens admin panel)
		if err := h.Bot.SetChatMenuButton(msg.Chat.ID, BtnOpenAdmin(loc), adminURL); err != nil {
			log.Printf("Error setting trainer menu button: %v", err)
		}

		keyboard := &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{{Text: BtnOpenAdmin(loc), WebApp: &WebAppInfo{URL: adminURL}}},
				{{Text: BtnOpenApp(loc), WebApp: &WebAppInfo{URL: clientURL}}},
			},
		}
		_, err = h.Bot.SendMessageHTML(msg.Chat.ID, FormatWelcomeTrainer(loc, h.Version, clientURL), keyboard)
		if err != nil {
			log.Printf("Error sending trainer start message: %v", err)
		}
		return
	}

	// Check if client exists
	client, _ := db.GetClientByTelegramID(msg.From.ID, trainer.ID)
	if client == nil {
		// New user — show language selection (using Default() since language is not yet chosen;
		// Lang.* keys are bilingual and identical in both locales)
		defLoc := myI18n.Default()
		keyboard := &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{
					{Text: myI18n.T(defLoc, "Lang.Russian"), CallbackData: "lang:ru:" + trainer.ID},
					{Text: myI18n.T(defLoc, "Lang.English"), CallbackData: "lang:en:" + trainer.ID},
				},
			},
		}
		_, _ = h.Bot.SendMessage(msg.Chat.ID, myI18n.T(defLoc, "Lang.Choose"), keyboard)
		return
	}

	// Existing client
	lang := client.Language
	if lang == "" {
		lang = "ru"
	}
	loc := myI18n.NewLocalizer(lang)
	webAppURL := h.WebAppURL + "?trainer=" + trainer.ID + "&lang=" + lang

	// Set persistent menu button for client (opens booking app)
	if err := h.Bot.SetChatMenuButton(msg.Chat.ID, BtnOpenApp(loc), webAppURL); err != nil {
		log.Printf("Error setting client menu button: %v", err)
	}

	_, err = h.Bot.SendWebAppButton(msg.Chat.ID, FormatWelcome(loc, h.Version), webAppURL, BtnOpenApp(loc))
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
		loc := myI18n.Default()
		if trainer != nil {
			// Try to get client language
			client, _ := db.GetClientByTelegramID(msg.From.ID, trainer.ID)
			if client != nil {
				loc = myI18n.NewLocalizer(client.Language)
			}
		}
		_, err := h.Bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "Handler.TrainerOnly"), nil)
		if err != nil {
			log.Printf("Error sending admin denied message: %v", err)
		}
		return
	}

	lang := trainer.Language
	if lang == "" {
		lang = "ru"
	}
	loc := myI18n.NewLocalizer(lang)

	// Open admin panel with trainer ID
	adminURL := h.WebAppURL + "/admin?trainer=" + trainer.ID + "&lang=" + lang
	_, err = h.Bot.SendWebAppButton(msg.Chat.ID, myI18n.T(loc, "Handler.OpenAdmin"), adminURL, BtnOpenAdmin(loc))
	if err != nil {
		log.Printf("Error sending admin message: %v", err)
	}
}

func (h *Handler) handleHelp(msg *Message) {
	trainer, err := db.GetTrainerByBotToken(h.Bot.Token)
	if err != nil || trainer == nil {
		loc := myI18n.Default()
		_, _ = h.Bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "Help.Client"), nil)
		return
	}

	if trainer.TelegramUserID == msg.From.ID {
		loc := myI18n.NewLocalizer(trainer.Language)
		clientURL := "https://t.me/" + h.Bot.Username
		_, err = h.Bot.SendMessageHTML(msg.Chat.ID, FormatHelpTrainer(loc, clientURL), nil)
	} else {
		loc := myI18n.Default()
		client, _ := db.GetClientByTelegramID(msg.From.ID, trainer.ID)
		if client != nil {
			loc = myI18n.NewLocalizer(client.Language)
		}
		_, err = h.Bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "Help.Client"), nil)
	}
	if err != nil {
		log.Printf("Error sending help message: %v", err)
	}
}

func (h *Handler) handleCallbackQuery(update Update) {
	cq := update.CallbackQuery
	data := cq.Data

	// Handle language selection callback
	if strings.HasPrefix(data, "lang:") {
		h.handleLanguageCallback(update)
		return
	}

	parts := strings.SplitN(data, ":", 2)
	if len(parts) != 2 {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}

	action, bookingID := parts[0], parts[1]
	if action != "accept" && action != "reject" {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}

	// Get trainer for localizer
	trainer, _ := db.GetTrainerByBotToken(h.Bot.Token)
	loc := myI18n.Default()
	if trainer != nil {
		loc = myI18n.NewLocalizer(trainer.Language)
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil || booking == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.NotFound"))
		return
	}

	if booking.Status != models.BookingStatusPending {
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.AlreadyProcessed"))
		// Remove stale buttons
		if cq.Message != nil {
			h.UpdateBookingNotificationMessage(loc, cq.Message.Chat.ID, cq.Message.MessageID, booking)
		}
		return
	}

	var newStatus models.BookingStatus
	var toastText string
	if action == "accept" {
		newStatus = models.BookingStatusConfirmed
		toastText = myI18n.T(loc, "Callback.Confirmed")
	} else {
		newStatus = models.BookingStatusRejected
		toastText = myI18n.T(loc, "Callback.Rejected")
	}

	if err := db.UpdateBookingStatus(bookingID, newStatus); err != nil {
		log.Printf("Error updating booking via callback: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.Error"))
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
		h.UpdateBookingNotificationMessage(loc, cq.Message.Chat.ID, cq.Message.MessageID, booking)
	}

	// Notify client about status change
	h.NotifyClientStatusChange(booking, string(newStatus))
}

func (h *Handler) handleLanguageCallback(update Update) {
	cq := update.CallbackQuery
	data := cq.Data

	parts := strings.SplitN(data, ":", 3)
	if len(parts) != 3 {
		return
	}

	lang := parts[1]
	trainerID := parts[2]

	// Validate lang
	if lang != "ru" && lang != "en" {
		lang = "ru"
	}

	firstName := cq.From.FirstName
	if firstName == "" {
		firstName = "User"
	}

	// Create or get client
	client, err := db.GetOrCreateClient(cq.From.ID, trainerID, firstName)
	if err != nil {
		log.Printf("Error creating client: %v", err)
		return
	}

	// Update language
	db.UpdateClientLanguage(client.ID, lang)

	// Answer callback
	h.Bot.AnswerCallbackQuery(cq.ID, "")

	// Get trainer for URL
	trainer, _ := db.GetTrainerByID(trainerID)
	if trainer == nil {
		return
	}

	loc := myI18n.NewLocalizer(lang)
	webAppURL := h.WebAppURL + "?trainer=" + trainerID + "&lang=" + lang

	if err := h.Bot.SetChatMenuButton(cq.From.ID, BtnOpenApp(loc), webAppURL); err != nil {
		log.Printf("Error setting client menu button: %v", err)
	}

	_, _ = h.Bot.SendWebAppButton(cq.From.ID, FormatWelcome(loc, h.Version), webAppURL, BtnOpenApp(loc))
}

// localizerForClient returns a localizer for the client's language
func localizerForClient(clientID string) *i18n.Localizer {
	client, err := db.GetClientByID(clientID)
	if err != nil || client == nil {
		return myI18n.Default()
	}
	return myI18n.NewLocalizer(client.Language)
}

// localizerForTrainer returns a localizer for the trainer's language
func localizerForTrainer(trainerID string) *i18n.Localizer {
	trainer, err := db.GetTrainerByID(trainerID)
	if err != nil || trainer == nil {
		return myI18n.Default()
	}
	return myI18n.NewLocalizer(trainer.Language)
}

// NotifyClientStatusChange sends a notification to client when booking status changes via admin panel
func (h *Handler) NotifyClientStatusChange(booking *models.Booking, newStatus string) error {
	client, err := db.GetClientByID(booking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("error getting client: %w", err)
	}

	loc := myI18n.NewLocalizer(client.Language)

	var text string
	switch models.BookingStatus(newStatus) {
	case models.BookingStatusConfirmed:
		text = FormatBookingConfirmedClient(loc, booking)
	case models.BookingStatusRejected:
		text = FormatBookingRejectedClient(loc, booking)
	case models.BookingStatusCancelled:
		text = FormatBookingCancelledByTrainerClient(loc, booking)
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

	loc := myI18n.NewLocalizer(trainer.Language)

	text := FormatNewBookingMessage(loc, booking)
	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: BtnConfirm(loc), CallbackData: "accept:" + booking.ID},
				{Text: BtnReject(loc), CallbackData: "reject:" + booking.ID},
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
func (h *Handler) UpdateBookingNotificationMessage(loc *i18n.Localizer, chatID int64, messageID int, booking *models.Booking) error {
	var text string
	switch booking.Status {
	case models.BookingStatusConfirmed:
		text = FormatBookingAcceptedTrainer(loc, booking)
	case models.BookingStatusRejected:
		text = FormatBookingRejectedTrainer(loc, booking)
	case models.BookingStatusCancelled:
		text = myI18n.Tf(loc, "Booking.CancelledTrainerView", map[string]interface{}{
			"ClientName": booking.ClientName,
			"Service":    bookingServiceDisplay(loc, booking),
			"DateTime":   formatDateTime(loc, booking.StartsAt),
		})
	default:
		text = FormatNewBookingMessage(loc, booking)
	}
	return h.Bot.EditMessageText(chatID, messageID, text, nil)
}

// UpdateBookingNotificationMessageByIDs looks up trainer language and edits the notification
func (h *Handler) UpdateBookingNotificationMessageByIDs(chatID int64, messageID int, booking *models.Booking) error {
	loc := localizerForTrainer(booking.TrainerID)
	return h.UpdateBookingNotificationMessage(loc, chatID, messageID, booking)
}

// NotifyTrainerRecurringSchedule sends a recurring schedule approval request to trainer
func (h *Handler) NotifyTrainerRecurringSchedule(schedule *models.RecurringSchedule, previewCount int) error {
	trainer, err := db.GetTrainerByID(schedule.TrainerID)
	if err != nil || trainer == nil {
		return fmt.Errorf("error getting trainer: %v", err)
	}
	loc := myI18n.NewLocalizer(trainer.Language)
	text := FormatRecurringScheduleRequest(loc, schedule, previewCount)
	_, err = h.Bot.SendNotification(trainer.TelegramUserID, text)
	return err
}

// NotifyClientRecurringSchedule sends a recurring schedule confirmation request to client
func (h *Handler) NotifyClientRecurringSchedule(schedule *models.RecurringSchedule, previewCount int) error {
	client, err := db.GetClientByID(schedule.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("error getting client: %v", err)
	}
	loc := myI18n.NewLocalizer(client.Language)
	text := FormatRecurringScheduleRequestForClient(loc, schedule, previewCount)
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

	loc := myI18n.NewLocalizer(client.Language)
	text := FormatTrainerCreatedBookingClient(loc, booking)
	_, err = h.Bot.SendNotification(client.TelegramUserID, text)
	return err
}

// NotifyTrainerBookingCancelled sends a cancellation notification to the trainer
func (h *Handler) NotifyTrainerBookingCancelled(booking *models.Booking) error {
	trainer, err := db.GetTrainerByID(booking.TrainerID)
	if err != nil || trainer == nil {
		return fmt.Errorf("trainer not found")
	}
	loc := myI18n.NewLocalizer(trainer.Language)
	text := FormatBookingCancelledForTrainer(loc, booking)
	_, err = h.Bot.SendMessage(trainer.TelegramUserID, text, nil)
	return err
}

// NotifyClientBookingCancelled sends a cancellation notification to the client
func (h *Handler) NotifyClientBookingCancelled(booking *models.Booking) error {
	client, err := db.GetClientByID(booking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("client not found")
	}
	loc := myI18n.NewLocalizer(client.Language)
	text := FormatBookingCancelledForClient(loc, booking)
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
		loc := myI18n.NewLocalizer(trainer.Language)
		text := FormatMoveRequestForTrainer(loc, newBooking, oldBooking)
		_, err = h.Bot.SendNotification(trainer.TelegramUserID, text)
		return err
	}
	// Notify client
	client, err := db.GetClientByID(oldBooking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("client not found")
	}
	loc := myI18n.NewLocalizer(client.Language)
	text := FormatMoveRequestForClient(loc, newBooking, oldBooking)
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

	loc := myI18n.NewLocalizer(trainer.Language)

	var text string
	if accepted {
		text = FormatClientAcceptedBookingTrainer(loc, booking)
	} else {
		text = FormatClientDeclinedBookingTrainer(loc, booking)
	}

	_, err = h.Bot.SendMessage(trainer.TelegramUserID, text, nil)
	if err != nil {
		log.Printf("Error notifying trainer: %v", err)
	}
}
