package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

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
	api.NotifyCancellationFunc = func(booking *models.Booking, cancelledBy string) error { return nil }
	api.NotifySpecialistBookingFunc = func(booking *models.Booking) error { return nil }
	api.NotifyRecurringScheduleFunc = func(schedule *models.RecurringSchedule, previewCount int) error { return nil }
	api.NotifyMoveRequestFunc = func(newBooking, oldBooking *models.Booking, requestedBy string) error { return nil }

	// Create the router
	router = api.NewRouter()

	os.Exit(m.Run())
}

// doRequest sends an HTTP request through the test router with dev auth headers.
// If body is non-nil its value is sent as the request body.
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
	req.Header.Set("X-Dev-User-ID", fmt.Sprintf("%d", telegramUserID))

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
