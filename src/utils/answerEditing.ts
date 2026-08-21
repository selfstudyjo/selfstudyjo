/**
 * Editing a spoken answer while it is being spoken.
 *
 * A non-native speaker restarts sentences. Whisper transcribes the restart
 * faithfully, so the answer that reaches the report is the false start plus the
 * correction plus the word "sorry" in the middle of it -- and the coach then
 * marks the candidate down for rambling. Before this module the only remedy was
 * to submit the answer and live with it.
 *
 * Three ways to fix a sentence, and they are deliberately different mechanisms
 * because they are used at different moments:
 *
 *   1. TYPE. The transcript is an ordinary editable field. Nothing here has to
 *      run for that to work -- but everything here has to survive it, which is
 *      why every function takes the CURRENT text as an argument rather than
 *      keeping a copy. A module holding its own buffer would silently discard
 *      whatever the candidate typed the moment the next chunk arrived.
 *
 *   2. SAY A COMMAND. "sorry" removes the last comma-separated part; "sorry
 *      sorry" removes two; "sorry sorry ignore" removes three. Counting a RUN
 *      of command words rather than having one command per action is what makes
 *      it usable while talking: a speaker who has already said "sorry" and
 *      realises the mistake goes back further simply says it again.
 *
 *   3. SELECT AND REPLACE. Highlight the wrong part, press the button, keep
 *      talking: the selection is deleted and a caret is left in its place, so
 *      the next words land there instead of at the end.
 *
 * Plain module -- no Vue, no DOM, no network -- for the same reason
 * `interviewSetup.ts`, `linkify.ts` and `newscastEngine.ts` are. Every property
 * that matters here is an invariant over arbitrary speech, and none of them is
 * visible by running one interview once:
 *
 *   * a command NEVER empties an answer that had more than one part in it --
 *     the whole point is to fix a clause, and a candidate who loses a
 *     two-minute answer to one misheard word will not use the feature twice;
 *   * the words spoken BEFORE the command survive it, and the words spoken
 *     after it are kept -- "...and we scaled it, sorry, I scaled it" must not
 *     lose "I scaled it";
 *   * inserting at a caret leaves the caret after what was inserted, so a
 *     replacement dictated in three chunks arrives in order rather than
 *     backwards.
 *
 * Verified by `npm run check:answeredit`.
 */

// ============ COMMANDS ============

/**
 * Multi-word commands, matched before single words and longest first.
 *
 * They exist because the natural spoken form of most of these is two words, and
 * the second word is one nobody would want treated as a command on its own:
 * "that" is in every other sentence of a real answer.
 */
export const COMMAND_PHRASES: readonly string[] = [
    'let me try again',
    'let me start again',
    'let me rephrase that',
    'let me rephrase',
    'let me restart',
    'scratch that',
    'ignore that',
    'forget that',
    'cancel that',
    'strike that',
    'delete that',
    'remove that',
    'no sorry',
];

/**
 * Single words that mean "take the last part back".
 *
 * Deliberately short. Every word here is one a candidate could conceivably say
 * inside a real answer -- "ignore" turns up in "the parser ignores whitespace" --
 * so the list is confined to words whose ordinary use in the middle of an
 * interview answer is rare enough to be worth the trade, and the whole
 * mechanism has an off switch in the room. Words like "delete" and "remove" are
 * NOT here for exactly that reason: they are ordinary technical vocabulary, and
 * they are reachable as "delete that" instead.
 */
export const COMMAND_WORDS: readonly string[] = [
    'sorry',
    'oops',
    'scratch',
    'ignore',
    'correction',
    'undo',
];

/**
 * The most parts one run of commands can remove.
 *
 * A cap rather than a hard limit on intent: eight parts is well over a minute of
 * speech, and a run longer than that is far more likely to be a transcription
 * artefact -- Whisper repeating a word it half-heard -- than somebody genuinely
 * asking to delete their whole answer. Clearing everything is what the field's
 * own Clear button is for, where it is deliberate and undoable by not pressing
 * it.
 */
export const MAX_VOICE_UNDO_SEGMENTS = 8;

/** Where a spoken answer is allowed to be cut. Commas first, hence the name. */
const SEGMENT_DELIMITERS = /[,.;:!?\n—–؛،؟]/;

// ============ STATE ============

/**
 * The answer as it stands, and where the next spoken words go.
 *
 * `caret` is null in the normal case, meaning "the end". It is a number only
 * after the candidate has selected a passage and asked to replace it, and it
 * moves along as each chunk lands so a replacement dictated over several
 * seconds arrives in the order it was said.
 */
export interface AnswerState {
    text: string;
    caret: number | null;
    /**
     * Where the gap the candidate is dictating into STARTED.
     *
     * Set alongside the caret by {@link replaceSelection}, and it exists for one
     * case that is otherwise badly wrong: having highlighted three words and
     * dictated two new ones into the gap, saying "sorry" must take back the two
     * they just said -- not the whole clause in front of the gap, which they
     * never touched and which is very often the entire first half of the answer.
     *
     * The words before the gap have their own parts and their own commas, and a
     * correction spoken INTO a gap knows nothing about them. Without a floor,
     * "I led the platform group" with a gap after "the" is one part as far as
     * the segmenter is concerned, and one "sorry" deletes all of it.
     */
    anchor?: number | null;
}

export function emptyAnswer(): AnswerState {
    return { text: '', caret: null, anchor: null };
}

/** What one transcribed chunk was found to contain. */
export interface ParsedChunk {
    /** Speech before the command run. Kept -- it is part of the answer. */
    before: string;
    /** Speech after the command run. The correction the candidate is making. */
    after: string;
    /** How many parts to take back. 0 when the chunk holds no command. */
    commands: number;
}

// ============ TEXT HELPERS ============

function collapse(value: string): string {
    return value.replace(/[ \t]+/g, ' ').trim();
}

/**
 * Two fragments of speech, joined the way a person would write them.
 *
 * A space between them, unless the right-hand side opens with punctuation that
 * closes the left -- Whisper emits a leading ", and" often enough that not
 * handling it leaves a space before every comma in a long answer.
 */
export function joinSpeech(left: string, right: string): string {
    const a = left.replace(/\s+$/, '');
    const b = right.replace(/^\s+/, '');
    if (!a) return b;
    if (!b) return a;
    if (/^[,.;:!?)\]}’'،؛؟]/.test(b)) return a + b;
    return `${a} ${b}`;
}

/**
 * Where each part of `text` begins.
 *
 * A part starts at the beginning and after every run of delimiters and the
 * whitespace that follows. Runs are collapsed on purpose: "wait... no" is one
 * boundary, not three, and a candidate saying "sorry" after it expects to lose
 * one clause rather than to be thrown back to the start of the answer.
 */
export function segmentStarts(text: string): number[] {
    const starts: number[] = [0];
    let i = 0;
    while (i < text.length) {
        if (SEGMENT_DELIMITERS.test(text[i])) {
            while (i < text.length && SEGMENT_DELIMITERS.test(text[i])) i++;
            while (i < text.length && /\s/.test(text[i])) i++;
            if (i < text.length) starts.push(i);
            continue;
        }
        i++;
    }
    return starts;
}

/**
 * `text` with its last `count` parts removed.
 *
 * Empty trailing parts are not counted -- an answer ending "…the cluster, " has
 * a zero-length part after the comma, and counting it would make the first
 * "sorry" of every sentence do nothing at all, which reads as the feature being
 * broken rather than as an off-by-one.
 */
export function removeLastSegments(text: string, count: number): string {
    const n = Math.min(Math.max(0, Math.round(Number(count) || 0)), MAX_VOICE_UNDO_SEGMENTS);
    if (n <= 0 || !text) return text;
    const starts = segmentStarts(text).filter(start => text.slice(start).trim().length > 0);
    if (!starts.length) return '';
    const cutAt = starts.length >= n ? starts[starts.length - n] : 0;
    // The delimiter that ENDED the previous part goes too, or an answer trimmed
    // back to "I owned the migration," is read aloud by the report with a comma
    // dangling off the end of it.
    return text.slice(0, cutAt).replace(/[\s,;:—–،؛]+$/, '');
}

// ============ PARSING A SPOKEN CHUNK ============

interface Token {
    /** The word, lowercased and stripped of punctuation. */
    word: string;
    start: number;
    end: number;
}

function tokenise(chunk: string): Token[] {
    const tokens: Token[] = [];
    const re = /[\p{L}\p{N}']+/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk)) !== null) {
        tokens.push({ word: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
    }
    return tokens;
}

const PHRASES_BY_LENGTH = [...COMMAND_PHRASES]
    .map(phrase => phrase.split(' '))
    .sort((a, b) => b.length - a.length);

/**
 * One transcribed chunk, split around the LAST run of edit commands in it.
 *
 * The last run rather than the first, because a chunk can legitimately contain
 * a correction of a correction -- "sorry, I mean the second one, sorry, the
 * third" -- and the candidate's intent is always the most recent one. Speech
 * before the run is still part of the answer and is kept; the commands
 * themselves never reach the transcript.
 */
export function parseSpokenChunk(chunk: string, enabled = true): ParsedChunk {
    const text = String(chunk ?? '');
    if (!enabled || !text.trim()) {
        return { before: collapse(text), after: '', commands: 0 };
    }

    const tokens = tokenise(text);
    /** For each token index: how many tokens this command spans, or 0. */
    const spans = new Array(tokens.length).fill(0);
    for (let i = 0; i < tokens.length; i++) {
        if (spans[i]) continue;
        let matched = 0;
        for (const phrase of PHRASES_BY_LENGTH) {
            if (i + phrase.length > tokens.length) continue;
            let ok = true;
            for (let k = 0; k < phrase.length; k++) {
                if (tokens[i + k].word !== phrase[k]) { ok = false; break; }
            }
            if (ok) { matched = phrase.length; break; }
        }
        if (!matched && COMMAND_WORDS.includes(tokens[i].word)) matched = 1;
        if (matched) {
            spans[i] = matched;
            // The tokens a phrase consumed are part of it, not commands of
            // their own -- "scratch that" must count once, not twice.
            for (let k = 1; k < matched; k++) spans[i + k] = -1;
            i += matched - 1;
        }
    }

    // The last maximal run of commands, walking backwards.
    let runEndToken = -1;
    for (let i = tokens.length - 1; i >= 0; i--) {
        if (spans[i] > 0 || spans[i] === -1) { runEndToken = i; break; }
    }
    if (runEndToken < 0) return { before: collapse(text), after: '', commands: 0 };

    let runStartToken = runEndToken;
    let commands = 0;
    while (runStartToken >= 0 && (spans[runStartToken] > 0 || spans[runStartToken] === -1)) {
        if (spans[runStartToken] > 0) commands++;
        runStartToken--;
    }
    runStartToken++;

    const before = collapse(text.slice(0, tokens[runStartToken].start))
        // The comma the candidate paused on before saying "sorry" belongs to the
        // part being deleted, not to the part being kept.
        .replace(/[\s,;:—–،؛]+$/, '');
    const after = collapse(text.slice(tokens[runEndToken].end))
        .replace(/^[\s,;:.!?—–،؛؟]+/, '');

    return { before, after, commands: Math.min(commands, MAX_VOICE_UNDO_SEGMENTS) };
}

// ============ APPLYING IT ============

/**
 * `insertion` placed into `state`, at the caret if there is one.
 *
 * The caret ends up AFTER what was inserted, which is the whole reason it is a
 * number rather than a flag: a replacement dictated as three chunks has to
 * arrive in the order it was spoken, and a caret that stayed put would build
 * the sentence backwards.
 */
export function insertSpeech(state: AnswerState, insertion: string): AnswerState {
    const words = collapse(insertion);
    if (!words) return state;

    if (state.caret === null) {
        return { text: joinSpeech(state.text, words), caret: null, anchor: null };
    }

    const at = Math.max(0, Math.min(state.caret, state.text.length));
    const head = state.text.slice(0, at);
    const tail = state.text.slice(at);
    const withHead = joinSpeech(head, words);
    // Keep exactly one space against the tail, and none at all when the tail
    // opens with punctuation -- otherwise every dictated replacement leaves a
    // gap before the comma that followed the passage it replaced.
    const joined = joinSpeech(withHead, tail);
    return { text: joined, caret: withHead.length, anchor: state.anchor ?? null };
}

/**
 * One transcribed chunk applied to the answer.
 *
 * The order is not arbitrary: the words spoken BEFORE the command are inserted
 * first and are then themselves eligible to be removed by it. "we owned the
 * rollout, sorry" has to lose "we owned the rollout" -- deleting first and
 * inserting second would delete the clause before it and keep the mistake.
 */
export function applyTranscript(
    state: AnswerState,
    chunk: string,
    options: { voiceEditing?: boolean } = {},
): AnswerState {
    const parsed = parseSpokenChunk(chunk, options.voiceEditing !== false);
    let next = insertSpeech(state, parsed.before);

    if (parsed.commands > 0) next = undoSegments(next, parsed.commands);

    return insertSpeech(next, parsed.after);
}

/**
 * The last `count` parts taken back, wherever the candidate is writing.
 *
 * Exported because there are two ways to ask for it and they must not diverge:
 * saying "sorry", and the Undo button next to the transcript for anybody who
 * would rather not talk to their laptop. A second copy of this in the component
 * is a second copy of the anchor rule, and the anchor rule is the one that
 * decides whether an undo can eat the half of the answer the candidate never
 * touched.
 */
export function undoSegments(state: AnswerState, count: number): AnswerState {
    if (state.caret === null) {
        return { text: removeLastSegments(state.text, count), caret: null, anchor: null };
    }
    // Only back as far as the gap. Everything in front of it is text the
    // candidate did not touch, and deleting it is the failure this whole
    // feature exists to prevent, arriving through the one door built to
    // prevent it.
    const caret = Math.max(0, Math.min(state.caret, state.text.length));
    const floor = Math.max(0, Math.min(state.anchor ?? 0, caret));
    const kept = state.text.slice(0, floor);
    const head = kept + removeLastSegments(state.text.slice(floor, caret), count);
    return {
        text: head + state.text.slice(caret),
        caret: head.length,
        anchor: Math.min(floor, head.length),
    };
}

/**
 * The selected passage removed, with the caret left where it was.
 *
 * A no-op for an empty or reversed selection rather than an error: the button
 * that calls this is next to the transcript and gets pressed with nothing
 * selected constantly, and a dialog for that would be worse than nothing
 * happening.
 */
export function replaceSelection(state: AnswerState, start: number, end: number): AnswerState {
    const from = Math.max(0, Math.min(Math.round(Number(start) || 0), state.text.length));
    const to = Math.max(0, Math.min(Math.round(Number(end) || 0), state.text.length));
    if (to <= from) return state;
    const head = state.text.slice(0, from).replace(/\s+$/, '');
    const tail = state.text.slice(to).replace(/^\s+/, '');
    return {
        text: head + (head && tail ? ' ' : '') + tail,
        caret: head.length,
        anchor: head.length,
    };
}

/** Back to dictating at the end of the answer. */
export function resumeAtEnd(state: AnswerState): AnswerState {
    return { text: state.text, caret: null, anchor: null };
}

/** What the candidate typed by hand, adopted without losing the caret. */
export function setTypedText(state: AnswerState, text: string): AnswerState {
    const value = String(text ?? '');
    // A caret past the end of what is now there would insert at a position that
    // no longer exists; a caret inside text the candidate has since rewritten is
    // meaningless anyway, so an edit that shortens the answer resets it.
    const caret = state.caret === null ? null
        : (state.caret <= value.length ? state.caret : null);
    return {
        text: value,
        caret,
        anchor: caret === null ? null : Math.min(state.anchor ?? 0, caret),
    };
}

/**
 * A one-line description of where the next words will land.
 *
 * Shown in the room, because a caret that is invisible is a caret that makes
 * the next sentence appear in what looks like the wrong place.
 */
export function caretHint(state: AnswerState): string {
    if (state.caret === null) return '';
    const before = state.text.slice(0, state.caret).replace(/\s+$/, '');
    const tail = before.split(/\s+/).slice(-4).join(' ');
    return tail ? `…${tail} ▌` : 'at the start ▌';
}

/** Roughly how long this answer takes to say, for the per-question timer. */
export function wordCount(text: string): number {
    const words = collapse(text);
    return words ? words.split(/\s+/).length : 0;
}
