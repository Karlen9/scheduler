package api_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"scheduler-bot/internal/api"
)

/***************************************************************************************************
* newLimitedRouter builds a router with the per-route limits enabled (the shared test router has
* them disabled because most tests reuse one Telegram user).
***************************************************************************************************/
func newLimitedRouter(t *testing.T) http.Handler {
	t.Helper()
	prev := api.SetRouteRateLimitsDisabledForTest(false)
	t.Cleanup(func() { api.SetRouteRateLimitsDisabledForTest(prev) })
	return api.NewRouter()
}

/***************************************************************************************************
* doRequestOn sends a signed request as the given Telegram user to an arbitrary handler, each from
* a distinct peer IP so the per-IP limit never interferes.
***************************************************************************************************/
func doRequestOn(h http.Handler, method, path, body string, telegramUserID int64) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.RemoteAddr = nextTestRemoteAddr()
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)
	req.Header.Set("X-Telegram-Init-Data", buildInitData(telegramUserID, "Limit User", testSpecialist.BotToken))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}

func TestBookingCreateIsRateLimitedPerUser(t *testing.T) {
	h := newLimitedRouter(t)
	const userA, userB = int64(880001), int64(880002)

	for i := 1; i <= 10; i++ {
		if w := doRequestOn(h, http.MethodPost, "/api/bookings", `{}`, userA); w.Code == http.StatusTooManyRequests {
			t.Fatalf("request %d by user A was rate limited, burst is 10", i)
		}
	}
	if w := doRequestOn(h, http.MethodPost, "/api/bookings", `{}`, userA); w.Code != http.StatusTooManyRequests {
		t.Fatalf("11th rapid request by user A: expected 429, got %d", w.Code)
	}
	if w := doRequestOn(h, http.MethodPost, "/api/bookings", `{}`, userB); w.Code == http.StatusTooManyRequests {
		t.Fatalf("user B must not be limited by user A's traffic, got 429")
	}
}

func TestClientBookingWriteLimiterIsSharedAcrossGroupRoutes(t *testing.T) {
	h := newLimitedRouter(t)
	const user = int64(880011)

	for i := 0; i < 6; i++ {
		doRequestOn(h, http.MethodPost, "/api/bookings", `{}`, user)
	}
	for i := 0; i < 4; i++ {
		doRequestOn(h, http.MethodPost, "/api/recurring", `{}`, user)
	}
	// 10 tokens spent across two routes: the reschedule route shares the same bucket.
	if w := doRequestOn(h, http.MethodPut, "/api/bookings/does-not-exist/reschedule", `{}`, user); w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 from the shared bucket, got %d", w.Code)
	}
	// Reads are not part of the group.
	if w := doRequestOn(h, http.MethodGet, "/api/bookings", "", user); w.Code == http.StatusTooManyRequests {
		t.Fatal("GET /api/bookings must not be limited by the write group")
	}
}

func TestSensitiveAdminActionsAreLimited(t *testing.T) {
	h := newLimitedRouter(t)
	owner := testSpecialist.TelegramUserID

	for i := 0; i < 3; i++ {
		if w := doRequestOn(h, http.MethodPost, "/api/admin/promocode/validate", `{}`, owner); w.Code == http.StatusTooManyRequests {
			t.Fatalf("promocode validate %d limited too early", i+1)
		}
	}
	for i := 0; i < 2; i++ {
		if w := doRequestOn(h, http.MethodPost, "/api/admin/subscription/checkout", `{}`, owner); w.Code == http.StatusTooManyRequests {
			t.Fatalf("checkout %d limited too early", i+1)
		}
	}
	// Burst of 5 is shared across the group.
	if w := doRequestOn(h, http.MethodPost, "/api/admin/promocode/validate", `{}`, owner); w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 on the 6th sensitive action, got %d", w.Code)
	}
}

func TestRouteLimitsAreNotAppliedInLoadTestMode(t *testing.T) {
	prevMode := api.LoadTestMode
	api.LoadTestMode = true
	t.Cleanup(func() { api.LoadTestMode = prevMode })

	h := newLimitedRouter(t)
	for i := 1; i <= 25; i++ {
		if w := doRequestOn(h, http.MethodPost, "/api/bookings", `{}`, 880021); w.Code == http.StatusTooManyRequests {
			t.Fatalf("request %d was rate limited in load test mode", i)
		}
	}
}

func TestCORSPreflightIsConfigurationDriven(t *testing.T) {
	prevURL, prevExtra := api.WebAppURL, api.CORSAllowedOrigins
	api.WebAppURL = "https://app.example.com/some/path/"
	api.CORSAllowedOrigins = []string{"https://dashboard.example.com", "*"}
	t.Cleanup(func() { api.WebAppURL, api.CORSAllowedOrigins = prevURL, prevExtra })

	h := api.NewRouter()
	preflight := func(origin string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodOptions, "/api/bookings", nil)
		req.RemoteAddr = nextTestRemoteAddr()
		req.Header.Set("Origin", origin)
		req.Header.Set("Access-Control-Request-Method", "POST")
		req.Header.Set("Access-Control-Request-Headers", "x-telegram-init-data,content-type")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		return w
	}

	for _, origin := range []string{"https://app.example.com", "https://dashboard.example.com"} {
		w := preflight(origin)
		if got := w.Header().Get("Access-Control-Allow-Origin"); got != origin {
			t.Fatalf("origin %s: Access-Control-Allow-Origin = %q, want exact origin", origin, got)
		}
		if got := w.Header().Get("Access-Control-Allow-Credentials"); got != "" {
			t.Fatalf("origin %s: Access-Control-Allow-Credentials must be absent, got %q", origin, got)
		}
	}

	for _, origin := range []string{"https://evil.example.com", "http://localhost:3000", "null"} {
		w := preflight(origin)
		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Fatalf("origin %s must not be allowed, got Access-Control-Allow-Origin %q", origin, got)
		}
		if got := w.Header().Get("Access-Control-Allow-Credentials"); got != "" {
			t.Fatalf("origin %s: Access-Control-Allow-Credentials must be absent, got %q", origin, got)
		}
	}
}
