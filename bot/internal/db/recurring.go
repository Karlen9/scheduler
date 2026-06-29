package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Lists the SQL columns used by the related query helpers.
*
* Usage context:
* - Reused by the database layer to keep shared values centralized.
***************************************************************************************************/
var recurringColumns = `rs.id, rs.specialist_id, rs.client_id, rs.client_name, rs.day_of_week, rs."time", rs.duration_minutes, rs.status, rs.created_by, rs.created_at, rs.session_type_id, rs.days_of_week, rs.start_date, rs.end_date, rs.day_times, ` +
	clientMetadataSelectColumns("c") + `, ` + sessionTypeSelectColumns("st") +
	`, CASE WHEN c.telegram_user_id = sp.telegram_user_id THEN 1 ELSE 0 END`

/***************************************************************************************************
* Stores the shared SQL FROM clause reused by related queries.
*
* Usage context:
* - Reused by the database layer to keep shared values centralized.
***************************************************************************************************/
const recurringFromClause = `
	FROM recurring_schedules rs
	LEFT JOIN clients c ON c.id = rs.client_id
	LEFT JOIN session_types st ON st.id = rs.session_type_id
	LEFT JOIN specialists sp ON sp.id = rs.specialist_id
`

/***************************************************************************************************
* Implements the recurring select query logic used by this module.
*
* Parameters:
* - whereClause: Where clause used by the current operation.
* - orderBy: Order by used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func recurringSelectQuery(whereClause, orderBy string) string {
	query := `SELECT ` + recurringColumns + recurringFromClause
	if whereClause != "" {
		query += "\nWHERE " + whereClause
	}
	if orderBy != "" {
		query += "\nORDER BY " + orderBy
	}
	return query
}

/***************************************************************************************************
* Scans recurring schedule.
*
* Parameters:
* - row: Row used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func scanRecurringSchedule(row interface{ Scan(...interface{}) error }) (*models.RecurringSchedule, error) {
	var s models.RecurringSchedule
	var sessionTypeID, daysOfWeek, startDate, endDate, dayTimes sql.NullString
	var clientIsSelf sql.NullInt64
	sessionType := nullableSessionType{}

	dest := append([]interface{}{
		&s.ID, &s.SpecialistID, &s.ClientID, &s.ClientName, &s.DayOfWeek, &s.Time, &s.DurationMinutes, &s.Status, &s.CreatedBy, &s.CreatedAt, &sessionTypeID, &daysOfWeek, &startDate, &endDate, &dayTimes, &s.ClientPhotoURL, &s.ClientDisplayName,
	}, append(sessionType.scanDest(), &clientIsSelf)...)

	err := row.Scan(dest...)
	if err != nil {
		return nil, err
	}

	if sessionTypeID.Valid {
		s.SessionTypeID = sessionTypeID.String
	}
	if daysOfWeek.Valid {
		s.DaysOfWeek = daysOfWeek.String
	}
	if startDate.Valid {
		s.StartDate = startDate.String
	}
	if endDate.Valid {
		s.EndDate = endDate.String
	}
	if dayTimes.Valid {
		s.DayTimes = dayTimes.String
	}
	s.ClientIsSelf = clientIsSelf.Valid && clientIsSelf.Int64 == 1
	s.SessionType = sessionType.model()

	return &s, nil
}

/***************************************************************************************************
* Creates recurring schedule.
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - specialistID: Identifier used to target the current record.
* - clientName: Client name used by the current operation.
* - dayOfWeek: Day of week used by the current operation.
* - timeStr: Time value used by the current operation.
* - durationMinutes: Duration value used by the current operation.
* - createdBy: Created by used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CreateRecurringSchedule(specialistID, clientID, clientName string, dayOfWeek int, timeStr string, durationMinutes int, createdBy string) (*models.RecurringSchedule, error) {
	id := uuid.New().String()

	_, err := DB.Exec(Q(`
		INSERT INTO recurring_schedules (id, specialist_id, client_id, client_name, day_of_week, "time", duration_minutes, status, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
	`), id, specialistID, clientID, clientName, dayOfWeek, timeStr, durationMinutes, createdBy)
	if err != nil {
		return nil, err
	}

	return GetRecurringScheduleByID(id)
}

/***************************************************************************************************
* CreateRecurringScheduleFull creates a recurring schedule with all Phase 2 fields.
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - specialistID: Identifier used to target the current record.
* - clientName: Client name used by the current operation.
* - dayOfWeek: Day of week used by the current operation.
* - timeStr: Time value used by the current operation.
* - durationMinutes: Duration value used by the current operation.
* - createdBy: Created by used by the current operation.
* - sessionTypeID: Identifier used to target the current record.
* - daysOfWeek: Days of week used by the current operation.
* - startDate: Date value used by the current operation.
* - endDate: Date value used by the current operation.
* - dayTimes: Time value used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CreateRecurringScheduleFull(specialistID, clientID, clientName string, dayOfWeek int, timeStr string, durationMinutes int, createdBy string, sessionTypeID string, daysOfWeek string, startDate string, endDate string, dayTimes string) (*models.RecurringSchedule, error) {
	id := uuid.New().String()

	_, err := DB.Exec(Q(`
		INSERT INTO recurring_schedules (id, specialist_id, client_id, client_name, day_of_week, "time", duration_minutes, status, created_by, session_type_id, days_of_week, start_date, end_date, day_times)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
	`), id, specialistID, clientID, clientName, dayOfWeek, timeStr, durationMinutes, createdBy, sessionTypeID, daysOfWeek, startDate, endDate, dayTimes)
	if err != nil {
		return nil, err
	}

	return GetRecurringScheduleByID(id)
}

/***************************************************************************************************
* Returns recurring schedule by id.
*
* Parameters:
* - id: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetRecurringScheduleByID(id string) (*models.RecurringSchedule, error) {
	s, err := scanRecurringSchedule(DB.QueryRow(Q(recurringSelectQuery("rs.id = ?", "")), id))

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

/***************************************************************************************************
* Returns active recurring schedules.
*
* Parameters:
* - None.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetActiveRecurringSchedules() ([]models.RecurringSchedule, error) {
	rows, err := DB.Query(recurringSelectQuery("rs.status = 'active'", `rs.day_of_week, rs."time"`))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRecurringSchedules(rows)
}

/***************************************************************************************************
* Returns recurring schedules by specialist id.
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
func GetRecurringSchedulesBySpecialistID(specialistID string) ([]models.RecurringSchedule, error) {
	rows, err := DB.Query(Q(recurringSelectQuery("rs.specialist_id = ?", "rs.created_at DESC")), specialistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRecurringSchedules(rows)
}

/***************************************************************************************************
* Returns recurring schedules by client id.
*
* Parameters:
* - clientID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetRecurringSchedulesByClientID(clientID string) ([]models.RecurringSchedule, error) {
	rows, err := DB.Query(Q(recurringSelectQuery("rs.client_id = ?", "rs.created_at DESC")), clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRecurringSchedules(rows)
}

/***************************************************************************************************
* Updates recurring schedule status.
*
* Parameters:
* - id: Identifier used to target the current record.
* - status: Status used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateRecurringScheduleStatus(id string, status models.RecurringScheduleStatus) error {
	_, err := DB.Exec(Q(`UPDATE recurring_schedules SET status = ? WHERE id = ?`), status, id)
	return err
}

/***************************************************************************************************
* Returns bookings by recurring schedule id.
*
* Parameters:
* - scheduleID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetBookingsByRecurringScheduleID(scheduleID string) ([]models.Booking, error) {
	rows, err := DB.Query(Q(bookingSelectQuery("b.recurring_schedule_id = ?", "b.starts_at ASC")), scheduleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBookings(rows)
}

/***************************************************************************************************
* GetRecurringScheduleWithBookings loads a schedule and its related bookings.
*
* Parameters:
* - id: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetRecurringScheduleWithBookings(id string) (*models.RecurringSchedule, error) {
	schedule, err := GetRecurringScheduleByID(id)
	if err != nil || schedule == nil {
		return schedule, err
	}

	/***************************************************************************************************
	* Load related bookings.
	***************************************************************************************************/
	bookings, err := GetBookingsByRecurringScheduleID(id)
	if err == nil {
		schedule.Bookings = bookings
	}

	return schedule, nil
}

/***************************************************************************************************
* ApproveAndGenerateBookings approves a recurring schedule and generates bookings. Returns the
* number of bookings created.
*
* Parameters:
* - scheduleID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func ApproveAndGenerateBookings(scheduleID string) (int, error) {
	schedule, err := GetRecurringScheduleByID(scheduleID)
	if err != nil {
		return 0, err
	}
	if schedule == nil {
		return 0, fmt.Errorf("schedule not found")
	}

	/***************************************************************************************************
	* Parse days of week.
	***************************************************************************************************/
	daysOfWeek := parseDaysOfWeekStr(schedule.DaysOfWeek)

	/***************************************************************************************************
	* Parse per-day times if available.
	***************************************************************************************************/
	dayTimesMap := parseDayTimesJSON(schedule.DayTimes)

	/***************************************************************************************************
	* Parse dates.
	***************************************************************************************************/
	startDate, err := time.Parse("2006-01-02", schedule.StartDate)
	if err != nil {
		return 0, fmt.Errorf("invalid start_date: %v", err)
	}
	endDate, err := time.Parse("2006-01-02", schedule.EndDate)
	if err != nil {
		return 0, fmt.Errorf("invalid end_date: %v", err)
	}

	/***************************************************************************************************
	* Determine session type ID.
	***************************************************************************************************/
	sessionTypeID := schedule.SessionTypeID
	if sessionTypeID == "" {
		/***************************************************************************************************
		* Fallback: find first session type for trainer.
		***************************************************************************************************/
		services, _ := GetSessionTypesBySpecialistID(schedule.SpecialistID)
		if len(services) > 0 {
			sessionTypeID = services[0].ID
		}
	}

	/***************************************************************************************************
	* Parse fallback time.
	***************************************************************************************************/
	fallbackTimeParts := parseTimeStr(schedule.Time)

	/***************************************************************************************************
	* Get working hours and days off for filtering.
	***************************************************************************************************/
	workingHours, _ := GetWorkingHoursBySpecialistID(schedule.SpecialistID)
	daysOff, _ := GetDaysOffBySpecialistID(schedule.SpecialistID)

	dayOffSet := make(map[string]bool)
	for _, d := range daysOff {
		dayOffSet[d.Date.Format("2006-01-02")] = true
	}
	workingDaySet := make(map[int]bool)
	for _, wh := range workingHours {
		workingDaySet[wh.DayOfWeek] = true
	}
	requestedDays := make(map[int]bool)
	for _, d := range daysOfWeek {
		requestedDays[d] = true
	}

	count := 0
	for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
		dow := int(d.Weekday())
		if !requestedDays[dow] {
			continue
		}
		if !workingDaySet[dow] {
			continue
		}
		if dayOffSet[d.Format("2006-01-02")] {
			continue
		}

		/***************************************************************************************************
		* Use per-day time if available, otherwise fallback.
		***************************************************************************************************/
		timeParts := fallbackTimeParts
		dowStr := strconv.Itoa(dow)
		if t, ok := dayTimesMap[dowStr]; ok {
			timeParts = parseTimeStr(t)
		}

		startsAt := time.Date(d.Year(), d.Month(), d.Day(), timeParts[0], timeParts[1], 0, 0, time.UTC)
		endsAt := startsAt.Add(time.Duration(schedule.DurationMinutes) * time.Minute)

		/***************************************************************************************************
		* Check conflicts.
		***************************************************************************************************/
		hasConflict, _ := HasConflictingBooking(schedule.SpecialistID, startsAt, endsAt, "")
		if hasConflict {
			continue
		}

		_, err := CreateRecurringBooking(schedule.SpecialistID, schedule.ClientID, sessionTypeID, startsAt, endsAt, schedule.ClientName, schedule.DurationMinutes, scheduleID)
		if err != nil {
			log.Printf("Error creating recurring booking for schedule %s on %s: %v", scheduleID, d.Format("2006-01-02"), err)
			continue
		}
		count++
	}

	/***************************************************************************************************
	* Set status to active.
	***************************************************************************************************/
	UpdateRecurringScheduleStatus(scheduleID, models.RecurringScheduleStatusActive)

	return count, nil
}

/***************************************************************************************************
* Scans recurring schedules.
*
* Parameters:
* - rows: Rows used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func scanRecurringSchedules(rows *sql.Rows) ([]models.RecurringSchedule, error) {
	var schedules []models.RecurringSchedule
	for rows.Next() {
		var s models.RecurringSchedule
		var sessionTypeID, daysOfWeek, startDate, endDate, dayTimes sql.NullString

		if err := rows.Scan(&s.ID, &s.SpecialistID, &s.ClientID, &s.ClientName, &s.DayOfWeek, &s.Time, &s.DurationMinutes, &s.Status, &s.CreatedBy, &s.CreatedAt, &sessionTypeID, &daysOfWeek, &startDate, &endDate, &dayTimes, &s.ClientPhotoURL, &s.ClientDisplayName); err != nil {
			return nil, err
		}

		if sessionTypeID.Valid {
			s.SessionTypeID = sessionTypeID.String
		}
		if daysOfWeek.Valid {
			s.DaysOfWeek = daysOfWeek.String
		}
		if startDate.Valid {
			s.StartDate = startDate.String
		}
		if endDate.Valid {
			s.EndDate = endDate.String
		}
		if dayTimes.Valid {
			s.DayTimes = dayTimes.String
		}

		schedules = append(schedules, s)
	}
	return schedules, rows.Err()
}

/***************************************************************************************************
* parseDaysOfWeekStr parses a comma-separated string like "1,3,5" into a slice of ints.
*
* Parameters:
* - s: S used by the current operation.
*
* Returns:
* - The computed value for the current operation as []int.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func parseDaysOfWeekStr(s string) []int {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	result := make([]int, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if v, err := strconv.Atoi(p); err == nil {
			result = append(result, v)
		}
	}
	return result
}

/***************************************************************************************************
* parseTimeStr parses "HH:MM" into [hour, minute].
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - The computed value for the current operation as []int.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func parseTimeStr(t string) []int {
	parts := make([]int, 2)
	if len(t) >= 5 {
		parts[0], _ = strconv.Atoi(t[0:2])
		parts[1], _ = strconv.Atoi(t[3:5])
	}
	return parts
}

/***************************************************************************************************
* parseDayTimesJSON parses a JSON string like `{"1":"09:00","3":"10:30"}` into a map.
*
* Parameters:
* - s: S used by the current operation.
*
* Returns:
* - The computed value for the current operation as map[string]string.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func parseDayTimesJSON(s string) map[string]string {
	if s == "" {
		return nil
	}
	var m map[string]string
	if err := json.Unmarshal([]byte(s), &m); err != nil {
		return nil
	}
	return m
}
