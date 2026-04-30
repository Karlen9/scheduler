package api_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/db"
)

/***************************************************************************************************
* Task 2: Health + Specialist tests.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestHealthEndpoint(t *testing.T) {
	w := doRequest(t, http.MethodGet, "/health", nil, 111111)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if body := w.Body.String(); body != "OK" {
		t.Fatalf("expected body 'OK', got %q", body)
	}
}

/***************************************************************************************************
* Implements the test get specialist logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestGetSpecialist(t *testing.T) {
	w := doAdminRequest(t, http.MethodGet, "/api/specialist", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(t, w, &result)

	if name, _ := result["name"].(string); name != "Test Specialist" {
		t.Fatalf("expected name 'Test Specialist', got %q", name)
	}
	if isOwner, _ := result["isOwner"].(bool); !isOwner {
		t.Fatal("expected isOwner=true for specialist")
	}
}

/***************************************************************************************************
* Implements the test get specialist as client logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestGetSpecialistAsClient(t *testing.T) {
	w := doClientRequest(t, http.MethodGet, "/api/specialist", nil, 999999)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(t, w, &result)

	if isOwner, _ := result["isOwner"].(bool); isOwner {
		t.Fatal("expected isOwner=false for regular client")
	}
}

func TestPreviewGetSpecialist(t *testing.T) {
	w := doPreviewRequest(t, http.MethodGet, "/api/preview/specialist", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(t, w, &result)

	if isOwner, _ := result["isOwner"].(bool); isOwner {
		t.Fatal("expected isOwner=false for preview specialist response")
	}
}

func TestPreviewAuthRejectsNonOwner(t *testing.T) {
	w := doClientRequest(t, http.MethodGet, "/api/preview/specialist", nil, 999999)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPreviewAuthRejectsInvalidInitData(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/preview/specialist", nil)
	req.RemoteAddr = nextTestRemoteAddr()
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)
	req.Header.Set("X-Telegram-Init-Data", "hash=bad")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPreviewDoesNotCreateClientRow(t *testing.T) {
	specialist, err := db.CreateSpecialist(777001, "preview-bot-token", "previewbot", "Preview Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("db.CreateSpecialist: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/preview/profile", nil)
	req.RemoteAddr = nextTestRemoteAddr()
	req.Header.Set("X-Specialist-ID", specialist.ID)
	req.Header.Set("X-Telegram-Init-Data", buildInitData(specialist.TelegramUserID, "Preview Owner", specialist.BotToken))

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	client, err := db.GetClientByTelegramID(specialist.TelegramUserID, specialist.ID)
	if err != nil {
		t.Fatalf("db.GetClientByTelegramID: %v", err)
	}
	if client != nil {
		t.Fatal("expected preview auth not to create a client row")
	}
}

func TestPreviewReturnsEmptyReadOnlyPayloads(t *testing.T) {
	w := doPreviewRequest(t, http.MethodGet, "/api/preview/bookings?page=1&limit=20", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var bookingsResp map[string]interface{}
	parseJSON(t, w, &bookingsResp)
	if total, _ := bookingsResp["total"].(float64); total != 0 {
		t.Fatalf("expected preview bookings total=0, got %v", bookingsResp["total"])
	}

	w = doPreviewRequest(t, http.MethodGet, "/api/preview/profile", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var profileResp map[string]interface{}
	parseJSON(t, w, &profileResp)
	if id, _ := profileResp["id"].(string); id != "preview" {
		t.Fatalf("expected preview profile id, got %q", id)
	}

	w = doPreviewRequest(t, http.MethodGet, "/api/preview/recurring", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if body := strings.TrimSpace(w.Body.String()); body != "[]" {
		t.Fatalf("expected empty recurring response, got %s", body)
	}
}

/***************************************************************************************************
* nextWeekday returns the next date (from tomorrow) that falls on the given weekday
* (time.Monday=1, etc.).
*
* Parameters:
* - wd: Wd used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func nextWeekday(wd time.Weekday) string {
	d := time.Now().AddDate(0, 0, 1)
	for d.Weekday() != wd {
		d = d.AddDate(0, 0, 1)
	}
	return d.Format("2006-01-02")
}

func formatTestClock(minutes int) string {
	if minutes >= 24*60 {
		return "24:00"
	}
	return fmt.Sprintf("%02d:%02d", minutes/60, minutes%60)
}

func withSpecialistTimezone(t *testing.T, timezone string) *time.Location {
	t.Helper()

	location, err := time.LoadLocation(timezone)
	if err != nil {
		t.Fatalf("time.LoadLocation(%q): %v", timezone, err)
	}

	specialist, err := db.GetSpecialistByID(testSpecialist.ID)
	if err != nil {
		t.Fatalf("db.GetSpecialistByID: %v", err)
	}
	if specialist == nil {
		t.Fatal("test specialist not found")
	}

	if _, err := db.UpdateSpecialist(specialist.ID, specialist.Name, timezone, specialist.CancelCutoffHrs); err != nil {
		t.Fatalf("db.UpdateSpecialist timezone: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.UpdateSpecialist(specialist.ID, specialist.Name, specialist.Timezone, specialist.CancelCutoffHrs)
	})

	return location
}

/***************************************************************************************************
* setupWorkingHoursAndService sets working hours for days 1-5 and creates a session type so that
* booking creation can succeed.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func setupWorkingHoursAndService(t *testing.T) {
	t.Helper()

	/***************************************************************************************************
	* Set working hours (Mon-Fri, 09:00-18:00).
	***************************************************************************************************/
	body := jsonBody(map[string]interface{}{
		"hours": []map[string]interface{}{
			{"dayOfWeek": 1, "startTime": "09:00", "endTime": "18:00"},
			{"dayOfWeek": 2, "startTime": "09:00", "endTime": "18:00"},
			{"dayOfWeek": 3, "startTime": "09:00", "endTime": "18:00"},
			{"dayOfWeek": 4, "startTime": "09:00", "endTime": "18:00"},
			{"dayOfWeek": 5, "startTime": "09:00", "endTime": "18:00"},
		},
	})
	w := doAdminRequest(t, http.MethodPut, "/api/admin/working-hours", body)
	if w.Code != http.StatusOK {
		t.Fatalf("failed to set working hours: %d %s", w.Code, w.Body.String())
	}

	/***************************************************************************************************
	* Create a session type (needed for booking creation).
	***************************************************************************************************/
	serviceBody := jsonBody(map[string]interface{}{
		"type":            "common",
		"name":            "Personal Training",
		"durationMinutes": 60,
		"price":           1000,
	})
	w = doAdminRequest(t, http.MethodPost, "/api/admin/services", serviceBody)
	if w.Code != http.StatusCreated {
		t.Fatalf("failed to create session type: %d %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* Implements the test create and get booking logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestCreateAndGetBooking(t *testing.T) {
	/***************************************************************************************************
	* Setup working hours and session type.
	***************************************************************************************************/
	setupWorkingHoursAndService(t)

	/***************************************************************************************************
	* Create a booking as client 222222 on next Monday.
	***************************************************************************************************/
	body := jsonBody(map[string]interface{}{
		"date":     nextWeekday(time.Monday),
		"time":     "10:00",
		"duration": 60,
		"name":     "Test Client",
	})
	w := doClientRequest(t, http.MethodPost, "/api/bookings", body, 222222)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var booking map[string]interface{}
	parseJSON(t, w, &booking)

	if status, _ := booking["status"].(string); status != "pending" {
		t.Fatalf("expected status 'pending', got %q", status)
	}
	if clientName, _ := booking["clientName"].(string); clientName != "Test Client" {
		t.Fatalf("expected clientName 'Test Client', got %q", clientName)
	}

	bookingID, _ := booking["id"].(string)
	if bookingID == "" {
		t.Fatal("expected booking to have an id")
	}

	/***************************************************************************************************
	* GET /api/bookings as same client -> find the booking.
	***************************************************************************************************/
	w = doClientRequest(t, http.MethodGet, "/api/bookings", nil, 222222)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var payload struct {
		Bookings []map[string]interface{} `json:"bookings"`
	}
	parseJSON(t, w, &payload)

	found := false
	for _, b := range payload.Bookings {
		if b["id"] == bookingID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("booking %s not found in client's booking list", bookingID)
	}
}

func TestAdminAssignClientBatch(t *testing.T) {
	serviceBody := jsonBody(map[string]interface{}{
		"type":            "batch",
		"name":            "10 занятий",
		"durationMinutes": 60,
		"price":           10000,
		"sessionsCount":   10,
	})
	w := doAdminRequest(t, http.MethodPost, "/api/admin/services", serviceBody)
	if w.Code != http.StatusCreated {
		t.Fatalf("failed to create batch service: %d %s", w.Code, w.Body.String())
	}
	var service map[string]interface{}
	parseJSON(t, w, &service)
	serviceID, _ := service["id"].(string)
	if serviceID == "" {
		t.Fatal("expected service id")
	}

	clientBody := jsonBody(map[string]interface{}{"name": "Batch Client"})
	w = doAdminRequest(t, http.MethodPost, "/api/admin/clients", clientBody)
	if w.Code != http.StatusCreated {
		t.Fatalf("failed to create client: %d %s", w.Code, w.Body.String())
	}
	var client map[string]interface{}
	parseJSON(t, w, &client)
	clientID, _ := client["id"].(string)
	if clientID == "" {
		t.Fatal("expected client id")
	}

	assignBody := jsonBody(map[string]interface{}{"service_id": serviceID})
	w = doAdminRequest(t, http.MethodPost, "/api/admin/clients/"+clientID+"/batches", assignBody)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 assigning batch, got %d: %s", w.Code, w.Body.String())
	}
	var batch map[string]interface{}
	parseJSON(t, w, &batch)
	if remaining, _ := batch["remainingSessions"].(float64); remaining != 10 {
		t.Fatalf("expected 10 remaining sessions, got %v", batch["remainingSessions"])
	}
}

func TestCreateBatchBookingRequiresActiveBatch(t *testing.T) {
	setupWorkingHoursAndService(t)

	serviceBody := jsonBody(map[string]interface{}{
		"type":            "batch",
		"name":            "Batch Guard",
		"durationMinutes": 60,
		"price":           10000,
		"sessionsCount":   10,
	})
	w := doAdminRequest(t, http.MethodPost, "/api/admin/services", serviceBody)
	if w.Code != http.StatusCreated {
		t.Fatalf("failed to create batch service: %d %s", w.Code, w.Body.String())
	}
	var service map[string]interface{}
	parseJSON(t, w, &service)
	serviceID, _ := service["id"].(string)

	body := jsonBody(map[string]interface{}{
		"date":          nextWeekday(time.Friday),
		"time":          "16:00",
		"duration":      60,
		"name":          "No Batch Client",
		"sessionTypeId": serviceID,
	})
	w = doClientRequest(t, http.MethodPost, "/api/bookings", body, 777777)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(strings.ToLower(w.Body.String()), "абонемент") {
		t.Fatalf("expected clear batch error, got %q", w.Body.String())
	}
}

/***************************************************************************************************
* Implements the test cancel booking logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestCancelBooking(t *testing.T) {
	/***************************************************************************************************
	* Create a booking as client 333333 on next Tuesday.
	***************************************************************************************************/
	body := jsonBody(map[string]interface{}{
		"date":     nextWeekday(time.Tuesday),
		"time":     "11:00",
		"duration": 60,
		"name":     "Cancel Client",
	})
	w := doClientRequest(t, http.MethodPost, "/api/bookings", body, 333333)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var booking map[string]interface{}
	parseJSON(t, w, &booking)
	bookingID, _ := booking["id"].(string)

	/***************************************************************************************************
	* Cancel the booking.
	***************************************************************************************************/
	cancelBody := jsonBody(map[string]interface{}{
		"reason": "test cancel",
	})
	w = doClientRequest(t, http.MethodDelete, "/api/bookings/"+bookingID, cancelBody, 333333)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var cancelled map[string]interface{}
	parseJSON(t, w, &cancelled)

	if status, _ := cancelled["status"].(string); status != "cancelled" {
		t.Fatalf("expected status 'cancelled', got %q", status)
	}
}

/***************************************************************************************************
* Implements the test admin get bookings logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestAdminGetBookings(t *testing.T) {
	w := doAdminRequest(t, http.MethodGet, "/api/admin/bookings", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var payload struct {
		Bookings []map[string]interface{} `json:"bookings"`
	}
	parseJSON(t, w, &payload)

	if len(payload.Bookings) == 0 {
		t.Fatal("expected at least one booking from previous tests")
	}
}

/***************************************************************************************************
* Task 4: Admin auth + client profile tests.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestAdminUnauthorized(t *testing.T) {
	/***************************************************************************************************
	* Regular client (888888) should get 403 on admin endpoint.
	***************************************************************************************************/
	w := doClientRequest(t, http.MethodGet, "/api/admin/profile", nil, 888888)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* Implements the test get client profile logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestGetClientProfile(t *testing.T) {
	/***************************************************************************************************
	* GET /api/profile as client 444444 -> should create via DevAuthMiddleware with name "Dev User".
	***************************************************************************************************/
	w := doClientRequest(t, http.MethodGet, "/api/profile", nil, 444444)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var profile map[string]interface{}
	parseJSON(t, w, &profile)

	if name, _ := profile["name"].(string); name != "Test User" {
		t.Fatalf("expected name 'Test User', got %q", name)
	}
}

/***************************************************************************************************
* Implements the test update client profile logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestUpdateClientProfile(t *testing.T) {
	/***************************************************************************************************
	* Step 1: GET /api/profile to create client 555555.
	***************************************************************************************************/
	w := doClientRequest(t, http.MethodGet, "/api/profile", nil, 555555)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	/***************************************************************************************************
	* Step 2: PUT /api/profile with updated fields.
	***************************************************************************************************/
	body := jsonBody(map[string]interface{}{
		"name":              "Updated Name",
		"phone":             "+1234567890",
		"preferredDuration": 90,
	})
	w = doClientRequest(t, http.MethodPut, "/api/profile", body, 555555)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	/***************************************************************************************************
	* Step 3: GET /api/profile -> verify updates.
	***************************************************************************************************/
	w = doClientRequest(t, http.MethodGet, "/api/profile", nil, 555555)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var profile map[string]interface{}
	parseJSON(t, w, &profile)

	if name, _ := profile["name"].(string); name != "Updated Name" {
		t.Fatalf("expected name 'Updated Name', got %q", name)
	}
	if phone, _ := profile["phone"].(string); phone != "+1234567890" {
		t.Fatalf("expected phone '+1234567890', got %q", phone)
	}
	if dur, _ := profile["preferredDuration"].(float64); dur != 90 {
		t.Fatalf("expected preferredDuration 90, got %v", dur)
	}
}

func TestUpdateClientProfileRestoresTelegramPhotoWhenClearingPhoto(t *testing.T) {
	clientTelegramID := int64(555556)
	w := doClientRequest(t, http.MethodGet, "/api/profile", nil, clientTelegramID)
	if w.Code != http.StatusOK {
		t.Fatalf("expected initial profile 200, got %d: %s", w.Code, w.Body.String())
	}

	client, err := db.GetClientByTelegramID(clientTelegramID, testSpecialist.ID)
	if err != nil || client == nil {
		t.Fatalf("expected client to exist, err=%v", err)
	}
	if err := db.UpdateClientPhoto(client.ID, "custom_file_id"); err != nil {
		t.Fatalf("failed to set custom client photo: %v", err)
	}

	telegramPhotoURL := "https://t.me/i/userpic/320/client.jpg"
	body := jsonBody(map[string]interface{}{
		"photoUrl": "",
	})

	w = doClientRequestWithPhoto(t, http.MethodPut, "/api/profile", body, clientTelegramID, telegramPhotoURL)
	if w.Code != http.StatusOK {
		t.Fatalf("expected clear photo update 200, got %d: %s", w.Code, w.Body.String())
	}

	var profile map[string]interface{}
	parseJSON(t, w, &profile)

	if photoURL, _ := profile["photoUrl"].(string); photoURL != telegramPhotoURL {
		t.Fatalf("expected telegram photo url %q, got %q", telegramPhotoURL, photoURL)
	}
}

func TestUpdateClientProfileRestoresBotAPITelegramPhotoWhenInitDataHasNoPhoto(t *testing.T) {
	clientTelegramID := int64(555557)
	restore := api.SetTelegramProfilePhotoLookupForTest(func(botToken string, userID int64) (string, error) {
		if botToken != testSpecialist.BotToken {
			t.Fatalf("expected bot token %q, got %q", testSpecialist.BotToken, botToken)
		}
		if userID != clientTelegramID {
			t.Fatalf("expected user ID %d, got %d", clientTelegramID, userID)
		}
		return "telegram_file_id", nil
	})
	defer restore()

	w := doClientRequest(t, http.MethodGet, "/api/profile", nil, clientTelegramID)
	if w.Code != http.StatusOK {
		t.Fatalf("expected initial profile 200, got %d: %s", w.Code, w.Body.String())
	}

	client, err := db.GetClientByTelegramID(clientTelegramID, testSpecialist.ID)
	if err != nil || client == nil {
		t.Fatalf("expected client to exist, err=%v", err)
	}
	if err := db.UpdateClientPhoto(client.ID, "custom_file_id"); err != nil {
		t.Fatalf("failed to set custom client photo: %v", err)
	}

	body := jsonBody(map[string]interface{}{
		"photoUrl": "",
	})
	w = doClientRequest(t, http.MethodPut, "/api/profile", body, clientTelegramID)
	if w.Code != http.StatusOK {
		t.Fatalf("expected clear photo update 200, got %d: %s", w.Code, w.Body.String())
	}

	var profile map[string]interface{}
	parseJSON(t, w, &profile)
	if photoURL, _ := profile["photoUrl"].(string); photoURL != "telegram:telegram_file_id" {
		t.Fatalf("expected telegram file photo, got %q", photoURL)
	}
}

func TestGetClientProfileRefreshesStoredTelegramPhotoURL(t *testing.T) {
	clientTelegramID := int64(555558)
	w := doClientRequest(t, http.MethodGet, "/api/profile", nil, clientTelegramID)
	if w.Code != http.StatusOK {
		t.Fatalf("expected initial profile 200, got %d: %s", w.Code, w.Body.String())
	}

	client, err := db.GetClientByTelegramID(clientTelegramID, testSpecialist.ID)
	if err != nil || client == nil {
		t.Fatalf("expected client to exist, err=%v", err)
	}
	if err := db.UpdateClientPhoto(client.ID, "https://t.me/i/userpic/320/old-client.jpg"); err != nil {
		t.Fatalf("failed to set old Telegram client photo: %v", err)
	}

	telegramPhotoURL := "https://t.me/i/userpic/320/new-client.jpg"
	w = doClientRequestWithPhoto(t, http.MethodGet, "/api/profile", nil, clientTelegramID, telegramPhotoURL)
	if w.Code != http.StatusOK {
		t.Fatalf("expected profile 200, got %d: %s", w.Code, w.Body.String())
	}

	var profile map[string]interface{}
	parseJSON(t, w, &profile)
	if photoURL, _ := profile["photoUrl"].(string); photoURL != telegramPhotoURL {
		t.Fatalf("expected refreshed Telegram photo url %q, got %q", telegramPhotoURL, photoURL)
	}
}

/***************************************************************************************************
* Implements the test update admin profile logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestUpdateAdminProfile(t *testing.T) {
	body := jsonBody(map[string]interface{}{
		"name":              "Admin Updated",
		"telegramHandle":    "@updated_admin",
		"phone":             "+79990001122",
		"specialization":    "Massage",
		"bio":               "Updated bio",
		"locationLatitude":  55.7558,
		"locationLongitude": 37.6176,
	})

	w := doAdminRequest(t, http.MethodPut, "/api/admin/profile", body)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var profile map[string]interface{}
	parseJSON(t, w, &profile)

	if name, _ := profile["name"].(string); name != "Admin Updated" {
		t.Fatalf("expected name 'Admin Updated', got %q", name)
	}
	if handle, _ := profile["telegramHandle"].(string); handle != "@updated_admin" {
		t.Fatalf("expected telegramHandle '@updated_admin', got %q", handle)
	}
	if phone, _ := profile["phone"].(string); phone != "+79990001122" {
		t.Fatalf("expected phone '+79990001122', got %q", phone)
	}
}

/***************************************************************************************************
* Implements the test clear admin profile fields logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestUpdateAdminProfileAllowsClearingFields(t *testing.T) {
	initialBody := jsonBody(map[string]interface{}{
		"telegramHandle": "@to_clear",
		"phone":          "+70000000000",
		"specialization": "Yoga",
		"bio":            "To be cleared",
	})

	w := doAdminRequest(t, http.MethodPut, "/api/admin/profile", initialBody)
	if w.Code != http.StatusOK {
		t.Fatalf("expected initial update 200, got %d: %s", w.Code, w.Body.String())
	}

	clearBody := jsonBody(map[string]interface{}{
		"telegramHandle": "",
		"phone":          "",
		"specialization": "",
		"bio":            "",
	})

	w = doAdminRequest(t, http.MethodPut, "/api/admin/profile", clearBody)
	if w.Code != http.StatusOK {
		t.Fatalf("expected clear update 200, got %d: %s", w.Code, w.Body.String())
	}

	var profile map[string]interface{}
	parseJSON(t, w, &profile)

	if handle, ok := profile["telegramHandle"]; ok && handle != "" {
		t.Fatalf("expected empty telegramHandle after clearing, got %#v", handle)
	}
	if phone, ok := profile["phone"]; ok && phone != "" {
		t.Fatalf("expected empty phone after clearing, got %#v", phone)
	}
	if specialization, ok := profile["specialization"]; ok && specialization != "" {
		t.Fatalf("expected empty specialization after clearing, got %#v", specialization)
	}
	if bio, ok := profile["bio"]; ok && bio != "" {
		t.Fatalf("expected empty bio after clearing, got %#v", bio)
	}
}

/***************************************************************************************************
* Implements the test update admin profile restores telegram photo logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestUpdateAdminProfileRestoresTelegramPhotoWhenClearingPhoto(t *testing.T) {
	if err := db.UpdateSpecialistPhoto(testSpecialist.ID, "custom_file_id"); err != nil {
		t.Fatalf("failed to set custom photo: %v", err)
	}

	telegramPhotoURL := "https://t.me/i/userpic/320/test.jpg"
	body := jsonBody(map[string]interface{}{
		"photoUrl": "",
	})

	w := doAdminRequestWithPhoto(t, http.MethodPut, "/api/admin/profile", body, telegramPhotoURL)
	if w.Code != http.StatusOK {
		t.Fatalf("expected clear photo update 200, got %d: %s", w.Code, w.Body.String())
	}

	var profile map[string]interface{}
	parseJSON(t, w, &profile)

	if photoURL, _ := profile["photoUrl"].(string); photoURL != telegramPhotoURL {
		t.Fatalf("expected telegram photo url %q, got %q", telegramPhotoURL, photoURL)
	}
}

func TestUpdateAdminProfileRestoresBotAPITelegramPhotoWhenInitDataHasNoPhoto(t *testing.T) {
	restore := api.SetTelegramProfilePhotoLookupForTest(func(botToken string, userID int64) (string, error) {
		if botToken != testSpecialist.BotToken {
			t.Fatalf("expected bot token %q, got %q", testSpecialist.BotToken, botToken)
		}
		if userID != testSpecialist.TelegramUserID {
			t.Fatalf("expected user ID %d, got %d", testSpecialist.TelegramUserID, userID)
		}
		return "admin_telegram_file_id", nil
	})
	defer restore()

	if err := db.UpdateSpecialistPhoto(testSpecialist.ID, "custom_file_id"); err != nil {
		t.Fatalf("failed to set custom photo: %v", err)
	}

	body := jsonBody(map[string]interface{}{
		"photoUrl": "",
	})
	w := doAdminRequest(t, http.MethodPut, "/api/admin/profile", body)
	if w.Code != http.StatusOK {
		t.Fatalf("expected clear photo update 200, got %d: %s", w.Code, w.Body.String())
	}

	var profile map[string]interface{}
	parseJSON(t, w, &profile)
	if photoURL, _ := profile["photoUrl"].(string); photoURL != "telegram:admin_telegram_file_id" {
		t.Fatalf("expected telegram file photo, got %q", photoURL)
	}
}

func TestGetAdminProfileConvertsStoredTelegramPhotoURLWithBotAPI(t *testing.T) {
	current, err := db.GetSpecialistByID(testSpecialist.ID)
	if err != nil || current == nil {
		t.Fatalf("expected specialist, err=%v", err)
	}
	defer db.UpdateSpecialistPhoto(testSpecialist.ID, current.PhotoURL)

	restore := api.SetTelegramProfilePhotoLookupForTest(func(botToken string, userID int64) (string, error) {
		if botToken != testSpecialist.BotToken {
			t.Fatalf("expected bot token %q, got %q", testSpecialist.BotToken, botToken)
		}
		if userID != testSpecialist.TelegramUserID {
			t.Fatalf("expected user ID %d, got %d", testSpecialist.TelegramUserID, userID)
		}
		return "refreshed_admin_file_id", nil
	})
	defer restore()

	if err := db.UpdateSpecialistPhoto(testSpecialist.ID, "https://t.me/i/userpic/320/old-admin.jpg"); err != nil {
		t.Fatalf("failed to set old Telegram photo: %v", err)
	}

	w := doAdminRequest(t, http.MethodGet, "/api/admin/profile", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected profile 200, got %d: %s", w.Code, w.Body.String())
	}

	var profile map[string]interface{}
	parseJSON(t, w, &profile)
	if photoURL, _ := profile["photoUrl"].(string); photoURL != "telegram:refreshed_admin_file_id" {
		t.Fatalf("expected refreshed Telegram file photo, got %q", photoURL)
	}
}

/***************************************************************************************************
* Implements the test update admin profile accepts long bio logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestUpdateAdminProfileAcceptsBioUpTo1000Chars(t *testing.T) {
	longBio := strings.Repeat("a", 1000)
	body := jsonBody(map[string]interface{}{
		"bio": longBio,
	})

	w := doAdminRequest(t, http.MethodPut, "/api/admin/profile", body)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var profile map[string]interface{}
	parseJSON(t, w, &profile)

	if bio, _ := profile["bio"].(string); bio != longBio {
		t.Fatalf("expected bio length %d, got %d", len(longBio), len(bio))
	}
}

/***************************************************************************************************
* Implements the test update admin profile rejects too long bio logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestUpdateAdminProfileRejectsBioOver1000Chars(t *testing.T) {
	longBio := strings.Repeat("b", 1001)
	body := jsonBody(map[string]interface{}{
		"bio": longBio,
	})

	w := doAdminRequest(t, http.MethodPut, "/api/admin/profile", body)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* Implements the test get working hours logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestGetWorkingHours(t *testing.T) {
	w := doClientRequest(t, http.MethodGet, "/api/working-hours", nil, 444444)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* Implements the test get services logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestGetServices(t *testing.T) {
	w := doClientRequest(t, http.MethodGet, "/api/services", nil, 444444)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* Security tests.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestRejectNoInitData(t *testing.T) {
	/***************************************************************************************************
	* Request without X-Telegram-Init-Data should get 401.
	***************************************************************************************************/
	req := httptest.NewRequest(http.MethodGet, "/api/specialist", nil)
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)

	/***************************************************************************************************
	* No X-Telegram-Init-Data header.
	***************************************************************************************************/
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without initData, got %d: %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* Implements the test reject invalid init data logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestRejectInvalidInitData(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/specialist", nil)
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)
	req.Header.Set("X-Telegram-Init-Data", "hash=abc123&user=%7B%7D&auth_date=123")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with invalid initData, got %d: %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* Implements the test reject expired init data logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestRejectExpiredInitData(t *testing.T) {
	initData := buildInitDataAt(777777, "Expired", testSpecialist.BotToken, time.Now().Unix()-7200)
	req := httptest.NewRequest(http.MethodGet, "/api/specialist", nil)
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)
	req.Header.Set("X-Telegram-Init-Data", initData)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with expired initData, got %d: %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* Implements the test reject future init data logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestRejectFutureInitData(t *testing.T) {
	initData := buildInitDataAt(787878, "Future", testSpecialist.BotToken, time.Now().Unix()+900)

	req := httptest.NewRequest(http.MethodGet, "/api/specialist", nil)
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)
	req.Header.Set("X-Telegram-Init-Data", initData)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with future initData, got %d: %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* Implements the test superadmin requires auth logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestSuperadminRequiresAuth(t *testing.T) {
	/***************************************************************************************************
	* Without bearer token -> 404 (no SUPERADMIN_SECRET set in test).
	***************************************************************************************************/
	req := httptest.NewRequest(http.MethodGet, "/superadmin/specialists", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound && w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 404 or 401 for superadmin without auth, got %d", w.Code)
	}
}

/***************************************************************************************************
* Implements the test metrics require internal access logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestMetricsRequireInternalAccess(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	req.RemoteAddr = "203.0.113.10:54321"

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound && w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 404 or 401 for public metrics access, got %d", w.Code)
	}
}

func TestMetricsDoNotTrustForwardedLoopbackHeaders(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	req.RemoteAddr = "203.0.113.10:54321"
	req.Header.Set("X-Forwarded-For", "127.0.0.1")
	req.Header.Set("X-Real-IP", "127.0.0.1")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound && w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 404 or 401 for spoofed forwarded-loopback metrics access, got %d", w.Code)
	}
}

func TestPhotoProxyRequiresTelegramAuth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/photo/file-123?specialist="+testSpecialist.ID, nil)
	req.RemoteAddr = nextTestRemoteAddr()

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated photo proxy request, got %d", w.Code)
	}
}

func TestAdminDeleteDayOffRejectsCrossSpecialistDelete(t *testing.T) {
	other, err := db.CreateSpecialist(222222, "cross-dayoff-token", "crossdayoffbot", "Other Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}
	dayOffDate := time.Date(2026, time.May, 20, 0, 0, 0, 0, time.UTC)
	created, err := db.CreateDayOffsBatch(other.ID, []time.Time{dayOffDate}, "")
	if err != nil {
		t.Fatalf("CreateDayOffsBatch: %v", err)
	}
	if len(created) != 1 {
		t.Fatalf("expected one created day off, got %d", len(created))
	}
	dayOff := created[0]

	w := doAdminRequest(t, http.MethodDelete, "/api/admin/days-off/"+dayOff.ID, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when deleting another specialist's day off, got %d: %s", w.Code, w.Body.String())
	}

	stillThere, err := db.GetDayOff(other.ID, dayOffDate)
	if err != nil {
		t.Fatalf("GetDayOff: %v", err)
	}
	if stillThere == nil {
		t.Fatal("expected cross-specialist delete attempt to leave day off intact")
	}
}

func TestRecurringPreviewRejectsForeignSessionType(t *testing.T) {
	other, err := db.CreateSpecialist(333333, "foreign-service-token", "foreignservicebot", "Foreign Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}
	service, err := db.CreateSessionType(other.ID, "common", "Foreign Service", 60, 1500, "RUB", "")
	if err != nil {
		t.Fatalf("CreateSessionType: %v", err)
	}

	body := jsonBody(map[string]interface{}{
		"sessionTypeId": service.ID,
		"dayTimes": map[string]string{
			"1": "10:00",
		},
		"period": "2weeks",
	})

	w := doClientRequest(t, http.MethodPost, "/api/recurring/preview", body, 4444444)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for foreign sessionTypeId in recurring preview, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAdminRecurringPreviewRejectsForeignSessionType(t *testing.T) {
	other, err := db.CreateSpecialist(444445, "foreign-admin-service-token", "foreignadminservicebot", "Foreign Admin Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}
	service, err := db.CreateSessionType(other.ID, "common", "Foreign Admin Service", 60, 1500, "RUB", "")
	if err != nil {
		t.Fatalf("CreateSessionType: %v", err)
	}

	body := jsonBody(map[string]interface{}{
		"sessionTypeId": service.ID,
		"dayTimes": map[string]string{
			"2": "11:00",
		},
		"period": "2weeks",
	})

	w := doAdminRequest(t, http.MethodPost, "/api/admin/recurring/preview", body)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for foreign sessionTypeId in admin recurring preview, got %d: %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* Implements the test reject invalid booking time logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestRejectInvalidBookingTime(t *testing.T) {
	body := jsonBody(map[string]interface{}{
		"date":     nextWeekday(time.Wednesday),
		"time":     "25:99",
		"duration": 60,
		"name":     "Bad Time",
	})

	w := doClientRequest(t, http.MethodPost, "/api/bookings", body, 989898)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid booking time, got %d: %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* Implements the test reject invalid working hours range logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestRejectInvalidWorkingHoursRange(t *testing.T) {
	body := jsonBody(map[string]interface{}{
		"hours": []map[string]interface{}{
			{"dayOfWeek": 1, "startTime": "18:00", "endTime": "09:00"},
		},
	})

	w := doAdminRequest(t, http.MethodPut, "/api/admin/working-hours", body)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid working hours range, got %d: %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* Implements the test reject overlapping working hours logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestRejectOverlappingWorkingHoursIntervals(t *testing.T) {
	initialBody := jsonBody(map[string]interface{}{
		"hours": []map[string]interface{}{
			{"dayOfWeek": 1, "startTime": "09:00", "endTime": "12:00"},
		},
	})

	w := doAdminRequest(t, http.MethodPut, "/api/admin/working-hours", initialBody)
	if w.Code != http.StatusOK {
		t.Fatalf("expected initial working hours update to succeed, got %d: %s", w.Code, w.Body.String())
	}

	overlappingBody := jsonBody(map[string]interface{}{
		"hours": []map[string]interface{}{
			{"dayOfWeek": 1, "startTime": "09:00", "endTime": "12:00"},
			{"dayOfWeek": 1, "startTime": "11:00", "endTime": "18:00"},
		},
	})

	w = doAdminRequest(t, http.MethodPut, "/api/admin/working-hours", overlappingBody)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for overlapping working hours, got %d: %s", w.Code, w.Body.String())
	}

	w = doAdminRequest(t, http.MethodGet, "/api/admin/working-hours", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 when reading working hours, got %d: %s", w.Code, w.Body.String())
	}

	var hours []map[string]interface{}
	parseJSON(t, w, &hours)
	if len(hours) != 1 {
		t.Fatalf("expected existing working hours to remain unchanged, got %d entries", len(hours))
	}
}

/***************************************************************************************************
* Implements the test set working hours for day logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestUpdateWorkingHoursAllowsMultipleIntervals(t *testing.T) {
	body := jsonBody(map[string]interface{}{
		"hours": []map[string]interface{}{
			{"dayOfWeek": 1, "startTime": "09:00", "endTime": "12:00"},
			{"dayOfWeek": 1, "startTime": "14:00", "endTime": "18:00"},
		},
	})

	w := doAdminRequest(t, http.MethodPut, "/api/admin/working-hours", body)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for multi-interval working-hours update, got %d: %s", w.Code, w.Body.String())
	}

	var hours []map[string]interface{}
	parseJSON(t, w, &hours)
	if len(hours) != 2 {
		t.Fatalf("expected 2 working-hour rows, got %d", len(hours))
	}
}

/***************************************************************************************************
* Implements the test get availability with multiple intervals logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestGetAvailabilityWithMultipleIntervalsPerDay(t *testing.T) {
	body := jsonBody(map[string]interface{}{
		"hours": []map[string]interface{}{
			{"dayOfWeek": 1, "startTime": "09:00", "endTime": "12:00"},
			{"dayOfWeek": 1, "startTime": "14:00", "endTime": "18:00"},
		},
	})

	w := doAdminRequest(t, http.MethodPut, "/api/admin/working-hours", body)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for working hours update, got %d: %s", w.Code, w.Body.String())
	}

	path := "/api/availability?date=" + nextWeekday(time.Monday) + "&duration=60"
	w = doClientRequest(t, http.MethodGet, path, nil, 555555)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for availability lookup, got %d: %s", w.Code, w.Body.String())
	}

	var slots []map[string]interface{}
	parseJSON(t, w, &slots)

	expectedTimes := []string{
		"09:00", "10:00", "11:00",
		"14:00", "15:00", "16:00", "17:00",
	}
	if len(slots) != len(expectedTimes) {
		t.Fatalf("expected %d availability slots, got %d", len(expectedTimes), len(slots))
	}

	for i, expected := range expectedTimes {
		actual, _ := slots[i]["time"].(string)
		if actual != expected {
			t.Fatalf("expected slot %d to be %q, got %q", i, expected, actual)
		}
	}
}

func TestGetAvailabilityForTodaySkipsPastSlotsInSpecialistTimezone(t *testing.T) {
	location := withSpecialistTimezone(t, "Europe/Moscow")
	now := time.Now().In(location)
	startMinutes := now.Hour()*60 + now.Minute()
	endMinutes := startMinutes + 1

	body := jsonBody(map[string]interface{}{
		"hours": []map[string]interface{}{
			{
				"dayOfWeek": int(now.Weekday()),
				"startTime": formatTestClock(startMinutes),
				"endTime":   formatTestClock(endMinutes),
			},
		},
	})

	w := doRequestFromIP(t, http.MethodPut, "/api/admin/working-hours", body, 0, true, "203.0.113.220")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for working hours update, got %d: %s", w.Code, w.Body.String())
	}

	path := "/api/availability?date=" + now.Format("2006-01-02") + "&duration=1"
	w = doRequestFromIP(t, http.MethodGet, path, nil, 565656, false, "203.0.113.221")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for availability lookup, got %d: %s", w.Code, w.Body.String())
	}

	var slots []map[string]interface{}
	parseJSON(t, w, &slots)
	if len(slots) != 0 {
		t.Fatalf("expected current/past slot to be hidden, got %#v", slots)
	}
}

func TestCreateBookingRejectsPastTimeTodayInSpecialistTimezone(t *testing.T) {
	location := withSpecialistTimezone(t, "Europe/Moscow")
	now := time.Now().In(location)

	service, err := db.CreateSessionType(
		testSpecialist.ID,
		fmt.Sprintf("past-time-%d", time.Now().UnixNano()),
		"Past Time Test",
		1,
		0,
		"USD",
		"",
	)
	if err != nil {
		t.Fatalf("db.CreateSessionType: %v", err)
	}

	body := jsonBody(map[string]interface{}{
		"sessionTypeId": service.ID,
		"date":          now.Format("2006-01-02"),
		"time":          formatTestClock(now.Hour()*60 + now.Minute()),
		"duration":      service.DurationMinutes,
		"name":          "Past Time Client",
	})

	w := doRequestFromIP(t, http.MethodPost, "/api/bookings", body, 575757, false, "203.0.113.222")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for past same-day time, got %d: %s", w.Code, w.Body.String())
	}
}
