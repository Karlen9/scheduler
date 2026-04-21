package api_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* deleteAsSpecialist sends a DELETE with JSON body authenticated as a specific specialist (rather
* than the shared testSpecialist), so the cascade test can exercise a throwaway bot without
* destroying other tests' state.
***************************************************************************************************/
func deleteAsSpecialist(t *testing.T, path, body string, spec *models.Specialist) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest("DELETE", path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Specialist-ID", spec.ID)
	req.Header.Set("X-Telegram-Init-Data", buildInitData(spec.TelegramUserID, "Test", spec.BotToken))
	/***************************************************************************************************
	* Per-test RemoteAddr so we don't share a rate-limit bucket with the rest of the suite.
	***************************************************************************************************/
	req.RemoteAddr = fmt.Sprintf("203.0.113.%d:55555", spec.TelegramUserID%200+10)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestAdminDeleteBot_RejectsWrongPhrase(t *testing.T) {
	body := `{"confirm":"nope"}`
	w := deleteAsSpecialist(t, "/api/admin/specialist", body, testSpecialist)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for wrong confirm phrase, got %d (body: %s)", w.Code, w.Body.String())
	}

	spec, err := db.GetSpecialistByID(testSpecialist.ID)
	if err != nil || spec == nil {
		t.Fatalf("get specialist: %v", err)
	}
	if !spec.IsActive {
		t.Fatal("specialist should remain active after a rejected delete")
	}
}

func TestAdminDeleteBot_AcceptsExactPhraseAndCascades(t *testing.T) {
	/***************************************************************************************************
	* Seed a throwaway specialist + client so we don't destroy testSpecialist, which is shared with
	* every other test in this package.
	***************************************************************************************************/
	spec, err := db.CreateSpecialist(999001, "delete-me-token", "deletebot", "Delete Me", "UTC", 24)
	if err != nil {
		t.Fatalf("create specialist: %v", err)
	}
	client, err := db.CreateClient(999002, spec.ID, "To Be Deleted")
	if err != nil {
		t.Fatalf("create client: %v", err)
	}

	// Whitespace + casing must be normalised; either language phrase is accepted.
	body := `{"confirm":"  Delete My Bot  "}`
	w := deleteAsSpecialist(t, "/api/admin/specialist", body, spec)
	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d (body: %s)", w.Code, w.Body.String())
	}

	row, err := db.GetSpecialistByID(spec.ID)
	if err != nil || row == nil {
		t.Fatalf("specialist row must remain for stats: err=%v row=%v", err, row)
	}
	if row.IsActive {
		t.Fatal("specialist must be marked inactive")
	}
	if row.DeletedAt == nil {
		t.Fatal("specialist deleted_at must be set")
	}
	if row.Name != "Delete Me" {
		t.Fatalf("name must be preserved for stats, got %q", row.Name)
	}
	if row.Phone != "" || row.Bio != "" {
		t.Fatal("PII fields must be cleared")
	}

	gone, err := db.GetClientByID(client.ID)
	if err != nil {
		t.Fatalf("get client: %v", err)
	}
	if gone != nil {
		t.Fatal("client should have been cascade-deleted")
	}

	active, err := db.GetAllActiveSpecialists()
	if err != nil {
		t.Fatalf("list active: %v", err)
	}
	for _, s := range active {
		if s.ID == spec.ID {
			t.Fatal("deleted specialist must not appear in GetAllActiveSpecialists")
		}
	}
}

func TestAdminDeleteBot_RussianPhraseAccepted(t *testing.T) {
	spec, err := db.CreateSpecialist(999003, "delete-me-token-ru", "deletebotru", "Delete Me RU", "UTC", 24)
	if err != nil {
		t.Fatalf("create specialist: %v", err)
	}
	body := `{"confirm":"удалить бота"}`
	w := deleteAsSpecialist(t, "/api/admin/specialist", body, spec)
	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for Russian phrase, got %d (body: %s)", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* After a successful delete, any subsequent authenticated API request (same specialist, same bot
* token, same valid initData) must be refused with 410 Gone. The Telegram "Open" button in the
* chat will keep launching the Mini App otherwise and the specialist/clients would retain full
* access.
***************************************************************************************************/
func TestAdminDeleteBot_SubsequentRequestsReturn410(t *testing.T) {
	spec, err := db.CreateSpecialist(999004, "delete-me-token-410", "deletebot410", "Delete Me 410", "UTC", 24)
	if err != nil {
		t.Fatalf("create specialist: %v", err)
	}

	body := `{"confirm":"delete my bot"}`
	w := deleteAsSpecialist(t, "/api/admin/specialist", body, spec)
	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204 on delete, got %d (body: %s)", w.Code, w.Body.String())
	}

	/***************************************************************************************************
	* Any authenticated endpoint will do — /api/specialist is the cheapest.
	***************************************************************************************************/
	req := httptest.NewRequest("GET", "/api/specialist", nil)
	req.Header.Set("X-Specialist-ID", spec.ID)
	req.Header.Set("X-Telegram-Init-Data", buildInitData(spec.TelegramUserID, "Test", spec.BotToken))
	req.RemoteAddr = fmt.Sprintf("203.0.113.%d:55555", spec.TelegramUserID%200+10)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusGone {
		t.Fatalf("expected 410 after delete, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}
