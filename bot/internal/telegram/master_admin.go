package telegram

import (
	"fmt"
	"log"
	"strings"

	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
)

// Admin (owner) panel callback data. All prefixed "adm:" so the router can distinguish them
// from main-menu callbacks ("m:") and support callbacks ("sup:").
const (
	cbAdminHome      = "adm:home"
	cbAdminReferrals = "adm:referrals"
	cbAdminTopSpecs  = "adm:top"
	cbAdminList      = "adm:list"
)

// renderAdminMenu shows the owner analytics dashboard with drill-down buttons.
// Silently no-ops for non-admin callers (the caller is responsible for gating entry, but we
// double-check defensively).
func (h *MasterHandler) renderAdminMenu(chatID, userID int64, messageID int, loc *localizerType) {
	if !h.isAdmin(userID) {
		return
	}

	text := myI18n.T(loc, "MasterAdmin.Home")
	kb := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: myI18n.T(loc, "MasterAdmin.BtnReferrals"), CallbackData: cbAdminReferrals}},
			{{Text: myI18n.T(loc, "MasterAdmin.BtnTop"), CallbackData: cbAdminTopSpecs}},
			{{Text: myI18n.T(loc, "MasterAdmin.BtnList"), CallbackData: cbAdminList}},
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuHome}},
		},
	}
	h.editOrSend(chatID, messageID, text, kb)
}

// dispatchAdminCallback routes adm:* clicks. Non-admin callers get silently bounced.
func (h *MasterHandler) dispatchAdminCallback(chatID, userID int64, messageID int, data string, loc *localizerType) {
	if !h.isAdmin(userID) {
		return
	}

	switch {
	case data == cbAdminHome:
		h.renderAdminMenu(chatID, userID, messageID, loc)
	case data == cbAdminReferrals:
		h.renderAdminReferrals(chatID, messageID, loc)
	case data == cbAdminTopSpecs:
		h.renderAdminTopSpecialists(chatID, messageID, loc)
	case data == cbAdminList:
		h.renderAdminSpecialistList(chatID, messageID, loc)

	// Buttons on admin messages already sitting in chats (screens that no longer exist).
	case strings.HasPrefix(data, "adm:promo"), strings.HasPrefix(data, "adm:recpay"):
		h.renderAdminMenu(chatID, userID, messageID, loc)
	}
}

func (h *MasterHandler) renderAdminReferrals(chatID int64, messageID int, loc *localizerType) {
	s, err := db.GetOwnerReferralStats()
	if err != nil {
		log.Printf("owner stats: referrals: %v", err)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "<b>🎁 Referrals</b>\n\n")
	fmt.Fprintf(&sb, "Specialists with a code: <b>%d</b>\n", s.SpecialistsWithCode)
	fmt.Fprintf(&sb, "Clients referred: <b>%d</b>\n", s.ReferredClients)
	if len(s.TopReferrers) == 0 {
		sb.WriteString("\n<i>No referrals yet.</i>\n")
	} else {
		sb.WriteString("\n<b>Top referrers:</b>\n")
		for i, r := range s.TopReferrers {
			fmt.Fprintf(&sb, "%d. %s — <b>%d</b>", i+1, htmlEscape(r.SpecialistName), r.ReferredCount)
			if r.BotUsername != "" {
				fmt.Fprintf(&sb, " (@%s)", htmlEscape(r.BotUsername))
			}
			sb.WriteString("\n")
		}
	}
	h.editOrSend(chatID, messageID, sb.String(), backToAdmin(loc))
}

func (h *MasterHandler) renderAdminTopSpecialists(chatID int64, messageID int, loc *localizerType) {
	byBookings, errB := db.GetOwnerTopSpecialistsByBookings(5)
	byClients, errC := db.GetOwnerTopSpecialistsByClients(5)
	if errB != nil || errC != nil {
		log.Printf("owner stats: top specialists: %v / %v", errB, errC)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "<b>🏆 Top specialists</b>\n\n")
	sb.WriteString("<b>By bookings:</b>\n")
	if len(byBookings) == 0 {
		sb.WriteString("<i>No data yet.</i>\n")
	}
	for i, r := range byBookings {
		fmt.Fprintf(&sb, "%d. %s — <b>%d</b>\n", i+1, htmlEscape(r.Name), r.Value)
	}
	sb.WriteString("\n<b>By clients:</b>\n")
	if len(byClients) == 0 {
		sb.WriteString("<i>No data yet.</i>\n")
	}
	for i, r := range byClients {
		fmt.Fprintf(&sb, "%d. %s — <b>%d</b>\n", i+1, htmlEscape(r.Name), r.Value)
	}
	h.editOrSend(chatID, messageID, sb.String(), backToAdmin(loc))
}

// renderAdminSpecialistList replaces the legacy /specialists text dump with a paginated-ish view
// (first 20, with a hint if there are more). Good enough for an owner-only view.
func (h *MasterHandler) renderAdminSpecialistList(chatID int64, messageID int, loc *localizerType) {
	specialists, err := db.GetAllActiveSpecialists()
	if err != nil {
		log.Printf("owner stats: specialist list: %v", err)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "<b>📋 Specialists (%d)</b>\n\n", len(specialists))
	limit := 20
	for i, s := range specialists {
		if i >= limit {
			fmt.Fprintf(&sb, "\n<i>…and %d more</i>", len(specialists)-limit)
			break
		}
		fmt.Fprintf(&sb, "%d. %s — @%s\n", i+1, htmlEscape(s.Name), htmlEscape(s.BotUsername))
	}
	h.editOrSend(chatID, messageID, sb.String(), backToAdmin(loc))
}

func backToAdmin(loc *localizerType) *InlineKeyboardMarkup {
	return &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbAdminHome}},
		},
	}
}
