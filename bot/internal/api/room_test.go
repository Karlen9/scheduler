package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

type roomMemberResp struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Color     string `json:"color"`
	Linked    bool   `json:"linked"`
	IsMe      bool   `json:"isMe"`
	HasInvite bool   `json:"hasInvite"`
}

type roomDayResp struct {
	Date        string `json:"date"`
	MemberID    string `json:"memberId"`
	HasBookings *bool  `json:"hasBookings"`
}

type roomResp struct {
	Room *struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		IsCreator bool   `json:"isCreator"`
	} `json:"room"`
	MeMemberID string           `json:"meMemberId"`
	Members    []roomMemberResp `json:"members"`
	Days       []roomDayResp    `json:"days"`
	Requests   struct {
		Incoming []struct {
			ID           string `json:"id"`
			Date         string `json:"date"`
			FromMemberID string `json:"fromMemberId"`
		} `json:"incoming"`
		Outgoing []struct {
			ID         string `json:"id"`
			Date       string `json:"date"`
			ToMemberID string `json:"toMemberId"`
		} `json:"outgoing"`
	} `json:"requests"`
}

type conflictResp struct {
	Error   string   `json:"error"`
	Message string   `json:"message"`
	Dates   []string `json:"dates"`
}

/***************************************************************************************************
* doAs sends a request as an arbitrary specialist (admin of their own bot).
***************************************************************************************************/
func doAs(t *testing.T, s *models.Specialist, method, path string, body *string) *httptest.ResponseRecorder {
	t.Helper()
	reader := strings.NewReader("")
	if body != nil {
		reader = strings.NewReader(*body)
	}
	req := httptest.NewRequest(method, path, reader)
	req.RemoteAddr = nextTestRemoteAddr()
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Specialist-ID", s.ID)
	req.Header.Set("X-Telegram-Init-Data", buildInitData(s.TelegramUserID, "Room User", s.BotToken))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func getRoomAs(t *testing.T, s *models.Specialist) (*roomResp, string) {
	t.Helper()
	w := doAs(t, s, http.MethodGet, "/api/admin/room", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET room: %d %s", w.Code, w.Body.String())
	}
	raw := w.Body.String()
	var resp roomResp
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("decode room: %v (%s)", err, raw)
	}
	return &resp, raw
}

func memberNamed(r *roomResp, name string) roomMemberResp {
	for _, m := range r.Members {
		if m.Name == name {
			return m
		}
	}
	return roomMemberResp{}
}

func dayOwner(r *roomResp, date string) string {
	for _, d := range r.Days {
		if d.Date == date {
			return d.MemberID
		}
	}
	return ""
}

/***************************************************************************************************
* roomEnv prepares an isolated router, the master bot username and cleanup of every room table plus
* the shared test specialist's schedule. It returns the shared specialist (A) and two more
* specialists (B, C) created for the test.
***************************************************************************************************/
func roomEnv(t *testing.T, tgBase int64) (a, b, c *models.Specialist) {
	t.Helper()
	isolatedRouter(t)
	api.SetMasterBotUsername("testmasterbot")
	cleanup := func() {
		for _, table := range []string{"room_day_requests", "room_days", "room_members", "rooms"} {
			_, _ = db.DB.Exec(`DELETE FROM ` + table)
		}
		resetWorkDatesState(t)
		_, _ = db.DB.Exec(db.Q(`DELETE FROM bookings WHERE client_name LIKE 'RoomGhost%'`))
		api.NotifyRoomDayRequestFunc = nil
		api.NotifyRoomDayRequestResolvedFunc = nil
		api.NotifyRoomDaysClaimedFunc = nil
		api.NotifyRoomMemberRemovedFunc = nil
	}
	cleanup()
	t.Cleanup(cleanup)

	var err error
	b, err = db.CreateSpecialist(tgBase+1, "room-token-b-"+time2s(tgBase), "roombbot"+time2s(tgBase), "Boris", "UTC", 24)
	if err != nil {
		t.Fatal(err)
	}
	c, err = db.CreateSpecialist(tgBase+2, "room-token-c-"+time2s(tgBase), "roomcbot"+time2s(tgBase), "Clara", "UTC", 24)
	if err != nil {
		t.Fatal(err)
	}
	return testSpecialist, b, c
}

func time2s(n int64) string { return strconv.FormatInt(n, 10) }

func createRoomAs(t *testing.T, s *models.Specialist, name string) *roomResp {
	t.Helper()
	w := doAs(t, s, http.MethodPost, "/api/admin/room", jsonBody(map[string]string{"name": name}))
	if w.Code != http.StatusOK {
		t.Fatalf("create room: %d %s", w.Code, w.Body.String())
	}
	var resp roomResp
	parseJSON(t, w, &resp)
	return &resp
}

// joinAs adds an offline member through the API and links the specialist to it like the master bot would.
func joinAs(t *testing.T, owner *models.Specialist, joiner *models.Specialist, name, color string) string {
	t.Helper()
	w := doAs(t, owner, http.MethodPost, "/api/admin/room/members", jsonBody(map[string]interface{}{"name": name, "color": color, "invite": true}))
	if w.Code != http.StatusOK {
		t.Fatalf("add member: %d %s", w.Code, w.Body.String())
	}
	var added struct {
		Member     roomMemberResp `json:"member"`
		InviteLink string         `json:"inviteLink"`
	}
	parseJSON(t, w, &added)
	code := strings.TrimPrefix(added.InviteLink, "https://t.me/testmasterbot?start=room_")
	if _, err := db.JoinRoomByInvite(code, joiner.ID); err != nil {
		t.Fatalf("join: %v", err)
	}
	return added.Member.ID
}

func apiAssign(t *testing.T, s *models.Specialist, assigns ...[2]string) *httptest.ResponseRecorder {
	t.Helper()
	list := make([]map[string]string, 0, len(assigns))
	for _, a := range assigns {
		list = append(list, map[string]string{"date": a[0], "memberId": a[1]})
	}
	return doAs(t, s, http.MethodPut, "/api/admin/room/days", jsonBody(map[string]interface{}{"assign": list}))
}

func TestRoomPayloadAndCreate(t *testing.T) {
	a, _, _ := roomEnv(t, 7700)

	room, raw := getRoomAs(t, a)
	if room.Room != nil || !strings.Contains(raw, `"room":null`) {
		t.Fatalf("no room must answer {room:null}, got %s", raw)
	}

	// An existing work date is claimed on creation.
	d1 := wdDay(10)
	if res := putWorkDates(t, []map[string]interface{}{{"date": d1}}, nil); res.Code != http.StatusOK {
		t.Fatalf("open: %d %s", res.Code, res.Body)
	}
	created := createRoomAs(t, a, "Кабинет на Ленина")
	if created.Room == nil || created.Room.Name != "Кабинет на Ленина" || !created.Room.IsCreator {
		t.Fatalf("unexpected room: %+v", created.Room)
	}
	if len(created.Members) != 1 || !created.Members[0].IsMe || !created.Members[0].Linked || created.Members[0].Color != "green" || created.Members[0].ID != created.MeMemberID {
		t.Fatalf("unexpected members: %+v", created.Members)
	}
	if dayOwner(created, d1) != created.MeMemberID {
		t.Fatalf("existing work date must be claimed: %+v", created.Days)
	}
	if created.Requests.Incoming == nil || created.Requests.Outgoing == nil {
		t.Fatal("request lists must be arrays")
	}

	if w := doAs(t, a, http.MethodPost, "/api/admin/room", jsonBody(map[string]string{"name": "again"})); w.Code != http.StatusConflict {
		t.Fatalf("second room: expected 409, got %d", w.Code)
	}

	// The schedule contexts reflect the switch to dates mode.
	if spec, _ := db.GetSpecialistByID(a.ID); spec.ScheduleMode != "dates" {
		t.Fatal("creating a room must switch the creator to dates mode")
	}

	// Rename.
	if w := doAs(t, a, http.MethodPut, "/api/admin/room", jsonBody(map[string]string{"name": "Новое имя"})); w.Code != http.StatusOK {
		t.Fatalf("rename: %d", w.Code)
	}
	if room, _ := getRoomAs(t, a); room.Room.Name != "Новое имя" {
		t.Fatalf("rename not applied: %+v", room.Room)
	}
}

func TestRoomWindowStartsPreviousMonday(t *testing.T) {
	a, _, _ := roomEnv(t, 7710)
	created := createRoomAs(t, a, "")

	start := previousMondayUTC()
	before, atStart := start.AddDate(0, 0, -1).Format("2006-01-02"), start.Format("2006-01-02")
	for _, d := range []string{before, atStart} {
		if _, err := db.DB.Exec(db.Q(`INSERT INTO room_days (room_id, date, member_id) VALUES (?, ?, ?)`), created.Room.ID, d, created.MeMemberID); err != nil {
			t.Fatal(err)
		}
	}
	room, _ := getRoomAs(t, a)
	if dayOwner(room, before) != "" || dayOwner(room, atStart) == "" {
		t.Fatalf("room days must start at the previous Monday (%s): %+v", atStart, room.Days)
	}
}

func TestRoomMembersCrud(t *testing.T) {
	a, b, _ := roomEnv(t, 7720)
	room := createRoomAs(t, a, "R")

	w := doAs(t, a, http.MethodPost, "/api/admin/room/members", jsonBody(map[string]interface{}{"name": "Аня", "color": "violet", "invite": true}))
	if w.Code != http.StatusOK {
		t.Fatalf("add: %d %s", w.Code, w.Body.String())
	}
	var added struct {
		Member     roomMemberResp `json:"member"`
		InviteLink string         `json:"inviteLink"`
	}
	parseJSON(t, w, &added)
	if added.Member.Linked || added.Member.IsMe || !added.Member.HasInvite || added.Member.Color != "violet" {
		t.Fatalf("unexpected member: %+v", added.Member)
	}
	if !regexp.MustCompile(`^https://t\.me/testmasterbot\?start=room_[0-9a-f]{16}$`).MatchString(added.InviteLink) {
		t.Fatalf("unexpected invite link %q", added.InviteLink)
	}

	// Without an invite there is no link.
	w = doAs(t, a, http.MethodPost, "/api/admin/room/members", jsonBody(map[string]interface{}{"name": "Боря", "color": "orange", "invite": false}))
	if strings.Contains(w.Body.String(), "inviteLink") {
		t.Fatalf("no inviteLink expected: %s", w.Body.String())
	}
	var plain struct {
		Member roomMemberResp `json:"member"`
	}
	parseJSON(t, w, &plain)

	if w := doAs(t, a, http.MethodPost, "/api/admin/room/members", jsonBody(map[string]interface{}{"name": "X", "color": "magenta"})); w.Code != http.StatusBadRequest {
		t.Fatalf("bad color: expected 400, got %d", w.Code)
	}
	if w := doAs(t, a, http.MethodPost, "/api/admin/room/members", jsonBody(map[string]interface{}{"name": "", "color": "blue"})); w.Code != http.StatusBadRequest {
		t.Fatalf("empty name: expected 400, got %d", w.Code)
	}

	// Rename + recolor an offline member; recolor myself; renaming myself or a colleague is forbidden.
	if w := doAs(t, a, http.MethodPut, "/api/admin/room/members/"+plain.Member.ID, jsonBody(map[string]string{"name": "Борис", "color": "teal"})); w.Code != http.StatusOK {
		t.Fatalf("update offline: %d %s", w.Code, w.Body.String())
	}
	if w := doAs(t, a, http.MethodPut, "/api/admin/room/members/"+room.MeMemberID, jsonBody(map[string]string{"color": "blue"})); w.Code != http.StatusOK {
		t.Fatalf("own color: %d %s", w.Code, w.Body.String())
	}
	if w := doAs(t, a, http.MethodPut, "/api/admin/room/members/"+room.MeMemberID, jsonBody(map[string]string{"name": "Новое"})); w.Code != http.StatusForbidden {
		t.Fatalf("renaming a linked member: expected 403, got %d", w.Code)
	}
	bMember := joinAs(t, a, b, "B placeholder", "pink")
	if w := doAs(t, a, http.MethodPut, "/api/admin/room/members/"+bMember, jsonBody(map[string]string{"color": "blue"})); w.Code != http.StatusForbidden {
		t.Fatalf("recoloring a linked colleague: expected 403, got %d", w.Code)
	}
	if w := doAs(t, a, http.MethodPut, "/api/admin/room/members/unknown", jsonBody(map[string]string{"color": "blue"})); w.Code != http.StatusNotFound {
		t.Fatalf("unknown member: expected 404, got %d", w.Code)
	}

	// Invite regeneration: offline OK (and hasInvite), linked forbidden.
	w = doAs(t, a, http.MethodPost, "/api/admin/room/members/"+plain.Member.ID+"/invite", nil)
	var inv struct {
		InviteLink string `json:"inviteLink"`
	}
	parseJSON(t, w, &inv)
	if w.Code != http.StatusOK || inv.InviteLink == "" {
		t.Fatalf("invite: %d %+v", w.Code, inv)
	}
	if w := doAs(t, a, http.MethodPost, "/api/admin/room/members/"+bMember+"/invite", nil); w.Code != http.StatusForbidden {
		t.Fatalf("invite for a linked member: expected 403, got %d", w.Code)
	}
	state, _ := getRoomAs(t, a)
	if m := memberNamed(state, "Борис"); !m.HasInvite || m.Color != "teal" || m.Linked {
		t.Fatalf("unexpected offline member state: %+v", m)
	}

	// Max 6 members: A, Аня, Борис, B -> two more fit.
	for _, color := range []string{"green", "blue"} {
		if w := doAs(t, a, http.MethodPost, "/api/admin/room/members", jsonBody(map[string]interface{}{"name": "Extra " + color, "color": color})); w.Code != http.StatusOK {
			t.Fatalf("member should fit: %d", w.Code)
		}
	}
	if w := doAs(t, a, http.MethodPost, "/api/admin/room/members", jsonBody(map[string]interface{}{"name": "Seventh", "color": "pink"})); w.Code != http.StatusConflict {
		t.Fatalf("7th member: expected 409, got %d", w.Code)
	}

	// Specialists outside the room get 404/403 on room endpoints.
	outsider := doAs(t, getSpecialist(t, "outsider", 7729), http.MethodPost, "/api/admin/room/members", jsonBody(map[string]interface{}{"name": "X", "color": "blue"}))
	if outsider.Code != http.StatusNotFound {
		t.Fatalf("no room: expected 404, got %d", outsider.Code)
	}
}

func getSpecialist(t *testing.T, name string, tg int64) *models.Specialist {
	t.Helper()
	s, err := db.GetSpecialistByTelegramID(tg)
	if err != nil {
		t.Fatal(err)
	}
	if s != nil {
		return s
	}
	s, err = db.CreateSpecialist(tg, "room-token-"+name, "room"+name+"bot", name, "UTC", 24)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestRoomAssignDaysFlow(t *testing.T) {
	a, b, _ := roomEnv(t, 7730)
	room := createRoomAs(t, a, "R")
	offlineID := ""
	{
		w := doAs(t, a, http.MethodPost, "/api/admin/room/members", jsonBody(map[string]interface{}{"name": "Dasha", "color": "orange"}))
		var added struct {
			Member roomMemberResp `json:"member"`
		}
		parseJSON(t, w, &added)
		offlineID = added.Member.ID
	}
	bMember := joinAs(t, a, b, "Bplaceholder", "violet")

	var claimed [][]string
	api.NotifyRoomDaysClaimedFunc = func(roomID, actor string, dates []string) error {
		if roomID != room.Room.ID {
			t.Errorf("unexpected claim notification room=%s", roomID)
		}
		if actor == a.ID {
			claimed = append(claimed, dates)
		}
		return nil
	}

	d1, d2, d3, d4 := wdDay(12), wdDay(13), wdDay(14), wdDay(15)
	w := apiAssign(t, a, [2]string{d1, room.MeMemberID}, [2]string{d2, offlineID}, [2]string{d3, room.MeMemberID})
	if w.Code != http.StatusOK {
		t.Fatalf("assign: %d %s", w.Code, w.Body.String())
	}
	var after roomResp
	parseJSON(t, w, &after)
	if dayOwner(&after, d1) != room.MeMemberID || dayOwner(&after, d2) != offlineID {
		t.Fatalf("assignments not applied: %+v", after.Days)
	}
	for _, d := range after.Days {
		switch d.Date {
		case d1, d3:
			if d.HasBookings == nil || *d.HasBookings {
				t.Fatalf("own day %s must report hasBookings=false: %+v", d.Date, d)
			}
		case d2:
			if d.HasBookings != nil {
				t.Fatalf("offline member's day must not carry hasBookings: %+v", d)
			}
		}
	}
	if len(claimed) != 1 || len(claimed[0]) != 2 {
		t.Fatalf("one notification with the two newly claimed free dates expected, got %v", claimed)
	}
	if !hasOpenWorkDate(t, a.ID, d1) || hasOpenWorkDate(t, a.ID, d2) {
		t.Fatal("assignments must open/close the actor's work dates")
	}

	// Bookings show up as hasBookings for own days (and for colleagues' days).
	addActiveBooking(t, d1)
	room2, _ := getRoomAs(t, a)
	for _, d := range room2.Days {
		if d.Date == d1 && (d.HasBookings == nil || !*d.HasBookings) {
			t.Fatalf("own day with a booking must report hasBookings=true: %+v", d)
		}
	}

	// Giving a booked day away -> 409 with dates.
	w = apiAssign(t, a, [2]string{d1, offlineID})
	var conflict conflictResp
	parseJSON(t, w, &conflict)
	if w.Code != http.StatusConflict || conflict.Error != "Error.WorkDateHasBookings" || len(conflict.Dates) != 1 || conflict.Dates[0] != d1 {
		t.Fatalf("expected 409 WorkDateHasBookings, got %d %+v", w.Code, conflict)
	}

	// Colleague's day: B takes d4, then A cannot touch it (409 NotYours) and cannot assign to B (403).
	if res := doAs(t, b, http.MethodPut, "/api/admin/work-dates", jsonBody(map[string]interface{}{"open": []map[string]string{{"date": d4}}})); res.Code != http.StatusOK {
		t.Fatalf("B opens a day: %d %s", res.Code, res.Body.String())
	}
	w = apiAssign(t, a, [2]string{d4, ""})
	parseJSON(t, w, &conflict)
	if w.Code != http.StatusConflict || conflict.Error != "Error.RoomDayNotYours" || conflict.Dates[0] != d4 {
		t.Fatalf("expected 409 RoomDayNotYours, got %d %+v", w.Code, conflict)
	}
	if w := apiAssign(t, a, [2]string{wdDay(16), bMember}); w.Code != http.StatusForbidden {
		t.Fatalf("assign to linked colleague: expected 403, got %d", w.Code)
	}
	if w := apiAssign(t, a, [2]string{wdDay(-2), room.MeMemberID}); w.Code != http.StatusBadRequest {
		t.Fatalf("past: expected 400, got %d", w.Code)
	}
	if w := apiAssign(t, a, [2]string{"31.12.2030", room.MeMemberID}); w.Code != http.StatusBadRequest {
		t.Fatalf("bad date: expected 400, got %d", w.Code)
	}
	// Outsiders and non-members cannot assign.
	outsider := getSpecialist(t, "assignoutsider", 7739)
	if w := apiAssign(t, outsider, [2]string{wdDay(16), room.MeMemberID}); w.Code != http.StatusNotFound {
		t.Fatalf("outsider: expected 404, got %d", w.Code)
	}

	// Round A endpoint: opening a colleague's day -> 409 RoomDayTaken with dates.
	res := putWorkDates(t, []map[string]interface{}{{"date": d4}}, nil)
	if res.Code != http.StatusConflict || !strings.Contains(res.Body, "Error.RoomDayTaken") || !strings.Contains(res.Body, d4) {
		t.Fatalf("work-dates on a colleague's day: expected 409 RoomDayTaken, got %d %s", res.Code, res.Body)
	}
	// ...and opening a free day claims it and notifies.
	claimed = nil
	free := wdDay(17)
	if res := putWorkDates(t, []map[string]interface{}{{"date": free}}, nil); res.Code != http.StatusOK {
		t.Fatalf("open free day: %d %s", res.Code, res.Body)
	}
	if len(claimed) != 1 || claimed[0][0] != free {
		t.Fatalf("free day claim must notify once, got %v", claimed)
	}
	room3, _ := getRoomAs(t, a)
	if dayOwner(room3, free) != room.MeMemberID {
		t.Fatal("opening a work date must claim it in the room")
	}
}

func hasOpenWorkDate(t *testing.T, specialistID, date string) bool {
	t.Helper()
	day, _ := time.Parse("2006-01-02", date)
	rows, err := db.GetWorkDates(specialistID, day)
	if err != nil {
		t.Fatal(err)
	}
	return len(rows) > 0 && rows[0].Date.Format("2006-01-02") == date
}

func TestRoomDayRequestsFlow(t *testing.T) {
	a, b, c := roomEnv(t, 7740)
	room := createRoomAs(t, a, "R")
	bMember := joinAs(t, a, b, "Bplaceholder", "violet")
	cMember := joinAs(t, a, c, "Cplaceholder", "teal")

	day := wdDay(20)
	if w := apiAssign(t, a, [2]string{day, room.MeMemberID}); w.Code != http.StatusOK {
		t.Fatalf("assign: %d", w.Code)
	}

	var requested, resolved []string
	api.NotifyRoomDayRequestFunc = func(r *models.RoomDayRequest) error {
		requested = append(requested, r.ID)
		return nil
	}
	api.NotifyRoomDayRequestResolvedFunc = func(r *models.RoomDayRequest, accepted bool) error {
		if accepted {
			resolved = append(resolved, r.ID+":yes")
		} else {
			resolved = append(resolved, r.ID+":no")
		}
		return nil
	}

	// B and C ask for A's day.
	reqB := doAs(t, b, http.MethodPost, "/api/admin/room/requests", jsonBody(map[string]string{"date": day}))
	if reqB.Code != http.StatusOK {
		t.Fatalf("request: %d %s", reqB.Code, reqB.Body.String())
	}
	var bView roomResp
	parseJSON(t, reqB, &bView)
	if len(bView.Requests.Outgoing) != 1 || bView.Requests.Outgoing[0].Date != day {
		t.Fatalf("outgoing request missing: %+v", bView.Requests)
	}
	// A repeated request neither duplicates nor notifies again.
	doAs(t, b, http.MethodPost, "/api/admin/room/requests", jsonBody(map[string]string{"date": day}))
	if reqC := doAs(t, c, http.MethodPost, "/api/admin/room/requests", jsonBody(map[string]string{"date": day})); reqC.Code != http.StatusOK {
		t.Fatalf("C request: %d", reqC.Code)
	}
	if len(requested) != 2 {
		t.Fatalf("expected 2 owner notifications (duplicate suppressed), got %d", len(requested))
	}
	aView, _ := getRoomAs(t, a)
	if len(aView.Requests.Incoming) != 2 || aView.Requests.Incoming[0].FromMemberID != bMember || len(aView.Requests.Outgoing) != 0 {
		t.Fatalf("A's incoming requests unexpected: %+v", aView.Requests)
	}
	bID, cID := bView.Requests.Outgoing[0].ID, aView.Requests.Incoming[1].ID

	// Invalid requests: own day, free day, past day, bad date.
	if w := doAs(t, a, http.MethodPost, "/api/admin/room/requests", jsonBody(map[string]string{"date": day})); w.Code != http.StatusBadRequest {
		t.Fatalf("own day: expected 400, got %d", w.Code)
	}
	if w := doAs(t, b, http.MethodPost, "/api/admin/room/requests", jsonBody(map[string]string{"date": wdDay(25)})); w.Code != http.StatusBadRequest {
		t.Fatalf("free day: expected 400, got %d", w.Code)
	}
	if w := doAs(t, b, http.MethodPost, "/api/admin/room/requests", jsonBody(map[string]string{"date": wdDay(-3)})); w.Code != http.StatusBadRequest {
		t.Fatalf("past day: expected 400, got %d", w.Code)
	}
	if w := doAs(t, b, http.MethodPost, "/api/admin/room/requests", jsonBody(map[string]string{"date": "nope"})); w.Code != http.StatusBadRequest {
		t.Fatalf("bad date: expected 400, got %d", w.Code)
	}

	// Only the owner resolves: B cannot accept their own request.
	if w := doAs(t, b, http.MethodPost, "/api/admin/room/requests/"+bID+"/accept", nil); w.Code != http.StatusForbidden {
		t.Fatalf("requester accepting: expected 403, got %d", w.Code)
	}
	if w := doAs(t, a, http.MethodPost, "/api/admin/room/requests/missing/accept", nil); w.Code != http.StatusNotFound {
		t.Fatalf("unknown request: expected 404, got %d", w.Code)
	}

	// Bookings block accepting (409 + dates), request stays pending.
	addActiveBooking(t, day)
	w := doAs(t, a, http.MethodPost, "/api/admin/room/requests/"+bID+"/accept", nil)
	var conflict conflictResp
	parseJSON(t, w, &conflict)
	if w.Code != http.StatusConflict || conflict.Error != "Error.WorkDateHasBookings" || conflict.Dates[0] != day {
		t.Fatalf("accept with bookings: expected 409, got %d %+v", w.Code, conflict)
	}
	if _, err := db.DB.Exec(db.Q(`UPDATE bookings SET status = 'cancelled' WHERE specialist_id = ?`), a.ID); err != nil {
		t.Fatal(err)
	}

	// Accept: transfers, cancels C's competing request, notifies the requester.
	w = doAs(t, a, http.MethodPost, "/api/admin/room/requests/"+bID+"/accept", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("accept: %d %s", w.Code, w.Body.String())
	}
	var afterAccept roomResp
	parseJSON(t, w, &afterAccept)
	if dayOwner(&afterAccept, day) != bMember || len(afterAccept.Requests.Incoming) != 0 {
		t.Fatalf("accept must transfer the day and clear requests: %+v", afterAccept)
	}
	if len(resolved) != 1 || resolved[0] != bID+":yes" {
		t.Fatalf("requester must be notified once, got %v", resolved)
	}
	if got, _ := db.GetRoomDayRequest(cID); got.Status != models.RoomRequestCancelled {
		t.Fatalf("competing request must be cancelled, got %s", got.Status)
	}
	if !hasOpenWorkDate(t, b.ID, day) || hasOpenWorkDate(t, a.ID, day) {
		t.Fatal("work dates must move with the day")
	}
	_ = cMember

	// Decline and cancel paths.
	day2 := wdDay(21)
	if w := apiAssign(t, a, [2]string{day2, room.MeMemberID}); w.Code != http.StatusOK {
		t.Fatalf("assign: %d", w.Code)
	}
	resolved = nil
	doAs(t, c, http.MethodPost, "/api/admin/room/requests", jsonBody(map[string]string{"date": day2}))
	inc, _ := getRoomAs(t, a)
	declineID := inc.Requests.Incoming[0].ID
	if w := doAs(t, a, http.MethodPost, "/api/admin/room/requests/"+declineID+"/decline", nil); w.Code != http.StatusOK {
		t.Fatalf("decline: %d", w.Code)
	}
	if len(resolved) != 1 || resolved[0] != declineID+":no" {
		t.Fatalf("decline must notify the requester, got %v", resolved)
	}
	if owner := dayOwner(mustRoom(t, a), day2); owner != room.MeMemberID {
		t.Fatal("a declined request must keep ownership")
	}

	doAs(t, c, http.MethodPost, "/api/admin/room/requests", jsonBody(map[string]string{"date": day2}))
	cView, _ := getRoomAs(t, c)
	cancelID := cView.Requests.Outgoing[0].ID
	if w := doAs(t, a, http.MethodDelete, "/api/admin/room/requests/"+cancelID, nil); w.Code != http.StatusForbidden {
		t.Fatalf("cancel by the owner: expected 403, got %d", w.Code)
	}
	if w := doAs(t, c, http.MethodDelete, "/api/admin/room/requests/"+cancelID, nil); w.Code != http.StatusOK {
		t.Fatalf("cancel by the requester: expected 200, got %d", w.Code)
	}
	if after, _ := getRoomAs(t, a); len(after.Requests.Incoming) != 0 {
		t.Fatalf("cancelled request must disappear: %+v", after.Requests)
	}
}

func mustRoom(t *testing.T, s *models.Specialist) *roomResp {
	t.Helper()
	r, _ := getRoomAs(t, s)
	return r
}

func TestRoomRemoveAndLeave(t *testing.T) {
	a, b, _ := roomEnv(t, 7750)
	room := createRoomAs(t, a, "R")
	bMember := joinAs(t, a, b, "Bplaceholder", "violet")
	w := doAs(t, a, http.MethodPost, "/api/admin/room/members", jsonBody(map[string]interface{}{"name": "Off", "color": "pink"}))
	var added struct {
		Member roomMemberResp `json:"member"`
	}
	parseJSON(t, w, &added)

	var removedNotes []string
	api.NotifyRoomMemberRemovedFunc = func(roomName, removedSpecialistID string) error {
		removedNotes = append(removedNotes, roomName+"|"+removedSpecialistID)
		return nil
	}

	// A non-creator cannot exclude the creator.
	if w := doAs(t, b, http.MethodDelete, "/api/admin/room/members/"+room.MeMemberID, nil); w.Code != http.StatusForbidden {
		t.Fatalf("non-creator exclusion: expected 403, got %d", w.Code)
	}
	// Offline member removal.
	if w := doAs(t, a, http.MethodDelete, "/api/admin/room/members/"+added.Member.ID, nil); w.Code != http.StatusOK {
		t.Fatalf("remove offline: %d", w.Code)
	}
	if len(removedNotes) != 0 {
		t.Fatalf("offline removal must not notify: %v", removedNotes)
	}
	// Creator excludes B: B is notified, and B's room becomes null.
	w = doAs(t, a, http.MethodDelete, "/api/admin/room/members/"+bMember, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("exclude B: %d %s", w.Code, w.Body.String())
	}
	if len(removedNotes) != 1 || removedNotes[0] != "R|"+b.ID {
		t.Fatalf("excluded member must be notified, got %v", removedNotes)
	}
	if _, raw := getRoomAs(t, b); !strings.Contains(raw, `"room":null`) {
		t.Fatalf("B must be out of the room: %s", raw)
	}
	// Leaving as the last member deletes the room and answers {room:null}.
	w = doAs(t, a, http.MethodDelete, "/api/admin/room/members/"+room.MeMemberID, nil)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"room":null`) {
		t.Fatalf("leave: %d %s", w.Code, w.Body.String())
	}
	if len(removedNotes) != 1 {
		t.Fatalf("leaving yourself must not notify: %v", removedNotes)
	}
	if r, _ := db.GetRoomByID(room.Room.ID); r != nil {
		t.Fatal("room must be deleted")
	}
	if w := doAs(t, a, http.MethodDelete, "/api/admin/room/members/"+room.MeMemberID, nil); w.Code != http.StatusNotFound {
		t.Fatalf("leaving again: expected 404, got %d", w.Code)
	}
}

func TestRoomMemberCannotSwitchToWeeklyMode(t *testing.T) {
	a, b, _ := roomEnv(t, 7760)

	weekly := func(s *models.Specialist) *httptest.ResponseRecorder {
		return doAs(t, s, http.MethodPut, "/api/admin/schedule-settings", jsonBody(map[string]interface{}{"scheduleMode": "weekly"}))
	}

	// A solo specialist can still switch freely.
	if w := weekly(b); w.Code != http.StatusOK {
		t.Fatalf("solo specialist weekly switch: expected 200, got %d %s", w.Code, w.Body.String())
	}

	room := createRoomAs(t, a, "R")
	joinAs(t, a, b, "Bplaceholder", "violet")

	for _, s := range []*models.Specialist{a, b} {
		w := weekly(s)
		if w.Code != http.StatusConflict || !strings.Contains(w.Body.String(), "кабинет") {
			t.Fatalf("room member weekly switch: expected 409 with the room message, got %d %s", w.Code, w.Body.String())
		}
		if got, _ := db.GetSpecialistByID(s.ID); got.ScheduleMode != "dates" {
			t.Fatalf("a refused switch must leave dates mode intact, got %q", got.ScheduleMode)
		}
	}
	// Staying in dates mode (e.g. saving new default hours) works for room members.
	w := doAs(t, a, http.MethodPut, "/api/admin/schedule-settings", jsonBody(map[string]interface{}{
		"scheduleMode": "dates", "defaultIntervals": []map[string]string{{"startTime": "09:00", "endTime": "18:00"}},
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("dates-mode settings for a room member: expected 200, got %d %s", w.Code, w.Body.String())
	}
	// The weekly-hours PUT keeps working (stored but inert).
	hours := jsonBody(map[string]interface{}{"hours": []map[string]interface{}{{"dayOfWeek": 1, "startTime": "09:00", "endTime": "12:00"}}})
	if w := doAs(t, a, http.MethodPut, "/api/admin/working-hours", hours); w.Code != http.StatusOK {
		t.Fatalf("working-hours PUT: expected 200, got %d", w.Code)
	}

	// After leaving the room the switch works again.
	if w := doAs(t, b, http.MethodDelete, "/api/admin/room/members/"+mustRoom(t, b).MeMemberID, nil); w.Code != http.StatusOK {
		t.Fatalf("leave: %d", w.Code)
	}
	if w := weekly(b); w.Code != http.StatusOK {
		t.Fatalf("weekly switch after leaving: expected 200, got %d %s", w.Code, w.Body.String())
	}
	_ = room
}
