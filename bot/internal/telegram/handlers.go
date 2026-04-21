package telegram

import (
	"fmt"
	"log"
	"net/url"
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
* syncClientTelegramUsername persists the latest Telegram @username when it changes, so the admin
* mini app can build `https://t.me/<username>` links (tg://user?id=<id> triggers a confirmation
* dialog outside Telegram and cannot reliably open the chat in an in-app webview).
***************************************************************************************************/
func syncClientTelegramUsername(client *models.Client, username string) {
	if client == nil {
		return
	}
	clean := strings.TrimPrefix(username, "@")
	if clean == client.TelegramUsername {
		return
	}
	if err := db.UpdateClientTelegramUsername(client.ID, clean); err != nil {
		log.Printf("Error updating client telegram_username: %v", err)
		return
	}
	client.TelegramUsername = clean
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
// For specialists, the existing profile submenu also exposes this, but the command works from
// anywhere and is easy to remember.
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

	// Clients use "clientlang:<code>" to distinguish from the specialist's profile:lang path.
	// Specialist taps still flow through the existing profile menu.
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
	case BtnProfile(loc):
		if _, err := h.Bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "Referral.ProfileMenu"), profileHomeKeyboard(loc)); err != nil {
			log.Printf("Error sending profile menu: %v", err)
		}
		return true
	case BtnInfo(loc):
		clientURL := "https://t.me/" + h.Bot.Username
		if _, err := h.Bot.SendMessageHTML(msg.Chat.ID, FormatHelpSpecialist(loc, clientURL, h.MasterBotUsername), nil); err != nil {
			log.Printf("Error sending info message: %v", err)
		}
		return true
	}
	return false
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
	h.handleStartWithPayload(msg, "")
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
		clientURL := h.WebAppURL + "?specialist=" + specialist.ID + "&lang=" + lang

		/***************************************************************************************************
		* Set persistent menu button for specialist (opens admin panel).
		***************************************************************************************************/
		if err := h.Bot.SetChatMenuButton(msg.Chat.ID, BtnOpenAdmin(loc), adminURL); err != nil {
			log.Printf("Error setting specialist menu button: %v", err)
		}

		/***************************************************************************************************
		* Welcome message keeps "Управление" as an inline web-app button. Inline web-app buttons always
		* deliver initData; reply-keyboard web-app buttons only do so when the URL is registered as the
		* bot's Web App in @BotFather, which is not guaranteed across the fleet.
		***************************************************************************************************/
		inlineKeyboard := &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{{Text: BtnOpenAdmin(loc), WebApp: &WebAppInfo{URL: adminURL}}},
			},
		}
		if _, err := h.Bot.SendMessageHTML(msg.Chat.ID, FormatWelcomeSpecialist(loc, h.Version, clientURL), inlineKeyboard); err != nil {
			log.Printf("Error sending specialist welcome message: %v", err)
		}

		/***************************************************************************************************
		* Second message installs the persistent reply keyboard with text-only buttons. Taps on these
		* are dispatched via handleSpecialistKeyboardTap — no web_app involvement so initData never comes
		* into play here.
		***************************************************************************************************/
		replyKeyboard := &ReplyKeyboardMarkup{
			Keyboard: [][]KeyboardButton{
				{{Text: BtnProfile(loc)}, {Text: BtnInfo(loc)}},
			},
			ResizeKeyboard: true,
			IsPersistent:   true,
		}
		if _, err := h.Bot.SendMessageHTMLWithReplyKeyboard(msg.Chat.ID, myI18n.T(loc, "Menu.Ready"), replyKeyboard); err != nil {
			log.Printf("Error sending specialist menu keyboard: %v", err)
		}
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
	syncClientTelegramUsername(client, msg.From.Username)
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
		_, err = h.Bot.SendMessageHTML(msg.Chat.ID, FormatHelpSpecialist(loc, clientURL, h.MasterBotUsername), nil)
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
	* Handle client /language command callback.
	***************************************************************************************************/
	if strings.HasPrefix(data, "clientlang:") {
		h.handleClientLanguageSwitch(update)
		return
	}

	/***************************************************************************************************
	* Handle specialist profile menu callbacks.
	***************************************************************************************************/
	if strings.HasPrefix(data, "profile:") {
		h.handleProfileCallback(update)
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
	syncClientTelegramUsername(client, cq.From.Username)

	/***************************************************************************************************
	* Update language.
	***************************************************************************************************/
	db.UpdateClientLanguage(client.ID, lang)
	changes.Publish(specialistID, changes.GroupClientProfile, changes.GroupClients)

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
	changes.Publish(booking.SpecialistID, changes.GroupBookings)
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
		text = myI18n.Tf(loc, "Booking.CancelledSpecialistView", bookingTemplateData(loc, booking))
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
* NotifyMoveResponse notifies the specialist when the client approves or declines an
* admin-initiated reschedule proposal. Uses FormatMoveApproved / FormatMoveDeclined.
***************************************************************************************************/
func (h *Handler) NotifyMoveResponse(newBooking, oldBooking *models.Booking, approved bool) error {
	if oldBooking == nil {
		oldBooking = newBooking
	}
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

/***************************************************************************************************
* handleProfileCallback implements the Profile submenu accessible from the specialist's /start
* message. Only the specialist (owner of the bot) may use it. Menu entries:
*   profile:home    → render the profile menu (currently only "Invite friend")
*   profile:invite  → show the invite message + copyable link + native share button
*   profile:back    → return to the home menu
***************************************************************************************************/
func (h *Handler) handleProfileCallback(update Update) {
	cq := update.CallbackQuery
	data := cq.Data

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

	lang := specialist.Language
	if lang == "" {
		lang = "ru"
	}
	loc := myI18n.NewLocalizer(lang)

	action := strings.TrimPrefix(data, "profile:")

	switch action {
	case "invite":
		h.Bot.AnswerCallbackQuery(cq.ID, "")

		code, err := db.EnsureSpecialistReferralCode(specialist.ID)
		if err != nil || code == "" {
			log.Printf("Error ensuring referral code: %v", err)
			_, _ = h.Bot.SendMessage(cq.From.ID, myI18n.T(loc, "Handler.ConfigError"), nil)
			return
		}
		// Link points at the master (recruitment) bot, not the specialist's personal bot — the
		// goal is to bring new specialists onto the platform, not to hand out yet another client
		// link.
		link := referralLink(h.MasterBotUsername, code)
		shareText := myI18n.Tf(loc, "Referral.ShareText", map[string]interface{}{"Link": link})

		inviteText := myI18n.Tf(loc, "Referral.InviteMessage", map[string]interface{}{"Link": link})
		keyboard := &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{{Text: BtnInviteShare(loc), URL: shareURL(link, shareText)}},
				{{Text: BtnProfileBack(loc), CallbackData: "profile:home"}},
			},
		}
		_, err = h.Bot.SendMessageHTML(cq.From.ID, inviteText, keyboard)
		if err != nil {
			log.Printf("Error sending invite message: %v", err)
		}
	case "home", "":
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		_, err = h.Bot.SendMessage(cq.From.ID, myI18n.T(loc, "Referral.ProfileMenu"), profileHomeKeyboard(loc))
		if err != nil {
			log.Printf("Error sending profile menu: %v", err)
		}
	case "language":
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		keyboard := &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{
					{Text: myI18n.T(loc, "Lang.Russian"), CallbackData: "profile:lang:ru"},
					{Text: myI18n.T(loc, "Lang.English"), CallbackData: "profile:lang:en"},
				},
				{{Text: BtnProfileBack(loc), CallbackData: "profile:home"}},
			},
		}
		_, err = h.Bot.SendMessage(cq.From.ID, myI18n.T(loc, "Lang.Choose"), keyboard)
		if err != nil {
			log.Printf("Error sending language picker: %v", err)
		}
	default:
		/***************************************************************************************************
		* profile:lang:<code> — specialist switched their bot language.
		***************************************************************************************************/
		if strings.HasPrefix(action, "lang:") {
			newLang := strings.TrimPrefix(action, "lang:")
			if newLang != "ru" && newLang != "en" {
				h.Bot.AnswerCallbackQuery(cq.ID, "")
				return
			}
			if err := db.UpdateSpecialistLanguage(specialist.ID, newLang); err != nil {
				log.Printf("Error updating specialist language: %v", err)
				h.Bot.AnswerCallbackQuery(cq.ID, "")
				return
			}
			newLoc := myI18n.NewLocalizer(newLang)
			h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(newLoc, "Lang.Saved"))
			_, err := h.Bot.SendMessage(cq.From.ID, myI18n.T(newLoc, "Referral.ProfileMenu"), profileHomeKeyboard(newLoc))
			if err != nil {
				log.Printf("Error sending profile menu after language switch: %v", err)
			}
			return
		}
		h.Bot.AnswerCallbackQuery(cq.ID, "")
	}
}

/***************************************************************************************************
* profileHomeKeyboard renders the main profile submenu. Extracted so the `home` and post-language-
* switch paths don't drift apart.
***************************************************************************************************/
func profileHomeKeyboard(loc *i18n.Localizer) *InlineKeyboardMarkup {
	return &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: BtnInviteFriend(loc), CallbackData: "profile:invite"}},
			{{Text: BtnLanguage(loc), CallbackData: "profile:language"}},
		},
	}
}

/***************************************************************************************************
* referralLink builds the shareable t.me link that carries the specialist's referral code.
***************************************************************************************************/
func referralLink(botUsername, code string) string {
	if botUsername == "" {
		return "https://t.me/?start=ref_" + code
	}
	return "https://t.me/" + botUsername + "?start=ref_" + code
}

/***************************************************************************************************
* shareURL builds a Telegram share-picker URL: `url` is the referral link (rendered as a preview
* card on the recipient side), `text` is the caption body. The caption is expected to also
* contain the link inline — with an inline-button flow, an empty `url=` makes Telegram drop the
* link preview, and in that case the inline URL inside the text is the only signal to the reader.
***************************************************************************************************/
func shareURL(link, text string) string {
	return "https://t.me/share/url?url=" + urlEncode(link) + "&text=" + urlEncode(text)
}

/***************************************************************************************************
* urlEncode escapes a string for safe embedding in a query string.
***************************************************************************************************/
func urlEncode(s string) string {
	return url.QueryEscape(s)
}
