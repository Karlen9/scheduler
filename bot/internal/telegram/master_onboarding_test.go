package telegram

import (
	"net/http"
	"strings"
	"testing"

	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
)

/***************************************************************************************************
* While the app is free the legal documents are hidden: after the name step the master bot creates
* the specialist right away instead of asking for Terms / Privacy consent.
***************************************************************************************************/
func TestHandleNameInputSkipsConsentWhenNotRequired(t *testing.T) {
	if requireOnboardingConsent {
		t.Skip("consent step is enabled")
	}
	setupMasterSupportTestDB(t)

	transport := &recordingTransport{}
	previousTransport := http.DefaultTransport
	http.DefaultTransport = transport
	defer func() { http.DefaultTransport = previousTransport }()

	previousHook := OnSpecialistCreated
	OnSpecialistCreated = nil
	defer func() { OnSpecialistCreated = previousHook }()

	handler := NewMasterHandler(&Bot{ID: 9000, Token: "master-token"}, "https://api.example.com", "https://app.example.com", nil, 0)
	const userID = int64(880001)
	session := &OnboardingSession{State: StateAwaitingName, BotToken: "123:onboarding-token", BotUsername: "onboardingbot"}
	handler.setSession(userID, session)

	handler.handleNameInput(userID, userID, "Alice Trainer", session, "alice", myI18n.NewLocalizer("en"))

	specialist, err := db.GetSpecialistByTelegramID(userID)
	if err != nil || specialist == nil {
		t.Fatalf("expected specialist created without consent step, err=%v", err)
	}
	if got := handler.getSession(userID); got != nil {
		t.Fatalf("expected onboarding session cleared, got state %v", got.State)
	}
	for _, call := range transport.calls {
		if strings.Contains(call.body, "/terms") || strings.Contains(call.body, "/privacy") {
			t.Fatalf("expected no consent prompt to be sent, got %s", call.body)
		}
	}
}
