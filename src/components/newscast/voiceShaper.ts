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

/* ------------------------------------------------------------------ *
 * Level
 *
 * WHY THIS IS HERE AND NOT LEFT TO THE PLAYER
 *
 * Reported as "the Arabic male voice is too low, and the female a little low
 * too". Measured, the shaping was not the cause — it returns the level it was
 * given, to within 0.0 dB. The provider is: Google's TTS comes back at a peak
 * of **0.41** and a voiced RMS of **0.10**, which is around 8 dB of headroom
 * simply left on the table. An `<audio>` element cannot get it back, because
 * `volume` only goes down.
 *
 * Two things then made it worse for the male anchor specifically:
 *
 *  * the music bed ducks to 0.12 under a voice, which against a voice at 0.10
 *    is not a bed under an anchor, it is a duet;
 *  * dropping pitch and formants by 0.7 moves the energy out of the 1-4 kHz
 *    band the ear is most sensitive to, so the *same* RMS reads as noticeably
 *    quieter. That is perception, not arithmetic, and no amount of measuring
 *    the waveform will show it.
 *
 * So the level is set here, on the samples, where it can be exact — and the
 * male anchor gets a deliberate extra push to land at the same *perceived*
 * loudness as his co-presenter rather than the same measured one.
 * ------------------------------------------------------------------ */

/** Where a spoken line should sit. Chosen against the ducked bed, not in isolation. */
export const TARGET_RMS = 0.2;

/**
 * Never louder than this, so nothing ever clips.
 *
 * 0.89 rather than 0.97, and the eight hundredths are not caution — they are
 * the difference between a clean voice and a distorted one.
 *
 * These samples do not go to the speakers. They go into a compressor and then a
 * makeup gain of `VOICE_MAKEUP` (`speechAudio.ts`), and a compressor has an
 * ATTACK: for the first few milliseconds of a plosive after a pause it is not
 * yet reducing anything, so whatever peak arrives is multiplied by the full
 * makeup. At 0.97 that is 0.97 x 3.4 = **3.3**, which is not "a bit hot", it is
 * eleven decibels into hard clipping on the front of every stressed consonant.
 *
 * That was reported as "the Arabic male voice has a lot of noise", and the
 * reason it was loudest on the reshaped voice is arithmetic: the shaped path
 * aims a fifth higher again. A limiter and a soft-clip now stand behind this,
 * but the cheapest fix is not to hand the chain a signal it cannot survive.
 */
export const PEAK_CEILING = 0.89;

/**
 * How much louder the reshaped voice has to be to SOUND as loud.
 *
 * Empirical, and it is compensating for a perceptual effect rather than a
 * measurable one — a 0.7 resample moves the whole spectrum down by a third,
 * away from where hearing is most sensitive. Matching RMS leaves him audibly
 * behind; this closes it without approaching the ceiling.
 *
 * ============================================================
 * IT IS SPENT AS A GAIN, NOT AS A HIGHER NORMALISATION TARGET
 * ============================================================
 *
 * This is the correction to the first version of the fix, and it is worth
 * knowing because the old spelling looked exactly right and did nothing at all.
 * `normalizeLevel(shaped, TARGET_RMS * MALE_LOUDNESS_MAKEUP)` asks for a fifth
 * more loudness — and `levelGain` is `min(loudness, ceiling/peak)`, so on real
 * speech, whose crest factor is four to five, the CEILING is what binds at both
 * targets and the two come out at *identical* levels. The male makeup was
 * measurable only on a test tone.
 *
 * The place where the headroom actually exists is after the compressor, so that
 * is where the multiplier goes: `speechAudio.ts` applies it to the makeup gain
 * when the clip has been reshaped. `normalizeLevel` still accepts a target, and
 * `check:newscast` still drives it that way — the function is not the thing
 * that was wrong.
 */
export const MALE_LOUDNESS_MAKEUP = 1.2;

/** Loudest sample, ignoring sign. */
export function peakOf(samples: Float32Array): number {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
        const value = samples[i] < 0 ? -samples[i] : samples[i];
        if (value > peak) peak = value;
    }
    return peak;
}

/**
 * RMS of the parts that are actually speech.
 *
 * Plain RMS over the whole clip counts the gaps between sentences, so a line
 * with a long pause in it measures quiet and gets boosted until the words
 * clip. Anything under 1% of the peak is treated as silence and left out.
 */
export function voicedRms(samples: Float32Array): number {
    const floor = peakOf(samples) * 0.01;
    let total = 0;
    let counted = 0;
    for (let i = 0; i < samples.length; i++) {
        const value = samples[i];
        if (value > floor || value < -floor) {
            total += value * value;
            counted++;
        }
    }
    return counted ? Math.sqrt(total / counted) : 0;
}

/**
 * The gain that brings a clip to `targetRms` without going past `ceiling`.
 *
 * Loudness first, peak as a backstop — the other way round (peak normalisation
 * alone) leaves two clips at the same peak and audibly different volumes,
 * because speech has a high crest factor and one loud consonant decides the
 * whole answer.
 */
export function levelGain(
    samples: Float32Array,
    targetRms = TARGET_RMS,
    ceiling = PEAK_CEILING,
): number {
    const rms = voicedRms(samples);
    const peak = peakOf(samples);
    if (!rms || !peak) return 1;
    return Math.min(targetRms / rms, ceiling / peak);
}

/** `samples` brought to a sensible broadcast level, in place. */
export function normalizeLevel(
    samples: Float32Array,
    targetRms = TARGET_RMS,
    ceiling = PEAK_CEILING,
): Float32Array {
    const gain = levelGain(samples, targetRms, ceiling);
    if (Math.abs(gain - 1) < 0.01) return samples;
    for (let i = 0; i < samples.length; i++) samples[i] *= gain;
    return samples;
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
 * best continues what has already been written, which lines the periods up.
 *
 * ============================================================
 * THE CORRELATION IS NORMALISED, AND THAT IS THE WHOLE OF "IT SOUNDS NOISY"
 * ============================================================
 *
 * The first version scored each candidate on a bare dot product,
 * `sum(written[j] * candidate[j])`, and picked the largest. A dot product grows
 * with the candidate's own AMPLITUDE as well as with its similarity, so on any
 * passage where loudness is changing — which is every consonant, every vowel
 * onset and every word ending in the language — the search does not find the
 * position that continues the waveform, it finds the LOUDEST position inside
 * the search window. What that produces is a frame lifted out of the middle of
 * the next syllable laid over the tail of this one: a periodic buzz at the hop
 * rate (~89 Hz here, squarely in the voice band) plus a granular roughness on
 * every transient.
 *
 * It was reported as "the Arabic male voice has a lot of noise", and it is
 * worse on him than on anybody else for two compounding reasons: he is the only
 * voice that goes through this function at all, and dropping the spectrum by
 * 0.7 moves that buzz from 89 Hz to 62 Hz, where it stops being a pitch and
 * becomes a rattle.
 *
 * Dividing by the candidate's own energy — an ordinary normalised
 * cross-correlation — makes the score a measure of SHAPE rather than of
 * loudness, which is what the algorithm needs and what its name has always
 * promised. `energyAt` below is a prefix sum, so the normalisation costs one
 * subtraction per candidate rather than a second inner loop.
 *
 * ============================================================
 * COARSE THEN FINE, BECAUSE THE OLD SHORTCUT COST RESOLUTION
 * ============================================================
 *
 * The search is +-one period of a 70 Hz voice, so at 24 kHz it is +-343
 * samples, and scoring every one of them against a 267-sample window is 183 000
 * multiply-adds per frame. The first version paid for that by stepping every
 * OTHER offset, which halves the cost and also halves the resolution — and half
 * a sample of misalignment at 4 kHz is a quarter of a cycle.
 *
 * A coarse pass at a stride of four followed by a fine pass over +-4 samples
 * around its winner is a quarter of the cost of the original AND lands on the
 * exact best offset. A pitch-period correlation is smooth at this scale, so the
 * coarse pass cannot pick the wrong lobe.
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

    // Search +- one period of the lowest voice worth tracking (~70 Hz). Any
    // wider and the search starts matching the *previous* period, which is
    // audible as a stutter rather than as a smoother join.
    const search = Math.min(Math.round(rate / 70), Math.floor(frame / 2));
    /*
      The comparison window is ONE PERIOD of the lowest voice, not one hop.

      It used to be `min(synthesisHop, 256)`, which at 24 kHz is 256 samples and
      happens to be about right; at 48 kHz it was 256 against a 555-sample
      period, i.e. less than half a cycle — and half a cycle of a periodic
      signal correlates almost as well with the wrong period as with the right
      one. Deriving it from the rate is what makes the quality the same whatever
      sample rate the provider hands back.
    */
    const correlate = Math.max(64, Math.min(frame - synthesisHop, Math.round(rate / 90)));
    /** Coarse stride, then +-this many samples at full resolution. */
    const coarse = 4;

    const outLength = Math.max(1, Math.round(input.length * scale));
    const accumulated = new Float32Array(outLength + frame);
    const weight = new Float32Array(outLength + frame);
    const window = hann(frame);

    /*
      Prefix sum of squares, in float64.

      This is what makes the normalisation free: the energy of any window is one
      subtraction. Float64 rather than Float32 because a prefix sum over a
      minute of audio accumulates to a large number while the differences taken
      out of it are small — in float32 the tail of a long clip would end up
      normalising against rounding error.
    */
    const square = new Float64Array(input.length + 1);
    for (let i = 0; i < input.length; i++) {
        const v = input[i] as number;
        square[i + 1] = (square[i] as number) + v * v;
    }
    const energyAt = (at: number) =>
        (square[Math.min(square.length - 1, at + correlate)] as number)
        - (square[at] as number);

    let writeAt = 0;
    let index = 0;
    /** Where the last frame read to, and wrote to — the tail fill needs both. */
    let readEnd = 0;
    let writeEnd = 0;
    while (writeAt + frame <= accumulated.length) {
        const ideal = Math.round(index * analysisHop);
        if (ideal + frame > input.length) break;

        let start = ideal;
        if (index > 0 && search > 0) {
            const lowest = Math.max(0, ideal - search);
            const highest = Math.min(input.length - frame, ideal + search);
            const score = (candidate: number): number => {
                let dot = 0;
                for (let j = 0; j < correlate; j++) {
                    dot += (accumulated[writeAt + j] as number)
                        * (input[candidate + j] as number);
                }
                // Normalised: how well the shapes AGREE, independent of how
                // loud the candidate happens to be. See the header.
                return dot / Math.sqrt(energyAt(candidate) + 1e-9);
            };
            let best = -Infinity;
            for (let candidate = lowest; candidate <= highest; candidate += coarse) {
                const s = score(candidate);
                if (s > best) { best = s; start = candidate; }
            }
            const from = Math.max(lowest, start - coarse);
            const to = Math.min(highest, start + coarse);
            for (let candidate = from; candidate <= to; candidate++) {
                const s = score(candidate);
                if (s > best) { best = s; start = candidate; }
            }
        }

        for (let j = 0; j < frame; j++) {
            accumulated[writeAt + j] += (input[start + j] as number) * (window[j] as number);
            weight[writeAt + j] += window[j] as number;
        }
        readEnd = start + frame;
        writeEnd = writeAt + frame;
        writeAt += synthesisHop;
        index++;
    }

    /*
      THE TAIL, which the loop above cannot reach and used to leave as silence.

      The loop stops as soon as the next frame would run off the end of the
      input, and that happens while there is still `scale * frame` of OUTPUT
      left — about 31 ms at these numbers. Left at zero weight it divides to
      silence, so the last syllable of every line was clipped short and faded
      out, and a truncated word is indistinguishable from a truncated synthesis.

      Copying the remaining input straight in at full weight is exact here
      rather than approximate: at the end of a line there is no next frame to
      align to, so there is nothing for an overlap-add to buy.
    */
    if (writeEnd > 0 && readEnd < input.length) {
        for (let i = writeEnd; i < accumulated.length; i++) {
            const from = readEnd + (i - writeEnd);
            if (from >= input.length) break;
            accumulated[i] = input[from] as number;
            weight[i] = 1;
        }
    }

    // Divide out the window sum rather than assuming it is constant: the first
    // and last frames are only half covered, and without this the line fades in
    // and out on every segment.
    const output = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
        output[i] = (weight[i] as number) > 1e-4
            ? (accumulated[i] as number) / (weight[i] as number)
            : 0;
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
