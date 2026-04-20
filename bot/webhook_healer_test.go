package main

import (
	"context"
	"testing"
	"time"
)

func TestExpectedWebhookURL(t *testing.T) {
	tests := []struct {
		name    string
		baseURL string
		secret  string
		want    string
	}{
		{
			name:    "no trailing slash",
			baseURL: "https://example.com",
			secret:  "abc",
			want:    "https://example.com/tg/abc/webhook",
		},
		{
			name:    "trailing slash stripped",
			baseURL: "https://example.com/",
			secret:  "abc",
			want:    "https://example.com/tg/abc/webhook",
		},
		{
			name:    "multiple trailing slashes stripped",
			baseURL: "https://example.com///",
			secret:  "abc",
			want:    "https://example.com/tg/abc/webhook",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewBotManager("", tt.baseURL)
			if got := m.expectedWebhookURL(tt.secret); got != tt.want {
				t.Fatalf("expectedWebhookURL(%q) = %q, want %q", tt.secret, got, tt.want)
			}
		})
	}
}

// TestRunWebhookHealer_ExitsOnContextCancel verifies the loop respects context
// cancellation during its initial 30s grace period. The healer must never
// outlive the parent context.
func TestRunWebhookHealer_ExitsOnContextCancel(t *testing.T) {
	m := NewBotManager("", "https://example.com")

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		// Use a tiny interval so the grace period is the only thing holding us.
		m.RunWebhookHealer(ctx, time.Minute, 1)
		close(done)
	}()

	cancel()

	select {
	case <-done:
		// ok
	case <-time.After(2 * time.Second):
		t.Fatal("RunWebhookHealer did not exit within 2s of ctx cancellation")
	}
}
