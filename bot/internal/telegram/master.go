package telegram

import (
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* OnboardingState tracks where a user is in the onboarding flow.
***************************************************************************************************/
type OnboardingState int

/***************************************************************************************************
* Groups related constants declared together for this module.
***************************************************************************************************/
const (
	/***************************************************************************************************
	* Defines the state none value used by the telegram bot layer.
	*
	* Usage context:
	* - Reused by the telegram bot layer to keep shared values centralized.
	***************************************************************************************************/
	StateNone OnboardingState = iota
	/***************************************************************************************************
	* Defines the state awaiting token value used by the telegram bot layer.
	*
	* Usage context:
	* - Reused by the telegram bot layer to keep shared values centralized.
	***************************************************************************************************/
	StateAwaitingToken
	/***************************************************************************************************
	* Defines the state awaiting name value used by the telegram bot layer.
	*
	* Usage context:
	* - Reused by the telegram bot layer to keep shared values centralized.
	***************************************************************************************************/
	StateAwaitingName
)

/***************************************************************************************************
* OnboardingSession holds temporary data during onboarding.
***************************************************************************************************/
type OnboardingSession struct {
	State       OnboardingState
	BotToken    string
	BotUsername string
}

/***************************************************************************************************
* MasterHandler handles the master bot for specialist onboarding.
***************************************************************************************************/
type MasterHandler struct {
	bot           *Bot
	sessions      map[int64]*OnboardingSession // telegramUserID -> session
	mu            sync.RWMutex
	publicBaseURL string
	webAppURL     string
	adminIDs      []int64
}

/***************************************************************************************************
* NewMasterHandler creates a new master bot handler.
*
* Parameters:
* - publicBaseURL: Public base url used by the current operation.
* - bot: Bot used by the current operation.
* - webAppURL: Web app url used by the current operation.
* - adminIDs: Identifiers used to target the related records.
*
* Returns:
* - The computed value for the current operation as *MasterHandler.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func NewMasterHandler(bot *Bot, publicBaseURL, webAppURL string, adminIDs []int64) *MasterHandler {
	return &MasterHandler{
		bot:           bot,
		sessions:      make(map[int64]*OnboardingSession),
		publicBaseURL: publicBaseURL,
		webAppURL:     webAppURL,
		adminIDs:      adminIDs,
	}
}

/***************************************************************************************************
* Returns session.
*
* Parameters:
* - userID: Identifier used to target the current record.
*
* Returns:
* - The computed value for the current operation as *OnboardingSession.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) getSession(userID int64) *OnboardingSession {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.sessions[userID]
}

/***************************************************************************************************
* Sets session.
*
* Parameters:
* - userID: Identifier used to target the current record.
* - session: Session used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) setSession(userID int64, session *OnboardingSession) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if session == nil {
		delete(h.sessions, userID)
	} else {
		h.sessions[userID] = session
	}
}

/***************************************************************************************************
* HandleUpdate processes incoming updates for the master bot.
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
func (h *MasterHandler) HandleUpdate(update Update) {
	if update.Message == nil {
		return
	}

	msg := update.Message
	userID := msg.From.ID
	chatID := msg.Chat.ID
	text := strings.TrimSpace(msg.Text)

	/***************************************************************************************************
	* Handle commands.
	***************************************************************************************************/
	if strings.HasPrefix(text, "/") {
		h.handleCommand(chatID, userID, text, msg.From.LanguageCode)
		return
	}

	/***************************************************************************************************
	* Handle conversation flow.
	***************************************************************************************************/
	session := h.getSession(userID)
	if session == nil {
		/***************************************************************************************************
		* No active session, prompt to start.
		***************************************************************************************************/
		loc := myI18n.NewLocalizer(msg.From.LanguageCode)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
		return
	}

	loc := myI18n.NewLocalizer(msg.From.LanguageCode)

	switch session.State {
	case StateAwaitingToken:
		h.handleTokenInput(chatID, userID, text, session, loc)
	case StateAwaitingName:
		h.handleNameInput(chatID, userID, text, session, msg.From.Username, loc)
	}
}

/***************************************************************************************************
* Handles command.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - text: Text used by the current operation.
* - langCode: Lang code used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleCommand(chatID, userID int64, text string, langCode string) {
	cmd := strings.Split(text, " ")[0]
	loc := myI18n.NewLocalizer(langCode)

	switch cmd {
	case "/start":
		h.handleStart(chatID, userID, loc)
	case "/cancel":
		h.handleCancel(chatID, userID, loc)
	case "/help":
		if h.isAdmin(userID) {
			h.bot.SendMessage(chatID, myI18n.T(loc, "Master.HelpAdmin"), nil)
		} else {
			h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Help"), nil)
		}
	case "/specialists":
		h.handleAdminSpecialists(chatID, userID, loc)
	case "/stats":
		h.handleAdminStats(chatID, userID, loc)
	default:
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
	}
}

/***************************************************************************************************
* Checks whether admin.
*
* Parameters:
* - userID: Identifier used to target the current record.
*
* Returns:
* - The computed value for the current operation as bool.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) isAdmin(userID int64) bool {
	for _, id := range h.adminIDs {
		if id == userID {
			return true
		}
	}
	return false
}

/***************************************************************************************************
* Handles admin specialists.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleAdminSpecialists(chatID, userID int64, loc *localizerType) {
	if !h.isAdmin(userID) {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
		return
	}

	specialists, err := db.GetAllActiveSpecialists()
	if err != nil {
		log.Printf("Error getting specialists: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	if len(specialists) == 0 {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.NoSpecialists"), nil)
		return
	}

	msg := myI18n.Tf(loc, "Master.SpecialistsList", map[string]interface{}{"Count": len(specialists)})
	for i, t := range specialists {
		msg += myI18n.Tf(loc, "Master.SpecialistItem", map[string]interface{}{
			"Num":         i + 1,
			"Name":        t.Name,
			"BotUsername": t.BotUsername,
			"TelegramID":  t.TelegramUserID,
			"CreatedAt":   t.CreatedAt.Format("02.01.2006 15:04"),
		})
	}

	h.bot.SendMessage(chatID, msg, nil)
}

/***************************************************************************************************
* Handles admin stats.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleAdminStats(chatID, userID int64, loc *localizerType) {
	if !h.isAdmin(userID) {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
		return
	}

	specialists, err := db.GetAllActiveSpecialists()
	if err != nil {
		log.Printf("Error getting specialists: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	msg := myI18n.T(loc, "Master.Stats")
	msg += myI18n.Tf(loc, "Master.SpecialistCount", map[string]interface{}{"Count": len(specialists)})

	h.bot.SendMessage(chatID, msg, nil)
}

/***************************************************************************************************
* Handles start.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleStart(chatID, userID int64, loc *localizerType) {
	/***************************************************************************************************
	* Check if already registered.
	***************************************************************************************************/
	existing, err := db.GetSpecialistByTelegramID(userID)
	if err != nil {
		log.Printf("Error checking existing specialist: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	if existing != nil && existing.IsActive {
		/***************************************************************************************************
		* Already registered and active — re-register handler in case it was lost.
		***************************************************************************************************/
		log.Printf("Specialist @%s already exists, re-registering handler", existing.BotUsername)
		if OnSpecialistCreated != nil {
			if err := OnSpecialistCreated(existing); err != nil {
				log.Printf("Error re-registering bot for @%s: %v", existing.BotUsername, err)
				h.bot.SendMessage(chatID, fmt.Sprintf(myI18n.T(loc, "Master.RegistrationFailed"), existing.BotUsername), nil)
				return
			}
		}
		msg := fmt.Sprintf(myI18n.T(loc, "Master.AlreadyRegistered"), existing.BotUsername)
		h.bot.SendMessage(chatID, msg, nil)
		return
	}

	/***************************************************************************************************
	* Start onboarding.
	***************************************************************************************************/
	h.setSession(userID, &OnboardingSession{State: StateAwaitingToken})
	h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Welcome"), nil)
}

/***************************************************************************************************
* Handles cancel.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleCancel(chatID, userID int64, loc *localizerType) {
	h.setSession(userID, nil)
	h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Cancelled"), nil)
}

/***************************************************************************************************
* Handles token input.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - text: Text used by the current operation.
* - session: Session used by the current operation.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleTokenInput(chatID, userID int64, text string, session *OnboardingSession, loc *localizerType) {
	/***************************************************************************************************
	* Validate token format (basic check).
	***************************************************************************************************/
	if !strings.Contains(text, ":") {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.InvalidToken"), nil)
		return
	}

	/***************************************************************************************************
	* Check if token already registered.
	***************************************************************************************************/
	existing, err := db.GetSpecialistByBotToken(text)
	if err != nil {
		log.Printf("Error checking existing bot: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}
	if existing != nil {
		if existing.TelegramUserID == userID {
			/***************************************************************************************************
			* Same user's bot — re-register handler and confirm.
			***************************************************************************************************/
			log.Printf("Token for @%s already exists for same user, re-registering", existing.BotUsername)
			if OnSpecialistCreated != nil {
				if err := OnSpecialistCreated(existing); err != nil {
					log.Printf("Error re-registering bot for @%s: %v", existing.BotUsername, err)
					h.bot.SendMessage(chatID, fmt.Sprintf(myI18n.T(loc, "Master.RegistrationFailed"), existing.BotUsername), nil)
					h.setSession(userID, nil)
					return
				}
			}
			msg := fmt.Sprintf(myI18n.T(loc, "Master.AlreadyRegistered"), existing.BotUsername)
			h.bot.SendMessage(chatID, msg, nil)
			h.setSession(userID, nil)
		} else {
			h.bot.SendMessage(chatID, myI18n.T(loc, "Master.TokenAlreadyUsed"), nil)
		}
		return
	}

	/***************************************************************************************************
	* Validate with Telegram.
	***************************************************************************************************/
	bot, err := NewBot(text)
	if err != nil {
		log.Printf("Invalid bot token: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.InvalidToken"), nil)
		return
	}

	/***************************************************************************************************
	* Token valid, save and ask for name.
	***************************************************************************************************/
	session.BotToken = text
	session.BotUsername = bot.Username
	session.State = StateAwaitingName
	h.setSession(userID, session)

	msg := fmt.Sprintf(myI18n.T(loc, "Master.TokenAccepted"), bot.Username)
	h.bot.SendMessage(chatID, msg, nil)
}

/***************************************************************************************************
* Handles name input.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - text: Text used by the current operation.
* - session: Session used by the current operation.
* - username: Username used by the current operation.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleNameInput(chatID, userID int64, text string, session *OnboardingSession, username string, loc *localizerType) {
	name := strings.TrimSpace(text)
	if len(name) < 2 {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.NameTooShort"), nil)
		return
	}

	/***************************************************************************************************
	* Create specialist.
	***************************************************************************************************/
	specialist, err := db.CreateSpecialist(
		userID,
		session.BotToken,
		session.BotUsername,
		name,
		"Europe/Moscow",
		24,
	)
	if err != nil {
		log.Printf("Error creating specialist: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	/***************************************************************************************************
	* Save specialist's personal Telegram handle.
	***************************************************************************************************/
	if username != "" {
		if _, err := db.UpdateSpecialistProfile(specialist.ID, username, "", "", "", "", 0, 0); err != nil {
			log.Printf("Error saving telegram handle: %v", err)
		}
	}

	/***************************************************************************************************
	* Seed default data.
	***************************************************************************************************/
	h.seedDefaults(specialist.ID, loc)

	/***************************************************************************************************
	* Register bot handler + webhook via main.go callback.
	***************************************************************************************************/
	if OnSpecialistCreated != nil {
		if err := OnSpecialistCreated(specialist); err != nil {
			log.Printf("Error registering bot for @%s: %v", session.BotUsername, err)
			h.bot.SendMessage(chatID, fmt.Sprintf(myI18n.T(loc, "Master.RegistrationFailed"), session.BotUsername), nil)
			h.setSession(userID, nil)
			return
		}
	}

	/***************************************************************************************************
	* Clear session.
	***************************************************************************************************/
	h.setSession(userID, nil)

	/***************************************************************************************************
	* Send success message.
	***************************************************************************************************/
	msg := fmt.Sprintf(myI18n.T(loc, "Master.Success"), name, session.BotUsername, session.BotUsername, session.BotUsername)
	h.bot.SendMessage(chatID, msg, nil)

	log.Printf("New specialist registered: %s (@%s)", name, session.BotUsername)
}

/***************************************************************************************************
* Implements the seed defaults logic used by this module.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) seedDefaults(specialistID string, loc *localizerType) {
	/***************************************************************************************************
	* Session types.
	***************************************************************************************************/
	sessionTypes := []struct {
		typeCode string
		name     string
		duration int
		price    int
	}{
		{"personal", myI18n.T(loc, "Seed.Personal"), 60, 3000},
		{"pair", myI18n.T(loc, "Seed.Pair"), 60, 4500},
		{"consultation", myI18n.T(loc, "Seed.Consultation"), 30, 1500},
	}

	for _, st := range sessionTypes {
		db.CreateSessionType(specialistID, st.typeCode, st.name, st.duration, st.price, "RUB", "")
	}

	/***************************************************************************************************
	* Working hours (Mon-Fri 9-18, Sat 10-15).
	***************************************************************************************************/
	workingHours := []struct {
		day   int
		start string
		end   string
	}{
		{1, "09:00", "18:00"},
		{2, "09:00", "18:00"},
		{3, "09:00", "18:00"},
		{4, "09:00", "18:00"},
		{5, "09:00", "18:00"},
		{6, "10:00", "15:00"},
	}

	for _, wh := range workingHours {
		db.UpsertWorkingHours(specialistID, wh.day, wh.start, wh.end)
	}
}

/***************************************************************************************************
* OnSpecialistCreated is called when a new specialist is created or re-registered. Set by main.go
* to register the new bot dynamically. Returns error if registration fails.
*
* Usage context:
* - Reused by the telegram bot layer to keep shared values centralized.
***************************************************************************************************/
var OnSpecialistCreated func(specialist *models.Specialist) error

/***************************************************************************************************
* localizerType is an alias for the go-i18n Localizer type used in master handler signatures.
***************************************************************************************************/
type localizerType = i18n.Localizer
