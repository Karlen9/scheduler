package telegram

import (
	"testing"
	"time"

	"scheduler-bot/internal/models"
)

func TestParseReferralPayload(t *testing.T) {
	tests := []struct {
		name    string
		payload string
		want    string
	}{
		{"empty", "", ""},
		{"whitespace", "   ", ""},
		{"ref prefix", "ref_abc123", "abc123"},
		{"ref prefix with padding", "  ref_abc123  ", "abc123"},
		{"bare code", "abc123", "abc123"},
		{"only prefix", "ref_", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseReferralPayload(tt.payload); got != tt.want {
				t.Fatalf("parseReferralPayload(%q) = %q, want %q", tt.payload, got, tt.want)
			}
		})
	}
}

func TestValidateReferralForIncomingUser(t *testing.T) {
	specialist := &models.Specialist{
		ID:             "spec-1",
		TelegramUserID: 100,
		ReferralCode:   "abc123",
		CreatedAt:      time.Now(),
	}

	tests := []struct {
		name       string
		specialist *models.Specialist
		incomingID int64
		payload    string
		want       string
	}{
		{"nil specialist", nil, 200, "ref_abc123", ""},
		{"empty payload", specialist, 200, "", ""},
		{"unknown code", specialist, 200, "ref_other", ""},
		{"specialist has no code", &models.Specialist{TelegramUserID: 100}, 200, "ref_abc123", ""},
		{"self-referral blocked", specialist, 100, "ref_abc123", ""},
		{"valid referral", specialist, 200, "ref_abc123", "abc123"},
		{"valid bare code", specialist, 200, "abc123", "abc123"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := validateReferralForIncomingUser(tt.specialist, tt.incomingID, tt.payload)
			if got != tt.want {
				t.Fatalf("validateReferralForIncomingUser() = %q, want %q", got, tt.want)
			}
		})
	}
}
