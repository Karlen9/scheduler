package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

// NotifyBookingFunc is a callback to notify trainer about new booking
var NotifyBookingFunc func(booking *models.Booking) error

// TrainerResponse is the API response for trainer info
type TrainerResponse struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Timezone        string `json:"timezone"`
	CancelCutoffHrs int    `json:"cancelCutoffHours"`
	BotUsername     string `json:"botUsername,omitempty"`
	TelegramHandle  string `json:"telegramHandle,omitempty"`
	Phone           string `json:"phone,omitempty"`
	Specialization  string `json:"specialization,omitempty"`
	Bio             string `json:"bio,omitempty"`
	PhotoURL        string `json:"photoUrl,omitempty"`
}

func HandleGetTrainer(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	resp := TrainerResponse{
		ID:              trainer.ID,
		Name:            trainer.Name,
		Timezone:        trainer.Timezone,
		CancelCutoffHrs: trainer.CancelCutoffHrs,
		BotUsername:     trainer.BotUsername,
		TelegramHandle:  trainer.TelegramHandle,
		Phone:           trainer.Phone,
		Specialization:  trainer.Specialization,
		Bio:             trainer.Bio,
		PhotoURL:        trainer.PhotoURL,
	}

	writeJSON(w, resp)
}

func HandleGetServices(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	services, err := db.GetSessionTypesByTrainerID(trainer.ID)
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

func HandleGetWorkingHours(w http.ResponseWriter, r *http.Request) {
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

func HandleGetAvailability(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Trainer not found", http.StatusNotFound)
		return
	}

	dateStr := r.URL.Query().Get("date")
	sessionTypeParam := r.URL.Query().Get("sessionType")

	if dateStr == "" || sessionTypeParam == "" {
		http.Error(w, "date and sessionType are required", http.StatusBadRequest)
		return
	}

	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		http.Error(w, "Invalid date format (use YYYY-MM-DD)", http.StatusBadRequest)
		return
	}

	// Get session type by type name
	sessionType, err := db.GetSessionTypeByType(trainer.ID, sessionTypeParam)
	if err != nil || sessionType == nil {
		http.Error(w, "Invalid session type. Use: personal, pair, consultation", http.StatusBadRequest)
		return
	}

	// Get working hours for this day
	hours, err := db.GetWorkingHoursByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting working hours: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	dayOfWeek := int(date.Weekday())
	var workingHour *models.WorkingHours
	for _, wh := range hours {
		if wh.DayOfWeek == dayOfWeek {
			workingHour = &wh
			break
		}
	}

	if workingHour == nil {
		writeJSON(w, []models.TimeSlot{})
		return
	}

	// Get existing bookings for this date
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	endOfDay := startOfDay.AddDate(0, 0, 1)
	bookings, err := db.GetBookingsByTrainerIDAndDateRange(trainer.ID, startOfDay, endOfDay)
	if err != nil {
		log.Printf("Error getting bookings: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Generate time slots
	slots := generateTimeSlots(date, workingHour, sessionType.DurationMinutes, bookings)
	writeJSON(w, slots)
}

func generateTimeSlots(date time.Time, wh *models.WorkingHours, duration int, bookings []models.Booking) []models.TimeSlot {
	var slots []models.TimeSlot

	startParts := parseTime(wh.StartTime)
	endParts := parseTime(wh.EndTime)

	startMinutes := startParts[0]*60 + startParts[1]
	endMinutes := endParts[0]*60 + endParts[1]

	for minutes := startMinutes; minutes+duration <= endMinutes; minutes += 30 {
		hour := minutes / 60
		min := minutes % 60
		timeStr := formatTime(hour, min)

		slotStart := time.Date(date.Year(), date.Month(), date.Day(), hour, min, 0, 0, time.UTC)
		slotEnd := slotStart.Add(time.Duration(duration) * time.Minute)

		available := true
		for _, booking := range bookings {
			if slotStart.Before(booking.EndsAt) && slotEnd.After(booking.StartsAt) {
				available = false
				break
			}
		}

		slots = append(slots, models.TimeSlot{
			Time:      timeStr,
			Available: available,
		})
	}

	return slots
}

func parseTime(t string) []int {
	parts := make([]int, 2)
	if len(t) >= 5 {
		parts[0], _ = strconv.Atoi(t[0:2])
		parts[1], _ = strconv.Atoi(t[3:5])
	}
	return parts
}

func formatTime(hour, min int) string {
	return strconv.Itoa(hour/10) + strconv.Itoa(hour%10) + ":" + strconv.Itoa(min/10) + strconv.Itoa(min%10)
}

func HandleGetBookings(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	bookings, err := db.GetActiveBookingsByClientID(client.ID)
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

// CreateBookingRequest is the request body for creating a booking
type CreateBookingRequest struct {
	SessionType string `json:"sessionType"` // personal, pair, consultation
	Date        string `json:"date"`
	Time        string `json:"time"`
	Name        string `json:"name"`
	Message     string `json:"message,omitempty"`
}

func HandleCreateBooking(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	trainer := GetTrainerFromContext(r)
	if client == nil || trainer == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.SessionType == "" || req.Date == "" || req.Time == "" || req.Name == "" {
		http.Error(w, "sessionType, date, time, and name are required", http.StatusBadRequest)
		return
	}

	// Parse date and time
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		http.Error(w, "Invalid date format", http.StatusBadRequest)
		return
	}

	timeParts := parseTime(req.Time)
	startsAt := time.Date(date.Year(), date.Month(), date.Day(), timeParts[0], timeParts[1], 0, 0, time.UTC)

	// Get session type by type name
	sessionType, err := db.GetSessionTypeByType(trainer.ID, req.SessionType)
	if err != nil || sessionType == nil {
		http.Error(w, "Invalid session type. Use: personal, pair, consultation", http.StatusBadRequest)
		return
	}

	endsAt := startsAt.Add(time.Duration(sessionType.DurationMinutes) * time.Minute)

	// Check if client already has a booking on this date
	hasBooking, err := db.ClientHasBookingOnDate(client.ID, date)
	if err != nil {
		log.Printf("Error checking client bookings: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if hasBooking {
		http.Error(w, "У вас уже есть запись на этот день", http.StatusConflict)
		return
	}

	// Check for conflicts
	hasConflict, err := db.HasConflictingBooking(trainer.ID, startsAt, endsAt, "")
	if err != nil {
		log.Printf("Error checking conflicts: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if hasConflict {
		http.Error(w, "This time slot is no longer available", http.StatusConflict)
		return
	}

	// Update client name if provided
	if req.Name != client.Name {
		if err := db.UpdateClientName(client.ID, req.Name); err != nil {
			log.Printf("Error updating client name: %v", err)
		}
	}

	// Create booking
	booking, err := db.CreateBooking(trainer.ID, client.ID, sessionType.ID, startsAt, endsAt, req.Name, req.Message)
	if err != nil {
		log.Printf("Error creating booking: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Log booking creation
	log.Printf("📅 NEW BOOKING [%s] Client: %s | Session: %s | Time: %s %s | Trainer: %s (@%s)",
		booking.ID[:8],
		req.Name,
		sessionType.Name,
		req.Date,
		req.Time,
		trainer.Name,
		trainer.BotUsername,
	)

	// Notify trainer
	if NotifyBookingFunc != nil {
		if err := NotifyBookingFunc(booking); err != nil {
			log.Printf("Error notifying trainer: %v", err)
		}
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, booking)
}

// CancelBookingRequest is the request body for cancelling a booking
type CancelBookingRequest struct {
	Reason string `json:"reason,omitempty"`
}

func HandleCancelBooking(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		http.Error(w, "Invalid booking ID", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if booking == nil {
		http.Error(w, "Booking not found", http.StatusNotFound)
		return
	}

	// Verify booking belongs to client
	if booking.ClientID != client.ID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Check if booking can be cancelled
	if booking.Status != models.BookingStatusPending && booking.Status != models.BookingStatusConfirmed {
		http.Error(w, "Booking cannot be cancelled", http.StatusBadRequest)
		return
	}

	var req CancelBookingRequest
	json.NewDecoder(r.Body).Decode(&req) // Ignore errors, reason is optional

	if err := db.CancelBooking(bookingID, req.Reason, models.CancelledByClient); err != nil {
		log.Printf("Error cancelling booking: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	log.Printf("❌ BOOKING CANCELLED [%s] Client: %s cancelled their booking (reason: %s)",
		bookingID[:8],
		booking.ClientName,
		req.Reason,
	)

	booking, _ = db.GetBookingByID(bookingID)
	writeJSON(w, booking)
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
