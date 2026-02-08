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

	return nil
}

func (m *BotManager) GetHandler(webhookSecret string) *telegram.Handler {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.handlers[webhookSecret]
}

var botManager *BotManager

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	if err := db.Init(cfg.DatabasePath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

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
		handler := botManager.GetHandler(trainer.WebhookSecret)
		if handler == nil {
			log.Printf("No handler found for trainer %s", trainer.Name)
			return nil
		}
		return handler.NotifyTrainerNewBooking(booking)
	}

	// Set up HTTP server
	mux := http.NewServeMux()

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
		masterWebhookURL := strings.TrimRight(cfg.PublicBaseURL, "/") + "/master/" + masterWebhookSecret + "/webhook"
		if err := masterBot.SetWebhook(masterWebhookURL, masterWebhookSecret); err != nil {
			log.Printf("Failed to set master bot webhook: %v", err)
		} else {
			log.Printf("Master bot webhook set")
		}

		// Master bot webhook handler
		mux.HandleFunc("/master/", func(w http.ResponseWriter, r *http.Request) {
			parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
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
		})
	}

	// Trainer bot webhooks - routes by secret
	mux.HandleFunc("/tg/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) < 3 || parts[2] != "webhook" {
			http.NotFound(w, r)
			return
		}
		secret := parts[1]

		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		secretHeader := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
		if secretHeader == "" || secretHeader != secret {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		handler := botManager.GetHandler(secret)
		if handler == nil {
			http.Error(w, "bot not found", http.StatusNotFound)
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
		go handler.HandleUpdate(update)
	})

	// API routes
	mux.Handle("/", api.NewRouter())

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

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
