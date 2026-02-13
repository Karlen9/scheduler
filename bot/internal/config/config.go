package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

func parseAdminIDs(s string) []int64 {
	if s == "" {
		return nil
	}
	s = strings.Trim(s, "[]")
	parts := strings.Split(s, ",")
	var ids []int64
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if id, err := strconv.ParseInt(p, 10, 64); err == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

type Config struct {
	// Required
	WebAppURL          string
	DatabasePath       string
	DatabaseURL        string // postgres:// connection string; if set, uses Postgres instead of SQLite
	Port               string
	PublicBaseURL      string
	MasterBotToken     string  // Master bot for trainer onboarding
	MasterWebhookSecret string // Fixed webhook secret for master bot
	AdminIDs           []int64 // Telegram IDs with admin access

	// Encryption
	EncryptionKey string // Hex-encoded 32-byte AES key for encrypting tokens at rest

	// Optional - for initial single-bot setup (legacy)
	TelegramBotToken  string
	TrainerTelegramID int64
	TrainerName       string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	trainerID, _ := strconv.ParseInt(os.Getenv("TRAINER_TELEGRAM_ID"), 10, 64)

	cfg := &Config{
		WebAppURL:      os.Getenv("WEB_APP_URL"),
		DatabasePath:   os.Getenv("DATABASE_PATH"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		Port:           os.Getenv("PORT"),
		PublicBaseURL:  os.Getenv("PUBLIC_BASE_URL"),
		MasterBotToken:     os.Getenv("MASTER_BOT_TOKEN"),
		MasterWebhookSecret: os.Getenv("MASTER_WEBHOOK_SECRET"),
		AdminIDs:       parseAdminIDs(os.Getenv("ADMIN_IDS")),
		EncryptionKey:  os.Getenv("ENCRYPTION_KEY"),

		// Legacy single-bot setup
		TelegramBotToken:  os.Getenv("TELEGRAM_BOT_TOKEN"),
		TrainerTelegramID: trainerID,
		TrainerName:       os.Getenv("TRAINER_NAME"),
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

	if cfg.MasterBotToken == "" {
		log.Println("Warning: MASTER_BOT_TOKEN not set, trainer onboarding disabled")
	}

	if cfg.EncryptionKey == "" {
		log.Println("Warning: ENCRYPTION_KEY not set, bot tokens will be stored in plain text")
	}

	return cfg
}
