package telegram

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Handler handles Telegram updates.
***************************************************************************************************/
type Handler struct {
	Bot               *Bot
	WebAppURL         string
	Version           string
	MasterBotUsername string // Username of the master onboarding bot. Shareable referral links
	// point at t.me/<MasterBotUsername>?start=ref_<code> so invitees land on the recruitment
	// flow rather than on the specialist's personal booking bot.
}

/***************************************************************************************************
* NewHandler creates a new Handler.
***************************************************************************************************/
func NewHandler(bot *Bot, webAppURL, masterBotUsername string) *Handler {
	return &Handler{
		Bot:               bot,
		WebAppURL:         webAppURL,
		MasterBotUsername: masterBotUsername,
	}
}

/***************************************************************************************************
* SyncClientPhotoFunc refreshes a client's Telegram profile photo in the background. Wired from
* main.go to the api package (which owns the cache-guarded sync) because telegram cannot import api.
* Nil in tests; always called through syncClientPhoto.
***************************************************************************************************/
var SyncClientPhotoFunc func(botToken, specialistID string, client *models.Client)

// syncClientPhoto triggers the async avatar sync for a client who just talked to the bot, so the
// photo is available to the specialist without the client ever opening the Profile tab.
func (h *Handler) syncClientPhoto(specialistID string, client *models.Client) {
	if SyncClientPhotoFunc == nil || client == nil || client.IsGhost {
		return
	}
	SyncClientPhotoFunc(h.Bot.Token, specialistID, client)
}

/***************************************************************************************************
* syncClientTelegramUsername persists the latest Telegram @username when it changes, so the admin
* mini app can build `https://t.me/<username>` links (tg://user?id=<id> triggers a confirmation
* dialog outside Telegram and cannot reliably open the chat in an in-app webview).
***************************************************************************************************/
func syncClientTelegramUsername(client *models.Client, username string) bool {
	if client == nil {
		return false
	}
	clean := strings.TrimPrefix(username, "@")
	if clean == client.TelegramUsername {
		return false
	}
	if err := db.UpdateClientTelegramUsername(client.ID, clean); err != nil {
		log.Printf("Error updating client telegram_username: %v", err)
		return false
	}
	client.TelegramUsername = clean
	return true
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
	/***************************************************************************************************
	* /start may carry a deep-link payload: "/start ref_<code>" tags the new client with the
	* specialist's referral code.
	***************************************************************************************************/
	if msg.Text == "/start" || strings.HasPrefix(msg.Text, "/start ") {
		payload := ""
		if len(msg.Text) > len("/start ") {
			payload = strings.TrimSpace(msg.Text[len("/start "):])
		}
		h.handleStartWithPayload(msg, payload)
		return
	}

	/***************************************************************************************************
	* Reply-keyboard taps arrive as plain text messages whose content matches the button label.
	* Intercept them before the /admin and /help switch so specialists can use the persistent menu.
	***************************************************************************************************/
	if h.handleSpecialistKeyboardTap(msg) {
		return
	}

	switch msg.Text {
	case "/admin":
		h.handleAdmin(msg)
	case "/help":
		h.handleHelp(msg)
	case "/language", "/lang":
		h.handleClientLanguageCommand(msg)
	}
}

// handleClientLanguageCommand shows the ru/en picker to a client or specialist from /language.
// For specialists, the command works from anywhere and is easy to remember.
func (h *Handler) handleClientLanguageCommand(msg *Message) {
	if msg.From == nil {
		return
	}
	specialist, _ := db.GetSpecialistByBotToken(h.Bot.Token)
	if specialist == nil {
		return
	}
	lang := "ru"
	if specialist.TelegramUserID == msg.From.ID {
		if specialist.Language != "" {
			lang = specialist.Language
		}
	} else if client, _ := db.GetClientByTelegramID(msg.From.ID, specialist.ID); client != nil && client.Language != "" {
		lang = client.Language
	}
	loc := myI18n.NewLocalizer(lang)

	// Both clients and specialists go through the "clientlang:<code>" callback path.
	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: myI18n.T(loc, "Lang.Russian"), CallbackData: "clientlang:ru"},
				{Text: myI18n.T(loc, "Lang.English"), CallbackData: "clientlang:en"},
			},
		},
	}
	if _, err := h.Bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "Lang.Choose"), keyboard); err != nil {
		log.Printf("Error sending client language picker: %v", err)
	}
}

/***************************************************************************************************
* handleSpecialistKeyboardTap matches the incoming message against the persistent reply-keyboard
* labels for the specialist's current language. Returns true if the tap was handled (so the caller
* should stop dispatching).
***************************************************************************************************/
func (h *Handler) handleSpecialistKeyboardTap(msg *Message) bool {
	if msg.From == nil || msg.Text == "" {
		return false
	}
	specialist, err := db.GetSpecialistByBotToken(h.Bot.Token)
	if err != nil || specialist == nil {
		return false
	}
	if specialist.TelegramUserID != msg.From.ID {
		return false
	}

	lang := specialist.Language
	if lang == "" {
		lang = "ru"
	}
	loc := myI18n.NewLocalizer(lang)

	switch msg.Text {
	case BtnApp(loc), BtnOpenAdmin(loc):
		h.handleAdmin(msg)
		return true
	case BtnOpenPreview(loc):
		h.handlePreview(msg)
		return true
	case BtnHelp(loc):
		h.handleHelp(msg)
		return true
	}
	return false
}

/***************************************************************************************************
* parseReferralPayload extracts the referral code from a /start payload. Accepts both bare codes
* ("abcd1234") and the ref_-prefixed form ("ref_abcd1234"). Returns an empty string if the payload
* does not look like a referral.
***************************************************************************************************/
func parseReferralPayload(payload string) string {
	payload = strings.TrimSpace(payload)
	if payload == "" {
		return ""
	}
	if strings.HasPrefix(payload, "ref_") {
		return strings.TrimPrefix(payload, "ref_")
	}
	return payload
}

/***************************************************************************************************
* handleStartWithPayload is the main /start flow. A non-empty payload is interpreted as a
* referral code: if it matches this specialist's code and the incoming user is a brand-new
* client (not the specialist themselves, not already registered), the client is tagged with the
* referral code. Invalid / self / returning-client cases are silently ignored — onboarding
* continues as normal.
***************************************************************************************************/
func (h *Handler) handleStartWithPayload(msg *Message, payload string) {
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

		/***************************************************************************************************
		* Set persistent menu button for specialist (opens admin panel).
		***************************************************************************************************/
		if err := h.Bot.SetChatMenuButton(msg.Chat.ID, BtnOpenAdmin(loc), adminURL); err != nil {
			log.Printf("Error setting specialist menu button: %v", err)
		}

		h.renderOwnerMenu(msg.Chat.ID, 0, specialist, loc)
		return
	}

	/***************************************************************************************************
	* Check if client exists.
	***************************************************************************************************/
	client, _ := db.GetClientByTelegramID(msg.From.ID, specialist.ID)
	if client == nil {
		/***************************************************************************************************
		* New user — default to Russian silently and create the client row. Language can be flipped
		* later via /language or from the mini-app. Skipping the initial picker removes friction; the
		* common case (Russian-speaking client) gets straight to booking.
		***************************************************************************************************/
		refCode := validateReferralForIncomingUser(specialist, msg.From.ID, payload)
		firstName := msg.From.FirstName
		if firstName == "" {
			firstName = "User"
		}
		newClient, err := db.GetOrCreateClientWithReferral(msg.From.ID, specialist.ID, firstName, refCode)
		if err != nil {
			log.Printf("Error creating client: %v", err)
			return
		}
		syncClientTelegramUsername(newClient, msg.From.Username)
		if newClient.Language == "" {
			if lerr := db.UpdateClientLanguage(newClient.ID, "ru"); lerr != nil {
				log.Printf("Error setting default client language: %v", lerr)
			}
			newClient.Language = "ru"
		}
		changes.Publish(specialist.ID, changes.GroupClientProfile, changes.GroupClients)
		client = newClient
	}

	/***************************************************************************************************
	* Existing client (or freshly defaulted above).
	***************************************************************************************************/
	if syncClientTelegramUsername(client, msg.From.Username) {
		changes.Publish(specialist.ID, changes.GroupClientProfile, changes.GroupClients)
	}
	h.syncClientPhoto(specialist.ID, client)
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
	specialist, loc, ok := h.specialistOwnerContext(msg)
	if !ok {
		return
	}

	lang := specialist.Language
	if lang == "" {
		lang = "ru"
	}

	/***************************************************************************************************
	* Open admin panel with specialist ID.
	***************************************************************************************************/
	adminURL := h.WebAppURL + "/admin?specialist=" + specialist.ID + "&lang=" + lang
	_, err := h.Bot.SendWebAppButton(msg.Chat.ID, myI18n.T(loc, "Handler.OpenAdmin"), adminURL, BtnOpenAdmin(loc))
	if err != nil {
		log.Printf("Error sending admin message: %v", err)
	}
}

/***************************************************************************************************
* handlePreview opens the read-only client preview for the specialist who owns this bot.
***************************************************************************************************/
func (h *Handler) handlePreview(msg *Message) {
	specialist, loc, ok := h.specialistOwnerContext(msg)
	if !ok {
		return
	}

	lang := specialist.Language
	if lang == "" {
		lang = "ru"
	}

	previewURL := h.WebAppURL + "/preview/client?specialist=" + specialist.ID + "&lang=" + lang
	if _, err := h.Bot.SendWebAppButton(msg.Chat.ID, myI18n.T(loc, "Handler.OpenPreview"), previewURL, BtnOpenPreview(loc)); err != nil {
		log.Printf("Error sending preview message: %v", err)
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
		h.renderOwnerHelp(msg.Chat.ID, 0, specialist, loc)
		return
	}

	loc := myI18n.Default()
	client, _ := db.GetClientByTelegramID(msg.From.ID, specialist.ID)
	if client != nil {
		loc = myI18n.NewLocalizer(client.Language)
	}
	if _, err = h.Bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "Help.Client"), nil); err != nil {
		log.Printf("Error sending help message: %v", err)
	}
}

func (h *Handler) specialistOwnerContext(msg *Message) (*models.Specialist, *i18n.Localizer, bool) {
	specialist, err := db.GetSpecialistByBotToken(h.Bot.Token)
	if err != nil {
		log.Printf("Error getting specialist: %v", err)
		return nil, nil, false
	}

	if specialist == nil || msg.From == nil || specialist.TelegramUserID != msg.From.ID {
		loc := myI18n.Default()
		if specialist != nil && msg.From != nil {
			client, _ := db.GetClientByTelegramID(msg.From.ID, specialist.ID)
			if client != nil {
				loc = myI18n.NewLocalizer(client.Language)
			}
		}
		if _, err := h.Bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "Handler.SpecialistOnly"), nil); err != nil {
			log.Printf("Error sending specialist-only message: %v", err)
		}
		return nil, nil, false
	}

	lang := specialist.Language
	if lang == "" {
		lang = "ru"
	}
	return specialist, myI18n.NewLocalizer(lang), true
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
	* Handle client /language command callback.
	***************************************************************************************************/
	if strings.HasPrefix(data, "clientlang:") {
		h.handleClientLanguageSwitch(update)
		return
	}

	/***************************************************************************************************
	* Handle specialist owner inline menu callbacks.
	***************************************************************************************************/
	if strings.HasPrefix(data, "sp:") {
		h.handleOwnerMenuCallback(update)
		return
	}

	/***************************************************************************************************
	* Handle client accept/decline callback.
	***************************************************************************************************/
	if strings.HasPrefix(data, "client_accept:") || strings.HasPrefix(data, "client_decline:") {
		h.handleClientBookingCallback(update)
		return
	}

	/***************************************************************************************************
	* Handle reschedule shadow approval callbacks (all four prefixes).
	***************************************************************************************************/
	if strings.HasPrefix(data, "rs_acc:") || strings.HasPrefix(data, "rs_rej:") ||
		strings.HasPrefix(data, "rs_ok:") || strings.HasPrefix(data, "rs_no:") {
		h.handleRescheduleCallback(update)
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

	if err := db.UpdateBookingStatusIfCurrent(bookingID, models.BookingStatusPending, newStatus); err != nil {
		if errors.Is(err, db.ErrBookingStatusConflict) {
			/***************************************************************************************************
			* Somebody else (mini-app, another device) processed the booking first.
			***************************************************************************************************/
			h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.AlreadyProcessed"))
			if current, _ := db.GetBookingByID(bookingID); current != nil && cq.Message != nil {
				h.UpdateBookingNotificationMessage(loc, cq.Message.Chat.ID, cq.Message.MessageID, current)
			}
			return
		}
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
	changes.Publish(booking.SpecialistID, changes.GroupBookings)
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

	/***************************************************************************************************
	* Expected callback data shapes:
	*   lang:<ru|en>:<specialistID>
	*   lang:<ru|en>:<specialistID>:<referralCode>   (optional, forwarded from /start ref_<code>)
	***************************************************************************************************/
	parts := strings.SplitN(data, ":", 4)
	if len(parts) < 3 {
		return
	}

	lang := parts[1]
	specialistID := parts[2]
	referralCode := ""
	if len(parts) == 4 {
		referralCode = parts[3]
	}

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
	* Re-validate the referral code server-side. The callback data is tamper-able, so we re-check
	* that the code belongs to this specialist and the caller is not the specialist themselves.
	***************************************************************************************************/
	if referralCode != "" {
		specialist, _ := db.GetSpecialistByID(specialistID)
		referralCode = validateReferralForIncomingUser(specialist, cq.From.ID, referralCode)
	}

	/***************************************************************************************************
	* Create or get client (tagged with referral code on first creation).
	***************************************************************************************************/
	client, err := db.GetOrCreateClientWithReferral(cq.From.ID, specialistID, firstName, referralCode)
	if err != nil {
		log.Printf("Error creating client: %v", err)
		return
	}
	if syncClientTelegramUsername(client, cq.From.Username) {
		changes.Publish(specialistID, changes.GroupClientProfile, changes.GroupClients)
	}

	/***************************************************************************************************
	* Update language.
	***************************************************************************************************/
	db.UpdateClientLanguage(client.ID, lang)
	changes.Publish(specialistID, changes.GroupClientProfile, changes.GroupClients)
	h.syncClientPhoto(specialistID, client)

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

// handleClientLanguageSwitch processes "clientlang:<code>" from the /language command.
// For clients, it updates clients.language; for specialists it updates specialists.language so
// the switch works uniformly regardless of who invoked /language.
func (h *Handler) handleClientLanguageSwitch(update Update) {
	cq := update.CallbackQuery
	lang := strings.TrimPrefix(cq.Data, "clientlang:")
	if lang != "ru" && lang != "en" {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}

	specialist, err := db.GetSpecialistByBotToken(h.Bot.Token)
	if err != nil || specialist == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}

	if specialist.TelegramUserID == cq.From.ID {
		if err := db.UpdateSpecialistLanguage(specialist.ID, lang); err != nil {
			log.Printf("Error updating specialist language via /language: %v", err)
		}
	} else {
		client, _ := db.GetClientByTelegramID(cq.From.ID, specialist.ID)
		if client == nil {
			// First-time user hitting /language without a /start — create the row, defaulting name.
			firstName := cq.From.FirstName
			if firstName == "" {
				firstName = "User"
			}
			client, err = db.GetOrCreateClientWithReferral(cq.From.ID, specialist.ID, firstName, "")
			if err != nil {
				log.Printf("Error creating client from /language: %v", err)
				h.Bot.AnswerCallbackQuery(cq.ID, "")
				return
			}
		}
		if err := db.UpdateClientLanguage(client.ID, lang); err != nil {
			log.Printf("Error updating client language: %v", err)
		}
		changes.Publish(specialist.ID, changes.GroupClientProfile, changes.GroupClients)
		h.syncClientPhoto(specialist.ID, client)
	}

	newLoc := myI18n.NewLocalizer(lang)
	h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(newLoc, "Lang.Saved"))
	if cq.Message != nil {
		// Edit the picker message to a confirmation so the UI doesn't feel stuck.
		_ = h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID, myI18n.T(newLoc, "Lang.Saved"), nil)
	}
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

	var transitionErr error
	if accepted {
		transitionErr = db.UpdateBookingStatusIfCurrent(bookingID, models.BookingStatusPending, models.BookingStatusConfirmed)
		toastText = myI18n.T(loc, "Callback.ClientConfirmed")
	} else {
		transitionErr = db.CancelBookingIfCurrent(bookingID, models.BookingStatusPending, "", models.CancelledByClient)
		toastText = myI18n.T(loc, "Callback.ClientDeclined")
	}
	if transitionErr != nil {
		if errors.Is(transitionErr, db.ErrBookingStatusConflict) {
			/***************************************************************************************************
			* Somebody else (mini-app, specialist, another device) processed the booking first.
			***************************************************************************************************/
			h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.AlreadyProcessed"))
			if current, _ := db.GetBookingByID(bookingID); current != nil && cq.Message != nil {
				h.UpdateClientNotificationMessage(loc, cq.Message.Chat.ID, cq.Message.MessageID, current)
			}
			return
		}
		log.Printf("Error updating booking via client callback: %v", transitionErr)
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.Error"))
		return
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
	changes.Publish(booking.SpecialistID, changes.GroupBookings)
}

/***************************************************************************************************
* handleRescheduleCallback processes rs_acc/rs_rej (specialist acting) and rs_ok/rs_no
* (client acting) callbacks on reschedule shadow bookings.
***************************************************************************************************/
func (h *Handler) handleRescheduleCallback(update Update) {
	cq := update.CallbackQuery
	data := cq.Data

	parts := strings.SplitN(data, ":", 2)
	if len(parts) != 2 {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}
	prefix, bookingID := parts[0], parts[1]

	booking, err := db.GetBookingByID(bookingID)
	if err != nil || booking == nil {
		loc := myI18n.Default()
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.NotFound"))
		return
	}

	if booking.Status != models.BookingStatusReschedulePending {
		loc := myI18n.Default()
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.AlreadyProcessed"))
		if cq.Message != nil {
			_ = h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID,
				myI18n.T(loc, "Callback.AlreadyProcessed"), nil)
		}
		return
	}

	var oldBooking *models.Booking
	if booking.ReplacesBookingID != "" {
		oldBooking, _ = db.GetBookingByID(booking.ReplacesBookingID)
	}

	switch prefix {
	case "rs_acc", "rs_rej":
		// SPECIALIST is acting — verify the presser owns this bot and the request came from client.
		specialist, err := db.GetSpecialistByID(booking.SpecialistID)
		if err != nil || specialist == nil || cq.From.ID != specialist.TelegramUserID {
			h.Bot.AnswerCallbackQuery(cq.ID, "")
			return
		}
		if booking.CreatedBy != "client" {
			h.Bot.AnswerCallbackQuery(cq.ID, "")
			return
		}
		loc := myI18n.NewLocalizer(specialist.Language)
		approved := prefix == "rs_acc"
		if approved {
			if err := db.ApproveRescheduleBooking(bookingID); err != nil {
				if errors.Is(err, db.ErrBookingStatusConflict) {
					h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.AlreadyProcessed"))
					return
				}
				log.Printf("Error approving reschedule via callback: %v", err)
				h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.Error"))
				return
			}
		} else {
			if err := db.DeclineRescheduleBooking(bookingID); err != nil {
				log.Printf("Error declining reschedule via callback: %v", err)
				h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.Error"))
				return
			}
		}
		toastText := myI18n.T(loc, "Callback.RescheduleApproved")
		if !approved {
			toastText = myI18n.T(loc, "Callback.RescheduleDeclined")
		}
		h.Bot.AnswerCallbackQuery(cq.ID, toastText)
		// On approve the row still exists; on decline it was just deleted and
		// GetBookingByID returns nil — pass the pre-delete booking instead so
		// that NotifyMoveResponse never receives a nil newBooking.
		notifyBooking := booking
		if approved {
			if updated, _ := db.GetBookingByID(bookingID); updated != nil {
				notifyBooking = updated
			}
		}
		if cq.Message != nil {
			_ = h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID, toastText, nil)
		}
		if err := h.NotifyMoveResponse(notifyBooking, oldBooking, approved, "specialist"); err != nil {
			log.Printf("Error notifying client about reschedule response: %v", err)
		}
		changes.Publish(booking.SpecialistID, changes.GroupBookings, changes.GroupRecurring)

	case "rs_ok", "rs_no":
		// CLIENT is acting — verify the presser is the booking's client and request came from specialist.
		client, err := db.GetClientByID(booking.ClientID)
		if err != nil || client == nil || cq.From.ID != client.TelegramUserID {
			h.Bot.AnswerCallbackQuery(cq.ID, "")
			return
		}
		if booking.CreatedBy != "specialist" {
			h.Bot.AnswerCallbackQuery(cq.ID, "")
			return
		}
		loc := myI18n.NewLocalizer(client.Language)
		approved := prefix == "rs_ok"
		if approved {
			if err := db.ApproveRescheduleBooking(bookingID); err != nil {
				if errors.Is(err, db.ErrBookingStatusConflict) {
					h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.AlreadyProcessed"))
					return
				}
				log.Printf("Error approving reschedule via callback: %v", err)
				h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.Error"))
				return
			}
		} else {
			if err := db.DeclineRescheduleBooking(bookingID); err != nil {
				log.Printf("Error declining reschedule via callback: %v", err)
				h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.Error"))
				return
			}
		}
		toastText := myI18n.T(loc, "Callback.RescheduleApproved")
		if !approved {
			toastText = myI18n.T(loc, "Callback.RescheduleDeclined")
		}
		h.Bot.AnswerCallbackQuery(cq.ID, toastText)
		// On approve the row still exists; on decline it was just deleted and
		// GetBookingByID returns nil — pass the pre-delete booking instead so
		// that NotifyMoveResponse never receives a nil newBooking.
		notifyBooking := booking
		if approved {
			if updated, _ := db.GetBookingByID(bookingID); updated != nil {
				notifyBooking = updated
			}
		}
		if cq.Message != nil {
			_ = h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID, toastText, nil)
		}
		if err := h.NotifyMoveResponse(notifyBooking, oldBooking, approved, "client"); err != nil {
			log.Printf("Error notifying specialist about reschedule response: %v", err)
		}
		changes.Publish(booking.SpecialistID, changes.GroupBookings, changes.GroupRecurring)

	default:
		h.Bot.AnswerCallbackQuery(cq.ID, "")
	}
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
	var keyboard *InlineKeyboardMarkup
	switch booking.Status {
	case models.BookingStatusPending:
		/***************************************************************************************************
		* Still awaiting the client's answer (e.g. the specialist moved it in the mini-app): refresh
		* the text and keep the Accept/Decline buttons.
		***************************************************************************************************/
		text = FormatSpecialistCreatedBookingClient(loc, booking)
		keyboard = &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{
					{Text: BtnAccept(loc), CallbackData: "client_accept:" + booking.ID},
					{Text: BtnDecline(loc), CallbackData: "client_decline:" + booking.ID},
				},
			},
		}
	case models.BookingStatusConfirmed, models.BookingStatusCompleted:
		text = FormatSpecialistCreatedBookingClientAccepted(loc, booking)
	case models.BookingStatusCancelled, models.BookingStatusRejected:
		if booking.CancelledBy == models.CancelledBySpecialist {
			/***************************************************************************************************
			* The specialist withdrew their own proposal (e.g. cancelled it in the mini-app).
			***************************************************************************************************/
			text = FormatBookingCancelledBySpecialistClient(loc, booking)
		} else {
			text = FormatSpecialistCreatedBookingClientDeclined(loc, booking)
		}
	default:
		text = FormatSpecialistCreatedBookingClient(loc, booking)
	}
	return h.Bot.EditMessageText(chatID, messageID, text, keyboard)
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
	var keyboard *InlineKeyboardMarkup
	switch booking.Status {
	case models.BookingStatusPending:
		/***************************************************************************************************
		* Still awaiting the specialist's answer (e.g. the client or specialist moved it): refresh the
		* text and keep the Confirm/Reject buttons.
		***************************************************************************************************/
		text = FormatNewBookingMessage(loc, booking)
		keyboard = &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{
					{Text: BtnConfirm(loc), CallbackData: "accept:" + booking.ID},
					{Text: BtnReject(loc), CallbackData: "reject:" + booking.ID},
				},
			},
		}
	case models.BookingStatusConfirmed, models.BookingStatusCompleted:
		text = FormatBookingAcceptedSpecialist(loc, booking)
	case models.BookingStatusRejected:
		text = FormatBookingRejectedSpecialist(loc, booking)
	case models.BookingStatusCancelled:
		text = myI18n.Tf(loc, "Booking.CancelledSpecialistView", bookingTemplateData(loc, booking))
	default:
		text = FormatNewBookingMessage(loc, booking)
	}
	return h.Bot.EditMessageText(chatID, messageID, text, keyboard)
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
		* Notify specialist with Accept/Reject inline buttons.
		***************************************************************************************************/
		specialist, err := db.GetSpecialistByID(oldBooking.SpecialistID)
		if err != nil || specialist == nil {
			return fmt.Errorf("specialist not found")
		}
		loc := myI18n.NewLocalizer(specialist.Language)
		text := FormatMoveRequestForSpecialist(loc, newBooking, oldBooking)
		keyboard := &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{
					{Text: BtnAccept(loc), CallbackData: "rs_acc:" + newBooking.ID},
					{Text: BtnReject(loc), CallbackData: "rs_rej:" + newBooking.ID},
				},
			},
		}
		_, err = h.Bot.SendMessageHTML(specialist.TelegramUserID, text, keyboard)
		return err
	}
	/***************************************************************************************************
	* Notify client with Accept/Decline inline buttons.
	***************************************************************************************************/
	client, err := db.GetClientByID(oldBooking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("client not found")
	}
	if client.IsGhost {
		return nil
	}
	loc := myI18n.NewLocalizer(client.Language)
	text := FormatMoveRequestForClient(loc, newBooking, oldBooking)
	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: BtnAccept(loc), CallbackData: "rs_ok:" + newBooking.ID},
				{Text: BtnDecline(loc), CallbackData: "rs_no:" + newBooking.ID},
			},
		},
	}
	_, err = h.Bot.SendMessageHTML(client.TelegramUserID, text, keyboard)
	return err
}

/***************************************************************************************************
* NotifyClientRescheduleRequest notifies the specialist that a client rescheduled their booking
* in-place. Sends a dedicated "client rescheduled" message rather than the "new booking" one.
***************************************************************************************************/
func (h *Handler) NotifyClientRescheduleRequest(newBooking, oldBooking *models.Booking) error {
	specialist, err := db.GetSpecialistByID(newBooking.SpecialistID)
	if err != nil || specialist == nil {
		return fmt.Errorf("specialist not found")
	}
	if !specialist.NotifyNewBookings {
		return nil
	}
	loc := myI18n.NewLocalizer(specialist.Language)
	text := FormatClientRescheduleRequest(loc, newBooking, oldBooking)
	_, err = h.Bot.SendNotification(specialist.TelegramUserID, text)
	return err
}

/***************************************************************************************************
* NotifyMoveResponse notifies the appropriate party when a reschedule proposal is approved or
* declined. respondedBy is "client" (specialist gets notified) or "specialist" (client gets
* notified).
***************************************************************************************************/
func (h *Handler) NotifyMoveResponse(newBooking, oldBooking *models.Booking, approved bool, respondedBy string) error {
	if oldBooking == nil {
		oldBooking = newBooking
	}
	if newBooking == nil {
		newBooking = oldBooking
	}
	if respondedBy == "specialist" {
		// Notify the CLIENT that the specialist approved/declined their reschedule request.
		client, err := db.GetClientByID(newBooking.ClientID)
		if err != nil || client == nil {
			return fmt.Errorf("client not found")
		}
		if client.IsGhost {
			return nil
		}
		loc := myI18n.NewLocalizer(client.Language)
		var text string
		if approved {
			text = FormatMoveApprovedForClient(loc, newBooking, oldBooking)
		} else {
			text = FormatMoveDeclinedForClient(loc, oldBooking)
		}
		_, err = h.Bot.SendNotification(client.TelegramUserID, text)
		return err
	}
	// respondedBy == "client": notify the SPECIALIST.
	specialist, err := db.GetSpecialistByID(newBooking.SpecialistID)
	if err != nil || specialist == nil {
		return fmt.Errorf("specialist not found")
	}
	if !specialist.NotifyNewBookings {
		return nil
	}
	loc := myI18n.NewLocalizer(specialist.Language)
	var text string
	if approved {
		text = FormatMoveApproved(loc, newBooking, oldBooking)
	} else {
		text = FormatMoveDeclined(loc, oldBooking)
	}
	_, err = h.Bot.SendNotification(specialist.TelegramUserID, text)
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

/***************************************************************************************************
* validateReferralForIncomingUser returns the referral code to credit, or an empty string if the
* referral should be ignored. Ignored when: specialist is nil, payload is empty, payload does not
* match the specialist's code, or the incoming user is the specialist themselves. Existing
* clients are filtered by the caller (GetOrCreateClientWithReferral only writes the code on
* creation).
***************************************************************************************************/
func validateReferralForIncomingUser(specialist *models.Specialist, incomingTelegramID int64, payload string) string {
	if specialist == nil {
		return ""
	}
	code := parseReferralPayload(payload)
	if code == "" {
		return ""
	}
	if specialist.ReferralCode == "" || code != specialist.ReferralCode {
		return ""
	}
	if incomingTelegramID == specialist.TelegramUserID {
		return ""
	}
	return code
}

// renderOwnerMenu sends or edits (messageID>0) the specialist owner's root inline menu.
func (h *Handler) renderOwnerMenu(chatID int64, messageID int, specialist *models.Specialist, loc *i18n.Localizer) {
	lang := specialist.Language
	if lang == "" {
		lang = "ru"
	}
	adminURL := h.WebAppURL + "/admin?specialist=" + specialist.ID + "&lang=" + lang
	previewURL := h.WebAppURL + "/preview/client?specialist=" + specialist.ID + "&lang=" + lang

	rows := [][]InlineKeyboardButton{
		{{Text: myI18n.T(loc, "SpecialistMenu.BtnOpen"), WebApp: &WebAppInfo{URL: adminURL}}},
		{{Text: myI18n.T(loc, "SpecialistMenu.BtnPreview"), WebApp: &WebAppInfo{URL: previewURL}}},
		{{Text: myI18n.T(loc, "SpecialistMenu.BtnHelp"), CallbackData: "sp:help"}},
	}
	if h.MasterBotUsername != "" {
		rows = append(rows, []InlineKeyboardButton{
			{Text: myI18n.T(loc, "SpecialistMenu.BtnMaster"), URL: "https://t.me/" + h.MasterBotUsername},
		})
	}
	kb := &InlineKeyboardMarkup{InlineKeyboard: rows}
	text := myI18n.T(loc, "Welcome.Specialist")
	h.ownerEditOrSend(chatID, messageID, text, kb)
}

// renderOwnerHelp sends or edits the owner help screen.
func (h *Handler) renderOwnerHelp(chatID int64, messageID int, specialist *models.Specialist, loc *i18n.Localizer) {
	clientURL := "https://t.me/" + h.Bot.Username
	text := FormatHelpSpecialist(loc, clientURL)
	var rows [][]InlineKeyboardButton
	if h.MasterBotUsername != "" {
		rows = append(rows, []InlineKeyboardButton{
			{Text: myI18n.T(loc, "SpecialistMenu.BtnMaster"), URL: "https://t.me/" + h.MasterBotUsername},
		})
	}
	rows = append(rows, []InlineKeyboardButton{
		{Text: BtnBack(loc), CallbackData: "sp:home"},
	})
	h.ownerEditOrSend(chatID, messageID, text, &InlineKeyboardMarkup{InlineKeyboard: rows})
}

// ownerEditOrSend tries to edit an existing message, falling back to a fresh send (HTML parse mode).
func (h *Handler) ownerEditOrSend(chatID int64, messageID int, text string, kb *InlineKeyboardMarkup) {
	if messageID > 0 {
		if err := h.Bot.EditMessageTextHTML(chatID, messageID, text, kb); err == nil {
			return
		}
	}
	if _, err := h.Bot.SendMessageHTML(chatID, text, kb); err != nil {
		log.Printf("Error rendering owner menu: %v", err)
	}
}

// handleOwnerMenuCallback routes sp:* callbacks for the specialist owner's inline menu.
func (h *Handler) handleOwnerMenuCallback(update Update) {
	cq := update.CallbackQuery
	specialist, err := db.GetSpecialistByBotToken(h.Bot.Token)
	if err != nil || specialist == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}
	if specialist.TelegramUserID != cq.From.ID {
		loc := myI18n.Default()
		if client, _ := db.GetClientByTelegramID(cq.From.ID, specialist.ID); client != nil {
			loc = myI18n.NewLocalizer(client.Language)
		}
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Handler.SpecialistOnly"))
		return
	}
	if cq.Message == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}
	lang := specialist.Language
	if lang == "" {
		lang = "ru"
	}
	loc := myI18n.NewLocalizer(lang)
	chatID := cq.Message.Chat.ID
	messageID := cq.Message.MessageID
	h.Bot.AnswerCallbackQuery(cq.ID, "")
	switch strings.TrimPrefix(cq.Data, "sp:") {
	case "home", "":
		h.renderOwnerMenu(chatID, messageID, specialist, loc)
	case "help":
		h.renderOwnerHelp(chatID, messageID, specialist, loc)
	}
}
