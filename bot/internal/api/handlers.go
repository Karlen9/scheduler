package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

// httpError writes a localized error message using the localizer from request context.
func httpError(w http.ResponseWriter, r *http.Request, msgID string, code int) {
	loc := myI18n.L(r.Context())
	http.Error(w, myI18n.T(loc, msgID), code)
}

// NotifyStatusChangeFunc is a callback to notify client when booking status changes via admin panel
var NotifyStatusChangeFunc func(booking *models.Booking, newStatus string) error

// NotifyBookingFunc is a callback to notify specialist about a new client-created booking
var NotifyBookingFunc func(booking *models.Booking) error

// UpdateSpecialistMessageFunc is a callback to edit the specialist's Telegram notification message
// when a booking status changes via the admin panel
var UpdateSpecialistMessageFunc func(booking *models.Booking) error

// NotifyClientBookingResponseFunc is a callback to notify the specialist when a client
// confirms or declines a specialist-created booking via the REST API
var NotifyClientBookingResponseFunc func(booking *models.Booking, accepted bool) error

// NotifyCancellationFunc is a callback to notify the other side about an immediate cancellation.
// cancelledBy is "client" or "trainer".
var NotifyCancellationFunc func(booking *models.Booking, cancelledBy string) error

// SpecialistResponse is the API response for specialist info
type SpecialistResponse struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	Timezone          string  `json:"timezone"`
	CancelCutoffHrs   int     `json:"cancelCutoffHours"`
	BotUsername       string  `json:"botUsername,omitempty"`
	TelegramHandle    string  `json:"telegramHandle,omitempty"`
	Phone             string  `json:"phone,omitempty"`
	Specialization    string  `json:"specialization,omitempty"`
	Bio               string  `json:"bio,omitempty"`
	PhotoURL          string  `json:"photoUrl,omitempty"`
	LocationLatitude  float64 `json:"locationLatitude,omitempty"`
	LocationLongitude float64 `json:"locationLongitude,omitempty"`
	IsOwner           bool    `json:"isOwner"`
	Language          string  `json:"language,omitempty"`
}

func HandleGetSpecialist(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	client := GetClientFromContext(r)
	isOwner := client != nil && client.TelegramUserID == specialist.TelegramUserID

	resp := SpecialistResponse{
		ID:                specialist.ID,
		Name:              specialist.Name,
		Timezone:          specialist.Timezone,
		CancelCutoffHrs:   specialist.CancelCutoffHrs,
		BotUsername:       specialist.BotUsername,
		TelegramHandle:    specialist.TelegramHandle,
		Phone:             specialist.Phone,
		Specialization:    specialist.Specialization,
		Bio:               specialist.Bio,
		PhotoURL:          specialist.PhotoURL,
		LocationLatitude:  specialist.LocationLatitude,
		LocationLongitude: specialist.LocationLongitude,
		IsOwner:           isOwner,
		Language:          specialist.Language,
	}

	writeJSON(w, resp)
}

func HandleGetServices(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	services, err := db.GetSessionTypesBySpecialistID(specialist.ID)
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

func HandleGetWorkingHours(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	hours, err := db.GetWorkingHoursBySpecialistID(specialist.ID)
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

func HandleGetAvailability(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	dateStr := r.URL.Query().Get("date")

	// Support both duration (new) and sessionType (legacy)
	durationParam := r.URL.Query().Get("duration")
	sessionTypeParam := r.URL.Query().Get("sessionType")

	if dateStr == "" {
		httpError(w, r, "Error.MissingDate", http.StatusBadRequest)
		return
	}

	var duration int
	if durationParam != "" {
		var err error
		duration, err = strconv.Atoi(durationParam)
		if err != nil || duration <= 0 {
			httpError(w, r, "Error.InvalidDuration", http.StatusBadRequest)
			return
		}
	} else if sessionTypeParam != "" {
		// Legacy: look up duration from session type
		sessionType, err := db.GetSessionTypeByType(specialist.ID, sessionTypeParam)
		if err != nil || sessionType == nil {
			httpError(w, r, "Error.InvalidServiceType", http.StatusBadRequest)
			return
		}
		duration = sessionType.DurationMinutes
	} else {
		httpError(w, r, "Error.MissingDuration", http.StatusBadRequest)
		return
	}

	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}

	// Check if this date is a day off
	isDayOff, err := db.IsDayOff(specialist.ID, date)
	if err != nil {
		log.Printf("Error checking day off: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if isDayOff {
		writeJSON(w, []models.TimeSlot{})
		return
	}

	// Get working hours for this day
	hours, err := db.GetWorkingHoursBySpecialistID(specialist.ID)
	if err != nil {
		log.Printf("Error getting working hours: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
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
	bookings, err := db.GetBookingsBySpecialistIDAndDateRange(specialist.ID, startOfDay, endOfDay)
	if err != nil {
		log.Printf("Error getting bookings: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	// Generate time slots
	slots := generateTimeSlots(date, workingHour, duration, bookings)

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

// ParseTime is the exported version of parseTime for use by other packages (e.g. recurring worker)
func ParseTime(t string) []int {
	return parseTime(t)
}

func formatTime(hour, min int) string {
	return strconv.Itoa(hour/10) + strconv.Itoa(hour%10) + ":" + strconv.Itoa(min/10) + strconv.Itoa(min%10)
}

func HandleGetBookings(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	bookings, err := db.GetBookingsByClientID(client.ID)
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

// CancelBookingRequest is the request body for cancelling a booking
type CancelBookingRequest struct {
	Reason string `json:"reason,omitempty"`
}

func HandleCancelBooking(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		httpError(w, r, "Error.InvalidBookingID", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}

	// Verify booking belongs to client
	if booking.ClientID != client.ID {
		httpError(w, r, "Error.Forbidden", http.StatusForbidden)
		return
	}

	// Check if booking can be cancelled
	if booking.Status != models.BookingStatusPending && booking.Status != models.BookingStatusConfirmed {
		httpError(w, r, "Error.BookingCannotCancel", http.StatusBadRequest)
		return
	}

	var req CancelBookingRequest
	json.NewDecoder(r.Body).Decode(&req) // Ignore errors, reason is optional

	if err := db.CancelBooking(bookingID, req.Reason, models.CancelledByClient); err != nil {
		log.Printf("Error cancelling booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("BOOKING CANCELLED [%s] Client: %s cancelled their booking (reason: %s)",
		bookingID[:8],
		booking.ClientName,
		req.Reason,
	)

	booking, _ = db.GetBookingByID(bookingID)

	if NotifyCancellationFunc != nil {
		if err := NotifyCancellationFunc(booking, "client"); err != nil {
			log.Printf("Error notifying cancellation: %v", err)
		}
	}

	writeJSON(w, booking)
}

// ========== Client Create Booking ==========

type CreateBookingRequest struct {
	Duration int    `json:"duration"`
	Date     string `json:"date"`
	Time     string `json:"time"`
	Name     string `json:"name,omitempty"`
	Message  string `json:"message,omitempty"`
}

func HandleCreateBooking(w http.ResponseWriter, r *http.Request) {
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

	var req CreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if req.Duration <= 0 || req.Date == "" || req.Time == "" {
		httpError(w, r, "Error.MissingFields", http.StatusBadRequest)
		return
	}

	// Parse date and time
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}

	// Check one booking per client per day
	hasBooking, err := db.ClientHasBookingOnDate(client.ID, date)
	if err != nil {
		log.Printf("Error checking existing bookings: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if hasBooking {
		httpError(w, r, "Error.BookingDuplicate", http.StatusConflict)
		return
	}

	timeParts := parseTime(req.Time)
	startsAt := time.Date(date.Year(), date.Month(), date.Day(), timeParts[0], timeParts[1], 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(req.Duration) * time.Minute)

	// Check for conflicts
	hasConflict, err := db.HasConflictingBooking(specialist.ID, startsAt, endsAt, "")
	if err != nil {
		log.Printf("Error checking conflicts: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if hasConflict {
		httpError(w, r, "Error.BookingConflict", http.StatusConflict)
		return
	}

	// Find session type by duration
	services, err := db.GetSessionTypesBySpecialistID(specialist.ID)
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

	// Use client name from request or from DB
	clientName := req.Name
	if clientName == "" {
		clientName = client.Name
	}

	booking, err := db.CreateBooking(specialist.ID, client.ID, sessionTypeID, startsAt, endsAt, clientName, req.Message, req.Duration)
	if err != nil {
		log.Printf("Error creating booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("BOOKING CREATED [%s] Client: %s | Duration: %dmin | Time: %s %s",
		booking.ID[:8], clientName, req.Duration, req.Date, req.Time)

	// Notify specialist
	if NotifyBookingFunc != nil {
		if err := NotifyBookingFunc(booking); err != nil {
			log.Printf("Error notifying specialist about booking: %v", err)
		}
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, booking)
}

// PublicDayOff is the public response for days off (no reason exposed)
type PublicDayOff struct {
	Date string `json:"date"`
}

func HandleGetPublicDaysOff(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	daysOff, err := db.GetDaysOffBySpecialistID(specialist.ID)
	if err != nil {
		log.Printf("Error getting days off: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
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
	PhotoURL            string `json:"photoUrl,omitempty"`
	PreferredDuration   int    `json:"preferredDuration,omitempty"`
	Language            string `json:"language"`
	NotifyBookingStatus bool   `json:"notifyBookingStatus"`
	NotifyReminders     bool   `json:"notifyReminders"`
	NotifyDaysOff       bool   `json:"notifyDaysOff"`
	NotifyCancellations bool   `json:"notifyCancellations"`
}

type UpdateClientProfileRequest struct {
	Name              string `json:"name,omitempty"`
	Phone             string `json:"phone,omitempty"`
	PreferredDuration *int   `json:"preferredDuration,omitempty"`
	Language          string `json:"language,omitempty"`
}

func HandleGetClientProfile(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	resp := ClientProfileResponse{
		ID:                  client.ID,
		Name:                client.Name,
		Phone:               client.Phone,
		PhotoURL:            client.PhotoURL,
		PreferredDuration:   client.PreferredDuration,
		Language:            client.Language,
		NotifyBookingStatus: client.NotifyBookingStatus,
		NotifyReminders:     client.NotifyReminders,
		NotifyDaysOff:       client.NotifyDaysOff,
		NotifyCancellations: client.NotifyCancellations,
	}

	writeJSON(w, resp)
}

func HandleUpdateClientProfile(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	var req UpdateClientProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if len(req.Name) > 50 || len(req.Phone) > 20 {
		httpError(w, r, "Error.FieldTooLong", http.StatusBadRequest)
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
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	// Update language if valid
	if req.Language == "ru" || req.Language == "en" {
		db.UpdateClientLanguage(client.ID, req.Language)
	}

	updated, err := db.GetClientByID(client.ID)
	if err != nil || updated == nil {
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	resp := ClientProfileResponse{
		ID:                  updated.ID,
		Name:                updated.Name,
		Phone:               updated.Phone,
		PhotoURL:            updated.PhotoURL,
		PreferredDuration:   updated.PreferredDuration,
		Language:            updated.Language,
		NotifyBookingStatus: updated.NotifyBookingStatus,
		NotifyReminders:     updated.NotifyReminders,
		NotifyDaysOff:       updated.NotifyDaysOff,
		NotifyCancellations: updated.NotifyCancellations,
	}

	writeJSON(w, resp)
}

// ========== Client Notification Preferences ==========

type UpdateClientNotificationPrefsRequest struct {
	NotifyBookingStatus *bool `json:"notifyBookingStatus"`
	NotifyReminders     *bool `json:"notifyReminders"`
	NotifyDaysOff       *bool `json:"notifyDaysOff"`
	NotifyCancellations *bool `json:"notifyCancellations"`
}

func HandleUpdateClientNotificationPrefs(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	var req UpdateClientNotificationPrefsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
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
	notifyCancellations := client.NotifyCancellations
	if req.NotifyCancellations != nil {
		notifyCancellations = *req.NotifyCancellations
	}

	if err := db.UpdateClientNotificationPrefs(client.ID, notifyBookingStatus, notifyReminders, notifyDaysOff, notifyCancellations); err != nil {
		log.Printf("Error updating notification prefs: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	updated, _ := db.GetClientByID(client.ID)
	if updated == nil {
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	resp := ClientProfileResponse{
		ID:                  updated.ID,
		Name:                updated.Name,
		Phone:               updated.Phone,
		PhotoURL:            updated.PhotoURL,
		PreferredDuration:   updated.PreferredDuration,
		Language:            updated.Language,
		NotifyBookingStatus: updated.NotifyBookingStatus,
		NotifyReminders:     updated.NotifyReminders,
		NotifyDaysOff:       updated.NotifyDaysOff,
		NotifyCancellations: updated.NotifyCancellations,
	}
	writeJSON(w, resp)
}

// HandleClientConfirmBooking lets a client confirm a specialist-created booking
func HandleClientConfirmBooking(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		httpError(w, r, "Error.InvalidBookingID", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.ClientID != client.ID {
		httpError(w, r, "Error.Forbidden", http.StatusForbidden)
		return
	}
	if booking.Status != models.BookingStatusPending || booking.CreatedBy != "trainer" {
		httpError(w, r, "Error.BookingCannotConfirm", http.StatusBadRequest)
		return
	}

	if err := db.UpdateBookingStatus(bookingID, models.BookingStatusConfirmed); err != nil {
		log.Printf("Error confirming booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	booking, _ = db.GetBookingByID(bookingID)

	if NotifyClientBookingResponseFunc != nil {
		if err := NotifyClientBookingResponseFunc(booking, true); err != nil {
			log.Printf("Error notifying specialist about client confirm: %v", err)
		}
	}

	writeJSON(w, booking)
}

// HandleClientDeclineBooking lets a client decline a specialist-created booking
func HandleClientDeclineBooking(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		httpError(w, r, "Error.InvalidBookingID", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.ClientID != client.ID {
		httpError(w, r, "Error.Forbidden", http.StatusForbidden)
		return
	}
	if booking.Status != models.BookingStatusPending || booking.CreatedBy != "trainer" {
		httpError(w, r, "Error.BookingCannotReject", http.StatusBadRequest)
		return
	}

	if err := db.CancelBooking(bookingID, "", models.CancelledByClient); err != nil {
		log.Printf("Error declining booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	booking, _ = db.GetBookingByID(bookingID)

	if NotifyClientBookingResponseFunc != nil {
		if err := NotifyClientBookingResponseFunc(booking, false); err != nil {
			log.Printf("Error notifying specialist about client decline: %v", err)
		}
	}

	writeJSON(w, booking)
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
