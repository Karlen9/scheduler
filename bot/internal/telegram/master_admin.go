package telegram

import (
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

// Admin (owner) panel callback data. All prefixed "adm:" so the router can distinguish them
// from main-menu callbacks ("m:") and support callbacks ("sup:").
const (
	cbAdminHome      = "adm:home"
	cbAdminReferrals = "adm:referrals"
	cbAdminTopSpecs  = "adm:top"
	cbAdminList      = "adm:list"

	// Recurring-payments toggle callbacks.
	cbAdminRecurringPay       = "adm:recpay"        // settings screen
	cbAdminRecurringPayToggle = "adm:recpay:toggle" // flip the flag

	// Promo code management callbacks.
	cbAdminPromo       = "adm:promo"        // list screen
	cbAdminPromoCreate = "adm:promo:create" // start creation flow
	// "adm:promo:deact:<id>" — deactivate a code; handled via HasPrefix in dispatchAdminCallback.
	// "adm:promo:dtype:<percent|amount>" — discount type selection.
	cbAdminPromoTypePercent = "adm:promo:dtype:percent"
	cbAdminPromoTypeAmount  = "adm:promo:dtype:amount"
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
			{{Text: myI18n.T(loc, "MasterAdmin.BtnRecurringPay"), CallbackData: cbAdminRecurringPay}},
			{{Text: myI18n.T(loc, "Promo.AdminBtnPromoCodes"), CallbackData: cbAdminPromo}},
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

	// --- Recurring-payments toggle ---
	case data == cbAdminRecurringPay:
		h.renderAdminRecurringPay(chatID, messageID, loc)
	case data == cbAdminRecurringPayToggle:
		h.handleAdminRecurringPayToggle(chatID, userID, messageID, loc)

	// --- Promo code management ---
	case data == cbAdminPromo:
		h.renderAdminPromoList(chatID, messageID, loc)
	case data == cbAdminPromoCreate:
		h.startAdminPromoCreate(chatID, userID, messageID, loc)
	case strings.HasPrefix(data, "adm:promo:deact:"):
		promoID := strings.TrimPrefix(data, "adm:promo:deact:")
		h.handleAdminPromoDeactivate(chatID, userID, messageID, promoID, loc)
	case data == cbAdminPromoTypePercent:
		h.handleAdminPromoDiscountType(chatID, userID, messageID, "percent", loc)
	case data == cbAdminPromoTypeAmount:
		h.handleAdminPromoDiscountType(chatID, userID, messageID, "amount", loc)
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

// ---------------------------------------------------------------------------
// Promo code management (admin-only)
// ---------------------------------------------------------------------------

// renderAdminPromoList lists all promo codes with per-active-code deactivate buttons.
func (h *MasterHandler) renderAdminPromoList(chatID int64, messageID int, loc *localizerType) {
	codes, err := db.ListPromoCodes()
	if err != nil {
		log.Printf("admin promo list: %v", err)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}

	var sb strings.Builder
	sb.WriteString(myI18n.T(loc, "Promo.AdminListTitle"))
	if len(codes) == 0 {
		sb.WriteString(myI18n.T(loc, "Promo.AdminListEmpty"))
	}
	for _, p := range codes {
		// Format discount.
		var disc string
		if p.DiscountType == "percent" {
			disc = fmt.Sprintf("%d%%", p.DiscountValue)
		} else {
			disc = fmt.Sprintf("%d ₽", p.DiscountValue/100)
		}
		// Format redemption count.
		var redempt string
		if p.MaxRedemptions == nil {
			redempt = fmt.Sprintf("%d/∞", p.RedemptionsCount)
		} else {
			redempt = fmt.Sprintf("%d/%d", p.RedemptionsCount, *p.MaxRedemptions)
		}
		// Format status.
		status := "✅"
		if !p.IsActive {
			status = "❌"
		}
		// Format validity window.
		var validity string
		if p.ValidFrom != nil || p.ValidUntil != nil {
			var parts []string
			if p.ValidFrom != nil {
				parts = append(parts, "с "+p.ValidFrom.Format("02.01.06"))
			}
			if p.ValidUntil != nil {
				parts = append(parts, "до "+p.ValidUntil.Format("02.01.06"))
			}
			validity = " (" + strings.Join(parts, " ") + ")"
		}
		fmt.Fprintf(&sb, "%s <code>%s</code> — %s, использован: %s%s\n",
			status, htmlEscape(p.Code), disc, redempt, validity)
	}

	// Build keyboard: one create button, then one deactivate button per active code.
	var rows [][]InlineKeyboardButton
	rows = append(rows, []InlineKeyboardButton{
		{Text: myI18n.T(loc, "Promo.AdminBtnCreate"), CallbackData: cbAdminPromoCreate},
	})
	for _, p := range codes {
		if !p.IsActive {
			continue
		}
		// Callback data must be <= 64 bytes. UUID is 36 chars, prefix is 16 chars → 52 total, fine.
		cb := "adm:promo:deact:" + p.ID
		rows = append(rows, []InlineKeyboardButton{
			{Text: myI18n.Tf(loc, "Promo.AdminBtnDeactivate", map[string]interface{}{"Code": p.Code}), CallbackData: cb},
		})
	}
	rows = append(rows, []InlineKeyboardButton{
		{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbAdminHome},
	})

	h.editOrSend(chatID, messageID, sb.String(), &InlineKeyboardMarkup{InlineKeyboard: rows})
}

// handleAdminPromoDeactivate deactivates the given promo code and re-renders the list.
func (h *MasterHandler) handleAdminPromoDeactivate(chatID, userID int64, messageID int, promoID string, loc *localizerType) {
	if err := db.DeactivatePromoCode(promoID); err != nil {
		log.Printf("admin promo deactivate %s: %v", promoID, err)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}
	// Re-render the list — the deactivated code will now show ❌.
	h.renderAdminPromoList(chatID, messageID, loc)
}

// startAdminPromoCreate kicks off the multi-step promo-code creation flow.
// Clears any previous draft and puts the admin into StateAwaitingPromoNewCode.
func (h *MasterHandler) startAdminPromoCreate(chatID, userID int64, messageID int, loc *localizerType) {
	_ = messageID
	h.setPromoCreateDraft(userID, &promoCreateDraft{})
	h.setSession(userID, &OnboardingSession{State: StateAwaitingPromoNewCode})
	h.bot.SendMessage(chatID, myI18n.T(loc, "Promo.AdminCreatePrompt"), nil)
}

// handleAdminPromoCodeInput handles the code string step of promo creation.
func (h *MasterHandler) handleAdminPromoCodeInput(chatID, userID int64, text string, loc *localizerType) {
	if !h.isAdmin(userID) {
		h.setSession(userID, nil)
		h.clearPromoCreateDraft(userID)
		return
	}
	code := strings.ToUpper(strings.TrimSpace(text))
	if code == "" || len(code) > 32 {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Promo.AdminCodeInvalid"), nil)
		return
	}

	// Check for duplicates.
	existing, err := db.GetPromoCodeByCode(code)
	if err != nil {
		log.Printf("admin promo create: lookup code %s: %v", code, err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		h.setSession(userID, nil)
		h.clearPromoCreateDraft(userID)
		return
	}
	if existing != nil {
		h.bot.SendMessageHTML(chatID, myI18n.Tf(loc, "Promo.AdminCodeExists", map[string]interface{}{"Code": htmlEscape(code)}), nil)
		return
	}

	// Store code; ask for discount type via inline buttons.
	draft := h.getPromoCreateDraft(userID)
	if draft == nil {
		// Draft was somehow lost (e.g. concurrent session replacement). Abort.
		h.setSession(userID, nil)
		return
	}
	draft.Code = code
	h.setPromoCreateDraft(userID, draft)
	h.setSession(userID, &OnboardingSession{State: StateAwaitingPromoDiscountValue})

	kb := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: myI18n.T(loc, "Promo.AdminBtnTypePercent"), CallbackData: cbAdminPromoTypePercent},
				{Text: myI18n.T(loc, "Promo.AdminBtnTypeAmount"), CallbackData: cbAdminPromoTypeAmount},
			},
		},
	}
	h.bot.SendMessageHTML(chatID, myI18n.Tf(loc, "Promo.AdminChooseDiscountType", map[string]interface{}{"Code": htmlEscape(code)}), kb)
}

// handleAdminPromoDiscountType handles the inline-button press selecting discount type.
// After this the admin is still in StateAwaitingPromoDiscountValue — we now need the number.
func (h *MasterHandler) handleAdminPromoDiscountType(chatID, userID int64, messageID int, discountType string, loc *localizerType) {
	if !h.isAdmin(userID) {
		return
	}
	draft := h.getPromoCreateDraft(userID)
	if draft == nil {
		// No in-progress creation — ignore stale callback.
		return
	}
	draft.DiscountType = discountType
	h.setPromoCreateDraft(userID, draft)

	// Prompt for the numeric value.
	var prompt string
	if discountType == "percent" {
		prompt = myI18n.T(loc, "Promo.AdminEnterPercent")
	} else {
		prompt = myI18n.T(loc, "Promo.AdminEnterAmount")
	}
	h.editOrSend(chatID, messageID, prompt, nil)
}

// handleAdminPromoDiscountValueInput handles the numeric discount value.
func (h *MasterHandler) handleAdminPromoDiscountValueInput(chatID, userID int64, text string, loc *localizerType) {
	if !h.isAdmin(userID) {
		h.setSession(userID, nil)
		h.clearPromoCreateDraft(userID)
		return
	}
	draft := h.getPromoCreateDraft(userID)
	if draft == nil {
		h.setSession(userID, nil)
		return
	}

	// Guard: the admin must tap a discount-type button before typing a value.
	// If they somehow send a number before selecting % or ₽, re-show the type picker.
	if draft.DiscountType != "percent" && draft.DiscountType != "amount" {
		kb := &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{
					{Text: myI18n.T(loc, "Promo.AdminBtnTypePercent"), CallbackData: cbAdminPromoTypePercent},
					{Text: myI18n.T(loc, "Promo.AdminBtnTypeAmount"), CallbackData: cbAdminPromoTypeAmount},
				},
			},
		}
		h.bot.SendMessageHTML(chatID, myI18n.T(loc, "Promo.AdminSelectTypeFirst"), kb)
		return
	}

	text = strings.TrimSpace(text)
	val, err := strconv.Atoi(text)
	if err != nil || val <= 0 {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Promo.AdminEnterPositiveInt"), nil)
		return
	}
	if draft.DiscountType == "percent" && (val < 1 || val > 100) {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Promo.AdminPercentRange"), nil)
		return
	}

	// Store the value; for "amount" convert roubles to kopecks.
	if draft.DiscountType == "percent" {
		draft.DiscountValue = val
	} else {
		draft.DiscountValue = val * 100 // roubles → kopecks
	}
	h.setPromoCreateDraft(userID, draft)
	h.setSession(userID, &OnboardingSession{State: StateAwaitingPromoMaxRedempt})

	h.bot.SendMessage(chatID, myI18n.T(loc, "Promo.AdminEnterMaxRedempt"), nil)
}

// handleAdminPromoMaxRedemptInput handles the max-redemptions step.
func (h *MasterHandler) handleAdminPromoMaxRedemptInput(chatID, userID int64, text string, loc *localizerType) {
	if !h.isAdmin(userID) {
		h.setSession(userID, nil)
		h.clearPromoCreateDraft(userID)
		return
	}
	draft := h.getPromoCreateDraft(userID)
	if draft == nil {
		h.setSession(userID, nil)
		return
	}

	text = strings.TrimSpace(strings.ToLower(text))
	if text == "0" || text == "skip" || text == "" {
		draft.MaxRedemptions = nil
	} else {
		val, err := strconv.Atoi(text)
		if err != nil || val <= 0 {
			h.bot.SendMessage(chatID, myI18n.T(loc, "Promo.AdminEnterPositiveIntOrSkip"), nil)
			return
		}
		draft.MaxRedemptions = &val
	}
	h.setPromoCreateDraft(userID, draft)
	h.setSession(userID, &OnboardingSession{State: StateAwaitingPromoDurationDays})

	h.bot.SendMessage(chatID, myI18n.T(loc, "Promo.AdminEnterDurationDays"), nil)
}

// handleAdminPromoDurationDaysInput handles the optional duration-days override step,
// then creates the promo code and returns to the list.
func (h *MasterHandler) handleAdminPromoDurationDaysInput(chatID, userID int64, text string, loc *localizerType) {
	if !h.isAdmin(userID) {
		h.setSession(userID, nil)
		h.clearPromoCreateDraft(userID)
		return
	}
	draft := h.getPromoCreateDraft(userID)
	if draft == nil {
		h.setSession(userID, nil)
		return
	}

	text = strings.TrimSpace(strings.ToLower(text))
	if text == "0" || text == "skip" || text == "" {
		draft.DurationDays = 0
	} else {
		val, err := strconv.Atoi(text)
		if err != nil || val <= 0 {
			h.bot.SendMessage(chatID, myI18n.T(loc, "Promo.AdminEnterPositiveIntOrSkip"), nil)
			return
		}
		draft.DurationDays = val
	}

	// Build and persist the new promo code.
	p := models.PromoCode{
		ID:             uuid.New().String(),
		Code:           draft.Code,
		DiscountType:   draft.DiscountType,
		DiscountValue:  draft.DiscountValue,
		DurationDays:   draft.DurationDays,
		MaxRedemptions: draft.MaxRedemptions,
		IsActive:       true,
		CreatedAt:      time.Now().UTC(),
	}
	if err := db.CreatePromoCode(p); err != nil {
		log.Printf("admin promo create: db insert: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		h.setSession(userID, nil)
		h.clearPromoCreateDraft(userID)
		return
	}

	// Clear state.
	h.setSession(userID, nil)
	h.clearPromoCreateDraft(userID)

	// Confirm with a summary.
	var discStr string
	if p.DiscountType == "percent" {
		discStr = fmt.Sprintf("%d%%", p.DiscountValue)
	} else {
		discStr = fmt.Sprintf("%d ₽", p.DiscountValue/100)
	}
	var maxStr string
	if p.MaxRedemptions == nil {
		maxStr = "∞"
	} else {
		maxStr = strconv.Itoa(*p.MaxRedemptions)
	}
	var durStr string
	if p.DurationDays == 0 {
		durStr = myI18n.T(loc, "Promo.AdminDurationPlan")
	} else {
		durStr = myI18n.Tf(loc, "Promo.AdminDurationDays", map[string]interface{}{"Days": p.DurationDays})
	}
	summary := myI18n.Tf(loc, "Promo.AdminCreatedSummary", map[string]interface{}{
		"Code":           htmlEscape(p.Code),
		"Discount":       discStr,
		"MaxRedemptions": maxStr,
		"Duration":       durStr,
	})
	h.bot.SendMessageHTML(chatID, summary, nil)

	// Return to promo list.
	h.renderAdminPromoList(chatID, 0, loc)
}

func (h *MasterHandler) renderAdminRecurringPay(chatID int64, messageID int, loc *localizerType) {
	enabled, err := db.GetRecurringPaymentsEnabled()
	if err != nil {
		log.Printf("admin recurring pay: read flag: %v", err)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}

	var statusLine string
	var toggleLabel string
	if enabled {
		statusLine = myI18n.T(loc, "MasterAdmin.RecurringPayStatusOn")
		toggleLabel = myI18n.T(loc, "MasterAdmin.BtnRecurringPayDisable")
	} else {
		statusLine = myI18n.T(loc, "MasterAdmin.RecurringPayStatusOff")
		toggleLabel = myI18n.T(loc, "MasterAdmin.BtnRecurringPayEnable")
	}

	body := myI18n.T(loc, "MasterAdmin.RecurringPayTitle") + "\n" + statusLine

	kb := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: toggleLabel, CallbackData: cbAdminRecurringPayToggle}},
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbAdminHome}},
		},
	}
	h.editOrSend(chatID, messageID, body, kb)
}

func (h *MasterHandler) handleAdminRecurringPayToggle(chatID, userID int64, messageID int, loc *localizerType) {
	if !h.isAdmin(userID) {
		return
	}
	current, err := db.GetRecurringPaymentsEnabled()
	if err != nil {
		log.Printf("admin recurring pay toggle: read flag: %v", err)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}
	if err := db.SetRecurringPaymentsEnabled(!current); err != nil {
		log.Printf("admin recurring pay toggle: set flag: %v", err)
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), backToAdmin(loc))
		return
	}
	h.renderAdminRecurringPay(chatID, messageID, loc)
}

func backToAdmin(loc *localizerType) *InlineKeyboardMarkup {
	return &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbAdminHome}},
		},
	}
}
