/**
 * WHO the people are, HOW they are proportioned, and HOW they move.
 *
 * This is the half of the 3D cast that has no Babylon in it — no engine, no
 * mesh, no DOM — for exactly the reason `appNav.ts`, `linkify.ts`,
 * `drawEngine.ts` and `newscastEngine.ts` are plain: it is the half that can be
 * driven in node, by `npm run check:actors`, and every mistake in it is one
 * nobody can see by looking at a still frame.
 *
 * ============================================================
 * WHY THERE ARE NO PICTURES ANY MORE
 * ============================================================
 *
 * The six meeting seats, the interviewer and the two anchors used to be filmed
 * media: an idle WebP and a looping MP4 each, re-encoded from GIFs that were
 * 97–110 MB apiece. It worked, and it had three faults that no amount of
 * re-cutting fixes:
 *
 *  1. **A clip is a fixed performance.** Somebody who is "speaking" is playing
 *     back a loop that has nothing to do with the sentence being spoken, so the
 *     mouth stops when the loop wraps and carries on after the anchor has
 *     finished. Every viewer reads that as a video of somebody else with audio
 *     laid over it, which is exactly what it was.
 *  2. **The framing is baked in.** The plates had to be solved numerically
 *     against each other — scale-and-offset searches, a 26px lift of one pair
 *     against another, seam strips with masked `backdrop-filter` to dissolve
 *     the joins between three photographs of "one" room. All of that is
 *     geometry a renderer does for free and exactly.
 *  3. **They cannot react.** No eye contact, no gesture on a stressed word, no
 *     turn toward the co-presenter at a handover, and no relationship at all to
 *     the amplitude of the audio actually playing.
 *
 * The cast is built at runtime now and animated against the speech itself —
 * against the real waveform when the line came from the server engine (see
 * `speechAudio.ts`), and against a syllable model when it came from the
 * device's own synthesiser, which exposes no audio to read.
 *
 * ============================================================
 * WHAT LIVES HERE
 * ============================================================
 *
 *  * {@link FIGURES} and {@link ANCHOR_FIGURES} — the eight people, as data.
 *  * {@link proportionsFor} — one table of body measurements, in metres, so a
 *    figure is scaled rather than modelled twice.
 *  * the movement functions — pure `(time, phase, energy) => number`. Pure,
 *    because "does the mouth ever stick open", "do all six blink together" and
 *    "does a silent figure mouth anything" are questions with exact answers,
 *    and a check can ask them over an hour of simulated time in a millisecond
 *    of real time.
 *
 * Every function takes `t` in SECONDS and a per-figure `phase`, and not one of
 * them reads a clock. Two figures given different phases can never fall into
 * step — the lesson the newscast learned when both anchors breathed on the same
 * 5.04 s cycle and the studio read as a screensaver.
 */

export type Gender = 'male' | 'female';

/** Every hairstyle the builder knows how to make. */
export type HairStyle = 'crop' | 'fade' | 'wave' | 'bob' | 'long' | 'bun';

export interface Outfit {
    /** Jacket / blazer shell. */
    jacket: string;
    /** Shirt or blouse under it. */
    shirt: string;
    /** Tie, scarf or lapel pin — the one saturated colour a person carries. */
    accent: string;
}

export interface FigureSpec {
    id: string;
    /** On the name plate, and spoken by the interviewer introducing themself. */
    name: string;
    gender: Gender;
    /** Base albedo of the skin. */
    skin: string;
    /** Hair, brows and lashes. */
    hair: string;
    hairStyle: HairStyle;
    /** Iris. */
    eye: string;
    outfit: Outfit;
    /**
     * 0 slight … 1 broad. Scales shoulder width, neck and waist — the three
     * measurements that actually distinguish two bodies at this distance.
     */
    build: number;
    /** Standing height in metres. Everything else is derived from it. */
    height: number;
    /**
     * Seconds of offset into every idle cycle this person runs.
     *
     * NOT decoration. Six figures breathing, blinking and shifting weight on
     * one clock is the single most obvious way a room of rendered people reads
     * as a screensaver, and it is the fault the newscast shipped first with
     * only two of them.
     *
     * DISTINCT IS NOT ENOUGH: they also have to be SPREAD. The first set was
     * 0, 1.7, 2.6, 3.9, 5.1, 6.4 — eight distinct numbers, two of which land a
     * tenth of a second apart once they are taken modulo the 4.6-second breath
     * cycle, which is close enough to read as two people breathing together.
     * These are 0.6 apart across the whole cycle, and `check:actors` asserts
     * the spacing rather than merely the distinctness.
     */
    phase: number;
}

/**
 * The cast, in the order the meeting seats them.
 *
 * The ids and names are unchanged from the filmed version and must stay that
 * way: app 27's prompts introduce each role by name ("Hi, I'm Emma"), the
 * session bodies key on the seat, and the results screens store them.
 */
export const FIGURES: readonly FigureSpec[] = [
    {
        id: 'marcus', name: 'Marcus', gender: 'male',
        skin: '#8d5a3b', hair: '#1b1310', hairStyle: 'fade', eye: '#4a2f1d',
        outfit: { jacket: '#26304a', shirt: '#eef2f8', accent: '#b8323c' },
        build: 0.72, height: 1.82, phase: 0,
    },
    {
        id: 'sara', name: 'Sara', gender: 'female',
        skin: '#c88f68', hair: '#241713', hairStyle: 'long', eye: '#3b2416',
        outfit: { jacket: '#5b2f52', shirt: '#f6eef4', accent: '#d98a3a' },
        build: 0.34, height: 1.68, phase: 1.2,
    },
    {
        id: 'david', name: 'David', gender: 'male',
        skin: '#e0b191', hair: '#6b4426', hairStyle: 'crop', eye: '#3f6079',
        outfit: { jacket: '#333a44', shirt: '#e8eef5', accent: '#3f7fbf' },
        build: 0.58, height: 1.78, phase: 2.4,
    },
    {
        id: 'emma', name: 'Emma', gender: 'female',
        skin: '#efc4a4', hair: '#8a5a2b', hairStyle: 'bob', eye: '#4d6b45',
        outfit: { jacket: '#2f4a54', shirt: '#fbf3ea', accent: '#c9556b' },
        build: 0.3, height: 1.66, phase: 3.6,
    },
    {
        id: 'sophia', name: 'Sophia', gender: 'female',
        skin: '#6f4630', hair: '#120c0a', hairStyle: 'bun', eye: '#33201a',
        outfit: { jacket: '#3c2f56', shirt: '#f2eef8', accent: '#e0a13c' },
        build: 0.38, height: 1.71, phase: 0.6,
    },
    {
        id: 'james', name: 'James', gender: 'male',
        skin: '#f0cbaa', hair: '#3a2a1c', hairStyle: 'wave', eye: '#5a6b4a',
        outfit: { jacket: '#3a4152', shirt: '#eaf0f6', accent: '#4a9c7d' },
        build: 0.64, height: 1.86, phase: 1.8,
    },
];

/**
 * The two anchors.
 *
 * Separate from the meeting cast rather than reusing two of them: a bulletin
 * and a mock interview are different products, and a reader who uses both
 * should not have the news read to them by the person who interviewed them
 * yesterday. The names are the ones the Newscast already puts on the plates.
 */
export const ANCHOR_FIGURES: readonly FigureSpec[] = [
    {
        id: 'anchorFemale', name: 'Layla', gender: 'female',
        skin: '#d09a70', hair: '#1a1210', hairStyle: 'long', eye: '#3a2417',
        outfit: { jacket: '#7d1f3d', shirt: '#f8f1f3', accent: '#e8c169' },
        build: 0.33, height: 1.70, phase: 3.0,
    },
    {
        id: 'anchorMale', name: 'Adam', gender: 'male',
        skin: '#b07a4f', hair: '#15100e', hairStyle: 'crop', eye: '#3b2618',
        outfit: { jacket: '#1d2740', shirt: '#f3f7fb', accent: '#9b1f2e' },
        build: 0.66, height: 1.80, phase: 4.2,
    },
];

/*
  The two site assistants live in `./assistants.ts` and are re-exported here.

  Split out for one reason and it is a measured one: `assistantEngine.ts`
  derives the pair from that table, and the engine is reached from the button in
  the top bar of EVERY page — so importing this module for two names put its 48
  kB of movement model in the entry chunk and cost 7.8 kB gzip that a visitor
  reading the login page has no use for (working rule 47).

  Re-exported rather than referenced, so `figureById`, `isFigureId` and
  `check:actors`'s whole-cast sweep need no special case and the renderer
  resolves an assistant exactly as it resolves an anchor.
*/
export { ASSISTANT_FIGURE, ASSISTANT_FIGURES } from './assistants';
import { ASSISTANT_FIGURES as ASSISTANTS_TABLE } from './assistants';

const BY_ID = new Map<string, FigureSpec>(
    [...FIGURES, ...ANCHOR_FIGURES, ...ASSISTANTS_TABLE].map(f => [f.id, f]));

export function isFigureId(id: string): boolean {
    return BY_ID.has(id);
}

/**
 * Throws rather than returning undefined.
 *
 * A seat with no figure is an empty tile in a grid of six, and an `undefined`
 * threaded into the builder crashes three call frames away from the typo.
 */
export function figureById(id: string): FigureSpec {
    const found = BY_ID.get(id);
    if (!found) throw new Error(`unknown figure: ${id}`);
    return found;
}

/* ------------------------------------------------------------------ *
 * Proportions
 * ------------------------------------------------------------------ */

/**
 * One body, in metres.
 *
 * Everything is a FRACTION of standing height rather than an absolute, so a
 * 1.66 m figure and a 1.86 m one are the same person scaled — which is what
 * makes six of them read as six people rather than as six models of differing
 * quality. The ratios are ordinary anatomical canon (head ≈ 1/7.5 of height,
 * shoulder span ≈ 1/4) rather than anything invented here.
 */
export interface Proportions {
    headRadius: number;
    /** Head centre above the ground. */
    headY: number;
    neckRadius: number;
    neckY: number;
    shoulderY: number;
    shoulderHalfWidth: number;
    chestDepth: number;
    waistY: number;
    waistHalfWidth: number;
    hipY: number;
    upperArm: number;
    foreArm: number;
    /** Radius of the upper arm at the shoulder. */
    armRadius: number;
    handLength: number;
    /**
     * Across the knuckles, and the length of the fingers off them.
     *
     * Here rather than in the builder because `check:actors` has to be able to
     * ask whether a hand is a hand: four fingers of a plausible span, off a palm
     * of a plausible width, at every height in the cast. The figures were built
     * with a hand that was one capsule and one thumb -- a mitten -- and at the
     * newscast desk, which is the one shot where the hands are unoccluded and
     * near the camera, that is the second thing a viewer notices after the face.
     */
    palmWidth: number;
    fingerLength: number;
}

export const NOMINAL_HEIGHT = 1.75;

/**
 * `build` widens the frame without lengthening it.
 *
 * Two figures of the same height differ at the shoulders, the neck and the
 * waist and almost nowhere else that reads from three metres away. Applying it
 * to LENGTH as well is what produces the "one model at different scales" look,
 * which is worse than no variation at all.
 */
export function proportionsFor(spec: FigureSpec): Proportions {
    const h = spec.height;
    const k = h / NOMINAL_HEIGHT;
    const broad = 0.86 + spec.build * 0.30;          // 0.86 … 1.16
    const female = spec.gender === 'female';

    return {
        /*
          Half the HEIGHT of a head, and it was 15% too small.

          At 0.098 the head came out 9.3 into standing height; anatomical canon
          is between seven and eight, and the difference is exactly the thing
          that made the first renders read as a small head on a broad body. Every
          feature is derived from this one number, so the face scaled with it and
          nothing else had to move.
        */
        headRadius: 0.112 * k * (female ? 0.97 : 1),
        headY: 0.932 * h,
        neckRadius: 0.044 * k * (0.90 + spec.build * 0.24),
        neckY: 0.868 * h,
        shoulderY: 0.818 * h,
        /*
          Shoulder span is a QUARTER of standing height on a broad male frame,
          and this reads narrower than that on purpose. The first render came
          out as two busts with pot-shaped bodies: at 0.116 the span was 0.44 m
          against a 0.13 m head, and while that ratio is anatomically right it
          is wrong for the shot, because the deltoids and the jacket add to the
          silhouette and the head does not. What the eye reads as "correct" here
          is closer to three head-widths than three and a half.
        */
        shoulderHalfWidth: 0.104 * h * broad * (female ? 0.93 : 1),
        chestDepth: 0.082 * h * (female ? 0.97 : 1) * (0.92 + spec.build * 0.20),
        waistY: 0.620 * h,
        waistHalfWidth: 0.082 * h * (female ? 0.86 : 0.98) * (0.90 + spec.build * 0.24),
        hipY: 0.530 * h,
        upperArm: 0.172 * h,
        foreArm: 0.157 * h,
        armRadius: 0.032 * h * (0.90 + spec.build * 0.26),
        handLength: 0.108 * h,
        /*
          A hand is about as wide across the knuckles as the palm is long, and
          the fingers are a little under half its total length. Both scale with
          `broad` because a heavier frame has heavier hands, and neither scales
          with `female` -- the difference is real and it is smaller than the
          difference between two people of the same sex, so encoding it would be
          a stereotype doing the work of an anatomical fact.
        */
        palmWidth: 0.048 * h * (0.92 + spec.build * 0.16),
        fingerLength: 0.046 * h,
    };
}

/* ------------------------------------------------------------------ *
 * Movement
 *
 * Every function below is pure and deterministic: `(t, phase, …) => number`.
 * None keeps state, none reads a clock, and none uses `Math.random()` — so a
 * check can run a figure through an hour of simulated time and assert the mouth
 * never sticks, the eyes always reopen, and a silent figure never mouths
 * anything at all.
 * ------------------------------------------------------------------ */

/** Deterministic 0..1 from an integer. Only ever used to space events out. */
export function hash01(n: number): number {
    let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Smoothstep, clamped. */
export function smooth(edge0: number, edge1: number, x: number): number {
    if (edge1 === edge0) return x < edge0 ? 0 : 1;
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export function clamp01(x: number): number {
    return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Breathing. 0 at rest, 1 at the top of an inhale.
 *
 * Drives the chest scale and a small lift of the shoulders, and it is the
 * cheapest single thing that stops a figure reading as a statue. It is applied
 * even under `prefers-reduced-motion`, at a reduced amplitude: somebody who has
 * asked for less motion has not asked to be shown a corpse.
 */
export const BREATH_PERIOD = 4.6;

export function breath(t: number, phase = 0): number {
    return 0.5 - 0.5 * Math.cos((2 * Math.PI * (t + phase)) / BREATH_PERIOD);
}

/**
 * Idle sway — the weight shift and micro-drift of somebody sitting still.
 *
 * Incommensurable periods, so the pose never exactly repeats. Radians for the
 * head, metres for the body, and both tiny: the whole range is under two
 * degrees and under a centimetre, which is below "something is moving" and
 * above "this is a photograph".
 */
export interface Sway {
    /** Head yaw, radians. */
    headYaw: number;
    /** Head pitch, radians. */
    headPitch: number;
    /** Head roll, radians. */
    headRoll: number;
    /** Torso lateral drift, metres. */
    lean: number;
}

export function sway(t: number, phase = 0): Sway {
    const u = t + phase;
    return {
        // 0.032 rad at the extreme, which is 1.8 degrees — the file says "under
        // two degrees" and `check:actors` holds it to that. At 0.030 + 0.012 it
        // was 2.4, which is not much and was not what the comment claimed.
        headYaw: 0.022 * Math.sin(u * 0.37) + 0.010 * Math.sin(u * 0.91 + 1.3),
        headPitch: 0.018 * Math.sin(u * 0.53 + 0.7) + 0.008 * Math.sin(u * 1.27),
        headRoll: 0.014 * Math.sin(u * 0.29 + 2.1),
        lean: 0.006 * Math.sin(u * 0.23 + 0.4),
    };
}

/* ---- blinking ---- */

/** Lid down and up. The human average is 100–150 ms. */
export const BLINK_MS = 130;
/**
 * Shortest and longest gap between blinks, in seconds.
 *
 * These are a CONTRACT, not a hint, and the first version broke it. It placed
 * one blink per `BLINK_MAX_GAP` slot at an offset of up to
 * `MIN + 0.85 * (MAX - MIN)` = 5.8 s — so a blink late in one slot and one early
 * in the next could be 0.6 s apart, which is a double blink rather than two
 * blinks. Bounding the offset by `MAX - MIN` is what makes the guarantee hold:
 * consecutive blinks are then at least `MIN` and at most `2 * MAX - MIN` apart.
 *
 * A 4.6 s slot puts the rate near thirteen a minute, which is inside the human
 * range of ten to twenty at rest.
 */
export const BLINK_MIN_GAP = 2.0;
export const BLINK_MAX_GAP = 4.6;

/**
 * How closed the eyelids are at `t`. 0 fully open, 1 fully shut.
 *
 * The schedule is DERIVED from the time rather than stored, so it costs no
 * state, it is seekable — a check can ask about t = 3600 s without simulating
 * an hour — and two figures with different phases never blink together. A room
 * where six people blink in unison is uncanny in a way that is hard to name and
 * impossible to miss.
 */
export function blink(t: number, phase = 0): number {
    const u = t + phase * 7.3;
    const slot = Math.floor(u / BLINK_MAX_GAP);
    let closed = 0;
    // This slot and the one before it: a blink landing near a slot boundary
    // would otherwise be cut in half.
    for (let s = slot - 1; s <= slot; s++) {
        // Offset bounded by (MAX - MIN), so the gap between consecutive blinks
        // is bounded too. See the constants.
        const at = s * BLINK_MAX_GAP
            + (BLINK_MAX_GAP - BLINK_MIN_GAP) * hash01(s * 2654435761);
        const dt = u - at;
        const dur = BLINK_MS / 1000;
        if (dt < 0 || dt > dur) continue;
        // Down fast, up slower. That asymmetry is what a blink looks like.
        const x = dt / dur;
        const shape = x < 0.42 ? smooth(0, 0.42, x) : 1 - smooth(0.42, 1, x);
        if (shape > closed) closed = shape;
    }
    return clamp01(closed);
}

/* ---- speech ---- */

/**
 * How far the jaw is open at `t` while speaking. 0 shut … 1 wide.
 *
 * `energy` is the loudness of the audio right now, 0…1. When the line came from
 * the server engine that is a real reading off an `AnalyserNode` — see
 * `speechAudio.ts` — and the mouth genuinely tracks the words. When it came
 * from the device's own `speechSynthesis`, which exposes no audio whatsoever,
 * the caller passes a nominal energy and the syllable model below carries it.
 *
 * The model is three incommensurable rates around 4 Hz, which is roughly the
 * syllable rate of connected speech in every language this platform serves,
 * under a slower phrase envelope so the mouth rests at clause boundaries. One
 * sine at one rate is the thing that reads as a puppet.
 *
 * **`energy <= 0` returns exactly 0.** A figure who is not speaking must not
 * mouth anything, and "almost closed" is visible from across a room: it reads
 * as chewing.
 */
export function jawOpen(t: number, phase = 0, energy = 1): number {
    if (!(energy > 0)) return 0;
    const u = (t + phase * 3.1) * 2 * Math.PI;
    const syllable =
        0.50 * Math.sin(u * 4.10)
        + 0.28 * Math.sin(u * 6.70 + 1.1)
        + 0.16 * Math.sin(u * 9.30 + 2.4);
    // Half-wave rectified: a jaw does not open past shut in the other direction.
    const open = Math.max(0, syllable);
    const phrase = 0.68 + 0.32 * Math.max(0, Math.sin((t + phase) * 0.83));
    /*
      ============================================================
      1.9, NOT 1.25 — THE MOUTH WAS MOVING AND NOBODY COULD SEE IT
      ============================================================

      The three sines above sum to 0.94 at their theoretical peak and they are
      incommensurable, so they almost never all line up: the RMS of the sum is
      0.42, which is what a TYPICAL syllable reaches. Through the old gain that
      came out at `0.42 x 0.8 x 0.72 x 1.25 = 0.30`, and 0.30 drove the jaw
      through 0.30 rad of travel to **five degrees**. Measured over a minute, the
      jaw was past a quarter open for 18% of the time and past half open for
      about 8%.

      So it was technically animating and visually still — and at the size these
      figures are actually rendered (a 180 px meeting tile, a presenter 16% of
      the frame height) five degrees of jaw is nothing at all. Reported as "human
      bots should interact and move mouth when speaking", which was two faults:
      the energy never arriving (see `spokenEnergy`) and, underneath it, this.

      The peak is unchanged — `clamp01` still caps at 1 — so what the extra gain
      buys is the MIDDLE of the distribution, which is where a mouth spends its
      time. The floor of the phrase envelope came up with it for the same
      reason: a mouth should rest at a clause boundary, not go quiet for a
      second and a half.
    */
    return clamp01(open * phrase * Math.min(1, energy) * 1.9);
}

/**
 * How spread the lips are. 0 rounded … 1 wide.
 *
 * Two mouth shapes is not phoneme-accurate lip sync and is not pretending to
 * be — that needs the text, a phonemiser per language, and timing marks the Web
 * Speech API does not provide. What it buys is that the mouth is not a hinge: a
 * jaw that only opens and shuts reads as a nutcracker, and one more degree of
 * freedom moving at a different rate is most of the way to reading as speech.
 */
export function lipSpread(t: number, phase = 0, energy = 1): number {
    if (!(energy > 0)) return 0.12;
    const u = (t + phase * 5.7) * 2 * Math.PI;
    return clamp01(0.5 + 0.42 * Math.sin(u * 2.9 + 0.6) * Math.min(1, energy));
}

/**
 * Eyebrow lift while speaking. 0 rest … 1 raised.
 *
 * Stress lands on the brow before it lands anywhere else, so this is what makes
 * a talking figure look like it means the sentence. Deliberately slow — a brow
 * tracking the syllable rate is a cartoon.
 */
export function browRaise(t: number, phase = 0, energy = 1): number {
    if (!(energy > 0)) return 0.06 * breath(t, phase);
    const u = t + phase * 2.3;
    // Deeper than it was, for the reason `jawOpen`'s gain went up: at a 180 px
    // tile a brow that travels two millimetres is a brow that does not move.
    return clamp01(0.20 + 0.62 * Math.max(0, Math.sin(u * 1.31 + 0.9))
        * Math.min(1, energy));
}

/**
 * The small nod on a stressed word, in radians of extra pitch.
 *
 * ADDED to the idle sway rather than replacing it, so a speaking figure keeps
 * drifting like a person instead of switching to a different animation.
 */
export function headEmphasis(t: number, phase = 0, energy = 1): number {
    if (!(energy > 0)) return 0;
    const u = t + phase * 1.9;
    /*
      Four and a half degrees at the extreme rather than two and a half. A nod
      on a stressed word is the most legible thing a talking head does at
      distance — more legible than the mouth, because it moves the whole
      silhouette — and it was pitched below the threshold where a viewer reads
      it as deliberate.
    */
    return 0.075 * Math.sin(u * 2.7 + 0.5) * Math.min(1, energy)
        + 0.030 * Math.sin(u * 1.1);
}

/**
 * Hand gesture amplitude. 0 hands at rest … 1 mid-gesture.
 *
 * Somebody who talks with their face and not their hands is the last tell, and
 * the one that survives every other improvement. `since` is seconds since this
 * line started: it ramps in over a second so hands do not snap up on the first
 * syllable, and it returns exactly 0 the moment the line ends so nobody is left
 * frozen mid-point.
 */
export function gesture(t: number, phase = 0, energy = 1, since = 999): number {
    if (!(energy > 0)) return 0;
    const ramp = smooth(0, 1.1, since);
    const u = t + phase * 4.4;
    const wave = 0.5 + 0.5 * Math.sin(u * 1.17 + 0.3);
    return clamp01(ramp * wave * Math.min(1, energy));
}

/* ---- reaching, and looking at the script ---- */

/**
 * The two arm angles that put a hand at a point. Radians.
 *
 * `shoulder` and `elbow` are both measured as a FORWARD swing from hanging
 * straight down, which is the rig's own convention (see `human.ts`): the upper
 * arm points along -Y at zero and rotates toward +Z as the angle grows.
 */
export interface ArmReach {
    shoulder: number;
    elbow: number;
    /** False when the target is out of reach and the arm is extended toward it. */
    reached: boolean;
}

/**
 * Two-link inverse kinematics in the sagittal plane.
 *
 * ============================================================
 * WHY THIS IS SOLVED AND NOT DIALLED IN
 * ============================================================
 *
 * The two anchors have to rest their hands on the desk, holding a script. The
 * obvious way to do that is to try shoulder and elbow angles until the render
 * looks right — and that is a pair of magic numbers that are correct for exactly
 * one figure. There are two anchors of different heights and six meeting seats
 * spanning 1.66 m to 1.86 m, so every arm length in the cast is different, and a
 * hand that misses the desk by three centimetres either hovers or goes through
 * it. Both read as broken in a way a viewer cannot name.
 *
 * The angles are therefore DERIVED from the target and the figure's own arm
 * lengths, and `check:actors` asserts that the hand lands where it was asked to
 * for every figure in the cast — which is a thing a screenshot cannot tell you
 * and a rendered frame can only show you one of.
 *
 * `dy` and `dz` are the target relative to the SHOULDER: `dy` negative for a
 * point below it, `dz` positive for a point in front. `upper` and `fore` are the
 * two segment lengths.
 *
 * The elbow bends BACKWARD (the hand comes up under it), which is the only one
 * of the two solutions a human arm has when reaching forward and down.
 */
export function reachPitch(
    dy: number, dz: number, upper: number, fore: number,
): ArmReach {
    const span = Math.hypot(dy, dz);
    const reach = upper + fore;
    const shortest = Math.abs(upper - fore);
    // Out of reach: point the whole arm at the target rather than returning
    // NaN. A straight arm aimed at a desk it cannot touch is wrong by
    // centimetres; an unsolvable triangle is wrong by a whole figure, because
    // `Math.acos` of anything outside [-1, 1] is NaN and a NaN in a rotation
    // silently removes the mesh from the frame.
    const clamped = Math.min(reach - 1e-4, Math.max(shortest + 1e-4, span));

    /* The angle of the target itself, from straight-down toward the front. */
    const toTarget = Math.atan2(dz, -dy);
    /* The interior angle at the elbow, from the law of cosines. */
    const interior = Math.acos(
        Math.min(1, Math.max(-1, (upper * upper + fore * fore - clamped * clamped)
            / (2 * upper * fore))));
    /* How far the upper arm sits off the straight line to the target. */
    const offset = Math.acos(
        Math.min(1, Math.max(-1, (clamped * clamped + upper * upper - fore * fore)
            / (2 * clamped * upper))));

    return {
        shoulder: toTarget - offset,
        elbow: Math.PI - interior,
        reached: span <= reach && span >= shortest,
    };
}

/**
 * Where a hand ends up for a given pair of angles. The inverse of the above.
 *
 * Exists so `check:actors` can verify the solver by putting its answer back
 * through the forward kinematics rather than by re-deriving the same arithmetic
 * a second time — which would only prove the two copies agree.
 */
export function handOffset(
    reach: ArmReach, upper: number, fore: number,
): { dy: number; dz: number } {
    const a = reach.shoulder;
    const b = reach.shoulder + reach.elbow;
    return {
        dy: -upper * Math.cos(a) - fore * Math.cos(b),
        dz: upper * Math.sin(a) + fore * Math.sin(b),
    };
}

/**
 * How long an anchor looks down at their script before lifting their eyes.
 *
 * A real presenter reads the top of a story off the page and then delivers it to
 * camera; they do not begin a sentence already staring down the lens. Under a
 * second, because any longer and the viewer starts wondering whether the shot
 * is broken.
 */
export const SCRIPT_GLANCE_SECONDS = 0.85;

/** How often a presenter dips back to the page mid-story, in seconds. */
export const SCRIPT_REGLANCE_PERIOD = 13;

/**
 * How much an anchor is looking at their script rather than at the lens.
 * 1 fully at the page, 0 fully at the camera.
 *
 * `since` is seconds since this line started. The shape is: down for the first
 * part of {@link SCRIPT_GLANCE_SECONDS}, easing up to the lens by the end of it,
 * and then an occasional brief dip so the presenter does not read a
 * ninety-second bulletin without once looking at the page in front of them.
 *
 * Pure and seekable like everything else here, so the check can assert both
 * halves: that a line STARTS on the page, and that it does not stay there.
 */
export function scriptGlance(since: number, energy = 1): number {
    if (!(energy > 0)) return 0;
    if (since < 0) return 0;
    if (since < SCRIPT_GLANCE_SECONDS) {
        // Hold, then lift. The lift is the interesting half: a linear ramp
        // reads as a machine, and a head has mass.
        return 1 - smooth(SCRIPT_GLANCE_SECONDS * 0.45, SCRIPT_GLANCE_SECONDS, since);
    }
    /*
      The mid-story dip. Deliberately shallow — 0.45 rather than 1 — because a
      presenter checking their page does not take their attention off the camera,
      they flick down and back. At full weight it reads as losing their place.
    */
    const phase = (since - SCRIPT_GLANCE_SECONDS) % SCRIPT_REGLANCE_PERIOD;
    const dip = 0.55;
    if (phase > dip) return 0;
    return 0.45 * Math.sin((phase / dip) * Math.PI);
}

/* ---- energy, when there is no audio to measure ---- */

/**
 * How loud to pretend a line is when the engine will not let us listen.
 *
 * ============================================================
 * WHY THIS EXISTS: THE MOUTHS ONLY MOVED IN ARABIC
 * ============================================================
 *
 * Reported as "Volume and voices work fine but no interactions in other
 * languages — the anchors should interact, not just in Arabic", and the language
 * was a red herring. What differs is the ROUTE.
 *
 * A line goes out one of two ways (see `roomSpeech.ts`). The SERVER route plays
 * an MP3 through Web Audio, so there is an `AnalyserNode` on the output and the
 * energy is a real reading off the real waveform. The DEVICE route is
 * `speechSynthesis`, which exposes **no audio whatsoever** — no node, no buffer,
 * no level — so there is nothing to read.
 *
 * Arabic takes the server route on almost every machine, because a stock Windows
 * install has no Arabic voice. English takes the device route. So every mouth on
 * the platform moved in Arabic and sat shut in English — and since
 * {@link jawOpen} returns EXACTLY 0 at zero energy (deliberately: "almost
 * closed" reads as chewing), the figures did not move their lips, their brows,
 * their hands or their heads. They breathed and blinked, which is worse than
 * nothing: it looks like a person deciding not to speak.
 *
 * All three rooms had the same shape of bug and none of them was quite the same:
 * the Newscast never called its energy tracker on the device path at all, and
 * the two rooms called theirs with a flag that means "can this BROWSER measure
 * audio" where the question is "is THIS CLIP being measured". A browser with Web
 * Audio playing a `speechSynthesis` line answers yes to the first and no to the
 * second, so both rooms polled an analyser with nothing connected to it and got
 * a steady zero.
 */
export const NOMINAL_SPEECH_ENERGY = 0.72;

/**
 * The floor between words, once we know the engine reports word boundaries.
 *
 * Not zero. A gap between two words is a fifth of a second and the mouth does
 * not fully close in one — it closes at the end of a CLAUSE, which is what
 * `jawOpen`'s phrase envelope already does. Dropping to zero per word is a
 * chattering jaw, which is the classic bad lip-sync.
 */
export const BOUNDARY_FLOOR = 0.5;

/** How long a word's pulse takes to fall back to the floor, in seconds. */
export const BOUNDARY_PULSE_SECONDS = 0.22;

/**
 * A stand-in loudness for a line the browser will not let us hear.
 *
 * `sinceBoundary` is seconds since `SpeechSynthesisUtterance.onboundary` last
 * fired, or a non-finite value when this engine has never fired one.
 *
 * Two behaviours, and the fallback is the important one:
 *
 *  * **No boundaries** — Safari fires none for remote voices, and several
 *    engines fire none at all — so the answer is a steady
 *    {@link NOMINAL_SPEECH_ENERGY} and the syllable model in {@link jawOpen}
 *    supplies every bit of the movement. That is the difference between good lip
 *    movement and excellent, not between working and broken.
 *  * **Boundaries** — one pulse per word, decaying quadratically to
 *    {@link BOUNDARY_FLOOR}. It costs nothing and it is genuine word-level
 *    synchronisation on a route that has no audio to synchronise to.
 *
 * Never returns 0 while a line is being spoken: 0 is the signal that means
 * SILENT, and a mouth that shuts between words has stopped talking.
 */
export function spokenEnergy(sinceBoundary: number): number {
    if (!Number.isFinite(sinceBoundary) || sinceBoundary < 0) {
        return NOMINAL_SPEECH_ENERGY;
    }
    const k = clamp01(1 - sinceBoundary / BOUNDARY_PULSE_SECONDS);
    return clamp01(BOUNDARY_FLOOR + (1 - BOUNDARY_FLOOR) * k * k);
}

/**
 * Smoothing for a live amplitude reading.
 *
 * An `AnalyserNode`'s RMS jitters far faster than a jaw can move, so feeding it
 * in raw produces a flutter rather than speech. Attack is fast and release is
 * slow, which is how a mouth behaves: it opens on the consonant and closes over
 * the vowel's tail.
 */
export function followEnergy(previous: number, target: number, dt: number): number {
    const tau = target > previous ? 0.035 : 0.11;
    const a = 1 - Math.exp(-Math.max(0, dt) / tau);
    return previous + (target - previous) * a;
}

/* ------------------------------------------------------------------ *
 * The hand
 * ------------------------------------------------------------------ */

/**
 * The four fingers, as a fraction of {@link Proportions.fingerLength} and a
 * fraction of {@link Proportions.palmWidth} out from the palm's centre line.
 *
 * A table rather than a loop with a formula in it, because the proportions are
 * not regular: the middle finger is the longest, the index and ring are close
 * behind it, and the little finger is markedly shorter AND set lower on the
 * hand. A hand built from four equal capsules on an even pitch is a rake, and
 * it is the same class of wrongness as six people blinking in unison — nobody
 * can name it and everybody can see it.
 *
 * `drop` is how far below the knuckle line the finger's root sits, as a
 * fraction of finger length: a knuckle line is an arc, not a straight edge.
 */
export interface FingerSpec {
    /** 0 = index … 3 = little. */
    index: number;
    /** Length, as a fraction of `fingerLength`. */
    length: number;
    /** Across the palm, 0 at the centre line, positive toward the thumb. */
    across: number;
    drop: number;
    /** Resting curl at the knuckle, radians. */
    curl: number;
    /** Splay away from the middle finger, radians. */
    splay: number;
}

export const FINGERS: readonly FingerSpec[] = [
    { index: 0, length: 0.94, across: 0.30, drop: 0.06, curl: 0.30, splay: 0.13 },
    { index: 1, length: 1.00, across: 0.10, drop: 0.00, curl: 0.26, splay: 0.02 },
    { index: 2, length: 0.93, across: -0.12, drop: 0.05, curl: 0.30, splay: -0.06 },
    { index: 3, length: 0.77, across: -0.32, drop: 0.16, curl: 0.36, splay: -0.17 },
];

/**
 * How much idle flex a finger has, in radians. See {@link fingerCurl}.
 *
 * Under two degrees, and bounded well below the smallest resting curl in
 * {@link FINGERS} so a total curl can never go negative — a finger that bends
 * backwards renders perfectly and reads as a broken bone.
 */
export const FINGER_IDLE_RADIANS = 0.030;

/**
 * Extra curl on one finger at `t`, in radians, on top of its resting curl.
 *
 * ============================================================
 * WHY A HAND ON A DESK STILL HAS TO MOVE
 * ============================================================
 *
 * The two anchors rest their hands on the desk holding a script, and those
 * hands never moved at all. A face that breathes and blinks above a pair of
 * perfectly still hands is a specific kind of uncanny: the eye reads the
 * stillness as the hands being a separate, non-living object — which is exactly
 * what they were, two capsules parented to a forearm.
 *
 * Each finger runs on its own rate and phase, for the same reason the blink
 * schedules are spread: four fingers flexing together is a fist opening and
 * closing, which is a gesture, and nobody makes a gesture continuously.
 */
export function fingerCurl(t: number, phase = 0, finger = 0, energy = 0): number {
    const spec = FINGERS[finger % FINGERS.length] as FingerSpec;
    const u = t + phase * 2.7 + finger * 1.37;
    const drift = 0.5 + 0.5 * Math.sin(u * 0.41 + finger * 2.1);
    /*
      Speaking OPENS the hand a little, it does not close it. Somebody
      emphasising a point lifts and spreads their fingers off the surface; a
      speaker whose hands tighten reads as anxious, which is not the note a
      presenter or an interviewer wants to hit.
    */
    const open = Math.min(1, Math.max(0, energy)) * 0.55;
    const value = FINGER_IDLE_RADIANS * (drift - open);
    const floor = -spec.curl * 0.5;
    return value < floor ? floor : value;
}

/* ------------------------------------------------------------------ *
 * More movement
 * ------------------------------------------------------------------ */

/** How far a micro-saccade moves the eye. About a degree and a half. */
export const SACCADE_RADIANS = 0.026;
/** Shortest and longest gap between micro-saccades, in seconds. */
export const SACCADE_MIN_GAP = 0.34;
export const SACCADE_MAX_GAP = 1.15;
/** How long the jump itself takes. Real saccades are 20–80 ms. */
export const SACCADE_MS = 55;

export interface Gaze {
    /** Radians, positive to the figure's left. */
    yaw: number;
    /** Radians, positive up. */
    pitch: number;
}

/**
 * Micro-saccades: where the eyes are looking, relative to the head's aim.
 *
 * ============================================================
 * A GAZE THAT NEVER MOVES IS NOT A GAZE THAT LOOKS
 * ============================================================
 *
 * The eyes already take up the residual of a look-at that the head only turns
 * 90% of the way toward, which is what stopped the cast staring past the
 * viewer. What they did not do is anything at all when there is no target: a
 * figure facing front had two eyes locked in one direction for as long as the
 * shot lasted, and a fixed stare reads as either dead or hostile.
 *
 * Real eyes never hold still. A fixation is broken every few hundred
 * milliseconds by a micro-saccade — a BALLISTIC jump of a degree or two, not a
 * drift — and that is why this is slot-scheduled like {@link blink} rather than
 * a sine. A sine is a smooth pursuit, which is what an eye does when tracking a
 * moving object and never what it does while looking at a face.
 *
 * Any larger than {@link SACCADE_RADIANS} and it stops reading as a living eye
 * and starts reading as shiftiness.
 */
export function saccade(t: number, phase = 0): Gaze {
    /*
      A different multiplier from `blink`'s 7.3 on purpose. Two schedules derived
      from the same offset would put every figure's saccades and blinks in a
      fixed relationship, and a blink that always follows a glance is a tell of
      its own.
    */
    const u = t + phase * 11.9;
    const slot = Math.floor(u / SACCADE_MAX_GAP);
    let yaw = 0;
    let pitch = 0;
    // This slot and the one before it, so a target held across a boundary is
    // the same target rather than snapping back to centre.
    for (let s = slot - 1; s <= slot; s++) {
        const at = s * SACCADE_MAX_GAP
            + (SACCADE_MAX_GAP - SACCADE_MIN_GAP) * hash01(s * 22695477 + 7);
        if (u < at) continue;
        const angle = hash01(s * 1103515245 + 13) * Math.PI * 2;
        const size = 0.35 + 0.65 * hash01(s * 69069 + 3);
        const k = smooth(at, at + SACCADE_MS / 1000, u);
        // Ease from wherever the previous slot left the eye to this target.
        yaw = SACCADE_RADIANS * size * Math.cos(angle) * k + yaw * (1 - k);
        // Vertical saccades are smaller than horizontal ones: the eye is
        // hinged in a socket that is wider than it is tall.
        pitch = SACCADE_RADIANS * size * Math.sin(angle) * 0.6 * k + pitch * (1 - k);
    }
    return { yaw, pitch };
}

/** Shortest and longest gap between a listener's nods, in seconds. */
export const NOD_MIN_GAP = 3.4;
export const NOD_MAX_GAP = 9.0;
/** How long one nod lasts, and how deep it goes. */
export const NOD_SECONDS = 0.62;
export const NOD_RADIANS = 0.055;

/**
 * A listener's nod, in radians of pitch. Exactly 0 when nobody is listening.
 *
 * ============================================================
 * THE HALF THAT MAKES A ROOM A CONVERSATION
 * ============================================================
 *
 * The figure who is not speaking already turns and looks at the one who is,
 * which is what stopped the second anchor reading as a mannequin parked in
 * shot. It is still only WATCHING. A person being spoken to acknowledges — a
 * short nod every several seconds — and that is the clearest signal available
 * that the figures are aware of each other rather than each animating alone.
 *
 * `attention` is how much this figure is listening to somebody ELSE: 1 when
 * another figure is speaking and this one is not, 0 otherwise. Passing the
 * speaker's own energy here would be wrong and would look wrong — a speaker
 * nodding along to their own sentence reads as agreeing with themselves.
 *
 * Slot-scheduled and spread by phase, for the reason everything else here is:
 * six seats nodding together is an audience at a rally.
 */
export function listenNod(t: number, phase = 0, attention = 0): number {
    if (!(attention > 0)) return 0;
    const u = t + phase * 5.1;
    const slot = Math.floor(u / NOD_MAX_GAP);
    let value = 0;
    for (let s = slot - 1; s <= slot; s++) {
        const at = s * NOD_MAX_GAP + (NOD_MAX_GAP - NOD_MIN_GAP) * hash01(s * 40503 + 19);
        const dt = u - at;
        if (dt < 0 || dt > NOD_SECONDS) continue;
        /*
          Down first, and one and a half cycles rather than one — a nod starts
          by dropping the chin, and a single dip reads as a flinch. The second
          fall is shallower because the head is losing momentum.
        */
        const x = dt / NOD_SECONDS;
        const shape = Math.sin(x * Math.PI * 3) * (1 - x * 0.55);
        const nod = -NOD_RADIANS * shape * Math.min(1, attention);
        if (Math.abs(nod) > Math.abs(value)) value = nod;
    }
    return value;
}

/**
 * Head ROLL on a stressed word, in radians. Companion to {@link headEmphasis}.
 *
 * A talking head that only pitches is a metronome. Almost everybody tilts as
 * well as nods, and at tile framing the tilt is the more legible of the two:
 * it moves the head's whole silhouette against the shoulders, where a pitch
 * moves it along the line of sight and mostly foreshortens.
 *
 * Slower than the pitch nod and on an incommensurable rate, so the two never
 * settle into a repeating figure-of-eight.
 */
export function headRollEmphasis(t: number, phase = 0, energy = 1): number {
    if (!(energy > 0)) return 0;
    const u = t + phase * 3.7;
    return 0.042 * Math.sin(u * 1.63 + 1.4) * Math.min(1, energy);
}

/**
 * A small torso twist, in radians. The whole body, not the head.
 *
 * Nobody sits square to a camera for ninety seconds. Just over a degree at the
 * extreme, and it is applied to the rig's OWN node rather than the caller's —
 * see the note by `body` in `human.ts`, where writing the caller's placement is
 * a bug this code has already shipped once and which collapsed the meeting's
 * six pods and the studio's two anchors onto x = 0.
 */
export function torsoTwist(t: number, phase = 0): number {
    const u = t + phase * 1.6;
    return 0.020 * Math.sin(u * 0.19 + 1.1) + 0.008 * Math.sin(u * 0.47);
}

/**
 * How pressed together the lips are while NOT speaking. 0 relaxed … 1 pressed.
 *
 * A silent mouth is the one part of an idle face with nothing happening to it:
 * `jawOpen` returns exactly 0 (deliberately — "almost closed" reads as chewing)
 * and `lipSpread` returns a constant. So a listening figure held one fixed
 * expression for as long as somebody else was talking, and the stillness of the
 * mouth is a good part of what a viewer reads as "that one is not really here".
 *
 * Occasional, slow and small: a lip-press and a swallow are what a face does
 * while listening, and both are almost entirely the lower lip. Returns 0 while
 * speaking, because the speech shapes own the mouth then and two things driving
 * one lip is a flutter.
 */
export function mouthPress(t: number, phase = 0, energy = 0): number {
    if (energy > 0) return 0;
    const u = t + phase * 8.3;
    const slow = Math.max(0, Math.sin(u * 0.21 + 0.9));
    // A swallow is rare and brief: the top 14% of a very slow sine, rescaled.
    const swallow = Math.max(0, Math.sin(u * 0.073 + 2.7) - 0.86) / 0.14;
    return clamp01(0.18 * slow + 0.55 * swallow);
}
