package api

import (
	"fmt"
	"time"
)

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
