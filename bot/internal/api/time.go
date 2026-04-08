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
	parsed, err := time.Parse("15:04", value)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid time %q", value)
	}
	return parsed.Hour(), parsed.Minute(), nil
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
	startHour, startMinute, err := parseTime(startTime)
	if err != nil {
		return err
	}

	endHour, endMinute, err := parseTime(endTime)
	if err != nil {
		return err
	}

	if endHour*60+endMinute <= startHour*60+startMinute {
		return fmt.Errorf("invalid time range %q-%q", startTime, endTime)
	}

	return nil
}
