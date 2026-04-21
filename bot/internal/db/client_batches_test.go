package db

import (
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
