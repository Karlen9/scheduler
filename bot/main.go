package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/config"
	"scheduler-bot/internal/crypto"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
	"scheduler-bot/internal/telegram"
)

// BotManager manages multiple bot instances
type BotManager struct {
	mu        sync.RWMutex
	bots      map[string]*telegram.Bot     // webhookSecret -> bot
	handlers  map[string]*telegram.Handler // webhookSecret -> handler
	webAppURL string
	baseURL   string
}

func NewBotManager(webAppURL, baseURL string) *BotManager {
	return &BotManager{
		bots:      make(map[string]*telegram.Bot),
		handlers:  make(map[string]*telegram.Handler),
		webAppURL: webAppURL,
		baseURL:   baseURL,
	}
}

func (m *BotManager) RegisterBot(specialist *models.Specialist) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Skip if already registered
	if _, exists := m.bots[specialist.WebhookSecret]; exists {
		return nil
	}

	bot, err := telegram.NewBot(specialist.BotToken)
	if err != nil {
		return err
	}

	handler := telegram.NewHandler(bot, m.webAppURL)
	handler.Version = Version

	// Clear any stale webhook/pending updates before setting new one
	if err := bot.DeleteWebhook(true); err != nil {
		log.Printf("Warning: deleteWebhook for @%s: %v", bot.Username, err)
	}

	// Set webhook with retry
	webhookURL := strings.TrimRight(m.baseURL, "/") + "/tg/" + specialist.WebhookSecret + "/webhook"
	for attempt := 1; attempt <= 3; attempt++ {
		if err := bot.SetWebhook(webhookURL, specialist.WebhookSecret); err != nil {
			log.Printf("Failed to set webhook for @%s (attempt %d): %v", bot.Username, attempt, err)
			if attempt < 3 {
				time.Sleep(time.Duration(attempt) * 2 * time.Second)
			}
		} else {
			log.Printf("Webhook set for @%s", bot.Username)
			break
		}
	}

	m.bots[specialist.WebhookSecret] = bot
	m.handlers[specialist.WebhookSecret] = handler

	// Log webhook info for debugging
	url, pending, lastErr := bot.GetWebhookInfo()
	log.Printf("  Webhook info for @%s: url=%s pending=%d lastError=%q", bot.Username, url, pending, lastErr)

	return nil
}

func (m *BotManager) GetHandler(webhookSecret string) *telegram.Handler {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.handlers[webhookSecret]
}

// GetOrLoadHandler returns the handler for the given webhook secret,
// lazy-loading from DB if not found in memory (e.g. after failed registration).
func (m *BotManager) GetOrLoadHandler(webhookSecret string) *telegram.Handler {
	// Fast path: already registered
	if h := m.GetHandler(webhookSecret); h != nil {
		return h
	}

	// Slow path: look up specialist in DB and register on-the-fly
	specialist, err := db.GetSpecialistByWebhookSecret(webhookSecret)
	if err != nil {
		log.Printf("Lazy-load DB error for secret %s...: %v", webhookSecret[:8], err)
		return nil
	}
	if specialist == nil {
		return nil
	}

	log.Printf("Lazy-loading bot for specialist %s (webhook handler was missing)", specialist.Name)
	if err := m.RegisterBot(specialist); err != nil {
		log.Printf("Failed to lazy-load bot for specialist %s: %v", specialist.Name, err)
		return nil
	}

	return m.GetHandler(webhookSecret)
}

func (m *BotManager) GetBot(webhookSecret string) *telegram.Bot {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.bots[webhookSecret]
}

var botManager *BotManager

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize encryption
	if err := crypto.Init(cfg.EncryptionKey); err != nil {
		log.Fatalf("Failed to initialize encryption: %v", err)
	}

	// Initialize i18n translations
	if err := myI18n.Init(); err != nil {
		log.Fatalf("Failed to load translations: %v", err)
	}

	// Initialize database (Postgres if DATABASE_URL is set, otherwise SQLite)
	dbTarget := cfg.DatabasePath
	if cfg.DatabaseURL != "" {
		dbTarget = cfg.DatabaseURL
	}
	if err := db.Init(dbTarget); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Migrate existing plain-text tokens to encrypted form
	if err := db.MigrateEncryptTokens(); err != nil {
		log.Fatalf("Failed to migrate encrypted tokens: %v", err)
	}

	// Create bot manager
	botManager = NewBotManager(cfg.WebAppURL, cfg.PublicBaseURL)

	// Set up callback for when new specialists are created via master bot
	telegram.OnSpecialistCreated = func(specialist *models.Specialist) error {
		if err := botManager.RegisterBot(specialist); err != nil {
			log.Printf("Failed to register new bot: %v", err)
			return err
		}
		return nil
	}

	// Legacy: seed initial data if single-bot env vars are set and no specialists exist
	if cfg.TelegramBotToken != "" && cfg.SpecialistTelegramID != 0 {
		if err := seedLegacyData(cfg); err != nil {
			log.Printf("Warning: Failed to seed legacy data: %v", err)
		}
	}

	// Load all active specialists and register their bots
	specialists, err := db.GetAllActiveSpecialists()
	if err != nil {
		log.Fatalf("Failed to load specialists: %v", err)
	}

	for i, specialist := range specialists {
		if err := botManager.RegisterBot(&specialist); err != nil {
			log.Printf("Failed to register bot for specialist %s: %v", specialist.Name, err)
		}
		// Avoid Telegram rate limits when registering multiple bots
		if i < len(specialists)-1 {
			time.Sleep(500 * time.Millisecond)
		}
	}

	log.Printf("Loaded %d specialist bot(s)", len(specialists))

	// Set up notification callback for client-created bookings (notify specialist)
	api.NotifyBookingFunc = func(booking *models.Booking) error {
		specialist, err := db.GetSpecialistByID(booking.SpecialistID)
		if err != nil || specialist == nil {
			return err
		}
		if !specialist.NotifyNewBookings {
			log.Printf("Skipping new booking notification for specialist %s (disabled)", specialist.Name)
			return nil
		}
		handler := botManager.GetHandler(specialist.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for specialist %s", specialist.Name)
			return nil
		}
		return handler.NotifySpecialistNewBooking(booking)
	}

	// Set up notification callback for admin status changes - finds correct bot by specialist
	api.NotifyStatusChangeFunc = func(booking *models.Booking, newStatus string) error {
		specialist, err := db.GetSpecialistByID(booking.SpecialistID)
		if err != nil || specialist == nil {
			return err
		}
		// Check client notification preferences
		client, err := db.GetClientByID(booking.ClientID)
		if err != nil || client == nil {
			return err
		}
		if client.IsGhost {
			return nil
		}
		if !client.NotifyBookingStatus {
			log.Printf("Skipping status change notification for client %s (disabled)", client.Name)
			return nil
		}
		handler := botManager.GetHandler(specialist.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for specialist %s", specialist.Name)
			return nil
		}
		return handler.NotifyClientStatusChange(booking, newStatus)
	}

	// Set up callback to edit specialist's Telegram message when admin panel changes booking status
	api.UpdateSpecialistMessageFunc = func(booking *models.Booking) error {
		chatID, messageID, err := db.GetBookingNotificationInfo(booking.ID)
		if err != nil || messageID == 0 {
			return nil // No message to edit
		}
		specialist, err := db.GetSpecialistByID(booking.SpecialistID)
		if err != nil || specialist == nil {
			return nil
		}
		handler := botManager.GetHandler(specialist.WebhookSecret)
		if handler == nil {
			return nil
		}
		return handler.UpdateBookingNotificationMessageByIDs(chatID, messageID, booking)
	}

	// Set up notification callback for specialist-initiated bookings (notify client)
	api.NotifySpecialistBookingFunc = func(booking *models.Booking) error {
		client, err := db.GetClientByID(booking.ClientID)
		if err != nil || client == nil {
			return err
		}
		if client.IsGhost {
			return nil
		}
		if !client.NotifyBookingStatus {
			log.Printf("Skipping specialist booking notification for client %s (disabled)", client.Name)
			return nil
		}
		specialist, err := db.GetSpecialistByID(booking.SpecialistID)
		if err != nil || specialist == nil {
			return err
		}
		handler := botManager.GetHandler(specialist.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for specialist %s", specialist.Name)
			return nil
		}
		return handler.NotifyClientSpecialistBooking(booking)
	}

	// Set up notification callback for client confirm/decline of specialist-created bookings
	api.NotifyClientBookingResponseFunc = func(booking *models.Booking, accepted bool) error {
		specialist, err := db.GetSpecialistByID(booking.SpecialistID)
		if err != nil || specialist == nil {
			return err
		}
		handler := botManager.GetHandler(specialist.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for specialist %s", specialist.Name)
			return nil
		}
		return handler.NotifySpecialistClientBookingResponse(booking, accepted)
	}

	// Set up callback to edit client's Telegram notification message
	api.UpdateClientMessageFunc = func(booking *models.Booking) error {
		chatID, messageID, err := db.GetClientNotificationInfo(booking.ID)
		if err != nil || chatID == 0 || messageID == 0 {
			return nil // No saved message to edit
		}
		specialist, err := db.GetSpecialistByID(booking.SpecialistID)
		if err != nil || specialist == nil {
			return nil
		}
		handler := botManager.GetHandler(specialist.WebhookSecret)
		if handler == nil {
			return nil
		}
		client, err := db.GetClientByID(booking.ClientID)
		if err != nil || client == nil {
			return nil
		}
		loc := myI18n.NewLocalizer(client.Language)
		return handler.UpdateClientNotificationMessage(loc, chatID, messageID, booking)
	}

	// Set up recurring schedule notification callback
	api.NotifyRecurringScheduleFunc = func(schedule *models.RecurringSchedule, previewCount int) error {
		specialist, err := db.GetSpecialistByID(schedule.SpecialistID)
		if err != nil || specialist == nil {
			return err
		}
		handler := botManager.GetHandler(specialist.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for specialist %s", specialist.Name)
			return nil
		}
		if schedule.CreatedBy == "client" {
			// Notify specialist about client-created schedule
			if !specialist.NotifyNewBookings {
				log.Printf("Skipping recurring schedule notification for specialist %s (disabled)", specialist.Name)
				return nil
			}
			return handler.NotifySpecialistRecurringSchedule(schedule, previewCount)
		}
		// Notify client about specialist-created schedule
		client, err := db.GetClientByID(schedule.ClientID)
		if err != nil || client == nil {
			return err
		}
		if client.IsGhost {
			return nil
		}
		if !client.NotifyBookingStatus {
			log.Printf("Skipping recurring schedule notification for client %s (disabled)", client.Name)
			return nil
		}
		return handler.NotifyClientRecurringSchedule(schedule, previewCount)
	}

	// Set up cancellation notification callback
	api.NotifyCancellationFunc = func(booking *models.Booking, cancelledBy string) error {
		specialist, err := db.GetSpecialistByID(booking.SpecialistID)
		if err != nil || specialist == nil {
			return err
		}
		handler := botManager.GetHandler(specialist.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for specialist %s", specialist.Name)
			return nil
		}
		if cancelledBy == "client" {
			// Client cancelled — notify specialist if enabled
			if !specialist.NotifyCancellations {
				log.Printf("Skipping cancellation notification for specialist %s (disabled)", specialist.Name)
				return nil
			}
			return handler.NotifySpecialistBookingCancelled(booking)
		}
		// Specialist cancelled — notify client if enabled
		client, err := db.GetClientByID(booking.ClientID)
		if err != nil || client == nil {
			return err
		}
		if client.IsGhost {
			return nil
		}
		if !client.NotifyCancellations {
			log.Printf("Skipping cancellation notification for client %s (disabled)", client.Name)
			return nil
		}
		return handler.NotifyClientBookingCancelled(booking)
	}

	// Set up move request notification callback
	api.NotifyMoveRequestFunc = func(newBooking, oldBooking *models.Booking, requestedBy string) error {
		specialist, err := db.GetSpecialistByID(oldBooking.SpecialistID)
		if err != nil || specialist == nil {
			return err
		}
		handler := botManager.GetHandler(specialist.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for specialist %s", specialist.Name)
			return nil
		}
		return handler.NotifyMoveRequest(newBooking, oldBooking, requestedBy)
	}

	api.SuperadminSecret = cfg.SuperadminSecret
	api.WebAppURL = cfg.WebAppURL

	api.LoadTestMode = os.Getenv("LOAD_TEST_MODE") == "true"
	if api.LoadTestMode {
		log.Println("WARNING: LOAD_TEST_MODE enabled — Telegram auth bypassed for X-Test-User-ID requests")
	}

	// Set up HTTP server
	apiRouter := api.NewRouter()

	// Master bot webhook (for specialist onboarding)
	var masterHandler *telegram.MasterHandler
	var masterWebhookSecret string
	if cfg.MasterBotToken != "" {
		masterBot, err := telegram.NewBot(cfg.MasterBotToken)
		if err != nil {
			log.Fatalf("Failed to create master bot: %v", err)
		}
		log.Printf("Master bot: @%s", masterBot.Username)

		masterHandler = telegram.NewMasterHandler(masterBot, cfg.PublicBaseURL, cfg.WebAppURL, cfg.AdminIDs)

		// Use fixed webhook secret from env, or generate a random one
		if cfg.MasterWebhookSecret != "" {
			masterWebhookSecret = cfg.MasterWebhookSecret
		} else {
			secretBytes := make([]byte, 32)
			rand.Read(secretBytes)
			masterWebhookSecret = hex.EncodeToString(secretBytes)
			log.Println("Warning: MASTER_WEBHOOK_SECRET not set, using random secret (will change on restart)")
		}

		// Set webhook for master bot
		masterBot.DeleteWebhook(true)
		masterWebhookURL := strings.TrimRight(cfg.PublicBaseURL, "/") + "/master/" + masterWebhookSecret + "/webhook"
		if err := masterBot.SetWebhook(masterWebhookURL, masterWebhookSecret); err != nil {
			log.Printf("Failed to set master bot webhook: %v", err)
		} else {
			log.Printf("Master bot webhook set")
		}
	}

	// Main handler: route by path prefix (avoids Go 1.22 ServeMux issues with chi)
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		if strings.HasPrefix(path, "/tg/") {
			// Specialist bot webhooks
			log.Printf("Webhook request: %s %s", r.Method, path)

			parts := strings.Split(strings.Trim(path, "/"), "/")
			if len(parts) < 3 || parts[2] != "webhook" {
				log.Printf("Webhook rejected: invalid path (parts=%d)", len(parts))
				http.NotFound(w, r)
				return
			}
			secret := parts[1]

			if r.Method != http.MethodPost {
				log.Printf("Webhook rejected: method %s", r.Method)
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}

			secretHeader := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
			if secretHeader == "" || secretHeader != secret {
				log.Printf("Webhook rejected: secret mismatch")
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			h := botManager.GetOrLoadHandler(secret)
			if h == nil {
				log.Printf("Webhook ignored: no handler for secret %s... (returning 200 to stop retries)", secret[:8])
				w.WriteHeader(http.StatusOK)
				return
			}

			r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
			defer r.Body.Close()

			var update telegram.Update
			if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
				log.Printf("Webhook rejected: invalid json: %v", err)
				http.Error(w, "invalid json", http.StatusBadRequest)
				return
			}

			log.Printf("Webhook update received (message=%v, callback=%v)", update.Message != nil, update.CallbackQuery != nil)
			w.WriteHeader(http.StatusOK)
			go h.HandleUpdate(update)
			return
		}

		if strings.HasPrefix(path, "/master/") && masterHandler != nil {
			// Master bot webhook
			log.Printf("Master webhook request: %s %s", r.Method, path)

			parts := strings.Split(strings.Trim(path, "/"), "/")
			if len(parts) < 3 || parts[2] != "webhook" {
				http.NotFound(w, r)
				return
			}
			secret := parts[1]

			if r.Method != http.MethodPost {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}

			if secret != masterWebhookSecret {
				log.Printf("Master webhook rejected: secret mismatch")
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			secretHeader := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
			if secretHeader != masterWebhookSecret {
				log.Printf("Master webhook rejected: header mismatch")
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
			defer r.Body.Close()

			var update telegram.Update
			if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
				log.Printf("Master webhook rejected: invalid json: %v", err)
				http.Error(w, "invalid json", http.StatusBadRequest)
				return
			}

			log.Printf("Master webhook update (message=%v, callback=%v)", update.Message != nil, update.CallbackQuery != nil)
			w.WriteHeader(http.StatusOK)
			go masterHandler.HandleUpdate(update)
			return
		}

		// Everything else goes to the API router
		apiRouter.ServeHTTP(w, r)
	})

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Start background reminder worker
	reminderCtx, reminderCancel := context.WithCancel(context.Background())
	defer reminderCancel()
	go startReminderWorker(reminderCtx)

	go func() {
		log.Printf("Starting HTTP server on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	shutdownCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-shutdownCtx.Done()

	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}
}

func startReminderWorker(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	log.Println("Reminder worker started")

	for {
		select {
		case <-ctx.Done():
			log.Println("Reminder worker stopped")
			return
		case <-ticker.C:
			sendReminders()
		}
	}
}

func sendReminders() {
	bookings, err := db.GetBookingsNeedingReminder()
	if err != nil {
		log.Printf("Reminder: error fetching bookings: %v", err)
		return
	}

	for _, booking := range bookings {
		// Get client to find their Telegram user ID
		client, err := db.GetClientByID(booking.ClientID)
		if err != nil || client == nil {
			log.Printf("Reminder: error getting client for booking %s: %v", booking.ID, err)
			continue
		}

		// Check client notification preferences
		if !client.NotifyReminders {
			// Mark as sent so we don't check again
			db.MarkReminderSent(booking.ID)
			log.Printf("Reminder: skipping for client %s (reminders disabled)", client.Name)
			continue
		}

		// Get specialist to find the correct bot
		specialist, err := db.GetSpecialistByID(booking.SpecialistID)
		if err != nil || specialist == nil {
			log.Printf("Reminder: error getting specialist for booking %s: %v", booking.ID, err)
			continue
		}

		bot := botManager.GetBot(specialist.WebhookSecret)
		if bot == nil {
			log.Printf("Reminder: no bot found for specialist %s", specialist.Name)
			continue
		}

		loc := myI18n.NewLocalizer(client.Language)
		text := telegram.FormatReminderClient(loc, &booking)
		if _, err := bot.SendMessage(client.TelegramUserID, text, nil); err != nil {
			log.Printf("Reminder: error sending to client %s: %v", client.Name, err)
			continue
		}

		if err := db.MarkReminderSent(booking.ID); err != nil {
			log.Printf("Reminder: error marking sent for booking %s: %v", booking.ID, err)
		}

		log.Printf("Reminder sent for booking %s (client: %s)", booking.ID, client.Name)
	}
}

func seedLegacyData(cfg *config.Config) error {
	existing, err := db.GetSpecialistByTelegramID(cfg.SpecialistTelegramID)
	if err != nil {
		return err
	}
	if existing != nil {
		return nil
	}

	bot, err := telegram.NewBot(cfg.TelegramBotToken)
	if err != nil {
		return err
	}

	log.Println("Seeding initial specialist from env vars...")

	specialist, err := db.CreateSpecialist(
		cfg.SpecialistTelegramID,
		cfg.TelegramBotToken,
		bot.Username,
		cfg.SpecialistName,
		"Europe/Moscow",
		24,
	)
	if err != nil {
		return err
	}
	log.Printf("Created specialist: %s (@%s)", specialist.Name, specialist.BotUsername)

	loc := myI18n.Default()
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
		db.CreateSessionType(specialist.ID, st.typeCode, st.name, st.duration, st.price, "RUB", "")
	}

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
		db.UpsertWorkingHours(specialist.ID, wh.day, wh.start, wh.end)
	}

	log.Println("Legacy seed complete!")
	return nil
}
