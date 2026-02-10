package db

import (
	"database/sql"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

func CreateRecurringSchedule(trainerID, clientID, clientName string, dayOfWeek int, timeStr string, durationMinutes int, createdBy string) (*models.RecurringSchedule, error) {
	id := uuid.New().String()

	_, err := DB.Exec(`
		INSERT INTO recurring_schedules (id, trainer_id, client_id, client_name, day_of_week, time, duration_minutes, status, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
	`, id, trainerID, clientID, clientName, dayOfWeek, timeStr, durationMinutes, createdBy)
	if err != nil {
		return nil, err
	}

	return GetRecurringScheduleByID(id)
}

func GetRecurringScheduleByID(id string) (*models.RecurringSchedule, error) {
	var s models.RecurringSchedule
	err := DB.QueryRow(`
		SELECT id, trainer_id, client_id, client_name, day_of_week, time, duration_minutes, status, created_by, created_at
		FROM recurring_schedules
		WHERE id = ?
	`, id).Scan(&s.ID, &s.TrainerID, &s.ClientID, &s.ClientName, &s.DayOfWeek, &s.Time, &s.DurationMinutes, &s.Status, &s.CreatedBy, &s.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func GetActiveRecurringSchedules() ([]models.RecurringSchedule, error) {
	rows, err := DB.Query(`
		SELECT id, trainer_id, client_id, client_name, day_of_week, time, duration_minutes, status, created_by, created_at
		FROM recurring_schedules
		WHERE status = 'active'
		ORDER BY day_of_week, time
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRecurringSchedules(rows)
}

func GetRecurringSchedulesByTrainerID(trainerID string) ([]models.RecurringSchedule, error) {
	rows, err := DB.Query(`
		SELECT id, trainer_id, client_id, client_name, day_of_week, time, duration_minutes, status, created_by, created_at
		FROM recurring_schedules
		WHERE trainer_id = ? AND status != 'cancelled'
		ORDER BY day_of_week, time
	`, trainerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRecurringSchedules(rows)
}

func GetRecurringSchedulesByClientID(clientID string) ([]models.RecurringSchedule, error) {
	rows, err := DB.Query(`
		SELECT id, trainer_id, client_id, client_name, day_of_week, time, duration_minutes, status, created_by, created_at
		FROM recurring_schedules
		WHERE client_id = ? AND status != 'cancelled'
		ORDER BY day_of_week, time
	`, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRecurringSchedules(rows)
}

func UpdateRecurringScheduleStatus(id string, status models.RecurringScheduleStatus) error {
	_, err := DB.Exec(`UPDATE recurring_schedules SET status = ? WHERE id = ?`, status, id)
	return err
}

func scanRecurringSchedules(rows *sql.Rows) ([]models.RecurringSchedule, error) {
	var schedules []models.RecurringSchedule
	for rows.Next() {
		var s models.RecurringSchedule
		if err := rows.Scan(&s.ID, &s.TrainerID, &s.ClientID, &s.ClientName, &s.DayOfWeek, &s.Time, &s.DurationMinutes, &s.Status, &s.CreatedBy, &s.CreatedAt); err != nil {
			return nil, err
		}
		schedules = append(schedules, s)
	}
	return schedules, rows.Err()
}
