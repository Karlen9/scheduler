package api

import (
	"log"
	"net/http"
	"sort"
	"strconv"
	"time"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

func HandleGetAvailability(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	dateStr := r.URL.Query().Get("date")
	durationParam := r.URL.Query().Get("duration")
	sessionTypeParam := r.URL.Query().Get("sessionType")

	if dateStr == "" {
		httpError(w, r, "Error.MissingDate", http.StatusBadRequest)
		return
	}
	if durationParam == "" && sessionTypeParam == "" {
		httpError(w, r, "Error.MissingDuration", http.StatusBadRequest)
		return
	}

	duration, err := resolveAvailabilityDuration(specialist.ID, durationParam, sessionTypeParam)
	if err != nil {
		httpError(w, r, err.Error(), http.StatusBadRequest)
		return
	}

	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}
	if errMsg := validateBookingDateForTimezone(date, specialist.Timezone); errMsg != "" {
		httpError(w, r, errMsg, http.StatusBadRequest)
		return
	}

	isDayOff, err := db.IsDayOff(specialist.ID, date)
	if err != nil {
		log.Printf("Error checking day off: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if isDayOff {
		setNoStore(w)
		writeJSON(w, []models.TimeSlot{})
		return
	}

	hours, err := db.GetWorkingHoursBySpecialistID(specialist.ID)
	if err != nil {
		log.Printf("Error getting working hours: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	dayWorkingHours := make([]models.WorkingHours, 0)
	dayOfWeek := int(date.Weekday())
	for _, wh := range hours {
		if wh.DayOfWeek == dayOfWeek {
			dayWorkingHours = append(dayWorkingHours, wh)
		}
	}
	if len(dayWorkingHours) == 0 {
		setNoStore(w)
		writeJSON(w, []models.TimeSlot{})
		return
	}

	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	endOfDay := startOfDay.AddDate(0, 0, 1)
	bookings, err := db.GetBookingsBySpecialistIDAndDateRange(specialist.ID, startOfDay, endOfDay)
	if err != nil {
		log.Printf("Error getting bookings: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	var clientID string
	if client := GetClientFromContext(r); client != nil {
		clientID = client.ID
	}

	/***************************************************************************************************
	* Reschedule flow: the booking being moved must not block its own slot. It is ignored when
	* computing conflicts and its slot is reported as "current". The booking is honoured only when it
	* belongs to the current specialist (and to the requesting client for client requests).
	***************************************************************************************************/
	var currentStart *time.Time
	if excludeID := r.URL.Query().Get("excludeBookingId"); excludeID != "" {
		excluded, err := db.GetBookingByID(excludeID)
		if err != nil {
			log.Printf("Error getting excluded booking: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
		if excluded != nil && excluded.SpecialistID == specialist.ID && (clientID == "" || excluded.ClientID == clientID) {
			filtered := make([]models.Booking, 0, len(bookings))
			for _, booking := range bookings {
				if booking.ID != excluded.ID {
					filtered = append(filtered, booking)
				}
			}
			bookings = filtered
			if excluded.StartsAt.Year() == date.Year() && excluded.StartsAt.Month() == date.Month() && excluded.StartsAt.Day() == date.Day() {
				start := excluded.StartsAt
				currentStart = &start
			}
		}
	}

	setNoStore(w)
	writeJSON(w, generateTimeSlots(date, dayWorkingHours, duration, bookings, clientID, specialist.Timezone, currentStart))
}

func resolveAvailabilityDuration(specialistID, durationParam, sessionTypeParam string) (int, error) {
	if durationParam != "" {
		parsedDuration, err := strconv.Atoi(durationParam)
		if err != nil || parsedDuration <= 0 {
			return 0, errString("Error.InvalidDuration")
		}
		return parsedDuration, nil
	}

	sessionType, err := db.GetSessionTypeByType(specialistID, sessionTypeParam)
	if err != nil || sessionType == nil {
		return 0, errString("Error.InvalidServiceType")
	}
	return sessionType.DurationMinutes, nil
}

type errString string

func (e errString) Error() string {
	return string(e)
}

func generateTimeSlots(date time.Time, intervals []models.WorkingHours, duration int, bookings []models.Booking, clientID string, timezone string, currentStart *time.Time) []models.TimeSlot {
	var slots []models.TimeSlot
	seen := make(map[string]bool)
	now := scheduleClockNow(timezone)
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

		for minutes := startMinutes; minutes+duration <= endMinutes; minutes += duration {
			hour := minutes / 60
			min := minutes % 60
			timeStr := formatTime(hour, min)
			if seen[timeStr] {
				continue
			}

			endMin := minutes + duration
			endTimeStr := formatTime(endMin/60, endMin%60)
			slotStart := time.Date(date.Year(), date.Month(), date.Day(), hour, min, 0, 0, time.UTC)
			if isToday && !slotStart.After(now) {
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

			current := false
			if currentStart != nil && currentStart.Hour() == hour && currentStart.Minute() == min {
				current = true
				available = false
			}

			seen[timeStr] = true
			slots = append(slots, models.TimeSlot{
				Time:      timeStr,
				EndTime:   endTimeStr,
				Available: available,
				Mine:      mine,
				Current:   current,
			})
		}
	}

	sort.Slice(slots, func(i, j int) bool {
		return slots[i].Time < slots[j].Time
	})

	return slots
}

func formatTime(hour, min int) string {
	hour = hour % 24
	return strconv.Itoa(hour/10) + strconv.Itoa(hour%10) + ":" + strconv.Itoa(min/10) + strconv.Itoa(min%10)
}
