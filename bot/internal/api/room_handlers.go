package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Notification hooks for shared rooms, wired in main.go to each recipient's OWN specialist bot.
* All are optional (nil in tests); failures are logged and never fail the request.
***************************************************************************************************/
var (
	// NotifyRoomDayRequestFunc tells the date's owner that a colleague asks for it.
	NotifyRoomDayRequestFunc func(request *models.RoomDayRequest) error
	// NotifyRoomDayRequestResolvedFunc tells the requester whether the owner gave the date away.
	NotifyRoomDayRequestResolvedFunc func(request *models.RoomDayRequest, accepted bool) error
	// NotifyRoomDaysClaimedFunc tells the other linked members which free dates a member took.
	NotifyRoomDaysClaimedFunc func(roomID, actorSpecialistID string, dates []string) error
	// NotifyRoomMemberRemovedFunc tells a removed linked member they were excluded from the room.
	NotifyRoomMemberRemovedFunc func(roomName, removedSpecialistID string) error
)

/***************************************************************************************************
* JSON shapes of the room endpoints.
***************************************************************************************************/
type roomInfoPayload struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IsCreator bool   `json:"isCreator"`
}

type roomMemberPayload struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Color     string `json:"color"`
	Linked    bool   `json:"linked"`
	IsMe      bool   `json:"isMe"`
	HasInvite bool   `json:"hasInvite"`
}

type roomDayPayload struct {
	Date        string `json:"date"`
	MemberID    string `json:"memberId"`
	HasBookings *bool  `json:"hasBookings,omitempty"`
}

type roomIncomingRequestPayload struct {
	ID           string `json:"id"`
	Date         string `json:"date"`
	FromMemberID string `json:"fromMemberId"`
}

type roomOutgoingRequestPayload struct {
	ID         string `json:"id"`
	Date       string `json:"date"`
	ToMemberID string `json:"toMemberId"`
}

type roomRequestsPayload struct {
	Incoming []roomIncomingRequestPayload `json:"incoming"`
	Outgoing []roomOutgoingRequestPayload `json:"outgoing"`
}

type roomPayload struct {
	Room       *roomInfoPayload    `json:"room"`
	MeMemberID string              `json:"meMemberId"`
	Members    []roomMemberPayload `json:"members"`
	Days       []roomDayPayload    `json:"days"`
	Requests   roomRequestsPayload `json:"requests"`
}

func toRoomMemberPayload(m models.RoomMember, meID string) roomMemberPayload {
	return roomMemberPayload{ID: m.ID, Name: m.Name, Color: m.Color, Linked: m.IsLinked(), IsMe: m.ID == meID, HasInvite: m.InviteCode != ""}
}

/***************************************************************************************************
* buildRoomPayload assembles the room as the asking specialist sees it. Days start at the Monday of
* the previous week (same window as the admin work dates; past days are read-only). hasBookings is
* reported only for days of linked members (the caller and colleagues) and is a plain boolean.
* Returns nil when the specialist is not in a room.
***************************************************************************************************/
func buildRoomPayload(specialist *models.Specialist) (*roomPayload, error) {
	view, err := db.GetRoomForSpecialist(specialist.ID)
	if err != nil || view == nil {
		return nil, err
	}
	from := adminCalendarStart(specialist.Timezone)

	payload := &roomPayload{
		Room:       &roomInfoPayload{ID: view.Room.ID, Name: view.Room.Name, IsCreator: view.Room.CreatedBy == specialist.ID},
		MeMemberID: view.MeMember.ID,
		Members:    make([]roomMemberPayload, 0, len(view.Members)),
		Days:       make([]roomDayPayload, 0),
		Requests:   roomRequestsPayload{Incoming: []roomIncomingRequestPayload{}, Outgoing: []roomOutgoingRequestPayload{}},
	}

	byID := make(map[string]models.RoomMember, len(view.Members))
	booked := make(map[string]map[string]bool) // member id -> date -> has active bookings
	for _, m := range view.Members {
		byID[m.ID] = m
		payload.Members = append(payload.Members, toRoomMemberPayload(m, view.MeMember.ID))
		if m.IsLinked() {
			counts, err := db.GetActiveBookingCountsFrom(m.SpecialistID, from)
			if err != nil {
				return nil, err
			}
			dates := make(map[string]bool, len(counts))
			for _, c := range counts {
				dates[c.Date] = true
			}
			booked[m.ID] = dates
		}
	}

	days, err := db.GetRoomDays(view.Room.ID, from)
	if err != nil {
		return nil, err
	}
	for _, d := range days {
		key := d.Date.Format("2006-01-02")
		entry := roomDayPayload{Date: key, MemberID: d.MemberID}
		if dates, ok := booked[d.MemberID]; ok {
			has := dates[key]
			entry.HasBookings = &has
		}
		payload.Days = append(payload.Days, entry)
	}

	requests, err := db.GetPendingRoomRequests(view.Room.ID)
	if err != nil {
		return nil, err
	}
	for _, rq := range requests {
		key := rq.Date.Format("2006-01-02")
		if rq.ToMemberID == view.MeMember.ID {
			payload.Requests.Incoming = append(payload.Requests.Incoming, roomIncomingRequestPayload{ID: rq.ID, Date: key, FromMemberID: rq.FromMemberID})
		}
		if rq.FromMemberID == view.MeMember.ID {
			payload.Requests.Outgoing = append(payload.Requests.Outgoing, roomOutgoingRequestPayload{ID: rq.ID, Date: key, ToMemberID: rq.ToMemberID})
		}
	}
	return payload, nil
}

/***************************************************************************************************
* writeRoomPayload answers with the caller's room, or {"room": null} when they have none.
***************************************************************************************************/
func writeRoomPayload(w http.ResponseWriter, r *http.Request, specialist *models.Specialist) {
	payload, err := buildRoomPayload(specialist)
	if err != nil {
		log.Printf("Error building room payload: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	setNoStore(w)
	if payload == nil {
		writeJSON(w, map[string]interface{}{"room": nil})
		return
	}
	writeJSON(w, payload)
}

/***************************************************************************************************
* writeRoomError maps db room errors to HTTP responses and reports whether it handled err.
* 409 conflicts carry {error, message, dates} like the work-dates conflict.
***************************************************************************************************/
func writeRoomError(w http.ResponseWriter, r *http.Request, err error) bool {
	if err == nil {
		return false
	}
	var taken *db.ErrRoomDayTaken
	var notYours *db.ErrRoomDayNotYours
	var hasBookings *db.ErrWorkDateHasBookings
	switch {
	case errors.As(err, &taken):
		writeWorkDatesConflict(w, r, "Error.RoomDayTaken", taken.Dates)
	case errors.As(err, &notYours):
		writeWorkDatesConflict(w, r, "Error.RoomDayNotYours", notYours.Dates)
	case errors.As(err, &hasBookings):
		writeWorkDatesConflict(w, r, "Error.WorkDateHasBookings", hasBookings.Dates)
	case errors.Is(err, db.ErrRoomForbidden):
		httpError(w, r, "Error.RoomForbidden", http.StatusForbidden)
	case errors.Is(err, db.ErrNotInRoom):
		httpError(w, r, "Error.RoomNotFound", http.StatusNotFound)
	case errors.Is(err, db.ErrAlreadyInRoom):
		httpError(w, r, "Error.AlreadyInRoom", http.StatusConflict)
	case errors.Is(err, db.ErrRoomFull):
		httpError(w, r, "Error.RoomFull", http.StatusConflict)
	case errors.Is(err, db.ErrInvalidColor), errors.Is(err, db.ErrInvalidName):
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
	case errors.Is(err, db.ErrMemberNotFound):
		httpError(w, r, "Error.RoomMemberNotFound", http.StatusNotFound)
	case errors.Is(err, db.ErrRoomDayPast):
		httpError(w, r, "Error.WorkDatePast", http.StatusBadRequest)
	case errors.Is(err, db.ErrRequestNotFound):
		httpError(w, r, "Error.RoomRequestNotFound", http.StatusNotFound)
	case errors.Is(err, db.ErrRequestInvalid):
		httpError(w, r, "Error.RoomRequestInvalid", http.StatusBadRequest)
	default:
		log.Printf("Room error: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
	}
	return true
}

/***************************************************************************************************
* publishRoomChange bumps the room and working-hours change groups for every linked member of the
* room (plus any extra specialist ids, e.g. a member who was just removed).
***************************************************************************************************/
func publishRoomChange(roomID string, extraSpecialistIDs ...string) {
	ids, err := db.GetRoomLinkedSpecialistIDs(roomID)
	if err != nil {
		log.Printf("Error listing room members for change publish: %v", err)
	}
	ids = append(ids, extraSpecialistIDs...)
	changes.PublishMany(ids, changes.GroupRoom, changes.GroupWorkingHours)
}

/***************************************************************************************************
* roomInviteLink builds the master bot deep link for an invite code
* (https://t.me/<master bot>?start=room_<code>); empty when the master bot is not configured.
***************************************************************************************************/
func roomInviteLink(code string) string {
	username := getMasterBotUsername()
	if username == "" || code == "" {
		return ""
	}
	return "https://t.me/" + username + "?start=room_" + code
}

/***************************************************************************************************
* requireRoom loads the caller's room view, answering 404 Error.RoomNotFound when there is none.
***************************************************************************************************/
func requireRoom(w http.ResponseWriter, r *http.Request, specialist *models.Specialist) *db.RoomView {
	view, err := db.GetRoomForSpecialist(specialist.ID)
	if err != nil {
		log.Printf("Error loading room: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return nil
	}
	if view == nil {
		httpError(w, r, "Error.RoomNotFound", http.StatusNotFound)
		return nil
	}
	return view
}

func memberInView(view *db.RoomView, memberID string) *models.RoomMember {
	for i := range view.Members {
		if view.Members[i].ID == memberID {
			return &view.Members[i]
		}
	}
	return nil
}

/***************************************************************************************************
* HandleAdminGetRoom: GET /api/admin/room -> {room: null} or the room payload.
***************************************************************************************************/
func HandleAdminGetRoom(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	writeRoomPayload(w, r, specialist)
}

/***************************************************************************************************
* HandleAdminCreateRoom: POST /api/admin/room {name} - creates the caller's room (409
* Error.AlreadyInRoom when they already have one) and switches them to dates mode.
***************************************************************************************************/
func HandleAdminCreateRoom(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	room, err := db.CreateRoom(specialist.ID, req.Name)
	if writeRoomError(w, r, err) {
		return
	}
	publishRoomChange(room.ID)
	writeRoomPayload(w, r, specialist)
}

/***************************************************************************************************
* HandleAdminUpdateRoom: PUT /api/admin/room {name} - renames the room (any linked member).
***************************************************************************************************/
func HandleAdminUpdateRoom(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	view := requireRoom(w, r, specialist)
	if view == nil {
		return
	}
	if writeRoomError(w, r, db.UpdateRoomName(view.Room.ID, req.Name)) {
		return
	}
	publishRoomChange(view.Room.ID)
	writeRoomPayload(w, r, specialist)
}

/***************************************************************************************************
* HandleAdminAddRoomMember: POST /api/admin/room/members {name, color, invite} ->
* {member, inviteLink?} (inviteLink only when invite=true).
***************************************************************************************************/
func HandleAdminAddRoomMember(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	var req struct {
		Name   string `json:"name"`
		Color  string `json:"color"`
		Invite bool   `json:"invite"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	view := requireRoom(w, r, specialist)
	if view == nil {
		return
	}

	member, err := db.AddOfflineMember(view.Room.ID, req.Name, req.Color, req.Invite)
	if writeRoomError(w, r, err) {
		return
	}
	publishRoomChange(view.Room.ID)

	resp := struct {
		Member     roomMemberPayload `json:"member"`
		InviteLink string            `json:"inviteLink,omitempty"`
	}{Member: toRoomMemberPayload(*member, view.MeMember.ID)}
	if req.Invite {
		resp.InviteLink = roomInviteLink(member.InviteCode)
	}
	writeJSON(w, resp)
}

/***************************************************************************************************
* HandleAdminUpdateRoomMember: PUT /api/admin/room/members/{id} {name?, color?}. Names can only be
* changed for offline members; colors for the caller and offline members (403 Error.RoomForbidden
* otherwise). Responds with the room payload.
***************************************************************************************************/
func HandleAdminUpdateRoomMember(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	var req struct {
		Name  *string `json:"name"`
		Color *string `json:"color"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	view := requireRoom(w, r, specialist)
	if view == nil {
		return
	}
	target := memberInView(view, chi.URLParam(r, "id"))
	if target == nil {
		httpError(w, r, "Error.RoomMemberNotFound", http.StatusNotFound)
		return
	}
	if target.IsLinked() && target.ID != view.MeMember.ID {
		httpError(w, r, "Error.RoomForbidden", http.StatusForbidden)
		return
	}

	if _, err := db.UpdateMember(target.ID, req.Name, req.Color); writeRoomError(w, r, err) {
		return
	}
	publishRoomChange(view.Room.ID)
	writeRoomPayload(w, r, specialist)
}

/***************************************************************************************************
* HandleAdminRemoveRoomMember: DELETE /api/admin/room/members/{id}. Removes an offline member, a
* linked colleague (room creator only) or the caller themself (leaving; the room disappears when no
* linked member remains). Responds with the caller's room payload ({room: null} after leaving).
***************************************************************************************************/
func HandleAdminRemoveRoomMember(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	view := requireRoom(w, r, specialist)
	if view == nil {
		return
	}
	memberID := chi.URLParam(r, "id")
	if memberInView(view, memberID) == nil {
		httpError(w, r, "Error.RoomMemberNotFound", http.StatusNotFound)
		return
	}
	before, _ := db.GetRoomLinkedSpecialistIDs(view.Room.ID)

	result, err := db.RemoveMember(specialist.ID, memberID)
	if writeRoomError(w, r, err) {
		return
	}

	changes.PublishMany(before, changes.GroupRoom, changes.GroupWorkingHours)
	if result.RemovedSpecialistID != "" && result.RemovedSpecialistID != specialist.ID && NotifyRoomMemberRemovedFunc != nil {
		if err := NotifyRoomMemberRemovedFunc(result.RoomName, result.RemovedSpecialistID); err != nil {
			log.Printf("Error notifying removed room member: %v", err)
		}
	}
	writeRoomPayload(w, r, specialist)
}

/***************************************************************************************************
* HandleAdminRoomMemberInvite: POST /api/admin/room/members/{id}/invite -> {inviteLink}. Issues a
* fresh invite for an offline member (older links stop working).
***************************************************************************************************/
func HandleAdminRoomMemberInvite(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	view := requireRoom(w, r, specialist)
	if view == nil {
		return
	}
	target := memberInView(view, chi.URLParam(r, "id"))
	if target == nil {
		httpError(w, r, "Error.RoomMemberNotFound", http.StatusNotFound)
		return
	}

	code, err := db.RegenerateInvite(target.ID)
	if writeRoomError(w, r, err) {
		return
	}
	link := roomInviteLink(code)
	if link == "" {
		httpError(w, r, "Error.Internal", http.StatusServiceUnavailable)
		return
	}
	publishRoomChange(view.Room.ID)
	writeJSON(w, map[string]string{"inviteLink": link})
}

/***************************************************************************************************
* HandleAdminAssignRoomDays: PUT /api/admin/room/days {assign:[{date, memberId}]} ("" memberId frees
* the date). All-or-nothing; responds with the room payload. 409 Error.RoomDayNotYours /
* Error.RoomDayTaken / Error.WorkDateHasBookings carry the conflicting dates; 403
* Error.RoomForbidden for targets the caller may not assign to; 400 Error.WorkDatePast for past
* dates.
***************************************************************************************************/
func HandleAdminAssignRoomDays(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	var req struct {
		Assign []struct {
			Date     string `json:"date"`
			MemberID string `json:"memberId"`
		} `json:"assign"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Assign) > maxWorkDatesPerRequest {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	view := requireRoom(w, r, specialist)
	if view == nil {
		return
	}

	assigns := make([]db.RoomDayAssign, 0, len(req.Assign))
	today := specialistToday(specialist.Timezone)
	for _, a := range req.Assign {
		date, err := time.Parse("2006-01-02", a.Date)
		if err != nil {
			httpError(w, r, "Error.BadDate", http.StatusBadRequest)
			return
		}
		if date.Before(today) {
			httpError(w, r, "Error.WorkDatePast", http.StatusBadRequest)
			return
		}
		assigns = append(assigns, db.RoomDayAssign{Date: date, MemberID: a.MemberID})
	}

	result, err := db.AssignRoomDays(specialist.ID, assigns)
	if writeRoomError(w, r, err) {
		return
	}
	if len(result.Changed) > 0 {
		publishRoomChange(view.Room.ID)
	}
	if len(result.ClaimedFree) > 0 && NotifyRoomDaysClaimedFunc != nil {
		if err := NotifyRoomDaysClaimedFunc(view.Room.ID, specialist.ID, result.ClaimedFree); err != nil {
			log.Printf("Error notifying room about claimed days: %v", err)
		}
	}
	writeRoomPayload(w, r, specialist)
}

/***************************************************************************************************
* HandleAdminCreateRoomRequest: POST /api/admin/room/requests {date} - asks the linked owner of a
* date to give it up. A repeated request returns the existing one without notifying again.
***************************************************************************************************/
func HandleAdminCreateRoomRequest(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	var req struct {
		Date string `json:"date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		httpError(w, r, "Error.BadDate", http.StatusBadRequest)
		return
	}
	view := requireRoom(w, r, specialist)
	if view == nil {
		return
	}

	request, created, err := db.CreateDayRequest(specialist.ID, date)
	if writeRoomError(w, r, err) {
		return
	}
	if created {
		publishRoomChange(view.Room.ID)
		if NotifyRoomDayRequestFunc != nil {
			if err := NotifyRoomDayRequestFunc(request); err != nil {
				log.Printf("Error notifying room day request: %v", err)
			}
		}
	}
	writeRoomPayload(w, r, specialist)
}

func resolveRoomRequest(w http.ResponseWriter, r *http.Request, accept bool) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	view := requireRoom(w, r, specialist)
	if view == nil {
		return
	}

	request, err := db.ResolveDayRequest(specialist.ID, chi.URLParam(r, "id"), accept)
	if writeRoomError(w, r, err) {
		return
	}
	publishRoomChange(view.Room.ID)
	if NotifyRoomDayRequestResolvedFunc != nil {
		if err := NotifyRoomDayRequestResolvedFunc(request, accept); err != nil {
			log.Printf("Error notifying room day request result: %v", err)
		}
	}
	writeRoomPayload(w, r, specialist)
}

/***************************************************************************************************
* HandleAdminAcceptRoomRequest: POST /api/admin/room/requests/{id}/accept - the owner hands the
* date over (409 Error.WorkDateHasBookings with dates while they have bookings that day).
***************************************************************************************************/
func HandleAdminAcceptRoomRequest(w http.ResponseWriter, r *http.Request) {
	resolveRoomRequest(w, r, true)
}

/***************************************************************************************************
* HandleAdminDeclineRoomRequest: POST /api/admin/room/requests/{id}/decline.
***************************************************************************************************/
func HandleAdminDeclineRoomRequest(w http.ResponseWriter, r *http.Request) {
	resolveRoomRequest(w, r, false)
}

/***************************************************************************************************
* HandleAdminCancelRoomRequest: DELETE /api/admin/room/requests/{id} - the requester withdraws it.
***************************************************************************************************/
func HandleAdminCancelRoomRequest(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	view := requireRoom(w, r, specialist)
	if view == nil {
		return
	}
	if _, err := db.CancelDayRequest(specialist.ID, chi.URLParam(r, "id")); writeRoomError(w, r, err) {
		return
	}
	publishRoomChange(view.Room.ID)
	writeRoomPayload(w, r, specialist)
}
