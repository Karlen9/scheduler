package api_test

import (
	"net/http"
	"testing"
)

// ========== Task 2: Health + Trainer tests ==========

func TestHealthEndpoint(t *testing.T) {
	w := doRequest(t, http.MethodGet, "/health", nil, 111111)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if body := w.Body.String(); body != "OK" {
		t.Fatalf("expected body 'OK', got %q", body)
	}
}

func TestGetTrainer(t *testing.T) {
	w := doAdminRequest(t, http.MethodGet, "/api/trainer", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(t, w, &result)

	if name, _ := result["name"].(string); name != "Test Trainer" {
		t.Fatalf("expected name 'Test Trainer', got %q", name)
	}
	if isOwner, _ := result["isOwner"].(bool); !isOwner {
		t.Fatal("expected isOwner=true for trainer")
	}
}

func TestGetTrainerAsClient(t *testing.T) {
	w := doClientRequest(t, http.MethodGet, "/api/trainer", nil, 999999)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(t, w, &result)

	if isOwner, _ := result["isOwner"].(bool); isOwner {
		t.Fatal("expected isOwner=false for regular client")
	}
}

// ========== Task 3: Booking CRUD tests ==========

// setupWorkingHoursAndService sets working hours for days 1-5 and creates a session type
// so that booking creation can succeed.
func setupWorkingHoursAndService(t *testing.T) {
	t.Helper()

	// Set working hours (Mon-Fri, 09:00-18:00)
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

	// Create a session type (needed for booking creation)
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

func TestCreateAndGetBooking(t *testing.T) {
	// Setup working hours and session type
	setupWorkingHoursAndService(t)

	// Create a booking as client 222222 on Monday 2026-06-15
	body := jsonBody(map[string]interface{}{
		"date":     "2026-06-15",
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

	// GET /api/bookings as same client -> find the booking
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

func TestCancelBooking(t *testing.T) {
	// Create a booking as client 333333 on Tuesday 2026-06-16
	body := jsonBody(map[string]interface{}{
		"date":     "2026-06-16",
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

	// Cancel the booking
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

// ========== Task 4: Admin auth + client profile tests ==========

func TestAdminUnauthorized(t *testing.T) {
	// Regular client (888888) should get 403 on admin endpoint
	w := doClientRequest(t, http.MethodGet, "/api/admin/settings", nil, 888888)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetClientProfile(t *testing.T) {
	// GET /api/profile as client 444444 -> should create via DevAuthMiddleware with name "Dev User"
	w := doClientRequest(t, http.MethodGet, "/api/profile", nil, 444444)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var profile map[string]interface{}
	parseJSON(t, w, &profile)

	if name, _ := profile["name"].(string); name != "Dev User" {
		t.Fatalf("expected name 'Dev User', got %q", name)
	}
}

func TestUpdateClientProfile(t *testing.T) {
	// Step 1: GET /api/profile to create client 555555
	w := doClientRequest(t, http.MethodGet, "/api/profile", nil, 555555)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Step 2: PUT /api/profile with updated fields
	body := jsonBody(map[string]interface{}{
		"name":              "Updated Name",
		"phone":             "+1234567890",
		"preferredDuration": 90,
	})
	w = doClientRequest(t, http.MethodPut, "/api/profile", body, 555555)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Step 3: GET /api/profile -> verify updates
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

func TestGetWorkingHours(t *testing.T) {
	w := doClientRequest(t, http.MethodGet, "/api/working-hours", nil, 444444)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetServices(t *testing.T) {
	w := doClientRequest(t, http.MethodGet, "/api/services", nil, 444444)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
