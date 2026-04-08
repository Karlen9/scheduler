# Booking Approval Logic Fix + Client Telegram Buttons — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the logical bug where a specialist can approve their own bookings, and add inline Accept/Decline Telegram buttons for clients when specialist creates a booking.

**Architecture:** Add a `created_by` guard in the admin status-update handler. Add new DB columns to track client notification messages. Extend the Telegram callback handler to process client accept/decline callbacks. Update the admin UI to hide the approve button for specialist-created bookings.

**Tech Stack:** Go (chi router, Telegram Bot API), Next.js/React, SQLite/PostgreSQL, go-i18n

---

### Task 1: Add `created_by` guard in admin booking status update

**Files:**

- Modify: `bot/internal/api/admin_handlers.go:486-567`

**Step 1: Add the guard after status validation**

In `HandleAdminUpdateBookingStatus`, after line 522 (status validation), add a check: if the booking was created by the specialist and the requested status is `confirmed`, reject the request. The specialist cannot confirm their own booking — only the client can.

```go
// After line 522 (the validStatuses check):

// Specialist cannot confirm their own bookings — only the client can
if booking.CreatedBy == "specialist" && req.Status == "confirmed" {
    httpError(w, r, "Error.CannotConfirmOwnBooking", http.StatusForbidden)
    return
}
```

**Step 2: Add i18n error key**

In `bot/internal/i18n/locales/active.en.json`, add:

```json
"Error.CannotConfirmOwnBooking": {
    "other": "Cannot confirm your own booking"
}
```

In `bot/internal/i18n/locales/active.ru.json`, add:

```json
"Error.CannotConfirmOwnBooking": {
    "other": "Нельзя подтвердить свою же запись"
}
```

**Step 3: Verify compilation**

Run: `cd bot && go build ./...`
Expected: Success

**Step 4: Commit**

```bash
git add bot/internal/api/admin_handlers.go bot/internal/i18n/locales/active.en.json bot/internal/i18n/locales/active.ru.json
git commit -m "fix: prevent specialist from confirming their own bookings"
```

---

### Task 2: Add DB columns for client notification message tracking

**Files:**

- Modify: `bot/internal/db/db.go` (migration)
- Modify: `bot/internal/db/bookings.go` (save/get functions)

**Step 1: Add migration for new columns**

In `db.go`, add these to the migrations slice (same pattern as existing ones):

```go
{`ALTER TABLE bookings ADD COLUMN client_notification_chat_id INTEGER`},
{`ALTER TABLE bookings ADD COLUMN client_notification_msg_id INTEGER`},
```

**Step 2: Add SaveClientNotificationInfo function in bookings.go**

```go
// SaveClientNotificationInfo stores the Telegram message ID for the client notification
func SaveClientNotificationInfo(bookingID string, chatID int64, messageID int) error {
	_, err := DB.Exec(Q(`UPDATE bookings SET client_notification_chat_id = ?, client_notification_msg_id = ? WHERE id = ?`),
		chatID, messageID, bookingID)
	return err
}

// GetClientNotificationInfo returns the stored client Telegram notification message info
func GetClientNotificationInfo(bookingID string) (chatID int64, messageID int, err error) {
	var chatIDNull, msgIDNull sql.NullInt64
	err = DB.QueryRow(Q(`SELECT client_notification_chat_id, client_notification_msg_id FROM bookings WHERE id = ?`),
		bookingID).Scan(&chatIDNull, &msgIDNull)
	if err != nil {
		return 0, 0, err
	}
	if chatIDNull.Valid {
		chatID = chatIDNull.Int64
	}
	if msgIDNull.Valid {
		messageID = int(msgIDNull.Int64)
	}
	return
}
```

**Step 3: Verify compilation**

Run: `cd bot && go build ./...`
Expected: Success

**Step 4: Commit**

```bash
git add bot/internal/db/db.go bot/internal/db/bookings.go
git commit -m "feat: add DB columns for client notification message tracking"
```

---

### Task 3: Add i18n keys for client Accept/Decline buttons

**Files:**

- Modify: `bot/internal/i18n/locales/active.en.json`
- Modify: `bot/internal/i18n/locales/active.ru.json`
- Modify: `bot/internal/telegram/messages.go`

**Step 1: Add i18n keys**

In `active.en.json`, add these keys (near the existing Btn/Callback keys):

```json
"Btn.Accept": {
    "other": "✅ Accept"
},
"Btn.Decline": {
    "other": "❌ Decline"
},
"Callback.ClientConfirmed": {
    "other": "✅ Booking accepted"
},
"Callback.ClientDeclined": {
    "other": "❌ Booking declined"
},
"Booking.SpecialistCreatedClientAccepted": {
    "other": "✅ You accepted the booking\n\n📋 {{.Service}}\n🕐 {{.DateTime}}"
},
"Booking.SpecialistCreatedClientDeclined": {
    "other": "❌ You declined the booking\n\n📋 {{.Service}}\n🕐 {{.DateTime}}"
}
```

In `active.ru.json`, add:

```json
"Btn.Accept": {
    "other": "✅ Принять"
},
"Btn.Decline": {
    "other": "❌ Отклонить"
},
"Callback.ClientConfirmed": {
    "other": "✅ Запись принята"
},
"Callback.ClientDeclined": {
    "other": "❌ Запись отклонена"
},
"Booking.SpecialistCreatedClientAccepted": {
    "other": "✅ Вы приняли запись\n\n📋 {{.Service}}\n🕐 {{.DateTime}}"
},
"Booking.SpecialistCreatedClientDeclined": {
    "other": "❌ Вы отклонили запись\n\n📋 {{.Service}}\n🕐 {{.DateTime}}"
}
```

**Step 2: Add button helper functions in messages.go**

After `BtnReject` (line 90), add:

```go
// BtnAccept returns the localized accept button text (for clients)
func BtnAccept(loc *i18n.Localizer) string { return myI18n.T(loc, "Btn.Accept") }

// BtnDecline returns the localized decline button text (for clients)
func BtnDecline(loc *i18n.Localizer) string { return myI18n.T(loc, "Btn.Decline") }
```

**Step 3: Add message format functions for edited client messages**

After `FormatSpecialistCreatedBookingClient` in messages.go, add:

```go
// FormatSpecialistCreatedBookingClientAccepted creates the edited message after client accepts
func FormatSpecialistCreatedBookingClientAccepted(loc *i18n.Localizer, booking *models.Booking) string {
	return myI18n.Tf(loc, "Booking.SpecialistCreatedClientAccepted", map[string]interface{}{
		"Service":  bookingServiceDisplay(loc, booking),
		"DateTime": formatDateTime(loc, booking.StartsAt),
	})
}

// FormatSpecialistCreatedBookingClientDeclined creates the edited message after client declines
func FormatSpecialistCreatedBookingClientDeclined(loc *i18n.Localizer, booking *models.Booking) string {
	return myI18n.Tf(loc, "Booking.SpecialistCreatedClientDeclined", map[string]interface{}{
		"Service":  bookingServiceDisplay(loc, booking),
		"DateTime": formatDateTime(loc, booking.StartsAt),
	})
}
```

**Step 4: Update FormatSpecialistCreatedBookingClient to remove the "Hint.OpenApp" suffix**

The hint "Open the app to confirm or decline" is no longer needed since buttons are inline. Remove the `Hint.OpenApp` line from `FormatSpecialistCreatedBookingClient`:

```go
func FormatSpecialistCreatedBookingClient(loc *i18n.Localizer, booking *models.Booking) string {
	data := map[string]interface{}{
		"Service":  bookingServiceDisplay(loc, booking),
		"DateTime": formatDateTime(loc, booking.StartsAt),
	}
	msg := myI18n.Tf(loc, "Booking.SpecialistCreatedClient", data)
	if booking.ClientMessage != "" {
		msg += myI18n.Tf(loc, "Booking.ClientMessage", map[string]interface{}{"Message": booking.ClientMessage})
	}
	return msg
}
```

**Step 5: Verify compilation**

Run: `cd bot && go build ./...`
Expected: Success

**Step 6: Commit**

```bash
git add bot/internal/i18n/locales/active.en.json bot/internal/i18n/locales/active.ru.json bot/internal/telegram/messages.go
git commit -m "feat: add i18n keys and message helpers for client inline buttons"
```

---

### Task 4: Send client notification with inline buttons + save message ID

**Files:**

- Modify: `bot/internal/telegram/handlers.go:442-453` (`NotifyClientSpecialistBooking`)

**Step 1: Update NotifyClientSpecialistBooking to send inline buttons and save message ID**

Replace the current `NotifyClientSpecialistBooking` function:

```go
// NotifyClientSpecialistBooking sends a specialist-created booking confirmation request to client
func (h *Handler) NotifyClientSpecialistBooking(booking *models.Booking) error {
	client, err := db.GetClientByID(booking.ClientID)
	if err != nil || client == nil {
		return fmt.Errorf("error getting client: %v", err)
	}

	loc := myI18n.NewLocalizer(client.Language)
	text := FormatSpecialistCreatedBookingClient(loc, booking)
	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: BtnAccept(loc), CallbackData: "client_accept:" + booking.ID},
				{Text: BtnDecline(loc), CallbackData: "client_decline:" + booking.ID},
			},
		},
	}
	msg, err := h.Bot.SendMessage(client.TelegramUserID, text, keyboard)
	if err != nil {
		return err
	}

	// Save message info so we can edit it later (remove buttons)
	if msg != nil {
		db.SaveClientNotificationInfo(booking.ID, client.TelegramUserID, msg.MessageID)
	}
	return nil
}
```

**Step 2: Verify compilation**

Run: `cd bot && go build ./...`
Expected: Success

**Step 3: Commit**

```bash
git add bot/internal/telegram/handlers.go
git commit -m "feat: send client notification with inline Accept/Decline buttons"
```

---

### Task 5: Handle client Accept/Decline callbacks in Telegram

**Files:**

- Modify: `bot/internal/telegram/handlers.go:188-263` (`handleCallbackQuery`)

**Step 1: Add client callback handling**

In `handleCallbackQuery`, after the `lang:` prefix check (line 196) and before the existing `SplitN` (line 198), add a new prefix check for client callbacks:

```go
// Handle client accept/decline callback
if strings.HasPrefix(data, "client_accept:") || strings.HasPrefix(data, "client_decline:") {
    h.handleClientBookingCallback(update)
    return
}
```

**Step 2: Add the client callback handler method**

Add a new method to handlers.go:

```go
func (h *Handler) handleClientBookingCallback(update Update) {
	cq := update.CallbackQuery
	data := cq.Data

	parts := strings.SplitN(data, ":", 2)
	if len(parts) != 2 {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}

	action, bookingID := parts[0], parts[1]

	// Get specialist to identify which bot this is
	specialist, _ := db.GetSpecialistByBotToken(h.Bot.Token)
	if specialist == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}

	// Get client by telegram user ID
	client, _ := db.GetClientByTelegramID(cq.From.ID, specialist.ID)
	if client == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}

	loc := myI18n.NewLocalizer(client.Language)

	booking, err := db.GetBookingByID(bookingID)
	if err != nil || booking == nil {
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.NotFound"))
		return
	}

	// Validate: client owns booking, booking is pending, and was created by specialist
	if booking.ClientID != client.ID {
		h.Bot.AnswerCallbackQuery(cq.ID, "")
		return
	}
	if booking.Status != models.BookingStatusPending || booking.CreatedBy != "specialist" {
		h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.AlreadyProcessed"))
		if cq.Message != nil {
			h.updateClientNotificationMessage(loc, cq.Message.Chat.ID, cq.Message.MessageID, booking)
		}
		return
	}

	accepted := action == "client_accept"
	var toastText string

	if accepted {
		if err := db.UpdateBookingStatus(bookingID, models.BookingStatusConfirmed); err != nil {
			log.Printf("Error confirming booking via client callback: %v", err)
			h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.Error"))
			return
		}
		toastText = myI18n.T(loc, "Callback.ClientConfirmed")
	} else {
		if err := db.CancelBooking(bookingID, "", models.CancelledByClient); err != nil {
			log.Printf("Error declining booking via client callback: %v", err)
			h.Bot.AnswerCallbackQuery(cq.ID, myI18n.T(loc, "Callback.Error"))
			return
		}
		toastText = myI18n.T(loc, "Callback.ClientDeclined")
	}

	h.Bot.AnswerCallbackQuery(cq.ID, toastText)

	// Refresh booking
	booking, _ = db.GetBookingByID(bookingID)
	if booking == nil {
		return
	}

	// Edit client's message to remove buttons and show result
	if cq.Message != nil {
		h.updateClientNotificationMessage(loc, cq.Message.Chat.ID, cq.Message.MessageID, booking)
	}

	// Notify specialist about client's response
	h.notifySpecialistClientResponse(booking, accepted)
}

// updateClientNotificationMessage edits the client's booking notification to reflect the new status
func (h *Handler) updateClientNotificationMessage(loc *i18n.Localizer, chatID int64, messageID int, booking *models.Booking) error {
	var text string
	switch booking.Status {
	case models.BookingStatusConfirmed:
		text = FormatSpecialistCreatedBookingClientAccepted(loc, booking)
	case models.BookingStatusCancelled, models.BookingStatusRejected:
		text = FormatSpecialistCreatedBookingClientDeclined(loc, booking)
	default:
		text = FormatSpecialistCreatedBookingClient(loc, booking)
	}
	return h.Bot.EditMessageText(chatID, messageID, text, nil)
}
```

**Step 3: Verify compilation**

Run: `cd bot && go build ./...`
Expected: Success

**Step 4: Run tests**

Run: `cd bot && go test ./...`
Expected: All pass

**Step 5: Commit**

```bash
git add bot/internal/telegram/handlers.go
git commit -m "feat: handle client Accept/Decline callbacks via Telegram inline buttons"
```

---

### Task 6: Update client notification message when client responds via mini-app

**Files:**

- Modify: `bot/internal/api/handlers.go:682-779`
- Modify: `bot/internal/api/admin_handlers.go` (callback variable)
- Modify: `bot/main.go` (wire up callback)

**Step 1: Add UpdateClientMessageFunc callback variable**

In `bot/internal/api/handlers.go`, near the other callback vars (around line 33), add:

```go
// UpdateClientMessageFunc is a callback to edit the client's Telegram notification message
var UpdateClientMessageFunc func(booking *models.Booking) error
```

**Step 2: Call UpdateClientMessageFunc in HandleClientConfirmBooking**

In `HandleClientConfirmBooking` (handlers.go:682-729), after the `NotifyClientBookingResponseFunc` call (line 726), add:

```go
// Update client's Telegram notification message (remove buttons)
if UpdateClientMessageFunc != nil {
    if err := UpdateClientMessageFunc(booking); err != nil {
        log.Printf("Error updating client message: %v", err)
    }
}
```

**Step 3: Call UpdateClientMessageFunc in HandleClientDeclineBooking**

In `HandleClientDeclineBooking` (handlers.go:732-779), after the `NotifyClientBookingResponseFunc` call (line 776), add the same block:

```go
// Update client's Telegram notification message (remove buttons)
if UpdateClientMessageFunc != nil {
    if err := UpdateClientMessageFunc(booking); err != nil {
        log.Printf("Error updating client message: %v", err)
    }
}
```

**Step 4: Wire up the callback in main.go**

In `main.go`, after the `NotifyClientBookingResponseFunc` setup (around line 295), add:

```go
// Set up callback to edit client's Telegram notification message
api.UpdateClientMessageFunc = func(booking *models.Booking) error {
    chatID, messageID, err := db.GetClientNotificationInfo(booking.ID)
    if err != nil || chatID == 0 || messageID == 0 {
        return nil // No saved message to edit
    }
    specialist, err := db.GetSpecialistByID(booking.SpecialistID)
    if err != nil || specialist == nil {
        return nil
    }
    handler := botManager.GetHandler(specialist.WebhookSecret)
    if handler == nil {
        return nil
    }
    client, err := db.GetClientByID(booking.ClientID)
    if err != nil || client == nil {
        return nil
    }
    loc := myI18n.NewLocalizer(client.Language)
    return handler.updateClientNotificationMessage(loc, chatID, messageID, booking)
}
```

Note: `updateClientNotificationMessage` is lowercase (unexported method on Handler). We need to make it exported or add a wrapper. Let's make it exported:

Rename `updateClientNotificationMessage` → `UpdateClientNotificationMessage` in handlers.go (both the definition and the call in `handleClientBookingCallback`).

**Step 5: Also update UpdateClientMessageFunc in testhelper_test.go**

In `bot/internal/api/testhelper_test.go`, add near line 63:

```go
api.UpdateClientMessageFunc = func(booking *models.Booking) error { return nil }
```

**Step 6: Verify compilation**

Run: `cd bot && go build ./...`
Expected: Success

**Step 7: Run tests**

Run: `cd bot && go test ./...`
Expected: All pass

**Step 8: Commit**

```bash
git add bot/internal/api/handlers.go bot/internal/api/testhelper_test.go bot/main.go bot/internal/telegram/handlers.go
git commit -m "feat: edit client's Telegram message when they respond via mini-app"
```

---

### Task 7: Hide approve button in admin panel for specialist-created bookings

**Files:**

- Modify: `mini-app/src/app/admin/page.tsx`

**Step 1: Update the pending bookings filter**

Currently at line 66-72, `pendingBookings` filters out specialist-created bookings:

```ts
const pendingBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'pending' && b.createdBy !== 'specialist')
        ...
```

This is actually already correct — the pending requests sheet only shows client-created bookings. But we also need to handle the case where specialist-created pending bookings appear in the schedule view. Check whether `ScheduleView` or `BookingCard` shows accept/reject for specialist-created pending bookings.

Look at the `PendingBookingCard` component and the booking detail sheet (`selectedBooking`) to see if they need guarding.

**Step 2: Guard the booking detail sheet actions**

In the admin page, when `selectedBooking` is set and the bottom sheet opens, the Accept/Cancel/Reject buttons appear. Find the condition that shows Accept and add a `createdBy` check.

In the bottom sheet for `selectedBooking`, around the Accept button rendering:

- If `selectedBooking.createdBy === 'specialist'` and status is `pending`, show "Waiting for client" text instead of Accept button.
- Keep Cancel button visible (specialist can withdraw their offer).

The exact code depends on how the bottom sheet renders actions. Look for the section that renders `handleAccept` and wrap it:

```tsx
{
  selectedBooking.status === "pending" &&
  selectedBooking.createdBy === "specialist" ? (
    <div className="text-secondary text-center text-sm py-2">
      {t("waitingForClient")}
    </div>
  ) : selectedBooking.status === "pending" ? (
    <button onClick={() => handleAccept(selectedBooking)} className="...">
      {t("accept")}
    </button>
  ) : null;
}
```

**Step 3: Add i18n key for "waitingForClient"**

In `mini-app/src/messages/ru.json` admin section:

```json
"waitingForClient": "Ожидание ответа клиента"
```

In `mini-app/src/messages/en.json` admin section:

```json
"waitingForClient": "Waiting for client response"
```

**Step 4: Verify build**

Run: `cd mini-app && bun build`
Expected: Success

**Step 5: Commit**

```bash
git add mini-app/src/app/admin/page.tsx mini-app/src/messages/ru.json mini-app/src/messages/en.json
git commit -m "fix: hide approve button for specialist-created bookings in admin panel"
```

---

### Task 8: Final verification and integration test

**Step 1: Run all backend tests**

Run: `cd bot && go test ./...`
Expected: All pass

**Step 2: Run frontend build and lint**

Run: `cd mini-app && bun build && bun lint`
Expected: Success

**Step 3: Run frontend tests**

Run: `cd mini-app && bunx vitest run`
Expected: All pass

**Step 4: Final commit (if any remaining changes)**

Only if needed — all changes should be committed in previous tasks.
