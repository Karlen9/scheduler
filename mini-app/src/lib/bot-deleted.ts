/***************************************************************************************************
 * Global latch for 410 Gone responses from the backend. Once the specialist soft-deletes their bot,
 * any authenticated request returns 410 — we trip this latch and render a terminal overlay so the
 * Mini App is unusable from that point on, even if old Telegram "Open" buttons keep launching it.
 ***************************************************************************************************/

let botDeleted = false;
const EVENT_NAME = 'scheduler:bot-deleted';

export function markBotDeleted(): void {
  if (botDeleted) {
    return;
  }
  botDeleted = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

export function isBotDeleted(): boolean {
  return botDeleted;
}

export function subscribeBotDeleted(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
