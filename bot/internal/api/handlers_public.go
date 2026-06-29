package api

import (
	"log"
	"net/http"
	"time"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

func HandleGetSpecialist(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	client := GetClientFromContext(r)
	isOwner := client.IsSelfOf(specialist.TelegramUserID)
	if isOwner {
		ensureSpecialistTelegramProfilePhoto(r, specialist)
	}

	ent := specialist.Entitlement(time.Now())
	resp := SpecialistResponse{
		ID:                 specialist.ID,
		Name:               specialist.Name,
		Timezone:           specialist.Timezone,
		CancelCutoffHrs:     specialist.CancelCutoffHrs,
		CancelCutoffEnabled: specialist.CancelCutoffEnabled,
		BotUsername:        specialist.BotUsername,
		TelegramHandle:     specialist.TelegramHandle,
		Phone:              specialist.Phone,
		Specialization:     specialist.Specialization,
		Bio:                specialist.Bio,
		PhotoURL:           specialist.PhotoURL,
		LocationLatitude:   specialist.LocationLatitude,
		LocationLongitude:  specialist.LocationLongitude,
		IsOwner:            isOwner,
		Language:           specialist.Language,
		Wallpaper:          specialist.Wallpaper,
		IsPro:              ent.IsPro,
		SubscriptionStatus: specialist.SubscriptionStatus,
		TrialEndsAt:        specialist.TrialEndsAt,
		CurrentPeriodEndAt: specialist.CurrentPeriodEndAt,
		AutoRenew:          specialist.AutoRenew,
	}

	setPrivateCache(w, 60, 300)
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

	setPrivateCache(w, 60, 300)
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

	setPrivateCache(w, 60, 300)
	writeJSON(w, hours)
}

type PublicDayOff struct {
	Date string `json:"date"`
}

type PublicScheduleContextResponse struct {
	WorkingHours []models.WorkingHours `json:"workingHours"`
	DaysOff      []PublicDayOff        `json:"daysOff"`
}

func buildPublicDayOffs(daysOff []models.DayOff) []PublicDayOff {
	result := make([]PublicDayOff, 0, len(daysOff))
	for _, dayOff := range daysOff {
		result = append(result, PublicDayOff{
			Date: dayOff.Date.Format("2006-01-02"),
		})
	}
	return result
}

func loadPublicScheduleContext(specialistID string) (PublicScheduleContextResponse, error) {
	hours, err := db.GetWorkingHoursBySpecialistID(specialistID)
	if err != nil {
		return PublicScheduleContextResponse{}, err
	}
	if hours == nil {
		hours = []models.WorkingHours{}
	}

	daysOff, err := db.GetDaysOffBySpecialistID(specialistID)
	if err != nil {
		return PublicScheduleContextResponse{}, err
	}

	return PublicScheduleContextResponse{
		WorkingHours: hours,
		DaysOff:      buildPublicDayOffs(daysOff),
	}, nil
}

func HandleGetScheduleContext(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	resp, err := loadPublicScheduleContext(specialist.ID)
	if err != nil {
		log.Printf("Error getting public schedule context: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	setPrivateCache(w, 60, 300)
	writeJSON(w, resp)
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

	setPrivateCache(w, 300, 600)
	writeJSON(w, buildPublicDayOffs(daysOff))
}
