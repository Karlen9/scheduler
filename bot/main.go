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

func (m *BotManager) RegisterBot(trainer *models.Trainer) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Skip if already registered
	if _, exists := m.bots[trainer.WebhookSecret]; exists {
		return nil
	}

	bot, err := telegram.NewBot(trainer.BotToken)
	if err != nil {
		return err
	}

	handler := telegram.NewHandler(bot, m.webAppURL)
	handler.Version = Version
	handler.Changelog = Changelog

	// Clear any stale webhook/pending updates before setting new one
	if err := bot.DeleteWebhook(true); err != nil {
		log.Printf("Warning: deleteWebhook for @%s: %v", bot.Username, err)
	}

	// Set webhook with retry
	webhookURL := strings.TrimRight(m.baseURL, "/") + "/tg/" + trainer.WebhookSecret + "/webhook"
	for attempt := 1; attempt <= 3; attempt++ {
		if err := bot.SetWebhook(webhookURL, trainer.WebhookSecret); err != nil {
			log.Printf("Failed to set webhook for @%s (attempt %d): %v", bot.Username, attempt, err)
			if attempt < 3 {
				time.Sleep(time.Duration(attempt) * 2 * time.Second)
			}
		} else {
			log.Printf("Webhook set for @%s", bot.Username)
			break
		}
	}

	m.bots[trainer.WebhookSecret] = bot
	m.handlers[trainer.WebhookSecret] = handler

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

	// Slow path: look up trainer in DB and register on-the-fly
	trainer, err := db.GetTrainerByWebhookSecret(webhookSecret)
	if err != nil || trainer == nil {
		return nil
	}

	log.Printf("Lazy-loading bot for trainer %s (webhook handler was missing)", trainer.Name)
	if err := m.RegisterBot(trainer); err != nil {
		log.Printf("Failed to lazy-load bot for trainer %s: %v", trainer.Name, err)
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

	// Initialize database
	if err := db.Init(cfg.DatabasePath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Migrate existing plain-text tokens to encrypted form
	if err := db.MigrateEncryptTokens(); err != nil {
		log.Fatalf("Failed to migrate encrypted tokens: %v", err)
	}

	// Create bot manager
	botManager = NewBotManager(cfg.WebAppURL, cfg.PublicBaseURL)

	// Set up callback for when new trainers are created via master bot
	telegram.OnTrainerCreated = func(trainer *models.Trainer) {
		if err := botManager.RegisterBot(trainer); err != nil {
			log.Printf("Failed to register new bot: %v", err)
		}
	}

	// Legacy: seed initial data if single-bot env vars are set and no trainers exist
	if cfg.TelegramBotToken != "" && cfg.TrainerTelegramID != 0 {
		if err := seedLegacyData(cfg); err != nil {
			log.Printf("Warning: Failed to seed legacy data: %v", err)
		}
	}

	// Load all active trainers and register their bots
	trainers, err := db.GetAllActiveTrainers()
	if err != nil {
		log.Fatalf("Failed to load trainers: %v", err)
	}

	for i, trainer := range trainers {
		if err := botManager.RegisterBot(&trainer); err != nil {
			log.Printf("Failed to register bot for trainer %s: %v", trainer.Name, err)
		}
		// Avoid Telegram rate limits when registering multiple bots
		if i < len(trainers)-1 {
			time.Sleep(500 * time.Millisecond)
		}
	}

	log.Printf("Loaded %d trainer bot(s)", len(trainers))

	// Set up notification callback for API - finds correct bot by trainer
	api.NotifyBookingFunc = func(booking *models.Booking) error {
		trainer, err := db.GetTrainerByID(booking.TrainerID)
		if err != nil || trainer == nil {
			return err
		}
		if !trainer.NotifyNewBookings {
			log.Printf("Skipping new booking notification for trainer %s (disabled)", trainer.Name)
			return nil
		}
		handler := botManager.GetHandler(trainer.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for trainer %s", trainer.Name)
			return nil
		}
		return handler.NotifyTrainerNewBooking(booking)
	}

	// Set up notification callback for admin status changes - finds correct bot by trainer
	api.NotifyStatusChangeFunc = func(booking *models.Booking, newStatus string) error {
		trainer, err := db.GetTrainerByID(booking.TrainerID)
		if err != nil || trainer == nil {
			return err
		}
		// Check client notification preferences
		client, err := db.GetClientByID(booking.ClientID)
		if err != nil || client == nil {
			return err
		}
		if !client.NotifyBookingStatus {
			log.Printf("Skipping status change notification for client %s (disabled)", client.Name)
			return nil
		}
		handler := botManager.GetHandler(trainer.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for trainer %s", trainer.Name)
			return nil
		}
		return handler.NotifyClientStatusChange(booking, newStatus)
	}

	// Set up notification callback for trainer-initiated bookings (notify client)
	api.NotifyTrainerBookingFunc = func(booking *models.Booking) error {
		client, err := db.GetClientByID(booking.ClientID)
		if err != nil || client == nil {
			return err
		}
		if !client.NotifyBookingStatus {
			log.Printf("Skipping trainer booking notification for client %s (disabled)", client.Name)
			return nil
		}
		trainer, err := db.GetTrainerByID(booking.TrainerID)
		if err != nil || trainer == nil {
			return err
		}
		handler := botManager.GetHandler(trainer.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for trainer %s", trainer.Name)
			return nil
		}
		return handler.NotifyClientTrainerBooking(booking)
	}

	// Set up recurring batch notification callback
	api.NotifyRecurringBatchFunc = func(trainerID, clientName, serviceName string, bookings []*models.Booking) error {
		trainer, err := db.GetTrainerByID(trainerID)
		if err != nil || trainer == nil {
			return err
		}
		if !trainer.NotifyNewBookings {
			log.Printf("Skipping recurring batch notification for trainer %s (disabled)", trainer.Name)
			return nil
		}
		handler := botManager.GetHandler(trainer.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for trainer %s", trainer.Name)
			return nil
		}
		return handler.NotifyTrainerRecurringBatch(trainer.TelegramUserID, clientName, serviceName, bookings)
	}

	// Set up waitlist offer notification callback
	api.NotifyWaitlistOfferFunc = func(entry *models.WaitlistEntry) error {
		trainer, err := db.GetTrainerByID(entry.TrainerID)
		if err != nil || trainer == nil {
			return err
		}
		client, err := db.GetClientByID(entry.ClientID)
		if err != nil || client == nil {
			return err
		}
		if !client.NotifyWaitlist {
			log.Printf("Skipping waitlist offer notification for client %s (disabled)", client.Name)
			return nil
		}
		handler := botManager.GetHandler(trainer.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for trainer %s", trainer.Name)
			return nil
		}
		return handler.NotifyClientWaitlistOffer(entry)
	}

	// Set up waitlist expired notification callback
	api.NotifyWaitlistExpiredFunc = func(entry *models.WaitlistEntry) error {
		trainer, err := db.GetTrainerByID(entry.TrainerID)
		if err != nil || trainer == nil {
			return err
		}
		client, err := db.GetClientByID(entry.ClientID)
		if err != nil || client == nil {
			return err
		}
		if !client.NotifyWaitlist {
			log.Printf("Skipping waitlist expired notification for client %s (disabled)", client.Name)
			return nil
		}
		handler := botManager.GetHandler(trainer.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for trainer %s", trainer.Name)
			return nil
		}
		return handler.NotifyClientWaitlistExpired(entry)
	}

	// Set up HTTP server
	apiRouter := api.NewRouter()

	// Master bot webhook (for trainer onboarding)
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
			// Trainer bot webhooks
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
				log.Printf("Webhook rejected: no handler for secret %s...", secret[:8])
				http.Error(w, "bot not found", http.StatusNotFound)
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
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			secretHeader := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
			if secretHeader != masterWebhookSecret {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
			defer r.Body.Close()

			var update telegram.Update
			if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
				http.Error(w, "invalid json", http.StatusBadRequest)
				return
			}

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

	// Start background waitlist expiry worker
	waitlistCtx, waitlistCancel := context.WithCancel(context.Background())
	defer waitlistCancel()
	go startWaitlistExpiryWorker(waitlistCtx)

	// Start background recurring schedule worker
	recurringCtx, recurringCancel := context.WithCancel(context.Background())
	defer recurringCancel()
	go startRecurringWorker(recurringCtx)

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

		// Get trainer to find the correct bot
		trainer, err := db.GetTrainerByID(booking.TrainerID)
		if err != nil || trainer == nil {
			log.Printf("Reminder: error getting trainer for booking %s: %v", booking.ID, err)
			continue
		}

		bot := botManager.GetBot(trainer.WebhookSecret)
		if bot == nil {
			log.Printf("Reminder: no bot found for trainer %s", trainer.Name)
			continue
		}

		text := telegram.FormatReminderClient(&booking)
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

func startWaitlistExpiryWorker(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	log.Println("Waitlist expiry worker started")

	for {
		select {
		case <-ctx.Done():
			log.Println("Waitlist expiry worker stopped")
			return
		case <-ticker.C:
			processExpiredWaitlistOffers()
		}
	}
}

func processExpiredWaitlistOffers() {
	entries, err := db.GetExpiredOffers(30 * time.Minute)
	if err != nil {
		log.Printf("Waitlist expiry: error fetching expired offers: %v", err)
		return
	}

	for _, entry := range entries {
		if err := db.UpdateWaitlistStatus(entry.ID, models.WaitlistStatusExpired); err != nil {
			log.Printf("Waitlist expiry: error updating entry %s: %v", entry.ID, err)
			continue
		}

		log.Printf("📋 WAITLIST EXPIRED [%s] Client: %s", entry.ID[:8], entry.ClientName)

		// Notify client about expired offer
		if api.NotifyWaitlistExpiredFunc != nil {
			if err := api.NotifyWaitlistExpiredFunc(&entry); err != nil {
				log.Printf("Waitlist expiry: error notifying client: %v", err)
			}
		}

		// Offer to next person in queue
		api.ProcessNextWaitlistEntry(entry.TrainerID, entry.StartsAt, entry.EndsAt)
	}
}

func startRecurringWorker(ctx context.Context) {
	// Run once on startup after a short delay
	time.Sleep(10 * time.Second)
	processRecurringSchedules()

	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	log.Println("Recurring schedule worker started")

	for {
		select {
		case <-ctx.Done():
			log.Println("Recurring schedule worker stopped")
			return
		case <-ticker.C:
			processRecurringSchedules()
		}
	}
}

func processRecurringSchedules() {
	schedules, err := db.GetActiveRecurringSchedules()
	if err != nil {
		log.Printf("Recurring: error fetching schedules: %v", err)
		return
	}

	if len(schedules) == 0 {
		return
	}

	now := time.Now().UTC()
	tomorrow := now.AddDate(0, 0, 1)
	tomorrow = time.Date(tomorrow.Year(), tomorrow.Month(), tomorrow.Day(), 0, 0, 0, 0, time.UTC)
	horizon := now.AddDate(0, 3, 0) // 3 months ahead

	created := 0
	for _, schedule := range schedules {
		// Get trainer's working hours and days off
		workingHours, err := db.GetWorkingHoursByTrainerID(schedule.TrainerID)
		if err != nil {
			log.Printf("Recurring: error getting working hours for schedule %s: %v", schedule.ID[:8], err)
			continue
		}

		// Find services for FK
		services, err := db.GetSessionTypesByTrainerID(schedule.TrainerID)
		if err != nil || len(services) == 0 {
			log.Printf("Recurring: no services for schedule %s", schedule.ID[:8])
			continue
		}
		sessionTypeID := services[0].ID
		serviceName := services[0].Name
		for _, s := range services {
			if s.DurationMinutes == schedule.DurationMinutes {
				sessionTypeID = s.ID
				serviceName = s.Name
				break
			}
		}

		// Parse schedule time
		timeParts := api.ParseTime(schedule.Time)

		// Collect bookings created for this schedule
		var batchBookings []*models.Booking

		// Iterate from tomorrow to horizon
		for d := tomorrow; d.Before(horizon); d = d.AddDate(0, 0, 1) {
			// Check if this is the right day of week
			if int(d.Weekday()) != schedule.DayOfWeek {
				continue
			}

			// Check if booking already exists for this schedule+date
			exists, err := db.BookingExistsForRecurring(schedule.ID, d)
			if err != nil {
				log.Printf("Recurring: error checking existing booking: %v", err)
				continue
			}
			if exists {
				continue
			}

			// Check if this date is a day off
			isDayOff, _ := db.IsDayOff(schedule.TrainerID, d)
			if isDayOff {
				continue
			}

			// Check working hours for this day
			var hasWorkingHours bool
			for _, wh := range workingHours {
				if wh.DayOfWeek == int(d.Weekday()) {
					hasWorkingHours = true
					break
				}
			}
			if !hasWorkingHours {
				continue
			}

			startsAt := time.Date(d.Year(), d.Month(), d.Day(), timeParts[0], timeParts[1], 0, 0, time.UTC)
			endsAt := startsAt.Add(time.Duration(schedule.DurationMinutes) * time.Minute)

			// Check for conflicting bookings
			hasConflict, _ := db.HasConflictingBooking(schedule.TrainerID, startsAt, endsAt, "")
			if hasConflict {
				continue
			}

			// Create booking
			booking, err := db.CreateRecurringBooking(schedule.TrainerID, schedule.ClientID, sessionTypeID,
				startsAt, endsAt, schedule.ClientName, schedule.DurationMinutes, schedule.ID)
			if err != nil {
				log.Printf("Recurring: error creating booking: %v", err)
				continue
			}

			created++
			batchBookings = append(batchBookings, booking)
		}

		// Send one batch notification per schedule
		if len(batchBookings) > 0 && api.NotifyRecurringBatchFunc != nil {
			if err := api.NotifyRecurringBatchFunc(schedule.TrainerID, schedule.ClientName, serviceName, batchBookings); err != nil {
				log.Printf("Recurring: error sending batch notification: %v", err)
			}
		}
	}

	if created > 0 {
		log.Printf("Recurring: created %d booking(s) from %d active schedule(s)", created, len(schedules))
	}
}

func seedLegacyData(cfg *config.Config) error {
	existing, err := db.GetTrainerByTelegramID(cfg.TrainerTelegramID)
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

	log.Println("Seeding initial trainer from env vars...")

	trainer, err := db.CreateTrainer(
		cfg.TrainerTelegramID,
		cfg.TelegramBotToken,
		bot.Username,
		cfg.TrainerName,
		"Europe/Moscow",
		24,
	)
	if err != nil {
		return err
	}
	log.Printf("Created trainer: %s (@%s)", trainer.Name, trainer.BotUsername)

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
		db.CreateSessionType(trainer.ID, st.typeCode, st.name, st.duration, st.price, "RUB")
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
		db.UpsertWorkingHours(trainer.ID, wh.day, wh.start, wh.end)
	}

	log.Println("Legacy seed complete!")
	return nil
}
