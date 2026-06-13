package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

/***************************************************************************************************
* Parses admin ids.
*
* Parameters:
* - s: S used by the current operation.
*
* Returns:
* - The computed value for the current operation as []int64.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
// parseSupportGroupID accepts either the Bot API form (-1008546523939) or the raw internal
// supergroup ID (8546523939) and returns the canonical -100-prefixed form. Returns 0 for empty input.
// The convenience handles the common case where @userinfobot shows the raw ID without the prefix.
func parseSupportGroupID(raw string) int64 {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id == 0 {
		return 0
	}
	// Already a channel/supergroup chat ID — pass through.
	if id < 0 {
		return id
	}
	// Raw internal supergroup ID — prepend the -100 prefix the Bot API expects.
	// Any positive value in this env var is invalid as-is (private chats can't host forum topics),
	// so we normalize rather than refuse.
	log.Printf("SUPPORT_GROUP_ID=%d looks like a raw internal supergroup ID; normalising to -100%d", id, id)
	normalised, err := strconv.ParseInt("-100"+raw, 10, 64)
	if err != nil {
		return 0
	}
	return normalised
}

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

/***************************************************************************************************
* Defines the config type used by the configuration layer.
***************************************************************************************************/
type Config struct {
	/***************************************************************************************************
	* Required.
	***************************************************************************************************/
	WebAppURL           string
	DatabasePath        string
	DatabaseURL         string // postgres:// connection string; if set, uses Postgres instead of SQLite
	Port                string
	PublicBaseURL       string
	MasterBotToken      string  // Master bot for specialist onboarding
	MasterWebhookSecret string  // Fixed webhook secret for master bot
	AdminIDs            []int64 // Telegram IDs with admin access
	SupportGroupID      int64   // Supergroup (with forum topics enabled) where the master bot relays operator support conversations

	/***************************************************************************************************
	* Encryption.
	***************************************************************************************************/
	EncryptionKey string // Hex-encoded 32-byte AES key for encrypting tokens at rest

	/***************************************************************************************************
	* Security.
	***************************************************************************************************/
	SuperadminSecret string // Bearer token for /superadmin/* endpoints

	/***************************************************************************************************
	* Subscription / YooKassa.
	***************************************************************************************************/
	YooKassaShopID     string
	YooKassaSecretKey  string
	TrialDays          int
	ExistingGraceDays  int
	ReferralRewardDays int

	/***************************************************************************************************
	* Optional - for initial single-bot setup (legacy).
	***************************************************************************************************/
	TelegramBotToken     string
	SpecialistTelegramID int64
	SpecialistName       string
}

// SubscriptionPlan describes a purchasable plan tier.
type SubscriptionPlan struct {
	Code         string
	PriceKopecks int
	DurationDays int
}

// SubscriptionPlans returns all available subscription plans.
func SubscriptionPlans() []SubscriptionPlan {
	return []SubscriptionPlan{
		{Code: "pro_monthly", PriceKopecks: 59000, DurationDays: 30},
		{Code: "pro_quarterly", PriceKopecks: 149000, DurationDays: 90},
		{Code: "pro_annual", PriceKopecks: 499000, DurationDays: 365},
	}
}

// SubscriptionPlanByCode looks up a plan by its code. Returns false if not found.
func SubscriptionPlanByCode(code string) (SubscriptionPlan, bool) {
	for _, p := range SubscriptionPlans() {
		if p.Code == code {
			return p, true
		}
	}
	return SubscriptionPlan{}, false
}

// referralRewardDaysValue holds the parsed REFERRAL_REWARD_DAYS env var.
// It is set during Load() and exposed via ReferralRewardDays().
var referralRewardDaysValue = 30

// SetReferralRewardDays is called by Load() to wire the configured value into the
// package-level accessor.
func SetReferralRewardDays(days int) {
	if days > 0 {
		referralRewardDaysValue = days
	}
}

// ReferralRewardDays returns the number of bonus Pro days granted to the referrer when
// a referred specialist makes their first payment.
func ReferralRewardDays() int {
	return referralRewardDaysValue
}

/***************************************************************************************************
* Loads the current value.
*
* Parameters:
* - None.
*
* Returns:
* - The computed value for the current operation as *Config.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	specialistIDStr := os.Getenv("SPECIALIST_TELEGRAM_ID")
	specialistID, _ := strconv.ParseInt(specialistIDStr, 10, 64)

	specialistName := os.Getenv("SPECIALIST_NAME")

	supportGroupID := parseSupportGroupID(os.Getenv("SUPPORT_GROUP_ID"))

	trialDays := 14
	if v, err := strconv.Atoi(os.Getenv("TRIAL_DAYS")); err == nil && v > 0 {
		trialDays = v
	}
	existingGraceDays := 30
	if v, err := strconv.Atoi(os.Getenv("EXISTING_GRACE_DAYS")); err == nil && v > 0 {
		existingGraceDays = v
	}
	referralRewardDays := 30
	if v, err := strconv.Atoi(os.Getenv("REFERRAL_REWARD_DAYS")); err == nil && v > 0 {
		referralRewardDays = v
	}

	cfg := &Config{
		WebAppURL:           os.Getenv("WEB_APP_URL"),
		DatabasePath:        os.Getenv("DATABASE_PATH"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		Port:                os.Getenv("PORT"),
		PublicBaseURL:       os.Getenv("PUBLIC_BASE_URL"),
		MasterBotToken:      os.Getenv("MASTER_BOT_TOKEN"),
		MasterWebhookSecret: os.Getenv("MASTER_WEBHOOK_SECRET"),
		AdminIDs:            parseAdminIDs(os.Getenv("ADMIN_IDS")),
		SupportGroupID:      supportGroupID,
		EncryptionKey:       os.Getenv("ENCRYPTION_KEY"),
		SuperadminSecret:    os.Getenv("SUPERADMIN_SECRET"),

		/***************************************************************************************************
		* Subscription / YooKassa.
		***************************************************************************************************/
		YooKassaShopID:     os.Getenv("YOOKASSA_SHOP_ID"),
		YooKassaSecretKey:  os.Getenv("YOOKASSA_SECRET_KEY"),
		TrialDays:          trialDays,
		ExistingGraceDays:  existingGraceDays,
		ReferralRewardDays: referralRewardDays,

		/***************************************************************************************************
		* Legacy single-bot setup.
		***************************************************************************************************/
		TelegramBotToken:     os.Getenv("TELEGRAM_BOT_TOKEN"),
		SpecialistTelegramID: specialistID,
		SpecialistName:       specialistName,
	}

	if cfg.WebAppURL == "" {
		cfg.WebAppURL = "https://your-mini-app-url.com"
	}

	if cfg.DatabasePath == "" {
		cfg.DatabasePath = "./data/scheduler.db"
	}

	if cfg.Port == "" {
		cfg.Port = "8080"
	}

	if cfg.SpecialistName == "" {
		cfg.SpecialistName = "Specialist"
	}

	if cfg.PublicBaseURL == "" {
		log.Fatal("PUBLIC_BASE_URL environment variable is required")
	}

	if cfg.MasterBotToken == "" {
		log.Println("Warning: MASTER_BOT_TOKEN not set, specialist onboarding disabled")
	}

	if cfg.EncryptionKey == "" {
		log.Println("Warning: ENCRYPTION_KEY not set, bot tokens will be stored in plain text")
	}

	if cfg.SupportGroupID == 0 {
		log.Println("Warning: SUPPORT_GROUP_ID not set, operator support relay disabled")
	}

	SetReferralRewardDays(cfg.ReferralRewardDays)

	return cfg
}
