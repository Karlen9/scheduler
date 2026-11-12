package api

import (
	"testing"
	"time"
)

func TestPreviousWeekMonday(t *testing.T) {
	tests := []struct {
		name  string
		today string
		want  string
	}{
		{"monday", "2026-11-16", "2026-11-09"},
		{"tuesday", "2026-11-17", "2026-11-09"},
		{"wednesday", "2026-11-12", "2026-11-02"},
		{"sunday", "2026-11-22", "2026-11-09"},
		{"month boundary", "2026-12-02", "2026-11-23"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			today, _ := time.Parse("2006-01-02", tt.today)
			got := previousWeekMonday(today)
			if got.Format("2006-01-02") != tt.want || got.Weekday() != time.Monday {
				t.Fatalf("previousWeekMonday(%s) = %s (%s), want %s", tt.today, got.Format("2006-01-02"), got.Weekday(), tt.want)
			}
		})
	}
}
