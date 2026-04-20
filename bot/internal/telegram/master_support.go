package telegram

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

// Support relay overview:
//
//   - A "support thread" is a forum topic inside the owner's support supergroup, mapped 1:1 to
//     a Telegram user who DMed the master bot and tapped "Talk to operator".
//   - Incoming DMs (non-command, non-onboarding) are forwarded into the matching topic via
//     copyMessage — this preserves media/voice/documents without the "Forwarded from" header.
//   - Replies typed into the topic by any admin are copied back to the user's DM.
//   - An admin can post /close inside the topic to archive the thread; the next DM from that
//     user creates a fresh topic.
//
// The relay intentionally refuses to run when SupportGroupID == 0 so deployments without a
// configured support group degrade to a plain "contact operator" message instead of errors.

// spamPatterns is a small blocklist applied to DMs before relay (answer (c) from design Q7).
// Case-insensitive substring match. Keep it conservative — false positives silently drop
// real messages, which is worse than letting obvious spam through.
var spamPatterns = []string{
	"t.me/+", "bit.ly/", "cutt.ly/", "tinyurl.com/",
	"usdt", "btc wallet", "airdrop", "free crypto",
	"nude", "sex chat", "1xbet", "casino",
}

// maxSupportMessageChars caps the incoming DM length to avoid spam walls into the topic.
const maxSupportMessageChars = 4000

// startOperatorSupport is invoked from the main-menu "Talk to operator" button. It makes sure
// a topic exists for this user, posts a welcome in their DM, and tells the owner group that a
// new conversation has begun.
func (h *MasterHandler) startOperatorSupport(chatID, userID int64, messageID int, user User, loc *localizerType) {
	_ = messageID

	if h.supportGroupID == 0 {
		h.bot.SendMessage(chatID, myI18n.T(loc, "MasterSupport.Disabled"), nil)
		return
	}

	thread, err := h.ensureSupportThread(userID, user)
	if err != nil {
		log.Printf("master-support: ensure thread for %d failed: %v", userID, err)
		h.bot.SendMessage(chatID, myI18n.T(loc, "Master.Error"), nil)
		return
	}

	// Confirm to the user that the channel is open and subsequent DMs will be relayed.
	kb := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: myI18n.T(loc, "MasterMenu.BtnBack"), CallbackData: cbMenuHome}},
		},
	}
	h.bot.SendMessageHTML(chatID, myI18n.T(loc, "MasterSupport.Welcome"), kb)

	// Breadcrumb into the topic so operators see the thread opening even if the user hasn't
	// typed anything yet. If the stored topic was deleted by an admin, recreate it transparently.
	if _, err := h.bot.SendMessageToTopic(h.supportGroupID, thread.TopicID,
		fmt.Sprintf("🆕 <b>Conversation opened</b>\n%s", formatUserLine(user))); err != nil {
		if isTopicMissingError(err) {
			log.Printf("master-support: topic %d for user %d deleted — recreating", thread.TopicID, userID)
			if fresh, rerr := h.recreateSupportThread(thread, user); rerr == nil {
				_, _ = h.bot.SendMessageToTopic(h.supportGroupID, fresh.TopicID,
					fmt.Sprintf("🆕 <b>Conversation opened</b> (previous topic was deleted)\n%s", formatUserLine(user)))
			} else {
				log.Printf("master-support: recreate topic for %d failed: %v", userID, rerr)
			}
		} else {
			log.Printf("master-support: post open-marker to topic %d failed: %v", thread.TopicID, err)
		}
	}
}

// tryRelayDMToSupport is called from HandleUpdate when the incoming DM is not a command and not
// part of an onboarding session. Returns true if the message was consumed.
func (h *MasterHandler) tryRelayDMToSupport(msg *Message) bool {
	if h.supportGroupID == 0 || msg.From == nil {
		return false
	}

	thread, err := db.GetSupportThreadByUserID(msg.From.ID)
	if errors.Is(err, db.ErrSupportThreadNotFound) {
		return false
	}
	if err != nil {
		log.Printf("master-support: lookup thread for %d failed: %v", msg.From.ID, err)
		return false
	}

	loc := myI18n.NewLocalizer(msg.From.LanguageCode)

	// Spam filter — drop silently so scripted spammers get no signal.
	if isLikelySpam(msg) {
		log.Printf("master-support: dropped spam from user %d", msg.From.ID)
		return true
	}

	// Length cap — tell the user to trim instead of silently dropping.
	if lengthOfInbound(msg) > maxSupportMessageChars {
		h.bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "MasterSupport.TooLong"), nil)
		return true
	}

	if _, err := h.bot.CopyMessage(h.supportGroupID, msg.Chat.ID, msg.MessageID, thread.TopicID); err != nil {
		if isTopicMissingError(err) {
			// Admin deleted the topic in the group. Close the stale row, spin up a fresh topic,
			// and retry the copy transparently — the user shouldn't have to resend their message.
			log.Printf("master-support: topic %d for user %d deleted — recreating and retrying", thread.TopicID, msg.From.ID)
			fresh, rerr := h.recreateSupportThread(thread, *msg.From)
			if rerr != nil {
				log.Printf("master-support: recreate thread for %d failed: %v", msg.From.ID, rerr)
				h.bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "MasterSupport.RelayFailed"), nil)
				return true
			}
			if _, rerr := h.bot.CopyMessage(h.supportGroupID, msg.Chat.ID, msg.MessageID, fresh.TopicID); rerr != nil {
				log.Printf("master-support: retry copy to new topic %d failed: %v", fresh.TopicID, rerr)
				h.bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "MasterSupport.RelayFailed"), nil)
				return true
			}
			thread = fresh
		} else {
			log.Printf("master-support: copyMessage to topic %d failed: %v", thread.TopicID, err)
			h.bot.SendMessage(msg.Chat.ID, myI18n.T(loc, "MasterSupport.RelayFailed"), nil)
			return true
		}
	}

	if err := db.TouchSupportThread(thread.ID); err != nil {
		log.Printf("master-support: touch thread %s failed: %v", thread.ID, err)
	}
	// Refresh username / display-name if they changed since the thread was opened.
	newDisplay := composeDisplayName(*msg.From)
	if msg.From.Username != thread.TelegramUsername || newDisplay != thread.DisplayName {
		_ = db.UpdateSupportThreadUser(thread.ID, msg.From.Username, newDisplay, msg.From.LanguageCode)
	}
	return true
}

// handleSupportGroupMessage processes a message posted inside the support supergroup.
// We only care about messages inside a mapped topic; plain group chatter is ignored.
func (h *MasterHandler) handleSupportGroupMessage(msg *Message) {
	if msg.MessageThreadID == 0 {
		return
	}
	thread, err := db.GetSupportThreadByTopicID(msg.MessageThreadID)
	if errors.Is(err, db.ErrSupportThreadNotFound) {
		return
	}
	if err != nil {
		log.Printf("master-support: lookup thread for topic %d failed: %v", msg.MessageThreadID, err)
		return
	}

	// /close and /reply-like topic-scoped commands are admin-only. Everything else is copied
	// verbatim to the user so operators can paste multi-line replies, voice notes, etc.
	text := strings.TrimSpace(msg.Text)
	switch {
	case text == "/close":
		h.closeSupportThread(thread.ID, thread.TelegramUserID, msg.MessageThreadID, msg.From)
		return
	case strings.HasPrefix(text, "/"):
		// Leave slash-commands as signals for operators; they won't be relayed back.
		// This prevents accidental /ban or /mute from leaking into user chat.
		return
	}

	if msg.From != nil && msg.From.ID == h.bot.TelegramID() {
		// Don't echo our own system notices (topic open markers, /close acks) back to the user.
		return
	}

	if _, err := h.bot.CopyMessage(thread.TelegramUserID, h.supportGroupID, msg.MessageID, 0); err != nil {
		log.Printf("master-support: copyMessage back to user %d failed: %v", thread.TelegramUserID, err)
		if msg.MessageThreadID != 0 {
			h.bot.SendMessageToTopic(h.supportGroupID, msg.MessageThreadID,
				fmt.Sprintf("⚠️ Failed to deliver last message to user: %v", err))
		}
		return
	}
	_ = db.TouchSupportThread(thread.ID)
}

// closeSupportThread marks the thread closed, notifies both sides, and closes the forum topic
// so new replies don't accidentally land in a silent thread.
func (h *MasterHandler) closeSupportThread(threadID string, userID int64, topicID int, closedBy *User) {
	if err := db.CloseSupportThread(threadID); err != nil {
		log.Printf("master-support: close thread %s failed: %v", threadID, err)
		return
	}
	loc := myI18n.NewLocalizer("")
	// User-side notice.
	h.bot.SendMessage(userID, myI18n.T(loc, "MasterSupport.Closed"), nil)
	// Topic-side acknowledgement.
	closer := "owner"
	if closedBy != nil {
		closer = formatUserLine(*closedBy)
	}
	h.bot.SendMessageToTopic(h.supportGroupID, topicID,
		fmt.Sprintf("🔒 <b>Thread closed</b> by %s", closer))
	// Best-effort: archive the topic so it visually collapses.
	_ = h.bot.CloseForumTopic(h.supportGroupID, topicID)
}

// recreateSupportThread is the recovery path when a stored topic no longer exists in the group
// (the owner deleted it). It creates a brand-new forum topic and updates the existing DB row to
// point at it — we cannot close+insert because telegram_user_id carries a UNIQUE constraint, and
// the row's identity is fine to preserve. Returns the refreshed thread so callers can retry
// whatever relay operation triggered the discovery.
func (h *MasterHandler) recreateSupportThread(stale *models.SupportThread, user User) (*models.SupportThread, error) {
	topicID, err := h.bot.CreateForumTopic(h.supportGroupID, topicNameFor(user))
	if err != nil {
		return nil, fmt.Errorf("create forum topic: %w", err)
	}
	if err := db.ReassignSupportThreadTopic(stale.ID, topicID); err != nil {
		return nil, fmt.Errorf("reassign support thread topic: %w", err)
	}
	stale.TopicID = topicID
	return stale, nil
}

// isTopicMissingError reports whether a Telegram API error indicates that the message thread
// (forum topic) referenced by the request no longer exists. Telegram's exact wording has shifted
// across API versions, so we match a handful of known phrasings case-insensitively rather than
// relying on any single substring.
func isTopicMissingError(err error) bool {
	if err == nil {
		return false
	}
	s := strings.ToLower(err.Error())
	switch {
	case strings.Contains(s, "message thread not found"):
		return true
	case strings.Contains(s, "topic_deleted"):
		return true
	case strings.Contains(s, "thread_not_found"):
		return true
	case strings.Contains(s, "topic not found"):
		return true
	case strings.Contains(s, "thread was deleted"):
		return true
	}
	return false
}

// ensureSupportThread returns the user's open thread, creating a fresh forum topic when none exists.
// Three cases:
//  1. The user has a live (non-closed) thread in the DB → return it directly.
//  2. The user has a stranded closed thread (e.g. from an earlier broken recovery path) → create
//     a fresh topic and reassign the existing row to it. Avoids the telegram_user_id UNIQUE
//     constraint violation that blocks a plain INSERT.
//  3. No row at all → create topic + insert.
func (h *MasterHandler) ensureSupportThread(userID int64, user User) (*models.SupportThread, error) {
	if thread, err := db.GetSupportThreadByUserID(userID); err == nil {
		return thread, nil
	} else if !errors.Is(err, db.ErrSupportThreadNotFound) {
		return nil, err
	}

	// Look for a stranded closed row that still holds the UNIQUE telegram_user_id slot.
	if stale, err := db.GetAnySupportThreadByUserID(userID); err == nil && stale != nil {
		log.Printf("master-support: reopening stranded closed thread %s for user %d", stale.ID, userID)
		topicID, cerr := h.bot.CreateForumTopic(h.supportGroupID, topicNameFor(user))
		if cerr != nil {
			return nil, fmt.Errorf("create forum topic: %w", cerr)
		}
		if rerr := db.ReassignSupportThreadTopic(stale.ID, topicID); rerr != nil {
			return nil, fmt.Errorf("reassign stranded thread: %w", rerr)
		}
		stale.TopicID = topicID
		stale.ClosedAt = nil
		return stale, nil
	} else if err != nil && !errors.Is(err, db.ErrSupportThreadNotFound) {
		return nil, err
	}

	topicID, err := h.bot.CreateForumTopic(h.supportGroupID, topicNameFor(user))
	if err != nil {
		return nil, fmt.Errorf("create forum topic: %w", err)
	}

	thread, err := db.CreateSupportThread(
		userID,
		user.Username,
		composeDisplayName(user),
		user.LanguageCode,
		topicID,
	)
	if err != nil {
		return nil, fmt.Errorf("persist support thread: %w", err)
	}
	return thread, nil
}

// dispatchSupportCallback is a placeholder — reserved for future sup:* callback data such as
// "reopen thread" buttons. Currently unused but wired so the master dispatcher compiles cleanly.
func (h *MasterHandler) dispatchSupportCallback(chatID, userID int64, messageID int, data string, loc *localizerType) {
	_ = chatID
	_ = userID
	_ = messageID
	_ = data
	_ = loc
}

// topicNameFor produces a human-sortable topic title. Format: "First Last · @handle · id"
// (trimmed to fit Telegram's 128-char limit — CreateForumTopic does the truncation).
func topicNameFor(u User) string {
	parts := []string{strings.TrimSpace(u.FirstName + " " + u.LastName)}
	if u.Username != "" {
		parts = append(parts, "@"+u.Username)
	}
	parts = append(parts, fmt.Sprintf("id:%d", u.ID))
	return strings.Join(parts, " · ")
}

// formatUserLine is a short HTML-safe description for header/breadcrumb messages.
func formatUserLine(u User) string {
	name := strings.TrimSpace(u.FirstName + " " + u.LastName)
	if name == "" {
		name = fmt.Sprintf("user %d", u.ID)
	}
	line := htmlEscape(name)
	if u.Username != "" {
		line += fmt.Sprintf(" (@%s)", htmlEscape(u.Username))
	}
	return line
}

// composeDisplayName joins first + last, falling back to username or id.
func composeDisplayName(u User) string {
	name := strings.TrimSpace(u.FirstName + " " + u.LastName)
	if name != "" {
		return name
	}
	if u.Username != "" {
		return "@" + u.Username
	}
	return fmt.Sprintf("id:%d", u.ID)
}

// isLikelySpam applies the small substring blocklist to the message's textual payload
// (text + caption). Unicode case folding is handled by strings.ToLower which, while imperfect,
// is sufficient for the ASCII-heavy spam keywords we block.
func isLikelySpam(msg *Message) bool {
	if msg == nil {
		return false
	}
	body := strings.ToLower(msg.Text + " " + msg.Caption)
	for _, pat := range spamPatterns {
		if strings.Contains(body, pat) {
			return true
		}
	}
	return false
}

// lengthOfInbound returns the longer of text/caption so single-caption photo spam is also capped.
func lengthOfInbound(msg *Message) int {
	if msg == nil {
		return 0
	}
	t := len([]rune(msg.Text))
	c := len([]rune(msg.Caption))
	if c > t {
		return c
	}
	return t
}

// htmlEscape escapes the four HTML characters Telegram cares about in HTML parse mode.
func htmlEscape(s string) string {
	r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\"", "&quot;")
	return r.Replace(s)
}
