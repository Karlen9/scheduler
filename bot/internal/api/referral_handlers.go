package api

import (
	"log"
	"net/http"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* ReferralClient is the per-client entry in the admin referrals response.
***************************************************************************************************/
type ReferralClient struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	DisplayName    string `json:"displayName,omitempty"`
	PhotoURL       string `json:"photoUrl,omitempty"`
	CreatedAt      string `json:"createdAt"`
	TelegramUserID int64  `json:"telegramUserId,omitempty"`
	IsBlocked      bool   `json:"isBlocked,omitempty"`
}

/***************************************************************************************************
* ReferralsResponse is returned by GET /api/admin/referrals.
***************************************************************************************************/
type ReferralsResponse struct {
	Code      string           `json:"code"`
	Link      string           `json:"link"`
	Count     int              `json:"count"`
	Referrals []ReferralClient `json:"referrals"`
}

/***************************************************************************************************
* HandleAdminGetReferrals returns the current specialist's referral code, shareable link, and
* the list of clients acquired via that link. Self-heals missing referral codes on the first
* request by generating one.
***************************************************************************************************/
func HandleAdminGetReferrals(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	code := specialist.ReferralCode
	if code == "" {
		ensured, err := db.EnsureSpecialistReferralCode(specialist.ID)
		if err != nil {
			log.Printf("Error ensuring referral code: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
		code = ensured
	}

	referred, err := db.GetReferredClientsBySpecialist(specialist.ID, code)
	if err != nil {
		log.Printf("Error listing referred clients: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	resp := ReferralsResponse{
		Code:      code,
		Link:      buildReferralLink(specialist.BotUsername, code),
		Count:     len(referred),
		Referrals: make([]ReferralClient, 0, len(referred)),
	}
	for _, c := range referred {
		resp.Referrals = append(resp.Referrals, toReferralClient(c))
	}

	writeJSON(w, resp)
}

func buildReferralLink(botUsername, code string) string {
	if botUsername == "" {
		return "https://t.me/?start=ref_" + code
	}
	return "https://t.me/" + botUsername + "?start=ref_" + code
}

func toReferralClient(c models.Client) ReferralClient {
	return ReferralClient{
		ID:             c.ID,
		Name:           c.Name,
		DisplayName:    c.DisplayName,
		PhotoURL:       c.PhotoURL,
		CreatedAt:      c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		TelegramUserID: c.TelegramUserID,
		IsBlocked:      c.IsBlocked,
	}
}
