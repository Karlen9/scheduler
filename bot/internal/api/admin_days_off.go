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

type BatchCreateDayOffRequest struct {
	Dates  []string `json:"dates"`
	Reason string   `json:"reason,omitempty"`
}

const maxBatchDayOffDates = 366

func HandleGetDaysOff(w http.ResponseWriter, r *http.Request) {
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
	if daysOff == nil {
		daysOff = []models.DayOff{}
	}

	setNoStore(w)
	writeJSON(w, daysOff)
}

func HandleBatchCreateDayOff(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req BatchCreateDayOffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	if len(req.Dates) == 0 {
		httpError(w, r, "Error.MissingDate", http.StatusBadRequest)
		return
	}
	if len(req.Dates) > maxBatchDayOffDates {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	seen := make(map[string]struct{}, len(req.Dates))
	dates := make([]time.Time, 0, len(req.Dates))
	for _, value := range req.Dates {
		if _, dup := seen[value]; dup {
			continue
		}
		seen[value] = struct{}{}
		date, err := parseDate(value)
		if err != nil {
			httpError(w, r, "Error.BadDate", http.StatusBadRequest)
			return
		}
		dates = append(dates, date)
	}

	created, err := db.CreateDayOffsBatch(specialist.ID, dates, req.Reason)
	if err != nil {
		log.Printf("Error batch-creating days off: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if len(created) > 0 {
		changes.Publish(specialist.ID, changes.GroupDaysOff)
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, created)
}

func HandleDeleteDayOff(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	dayOffID := chi.URLParam(r, "id")
	if dayOffID == "" {
		httpError(w, r, "Error.MissingDayOffID", http.StatusBadRequest)
		return
	}

	deleted, err := db.DeleteDayOffForSpecialist(dayOffID, specialist.ID)
	if err != nil {
		log.Printf("Error deleting day off: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if !deleted {
		httpError(w, r, "Error.DayOffNotFound", http.StatusNotFound)
		return
	}

	changes.Publish(specialist.ID, changes.GroupDaysOff)
	w.WriteHeader(http.StatusNoContent)
}
