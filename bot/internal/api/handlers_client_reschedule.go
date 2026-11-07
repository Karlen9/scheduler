package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

type RescheduleBookingRequest struct {
	Date string `json:"date"`
	Time string `json:"time"`
}

func HandleClientRescheduleBooking(w http.ResponseWriter, r *http.Request) {
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
	if booking.ClientID != client.ID || booking.SpecialistID != specialist.ID {
		httpError(w, r, "Error.Forbidden", http.StatusForbidden)
		return
	}
	if booking.Status != models.BookingStatusPending && booking.Status != models.BookingStatusConfirmed {
		httpError(w, r, "Error.BookingCannotModify", http.StatusBadRequest)
		return
	}

	var req RescheduleBookingRequest
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

	duration := booking.DurationMinutes
	if duration == 0 && booking.SessionType != nil {
		duration = booking.SessionType.DurationMinutes
	}
	if duration == 0 {
		duration = 60
	}

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

	// Confirmed booking with a real (non-ghost, non-self) client: create a shadow
	// reschedule_pending booking so the SPECIALIST can approve or decline.
	if booking.Status == models.BookingStatusConfirmed && !bookingAutoApplies(booking) {
		if err := db.DeleteReschedulePendingFor(booking.ID); err != nil {
			log.Printf("Error clearing prior reschedule proposal: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}

		newBooking, err := db.CreateRescheduleBooking(
			booking.SpecialistID, booking.ClientID, booking.SessionTypeID,
			startsAt, endsAt, booking.ClientName, "", "client",
			duration, "", booking.ID,
		)
		if err != nil {
			log.Printf("Error creating reschedule request: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}

		log.Printf("RESCHEDULE REQUEST [%s] Client: %s proposed new time for confirmed booking | New: %s %s",
			newBooking.ID[:8], booking.ClientName, req.Date, req.Time)

		changes.Publish(specialist.ID, changes.GroupBookings)
		if NotifyMoveRequestFunc != nil {
			if err := NotifyMoveRequestFunc(newBooking, booking, "client"); err != nil {
				log.Printf("Error notifying specialist about reschedule request: %v", err)
			}
		}

		writeJSON(w, newBooking)
		return
	}

	// Pending booking or auto-apply (ghost/self): update in place.
	oldBooking := *booking
	if err := db.UpdateBookingDateTime(bookingID, startsAt, endsAt, duration); err != nil {
		log.Printf("Error updating booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("RESCHEDULE [%s] Client: %s moved booking | New: %s %s",
		bookingID[:8], booking.ClientName, req.Date, req.Time)

	booking, _ = db.GetBookingByID(bookingID)
	if booking != nil {
		changes.Publish(booking.SpecialistID, changes.GroupBookings)
	}
	refreshBookingMessages(booking)
	if NotifyRescheduleRequestFunc != nil && booking != nil {
		if err := NotifyRescheduleRequestFunc(booking, &oldBooking); err != nil {
			log.Printf("Error notifying specialist about client reschedule: %v", err)
		}
	}

	writeJSON(w, booking)
}

func HandleClientApproveReschedule(w http.ResponseWriter, r *http.Request) {
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

	bookingID := chi.URLParam(r, "id")
	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil || booking.ClientID != client.ID || booking.SpecialistID != specialist.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusReschedulePending {
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

	log.Printf("RESCHEDULE APPROVED (CLIENT) booking %s", bookingID[:8])
	updated, _ := db.GetBookingByID(bookingID)
	if updated != nil {
		changes.Publish(updated.SpecialistID, changes.GroupBookings, changes.GroupRecurring)
	}
	if NotifyRescheduleResponseFunc != nil && updated != nil {
		if err := NotifyRescheduleResponseFunc(updated, oldBooking, true, "client"); err != nil {
			log.Printf("Error notifying specialist about approved reschedule: %v", err)
		}
	}
	writeJSON(w, updated)
}

func HandleClientDeclineReschedule(w http.ResponseWriter, r *http.Request) {
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

	bookingID := chi.URLParam(r, "id")
	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil || booking.ClientID != client.ID || booking.SpecialistID != specialist.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.Status != models.BookingStatusReschedulePending {
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

	log.Printf("RESCHEDULE DECLINED (CLIENT) booking %s", bookingID[:8])
	changes.Publish(booking.SpecialistID, changes.GroupBookings, changes.GroupRecurring)
	if NotifyRescheduleResponseFunc != nil {
		if err := NotifyRescheduleResponseFunc(booking, oldBooking, false, "client"); err != nil {
			log.Printf("Error notifying specialist about declined reschedule: %v", err)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}
