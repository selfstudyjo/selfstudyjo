/**
 * The terminal's own logic: readline, Tab completion, reverse search, and the
 * two editors.
 *
 * A plain module — no Vue, no DOM — on the same precedent as `photoMask.ts`,
 * `drawEngine.ts`, `labCatalogue.ts` and `answerEditing.ts`, and for the same
 * reason: none of it is visible in a screenshot and all of it is exactly the
 * kind of thing that goes subtly wrong. `npm run check:labs` drives it in node.
 *
 * **A console with an `<input>` and an up-arrow is not a terminal.** Nobody who
 * uses a shell types whole paths: they type three letters and press Tab, they
 * press Ctrl+R and type two letters of something from yesterday, they press
 * Ctrl+L to clear, Ctrl+A to get to the start of the line, Ctrl+W to rub out a
 * word and Ctrl+U to start again. Those are not decorations on the way a shell
 * works; for anybody who has one in their muscle memory they ARE the way a
 * shell works, and their absence is why a browser console reads as a toy.
 *
 * Six decisions in here that are not obvious:
 *
 * **Completion is decided here and FETCHED elsewhere.** This module is given a
 * candidate set and answers what to do with it; the console caches that set per
 * directory and re-primes it from every command response. A completion that
 * needed a round trip per keystroke against a replica whose first answer of the
 * day takes twenty seconds is not a completion, it is a pause.
 *
 * **The FIRST word completes against commands and every later word against
 * paths.** `terraform ini<Tab>` wants a subcommand, not a filename, and
 * `cat mai<Tab>` wants `main.tf`. Getting that backwards offers fifty command
 * names where a student wanted the one file in front of them.
 *
 * **A single match inserts a trailing space, a directory a trailing slash.**
 * That is the whole ergonomic difference: with the space, `cd pra<Tab>` then
 * typing is one motion; without it every completion needs a manual space and
 * the feature stops being used.
 *
 * **Several matches insert their common prefix and then LIST.** Inserting the
 * first match would be actively wrong — it silently picks one of five files —
 * and listing without inserting the prefix makes Tab feel like it did nothing.
 *
 * **Reverse search walks BACKWARDS through history and keeps its position**, so
 * pressing Ctrl+R twice reaches the second-most-recent match rather than
 * re-finding the first. Without the cursor it is a filter, not a search.
 *
 * **The editors are modal in the vi case and not in the nano case**, because
 * that is what they are. A `vi` that accepted typing straight into the buffer
 * would teach a student the opposite of the one thing vi is famous for.
 */

/* ------------------------------------------------------------------------- */
/* Completion                                                                */
/* ------------------------------------------------------------------------- */

export interface CompletionSource {
    /** The command names this console will accept, shell builtins included. */
    commands: string[];
    /** Directory names in the current directory, without a trailing slash. */
    dirs: string[];
    /** File names in the current directory. */
    files: string[];
    /** Every path in the workspace, for completing `a/b/c`. */
    paths?: string[];
}

export interface CompletionResult {
    /** The line as it should now read. Unchanged when nothing could be added. */
    line: string;
    /** Where the caret should sit. */
    caret: number;
    /** The candidates to print under the prompt, empty when there is one. */
    listing: string[];
}

export const EMPTY_SOURCE: CompletionSource = {
    commands: [], dirs: [], files: [], paths: [],
};

/** The word the caret is inside, and where it starts. */
export function wordAt(line: string, caret: number): { word: string; start: number } {
    const text = String(line ?? '');
    const at = Math.max(0, Math.min(caret, text.length));
    let start = at;
    while (start > 0 && !' \t|;&<>'.includes(text[start - 1])) start -= 1;
    return { word: text.slice(start, at), start };
}

/** Is the caret in the FIRST word of its command? */
export function atCommandWord(line: string, caret: number): boolean {
    const { start } = wordAt(line, caret);
    const before = String(line ?? '').slice(0, start);
    // A pipe, a `;` or a `&&` starts a new command, so the word after one is a
    // command word too — `docker ps | gre<Tab>` should offer `grep`.
    return /(^|[|;&])\s*$/.test(before);
}

function longestCommonPrefix(values: string[]): string {
    if (values.length === 0) return '';
    let prefix = values[0];
    for (const value of values.slice(1)) {
        let index = 0;
        while (index < prefix.length && index < value.length
               && prefix[index] === value[index]) index += 1;
        prefix = prefix.slice(0, index);
        if (!prefix) break;
    }
    return prefix;
}

/**
 * What Tab should do to this line.
 *
 * Deliberately total: it always returns a line and a caret, so the caller never
 * has to decide what "no completion" means. Nothing to add leaves the line
 * exactly as it was and returns the candidates to print — which is what a shell
 * does, and it is how a student discovers there were five of them.
 */
export function completeLine(line: string, caret: number,
                             source: CompletionSource): CompletionResult {
    const text = String(line ?? '');
    const position = Math.max(0, Math.min(caret, text.length));
    const { word, start } = wordAt(text, position);
    const unchanged: CompletionResult = { line: text, caret: position, listing: [] };

    let candidates: string[];
    let suffixOf: (value: string) => string;

    if (atCommandWord(text, position)) {
        candidates = [...new Set(source.commands || [])].sort();
        suffixOf = () => ' ';
    } else {
        // A path with a directory in it completes against the whole workspace;
        // a bare word completes against this directory only. Without the first
        // half, `cat t/inn<Tab>` can never work at all.
        const cut = word.lastIndexOf('/');
        if (cut >= 0) {
            const head = word.slice(0, cut + 1);
            const all = source.paths || [];
            const dirs = new Set<string>();
            for (const path of all) {
                const parts = path.split('/');
                for (let index = 1; index < parts.length; index += 1) {
                    dirs.add(`${parts.slice(0, index).join('/')}/`);
                }
            }
            candidates = [...new Set([...all, ...dirs])]
                .filter(path => path.startsWith(head))
                .sort();
            suffixOf = (value: string) => (value.endsWith('/') ? '' : ' ');
        } else {
            const dirs = (source.dirs || []).map(name => `${name}/`);
            candidates = [...new Set([...dirs, ...(source.files || [])])].sort();
            suffixOf = (value: string) => (value.endsWith('/') ? '' : ' ');
        }
    }

    const hits = candidates.filter(value => value.startsWith(word));
    if (hits.length === 0) return unchanged;

    if (hits.length === 1) {
        const value = hits[0] + suffixOf(hits[0]);
        const next = text.slice(0, start) + value + text.slice(position);
        return { line: next, caret: start + value.length, listing: [] };
    }

    const prefix = longestCommonPrefix(hits);
    if (prefix.length > word.length) {
        const next = text.slice(0, start) + prefix + text.slice(position);
        return { line: next, caret: start + prefix.length, listing: hits };
    }
    return { line: text, caret: position, listing: hits };
}

/* ------------------------------------------------------------------------- */
/* Reverse history search (Ctrl+R)                                           */
/* ------------------------------------------------------------------------- */

export interface SearchState {
    /** What has been typed into the search, never the line being edited. */
    query: string;
    /** How many matches back we are. 0 is the most recent. */
    offset: number;
}

export interface SearchHit {
    /** The matching command, or '' when nothing matches. */
    match: string;
    /** How many matches there are in total, for the `(2/7)` counter. */
    total: number;
    /** Which one is shown, 1-based, or 0 when nothing matches. */
    index: number;
}

/**
 * The nth-most-recent history entry containing `query`.
 *
 * Newest first and de-duplicated, because a shell's history is full of the same
 * command run six times and a search that walked all six would need six presses
 * to reach the previous one. Case-insensitive, like bash's default.
 */
export function searchHistory(history: string[], state: SearchState): SearchHit {
    const query = String(state.query ?? '').toLowerCase();
    const seen = new Set<string>();
    const matches: string[] = [];
    for (let index = (history || []).length - 1; index >= 0; index -= 1) {
        const entry = String(history[index] ?? '');
        if (!entry || seen.has(entry)) continue;
        seen.add(entry);
        if (!query || entry.toLowerCase().includes(query)) matches.push(entry);
    }
    if (matches.length === 0) return { match: '', total: 0, index: 0 };
    const offset = Math.max(0, Math.min(state.offset, matches.length - 1));
    return { match: matches[offset], total: matches.length, index: offset + 1 };
}

/* ------------------------------------------------------------------------- */
/* Readline (the editing keys)                                               */
/* ------------------------------------------------------------------------- */

export interface LineEdit {
    line: string;
    caret: number;
    /** The kill ring, so Ctrl+K then Ctrl+Y works. */
    yank: string;
}

export type ReadlineKey =
    | 'home' | 'end' | 'kill-to-end' | 'kill-to-start' | 'kill-word'
    | 'kill-word-forward' | 'yank' | 'word-left' | 'word-right'
    | 'transpose' | 'upper-word' | 'lower-word' | 'delete-char';

/**
 * One readline key against the line being edited.
 *
 * Every one of these is in the fingers of anybody who uses a shell, and every
 * one of them does something ELSE in a browser text input if it is not handled:
 * Ctrl+A selects the page, Ctrl+W closes the tab, Ctrl+L focuses the address
 * bar. So the console has to claim them, and claiming a key without
 * implementing it is worse than leaving it alone.
 */
export function applyReadline(key: ReadlineKey, edit: LineEdit): LineEdit {
    const line = String(edit.line ?? '');
    const caret = Math.max(0, Math.min(edit.caret, line.length));
    const yank = String(edit.yank ?? '');
    const before = line.slice(0, caret);
    const after = line.slice(caret);

    const wordStart = () => {
        let index = caret;
        while (index > 0 && /\s/.test(line[index - 1])) index -= 1;
        while (index > 0 && !/\s/.test(line[index - 1])) index -= 1;
        return index;
    };
    const wordEnd = () => {
        let index = caret;
        while (index < line.length && /\s/.test(line[index])) index += 1;
        while (index < line.length && !/\s/.test(line[index])) index += 1;
        return index;
    };

    switch (key) {
        case 'home':
            return { line, caret: 0, yank };
        case 'end':
            return { line, caret: line.length, yank };
        case 'kill-to-end':
            return { line: before, caret, yank: after || yank };
        case 'kill-to-start':
            return { line: after, caret: 0, yank: before || yank };
        case 'kill-word': {
            const start = wordStart();
            return { line: line.slice(0, start) + after, caret: start,
                     yank: line.slice(start, caret) || yank };
        }
        case 'kill-word-forward': {
            const end = wordEnd();
            return { line: before + line.slice(end), caret,
                     yank: line.slice(caret, end) || yank };
        }
        case 'yank':
            return { line: before + yank + after, caret: caret + yank.length, yank };
        case 'word-left':
            return { line, caret: wordStart(), yank };
        case 'word-right':
            return { line, caret: wordEnd(), yank };
        case 'delete-char':
            return { line: before + after.slice(1), caret, yank };
        case 'transpose': {
            if (caret < 2) return { line, caret, yank };
            const next = line.slice(0, caret - 2) + line[caret - 1]
                + line[caret - 2] + after;
            return { line: next, caret, yank };
        }
        case 'upper-word':
        case 'lower-word': {
            const end = wordEnd();
            const chunk = line.slice(caret, end);
            const changed = key === 'upper-word'
                ? chunk.toUpperCase() : chunk.toLowerCase();
            return { line: before + changed + line.slice(end), caret: end, yank };
        }
        default:
            return { line, caret, yank };
    }
}

/**
 * `!!` and `!n` — history expansion, which is the one shell feature students
 * reach for by name and which the backend cannot do because it never sees the
 * previous line.
 *
 * Returns the expanded line, or the line unchanged when there is nothing to
 * expand. `!!` with an empty history is left alone rather than becoming an
 * empty command: a shell reports `!!: event not found`, and running nothing at
 * all reads as the console having swallowed the line.
 */
export function expandHistory(line: string, history: string[]): string {
    const text = String(line ?? '');
    const entries = (history || []).filter(Boolean);
    if (!entries.length) return text;
    if (text.trim() === '!!') return entries[entries.length - 1];
    const numbered = text.trim().match(/^!(\d+)$/);
    if (numbered) {
        const index = Number(numbered[1]) - 1;
        return entries[index] ?? text;
    }
    const prefixed = text.trim().match(/^!([^\s!]+)$/);
    if (prefixed) {
        for (let index = entries.length - 1; index >= 0; index -= 1) {
            if (entries[index].startsWith(prefixed[1])) return entries[index];
        }
    }
    return text;
}

/* The editors (nano, vi) and the pager live in termEditor.ts: they are full-
   screen programs drawn by LabTermScreen.vue, not a mode of this line editor. */
