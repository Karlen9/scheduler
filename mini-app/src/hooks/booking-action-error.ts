import { toast } from 'sonner';

import { invalidateBookings } from '@/hooks/mutations';
import { isStaleStateError } from '@/lib/api-error';

/***************************************************************************************************
 * Reports a failed booking action (confirm / reject / decline / cancel).
 *
 * Always refreshes the bookings caches so the UI converges on the server state. When the failure
 * looks like "the booking was already processed elsewhere" (for example it was accepted from the
 * Telegram bot a moment ago) a dedicated toast is shown instead of the generic failure message.
 *
 * Parameters:
 * - err: The thrown value from the API call.
 * - messages.fallback: Generic failure text.
 * - messages.stale: Text for "already processed / changed" failures.
 * - options.includeBadRequest: Treat HTTP 400 as a state error too.
 ***************************************************************************************************/
export async function reportBookingActionFailure(
  err: unknown,
  messages: { fallback: string; stale: string },
  options?: { includeBadRequest?: boolean },
): Promise<void> {
  toast.error(isStaleStateError(err, options) ? messages.stale : messages.fallback);
  await invalidateBookings();
}
