export const THEME_STORAGE_KEY = 'theme-preference';

export type TThemePreference = 'light' | 'dark';

export const THEME_COLORS: Record<TThemePreference, string> = {
  light: '#efeff4',
  dark: '#15202b',
};

export function readThemePreference(): TThemePreference | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function writeThemePreference(value: TThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Storage can be blocked (private mode); the toggle still works for this visit.
  }
}

// Runs blocking in <head> before first paint. Mirrors readThemePreference and also follows the
// OS scheme live while the visitor has not picked a theme. It marks the hero as pending while
// motion is allowed; PageMotion (or the 2.5s timer) clears it so the page can never stay hidden.
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;var k='${THEME_STORAGE_KEY}';function get(){try{var v=localStorage.getItem(k);return v==='light'||v==='dark'?v:null}catch(e){return null}}var m=window.matchMedia('(prefers-color-scheme: dark)');function apply(){var p=get();var dark=p?p==='dark':m.matches;d.classList.toggle('dark',dark)}apply();var on=function(){if(!get())apply()};if(m.addEventListener){m.addEventListener('change',on)}else if(m.addListener){m.addListener(on)}try{if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('hero-pending');setTimeout(function(){d.classList.remove('hero-pending')},2500)}}catch(e){}})();`;
