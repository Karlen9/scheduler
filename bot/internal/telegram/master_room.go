package telegram

import (
	"errors"
	"log"
	"strconv"
	"strings"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Callback data of the invitation message sent by the master bot:
* "m:room:acc:<code>" (accept) / "m:room:dec:<code>" (decline). The "m:" prefix routes it through
* the master dispatcher; the 16-char invite code keeps it well under Telegram's 64-byte limit.
***************************************************************************************************/
const (
	cbRoomAcceptPrefix  = "m:room:acc:"
	cbRoomDeclinePrefix = "m:room:dec:"
)

/***************************************************************************************************
* handleRoomInviteStart handles "/start room_<code>".
* - Existing specialist: show who invites them with [Accept]/[Decline] buttons (or explain that they
*   must leave their current room first).
* - Not a specialist yet: remember the code (like pendingRefs, same TTL), explain they must create
*   their bot first, and run the normal /start flow; the join happens after onboarding.
***************************************************************************************************/
func (h *MasterHandler) handleRoomInviteStart(chatID, userID int64, code string, loc *localizerType) {
	preview, err := db.GetRoomInvite(code)
	if err != nil {
		if errors.Is(err, db.ErrInviteInvalid) {
			h.bot.SendMessage(chatID, myI18n.T(loc, "MasterRoom.InvalidInvite"), nil)
			h.handleStart(chatID, userID, loc)
			return
		}
		log.Printf("master: room invite lookup failed: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	specialist, err := db.GetSpecialistByTelegramID(userID)
	if err != nil {
		log.Printf("master: specialist lookup for room invite failed: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	if specialist == nil || !specialist.IsActive {
		h.rememberPendingRoom(userID, code)
		h.bot.SendMessage(chatID, myI18n.Tf(loc, "MasterRoom.NeedBotFirst", map[string]interface{}{"Room": preview.Room.Name}), nil)
		h.handleStart(chatID, userID, loc)
		return
	}

	if existing, err := db.GetRoomForSpecialist(specialist.ID); err == nil && existing != nil {
		h.bot.SendMessage(chatID, myI18n.T(loc, "MasterRoom.AlreadyInRoom"), nil)
		return
	}

	text := myI18n.Tf(loc, "MasterRoom.Invite", map[string]interface{}{"Inviter": preview.CreatorName, "Room": preview.Room.Name})
	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{{
			{Text: myI18n.T(loc, "MasterRoom.BtnAccept"), CallbackData: cbRoomAcceptPrefix + code},
			{Text: myI18n.T(loc, "MasterRoom.BtnDecline"), CallbackData: cbRoomDeclinePrefix + code},
		}},
	}
	h.bot.SendMessage(chatID, text, keyboard)
}

/***************************************************************************************************
* handleRoomInviteCallback processes the [Accept]/[Decline] buttons of an invitation. Only a
* registered specialist (the presser) can accept; the join itself is transactional.
***************************************************************************************************/
func (h *MasterHandler) handleRoomInviteCallback(chatID, userID int64, messageID int, data string, loc *localizerType) {
	if strings.HasPrefix(data, cbRoomDeclinePrefix) {
		h.editOrSend(chatID, messageID, myI18n.T(loc, "MasterRoom.Declined"), nil)
		return
	}
	if !strings.HasPrefix(data, cbRoomAcceptPrefix) {
		return
	}
	code := strings.TrimPrefix(data, cbRoomAcceptPrefix)

	specialist, err := db.GetSpecialistByTelegramID(userID)
	if err != nil || specialist == nil || !specialist.IsActive {
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), nil)
		return
	}
	h.joinRoomAndReport(chatID, specialist, code, loc, messageID)
}

/***************************************************************************************************
* joinRoomAndReport joins the room behind an invite code and tells the user what happened
* (including dates that stayed with them because of bookings), then notifies the other linked
* members through their own bots. An optional messageID turns the invitation message into the result.
***************************************************************************************************/
func (h *MasterHandler) joinRoomAndReport(chatID int64, specialist *models.Specialist, code string, loc *localizerType, messageID ...int) {
	reply := func(text string) {
		if len(messageID) > 0 && messageID[0] > 0 {
			h.editOrSend(chatID, messageID[0], text, nil)
			return
		}
		h.bot.SendMessage(chatID, text, nil)
	}

	result, err := db.JoinRoomByInvite(code, specialist.ID)
	if err != nil {
		switch {
		case errors.Is(err, db.ErrInviteInvalid):
			reply(myI18n.T(loc, "MasterRoom.InvalidInvite"))
		case errors.Is(err, db.ErrAlreadyInRoom):
			reply(myI18n.T(loc, "MasterRoom.AlreadyInRoom"))
		default:
			log.Printf("master: join room failed for specialist %s: %v", specialist.ID, err)
			reply(myI18n.T(loc, "Master.Error"))
		}
		return
	}

	text := myI18n.Tf(loc, "MasterRoom.Joined", map[string]interface{}{
		"Room": result.Room.Name, "Count": strconv.Itoa(result.CarriedOver),
	})
	if len(result.Conflicts) > 0 {
		text += "\n\n" + myI18n.Tf(loc, "MasterRoom.JoinedConflicts", map[string]interface{}{
			"Dates": formatRoomDates(loc, result.Conflicts),
		})
	}
	reply(text)

	if ids, err := db.GetRoomLinkedSpecialistIDs(result.Room.ID); err == nil {
		changes.PublishMany(ids, changes.GroupRoom, changes.GroupWorkingHours)
	}
	if OnRoomMemberJoined != nil {
		OnRoomMemberJoined(result.Room.ID, specialist.ID)
	}
}
