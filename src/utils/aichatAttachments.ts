/**
 * src/utils/aichatAttachments.ts — what the AI Chat composer may attach.
 *
 * A plain module (no Vue, no DOM) on the aichatRooms.ts precedent, so
 * `npm run check:aichat` can drive it in node AND compare every limit with the
 * one app 27's aichat.py enforces. There is no shared package (working rule
 * 10): these numbers are written twice, and the check reads the Python off disk
 * so the two cannot drift. Drift here is a file the browser accepts and the
 * server refuses after the upload, which reads as the chat being broken.
 *
 * Limits are enforced on BOTH sides on purpose. The browser's copy is what
 * stops four megabytes crossing the network for nothing; the server's is what
 * makes the limit a limit, because a client can be old or a script.
 *
 * WHAT IS SUPPORTED, AND SAID SO ON SCREEN:
 *   - one image per message (PNG, JPEG, WebP, GIF), answered by a vision model;
 *   - text and code files, read as text;
 *   - Word documents (.docx), read on the server with the standard library;
 *   - PDF, which needs `pypdf` on the replica and is refused by name without it.
 */

export const MAX_ATTACHMENTS = 4;
export const MAX_IMAGES = 1;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
/** Seconds of voice per recording: comfortably under MAX_AUDIO_BYTES at Opus rates. */
export const MAX_RECORDING_SECONDS = 120;
/** The largest side of an image as sent. Bigger photos are scaled down first. */
export const IMAGE_MAX_SIDE = 2048;
export const THUMB_SIDE = 160;
/** Matches MAX_THUMB_CHARS on the server: a larger thumbnail is dropped there. */
export const MAX_THUMB_CHARS = 24000;

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

/** Same set as TEXT_EXTENSIONS in aichat.py. */
export const TEXT_EXTENSIONS: readonly string[] = [
    'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'xml', 'yaml', 'yml', 'toml', 'ini',
    'cfg', 'conf', 'log', 'env', 'sql', 'py', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'vue',
    'html', 'htm', 'css', 'scss', 'less', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cc', 'cs',
    'go', 'rs', 'rb', 'php', 'swift', 'dart', 'lua', 'r', 'sh', 'bash', 'ps1', 'bat', 'dockerfile',
    'tf', 'gradle', 'properties', 'tex', 'rst', 'ipynb',
];
export const DOCUMENT_EXTENSIONS: readonly string[] = ['docx', 'pdf'];

/** The `accept` attribute for the file picker. */
export const ACCEPT = [
    ...IMAGE_TYPES,
    ...[...TEXT_EXTENSIONS, ...DOCUMENT_EXTENSIONS].map((e) => '.' + e),
].join(',');

export type AttachmentKind = 'image' | 'file';

/** An attachment as the server stores and returns it: metadata only, never bytes. */
export interface ChatAttachment {
    id?: string;
    name: string;
    type: string;
    size: number;
    kind: AttachmentKind;
    /** A small `data:image/...` URL, images only. Validated on the server. */
    thumb?: string;
    /** How many characters of a document were read. */
    chars?: number;
    truncated?: boolean;
}

/** What the composer holds before sending: the metadata plus the base64 body. */
export interface PendingAttachment extends ChatAttachment {
    data: string;
}

export function extensionOf(name: string): string {
    const low = (name || '').toLowerCase().split(/[\\/]/).pop() || '';
    if (low === 'dockerfile') return 'dockerfile';
    const dot = low.lastIndexOf('.');
    return dot >= 0 ? low.slice(dot + 1) : '';
}

/** 'image', 'file', or null for a type this chat cannot read. */
export function kindOf(name: string, type: string): AttachmentKind | null {
    const mime = (type || '').toLowerCase() === 'image/jpg' ? 'image/jpeg' : (type || '').toLowerCase();
    if ((IMAGE_TYPES as readonly string[]).includes(mime)) return 'image';
    const ext = extensionOf(name);
    if (TEXT_EXTENSIONS.includes(ext) || DOCUMENT_EXTENSIONS.includes(ext)) return 'file';
    if (mime.startsWith('text/')) return 'file';
    return null;
}

export type Refusal =
    | { reason: 'type'; name: string }
    | { reason: 'too_many' }
    | { reason: 'one_image' }
    | { reason: 'image_size'; name: string }
    | { reason: 'file_size'; name: string };

/**
 * Whether one more file may join what is already pending. The image size is
 * checked AFTER the browser has scaled a photo down, so a 9 MB phone picture is
 * not refused for a size it will not be sent at.
 */
export function refusalFor(
    file: { name: string; type: string; size: number },
    pending: Array<{ kind: AttachmentKind }>,
): Refusal | null {
    const kind = kindOf(file.name, file.type);
    if (!kind) return { reason: 'type', name: file.name };
    if (pending.length >= MAX_ATTACHMENTS) return { reason: 'too_many' };
    if (kind === 'image') {
        if (pending.filter((p) => p.kind === 'image').length >= MAX_IMAGES) return { reason: 'one_image' };
        if (file.size > MAX_IMAGE_BYTES) return { reason: 'image_size', name: file.name };
    } else if (file.size > MAX_FILE_BYTES) {
        return { reason: 'file_size', name: file.name };
    }
    return null;
}

/** Scale (w, h) so the larger side is at most `max`, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
    const w = Math.max(1, Math.round(width || 1));
    const h = Math.max(1, Math.round(height || 1));
    const scale = Math.min(1, max / Math.max(w, h));
    return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** A thumbnail the server will keep: an image data URL under the size limit. */
export function isAcceptableThumb(value: string): boolean {
    return typeof value === 'string' && value.length <= MAX_THUMB_CHARS
        && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

export function formatBytes(bytes: number): string {
    if (!bytes || bytes < 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The recording format to ask MediaRecorder for, in order of preference. */
export function pickRecordingType(isSupported: (t: string) => boolean): string {
    for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
        try { if (isSupported(t)) return t; } catch { /* keep looking */ }
    }
    return '';
}

/** Append dictated text to whatever is already in the composer. */
export function insertDictation(current: string, spoken: string): string {
    const said = (spoken || '').trim();
    if (!said) return current;
    if (!current.trim()) return said;
    return /\s$/.test(current) ? current + said : current + ' ' + said;
}
