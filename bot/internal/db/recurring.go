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

const recurringColumns = `id, specialist_id, client_id, client_name, day_of_week, "time", duration_minutes, status, created_by, created_at, session_type_id, days_of_week, start_date, end_date, day_times,
	COALESCE((SELECT photo_url FROM clients WHERE id = recurring_schedules.client_id), ''),
	COALESCE((SELECT display_name FROM clients WHERE id = recurring_schedules.client_id), '')`

func scanRecurringSchedule(row interface{ Scan(...interface{}) error }) (*models.RecurringSchedule, error) {
	var s models.RecurringSchedule
	var sessionTypeID, daysOfWeek, startDate, endDate, dayTimes sql.NullString

	err := row.Scan(&s.ID, &s.SpecialistID, &s.ClientID, &s.ClientName, &s.DayOfWeek, &s.Time, &s.DurationMinutes, &s.Status, &s.CreatedBy, &s.CreatedAt, &sessionTypeID, &daysOfWeek, &startDate, &endDate, &dayTimes, &s.ClientPhotoURL, &s.ClientDisplayName)
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

	return &s, nil
}

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

// CreateRecurringScheduleFull creates a recurring schedule with all Phase 2 fields
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

func GetRecurringScheduleByID(id string) (*models.RecurringSchedule, error) {
	s, err := scanRecurringSchedule(DB.QueryRow(Q(`
		SELECT `+recurringColumns+`
		FROM recurring_schedules
		WHERE id = ?
	`), id))

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

func GetActiveRecurringSchedules() ([]models.RecurringSchedule, error) {
	rows, err := DB.Query(`
		SELECT ` + recurringColumns + `
		FROM recurring_schedules
		WHERE status = 'active'
		ORDER BY day_of_week, "time"
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRecurringSchedules(rows)
}

func GetRecurringSchedulesBySpecialistID(specialistID string) ([]models.RecurringSchedule, error) {
	rows, err := DB.Query(Q(`
		SELECT `+recurringColumns+`
		FROM recurring_schedules
		WHERE specialist_id = ?
		ORDER BY created_at DESC
	`), specialistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRecurringSchedules(rows)
}

func GetRecurringSchedulesByClientID(clientID string) ([]models.RecurringSchedule, error) {
	rows, err := DB.Query(Q(`
		SELECT `+recurringColumns+`
		FROM recurring_schedules
		WHERE client_id = ?
		ORDER BY created_at DESC
	`), clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRecurringSchedules(rows)
}

func UpdateRecurringScheduleStatus(id string, status models.RecurringScheduleStatus) error {
	_, err := DB.Exec(Q(`UPDATE recurring_schedules SET status = ? WHERE id = ?`), status, id)
	return err
}

func GetBookingsByRecurringScheduleID(scheduleID string) ([]models.Booking, error) {
	rows, err := DB.Query(Q(`
		SELECT `+bookingColumns+`
		FROM bookings
		WHERE recurring_schedule_id = ?
		ORDER BY starts_at
	`), scheduleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBookings(rows)
}

// GetRecurringScheduleWithBookings loads a schedule and its related bookings
func GetRecurringScheduleWithBookings(id string) (*models.RecurringSchedule, error) {
	schedule, err := GetRecurringScheduleByID(id)
	if err != nil || schedule == nil {
		return schedule, err
	}

	// Load session type if present
	if schedule.SessionTypeID != "" {
		st, err := GetSessionTypeByID(schedule.SessionTypeID)
		if err == nil && st != nil {
			schedule.SessionType = st
		}
	}

	// Load related bookings
	bookings, err := GetBookingsByRecurringScheduleID(id)
	if err == nil {
		schedule.Bookings = bookings
	}

	return schedule, nil
}

// ApproveAndGenerateBookings approves a recurring schedule and generates bookings.
// Returns the number of bookings created.
func ApproveAndGenerateBookings(scheduleID string) (int, error) {
	schedule, err := GetRecurringScheduleByID(scheduleID)
	if err != nil {
		return 0, err
	}
	if schedule == nil {
		return 0, fmt.Errorf("schedule not found")
	}

	// Parse days of week
	daysOfWeek := parseDaysOfWeekStr(schedule.DaysOfWeek)

	// Parse per-day times if available
	dayTimesMap := parseDayTimesJSON(schedule.DayTimes)

	// Parse dates
	startDate, err := time.Parse("2006-01-02", schedule.StartDate)
	if err != nil {
		return 0, fmt.Errorf("invalid start_date: %v", err)
	}
	endDate, err := time.Parse("2006-01-02", schedule.EndDate)
	if err != nil {
		return 0, fmt.Errorf("invalid end_date: %v", err)
	}

	// Determine session type ID
	sessionTypeID := schedule.SessionTypeID
	if sessionTypeID == "" {
		// Fallback: find first session type for trainer
		services, _ := GetSessionTypesBySpecialistID(schedule.SpecialistID)
		if len(services) > 0 {
			sessionTypeID = services[0].ID
		}
	}

	// Parse fallback time
	fallbackTimeParts := parseTimeStr(schedule.Time)

	// Get working hours and days off for filtering
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

		// Use per-day time if available, otherwise fallback
		timeParts := fallbackTimeParts
		dowStr := strconv.Itoa(dow)
		if t, ok := dayTimesMap[dowStr]; ok {
			timeParts = parseTimeStr(t)
		}

		startsAt := time.Date(d.Year(), d.Month(), d.Day(), timeParts[0], timeParts[1], 0, 0, time.UTC)
		endsAt := startsAt.Add(time.Duration(schedule.DurationMinutes) * time.Minute)

		// Check conflicts
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

	// Set status to active
	UpdateRecurringScheduleStatus(scheduleID, models.RecurringScheduleStatusActive)

	return count, nil
}

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

// parseDaysOfWeekStr parses a comma-separated string like "1,3,5" into a slice of ints
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

// parseTimeStr parses "HH:MM" into [hour, minute]
func parseTimeStr(t string) []int {
	parts := make([]int, 2)
	if len(t) >= 5 {
		parts[0], _ = strconv.Atoi(t[0:2])
		parts[1], _ = strconv.Atoi(t[3:5])
	}
	return parts
}

// parseDayTimesJSON parses a JSON string like `{"1":"09:00","3":"10:30"}` into a map
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
