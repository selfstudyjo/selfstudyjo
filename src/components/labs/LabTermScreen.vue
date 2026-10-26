<template>
  <!--
    A FULL-SCREEN PROGRAM INSIDE THE TERMINAL: nano, vi, less/man, top/htop/
    watch (live), ping/tail -f (stream).

    Drawn as a character grid in the console's own pane - the same black
    screen, the same monospace cells - because that is what these programs
    are: they take over the terminal and give it back when they quit. Keys go
    to a hidden textarea that keeps focus, so every Ctrl combination reaches
    the program (Ctrl+O, Ctrl+X, Ctrl+K...) instead of the browser, and a paste
    (Ctrl+Shift+V, or the console's right-click menu) arrives as text.
  -->
  <div ref="root" class="sl-ts" dir="ltr" :aria-label="label" role="application"
       @mousedown.prevent="focus" @contextmenu.prevent="$emit('menu', $event)">
    <textarea ref="keys" class="sl-ts__keys" aria-hidden="true" tabindex="0"
              autocomplete="off" autocapitalize="off" spellcheck="false"
              @keydown="onKey" @paste="onPaste"></textarea>
    <span ref="probe" class="sl-ts__probe" aria-hidden="true">M</span>
    <pre class="sl-ts__grid" aria-live="off"><template v-for="(row, r) in grid" :key="r"><span
        v-for="(seg, s) in row" :key="s" :class="seg.cls">{{ seg.text }}</span>{{ r < grid.length - 1 ? '\n' : '' }}</template></pre>
  </div>
</template>

<script setup lang="ts">
/**
 * The DOM half of `utils/termEditor.ts`: it measures the pane, turns the
 * program's state into rows of styled text, routes keys, and does the two
 * things the plain module cannot - write a file, and run a command on a timer.
 *
 * Writing: a workspace file goes back through the Files API (`save`), exactly
 * as before. A SYSTEM file (`/tmp/x`, `/etc/hosts` under sudo) is not in the
 * workspace, so it is written through the shell with a here-document - which
 * is also how the backend's own permissions (sudo, read-only /etc) apply.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  NANO_HELP, NANO_VERSION, contentOf, editorKeyPress, editorPaste, editorSaved, expandTabs,
  nanoShortcuts, openPager, openTermEditor, pagerBottom, pagerKey, resize, visualCol,
  type EditorRequest, type KeyInput, type PagerState, type TermEditor,
} from '@/utils/termEditor';

export interface ScreenRequest {
  program: 'live' | 'stream' | 'pager';
  command?: string;
  tick?: string;
  stop?: string;
  interval?: number;
  title?: string;
  text?: string;
  search?: string;
  limit?: number;
}

const props = defineProps<{
  editor?: EditorRequest | null;
  screen?: ScreenRequest | null;
  run: (line: string) => Promise<{ output?: string; error?: string }>;
  save?: (path: string, content: string) => Promise<{ ok: boolean; error?: string }>;
}>();
const emit = defineEmits<{
  (event: 'exit', payload: { lines: { kind: 'out' | 'err' | 'note'; text: string }[] }): void;
  (event: 'menu', e: MouseEvent): void;
}>();

type Seg = { text: string; cls?: string };

const root = ref<HTMLElement | null>(null);
const keys = ref<HTMLTextAreaElement | null>(null);
const probe = ref<HTMLElement | null>(null);
const rows = ref(24);
const cols = ref(80);
const ed = ref<TermEditor | null>(null);
const pager = ref<PagerState | null>(null);
const liveText = ref('');
const streamLines = ref<string[]>([]);
const saving = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;
let tickNo = 0;
let stopped = false;
let observer: ResizeObserver | null = null;

const label = computed(() => (props.editor ? `${props.editor.program} ${props.editor.name}`
  : props.screen?.title || 'terminal program'));

function measure() {
  const el = root.value;
  const cell = probe.value;
  if (!el || !cell) return;
  const w = cell.getBoundingClientRect().width || 8;
  const h = cell.getBoundingClientRect().height || 17;
  rows.value = Math.max(8, Math.floor((el.clientHeight - 4) / h));
  cols.value = Math.max(30, Math.floor((el.clientWidth - 4) / w));
  if (ed.value) ed.value = resize(ed.value, textRows(), cols.value - gutter());
  if (pager.value) pager.value = { ...pager.value, rows: rows.value - 1 };
}

function textRows(): number {
  if (!ed.value && !props.editor) return rows.value;
  const program = ed.value?.program || props.editor?.program;
  return program === 'vi' ? rows.value - 1 : rows.value - 4;
}

function gutter(): number {
  return ed.value?.program === 'vi' && ed.value.number ? 4 : 0;
}

function focus() {
  keys.value?.focus({ preventScroll: true });
}

/* ───────────────────────────── rendering ───────────────────────────── */

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}

function lineSegs(line: string, left: number, width: number, cursorV: number | null): Seg[] {
  const shown = pad(expandTabs(line).slice(left), width);
  if (cursorV === null) return [{ text: shown }];
  const at = cursorV - left;
  if (at < 0 || at >= width) return [{ text: shown }];
  return [{ text: shown.slice(0, at) }, { text: shown[at] || ' ', cls: 'sl-ts__cursor' },
          { text: shown.slice(at + 1) }];
}

const grid = computed<Seg[][]>(() => {
  const W = cols.value;
  const H = rows.value;
  if (ed.value?.program === 'nano') return nanoGrid(ed.value, W, H);
  if (ed.value?.program === 'vi') return viGrid(ed.value, W, H);
  if (pager.value) {
    const p = pager.value;
    const out: Seg[][] = [];
    for (let i = 0; i < H - 1; i += 1) out.push([{ text: pad(p.lines[p.top + i] ?? (p.top + i < p.lines.length ? '' : '~'), W) }]);
    out.push([{ text: pagerBottom(p), cls: 'sl-ts__inverse' }, { text: ' ', cls: 'sl-ts__cursor' }]);
    return out;
  }
  if (props.screen?.program === 'live') {
    const body = liveText.value.split('\n');
    const out: Seg[][] = [];
    for (let i = 0; i < H; i += 1) out.push([{ text: pad(body[i] ?? '', W) }]);
    return out;
  }
  if (props.screen?.program === 'stream') {
    const body = streamLines.value.slice(-(H - 1));
    const out: Seg[][] = body.map(text => [{ text: pad(text, W) }]);
    out.push([{ text: ' ', cls: 'sl-ts__cursor' }]);
    return out;
  }
  return [];
});

function nanoGrid(s: TermEditor & { program: 'nano' }, W: number, H: number): Seg[][] {
  const out: Seg[][] = [];
  const name = s.name || 'New Buffer';
  const right = s.dirty ? 'Modified  ' : '';
  const left = `  ${NANO_VERSION}`;
  const mid = Math.max(left.length + 1, Math.floor((W - name.length) / 2));
  let bar = pad(left, mid) + name;
  bar = pad(bar, W - right.length) + right;
  out.push([{ text: pad(bar, W), cls: 'sl-ts__inverse' }]);
  const bodyRows = H - 4;
  if (s.prompt?.kind === 'help') {
    for (let i = 0; i < bodyRows; i += 1) out.push([{ text: pad(NANO_HELP[i] ?? '', W) }]);
  } else {
    const { lines, row, col, top, left: hl } = s.buf;
    for (let i = 0; i < bodyRows; i += 1) {
      const r = top + i;
      if (r >= lines.length) { out.push([{ text: pad('', W) }]); continue; }
      const cursor = r === row && !s.prompt ? visualCol(lines[r], col) : null;
      out.push(lineSegs(lines[r], hl, W, cursor));
    }
  }
  if (s.prompt && s.prompt.kind !== 'help') {
    const text = s.prompt.label + s.prompt.text;
    out.push([{ text: text.slice(0, W - 1), cls: 'sl-ts__inverse' },
              { text: ' ', cls: 'sl-ts__cursor' },
              { text: pad('', Math.max(0, W - text.length - 1)), cls: 'sl-ts__inverse' }]);
  } else if (s.status) {
    const msg = s.status.slice(0, W);
    const start = Math.max(0, Math.floor((W - msg.length) / 2));
    out.push([{ text: ' '.repeat(start) }, { text: msg, cls: 'sl-ts__inverse' }]);
  } else {
    out.push([{ text: pad('', W) }]);
  }
  const shortcuts = nanoShortcuts(s);
  const per = Math.max(1, Math.max(shortcuts[0].length, shortcuts[1].length));
  const cell = Math.floor(W / Math.max(per, 6));
  for (const line of shortcuts) {
    const segs: Seg[] = [];
    for (const [key, text] of line) {
      segs.push({ text: key, cls: 'sl-ts__inverse' });
      segs.push({ text: pad(' ' + text, Math.max(1, cell - key.length)) });
    }
    out.push(segs.length ? segs : [{ text: pad('', W) }]);
  }
  return out;
}

function viGrid(s: TermEditor & { program: 'vi' }, W: number, H: number): Seg[][] {
  const out: Seg[][] = [];
  const g = s.number ? 4 : 0;
  const { lines, row, col, top, left } = s.buf;
  const anchor = s.anchor;
  const selecting = (s.mode === 'visual' || s.mode === 'visual-line') && anchor;
  for (let i = 0; i < H - 1; i += 1) {
    const r = top + i;
    if (r >= lines.length) { out.push([{ text: '~', cls: 'sl-ts__tilde' }]); continue; }
    const segs: Seg[] = [];
    if (g) segs.push({ text: String(r + 1).padStart(3) + ' ', cls: 'sl-ts__lineno' });
    const typing = s.mode === 'command' || s.mode === 'search';
    const cursor = r === row && !typing ? visualCol(lines[r], col) : null;
    if (selecting && anchor) {
      const r1 = Math.min(anchor.row, row);
      const r2 = Math.max(anchor.row, row);
      if (r >= r1 && r <= r2) {
        const text = pad(expandTabs(lines[r]).slice(left), W - g);
        let a = 0;
        let b = text.length;
        if (s.mode === 'visual') {
          const startCol = (r === r1 ? (anchor.row < row || (anchor.row === row && anchor.col <= col) ? anchor.col : col) : 0);
          const endCol = (r === r2 ? (anchor.row > row || (anchor.row === row && anchor.col > col) ? anchor.col : col) : lines[r].length);
          a = visualCol(lines[r], startCol) - left;
          b = visualCol(lines[r], endCol) - left + 1;
        } else {
          b = Math.max(1, expandTabs(lines[r]).length - left);
        }
        segs.push({ text: text.slice(0, Math.max(0, a)) }, { text: text.slice(Math.max(0, a), Math.max(0, b)), cls: 'sl-ts__visual' },
                  { text: text.slice(Math.max(0, b)) });
        out.push(segs);
        continue;
      }
    }
    segs.push(...lineSegs(lines[r], left, W - g, cursor));
    out.push(segs);
  }
  if (s.mode === 'command' || s.mode === 'search') {
    out.push([{ text: s.cmdline }, { text: ' ', cls: 'sl-ts__cursor' }]);
  } else {
    const where = lines.length <= H - 1 ? 'All' : top === 0 ? 'Top' : top + H - 1 >= lines.length ? 'Bot'
      : `${Math.round((top / Math.max(1, lines.length - H + 1)) * 100)}%`;
    const ruler = `${row + 1},${col + 1}`.padEnd(14) + where;
    const pending = (s.count + s.pending).slice(0, 10);
    const leftText = s.status;
    const room = W - ruler.length - 12;
    out.push([{ text: pad(leftText.slice(0, room), room), cls: /^E\d+:/.test(leftText) ? 'sl-ts__error' : '' },
              { text: pad(pending, 12) }, { text: ruler }]);
  }
  return out;
}

/* ───────────────────────────── keys ───────────────────────────── */

function input(event: KeyboardEvent): KeyInput {
  return { key: event.key, ctrl: event.ctrlKey || event.metaKey, alt: event.altKey, shift: event.shiftKey };
}

async function onKey(event: KeyboardEvent) {
  const k = input(event);
  // Ctrl+Shift+V (and Shift+Insert) is the terminal's paste: let the browser
  // deliver it as a paste event rather than swallowing it here.
  if ((k.ctrl && k.shift && event.key.toLowerCase() === 'v') || (k.shift && event.key === 'Insert')) return;
  if (k.ctrl && k.shift && event.key.toLowerCase() === 'c') return;
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) return;
  event.preventDefault();
  if (ed.value) {
    if (saving.value) return;
    const { state, action } = editorKeyPress(ed.value, k);
    ed.value = state;
    if (action.kind === 'save') await write(action.name, action.then === 'exit');
    else if (action.kind === 'exit') finish([]);
    return;
  }
  if (pager.value) {
    const { state, quit } = pagerKey(pager.value, k);
    pager.value = state;
    if (quit) finish([]);
    return;
  }
  if (props.screen?.program === 'live') {
    if (event.key === 'q' || event.key === 'Q' || event.key === 'Escape' || (k.ctrl && event.key.toLowerCase() === 'c')) finish([]);
    return;
  }
  if (props.screen?.program === 'stream') {
    if ((k.ctrl && event.key.toLowerCase() === 'c') || event.key === 'q' || event.key === 'Escape') await stopStream();
  }
}

function onPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text') || '';
  event.preventDefault();
  if (text) paste(text);
}

function paste(text: string) {
  if (ed.value) ed.value = editorPaste(ed.value, text);
}

/* ───────────────────────────── writing ───────────────────────────── */

function heredoc(path: string, content: string, sudo: boolean): string {
  let mark = 'SFS_EOF';
  while (content.includes(mark)) mark += '_';
  const quoted = `'${path.replace(/'/g, `'\\''`)}'`;
  const body = content.endsWith('\n') ? content : `${content}\n`;
  return `${sudo ? 'sudo ' : ''}tee ${quoted} > /dev/null <<'${mark}'\n${body}${mark}`;
}

async function write(name: string, thenExit: boolean) {
  const state = ed.value;
  if (!state) return;
  const req = state.request;
  const content = contentOf(state);
  saving.value = true;
  let ok = false;
  let error = '';
  try {
    if (!req.system && name === req.name && props.save) {
      const result = await props.save(req.path, content);
      ok = !!result?.ok;
      error = result?.error || '';
    } else {
      const target = req.system && name === req.name ? req.system : name;
      if (content.length > 3500) {
        error = 'File too large to write from here';
      } else {
        const answer = await props.run(heredoc(target, content, !!req.sudo));
        ok = !answer?.error;
        error = (answer?.error || '').replace(/^.*?:\s*/, '');
      }
    }
  } catch (problem: any) {
    error = problem?.message || 'write failed';
  } finally {
    saving.value = false;
  }
  if (!ed.value) return;
  ed.value = editorSaved(ed.value, ok, error);
  if (ok && thenExit) {
    const note = ed.value.program === 'vi' ? ed.value.status : '';
    finish(note ? [{ kind: 'note', text: note }] : []);
  }
}

/* ───────────────────────────── live and stream ───────────────────────────── */

async function liveTick() {
  if (stopped || !props.screen?.command) return;
  try {
    const answer = await props.run(props.screen.command);
    if (!stopped) liveText.value = answer?.output || answer?.error || '';
  } catch { /* the next tick tries again */ }
  if (!stopped) timer = setTimeout(liveTick, Math.max(1, props.screen?.interval || 2) * 1000);
}

async function streamTick() {
  if (stopped || !props.screen?.tick) return;
  tickNo += 1;
  try {
    const answer = await props.run(props.screen.tick.replace(/\{n\}/g, String(tickNo)));
    if (stopped) return;
    const text = answer?.output || answer?.error || '';
    if (text) streamLines.value = streamLines.value.concat(text.split('\n'));
  } catch { /* keep going */ }
  if (tickNo >= (props.screen?.limit || 600)) { await stopStream(false); return; }
  if (!stopped) timer = setTimeout(streamTick, Math.max(0.2, props.screen?.interval || 1) * 1000);
}

/**
 * End the stream. `interrupted` is a Ctrl+C, which the terminal echoes as `^C` -
 * unless the program's own closing lines already begin with one (ping's do). A
 * stream that simply reached its end (a `fg` job finishing) shows no `^C`.
 */
async function stopStream(interrupted = true) {
  if (stopped) return;
  stopped = true;
  if (timer) clearTimeout(timer);
  const lines = streamLines.value.slice();
  let closing: string[] = [];
  if (props.screen?.stop) {
    try {
      const answer = await props.run(props.screen.stop.replace(/\{n\}/g, String(Math.max(1, tickNo))));
      if (answer?.output) closing = answer.output.split('\n');
    } catch { /* the transcript keeps what streamed */ }
  }
  if (interrupted && closing[0] !== '^C') lines.push('^C');
  lines.push(...closing);
  emit('exit', { lines: [{ kind: 'out', text: lines.join('\n') }] });
}

function finish(lines: { kind: 'out' | 'err' | 'note'; text: string }[]) {
  stopped = true;
  if (timer) clearTimeout(timer);
  emit('exit', { lines });
}

/* ───────────────────────────── lifecycle ───────────────────────────── */

function start() {
  stopped = false;
  tickNo = 0;
  measure();
  // A program that opens half below the fold hides its own status line - the
  // one place nano and vi tell you what just happened.
  root.value?.scrollIntoView?.({ block: 'nearest' });
  if (props.editor) {
    ed.value = openTermEditor(props.editor, textRows(), cols.value);
  } else if (props.screen?.program === 'pager') {
    pager.value = openPager(props.screen.text || '', props.screen.title || '', rows.value - 1, props.screen.search || '');
  } else if (props.screen?.program === 'live') {
    liveText.value = props.screen.text || '';
    liveTick();
  } else if (props.screen?.program === 'stream') {
    streamLines.value = props.screen.text ? props.screen.text.split('\n') : [];
    streamTick();
  }
  nextTick(focus);
}

defineExpose({ paste, focus });

onMounted(() => {
  start();
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(() => measure());
    observer.observe(root.value);
  }
});
onBeforeUnmount(() => {
  stopped = true;
  if (timer) clearTimeout(timer);
  observer?.disconnect();
});
watch(() => [props.editor, props.screen], () => start());
</script>

<style scoped>
.sl-ts {
  position: absolute;
  inset: 0;
  z-index: 3;
  overflow: hidden;
  padding: 2px;
  background: var(--sl-code-bg, #0f172a);
  color: var(--sl-code-ink, #e2e8f0);
  font-family: var(--sfs-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 0.82rem;
  line-height: 1.35;
  cursor: text;
  outline: none;
}

.sl-ts__keys {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  opacity: 0;
  resize: none;
  pointer-events: none;
}

.sl-ts__probe {
  position: absolute;
  visibility: hidden;
  white-space: pre;
}

.sl-ts__grid {
  margin: 0;
  font: inherit;
  white-space: pre;
  color: inherit;
  background: transparent;
  border: 0;
  padding: 0;
}

.sl-ts__inverse {
  background: var(--sl-code-ink, #e2e8f0);
  color: var(--sl-code-bg, #0f172a);
}

.sl-ts__cursor {
  background: var(--sl-code-ink, #e2e8f0);
  color: var(--sl-code-bg, #0f172a);
  animation: sl-ts-blink 1.1s steps(1) infinite;
}

.sl-ts__visual {
  background: var(--sl-code-dim, #94a3b8);
  color: var(--sl-code-bg, #0f172a);
}

.sl-ts__tilde { color: var(--sl-code-accent, #7dd3fc); }
.sl-ts__lineno { color: var(--sl-code-warn, #fcd34d); }
.sl-ts__error { color: var(--sl-code-bad, #fca5a5); }

@keyframes sl-ts-blink {
  50% { background: transparent; color: inherit; }
}

@media (prefers-reduced-motion: reduce) {
  .sl-ts__cursor { animation: none; }
}
</style>
