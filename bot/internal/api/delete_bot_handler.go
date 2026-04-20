package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"scheduler-bot/internal/db"
)

/***************************************************************************************************
* UnregisterBotFunc is wired up by main.go to remove a bot+handler from the in-memory BotManager
* and call Telegram deleteWebhook so updates stop flowing. Kept as a package-level var so the api
* package does not need to import the BotManager type.
***************************************************************************************************/
var UnregisterBotFunc func(webhookSecret string) error

/***************************************************************************************************
* DeleteBotRequest is the body of DELETE /api/admin/specialist. The caller must pass the exact
* confirmation phrase ("delete my bot" or "удалить бота", case-insensitive, whitespace ignored)
* so accidental taps cannot trigger deletion.
***************************************************************************************************/
type DeleteBotRequest struct {
	Confirm string `json:"confirm"`
}

/***************************************************************************************************
* Accepted confirmation phrases, normalised to lowercase with inner whitespace collapsed.
***************************************************************************************************/
var deleteBotConfirmPhrases = []string{
	"delete my bot",
	"удалить бота",
}

func normaliseConfirmPhrase(s string) string {
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}

func isValidDeleteConfirmPhrase(s string) bool {
	norm := normaliseConfirmPhrase(s)
	for _, p := range deleteBotConfirmPhrases {
		if norm == p {
			return true
		}
	}
	return false
}

/***************************************************************************************************
* HandleAdminDeleteBot tears down the current specialist's bot. Child rows (bookings, recurring,
* clients, days_off, working_hours, session_types) are removed in one transaction; the specialist
* row is anonymised and flagged deleted_at so it no longer appears in active queries but survives
* for future stats. Finally, the in-memory handler is dropped and the Telegram webhook is
* released. Requires the confirmation phrase to be present in the body.
***************************************************************************************************/
func HandleAdminDeleteBot(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req DeleteBotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	if !isValidDeleteConfirmPhrase(req.Confirm) {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* Capture webhook secret BEFORE the cascade clears the row so UnregisterBotFunc can still find
	* the bot in-memory.
	***************************************************************************************************/
	webhookSecret := specialist.WebhookSecret

	if err := db.SoftDeleteSpecialistCascade(specialist.ID); err != nil {
		log.Printf("Error soft-deleting specialist %s: %v", specialist.ID, err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if UnregisterBotFunc != nil {
		if err := UnregisterBotFunc(webhookSecret); err != nil {
			/***************************************************************************************************
			* Webhook cleanup is best-effort — Telegram may 5xx, we may be offline. The DB side is already
			* durable so we only log.
			***************************************************************************************************/
			log.Printf("UnregisterBot for %s failed (non-fatal): %v", specialist.ID, err)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}
