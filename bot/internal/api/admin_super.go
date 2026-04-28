package api

import (
	"log"
	"net/http"

	"scheduler-bot/internal/db"
)

type SpecialistListItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	BotUsername string `json:"botUsername"`
	IsActive    bool   `json:"isActive"`
	CreatedAt   string `json:"createdAt"`
}

func HandleListAllSpecialists(w http.ResponseWriter, r *http.Request) {
	specialists, err := db.GetAllActiveSpecialists()
	if err != nil {
		log.Printf("Error getting specialists: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	result := make([]SpecialistListItem, len(specialists))
	for i, specialist := range specialists {
		result[i] = SpecialistListItem{
			ID:          specialist.ID,
			Name:        specialist.Name,
			BotUsername: specialist.BotUsername,
			IsActive:    specialist.IsActive,
			CreatedAt:   specialist.CreatedAt.Format("2006-01-02 15:04:05"),
		}
	}

	writeJSON(w, result)
}
