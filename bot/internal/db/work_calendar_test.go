package db

import (
	"testing"
	"time"

	"scheduler-bot/internal/models"
)

func wcDate(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := time.Parse("2006-01-02", s)
	if err != nil {
		t.Fatalf("bad test date %q: %v", s, err)
	}
	return d
}

func wcSpecialist(t *testing.T) *models.Specialist {
	t.Helper()
	setupStatsTestDB(t)
	specialist, err := CreateSpecialist(8101, "token-work-calendar", "workcalendarbot", "Calendar", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}
	return specialist
}

/***************************************************************************************************
* Weekly mode must keep deciding by weekday hours minus days off, exactly like before the
* calendar abstraction existed. 2030-01-07 is a Monday.
***************************************************************************************************/
func TestWorkCalendarWeeklyParity(t *testing.T) {
	specialist := wcSpecialist(t)
	if err := UpsertWorkingHours(specialist.ID, 1, "09:00", "12:00"); err != nil {
		t.Fatal(err)
	}
	if err := UpsertWorkingHours(specialist.ID, 1, "14:00", "18:00"); err != nil {
		t.Fatal(err)
	}
	if _, err := CreateDayOffsBatch(specialist.ID, []time.Time{wcDate(t, "2030-01-14")}, ""); err != nil {
		t.Fatal(err)
	}

	cal, err := LoadWorkCalendar(specialist.ID)
	if err != nil {
		t.Fatal(err)
	}
	if cal.Mode() != "weekly" {
		t.Fatalf("mode = %q, want weekly", cal.Mode())
	}
	if !cal.IsWorkingDate(wcDate(t, "2030-01-07")) {
		t.Fatal("Monday with hours must be a working date")
	}
	if got := cal.IntervalsFor(wcDate(t, "2030-01-07")); len(got) != 2 || got[0].StartTime != "09:00" || got[1].EndTime != "18:00" || got[0].DayOfWeek != 1 {
		t.Fatalf("unexpected Monday intervals: %+v", got)
	}
	if cal.IsWorkingDate(wcDate(t, "2030-01-14")) {
		t.Fatal("Monday that is a day off must be closed")
	}
	if len(cal.IntervalsFor(wcDate(t, "2030-01-14"))) != 0 {
		t.Fatal("day off must have no intervals")
	}
	if cal.IsWorkingDate(wcDate(t, "2030-01-08")) {
		t.Fatal("Tuesday without hours must be closed")
	}
}

/***************************************************************************************************
* An empty or NULL schedule_mode (rows created before the column existed) behaves as weekly.
***************************************************************************************************/
func TestWorkCalendarEmptyModeIsWeekly(t *testing.T) {
	specialist := wcSpecialist(t)
	if _, err := DB.Exec(Q(`UPDATE specialists SET schedule_mode = NULL WHERE id = ?`), specialist.ID); err != nil {
		t.Fatal(err)
	}
	reloaded, err := GetSpecialistByID(specialist.ID)
	if err != nil || reloaded == nil {
		t.Fatalf("GetSpecialistByID: %v", err)
	}
	if reloaded.ScheduleMode != "weekly" {
		t.Fatalf("ScheduleMode = %q, want weekly", reloaded.ScheduleMode)
	}
	if !reloaded.NotifyWorkDaysReminder {
		t.Fatal("work-days reminder should default to enabled")
	}
	cal, err := LoadWorkCalendar(specialist.ID)
	if err != nil || cal.Mode() != "weekly" {
		t.Fatalf("calendar mode = %v (err %v), want weekly", cal.Mode(), err)
	}
}

/***************************************************************************************************
* Dates mode: everything is closed by default, an opened date uses default hours unless it has its
* own, and neither the weekday template nor days off matter.
***************************************************************************************************/
func TestWorkCalendarDatesMode(t *testing.T) {
	specialist := wcSpecialist(t)
	// A weekly template and a day off exist but must be ignored in dates mode.
	if err := UpsertWorkingHours(specialist.ID, 1, "08:00", "20:00"); err != nil {
		t.Fatal(err)
	}
	if _, err := CreateDayOffsBatch(specialist.ID, []time.Time{wcDate(t, "2030-01-09")}, ""); err != nil {
		t.Fatal(err)
	}
	if err := SetScheduleSettings(specialist.ID, "dates", `[{"startTime":"10:00","endTime":"20:00"}]`); err != nil {
		t.Fatal(err)
	}
	err := SetWorkDates(specialist.ID, []WorkDateInput{
		{Date: wcDate(t, "2030-01-09")},
		{Date: wcDate(t, "2030-01-10"), Intervals: `[{"startTime":"12:00","endTime":"15:00"}]`},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}

	cal, err := LoadWorkCalendar(specialist.ID)
	if err != nil {
		t.Fatal(err)
	}
	if cal.Mode() != "dates" {
		t.Fatalf("mode = %q, want dates", cal.Mode())
	}
	if cal.IsWorkingDate(wcDate(t, "2030-01-07")) {
		t.Fatal("a Monday with weekly hours must stay closed in dates mode")
	}
	if !cal.IsWorkingDate(wcDate(t, "2030-01-09")) {
		t.Fatal("opened date must be working even though it is also a day off")
	}
	if got := cal.IntervalsFor(wcDate(t, "2030-01-09")); len(got) != 1 || got[0].StartTime != "10:00" || got[0].EndTime != "20:00" || got[0].DayOfWeek != 3 {
		t.Fatalf("default intervals expected, got %+v", got)
	}
	if got := cal.IntervalsFor(wcDate(t, "2030-01-10")); len(got) != 1 || got[0].StartTime != "12:00" || got[0].EndTime != "15:00" {
		t.Fatalf("custom intervals expected, got %+v", got)
	}
	if len(cal.IntervalsFor(wcDate(t, "2030-01-11"))) != 0 {
		t.Fatal("unopened date must have no intervals")
	}
}

/***************************************************************************************************
* SetWorkDates upserts (replacing intervals) and closes in one call; GetWorkDates is ordered and
* honours the lower bound.
***************************************************************************************************/
func TestSetWorkDatesUpsertAndClose(t *testing.T) {
	specialist := wcSpecialist(t)
	if err := SetWorkDates(specialist.ID, []WorkDateInput{
		{Date: wcDate(t, "2030-02-05")},
		{Date: wcDate(t, "2030-02-03"), Intervals: `[{"startTime":"09:00","endTime":"10:00"}]`},
		{Date: wcDate(t, "2030-02-04")},
	}, nil); err != nil {
		t.Fatal(err)
	}
	// Update 02-03 back to defaults, keep 02-05, close 02-04.
	if err := SetWorkDates(specialist.ID,
		[]WorkDateInput{{Date: wcDate(t, "2030-02-03")}},
		[]time.Time{wcDate(t, "2030-02-04")},
	); err != nil {
		t.Fatal(err)
	}

	dates, err := GetWorkDates(specialist.ID, wcDate(t, "2030-02-01"))
	if err != nil {
		t.Fatal(err)
	}
	if len(dates) != 2 || dates[0].Date.Format("2006-01-02") != "2030-02-03" || dates[1].Date.Format("2006-01-02") != "2030-02-05" {
		t.Fatalf("unexpected dates: %+v", dates)
	}
	if dates[0].Intervals != "" {
		t.Fatalf("intervals should have been reset to defaults, got %q", dates[0].Intervals)
	}

	later, err := GetWorkDates(specialist.ID, wcDate(t, "2030-02-04"))
	if err != nil || len(later) != 1 || later[0].Date.Format("2006-01-02") != "2030-02-05" {
		t.Fatalf("lower bound ignored: %+v (err %v)", later, err)
	}

	count, err := CountWorkDatesInRange(specialist.ID, wcDate(t, "2030-02-03"), wcDate(t, "2030-02-04"))
	if err != nil || count != 1 {
		t.Fatalf("CountWorkDatesInRange = %d (err %v), want 1", count, err)
	}
}

/***************************************************************************************************
* Only pending/confirmed bookings count as "active" for closing dates and auto-opening.
***************************************************************************************************/
func TestActiveBookingDates(t *testing.T) {
	specialist := wcSpecialist(t)
	client, err := CreateGhostClient(specialist.ID, "Ghost")
	if err != nil {
		t.Fatal(err)
	}
	service, err := CreateSessionType(specialist.ID, "common", "Session", 60, 0, "RUB", "")
	if err != nil {
		t.Fatal(err)
	}

	mk := func(day string, hour int, status models.BookingStatus) {
		t.Helper()
		start := wcDate(t, day).Add(time.Duration(hour) * time.Hour)
		b, err := CreateBooking(specialist.ID, client.ID, service.ID, start, start.Add(time.Hour), "Ghost", "", 60)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := DB.Exec(Q(`UPDATE bookings SET status = ? WHERE id = ?`), string(status), b.ID); err != nil {
			t.Fatal(err)
		}
	}
	mk("2030-03-04", 10, models.BookingStatusPending)
	mk("2030-03-04", 12, models.BookingStatusConfirmed)
	mk("2030-03-05", 10, models.BookingStatusCancelled)
	mk("2030-03-06", 23, models.BookingStatusConfirmed)
	mk("2030-03-02", 10, models.BookingStatusConfirmed)

	counts, err := CountActiveBookingsByDate(specialist.ID, []time.Time{
		wcDate(t, "2030-03-04"), wcDate(t, "2030-03-05"), wcDate(t, "2030-03-06"), wcDate(t, "2030-03-07"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if counts["2030-03-04"] != 2 || counts["2030-03-05"] != 0 || counts["2030-03-06"] != 1 || counts["2030-03-07"] != 0 {
		t.Fatalf("unexpected counts: %v", counts)
	}
	if _, ok := counts["2030-03-02"]; ok {
		t.Fatal("dates outside the requested set must not appear")
	}

	future, err := GetFutureActiveBookingDates(specialist.ID, wcDate(t, "2030-03-03"))
	if err != nil {
		t.Fatal(err)
	}
	if len(future) != 2 || future[0].Format("2006-01-02") != "2030-03-04" || future[1].Format("2006-01-02") != "2030-03-06" {
		t.Fatalf("unexpected future dates: %v", future)
	}
}

func TestSoftDeleteRemovesWorkDates(t *testing.T) {
	specialist := wcSpecialist(t)
	if err := SetWorkDates(specialist.ID, []WorkDateInput{{Date: wcDate(t, "2030-04-01")}}, nil); err != nil {
		t.Fatal(err)
	}
	if err := SoftDeleteSpecialistCascade(specialist.ID); err != nil {
		t.Fatal(err)
	}
	dates, err := GetWorkDates(specialist.ID, wcDate(t, "2030-01-01"))
	if err != nil || len(dates) != 0 {
		t.Fatalf("work dates should be removed on delete: %v (err %v)", dates, err)
	}
}

func TestWorkDaysReminderWeekRoundTrip(t *testing.T) {
	specialist := wcSpecialist(t)
	if week, err := GetWorkDaysReminderWeek(specialist.ID); err != nil || week != "" {
		t.Fatalf("initial week = %q (err %v), want empty", week, err)
	}
	if err := SetWorkDaysReminderWeek(specialist.ID, "2026-W47"); err != nil {
		t.Fatal(err)
	}
	if week, _ := GetWorkDaysReminderWeek(specialist.ID); week != "2026-W47" {
		t.Fatalf("week = %q, want 2026-W47", week)
	}
	if err := UpdateSpecialistWorkDaysReminderPref(specialist.ID, false); err != nil {
		t.Fatal(err)
	}
	reloaded, _ := GetSpecialistByID(specialist.ID)
	if reloaded.NotifyWorkDaysReminder {
		t.Fatal("reminder pref should be disabled")
	}
}
