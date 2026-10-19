/**
 * The interview report laid out on A4 pages and drawn on canvas -- the DOM half
 * of the PDF. `pdfWriter.ts` is the half that writes the file.
 *
 * Canvas rather than a PDF library, because canvas text IS the browser's text
 * engine: Arabic is shaped, a line mixing Arabic and English is ordered by the
 * bidi algorithm, and a Chinese character with no glyph in the first font falls
 * through to the next one in the stack -- exactly as on screen. See
 * `pdfWriter.ts` for what that costs and how the text layer gets it back.
 *
 * Coordinates are in POINTS and LOGICAL: `x` is measured from the start edge,
 * and `px()` mirrors it for a right-to-left report. A paragraph is then aligned
 * by its OWN direction inside its mirrored box, so an English answer in an
 * Arabic report reads left to right in the right place -- the same rule the DOCX
 * follows, and `unicode-bidi: plaintext` on the page.
 *
 * Every block that can be taller than what is left of a page is laid out line
 * by line and drawn in SEGMENTS, each with its own background: a coaching panel
 * that crosses a page break is two panels, one ending at the bottom margin and
 * one starting at the top, rather than one that runs off the page.
 */

import { clock, fill, textDir, type Dir, type ReportModel, type Tone } from './model';
import { A4_H, A4_W, buildPdf, type PdfPage, type PdfTextItem } from './pdfWriter';

/** Pixels per point. 2.4 is ~173 dpi: crisp on screen and on a laser printer. */
const SCALE = 2.4;
const JPEG_QUALITY = 0.9;
const M = 44;
const CW = A4_W - 2 * M;
const TOP_FIRST = 0;
const TOP = 54;
const BOTTOM = 58;
const LIMIT = A4_H - BOTTOM;

/**
 * The font stack. Canvas falls back PER CHARACTER, like CSS, which is what lets
 * one line hold English, Arabic and Chinese. Windows, macOS, Android and Linux
 * each find something in here for all three scripts.
 */
const FONTS = '"Segoe UI", "Helvetica Neue", Arial, "Noto Sans", "Noto Naskh Arabic", "Noto Sans Arabic", '
    + '"Geeza Pro", Tahoma, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", '
    + '"Noto Sans CJK SC", sans-serif';

const C = {
    navy: '#1e1b4b',
    indigoDeep: '#312e81',
    navySoft: '#c7d2fe',
    indigo: '#4338ca',
    indigoTint: '#eef2ff',
    indigoLine: '#e0e7ff',
    ink: '#0f172a',
    body: '#1e293b',
    muted: '#475569',
    faint: '#94a3b8',
    line: '#e2e8f0',
    slateTint: '#f8fafc',
    sky: '#0369a1',
    skyTint: '#f0f9ff',
    green: '#15803d',
    greenTint: '#f0fdf4',
    amber: '#b45309',
    amberTint: '#fffbeb',
    red: '#b91c1c',
    redTint: '#fef2f2',
    white: '#ffffff',
};

function toneColour(tone: Tone | null): string {
    return tone === 'good' ? C.green : tone === 'mid' ? C.amber : tone === 'low' ? C.red : C.indigo;
}
function toneTint(tone: Tone | null): string {
    return tone === 'good' ? C.greenTint : tone === 'mid' ? C.amberTint : tone === 'low' ? C.redTint : C.indigoTint;
}
/** The same tones, lightened to read on the navy band. */
function toneOnDark(tone: Tone | null): string {
    return tone === 'good' ? '#4ade80' : tone === 'mid' ? '#fbbf24' : tone === 'low' ? '#f87171' : '#a5b4fc';
}

interface Style {
    size: number;
    weight?: number;
    italic?: boolean;
    colour?: string;
    caps?: boolean;
    /** Line height as a multiple of the size. */
    lh?: number;
}

interface Line { text: string; style: Style; dir: Dir; gapAfter: number }

interface Page {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    text: PdfTextItem[];
}

// ------------------------------------------------------------- tokenising

const CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/;

/**
 * Words to wrap on. `Intl.Segmenter` where it exists, because it knows where a
 * Chinese word ends and a regex does not; punctuation is glued to the word in
 * front of it either way, so a line never starts with a comma or a 。.
 */
function tokens(text: string, lang: string): string[] {
    const Seg = (Intl as any).Segmenter;
    let raw: { s: string; word: boolean }[];
    if (Seg) {
        raw = Array.from(new Seg(lang || undefined, { granularity: 'word' }).segment(text) as Iterable<any>,
            (x: any) => ({ s: x.segment as string, word: Boolean(x.isWordLike) }));
    } else {
        raw = (text.match(/\s+|[⺀-鿿豈-﫿＀-￯]|[^\s⺀-鿿豈-﫿＀-￯]+/g) || [])
            .map(s => ({ s, word: !/^\s+$/.test(s) }));
    }
    const out: string[] = [];
    for (const t of raw) {
        const isSpace = /^\s+$/.test(t.s);
        if (!isSpace && !t.word && out.length && !/^\s+$/.test(out[out.length - 1])) {
            out[out.length - 1] += t.s;
        } else {
            out.push(t.s);
        }
    }
    return out;
}

// ------------------------------------------------------------- layout

class Layout {
    pages: Page[] = [];
    y = 0;
    private measureCtx: CanvasRenderingContext2D;

    constructor(private model: ReportModel) {
        const c = document.createElement('canvas');
        this.measureCtx = c.getContext('2d')!;
    }

    get rtl(): boolean { return this.model.dir === 'rtl'; }
    /** Which page the primitives draw on; the newest unless a pass says otherwise. */
    private target: number | null = null;
    get page(): Page { return this.pages[this.target ?? this.pages.length - 1]; }

    font(style: Style): string {
        return `${style.italic ? 'italic ' : ''}${style.weight ?? 400} ${style.size * SCALE}px ${FONTS}`;
    }

    measure(text: string, style: Style): number {
        this.measureCtx.font = this.font(style);
        return this.measureCtx.measureText(text).width / SCALE;
    }

    /** Physical x of a logical box. */
    px(x: number, w: number): number {
        return this.rtl ? A4_W - x - w : x;
    }

    newPage(): void {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(A4_W * SCALE);
        canvas.height = Math.round(A4_H * SCALE);
        canvas.dir = this.model.dir;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = C.white;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textBaseline = 'alphabetic';
        this.pages.push({ canvas, ctx, text: [] });
        if (this.pages.length === 1) {
            this.y = TOP_FIRST;
        } else {
            this.runningHeader();
            this.y = TOP;
        }
    }

    ensure(height: number): void {
        if (!this.pages.length || this.y + height > LIMIT) this.newPage();
    }

    // ---- primitives (logical coordinates) ----

    rect(x: number, y: number, w: number, h: number, colour: string, radius = 0, stroke?: string): void {
        const ctx = this.page.ctx;
        const X = this.px(x, w) * SCALE;
        const Y = y * SCALE;
        const W = w * SCALE;
        const H = h * SCALE;
        const r = Math.min(radius * SCALE, W / 2, H / 2);
        ctx.beginPath();
        if (r > 0) {
            ctx.moveTo(X + r, Y);
            ctx.arcTo(X + W, Y, X + W, Y + H, r);
            ctx.arcTo(X + W, Y + H, X, Y + H, r);
            ctx.arcTo(X, Y + H, X, Y, r);
            ctx.arcTo(X, Y, X + W, Y, r);
            ctx.closePath();
        } else {
            ctx.rect(X, Y, W, H);
        }
        ctx.fillStyle = colour;
        ctx.fill();
        if (stroke) {
            ctx.lineWidth = 0.75 * SCALE;
            ctx.strokeStyle = stroke;
            ctx.stroke();
        }
    }

    hline(x: number, y: number, w: number, colour: string, width = 0.75): void {
        this.rect(x, y - width / 2, w, width, colour);
    }

    /**
     * One line of text in a logical box, aligned by its own direction -- or
     * centred. Records the line for the invisible text layer.
     */
    text(text: string, x: number, w: number, baseline: number, style: Style, dir: Dir,
        align: 'start' | 'center' = 'start'): void {
        if (!text) return;
        const ctx = this.page.ctx;
        const shown = style.caps ? text.toLocaleUpperCase() : text;
        ctx.font = this.font(style);
        ctx.fillStyle = style.colour ?? C.body;
        (ctx as any).direction = dir;
        if (style.caps && 'letterSpacing' in ctx) (ctx as any).letterSpacing = `${0.6 * SCALE}px`;
        const boxX = this.px(x, w);
        const width = ctx.measureText(shown).width / SCALE;
        let left: number;
        if (align === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(shown, (boxX + w / 2) * SCALE, baseline * SCALE);
            left = boxX + (w - width) / 2;
        } else if (dir === 'rtl') {
            ctx.textAlign = 'right';
            ctx.fillText(shown, (boxX + w) * SCALE, baseline * SCALE);
            left = boxX + w - width;
        } else {
            ctx.textAlign = 'left';
            ctx.fillText(shown, boxX * SCALE, baseline * SCALE);
            left = boxX;
        }
        if ('letterSpacing' in ctx) (ctx as any).letterSpacing = '0px';
        this.page.text.push({ x: left, y: baseline, size: style.size, width, text: shown });
    }

    /** `text` cut to one line, with an ellipsis where it had to be cut. */
    fit(text: string, style: Style, maxW: number): string {
        if (this.measure(text, style) <= maxW) return text;
        let lo = 0;
        let hi = text.length;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (this.measure(text.slice(0, mid) + '…', style) <= maxW) lo = mid; else hi = mid - 1;
        }
        return text.slice(0, lo).trimEnd() + '…';
    }

    /** Wrap one paragraph to `maxW`, in its own direction. */
    wrap(text: string, style: Style, maxW: number): string[] {
        const out: string[] = [];
        for (const hard of text.split('\n')) {
            if (!hard.trim()) continue;
            let cur = '';
            for (const tok of tokens(hard, this.model.lang)) {
                if (/^\s+$/.test(tok)) { if (cur) cur += ' '; continue; }
                const next = cur + tok;
                if (this.measure(next.trimEnd(), style) <= maxW) { cur = next; continue; }
                if (cur.trim()) out.push(cur.trimEnd());
                // A single token wider than the line -- a URL, a long path, a
                // run of Chinese with no break -- is broken by character.
                if (this.measure(tok, style) > maxW) {
                    let piece = '';
                    for (const ch of tok) {
                        if (this.measure(piece + ch, style) > maxW && piece) { out.push(piece); piece = ''; }
                        piece += ch;
                    }
                    cur = piece;
                } else {
                    cur = tok;
                }
            }
            if (cur.trim()) out.push(cur.trimEnd());
        }
        return out;
    }

    /** Lines for a paragraph, each carrying the paragraph's own direction. */
    para(text: string, style: Style, maxW: number, gapAfter = 0): Line[] {
        const lines: Line[] = [];
        for (const hard of text.split('\n')) {
            if (!hard.trim()) continue;
            const dir = textDir(hard, this.model.dir);
            const wrapped = this.wrap(hard, style, maxW);
            wrapped.forEach((t, i) => lines.push({ text: t, style, dir, gapAfter: i === wrapped.length - 1 ? gapAfter : 0 }));
        }
        return lines;
    }

    /**
     * A run of lines inside an optional tinted panel, split across pages.
     *
     * `keep` lines at the start are never separated from the first body line --
     * a panel label alone at the foot of a page, its text on the next, reads as
     * an empty panel.
     */
    block(lines: Line[], o: { x: number; w: number; padX?: number; padY?: number; bg?: string; edge?: string; radius?: number; keep?: number }): void {
        if (!lines.length) return;
        const padX = o.padX ?? 0;
        const padY = o.padY ?? 0;
        const edgeW = o.edge ? 3 : 0;
        const innerX = o.x + padX + edgeW;
        const innerW = o.w - 2 * padX - edgeW;
        const heightOf = (l: Line) => l.style.size * (l.style.lh ?? 1.5);
        const keep = Math.min(lines.length, (o.keep ?? 0) + 1);
        const firstH = lines.slice(0, keep).reduce((h, l) => h + heightOf(l) + l.gapAfter, 0);

        this.ensure(padY * 2 + firstH);
        let i = 0;
        while (i < lines.length) {
            const start = this.y;
            let y = start + padY;
            const placed: { line: Line; baseline: number }[] = [];
            while (i < lines.length) {
                const h = heightOf(lines[i]);
                if (placed.length && y + h + padY > LIMIT) break;
                placed.push({ line: lines[i], baseline: y + lines[i].style.size * 1.05 + (h - lines[i].style.size * 1.3) / 2 });
                y += h + lines[i].gapAfter;
                i++;
            }
            const end = y + padY - (placed.length ? placed[placed.length - 1].line.gapAfter : 0);
            if (o.bg) this.rect(o.x, start, o.w, end - start, o.bg, o.radius ?? 0);
            if (o.edge) this.rect(o.x, start, edgeW, end - start, o.edge, 1.5);
            for (const p of placed) this.text(p.line.text, innerX, innerW, p.baseline, p.line.style, p.line.dir);
            this.y = end;
            if (i < lines.length) this.newPage();
        }
    }

    // ---- page furniture ----

    runningHeader(): void {
        const style: Style = { size: 7.5, colour: C.faint };
        const left = [this.model.title, this.model.candidate].filter(Boolean).join('  ·  ');
        this.text(this.fit(left, style, CW), M, CW, 30, style, textDir(left, this.model.dir));
        this.hline(M, 37, CW, C.line);
    }

    footers(): void {
        const total = this.pages.length;
        const style: Style = { size: 7.5, colour: C.faint };
        this.pages.forEach((_, i) => {
            this.target = i;
            const y = A4_H - 34;
            this.hline(M, y - 12, CW, C.line);
            const label = this.model.labels.footer;
            const pageText = fill(this.model.labels.page, { v0: i + 1, v1: total });
            const pw = this.measure(pageText, style) + 2;
            this.text(this.fit(label, style, CW - pw - 20), M, CW - pw - 20, y, style, textDir(label, this.model.dir));
            // The page number sits at the END edge.
            this.text(pageText, M + CW - pw, pw, y, style, textDir(pageText, this.model.dir));
        });
        this.target = null;
    }
}

// ------------------------------------------------------------- report

function titleBand(L: Layout, m: ReportModel): void {
    L.newPage();
    const H = 176;
    const ctx = L.page.ctx;
    const g = ctx.createLinearGradient(0, 0, A4_W * SCALE, H * SCALE);
    g.addColorStop(0, C.navy);
    g.addColorStop(1, C.indigoDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, A4_W * SCALE, H * SCALE);
    // A thin accent rule at the foot of the band.
    L.rect(0, H - 3, A4_W, 3, C.indigo);

    const ringRoom = m.score !== null ? 118 : 0;
    const textW = CW - ringRoom;
    const brand: Style = { size: 8.5, weight: 700, colour: C.navySoft, caps: true };
    // At the START edge of the report, whichever side that is: pinned ltr it
    // floated in the middle of an Arabic band.
    L.text(m.brand, M, textW, 56, brand, m.dir);
    const title: Style = { size: 27, weight: 700, colour: C.white };
    L.text(L.fit(m.title, title, textW), M, textW, 92, title, textDir(m.title, m.dir));
    if (m.candidate) {
        const who: Style = { size: 15, weight: 600, colour: C.white };
        L.text(L.fit(m.candidate, who, textW), M, textW, 119, who, textDir(m.candidate, m.dir));
    }
    const sub: Style = { size: 10.5, colour: C.navySoft };
    L.text(L.fit(m.subtitle, sub, textW), M, textW, 141, sub, textDir(m.subtitle, m.dir));

    if (m.score !== null) {
        const r = 42;
        const cxLogical = M + CW - r - 4;
        const cx = (L.rtl ? A4_W - cxLogical : cxLogical) * SCALE;
        const cy = 92 * SCALE;
        ctx.lineCap = 'round';
        ctx.lineWidth = 8 * SCALE;
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.beginPath(); ctx.arc(cx, cy, r * SCALE, 0, Math.PI * 2); ctx.stroke();
        if (m.score > 0) {
            ctx.strokeStyle = toneOnDark(m.scoreTone);
            ctx.beginPath();
            ctx.arc(cx, cy, r * SCALE, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * m.score) / 100);
            ctx.stroke();
        }
        const box = 2 * r;
        L.text(String(m.score), cxLogical - r, box, 100, { size: 28, weight: 700, colour: C.white }, 'ltr', 'center');
        L.text(m.labels.outOf, cxLogical - r, box, 113, { size: 7, colour: C.navySoft }, textDir(m.labels.outOf, m.dir), 'center');
    }
    L.y = H + 20;
}

function facts(L: Layout, m: ReportModel): void {
    if (!m.meta.length) return;
    const gap = 10;
    const colW = (CW - gap) / 2;
    const rowH = 36;
    const label: Style = { size: 7, weight: 700, colour: C.muted, caps: true };
    const value: Style = { size: 10, weight: 600, colour: C.ink };
    for (let i = 0; i < m.meta.length; i += 2) {
        L.ensure(rowH + 6);
        for (let c = 0; c < 2 && i + c < m.meta.length; c++) {
            const item = m.meta[i + c];
            const x = M + c * (colW + gap);
            L.rect(x, L.y, colW, rowH, C.slateTint, 6, C.line);
            L.text(L.fit(item.label, label, colW - 20), x + 10, colW - 20, L.y + 14, label, textDir(item.label, m.dir));
            L.text(L.fit(item.value, value, colW - 20), x + 10, colW - 20, L.y + 28, value, textDir(item.value, m.dir));
        }
        L.y += rowH + 6;
    }
    L.y += 6;
}

function scoreCard(L: Layout, m: ReportModel): void {
    if (!m.recommendation && !m.breakdown.length) return;
    const pad = 14;
    const hasBars = m.breakdown.length > 0;
    const leftW = hasBars ? 168 : CW - 2 * pad;
    const rightX = M + pad + leftW + 18;
    const rightW = M + CW - pad - rightX;
    const capLabel: Style = { size: 7, weight: 700, colour: C.muted, caps: true };
    const recStyle: Style = { size: 12, weight: 700, colour: toneColour(m.scoreTone), lh: 1.4 };
    const recLines = m.recommendation ? L.para(m.recommendation, recStyle, leftW) : [];
    const leftH = recLines.length ? 18 + recLines.length * recStyle.size * 1.4 : 0;
    const rowH = 19;
    const rightH = hasBars ? 18 + m.breakdown.length * rowH : 0;
    const h = Math.max(leftH, rightH) + 2 * pad;

    L.ensure(h + 10);
    const top = L.y;
    L.rect(M, top, CW, h, C.white, 8, C.line);
    if (recLines.length) {
        L.text(m.labels.recommendation, M + pad, leftW, top + pad + 8, capLabel, textDir(m.labels.recommendation, m.dir));
        let y = top + pad + 18;
        for (const line of recLines) {
            y += recStyle.size * 1.4;
            L.text(line.text, M + pad, leftW, y - 4, recStyle, line.dir);
        }
    }
    if (hasBars) {
        if (recLines.length) L.rect(rightX - 10, top + pad, 0.75, h - 2 * pad, C.line);
        L.text(m.labels.breakdown, rightX, rightW, top + pad + 8, capLabel, textDir(m.labels.breakdown, m.dir));
        const nameW = 84;
        const valW = 24;
        const barX = rightX + nameW;
        const barW = rightW - nameW - valW - 8;
        m.breakdown.forEach((dim, i) => {
            const y = top + pad + 18 + i * rowH + 13;
            const tone: Tone = dim.value >= 70 ? 'good' : dim.value >= 45 ? 'mid' : 'low';
            L.text(L.fit(dim.label, { size: 9 }, nameW - 6), rightX, nameW - 6, y,
                { size: 9, colour: C.body }, textDir(dim.label, m.dir));
            L.rect(barX, y - 6.5, barW, 7, C.line, 3.5);
            if (dim.value > 0) L.rect(barX, y - 6.5, Math.max(7, (barW * dim.value) / 100), 7, toneColour(tone), 3.5);
            L.text(String(dim.value), barX + barW + 8, valW, y, { size: 9, weight: 700, colour: toneColour(tone) }, 'ltr');
        });
    }
    L.y = top + h + 12;
}

function heading(L: Layout, text: string, m: ReportModel, newPage = false): void {
    if (newPage) L.newPage(); else L.ensure(64);
    L.y += 12;
    const style: Style = { size: 13.5, weight: 700, colour: C.indigo };
    L.text(text, M, CW, L.y + 12, style, textDir(text, m.dir));
    L.hline(M, L.y + 20, CW, C.indigoLine, 1.2);
    L.y += 30;
}

const BODY: Style = { size: 10, colour: C.body, lh: 1.55 };

function section(L: Layout, title: string, text: string, m: ReportModel): void {
    if (!text) return;
    heading(L, title, m);
    L.block(L.para(text, BODY, CW, 5), { x: M, w: CW });
    L.y += 4;
}

function panel(L: Layout, m: ReportModel, label: string, text: string, tint: string, edge: string, lead = ''): void {
    if (!text) return;
    const innerW = CW - 2 * 12 - 3;
    const labelStyle: Style = { size: 7.5, weight: 700, colour: edge, caps: true, lh: 1.7 };
    const leadStyle: Style = { size: 8.5, italic: true, colour: C.muted, lh: 1.5 };
    const lines: Line[] = [
        { text: label, style: labelStyle, dir: textDir(label, m.dir), gapAfter: lead ? 0 : 2 },
        ...(lead ? [{ text: lead, style: leadStyle, dir: textDir(lead, m.dir), gapAfter: 3 }] : []),
        ...L.para(text, BODY, innerW, 3),
    ];
    L.block(lines, { x: M, w: CW, padX: 12, padY: 9, bg: tint, edge, radius: 5, keep: lead ? 2 : 1 });
    L.y += 8;
}

function actionPlan(L: Layout, m: ReportModel): void {
    if (!m.actionPlan.length) return;
    heading(L, m.labels.actionPlan, m);
    const textX = M + 26;
    const textW = CW - 26;
    m.actionPlan.forEach((step, i) => {
        const lines = L.para(step, BODY, textW, 0);
        const h = lines.length * BODY.size * (BODY.lh ?? 1.5);
        L.ensure(h + 8);
        const top = L.y;
        const ctx = L.page.ctx;
        const cxLogical = M + 9;
        ctx.fillStyle = C.indigo;
        ctx.beginPath();
        ctx.arc((L.rtl ? A4_W - cxLogical : cxLogical) * SCALE, (top + 8.5) * SCALE, 8.5 * SCALE, 0, Math.PI * 2);
        ctx.fill();
        L.text(String(i + 1), M, 18, top + 11.5, { size: 8.5, weight: 700, colour: C.white }, 'ltr', 'center');
        L.block(lines, { x: textX, w: textW });
        L.y = Math.max(L.y, top + 18) + 6;
    });
}

function question(L: Layout, m: ReportModel, q: ReportModel['questions'][number]): void {
    const qStyle: Style = { size: 12.5, weight: 700, colour: C.ink, lh: 1.4 };
    const qLines = L.para(q.text, qStyle, CW, 0);
    // Header, the question, and the start of the first panel stay together.
    L.ensure(30 + qLines.length * qStyle.size * 1.4 + 60);
    L.y += 10;
    const tagStyle: Style = { size: 7.5, weight: 700, colour: C.indigo, caps: true };
    const tags = [fill(m.labels.question, { v0: q.number }), q.own ? m.labels.yourQuestion : ''].filter(Boolean).join('  ·  ');
    const pill = q.rating !== null ? fill(m.labels.rating, { v0: q.rating }) : '';
    const pillStyle: Style = { size: 8, weight: 700, colour: toneColour(q.tone) };
    const pillW = pill ? L.measure(pill, pillStyle) + 16 : 0;
    L.text(tags, M, CW - pillW - 8, L.y + 9, tagStyle, textDir(tags, m.dir));
    if (pill) {
        const px = M + CW - pillW;
        L.rect(px, L.y, pillW, 14, toneTint(q.tone), 7);
        L.text(pill, px, pillW, L.y + 10, pillStyle, 'ltr', 'center');
    }
    L.hline(M, L.y + 18, CW, C.indigoLine, 1);
    L.y += 24;
    L.block(qLines, { x: M, w: CW });
    L.y += 8;

    const answerLabel = m.labels.yourAnswer + (q.seconds ? `  ·  ${clock(q.seconds)}` : '');
    panel(L, m, answerLabel, q.answer || m.labels.noAnswer, C.slateTint, C.faint);
    panel(L, m, m.labels.feedback, q.feedback, C.skyTint, C.sky);
    panel(L, m, m.labels.fix, q.fix, C.amberTint, C.amber);
    panel(L, m, m.labels.improved, q.improved, C.greenTint, C.green, m.labels.improvedLead);
    panel(L, m, m.labels.model, q.model, C.indigoTint, C.indigo, m.labels.modelLead);
    if (q.keyPoints.length) panel(L, m, m.labels.keyPoints, q.keyPoints.map(p => `•  ${p}`).join('\n'), C.slateTint, C.faint);
    panel(L, m, m.labels.why, q.why, C.slateTint, C.muted);
    L.y += 6;
}

/** Lays the report out and returns the pages, drawn. Exported for the preview harness. */
export async function layoutReport(m: ReportModel): Promise<HTMLCanvasElement[]> {
    const L = await prepare(m);
    return L.pages.map(p => p.canvas);
}

async function prepare(m: ReportModel): Promise<Layout> {
    // A font still loading measures as the fallback and DRAWS as itself, so
    // every wrapped line would be the wrong length.
    try { await (document as any).fonts?.ready; } catch { /* drawing with what is there */ }
    const L = new Layout(m);
    titleBand(L, m);
    facts(L, m);
    if (m.unfinished) panel(L, m, '⚠', m.labels.unfinished, C.amberTint, C.amber);
    scoreCard(L, m);
    section(L, m.labels.summary, m.summary, m);
    if (m.standout) panel(L, m, m.labels.standout, m.standout, C.greenTint, C.green);
    if (m.redFlags) panel(L, m, m.labels.redFlags, m.redFlags, C.redTint, C.red);
    panel(L, m, m.labels.strengths, m.strengths, C.greenTint, C.green);
    panel(L, m, m.labels.improvements, m.improvements, C.amberTint, C.amber);
    section(L, m.assessmentTitle, m.assessment, m);
    section(L, m.labels.communication, m.communication, m);
    actionPlan(L, m);

    // A fresh page for the coaching only when the first part of the report
    // filled most of one. Forced unconditionally, a short or unfinished report
    // was a title band, four facts and a page of white.
    heading(L, m.labels.coaching, m, L.y > A4_H * 0.6);
    L.block(L.para(m.labels.coachingLead, { size: 9, italic: true, colour: C.muted, lh: 1.5 }, CW, 4), { x: M, w: CW });
    L.y += 4;
    if (!m.questions.length) L.block(L.para(m.labels.noQuestions, { ...BODY, colour: C.muted }, CW), { x: M, w: CW });
    for (const q of m.questions) question(L, m, q);
    L.ensure(20);
    L.block(L.para(m.generatedOn, { size: 7.5, colour: C.faint }, CW), { x: M, w: CW });
    L.footers();
    return L;
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) { reject(new Error('The page could not be encoded.')); return; }
            blob.arrayBuffer().then(b => resolve(new Uint8Array(b)), reject);
        }, 'image/jpeg', JPEG_QUALITY);
    });
}

export async function buildReportPdf(m: ReportModel): Promise<Uint8Array> {
    const L = await prepare(m);
    const pages: PdfPage[] = [];
    for (const page of L.pages) {
        pages.push({ jpeg: await toJpeg(page.canvas), pxW: page.canvas.width, pxH: page.canvas.height, text: page.text });
        // Release the bitmap as soon as it is encoded; ten A4 canvases at this
        // scale are ~120 MB of pixels, which a phone notices.
        page.canvas.width = 0;
        page.canvas.height = 0;
    }
    return buildPdf(pages, {
        title: [m.title, m.subtitle, m.candidate].filter(Boolean).join(' - '),
        author: m.brand,
        subject: m.candidate,
        lang: m.lang,
    });
}
