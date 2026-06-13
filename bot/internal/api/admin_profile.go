package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
	"unicode/utf8"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
)

type UpdateProfileRequest struct {
	Name              *string  `json:"name,omitempty"`
	TelegramHandle    *string  `json:"telegramHandle,omitempty"`
	Phone             *string  `json:"phone,omitempty"`
	Specialization    *string  `json:"specialization,omitempty"`
	Bio               *string  `json:"bio,omitempty"`
	PhotoURL          *string  `json:"photoUrl,omitempty"`
	LocationLatitude  *float64 `json:"locationLatitude,omitempty"`
	LocationLongitude *float64 `json:"locationLongitude,omitempty"`
	Language          string   `json:"language,omitempty"`
	Wallpaper         *string  `json:"wallpaper,omitempty"`
}

func HandleGetProfile(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	ensureSpecialistTelegramProfilePhoto(r, specialist)

	ent := specialist.Entitlement(time.Now())
	writeJSON(w, SpecialistResponse{
		ID:                 specialist.ID,
		Name:               specialist.Name,
		Timezone:           specialist.Timezone,
		CancelCutoffHrs:    specialist.CancelCutoffHrs,
		TelegramHandle:     specialist.TelegramHandle,
		Phone:              specialist.Phone,
		Specialization:     specialist.Specialization,
		Bio:                specialist.Bio,
		PhotoURL:           specialist.PhotoURL,
		LocationLatitude:   specialist.LocationLatitude,
		LocationLongitude:  specialist.LocationLongitude,
		Language:           specialist.Language,
		Wallpaper:          specialist.Wallpaper,
		IsPro:              ent.IsPro,
		SubscriptionStatus: specialist.SubscriptionStatus,
		TrialEndsAt:        specialist.TrialEndsAt,
		CurrentPeriodEndAt: specialist.CurrentPeriodEndAt,
		AutoRenew:          specialist.AutoRenew,
	})
}

func HandleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	if (req.Name != nil && utf8.RuneCountInString(*req.Name) > 50) ||
		(req.Specialization != nil && utf8.RuneCountInString(*req.Specialization) > 100) ||
		(req.Bio != nil && utf8.RuneCountInString(*req.Bio) > 1000) ||
		(req.Phone != nil && utf8.RuneCountInString(*req.Phone) > 20) ||
		(req.TelegramHandle != nil && utf8.RuneCountInString(*req.TelegramHandle) > 50) {
		httpError(w, r, "Error.FieldTooLong", http.StatusBadRequest)
		return
	}

	if req.Name != nil {
		specialist.Name = *req.Name
		if _, err := db.UpdateSpecialist(specialist.ID, specialist.Name, specialist.Timezone, specialist.CancelCutoffHrs); err != nil {
			log.Printf("Error updating specialist name: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
	}

	telegramHandle := specialist.TelegramHandle
	if req.TelegramHandle != nil {
		telegramHandle = *req.TelegramHandle
	}
	phone := specialist.Phone
	if req.Phone != nil {
		phone = *req.Phone
	}
	specialization := specialist.Specialization
	if req.Specialization != nil {
		specialization = *req.Specialization
	}
	bio := specialist.Bio
	if req.Bio != nil {
		bio = *req.Bio
	}
	locationLatitude := specialist.LocationLatitude
	if req.LocationLatitude != nil {
		locationLatitude = *req.LocationLatitude
	}
	locationLongitude := specialist.LocationLongitude
	if req.LocationLongitude != nil {
		locationLongitude = *req.LocationLongitude
	}
	wallpaper := specialist.Wallpaper
	if req.Wallpaper != nil {
		wallpaper = *req.Wallpaper
	}

	/***************************************************************************************************
	* Photo updates are managed via dedicated helpers so the photo_removed flag stays in sync.
	* Empty string means "user explicitly removed their photo" — we record the removal instead of
	* silently restoring the Telegram avatar (the dedicated restore endpoint handles that case).
	***************************************************************************************************/
	if req.PhotoURL != nil {
		if *req.PhotoURL == "" {
			if err := db.MarkSpecialistPhotoRemoved(specialist.ID); err != nil {
				log.Printf("Error marking specialist photo removed: %v", err)
				httpError(w, r, "Error.Internal", http.StatusInternalServerError)
				return
			}
		} else {
			if err := db.UpdateSpecialistPhoto(specialist.ID, *req.PhotoURL); err != nil {
				log.Printf("Error updating specialist photo: %v", err)
				httpError(w, r, "Error.Internal", http.StatusInternalServerError)
				return
			}
		}
	}

	updated, err := db.UpdateSpecialistProfile(specialist.ID, telegramHandle, phone, specialization, bio, locationLatitude, locationLongitude, wallpaper)
	if err != nil {
		log.Printf("Error updating profile: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if req.Language == "ru" || req.Language == "en" {
		db.UpdateSpecialistLanguage(specialist.ID, req.Language)
		updated.Language = req.Language
	}

	changes.Publish(specialist.ID, changes.GroupSpecialist)
	updEnt := updated.Entitlement(time.Now())
	writeJSON(w, SpecialistResponse{
		ID:                 updated.ID,
		Name:               updated.Name,
		Timezone:           updated.Timezone,
		CancelCutoffHrs:    updated.CancelCutoffHrs,
		TelegramHandle:     updated.TelegramHandle,
		Phone:              updated.Phone,
		Specialization:     updated.Specialization,
		Bio:                updated.Bio,
		PhotoURL:           updated.PhotoURL,
		LocationLatitude:   updated.LocationLatitude,
		LocationLongitude:  updated.LocationLongitude,
		Language:           updated.Language,
		Wallpaper:          updated.Wallpaper,
		IsPro:              updEnt.IsPro,
		SubscriptionStatus: updated.SubscriptionStatus,
		TrialEndsAt:        updated.TrialEndsAt,
		CurrentPeriodEndAt: updated.CurrentPeriodEndAt,
		AutoRenew:          updated.AutoRenew,
	})
}

/***************************************************************************************************
* HandleRestoreSpecialistTelegramPhoto resolves the specialist's current Telegram profile photo
* and writes it back to the specialists row, clearing any previous explicit-removal flag. This
* powers the "Use Telegram photo" control on the admin profile page; it complements the regular
* PUT /api/admin/profile flow which treats an empty photoUrl as deliberate removal.
***************************************************************************************************/
func HandleRestoreSpecialistTelegramPhoto(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	photoURL := resolveTelegramProfilePhoto(r, specialist.BotToken, specialist.TelegramUserID)
	if photoURL == "" {
		httpError(w, r, "Error.TelegramPhotoUnavailable", http.StatusUnprocessableEntity)
		return
	}

	if err := db.UpdateSpecialistPhoto(specialist.ID, photoURL); err != nil {
		log.Printf("Error restoring specialist Telegram photo: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	updated, err := db.GetSpecialistByID(specialist.ID)
	if err != nil || updated == nil {
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupSpecialist)
	restEnt := updated.Entitlement(time.Now())
	writeJSON(w, SpecialistResponse{
		ID:                 updated.ID,
		Name:               updated.Name,
		Timezone:           updated.Timezone,
		CancelCutoffHrs:    updated.CancelCutoffHrs,
		TelegramHandle:     updated.TelegramHandle,
		Phone:              updated.Phone,
		Specialization:     updated.Specialization,
		Bio:                updated.Bio,
		PhotoURL:           updated.PhotoURL,
		LocationLatitude:   updated.LocationLatitude,
		LocationLongitude:  updated.LocationLongitude,
		Language:           updated.Language,
		Wallpaper:          updated.Wallpaper,
		IsPro:              restEnt.IsPro,
		SubscriptionStatus: updated.SubscriptionStatus,
		TrialEndsAt:        updated.TrialEndsAt,
		CurrentPeriodEndAt: updated.CurrentPeriodEndAt,
		AutoRenew:          updated.AutoRenew,
	})
}
