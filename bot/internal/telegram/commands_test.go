package telegram

import (
	"testing"

	myI18n "scheduler-bot/internal/i18n"
)

func TestBookingSpecialistCommandsExcludeProfile(t *testing.T) {
	loc := myI18n.NewLocalizer("en")
	commands := localizeCommands(loc, bookingSpecialistCommandDefinitions)

	want := map[string]bool{"start": false, "admin": false, "help": false, "language": false}
	for _, cmd := range commands {
		if cmd.Command == "profile" {
			t.Fatalf("specialist commands should no longer include /profile")
		}
		if _, ok := want[cmd.Command]; ok {
			want[cmd.Command] = true
			if cmd.Description == "" {
				t.Fatalf("command %q description should not be empty", cmd.Command)
			}
		}
	}
	for cmd, found := range want {
		if !found {
			t.Fatalf("expected specialist commands to include /%s", cmd)
		}
	}
}

func TestMasterUserCommandsIncludeReplaceToken(t *testing.T) {
	loc := myI18n.NewLocalizer("en")
	commands := localizeCommands(loc, masterUserCommandDefinitions)

	foundReplace := false
	for _, cmd := range commands {
		if cmd.Command == "replacetoken" {
			foundReplace = true
			if cmd.Description == "" {
				t.Fatalf("replacetoken command description should not be empty")
			}
		}
	}

	if !foundReplace {
		t.Fatalf("expected master user commands to include /replacetoken")
	}
}
