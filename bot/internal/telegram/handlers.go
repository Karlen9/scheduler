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

/***************************************************************************************************
* Handler handles Telegram updates.
***************************************************************************************************/
type Handler struct {
	Bot       *Bot
	WebAppURL string
	Version   string
}

/***************************************************************************************************
* NewHandler creates a new Handler.
*
* Parameters:
* - bot: Bot used by the current operation.
* - webAppURL: Web app url used by the current operation.
*
* Returns:
* - The computed value for the current operation as *Handler.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func NewHandler(bot *Bot, webAppURL string) *Handler {
	return &Handler{
		Bot:       bot,
		WebAppURL: webAppURL,
	}
}

/***************************************************************************************************
* HandleUpdate processes an incoming update.
*
* Parameters:
* - update: Date value used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) HandleUpdate(update Update) {
	if update.Message != nil {
		h.handleMessage(update.Message)
	}
	if update.CallbackQuery != nil {
		h.handleCallbackQuery(update)
	}
}

/***************************************************************************************************
* Handles message.
*
* Parameters:
* - msg: Msg used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
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

/***************************************************************************************************
* Handles start.
*
* Parameters:
* - msg: Msg used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) handleStart(msg *Message) {
	/***************************************************************************************************
	* Get specialist by bot token to include specialist ID in URL.
	***************************************************************************************************/
	specialist, err := db.GetSpecialistByBotToken(h.Bot.Token)
	if err != nil || specialist == nil {
		log.Printf("Error getting specialist for bot: %v", err)
		loc := myI18n.Default()
		_, _ = h.Bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "Handler.ConfigError"), nil)
		return
	}

	/***************************************************************************************************
	* Check if the user is the specialist (owner of this bot).
	***************************************************************************************************/
	if specialist.TelegramUserID == msg.From.ID {
		lang := specialist.Language
		if lang == "" {
			lang = "ru"
		}
		loc := myI18n.NewLocalizer(lang)
		adminURL := h.WebAppURL + "/admin?specialist=" + specialist.ID + "&lang=" + lang
		clientURL := h.WebAppURL + "?specialist=" + specialist.ID + "&lang=" + lang

		/***************************************************************************************************
		* Set persistent menu button for specialist (opens admin panel).
		***************************************************************************************************/
		if err := h.Bot.SetChatMenuButton(msg.Chat.ID, BtnOpenAdmin(loc), adminURL); err != nil {
			log.Printf("Error setting specialist menu button: %v", err)
		}

		keyboard := &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{{Text: BtnOpenAdmin(loc), WebApp: &WebAppInfo{URL: adminURL}}},
				{{Text: BtnOpenApp(loc), WebApp: &WebAppInfo{URL: clientURL}}},
			},
		}
		_, err = h.Bot.SendMessageHTML(msg.Chat.ID, FormatWelcomeSpecialist(loc, h.Version, clientURL), keyboard)
		if err != nil {
			log.Printf("Error sending specialist start message: %v", err)
		}
		return
	}

	/***************************************************************************************************
	* Check if client exists.
	***************************************************************************************************/
	client, _ := db.GetClientByTelegramID(msg.From.ID, specialist.ID)
	if client == nil {
		/***************************************************************************************************
		* New user — show language selection (using Default() since language is not yet chosen; Lang.*
		* keys are bilingual and identical in both locales).
		***************************************************************************************************/
		defLoc := myI18n.Default()
		keyboard := &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{
					{Text: myI18n.T(defLoc, "Lang.Russian"), CallbackData: "lang:ru:" + specialist.ID},
					{Text: myI18n.T(defLoc, "Lang.English"), CallbackData: "lang:en:" + specialist.ID},
				},
			},
		}
		_, _ = h.Bot.SendMessage(msg.Chat.ID, myI18n.T(defLoc, "Lang.Choose"), keyboard)
		return
	}

	/***************************************************************************************************
	* Existing client.
	***************************************************************************************************/
	lang := client.Language
	if lang == "" {
		lang = "ru"
	}
	loc := myI18n.NewLocalizer(lang)
	webAppURL := h.WebAppURL + "?specialist=" + specialist.ID + "&lang=" + lang

	/***************************************************************************************************
	* Set persistent menu button for client (opens booking app).
	***************************************************************************************************/
	if err := h.Bot.SetChatMenuButton(msg.Chat.ID, BtnOpenApp(loc), webAppURL); err != nil {
		log.Printf("Error setting client menu button: %v", err)
	}

	_, err = h.Bot.SendWebAppButton(msg.Chat.ID, FormatWelcome(loc, h.Version), webAppURL, BtnOpenApp(loc))
	if err != nil {
		log.Printf("Error sending start message: %v", err)
	}
}

/***************************************************************************************************
* Handles admin.
*
* Parameters:
* - msg: Msg used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) handleAdmin(msg *Message) {
	/***************************************************************************************************
	* Check if user is the specialist (owner of this bot).
	***************************************************************************************************/
	specialist, err := db.GetSpecialistByBotToken(h.Bot.Token)
	if err != nil {
		log.Printf("Error getting specialist: %v", err)
		return
	}

	if specialist == nil || specialist.TelegramUserID != msg.From.ID {
		loc := myI18n.Default()
		if specialist != nil {
			/***************************************************************************************************
			* Try to get client language.
			***************************************************************************************************/
			client, _ := db.GetClientByTelegramID(msg.From.ID, specialist.ID)
			if client != nil {
				loc = myI18n.NewLocalizer(client.Language)
			}
		}
		_, err := h.Bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "Handler.SpecialistOnly"), nil)
		if err != nil {
			log.Printf("Error sending admin denied message: %v", err)
		}
		return
	}

	lang := specialist.Language
	if lang == "" {
		lang = "ru"
	}
	loc := myI18n.NewLocalizer(lang)

	/***************************************************************************************************
	* Open admin panel with specialist ID.
	***************************************************************************************************/
	adminURL := h.WebAppURL + "/admin?specialist=" + specialist.ID + "&lang=" + lang
	_, err = h.Bot.SendWebAppButton(msg.Chat.ID, myI18n.T(loc, "Handler.OpenAdmin"), adminURL, BtnOpenAdmin(loc))
	if err != nil {
		log.Printf("Error sending admin message: %v", err)
	}
}

/***************************************************************************************************
* Handles help.
*
* Parameters:
* - msg: Msg used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) handleHelp(msg *Message) {
	specialist, err := db.GetSpecialistByBotToken(h.Bot.Token)
	if err != nil || specialist == nil {
		loc := myI18n.Default()
		_, _ = h.Bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "Help.Client"), nil)
		return
	}

	if specialist.TelegramUserID == msg.From.ID {
		loc := myI18n.NewLocalizer(specialist.Language)
		clientURL := "https://t.me/" + h.Bot.Username
		_, err = h.Bot.SendMessageHTML(msg.Chat.ID, FormatHelpSpecialist(loc, clientURL), nil)
	} else {
		loc := myI18n.Default()
		client, _ := db.GetClientByTelegramID(msg.From.ID, specialist.ID)
		if client != nil {
			loc = myI18n.NewLocalizer(client.Language)
		}
		_, err = h.Bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "Help.Client"), nil)
	}
	if err != nil {
		log.Printf("Error sending help message: %v", err)
	}
}

/***************************************************************************************************
* Handles callback query.
*
* Parameters:
* - update: Date value used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) handleCallbackQuery(update Update) {
	cq := update.CallbackQuery
	data := cq.Data

	/***************************************************************************************************
	* Handle language selection callback.
	***************************************************************************************************/
	if strings.HasPrefix(data, "lang:") {
		h.handleLanguageCallback(update)
		return
	}

	/***************************************************************************************************
	* Handle client accept/decline callback.
	***************************************************************************************************/
	if strings.HasPrefix(data, "client_accept:") || strings.HasPrefix(data, "client_decline:") {
		h.handleClientBookingCallback(update)
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

	/***************************************************************************************************
	* Get specialist for localizer.
	***************************************************************************************************/
	specialist, _ := db.GetSpecialistByBotToken(h.Bot.Token)
	loc := myI18n.Default()
	if specialist != nil {
		loc = myI18n.NewLocalizer(specialist.Language)
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil || booking == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.NotFound"))
		return
	}

	if booking.Status != models.BookingStatusPending {
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.AlreadyProcessed"))
		/***************************************************************************************************
		* Remove stale buttons.
		***************************************************************************************************/
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

	/***************************************************************************************************
	* Refresh booking for notification messages.
	***************************************************************************************************/
	booking, _ = db.GetBookingByID(bookingID)
	if booking == nil {
		return
	}

	/***************************************************************************************************
	* Edit the specialist's message to remove buttons and show new status.
	***************************************************************************************************/
	if cq.Message != nil {
		h.UpdateBookingNotificationMessage(loc, cq.Message.Chat.ID, cq.Message.MessageID, booking)
	}

	/***************************************************************************************************
	* Notify client about status change.
	***************************************************************************************************/
	h.NotifyClientStatusChange(booking, string(newStatus))
}

/***************************************************************************************************
* Handles language callback.
*
* Parameters:
* - update: Date value used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) handleLanguageCallback(update Update) {
	cq := update.CallbackQuery
	data := cq.Data

	parts := strings.SplitN(data, ":", 3)
	if len(parts) != 3 {
		return
	}

	lang := parts[1]
	specialistID := parts[2]

	/***************************************************************************************************
	* Validate lang.
	***************************************************************************************************/
	if lang != "ru" && lang != "en" {
		lang = "ru"
	}

	firstName := cq.From.FirstName
	if firstName == "" {
		firstName = "User"
	}

	/***************************************************************************************************
	* Create or get client.
	***************************************************************************************************/
	client, err := db.GetOrCreateClient(cq.From.ID, specialistID, firstName)
	if err != nil {
		log.Printf("Error creating client: %v", err)
		return
	}

	/***************************************************************************************************
	* Update language.
	***************************************************************************************************/
	db.UpdateClientLanguage(client.ID, lang)

	/***************************************************************************************************
	* Answer callback.
	***************************************************************************************************/
	h.Bot.AnswerCallbackQuery(cq.ID, "")

	/***************************************************************************************************
	* Get specialist for URL.
	***************************************************************************************************/
	specialist, _ := db.GetSpecialistByID(specialistID)
	if specialist == nil {
		return
	}

	loc := myI18n.NewLocalizer(lang)
	webAppURL := h.WebAppURL + "?specialist=" + specialistID + "&lang=" + lang

	if err := h.Bot.SetChatMenuButton(cq.From.ID, BtnOpenApp(loc), webAppURL); err != nil {
		log.Printf("Error setting client menu button: %v", err)
	}

	_, _ = h.Bot.SendWebAppButton(cq.From.ID, FormatWelcome(loc, h.Version), webAppURL, BtnOpenApp(loc))
}

/***************************************************************************************************
* Handles client booking callback.
*
* Parameters:
* - update: Date value used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) handleClientBookingCallback(update Update) {
	cq := update.CallbackQuery
	data := cq.Data

	parts := strings.SplitN(data, ":", 2)
	if len(parts) != 2 {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}

	action, bookingID := parts[0], parts[1]

	/***************************************************************************************************
	* Get specialist to identify which bot this is.
	***************************************************************************************************/
	specialist, _ := db.GetSpecialistByBotToken(h.Bot.Token)
	if specialist == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}

	/***************************************************************************************************
	* Get client by telegram user ID.
	***************************************************************************************************/
	client, _ := db.GetClientByTelegramID(cq.From.ID, specialist.ID)
	if client == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}

	loc := myI18n.NewLocalizer(client.Language)

	booking, err := db.GetBookingByID(bookingID)
	if err != nil || booking == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.NotFound"))
		return
	}

	/***************************************************************************************************
	* Validate: client owns booking, booking is pending, and was created by specialist.
	***************************************************************************************************/
	if booking.ClientID != client.ID {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}
	if booking.Status != models.BookingStatusPending || booking.CreatedBy != "specialist" {
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.AlreadyProcessed"))
		if cq.Message != nil {
			h.UpdateClientNotificationMessage(loc, cq.Message.Chat.ID, cq.Message.MessageID, booking)
		}
		return
	}

	accepted := action == "client_accept"
	var toastText string

	if accepted {
		if err := db.UpdateBookingStatus(bookingID, models.BookingStatusConfirmed); err != nil {
			log.Printf("Error confirming booking via client callback: %v", err)
			h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.Error"))
			return
		}
		toastText = myI18n.T(loc, "Callback.ClientConfirmed")
	} else {
		if err := db.CancelBooking(bookingID, "", models.CancelledByClient); err != nil {
			log.Printf("Error declining booking via client callback: %v", err)
			h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.Error"))
			return
		}
		toastText = myI18n.T(loc, "Callback.ClientDeclined")
	}

	h.Bot.AnswerCallbackQuery(cq.ID, toastText)

	/***************************************************************************************************
	* Refresh booking.
	***************************************************************************************************/
	booking, _ = db.GetBookingByID(bookingID)
	if booking == nil {
		return
	}

	/***************************************************************************************************
	* Edit client's message to remove buttons and show result.
	***************************************************************************************************/
	if cq.Message != nil {
		h.UpdateClientNotificationMessage(loc, cq.Message.Chat.ID, cq.Message.MessageID, booking)
	}

	/***************************************************************************************************
	* Notify specialist about client's response.
	***************************************************************************************************/
	h.notifySpecialistClientResponse(booking, accepted)
}

/***************************************************************************************************
* UpdateClientNotificationMessage edits the client's booking notification to reflect the new
* status.
*
* Parameters:
* - loc: Loc used by the current operation.
* - chatID: Identifier used to target the current record.
* - messageID: Identifier used to target the current record.
* - booking: Booking used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) UpdateClientNotificationMessage(loc *i18n.Localizer, chatID int64, messageID int, booking *models.Booking) error {
	var text string
	switch booking.Status {
	case models.BookingStatusConfirmed:
		text = FormatSpecialistCreatedBookingClientAccepted(loc, booking)
	case models.BookingStatusCancelled, models.BookingStatusRejected:
		text = FormatSpecialistCreatedBookingClientDeclined(loc, booking)
	default:
		text = FormatSpecialistCreatedBookingClient(loc, booking)
	}
	return h.Bot.EditMessageText(chatID, messageID, text, nil)
}

/***************************************************************************************************
* localizerForClient returns a localizer for the client's language.
*
* Parameters:
* - clientID: Identifier used to target the current record.
*
* Returns:
* - The computed value for the current operation as *i18n.Localizer.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func localizerForClient(clientID string) *i18n.Localizer {
	client, err := db.GetClientByID(clientID)
	if err != nil || client == nil {
		return myI18n.Default()
	}
	return myI18n.NewLocalizer(client.Language)
}

/***************************************************************************************************
* localizerForSpecialist returns a localizer for the specialist's language.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
*
* Returns:
* - The computed value for the current operation as *i18n.Localizer.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func localizerForSpecialist(specialistID string) *i18n.Localizer {
	specialist, err := db.GetSpecialistByID(specialistID)
	if err != nil || specialist == nil {
		return myI18n.Default()
	}
	return myI18n.NewLocalizer(specialist.Language)
}

/***************************************************************************************************
* NotifyClientStatusChange sends a notification to client when booking status changes via admin
* panel.
*
* Parameters:
* - booking: Booking used by the current operation.
* - newStatus: New status used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
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
		text = FormatBookingCancelledBySpecialistClient(loc, booking)
	default:
		return nil
	}

	_, err = h.Bot.SendMessage(client.TelegramUserID, text, nil)
	return err
}

/***************************************************************************************************
* NotifySpecialistNewBooking sends a notification to specialist about a new booking.
*
* Parameters:
* - booking: Booking used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) NotifySpecialistNewBooking(booking *models.Booking) error {
	specialist, err := db.GetSpecialistByID(booking.SpecialistID)
	if err != nil || specialist == nil {
		return err
	}

	loc := myI18n.NewLocalizer(specialist.Language)

	text := FormatNewBookingMessage(loc, booking)
	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: BtnConfirm(loc), CallbackData: "accept:" + booking.ID},
				{Text: BtnReject(loc), CallbackData: "reject:" + booking.ID},
			},
		},
	}
	msg, err := h.Bot.SendMessage(specialist.TelegramUserID, text, keyboard)
	if err != nil {
		return err
	}

	/***************************************************************************************************
	* Save message info so admin panel can edit it later.
	***************************************************************************************************/
	if msg != nil {
		db.SaveBookingNotificationInfo(booking.ID, specialist.TelegramUserID, msg.MessageID)
	}
	return nil
}

/***************************************************************************************************
* UpdateBookingNotificationMessage edits the specialist's original booking notification to reflect
* the new status (removes inline buttons).
*
* Parameters:
* - loc: Loc used by the current operation.
* - chatID: Identifier used to target the current record.
* - messageID: Identifier used to target the current record.
* - booking: Booking used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) UpdateBookingNotificationMessage(loc *i18n.Localizer, chatID int64, messageID int, booking *models.Booking) error {
	var text string
	switch booking.Status {
	case models.BookingStatusConfirmed:
		text = FormatBookingAcceptedSpecialist(loc, booking)
	case models.BookingStatusRejected:
		text = FormatBookingRejectedSpecialist(loc, booking)
	case models.BookingStatusCancelled:
		text = myI18n.Tf(loc, "Booking.CancelledSpecialistView", map[string]interface{}{
			"ClientName": booking.ClientName,
			"Service":    bookingServiceDisplay(loc, booking),
			"DateTime":   formatDateTime(loc, booking.StartsAt),
		})
	default:
		text = FormatNewBookingMessage(loc, booking)
	}
	return h.Bot.EditMessageText(chatID, messageID, text, nil)
}

/***************************************************************************************************
* UpdateBookingNotificationMessageByIDs looks up specialist language and edits the notification.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - messageID: Identifier used to target the current record.
* - booking: Booking used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) UpdateBookingNotificationMessageByIDs(chatID int64, messageID int, booking *models.Booking) error {
	loc := localizerForSpecialist(booking.SpecialistID)
	return h.UpdateBookingNotificationMessage(loc, chatID, messageID, booking)
}

/***************************************************************************************************
* NotifySpecialistRecurringSchedule sends a recurring schedule approval request to specialist.
*
* Parameters:
* - schedule: Schedule used by the current operation.
* - previewCount: Preview count used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) NotifySpecialistRecurringSchedule(schedule *models.RecurringSchedule, previewCount int) error {
	specialist, err := db.GetSpecialistByID(schedule.SpecialistID)
	if err != nil || specialist == nil {
		return fmt.Errorf("error getting specialist: %v", err)
	}
	loc := myI18n.NewLocalizer(specialist.Language)
	text := FormatRecurringScheduleRequest(loc, schedule, previewCount)
	_, err = h.Bot.SendNotification(specialist.TelegramUserID, text)
	return err
}

/***************************************************************************************************
* NotifyClientRecurringSchedule sends a recurring schedule confirmation request to client.
*
* Parameters:
* - schedule: Schedule used by the current operation.
* - previewCount: Preview count used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
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

/***************************************************************************************************
* NotifyClientSpecialistBooking sends a specialist-created booking confirmation request to client.
*
* Parameters:
* - booking: Booking used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) NotifyClientSpecialistBooking(booking *models.Booking) error {
	client, err := db.GetClientByID(booking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("error getting client: %v", err)
	}

	loc := myI18n.NewLocalizer(client.Language)
	text := FormatSpecialistCreatedBookingClient(loc, booking)
	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: BtnAccept(loc), CallbackData: "client_accept:" + booking.ID},
				{Text: BtnDecline(loc), CallbackData: "client_decline:" + booking.ID},
			},
		},
	}
	msg, err := h.Bot.SendMessage(client.TelegramUserID, text, keyboard)
	if err != nil {
		return err
	}

	/***************************************************************************************************
	* Save message info so we can edit it later (remove buttons).
	***************************************************************************************************/
	if msg != nil {
		db.SaveClientNotificationInfo(booking.ID, client.TelegramUserID, msg.MessageID)
	}
	return nil
}

/***************************************************************************************************
* NotifySpecialistBookingCancelled sends a cancellation notification to the specialist.
*
* Parameters:
* - booking: Booking used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) NotifySpecialistBookingCancelled(booking *models.Booking) error {
	specialist, err := db.GetSpecialistByID(booking.SpecialistID)
	if err != nil || specialist == nil {
		return fmt.Errorf("specialist not found")
	}
	loc := myI18n.NewLocalizer(specialist.Language)
	text := FormatBookingCancelledForSpecialist(loc, booking)
	_, err = h.Bot.SendMessage(specialist.TelegramUserID, text, nil)
	return err
}

/***************************************************************************************************
* NotifyClientBookingCancelled sends a cancellation notification to the client.
*
* Parameters:
* - booking: Booking used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
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

/***************************************************************************************************
* NotifyMoveRequest sends a move request notification with approval buttons.
*
* Parameters:
* - newBooking: New booking used by the current operation.
* - oldBooking: Old booking used by the current operation.
* - requestedBy: Requested by used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) NotifyMoveRequest(newBooking, oldBooking *models.Booking, requestedBy string) error {
	if requestedBy == "client" {
		/***************************************************************************************************
		* Notify specialist.
		***************************************************************************************************/
		specialist, err := db.GetSpecialistByID(oldBooking.SpecialistID)
		if err != nil || specialist == nil {
			return fmt.Errorf("specialist not found")
		}
		loc := myI18n.NewLocalizer(specialist.Language)
		text := FormatMoveRequestForSpecialist(loc, newBooking, oldBooking)
		_, err = h.Bot.SendNotification(specialist.TelegramUserID, text)
		return err
	}
	/***************************************************************************************************
	* Notify client.
	***************************************************************************************************/
	client, err := db.GetClientByID(oldBooking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("client not found")
	}
	loc := myI18n.NewLocalizer(client.Language)
	text := FormatMoveRequestForClient(loc, newBooking, oldBooking)
	_, err = h.Bot.SendNotification(client.TelegramUserID, text)
	return err
}

/***************************************************************************************************
* NotifySpecialistClientBookingResponse is the public API for notifying the specialist when a
* client confirms or declines a specialist-created booking via the REST API.
*
* Parameters:
* - booking: Booking used by the current operation.
* - accepted: Accepted used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) NotifySpecialistClientBookingResponse(booking *models.Booking, accepted bool) error {
	h.notifySpecialistClientResponse(booking, accepted)
	return nil
}

/***************************************************************************************************
* Implements the notify specialist client response logic used by this module.
*
* Parameters:
* - booking: Booking used by the current operation.
* - accepted: Accepted used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *Handler) notifySpecialistClientResponse(booking *models.Booking, accepted bool) {
	specialist, err := db.GetSpecialistByID(booking.SpecialistID)
	if err != nil || specialist == nil {
		log.Printf("Error getting specialist: %v", err)
		return
	}

	loc := myI18n.NewLocalizer(specialist.Language)

	var text string
	if accepted {
		text = FormatClientAcceptedBookingSpecialist(loc, booking)
	} else {
		text = FormatClientDeclinedBookingSpecialist(loc, booking)
	}

	_, err = h.Bot.SendMessage(specialist.TelegramUserID, text, nil)
	if err != nil {
		log.Printf("Error notifying specialist: %v", err)
	}
}
