package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

func GetDaysOffByTrainerID(trainerID string) ([]models.DayOff, error) {
	rows, err := DB.Query(`
		SELECT id, trainer_id, date, reason, created_at
		FROM days_off
		WHERE trainer_id = ? AND date >= date('now')
		ORDER BY date ASC
	`, trainerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var daysOff []models.DayOff
	for rows.Next() {
		var d models.DayOff
		var reason sql.NullString
		var dateStr string
		err := rows.Scan(&d.ID, &d.TrainerID, &dateStr, &reason, &d.CreatedAt)
		if err != nil {
			return nil, err
		}
		d.Date, _ = time.Parse("2006-01-02", dateStr)
		d.Reason = reason.String
		daysOff = append(daysOff, d)
	}
	return daysOff, rows.Err()
}

func GetDayOff(trainerID string, date time.Time) (*models.DayOff, error) {
	dateStr := date.Format("2006-01-02")
	row := DB.QueryRow(`
		SELECT id, trainer_id, date, reason, created_at
		FROM days_off
		WHERE trainer_id = ? AND date = ?
	`, trainerID, dateStr)

	var d models.DayOff
	var reason sql.NullString
	var dateResult string
	err := row.Scan(&d.ID, &d.TrainerID, &dateResult, &reason, &d.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	d.Date, _ = time.Parse("2006-01-02", dateResult)
	d.Reason = reason.String
	return &d, nil
}

func CreateDayOff(trainerID string, date time.Time, reason string) (*models.DayOff, error) {
	id := uuid.New().String()
	dateStr := date.Format("2006-01-02")

	var reasonVal interface{}
	if reason != "" {
		reasonVal = reason
	} else {
		reasonVal = nil
	}

	_, err := DB.Exec(`
		INSERT INTO days_off (id, trainer_id, date, reason)
		VALUES (?, ?, ?, ?)
	`, id, trainerID, dateStr, reasonVal)
	if err != nil {
		return nil, err
	}

	return &models.DayOff{
		ID:        id,
		TrainerID: trainerID,
		Date:      date,
		Reason:    reason,
		CreatedAt: time.Now(),
	}, nil
}

func DeleteDayOff(id string) error {
	_, err := DB.Exec(`DELETE FROM days_off WHERE id = ?`, id)
	return err
}

func IsDayOff(trainerID string, date time.Time) (bool, error) {
	dateStr := date.Format("2006-01-02")
	var count int
	err := DB.QueryRow(`
		SELECT COUNT(*) FROM days_off
		WHERE trainer_id = ? AND date = ?
	`, trainerID, dateStr).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
