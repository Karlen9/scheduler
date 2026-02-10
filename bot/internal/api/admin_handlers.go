package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"strconv"
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	durations := getDurationsFromServices(trainer.ID)
	writeJSON(w, durations)
}

// HandleAdminGetDurations returns durations derived from active session types
func HandleAdminGetDurations(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	writeJSON(w, trainer)
}

func HandleUpdateTrainerSettings(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	var req UpdateTrainerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
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
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	services, err := db.GetAllSessionTypesByTrainerID(trainer.ID)
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

func HandleCreateService(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	var req CreateSessionTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if req.Type == "" || req.Name == "" || req.DurationMinutes <= 0 || req.Price < 0 {
		http.Error(w, "Заполните все обязательные поля", http.StatusBadRequest)
		return
	}

	if len(req.Name) > 100 {
		http.Error(w, "Превышена максимальная длина названия", http.StatusBadRequest)
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
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if existing != nil {
		http.Error(w, "Услуга с таким типом уже существует", http.StatusConflict)
		return
	}

	service, err := db.CreateSessionType(trainer.ID, req.Type, req.Name, req.DurationMinutes, req.Price, currency)
	if err != nil {
		log.Printf("Error creating service: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, service)
}

func HandleUpdateService(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	sessionType := chi.URLParam(r, "type")
	if sessionType == "" {
		http.Error(w, "Укажите тип услуги", http.StatusBadRequest)
		return
	}

	existing, err := db.GetSessionTypeByType(trainer.ID, sessionType)
	if err != nil {
		log.Printf("Error getting service: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "Услуга не найдена", http.StatusNotFound)
		return
	}

	var req UpdateSessionTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if len(req.Name) > 100 {
		http.Error(w, "Превышена максимальная длина названия", http.StatusBadRequest)
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
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	writeJSON(w, updated)
}

func HandleDeleteService(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	sessionType := chi.URLParam(r, "type")
	if sessionType == "" {
		http.Error(w, "Укажите тип услуги", http.StatusBadRequest)
		return
	}

	existing, err := db.GetSessionTypeByType(trainer.ID, sessionType)
	if err != nil {
		log.Printf("Error getting service: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "Услуга не найдена", http.StatusNotFound)
		return
	}

	// Soft delete (deactivate)
	if err := db.DeactivateSessionType(existing.ID); err != nil {
		log.Printf("Error deactivating service: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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

func HandleUpdateWorkingHours(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	var req BulkWorkingHoursRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	// Clear existing and set new
	if err := db.ClearWorkingHours(trainer.ID); err != nil {
		log.Printf("Error clearing working hours: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	for _, wh := range req.Hours {
		if wh.DayOfWeek < 0 || wh.DayOfWeek > 6 {
			http.Error(w, "День недели должен быть от 0 до 6", http.StatusBadRequest)
			return
		}
		if wh.StartTime == "" || wh.EndTime == "" {
			http.Error(w, "Укажите время начала и окончания", http.StatusBadRequest)
			return
		}

		if err := db.UpsertWorkingHours(trainer.ID, wh.DayOfWeek, wh.StartTime, wh.EndTime); err != nil {
			log.Printf("Error setting working hours: %v", err)
			http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	dayStr := chi.URLParam(r, "day")
	day, err := strconv.Atoi(dayStr)
	if err != nil || day < 0 || day > 6 {
		http.Error(w, "Неверный день недели", http.StatusBadRequest)
		return
	}

	var req WorkingHoursRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if req.StartTime == "" || req.EndTime == "" {
		http.Error(w, "Укажите время начала и окончания", http.StatusBadRequest)
		return
	}

	if err := db.UpsertWorkingHours(trainer.ID, day, req.StartTime, req.EndTime); err != nil {
		log.Printf("Error setting working hours: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	hours, _ := db.GetWorkingHoursByTrainerID(trainer.ID)
	writeJSON(w, hours)
}

func HandleDeleteWorkingHoursForDay(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	dayStr := chi.URLParam(r, "day")
	day, err := strconv.Atoi(dayStr)
	if err != nil || day < 0 || day > 6 {
		http.Error(w, "Неверный день недели", http.StatusBadRequest)
		return
	}

	if err := db.DeleteWorkingHours(trainer.ID, day); err != nil {
		log.Printf("Error deleting working hours: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ========== Bookings Management ==========

func HandleAdminGetBookings(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	status := r.URL.Query().Get("status")

	bookings, err := db.GetBookingsByTrainerID(trainer.ID, status)
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

type UpdateBookingStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
}

func HandleAdminUpdateBookingStatus(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		http.Error(w, "Укажите ID записи", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if booking == nil || booking.TrainerID != trainer.ID {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}

	var req UpdateBookingStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	validStatuses := map[string]bool{
		"pending": true, "confirmed": true, "rejected": true, "cancelled": true, "completed": true,
	}
	if !validStatuses[req.Status] {
		http.Error(w, "Неверный статус", http.StatusBadRequest)
		return
	}

	oldStatus := booking.Status
	if (req.Status == "cancelled" || req.Status == "rejected") && req.Reason != "" {
		if err := db.CancelBooking(bookingID, req.Reason, models.CancelledByTrainer); err != nil {
			log.Printf("Error cancelling booking: %v", err)
			http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
			return
		}
		if req.Status == "rejected" {
			db.UpdateBookingStatus(bookingID, models.BookingStatusRejected)
		}
	} else if err := db.UpdateBookingStatus(bookingID, models.BookingStatus(req.Status)); err != nil {
		log.Printf("Error updating booking status: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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

	// Notify client about status change
	if NotifyStatusChangeFunc != nil {
		// Refresh booking to get updated status + session type
		updated, _ := db.GetBookingByID(bookingID)
		if updated != nil {
			if err := NotifyStatusChangeFunc(updated, req.Status); err != nil {
				log.Printf("Error notifying client about status change: %v", err)
			}
		}
	}

	// Trigger waitlist processing if booking was cancelled or rejected (slot freed)
	if req.Status == "cancelled" || req.Status == "rejected" {
		go ProcessWaitlistForCancelledBooking(booking.TrainerID, booking.StartsAt, booking.EndsAt)
	}

	booking, _ = db.GetBookingByID(bookingID)
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	daysOff, err := db.GetDaysOffByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting days off: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	var req CreateDayOffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if req.Date == "" {
		http.Error(w, "Укажите дату", http.StatusBadRequest)
		return
	}

	date, err := parseDate(req.Date)
	if err != nil {
		http.Error(w, "Неверный формат даты", http.StatusBadRequest)
		return
	}

	// Check if already exists
	existing, _ := db.GetDayOff(trainer.ID, date)
	if existing != nil {
		http.Error(w, "Выходной на эту дату уже добавлен", http.StatusConflict)
		return
	}

	dayOff, err := db.CreateDayOff(trainer.ID, date, req.Reason)
	if err != nil {
		log.Printf("Error creating day off: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, dayOff)
}

func HandleDeleteDayOff(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	dayOffID := chi.URLParam(r, "id")
	if dayOffID == "" {
		http.Error(w, "Укажите ID выходного", http.StatusBadRequest)
		return
	}

	if err := db.DeleteDayOff(dayOffID); err != nil {
		log.Printf("Error deleting day off: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
}

func HandleGetProfile(w http.ResponseWriter, r *http.Request) {
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

func HandleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if len(req.Name) > 50 || len(req.Specialization) > 100 || len(req.Bio) > 500 || len(req.Phone) > 20 || len(req.TelegramHandle) > 50 {
		http.Error(w, "Превышена максимальная длина поля", http.StatusBadRequest)
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
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
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
	}

	writeJSON(w, resp)
}

// ========== Admin Clients ==========

func HandleAdminGetClients(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	clients, err := db.GetClientsByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting clients: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
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
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	var req UpdateAdminNotificationPrefsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
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
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
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
