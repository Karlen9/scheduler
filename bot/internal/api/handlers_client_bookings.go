package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

const defaultClientBookingsLimit = 20
const maxClientBookingsLimit = 100

type CancelBookingRequest struct {
	Reason string `json:"reason,omitempty"`
}

type CreateBookingRequest struct {
	SessionTypeID string `json:"sessionTypeId,omitempty"`
	Duration      int    `json:"duration"`
	Date          string `json:"date"`
	Time          string `json:"time"`
	Name          string `json:"name,omitempty"`
	Message       string `json:"message,omitempty"`
}

func HandleGetBookings(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	completedCount, err := db.CompletePastConfirmedBookingsForSpecialist(client.SpecialistID, time.Now().UTC())
	if err != nil {
		log.Printf("Error completing past bookings: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if completedCount > 0 {
		changes.Publish(client.SpecialistID, changes.GroupBookings, changes.GroupClientBatches)
	}

	query := r.URL.Query()
	page, err := parseAdminBookingsPositiveInt(query.Get("page"), 1)
	if err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	limit, err := parseAdminBookingsPositiveInt(query.Get("limit"), defaultClientBookingsLimit)
	if err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	if limit > maxClientBookingsLimit {
		limit = maxClientBookingsLimit
	}

	bookings, total, err := db.GetBookingsByClientIDPaged(client.ID, limit, (page-1)*limit)
	if err != nil {
		log.Printf("Error getting bookings: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if bookings == nil {
		bookings = []models.Booking{}
	}

	totalPages := 0
	if total > 0 {
		totalPages = (total + limit - 1) / limit
	}

	setNoStore(w)
	writeJSON(w, models.BookingListResponse{
		Bookings:   bookings,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	})
}

func HandleGetClientBatches(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	batches, err := db.GetClientBatchesByClientID(client.ID, client.SpecialistID)
	if err != nil {
		log.Printf("Error getting client batches: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if batches == nil {
		batches = []models.ClientBatch{}
	}

	setNoStore(w)
	writeJSON(w, batches)
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
	if booking.ClientID != client.ID {
		httpError(w, r, "Error.Forbidden", http.StatusForbidden)
		return
	}
	if booking.Status != models.BookingStatusPending && booking.Status != models.BookingStatusConfirmed {
		httpError(w, r, "Error.BookingCannotCancel", http.StatusBadRequest)
		return
	}

	// Check if cancellation falls within the specialist's late-cancel window.
	lateCancel := false
	specialist := GetSpecialistFromContext(r)
	if specialist != nil && specialist.CancelCutoffEnabled && specialist.CancelCutoffHrs > 0 {
		timeUntil := time.Until(booking.StartsAt)
		if timeUntil < time.Duration(specialist.CancelCutoffHrs)*time.Hour {
			lateCancel = true
		}
	}

	var req CancelBookingRequest
	json.NewDecoder(r.Body).Decode(&req)

	var cancelErr error
	if lateCancel {
		cancelErr = db.CompleteBooking(bookingID)
	} else {
		cancelErr = db.CancelBooking(bookingID, req.Reason, models.CancelledByClient)
	}
	if cancelErr != nil {
		log.Printf("Error cancelling booking: %v", cancelErr)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if lateCancel {
		log.Printf("BOOKING COMPLETED [%s] Client: %s cancelled within cutoff window — counted as completed",
			bookingID[:8], booking.ClientName)
	} else {
		log.Printf("BOOKING CANCELLED [%s] Client: %s cancelled their booking (reason: %s)",
			bookingID[:8], booking.ClientName, req.Reason)
	}

	booking, _ = db.GetBookingByID(bookingID)
	if NotifyCancellationFunc != nil {
		if err := NotifyCancellationFunc(booking, "client"); err != nil {
			log.Printf("Error notifying cancellation: %v", err)
		}
	}
	if booking != nil {
		changes.Publish(booking.SpecialistID, changes.GroupBookings)
	}

	writeJSON(w, booking)
}

func HandleCreateBooking(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}
	if client.IsBlocked {
		httpError(w, r, "Error.ClientBlocked", http.StatusForbidden)
		return
	}

	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	if !requirePro(w, r, specialist) {
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

	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}
	if errMsg := validateBookingDateForTimezone(date, specialist.Timezone); errMsg != "" {
		httpError(w, r, errMsg, http.StatusBadRequest)
		return
	}

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

	hour, minute, err := parseTime(req.Time)
	if err != nil {
		httpError(w, r, "Error.SelectTime", http.StatusBadRequest)
		return
	}

	sessionType, errMsg, err := resolveSessionTypeForBooking(specialist.ID, req.SessionTypeID, req.Duration)
	if err != nil {
		log.Printf("Error resolving session type: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if errMsg != "" {
		httpError(w, r, errMsg, http.StatusBadRequest)
		return
	}

	duration := sessionType.DurationMinutes
	startsAt := time.Date(date.Year(), date.Month(), date.Day(), hour, minute, 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(duration) * time.Minute)
	if isPastBookingStart(startsAt, specialist.Timezone) {
		httpError(w, r, "Error.TimeInPast", http.StatusBadRequest)
		return
	}

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

	clientName := req.Name
	if clientName == "" {
		clientName = client.Name
	}

	booking, err := db.CreateBooking(specialist.ID, client.ID, sessionType.ID, startsAt, endsAt, clientName, req.Message, duration)
	if err != nil {
		if errors.Is(err, db.ErrNoActiveClientBatch) {
			httpError(w, r, "Error.NoActiveBatch", http.StatusBadRequest)
			return
		}
		log.Printf("Error creating booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("BOOKING CREATED [%s] Client: %s | Duration: %dmin | Time: %s %s",
		booking.ID[:8], clientName, duration, req.Date, req.Time)

	changes.Publish(specialist.ID, changes.GroupBookings, changes.GroupClients)
	if NotifyBookingFunc != nil {
		if err := NotifyBookingFunc(booking); err != nil {
			log.Printf("Error notifying specialist about booking: %v", err)
		}
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, booking)
}
