package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

func CreateWaitlistEntry(trainerID, clientID string, startsAt, endsAt time.Time, clientName string, durationMinutes int) (*models.WaitlistEntry, error) {
	id := uuid.New().String()

	_, err := DB.Exec(`
		INSERT INTO waitlist (id, trainer_id, client_id, starts_at, ends_at, duration_minutes, client_name, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting')
	`, id, trainerID, clientID, startsAt, endsAt, durationMinutes, clientName)
	if err != nil {
		return nil, err
	}

	return GetWaitlistByID(id)
}

func GetWaitlistByID(id string) (*models.WaitlistEntry, error) {
	var e models.WaitlistEntry
	var offeredAt sql.NullTime

	err := DB.QueryRow(`
		SELECT id, trainer_id, client_id, starts_at, ends_at, duration_minutes,
		       client_name, status, offered_at, created_at
		FROM waitlist
		WHERE id = ?
	`, id).Scan(&e.ID, &e.TrainerID, &e.ClientID, &e.StartsAt, &e.EndsAt, &e.DurationMinutes,
		&e.ClientName, &e.Status, &offeredAt, &e.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if offeredAt.Valid {
		e.OfferedAt = &offeredAt.Time
	}

	return &e, nil
}

// GetWaitlistForSlot returns all "waiting" entries for a time range, ordered by created_at ASC (FIFO)
func GetWaitlistForSlot(trainerID string, startsAt, endsAt time.Time) ([]models.WaitlistEntry, error) {
	rows, err := DB.Query(`
		SELECT id, trainer_id, client_id, starts_at, ends_at, duration_minutes,
		       client_name, status, offered_at, created_at
		FROM waitlist
		WHERE trainer_id = ?
		  AND status = 'waiting'
		  AND starts_at < ?
		  AND ends_at > ?
		ORDER BY created_at ASC
	`, trainerID, endsAt, startsAt)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanWaitlistEntries(rows)
}

// GetWaitlistByClientID returns client's active waitlist entries (waiting + offered)
func GetWaitlistByClientID(clientID string) ([]models.WaitlistEntry, error) {
	rows, err := DB.Query(`
		SELECT id, trainer_id, client_id, starts_at, ends_at, duration_minutes,
		       client_name, status, offered_at, created_at
		FROM waitlist
		WHERE client_id = ? AND status IN ('waiting', 'offered')
		ORDER BY starts_at ASC
	`, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanWaitlistEntries(rows)
}

// GetWaitlistByTrainerID returns all active waitlist entries for a trainer
func GetWaitlistByTrainerID(trainerID string) ([]models.WaitlistEntry, error) {
	rows, err := DB.Query(`
		SELECT id, trainer_id, client_id, starts_at, ends_at, duration_minutes,
		       client_name, status, offered_at, created_at
		FROM waitlist
		WHERE trainer_id = ? AND status IN ('waiting', 'offered')
		ORDER BY starts_at ASC, created_at ASC
	`, trainerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanWaitlistEntries(rows)
}

func UpdateWaitlistStatus(id string, status models.WaitlistStatus) error {
	_, err := DB.Exec(`UPDATE waitlist SET status = ? WHERE id = ?`, status, id)
	return err
}

// OfferWaitlistEntry sets status="offered" and offered_at=now
func OfferWaitlistEntry(id string) error {
	_, err := DB.Exec(`
		UPDATE waitlist SET status = 'offered', offered_at = ? WHERE id = ?
	`, time.Now().UTC(), id)
	return err
}

// GetExpiredOffers returns entries where status="offered" and offered_at + timeout < now
func GetExpiredOffers(timeout time.Duration) ([]models.WaitlistEntry, error) {
	cutoff := time.Now().UTC().Add(-timeout)

	rows, err := DB.Query(`
		SELECT id, trainer_id, client_id, starts_at, ends_at, duration_minutes,
		       client_name, status, offered_at, created_at
		FROM waitlist
		WHERE status = 'offered' AND offered_at < ?
	`, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanWaitlistEntries(rows)
}

// ClientHasWaitlistForSlot checks if a client already has an active waitlist entry for this slot
func ClientHasWaitlistForSlot(clientID, trainerID string, startsAt, endsAt time.Time) (bool, error) {
	var count int
	err := DB.QueryRow(`
		SELECT COUNT(*) FROM waitlist
		WHERE client_id = ?
		  AND trainer_id = ?
		  AND status IN ('waiting', 'offered')
		  AND starts_at < ?
		  AND ends_at > ?
	`, clientID, trainerID, endsAt, startsAt).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// CancelWaitlistEntriesForSlot cancels a client's waitlist entries for a specific slot
func CancelWaitlistEntriesForSlot(clientID, trainerID string, startsAt, endsAt time.Time) error {
	_, err := DB.Exec(`
		UPDATE waitlist SET status = 'cancelled'
		WHERE client_id = ?
		  AND trainer_id = ?
		  AND status IN ('waiting', 'offered')
		  AND starts_at < ?
		  AND ends_at > ?
	`, clientID, trainerID, endsAt, startsAt)
	return err
}

// GetWaitlistCountForSlots returns a map of startsAt -> count for the given day
func GetWaitlistCountForSlots(trainerID string, startOfDay, endOfDay time.Time) (map[string]int, error) {
	rows, err := DB.Query(`
		SELECT starts_at, COUNT(*) as cnt
		FROM waitlist
		WHERE trainer_id = ?
		  AND status IN ('waiting', 'offered')
		  AND starts_at >= ?
		  AND starts_at < ?
		GROUP BY starts_at
	`, trainerID, startOfDay, endOfDay)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]int)
	for rows.Next() {
		var startsAt time.Time
		var count int
		if err := rows.Scan(&startsAt, &count); err != nil {
			return nil, err
		}
		key := startsAt.Format("15:04")
		result[key] = count
	}

	return result, rows.Err()
}

// GetClientWaitlistForSlots returns a set of startsAt times where the client has active waitlist entries
func GetClientWaitlistForSlots(clientID, trainerID string, startOfDay, endOfDay time.Time) (map[string]bool, error) {
	rows, err := DB.Query(`
		SELECT starts_at
		FROM waitlist
		WHERE client_id = ?
		  AND trainer_id = ?
		  AND status IN ('waiting', 'offered')
		  AND starts_at >= ?
		  AND starts_at < ?
	`, clientID, trainerID, startOfDay, endOfDay)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]bool)
	for rows.Next() {
		var startsAt time.Time
		if err := rows.Scan(&startsAt); err != nil {
			return nil, err
		}
		key := startsAt.Format("15:04")
		result[key] = true
	}

	return result, rows.Err()
}

// GetWaitlistPosition returns the position (1-based) of an entry in its slot's queue
func GetWaitlistPosition(entry *models.WaitlistEntry) (int, error) {
	var position int
	err := DB.QueryRow(`
		SELECT COUNT(*) + 1
		FROM waitlist
		WHERE trainer_id = ?
		  AND status IN ('waiting', 'offered')
		  AND starts_at = ?
		  AND ends_at = ?
		  AND created_at < ?
	`, entry.TrainerID, entry.StartsAt, entry.EndsAt, entry.CreatedAt).Scan(&position)
	if err != nil {
		return 0, err
	}
	return position, nil
}

func scanWaitlistEntries(rows *sql.Rows) ([]models.WaitlistEntry, error) {
	var entries []models.WaitlistEntry
	for rows.Next() {
		var e models.WaitlistEntry
		var offeredAt sql.NullTime

		if err := rows.Scan(&e.ID, &e.TrainerID, &e.ClientID, &e.StartsAt, &e.EndsAt, &e.DurationMinutes,
			&e.ClientName, &e.Status, &offeredAt, &e.CreatedAt); err != nil {
			return nil, err
		}

		if offeredAt.Valid {
			e.OfferedAt = &offeredAt.Time
		}

		entries = append(entries, e)
	}

	return entries, rows.Err()
}
