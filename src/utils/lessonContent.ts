// src/utils/lessonContent.ts
//
// A lesson's write-up, turned into blocks a template can render WITHOUT v-html.
//
// App 19 stores `content` as one plain string per language. It is written by an
// operator in selfstudyadmin, often drafted by a model, and it wants headings,
// paragraphs, bullets, numbered steps and code — which is markdown-shaped, and
// markdown is exactly where this platform has been bitten before.
//
// WHY NOT `marked` + v-html
// -------------------------
// Three components under src/components/netsim/ do `marked.parse(text)` into
// v-html, and every one of them is rendering text the local netsim engine wrote.
// Lesson content is different in one way that matters: it is a RECORD, fetched
// over the network from a service whose write path is reachable with the shared
// service token, and rendered on a page a signed-out visitor can open. Working
// rule 13 is unambiguous about that direction — a `<img src=x onerror=…>` in a
// stored field must not become an element. `linkify.ts` exists because the one
// place that ignored this shipped a real XSS in a course comment.
//
// So nothing here produces HTML. It produces a typed list of blocks, and
// LessonDetails.vue renders each with `{{ }}` or with `<RichText>`, which
// escapes before it inserts the anchors it built itself. The cost is that we
// support a deliberately small notation rather than all of markdown; the benefit
// is that there is no path from a stored string to an executed script, and
// `marked` stays out of the route's chunk.
//
// WHY IT IS A PLAIN MODULE
// ------------------------
// No Vue, no DOM — the same precedent as photoMask.ts, drawEngine.ts,
// chatMedia.ts, appNav.ts, examShuffle.ts, proctorQueue.ts, newscastEngine.ts
// and leaderboardEngine.ts. `npm run check:lessoncontent` drives it in node in
// about a second. The failures worth catching are all invisible in a screenshot
// of one lesson: an unterminated fence swallowing the rest of the write-up, a
// heading marker rendered as literal `##`, a numbered list restarting at 1, and
// — the one that only shows in Arabic — a code block that is not pinned LTR.
//
// THE NOTATION, and it is the same in all three languages
// ------------------------------------------------------
//   ## Heading            a section heading (one to three #, all one level)
//   - item  /  * item     a bullet
//   1. item               a numbered step
//   > note                a callout
//   | a | b |             a table, when the next line is a |---|---| rule
//   ```                   a fence; everything until the closing ``` is code
//   anything else         a paragraph, joined across single newlines
//
// Every marker is PUNCTUATION rather than markup, which is what lets an Arabic
// or Chinese translation of the same field carry it unchanged: the console's
// prompt tells the model to keep the structure and leave fenced blocks in
// English, so `blocks(en)` and `blocks(ar)` come out the same shape. A reader
// switching language sees the same document, not a different one.

import { countWords, getLocale } from '@/i18n/locales';

/** A fenced block. Never translated, never mirrored, always pinned LTR. */
export interface CodeBlock {
    kind: 'code';
    /** The fence's info string (```bash), lowercased. '' when there was none. */
    language: string;
    text: string;
}

export interface HeadingBlock {
    kind: 'heading';
    text: string;
}

export interface ParagraphBlock {
    kind: 'paragraph';
    text: string;
}

export interface NoteBlock {
    kind: 'note';
    text: string;
}

export interface ListBlock {
    kind: 'list';
    /** `true` for `1.` items, `false` for `-` / `*`. */
    ordered: boolean;
    /** What the first item was numbered, so a step list that starts at 4 does. */
    start: number;
    items: string[];
}

/**
 * A comparison table.
 *
 * Here because a table is the clearest form a great deal of this material has -
 * containers against virtual machines, the three probes, requests against
 * limits - and because without a kind for it the parser falls through to
 * "anything else is a paragraph, joined across single newlines". A whole table
 * then renders as one run of pipe characters, which is worse than no table:
 * every fact is present and none of it is readable.
 *
 * `head` is empty when there is no header row, which is legal and rare. Every
 * row is padded to the widest one, because a row missing its trailing cell
 * would otherwise shift every column after it - and a table misaligned by one
 * cell says something different from the one that was written.
 */
export interface TableBlock {
    kind: 'table';
    head: string[];
    rows: string[][];
}

export type LessonBlock =
    | HeadingBlock
    | ParagraphBlock
    | NoteBlock
    | ListBlock
    | TableBlock
    | CodeBlock;

/** How much of a write-up is parsed. 200k characters is ~50 A4 pages. */
export const MAX_CONTENT_CHARS = 200_000;

const FENCE = /^\s*```+\s*([A-Za-z0-9+#._-]*)\s*$/;
const HEADING = /^\s{0,3}#{1,3}\s+(.*\S)\s*$/;
// A bare marker on its own line (`-`, `2.`) is a leftover from an edit or from a
// document export, and it matches here WITH AN EMPTY TAIL rather than not
// matching at all. Left to fall through as prose it would split one list into
// two around an empty paragraph, which reads as two lists somebody forgot to
// merge; matched and dropped, the list stays one list.
const BULLET = /^\s{0,3}[-*•](?:\s+(.*))?$/;
const NUMBERED = /^\s{0,3}(\d{1,3})[.)](?:\s+(.*))?$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
// A table ROW is any line whose first non-space character is a pipe. A table
// only STARTS when the line after it is the separator rule - `|---|---|`, with
// optional alignment colons. Both conditions are needed: without the second, a
// sentence containing a pipe starts a table, and this platform teaches shell.
const TABLE_ROW = /^\s{0,3}\|/;
const TABLE_RULE = /^\s{0,3}\|[\s|:-]*$/;

/**
 * The write-up as blocks. Never throws, and never returns partial nonsense for
 * a string that is simply not in this notation — a plain paragraph of prose with
 * no markers at all comes back as one paragraph block, which is the common case
 * for a lesson somebody typed by hand.
 */
export function blocks(content: string | null | undefined): LessonBlock[] {
    const text = typeof content === 'string' ? content : '';
    if (!text.trim()) return [];

    const lines = text
        .slice(0, MAX_CONTENT_CHARS)
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n');

    const out: LessonBlock[] = [];
    let paragraph: string[] = [];
    let list: ListBlock | null = null;
    let note: string[] = [];

    const flushParagraph = () => {
        const joined = paragraph.join(' ').trim();
        if (joined) out.push({ kind: 'paragraph', text: joined });
        paragraph = [];
    };
    const flushList = () => {
        if (list && list.items.length) out.push(list);
        list = null;
    };
    const flushNote = () => {
        const joined = note.join(' ').trim();
        if (joined) out.push({ kind: 'note', text: joined });
        note = [];
    };
    const flushAll = () => { flushParagraph(); flushList(); flushNote(); };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // ---- code ----------------------------------------------------------
        const fence = FENCE.exec(line);
        if (fence) {
            flushAll();
            const language = (fence[1] || '').toLowerCase();
            const body: string[] = [];
            i++;
            for (; i < lines.length; i++) {
                if (FENCE.test(lines[i])) break;
                body.push(lines[i]);
            }
            // AN UNTERMINATED FENCE IS KEPT, not discarded and not allowed to
            // swallow the document. A model that stops mid-block, or an operator
            // who deletes a closing fence, would otherwise lose every heading
            // and paragraph after that point — silently, at HTTP 200, with the
            // page simply looking short. Trailing blank lines go, because an
            // unterminated block usually has the rest of the file's whitespace
            // in it.
            while (body.length && !body[body.length - 1].trim()) body.pop();
            const joined = body.join('\n');
            if (joined.trim()) out.push({ kind: 'code', language, text: joined });
            continue;
        }

        // ---- heading -------------------------------------------------------
        const heading = HEADING.exec(line);
        if (heading) {
            flushAll();
            out.push({ kind: 'heading', text: heading[1] });
            continue;
        }

        // ---- callout -------------------------------------------------------
        const quote = QUOTE.exec(line);
        if (quote) {
            flushParagraph();
            flushList();
            note.push(quote[1]);
            continue;
        }

        // ---- table ---------------------------------------------------------
        // Before the list branch, so a separator row that begins `|-` can
        // never be read as a bullet.
        if (TABLE_ROW.test(line) && i + 1 < lines.length
                && TABLE_RULE.test(lines[i + 1])) {
            flushAll();
            const head = tableCells(line);
            const rows: string[][] = [];
            i += 2;                        // past the header and its rule
            for (; i < lines.length && TABLE_ROW.test(lines[i]); i++) {
                if (TABLE_RULE.test(lines[i])) continue;
                rows.push(tableCells(lines[i]));
            }
            i--;                           // the loop's own i++ takes the next
            const width = Math.max(head.length, 1,
                                   ...rows.map(row => row.length));
            const pad = (row: string[]): string[] => {
                const copy = row.slice(0, width);
                while (copy.length < width) copy.push('');
                return copy;
            };
            if (head.length || rows.length) {
                out.push({
                    kind: 'table',
                    head: head.length ? pad(head) : [],
                    rows: rows.map(pad),
                });
            }
            continue;
        }

        // ---- list ----------------------------------------------------------
        const bullet = BULLET.exec(line);
        const numbered = NUMBERED.exec(line);
        if (bullet || numbered) {
            flushParagraph();
            flushNote();
            const ordered = !!numbered;
            const item = ((numbered ? numbered[2] : bullet![1]) || '').trim();
            // A numbered list keeps the number it STARTED at. A lesson whose
            // steps continue at 4 after a code block is a real shape in this
            // data — the console's drafts do it constantly — and restarting the
            // list at 1 tells a student to redo three steps they have done.
            const startAt = numbered ? parseInt(numbered[1], 10) : 1;
            if (!list || list.ordered !== ordered) {
                flushList();
                list = { kind: 'list', ordered, start: startAt, items: [] };
            }
            if (item) list.items.push(item);
            continue;
        }

        // ---- blank ---------------------------------------------------------
        if (!line.trim()) { flushAll(); continue; }

        // ---- prose ---------------------------------------------------------
        // A single newline inside a paragraph is a soft wrap, exactly as HTML
        // treats it. Google Docs exports — which is what most of this content is
        // derived from — wrap at the page width, so honouring every newline
        // would render one sentence as six ragged lines.
        flushList();
        if (note.length) flushNote();
        paragraph.push(line.trim());
    }

    flushAll();
    return out;
}

/**
 * One table row's cells.
 *
 * The leading and trailing pipes are optional in every markdown dialect and
 * both spellings appear in this content, so an empty first or last cell created
 * purely by a border pipe is dropped - otherwise every table gains a blank
 * column at each edge.
 */
function tableCells(line: string): string[] {
    const cells = line.trim().split('|').map(cell => cell.trim());
    if (cells.length && cells[0] === '') cells.shift();
    if (cells.length && cells[cells.length - 1] === '') cells.pop();
    return cells;
}


/** Whether there is anything to show. Cheaper than parsing to find out. */
export function hasContent(content: string | null | undefined): boolean {
    return typeof content === 'string' && content.trim().length > 0;
}

/**
 * Roughly how long the write-up takes to read, in minutes, at 200 wpm.
 *
 * Code is EXCLUDED from the count and that is not a rounding decision: a lesson
 * that is mostly a 300-line configuration file is not a 12-minute read, and a
 * badge saying so reads as the platform not having looked at the page.
 *
 * The word count comes from `countWords` in src/i18n/locales.ts rather than from
 * a copy here, because the CJK-by-codepoint rule is the same rule and a second
 * copy of that character range is a second place for it to be wrong (working
 * rule 40 -- a rule tuned on English prose is a rule that miscounts every other
 * script, and this platform has paid for that three times already). Without it a
 * Chinese lesson of any length reports a one-minute read, since `zh` has no
 * spaces for a `split(/\s+/)` to find.
 */
export function readingMinutes(content: string | null | undefined,
                               localeId?: string): number {
    const locale = getLocale(localeId);
    let words = 0;
    for (const block of blocks(content)) {
        if (block.kind === 'code') continue;
        // A table has no `.text`, so the two-way ternary this replaced handed
        // `undefined` to countWords - and a table IS reading, often the densest
        // part of a lesson, so its words have to count.
        const text = block.kind === 'list' ? block.items.join(' ')
            : block.kind === 'table'
                ? [...block.head, ...block.rows.flat()].join(' ')
                : block.text;
        words += countWords(text, locale);
    }
    if (!words) return 0;
    return Math.max(1, Math.round(words / 200));
}

/**
 * The headings, for an on-page contents list.
 *
 * Built from the SAME blocks the page renders rather than from a second scan, so
 * a contents entry can never point at a heading that is not on the screen.
 */
export function outline(content: string | null | undefined): string[] {
    return blocks(content)
        .filter((b): b is HeadingBlock => b.kind === 'heading')
        .map(b => b.text);
}

/**
 * What kind of media a URL is, from its extension alone.
 *
 * App 18 stores a lesson's image and its video under separate collections and
 * app 19 keeps them in separate fields, so this is a backstop rather than the
 * primary signal: an operator who pastes an .mp4 into the image box would
 * otherwise get an `<img>` that renders as a broken-image icon, which reads as
 * the file having failed to upload.
 *
 * There is no HEAD request. It is one round trip per lesson to a media replica
 * to decide which element to draw, and being wrong costs a placeholder while
 * being slow costs every reader twenty seconds on a cold replica.
 */
export function mediaKind(url: string | null | undefined): 'image' | 'video' | 'unknown' {
    const clean = String(url || '').split('?')[0].split('#')[0].toLowerCase();
    if (!clean) return 'unknown';
    if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(clean)) return 'image';
    if (/\.(mp4|webm|ogg|ogv|mov|m4v)$/.test(clean)) return 'video';
    return 'unknown';
}
