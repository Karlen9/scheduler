export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  colorScheme: "light" | "dark";
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
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export function applyTheme() {
  if (typeof document === "undefined") return;

  const webApp = getTelegramWebApp();
  const isDark = webApp ? webApp.colorScheme === "dark" : false;

  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function initTelegramApp() {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.ready();
    webApp.expand();

    // Listen for theme changes (user switches dark/light mode)
    webApp.onEvent("themeChanged", applyTheme);
  }
  applyTheme();
}

export function getThemeParams() {
  const webApp = getTelegramWebApp();
  return (
    webApp?.themeParams ?? {
      bg_color: "#ffffff",
      text_color: "#000000",
      hint_color: "#999999",
      link_color: "#2678b6",
      button_color: "#2678b6",
      button_text_color: "#ffffff",
      secondary_bg_color: "#f0f0f0",
    }
  );
}

export function getUserName(): string {
  const webApp = getTelegramWebApp();
  const user = webApp?.initDataUnsafe?.user;
  if (user) {
    return user.first_name + (user.last_name ? ` ${user.last_name}` : "");
  }
  return "Гость";
}

export function getInitData(): string {
  const webApp = getTelegramWebApp();
  return webApp?.initData ?? "";
}

export function getTrainerId(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const fromURL = params.get("trainer");
  if (fromURL) {
    sessionStorage.setItem("trainerId", fromURL);
    return fromURL;
  }
  return sessionStorage.getItem("trainerId");
}
