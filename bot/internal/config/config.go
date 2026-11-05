package config

import (
	"log"
	"net"
	"net/url"
	"os"
	"path/filepath"
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

/***************************************************************************************************
* Splits a comma-separated list, trimming spaces and dropping empty entries.
*
* Parameters:
* - s: Raw comma-separated value.
*
* Returns:
* - The non-empty trimmed entries as []string (nil when there are none).
***************************************************************************************************/
func parseCommaList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

/***************************************************************************************************
* Reports whether publicBaseURL points at this machine only (localhost, 127.0.0.1, ::1 or a
* *.localhost name). Used to refuse LOAD_TEST_MODE on public deployments.
*
* Parameters:
* - publicBaseURL: Value of PUBLIC_BASE_URL.
*
* Returns:
* - True only for loopback hosts; false for empty, unparsable or any other host.
***************************************************************************************************/
func isLoopbackBaseURL(publicBaseURL string) bool {
	raw := strings.TrimSpace(publicBaseURL)
	if raw == "" {
		return false
	}
	if !strings.Contains(raw, "://") {
		raw = "http://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if host == "" {
		return false
	}
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

/***************************************************************************************************
* Reports whether the SQLite file would live in a container's writable layer: no Postgres URL,
* a relative database path and a containerised process.
*
* Parameters:
* - databaseURL: Value of DATABASE_URL.
* - databasePath: Effective SQLite path.
* - inContainer: Whether the process runs inside a container.
*
* Returns:
* - True when the data would be lost on container recreate.
***************************************************************************************************/
func sqlitePathIsEphemeral(databaseURL, databasePath string, inContainer bool) bool {
	return databaseURL == "" && inContainer && !filepath.IsAbs(databasePath)
}

/***************************************************************************************************
* Detects a Docker-style container via /.dockerenv.
***************************************************************************************************/
func runningInContainer() bool {
	_, err := os.Stat("/.dockerenv")
	return err == nil
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

	// CORSAllowedOrigins extends the CORS allowlist beyond WEB_APP_URL (comma-separated
	// CORS_ALLOWED_ORIGINS). Wildcards are rejected downstream.
	CORSAllowedOrigins []string

	// LoadTestMode bypasses Telegram auth for X-Test-User-ID and disables rate limits. Local only:
	// Load() refuses to start unless PUBLIC_BASE_URL is a loopback address.
	LoadTestMode bool

	/***************************************************************************************************
	* Subscription / YooKassa.
	***************************************************************************************************/
	YooKassaShopID        string
	YooKassaSecretKey     string
	TrialDays             int
	ExistingGraceDays     int
	ReferralRewardDays    int
	YooKassaVATCode       int    // vat_code for receipt items (default 1)
	YooKassaTaxSystemCode int    // tax_system_code (0 = omit)
	YooKassaReceiptEmail  string // fallback receipt email when specialist has none

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
	yooKassaVATCode := 1
	if v, err := strconv.Atoi(os.Getenv("YOOKASSA_VAT_CODE")); err == nil {
		yooKassaVATCode = v
	}
	yooKassaTaxSystemCode := 0
	if v, err := strconv.Atoi(os.Getenv("YOOKASSA_TAX_SYSTEM_CODE")); err == nil {
		yooKassaTaxSystemCode = v
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
		CORSAllowedOrigins:  parseCommaList(os.Getenv("CORS_ALLOWED_ORIGINS")),
		LoadTestMode:        os.Getenv("LOAD_TEST_MODE") == "true",

		/***************************************************************************************************
		* Subscription / YooKassa.
		***************************************************************************************************/
		YooKassaShopID:        os.Getenv("YOOKASSA_SHOP_ID"),
		YooKassaSecretKey:     os.Getenv("YOOKASSA_SECRET_KEY"),
		TrialDays:             trialDays,
		ExistingGraceDays:     existingGraceDays,
		ReferralRewardDays:    referralRewardDays,
		YooKassaVATCode:       yooKassaVATCode,
		YooKassaTaxSystemCode: yooKassaTaxSystemCode,
		YooKassaReceiptEmail:  os.Getenv("YOOKASSA_RECEIPT_EMAIL"),

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

	if cfg.LoadTestMode && !isLoopbackBaseURL(cfg.PublicBaseURL) {
		log.Fatal("LOAD_TEST_MODE=true is only allowed when PUBLIC_BASE_URL points at localhost/127.0.0.1/::1; refusing to start with auth bypass enabled on a public deployment")
	}

	if sqlitePathIsEphemeral(cfg.DatabaseURL, cfg.DatabasePath, runningInContainer()) {
		log.Printf("WARNING: SQLite database path %q is relative and the process runs in a container; the file lives in the container layer and will be LOST when the container is recreated. Set DATABASE_PATH=/data/scheduler.db and mount a volume at /data (or set DATABASE_URL).", cfg.DatabasePath)
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
