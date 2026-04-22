package db

import (
	"errors"
	"testing"
	"time"
)

func TestListInactiveSupportThreads(t *testing.T) {
	setupStatsTestDB(t)

	now := time.Now().UTC()
	oldThread, err := CreateSupportThread(1001, "old", "Old User", "en", 11)
	if err != nil {
		t.Fatalf("CreateSupportThread old: %v", err)
	}
	recentThread, err := CreateSupportThread(1002, "recent", "Recent User", "en", 12)
	if err != nil {
		t.Fatalf("CreateSupportThread recent: %v", err)
	}
	closedThread, err := CreateSupportThread(1003, "closed", "Closed User", "en", 13)
	if err != nil {
		t.Fatalf("CreateSupportThread closed: %v", err)
	}

	if _, err := DB.Exec(Q(`UPDATE support_threads SET last_message_at = ? WHERE id = ?`), now.Add(-6*time.Minute), oldThread.ID); err != nil {
		t.Fatalf("age old thread: %v", err)
	}
	if _, err := DB.Exec(Q(`UPDATE support_threads SET last_message_at = ? WHERE id = ?`), now.Add(-2*time.Minute), recentThread.ID); err != nil {
		t.Fatalf("age recent thread: %v", err)
	}
	if _, err := DB.Exec(Q(`UPDATE support_threads SET last_message_at = ? WHERE id = ?`), now.Add(-6*time.Minute), closedThread.ID); err != nil {
		t.Fatalf("age closed thread: %v", err)
	}
	if err := CloseSupportThread(closedThread.ID); err != nil {
		t.Fatalf("CloseSupportThread: %v", err)
	}

	got, err := ListInactiveSupportThreads(now.Add(-5 * time.Minute))
	if err != nil {
		t.Fatalf("ListInactiveSupportThreads: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 inactive thread, got %d", len(got))
	}
	if got[0].ID != oldThread.ID {
		t.Fatalf("expected old thread %s, got %s", oldThread.ID, got[0].ID)
	}
}

func TestCloseInactiveSupportThreadKeepsFreshActivityOpen(t *testing.T) {
	setupStatsTestDB(t)

	now := time.Now().UTC()
	thread, err := CreateSupportThread(2001, "fresh", "Fresh User", "en", 21)
	if err != nil {
		t.Fatalf("CreateSupportThread: %v", err)
	}
	if _, err := DB.Exec(Q(`UPDATE support_threads SET last_message_at = ? WHERE id = ?`), now.Add(-6*time.Minute), thread.ID); err != nil {
		t.Fatalf("age thread: %v", err)
	}

	cutoff := now.Add(-5 * time.Minute)
	if err := TouchSupportThread(thread.ID); err != nil {
		t.Fatalf("TouchSupportThread: %v", err)
	}
	closed, err := CloseInactiveSupportThread(thread.ID, cutoff)
	if err != nil {
		t.Fatalf("CloseInactiveSupportThread: %v", err)
	}
	if closed {
		t.Fatal("expected fresh thread to remain open")
	}
	if _, err := GetSupportThreadByUserID(2001); err != nil {
		t.Fatalf("expected active thread, got %v", err)
	}
}

func TestCloseInactiveSupportThreadClosesStaleThread(t *testing.T) {
	setupStatsTestDB(t)

	now := time.Now().UTC()
	thread, err := CreateSupportThread(3001, "stale", "Stale User", "en", 31)
	if err != nil {
		t.Fatalf("CreateSupportThread: %v", err)
	}
	if _, err := DB.Exec(Q(`UPDATE support_threads SET last_message_at = ? WHERE id = ?`), now.Add(-6*time.Minute), thread.ID); err != nil {
		t.Fatalf("age thread: %v", err)
	}

	closed, err := CloseInactiveSupportThread(thread.ID, now.Add(-5*time.Minute))
	if err != nil {
		t.Fatalf("CloseInactiveSupportThread: %v", err)
	}
	if !closed {
		t.Fatal("expected stale thread to close")
	}
	if _, err := GetSupportThreadByUserID(3001); !errors.Is(err, ErrSupportThreadNotFound) {
		t.Fatalf("expected active lookup to miss closed thread, got %v", err)
	}
}
