import type { TVoidFunction } from './shared';

export type TTelegramWebApp = {
  ready: TVoidFunction;
  expand: TVoidFunction;
  close: TVoidFunction;
  disableVerticalSwipes?: TVoidFunction;
  enableVerticalSwipes?: TVoidFunction;
  isVerticalSwipesEnabled?: boolean;
  colorScheme: 'light' | 'dark';
  MainButton: {
    text: string;
    show: TVoidFunction;
    hide: TVoidFunction;
    onClick: (callback: TVoidFunction) => void;
    offClick: (callback: TVoidFunction) => void;
    enable: TVoidFunction;
    disable: TVoidFunction;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: TVoidFunction;
  };
  BackButton: {
    show: TVoidFunction;
    hide: TVoidFunction;
    onClick: (callback: TVoidFunction) => void;
    offClick: (callback: TVoidFunction) => void;
  };
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
    header_bg_color?: string;
    section_bg_color?: string;
    subtitle_text_color?: string;
    destructive_text_color?: string;
  };
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
  };
  onEvent: (event: string, callback: TVoidFunction) => void;
  offEvent: (event: string, callback: TVoidFunction) => void;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged?: TVoidFunction;
  };
};

export type TThemePreference = 'auto' | 'light' | 'dark';
