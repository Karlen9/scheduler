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

// NotifyRecurringScheduleFunc notifies the approval side about a new recurring schedule request.
// Called with the schedule and the number of preview dates (expected bookings).
var NotifyRecurringScheduleFunc func(schedule *models.RecurringSchedule, previewCount int) error

// NotifyMoveRequestFunc notifies the other side about a move/reschedule request for a recurring booking.
// Called with (newBooking, oldBooking, requestedBy "client"/"trainer").
var NotifyMoveRequestFunc func(newBooking, oldBooking *models.Booking, requestedBy string) error

// ========== Shared Types & Helpers ==========

type CreateRecurringScheduleRequest struct {
	SessionTypeID string            `json:"sessionTypeId"`
	DaysOfWeek    []int             `json:"daysOfWeek"`
	Time          string            `json:"time"`
	Period        string            `json:"period"`
	DayTimes      map[string]string `json:"dayTimes,omitempty"`
}

type AdminCreateRecurringScheduleRequest struct {
	ClientID      string            `json:"clientId"`
	SessionTypeID string            `json:"sessionTypeId"`
	DaysOfWeek    []int             `json:"daysOfWeek"`
	Time          string            `json:"time"`
	Period        string            `json:"period"`
	DayTimes      map[string]string `json:"dayTimes,omitempty"`
}

type PreviewRecurringScheduleRequest struct {
	SessionTypeID string            `json:"sessionTypeId"`
	DaysOfWeek    []int             `json:"daysOfWeek"`
	Time          string            `json:"time"`
	Period        string            `json:"period"`
	DayTimes      map[string]string `json:"dayTimes,omitempty"`
}

type RecurringPreviewResponse struct {
	Dates []string `json:"dates"`
}

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

func generatePreviewDates(trainerID string, daysOfWeek []int, timeStr string, durationMinutes int, startDateStr, endDateStr string, dayTimes map[string]string) ([]string, error) {
	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		return nil, err
	}
	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		return nil, err
	}

	workingHours, _ := db.GetWorkingHoursByTrainerID(trainerID)
	daysOff, _ := db.GetDaysOffByTrainerID(trainerID)

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

	fallbackTimeParts := parseTime(timeStr)
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
		// Use per-day time if available
		timeParts := fallbackTimeParts
		dowStr := strconv.Itoa(dow)
		if t, ok := dayTimes[dowStr]; ok {
			timeParts = parseTime(t)
		}
		startsAt := time.Date(d.Year(), d.Month(), d.Day(), timeParts[0], timeParts[1], 0, 0, time.UTC)
		endsAt := startsAt.Add(time.Duration(durationMinutes) * time.Minute)
		hasConflict, _ := db.HasConflictingBooking(trainerID, startsAt, endsAt, "")
		if hasConflict {
			continue
		}
		dates = append(dates, d.Format("2006-01-02"))
	}
	return dates, nil
}

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
		if timeStr == "" || len(timeStr) < 5 {
			return fmt.Errorf("Error.SelectTime")
		}
	} else {
		for dayStr, t := range dayTimes {
			d, err := strconv.Atoi(dayStr)
			if err != nil || d < 0 || d > 6 {
				return fmt.Errorf("Error.InvalidDayOfWeek")
			}
			if t == "" || len(t) < 5 {
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

func daysOfWeekToString(days []int) string {
	sort.Ints(days)
	parts := make([]string, len(days))
	for i, d := range days {
		parts[i] = strconv.Itoa(d)
	}
	return strings.Join(parts, ",")
}

// extractFromDayTimes extracts daysOfWeek list and first time from a dayTimes map
func extractFromDayTimes(dayTimes map[string]string) ([]int, string) {
	days := make([]int, 0, len(dayTimes))
	firstTime := ""
	for dayStr, t := range dayTimes {
		d, _ := strconv.Atoi(dayStr)
		days = append(days, d)
		if firstTime == "" {
			firstTime = t
		}
	}
	sort.Ints(days)
	return days, firstTime
}

func dayTimesToJSON(dayTimes map[string]string) string {
	if len(dayTimes) == 0 {
		return ""
	}
	b, _ := json.Marshal(dayTimes)
	return string(b)
}

// handleValidationError sends a localized error from validateRecurringRequest.
// The error message is an i18n key like "Error.SelectService".
func handleValidationError(w http.ResponseWriter, r *http.Request, err error) {
	loc := myI18n.L(r.Context())
	msgID := err.Error()
	http.Error(w, myI18n.T(loc, msgID), http.StatusBadRequest)
}

// ========== Client Recurring Endpoints ==========

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

	writeJSON(w, schedules)
}

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

	writeJSON(w, schedule)
}

func HandleCreateRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	var req CreateRecurringScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	// When dayTimes is provided, extract days and first time for backward compat
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
		trainer.ID, client.ID, client.Name,
		firstDay, req.Time, sessionType.DurationMinutes,
		"client", req.SessionTypeID, daysStr, startDate, endDate, dayTimesToJSON(req.DayTimes),
	)
	if err != nil {
		log.Printf("Error creating recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 RECURRING CREATE (CLIENT) [%s] Client: %s | Days: %s | Time: %s | Period: %s",
		schedule.ID[:8], client.Name, daysStr, req.Time, req.Period)

	// Notify trainer
	if NotifyRecurringScheduleFunc != nil {
		schedule.SessionType = sessionType
		previewDates, _ := generatePreviewDates(trainer.ID, req.DaysOfWeek, req.Time, sessionType.DurationMinutes, startDate, endDate, req.DayTimes)
		if err := NotifyRecurringScheduleFunc(schedule, len(previewDates)); err != nil {
			log.Printf("Error notifying about recurring schedule: %v", err)
		}
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, schedule)
}

func HandlePreviewRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
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

	dates, err := generatePreviewDates(trainer.ID, req.DaysOfWeek, req.Time, sessionType.DurationMinutes, startDate, endDate, req.DayTimes)
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

	log.Printf("🔄 RECURRING CANCEL (CLIENT) [%s]", id[:8])
	w.WriteHeader(http.StatusNoContent)
}

// ========== Admin Recurring Schedule Endpoints ==========

func HandleAdminGetRecurringSchedules(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	schedules, err := db.GetRecurringSchedulesByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting recurring schedules: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if schedules == nil {
		schedules = []models.RecurringSchedule{}
	}

	writeJSON(w, schedules)
}

func HandleAdminGetRecurringScheduleDetail(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleWithBookings(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.TrainerID != trainer.ID {
		httpError(w, r, "Error.ScheduleNotFound", http.StatusNotFound)
		return
	}

	writeJSON(w, schedule)
}

func HandleAdminCreateRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
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

	// When dayTimes is provided, extract days and first time for backward compat
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
	if client == nil || client.TrainerID != trainer.ID {
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
		trainer.ID, client.ID, client.Name,
		firstDay, req.Time, sessionType.DurationMinutes,
		"trainer", req.SessionTypeID, daysStr, startDate, endDate, dayTimesToJSON(req.DayTimes),
	)
	if err != nil {
		log.Printf("Error creating recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 RECURRING CREATE (ADMIN) [%s] Client: %s | Days: %s | Time: %s | Period: %s",
		schedule.ID[:8], client.Name, daysStr, req.Time, req.Period)

	// Ghost clients: auto-approve and generate bookings immediately
	if client.IsGhost {
		if _, err := db.ApproveAndGenerateBookings(schedule.ID); err != nil {
			log.Printf("Error auto-approving ghost recurring schedule: %v", err)
		}
	} else {
		// Notify client
		if NotifyRecurringScheduleFunc != nil {
			schedule.SessionType = sessionType
			previewDates, _ := generatePreviewDates(trainer.ID, req.DaysOfWeek, req.Time, sessionType.DurationMinutes, startDate, endDate, req.DayTimes)
			if err := NotifyRecurringScheduleFunc(schedule, len(previewDates)); err != nil {
				log.Printf("Error notifying about recurring schedule: %v", err)
			}
		}
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, schedule)
}

func HandleAdminPreviewRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
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

	dates, err := generatePreviewDates(trainer.ID, req.DaysOfWeek, req.Time, sessionType.DurationMinutes, startDate, endDate, req.DayTimes)
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

func HandleAdminApproveRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleByID(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.TrainerID != trainer.ID {
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

	log.Printf("🔄 RECURRING APPROVED [%s] %d bookings created", id[:8], count)

	updated, _ := db.GetRecurringScheduleByID(id)
	writeJSON(w, updated)
}

func HandleAdminDeclineRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleByID(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.TrainerID != trainer.ID {
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

	log.Printf("🔄 RECURRING DECLINED [%s]", id[:8])

	updated, _ := db.GetRecurringScheduleByID(id)
	writeJSON(w, updated)
}

// ========== Phase 3: Individual Booking Management ==========

type MoveBookingRequest struct {
	Date string `json:"date"` // "2026-03-10"
	Time string `json:"time"` // "10:00"
}

// getScheduleBooking validates and returns a booking belonging to a schedule
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

// --- Client: Request Cancel ---

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

// --- Client: Request Move ---

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

// --- Admin: Request Cancel ---

func HandleAdminBookingCancelRequest(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.TrainerID != trainer.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusConfirmed {
		httpError(w, r, "Error.BookingCannotCancel", http.StatusBadRequest)
		return
	}

	if err := db.CancelBooking(booking.ID, "", models.CancelledByTrainer); err != nil {
		log.Printf("Error cancelling booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("CANCEL (ADMIN) booking %s", booking.ID[:8])

	updated, _ := db.GetBookingByID(booking.ID)

	if NotifyCancellationFunc != nil {
		if err := NotifyCancellationFunc(updated, "trainer"); err != nil {
			log.Printf("Error notifying cancellation: %v", err)
		}
	}

	writeJSON(w, updated)
}

// --- Admin: Request Move ---

func HandleAdminBookingMoveRequest(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	booking, scheduleID := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.TrainerID != trainer.ID {
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
		if err := NotifyMoveRequestFunc(newBooking, booking, "trainer"); err != nil {
			log.Printf("Error notifying move request: %v", err)
		}
	}

	writeJSON(w, newBooking)
}

// --- Admin: Approve/Decline Move ---

func HandleAdminApproveMoveBooking(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.TrainerID != trainer.ID {
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

func HandleAdminDeclineMoveBooking(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.TrainerID != trainer.ID {
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

// createMoveBooking is a shared helper for creating a reschedule booking.
// Errors returned are i18n message IDs suitable for handleValidationError.
func createMoveBooking(r *http.Request, booking *models.Booking, scheduleID string, req MoveBookingRequest) (*models.Booking, error) {
	if req.Date == "" || req.Time == "" {
		return nil, fmt.Errorf("Error.MissingDateTime")
	}

	newDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return nil, fmt.Errorf("Error.InvalidDate")
	}

	timeParts := parseTime(req.Time)
	startsAt := time.Date(newDate.Year(), newDate.Month(), newDate.Day(), timeParts[0], timeParts[1], 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(booking.DurationMinutes) * time.Minute)

	// Check conflicts
	hasConflict, _ := db.HasConflictingBooking(booking.TrainerID, startsAt, endsAt, booking.ID)
	if hasConflict {
		return nil, fmt.Errorf("Error.TimeSlotTaken")
	}

	newBooking, err := db.CreateRescheduleBooking(
		booking.TrainerID, booking.ClientID, booking.SessionTypeID,
		startsAt, endsAt, booking.ClientName, booking.DurationMinutes,
		scheduleID, booking.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("Error.Internal")
	}
	return newBooking, nil
}

func HandleAdminCancelRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleByID(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.TrainerID != trainer.ID {
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

	log.Printf("🔄 RECURRING CANCEL (ADMIN) [%s]", id[:8])
	w.WriteHeader(http.StatusNoContent)
}
