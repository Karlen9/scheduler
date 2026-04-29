package api

import (
	"log"
	"net/http"
	"sync"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

// masterBotUsername is set once at startup from main.go. Referral links point at the master
// (recruitment) bot rather than the specialist's personal bot, since the goal of sharing is to
// bring new specialists onto the platform. A plain mutex keeps main.go's setter thread-safe
// against concurrent reads from request handlers.
var (
	masterBotMu       sync.RWMutex
	masterBotUsername string
)

// SetMasterBotUsername is called once from main.go after the master bot's getMe resolves.
func SetMasterBotUsername(username string) {
	masterBotMu.Lock()
	defer masterBotMu.Unlock()
	masterBotUsername = username
}

func getMasterBotUsername() string {
	masterBotMu.RLock()
	defer masterBotMu.RUnlock()
	return masterBotUsername
}

/***************************************************************************************************
* ReferralClient is the per-client entry in the admin referrals response (legacy — kept for the
* existing client-referral view until we deprecate it).
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

// ReferredSpecialist is the per-specialist entry in the referrals response. Active specialists
// are those with a recorded first_payment_at — the attribution is "lifetime active" once paid.
type ReferredSpecialist struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	BotUsername    string  `json:"botUsername"`
	CreatedAt      string  `json:"createdAt"`
	FirstPaymentAt *string `json:"firstPaymentAt,omitempty"`
	IsActive       bool    `json:"isActive"`
}

/***************************************************************************************************
* ReferralsResponse is returned by GET /api/admin/referrals.
*
* Link is the share link to hand out — points at the master bot, not the specialist's personal bot.
* SpecialistCount / Active / Passive describe the specialist-referral program (primary use).
* Count / Referrals describe legacy client referrals (kept for backwards compat).
***************************************************************************************************/
type ReferralsResponse struct {
	Code      string           `json:"code"`
	Link      string           `json:"link"`
	Count     int              `json:"count"`
	Referrals []ReferralClient `json:"referrals"`
	// Specialist-referral program (new surface).
	SpecialistCount int                  `json:"specialistCount"`
	ActiveCount     int                  `json:"activeCount"`
	PassiveCount    int                  `json:"passiveCount"`
	Specialists     []ReferredSpecialist `json:"specialists"`
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

	resp, err := buildReferralsResponse(specialist)
	if err != nil {
		log.Printf("Error building referrals response: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	writeJSON(w, resp)
}

func buildReferralsResponse(specialist *models.Specialist) (ReferralsResponse, error) {
	code := specialist.ReferralCode
	if code == "" {
		ensured, err := db.EnsureSpecialistReferralCode(specialist.ID)
		if err != nil {
			return ReferralsResponse{}, err
		}
		code = ensured
	}

	referred, err := db.GetReferredClientsBySpecialist(specialist.ID, code)
	if err != nil {
		return ReferralsResponse{}, err
	}

	referredSpecialists, err := db.ListReferredSpecialists(code)
	if err != nil {
		return ReferralsResponse{}, err
	}

	masterBot := getMasterBotUsername()
	// Fall back to the specialist's own bot only if the master bot hasn't been initialised yet
	// (e.g. MASTER_BOT_TOKEN unset on a legacy single-bot deployment).
	linkBot := masterBot
	if linkBot == "" {
		linkBot = specialist.BotUsername
	}

	resp := ReferralsResponse{
		Code:            code,
		Link:            buildReferralLink(linkBot, code),
		Count:           len(referred),
		Referrals:       make([]ReferralClient, 0, len(referred)),
		SpecialistCount: len(referredSpecialists),
		Specialists:     make([]ReferredSpecialist, 0, len(referredSpecialists)),
	}
	for _, c := range referred {
		resp.Referrals = append(resp.Referrals, toReferralClient(c))
	}
	for _, s := range referredSpecialists {
		item := ReferredSpecialist{
			ID:          s.ID,
			Name:        s.Name,
			BotUsername: s.BotUsername,
			CreatedAt:   s.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			IsActive:    s.FirstPaymentAt != nil,
		}
		if s.FirstPaymentAt != nil {
			ts := s.FirstPaymentAt.Format("2006-01-02T15:04:05Z07:00")
			item.FirstPaymentAt = &ts
			resp.ActiveCount++
		} else {
			resp.PassiveCount++
		}
		resp.Specialists = append(resp.Specialists, item)
	}

	return resp, nil
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
