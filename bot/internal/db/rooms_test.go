package db

import (
	"errors"
	"testing"
	"time"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Test helpers. All dates live in 2030 so they are always "upcoming" for the UTC test specialists.
***************************************************************************************************/
type roomFixture struct {
	A, B, C  *models.Specialist
	RoomID   string
	MemberA  string
	MemberB  string
	Offline  *models.RoomMember
	invCount int
}

func newSpecialistForRoom(t *testing.T, tgID int64, name string) *models.Specialist {
	t.Helper()
	s, err := CreateSpecialist(tgID, "token-room-"+name, "room"+name+"bot", name, "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist(%s): %v", name, err)
	}
	return s
}

func rd(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := time.Parse("2006-01-02", s)
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func openDates(t *testing.T, specialistID string, dates ...string) error {
	t.Helper()
	var in []WorkDateInput
	for _, d := range dates {
		in = append(in, WorkDateInput{Date: rd(t, d)})
	}
	return SetWorkDates(specialistID, in, nil)
}

func closeDates(t *testing.T, specialistID string, dates ...string) error {
	t.Helper()
	var out []time.Time
	for _, d := range dates {
		out = append(out, rd(t, d))
	}
	return SetWorkDates(specialistID, nil, out)
}

func ownerOf(t *testing.T, roomID, date string) string {
	t.Helper()
	owner, err := txRoomOwner(DB, roomID, date)
	if err != nil {
		t.Fatal(err)
	}
	return owner
}

func hasWorkDate(t *testing.T, specialistID, date string) bool {
	t.Helper()
	dates, err := GetWorkDates(specialistID, rd(t, "2030-01-01"))
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range dates {
		if d.Date.Format("2006-01-02") == date {
			return true
		}
	}
	return false
}

func addBooking(t *testing.T, specialistID, date string) {
	t.Helper()
	client, err := CreateGhostClient(specialistID, "Ghost "+date)
	if err != nil {
		t.Fatal(err)
	}
	service, err := CreateSessionType(specialistID, "common", "S", 60, 0, "RUB", "")
	if err != nil {
		t.Fatal(err)
	}
	start := rd(t, date).Add(10 * time.Hour)
	if _, err := CreateBooking(specialistID, client.ID, service.ID, start, start.Add(time.Hour), "Ghost", "", 60); err != nil {
		t.Fatal(err)
	}
}

// newRoomFixture creates A (room creator) and B (joined via the invite of an offline member), plus
// an unrelated specialist C and an extra offline member.
func newRoomFixture(t *testing.T) *roomFixture {
	t.Helper()
	setupStatsTestDB(t)
	f := &roomFixture{
		A: newSpecialistForRoom(t, 9101, "Anna"),
		B: newSpecialistForRoom(t, 9102, "Boris"),
		C: newSpecialistForRoom(t, 9103, "Clara"),
	}
	room, err := CreateRoom(f.A.ID, "Lenina")
	if err != nil {
		t.Fatalf("CreateRoom: %v", err)
	}
	f.RoomID = room.ID
	viewA, _ := GetRoomForSpecialist(f.A.ID)
	f.MemberA = viewA.MeMember.ID

	invitee, err := AddOfflineMember(room.ID, "Boris offline", "violet", true)
	if err != nil {
		t.Fatalf("AddOfflineMember: %v", err)
	}
	if _, err := JoinRoomByInvite(invitee.InviteCode, f.B.ID); err != nil {
		t.Fatalf("JoinRoomByInvite: %v", err)
	}
	f.MemberB = invitee.ID

	f.Offline, err = AddOfflineMember(room.ID, "Dasha", "orange", false)
	if err != nil {
		t.Fatalf("AddOfflineMember: %v", err)
	}
	return f
}

func TestCreateRoomSwitchesToDatesAndClaimsWorkDates(t *testing.T) {
	setupStatsTestDB(t)
	a := newSpecialistForRoom(t, 9111, "Anna")
	if err := openDates(t, a.ID, "2030-05-06", "2030-05-07"); err != nil {
		t.Fatal(err)
	}

	room, err := CreateRoom(a.ID, "  Lenina ")
	if err != nil {
		t.Fatalf("CreateRoom: %v", err)
	}
	if room.Name != "Lenina" || room.CreatedBy != a.ID {
		t.Fatalf("unexpected room %+v", room)
	}
	reloaded, _ := GetSpecialistByID(a.ID)
	if reloaded.ScheduleMode != "dates" || len(ParseWorkIntervals(reloaded.DefaultIntervals)) != 1 {
		t.Fatalf("creator must be in dates mode with default hours, got %q / %q", reloaded.ScheduleMode, reloaded.DefaultIntervals)
	}
	view, _ := GetRoomForSpecialist(a.ID)
	if view.MeMember.Color != "green" || view.MeMember.Name != "Anna" || !view.MeMember.IsLinked() {
		t.Fatalf("creator member unexpected: %+v", view.MeMember)
	}
	for _, d := range []string{"2030-05-06", "2030-05-07"} {
		if ownerOf(t, room.ID, d) != view.MeMember.ID {
			t.Fatalf("existing work date %s must be claimed in the room", d)
		}
	}
	if _, err := CreateRoom(a.ID, ""); !errors.Is(err, ErrAlreadyInRoom) {
		t.Fatalf("second room: expected ErrAlreadyInRoom, got %v", err)
	}
}

func TestSetWorkDatesRoomInvariant(t *testing.T) {
	f := newRoomFixture(t)

	if err := openDates(t, f.A.ID, "2030-06-03"); err != nil {
		t.Fatal(err)
	}
	if ownerOf(t, f.RoomID, "2030-06-03") != f.MemberA {
		t.Fatal("opening a date must claim it in the room")
	}

	// B cannot open a date A owns, and nothing else of that request is applied.
	err := openDates(t, f.B.ID, "2030-06-04", "2030-06-03")
	var taken *ErrRoomDayTaken
	if !errors.As(err, &taken) || len(taken.Dates) != 1 || taken.Dates[0] != "2030-06-03" {
		t.Fatalf("expected ErrRoomDayTaken for 2030-06-03, got %v", err)
	}
	if hasWorkDate(t, f.B.ID, "2030-06-04") || ownerOf(t, f.RoomID, "2030-06-04") != "" {
		t.Fatal("a conflicting save must change nothing")
	}

	// Offline-owned dates are protected too.
	if _, err := AssignRoomDays(f.A.ID, []RoomDayAssign{{Date: rd(t, "2030-06-05"), MemberID: f.Offline.ID}}); err != nil {
		t.Fatal(err)
	}
	if err := openDates(t, f.B.ID, "2030-06-05"); !errors.As(err, &taken) {
		t.Fatalf("offline-owned date must be protected, got %v", err)
	}

	// Updating only the intervals of an already-owned date works and keeps ownership.
	if err := SetWorkDates(f.A.ID, []WorkDateInput{{Date: rd(t, "2030-06-03"), Intervals: `[{"startTime":"12:00","endTime":"14:00"}]`}}, nil); err != nil {
		t.Fatalf("interval update: %v", err)
	}
	if ownerOf(t, f.RoomID, "2030-06-03") != f.MemberA {
		t.Fatal("interval update must not change ownership")
	}

	// Closing releases the date (and cancels pending requests for it).
	req, _, err := CreateDayRequest(f.B.ID, rd(t, "2030-06-03"))
	if err != nil {
		t.Fatal(err)
	}
	if err := closeDates(t, f.A.ID, "2030-06-03"); err != nil {
		t.Fatal(err)
	}
	if ownerOf(t, f.RoomID, "2030-06-03") != "" {
		t.Fatal("closing must release the room day")
	}
	if got, _ := GetRoomDayRequest(req.ID); got.Status != models.RoomRequestCancelled {
		t.Fatalf("pending request must be cancelled when the owner closes the date, got %s", got.Status)
	}
	if err := openDates(t, f.B.ID, "2030-06-03"); err != nil {
		t.Fatalf("released date must be claimable: %v", err)
	}
}

func TestSetWorkDatesOutsideRoomIsUnchanged(t *testing.T) {
	setupStatsTestDB(t)
	c := newSpecialistForRoom(t, 9121, "Solo")
	if err := openDates(t, c.ID, "2030-07-01"); err != nil {
		t.Fatal(err)
	}
	if err := openDates(t, c.ID, "2030-07-01"); err != nil {
		t.Fatalf("re-opening must stay idempotent: %v", err)
	}
	if err := closeDates(t, c.ID, "2030-07-01"); err != nil || hasWorkDate(t, c.ID, "2030-07-01") {
		t.Fatalf("solo close failed: %v", err)
	}
}

func TestAssignRoomDaysRules(t *testing.T) {
	f := newRoomFixture(t)
	assign := func(actor string, member string, dates ...string) (*RoomDayAssignResult, error) {
		var as []RoomDayAssign
		for _, d := range dates {
			as = append(as, RoomDayAssign{Date: rd(t, d), MemberID: member})
		}
		return AssignRoomDays(actor, as)
	}

	// Claim free days: actor's work dates appear, ClaimedFree lists them.
	res, err := assign(f.A.ID, f.MemberA, "2030-08-05", "2030-08-06")
	if err != nil {
		t.Fatal(err)
	}
	if len(res.ClaimedFree) != 2 || !hasWorkDate(t, f.A.ID, "2030-08-05") || ownerOf(t, f.RoomID, "2030-08-06") != f.MemberA {
		t.Fatalf("claim failed: %+v", res)
	}

	// Give to an offline member: actor's work date disappears.
	if _, err := assign(f.A.ID, f.Offline.ID, "2030-08-06"); err != nil {
		t.Fatal(err)
	}
	if hasWorkDate(t, f.A.ID, "2030-08-06") || ownerOf(t, f.RoomID, "2030-08-06") != f.Offline.ID {
		t.Fatal("giving a day to an offline member must close it for the actor")
	}

	// Taking an offline-owned day is allowed but is not "newly free".
	res, err = assign(f.A.ID, f.MemberA, "2030-08-06")
	if err != nil || len(res.ClaimedFree) != 0 || !hasWorkDate(t, f.A.ID, "2030-08-06") {
		t.Fatalf("taking an offline day: %+v err=%v", res, err)
	}

	// Free a day.
	if _, err := assign(f.A.ID, "", "2030-08-06"); err != nil || ownerOf(t, f.RoomID, "2030-08-06") != "" || hasWorkDate(t, f.A.ID, "2030-08-06") {
		t.Fatalf("freeing a day failed: %v", err)
	}

	// Assigning to another LINKED member is forbidden.
	if _, err := assign(f.A.ID, f.MemberB, "2030-08-07"); !errors.Is(err, ErrRoomForbidden) {
		t.Fatalf("assign to linked colleague: expected ErrRoomForbidden, got %v", err)
	}
	// A member of no room / unknown member is forbidden too.
	if _, err := assign(f.A.ID, "no-such-member", "2030-08-07"); !errors.Is(err, ErrRoomForbidden) {
		t.Fatalf("unknown member: expected ErrRoomForbidden, got %v", err)
	}
	if _, err := assign(f.C.ID, f.MemberA, "2030-08-07"); !errors.Is(err, ErrRoomForbidden) {
		t.Fatalf("non-member actor: expected ErrRoomForbidden, got %v", err)
	}

	// A day owned by B is off limits for A (take or free), and the whole call is rejected.
	if err := openDates(t, f.B.ID, "2030-08-12"); err != nil {
		t.Fatal(err)
	}
	_, err = AssignRoomDays(f.A.ID, []RoomDayAssign{
		{Date: rd(t, "2030-08-13"), MemberID: f.MemberA},
		{Date: rd(t, "2030-08-12"), MemberID: ""},
	})
	var notYours *ErrRoomDayNotYours
	if !errors.As(err, &notYours) || notYours.Dates[0] != "2030-08-12" {
		t.Fatalf("expected ErrRoomDayNotYours, got %v", err)
	}
	if ownerOf(t, f.RoomID, "2030-08-13") != "" || hasWorkDate(t, f.A.ID, "2030-08-13") {
		t.Fatal("all-or-nothing violated: the valid entry was applied")
	}
	if ownerOf(t, f.RoomID, "2030-08-12") != f.MemberB {
		t.Fatal("B's day must stay with B")
	}

	// Moving a day away from the actor with bookings is refused.
	if _, err := assign(f.A.ID, f.MemberA, "2030-08-19"); err != nil {
		t.Fatal(err)
	}
	addBooking(t, f.A.ID, "2030-08-19")
	_, err = assign(f.A.ID, f.Offline.ID, "2030-08-19")
	var withBookings *ErrWorkDateHasBookings
	if !errors.As(err, &withBookings) || withBookings.Dates[0] != "2030-08-19" {
		t.Fatalf("expected ErrWorkDateHasBookings, got %v", err)
	}
	if ownerOf(t, f.RoomID, "2030-08-19") != f.MemberA {
		t.Fatal("a refused give-away must keep ownership")
	}

	// Past dates are rejected.
	if _, err := AssignRoomDays(f.A.ID, []RoomDayAssign{{Date: rd(t, "2020-01-01"), MemberID: f.MemberA}}); !errors.Is(err, ErrRoomDayPast) {
		t.Fatalf("expected ErrRoomDayPast, got %v", err)
	}

	// Ownership changes cancel pending requests for the date.
	if _, err := assign(f.A.ID, f.MemberA, "2030-08-20"); err != nil {
		t.Fatal(err)
	}
	pending, _, err := CreateDayRequest(f.B.ID, rd(t, "2030-08-20"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := assign(f.A.ID, f.Offline.ID, "2030-08-20"); err != nil {
		t.Fatal(err)
	}
	if got, _ := GetRoomDayRequest(pending.ID); got.Status != models.RoomRequestCancelled {
		t.Fatalf("request must be cancelled after the date changed owner, got %s", got.Status)
	}
}

func TestRoomDayPrimaryKeyIsTheRaceGuard(t *testing.T) {
	f := newRoomFixture(t)

	tx, err := DB.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback() }()
	if err := txClaimFreeRoomDay(tx, f.RoomID, "2030-09-02", f.MemberA); err != nil {
		t.Fatal(err)
	}
	// A second claim of the same (room, date) - as a concurrent writer would issue it - must fail
	// with ErrRoomDayTaken rather than create a second owner.
	err = txClaimFreeRoomDay(tx, f.RoomID, "2030-09-02", f.MemberB)
	var taken *ErrRoomDayTaken
	if !errors.As(err, &taken) || taken.Dates[0] != "2030-09-02" {
		t.Fatalf("expected ErrRoomDayTaken from the primary key, got %v", err)
	}
}

func TestJoinRoomByInviteCarryOverAndConflicts(t *testing.T) {
	setupStatsTestDB(t)
	a := newSpecialistForRoom(t, 9131, "Anna")
	b := newSpecialistForRoom(t, 9132, "Boris")
	room, err := CreateRoom(a.ID, "R")
	if err != nil {
		t.Fatal(err)
	}
	viewA, _ := GetRoomForSpecialist(a.ID)
	offline, _ := AddOfflineMember(room.ID, "Boris", "blue", true)

	// Offline days to carry over; A's own day; B's own days: one free, one owned by A (no
	// bookings), one owned by A (with bookings).
	if _, err := AssignRoomDays(a.ID, []RoomDayAssign{
		{Date: rd(t, "2030-10-07"), MemberID: offline.ID},
		{Date: rd(t, "2030-10-08"), MemberID: offline.ID},
		{Date: rd(t, "2030-10-09"), MemberID: viewA.MeMember.ID},
		{Date: rd(t, "2030-10-10"), MemberID: viewA.MeMember.ID},
	}); err != nil {
		t.Fatal(err)
	}
	if err := openDates(t, b.ID, "2030-10-11", "2030-10-09", "2030-10-10"); err != nil {
		t.Fatal(err)
	}
	addBooking(t, b.ID, "2030-10-10")

	if _, err := JoinRoomByInvite("does-not-exist", b.ID); !errors.Is(err, ErrInviteInvalid) {
		t.Fatalf("bad code: expected ErrInviteInvalid, got %v", err)
	}
	result, err := JoinRoomByInvite(offline.InviteCode, b.ID)
	if err != nil {
		t.Fatalf("join: %v", err)
	}
	if result.CarriedOver != 2 || result.MemberID != offline.ID {
		t.Fatalf("carry-over unexpected: %+v", result)
	}
	if len(result.Conflicts) != 1 || result.Conflicts[0] != "2030-10-10" {
		t.Fatalf("expected only the booked clash as conflict, got %v", result.Conflicts)
	}
	for _, d := range []string{"2030-10-07", "2030-10-08"} {
		if !hasWorkDate(t, b.ID, d) || ownerOf(t, room.ID, d) != offline.ID {
			t.Fatalf("offline day %s must become B's work date", d)
		}
	}
	if ownerOf(t, room.ID, "2030-10-11") != offline.ID || !hasWorkDate(t, b.ID, "2030-10-11") {
		t.Fatal("B's free work date must be claimed")
	}
	if hasWorkDate(t, b.ID, "2030-10-09") {
		t.Fatal("B's work date owned by A (no bookings) must be dropped")
	}
	if !hasWorkDate(t, b.ID, "2030-10-10") || ownerOf(t, room.ID, "2030-10-10") != viewA.MeMember.ID {
		t.Fatal("B's booked clash must stay open while the room owner stays A")
	}
	reloaded, _ := GetSpecialistByID(b.ID)
	if reloaded.ScheduleMode != "dates" {
		t.Fatal("joining must switch B to dates mode")
	}
	member, _ := GetRoomMemberByID(offline.ID)
	if !member.IsLinked() || member.InviteCode != "" {
		t.Fatalf("member must be linked with the invite cleared: %+v", member)
	}

	// The code is single-use; already-in-room specialists cannot join another room.
	c := newSpecialistForRoom(t, 9133, "Clara")
	if _, err := JoinRoomByInvite(offline.InviteCode, c.ID); !errors.Is(err, ErrInviteInvalid) {
		t.Fatalf("used code: expected ErrInviteInvalid, got %v", err)
	}
	other, _ := CreateRoom(c.ID, "Other")
	spare, _ := AddOfflineMember(room.ID, "Spare", "pink", true)
	if _, err := JoinRoomByInvite(spare.InviteCode, c.ID); !errors.Is(err, ErrAlreadyInRoom) {
		t.Fatalf("already in room: expected ErrAlreadyInRoom, got %v", err)
	}
	_ = other
	if m, _ := GetRoomMemberByID(spare.ID); m.IsLinked() || m.InviteCode == "" {
		t.Fatal("a failed join must leave the invite untouched")
	}
}

func TestJoinOpensDatesThatAlreadyHaveBookings(t *testing.T) {
	setupStatsTestDB(t)
	a := newSpecialistForRoom(t, 9141, "Anna")
	b := newSpecialistForRoom(t, 9142, "Boris")
	room, _ := CreateRoom(a.ID, "R")
	offline, _ := AddOfflineMember(room.ID, "B", "blue", true)

	// B is still in weekly mode with a booking on a closed day: switching must keep the booking open.
	addBooking(t, b.ID, "2030-11-04")
	if _, err := JoinRoomByInvite(offline.InviteCode, b.ID); err != nil {
		t.Fatal(err)
	}
	if !hasWorkDate(t, b.ID, "2030-11-04") || ownerOf(t, room.ID, "2030-11-04") != offline.ID {
		t.Fatal("a booked date must be auto-opened and claimed when the joiner switches to dates mode")
	}
}

func TestRemoveMemberAndLeaveRules(t *testing.T) {
	f := newRoomFixture(t)
	if _, err := AssignRoomDays(f.A.ID, []RoomDayAssign{{Date: rd(t, "2030-12-02"), MemberID: f.Offline.ID}}); err != nil {
		t.Fatal(err)
	}
	if err := openDates(t, f.B.ID, "2030-12-03"); err != nil {
		t.Fatal(err)
	}

	// Offline member removal frees their days.
	res, err := RemoveMember(f.A.ID, f.Offline.ID)
	if err != nil || res.RemovedSpecialistID != "" || res.RoomDeleted {
		t.Fatalf("offline removal: %+v %v", res, err)
	}
	if ownerOf(t, f.RoomID, "2030-12-02") != "" {
		t.Fatal("removed offline member's days must become free")
	}

	// A non-creator cannot remove another linked member; the creator can.
	if _, err := RemoveMember(f.B.ID, f.MemberA); !errors.Is(err, ErrRoomForbidden) {
		t.Fatalf("expected ErrRoomForbidden, got %v", err)
	}
	pending, _, err := CreateDayRequest(f.A.ID, rd(t, "2030-12-03"))
	if err != nil {
		t.Fatal(err)
	}
	res, err = RemoveMember(f.A.ID, f.MemberB)
	if err != nil || res.RemovedSpecialistID != f.B.ID {
		t.Fatalf("creator removing linked member: %+v %v", res, err)
	}
	if ownerOf(t, f.RoomID, "2030-12-03") != "" {
		t.Fatal("removed member's room days must be released")
	}
	if !hasWorkDate(t, f.B.ID, "2030-12-03") {
		t.Fatal("removed member keeps their own work dates")
	}
	if got, _ := GetRoomDayRequest(pending.ID); got.Status != models.RoomRequestCancelled {
		t.Fatalf("requests involving the removed member must be cancelled, got %s", got.Status)
	}
	if view, _ := GetRoomForSpecialist(f.B.ID); view != nil {
		t.Fatal("removed member must no longer be in a room")
	}

	// Foreign member ids are not found.
	if _, err := RemoveMember(f.A.ID, "nope"); !errors.Is(err, ErrMemberNotFound) {
		t.Fatalf("expected ErrMemberNotFound, got %v", err)
	}

	// Leaving as the last linked member deletes the room completely.
	viewA, _ := GetRoomForSpecialist(f.A.ID)
	res, err = RemoveMember(f.A.ID, viewA.MeMember.ID)
	if err != nil || !res.RoomDeleted {
		t.Fatalf("last member leaving must delete the room: %+v %v", res, err)
	}
	if room, _ := GetRoomByID(f.RoomID); room != nil {
		t.Fatal("room row must be gone")
	}
	members, _ := GetRoomMembers(f.RoomID)
	days, _ := GetRoomDays(f.RoomID, rd(t, "2000-01-01"))
	if len(members) != 0 || len(days) != 0 {
		t.Fatalf("room leftovers: %d members, %d days", len(members), len(days))
	}
}

func TestCreatorLeavingPassesCreatorship(t *testing.T) {
	f := newRoomFixture(t)
	if _, err := RemoveMember(f.A.ID, f.MemberA); err != nil {
		t.Fatal(err)
	}
	room, _ := GetRoomByID(f.RoomID)
	if room == nil || room.CreatedBy != f.B.ID {
		t.Fatalf("creatorship should pass to the remaining linked member, got %+v", room)
	}
}

func TestDayRequestsLifecycle(t *testing.T) {
	f := newRoomFixture(t)
	// C joins as well so two colleagues can compete for one of A's days.
	extra, _ := AddOfflineMember(f.RoomID, "Clara", "teal", true)
	if _, err := JoinRoomByInvite(extra.InviteCode, f.C.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := AssignRoomDays(f.A.ID, []RoomDayAssign{
		{Date: rd(t, "2031-01-06"), MemberID: f.MemberA},
		{Date: rd(t, "2031-01-07"), MemberID: f.Offline.ID},
		{Date: rd(t, "2031-01-08"), MemberID: f.MemberA},
	}); err != nil {
		t.Fatal(err)
	}

	// Invalid targets: offline-owned, free, own day, past.
	if _, _, err := CreateDayRequest(f.B.ID, rd(t, "2031-01-07")); !errors.Is(err, ErrRequestInvalid) {
		t.Fatalf("offline-owned: expected ErrRequestInvalid, got %v", err)
	}
	if _, _, err := CreateDayRequest(f.B.ID, rd(t, "2031-01-20")); !errors.Is(err, ErrRequestInvalid) {
		t.Fatalf("free day: expected ErrRequestInvalid, got %v", err)
	}
	if _, _, err := CreateDayRequest(f.A.ID, rd(t, "2031-01-06")); !errors.Is(err, ErrRequestInvalid) {
		t.Fatalf("own day: expected ErrRequestInvalid, got %v", err)
	}
	if _, _, err := CreateDayRequest(f.B.ID, rd(t, "2020-01-06")); !errors.Is(err, ErrRoomDayPast) {
		t.Fatalf("past: expected ErrRoomDayPast, got %v", err)
	}

	// Duplicate returns the existing pending request.
	first, created, err := CreateDayRequest(f.B.ID, rd(t, "2031-01-06"))
	if err != nil || !created {
		t.Fatalf("first request: %v created=%v", err, created)
	}
	again, created, err := CreateDayRequest(f.B.ID, rd(t, "2031-01-06"))
	if err != nil || created || again.ID != first.ID {
		t.Fatalf("duplicate must return the existing request: %+v created=%v err=%v", again, created, err)
	}
	competing, _, err := CreateDayRequest(f.C.ID, rd(t, "2031-01-06"))
	if err != nil {
		t.Fatal(err)
	}

	// Only the addressed owner may resolve.
	if _, err := ResolveDayRequest(f.B.ID, first.ID, true); !errors.Is(err, ErrRoomForbidden) {
		t.Fatalf("requester resolving own request: expected ErrRoomForbidden, got %v", err)
	}
	if _, err := ResolveDayRequest(f.A.ID, "missing", true); !errors.Is(err, ErrRequestNotFound) {
		t.Fatalf("expected ErrRequestNotFound, got %v", err)
	}

	// Bookings block accepting and keep the request pending.
	addBooking(t, f.A.ID, "2031-01-06")
	_, err = ResolveDayRequest(f.A.ID, first.ID, true)
	var withBookings *ErrWorkDateHasBookings
	if !errors.As(err, &withBookings) {
		t.Fatalf("expected ErrWorkDateHasBookings, got %v", err)
	}
	if got, _ := GetRoomDayRequest(first.ID); got.Status != models.RoomRequestPending {
		t.Fatalf("request must stay pending, got %s", got.Status)
	}
	if _, err := DB.Exec(Q(`UPDATE bookings SET status = 'cancelled' WHERE specialist_id = ?`), f.A.ID); err != nil {
		t.Fatal(err)
	}

	// Accepting transfers the day, swaps the work dates and cancels competing requests.
	accepted, err := ResolveDayRequest(f.A.ID, first.ID, true)
	if err != nil || accepted.Status != models.RoomRequestAccepted {
		t.Fatalf("accept: %+v %v", accepted, err)
	}
	if ownerOf(t, f.RoomID, "2031-01-06") != f.MemberB || hasWorkDate(t, f.A.ID, "2031-01-06") || !hasWorkDate(t, f.B.ID, "2031-01-06") {
		t.Fatal("accepted request must transfer the day and the work dates")
	}
	if got, _ := GetRoomDayRequest(competing.ID); got.Status != models.RoomRequestCancelled {
		t.Fatalf("competing request must be cancelled, got %s", got.Status)
	}
	if _, err := ResolveDayRequest(f.A.ID, first.ID, true); !errors.Is(err, ErrRequestInvalid) {
		t.Fatalf("an accepted request cannot be resolved again, got %v", err)
	}

	// Decline keeps ownership.
	declinable, _, err := CreateDayRequest(f.B.ID, rd(t, "2031-01-08"))
	if err != nil {
		t.Fatal(err)
	}
	declined, err := ResolveDayRequest(f.A.ID, declinable.ID, false)
	if err != nil || declined.Status != models.RoomRequestDeclined || ownerOf(t, f.RoomID, "2031-01-08") != f.MemberA {
		t.Fatalf("decline: %+v %v", declined, err)
	}
	if _, err := ResolveDayRequest(f.A.ID, declinable.ID, true); !errors.Is(err, ErrRequestInvalid) {
		t.Fatalf("resolving a declined request: expected ErrRequestInvalid, got %v", err)
	}

	// The requester can withdraw; others cannot.
	toCancel, _, _ := CreateDayRequest(f.B.ID, rd(t, "2031-01-08"))
	if _, err := CancelDayRequest(f.C.ID, toCancel.ID); !errors.Is(err, ErrRoomForbidden) {
		t.Fatalf("foreign cancel: expected ErrRoomForbidden, got %v", err)
	}
	if c, err := CancelDayRequest(f.B.ID, toCancel.ID); err != nil || c.Status != models.RoomRequestCancelled {
		t.Fatalf("cancel: %+v %v", c, err)
	}
	if _, err := CancelDayRequest(f.B.ID, toCancel.ID); !errors.Is(err, ErrRequestInvalid) {
		t.Fatalf("second cancel: expected ErrRequestInvalid, got %v", err)
	}
}

func TestMemberManagementValidation(t *testing.T) {
	f := newRoomFixture(t)

	if _, err := AddOfflineMember(f.RoomID, "X", "purple", false); !errors.Is(err, ErrInvalidColor) {
		t.Fatalf("expected ErrInvalidColor, got %v", err)
	}
	if _, err := AddOfflineMember(f.RoomID, "  ", "blue", false); !errors.Is(err, ErrInvalidName) {
		t.Fatalf("expected ErrInvalidName, got %v", err)
	}
	// Room has A, B and Dasha: three more fit, the next one does not.
	for i, color := range []string{"blue", "pink", "teal"} {
		if _, err := AddOfflineMember(f.RoomID, "Extra "+color, color, false); err != nil {
			t.Fatalf("member %d should fit: %v", i, err)
		}
	}
	if _, err := AddOfflineMember(f.RoomID, "Seventh", "blue", false); !errors.Is(err, ErrRoomFull) {
		t.Fatalf("expected ErrRoomFull, got %v", err)
	}

	// Invites: only for offline members; regeneration invalidates the previous code.
	oldCode, _ := RegenerateInvite(f.Offline.ID)
	newCode, err := RegenerateInvite(f.Offline.ID)
	if err != nil || newCode == oldCode || len(newCode) != 16 {
		t.Fatalf("regenerate: %q -> %q (%v)", oldCode, newCode, err)
	}
	if _, err := GetRoomInvite(oldCode); !errors.Is(err, ErrInviteInvalid) {
		t.Fatalf("old invite must stop working, got %v", err)
	}
	if _, err := RegenerateInvite(f.MemberB); !errors.Is(err, ErrRoomForbidden) {
		t.Fatalf("linked member invite: expected ErrRoomForbidden, got %v", err)
	}

	// Names only for offline members; colors for anyone.
	name, color := "Dasha K", "pink"
	if m, err := UpdateMember(f.Offline.ID, &name, &color); err != nil || m.Name != "Dasha K" || m.Color != "pink" {
		t.Fatalf("offline update: %+v %v", m, err)
	}
	if _, err := UpdateMember(f.MemberB, &name, nil); !errors.Is(err, ErrRoomForbidden) {
		t.Fatalf("renaming a linked member: expected ErrRoomForbidden, got %v", err)
	}
	if m, err := UpdateMember(f.MemberB, nil, &color); err != nil || m.Color != "pink" {
		t.Fatalf("linked color: %+v %v", m, err)
	}
	bad := "magenta"
	if _, err := UpdateMember(f.MemberB, nil, &bad); !errors.Is(err, ErrInvalidColor) {
		t.Fatalf("expected ErrInvalidColor, got %v", err)
	}
}

func TestSoftDeleteLeavesRoom(t *testing.T) {
	f := newRoomFixture(t)
	if err := openDates(t, f.B.ID, "2031-02-03"); err != nil {
		t.Fatal(err)
	}
	if err := SoftDeleteSpecialistCascade(f.B.ID); err != nil {
		t.Fatalf("SoftDeleteSpecialistCascade: %v", err)
	}
	if ownerOf(t, f.RoomID, "2031-02-03") != "" {
		t.Fatal("a deleted specialist's room days must be released")
	}
	members, _ := GetRoomMembers(f.RoomID)
	for _, m := range members {
		if m.SpecialistID == f.B.ID {
			t.Fatal("deleted specialist must leave the room")
		}
	}

	// Deleting the last linked member removes the room entirely.
	if err := SoftDeleteSpecialistCascade(f.A.ID); err != nil {
		t.Fatal(err)
	}
	if room, _ := GetRoomByID(f.RoomID); room != nil {
		t.Fatal("room must be deleted with its last linked member")
	}
}

func TestGetActiveBookingCountsFromPinsTheDayExpression(t *testing.T) {
	setupStatsTestDB(t)
	a := newSpecialistForRoom(t, 9151, "Anna")
	addBooking(t, a.ID, "2031-03-03")
	counts, err := GetActiveBookingCountsFrom(a.ID, rd(t, "2031-03-01"))
	if err != nil || len(counts) != 1 || counts[0].Date != "2031-03-03" || counts[0].Count != 1 {
		t.Fatalf("unexpected counts: %+v err=%v", counts, err)
	}
}
