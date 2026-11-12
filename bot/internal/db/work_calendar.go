package db

import (
	"database/sql"
	"encoding/json"
	"sort"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* workDateLayout is the storage and API format of a calendar date.
***************************************************************************************************/
const workDateLayout = "2006-01-02"

/***************************************************************************************************
* WorkCalendar answers "does the specialist work on this date, and during which hours?" for both
* schedule modes, so callers never have to branch on the mode or on weekdays themselves:
* - weekly: the weekday template (working_hours) minus days_off;
* - dates:  every date is closed unless it has a work_dates row; days_off are ignored.
*
* Dates are passed as UTC wall-clock values (like bookings); only their calendar day matters.
***************************************************************************************************/
type WorkCalendar struct {
	mode             string
	hoursByDay       map[int][]models.WorkingHours
	daysOff          map[string]bool
	workDates        map[string]string
	defaultIntervals []models.WorkInterval
	specialistID     string
}

/***************************************************************************************************
* ParseWorkIntervals decodes a JSON intervals column ([{"startTime":..,"endTime":..}]). Empty or
* malformed input yields nil so a bad row never breaks a whole schedule.
*
* Parameters:
* - raw: JSON text stored in work_dates.intervals or specialists.default_intervals.
*
* Returns:
* - The decoded intervals sorted by start time, or nil when there are none.
***************************************************************************************************/
func ParseWorkIntervals(raw string) []models.WorkInterval {
	if raw == "" {
		return nil
	}
	var intervals []models.WorkInterval
	if err := json.Unmarshal([]byte(raw), &intervals); err != nil {
		return nil
	}
	if len(intervals) == 0 {
		return nil
	}
	sort.SliceStable(intervals, func(i, j int) bool {
		if intervals[i].StartTime != intervals[j].StartTime {
			return intervals[i].StartTime < intervals[j].StartTime
		}
		return intervals[i].EndTime < intervals[j].EndTime
	})
	return intervals
}

/***************************************************************************************************
* EffectiveWorkIntervals resolves the hours of a work date: its own intervals when present,
* otherwise the specialist defaults.
*
* Parameters:
* - own: Raw JSON of the work date's own intervals ("" when it follows the defaults).
* - defaults: Raw JSON of the specialist's default intervals.
*
* Returns:
* - The effective intervals (never nil).
***************************************************************************************************/
func EffectiveWorkIntervals(own, defaults string) []models.WorkInterval {
	if intervals := ParseWorkIntervals(own); len(intervals) > 0 {
		return intervals
	}
	if intervals := ParseWorkIntervals(defaults); len(intervals) > 0 {
		return intervals
	}
	return []models.WorkInterval{}
}

/***************************************************************************************************
* LoadWorkCalendar loads everything needed to evaluate a specialist's schedule.
*
* Parameters:
* - specialistID: Identifier of the specialist.
*
* Returns:
* - The calendar, or an error when the specialist or schedule rows cannot be read. An unknown
*   specialist yields a weekly calendar built from whatever rows exist (normally empty).
*
* Side effects:
* - Reads from the shared database connection.
***************************************************************************************************/
func LoadWorkCalendar(specialistID string) (*WorkCalendar, error) {
	specialist, err := GetSpecialistByID(specialistID)
	if err != nil {
		return nil, err
	}
	return LoadWorkCalendarForSpecialist(specialistID, specialist)
}

/***************************************************************************************************
* LoadWorkCalendarForSpecialist is LoadWorkCalendar for callers that already hold the specialist
* row (saves one query per request). A nil specialist is treated as weekly mode.
***************************************************************************************************/
func LoadWorkCalendarForSpecialist(specialistID string, specialist *models.Specialist) (*WorkCalendar, error) {
	c := &WorkCalendar{
		mode:         models.ScheduleModeWeekly,
		specialistID: specialistID,
	}
	if specialist != nil && specialist.ScheduleMode == models.ScheduleModeDates {
		c.mode = models.ScheduleModeDates
		c.defaultIntervals = ParseWorkIntervals(specialist.DefaultIntervals)
	}

	if c.mode == models.ScheduleModeDates {
		rows, err := DB.Query(Q(`SELECT date, intervals FROM work_dates WHERE specialist_id = ?`), specialistID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		c.workDates = make(map[string]string)
		for rows.Next() {
			var dateStr string
			var intervals sql.NullString
			if err := rows.Scan(&dateStr, &intervals); err != nil {
				return nil, err
			}
			c.workDates[parseDateString(dateStr).Format(workDateLayout)] = intervals.String
		}
		return c, rows.Err()
	}

	hours, err := GetWorkingHoursBySpecialistID(specialistID)
	if err != nil {
		return nil, err
	}
	c.hoursByDay = make(map[int][]models.WorkingHours)
	for _, wh := range hours {
		c.hoursByDay[wh.DayOfWeek] = append(c.hoursByDay[wh.DayOfWeek], wh)
	}

	rows, err := DB.Query(Q(`SELECT date FROM days_off WHERE specialist_id = ?`), specialistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	c.daysOff = make(map[string]bool)
	for rows.Next() {
		var dateStr string
		if err := rows.Scan(&dateStr); err != nil {
			return nil, err
		}
		c.daysOff[parseDateString(dateStr).Format(workDateLayout)] = true
	}
	return c, rows.Err()
}

/***************************************************************************************************
* Mode returns the schedule mode the calendar was loaded with: "weekly" or "dates".
***************************************************************************************************/
func (c *WorkCalendar) Mode() string {
	if c == nil || c.mode == "" {
		return models.ScheduleModeWeekly
	}
	return c.mode
}

/***************************************************************************************************
* IsWorkingDate reports whether the specialist works on the given date.
* - weekly: the weekday has working hours and the date is not a day off;
* - dates:  a work_dates row exists for the date.
***************************************************************************************************/
func (c *WorkCalendar) IsWorkingDate(d time.Time) bool {
	return len(c.IntervalsFor(d)) > 0
}

/***************************************************************************************************
* IntervalsFor returns the working intervals of a date as WorkingHours rows (DayOfWeek set from
* the date), or an empty slice when the specialist does not work that day.
***************************************************************************************************/
func (c *WorkCalendar) IntervalsFor(d time.Time) []models.WorkingHours {
	result := make([]models.WorkingHours, 0)
	if c == nil {
		return result
	}
	dow := int(d.Weekday())
	key := d.Format(workDateLayout)

	if c.Mode() == models.ScheduleModeDates {
		own, ok := c.workDates[key]
		if !ok {
			return result
		}
		intervals := ParseWorkIntervals(own)
		if len(intervals) == 0 {
			intervals = c.defaultIntervals
		}
		for _, in := range intervals {
			result = append(result, models.WorkingHours{
				SpecialistID: c.specialistID,
				DayOfWeek:    dow,
				StartTime:    in.StartTime,
				EndTime:      in.EndTime,
			})
		}
		return result
	}

	if c.daysOff[key] {
		return result
	}
	return append(result, c.hoursByDay[dow]...)
}

/***************************************************************************************************
* GetWorkDates returns the specialist's explicitly opened dates from `from` onward, ordered by
* date. Only the calendar day of `from` matters.
*
* Parameters:
* - specialistID: Identifier of the specialist.
* - from: First date (inclusive) to return.
*
* Returns:
* - The work dates (Intervals is the raw JSON, "" when the date uses the default hours).
*
* Side effects:
* - Reads from the shared database connection.
***************************************************************************************************/
func GetWorkDates(specialistID string, from time.Time) ([]models.WorkDate, error) {
	rows, err := DB.Query(Q(`
		SELECT id, specialist_id, date, intervals
		FROM work_dates
		WHERE specialist_id = ? AND date >= ?
		ORDER BY date ASC
	`), specialistID, from.Format(workDateLayout))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWorkDates(rows)
}

/***************************************************************************************************
* GetWorkDatesFromToday is GetWorkDates starting at the database's current date, matching how
* days_off decide "today onward".
***************************************************************************************************/
func GetWorkDatesFromToday(specialistID string) ([]models.WorkDate, error) {
	rows, err := DB.Query(Q(`
		SELECT id, specialist_id, date, intervals
		FROM work_dates
		WHERE specialist_id = ? AND date >= `+DateNow()+`
		ORDER BY date ASC
	`), specialistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWorkDates(rows)
}

/***************************************************************************************************
* scanWorkDates reads work_dates rows (id, specialist_id, date, intervals).
***************************************************************************************************/
func scanWorkDates(rows *sql.Rows) ([]models.WorkDate, error) {
	result := make([]models.WorkDate, 0)
	for rows.Next() {
		var wd models.WorkDate
		var dateStr string
		var intervals sql.NullString
		if err := rows.Scan(&wd.ID, &wd.SpecialistID, &dateStr, &intervals); err != nil {
			return nil, err
		}
		wd.Date = parseDateString(dateStr)
		wd.Intervals = intervals.String
		result = append(result, wd)
	}
	return result, rows.Err()
}

/***************************************************************************************************
* CountWorkDatesInRange counts the specialist's work dates within [from, to] (inclusive).
***************************************************************************************************/
func CountWorkDatesInRange(specialistID string, from, to time.Time) (int, error) {
	var count int
	err := DB.QueryRow(Q(`
		SELECT COUNT(*) FROM work_dates
		WHERE specialist_id = ? AND date >= ? AND date <= ?
	`), specialistID, from.Format(workDateLayout), to.Format(workDateLayout)).Scan(&count)
	return count, err
}

/***************************************************************************************************
* WorkDateInput describes one date to open (or update) through SetWorkDates. Intervals is the raw
* JSON of the date's own hours, or "" to follow the specialist's default hours.
***************************************************************************************************/
type WorkDateInput struct {
	Date      time.Time
	Intervals string
}

/***************************************************************************************************
* SetWorkDates is the ONE write path for a specialist's open dates: it upserts the dates to open
* (replacing their intervals) and deletes the dates to close inside a single transaction.
* Validation (past dates, bookings on closed dates, interval shape) belongs to the callers; shared
* room calendars will add their ownership checks here so every writer goes through them.
*
* Parameters:
* - specialistID: Identifier of the specialist.
* - open: Dates to open or update.
* - close: Dates to close.
*
* Returns:
* - An error when the transaction cannot complete; nothing is changed in that case.
*
* Side effects:
* - Writes to the shared database connection.
***************************************************************************************************/
func SetWorkDates(specialistID string, open []WorkDateInput, close []time.Time) error {
	if len(open) == 0 && len(close) == 0 {
		return nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	/***************************************************************************************************
	* Room invariant: a specialist who shares a room owns, in room_days, exactly the upcoming dates
	* they have open. Opening a date claims it (or fails when another member owns it); closing it
	* releases it.
	***************************************************************************************************/
	if err := txApplyRoomOwnership(tx, specialistID, open, close); err != nil {
		return err
	}

	for _, in := range open {
		if err := txUpsertWorkDate(tx, specialistID, in.Date.Format(workDateLayout), in.Intervals, true); err != nil {
			return err
		}
	}
	for _, d := range close {
		if err := txDeleteWorkDate(tx, specialistID, d.Format(workDateLayout)); err != nil {
			return err
		}
	}

	return tx.Commit()
}

/***************************************************************************************************
* txUpsertWorkDate inserts a work date, or on conflict either replaces its intervals (replace) or
* leaves the existing row untouched (keeps custom hours).
***************************************************************************************************/
func txUpsertWorkDate(q dbExecer, specialistID, dateStr, intervals string, replace bool) error {
	conflict := `DO NOTHING`
	if replace {
		conflict = `DO UPDATE SET intervals = excluded.intervals`
	}
	_, err := q.Exec(Q(`
		INSERT INTO work_dates (id, specialist_id, date, intervals)
		VALUES (?, ?, ?, ?)
		ON CONFLICT (specialist_id, date) `+conflict), uuid.New().String(), specialistID, dateStr, intervals)
	return err
}

/***************************************************************************************************
* txDeleteWorkDate removes a specialist's work date row (no-op when absent).
***************************************************************************************************/
func txDeleteWorkDate(q dbExecer, specialistID, dateStr string) error {
	_, err := q.Exec(Q(`DELETE FROM work_dates WHERE specialist_id = ? AND date = ?`), specialistID, dateStr)
	return err
}

/***************************************************************************************************
* CountActiveBookingsByDate counts pending and confirmed bookings (the statuses that block slots)
* starting on each of the given dates.
*
* Parameters:
* - specialistID: Identifier of the specialist.
* - dates: Calendar days to inspect (UTC wall-clock, like the stored bookings).
*
* Returns:
* - A map "YYYY-MM-DD" -> number of active bookings; dates without bookings are omitted.
*
* Side effects:
* - Reads from the shared database connection.
***************************************************************************************************/
func CountActiveBookingsByDate(specialistID string, dates []time.Time) (map[string]int, error) {
	return countActiveBookingsByDate(DB, specialistID, dates)
}

/***************************************************************************************************
* countActiveBookingsByDate is CountActiveBookingsByDate on any query runner (database or tx).
***************************************************************************************************/
func countActiveBookingsByDate(q dbExecer, specialistID string, dates []time.Time) (map[string]int, error) {
	counts := make(map[string]int)
	if len(dates) == 0 {
		return counts, nil
	}

	wanted := make(map[string]bool, len(dates))
	minDate, maxDate := dates[0], dates[0]
	for _, d := range dates {
		wanted[d.Format(workDateLayout)] = true
		if d.Before(minDate) {
			minDate = d
		}
		if d.After(maxDate) {
			maxDate = d
		}
	}
	rangeStart := time.Date(minDate.Year(), minDate.Month(), minDate.Day(), 0, 0, 0, 0, time.UTC)
	rangeEnd := time.Date(maxDate.Year(), maxDate.Month(), maxDate.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, 1)

	startsAt, err := activeBookingStarts(q, specialistID, rangeStart, rangeEnd)
	if err != nil {
		return nil, err
	}
	for _, s := range startsAt {
		key := s.Format(workDateLayout)
		if wanted[key] {
			counts[key]++
		}
	}
	return counts, nil
}

/***************************************************************************************************
* BookedDateCount is the number of active bookings on one calendar day.
***************************************************************************************************/
type BookedDateCount struct {
	Date  string
	Count int
}

/***************************************************************************************************
* GetActiveBookingCountsFrom returns, in ONE grouped query, how many pending/confirmed bookings the
* specialist has on each calendar day from `from` onward (days without bookings are omitted).
*
* Parameters:
* - specialistID: Identifier of the specialist.
* - from: First day (inclusive); only its calendar day matters.
*
* Returns:
* - Per-day counts ordered by date ("YYYY-MM-DD").
*
* Side effects:
* - Reads from the shared database connection.
***************************************************************************************************/
func GetActiveBookingCountsFrom(specialistID string, from time.Time) ([]BookedDateCount, error) {
	dayExpr := `substr(starts_at, 1, 10)`
	if isPostgres {
		// starts_at is TIMESTAMPTZ holding UTC wall-clock values; pin the zone so the day does not
		// depend on the session TimeZone setting.
		dayExpr = `((starts_at AT TIME ZONE 'UTC')::date)`
	}
	rangeStart := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.UTC)

	rows, err := DB.Query(Q(`
		SELECT `+dayExpr+` AS day, COUNT(*)
		FROM bookings
		WHERE specialist_id = ? AND status IN ('pending', 'confirmed') AND starts_at >= ?
		GROUP BY `+dayExpr+`
		ORDER BY `+dayExpr+`
	`), specialistID, rangeStart)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]BookedDateCount, 0)
	for rows.Next() {
		var dayStr string
		var count int
		if err := rows.Scan(&dayStr, &count); err != nil {
			return nil, err
		}
		result = append(result, BookedDateCount{Date: parseDateString(dayStr).Format(workDateLayout), Count: count})
	}
	return result, rows.Err()
}

/***************************************************************************************************
* GetFutureActiveBookingDates returns the distinct calendar days, from `from` onward, that have at
* least one pending or confirmed booking, in ascending order.
*
* Parameters:
* - specialistID: Identifier of the specialist.
* - from: First day (inclusive); only its calendar day matters.
*
* Side effects:
* - Reads from the shared database connection.
***************************************************************************************************/
func GetFutureActiveBookingDates(specialistID string, from time.Time) ([]time.Time, error) {
	rangeStart := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.UTC)
	startsAt, err := activeBookingStarts(DB, specialistID, rangeStart, time.Time{})
	if err != nil {
		return nil, err
	}

	seen := make(map[string]bool)
	dates := make([]time.Time, 0)
	for _, s := range startsAt {
		day := time.Date(s.Year(), s.Month(), s.Day(), 0, 0, 0, 0, time.UTC)
		key := day.Format(workDateLayout)
		if seen[key] {
			continue
		}
		seen[key] = true
		dates = append(dates, day)
	}
	sort.Slice(dates, func(i, j int) bool { return dates[i].Before(dates[j]) })
	return dates, nil
}

/***************************************************************************************************
* activeBookingStarts lists the starts_at of pending/confirmed bookings with starts_at >= start and,
* when end is non-zero, starts_at < end.
***************************************************************************************************/
func activeBookingStarts(q dbExecer, specialistID string, start, end time.Time) ([]time.Time, error) {
	query := `SELECT starts_at FROM bookings
		WHERE specialist_id = ? AND status IN ('pending', 'confirmed') AND starts_at >= ?`
	args := []interface{}{specialistID, start}
	if !end.IsZero() {
		query += ` AND starts_at < ?`
		args = append(args, end)
	}

	rows, err := q.Query(Q(query), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []time.Time
	for rows.Next() {
		var s time.Time
		if err := rows.Scan(&s); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

/***************************************************************************************************
* SetScheduleSettings stores the specialist's schedule mode and default intervals. Switching a
* linked room member away from dates mode is refused with ErrRoomRequiresDatesMode.
*
* Parameters:
* - specialistID: Identifier of the specialist.
* - mode: "weekly" or "dates".
* - defaultIntervalsJSON: Raw JSON of the default intervals ("" to clear).
*
* Side effects:
* - Writes to the shared database connection.
***************************************************************************************************/
func SetScheduleSettings(specialistID, mode, defaultIntervalsJSON string) error {
	// A linked room member must stay in dates mode: the room assigns days to colleagues, which only
	// dates mode (opened days) can honour for clients.
	if mode != models.ScheduleModeDates {
		member, err := txMemberOfSpecialist(DB, specialistID)
		if err != nil {
			return err
		}
		if member != nil {
			return ErrRoomRequiresDatesMode
		}
	}
	_, err := DB.Exec(Q(`UPDATE specialists SET schedule_mode = ?, default_intervals = ? WHERE id = ?`),
		mode, defaultIntervalsJSON, specialistID)
	return err
}

/***************************************************************************************************
* UpdateSpecialistWorkDaysReminderPref toggles the weekly "open your work days" reminder.
***************************************************************************************************/
func UpdateSpecialistWorkDaysReminderPref(id string, enabled bool) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET notify_work_days_reminder = ? WHERE id = ?`), BoolVal(enabled), id)
	return err
}

/***************************************************************************************************
* GetWorkDaysReminderWeek returns the ISO week (e.g. "2026-W47") the weekly work-days reminder was
* last attempted for, or "" when it never was. Kept out of specialistColumns on purpose.
***************************************************************************************************/
func GetWorkDaysReminderWeek(specialistID string) (string, error) {
	var week sql.NullString
	err := DB.QueryRow(Q(`SELECT work_days_reminder_week FROM specialists WHERE id = ?`), specialistID).Scan(&week)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return week.String, nil
}

/***************************************************************************************************
* SetWorkDaysReminderWeek records the ISO week the weekly work-days reminder was attempted for.
***************************************************************************************************/
func SetWorkDaysReminderWeek(specialistID, week string) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET work_days_reminder_week = ? WHERE id = ?`), week, specialistID)
	return err
}
