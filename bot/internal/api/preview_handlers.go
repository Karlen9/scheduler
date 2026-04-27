package api

import (
	"net/http"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* HandleGetPreviewBookings returns an empty booking list for the specialist-owned client preview.
***************************************************************************************************/
func HandleGetPreviewBookings(w http.ResponseWriter, r *http.Request) {
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

	setNoStore(w)
	writeJSON(w, models.BookingListResponse{
		Bookings:   []models.Booking{},
		Total:      0,
		Page:       page,
		Limit:      limit,
		TotalPages: 0,
	})
}

/***************************************************************************************************
* HandleGetPreviewClientBatches returns no purchased client batches for preview mode.
***************************************************************************************************/
func HandleGetPreviewClientBatches(w http.ResponseWriter, r *http.Request) {
	setNoStore(w)
	writeJSON(w, []models.ClientBatch{})
}

/***************************************************************************************************
* HandleGetPreviewClientStats returns zero-value client stats for preview mode.
***************************************************************************************************/
func HandleGetPreviewClientStats(w http.ResponseWriter, r *http.Request) {
	setPrivateCache(w, 60, 300)
	writeJSON(w, models.ClientStats{
		DurationBreakdown: []models.DurationCount{},
		MonthlyTrend:      []models.MonthlyCount{},
	})
}

/***************************************************************************************************
* HandleGetPreviewClientProfile returns a prospect-safe empty profile for preview mode.
***************************************************************************************************/
func HandleGetPreviewClientProfile(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	resp := ClientProfileResponse{
		ID:                  "preview",
		Name:                "",
		Phone:               "",
		PhotoURL:            "",
		Language:            specialist.Language,
		NotifyBookingStatus: true,
		NotifyReminders:     true,
		NotifyDaysOff:       false,
		NotifyCancellations: true,
	}

	setNoStore(w)
	writeJSON(w, resp)
}

/***************************************************************************************************
* HandleGetPreviewRecurringSchedules returns no recurring schedules for preview mode.
***************************************************************************************************/
func HandleGetPreviewRecurringSchedules(w http.ResponseWriter, r *http.Request) {
	setNoStore(w)
	writeJSON(w, []models.RecurringSchedule{})
}
