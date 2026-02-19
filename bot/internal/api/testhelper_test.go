package api_test

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"sort"
	"strings"
	"testing"
	"time"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/crypto"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

var (
	router         http.Handler
	testSpecialist *models.Specialist
)

func TestMain(m *testing.M) {
	// Passthrough mode — no encryption
	if err := crypto.Init(""); err != nil {
		fmt.Fprintf(os.Stderr, "crypto.Init: %v\n", err)
		os.Exit(1)
	}

	// Load locale files
	if err := myI18n.Init(); err != nil {
		fmt.Fprintf(os.Stderr, "i18n.Init: %v\n", err)
		os.Exit(1)
	}

	// In-memory SQLite with shared cache
	if err := db.Init("file::memory:?cache=shared"); err != nil {
		fmt.Fprintf(os.Stderr, "db.Init: %v\n", err)
		os.Exit(1)
	}

	// Create a test specialist
	var err error
	testSpecialist, err = db.CreateSpecialist(111111, "test-bot-token", "testbot", "Test Specialist", "UTC", 24)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db.CreateSpecialist: %v\n", err)
		os.Exit(1)
	}

	// Set all notification callbacks to no-ops
	api.NotifyBookingFunc = func(booking *models.Booking) error { return nil }
	api.NotifyStatusChangeFunc = func(booking *models.Booking, newStatus string) error { return nil }
	api.UpdateSpecialistMessageFunc = func(booking *models.Booking) error { return nil }
	api.NotifyClientBookingResponseFunc = func(booking *models.Booking, accepted bool) error { return nil }
	api.UpdateClientMessageFunc = func(booking *models.Booking) error { return nil }
	api.NotifyCancellationFunc = func(booking *models.Booking, cancelledBy string) error { return nil }
	api.NotifySpecialistBookingFunc = func(booking *models.Booking) error { return nil }
	api.NotifyRecurringScheduleFunc = func(schedule *models.RecurringSchedule, previewCount int) error { return nil }
	api.NotifyMoveRequestFunc = func(newBooking, oldBooking *models.Booking, requestedBy string) error { return nil }

	// Create the router
	router = api.NewRouter()

	os.Exit(m.Run())
}

// buildInitData generates a valid Telegram-signed initData string for testing.
func buildInitData(userID int64, firstName string, botToken string) string {
	user := fmt.Sprintf(`{"id":%d,"first_name":"%s","last_name":"","username":"test_%d"}`, userID, firstName, userID)
	authDate := fmt.Sprintf("%d", time.Now().Unix())

	// Build data check string (sorted keys)
	parts := []string{
		"auth_date=" + authDate,
		"user=" + user,
	}
	sort.Strings(parts)
	dataCheckString := strings.Join(parts, "\n")

	// Calculate HMAC using Telegram's algorithm
	secretKey := hmac.New(sha256.New, []byte("WebAppData"))
	secretKey.Write([]byte(botToken))
	secret := secretKey.Sum(nil)

	h := hmac.New(sha256.New, secret)
	h.Write([]byte(dataCheckString))
	hash := hex.EncodeToString(h.Sum(nil))

	// Build query string
	v := url.Values{}
	v.Set("user", user)
	v.Set("auth_date", authDate)
	v.Set("hash", hash)
	return v.Encode()
}

func doRequest(t *testing.T, method, path string, body *string, telegramUserID int64) *httptest.ResponseRecorder {
	t.Helper()

	var reqBody *strings.Reader
	if body != nil {
		reqBody = strings.NewReader(*body)
	} else {
		reqBody = strings.NewReader("")
	}

	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)

	// Generate valid Telegram initData (signed HMAC)
	initData := buildInitData(telegramUserID, "Test User", testSpecialist.BotToken)
	req.Header.Set("X-Telegram-Init-Data", initData)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// doAdminRequest sends a request as the specialist (admin).
func doAdminRequest(t *testing.T, method, path string, body *string) *httptest.ResponseRecorder {
	t.Helper()
	return doRequest(t, method, path, body, testSpecialist.TelegramUserID)
}

// doClientRequest sends a request as a regular client with the given Telegram user ID.
func doClientRequest(t *testing.T, method, path string, body *string, clientTelegramID int64) *httptest.ResponseRecorder {
	t.Helper()
	return doRequest(t, method, path, body, clientTelegramID)
}

// jsonBody marshals v to a JSON string and returns a pointer to it.
func jsonBody(v interface{}) *string {
	data, err := json.Marshal(v)
	if err != nil {
		panic(fmt.Sprintf("jsonBody: %v", err))
	}
	s := string(data)
	return &s
}

// parseJSON decodes the response body into target and fails the test on error.
func parseJSON(t *testing.T, w *httptest.ResponseRecorder, target interface{}) {
	t.Helper()
	if err := json.NewDecoder(w.Body).Decode(target); err != nil {
		t.Fatalf("parseJSON: %v (body: %s)", err, w.Body.String())
	}
}
