package telegram

import (
	"testing"

	myI18n "scheduler-bot/internal/i18n"
)

func TestBookingSpecialistCommandsIncludeProfile(t *testing.T) {
	loc := myI18n.NewLocalizer("en")
	commands := localizeCommands(loc, bookingSpecialistCommandDefinitions)

	foundProfile := false
	for _, cmd := range commands {
		if cmd.Command == "profile" {
			foundProfile = true
			if cmd.Description == "" {
				t.Fatalf("profile command description should not be empty")
			}
		}
	}

	if !foundProfile {
		t.Fatalf("expected specialist commands to include /profile")
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
