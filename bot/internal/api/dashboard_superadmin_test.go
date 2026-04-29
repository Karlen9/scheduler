package api_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/db"
)

func doDashboardRequest(t *testing.T, method, path string, body *string, token string) *httptest.ResponseRecorder {
	t.Helper()
	reader := strings.NewReader("")
	if body != nil {
		reader = strings.NewReader(*body)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestDashboardSuperadminRequiresAuthAndDoesNotLeakSecrets(t *testing.T) {
	api.SuperadminSecret = "dashboard-secret"

	w := doDashboardRequest(t, http.MethodGet, "/superadmin/dashboard/overview", nil, "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected dashboard overview without auth to return 401, got %d", w.Code)
	}

	w = doDashboardRequest(t, http.MethodGet, "/superadmin/dashboard/specialists/"+testSpecialist.ID+"/snapshot", nil, api.SuperadminSecret)
	if w.Code != http.StatusOK {
		t.Fatalf("expected dashboard snapshot to return 200, got %d: %s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if strings.Contains(body, testSpecialist.BotToken) || strings.Contains(body, testSpecialist.WebhookSecret) || strings.Contains(body, "webhookSecret") {
		t.Fatalf("dashboard snapshot leaked a sensitive field: %s", body)
	}
}

func TestDashboardSpecialistRoutesAreScopedToPathSpecialist(t *testing.T) {
	api.SuperadminSecret = "dashboard-secret"

	other, err := db.CreateSpecialist(922222, "other-token", "otherbot", "Other Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}
	service, err := db.CreateSessionType(testSpecialist.ID, "dashboard-scope", "Dashboard Scope", 60, 1200, "USD", "")
	if err != nil {
		t.Fatalf("CreateSessionType: %v", err)
	}

	body := `{"name":"Should Not Update"}`
	w := doDashboardRequest(t, http.MethodPut, "/superadmin/dashboard/specialists/"+other.ID+"/services/"+service.ID, &body, api.SuperadminSecret)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected cross-specialist service update to return 404, got %d: %s", w.Code, w.Body.String())
	}

	w = doDashboardRequest(t, http.MethodGet, "/superadmin/dashboard/specialists/"+other.ID+"/snapshot", nil, api.SuperadminSecret)
	if w.Code != http.StatusOK {
		t.Fatalf("expected other specialist snapshot to return 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), other.ID) || strings.Contains(w.Body.String(), service.ID) {
		t.Fatalf("snapshot was not scoped to the requested specialist: %s", w.Body.String())
	}
}
