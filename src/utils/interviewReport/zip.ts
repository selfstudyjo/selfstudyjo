/**
 * A minimal ZIP writer -- STORED entries only, which is all a .docx needs.
 *
 * Plain module. Written here rather than pulled in as a dependency because the
 * whole format for stored entries is a local header, the bytes, and a central
 * directory -- about a hundred lines -- while a zip library is a few hundred
 * kilobytes for compression a text-only Word document does not need. Word,
 * LibreOffice, Google Docs and Pages all open stored archives.
 *
 * Two properties `check:interviewreport` verifies by reading the archive back:
 * every CRC matches its bytes (Word reports a whole document as corrupt over
 * one wrong checksum and names nothing), and `[Content_Types].xml` is the
 * FIRST entry, which some readers require.
 */

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

export function crc32(bytes: Uint8Array): number {
    const table = crcTable();
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
    name: string;
    data: Uint8Array | string;
}

/** DOS date/time for the archive -- a fixed moment, so the same input is the same file. */
function dosStamp(date: Date): { time: number; day: number } {
    const year = Math.max(1980, date.getFullYear());
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
}

export function zipStore(entries: ZipEntry[], date = new Date()): Uint8Array {
    const enc = new TextEncoder();
    const { time, day } = dosStamp(date);
    const locals: Uint8Array[] = [];
    const centrals: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
        const name = enc.encode(entry.name);
        const data = typeof entry.data === 'string' ? enc.encode(entry.data) : entry.data;
        const crc = crc32(data);

        const local = new Uint8Array(30 + name.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);          // version needed
        lv.setUint16(6, 0x0800, true);      // UTF-8 names
        lv.setUint16(8, 0, true);           // stored
        lv.setUint16(10, time, true);
        lv.setUint16(12, day, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, data.length, true);
        lv.setUint32(22, data.length, true);
        lv.setUint16(26, name.length, true);
        lv.setUint16(28, 0, true);
        local.set(name, 30);

        const central = new Uint8Array(46 + name.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, time, true);
        cv.setUint16(14, day, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, name.length, true);
        cv.setUint32(42, offset, true);
        central.set(name, 46);

        locals.push(local, data);
        centrals.push(central);
        offset += local.length + data.length;
    }

    const centralSize = centrals.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    const out = new Uint8Array(offset + centralSize + 22);
    let pos = 0;
    for (const part of [...locals, ...centrals, end]) { out.set(part, pos); pos += part.length; }
    return out;
}

/** Reads a stored archive back -- for the check, and nothing else. */
export function unzipStore(bytes: Uint8Array): { name: string; data: Uint8Array; crcOk: boolean }[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dec = new TextDecoder();
    const out: { name: string; data: Uint8Array; crcOk: boolean }[] = [];
    let pos = 0;
    while (pos + 30 <= bytes.length && view.getUint32(pos, true) === 0x04034b50) {
        const crc = view.getUint32(pos + 14, true);
        const size = view.getUint32(pos + 18, true);
        const nameLen = view.getUint16(pos + 26, true);
        const extra = view.getUint16(pos + 28, true);
        const name = dec.decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
        const start = pos + 30 + nameLen + extra;
        const data = bytes.subarray(start, start + size);
        out.push({ name, data, crcOk: crc32(data) === crc });
        pos = start + size;
    }
    return out;
}
