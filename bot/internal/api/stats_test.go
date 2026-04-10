package api_test

import (
	"net/http"
	"testing"
	"time"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Creates a booking with the provided values for API stats tests.
*
* Parameters:
* - t: T used by the current operation.
* - client: Client used by the current operation.
* - sessionTypeID: Identifier used to target the current record.
* - startsAt: Starts at used by the current operation.
* - durationMinutes: Duration value used by the current operation.
* - status: Status used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func createAPIStatsBooking(
	t *testing.T,
	client *models.Client,
	sessionTypeID string,
	startsAt time.Time,
	durationMinutes int,
	status models.BookingStatus,
) {
	t.Helper()

	booking, err := db.CreateBooking(
		testSpecialist.ID,
		client.ID,
		sessionTypeID,
		startsAt,
		startsAt.Add(time.Duration(durationMinutes)*time.Minute),
		client.Name,
		"",
		durationMinutes,
	)
	if err != nil {
		t.Fatalf("db.CreateBooking: %v", err)
	}

	if _, err := db.DB.Exec(db.Q(`
		UPDATE bookings
		SET status = ?, created_at = ?, starts_at = ?, ends_at = ?
		WHERE id = ?
	`), status, startsAt, startsAt, startsAt.Add(time.Duration(durationMinutes)*time.Minute), booking.ID); err != nil {
		t.Fatalf("update booking: %v", err)
	}
}

/***************************************************************************************************
* Implements the test get client stats endpoint logic used by this module.
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
func TestGetClientStatsEndpoint(t *testing.T) {
	service, err := db.CreateSessionType(testSpecialist.ID, "stats-client-api", "Stats Client API", 60, 1500, "USD", "")
	if err != nil {
		t.Fatalf("CreateSessionType: %v", err)
	}

	clientTelegramID := int64(555001)
	client, err := db.GetOrCreateClient(clientTelegramID, testSpecialist.ID, "Client Stats API")
	if err != nil {
		t.Fatalf("GetOrCreateClient: %v", err)
	}

	now := time.Now().UTC()
	createAPIStatsBooking(t, client, service.ID, now.AddDate(0, 0, -1), 60, models.BookingStatusCompleted)
	createAPIStatsBooking(t, client, service.ID, now.AddDate(0, 0, -8), 90, models.BookingStatusCancelled)

	w := doClientRequest(t, http.MethodGet, "/api/stats", nil, clientTelegramID)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(t, w, &result)

	if totalSessions, _ := result["totalSessions"].(float64); totalSessions != 1 {
		t.Fatalf("expected totalSessions=1, got %v", result["totalSessions"])
	}
	if completionRate, _ := result["completionRate"].(float64); completionRate <= 0 {
		t.Fatalf("expected positive completionRate, got %v", result["completionRate"])
	}
}

/***************************************************************************************************
* Implements the test get admin stats endpoint logic used by this module.
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
func TestGetAdminStatsEndpoint(t *testing.T) {
	service, err := db.CreateSessionType(testSpecialist.ID, "stats-admin-api", "Stats Admin API", 60, 1800, "USD", "")
	if err != nil {
		t.Fatalf("CreateSessionType: %v", err)
	}

	client, err := db.GetOrCreateClient(555002, testSpecialist.ID, "Admin Stats Client")
	if err != nil {
		t.Fatalf("GetOrCreateClient: %v", err)
	}

	now := time.Now().UTC()
	createAPIStatsBooking(t, client, service.ID, now.AddDate(0, 0, -2), 60, models.BookingStatusCompleted)
	createAPIStatsBooking(t, client, service.ID, now.AddDate(0, 0, -9), 60, models.BookingStatusCompleted)

	w := doAdminRequest(t, http.MethodGet, "/api/admin/stats", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	parseJSON(t, w, &result)

	if totalBookings, _ := result["totalBookings"].(float64); totalBookings < 2 {
		t.Fatalf("expected totalBookings >= 2, got %v", result["totalBookings"])
	}
	if revenueCurrency, _ := result["revenueCurrency"].(string); revenueCurrency == "" {
		t.Fatalf("expected non-empty revenueCurrency, got %v", result["revenueCurrency"])
	}
}
