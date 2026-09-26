/**
 * READING A SECTION OF A PAGE ALOUD, in the language the text is actually in.
 *
 * A student presses "Read this section" on a lesson, a runbook step, a lab
 * brief or a networking lesson, and a voice reads it to them. This module is
 * the half that DECIDES: what gets said, in what order, in which language, and
 * in what size pieces. The half that touches the browser is
 * `src/composables/useReader.ts`, and the routing between a device voice, app
 * 36's server voice and the platform engine is `roomSpeech.ts` -- which already
 * exists, is already checked, and is not re-derived here.
 *
 * Plain on purpose: no Vue, no DOM, no service imports. Same precedent as
 * `lessonContent.ts`, `photoMask.ts`, `drawEngine.ts` and `leaderboardEngine.ts`,
 * and for the same reason -- every mistake below is one nobody can see in a
 * screenshot, because the failure is a voice saying the wrong thing or saying
 * nothing, and a page that looks perfect either way. `npm run check:reader`
 * drives it in node.
 *
 * ============================================================
 * 1. THE VOICE FOLLOWS THE SCRIPT OF THE TEXT, NOT THE INTERFACE SETTING
 * ============================================================
 *
 * This is the decision the whole feature rests on, and it is the one that looks
 * wrong until you know why.
 *
 * The obvious design is "the reader picked Arabic, so use the Arabic voice".
 * That is correct exactly when the text is Arabic, and on this platform it
 * routinely is not:
 *
 *  - A lesson's write-up is read with `$td(lesson, 'content')`, and `$td` falls
 *    back to the record's own ENGLISH field when there is no translation. All
 *    25 original courses and 270 lessons carry Arabic and Chinese titles, and
 *    the DevOps, course-enhancement and Claude packs then added ~230 write-ups
 *    that are **English only**. So an Arabic reader on one of those lessons is
 *    looking at English prose under an Arabic interface -- which is the normal,
 *    documented, deliberate state (working rule 41: the English fallback is
 *    strictly better than a divergent copy).
 *  - The Network Simulator's lessons are a compiled-in TypeScript catalogue
 *    (`src/netsim/lessons.ts`). Every word of the theory, the objectives and
 *    the key terms is English and there is no translation mechanism for them at
 *    all.
 *  - A runbook section's `content` is translatable and a CODE section's is not,
 *    so one runbook legitimately mixes both.
 *
 * Handing English prose to an Arabic voice is not accented English. It is
 * noise -- the same failure `pickVoice` returns null to prevent, arriving from
 * the DATA side instead of the device side. And it is worse than silence,
 * because the listener cannot tell whether the feature is broken or their own
 * comprehension is.
 *
 * So {@link detectLang} reads the script off the characters and the composable
 * casts a voice for THAT, per block. The UI says so when it differs from the
 * interface -- substituting is acceptable only because it is declared (working
 * rule 21).
 *
 * ============================================================
 * 2. CODE IS NEVER READ ALOUD
 * ============================================================
 *
 * `rtl.css` pins every `<pre>` left-to-right because the bidi algorithm
 * relocates a pipe and a flag and the student copies a command that does not
 * run. The same argument reaches speech and lands harder: read aloud,
 * `hdfs dfs -du -h -s /data` is somewhere between unintelligible and actively
 * misleading, and a 300-line configuration file is forty minutes of it. This
 * platform's labs are SQL, Linux, Python, Terraform and Cisco IOS, so a fenced
 * block is a large share of the material.
 *
 * Fenced blocks are therefore skipped, and {@link ReadingPlan.skippedCode}
 * COUNTS them so the button can say so. Skipping silently would leave a student
 * waiting for the command they can see on the screen in front of them.
 *
 * ============================================================
 * 3. A TABLE IS READ AS PAIRS, NOT AS A STREAM OF CELLS
 * ============================================================
 *
 * Half the DevOps write-ups carry a comparison table and it is often the
 * densest part of the lesson. Read row-major with no attribution, a four-column
 * table is "docker, yes, 20 MB, seconds, vm, no, 2 GB, minutes" -- every fact
 * present and none of it attached to anything. Each cell is paired with its
 * column heading instead. See {@link tableSpeech}.
 *
 * ============================================================
 * 4. WHY IT IS CHUNKED, AND WHY THE BUDGET IS 360 RATHER THAN 1200
 * ============================================================
 *
 * See {@link SPEECH_BUDGET}. Both numbers are somebody else's limit, and the
 * gap between them is time-to-first-word.
 */

import { blocks, type LessonBlock, type TableBlock } from '@/utils/lessonContent';
import {
    estimateDurationMs, sentences, speakable, type LanguageCode,
} from '@/components/newscast/newscastEngine';

/**
 * The three languages this platform speaks.
 *
 * Deliberately the same union as `LocaleId` and `LanguageCode` rather than a
 * fourth spelling of it: a reader language that could not be a locale would be
 * a voice nothing can cast, and one that could not be a `LanguageCode` could
 * not be sent to app 36.
 */
export type ReaderLang = LanguageCode;

/** One thing said in one breath, in one voice. */
export interface Passage {
    /** What is spoken. Already through {@link plain} and `speakable`. */
    text: string;
    /**
     * The language this text is IN, from its own characters. Not the reader's
     * setting -- see the header.
     */
    lang: ReaderLang;
}

/**
 * Everything the UI needs to describe a read before it starts, and everything
 * the composable needs to perform it.
 */
export interface ReadingPlan {
    passages: Passage[];
    /**
     * How many fenced blocks were left out.
     *
     * Reported rather than swallowed: a student looking at a command on the
     * screen needs to know the voice is not going to read it, or they wait for
     * it and conclude the reader stopped.
     */
    skippedCode: number;
    /** Distinct languages, in the order first met. Empty when there is nothing to read. */
    languages: ReaderLang[];
    /** Spoken characters. What {@link estimateMs} is computed from. */
    chars: number;
}

/**
 * Nothing to read.
 *
 * A FACTORY and not a shared constant, which is the version that survives
 * contact with a caller. The first spelling was an exported constant with every
 * early return doing a SPREAD of it -- and a spread is shallow, so every empty
 * plan on the platform shared one `passages` array and one `languages` array. A
 * component that pushed into either, or a Vue `reactive` wrapper that adopted
 * them, would have been mutating the state of every other section that had
 * nothing to read, and the symptom would be a section reading somebody else's
 * text. Found by `check:reader`, which pushes into one and then asks the next
 * caller what it got.
 */
export function emptyPlan(): ReadingPlan {
    return { passages: [], skippedCode: 0, languages: [], chars: 0 };
}

/**
 * APP 36 TRUNCATES A SYNTHESIS REQUEST AT 1200 CHARACTERS, SILENTLY.
 *
 * `utils/tts.py` does `text = text[:MAX_TEXT_CHARS]` and returns 200 with the
 * audio for whatever survived -- no error, no header, no hint. So a passage over
 * this length is a sentence that stops mid-word and a student who reasonably
 * concludes the platform lost the rest of the paragraph.
 *
 * Exported so the check can assert {@link SPEECH_BUDGET} and
 * {@link PASSAGE_CEILING} both stay under it. Nothing should ever send this
 * much.
 */
export const SERVER_TEXT_LIMIT = 1200;

/**
 * How much text goes into one utterance. 360 characters.
 *
 * Not the server's limit, and much less than it, for three reasons -- the first
 * of which is the one a reader actually feels:
 *
 *  1. **TIME TO FIRST WORD.** On the server route nothing is heard until the
 *     first clip has been synthesised, and the fallback provider chunks
 *     internally at ~190 characters and concatenates the results, so synthesis
 *     time is roughly linear in the text. A 1200-character first request is
 *     about six sequential internal round trips before a single word comes out
 *     -- on a PythonAnywhere replica whose first answer of the day takes ~20
 *     seconds anyway. At 360 it is two, and the next passage is prefetched
 *     while this one plays, so the seam is inaudible after that.
 *  2. **Progress that means something.** The passage index is the only progress
 *     signal there is; four enormous passages is a bar that moves three times
 *     in twenty minutes.
 *  3. **Chrome stops `speechSynthesis` after ~15 seconds** and frequently never
 *     fires `onend`. The composable runs the documented pause/resume keepalive
 *     and a watchdog anyway, because "should" is not a guarantee -- but a
 *     shorter utterance is inherently less exposed to it.
 *
 * ~360 characters is two or three sentences of English and about twenty seconds
 * of speech. It is a soft target: a sentence is never cut to meet it (see
 * {@link chunk}), so a passage can exceed it -- which is why the hard ceiling
 * below exists separately.
 */
export const SPEECH_BUDGET = 360;

/**
 * The hard ceiling a passage may never exceed, even to keep a sentence whole.
 *
 * A single sentence longer than this really does have to be cut, and it is cut
 * at a comma or a space rather than mid-word ({@link splitLong}). Well under
 * {@link SERVER_TEXT_LIMIT}, because the sentence boundary is a preference and
 * not being truncated by the backend is not.
 */
export const PASSAGE_CEILING = 900;

/* ------------------------------------------------------------------ *
 * Which language is this text in?
 * ------------------------------------------------------------------ */

/**
 * Letters, by script. Punctuation, digits and whitespace are not evidence.
 *
 * `192.168.10.0/24` and `HTTP/2` are the same in all three languages, so a
 * count that included them would read a table of addresses as English.
 */
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
// Unified ideographs plus the two extension blocks that actually turn up in
// simplified copy. Hiragana and Katakana are deliberately absent: they are
// Japanese, this platform has no Japanese, and counting them as Chinese would
// cast a Mandarin voice at a language it cannot read.
const HAN = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;
const LATIN = /[A-Za-z\u00C0-\u024F]/;

/**
 * How many characters make one WORD in each script.
 *
 * The comparison has to be at word-equivalents rather than at raw character
 * counts, and this is the whole reason:
 *
 *   "HTTP 标头"  --  4 Latin letters, 2 Han characters.
 *
 * Counted raw, Latin wins 4 to 2 and an English voice is handed 标头, which is
 * silence or noise depending on the engine. Normalised, it is 0.8 English words
 * against 1.33 Chinese words and Chinese wins, which is right: one Han
 * character is a whole syllable and usually a whole morpheme, where an English
 * word averages about five letters. Arabic sits between them because it is
 * written without short vowels.
 *
 * These are ratios, not precise figures, and nothing depends on them being
 * exact -- only on them being in the right ORDER, which is what stops a handful
 * of Latin technical terms in an Arabic or Chinese paragraph from capturing the
 * whole block.
 */
const CHARS_PER_WORD: Record<ReaderLang, number> = { en: 5, ar: 4, zh: 1.5 };

/**
 * Which language a passage is in, by script, normalised to word-equivalents.
 *
 * `fallback` is used ONLY when there is not a single letter of any of the three
 * scripts -- a row of IP addresses, a version number, a bare identifier. Those
 * are the same in every language, so the reader's own setting is the friendly
 * answer rather than a guess.
 *
 * Note what this deliberately does NOT do: it never prefers the fallback
 * because the fallback is what the reader asked for. An Arabic interface over
 * an English write-up answers `en`, every time, and that is the point of the
 * function.
 */
export function detectLang(text: string, fallback: ReaderLang = 'en'): ReaderLang {
    let arabic = 0;
    let han = 0;
    let latin = 0;
    for (const ch of String(text || '')) {
        if (ARABIC.test(ch)) arabic++;
        else if (HAN.test(ch)) han++;
        else if (LATIN.test(ch)) latin++;
    }
    if (!arabic && !han && !latin) return fallback;

    const scores: Array<[ReaderLang, number]> = [
        ['ar', arabic / CHARS_PER_WORD.ar],
        ['zh', han / CHARS_PER_WORD.zh],
        ['en', latin / CHARS_PER_WORD.en],
    ];
    // A stable maximum: ties go to the earlier entry, which is deterministic
    // rather than dependent on sort order. A tie between two scripts is
    // vanishingly rare and either answer is defensible; an answer that CHANGES
    // between two renders of the same text is not.
    let best = scores[0]!;
    for (const entry of scores) if (entry[1] > best[1]) best = entry;
    return best[0];
}

/* ------------------------------------------------------------------ *
 * Turning written text into spoken text
 * ------------------------------------------------------------------ */

/** Every sentence terminator in all three scripts, for the pause test below. */
const TERMINATORS = '.!?؟۔。！？:：';

/**
 * Does this already end in something a voice will pause on?
 *
 * Used when several short units are joined -- list items, table cells. Without
 * it a five-item list is read as one run-on sentence with no breath in it,
 * which is materially harder to follow than the same words on screen.
 */
function terminated(text: string): boolean {
    const last = text.trim().slice(-1);
    return !!last && TERMINATORS.includes(last);
}

/** Add a stop only where there is not one already. */
function withStop(text: string): string {
    const clean = text.trim();
    if (!clean) return '';
    return terminated(clean) ? clean : `${clean}.`;
}

/**
 * Strip the inline notation a reader can see but a voice must not say.
 *
 * `lessonContent.blocks()` handles the BLOCK notation -- fences, headings, list
 * markers, quote markers, table pipes -- so what is left is what sits inside a
 * line. The engines differ on how much of it they read out: some say "asterisk
 * asterisk" and some silently skip it, so leaving it in is a feature that works
 * on the developer's machine.
 *
 * Three decisions in here:
 *
 *  * **A link becomes its TEXT.** `[the Docker docs](https://...)` is read as
 *    "the Docker docs" -- the URL is stripped by `speakable` afterwards anyway,
 *    and a voice reading a URL aloud character by character is the single most
 *    unpleasant thing a screen reader does.
 *  * **Inline code keeps its CONTENT.** `` `ARP` `` is read as "ARP", because
 *    inline code in this material is almost always a term or a keyword in the
 *    middle of a sentence, and dropping it removes the subject. That is a
 *    different case from a FENCED block, which is a command to be typed and is
 *    dropped whole -- see the header.
 *  * **A lone underscore is LEFT ALONE.** `user_id`, `exam_pass_score` and
 *    `lab_feature` are identifiers this platform prints constantly, and the
 *    regex that removes `_emphasis_` without eating them needs a LOOKBEHIND --
 *    which is a *parse-time* syntax error on Safari before 16.4 and would take
 *    the whole bundle down on that browser rather than merely misreading a
 *    word. `linkify.ts` documents the same trap, and the cost of not stripping
 *    it is that one engine in ten says "underscore". Paired `__double__` IS
 *    handled, because `user__id` is not a thing.
 */
export function plain(text: string): string {
    const out = String(text || '')
        // Images and links, in that order, keeping the alt/label.
        .replace(/!\[([^\]\n]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]\n]*)\]\([^)]*\)/g, '$1')
        // Inline code: keep what is inside it.
        .replace(/`([^`\n]+)`/g, '$1')
        // Emphasis. Paired markers only, so nothing unbalanced is touched.
        .replace(/\*\*([^*\n]+)\*\*/g, '$1')
        .replace(/__([^_\n]+)__/g, '$1')
        .replace(/\*([^*\n]+)\*/g, '$1')
        .replace(/~~([^~\n]+)~~/g, '$1')
        // Leftover block markers, for a caller that hands over a raw line
        // rather than a parsed block.
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        .replace(/^\s{0,3}>\s?/gm, '')
        // A horizontal rule is a picture, not a word.
        .replace(/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/gm, ' ');
    // And then the shared pass: entities, bare URLs, pipes, ellipses, the dash
    // rules and the CJK spacing rule. One implementation, already driven by
    // `check:newscast` -- a second copy of the dash logic is a second place for
    // "Tibet, the Nepal border" to come back.
    return speakable(out);
}

/* ------------------------------------------------------------------ *
 * Chunking
 * ------------------------------------------------------------------ */

/** Places it is acceptable to cut a sentence that is simply too long. */
const SOFT_BREAKS = ',;:،؛，、；：';

/**
 * Cut one over-long sentence into pieces, at the least bad place available.
 *
 * Preference order: a comma-class mark, then a space, then the ceiling itself.
 * A cut is only accepted in the back 60% of the window -- cutting at the first
 * comma of a 900-character sentence would produce a four-word fragment followed
 * by another over-long one, i.e. the same problem plus a stutter.
 *
 * The space step is skipped for Chinese, which has none; there the mark or the
 * ceiling decides. Guaranteed to make progress: the cut is never below 1, so
 * this cannot loop.
 */
export function splitLong(text: string, lang: ReaderLang,
                          ceiling = PASSAGE_CEILING): string[] {
    const out: string[] = [];
    let rest = String(text || '').trim();
    const floor = Math.floor(ceiling * 0.4);

    while (rest.length > ceiling) {
        const window = rest.slice(0, ceiling);
        let cut = -1;
        for (let i = window.length - 1; i >= floor; i--) {
            if (SOFT_BREAKS.includes(window[i]!)) { cut = i + 1; break; }
        }
        if (cut < 0 && lang !== 'zh') {
            const space = window.lastIndexOf(' ');
            if (space >= floor) cut = space;
        }
        if (cut < 1) cut = ceiling;
        out.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out.filter(Boolean);
}

/**
 * One text unit as utterance-sized pieces.
 *
 * Sentences come from `newscastEngine.sentences`, which is the only sentence
 * splitter on this platform that is right in all three scripts -- Arabic uses
 * `؟` and rarely `.`, and Chinese puts NO WHITESPACE after `。`, so the obvious
 * `/[.!?]\s/` returns one enormous sentence for either of them and every budget
 * downstream silently stops applying (working rule 40). A second copy of that
 * logic here would be a second place for it to be wrong.
 *
 * Sentences are packed up to {@link SPEECH_BUDGET} and a sentence is never cut
 * to meet it; only one that exceeds {@link PASSAGE_CEILING} on its own is cut,
 * by {@link splitLong}.
 */
export function chunk(text: string, lang: ReaderLang,
                      budget = SPEECH_BUDGET): string[] {
    const clean = String(text || '').trim();
    if (!clean) return [];

    const parts = sentences(clean);
    // `sentences` drops anything one character long, and returns a single
    // buffer for a string with no terminator at all -- so a unit that survives
    // `plain()` but has no sentence structure (a heading, a table cell, a list
    // item) has to fall back to itself rather than vanishing. A passage that
    // silently disappears is a paragraph the voice skips over, which reads as
    // the reader having lost its place.
    const units = parts.length ? parts : [clean];

    const out: string[] = [];
    let buffer = '';
    const flush = () => { if (buffer.trim()) out.push(buffer.trim()); buffer = ''; };

    for (const unit of units) {
        if (unit.length > PASSAGE_CEILING) {
            flush();
            out.push(...splitLong(unit, lang));
            continue;
        }
        if (!buffer) buffer = unit;
        else if (buffer.length + 1 + unit.length <= budget) buffer += ' ' + unit;
        else { flush(); buffer = unit; }
    }
    flush();
    return out;
}

/* ------------------------------------------------------------------ *
 * Tables
 * ------------------------------------------------------------------ */

/**
 * A table as sentences, one per row, each cell attached to its column.
 *
 * `Rolling update. Downtime: none. Rollback: one command.`
 *
 * The first cell LEADS the sentence rather than being read as
 * "Strategy: rolling update", because on nearly every table in this material
 * the first column is the row's own subject -- a feature, a command, a
 * comparison axis -- and naming it twice is how a spoken table becomes twice as
 * long as it needs to be.
 *
 * An empty cell is skipped rather than read as its heading with nothing after
 * it: "Notes." followed by a pause reads as the voice having lost its place. A
 * table with no header row (legal, rare) is read as plain comma-separated
 * cells, because there is nothing to attribute them to and inventing column
 * names would be worse than the ambiguity.
 */
export function tableSpeech(block: TableBlock): string[] {
    const head = block.head.map(h => plain(h).trim());
    const labelled = head.some(Boolean);
    const out: string[] = [];
    for (const row of block.rows) {
        const cells = row.map(c => plain(c).trim());
        if (!cells.some(Boolean)) continue;
        if (!labelled) {
            out.push(withStop(cells.filter(Boolean).join(', ')));
            continue;
        }
        const pairs: string[] = [];
        for (let i = 1; i < cells.length; i++) {
            const value = cells[i];
            if (!value) continue;
            const label = head[i] || '';
            pairs.push(label ? `${label}: ${value}` : value);
        }
        const sentence = [cells[0] || '', ...pairs].filter(Boolean).join('. ');
        if (sentence.trim()) out.push(withStop(sentence));
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * Building a plan
 * ------------------------------------------------------------------ */

/** One unit of written text, before it is chunked. */
interface Unit { text: string; lang: ReaderLang }

function unitsOf(source: LessonBlock[], fallback: ReaderLang,
                 counters: { skippedCode: number }): Unit[] {
    const units: Unit[] = [];
    for (const block of source) {
        if (block.kind === 'code') { counters.skippedCode++; continue; }

        // THE LANGUAGE IS DETECTED PER BLOCK, not per passage and not per list
        // item. Per passage, a chunk boundary inside one paragraph could flip
        // the voice mid-thought; per item, a two-word entry like "OSI model"
        // inside an Arabic list detects as English and one line of the list is
        // read by a different person. A block is the smallest unit that
        // reliably carries enough text to judge.
        let written: string;
        if (block.kind === 'table') {
            written = [...block.head, ...block.rows.flat()].join(' ');
        } else if (block.kind === 'list') {
            written = block.items.join(' ');
        } else {
            written = block.text;
        }
        const lang = detectLang(written, fallback);

        if (block.kind === 'table') {
            for (const row of tableSpeech(block)) units.push({ text: row, lang });
            continue;
        }

        if (block.kind === 'list') {
            block.items.forEach((item, at) => {
                const said = plain(item).trim();
                if (!said) return;
                // An ORDERED list keeps its number, and keeps the number it
                // actually starts at. The console's drafts routinely resume a
                // step list after a code block, so a list starting at 4 is
                // ordinary here -- and a voice that says "one, two, three" over
                // steps four, five and six is telling a student to redo work.
                const prefix = block.ordered ? `${block.start + at}. ` : '';
                units.push({ text: prefix + withStop(said), lang });
            });
            continue;
        }

        const said = plain(block.text).trim();
        if (!said) continue;
        // A heading gets a stop after it, so the voice does not run the heading
        // into the first sentence of the paragraph under it -- which is how a
        // spoken document loses its structure entirely.
        units.push({ text: block.kind === 'heading' ? withStop(said) : said, lang });
    }
    return units;
}

function planFrom(units: Unit[], skippedCode: number): ReadingPlan {
    const passages: Passage[] = [];
    const languages: ReaderLang[] = [];
    let chars = 0;
    for (const unit of units) {
        for (const text of chunk(unit.text, unit.lang)) {
            passages.push({ text, lang: unit.lang });
            chars += text.length;
            if (!languages.includes(unit.lang)) languages.push(unit.lang);
        }
    }
    return { passages, skippedCode, languages, chars };
}

/**
 * A reading plan from already-parsed blocks.
 *
 * Used by the lesson page and the lab brief, which both already hold
 * `LessonBlock[]` -- so the voice reads exactly what is rendered, block for
 * block, rather than re-parsing the source and possibly disagreeing with the
 * screen about where a list ends.
 */
export function planBlocks(source: LessonBlock[] | null | undefined,
                           fallback: ReaderLang = 'en'): ReadingPlan {
    if (!source || !source.length) return emptyPlan();
    const counters = { skippedCode: 0 };
    return planFrom(unitsOf(source, fallback, counters), counters.skippedCode);
}

/**
 * A reading plan from raw text in the platform's five-marker notation.
 *
 * Goes through `lessonContent.blocks()` -- the same parser the lesson page, the
 * lab brief and the console's authoring all use -- rather than treating the
 * string as prose. That is what makes a fenced block in a runbook section or in
 * the Network Simulator's theory get SKIPPED rather than read out as a command,
 * and it is why a markdown table in a DevOps write-up is read as pairs.
 */
export function planText(text: string | null | undefined,
                         fallback: ReaderLang = 'en'): ReadingPlan {
    if (!text || !String(text).trim()) return emptyPlan();
    return planBlocks(blocks(String(text)), fallback);
}

/**
 * A reading plan from several pieces, read in order.
 *
 * For a section whose text is not one field: a lesson's title then its
 * write-up, a netsim lesson's objectives then its theory, a runbook step's
 * heading then its body. Each piece is parsed and language-detected on its own,
 * so an Arabic heading over an English paragraph is read by two voices -- which
 * is exactly what is on the screen.
 */
export function planParts(parts: Array<string | null | undefined>,
                          fallback: ReaderLang = 'en'): ReadingPlan {
    const units: Unit[] = [];
    const counters = { skippedCode: 0 };
    for (const part of parts) {
        if (!part || !String(part).trim()) continue;
        units.push(...unitsOf(blocks(String(part)), fallback, counters));
    }
    return planFrom(units, counters.skippedCode);
}

/* ------------------------------------------------------------------ *
 * Composing a source that is not already prose
 * ------------------------------------------------------------------ */

/**
 * A list of items as numbered lines.
 *
 * For a caller whose source is an ARRAY rather than a document -- a netsim
 * lesson's `objectives`, a lab's task titles. What comes back is in the
 * platform's own notation, so `blocks()` parses it into an ordered list and it
 * then goes through the same numbering, the same stop-insertion and the same
 * per-block language detection as a list somebody typed into a write-up. One
 * code path rather than two.
 *
 * NUMBERED rather than run together, because these are steps and a spoken list
 * with no numbers is a paragraph -- a listener has no other way to know which
 * one they are on, where a reader can see the bullets.
 */
export function numbered(items: readonly string[]): string {
    return items
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .map((item, at) => `${at + 1}. ${item}`)
        .join('\n');
}

/**
 * Term-and-meaning pairs as prose.
 *
 * A `<dl>` read aloud as bare alternating fragments is unattributable in
 * exactly the way a table is: "MAC address, 48-bit hardware address, IP
 * address, logical address you assign" has every fact in it and nothing joining
 * a meaning to its term. So each pair becomes one sentence, and the pairs are
 * separated by a blank line so `blocks()` makes them separate paragraphs and
 * the voice takes a breath between them.
 */
export function definitions(
    pairs: ReadonlyArray<{ term?: string; meaning?: string }>,
): string {
    return pairs
        .map(pair => {
            const term = String(pair?.term || '').trim();
            const meaning = String(pair?.meaning || '').trim();
            if (!term && !meaning) return '';
            if (!meaning) return withStop(term);
            return withStop(term ? `${term}: ${meaning}` : meaning);
        })
        .filter(Boolean)
        .join('\n\n');
}

/* ------------------------------------------------------------------ *
 * Describing a plan
 * ------------------------------------------------------------------ */

/**
 * Roughly how long the whole plan takes to say.
 *
 * Per passage in that passage's OWN language, because the rates differ by
 * nearly a factor of three -- Chinese is ~5 characters a second against
 * English's 14, so an estimate that used one rate for a mixed document would be
 * wrong in one direction or the other by minutes. `estimateDurationMs` is the
 * newscast's, where those rates were measured against real bulletins.
 */
export function estimateMs(plan: ReadingPlan): number {
    return plan.passages.reduce(
        (total, p) => total + estimateDurationMs(p.text, p.lang), 0);
}

/**
 * The language most of this plan is in.
 *
 * By SPOKEN CHARACTERS rather than by passage count, so one long English
 * paragraph is not outvoted by three short Arabic headings above it. What the
 * UI uses to say "read in English" when that is not the language the reader
 * asked for -- the declaration that makes the substitution acceptable.
 */
export function dominantLanguage(plan: ReadingPlan): ReaderLang | null {
    if (!plan.passages.length) return null;
    const totals = new Map<ReaderLang, number>();
    for (const p of plan.passages) {
        totals.set(p.lang, (totals.get(p.lang) || 0) + p.text.length);
    }
    let best: ReaderLang | null = null;
    let most = -1;
    // Iterated in `languages` order rather than the Map's, so the answer does
    // not depend on which language happened to be met first in a tie.
    for (const lang of plan.languages) {
        const total = totals.get(lang) || 0;
        if (total > most) { most = total; best = lang; }
    }
    return best;
}

/** Is there anything at all to say? */
export function hasSpeech(plan: ReadingPlan): boolean {
    return plan.passages.length > 0;
}
