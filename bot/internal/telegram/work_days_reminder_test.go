package telegram

import (
	"testing"

	"scheduler-bot/internal/models"
)

func TestWorkDaysReminderURL(t *testing.T) {
	h := &Handler{WebAppURL: "https://app.example.com"}

	got := h.WorkDaysReminderURL(&models.Specialist{ID: "spec-1", Language: "en"})
	want := "https://app.example.com/admin/settings/work-days?specialist=spec-1&lang=en"
	if got != want {
		t.Fatalf("WorkDaysReminderURL = %q, want %q", got, want)
	}

	got = h.WorkDaysReminderURL(&models.Specialist{ID: "spec-2"})
	want = "https://app.example.com/admin/settings/work-days?specialist=spec-2&lang=ru"
	if got != want {
		t.Fatalf("WorkDaysReminderURL default lang = %q, want %q", got, want)
	}
}
