package db

import (
	"database/sql"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

func GetWorkingHoursByTrainerID(trainerID string) ([]models.WorkingHours, error) {
	rows, err := DB.Query(Q(`
		SELECT id, trainer_id, day_of_week, start_time, end_time
		FROM working_hours
		WHERE trainer_id = ?
		ORDER BY day_of_week
	`), trainerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hours []models.WorkingHours
	for rows.Next() {
		var wh models.WorkingHours
		if err := rows.Scan(&wh.ID, &wh.TrainerID, &wh.DayOfWeek, &wh.StartTime, &wh.EndTime); err != nil {
			return nil, err
		}
		hours = append(hours, wh)
	}

	return hours, rows.Err()
}

func UpsertWorkingHours(trainerID string, dayOfWeek int, startTime, endTime string) error {
	// Check if exists
	var existingID string
	err := DB.QueryRow(Q(`
		SELECT id FROM working_hours
		WHERE trainer_id = ? AND day_of_week = ?
	`), trainerID, dayOfWeek).Scan(&existingID)

	if err == sql.ErrNoRows {
		// Insert new
		id := uuid.New().String()
		_, err = DB.Exec(Q(`
			INSERT INTO working_hours (id, trainer_id, day_of_week, start_time, end_time)
			VALUES (?, ?, ?, ?, ?)
		`), id, trainerID, dayOfWeek, startTime, endTime)
		return err
	}
	if err != nil {
		return err
	}

	// Update existing
	_, err = DB.Exec(Q(`
		UPDATE working_hours
		SET start_time = ?, end_time = ?
		WHERE id = ?
	`), startTime, endTime, existingID)
	return err
}

func DeleteWorkingHours(trainerID string, dayOfWeek int) error {
	_, err := DB.Exec(Q(`
		DELETE FROM working_hours
		WHERE trainer_id = ? AND day_of_week = ?
	`), trainerID, dayOfWeek)
	return err
}

func ClearWorkingHours(trainerID string) error {
	_, err := DB.Exec(Q(`DELETE FROM working_hours WHERE trainer_id = ?`), trainerID)
	return err
}
