package api_test

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* isolatedRouter swaps the shared test router for a fresh one (own global rate-limit bucket) for the
* duration of the test, so these request-heavy tests neither exhaust nor depend on the budget the
* rest of the suite shares.
***************************************************************************************************/
func isolatedRouter(t *testing.T) {
	t.Helper()
	previousRouter := router
	previousLimits := api.SetRouteRateLimitsDisabledForTest(true)
	apiRouter := api.NewRouter()
	api.SetRouteRateLimitsDisabledForTest(previousLimits)
	router = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		apiRouter.ServeHTTP(w, r)
		api.WaitForTelegramProfilePhotoSyncForTest()
	})
	t.Cleanup(func() { router = previousRouter })
}

type workDateResp struct {
	BookingCount int    `json:"bookingCount"`
	Date         string `json:"date"`
	Intervals    []struct {
		StartTime string `json:"startTime"`
		EndTime   string `json:"endTime"`
	} `json:"intervals"`
	Custom bool `json:"custom"`
}

type bookedDateResp struct {
	Date         string `json:"date"`
	BookingCount int    `json:"bookingCount"`
}

type adminContextResp struct {
	BookedDates      []bookedDateResp `json:"bookedDates"`
	ScheduleMode     string           `json:"scheduleMode"`
	DefaultIntervals []struct {
		StartTime string `json:"startTime"`
		EndTime   string `json:"endTime"`
	} `json:"defaultIntervals"`
	WorkDates []workDateResp `json:"workDates"`
}

type publicContextResp struct {
	ScheduleMode string         `json:"scheduleMode"`
	WorkDates    []workDateResp `json:"workDates"`
}

/***************************************************************************************************
* wdDay returns the UTC calendar date `offset` days from today as YYYY-MM-DD (the shared test
* specialist works in UTC).
***************************************************************************************************/
func wdDay(offset int) string {
	return time.Now().UTC().AddDate(0, 0, offset).Format("2006-01-02")
}

/***************************************************************************************************
* resetWorkDatesState puts the shared test specialist back to weekly mode with no work dates so
* other tests keep seeing the classic behaviour.
***************************************************************************************************/
func resetWorkDatesState(t *testing.T) {
	t.Helper()
	_ = db.SetScheduleSettings(testSpecialist.ID, models.ScheduleModeWeekly, "")
	_, _ = db.DB.Exec(db.Q(`DELETE FROM work_dates WHERE specialist_id = ?`), testSpecialist.ID)
}

/***************************************************************************************************
* enterDatesMode switches the test specialist to dates mode through the API with the given default
* hours, and restores weekly mode when the test ends.
***************************************************************************************************/
func enterDatesMode(t *testing.T, start, end string) {
	t.Helper()
	resetWorkDatesState(t)
	t.Cleanup(func() { resetWorkDatesState(t) })

	// Set directly: the shared test database may hold bookings from other tests, which the API
	// switch would (correctly) auto-open and thereby pollute the calendar these tests assert on.
	defaults := `[{"startTime":"` + start + `","endTime":"` + end + `"}]`
	if err := db.SetScheduleSettings(testSpecialist.ID, models.ScheduleModeDates, defaults); err != nil {
		t.Fatalf("enter dates mode: %v", err)
	}
}

func putWorkDates(t *testing.T, open []map[string]interface{}, closeDates []string) *httpResult {
	t.Helper()
	body := map[string]interface{}{}
	if open != nil {
		body["open"] = open
	}
	if closeDates != nil {
		body["close"] = closeDates
	}
	w := doAdminRequest(t, http.MethodPut, "/api/admin/work-dates", jsonBody(body))
	return &httpResult{Code: w.Code, Body: w.Body.String(), t: t}
}

type httpResult struct {
	Code int
	Body string
	t    *testing.T
}

/***************************************************************************************************
* addActiveBooking creates a pending booking for the test specialist at 10:00 on the given date and
* removes it when the test ends.
***************************************************************************************************/
func addActiveBooking(t *testing.T, date string) {
	t.Helper()
	client, err := db.CreateGhostClient(testSpecialist.ID, "WD Ghost "+date)
	if err != nil {
		t.Fatalf("CreateGhostClient: %v", err)
	}
	service, err := db.CreateSessionType(testSpecialist.ID, "common", "WD Service", 60, 0, "RUB", "")
	if err != nil {
		t.Fatalf("CreateSessionType: %v", err)
	}
	day, _ := time.Parse("2006-01-02", date)
	start := day.Add(10 * time.Hour)
	booking, err := db.CreateBooking(testSpecialist.ID, client.ID, service.ID, start, start.Add(time.Hour), "WD Ghost", "", 60)
	if err != nil {
		t.Fatalf("CreateBooking: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.DB.Exec(db.Q(`DELETE FROM bookings WHERE id = ?`), booking.ID)
	})
}

func TestWorkDatesHappyPath(t *testing.T) {
	isolatedRouter(t)
	enterDatesMode(t, "10:00", "20:00")
	d1, d2, d3 := wdDay(5), wdDay(6), wdDay(7)

	res := putWorkDates(t, []map[string]interface{}{
		{"date": d1},
		{"date": d2, "intervals": []map[string]string{{"startTime": "14:00", "endTime": "16:00"}, {"startTime": "09:00", "endTime": "12:00"}}},
		{"date": d3, "intervals": nil},
	}, nil)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body)
	}

	w := doAdminRequest(t, http.MethodGet, "/api/admin/schedule-context", nil)
	var ctx adminContextResp
	parseJSON(t, w, &ctx)
	if ctx.ScheduleMode != "dates" {
		t.Fatalf("scheduleMode = %q, want dates", ctx.ScheduleMode)
	}
	if len(ctx.DefaultIntervals) != 1 || ctx.DefaultIntervals[0].StartTime != "10:00" || ctx.DefaultIntervals[0].EndTime != "20:00" {
		t.Fatalf("unexpected defaultIntervals: %+v", ctx.DefaultIntervals)
	}
	if len(ctx.WorkDates) != 3 {
		t.Fatalf("expected 3 work dates, got %+v", ctx.WorkDates)
	}
	if ctx.WorkDates[0].Date != d1 || ctx.WorkDates[0].Custom || len(ctx.WorkDates[0].Intervals) != 1 || ctx.WorkDates[0].Intervals[0].StartTime != "10:00" {
		t.Fatalf("d1 should use default hours: %+v", ctx.WorkDates[0])
	}
	if !ctx.WorkDates[1].Custom || len(ctx.WorkDates[1].Intervals) != 2 || ctx.WorkDates[1].Intervals[0].StartTime != "09:00" {
		t.Fatalf("d2 should be custom with sorted intervals: %+v", ctx.WorkDates[1])
	}
	if ctx.WorkDates[2].Custom {
		t.Fatalf("d3 (null intervals) should use defaults: %+v", ctx.WorkDates[2])
	}

	// Public context exposes the effective hours.
	w = doClientRequest(t, http.MethodGet, "/api/schedule-context", nil, 777001)
	var pub publicContextResp
	parseJSON(t, w, &pub)
	if pub.ScheduleMode != "dates" || len(pub.WorkDates) != 3 || pub.WorkDates[1].Intervals[1].EndTime != "16:00" {
		t.Fatalf("unexpected public context: %+v", pub)
	}

	// Re-opening with null resets custom hours; closing d1 removes it. Response is the workDates array.
	res = putWorkDates(t, []map[string]interface{}{{"date": d2}}, []string{d1})
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body)
	}
	if strings.Contains(res.Body, d1) || !strings.Contains(res.Body, `"custom":false`) {
		t.Fatalf("unexpected update response: %s", res.Body)
	}
}

func TestWorkDatesValidation(t *testing.T) {
	isolatedRouter(t)
	enterDatesMode(t, "10:00", "20:00")

	cases := []struct {
		name  string
		open  []map[string]interface{}
		close []string
		want  int
	}{
		{"past open", []map[string]interface{}{{"date": wdDay(-1)}}, nil, http.StatusBadRequest},
		{"past close", nil, []string{wdDay(-2)}, http.StatusBadRequest},
		{"bad date format", []map[string]interface{}{{"date": "13.11.2030"}}, nil, http.StatusBadRequest},
		{"bad close date", nil, []string{"nope"}, http.StatusBadRequest},
		{"overlapping intervals", []map[string]interface{}{{"date": wdDay(3), "intervals": []map[string]string{
			{"startTime": "10:00", "endTime": "13:00"}, {"startTime": "12:00", "endTime": "15:00"}}}}, nil, http.StatusBadRequest},
		{"end before start", []map[string]interface{}{{"date": wdDay(3), "intervals": []map[string]string{
			{"startTime": "15:00", "endTime": "13:00"}}}}, nil, http.StatusBadRequest},
		{"missing time", []map[string]interface{}{{"date": wdDay(3), "intervals": []map[string]string{
			{"startTime": "", "endTime": "13:00"}}}}, nil, http.StatusBadRequest},
		{"same date opened and closed", []map[string]interface{}{{"date": wdDay(4)}}, []string{wdDay(4)}, http.StatusBadRequest},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if res := putWorkDates(t, tc.open, tc.close); res.Code != tc.want {
				t.Fatalf("expected %d, got %d: %s", tc.want, res.Code, res.Body)
			}
		})
	}

	t.Run("too many entries", func(t *testing.T) {
		open := make([]map[string]interface{}, 0, 401)
		for i := 0; i < 401; i++ {
			open = append(open, map[string]interface{}{"date": wdDay(1 + i%50)})
		}
		if res := putWorkDates(t, open, nil); res.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for >400 entries, got %d", res.Code)
		}
	})

	// Nothing from the rejected requests may have been stored.
	w := doAdminRequest(t, http.MethodGet, "/api/admin/schedule-context", nil)
	var ctx adminContextResp
	parseJSON(t, w, &ctx)
	if len(ctx.WorkDates) != 0 {
		t.Fatalf("rejected requests must not change anything, got %+v", ctx.WorkDates)
	}
}

func TestWorkDatesCloseWithBookingsConflict(t *testing.T) {
	isolatedRouter(t)
	enterDatesMode(t, "10:00", "20:00")
	booked, free := wdDay(8), wdDay(9)
	if res := putWorkDates(t, []map[string]interface{}{{"date": booked}, {"date": free}}, nil); res.Code != http.StatusOK {
		t.Fatalf("open: %d %s", res.Code, res.Body)
	}
	addActiveBooking(t, booked)

	w := doAdminRequest(t, http.MethodPut, "/api/admin/work-dates", jsonBody(map[string]interface{}{"close": []string{free, booked}}))
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("409 body must be JSON, got Content-Type %q", ct)
	}
	var conflict struct {
		Error   string   `json:"error"`
		Message string   `json:"message"`
		Dates   []string `json:"dates"`
	}
	parseJSON(t, w, &conflict)
	if conflict.Error != "Error.WorkDateHasBookings" || conflict.Message == "" || len(conflict.Dates) != 1 || conflict.Dates[0] != booked {
		t.Fatalf("unexpected conflict body: %+v", conflict)
	}

	// The whole request is rejected: the free date must still be open.
	ctxW := doAdminRequest(t, http.MethodGet, "/api/admin/schedule-context", nil)
	var ctx adminContextResp
	parseJSON(t, ctxW, &ctx)
	if len(ctx.WorkDates) != 2 {
		t.Fatalf("conflict must leave all dates untouched, got %+v", ctx.WorkDates)
	}

	// Closing only the free date works.
	if res := putWorkDates(t, nil, []string{free}); res.Code != http.StatusOK {
		t.Fatalf("closing a date without bookings: %d %s", res.Code, res.Body)
	}
}

func TestScheduleSettingsValidation(t *testing.T) {
	isolatedRouter(t)
	resetWorkDatesState(t)
	t.Cleanup(func() { resetWorkDatesState(t) })

	cases := []struct {
		name string
		body map[string]interface{}
	}{
		{"unknown mode", map[string]interface{}{"scheduleMode": "monthly"}},
		{"dates without intervals", map[string]interface{}{"scheduleMode": "dates"}},
		{"dates with empty intervals", map[string]interface{}{"scheduleMode": "dates", "defaultIntervals": []map[string]string{}}},
		{"overlapping defaults", map[string]interface{}{"scheduleMode": "dates", "defaultIntervals": []map[string]string{
			{"startTime": "09:00", "endTime": "13:00"}, {"startTime": "12:00", "endTime": "18:00"}}}},
		{"invalid defaults", map[string]interface{}{"scheduleMode": "dates", "defaultIntervals": []map[string]string{
			{"startTime": "18:00", "endTime": "09:00"}}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := doAdminRequest(t, http.MethodPut, "/api/admin/schedule-settings", jsonBody(tc.body))
			if w.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
			}
		})
	}

	// Still weekly after all the rejected attempts.
	specialist, _ := db.GetSpecialistByID(testSpecialist.ID)
	if specialist.ScheduleMode != "weekly" {
		t.Fatalf("mode changed by a rejected request: %q", specialist.ScheduleMode)
	}
}

func TestScheduleSettingsSwitchAutoOpensBookedDates(t *testing.T) {
	isolatedRouter(t)
	resetWorkDatesState(t)
	t.Cleanup(func() { resetWorkDatesState(t) })

	booked, alreadyOpen := wdDay(11), wdDay(12)
	// The shared database may already hold future bookings from other tests; they are auto-opened too.
	preExisting, err := db.GetFutureActiveBookingDates(testSpecialist.ID, time.Now().UTC().Truncate(24*time.Hour))
	if err != nil {
		t.Fatalf("GetFutureActiveBookingDates: %v", err)
	}
	expectedOpened := map[string]bool{booked: true, alreadyOpen: true}
	for _, d := range preExisting {
		expectedOpened[d.Format("2006-01-02")] = true
	}
	addActiveBooking(t, booked)
	addActiveBooking(t, alreadyOpen)
	addActiveBooking(t, wdDay(-3)) // past booking must not be opened
	// Stored while still weekly: allowed, no effect yet.
	if res := putWorkDates(t, []map[string]interface{}{{"date": alreadyOpen, "intervals": []map[string]string{{"startTime": "11:00", "endTime": "13:00"}}}}, nil); res.Code != http.StatusOK {
		t.Fatalf("work-dates in weekly mode: %d %s", res.Code, res.Body)
	}

	body := jsonBody(map[string]interface{}{
		"scheduleMode":     "dates",
		"defaultIntervals": []map[string]string{{"startTime": "10:00", "endTime": "18:00"}},
	})
	w := doAdminRequest(t, http.MethodPut, "/api/admin/schedule-settings", body)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		ScheduleMode     string `json:"scheduleMode"`
		DefaultIntervals []struct {
			StartTime string `json:"startTime"`
			EndTime   string `json:"endTime"`
		} `json:"defaultIntervals"`
		AutoOpened int `json:"autoOpened"`
	}
	parseJSON(t, w, &resp)
	// alreadyOpen was opened by hand beforehand, so it is the only expected date NOT auto-opened.
	if resp.ScheduleMode != "dates" || resp.AutoOpened != len(expectedOpened)-1 || len(resp.DefaultIntervals) != 1 {
		t.Fatalf("unexpected response (want autoOpened=%d): %+v", len(expectedOpened)-1, resp)
	}

	ctxW := doAdminRequest(t, http.MethodGet, "/api/admin/schedule-context", nil)
	var ctx adminContextResp
	parseJSON(t, ctxW, &ctx)
	byDate := map[string]workDateResp{}
	for _, wd := range ctx.WorkDates {
		byDate[wd.Date] = wd
	}
	if len(byDate) != len(expectedOpened) {
		t.Fatalf("expected exactly the booked dates to be open (%v), got %+v", expectedOpened, ctx.WorkDates)
	}
	if wd, ok := byDate[booked]; !ok || wd.Custom {
		t.Fatalf("booked date must be auto-opened with default hours: %+v", wd)
	}
	if wd, ok := byDate[alreadyOpen]; !ok || !wd.Custom || wd.Intervals[0].StartTime != "11:00" {
		t.Fatalf("hand-opened date must keep its custom hours: %+v", wd)
	}
	if _, ok := byDate[wdDay(-3)]; ok {
		t.Fatal("past bookings must not open dates")
	}

	// Saving again while already in dates mode must not auto-open anything new.
	addActiveBooking(t, wdDay(13))
	w = doAdminRequest(t, http.MethodPut, "/api/admin/schedule-settings", body)
	parseJSON(t, w, &resp)
	if w.Code != http.StatusOK || resp.AutoOpened != 0 {
		t.Fatalf("no auto-open expected when mode is unchanged: %d %+v", w.Code, resp)
	}

	// Back to weekly keeps the stored defaults and reports no auto-opening.
	w = doAdminRequest(t, http.MethodPut, "/api/admin/schedule-settings", jsonBody(map[string]interface{}{"scheduleMode": "weekly"}))
	parseJSON(t, w, &resp)
	if w.Code != http.StatusOK || resp.ScheduleMode != "weekly" || resp.AutoOpened != 0 || len(resp.DefaultIntervals) != 1 {
		t.Fatalf("unexpected weekly response: %d %+v", w.Code, resp)
	}
}

func TestAvailabilityInDatesMode(t *testing.T) {
	isolatedRouter(t)
	// A weekly template that must be ignored once dates mode is on.
	setupWorkingHoursAndService(t)
	enterDatesMode(t, "10:00", "12:00")
	open, custom, closed := wdDay(14), wdDay(15), wdDay(16)

	if res := putWorkDates(t, []map[string]interface{}{
		{"date": open},
		{"date": custom, "intervals": []map[string]string{{"startTime": "14:00", "endTime": "16:00"}}},
	}, nil); res.Code != http.StatusOK {
		t.Fatalf("open dates: %d %s", res.Code, res.Body)
	}

	slotTimes := func(date string) []string {
		t.Helper()
		w := doClientRequest(t, http.MethodGet, "/api/availability?date="+date+"&duration=60", nil, 777002)
		if w.Code != http.StatusOK {
			t.Fatalf("availability %s: %d %s", date, w.Code, w.Body.String())
		}
		var slots []struct {
			Time string `json:"time"`
		}
		parseJSON(t, w, &slots)
		times := make([]string, 0, len(slots))
		for _, s := range slots {
			times = append(times, s.Time)
		}
		return times
	}

	if got := slotTimes(closed); len(got) != 0 {
		t.Fatalf("closed date must have no slots (weekly template ignored), got %v", got)
	}
	if got := slotTimes(open); strings.Join(got, ",") != "10:00,11:00" {
		t.Fatalf("open date should use default hours, got %v", got)
	}
	if got := slotTimes(custom); strings.Join(got, ",") != "14:00,15:00" {
		t.Fatalf("custom date should use its own hours, got %v", got)
	}
}

func TestRecurringPreviewInDatesModeSkipsClosedDates(t *testing.T) {
	isolatedRouter(t)
	setupWorkingHoursAndService(t)
	enterDatesMode(t, "09:00", "18:00")

	services, err := db.GetSessionTypesBySpecialistID(testSpecialist.ID)
	if err != nil || len(services) == 0 {
		t.Fatalf("no services: %v", err)
	}

	// Pick the weekday of tomorrow+1 and open only that single occurrence.
	target := wdDay(2)
	day, _ := time.Parse("2006-01-02", target)
	if res := putWorkDates(t, []map[string]interface{}{{"date": target}}, nil); res.Code != http.StatusOK {
		t.Fatalf("open: %d %s", res.Code, res.Body)
	}

	w := doAdminRequest(t, http.MethodPost, "/api/admin/recurring/preview", jsonBody(map[string]interface{}{
		"sessionTypeId": services[0].ID,
		"dayTimes":      map[string]string{strconv.Itoa(int(day.Weekday())): "10:00"},
		"period":        "1month",
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("preview: %d %s", w.Code, w.Body.String())
	}
	var preview struct {
		Dates []string `json:"dates"`
	}
	parseJSON(t, w, &preview)
	if len(preview.Dates) != 1 || preview.Dates[0] != target {
		t.Fatalf("preview must only contain the opened date %s, got %v", target, preview.Dates)
	}
}

func TestWeeklyScheduleContextUnchangedShape(t *testing.T) {
	isolatedRouter(t)
	resetWorkDatesState(t)
	w := doAdminRequest(t, http.MethodGet, "/api/admin/schedule-context", nil)
	raw := w.Body.String()
	var ctx adminContextResp
	parseJSON(t, w, &ctx)
	if ctx.ScheduleMode != "weekly" || ctx.WorkDates == nil {
		t.Fatalf("weekly admin context should report mode and a non-null workDates: %+v", ctx)
	}
	if !strings.Contains(raw, `"workDates":[]`) || !strings.Contains(raw, `"workingHours"`) || !strings.Contains(raw, `"defaultIntervals"`) {
		t.Fatalf("unexpected admin context body: %s", raw)
	}

	pw := doClientRequest(t, http.MethodGet, "/api/schedule-context", nil, 777003)
	if !strings.Contains(pw.Body.String(), `"scheduleMode":"weekly"`) || !strings.Contains(pw.Body.String(), `"workDates":[]`) {
		t.Fatalf("unexpected public context body: %s", pw.Body.String())
	}
}

func TestNotificationPrefsIncludeWorkDaysReminder(t *testing.T) {
	isolatedRouter(t)
	t.Cleanup(func() { _ = db.UpdateSpecialistWorkDaysReminderPref(testSpecialist.ID, true) })

	w := doAdminRequest(t, http.MethodGet, "/api/admin/notifications", nil)
	if !strings.Contains(w.Body.String(), `"notifyWorkDaysReminder":true`) {
		t.Fatalf("reminder should default to enabled: %s", w.Body.String())
	}

	w = doAdminRequest(t, http.MethodPut, "/api/admin/notifications", jsonBody(map[string]interface{}{"notifyWorkDaysReminder": false}))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"notifyWorkDaysReminder":false`) {
		t.Fatalf("update failed: %d %s", w.Code, w.Body.String())
	}
	w = doAdminRequest(t, http.MethodGet, "/api/admin/notifications", nil)
	if !strings.Contains(w.Body.String(), `"notifyWorkDaysReminder":false`) {
		t.Fatalf("pref was not persisted: %s", w.Body.String())
	}
	// Other prefs are untouched by a partial update.
	if !strings.Contains(w.Body.String(), `"notifyNewBookings":true`) {
		t.Fatalf("partial update must not clobber other prefs: %s", w.Body.String())
	}
}

/***************************************************************************************************
* previousMondayUTC is the start of the admin calendar window for the UTC test specialist.
***************************************************************************************************/
func previousMondayUTC() time.Time {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	return today.AddDate(0, 0, -((int(today.Weekday())+6)%7)-7)
}

func TestAdminWorkDatesWindowStartsPreviousMonday(t *testing.T) {
	isolatedRouter(t)
	enterDatesMode(t, "10:00", "20:00")

	start := previousMondayUTC()
	before := start.AddDate(0, 0, -1).Format("2006-01-02")
	atStart := start.Format("2006-01-02")
	yesterday := wdDay(-1)
	today, tomorrow := wdDay(0), wdDay(1)

	// Past rows can only exist through the db layer; the API refuses to write them.
	var inputs []db.WorkDateInput
	for _, d := range []string{before, atStart, yesterday, today, tomorrow} {
		day, _ := time.Parse("2006-01-02", d)
		inputs = append(inputs, db.WorkDateInput{Date: day})
	}
	if err := db.SetWorkDates(testSpecialist.ID, inputs, nil); err != nil {
		t.Fatalf("SetWorkDates: %v", err)
	}

	dates := func(list []workDateResp) map[string]bool {
		m := map[string]bool{}
		for _, wd := range list {
			m[wd.Date] = true
		}
		return m
	}

	w := doAdminRequest(t, http.MethodGet, "/api/admin/schedule-context", nil)
	var ctx adminContextResp
	parseJSON(t, w, &ctx)
	got := dates(ctx.WorkDates)
	if got[before] {
		t.Fatalf("%s is before the previous Monday and must not be listed", before)
	}
	for _, d := range []string{atStart, yesterday, today, tomorrow} {
		if !got[d] {
			t.Fatalf("expected %s in admin workDates, got %+v", d, ctx.WorkDates)
		}
	}
	if len(ctx.WorkDates) > 1 && ctx.WorkDates[0].Date > ctx.WorkDates[1].Date {
		t.Fatalf("workDates must be ordered by date: %+v", ctx.WorkDates)
	}

	// The PUT response uses the same window; writing in the past is still refused.
	res := putWorkDates(t, []map[string]interface{}{{"date": wdDay(30)}}, nil)
	if res.Code != http.StatusOK || !strings.Contains(res.Body, atStart) || strings.Contains(res.Body, before) {
		t.Fatalf("PUT response should list from the previous Monday: %d %s", res.Code, res.Body)
	}
	if res := putWorkDates(t, []map[string]interface{}{{"date": yesterday}}, nil); res.Code != http.StatusBadRequest {
		t.Fatalf("past dates must still be rejected, got %d", res.Code)
	}

	// The public context keeps "today onward".
	pw := doClientRequest(t, http.MethodGet, "/api/schedule-context", nil, 777010)
	var pub publicContextResp
	parseJSON(t, pw, &pub)
	pubDates := dates(pub.WorkDates)
	if pubDates[atStart] || pubDates[yesterday] || !pubDates[today] || !pubDates[tomorrow] {
		t.Fatalf("public workDates must start today: %+v", pub.WorkDates)
	}
}

func TestAdminWorkDatesBookingCountsAndBookedDates(t *testing.T) {
	isolatedRouter(t)
	enterDatesMode(t, "10:00", "20:00")

	openDay, closedDay, cancelledOnly := wdDay(40), wdDay(41), wdDay(42)
	windowStart := previousMondayUTC().Format("2006-01-02")
	if res := putWorkDates(t, []map[string]interface{}{{"date": openDay}, {"date": cancelledOnly}}, nil); res.Code != http.StatusOK {
		t.Fatalf("open: %d %s", res.Code, res.Body)
	}

	addActiveBooking(t, openDay)
	addActiveBooking(t, openDay)
	addActiveBooking(t, closedDay) // booked day that is NOT open (e.g. admin booked a closed day)
	addActiveBooking(t, windowStart)
	cancelled := wdDay(42)
	addActiveBooking(t, cancelled)
	if _, err := db.DB.Exec(db.Q(`UPDATE bookings SET status = 'cancelled' WHERE specialist_id = ? AND starts_at >= ? AND starts_at < ?`),
		testSpecialist.ID, mustDay(t, cancelled), mustDay(t, cancelled).AddDate(0, 0, 1)); err != nil {
		t.Fatal(err)
	}

	w := doAdminRequest(t, http.MethodGet, "/api/admin/schedule-context", nil)
	var ctx adminContextResp
	parseJSON(t, w, &ctx)

	counts := map[string]int{}
	for _, wd := range ctx.WorkDates {
		counts[wd.Date] = wd.BookingCount
	}
	if counts[openDay] != 2 {
		t.Fatalf("open day should report bookingCount 2, got %d (%+v)", counts[openDay], ctx.WorkDates)
	}
	if c, ok := counts[cancelledOnly]; !ok || c != 0 {
		t.Fatalf("open day with only a cancelled booking should report 0, got %d (present=%v)", c, ok)
	}
	if _, ok := counts[closedDay]; ok {
		t.Fatalf("closed day must not appear in workDates: %+v", ctx.WorkDates)
	}

	booked := map[string]int{}
	for _, b := range ctx.BookedDates {
		booked[b.Date] = b.BookingCount
	}
	if booked[openDay] != 2 || booked[closedDay] != 1 {
		t.Fatalf("bookedDates must list open and closed booked days: %+v", ctx.BookedDates)
	}
	if booked[windowStart] != 1 {
		t.Fatalf("bookedDates must include the window start day %s: %+v", windowStart, ctx.BookedDates)
	}
	if _, ok := booked[cancelled]; ok {
		t.Fatalf("cancelled bookings must not count: %+v", ctx.BookedDates)
	}
	for i := 1; i < len(ctx.BookedDates); i++ {
		if ctx.BookedDates[i-1].Date >= ctx.BookedDates[i].Date {
			t.Fatalf("bookedDates must be ordered and unique: %+v", ctx.BookedDates)
		}
	}

	// bookingCount is also on the PUT response, but bookedDates is not.
	res := putWorkDates(t, []map[string]interface{}{{"date": openDay}}, nil)
	if res.Code != http.StatusOK || !strings.Contains(res.Body, `"bookingCount":2`) || strings.Contains(res.Body, "bookedDates") {
		t.Fatalf("unexpected PUT response: %d %s", res.Code, res.Body)
	}
}

func mustDay(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := time.Parse("2006-01-02", s)
	if err != nil {
		t.Fatal(err)
	}
	return d
}

/***************************************************************************************************
* Client booking and rescheduling in dates mode: closed date and out-of-hours slots are rejected
* with 400, in-hours slots succeed (the end of the slot may touch the end of the interval), and
* weekly specialists are not gated.
***************************************************************************************************/
func TestClientBookingGatedInDatesMode(t *testing.T) {
	isolatedRouter(t)
	setupWorkingHoursAndService(t) // Mon-Fri 09:00-18:00 weekly template, plus a service
	enterDatesMode(t, "10:00", "12:00")
	openDay, closedDay, moveDay := wdDay(20), wdDay(21), wdDay(23)
	if res := putWorkDates(t, []map[string]interface{}{{"date": openDay}, {"date": moveDay}}, nil); res.Code != http.StatusOK {
		t.Fatalf("open: %d %s", res.Code, res.Body)
	}

	book := func(clientID int64, date, clock string) int {
		t.Helper()
		w := doClientRequest(t, http.MethodPost, "/api/bookings", jsonBody(map[string]interface{}{
			"date": date, "time": clock, "duration": 60, "name": "Gate Client",
		}), clientID)
		if w.Code == http.StatusCreated {
			var created struct {
				ID string `json:"id"`
			}
			parseJSON(t, w, &created)
			t.Cleanup(func() { _, _ = db.DB.Exec(db.Q(`DELETE FROM bookings WHERE id = ?`), created.ID) })
		}
		return w.Code
	}

	if code := book(880001, closedDay, "10:00"); code != http.StatusBadRequest {
		t.Fatalf("closed date: expected 400, got %d", code)
	}
	if code := book(880002, openDay, "13:00"); code != http.StatusBadRequest {
		t.Fatalf("outside hours: expected 400, got %d", code)
	}
	if code := book(880003, openDay, "11:30"); code != http.StatusBadRequest {
		t.Fatalf("slot overrunning the interval end: expected 400, got %d", code)
	}
	if code := book(880004, openDay, "09:00"); code != http.StatusBadRequest {
		t.Fatalf("slot before the interval start: expected 400, got %d", code)
	}
	if code := book(880005, openDay, "11:00"); code != http.StatusCreated {
		t.Fatalf("slot ending exactly at interval end: expected 201, got %d", code)
	}
	if code := book(880006, openDay, "10:00"); code != http.StatusCreated {
		t.Fatalf("inside hours: expected 201, got %d", code)
	}

	// Reschedule of a pending booking (in place).
	w := doClientRequest(t, http.MethodPost, "/api/bookings", jsonBody(map[string]interface{}{
		"date": moveDay, "time": "10:00", "duration": 60, "name": "Mover",
	}), 880007)
	if w.Code != http.StatusCreated {
		t.Fatalf("setup booking: %d %s", w.Code, w.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	parseJSON(t, w, &created)
	t.Cleanup(func() { _, _ = db.DB.Exec(db.Q(`DELETE FROM bookings WHERE id = ?`), created.ID) })

	reschedule := func(date, clock string) int {
		t.Helper()
		return doClientRequest(t, http.MethodPut, "/api/bookings/"+created.ID+"/reschedule",
			jsonBody(map[string]interface{}{"date": date, "time": clock}), 880007).Code
	}
	if code := reschedule(closedDay, "10:00"); code != http.StatusBadRequest {
		t.Fatalf("reschedule to closed date: expected 400, got %d", code)
	}
	if code := reschedule(moveDay, "15:00"); code != http.StatusBadRequest {
		t.Fatalf("reschedule outside hours: expected 400, got %d", code)
	}
	if code := reschedule(moveDay, "11:00"); code != http.StatusOK {
		t.Fatalf("reschedule inside hours: expected 200, got %d", code)
	}

	// Weekly specialists are not gated: the same closed date books fine again.
	resetWorkDatesState(t)
	weeklyDay := wdDay(22)
	if code := book(880008, weeklyDay, "10:00"); code != http.StatusCreated {
		t.Fatalf("weekly mode must stay ungated, got %d", code)
	}
	if code := book(880009, weeklyDay, "23:00"); code != http.StatusCreated {
		t.Fatalf("weekly mode must stay ungated outside hours too, got %d", code)
	}
}
