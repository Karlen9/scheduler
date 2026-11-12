package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* workDaysReminderInterval is how often the worker looks for specialists to remind.
***************************************************************************************************/
const workDaysReminderInterval = 15 * time.Minute

/***************************************************************************************************
* workDaysReminderHour is the specialist-local hour (on Friday) from which the reminder is sent.
***************************************************************************************************/
const workDaysReminderHour = 18

/***************************************************************************************************
* nextWeekRange returns the Monday and Sunday of the week after the one `localNow` falls in, and
* the ISO week label of that Monday (e.g. "2026-W47").
*
* Parameters:
* - localNow: The specialist's current wall-clock time (any location; only Y-M-D matters).
***************************************************************************************************/
func nextWeekRange(localNow time.Time) (monday, sunday time.Time, week string) {
	today := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, time.UTC)
	daysToMonday := (8 - int(today.Weekday())) % 7
	if daysToMonday == 0 {
		daysToMonday = 7
	}
	monday = today.AddDate(0, 0, daysToMonday)
	sunday = monday.AddDate(0, 0, 6)
	isoYear, isoWeek := monday.ISOWeek()
	return monday, sunday, fmt.Sprintf("%d-W%02d", isoYear, isoWeek)
}

/***************************************************************************************************
* workDaysReminderWindow reports whether the reminder may go out at `localNow` (Friday, from 18:00
* specialist-local time) and, if the specialist was not already reminded for that week, the week
* label and bounds to check.
*
* Parameters:
* - localNow: The specialist's current wall-clock time.
* - lastReminderWeek: ISO week label stored for the last attempt ("" when never).
*
* Returns:
* - due: true when it is the reminder window and this week was not handled yet.
* - monday, sunday, week: next week's bounds and ISO label.
***************************************************************************************************/
func workDaysReminderWindow(localNow time.Time, lastReminderWeek string) (due bool, monday, sunday time.Time, week string) {
	monday, sunday, week = nextWeekRange(localNow)
	if localNow.Weekday() != time.Friday || localNow.Hour() < workDaysReminderHour {
		return false, monday, sunday, week
	}
	if lastReminderWeek == week {
		return false, monday, sunday, week
	}
	return true, monday, sunday, week
}

/***************************************************************************************************
* decideWorkDaysReminder is the pure decision of the weekly reminder: send when it is Friday from
* 18:00 in the specialist's timezone, next week was not reminded about yet, and next week has no
* open work dates.
*
* Parameters:
* - localNow: The specialist's current wall-clock time.
* - lastReminderWeek: ISO week label stored for the last attempt ("" when never).
* - nextWeekWorkDates: Number of work dates between next Monday and next Sunday.
*
* Returns:
* - send: true when the reminder should be sent now.
* - week: ISO week label to store as handled when sending.
***************************************************************************************************/
func decideWorkDaysReminder(localNow time.Time, lastReminderWeek string, nextWeekWorkDates int) (send bool, week string) {
	due, _, _, week := workDaysReminderWindow(localNow, lastReminderWeek)
	if !due || nextWeekWorkDates > 0 {
		return false, week
	}
	return true, week
}

/***************************************************************************************************
* specialistLocalNow returns the wall-clock time in the specialist's timezone (UTC when the
* timezone is empty or unknown), expressed with a UTC location like the rest of the schedule code.
***************************************************************************************************/
func specialistLocalNow(timezone string, now time.Time) time.Time {
	location := time.UTC
	if timezone != "" {
		if loaded, err := time.LoadLocation(timezone); err == nil {
			location = loaded
		}
	}
	local := now.In(location)
	return time.Date(local.Year(), local.Month(), local.Day(), local.Hour(), local.Minute(), local.Second(), 0, time.UTC)
}

/***************************************************************************************************
* startWorkDaysReminderWorker runs the weekly "open your work days" reminder loop until ctx ends.
*
* Side effects:
* - Reads specialists and work dates, sends Telegram messages through each specialist's own bot and
*   stores the reminded ISO week.
***************************************************************************************************/
func startWorkDaysReminderWorker(ctx context.Context) {
	ticker := time.NewTicker(workDaysReminderInterval)
	defer ticker.Stop()

	log.Println("Work days reminder worker started")

	for {
		select {
		case <-ctx.Done():
			log.Println("Work days reminder worker stopped")
			return
		case <-ticker.C:
			sendWorkDaysReminders(time.Now())
		}
	}
}

/***************************************************************************************************
* sendWorkDaysReminders performs one pass over all dates-mode specialists with the reminder enabled.
* The reminded week is stored when the send is attempted (even if Telegram rejects it) so a failing
* chat is not retried every 15 minutes.
***************************************************************************************************/
func sendWorkDaysReminders(now time.Time) {
	specialists, err := db.GetAllActiveSpecialists()
	if err != nil {
		log.Printf("Work days reminder: error listing specialists: %v", err)
		return
	}

	for i := range specialists {
		specialist := &specialists[i]
		if specialist.DeletedAt != nil || specialist.ScheduleMode != models.ScheduleModeDates || !specialist.NotifyWorkDaysReminder {
			continue
		}

		localNow := specialistLocalNow(specialist.Timezone, now)
		lastWeek, err := db.GetWorkDaysReminderWeek(specialist.ID)
		if err != nil {
			log.Printf("Work days reminder: error reading last week for %s: %v", specialist.ID, err)
			continue
		}
		due, monday, sunday, _ := workDaysReminderWindow(localNow, lastWeek)
		if !due {
			continue
		}

		count, err := db.CountWorkDatesInRange(specialist.ID, monday, sunday)
		if err != nil {
			log.Printf("Work days reminder: error counting work dates for %s: %v", specialist.ID, err)
			continue
		}
		send, week := decideWorkDaysReminder(localNow, lastWeek, count)
		if !send {
			continue
		}

		if err := db.SetWorkDaysReminderWeek(specialist.ID, week); err != nil {
			log.Printf("Work days reminder: error storing week for %s: %v", specialist.ID, err)
			continue
		}

		handler := botManager.GetHandler(specialist.WebhookSecret)
		if handler == nil {
			log.Printf("Work days reminder: no bot found for specialist %s", specialist.Name)
			continue
		}
		if err := handler.SendWorkDaysReminder(specialist); err != nil {
			log.Printf("Work days reminder: error sending to specialist %s: %v", specialist.ID, err)
			continue
		}
		log.Printf("Work days reminder sent to specialist %s for %s", specialist.ID, week)
	}
}
