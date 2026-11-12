package telegram

import (
	"errors"
	"log"
	"strconv"
	"strings"
	"time"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Callback data prefixes of the "give me this day" request message sent to a date's owner.
* Format: "rdr_ok:<requestId>" (give) / "rdr_no:<requestId>" (decline).
***************************************************************************************************/
const (
	roomRequestOKPrefix = "rdr_ok:"
	roomRequestNoPrefix = "rdr_no:"
)

/***************************************************************************************************
* OnRoomRequestResolved is invoked after a day request was resolved from the specialist bot, so
* main.go can notify the requester through THEIR bot (a Handler only knows its own bot).
***************************************************************************************************/
var OnRoomRequestResolved func(request *models.RoomDayRequest, accepted bool)

/***************************************************************************************************
* OnRoomMemberJoined is invoked after a specialist joined a room through the master bot, so main.go
* can tell the other linked members through their own bots.
***************************************************************************************************/
var OnRoomMemberJoined func(roomID, joinerSpecialistID string)

/***************************************************************************************************
* formatRoomDate renders a calendar date for mid-sentence use in room messages: lowercase weekday
* and the month in the genitive in Russian ("чт, 20 ноября"), "Thu, Nov 20" in English. It has its
* own i18n keys so the shared booking date formatter keeps its output.
***************************************************************************************************/
func formatRoomDate(loc *localizerType, t time.Time) string {
	return myI18n.Tf(loc, "RoomDate.Format", map[string]interface{}{
		"Weekday": myI18n.T(loc, "RoomDate.Wd"+strconv.Itoa(int(t.Weekday()))),
		"Day":     t.Day(),
		"Month":   myI18n.T(loc, "RoomDate.M"+strconv.Itoa(int(t.Month()))),
	})
}

/***************************************************************************************************
* formatRoomDates joins several "YYYY-MM-DD" dates as "чт, 20 ноября; пт, 21 ноября".
***************************************************************************************************/
func formatRoomDates(loc *localizerType, dates []string) string {
	parts := make([]string, 0, len(dates))
	for _, d := range dates {
		if t, err := time.Parse("2006-01-02", d); err == nil {
			parts = append(parts, formatRoomDate(loc, t))
		}
	}
	return strings.Join(parts, "; ")
}

func roomLocalizer(specialist *models.Specialist) *localizerType {
	return myI18n.NewLocalizer(specialist.Language, "ru")
}

/***************************************************************************************************
* NotifyRoomDayRequest asks the owner of a date to give it to a colleague, with [Give]/[Decline]
* inline buttons (callback data rdr_ok:<id> / rdr_no:<id>).
***************************************************************************************************/
func (h *Handler) NotifyRoomDayRequest(owner *models.Specialist, requesterName, roomName string, date time.Time, requestID string) error {
	loc := roomLocalizer(owner)
	text := myI18n.Tf(loc, "Room.RequestText", map[string]interface{}{
		"Name": requesterName, "Date": formatRoomDate(loc, date), "Room": roomName,
	})
	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{{
			{Text: myI18n.T(loc, "Room.BtnGive"), CallbackData: roomRequestOKPrefix + requestID},
			{Text: myI18n.T(loc, "Room.BtnDecline"), CallbackData: roomRequestNoPrefix + requestID},
		}},
	}
	_, err := h.Bot.SendMessage(owner.TelegramUserID, text, keyboard)
	return err
}

/***************************************************************************************************
* NotifyRoomDayRequestResult tells the requester whether the owner gave the date away.
***************************************************************************************************/
func (h *Handler) NotifyRoomDayRequestResult(requester *models.Specialist, ownerName string, date time.Time, accepted bool) error {
	loc := roomLocalizer(requester)
	key := "Room.RequesterDeclined"
	if accepted {
		key = "Room.RequesterAccepted"
	}
	text := myI18n.Tf(loc, key, map[string]interface{}{"Name": ownerName, "Date": formatRoomDate(loc, date)})
	_, err := h.Bot.SendMessage(requester.TelegramUserID, text, nil)
	return err
}

/***************************************************************************************************
* NotifyRoomDaysClaimed tells a colleague which free dates a member took (one message per save).
***************************************************************************************************/
func (h *Handler) NotifyRoomDaysClaimed(recipient *models.Specialist, actorName string, dates []string) error {
	loc := roomLocalizer(recipient)
	text := myI18n.Tf(loc, "Room.DaysClaimed", map[string]interface{}{"Name": actorName, "Dates": formatRoomDates(loc, dates)})
	_, err := h.Bot.SendMessage(recipient.TelegramUserID, text, nil)
	return err
}

/***************************************************************************************************
* NotifyRoomMemberJoined tells a colleague that someone joined the room.
***************************************************************************************************/
func (h *Handler) NotifyRoomMemberJoined(recipient *models.Specialist, joinerName, roomName string) error {
	loc := roomLocalizer(recipient)
	text := myI18n.Tf(loc, "Room.MemberJoined", map[string]interface{}{"Name": joinerName, "Room": roomName})
	_, err := h.Bot.SendMessage(recipient.TelegramUserID, text, nil)
	return err
}

/***************************************************************************************************
* NotifyRoomMemberRemoved tells a linked member they were excluded from the room.
***************************************************************************************************/
func (h *Handler) NotifyRoomMemberRemoved(recipient *models.Specialist, roomName string) error {
	loc := roomLocalizer(recipient)
	text := myI18n.Tf(loc, "Room.MemberRemoved", map[string]interface{}{"Room": roomName})
	_, err := h.Bot.SendMessage(recipient.TelegramUserID, text, nil)
	return err
}

/***************************************************************************************************
* handleRoomRequestCallback processes the owner's [Give]/[Decline] press (rdr_ok:/rdr_no:). The
* presser must be the Telegram user of the specialist who owns this bot AND the addressed owner of
* the request; anything else is ignored silently. While the owner still has bookings on the date,
* the callback is answered with a hint and the buttons stay.
***************************************************************************************************/
func (h *Handler) handleRoomRequestCallback(update Update) {
	cq := update.CallbackQuery
	accept := strings.HasPrefix(cq.Data, roomRequestOKPrefix)
	requestID := strings.TrimPrefix(strings.TrimPrefix(cq.Data, roomRequestOKPrefix), roomRequestNoPrefix)

	specialist, err := db.GetSpecialistByBotToken(h.Bot.Token)
	if err != nil || specialist == nil || cq.From.ID != specialist.TelegramUserID {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}
	loc := roomLocalizer(specialist)

	request, err := db.GetRoomDayRequest(requestID)
	if err != nil || request == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Room.RequestAlreadyResolved"))
		return
	}
	toMember, err := db.GetRoomMemberByID(request.ToMemberID)
	if err != nil || toMember == nil || toMember.SpecialistID != specialist.ID {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}
	fromMember, _ := db.GetRoomMemberByID(request.FromMemberID)

	resolved, err := db.ResolveDayRequest(specialist.ID, requestID, accept)
	if err != nil {
		var hasBookings *db.ErrWorkDateHasBookings
		switch {
		case errors.As(err, &hasBookings):
			h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Room.NeedMoveBookings"))
		case errors.Is(err, db.ErrRequestInvalid), errors.Is(err, db.ErrRequestNotFound), errors.Is(err, db.ErrRoomDayPast):
			h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Room.RequestAlreadyResolved"))
			if cq.Message != nil {
				_ = h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID, myI18n.T(loc, "Room.RequestAlreadyResolved"), nil)
			}
		case errors.Is(err, db.ErrRoomForbidden):
			h.Bot.AnswerCallbackQuery(cq.ID, "")
		default:
			log.Printf("Error resolving room day request via callback: %v", err)
			h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.Error"))
		}
		return
	}

	requesterName := ""
	if fromMember != nil {
		requesterName = fromMember.Name
	}
	key := "Room.RequestDeclinedOwner"
	if accept {
		key = "Room.RequestGiven"
	}
	text := myI18n.Tf(loc, key, map[string]interface{}{"Name": requesterName, "Date": formatRoomDate(loc, resolved.Date)})
	h.Bot.AnswerCallbackQuery(cq.ID, "")
	if cq.Message != nil {
		_ = h.Bot.EditMessageText(cq.Message.Chat.ID, cq.Message.MessageID, text, nil)
	}

	if ids, err := db.GetRoomLinkedSpecialistIDs(resolved.RoomID); err == nil {
		changes.PublishMany(ids, changes.GroupRoom, changes.GroupWorkingHours)
	}
	if OnRoomRequestResolved != nil {
		OnRoomRequestResolved(resolved, accept)
	}
}
