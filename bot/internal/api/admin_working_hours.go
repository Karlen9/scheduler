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
	WorkingHours     []models.WorkingHours `json:"workingHours"`
	DaysOff          []models.DayOff       `json:"daysOff"`
	ScheduleMode     string                `json:"scheduleMode"`
	DefaultIntervals []models.WorkInterval `json:"defaultIntervals"`
	WorkDates        []AdminWorkDate       `json:"workDates"`
	BookedDates      []AdminBookedDate     `json:"bookedDates"`
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

func loadAdminScheduleContext(specialist *models.Specialist) (AdminScheduleContextResponse, error) {
	specialistID := specialist.ID
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

	workDates, bookedDates, err := loadAdminWorkDates(specialist)
	if err != nil {
		return AdminScheduleContextResponse{}, err
	}

	return AdminScheduleContextResponse{
		WorkingHours:     hours,
		DaysOff:          daysOff,
		ScheduleMode:     scheduleModeOf(specialist),
		DefaultIntervals: db.EffectiveWorkIntervals("", specialist.DefaultIntervals),
		WorkDates:        workDates,
		BookedDates:      bookedDates,
	}, nil
}

/***************************************************************************************************
* hasOverlappingIntervals reports whether any two of the given (already individually valid) time
* ranges overlap. Ranges that merely touch (one ends when the next starts) do not overlap. The
* input slice is not modified.
*
* Parameters:
* - intervals: Time ranges of a single day.
*
* Returns:
* - true when at least two ranges overlap.
***************************************************************************************************/
func hasOverlappingIntervals(intervals []models.WorkInterval) bool {
	if len(intervals) < 2 {
		return false
	}
	sorted := append([]models.WorkInterval(nil), intervals...)
	sort.Slice(sorted, func(i, j int) bool {
		startI, _ := timeToMinutes(sorted[i].StartTime)
		startJ, _ := timeToMinutes(sorted[j].StartTime)
		if startI != startJ {
			return startI < startJ
		}
		endI, _ := timeToMinutes(sorted[i].EndTime)
		endJ, _ := timeToMinutes(sorted[j].EndTime)
		return endI < endJ
	})

	previousEnd, _ := timeToMinutes(sorted[0].EndTime)
	for i := 1; i < len(sorted); i++ {
		currentStart, _ := timeToMinutes(sorted[i].StartTime)
		if currentStart < previousEnd {
			return true
		}
		previousEnd, _ = timeToMinutes(sorted[i].EndTime)
	}
	return false
}

/***************************************************************************************************
* validateWorkIntervals validates a list of same-day intervals: every range needs both times, a
* valid format and end after start, and ranges must not overlap. Shared by dates-mode defaults and
* per-date hours.
*
* Returns:
* - nil when valid, errMissingTimeRange when a time is empty, errOverlappingTimeRange on overlap,
*   or the underlying parse error for malformed ranges.
***************************************************************************************************/
func validateWorkIntervals(intervals []models.WorkInterval) error {
	for _, in := range intervals {
		if in.StartTime == "" || in.EndTime == "" {
			return errMissingTimeRange
		}
		if err := validateTimeRange(in.StartTime, in.EndTime); err != nil {
			return err
		}
	}
	if hasOverlappingIntervals(intervals) {
		return errOverlappingTimeRange
	}
	return nil
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
		intervals := make([]models.WorkInterval, 0, len(dayHours))
		for _, wh := range dayHours {
			intervals = append(intervals, models.WorkInterval{StartTime: wh.StartTime, EndTime: wh.EndTime})
		}
		if hasOverlappingIntervals(intervals) {
			return errOverlappingTimeRange
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

	resp, err := loadAdminScheduleContext(specialist)
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
