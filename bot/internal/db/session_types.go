package db

import (
	"database/sql"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

const sessionTypeColumns = `id, specialist_id, type, name, duration_minutes, price, currency, image_url, is_active`

func scanSessionType(row interface{ Scan(...interface{}) error }) (models.SessionType, error) {
	var st models.SessionType
	err := row.Scan(&st.ID, &st.SpecialistID, &st.Type, &st.Name, &st.DurationMinutes, &st.Price, &st.Currency, &st.ImageURL, &st.IsActive)
	return st, err
}

func GetSessionTypesBySpecialistID(specialistID string) ([]models.SessionType, error) {
	rows, err := DB.Query(Q(`
		SELECT `+sessionTypeColumns+`
		FROM session_types
		WHERE specialist_id = ? AND is_active = 1
		ORDER BY type
	`), specialistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessionTypes []models.SessionType
	for rows.Next() {
		st, err := scanSessionType(rows)
		if err != nil {
			return nil, err
		}
		sessionTypes = append(sessionTypes, st)
	}

	return sessionTypes, rows.Err()
}

func GetSessionTypeByID(id string) (*models.SessionType, error) {
	row := DB.QueryRow(Q(`
		SELECT `+sessionTypeColumns+`
		FROM session_types
		WHERE id = ?
	`), id)
	st, err := scanSessionType(row)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func GetSessionTypeByType(specialistID, sessionType string) (*models.SessionType, error) {
	row := DB.QueryRow(Q(`
		SELECT `+sessionTypeColumns+`
		FROM session_types
		WHERE specialist_id = ? AND type = ? AND is_active = 1
	`), specialistID, sessionType)
	st, err := scanSessionType(row)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func CreateSessionType(specialistID, sessionType, name string, durationMinutes, price int, currency, imageURL string) (*models.SessionType, error) {
	id := uuid.New().String()

	_, err := DB.Exec(Q(`
		INSERT INTO session_types (id, specialist_id, type, name, duration_minutes, price, currency, image_url)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`), id, specialistID, sessionType, name, durationMinutes, price, currency, imageURL)
	if err != nil {
		return nil, err
	}

	return GetSessionTypeByID(id)
}

func UpsertSessionType(specialistID, sessionType, name string, durationMinutes, price int, currency string) (*models.SessionType, error) {
	// Check if exists
	var existingID string
	err := DB.QueryRow(Q(`
		SELECT id FROM session_types
		WHERE specialist_id = ? AND type = ?
	`), specialistID, sessionType).Scan(&existingID)

	if err == sql.ErrNoRows {
		return CreateSessionType(specialistID, sessionType, name, durationMinutes, price, currency, "")
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

func GetAllSessionTypesBySpecialistID(specialistID string) ([]models.SessionType, error) {
	rows, err := DB.Query(Q(`
		SELECT `+sessionTypeColumns+`
		FROM session_types
		WHERE specialist_id = ?
		ORDER BY type
	`), specialistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessionTypes []models.SessionType
	for rows.Next() {
		st, err := scanSessionType(rows)
		if err != nil {
			return nil, err
		}
		sessionTypes = append(sessionTypes, st)
	}

	return sessionTypes, rows.Err()
}

func UpdateSessionType(id, sessionType, name string, durationMinutes, price int, currency, imageURL string, isActive bool) (*models.SessionType, error) {
	_, err := DB.Exec(Q(`
		UPDATE session_types
		SET type = ?, name = ?, duration_minutes = ?, price = ?, currency = ?, image_url = ?, is_active = ?
		WHERE id = ?
	`), sessionType, name, durationMinutes, price, currency, imageURL, BoolVal(isActive), id)
	if err != nil {
		return nil, err
	}
	return GetSessionTypeByID(id)
}

func DeactivateSessionType(id string) error {
	_, err := DB.Exec(Q(`UPDATE session_types SET is_active = 0 WHERE id = ?`), id)
	return err
}
