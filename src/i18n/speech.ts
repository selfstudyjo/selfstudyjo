/**
 * Choosing a voice for the language the reader is in.
 *
 * A plain module — no Vue, no DOM, and it never touches `speechSynthesis`
 * itself. It is handed a voice list and answers which one to use, so
 * `npm run check:i18n` can drive the whole matrix of language x gender x
 * plausible device line-up in node.
 *
 * ============================================================
 * WHY THIS EXISTS AT ALL, WHEN `newscastEngine.ts` ALREADY DOES IT
 * ============================================================
 *
 * It does, for two languages, for a two-anchor bulletin, and it is where every
 * rule below was learned the expensive way. What it cannot do is serve the Job
 * Interview room and the Toastmasters room, because its `LanguageCode` is
 * `'ar' | 'en'` and its whole shape is a *pair* of presenters — the rooms have
 * one speaker and three languages.
 *
 * So this is the platform-wide version and the newscast keeps its own. That is
 * a second copy of the gender table, which is working rule 10's cost being
 * paid deliberately: merging them means making the newscast's measured,
 * two-anchor, F0-checked casting depend on a general-purpose module, and the
 * newscast is the one surface where "both voices sound like the same woman" has
 * been reported four times. `check:i18n` asserts the two tables do not
 * disagree about a name they both know, which is the drift worth catching.
 *
 * ============================================================
 * THE ONE RULE THAT MATTERS MOST
 * ============================================================
 *
 * **A voice is never cast in the wrong language.** An explicitly assigned
 * `utterance.voice` OVERRIDES `utterance.lang`, so handing an English engine
 * Arabic or Chinese characters does not produce accented Arabic — it produces
 * an English speaker reading letters, which is noise. It was reported on the
 * newscast as "it reads in English and reads mixed words".
 *
 * So `pickVoice` returns **null** rather than a foreign-language voice, and the
 * caller must leave `utterance.voice` unset in that case. Unset is strictly
 * better than wrong: the platform then matches on `lang` alone and often
 * reaches an OS voice that was never in `getVoices()` at all.
 */

import { getLocale, type LocaleId } from './locales';

/** Just enough of `SpeechSynthesisVoice` to decide, so node can pass a literal. */
export interface VoiceLike {
    name: string;
    lang: string;
    localService?: boolean;
    default?: boolean;
}

export type SpeakerGender = 'female' | 'male';

/**
 * Voices whose gender is known rather than guessed.
 *
 * Matched WHOLE-WORD, never as a substring, and both halves of that are bugs
 * this table has already had:
 *
 *  - `naayf` is Microsoft's *male* Saudi voice and was in both lists, so its
 *    score cancelled to zero and it was cast at random;
 *  - `includes('ali')` matches `Australia`.
 *
 * A voice this table does not know scores 0 — a guess from the substring hints
 * below can still break the tie, but it can never outrank a name we recognise.
 */
const KNOWN_GENDER: Record<string, SpeakerGender> = {
    // Arabic — Microsoft (Windows and Edge), Apple, Google
    salma: 'female', zariyah: 'female', hoda: 'female', fatima: 'female',
    laila: 'female', layla: 'female', amina: 'female', rana: 'female',
    sana: 'female', noura: 'female', iman: 'female', mouna: 'female',
    aysha: 'female', amal: 'female', amany: 'female', reem: 'female',
    maryam: 'female', zeina: 'female',
    shakir: 'male', hamed: 'male', hamdan: 'male', naayf: 'male', nayf: 'male',
    maged: 'male', majed: 'male', tarik: 'male', bassel: 'male', ismael: 'male',
    taim: 'male', fahed: 'male', rami: 'male', omar: 'male', jamal: 'male',
    abdullah: 'male', moaz: 'male', laith: 'male', hedi: 'male', saleh: 'male',
    // English
    zira: 'female', aria: 'female', jenny: 'female', michelle: 'female',
    samantha: 'female', victoria: 'female', karen: 'female', moira: 'female',
    tessa: 'female', fiona: 'female', serena: 'female', allison: 'female',
    susan: 'female', joanna: 'female', kendra: 'female', kimberly: 'female',
    sonia: 'female', libby: 'female', natasha: 'female', clara: 'female',
    eva: 'female', emma: 'female',
    david: 'male', mark: 'male', guy: 'male', ryan: 'male', brian: 'male',
    alex: 'male', daniel: 'male', fred: 'male', oliver: 'male', thomas: 'male',
    aaron: 'male', matthew: 'male', justin: 'male', william: 'male',
    liam: 'male', christopher: 'male', eric: 'male', roger: 'male',
    steffan: 'male', george: 'male', james: 'male',
    // Chinese — the reason this table needed extending at all.
    //
    // Microsoft's Chinese neural voices are named in pinyin and the gender is
    // NOT guessable from the romanisation by any rule an English-tuned hint
    // list would apply: `Yunxi`, `Yunjian`, `Yunyang` and `Yunfeng` are all
    // male and all share the `Yun` prefix, while `Xiaoxiao`, `Xiaoyi`,
    // `Xiaochen` and `Xiaohan` are all female and share `Xiao`. A substring
    // hint list built for Latin names finds nothing in any of them and would
    // cast at random — which on a one-speaker room means the interviewer's
    // gender changes between questions.
    xiaoxiao: 'female', xiaoyi: 'female', xiaochen: 'female', xiaohan: 'female',
    xiaomeng: 'female', xiaomo: 'female', xiaoqiu: 'female', xiaorui: 'female',
    xiaoshuang: 'female', xiaoyan: 'female', xiaoyou: 'female', xiaozhen: 'female',
    huihui: 'female', yaoyao: 'female', hanhan: 'female', yating: 'female',
    hsiaochen: 'female', hsiaoyu: 'female', tingting: 'female', liliang: 'female',
    yunxi: 'male', yunjian: 'male', yunyang: 'male', yunfeng: 'male',
    yunhao: 'male', yunye: 'male', yunze: 'male', yunxia: 'male',
    kangkang: 'male', yunjhe: 'male', zhiwei: 'male',
};

/**
 * Substring hints, for a voice the table does not know.
 *
 * Deliberately weak — they break a tie and never decide one. Kept short
 * because every entry is a chance to match the middle of an unrelated word,
 * which is the `ali`-inside-`Australia` bug.
 */
const FEMALE_HINTS = ['female', 'woman', 'girl', '女', 'anfemale'];
const MALE_HINTS = ['male', 'man', 'boy', '男'];

/**
 * Male voices that do not read as male.
 *
 * `Guy` is labelled Male by Microsoft and measures **160 Hz** — inside the
 * female range and 37 Hz from Aria, where every other male voice measured
 * 105-150 Hz. It was the English male anchor on the newscast and was reported
 * as sounding female. A declared gender cannot express that, so the exception
 * is listed. It is only ever a de-prioritisation, never an exclusion: on a
 * device where Guy is the only male voice, Guy is the male voice.
 */
const READS_LIGHT = new Set(['guy']);

/**
 * Split a voice name into words.
 *
 * The character class has to admit Arabic and CJK, or a voice named entirely in
 * its own script splits into nothing and the table can never match it. Chinese
 * voice names arrive romanised on Windows and in Han characters on some Android
 * builds; `Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)` and
 * `中文（中国大陆）` are both things `getVoices()` returns.
 */
function words(name: string): string[] {
    return (name || '')
        .toLowerCase()
        .split(/[^a-z؀-ۿ㐀-䶿一-鿿]+/)
        .filter(Boolean);
}

function genderOf(voice: VoiceLike): SpeakerGender | null {
    for (const part of words(voice?.name || '')) {
        const known = KNOWN_GENDER[part];
        if (known) return known;
    }
    return null;
}

function scoreHints(name: string, hints: string[]): number {
    const lower = (name || '').toLowerCase();
    return hints.reduce((n, hint) => n + (lower.includes(hint) ? 1 : 0), 0);
}

/** The word in a voice's name that identified its gender. */
function primaryName(voice: VoiceLike): string {
    for (const part of words(voice?.name || '')) {
        if (KNOWN_GENDER[part]) return part;
    }
    return '';
}

/** Every voice the device offers for this locale. Prefix match — see `locales.ts`. */
export function voicesFor(voices: VoiceLike[], localeId: LocaleId | string): VoiceLike[] {
    const prefix = getLocale(localeId).speechPrefix;
    return (voices || []).filter(v => (v.lang || '').toLowerCase().startsWith(prefix));
}

/** Can this device say one word of this language? */
export function canSpeak(voices: VoiceLike[], localeId: LocaleId | string): boolean {
    return voicesFor(voices, localeId).length > 0;
}

/**
 * The best available voice for a language, or `null`.
 *
 * `null` means "this device cannot speak this language" and the caller must
 * treat it as such: leave `utterance.voice` unset and set `utterance.lang`, or
 * hand the line to the server engine. It NEVER means "no preference".
 *
 * `gender` is a preference and not a requirement, because for a one-speaker
 * room a voice in the right language always beats a voice of the right gender:
 * a female interviewer is a cosmetic surprise, an English voice reading Chinese
 * is unusable.
 */
export function pickVoice(
    voices: VoiceLike[],
    localeId: LocaleId | string,
    gender?: SpeakerGender,
    exclude?: VoiceLike | null,
): VoiceLike | null {
    const pool = voicesFor(voices, localeId);
    if (!pool.length) return null;
    if (!gender) {
        // No preference: prefer a local voice, since a network voice can stall
        // mid-sentence, and then whatever the platform calls default.
        const ranked = [...pool].sort((a, b) =>
            Number(!!b.localService) - Number(!!a.localService)
            || Number(!!b.default) - Number(!!a.default));
        // `pool` is non-empty above, so `ranked[0]` exists — the `?? null` is
        // for `noUncheckedIndexedAccess`, not for a case that happens.
        return ranked[0] ?? null;
    }

    const wanted = gender === 'female' ? FEMALE_HINTS : MALE_HINTS;
    const unwanted = gender === 'female' ? MALE_HINTS : FEMALE_HINTS;

    const ranked = pool
        .map(voice => {
            // The known table outranks the hints by an order of magnitude: a
            // name we recognise is evidence, a substring is a guess.
            const known = genderOf(voice);
            let score = known === gender ? 20 : (known === null ? 0 : -20);
            score += scoreHints(voice.name, wanted) * 4 - scoreHints(voice.name, unwanted) * 4;
            if (gender === 'male' && READS_LIGHT.has(primaryName(voice))) score -= 6;
            if (exclude && voice.name === exclude.name) score -= 10;
            if (voice.localService) score += 1;
            return { voice, score };
        })
        .sort((a, b) => b.score - a.score);

    return ranked[0]?.voice ?? null;
}

/**
 * Can this device field two voices that sound like two different people?
 *
 * Only Toastmasters needs it — the meeting has several roles and hearing the
 * Timer and the Grammarian in the same voice makes a room of one person. The
 * Job Interview room has a single interviewer and does not care.
 */
export function hasGenderedPair(voices: VoiceLike[], localeId: LocaleId | string): boolean {
    const pool = voicesFor(voices, localeId);
    let female = false;
    let male = false;
    for (const voice of pool) {
        const g = genderOf(voice);
        if (g === 'female') female = true;
        if (g === 'male' && !READS_LIGHT.has(primaryName(voice))) male = true;
    }
    return female && male;
}

/**
 * What to put on `utterance.lang`.
 *
 * Set even when a voice was cast, and set to the CAST VOICE'S OWN `lang` in
 * that case rather than to the locale's: asking for `zh-CN` while casting a
 * `zh-TW` voice is a mismatch some engines resolve by ignoring the voice, and
 * then the whole point of casting it is lost. Same trap the newscast hit
 * asking for `ar-SA` with an `ar-EG` voice.
 */
export function utteranceLang(localeId: LocaleId | string, voice?: VoiceLike | null): string {
    return voice?.lang || getLocale(localeId).tag;
}

/**
 * A one-line description of what the reader is actually hearing.
 *
 * On the newscast, "is the male anchor really on a male voice?" was asked three
 * times and the page could not answer, because nothing on screen said which
 * voice had spoken. The rooms get the same affordance for the same reason —
 * and it is the only way to tell "this device has no Chinese voice" apart from
 * "the speech is broken", which look identical from a chair.
 */
export function describeVoice(voice: VoiceLike | null, localeId: LocaleId | string): string {
    const locale = getLocale(localeId);
    if (!voice) return `${locale.name} — no device voice`;
    const g = genderOf(voice);
    return `${voice.name} (${voice.lang})${g ? ` — ${g}` : ''}`;
}

/** Exposed for `check:i18n`, which compares this table against the newscast's. */
export const _KNOWN_GENDER = KNOWN_GENDER;
