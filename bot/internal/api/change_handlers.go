package api

import (
	"net/http"

	"scheduler-bot/internal/changes"
)

/***************************************************************************************************
* HandleGetChangeVersions returns small per-resource counters for lightweight frontend sync.
***************************************************************************************************/
func HandleGetChangeVersions(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	setNoStore(w)
	writeJSON(w, changes.Snapshot(specialist.ID))
}
