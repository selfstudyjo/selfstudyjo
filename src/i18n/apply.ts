/**
 * The half of the i18n system that touches the document.
 *
 * `locales.ts` and `index.ts` are deliberately free of any DOM reference so
 * `npm run check:i18n` can load them in node. Everything that reads or writes
 * `document` or `localStorage` lives here, and nothing here decides what a
 * string says — it only transports the choice.
 *
 * Same split, same reasons, as `theme/apply.ts` next door.
 */

import {
    DEFAULT_LOCALE_ID, getLocale, isLocaleId, matchLocale,
    type Locale, type LocaleId,
} from './locales';

const STORAGE_KEY = 'sfs-locale';

/** A language chosen in one tab should be the language the next tab opens in. */
export function readStoredLocale(): LocaleId | null {
    try {
        const id = localStorage.getItem(STORAGE_KEY);
        return isLocaleId(id) ? id : null;
    } catch {
        // Private browsing, or storage disabled. Not worth failing over.
        return null;
    }
}

export function writeStoredLocale(id: LocaleId): void {
    try {
        localStorage.setItem(STORAGE_KEY, id);
    } catch {
        /* ignore */
    }
}

/**
 * The language the browser says its owner reads.
 *
 * `navigator.languages` before `navigator.language`, because the list is
 * ordered by preference and the singular is only the first entry — a machine
 * whose UI is English but whose second preference is Arabic is a machine whose
 * owner reads Arabic, and there is no reason to make them go and find a picker.
 */
export function browserLocale(): Locale | null {
    if (typeof navigator === 'undefined') return null;
    const tags = [
        ...(Array.isArray(navigator.languages) ? navigator.languages : []),
        navigator.language,
    ].filter(Boolean) as string[];
    for (const tag of tags) {
        const hit = matchLocale(tag);
        if (hit) return hit;
    }
    return null;
}

/**
 * Which language to open in: the one the visitor picked, else the one their
 * browser implies, else English.
 *
 * ============================================================
 * THIS FOLLOWS THE BROWSER, AND `defaultThemeFor()` NEXT DOOR DELIBERATELY
 * DOES NOT. THE DIFFERENCE IS THE POINT.
 * ============================================================
 *
 * `theme/apply.ts` ignores `prefers-color-scheme` on purpose: the dark galaxy
 * behind every page is the product's identity, and a visitor whose laptop
 * happens to be in light mode should not be handed a different-looking product
 * from the one everybody else is describing. A theme is a *preference*.
 *
 * A language is not a preference, it is comprehension. Handing an Arabic
 * reader an English page and expecting them to find a control they cannot read
 * the label of is the one case where "the product should look the same to
 * everybody" is exactly the wrong instinct — the control is at the bottom of a
 * sidebar that may be collapsed. So this one follows the machine, and the
 * picker exists for the reader whose machine is wrong about them.
 */
export function initialLocaleId(): LocaleId {
    return readStoredLocale() ?? browserLocale()?.id ?? DEFAULT_LOCALE_ID;
}

/**
 * Write a locale onto the document.
 *
 * Four things are set and every one of them is load-bearing:
 *
 *  - **`lang`** — what a screen reader picks its voice from, what a browser's
 *    own spell-checker and its translate prompt read, and what CSS `:lang()`
 *    and font fallback key off. Left at `en` on an Arabic page, a screen reader
 *    reads Arabic characters with English phonetics, which is noise rather than
 *    an accent. The same mistake, from the same cause, as casting an English
 *    `SpeechSynthesisVoice` for an Arabic utterance — see `speech.ts`.
 *  - **`dir`** — the only thing that actually mirrors a layout. Every logical
 *    property, every `text-align: start`, the caret in every field, the scroll
 *    origin and the order of flex items all come from here for free. Setting
 *    it on `<html>` rather than on `<body>` matters: the scrollbar and the
 *    viewport belong to the root element.
 *  - **`data-locale`** — what `rtl.css` and any future `:lang`-scoped rule
 *    read, and what `LeaderboardChart.vue`'s `MutationObserver` pattern would
 *    watch. An attribute rather than a class for the same reason `data-theme`
 *    is one: it holds a value, not a flag.
 *  - **`data-dir`** — separate from `dir` deliberately. `dir` is a real HTML
 *    attribute with real behaviour and a component is free to override it on
 *    a subtree (the newscast set does exactly that, and must). `data-dir` on
 *    the root stays true for the *page*, so a stylesheet asking "is this an
 *    RTL reader" gets the right answer inside an LTR-pinned subtree.
 */
export function applyLocale(locale: Locale): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.setAttribute('lang', locale.tag);
    root.setAttribute('dir', locale.direction);
    root.setAttribute('data-locale', locale.id);
    root.setAttribute('data-dir', locale.direction);
}

/**
 * Apply the stored (or implied) language as early as possible.
 *
 * Called from `main.ts` before `app.mount()`, so the first frame the reader
 * sees is already the right way round. A page that paints left-to-right and
 * then flips is worse than one that was always going to be wrong: the reflow
 * moves everything they were about to click.
 */
export function bootstrapLocale(): Locale {
    const locale = getLocale(initialLocaleId());
    applyLocale(locale);
    return locale;
}

export { DEFAULT_LOCALE_ID, getLocale, type Locale, type LocaleId };
