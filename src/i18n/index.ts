/**
 * The translation engine.
 *
 * Plain — no Vue, no DOM — so `npm run check:i18n` loads it in node and can
 * assert the catalogues from the outside. `runtime.ts` is the reactive half
 * that components use and `apply.ts` is the half that writes the document.
 *
 * ============================================================
 * THE KEY IS THE ENGLISH TEXT, AND THAT IS THE DESIGN
 * ============================================================
 *
 * `t('Save changes')`, not `t('common.saveChanges')`. Every other choice was
 * considered and this is the one that fits what is actually being done here:
 * retrofitting three languages onto ~52,000 lines of Vue that were written
 * with the English text inline.
 *
 * What it buys, in the order it matters:
 *
 *  1. **English can never be missing, wrong, or stale.** With a key namespace,
 *     English is a catalogue entry like any other, so a typo'd key renders as
 *     `common.savChanges` in the *source* language — the one every developer
 *     and every fallback path sees. Here the fallback IS the string, so the
 *     worst failure this design has is a screen that is not translated yet.
 *     That is a visibly incomplete feature rather than a broken one.
 *  2. **No key invention, so no key drift.** 3,000 strings need 3,000 names
 *     nobody agrees on, and the names are invented by whoever is holding the
 *     file at the time. `nav.exams.title` vs `exams.nav.label` is a real
 *     argument that produces two entries for one string.
 *  3. **The diff is legible.** `- Save changes` / `+ {{ $t('Save changes') }}`
 *     can be reviewed. A key can only be reviewed against the catalogue.
 *  4. **The check can find what is missing without a manifest.** The extractor
 *     reads every `$t('…')` out of `src/` and asserts Arabic and Chinese have
 *     it, so coverage is a number rather than a belief. A key namespace needs a
 *     separate English catalogue to diff against, and that catalogue is exactly
 *     the thing that goes stale.
 *
 * What it costs, stated plainly because both are real:
 *
 *  - **Rewording English is a catalogue migration.** Changing "Save changes" to
 *    "Save" silently orphans both translations and the string reverts to
 *    English. `check:i18n` reports orphans for this reason — an entry no source
 *    file asks for is either a reword nobody carried across or dead weight, and
 *    both are worth seeing.
 *  - **Long keys are ugly in source.** A paragraph as a key is a 200-character
 *    argument. It was already a 200-character literal in the same place, so
 *    nothing got worse; it just did not get better either.
 *
 * ============================================================
 * WHAT IS DELIBERATELY NOT DONE HERE
 * ============================================================
 *
 * No date/number formatting inside `t()`. `Intl` already does both, correctly,
 * for all three locales, and a second syntax for it inside a message string is
 * a second thing to get wrong. Use `n()` and `d()`.
 */

import { DEFAULT_LOCALE_ID, getLocale, type Locale, type LocaleId } from './locales';

/**
 * A message with more than one form.
 *
 * The tags are CLDR's, and Arabic is the reason the type has six of them:
 * `zero`, `one`, `two`, `few`, `many`, `other` are all distinct there. Chinese
 * has exactly one form for everything, which is not a shortcut to take — a
 * Chinese entry written as a bare string is the correct and complete answer,
 * and `resolvePlural` treats it that way rather than demanding six copies.
 */
export interface PluralForms {
    zero?: string;
    one?: string;
    two?: string;
    few?: string;
    many?: string;
    other: string;
}

export type Message = string | PluralForms;

export type Catalogue = Record<string, Message>;

/** What `t()` may be handed to fill a `{placeholder}`. */
export type Params = Record<string, string | number | null | undefined>;

/* ------------------------------------------------------------------ *
 * The registry
 * ------------------------------------------------------------------ */

const CATALOGUES = new Map<LocaleId, Catalogue>();

/**
 * Install a locale's messages.
 *
 * English is never registered and must never be: its catalogue is the source
 * itself. Registering one would create a second place English lives, which is
 * the failure mode this whole design exists to avoid — so this refuses rather
 * than accepting it and letting the two drift.
 */
export function register(id: LocaleId, catalogue: Catalogue): void {
    if (id === DEFAULT_LOCALE_ID) {
        throw new Error(
            'i18n: English has no catalogue — the message key IS its English text. '
            + 'Registering one would put English in two places.',
        );
    }
    CATALOGUES.set(id, catalogue);
}

export function catalogueFor(id: LocaleId): Catalogue | undefined {
    return CATALOGUES.get(id);
}

export function registeredLocales(): LocaleId[] {
    return [...CATALOGUES.keys()];
}

/* ------------------------------------------------------------------ *
 * Plural selection
 * ------------------------------------------------------------------ */

/**
 * Which form of a message a count wants.
 *
 * `Intl.PluralRules` rather than a hand-written rule per language, because
 * Arabic's is six-way and non-obvious (11 is `many`, 3–10 is `few`, 0 is
 * `zero`) and getting it wrong reads as broken grammar to a native reader while
 * looking completely fine to anybody else.
 *
 * Falls back to a two-way English rule if `Intl.PluralRules` is missing, which
 * no browser this app supports is — but a missing plural rule must not be a
 * blank screen.
 */
export function selectPlural(count: number, locale: Locale): keyof PluralForms {
    try {
        const rules = new Intl.PluralRules(locale.tag);
        return rules.select(count) as keyof PluralForms;
    } catch {
        return count === 1 ? 'one' : 'other';
    }
}

function resolvePlural(message: Message, count: number, locale: Locale): string {
    if (typeof message === 'string') return message;
    const category = selectPlural(count, locale);
    // `other` is required by the type, so this can always answer.
    return message[category] ?? message.other;
}

/* ------------------------------------------------------------------ *
 * Interpolation
 * ------------------------------------------------------------------ */

/**
 * Fill `{name}` placeholders.
 *
 * Two properties are load-bearing:
 *
 *  - **A placeholder with no value is left alone, not blanked.** `{name}` on
 *    screen is a bug somebody reports; an empty gap in a sentence is a bug
 *    nobody can describe. `check:i18n` fails on a translation whose
 *    placeholders differ from its key's, so this should be unreachable — it is
 *    the behaviour for when it is reached anyway.
 *  - **The output is text, never markup.** Nothing here escapes anything,
 *    because nothing here is allowed near `v-html`. A translated string with a
 *    link in it goes through `RichText` like any other user-facing text.
 */
export function interpolate(template: string, params?: Params): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
        const value = params[name];
        if (value === undefined || value === null) return whole;
        return String(value);
    });
}

/** Every `{placeholder}` in a message, in order. Used by the check. */
export function placeholdersOf(message: Message): string[] {
    const texts = typeof message === 'string'
        ? [message]
        : Object.values(message).filter((v): v is string => typeof v === 'string');
    const found = new Set<string>();
    for (const text of texts) {
        for (const match of text.matchAll(/\{(\w+)\}/g)) {
            if (match[1]) found.add(match[1]);
        }
    }
    return [...found].sort();
}

/* ------------------------------------------------------------------ *
 * The lookup
 * ------------------------------------------------------------------ */

/**
 * Translate one key into one locale.
 *
 * Pure, and takes the locale as an argument rather than reading module state,
 * so the check can ask for every locale in one pass and the runtime can bind it
 * to a reactive ref without this file knowing what Vue is.
 *
 * A key the catalogue does not have returns the key — which is the English
 * text. See the header: that is the entire point.
 */
export function translate(
    localeId: string,
    key: string,
    params?: Params,
    count?: number,
): string {
    const locale = getLocale(localeId);
    const catalogue = CATALOGUES.get(locale.id);
    const message = catalogue?.[key];

    if (message === undefined) {
        // Untranslated. The key is English and English is legible, so this is a
        // gap rather than a failure. Interpolate anyway — the placeholders in
        // the key are the same ones the caller is filling.
        const text = count === undefined ? key : resolvePlural(key, count, locale);
        return interpolate(text, params);
    }

    const text = count === undefined
        ? (typeof message === 'string' ? message : message.other)
        : resolvePlural(message, count, locale);
    return interpolate(text, params);
}

/** True when this locale actually has this key. What the coverage report counts. */
export function has(localeId: string, key: string): boolean {
    return CATALOGUES.get(getLocale(localeId).id)?.[key] !== undefined;
}

/* ------------------------------------------------------------------ *
 * Formatters
 * ------------------------------------------------------------------ */

/**
 * `Intl` instances are expensive to build and are built on every render
 * otherwise — a table of forty rows formatting a date each is forty
 * constructions per keystroke in the filter box. Memoised on the exact
 * (locale, options) pair, which is what makes them free to use inline.
 */
const FORMAT_CACHE = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat>(
    kind: string,
    localeId: string,
    options: object | undefined,
    build: () => T,
): T {
    const key = `${kind}|${localeId}|${JSON.stringify(options ?? {})}`;
    const hit = FORMAT_CACHE.get(key);
    if (hit) return hit as T;
    const made = build();
    FORMAT_CACHE.set(key, made);
    return made;
}

/**
 * A number, grouped and punctuated the way the reader's locale does it.
 *
 * ============================================================
 * ARABIC GETS LATIN DIGITS, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT
 * ============================================================
 *
 * `Intl.NumberFormat('ar').format(2026)` is `2,026`, not `٢٠٢٦`. That surprises
 * people — it surprised the first version of this comment, which claimed the
 * opposite — and it is correct: CLDR's default numbering system for the
 * *language* `ar` is `latn`. Only region-specific tags reach for `arab`
 * (`ar-EG` gives `٢٬٠٢٦`), and `ar-u-nu-arab` forces it anywhere.
 *
 * Latin digits are also the right answer for this platform, for two reasons
 * beyond "it is the default":
 *
 *  - **It is what the Levant writes.** The audience is largely Jordanian, and
 *    Jordanian Arabic interfaces, forms, receipts and price tags use Western
 *    digits almost universally. Egypt is where Arabic-Indic is still routine.
 *  - **Every digit on this platform sits next to something Latin.** A price
 *    beside `JOD`, a score beside `%`, an appointment id, a version, a date in a
 *    record. Arabic-Indic digits in those positions is precisely the bidi
 *    hazard `rtl.css` spends a whole section isolating — see the note there
 *    about uuids and `19.90 JOD`.
 *
 * The one place Arabic-Indic digits ARE right is the newscast's on-air clock,
 * and it does its own formatting for exactly that reason.
 *
 * The remaining rule is unchanged and still matters: `n()` for a quantity
 * somebody reads, plain interpolation for a value somebody uses. Grouping
 * separators in an id or a version number are wrong in every locale.
 */
export function formatNumber(localeId: string, value: number, options?: Intl.NumberFormatOptions): string {
    const locale = getLocale(localeId);
    try {
        return cached('n', locale.tag, options, () => new Intl.NumberFormat(locale.tag, options)).format(value);
    } catch {
        return String(value);
    }
}

export function formatDate(
    localeId: string,
    value: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
): string {
    const locale = getLocale(localeId);
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
        return cached('d', locale.tag, options,
            () => new Intl.DateTimeFormat(locale.tag, options ?? { dateStyle: 'medium' })).format(date);
    } catch {
        return date.toISOString().slice(0, 10);
    }
}

/**
 * Money.
 *
 * The currency code is never translated and never localised away: JOD is JOD in
 * every language, and a reader deciding whether to pay needs the code they will
 * see on their statement. `Intl` places it and picks the digits; the code
 * itself comes from the record.
 */
export function formatCurrency(localeId: string, amount: number | string, currency = 'JOD'): string {
    const value = typeof amount === 'number' ? amount : Number.parseFloat(amount);
    if (!Number.isFinite(value)) return String(amount ?? '');
    return formatNumber(localeId, value, {
        style: 'currency',
        currency,
        // App 22 and app 23 both render money as strings with two places
        // (`"19.90"`), and dropping to `19.9` for one plan in a list of four
        // reads as a different price rather than as the same one formatted.
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * "3 days ago" / "in 2 hours", in the reader's language.
 *
 * `Intl.RelativeTimeFormat` rather than a hand-rolled ladder, for the same
 * reason as the plural rules: Arabic's forms are not derivable from English's
 * and Chinese does not put the words in the same order.
 */
export function formatRelative(localeId: string, value: Date | string | number): string {
    const locale = getLocale(localeId);
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const seconds = (date.getTime() - Date.now()) / 1000;
    const table: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 31536000], ['month', 2592000], ['week', 604800],
        ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1],
    ];
    try {
        const rtf = new Intl.RelativeTimeFormat(locale.tag, { numeric: 'auto' });
        for (const [unit, size] of table) {
            if (Math.abs(seconds) >= size || unit === 'second') {
                return rtf.format(Math.round(seconds / size), unit);
            }
        }
        return rtf.format(0, 'second');
    } catch {
        return formatDate(localeId, date);
    }
}

export { DEFAULT_LOCALE_ID, getLocale, type Locale, type LocaleId };
