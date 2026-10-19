/**
 * The microphone for a spoken answer: a clean signal, cut into utterances, with
 * silence never sent.
 *
 * The DOM half; every decision is in `speechSegmenter.ts`, which is plain and
 * checked. What this file owns is the audio graph and the recorders.
 *
 *   mic ─► high-pass 85 Hz ─► low-pass 7.8 kHz ─┬─► compressor ─► gain ─► recorder (mono Opus)
 *                                               └─► analyser ─► segmenter (20×/s)
 *
 *  * The browser's own processing is asked for first (`AUDIO_CONSTRAINTS`:
 *    echo cancellation, noise suppression, automatic gain). It is the best
 *    there is for a voice and costs nothing.
 *  * The HIGH-PASS removes what is below a voice -- desk thumps, traffic, a fan's
 *    hum, handling noise -- which Whisper otherwise hears as syllables.
 *  * The LOW-PASS removes hiss above the speech band. Whisper resamples to
 *    16 kHz, so nothing above 8 kHz ever reached it as speech anyway.
 *  * The COMPRESSOR evens out a voice that drops at the end of a sentence or
 *    turns away from the laptop, so the quiet last word is as legible as the
 *    loud first one. Gentle on purpose: a heavy compressor raises the room noise
 *    between words, which is the opposite of the point.
 *  * The ANALYSER reads the filtered signal BEFORE compression, because the
 *    compressor would raise the floor and blur speech against silence.
 *  * The RECORDER takes the processed stream, mono, at a bitrate that is generous
 *    for speech and small to upload.
 *
 * One MediaRecorder per utterance, started the moment the last one stops: each
 * blob is then a complete file Whisper can decode on its own, and because a cut
 * only ever happens in a pause, the few milliseconds between them hold nothing.
 */

import { SpeechSegmenter, rmsDb, type FrameResult } from './speechSegmenter';

export interface CapturedSegment {
    blob: Blob;
    voicedMs: number;
    durationMs: number;
}

export interface MicCaptureOptions {
    onSegment: (segment: CapturedSegment) => void;
    /** Called every frame -- for a level meter. `level` is 0..1. */
    onLevel?: (level: number, speaking: boolean) => void;
}

function preferredMime(): string {
    const types = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    for (const t of types) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
}

/** Whether the processed pipeline can run here at all. */
export function canProcessAudio(): boolean {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    return Boolean(Ctx) && typeof MediaRecorder !== 'undefined'
        && typeof (Ctx.prototype as any).createMediaStreamDestination === 'function';
}

export class MicCapture {
    private ctx: AudioContext | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private analyser: AnalyserNode | null = null;
    private dest: MediaStreamAudioDestinationNode | null = null;
    private nodes: AudioNode[] = [];
    private recorder: MediaRecorder | null = null;
    private chunks: Blob[] = [];
    private timer: ReturnType<typeof setInterval> | null = null;
    private buffer: Float32Array<ArrayBuffer> | null = null;
    private segmenter = new SpeechSegmenter();
    private running = false;
    /** Without Web Audio there is no level to read, so segments are timed. */
    private fallback = false;
    private fallbackStarted = 0;

    constructor(private stream: MediaStream, private options: MicCaptureOptions) {}

    get isRunning(): boolean { return this.running; }

    /** Build the graph (once) and start listening. Call inside a user gesture. */
    async start(): Promise<void> {
        if (this.running) return;
        if (!this.ctx && !this.fallback) this.build();
        if (this.ctx && this.ctx.state === 'suspended') {
            try { await this.ctx.resume(); } catch { /* resumed on the next gesture */ }
        }
        this.segmenter.resetSegment();
        this.running = true;
        this.startRecorder();
        this.timer = setInterval(() => this.tick(), this.segmenter.opts.frameMs);
    }

    /**
     * Stop listening; whatever was being said is sent if it held speech.
     *
     * Resolves once that last utterance has been HANDED OVER (or discarded) --
     * a recorder's `stop` is asynchronous, and a caller that went on to wait
     * for pending transcripts before the last one was even queued would wait
     * for nothing and lose the end of the answer.
     */
    pause(): Promise<void> {
        if (!this.running) return Promise.resolve();
        this.running = false;
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        const cut = this.fallback ? { keep: true, voicedMs: 1, durationMs: 0 } : this.segmenter.flush();
        this.options.onLevel?.(0, false);
        return this.stopRecorder(cut.keep, cut.voicedMs, cut.durationMs);
    }

    /** Tear everything down. The stream itself belongs to the caller. */
    dispose(): void {
        void this.pause();
        for (const n of this.nodes) { try { n.disconnect(); } catch { /* already */ } }
        try { this.source?.disconnect(); } catch { /* already */ }
        this.nodes = [];
        if (this.ctx) { void this.ctx.close().catch(() => undefined); }
        this.ctx = null;
    }

    private build(): void {
        if (!canProcessAudio()) { this.fallback = true; return; }
        try {
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
            const ctx: AudioContext = new Ctx();
            const source = ctx.createMediaStreamSource(this.stream);
            const highpass = ctx.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = 85;
            highpass.Q.value = 0.7;
            const lowpass = ctx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = 7800;
            lowpass.Q.value = 0.7;
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.value = -26;
            compressor.knee.value = 12;
            compressor.ratio.value = 3;
            compressor.attack.value = 0.005;
            compressor.release.value = 0.25;
            const gain = ctx.createGain();
            gain.gain.value = 1.6;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0;
            const dest = ctx.createMediaStreamDestination();
            dest.channelCount = 1;

            source.connect(highpass);
            highpass.connect(lowpass);
            lowpass.connect(analyser);
            lowpass.connect(compressor);
            compressor.connect(gain);
            gain.connect(dest);

            this.ctx = ctx;
            this.source = source;
            this.analyser = analyser;
            this.dest = dest;
            this.nodes = [highpass, lowpass, compressor, gain, analyser, dest];
            this.buffer = new Float32Array(analyser.fftSize);
        } catch (e) {
            console.warn('[mic] processed capture unavailable, recording raw:', e);
            this.fallback = true;
            this.ctx = null;
        }
    }

    private tick(): void {
        if (!this.running) return;
        if (this.fallback || !this.analyser || !this.buffer) {
            // No level to read (no Web Audio): cut on a clock, as the old
            // recorder did -- at six seconds rather than 3.5, so fewer words
            // land on a boundary. Every modern browser takes the path above.
            if (Date.now() - this.fallbackStarted >= 6000) {
                void this.stopRecorder(true, 1, 6000);
                this.startRecorder();
            }
            return;
        }
        this.analyser.getFloatTimeDomainData(this.buffer);
        const db = rmsDb(this.buffer);
        const frame: FrameResult = this.segmenter.push(db);
        const level = Math.max(0, Math.min(1, (db + 70) / 55));
        this.options.onLevel?.(level, frame.speaking);
        if (frame.cut) {
            void this.stopRecorder(frame.cut.keep, frame.cut.voicedMs, frame.cut.durationMs);
            this.startRecorder();
        }
    }

    private startRecorder(): void {
        const stream = this.dest ? this.dest.stream : new MediaStream(this.stream.getAudioTracks());
        const mimeType = preferredMime();
        let recorder: MediaRecorder;
        try {
            recorder = mimeType
                ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48000 })
                : new MediaRecorder(stream);
        } catch {
            try { recorder = new MediaRecorder(stream); } catch { this.recorder = null; return; }
        }
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        this.chunks = chunks;
        this.recorder = recorder;
        this.fallbackStarted = Date.now();
        try { recorder.start(); } catch { this.recorder = null; }
    }

    private stopRecorder(keep: boolean, voicedMs: number, durationMs: number): Promise<void> {
        const recorder = this.recorder;
        const chunks = this.chunks;
        this.recorder = null;
        if (!recorder) return Promise.resolve();
        return new Promise(resolve => {
            // A recorder that never fires `onstop` must not hang a Submit.
            const guard = setTimeout(resolve, 2500);
            recorder.onstop = () => {
                clearTimeout(guard);
                // Silence is discarded HERE, before it can reach Whisper -- the
                // whole reason for this file.
                if (keep && chunks.length > 0) {
                    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
                    if (blob.size >= 1000) this.options.onSegment({ blob, voicedMs, durationMs });
                }
                resolve();
            };
            if (recorder.state !== 'inactive') {
                try { recorder.stop(); } catch { clearTimeout(guard); resolve(); }
            } else {
                clearTimeout(guard);
                resolve();
            }
        });
    }
}
