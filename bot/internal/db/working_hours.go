package db

import (
	"database/sql"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Returns working hours by specialist id.
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
func GetWorkingHoursBySpecialistID(specialistID string) ([]models.WorkingHours, error) {
	rows, err := DB.Query(Q(`
		SELECT id, specialist_id, day_of_week, start_time, end_time
		FROM working_hours
		WHERE specialist_id = ?
		ORDER BY day_of_week
	`), specialistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hours []models.WorkingHours
	for rows.Next() {
		var wh models.WorkingHours
		if err := rows.Scan(&wh.ID, &wh.SpecialistID, &wh.DayOfWeek, &wh.StartTime, &wh.EndTime); err != nil {
			return nil, err
		}
		hours = append(hours, wh)
	}

	return hours, rows.Err()
}

/***************************************************************************************************
* Implements the upsert working hours logic used by this module.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - startTime: Time value used by the current operation.
* - dayOfWeek: Day of week used by the current operation.
* - endTime: Time value used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpsertWorkingHours(specialistID string, dayOfWeek int, startTime, endTime string) error {
	/***************************************************************************************************
	* Check if exists.
	***************************************************************************************************/
	var existingID string
	err := DB.QueryRow(Q(`
		SELECT id FROM working_hours
		WHERE specialist_id = ? AND day_of_week = ?
	`), specialistID, dayOfWeek).Scan(&existingID)

	if err == sql.ErrNoRows {
		/***************************************************************************************************
		* Insert new.
		***************************************************************************************************/
		id := uuid.New().String()
		_, err = DB.Exec(Q(`
			INSERT INTO working_hours (id, specialist_id, day_of_week, start_time, end_time)
			VALUES (?, ?, ?, ?, ?)
		`), id, specialistID, dayOfWeek, startTime, endTime)
		return err
	}
	if err != nil {
		return err
	}

	/***************************************************************************************************
	* Update existing.
	***************************************************************************************************/
	_, err = DB.Exec(Q(`
		UPDATE working_hours
		SET start_time = ?, end_time = ?
		WHERE id = ?
	`), startTime, endTime, existingID)
	return err
}

/***************************************************************************************************
* Deletes working hours.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - dayOfWeek: Day of week used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func DeleteWorkingHours(specialistID string, dayOfWeek int) error {
	_, err := DB.Exec(Q(`
		DELETE FROM working_hours
		WHERE specialist_id = ? AND day_of_week = ?
	`), specialistID, dayOfWeek)
	return err
}

/***************************************************************************************************
* Implements the clear working hours logic used by this module.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func ClearWorkingHours(specialistID string) error {
	_, err := DB.Exec(Q(`DELETE FROM working_hours WHERE specialist_id = ?`), specialistID)
	return err
}
