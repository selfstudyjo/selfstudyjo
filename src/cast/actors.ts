/**
 * The six people who appear in the Toastmasters meeting room and conduct the
 * mock job interviews — as ROLES, not as appearances.
 *
 * They were hand-drawn SVG faces once, then filmed media (an idle WebP and a
 * looping MP4 each), and they are now built in 3D at runtime. Through all
 * three, this file has held the same thing: who sits where, what each seat is
 * called, and how a voice is cast for them.
 *
 * **What they LOOK like lives in `stage3d/figures.ts`**, and their names and
 * genders are imported from there rather than restated. That split is the point
 * of this rewrite: a name on a tile, the gender that casts the voice and the
 * face being rendered are three views of one person, and the previous version
 * kept the first two here and the third in a pair of asset files. A cast that
 * agrees with its pictures only by coincidence is one that stops agreeing the
 * first time somebody is recast — which is the same argument `seatGenders()`
 * has always made about the session view's old private `BOT_GENDERS` map, one
 * level up.
 *
 * This module is plain — no Vue, no DOM, no asset imports — for the same reason
 * `appNav.ts`, `linkify.ts` and `newscastEngine.ts` are: it is the half that
 * can be checked in node, by `npm run check:actors`.
 */

// One table of voice names, not two. Which voice is male and which is female
// has no field in the Web Speech API and has to be guessed from the name; the
// newscast's table is the curated one, matched whole-word (a substring test puts
// `ali` inside `Australia`), and it already carries the scars -- `naayf` was
// once in both its lists, cancelled to zero, and got cast at random. A second
// copy here is how that happens again.
import { genderOf, type VoiceLike } from '@/components/newscast/newscastEngine';
import { FIGURES, type Gender as FigureGender } from '@/stage3d/figures';

export type ActorId = 'marcus' | 'sara' | 'david' | 'emma' | 'sophia' | 'james';
export type Gender = FigureGender;

export interface Actor {
    id: ActorId;
    /** Shown on the tile, and spoken by the interviewer when introducing themself. */
    name: string;
    gender: Gender;
}

/**
 * Derived from the 3D cast rather than written out again.
 *
 * `figures.ts` also holds the two newscast anchors, who are deliberately NOT
 * meeting seats — a reader who uses both products should not be interviewed by
 * the person who read them the news — so the six are named here and looked up
 * there. A figure that disappears from `figures.ts` therefore fails the build
 * here rather than rendering an empty tile.
 */
const MEETING_IDS: readonly ActorId[] = ['marcus', 'sara', 'david', 'emma', 'sophia', 'james'];

export const ACTORS: readonly Actor[] = MEETING_IDS.map(id => {
    const figure = FIGURES.find(f => f.id === id);
    if (!figure) throw new Error(`figures.ts has no entry for actor ${id}`);
    return { id, name: figure.name, gender: figure.gender };
});

const BY_ID = new Map<ActorId, Actor>(ACTORS.map(a => [a.id, a]));

export function isActorId(id: string): id is ActorId {
    return BY_ID.has(id as ActorId);
}

/** Throws rather than returning undefined: a seat with no actor is a blank tile. */
export function actorById(id: ActorId): Actor {
    const found = BY_ID.get(id);
    if (!found) throw new Error(`unknown actor: ${id}`);
    return found;
}

// ─────────────────────────── the Toastmasters room ───────────────────────────

/**
 * One seat at the meeting table, in the order the grid renders them.
 *
 * `key` is what the session code already calls each bot and what the backend
 * already answers to (`toastmaster`, `timer`, `ah`, …) — renaming those would
 * be a change to app 27's request bodies for no gain. The names attached to
 * them are not free either: app 27's prompts introduce each role by name
 * ("Hi, I'm Emma"), so the face on the tile and the name in the sentence have
 * to be the same person.
 */
export interface Seat {
    key: string;
    actor: ActorId;
    emoji: string;
    role: string;
}

export const SEATS: readonly Seat[] = [
    { key: 'toastmaster', actor: 'marcus', emoji: '🎙️', role: 'Toastmaster' },
    { key: 'timer', actor: 'sara', emoji: '⏱️', role: 'Timer' },
    { key: 'ah', actor: 'david', emoji: '🗣️', role: 'Ah-Counter' },
    { key: 'grammarian', actor: 'emma', emoji: '✍️', role: 'Grammarian' },
    { key: 'speechEval', actor: 'sophia', emoji: '📋', role: 'Speech Evaluator' },
    { key: 'generalEval', actor: 'james', emoji: '🎯', role: 'General Evaluator' },
];

export function seatByKey(key: string): Seat | null {
    return SEATS.find(s => s.key === key) || null;
}

/** `🎙️ Marcus — Toastmaster`, the caption under the tile. */
export function seatLabel(seat: Seat): string {
    return `${seat.emoji} ${actorById(seat.actor).name} — ${seat.role}`;
}

/**
 * The gender of the person in each seat, which is what casts their voice.
 *
 * Derived from the cast rather than written down again: the session view used to
 * carry its own `BOT_GENDERS` map, and a map that agrees with the pictures only
 * by coincidence is one that stops agreeing the first time a seat is recast.
 */
export function seatGenders(): Record<string, Gender> {
    return Object.fromEntries(SEATS.map(s => [s.key, actorById(s.actor).gender]));
}

// ──────────────────────────── the job interview ────────────────────────────

export type InterviewType = 'HR' | 'Technical';

export const INTERVIEWER_TITLES: Record<InterviewType, { emoji: string; title: string }> = {
    HR: { emoji: '🤝', title: 'HR Manager' },
    Technical: { emoji: '🛠️', title: 'Technical Interviewer' },
};

export function interviewerLabel(actor: Actor, type: InterviewType): string {
    const t = INTERVIEWER_TITLES[type] || INTERVIEWER_TITLES.Technical;
    return `${t.emoji} ${actor.name} — ${t.title}`;
}

/**
 * Cast the interviewer for one session, at random from the whole six.
 *
 * Deliberately not filtered by interview type. The two personas app 27 shipped
 * with were a man for Technical and a woman for HR, which is a stereotype the
 * randomness is worth being rid of, and either title reads correctly on any of
 * the six.
 *
 * `rand` is injectable so the check can walk the whole range and prove the
 * picker only ever returns a real actor -- a bad index here is an interview
 * conducted by a blank tile.
 */
export function pickInterviewer(rand: () => number = Math.random): Actor {
    const n = ACTORS.length;
    const i = Math.min(n - 1, Math.max(0, Math.floor(rand() * n)));
    return ACTORS[i];
}

// ────────────────────────────── voice casting ──────────────────────────────

export interface CastVoice {
    voice: VoiceLike | null;
    /**
     * False when the browser had no voice of the right gender and one of the
     * other gender was used anyway.
     *
     * The caller is expected to act on this rather than ignore it -- a man
     * speaking in a woman's voice is the single most-reported fault on the
     * newscast, four separate times, and every one of them was a fallback that
     * substituted silently instead of saying what it had done.
     */
    matched: boolean;
    /**
     * False when the device has no voice for this LANGUAGE at all.
     *
     * A different and much worse condition than `matched: false`, and keeping
     * them apart is the whole reason this field exists.
     *
     * `matched: false` is cosmetic -- the wrong gender, compensated with a pitch
     * shift. `languageAvailable: false` means the room cannot speak: there is no
     * Arabic voice on a stock Windows install and no Chinese one on many Linux
     * builds, so the interviewer would be silent. The caller must NOT substitute
     * a voice from another language, because an explicitly assigned
     * `utterance.voice` overrides `utterance.lang` -- an English engine handed
     * Arabic characters reads them with English phonetics, which is noise rather
     * than an accent, and was reported on the newscast as "it reads mixed
     * words". It must either leave `utterance.voice` unset and let the platform
     * match on `lang` (which often reaches an OS voice `getVoices()` never
     * listed) or hand the line to app 36's server engine.
     */
    languageAvailable: boolean;
}

/**
 * A voice for a speaker of the given gender, in the given language.
 *
 * `seat` spreads the six around the available voices, so a meeting is not read
 * by one voice wearing six name tags. Where the browser has no voice of the
 * right gender at all -- common: a stock Windows install has two English voices
 * and one is Zira -- a voice is still returned, because the alternative is a
 * silent meeting, and `matched: false` tells the caller to compensate.
 *
 * Where it has no voice for the LANGUAGE, `voice` is null and
 * `languageAvailable` is false. See that field: those two cases want completely
 * different handling and used to be indistinguishable, because this function
 * filtered on a hardcoded `'en'` and therefore could not tell "this device has
 * no English voice" (rare) from "this device has no Arabic voice" (usual).
 *
 * The prefix match is deliberately loose: `ar-EG`, `ar-SA`, `zh-CN` and `zh-TW`
 * are all usable voices for `ar` / `zh`, and an exact-tag rule would find none
 * of them and leave the reader in silence.
 */
export function castVoice(
    voices: VoiceLike[],
    gender: Gender,
    seat = 0,
    locale = 'en',
): CastVoice {
    const prefix = (locale || 'en').toLowerCase().split('-')[0];
    const inLanguage = voices.filter(v => (v.lang || '').toLowerCase().startsWith(prefix));
    if (!inLanguage.length) return { voice: null, matched: false, languageAvailable: false };

    const wanted = inLanguage.filter(v => genderOf(v) === gender);
    const pool = wanted.length ? wanted : inLanguage;
    const index = ((seat % pool.length) + pool.length) % pool.length;
    return { voice: pool[index], matched: wanted.length > 0, languageAvailable: true };
}

/**
 * How far to bend the pitch when the voice we got is the wrong gender.
 *
 * Not a flourish: with only female voices installed, every male seat in the
 * meeting is a woman, and the room stops reading as six different people. A
 * shift cannot make a female voice into a male one -- the newscast needed a
 * resampler for that -- but it does keep the seats distinguishable, and it is
 * applied only when {@link castVoice} reports a mismatch, never as a blanket
 * adjustment.
 */
export function pitchFor(gender: Gender, matched: boolean): number {
    if (matched) return gender === 'male' ? 0.95 : 1.05;
    return gender === 'male' ? 0.7 : 1.25;
}
