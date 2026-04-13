package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* httpError writes a localized error message using the localizer from request context.
*
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
* - msgID: Identifier used to target the current record.
* - code: Code used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func httpError(w http.ResponseWriter, r *http.Request, msgID string, code int) {
	loc := myI18n.L(r.Context())
	http.Error(w, myI18n.T(loc, msgID), code)
}

/***************************************************************************************************
* maxBookingDate returns the latest allowed booking date (3 months from today).
*
* Parameters:
* - None.
*
* Returns:
* - The computed value for the current operation as time.Time.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func maxBookingDate() time.Time {
	return time.Now().AddDate(0, 3, 0)
}

/***************************************************************************************************
* validateBookingDate checks that a date is not in the past and not more than 3 months ahead.
* Returns an error message ID or "" if valid.
*
* Parameters:
* - date: Date value used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func validateBookingDate(date time.Time) string {
	today := time.Now().Truncate(24 * time.Hour)
	if date.Before(today) {
		return "Error.DateInPast"
	}
	if date.After(maxBookingDate()) {
		return "Error.DateTooFar"
	}
	return ""
}

/***************************************************************************************************
* NotifyStatusChangeFunc is a callback to notify client when booking status changes via admin
* panel.
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
var NotifyStatusChangeFunc func(booking *models.Booking, newStatus string) error

/***************************************************************************************************
* NotifyBookingFunc is a callback to notify specialist about a new client-created booking.
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
var NotifyBookingFunc func(booking *models.Booking) error

/***************************************************************************************************
* UpdateSpecialistMessageFunc is a callback to edit the specialist's Telegram notification message
* when a booking status changes via the admin panel.
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
var UpdateSpecialistMessageFunc func(booking *models.Booking) error

/***************************************************************************************************
* NotifyClientBookingResponseFunc is a callback to notify the specialist when a client confirms or
* declines a specialist-created booking via the REST API.
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
var NotifyClientBookingResponseFunc func(booking *models.Booking, accepted bool) error

/***************************************************************************************************
* UpdateClientMessageFunc is a callback to edit the client's Telegram notification message.
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
var UpdateClientMessageFunc func(booking *models.Booking) error

/***************************************************************************************************
* NotifyCancellationFunc is a callback to notify the other side about an immediate cancellation.
* cancelledBy is "client" or "specialist".
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
var NotifyCancellationFunc func(booking *models.Booking, cancelledBy string) error

/***************************************************************************************************
* SpecialistResponse is the API response for specialist info.
***************************************************************************************************/
type SpecialistResponse struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	Timezone          string  `json:"timezone"`
	CancelCutoffHrs   int     `json:"cancelCutoffHours"`
	BotUsername       string  `json:"botUsername,omitempty"`
	TelegramHandle    string  `json:"telegramHandle,omitempty"`
	Phone             string  `json:"phone,omitempty"`
	Specialization    string  `json:"specialization,omitempty"`
	Bio               string  `json:"bio,omitempty"`
	PhotoURL          string  `json:"photoUrl,omitempty"`
	LocationLatitude  float64 `json:"locationLatitude,omitempty"`
	LocationLongitude float64 `json:"locationLongitude,omitempty"`
	IsOwner           bool    `json:"isOwner"`
	Language          string  `json:"language,omitempty"`
}

/***************************************************************************************************
* Handles get specialist.
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
func HandleGetSpecialist(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	client := GetClientFromContext(r)
	isOwner := client != nil && client.TelegramUserID == specialist.TelegramUserID

	resp := SpecialistResponse{
		ID:                specialist.ID,
		Name:              specialist.Name,
		Timezone:          specialist.Timezone,
		CancelCutoffHrs:   specialist.CancelCutoffHrs,
		BotUsername:       specialist.BotUsername,
		TelegramHandle:    specialist.TelegramHandle,
		Phone:             specialist.Phone,
		Specialization:    specialist.Specialization,
		Bio:               specialist.Bio,
		PhotoURL:          specialist.PhotoURL,
		LocationLatitude:  specialist.LocationLatitude,
		LocationLongitude: specialist.LocationLongitude,
		IsOwner:           isOwner,
		Language:          specialist.Language,
	}

	setPrivateCache(w, 60, 300)
	writeJSON(w, resp)
}

/***************************************************************************************************
* Handles get services.
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

/***************************************************************************************************
* Handles get working hours.
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

/***************************************************************************************************
* Defines the public schedule context response type used by the api layer.
***************************************************************************************************/
type PublicScheduleContextResponse struct {
	WorkingHours []models.WorkingHours `json:"workingHours"`
	DaysOff      []PublicDayOff        `json:"daysOff"`
}

/***************************************************************************************************
* Builds public day offs.
*
* Parameters:
* - daysOff: Days off used by the current operation.
*
* Returns:
* - The computed value for the current operation as []PublicDayOff.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func buildPublicDayOffs(daysOff []models.DayOff) []PublicDayOff {
	result := make([]PublicDayOff, 0, len(daysOff))
	for _, dayOff := range daysOff {
		result = append(result, PublicDayOff{
			Date: dayOff.Date.Format("2006-01-02"),
		})
	}
	return result
}

/***************************************************************************************************
* Loads public schedule context.
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

/***************************************************************************************************
* Handles get schedule context.
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

/***************************************************************************************************
* Handles get availability.
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
func HandleGetAvailability(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	dateStr := r.URL.Query().Get("date")

	/***************************************************************************************************
	* Support both duration (new) and sessionType (legacy).
	***************************************************************************************************/
	durationParam := r.URL.Query().Get("duration")
	sessionTypeParam := r.URL.Query().Get("sessionType")

	if dateStr == "" {
		httpError(w, r, "Error.MissingDate", http.StatusBadRequest)
		return
	}

	var duration int
	if durationParam != "" {
		var err error
		duration, err = strconv.Atoi(durationParam)
		if err != nil || duration <= 0 {
			httpError(w, r, "Error.InvalidDuration", http.StatusBadRequest)
			return
		}
	} else if sessionTypeParam != "" {
		/***************************************************************************************************
		* Legacy: look up duration from session type.
		***************************************************************************************************/
		sessionType, err := db.GetSessionTypeByType(specialist.ID, sessionTypeParam)
		if err != nil || sessionType == nil {
			httpError(w, r, "Error.InvalidServiceType", http.StatusBadRequest)
			return
		}
		duration = sessionType.DurationMinutes
	} else {
		httpError(w, r, "Error.MissingDuration", http.StatusBadRequest)
		return
	}

	date, err := time.Parse("2006-01-02", dateStr)
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

	/***************************************************************************************************
	* Check if this date is a day off.
	***************************************************************************************************/
	isDayOff, err := db.IsDayOff(specialist.ID, date)
	if err != nil {
		log.Printf("Error checking day off: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if isDayOff {
		setPrivateCache(w, 15, 30)
		writeJSON(w, []models.TimeSlot{})
		return
	}

	/***************************************************************************************************
	* Get working hours for this day.
	***************************************************************************************************/
	hours, err := db.GetWorkingHoursBySpecialistID(specialist.ID)
	if err != nil {
		log.Printf("Error getting working hours: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	dayOfWeek := int(date.Weekday())
	var dayWorkingHours []models.WorkingHours
	for _, wh := range hours {
		if wh.DayOfWeek == dayOfWeek {
			dayWorkingHours = append(dayWorkingHours, wh)
		}
	}

	if len(dayWorkingHours) == 0 {
		setPrivateCache(w, 15, 30)
		writeJSON(w, []models.TimeSlot{})
		return
	}

	/***************************************************************************************************
	* Get existing bookings for this date.
	***************************************************************************************************/
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	endOfDay := startOfDay.AddDate(0, 0, 1)
	bookings, err := db.GetBookingsBySpecialistIDAndDateRange(specialist.ID, startOfDay, endOfDay)
	if err != nil {
		log.Printf("Error getting bookings: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	/***************************************************************************************************
	* Generate time slots.
	***************************************************************************************************/
	var clientID string
	if client := GetClientFromContext(r); client != nil {
		clientID = client.ID
	}
	slots := generateTimeSlots(date, dayWorkingHours, duration, bookings, clientID)

	setPrivateCache(w, 15, 30)
	writeJSON(w, slots)
}

/***************************************************************************************************
* Implements the generate time slots logic used by this module.
*
* Parameters:
* - date: Date value used by the current operation.
* - wh: Wh used by the current operation.
* - duration: Duration value used by the current operation.
* - bookings: Bookings used by the current operation.
*
* Returns:
* - The computed value for the current operation as []models.TimeSlot.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func generateTimeSlots(date time.Time, intervals []models.WorkingHours, duration int, bookings []models.Booking, clientID string) []models.TimeSlot {
	var slots []models.TimeSlot
	seen := make(map[string]bool)
	now := time.Now().UTC()
	isToday := date.Year() == now.Year() && date.Month() == now.Month() && date.Day() == now.Day()

	for _, interval := range intervals {
		startMinutes, err := timeToMinutes(interval.StartTime)
		if err != nil {
			continue
		}
		endMinutes, err := timeToMinutes(interval.EndTime)
		if err != nil {
			continue
		}

		for minutes := startMinutes; minutes+duration <= endMinutes; minutes += 30 {
			hour := minutes / 60
			min := minutes % 60
			timeStr := formatTime(hour, min)
			if seen[timeStr] {
				continue
			}

			endMin := minutes + duration
			endTimeStr := formatTime(endMin/60, endMin%60)

			slotStart := time.Date(date.Year(), date.Month(), date.Day(), hour, min, 0, 0, time.UTC)
			if isToday && slotStart.Before(now) {
				seen[timeStr] = true
				continue
			}
			slotEnd := slotStart.Add(time.Duration(duration) * time.Minute)

			available := true
			mine := false
			for _, booking := range bookings {
				if slotStart.Before(booking.EndsAt) && slotEnd.After(booking.StartsAt) {
					available = false
					if clientID != "" && booking.ClientID == clientID {
						mine = true
					}
					break
				}
			}

			seen[timeStr] = true
			slots = append(slots, models.TimeSlot{
				Time:      timeStr,
				EndTime:   endTimeStr,
				Available: available,
				Mine:      mine,
			})
		}
	}

	sort.Slice(slots, func(i, j int) bool {
		return slots[i].Time < slots[j].Time
	})

	return slots
}

/***************************************************************************************************
* Formats time.
*
* Parameters:
* - hour: Hour used by the current operation.
* - min: Min used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func formatTime(hour, min int) string {
	return strconv.Itoa(hour/10) + strconv.Itoa(hour%10) + ":" + strconv.Itoa(min/10) + strconv.Itoa(min%10)
}

/***************************************************************************************************
* Handles get bookings.
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
func HandleGetBookings(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	bookings, err := db.GetBookingsByClientID(client.ID)
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
* CancelBookingRequest is the request body for cancelling a booking.
***************************************************************************************************/
type CancelBookingRequest struct {
	Reason string `json:"reason,omitempty"`
}

/***************************************************************************************************
* Handles cancel booking.
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
func HandleCancelBooking(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		httpError(w, r, "Error.InvalidBookingID", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}

	/***************************************************************************************************
	* Verify booking belongs to client.
	***************************************************************************************************/
	if booking.ClientID != client.ID {
		httpError(w, r, "Error.Forbidden", http.StatusForbidden)
		return
	}

	/***************************************************************************************************
	* Check if booking can be cancelled.
	***************************************************************************************************/
	if booking.Status != models.BookingStatusPending && booking.Status != models.BookingStatusConfirmed {
		httpError(w, r, "Error.BookingCannotCancel", http.StatusBadRequest)
		return
	}

	var req CancelBookingRequest
	json.NewDecoder(r.Body).Decode(&req) // Ignore errors, reason is optional

	if err := db.CancelBooking(bookingID, req.Reason, models.CancelledByClient); err != nil {
		log.Printf("Error cancelling booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("BOOKING CANCELLED [%s] Client: %s cancelled their booking (reason: %s)",
		bookingID[:8],
		booking.ClientName,
		req.Reason,
	)

	booking, _ = db.GetBookingByID(bookingID)

	if NotifyCancellationFunc != nil {
		if err := NotifyCancellationFunc(booking, "client"); err != nil {
			log.Printf("Error notifying cancellation: %v", err)
		}
	}

	writeJSON(w, booking)
}

/***************************************************************************************************
* Client Create Booking.
***************************************************************************************************/
type CreateBookingRequest struct {
	Duration int    `json:"duration"`
	Date     string `json:"date"`
	Time     string `json:"time"`
	Name     string `json:"name,omitempty"`
	Message  string `json:"message,omitempty"`
}

/***************************************************************************************************
* Handles create booking.
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
func HandleCreateBooking(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req CreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if req.Duration <= 0 || req.Date == "" || req.Time == "" {
		httpError(w, r, "Error.MissingFields", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* Parse date and time.
	***************************************************************************************************/
	date, err := time.Parse("2006-01-02", req.Date)
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

	/***************************************************************************************************
	* Check one booking per client per day.
	***************************************************************************************************/
	hasBooking, err := db.ClientHasBookingOnDate(client.ID, date)
	if err != nil {
		log.Printf("Error checking existing bookings: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if hasBooking {
		httpError(w, r, "Error.BookingDuplicate", http.StatusConflict)
		return
	}

	hour, minute, err := parseTime(req.Time)
	if err != nil {
		httpError(w, r, "Error.SelectTime", http.StatusBadRequest)
		return
	}

	startsAt := time.Date(date.Year(), date.Month(), date.Day(), hour, minute, 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(req.Duration) * time.Minute)

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
	* Find session type by duration.
	***************************************************************************************************/
	services, err := db.GetSessionTypesBySpecialistID(specialist.ID)
	if err != nil || len(services) == 0 {
		httpError(w, r, "Error.NoServices", http.StatusBadRequest)
		return
	}
	sessionTypeID := services[0].ID
	for _, s := range services {
		if s.DurationMinutes == req.Duration {
			sessionTypeID = s.ID
			break
		}
	}

	/***************************************************************************************************
	* Use client name from request or from DB.
	***************************************************************************************************/
	clientName := req.Name
	if clientName == "" {
		clientName = client.Name
	}

	booking, err := db.CreateBooking(specialist.ID, client.ID, sessionTypeID, startsAt, endsAt, clientName, req.Message, req.Duration)
	if err != nil {
		log.Printf("Error creating booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("BOOKING CREATED [%s] Client: %s | Duration: %dmin | Time: %s %s",
		booking.ID[:8], clientName, req.Duration, req.Date, req.Time)

	/***************************************************************************************************
	* Notify specialist.
	***************************************************************************************************/
	if NotifyBookingFunc != nil {
		if err := NotifyBookingFunc(booking); err != nil {
			log.Printf("Error notifying specialist about booking: %v", err)
		}
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, booking)
}

/***************************************************************************************************
* PublicDayOff is the public response for days off (no reason exposed).
***************************************************************************************************/
type PublicDayOff struct {
	Date string `json:"date"`
}

/***************************************************************************************************
* Handles get public days off.
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

	result := buildPublicDayOffs(daysOff)

	setPrivateCache(w, 300, 600)
	writeJSON(w, result)
}

/***************************************************************************************************
* Client Profile.
***************************************************************************************************/
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

/***************************************************************************************************
* Defines the update client profile request type used by the api layer.
***************************************************************************************************/
type UpdateClientProfileRequest struct {
	Name              string `json:"name,omitempty"`
	Phone             string `json:"phone,omitempty"`
	PreferredDuration *int   `json:"preferredDuration,omitempty"`
	Language          string `json:"language,omitempty"`
}

/***************************************************************************************************
* Handles get client profile.
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
func HandleGetClientProfile(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	resp := ClientProfileResponse{
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
	}

	setNoStore(w)
	writeJSON(w, resp)
}

/***************************************************************************************************
* Handles update client profile.
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

	/***************************************************************************************************
	* Update language if valid.
	***************************************************************************************************/
	if req.Language == "ru" || req.Language == "en" {
		db.UpdateClientLanguage(client.ID, req.Language)
	}

	updated, err := db.GetClientByID(client.ID)
	if err != nil || updated == nil {
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	resp := ClientProfileResponse{
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
	}

	writeJSON(w, resp)
}

/***************************************************************************************************
* Client Notification Preferences.
***************************************************************************************************/
type UpdateClientNotificationPrefsRequest struct {
	NotifyBookingStatus *bool `json:"notifyBookingStatus"`
	NotifyReminders     *bool `json:"notifyReminders"`
	NotifyDaysOff       *bool `json:"notifyDaysOff"`
	NotifyCancellations *bool `json:"notifyCancellations"`
}

/***************************************************************************************************
* Handles update client notification prefs.
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

	resp := ClientProfileResponse{
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
	}
	writeJSON(w, resp)
}

/***************************************************************************************************
* HandleClientConfirmBooking lets a client confirm a specialist-created booking. notification
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
func HandleClientConfirmBooking(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		httpError(w, r, "Error.InvalidBookingID", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.ClientID != client.ID {
		httpError(w, r, "Error.Forbidden", http.StatusForbidden)
		return
	}
	if booking.Status != models.BookingStatusPending || booking.CreatedBy != "specialist" {
		httpError(w, r, "Error.BookingCannotConfirm", http.StatusBadRequest)
		return
	}

	if err := db.UpdateBookingStatus(bookingID, models.BookingStatusConfirmed); err != nil {
		log.Printf("Error confirming booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	booking, _ = db.GetBookingByID(bookingID)

	if NotifyClientBookingResponseFunc != nil {
		if err := NotifyClientBookingResponseFunc(booking, true); err != nil {
			log.Printf("Error notifying specialist about client confirm: %v", err)
		}
	}

	/***************************************************************************************************
	* Update client's Telegram notification message (remove buttons).
	***************************************************************************************************/
	if UpdateClientMessageFunc != nil {
		if err := UpdateClientMessageFunc(booking); err != nil {
			log.Printf("Error updating client message: %v", err)
		}
	}

	writeJSON(w, booking)
}

/***************************************************************************************************
* HandleClientDeclineBooking lets a client decline a specialist-created booking. notification
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
func HandleClientDeclineBooking(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	bookingID := chi.URLParam(r, "id")
	if bookingID == "" {
		httpError(w, r, "Error.InvalidBookingID", http.StatusBadRequest)
		return
	}

	booking, err := db.GetBookingByID(bookingID)
	if err != nil {
		log.Printf("Error getting booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if booking == nil {
		httpError(w, r, "Error.BookingNotFound", http.StatusNotFound)
		return
	}
	if booking.ClientID != client.ID {
		httpError(w, r, "Error.Forbidden", http.StatusForbidden)
		return
	}
	if booking.Status != models.BookingStatusPending || booking.CreatedBy != "specialist" {
		httpError(w, r, "Error.BookingCannotReject", http.StatusBadRequest)
		return
	}

	if err := db.CancelBooking(bookingID, "", models.CancelledByClient); err != nil {
		log.Printf("Error declining booking: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	booking, _ = db.GetBookingByID(bookingID)

	if NotifyClientBookingResponseFunc != nil {
		if err := NotifyClientBookingResponseFunc(booking, false); err != nil {
			log.Printf("Error notifying specialist about client decline: %v", err)
		}
	}

	/***************************************************************************************************
	* Update client's Telegram notification message (remove buttons).
	***************************************************************************************************/
	if UpdateClientMessageFunc != nil {
		if err := UpdateClientMessageFunc(booking); err != nil {
			log.Printf("Error updating client message: %v", err)
		}
	}

	writeJSON(w, booking)
}

/***************************************************************************************************
* Implements the write json logic used by this module.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - data: Input data consumed by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
