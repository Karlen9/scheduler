package telegram

import (
	"os"
	"strings"
	"testing"
	"time"

	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

func TestMain(m *testing.M) {
	if err := myI18n.Init(); err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}

func TestFormatDurationUsesHoursAndMinutes(t *testing.T) {
	loc := myI18n.NewLocalizer("en")

	tests := []struct {
		name    string
		minutes int
		want    string
	}{
		{name: "less than hour", minutes: 45, want: "45 min"},
		{name: "exact hour", minutes: 60, want: "1 h"},
		{name: "hour and minutes", minutes: 75, want: "1 h 15 min"},
		{name: "half hour remainder", minutes: 90, want: "1 h 30 min"},
		{name: "multiple hours and minutes", minutes: 105, want: "1 h 45 min"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := formatDuration(loc, tt.minutes); got != tt.want {
				t.Fatalf("formatDuration(%d) = %q, want %q", tt.minutes, got, tt.want)
			}
		})
	}
}

func TestFormatDurationRussianUsesMinutes(t *testing.T) {
	loc := myI18n.NewLocalizer("ru")

	if got := formatDuration(loc, 45); got != "45 мин" {
		t.Fatalf("formatDuration(45) = %q, want %q", got, "45 мин")
	}
	if got := formatDuration(loc, 75); got != "1 ч 15 мин" {
		t.Fatalf("formatDuration(75) = %q, want %q", got, "1 ч 15 мин")
	}
}

func TestFormatNewBookingMessageIncludesCorrectBookingInfo(t *testing.T) {
	loc := myI18n.NewLocalizer("en")
	booking := testBooking()
	booking.ClientMessage = "Please prepare the room"

	msg := FormatNewBookingMessage(loc, booking)
	expectedParts := []string{
		"Client: Alex",
		"Service: Consultation (45 min)",
		"Tue, 14 Apr 15:30",
		"Message: Please prepare the room",
	}
	for _, part := range expectedParts {
		if !strings.Contains(msg, part) {
			t.Fatalf("FormatNewBookingMessage() missing %q in %q", part, msg)
		}
	}
}

func TestFormatRejectedClientIncludesBookingContext(t *testing.T) {
	loc := myI18n.NewLocalizer("en")
	booking := testBooking()

	msg := FormatBookingRejectedClient(loc, booking)
	expectedParts := []string{
		"Your booking request was declined",
		"Service: Consultation (45 min)",
		"Time: Tue, 14 Apr 15:30",
		"Please try choosing another time.",
	}
	for _, part := range expectedParts {
		if !strings.Contains(msg, part) {
			t.Fatalf("FormatBookingRejectedClient() missing %q in %q", part, msg)
		}
	}
}

func TestFormatRejectedClientWithReasonIncludesBookingContext(t *testing.T) {
	loc := myI18n.NewLocalizer("en")
	booking := testBooking()
	booking.CancelReason = "rescheduled"

	msg := FormatBookingRejectedClient(loc, booking)
	expectedParts := []string{
		"Your booking request was declined",
		"Service: Consultation (45 min)",
		"Time: Tue, 14 Apr 15:30",
		"Reason: Rescheduled",
	}
	for _, part := range expectedParts {
		if !strings.Contains(msg, part) {
			t.Fatalf("FormatBookingRejectedClient() missing %q in %q", part, msg)
		}
	}
}

func TestFormatReminderClientUsesWindowWording(t *testing.T) {
	loc := myI18n.NewLocalizer("en")

	msg := FormatReminderClient(loc, testBooking())
	if !strings.Contains(msg, "starts within an hour") {
		t.Fatalf("FormatReminderClient() should use window wording, got %q", msg)
	}
	if strings.Contains(msg, "in 1 hour!") {
		t.Fatalf("FormatReminderClient() should not promise exact one-hour timing, got %q", msg)
	}
}

func TestFormatSpecialistCreatedBookingClientPromptsForResponse(t *testing.T) {
	loc := myI18n.NewLocalizer("en")

	msg := FormatSpecialistCreatedBookingClient(loc, testBooking())
	expectedParts := []string{
		"The specialist created a booking for you",
		"Service: Consultation (45 min)",
		"Time: Tue, 14 Apr 15:30",
		"Please accept or decline.",
	}
	for _, part := range expectedParts {
		if !strings.Contains(msg, part) {
			t.Fatalf("FormatSpecialistCreatedBookingClient() missing %q in %q", part, msg)
		}
	}
}

func testBooking() *models.Booking {
	return &models.Booking{
		ClientName:      "Alex",
		StartsAt:        time.Date(2026, time.April, 14, 15, 30, 0, 0, time.UTC),
		DurationMinutes: 45,
		SessionType: &models.SessionType{
			Name: "Consultation",
		},
	}
}
