/**
 * src/utils/aichatMarkdown.ts — an assistant reply as a list of typed blocks.
 *
 * A plain module, no Vue and no DOM. `npm run check:aichat` drives it.
 *
 * WHY THIS EXISTS RATHER THAN `marked` + `v-html`
 * ===============================================
 *
 * That is what the previous AI Chat page did, and it is a real cross-site
 * scripting hole rather than a theoretical one:
 *
 *   * `marked` passes raw HTML through by design. Markdown includes HTML.
 *   * The text is written by a LANGUAGE MODEL, and this is a study platform
 *     that teaches web development — so `<img src=x onerror=...>` appears in a
 *     perfectly ordinary answer about image tags, with nobody attacking
 *     anything.
 *   * And the user controls the input. "Reply with exactly this HTML and no
 *     code fence" is one sentence.
 *
 * That is self-XSS in the immediate case and not only self-XSS in general: a
 * reply is stored, replicated to every peer, mirrored into a GitHub data repo,
 * and rendered again on every later visit. Working rule 13 says user-written
 * text never reaches `v-html`; a model writing on the user's instruction is the
 * same text with an extra step.
 *
 * So nothing here produces markup. It produces DATA, and the template binds it
 * with `{{ }}` and real elements — the same answer `lessonContent.ts` gives for
 * the lesson page, and for the same reason.
 *
 * THE NOTATION IS DELIBERATELY SMALL
 * ==================================
 *
 * Fences, headings, bullet and numbered lists, block quotes, paragraphs. That
 * is what a model actually emits when it explains something with code in it.
 * Inline emphasis is NOT parsed: `**` and `_` around a word are left exactly as
 * the model wrote them, because the alternative is either shipping markup (the
 * whole thing this avoids) or an inline-span parser whose failure mode is
 * eating a `*` out of `SELECT *` and a `_` out of `user_id`. On a platform whose
 * labs are SQL, Linux and Python that trade is not close.
 */

export interface CodeBlock { kind: 'code'; text: string; lang: string }
export interface TextBlock { kind: 'paragraph' | 'heading' | 'quote'; text: string }
export interface ListBlock { kind: 'list'; items: string[] }
export interface OrderedBlock { kind: 'ordered'; items: string[]; start: number }
export type MdBlock = CodeBlock | TextBlock | ListBlock | OrderedBlock;

const FENCE = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9+#._-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const ORDERED = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;

/**
 * Split a reply into blocks.
 *
 * Five properties in here fail silently, and each is why this is a module with
 * a check rather than four lines inside the component:
 *
 *   * AN UNTERMINATED FENCE DOES NOT SWALLOW THE ANSWER. A model cut off
 *     mid-block — which is routine, `finish_reason: length` — would otherwise
 *     lose every paragraph after it. What is open at the end is closed and
 *     rendered as code, so the reader sees a truncated answer instead of a
 *     short one.
 *
 *   * A `#` INSIDE A FENCE IS A SHELL COMMENT. This platform teaches shell.
 *
 *   * A NUMBERED LIST KEEPS THE NUMBER IT STARTED AT. Models resume a step list
 *     after a code block constantly; restarting at 1 tells somebody to redo
 *     three steps they have done.
 *
 *   * A SINGLE NEWLINE IS A SOFT WRAP. Providers hard-wrap prose, and honouring
 *     every newline renders one sentence as six ragged lines.
 *
 *   * THE FENCE MARKER IS MATCHED ON ITS OWN CHARACTER. A ``` block containing
 *     a ~~~ line, or the other way round, is common in an answer that is itself
 *     about Markdown.
 */
export function renderMarkdown(content: string): MdBlock[] {
    const lines = (content || '').replace(/\r\n?/g, '\n').split('\n');
    const blocks: MdBlock[] = [];

    let para: string[] = [];
    let quote: string[] = [];
    let bullets: string[] = [];
    let ordered: string[] = [];
    let orderedStart = 1;

    const flushPara = () => {
        if (para.length) blocks.push({ kind: 'paragraph', text: para.join(' ').trim() });
        para = [];
    };
    const flushQuote = () => {
        if (quote.length) blocks.push({ kind: 'quote', text: quote.join(' ').trim() });
        quote = [];
    };
    const flushLists = () => {
        if (bullets.length) blocks.push({ kind: 'list', items: bullets });
        bullets = [];
        if (ordered.length) blocks.push({ kind: 'ordered', items: ordered, start: orderedStart });
        ordered = [];
    };
    const flushAll = () => { flushPara(); flushQuote(); flushLists(); };

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const fence = FENCE.exec(line);

        if (fence) {
            flushAll();
            const marker = fence[1][0];
            const lang = fence[2] || '';
            const body: string[] = [];
            i++;
            while (i < lines.length) {
                const close = FENCE.exec(lines[i]);
                // Only a fence of the SAME character closes this one.
                if (close && close[1][0] === marker) { i++; break; }
                body.push(lines[i]);
                i++;
            }
            // Trailing blank lines inside a fence are the model's formatting,
            // not the code; leading ones are removed for the same reason.
            while (body.length && !body[0].trim()) body.shift();
            while (body.length && !body[body.length - 1].trim()) body.pop();
            blocks.push({ kind: 'code', text: body.join('\n'), lang });
            continue;
        }

        if (!line.trim()) { flushAll(); i++; continue; }

        const heading = HEADING.exec(line);
        if (heading) {
            flushAll();
            blocks.push({ kind: 'heading', text: heading[2].trim() });
            i++;
            continue;
        }

        const q = QUOTE.exec(line);
        if (q) { flushPara(); flushLists(); quote.push(q[1]); i++; continue; }

        const bullet = BULLET.exec(line);
        if (bullet) {
            flushPara(); flushQuote();
            if (ordered.length) { blocks.push({ kind: 'ordered', items: ordered, start: orderedStart }); ordered = []; }
            bullets.push(bullet[1].trim());
            i++;
            continue;
        }

        const num = ORDERED.exec(line);
        if (num) {
            flushPara(); flushQuote();
            if (bullets.length) { blocks.push({ kind: 'list', items: bullets }); bullets = []; }
            if (!ordered.length) orderedStart = parseInt(num[1], 10) || 1;
            ordered.push(num[2].trim());
            i++;
            continue;
        }

        // A continuation line inside a list belongs to the last item rather
        // than starting a paragraph in the middle of it.
        if (bullets.length) { bullets[bullets.length - 1] += ' ' + line.trim(); i++; continue; }
        if (ordered.length) { ordered[ordered.length - 1] += ' ' + line.trim(); i++; continue; }

        flushQuote();
        para.push(line.trim());
        i++;
    }

    flushAll();
    return blocks;
}

/**
 * A one-line preview of a reply, for a list row.
 *
 * The blocks, not the raw text: a reply that opens with a fence would otherwise
 * preview as three backticks and a language name.
 */
export function previewOf(content: string, limit = 120): string {
    for (const block of renderMarkdown(content)) {
        if (block.kind === 'code') continue;
        const text = block.kind === 'list' || block.kind === 'ordered'
            ? block.items.join(', ')
            : block.text;
        if (text.trim()) {
            return text.length > limit ? text.slice(0, limit).trimEnd() + '…' : text;
        }
    }
    return '';
}
