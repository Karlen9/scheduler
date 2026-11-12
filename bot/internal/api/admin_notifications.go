package api

import (
	"encoding/json"
	"log"
	"net/http"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
)

type AdminNotificationPrefsResponse struct {
	NotifyNewBookings      bool `json:"notifyNewBookings"`
	NotifyCancellations    bool `json:"notifyCancellations"`
	NotifyWorkDaysReminder bool `json:"notifyWorkDaysReminder"`
}

type UpdateAdminNotificationPrefsRequest struct {
	NotifyNewBookings      *bool `json:"notifyNewBookings"`
	NotifyCancellations    *bool `json:"notifyCancellations"`
	NotifyWorkDaysReminder *bool `json:"notifyWorkDaysReminder"`
}

func HandleAdminGetNotificationPrefs(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	writeJSON(w, AdminNotificationPrefsResponse{
		NotifyNewBookings:      specialist.NotifyNewBookings,
		NotifyCancellations:    specialist.NotifyCancellations,
		NotifyWorkDaysReminder: specialist.NotifyWorkDaysReminder,
	})
}

func HandleAdminUpdateNotificationPrefs(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req UpdateAdminNotificationPrefsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	notifyNewBookings := specialist.NotifyNewBookings
	if req.NotifyNewBookings != nil {
		notifyNewBookings = *req.NotifyNewBookings
	}
	notifyCancellations := specialist.NotifyCancellations
	if req.NotifyCancellations != nil {
		notifyCancellations = *req.NotifyCancellations
	}

	notifyWorkDaysReminder := specialist.NotifyWorkDaysReminder
	if req.NotifyWorkDaysReminder != nil {
		notifyWorkDaysReminder = *req.NotifyWorkDaysReminder
	}

	if err := db.UpdateSpecialistNotificationPrefs(specialist.ID, notifyNewBookings, notifyCancellations); err != nil {
		log.Printf("Error updating notification prefs: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if err := db.UpdateSpecialistWorkDaysReminderPref(specialist.ID, notifyWorkDaysReminder); err != nil {
		log.Printf("Error updating work days reminder pref: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupAdminNotifications)
	writeJSON(w, AdminNotificationPrefsResponse{
		NotifyNewBookings:      notifyNewBookings,
		NotifyCancellations:    notifyCancellations,
		NotifyWorkDaysReminder: notifyWorkDaysReminder,
	})
}
