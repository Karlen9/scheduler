package api

import (
	"errors"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

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
	if booking.Status != models.BookingStatusPending || booking.CreatedBy != "specialist" {
		httpError(w, r, "Error.BookingCannotConfirm", http.StatusBadRequest)
		return
	}

	if err := db.UpdateBookingStatusIfCurrent(bookingID, models.BookingStatusPending, models.BookingStatusConfirmed); err != nil {
		if errors.Is(err, db.ErrBookingStatusConflict) {
			httpError(w, r, "Error.BookingCannotConfirm", http.StatusConflict)
			return
		}
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
	if UpdateClientMessageFunc != nil {
		if err := UpdateClientMessageFunc(booking); err != nil {
			log.Printf("Error updating client message: %v", err)
		}
	}
	if booking != nil {
		changes.Publish(booking.SpecialistID, changes.GroupBookings)
	}

	writeJSON(w, booking)
}

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
	if booking.Status != models.BookingStatusPending || booking.CreatedBy != "specialist" {
		httpError(w, r, "Error.BookingCannotReject", http.StatusBadRequest)
		return
	}

	if err := db.CancelBookingIfCurrent(bookingID, models.BookingStatusPending, "", models.CancelledByClient); err != nil {
		if errors.Is(err, db.ErrBookingStatusConflict) {
			httpError(w, r, "Error.BookingCannotReject", http.StatusConflict)
			return
		}
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
	if UpdateClientMessageFunc != nil {
		if err := UpdateClientMessageFunc(booking); err != nil {
			log.Printf("Error updating client message: %v", err)
		}
	}
	if booking != nil {
		changes.Publish(booking.SpecialistID, changes.GroupBookings)
	}

	writeJSON(w, booking)
}
