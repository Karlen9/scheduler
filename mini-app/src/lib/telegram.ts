export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  colorScheme: 'light' | 'dark';
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
  };
  onEvent: (event: string, callback: () => void) => void;
  offEvent: (event: string, callback: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export type ThemePreference = 'auto' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme-preference';

export function getThemePreference(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'auto';
  const val = localStorage.getItem(THEME_STORAGE_KEY);
  if (val === 'light' || val === 'dark') return val;
  return 'auto';
}

export function setThemePreference(pref: ThemePreference) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, pref);
}

// Telegram CSS variable names that the SDK sets as inline styles on <html>
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

function saveTelegramVars() {
  if (savedTgVars) return;
  const root = document.documentElement;
  savedTgVars = {};
  for (const name of tgVarNames) {
    const val = root.style.getPropertyValue(name);
    if (val) savedTgVars[name] = val;
  }
}

function setInlineThemeVars(vars: Record<string, string>) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

function restoreTelegramVars() {
  if (!savedTgVars) return;
  const root = document.documentElement;
  for (const name of tgVarNames) {
    if (savedTgVars[name]) {
      root.style.setProperty(name, savedTgVars[name]);
    } else {
      root.style.removeProperty(name);
    }
  }
}

export function applyTheme() {
  if (typeof document === 'undefined') return;

  saveTelegramVars();

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
    const webApp = getTelegramWebApp();
    isDark = webApp ? webApp.colorScheme === 'dark' : false;
  }

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function initTelegramApp() {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.ready();
    webApp.expand();

    // Listen for theme changes (user switches dark/light mode)
    webApp.onEvent('themeChanged', applyTheme);
  }
  applyTheme();
}

export function getThemeParams() {
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

export function getUserName(): string {
  const webApp = getTelegramWebApp();
  const user = webApp?.initDataUnsafe?.user;
  if (user) {
    return user.first_name + (user.last_name ? ` ${user.last_name}` : '');
  }
  return 'Гость';
}

export function getInitData(): string {
  const webApp = getTelegramWebApp();
  return webApp?.initData ?? '';
}

export function getTrainerId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const fromURL = params.get('trainer');
  if (fromURL) {
    sessionStorage.setItem('trainerId', fromURL);
    return fromURL;
  }
  return sessionStorage.getItem('trainerId');
}
