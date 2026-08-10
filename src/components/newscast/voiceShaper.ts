/**
 * Giving the male anchor a male voice when the backend has only a female one.
 *
 * WHY THIS EXISTS, WHICH IS NOT THE SAME AS "WHY PITCH SHIFTING IS NICE"
 *
 * App 36 renders speech with two providers. `edge-tts` has real male/female
 * neural pairs and is what the two presenters are supposed to sound like. When
 * it is missing from a replica — which is the state production has actually
 * been in — everything falls through to Google Translate's endpoint, which has
 * exactly ONE voice per language and it is female.
 *
 * Three things were tried in front of that fact and only this one keeps both
 * presenters:
 *
 *   1. Let both anchors share the voice. This is the original bug: آدم is read
 *      by a woman and the handover between two identical voices sounds like a
 *      fault on top of it.
 *   2. Read the bulletin with one presenter. Honest, and it deletes آدم from
 *      the broadcast, which is not what a newsroom does when a microphone
 *      breaks.
 *   3. Reshape the audio into a male register. The man stays, he sounds like a
 *      different person, and it costs one pass over a decoded buffer.
 *
 * It is a fallback and it is labelled as one in the studio. Install `edge-tts`
 * on the replica and none of this runs.
 *
 * HOW THE SHIFT WORKS, AND WHY IT IS DONE IN TWO HALVES
 *
 * Playing a buffer slower lowers pitch AND formants together and makes it
 * longer. Lowering pitch and formants together is exactly the cue that reads as
 * a bigger speaker, so it is what we want; the length is what we do not.
 *
 * So the work is split, and only half of it is here:
 *
 *   * this module time-COMPRESSES the audio to `ratio` of its length without
 *     touching its pitch (WSOLA — overlap-add with a correlation search);
 *   * the caller then plays that shorter buffer at `playbackRate = ratio`,
 *     which drops pitch and formants by `ratio` and stretches the duration
 *     back to exactly what it started as.
 *
 * The second half is one property assignment on an `AudioBufferSourceNode` and
 * uses the browser's own resampler, which is better than anything worth writing
 * here. The first half is arithmetic over a Float32Array, has no DOM in it, and
 * is where every mistake would be inaudible-until-shipped — so it is a plain
 * module, verified by `npm run check:newscast`, exactly as `photoMask.ts`,
 * `drawEngine.ts`, `chatMedia.ts` and `newscastEngine.ts` are.
 *
 * WHY NOT MATCH THE MALE PITCH EXACTLY
 *
 * The fallback voice sits near 216 Hz and a male anchor near 115 Hz, so an
 * exact match would be `ratio = 0.53` — and because a plain resample moves the
 * formants by the same factor, 0.53 does not sound like a man, it sounds like a
 * giant. Matching the formants instead (~0.85) leaves the pitch at 184 Hz,
 * which is still a woman. Neither end works alone, and moving the two
 * independently means LPC or cepstral resynthesis, which is a different
 * project.
 *
 * `MALE_RATIO` is the compromise: pitch lands just inside the male range that
 * app 36's own `MALE_F0_MAX` defines, and the formants move as little as that
 * allows. The check asserts the resulting pitch against that number rather than
 * against a hand-written one, so the two repos cannot drift apart on what
 * counts as a male voice.
 */

/**
 * Where the two registers sit, in Hz.
 *
 * `FALLBACK_F0` is measured, not assumed: Google's Arabic voice reading a full
 * sentence, decoded and run through autocorrelation, lands at **192 Hz** — the
 * same way every number in app 36's `VOICE_F0` was arrived at, and lower than
 * the 216 Hz the neural Arabic females sit at. Measure it again rather than
 * editing it if the provider ever changes.
 *
 * `MALE_F0_CEILING` is app 36's `MALE_F0_MAX`: above it, a voice does not read
 * as a man next to a female co-anchor. That number was learned the expensive
 * way from `en-US-GuyNeural`, which is labelled Male, measures 160 Hz, and was
 * reported as sounding female.
 */
export const FALLBACK_F0 = 192;
export const MALE_F0_CEILING = 155;

/**
 * How far to move the fallback voice to reach the male anchor.
 *
 * Deliberately the *largest* ratio (least formant damage) that still lands
 * under the ceiling, with a little margin — not the ratio that would match a
 * male fundamental exactly. See the note above on why exact is worse.
 *
 * Measured end to end on a real Arabic sentence from the fallback provider:
 * 192 Hz in, **140 Hz** out, with the line taking exactly as long to read as it
 * did before. That is between `en-GB-RyanNeural` (124 Hz) and the 155 Hz
 * ceiling — a real male register rather than a woman with the treble turned
 * down.
 */
export const MALE_RATIO = 0.70;

/** The other direction is never needed: the fallback is already female. */
export const IDENTITY_RATIO = 1;

/**
 * The resampling ratio that turns `rendered` into `wanted`, or 1 for a match.
 *
 * Returning 1 rather than something-close-to-1 matters: the caller skips the
 * whole pass on 1, so an anchor the server voiced correctly is played back
 * untouched rather than through a resynthesis that can only lose to it.
 */
export function shapeRatio(
    rendered: 'female' | 'male' | '',
    wanted: 'female' | 'male',
): number {
    if (!rendered || rendered === wanted) return IDENTITY_RATIO;
    // Only one direction is real. A male-only provider is not a thing that
    // exists here, and inventing a ratio for it would be inventing a number.
    return wanted === 'male' ? MALE_RATIO : IDENTITY_RATIO;
}

/** The pitch a shaped voice ends up at — what the check measures against. */
export function shapedPitch(ratio: number, source = FALLBACK_F0): number {
    return source * ratio;
}

/** A Hann window. Sums to a constant at a hop of a quarter of its length. */
export function hann(size: number): Float32Array {
    const window = new Float32Array(size);
    if (size <= 1) {
        if (size === 1) window[0] = 1;
        return window;
    }
    for (let i = 0; i < size; i++) {
        window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    }
    return window;
}

/**
 * Change how long audio takes to play without changing what it sounds like.
 *
 * `scale` is the output length as a fraction of the input: 0.7 returns audio
 * 30% shorter, at the same pitch.
 *
 * WSOLA rather than plain overlap-add, and the difference is the entire
 * perceived quality. Plain OLA lays down frames at fixed positions, so
 * successive frames start at arbitrary points in the speaker's pitch period and
 * cancel each other where they overlap — the result is the hollow, phasey
 * "underwater" voice that every naive time-stretcher produces. The correlation
 * search below slides each frame by up to one pitch period to the position that
 * best continues what has already been written, which lines the periods up. It
 * is the whole reason this is ~40 lines rather than ~10.
 */
export function timeScale(
    input: Float32Array,
    scale: number,
    sampleRate: number,
): Float32Array {
    if (!input || input.length === 0) return new Float32Array(0);
    if (!(scale > 0) || !Number.isFinite(scale)) return input.slice();
    // A no-op has to be exactly a no-op — see `shapeRatio`.
    if (Math.abs(scale - 1) < 1e-3) return input.slice();

    const rate = sampleRate > 0 ? sampleRate : 24000;
    // ~45 ms. Long enough to hold a pitch period of even a deep voice, short
    // enough that a consonant is not smeared across the join.
    const frame = Math.max(256, Math.min(input.length, Math.round(rate * 0.045)));
    const synthesisHop = Math.max(1, Math.round(frame / 4));
    const analysisHop = synthesisHop / scale;

    // Search ± one period of the lowest voice worth tracking (~70 Hz). Any
    // wider and the search starts matching the *previous* period, which is
    // audible as a stutter rather than as a smoother join.
    const search = Math.min(Math.round(rate / 70), Math.floor(frame / 2));
    const correlate = Math.min(synthesisHop, 256);
    // Every other offset. At these sample rates the odd ones are within a
    // fraction of a period of the even ones and halve the cost of the only
    // loop here that is not linear.
    const stride = 2;

    const outLength = Math.max(1, Math.round(input.length * scale));
    const accumulated = new Float32Array(outLength + frame);
    const weight = new Float32Array(outLength + frame);
    const window = hann(frame);

    let writeAt = 0;
    let index = 0;
    while (writeAt + frame <= accumulated.length) {
        const ideal = Math.round(index * analysisHop);
        if (ideal + frame > input.length) break;

        let start = ideal;
        if (index > 0 && search > 0) {
            const lowest = Math.max(0, ideal - search);
            const highest = Math.min(input.length - frame, ideal + search);
            let best = -Infinity;
            for (let candidate = lowest; candidate <= highest; candidate += stride) {
                let score = 0;
                for (let j = 0; j < correlate; j++) {
                    score += accumulated[writeAt + j] * input[candidate + j];
                }
                if (score > best) {
                    best = score;
                    start = candidate;
                }
            }
        }

        for (let j = 0; j < frame; j++) {
            accumulated[writeAt + j] += input[start + j] * window[j];
            weight[writeAt + j] += window[j];
        }
        writeAt += synthesisHop;
        index++;
    }

    // Divide out the window sum rather than assuming it is constant: the first
    // and last frames are only half covered, and without this the line fades in
    // and out on every segment.
    const output = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
        output[i] = weight[i] > 1e-4 ? accumulated[i] / weight[i] : 0;
    }
    return output;
}

/**
 * Does this browser have what the shaping needs?
 *
 * Web Audio has been everywhere for years, so a false here means something
 * unusual — a locked-down embedded browser, or a test environment. The page
 * falls back to a single presenter in that case, which is the honest answer
 * when the man genuinely cannot be given a voice of his own.
 */
export function canShape(scope: any = globalThis): boolean {
    return typeof (scope?.AudioContext || scope?.webkitAudioContext) === 'function';
}
