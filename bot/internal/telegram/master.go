package telegram

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"scheduler-bot/internal/config"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* OnboardingState tracks where a user is in the onboarding flow.
***************************************************************************************************/
type OnboardingState int

/***************************************************************************************************
* Groups related constants declared together for this module.
***************************************************************************************************/
const (
	/***************************************************************************************************
	* Defines the state none value used by the telegram bot layer.
	*
	* Usage context:
	* - Reused by the telegram bot layer to keep shared values centralized.
	***************************************************************************************************/
	StateNone OnboardingState = iota
	/***************************************************************************************************
	* Defines the state awaiting token value used by the telegram bot layer.
	*
	* Usage context:
	* - Reused by the telegram bot layer to keep shared values centralized.
	***************************************************************************************************/
	StateAwaitingToken
	/***************************************************************************************************
	* Defines the state awaiting name value used by the telegram bot layer.
	*
	* Usage context:
	* - Reused by the telegram bot layer to keep shared values centralized.
	***************************************************************************************************/
	StateAwaitingName
	// StateAwaitingEmail is entered after StateAwaitingName; the user provides a contact email
	// that will be used for YooKassa fiscal receipts. Name is held in the session until this step
	// completes and the specialist row is created.
	StateAwaitingEmail
	// StateAwaitingReplacementToken is entered via /replacetoken or the profile menu when an
	// already-registered specialist needs to swap their bot token (e.g. after BotFather /revoke).
	StateAwaitingReplacementToken
	// StateAwaitingPromoCode is entered when the user taps "I have a promo code" on the
	// subscription screen. The pending plan code is stored in pendingPlanCodes keyed by userID.
	StateAwaitingPromoCode

	// Admin promo-code creation states (admin-only, stored under the same sessions map).
	StateAwaitingPromoNewCode       // admin typed the code string
	StateAwaitingPromoDiscountValue // admin typed the numeric discount
	StateAwaitingPromoMaxRedempt    // admin typed max redemptions (or "skip")
	StateAwaitingPromoDurationDays  // admin typed duration_days override (or "skip")
)

/***************************************************************************************************
* OnboardingSession holds temporary data during onboarding.
***************************************************************************************************/
type OnboardingSession struct {
	State       OnboardingState
	BotToken    string
	BotUsername string
	Name        string // set in handleNameInput; carried into handleEmailInput for specialist creation
}

// pendingRef is a referral code captured from "/start ref_<code>" that is waiting for the user
// to finish onboarding (token + name) before it can be persisted on a specialists row.
type pendingRef struct {
	code string
	at   time.Time
}

// pendingRefTTL bounds how long an orphaned pending referral lingers in memory. Users who start
// onboarding via a share link but never complete the token+name flow would otherwise leak a map
// entry for life. 24h is long enough to absorb realistic think-time pauses.
const pendingRefTTL = 24 * time.Hour

/***************************************************************************************************
* MasterHandler handles the master bot for specialist onboarding.
***************************************************************************************************/
type MasterHandler struct {
	bot            *Bot
	sessions       map[int64]*OnboardingSession // telegramUserID -> session
	mu             sync.RWMutex
	publicBaseURL  string
	webAppURL      string
	adminIDs       []int64
	supportGroupID int64                // 0 = support relay disabled
	pendingRefs    map[int64]pendingRef // telegramUserID -> pending referrer code + capture time
	// pendingPlanCodes stores the plan code selected before entering the promo-code state.
	pendingPlanCodes map[int64]string // telegramUserID -> planCode

	// promoCreateDrafts holds in-progress admin promo-code creation state.
	// Guarded by h.mu (same mutex as sessions / pendingRefs).
	promoCreateDrafts map[int64]*promoCreateDraft // adminUserID -> draft

	// subAutoRenew stores the specialist's auto-renewal toggle choice on the subscription screen.
	// Absent entry means default ON. Guarded by h.mu.
	subAutoRenew map[int64]bool // telegramUserID -> auto-renew choice for master-bot checkout (absent = default ON)

	// pendingPromoCodes stores the validated promo code for a user who has passed validation and is
	// about to tap "Pay". Guarded by h.mu.
	pendingPromoCodes map[int64]string // telegramUserID -> validated promo code awaiting payment

	// CreateCheckoutFunc is injected by main.go to avoid an import cycle (api imports telegram
	// for photo handlers; telegram must not import api). Nil until wired.
	CreateCheckoutFunc func(ctx context.Context, specialist *models.Specialist, planCode, promoCode string, autoRenew bool) (confirmationURL string, granted bool, err error)

	// ValidatePromoFunc is injected by main.go to avoid the api→telegram import cycle.
	// It validates a promo code for a given plan and specialist WITHOUT creating a checkout.
	// Returns (finalKopecks, discountKopecks, reason, ok).
	ValidatePromoFunc func(code, planCode, specialistID string) (finalKopecks, discountKopecks int, reason string, ok bool)
}

// promoCreateDraft tracks the state of an admin creating a new promo code step by step.
// All access must be under h.mu.
type promoCreateDraft struct {
	Code         string // upper-cased code string
	DiscountType string // "percent" | "amount" — set by inline button
	// DiscountValue is filled in after the admin confirms the type and types the value.
	DiscountValue  int
	MaxRedemptions *int // nil = unlimited
	DurationDays   int  // 0 = use plan's own duration
}

/***************************************************************************************************
* NewMasterHandler creates a new master bot handler.
*
* Parameters:
* - publicBaseURL: Public base url used by the current operation.
* - bot: Bot used by the current operation.
* - webAppURL: Web app url used by the current operation.
* - adminIDs: Identifiers used to target the related records.
*
* Returns:
* - The computed value for the current operation as *MasterHandler.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func NewMasterHandler(bot *Bot, publicBaseURL, webAppURL string, adminIDs []int64, supportGroupID int64) *MasterHandler {
	return &MasterHandler{
		bot:               bot,
		sessions:          make(map[int64]*OnboardingSession),
		publicBaseURL:     publicBaseURL,
		webAppURL:         webAppURL,
		adminIDs:          adminIDs,
		supportGroupID:    supportGroupID,
		pendingRefs:       make(map[int64]pendingRef),
		pendingPlanCodes:  make(map[int64]string),
		promoCreateDrafts: make(map[int64]*promoCreateDraft),
		subAutoRenew:      make(map[int64]bool),
		pendingPromoCodes: make(map[int64]string),
	}
}

// extractRefPayload parses the referral code from a "/start ref_<code>" message.
// Accepts the trailing ref_-prefixed form only — plain payloads are ignored so operators can
// still use other deep-link payload spaces in the future without collision.
func extractRefPayload(text string) string {
	parts := strings.SplitN(strings.TrimSpace(text), " ", 2)
	if len(parts) < 2 {
		return ""
	}
	payload := strings.TrimSpace(parts[1])
	if strings.HasPrefix(payload, "ref_") {
		return strings.TrimPrefix(payload, "ref_")
	}
	return ""
}

// rememberPendingReferral stashes a referral code captured from /start until the user finishes
// onboarding (token + name) and a specialists row exists to attribute it to. A returning
// already-registered specialist simply never reaches CreateSpecialist, so the pending code is
// harmless. Every write opportunistically evicts stale entries so abandoned sessions don't
// accumulate forever.
func (h *MasterHandler) rememberPendingReferral(userID int64, code string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.evictStalePendingRefsLocked(time.Now())
	h.pendingRefs[userID] = pendingRef{code: code, at: time.Now()}
}

// takePendingReferral returns and clears any pending referral code for the user, also evicting
// any stale entries accumulated since the last write.
func (h *MasterHandler) takePendingReferral(userID int64) string {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := time.Now()
	h.evictStalePendingRefsLocked(now)
	entry, ok := h.pendingRefs[userID]
	delete(h.pendingRefs, userID)
	if !ok || now.Sub(entry.at) > pendingRefTTL {
		return ""
	}
	return entry.code
}

// clearPendingReferral drops the pending entry without returning it. Used from /cancel so a
// user explicitly abandoning onboarding doesn't leave an orphan behind.
func (h *MasterHandler) clearPendingReferral(userID int64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.pendingRefs, userID)
}

// evictStalePendingRefsLocked removes entries older than pendingRefTTL. Caller must hold h.mu.
func (h *MasterHandler) evictStalePendingRefsLocked(now time.Time) {
	for uid, entry := range h.pendingRefs {
		if now.Sub(entry.at) > pendingRefTTL {
			delete(h.pendingRefs, uid)
		}
	}
}

// setPendingPlanCode stores the plan code for a user about to enter a promo code.
func (h *MasterHandler) setPendingPlanCode(userID int64, planCode string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.pendingPlanCodes[userID] = planCode
}

// clearPendingPlanCode drops the pending plan code for a user without returning it.
// Used from /cancel so an abandoned promo-code entry doesn't leave an orphaned plan code.
func (h *MasterHandler) clearPendingPlanCode(userID int64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.pendingPlanCodes, userID)
}

// --- subAutoRenew helpers (guarded by h.mu) ---

// getSubAutoRenew returns the auto-renew preference for a user. Absent entry defaults to true (ON).
func (h *MasterHandler) getSubAutoRenew(userID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	v, ok := h.subAutoRenew[userID]
	if !ok {
		return true
	}
	return v
}

// setSubAutoRenew stores the auto-renew preference for a user.
func (h *MasterHandler) setSubAutoRenew(userID int64, v bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.subAutoRenew[userID] = v
}

// --- promoCreateDraft helpers (all guarded by h.mu) ---

// getPromoCreateDraft returns the in-progress promo-create draft for an admin, or nil.
func (h *MasterHandler) getPromoCreateDraft(adminID int64) *promoCreateDraft {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.promoCreateDrafts[adminID]
}

// setPromoCreateDraft stores (or replaces) the in-progress draft for an admin.
// Passing nil clears the draft.
func (h *MasterHandler) setPromoCreateDraft(adminID int64, d *promoCreateDraft) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if d == nil {
		delete(h.promoCreateDrafts, adminID)
	} else {
		h.promoCreateDrafts[adminID] = d
	}
}

// clearPromoCreateDraft removes the in-progress draft for an admin.
func (h *MasterHandler) clearPromoCreateDraft(adminID int64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.promoCreateDrafts, adminID)
}

// peekPendingPlanCode reads the pending plan code WITHOUT deleting it.
// ok=false when absent or empty (does NOT default to pro_annual).
func (h *MasterHandler) peekPendingPlanCode(userID int64) (string, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	code, ok := h.pendingPlanCodes[userID]
	if !ok || code == "" {
		return "", false
	}
	return code, true
}

// setPendingPromo stores the validated promo code for the user awaiting final payment.
func (h *MasterHandler) setPendingPromo(userID int64, code string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.pendingPromoCodes[userID] = code
}

// peekPendingPromo reads the pending promo code without deleting it.
func (h *MasterHandler) peekPendingPromo(userID int64) (string, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	code, ok := h.pendingPromoCodes[userID]
	if !ok || code == "" {
		return "", false
	}
	return code, true
}

// clearPendingPromo removes the pending promo code for the user.
func (h *MasterHandler) clearPendingPromo(userID int64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.pendingPromoCodes, userID)
}

/***************************************************************************************************
* Returns session.
*
* Parameters:
* - userID: Identifier used to target the current record.
*
* Returns:
* - The computed value for the current operation as *OnboardingSession.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) getSession(userID int64) *OnboardingSession {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.sessions[userID]
}

/***************************************************************************************************
* Sets session.
*
* Parameters:
* - userID: Identifier used to target the current record.
* - session: Session used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) setSession(userID int64, session *OnboardingSession) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if session == nil {
		delete(h.sessions, userID)
	} else {
		h.sessions[userID] = session
	}
}

/***************************************************************************************************
* HandleUpdate processes incoming updates for the master bot.
*
* Parameters:
* - update: Date value used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) HandleUpdate(update Update) {
	/***************************************************************************************************
	* Callback queries (inline-keyboard clicks) are routed first — they carry their own auth context.
	***************************************************************************************************/
	if update.CallbackQuery != nil {
		if h.dispatchCallback(update.CallbackQuery) {
			return
		}
		// Unhandled callback — ack so the spinner doesn't linger.
		h.bot.AnswerCallbackQuery(update.CallbackQuery.ID, "")
		return
	}

	if update.Message == nil {
		return
	}

	msg := update.Message

	/***************************************************************************************************
	* Log any non-DM chat the bot is added to, so operators can discover the SUPPORT_GROUP_ID of a
	* newly created supergroup without leaving Telegram / installing helper bots.
	* Examples: "groups/channels the master bot sees" — chat.id=-1001234 type=supergroup title=…
	***************************************************************************************************/
	if msg.Chat.Type != "" && msg.Chat.Type != "private" {
		log.Printf("master-bot sees chat: id=%d type=%s (set SUPPORT_GROUP_ID to this value if this is your operator supergroup)", msg.Chat.ID, msg.Chat.Type)
	}

	/***************************************************************************************************
	* Messages arriving inside the support supergroup get relayed back to the original user.
	***************************************************************************************************/
	if h.supportGroupID != 0 && msg.Chat.ID == h.supportGroupID {
		h.handleSupportGroupMessage(msg)
		return
	}

	if msg.From == nil {
		return
	}

	userID := msg.From.ID
	chatID := msg.Chat.ID
	text := strings.TrimSpace(msg.Text)
	loc := h.localizerFor(userID)

	/***************************************************************************************************
	* Handle commands.
	***************************************************************************************************/
	if strings.HasPrefix(text, "/") {
		h.handleCommand(chatID, userID, text, loc)
		return
	}

	/***************************************************************************************************
	* An active onboarding session wins over everything else: users in the middle of pasting a token
	* or entering a name should have their input consumed by the state machine.
	***************************************************************************************************/
	if session := h.getSession(userID); session != nil {
		switch session.State {
		case StateAwaitingToken:
			h.handleTokenInput(chatID, userID, text, session, loc)
		case StateAwaitingName:
			h.handleNameInput(chatID, userID, text, session, msg.From.Username, loc)
		case StateAwaitingEmail:
			h.handleEmailInput(chatID, userID, text, session, msg.From.Username, loc)
		case StateAwaitingReplacementToken:
			h.handleReplacementTokenInput(chatID, userID, text, loc)
		case StateAwaitingPromoCode:
			h.handlePromoCodeInput(chatID, userID, text, loc)
		// Admin promo-code creation states (admin-only).
		case StateAwaitingPromoNewCode:
			h.handleAdminPromoCodeInput(chatID, userID, text, loc)
		case StateAwaitingPromoDiscountValue:
			h.handleAdminPromoDiscountValueInput(chatID, userID, text, loc)
		case StateAwaitingPromoMaxRedempt:
			h.handleAdminPromoMaxRedemptInput(chatID, userID, text, loc)
		case StateAwaitingPromoDurationDays:
			h.handleAdminPromoDurationDaysInput(chatID, userID, text, loc)
		}
		return
	}

	/***************************************************************************************************
	* Otherwise, if the user has an open support thread, relay this DM into the operator topic.
	***************************************************************************************************/
	if h.supportGroupID != 0 && h.tryRelayDMToSupport(msg) {
		return
	}

	/***************************************************************************************************
	* Fallback: nudge the user back to /start.
	***************************************************************************************************/
	h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
}

// localizerFor resolves the UI language for a master-bot user. Precedence:
//  1. Registered specialist → specialist.Language (that's the language they already picked in their bot)
//  2. master_users.language (set via the master-bot's own language menu)
//  3. product default "ru"
//
// Telegram's client language code is intentionally ignored — the product is Russian-first and we
// only switch when the user explicitly picks another language.
func (h *MasterHandler) localizerFor(userID int64) *localizerType {
	if userID != 0 {
		if sp, err := db.GetSpecialistByTelegramID(userID); err == nil && sp != nil && sp.Language != "" {
			return myI18n.NewLocalizer(sp.Language)
		}
	}
	return myI18n.NewLocalizer(db.GetMasterUserLanguage(userID))
}

/***************************************************************************************************
* Handles command.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - text: Text used by the current operation.
* - langCode: Lang code used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleCommand(chatID, userID int64, text string, loc *localizerType) {
	cmd := strings.Split(text, " ")[0]

	switch cmd {
	case "/start":
		// /start may carry a payload: "/start ref_<code>" tags the new specialist with the
		// referral code of the existing specialist who invited them. Recorded once on creation
		// and never overwritten afterwards.
		if payload := extractRefPayload(text); payload != "" {
			h.rememberPendingReferral(userID, payload)
		}
		h.handleStart(chatID, userID, loc)
	case "/menu":
		h.renderMainMenu(chatID, userID, 0, loc)
	case "/language":
		h.renderLanguagePicker(chatID, 0, loc)
	case "/replacetoken":
		h.beginReplaceToken(chatID, userID, loc)
	case "/cancel":
		h.handleCancel(chatID, userID, loc)
	case "/help":
		if h.isAdmin(userID) {
			h.bot.SendMessage(chatID, myI18n.T(loc, "Master.HelpAdmin"), nil)
		} else {
			h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Help"), nil)
		}
	case "/specialists":
		h.handleAdminSpecialists(chatID, userID, loc)
	case "/stats":
		h.handleAdminStats(chatID, userID, loc)
	case "/admin":
		if h.isAdmin(userID) {
			h.renderAdminMenu(chatID, userID, 0, loc)
		} else {
			h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
		}
	case "/close":
		// Only meaningful inside the support group — ignored elsewhere.
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
	default:
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
	}
}

/***************************************************************************************************
* Checks whether admin.
*
* Parameters:
* - userID: Identifier used to target the current record.
*
* Returns:
* - The computed value for the current operation as bool.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) isAdmin(userID int64) bool {
	for _, id := range h.adminIDs {
		if id == userID {
			return true
		}
	}
	return false
}

/***************************************************************************************************
* Handles admin specialists.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleAdminSpecialists(chatID, userID int64, loc *localizerType) {
	if !h.isAdmin(userID) {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
		return
	}

	specialists, err := db.GetAllActiveSpecialists()
	if err != nil {
		log.Printf("Error getting specialists: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	if len(specialists) == 0 {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.NoSpecialists"), nil)
		return
	}

	msg := myI18n.Tf(loc, "Master.SpecialistsList", map[string]interface{}{"Count": len(specialists)})
	for i, t := range specialists {
		msg += myI18n.Tf(loc, "Master.SpecialistItem", map[string]interface{}{
			"Num":         i + 1,
			"Name":        t.Name,
			"BotUsername": t.BotUsername,
			"TelegramID":  t.TelegramUserID,
			"CreatedAt":   t.CreatedAt.Format("02.01.2006 15:04"),
		})
	}

	h.bot.SendMessage(chatID, msg, nil)
}

/***************************************************************************************************
* Handles admin stats.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleAdminStats(chatID, userID int64, loc *localizerType) {
	if !h.isAdmin(userID) {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
		return
	}

	specialists, err := db.GetAllActiveSpecialists()
	if err != nil {
		log.Printf("Error getting specialists: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	msg := myI18n.T(loc, "Master.Stats")
	msg += myI18n.Tf(loc, "Master.SpecialistCount", map[string]interface{}{"Count": len(specialists)})

	h.bot.SendMessage(chatID, msg, nil)
}

/***************************************************************************************************
* Handles start.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleStart(chatID, userID int64, loc *localizerType) {
	/***************************************************************************************************
	* Check if already registered.
	***************************************************************************************************/
	existing, err := db.GetSpecialistByTelegramID(userID)
	if err != nil {
		log.Printf("Error checking existing specialist: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	if existing != nil && existing.IsActive {
		/***************************************************************************************************
		* Already registered and active — re-register handler in case it was lost, then show the main menu.
		* A re-registration failure (e.g. the specialist's own BotFather token was revoked externally) is
		* surfaced as a warning message but must NOT suppress the main menu: the user still needs to be
		* able to contact the operator or create a replacement bot.
		***************************************************************************************************/
		log.Printf("Specialist @%s already exists, re-registering handler", existing.BotUsername)
		reregisterFailed := false
		if OnSpecialistCreated != nil {
			if err := OnSpecialistCreated(existing); err != nil {
				log.Printf("Error re-registering bot for @%s: %v", existing.BotUsername, err)
				reregisterFailed = true
			}
		}
		if reregisterFailed {
			h.bot.SendMessage(chatID, fmt.Sprintf(myI18n.T(loc, "Master.RegistrationFailed"), existing.BotUsername), nil)
		} else {
			h.bot.SendMessage(chatID, fmt.Sprintf(myI18n.T(loc, "Master.AlreadyRegistered"), existing.BotUsername), nil)
		}
		h.renderMainMenu(chatID, userID, 0, loc)
		return
	}

	/***************************************************************************************************
	* New user — show the main menu so they can pick between creating a bot, reading FAQs, or
	* contacting the operator. Starting the token state machine immediately (the old behavior)
	* surprised users who just wanted info.
	***************************************************************************************************/
	h.renderMainMenu(chatID, userID, 0, loc)
}

// beginTokenEntry is invoked from the menu's "Create my bot" button; it puts the user into the
// legacy onboarding state machine and prompts for a BotFather token.
func (h *MasterHandler) beginTokenEntry(chatID, userID int64, loc *localizerType) {
	h.setSession(userID, &OnboardingSession{State: StateAwaitingToken})
	h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Welcome"), nil)
}

/***************************************************************************************************
* Handles cancel.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleCancel(chatID, userID int64, loc *localizerType) {
	h.setSession(userID, nil)
	// Drop any referral code captured from a /start ref_<code> that the user is now abandoning.
	h.clearPendingReferral(userID)
	// Drop any pending plan code stored before entering the promo-code state.
	h.clearPendingPlanCode(userID)
	// Drop any validated promo code stored before the final pay step.
	h.clearPendingPromo(userID)
	// Drop any in-progress admin promo-create draft.
	h.clearPromoCreateDraft(userID)
	h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Cancelled"), nil)
}

/***************************************************************************************************
* Handles token input.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - text: Text used by the current operation.
* - session: Session used by the current operation.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleTokenInput(chatID, userID int64, text string, session *OnboardingSession, loc *localizerType) {
	/***************************************************************************************************
	* Validate token format (basic check).
	***************************************************************************************************/
	if !strings.Contains(text, ":") {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.InvalidToken"), nil)
		return
	}

	/***************************************************************************************************
	* Check if token already registered.
	***************************************************************************************************/
	existing, err := db.GetSpecialistByBotToken(text)
	if err != nil {
		log.Printf("Error checking existing bot: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}
	if existing != nil {
		if existing.TelegramUserID != userID {
			// Token belongs to a different user — reject outright.
			h.bot.SendMessage(chatID, myI18n.T(loc, "Master.TokenAlreadyUsed"), nil)
			return
		}
		if existing.IsActive {
			/***************************************************************************************************
			* Same user's active bot — re-register handler and confirm.
			***************************************************************************************************/
			log.Printf("Token for @%s already exists for same user, re-registering", existing.BotUsername)
			if OnSpecialistCreated != nil {
				if err := OnSpecialistCreated(existing); err != nil {
					log.Printf("Error re-registering bot for @%s: %v", existing.BotUsername, err)
					h.bot.SendMessage(chatID, fmt.Sprintf(myI18n.T(loc, "Master.RegistrationFailed"), existing.BotUsername), nil)
					h.setSession(userID, nil)
					return
				}
			}
			msg := fmt.Sprintf(myI18n.T(loc, "Master.AlreadyRegistered"), existing.BotUsername)
			h.bot.SendMessage(chatID, msg, nil)
			h.setSession(userID, nil)
			return
		}
		// Same user, soft-deleted row — fall through to Telegram validation and name prompt so
		// CreateSpecialist (now an upsert) can reactivate the row.
	}

	/***************************************************************************************************
	* Validate with Telegram.
	***************************************************************************************************/
	bot, err := NewBot(text)
	if err != nil {
		log.Printf("Invalid bot token: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.InvalidToken"), nil)
		return
	}

	/***************************************************************************************************
	* Token valid, save and ask for name.
	***************************************************************************************************/
	session.BotToken = text
	session.BotUsername = bot.Username
	session.State = StateAwaitingName
	h.setSession(userID, session)

	msg := fmt.Sprintf(myI18n.T(loc, "Master.TokenAccepted"), bot.Username)
	h.bot.SendMessage(chatID, msg, nil)
}

/***************************************************************************************************
* Handles name input.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - text: Text used by the current operation.
* - session: Session used by the current operation.
* - username: Username used by the current operation.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleNameInput(chatID, userID int64, text string, session *OnboardingSession, username string, loc *localizerType) {
	name := strings.TrimSpace(text)
	if len(name) < 2 {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.NameTooShort"), nil)
		return
	}

	/***************************************************************************************************
	* Store the name in the session and advance to the email step.
	***************************************************************************************************/
	session.Name = name
	session.State = StateAwaitingEmail
	h.setSession(userID, session)

	h.bot.SendMessage(chatID, myI18n.T(loc, "Master.AskEmail"), nil)
}

// emailRegexp is a simple sanity-check pattern compiled once at package scope. It requires at
// least one non-whitespace character before the @, at least one after, and a dot in the domain
// part. Full RFC 5321 validation is deliberately avoided — we just want to reject obvious typos.
var emailRegexp = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

// isValidEmail returns true when s looks like a plausible email address.
func isValidEmail(s string) bool {
	return emailRegexp.MatchString(s)
}

/***************************************************************************************************
* Handles email input. Validates the address, creates the specialist row, persists the email, and
* completes onboarding. This is called after handleNameInput stores the name in the session and
* advances to StateAwaitingEmail.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - userID: Identifier used to target the current record.
* - text: Text used by the current operation.
* - session: Session used by the current operation.
* - username: Username used by the current operation.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) handleEmailInput(chatID, userID int64, text string, session *OnboardingSession, username string, loc *localizerType) {
	email := strings.TrimSpace(text)
	if !isValidEmail(email) {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.InvalidEmail"), nil)
		return
	}

	name := session.Name

	/***************************************************************************************************
	* Create specialist.
	***************************************************************************************************/
	specialist, err := db.CreateSpecialist(
		userID,
		session.BotToken,
		session.BotUsername,
		name,
		"Europe/Moscow",
		24,
	)
	if err != nil {
		log.Printf("Error creating specialist: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	/***************************************************************************************************
	* Persist the email address (log-only on failure; do not abort registration).
	***************************************************************************************************/
	if err := db.SetSpecialistEmail(specialist.ID, email); err != nil {
		log.Printf("master: save specialist email failed (%s): %v", specialist.ID, err)
	}

	/***************************************************************************************************
	* Save specialist's personal Telegram handle.
	***************************************************************************************************/
	if username != "" {
		if _, err := db.UpdateSpecialistProfile(specialist.ID, username, "", "", "", 0, 0, ""); err != nil {
			log.Printf("Error saving telegram handle: %v", err)
		}
	}

	/***************************************************************************************************
	* Apply any pending referral attribution captured from /start ref_<code>. The code must resolve
	* to a different active specialist (no self-referrals, no unknown codes). Invalid codes are
	* silently dropped — better UX than erroring out mid-onboarding.
	***************************************************************************************************/
	if refCode := h.takePendingReferral(userID); refCode != "" {
		if referrer, rerr := db.GetSpecialistByReferralCode(refCode); rerr == nil && referrer != nil && referrer.ID != specialist.ID {
			if uerr := db.SetSpecialistReferredViaCode(specialist.ID, refCode); uerr != nil {
				log.Printf("master: attribute referral %s -> %s failed: %v", refCode, specialist.ID, uerr)
			} else {
				log.Printf("master: specialist %s attributed to referrer %s (@%s)", specialist.ID, referrer.ID, referrer.BotUsername)
			}
		}
	}

	/***************************************************************************************************
	* Seed default data.
	***************************************************************************************************/
	h.seedDefaults(specialist.ID, loc)

	/***************************************************************************************************
	* Register bot handler + webhook via main.go callback.
	***************************************************************************************************/
	if OnSpecialistCreated != nil {
		if err := OnSpecialistCreated(specialist); err != nil {
			log.Printf("Error registering bot for @%s: %v", session.BotUsername, err)
			h.bot.SendMessage(chatID, fmt.Sprintf(myI18n.T(loc, "Master.RegistrationFailed"), session.BotUsername), nil)
			h.setSession(userID, nil)
			return
		}
	}

	/***************************************************************************************************
	* Clear session.
	***************************************************************************************************/
	h.setSession(userID, nil)

	/***************************************************************************************************
	* Send success message.
	***************************************************************************************************/
	msg := fmt.Sprintf(myI18n.T(loc, "Master.Success"), name, session.BotUsername, session.BotUsername, session.BotUsername)
	h.bot.SendMessage(chatID, msg, nil)

	log.Printf("New specialist registered: %s (@%s)", name, session.BotUsername)
}

/***************************************************************************************************
* Implements the seed defaults logic used by this module.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - loc: Loc used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (h *MasterHandler) seedDefaults(specialistID string, loc *localizerType) {
	/***************************************************************************************************
	* Session types.
	***************************************************************************************************/
	db.CreateSessionType(specialistID, "personal", myI18n.T(loc, "Seed.Personal"), 60, 3000, "RUB", "")

	/***************************************************************************************************
	* Working hours (Mon-Fri 9-18, Sat 10-15).
	***************************************************************************************************/
	workingHours := []struct {
		day   int
		start string
		end   string
	}{
		{1, "09:00", "18:00"},
		{2, "09:00", "18:00"},
		{3, "09:00", "18:00"},
		{4, "09:00", "18:00"},
		{5, "09:00", "18:00"},
		{6, "10:00", "15:00"},
	}

	for _, wh := range workingHours {
		db.UpsertWorkingHours(specialistID, wh.day, wh.start, wh.end)
	}
}

/***************************************************************************************************
* OnSpecialistCreated is called when a new specialist is created or re-registered. Set by main.go
* to register the new bot dynamically. Returns error if registration fails.
*
* Usage context:
* - Reused by the telegram bot layer to keep shared values centralized.
***************************************************************************************************/
var OnSpecialistCreated func(specialist *models.Specialist) error

/***************************************************************************************************
* localizerType is an alias for the go-i18n Localizer type used in master handler signatures.
***************************************************************************************************/
type localizerType = i18n.Localizer

// beginReplaceToken kicks off the token-rotation flow. Only meaningful for an already-registered
// specialist (the one we're rotating credentials for). New users get nudged back to /start.
func (h *MasterHandler) beginReplaceToken(chatID, userID int64, loc *localizerType) {
	existing, err := db.GetSpecialistByTelegramID(userID)
	if err != nil || existing == nil || !existing.IsActive {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Unknown"), nil)
		return
	}
	h.setSession(userID, &OnboardingSession{State: StateAwaitingReplacementToken, BotUsername: existing.BotUsername})
	msg := fmt.Sprintf(myI18n.T(loc, "MasterReplace.Prompt"), existing.BotUsername)
	h.bot.SendMessage(chatID, msg, nil)
}

// handleReplacementTokenInput validates the pasted token, ensures it belongs to the SAME bot
// (username must match so we don't let someone swap credentials for a different account), then
// updates the encrypted row and re-registers the webhook. All bookings / clients stay intact.
func (h *MasterHandler) handleReplacementTokenInput(chatID, userID int64, text string, loc *localizerType) {
	token := strings.TrimSpace(text)
	session := h.getSession(userID)
	if session == nil {
		return
	}

	if !strings.Contains(token, ":") {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.InvalidToken"), nil)
		return
	}

	// Validate the token with Telegram and capture the bot username it resolves to.
	bot, err := NewBot(token)
	if err != nil {
		log.Printf("replace-token: invalid token from %d: %v", userID, err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.InvalidToken"), nil)
		return
	}

	// Credentials must point at the same underlying bot. This is the critical safety check:
	// without it a user could paste a token for somebody else's bot and hijack their schedule.
	if !strings.EqualFold(bot.Username, session.BotUsername) {
		log.Printf("replace-token: username mismatch for user %d (got @%s, expected @%s)", userID, bot.Username, session.BotUsername)
		h.bot.SendMessage(chatID, fmt.Sprintf(myI18n.T(loc, "MasterReplace.UsernameMismatch"), session.BotUsername, bot.Username), nil)
		return
	}

	existing, err := db.GetSpecialistByTelegramID(userID)
	if err != nil || existing == nil {
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		h.setSession(userID, nil)
		return
	}

	if err := db.UpdateSpecialistBotToken(existing.ID, token); err != nil {
		log.Printf("replace-token: db update for %s failed: %v", existing.ID, err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		// Clear the state so a retry-attempt from the user doesn't get interpreted as another
		// token paste against a half-broken DB state. The user can re-invoke /replacetoken cleanly.
		h.setSession(userID, nil)
		return
	}

	// Reload the specialist with the freshly-encrypted token so the manager re-registers against
	// it (GetSpecialistByID returns the decrypted form via scanSpecialist).
	refreshed, err := db.GetSpecialistByID(existing.ID)
	if err != nil || refreshed == nil {
		log.Printf("replace-token: reload after update failed: %v", err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		h.setSession(userID, nil)
		return
	}
	if OnSpecialistCreated != nil {
		if err := OnSpecialistCreated(refreshed); err != nil {
			log.Printf("replace-token: re-register for %s failed: %v", refreshed.BotUsername, err)
			// DB already swapped — the user can try /start to retry registration later. Surface the
			// partial success honestly rather than pretending it failed.
			h.bot.SendMessage(chatID, fmt.Sprintf(myI18n.T(loc, "Master.RegistrationFailed"), refreshed.BotUsername), nil)
			h.setSession(userID, nil)
			return
		}
	}

	h.setSession(userID, nil)
	h.bot.SendMessage(chatID, fmt.Sprintf(myI18n.T(loc, "MasterReplace.Success"), refreshed.BotUsername), nil)
	h.renderMainMenu(chatID, userID, 0, loc)
	log.Printf("Specialist @%s token rotated by user %d", refreshed.BotUsername, userID)
}

// NotifySubscriptionEvent sends a DM to the specialist identified by their Telegram user ID
// with a message describing the subscription event. Called by api.NotifySubscriptionEventFunc.
func (h *MasterHandler) NotifySubscriptionEvent(tgID int64, event string) {
	loc := h.localizerFor(tgID)
	var text string
	switch event {
	case "subscription_activated":
		text = myI18n.T(loc, "Subscription.EventActivated")
	case "subscription_renewed":
		text = myI18n.T(loc, "Subscription.EventRenewed")
	case "subscription_payment_failed":
		text = myI18n.T(loc, "Subscription.EventPaymentFailed")
	case "trial_expired":
		text = myI18n.T(loc, "Subscription.EventTrialExpired")
	case "subscription_expired":
		text = myI18n.T(loc, "Subscription.EventExpired")
	case "referral_reward":
		text = myI18n.Tf(loc, "Subscription.EventReferralReward", map[string]interface{}{
			"Days": config.ReferralRewardDays(),
		})
	default:
		log.Printf("master: NotifySubscriptionEvent: unknown event %q for tgID=%d", event, tgID)
		return
	}
	if _, err := h.bot.SendMessage(tgID, text, nil); err != nil {
		log.Printf("master: NotifySubscriptionEvent: send to %d failed: %v", tgID, err)
	}
}
