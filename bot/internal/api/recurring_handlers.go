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
	"scheduler-bot/internal/models"
)

// NotifyRecurringScheduleFunc notifies the approval side about a new recurring schedule request.
// Called with the schedule and the number of preview dates (expected bookings).
var NotifyRecurringScheduleFunc func(schedule *models.RecurringSchedule, previewCount int) error

// NotifyCancelRequestFunc notifies the other side about a cancel request for a recurring booking.
// Called with (booking, requestedBy "client"/"trainer").
var NotifyCancelRequestFunc func(booking *models.Booking, requestedBy string) error

// NotifyMoveRequestFunc notifies the other side about a move/reschedule request for a recurring booking.
// Called with (newBooking, oldBooking, requestedBy "client"/"trainer").
var NotifyMoveRequestFunc func(newBooking, oldBooking *models.Booking, requestedBy string) error

// ========== Shared Types & Helpers ==========

type CreateRecurringScheduleRequest struct {
	SessionTypeID string `json:"sessionTypeId"`
	DaysOfWeek    []int  `json:"daysOfWeek"`
	Time          string `json:"time"`
	Period        string `json:"period"`
}

type AdminCreateRecurringScheduleRequest struct {
	ClientID      string `json:"clientId"`
	SessionTypeID string `json:"sessionTypeId"`
	DaysOfWeek    []int  `json:"daysOfWeek"`
	Time          string `json:"time"`
	Period        string `json:"period"`
}

type PreviewRecurringScheduleRequest struct {
	SessionTypeID string `json:"sessionTypeId"`
	DaysOfWeek    []int  `json:"daysOfWeek"`
	Time          string `json:"time"`
	Period        string `json:"period"`
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

func generatePreviewDates(trainerID string, daysOfWeek []int, timeStr string, durationMinutes int, startDateStr, endDateStr string) ([]string, error) {
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

	timeParts := parseTime(timeStr)
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

func validateRecurringRequest(sessionTypeID string, daysOfWeek []int, timeStr, period string) error {
	if sessionTypeID == "" {
		return fmt.Errorf("Выберите услугу")
	}
	if len(daysOfWeek) == 0 {
		return fmt.Errorf("Выберите дни недели")
	}
	for _, d := range daysOfWeek {
		if d < 0 || d > 6 {
			return fmt.Errorf("Неверный день недели")
		}
	}
	if timeStr == "" || len(timeStr) < 5 {
		return fmt.Errorf("Выберите время")
	}
	validPeriods := map[string]bool{"1week": true, "1month": true, "3months": true}
	if !validPeriods[period] {
		return fmt.Errorf("Неверный период")
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

// ========== Client Recurring Endpoints ==========

func HandleGetRecurringSchedules(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	schedules, err := db.GetRecurringSchedulesByClientID(client.ID)
	if err != nil {
		log.Printf("Error getting recurring schedules: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleWithBookings(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.ClientID != client.ID {
		http.Error(w, "Расписание не найдено", http.StatusNotFound)
		return
	}

	writeJSON(w, schedule)
}

func HandleCreateRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	var req CreateRecurringScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if err := validateRecurringRequest(req.SessionTypeID, req.DaysOfWeek, req.Time, req.Period); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sessionType, err := db.GetSessionTypeByID(req.SessionTypeID)
	if err != nil || sessionType == nil {
		http.Error(w, "Услуга не найдена", http.StatusBadRequest)
		return
	}

	startDate, endDate, err := calculateDateRange(req.Period)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
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
		"client", req.SessionTypeID, daysStr, startDate, endDate,
	)
	if err != nil {
		log.Printf("Error creating recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 RECURRING CREATE (CLIENT) [%s] Client: %s | Days: %s | Time: %s | Period: %s",
		schedule.ID[:8], client.Name, daysStr, req.Time, req.Period)

	// Notify trainer
	if NotifyRecurringScheduleFunc != nil {
		schedule.SessionType = sessionType
		previewDates, _ := generatePreviewDates(trainer.ID, req.DaysOfWeek, req.Time, sessionType.DurationMinutes, startDate, endDate)
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
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	var req PreviewRecurringScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if err := validateRecurringRequest(req.SessionTypeID, req.DaysOfWeek, req.Time, req.Period); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sessionType, err := db.GetSessionTypeByID(req.SessionTypeID)
	if err != nil || sessionType == nil {
		http.Error(w, "Услуга не найдена", http.StatusBadRequest)
		return
	}

	startDate, endDate, err := calculateDateRange(req.Period)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	dates, err := generatePreviewDates(trainer.ID, req.DaysOfWeek, req.Time, sessionType.DurationMinutes, startDate, endDate)
	if err != nil {
		log.Printf("Error generating preview: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleByID(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.ClientID != client.ID {
		http.Error(w, "Расписание не найдено", http.StatusNotFound)
		return
	}

	if schedule.Status != models.RecurringScheduleStatusPending && schedule.Status != models.RecurringScheduleStatusActive {
		http.Error(w, "Расписание не может быть отменено", http.StatusBadRequest)
		return
	}

	if err := db.UpdateRecurringScheduleStatus(id, models.RecurringScheduleStatusCancelled); err != nil {
		log.Printf("Error cancelling recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 RECURRING CANCEL (CLIENT) [%s]", id[:8])
	w.WriteHeader(http.StatusNoContent)
}

// ========== Admin Recurring Schedule Endpoints ==========

func HandleAdminGetRecurringSchedules(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	schedules, err := db.GetRecurringSchedulesByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting recurring schedules: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleWithBookings(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.TrainerID != trainer.ID {
		http.Error(w, "Расписание не найдено", http.StatusNotFound)
		return
	}

	writeJSON(w, schedule)
}

func HandleAdminCreateRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	var req AdminCreateRecurringScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if req.ClientID == "" {
		http.Error(w, "Выберите клиента", http.StatusBadRequest)
		return
	}

	if err := validateRecurringRequest(req.SessionTypeID, req.DaysOfWeek, req.Time, req.Period); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	client, err := db.GetClientByID(req.ClientID)
	if err != nil {
		log.Printf("Error getting client: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if client == nil || client.TrainerID != trainer.ID {
		http.Error(w, "Клиент не найден", http.StatusNotFound)
		return
	}

	sessionType, err := db.GetSessionTypeByID(req.SessionTypeID)
	if err != nil || sessionType == nil {
		http.Error(w, "Услуга не найдена", http.StatusBadRequest)
		return
	}

	startDate, endDate, err := calculateDateRange(req.Period)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
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
		"trainer", req.SessionTypeID, daysStr, startDate, endDate,
	)
	if err != nil {
		log.Printf("Error creating recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 RECURRING CREATE (ADMIN) [%s] Client: %s | Days: %s | Time: %s | Period: %s",
		schedule.ID[:8], client.Name, daysStr, req.Time, req.Period)

	// Notify client
	if NotifyRecurringScheduleFunc != nil {
		schedule.SessionType = sessionType
		previewDates, _ := generatePreviewDates(trainer.ID, req.DaysOfWeek, req.Time, sessionType.DurationMinutes, startDate, endDate)
		if err := NotifyRecurringScheduleFunc(schedule, len(previewDates)); err != nil {
			log.Printf("Error notifying about recurring schedule: %v", err)
		}
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, schedule)
}

func HandleAdminPreviewRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	var req PreviewRecurringScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if err := validateRecurringRequest(req.SessionTypeID, req.DaysOfWeek, req.Time, req.Period); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sessionType, err := db.GetSessionTypeByID(req.SessionTypeID)
	if err != nil || sessionType == nil {
		http.Error(w, "Услуга не найдена", http.StatusBadRequest)
		return
	}

	startDate, endDate, err := calculateDateRange(req.Period)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	dates, err := generatePreviewDates(trainer.ID, req.DaysOfWeek, req.Time, sessionType.DurationMinutes, startDate, endDate)
	if err != nil {
		log.Printf("Error generating preview: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleByID(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.TrainerID != trainer.ID {
		http.Error(w, "Расписание не найдено", http.StatusNotFound)
		return
	}
	if schedule.Status != models.RecurringScheduleStatusPending {
		http.Error(w, "Расписание уже обработано", http.StatusBadRequest)
		return
	}

	count, err := db.ApproveAndGenerateBookings(id)
	if err != nil {
		log.Printf("Error approving recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 RECURRING APPROVED [%s] %d bookings created", id[:8], count)

	updated, _ := db.GetRecurringScheduleByID(id)
	writeJSON(w, updated)
}

func HandleAdminDeclineRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleByID(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.TrainerID != trainer.ID {
		http.Error(w, "Расписание не найдено", http.StatusNotFound)
		return
	}
	if schedule.Status != models.RecurringScheduleStatusPending {
		http.Error(w, "Расписание уже обработано", http.StatusBadRequest)
		return
	}

	if err := db.UpdateRecurringScheduleStatus(id, models.RecurringScheduleStatusDeclined); err != nil {
		log.Printf("Error declining recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return nil, ""
	}
	if booking == nil || booking.RecurringScheduleID != scheduleID {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return nil, ""
	}
	return booking, scheduleID
}

// --- Client: Request Cancel ---

func HandleClientCancelRequest(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.ClientID != client.ID {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusConfirmed {
		http.Error(w, "Запись не может быть отменена", http.StatusBadRequest)
		return
	}

	if err := db.RequestCancelBooking(booking.ID, models.CancelledByClient); err != nil {
		log.Printf("Error requesting cancel: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("CANCEL REQUEST (CLIENT) booking %s", booking.ID[:8])

	if NotifyCancelRequestFunc != nil {
		booking.Status = models.BookingStatusCancelRequested
		if err := NotifyCancelRequestFunc(booking, "client"); err != nil {
			log.Printf("Error notifying cancel request: %v", err)
		}
	}

	updated, _ := db.GetBookingByID(booking.ID)
	writeJSON(w, updated)
}

// --- Client: Request Move ---

func HandleClientMoveRequest(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	booking, scheduleID := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.ClientID != client.ID {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusConfirmed {
		http.Error(w, "Запись не может быть перенесена", http.StatusBadRequest)
		return
	}

	var req MoveBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	newBooking, err := createMoveBooking(booking, scheduleID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.TrainerID != trainer.ID {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusConfirmed {
		http.Error(w, "Запись не может быть отменена", http.StatusBadRequest)
		return
	}

	if err := db.RequestCancelBooking(booking.ID, models.CancelledByTrainer); err != nil {
		log.Printf("Error requesting cancel: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("CANCEL REQUEST (ADMIN) booking %s", booking.ID[:8])

	if NotifyCancelRequestFunc != nil {
		booking.Status = models.BookingStatusCancelRequested
		if err := NotifyCancelRequestFunc(booking, "trainer"); err != nil {
			log.Printf("Error notifying cancel request: %v", err)
		}
	}

	updated, _ := db.GetBookingByID(booking.ID)
	writeJSON(w, updated)
}

// --- Admin: Request Move ---

func HandleAdminBookingMoveRequest(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	booking, scheduleID := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.TrainerID != trainer.ID {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusConfirmed {
		http.Error(w, "Запись не может быть перенесена", http.StatusBadRequest)
		return
	}

	var req MoveBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	newBooking, err := createMoveBooking(booking, scheduleID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
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

// --- Admin: Approve/Decline Cancel ---

func HandleAdminApproveCancelBooking(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.TrainerID != trainer.ID {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusCancelRequested {
		http.Error(w, "Нет запроса на отмену", http.StatusBadRequest)
		return
	}

	if err := db.ApproveCancelBooking(booking.ID); err != nil {
		log.Printf("Error approving cancel: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("CANCEL APPROVED booking %s", booking.ID[:8])
	updated, _ := db.GetBookingByID(booking.ID)
	writeJSON(w, updated)
}

func HandleAdminDeclineCancelBooking(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.TrainerID != trainer.ID {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusCancelRequested {
		http.Error(w, "Нет запроса на отмену", http.StatusBadRequest)
		return
	}

	if err := db.DeclineCancelBooking(booking.ID); err != nil {
		log.Printf("Error declining cancel: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("CANCEL DECLINED booking %s", booking.ID[:8])
	updated, _ := db.GetBookingByID(booking.ID)
	writeJSON(w, updated)
}

// --- Admin: Approve/Decline Move ---

func HandleAdminApproveMoveBooking(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.TrainerID != trainer.ID {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusReschedulePending {
		http.Error(w, "Нет запроса на перенос", http.StatusBadRequest)
		return
	}

	if err := db.ApproveRescheduleBooking(booking.ID); err != nil {
		log.Printf("Error approving move: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("MOVE APPROVED booking %s", booking.ID[:8])
	updated, _ := db.GetBookingByID(booking.ID)
	writeJSON(w, updated)
}

func HandleAdminDeclineMoveBooking(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	booking, _ := getScheduleBooking(w, r)
	if booking == nil {
		return
	}
	if booking.TrainerID != trainer.ID {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusReschedulePending {
		http.Error(w, "Нет запроса на перенос", http.StatusBadRequest)
		return
	}

	if err := db.DeclineRescheduleBooking(booking.ID); err != nil {
		log.Printf("Error declining move: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("MOVE DECLINED booking %s", booking.ID[:8])
	w.WriteHeader(http.StatusNoContent)
}

// createMoveBooking is a shared helper for creating a reschedule booking
func createMoveBooking(booking *models.Booking, scheduleID string, req MoveBookingRequest) (*models.Booking, error) {
	if req.Date == "" || req.Time == "" {
		return nil, fmt.Errorf("Укажите дату и время")
	}

	newDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return nil, fmt.Errorf("Неверная дата")
	}

	timeParts := parseTime(req.Time)
	startsAt := time.Date(newDate.Year(), newDate.Month(), newDate.Day(), timeParts[0], timeParts[1], 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(booking.DurationMinutes) * time.Minute)

	// Check conflicts
	hasConflict, _ := db.HasConflictingBooking(booking.TrainerID, startsAt, endsAt, booking.ID)
	if hasConflict {
		return nil, fmt.Errorf("Время занято")
	}

	newBooking, err := db.CreateRescheduleBooking(
		booking.TrainerID, booking.ClientID, booking.SessionTypeID,
		startsAt, endsAt, booking.ClientName, booking.DurationMinutes,
		scheduleID, booking.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("Внутренняя ошибка сервера")
	}
	return newBooking, nil
}

func HandleAdminCancelRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	id := chi.URLParam(r, "id")
	schedule, err := db.GetRecurringScheduleByID(id)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.TrainerID != trainer.ID {
		http.Error(w, "Расписание не найдено", http.StatusNotFound)
		return
	}
	if schedule.Status == models.RecurringScheduleStatusCancelled {
		http.Error(w, "Расписание уже отменено", http.StatusBadRequest)
		return
	}

	if err := db.UpdateRecurringScheduleStatus(id, models.RecurringScheduleStatusCancelled); err != nil {
		log.Printf("Error cancelling recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 RECURRING CANCEL (ADMIN) [%s]", id[:8])
	w.WriteHeader(http.StatusNoContent)
}
