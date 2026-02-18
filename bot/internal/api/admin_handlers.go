package api

import (
	"encoding/json"
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

// parseDate parses a date string in YYYY-MM-DD format
func parseDate(dateStr string) (time.Time, error) {
	return time.Parse("2006-01-02", dateStr)
}

// ========== Durations ==========

// getDurationsFromServices derives unique durations from active session types
func getDurationsFromServices(trainerID string) []int {
	services, err := db.GetSessionTypesByTrainerID(trainerID)
	if err != nil || len(services) == 0 {
		return []int{}
	}
	seen := map[int]bool{}
	var durations []int
	for _, s := range services {
		if !seen[s.DurationMinutes] {
			seen[s.DurationMinutes] = true
			durations = append(durations, s.DurationMinutes)
		}
	}
	sort.Ints(durations)
	if durations == nil {
		durations = []int{}
	}
	return durations
}

// HandleGetDurations returns available durations derived from active session types (public endpoint)
func HandleGetDurations(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	durations := getDurationsFromServices(trainer.ID)
	writeJSON(w, durations)
}

// HandleAdminGetDurations returns durations derived from active session types
func HandleAdminGetDurations(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	durations := getDurationsFromServices(trainer.ID)
	writeJSON(w, durations)
}

// ========== Trainer Settings ==========

type UpdateTrainerRequest struct {
	Name            string `json:"name,omitempty"`
	Timezone        string `json:"timezone,omitempty"`
	CancelCutoffHrs *int   `json:"cancelCutoffHours,omitempty"`
}

func HandleGetTrainerSettings(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	writeJSON(w, trainer)
}

func HandleUpdateTrainerSettings(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	var req UpdateTrainerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	// Apply updates
	name := trainer.Name
	if req.Name != "" {
		name = req.Name
	}

	timezone := trainer.Timezone
	if req.Timezone != "" {
		timezone = req.Timezone
	}

	cancelCutoff := trainer.CancelCutoffHrs
	if req.CancelCutoffHrs != nil {
		cancelCutoff = *req.CancelCutoffHrs
	}

	updated, err := db.UpdateTrainer(trainer.ID, name, timezone, cancelCutoff)
	if err != nil {
		log.Printf("Error updating trainer: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	writeJSON(w, updated)
}

// ========== Session Types ==========

type CreateSessionTypeRequest struct {
	Type            string `json:"type"`
	Name            string `json:"name"`
	DurationMinutes int    `json:"durationMinutes"`
	Price           int    `json:"price"`
	Currency        string `json:"currency,omitempty"`
	ImageURL        string `json:"imageUrl,omitempty"`
}

type UpdateSessionTypeRequest struct {
	Type            string  `json:"type,omitempty"`
	Name            string  `json:"name,omitempty"`
	DurationMinutes *int    `json:"durationMinutes,omitempty"`
	Price           *int    `json:"price,omitempty"`
	Currency        string  `json:"currency,omitempty"`
	ImageURL        *string `json:"imageUrl,omitempty"`
	IsActive        *bool   `json:"isActive,omitempty"`
}

func HandleAdminGetServices(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	services, err := db.GetAllSessionTypesByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting services: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if services == nil {
		services = []models.SessionType{}
	}

	writeJSON(w, services)
}

func HandleCreateService(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	var req CreateSessionTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if req.Type == "" || req.Name == "" || req.DurationMinutes <= 0 || req.Price < 0 {
		httpError(w, r, "Error.MissingFields", http.StatusBadRequest)
		return
	}

	if len(req.Name) > 100 {
		httpError(w, r, "Error.NameTooLong", http.StatusBadRequest)
		return
	}

	currency := req.Currency
	if currency == "" {
		currency = "RUB"
	}

	service, err := db.CreateSessionType(trainer.ID, req.Type, req.Name, req.DurationMinutes, req.Price, currency, req.ImageURL)
	if err != nil {
		log.Printf("Error creating service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, service)
}

func HandleUpdateService(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	serviceID := chi.URLParam(r, "id")
	if serviceID == "" {
		httpError(w, r, "Error.MissingServiceID", http.StatusBadRequest)
		return
	}

	existing, err := db.GetSessionTypeByID(serviceID)
	if err != nil {
		log.Printf("Error getting service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if existing == nil || existing.TrainerID != trainer.ID {
		httpError(w, r, "Error.ServiceNotFound", http.StatusNotFound)
		return
	}

	var req UpdateSessionTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if len(req.Name) > 100 {
		httpError(w, r, "Error.NameTooLong", http.StatusBadRequest)
		return
	}

	// Apply updates
	sessionType := existing.Type
	if req.Type != "" {
		sessionType = req.Type
	}

	name := existing.Name
	if req.Name != "" {
		name = req.Name
	}

	duration := existing.DurationMinutes
	if req.DurationMinutes != nil {
		duration = *req.DurationMinutes
	}

	price := existing.Price
	if req.Price != nil {
		price = *req.Price
	}

	currency := existing.Currency
	if req.Currency != "" {
		currency = req.Currency
	}

	imageURL := existing.ImageURL
	if req.ImageURL != nil {
		imageURL = *req.ImageURL
	}

	isActive := existing.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	updated, err := db.UpdateSessionType(existing.ID, sessionType, name, duration, price, currency, imageURL, isActive)
	if err != nil {
		log.Printf("Error updating service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	writeJSON(w, updated)
}

func HandleDeleteService(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	serviceID := chi.URLParam(r, "id")
	if serviceID == "" {
		httpError(w, r, "Error.MissingServiceID", http.StatusBadRequest)
		return
	}

	existing, err := db.GetSessionTypeByID(serviceID)
	if err != nil {
		log.Printf("Error getting service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if existing == nil || existing.TrainerID != trainer.ID {
		httpError(w, r, "Error.ServiceNotFound", http.StatusNotFound)
		return
	}

	// Soft delete (deactivate)
	if err := db.DeactivateSessionType(existing.ID); err != nil {
		log.Printf("Error deactivating service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ========== Working Hours ==========

type WorkingHoursRequest struct {
	DayOfWeek int    `json:"dayOfWeek"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
}

type BulkWorkingHoursRequest struct {
	Hours []WorkingHoursRequest `json:"hours"`
}

func HandleAdminGetWorkingHours(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	hours, err := db.GetWorkingHoursByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting working hours: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if hours == nil {
		hours = []models.WorkingHours{}
	}

	writeJSON(w, hours)
}

func HandleUpdateWorkingHours(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	var req BulkWorkingHoursRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	// Clear existing and set new
	if err := db.ClearWorkingHours(trainer.ID); err != nil {
		log.Printf("Error clearing working hours: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	for _, wh := range req.Hours {
		if wh.DayOfWeek < 0 || wh.DayOfWeek > 6 {
			httpError(w, r, "Error.DayOfWeekRange", http.StatusBadRequest)
			return
		}
		if wh.StartTime == "" || wh.EndTime == "" {
			httpError(w, r, "Error.MissingTimeRange", http.StatusBadRequest)
			return
		}

		if err := db.UpsertWorkingHours(trainer.ID, wh.DayOfWeek, wh.StartTime, wh.EndTime); err != nil {
			log.Printf("Error setting working hours: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
	}

	// Return updated hours
	hours, _ := db.GetWorkingHoursByTrainerID(trainer.ID)
	writeJSON(w, hours)
}

func HandleSetWorkingHoursForDay(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	dayStr := chi.URLParam(r, "day")
	day, err := strconv.Atoi(dayStr)
	if err != nil || day < 0 || day > 6 {
		httpError(w, r, "Error.InvalidDayOfWeek", http.StatusBadRequest)
		return
	}

	var req WorkingHoursRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if req.StartTime == "" || req.EndTime == "" {
		httpError(w, r, "Error.MissingTimeRange", http.StatusBadRequest)
		return
	}

	if err := db.UpsertWorkingHours(trainer.ID, day, req.StartTime, req.EndTime); err != nil {
		log.Printf("Error setting working hours: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	hours, _ := db.GetWorkingHoursByTrainerID(trainer.ID)
	writeJSON(w, hours)
}

func HandleDeleteWorkingHoursForDay(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	dayStr := chi.URLParam(r, "day")
	day, err := strconv.Atoi(dayStr)
	if err != nil || day < 0 || day > 6 {
		httpError(w, r, "Error.InvalidDayOfWeek", http.StatusBadRequest)
		return
	}

	if err := db.DeleteWorkingHours(trainer.ID, day); err != nil {
		log.Printf("Error deleting working hours: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ========== Bookings Management ==========

func HandleAdminGetBookings(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	status := r.URL.Query().Get("status")

	bookings, err := db.GetBookingsByTrainerID(trainer.ID, status)
	if err != nil {
		log.Printf("Error getting bookings: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if bookings == nil {
		bookings = []models.Booking{}
	}

	writeJSON(w, bookings)
}

type UpdateBookingStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
}

func HandleAdminUpdateBookingStatus(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		httpError(w, r, "Error.MissingBookingID", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil || booking.TrainerID != trainer.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}

	var req UpdateBookingStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	validStatuses := map[string]bool{
		"pending": true, "confirmed": true, "rejected": true, "cancelled": true, "completed": true,
	}
	if !validStatuses[req.Status] {
		httpError(w, r, "Error.InvalidStatus", http.StatusBadRequest)
		return
	}

	oldStatus := booking.Status
	if (req.Status == "cancelled" || req.Status == "rejected") && req.Reason != "" {
		if err := db.CancelBooking(bookingID, req.Reason, models.CancelledByTrainer); err != nil {
			log.Printf("Error cancelling booking: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
		if req.Status == "rejected" {
			db.UpdateBookingStatus(bookingID, models.BookingStatusRejected)
		}
	} else if err := db.UpdateBookingStatus(bookingID, models.BookingStatus(req.Status)); err != nil {
		log.Printf("Error updating booking status: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 BOOKING STATUS [%s] %s → %s | Client: %s | Trainer: %s (@%s)",
		bookingID[:8],
		oldStatus,
		req.Status,
		booking.ClientName,
		trainer.Name,
		trainer.BotUsername,
	)

	// Refresh booking to get updated status + session type
	booking, _ = db.GetBookingByID(bookingID)

	// Notify client about status change
	if NotifyStatusChangeFunc != nil && booking != nil {
		if err := NotifyStatusChangeFunc(booking, req.Status); err != nil {
			log.Printf("Error notifying client about status change: %v", err)
		}
	}

	// Update trainer's Telegram notification message (remove buttons)
	if UpdateTrainerMessageFunc != nil && booking != nil {
		if err := UpdateTrainerMessageFunc(booking); err != nil {
			log.Printf("Error updating trainer message: %v", err)
		}
	}

	writeJSON(w, booking)
}

// ========== Reschedule Booking ==========

type AdminRescheduleBookingRequest struct {
	Date string `json:"date"` // "2026-03-10"
	Time string `json:"time"` // "10:00"
}

func HandleAdminRescheduleBooking(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		httpError(w, r, "Error.MissingBookingID", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil || booking.TrainerID != trainer.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}

	if booking.Status != models.BookingStatusPending && booking.Status != models.BookingStatusConfirmed {
		httpError(w, r, "Error.BookingCannotModify", http.StatusBadRequest)
		return
	}

	var req AdminRescheduleBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if req.Date == "" || req.Time == "" {
		httpError(w, r, "Error.MissingDateTime", http.StatusBadRequest)
		return
	}

	date, err := parseDate(req.Date)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}

	timeParts := parseTime(req.Time)
	duration := booking.DurationMinutes
	if duration == 0 && booking.SessionType != nil {
		duration = booking.SessionType.DurationMinutes
	}
	if duration == 0 {
		duration = 60
	}

	startsAt := time.Date(date.Year(), date.Month(), date.Day(), timeParts[0], timeParts[1], 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(duration) * time.Minute)

	// Check for conflicts (exclude current booking)
	hasConflict, err := db.HasConflictingBooking(trainer.ID, startsAt, endsAt, bookingID)
	if err != nil {
		log.Printf("Error checking conflicts: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if hasConflict {
		httpError(w, r, "Error.BookingConflict", http.StatusConflict)
		return
	}

	if err := db.UpdateBookingDateTime(bookingID, startsAt, endsAt, duration); err != nil {
		log.Printf("Error updating booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("📅 RESCHEDULE [%s] Trainer: %s moved booking for client: %s | New: %s %s",
		bookingID[:8], trainer.Name, booking.ClientName, req.Date, req.Time)

	// Refresh booking
	booking, _ = db.GetBookingByID(bookingID)

	// Notify client
	if NotifyStatusChangeFunc != nil && booking != nil {
		if err := NotifyStatusChangeFunc(booking, "rescheduled"); err != nil {
			log.Printf("Error notifying client about reschedule: %v", err)
		}
	}

	writeJSON(w, booking)
}

// ========== Trainer-Initiated Bookings ==========

// NotifyTrainerBookingFunc is a callback to notify client about trainer-created booking
var NotifyTrainerBookingFunc func(booking *models.Booking) error

type AdminCreateBookingRequest struct {
	ClientID string `json:"clientId"`
	Duration int    `json:"duration"`
	Date     string `json:"date"`
	Time     string `json:"time"`
	Message  string `json:"message,omitempty"`
}

func HandleAdminCreateBooking(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	var req AdminCreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if req.ClientID == "" || req.Duration <= 0 || req.Date == "" || req.Time == "" {
		httpError(w, r, "Error.MissingFields", http.StatusBadRequest)
		return
	}

	// Verify client belongs to this trainer
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

	// Parse date and time
	date, err := parseDate(req.Date)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}

	timeParts := parseTime(req.Time)
	startsAt := time.Date(date.Year(), date.Month(), date.Day(), timeParts[0], timeParts[1], 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(req.Duration) * time.Minute)

	// Check for conflicts
	hasConflict, err := db.HasConflictingBooking(trainer.ID, startsAt, endsAt, "")
	if err != nil {
		log.Printf("Error checking conflicts: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if hasConflict {
		httpError(w, r, "Error.BookingConflict", http.StatusConflict)
		return
	}

	// Find session type by duration (same pattern as waitlist)
	services, err := db.GetSessionTypesByTrainerID(trainer.ID)
	if err != nil || len(services) == 0 {
		httpError(w, r, "Error.NoServices", http.StatusBadRequest)
		return
	}
	sessionTypeID := services[0].ID
	for _, s := range services {
		if s.DurationMinutes == req.Duration {
			sessionTypeID = s.ID
			break
		}
	}

	// Create booking with created_by = "trainer"
	booking, err := db.CreateBookingByTrainer(trainer.ID, client.ID, sessionTypeID, startsAt, endsAt, client.Name, req.Message, req.Duration)
	if err != nil {
		log.Printf("Error creating booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("📅 TRAINER BOOKING [%s] Trainer: %s booked client: %s | Duration: %dmin | Time: %s %s",
		booking.ID[:8], trainer.Name, client.Name, req.Duration, req.Date, req.Time)

	// Ghost clients: auto-confirm and skip notification
	if client.IsGhost {
		if err := db.UpdateBookingStatus(booking.ID, models.BookingStatusConfirmed); err != nil {
			log.Printf("Error auto-confirming ghost booking: %v", err)
		}
		booking, _ = db.GetBookingByID(booking.ID)
	} else {
		// Notify client about trainer-created booking
		if NotifyTrainerBookingFunc != nil {
			if err := NotifyTrainerBookingFunc(booking); err != nil {
				log.Printf("Error notifying client about trainer booking: %v", err)
			}
		}
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, booking)
}

// ========== Days Off ==========

type CreateDayOffRequest struct {
	Date   string `json:"date"` // YYYY-MM-DD
	Reason string `json:"reason,omitempty"`
}

func HandleGetDaysOff(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	daysOff, err := db.GetDaysOffByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting days off: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if daysOff == nil {
		daysOff = []models.DayOff{}
	}

	writeJSON(w, daysOff)
}

func HandleCreateDayOff(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	var req CreateDayOffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if req.Date == "" {
		httpError(w, r, "Error.MissingDate", http.StatusBadRequest)
		return
	}

	date, err := parseDate(req.Date)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}

	// Check if already exists
	existing, _ := db.GetDayOff(trainer.ID, date)
	if existing != nil {
		httpError(w, r, "Error.DayOffDuplicate", http.StatusConflict)
		return
	}

	dayOff, err := db.CreateDayOff(trainer.ID, date, req.Reason)
	if err != nil {
		log.Printf("Error creating day off: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, dayOff)
}

func HandleDeleteDayOff(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	dayOffID := chi.URLParam(r, "id")
	if dayOffID == "" {
		httpError(w, r, "Error.MissingDayOffID", http.StatusBadRequest)
		return
	}

	if err := db.DeleteDayOff(dayOffID); err != nil {
		log.Printf("Error deleting day off: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ========== Profile ==========

type UpdateProfileRequest struct {
	Name           string   `json:"name,omitempty"`
	TelegramHandle string   `json:"telegramHandle,omitempty"`
	Phone          string   `json:"phone,omitempty"`
	Specialization string   `json:"specialization,omitempty"`
	Bio            string   `json:"bio,omitempty"`
	PhotoURL       string   `json:"photoUrl,omitempty"`
	GymLatitude    *float64 `json:"gymLatitude,omitempty"`
	GymLongitude   *float64 `json:"gymLongitude,omitempty"`
	Language       string   `json:"language,omitempty"`
}

func HandleGetProfile(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	resp := TrainerResponse{
		ID:              trainer.ID,
		Name:            trainer.Name,
		Timezone:        trainer.Timezone,
		CancelCutoffHrs: trainer.CancelCutoffHrs,
		TelegramHandle:  trainer.TelegramHandle,
		Phone:           trainer.Phone,
		Specialization:  trainer.Specialization,
		Bio:             trainer.Bio,
		PhotoURL:        trainer.PhotoURL,
		GymLatitude:     trainer.GymLatitude,
		GymLongitude:    trainer.GymLongitude,
		Language:        trainer.Language,
	}

	writeJSON(w, resp)
}

func HandleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if len(req.Name) > 50 || len(req.Specialization) > 100 || len(req.Bio) > 500 || len(req.Phone) > 20 || len(req.TelegramHandle) > 50 {
		httpError(w, r, "Error.FieldTooLong", http.StatusBadRequest)
		return
	}

	// Update name if provided
	if req.Name != "" {
		trainer.Name = req.Name
		db.UpdateTrainer(trainer.ID, trainer.Name, trainer.Timezone, trainer.CancelCutoffHrs)
	}

	// Update profile fields
	telegramHandle := trainer.TelegramHandle
	if req.TelegramHandle != "" {
		telegramHandle = req.TelegramHandle
	}
	phone := trainer.Phone
	if req.Phone != "" {
		phone = req.Phone
	}
	specialization := trainer.Specialization
	if req.Specialization != "" {
		specialization = req.Specialization
	}
	bio := trainer.Bio
	if req.Bio != "" {
		bio = req.Bio
	}
	photoURL := trainer.PhotoURL
	if req.PhotoURL != "" {
		photoURL = req.PhotoURL
	}

	gymLatitude := trainer.GymLatitude
	if req.GymLatitude != nil {
		gymLatitude = *req.GymLatitude
	}
	gymLongitude := trainer.GymLongitude
	if req.GymLongitude != nil {
		gymLongitude = *req.GymLongitude
	}

	updated, err := db.UpdateTrainerProfile(trainer.ID, telegramHandle, phone, specialization, bio, photoURL, gymLatitude, gymLongitude)
	if err != nil {
		log.Printf("Error updating profile: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	// Update language if valid
	if req.Language == "ru" || req.Language == "en" {
		db.UpdateTrainerLanguage(trainer.ID, req.Language)
		updated.Language = req.Language
	}

	resp := TrainerResponse{
		ID:              updated.ID,
		Name:            updated.Name,
		Timezone:        updated.Timezone,
		CancelCutoffHrs: updated.CancelCutoffHrs,
		TelegramHandle:  updated.TelegramHandle,
		Phone:           updated.Phone,
		Specialization:  updated.Specialization,
		Bio:             updated.Bio,
		PhotoURL:        updated.PhotoURL,
		GymLatitude:     updated.GymLatitude,
		GymLongitude:    updated.GymLongitude,
		Language:        updated.Language,
	}

	writeJSON(w, resp)
}

// ========== Admin Clients ==========

func HandleAdminCreateGhostClient(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		httpError(w, r, "Error.MissingClientName", http.StatusBadRequest)
		return
	}

	client, err := db.CreateGhostClient(trainer.ID, name)
	if err != nil {
		log.Printf("Error creating ghost client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("👻 GHOST CLIENT created: %s for trainer %s", name, trainer.Name)

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, client)
}

func HandleAdminDeleteClient(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	clientID := chi.URLParam(r, "id")
	if clientID == "" {
		httpError(w, r, "Error.MissingClientID", http.StatusBadRequest)
		return
	}

	client, err := db.GetClientByID(clientID)
	if err != nil {
		log.Printf("Error getting client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if client == nil || client.TrainerID != trainer.ID {
		httpError(w, r, "Error.ClientNotFound", http.StatusNotFound)
		return
	}

	if err := db.DeleteClient(clientID); err != nil {
		log.Printf("Error deleting client: %v", err)
		httpError(w, r, "Error.DeleteClientBookings", http.StatusConflict)
		return
	}

	log.Printf("🗑 CLIENT deleted: %s (%s) by trainer %s", client.Name, clientID[:8], trainer.Name)
	w.WriteHeader(http.StatusNoContent)
}

func HandleAdminGetClients(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	clients, err := db.GetClientsByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting clients: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if clients == nil {
		clients = []models.Client{}
	}

	writeJSON(w, clients)
}

// ========== Admin Notification Preferences ==========

type AdminNotificationPrefsResponse struct {
	NotifyNewBookings   bool `json:"notifyNewBookings"`
	NotifyCancellations bool `json:"notifyCancellations"`
}

type UpdateAdminNotificationPrefsRequest struct {
	NotifyNewBookings   *bool `json:"notifyNewBookings"`
	NotifyCancellations *bool `json:"notifyCancellations"`
}

func HandleAdminGetNotificationPrefs(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	resp := AdminNotificationPrefsResponse{
		NotifyNewBookings:   trainer.NotifyNewBookings,
		NotifyCancellations: trainer.NotifyCancellations,
	}
	writeJSON(w, resp)
}

func HandleAdminUpdateNotificationPrefs(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		httpError(w, r, "Error.TrainerNotFound", http.StatusNotFound)
		return
	}

	var req UpdateAdminNotificationPrefsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	notifyNewBookings := trainer.NotifyNewBookings
	if req.NotifyNewBookings != nil {
		notifyNewBookings = *req.NotifyNewBookings
	}
	notifyCancellations := trainer.NotifyCancellations
	if req.NotifyCancellations != nil {
		notifyCancellations = *req.NotifyCancellations
	}

	if err := db.UpdateTrainerNotificationPrefs(trainer.ID, notifyNewBookings, notifyCancellations); err != nil {
		log.Printf("Error updating notification prefs: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	resp := AdminNotificationPrefsResponse{
		NotifyNewBookings:   notifyNewBookings,
		NotifyCancellations: notifyCancellations,
	}
	writeJSON(w, resp)
}

// ========== Super Admin ==========

type TrainerListItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	BotUsername string `json:"botUsername"`
	IsActive    bool   `json:"isActive"`
	CreatedAt   string `json:"createdAt"`
}

func HandleListAllTrainers(w http.ResponseWriter, r *http.Request) {
	trainers, err := db.GetAllActiveTrainers()
	if err != nil {
		log.Printf("Error getting trainers: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	result := make([]TrainerListItem, len(trainers))
	for i, t := range trainers {
		result[i] = TrainerListItem{
			ID:          t.ID,
			Name:        t.Name,
			BotUsername: t.BotUsername,
			IsActive:    t.IsActive,
			CreatedAt:   t.CreatedAt.Format("2006-01-02 15:04:05"),
		}
	}

	writeJSON(w, result)
}
