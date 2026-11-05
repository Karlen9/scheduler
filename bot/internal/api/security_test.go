package api

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestAllowedOriginsForCORS(t *testing.T) {
	const prod = "https://scheduler.example.com"
	tests := []struct {
		name       string
		webAppURL  string
		configured []string
		want       []string
	}{
		{"production URL only", prod, nil, []string{prod}},
		{"trailing slash normalised", prod + "/", nil, []string{prod}},
		{"path normalised", prod + "/app/index?x=1", nil, []string{prod}},
		{"uppercase normalised", "HTTPS://Scheduler.Example.com/", nil, []string{prod}},
		{"port preserved", "https://scheduler.example.com:8443/x", nil, []string{"https://scheduler.example.com:8443"}},
		{"configured extras appended", prod, []string{"https://dashboard.example.com/", " https://admin.example.com "}, []string{prod, "https://dashboard.example.com", "https://admin.example.com"}},
		{"wildcards dropped", prod, []string{"*", "https://*.example.com", "https://ok.example.com"}, []string{prod, "https://ok.example.com"}},
		{"invalid entries dropped", prod, []string{"", "not a url", "ftp://files.example.com", "https://", "javascript:alert(1)"}, []string{prod}},
		{"deduped", prod, []string{prod, prod + "/", "https://a.example.com", "https://a.example.com"}, []string{prod, "https://a.example.com"}},
		{"no localhost with production URL", prod, nil, []string{prod}},
		{"no localhost with production URL and extras", prod, []string{"https://a.example.com"}, []string{prod, "https://a.example.com"}},
		{"empty URL allows dev origins", "", nil, []string{"http://localhost:3000", "http://127.0.0.1:3000"}},
		{"placeholder URL allows dev origins", "https://your-mini-app-url.com", nil, []string{"http://localhost:3000", "http://127.0.0.1:3000"}},
		{"loopback URL allows dev origins", "http://localhost:3000/", nil, []string{"http://localhost:3000", "http://127.0.0.1:3000"}},
		{"extras with empty URL", "", []string{"https://a.example.com"}, []string{"https://a.example.com", "http://localhost:3000", "http://127.0.0.1:3000"}},
		{"invalid URL yields no dev origins", "ht!tp://bad", nil, nil},
		{"wildcard WEB_APP_URL dropped", "*", nil, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := allowedOriginsForCORS(tt.webAppURL, tt.configured)
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("allowedOriginsForCORS(%q, %q) = %#v, want %#v", tt.webAppURL, tt.configured, got, tt.want)
			}
			for _, o := range got {
				if o == "*" {
					t.Fatal("wildcard origin must never be returned")
				}
			}
		})
	}
}

// With no valid origin the router must not install go-chi/cors, which treats an empty list as allow-all.
func TestCORSFailsClosedWithoutValidOrigins(t *testing.T) {
	prevURL, prevExtra := WebAppURL, CORSAllowedOrigins
	WebAppURL, CORSAllowedOrigins = "*", nil
	t.Cleanup(func() { WebAppURL, CORSAllowedOrigins = prevURL, prevExtra })

	h := NewRouter()
	const origin = "https://evil.example"

	preflight := httptest.NewRequest(http.MethodOptions, "/api/bookings", nil)
	preflight.RemoteAddr = "203.0.113.50:1000"
	preflight.Header.Set("Origin", origin)
	preflight.Header.Set("Access-Control-Request-Method", "POST")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, preflight)
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("preflight: Access-Control-Allow-Origin = %q, want none", got)
	}

	get := httptest.NewRequest(http.MethodGet, "/health", nil)
	get.RemoteAddr = "203.0.113.51:1000"
	get.Header.Set("Origin", origin)
	w = httptest.NewRecorder()
	h.ServeHTTP(w, get)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /health: got %d, want 200", w.Code)
	}
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("GET: Access-Control-Allow-Origin = %q, want none", got)
	}
}
