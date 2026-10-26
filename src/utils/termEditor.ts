/**
 * nano, vi and a pager, as they behave in a real terminal - the plain half.
 *
 * The lab console has no pseudo-terminal, so a curses program cannot run; what
 * runs instead is THIS: the same screen, the same keys and the same messages,
 * drawn as a character grid inside the console pane by `LabTermScreen.vue`.
 * The point is transfer - a student who learns ^O / ^X here, or `i`, Esc,
 * `:wq` and `dd`, can use nano and vim on any Ubuntu machine.
 *
 * Pure: no Vue, no DOM. Every key goes through `nanoKey` / `viKey` /
 * `pagerKey`, which answer the next state and, when the file has to be written
 * or the program has to end, an `action` for the component to carry out.
 * `npm run check:labs` drives them.
 */

export interface Buffer {
    lines: string[];
    row: number;
    col: number;
    /** First visible line and column. */
    top: number;
    left: number;
}

export interface EditorRequest {
    program: string;
    path: string;
    name: string;
    content: string;
    existing?: boolean;
    /** An absolute path outside the workspace (`/etc/hosts`, `/tmp/x`). */
    system?: string;
    readonly?: boolean;
    sudo?: boolean;
}

export interface KeyInput {
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
}

export type EditorAction =
    | { kind: 'none' }
    | { kind: 'save'; name: string; then: 'stay' | 'exit' }
    | { kind: 'exit'; note: string };

export interface Snapshot { lines: string[]; row: number; col: number }

interface Common {
    request: EditorRequest;
    name: string;
    buf: Buffer;
    dirty: boolean;
    status: string;
    undo: Snapshot[];
    redo: Snapshot[];
    rows: number;
    cols: number;
}

export interface NanoPrompt {
    kind: 'save-changes' | 'filename' | 'search' | 'replace' | 'replace-with'
        | 'replace-confirm' | 'goto' | 'help';
    label: string;
    text: string;
    /** For replace: what is being replaced and by what. */
    find?: string;
    with?: string;
    exitAfter?: boolean;
}

export interface NanoState extends Common {
    program: 'nano';
    prompt: NanoPrompt | null;
    cut: string[];
    cutting: boolean;
    lastSearch: string;
}

export type ViMode = 'normal' | 'insert' | 'replace' | 'command' | 'search'
    | 'visual' | 'visual-line';

export interface ViState extends Common {
    program: 'vi';
    mode: ViMode;
    cmdline: string;
    count: string;
    pending: string;
    register: { text: string[]; linewise: boolean };
    number: boolean;
    lastSearch: { pattern: string; forward: boolean };
    anchor: { row: number; col: number } | null;
    lastChange: KeyInput[];
    recording: KeyInput[] | null;
}

export type TermEditor = NanoState | ViState;

export const TAB = 8;

/* ─────────────────────────── shared buffer helpers ─────────────────────────── */

function splitLines(content: string): string[] {
    const text = String(content ?? '').replace(/\r\n/g, '\n');
    const body = text.endsWith('\n') ? text.slice(0, -1) : text;
    return body === '' && !text ? [''] : body.split('\n');
}

export function joinLines(lines: string[]): string {
    const body = lines.join('\n');
    return lines.length === 1 && lines[0] === '' ? '' : body + '\n';
}

function clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
}

function snap(buf: Buffer): Snapshot {
    return { lines: buf.lines.slice(), row: buf.row, col: buf.col };
}

function remember<T extends Common>(state: T): T {
    const undo = state.undo.concat([snap(state.buf)]).slice(-200);
    return { ...state, undo, redo: [] };
}

function withBuf<T extends Common>(state: T, buf: Partial<Buffer>): T {
    return { ...state, buf: follow({ ...state.buf, ...buf }, state.rows, state.cols) };
}

/** The visual column of `col` on a line, with tabs expanded. */
export function visualCol(line: string, col: number): number {
    let v = 0;
    for (let i = 0; i < col && i < line.length; i += 1) {
        v = line[i] === '\t' ? v + TAB - (v % TAB) : v + 1;
    }
    return v;
}

export function expandTabs(line: string): string {
    let out = '';
    for (const ch of line) {
        if (ch === '\t') out += ' '.repeat(TAB - (out.length % TAB));
        else out += ch;
    }
    return out;
}

/** Scroll so the cursor is visible in a `rows` x `cols` text area. */
function follow(buf: Buffer, rows: number, cols: number): Buffer {
    const height = Math.max(1, rows);
    const width = Math.max(10, cols);
    let { top, left } = buf;
    if (buf.row < top) top = buf.row;
    if (buf.row >= top + height) top = buf.row - height + 1;
    const vcol = visualCol(buf.lines[buf.row] || '', buf.col);
    if (vcol < left) left = Math.max(0, vcol - Math.floor(width / 4));
    if (vcol >= left + width - 1) left = vcol - width + Math.floor(width / 4) + 1;
    return { ...buf, top: Math.max(0, top), left: Math.max(0, left) };
}

function lineCount(text: string): number {
    return splitLines(text).length;
}

/* ─────────────────────────────────── nano ─────────────────────────────────── */

export const NANO_VERSION = 'GNU nano 6.2';

export function openNano(request: EditorRequest, rows = 20, cols = 80): NanoState {
    const lines = splitLines(request.content);
    const name = request.name || request.path || request.system || '';
    let status: string;
    if (!request.existing && !request.content) status = '[ New File ]';
    else if (request.readonly) status = `[ File '${name}' is unwritable ]`;
    else status = `[ Read ${lines.length} line${lines.length === 1 ? '' : 's'} ]`;
    return {
        program: 'nano', request, name, dirty: false, status, undo: [], redo: [],
        rows, cols, prompt: null, cut: [], cutting: false, lastSearch: '',
        buf: { lines, row: 0, col: 0, top: 0, left: 0 },
    };
}

/** The two shortcut rows at the bottom of nano, for whatever is open. */
export function nanoShortcuts(state: NanoState): [string, string][][] {
    const p = state.prompt;
    if (p?.kind === 'save-changes') {
        return [[['Y', 'Yes']], [['N', 'No'], ['^C', 'Cancel']]];
    }
    if (p?.kind === 'replace-confirm') {
        return [[['Y', 'Yes'], ['A', 'All']], [['N', 'No'], ['^C', 'Cancel']]];
    }
    if (p?.kind === 'filename') {
        return [[['^G', 'Help'], ['M-D', 'DOS Format'], ['M-A', 'Append']],
                [['^C', 'Cancel'], ['M-M', 'Mac Format'], ['M-P', 'Prepend']]];
    }
    if (p?.kind === 'help') {
        return [[['^X', 'Close']], []];
    }
    if (p) {
        return [[['^G', 'Help'], ['M-C', 'Case Sens'], ['M-R', 'Reg.exp.']],
                [['^C', 'Cancel'], ['M-B', 'Backwards'], ['^R', 'Replace']]];
    }
    return [
        [['^G', 'Help'], ['^O', 'Write Out'], ['^W', 'Where Is'], ['^K', 'Cut'],
         ['^T', 'Execute'], ['^C', 'Location'], ['M-U', 'Undo']],
        [['^X', 'Exit'], ['^R', 'Read File'], ['^\\', 'Replace'], ['^U', 'Paste'],
         ['^J', 'Justify'], ['^/', 'Go To Line'], ['M-E', 'Redo']],
    ];
}

export const NANO_HELP = [
    'Main nano help text',
    '',
    ' The nano editor is designed to emulate the functionality and ease-of-use of',
    ' the UW Pico text editor. There are four main sections of the editor. The',
    ' top line shows the program version, the current filename being edited, and',
    ' whether or not the file has been modified. Next is the main editor window',
    ' showing the file being edited. The status line is the third line from the',
    ' bottom and shows important messages. The bottom two lines show the most',
    ' commonly used shortcuts in the editor.',
    '',
    ' Shortcuts are written as follows: Control-key sequences are notated with a',
    ' \'^\' and can be entered either by using the Ctrl key or pressing the Esc key',
    ' twice. Meta-key sequences are notated with \'M-\' and can be entered using',
    ' the Alt key.',
    '',
    '^G   Display this help text            ^X   Close the current buffer / Exit',
    '^O   Write the current buffer to disk  ^S   Save file without prompting',
    '^W   Search forward for a string       M-W  Repeat the last search',
    '^\\   Replace a string                  ^K   Cut current line into cutbuffer',
    '^U   Paste the contents of cutbuffer   ^C   Display the cursor position',
    '^/   Go to line and column number      M-U  Undo the last operation',
    'M-E  Redo the last undone operation    ^A   Go to beginning of current line',
    '^E   Go to end of current line         ^Y   Go one screenful up',
    '^V   Go one screenful down             M-\\  Go to the first line of the file',
    'M-/  Go to the last line of the file   Tab  Insert a tab at the cursor',
];

function nanoInsert(state: NanoState, text: string): NanoState {
    if (!text) return state;
    let s = remember(state);
    const { lines, row, col } = s.buf;
    const line = lines[row] ?? '';
    const pieces = text.replace(/\r\n/g, '\n').split('\n');
    const before = line.slice(0, col);
    const after = line.slice(col);
    const next = lines.slice();
    if (pieces.length === 1) {
        next[row] = before + pieces[0] + after;
        s = withBuf(s, { lines: next, col: col + pieces[0].length });
    } else {
        const middle = pieces.slice(1, -1);
        const last = pieces[pieces.length - 1];
        next.splice(row, 1, before + pieces[0], ...middle, last + after);
        s = withBuf(s, { lines: next, row: row + pieces.length - 1, col: last.length });
    }
    return { ...s, dirty: true, cutting: false, status: '' };
}

function nanoMove(state: NanoState, row: number, col: number | 'keep'): NanoState {
    const lines = state.buf.lines;
    const r = clamp(row, 0, lines.length - 1);
    const c = col === 'keep' ? Math.min(state.buf.col, lines[r].length) : clamp(col, 0, lines[r].length);
    return { ...withBuf(state, { row: r, col: c }), cutting: false };
}

function location(state: NanoState): string {
    const { lines, row, col } = state.buf;
    const total = lines.length;
    const lineLen = (lines[row] || '').length;
    let chars = 0;
    let before = 0;
    lines.forEach((line, i) => {
        if (i < row) before += line.length + 1;
        chars += line.length + 1;
    });
    before += col;
    const pct = (a: number, b: number) => Math.round((100 * a) / Math.max(1, b));
    return `[ line ${row + 1}/${total} (${pct(row + 1, total)}%), col ${col + 1}/${lineLen + 1} `
        + `(${pct(col + 1, lineLen + 1)}%), char ${before}/${chars} (${pct(before, chars)}%) ]`;
}

function nanoFind(state: NanoState, needle: string): NanoState {
    if (!needle) return { ...state, status: '[ Cancelled ]' };
    const { lines, row, col } = state.buf;
    for (let step = 0; step <= lines.length; step += 1) {
        const r = (row + step) % lines.length;
        const from = step === 0 ? col + 1 : 0;
        const at = lines[r].indexOf(needle, from);
        if (at >= 0) {
            const wrapped = step > 0 && r <= row;
            return { ...nanoMove(state, r, at), lastSearch: needle,
                     status: wrapped ? '[ Search Wrapped ]' : '' };
        }
    }
    if (lines[row].indexOf(needle) === col) {
        return { ...state, lastSearch: needle, status: '[ This is the only occurrence ]' };
    }
    return { ...state, lastSearch: needle, status: `[ "${needle}" not found ]` };
}

function nanoReplaceAll(state: NanoState, find: string, by: string): NanoState {
    let count = 0;
    const lines = state.buf.lines.map(line => {
        if (!find) return line;
        const parts = line.split(find);
        count += parts.length - 1;
        return parts.join(by);
    });
    if (!count) return { ...state, prompt: null, status: `[ "${find}" not found ]` };
    const s = remember(state);
    return { ...withBuf(s, { lines, col: Math.min(s.buf.col, lines[s.buf.row].length) }),
             prompt: null, dirty: true,
             status: `[ Replaced ${count} occurrence${count === 1 ? '' : 's'} ]` };
}

function nanoReplaceHere(state: NanoState, find: string, by: string): NanoState {
    const { lines, row, col } = state.buf;
    const line = lines[row];
    if (line.substr(col, find.length) !== find) return state;
    const s = remember(state);
    const next = lines.slice();
    next[row] = line.slice(0, col) + by + line.slice(col + find.length);
    return { ...withBuf(s, { lines: next, col: col + by.length }), dirty: true };
}

function promptKey(state: NanoState, input: KeyInput): { state: NanoState; action: EditorAction } {
    const p = state.prompt as NanoPrompt;
    const key = input.key;
    const none: EditorAction = { kind: 'none' };
    const cancel = () => ({ state: { ...state, prompt: null, status: '[ Cancelled ]' }, action: none });
    if (input.ctrl && key.toLowerCase() === 'c') return cancel();
    if (key === 'Escape') return cancel();
    if (p.kind === 'help') {
        if (input.ctrl && (key.toLowerCase() === 'x' || key.toLowerCase() === 'g')) {
            return { state: { ...state, prompt: null, status: '' }, action: none };
        }
        if (key === 'q' || key === 'Q') return { state: { ...state, prompt: null }, action: none };
        return { state, action: none };
    }
    if (p.kind === 'save-changes') {
        const k = key.toLowerCase();
        if (k === 'y') {
            return { state: { ...state, prompt: { kind: 'filename', label: 'File Name to Write: ',
                                                  text: state.name, exitAfter: true } }, action: none };
        }
        if (k === 'n') return { state, action: { kind: 'exit', note: '' } };
        return { state, action: none };
    }
    if (p.kind === 'replace-confirm') {
        const k = key.toLowerCase();
        const find = p.find || '';
        const by = p.with || '';
        if (k === 'a') return { state: nanoReplaceAll(state, find, by), action: none };
        if (k === 'y' || k === 'n') {
            let next = k === 'y' ? nanoReplaceHere(state, find, by) : state;
            const found = nanoFind({ ...next, status: '' }, find);
            if (found.status.includes('not found') || found.status.includes('only occurrence')) {
                return { state: { ...next, prompt: null, status: k === 'y' ? '[ Replaced 1 occurrence ]' : '' }, action: none };
            }
            next = { ...found, prompt: p };
            return { state: next, action: none };
        }
        return { state, action: none };
    }
    if (key === 'Enter') {
        const text = p.text;
        if (p.kind === 'filename') {
            if (!text) return cancel();
            return { state: { ...state, prompt: null, name: text },
                     action: { kind: 'save', name: text, then: p.exitAfter ? 'exit' : 'stay' } };
        }
        if (p.kind === 'search') return { state: { ...nanoFind({ ...state, prompt: null }, text || state.lastSearch) }, action: none };
        if (p.kind === 'replace') {
            return { state: { ...state, prompt: { kind: 'replace-with', label: 'Replace with: ', text: '', find: text || state.lastSearch } }, action: none };
        }
        if (p.kind === 'replace-with') {
            const find = p.find || '';
            const found = nanoFind({ ...state, prompt: null, buf: { ...state.buf, col: Math.max(0, state.buf.col - 1) } }, find);
            if (found.status.includes('not found')) return { state: { ...found, prompt: null }, action: none };
            return { state: { ...found, prompt: { kind: 'replace-confirm', label: 'Replace this instance?', text: '', find, with: text } }, action: none };
        }
        if (p.kind === 'goto') {
            const [ln, cn] = text.split(/[ ,]+/).map(n => parseInt(n, 10));
            if (Number.isNaN(ln)) return { state: { ...state, prompt: null, status: '[ Invalid line or column number ]' }, action: none };
            const total = state.buf.lines.length;
            const row = ln < 0 ? total + ln : ln - 1;
            return { state: { ...nanoMove({ ...state, prompt: null }, row, Number.isNaN(cn) ? 0 : cn - 1), status: '' }, action: none };
        }
    }
    if (key === 'Backspace') return { state: { ...state, prompt: { ...p, text: p.text.slice(0, -1) } }, action: none };
    if (key.length === 1 && !input.ctrl && !input.alt) {
        return { state: { ...state, prompt: { ...p, text: p.text + key } }, action: none };
    }
    return { state, action: none };
}

export function nanoKey(state: NanoState, input: KeyInput): { state: NanoState; action: EditorAction } {
    const none: EditorAction = { kind: 'none' };
    if (state.prompt) return promptKey(state, input);
    const key = input.key;
    const k = key.length === 1 ? key.toLowerCase() : key;
    const { lines, row, col } = state.buf;
    const page = Math.max(1, state.rows - 2);

    if (input.ctrl) {
        switch (k) {
        case 'x':
            if (state.dirty) {
                return { state: { ...state, prompt: { kind: 'save-changes', label: 'Save modified buffer? ', text: '' } }, action: none };
            }
            return { state, action: { kind: 'exit', note: '' } };
        case 'o':
            return { state: { ...state, prompt: { kind: 'filename', label: 'File Name to Write: ', text: state.name } }, action: none };
        case 's':
            return { state, action: { kind: 'save', name: state.name, then: 'stay' } };
        case 'g':
            return { state: { ...state, prompt: { kind: 'help', label: '', text: '' } }, action: none };
        case 'w':
            return { state: { ...state, prompt: { kind: 'search', label: state.lastSearch ? `Search [${state.lastSearch}]: ` : 'Search: ', text: '' } }, action: none };
        case '\\':
            return { state: { ...state, prompt: { kind: 'replace', label: state.lastSearch ? `Search (to replace) [${state.lastSearch}]: ` : 'Search (to replace): ', text: '' } }, action: none };
        case '/': case '_':
            return { state: { ...state, prompt: { kind: 'goto', label: 'Enter line number, column number: ', text: '' } }, action: none };
        case 'c':
            return { state: { ...state, status: location(state) }, action: none };
        case 'a':
            return { state: nanoMove(state, row, 0), action: none };
        case 'e':
            return { state: nanoMove(state, row, lines[row].length), action: none };
        case 'y':
            return { state: nanoMove(state, row - page, 'keep'), action: none };
        case 'v':
            return { state: nanoMove(state, row + page, 'keep'), action: none };
        case 'k': {
            let s = remember(state);
            const cut = state.cutting ? state.cut.concat([lines[row]]) : [lines[row]];
            const next = lines.slice();
            if (next.length === 1) next[0] = '';
            else next.splice(row, 1);
            s = withBuf(s, { lines: next, row: Math.min(row, next.length - 1), col: 0 });
            return { state: { ...s, cut, cutting: true, dirty: true, status: '' }, action: none };
        }
        case 'u': {
            if (!state.cut.length) return { state: { ...state, status: '[ Cutbuffer is empty ]' }, action: none };
            let s = remember(state);
            const next = lines.slice();
            next.splice(row, 0, ...state.cut);
            s = withBuf(s, { lines: next, row: row + state.cut.length, col: 0 });
            return { state: { ...s, dirty: true, cutting: false, status: '' }, action: none };
        }
        case 't':
            return { state: { ...state, status: '[ Executing a command is not available in this lab ]' }, action: none };
        case 'r':
            return { state: { ...state, status: '[ Reading a file into the buffer is not available in this lab ]' }, action: none };
        case 'j':
            return { state: { ...state, status: '[ Justified paragraph ]' }, action: none };
        case 'home':
            return { state: nanoMove(state, 0, 0), action: none };
        case 'end':
            return { state: nanoMove(state, lines.length - 1, lines[lines.length - 1].length), action: none };
        default:
            return { state, action: none };
        }
    }
    if (input.alt) {
        if (k === 'u' && state.undo.length) {
            const last = state.undo[state.undo.length - 1];
            const s = { ...state, undo: state.undo.slice(0, -1), redo: state.redo.concat([snap(state.buf)]) };
            return { state: { ...withBuf(s, { lines: last.lines, row: last.row, col: last.col }), dirty: true, status: '[ Undid action ]' }, action: none };
        }
        if (k === 'u') return { state: { ...state, status: '[ Nothing to undo ]' }, action: none };
        if (k === 'e' && state.redo.length) {
            const last = state.redo[state.redo.length - 1];
            const s = { ...state, redo: state.redo.slice(0, -1), undo: state.undo.concat([snap(state.buf)]) };
            return { state: { ...withBuf(s, { lines: last.lines, row: last.row, col: last.col }), dirty: true, status: '[ Redid action ]' }, action: none };
        }
        if (k === 'e') return { state: { ...state, status: '[ Nothing to redo ]' }, action: none };
        if (k === 'w') return { state: nanoFind(state, state.lastSearch), action: none };
        if (k === '\\') return { state: nanoMove(state, 0, 0), action: none };
        if (k === '/') return { state: nanoMove(state, lines.length - 1, lines[lines.length - 1].length), action: none };
        return { state, action: none };
    }
    switch (key) {
    case 'ArrowLeft':
        if (col > 0) return { state: nanoMove(state, row, col - 1), action: none };
        if (row > 0) return { state: nanoMove(state, row - 1, lines[row - 1].length), action: none };
        return { state, action: none };
    case 'ArrowRight':
        if (col < lines[row].length) return { state: nanoMove(state, row, col + 1), action: none };
        if (row < lines.length - 1) return { state: nanoMove(state, row + 1, 0), action: none };
        return { state, action: none };
    case 'ArrowUp': return { state: nanoMove(state, row - 1, 'keep'), action: none };
    case 'ArrowDown': return { state: nanoMove(state, row + 1, 'keep'), action: none };
    case 'Home': return { state: nanoMove(state, row, 0), action: none };
    case 'End': return { state: nanoMove(state, row, lines[row].length), action: none };
    case 'PageUp': return { state: nanoMove(state, row - page, 'keep'), action: none };
    case 'PageDown': return { state: nanoMove(state, row + page, 'keep'), action: none };
    case 'Enter': return { state: nanoInsert(state, '\n'), action: none };
    case 'Tab': return { state: nanoInsert(state, '\t'), action: none };
    case 'Backspace': {
        if (col === 0 && row === 0) return { state, action: none };
        let s = remember(state);
        const next = lines.slice();
        if (col > 0) {
            next[row] = lines[row].slice(0, col - 1) + lines[row].slice(col);
            s = withBuf(s, { lines: next, col: col - 1 });
        } else {
            const prevLen = lines[row - 1].length;
            next.splice(row - 1, 2, lines[row - 1] + lines[row]);
            s = withBuf(s, { lines: next, row: row - 1, col: prevLen });
        }
        return { state: { ...s, dirty: true, cutting: false, status: '' }, action: none };
    }
    case 'Delete': {
        if (col === lines[row].length && row === lines.length - 1) return { state, action: none };
        let s = remember(state);
        const next = lines.slice();
        if (col < lines[row].length) next[row] = lines[row].slice(0, col) + lines[row].slice(col + 1);
        else next.splice(row, 2, lines[row] + lines[row + 1]);
        s = withBuf(s, { lines: next });
        return { state: { ...s, dirty: true, status: '' }, action: none };
    }
    default:
        if (key.length === 1) return { state: nanoInsert(state, key), action: none };
        return { state, action: none };
    }
}

export function nanoPaste(state: NanoState, text: string): NanoState {
    return state.prompt ? { ...state, prompt: { ...state.prompt, text: state.prompt.text + text.replace(/\n/g, ' ') } }
        : nanoInsert(state, text);
}

/** After the component tried to write: the message nano prints. */
export function nanoSaved(state: NanoState, ok: boolean, error = ''): NanoState {
    if (!ok) {
        return { ...state, status: `[ Error writing ${state.name}: ${error || 'Permission denied'} ]` };
    }
    const n = state.buf.lines.length;
    return { ...state, dirty: false, status: `[ Wrote ${n} line${n === 1 ? '' : 's'} ]` };
}

/* ──────────────────────────────────── vi ──────────────────────────────────── */

export function openVi(request: EditorRequest, rows = 20, cols = 80): ViState {
    const lines = splitLines(request.content);
    const name = request.name || request.path || request.system || '';
    const bytes = request.content.length;
    let status: string;
    if (!request.existing && !request.content) status = `"${name}" [New]`;
    else status = `"${name}"${request.readonly ? ' [readonly]' : ''} ${lines.length}L, ${bytes}B`;
    return {
        program: 'vi', request, name, dirty: false, status, undo: [], redo: [], rows, cols,
        mode: 'normal', cmdline: '', count: '', pending: '',
        register: { text: [], linewise: false }, number: false,
        lastSearch: { pattern: '', forward: true }, anchor: null, lastChange: [],
        recording: null, buf: { lines, row: 0, col: 0, top: 0, left: 0 },
    };
}

function viClampNormal(state: ViState): ViState {
    const { lines, row } = state.buf;
    const max = Math.max(0, lines[row].length - 1);
    return state.buf.col > max ? withBuf(state, { col: max }) : state;
}

function isWord(ch: string): boolean {
    return /[A-Za-z0-9_]/.test(ch);
}

function wordForward(lines: string[], row: number, col: number, end = false): [number, number] {
    let r = row;
    let c = col;
    const kind = (ch: string | undefined) => (ch === undefined || /\s/.test(ch) ? 0 : isWord(ch) ? 1 : 2);
    if (end) {
        c += 1;
        while (r < lines.length) {
            while (c < lines[r].length && kind(lines[r][c]) === 0) c += 1;
            if (c < lines[r].length) break;
            r += 1; c = 0;
        }
        if (r >= lines.length) return [lines.length - 1, Math.max(0, lines[lines.length - 1].length - 1)];
        const k = kind(lines[r][c]);
        while (c + 1 < lines[r].length && kind(lines[r][c + 1]) === k) c += 1;
        return [r, c];
    }
    const start = kind(lines[r][c]);
    while (c < lines[r].length && kind(lines[r][c]) === start && start !== 0) c += 1;
    for (;;) {
        while (c < lines[r].length && kind(lines[r][c]) === 0) c += 1;
        if (c < lines[r].length) return [r, c];
        if (r >= lines.length - 1) return [r, Math.max(0, lines[r].length - 1)];
        r += 1; c = 0;
        if (lines[r].length === 0) return [r, 0];
    }
}

function wordBack(lines: string[], row: number, col: number): [number, number] {
    let r = row;
    let c = col - 1;
    const kind = (ch: string | undefined) => (ch === undefined || /\s/.test(ch) ? 0 : isWord(ch) ? 1 : 2);
    for (;;) {
        while (c >= 0 && kind(lines[r][c]) === 0) c -= 1;
        if (c >= 0) break;
        if (r === 0) return [0, 0];
        r -= 1; c = lines[r].length - 1;
        if (lines[r].length === 0) return [r, 0];
    }
    const k = kind(lines[r][c]);
    while (c > 0 && kind(lines[r][c - 1]) === k) c -= 1;
    return [r, c];
}

type Motion = { row: number; col: number; linewise: boolean; inclusive: boolean } | null;

function viMotion(state: ViState, key: string, count: number, ctrl: boolean): Motion {
    const { lines, row, col } = state.buf;
    const last = lines.length - 1;
    const half = Math.max(1, Math.floor(state.rows / 2));
    if (ctrl) {
        if (key === 'f') return { row: clamp(row + state.rows * count, 0, last), col: 0, linewise: true, inclusive: false };
        if (key === 'b') return { row: clamp(row - state.rows * count, 0, last), col: 0, linewise: true, inclusive: false };
        if (key === 'd') return { row: clamp(row + half, 0, last), col, linewise: true, inclusive: false };
        if (key === 'u') return { row: clamp(row - half, 0, last), col, linewise: true, inclusive: false };
        return null;
    }
    switch (key) {
    case 'h': case 'ArrowLeft': case 'Backspace':
        return { row, col: Math.max(0, col - count), linewise: false, inclusive: false };
    case 'l': case 'ArrowRight': case ' ':
        return { row, col: Math.min(Math.max(0, lines[row].length - 1), col + count), linewise: false, inclusive: false };
    case 'j': case 'ArrowDown': case 'Enter': case '+':
        return { row: clamp(row + count, 0, last), col: key === 'Enter' || key === '+' ? 0 : col, linewise: true, inclusive: false };
    case 'k': case 'ArrowUp': case '-':
        return { row: clamp(row - count, 0, last), col: key === '-' ? 0 : col, linewise: true, inclusive: false };
    case '0': case 'Home':
        return { row, col: 0, linewise: false, inclusive: false };
    case '^': {
        const m = lines[row].match(/^\s*/);
        return { row, col: m ? Math.min(m[0].length, Math.max(0, lines[row].length - 1)) : 0, linewise: false, inclusive: false };
    }
    case '$': case 'End':
        return { row: clamp(row + count - 1, 0, last), col: Math.max(0, lines[clamp(row + count - 1, 0, last)].length - 1), linewise: false, inclusive: true };
    case 'w': case 'W': {
        let at: [number, number] = [row, col];
        for (let i = 0; i < count; i += 1) at = wordForward(lines, at[0], at[1]);
        return { row: at[0], col: at[1], linewise: false, inclusive: false };
    }
    case 'e': case 'E': {
        let at: [number, number] = [row, col];
        for (let i = 0; i < count; i += 1) at = wordForward(lines, at[0], at[1], true);
        return { row: at[0], col: at[1], linewise: false, inclusive: true };
    }
    case 'b': case 'B': {
        let at: [number, number] = [row, col];
        for (let i = 0; i < count; i += 1) at = wordBack(lines, at[0], at[1]);
        return { row: at[0], col: at[1], linewise: false, inclusive: false };
    }
    case 'G':
        return { row: state.count ? clamp(count - 1, 0, last) : last, col: 0, linewise: true, inclusive: false };
    case 'H': return { row: state.buf.top, col: 0, linewise: true, inclusive: false };
    case 'L': return { row: Math.min(last, state.buf.top + state.rows - 1), col: 0, linewise: true, inclusive: false };
    case 'M': return { row: Math.min(last, state.buf.top + Math.floor(state.rows / 2)), col: 0, linewise: true, inclusive: false };
    default:
        return null;
    }
}

function viYank(lines: string[], from: Snapshot | { row: number; col: number }, to: Motion): { text: string[]; linewise: boolean } {
    if (!to) return { text: [], linewise: false };
    const r1 = Math.min(from.row, to.row);
    const r2 = Math.max(from.row, to.row);
    if (to.linewise) return { text: lines.slice(r1, r2 + 1), linewise: true };
    let [a, b] = from.row < to.row || (from.row === to.row && from.col <= to.col)
        ? [{ row: from.row, col: from.col }, { row: to.row, col: to.col }]
        : [{ row: to.row, col: to.col }, { row: from.row, col: from.col }];
    const endCol = b.col + (to.inclusive ? 1 : 0);
    if (a.row === b.row) return { text: [lines[a.row].slice(a.col, endCol)], linewise: false };
    const out = [lines[a.row].slice(a.col)];
    for (let r = a.row + 1; r < b.row; r += 1) out.push(lines[r]);
    out.push(lines[b.row].slice(0, endCol));
    void a; void b;
    return { text: out, linewise: false };
}

function viDelete(state: ViState, to: Motion): ViState {
    if (!to) return state;
    const { lines, row, col } = state.buf;
    const yanked = viYank(lines, { row, col }, to);
    let s = remember(state);
    const next = lines.slice();
    if (to.linewise) {
        const r1 = Math.min(row, to.row);
        const r2 = Math.max(row, to.row);
        next.splice(r1, r2 - r1 + 1);
        if (!next.length) next.push('');
        const r = Math.min(r1, next.length - 1);
        const indent = (next[r].match(/^\s*/) || [''])[0].length;
        s = withBuf(s, { lines: next, row: r, col: Math.min(indent, Math.max(0, next[r].length - 1)) });
        const n = r2 - r1 + 1;
        return { ...s, dirty: true, register: yanked, status: n >= 3 ? `${n} fewer lines` : '' };
    }
    const forward = to.row > row || (to.row === row && to.col >= col);
    const a = forward ? { row, col } : { row: to.row, col: to.col };
    const b = forward ? { row: to.row, col: to.col + (to.inclusive ? 1 : 0) } : { row, col };
    const merged = next[a.row].slice(0, a.col) + next[b.row].slice(b.col);
    next.splice(a.row, b.row - a.row + 1, merged);
    s = withBuf(s, { lines: next, row: a.row, col: a.col });
    return { ...viClampNormal(s), dirty: true, register: yanked, status: '' };
}

function viPut(state: ViState, before: boolean, count: number): ViState {
    const reg = state.register;
    if (!reg.text.length) return { ...state, status: 'E353: Nothing in register "' };
    const { lines, row, col } = state.buf;
    let s = remember(state);
    const next = lines.slice();
    if (reg.linewise) {
        const block: string[] = [];
        for (let i = 0; i < count; i += 1) block.push(...reg.text);
        const at = before ? row : row + 1;
        next.splice(at, 0, ...block);
        s = withBuf(s, { lines: next, row: at, col: 0 });
        return { ...s, dirty: true, status: block.length >= 3 ? `${block.length} more lines` : '' };
    }
    const text = reg.text.join('\n').repeat(count);
    const at = before ? col : Math.min(lines[row].length, col + 1);
    const line = lines[row];
    const pieces = text.split('\n');
    if (pieces.length === 1) {
        next[row] = line.slice(0, at) + text + line.slice(at);
        s = withBuf(s, { lines: next, col: at + text.length - 1 });
    } else {
        next.splice(row, 1, line.slice(0, at) + pieces[0], ...pieces.slice(1, -1), pieces[pieces.length - 1] + line.slice(at));
        s = withBuf(s, { lines: next, row, col: at });
    }
    return { ...s, dirty: true, status: '' };
}

function viSearch(state: ViState, pattern: string, forward: boolean): ViState {
    if (!pattern) return state;
    let re: RegExp;
    try { re = new RegExp(pattern); } catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); }
    const { lines, row, col } = state.buf;
    const n = lines.length;
    for (let step = 0; step <= n; step += 1) {
        const r = forward ? (row + step) % n : (row - step + n) % n;
        const line = lines[r];
        if (forward) {
            const from = step === 0 ? col + 1 : 0;
            const sub = line.slice(from);
            const m = sub.search(re);
            if (m >= 0) {
                const wrapped = step > 0 && r <= row;
                return { ...withBuf(state, { row: r, col: from + m }), lastSearch: { pattern, forward },
                         status: wrapped ? 'search hit BOTTOM, continuing at TOP' : `/${pattern}` };
            }
        } else {
            let best = -1;
            const limit = step === 0 ? col : line.length + 1;
            const g = new RegExp(re.source, 'g');
            let m: RegExpExecArray | null;
            while ((m = g.exec(line)) && m.index < limit) {
                best = m.index;
                if (m[0] === '') g.lastIndex += 1;
            }
            if (best >= 0) {
                const wrapped = step > 0 && r >= row;
                return { ...withBuf(state, { row: r, col: best }), lastSearch: { pattern, forward },
                         status: wrapped ? 'search hit TOP, continuing at BOTTOM' : `?${pattern}` };
            }
        }
    }
    return { ...state, lastSearch: { pattern, forward }, status: `E486: Pattern not found: ${pattern}` };
}

function viCommandLine(state: ViState, text: string): { state: ViState; action: EditorAction } {
    const none: EditorAction = { kind: 'none' };
    const s0: ViState = { ...state, mode: 'normal', cmdline: '' };
    const cmd = text.trim();
    if (!cmd) return { state: s0, action: none };
    if (/^\d+$/.test(cmd)) {
        return { state: viClampNormal(withBuf(s0, { row: clamp(parseInt(cmd, 10) - 1, 0, s0.buf.lines.length - 1), col: 0 })), action: none };
    }
    if (cmd === '$') return { state: withBuf(s0, { row: s0.buf.lines.length - 1, col: 0 }), action: none };
    const sub = cmd.match(/^(%|\d+(?:,\d+)?)?s(.)(.*?)\2(.*?)(?:\2([gi]*))?$/);
    if (sub) {
        const [, range, , pat, rep, flags = ''] = sub;
        let re: RegExp;
        try { re = new RegExp(pat, (flags.includes('g') ? 'g' : '') + (flags.includes('i') ? 'i' : '')); } catch {
            return { state: { ...s0, status: `E486: Pattern not found: ${pat}` }, action: none };
        }
        const lines = s0.buf.lines.slice();
        let r1 = s0.buf.row;
        let r2 = s0.buf.row;
        if (range === '%') { r1 = 0; r2 = lines.length - 1; } else if (range) {
            const [a, b] = range.split(',').map(n => parseInt(n, 10) - 1);
            r1 = a; r2 = Number.isNaN(b) ? a : b;
        }
        let count = 0;
        let changedLines = 0;
        for (let r = r1; r <= r2 && r < lines.length; r += 1) {
            const before = lines[r];
            const after = before.replace(re, (...m) => { count += 1; return rep.replace(/&/g, m[0]); });
            if (after !== before) { lines[r] = after; changedLines += 1; }
        }
        if (!count) return { state: { ...s0, status: `E486: Pattern not found: ${pat}` }, action: none };
        const s = remember(s0);
        return { state: { ...withBuf(s, { lines }), dirty: true,
                          status: count > 2 || changedLines > 2 ? `${count} substitution${count === 1 ? '' : 's'} on ${changedLines} line${changedLines === 1 ? '' : 's'}` : '' }, action: none };
    }
    const m = cmd.match(/^(wqa|wq|wa|write|w|xit|xa|x|qa|quit|q|edit|e|set|se|nohlsearch|noh|help|h|saveas|sav)(?=!|\s|$)(!?)\s*(.*)$/);
    if (!m) return { state: { ...s0, status: `E492: Not an editor command: ${cmd}` }, action: none };
    const [, verb, bang, arg] = m;
    if (verb === 'set' || verb === 'se') {
        if (/^(nu|number)$/.test(arg)) return { state: { ...s0, number: true }, action: none };
        if (/^(nonu|nonumber)$/.test(arg)) return { state: { ...s0, number: false }, action: none };
        return { state: { ...s0, status: arg ? '' : '--- Options ---' }, action: none };
    }
    if (verb === 'noh' || verb === 'nohlsearch') return { state: s0, action: none };
    if (verb === 'help' || verb === 'h') {
        return { state: { ...s0, status: 'Help: i insert, Esc normal, :w write, :q quit, :wq write+quit, :q! quit without saving, dd delete line, yy copy, p paste, u undo, /text search' }, action: none };
    }
    if (verb === 'e' || verb === 'edit') {
        if (bang) {
            const fresh = openVi(s0.request, s0.rows, s0.cols);
            return { state: { ...fresh, number: s0.number }, action: none };
        }
        if (s0.dirty) return { state: { ...s0, status: 'E37: No write since last change (add ! to override)' }, action: none };
        return { state: s0, action: none };
    }
    const writes = verb.startsWith('w') || verb === 'x' || verb === 'xit' || verb === 'xa' || verb === 'sav' || verb === 'saveas';
    const quits = verb.startsWith('q') || verb === 'wq' || verb === 'x' || verb === 'xit' || verb === 'wqa' || verb === 'xa';
    if (writes) {
        if (s0.request.readonly && !bang) {
            return { state: { ...s0, status: "E45: 'readonly' option is set (add ! to override)" }, action: none };
        }
        const name = arg || s0.name;
        if ((verb === 'x' || verb === 'xit' || verb === 'xa') && !s0.dirty) {
            return { state: s0, action: { kind: 'exit', note: '' } };
        }
        return { state: { ...s0, name }, action: { kind: 'save', name, then: quits ? 'exit' : 'stay' } };
    }
    if (quits) {
        if (s0.dirty && !bang) return { state: { ...s0, status: 'E37: No write since last change (add ! to override)' }, action: none };
        return { state: s0, action: { kind: 'exit', note: '' } };
    }
    return { state: s0, action: none };
}

function enterInsert(state: ViState, how: string): ViState {
    const { lines, row, col } = state.buf;
    let s: ViState = { ...remember(state), mode: 'insert', status: '-- INSERT --', recording: [{ key: how }] };
    switch (how) {
    case 'a': s = withBuf(s, { col: Math.min(lines[row].length, col + (lines[row].length ? 1 : 0)) }); break;
    case 'A': s = withBuf(s, { col: lines[row].length }); break;
    case 'I': s = withBuf(s, { col: (lines[row].match(/^\s*/) || [''])[0].length }); break;
    case 'o': {
        const next = lines.slice();
        const indent = (lines[row].match(/^\s*/) || [''])[0];
        next.splice(row + 1, 0, indent);
        s = withBuf(s, { lines: next, row: row + 1, col: indent.length });
        s = { ...s, dirty: true };
        break;
    }
    case 'O': {
        const next = lines.slice();
        const indent = (lines[row].match(/^\s*/) || [''])[0];
        next.splice(row, 0, indent);
        s = withBuf(s, { lines: next, row, col: indent.length });
        s = { ...s, dirty: true };
        break;
    }
    default: break;
    }
    return s;
}

function insertKey(state: ViState, input: KeyInput): ViState {
    const key = input.key;
    const { lines, row, col } = state.buf;
    const rec = state.recording ? state.recording.concat([input]) : null;
    if (key === 'Escape' || (input.ctrl && (key === '[' || key === 'c'))) {
        const s: ViState = { ...state, mode: 'normal', status: '', lastChange: rec || state.lastChange, recording: null };
        return viClampNormal(withBuf(s, { col: Math.max(0, col - 1) }));
    }
    const next = lines.slice();
    const replacing = state.mode === 'replace';
    if (key === 'Enter') {
        next.splice(row, 1, lines[row].slice(0, col), lines[row].slice(col));
        return { ...withBuf(state, { lines: next, row: row + 1, col: 0 }), dirty: true, recording: rec };
    }
    if (key === 'Backspace') {
        if (col > 0) {
            next[row] = lines[row].slice(0, col - 1) + lines[row].slice(col);
            return { ...withBuf(state, { lines: next, col: col - 1 }), dirty: true, recording: rec };
        }
        if (row > 0) {
            const prevLen = lines[row - 1].length;
            next.splice(row - 1, 2, lines[row - 1] + lines[row]);
            return { ...withBuf(state, { lines: next, row: row - 1, col: prevLen }), dirty: true, recording: rec };
        }
        return state;
    }
    if (key === 'ArrowLeft') return withBuf(state, { col: Math.max(0, col - 1) });
    if (key === 'ArrowRight') return withBuf(state, { col: Math.min(lines[row].length, col + 1) });
    if (key === 'ArrowUp' && row > 0) return withBuf(state, { row: row - 1, col: Math.min(col, lines[row - 1].length) });
    if (key === 'ArrowDown' && row < lines.length - 1) return withBuf(state, { row: row + 1, col: Math.min(col, lines[row + 1].length) });
    if (key === 'Home') return withBuf(state, { col: 0 });
    if (key === 'End') return withBuf(state, { col: lines[row].length });
    const ch = key === 'Tab' ? '\t' : key.length === 1 && !input.ctrl ? key : '';
    if (!ch) return state;
    next[row] = replacing
        ? lines[row].slice(0, col) + ch + lines[row].slice(col + 1)
        : lines[row].slice(0, col) + ch + lines[row].slice(col);
    return { ...withBuf(state, { lines: next, col: col + 1 }), dirty: true, recording: rec };
}

export function viPaste(state: ViState, text: string): ViState {
    if (state.mode === 'command' || state.mode === 'search') {
        return { ...state, cmdline: state.cmdline + text.replace(/\n/g, ' ') };
    }
    let s = state.mode === 'insert' ? state : enterInsert(state, 'i');
    for (const ch of text.replace(/\r\n/g, '\n')) {
        s = insertKey(s, { key: ch === '\n' ? 'Enter' : ch === '\t' ? 'Tab' : ch });
    }
    return state.mode === 'insert' ? s : insertKey(s, { key: 'Escape' });
}

export function viKey(state: ViState, input: KeyInput): { state: ViState; action: EditorAction } {
    const none: EditorAction = { kind: 'none' };
    const key = input.key;
    if (state.mode === 'insert' || state.mode === 'replace') return { state: insertKey(state, input), action: none };

    if (state.mode === 'command' || state.mode === 'search') {
        if (key === 'Escape' || (input.ctrl && key.toLowerCase() === 'c')) return { state: { ...state, mode: 'normal', cmdline: '', status: '' }, action: none };
        if (key === 'Enter') {
            if (state.mode === 'search') {
                const forward = state.cmdline.startsWith('/');
                const pattern = state.cmdline.slice(1) || state.lastSearch.pattern;
                return { state: viSearch({ ...state, mode: 'normal', cmdline: '' }, pattern, forward), action: none };
            }
            return viCommandLine(state, state.cmdline.slice(1));
        }
        if (key === 'Backspace') {
            if (state.cmdline.length <= 1) return { state: { ...state, mode: 'normal', cmdline: '' }, action: none };
            return { state: { ...state, cmdline: state.cmdline.slice(0, -1) }, action: none };
        }
        if (key.length === 1 && !input.ctrl) return { state: { ...state, cmdline: state.cmdline + key }, action: none };
        return { state, action: none };
    }

    const visual = state.mode === 'visual' || state.mode === 'visual-line';
    if (key === 'Escape') {
        return { state: { ...state, mode: 'normal', count: '', pending: '', anchor: null, status: visual ? '' : state.status }, action: none };
    }
    if (/^[1-9]$/.test(key) || (key === '0' && state.count)) {
        if (!input.ctrl) return { state: { ...state, count: state.count + key }, action: none };
    }
    const count = Math.max(1, parseInt(state.count || '1', 10));
    const clear = { count: '', pending: '' };
    const { lines, row, col } = state.buf;

    if (state.pending === 'r') {
        if (key.length !== 1) return { state: { ...state, ...clear }, action: none };
        const s = remember(state);
        const next = lines.slice();
        const end = Math.min(lines[row].length, col + count);
        next[row] = lines[row].slice(0, col) + key.repeat(end - col) + lines[row].slice(end);
        return { state: { ...withBuf(s, { lines: next, col: end - 1 }), ...clear, dirty: true, lastChange: [{ key: 'r' }, input] }, action: none };
    }
    if (state.pending === 'g') {
        if (key === 'g') {
            const target = state.count ? clamp(count - 1, 0, lines.length - 1) : 0;
            return { state: { ...withBuf(state, { row: target, col: 0 }), ...clear }, action: none };
        }
        return { state: { ...state, ...clear }, action: none };
    }
    if (state.pending === 'Z') {
        if (key === 'Z') {
            if (!state.dirty) return { state: { ...state, ...clear }, action: { kind: 'exit', note: '' } };
            return { state: { ...state, ...clear }, action: { kind: 'save', name: state.name, then: 'exit' } };
        }
        if (key === 'Q') return { state: { ...state, ...clear }, action: { kind: 'exit', note: '' } };
        return { state: { ...state, ...clear }, action: none };
    }
    if (state.pending === 'f' || state.pending === 't' || state.pending === 'F' || state.pending === 'T') {
        const forward = state.pending === 'f' || state.pending === 't';
        const line = lines[row];
        const at = forward ? line.indexOf(key, col + 1) : line.lastIndexOf(key, col - 1);
        if (at < 0) return { state: { ...state, ...clear }, action: none };
        const target = state.pending === 't' ? at - 1 : state.pending === 'T' ? at + 1 : at;
        return { state: { ...withBuf(state, { col: target }), ...clear }, action: none };
    }

    // An operator waiting for its motion: d, c, y, >, <.
    if (state.pending && 'dcy<>'.includes(state.pending[0])) {
        const op = state.pending[0];
        let motion: Motion = null;
        if (key === op) {
            motion = { row: clamp(row + count - 1, 0, lines.length - 1), col: 0, linewise: true, inclusive: false };
        } else if (op === 'c' && (key === 'w' || key === 'W')) {
            motion = viMotion(state, 'e', count, false);
        } else if (key === 'g' && state.pending.length === 1) {
            return { state: { ...state, pending: op + 'g' }, action: none };
        } else if (state.pending.length === 2 && key === 'g') {
            motion = { row: 0, col: 0, linewise: true, inclusive: false };
        } else {
            motion = viMotion({ ...state, count: state.count }, key, count, !!input.ctrl);
        }
        if (!motion) return { state: { ...state, ...clear }, action: none };
        const record: KeyInput[] = [{ key: state.pending }, input];
        if (op === 'y') {
            const reg = viYank(lines, { row, col }, motion);
            const n = reg.text.length;
            return { state: { ...state, ...clear, register: reg, status: reg.linewise && n >= 3 ? `${n} lines yanked` : '' }, action: none };
        }
        if (op === '>' || op === '<') {
            const r1 = Math.min(row, motion.row);
            const r2 = Math.max(row, motion.row);
            const s = remember(state);
            const next = lines.slice();
            for (let r = r1; r <= r2; r += 1) {
                next[r] = op === '>' ? (next[r] ? '\t' + next[r] : next[r]) : next[r].replace(/^(\t| {1,8})/, '');
            }
            return { state: { ...withBuf(s, { lines: next }), ...clear, dirty: true, lastChange: record }, action: none };
        }
        let s = viDelete({ ...state, ...clear }, motion);
        if (op === 'c') {
            if (motion.linewise) {
                const next = s.buf.lines.slice();
                next.splice(Math.min(row, motion.row), 0, '');
                s = withBuf(s, { lines: next, row: Math.min(row, motion.row), col: 0 });
            }
            s = { ...s, mode: 'insert', status: '-- INSERT --', recording: record };
            if (!motion.linewise) s = withBuf(s, { col: Math.min(row === s.buf.row ? Math.min(col, motion.col) : s.buf.col, s.buf.lines[s.buf.row].length) });
        } else {
            s = { ...s, lastChange: record };
        }
        return { state: s, action: none };
    }

    if (input.ctrl) {
        const k = key.toLowerCase();
        if (k === 'r') {
            if (!state.redo.length) return { state: { ...state, ...clear, status: 'Already at newest change' }, action: none };
            const last = state.redo[state.redo.length - 1];
            const s = { ...state, redo: state.redo.slice(0, -1), undo: state.undo.concat([snap(state.buf)]) };
            return { state: { ...withBuf(s, { lines: last.lines, row: last.row, col: last.col }), ...clear, dirty: true, status: '1 change; after #' + (s.undo.length) }, action: none };
        }
        if (k === 'g') {
            return { state: { ...state, ...clear, status: `"${state.name}"${state.dirty ? ' [Modified]' : ''} ${lines.length} lines --${Math.round(((row + 1) / lines.length) * 100)}%--` }, action: none };
        }
        const motion = viMotion(state, k, count, true);
        if (motion) return { state: { ...withBuf(state, { row: motion.row, col: motion.col }), ...clear }, action: none };
        return { state: { ...state, ...clear }, action: none };
    }

    if (visual) {
        const anchor = state.anchor || { row, col };
        if (key === 'd' || key === 'x' || key === 'y' || key === 'c' || key === '>' || key === '<') {
            const linewise = state.mode === 'visual-line';
            const motion: Motion = { row: anchor.row, col: anchor.col, linewise, inclusive: true };
            const base: ViState = { ...state, mode: 'normal', anchor: null, ...clear };
            if (key === 'y') {
                const reg = viYank(lines, { row, col }, linewise ? motion : { ...motion, inclusive: true });
                const fixed = linewise ? reg : viYank(lines, row < anchor.row || (row === anchor.row && col < anchor.col) ? { row, col } : anchor,
                    row < anchor.row || (row === anchor.row && col < anchor.col) ? { ...motion } : { row, col, linewise: false, inclusive: true });
                return { state: { ...withBuf(base, { row: Math.min(row, anchor.row), col: linewise ? 0 : Math.min(col, anchor.col) }), register: fixed }, action: none };
            }
            if (key === '>' || key === '<') {
                const r1 = Math.min(row, anchor.row);
                const r2 = Math.max(row, anchor.row);
                const s = remember(base);
                const next = lines.slice();
                for (let r = r1; r <= r2; r += 1) next[r] = key === '>' ? '\t' + next[r] : next[r].replace(/^(\t| {1,8})/, '');
                return { state: { ...withBuf(s, { lines: next }), dirty: true }, action: none };
            }
            let s = viDelete({ ...base, buf: { ...base.buf, row: anchor.row, col: anchor.col } }, { row, col, linewise, inclusive: true });
            if (key === 'c') s = { ...s, mode: 'insert', status: '-- INSERT --' };
            return { state: s, action: none };
        }
        const motion = viMotion(state, key, count, false);
        if (motion) return { state: { ...withBuf(state, { row: motion.row, col: motion.col }), anchor, ...clear }, action: none };
        if (key === 'v' || key === 'V') return { state: { ...state, mode: 'normal', anchor: null, status: '' }, action: none };
        return { state, action: none };
    }

    switch (key) {
    case 'i': case 'a': case 'A': case 'I': case 'o': case 'O':
        return { state: { ...enterInsert({ ...state, ...clear }, key) }, action: none };
    case 'R':
        return { state: { ...remember(state), ...clear, mode: 'replace', status: '-- REPLACE --' }, action: none };
    case 's': {
        const s = viDelete({ ...state, ...clear }, { row, col: Math.min(col + count - 1, Math.max(0, lines[row].length - 1)), linewise: false, inclusive: true });
        return { state: { ...withBuf(s, { col }), mode: 'insert', status: '-- INSERT --' }, action: none };
    }
    case 'S': case 'C': {
        const motion: Motion = key === 'S'
            ? { row, col: 0, linewise: true, inclusive: false }
            : { row, col: Math.max(0, lines[row].length - 1), linewise: false, inclusive: true };
        let s = viDelete({ ...state, ...clear }, motion);
        if (key === 'S') {
            const next = s.buf.lines.slice();
            next.splice(row, 0, '');
            s = withBuf(s, { lines: next, row, col: 0 });
        } else {
            s = withBuf(s, { col: lines[row].length ? col : 0 });
        }
        return { state: { ...s, mode: 'insert', status: '-- INSERT --' }, action: none };
    }
    case 'v': return { state: { ...state, ...clear, mode: 'visual', anchor: { row, col }, status: '-- VISUAL --' }, action: none };
    case 'V': return { state: { ...state, ...clear, mode: 'visual-line', anchor: { row, col }, status: '-- VISUAL LINE --' }, action: none };
    case ':': return { state: { ...state, ...clear, mode: 'command', cmdline: ':' }, action: none };
    case '/': case '?': return { state: { ...state, ...clear, mode: 'search', cmdline: key }, action: none };
    case 'n': case 'N': {
        const forward = key === 'n' ? state.lastSearch.forward : !state.lastSearch.forward;
        if (!state.lastSearch.pattern) return { state: { ...state, ...clear, status: 'E35: No previous regular expression' }, action: none };
        return { state: { ...viSearch({ ...state, ...clear }, state.lastSearch.pattern, forward), lastSearch: state.lastSearch }, action: none };
    }
    case '*': {
        const line = lines[row];
        let a = col;
        let b = col;
        while (a > 0 && isWord(line[a - 1])) a -= 1;
        while (b < line.length && isWord(line[b])) b += 1;
        const word = line.slice(a, b);
        if (!word) return { state, action: none };
        return { state: viSearch({ ...state, ...clear }, `\\b${word}\\b`, true), action: none };
    }
    case 'x': case 'Delete':
        if (!lines[row].length) return { state: { ...state, ...clear }, action: none };
        return { state: { ...viDelete({ ...state, ...clear }, { row, col: Math.min(lines[row].length - 1, col + count - 1), linewise: false, inclusive: true }), lastChange: [input] }, action: none };
    case 'X':
        if (col === 0) return { state: { ...state, ...clear }, action: none };
        return { state: viDelete({ ...state, ...clear }, { row, col: Math.max(0, col - count), linewise: false, inclusive: false }), action: none };
    case 'D':
        return { state: viDelete({ ...state, ...clear }, { row, col: Math.max(0, lines[row].length - 1), linewise: false, inclusive: true }), action: none };
    case 'Y':
        return { state: { ...state, ...clear, register: { text: lines.slice(row, Math.min(lines.length, row + count)), linewise: true } }, action: none };
    case 'p': case 'P':
        return { state: { ...viPut({ ...state, ...clear }, key === 'P', count), lastChange: [input] }, action: none };
    case 'u': {
        if (!state.undo.length) return { state: { ...state, ...clear, status: 'Already at oldest change' }, action: none };
        const last = state.undo[state.undo.length - 1];
        const s = { ...state, undo: state.undo.slice(0, -1), redo: state.redo.concat([snap(state.buf)]) };
        return { state: viClampNormal({ ...withBuf(s, { lines: last.lines, row: last.row, col: last.col }), ...clear, dirty: s.undo.length > 0, status: `1 change; before #${s.undo.length + 1}` }), action: none };
    }
    case 'J': {
        if (row >= lines.length - 1) return { state: { ...state, ...clear }, action: none };
        const s = remember(state);
        const next = lines.slice();
        const joined = next[row].replace(/\s+$/, '') + (next[row + 1].trim() ? ' ' : '') + next[row + 1].replace(/^\s+/, '');
        const at = next[row].replace(/\s+$/, '').length;
        next.splice(row, 2, joined);
        return { state: { ...withBuf(s, { lines: next, col: at }), ...clear, dirty: true }, action: none };
    }
    case '~': {
        const line = lines[row];
        if (!line.length) return { state, action: none };
        const s = remember(state);
        const next = lines.slice();
        const end = Math.min(line.length, col + count);
        const flipped = line.slice(col, end).split('').map(ch => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())).join('');
        next[row] = line.slice(0, col) + flipped + line.slice(end);
        return { state: { ...withBuf(s, { lines: next, col: Math.min(end, line.length - 1) }), ...clear, dirty: true }, action: none };
    }
    case '.': {
        let s: ViState = { ...state, ...clear };
        let action: EditorAction = none;
        for (const k of state.lastChange) {
            const step = viKey(s, k);
            s = step.state;
            action = step.action;
        }
        if (s.mode === 'insert') s = insertKey(s, { key: 'Escape' });
        return { state: { ...s, lastChange: state.lastChange }, action };
    }
    case 'd': case 'c': case 'y': case '>': case '<': case 'g': case 'r': case 'Z':
    case 'f': case 't': case 'F': case 'T':
        return { state: { ...state, pending: key }, action: none };
    default: {
        const motion = viMotion(state, key, count, false);
        if (motion) return { state: viClampNormal({ ...withBuf(state, { row: motion.row, col: motion.col }), ...clear }), action: none };
        return { state: { ...state, ...clear }, action: none };
    }
    }
}

/** After the component tried to write: what vim prints. */
export function viSaved(state: ViState, ok: boolean, error = ''): ViState {
    if (!ok) {
        return { ...state, status: `"${state.name}" E212: Can't open file for writing${error && !/permission/i.test(error) ? ` (${error})` : ''}` };
    }
    const text = joinLines(state.buf.lines);
    return { ...state, dirty: false, status: `"${state.name}" ${state.buf.lines.length}L, ${text.length}B written` };
}

/* ────────────────────────────── shared entry ────────────────────────────── */

export function openTermEditor(request: EditorRequest, rows = 20, cols = 80): TermEditor {
    return request.program === 'vi' ? openVi(request, rows, cols) : openNano(request, rows, cols);
}

export function editorKeyPress(state: TermEditor, input: KeyInput): { state: TermEditor; action: EditorAction } {
    return state.program === 'vi' ? viKey(state, input) : nanoKey(state, input);
}

export function editorPaste(state: TermEditor, text: string): TermEditor {
    return state.program === 'vi' ? viPaste(state, text) : nanoPaste(state, text);
}

export function editorSaved(state: TermEditor, ok: boolean, error = ''): TermEditor {
    return state.program === 'vi' ? viSaved(state, ok, error) : nanoSaved(state, ok, error);
}

export function resize<T extends TermEditor>(state: T, rows: number, cols: number): T {
    return { ...state, rows, cols, buf: follow(state.buf, rows, cols) };
}

export function contentOf(state: TermEditor): string {
    return joinLines(state.buf.lines);
}

/* ─────────────────────────────────── pager ─────────────────────────────────── */

export interface PagerState {
    lines: string[];
    top: number;
    rows: number;
    title: string;
    prompt: string | null;
    search: string;
    status: string;
}

export function openPager(text: string, title: string, rows = 20, search = ''): PagerState {
    const lines = splitLines(text).map(expandTabs);
    const base: PagerState = { lines, top: 0, rows, title, prompt: null, search: '', status: '' };
    return search ? pagerFind(base, search, true) : base;
}

function pagerMax(state: PagerState): number {
    return Math.max(0, state.lines.length - state.rows);
}

function pagerFind(state: PagerState, pattern: string, forward: boolean): PagerState {
    if (!pattern) return state;
    const lower = pattern.toLowerCase();
    const n = state.lines.length;
    for (let i = 1; i <= n; i += 1) {
        const r = forward ? state.top + i : state.top - i;
        if (r < 0 || r >= n) break;
        if (state.lines[r].toLowerCase().includes(lower)) {
            return { ...state, top: Math.min(r, pagerMax(state)), search: pattern, status: '' };
        }
    }
    if (state.lines[state.top]?.toLowerCase().includes(lower)) return { ...state, search: pattern };
    return { ...state, search: pattern, status: 'Pattern not found  (press RETURN)' };
}

export function pagerKey(state: PagerState, input: KeyInput): { state: PagerState; quit: boolean } {
    const key = input.key;
    if (state.prompt !== null) {
        if (key === 'Enter') return { state: pagerFind({ ...state, prompt: null }, state.prompt.slice(1) || state.search, state.prompt[0] === '/'), quit: false };
        if (key === 'Escape' || (input.ctrl && key.toLowerCase() === 'c')) return { state: { ...state, prompt: null }, quit: false };
        if (key === 'Backspace') return { state: { ...state, prompt: state.prompt.length > 1 ? state.prompt.slice(0, -1) : null }, quit: false };
        if (key.length === 1) return { state: { ...state, prompt: state.prompt + key }, quit: false };
        return { state, quit: false };
    }
    const page = Math.max(1, state.rows - 1);
    const move = (top: number) => ({ state: { ...state, top: clamp(top, 0, pagerMax(state)), status: '' }, quit: false });
    if (key === 'q' || key === 'Q' || (input.ctrl && key.toLowerCase() === 'c')) return { state, quit: true };
    if (key === ' ' || key === 'f' || key === 'PageDown' || (input.ctrl && key.toLowerCase() === 'f')) return move(state.top + page);
    if (key === 'b' || key === 'PageUp' || (input.ctrl && key.toLowerCase() === 'b')) return move(state.top - page);
    if (key === 'j' || key === 'ArrowDown' || key === 'Enter' || key === 'e') return move(state.top + 1);
    if (key === 'k' || key === 'ArrowUp' || key === 'y') return move(state.top - 1);
    if (key === 'd') return move(state.top + Math.floor(page / 2));
    if (key === 'u') return move(state.top - Math.floor(page / 2));
    if (key === 'g' || key === '<' || key === 'Home') return move(0);
    if (key === 'G' || key === '>' || key === 'End') return move(pagerMax(state));
    if (key === '/' || key === '?') return { state: { ...state, prompt: key }, quit: false };
    if (key === 'n') return { state: pagerFind(state, state.search, true), quit: false };
    if (key === 'N') return { state: pagerFind(state, state.search, false), quit: false };
    if (key === 'h') return { state: { ...state, status: 'SPACE forward  b back  /pattern search  n next  g top  G end  q quit' }, quit: false };
    return { state, quit: false };
}

export function pagerBottom(state: PagerState): string {
    if (state.prompt !== null) return state.prompt;
    if (state.status) return state.status;
    if (state.top >= pagerMax(state)) return '(END)';
    return state.top === 0 && state.title ? `${state.title}` : ':';
}
