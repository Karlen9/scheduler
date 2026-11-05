package api_test

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"scheduler-bot/internal/api"
)

/***************************************************************************************************
* doUnauthenticatedAdminRequest sends a GET to the real router with only the given extra headers:
* no X-Telegram-Init-Data is ever attached.
***************************************************************************************************/
func doUnauthenticatedAdminRequest(path string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.RemoteAddr = nextTestRemoteAddr()
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

/***************************************************************************************************
* Identity headers must never substitute for signed initData on admin routes, whatever their name:
* the specialist ID headers only select the tenant, and the dev/test user headers are not honoured
* outside load test mode (and the dev one does not exist at all).
***************************************************************************************************/
func TestAdminRoutesRejectHeaderOnlyIdentity(t *testing.T) {
	if api.LoadTestMode {
		t.Fatal("LoadTestMode must be false for this test")
	}

	tgID := strconv.FormatInt(testSpecialist.TelegramUserID, 10)
	cases := []struct {
		name    string
		headers map[string]string
	}{
		{"X-Specialist-ID only", map[string]string{"X-Specialist-ID": testSpecialist.ID}},
		{"X-Trainer-ID only", map[string]string{"X-Trainer-ID": testSpecialist.ID}},
		{"X-Dev-User-ID", map[string]string{"X-Specialist-ID": testSpecialist.ID, "X-Dev-User-ID": tgID}},
		{"X-Test-User-ID with LoadTestMode off", map[string]string{"X-Specialist-ID": testSpecialist.ID, "X-Test-User-ID": tgID}},
	}

	for _, path := range []string{"/api/admin/bookings", "/api/admin/profile"} {
		for _, tc := range cases {
			t.Run(path+" "+tc.name, func(t *testing.T) {
				w := doUnauthenticatedAdminRequest(path, tc.headers)
				if w.Code != http.StatusUnauthorized {
					t.Fatalf("expected exactly 401, got %d: %s", w.Code, w.Body.String())
				}
			})
		}
	}
}

func TestAdminProfileRejectsNonOwnerWithValidInitData(t *testing.T) {
	w := doClientRequest(t, http.MethodGet, "/api/admin/profile", nil, 555001)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-owner with valid initData, got %d: %s", w.Code, w.Body.String())
	}

	w = doAdminRequest(t, http.MethodGet, "/api/admin/profile", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for the owner, got %d: %s", w.Code, w.Body.String())
	}
}

/***************************************************************************************************
* A specialist row with an empty bot token must not accept initData signed with the empty key.
***************************************************************************************************/
func TestEmptyBotTokenInitDataIsRejected(t *testing.T) {
	forged := buildInitData(testSpecialist.TelegramUserID, "Forger", "")
	req := httptest.NewRequest(http.MethodGet, "/api/admin/profile", nil)
	req.RemoteAddr = nextTestRemoteAddr()
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)
	req.Header.Set("X-Telegram-Init-Data", forged)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("initData signed with an empty key must be rejected with 401, got %d", w.Code)
	}
}

/***************************************************************************************************
* Superadmin auth must answer exactly 401 for missing/wrong bearers, including unrouted paths
* under /superadmin, and 200 for the right bearer.
***************************************************************************************************/
func TestSuperadminStrictAuth(t *testing.T) {
	prev := api.SuperadminSecret
	api.SuperadminSecret = "strict-superadmin-secret"
	defer func() { api.SuperadminSecret = prev }()

	do := func(path, auth string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.RemoteAddr = nextTestRemoteAddr()
		if auth != "" {
			req.Header.Set("Authorization", auth)
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}

	for _, path := range []string{"/superadmin/specialists", "/superadmin/trainers"} {
		if w := do(path, ""); w.Code != http.StatusUnauthorized {
			t.Fatalf("GET %s without Authorization: expected exactly 401, got %d", path, w.Code)
		}
		if w := do(path, "Bearer wrong-secret"); w.Code != http.StatusUnauthorized {
			t.Fatalf("GET %s with wrong bearer: expected exactly 401, got %d", path, w.Code)
		}
	}

	if w := do("/superadmin/specialists", "Bearer "+api.SuperadminSecret); w.Code != http.StatusOK {
		t.Fatalf("GET /superadmin/specialists with the right bearer: expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
