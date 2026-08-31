/**
 * The half of the theme system that touches the document.
 *
 * `contrast.ts` and `themes.ts` are deliberately free of any DOM reference so
 * `npm run check:theme` can load them in node. Everything that reads or writes
 * `document` lives here, and nothing here makes a colour decision — it only
 * transports the ones already derived.
 */

import { DEFAULT_THEME_ID, THEMES, defaultThemeFor, getTheme, type Theme } from './themes';

const STORAGE_KEY = 'sfs-theme';
/*
  The resolved page colour of the stored galaxy. Read by the inline script in
  index.html to paint the very first frame in the right colour — see
  `applyTheme` for why that matters more than it sounds.
*/
const SPACE_KEY = 'sfs-space';

/** A galaxy chosen in one tab should be the galaxy the next tab opens with. */
export function readStoredTheme(): string | null {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return id && THEMES.some(t => t.id === id) ? id : null;
  } catch {
    // Private browsing, or storage disabled. Not worth failing over.
    return null;
  }
}

export function writeStoredTheme(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Has the visitor's OS asked for a light interface? */
export function prefersLight(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: light)').matches === true;
}

/**
 * Which galaxy to open with: the one the visitor picked, else the one their
 * operating system implies, else Andromeda.
 *
 * Reaching for the OS preference matters more here than it usually does —
 * seven of the ten themes are dark, so somebody who has set their machine to
 * light mode would otherwise be handed a black screen and have to go and find
 * the picker before they could read it comfortably.
 */
export function initialThemeId(): string {
  return readStoredTheme() ?? defaultThemeFor(prefersLight());
}

/**
 * Write a theme onto the document.
 *
 * Three things are set and all three are load-bearing:
 *
 *  - the custom properties, which is what every stylesheet reads;
 *  - `data-theme` and `data-mode` on <html>, which is what `color-scheme` in
 *    theme.css keys off — and `color-scheme` is the only way to reach the
 *    browser's own widgets, the select popup above all;
 *  - `.dark-mode` / `.light-mode`. `src/style.css` carried seven `.dark-mode`
 *    rules — scrollbar track, selection, glass, shadows, body ink — and
 *    NOTHING had ever added the class, so all seven were dead code and the
 *    app was relying on each page stylesheet to set its own colours instead.
 *    Setting the class here brings them to life; each was checked and each is
 *    right for a dark galaxy. The class is also the hook any future rule
 *    should use rather than a second mechanism.
 *
 * Also updates `<meta name="theme-color">`, which is the colour of the browser
 * chrome on Android and of the status bar on an installed iOS PWA. Leaving it
 * pinned to the old indigo puts a stripe of the wrong galaxy above the app.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  for (const [name, value] of Object.entries(theme.vars)) {
    root.style.setProperty(name, value);
  }

  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-mode', theme.mode);
  root.classList.toggle('dark-mode', theme.mode === 'dark');
  root.classList.toggle('light-mode', theme.mode === 'light');

  setMeta('theme-color', theme.space);
  setMeta('color-scheme', theme.mode);

  /*
    Remember the page colour, for the inline script in index.html.

    That script runs before this module is even downloaded, and until it had a
    value to read it painted a hardcoded near-black — so the three LIGHT
    galaxies opened with a full-screen black flash on every load and every
    reload. It is the worst first impression the app can make and it is the one
    frame nobody can style from a stylesheet, because the stylesheet has not
    arrived yet.

    Written here rather than beside the theme id in `writeStoredTheme` on
    purpose: this runs on the bootstrap path as well, so a visitor who has never
    touched the picker still seeds it, and a colour that changes because the
    THEME definition changed is picked up without the id having moved.
  */
  try {
    localStorage.setItem(SPACE_KEY, theme.space);
  } catch {
    /* Private browsing. The inline script's own default covers it. */
  }
}

function setMeta(name: string, content: string): void {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

/**
 * Apply the stored (or implied) theme as early as possible.
 *
 * Called from `main.ts` before `app.mount()`, so the first frame the user sees
 * is already the right galaxy. Every `var(--sfs-…)` in the stylesheets carries
 * the pre-theme literal as its fallback, so even if this never ran the app
 * would render — just always in Andromeda.
 */
export function bootstrapTheme(): Theme {
  const theme = getTheme(initialThemeId());
  applyTheme(theme);
  return theme;
}

export { DEFAULT_THEME_ID, getTheme, THEMES };
export type { Theme };
