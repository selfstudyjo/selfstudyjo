/**
 * The browser half of live turn-taking: read the microphone's level every frame
 * and hand it to the room, which feeds `LiveTurns` (src/utils/liveTurns.ts).
 *
 * Kept apart from that module on purpose -- this one touches Web Audio and a
 * timer, and `liveTurns.ts` stays plain so `npm run check:liveturns` can drive
 * every decision without a browser.
 *
 * Its OWN AudioContext and analyser, separate from `MicCapture`'s. The capture
 * only runs while an answer is being recorded; interruption detection has to
 * listen while the INTERVIEWER is speaking, which is exactly when the capture
 * is off. Two contexts reading one MediaStream is supported everywhere and
 * costs one analyser.
 *
 * The stream is requested by the room with echoCancellation, noiseSuppression
 * and autoGainControl on (`AUDIO_CONSTRAINTS`), which is the first of the three
 * layers that stop the interviewer's own voice reading as the candidate.
 *
 * A `setInterval` rather than an animation frame: a rAF stops in a background
 * tab, and a live interview keeps running while the candidate glances at their
 * notes in another window.
 */

import { rmsDb } from './liveTurns';

export const LIVE_FRAME_MS = 50;

export class LiveMonitor {
    private ctx: AudioContext | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private analyser: AnalyserNode | null = null;
    private buffer: Float32Array<ArrayBuffer> | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;

    private stream: MediaStream;
    private onFrame: (db: number) => void;

    constructor(stream: MediaStream, onFrame: (db: number) => void) {
        this.stream = stream;
        this.onFrame = onFrame;
    }

    get running(): boolean { return this.timer !== null; }

    /** Start listening. Call inside a user gesture so the context is not suspended. */
    start(): boolean {
        if (this.timer !== null) return true;
        try {
            if (!this.ctx) {
                const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
                if (!Ctx) return false;
                const ctx: AudioContext = new Ctx();
                const source = ctx.createMediaStreamSource(this.stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 1024;
                analyser.smoothingTimeConstant = 0;
                source.connect(analyser);
                this.ctx = ctx;
                this.source = source;
                this.analyser = analyser;
                this.buffer = new Float32Array(analyser.fftSize);
            }
            if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
        } catch (e) {
            console.warn('[live] level monitor unavailable:', e);
            return false;
        }
        this.timer = setInterval(() => this.tick(), LIVE_FRAME_MS);
        return true;
    }

    stop(): void {
        if (this.timer !== null) clearInterval(this.timer);
        this.timer = null;
    }

    dispose(): void {
        this.stop();
        try { this.source?.disconnect(); } catch { /* already */ }
        if (this.ctx) void this.ctx.close().catch(() => undefined);
        this.ctx = null;
        this.source = null;
        this.analyser = null;
    }

    private tick(): void {
        if (!this.analyser || !this.buffer) return;
        this.analyser.getFloatTimeDomainData(this.buffer);
        this.onFrame(rmsDb(this.buffer));
    }
}
