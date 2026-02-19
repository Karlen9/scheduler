package models

import (
	"encoding/json"
	"testing"
	"time"
)

func TestDayOffMarshalJSON(t *testing.T) {
	tests := []struct {
		name         string
		dayOff       DayOff
		expectedDate string
	}{
		{
			name: "formats date as YYYY-MM-DD",
			dayOff: DayOff{
				ID:        "test-id-1",
				Date:      time.Date(2026, 3, 15, 10, 30, 0, 0, time.UTC),
				Reason:    "Отпуск",
				CreatedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			},
			expectedDate: "2026-03-15",
		},
		{
			name: "zero time value",
			dayOff: DayOff{
				ID:        "test-id-2",
				Date:      time.Time{},
				CreatedAt: time.Time{},
			},
			expectedDate: "0001-01-01",
		},
		{
			name: "omits empty reason",
			dayOff: DayOff{
				ID:        "test-id-3",
				Date:      time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC),
				Reason:    "",
				CreatedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			},
			expectedDate: "2026-12-31",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.dayOff)
			if err != nil {
				t.Fatalf("MarshalJSON() error: %v", err)
			}

			var result map[string]interface{}
			if err := json.Unmarshal(data, &result); err != nil {
				t.Fatalf("failed to unmarshal result: %v", err)
			}

			gotDate, ok := result["date"].(string)
			if !ok {
				t.Fatal("date field is not a string")
			}
			if gotDate != tt.expectedDate {
				t.Errorf("date = %q, want %q", gotDate, tt.expectedDate)
			}

			// Verify id is present
			if gotID, _ := result["id"].(string); gotID != tt.dayOff.ID {
				t.Errorf("id = %q, want %q", gotID, tt.dayOff.ID)
			}

			// Verify reason omitted when empty
			if tt.dayOff.Reason == "" {
				if _, exists := result["reason"]; exists {
					t.Error("expected reason to be omitted when empty")
				}
			} else {
				if gotReason, _ := result["reason"].(string); gotReason != tt.dayOff.Reason {
					t.Errorf("reason = %q, want %q", gotReason, tt.dayOff.Reason)
				}
			}
		})
	}
}
