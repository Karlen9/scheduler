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
	"sync/atomic"
	"testing"
	"time"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/crypto"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Groups related module-level variables declared together for this module.
***************************************************************************************************/
var (
	/***************************************************************************************************
	* Defines the router value used by the api layer.
	*
	* Usage context:
	* - Reused by the api layer to keep shared values centralized.
	***************************************************************************************************/
	router http.Handler
	/***************************************************************************************************
	* Defines the test specialist value used by the api layer.
	*
	* Usage context:
	* - Reused by the api layer to keep shared values centralized.
	***************************************************************************************************/
	testSpecialist *models.Specialist
	testRequestSeq uint64
)

/***************************************************************************************************
* Implements the test main logic used by this module.
*
* Parameters:
* - m: M used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestMain(m *testing.M) {
	/***************************************************************************************************
	* Passthrough mode — no encryption.
	***************************************************************************************************/
	if err := crypto.Init(""); err != nil {
		fmt.Fprintf(os.Stderr, "crypto.Init: %v\n", err)
		os.Exit(1)
	}

	/***************************************************************************************************
	* Load locale files.
	***************************************************************************************************/
	if err := myI18n.Init(); err != nil {
		fmt.Fprintf(os.Stderr, "i18n.Init: %v\n", err)
		os.Exit(1)
	}

	/***************************************************************************************************
	* In-memory SQLite with shared cache.
	***************************************************************************************************/
	if err := db.Init("file::memory:?cache=shared"); err != nil {
		fmt.Fprintf(os.Stderr, "db.Init: %v\n", err)
		os.Exit(1)
	}

	/***************************************************************************************************
	* Create a test specialist.
	***************************************************************************************************/
	var err error
	testSpecialist, err = db.CreateSpecialist(111111, "test-bot-token", "testbot", "Test Specialist", "UTC", 24)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db.CreateSpecialist: %v\n", err)
		os.Exit(1)
	}

	/***************************************************************************************************
	* Grant the test specialist an active Pro subscription so gated endpoints don't return 402.
	* Tests that specifically verify the 402 gate should create a separate non-Pro specialist.
	***************************************************************************************************/
	if err := db.ActivateSubscription(testSpecialist.ID, "monthly", time.Now().Add(30*24*time.Hour), ""); err != nil {
		fmt.Fprintf(os.Stderr, "db.ActivateSubscription: %v\n", err)
		os.Exit(1)
	}
	// Reload to pick up subscription fields.
	testSpecialist, err = db.GetSpecialistByID(testSpecialist.ID)
	if err != nil || testSpecialist == nil {
		fmt.Fprintf(os.Stderr, "db.GetSpecialistByID after activate: %v\n", err)
		os.Exit(1)
	}

	/***************************************************************************************************
	* Set all notification callbacks to no-ops.
	***************************************************************************************************/
	api.NotifyBookingFunc = func(booking *models.Booking) error { return nil }
	api.NotifyStatusChangeFunc = func(booking *models.Booking, newStatus string) error { return nil }
	api.UpdateSpecialistMessageFunc = func(booking *models.Booking) error { return nil }
	api.NotifyClientBookingResponseFunc = func(booking *models.Booking, accepted bool) error { return nil }
	api.UpdateClientMessageFunc = func(booking *models.Booking) error { return nil }
	api.NotifyCancellationFunc = func(booking *models.Booking, cancelledBy string) error { return nil }
	api.NotifySpecialistBookingFunc = func(booking *models.Booking) error { return nil }
	api.NotifyRecurringScheduleFunc = func(schedule *models.RecurringSchedule, previewCount int) error { return nil }
	api.NotifyMoveRequestFunc = func(newBooking, oldBooking *models.Booking, requestedBy string) error { return nil }
	api.NotifyRescheduleRequestFunc = func(newBooking, oldBooking *models.Booking) error { return nil }
	api.NotifyRescheduleResponseFunc = func(newBooking, oldBooking *models.Booking, approved bool) error { return nil }
	api.SetTelegramProfilePhotoLookupForTest(func(string, int64) (string, error) { return "", nil })

	/***************************************************************************************************
	* Create the router.
	***************************************************************************************************/
	router = api.NewRouter()

	os.Exit(m.Run())
}

/***************************************************************************************************
* buildInitData generates a valid Telegram-signed initData string for testing.
*
* Parameters:
* - userID: Identifier used to target the current record.
* - firstName: First name used by the current operation.
* - botToken: Bot token used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func buildInitData(userID int64, firstName string, botToken string) string {
	return buildInitDataAtWithPhoto(userID, firstName, botToken, time.Now().Unix(), "")
}

/***************************************************************************************************
* Builds init data at.
*
* Parameters:
* - userID: Identifier used to target the current record.
* - firstName: First name used by the current operation.
* - botToken: Bot token used by the current operation.
* - authUnix: Auth unix used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func buildInitDataAt(userID int64, firstName string, botToken string, authUnix int64) string {
	return buildInitDataAtWithPhoto(userID, firstName, botToken, authUnix, "")
}

/***************************************************************************************************
* Builds init data at with photo.
*
* Parameters:
* - userID: Identifier used to target the current record.
* - firstName: First name used by the current operation.
* - botToken: Bot token used by the current operation.
* - authUnix: Auth unix used by the current operation.
* - photoURL: Telegram profile photo url used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func buildInitDataAtWithPhoto(userID int64, firstName string, botToken string, authUnix int64, photoURL string) string {
	user := fmt.Sprintf(`{"id":%d,"first_name":"%s","last_name":"","username":"test_%d"`, userID, firstName, userID)
	if photoURL != "" {
		user += fmt.Sprintf(`,"photo_url":"%s"`, photoURL)
	}
	user += "}"
	authDate := fmt.Sprintf("%d", authUnix)

	/***************************************************************************************************
	* Build data check string (sorted keys).
	***************************************************************************************************/
	parts := []string{
		"auth_date=" + authDate,
		"user=" + user,
	}
	sort.Strings(parts)
	dataCheckString := strings.Join(parts, "\n")

	/***************************************************************************************************
	* Calculate HMAC using Telegram's algorithm.
	***************************************************************************************************/
	secretKey := hmac.New(sha256.New, []byte("WebAppData"))
	secretKey.Write([]byte(botToken))
	secret := secretKey.Sum(nil)

	h := hmac.New(sha256.New, secret)
	h.Write([]byte(dataCheckString))
	hash := hex.EncodeToString(h.Sum(nil))

	/***************************************************************************************************
	* Build query string.
	***************************************************************************************************/
	v := url.Values{}
	v.Set("user", user)
	v.Set("auth_date", authDate)
	v.Set("hash", hash)
	return v.Encode()
}

func nextTestRemoteAddr() string {
	n := atomic.AddUint64(&testRequestSeq, 1)
	return fmt.Sprintf("[2001:db8::%x]:1234", n)
}

/***************************************************************************************************
* Implements the do request logic used by this module.
*
* Parameters:
* - method: Method used by the current operation.
* - t: T used by the current operation.
* - path: Path used by the current operation.
* - body: Body used by the current operation.
* - telegramUserID: Identifier used to target the current record.
*
* Returns:
* - The computed value for the current operation as *httptest.ResponseRecorder.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func doRequest(t *testing.T, method, path string, body *string, telegramUserID int64) *httptest.ResponseRecorder {
	t.Helper()

	var reqBody *strings.Reader
	if body != nil {
		reqBody = strings.NewReader(*body)
	} else {
		reqBody = strings.NewReader("")
	}

	req := httptest.NewRequest(method, path, reqBody)
	req.RemoteAddr = nextTestRemoteAddr()
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)

	/***************************************************************************************************
	* Generate valid Telegram initData (signed HMAC).
	***************************************************************************************************/
	initData := buildInitData(telegramUserID, "Test User", testSpecialist.BotToken)
	req.Header.Set("X-Telegram-Init-Data", initData)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

/***************************************************************************************************
* doAdminRequest sends a request as the specialist (admin).
*
* Parameters:
* - method: Method used by the current operation.
* - t: T used by the current operation.
* - path: Path used by the current operation.
* - body: Body used by the current operation.
*
* Returns:
* - The computed value for the current operation as *httptest.ResponseRecorder.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func doAdminRequest(t *testing.T, method, path string, body *string) *httptest.ResponseRecorder {
	t.Helper()
	return doRequest(t, method, path, body, testSpecialist.TelegramUserID)
}

/***************************************************************************************************
* doPreviewRequest sends a preview request as the specialist owner.
***************************************************************************************************/
func doPreviewRequest(t *testing.T, method, path string, body *string) *httptest.ResponseRecorder {
	t.Helper()
	return doRequest(t, method, path, body, testSpecialist.TelegramUserID)
}

/***************************************************************************************************
* doAdminRequestWithPhoto sends a request as the specialist with Telegram photo data.
*
* Parameters:
* - method: Method used by the current operation.
* - t: T used by the current operation.
* - path: Path used by the current operation.
* - body: Body used by the current operation.
* - photoURL: Telegram profile photo url used by the current operation.
*
* Returns:
* - The computed value for the current operation as *httptest.ResponseRecorder.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func doAdminRequestWithPhoto(t *testing.T, method, path string, body *string, photoURL string) *httptest.ResponseRecorder {
	t.Helper()

	var reqBody *strings.Reader
	if body != nil {
		reqBody = strings.NewReader(*body)
	} else {
		reqBody = strings.NewReader("")
	}

	req := httptest.NewRequest(method, path, reqBody)
	req.RemoteAddr = nextTestRemoteAddr()
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)

	initData := buildInitDataAtWithPhoto(testSpecialist.TelegramUserID, "Test User", testSpecialist.BotToken, time.Now().Unix(), photoURL)
	req.Header.Set("X-Telegram-Init-Data", initData)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

/***************************************************************************************************
* doClientRequest sends a request as a regular client with the given Telegram user ID.
*
* Parameters:
* - method: Method used by the current operation.
* - t: T used by the current operation.
* - path: Path used by the current operation.
* - body: Body used by the current operation.
* - clientTelegramID: Identifier used to target the current record.
*
* Returns:
* - The computed value for the current operation as *httptest.ResponseRecorder.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func doClientRequest(t *testing.T, method, path string, body *string, clientTelegramID int64) *httptest.ResponseRecorder {
	t.Helper()
	return doRequest(t, method, path, body, clientTelegramID)
}

func doClientRequestWithPhoto(t *testing.T, method, path string, body *string, clientTelegramID int64, photoURL string) *httptest.ResponseRecorder {
	t.Helper()

	var reqBody *strings.Reader
	if body != nil {
		reqBody = strings.NewReader(*body)
	} else {
		reqBody = strings.NewReader("")
	}

	req := httptest.NewRequest(method, path, reqBody)
	req.RemoteAddr = nextTestRemoteAddr()
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)

	initData := buildInitDataAtWithPhoto(clientTelegramID, "Test User", testSpecialist.BotToken, time.Now().Unix(), photoURL)
	req.Header.Set("X-Telegram-Init-Data", initData)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

/***************************************************************************************************
* jsonBody marshals v to a JSON string and returns a pointer to it.
*
* Parameters:
* - v: V used by the current operation.
*
* Returns:
* - The computed value for the current operation as *string.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func jsonBody(v interface{}) *string {
	data, err := json.Marshal(v)
	if err != nil {
		panic(fmt.Sprintf("jsonBody: %v", err))
	}
	s := string(data)
	return &s
}

/***************************************************************************************************
* parseJSON decodes the response body into target and fails the test on error.
*
* Parameters:
* - t: T used by the current operation.
* - w: HTTP response writer used to send the reply.
* - target: Target used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func parseJSON(t *testing.T, w *httptest.ResponseRecorder, target interface{}) {
	t.Helper()
	if err := json.NewDecoder(w.Body).Decode(target); err != nil {
		t.Fatalf("parseJSON: %v (body: %s)", err, w.Body.String())
	}
}
