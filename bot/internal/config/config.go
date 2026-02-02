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
	APIPort           string
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
		APIPort:           os.Getenv("API_PORT"),
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

	if cfg.APIPort == "" {
		cfg.APIPort = "8080"
	}

	if cfg.TrainerName == "" {
		cfg.TrainerName = "Trainer"
	}

	return cfg
}
