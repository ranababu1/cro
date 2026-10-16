export const THEME_KEY = 'fabt-theme';
export type ThemeChoice = 'light' | 'dark' | 'system';

/**
 * Runs in <head> before paint so the signed-in app never flashes the wrong theme.
 * Sets html[data-theme]; only elements inside .app-scope react to it, so marketing pages stay light.
 */
export const themeInitScript = `(function(){try{var c=localStorage.getItem('${THEME_KEY}');var d=c==='dark'||((c===null||c==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): 'light' | 'dark' {
    return choice === 'dark' || (choice === 'system' && prefersDark) ? 'dark' : 'light';
}
