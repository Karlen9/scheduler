package telegram

import (
	"bytes"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"scheduler-bot/internal/crypto"
	"scheduler-bot/internal/db"
)

func setupMasterSupportTestDB(t *testing.T) {
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

type countingTransport struct {
	count int
}

func (t *countingTransport) RoundTrip(*http.Request) (*http.Response, error) {
	t.count++
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewBufferString(`{"ok":true,"result":{}}`)),
		Header:     make(http.Header),
	}, nil
}

type recordedRequest struct {
	path string
	body string
}

type recordingTransport struct {
	calls []recordedRequest
}

func (t *recordingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	body, _ := io.ReadAll(req.Body)
	t.calls = append(t.calls, recordedRequest{path: req.URL.Path, body: string(body)})
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewBufferString(`{"ok":true}`)),
		Header:     make(http.Header),
	}, nil
}

func TestHandleSupportGroupMessageRejectsUnauthorizedClose(t *testing.T) {
	setupMasterSupportTestDB(t)

	thread, err := db.CreateSupportThread(2001, "client", "Client User", "en", 11)
	if err != nil {
		t.Fatalf("CreateSupportThread: %v", err)
	}

	handler := &MasterHandler{
		bot:            &Bot{ID: 9000},
		adminIDs:       []int64{42},
		supportGroupID: -100123,
	}

	handler.handleSupportGroupMessage(&Message{
		MessageID:       1,
		Chat:            Chat{ID: handler.supportGroupID},
		From:            &User{ID: 77, FirstName: "Intruder"},
		Text:            "/close",
		MessageThreadID: thread.TopicID,
	})

	got, err := db.GetSupportThreadByUserID(2001)
	if err != nil {
		t.Fatalf("GetSupportThreadByUserID: %v", err)
	}
	if got.ClosedAt != nil {
		t.Fatal("expected unauthorized /close to leave support thread open")
	}
}

func TestHandleSupportGroupMessageCloseIsSilentForClient(t *testing.T) {
	setupMasterSupportTestDB(t)

	thread, err := db.CreateSupportThread(4001, "client", "Client User", "en", 31)
	if err != nil {
		t.Fatalf("CreateSupportThread: %v", err)
	}

	transport := &recordingTransport{}
	previousTransport := http.DefaultTransport
	http.DefaultTransport = transport
	defer func() {
		http.DefaultTransport = previousTransport
	}()

	handler := &MasterHandler{
		bot:            &Bot{Token: "test", ID: 9000},
		adminIDs:       []int64{42},
		supportGroupID: -100123,
	}

	handler.handleSupportGroupMessage(&Message{
		MessageID:       3,
		Chat:            Chat{ID: handler.supportGroupID},
		From:            &User{ID: 42, FirstName: "Admin"},
		Text:            "/close",
		MessageThreadID: thread.TopicID,
	})

	got, err := db.GetAnySupportThreadByUserID(4001)
	if err != nil {
		t.Fatalf("GetAnySupportThreadByUserID: %v", err)
	}
	if got.ClosedAt == nil {
		t.Fatal("expected authorized /close to close support thread")
	}

	var sawTopicNotice bool
	for _, call := range transport.calls {
		if strings.Contains(call.path, "/sendMessage") &&
			strings.Contains(call.body, `"chat_id":4001`) {
			t.Fatalf("expected /close to avoid sending client DM, got request body %s", call.body)
		}
		if strings.Contains(call.path, "/sendMessage") &&
			strings.Contains(call.body, `"chat_id":-100123`) &&
			strings.Contains(call.body, `"message_thread_id":31`) &&
			strings.Contains(call.body, "Thread closed") {
			sawTopicNotice = true
		}
	}
	if !sawTopicNotice {
		t.Fatalf("expected /close to post closure notice in support topic, calls: %#v", transport.calls)
	}
}

func TestHandleSupportGroupMessageRejectsUnauthorizedRelay(t *testing.T) {
	setupMasterSupportTestDB(t)

	thread, err := db.CreateSupportThread(3001, "client", "Client User", "en", 21)
	if err != nil {
		t.Fatalf("CreateSupportThread: %v", err)
	}
	originalLastMessageAt := thread.LastMessageAt

	transport := &countingTransport{}
	previousTransport := http.DefaultTransport
	http.DefaultTransport = transport
	defer func() {
		http.DefaultTransport = previousTransport
	}()

	handler := &MasterHandler{
		bot:            &Bot{ID: 9000},
		adminIDs:       []int64{42},
		supportGroupID: -100123,
	}

	handler.handleSupportGroupMessage(&Message{
		MessageID:       2,
		Chat:            Chat{ID: handler.supportGroupID},
		From:            &User{ID: 77, FirstName: "Intruder"},
		Text:            "hello client",
		MessageThreadID: thread.TopicID,
	})

	if transport.count != 0 {
		t.Fatalf("expected unauthorized topic message to make no Telegram API calls, got %d", transport.count)
	}

	got, err := db.GetSupportThreadByUserID(3001)
	if err != nil {
		t.Fatalf("GetSupportThreadByUserID: %v", err)
	}
	if got.LastMessageAt == nil || originalLastMessageAt == nil {
		t.Fatal("expected thread timestamps to be populated")
	}
	if !got.LastMessageAt.Equal(*originalLastMessageAt) {
		t.Fatalf(
			"expected unauthorized topic message to leave last_message_at unchanged, got %s want %s",
			got.LastMessageAt.Format(time.RFC3339Nano),
			originalLastMessageAt.Format(time.RFC3339Nano),
		)
	}
}
