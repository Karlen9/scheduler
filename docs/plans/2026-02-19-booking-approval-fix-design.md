# Booking Approval Logic Fix + Client Telegram Buttons

## Problem

1. **Admin can approve their own bookings** — `HandleAdminUpdateBookingStatus` doesn't check `created_by`, so when a specialist creates a booking, they can confirm it themselves via admin panel.
2. **No client Telegram buttons** — When specialist creates a booking, the client gets a text-only notification. They must open the mini-app to respond.

## Design

### Fix 1: Guard admin approval by `created_by`

In `HandleAdminUpdateBookingStatus` (`bot/internal/api/admin_handlers.go`):

- If `booking.CreatedBy == "specialist"` AND requested status is `confirmed` → return 403. Only the client can confirm specialist-created bookings.
- Specialist can always cancel/reject regardless of `created_by` (withdrawing your own offer is valid).
- Client-created bookings (`created_by` is empty/client) → specialist can confirm/reject as before.

### Fix 2: Client inline buttons in Telegram

Mirror the specialist callback flow:

- `NotifyClientSpecialistBooking()` sends message with **Accept / Decline** inline buttons.
- Callback data format: `client_accept:{bookingID}` / `client_decline:{bookingID}`.
- New handler in `handleCallbackQuery()` for these prefixes:
  - Validate client owns the booking.
  - Validate `booking.CreatedBy == "specialist"` and `status == "pending"`.
  - Call existing confirm/decline DB logic.
  - Edit the message to remove buttons and show result.
  - Notify specialist of the response.
- Save client notification message ID for later editing (add `client_notification_chat_id` and `client_notification_msg_id` columns on bookings, or reuse existing columns with a new purpose — need to check current usage).

### Fix 3: Admin panel UI

- Hide confirm/accept button when `booking.createdBy === 'specialist'`.
- Show "Waiting for client" status indicator instead.
- Keep cancel/reject visible.

### Fix 4: Keep mini-app client buttons

- Existing approve/decline buttons in client bookings page remain unchanged.
- Both Telegram inline buttons and mini-app buttons work. First one wins (status check prevents double action).

## Scope

- Backend: `admin_handlers.go`, `handlers.go` (callback handler), `messages.go` (message templates), `bookings.go` (notification columns if needed)
- Frontend: `mini-app/src/app/admin/page.tsx` (admin booking cards)
- Telegram bot: `handlers.go` (new client callback handling, updated notification sending)
