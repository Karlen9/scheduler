package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sort"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

type WorkingHoursRequest struct {
	DayOfWeek int    `json:"dayOfWeek"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
}

type BulkWorkingHoursRequest struct {
	Hours []WorkingHoursRequest `json:"hours"`
}

type AdminScheduleContextResponse struct {
	WorkingHours []models.WorkingHours `json:"workingHours"`
	DaysOff      []models.DayOff       `json:"daysOff"`
}

func HandleAdminGetWorkingHours(w http.ResponseWriter, r *http.Request) {
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

	setNoStore(w)
	writeJSON(w, hours)
}

func loadAdminScheduleContext(specialistID string) (AdminScheduleContextResponse, error) {
	hours, err := db.GetWorkingHoursBySpecialistID(specialistID)
	if err != nil {
		return AdminScheduleContextResponse{}, err
	}
	if hours == nil {
		hours = []models.WorkingHours{}
	}

	daysOff, err := db.GetDaysOffBySpecialistID(specialistID)
	if err != nil {
		return AdminScheduleContextResponse{}, err
	}
	if daysOff == nil {
		daysOff = []models.DayOff{}
	}

	return AdminScheduleContextResponse{
		WorkingHours: hours,
		DaysOff:      daysOff,
	}, nil
}

func validateWorkingHoursRequests(hours []WorkingHoursRequest) error {
	hoursByDay := make(map[int][]WorkingHoursRequest)
	for _, wh := range hours {
		if wh.DayOfWeek < 0 || wh.DayOfWeek > 6 {
			return errInvalidDayOfWeek
		}
		if wh.StartTime == "" || wh.EndTime == "" {
			return errMissingTimeRange
		}
		if err := validateTimeRange(wh.StartTime, wh.EndTime); err != nil {
			return err
		}
		hoursByDay[wh.DayOfWeek] = append(hoursByDay[wh.DayOfWeek], wh)
	}

	for _, dayHours := range hoursByDay {
		sort.Slice(dayHours, func(i, j int) bool {
			startI, _ := timeToMinutes(dayHours[i].StartTime)
			startJ, _ := timeToMinutes(dayHours[j].StartTime)
			if startI != startJ {
				return startI < startJ
			}
			endI, _ := timeToMinutes(dayHours[i].EndTime)
			endJ, _ := timeToMinutes(dayHours[j].EndTime)
			return endI < endJ
		})

		previousEnd, _ := timeToMinutes(dayHours[0].EndTime)
		for i := 1; i < len(dayHours); i++ {
			currentStart, _ := timeToMinutes(dayHours[i].StartTime)
			if currentStart < previousEnd {
				return errOverlappingTimeRange
			}
			previousEnd, _ = timeToMinutes(dayHours[i].EndTime)
		}
	}

	return nil
}

func HandleAdminGetScheduleContext(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	resp, err := loadAdminScheduleContext(specialist.ID)
	if err != nil {
		log.Printf("Error getting admin schedule context: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	setNoStore(w)
	writeJSON(w, resp)
}

func HandleUpdateWorkingHours(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req BulkWorkingHoursRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if err := validateWorkingHoursRequests(req.Hours); err != nil {
		switch err {
		case errInvalidDayOfWeek:
			httpError(w, r, "Error.DayOfWeekRange", http.StatusBadRequest)
		case errMissingTimeRange:
			httpError(w, r, "Error.MissingTimeRange", http.StatusBadRequest)
		default:
			httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		}
		return
	}

	if err := db.ClearWorkingHours(specialist.ID); err != nil {
		log.Printf("Error clearing working hours: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	for _, wh := range req.Hours {
		if err := db.UpsertWorkingHours(specialist.ID, wh.DayOfWeek, wh.StartTime, wh.EndTime); err != nil {
			log.Printf("Error setting working hours: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
	}

	hours, _ := db.GetWorkingHoursBySpecialistID(specialist.ID)
	changes.Publish(specialist.ID, changes.GroupWorkingHours)
	writeJSON(w, hours)
}
