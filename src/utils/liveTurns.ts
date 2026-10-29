/**
 * Live interview turn-taking: who is talking, when a turn is over, and when the
 * candidate talked over the interviewer.
 *
 * A plain module -- no Vue, no DOM, no Web Audio -- on the `answerEditing.ts` /
 * `speechSegmenter.ts` precedent, because every decision in here is invisible in
 * a single run and only an invariant over arbitrary level sequences can show it:
 *
 *   * a COUGH or a chair creak is not the start of an answer (minimum duration);
 *   * a breath between two sentences is not the end of one (the silence gap is
 *     ~1.8 s, and only voice that has gone on long enough can end a turn at all);
 *   * a room that gets noisier does not start "speaking" on its own (the noise
 *     floor follows the room, slowly upward and quickly downward);
 *   * the interviewer's OWN voice leaking from the speakers into the microphone
 *     is not an interruption. Three layers, and they are three because each one
 *     on its own fails somewhere: the browser's echo cancellation (requested by
 *     the room, not decided here); a grace period at the start of every
 *     utterance, during which the echo level is LEARNED rather than judged; and
 *     a margin above that learned echo envelope that candidate speech has to
 *     clear, continuously, for `interruptMs`;
 *   * one interruption counts once. Somebody talking over a whole sentence has
 *     interrupted once, not fourteen times, and the next utterance re-arms it.
 *
 * The caller measures a level in dBFS every frame (an `AnalyserNode` RMS) and
 * says what the room is doing; this answers with events. It owns no clock and
 * no timers: `at` is passed in, which is what makes it drivable from a check
 * with a synthetic level sequence in a few milliseconds.
 */

export interface LiveTurnOptions {
    /** dB above the noise floor that counts as speech starting. */
    startMarginDb: number;
    /** dB above the floor that keeps speech going once started (hysteresis). */
    stopMarginDb: number;
    /** Sustained voice before it is a turn rather than a click. */
    minSpeechMs: number;
    /** Silence after voice that ends the candidate's turn. */
    endSilenceMs: number;
    /** Voice a turn must hold before silence may end it. */
    minTurnVoicedMs: number;
    /** A dip this short inside speech does not break a run. */
    gapToleranceMs: number;
    /** Sustained candidate voice over the interviewer that is an interruption. */
    interruptMs: number;
    /** dB above the echo envelope measured during AI speech. */
    interruptMarginDb: number;
    /** Nothing at the start of an AI utterance counts; the echo is learned. */
    aiGraceMs: number;
    /** Starting, lowest and highest noise floor, dBFS. */
    floorInitDb: number;
    floorMinDb: number;
    floorMaxDb: number;
}

export const DEFAULT_LIVE_OPTIONS: LiveTurnOptions = {
    startMarginDb: 12,
    stopMarginDb: 6,
    minSpeechMs: 250,
    endSilenceMs: 1800,
    minTurnVoicedMs: 800,
    gapToleranceMs: 160,
    interruptMs: 600,
    interruptMarginDb: 10,
    aiGraceMs: 300,
    floorInitDb: -60,
    floorMinDb: -90,
    floorMaxDb: -25,
};

/** What the room is doing at this frame. */
export interface LiveFrame {
    /** RMS level of the microphone, dBFS. `-Infinity` for digital silence. */
    db: number;
    /** Milliseconds, any monotonic clock. */
    at: number;
    /** The candidate's turn is open (the answer is being recorded). */
    listening: boolean;
    /** The interviewer / a bot is audibly speaking right now. */
    aiSpeaking: boolean;
    /** The candidate muted the microphone: nothing they "say" counts. */
    muted?: boolean;
    /** Do not end the turn yet (e.g. the candidate is editing the transcript). */
    hold?: boolean;
}

export type LiveEvent =
    | { type: 'speech-start'; at: number }
    | { type: 'turn-end'; at: number; voicedMs: number }
    | { type: 'interruption'; at: number; msIntoUtterance: number };

/** Frame-to-frame time is clamped, so a throttled tab cannot fake a long silence. */
const MAX_FRAME_MS = 200;

function finite(db: number, fallback: number): number {
    return Number.isFinite(db) ? db : fallback;
}

export class LiveTurns {
    readonly opts: LiveTurnOptions;
    /** The room's noise floor, dBFS. Only learned while nobody is speaking. */
    floor: number;
    /** The interviewer's echo envelope, learned during each utterance. */
    aiFloor: number;

    private lastAt: number | null = null;
    private wasListening = false;
    private wasAiSpeaking = false;

    // ── the candidate's turn ──
    /** Voice is currently going on (after `minSpeechMs`). */
    speaking = false;
    private runMs = 0;
    private runGapMs = 0;
    private voicedMs = 0;
    private silenceMs = 0;
    private spoke = false;
    private ended = false;

    // ── the interviewer's utterance ──
    private aiStart = 0;
    private intRunMs = 0;
    private intGapMs = 0;
    private interrupted = false;

    constructor(options: Partial<LiveTurnOptions> = {}) {
        this.opts = { ...DEFAULT_LIVE_OPTIONS, ...options };
        this.floor = this.opts.floorInitDb;
        this.aiFloor = this.floor;
    }

    /** Has the candidate interrupted the CURRENT utterance already? */
    get interruptedThisUtterance(): boolean { return this.interrupted; }

    /** Forget the open turn (a new question, a new speech). The floor is kept. */
    resetTurn(): void {
        this.speaking = false;
        this.runMs = 0;
        this.runGapMs = 0;
        this.voicedMs = 0;
        this.silenceMs = 0;
        this.spoke = false;
        this.ended = false;
    }

    push(frame: LiveFrame): LiveEvent[] {
        const o = this.opts;
        const events: LiveEvent[] = [];
        const dt = this.lastAt === null ? 0 : Math.max(0, Math.min(MAX_FRAME_MS, frame.at - this.lastAt));
        this.lastAt = frame.at;
        const muted = !!frame.muted;
        const db = muted ? -Infinity : finite(frame.db, -Infinity);
        const level = finite(db, o.floorMinDb);

        // ── edges ──
        if (frame.listening && !this.wasListening) this.resetTurn();
        if (!frame.listening && this.wasListening) this.resetTurn();
        this.wasListening = frame.listening;

        if (frame.aiSpeaking && !this.wasAiSpeaking) {
            this.aiStart = frame.at;
            this.aiFloor = this.floor;
            this.intRunMs = 0;
            this.intGapMs = 0;
            this.interrupted = false;
        }
        this.wasAiSpeaking = frame.aiSpeaking;

        if (frame.aiSpeaking) {
            if (!muted) this.trackInterruption(frame.at, level, dt, events);
            return events;
        }

        // ── the room's floor: only while nobody is speaking ──
        if (!muted && !this.speaking && this.runMs === 0) this.learnFloor(level);

        if (frame.listening && !this.ended) this.trackTurn(frame, level, dt, events);
        return events;
    }

    private learnFloor(level: number): void {
        const o = this.opts;
        if (level < this.floor) {
            // Quickly DOWN: a quieter room is believed at once.
            this.floor += (level - this.floor) * 0.2;
        } else if (level < this.floor + o.startMarginDb) {
            // Slowly UP, and only by sounds that are not speech: a fan coming on
            // is learned over seconds, while a voice is never learned at all.
            this.floor += (level - this.floor) * 0.02;
        }
        this.floor = Math.max(o.floorMinDb, Math.min(o.floorMaxDb, this.floor));
    }

    private trackTurn(frame: LiveFrame, level: number, dt: number, events: LiveEvent[]): void {
        const o = this.opts;
        const start = this.floor + o.startMarginDb;
        const keep = this.floor + o.stopMarginDb;

        if (!this.speaking) {
            if (level >= start) {
                this.runMs += dt;
                this.runGapMs = 0;
            } else if (this.runMs > 0) {
                this.runGapMs += dt;
                if (this.runGapMs > o.gapToleranceMs) { this.runMs = 0; this.runGapMs = 0; }
            }
            if (this.runMs >= o.minSpeechMs) {
                this.speaking = true;
                this.spoke = true;
                this.voicedMs += this.runMs;
                this.silenceMs = 0;
                this.runMs = 0;
                this.runGapMs = 0;
                events.push({ type: 'speech-start', at: frame.at });
            } else if (this.spoke) {
                // Between bursts of an answer: the silence clock keeps running.
                this.silenceMs += dt;
            }
        } else if (level >= keep) {
            this.voicedMs += dt;
            this.silenceMs = 0;
        } else {
            this.silenceMs += dt;
            if (this.silenceMs > o.gapToleranceMs) this.speaking = false;
        }

        if (frame.hold) { this.silenceMs = 0; return; }
        if (this.spoke && !this.speaking && this.voicedMs >= o.minTurnVoicedMs
            && this.silenceMs >= o.endSilenceMs) {
            events.push({ type: 'turn-end', at: frame.at, voicedMs: Math.round(this.voicedMs) });
            this.ended = true;
        }
    }

    private trackInterruption(at: number, level: number, dt: number, events: LiveEvent[]): void {
        const o = this.opts;
        const into = at - this.aiStart;
        if (into < o.aiGraceMs) {
            // Learn the echo envelope, fast, and judge nothing.
            if (level > this.aiFloor) this.aiFloor += (level - this.aiFloor) * 0.3;
            return;
        }
        const threshold = Math.max(this.floor + o.startMarginDb, this.aiFloor + o.interruptMarginDb);
        if (level >= threshold) {
            this.intRunMs += dt;
            this.intGapMs = 0;
        } else {
            // Below the bar is echo (or quiet): keep learning its envelope --
            // quickly up, slowly down -- and let a long enough dip break a run.
            if (level > this.aiFloor) this.aiFloor += (level - this.aiFloor) * 0.3;
            else this.aiFloor += (level - this.aiFloor) * 0.02;
            if (this.intRunMs > 0) {
                this.intGapMs += dt;
                if (this.intGapMs > o.gapToleranceMs) { this.intRunMs = 0; this.intGapMs = 0; }
            }
        }
        if (!this.interrupted && this.intRunMs >= o.interruptMs) {
            this.interrupted = true;
            events.push({ type: 'interruption', at, msIntoUtterance: Math.round(into) });
        }
    }
}

/** RMS of a time-domain buffer, in dBFS. Shared by the rooms. */
export function rmsDb(buffer: ArrayLike<number>): number {
    let total = 0;
    for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i] as number;
        total += v * v;
    }
    const rms = Math.sqrt(total / Math.max(1, buffer.length));
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

/** One recorded interruption, as stored on the session and sent to app 27. */
export interface InterruptionRecord {
    /** ISO time it happened. */
    at: string;
    /** 1-based question number (Job Interview), or 0 outside a question. */
    question?: number;
    /** Which bot was speaking (Toastmasters). */
    role?: string;
    /** How far into the interviewer's line it happened. */
    ms_into_utterance: number;
}

/** Clean a list for sending: bounded, well-formed, newest last. */
export function cleanInterruptions(list: unknown, max = 50): InterruptionRecord[] {
    if (!Array.isArray(list)) return [];
    const out: InterruptionRecord[] = [];
    for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue;
        const r = raw as Record<string, unknown>;
        const ms = Math.max(0, Math.round(Number(r.ms_into_utterance) || 0));
        const rec: InterruptionRecord = { at: String(r.at || ''), ms_into_utterance: ms };
        if (r.question !== undefined) rec.question = Math.max(0, Math.round(Number(r.question) || 0));
        if (r.role !== undefined) rec.role = String(r.role).slice(0, 40);
        out.push(rec);
    }
    return out.slice(-max);
}
