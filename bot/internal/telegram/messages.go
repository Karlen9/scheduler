package telegram

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Formats date time.
*
* Parameters:
* - loc: Loc used by the current operation.
* - t: T used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func formatDateTime(loc *i18n.Localizer, t time.Time) string {
	weekdays := []string{"Date.Sun", "Date.Mon", "Date.Tue", "Date.Wed", "Date.Thu", "Date.Fri", "Date.Sat"}
	months := []string{"", "Date.Jan", "Date.Feb", "Date.Mar", "Date.Apr", "Date.May", "Date.Jun", "Date.Jul", "Date.Aug", "Date.Sep", "Date.Oct", "Date.Nov", "Date.Dec"}
	return fmt.Sprintf("%s, %d %s %02d:%02d",
		myI18n.T(loc, weekdays[t.Weekday()]),
		t.Day(),
		myI18n.T(loc, months[t.Month()]),
		t.Hour(),
		t.Minute(),
	)
}

/***************************************************************************************************
* Formats price.
*
* Parameters:
* - price: Price used by the current operation.
* - currency: Currency used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func formatPrice(price int, currency string) string {
	return fmt.Sprintf("%d %s", price, currency)
}

/***************************************************************************************************
* Formats duration.
*
* Parameters:
* - loc: Loc used by the current operation.
* - minutes: Minutes used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func formatDuration(loc *i18n.Localizer, minutes int) string {
	if minutes <= 0 {
		return ""
	}

	hours := minutes / 60
	remainingMinutes := minutes % 60
	parts := make([]string, 0, 2)
	if hours > 0 {
		parts = append(parts, fmt.Sprintf("%d %s", hours, myI18n.T(loc, "Duration.Hour")))
	}
	if remainingMinutes > 0 {
		parts = append(parts, fmt.Sprintf("%d %s", remainingMinutes, myI18n.T(loc, "Duration.Minute")))
	}
	return strings.Join(parts, " ")
}

/***************************************************************************************************
* Implements the booking duration display logic used by this module.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func bookingDurationDisplay(loc *i18n.Localizer, booking *models.Booking) string {
	if booking.SessionType != nil {
		return booking.SessionType.Name
	}
	if booking.DurationMinutes > 0 {
		return formatDuration(loc, booking.DurationMinutes)
	}
	return myI18n.T(loc, "Hint.DefaultSession")
}

/***************************************************************************************************
* Implements the booking service display logic used by this module.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func bookingServiceDisplay(loc *i18n.Localizer, booking *models.Booking) string {
	if booking.SessionType != nil {
		if booking.DurationMinutes > 0 {
			return fmt.Sprintf("%s (%s)", booking.SessionType.Name, formatDuration(loc, booking.DurationMinutes))
		}
		return booking.SessionType.Name
	}
	if booking.DurationMinutes > 0 {
		return fmt.Sprintf("%s %s", myI18n.T(loc, "Hint.DefaultSession"), formatDuration(loc, booking.DurationMinutes))
	}
	return myI18n.T(loc, "Hint.DefaultSession")
}

/***************************************************************************************************
* Implements the common booking template data logic used by this module.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as map[string]interface{}.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func bookingTemplateData(loc *i18n.Localizer, booking *models.Booking) map[string]interface{} {
	return map[string]interface{}{
		"ClientName": booking.ClientName,
		"Service":    bookingServiceDisplay(loc, booking),
		"DateTime":   formatDateTime(loc, booking.StartsAt),
	}
}

/***************************************************************************************************
* localizeCancelReason translates known cancel reason keys stored in the DB. If the reason matches
* a known i18n key (e.g. "rescheduled" -> "CancelReason.Rescheduled"), it returns the localized
* string. Otherwise returns the reason as-is.
*
* Parameters:
* - loc: Loc used by the current operation.
* - reason: Reason used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func localizeCancelReason(loc *i18n.Localizer, reason string) string {
	knownKeys := map[string]string{
		"rescheduled": "CancelReason.Rescheduled",
	}
	if key, ok := knownKeys[reason]; ok {
		return myI18n.T(loc, key)
	}
	return reason
}

/***************************************************************************************************
* BtnApp returns the localized persistent-menu label for opening the specialist app entrypoint.
***************************************************************************************************/
func BtnApp(loc *i18n.Localizer) string { return myI18n.T(loc, "Btn.App") }

/***************************************************************************************************
* BtnOpenApp returns the localized button text for opening the mini-app. }.
*
* Parameters:
* - loc: Loc used by the current operation.
*
* Returns:
* - The computed value for the current operation as string { return myI18n.T(loc, "Btn.OpenApp")
* }.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func BtnOpenApp(loc *i18n.Localizer) string { return myI18n.T(loc, "Btn.OpenApp") }

/***************************************************************************************************
* BtnOpenAdmin returns the localized button text for opening admin panel. }.
*
* Parameters:
* - loc: Loc used by the current operation.
*
* Returns:
* - The computed value for the current operation as string { return myI18n.T(loc, "Btn.OpenAdmin")
* }.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func BtnOpenAdmin(loc *i18n.Localizer) string { return myI18n.T(loc, "Btn.OpenAdmin") }

/***************************************************************************************************
* BtnOpenPreview returns the localized button text for opening client preview.
*
* Parameters:
* - loc: Loc used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
***************************************************************************************************/
func BtnOpenPreview(loc *i18n.Localizer) string { return myI18n.T(loc, "Btn.OpenPreview") }

/***************************************************************************************************
* BtnConfirm returns the localized confirm button text. }.
*
* Parameters:
* - loc: Loc used by the current operation.
*
* Returns:
* - The computed value for the current operation as string { return myI18n.T(loc, "Btn.Confirm")
* }.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func BtnConfirm(loc *i18n.Localizer) string { return myI18n.T(loc, "Btn.Confirm") }

/***************************************************************************************************
* BtnReject returns the localized reject button text.
*
* Parameters:
* - loc: Loc used by the current operation.
*
* Returns:
* - The computed value for the current operation as string { return myI18n.T(loc, "Btn.Reject") }.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func BtnReject(loc *i18n.Localizer) string { return myI18n.T(loc, "Btn.Reject") }

/***************************************************************************************************
* BtnAccept returns the localized accept button text (for clients).
*
* Parameters:
* - loc: Loc used by the current operation.
*
* Returns:
* - The computed value for the current operation as string { return myI18n.T(loc, "Btn.Accept") }.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func BtnAccept(loc *i18n.Localizer) string { return myI18n.T(loc, "Btn.Accept") }

/***************************************************************************************************
* BtnDecline returns the localized decline button text (for clients). }.
*
* Parameters:
* - loc: Loc used by the current operation.
*
* Returns:
* - The computed value for the current operation as string { return myI18n.T(loc, "Btn.Decline")
* }.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func BtnDecline(loc *i18n.Localizer) string { return myI18n.T(loc, "Btn.Decline") }

/***************************************************************************************************
* BtnBack returns the localized back button text.
***************************************************************************************************/
func BtnBack(loc *i18n.Localizer) string { return myI18n.T(loc, "Btn.Back") }

/***************************************************************************************************
* BtnHelp returns the localized help entry button text.
***************************************************************************************************/
func BtnHelp(loc *i18n.Localizer) string { return myI18n.T(loc, "Btn.Help") }

/***************************************************************************************************
* FormatWelcome creates a client welcome message.
*
* Parameters:
* - loc: Loc used by the current operation.
* - version: Ignored for client-facing welcome messages.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatWelcome(loc *i18n.Localizer, _ string) string {
	return myI18n.T(loc, "Welcome.Client")
}

/***************************************************************************************************
* FormatHelpSpecialist creates the help message for specialists.
*
* Parameters:
* - loc: Loc used by the current operation.
* - clientURL: Client url used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatHelpSpecialist(loc *i18n.Localizer, clientURL string) string {
	return fmt.Sprintf(myI18n.T(loc, "Help.Specialist"), clientURL)
}

/***************************************************************************************************
* FormatNewBookingMessage creates a message for specialist about new booking request.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatNewBookingMessage(loc *i18n.Localizer, booking *models.Booking) string {
	msg := myI18n.Tf(loc, "Booking.New", bookingTemplateData(loc, booking))
	if booking.ClientMessage != "" {
		msg += myI18n.Tf(loc, "Booking.ClientMessage", map[string]interface{}{"Message": booking.ClientMessage})
	}
	return msg
}

/***************************************************************************************************
* FormatBookingAcceptedSpecialist creates a message for specialist after accepting.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatBookingAcceptedSpecialist(loc *i18n.Localizer, booking *models.Booking) string {
	return myI18n.Tf(loc, "Booking.ConfirmedSpecialist", bookingTemplateData(loc, booking))
}

/***************************************************************************************************
* FormatBookingRejectedSpecialist creates a message for specialist after rejecting.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatBookingRejectedSpecialist(loc *i18n.Localizer, booking *models.Booking) string {
	return myI18n.Tf(loc, "Booking.RejectedSpecialist", bookingTemplateData(loc, booking))
}

/***************************************************************************************************
* FormatBookingConfirmedClient creates a message for client when booking is confirmed.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatBookingConfirmedClient(loc *i18n.Localizer, booking *models.Booking) string {
	return myI18n.Tf(loc, "Booking.ConfirmedClient", bookingTemplateData(loc, booking))
}

/***************************************************************************************************
* FormatBookingRejectedClient creates a message for client when booking is rejected.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatBookingRejectedClient(loc *i18n.Localizer, booking *models.Booking) string {
	data := bookingTemplateData(loc, booking)
	var msg string
	if booking.CancelReason != "" {
		data["Reason"] = localizeCancelReason(loc, booking.CancelReason)
		msg = myI18n.Tf(loc, "Booking.RejectedClientWithReason", data)
	} else {
		msg = myI18n.Tf(loc, "Booking.RejectedClient", data)
	}
	msg += myI18n.T(loc, "Booking.RejectedClientRetry")
	return msg
}

/***************************************************************************************************
* FormatBookingCancelledBySpecialistClient creates a message for client when specialist cancels a
* booking.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatBookingCancelledBySpecialistClient(loc *i18n.Localizer, booking *models.Booking) string {
	msg := myI18n.Tf(loc, "Booking.CancelledBySpecialistClient", bookingTemplateData(loc, booking))
	if booking.CancelReason != "" {
		msg += myI18n.Tf(loc, "Booking.CancelReason", map[string]interface{}{"Reason": localizeCancelReason(loc, booking.CancelReason)})
	}
	msg += myI18n.T(loc, "Booking.CancelledBySpecialistClientRetry")
	return msg
}

/***************************************************************************************************
* FormatBookingPendingClient creates a message for client after booking creation.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatBookingPendingClient(loc *i18n.Localizer, booking *models.Booking) string {
	return myI18n.Tf(loc, "Booking.PendingClient", bookingTemplateData(loc, booking))
}

/***************************************************************************************************
* FormatReminderClient creates a reminder message for client 1h before session.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatReminderClient(loc *i18n.Localizer, booking *models.Booking) string {
	return myI18n.Tf(loc, "Booking.ReminderClient", bookingTemplateData(loc, booking))
}

/***************************************************************************************************
* Recurring Schedule Messages.
*
* Parameters:
* - loc: Loc used by the current operation.
* - day: Day used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func getDayNameShort(loc *i18n.Localizer, day int) string {
	keys := []string{"Date.Sun", "Date.Mon", "Date.Tue", "Date.Wed", "Date.Thu", "Date.Fri", "Date.Sat"}
	if day >= 0 && day < len(keys) {
		return myI18n.T(loc, keys[day])
	}
	return "?"
}

/***************************************************************************************************
* Formats days of week msg.
*
* Parameters:
* - loc: Loc used by the current operation.
* - daysOfWeek: Days of week used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func formatDaysOfWeekMsg(loc *i18n.Localizer, daysOfWeek string) string {
	if daysOfWeek == "" {
		return "?"
	}
	parts := strings.Split(daysOfWeek, ",")
	names := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		var d int
		fmt.Sscanf(p, "%d", &d)
		names = append(names, getDayNameShort(loc, d))
	}
	return strings.Join(names, ", ")
}

/***************************************************************************************************
* formatDayTimesMsg formats per-day times like "Mon 09:00, Wed 10:30".
*
* Parameters:
* - loc: Loc used by the current operation.
* - dayTimesJSON: Time value used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func formatDayTimesMsg(loc *i18n.Localizer, dayTimesJSON string) string {
	if dayTimesJSON == "" {
		return ""
	}
	var m map[string]string
	if err := json.Unmarshal([]byte(dayTimesJSON), &m); err != nil {
		return ""
	}
	/***************************************************************************************************
	* Sort by day number.
	***************************************************************************************************/
	keys := make([]int, 0, len(m))
	for k := range m {
		d, _ := strconv.Atoi(k)
		keys = append(keys, d)
	}
	sort.Ints(keys)

	parts := make([]string, 0, len(keys))
	for _, d := range keys {
		name := getDayNameShort(loc, d)
		t := m[strconv.Itoa(d)]
		parts = append(parts, fmt.Sprintf("%s %s", name, t))
	}
	return strings.Join(parts, ", ")
}

/***************************************************************************************************
* scheduleTimeLine returns the schedule line for days+time display.
*
* Parameters:
* - loc: Loc used by the current operation.
* - schedule: Schedule used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func scheduleTimeLine(loc *i18n.Localizer, schedule *models.RecurringSchedule) string {
	if schedule.DayTimes != "" {
		if s := formatDayTimesMsg(loc, schedule.DayTimes); s != "" {
			return s
		}
	}
	return formatDaysOfWeekMsg(loc, schedule.DaysOfWeek) + " · " + schedule.Time
}

/***************************************************************************************************
* Formats schedule date range.
*
* Parameters:
* - startDate: Date value used by the current operation.
* - loc: Loc used by the current operation.
* - endDate: Date value used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func formatScheduleDateRange(loc *i18n.Localizer, startDate, endDate string) string {
	if startDate == "" || endDate == "" {
		return ""
	}
	months := []string{"", "Date.Jan", "Date.Feb", "Date.Mar", "Date.Apr", "Date.May", "Date.Jun", "Date.Jul", "Date.Aug", "Date.Sep", "Date.Oct", "Date.Nov", "Date.Dec"}
	start, err1 := time.Parse("2006-01-02", startDate)
	end, err2 := time.Parse("2006-01-02", endDate)
	if err1 != nil || err2 != nil {
		return ""
	}
	return fmt.Sprintf("%d %s — %d %s",
		start.Day(), myI18n.T(loc, months[start.Month()]),
		end.Day(), myI18n.T(loc, months[end.Month()]))
}

/***************************************************************************************************
* Implements the schedule service display logic used by this module.
*
* Parameters:
* - loc: Loc used by the current operation.
* - schedule: Schedule used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func scheduleServiceDisplay(loc *i18n.Localizer, schedule *models.RecurringSchedule) string {
	if schedule.SessionType != nil {
		if schedule.DurationMinutes > 0 {
			return fmt.Sprintf("%s (%s)", schedule.SessionType.Name, formatDuration(loc, schedule.DurationMinutes))
		}
		return schedule.SessionType.Name
	}
	if schedule.DurationMinutes > 0 {
		return fmt.Sprintf("%s %s", myI18n.T(loc, "Hint.DefaultSession"), formatDuration(loc, schedule.DurationMinutes))
	}
	return myI18n.T(loc, "Hint.DefaultSession")
}

/***************************************************************************************************
* FormatRecurringScheduleRequest creates a message for specialist about new recurring schedule
* request from client.
*
* Parameters:
* - loc: Loc used by the current operation.
* - schedule: Schedule used by the current operation.
* - count: Count used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatRecurringScheduleRequest(loc *i18n.Localizer, schedule *models.RecurringSchedule, count int) string {
	data := map[string]interface{}{
		"ClientName": schedule.ClientName,
		"Service":    scheduleServiceDisplay(loc, schedule),
		"Schedule":   scheduleTimeLine(loc, schedule),
		"DateRange":  formatScheduleDateRange(loc, schedule.StartDate, schedule.EndDate),
	}
	msg := myI18n.Tf(loc, "Recurring.Request", data)
	if count > 0 {
		msg += myI18n.Tp(loc, "Recurring.SessionCount", count, map[string]interface{}{"Count": count})
	}
	msg += myI18n.T(loc, "Hint.OpenApp")
	return msg
}

/***************************************************************************************************
* FormatRecurringScheduleRequestForClient creates a message for client about specialist-created
* schedule.
*
* Parameters:
* - loc: Loc used by the current operation.
* - schedule: Schedule used by the current operation.
* - count: Count used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatRecurringScheduleRequestForClient(loc *i18n.Localizer, schedule *models.RecurringSchedule, count int) string {
	data := map[string]interface{}{
		"Service":   scheduleServiceDisplay(loc, schedule),
		"Schedule":  scheduleTimeLine(loc, schedule),
		"DateRange": formatScheduleDateRange(loc, schedule.StartDate, schedule.EndDate),
	}
	msg := myI18n.Tf(loc, "Recurring.RequestForClient", data)
	if count > 0 {
		msg += myI18n.Tp(loc, "Recurring.SessionCount", count, map[string]interface{}{"Count": count})
	}
	msg += myI18n.T(loc, "Hint.OpenApp")
	return msg
}

/***************************************************************************************************
* FormatRecurringScheduleApproved creates a message shown to specialist after approving (or shown
* to specialist when client approves).
*
* Parameters:
* - loc: Loc used by the current operation.
* - schedule: Schedule used by the current operation.
* - count: Count used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatRecurringScheduleApproved(loc *i18n.Localizer, schedule *models.RecurringSchedule, count int) string {
	return myI18n.Tf(loc, "Recurring.Approved", map[string]interface{}{
		"ClientName": schedule.ClientName,
		"Service":    scheduleServiceDisplay(loc, schedule),
		"Schedule":   scheduleTimeLine(loc, schedule),
		"DateRange":  formatScheduleDateRange(loc, schedule.StartDate, schedule.EndDate),
		"Count":      count,
	})
}

/***************************************************************************************************
* FormatRecurringScheduleApprovedClient creates a message for client about approved schedule.
*
* Parameters:
* - loc: Loc used by the current operation.
* - schedule: Schedule used by the current operation.
* - count: Count used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatRecurringScheduleApprovedClient(loc *i18n.Localizer, schedule *models.RecurringSchedule, count int) string {
	return myI18n.Tf(loc, "Recurring.ApprovedClient", map[string]interface{}{
		"Service":   scheduleServiceDisplay(loc, schedule),
		"Schedule":  scheduleTimeLine(loc, schedule),
		"DateRange": formatScheduleDateRange(loc, schedule.StartDate, schedule.EndDate),
		"Count":     count,
	})
}

/***************************************************************************************************
* FormatRecurringScheduleDeclined creates a message shown to specialist after declining.
*
* Parameters:
* - loc: Loc used by the current operation.
* - schedule: Schedule used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatRecurringScheduleDeclined(loc *i18n.Localizer, schedule *models.RecurringSchedule) string {
	return myI18n.Tf(loc, "Recurring.Declined", map[string]interface{}{
		"ClientName": schedule.ClientName,
		"Service":    scheduleServiceDisplay(loc, schedule),
		"Schedule":   scheduleTimeLine(loc, schedule),
		"DateRange":  formatScheduleDateRange(loc, schedule.StartDate, schedule.EndDate),
	})
}

/***************************************************************************************************
* FormatRecurringScheduleDeclinedClient creates a message for client about declined schedule.
*
* Parameters:
* - loc: Loc used by the current operation.
* - schedule: Schedule used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatRecurringScheduleDeclinedClient(loc *i18n.Localizer, schedule *models.RecurringSchedule) string {
	return myI18n.Tf(loc, "Recurring.DeclinedClient", map[string]interface{}{
		"Service":   scheduleServiceDisplay(loc, schedule),
		"Schedule":  scheduleTimeLine(loc, schedule),
		"DateRange": formatScheduleDateRange(loc, schedule.StartDate, schedule.EndDate),
	})
}

/***************************************************************************************************
* FormatBookingCancelledForSpecialist creates a notification for specialist when client cancels.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatBookingCancelledForSpecialist(loc *i18n.Localizer, booking *models.Booking) string {
	msg := myI18n.Tf(loc, "Booking.CancelledForSpecialist", bookingTemplateData(loc, booking))
	if booking.CancelReason != "" {
		msg += myI18n.Tf(loc, "Booking.CancelReason", map[string]interface{}{"Reason": localizeCancelReason(loc, booking.CancelReason)})
	}
	return msg
}

/***************************************************************************************************
* FormatBookingCancelledForClient creates a notification for client when specialist cancels.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatBookingCancelledForClient(loc *i18n.Localizer, booking *models.Booking) string {
	msg := myI18n.Tf(loc, "Booking.CancelledForClient", bookingTemplateData(loc, booking))
	if booking.CancelReason != "" {
		msg += myI18n.Tf(loc, "Booking.CancelReason", map[string]interface{}{"Reason": localizeCancelReason(loc, booking.CancelReason)})
	}
	return msg
}

/***************************************************************************************************
* FormatMoveRequestForSpecialist creates a message for specialist when client requests booking
* move.
*
* Parameters:
* - newBooking: New booking used by the current operation.
* - loc: Loc used by the current operation.
* - oldBooking: Old booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatMoveRequestForSpecialist(loc *i18n.Localizer, newBooking, oldBooking *models.Booking) string {
	msg := myI18n.Tf(loc, "Move.RequestForSpecialist", map[string]interface{}{
		"ClientName":  oldBooking.ClientName,
		"Service":     bookingServiceDisplay(loc, oldBooking),
		"OldDateTime": formatDateTime(loc, oldBooking.StartsAt),
		"NewDateTime": formatDateTime(loc, newBooking.StartsAt),
	})
	msg += myI18n.T(loc, "Hint.OpenApp")
	return msg
}

/***************************************************************************************************
* FormatMoveRequestForClient creates a message for client when specialist requests booking move.
*
* Parameters:
* - newBooking: New booking used by the current operation.
* - loc: Loc used by the current operation.
* - oldBooking: Old booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatMoveRequestForClient(loc *i18n.Localizer, newBooking, oldBooking *models.Booking) string {
	msg := myI18n.Tf(loc, "Move.RequestForClient", map[string]interface{}{
		"Service":     bookingServiceDisplay(loc, oldBooking),
		"OldDateTime": formatDateTime(loc, oldBooking.StartsAt),
		"NewDateTime": formatDateTime(loc, newBooking.StartsAt),
	})
	if newBooking.ClientMessage != "" {
		msg += "\n\n" + myI18n.Tf(loc, "Move.SpecialistNote", map[string]interface{}{
			"Message": newBooking.ClientMessage,
		})
	}
	msg += myI18n.T(loc, "Hint.OpenApp")
	return msg
}

/***************************************************************************************************
* FormatMoveApproved creates a message after move is approved.
*
* Parameters:
* - newBooking: New booking used by the current operation.
* - loc: Loc used by the current operation.
* - oldBooking: Old booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatMoveApproved(loc *i18n.Localizer, newBooking, oldBooking *models.Booking) string {
	return myI18n.Tf(loc, "Move.Approved", map[string]interface{}{
		"ClientName":  oldBooking.ClientName,
		"Service":     bookingServiceDisplay(loc, oldBooking),
		"OldDateTime": formatDateTime(loc, oldBooking.StartsAt),
		"NewDateTime": formatDateTime(loc, newBooking.StartsAt),
	})
}

/***************************************************************************************************
* FormatMoveDeclined creates a message after move is declined.
*
* Parameters:
* - loc: Loc used by the current operation.
* - oldBooking: Old booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatMoveDeclined(loc *i18n.Localizer, oldBooking *models.Booking) string {
	return myI18n.Tf(loc, "Move.Declined", map[string]interface{}{
		"ClientName": oldBooking.ClientName,
		"Service":    bookingServiceDisplay(loc, oldBooking),
		"DateTime":   formatDateTime(loc, oldBooking.StartsAt),
	})
}

/***************************************************************************************************
* FormatClientRescheduleRequest creates a message for the specialist when the CLIENT reschedules
* a booking in-place (status stays pending/confirmed, times change). Distinct from move requests
* that go through the reschedule_pending shadow flow.
***************************************************************************************************/
func FormatClientRescheduleRequest(loc *i18n.Localizer, newBooking, oldBooking *models.Booking) string {
	data := map[string]interface{}{
		"ClientName":  newBooking.ClientName,
		"Service":     bookingServiceDisplay(loc, newBooking),
		"NewDateTime": formatDateTime(loc, newBooking.StartsAt),
	}
	if oldBooking != nil {
		data["OldDateTime"] = formatDateTime(loc, oldBooking.StartsAt)
	} else {
		data["OldDateTime"] = ""
	}
	return myI18n.Tf(loc, "Move.ClientRequested", data) + myI18n.T(loc, "Hint.OpenApp")
}

/***************************************************************************************************
* FormatSpecialistCreatedBookingClient creates a message for client when specialist books them.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatSpecialistCreatedBookingClient(loc *i18n.Localizer, booking *models.Booking) string {
	msg := myI18n.Tf(loc, "Booking.SpecialistCreatedClient", bookingTemplateData(loc, booking))
	if booking.ClientMessage != "" {
		msg += myI18n.Tf(loc, "Booking.ClientMessage", map[string]interface{}{"Message": booking.ClientMessage})
	}
	return msg
}

/***************************************************************************************************
* FormatSpecialistCreatedBookingClientAccepted creates the edited message after client accepts.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatSpecialistCreatedBookingClientAccepted(loc *i18n.Localizer, booking *models.Booking) string {
	return myI18n.Tf(loc, "Booking.SpecialistCreatedClientAccepted", bookingTemplateData(loc, booking))
}

/***************************************************************************************************
* FormatSpecialistCreatedBookingClientDeclined creates the edited message after client declines.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatSpecialistCreatedBookingClientDeclined(loc *i18n.Localizer, booking *models.Booking) string {
	return myI18n.Tf(loc, "Booking.SpecialistCreatedClientDeclined", bookingTemplateData(loc, booking))
}

/***************************************************************************************************
* FormatClientAcceptedBookingSpecialist creates a message for specialist when client accepts.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatClientAcceptedBookingSpecialist(loc *i18n.Localizer, booking *models.Booking) string {
	return myI18n.Tf(loc, "Booking.ClientAcceptedSpecialist", bookingTemplateData(loc, booking))
}

/***************************************************************************************************
* FormatClientDeclinedBookingSpecialist creates a message for specialist when client declines.
*
* Parameters:
* - loc: Loc used by the current operation.
* - booking: Booking used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func FormatClientDeclinedBookingSpecialist(loc *i18n.Localizer, booking *models.Booking) string {
	return myI18n.Tf(loc, "Booking.ClientDeclinedSpecialist", bookingTemplateData(loc, booking))
}
