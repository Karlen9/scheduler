import { test as base, expect } from '@playwright/test';

/**
 * Minimal window.Telegram.WebApp stub injected before app code runs.
 * This makes waitForTelegramWebApp() resolve immediately and keeps
 * theme / user deterministic across all e2e tests.
 *
 * The script is inlined (not passed as a serialized argument) so that
 * function values are preserved — addInitScript serializes its second
 * argument as JSON, which strips functions.
 *
 * Required stubs beyond the obvious ones:
 * - BackButton.{show,hide,onClick,offClick} — used by TelegramBackButtonProvider
 * - openTelegramLink — used by share handler on home page
 */
export const test = base.extend<{ page: typeof base.prototype }>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const noop = (): void => {};
      (window as unknown as Record<string, unknown>).Telegram = {
        WebApp: {
          initData: '',
          initDataUnsafe: {
            user: { id: 999, first_name: 'Test', last_name: 'Client' },
          },
          colorScheme: 'light',
          themeParams: {
            bg_color: '#ffffff',
            text_color: '#000000',
            hint_color: '#999999',
            link_color: '#2678b6',
            button_color: '#2678b6',
            button_text_color: '#ffffff',
            secondary_bg_color: '#efeff4',
          },
          ready: noop,
          expand: noop,
          disableVerticalSwipes: noop,
          onEvent: noop,
          offEvent: noop,
          close: noop,
          openTelegramLink: noop,
          BackButton: {
            show: noop,
            hide: noop,
            onClick: noop,
            offClick: noop,
          },
          HapticFeedback: {
            impactOccurred: noop,
            notificationOccurred: noop,
            selectionChanged: noop,
          },
        },
      };
    });
    await use(page);
  },
});

export { expect };
