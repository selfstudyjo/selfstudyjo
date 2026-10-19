/**
 * Deciding, twenty times a second, whether somebody is speaking -- and where an
 * utterance ends.
 *
 * Plain module -- no Web Audio, no DOM -- on the `answerEditing.ts` precedent,
 * because every decision in here is invisible in a screenshot and fails quietly
 * in exactly the way it was reported: "without speaking anything it fills random
 * words, and sometimes changes words I said". `micCapture.ts` feeds it a level
 * per frame and does what it says. Verified by `npm run check:speechcapture`.
 *
 * WHAT THE OLD RECORDER DID, AND WHY BOTH COMPLAINTS FOLLOWED FROM IT
 *
 * A fixed 3.5-second chunk, sent whatever was in it. So:
 *
 *  1. SILENCE WAS SENT. Whisper does not return nothing for silence -- it
 *     returns the most probable caption for nothing ("Thank you.", "Thanks for
 *     watching"), and a candidate thinking quietly watched words appear. Here a
 *     segment with no sustained speech in it is DISCARDED and never leaves the
 *     browser.
 *  2. WORDS WERE CUT IN HALF. A clock does not know where a word ends, so every
 *     3.5 seconds a word was split across two chunks and each half was guessed
 *     at on its own -- the "changes words I talked" half. Here a segment ends
 *     only in a PAUSE: after a phrase and a moment of silence, or -- for
 *     somebody who never pauses -- at the next short gap after twelve seconds,
 *     and only as a last resort at twenty.
 *
 * WHAT COUNTS AS SPEECH
 *
 * A level above an ADAPTIVE noise floor by a margin, never a fixed threshold: a
 * laptop fan, a café and a quiet bedroom are thirty decibels apart, and a fixed
 * line is either deaf in the café or triggered by the fan. The floor follows
 * the quiet frames quickly downwards and creeps up only slowly, so a long
 * sentence does not teach it that speech is background. And a single loud frame
 * is not speech: a key press, a click and a cough are transients, and speech is
 * sustained, so a frame only counts once it is the second loud one in a row --
 * which matters because the candidate TYPES into the answer box while the
 * microphone is open.
 *
 * And a STEADY sound is not speech either. A voice rises and falls with every
 * syllable -- several decibels inside a second -- while a fan, an air
 * conditioner or traffic hum holds one level. So loud audio that has barely
 * moved for a second and a half is treated as the room getting louder: the
 * floor jumps to it and it is not counted as voiced. That is what lets the
 * floor creep only very slowly during real speech (a long sentence must not
 * teach it that speech is background) and still learn a fan in seconds.
 */

export interface SegmenterOptions {
    /** One frame of level readings, in ms. */
    frameMs: number;
    /** Never call anything quieter than this speech, whatever the floor. */
    minSpeechDb: number;
    /** How far above the noise floor speech must be. */
    marginDb: number;
    /** The pause that ends an utterance. */
    endSilenceMs: number;
    /** A segment shorter than this is not cut at a pause; it waits for more. */
    minSegmentMs: number;
    /** Past this, a SHORT pause is enough to cut. */
    softMaxMs: number;
    /** The short pause that is enough once softMaxMs has passed. */
    softSilenceMs: number;
    /** Past this, cut wherever we are. */
    hardMaxMs: number;
    /** Less voiced audio than this in a segment and it is discarded unsent. */
    minVoicedMs: number;
    /** A segment with no speech at all is recycled after this, unsent. */
    idleRecycleMs: number;
    /** Consecutive loud frames before any of them counts as speech. */
    onsetFrames: number;
    /** Frames of history used to tell a voice from a steady noise. */
    steadyWindow: number;
    /** Below this spread (dB, standard deviation) a sustained sound is steady. */
    steadySpreadDb: number;
}

export const DEFAULT_SEGMENTER: SegmenterOptions = {
    frameMs: 50,
    minSpeechDb: -55,
    marginDb: 9,
    endSilenceMs: 750,
    minSegmentMs: 1200,
    softMaxMs: 12000,
    softSilenceMs: 250,
    hardMaxMs: 20000,
    minVoicedMs: 350,
    idleRecycleMs: 5000,
    onsetFrames: 2,
    steadyWindow: 30,
    steadySpreadDb: 1.5,
};

/** What happened in one frame. */
export interface FrameResult {
    /** Speech right now -- for the level meter, smoothed by a short hangover. */
    speaking: boolean;
    /** The floor speech is measured against, in dB. */
    noiseFloor: number;
    /** Set when the current segment should end here. */
    cut: null | { keep: boolean; voicedMs: number; durationMs: number; reason: CutReason };
}

export type CutReason = 'pause' | 'soft-max' | 'hard-max' | 'idle' | 'flush';

/** RMS of a block of samples, as dBFS. Silence is -100, not -Infinity. */
export function rmsDb(samples: ArrayLike<number>): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / Math.max(1, samples.length));
    return rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
}

export class SpeechSegmenter {
    readonly opts: SegmenterOptions;
    noiseFloor = -60;
    private calibrated = 0;
    private loudRun = 0;
    private silenceRun = 0;
    private segmentMs = 0;
    private voicedMs = 0;
    private hangover = 0;
    private history: number[] = [];

    constructor(options: Partial<SegmenterOptions> = {}) {
        this.opts = { ...DEFAULT_SEGMENTER, ...options };
    }

    /** Where speech starts for the current floor. */
    threshold(): number {
        return Math.max(this.opts.minSpeechDb, this.noiseFloor + this.opts.marginDb);
    }

    /** Standard deviation of the recent levels, in dB. */
    private spread(): number {
        const n = this.history.length;
        if (n < 2) return 0;
        const mean = this.history.reduce((a, b) => a + b, 0) / n;
        return Math.sqrt(this.history.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
    }

    /** Start a fresh segment -- after a cut, or when recording resumes. */
    resetSegment(): void {
        this.segmentMs = 0;
        this.voicedMs = 0;
        this.silenceRun = 0;
        this.loudRun = 0;
    }

    push(db: number): FrameResult {
        const o = this.opts;
        const level = Number.isFinite(db) ? db : -100;

        // The first quarter-second sets the floor outright: before anybody has
        // spoken, what the microphone hears IS the room.
        if (this.calibrated < 5) {
            this.noiseFloor = this.calibrated === 0 ? level : this.noiseFloor * 0.6 + level * 0.4;
            this.calibrated++;
        }

        this.history.push(level);
        if (this.history.length > o.steadyWindow) this.history.shift();

        let loud = level > this.threshold();
        // Loud for the whole window and barely moving: machinery, not a voice.
        // Judged on the history alone, not on the loud run: detecting it resets
        // that run, and gating on it made the floor step up once every window
        // instead of following the fan.
        if (loud && this.history.length >= o.steadyWindow && this.spread() < o.steadySpreadDb) {
            this.noiseFloor = this.noiseFloor * 0.8 + level * 0.2;
            loud = false;
        }
        this.loudRun = loud ? this.loudRun + 1 : 0;
        const voiced = this.loudRun >= o.onsetFrames;

        if (!loud) {
            // Quiet frames teach the floor: quickly downwards (a door closed),
            // slowly upwards (a fan started).
            this.noiseFloor = level < this.noiseFloor
                ? this.noiseFloor * 0.7 + level * 0.3
                : this.noiseFloor * 0.97 + level * 0.03;
        } else if (!voiced) {
            // A single loud frame is not speech yet -- and must not move the
            // floor either way.
        } else {
            // Speech creeps the floor up a little, so a room that genuinely got
            // louder is learned eventually -- but a long sentence is not.
            this.noiseFloor += (level - this.noiseFloor) * 0.0005;
        }

        this.segmentMs += o.frameMs;
        if (voiced) {
            // The onset frames count too -- they were speech, we only
            // recognised it one frame late.
            this.voicedMs += this.loudRun === o.onsetFrames ? o.frameMs * o.onsetFrames : o.frameMs;
            this.silenceRun = 0;
            this.hangover = 6;
        } else {
            this.silenceRun += o.frameMs;
            if (this.hangover > 0) this.hangover--;
        }

        const result: FrameResult = { speaking: voiced || this.hangover > 0, noiseFloor: this.noiseFloor, cut: null };

        let reason: CutReason | null = null;
        if (this.voicedMs > 0 && this.silenceRun >= o.endSilenceMs && this.segmentMs >= o.minSegmentMs) reason = 'pause';
        else if (this.voicedMs > 0 && this.segmentMs >= o.softMaxMs && this.silenceRun >= o.softSilenceMs) reason = 'soft-max';
        else if (this.segmentMs >= o.hardMaxMs) reason = 'hard-max';
        else if (this.voicedMs === 0 && this.segmentMs >= o.idleRecycleMs) reason = 'idle';

        if (reason) {
            result.cut = {
                keep: this.voicedMs >= o.minVoicedMs,
                voicedMs: this.voicedMs,
                durationMs: this.segmentMs,
                reason,
            };
            this.resetSegment();
        }
        return result;
    }

    /** End the segment now -- on pause or submit. Kept only if it held speech. */
    flush(): NonNullable<FrameResult['cut']> {
        const cut = {
            keep: this.voicedMs >= this.opts.minVoicedMs,
            voicedMs: this.voicedMs,
            durationMs: this.segmentMs,
            reason: 'flush' as CutReason,
        };
        this.resetSegment();
        return cut;
    }
}

/**
 * The words Whisper is told came just before this audio: the question, then the
 * end of the answer so far. App 27 trims it again; this keeps the upload small.
 */
export function transcriptContext(answerSoFar: string, maxChars = 400): string {
    const text = String(answerSoFar || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxChars) return text;
    const cut = text.slice(-maxChars);
    // Start on a word, not halfway through one.
    const space = cut.indexOf(' ');
    return space > 0 && space < 40 ? cut.slice(space + 1) : cut;
}

/**
 * Transcripts applied in the order they were SPOKEN.
 *
 * Segments are uploaded as they end and come back whenever Whisper finishes,
 * so a short second phrase can return before a long first one. Applied as they
 * arrived, the answer would read with its sentences shuffled. Each segment gets
 * a sequence number when it is sent; a result is held until everything before
 * it has landed. A failed segment resolves as empty, so one dropped upload can
 * never block the rest of the answer.
 */
export class OrderedResults {
    private next = 0;
    private issued = 0;
    private held = new Map<number, string>();

    constructor(private apply: (text: string) => void) {}

    /** A sequence number for the segment about to be sent. */
    issue(): number {
        return this.issued++;
    }

    /** How many sent segments have not been applied yet. */
    get pending(): number {
        return this.issued - this.next;
    }

    resolve(seq: number, text: string): void {
        if (seq < this.next || this.held.has(seq)) return;
        this.held.set(seq, text);
        while (this.held.has(this.next)) {
            const t = this.held.get(this.next)!;
            this.held.delete(this.next);
            this.next++;
            if (t) this.apply(t);
        }
    }
}
