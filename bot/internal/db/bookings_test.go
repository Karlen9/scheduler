package db

import (
	"testing"
	"time"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Implements the test complete past confirmed bookings for specialist logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func TestCompletePastConfirmedBookingsForSpecialist(t *testing.T) {
	setupStatsTestDB(t)

	specialist, err := CreateSpecialist(1002, "token-past-bookings", "pastbookingsbot", "Past Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}
	client, err := CreateClient(2002, specialist.ID, "Alice")
	if err != nil {
		t.Fatalf("CreateClient: %v", err)
	}
	service, err := CreateSessionType(specialist.ID, "consult", "Consultation", 60, 1000, "USD", "")
	if err != nil {
		t.Fatalf("CreateSessionType: %v", err)
	}

	now := time.Now().UTC()
	pastBooking := createStatsBooking(t, specialist.ID, client, service.ID, now.Add(-time.Minute), 60, models.BookingStatusConfirmed, now.Add(-time.Hour))
	futureBooking := createStatsBooking(t, specialist.ID, client, service.ID, now.Add(time.Hour), 60, models.BookingStatusConfirmed, now.Add(-time.Hour))

	completedCount, err := CompletePastConfirmedBookingsForSpecialist(specialist.ID, now)
	if err != nil {
		t.Fatalf("CompletePastConfirmedBookingsForSpecialist: %v", err)
	}
	if completedCount != 1 {
		t.Fatalf("expected completed count 1, got %d", completedCount)
	}

	updatedPast, err := GetBookingByID(pastBooking.ID)
	if err != nil {
		t.Fatalf("GetBookingByID(past): %v", err)
	}
	if updatedPast == nil || updatedPast.Status != models.BookingStatusCompleted {
		t.Fatalf("expected past booking completed, got %#v", updatedPast)
	}

	updatedFuture, err := GetBookingByID(futureBooking.ID)
	if err != nil {
		t.Fatalf("GetBookingByID(future): %v", err)
	}
	if updatedFuture == nil || updatedFuture.Status != models.BookingStatusConfirmed {
		t.Fatalf("expected future booking confirmed, got %#v", updatedFuture)
	}
}
