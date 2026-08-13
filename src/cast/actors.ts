/**
 * The six people who appear in the Toastmasters meeting room and conduct the
 * mock job interviews.
 *
 * They used to be hand-drawn SVG faces with a CSS-animated mouth. They are now
 * filmed: an idle photograph for a seat that is listening, and a looping clip
 * for the one that is speaking. Two things about that are load-bearing:
 *
 * * **Both assets of a speaker are cut to the SAME square.** The supplied files
 *   were not: 1950x1064 clips against stills from 586x293 to 865x517, framed
 *   differently from each other. Cropped independently -- which is what
 *   `object-fit: cover` does on its own -- the person changes size and position
 *   the instant they stop talking, and a video tile that does that reads as
 *   broken rather than as a cut. The square each pair shares was solved
 *   numerically (see `_tmwork/analyze.py` in the workspace root, kept out of the
 *   repo) and every output is exactly {@link TILE_PX} square, which is what lets
 *   the six be laid out as one interchangeable grid.
 *
 * * **The speaking clips loop, and the loop was built rather than found.** None
 *   of the six sources loops: each ends on a frame two to five times more
 *   different from its first frame than two consecutive frames are. A speaking
 *   loop runs for as long as the person talks, so that would jump several times
 *   per answer.
 *
 * This module is plain -- no Vue, no DOM, no asset imports -- for the same
 * reason `appNav.ts`, `linkify.ts` and `newscastEngine.ts` are: it is the half
 * that can be checked in node, by `npm run check:actors`. Asset URLs are
 * resolved in {@link ./actorAssets} and file NAMES are named here, exactly as
 * `appNav.ts` names an icon that the component draws.
 */

// One table of voice names, not two. Which voice is male and which is female
// has no field in the Web Speech API and has to be guessed from the name; the
// newscast's table is the curated one, matched whole-word (a substring test puts
// `ali` inside `Australia`), and it already carries the scars -- `naayf` was
// once in both its lists, cancelled to zero, and got cast at random. A second
// copy here is how that happens again.
import { genderOf, type VoiceLike } from '@/components/newscast/newscastEngine';

export type ActorId = 'marcus' | 'sara' | 'david' | 'emma' | 'sophia' | 'james';
export type Gender = 'male' | 'female';

/** Every asset, of both kinds, is this square. `check:actors` reads the files. */
export const TILE_PX = 512;

export interface Actor {
    id: ActorId;
    /** Shown on the tile, and spoken by the interviewer when introducing themself. */
    name: string;
    gender: Gender;
    /** Filenames under `src/assets/actors/`, resolved by `actorAssets.ts`. */
    idleFile: string;
    speakFile: string;
}

export const ACTORS: readonly Actor[] = [
    { id: 'marcus', name: 'Marcus', gender: 'male', idleFile: 'marcus_idle.webp', speakFile: 'marcus_speak.mp4' },
    { id: 'sara', name: 'Sara', gender: 'female', idleFile: 'sara_idle.webp', speakFile: 'sara_speak.mp4' },
    { id: 'david', name: 'David', gender: 'male', idleFile: 'david_idle.webp', speakFile: 'david_speak.mp4' },
    { id: 'emma', name: 'Emma', gender: 'female', idleFile: 'emma_idle.webp', speakFile: 'emma_speak.mp4' },
    { id: 'sophia', name: 'Sophia', gender: 'female', idleFile: 'sophia_idle.webp', speakFile: 'sophia_speak.mp4' },
    { id: 'james', name: 'James', gender: 'male', idleFile: 'james_idle.webp', speakFile: 'james_speak.mp4' },
];

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
}

/**
 * An English voice for a speaker of the given gender.
 *
 * `seat` spreads the six around the available voices, so a meeting is not read
 * by one voice wearing six name tags. Where the browser has no voice of the
 * right gender at all -- common: a stock Windows install has two English voices
 * and one is Zira -- a voice is still returned, because the alternative is a
 * silent meeting, and `matched: false` tells the caller to compensate.
 */
export function castVoice(voices: VoiceLike[], gender: Gender, seat = 0): CastVoice {
    const english = voices.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
    if (!english.length) return { voice: null, matched: false };

    const wanted = english.filter(v => genderOf(v) === gender);
    const pool = wanted.length ? wanted : english;
    const index = ((seat % pool.length) + pool.length) % pool.length;
    return { voice: pool[index], matched: wanted.length > 0 };
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
