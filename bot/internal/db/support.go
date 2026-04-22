package db

import (
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

// ErrSupportThreadNotFound signals that no active support thread exists for the given key.
var ErrSupportThreadNotFound = errors.New("support thread not found")

// GetSupportThreadByUserID returns the active (non-closed) thread for a Telegram user, or ErrSupportThreadNotFound.
func GetSupportThreadByUserID(telegramUserID int64) (*models.SupportThread, error) {
	return scanSupportThreadRow(DB.QueryRow(Q(`
		SELECT id, telegram_user_id, telegram_username, display_name, language_code,
		       topic_id, created_at, last_message_at, closed_at
		FROM support_threads
		WHERE telegram_user_id = ? AND closed_at IS NULL
	`), telegramUserID))
}

// GetAnySupportThreadByUserID returns the support_threads row for a user regardless of whether
// it is currently closed. Used by the recovery path when an earlier bug or a manual admin action
// left a stranded "closed" row that blocks new inserts due to the telegram_user_id UNIQUE
// constraint — callers can then reassign the topic and reopen it.
func GetAnySupportThreadByUserID(telegramUserID int64) (*models.SupportThread, error) {
	return scanSupportThreadRow(DB.QueryRow(Q(`
		SELECT id, telegram_user_id, telegram_username, display_name, language_code,
		       topic_id, created_at, last_message_at, closed_at
		FROM support_threads
		WHERE telegram_user_id = ?
	`), telegramUserID))
}

// GetSupportThreadByTopicID returns the active thread attached to the given forum topic.
func GetSupportThreadByTopicID(topicID int) (*models.SupportThread, error) {
	return scanSupportThreadRow(DB.QueryRow(Q(`
		SELECT id, telegram_user_id, telegram_username, display_name, language_code,
		       topic_id, created_at, last_message_at, closed_at
		FROM support_threads
		WHERE topic_id = ? AND closed_at IS NULL
	`), topicID))
}

// ListInactiveSupportThreads returns open support threads whose last activity is at or before cutoff.
func ListInactiveSupportThreads(cutoff time.Time) ([]*models.SupportThread, error) {
	rows, err := DB.Query(Q(`
		SELECT id, telegram_user_id, telegram_username, display_name, language_code,
		       topic_id, created_at, last_message_at, closed_at
		FROM support_threads
		WHERE closed_at IS NULL AND COALESCE(last_message_at, created_at) <= ?
	`), cutoff.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var threads []*models.SupportThread
	for rows.Next() {
		thread, err := scanSupportThread(rows)
		if err != nil {
			return nil, err
		}
		threads = append(threads, thread)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return threads, nil
}

// CreateSupportThread inserts a new thread mapping. Caller should ensure no open thread already exists for the user.
func CreateSupportThread(telegramUserID int64, username, displayName, languageCode string, topicID int) (*models.SupportThread, error) {
	id := uuid.NewString()
	now := time.Now().UTC()
	if _, err := DB.Exec(Q(`
		INSERT INTO support_threads (id, telegram_user_id, telegram_username, display_name, language_code, topic_id, created_at, last_message_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`), id, telegramUserID, username, displayName, languageCode, topicID, now, now); err != nil {
		return nil, err
	}
	return &models.SupportThread{
		ID:               id,
		TelegramUserID:   telegramUserID,
		TelegramUsername: username,
		DisplayName:      displayName,
		LanguageCode:     languageCode,
		TopicID:          topicID,
		CreatedAt:        now,
		LastMessageAt:    &now,
	}, nil
}

// TouchSupportThread refreshes last_message_at for the given thread.
func TouchSupportThread(threadID string) error {
	_, err := DB.Exec(Q(`UPDATE support_threads SET last_message_at = ? WHERE id = ?`), time.Now().UTC(), threadID)
	return err
}

// ReassignSupportThreadTopic points an existing support_threads row at a freshly created forum
// topic. Used when an admin deletes the old topic in the group — we keep the same DB row (and
// therefore the same user identity, same created_at) but swap topic_id to the new one. Done this
// way because telegram_user_id carries a UNIQUE constraint, so close-and-recreate cannot work.
func ReassignSupportThreadTopic(threadID string, newTopicID int) error {
	_, err := DB.Exec(Q(`
		UPDATE support_threads
		SET topic_id = ?, last_message_at = ?, closed_at = NULL
		WHERE id = ?
	`), newTopicID, time.Now().UTC(), threadID)
	return err
}

// ReopenSupportThread clears closed_at on a previously-closed thread, keeping the same topic_id.
// Used when the owner /close-d a thread but the forum topic still exists in Telegram — we reopen
// the same topic so prior conversation history stays in one place.
func ReopenSupportThread(threadID string) error {
	_, err := DB.Exec(Q(`
		UPDATE support_threads
		SET closed_at = NULL, last_message_at = ?
		WHERE id = ?
	`), time.Now().UTC(), threadID)
	return err
}

// CloseSupportThread marks the thread closed. The same topic can be reopened on the next explicit support request.
func CloseSupportThread(threadID string) error {
	_, err := DB.Exec(Q(`UPDATE support_threads SET closed_at = ? WHERE id = ? AND closed_at IS NULL`), time.Now().UTC(), threadID)
	return err
}

// CloseInactiveSupportThread marks a thread closed only if it is still inactive at cutoff.
func CloseInactiveSupportThread(threadID string, cutoff time.Time) (bool, error) {
	res, err := DB.Exec(Q(`
		UPDATE support_threads
		SET closed_at = ?
		WHERE id = ?
		  AND closed_at IS NULL
		  AND COALESCE(last_message_at, created_at) <= ?
	`), time.Now().UTC(), threadID, cutoff.UTC())
	if err != nil {
		return false, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

// UpdateSupportThreadUser refreshes username / display-name / language when we see fresher values.
func UpdateSupportThreadUser(threadID, username, displayName, languageCode string) error {
	_, err := DB.Exec(Q(`
		UPDATE support_threads
		SET telegram_username = ?, display_name = ?, language_code = ?
		WHERE id = ?
	`), username, displayName, languageCode, threadID)
	return err
}

func scanSupportThreadRow(row *sql.Row) (*models.SupportThread, error) {
	thread, err := scanSupportThread(row)
	if err == sql.ErrNoRows {
		return nil, ErrSupportThreadNotFound
	}
	return thread, err
}

type supportThreadScanner interface {
	Scan(dest ...any) error
}

func scanSupportThread(scanner supportThreadScanner) (*models.SupportThread, error) {
	var t models.SupportThread
	var lastMsg, closed sql.NullTime
	err := scanner.Scan(
		&t.ID,
		&t.TelegramUserID,
		&t.TelegramUsername,
		&t.DisplayName,
		&t.LanguageCode,
		&t.TopicID,
		&t.CreatedAt,
		&lastMsg,
		&closed,
	)
	if err != nil {
		return nil, err
	}
	if lastMsg.Valid {
		v := lastMsg.Time
		t.LastMessageAt = &v
	}
	if closed.Valid {
		v := closed.Time
		t.ClosedAt = &v
	}
	return &t, nil
}
