package api

import (
	"log"
	"net/http"

	"scheduler-bot/internal/db"
)

/***************************************************************************************************
* Handles get client stats.
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
func HandleGetClientStats(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	client := GetClientFromContext(r)
	if specialist == nil || client == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}

	stats, err := db.GetClientStats(specialist.ID, client.ID, specialist.Timezone)
	if err != nil {
		log.Printf("Error getting client stats: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	setPrivateCache(w, 60, 300)
	writeJSON(w, stats)
}

/***************************************************************************************************
* Handles get admin stats.
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
func HandleGetAdminStats(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
		return
	}
	if !requirePro(w, r, specialist) {
		return
	}

	stats, err := db.GetAdminStats(specialist.ID, specialist.Timezone)
	if err != nil {
		log.Printf("Error getting admin stats: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	setPrivateCache(w, 60, 300)
	writeJSON(w, stats)
}
