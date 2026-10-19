/**
 * A minimal PDF writer: one JPEG per page, plus an invisible text layer.
 *
 * Plain module -- no DOM -- so `check:interviewreport` can build a PDF in node
 * and verify its cross-reference table byte by byte.
 *
 * WHY THE PAGES ARE IMAGES. The report is in whatever language the interview
 * was held in, and a PDF can only show a script whose font it embeds. Arabic
 * needs shaping and bidi, Chinese needs a font of several megabytes, and no
 * in-browser PDF library does all three. The browser's own text engine does, so
 * `pdfLayout.ts` draws each A4 page on a canvas -- where Arabic is shaped,
 * mixed-direction lines are ordered and a CJK fallback font is found exactly as
 * on screen -- and this file wraps those pages.
 *
 * WHAT THAT WOULD COST, AND THE PART THAT GETS IT BACK. An image-only PDF
 * cannot be searched or copied from. So every line of text that WinAnsi can
 * encode (English, and the Latin-script languages) is also written in text
 * render mode 3 -- INVISIBLE -- at the position it was drawn, horizontally
 * scaled (`Tz`) so the invisible run spans exactly the width the canvas
 * measured. Selecting, copying and Ctrl+F then work on those lines. A line that
 * WinAnsi cannot encode is skipped rather than written as question marks: a
 * search that finds "????" helps nobody, and the DOCX carries every script as
 * real text.
 */

export const A4_W = 595.28;
export const A4_H = 841.89;

export interface PdfTextItem {
    /** Left edge, in points from the left of the page. */
    x: number;
    /** Baseline, in points from the TOP of the page. */
    y: number;
    size: number;
    /** The width the line was drawn at, in points. */
    width: number;
    text: string;
}

export interface PdfPage {
    jpeg: Uint8Array;
    pxW: number;
    pxH: number;
    text: PdfTextItem[];
}

export interface PdfMeta {
    title?: string;
    author?: string;
    subject?: string;
    lang?: string;
}

// ------------------------------------------------------------- WinAnsi

const CP1252_EXTRA: Record<number, number> = {
    0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86,
    0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
    0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
    0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
    0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/** The WinAnsi bytes for `text`, or null when any character has none. */
export function winAnsi(text: string): number[] | null {
    const out: number[] = [];
    for (const ch of text) {
        const cp = ch.codePointAt(0)!;
        if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff)) out.push(cp);
        else if (cp in CP1252_EXTRA) out.push(CP1252_EXTRA[cp]);
        else return null;
    }
    return out;
}

/** Helvetica advance widths, 1/1000 em, for 0x20..0x7E. Everything else is 556. */
const HELV = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

export function helveticaWidth(bytes: number[], size: number): number {
    let units = 0;
    for (const b of bytes) units += b >= 0x20 && b <= 0x7e ? HELV[b - 0x20] : 556;
    return (units / 1000) * size;
}

// ------------------------------------------------------------- bytes

class Bytes {
    private parts: Uint8Array[] = [];
    length = 0;
    private enc = new TextEncoder();
    add(chunk: string | Uint8Array) {
        const b = typeof chunk === 'string' ? this.enc.encode(chunk) : chunk;
        this.parts.push(b);
        this.length += b.length;
    }
    join(): Uint8Array {
        const out = new Uint8Array(this.length);
        let pos = 0;
        for (const p of this.parts) { out.set(p, pos); pos += p.length; }
        return out;
    }
}

function hex(bytes: number[]): string {
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** A PDF text string for the document information dictionary, in UTF-16BE. */
export function pdfUnicodeString(text: string): string {
    const units: number[] = [0xfe, 0xff];
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        units.push(c >> 8, c & 0xff);
    }
    return `<${hex(units)}>`;
}

function num(n: number): string {
    return (Math.round(n * 100) / 100).toString();
}

/** The invisible text layer for one page. */
export function textLayer(items: PdfTextItem[]): string {
    const ops: string[] = [];
    for (const item of items) {
        const bytes = winAnsi(item.text);
        if (!bytes || !bytes.length || item.width <= 0) continue;
        const natural = helveticaWidth(bytes, item.size);
        if (natural <= 0) continue;
        const scale = Math.max(1, Math.min(1000, (item.width / natural) * 100));
        ops.push(`/F1 ${num(item.size)} Tf ${num(scale)} Tz 1 0 0 1 ${num(item.x)} ${num(A4_H - item.y)} Tm <${hex(bytes)}> Tj`);
    }
    return ops.length ? `BT 3 Tr\n${ops.join('\n')}\nET\n` : '';
}

export function buildPdf(pages: PdfPage[], meta: PdfMeta = {}, now = new Date()): Uint8Array {
    const out = new Bytes();
    const offsets: number[] = [];
    // Object numbers: 1 catalog, 2 pages, 3 font, 4 info, then 3 per page.
    const pageObj = (i: number) => 5 + i * 3;
    const total = 4 + pages.length * 3;

    const obj = (n: number, body: string | Uint8Array, streamTail?: string) => {
        offsets[n] = out.length;
        out.add(`${n} 0 obj\n`);
        out.add(body);
        if (streamTail !== undefined) out.add(streamTail);
        out.add('\nendobj\n');
    };

    // A binary comment on line two, so transfer tools treat the file as binary.
    out.add(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    const lang = meta.lang ? ` /Lang (${meta.lang.replace(/[()\\]/g, '')})` : '';
    obj(1, `<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >>${lang} >>`);
    obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>`);
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    obj(4, `<< /Producer ${pdfUnicodeString('Self Study')} /Creator ${pdfUnicodeString('Self Study')}`
        + (meta.title ? ` /Title ${pdfUnicodeString(meta.title)}` : '')
        + (meta.author ? ` /Author ${pdfUnicodeString(meta.author)}` : '')
        + (meta.subject ? ` /Subject ${pdfUnicodeString(meta.subject)}` : '')
        + ` /CreationDate (D:${stamp}Z) >>`);

    pages.forEach((page, i) => {
        const p = pageObj(i);
        const content = `q ${num(A4_W)} 0 0 ${num(A4_H)} 0 0 cm /Im0 Do Q\n${textLayer(page.text)}`;
        const contentBytes = new TextEncoder().encode(content);
        obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(A4_W)} ${num(A4_H)}] `
            + `/Resources << /XObject << /Im0 ${p + 2} 0 R >> /Font << /F1 3 0 R >> >> /Contents ${p + 1} 0 R >>`);
        offsets[p + 1] = out.length;
        out.add(`${p + 1} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
        out.add(contentBytes);
        out.add('\nendstream\nendobj\n');
        offsets[p + 2] = out.length;
        out.add(`${p + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.pxW} /Height ${page.pxH} `
            + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
        out.add(page.jpeg);
        out.add('\nendstream\nendobj\n');
    });

    const xref = out.length;
    let table = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
    for (let n = 1; n <= total; n++) table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
    out.add(table);
    out.add(`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return out.join();
}
