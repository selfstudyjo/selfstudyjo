/**
 * Reading a record's text in the reader's language.
 *
 * A plain module -- no Vue, no DOM, no store -- so `npm run check:datai18n` can
 * drive the whole decision table in node. The same precedent as `photoMask.ts`,
 * `drawEngine.ts`, `appNav.ts` and `leaderboardEngine.ts`, and for the same
 * reason: this is the one place that decides which of three strings a reader
 * sees, and getting it wrong is invisible to anybody working in English.
 *
 * ============================================================
 * WHY THIS EXISTS
 * ============================================================
 *
 * The interface has been translated since 2026-08-25 -- 2,200 strings, three
 * languages, 100% coverage. What it renders AROUND those strings is data: a
 * course called "Web Technologies", a lesson called "HTTP headers", a plan
 * called "Professional Annual". Those come out of a backend, and until
 * `utils/translations.py` a backend had nothing to answer with but the one
 * string an operator typed.
 *
 * So an Arabic reader got an Arabic page listing English courses, an Arabic
 * *Enroll* button under an English title, and an Arabic receipt for an English
 * plan. Half-translated reads worse than untranslated: untranslated is a product
 * that does not speak your language, half-translated is a product that looks
 * broken.
 *
 * `i18n/runtime.ts` used to say, in as many words, that "everything else on the
 * platform stores and returns records, and a record has no language". That was
 * true of a RECORD and never true of the TEXT ON one. This module and
 * `utils/translations.py` are the retraction.
 *
 * ============================================================
 * THE FIVE RULES, IN THE ORDER THEY MATTER
 * ============================================================
 *
 *  1. **English is the record's own field, and it is the fallback.** A record
 *     carries `title` plus a `translations` map that does NOT contain `en`. So a
 *     backend that has not been deployed yet, a record nobody has translated
 *     yet, and a language nobody has added yet all render the English the screen
 *     already showed. There is no state in which this makes a page worse than it
 *     was, which is what made it safe to put in front of every title on the
 *     platform in one change.
 *
 *  2. **A missing translation is a GAP, never an error.** Exactly the rule
 *     `i18n/index.ts` follows for the interface catalogues, and for the same
 *     reason: the worst failure available is a screen that is not translated
 *     *yet* and is visibly incomplete, rather than one that is broken.
 *
 *  3. **Never translate a person's own words.** Not a name, not a comment, not a
 *     chat message, not a CV, not a homework submission. The backends enforce
 *     this by simply not declaring those fields translatable, so there is
 *     nothing here to get wrong -- but `titleOf` and friends are generic, so it
 *     is worth saying where somebody will read it.
 *
 *  4. **Search and sort on BOTH.** A reader who sees an Arabic title types
 *     Arabic into the filter box; a colleague who knows the English one types
 *     English. `searchText` returns everything, so both work -- and this is the
 *     bug that a naive `record.title.includes(query)` leaves behind, silently,
 *     for exactly the readers this whole change is for.
 *
 *  5. **Sorting is by what is DISPLAYED, with a locale collator.**
 *     `Array.sort()` on Arabic strings compares UTF-16 code units, which is not
 *     alphabetical order in any language. `Intl.Collator` is, and it is also the
 *     only thing that gets Chinese into a useful order at all.
 */

import type { LocaleId } from './locales';

/**
 * The map a backend sends, and the shape of any record that carries one.
 *
 * `Record<string, string>` rather than a per-service union: the field names are
 * the backend's business (`title`, `description`, `text`, `course_name`,
 * `content`, `name`, `exam_instructions`), and a union here would need editing
 * every time a service declares one more.
 */
export type TranslationMap = Partial<Record<Exclude<LocaleId, 'en'>, Record<string, string>>>;

/*
 * Deliberately NO index signature.
 *
 * `[field: string]: unknown` was the first spelling and it is the wrong one: a
 * declared interface like `Course` has no index signature, so it is not
 * assignable to one, and every call site would need a cast. Casts at the call
 * site is where this stops being used.
 *
 * With `translations` optional, every existing record type is already
 * structurally compatible, so `$td(course)` type-checks whether or not
 * `course.service.ts` has been taught about the field yet -- which matters,
 * because the backends and this bundle deploy separately. The field lookup
 * inside `field()` casts once, here, where the reason can be written down.
 */
export interface Translatable {
    translations?: TranslationMap | null;
}

/** English is the record's own field, so it is never a key inside the map. */
export const BASE_LOCALE = 'en';

/**
 * One field, in one language, falling back to the record's own English.
 *
 * The fallback chain is deliberately two steps and not three: the translation,
 * then English. There is no "try the other translated language" step, and there
 * must not be -- showing a Chinese title to an Arabic reader because no Arabic
 * one exists is strictly worse than showing the English one, which at least
 * every reader here has already been reading.
 */
export function field(
    record: Translatable | null | undefined,
    name: string,
    locale: LocaleId,
): string {
    if (!record) return '';
    if (locale !== BASE_LOCALE) {
        const map = record.translations;
        if (map && typeof map === 'object') {
            const entry = (map as Record<string, unknown>)[locale];
            if (entry && typeof entry === 'object') {
                const text = (entry as Record<string, unknown>)[name];
                // A blank translation is a gap, not an answer. The backend drops
                // empty strings on write, so this only catches a record written
                // before it did -- but a blank title renders as a nameless card,
                // which reads as data loss rather than as unfinished work.
                if (typeof text === 'string' && text.trim()) return text;
            }
        }
    }
    const own = (record as Record<string, unknown>)[name];
    return typeof own === 'string' ? own : (own == null ? '' : String(own));
}

/** `field(record, 'title', locale)`, which is most of the call sites. */
export function titleOf(
    record: Translatable | null | undefined,
    locale: LocaleId,
    name = 'title',
): string {
    return field(record, name, locale);
}

/**
 * Whether this record has anything at all in a given language.
 *
 * For the console and for a "not translated yet" marker -- never for deciding
 * what to render, which is `field`'s job and is per field rather than per
 * record.
 */
export function hasTranslation(
    record: Translatable | null | undefined,
    locale: LocaleId,
): boolean {
    if (!record || locale === BASE_LOCALE) return false;
    const entry = (record.translations as Record<string, unknown> | undefined)?.[locale];
    return !!entry && typeof entry === 'object'
        && Object.values(entry as Record<string, unknown>)
            .some(v => typeof v === 'string' && v.trim());
}

/**
 * Everything a filter box should match against, lowercased, in one string.
 *
 * EVERY language, not just the current one, and that is the whole point. A
 * reader looking at an Arabic course list types Arabic; the same person
 * describing it to a colleague, or returning to it after switching the
 * interface back, types English. A filter that matched only the rendered
 * language would be a search that stops working when you change a setting, for
 * exactly the readers this change is for.
 *
 * `toLowerCase()` does nothing to Arabic or Chinese -- neither script has case
 * -- and it is what makes the English half case-insensitive, so it is applied to
 * the whole string rather than conditionally.
 */
export function searchText(
    record: Translatable | null | undefined,
    names: readonly string[],
): string {
    if (!record) return '';
    const parts: string[] = [];
    for (const name of names) {
        const own = (record as Record<string, unknown>)[name];
        if (typeof own === 'string' && own) parts.push(own);
    }
    const map = record.translations as Record<string, unknown> | undefined;
    if (map && typeof map === 'object') {
        for (const entry of Object.values(map)) {
            if (!entry || typeof entry !== 'object') continue;
            for (const name of names) {
                const text = (entry as Record<string, unknown>)[name];
                if (typeof text === 'string' && text) parts.push(text);
            }
        }
    }
    return parts.join('  ').toLowerCase();
}

/** Does this record match a query, in any language it carries? */
export function matches(
    record: Translatable | null | undefined,
    names: readonly string[],
    query: string,
): boolean {
    const q = (query || '').trim().toLowerCase();
    if (!q) return true;
    return searchText(record, names).includes(q);
}

/**
 * A comparator over the DISPLAYED text, in the reader's own collation.
 *
 * `a.title.localeCompare(b.title)` is the obvious spelling and it is wrong
 * twice: it compares the English while the reader is looking at the Arabic, so
 * an alphabetical list is in no discernible order; and without a locale it uses
 * the *browser's*, so the same list sorts differently for two readers of the
 * same language. One collator is built per call rather than per comparison,
 * because constructing one is the expensive part and `sort` calls the comparator
 * O(n log n) times.
 */
export function byField<T extends Translatable>(
    name: string,
    locale: LocaleId,
): (a: T, b: T) => number {
    const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
    return (a, b) => collator.compare(field(a, name, locale), field(b, name, locale));
}

/**
 * The languages a record is missing, for a console badge.
 *
 * Returns the codes rather than a count, so the caller can name them -- "no
 * Arabic" is actionable and "1 missing" is not.
 */
export function missingLocales(
    record: Translatable | null | undefined,
    names: readonly string[],
    locales: readonly LocaleId[],
): LocaleId[] {
    const gaps: LocaleId[] = [];
    for (const locale of locales) {
        if (locale === BASE_LOCALE) continue;
        const has = names.some(name => {
            const entry = (record?.translations as Record<string, unknown> | undefined)?.[locale];
            const text = (entry as Record<string, unknown> | undefined)?.[name];
            return typeof text === 'string' && !!text.trim();
        });
        if (!has) gaps.push(locale);
    }
    return gaps;
}
