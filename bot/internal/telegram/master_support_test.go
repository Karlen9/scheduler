package telegram

import (
	"bytes"
	"io"
	"net/http"
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
