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
	case "accept_schedule":
		h.handleAcceptSchedule(cq, bookingID) // bookingID is actually scheduleID
	case "reject_schedule":
		h.handleRejectSchedule(cq, bookingID) // bookingID is actually scheduleID
	case "client_accept":
		h.handleClientAcceptBooking(cq, bookingID)
	case "client_decline":
		h.handleClientDeclineBooking(cq, bookingID)
	case "client_accept_schedule":
		h.handleClientAcceptSchedule(cq, bookingID) // bookingID is actually scheduleID
	case "client_decline_schedule":
		h.handleClientDeclineSchedule(cq, bookingID) // bookingID is actually scheduleID
	case "cancel_approve":
		h.handleCancelApprove(cq, bookingID)
	case "cancel_decline":
		h.handleCancelDecline(cq, bookingID)
	case "move_approve":
		h.handleMoveApprove(cq, bookingID) // bookingID is actually newBookingID
	case "move_decline":
		h.handleMoveDecline(cq, bookingID) // bookingID is actually newBookingID
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

func (h *Handler) handleAcceptSchedule(cq *CallbackQuery, scheduleID string) {
	schedule, err := db.GetRecurringScheduleByID(scheduleID)
	if err != nil || schedule == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Расписание не найдено")
		return
	}

	if schedule.Status != models.RecurringScheduleStatusPending {
		h.Bot.AnswerCallbackQuery(cq.ID, "Расписание уже обработано")
		if cq.Message != nil {
			h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
				FormatRecurringScheduleApproved(schedule, 0), nil)
		}
		return
	}

	count, err := db.ApproveAndGenerateBookings(scheduleID)
	if err != nil {
		log.Printf("Error approving schedule %s: %v", scheduleID, err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при подтверждении")
		return
	}

	h.Bot.AnswerCallbackQuery(cq.ID, fmt.Sprintf("Подтверждено: %d записей", count))

	if cq.Message != nil {
		h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
			FormatRecurringScheduleApproved(schedule, count), nil)
	}

	// Notify client about approval
	h.notifyRecurringScheduleResult(schedule, true, count)
}

func (h *Handler) handleRejectSchedule(cq *CallbackQuery, scheduleID string) {
	schedule, err := db.GetRecurringScheduleByID(scheduleID)
	if err != nil || schedule == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Расписание не найдено")
		return
	}

	if schedule.Status != models.RecurringScheduleStatusPending {
		h.Bot.AnswerCallbackQuery(cq.ID, "Расписание уже обработано")
		if cq.Message != nil {
			h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
				FormatRecurringScheduleDeclined(schedule), nil)
		}
		return
	}

	if err := db.UpdateRecurringScheduleStatus(scheduleID, models.RecurringScheduleStatusDeclined); err != nil {
		log.Printf("Error declining schedule %s: %v", scheduleID, err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при отклонении")
		return
	}

	h.Bot.AnswerCallbackQuery(cq.ID, "Расписание отклонено")

	if cq.Message != nil {
		h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
			FormatRecurringScheduleDeclined(schedule), nil)
	}

	// Notify client about decline
	h.notifyRecurringScheduleResult(schedule, false, 0)
}

// handleClientAcceptSchedule handles client accepting a trainer-created recurring schedule
func (h *Handler) handleClientAcceptSchedule(cq *CallbackQuery, scheduleID string) {
	schedule, err := db.GetRecurringScheduleByID(scheduleID)
	if err != nil || schedule == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Расписание не найдено")
		return
	}

	if schedule.Status != models.RecurringScheduleStatusPending {
		h.Bot.AnswerCallbackQuery(cq.ID, "Расписание уже обработано")
		if cq.Message != nil {
			h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
				FormatRecurringScheduleApprovedClient(schedule, 0), nil)
		}
		return
	}

	count, err := db.ApproveAndGenerateBookings(scheduleID)
	if err != nil {
		log.Printf("Error approving schedule %s: %v", scheduleID, err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при подтверждении")
		return
	}

	h.Bot.AnswerCallbackQuery(cq.ID, fmt.Sprintf("Подтверждено: %d записей", count))

	if cq.Message != nil {
		h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
			FormatRecurringScheduleApprovedClient(schedule, count), nil)
	}

	// Notify trainer that client accepted
	h.notifyRecurringScheduleResultToTrainer(schedule, true, count)
}

// handleClientDeclineSchedule handles client declining a trainer-created recurring schedule
func (h *Handler) handleClientDeclineSchedule(cq *CallbackQuery, scheduleID string) {
	schedule, err := db.GetRecurringScheduleByID(scheduleID)
	if err != nil || schedule == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Расписание не найдено")
		return
	}

	if schedule.Status != models.RecurringScheduleStatusPending {
		h.Bot.AnswerCallbackQuery(cq.ID, "Расписание уже обработано")
		if cq.Message != nil {
			h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
				FormatRecurringScheduleDeclinedClient(schedule), nil)
		}
		return
	}

	if err := db.UpdateRecurringScheduleStatus(scheduleID, models.RecurringScheduleStatusDeclined); err != nil {
		log.Printf("Error declining schedule %s: %v", scheduleID, err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при отклонении")
		return
	}

	h.Bot.AnswerCallbackQuery(cq.ID, "Расписание отклонено")

	if cq.Message != nil {
		h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
			FormatRecurringScheduleDeclinedClient(schedule), nil)
	}

	// Notify trainer that client declined
	h.notifyRecurringScheduleResultToTrainer(schedule, false, 0)
}

// notifyRecurringScheduleResult notifies the client about approval/decline by trainer
func (h *Handler) notifyRecurringScheduleResult(schedule *models.RecurringSchedule, approved bool, count int) {
	client, err := db.GetClientByID(schedule.ClientID)
	if err != nil || client == nil {
		log.Printf("Error getting client for schedule notification: %v", err)
		return
	}

	var text string
	if approved {
		text = FormatRecurringScheduleApprovedClient(schedule, count)
	} else {
		text = FormatRecurringScheduleDeclinedClient(schedule)
	}

	if _, err := h.Bot.SendMessage(client.TelegramUserID, text, nil); err != nil {
		log.Printf("Error notifying client about schedule: %v", err)
	}
}

// notifyRecurringScheduleResultToTrainer notifies the trainer about client accept/decline
func (h *Handler) notifyRecurringScheduleResultToTrainer(schedule *models.RecurringSchedule, accepted bool, count int) {
	trainer, err := db.GetTrainerByID(schedule.TrainerID)
	if err != nil || trainer == nil {
		log.Printf("Error getting trainer for schedule notification: %v", err)
		return
	}

	var text string
	if accepted {
		text = FormatRecurringScheduleApproved(schedule, count)
	} else {
		text = FormatRecurringScheduleDeclined(schedule)
	}

	if _, err := h.Bot.SendMessage(trainer.TelegramUserID, text, nil); err != nil {
		log.Printf("Error notifying trainer about schedule: %v", err)
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
	msg, err := h.Bot.SendBookingApprovalMessage(trainer.TelegramUserID, booking.ID, text)
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
	_, err = h.Bot.SendRecurringScheduleApprovalMessage(trainer.TelegramUserID, schedule.ID, text)
	return err
}

// NotifyClientRecurringSchedule sends a recurring schedule confirmation request to client
func (h *Handler) NotifyClientRecurringSchedule(schedule *models.RecurringSchedule, previewCount int) error {
	client, err := db.GetClientByID(schedule.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("error getting client: %v", err)
	}
	text := FormatRecurringScheduleRequestForClient(schedule, previewCount)
	_, err = h.Bot.SendRecurringScheduleClientApprovalMessage(client.TelegramUserID, schedule.ID, text)
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
	_, err = h.Bot.SendMessage(client.TelegramUserID, text, nil)
	return err
}

func (h *Handler) handleClientAcceptBooking(cq *CallbackQuery, bookingID string) {
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
		if cq.Message != nil {
			h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
				FormatBookingConfirmedClient(booking), nil)
		}
		return
	}

	// Confirm the booking
	if err := db.UpdateBookingStatus(bookingID, models.BookingStatusConfirmed); err != nil {
		log.Printf("Error updating booking status: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при обновлении статуса")
		return
	}

	booking, _ = db.GetBookingByID(bookingID)

	h.Bot.AnswerCallbackQuery(cq.ID, "Запись подтверждена!")

	// Update client's message
	if cq.Message != nil {
		h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
			FormatBookingConfirmedClient(booking), nil)
	}

	// Notify trainer that client accepted
	h.notifyTrainerClientResponse(booking, true)
}

func (h *Handler) handleClientDeclineBooking(cq *CallbackQuery, bookingID string) {
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
		if cq.Message != nil {
			h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
				FormatBookingRejectedClient(booking), nil)
		}
		return
	}

	// Cancel the booking
	if err := db.CancelBooking(bookingID, "", models.CancelledByClient); err != nil {
		log.Printf("Error cancelling booking: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при обновлении статуса")
		return
	}

	booking, _ = db.GetBookingByID(bookingID)

	h.Bot.AnswerCallbackQuery(cq.ID, "Запись отклонена")

	// Update client's message
	if cq.Message != nil {
		h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
			"❌ Вы отклонили запись от тренера.", nil)
	}

	// Notify trainer that client declined
	h.notifyTrainerClientResponse(booking, false)
}

// ========== Cancel/Move Approval Handlers ==========

func (h *Handler) handleCancelApprove(cq *CallbackQuery, bookingID string) {
	booking, err := db.GetBookingByID(bookingID)
	if err != nil || booking == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запись не найдена")
		return
	}
	if booking.Status != models.BookingStatusCancelRequested {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запрос уже обработан")
		if cq.Message != nil {
			h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID, FormatCancelApproved(booking), nil)
		}
		return
	}

	if err := db.ApproveCancelBooking(bookingID); err != nil {
		log.Printf("Error approving cancel: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при подтверждении")
		return
	}

	h.Bot.AnswerCallbackQuery(cq.ID, "Отмена подтверждена")
	if cq.Message != nil {
		h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID, FormatCancelApproved(booking), nil)
	}

	// Notify the other side
	h.notifyCancelResult(booking, true)
}

func (h *Handler) handleCancelDecline(cq *CallbackQuery, bookingID string) {
	booking, err := db.GetBookingByID(bookingID)
	if err != nil || booking == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запись не найдена")
		return
	}
	if booking.Status != models.BookingStatusCancelRequested {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запрос уже обработан")
		if cq.Message != nil {
			h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID, FormatCancelDeclined(booking), nil)
		}
		return
	}

	if err := db.DeclineCancelBooking(bookingID); err != nil {
		log.Printf("Error declining cancel: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при отклонении")
		return
	}

	h.Bot.AnswerCallbackQuery(cq.ID, "Отмена отклонена")
	if cq.Message != nil {
		h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID, FormatCancelDeclined(booking), nil)
	}

	// Notify the other side
	h.notifyCancelResult(booking, false)
}

func (h *Handler) handleMoveApprove(cq *CallbackQuery, newBookingID string) {
	newBooking, err := db.GetBookingByID(newBookingID)
	if err != nil || newBooking == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запись не найдена")
		return
	}
	if newBooking.Status != models.BookingStatusReschedulePending {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запрос уже обработан")
		return
	}

	oldBooking, _ := db.GetBookingByID(newBooking.ReplacesBookingID)

	if err := db.ApproveRescheduleBooking(newBookingID); err != nil {
		log.Printf("Error approving move: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при подтверждении")
		return
	}

	h.Bot.AnswerCallbackQuery(cq.ID, "Перенос подтверждён")
	if cq.Message != nil && oldBooking != nil {
		h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID, FormatMoveApproved(newBooking, oldBooking), nil)
	}

	// Notify the other side
	h.notifyMoveResult(newBooking, oldBooking, true)
}

func (h *Handler) handleMoveDecline(cq *CallbackQuery, newBookingID string) {
	newBooking, err := db.GetBookingByID(newBookingID)
	if err != nil || newBooking == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запись не найдена")
		return
	}
	if newBooking.Status != models.BookingStatusReschedulePending {
		h.Bot.AnswerCallbackQuery(cq.ID, "Запрос уже обработан")
		return
	}

	oldBooking, _ := db.GetBookingByID(newBooking.ReplacesBookingID)

	if err := db.DeclineRescheduleBooking(newBookingID); err != nil {
		log.Printf("Error declining move: %v", err)
		h.Bot.AnswerCallbackQuery(cq.ID, "Ошибка при отклонении")
		return
	}

	h.Bot.AnswerCallbackQuery(cq.ID, "Перенос отклонён")
	if cq.Message != nil && oldBooking != nil {
		h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID, FormatMoveDeclined(oldBooking), nil)
	}

	// Notify the other side
	h.notifyMoveResult(newBooking, oldBooking, false)
}

func (h *Handler) notifyCancelResult(booking *models.Booking, approved bool) {
	// Determine who requested: if cancelled_by=client, notify client; if trainer, notify trainer
	// The approver is the other side, so we notify the requester about the result
	if booking.CancelledBy == models.CancelledByClient {
		// Client requested, trainer decided — notify client
		client, err := db.GetClientByID(booking.ClientID)
		if err != nil || client == nil {
			return
		}
		var text string
		if approved {
			text = fmt.Sprintf("✅ Ваш запрос на отмену подтверждён\n\n📋 %s\n🕐 %s", bookingServiceDisplay(booking), formatDateTime(booking.StartsAt))
		} else {
			text = fmt.Sprintf("↩️ Ваш запрос на отмену отклонён\n\n📋 %s\n🕐 %s\n\nТренировка остаётся в расписании.", bookingServiceDisplay(booking), formatDateTime(booking.StartsAt))
		}
		h.Bot.SendMessage(client.TelegramUserID, text, nil)
	} else {
		// Trainer requested, client decided — notify trainer
		trainer, err := db.GetTrainerByID(booking.TrainerID)
		if err != nil || trainer == nil {
			return
		}
		var text string
		if approved {
			text = FormatCancelApproved(booking)
		} else {
			text = FormatCancelDeclined(booking)
		}
		h.Bot.SendMessage(trainer.TelegramUserID, text, nil)
	}
}

func (h *Handler) notifyMoveResult(newBooking, oldBooking *models.Booking, approved bool) {
	if oldBooking == nil {
		return
	}
	// Determine who to notify based on who sees the Telegram buttons
	// For simplicity: notify client and trainer about the result
	client, _ := db.GetClientByID(oldBooking.ClientID)
	trainer, _ := db.GetTrainerByID(oldBooking.TrainerID)

	if client != nil {
		var text string
		if approved {
			text = fmt.Sprintf("✅ Перенос подтверждён\n\n📋 %s\n🕐 Было: %s\n🕐 Новое: %s",
				bookingServiceDisplay(oldBooking), formatDateTime(oldBooking.StartsAt), formatDateTime(newBooking.StartsAt))
		} else {
			text = fmt.Sprintf("↩️ Перенос отклонён\n\n📋 %s\n🕐 %s\n\nТренировка остаётся в расписании.",
				bookingServiceDisplay(oldBooking), formatDateTime(oldBooking.StartsAt))
		}
		h.Bot.SendMessage(client.TelegramUserID, text, nil)
	}
	if trainer != nil {
		var text string
		if approved {
			text = FormatMoveApproved(newBooking, oldBooking)
		} else {
			text = FormatMoveDeclined(oldBooking)
		}
		h.Bot.SendMessage(trainer.TelegramUserID, text, nil)
	}
}

// NotifyCancelRequest sends a cancel request notification with approval buttons
func (h *Handler) NotifyCancelRequest(booking *models.Booking, requestedBy string) error {
	if requestedBy == "client" {
		// Notify trainer
		trainer, err := db.GetTrainerByID(booking.TrainerID)
		if err != nil || trainer == nil {
			return fmt.Errorf("trainer not found")
		}
		text := FormatCancelRequestForTrainer(booking)
		_, err = h.Bot.SendCancelApprovalMessage(trainer.TelegramUserID, booking.ID, text)
		return err
	}
	// Notify client
	client, err := db.GetClientByID(booking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("client not found")
	}
	text := FormatCancelRequestForClient(booking)
	_, err = h.Bot.SendCancelApprovalMessage(client.TelegramUserID, booking.ID, text)
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
		_, err = h.Bot.SendMoveApprovalMessage(trainer.TelegramUserID, newBooking.ID, text)
		return err
	}
	// Notify client
	client, err := db.GetClientByID(oldBooking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("client not found")
	}
	text := FormatMoveRequestForClient(newBooking, oldBooking)
	_, err = h.Bot.SendMoveApprovalMessage(client.TelegramUserID, newBooking.ID, text)
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
