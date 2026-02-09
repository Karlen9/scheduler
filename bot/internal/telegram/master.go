package telegram

import (
	"fmt"
	"log"
	"strings"
	"sync"

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
		h.handleCommand(chatID, userID, text)
		return
	}

	// Handle conversation flow
	session := h.getSession(userID)
	if session == nil {
		// No active session, prompt to start
		h.bot.SendMessage(chatID, MasterMsgUnknown, nil)
		return
	}

	switch session.State {
	case StateAwaitingToken:
		h.handleTokenInput(chatID, userID, text, session)
	case StateAwaitingName:
		h.handleNameInput(chatID, userID, text, session, msg.From.Username)
	}
}

func (h *MasterHandler) handleCommand(chatID, userID int64, text string) {
	cmd := strings.Split(text, " ")[0]

	switch cmd {
	case "/start":
		h.handleStart(chatID, userID)
	case "/cancel":
		h.handleCancel(chatID, userID)
	case "/help":
		if h.isAdmin(userID) {
			h.bot.SendMessage(chatID, MasterMsgHelpAdmin, nil)
		} else {
			h.bot.SendMessage(chatID, MasterMsgHelp, nil)
		}
	case "/trainers":
		h.handleAdminTrainers(chatID, userID)
	case "/stats":
		h.handleAdminStats(chatID, userID)
	default:
		h.bot.SendMessage(chatID, MasterMsgUnknown, nil)
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

func (h *MasterHandler) handleAdminTrainers(chatID, userID int64) {
	if !h.isAdmin(userID) {
		h.bot.SendMessage(chatID, MasterMsgUnknown, nil)
		return
	}

	trainers, err := db.GetAllActiveTrainers()
	if err != nil {
		log.Printf("Error getting trainers: %v", err)
		h.bot.SendMessage(chatID, MasterMsgError, nil)
		return
	}

	if len(trainers) == 0 {
		h.bot.SendMessage(chatID, "📋 Нет зарегистрированных тренеров", nil)
		return
	}

	msg := fmt.Sprintf("📋 Тренеры (%d):\n\n", len(trainers))
	for i, t := range trainers {
		msg += fmt.Sprintf("%d. %s\n   @%s\n   ID: %d\n   Создан: %s\n\n",
			i+1,
			t.Name,
			t.BotUsername,
			t.TelegramUserID,
			t.CreatedAt.Format("02.01.2006 15:04"),
		)
	}

	h.bot.SendMessage(chatID, msg, nil)
}

func (h *MasterHandler) handleAdminStats(chatID, userID int64) {
	if !h.isAdmin(userID) {
		h.bot.SendMessage(chatID, MasterMsgUnknown, nil)
		return
	}

	trainers, err := db.GetAllActiveTrainers()
	if err != nil {
		log.Printf("Error getting trainers: %v", err)
		h.bot.SendMessage(chatID, MasterMsgError, nil)
		return
	}

	msg := fmt.Sprintf(`📊 Статистика

👥 Тренеров: %d`, len(trainers))

	h.bot.SendMessage(chatID, msg, nil)
}

func (h *MasterHandler) handleStart(chatID, userID int64) {
	// Check if already registered
	existing, err := db.GetTrainerByTelegramID(userID)
	if err != nil {
		log.Printf("Error checking existing trainer: %v", err)
		h.bot.SendMessage(chatID, MasterMsgError, nil)
		return
	}

	if existing != nil && existing.IsActive {
		// Already registered and active
		msg := fmt.Sprintf(MasterMsgAlreadyRegistered, existing.BotUsername)
		h.bot.SendMessage(chatID, msg, nil)
		return
	}

	// Start onboarding
	h.setSession(userID, &OnboardingSession{State: StateAwaitingToken})
	h.bot.SendMessage(chatID, MasterMsgWelcome, nil)
}

func (h *MasterHandler) handleCancel(chatID, userID int64) {
	h.setSession(userID, nil)
	h.bot.SendMessage(chatID, MasterMsgCancelled, nil)
}

func (h *MasterHandler) handleTokenInput(chatID, userID int64, text string, session *OnboardingSession) {
	// Validate token format (basic check)
	if !strings.Contains(text, ":") {
		h.bot.SendMessage(chatID, MasterMsgInvalidToken, nil)
		return
	}

	// Check if token already registered
	existing, err := db.GetTrainerByBotToken(text)
	if err != nil {
		log.Printf("Error checking existing bot: %v", err)
		h.bot.SendMessage(chatID, MasterMsgError, nil)
		return
	}
	if existing != nil {
		h.bot.SendMessage(chatID, MasterMsgTokenAlreadyUsed, nil)
		return
	}

	// Validate with Telegram
	bot, err := NewBot(text)
	if err != nil {
		log.Printf("Invalid bot token: %v", err)
		h.bot.SendMessage(chatID, MasterMsgInvalidToken, nil)
		return
	}

	// Token valid, save and ask for name
	session.BotToken = text
	session.BotUsername = bot.Username
	session.State = StateAwaitingName
	h.setSession(userID, session)

	msg := fmt.Sprintf(MasterMsgTokenAccepted, bot.Username)
	h.bot.SendMessage(chatID, msg, nil)
}

func (h *MasterHandler) handleNameInput(chatID, userID int64, text string, session *OnboardingSession, username string) {
	name := strings.TrimSpace(text)
	if len(name) < 2 {
		h.bot.SendMessage(chatID, MasterMsgNameTooShort, nil)
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
		h.bot.SendMessage(chatID, MasterMsgError, nil)
		return
	}

	// Save trainer's personal Telegram handle
	if username != "" {
		if _, err := db.UpdateTrainerProfile(trainer.ID, username, "", "", "", "", 0, 0, ""); err != nil {
			log.Printf("Error saving telegram handle: %v", err)
		}
	}

	// Register webhook
	trainerBot, err := NewBot(session.BotToken)
	if err != nil {
		log.Printf("Error creating bot for webhook: %v", err)
	} else {
		webhookURL := strings.TrimRight(h.publicBaseURL, "/") + "/tg/" + trainer.WebhookSecret + "/webhook"
		if err := trainerBot.SetWebhook(webhookURL, trainer.WebhookSecret); err != nil {
			log.Printf("Error setting webhook: %v", err)
		} else {
			log.Printf("Webhook set for @%s", session.BotUsername)
		}
	}

	// Seed default data
	h.seedDefaults(trainer.ID)

	// Clear session
	h.setSession(userID, nil)

	// Send success message
	msg := fmt.Sprintf(MasterMsgSuccess, name, session.BotUsername, session.BotUsername, session.BotUsername)
	h.bot.SendMessage(chatID, msg, nil)

	log.Printf("New trainer registered: %s (@%s)", name, session.BotUsername)

	// Notify about webhook registration for main.go to pick up
	if OnTrainerCreated != nil {
		OnTrainerCreated(trainer)
	}
}

func (h *MasterHandler) seedDefaults(trainerID string) {
	// Session types
	sessionTypes := []struct {
		typeCode string
		name     string
		duration int
		price    int
	}{
		{"personal", "Персональная тренировка", 60, 3000},
		{"pair", "Парная тренировка", 60, 4500},
		{"consultation", "Консультация", 30, 1500},
	}

	for _, st := range sessionTypes {
		db.CreateSessionType(trainerID, st.typeCode, st.name, st.duration, st.price, "RUB")
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

// OnTrainerCreated is called when a new trainer is created
// Set by main.go to register the new bot dynamically
var OnTrainerCreated func(trainer *models.Trainer)
