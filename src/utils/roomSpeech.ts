/**
 * Saying a line out loud, in whatever language the reader is in.
 *
 * Used by the Job Interview room and the Toastmasters meeting — the two places
 * on this platform where a person is spoken TO rather than reading. It is a
 * plain module (no Vue, no component state) so `check:actors` and
 * `check:i18n` can drive the decision table in node; the only browser API it
 * touches is behind an injectable, for the same reason.
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
 *  1. **A device voice in the right language** — instant, free, no network. Used
 *     whenever one exists, even of the wrong gender (the pitch compensates).
 *  2. **The server engine** (app 36's `/api/news/tts/`) — a measured neural
 *     pair per language, identical on every machine. Used when the device has
 *     no voice for the language at all. It costs a round trip and a few hundred
 *     kilobytes, which is why it is second rather than first.
 *  3. **`speechSynthesis` with `lang` set and NO voice assigned** — the last
 *     resort, and it is a real one rather than a shrug: an explicitly assigned
 *     `utterance.voice` OVERRIDES `utterance.lang`, so leaving it unset is what
 *     lets the platform match on the language itself and often reach an OS
 *     voice that was never in `getVoices()`.
 *
 * A wrong-language device voice is never used at any step. That is the one rule
 * here that must not be relaxed for the sake of "some sound is better than
 * none": it is not, because the sound is unintelligible and the listener cannot
 * tell whether the feature or their own comprehension is at fault.
 */

import { castVoice, pitchFor, type Gender } from '@/cast/actors';
import type { VoiceLike } from '@/components/newscast/newscastEngine';

/** How the line was actually said. Shown to the reader — see `describe`. */
export type SpeechRoute = 'device' | 'server' | 'platform';

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
}

/**
 * Which route to take for one line.
 *
 * `serverAvailable` is the caller's answer to "has app 36 told us it can voice
 * a gendered pair in this language" — asked once per session rather than per
 * line, because the answer does not change mid-meeting and a probe per sentence
 * is a round trip per sentence.
 */
export function planSpeech(
    voices: VoiceLike[],
    locale: string,
    gender: Gender,
    seat = 0,
    serverAvailable = false,
): SpeechPlan {
    const cast = castVoice(voices, gender, seat, locale);

    if (cast.languageAvailable && cast.voice) {
        return {
            route: 'device',
            voice: cast.voice,
            // Set to the CAST VOICE'S OWN lang, not the locale's. Asking for
            // `zh-CN` while casting a `zh-TW` voice is a mismatch some engines
            // resolve by ignoring the voice — and then the whole point of
            // casting it is lost. Same trap the newscast hit asking for `ar-SA`
            // with an `ar-EG` voice.
            lang: cast.voice.lang || locale,
            pitch: pitchFor(gender, cast.matched),
            matched: cast.matched,
        };
    }

    if (serverAvailable) {
        // The server pair is measured and gendered, so no pitch compensation is
        // wanted — bending a correctly-cast neural voice makes it sound
        // synthetic for no gain.
        return { route: 'server', voice: null, lang: locale, pitch: 1, matched: true };
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
    };
}

/**
 * One line of "what the reader is actually hearing", for the room to show.
 *
 * On the newscast, "is the male anchor really on a male voice?" was asked three
 * times and the page could not answer, because nothing on screen said which
 * voice had spoken. The rooms get the same affordance for the same reason — and
 * it is the only way to tell "this device has no Chinese voice" apart from "the
 * speech is broken", which are indistinguishable from a chair.
 */
export function describe(plan: SpeechPlan, localeName: string): string {
    if (plan.route === 'device') {
        return `${plan.voice?.name || 'device voice'}${plan.matched ? '' : ' · pitch adjusted'}`;
    }
    if (plan.route === 'server') return `${localeName} · server voice`;
    return `${localeName} · no device voice`;
}
