package api

import (
	"fmt"
	"sync"
	"time"
)

/***************************************************************************************************
* tzLocationCache memoizes time.LoadLocation results, since it parses IANA tzdata on every call.
***************************************************************************************************/
var tzLocationCache sync.Map

/***************************************************************************************************
* Loads a schedule location, falling back to UTC when a specialist timezone is missing or invalid.
***************************************************************************************************/
func scheduleLocation(timezone string) *time.Location {
	if timezone == "" {
		return time.UTC
	}
	if cached, ok := tzLocationCache.Load(timezone); ok {
		return cached.(*time.Location)
	}
	location, err := time.LoadLocation(timezone)
	if err != nil {
		location = time.UTC
	}
	tzLocationCache.Store(timezone, location)
	return location
}

/***************************************************************************************************
* Returns the current specialist wall-clock time in the same UTC-based storage convention used by
* bookings and working hours.
***************************************************************************************************/
func scheduleClockNow(timezone string) time.Time {
	now := time.Now().In(scheduleLocation(timezone))
	return time.Date(
		now.Year(),
		now.Month(),
		now.Day(),
		now.Hour(),
		now.Minute(),
		now.Second(),
		now.Nanosecond(),
		time.UTC,
	)
}

/***************************************************************************************************
* Parses time.
*
* Parameters:
* - value: Input data consumed by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func parseTime(value string) (int, int, error) {
	if value == "24:00" {
		return 24, 0, nil
	}
	parsed, err := time.Parse("15:04", value)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid time %q", value)
	}
	return parsed.Hour(), parsed.Minute(), nil
}

/***************************************************************************************************
* Converts a time string to minutes from midnight.
*
* Parameters:
* - value: Input data consumed by the current operation.
*
* Returns:
* - The computed value for the current operation as int together with an error when parsing fails.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func timeToMinutes(value string) (int, error) {
	hour, minute, err := parseTime(value)
	if err != nil {
		return 0, err
	}
	return hour*60 + minute, nil
}

/***************************************************************************************************
* Validates time range.
*
* Parameters:
* - startTime: Time value used by the current operation.
* - endTime: Time value used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func validateTimeRange(startTime, endTime string) error {
	startMinutes, err := timeToMinutes(startTime)
	if err != nil {
		return err
	}

	endMinutes, err := timeToMinutes(endTime)
	if err != nil {
		return err
	}

	if endMinutes <= startMinutes {
		return fmt.Errorf("invalid time range %q-%q", startTime, endTime)
	}

	return nil
}
