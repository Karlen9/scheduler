package telegram

import (
	"fmt"
	"log"
	"strings"

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
)

// renderMainMenu edits (or sends) the master bot's root menu for the given user.
// Callback paths land here with messageID != 0; fresh /start uses messageID == 0.
func (h *MasterHandler) renderMainMenu(chatID, userID int64, messageID int, loc *localizerType) {
	text := myI18n.T(loc, "MasterMenu.Home")

	rows := [][]InlineKeyboardButton{
		{{Text: myI18n.T(loc, "MasterMenu.BtnCreateBot"), CallbackData: cbMenuCreateBot}},
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
