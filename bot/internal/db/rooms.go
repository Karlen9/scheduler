package db

import (
	"database/sql"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Shared rooms ("кабинет"): several specialists rent one room by whole days.
*
* Invariant, for every LINKED member M of room R and every date D >= today:
*   room_days(R, D) = M   <=>   work_dates(M.specialist_id, D) exists.
* It is kept inside the transactions of SetWorkDates, AssignRoomDays, JoinRoomByInvite,
* ResolveDayRequest and CreateRoom. The primary key of room_days (room_id, date) is the single-owner
* guard: two concurrent claims of one date cannot both succeed.
***************************************************************************************************/

const (
	// MaxRoomMembers caps the participants of one room (linked and offline together).
	MaxRoomMembers = 6
	// defaultRoomIntervals are the default hours given to a specialist who joins a room without any.
	defaultRoomIntervals = `[{"startTime":"10:00","endTime":"20:00"}]`
	maxRoomNameLength    = 60
)

// RoomColors is the fixed palette member colors are validated against.
var RoomColors = []string{"green", "violet", "orange", "blue", "pink", "teal"}

var (
	ErrAlreadyInRoom   = errors.New("specialist is already in a room")
	ErrNotInRoom       = errors.New("specialist is not in a room")
	ErrRoomFull        = errors.New("room is full")
	ErrRoomForbidden   = errors.New("room action forbidden")
	ErrInviteInvalid   = errors.New("invite code is invalid or already used")
	ErrInvalidColor    = errors.New("invalid member color")
	ErrInvalidName     = errors.New("invalid name")
	ErrMemberNotFound  = errors.New("room member not found")
	ErrRoomDayPast     = errors.New("room date is in the past")
	ErrRequestNotFound = errors.New("room day request not found")
	ErrRequestInvalid  = errors.New("room day request is not valid")

	// ErrRoomRequiresDatesMode is returned when a room member would leave dates schedule mode.
	ErrRoomRequiresDatesMode = errors.New("room members must use dates schedule mode")
)

/***************************************************************************************************
* ErrRoomDayTaken is returned when a date is already owned by another room member.
***************************************************************************************************/
type ErrRoomDayTaken struct{ Dates []string }

func (e *ErrRoomDayTaken) Error() string {
	return "room dates already taken: " + strings.Join(e.Dates, ", ")
}

/***************************************************************************************************
* ErrRoomDayNotYours is returned when an action would take a date owned by another LINKED member.
***************************************************************************************************/
type ErrRoomDayNotYours struct{ Dates []string }

func (e *ErrRoomDayNotYours) Error() string {
	return "room dates belong to another member: " + strings.Join(e.Dates, ", ")
}

/***************************************************************************************************
* ErrWorkDateHasBookings is returned when giving away or closing a date that still has active
* bookings.
***************************************************************************************************/
type ErrWorkDateHasBookings struct{ Dates []string }

func (e *ErrWorkDateHasBookings) Error() string {
	return "dates have active bookings: " + strings.Join(e.Dates, ", ")
}

/***************************************************************************************************
* dbExecer is the query surface shared by *sql.DB and *sql.Tx so helpers work inside either.
***************************************************************************************************/
type dbExecer interface {
	Exec(query string, args ...any) (sql.Result, error)
	Query(query string, args ...any) (*sql.Rows, error)
	QueryRow(query string, args ...any) *sql.Row
}

/***************************************************************************************************
* IsValidRoomColor reports whether color belongs to the fixed palette.
***************************************************************************************************/
func IsValidRoomColor(color string) bool {
	for _, c := range RoomColors {
		if c == color {
			return true
		}
	}
	return false
}

/***************************************************************************************************
* cleanRoomName trims a member or room name and validates its length.
***************************************************************************************************/
func cleanRoomName(name string, required bool) (string, error) {
	name = strings.TrimSpace(name)
	if len([]rune(name)) > maxRoomNameLength || (required && name == "") {
		return "", ErrInvalidName
	}
	return name, nil
}

/***************************************************************************************************
* todayIn returns today's calendar date in the given IANA timezone as a UTC midnight value (UTC
* when the timezone is empty or unknown), matching how the API decides "past" dates.
***************************************************************************************************/
func todayIn(timezone string) time.Time {
	location := time.UTC
	if timezone != "" {
		if loaded, err := time.LoadLocation(timezone); err == nil {
			location = loaded
		}
	}
	now := time.Now().In(location)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

/***************************************************************************************************
* txSpecialistToday returns "today" in the specialist's own timezone.
***************************************************************************************************/
func txSpecialistToday(q dbExecer, specialistID string) (time.Time, error) {
	var tz sql.NullString
	err := q.QueryRow(Q(`SELECT timezone FROM specialists WHERE id = ?`), specialistID).Scan(&tz)
	if err != nil && err != sql.ErrNoRows {
		return time.Time{}, err
	}
	return todayIn(tz.String), nil
}

const roomMemberColumns = `id, room_id, specialist_id, name, color, invite_code, created_at`

func scanRoomMember(row interface{ Scan(...any) error }) (*models.RoomMember, error) {
	var m models.RoomMember
	var specialistID, invite sql.NullString
	if err := row.Scan(&m.ID, &m.RoomID, &specialistID, &m.Name, &m.Color, &invite, &m.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	m.SpecialistID = specialistID.String
	m.InviteCode = invite.String
	return &m, nil
}

func scanRoomMembers(rows *sql.Rows) ([]models.RoomMember, error) {
	defer rows.Close()
	members := make([]models.RoomMember, 0)
	for rows.Next() {
		m, err := scanRoomMember(rows)
		if err != nil {
			return nil, err
		}
		members = append(members, *m)
	}
	return members, rows.Err()
}

func txMemberOfSpecialist(q dbExecer, specialistID string) (*models.RoomMember, error) {
	return scanRoomMember(q.QueryRow(Q(`SELECT `+roomMemberColumns+` FROM room_members WHERE specialist_id = ?`), specialistID))
}

func txMemberByID(q dbExecer, memberID string) (*models.RoomMember, error) {
	return scanRoomMember(q.QueryRow(Q(`SELECT `+roomMemberColumns+` FROM room_members WHERE id = ?`), memberID))
}

func txRoomByID(q dbExecer, roomID string) (*models.Room, error) {
	var r models.Room
	err := q.QueryRow(Q(`SELECT id, name, created_by, created_at FROM rooms WHERE id = ?`), roomID).
		Scan(&r.ID, &r.Name, &r.CreatedBy, &r.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

/***************************************************************************************************
* txRoomOwner returns the member id owning a room date, or "" when the date is free.
***************************************************************************************************/
func txRoomOwner(q dbExecer, roomID, dateStr string) (string, error) {
	var owner string
	err := q.QueryRow(Q(`SELECT member_id FROM room_days WHERE room_id = ? AND date = ?`), roomID, dateStr).Scan(&owner)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return owner, err
}

/***************************************************************************************************
* txCancelPendingRequests cancels every pending day request for a date (ownership changed).
***************************************************************************************************/
func txCancelPendingRequests(q dbExecer, roomID, dateStr string) error {
	_, err := q.Exec(Q(`
		UPDATE room_day_requests SET status = 'cancelled', resolved_at = CURRENT_TIMESTAMP
		WHERE room_id = ? AND date = ? AND status = 'pending'
	`), roomID, dateStr)
	return err
}

/***************************************************************************************************
* txClaimFreeRoomDay inserts the ownership row of a free date; a concurrent claim (primary key
* violation) is reported as ErrRoomDayTaken.
***************************************************************************************************/
func txClaimFreeRoomDay(q dbExecer, roomID, dateStr, memberID string) error {
	_, err := q.Exec(Q(`INSERT INTO room_days (room_id, date, member_id) VALUES (?, ?, ?)`), roomID, dateStr, memberID)
	if err != nil && isUniqueConstraintError(err) {
		return &ErrRoomDayTaken{Dates: []string{dateStr}}
	}
	return err
}

/***************************************************************************************************
* txReassignRoomDay moves an owned date from one member to another; zero rows affected means
* somebody else changed it first (ErrRoomDayTaken).
***************************************************************************************************/
func txReassignRoomDay(q dbExecer, roomID, dateStr, fromMember, toMember string) error {
	res, err := q.Exec(Q(`UPDATE room_days SET member_id = ? WHERE room_id = ? AND date = ? AND member_id = ?`),
		toMember, roomID, dateStr, fromMember)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return &ErrRoomDayTaken{Dates: []string{dateStr}}
	}
	return nil
}

/***************************************************************************************************
* txApplyRoomOwnership enforces the room invariant for SetWorkDates: for a specialist who is in a
* room, opening an upcoming date claims it (conflict when another member owns it), closing one
* releases it. Specialists outside any room are untouched.
***************************************************************************************************/
func txApplyRoomOwnership(tx dbExecer, specialistID string, open []WorkDateInput, close []time.Time) error {
	member, err := txMemberOfSpecialist(tx, specialistID)
	if err != nil || member == nil {
		return err
	}
	today, err := txSpecialistToday(tx, specialistID)
	if err != nil {
		return err
	}

	var taken []string
	for _, in := range open {
		if in.Date.Before(today) {
			continue
		}
		dateStr := in.Date.Format(workDateLayout)
		owner, err := txRoomOwner(tx, member.RoomID, dateStr)
		if err != nil {
			return err
		}
		switch owner {
		case member.ID:
		case "":
			if err := txClaimFreeRoomDay(tx, member.RoomID, dateStr, member.ID); err != nil {
				var conflict *ErrRoomDayTaken
				if errors.As(err, &conflict) {
					// A failed statement aborts a Postgres transaction, so stop right here.
					return &ErrRoomDayTaken{Dates: uniqueSorted(append(taken, dateStr))}
				}
				return err
			}
		default:
			taken = append(taken, dateStr)
		}
	}
	if len(taken) > 0 {
		return &ErrRoomDayTaken{Dates: uniqueSorted(taken)}
	}

	for _, d := range close {
		if d.Before(today) {
			continue
		}
		dateStr := d.Format(workDateLayout)
		res, err := tx.Exec(Q(`DELETE FROM room_days WHERE room_id = ? AND date = ? AND member_id = ?`), member.RoomID, dateStr, member.ID)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n > 0 {
			if err := txCancelPendingRequests(tx, member.RoomID, dateStr); err != nil {
				return err
			}
		}
	}
	return nil
}

func uniqueSorted(values []string) []string {
	seen := make(map[string]bool, len(values))
	out := make([]string, 0, len(values))
	for _, v := range values {
		if !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	sort.Strings(out)
	return out
}

/***************************************************************************************************
* txEnsureDatesMode switches a specialist to dates mode (default hours 10:00-20:00 when none are
* stored). When the mode actually changes, upcoming dates that already have active bookings are
* opened automatically so no booking ends up on a closed day (same rule as the schedule settings).
***************************************************************************************************/
func txEnsureDatesMode(tx dbExecer, specialistID string, today time.Time) error {
	var mode, defaults sql.NullString
	if err := tx.QueryRow(Q(`SELECT schedule_mode, default_intervals FROM specialists WHERE id = ?`), specialistID).Scan(&mode, &defaults); err != nil {
		return err
	}
	if mode.String != models.ScheduleModeDates {
		starts, err := activeBookingStarts(tx, specialistID, today, time.Time{})
		if err != nil {
			return err
		}
		for _, s := range starts {
			if err := txUpsertWorkDate(tx, specialistID, s.Format(workDateLayout), "", false); err != nil {
				return err
			}
		}
	}
	newDefaults := defaults.String
	if len(ParseWorkIntervals(newDefaults)) == 0 {
		newDefaults = defaultRoomIntervals
	}
	_, err := tx.Exec(Q(`UPDATE specialists SET schedule_mode = ?, default_intervals = ? WHERE id = ?`),
		models.ScheduleModeDates, newDefaults, specialistID)
	return err
}

/***************************************************************************************************
* txFutureWorkDates lists a specialist's work dates from `from` onward as "YYYY-MM-DD".
***************************************************************************************************/
func txFutureWorkDates(q dbExecer, specialistID string, from time.Time) ([]string, error) {
	rows, err := q.Query(Q(`SELECT date FROM work_dates WHERE specialist_id = ? AND date >= ? ORDER BY date`),
		specialistID, from.Format(workDateLayout))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var dates []string
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		dates = append(dates, parseDateString(d).Format(workDateLayout))
	}
	return dates, rows.Err()
}

/***************************************************************************************************
* txRoomDatesOf lists the future dates owned by a member as "YYYY-MM-DD".
***************************************************************************************************/
func txRoomDatesOf(q dbExecer, roomID, memberID string, from time.Time) ([]string, error) {
	rows, err := q.Query(Q(`SELECT date FROM room_days WHERE room_id = ? AND member_id = ? AND date >= ? ORDER BY date`),
		roomID, memberID, from.Format(workDateLayout))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var dates []string
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		dates = append(dates, parseDateString(d).Format(workDateLayout))
	}
	return dates, rows.Err()
}

func parseWorkDateOrZero(s string) time.Time {
	d, err := time.Parse(workDateLayout, s)
	if err != nil {
		return time.Time{}
	}
	return d
}

/***************************************************************************************************
* CreateRoom creates a room for a specialist and makes them its first linked member (color
* "green"). Joining a room implies dates mode: the specialist is switched to it (default hours
* 10:00-20:00 when none exist) and all their upcoming work dates are claimed in the room.
*
* Returns:
* - The room, or ErrAlreadyInRoom when the specialist already belongs to one.
***************************************************************************************************/
func CreateRoom(specialistID, name string) (*models.Room, error) {
	name, err := cleanRoomName(name, false)
	if err != nil {
		return nil, err
	}
	tx, err := DB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	if existing, err := txMemberOfSpecialist(tx, specialistID); err != nil {
		return nil, err
	} else if existing != nil {
		return nil, ErrAlreadyInRoom
	}

	var specialistName string
	if err := tx.QueryRow(Q(`SELECT name FROM specialists WHERE id = ?`), specialistID).Scan(&specialistName); err != nil {
		return nil, err
	}
	today, err := txSpecialistToday(tx, specialistID)
	if err != nil {
		return nil, err
	}

	roomID := uuid.New().String()
	memberID := uuid.New().String()
	if _, err := tx.Exec(Q(`INSERT INTO rooms (id, name, created_by, created_at) VALUES (?, ?, ?, ?)`), roomID, name, specialistID, time.Now().UTC()); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(Q(`INSERT INTO room_members (id, room_id, specialist_id, name, color, created_at) VALUES (?, ?, ?, ?, ?, ?)`),
		memberID, roomID, specialistID, specialistName, "green", time.Now().UTC()); err != nil {
		if isUniqueConstraintError(err) {
			return nil, ErrAlreadyInRoom
		}
		return nil, err
	}

	if err := txEnsureDatesMode(tx, specialistID, today); err != nil {
		return nil, err
	}
	dates, err := txFutureWorkDates(tx, specialistID, today)
	if err != nil {
		return nil, err
	}
	for _, d := range dates {
		if err := txClaimFreeRoomDay(tx, roomID, d, memberID); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return GetRoomByID(roomID)
}

/***************************************************************************************************
* GetRoomByID returns a room, or nil when it does not exist.
***************************************************************************************************/
func GetRoomByID(roomID string) (*models.Room, error) {
	return txRoomByID(DB, roomID)
}

/***************************************************************************************************
* RoomView is a room together with its members and the member row of the asking specialist.
***************************************************************************************************/
type RoomView struct {
	Room     models.Room
	Members  []models.RoomMember
	MeMember models.RoomMember
}

/***************************************************************************************************
* GetRoomForSpecialist returns the room the specialist belongs to (members ordered by joining
* time), or nil when they are not in one.
***************************************************************************************************/
func GetRoomForSpecialist(specialistID string) (*RoomView, error) {
	me, err := txMemberOfSpecialist(DB, specialistID)
	if err != nil || me == nil {
		return nil, err
	}
	room, err := GetRoomByID(me.RoomID)
	if err != nil || room == nil {
		return nil, err
	}
	members, err := GetRoomMembers(me.RoomID)
	if err != nil {
		return nil, err
	}
	return &RoomView{Room: *room, Members: members, MeMember: *me}, nil
}

/***************************************************************************************************
* GetRoomMembers lists the members of a room ordered by creation time.
***************************************************************************************************/
func GetRoomMembers(roomID string) ([]models.RoomMember, error) {
	rows, err := DB.Query(Q(`SELECT `+roomMemberColumns+` FROM room_members WHERE room_id = ? ORDER BY created_at, id`), roomID)
	if err != nil {
		return nil, err
	}
	return scanRoomMembers(rows)
}

/***************************************************************************************************
* GetRoomMemberByID returns one member, or nil.
***************************************************************************************************/
func GetRoomMemberByID(memberID string) (*models.RoomMember, error) {
	return txMemberByID(DB, memberID)
}

/***************************************************************************************************
* GetRoomLinkedSpecialistIDs returns the specialist ids of the linked members of a room.
***************************************************************************************************/
func GetRoomLinkedSpecialistIDs(roomID string) ([]string, error) {
	rows, err := DB.Query(Q(`SELECT specialist_id FROM room_members WHERE room_id = ? AND specialist_id IS NOT NULL`), roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

/***************************************************************************************************
* GetRoomDays lists the room's date ownership rows from `from` onward, ordered by date.
***************************************************************************************************/
func GetRoomDays(roomID string, from time.Time) ([]models.RoomDay, error) {
	rows, err := DB.Query(Q(`SELECT date, member_id FROM room_days WHERE room_id = ? AND date >= ? ORDER BY date`),
		roomID, from.Format(workDateLayout))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	days := make([]models.RoomDay, 0)
	for rows.Next() {
		var d models.RoomDay
		var dateStr string
		if err := rows.Scan(&dateStr, &d.MemberID); err != nil {
			return nil, err
		}
		d.RoomID = roomID
		d.Date = parseDateString(dateStr)
		days = append(days, d)
	}
	return days, rows.Err()
}

/***************************************************************************************************
* UpdateRoomName renames a room.
***************************************************************************************************/
func UpdateRoomName(roomID, name string) error {
	name, err := cleanRoomName(name, false)
	if err != nil {
		return err
	}
	_, err = DB.Exec(Q(`UPDATE rooms SET name = ? WHERE id = ?`), name, roomID)
	return err
}

/***************************************************************************************************
* AddOfflineMember adds a colleague without a bot to a room (name + color), optionally with an
* invite code that lets them later become a linked member.
*
* Returns:
* - The member, ErrInvalidName/ErrInvalidColor on bad input, or ErrRoomFull at 6 members.
***************************************************************************************************/
func AddOfflineMember(roomID, name, color string, withInvite bool) (*models.RoomMember, error) {
	name, err := cleanRoomName(name, true)
	if err != nil {
		return nil, err
	}
	if !IsValidRoomColor(color) {
		return nil, ErrInvalidColor
	}

	tx, err := DB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	var count int
	if err := tx.QueryRow(Q(`SELECT COUNT(*) FROM room_members WHERE room_id = ?`), roomID).Scan(&count); err != nil {
		return nil, err
	}
	if count >= MaxRoomMembers {
		return nil, ErrRoomFull
	}

	var invite interface{}
	if withInvite {
		invite = generateReferralCode()
	}
	id := uuid.New().String()
	if _, err := tx.Exec(Q(`INSERT INTO room_members (id, room_id, name, color, invite_code, created_at) VALUES (?, ?, ?, ?, ?, ?)`),
		id, roomID, name, color, invite, time.Now().UTC()); err != nil {
		return nil, err
	}
	member, err := txMemberByID(tx, id)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return member, nil
}

/***************************************************************************************************
* RegenerateInvite issues a fresh invite code for an offline member (invalidating the old one).
*
* Returns:
* - The new code, ErrMemberNotFound, or ErrRoomForbidden for a linked member.
***************************************************************************************************/
func RegenerateInvite(memberID string) (string, error) {
	member, err := GetRoomMemberByID(memberID)
	if err != nil {
		return "", err
	}
	if member == nil {
		return "", ErrMemberNotFound
	}
	if member.IsLinked() {
		return "", ErrRoomForbidden
	}
	code := generateReferralCode()
	if _, err := DB.Exec(Q(`UPDATE room_members SET invite_code = ? WHERE id = ? AND specialist_id IS NULL`), code, memberID); err != nil {
		return "", err
	}
	return code, nil
}

/***************************************************************************************************
* UpdateMember changes a member's name (offline members only) and/or color (anyone; callers decide
* whose colors the actor may change). Nil arguments are left unchanged.
***************************************************************************************************/
func UpdateMember(memberID string, name, color *string) (*models.RoomMember, error) {
	member, err := GetRoomMemberByID(memberID)
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, ErrMemberNotFound
	}
	newName, newColor := member.Name, member.Color
	if name != nil {
		if member.IsLinked() {
			return nil, ErrRoomForbidden
		}
		cleaned, err := cleanRoomName(*name, true)
		if err != nil {
			return nil, err
		}
		newName = cleaned
	}
	if color != nil {
		if !IsValidRoomColor(*color) {
			return nil, ErrInvalidColor
		}
		newColor = *color
	}
	if _, err := DB.Exec(Q(`UPDATE room_members SET name = ?, color = ? WHERE id = ?`), newName, newColor, memberID); err != nil {
		return nil, err
	}
	return GetRoomMemberByID(memberID)
}

/***************************************************************************************************
* RemoveResult describes what RemoveMember changed.
***************************************************************************************************/
type RemoveResult struct {
	RoomID              string
	RoomName            string
	RoomDeleted         bool
	RemovedSpecialistID string // "" when an offline member was removed
}

/***************************************************************************************************
* RemoveMember removes a member from the actor's room.
* - offline member: the member and their days go away (dates become free);
* - another linked member: only the room creator may; their room days are deleted but their own
*   work dates stay (they keep working those days solo);
* - the actor themself (leaving): same as above; when no linked member is left the whole room is
*   deleted, otherwise creatorship passes to the longest-standing linked member.
***************************************************************************************************/
func RemoveMember(actorSpecialistID, memberID string) (*RemoveResult, error) {
	tx, err := DB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	actor, err := txMemberOfSpecialist(tx, actorSpecialistID)
	if err != nil {
		return nil, err
	}
	if actor == nil {
		return nil, ErrNotInRoom
	}
	target, err := txMemberByID(tx, memberID)
	if err != nil {
		return nil, err
	}
	if target == nil || target.RoomID != actor.RoomID {
		return nil, ErrMemberNotFound
	}
	room, err := txRoomByID(tx, actor.RoomID)
	if err != nil || room == nil {
		return nil, err
	}
	if target.IsLinked() && target.ID != actor.ID && room.CreatedBy != actorSpecialistID {
		return nil, ErrRoomForbidden
	}

	result, err := txRemoveMember(tx, room, target)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

/***************************************************************************************************
* txRemoveMember performs the removal (see RemoveMember) without permission checks.
***************************************************************************************************/
func txRemoveMember(tx dbExecer, room *models.Room, target *models.RoomMember) (*RemoveResult, error) {
	if _, err := tx.Exec(Q(`DELETE FROM room_days WHERE room_id = ? AND member_id = ?`), room.ID, target.ID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(Q(`
		UPDATE room_day_requests SET status = 'cancelled', resolved_at = CURRENT_TIMESTAMP
		WHERE room_id = ? AND status = 'pending' AND (from_member_id = ? OR to_member_id = ?)
	`), room.ID, target.ID, target.ID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(Q(`DELETE FROM room_members WHERE id = ?`), target.ID); err != nil {
		return nil, err
	}

	result := &RemoveResult{RoomID: room.ID, RoomName: room.Name, RemovedSpecialistID: target.SpecialistID}

	var linkedLeft int
	if err := tx.QueryRow(Q(`SELECT COUNT(*) FROM room_members WHERE room_id = ? AND specialist_id IS NOT NULL`), room.ID).Scan(&linkedLeft); err != nil {
		return nil, err
	}
	if linkedLeft == 0 {
		for _, stmt := range []string{
			`DELETE FROM room_day_requests WHERE room_id = ?`,
			`DELETE FROM room_days WHERE room_id = ?`,
			`DELETE FROM room_members WHERE room_id = ?`,
			`DELETE FROM rooms WHERE id = ?`,
		} {
			if _, err := tx.Exec(Q(stmt), room.ID); err != nil {
				return nil, err
			}
		}
		result.RoomDeleted = true
		return result, nil
	}

	if target.SpecialistID != "" && room.CreatedBy == target.SpecialistID {
		var next string
		if err := tx.QueryRow(Q(`
			SELECT specialist_id FROM room_members
			WHERE room_id = ? AND specialist_id IS NOT NULL ORDER BY created_at, id LIMIT 1
		`), room.ID).Scan(&next); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(Q(`UPDATE rooms SET created_by = ? WHERE id = ?`), next, room.ID); err != nil {
			return nil, err
		}
	}
	return result, nil
}

/***************************************************************************************************
* InvitePreview describes the room an invite code leads to.
***************************************************************************************************/
type InvitePreview struct {
	Room        models.Room
	Member      models.RoomMember
	CreatorName string
}

/***************************************************************************************************
* GetRoomInvite resolves an invite code of an offline member, or returns ErrInviteInvalid.
***************************************************************************************************/
func GetRoomInvite(code string) (*InvitePreview, error) {
	if code == "" {
		return nil, ErrInviteInvalid
	}
	member, err := scanRoomMember(DB.QueryRow(Q(`SELECT `+roomMemberColumns+` FROM room_members WHERE invite_code = ? AND specialist_id IS NULL`), code))
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, ErrInviteInvalid
	}
	room, err := GetRoomByID(member.RoomID)
	if err != nil {
		return nil, err
	}
	if room == nil {
		return nil, ErrInviteInvalid
	}
	preview := &InvitePreview{Room: *room, Member: *member}
	var creator sql.NullString
	if err := DB.QueryRow(Q(`SELECT name FROM specialists WHERE id = ?`), room.CreatedBy).Scan(&creator); err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	preview.CreatorName = creator.String
	return preview, nil
}

/***************************************************************************************************
* JoinResult is what JoinRoomByInvite reports.
***************************************************************************************************/
type JoinResult struct {
	Room        models.Room
	MemberID    string
	Conflicts   []string // dates the joiner keeps open although another member owns them (bookings)
	CarriedOver int      // dates of the offline member carried into the joiner's schedule
}

/***************************************************************************************************
* JoinRoomByInvite turns an offline member into the joining specialist (invalid or used code gives
* ErrInviteInvalid; a specialist already in a room gives ErrAlreadyInRoom). In one transaction:
* the member is linked and the invite cleared, the joiner is switched to dates mode, the member's
* upcoming room days become the joiner's work dates, and the joiner's own upcoming work dates are
* claimed when free; dates another member owns are dropped from the joiner's schedule unless they
* hold active bookings, in which case they stay open and are reported as conflicts.
***************************************************************************************************/
func JoinRoomByInvite(code, specialistID string) (*JoinResult, error) {
	if code == "" {
		return nil, ErrInviteInvalid
	}
	tx, err := DB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	member, err := scanRoomMember(tx.QueryRow(Q(`SELECT `+roomMemberColumns+` FROM room_members WHERE invite_code = ? AND specialist_id IS NULL`), code))
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, ErrInviteInvalid
	}
	if existing, err := txMemberOfSpecialist(tx, specialistID); err != nil {
		return nil, err
	} else if existing != nil {
		return nil, ErrAlreadyInRoom
	}
	room, err := txRoomByID(tx, member.RoomID)
	if err != nil {
		return nil, err
	}
	if room == nil {
		return nil, ErrInviteInvalid
	}

	var joinerName string
	if err := tx.QueryRow(Q(`SELECT name FROM specialists WHERE id = ?`), specialistID).Scan(&joinerName); err != nil {
		return nil, err
	}
	res, err := tx.Exec(Q(`UPDATE room_members SET specialist_id = ?, invite_code = NULL, name = ? WHERE id = ? AND specialist_id IS NULL`),
		specialistID, joinerName, member.ID)
	if err != nil {
		if isUniqueConstraintError(err) {
			return nil, ErrAlreadyInRoom
		}
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrInviteInvalid
	}

	today, err := txSpecialistToday(tx, specialistID)
	if err != nil {
		return nil, err
	}
	if err := txEnsureDatesMode(tx, specialistID, today); err != nil {
		return nil, err
	}

	result := &JoinResult{Room: *room, MemberID: member.ID}

	carried, err := txRoomDatesOf(tx, room.ID, member.ID, today)
	if err != nil {
		return nil, err
	}
	for _, d := range carried {
		if err := txUpsertWorkDate(tx, specialistID, d, "", false); err != nil {
			return nil, err
		}
		result.CarriedOver++
	}

	own, err := txFutureWorkDates(tx, specialistID, today)
	if err != nil {
		return nil, err
	}
	var owned []string
	for _, d := range own {
		owner, err := txRoomOwner(tx, room.ID, d)
		if err != nil {
			return nil, err
		}
		switch owner {
		case member.ID:
		case "":
			if err := txClaimFreeRoomDay(tx, room.ID, d, member.ID); err != nil {
				return nil, err
			}
		default:
			owned = append(owned, d)
		}
	}
	if len(owned) > 0 {
		dates := make([]time.Time, 0, len(owned))
		for _, d := range owned {
			dates = append(dates, parseWorkDateOrZero(d))
		}
		counts, err := countActiveBookingsByDate(tx, specialistID, dates)
		if err != nil {
			return nil, err
		}
		for _, d := range owned {
			if counts[d] > 0 {
				result.Conflicts = append(result.Conflicts, d)
				continue
			}
			if err := txDeleteWorkDate(tx, specialistID, d); err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

/***************************************************************************************************
* RoomDayAssign asks to give one date to a member ("" frees the date).
***************************************************************************************************/
type RoomDayAssign struct {
	Date     time.Time
	MemberID string
}

/***************************************************************************************************
* RoomDayAssignResult reports what AssignRoomDays changed. ClaimedFree lists the dates the actor
* took that were free before (colleagues get notified about these); Changed lists every date whose
* owner changed.
***************************************************************************************************/
type RoomDayAssignResult struct {
	RoomID      string
	ClaimedFree []string
	Changed     []string
}

/***************************************************************************************************
* AssignRoomDays applies date assignments on behalf of a linked member, all-or-nothing.
*
* Rules: the target must be the actor, an offline member of the same room, or "" (free) -
* otherwise ErrRoomForbidden. A date owned by another linked member is off limits
* (ErrRoomDayNotYours). Taking a date away from the actor while they have active bookings that day
* is refused (ErrWorkDateHasBookings). Past dates (actor's timezone) give ErrRoomDayPast.
* Assigning to the actor opens the date in their schedule (keeping existing custom hours); moving it
* away from the actor closes it.
***************************************************************************************************/
func AssignRoomDays(actorSpecialistID string, assigns []RoomDayAssign) (*RoomDayAssignResult, error) {
	tx, err := DB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	actor, err := txMemberOfSpecialist(tx, actorSpecialistID)
	if err != nil {
		return nil, err
	}
	if actor == nil {
		return nil, ErrRoomForbidden
	}
	today, err := txSpecialistToday(tx, actorSpecialistID)
	if err != nil {
		return nil, err
	}

	// Last assignment wins when a date is listed twice.
	targets := make(map[string]string, len(assigns))
	order := make([]string, 0, len(assigns))
	for _, a := range assigns {
		if a.Date.Before(today) {
			return nil, ErrRoomDayPast
		}
		key := a.Date.Format(workDateLayout)
		if _, seen := targets[key]; !seen {
			order = append(order, key)
		}
		targets[key] = a.MemberID
	}

	targetMembers := make(map[string]*models.RoomMember)
	for _, memberID := range targets {
		if memberID == "" || memberID == actor.ID {
			continue
		}
		if _, ok := targetMembers[memberID]; ok {
			continue
		}
		m, err := txMemberByID(tx, memberID)
		if err != nil {
			return nil, err
		}
		if m == nil || m.RoomID != actor.RoomID || m.IsLinked() {
			return nil, ErrRoomForbidden
		}
		targetMembers[memberID] = m
	}

	owners := make(map[string]string, len(order))
	var notYours, withBookings []string
	var giveAway []time.Time
	for _, key := range order {
		owner, err := txRoomOwner(tx, actor.RoomID, key)
		if err != nil {
			return nil, err
		}
		owners[key] = owner
		if owner != "" && owner != actor.ID {
			if m, err := txMemberByID(tx, owner); err != nil {
				return nil, err
			} else if m != nil && m.IsLinked() {
				if targets[key] != owner {
					notYours = append(notYours, key)
				}
				continue
			}
		}
		if owner == actor.ID && targets[key] != actor.ID {
			giveAway = append(giveAway, parseWorkDateOrZero(key))
		}
	}
	if len(notYours) > 0 {
		return nil, &ErrRoomDayNotYours{Dates: uniqueSorted(notYours)}
	}
	if len(giveAway) > 0 {
		counts, err := countActiveBookingsByDate(tx, actorSpecialistID, giveAway)
		if err != nil {
			return nil, err
		}
		for _, d := range giveAway {
			if counts[d.Format(workDateLayout)] > 0 {
				withBookings = append(withBookings, d.Format(workDateLayout))
			}
		}
		if len(withBookings) > 0 {
			return nil, &ErrWorkDateHasBookings{Dates: uniqueSorted(withBookings)}
		}
	}

	result := &RoomDayAssignResult{RoomID: actor.RoomID}
	for _, key := range order {
		owner, target := owners[key], targets[key]
		if owner == target {
			continue
		}
		switch {
		case owner == "":
			if target != "" {
				if err := txClaimFreeRoomDay(tx, actor.RoomID, key, target); err != nil {
					return nil, err
				}
			}
		case target == "":
			if _, err := tx.Exec(Q(`DELETE FROM room_days WHERE room_id = ? AND date = ? AND member_id = ?`), actor.RoomID, key, owner); err != nil {
				return nil, err
			}
		default:
			if err := txReassignRoomDay(tx, actor.RoomID, key, owner, target); err != nil {
				return nil, err
			}
		}

		if target == actor.ID {
			if err := txUpsertWorkDate(tx, actorSpecialistID, key, "", false); err != nil {
				return nil, err
			}
			if owner == "" {
				result.ClaimedFree = append(result.ClaimedFree, key)
			}
		} else if owner == actor.ID {
			if err := txDeleteWorkDate(tx, actorSpecialistID, key); err != nil {
				return nil, err
			}
		}
		if err := txCancelPendingRequests(tx, actor.RoomID, key); err != nil {
			return nil, err
		}
		result.Changed = append(result.Changed, key)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

const roomRequestColumns = `id, room_id, date, from_member_id, to_member_id, status, created_at`

func scanRoomRequest(row interface{ Scan(...any) error }) (*models.RoomDayRequest, error) {
	var r models.RoomDayRequest
	var dateStr string
	if err := row.Scan(&r.ID, &r.RoomID, &dateStr, &r.FromMemberID, &r.ToMemberID, &r.Status, &r.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	r.Date = parseDateString(dateStr)
	return &r, nil
}

/***************************************************************************************************
* GetRoomDayRequest returns a request by id, or nil.
***************************************************************************************************/
func GetRoomDayRequest(requestID string) (*models.RoomDayRequest, error) {
	return scanRoomRequest(DB.QueryRow(Q(`SELECT `+roomRequestColumns+` FROM room_day_requests WHERE id = ?`), requestID))
}

/***************************************************************************************************
* GetPendingRoomRequests lists the pending day requests of a room, oldest first.
***************************************************************************************************/
func GetPendingRoomRequests(roomID string) ([]models.RoomDayRequest, error) {
	rows, err := DB.Query(Q(`SELECT `+roomRequestColumns+` FROM room_day_requests WHERE room_id = ? AND status = 'pending' ORDER BY created_at, id`), roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	requests := make([]models.RoomDayRequest, 0)
	for rows.Next() {
		r, err := scanRoomRequest(rows)
		if err != nil {
			return nil, err
		}
		requests = append(requests, *r)
	}
	return requests, rows.Err()
}

/***************************************************************************************************
* CreateDayRequest lets a linked member ask the linked owner of an upcoming date to give it up.
*
* Returns:
* - The request and whether it was newly created (a duplicate pending request from the same member
*   is returned as-is with created=false), ErrRoomDayPast for past dates, or ErrRequestInvalid when
*   the date is free, owned by an offline member, or already the actor's own.
***************************************************************************************************/
func CreateDayRequest(actorSpecialistID string, date time.Time) (*models.RoomDayRequest, bool, error) {
	tx, err := DB.Begin()
	if err != nil {
		return nil, false, err
	}
	defer func() { _ = tx.Rollback() }()

	actor, err := txMemberOfSpecialist(tx, actorSpecialistID)
	if err != nil {
		return nil, false, err
	}
	if actor == nil {
		return nil, false, ErrRoomForbidden
	}
	today, err := txSpecialistToday(tx, actorSpecialistID)
	if err != nil {
		return nil, false, err
	}
	if date.Before(today) {
		return nil, false, ErrRoomDayPast
	}
	dateStr := date.Format(workDateLayout)

	ownerID, err := txRoomOwner(tx, actor.RoomID, dateStr)
	if err != nil {
		return nil, false, err
	}
	if ownerID == "" || ownerID == actor.ID {
		return nil, false, ErrRequestInvalid
	}
	owner, err := txMemberByID(tx, ownerID)
	if err != nil {
		return nil, false, err
	}
	if owner == nil || !owner.IsLinked() {
		return nil, false, ErrRequestInvalid
	}

	existing, err := scanRoomRequest(tx.QueryRow(Q(`
		SELECT `+roomRequestColumns+` FROM room_day_requests
		WHERE room_id = ? AND date = ? AND from_member_id = ? AND status = 'pending'
	`), actor.RoomID, dateStr, actor.ID))
	if err != nil {
		return nil, false, err
	}
	if existing != nil {
		return existing, false, nil
	}

	id := uuid.New().String()
	if _, err := tx.Exec(Q(`INSERT INTO room_day_requests (id, room_id, date, from_member_id, to_member_id, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)`),
		id, actor.RoomID, dateStr, actor.ID, ownerID, time.Now().UTC()); err != nil {
		return nil, false, err
	}
	request, err := scanRoomRequest(tx.QueryRow(Q(`SELECT `+roomRequestColumns+` FROM room_day_requests WHERE id = ?`), id))
	if err != nil {
		return nil, false, err
	}
	if err := tx.Commit(); err != nil {
		return nil, false, err
	}
	return request, true, nil
}

/***************************************************************************************************
* ResolveDayRequest lets the date's current owner accept (hand the date over) or decline a pending
* request. Accepting while the owner has active bookings that day returns ErrWorkDateHasBookings and
* leaves the request pending. A caller who is not the addressed owner gets ErrRoomForbidden; a
* missing or already resolved request gives ErrRequestNotFound / ErrRequestInvalid.
***************************************************************************************************/
func ResolveDayRequest(ownerSpecialistID, requestID string, accept bool) (*models.RoomDayRequest, error) {
	tx, err := DB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	request, err := scanRoomRequest(tx.QueryRow(Q(`SELECT `+roomRequestColumns+` FROM room_day_requests WHERE id = ?`), requestID))
	if err != nil {
		return nil, err
	}
	if request == nil {
		return nil, ErrRequestNotFound
	}
	toMember, err := txMemberByID(tx, request.ToMemberID)
	if err != nil {
		return nil, err
	}
	if toMember == nil || toMember.SpecialistID != ownerSpecialistID {
		return nil, ErrRoomForbidden
	}
	if request.Status != models.RoomRequestPending {
		return nil, ErrRequestInvalid
	}
	dateStr := request.Date.Format(workDateLayout)

	if !accept {
		if _, err := tx.Exec(Q(`UPDATE room_day_requests SET status = 'declined', resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`), requestID); err != nil {
			return nil, err
		}
		request.Status = models.RoomRequestDeclined
		return request, tx.Commit()
	}

	fromMember, err := txMemberByID(tx, request.FromMemberID)
	if err != nil {
		return nil, err
	}
	if fromMember == nil || !fromMember.IsLinked() {
		return nil, ErrRequestInvalid
	}
	today, err := txSpecialistToday(tx, ownerSpecialistID)
	if err != nil {
		return nil, err
	}
	if request.Date.Before(today) {
		return nil, ErrRoomDayPast
	}
	if owner, err := txRoomOwner(tx, request.RoomID, dateStr); err != nil {
		return nil, err
	} else if owner != toMember.ID {
		return nil, ErrRequestInvalid
	}

	counts, err := countActiveBookingsByDate(tx, ownerSpecialistID, []time.Time{request.Date})
	if err != nil {
		return nil, err
	}
	if counts[dateStr] > 0 {
		return nil, &ErrWorkDateHasBookings{Dates: []string{dateStr}}
	}

	if err := txReassignRoomDay(tx, request.RoomID, dateStr, toMember.ID, fromMember.ID); err != nil {
		return nil, err
	}
	if err := txDeleteWorkDate(tx, ownerSpecialistID, dateStr); err != nil {
		return nil, err
	}
	if err := txUpsertWorkDate(tx, fromMember.SpecialistID, dateStr, "", false); err != nil {
		return nil, err
	}
	if err := txCancelPendingRequests(tx, request.RoomID, dateStr); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(Q(`UPDATE room_day_requests SET status = 'accepted', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`), requestID); err != nil {
		return nil, err
	}
	request.Status = models.RoomRequestAccepted
	return request, tx.Commit()
}

/***************************************************************************************************
* CancelDayRequest withdraws a pending request; only the requesting member may do it.
***************************************************************************************************/
func CancelDayRequest(requesterSpecialistID, requestID string) (*models.RoomDayRequest, error) {
	request, err := GetRoomDayRequest(requestID)
	if err != nil {
		return nil, err
	}
	if request == nil {
		return nil, ErrRequestNotFound
	}
	from, err := GetRoomMemberByID(request.FromMemberID)
	if err != nil {
		return nil, err
	}
	if from == nil || from.SpecialistID != requesterSpecialistID {
		return nil, ErrRoomForbidden
	}
	res, err := DB.Exec(Q(`UPDATE room_day_requests SET status = 'cancelled', resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`), requestID)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrRequestInvalid
	}
	request.Status = models.RoomRequestCancelled
	return request, nil
}
