package api

import (
	"errors"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"scheduler-bot/internal/db"
)

var (
	errInvalidDayOfWeek     = errors.New("invalid day of week")
	errMissingTimeRange     = errors.New("missing time range")
	errOverlappingTimeRange = errors.New("overlapping time range")
)

const defaultAdminBookingsLimit = 20
const maxAdminBookingsLimit = 100
const defaultAdminClientsLimit = 50
const maxAdminClientsLimit = 100

func parseDate(dateStr string) (time.Time, error) {
	return time.Parse("2006-01-02", dateStr)
}

func getDurationsFromServices(specialistID string) []int {
	services, err := db.GetSessionTypesBySpecialistID(specialistID)
	if err != nil || len(services) == 0 {
		return []int{}
	}

	seen := map[int]bool{}
	var durations []int
	for _, service := range services {
		if seen[service.DurationMinutes] {
			continue
		}
		seen[service.DurationMinutes] = true
		durations = append(durations, service.DurationMinutes)
	}

	sort.Ints(durations)
	if durations == nil {
		durations = []int{}
	}
	return durations
}

func HandleGetDurations(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	setNoStore(w)
	writeJSON(w, getDurationsFromServices(specialist.ID))
}

func HandleAdminGetDurations(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	setNoStore(w)
	writeJSON(w, getDurationsFromServices(specialist.ID))
}

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
