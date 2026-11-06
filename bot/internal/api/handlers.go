package api

import (
	"encoding/json"
	"net/http"
	"time"

	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

func httpError(w http.ResponseWriter, r *http.Request, msgID string, code int) {
	loc := myI18n.L(r.Context())
	http.Error(w, myI18n.T(loc, msgID), code)
}

var allowedServiceDurations = map[int]bool{
	30:  true,
	45:  true,
	60:  true,
	75:  true,
	90:  true,
	105: true,
	120: true,
	180: true,
}

func isAllowedServiceDuration(duration int) bool {
	return allowedServiceDurations[duration]
}

func resolveSessionTypeForBooking(specialistID, sessionTypeID string, duration int) (*models.SessionType, string, error) {
	if sessionTypeID != "" {
		sessionType, err := db.GetSessionTypeByID(sessionTypeID)
		if err != nil {
			return nil, "", err
		}
		if sessionType == nil || sessionType.SpecialistID != specialistID || !sessionType.IsActive {
			return nil, "Error.ServiceNotFound", nil
		}
		if duration > 0 && sessionType.DurationMinutes != duration {
			return nil, "Error.InvalidDuration", nil
		}
		return sessionType, "", nil
	}

	services, err := db.GetSessionTypesBySpecialistID(specialistID)
	if err != nil {
		return nil, "", err
	}
	if len(services) == 0 {
		return nil, "Error.NoServices", nil
	}
	for i := range services {
		if services[i].Type == "common" && services[i].DurationMinutes == duration {
			return &services[i], "", nil
		}
	}
	for i := range services {
		if services[i].DurationMinutes == duration {
			return &services[i], "", nil
		}
	}
	return nil, "Error.InvalidDuration", nil
}

func maxBookingDate() time.Time {
	return time.Now().AddDate(0, 3, 0)
}

func maxBookingDateForTimezone(timezone string) time.Time {
	return scheduleClockNow(timezone).AddDate(0, 3, 0)
}

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

func validateBookingDateForTimezone(date time.Time, timezone string) string {
	now := scheduleClockNow(timezone)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	if date.Before(today) {
		return "Error.DateInPast"
	}
	if date.After(maxBookingDateForTimezone(timezone)) {
		return "Error.DateTooFar"
	}
	return ""
}

func isPastBookingStart(startsAt time.Time, timezone string) bool {
	return !startsAt.After(scheduleClockNow(timezone))
}

// validateRescheduleTime returns the first non-empty validation error for a
// proposed new booking start time. It checks the date is not in the past or
// too far in the future (timezone-aware), then checks that the exact start
// time has not already passed.
func validateRescheduleTime(date, startsAt time.Time, tz string) string {
	if msg := validateBookingDateForTimezone(date, tz); msg != "" {
		return msg
	}
	if isPastBookingStart(startsAt, tz) {
		return "Error.TimeInPast"
	}
	return ""
}

var NotifyStatusChangeFunc func(booking *models.Booking, newStatus string) error
var NotifyBookingFunc func(booking *models.Booking) error
var UpdateSpecialistMessageFunc func(booking *models.Booking) error
var NotifyClientBookingResponseFunc func(booking *models.Booking, accepted bool) error
var NotifyRescheduleRequestFunc func(booking *models.Booking, oldBooking *models.Booking) error
var NotifyRescheduleResponseFunc func(newBooking *models.Booking, oldBooking *models.Booking, approved bool, respondedBy string) error
var UpdateClientMessageFunc func(booking *models.Booking) error
var NotifyCancellationFunc func(booking *models.Booking, cancelledBy string) error

type SpecialistResponse struct {
	ID                  string  `json:"id"`
	Name                string  `json:"name"`
	Timezone            string  `json:"timezone"`
	CancelCutoffHrs     int     `json:"cancelCutoffHours"`
	CancelCutoffEnabled bool    `json:"cancelCutoffEnabled"`
	BotUsername         string  `json:"botUsername,omitempty"`
	TelegramHandle      string  `json:"telegramHandle,omitempty"`
	Phone               string  `json:"phone,omitempty"`
	Specialization      string  `json:"specialization,omitempty"`
	Bio                 string  `json:"bio,omitempty"`
	PhotoURL            string  `json:"photoUrl,omitempty"`
	LocationLatitude    float64 `json:"locationLatitude,omitempty"`
	LocationLongitude   float64 `json:"locationLongitude,omitempty"`
	IsOwner             bool    `json:"isOwner"`
	Language            string  `json:"language,omitempty"`
	Wallpaper           string  `json:"wallpaper,omitempty"`
	MasterBotUsername   string  `json:"masterBotUsername,omitempty"`
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
