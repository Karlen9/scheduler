package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sort"
	"time"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* maxWorkDatesPerRequest caps how many dates a single PUT /api/admin/work-dates call may touch
* (open and close entries together).
***************************************************************************************************/
const maxWorkDatesPerRequest = 400

/***************************************************************************************************
* AdminWorkDate is one opened date as the admin UI sees it: its effective hours and whether they
* are the date's own (custom) or inherited from the specialist's default intervals.
***************************************************************************************************/
type AdminWorkDate struct {
	Date         string                `json:"date"`
	Intervals    []models.WorkInterval `json:"intervals"`
	Custom       bool                  `json:"custom"`
	BookingCount int                   `json:"bookingCount"`
}

/***************************************************************************************************
* AdminBookedDate is a calendar day with active (pending/confirmed) bookings, open or not.
***************************************************************************************************/
type AdminBookedDate struct {
	Date         string `json:"date"`
	BookingCount int    `json:"bookingCount"`
}

/***************************************************************************************************
* UpdateScheduleSettingsRequest is the body of PUT /api/admin/schedule-settings.
***************************************************************************************************/
type UpdateScheduleSettingsRequest struct {
	ScheduleMode     string                `json:"scheduleMode"`
	DefaultIntervals []models.WorkInterval `json:"defaultIntervals"`
}

/***************************************************************************************************
* ScheduleSettingsResponse is the answer of PUT /api/admin/schedule-settings. AutoOpened is the
* number of dates that were opened automatically because they already had active bookings.
***************************************************************************************************/
type ScheduleSettingsResponse struct {
	ScheduleMode     string                `json:"scheduleMode"`
	DefaultIntervals []models.WorkInterval `json:"defaultIntervals"`
	AutoOpened       int                   `json:"autoOpened"`
}

/***************************************************************************************************
* WorkDateOpenRequest is one entry of the "open" list of PUT /api/admin/work-dates. Intervals may
* be null/empty to use the specialist's default hours.
***************************************************************************************************/
type WorkDateOpenRequest struct {
	Date      string                `json:"date"`
	Intervals []models.WorkInterval `json:"intervals"`
}

/***************************************************************************************************
* UpdateWorkDatesRequest is the body of PUT /api/admin/work-dates.
***************************************************************************************************/
type UpdateWorkDatesRequest struct {
	Open  []WorkDateOpenRequest `json:"open"`
	Close []string              `json:"close"`
}

/***************************************************************************************************
* scheduleModeOf returns the specialist's schedule mode, treating an empty value as weekly.
***************************************************************************************************/
func scheduleModeOf(specialist *models.Specialist) string {
	if specialist != nil && specialist.ScheduleMode == models.ScheduleModeDates {
		return models.ScheduleModeDates
	}
	return models.ScheduleModeWeekly
}

/***************************************************************************************************
* specialistToday returns today's calendar date in the specialist's timezone, as a UTC midnight
* value (the storage convention for dates).
***************************************************************************************************/
func specialistToday(timezone string) time.Time {
	now := scheduleClockNow(timezone)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

/***************************************************************************************************
* normalizeIntervalsJSON sorts the intervals by start time and encodes them as the JSON stored in
* work_dates.intervals / specialists.default_intervals. Empty input yields "" (use defaults).
***************************************************************************************************/
func normalizeIntervalsJSON(intervals []models.WorkInterval) string {
	if len(intervals) == 0 {
		return ""
	}
	sorted := append([]models.WorkInterval(nil), intervals...)
	sort.SliceStable(sorted, func(i, j int) bool {
		startI, _ := timeToMinutes(sorted[i].StartTime)
		startJ, _ := timeToMinutes(sorted[j].StartTime)
		return startI < startJ
	})
	encoded, err := json.Marshal(sorted)
	if err != nil {
		return ""
	}
	return string(encoded)
}

/***************************************************************************************************
* adminCalendarStart is the first day the admin calendar reports: the Monday of the previous week
* in the specialist's timezone (past rows are display-only, so the UI can show last week).
***************************************************************************************************/
func adminCalendarStart(timezone string) time.Time {
	return previousWeekMonday(specialistToday(timezone))
}

/***************************************************************************************************
* previousWeekMonday returns the Monday of the week before the one `today` falls in (weeks run
* Monday to Sunday): a Monday gives the Monday 7 days earlier, a Sunday the Monday 13 days earlier.
***************************************************************************************************/
func previousWeekMonday(today time.Time) time.Time {
	daysSinceMonday := (int(today.Weekday()) + 6) % 7
	return today.AddDate(0, 0, -daysSinceMonday-7)
}

/***************************************************************************************************
* loadAdminWorkDates lists the specialist's opened dates from the previous Monday onward in the
* admin shape, each with its active booking count, plus every day from the same start that has
* active bookings (open or not). Both come from one grouped bookings query.
***************************************************************************************************/
func loadAdminWorkDates(specialist *models.Specialist) ([]AdminWorkDate, []AdminBookedDate, error) {
	from := adminCalendarStart(specialist.Timezone)
	rows, err := db.GetWorkDates(specialist.ID, from)
	if err != nil {
		return nil, nil, err
	}
	counts, err := db.GetActiveBookingCountsFrom(specialist.ID, from)
	if err != nil {
		return nil, nil, err
	}

	byDate := make(map[string]int, len(counts))
	booked := make([]AdminBookedDate, 0, len(counts))
	for _, c := range counts {
		byDate[c.Date] = c.Count
		booked = append(booked, AdminBookedDate{Date: c.Date, BookingCount: c.Count})
	}
	return buildAdminWorkDates(rows, specialist.DefaultIntervals, byDate), booked, nil
}

/***************************************************************************************************
* buildAdminWorkDates converts stored work dates into the admin response shape (never nil).
* bookingCounts maps "YYYY-MM-DD" to the number of active bookings on that day.
***************************************************************************************************/
func buildAdminWorkDates(rows []models.WorkDate, defaultIntervals string, bookingCounts map[string]int) []AdminWorkDate {
	result := make([]AdminWorkDate, 0, len(rows))
	for _, row := range rows {
		key := row.Date.Format("2006-01-02")
		result = append(result, AdminWorkDate{
			Date:         key,
			Intervals:    db.EffectiveWorkIntervals(row.Intervals, defaultIntervals),
			Custom:       len(db.ParseWorkIntervals(row.Intervals)) > 0,
			BookingCount: bookingCounts[key],
		})
	}
	return result
}

/***************************************************************************************************
* writeIntervalsValidationError maps a validateWorkIntervals error to a 400 response, mirroring
* how the working-hours endpoint reports the same problems.
***************************************************************************************************/
func writeIntervalsValidationError(w http.ResponseWriter, r *http.Request, err error) {
	if err == errMissingTimeRange {
		httpError(w, r, "Error.MissingTimeRange", http.StatusBadRequest)
		return
	}
	httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
}

/***************************************************************************************************
* HandleAdminUpdateScheduleSettings switches the specialist between "weekly" and "dates" schedule
* modes and stores the default intervals used by dates mode.
*
* When the mode changes from weekly to dates, every future date that already has an active
* booking and is not yet open is opened automatically (through db.SetWorkDates), so no existing
* booking ends up on a closed day.
*
* Request: {"scheduleMode":"weekly"|"dates","defaultIntervals":[{"startTime","endTime"}]}
* Response: {"scheduleMode","defaultIntervals","autoOpened"}
***************************************************************************************************/
func HandleAdminUpdateScheduleSettings(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req UpdateScheduleSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	if req.ScheduleMode != models.ScheduleModeWeekly && req.ScheduleMode != models.ScheduleModeDates {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* Dates mode needs usable default hours; weekly mode keeps the previously stored defaults unless
	* new valid ones are sent.
	***************************************************************************************************/
	if req.ScheduleMode == models.ScheduleModeDates && len(req.DefaultIntervals) == 0 {
		httpError(w, r, "Error.MissingTimeRange", http.StatusBadRequest)
		return
	}
	if len(req.DefaultIntervals) > 0 {
		if err := validateWorkIntervals(req.DefaultIntervals); err != nil {
			writeIntervalsValidationError(w, r, err)
			return
		}
	}
	defaultsJSON := normalizeIntervalsJSON(req.DefaultIntervals)
	if defaultsJSON == "" {
		defaultsJSON = specialist.DefaultIntervals
	}

	/***************************************************************************************************
	* weekly -> dates: open every future date that already has active bookings.
	***************************************************************************************************/
	autoOpened := 0
	if req.ScheduleMode == models.ScheduleModeDates && scheduleModeOf(specialist) != models.ScheduleModeDates {
		today := specialistToday(specialist.Timezone)
		bookedDates, err := db.GetFutureActiveBookingDates(specialist.ID, today)
		if err != nil {
			log.Printf("Error loading booked dates: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
		existing, err := db.GetWorkDates(specialist.ID, today)
		if err != nil {
			log.Printf("Error loading work dates: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
		alreadyOpen := make(map[string]bool, len(existing))
		for _, wd := range existing {
			alreadyOpen[wd.Date.Format("2006-01-02")] = true
		}

		toOpen := make([]db.WorkDateInput, 0)
		for _, d := range bookedDates {
			if !alreadyOpen[d.Format("2006-01-02")] {
				toOpen = append(toOpen, db.WorkDateInput{Date: d})
			}
		}
		if len(toOpen) > 0 {
			if err := db.SetWorkDates(specialist.ID, toOpen, nil); err != nil {
				log.Printf("Error auto-opening work dates: %v", err)
				httpError(w, r, "Error.Internal", http.StatusInternalServerError)
				return
			}
			autoOpened = len(toOpen)
		}
	}

	if err := db.SetScheduleSettings(specialist.ID, req.ScheduleMode, defaultsJSON); err != nil {
		if errors.Is(err, db.ErrRoomRequiresDatesMode) {
			httpError(w, r, "Error.RoomRequiresDatesMode", http.StatusConflict)
			return
		}
		log.Printf("Error updating schedule settings: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupWorkingHours)
	writeJSON(w, ScheduleSettingsResponse{
		ScheduleMode:     req.ScheduleMode,
		DefaultIntervals: db.EffectiveWorkIntervals("", defaultsJSON),
		AutoOpened:       autoOpened,
	})
}

/***************************************************************************************************
* writeWorkDatesConflict answers 409 with a JSON body the mini-app can act on:
* {"error": <message id>, "message": <localized text>, "dates": ["YYYY-MM-DD", ...]}.
***************************************************************************************************/
func writeWorkDatesConflict(w http.ResponseWriter, r *http.Request, msgID string, dates []string) {
	loc := myI18n.L(r.Context())
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusConflict)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"error":   msgID,
		"message": myI18n.T(loc, msgID),
		"dates":   dates,
	})
}

/***************************************************************************************************
* HandleAdminUpdateWorkDates opens and closes calendar dates for dates-mode scheduling.
*
* Request: {"open":[{"date":"YYYY-MM-DD","intervals":[...]|null}],"close":["YYYY-MM-DD"]}
* Response: the admin workDates array ([{"date","intervals","custom","bookingCount"}], from the
* Monday of the previous week onward; past dates are display-only and cannot be changed).
*
* Errors: 400 Error.BadDate / Error.WorkDatePast / Error.BadRequest (also for overlaps, a date in
* both lists, or more than 400 entries) / Error.MissingTimeRange; 409 Error.WorkDateHasBookings
* with the conflicting dates when closing dates that still have pending/confirmed bookings.
*
* Allowed in weekly mode as well: the data is stored but has no effect until dates mode is on.
***************************************************************************************************/
func HandleAdminUpdateWorkDates(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req UpdateWorkDatesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	if len(req.Open)+len(req.Close) > maxWorkDatesPerRequest {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	today := specialistToday(specialist.Timezone)

	/***************************************************************************************************
	* Parse and validate every date and the hours of the dates to open.
	***************************************************************************************************/
	openSet := make(map[string]bool, len(req.Open))
	toOpen := make([]db.WorkDateInput, 0, len(req.Open))
	for _, entry := range req.Open {
		date, err := time.Parse("2006-01-02", entry.Date)
		if err != nil {
			httpError(w, r, "Error.BadDate", http.StatusBadRequest)
			return
		}
		if date.Before(today) {
			httpError(w, r, "Error.WorkDatePast", http.StatusBadRequest)
			return
		}
		if len(entry.Intervals) > 0 {
			if err := validateWorkIntervals(entry.Intervals); err != nil {
				writeIntervalsValidationError(w, r, err)
				return
			}
		}
		openSet[entry.Date] = true
		toOpen = append(toOpen, db.WorkDateInput{Date: date, Intervals: normalizeIntervalsJSON(entry.Intervals)})
	}

	toClose := make([]time.Time, 0, len(req.Close))
	closeKeys := make([]string, 0, len(req.Close))
	for _, dateStr := range req.Close {
		date, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			httpError(w, r, "Error.BadDate", http.StatusBadRequest)
			return
		}
		if date.Before(today) {
			httpError(w, r, "Error.WorkDatePast", http.StatusBadRequest)
			return
		}
		if openSet[dateStr] {
			httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
			return
		}
		toClose = append(toClose, date)
		closeKeys = append(closeKeys, dateStr)
	}

	/***************************************************************************************************
	* Refuse to close dates that still have active bookings.
	***************************************************************************************************/
	if len(toClose) > 0 {
		counts, err := db.CountActiveBookingsByDate(specialist.ID, toClose)
		if err != nil {
			log.Printf("Error counting bookings for work dates: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
		conflicts := make([]string, 0)
		for _, key := range closeKeys {
			if counts[key] > 0 {
				conflicts = append(conflicts, key)
			}
		}
		if len(conflicts) > 0 {
			sort.Strings(conflicts)
			writeWorkDatesConflict(w, r, "Error.WorkDateHasBookings", conflicts)
			return
		}
	}

	/***************************************************************************************************
	* Room members: opening a date claims it for them in the shared room. Remember which of the opened
	* dates they did not already own, so colleagues can be told about the newly taken days.
	***************************************************************************************************/
	roomView, err := db.GetRoomForSpecialist(specialist.ID)
	if err != nil {
		log.Printf("Error loading room for work dates: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	ownedBefore := map[string]bool{}
	if roomView != nil {
		days, err := db.GetRoomDays(roomView.Room.ID, today)
		if err != nil {
			log.Printf("Error loading room days: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
		for _, d := range days {
			if d.MemberID == roomView.MeMember.ID {
				ownedBefore[d.Date.Format("2006-01-02")] = true
			}
		}
	}

	if err := db.SetWorkDates(specialist.ID, toOpen, toClose); err != nil {
		var taken *db.ErrRoomDayTaken
		if errors.As(err, &taken) {
			writeWorkDatesConflict(w, r, "Error.RoomDayTaken", taken.Dates)
			return
		}
		log.Printf("Error updating work dates: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if roomView != nil {
		publishRoomChange(roomView.Room.ID)
		claimed := make([]string, 0)
		seen := map[string]bool{}
		for _, entry := range req.Open {
			if !ownedBefore[entry.Date] && !seen[entry.Date] {
				seen[entry.Date] = true
				claimed = append(claimed, entry.Date)
			}
		}
		sort.Strings(claimed)
		if len(claimed) > 0 && NotifyRoomDaysClaimedFunc != nil {
			if err := NotifyRoomDaysClaimedFunc(roomView.Room.ID, specialist.ID, claimed); err != nil {
				log.Printf("Error notifying room about claimed days: %v", err)
			}
		}
	}

	workDates, _, err := loadAdminWorkDates(specialist)
	if err != nil {
		log.Printf("Error loading work dates: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	changes.Publish(specialist.ID, changes.GroupWorkingHours)
	writeJSON(w, workDates)
}

/***************************************************************************************************
* validateDatesModeSlot enforces, for specialists in dates schedule mode only, that a client-chosen
* slot lies on an opened date and fully inside one of that date's intervals (24:00 is accepted as
* the end of the day). Weekly specialists are never gated, so their behaviour is unchanged.
*
* Parameters:
* - specialist: The specialist being booked.
* - date: The calendar day of the slot.
* - startsAt, endsAt: The slot bounds (UTC wall-clock).
*
* Returns:
* - "" when the slot is allowed, "Error.DateNotAvailable" when it is not, and an error when the
*   calendar cannot be loaded.
***************************************************************************************************/
func validateDatesModeSlot(specialist *models.Specialist, date, startsAt, endsAt time.Time) (string, error) {
	if scheduleModeOf(specialist) != models.ScheduleModeDates {
		return "", nil
	}
	calendar, err := db.LoadWorkCalendarForSpecialist(specialist.ID, specialist)
	if err != nil {
		return "", err
	}

	startMinutes := startsAt.Hour()*60 + startsAt.Minute()
	endMinutes := startMinutes + int(endsAt.Sub(startsAt)/time.Minute)
	for _, interval := range calendar.IntervalsFor(date) {
		from, err := timeToMinutes(interval.StartTime)
		if err != nil {
			continue
		}
		to, err := timeToMinutes(interval.EndTime)
		if err != nil {
			continue
		}
		if startMinutes >= from && endMinutes <= to {
			return "", nil
		}
	}
	return "Error.DateNotAvailable", nil
}
