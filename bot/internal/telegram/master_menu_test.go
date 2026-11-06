package telegram

import (
	"strings"
	"testing"

	myI18n "scheduler-bot/internal/i18n"
)

func TestMasterHomeRegisteredText(t *testing.T) {
	tests := []struct {
		name     string
		lang     string
		username string
		menuText string
		wantLink bool
	}{
		{"ru with username", "ru", "testbot", "Здесь вы можете:", true},
		{"en with username", "en", "testbot", "Here you can:", true},
		{"ru empty username", "ru", "", "Здесь вы можете:", false},
		{"en empty username", "en", "", "Here you can:", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			loc := myI18n.NewLocalizer(tt.lang)
			got := masterHomeRegisteredText(loc, tt.username)
			t.Logf("rendered:\n%s", got)
			if !strings.Contains(got, tt.menuText) {
				t.Fatalf("missing menu text %q in %q", tt.menuText, got)
			}
			if tt.wantLink && !strings.Contains(got, "https://t.me/testbot") {
				t.Fatalf("missing bot link in %q", got)
			}
			if !tt.wantLink && strings.Contains(got, "t.me/") {
				t.Fatalf("unexpected link for empty username in %q", got)
			}
		})
	}
}
