package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* parseDateString parses a date string that may come as "2006-01-02" (SQLite) or
* "2006-01-02T15:04:05Z" / "2006-01-02 15:04:05+00:00" (Postgres).
*
* Parameters:
* - s: S used by the current operation.
*
* Returns:
* - The computed value for the current operation as time.Time.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func parseDateString(s string) time.Time {
	/***************************************************************************************************
	* Try date-only first.
	***************************************************************************************************/
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t
	}
	/***************************************************************************************************
	* Try RFC3339 (Postgres TIMESTAMPTZ).
	***************************************************************************************************/
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t
	}
	/***************************************************************************************************
	* Try Postgres format without T separator.
	***************************************************************************************************/
	if t, err := time.Parse("2006-01-02 15:04:05-07:00", s); err == nil {
		return t
	}
	if t, err := time.Parse("2006-01-02 15:04:05-07", s); err == nil {
		return t
	}
	/***************************************************************************************************
	* Fallback: truncate to 10 chars and try date-only.
	***************************************************************************************************/
	if len(s) >= 10 {
		if t, err := time.Parse("2006-01-02", s[:10]); err == nil {
			return t
		}
	}
	return time.Time{}
}

/***************************************************************************************************
* Returns days off by specialist id.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetDaysOffBySpecialistID(specialistID string) ([]models.DayOff, error) {
	rows, err := DB.Query(Q(
		`SELECT id, specialist_id, date, reason, created_at
		FROM days_off
		WHERE specialist_id = ? AND date >= `+DateNow()+`
		ORDER BY date ASC`), specialistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var daysOff []models.DayOff
	for rows.Next() {
		var d models.DayOff
		var reason sql.NullString
		var dateStr string
		err := rows.Scan(&d.ID, &d.SpecialistID, &dateStr, &reason, &d.CreatedAt)
		if err != nil {
			return nil, err
		}
		d.Date = parseDateString(dateStr)
		d.Reason = reason.String
		daysOff = append(daysOff, d)
	}
	return daysOff, rows.Err()
}

/***************************************************************************************************
* Returns day off.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - date: Date value used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetDayOff(specialistID string, date time.Time) (*models.DayOff, error) {
	dateStr := date.Format("2006-01-02")
	row := DB.QueryRow(Q(`
		SELECT id, specialist_id, date, reason, created_at
		FROM days_off
		WHERE specialist_id = ? AND date = ?
	`), specialistID, dateStr)

	var d models.DayOff
	var reason sql.NullString
	var dateResult string
	err := row.Scan(&d.ID, &d.SpecialistID, &dateResult, &reason, &d.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	d.Date = parseDateString(dateResult)
	d.Reason = reason.String
	return &d, nil
}

/***************************************************************************************************
* Creates day off.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - date: Date value used by the current operation.
* - reason: Reason used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CreateDayOff(specialistID string, date time.Time, reason string) (*models.DayOff, error) {
	id := uuid.New().String()
	dateStr := date.Format("2006-01-02")

	var reasonVal interface{}
	if reason != "" {
		reasonVal = reason
	} else {
		reasonVal = nil
	}

	_, err := DB.Exec(Q(`
		INSERT INTO days_off (id, specialist_id, date, reason)
		VALUES (?, ?, ?, ?)
	`), id, specialistID, dateStr, reasonVal)
	if err != nil {
		return nil, err
	}

	return &models.DayOff{
		ID:           id,
		SpecialistID: specialistID,
		Date:         date,
		Reason:       reason,
		CreatedAt:    time.Now(),
	}, nil
}

/***************************************************************************************************
* Deletes day off.
*
* Parameters:
* - id: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func DeleteDayOff(id string) error {
	_, err := DB.Exec(Q(`DELETE FROM days_off WHERE id = ?`), id)
	return err
}

/***************************************************************************************************
* DeleteDayOffForSpecialist deletes a day off only when it belongs to the given specialist.
*
* Parameters:
* - id: Identifier used to target the current record.
* - specialistID: Identifier used to target the current record.
*
* Returns:
* - The computed value for the current operation as bool together with an error when the operation
*   cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func DeleteDayOffForSpecialist(id, specialistID string) (bool, error) {
	res, err := DB.Exec(Q(`DELETE FROM days_off WHERE id = ? AND specialist_id = ?`), id, specialistID)
	if err != nil {
		return false, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

/***************************************************************************************************
* Checks whether day off.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - date: Date value used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CreateDayOffsBatch(specialistID string, dates []time.Time, reason string) ([]models.DayOff, error) {
	if len(dates) == 0 {
		return []models.DayOff{}, nil
	}

	var reasonVal interface{}
	if reason != "" {
		reasonVal = reason
	} else {
		reasonVal = nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	created := make([]models.DayOff, 0, len(dates))
	now := time.Now()
	for _, d := range dates {
		dateStr := d.Format("2006-01-02")

		var existingID string
		err := tx.QueryRow(Q(`SELECT id FROM days_off WHERE specialist_id = ? AND date = ?`), specialistID, dateStr).Scan(&existingID)
		if err == nil {
			continue
		}
		if err != sql.ErrNoRows {
			return nil, err
		}

		id := uuid.New().String()
		if _, err := tx.Exec(Q(`INSERT INTO days_off (id, specialist_id, date, reason) VALUES (?, ?, ?, ?)`),
			id, specialistID, dateStr, reasonVal); err != nil {
			return nil, err
		}
		created = append(created, models.DayOff{
			ID:           id,
			SpecialistID: specialistID,
			Date:         d,
			Reason:       reason,
			CreatedAt:    now,
		})
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return created, nil
}

func IsDayOff(specialistID string, date time.Time) (bool, error) {
	dateStr := date.Format("2006-01-02")
	var count int
	err := DB.QueryRow(Q(`
		SELECT COUNT(*) FROM days_off
		WHERE specialist_id = ? AND date = ?
	`), specialistID, dateStr).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
