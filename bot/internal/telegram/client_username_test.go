package telegram

import (
	"testing"

	"scheduler-bot/internal/crypto"
	"scheduler-bot/internal/db"
)

func setupClientUsernameTestDB(t *testing.T) {
	t.Helper()

	if db.DB != nil {
		_ = db.DB.Close()
	}
	if err := crypto.Init(""); err != nil {
		t.Fatalf("crypto.Init: %v", err)
	}
	if err := db.Init("file::memory:?cache=shared"); err != nil {
		t.Fatalf("db.Init: %v", err)
	}
}

func TestSyncClientTelegramUsernamePersistsObservedHandle(t *testing.T) {
	setupClientUsernameTestDB(t)

	specialist, err := db.CreateSpecialist(8001, "token-client-username", "clientusernamebot", "Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}

	client, err := db.CreateClient(9001, specialist.ID, "Alice")
	if err != nil {
		t.Fatalf("CreateClient: %v", err)
	}

	if changed := syncClientTelegramUsername(client, "@alice_handle"); !changed {
		t.Fatal("expected username sync to report a change")
	}

	got, err := db.GetClientByID(client.ID)
	if err != nil {
		t.Fatalf("GetClientByID: %v", err)
	}
	if got.TelegramUsername != "alice_handle" {
		t.Fatalf("expected stored username alice_handle, got %q", got.TelegramUsername)
	}

	if changed := syncClientTelegramUsername(got, "alice_handle"); changed {
		t.Fatal("expected unchanged username sync to report no change")
	}
}
