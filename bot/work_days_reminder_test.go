package main

import (
	"testing"
	"time"
)

func utcTime(year int, month time.Month, day, hour, minute int) time.Time {
	return time.Date(year, month, day, hour, minute, 0, 0, time.UTC)
}

func TestNextWeekRange(t *testing.T) {
	tests := []struct {
		name       string
		now        time.Time
		wantMonday string
		wantSunday string
		wantWeek   string
	}{
		{"friday", utcTime(2026, time.November, 13, 18, 0), "2026-11-16", "2026-11-22", "2026-W47"},
		{"monday", utcTime(2026, time.November, 16, 9, 0), "2026-11-23", "2026-11-29", "2026-W48"},
		{"sunday", utcTime(2026, time.November, 22, 23, 59), "2026-11-23", "2026-11-29", "2026-W48"},
		{"year boundary iso week 53", utcTime(2026, time.December, 24, 12, 0), "2026-12-28", "2027-01-03", "2026-W53"},
		{"new iso year", utcTime(2027, time.January, 1, 19, 0), "2027-01-04", "2027-01-10", "2027-W01"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			monday, sunday, week := nextWeekRange(tt.now)
			if got := monday.Format("2006-01-02"); got != tt.wantMonday {
				t.Errorf("monday = %s, want %s", got, tt.wantMonday)
			}
			if got := sunday.Format("2006-01-02"); got != tt.wantSunday {
				t.Errorf("sunday = %s, want %s", got, tt.wantSunday)
			}
			if week != tt.wantWeek {
				t.Errorf("week = %s, want %s", week, tt.wantWeek)
			}
		})
	}
}

func TestDecideWorkDaysReminder(t *testing.T) {
	tests := []struct {
		name     string
		now      time.Time
		lastWeek string
		dates    int
		want     bool
		wantWeek string
	}{
		{"friday evening, nothing opened", utcTime(2026, time.November, 13, 18, 0), "", 0, true, "2026-W47"},
		{"friday late night", utcTime(2026, time.November, 13, 23, 45), "2026-W46", 0, true, "2026-W47"},
		{"friday before 18:00", utcTime(2026, time.November, 13, 17, 59), "", 0, false, "2026-W47"},
		{"thursday evening", utcTime(2026, time.November, 12, 20, 0), "", 0, false, "2026-W47"},
		{"saturday", utcTime(2026, time.November, 14, 20, 0), "", 0, false, "2026-W47"},
		{"next week already has days", utcTime(2026, time.November, 13, 19, 0), "", 2, false, "2026-W47"},
		{"already reminded for that week", utcTime(2026, time.November, 13, 19, 0), "2026-W47", 0, false, "2026-W47"},
		{"reminded for an older week", utcTime(2026, time.November, 13, 19, 0), "2026-W45", 0, true, "2026-W47"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, week := decideWorkDaysReminder(tt.now, tt.lastWeek, tt.dates)
			if got != tt.want {
				t.Errorf("send = %v, want %v", got, tt.want)
			}
			if week != tt.wantWeek {
				t.Errorf("week = %s, want %s", week, tt.wantWeek)
			}
		})
	}
}

func TestSpecialistLocalNow(t *testing.T) {
	// 2026-11-13 15:30 UTC is already Friday 18:30 in Moscow (UTC+3).
	now := utcTime(2026, time.November, 13, 15, 30)

	moscow := specialistLocalNow("Europe/Moscow", now)
	if moscow.Weekday() != time.Friday || moscow.Hour() != 18 {
		t.Fatalf("Moscow local time = %v, want Friday 18:xx", moscow)
	}
	if send, _ := decideWorkDaysReminder(moscow, "", 0); !send {
		t.Fatal("expected a reminder for Moscow at Friday 18:30 local")
	}

	utc := specialistLocalNow("", now)
	if utc.Hour() != 15 {
		t.Fatalf("empty timezone should fall back to UTC, got %v", utc)
	}
	if send, _ := decideWorkDaysReminder(utc, "", 0); send {
		t.Fatal("UTC specialist at Friday 15:30 must not be reminded yet")
	}

	if bogus := specialistLocalNow("Not/AZone", now); bogus.Hour() != 15 {
		t.Fatalf("unknown timezone should fall back to UTC, got %v", bogus)
	}
}
