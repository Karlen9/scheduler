package telegram

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"

	"scheduler-bot/internal/config"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

// masterLoadSpecialist is a thin wrapper so menu code doesn't need to import db directly
// at every call site; kept here because master_menu.go already imports db for this purpose.
func masterLoadSpecialist(userID int64) (*models.Specialist, error) {
	return db.GetSpecialistByTelegramID(userID)
}

// formatAlreadyRegistered returns the localized "already registered" greeting.
func formatAlreadyRegistered(loc *localizerType, botUsername string) string {
	return fmt.Sprintf(myI18n.T(loc, "Master.AlreadyRegistered"), botUsername)
}

// Callback data values. Keep them short (Telegram limit: 64 bytes) and namespaced by a single prefix
// so the master dispatcher can route them with a prefix switch.
const (
	cbMenuHome       = "m:home"
	cbMenuCreateBot  = "m:create"
	cbMenuFAQ        = "m:faq"
	cbMenuFAQBotHow  = "m:faq:bot"
	cbMenuFAQUsage   = "m:faq:use"
	cbMenuFAQPricing = "m:faq:price"
	cbMenuOperator   = "m:op"
	cbMenuAdmin      = "m:admin"
	cbMenuLanguage   = "m:lang"
	// "m:lang:ru" / "m:lang:en" carry the selected code; handled via HasPrefix.

	// Invite-a-colleague screen callback.
	cbMenuInvite = "m:invite"

	// Subscription screen callbacks.
	cbMenuSubscription = "m:sub"
	cbSubPromo         = "m:sub:promo"
	cbSubConfirm       = "m:sub:confirm"
	cbSubPay           = "m:sub:pay"
	// "m:sub:buy:<planCode>" handled via HasPrefix("m:sub:buy:").
	// cbSubAutoRenew is an exact-match callback (NOT under the m:sub:buy: prefix).
	cbSubAutoRenew = "m:sub:autorenew"
)

// renderMainMenu edits (or sends) the master bot's root menu for the given user.
// Callback paths land here with messageID != 0; fresh /start uses messageID == 0.
func (h *MasterHandler) renderMainMenu(chatID, userID int64, messageID int, loc *localizerType) {
	text := myI18n.T(loc, "MasterMenu.Home")

	rows := [][]InlineKeyboardButton{
		{{Text: myI18n.T(loc, "MasterMenu.BtnCreateBot"), CallbackData: cbMenuCreateBot}},
		{{Text: myI18n.T(loc, "Btn.Subscription"), CallbackData: cbMenuSubscription}},
		{{Text: myI18n.T(loc, "MasterMenu.BtnInvite"), CallbackData: cbMenuInvite}},
		{{Text: myI18n.T(loc, "MasterMenu.BtnFAQ"), CallbackData: cbMenuFAQ}},
		{{Text: myI18n.T(loc, "MasterMenu.BtnOperator"), CallbackData: cbMenuOperator}},
		{{Text: myI18n.T(loc, "Btn.Language"), CallbackData: cbMenuLanguage}},
	}
	if h.isAdmin(userID) {
		rows = append(rows, []InlineKeyboardButton{
			{Text: myI18n.T(loc, "MasterMenu.BtnAdmin"), CallbackData: cbMenuAdmin},
		})
	}
	kb := &InlineKeyboardMarkup{InlineKeyboard: rows}

	if messageID > 0 {
		if err := h.bot.EditMessageTextHTML(chatID, messageID, text, kb); err != nil {
			// Fall back to a fresh message if edit fails (e.g. message too old).
			log.Printf("master: edit main menu failed, re-sending: %v", err)
			h.bot.SendMessageHTML(chatID, text, kb)
		}
		return
	}
	h.bot.SendMessageHTML(chatID, text, kb)
}

// renderFAQIndex shows the FAQ section list with a back button.
func (h *MasterHandler) renderFAQIndex(chatID int64, messageID int, loc *localizerType) {
	text := myI18n.T(loc, "MasterMenu.FAQIndex")
	kb := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: myI18n.T(loc, "MasterMenu.BtnFAQBotHow"), CallbackData: cbMenuFAQBotHow}},
			{{Text: myI18n.T(loc, "MasterMenu.BtnFAQUsage"), CallbackData: cbMenuFAQUsage}},
			{{Text: myI18n.T(loc, "MasterMenu.BtnFAQPricing"), CallbackData: cbMenuFAQPricing}},
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuHome}},
		},
	}
	h.editOrSend(chatID, messageID, text, kb)
}

// renderFAQPage shows a specific FAQ article. The caller passes the i18n key whose body is the article text.
func (h *MasterHandler) renderFAQPage(chatID int64, messageID int, bodyKey string, loc *localizerType) {
	text := myI18n.T(loc, bodyKey)
	kb := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: myI18n.T(loc, "MasterMenu.BtnOperator"), CallbackData: cbMenuOperator}},
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuFAQ}},
		},
	}
	h.editOrSend(chatID, messageID, text, kb)
}

// editOrSend centralises the "try to edit, otherwise send" pattern used by all rendered screens.
// Always uses HTML parse mode so <b>/<i>/<a> tags in the admin & FAQ copy render correctly.
func (h *MasterHandler) editOrSend(chatID int64, messageID int, text string, kb *InlineKeyboardMarkup) {
	if messageID > 0 {
		if err := h.bot.EditMessageTextHTML(chatID, messageID, text, kb); err == nil {
			return
		}
	}
	h.bot.SendMessageHTML(chatID, text, kb)
}

// dispatchCallback routes m:* callback queries. Returns true if handled.
func (h *MasterHandler) dispatchCallback(q *CallbackQuery) bool {
	if q == nil {
		return false
	}
	data := q.Data
	if !strings.HasPrefix(data, "m:") && !strings.HasPrefix(data, "adm:") && !strings.HasPrefix(data, "sup:") {
		return false
	}

	// Telegram's spec marks CallbackQuery.From as required, but guard defensively — without a
	// user ID the language lookup and admin check below would panic / misattribute.
	if q.From.ID == 0 {
		return false
	}

	chatID := int64(0)
	messageID := 0
	if q.Message != nil {
		chatID = q.Message.Chat.ID
		messageID = q.Message.MessageID
	}
	if chatID == 0 {
		return false
	}
	userID := q.From.ID
	loc := h.localizerFor(userID)

	// Always acknowledge the callback so the client-side spinner stops.
	defer h.bot.AnswerCallbackQuery(q.ID, "")

	switch {
	case data == cbMenuHome:
		h.renderMainMenu(chatID, userID, messageID, loc)
	case data == cbMenuCreateBot:
		h.startCreateBotFlow(chatID, userID, messageID, loc)
	case data == cbMenuFAQ:
		h.renderFAQIndex(chatID, messageID, loc)
	case data == cbMenuFAQBotHow:
		h.renderFAQPage(chatID, messageID, "MasterFAQ.BotHow", loc)
	case data == cbMenuFAQUsage:
		h.renderFAQPage(chatID, messageID, "MasterFAQ.Usage", loc)
	case data == cbMenuFAQPricing:
		h.renderFAQPage(chatID, messageID, "MasterFAQ.Pricing", loc)
	case data == cbMenuOperator:
		h.startOperatorSupport(chatID, userID, messageID, q.From, loc)
	case data == cbMenuAdmin:
		h.renderAdminMenu(chatID, userID, messageID, loc)
	case data == cbMenuLanguage:
		h.renderLanguagePicker(chatID, messageID, loc)
	case strings.HasPrefix(data, "m:lang:"):
		h.handleLanguageSelection(chatID, userID, messageID, strings.TrimPrefix(data, "m:lang:"), q.ID)
	case data == cbMenuSubscription:
		h.renderSubscriptionScreen(chatID, userID, messageID, loc)
	case data == cbMenuInvite:
		h.renderInviteScreen(chatID, userID, messageID, loc)
	case strings.HasPrefix(data, "m:sub:buy:"):
		h.handleSelectPlan(chatID, userID, messageID, strings.TrimPrefix(data, "m:sub:buy:"), loc)
	case data == cbSubPromo:
		h.handleSubscriptionPromoEntry(chatID, userID, messageID, loc)
	case data == cbSubConfirm:
		h.handleSubscriptionConfirm(chatID, userID, messageID, loc)
	case data == cbSubPay:
		h.handleSubscriptionPay(chatID, userID, messageID, loc)
	case data == cbSubAutoRenew:
		h.handleSubscriptionAutoRenewToggle(chatID, userID, messageID, loc)
	case strings.HasPrefix(data, "adm:"):
		h.dispatchAdminCallback(chatID, userID, messageID, data, loc)
	case strings.HasPrefix(data, "sup:"):
		h.dispatchSupportCallback(chatID, userID, messageID, data, loc)
	default:
		return false
	}
	return true
}

// renderLanguagePicker shows the ru/en toggle. Reached via the main-menu "🌐 Language" button or
// the /language command. Picks are stored in master_users; registered specialists additionally
// mirror the choice into the specialists table so both bots stay in sync.
func (h *MasterHandler) renderLanguagePicker(chatID int64, messageID int, loc *localizerType) {
	kb := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: myI18n.T(loc, "Lang.Russian"), CallbackData: "m:lang:ru"},
				{Text: myI18n.T(loc, "Lang.English"), CallbackData: "m:lang:en"},
			},
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuHome}},
		},
	}
	h.editOrSend(chatID, messageID, myI18n.T(loc, "Lang.Choose"), kb)
}

// handleLanguageSelection persists the chosen language and re-renders the main menu so the
// surrounding copy flips immediately.
func (h *MasterHandler) handleLanguageSelection(chatID, userID int64, messageID int, lang, callbackQueryID string) {
	if lang != "ru" && lang != "en" {
		lang = "ru"
	}
	if err := db.SetMasterUserLanguage(userID, lang); err != nil {
		log.Printf("master: set language for %d failed: %v", userID, err)
	}
	// Mirror into specialist row when the user is already registered, so their personal bot's UI
	// switches at the same time without the specialist having to open two separate menus.
	if sp, err := db.GetSpecialistByTelegramID(userID); err == nil && sp != nil {
		if uerr := db.UpdateSpecialistLanguage(sp.ID, lang); uerr != nil {
			log.Printf("master: mirror language to specialist %s failed: %v", sp.ID, uerr)
		}
	}
	newLoc := myI18n.NewLocalizer(lang)
	h.bot.AnswerCallbackQuery(callbackQueryID, myI18n.T(newLoc, "Lang.Saved"))
	h.renderMainMenu(chatID, userID, messageID, newLoc)
}

// ---------------------------------------------------------------------------
// Subscription screen
// ---------------------------------------------------------------------------

// renderSubscriptionScreen shows the specialist's current subscription state and available plans.
func (h *MasterHandler) renderSubscriptionScreen(chatID, userID int64, messageID int, loc *localizerType) {
	sp, err := masterLoadSpecialist(userID)
	if err != nil {
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), &InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuHome}},
			},
		})
		return
	}
	if sp == nil || !sp.IsActive {
		text := myI18n.T(loc, "Subscription.PricingTitle") +
			"\n\n" + myI18n.T(loc, "Subscription.ProBenefits") +
			"\n\n" + myI18n.T(loc, "Subscription.TrialNote") +
			"\n\n" + subscriptionPlanLines(loc) +
			"\n\n" + myI18n.T(loc, "Subscription.NoBotYet")
		h.editOrSend(chatID, messageID, text,
			&InlineKeyboardMarkup{
				InlineKeyboard: [][]InlineKeyboardButton{
					{{Text: myI18n.T(loc, "MasterMenu.BtnCreateBot"), CallbackData: cbMenuCreateBot}},
					{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuHome}},
				},
			},
		)
		return
	}

	now := time.Now()
	ent := sp.Entitlement(now)

	var statusLine string
	switch {
	case ent.IsPro && ent.Reason == "trial":
		daysLeft := int(time.Until(ent.Until).Hours()/24) + 1
		statusLine = myI18n.Tf(loc, "Subscription.StatusTrial", map[string]interface{}{
			"Days":  daysLeft,
			"Until": ent.Until.Format("02.01.2006"),
		})
	case ent.IsPro:
		statusLine = myI18n.Tf(loc, "Subscription.StatusActive", map[string]interface{}{
			"Until": ent.Until.Format("02.01.2006"),
		})
	default:
		statusLine = myI18n.T(loc, "Subscription.StatusInactive")
	}

	plans := config.SubscriptionPlans()
	// Sort by DurationDays descending (annual → quarterly → monthly) without
	// mutating the config's backing slice — copy first.
	sortedPlans := make([]config.SubscriptionPlan, len(plans))
	copy(sortedPlans, plans)
	for i := 0; i < len(sortedPlans)-1; i++ {
		for j := i + 1; j < len(sortedPlans); j++ {
			if sortedPlans[j].DurationDays > sortedPlans[i].DurationDays {
				sortedPlans[i], sortedPlans[j] = sortedPlans[j], sortedPlans[i]
			}
		}
	}

	text := myI18n.Tf(loc, "Subscription.Title", map[string]interface{}{
		"StatusLine": statusLine,
	}) +
		"\n\n" + myI18n.T(loc, "Subscription.ProBenefits") +
		"\n\n" + myI18n.T(loc, "Subscription.TrialNote") +
		"\n\n" + subscriptionPlanLines(loc)

	var planRows [][]InlineKeyboardButton
	for _, p := range sortedPlans {
		rubles := p.PriceKopecks / 100
		label := planLabel(loc, p)
		highlight := ""
		if p.Code == "pro_annual" {
			highlight = " ⭐"
		}
		btnText := fmt.Sprintf("%s%s — %d ₽", label, highlight, rubles)
		planRows = append(planRows, []InlineKeyboardButton{
			{Text: btnText, CallbackData: "m:sub:buy:" + p.Code},
		})
	}
	// Show the auto-renewal toggle only when the platform has recurring payments enabled.
	if enabled, err := db.GetRecurringPaymentsEnabled(); err == nil && enabled {
		key := "Subscription.BtnAutoRenewOff"
		if h.getSubAutoRenew(userID) {
			key = "Subscription.BtnAutoRenewOn"
		}
		planRows = append(planRows, []InlineKeyboardButton{
			{Text: myI18n.T(loc, key), CallbackData: cbSubAutoRenew},
		})
	}
	planRows = append(planRows,
		[]InlineKeyboardButton{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuHome}},
	)

	h.editOrSend(chatID, messageID, text, &InlineKeyboardMarkup{InlineKeyboard: planRows})
}

// subscriptionPlanLines returns a formatted multi-line string of available plans,
// sorted annual-first (descending DurationDays), for display-only use.
// Each line shows the per-month equivalent and the savings vs the monthly plan.
func subscriptionPlanLines(loc *localizerType) string {
	plans := config.SubscriptionPlans()
	sortedPlans := make([]config.SubscriptionPlan, len(plans))
	copy(sortedPlans, plans)
	for i := 0; i < len(sortedPlans)-1; i++ {
		for j := i + 1; j < len(sortedPlans); j++ {
			if sortedPlans[j].DurationDays > sortedPlans[i].DurationDays {
				sortedPlans[i], sortedPlans[j] = sortedPlans[j], sortedPlans[i]
			}
		}
	}

	// Find the monthly plan's per-month kopeck price as the savings baseline.
	basePerMonthKopecks := 0
	for _, p := range plans {
		if p.Code == "pro_monthly" {
			basePerMonthKopecks = p.PriceKopecks
			break
		}
	}

	var lines []string
	for _, p := range sortedPlans {
		months := (p.DurationDays + 15) / 30
		if months < 1 {
			months = 1
		}
		label := planLabel(loc, p)
		price := p.PriceKopecks / 100

		if months == 1 {
			lines = append(lines, myI18n.Tf(loc, "Subscription.PlanLineMonthly", map[string]interface{}{
				"Label": label,
				"Price": price,
			}))
		} else {
			perMonthKopecks := p.PriceKopecks / months
			perMonth := perMonthKopecks / 100
			star := ""
			if p.Code == "pro_annual" {
				star = " ⭐"
			}
			savePct := 0
			if basePerMonthKopecks > 0 {
				savePct = (basePerMonthKopecks - perMonthKopecks) * 100 / basePerMonthKopecks
			}
			lines = append(lines, myI18n.Tf(loc, "Subscription.PlanLineMulti", map[string]interface{}{
				"Label":    label,
				"Star":     star,
				"Price":    price,
				"PerMonth": perMonth,
				"Save":     savePct,
			}))
		}
	}
	return strings.Join(lines, "\n")
}

// planLabel returns a localised human-readable plan name.
func planLabel(loc *localizerType, p config.SubscriptionPlan) string {
	switch p.Code {
	case "pro_monthly":
		return myI18n.T(loc, "Subscription.PlanMonthly")
	case "pro_quarterly":
		return myI18n.T(loc, "Subscription.PlanQuarterly")
	case "pro_annual":
		return myI18n.T(loc, "Subscription.PlanAnnual")
	default:
		return p.Code
	}
}

// handleSelectPlan is called when a specialist taps a plan button (m:sub:buy:<planCode>).
// It stores the chosen plan and shows a "Do you have a promo code?" prompt.
func (h *MasterHandler) handleSelectPlan(chatID, userID int64, messageID int, planCode string, loc *localizerType) {
	plan, ok := config.SubscriptionPlanByCode(planCode)
	if !ok {
		h.renderSubscriptionScreen(chatID, userID, messageID, loc)
		return
	}
	h.setPendingPlanCode(userID, planCode)
	h.clearPendingPromo(userID)
	h.renderPromoPrompt(chatID, userID, messageID, plan, loc)
}

// renderPromoPrompt shows "Do you have a promo code?" for the chosen plan.
func (h *MasterHandler) renderPromoPrompt(chatID, userID int64, messageID int, plan config.SubscriptionPlan, loc *localizerType) {
	text := myI18n.Tf(loc, "Subscription.PromoPrompt", map[string]interface{}{
		"Plan":  planLabel(loc, plan),
		"Price": plan.PriceKopecks / 100,
	})
	kb := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: myI18n.T(loc, "Subscription.BtnHavePromo"), CallbackData: cbSubPromo}},
			{{Text: myI18n.T(loc, "Subscription.BtnNoPromo"), CallbackData: cbSubConfirm}},
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuSubscription}},
		},
	}
	h.editOrSend(chatID, messageID, text, kb)
}

// handleSubscriptionAutoRenewToggle flips the in-memory auto-renew choice and re-renders
// the subscription screen so the toggle button reflects the new state.
func (h *MasterHandler) handleSubscriptionAutoRenewToggle(chatID, userID int64, messageID int, loc *localizerType) {
	h.setSubAutoRenew(userID, !h.getSubAutoRenew(userID))
	h.renderSubscriptionScreen(chatID, userID, messageID, loc)
}

// handleSubscriptionPromoEntry is called when the user taps "I have a promo code".
// It requires a pending plan to already be set by handleSelectPlan.
func (h *MasterHandler) handleSubscriptionPromoEntry(chatID, userID int64, messageID int, loc *localizerType) {
	if _, ok := h.peekPendingPlanCode(userID); !ok {
		h.renderSubscriptionScreen(chatID, userID, messageID, loc)
		return
	}
	h.setSession(userID, &OnboardingSession{State: StateAwaitingPromoCode})
	h.bot.SendMessage(chatID, myI18n.T(loc, "Subscription.EnterPromoCode"), nil)
}

// handlePromoCodeInput is called from HandleUpdate when the user is in StateAwaitingPromoCode.
// It validates the code and shows the final price — no checkout yet.
func (h *MasterHandler) handlePromoCodeInput(chatID, userID int64, code string, loc *localizerType) {
	h.setSession(userID, nil)

	planCode, ok := h.peekPendingPlanCode(userID)
	if !ok {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	if h.ValidatePromoFunc == nil {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Subscription.PromoUnavailable"), nil)
		return
	}

	sp, err := masterLoadSpecialist(userID)
	if err != nil || sp == nil {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	trimmedCode := strings.TrimSpace(code)
	_, _, _, ok2 := h.ValidatePromoFunc(trimmedCode, planCode, sp.ID)
	if !ok2 {
		h.clearPendingPromo(userID)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Subscription.PromoInvalid"), nil)
		// Re-show the promo prompt as a fresh message so the user can retry or skip.
		if plan, planOk := config.SubscriptionPlanByCode(planCode); planOk {
			h.renderPromoPrompt(chatID, userID, 0, plan, loc)
		}
		return
	}
	h.setPendingPromo(userID, trimmedCode)
	h.renderFinalPrice(chatID, userID, 0, loc)
}

// handleSubscriptionConfirm is called when the user taps "No promo code".
func (h *MasterHandler) handleSubscriptionConfirm(chatID, userID int64, messageID int, loc *localizerType) {
	h.clearPendingPromo(userID)
	h.renderFinalPrice(chatID, userID, messageID, loc)
}

// renderFinalPrice shows the full or discounted price for the chosen plan and a Pay button.
func (h *MasterHandler) renderFinalPrice(chatID, userID int64, messageID int, loc *localizerType) {
	planCode, ok := h.peekPendingPlanCode(userID)
	if !ok {
		h.renderSubscriptionScreen(chatID, userID, messageID, loc)
		return
	}
	plan, ok := config.SubscriptionPlanByCode(planCode)
	if !ok {
		h.renderSubscriptionScreen(chatID, userID, messageID, loc)
		return
	}

	base := plan.PriceKopecks
	final := base
	discount := 0

	promoCode, hasPromo := h.peekPendingPromo(userID)

	if hasPromo && h.ValidatePromoFunc != nil {
		sp, err := masterLoadSpecialist(userID)
		if err != nil || sp == nil {
			h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), nil)
			return
		}
		f, d, _, vok := h.ValidatePromoFunc(promoCode, planCode, sp.ID)
		if vok {
			final = f
			discount = d
		} else {
			h.clearPendingPromo(userID)
			hasPromo = false
		}
	}

	var text string
	if hasPromo {
		text = myI18n.Tf(loc, "Subscription.FinalPriceWithPromo", map[string]interface{}{
			"Plan":     planLabel(loc, plan),
			"Base":     base / 100,
			"Code":     promoCode,
			"Discount": discount / 100,
			"Final":    final / 100,
		})
	} else {
		text = myI18n.Tf(loc, "Subscription.FinalPriceNoPromo", map[string]interface{}{
			"Plan":  planLabel(loc, plan),
			"Final": final / 100,
		})
	}

	var payBtnText string
	if final == 0 {
		payBtnText = myI18n.T(loc, "Subscription.BtnActivateFree")
	} else {
		payBtnText = myI18n.Tf(loc, "Subscription.BtnPayAmount", map[string]interface{}{
			"Price": final / 100,
		})
	}

	kb := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: payBtnText, CallbackData: cbSubPay}},
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuSubscription}},
		},
	}
	h.editOrSend(chatID, messageID, text, kb)
}

// handleSubscriptionPay is called when the user taps the Pay button on the final-price screen.
// It creates the actual checkout using the pending plan and promo.
func (h *MasterHandler) handleSubscriptionPay(chatID, userID int64, messageID int, loc *localizerType) {
	if h.CreateCheckoutFunc == nil {
		h.editOrSend(chatID, messageID,
			myI18n.T(loc, "Subscription.PaymentUnavailable"),
			&InlineKeyboardMarkup{InlineKeyboard: [][]InlineKeyboardButton{
				{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuSubscription}},
			}},
		)
		return
	}

	planCode, ok := h.peekPendingPlanCode(userID)
	if !ok {
		h.renderSubscriptionScreen(chatID, userID, messageID, loc)
		return
	}

	promoCode, _ := h.peekPendingPromo(userID) // empty string when none

	sp, err := masterLoadSpecialist(userID)
	if err != nil || sp == nil {
		h.editOrSend(chatID, messageID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	confirmURL, granted, err := h.CreateCheckoutFunc(context.Background(), sp, planCode, promoCode, h.getSubAutoRenew(userID))
	if err != nil {
		log.Printf("master: subscription pay error (user=%d plan=%s): %v", userID, planCode, err)
		h.editOrSend(chatID, messageID,
			myI18n.T(loc, "Subscription.PaymentFailed"),
			&InlineKeyboardMarkup{InlineKeyboard: [][]InlineKeyboardButton{
				{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuSubscription}},
			}},
		)
		// Leave pending state so they can retry.
		return
	}

	// Clear pending on success.
	h.clearPendingPlanCode(userID)
	h.clearPendingPromo(userID)

	if granted {
		h.editOrSend(chatID, messageID,
			myI18n.T(loc, "Subscription.Activated"),
			&InlineKeyboardMarkup{InlineKeyboard: [][]InlineKeyboardButton{
				{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuHome}},
			}},
		)
		return
	}

	// Payment URL returned — show a pay button.
	h.editOrSend(chatID, messageID,
		myI18n.T(loc, "Subscription.PayPrompt"),
		&InlineKeyboardMarkup{InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: myI18n.T(loc, "Btn.Pay"), URL: confirmURL}},
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuSubscription}},
		}},
	)
}

// ---------------------------------------------------------------------------
// startCreateBotFlow (existing, kept below subscription block)
// ---------------------------------------------------------------------------

// startCreateBotFlow kicks off the onboarding state machine from the main menu.
// - Already-active specialist: re-register their bot handler and confirm.
// - New user: prompt for the BotFather token (legacy onboarding flow).
func (h *MasterHandler) startCreateBotFlow(chatID, userID int64, messageID int, loc *localizerType) {
	_ = messageID
	existing, err := masterLoadSpecialist(userID)
	if err != nil {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}
	if existing != nil && existing.IsActive {
		if OnSpecialistCreated != nil {
			if err := OnSpecialistCreated(existing); err != nil {
				log.Printf("master: re-register for @%s failed: %v", existing.BotUsername, err)
			}
		}
		h.bot.SendMessage(chatID, formatAlreadyRegistered(loc, existing.BotUsername), nil)
		return
	}
	h.beginTokenEntry(chatID, userID, loc)
}

// ---------------------------------------------------------------------------
// Invite-a-colleague screen
// ---------------------------------------------------------------------------

// renderInviteScreen shows the specialist's master-bot referral link and a native share button.
// If the user hasn't created a bot yet they see a prompt to do so first.
func (h *MasterHandler) renderInviteScreen(chatID, userID int64, messageID int, loc *localizerType) {
	notRegisteredKb := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: myI18n.T(loc, "MasterMenu.BtnCreateBot"), CallbackData: cbMenuCreateBot}},
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuHome}},
		},
	}

	sp, err := masterLoadSpecialist(userID)
	if err != nil || sp == nil {
		h.editOrSend(chatID, messageID, myI18n.T(loc, "MasterInvite.NotRegistered"), notRegisteredKb)
		return
	}

	code := sp.ReferralCode
	if code == "" {
		ensured, ensureErr := db.EnsureSpecialistReferralCode(sp.ID)
		if ensureErr != nil {
			log.Printf("master: invite screen: ensure referral code for %s: %v", sp.ID, ensureErr)
			h.editOrSend(chatID, messageID, myI18n.T(loc, "MasterInvite.NotRegistered"), notRegisteredKb)
			return
		}
		code = ensured
	}

	botUsername := h.bot.Username
	var link string
	if botUsername != "" {
		link = "https://t.me/" + botUsername + "?start=ref_" + code
	} else {
		link = "https://t.me/?start=ref_" + code
	}

	body := myI18n.Tf(loc, "MasterInvite.Body", map[string]interface{}{
		"Link": link,
		"Days": config.ReferralRewardDays(),
	})

	shareURL := "https://t.me/share/url?url=" + url.QueryEscape(link) +
		"&text=" + url.QueryEscape(myI18n.T(loc, "MasterInvite.ShareText"))

	kb := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: myI18n.T(loc, "MasterInvite.ShareBtn"), URL: shareURL}},
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuHome}},
		},
	}
	h.editOrSend(chatID, messageID, body, kb)
}
