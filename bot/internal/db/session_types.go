package db

import (
	"database/sql"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

func GetSessionTypesByTrainerID(trainerID string) ([]models.SessionType, error) {
	rows, err := DB.Query(Q(`
		SELECT id, trainer_id, type, name, duration_minutes, price, currency, is_active
		FROM session_types
		WHERE trainer_id = ? AND is_active = 1
		ORDER BY type
	`), trainerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessionTypes []models.SessionType
	for rows.Next() {
		var st models.SessionType
		if err := rows.Scan(&st.ID, &st.TrainerID, &st.Type, &st.Name, &st.DurationMinutes, &st.Price, &st.Currency, &st.IsActive); err != nil {
			return nil, err
		}
		sessionTypes = append(sessionTypes, st)
	}

	return sessionTypes, rows.Err()
}

func GetSessionTypeByID(id string) (*models.SessionType, error) {
	var st models.SessionType
	err := DB.QueryRow(Q(`
		SELECT id, trainer_id, type, name, duration_minutes, price, currency, is_active
		FROM session_types
		WHERE id = ?
	`), id).Scan(&st.ID, &st.TrainerID, &st.Type, &st.Name, &st.DurationMinutes, &st.Price, &st.Currency, &st.IsActive)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func GetSessionTypeByType(trainerID, sessionType string) (*models.SessionType, error) {
	var st models.SessionType
	err := DB.QueryRow(Q(`
		SELECT id, trainer_id, type, name, duration_minutes, price, currency, is_active
		FROM session_types
		WHERE trainer_id = ? AND type = ? AND is_active = 1
	`), trainerID, sessionType).Scan(&st.ID, &st.TrainerID, &st.Type, &st.Name, &st.DurationMinutes, &st.Price, &st.Currency, &st.IsActive)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func CreateSessionType(trainerID, sessionType, name string, durationMinutes, price int, currency string) (*models.SessionType, error) {
	id := uuid.New().String()

	_, err := DB.Exec(Q(`
		INSERT INTO session_types (id, trainer_id, type, name, duration_minutes, price, currency)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`), id, trainerID, sessionType, name, durationMinutes, price, currency)
	if err != nil {
		return nil, err
	}

	return GetSessionTypeByID(id)
}

func UpsertSessionType(trainerID, sessionType, name string, durationMinutes, price int, currency string) (*models.SessionType, error) {
	// Check if exists
	var existingID string
	err := DB.QueryRow(Q(`
		SELECT id FROM session_types
		WHERE trainer_id = ? AND type = ?
	`), trainerID, sessionType).Scan(&existingID)

	if err == sql.ErrNoRows {
		return CreateSessionType(trainerID, sessionType, name, durationMinutes, price, currency)
	}
	if err != nil {
		return nil, err
	}

	// Update existing
	_, err = DB.Exec(Q(`
		UPDATE session_types
		SET name = ?, duration_minutes = ?, price = ?, currency = ?, is_active = 1
		WHERE id = ?
	`), name, durationMinutes, price, currency, existingID)
	if err != nil {
		return nil, err
	}

	return GetSessionTypeByID(existingID)
}

func GetAllSessionTypesByTrainerID(trainerID string) ([]models.SessionType, error) {
	rows, err := DB.Query(Q(`
		SELECT id, trainer_id, type, name, duration_minutes, price, currency, is_active
		FROM session_types
		WHERE trainer_id = ?
		ORDER BY type
	`), trainerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessionTypes []models.SessionType
	for rows.Next() {
		var st models.SessionType
		if err := rows.Scan(&st.ID, &st.TrainerID, &st.Type, &st.Name, &st.DurationMinutes, &st.Price, &st.Currency, &st.IsActive); err != nil {
			return nil, err
		}
		sessionTypes = append(sessionTypes, st)
	}

	return sessionTypes, rows.Err()
}

func UpdateSessionType(id, name string, durationMinutes, price int, currency string, isActive bool) (*models.SessionType, error) {
	_, err := DB.Exec(Q(`
		UPDATE session_types
		SET name = ?, duration_minutes = ?, price = ?, currency = ?, is_active = ?
		WHERE id = ?
	`), name, durationMinutes, price, currency, BoolVal(isActive), id)
	if err != nil {
		return nil, err
	}
	return GetSessionTypeByID(id)
}

func DeactivateSessionType(id string) error {
	_, err := DB.Exec(Q(`UPDATE session_types SET is_active = 0 WHERE id = ?`), id)
	return err
}
