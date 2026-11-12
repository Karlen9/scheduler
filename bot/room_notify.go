package main

import (
	"log"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
	"scheduler-bot/internal/telegram"
)

/***************************************************************************************************
* roomRecipient resolves a specialist and the handler of THEIR OWN bot (notifications about shared
* rooms always go through the recipient's bot). Both are nil when the specialist or the bot cannot
* be found; a missing bot is logged and skipped rather than treated as a failure.
***************************************************************************************************/
func roomRecipient(specialistID string) (*models.Specialist, *telegram.Handler) {
	specialist, err := db.GetSpecialistByID(specialistID)
	if err != nil || specialist == nil {
		return nil, nil
	}
	handler := botManager.GetHandler(specialist.WebhookSecret)
	if handler == nil {
		log.Printf("Room notification: no bot handler for specialist %s", specialist.Name)
		return specialist, nil
	}
	return specialist, handler
}

/***************************************************************************************************
* roomMemberName returns a room member's display name ("" when unknown).
***************************************************************************************************/
func roomMemberName(memberID string) string {
	member, err := db.GetRoomMemberByID(memberID)
	if err != nil || member == nil {
		return ""
	}
	return member.Name
}

/***************************************************************************************************
* notifyRoomOthers runs send for every linked member of the room except `exceptSpecialistID`.
***************************************************************************************************/
func notifyRoomOthers(roomID, exceptSpecialistID string, send func(*models.Specialist, *telegram.Handler) error) error {
	ids, err := db.GetRoomLinkedSpecialistIDs(roomID)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if id == exceptSpecialistID {
			continue
		}
		recipient, handler := roomRecipient(id)
		if recipient == nil || handler == nil {
			continue
		}
		if err := send(recipient, handler); err != nil {
			log.Printf("Room notification to specialist %s failed: %v", id, err)
		}
	}
	return nil
}

/***************************************************************************************************
* wireRoomNotifications connects the shared-room notification hooks of the API and the Telegram
* package to the per-specialist bots.
***************************************************************************************************/
func wireRoomNotifications() {
	// A colleague asks for a date: [Give]/[Decline] message to the date's owner.
	api.NotifyRoomDayRequestFunc = func(request *models.RoomDayRequest) error {
		toMember, err := db.GetRoomMemberByID(request.ToMemberID)
		if err != nil || toMember == nil || toMember.SpecialistID == "" {
			return err
		}
		room, err := db.GetRoomByID(request.RoomID)
		if err != nil || room == nil {
			return err
		}
		owner, handler := roomRecipient(toMember.SpecialistID)
		if owner == nil || handler == nil {
			return nil
		}
		return handler.NotifyRoomDayRequest(owner, roomMemberName(request.FromMemberID), room.Name, request.Date, request.ID)
	}

	// The owner answered (from the mini-app or the bot): tell the requester via their own bot.
	notifyResolved := func(request *models.RoomDayRequest, accepted bool) error {
		fromMember, err := db.GetRoomMemberByID(request.FromMemberID)
		if err != nil || fromMember == nil || fromMember.SpecialistID == "" {
			return err
		}
		requester, handler := roomRecipient(fromMember.SpecialistID)
		if requester == nil || handler == nil {
			return nil
		}
		return handler.NotifyRoomDayRequestResult(requester, roomMemberName(request.ToMemberID), request.Date, accepted)
	}
	api.NotifyRoomDayRequestResolvedFunc = notifyResolved
	telegram.OnRoomRequestResolved = func(request *models.RoomDayRequest, accepted bool) {
		if err := notifyResolved(request, accepted); err != nil {
			log.Printf("Error notifying room day request result: %v", err)
		}
	}

	// A member took free dates: one message per save to the other linked members.
	api.NotifyRoomDaysClaimedFunc = func(roomID, actorSpecialistID string, dates []string) error {
		actor, err := db.GetSpecialistByID(actorSpecialistID)
		if err != nil || actor == nil {
			return err
		}
		actorName := actor.Name
		if member, err := db.GetRoomForSpecialist(actorSpecialistID); err == nil && member != nil {
			actorName = member.MeMember.Name
		}
		return notifyRoomOthers(roomID, actorSpecialistID, func(recipient *models.Specialist, handler *telegram.Handler) error {
			return handler.NotifyRoomDaysClaimed(recipient, actorName, dates)
		})
	}

	// A colleague was excluded: tell them through their own bot.
	api.NotifyRoomMemberRemovedFunc = func(roomName, removedSpecialistID string) error {
		removed, handler := roomRecipient(removedSpecialistID)
		if removed == nil || handler == nil {
			return nil
		}
		return handler.NotifyRoomMemberRemoved(removed, roomName)
	}

	// Someone joined through the master bot: tell the other linked members.
	telegram.OnRoomMemberJoined = func(roomID, joinerSpecialistID string) {
		room, err := db.GetRoomByID(roomID)
		if err != nil || room == nil {
			return
		}
		joinerName := ""
		if view, err := db.GetRoomForSpecialist(joinerSpecialistID); err == nil && view != nil {
			joinerName = view.MeMember.Name
		}
		_ = notifyRoomOthers(roomID, joinerSpecialistID, func(recipient *models.Specialist, handler *telegram.Handler) error {
			return handler.NotifyRoomMemberJoined(recipient, joinerName, room.Name)
		})
	}
}
