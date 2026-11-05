package main

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"scheduler-bot/internal/telegram"
)

type fakeUpdateHandler struct {
	got chan telegram.Update
}

func newFakeUpdateHandler() *fakeUpdateHandler {
	return &fakeUpdateHandler{got: make(chan telegram.Update, 4)}
}

func (f *fakeUpdateHandler) HandleUpdate(u telegram.Update) { f.got <- u }

func (f *fakeUpdateHandler) expectDispatch(t *testing.T) {
	t.Helper()
	select {
	case <-f.got:
	case <-time.After(2 * time.Second):
		t.Fatal("handler was not invoked within 2s")
	}
}

func (f *fakeUpdateHandler) expectNoDispatch(t *testing.T) {
	t.Helper()
	select {
	case <-f.got:
		t.Fatal("handler was invoked unexpectedly")
	case <-time.After(100 * time.Millisecond):
	}
}

const (
	testSpecialistSecret = "specialist-secret-0123456789abcdef"
	testMasterSecret     = "master-secret-0123456789abcdef"
	testBody             = `{"update_id":1}`
)

type webhookFixture struct {
	handler    http.Handler
	specialist *fakeUpdateHandler
	master     *fakeUpdateHandler
	nextCalls  int
	mu         sync.Mutex
}

func newWebhookFixture(withMaster bool) *webhookFixture {
	fx := &webhookFixture{specialist: newFakeUpdateHandler(), master: newFakeUpdateHandler()}
	resolve := func(secret string) updateHandler {
		if secret == testSpecialistSecret {
			return fx.specialist
		}
		return nil
	}
	var master updateHandler
	if withMaster {
		master = fx.master
	}
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fx.mu.Lock()
		fx.nextCalls++
		fx.mu.Unlock()
		w.WriteHeader(http.StatusTeapot)
	})
	fx.handler = newWebhookHandler(resolve, testMasterSecret, master, next)
	return fx
}

func (fx *webhookFixture) do(method, path, header string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(testBody))
	if header != "" {
		req.Header.Set("X-Telegram-Bot-Api-Secret-Token", header)
	}
	w := httptest.NewRecorder()
	fx.handler.ServeHTTP(w, req)
	return w
}

func TestWebhookSpecialistNewPath(t *testing.T) {
	fx := newWebhookFixture(true)

	w := fx.do(http.MethodPost, "/tg/webhook", testSpecialistSecret)
	if w.Code != http.StatusOK {
		t.Fatalf("good secret: got %d, want 200", w.Code)
	}
	fx.specialist.expectDispatch(t)

	w = fx.do(http.MethodPost, "/tg/webhook", "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("missing header: got %d, want 401", w.Code)
	}
	fx.specialist.expectNoDispatch(t)

	w = fx.do(http.MethodPost, "/tg/webhook", "unknown-secret-value")
	if w.Code != http.StatusOK || w.Body.Len() != 0 {
		t.Fatalf("unknown secret: got %d body=%q, want 200 with empty body", w.Code, w.Body.String())
	}
	fx.specialist.expectNoDispatch(t)
}

func TestWebhookShortSecretsDoNotPanic(t *testing.T) {
	fx := newWebhookFixture(true)

	if w := fx.do(http.MethodPost, "/tg/webhook", "ab"); w.Code != http.StatusOK {
		t.Fatalf("short secret on new path: got %d, want 200", w.Code)
	}
	if w := fx.do(http.MethodPost, "/tg/ab/webhook", "ab"); w.Code != http.StatusOK {
		t.Fatalf("short secret on legacy path: got %d, want 200", w.Code)
	}
	if w := fx.do(http.MethodPost, "/tg/a/webhook", "b"); w.Code != http.StatusUnauthorized {
		t.Fatalf("short mismatching secret on legacy path: got %d, want 401", w.Code)
	}
	fx.specialist.expectNoDispatch(t)
}

func TestWebhookSpecialistLegacyPath(t *testing.T) {
	fx := newWebhookFixture(true)

	w := fx.do(http.MethodPost, "/tg/"+testSpecialistSecret+"/webhook", testSpecialistSecret)
	if w.Code != http.StatusOK {
		t.Fatalf("legacy match: got %d, want 200", w.Code)
	}
	fx.specialist.expectDispatch(t)

	w = fx.do(http.MethodPost, "/tg/"+testSpecialistSecret+"/webhook", "something-else")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("legacy mismatch: got %d, want 401", w.Code)
	}
	w = fx.do(http.MethodPost, "/tg/"+testSpecialistSecret+"/webhook", "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("legacy missing header: got %d, want 401", w.Code)
	}
	// Empty path segment must not match an empty header.
	w = fx.do(http.MethodPost, "/tg//webhook", "")
	if w.Code != http.StatusUnauthorized && w.Code != http.StatusNotFound {
		t.Fatalf("empty path secret: got %d, want 401/404", w.Code)
	}
	fx.specialist.expectNoDispatch(t)
}

func TestWebhookMasterRoutes(t *testing.T) {
	fx := newWebhookFixture(true)

	cases := []struct {
		name   string
		path   string
		header string
		want   int
	}{
		{"new good", "/master/webhook", testMasterSecret, http.StatusOK},
		{"new bad header", "/master/webhook", "wrong", http.StatusUnauthorized},
		{"new missing header", "/master/webhook", "", http.StatusUnauthorized},
		{"legacy good", "/master/" + testMasterSecret + "/webhook", testMasterSecret, http.StatusOK},
		{"legacy bad path", "/master/wrong/webhook", testMasterSecret, http.StatusUnauthorized},
		{"legacy bad header", "/master/" + testMasterSecret + "/webhook", "wrong", http.StatusUnauthorized},
		{"legacy missing header", "/master/" + testMasterSecret + "/webhook", "", http.StatusUnauthorized},
		{"malformed", "/master/a/b/c", testMasterSecret, http.StatusNotFound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := fx.do(http.MethodPost, tc.path, tc.header)
			if w.Code != tc.want {
				t.Fatalf("got %d, want %d", w.Code, tc.want)
			}
			if tc.want == http.StatusOK {
				fx.master.expectDispatch(t)
			} else {
				fx.master.expectNoDispatch(t)
			}
		})
	}
	fx.specialist.expectNoDispatch(t)
}

func TestWebhookMasterNilFallsThrough(t *testing.T) {
	fx := newWebhookFixture(false)

	w := fx.do(http.MethodPost, "/master/webhook", testMasterSecret)
	if w.Code != http.StatusTeapot {
		t.Fatalf("got %d, want fall-through to next (418)", w.Code)
	}
	w = fx.do(http.MethodGet, "/health", "")
	if w.Code != http.StatusTeapot {
		t.Fatalf("non-webhook path: got %d, want next (418)", w.Code)
	}
	fx.mu.Lock()
	defer fx.mu.Unlock()
	if fx.nextCalls != 2 {
		t.Fatalf("next called %d times, want 2", fx.nextCalls)
	}
}

func TestWebhookMethodAndPathErrors(t *testing.T) {
	fx := newWebhookFixture(true)

	for _, path := range []string{"/tg/webhook", "/tg/" + testSpecialistSecret + "/webhook", "/master/webhook"} {
		if w := fx.do(http.MethodGet, path, testSpecialistSecret); w.Code != http.StatusMethodNotAllowed {
			t.Fatalf("GET %s: got %d, want 405", path, w.Code)
		}
	}
	for _, path := range []string{"/tg/a/b/c", "/tg/", "/tg/a/notwebhook"} {
		if w := fx.do(http.MethodPost, path, testSpecialistSecret); w.Code != http.StatusNotFound {
			t.Fatalf("POST %s: got %d, want 404", path, w.Code)
		}
	}
}

func TestWebhookInvalidJSON(t *testing.T) {
	fx := newWebhookFixture(true)
	req := httptest.NewRequest(http.MethodPost, "/tg/webhook", strings.NewReader("{not json"))
	req.Header.Set("X-Telegram-Bot-Api-Secret-Token", testSpecialistSecret)
	w := httptest.NewRecorder()
	fx.handler.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", w.Code)
	}
	fx.specialist.expectNoDispatch(t)
}

func TestWebhookNeverLogsSecrets(t *testing.T) {
	var buf bytes.Buffer
	prev := log.Writer()
	log.SetOutput(&buf)
	defer log.SetOutput(prev)

	fx := newWebhookFixture(true)
	secrets := []string{testSpecialistSecret, testMasterSecret, "wrong-header-value", "wrong-path-value"}

	fx.do(http.MethodPost, "/tg/"+testSpecialistSecret+"/webhook", testSpecialistSecret)
	fx.specialist.expectDispatch(t)
	fx.do(http.MethodPost, "/tg/"+testSpecialistSecret+"/webhook", "wrong-header-value")
	fx.do(http.MethodPost, "/tg/wrong-path-value/webhook", "wrong-header-value")
	fx.do(http.MethodGet, "/tg/"+testSpecialistSecret+"/webhook", testSpecialistSecret)
	fx.do(http.MethodPost, "/tg/"+testSpecialistSecret+"/extra/webhook", testSpecialistSecret)
	fx.do(http.MethodPost, "/tg/webhook", "wrong-header-value")
	fx.do(http.MethodPost, "/master/"+testMasterSecret+"/webhook", testMasterSecret)
	fx.master.expectDispatch(t)
	fx.do(http.MethodPost, "/master/"+testMasterSecret+"/webhook", "wrong-header-value")
	fx.do(http.MethodPost, "/master/wrong-path-value/webhook", testMasterSecret)

	out := buf.String()
	if !strings.Contains(out, "legacy webhook path used") {
		t.Fatalf("expected legacy path log line, got:\n%s", out)
	}
	for _, s := range secrets {
		if strings.Contains(out, s) {
			t.Fatalf("log output leaked %q:\n%s", s, out)
		}
	}
	if strings.Contains(out, "/webhook") {
		t.Fatalf("log output contains a webhook path:\n%s", out)
	}
}

func TestWebhookOversizedSecretRejectedWithoutLookup(t *testing.T) {
	calls := 0
	resolve := func(secret string) updateHandler {
		calls++
		return nil
	}
	h := newWebhookHandler(resolve, testMasterSecret, nil, http.NotFoundHandler())

	long := strings.Repeat("a", maxWebhookSecretLen+1)
	for _, path := range []string{"/tg/webhook", "/tg/" + long + "/webhook"} {
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(testBody))
		req.Header.Set("X-Telegram-Bot-Api-Secret-Token", long)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("%d-char header on %s: got %d, want 401", len(long), "webhook path", w.Code)
		}
	}
	if calls != 0 {
		t.Fatalf("resolver called %d times for oversized secrets, want 0", calls)
	}

	// Exactly at the limit still reaches the resolver.
	atLimit := strings.Repeat("a", maxWebhookSecretLen)
	req := httptest.NewRequest(http.MethodPost, "/tg/webhook", strings.NewReader(testBody))
	req.Header.Set("X-Telegram-Bot-Api-Secret-Token", atLimit)
	h.ServeHTTP(httptest.NewRecorder(), req)
	if calls != 1 {
		t.Fatalf("resolver calls at the limit = %d, want 1", calls)
	}
}
