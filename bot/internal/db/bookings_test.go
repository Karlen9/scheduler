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

/***************************************************************************************************
* Marks a booking confirmed with an explicit starts_at/reminder_sent, mirroring createStatsBooking's
* direct-update approach for fields CreateBooking does not accept.
*
* Parameters:
* - t: T used by the current operation.
* - bookingID: Identifier used to target the current record.
* - startsAt: Starts at used by the current operation.
* - reminderSent: Whether the reminder_sent flag should be set.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func markBookingForReminder(t *testing.T, bookingID string, startsAt time.Time, reminderSent bool) {
	t.Helper()

	reminderSentValue := 0
	if reminderSent {
		reminderSentValue = 1
	}

	if _, err := DB.Exec(Q(`
		UPDATE bookings
		SET status = ?, starts_at = ?, ends_at = ?, reminder_sent = ?
		WHERE id = ?
	`), models.BookingStatusConfirmed, startsAt, startsAt.Add(time.Hour), reminderSentValue, bookingID); err != nil {
		t.Fatalf("update booking for reminder: %v", err)
	}
}

/***************************************************************************************************
* Implements the test get booking reminders due logic used by this module.
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
func TestGetBookingRemindersDue(t *testing.T) {
	setupStatsTestDB(t)

	specialist, err := CreateSpecialist(1003, "token-reminders-due", "remindersduebot", "Reminder Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}
	client, err := CreateClient(2003, specialist.ID, "Bob")
	if err != nil {
		t.Fatalf("CreateClient: %v", err)
	}
	if err := UpdateClientLanguage(client.ID, "en"); err != nil {
		t.Fatalf("UpdateClientLanguage: %v", err)
	}
	service, err := CreateSessionType(specialist.ID, "consult", "Consultation", 60, 1000, "USD", "")
	if err != nil {
		t.Fatalf("CreateSessionType: %v", err)
	}

	now := time.Now().UTC()

	dueBooking, err := CreateBooking(specialist.ID, client.ID, service.ID, now.Add(30*time.Minute), now.Add(90*time.Minute), client.Name, "", 60)
	if err != nil {
		t.Fatalf("CreateBooking(due): %v", err)
	}
	markBookingForReminder(t, dueBooking.ID, now.Add(30*time.Minute), false)

	alreadySentBooking, err := CreateBooking(specialist.ID, client.ID, service.ID, now.Add(40*time.Minute), now.Add(100*time.Minute), client.Name, "", 60)
	if err != nil {
		t.Fatalf("CreateBooking(alreadySent): %v", err)
	}
	markBookingForReminder(t, alreadySentBooking.ID, now.Add(40*time.Minute), true)

	farBooking, err := CreateBooking(specialist.ID, client.ID, service.ID, now.Add(2*time.Hour), now.Add(3*time.Hour), client.Name, "", 60)
	if err != nil {
		t.Fatalf("CreateBooking(far): %v", err)
	}
	markBookingForReminder(t, farBooking.ID, now.Add(2*time.Hour), false)

	reminders, err := GetBookingRemindersDue()
	if err != nil {
		t.Fatalf("GetBookingRemindersDue: %v", err)
	}
	if len(reminders) != 1 {
		t.Fatalf("expected exactly 1 reminder due, got %d: %#v", len(reminders), reminders)
	}

	reminder := reminders[0]
	if reminder.Booking.ID != dueBooking.ID {
		t.Fatalf("expected reminder for booking %s, got %s", dueBooking.ID, reminder.Booking.ID)
	}
	if reminder.ClientTelegramUserID != 2003 {
		t.Fatalf("expected ClientTelegramUserID 2003, got %d", reminder.ClientTelegramUserID)
	}
	if reminder.ClientLanguage != "en" {
		t.Fatalf("expected ClientLanguage 'en', got %q", reminder.ClientLanguage)
	}
	if !reminder.ClientNotifyReminders {
		t.Fatalf("expected ClientNotifyReminders true, got false")
	}
	if reminder.SpecialistName != specialist.Name {
		t.Fatalf("expected SpecialistName %q, got %q", specialist.Name, reminder.SpecialistName)
	}
	if reminder.SpecialistWebhookSecret != specialist.WebhookSecret {
		t.Fatalf("expected SpecialistWebhookSecret %q, got %q", specialist.WebhookSecret, reminder.SpecialistWebhookSecret)
	}
}
