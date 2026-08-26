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
 * gain then lifts everything — so the average rises by ~10 dB while the peak
 * stays under the ceiling. It is applied to the graph rather than baked into
 * the samples so that `voiceShaper.ts` stays a pure function of a Float32Array
 * and `check:newscast` can go on driving it in node.
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

/**
 * Makeup gain, as a multiplier.
 *
 * Derived rather than dialled in: at a -18 dB threshold and 3:1, a line peaking
 * at -0.3 dBFS comes out at about -12.2 dBFS, so 3.4x (≈10.6 dB) puts the peak
 * back at roughly -1.5 dBFS. That is the whole of the loudness increase, and it
 * is why the number is not simply "louder" — anything above this starts
 * clipping the compressor's own output on a transient it did not catch.
 */
export const VOICE_MAKEUP = 3.4;

/** Roughly the RMS a levelled, compressed voice reaches. Scales {@link energy}. */
const ENERGY_REFERENCE = 0.34;

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
    let compressor: DynamicsCompressorNode | null = null;
    let makeup: GainNode | null = null;
    let analyser: AnalyserNode | null = null;
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
        compressor = context.createDynamicsCompressor();
        compressor.threshold.value = COMPRESSOR_THRESHOLD_DB;
        compressor.knee.value = 10;
        compressor.ratio.value = COMPRESSOR_RATIO;
        // Fast enough to catch a plosive, slow enough not to chop the front off
        // a word; the release is long enough that it does not breathe between
        // syllables, which is the artefact that sounds like a bad compressor.
        compressor.attack.value = 0.004;
        compressor.release.value = 0.18;

        makeup = context.createGain();
        makeup.gain.value = VOICE_MAKEUP;

        analyser = context.createAnalyser();
        // 1024 is ~21 ms at 48 kHz — one reading per frame, over about the
        // shortest span in which a mouth position means anything.
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.4;
        probe = new Float32Array(analyser.fftSize);

        compressor.connect(makeup);
        makeup.connect(analyser);
        analyser.connect(context.destination);
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
            if (!ctx || !compressor) return;
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
                    // A reshaped voice is aimed higher, because the same RMS an
                    // octave lower reads as quieter. See MALE_LOUDNESS_MAKEUP.
                    normalizeLevel(shaped, ratio === IDENTITY_RATIO
                        ? TARGET_RMS : TARGET_RMS * MALE_LOUDNESS_MAKEUP);
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
                    node.connect(compressor!);
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
            if (!analyser || !probe || !source) return 0;
            analyser.getFloatTimeDomainData(probe as Float32Array<ArrayBuffer>);
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
