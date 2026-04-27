package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
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
