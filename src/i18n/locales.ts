/**
 * The languages the platform is offered in.
 *
 * A plain module — no Vue, no Pinia, no DOM — for the same reason as
 * `photoMask.ts`, `drawEngine.ts`, `appNav.ts` and `theme/themes.ts`:
 * everything here is decidable without a browser, so `npm run check:i18n` can
 * assert the properties that are invisible until they are wrong in front of a
 * reader. `i18n/apply.ts` is the half that touches the document.
 *
 * WHY THREE, AND WHY THESE THREE
 *
 * English is the platform's source language: every message key IS its English
 * text (see `index.ts`), so English needs no catalogue and can never be
 * missing a string. Arabic is the language most of the audience reads and the
 * only one that also flips the layout. Chinese is the third, and it is the one
 * that breaks assumptions the other two share — see `wordless` below.
 *
 * WHY ONE CHINESE AND NOT TWO
 *
 * `zh-Hans` and `zh-Hant` are a real distinction and this is deliberately one
 * locale, Simplified. A second variant doubles every catalogue and doubles the
 * cost of every future string for a reader the platform does not have yet; a
 * Traditional reader gets Simplified, which is legible, rather than English,
 * which is not. If that changes, add `zh-Hant` as a fourth locale with `zh` as
 * its fallback rather than forking the catalogue.
 */

/** Every locale the app can be in. `en` is the source language. */
export type LocaleId = 'en' | 'ar' | 'zh';

export type Direction = 'ltr' | 'rtl';

export interface Locale {
    id: LocaleId;

    /** The BCP-47 tag. What `Intl`, `<html lang>` and a speech engine want. */
    tag: string;

    /** In English, for an operator, a log line and the picker's second line. */
    name: string;

    /**
     * In the language itself. This is what the picker shows FIRST, because
     * somebody looking for their own language is looking for their own word
     * for it — a reader who cannot read English cannot find "Arabic" in a
     * list, and that is the one list they have to be able to use.
     */
    nativeName: string;

    direction: Direction;

    /**
     * The flag-free glyph shown in the collapsed rail.
     *
     * DELIBERATELY NOT A FLAG. A language is not a country: Arabic is read in
     * twenty-two of them and picking one to stand for the language is a
     * political statement nobody asked this picker to make. Two letters of the
     * language's own script say the same thing and say it to the reader who
     * needs it.
     */
    badge: string;

    /**
     * The prefix a `SpeechSynthesisVoice.lang` must start with to be a voice
     * for this locale.
     *
     * Matched as a prefix and not compared whole: a device offering `ar-EG`,
     * `ar-SA` or `zh-TW` has a usable voice for `ar` / `zh`, and an exact-match
     * rule would find none of them and leave the reader in silence. See
     * `speech.ts`, where this is most of the reason the Job Interview room can
     * speak Arabic at all.
     */
    speechPrefix: string;

    /** What Whisper is told the audio is in. */
    whisper: string;

    /**
     * What a language model is told to answer in.
     *
     * Spelled out rather than passed as a code, because a code is a guess a
     * model has to make and the register is not: "Arabic" gets whichever
     * dialect the model feels like, "Modern Standard Arabic" gets the one a
     * professional setting is conducted in. Same for Chinese, where the ask has
     * to name the script or a model will sometimes answer in Traditional.
     */
    aiName: string;

    /**
     * True where the script does not put spaces between words.
     *
     * THE BUG THIS FIELD EXISTS TO CLOSE, WHICH THE PLATFORM HAS ALREADY PAID
     * FOR TWICE IN THE OTHER DIRECTION.
     *
     * `_ji_is_whole_question` on app 27 and `isWholeQuestion` in
     * `interviewSetup.ts` both accept a question only if it has three words and
     * a terminator. A Chinese sentence split on whitespace has length ONE, so
     * every Chinese question a model produces fails a word floor and the room
     * falls back to its local English pool — precisely the shape of the
     * character floor that used to refuse "A proper question?" and every Arabic
     * question ever written. A wordless script is counted in characters
     * instead, and this flag is what says which rule applies.
     */
    wordless: boolean;

    /** Sentence terminators, for anything that has to split prose. */
    terminators: string;
}

export const LOCALES: readonly Locale[] = [
    {
        id: 'en',
        tag: 'en',
        name: 'English',
        nativeName: 'English',
        direction: 'ltr',
        badge: 'EN',
        speechPrefix: 'en',
        whisper: 'en',
        aiName: 'English',
        wordless: false,
        terminators: '.!?',
    },
    {
        id: 'ar',
        tag: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        direction: 'rtl',
        badge: 'ع',
        speechPrefix: 'ar',
        whisper: 'ar',
        aiName: 'Modern Standard Arabic (فصحى)',
        wordless: false,
        // The Arabic question mark is a different codepoint from the ASCII one.
        // Both news sources use it exclusively, and a splitter that only knows
        // `?` returns one enormous "sentence" for a whole Arabic article —
        // which is how a detail cap stops capping.
        terminators: '.!?؟۔',
    },
    {
        id: 'zh',
        tag: 'zh-CN',
        name: 'Chinese (Simplified)',
        nativeName: '简体中文',
        direction: 'ltr',
        badge: '中',
        speechPrefix: 'zh',
        whisper: 'zh',
        aiName: 'Simplified Chinese (简体中文)',
        wordless: true,
        // Chinese punctuation is full-width and none of it is the ASCII
        // character with the same job. A terminator check written against
        // `[.!?]` sees a Chinese paragraph as having no sentence end at all,
        // which reads to `require_complete` as a reply that was cut off.
        terminators: '。！？.!?',
    },
] as const;

export const DEFAULT_LOCALE_ID: LocaleId = 'en';

const BY_ID = new Map<string, Locale>(LOCALES.map(l => [l.id, l]));

export function isLocaleId(value: unknown): value is LocaleId {
    return typeof value === 'string' && BY_ID.has(value);
}

/** Never throws: an unknown id is English, which every reader can at least see. */
export function getLocale(id: string | null | undefined): Locale {
    return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_LOCALE_ID)!;
}

/**
 * Resolve a browser or OS language tag onto one of ours.
 *
 * Prefix matching, deliberately generous: `ar-JO`, `ar_JO`, `arb` and `AR` are
 * all Arabic, and `zh-Hant-TW` is Chinese. The alternative is a reader whose
 * browser is already set to their own language being handed English because
 * their region was not in a list.
 */
export function matchLocale(tag: string | null | undefined): Locale | null {
    if (!tag) return null;
    const norm = tag.toLowerCase().replace(/_/g, '-');
    const primary = norm.split('-')[0];
    // Longest id first, so a future `zh-hant` wins over `zh`.
    const ordered = [...LOCALES].sort((a, b) => b.id.length - a.id.length);
    for (const locale of ordered) {
        if (norm === locale.id || norm.startsWith(locale.id + '-')) return locale;
    }
    for (const locale of ordered) {
        if (primary === locale.speechPrefix) return locale;
    }
    // `arb` is Standard Arabic's own ISO 639-3 code and some systems send it.
    if (primary === 'arb') return BY_ID.get('ar')!;
    return null;
}

/** True where the layout mirrors. Read by `apply.ts` and by the RTL stylesheet. */
export function isRtl(id: string): boolean {
    return getLocale(id).direction === 'rtl';
}

/**
 * How many "words" a piece of text has, in whichever sense its script means.
 *
 * The one function in this module that exists purely because of the bug in
 * `wordless` above. Spaced scripts count runs of non-space; a wordless one
 * counts CJK codepoints, where roughly one character is one morpheme — so
 * "three words" means "three characters" and a real Chinese question passes a
 * floor written for English prose. Mixed text (a Chinese question naming an
 * English product) counts both, which is why this is a sum rather than a
 * branch.
 */
export function countWords(text: string, locale: Locale): number {
    const spaced = (text.match(/[^\s　]+/g) || []).length;
    if (!locale.wordless) return spaced;
    const cjk = (text.match(/[㐀-䶿一-鿿豈-﫿]/g) || []).length;
    // A wholly Latin string in a `zh` session is still a sentence somebody can
    // read, so the spaced count is not discarded — it is the floor.
    return Math.max(cjk, spaced);
}

/** Does this text end where a sentence in this language ends? */
export function endsSentence(text: string, locale: Locale): boolean {
    const trimmed = text.trimEnd();
    if (!trimmed) return false;
    // A closing quote or bracket after the terminator is still a finished
    // sentence, and both are common in a model's reply.
    const stripped = trimmed.replace(/["'”’»』」)\]]+$/u, '');
    const last = stripped.slice(-1);
    return locale.terminators.includes(last);
}
