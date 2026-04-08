# API Security Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close auth bypass, add rate limiting, and harden the API against unauthenticated access and DoS.

**Architecture:** Remove DevAuthMiddleware entirely. Harden TelegramAuthMiddleware to reject empty initData and expired auth_date. Add per-IP and global rate limiting. Restrict CORS. Protect superadmin endpoint. For tests, replace dev auth with a TestAuthMiddleware that uses HMAC-signed initData so tests exercise real validation.

**Tech Stack:** Go, chi router, golang.org/x/time/rate, crypto/hmac

---

### Task 1: Add `golang.org/x/time` dependency

**Files:**

- Modify: `bot/go.mod`

**Step 1: Add the dependency**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go get golang.org/x/time/rate`

**Step 2: Verify**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`
Expected: compiles cleanly

**Step 3: Commit**

```bash
cd /Users/user/Documents/karlen/scheduler/bot
git add go.mod go.sum
git commit -m "deps: add golang.org/x/time for rate limiting"
```

---

### Task 2: Add `SuperadminSecret` to config

**Files:**

- Modify: `bot/internal/config/config.go:28-46` (Config struct)
- Modify: `bot/internal/config/config.go:48-104` (Load function)

**Step 1: Add field to Config struct (line 40, after EncryptionKey)**

Add this field to the Config struct:

```go
// Security
SuperadminSecret string // Bearer token for /superadmin/* endpoints
```

**Step 2: Read env var in Load() (after line 67)**

Add to the cfg initialization block:

```go
SuperadminSecret: os.Getenv("SUPERADMIN_SECRET"),
```

**Step 3: Verify compilation**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`
Expected: compiles cleanly

**Step 4: Commit**

```bash
cd /Users/user/Documents/karlen/scheduler/bot
git add internal/config/config.go
git commit -m "config: add SUPERADMIN_SECRET env var"
```

---

### Task 3: Create rate limiting middleware

**Files:**

- Create: `bot/internal/api/ratelimit.go`
- Test: `bot/internal/api/ratelimit_test.go`

**Step 1: Write the test**

Create `bot/internal/api/ratelimit_test.go`:

```go
package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPerIPRateLimiter(t *testing.T) {
	// Create a very restrictive limiter: 1 req/s, burst 2
	handler := PerIPRateLimitMiddleware(1, 2)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First 2 requests should succeed (burst)
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "1.2.3.4:1234"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i, w.Code)
		}
	}

	// 3rd request should be rate limited
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "1.2.3.4:1234"
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", w.Code)
	}

	// Different IP should still succeed
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "5.6.7.8:1234"
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("different IP: expected 200, got %d", w.Code)
	}
}

func TestGlobalRateLimiter(t *testing.T) {
	// Create a very restrictive limiter: 1 req/s, burst 2
	handler := GlobalRateLimitMiddleware(1, 2)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First 2 requests should succeed
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i, w.Code)
		}
	}

	// 3rd should be rate limited
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", w.Code)
	}
}
```

**Step 2: Run to verify tests fail**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go test ./internal/api/ -run TestPerIPRateLimiter -v`
Expected: FAIL — functions don't exist yet

**Step 3: Implement rate limiting**

Create `bot/internal/api/ratelimit.go`:

```go
package api

import (
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// GlobalRateLimitMiddleware limits total requests per second across all clients.
func GlobalRateLimitMiddleware(rps float64, burst int) func(http.Handler) http.Handler {
	limiter := rate.NewLimiter(rate.Limit(rps), burst)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !limiter.Allow() {
				log.Printf("Rate limit (global): rejected request from %s", r.RemoteAddr)
				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// PerIPRateLimitMiddleware limits requests per second per client IP.
func PerIPRateLimitMiddleware(rps float64, burst int) func(http.Handler) http.Handler {
	var mu sync.Mutex
	limiters := make(map[string]*rateLimiterEntry)

	// Background cleanup every 5 minutes
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			mu.Lock()
			now := time.Now()
			for ip, entry := range limiters {
				if now.Sub(entry.lastSeen) > 10*time.Minute {
					delete(limiters, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip, _, err := net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				ip = r.RemoteAddr
			}

			mu.Lock()
			entry, exists := limiters[ip]
			if !exists {
				entry = &rateLimiterEntry{
					limiter:  rate.NewLimiter(rate.Limit(rps), burst),
					lastSeen: time.Now(),
				}
				limiters[ip] = entry
			}
			entry.lastSeen = time.Now()
			mu.Unlock()

			if !entry.limiter.Allow() {
				log.Printf("Rate limit (per-IP): rejected request from %s", ip)
				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

type rateLimiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go test ./internal/api/ -run "TestPerIPRateLimiter|TestGlobalRateLimiter" -v`
Expected: PASS

**Step 5: Commit**

```bash
cd /Users/user/Documents/karlen/scheduler/bot
git add internal/api/ratelimit.go internal/api/ratelimit_test.go
git commit -m "feat: add global and per-IP rate limiting middleware"
```

---

### Task 4: Harden TelegramAuthMiddleware — reject empty initData + add auth_date expiry

**Files:**

- Modify: `bot/internal/api/middleware.go:48-121` (TelegramAuthMiddleware)
- Modify: `bot/internal/api/middleware.go:123-175` (validateInitData)

**Step 1: Modify `TelegramAuthMiddleware` to reject empty initData**

In `middleware.go`, replace lines 82-88 (the `if initData == ""` block):

```go
// OLD (lines 82-88):
if initData == "" {
    // For development, allow requests without auth
    log.Println("Warning: No Telegram initData provided")
    ctx := context.WithValue(r.Context(), SpecialistContextKey, specialist)
    next.ServeHTTP(w, r.WithContext(ctx))
    return
}

// NEW:
if initData == "" {
    log.Printf("Auth rejected: no initData from %s", r.RemoteAddr)
    http.Error(w, myI18n.T(localizerFromRequest(r), "Error.TelegramAuth"), http.StatusUnauthorized)
    return
}
```

**Step 2: Add auth_date validation to `validateInitData`**

Change the signature to accept a max age parameter:

```go
func validateInitData(initData, botToken string) (*TelegramUser, bool) {
```

Add auth_date check after hash validation succeeds (after line 161, before parsing user JSON):

```go
// Check auth_date is not too old (1 hour max)
if authDateStr := values.Get("auth_date"); authDateStr != "" {
    authDate, err := strconv.ParseInt(authDateStr, 10, 64)
    if err == nil {
        age := time.Now().Unix() - authDate
        if age > 3600 {
            log.Printf("Auth rejected: initData expired (age=%ds) from source", age)
            return nil, false
        }
    }
}
```

Add `"strconv"` and `"time"` to imports (strconv is already imported, time needs to be added).

**Step 3: Verify compilation**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`
Expected: compiles cleanly

**Step 4: Commit**

```bash
cd /Users/user/Documents/karlen/scheduler/bot
git add internal/api/middleware.go
git commit -m "security: reject empty initData, add auth_date expiry (1h)"
```

---

### Task 5: Remove DevAuthMiddleware

**Files:**

- Modify: `bot/internal/api/middleware.go:210-259` (delete DevAuthMiddleware function)
- Modify: `bot/internal/api/router.go:40` (remove DevAuthMiddleware usage)

**Step 1: Delete `DevAuthMiddleware` function**

Remove lines 210-259 from `middleware.go` (the entire `DevAuthMiddleware` function).

**Step 2: Remove from router**

In `router.go` line 40, delete this line:

```go
r.Use(DevAuthMiddleware(0))       // Fallback for dev
```

**Step 3: Verify compilation**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`
Expected: compiles cleanly

**Step 4: Commit**

```bash
cd /Users/user/Documents/karlen/scheduler/bot
git add internal/api/middleware.go internal/api/router.go
git commit -m "security: remove DevAuthMiddleware bypass"
```

---

### Task 6: Update test helpers to use real HMAC-signed initData

The existing tests use `DevAuthMiddleware` with `X-Dev-User-ID` header. Since we removed it, tests need to generate valid Telegram initData using the test specialist's bot token.

**Files:**

- Modify: `bot/internal/api/testhelper_test.go:67-99` (doRequest function)

**Step 1: Add a helper to generate signed initData**

Add this function to `testhelper_test.go` (before `doRequest`):

```go
// buildInitData generates a valid Telegram-signed initData string for testing.
func buildInitData(userID int64, firstName string, botToken string) string {
	user := fmt.Sprintf(`{"id":%d,"first_name":"%s","last_name":"","username":"test_%d"}`, userID, firstName, userID)
	authDate := fmt.Sprintf("%d", time.Now().Unix())

	// Build data check string (sorted keys)
	parts := []string{
		"auth_date=" + authDate,
		"user=" + user,
	}
	sort.Strings(parts)
	dataCheckString := strings.Join(parts, "\n")

	// Calculate HMAC using Telegram's algorithm
	secretKey := hmac.New(sha256.New, []byte("WebAppData"))
	secretKey.Write([]byte(botToken))
	secret := secretKey.Sum(nil)

	h := hmac.New(sha256.New, secret)
	h.Write([]byte(dataCheckString))
	hash := hex.EncodeToString(h.Sum(nil))

	// Build query string
	v := url.Values{}
	v.Set("user", user)
	v.Set("auth_date", authDate)
	v.Set("hash", hash)
	return v.Encode()
}
```

Add imports to the test file: `"crypto/hmac"`, `"crypto/sha256"`, `"encoding/hex"`, `"net/url"`, `"sort"`, `"time"`.

**Step 2: Update `doRequest` to use initData instead of X-Dev-User-ID**

Replace the `doRequest` function:

```go
func doRequest(t *testing.T, method, path string, body *string, telegramUserID int64) *httptest.ResponseRecorder {
	t.Helper()

	var reqBody *strings.Reader
	if body != nil {
		reqBody = strings.NewReader(*body)
	} else {
		reqBody = strings.NewReader("")
	}

	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)

	// Generate valid Telegram initData (signed HMAC)
	initData := buildInitData(telegramUserID, "Test User", testSpecialist.BotToken)
	req.Header.Set("X-Telegram-Init-Data", initData)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}
```

**Step 3: Update TestGetClientProfile expected name**

In `handlers_test.go` line 215, the test expects name "Dev User" which came from DevAuthMiddleware. Now it will be "Test User" from buildInitData. Change:

```go
// OLD:
if name, _ := profile["name"].(string); name != "Dev User" {
    t.Fatalf("expected name 'Dev User', got %q", name)
}

// NEW:
if name, _ := profile["name"].(string); name != "Test User" {
    t.Fatalf("expected name 'Test User', got %q", name)
}
```

**Step 4: Run all tests**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go test ./internal/api/ -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
cd /Users/user/Documents/karlen/scheduler/bot
git add internal/api/testhelper_test.go internal/api/handlers_test.go
git commit -m "test: replace dev auth with HMAC-signed initData in tests"
```

---

### Task 7: Protect superadmin endpoint

**Files:**

- Modify: `bot/internal/api/admin_handlers.go:1219-1239` (HandleListAllSpecialists)
- Modify: `bot/internal/api/router.go:34-35` (superadmin route)

**Step 1: Add SuperadminSecret package variable**

Add to `middleware.go` (or a new line near the top of `router.go`):

```go
// SuperadminSecret is set from config at startup. If empty, superadmin endpoints are disabled.
var SuperadminSecret string
```

**Step 2: Create superadmin auth middleware**

Add to `middleware.go`:

```go
// SuperadminAuthMiddleware checks the Authorization: Bearer <secret> header.
func SuperadminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if SuperadminSecret == "" {
			http.NotFound(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if auth == "" || auth != "Bearer "+SuperadminSecret {
			log.Printf("Superadmin auth rejected from %s", r.RemoteAddr)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

**Step 3: Wire up in router**

Replace line 35 in `router.go`:

```go
// OLD:
r.Get("/superadmin/specialists", HandleListAllSpecialists)

// NEW:
r.Route("/superadmin", func(r chi.Router) {
    r.Use(SuperadminAuthMiddleware)
    r.Get("/specialists", HandleListAllSpecialists)
})
```

**Step 4: Set SuperadminSecret in main.go**

In `main.go`, after config is loaded (where `api.NotifyBookingFunc` etc. are set), add:

```go
api.SuperadminSecret = cfg.SuperadminSecret
```

**Step 5: Verify compilation**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`
Expected: compiles cleanly

**Step 6: Commit**

```bash
cd /Users/user/Documents/karlen/scheduler/bot
git add internal/api/middleware.go internal/api/router.go internal/config/config.go main.go
git commit -m "security: protect /superadmin with bearer token auth"
```

---

### Task 8: Restructure router — CORS, rate limiting, security headers, photo route

**Files:**

- Modify: `bot/internal/api/router.go` (full file)
- Modify: `bot/internal/api/middleware.go` (add security headers)

**Step 1: Add SecurityHeadersMiddleware to `middleware.go`**

```go
// SecurityHeadersMiddleware adds security response headers.
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}
```

**Step 2: Add WebAppURL variable for CORS**

Add to `router.go` (near the top):

```go
// WebAppURL is set from config. Used to restrict CORS origins.
var WebAppURL string
```

**Step 3: Update router with rate limiting and restricted CORS**

Replace the `NewRouter` function in `router.go`:

```go
func NewRouter() http.Handler {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(SecurityHeadersMiddleware)

	// Rate limiting
	r.Use(GlobalRateLimitMiddleware(100, 200))
	r.Use(PerIPRateLimitMiddleware(20, 40))

	// CORS for mini-app
	allowedOrigins := []string{"*"}
	if WebAppURL != "" && WebAppURL != "https://your-mini-app-url.com" {
		allowedOrigins = []string{WebAppURL, "http://localhost:3000"}
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Telegram-Init-Data", "X-Specialist-ID", "X-Trainer-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Health check (no auth)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	})

	// Super admin (bearer token auth)
	r.Route("/superadmin", func(r chi.Router) {
		r.Use(SuperadminAuthMiddleware)
		r.Get("/specialists", HandleListAllSpecialists)
	})

	// Photo proxy (no auth — fileIds are unguessable Telegram tokens)
	r.Get("/api/photo/{fileId}", HandleGetPhoto)

	// API routes with Telegram auth
	r.Route("/api", func(r chi.Router) {
		r.Use(TelegramAuthMiddleware(""))
		r.Use(I18nMiddleware)

		r.Get("/specialist", HandleGetSpecialist)
		r.Get("/services", HandleGetServices)
		r.Get("/working-hours", HandleGetWorkingHours)
		r.Get("/availability", HandleGetAvailability)
		r.Get("/days-off", HandleGetPublicDaysOff)
		r.Get("/durations", HandleGetDurations)
		r.Get("/bookings", HandleGetBookings)
		r.Post("/bookings", HandleCreateBooking)
		r.Delete("/bookings/{id}", HandleCancelBooking)
		r.Put("/bookings/{id}/confirm", HandleClientConfirmBooking)
		r.Put("/bookings/{id}/decline", HandleClientDeclineBooking)

		r.Post("/upload/photo", HandleUploadPhoto)

		r.Get("/profile", HandleGetClientProfile)
		r.Put("/profile", HandleUpdateClientProfile)
		r.Put("/profile/notifications", HandleUpdateClientNotificationPrefs)

		r.Get("/recurring", HandleGetRecurringSchedules)
		r.Post("/recurring", HandleCreateRecurringSchedule)
		r.Post("/recurring/preview", HandlePreviewRecurringSchedule)
		r.Get("/recurring/{id}", HandleGetRecurringScheduleDetail)
		r.Delete("/recurring/{id}", HandleCancelRecurringSchedule)

		r.Put("/recurring/{scheduleId}/bookings/{bookingId}/cancel-request", HandleClientCancelRequest)
		r.Post("/recurring/{scheduleId}/bookings/{bookingId}/move", HandleClientMoveRequest)

		// Admin routes (specialist only)
		r.Route("/admin", func(r chi.Router) {
			r.Use(AdminAuthMiddleware)
			// ... all existing admin routes unchanged ...
		})
	})

	return r
}
```

Note: keep ALL existing admin sub-routes inside the `/admin` group exactly as they are now.

**Step 4: Set WebAppURL in main.go**

After config is loaded, add:

```go
api.WebAppURL = cfg.WebAppURL
```

**Step 5: Run tests**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go test ./... -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
cd /Users/user/Documents/karlen/scheduler/bot
git add internal/api/router.go internal/api/middleware.go main.go
git commit -m "security: add rate limiting, CORS restriction, security headers"
```

---

### Task 9: Add security-specific tests

**Files:**

- Modify: `bot/internal/api/handlers_test.go` (add security tests)

**Step 1: Write auth rejection tests**

Add to `handlers_test.go`:

```go
func TestRejectNoInitData(t *testing.T) {
	// Request without X-Telegram-Init-Data should get 401
	req := httptest.NewRequest(http.MethodGet, "/api/specialist", nil)
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)
	// No X-Telegram-Init-Data header

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without initData, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRejectInvalidInitData(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/specialist", nil)
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)
	req.Header.Set("X-Telegram-Init-Data", "hash=abc123&user=%7B%7D&auth_date=123")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with invalid initData, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRejectExpiredInitData(t *testing.T) {
	// Generate initData with auth_date 2 hours ago
	userID := int64(777777)
	user := fmt.Sprintf(`{"id":%d,"first_name":"Expired","last_name":"","username":"expired"}`, userID)
	authDate := fmt.Sprintf("%d", time.Now().Unix()-7200) // 2 hours ago

	parts := []string{
		"auth_date=" + authDate,
		"user=" + user,
	}
	sort.Strings(parts)
	dataCheckString := strings.Join(parts, "\n")

	secretKey := hmac.New(sha256.New, []byte("WebAppData"))
	secretKey.Write([]byte(testSpecialist.BotToken))
	secret := secretKey.Sum(nil)

	h := hmac.New(sha256.New, secret)
	h.Write([]byte(dataCheckString))
	hash := hex.EncodeToString(h.Sum(nil))

	v := url.Values{}
	v.Set("user", user)
	v.Set("auth_date", authDate)
	v.Set("hash", hash)
	initData := v.Encode()

	req := httptest.NewRequest(http.MethodGet, "/api/specialist", nil)
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)
	req.Header.Set("X-Telegram-Init-Data", initData)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with expired initData, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSuperadminRequiresAuth(t *testing.T) {
	// Without bearer token -> 401 (or 404 if secret not set)
	req := httptest.NewRequest(http.MethodGet, "/superadmin/specialists", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should be 404 (no SUPERADMIN_SECRET set in test) or 401
	if w.Code != http.StatusNotFound && w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 404 or 401 for superadmin without auth, got %d", w.Code)
	}
}
```

Add imports to the test file: `"crypto/hmac"`, `"crypto/sha256"`, `"encoding/hex"`, `"net/http/httptest"`, `"net/url"`, `"sort"`, `"time"` (some may already be imported).

**Step 2: Run all tests**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go test ./internal/api/ -v`
Expected: ALL PASS

**Step 3: Commit**

```bash
cd /Users/user/Documents/karlen/scheduler/bot
git add internal/api/handlers_test.go
git commit -m "test: add security tests for auth rejection and expiry"
```

---

### Task 10: Final verification

**Step 1: Run full test suite**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go test ./... -v`
Expected: ALL PASS

**Step 2: Build Docker image to verify production build**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build -o /dev/null ./...`
Expected: compiles cleanly

**Step 3: Manual smoke test (optional)**

Start the server and verify:

- `curl http://localhost:8080/health` → 200 OK
- `curl http://localhost:8080/api/specialist` → 401 Unauthorized
- `curl http://localhost:8080/superadmin/specialists` → 404 Not Found
- Rapid requests → 429 Too Many Requests
