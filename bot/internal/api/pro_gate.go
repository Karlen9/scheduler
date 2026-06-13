package api

import (
	"net/http"
	"time"

	"scheduler-bot/internal/models"
)

// requirePro writes a 402 and returns false if the specialist is not Pro.
// Call it after the specialist is resolved from context. If it returns false,
// the handler must return immediately.
func requirePro(w http.ResponseWriter, r *http.Request, s *models.Specialist) bool {
	if s.IsPro(time.Now()) {
		return true
	}
	httpError(w, r, "Error.ProRequired", http.StatusPaymentRequired)
	return false
}
