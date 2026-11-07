package api

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/telegram"
)

/***************************************************************************************************
* HandleGetPhoto proxies a photo from Telegram's file API. GET /api/photo/{fileId}. notification
* helpers.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleGetPhoto(w http.ResponseWriter, r *http.Request) {
	fileID := chi.URLParam(r, "fileId")
	if fileID == "" {
		httpError(w, r, "Error.PhotoFileIDRequired", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* File IDs are unguessable Telegram tokens, and image tags cannot reliably attach auth headers.
	* Prefer the specialist from the URL when present; otherwise try all active specialists because
	* Telegram file IDs are bot-scoped.
	***************************************************************************************************/
	specialistID := requestSpecialistID(r)
	if specialistID != "" {
		specialist, err := db.GetSpecialistByID(specialistID)
		if err != nil || specialist == nil {
			httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
			return
		}
		if !specialist.IsActive || specialist.DeletedAt != nil {
			httpError(w, r, "Error.BotDeleted", http.StatusGone)
			return
		}
		if proxyTelegramFile(w, specialist.BotToken, fileID) {
			return
		}
		httpError(w, r, "Error.PhotoFetchFailed", http.StatusBadGateway)
		return
	}

	specialists, err := db.GetAllActiveSpecialists()
	if err != nil || len(specialists) == 0 {
		httpError(w, r, "Error.SpecialistNotConfigured", http.StatusInternalServerError)
		return
	}

	for _, specialist := range specialists {
		if proxyTelegramFile(w, specialist.BotToken, fileID) {
			return
		}
	}

	log.Printf("GetFile error: no specialist bot could resolve file_id %s", truncateForLog(fileID, 20))
	httpError(w, r, "Error.PhotoFetchFailed", http.StatusBadGateway)
}

func proxyTelegramFile(w http.ResponseWriter, botToken string, fileID string) bool {
	bot := &telegram.Bot{Token: botToken}
	data, contentType, err := bot.GetFile(fileID)
	if err != nil {
		log.Printf("GetFile error: %v", err)
		return false
	}
	w.Header().Set("Content-Type", contentType)
	setPublicCache(w, 3600, true)
	w.Write(data)
	return true
}

/***************************************************************************************************
* Implements the truncate for log logic used by this module.
*
* Parameters:
* - value: Input data consumed by the current operation.
* - max: Max used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func truncateForLog(value string, max int) string {
	if len(value) <= max {
		return value
	}
	return value[:max]
}
