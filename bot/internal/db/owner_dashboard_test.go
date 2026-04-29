package db

import (
	"testing"
	"time"

	"scheduler-bot/internal/models"
)

func TestOwnerDashboardStatsHandleEmptyDatabase(t *testing.T) {
	setupStatsTestDB(t)

	platform, err := GetOwnerPlatformStats()
	if err != nil {
		t.Fatalf("GetOwnerPlatformStats: %v", err)
	}
	if platform.TotalSpecialists != 0 || platform.ActiveSpecialists != 0 {
		t.Fatalf("expected empty platform stats, got %+v", platform)
	}

	bookings, err := GetOwnerBookingStats()
	if err != nil {
		t.Fatalf("GetOwnerBookingStats: %v", err)
	}
	if bookings.Total != 0 || bookings.CancellationRate != 0 {
		t.Fatalf("expected empty booking stats, got %+v", bookings)
	}

	revenue, err := GetOwnerRevenueByCurrency()
	if err != nil {
		t.Fatalf("GetOwnerRevenueByCurrency: %v", err)
	}
	if len(revenue) != 0 {
		t.Fatalf("expected no revenue rows, got %+v", revenue)
	}

	trends, err := GetOwnerMonthlyTrends(6)
	if err != nil {
		t.Fatalf("GetOwnerMonthlyTrends: %v", err)
	}
	if len(trends) != 6 {
		t.Fatalf("expected 6 trend points, got %d", len(trends))
	}
}

func TestOwnerDashboardRevenueByCurrency(t *testing.T) {
	setupStatsTestDB(t)

	specialist, err := CreateSpecialist(333333, "owner-revenue-token", "revenuebot", "Revenue Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}
	usd, err := CreateSessionType(specialist.ID, "owner-revenue-usd", "USD Service", 60, 100, "USD", "")
	if err != nil {
		t.Fatalf("CreateSessionType USD: %v", err)
	}
	eur, err := CreateSessionType(specialist.ID, "owner-revenue-eur", "EUR Service", 60, 200, "EUR", "")
	if err != nil {
		t.Fatalf("CreateSessionType EUR: %v", err)
	}
	client, err := CreateClient(444444, specialist.ID, "Revenue Client")
	if err != nil {
		t.Fatalf("CreateClient: %v", err)
	}
	now := time.Now().UTC()
	createStatsBooking(t, specialist.ID, client, usd.ID, now, 60, models.BookingStatusCompleted, now)
	createStatsBooking(t, specialist.ID, client, eur.ID, now.Add(time.Hour), 60, models.BookingStatusCompleted, now)

	revenue, err := GetOwnerRevenueByCurrency()
	if err != nil {
		t.Fatalf("GetOwnerRevenueByCurrency: %v", err)
	}

	got := map[string]int{}
	for _, item := range revenue {
		got[item.Currency] = item.Revenue
	}
	if got["USD"] != 100 || got["EUR"] != 200 {
		t.Fatalf("expected USD=100 and EUR=200, got %+v", got)
	}
}
