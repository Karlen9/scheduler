package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Groups related working-hours validation errors declared together for this module.
***************************************************************************************************/
var (
	errInvalidDayOfWeek     = errors.New("invalid day of week")
	errMissingTimeRange     = errors.New("missing time range")
	errOverlappingTimeRange = errors.New("overlapping time range")
)

/***************************************************************************************************
* parseDate parses a date string in YYYY-MM-DD format.
*
* Parameters:
* - dateStr: Date value used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func parseDate(dateStr string) (time.Time, error) {
	return time.Parse("2006-01-02", dateStr)
}

/***************************************************************************************************
* getDurationsFromServices derives unique durations from active session types.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
*
* Returns:
* - The computed value for the current operation as []int.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func getDurationsFromServices(specialistID string) []int {
	services, err := db.GetSessionTypesBySpecialistID(specialistID)
	if err != nil || len(services) == 0 {
		return []int{}
	}
	seen := map[int]bool{}
	var durations []int
	for _, s := range services {
		if !seen[s.DurationMinutes] {
			seen[s.DurationMinutes] = true
			durations = append(durations, s.DurationMinutes)
		}
	}
	sort.Ints(durations)
	if durations == nil {
		durations = []int{}
	}
	return durations
}

/***************************************************************************************************
* HandleGetDurations returns available durations derived from active session types (public
* endpoint).
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleGetDurations(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	durations := getDurationsFromServices(specialist.ID)
	writeJSON(w, durations)
}

/***************************************************************************************************
* HandleAdminGetDurations returns durations derived from active session types. notification
* helpers.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminGetDurations(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	durations := getDurationsFromServices(specialist.ID)
	writeJSON(w, durations)
}

/***************************************************************************************************
* Specialist Settings.
***************************************************************************************************/
type UpdateSpecialistRequest struct {
	Name            string `json:"name,omitempty"`
	Timezone        string `json:"timezone,omitempty"`
	CancelCutoffHrs *int   `json:"cancelCutoffHours,omitempty"`
}

/***************************************************************************************************
* Handles get specialist settings.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleGetSpecialistSettings(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	writeJSON(w, specialist)
}

/***************************************************************************************************
* Handles update specialist settings.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleUpdateSpecialistSettings(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req UpdateSpecialistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* Apply updates.
	***************************************************************************************************/
	name := specialist.Name
	if req.Name != "" {
		name = req.Name
	}

	timezone := specialist.Timezone
	if req.Timezone != "" {
		timezone = req.Timezone
	}

	cancelCutoff := specialist.CancelCutoffHrs
	if req.CancelCutoffHrs != nil {
		cancelCutoff = *req.CancelCutoffHrs
	}

	updated, err := db.UpdateSpecialist(specialist.ID, name, timezone, cancelCutoff)
	if err != nil {
		log.Printf("Error updating specialist: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupSpecialist)
	writeJSON(w, updated)
}

/***************************************************************************************************
* Session Types.
***************************************************************************************************/
type CreateSessionTypeRequest struct {
	Type            string `json:"type"`
	Name            string `json:"name"`
	DurationMinutes int    `json:"durationMinutes"`
	Price           int    `json:"price"`
	Currency        string `json:"currency,omitempty"`
	ImageURL        string `json:"imageUrl,omitempty"`
}

/***************************************************************************************************
* Defines the update session type request type used by the api layer.
***************************************************************************************************/
type UpdateSessionTypeRequest struct {
	Type            string  `json:"type,omitempty"`
	Name            string  `json:"name,omitempty"`
	DurationMinutes *int    `json:"durationMinutes,omitempty"`
	Price           *int    `json:"price,omitempty"`
	Currency        string  `json:"currency,omitempty"`
	ImageURL        *string `json:"imageUrl,omitempty"`
	IsActive        *bool   `json:"isActive,omitempty"`
}

/***************************************************************************************************
* Handles admin get services.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
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

/***************************************************************************************************
* Handles create service.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
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

	service, err := db.CreateSessionType(specialist.ID, req.Type, req.Name, req.DurationMinutes, req.Price, currency, req.ImageURL)
	if err != nil {
		log.Printf("Error creating service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupServices)
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, service)
}

/***************************************************************************************************
* Handles update service.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
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

	/***************************************************************************************************
	* Apply updates.
	***************************************************************************************************/
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

	isActive := existing.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	updated, err := db.UpdateSessionType(existing.ID, sessionType, name, duration, price, currency, imageURL, isActive)
	if err != nil {
		log.Printf("Error updating service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupServices)
	writeJSON(w, updated)
}

/***************************************************************************************************
* Handles delete service.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
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

	/***************************************************************************************************
	* Soft delete (deactivate).
	***************************************************************************************************/
	if err := db.DeactivateSessionType(existing.ID); err != nil {
		log.Printf("Error deactivating service: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupServices)
	w.WriteHeader(http.StatusNoContent)
}

/***************************************************************************************************
* Working Hours.
***************************************************************************************************/
type WorkingHoursRequest struct {
	DayOfWeek int    `json:"dayOfWeek"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
}

/***************************************************************************************************
* Defines the bulk working hours request type used by the api layer.
***************************************************************************************************/
type BulkWorkingHoursRequest struct {
	Hours []WorkingHoursRequest `json:"hours"`
}

/***************************************************************************************************
* Defines the day working-hours interval request type used by the api layer.
***************************************************************************************************/
type DayWorkingHoursIntervalRequest struct {
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
}

/***************************************************************************************************
* Defines the day working-hours request type used by the api layer.
***************************************************************************************************/
type DayWorkingHoursRequest struct {
	Hours     []DayWorkingHoursIntervalRequest `json:"hours"`
	StartTime string                           `json:"startTime"`
	EndTime   string                           `json:"endTime"`
}

/***************************************************************************************************
* Handles admin get working hours.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
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

	setPrivateCache(w, 60, 300)
	writeJSON(w, hours)
}

/***************************************************************************************************
* Defines the admin schedule context response type used by the api layer.
***************************************************************************************************/
type AdminScheduleContextResponse struct {
	WorkingHours []models.WorkingHours `json:"workingHours"`
	DaysOff      []models.DayOff       `json:"daysOff"`
}

/***************************************************************************************************
* Loads admin schedule context.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
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

/***************************************************************************************************
* Validates a bulk working-hours request, including overlap checks per day.
*
* Parameters:
* - hours: Hours used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
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

/***************************************************************************************************
* Normalizes a day-level working-hours request into the bulk request shape.
*
* Parameters:
* - day: Day used by the current operation.
* - req: Req used by the current operation.
*
* Returns:
* - The computed value for the current operation as []WorkingHoursRequest together with an error
*   when the operation cannot complete successfully.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func normalizeDayWorkingHoursRequest(day int, req DayWorkingHoursRequest) ([]WorkingHoursRequest, error) {
	if len(req.Hours) == 0 {
		if req.StartTime == "" || req.EndTime == "" {
			return nil, errMissingTimeRange
		}

		return []WorkingHoursRequest{
			{
				DayOfWeek: day,
				StartTime: req.StartTime,
				EndTime:   req.EndTime,
			},
		}, nil
	}

	hours := make([]WorkingHoursRequest, 0, len(req.Hours))
	for _, interval := range req.Hours {
		hours = append(hours, WorkingHoursRequest{
			DayOfWeek: day,
			StartTime: interval.StartTime,
			EndTime:   interval.EndTime,
		})
	}

	return hours, nil
}

/***************************************************************************************************
* Handles admin get schedule context.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
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

	setPrivateCache(w, 60, 300)
	writeJSON(w, resp)
}

/***************************************************************************************************
* Handles update working hours.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
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

	/***************************************************************************************************
	* Clear existing and set new.
	***************************************************************************************************/
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

	/***************************************************************************************************
	* Return updated hours.
	***************************************************************************************************/
	hours, _ := db.GetWorkingHoursBySpecialistID(specialist.ID)
	changes.Publish(specialist.ID, changes.GroupWorkingHours)
	writeJSON(w, hours)
}

/***************************************************************************************************
* Handles set working hours for day.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleSetWorkingHoursForDay(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	dayStr := chi.URLParam(r, "day")
	day, err := strconv.Atoi(dayStr)
	if err != nil || day < 0 || day > 6 {
		httpError(w, r, "Error.InvalidDayOfWeek", http.StatusBadRequest)
		return
	}

	var req DayWorkingHoursRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	dayHours, err := normalizeDayWorkingHoursRequest(day, req)
	if err != nil {
		if err == errMissingTimeRange {
			httpError(w, r, "Error.MissingTimeRange", http.StatusBadRequest)
			return
		}
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if err := validateWorkingHoursRequests(dayHours); err != nil {
		if err == errMissingTimeRange {
			httpError(w, r, "Error.MissingTimeRange", http.StatusBadRequest)
			return
		}
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if err := db.DeleteWorkingHours(specialist.ID, day); err != nil {
		log.Printf("Error clearing working hours for day: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	for _, wh := range dayHours {
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

/***************************************************************************************************
* Handles delete working hours for day.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleDeleteWorkingHoursForDay(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	dayStr := chi.URLParam(r, "day")
	day, err := strconv.Atoi(dayStr)
	if err != nil || day < 0 || day > 6 {
		httpError(w, r, "Error.InvalidDayOfWeek", http.StatusBadRequest)
		return
	}

	if err := db.DeleteWorkingHours(specialist.ID, day); err != nil {
		log.Printf("Error deleting working hours: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupWorkingHours)
	w.WriteHeader(http.StatusNoContent)
}

/***************************************************************************************************
* Bookings Management.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
const defaultAdminBookingsLimit = 20
const maxAdminBookingsLimit = 100

func parseAdminBookingsPositiveInt(value string, fallback int) (int, error) {
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, errors.New("invalid positive integer")
	}
	return parsed, nil
}

func parseAdminBookingsDate(value string, inclusiveEnd bool) (*time.Time, error) {
	if value == "" {
		return nil, nil
	}
	parsed, err := parseDate(value)
	if err != nil {
		return nil, err
	}
	parsed = time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, time.UTC)
	if inclusiveEnd {
		parsed = parsed.AddDate(0, 0, 1)
	}
	return &parsed, nil
}

func adminBookingsQueryValues(query url.Values, key string) []string {
	seen := map[string]bool{}
	values := []string{}
	for _, value := range query[key] {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		values = append(values, trimmed)
	}
	return values
}

func HandleAdminGetBookings(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	query := r.URL.Query()
	status := query.Get("status")

	completedCount, err := db.CompletePastConfirmedBookingsForSpecialist(specialist.ID, time.Now().UTC())
	if err != nil {
		log.Printf("Error completing past bookings: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if completedCount > 0 {
		changes.Publish(specialist.ID, changes.GroupBookings)
	}

	if query.Has("page") || query.Has("limit") {
		page, err := parseAdminBookingsPositiveInt(query.Get("page"), 1)
		if err != nil {
			httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
			return
		}

		limit, err := parseAdminBookingsPositiveInt(query.Get("limit"), defaultAdminBookingsLimit)
		if err != nil {
			httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
			return
		}
		if limit > maxAdminBookingsLimit {
			limit = maxAdminBookingsLimit
		}

		dateFrom, err := parseAdminBookingsDate(query.Get("dateFrom"), false)
		if err != nil {
			httpError(w, r, "Error.BadDate", http.StatusBadRequest)
			return
		}
		dateTo, err := parseAdminBookingsDate(query.Get("dateTo"), true)
		if err != nil {
			httpError(w, r, "Error.BadDate", http.StatusBadRequest)
			return
		}

		filters := db.BookingListFilters{
			Status:         status,
			Statuses:       adminBookingsQueryValues(query, "status"),
			ClientID:       strings.TrimSpace(query.Get("clientId")),
			ClientIDs:      adminBookingsQueryValues(query, "clientId"),
			ClientSearch:   strings.TrimSpace(query.Get("client")),
			SessionTypeID:  strings.TrimSpace(query.Get("serviceId")),
			SessionTypeIDs: adminBookingsQueryValues(query, "serviceId"),
			DateFrom:       dateFrom,
			DateTo:         dateTo,
			Sort:           query.Get("sort"),
			Limit:          limit,
			Offset:         (page - 1) * limit,
		}

		bookings, total, err := db.GetBookingsBySpecialistIDFiltered(specialist.ID, filters)
		if err != nil {
			log.Printf("Error getting paginated bookings: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
		if bookings == nil {
			bookings = []models.Booking{}
		}

		totalPages := 0
		if total > 0 {
			totalPages = (total + limit - 1) / limit
		}

		setNoStore(w)
		writeJSON(w, models.BookingListResponse{
			Bookings:   bookings,
			Total:      total,
			Page:       page,
			Limit:      limit,
			TotalPages: totalPages,
		})
		return
	}

	bookings, err := db.GetBookingsBySpecialistID(specialist.ID, status)
	if err != nil {
		log.Printf("Error getting bookings: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if bookings == nil {
		bookings = []models.Booking{}
	}

	setNoStore(w)
	writeJSON(w, bookings)
}

/***************************************************************************************************
* Defines the update booking status request type used by the api layer.
***************************************************************************************************/
type UpdateBookingStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
}

/***************************************************************************************************
* Handles admin update booking status.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminUpdateBookingStatus(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		httpError(w, r, "Error.MissingBookingID", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil || booking.SpecialistID != specialist.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}

	var req UpdateBookingStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	validStatuses := map[string]bool{
		"pending": true, "confirmed": true, "rejected": true, "cancelled": true, "completed": true,
	}
	if !validStatuses[req.Status] {
		httpError(w, r, "Error.InvalidStatus", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* Specialist cannot confirm their own bookings — only the client can.
	***************************************************************************************************/
	if booking.CreatedBy == "specialist" && req.Status == "confirmed" {
		httpError(w, r, "Error.CannotConfirmOwnBooking", http.StatusForbidden)
		return
	}

	oldStatus := booking.Status
	if (req.Status == "cancelled" || req.Status == "rejected") && req.Reason != "" {
		if err := db.CancelBooking(bookingID, req.Reason, models.CancelledBySpecialist); err != nil {
			log.Printf("Error cancelling booking: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
		if req.Status == "rejected" {
			db.UpdateBookingStatus(bookingID, models.BookingStatusRejected)
		}
	} else if err := db.UpdateBookingStatus(bookingID, models.BookingStatus(req.Status)); err != nil {
		log.Printf("Error updating booking status: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("BOOKING STATUS [%s] %s -> %s | Client: %s | Specialist: %s (@%s)",
		bookingID[:8],
		oldStatus,
		req.Status,
		booking.ClientName,
		specialist.Name,
		specialist.BotUsername,
	)

	/***************************************************************************************************
	* Refresh booking to get updated status + session type.
	***************************************************************************************************/
	booking, _ = db.GetBookingByID(bookingID)

	/***************************************************************************************************
	* Notify client about status change.
	***************************************************************************************************/
	if NotifyStatusChangeFunc != nil && booking != nil {
		if err := NotifyStatusChangeFunc(booking, req.Status); err != nil {
			log.Printf("Error notifying client about status change: %v", err)
		}
	}

	/***************************************************************************************************
	* Update specialist's Telegram notification message (remove buttons).
	***************************************************************************************************/
	if UpdateSpecialistMessageFunc != nil && booking != nil {
		if err := UpdateSpecialistMessageFunc(booking); err != nil {
			log.Printf("Error updating specialist message: %v", err)
		}
	}

	if booking != nil {
		changes.Publish(booking.SpecialistID, changes.GroupBookings)
	}
	writeJSON(w, booking)
}

/***************************************************************************************************
* Reschedule Booking.
***************************************************************************************************/
type AdminRescheduleBookingRequest struct {
	Date string `json:"date"` // "2026-03-10"
	Time string `json:"time"` // "10:00"
}

/***************************************************************************************************
* Handles admin reschedule booking.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminRescheduleBooking(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		httpError(w, r, "Error.MissingBookingID", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil || booking.SpecialistID != specialist.ID {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}

	if booking.Status != models.BookingStatusPending && booking.Status != models.BookingStatusConfirmed {
		httpError(w, r, "Error.BookingCannotModify", http.StatusBadRequest)
		return
	}

	var req AdminRescheduleBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if req.Date == "" || req.Time == "" {
		httpError(w, r, "Error.MissingDateTime", http.StatusBadRequest)
		return
	}

	date, err := parseDate(req.Date)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* Reject past dates and dates more than 3 months ahead.
	***************************************************************************************************/
	if errMsg := validateBookingDate(date); errMsg != "" {
		httpError(w, r, errMsg, http.StatusBadRequest)
		return
	}

	hour, minute, err := parseTime(req.Time)
	if err != nil {
		httpError(w, r, "Error.SelectTime", http.StatusBadRequest)
		return
	}

	duration := booking.DurationMinutes
	if duration == 0 && booking.SessionType != nil {
		duration = booking.SessionType.DurationMinutes
	}
	if duration == 0 {
		duration = 60
	}

	startsAt := time.Date(date.Year(), date.Month(), date.Day(), hour, minute, 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(duration) * time.Minute)

	/***************************************************************************************************
	* Check for conflicts (exclude current booking).
	***************************************************************************************************/
	hasConflict, err := db.HasConflictingBooking(specialist.ID, startsAt, endsAt, bookingID)
	if err != nil {
		log.Printf("Error checking conflicts: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if hasConflict {
		httpError(w, r, "Error.BookingConflict", http.StatusConflict)
		return
	}

	if err := db.UpdateBookingDateTime(bookingID, startsAt, endsAt, duration); err != nil {
		log.Printf("Error updating booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("RESCHEDULE [%s] Specialist: %s moved booking for client: %s | New: %s %s",
		bookingID[:8], specialist.Name, booking.ClientName, req.Date, req.Time)

	/***************************************************************************************************
	* Refresh booking.
	***************************************************************************************************/
	booking, _ = db.GetBookingByID(bookingID)

	/***************************************************************************************************
	* Notify client.
	***************************************************************************************************/
	if NotifyStatusChangeFunc != nil && booking != nil {
		if err := NotifyStatusChangeFunc(booking, "rescheduled"); err != nil {
			log.Printf("Error notifying client about reschedule: %v", err)
		}
	}

	if booking != nil {
		changes.Publish(booking.SpecialistID, changes.GroupBookings)
	}
	writeJSON(w, booking)
}

/***************************************************************************************************
* NotifySpecialistBookingFunc is a callback to notify client about specialist-created booking.
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
var NotifySpecialistBookingFunc func(booking *models.Booking) error

/***************************************************************************************************
* Defines the admin create booking request type used by the api layer.
***************************************************************************************************/
type AdminCreateBookingRequest struct {
	ClientID      string `json:"clientId"`
	SessionTypeID string `json:"sessionTypeId,omitempty"`
	Duration      int    `json:"duration"`
	Date          string `json:"date"`
	Time          string `json:"time"`
	Message       string `json:"message,omitempty"`
}

/***************************************************************************************************
* Handles admin create booking.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminCreateBooking(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req AdminCreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if req.ClientID == "" || req.Duration <= 0 || req.Date == "" || req.Time == "" {
		httpError(w, r, "Error.MissingFields", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* Verify client belongs to this specialist.
	***************************************************************************************************/
	client, err := db.GetClientByID(req.ClientID)
	if err != nil {
		log.Printf("Error getting client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if client == nil || client.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ClientNotFound", http.StatusNotFound)
		return
	}

	/***************************************************************************************************
	* Parse date and time.
	***************************************************************************************************/
	date, err := parseDate(req.Date)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* Reject past dates and dates more than 3 months ahead.
	***************************************************************************************************/
	if errMsg := validateBookingDate(date); errMsg != "" {
		httpError(w, r, errMsg, http.StatusBadRequest)
		return
	}

	hour, minute, err := parseTime(req.Time)
	if err != nil {
		httpError(w, r, "Error.SelectTime", http.StatusBadRequest)
		return
	}

	sessionType, errMsg, err := resolveSessionTypeForBooking(specialist.ID, req.SessionTypeID, req.Duration)
	if err != nil {
		log.Printf("Error resolving session type: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if errMsg != "" {
		httpError(w, r, errMsg, http.StatusBadRequest)
		return
	}

	duration := sessionType.DurationMinutes
	startsAt := time.Date(date.Year(), date.Month(), date.Day(), hour, minute, 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(duration) * time.Minute)

	/***************************************************************************************************
	* Check for conflicts.
	***************************************************************************************************/
	hasConflict, err := db.HasConflictingBooking(specialist.ID, startsAt, endsAt, "")
	if err != nil {
		log.Printf("Error checking conflicts: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if hasConflict {
		httpError(w, r, "Error.BookingConflict", http.StatusConflict)
		return
	}

	/***************************************************************************************************
	* Create booking with created_by = "specialist".
	***************************************************************************************************/
	booking, err := db.CreateBookingBySpecialist(specialist.ID, client.ID, sessionType.ID, startsAt, endsAt, client.Name, req.Message, duration)
	if err != nil {
		log.Printf("Error creating booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("SPECIALIST BOOKING [%s] Specialist: %s booked client: %s | Duration: %dmin | Time: %s %s",
		booking.ID[:8], specialist.Name, client.Name, duration, req.Date, req.Time)

	/***************************************************************************************************
	* Ghost clients: auto-confirm and skip notification.
	***************************************************************************************************/
	if client.IsGhost {
		if err := db.UpdateBookingStatus(booking.ID, models.BookingStatusConfirmed); err != nil {
			log.Printf("Error auto-confirming ghost booking: %v", err)
		}
		booking, _ = db.GetBookingByID(booking.ID)
	} else {
		/***************************************************************************************************
		* Notify client about specialist-created booking.
		***************************************************************************************************/
		if NotifySpecialistBookingFunc != nil {
			if err := NotifySpecialistBookingFunc(booking); err != nil {
				log.Printf("Error notifying client about specialist booking: %v", err)
			}
		}
	}

	changes.Publish(specialist.ID, changes.GroupBookings)
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, booking)
}

/***************************************************************************************************
* Days Off.
***************************************************************************************************/
type CreateDayOffRequest struct {
	Date   string `json:"date"` // YYYY-MM-DD
	Reason string `json:"reason,omitempty"`
}

/***************************************************************************************************
* Handles get days off.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
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

	setPrivateCache(w, 300, 600)
	writeJSON(w, daysOff)
}

/***************************************************************************************************
* Handles create day off.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleCreateDayOff(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req CreateDayOffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if req.Date == "" {
		httpError(w, r, "Error.MissingDate", http.StatusBadRequest)
		return
	}

	date, err := parseDate(req.Date)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* Check if already exists.
	***************************************************************************************************/
	existing, _ := db.GetDayOff(specialist.ID, date)
	if existing != nil {
		httpError(w, r, "Error.DayOffDuplicate", http.StatusConflict)
		return
	}

	dayOff, err := db.CreateDayOff(specialist.ID, date, req.Reason)
	if err != nil {
		log.Printf("Error creating day off: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupDaysOff)
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, dayOff)
}

/***************************************************************************************************
* Handles delete day off.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
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

	if err := db.DeleteDayOff(dayOffID); err != nil {
		log.Printf("Error deleting day off: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupDaysOff)
	w.WriteHeader(http.StatusNoContent)
}

/***************************************************************************************************
* Profile.
***************************************************************************************************/
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

/***************************************************************************************************
* Handles get profile.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleGetProfile(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	resp := SpecialistResponse{
		ID:                specialist.ID,
		Name:              specialist.Name,
		Timezone:          specialist.Timezone,
		CancelCutoffHrs:   specialist.CancelCutoffHrs,
		TelegramHandle:    specialist.TelegramHandle,
		Phone:             specialist.Phone,
		Specialization:    specialist.Specialization,
		Bio:               specialist.Bio,
		PhotoURL:          specialist.PhotoURL,
		LocationLatitude:  specialist.LocationLatitude,
		LocationLongitude: specialist.LocationLongitude,
		Language:          specialist.Language,
		Wallpaper:         specialist.Wallpaper,
	}

	writeJSON(w, resp)
}

/***************************************************************************************************
* Handles update profile.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
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

	if (req.Name != nil && len(*req.Name) > 50) ||
		(req.Specialization != nil && len(*req.Specialization) > 100) ||
		(req.Bio != nil && len(*req.Bio) > 1000) ||
		(req.Phone != nil && len(*req.Phone) > 20) ||
		(req.TelegramHandle != nil && len(*req.TelegramHandle) > 50) {
		httpError(w, r, "Error.FieldTooLong", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* Update name if provided.
	***************************************************************************************************/
	if req.Name != nil {
		specialist.Name = *req.Name
		if _, err := db.UpdateSpecialist(specialist.ID, specialist.Name, specialist.Timezone, specialist.CancelCutoffHrs); err != nil {
			log.Printf("Error updating specialist name: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
	}

	/***************************************************************************************************
	* Update profile fields.
	***************************************************************************************************/
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
	photoURL := specialist.PhotoURL
	if req.PhotoURL != nil {
		photoURL = *req.PhotoURL
		if photoURL == "" {
			user := GetTelegramUserFromContext(r)
			if user != nil && user.ID == specialist.TelegramUserID && user.PhotoURL != "" {
				photoURL = user.PhotoURL
			}
		}
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

	updated, err := db.UpdateSpecialistProfile(specialist.ID, telegramHandle, phone, specialization, bio, photoURL, locationLatitude, locationLongitude, wallpaper)
	if err != nil {
		log.Printf("Error updating profile: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	/***************************************************************************************************
	* Update language if valid.
	***************************************************************************************************/
	if req.Language == "ru" || req.Language == "en" {
		db.UpdateSpecialistLanguage(specialist.ID, req.Language)
		updated.Language = req.Language
	}

	resp := SpecialistResponse{
		ID:                updated.ID,
		Name:              updated.Name,
		Timezone:          updated.Timezone,
		CancelCutoffHrs:   updated.CancelCutoffHrs,
		TelegramHandle:    updated.TelegramHandle,
		Phone:             updated.Phone,
		Specialization:    updated.Specialization,
		Bio:               updated.Bio,
		PhotoURL:          updated.PhotoURL,
		LocationLatitude:  updated.LocationLatitude,
		LocationLongitude: updated.LocationLongitude,
		Language:          updated.Language,
		Wallpaper:         updated.Wallpaper,
	}

	changes.Publish(specialist.ID, changes.GroupSpecialist)
	writeJSON(w, resp)
}

/***************************************************************************************************
* Admin Clients.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminCreateGhostClient(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		httpError(w, r, "Error.MissingClientName", http.StatusBadRequest)
		return
	}

	client, err := db.CreateGhostClient(specialist.ID, name)
	if err != nil {
		log.Printf("Error creating ghost client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("GHOST CLIENT created: %s for specialist %s", name, specialist.Name)

	changes.Publish(specialist.ID, changes.GroupClients)
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, client)
}

/***************************************************************************************************
* Handles admin delete client.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminDeleteClient(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	clientID := chi.URLParam(r, "id")
	if clientID == "" {
		httpError(w, r, "Error.MissingClientID", http.StatusBadRequest)
		return
	}

	client, err := db.GetClientByID(clientID)
	if err != nil {
		log.Printf("Error getting client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if client == nil || client.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ClientNotFound", http.StatusNotFound)
		return
	}

	if err := db.DeleteClient(clientID); err != nil {
		log.Printf("Error deleting client: %v", err)
		httpError(w, r, "Error.DeleteClientBookings", http.StatusConflict)
		return
	}

	log.Printf("CLIENT deleted: %s (%s) by specialist %s", client.Name, clientID[:8], specialist.Name)
	changes.Publish(specialist.ID, changes.GroupClients, changes.GroupBookings, changes.GroupRecurring)
	w.WriteHeader(http.StatusNoContent)
}

/***************************************************************************************************
* Handles admin update client.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminUpdateClient(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	clientID := chi.URLParam(r, "id")
	if clientID == "" {
		httpError(w, r, "Error.MissingClientID", http.StatusBadRequest)
		return
	}

	client, err := db.GetClientByID(clientID)
	if err != nil {
		log.Printf("Error getting client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if client == nil || client.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ClientNotFound", http.StatusNotFound)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.InvalidJSON", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		httpError(w, r, "Error.NameRequired", http.StatusBadRequest)
		return
	}

	if client.IsGhost {
		if err := db.UpdateGhostClientName(clientID, name); err != nil {
			log.Printf("Error updating ghost client name: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
	} else {
		if err := db.UpdateClientDisplayName(clientID, name); err != nil {
			log.Printf("Error updating client display name: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
	}

	updated, err := db.GetClientByID(clientID)
	if err != nil {
		log.Printf("Error getting updated client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupClients, changes.GroupBookings, changes.GroupRecurring)
	writeJSON(w, updated)
}

/***************************************************************************************************
* Handles admin get clients.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminGetClients(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	clients, err := db.GetClientsBySpecialistID(specialist.ID)
	if err != nil {
		log.Printf("Error getting clients: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if clients == nil {
		clients = []models.Client{}
	}

	writeJSON(w, clients)
}

/***************************************************************************************************
* Admin Notification Preferences.
***************************************************************************************************/
type AdminNotificationPrefsResponse struct {
	NotifyNewBookings   bool `json:"notifyNewBookings"`
	NotifyCancellations bool `json:"notifyCancellations"`
}

/***************************************************************************************************
* Defines the update admin notification prefs request type used by the api layer.
***************************************************************************************************/
type UpdateAdminNotificationPrefsRequest struct {
	NotifyNewBookings   *bool `json:"notifyNewBookings"`
	NotifyCancellations *bool `json:"notifyCancellations"`
}

/***************************************************************************************************
* Handles admin get notification prefs.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminGetNotificationPrefs(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	resp := AdminNotificationPrefsResponse{
		NotifyNewBookings:   specialist.NotifyNewBookings,
		NotifyCancellations: specialist.NotifyCancellations,
	}
	writeJSON(w, resp)
}

/***************************************************************************************************
* Handles admin update notification prefs.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
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

	if err := db.UpdateSpecialistNotificationPrefs(specialist.ID, notifyNewBookings, notifyCancellations); err != nil {
		log.Printf("Error updating notification prefs: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	resp := AdminNotificationPrefsResponse{
		NotifyNewBookings:   notifyNewBookings,
		NotifyCancellations: notifyCancellations,
	}
	changes.Publish(specialist.ID, changes.GroupAdminNotifications)
	writeJSON(w, resp)
}

/***************************************************************************************************
* Super Admin.
***************************************************************************************************/
type SpecialistListItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	BotUsername string `json:"botUsername"`
	IsActive    bool   `json:"isActive"`
	CreatedAt   string `json:"createdAt"`
}

/***************************************************************************************************
* Handles list all specialists.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleListAllSpecialists(w http.ResponseWriter, r *http.Request) {
	specialists, err := db.GetAllActiveSpecialists()
	if err != nil {
		log.Printf("Error getting specialists: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	result := make([]SpecialistListItem, len(specialists))
	for i, t := range specialists {
		result[i] = SpecialistListItem{
			ID:          t.ID,
			Name:        t.Name,
			BotUsername: t.BotUsername,
			IsActive:    t.IsActive,
			CreatedAt:   t.CreatedAt.Format("2006-01-02 15:04:05"),
		}
	}

	writeJSON(w, result)
}

func HandleAdminBlockClient(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	clientID := chi.URLParam(r, "id")
	if clientID == "" {
		httpError(w, r, "Error.MissingClientID", http.StatusBadRequest)
		return
	}

	client, err := db.GetClientByID(clientID)
	if err != nil {
		log.Printf("Error getting client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if client == nil || client.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ClientNotFound", http.StatusNotFound)
		return
	}

	var req struct {
		Blocked        bool `json:"blocked"`
		CancelBookings bool `json:"cancelBookings"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if err := db.SetClientBlocked(clientID, req.Blocked); err != nil {
		log.Printf("Error setting client blocked: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if req.Blocked && req.CancelBookings {
		if n, err := db.CancelAllClientBookings(clientID, specialist.ID); err != nil {
			log.Printf("Error cancelling client bookings: %v", err)
		} else if n > 0 {
			log.Printf("Cancelled %d bookings for blocked client %s", n, clientID[:8])
		}
		if n, err := db.CancelAllClientRecurring(clientID, specialist.ID); err != nil {
			log.Printf("Error cancelling client recurring: %v", err)
		} else if n > 0 {
			log.Printf("Cancelled %d recurring schedules for blocked client %s", n, clientID[:8])
		}
	}

	updated, err := db.GetClientByID(clientID)
	if err != nil {
		log.Printf("Error getting updated client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupClients, changes.GroupBookings, changes.GroupRecurring)
	writeJSON(w, updated)
}
