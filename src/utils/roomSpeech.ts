/**
 * Saying a line out loud, in whatever language the reader is in.
 *
 * Used by the Job Interview room and the Toastmasters meeting — the two places
 * on this platform where a person is spoken TO rather than reading. It is a
 * plain module (no Vue, no component state) so `check:actors` and `check:i18n`
 * can drive the decision table in node; the only browser API it touches is
 * behind an injectable, for the same reason.
 *
 * ============================================================
 * WHY THIS EXISTS RATHER THAN `speechSynthesis.speak()` IN EACH ROOM
 * ============================================================
 *
 * Because `speechSynthesis` cannot speak a language the OPERATING SYSTEM has no
 * voice for, and that is the normal case rather than the edge one:
 *
 *  - a stock Windows install has two English voices and NO Arabic voice;
 *  - many Linux builds and some Android ones have no Chinese voice;
 *  - a locked-down corporate image often has one voice, full stop.
 *
 * Before this, both rooms filtered `getVoices()` to `startsWith('en')` and cast
 * from what was left. Switch the interface to Arabic and the interviewer either
 * went silent or — worse — read Arabic characters with an English engine, which
 * is not accented Arabic, it is noise. The newscast was reported for exactly
 * that and its fix is the rule below.
 *
 * ============================================================
 * THE DECISION, IN ORDER
 * ============================================================
 *
 *  1. **A device voice in the right language** — instant, free, no network.
 *     Used whenever one exists, even of the wrong gender (the pitch
 *     compensates).
 *  2. **The server engine** (app 36's `/api/news/tts/`) — a measured neural
 *     voice, identical on every machine. Used when the device has no voice for
 *     the language at all. It costs a round trip and a few hundred kilobytes,
 *     which is why it is second rather than first.
 *  3. **`speechSynthesis` with `lang` set and NO voice assigned** — the last
 *     resort, and a real one rather than a shrug: an explicitly assigned
 *     `utterance.voice` OVERRIDES `utterance.lang`, so leaving it unset is what
 *     lets the platform match on the language itself and often reach an OS
 *     voice that was never in `getVoices()`.
 *
 * A wrong-LANGUAGE device voice is never used at any step. That is the one rule
 * here that must not be relaxed for "some sound is better than none": it is
 * not, because the sound is unintelligible and the listener cannot tell whether
 * the feature or their own comprehension is at fault.
 *
 * ============================================================
 * WHAT CHANGED, AND WHY ARABIC WAS SILENT IN BOTH ROOMS
 * ============================================================
 *
 * Step 2 used to be gated on a BOOLEAN the rooms computed as
 * `capabilities.languages[locale].paired` — "does app 36 have a male AND a
 * female voice for this language". Two separate faults came out of that, and
 * between them they are the whole of "the voice does not work in Arabic":
 *
 *  * **The meeting never asked.** `ToastmastersSession.vue` passed a hardcoded
 *    `false`, so six seats fell straight to step 3 on every machine with no
 *    Arabic voice — which is most of them. Nothing was wrong with the server;
 *    it was never called.
 *
 *  * **`paired` is the wrong question.** App 36's replica has been missing
 *    `edge-tts` for some time (CLAUDE.md says so at length), so the fallback
 *    provider is in charge and it has exactly ONE voice per language, female.
 *    `paired` is therefore `false` for Arabic, English and Chinese alike — and
 *    a room that reads that as "the server cannot help" turns down a working
 *    Arabic voice and goes silent instead.
 *
 * The question that matters is **"can it speak this LANGUAGE at all"**, which
 * is `available` below. Gender is a separate, lesser problem with its own
 * answer: the audio is reshaped into the right register on the way to the
 * speakers, exactly as the Newscast already does it — see `voiceShaper.ts`.
 * Where even that is impossible the wrong-gender voice IS used, and
 * {@link describe} says so on screen. That is a deliberate departure from the
 * Newscast's rule, and the reason is that the failures are not comparable: a
 * bulletin with one presenter is still a bulletin, whereas a meeting seat that
 * cannot speak is a participant who has been struck silent, and a silent
 * interviewer is not an interview at all. Substituting is acceptable here
 * **only because it is declared** (working rule 21).
 */

import { castVoice, pitchFor, type Gender } from '@/cast/actors';
import { MALE_RATIO, shapeRatio } from '@/components/newscast/voiceShaper';
import type { VoiceLike } from '@/components/newscast/newscastEngine';

/** How the line was actually said. Shown to the reader — see {@link describe}. */
export type SpeechRoute = 'device' | 'server' | 'platform';

/**
 * What app 36 can do for this language, as opposed to what it can do in
 * general.
 *
 * Three fields rather than one boolean, because the three states want three
 * different behaviours and collapsing them is precisely the bug above:
 * `available` decides whether the server is used at all, `paired` decides
 * whether anything has to be done about the gender, and `soloGender` says which
 * voice is going to arrive when it is not.
 */
export interface ServerVoices {
    /** Can it speak this language, in any voice? The only question that gates the route. */
    available: boolean;
    /** Does it have both a male and a female voice for it? */
    paired: boolean;
    /** The one gender it has, when `paired` is false. */
    soloGender: Gender | '';
}

/** No server: what a room assumes until the capability probe answers. */
export const NO_SERVER: ServerVoices = { available: false, paired: false, soloGender: '' };

export interface SpeechPlan {
    route: SpeechRoute;
    /** Set only on the `device` route. Never a voice from another language. */
    voice: VoiceLike | null;
    /** `utterance.lang`. Always set, even when a voice was cast — see below. */
    lang: string;
    /** `utterance.pitch`, compensating for a gender we could not match. */
    pitch: number;
    /** False when a voice of the wanted gender was not available. */
    matched: boolean;
    /**
     * Server route only. Tell the backend it may hand over a voice of the other
     * gender.
     *
     * It refuses by default — a silent substitution is the bug all of this
     * exists to prevent — so this is the room saying "I know, and I am going to
     * do something about it", which is a different thing from not noticing.
     */
    allowAnyVoice: boolean;
    /**
     * Server route only. Reshape the returned audio into this register, or
     * null to play it as it came.
     *
     * Non-null implies {@link allowAnyVoice}: there is no point asking for a
     * wrong-gender voice unless it is going to be corrected.
     */
    shapeTo: Gender | null;
}

/**
 * Does this device have a voice for this language at all?
 *
 * Split out because it is the question a room has to answer BEFORE deciding
 * whether to spend a round trip probing app 36 — on a machine that can speak
 * Arabic the server is never reached and the probe is wasted.
 */
export function deviceCanSpeak(voices: VoiceLike[], locale: string): boolean {
    return castVoice(voices, 'female', 0, locale).languageAvailable;
}

/**
 * Which route to take for one line.
 *
 * `server` is the caller's answer to "what can app 36 do in this language",
 * asked once per session rather than per line: the answer does not change
 * mid-meeting and a probe per sentence is a round trip per sentence against a
 * PythonAnywhere replica whose first answer of the day takes ~20 seconds.
 *
 * `canReshape` is whether the caller can run the resampling pass — in practice
 * "does this browser have Web Audio". It is a parameter rather than a probe so
 * the check can drive both sides of it.
 */
export function planSpeech(
    voices: VoiceLike[],
    locale: string,
    gender: Gender,
    seat = 0,
    server: ServerVoices = NO_SERVER,
    canReshape = true,
): SpeechPlan {
    const cast = castVoice(voices, gender, seat, locale);

    if (cast.languageAvailable && cast.voice) {
        return {
            route: 'device',
            voice: cast.voice,
            // The CAST VOICE'S OWN lang, not the locale's. Asking for `zh-CN`
            // while casting a `zh-TW` voice is a mismatch some engines resolve
            // by ignoring the voice — and then the whole point of casting it is
            // lost. Same trap the newscast hit asking for `ar-SA` with an
            // `ar-EG` voice.
            lang: cast.voice.lang || locale,
            pitch: pitchFor(gender, cast.matched),
            matched: cast.matched,
            allowAnyVoice: false,
            shapeTo: null,
        };
    }

    if (server.available) {
        // Either it has both voices, or the one it has happens to be the right
        // one. Nothing to correct, and a correctly-cast neural voice must not
        // be bent — pitch-shifting one only makes it sound synthetic.
        const willMatch = server.paired || server.soloGender === gender;
        if (willMatch) {
            return {
                route: 'server', voice: null, lang: locale, pitch: 1,
                matched: true, allowAnyVoice: false, shapeTo: null,
            };
        }

        // The wrong gender is coming. Reshape it if the shift is one there is
        // an honest ratio for — `shapeRatio` answers 1 for a direction it
        // cannot do, and playing a 1 as though it were "nothing to correct" is
        // the original bug arriving through the door built to stop it.
        const ratio = shapeRatio(server.soloGender || 'female', gender);
        const shapeable = canReshape && ratio !== 1 && ratio === MALE_RATIO;
        return {
            route: 'server', voice: null, lang: locale, pitch: 1,
            // `matched` is what {@link describe} prints. A reshaped voice IS
            // the right register by the time it reaches the speakers, so it is
            // matched; an unreshaped one is not, and the room says so.
            matched: shapeable,
            allowAnyVoice: true,
            shapeTo: shapeable ? gender : null,
        };
    }

    return {
        route: 'platform',
        voice: null,
        lang: locale,
        // No voice was cast, so nothing is known about the gender of whatever
        // the platform reaches. A pitch shift applied on a guess is as likely
        // to make a correct voice wrong as the reverse.
        pitch: 1,
        matched: false,
        allowAnyVoice: false,
        shapeTo: null,
    };
}

/**
 * One line of "what the reader is actually hearing", for the room to show.
 *
 * On the newscast, "is the male anchor really on a male voice?" was asked three
 * times and the page could not answer, because nothing on screen said which
 * voice had spoken. The rooms get the same affordance for the same reason — and
 * it is the only way to tell "this device has no Chinese voice" apart from "the
 * speech is broken", which from a chair are the same thing.
 *
 * `voiceName` is what the server reported for the clip it actually returned,
 * when there is one. It arrives after the fact, so the caller updates the label
 * once the audio is in hand rather than when the plan is made.
 */
export function describe(plan: SpeechPlan, localeName: string, voiceName = ''): string {
    if (plan.route === 'device') {
        return `${plan.voice?.name || 'device voice'}${plan.matched ? '' : ' · pitch adjusted'}`;
    }
    if (plan.route === 'server') {
        const who = voiceName || `${localeName} · server voice`;
        if (plan.shapeTo) return `${who} · reshaped`;
        return plan.matched ? who : `${who} · stand-in`;
    }
    return `${localeName} · no device voice`;
}

/**
 * Read a `/api/news/tts/capabilities/` answer for one language.
 *
 * Kept here rather than in each room because the shape is easy to read wrongly
 * in exactly the way that caused the outage above: `capabilities.paired` is
 * about the SERVICE and `languages[locale].paired` is about the language, and
 * neither of them is the question "can it speak this language".
 *
 * A missing entry is treated as unavailable rather than as available-and-broken:
 * a language app 36 does not list is one it has no voice table for, and
 * reaching for it would spend a round trip to be told 400.
 */
export function serverVoicesFor(
    capabilities: {
        languages?: Record<string, {
            paired?: boolean;
            genders?: string[];
            solo_gender?: string;
        }>;
    } | null | undefined,
    locale: string,
): ServerVoices {
    const entry = capabilities?.languages?.[locale];
    if (!entry) return NO_SERVER;
    const genders = Array.isArray(entry.genders) ? entry.genders : [];
    const paired = !!entry.paired;
    const solo = entry.solo_gender === 'male' || entry.solo_gender === 'female'
        ? entry.solo_gender
        : (genders.length === 1 && (genders[0] === 'male' || genders[0] === 'female')
            ? genders[0] as Gender
            : '');
    return {
        // Paired, or a single named gender, or simply "it listed some genders"
        // — all three mean there is a voice to be had.
        available: paired || !!solo || genders.length > 0,
        paired,
        soloGender: solo,
    };
}
