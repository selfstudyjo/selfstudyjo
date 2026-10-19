/**
 * The interview report as a Word document (.docx), written by hand.
 *
 * Plain module -- no Vue, no DOM -- so `check:interviewreport` can build one in
 * node and read it back. Office Open XML is a zip of a handful of XML parts, and
 * writing them directly is a few hundred lines against a several-hundred-kilobyte
 * dependency; more importantly it keeps every layout decision HERE, where the
 * check can see it.
 *
 * Why Word handles every language the platform speaks: Word shapes Arabic,
 * runs the bidi algorithm and falls back to a CJK font itself. All this file has
 * to do is say which paragraphs are right-to-left (`w:bidi`, `w:rtl`) and name
 * a font for each script slot (`ascii`, `eastAsia`, `cs`). Direction is decided
 * PER PARAGRAPH from its own text (`textDir`), so an English answer inside an
 * Arabic report still reads left to right -- the same rule as
 * `unicode-bidi: plaintext` on the page.
 *
 * Design: a navy title band, a two-column fact table, the score beside its five
 * bars, and every coaching block as a tinted panel with a coloured edge --
 * consecutive paragraphs with identical borders and shading are merged by Word
 * into one box, which is what makes a label and its text a single panel without
 * a table. Section headings use the built-in Heading 1 / Heading 2 styles, so
 * Word's navigation pane and table of contents work on the report.
 */

import { clock, fill, textDir, type Dir, type ReportModel, type Tone } from './model';
import { zipStore } from './zip';

// ------------------------------------------------------------- palette

export const PALETTE = {
    navy: '1E1B4B',
    navySoft: 'C7D2FE',
    indigo: '4338CA',
    indigoTint: 'EEF2FF',
    ink: '0F172A',
    muted: '475569',
    line: 'E2E8F0',
    slateTint: 'F8FAFC',
    slate: '94A3B8',
    sky: '0369A1',
    skyTint: 'F0F9FF',
    green: '15803D',
    greenTint: 'F0FDF4',
    amber: 'B45309',
    amberTint: 'FFFBEB',
    red: 'B91C1C',
    redTint: 'FEF2F2',
    white: 'FFFFFF',
} as const;

export function toneColour(tone: Tone | null): string {
    if (tone === 'good') return PALETTE.green;
    if (tone === 'mid') return PALETTE.amber;
    if (tone === 'low') return PALETTE.red;
    return PALETTE.indigo;
}

// ------------------------------------------------------------- xml

export function esc(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

interface RunOpts {
    bold?: boolean;
    italic?: boolean;
    size?: number;      // points
    colour?: string;
    caps?: boolean;
    spacing?: number;   // twentieths of a point, letter-spacing
}

function run(text: string, dir: Dir, o: RunOpts = {}): string {
    const half = Math.round((o.size ?? 10.5) * 2);
    const props = [
        o.bold ? '<w:b/><w:bCs/>' : '',
        o.italic ? '<w:i/><w:iCs/>' : '',
        o.caps ? '<w:caps/>' : '',
        o.colour ? `<w:color w:val="${o.colour}"/>` : '',
        o.spacing ? `<w:spacing w:val="${o.spacing}"/>` : '',
        `<w:sz w:val="${half}"/><w:szCs w:val="${half}"/>`,
        dir === 'rtl' ? '<w:rtl/>' : '',
    ].join('');
    // `xml:space="preserve"` or Word trims the leading space of " · 7/10".
    return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

interface ParaOpts {
    dir?: Dir;
    style?: string;
    before?: number;    // points
    after?: number;     // points
    line?: number;      // 240 = single
    keepNext?: boolean;
    pageBreak?: boolean;
    indent?: number;    // twips, start
    hanging?: number;   // twips
    shade?: string;
    edge?: { colour: string; size?: number; side?: 'start' | 'bottom' };
    align?: 'start' | 'center' | 'end';
}

function para(runs: string, o: ParaOpts = {}): string {
    const dir = o.dir ?? 'ltr';
    const parts: string[] = [];
    if (o.style) parts.push(`<w:pStyle w:val="${o.style}"/>`);
    if (o.keepNext) parts.push('<w:keepNext/>');
    if (o.pageBreak) parts.push('<w:pageBreakBefore/>');
    if (o.edge) {
        const sz = o.edge.size ?? 18;
        if (o.edge.side === 'bottom') {
            parts.push(`<w:pBdr><w:bottom w:val="single" w:sz="${sz}" w:space="4" w:color="${o.edge.colour}"/></w:pBdr>`);
        } else {
            // The PHYSICAL side, chosen by the paragraph's direction so the edge
            // sits on the reading side. Not `w:start`: LibreOffice ignores it
            // on a paragraph border, and the first render had panels with no
            // edge at all. CT_PBdr order is top, left, bottom, right.
            const side = dir === 'rtl' ? 'right' : 'left';
            parts.push(`<w:pBdr><w:${side} w:val="single" w:sz="${sz}" w:space="8" w:color="${o.edge.colour}"/></w:pBdr>`);
        }
    }
    if (o.shade) parts.push(`<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>`);
    // CT_PPr is a SEQUENCE: bidi before spacing, ind and jc. Word reports the
    // whole document as corrupt over one element out of order.
    if (dir === 'rtl') parts.push('<w:bidi/>');
    if (o.before !== undefined || o.after !== undefined || o.line !== undefined) {
        parts.push(`<w:spacing w:before="${Math.round((o.before ?? 0) * 20)}" w:after="${Math.round((o.after ?? 0) * 20)}"`
            + (o.line ? ` w:line="${o.line}" w:lineRule="auto"` : '') + '/>');
    }
    if (o.indent !== undefined || o.hanging !== undefined) {
        parts.push(`<w:ind w:start="${o.indent ?? 0}"${o.hanging ? ` w:hanging="${o.hanging}"` : ''}/>`);
    }
    if (o.align && o.align !== 'start') parts.push(`<w:jc w:val="${o.align === 'center' ? 'center' : 'end'}"/>`);
    return `<w:p><w:pPr>${parts.join('')}</w:pPr>${runs}</w:p>`;
}

/** A paragraph per line of `text`, each in its own direction. */
function textParas(text: string, fallback: Dir, o: ParaOpts & RunOpts = {}): string {
    return text.split('\n').filter(l => l.trim()).map(line => {
        const d = textDir(line, fallback);
        return para(run(line, d, o), { ...o, dir: d });
    }).join('');
}

function cellXml(content: string, o: { width: number; shade?: string; margins?: number; vAlign?: string; borders?: string }): string {
    const m = o.margins ?? 120;
    return `<w:tc><w:tcPr><w:tcW w:w="${o.width}" w:type="dxa"/>`
        + (o.borders ?? '')
        + (o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>` : '')
        + `<w:tcMar><w:top w:w="${m}" w:type="dxa"/><w:start w:w="${m + 40}" w:type="dxa"/>`
        + `<w:bottom w:w="${m}" w:type="dxa"/><w:end w:w="${m + 40}" w:type="dxa"/></w:tcMar>`
        + (o.vAlign ? `<w:vAlign w:val="${o.vAlign}"/>` : '')
        + `</w:tcPr>${content || '<w:p/>'}</w:tc>`;
}

function table(rows: string[], widths: number[], o: { dir: Dir; borders?: 'none' | 'grid'; layoutFixed?: boolean }): string {
    const total = widths.reduce((a, b) => a + b, 0);
    const border = o.borders === 'grid'
        ? `<w:tblBorders>${['top', 'start', 'bottom', 'end', 'insideH', 'insideV']
            .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="${PALETTE.line}"/>`).join('')}</w:tblBorders>`
        : `<w:tblBorders>${['top', 'start', 'bottom', 'end', 'insideH', 'insideV']
            .map(s => `<w:${s} w:val="nil"/>`).join('')}</w:tblBorders>`;
    return `<w:tbl><w:tblPr>`
        + (o.dir === 'rtl' ? '<w:bidiVisual/>' : '')
        + `<w:tblW w:w="${total}" w:type="dxa"/>`
        + border
        + (o.layoutFixed !== false ? '<w:tblLayout w:type="fixed"/>' : '')
        + `<w:tblCellMar><w:start w:w="0" w:type="dxa"/><w:end w:w="0" w:type="dxa"/></w:tblCellMar>`
        + `</w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
        + rows.join('') + '</w:tbl>';
}

function row(cells: string, height?: number): string {
    return `<w:tr><w:trPr><w:cantSplit/>${height ? `<w:trHeight w:val="${height}" w:hRule="exact"/>` : ''}</w:trPr>${cells}</w:tr>`;
}

// ------------------------------------------------------------- page geometry

/** A4, 0.8-inch margins. Everything below is sized against CONTENT_W. */
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1134;
export const CONTENT_W = PAGE_W - 2 * MARGIN;

// ------------------------------------------------------------- blocks

const PANEL_GAP = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/></w:pPr></w:p>';

/** A tinted panel with a coloured edge: a label, then the text. */
function panel(label: string, text: string, model: ReportModel, tint: string, edge: string, lead = ''): string {
    if (!text.trim()) return '';
    const base: ParaOpts = { shade: tint, edge: { colour: edge, size: 24 }, line: 288, indent: 140 };
    const ld = textDir(label, model.dir);
    let out = para(run(label, ld, { bold: true, size: 9, colour: edge, caps: true, spacing: 10 }),
        { ...base, dir: ld, before: 8, after: lead ? 0 : 2, keepNext: true });
    if (lead) {
        const leadDir = textDir(lead, model.dir);
        out += para(run(lead, leadDir, { italic: true, size: 8.5, colour: PALETTE.muted }),
            { ...base, dir: leadDir, after: 2, keepNext: true });
    }
    const lines = text.split('\n').filter(l => l.trim());
    lines.forEach((line, i) => {
        const d = textDir(line, model.dir);
        out += para(run(line, d, { size: 10.5, colour: PALETTE.ink }),
            { ...base, dir: d, after: i === lines.length - 1 ? 8 : 3 });
    });
    // An unshaded spacer. Word and LibreOffice MERGE consecutive paragraphs
    // whose borders and shading match, so two green panels in a row (standout
    // moment, then strengths) rendered as one box with two labels in it.
    return out + PANEL_GAP;
}

function heading(text: string, model: ReportModel, o: { pageBreak?: boolean } = {}): string {
    const d = textDir(text, model.dir);
    return para(run(text, d), { style: 'Heading1', dir: d, pageBreak: o.pageBreak });
}

function section(title: string, text: string, model: ReportModel): string {
    if (!text.trim()) return '';
    return heading(title, model) + textParas(text, model.dir, { after: 6, line: 288 });
}

function titleBand(model: ReportModel): string {
    const d = model.dir;
    const content =
        para(run(model.brand.toUpperCase(), d, { bold: true, size: 9, colour: PALETTE.navySoft, spacing: 40 }),
            { dir: d, after: 4 })
        + para(run(model.title, textDir(model.title, d), { bold: true, size: 26, colour: PALETTE.white }),
            { dir: textDir(model.title, d), after: 2 })
        + (model.candidate
            ? para(run(model.candidate, textDir(model.candidate, d), { bold: true, size: 14, colour: PALETTE.white }),
                { dir: textDir(model.candidate, d), after: 2 })
            : '')
        + para(run(model.subtitle, textDir(model.subtitle, d), { size: 11, colour: PALETTE.navySoft }),
            { dir: textDir(model.subtitle, d), after: 0 });
    return table([row(cellXml(content, { width: CONTENT_W, shade: PALETTE.navy, margins: 300 }))],
        [CONTENT_W], { dir: d });
}

function factTable(model: ReportModel): string {
    if (!model.meta.length) return '';
    const labelW = Math.round(CONTENT_W * 0.17);
    const valueW = Math.round(CONTENT_W / 2) - labelW;
    const rows: string[] = [];
    for (let i = 0; i < model.meta.length; i += 2) {
        const pair = model.meta.slice(i, i + 2);
        let cells = '';
        for (const item of pair) {
            const ld = textDir(item.label, model.dir);
            const vd = textDir(item.value, model.dir);
            cells += cellXml(para(run(item.label, ld, { bold: true, size: 8.5, colour: PALETTE.muted }), { dir: ld }),
                { width: labelW, shade: PALETTE.slateTint, margins: 90 });
            cells += cellXml(para(run(item.value, vd, { size: 10, colour: PALETTE.ink }), { dir: vd }),
                { width: valueW, margins: 90 });
        }
        if (pair.length === 1) {
            cells += cellXml('', { width: labelW, shade: PALETTE.slateTint, margins: 90 })
                + cellXml('', { width: valueW, margins: 90 });
        }
        rows.push(row(cells));
    }
    return para('', { after: 6 }) + table(rows, [labelW, valueW, labelW, valueW], { dir: model.dir, borders: 'grid' });
}

/** One bar: a two-cell table, the filled cell's width proportional to the value. */
function bar(value: number, colour: string, width: number, dir: Dir): string {
    const filled = Math.round((width * Math.max(0, Math.min(100, value))) / 100);
    const tiny = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="40" w:lineRule="exact"/></w:pPr></w:p>';
    const cells: string[] = [];
    const widths: number[] = [];
    if (filled > 0) { cells.push(cellXml(tiny, { width: filled, shade: colour, margins: 0 })); widths.push(filled); }
    if (width - filled > 0) {
        cells.push(cellXml(tiny, { width: width - filled, shade: PALETTE.line, margins: 0 }));
        widths.push(width - filled);
    }
    return table([row(cells.join(''), 110)], widths, { dir });
}

function scoreBlock(model: ReportModel): string {
    if (model.score === null && !model.breakdown.length && !model.recommendation) return '';
    const leftW = Math.round(CONTENT_W * 0.34);
    const rightW = CONTENT_W - leftW;
    const colour = toneColour(model.scoreTone);
    const d = model.dir;

    let left = para(run(model.labels.overall, textDir(model.labels.overall, d),
        { bold: true, size: 9, colour: PALETTE.muted, caps: true, spacing: 10 }), { dir: d, align: 'center', after: 0 });
    if (model.score !== null) {
        left += para(run(String(model.score), 'ltr', { bold: true, size: 40, colour }), { align: 'center', after: 0, line: 240 });
        left += para(run(model.labels.outOf, textDir(model.labels.outOf, d), { size: 9, colour: PALETTE.muted }),
            { dir: d, align: 'center', after: 6 });
    }
    if (model.recommendation) {
        const rd = textDir(model.recommendation, d);
        left += para(run(model.labels.recommendation, textDir(model.labels.recommendation, d),
            { bold: true, size: 8, colour: PALETTE.muted, caps: true }), { dir: d, align: 'center', after: 2 });
        left += para(run(model.recommendation, rd, { bold: true, size: 10, colour: PALETTE.ink }),
            { dir: rd, align: 'center', after: 0 });
    }

    let right = '';
    if (model.breakdown.length) {
        right += para(run(model.labels.breakdown, textDir(model.labels.breakdown, d),
            { bold: true, size: 9, colour: PALETTE.muted, caps: true, spacing: 10 }), { dir: d, after: 6 });
        const nameW = Math.round(rightW * 0.3);
        const valW = 600;
        const barW = rightW - nameW - valW - 400;
        const rows = model.breakdown.map(dim => {
            const ld = textDir(dim.label, d);
            const c = toneColour(dim.value >= 70 ? 'good' : dim.value >= 45 ? 'mid' : 'low');
            return row(
                cellXml(para(run(dim.label, ld, { size: 9.5, colour: PALETTE.ink }), { dir: ld }),
                    { width: nameW, margins: 50, vAlign: 'center' })
                + cellXml(bar(dim.value, c, barW - 100, d) + '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>',
                    { width: barW, margins: 50, vAlign: 'center' })
                + cellXml(para(run(String(dim.value), 'ltr', { bold: true, size: 9.5, colour: c }), { align: 'end' }),
                    { width: valW, margins: 50, vAlign: 'center' }));
        });
        right += table(rows, [nameW, barW, valW], { dir: d }) + '<w:p/>';
    }

    // CT_TcBorders is a sequence too: top, start, bottom, end.
    const edges = `<w:tcBorders><w:top w:val="single" w:sz="4" w:color="${PALETTE.line}"/>`
        + `<w:start w:val="single" w:sz="4" w:color="${PALETTE.line}"/>`
        + `<w:bottom w:val="single" w:sz="4" w:color="${PALETTE.line}"/>`
        + `<w:end w:val="single" w:sz="4" w:color="${PALETTE.line}"/></w:tcBorders>`;
    return para('', { after: 8 }) + table([row(
        cellXml(left, { width: leftW, shade: PALETTE.slateTint, margins: 220, vAlign: 'center', borders: edges })
        + cellXml(right || '<w:p/>', { width: rightW, margins: 220, vAlign: 'center', borders: edges }),
    )], [leftW, rightW], { dir: d });
}

function actionPlan(model: ReportModel): string {
    if (!model.actionPlan.length) return '';
    let out = heading(model.labels.actionPlan, model);
    model.actionPlan.forEach((step, i) => {
        const sd = textDir(step, model.dir);
        out += para(
            run(`${i + 1}.  `, sd, { bold: true, colour: PALETTE.indigo })
            + run(step, sd, { colour: PALETTE.ink }),
            { dir: sd, indent: 400, hanging: 400, after: 4, line: 288 });
    });
    return out;
}

function questionBlock(q: ReportModel['questions'][number], model: ReportModel): string {
    const d = model.dir;
    const label = fill(model.labels.question, { v0: q.number });
    const show = model.show;
    const rated = show.rating && q.rating !== null;
    const tags = [label, q.own ? model.labels.yourQuestion : '', rated ? fill(model.labels.rating, { v0: q.rating! }) : '']
        .filter(Boolean).join('  ·  ');
    const qd = textDir(q.text, d);
    let out = para(run(tags, textDir(tags, d), { bold: true, size: 9, colour: rated && q.tone ? toneColour(q.tone) : PALETTE.indigo, caps: true, spacing: 10 }),
        { dir: textDir(tags, d), keepNext: true, before: 18, after: 2, edge: { colour: PALETTE.indigo, side: 'bottom', size: 6 } });
    out += para(run(q.text, qd, { bold: true, size: 12.5, colour: PALETTE.ink }),
        { style: 'Heading2', dir: qd, keepNext: true, after: 4 });

    if (show.answer) {
        const answer = q.answer || model.labels.noAnswer;
        const answerSuffix = q.seconds ? `  \u00b7  ${clock(q.seconds)}` : '';
        out += panel(model.labels.yourAnswer + answerSuffix, answer, model, PALETTE.slateTint, PALETTE.slate);
    }
    if (show.coaching) {
        out += panel(model.labels.feedback, q.feedback, model, PALETTE.skyTint, PALETTE.sky);
        out += panel(model.labels.fix, q.fix, model, PALETTE.amberTint, PALETTE.amber);
        out += panel(model.labels.improved, q.improved, model, PALETTE.greenTint, PALETTE.green, model.labels.improvedLead);
        out += panel(model.labels.model, q.model, model, PALETTE.indigoTint, PALETTE.indigo, model.labels.modelLead);
        if (q.keyPoints.length) {
            out += panel(model.labels.keyPoints, q.keyPoints.map(p => `•  ${p}`).join('\n'), model, PALETTE.slateTint, PALETTE.slate);
        }
        out += panel(model.labels.why, q.why, model, PALETTE.slateTint, PALETTE.muted);
    } else if (show.strong) {
        // A shorter report: one strong answer, said once, never left blank --
        // a question with nothing under it reads as a page that failed to print.
        out += panel(model.labels.strongAnswer, q.strong || model.labels.noStrong, model,
            PALETTE.greenTint, PALETTE.green);
    }
    return out;
}

// ------------------------------------------------------------- parts

function documentXml(model: ReportModel): string {
    const d = model.dir;
    let body = titleBand(model) + factTable(model);
    if (model.unfinished) {
        body += para('', { after: 4 }) + panel('!', model.labels.unfinished, model, PALETTE.amberTint, PALETTE.amber)
            .replace(/<w:t xml:space="preserve">!<\/w:t>/, '<w:t xml:space="preserve">⚠</w:t>');
    }
    if (model.show.evaluation) body += evaluation(model);
    else {
        body += heading(model.labels.questions, model);
        if (model.contentLead) body += textParas(model.contentLead, d, { size: 9.5, colour: PALETTE.muted, after: 6, italic: true });
        if (!model.questions.length) body += textParas(model.labels.noQuestions, d, { colour: PALETTE.muted });
        for (const q of model.questions) body += questionBlock(q, model);
    }

    body += textParas(model.generatedOn, d, { size: 8, colour: PALETTE.slate, before: 18 });

    const sect = `<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/>`
        + `<w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}"/>`
        + `<w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="567" w:footer="567" w:gutter="0"/>`
        + (d === 'rtl' ? '<w:bidi/>' : '') + '</w:sectPr>';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
        + `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" `
        + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
        + `<w:body>${body}${sect}</w:body></w:document>`;
}

/** The full report's evaluation, then its question-by-question coaching. */
function evaluation(model: ReportModel): string {
    const d = model.dir;
    let body = scoreBlock(model);
    body += section(model.labels.summary, model.summary, model);
    if (model.standout) body += panel(model.labels.standout, model.standout, model, PALETTE.greenTint, PALETTE.green);
    if (model.redFlags) body += panel(model.labels.redFlags, model.redFlags, model, PALETTE.redTint, PALETTE.red);
    if (model.strengths || model.improvements) {
        body += panel(model.labels.strengths, model.strengths, model, PALETTE.greenTint, PALETTE.green);
        body += panel(model.labels.improvements, model.improvements, model, PALETTE.amberTint, PALETTE.amber);
    }
    body += section(model.assessmentTitle, model.assessment, model);
    body += section(model.labels.communication, model.communication, model);
    body += actionPlan(model);

    // A page break only when an evaluation filled the first page; a short or
    // unfinished report runs straight on rather than leaving a page of white.
    body += heading(model.labels.coaching, model, { pageBreak: model.score !== null });
    body += textParas(model.labels.coachingLead, d, { size: 9.5, colour: PALETTE.muted, after: 6, italic: true });
    if (!model.questions.length) body += textParas(model.labels.noQuestions, d, { colour: PALETTE.muted });
    for (const q of model.questions) body += questionBlock(q, model);
    return body;
}

function field(code: string, dir: Dir): string {
    const rtl = dir === 'rtl' ? '<w:rtl/>' : '';
    const rpr = `<w:rPr><w:color w:val="${PALETTE.slate}"/><w:sz w:val="16"/><w:szCs w:val="16"/>${rtl}</w:rPr>`;
    return `<w:r>${rpr}<w:fldChar w:fldCharType="begin"/></w:r>`
        + `<w:r>${rpr}<w:instrText xml:space="preserve"> ${code} </w:instrText></w:r>`
        + `<w:r>${rpr}<w:fldChar w:fldCharType="separate"/></w:r>`
        + `<w:r>${rpr}<w:t>1</w:t></w:r>`
        + `<w:r>${rpr}<w:fldChar w:fldCharType="end"/></w:r>`;
}

function footerXml(model: ReportModel): string {
    const d = model.dir;
    const left = [model.labels.footer, model.candidate].filter(Boolean).join('  ·  ');
    // "Page {v0} of {v1}" with the two numbers as live fields, wherever the
    // translation puts them.
    const page = model.labels.page;
    const pieces = page.split(/(\{v0\}|\{v1\})/);
    const opts = { size: 8, colour: PALETTE.slate };
    const pageRuns = pieces.map(p => p === '{v0}' ? field('PAGE', d) : p === '{v1}' ? field('NUMPAGES', d) : p ? run(p, d, opts) : '').join('');
    const p = para(run(left, d, opts) + run('     ', d, opts) + pageRuns,
        { dir: d, align: 'center', edge: { colour: PALETTE.line, side: 'bottom', size: 4 } })
        .replace('<w:bottom ', '<w:top ');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
        + `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" `
        + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${p}</w:ftr>`;
}

function stylesXml(model: ReportModel): string {
    const lang = model.lang === 'ar' ? 'ar-SA' : model.lang === 'zh' ? 'zh-CN' : 'en-US';
    const fonts = '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei" w:cs="Arial"/>';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
        + `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
        + `<w:docDefaults><w:rPrDefault><w:rPr>${fonts}<w:color w:val="${PALETTE.ink}"/>`
        + `<w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="${lang}" w:eastAsia="zh-CN" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>`
        + `<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
        + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
        + `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>`
        + `<w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/>`
        + `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="3" w:color="${PALETTE.indigoTint}"/></w:pBdr>`
        + `<w:spacing w:before="320" w:after="100"/>`
        + `<w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${PALETTE.indigo}"/>`
        + `<w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>`
        + `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>`
        + `<w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr>`
        + `<w:rPr><w:b/><w:bCs/><w:color w:val="${PALETTE.ink}"/><w:sz w:val="25"/><w:szCs w:val="25"/></w:rPr></w:style>`
        + `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/>`
        + `<w:tblPr><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>`
        + `<w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>`
        + `</w:styles>`;
}

function coreXml(model: ReportModel, now: Date): string {
    const stamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
        + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" `
        + `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" `
        + `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`
        + `<dc:title>${esc([model.title, model.subtitle].filter(Boolean).join(' - '))}</dc:title>`
        + `<dc:creator>${esc(model.brand)}</dc:creator>`
        + (model.candidate ? `<dc:subject>${esc(model.candidate)}</dc:subject>` : '')
        + `<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created>`
        + `<dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified>`
        + `</cp:coreProperties>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`
    + `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>`
    + `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`
    + `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`
    + `</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>`
    + `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>`
    + `</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + `<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`
    + `</Relationships>`;

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Every part of the document, by path -- what the check reads. */
export function docxParts(model: ReportModel, now = new Date()): { name: string; data: string }[] {
    return [
        { name: '[Content_Types].xml', data: CONTENT_TYPES },
        { name: '_rels/.rels', data: ROOT_RELS },
        { name: 'word/document.xml', data: documentXml(model) },
        { name: 'word/styles.xml', data: stylesXml(model) },
        { name: 'word/footer1.xml', data: footerXml(model) },
        { name: 'word/_rels/document.xml.rels', data: DOC_RELS },
        { name: 'docProps/core.xml', data: coreXml(model, now) },
    ];
}

export function buildDocx(model: ReportModel, now = new Date()): Uint8Array {
    return zipStore(docxParts(model, now), now);
}
