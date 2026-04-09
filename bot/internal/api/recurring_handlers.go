package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* NotifyRecurringScheduleFunc notifies the approval side about a new recurring schedule request.
* Called with the schedule and the number of preview dates (expected bookings).
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
var NotifyRecurringScheduleFunc func(schedule *models.RecurringSchedule, previewCount int) error

/***************************************************************************************************
* NotifyMoveRequestFunc notifies the other side about a move/reschedule request for a recurring
* booking. Called with (newBooking, oldBooking, requestedBy "client"/"specialist").
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
var NotifyMoveRequestFunc func(newBooking, oldBooking *models.Booking, requestedBy string) error

/***************************************************************************************************
* Shared Types & Helpers.
***************************************************************************************************/
type CreateRecurringScheduleRequest struct {
	SessionTypeID string            `json:"sessionTypeId"`
	DaysOfWeek    []int             `json:"daysOfWeek"`
	Time          string            `json:"time"`
	Period        string            `json:"period"`
	DayTimes      map[string]string `json:"dayTimes,omitempty"`
}

/***************************************************************************************************
* Defines the admin create recurring schedule request type used by the api layer.
***************************************************************************************************/
type AdminCreateRecurringScheduleRequest struct {
	ClientID      string            `json:"clientId"`
	SessionTypeID string            `json:"sessionTypeId"`
	DaysOfWeek    []int             `json:"daysOfWeek"`
	Time          string            `json:"time"`
	Period        string            `json:"period"`
	DayTimes      map[string]string `json:"dayTimes,omitempty"`
}

/***************************************************************************************************
* Defines the preview recurring schedule request type used by the api layer.
***************************************************************************************************/
type PreviewRecurringScheduleRequest struct {
	SessionTypeID string            `json:"sessionTypeId"`
	DaysOfWeek    []int             `json:"daysOfWeek"`
	Time          string            `json:"time"`
	Period        string            `json:"period"`
	DayTimes      map[string]string `json:"dayTimes,omitempty"`
}

/***************************************************************************************************
* Defines the recurring preview response type used by the api layer.
***************************************************************************************************/
type RecurringPreviewResponse struct {
	Dates []string `json:"dates"`
}

/***************************************************************************************************
* Implements the calculate date range logic used by this module.
*
* Parameters:
* - period: Period used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func calculateDateRange(period string) (string, string, error) {
	now := time.Now().UTC()
	startDate := now.AddDate(0, 0, 1)
	var endDate time.Time
	switch period {
	case "1week":
		endDate = startDate.AddDate(0, 0, 7)
	case "1month":
		endDate = startDate.AddDate(0, 1, 0)
	case "3months":
		endDate = startDate.AddDate(0, 3, 0)
	default:
		return "", "", fmt.Errorf("invalid period: %s", period)
	}
	return startDate.Format("2006-01-02"), endDate.Format("2006-01-02"), nil
}

/***************************************************************************************************
* Implements the generate preview dates logic used by this module.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - daysOfWeek: Days of week used by the current operation.
* - timeStr: Time value used by the current operation.
* - startDateStr: Date value used by the current operation.
* - durationMinutes: Duration value used by the current operation.
* - endDateStr: Date value used by the current operation.
* - dayTimes: Time value used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func generatePreviewDates(specialistID string, daysOfWeek []int, timeStr string, durationMinutes int, startDateStr, endDateStr string, dayTimes map[string]string) ([]string, error) {
	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		return nil, err
	}
	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		return nil, err
	}

	workingHours, _ := db.GetWorkingHoursBySpecialistID(specialistID)
	daysOff, _ := db.GetDaysOffBySpecialistID(specialistID)

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

	fallbackHour, fallbackMinute, err := parseTime(timeStr)
	if err != nil {
		return nil, err
	}
	var dates []string
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
		* Use per-day time if available.
		***************************************************************************************************/
		hour := fallbackHour
		minute := fallbackMinute
		dowStr := strconv.Itoa(dow)
		if t, ok := dayTimes[dowStr]; ok {
			hour, minute, err = parseTime(t)
			if err != nil {
				return nil, err
			}
		}
		startsAt := time.Date(d.Year(), d.Month(), d.Day(), hour, minute, 0, 0, time.UTC)
		endsAt := startsAt.Add(time.Duration(durationMinutes) * time.Minute)
		hasConflict, _ := db.HasConflictingBooking(specialistID, startsAt, endsAt, "")
		if hasConflict {
			continue
		}
		dates = append(dates, d.Format("2006-01-02"))
	}
	return dates, nil
}

/***************************************************************************************************
* Validates recurring request.
*
* Parameters:
* - sessionTypeID: Identifier used to target the current record.
* - timeStr: Time value used by the current operation.
* - daysOfWeek: Days of week used by the current operation.
* - period: Period used by the current operation.
* - dayTimes: Time value used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func validateRecurringRequest(sessionTypeID string, daysOfWeek []int, timeStr, period string, dayTimes map[string]string) error {
	if sessionTypeID == "" {
		return fmt.Errorf("Error.SelectService")
	}
	hasDayTimes := len(dayTimes) > 0
	if !hasDayTimes {
		if len(daysOfWeek) == 0 {
			return fmt.Errorf("Error.SelectDaysOfWeek")
		}
		for _, d := range daysOfWeek {
			if d < 0 || d > 6 {
				return fmt.Errorf("Error.InvalidDayOfWeek")
			}
		}
		if timeStr == "" {
			return fmt.Errorf("Error.SelectTime")
		}
		if _, _, err := parseTime(timeStr); err != nil {
			return fmt.Errorf("Error.SelectTime")
		}
	} else {
		for dayStr, t := range dayTimes {
			d, err := strconv.Atoi(dayStr)
			if err != nil || d < 0 || d > 6 {
				return fmt.Errorf("Error.InvalidDayOfWeek")
			}
			if t == "" {
				return fmt.Errorf("Error.SelectTime")
			}
			if _, _, err := parseTime(t); err != nil {
				return fmt.Errorf("Error.SelectTime")
			}
		}
	}
	validPeriods := map[string]bool{"1week": true, "1month": true, "3months": true}
	if !validPeriods[period] {
		return fmt.Errorf("Error.InvalidPeriod")
	}
	return nil
}

/***************************************************************************************************
* Implements the days of week to string logic used by this module.
*
* Parameters:
* - days: Days used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func daysOfWeekToString(days []int) string {
	sort.Ints(days)
	parts := make([]string, len(days))
	for i, d := range days {
		parts[i] = strconv.Itoa(d)
	}
	return strings.Join(parts, ",")
}

/***************************************************************************************************
* extractFromDayTimes extracts daysOfWeek list and first time from a dayTimes map.
*
* Parameters:
* - dayTimes: Time value used by the current operation.
*
* Returns:
* - The computed value for the current operation as ([]int, string).
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func extractFromDayTimes(dayTimes map[string]string) ([]int, string) {
	days := make([]int, 0, len(dayTimes))
	for dayStr := range dayTimes {
		d, _ := strconv.Atoi(dayStr)
		days = append(days, d)
	}
	sort.Ints(days)
	if len(days) == 0 {
		return days, ""
	}
	return days, dayTimes[strconv.Itoa(days[0])]
}

/***************************************************************************************************
* Implements the day times to json logic used by this module.
*
* Parameters:
* - dayTimes: Time value used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func dayTimesToJSON(dayTimes map[string]string) string {
	if len(dayTimes) == 0 {
		return ""
	}
	b, _ := json.Marshal(dayTimes)
	return string(b)
}

/***************************************************************************************************
* handleValidationError sends a localized error from validateRecurringRequest. The error message
* is an i18n key like "Error.SelectService".
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
* - err: Err used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func handleValidationError(w http.ResponseWriter, r *http.Request, err error) {
	loc := myI18n.L(r.Context())
	msgID := err.Error()
	http.Error(w, myI18n.T(loc, msgID), http.StatusBadRequest)
}

/***************************************************************************************************
* Client Recurring Endpoints.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleGetRecurringSchedules(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	schedules, err := db.GetRecurringSchedulesByClientID(client.ID)
	if err != nil {
		log.Printf("Error getting recurring schedules: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if schedules == nil {
		schedules = []models.RecurringSchedule{}
	}

	setNoStore(w)
	writeJSON(w, schedules)
}

/***************************************************************************************************
* Handles get recurring schedule detail.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleGetRecurringScheduleDetail(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleWithBookings(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.ClientID != client.ID {
		httpError(w, r, "Error.ScheduleNotFound", http.StatusNotFound)
		return
	}

	setNoStore(w)
	writeJSON(w, schedule)
}

/***************************************************************************************************
* Handles create recurring schedule.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleCreateRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req CreateRecurringScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* When dayTimes is provided, extract days and first time for backward compat.
	***************************************************************************************************/
	if len(req.DayTimes) > 0 {
		days, firstTime := extractFromDayTimes(req.DayTimes)
		req.DaysOfWeek = days
		if req.Time == "" {
			req.Time = firstTime
		}
	}

	if err := validateRecurringRequest(req.SessionTypeID, req.DaysOfWeek, req.Time, req.Period, req.DayTimes); err != nil {
		handleValidationError(w, r, err)
		return
	}

	sessionType, err := db.GetSessionTypeByID(req.SessionTypeID)
	if err != nil || sessionType == nil {
		httpError(w, r, "Error.ServiceNotFound", http.StatusBadRequest)
		return
	}

	startDate, endDate, err := calculateDateRange(req.Period)
	if err != nil {
		handleValidationError(w, r, err)
		return
	}

	daysStr := daysOfWeekToString(req.DaysOfWeek)
	firstDay := 0
	if len(req.DaysOfWeek) > 0 {
		firstDay = req.DaysOfWeek[0]
	}

	schedule, err := db.CreateRecurringScheduleFull(
		specialist.ID, client.ID, client.Name,
		firstDay, req.Time, sessionType.DurationMinutes,
		"client", req.SessionTypeID, daysStr, startDate, endDate, dayTimesToJSON(req.DayTimes),
	)
	if err != nil {
		log.Printf("Error creating recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("RECURRING CREATE (CLIENT) [%s] Client: %s | Days: %s | Time: %s | Period: %s",
		schedule.ID[:8], client.Name, daysStr, req.Time, req.Period)

	/***************************************************************************************************
	* Notify specialist.
	***************************************************************************************************/
	if NotifyRecurringScheduleFunc != nil {
		schedule.SessionType = sessionType
		previewDates, _ := generatePreviewDates(specialist.ID, req.DaysOfWeek, req.Time, sessionType.DurationMinutes, startDate, endDate, req.DayTimes)
		if err := NotifyRecurringScheduleFunc(schedule, len(previewDates)); err != nil {
			log.Printf("Error notifying about recurring schedule: %v", err)
		}
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, schedule)
}

/***************************************************************************************************
* Handles preview recurring schedule.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandlePreviewRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req PreviewRecurringScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if len(req.DayTimes) > 0 {
		days, firstTime := extractFromDayTimes(req.DayTimes)
		req.DaysOfWeek = days
		if req.Time == "" {
			req.Time = firstTime
		}
	}

	if err := validateRecurringRequest(req.SessionTypeID, req.DaysOfWeek, req.Time, req.Period, req.DayTimes); err != nil {
		handleValidationError(w, r, err)
		return
	}

	sessionType, err := db.GetSessionTypeByID(req.SessionTypeID)
	if err != nil || sessionType == nil {
		httpError(w, r, "Error.ServiceNotFound", http.StatusBadRequest)
		return
	}

	startDate, endDate, err := calculateDateRange(req.Period)
	if err != nil {
		handleValidationError(w, r, err)
		return
	}

	dates, err := generatePreviewDates(specialist.ID, req.DaysOfWeek, req.Time, sessionType.DurationMinutes, startDate, endDate, req.DayTimes)
	if err != nil {
		log.Printf("Error generating preview: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if dates == nil {
		dates = []string{}
	}

	writeJSON(w, RecurringPreviewResponse{Dates: dates})
}

/***************************************************************************************************
* Handles cancel recurring schedule.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleCancelRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleByID(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.ClientID != client.ID {
		httpError(w, r, "Error.ScheduleNotFound", http.StatusNotFound)
		return
	}

	if schedule.Status != models.RecurringScheduleStatusPending && schedule.Status != models.RecurringScheduleStatusActive {
		httpError(w, r, "Error.ScheduleCannotCancel", http.StatusBadRequest)
		return
	}

	if err := db.UpdateRecurringScheduleStatus(id, models.RecurringScheduleStatusCancelled); err != nil {
		log.Printf("Error cancelling recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("RECURRING CANCEL (CLIENT) [%s]", id[:8])
	w.WriteHeader(http.StatusNoContent)
}

/***************************************************************************************************
* Admin Recurring Schedule Endpoints.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminGetRecurringSchedules(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	schedules, err := db.GetRecurringSchedulesBySpecialistID(specialist.ID)
	if err != nil {
		log.Printf("Error getting recurring schedules: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if schedules == nil {
		schedules = []models.RecurringSchedule{}
	}

	setNoStore(w)
	writeJSON(w, schedules)
}

/***************************************************************************************************
* Handles admin get recurring schedule detail.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminGetRecurringScheduleDetail(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleWithBookings(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ScheduleNotFound", http.StatusNotFound)
		return
	}

	setNoStore(w)
	writeJSON(w, schedule)
}

/***************************************************************************************************
* Handles admin create recurring schedule.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminCreateRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req AdminCreateRecurringScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if req.ClientID == "" {
		httpError(w, r, "Error.ClientSelect", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* When dayTimes is provided, extract days and first time for backward compat.
	***************************************************************************************************/
	if len(req.DayTimes) > 0 {
		days, firstTime := extractFromDayTimes(req.DayTimes)
		req.DaysOfWeek = days
		if req.Time == "" {
			req.Time = firstTime
		}
	}

	if err := validateRecurringRequest(req.SessionTypeID, req.DaysOfWeek, req.Time, req.Period, req.DayTimes); err != nil {
		handleValidationError(w, r, err)
		return
	}

	client, err := db.GetClientByID(req.ClientID)
	if err != nil {
		log.Printf("Error getting client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if client == nil || client.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ClientNotFound", http.StatusNotFound)
		return
	}

	sessionType, err := db.GetSessionTypeByID(req.SessionTypeID)
	if err != nil || sessionType == nil {
		httpError(w, r, "Error.ServiceNotFound", http.StatusBadRequest)
		return
	}

	startDate, endDate, err := calculateDateRange(req.Period)
	if err != nil {
		handleValidationError(w, r, err)
		return
	}

	daysStr := daysOfWeekToString(req.DaysOfWeek)
	firstDay := 0
	if len(req.DaysOfWeek) > 0 {
		firstDay = req.DaysOfWeek[0]
	}

	schedule, err := db.CreateRecurringScheduleFull(
		specialist.ID, client.ID, client.Name,
		firstDay, req.Time, sessionType.DurationMinutes,
		"specialist", req.SessionTypeID, daysStr, startDate, endDate, dayTimesToJSON(req.DayTimes),
	)
	if err != nil {
		log.Printf("Error creating recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("RECURRING CREATE (ADMIN) [%s] Client: %s | Days: %s | Time: %s | Period: %s",
		schedule.ID[:8], client.Name, daysStr, req.Time, req.Period)

	/***************************************************************************************************
	* Ghost clients: auto-approve and generate bookings immediately.
	***************************************************************************************************/
	if client.IsGhost {
		if _, err := db.ApproveAndGenerateBookings(schedule.ID); err != nil {
			log.Printf("Error auto-approving ghost recurring schedule: %v", err)
		}
	} else {
		/***************************************************************************************************
		* Notify client.
		***************************************************************************************************/
		if NotifyRecurringScheduleFunc != nil {
			schedule.SessionType = sessionType
			previewDates, _ := generatePreviewDates(specialist.ID, req.DaysOfWeek, req.Time, sessionType.DurationMinutes, startDate, endDate, req.DayTimes)
			if err := NotifyRecurringScheduleFunc(schedule, len(previewDates)); err != nil {
				log.Printf("Error notifying about recurring schedule: %v", err)
			}
		}
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, schedule)
}

/***************************************************************************************************
* Handles admin preview recurring schedule.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminPreviewRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req PreviewRecurringScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if len(req.DayTimes) > 0 {
		days, firstTime := extractFromDayTimes(req.DayTimes)
		req.DaysOfWeek = days
		if req.Time == "" {
			req.Time = firstTime
		}
	}

	if err := validateRecurringRequest(req.SessionTypeID, req.DaysOfWeek, req.Time, req.Period, req.DayTimes); err != nil {
		handleValidationError(w, r, err)
		return
	}

	sessionType, err := db.GetSessionTypeByID(req.SessionTypeID)
	if err != nil || sessionType == nil {
		httpError(w, r, "Error.ServiceNotFound", http.StatusBadRequest)
		return
	}

	startDate, endDate, err := calculateDateRange(req.Period)
	if err != nil {
		handleValidationError(w, r, err)
		return
	}

	dates, err := generatePreviewDates(specialist.ID, req.DaysOfWeek, req.Time, sessionType.DurationMinutes, startDate, endDate, req.DayTimes)
	if err != nil {
		log.Printf("Error generating preview: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if dates == nil {
		dates = []string{}
	}

	writeJSON(w, RecurringPreviewResponse{Dates: dates})
}

/***************************************************************************************************
* Handles admin approve recurring schedule.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminApproveRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleByID(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ScheduleNotFound", http.StatusNotFound)
		return
	}
	if schedule.Status != models.RecurringScheduleStatusPending {
		httpError(w, r, "Error.ScheduleProcessed", http.StatusBadRequest)
		return
	}

	count, err := db.ApproveAndGenerateBookings(id)
	if err != nil {
		log.Printf("Error approving recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("RECURRING APPROVED [%s] %d bookings created", id[:8], count)

	updated, _ := db.GetRecurringScheduleByID(id)
	writeJSON(w, updated)
}

/***************************************************************************************************
* Handles admin decline recurring schedule.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminDeclineRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleByID(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ScheduleNotFound", http.StatusNotFound)
		return
	}
	if schedule.Status != models.RecurringScheduleStatusPending {
		httpError(w, r, "Error.ScheduleProcessed", http.StatusBadRequest)
		return
	}

	if err := db.UpdateRecurringScheduleStatus(id, models.RecurringScheduleStatusDeclined); err != nil {
		log.Printf("Error declining recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("RECURRING DECLINED [%s]", id[:8])

	updated, _ := db.GetRecurringScheduleByID(id)
	writeJSON(w, updated)
}

/***************************************************************************************************
* Phase 3: Individual Booking Management.
***************************************************************************************************/
type MoveBookingRequest struct {
	Date string `json:"date"` // "2026-03-10"
	Time string `json:"time"` // "10:00"
}

/***************************************************************************************************
* getScheduleBooking validates and returns a booking belonging to a schedule. notification
* helpers.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - The computed value for the current operation as (*models.Booking, string).
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func getScheduleBooking(w http.ResponseWriter, r *http.Request) (*models.Booking, string) {
	scheduleID := chi.URLParam(r, "scheduleId")
	bookingID := chi.URLParam(r, "bookingId")

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return nil, ""
	}
	if booking == nil || booking.RecurringScheduleID != scheduleID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return nil, ""
	}
	return booking, scheduleID
}

/***************************************************************************************************
* Client: Request Cancel.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleClientCancelRequest(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.ClientID != client.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusConfirmed {
		httpError(w, r, "Error.BookingCannotCancel", http.StatusBadRequest)
		return
	}

	if err := db.CancelBooking(booking.ID, "", models.CancelledByClient); err != nil {
		log.Printf("Error cancelling booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("CANCEL (CLIENT) booking %s", booking.ID[:8])

	updated, _ := db.GetBookingByID(booking.ID)

	if NotifyCancellationFunc != nil {
		if err := NotifyCancellationFunc(updated, "client"); err != nil {
			log.Printf("Error notifying cancellation: %v", err)
		}
	}

	writeJSON(w, updated)
}

/***************************************************************************************************
* Client: Request Move.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleClientMoveRequest(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	booking, scheduleID := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.ClientID != client.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusConfirmed {
		httpError(w, r, "Error.BookingCannotReschedule", http.StatusBadRequest)
		return
	}

	var req MoveBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	newBooking, err := createMoveBooking(r, booking, scheduleID, req)
	if err != nil {
		handleValidationError(w, r, err)
		return
	}

	log.Printf("MOVE REQUEST (CLIENT) booking %s -> %s", booking.ID[:8], newBooking.ID[:8])

	if NotifyMoveRequestFunc != nil {
		if err := NotifyMoveRequestFunc(newBooking, booking, "client"); err != nil {
			log.Printf("Error notifying move request: %v", err)
		}
	}

	writeJSON(w, newBooking)
}

/***************************************************************************************************
* Admin: Request Cancel.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminBookingCancelRequest(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.SpecialistID != specialist.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusConfirmed {
		httpError(w, r, "Error.BookingCannotCancel", http.StatusBadRequest)
		return
	}

	if err := db.CancelBooking(booking.ID, "", models.CancelledBySpecialist); err != nil {
		log.Printf("Error cancelling booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("CANCEL (ADMIN) booking %s", booking.ID[:8])

	updated, _ := db.GetBookingByID(booking.ID)

	if NotifyCancellationFunc != nil {
		if err := NotifyCancellationFunc(updated, "specialist"); err != nil {
			log.Printf("Error notifying cancellation: %v", err)
		}
	}

	writeJSON(w, updated)
}

/***************************************************************************************************
* Admin: Request Move.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminBookingMoveRequest(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	booking, scheduleID := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.SpecialistID != specialist.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusConfirmed {
		httpError(w, r, "Error.BookingCannotReschedule", http.StatusBadRequest)
		return
	}

	var req MoveBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	newBooking, err := createMoveBooking(r, booking, scheduleID, req)
	if err != nil {
		handleValidationError(w, r, err)
		return
	}

	log.Printf("MOVE REQUEST (ADMIN) booking %s -> %s", booking.ID[:8], newBooking.ID[:8])

	if NotifyMoveRequestFunc != nil {
		if err := NotifyMoveRequestFunc(newBooking, booking, "specialist"); err != nil {
			log.Printf("Error notifying move request: %v", err)
		}
	}

	writeJSON(w, newBooking)
}

/***************************************************************************************************
* Admin: Approve/Decline Move.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminApproveMoveBooking(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.SpecialistID != specialist.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusReschedulePending {
		httpError(w, r, "Error.NoMoveRequest", http.StatusBadRequest)
		return
	}

	if err := db.ApproveRescheduleBooking(booking.ID); err != nil {
		log.Printf("Error approving move: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("MOVE APPROVED booking %s", booking.ID[:8])
	updated, _ := db.GetBookingByID(booking.ID)
	writeJSON(w, updated)
}

/***************************************************************************************************
* Handles admin decline move booking.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminDeclineMoveBooking(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.SpecialistID != specialist.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusReschedulePending {
		httpError(w, r, "Error.NoMoveRequest", http.StatusBadRequest)
		return
	}

	if err := db.DeclineRescheduleBooking(booking.ID); err != nil {
		log.Printf("Error declining move: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("MOVE DECLINED booking %s", booking.ID[:8])
	w.WriteHeader(http.StatusNoContent)
}

/***************************************************************************************************
* createMoveBooking is a shared helper for creating a reschedule booking. Errors returned are i18n
* message IDs suitable for handleValidationError.
*
* Parameters:
* - r: HTTP request carrying headers, params, query values, and body data.
* - booking: Booking used by the current operation.
* - scheduleID: Identifier used to target the current record.
* - req: Req used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func createMoveBooking(r *http.Request, booking *models.Booking, scheduleID string, req MoveBookingRequest) (*models.Booking, error) {
	if req.Date == "" || req.Time == "" {
		return nil, fmt.Errorf("Error.MissingDateTime")
	}

	newDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return nil, fmt.Errorf("Error.InvalidDate")
	}

	hour, minute, err := parseTime(req.Time)
	if err != nil {
		return nil, fmt.Errorf("Error.SelectTime")
	}
	startsAt := time.Date(newDate.Year(), newDate.Month(), newDate.Day(), hour, minute, 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(booking.DurationMinutes) * time.Minute)

	/***************************************************************************************************
	* Check conflicts.
	***************************************************************************************************/
	hasConflict, _ := db.HasConflictingBooking(booking.SpecialistID, startsAt, endsAt, booking.ID)
	if hasConflict {
		return nil, fmt.Errorf("Error.TimeSlotTaken")
	}

	newBooking, err := db.CreateRescheduleBooking(
		booking.SpecialistID, booking.ClientID, booking.SessionTypeID,
		startsAt, endsAt, booking.ClientName, booking.DurationMinutes,
		scheduleID, booking.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("Error.Internal")
	}
	return newBooking, nil
}

/***************************************************************************************************
* Handles admin cancel recurring schedule.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminCancelRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleByID(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ScheduleNotFound", http.StatusNotFound)
		return
	}
	if schedule.Status == models.RecurringScheduleStatusCancelled {
		httpError(w, r, "Error.ScheduleCancelled", http.StatusBadRequest)
		return
	}

	if err := db.UpdateRecurringScheduleStatus(id, models.RecurringScheduleStatusCancelled); err != nil {
		log.Printf("Error cancelling recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("RECURRING CANCEL (ADMIN) [%s]", id[:8])
	w.WriteHeader(http.StatusNoContent)
}
