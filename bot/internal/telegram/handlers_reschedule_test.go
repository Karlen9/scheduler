package telegram

import (
	"testing"
	"time"

	"scheduler-bot/internal/crypto"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

// setupRescheduleTestDB initialises an in-memory SQLite database for the
// reschedule-callback tests and registers cleanup.
func setupRescheduleTestDB(t *testing.T) {
	t.Helper()
	if db.DB != nil {
		_ = db.DB.Close()
	}
	if err := crypto.Init(""); err != nil {
		t.Fatalf("crypto.Init: %v", err)
	}
	if err := db.Init("file::memory:?cache=shared"); err != nil {
		t.Fatalf("db.Init: %v", err)
	}
}

// TestNotifyMoveResponseNilNewBookingDoesNotPanic verifies the defensive nil
// guard added to NotifyMoveResponse: when newBooking is nil and oldBooking is
// non-nil, the function must not panic — it should fall back to oldBooking and
// return an error only because the client/specialist IDs don't exist in the
// (empty) test database.
func TestNotifyMoveResponseNilNewBookingDoesNotPanic(t *testing.T) {
	setupRescheduleTestDB(t)

	h := &Handler{Bot: &Bot{Token: "test:token"}}

	now := time.Now().UTC().Add(24 * time.Hour)
	oldBooking := &models.Booking{
		ID:           "old-booking-id",
		SpecialistID: "spec-id-does-not-exist",
		ClientID:     "client-id-does-not-exist",
		StartsAt:     now,
		EndsAt:       now.Add(time.Hour),
		Status:       models.BookingStatusConfirmed,
		CreatedBy:    "specialist",
	}

	// Must not panic. Error is expected because the IDs are not in the db.
	t.Run("respondedBy=specialist nil newBooking", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("NotifyMoveResponse panicked: %v", r)
			}
		}()
		// newBooking is nil — the guard must promote oldBooking to fill the slot.
		err := h.NotifyMoveResponse(nil, oldBooking, false, "specialist")
		// We expect a non-nil error (client not found), not a panic.
		if err == nil {
			t.Fatal("expected an error (client not found), got nil")
		}
	})

	t.Run("respondedBy=client nil newBooking", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("NotifyMoveResponse panicked: %v", r)
			}
		}()
		err := h.NotifyMoveResponse(nil, oldBooking, false, "client")
		if err == nil {
			t.Fatal("expected an error (specialist not found), got nil")
		}
	})
}
