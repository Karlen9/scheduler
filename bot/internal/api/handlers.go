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

// NotifyStatusChangeFunc is a callback to notify client when booking status changes via admin panel
var NotifyStatusChangeFunc func(booking *models.Booking, newStatus string) error

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
	Bio             string  `json:"bio,omitempty"`
	PhotoURL        string  `json:"photoUrl,omitempty"`
	GymLatitude     float64 `json:"gymLatitude,omitempty"`
	GymLongitude    float64 `json:"gymLongitude,omitempty"`
}

func HandleGetTrainer(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
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
		GymLatitude:     trainer.GymLatitude,
		GymLongitude:    trainer.GymLongitude,
	}

	writeJSON(w, resp)
}

func HandleGetServices(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	services, err := db.GetSessionTypesByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting services: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	hours, err := db.GetWorkingHoursByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting working hours: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	dateStr := r.URL.Query().Get("date")

	// Support both duration (new) and sessionType (legacy)
	durationParam := r.URL.Query().Get("duration")
	sessionTypeParam := r.URL.Query().Get("sessionType")

	if dateStr == "" {
		http.Error(w, "Укажите дату", http.StatusBadRequest)
		return
	}

	var duration int
	if durationParam != "" {
		var err error
		duration, err = strconv.Atoi(durationParam)
		if err != nil || duration <= 0 {
			http.Error(w, "Неверная длительность", http.StatusBadRequest)
			return
		}
	} else if sessionTypeParam != "" {
		// Legacy: look up duration from session type
		sessionType, err := db.GetSessionTypeByType(trainer.ID, sessionTypeParam)
		if err != nil || sessionType == nil {
			http.Error(w, "Неверный тип услуги", http.StatusBadRequest)
			return
		}
		duration = sessionType.DurationMinutes
	} else {
		http.Error(w, "Укажите длительность", http.StatusBadRequest)
		return
	}

	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		http.Error(w, "Неверный формат даты", http.StatusBadRequest)
		return
	}

	// Check if this date is a day off
	isDayOff, err := db.IsDayOff(trainer.ID, date)
	if err != nil {
		log.Printf("Error checking day off: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if isDayOff {
		writeJSON(w, []models.TimeSlot{})
		return
	}

	// Get working hours for this day
	hours, err := db.GetWorkingHoursByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting working hours: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	// Generate time slots
	slots := generateTimeSlots(date, workingHour, duration, bookings)

	// Enrich with waitlist data
	waitlistCounts, err := db.GetWaitlistCountForSlots(trainer.ID, startOfDay, endOfDay)
	if err != nil {
		log.Printf("Error getting waitlist counts: %v", err)
	}

	client := GetClientFromContext(r)
	var clientWaitlist map[string]bool
	if client != nil {
		clientWaitlist, err = db.GetClientWaitlistForSlots(client.ID, trainer.ID, startOfDay, endOfDay)
		if err != nil {
			log.Printf("Error getting client waitlist: %v", err)
		}
	}

	for i := range slots {
		if !slots[i].Available {
			if waitlistCounts != nil {
				slots[i].WaitlistCount = waitlistCounts[slots[i].Time]
			}
			if clientWaitlist != nil {
				slots[i].HasMyWaitlist = clientWaitlist[slots[i].Time]
			}
		}
	}

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

		endMin := minutes + duration
		endTimeStr := formatTime(endMin/60, endMin%60)

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
			EndTime:   endTimeStr,
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
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	bookings, err := db.GetBookingsByClientID(client.ID)
	if err != nil {
		log.Printf("Error getting bookings: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	if bookings == nil {
		bookings = []models.Booking{}
	}

	writeJSON(w, bookings)
}

// CreateBookingRequest is the request body for creating a booking
type CreateBookingRequest struct {
	SessionType string `json:"sessionType,omitempty"` // legacy: personal, pair, consultation
	Duration    int    `json:"duration,omitempty"`     // new: duration in minutes
	Date        string `json:"date"`
	Time        string `json:"time"`
	Name        string `json:"name"`
	Message     string `json:"message,omitempty"`
}

func HandleCreateBooking(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	trainer := GetTrainerFromContext(r)
	if client == nil || trainer == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	var req CreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if req.Date == "" || req.Time == "" || req.Name == "" {
		http.Error(w, "Укажите дату, время и имя", http.StatusBadRequest)
		return
	}

	// Determine duration and session type ID
	var durationMinutes int
	var sessionTypeID string

	if req.Duration > 0 {
		durationMinutes = req.Duration
		// Find session type matching the requested duration
		services, err := db.GetSessionTypesByTrainerID(trainer.ID)
		if err != nil || len(services) == 0 {
			http.Error(w, "Нет настроенных услуг", http.StatusBadRequest)
			return
		}
		var matchedService *models.SessionType
		for _, s := range services {
			if s.DurationMinutes == req.Duration {
				matchedService = &s
				break
			}
		}
		if matchedService != nil {
			sessionTypeID = matchedService.ID
		} else {
			sessionTypeID = services[0].ID
		}
	} else if req.SessionType != "" {
		// Legacy path
		sessionType, err := db.GetSessionTypeByType(trainer.ID, req.SessionType)
		if err != nil || sessionType == nil {
			http.Error(w, "Неверный тип услуги", http.StatusBadRequest)
			return
		}
		durationMinutes = sessionType.DurationMinutes
		sessionTypeID = sessionType.ID
	} else {
		http.Error(w, "Укажите длительность", http.StatusBadRequest)
		return
	}

	// Parse date and time
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		http.Error(w, "Неверный формат даты", http.StatusBadRequest)
		return
	}

	timeParts := parseTime(req.Time)
	startsAt := time.Date(date.Year(), date.Month(), date.Day(), timeParts[0], timeParts[1], 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(durationMinutes) * time.Minute)

	// Check if client already has a booking on this date
	hasBooking, err := db.ClientHasBookingOnDate(client.ID, date)
	if err != nil {
		log.Printf("Error checking client bookings: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if hasConflict {
		http.Error(w, "Это время уже занято", http.StatusConflict)
		return
	}

	// Update client name if provided
	if req.Name != client.Name {
		if err := db.UpdateClientName(client.ID, req.Name); err != nil {
			log.Printf("Error updating client name: %v", err)
		}
	}

	// Create booking
	booking, err := db.CreateBooking(trainer.ID, client.ID, sessionTypeID, startsAt, endsAt, req.Name, req.Message, durationMinutes)
	if err != nil {
		log.Printf("Error creating booking: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	// Cancel any waitlist entries this client had for this slot
	db.CancelWaitlistEntriesForSlot(client.ID, trainer.ID, startsAt, endsAt)

	// Log booking creation
	log.Printf("📅 NEW BOOKING [%s] Client: %s | Duration: %dmin | Time: %s %s | Trainer: %s (@%s)",
		booking.ID[:8],
		req.Name,
		durationMinutes,
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
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		http.Error(w, "Неверный ID записи", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if booking == nil {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}

	// Verify booking belongs to client
	if booking.ClientID != client.ID {
		http.Error(w, "Нет доступа", http.StatusForbidden)
		return
	}

	// Check if booking can be cancelled
	if booking.Status != models.BookingStatusPending && booking.Status != models.BookingStatusConfirmed {
		http.Error(w, "Запись не может быть отменена", http.StatusBadRequest)
		return
	}

	var req CancelBookingRequest
	json.NewDecoder(r.Body).Decode(&req) // Ignore errors, reason is optional

	if err := db.CancelBooking(bookingID, req.Reason, models.CancelledByClient); err != nil {
		log.Printf("Error cancelling booking: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("❌ BOOKING CANCELLED [%s] Client: %s cancelled their booking (reason: %s)",
		bookingID[:8],
		booking.ClientName,
		req.Reason,
	)

	// Trigger waitlist processing for the freed slot
	go ProcessWaitlistForCancelledBooking(booking.TrainerID, booking.StartsAt, booking.EndsAt)

	booking, _ = db.GetBookingByID(bookingID)
	writeJSON(w, booking)
}

// PublicDayOff is the public response for days off (no reason exposed)
type PublicDayOff struct {
	Date string `json:"date"`
}

func HandleGetPublicDaysOff(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	daysOff, err := db.GetDaysOffByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting days off: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	result := make([]PublicDayOff, 0, len(daysOff))
	for _, d := range daysOff {
		result = append(result, PublicDayOff{
			Date: d.Date.Format("2006-01-02"),
		})
	}

	writeJSON(w, result)
}

// ========== Client Profile ==========

type ClientProfileResponse struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	Phone               string `json:"phone,omitempty"`
	PreferredDuration   int    `json:"preferredDuration,omitempty"`
	NotifyBookingStatus bool   `json:"notifyBookingStatus"`
	NotifyReminders     bool   `json:"notifyReminders"`
	NotifyDaysOff       bool   `json:"notifyDaysOff"`
}

type UpdateClientProfileRequest struct {
	Name              string `json:"name,omitempty"`
	Phone             string `json:"phone,omitempty"`
	PreferredDuration *int   `json:"preferredDuration,omitempty"`
}

func HandleGetClientProfile(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	resp := ClientProfileResponse{
		ID:                  client.ID,
		Name:                client.Name,
		Phone:               client.Phone,
		PreferredDuration:   client.PreferredDuration,
		NotifyBookingStatus: client.NotifyBookingStatus,
		NotifyReminders:     client.NotifyReminders,
		NotifyDaysOff:       client.NotifyDaysOff,
	}

	writeJSON(w, resp)
}

func HandleUpdateClientProfile(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	var req UpdateClientProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if len(req.Name) > 50 || len(req.Phone) > 20 {
		http.Error(w, "Превышена максимальная длина поля", http.StatusBadRequest)
		return
	}

	name := client.Name
	if req.Name != "" {
		name = req.Name
	}

	phone := client.Phone
	if req.Phone != "" {
		phone = req.Phone
	}

	preferredDuration := client.PreferredDuration
	if req.PreferredDuration != nil {
		preferredDuration = *req.PreferredDuration
	}

	if err := db.UpdateClientProfile(client.ID, name, phone, preferredDuration); err != nil {
		log.Printf("Error updating client profile: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	updated, err := db.GetClientByID(client.ID)
	if err != nil || updated == nil {
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	resp := ClientProfileResponse{
		ID:                  updated.ID,
		Name:                updated.Name,
		Phone:               updated.Phone,
		PreferredDuration:   updated.PreferredDuration,
		NotifyBookingStatus: updated.NotifyBookingStatus,
		NotifyReminders:     updated.NotifyReminders,
		NotifyDaysOff:       updated.NotifyDaysOff,
	}

	writeJSON(w, resp)
}

// ========== Client Notification Preferences ==========

type UpdateClientNotificationPrefsRequest struct {
	NotifyBookingStatus *bool `json:"notifyBookingStatus"`
	NotifyReminders     *bool `json:"notifyReminders"`
	NotifyDaysOff       *bool `json:"notifyDaysOff"`
}

func HandleUpdateClientNotificationPrefs(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	var req UpdateClientNotificationPrefsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	notifyBookingStatus := client.NotifyBookingStatus
	if req.NotifyBookingStatus != nil {
		notifyBookingStatus = *req.NotifyBookingStatus
	}
	notifyReminders := client.NotifyReminders
	if req.NotifyReminders != nil {
		notifyReminders = *req.NotifyReminders
	}
	notifyDaysOff := client.NotifyDaysOff
	if req.NotifyDaysOff != nil {
		notifyDaysOff = *req.NotifyDaysOff
	}

	if err := db.UpdateClientNotificationPrefs(client.ID, notifyBookingStatus, notifyReminders, notifyDaysOff); err != nil {
		log.Printf("Error updating notification prefs: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	updated, _ := db.GetClientByID(client.ID)
	if updated == nil {
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	resp := ClientProfileResponse{
		ID:                  updated.ID,
		Name:                updated.Name,
		Phone:               updated.Phone,
		PreferredDuration:   updated.PreferredDuration,
		NotifyBookingStatus: updated.NotifyBookingStatus,
		NotifyReminders:     updated.NotifyReminders,
		NotifyDaysOff:       updated.NotifyDaysOff,
	}
	writeJSON(w, resp)
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
