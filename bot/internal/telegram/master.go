package telegram

import (
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

// OnboardingState tracks where a user is in the onboarding flow
type OnboardingState int

const (
	StateNone OnboardingState = iota
	StateAwaitingToken
	StateAwaitingName
)

// OnboardingSession holds temporary data during onboarding
type OnboardingSession struct {
	State       OnboardingState
	BotToken    string
	BotUsername string
}

// MasterHandler handles the master bot for trainer onboarding
type MasterHandler struct {
	bot           *Bot
	sessions      map[int64]*OnboardingSession // telegramUserID -> session
	mu            sync.RWMutex
	publicBaseURL string
	webAppURL     string
	adminIDs      []int64
}

// NewMasterHandler creates a new master bot handler
func NewMasterHandler(bot *Bot, publicBaseURL, webAppURL string, adminIDs []int64) *MasterHandler {
	return &MasterHandler{
		bot:           bot,
		sessions:      make(map[int64]*OnboardingSession),
		publicBaseURL: publicBaseURL,
		webAppURL:     webAppURL,
		adminIDs:      adminIDs,
	}
}

func (h *MasterHandler) getSession(userID int64) *OnboardingSession {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.sessions[userID]
}

func (h *MasterHandler) setSession(userID int64, session *OnboardingSession) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if session == nil {
		delete(h.sessions, userID)
	} else {
		h.sessions[userID] = session
	}
}

// HandleUpdate processes incoming updates for the master bot
func (h *MasterHandler) HandleUpdate(update Update) {
	if update.Message == nil {
		return
	}

	msg := update.Message
	userID := msg.From.ID
	chatID := msg.Chat.ID
	text := strings.TrimSpace(msg.Text)

	// Handle commands
	if strings.HasPrefix(text, "/") {
		h.handleCommand(chatID, userID, text, msg.From.LanguageCode)
		return
	}

	// Handle conversation flow
	session := h.getSession(userID)
	if session == nil {
		// No active session, prompt to start
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
	case "/trainers":
		h.handleAdminTrainers(chatID, userID, loc)
	case "/stats":
		h.handleAdminStats(chatID, userID, loc)
	default:
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
	}
}

func (h *MasterHandler) isAdmin(userID int64) bool {
	for _, id := range h.adminIDs {
		if id == userID {
			return true
		}
	}
	return false
}

func (h *MasterHandler) handleAdminTrainers(chatID, userID int64, loc *localizerType) {
	if !h.isAdmin(userID) {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
		return
	}

	trainers, err := db.GetAllActiveTrainers()
	if err != nil {
		log.Printf("Error getting trainers: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	if len(trainers) == 0 {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.NoTrainers"), nil)
		return
	}

	msg := myI18n.Tf(loc, "Master.TrainersList", map[string]interface{}{"Count": len(trainers)})
	for i, t := range trainers {
		msg += myI18n.Tf(loc, "Master.TrainerItem", map[string]interface{}{
			"Num":         i + 1,
			"Name":        t.Name,
			"BotUsername":  t.BotUsername,
			"TelegramID":  t.TelegramUserID,
			"CreatedAt":   t.CreatedAt.Format("02.01.2006 15:04"),
		})
	}

	h.bot.SendMessage(chatID, msg, nil)
}

func (h *MasterHandler) handleAdminStats(chatID, userID int64, loc *localizerType) {
	if !h.isAdmin(userID) {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
		return
	}

	trainers, err := db.GetAllActiveTrainers()
	if err != nil {
		log.Printf("Error getting trainers: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	msg := myI18n.T(loc, "Master.Stats")
	msg += myI18n.Tf(loc, "Master.TrainerCount", map[string]interface{}{"Count": len(trainers)})

	h.bot.SendMessage(chatID, msg, nil)
}

func (h *MasterHandler) handleStart(chatID, userID int64, loc *localizerType) {
	// Check if already registered
	existing, err := db.GetTrainerByTelegramID(userID)
	if err != nil {
		log.Printf("Error checking existing trainer: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	if existing != nil && existing.IsActive {
		// Already registered and active — re-register handler in case it was lost
		log.Printf("Trainer @%s already exists, re-registering handler", existing.BotUsername)
		if OnTrainerCreated != nil {
			if err := OnTrainerCreated(existing); err != nil {
				log.Printf("Error re-registering bot for @%s: %v", existing.BotUsername, err)
				h.bot.SendMessage(chatID, fmt.Sprintf(myI18n.T(loc, "Master.RegistrationFailed"), existing.BotUsername), nil)
				return
			}
		}
		msg := fmt.Sprintf(myI18n.T(loc, "Master.AlreadyRegistered"), existing.BotUsername)
		h.bot.SendMessage(chatID, msg, nil)
		return
	}

	// Start onboarding
	h.setSession(userID, &OnboardingSession{State: StateAwaitingToken})
	h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Welcome"), nil)
}

func (h *MasterHandler) handleCancel(chatID, userID int64, loc *localizerType) {
	h.setSession(userID, nil)
	h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Cancelled"), nil)
}

func (h *MasterHandler) handleTokenInput(chatID, userID int64, text string, session *OnboardingSession, loc *localizerType) {
	// Validate token format (basic check)
	if !strings.Contains(text, ":") {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.InvalidToken"), nil)
		return
	}

	// Check if token already registered
	existing, err := db.GetTrainerByBotToken(text)
	if err != nil {
		log.Printf("Error checking existing bot: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}
	if existing != nil {
		if existing.TelegramUserID == userID {
			// Same user's bot — re-register handler and confirm
			log.Printf("Token for @%s already exists for same user, re-registering", existing.BotUsername)
			if OnTrainerCreated != nil {
				if err := OnTrainerCreated(existing); err != nil {
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

	// Validate with Telegram
	bot, err := NewBot(text)
	if err != nil {
		log.Printf("Invalid bot token: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.InvalidToken"), nil)
		return
	}

	// Token valid, save and ask for name
	session.BotToken = text
	session.BotUsername = bot.Username
	session.State = StateAwaitingName
	h.setSession(userID, session)

	msg := fmt.Sprintf(myI18n.T(loc, "Master.TokenAccepted"), bot.Username)
	h.bot.SendMessage(chatID, msg, nil)
}

func (h *MasterHandler) handleNameInput(chatID, userID int64, text string, session *OnboardingSession, username string, loc *localizerType) {
	name := strings.TrimSpace(text)
	if len(name) < 2 {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.NameTooShort"), nil)
		return
	}

	// Create trainer
	trainer, err := db.CreateTrainer(
		userID,
		session.BotToken,
		session.BotUsername,
		name,
		"Europe/Moscow",
		24,
	)
	if err != nil {
		log.Printf("Error creating trainer: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	// Save trainer's personal Telegram handle
	if username != "" {
		if _, err := db.UpdateTrainerProfile(trainer.ID, username, "", "", "", "", 0, 0); err != nil {
			log.Printf("Error saving telegram handle: %v", err)
		}
	}

	// Seed default data
	h.seedDefaults(trainer.ID, loc)

	// Register bot handler + webhook via main.go callback
	if OnTrainerCreated != nil {
		if err := OnTrainerCreated(trainer); err != nil {
			log.Printf("Error registering bot for @%s: %v", session.BotUsername, err)
			h.bot.SendMessage(chatID, fmt.Sprintf(myI18n.T(loc, "Master.RegistrationFailed"), session.BotUsername), nil)
			h.setSession(userID, nil)
			return
		}
	}

	// Clear session
	h.setSession(userID, nil)

	// Send success message
	msg := fmt.Sprintf(myI18n.T(loc, "Master.Success"), name, session.BotUsername, session.BotUsername, session.BotUsername)
	h.bot.SendMessage(chatID, msg, nil)

	log.Printf("New trainer registered: %s (@%s)", name, session.BotUsername)
}

func (h *MasterHandler) seedDefaults(trainerID string, loc *localizerType) {
	// Session types
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
		db.CreateSessionType(trainerID, st.typeCode, st.name, st.duration, st.price, "RUB", "")
	}

	// Working hours (Mon-Fri 9-18, Sat 10-15)
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
		db.UpsertWorkingHours(trainerID, wh.day, wh.start, wh.end)
	}
}

// OnTrainerCreated is called when a new trainer is created or re-registered.
// Set by main.go to register the new bot dynamically. Returns error if registration fails.
var OnTrainerCreated func(trainer *models.Trainer) error

// localizerType is an alias for the go-i18n Localizer type used in master handler signatures
type localizerType = i18n.Localizer
