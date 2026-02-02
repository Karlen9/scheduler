package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

// ========== Trainer Settings ==========

type UpdateTrainerRequest struct {
	Name            string `json:"name,omitempty"`
	Timezone        string `json:"timezone,omitempty"`
	CancelCutoffHrs *int   `json:"cancelCutoffHours,omitempty"`
}

func HandleGetTrainerSettings(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	writeJSON(w, trainer)
}

func HandleUpdateTrainerSettings(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	var req UpdateTrainerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
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
		http.Error(w, "Internal server error", http.StatusInternalServerError)
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
}

type UpdateSessionTypeRequest struct {
	Name            string `json:"name,omitempty"`
	DurationMinutes *int   `json:"durationMinutes,omitempty"`
	Price           *int   `json:"price,omitempty"`
	Currency        string `json:"currency,omitempty"`
	IsActive        *bool  `json:"isActive,omitempty"`
}

func HandleAdminGetServices(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	services, err := db.GetAllSessionTypesByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting services: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
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
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	var req CreateSessionTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Type == "" || req.Name == "" || req.DurationMinutes <= 0 || req.Price < 0 {
		http.Error(w, "type, name, durationMinutes, and price are required", http.StatusBadRequest)
		return
	}

	currency := req.Currency
	if currency == "" {
		currency = "RUB"
	}

	// Check if type already exists
	existing, err := db.GetSessionTypeByType(trainer.ID, req.Type)
	if err != nil {
		log.Printf("Error checking existing service: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if existing != nil {
		http.Error(w, "Session type with this type already exists", http.StatusConflict)
		return
	}

	service, err := db.CreateSessionType(trainer.ID, req.Type, req.Name, req.DurationMinutes, req.Price, currency)
	if err != nil {
		log.Printf("Error creating service: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, service)
}

func HandleUpdateService(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	sessionType := chi.URLParam(r, "type")
	if sessionType == "" {
		http.Error(w, "Session type is required", http.StatusBadRequest)
		return
	}

	existing, err := db.GetSessionTypeByType(trainer.ID, sessionType)
	if err != nil {
		log.Printf("Error getting service: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "Session type not found", http.StatusNotFound)
		return
	}

	var req UpdateSessionTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Apply updates
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

	isActive := existing.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	updated, err := db.UpdateSessionType(existing.ID, name, duration, price, currency, isActive)
	if err != nil {
		log.Printf("Error updating service: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, updated)
}

func HandleDeleteService(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	sessionType := chi.URLParam(r, "type")
	if sessionType == "" {
		http.Error(w, "Session type is required", http.StatusBadRequest)
		return
	}

	existing, err := db.GetSessionTypeByType(trainer.ID, sessionType)
	if err != nil {
		log.Printf("Error getting service: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "Session type not found", http.StatusNotFound)
		return
	}

	// Soft delete (deactivate)
	if err := db.DeactivateSessionType(existing.ID); err != nil {
		log.Printf("Error deactivating service: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
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
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	hours, err := db.GetWorkingHoursByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting working hours: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
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
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	var req BulkWorkingHoursRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Clear existing and set new
	if err := db.ClearWorkingHours(trainer.ID); err != nil {
		log.Printf("Error clearing working hours: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	for _, wh := range req.Hours {
		if wh.DayOfWeek < 0 || wh.DayOfWeek > 6 {
			http.Error(w, "dayOfWeek must be 0-6", http.StatusBadRequest)
			return
		}
		if wh.StartTime == "" || wh.EndTime == "" {
			http.Error(w, "startTime and endTime are required", http.StatusBadRequest)
			return
		}

		if err := db.UpsertWorkingHours(trainer.ID, wh.DayOfWeek, wh.StartTime, wh.EndTime); err != nil {
			log.Printf("Error setting working hours: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
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
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	dayStr := chi.URLParam(r, "day")
	day, err := strconv.Atoi(dayStr)
	if err != nil || day < 0 || day > 6 {
		http.Error(w, "Invalid day (must be 0-6)", http.StatusBadRequest)
		return
	}

	var req WorkingHoursRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.StartTime == "" || req.EndTime == "" {
		http.Error(w, "startTime and endTime are required", http.StatusBadRequest)
		return
	}

	if err := db.UpsertWorkingHours(trainer.ID, day, req.StartTime, req.EndTime); err != nil {
		log.Printf("Error setting working hours: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	hours, _ := db.GetWorkingHoursByTrainerID(trainer.ID)
	writeJSON(w, hours)
}

func HandleDeleteWorkingHoursForDay(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	dayStr := chi.URLParam(r, "day")
	day, err := strconv.Atoi(dayStr)
	if err != nil || day < 0 || day > 6 {
		http.Error(w, "Invalid day (must be 0-6)", http.StatusBadRequest)
		return
	}

	if err := db.DeleteWorkingHours(trainer.ID, day); err != nil {
		log.Printf("Error deleting working hours: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ========== Bookings Management ==========

func HandleAdminGetBookings(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	status := r.URL.Query().Get("status")

	bookings, err := db.GetBookingsByTrainerID(trainer.ID, status)
	if err != nil {
		log.Printf("Error getting bookings: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if bookings == nil {
		bookings = []models.Booking{}
	}

	writeJSON(w, bookings)
}

type UpdateBookingStatusRequest struct {
	Status string `json:"status"`
}

func HandleAdminUpdateBookingStatus(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		http.Error(w, "Booking ID is required", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if booking == nil || booking.TrainerID != trainer.ID {
		http.Error(w, "Booking not found", http.StatusNotFound)
		return
	}

	var req UpdateBookingStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	validStatuses := map[string]bool{
		"pending": true, "confirmed": true, "rejected": true, "cancelled": true, "completed": true,
	}
	if !validStatuses[req.Status] {
		http.Error(w, "Invalid status", http.StatusBadRequest)
		return
	}

	if err := db.UpdateBookingStatus(bookingID, models.BookingStatus(req.Status)); err != nil {
		log.Printf("Error updating booking status: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	booking, _ = db.GetBookingByID(bookingID)
	writeJSON(w, booking)
}
