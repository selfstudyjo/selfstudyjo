// src/components/userchat/chatMedia.ts
//
// Making a picture or a voice note small **before** it is uploaded.
//
// A plain module rather than a component, on the same precedent as
// `photoMask.ts` and `drawEngine.ts`: the interesting parts are pure functions
// over numbers, so they can be verified with `npm run check:chatmedia` instead of
// only by clicking around in a browser.
//
// **Why compress here when the backend compresses anyway?** Because they save
// different things. The backend's re-encode (utils/media.py in selfstudyuserchat)
// is what makes the size limit a limit — a client can be old, or a script, or the
// admin console. Doing it here is what stops four megabytes crossing the network
// in the first place, which is the only saving that also makes the upload fast on
// a phone. Both are needed and neither replaces the other.
//
// The numbers below are deliberately a little more generous than the backend's,
// so the server re-encode is a no-op in the normal case rather than a second
// lossy pass over an already-lossy image. Compressing twice at the same quality
// is visibly worse than compressing once.

/** Longest edge of an uploaded picture. The backend's ceiling is 1600; going in
 *  at the same number means its re-encode finds nothing to do. */
export const MAX_IMAGE_EDGE = 1600;

/** JPEG quality for the browser encode. Slightly above the backend's 78 so the
 *  server pass, if it happens at all, is not re-quantising our own artefacts. */
export const IMAGE_QUALITY = 0.82;

/** Opus at this bitrate is clear speech and about 3 KB/s, so a one-minute voice
 *  note is roughly 180 KB. Raising it buys nothing audible for a voice. */
export const AUDIO_BITS_PER_SECOND = 24000;

/** A voice note is a sentence, not a lecture. Matches MAX_AUDIO_SECONDS on the
 *  backend, which would refuse anything longer anyway — better to stop the
 *  recording than to reject it after the upload. */
export const MAX_RECORDING_SECONDS = 300;

export interface PreparedImage {
    blob: Blob;
    width: number;
    height: number;
    /** Bytes before the browser re-encode, for the "compressed from" hint. */
    originalBytes: number;
}

/**
 * Fit `(width, height)` inside a square of `maxEdge`, preserving aspect ratio.
 *
 * Pure, and separated out because every off-by-one in image scaling lives here:
 * the rounding has to floor rather than round, or a 1601 px image can come back
 * as 1601 and fail the very limit this exists to enforce, and both sides have to
 * stay at least 1 px or the canvas throws.
 */
export function fitWithin(width: number, height: number, maxEdge = MAX_IMAGE_EDGE):
    { width: number; height: number; scaled: boolean } {
    const longest = Math.max(width, height);
    if (!longest || longest <= maxEdge) {
        return { width: Math.max(1, width), height: Math.max(1, height), scaled: false };
    }
    const ratio = maxEdge / longest;
    return {
        width: Math.max(1, Math.floor(width * ratio)),
        height: Math.max(1, Math.floor(height * ratio)),
        scaled: true,
    };
}

/**
 * Whether the re-encoded copy is worth keeping.
 *
 * Not simply "is it smaller". A picture that was resized is worth keeping even at
 * the same byte count, because it is the *pixels* the backend and the mirror will
 * carry from then on. A picture that was not resized is only worth replacing if
 * the encode actually won something — re-encoding an already-optimised small
 * image reliably makes it bigger, which is the same trap the backend guards
 * against.
 */
export function shouldUseReencoded(originalBytes: number, encodedBytes: number,
                                   wasScaled: boolean): boolean {
    if (wasScaled) return encodedBytes < originalBytes * 1.1;
    return encodedBytes < originalBytes;
}

/** A human size, for the composer's "3.4 MB → 210 KB" hint. */
export function humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** mm:ss, for a recording timer and an audio bubble's duration. */
export function formatDuration(ms: number): string {
    const total = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Scale and re-encode a picked image.
 *
 * Returns the original untouched when re-encoding would not help — a small PNG
 * screenshot, a picture already the right size. Falls back to the original on any
 * failure too: a browser that cannot decode the file into a canvas (an exotic
 * format, a memory limit on a low-end phone) should still be able to send the
 * picture and let the backend deal with it, rather than be told "no".
 */
export async function prepareImage(file: File | Blob,
                                   maxEdge = MAX_IMAGE_EDGE): Promise<PreparedImage> {
    const originalBytes = file.size;
    const fallback = (): PreparedImage =>
        ({ blob: file, width: 0, height: 0, originalBytes });

    let bitmap: ImageBitmap | null = null;
    try {
        // createImageBitmap applies EXIF orientation with this option, which is
        // what stops a portrait phone photo arriving sideways. Drawing an <img>
        // to a canvas by hand does not, and that is the single most common bug in
        // browser-side image handling.
        bitmap = await createImageBitmap(file as Blob, { imageOrientation: 'from-image' } as any);
    } catch {
        try {
            bitmap = await createImageBitmap(file as Blob);
        } catch {
            return fallback();
        }
    }

    try {
        const target = fitWithin(bitmap.width, bitmap.height, maxEdge);
        const canvas = document.createElement('canvas');
        canvas.width = target.width;
        canvas.height = target.height;
        const context = canvas.getContext('2d');
        if (!context) return fallback();
        context.drawImage(bitmap, 0, 0, target.width, target.height);

        const encoded = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY));
        if (!encoded) return fallback();

        if (!shouldUseReencoded(originalBytes, encoded.size, target.scaled)) {
            return { ...fallback(), width: bitmap.width, height: bitmap.height };
        }
        return {
            blob: encoded,
            width: target.width,
            height: target.height,
            originalBytes,
        };
    } catch {
        return fallback();
    } finally {
        bitmap?.close?.();
    }
}

/**
 * The best recording format this browser actually supports.
 *
 * Ordered by how small the result is. Opus in WebM is what Chrome and Firefox
 * give; Safari produces MP4/AAC. All of them are in the backend's
 * `COMPRESSED_AUDIO_MIMES`, so they pass straight through without a re-encode —
 * which is the point, because there is no Opus encoder on the server.
 *
 * `''` means the browser has no `MediaRecorder` support worth using and the
 * caller should fall back; the backend will accept a WAV and resample it, at a
 * much worse size.
 */
export function bestRecordingMime(): string {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/webm',
        'audio/mp4',
    ];
    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

export interface Recording {
    blob: Blob;
    durationMs: number;
    mime: string;
}

/**
 * A microphone recording, with the browser doing the compression.
 *
 * Returned as a small handle rather than a promise of the finished blob, because
 * the UI needs to be able to stop it, cancel it, and show a live timer and level
 * meter while it runs. `stop()` resolves with the audio; `cancel()` throws it away
 * and releases the microphone without producing anything.
 *
 * **The tracks are always stopped**, on every exit path. A `MediaStream` left
 * running keeps the browser's recording indicator lit and the microphone held
 * open, which users reasonably read as the app listening to them.
 */
export async function startRecording(onLevel?: (level: number) => void): Promise<{
    stop: () => Promise<Recording>;
    cancel: () => void;
    startedAt: number;
}> {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        },
    });

    const mime = bestRecordingMime();
    let recorder: MediaRecorder;
    try {
        recorder = new MediaRecorder(stream, mime
            ? { mimeType: mime, audioBitsPerSecond: AUDIO_BITS_PER_SECOND }
            : undefined);
    } catch {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('This browser cannot record audio.');
    }

    const chunks: Blob[] = [];
    recorder.ondataavailable = event => {
        if (event.data && event.data.size) chunks.push(event.data);
    };

    // A level meter, so somebody can see the recording is picking them up. Torn
    // down with everything else: an AudioContext left open is another thing that
    // keeps the microphone indicator on.
    let audioContext: AudioContext | null = null;
    let raf = 0;
    if (onLevel) {
        try {
            audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            const buffer = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                analyser.getByteTimeDomainData(buffer);
                let peak = 0;
                for (const value of buffer) peak = Math.max(peak, Math.abs(value - 128));
                onLevel(Math.min(1, peak / 90));
                raf = requestAnimationFrame(tick);
            };
            tick();
        } catch {
            audioContext = null;
        }
    }

    const startedAt = Date.now();
    let done = false;

    const teardown = () => {
        if (raf) cancelAnimationFrame(raf);
        audioContext?.close().catch(() => undefined);
        stream.getTracks().forEach(track => track.stop());
    };

    recorder.start(250);

    return {
        startedAt,
        stop(): Promise<Recording> {
            if (done) return Promise.reject(new Error('Already stopped'));
            done = true;
            return new Promise<Recording>((resolve, reject) => {
                recorder.onstop = () => {
                    teardown();
                    const type = recorder.mimeType || mime || 'audio/webm';
                    const blob = new Blob(chunks, { type });
                    if (!blob.size) {
                        reject(new Error('Nothing was recorded.'));
                        return;
                    }
                    resolve({ blob, durationMs: Date.now() - startedAt, mime: type });
                };
                try {
                    recorder.stop();
                } catch (error) {
                    teardown();
                    reject(error);
                }
            });
        },
        cancel() {
            if (done) return;
            done = true;
            recorder.onstop = null;
            try {
                if (recorder.state !== 'inactive') recorder.stop();
            } catch {
                // Already stopped; the teardown below is what matters.
            }
            teardown();
        },
    };
}
