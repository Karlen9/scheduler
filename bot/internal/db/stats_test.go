package db

import (
	"testing"
	"time"

	"scheduler-bot/internal/crypto"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Initializes a fresh in-memory database for stats tests.
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
func setupStatsTestDB(t *testing.T) {
	t.Helper()

	if DB != nil {
		_ = DB.Close()
	}
	if err := crypto.Init(""); err != nil {
		t.Fatalf("crypto.Init: %v", err)
	}
	if err := Init("file::memory:?cache=shared"); err != nil {
		t.Fatalf("Init: %v", err)
	}
}

/***************************************************************************************************
* Creates a booking with explicit timestamps and status for stats tests.
*
* Parameters:
* - t: T used by the current operation.
* - specialistID: Identifier used to target the current record.
* - client: Client used by the current operation.
* - sessionTypeID: Identifier used to target the current record.
* - startsAt: Starts at used by the current operation.
* - durationMinutes: Duration value used by the current operation.
* - status: Status used by the current operation.
* - createdAt: Created at used by the current operation.
*
* Returns:
* - The computed value for the current operation as *models.Booking.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func createStatsBooking(
	t *testing.T,
	specialistID string,
	client *models.Client,
	sessionTypeID string,
	startsAt time.Time,
	durationMinutes int,
	status models.BookingStatus,
	createdAt time.Time,
) *models.Booking {
	t.Helper()

	booking, err := CreateBooking(
		specialistID,
		client.ID,
		sessionTypeID,
		startsAt,
		startsAt.Add(time.Duration(durationMinutes)*time.Minute),
		client.Name,
		"",
		durationMinutes,
	)
	if err != nil {
		t.Fatalf("CreateBooking: %v", err)
	}

	if _, err := DB.Exec(Q(`
		UPDATE bookings
		SET status = ?, created_at = ?, starts_at = ?, ends_at = ?
		WHERE id = ?
	`), status, createdAt, startsAt, startsAt.Add(time.Duration(durationMinutes)*time.Minute), booking.ID); err != nil {
		t.Fatalf("update booking: %v", err)
	}

	updated, err := GetBookingByID(booking.ID)
	if err != nil {
		t.Fatalf("GetBookingByID: %v", err)
	}

	return updated
}

/***************************************************************************************************
* Implements the test get client stats logic used by this module.
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
func TestGetClientStats(t *testing.T) {
	setupStatsTestDB(t)

	specialist, err := CreateSpecialist(1001, "token-client-stats", "clientstatsbot", "Stats Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}
	client, err := CreateClient(2001, specialist.ID, "Alice")
	if err != nil {
		t.Fatalf("CreateClient: %v", err)
	}
	service, err := CreateSessionType(specialist.ID, "consult", "Consultation", 60, 1000, "USD", "")
	if err != nil {
		t.Fatalf("CreateSessionType: %v", err)
	}

	now := time.Now().UTC()
	currentWeekMonday := startOfWeek(now).AddDate(0, 0, 1).Add(9 * time.Hour)
	previousWeekMonday := startOfWeek(now).AddDate(0, 0, -6).Add(9 * time.Hour)
	lastMonthSession := startOfMonth(now).AddDate(0, -1, 0).AddDate(0, 0, 2).Add(18 * time.Hour)
	cancelledSession := startOfMonth(now).AddDate(0, 0, 4).Add(12 * time.Hour)

	createStatsBooking(t, specialist.ID, client, service.ID, currentWeekMonday, 60, models.BookingStatusCompleted, currentWeekMonday)
	createStatsBooking(t, specialist.ID, client, service.ID, previousWeekMonday, 60, models.BookingStatusCompleted, previousWeekMonday)
	createStatsBooking(t, specialist.ID, client, service.ID, lastMonthSession, 90, models.BookingStatusCompleted, lastMonthSession)
	createStatsBooking(t, specialist.ID, client, service.ID, cancelledSession, 60, models.BookingStatusCancelled, cancelledSession)

	stats, err := GetClientStats(specialist.ID, client.ID, specialist.Timezone)
	if err != nil {
		t.Fatalf("GetClientStats: %v", err)
	}

	expectedThisMonth := 0
	expectedLastMonth := 0
	currentMonthStart := startOfMonth(now)
	nextMonthStart := currentMonthStart.AddDate(0, 1, 0)
	lastMonthStart := currentMonthStart.AddDate(0, -1, 0)
	for _, ts := range []time.Time{currentWeekMonday, previousWeekMonday, lastMonthSession} {
		switch {
		case !ts.Before(currentMonthStart) && ts.Before(nextMonthStart):
			expectedThisMonth++
		case !ts.Before(lastMonthStart) && ts.Before(currentMonthStart):
			expectedLastMonth++
		}
	}

	if stats.TotalSessions != 3 {
		t.Fatalf("expected total sessions 3, got %d", stats.TotalSessions)
	}
	if stats.TotalHours != 3.5 {
		t.Fatalf("expected total hours 3.5, got %.1f", stats.TotalHours)
	}
	if stats.CompletionRate != 75 {
		t.Fatalf("expected completion rate 75, got %.1f", stats.CompletionRate)
	}
	if stats.SessionsThisMonth != expectedThisMonth {
		t.Fatalf("expected this month %d, got %d", expectedThisMonth, stats.SessionsThisMonth)
	}
	if stats.SessionsLastMonth != expectedLastMonth {
		t.Fatalf("expected last month %d, got %d", expectedLastMonth, stats.SessionsLastMonth)
	}
	if stats.CurrentStreak != 2 {
		t.Fatalf("expected current streak 2, got %d", stats.CurrentStreak)
	}
	if stats.LongestStreak != 2 {
		t.Fatalf("expected longest streak 2, got %d", stats.LongestStreak)
	}
	if stats.MostCommonDay == nil || *stats.MostCommonDay != 1 {
		t.Fatalf("expected most common day Monday (1), got %#v", stats.MostCommonDay)
	}
	if stats.MostCommonTimeSlot == nil || *stats.MostCommonTimeSlot != "morning" {
		t.Fatalf("expected most common time slot morning, got %#v", stats.MostCommonTimeSlot)
	}
	if len(stats.DurationBreakdown) != 2 {
		t.Fatalf("expected 2 duration buckets, got %d", len(stats.DurationBreakdown))
	}
	if len(stats.MonthlyTrend) != 6 {
		t.Fatalf("expected 6 monthly trend points, got %d", len(stats.MonthlyTrend))
	}
}

/***************************************************************************************************
* Implements the test get admin stats logic used by this module.
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
func TestGetAdminStats(t *testing.T) {
	setupStatsTestDB(t)

	specialist, err := CreateSpecialist(3001, "token-admin-stats", "adminstatsbot", "Admin Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}
	clientOne, err := CreateClient(4001, specialist.ID, "Anna")
	if err != nil {
		t.Fatalf("CreateClient clientOne: %v", err)
	}
	clientTwo, err := CreateClient(4002, specialist.ID, "Bob")
	if err != nil {
		t.Fatalf("CreateClient clientTwo: %v", err)
	}
	clientThree, err := CreateClient(4003, specialist.ID, "Cara")
	if err != nil {
		t.Fatalf("CreateClient clientThree: %v", err)
	}
	serviceOne, err := CreateSessionType(specialist.ID, "therapy", "Therapy", 60, 1000, "USD", "")
	if err != nil {
		t.Fatalf("CreateSessionType serviceOne: %v", err)
	}
	serviceTwo, err := CreateSessionType(specialist.ID, "intensive", "Intensive", 90, 2000, "USD", "")
	if err != nil {
		t.Fatalf("CreateSessionType serviceTwo: %v", err)
	}

	now := time.Now().UTC()
	currentWeekMonday := startOfWeek(now).AddDate(0, 0, 1).Add(9 * time.Hour)
	twoWeeksAgoMonday := startOfWeek(now).AddDate(0, 0, -13).Add(9 * time.Hour)
	currentMonthBooking := startOfMonth(now).AddDate(0, 0, 5).Add(10 * time.Hour)
	lastMonthBooking := startOfMonth(now).AddDate(0, -1, 0).AddDate(0, 0, 3).Add(18 * time.Hour)

	createStatsBooking(t, specialist.ID, clientOne, serviceOne.ID, currentWeekMonday, 60, models.BookingStatusCompleted, currentWeekMonday)
	createStatsBooking(t, specialist.ID, clientOne, serviceTwo.ID, lastMonthBooking, 90, models.BookingStatusCompleted, lastMonthBooking)
	createStatsBooking(t, specialist.ID, clientTwo, serviceOne.ID, currentMonthBooking, 60, models.BookingStatusCompleted, currentMonthBooking)
	createStatsBooking(t, specialist.ID, clientThree, serviceOne.ID, twoWeeksAgoMonday, 60, models.BookingStatusCancelled, twoWeeksAgoMonday)

	stats, err := GetAdminStats(specialist.ID, specialist.Timezone)
	if err != nil {
		t.Fatalf("GetAdminStats: %v", err)
	}

	if stats.TotalBookings != 4 {
		t.Fatalf("expected total bookings 4, got %d", stats.TotalBookings)
	}
	if stats.ActiveClients != 2 {
		t.Fatalf("expected active clients 2, got %d", stats.ActiveClients)
	}
	if stats.CompletionRate != 75 {
		t.Fatalf("expected completion rate 75, got %.1f", stats.CompletionRate)
	}
	if stats.TotalClients != 3 {
		t.Fatalf("expected total clients 3, got %d", stats.TotalClients)
	}
	if stats.ReturningRate != 33.3 {
		t.Fatalf("expected returning rate 33.3, got %.1f", stats.ReturningRate)
	}
	if stats.BusiestDay == nil || *stats.BusiestDay != 1 {
		t.Fatalf("expected busiest day Monday (1), got %#v", stats.BusiestDay)
	}
	if stats.BusiestTimeSlot == nil || *stats.BusiestTimeSlot != "morning" {
		t.Fatalf("expected busiest time slot morning, got %#v", stats.BusiestTimeSlot)
	}
	if stats.CancellationRate != 25 {
		t.Fatalf("expected cancellation rate 25, got %.1f", stats.CancellationRate)
	}
	if stats.RevenueThisMonth != 2000 {
		t.Fatalf("expected revenue this month 2000, got %d", stats.RevenueThisMonth)
	}
	if stats.RevenueLastMonth != 2000 {
		t.Fatalf("expected revenue last month 2000, got %d", stats.RevenueLastMonth)
	}
	if stats.RevenueCurrency != "USD" {
		t.Fatalf("expected revenue currency USD, got %q", stats.RevenueCurrency)
	}
	if len(stats.TopClients) == 0 || stats.TopClients[0].Name != "Anna" {
		t.Fatalf("expected top client Anna, got %#v", stats.TopClients)
	}
	if len(stats.RevenueByMonth) != 6 {
		t.Fatalf("expected 6 revenue-by-month points, got %d", len(stats.RevenueByMonth))
	}
	if len(stats.RevenueByService) != 2 {
		t.Fatalf("expected 2 revenue-by-service entries, got %d", len(stats.RevenueByService))
	}
}
