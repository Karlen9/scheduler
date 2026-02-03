package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/config"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
	"scheduler-bot/internal/telegram"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	if err := db.Init(cfg.DatabasePath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Seed initial data if trainer doesn't exist
	if err := seedData(cfg); err != nil {
		log.Fatalf("Failed to seed data: %v", err)
	}

	// Create Telegram bot
	bot, err := telegram.NewBot(cfg.TelegramBotToken)
	if err != nil {
		log.Fatalf("Failed to create bot: %v", err)
	}
	log.Printf("Authorized on account %s", bot.Username)

	// Create handler
	handler := telegram.NewHandler(bot, cfg.WebAppURL)

	// Set up notification callback for API
	api.NotifyBookingFunc = func(booking *models.Booking) error {
		return handler.NotifyTrainerNewBooking(booking)
	}

	publicBaseURL := strings.TrimRight(cfg.PublicBaseURL, "/")
	webhookURL := publicBaseURL + "/tg/webhook/" + cfg.WebhookSecret
	if err := bot.SetWebhook(webhookURL, cfg.WebhookSecret); err != nil {
		log.Printf("Failed to set webhook: %v", err)
	} else {
		log.Printf("Webhook set to %s", webhookURL)
	}

	mux := http.NewServeMux()
	mux.Handle("/tg/webhook/"+cfg.WebhookSecret, webhookHandler(handler, cfg.WebhookSecret))
	mux.Handle("/", api.NewRouter(cfg.TelegramBotToken))

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

func webhookHandler(handler *telegram.Handler, webhookSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		secretHeader := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
		if secretHeader == "" || secretHeader != webhookSecret {
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
		go func(u telegram.Update) {
			handler.HandleUpdate(u)
		}(update)
	}
}

func seedData(cfg *config.Config) error {
	// Check if trainer already exists
	trainer, err := db.GetFirstTrainer()
	if err != nil {
		return err
	}

	if trainer != nil {
		log.Printf("Trainer already exists: %s (ID: %s)", trainer.Name, trainer.ID)
		return nil
	}

	// Create trainer
	log.Println("Seeding initial data...")

	if cfg.TrainerTelegramID == 0 {
		log.Println("Warning: TRAINER_TELEGRAM_ID not set, using placeholder")
		cfg.TrainerTelegramID = 1
	}

	trainer, err = db.CreateTrainer(
		cfg.TrainerTelegramID,
		cfg.TelegramBotToken,
		cfg.TrainerName,
		"Europe/Moscow",
		24,
	)
	if err != nil {
		return err
	}
	log.Printf("Created trainer: %s (ID: %s)", trainer.Name, trainer.ID)

	// Create session types
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
		_, err := db.CreateSessionType(trainer.ID, st.typeCode, st.name, st.duration, st.price, "RUB")
		if err != nil {
			return err
		}
		log.Printf("Created session type: %s (%s)", st.name, st.typeCode)
	}

	// Create working hours (Monday-Friday 9:00-18:00, Saturday 10:00-15:00)
	workingHours := []struct {
		day   int
		start string
		end   string
	}{
		{1, "09:00", "18:00"}, // Monday
		{2, "09:00", "18:00"}, // Tuesday
		{3, "09:00", "18:00"}, // Wednesday
		{4, "09:00", "18:00"}, // Thursday
		{5, "09:00", "18:00"}, // Friday
		{6, "10:00", "15:00"}, // Saturday
	}

	for _, wh := range workingHours {
		if err := db.UpsertWorkingHours(trainer.ID, wh.day, wh.start, wh.end); err != nil {
			return err
		}
	}
	log.Println("Created working hours")

	log.Println("Seed data complete!")
	return nil
}
