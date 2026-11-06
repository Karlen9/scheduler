package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

type CreateSessionTypeRequest struct {
	Type            string `json:"type"`
	Name            string `json:"name"`
	DurationMinutes int    `json:"durationMinutes"`
	Price           int    `json:"price"`
	Currency        string `json:"currency,omitempty"`
	ImageURL        string `json:"imageUrl,omitempty"`
	SessionsCount   int    `json:"sessionsCount,omitempty"`
}

type UpdateSessionTypeRequest struct {
	Type            string  `json:"type,omitempty"`
	Name            string  `json:"name,omitempty"`
	DurationMinutes *int    `json:"durationMinutes,omitempty"`
	Price           *int    `json:"price,omitempty"`
	Currency        string  `json:"currency,omitempty"`
	ImageURL        *string `json:"imageUrl,omitempty"`
	SessionsCount   *int    `json:"sessionsCount,omitempty"`
	IsActive        *bool   `json:"isActive,omitempty"`
}

func isValidServiceType(serviceType string) bool {
	return serviceType == "common" || serviceType == "batch"
}

func validateServiceTypeConfig(w http.ResponseWriter, r *http.Request, serviceType string, sessionsCount int) bool {
	if !isValidServiceType(serviceType) {
		httpError(w, r, "Error.InvalidServiceType", http.StatusBadRequest)
		return false
	}
	if serviceType == "batch" && sessionsCount <= 1 {
		httpError(w, r, "Error.InvalidSessionsCount", http.StatusBadRequest)
		return false
	}
	return true
}

func HandleAdminGetServices(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	services, err := db.GetAllSessionTypesBySpecialistID(specialist.ID)
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

func HandleCreateService(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req CreateSessionTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	if req.Type == "" || req.Name == "" || req.DurationMinutes <= 0 || req.Price < 0 {
		httpError(w, r, "Error.MissingFields", http.StatusBadRequest)
		return
	}
	if !validateServiceTypeConfig(w, r, req.Type, req.SessionsCount) {
		return
	}
	if !isAllowedServiceDuration(req.DurationMinutes) {
		httpError(w, r, "Error.InvalidDuration", http.StatusBadRequest)
		return
	}
	if len(req.Name) > 100 {
		httpError(w, r, "Error.NameTooLong", http.StatusBadRequest)
		return
	}

	currency := req.Currency
	if currency == "" {
		currency = "RUB"
	}

	service, err := db.CreateSessionTypeWithSessionsCount(specialist.ID, req.Type, req.Name, req.DurationMinutes, req.Price, currency, req.ImageURL, req.SessionsCount)
	if err != nil {
		log.Printf("Error creating service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupServices)
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, service)
}

func HandleUpdateService(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	serviceID := chi.URLParam(r, "id")
	if serviceID == "" {
		httpError(w, r, "Error.MissingServiceID", http.StatusBadRequest)
		return
	}

	existing, err := db.GetSessionTypeByID(serviceID)
	if err != nil {
		log.Printf("Error getting service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if existing == nil || existing.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ServiceNotFound", http.StatusNotFound)
		return
	}

	var req UpdateSessionTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	if len(req.Name) > 100 {
		httpError(w, r, "Error.NameTooLong", http.StatusBadRequest)
		return
	}

	sessionType := existing.Type
	if req.Type != "" {
		sessionType = req.Type
	}
	name := existing.Name
	if req.Name != "" {
		name = req.Name
	}
	duration := existing.DurationMinutes
	if req.DurationMinutes != nil {
		if !isAllowedServiceDuration(*req.DurationMinutes) {
			httpError(w, r, "Error.InvalidDuration", http.StatusBadRequest)
			return
		}
		duration = *req.DurationMinutes
	}
	price := existing.Price
	if req.Price != nil {
		price = *req.Price
	}
	currency := existing.Currency
	if req.Currency != "" {
		currency = req.Currency
	}
	imageURL := existing.ImageURL
	if req.ImageURL != nil {
		imageURL = *req.ImageURL
	}
	sessionsCount := existing.SessionsCount
	if req.SessionsCount != nil {
		sessionsCount = *req.SessionsCount
	}
	if sessionType == "common" {
		sessionsCount = 0
	}
	if !validateServiceTypeConfig(w, r, sessionType, sessionsCount) {
		return
	}
	isActive := existing.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	updated, err := db.UpdateSessionTypeWithSessionsCount(existing.ID, sessionType, name, duration, price, currency, imageURL, sessionsCount, isActive)
	if err != nil {
		log.Printf("Error updating service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupServices)
	writeJSON(w, updated)
}

func HandleDeleteService(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	serviceID := chi.URLParam(r, "id")
	if serviceID == "" {
		httpError(w, r, "Error.MissingServiceID", http.StatusBadRequest)
		return
	}

	existing, err := db.GetSessionTypeByID(serviceID)
	if err != nil {
		log.Printf("Error getting service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if existing == nil || existing.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ServiceNotFound", http.StatusNotFound)
		return
	}

	if err := db.DeactivateSessionType(existing.ID); err != nil {
		log.Printf("Error deactivating service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupServices)
	w.WriteHeader(http.StatusNoContent)
}
