export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = '20be-theme';
export const DEFAULT_THEME: Theme = 'dark';

/**
 * Inline script for <head>: applies the saved theme before the first paint,
 * so a light-theme user never sees a dark flash on load.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : DEFAULT_THEME;
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore: the choice just won't be remembered.
  }
}
