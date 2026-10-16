/**
 * A ZIP writer, and the decisions about what goes in one, for the lab explorer's
 * downloads. A plain module - no Vue, no DOM - on the `fileTree.ts` precedent,
 * so `npm run check:labs` can build an archive in node and open it again with
 * node's own zlib.
 *
 * WHY THERE IS NO LIBRARY
 *
 * A lab holds at most sixty files of 256 KB, all of them text, so what is needed
 * is the ZIP container and DEFLATE - and the browser already ships DEFLATE as
 * `CompressionStream('deflate-raw')`. A dependency for the remaining two hundred
 * lines would sit in the entry chunk of every route (working rule 47) for a
 * button most students press once. Where `CompressionStream` is missing - Safari
 * before 16.4 - an entry is STORED instead, which is still a valid archive every
 * unzip tool opens; a download that fails on an old browser is worse than one
 * that is a little larger.
 *
 * FIVE PROPERTIES, EACH OF WHICH FAILS SILENTLY
 *
 *  * **Names are UTF-8 and say so** (general-purpose bit 11). Without the flag
 *    Windows Explorer reads a name as code page 437 and an Arabic file name
 *    unzips as mojibake.
 *  * **A deflated entry is kept only when it is SMALLER.** A tiny file deflates
 *    to more bytes than it started with; storing it then is free and correct.
 *  * **The Unix mode travels** in the external attributes (`version made by` =
 *    Unix), so a script the student `chmod +x`-ed is still executable once it is
 *    unzipped on Linux or macOS. Windows ignores it, which is harmless.
 *  * **Empty folders are entries of their own**, a name ending in `/`. A project
 *    a student has just laid out - `src/`, `tests/` - unzips with the folders
 *    they made and have not filled yet.
 *  * **No name can escape the folder it is unzipped into.** A leading `/`, a
 *    drive letter, a backslash or a `..` segment is dropped rather than written;
 *    app 11 never produces one, and an archive is the one place a bad path stops
 *    being this platform's problem and becomes the student's disk's.
 */

export interface ZipEntry {
    /** The path inside the archive. A folder ends in `/` or sets `dir`. */
    name: string;
    data?: Uint8Array | string;
    dir?: boolean;
    /** Octal permission digits, e.g. `'755'`. Optional. */
    mode?: string;
}

export interface ExportedFile {
    path: string;
    content: string;
    mode?: string;
}

/** What app 11's `export` files action answers, or the fallback builds. */
export interface FileExport {
    root: string;
    files: ExportedFile[];
    dirs: string[];
}

/* ------------------------------------------------------------------ *
 * CRC-32
 * ------------------------------------------------------------------ */

let CRC_TABLE: Uint32Array | null = null;

function crcTable(): Uint32Array {
    if (CRC_TABLE) return CRC_TABLE;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    CRC_TABLE = table;
    return table;
}

/** The CRC-32 ZIP stores beside every entry (IEEE 802.3, reflected). */
export function crc32(bytes: Uint8Array): number {
    const table = crcTable();
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------------ *
 * Names
 * ------------------------------------------------------------------ */

/**
 * A name that is safe to write into an archive, or `''` for one that is not.
 *
 * Backslashes become slashes (a ZIP name always uses `/`), empty and `.`
 * segments go, and anything with `..`, a leading `/` or a drive letter is
 * refused outright rather than "fixed", because a fixed traversal is a file in
 * a place nobody asked for.
 */
export function safeEntryName(name: string, isDir = false): string {
    const raw = String(name || '').replace(/\\/g, '/');
    if (/^\//.test(raw) || /^[A-Za-z]:/.test(raw)) return '';
    const parts = raw.split('/').filter(part => part && part !== '.');
    if (!parts.length || parts.some(part => part === '..')) return '';
    return parts.join('/') + (isDir ? '/' : '');
}

/** The last segment of a path - `src/app.py` is `app.py`. */
function lastSegment(path: string): string {
    const parts = String(path || '').split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
}

/**
 * A file-system-safe download name: letters, digits, dot, dash, underscore.
 * A lab id already is one; a title from a repository might not be.
 */
export function safeDownloadName(name: string, fallback = 'lab-files'): string {
    const cleaned = String(name || '')
        .replace(/[^\w.\-]+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '');
    return cleaned || fallback;
}

/**
 * What the archive is called, and what the files are named inside it.
 *
 * **The whole lab is wrapped in one top-level folder named after the lab**, the
 * way a repository download is - unzipped into Downloads, sixty loose files
 * would land beside everything else already there. **A folder keeps its own
 * name as the top level** (`lib.zip` holds `lib/…`), which is what "compress
 * this folder" does on every desktop. Paths are made relative to the folder's
 * PARENT, so downloading `config/env` gives `env/…` rather than `config/env/…`.
 */
export function planArchive(exported: FileExport, labName: string): {
    fileName: string;
    entries: ZipEntry[];
} {
    const root = String(exported.root || '').replace(/\/+$/, '');
    const wrapper = root ? lastSegment(root) : safeDownloadName(labName);
    const parent = root.includes('/') ? root.slice(0, root.lastIndexOf('/') + 1) : '';
    const rename = (path: string): string => {
        if (!root) return `${wrapper}/${path}`;
        return path.startsWith(parent) ? path.slice(parent.length) : path;
    };

    const entries: ZipEntry[] = [];
    const seen = new Set<string>();
    const add = (entry: ZipEntry) => {
        const name = safeEntryName(entry.name, Boolean(entry.dir));
        if (!name || seen.has(name)) return;
        seen.add(name);
        entries.push({ ...entry, name });
    };
    // The top folder itself first, so even an EMPTY folder downloads as an
    // archive holding that folder rather than as an archive holding nothing.
    add({ name: root ? lastSegment(root) : wrapper, dir: true });
    for (const dir of [...(exported.dirs || [])].sort()) {
        add({ name: rename(dir), dir: true });
    }
    for (const file of [...(exported.files || [])]
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
        add({ name: rename(file.path), data: file.content ?? '', mode: file.mode });
    }
    const base = safeDownloadName(root ? lastSegment(root) : labName);
    return { fileName: `${base}.zip`, entries };
}

/**
 * The same shape as app 11's `export` answer, built from a listing plus one
 * read per file. The FALLBACK, for a replica that has not pulled the build
 * carrying `export` - it answers `Unknown files action`, and a download button
 * that does nothing until every replica is deployed reads as broken.
 */
export async function exportFromListing(
    root: string,
    files: readonly { path: string }[],
    dirs: readonly string[],
    read: (path: string) => Promise<string>,
): Promise<FileExport> {
    const clean = String(root || '').replace(/\/+$/, '');
    const isFile = files.some(entry => entry.path === clean);
    const prefix = clean ? `${clean}/` : '';
    const chosen = isFile
        ? files.filter(entry => entry.path === clean)
        : files.filter(entry => entry.path.startsWith(prefix));
    const out: ExportedFile[] = [];
    // In sequence, deliberately: sixty concurrent reads at one PythonAnywhere
    // web app with a handful of workers would queue anyway and time some out.
    for (const entry of chosen) {
        out.push({ path: entry.path, content: await read(entry.path) });
    }
    return {
        root: clean,
        files: out,
        dirs: isFile ? [] : dirs.filter(dir => dir !== clean && dir.startsWith(prefix)),
    };
}

/* ------------------------------------------------------------------ *
 * The container
 * ------------------------------------------------------------------ */

const encoder = new TextEncoder();

function toBytes(data: Uint8Array | string | undefined): Uint8Array {
    if (data instanceof Uint8Array) return data;
    return encoder.encode(String(data ?? ''));
}

/** DOS date and time, which is what a ZIP header holds. Local time, 2s steps. */
export function dosDateTime(date: Date): { time: number; date: number } {
    const year = Math.max(1980, date.getFullYear());
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5)
            | Math.floor(date.getSeconds() / 2),
        date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
}

/**
 * Raw DEFLATE, or `null` where this runtime has no `CompressionStream`.
 *
 * `null` rather than a throw: the caller stores the entry instead, and a
 * stored entry is a perfectly valid archive.
 */
export async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
    const Stream = (globalThis as any).CompressionStream;
    if (typeof Stream !== 'function') return null;
    try {
        const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new Stream('deflate-raw'));
        const buffer = await new Response(stream).arrayBuffer();
        return new Uint8Array(buffer);
    } catch {
        return null;
    }
}

interface Prepared {
    name: Uint8Array;
    method: 0 | 8;
    crc: number;
    size: number;
    body: Uint8Array;
    dir: boolean;
    mode: number;
}

/**
 * Build the archive. `compress: false` stores every entry, which is what a
 * check uses to compare bytes exactly.
 */
export async function buildZip(
    entries: readonly ZipEntry[],
    options: { compress?: boolean; date?: Date } = {},
): Promise<Uint8Array> {
    const compress = options.compress !== false;
    const stamp = dosDateTime(options.date ?? new Date());
    const prepared: Prepared[] = [];

    for (const entry of entries) {
        const dir = Boolean(entry.dir) || entry.name.endsWith('/');
        const name = safeEntryName(entry.name, dir);
        if (!name) continue;
        const raw = dir ? new Uint8Array(0) : toBytes(entry.data);
        let method: 0 | 8 = 0;
        let body = raw;
        if (compress && raw.length) {
            const packed = await deflateRaw(raw);
            if (packed && packed.length < raw.length) {
                method = 8;
                body = packed;
            }
        }
        const digits = parseInt(String(entry.mode || ''), 8);
        const perm = Number.isFinite(digits) && digits > 0 && digits <= 0o777
            ? digits : (dir ? 0o755 : 0o644);
        prepared.push({
            name: encoder.encode(name),
            method,
            crc: dir ? 0 : crc32(raw),
            size: raw.length,
            body,
            dir,
            // S_IFDIR or S_IFREG, then the permission bits.
            mode: (dir ? 0o040000 : 0o100000) | perm,
        });
    }

    const locals: Uint8Array[] = [];
    const centrals: Uint8Array[] = [];
    let offset = 0;
    for (const item of prepared) {
        const local = new Uint8Array(30 + item.name.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);              // version needed: 2.0
        lv.setUint16(6, 0x0800, true);          // bit 11: names are UTF-8
        lv.setUint16(8, item.method, true);
        lv.setUint16(10, stamp.time, true);
        lv.setUint16(12, stamp.date, true);
        lv.setUint32(14, item.crc, true);
        lv.setUint32(18, item.body.length, true);
        lv.setUint32(22, item.size, true);
        lv.setUint16(26, item.name.length, true);
        lv.setUint16(28, 0, true);
        local.set(item.name, 30);

        const central = new Uint8Array(46 + item.name.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, (3 << 8) | 20, true);   // made by Unix, spec 2.0
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, item.method, true);
        cv.setUint16(12, stamp.time, true);
        cv.setUint16(14, stamp.date, true);
        cv.setUint32(16, item.crc, true);
        cv.setUint32(20, item.body.length, true);
        cv.setUint32(24, item.size, true);
        cv.setUint16(28, item.name.length, true);
        cv.setUint16(30, 0, true);              // extra
        cv.setUint16(32, 0, true);              // comment
        cv.setUint16(34, 0, true);              // disk
        cv.setUint16(36, 0, true);              // internal attributes
        // External: the Unix mode in the high half, MS-DOS directory bit low.
        cv.setUint32(38, ((item.mode << 16) | (item.dir ? 0x10 : 0)) >>> 0, true);
        cv.setUint32(42, offset, true);
        central.set(item.name, 46);

        locals.push(local, item.body);
        centrals.push(central);
        offset += local.length + item.body.length;
    }

    const centralSize = centrals.reduce((n, part) => n + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, prepared.length, true);
    ev.setUint16(10, prepared.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    const total = offset + centralSize + end.length;
    const out = new Uint8Array(total);
    let at = 0;
    for (const part of [...locals, ...centrals, end]) {
        out.set(part, at);
        at += part.length;
    }
    return out;
}

/**
 * Read an archive's central directory back: name, method, sizes, CRC and the
 * stored bytes. NOT a general unzip - it exists so a check can prove the writer
 * against itself and against zlib, and so a mistake in an offset fails a check
 * rather than a student's download.
 */
export function readZipDirectory(bytes: Uint8Array): {
    name: string; method: number; crc: number; compressed: number;
    size: number; mode: number; data: Uint8Array;
}[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let endAt = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === 0x06054b50) { endAt = i; break; }
    }
    if (endAt < 0) throw new Error('no end of central directory');
    const count = view.getUint16(endAt + 10, true);
    let at = view.getUint32(endAt + 16, true);
    const decoder = new TextDecoder();
    const out = [];
    for (let n = 0; n < count; n++) {
        if (view.getUint32(at, true) !== 0x02014b50) throw new Error(`bad central entry ${n}`);
        const method = view.getUint16(at + 10, true);
        const crc = view.getUint32(at + 16, true);
        const compressed = view.getUint32(at + 20, true);
        const size = view.getUint32(at + 24, true);
        const nameLength = view.getUint16(at + 28, true);
        const extra = view.getUint16(at + 30, true);
        const comment = view.getUint16(at + 32, true);
        const mode = view.getUint32(at + 38, true) >>> 16;
        const local = view.getUint32(at + 42, true);
        const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
        if (view.getUint32(local, true) !== 0x04034b50) throw new Error(`bad local header ${name}`);
        const localName = view.getUint16(local + 26, true);
        const localExtra = view.getUint16(local + 28, true);
        const start = local + 30 + localName + localExtra;
        out.push({ name, method, crc, compressed, size, mode,
            data: bytes.subarray(start, start + compressed) });
        at += 46 + nameLength + extra + comment;
    }
    return out;
}
