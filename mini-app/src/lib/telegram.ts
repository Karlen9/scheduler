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

/***************************************************************************************************
 * Telegram CSS variable names that the SDK sets as inline styles on <html>.
 *
 * Usage context:
 * - Reused by the shared utility layer to keep shared values centralized.
 ***************************************************************************************************/
const tgVarNames = [
  '--tg-theme-bg-color',
  '--tg-theme-text-color',
  '--tg-theme-hint-color',
  '--tg-theme-link-color',
  '--tg-theme-button-color',
  '--tg-theme-button-text-color',
  '--tg-theme-secondary-bg-color',
  '--tg-theme-header-bg-color',
  '--tg-theme-section-bg-color',
  '--tg-theme-subtitle-text-color',
  '--tg-theme-destructive-text-color',
] as const;

const darkThemeVars: Record<string, string> = {
  '--tg-theme-bg-color': '#1e1e1e',
  '--tg-theme-text-color': '#ffffff',
  '--tg-theme-hint-color': '#999999',
  '--tg-theme-link-color': '#6ab2f2',
  '--tg-theme-button-color': '#5288c1',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-secondary-bg-color': '#2a2a2a',
  '--tg-theme-header-bg-color': '#1e1e1e',
  '--tg-theme-section-bg-color': '#1e1e1e',
  '--tg-theme-subtitle-text-color': '#999999',
  '--tg-theme-destructive-text-color': '#e53935',
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

let savedTgVars: Record<string, string> | null = null;

/***************************************************************************************************
 * Implements the save telegram vars logic used by this module.
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
function saveTelegramVars(): void {
  if (savedTgVars) {
    return;
  }
  /***************************************************************************************************
   * Defines the root value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const root = document.documentElement;
  savedTgVars = {};
  for (const name of tgVarNames) {
    /***************************************************************************************************
     * Defines the val value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
    const val = root.style.getPropertyValue(name);
    if (val) {
      savedTgVars[name] = val;
    }
  }
}

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

/***************************************************************************************************
 * Implements the restore telegram vars logic used by this module.
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
function restoreTelegramVars(): void {
  if (!savedTgVars) {
    return;
  }
  /***************************************************************************************************
   * Defines the root value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const root = document.documentElement;
  for (const name of tgVarNames) {
    if (savedTgVars[name]) {
      root.style.setProperty(name, savedTgVars[name]);
    } else {
      root.style.removeProperty(name);
    }
  }
}

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

  saveTelegramVars();

  /***************************************************************************************************
   * Defines the pref value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const pref = getThemePreference();
  let isDark: boolean;

  if (pref === 'light') {
    isDark = false;
    setInlineThemeVars(lightThemeVars);
  } else if (pref === 'dark') {
    isDark = true;
    setInlineThemeVars(darkThemeVars);
  } else {
    restoreTelegramVars();
    /***************************************************************************************************
     * Defines the web app value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
    const webApp = getTelegramWebApp();
    isDark = webApp ? webApp.colorScheme === 'dark' : false;
  }

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
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
  /***************************************************************************************************
   * Defines the web app value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.ready();
    webApp.expand();

    /***************************************************************************************************
     * Listen for theme changes (user switches dark/light mode).
     ***************************************************************************************************/
    webApp.onEvent('themeChanged', applyTheme);
  }
  applyTheme();
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
