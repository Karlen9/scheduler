package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Implements the test per iprate limiter logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestPerIPRateLimiter(t *testing.T) {
	/***************************************************************************************************
	* Create a very restrictive limiter: 1 req/s, burst 2.
	***************************************************************************************************/
	handler := PerIPRateLimitMiddleware(1, 2)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	/***************************************************************************************************
	* First 2 requests should succeed (burst).
	***************************************************************************************************/
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "1.2.3.4:1234"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i, w.Code)
		}
	}

	/***************************************************************************************************
	* 3rd request should be rate limited.
	***************************************************************************************************/
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "1.2.3.4:1234"
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", w.Code)
	}

	/***************************************************************************************************
	* Different IP should still succeed.
	***************************************************************************************************/
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "5.6.7.8:1234"
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("different IP: expected 200, got %d", w.Code)
	}
}

func TestPerIPRateLimiterIgnoresForwardedIPHeaders(t *testing.T) {
	handler := PerIPRateLimitMiddleware(1, 2)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i, spoofed := range []string{"127.0.0.1", "10.0.0.5"} {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "1.2.3.4:1234"
		req.Header.Set("X-Forwarded-For", spoofed)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("spoofed request %d: expected 200, got %d", i, w.Code)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "1.2.3.4:1234"
	req.Header.Set("X-Forwarded-For", "203.0.113.200")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after burst exhausted despite spoofed forwarded IPs, got %d", w.Code)
	}
}

/***************************************************************************************************
* Implements the test global rate limiter logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func TestGlobalRateLimiter(t *testing.T) {
	/***************************************************************************************************
	* Create a very restrictive limiter: 1 req/s, burst 2.
	***************************************************************************************************/
	handler := GlobalRateLimitMiddleware(1, 2)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	/***************************************************************************************************
	* First 2 requests should succeed.
	***************************************************************************************************/
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i, w.Code)
		}
	}

	/***************************************************************************************************
	* 3rd should be rate limited.
	***************************************************************************************************/
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", w.Code)
	}
}

func TestClientIP(t *testing.T) {
	tests := []struct {
		name string
		peer string
		xff  []string
		want string
	}{
		{"public peer ignores XFF", "1.2.3.4:5555", []string{"9.9.9.9"}, "1.2.3.4"},
		{"public peer ignores spoofed loopback XFF", "1.2.3.4:5555", []string{"127.0.0.1"}, "1.2.3.4"},
		{"loopback peer uses XFF", "127.0.0.1:5555", []string{"1.1.1.1"}, "1.1.1.1"},
		{"private peer ignores spoofed left entry", "172.18.0.3:5555", []string{"6.6.6.6, 8.8.8.8"}, "8.8.8.8"},
		{"loopback peer skips private right entries", "127.0.0.1:5555", []string{"8.8.8.8, 10.0.0.2"}, "8.8.8.8"},
		{"multiple XFF header lines are joined", "10.0.0.1:1", []string{"6.6.6.6", "8.8.8.8"}, "8.8.8.8"},
		{"garbage XFF falls back to peer", "127.0.0.1:5555", []string{"not-an-ip"}, "127.0.0.1"},
		{"garbage right entry stops the walk", "127.0.0.1:5555", []string{"8.8.8.8, garbage"}, "127.0.0.1"},
		{"garbage left entry is never reached", "127.0.0.1:5555", []string{"garbage, 8.8.8.8"}, "8.8.8.8"},
		{"only private entries fall back to peer", "127.0.0.1:5555", []string{"10.0.0.2, 192.168.1.5"}, "127.0.0.1"},
		{"no XFF", "127.0.0.1:5555", nil, "127.0.0.1"},
		{"empty XFF", "127.0.0.1:5555", []string{" "}, "127.0.0.1"},
		{"ipv6 client behind proxy", "[::1]:5555", []string{"2001:db8::7"}, "2001:db8::7"},
		{"peer without port", "1.2.3.4", []string{"9.9.9.9"}, "1.2.3.4"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.RemoteAddr = tt.peer
			for _, v := range tt.xff {
				req.Header.Add("X-Forwarded-For", v)
			}
			req.Header.Set("X-Real-IP", "7.7.7.7")
			if got := clientIP(req); got != tt.want {
				t.Fatalf("clientIP = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestPerIPRateLimiterUsesForwardedClientBehindProxy(t *testing.T) {
	handler := PerIPRateLimitMiddleware(1, 1)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	do := func(xff string) int {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "172.18.0.2:1234" // Caddy on the docker network
		req.Header.Set("X-Forwarded-For", xff)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		return w.Code
	}

	if do("203.0.113.5") != http.StatusOK {
		t.Fatal("first client should pass")
	}
	if do("203.0.113.5") != http.StatusTooManyRequests {
		t.Fatal("same client should be limited")
	}
	if do("203.0.113.6") != http.StatusOK {
		t.Fatal("a different client behind the same proxy must have its own bucket")
	}
	// Rotating the attacker-controlled left entry must not buy a fresh bucket.
	if do("1.1.1.1, 203.0.113.5") != http.StatusTooManyRequests {
		t.Fatal("spoofed leftmost XFF entry must not create a new bucket")
	}
}

func requestAsUser(userID int64, remoteAddr string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.RemoteAddr = remoteAddr
	ctx := context.WithValue(req.Context(), TelegramUserContextKey, &TelegramUser{ID: userID})
	return req.WithContext(ctx)
}

func TestPerClientRateLimiterIsolatesUsersOnOneIP(t *testing.T) {
	handler := PerClientRateLimitMiddleware(1, 2)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	do := func(req *http.Request) int {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		return w.Code
	}

	const sharedIP = "203.0.113.9:4000"
	for i := 0; i < 2; i++ {
		if code := do(requestAsUser(1001, sharedIP)); code != http.StatusOK {
			t.Fatalf("user 1001 request %d: got %d, want 200", i, code)
		}
	}
	if code := do(requestAsUser(1001, sharedIP)); code != http.StatusTooManyRequests {
		t.Fatalf("user 1001 over burst: got %d, want 429", code)
	}
	if code := do(requestAsUser(1002, sharedIP)); code != http.StatusOK {
		t.Fatalf("user 1002 on the same IP must be unaffected, got %d", code)
	}
}

func TestPerClientRateLimiterKeyFallbacks(t *testing.T) {
	handler := PerClientRateLimitMiddleware(1, 1)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	do := func(req *http.Request) int {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		return w.Code
	}

	// Client in context without a Telegram user (e.g. load-test style auth) is keyed by its Telegram ID.
	asClient := func(id int64) *http.Request {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.RemoteAddr = "203.0.113.9:1"
		return req.WithContext(context.WithValue(req.Context(), ClientContextKey, &models.Client{TelegramUserID: id}))
	}
	if do(asClient(2001)) != http.StatusOK || do(asClient(2001)) != http.StatusTooManyRequests {
		t.Fatal("client-context fallback should limit per Telegram ID")
	}
	if do(asClient(2002)) != http.StatusOK {
		t.Fatal("another client ID on the same IP must pass")
	}

	// No identity at all: falls back to the client IP.
	anon := func(addr string) *http.Request {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.RemoteAddr = addr
		return req
	}
	if do(anon("198.51.100.1:1")) != http.StatusOK || do(anon("198.51.100.1:2")) != http.StatusTooManyRequests {
		t.Fatal("anonymous requests should be limited per IP")
	}
	if do(anon("198.51.100.2:1")) != http.StatusOK {
		t.Fatal("a different IP must pass")
	}
}

func TestRateKeysAreNamespaced(t *testing.T) {
	if userRateKey(1) == ipRateKey("1") || userRateKey(8) == ipRateKey("8") {
		t.Fatal("user keys must not collide with IP keys")
	}
}
