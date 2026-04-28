package api

import (
	"encoding/json"
	"log"
	"net/http"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
)

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

type UpdateClientNotificationPrefsRequest struct {
	NotifyBookingStatus *bool `json:"notifyBookingStatus"`
	NotifyReminders     *bool `json:"notifyReminders"`
	NotifyDaysOff       *bool `json:"notifyDaysOff"`
	NotifyCancellations *bool `json:"notifyCancellations"`
}

func HandleGetClientProfile(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	setNoStore(w)
	writeJSON(w, ClientProfileResponse{
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
	})
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
	if req.Language == "ru" || req.Language == "en" {
		db.UpdateClientLanguage(client.ID, req.Language)
	}

	updated, err := db.GetClientByID(client.ID)
	if err != nil || updated == nil {
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(
		updated.SpecialistID,
		changes.GroupClientProfile,
		changes.GroupClients,
		changes.GroupBookings,
		changes.GroupRecurring,
	)
	writeJSON(w, ClientProfileResponse{
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
	})
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

	changes.Publish(updated.SpecialistID, changes.GroupClientProfile)
	writeJSON(w, ClientProfileResponse{
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
	})
}
