package api_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
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
		"type":            "personal",
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

	var bookings []map[string]interface{}
	parseJSON(t, w, &bookings)

	found := false
	for _, b := range bookings {
		if b["id"] == bookingID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("booking %s not found in client's booking list", bookingID)
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

	var bookings []map[string]interface{}
	parseJSON(t, w, &bookings)

	if len(bookings) == 0 {
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
	w := doClientRequest(t, http.MethodGet, "/api/admin/settings", nil, 888888)

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
