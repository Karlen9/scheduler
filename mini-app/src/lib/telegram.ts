import type { TTelegramWebApp, TThemePreference } from './types';

declare global {
  /***************************************************************************************************
   * Defines the window type used by the shared utility layer.
   ***************************************************************************************************/
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention
  interface Window {
    Telegram?: {
      WebApp: TTelegramWebApp;
    };
  }
}

/***************************************************************************************************
 * Returns telegram web app.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as TTelegramWebApp | null.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function getTelegramWebApp(): TTelegramWebApp | null {
  if (window?.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

/***************************************************************************************************
 * Waits briefly for Telegram WebApp to become available on first load.
 *
 * Parameters:
 * - timeoutMs: Maximum time to wait before giving up.
 *
 * Returns:
 * - A promise that resolves with Telegram WebApp if it appears, otherwise null.
 *
 * Side effects:
 * - May observe browser state while the Telegram script finishes bootstrapping.
 ***************************************************************************************************/
async function waitForTelegramWebApp(timeoutMs = 1500): Promise<TTelegramWebApp | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const webApp = getTelegramWebApp();
  if (webApp) {
    return webApp;
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    const nextWebApp = getTelegramWebApp();
    if (nextWebApp) {
      return nextWebApp;
    }
  }

  return getTelegramWebApp();
}

/***************************************************************************************************
 * Defines the theme storage key value used by the shared utility layer.
 *
 * Usage context:
 * - Reused by the shared utility layer to keep shared values centralized.
 ***************************************************************************************************/
const THEME_STORAGE_KEY = 'theme-preference';

/***************************************************************************************************
 * Returns theme preference.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as TThemePreference.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function getThemePreference(): TThemePreference {
  if (typeof localStorage === 'undefined') {
    return 'auto';
  }
  /***************************************************************************************************
   * Defines the val value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const val = localStorage.getItem(THEME_STORAGE_KEY);
  if (val === 'light' || val === 'dark') {
    return val;
  }
  return 'auto';
}

/***************************************************************************************************
 * Sets theme preference.
 *
 * Parameters:
 * - pref: Pref used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function setThemePreference(pref: TThemePreference): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(THEME_STORAGE_KEY, pref);
}

const darkThemeVars: Record<string, string> = {
  '--tg-theme-bg-color': '#17212b',
  '--tg-theme-text-color': '#ffffff',
  '--tg-theme-hint-color': '#708499',
  '--tg-theme-link-color': '#6ab3f3',
  '--tg-theme-button-color': '#5288c1',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-secondary-bg-color': '#232e3c',
  '--tg-theme-header-bg-color': '#17212b',
  '--tg-theme-section-bg-color': '#232e3c',
  '--tg-theme-subtitle-text-color': '#708499',
  '--tg-theme-destructive-text-color': '#ec3942',
};

const lightThemeVars: Record<string, string> = {
  '--tg-theme-bg-color': '#ffffff',
  '--tg-theme-text-color': '#000000',
  '--tg-theme-hint-color': '#999999',
  '--tg-theme-link-color': '#2678b6',
  '--tg-theme-button-color': '#2678b6',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-secondary-bg-color': '#efeff4',
  '--tg-theme-header-bg-color': '#ffffff',
  '--tg-theme-section-bg-color': '#ffffff',
  '--tg-theme-subtitle-text-color': '#999999',
  '--tg-theme-destructive-text-color': '#e53935',
};

const themePreferenceConfig: Record<
  Exclude<TThemePreference, 'auto'>,
  { isDark: boolean; vars: Record<string, string> }
> = {
  light: {
    isDark: false,
    vars: lightThemeVars,
  },
  dark: {
    isDark: true,
    vars: darkThemeVars,
  },
};

/***************************************************************************************************
 * Sets inline theme vars.
 *
 * Parameters:
 * - vars: Vars used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
function setInlineThemeVars(vars: Record<string, string>): void {
  /***************************************************************************************************
   * Defines the root value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

function setDarkClass(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark);
}

/***************************************************************************************************
 * Returns the current Telegram theme variables mapped to CSS custom properties.
 *
 * Parameters:
 * - webApp: Telegram WebApp instance used by the current operation.
 *
 * Returns the current theme variables as Record<string, string>.
 *
 * Side effects:
 * - None.
 ***************************************************************************************************/
function getTelegramThemeVars(webApp: TTelegramWebApp | null): Record<string, string> {
  const fallbackVars = webApp?.colorScheme === 'dark' ? darkThemeVars : lightThemeVars;

  if (!webApp) {
    return fallbackVars;
  }

  const { themeParams } = webApp;

  return {
    '--tg-theme-bg-color': themeParams.bg_color ?? fallbackVars['--tg-theme-bg-color'],
    '--tg-theme-text-color': themeParams.text_color ?? fallbackVars['--tg-theme-text-color'],
    '--tg-theme-hint-color': themeParams.hint_color ?? fallbackVars['--tg-theme-hint-color'],
    '--tg-theme-link-color': themeParams.link_color ?? fallbackVars['--tg-theme-link-color'],
    '--tg-theme-button-color': themeParams.button_color ?? fallbackVars['--tg-theme-button-color'],
    '--tg-theme-button-text-color':
      themeParams.button_text_color ?? fallbackVars['--tg-theme-button-text-color'],
    '--tg-theme-secondary-bg-color':
      themeParams.secondary_bg_color ?? fallbackVars['--tg-theme-secondary-bg-color'],
    '--tg-theme-header-bg-color':
      themeParams.header_bg_color ?? fallbackVars['--tg-theme-header-bg-color'],
    '--tg-theme-section-bg-color':
      themeParams.section_bg_color ?? fallbackVars['--tg-theme-section-bg-color'],
    '--tg-theme-subtitle-text-color':
      themeParams.subtitle_text_color ?? fallbackVars['--tg-theme-subtitle-text-color'],
    '--tg-theme-destructive-text-color':
      themeParams.destructive_text_color ?? fallbackVars['--tg-theme-destructive-text-color'],
  };
}

let initDataCache: string | null = null;
let initDataPromise: Promise<string> | null = null;
let telegramInitPromise: Promise<void> | null = null;
let telegramInitialized = false;
let themeListenerWebApp: TTelegramWebApp | null = null;

/***************************************************************************************************
 * Implements the apply theme logic used by this module.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function applyTheme(): void {
  if (typeof document === 'undefined') {
    return;
  }

  /***************************************************************************************************
   * Defines the pref value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const pref = getThemePreference();
  const webApp = getTelegramWebApp();
  if (pref !== 'auto') {
    const { isDark, vars } = themePreferenceConfig[pref];
    setInlineThemeVars(vars);
    setDarkClass(isDark);
    return;
  }

  const isDark = webApp ? webApp.colorScheme === 'dark' : false;
  setInlineThemeVars(getTelegramThemeVars(webApp));
  setDarkClass(isDark);
}

/***************************************************************************************************
 * Implements the init telegram app logic used by this module.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function initTelegramApp(): void {
  applyTheme();

  if (telegramInitialized || telegramInitPromise) {
    return;
  }

  telegramInitPromise = (async () => {
    /***************************************************************************************************
     * Wait for Telegram to finish bootstrapping before syncing theme-dependent state.
     ***************************************************************************************************/
    const webApp = await waitForTelegramWebApp();
    if (!webApp) {
      return;
    }

    webApp.ready();
    webApp.disableVerticalSwipes?.();
    webApp.expand();

    if (themeListenerWebApp && themeListenerWebApp !== webApp) {
      themeListenerWebApp.offEvent('themeChanged', applyTheme);
      themeListenerWebApp = null;
    }

    /***************************************************************************************************
     * Listen for theme changes (user switches dark/light mode).
     ***************************************************************************************************/
    if (!themeListenerWebApp) {
      webApp.onEvent('themeChanged', applyTheme);
      themeListenerWebApp = webApp;
    }

    applyTheme();
    telegramInitialized = true;
  })().finally(() => {
    telegramInitPromise = null;
  });
}

/***************************************************************************************************
 * Returns theme params.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as TTelegramWebApp['themeParams'].
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function getThemeParams(): TTelegramWebApp['themeParams'] {
  /***************************************************************************************************
   * Defines the web app value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const webApp = getTelegramWebApp();
  return (
    webApp?.themeParams ?? {
      bg_color: '#ffffff',
      text_color: '#000000',
      hint_color: '#999999',
      link_color: '#2678b6',
      button_color: '#2678b6',
      button_text_color: '#ffffff',
      secondary_bg_color: '#f0f0f0',
    }
  );
}

/***************************************************************************************************
 * Returns user name.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function getUserName(): string {
  /***************************************************************************************************
   * Defines the web app value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const webApp = getTelegramWebApp();
  /***************************************************************************************************
   * Defines the user value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const user = webApp?.initDataUnsafe?.user;
  if (user) {
    return user.first_name + (user.last_name ? ` ${user.last_name}` : '');
  }
  return 'Гость';
}

/***************************************************************************************************
 * Returns telegram user photo url.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May read browser state.
 ***************************************************************************************************/
export function getTelegramUserPhotoUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url ?? '';
}

/***************************************************************************************************
 * Returns init data.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function getInitData(): string {
  /***************************************************************************************************
   * Defines the web app value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const webApp = getTelegramWebApp();
  return webApp?.initData ?? '';
}

/***************************************************************************************************
 * Waits briefly for Telegram WebApp initData to become available on first load.
 *
 * Parameters:
 * - timeoutMs: Maximum time to wait before giving up.
 *
 * Returns:
 * - A promise that resolves with initData if it appears, otherwise an empty string.
 *
 * Side effects:
 * - May observe browser state while the Telegram script finishes bootstrapping.
 ***************************************************************************************************/
export async function waitForInitData(timeoutMs = 1500): Promise<string> {
  if (typeof window === 'undefined') {
    return '';
  }

  if (initDataCache) {
    return initDataCache;
  }

  const initData = getInitData();
  if (initData) {
    initDataCache = initData;
    return initData;
  }

  if (initDataPromise) {
    return initDataPromise;
  }

  initDataPromise = (async () => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      const nextInitData = getInitData();
      if (nextInitData) {
        initDataCache = nextInitData;
        return nextInitData;
      }
    }

    const resolvedInitData = getInitData();
    if (resolvedInitData) {
      initDataCache = resolvedInitData;
    }
    return resolvedInitData;
  })().finally(() => {
    initDataPromise = null;
  });

  return initDataPromise;
}

/***************************************************************************************************
 * Returns specialist id.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as string | null.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function getSpecialistId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  /***************************************************************************************************
   * Defines the params value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const params = new URLSearchParams(window.location.search);
  /***************************************************************************************************
   * Support both new (?specialist=) and legacy (?trainer=) URL params Telegram caches menu button
   * URLs, so old ?trainer= links persist until /start.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const fromURL = params.get('specialist') || params.get('trainer');
  if (fromURL) {
    sessionStorage.setItem('specialistId', fromURL);
    return fromURL;
  }
  return sessionStorage.getItem('specialistId');
}

/***************************************************************************************************
 * Opens a Telegram chat with a user. Prefers `https://t.me/<username>` (mirrors the client-side
 * handleMessage pattern and avoids the `tg://` scheme confirmation prompt that most browsers
 * show). Returns true when the chat could be opened, false when no username is available and the
 * caller should surface a fallback (e.g. toast).
 ***************************************************************************************************/
export function openTelegramUserChat(username: string | undefined | null): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  if (!username) {
    return false;
  }
  const handle = username.replace(/^@/, '');
  if (!handle) {
    return false;
  }
  window.open(`https://t.me/${handle}`, '_blank');
  return true;
}
