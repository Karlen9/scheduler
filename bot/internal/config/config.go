package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	TelegramBotToken  string
	WebAppURL         string
	DatabasePath      string
	Port              string
	PublicBaseURL     string
	WebhookSecret     string
	TrainerTelegramID int64
	TrainerName       string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	trainerID, _ := strconv.ParseInt(os.Getenv("TRAINER_TELEGRAM_ID"), 10, 64)

	cfg := &Config{
		TelegramBotToken:  os.Getenv("TELEGRAM_BOT_TOKEN"),
		WebAppURL:         os.Getenv("WEB_APP_URL"),
		DatabasePath:      os.Getenv("DATABASE_PATH"),
		Port:              os.Getenv("PORT"),
		PublicBaseURL:     os.Getenv("PUBLIC_BASE_URL"),
		WebhookSecret:     os.Getenv("WEBHOOK_SECRET"),
		TrainerTelegramID: trainerID,
		TrainerName:       os.Getenv("TRAINER_NAME"),
	}

	if cfg.TelegramBotToken == "" {
		log.Fatal("TELEGRAM_BOT_TOKEN environment variable is required")
	}

	if cfg.WebAppURL == "" {
		cfg.WebAppURL = "https://your-mini-app-url.com"
	}

	if cfg.DatabasePath == "" {
		cfg.DatabasePath = "./data/scheduler.db"
	}

	if cfg.Port == "" {
		cfg.Port = os.Getenv("API_PORT")
	}

	if cfg.Port == "" {
		cfg.Port = "8080"
	}

	if cfg.TrainerName == "" {
		cfg.TrainerName = "Trainer"
	}

	if cfg.PublicBaseURL == "" {
		log.Fatal("PUBLIC_BASE_URL environment variable is required")
	}

	if cfg.WebhookSecret == "" {
		log.Fatal("WEBHOOK_SECRET environment variable is required")
	}

	return cfg
}
