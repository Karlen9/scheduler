package db

import (
	"errors"
	"testing"
	"time"

	"scheduler-bot/internal/models"
)

func TestBatchConsumptionUsesOldestActiveBatch(t *testing.T) {
	setupStatsTestDB(t)

	specialist, err := CreateSpecialist(3001, "token-batch-fifo", "batchfifobot", "Batch Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}
	client, err := CreateClient(4001, specialist.ID, "Alice")
	if err != nil {
		t.Fatalf("CreateClient: %v", err)
	}
	service, err := CreateSessionTypeWithSessionsCount(specialist.ID, "batch", "10 Pack", 60, 10000, "RUB", "", 2)
	if err != nil {
		t.Fatalf("CreateSessionTypeWithSessionsCount: %v", err)
	}

	firstBatch, err := AssignClientBatch(client.ID, specialist.ID, service.ID)
	if err != nil {
		t.Fatalf("AssignClientBatch(first): %v", err)
	}
	secondBatch, err := AssignClientBatch(client.ID, specialist.ID, service.ID)
	if err != nil {
		t.Fatalf("AssignClientBatch(second): %v", err)
	}

	start := time.Now().UTC().Add(24 * time.Hour)
	for i := 0; i < 3; i++ {
		booking, err := CreateBooking(
			specialist.ID,
			client.ID,
			service.ID,
			start.Add(time.Duration(i)*2*time.Hour),
			start.Add(time.Duration(i)*2*time.Hour).Add(time.Hour),
			client.Name,
			"",
			60,
		)
		if err != nil {
			t.Fatalf("CreateBooking(%d): %v", i, err)
		}
		if err := UpdateBookingStatus(booking.ID, models.BookingStatusCompleted); err != nil {
			t.Fatalf("UpdateBookingStatus(%d): %v", i, err)
		}
	}

	batches, err := GetClientBatchesByClientID(client.ID, specialist.ID)
	if err != nil {
		t.Fatalf("GetClientBatchesByClientID: %v", err)
	}
	byID := map[string]models.ClientBatch{}
	for _, batch := range batches {
		byID[batch.ID] = batch
	}

	if got := byID[firstBatch.ID].RemainingSessions; got != 0 {
		t.Fatalf("expected first batch exhausted, remaining=%d", got)
	}
	if got := byID[firstBatch.ID].Status; got != "exhausted" {
		t.Fatalf("expected first batch status exhausted, got %q", got)
	}
	if got := byID[secondBatch.ID].RemainingSessions; got != 1 {
		t.Fatalf("expected second batch to have 1 remaining, got %d", got)
	}
}

func newBatchTestFixture(t *testing.T, telegramID int64, token, username string, sessions int) (*models.Specialist, *models.Client, *models.SessionType) {
	t.Helper()
	setupStatsTestDB(t)

	specialist, err := CreateSpecialist(telegramID, token, username, "Batch Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}
	client, err := CreateClient(telegramID+1000, specialist.ID, "Alice")
	if err != nil {
		t.Fatalf("CreateClient: %v", err)
	}
	service, err := CreateSessionTypeWithSessionsCount(specialist.ID, "batch", "Pack", 60, 10000, "RUB", "", sessions)
	if err != nil {
		t.Fatalf("CreateSessionTypeWithSessionsCount: %v", err)
	}
	return specialist, client, service
}

func createBatchBooking(t *testing.T, specialist *models.Specialist, client *models.Client, service *models.SessionType, startsAt time.Time) (*models.Booking, error) {
	t.Helper()
	return CreateBooking(specialist.ID, client.ID, service.ID, startsAt, startsAt.Add(time.Hour), client.Name, "", 60)
}

func TestCompletionSucceedsWhenNoBatchRemains(t *testing.T) {
	specialist, client, service := newBatchTestFixture(t, 3101, "token-batch-none", "batchnonebot", 2)

	batch, err := AssignClientBatch(client.ID, specialist.ID, service.ID)
	if err != nil {
		t.Fatalf("AssignClientBatch: %v", err)
	}

	now := time.Now().UTC()
	past := now.Add(-5 * time.Hour)
	booking, err := createBatchBooking(t, specialist, client, service, past)
	if err != nil {
		t.Fatalf("createBatchBooking: %v", err)
	}
	if _, err := DB.Exec(Q(`UPDATE bookings SET status = 'confirmed' WHERE id = ?`), booking.ID); err != nil {
		t.Fatalf("confirm booking: %v", err)
	}

	// The batch disappears (e.g. exhausted by manual completions) before the booking is completed.
	if _, err := DB.Exec(Q(`UPDATE client_batches SET remaining_sessions = 0, status = 'exhausted' WHERE id = ?`), batch.ID); err != nil {
		t.Fatalf("exhaust batch: %v", err)
	}

	count, err := CompletePastConfirmedBookingsForSpecialist(specialist.ID, now)
	if err != nil {
		t.Fatalf("expected completion not to fail without a batch, got %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 completed booking, got %d", count)
	}
	updated, _ := GetBookingByID(booking.ID)
	if updated == nil || updated.Status != models.BookingStatusCompleted {
		t.Fatalf("expected booking completed, got %#v", updated)
	}
	if updated.ClientBatchID != "" {
		t.Fatalf("expected batch link cleared when nothing was consumed, got %q", updated.ClientBatchID)
	}

	// Manual completion must not fail with a missing batch either.
	second, err := createBatchBooking(t, specialist, client, service, now.Add(48*time.Hour))
	if err == nil {
		if err := UpdateBookingStatus(second.ID, models.BookingStatusCompleted); err != nil {
			t.Fatalf("expected manual completion without a batch to succeed, got %v", err)
		}
	} else if !errors.Is(err, ErrNoActiveClientBatch) {
		t.Fatalf("unexpected create error: %v", err)
	}
}

func TestBatchConsumptionPrefersAttachedBatch(t *testing.T) {
	specialist, client, service := newBatchTestFixture(t, 3201, "token-batch-attached", "batchattachedbot", 3)

	oldest, err := AssignClientBatch(client.ID, specialist.ID, service.ID)
	if err != nil {
		t.Fatalf("AssignClientBatch(oldest): %v", err)
	}
	newer, err := AssignClientBatch(client.ID, specialist.ID, service.ID)
	if err != nil {
		t.Fatalf("AssignClientBatch(newer): %v", err)
	}

	booking, err := createBatchBooking(t, specialist, client, service, time.Now().UTC().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("createBatchBooking: %v", err)
	}

	// Force the booking onto the newer batch; completion must charge that one, not the oldest.
	if _, err := DB.Exec(Q(`UPDATE bookings SET client_batch_id = ? WHERE id = ?`), newer.ID, booking.ID); err != nil {
		t.Fatalf("attach newer batch: %v", err)
	}
	if err := UpdateBookingStatus(booking.ID, models.BookingStatusCompleted); err != nil {
		t.Fatalf("UpdateBookingStatus: %v", err)
	}

	batches, err := GetClientBatchesByClientID(client.ID, specialist.ID)
	if err != nil {
		t.Fatalf("GetClientBatchesByClientID: %v", err)
	}
	remaining := map[string]int{}
	for _, b := range batches {
		remaining[b.ID] = b.RemainingSessions
	}
	if remaining[oldest.ID] != 3 {
		t.Fatalf("expected oldest batch untouched (3), got %d", remaining[oldest.ID])
	}
	if remaining[newer.ID] != 2 {
		t.Fatalf("expected attached (newer) batch consumed (2), got %d", remaining[newer.ID])
	}
}

func TestBatchReservationRejectsOverbooking(t *testing.T) {
	specialist, client, service := newBatchTestFixture(t, 3301, "token-batch-reserve", "batchreservebot", 2)

	if _, err := AssignClientBatch(client.ID, specialist.ID, service.ID); err != nil {
		t.Fatalf("AssignClientBatch: %v", err)
	}

	start := time.Now().UTC().Add(24 * time.Hour)
	var bookings []*models.Booking
	for i := 0; i < 2; i++ {
		booking, err := createBatchBooking(t, specialist, client, service, start.Add(time.Duration(i)*2*time.Hour))
		if err != nil {
			t.Fatalf("createBatchBooking(%d): %v", i, err)
		}
		bookings = append(bookings, booking)
	}

	_, err := createBatchBooking(t, specialist, client, service, start.Add(10*time.Hour))
	if !errors.Is(err, ErrNoActiveClientBatch) {
		t.Fatalf("expected ErrNoActiveClientBatch for the (remaining+1)-th pending booking, got %v", err)
	}

	// Cancelling a pending booking frees its reservation.
	if err := CancelBooking(bookings[0].ID, "", models.CancelledByClient); err != nil {
		t.Fatalf("CancelBooking: %v", err)
	}
	if _, err := createBatchBooking(t, specialist, client, service, start.Add(10*time.Hour)); err != nil {
		t.Fatalf("expected booking to succeed after a reservation was freed, got %v", err)
	}
}

func TestRescheduleBookingReusesBatchWithoutDoubleCounting(t *testing.T) {
	specialist, client, service := newBatchTestFixture(t, 3401, "token-batch-resched", "batchreschedbot", 2)

	batch, err := AssignClientBatch(client.ID, specialist.ID, service.ID)
	if err != nil {
		t.Fatalf("AssignClientBatch: %v", err)
	}

	start := time.Now().UTC().Add(24 * time.Hour)
	original, err := createBatchBooking(t, specialist, client, service, start)
	if err != nil {
		t.Fatalf("createBatchBooking: %v", err)
	}
	if err := UpdateBookingStatus(original.ID, models.BookingStatusConfirmed); err != nil {
		t.Fatalf("confirm: %v", err)
	}

	// Fill the remaining capacity so the batch is fully reserved.
	if _, err := createBatchBooking(t, specialist, client, service, start.Add(10*time.Hour)); err != nil {
		t.Fatalf("createBatchBooking(second): %v", err)
	}

	// The batch is fully reserved; a reschedule proposal reuses the original booking's batch
	// explicitly and must not be rejected as overbooking.
	moved, err := CreateRescheduleBooking(specialist.ID, client.ID, service.ID, start.Add(2*time.Hour), start.Add(3*time.Hour), client.Name, "", "client", 60, "", original.ID)
	if err != nil {
		t.Fatalf("CreateRescheduleBooking: %v", err)
	}
	if moved.ClientBatchID != batch.ID {
		t.Fatalf("expected reschedule booking to reuse batch %s, got %q", batch.ID, moved.ClientBatchID)
	}
	if err := ApproveRescheduleBooking(moved.ID); err != nil {
		t.Fatalf("ApproveRescheduleBooking: %v", err)
	}
	if err := ApproveRescheduleBooking(moved.ID); !errors.Is(err, ErrBookingStatusConflict) && err == nil {
		t.Fatalf("expected a second approval to fail")
	}
}
