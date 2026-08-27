/**
 * Playing a synthesised line, at a level somebody can actually hear, and
 * reporting how loud it is right now so a mouth can move on it.
 *
 * One module for the Newscast, the Toastmasters meeting and the Job Interview.
 * All three used to do their own thing and two of them did the wrong thing.
 *
 * ============================================================
 * 1. WHY IT IS NOT AN `<audio>` ELEMENT
 * ============================================================
 *
 * Reported, repeatedly, and most sharply in Arabic: **the Self Study voice is
 * too quiet.** The measurement behind that is in `voiceShaper.ts` — app 36's
 * fallback provider returns audio at a peak of ~0.41 and a voiced RMS of ~0.10,
 * about eight decibels of headroom simply left on the table — and the important
 * half is that **an `<audio>` element cannot get it back**. `volume` only ever
 * goes DOWN. So a page that plays a clip through an element is stuck with
 * whatever level the provider felt like, and there is no setting anywhere that
 * fixes it.
 *
 * The Newscast worked this out and levelled its clips on the samples. The
 * interview room did not — it was `new Audio(url)` — and the meeting had no
 * server route at all, which is why Arabic was silent there rather than quiet.
 * Both go through here now.
 *
 * ============================================================
 * 2. WHY NORMALISING IS NOT ENOUGH, AND WHAT THE COMPRESSOR IS FOR
 * ============================================================
 *
 * `normalizeLevel` takes a clip to `TARGET_RMS` unless a peak would clip first,
 * and for real speech the peak is what binds: speech has a crest factor around
 * four or five, so one consonant decides the gain for the whole line and the
 * average sits far below the ceiling. That is why raising `TARGET_RMS` does
 * nothing useful — `check:newscast` asserts the loudness term binds at the
 * measured crest factor, and it stops binding the moment the target goes up.
 * There is no more loudness available from a gain.
 *
 * There is a great deal available from **reducing the crest factor**, which is
 * what every broadcaster on earth does to a voice and is why a radio announcer
 * sounds close and present at a volume setting where a raw recording sounds
 * distant. A gentle compressor pulls the consonant peaks down, and the makeup
 * gain then lifts everything — so the average rises by ~9 dB while the peak
 * stays under the ceiling.
 *
 * It is done on the SAMPLES, not on the graph, and that is a correction rather
 * than a preference: a `DynamicsCompressorNode` has an attack and no look-ahead,
 * so the front of every plosive after a pause was reaching the destination at
 * the full makeup gain — 3.96, i.e. twelve decibels into hard clipping. On a
 * Float32Array look-ahead is free. See {@link prepareVoice}.
 *
 * ============================================================
 * 3. WHY IT MEASURES ITSELF
 * ============================================================
 *
 * The 3D cast opens its mouth on {@link energy}. An `AnalyserNode` on the
 * output is what makes that the REAL waveform rather than a plausible
 * animation: the jaw closes in the gaps between words because there genuinely
 * is no audio in them. The device `speechSynthesis` route cannot be measured —
 * the Web Speech API exposes no audio at all — and the rooms pass a nominal
 * energy there instead, which is the difference between good lip movement and
 * excellent lip movement rather than between working and broken.
 */

import {
    IDENTITY_RATIO, MALE_LOUDNESS_MAKEUP, TARGET_RMS,
    normalizeLevel, timeScale,
} from '@/components/newscast/voiceShaper';

/**
 * Where the compressor starts working, in dBFS.
 *
 * Low enough that ordinary speech is inside it — a voice normalised to
 * `TARGET_RMS` sits near -14 dBFS — and high enough that the room tone between
 * words is not pumped up with it.
 */
export const COMPRESSOR_THRESHOLD_DB = -18;

/**
 * 3:1. Broadcast rather than mastering.
 *
 * Above about 5:1 a voice starts to sound squashed and its consonants lose
 * their attack, which on a bulletin reads as a bad phone line. 3:1 is what a
 * radio desk runs and it is inaudible as an effect.
 */
export const COMPRESSOR_RATIO = 3;

/** Soft knee, in dB either side of the threshold. A hard knee is audible. */
export const COMPRESSOR_KNEE_DB = 10;

/**
 * Makeup gain, as a multiplier.
 *
 * Derived rather than dialled in: at a -18 dB threshold and 3:1, a line whose
 * samples peak at `PEAK_CEILING` comes out of the compressor around -12 dBFS,
 * so 2.9x (~9.2 dB) puts the peak back near -3 dBFS with the average lifted by
 * the same amount. That is the whole of the loudness increase.
 *
 * It came DOWN from 3.4, and the headroom that bought is not spare — see
 * {@link OUTPUT_CEILING} and the note on the limiter below.
 */
export const VOICE_MAKEUP = 2.9;

/**
 * The hardest any sample may be when it leaves. Guaranteed, not hoped for.
 *
 * -0.4 dBFS. The last few tenths are for the browser's own resampler: playing a
 * buffer at `playbackRate = 0.7` interpolates between samples, and interpolation
 * of a signal already at full scale can overshoot it slightly.
 */
export const OUTPUT_CEILING = 0.955;

/**
 * How far above full scale the samples are allowed to go BEFORE the compressor.
 *
 * Not a typo. `prepareVoice` normalises on loudness and there are two dynamics
 * stages between that and the speakers; both work in decibels and neither minds
 * a sample over 1.0, and neither does a float `AudioBuffer`. What must never be
 * exceeded is the OUTPUT, and {@link limitVoice} is what guarantees that.
 *
 * 2.0 rather than unbounded so that a pathological clip — one enormous spike and
 * otherwise silence — still cannot ask for a gain of a thousand.
 */
export const PRE_COMPRESS_CEILING = 2;

/* ------------------------------------------------------------------ *
 * WHY THE LEVELLING IS DONE ON THE SAMPLES AND NOT IN THE GRAPH
 *
 * This was a `DynamicsCompressorNode` and a `GainNode`, in two copies (here and
 * in `Newscast.vue`), and it could not be made safe. A `DynamicsCompressorNode`
 * has an ATTACK and no LOOK-AHEAD: for the first few milliseconds of a plosive
 * arriving after a pause it is not yet reducing anything, so the peak that
 * arrives is multiplied by the full makeup gain. At the numbers that shipped —
 * samples normalised to 0.97, makeup 3.4, and a further 1.2x on a reshaped clip
 * — that is 3.96, twelve decibels into hard clipping, on the front of every
 * stressed consonant in the language.
 *
 * Hard clipping is a step discontinuity, and a step is broadband: what it sounds
 * like is a spit of white noise on each consonant. That is one of the two halves
 * of "the Arabic Male Voice is not clear, it has a lot of noise" — the other is
 * the correlation bug in `voiceShaper.ts` — and it cannot be tuned away, because
 * the whole point of the makeup gain is to be larger than the headroom the
 * compressor has made.
 *
 * Lowering the makeup until nothing can ever clip means a makeup of about 1.07,
 * which is no makeup at all. What every broadcaster actually uses is a
 * LOOK-AHEAD limiter, and Web Audio has no such node.
 *
 * On a Float32Array look-ahead is free — the future is simply a higher index. So
 * the chain lives here, in two stages that do two different jobs:
 *
 *   {@link compressVoice}  gentle, syllable-rate gain riding. This is what makes
 *                          a voice sound close and present, and it is allowed to
 *                          overshoot.
 *   {@link limitVoice}     a brick wall at {@link OUTPUT_CEILING}, anticipating
 *                          by {@link LIMITER_LOOKAHEAD_MS}. It catches what the
 *                          compressor missed and is inaudible otherwise.
 *
 * Both are pure functions of a Float32Array, so `check:newscast` drives them in
 * node and asserts the thing that matters: that no input, at any crest factor,
 * produces a sample over the ceiling.
 * ------------------------------------------------------------------ */

/**
 * How fast the compressor's detector follows the envelope, in ms.
 *
 * Syllable-rate on purpose. The point of this stage is to even out the
 * difference between a shouted word and a mumbled one, NOT to flatten the
 * waveform inside a vowel — a detector fast enough to catch individual peaks
 * reduces the crest factor to nothing and the voice comes out sounding like it
 * is being squeezed, which is the artefact people call "over-compressed".
 * That job belongs to the limiter, which does it in 2 ms and only when needed.
 */
export const COMPRESSOR_ATTACK_MS = 6;
export const COMPRESSOR_RELEASE_MS = 180;

/**
 * How far ahead the compressor's detector looks, in ms.
 *
 * Enough that the gain is already moving when a transient arrives rather than
 * chasing it afterwards — which is what makes the difference between a
 * compressor and a distortion.
 */
export const COMPRESSOR_LOOKAHEAD_MS = 5;

/**
 * The limiter, in ms.
 *
 * 2 ms of anticipation is one cycle of a 500 Hz tone: long enough that the gain
 * change is a ramp rather than a step (a step in gain is itself a click), short
 * enough that it does not audibly duck the syllable before the loud one.
 */
export const LIMITER_LOOKAHEAD_MS = 2;
export const LIMITER_RELEASE_MS = 60;

/**
 * How much extra presence a DOWN-SHIFTED voice gets, in dB above
 * {@link SHAPED_PRESENCE_HZ}.
 *
 * `voiceShaper.ts` reaches a male register by moving pitch and formants down
 * together, which is the cue that reads as a larger speaker and is also,
 * unavoidably, a 30% squeeze of the whole spectrum toward the bass. Consonants
 * live at 2-6 kHz; moved to 1.7-4.2 kHz they stop cutting through, and the
 * result is a voice that measures loud and sounds muffled.
 *
 * That is the second half of "not clear": the noise was the correlation bug, the
 * mud is this. A shelf rather than a peak, because it corrects a tilt and not a
 * resonance.
 */
export const SHAPED_PRESENCE_DB = 5;
export const SHAPED_PRESENCE_HZ = 2400;

/**
 * Where a down-shifted voice is cut off, in Hz, and where its rumble stops.
 *
 * The fallback provider hands back 24 kHz MP3, whose top octave is mostly codec
 * hiss; shifted by 0.7 that hiss lands at 6-8 kHz, in the middle of the band the
 * presence shelf has just lifted. The low end has the mirror problem — an 80 Hz
 * room tone becomes 56 Hz, which no laptop speaker reproduces and every one of
 * them wastes excursion trying to.
 */
export const SHAPED_LOW_CUT_HZ = 95;
export const SHAPED_HIGH_CUT_HZ = 7600;

/**
 * Roughly the RMS a levelled, compressed voice reaches. Scales {@link energy}.
 *
 * It went up with the compressor: a line that used to arrive at the analyser
 * around 0.34 now arrives near 0.45, and leaving the reference where it was
 * would peg every mouth wide open for the whole bulletin.
 */
const ENERGY_REFERENCE = 0.45;

/* ------------------------------------------------------------------ *
 * Sample-domain filtering
 * ------------------------------------------------------------------ */

/** One biquad section's coefficients, normalised so a0 is 1. */
interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

/**
 * Robert Bristow-Johnson's cookbook coefficients.
 *
 * Written out rather than reached for through Web Audio, because these run on
 * the samples BEFORE playback — see {@link tiltShapedVoice} for why that is not
 * the same as running them on the graph afterwards.
 */
function lowShelfOrHigh(
    kind: 'highpass' | 'lowpass' | 'highshelf',
    hz: number, rate: number, gainDb = 0, q = 0.707,
): Biquad {
    const w = (2 * Math.PI * Math.min(hz, rate * 0.49)) / rate;
    const cos = Math.cos(w);
    const sin = Math.sin(w);
    const alpha = sin / (2 * q);

    if (kind === 'highshelf') {
        const A = Math.pow(10, gainDb / 40);
        const beta = 2 * Math.sqrt(A) * alpha;
        const a0 = (A + 1) - (A - 1) * cos + beta;
        return {
            b0: (A * ((A + 1) + (A - 1) * cos + beta)) / a0,
            b1: (-2 * A * ((A - 1) + (A + 1) * cos)) / a0,
            b2: (A * ((A + 1) + (A - 1) * cos - beta)) / a0,
            a1: (2 * ((A - 1) - (A + 1) * cos)) / a0,
            a2: ((A + 1) - (A - 1) * cos - beta) / a0,
        };
    }
    const a0 = 1 + alpha;
    if (kind === 'highpass') {
        return {
            b0: ((1 + cos) / 2) / a0,
            b1: (-(1 + cos)) / a0,
            b2: ((1 + cos) / 2) / a0,
            a1: (-2 * cos) / a0,
            a2: (1 - alpha) / a0,
        };
    }
    return {
        b0: ((1 - cos) / 2) / a0,
        b1: (1 - cos) / a0,
        b2: ((1 - cos) / 2) / a0,
        a1: (-2 * cos) / a0,
        a2: (1 - alpha) / a0,
    };
}

/** Direct form I, in place. */
function runBiquad(samples: Float32Array, c: Biquad): void {
    let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
    for (let i = 0; i < samples.length; i++) {
        const x0 = samples[i] as number;
        const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
        x2 = x1; x1 = x0;
        y2 = y1; y1 = y0;
        samples[i] = y0;
    }
}

/**
 * Correct the spectral tilt a down-shift introduces. In place, no-op at ratio 1.
 *
 * ============================================================
 * THE FREQUENCIES ARE DIVIDED BY THE RATIO, AND THAT IS THE POINT
 * ============================================================
 *
 * These samples are going to be played at `playbackRate = ratio`, which
 * multiplies every frequency in them by `ratio`. So to lift the band that will
 * END UP at 2.4 kHz, the shelf has to sit at 2.4 / 0.7 = 3.43 kHz here.
 *
 * Doing it on the graph instead — a `BiquadFilterNode` after the source, at the
 * frequency you actually want — is the obvious spelling and it was the first
 * one. It is also wrong in a way that matters: the graph runs AFTER the
 * compressor, so a +5 dB shelf lifts peaks the compressor has already decided
 * were safe, and the limiter then has to claw back five decibels on every
 * consonant. EQ belongs before the dynamics, which here means before playback,
 * which means the division.
 */
export function tiltShapedVoice(
    samples: Float32Array, sampleRate: number, ratio: number,
): Float32Array {
    if (ratio === IDENTITY_RATIO || !samples.length) return samples;
    const rate = sampleRate > 0 ? sampleRate : 24000;
    runBiquad(samples, lowShelfOrHigh('highpass', SHAPED_LOW_CUT_HZ / ratio, rate));
    runBiquad(samples, lowShelfOrHigh('lowpass', SHAPED_HIGH_CUT_HZ / ratio, rate));
    runBiquad(samples, lowShelfOrHigh(
        'highshelf', SHAPED_PRESENCE_HZ / ratio, rate, SHAPED_PRESENCE_DB));
    return samples;
}

/* ------------------------------------------------------------------ *
 * Sample-domain dynamics
 * ------------------------------------------------------------------ */

/**
 * The largest absolute value in `[i, i + window]`, for every i. O(n).
 *
 * A monotonic deque rather than a max per position: the search window is a few
 * hundred samples and a clip is a few hundred thousand, so the naive version is
 * the difference between one millisecond and one second on the decode path.
 */
function forwardPeakEnvelope(samples: Float32Array, window: number): Float32Array {
    const n = samples.length;
    const out = new Float32Array(n);
    const width = Math.max(1, window);
    // Indices, values decreasing from the front.
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;
    let filled = 0;
    for (let i = 0; i < n; i++) {
        // Take in everything up to i + width.
        while (filled < n && filled <= i + width) {
            const v = Math.abs(samples[filled] as number);
            while (tail > head && Math.abs(samples[queue[tail - 1] as number] as number) <= v) tail--;
            queue[tail++] = filled;
            filled++;
        }
        // Drop anything that has fallen behind i.
        while (tail > head && (queue[head] as number) < i) head++;
        out[i] = tail > head ? Math.abs(samples[queue[head] as number] as number) : 0;
    }
    return out;
}

/** The static compression curve, in dB, with a soft knee. */
export function compressionCurveDb(
    inputDb: number,
    thresholdDb = COMPRESSOR_THRESHOLD_DB,
    ratio = COMPRESSOR_RATIO,
    kneeDb = COMPRESSOR_KNEE_DB,
): number {
    const over = inputDb - thresholdDb;
    if (over <= -kneeDb / 2) return inputDb;
    if (over >= kneeDb / 2) return thresholdDb + over / ratio;
    const t = over + kneeDb / 2;
    return inputDb + ((1 / ratio - 1) * t * t) / (2 * kneeDb);
}

/**
 * Even out the syllables and lift the average. In place.
 *
 * Deliberately allowed to overshoot the ceiling — {@link limitVoice} is what
 * guarantees the peak, and asking one stage to do both is what produces a voice
 * that is either quiet or squashed.
 */
export function compressVoice(
    samples: Float32Array, sampleRate: number, makeup = VOICE_MAKEUP,
): Float32Array {
    const n = samples.length;
    if (!n) return samples;
    const rate = sampleRate > 0 ? sampleRate : 24000;

    const ahead = Math.max(1, Math.round((rate * COMPRESSOR_LOOKAHEAD_MS) / 1000));
    const envelope = forwardPeakEnvelope(samples, ahead);
    const attack = Math.exp(-1 / Math.max(1, (rate * COMPRESSOR_ATTACK_MS) / 1000));
    const release = Math.exp(-1 / Math.max(1, (rate * COMPRESSOR_RELEASE_MS) / 1000));
    const makeupDb = 20 * Math.log10(Math.max(1e-6, makeup));
    // Below this there is nothing to reduce, so the log and the pow are skipped
    // — which is most of a clip, because most of a clip is between words.
    const idleDb = COMPRESSOR_THRESHOLD_DB - COMPRESSOR_KNEE_DB / 2;
    const idleFloor = Math.pow(10, idleDb / 20);

    let follower = 0;
    let gainDb = 0;
    for (let i = 0; i < n; i++) {
        const target = envelope[i] as number;
        // Peak follower: rises with the attack constant, falls with the release.
        const coefficient = target > follower ? attack : release;
        follower = target + (follower - target) * coefficient;

        if (follower > idleFloor) {
            const inDb = 20 * Math.log10(follower);
            gainDb = compressionCurveDb(inDb) - inDb;
        } else {
            gainDb = 0;
        }
        samples[i] = (samples[i] as number) * Math.pow(10, (gainDb + makeupDb) / 20);
    }
    return samples;
}

/**
 * A look-ahead brick wall at `ceiling`. In place, and it is a GUARANTEE.
 *
 * Three properties, in the order they matter:
 *
 *  1. **No sample leaves above `ceiling`.** The gain applied at every position
 *     is the minimum required over the whole anticipation window, so it is
 *     already low by the time the peak arrives. There is a final scan as well,
 *     because "argued" and "asserted" are different things and this is the one
 *     place a mistake is audible as a click on every consonant.
 *  2. **The gain never rises faster than the release.** A gain that snaps back
 *     is itself a discontinuity, which is the artefact that makes a cheap
 *     limiter sound like it is chewing.
 *  3. **It does nothing at all when nothing is over.** `gain` starts at 1 and
 *     stays there, so a quiet line is bit-identical to its input.
 */
export function limitVoice(
    samples: Float32Array, sampleRate: number, ceiling = OUTPUT_CEILING,
): Float32Array {
    const n = samples.length;
    if (!n || !(ceiling > 0)) return samples;
    const rate = sampleRate > 0 ? sampleRate : 24000;
    const ahead = Math.max(1, Math.round((rate * LIMITER_LOOKAHEAD_MS) / 1000));

    // What gain each position would need on its own...
    const envelope = forwardPeakEnvelope(samples, ahead);
    // ...which, because the envelope is a FORWARD window maximum, is already the
    // minimum over the anticipation window. That is the whole trick.
    const release = 1 - Math.exp(-1 / Math.max(1, (rate * LIMITER_RELEASE_MS) / 1000));

    let gain = 1;
    for (let i = 0; i < n; i++) {
        const env = envelope[i] as number;
        const needed = env > ceiling ? ceiling / env : 1;
        gain = needed < gain ? needed : gain + (needed - gain) * release;
        samples[i] = (samples[i] as number) * gain;
    }

    /*
      The backstop, and it is not decoration.

      Everything above is an argument that no sample can exceed the ceiling. A
      global scale is what makes it a fact — and it is a no-op in every case the
      argument covers, so it costs one pass and never changes the sound.
    */
    let peak = 0;
    for (let i = 0; i < n; i++) {
        const v = Math.abs(samples[i] as number);
        if (v > peak) peak = v;
    }
    if (peak > ceiling) {
        const trim = ceiling / peak;
        for (let i = 0; i < n; i++) samples[i] = (samples[i] as number) * trim;
    }
    return samples;
}

/**
 * Everything that happens to a clip between decoding it and playing it.
 *
 * One function so the Newscast, the interview room and the meeting cannot drift
 * apart on it — which they had, in two copies, one of them with the male makeup
 * silently cancelled. `ratio` is `voiceShaper.ts`'s reshaping factor; 1 means
 * the server voiced it correctly and the tilt correction is skipped entirely.
 *
 * The order is the order a broadcast desk uses and each step depends on the one
 * before it:
 *
 *   tilt      correct the down-shift, BEFORE anything measures the level
 *   normalise bring the provider's ~8 dB of unused headroom back
 *   compress  even out the syllables and lift the average
 *   limit     guarantee the peak
 */
export function prepareVoice(
    samples: Float32Array, sampleRate: number, ratio = IDENTITY_RATIO,
): Float32Array {
    tiltShapedVoice(samples, sampleRate, ratio);
    /*
      Normalised on LOUDNESS alone, with the peak backstop relaxed to
      {@link PRE_COMPRESS_CEILING}.

      `normalizeLevel`'s default ceiling is right for samples that are about to
      be played, and these are not — a compressor and a limiter are between them
      and the speakers, and both of those work in dB and do not care that a
      sample is above full scale. A float `AudioBuffer` does not care either.

      Leaving the tight ceiling in was measurably wrong rather than merely
      cautious: the presence shelf lifts consonant peaks (that is its whole job),
      so on a reshaped clip the peak term bound harder than on an untouched one
      and the male anchor came out 2.1 dB QUIETER than his co-presenter, having
      just been given a makeup gain meant to make him louder. The output peak is
      `limitVoice`'s guarantee, not this line's.
    */
    normalizeLevel(samples, TARGET_RMS, PRE_COMPRESS_CEILING);
    /*
      The reshaped voice's extra loudness is spent HERE, and this is the
      correction that made it real.

      It used to be a higher target handed to `normalizeLevel`, where it achieved
      nothing on any line of actual speech: `levelGain` is
      `min(loudness, ceiling / peak)`, and at the crest factor real speech has the
      CEILING binds at both targets — so the male and the female came out at
      identical levels and the male, being down-shifted, therefore sounded
      quieter. See MALE_LOUDNESS_MAKEUP in `voiceShaper.ts`.

      After the compressor there is real headroom, and a limiter behind it, so a
      fifth more gain is a fifth more loudness rather than a fifth more
      distortion.
    */
    compressVoice(samples, sampleRate,
        ratio === IDENTITY_RATIO ? VOICE_MAKEUP : VOICE_MAKEUP * MALE_LOUDNESS_MAKEUP);
    limitVoice(samples, sampleRate);
    return samples;
}

/* ------------------------------------------------------------------ *
 * The graph
 * ------------------------------------------------------------------ */

/**
 * What a levelled clip is played through.
 *
 * Almost nothing, now that {@link prepareVoice} owns the level — and that is the
 * shape to keep. Two nodes:
 *
 *  * a soft-clip curve, which exists only for the browser's own resampler:
 *    `playbackRate = 0.7` interpolates between samples, and interpolating a
 *    signal at -0.4 dBFS can cross 0 dBFS by a hair;
 *  * the analyser the 3D mouths move on, reading what actually left rather than
 *    what was submitted.
 *
 * ============================================================
 * WHY IT IS A FUNCTION AND NOT JUST THE GRAPH INSIDE `createSpeechAudio`
 * ============================================================
 *
 * Because there are two callers and there were two implementations. The Newscast
 * owns its own playback — it suspends the context to pause, it prefetches the
 * next line while this one plays, and its `onended` advances the running order —
 * so it cannot use {@link SpeechAudio.play}, and it therefore grew a second copy
 * of the compressor and the makeup gain. Both copies had the same clipping bug
 * and only one of them would have been fixed. Working rule 10, one directory
 * apart.
 */
export interface VoiceChain {
    /** Connect an `AudioBufferSourceNode` here. */
    readonly input: AudioNode;
    /** Reads the post-limiter signal. Drives {@link SpeechAudio.energy}. */
    readonly analyser: AnalyserNode;
}

/** A soft knee at the very top of the range, as a `WaveShaperNode` curve. */
function softClipCurve(): Float32Array {
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        /*
          `tanh(1.1x) / tanh(1.1)`.

          Within 2% of a straight line below half scale, which is inaudible, and
          asymptotic at the ends — so a sample that would have arrived at 1.02
          leaves at 0.99 with its shape squashed rather than its top sliced off.
          A slice is a step discontinuity and therefore broadband noise; a squash
          is a little second harmonic, which on a voice reads as warmth.

          Note what it is NOT: a substitute for {@link limitVoice}. A
          `WaveShaperNode` clamps its INPUT to [-1, 1] before the lookup, so
          anything arriving at 3.3 maps to exactly 1.0 — a flat top, i.e. hard
          clipping again. It can only tidy the last fraction of a decibel, which
          is the job it has here.
        */
        curve[i] = Math.tanh(1.1 * x) / Math.tanh(1.1);
    }
    return curve;
}

export function createVoiceChain(context: AudioContext): VoiceChain {
    const clip = context.createWaveShaper();
    clip.curve = softClipCurve() as Float32Array<ArrayBuffer>;
    // 4x, so the curve's own corner is not itself a source of aliasing. Where
    // it is unsupported the property is simply ignored.
    clip.oversample = '4x';

    const analyser = context.createAnalyser();
    // 1024 is ~21 ms at 48 kHz — one reading per frame, over about the shortest
    // span in which a mouth position means anything.
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.4;

    clip.connect(analyser);
    analyser.connect(context.destination);

    return { input: clip, analyser };
}

export interface SpeechAudio {
    /** True when Web Audio is available and the levelling path is live. */
    readonly capable: boolean;
    /**
     * Unlock the context inside a user gesture.
     *
     * An `AudioContext` created outside one starts `suspended`, and every
     * `start()` on it is silently ignored — no error, no event, a bulletin that
     * plays in complete silence. Every room calls this from the click that
     * begins the session, exactly as the chimes are primed.
     */
    prime(): void;
    /**
     * Play a clip and resolve when it has finished.
     *
     * NEVER REJECTS. Every caller is a room waiting to ask its next question,
     * and a rejection there is an interview that stops. A clip that cannot be
     * fetched, decoded or played resolves immediately and the room carries on
     * with the caption it has already put on screen.
     *
     * `ratio` is the voice-reshaping factor from `voiceShaper.ts` — 1 for
     * anything the server voiced correctly. `1` skips the resynthesis pass
     * entirely rather than running an identity transform over it.
     */
    play(url: string, ratio?: number): Promise<void>;
    /** Stop whatever is playing. Safe to call when nothing is. */
    stop(): void;
    /**
     * How loud the output is right now, 0…1.
     *
     * Read once per animation frame by the 3D stages. Returns 0 when nothing is
     * playing, which is what shuts the mouth.
     */
    energy(): number;
    dispose(): void;
}

/**
 * The `<audio>` fallback, for a browser with no Web Audio.
 *
 * It is a real path rather than a shrug — some locked-down and embedded
 * browsers have `Audio` and not `AudioContext` — and it is deliberately the
 * quiet one. Being unable to level the clip is exactly the condition this
 * module exists to fix, and pretending otherwise would mean a page that reports
 * an energy nothing is generating.
 */
function elementFallback(): SpeechAudio {
    let element: HTMLAudioElement | null = null;
    let playing = false;
    return {
        capable: false,
        prime() { /* nothing to unlock */ },
        play(url) {
            return new Promise<void>(resolve => {
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    playing = false;
                    resolve();
                };
                try {
                    const audio = new Audio(url);
                    audio.volume = 1;
                    audio.onended = finish;
                    audio.onerror = finish;
                    element = audio;
                    playing = true;
                    void audio.play().catch(finish);
                } catch {
                    finish();
                }
            });
        },
        stop() {
            try { element?.pause(); } catch { /* already gone */ }
            element = null;
            playing = false;
        },
        // No measurement is possible, so a nominal level keeps the mouth moving
        // rather than leaving a speaking figure sitting with its jaw shut.
        energy() { return playing ? 0.62 : 0; },
        dispose() { this.stop(); },
    };
}

export function createSpeechAudio(): SpeechAudio {
    const Ctor = typeof window !== 'undefined'
        ? ((window as any).AudioContext || (window as any).webkitAudioContext)
        : null;
    if (typeof Ctor !== 'function') return elementFallback();

    let context: AudioContext | null = null;
    let chain: VoiceChain | null = null;
    let probe: Float32Array | null = null;
    let source: AudioBufferSourceNode | null = null;
    /**
     * Every `stop()` and every new `play()` invalidates whatever was in flight.
     *
     * A decode is asynchronous and a room can skip a question while one is
     * running; without this the abandoned clip starts playing over the next
     * one. Same shape as the generation counter the Newscast uses against
     * `speechSynthesis`, which has no AbortController either.
     */
    let generation = 0;

    /** Decoded and shaped audio, keyed on what changes it. */
    const cache = new Map<string, AudioBuffer>();

    function ensure(): AudioContext | null {
        if (context) return context;
        try {
            context = new Ctor() as AudioContext;
        } catch {
            return null;
        }
        // One implementation of the chain, shared with the Newscast. See
        // `createVoiceChain` for what is in it and why it is in that order.
        chain = createVoiceChain(context);
        probe = new Float32Array(chain.analyser.fftSize);
        return context;
    }

    function stopSource(): void {
        if (!source) return;
        source.onended = null;
        try { source.stop(); } catch { /* already finished */ }
        try { source.disconnect(); } catch { /* already detached */ }
        source = null;
    }

    return {
        capable: true,
        prime() {
            const ctx = ensure();
            if (ctx && ctx.state === 'suspended') void ctx.resume();
        },
        async play(url, ratio = IDENTITY_RATIO) {
            const mine = ++generation;
            const ctx = ensure();
            if (!ctx || !chain) return;
            if (ctx.state === 'suspended') {
                try { await ctx.resume(); } catch { /* still suspended; try anyway */ }
            }
            if (mine !== generation) return;

            const key = `${url}|${ratio}`;
            let buffer = cache.get(key);
            if (!buffer) {
                try {
                    // Back through the object URL rather than holding the bytes:
                    // `decodeAudioData` DETACHES the ArrayBuffer it is given, so
                    // a shared one decodes once and is empty on every replay.
                    const bytes = await (await fetch(url)).arrayBuffer();
                    const decoded = await ctx.decodeAudioData(bytes);
                    const shaped = ratio === IDENTITY_RATIO
                        ? Float32Array.from(decoded.getChannelData(0))
                        : timeScale(decoded.getChannelData(0), ratio, decoded.sampleRate);
                    // Tilt, level, compress, limit — one function, shared with
                    // the Newscast. See `prepareVoice`.
                    prepareVoice(shaped, decoded.sampleRate, ratio);
                    buffer = ctx.createBuffer(1, shaped.length, decoded.sampleRate);
                    buffer.getChannelData(0).set(shaped);
                    // Decoded PCM is ~25x the size of the MP3 it came from and a
                    // bulletin is forty lines. This is what stops a skip-back
                    // redoing the WSOLA pass; it does not need the whole hour.
                    if (cache.size > 20) {
                        const oldest = cache.keys().next().value;
                        if (oldest !== undefined) cache.delete(oldest);
                    }
                    cache.set(key, buffer);
                } catch {
                    return;
                }
            }
            if (mine !== generation) return;

            return new Promise<void>(resolve => {
                try {
                    stopSource();
                    const node = ctx.createBufferSource();
                    node.buffer = buffer!;
                    // The other half of the reshaping: playing the shortened
                    // buffer slower drops pitch AND formants by `ratio` and puts
                    // the duration back exactly. See `voiceShaper.ts`.
                    node.playbackRate.value = ratio;
                    node.connect(chain!.input);
                    node.onended = () => {
                        if (mine !== generation) return;
                        source = null;
                        resolve();
                    };
                    source = node;
                    node.start();
                } catch {
                    resolve();
                }
            });
        },
        stop() {
            generation++;
            stopSource();
        },
        energy() {
            if (!chain || !probe || !source) return 0;
            chain.analyser.getFloatTimeDomainData(probe as Float32Array<ArrayBuffer>);
            let total = 0;
            for (let i = 0; i < probe.length; i++) {
                const v = probe[i] as number;
                total += v * v;
            }
            const rms = Math.sqrt(total / probe.length);
            return Math.max(0, Math.min(1, rms / ENERGY_REFERENCE));
        },
        dispose() {
            generation++;
            stopSource();
            cache.clear();
            try { void context?.close(); } catch { /* already closed */ }
            context = null;
        },
    };
}
