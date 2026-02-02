package main

import (
	"log"
	"net/http"

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

	// Start HTTP server in goroutine
	router := api.NewRouter(cfg.TelegramBotToken)
	go func() {
		addr := ":" + cfg.APIPort
		log.Printf("Starting HTTP server on %s", addr)
		if err := http.ListenAndServe(addr, router); err != nil {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Start bot polling (blocking)
	log.Println("Starting bot polling...")
	bot.PollUpdates(handler.HandleUpdate)
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
