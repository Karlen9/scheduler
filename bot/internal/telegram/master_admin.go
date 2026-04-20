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
	cbAdminPlatform  = "adm:platform"
	cbAdminBookings  = "adm:bookings"
	cbAdminClients   = "adm:clients"
	cbAdminRecurring = "adm:recurring"
	cbAdminReferrals = "adm:referrals"
	cbAdminTopSpecs  = "adm:top"
	cbAdminDurations = "adm:durations"
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
			{{Text: myI18n.T(loc, "MasterAdmin.BtnPlatform"), CallbackData: cbAdminPlatform}},
			{{Text: myI18n.T(loc, "MasterAdmin.BtnBookings"), CallbackData: cbAdminBookings}},
			{{Text: myI18n.T(loc, "MasterAdmin.BtnClients"), CallbackData: cbAdminClients}},
			{{Text: myI18n.T(loc, "MasterAdmin.BtnRecurring"), CallbackData: cbAdminRecurring}},
			{{Text: myI18n.T(loc, "MasterAdmin.BtnReferrals"), CallbackData: cbAdminReferrals}},
			{{Text: myI18n.T(loc, "MasterAdmin.BtnTop"), CallbackData: cbAdminTopSpecs}},
			{{Text: myI18n.T(loc, "MasterAdmin.BtnDurations"), CallbackData: cbAdminDurations}},
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

	switch data {
	case cbAdminHome:
		h.renderAdminMenu(chatID, userID, messageID, loc)
	case cbAdminPlatform:
		h.renderAdminPlatform(chatID, messageID, loc)
	case cbAdminBookings:
		h.renderAdminBookings(chatID, messageID, loc)
	case cbAdminClients:
		h.renderAdminClients(chatID, messageID, loc)
	case cbAdminRecurring:
		h.renderAdminRecurring(chatID, messageID, loc)
	case cbAdminReferrals:
		h.renderAdminReferrals(chatID, messageID, loc)
	case cbAdminTopSpecs:
		h.renderAdminTopSpecialists(chatID, messageID, loc)
	case cbAdminDurations:
		h.renderAdminDurations(chatID, messageID, loc)
	case cbAdminList:
		h.renderAdminSpecialistList(chatID, messageID, loc)
	}
}

func (h *MasterHandler) renderAdminPlatform(chatID int64, messageID int, loc *localizerType) {
	s, err := db.GetOwnerPlatformStats()
	if err != nil {
		log.Printf("owner stats: platform: %v", err)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "<b>🏢 Platform</b>\n\n")
	fmt.Fprintf(&sb, "Total specialists: <b>%d</b>\n", s.TotalSpecialists)
	fmt.Fprintf(&sb, "• Active: <b>%d</b>\n", s.ActiveSpecialists)
	fmt.Fprintf(&sb, "• Deleted: <b>%d</b>\n", s.DeletedSpecialists)
	fmt.Fprintf(&sb, "\nNew signups:\n")
	fmt.Fprintf(&sb, "• Last 7 days: <b>%d</b>\n", s.NewSpecialists7d)
	fmt.Fprintf(&sb, "• Last 30 days: <b>%d</b>\n", s.NewSpecialists30d)
	fmt.Fprintf(&sb, "\nRecently active (created a booking):\n")
	fmt.Fprintf(&sb, "• 7 days: <b>%d</b>\n", s.RecentlyActive7d)
	fmt.Fprintf(&sb, "• 30 days: <b>%d</b>\n", s.RecentlyActive30d)
	fmt.Fprintf(&sb, "\nProfile completeness:\n")
	fmt.Fprintf(&sb, "• With photo: <b>%d</b>\n", s.ConfiguredWithPhoto)
	fmt.Fprintf(&sb, "• With bio: <b>%d</b>\n", s.WithCustomBio)
	fmt.Fprintf(&sb, "• With referral code: <b>%d</b>\n", s.WithReferralCode)
	h.editOrSend(chatID, messageID, sb.String(), backToAdmin(loc))
}

func (h *MasterHandler) renderAdminBookings(chatID int64, messageID int, loc *localizerType) {
	s, err := db.GetOwnerBookingStats()
	if err != nil {
		log.Printf("owner stats: bookings: %v", err)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "<b>📅 Bookings</b>\n\n")
	fmt.Fprintf(&sb, "Total: <b>%d</b>\n", s.Total)
	fmt.Fprintf(&sb, "• Last 7 days: <b>%d</b>\n", s.Last7d)
	fmt.Fprintf(&sb, "• Last 30 days: <b>%d</b>\n", s.Last30d)
	fmt.Fprintf(&sb, "\nBy status:\n")
	fmt.Fprintf(&sb, "• Pending: <b>%d</b>\n", s.StatusPending)
	fmt.Fprintf(&sb, "• Confirmed: <b>%d</b>\n", s.StatusConfirmed)
	fmt.Fprintf(&sb, "• Completed: <b>%d</b>\n", s.StatusCompleted)
	fmt.Fprintf(&sb, "• Cancelled: <b>%d</b>\n", s.StatusCancelled)
	fmt.Fprintf(&sb, "• Rejected: <b>%d</b>\n", s.StatusRejected)
	fmt.Fprintf(&sb, "• Reschedule/cancel requested: <b>%d</b>\n", s.StatusReschedule)
	fmt.Fprintf(&sb, "\nCancellation rate: <b>%.1f%%</b>\n", s.CancellationRate)
	fmt.Fprintf(&sb, "Reschedules: <b>%d</b>\n", s.Reschedules)
	fmt.Fprintf(&sb, "Avg per specialist: <b>%.1f</b>\n", s.AvgPerSpecialist)
	h.editOrSend(chatID, messageID, sb.String(), backToAdmin(loc))
}

func (h *MasterHandler) renderAdminClients(chatID int64, messageID int, loc *localizerType) {
	s, err := db.GetOwnerClientStats()
	if err != nil {
		log.Printf("owner stats: clients: %v", err)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "<b>👥 Clients</b>\n\n")
	fmt.Fprintf(&sb, "Total: <b>%d</b>\n", s.Total)
	fmt.Fprintf(&sb, "• Real (Telegram): <b>%d</b>\n", s.Real)
	fmt.Fprintf(&sb, "• Ghost (admin-created): <b>%d</b>\n", s.Ghosts)
	fmt.Fprintf(&sb, "• Blocked: <b>%d</b>\n", s.Blocked)
	fmt.Fprintf(&sb, "\nNew clients:\n")
	fmt.Fprintf(&sb, "• Last 7 days: <b>%d</b>\n", s.New7d)
	fmt.Fprintf(&sb, "• Last 30 days: <b>%d</b>\n", s.New30d)
	fmt.Fprintf(&sb, "\nArrived via referral: <b>%d</b>\n", s.ViaReferral)
	fmt.Fprintf(&sb, "Avg per active specialist: <b>%.1f</b>\n", s.AvgPerSpec)
	h.editOrSend(chatID, messageID, sb.String(), backToAdmin(loc))
}

func (h *MasterHandler) renderAdminRecurring(chatID int64, messageID int, loc *localizerType) {
	s, err := db.GetOwnerRecurringStats()
	if err != nil {
		log.Printf("owner stats: recurring: %v", err)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "<b>🔄 Recurring schedules</b>\n\n")
	fmt.Fprintf(&sb, "Total: <b>%d</b>\n", s.Total)
	fmt.Fprintf(&sb, "• Active: <b>%d</b>\n", s.Active)
	fmt.Fprintf(&sb, "• Pending approval: <b>%d</b>\n", s.Pending)
	fmt.Fprintf(&sb, "• Declined: <b>%d</b>\n", s.Declined)
	fmt.Fprintf(&sb, "• Cancelled: <b>%d</b>\n", s.Cancelled)
	h.editOrSend(chatID, messageID, sb.String(), backToAdmin(loc))
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
				fmt.Fprintf(&sb, " (@%s)", r.BotUsername)
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

func (h *MasterHandler) renderAdminDurations(chatID int64, messageID int, loc *localizerType) {
	items, err := db.GetOwnerDurationBreakdown()
	if err != nil {
		log.Printf("owner stats: durations: %v", err)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "<b>⏱ Duration breakdown</b>\n<i>(completed bookings)</i>\n\n")
	if len(items) == 0 {
		sb.WriteString("<i>No completed bookings yet.</i>")
	}
	for _, item := range items {
		fmt.Fprintf(&sb, "• %d min: <b>%d</b>\n", item.DurationMinutes, item.Count)
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
		fmt.Fprintf(&sb, "%d. %s — @%s\n", i+1, htmlEscape(s.Name), s.BotUsername)
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
