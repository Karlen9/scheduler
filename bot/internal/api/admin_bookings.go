package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

type UpdateBookingStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
}

type AdminRescheduleBookingRequest struct {
	Date    string `json:"date"`
	Time    string `json:"time"`
	Message string `json:"message,omitempty"`
}

type AdminCreateBookingRequest struct {
	ClientID      string `json:"clientId"`
	SessionTypeID string `json:"sessionTypeId,omitempty"`
	Duration      int    `json:"duration"`
	Date          string `json:"date"`
	Time          string `json:"time"`
	Message       string `json:"message,omitempty"`
}

var NotifySpecialistBookingFunc func(booking *models.Booking) error

func HandleAdminGetBookings(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	query := r.URL.Query()
	status := query.Get("status")

	completedCount, err := db.CompletePastConfirmedBookingsForSpecialist(specialist.ID, time.Now().UTC())
	if err != nil {
		log.Printf("Error completing past bookings: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if completedCount > 0 {
		changes.Publish(specialist.ID, changes.GroupBookings, changes.GroupClientBatches)
	}

	page, err := parseAdminBookingsPositiveInt(query.Get("page"), 1)
	if err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	limit, err := parseAdminBookingsPositiveInt(query.Get("limit"), defaultAdminBookingsLimit)
	if err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	if limit > maxAdminBookingsLimit {
		limit = maxAdminBookingsLimit
	}

	dateFrom, err := parseAdminBookingsDate(query.Get("dateFrom"), false)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}
	dateTo, err := parseAdminBookingsDate(query.Get("dateTo"), true)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}

	filters := db.BookingListFilters{
		Status:         status,
		Statuses:       adminBookingsQueryValues(query, "status"),
		ClientID:       strings.TrimSpace(query.Get("clientId")),
		ClientIDs:      adminBookingsQueryValues(query, "clientId"),
		ClientSearch:   strings.TrimSpace(query.Get("client")),
		SessionTypeID:  strings.TrimSpace(query.Get("serviceId")),
		SessionTypeIDs: adminBookingsQueryValues(query, "serviceId"),
		DateFrom:       dateFrom,
		DateTo:         dateTo,
		Sort:           query.Get("sort"),
		Limit:          limit,
		Offset:         (page - 1) * limit,
	}

	bookings, total, err := db.GetBookingsBySpecialistIDFiltered(specialist.ID, filters)
	if err != nil {
		log.Printf("Error getting paginated bookings: %v", err)
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

func HandleAdminUpdateBookingStatus(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
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
	if booking == nil || booking.SpecialistID != specialist.ID {
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
	if booking.CreatedBy == "specialist" && req.Status == "confirmed" {
		httpError(w, r, "Error.CannotConfirmOwnBooking", http.StatusForbidden)
		return
	}

	oldStatus := booking.Status
	switch {
	case req.Status == "rejected":
		if err := db.RejectBookingWithReason(bookingID, req.Reason); err != nil {
			log.Printf("Error rejecting booking: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
	case req.Status == "cancelled" && req.Reason != "":
		if err := db.CancelBooking(bookingID, req.Reason, models.CancelledBySpecialist); err != nil {
			log.Printf("Error cancelling booking: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
	default:
		if err := db.UpdateBookingStatus(bookingID, models.BookingStatus(req.Status)); err != nil {
			if errors.Is(err, db.ErrNoActiveClientBatch) {
				httpError(w, r, "Error.NoActiveBatch", http.StatusBadRequest)
				return
			}
			log.Printf("Error updating booking status: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
	}

	log.Printf("BOOKING STATUS [%s] %s -> %s | Client: %s | Specialist: %s (@%s)",
		bookingID[:8], oldStatus, req.Status, booking.ClientName, specialist.Name, specialist.BotUsername)

	booking, _ = db.GetBookingByID(bookingID)
	if NotifyStatusChangeFunc != nil && booking != nil {
		if err := NotifyStatusChangeFunc(booking, req.Status); err != nil {
			log.Printf("Error notifying client about status change: %v", err)
		}
	}
	if UpdateSpecialistMessageFunc != nil && booking != nil {
		if err := UpdateSpecialistMessageFunc(booking); err != nil {
			log.Printf("Error updating specialist message: %v", err)
		}
	}
	if booking != nil {
		changes.Publish(booking.SpecialistID, changes.GroupBookings, changes.GroupClientBatches)
	}

	writeJSON(w, booking)
}

func HandleAdminRescheduleBooking(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
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
	if booking == nil || booking.SpecialistID != specialist.ID {
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

	hour, minute, err := parseTime(req.Time)
	if err != nil {
		httpError(w, r, "Error.SelectTime", http.StatusBadRequest)
		return
	}

	duration := bookingDuration(booking)
	startsAt := time.Date(date.Year(), date.Month(), date.Day(), hour, minute, 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(duration) * time.Minute)

	if errMsg := validateRescheduleTime(date, startsAt, specialist.Timezone); errMsg != "" {
		httpError(w, r, errMsg, http.StatusBadRequest)
		return
	}

	hasConflict, err := db.HasConflictingBooking(specialist.ID, startsAt, endsAt, bookingID)
	if err != nil {
		log.Printf("Error checking conflicts: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if hasConflict {
		httpError(w, r, "Error.BookingConflict", http.StatusConflict)
		return
	}

	if booking.Status == models.BookingStatusConfirmed && !bookingAutoApplies(booking) {
		message := strings.TrimSpace(req.Message)
		if len(message) > 500 {
			message = message[:500]
		}
		if err := db.DeleteReschedulePendingFor(booking.ID); err != nil {
			log.Printf("Error clearing prior reschedule proposal: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}

		newBooking, err := db.CreateRescheduleBooking(
			booking.SpecialistID, booking.ClientID, booking.SessionTypeID,
			startsAt, endsAt, booking.ClientName, message, "specialist",
			duration, "", booking.ID,
		)
		if err != nil {
			log.Printf("Error creating reschedule request: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}

		log.Printf("RESCHEDULE REQUEST [%s] Specialist: %s proposed new time for confirmed booking of client: %s | New: %s %s",
			newBooking.ID[:8], specialist.Name, booking.ClientName, req.Date, req.Time)

		if NotifyMoveRequestFunc != nil {
			if err := NotifyMoveRequestFunc(newBooking, booking, "specialist"); err != nil {
				log.Printf("Error notifying client about reschedule request: %v", err)
			}
		}

		changes.Publish(specialist.ID, changes.GroupBookings)
		writeJSON(w, newBooking)
		return
	}

	if err := db.UpdateBookingDateTime(bookingID, startsAt, endsAt, duration); err != nil {
		log.Printf("Error updating booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("RESCHEDULE [%s] Specialist: %s moved booking for client: %s | New: %s %s",
		bookingID[:8], specialist.Name, booking.ClientName, req.Date, req.Time)

	booking, _ = db.GetBookingByID(bookingID)
	if NotifyStatusChangeFunc != nil && booking != nil {
		if err := NotifyStatusChangeFunc(booking, "rescheduled"); err != nil {
			log.Printf("Error notifying client about reschedule: %v", err)
		}
	}
	if booking != nil {
		changes.Publish(booking.SpecialistID, changes.GroupBookings)
	}

	writeJSON(w, booking)
}

// bookingAutoApplies reports whether a reschedule should be applied in-place
// without a shadow approval step. This is true when the client is a ghost (no
// Telegram account) or is the specialist themselves (self-booking).
func bookingAutoApplies(b *models.Booking) bool {
	return b != nil && (b.ClientIsGhost || b.ClientIsSelf)
}

func HandleAdminApproveReschedule(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	bookingID := chi.URLParam(r, "id")
	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil || booking.SpecialistID != specialist.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusReschedulePending || booking.CreatedBy != "client" {
		httpError(w, r, "Error.NoMoveRequest", http.StatusBadRequest)
		return
	}

	var oldBooking *models.Booking
	if booking.ReplacesBookingID != "" {
		oldBooking, _ = db.GetBookingByID(booking.ReplacesBookingID)
	}

	if err := db.ApproveRescheduleBooking(bookingID); err != nil {
		log.Printf("Error approving reschedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("RESCHEDULE APPROVED (SPECIALIST) booking %s", bookingID[:8])
	updated, _ := db.GetBookingByID(bookingID)
	if updated != nil {
		changes.Publish(updated.SpecialistID, changes.GroupBookings, changes.GroupRecurring)
	}
	if NotifyRescheduleResponseFunc != nil && updated != nil {
		if err := NotifyRescheduleResponseFunc(updated, oldBooking, true, "specialist"); err != nil {
			log.Printf("Error notifying client about approved reschedule: %v", err)
		}
	}
	writeJSON(w, updated)
}

func HandleAdminDeclineReschedule(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	bookingID := chi.URLParam(r, "id")
	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil || booking.SpecialistID != specialist.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusReschedulePending || booking.CreatedBy != "client" {
		httpError(w, r, "Error.NoMoveRequest", http.StatusBadRequest)
		return
	}

	var oldBooking *models.Booking
	if booking.ReplacesBookingID != "" {
		oldBooking, _ = db.GetBookingByID(booking.ReplacesBookingID)
	}

	if err := db.DeclineRescheduleBooking(bookingID); err != nil {
		log.Printf("Error declining reschedule: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("RESCHEDULE DECLINED (SPECIALIST) booking %s", bookingID[:8])
	changes.Publish(booking.SpecialistID, changes.GroupBookings, changes.GroupRecurring)
	if NotifyRescheduleResponseFunc != nil {
		if err := NotifyRescheduleResponseFunc(booking, oldBooking, false, "specialist"); err != nil {
			log.Printf("Error notifying client about declined reschedule: %v", err)
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func HandleAdminCreateBooking(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
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

	date, err := parseDate(req.Date)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}
	if errMsg := validateBookingDate(date); errMsg != "" {
		httpError(w, r, errMsg, http.StatusBadRequest)
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

	booking, err := db.CreateBookingBySpecialist(specialist.ID, client.ID, sessionType.ID, startsAt, endsAt, client.Name, req.Message, duration)
	if err != nil {
		if errors.Is(err, db.ErrNoActiveClientBatch) {
			httpError(w, r, "Error.NoActiveBatch", http.StatusBadRequest)
			return
		}
		log.Printf("Error creating booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("SPECIALIST BOOKING [%s] Specialist: %s booked client: %s | Duration: %dmin | Time: %s %s",
		booking.ID[:8], specialist.Name, client.Name, duration, req.Date, req.Time)

	if client.IsGhost || isSelfClient(client, specialist) {
		if err := db.UpdateBookingStatus(booking.ID, models.BookingStatusConfirmed); err != nil {
			log.Printf("Error auto-confirming ghost booking: %v", err)
		}
		booking, _ = db.GetBookingByID(booking.ID)
	} else if NotifySpecialistBookingFunc != nil {
		if err := NotifySpecialistBookingFunc(booking); err != nil {
			log.Printf("Error notifying client about specialist booking: %v", err)
		}
	}

	changes.Publish(specialist.ID, changes.GroupBookings)
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, booking)
}

func bookingDuration(booking *models.Booking) int {
	if booking == nil {
		return 60
	}
	if booking.DurationMinutes != 0 {
		return booking.DurationMinutes
	}
	if booking.SessionType != nil && booking.SessionType.DurationMinutes != 0 {
		return booking.SessionType.DurationMinutes
	}
	return 60
}
