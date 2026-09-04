<template>
  <div class="sl-console">
    <div class="sl-console__head">
      <div class="sl-console__title">
        <component :is="icon" class="sl-i" />
        <span>{{ $t(tool.label) }}</span>
        <span v-if="tool.simulated" class="sl-tag sl-tag--sim">{{ $t('Simulated') }}</span>
        <span v-else class="sl-tag sl-tag--real">{{ $t('Real') }}</span>
      </div>
      <div class="sl-console__actions">
        <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                :title="$t('Keyboard shortcuts')" @click="keysOpen = !keysOpen">
          <Keyboard class="sl-i" /> {{ $t('Keys') }}
        </button>
        <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                @click="lines = []">
          <Eraser class="sl-i" /> {{ $t('Clear') }}
        </button>
      </div>
    </div>

    <!-- The fidelity line, on the tool's own header.
         Not a footnote: a student who learns a command against a simulator has
         to know which parts of it are real, and the one place they will read
         that is next to the prompt they are typing at. -->
    <p v-if="tool.fidelity" class="sl-console__fidelity">{{ tool.fidelity }}</p>

    <!--
      The shortcut card, opened rather than always drawn.

      Every one of these keys is claimed from the browser (Ctrl+W closes a tab,
      Ctrl+L focuses the address bar), so a student has to be able to find out
      that they now do something else here — and a permanent legend above a
      terminal is six lines of chrome in the place the transcript should be.
    -->
    <div v-if="keysOpen" class="sl-console__keys" dir="ltr">
      <dl>
        <div><dt>Tab</dt><dd>{{ $t('complete a command or a filename') }}</dd></div>
        <div><dt>Ctrl+R</dt><dd>{{ $t('search what you have run') }}</dd></div>
        <div><dt>Ctrl+L</dt><dd>{{ $t('clear the screen') }}</dd></div>
        <div><dt>Ctrl+A / Ctrl+E</dt><dd>{{ $t('start / end of the line') }}</dd></div>
        <div><dt>Ctrl+U / Ctrl+K</dt><dd>{{ $t('cut to the start / to the end') }}</dd></div>
        <div><dt>Ctrl+W / Ctrl+Y</dt><dd>{{ $t('cut the last word / paste it back') }}</dd></div>
        <div><dt>Ctrl+C</dt><dd>{{ $t('abandon the line') }}</dd></div>
        <div><dt>Up / Down</dt><dd>{{ $t('walk through history') }}</dd></div>
        <div><dt>!!</dt><dd>{{ $t('run the previous command again') }}</dd></div>
        <div><dt>nano / vi</dt><dd>{{ $t('open a file in an editor') }}</dd></div>
      </dl>
    </div>

    <!--
      `dir="ltr"` and it never mirrors.

      A shell transcript is not a paragraph. Rendered right-to-left the bidi
      algorithm reorders the punctuation, so `ls -la /var/log | grep error`
      comes out with the pipe and the flags moved and a student copying it gets
      a command that does not run. `rtl.css` pins every `<pre>` for the same
      reason; this says it locally as well because this element is built here.
    -->
    <div ref="scroller" class="sl-console__body" dir="ltr" @click="focusField">
      <div v-if="lines.length === 0" class="sl-console__hello">
        <p>{{ $t(tool.summary) }}</p>
        <p v-if="hint" class="sl-console__hint">{{ hint }}</p>
        <p class="sl-console__hint">
          {{ $t('Type help to see every command, or press Tab to complete one.') }}
        </p>
      </div>
      <div v-for="(line, index) in lines" :key="index"
           class="sl-console__line" :class="`sl-console__line--${line.kind}`">
        <span v-if="line.kind === 'cmd'" class="sl-console__prompt">{{ line.at || prompt }}</span><span
        >{{ line.text }}</span>
      </div>
      <div v-if="busy" class="sl-console__line sl-console__line--note">
        {{ $t('Running...') }}
      </div>
    </div>

    <!--
      THE REVERSE SEARCH LINE replaces the prompt while it is open, exactly as a
      real shell does. Drawn as its own row rather than as a placeholder in the
      input, because what is in the input at that moment is the MATCH and what
      the student is typing is the query — two different strings, and showing
      only one of them is what makes a browser imitation of Ctrl+R unusable.
    -->
    <form class="sl-console__form" dir="ltr" @submit.prevent="submit">
      <span v-if="search" class="sl-console__prompt sl-console__prompt--search">
        {{ searchLabel }}
      </span>
      <span v-else class="sl-console__prompt">{{ prompt }}</span>
      <input
        ref="field"
        v-model="entry"
        class="sl-console__input"
        type="text"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        :disabled="busy"
        :placeholder="search ? '' : placeholder"
        @keydown="onKey"
      >
      <button type="submit" class="sl-btn sl-btn--primary sl-btn--sm"
              :disabled="busy || !entry.trim()">
        <CornerDownLeft class="sl-i" /> {{ $t('Run') }}
      </button>
    </form>

    <!--
      nano and vi, as an overlay over the console.

      There is no pseudo-terminal anywhere in this design, so a real curses
      editor cannot exist — the backend answers `nano notes.txt` with the file's
      contents and this is what opens. The shortcuts are the real ones (^O, ^X,
      :w, :wq, i, Esc) because a student who learns those can use nano and vi on
      a real machine and one who learns a Save button cannot.
    -->
    <div v-if="editor" class="sl-editor" dir="ltr" role="dialog"
         :aria-label="`${editor.program} ${editor.name}`">
      <div class="sl-editor__bar">
        <span class="sl-editor__name">
          {{ editor.program === 'nano' ? 'GNU nano' : 'VIM' }} &middot; {{ editor.name }}
          <span v-if="editor.dirty" class="sl-editor__dirty">{{ $t('Modified') }}</span>
        </span>
        <span v-if="editor.program === 'vi'" class="sl-editor__mode">
          {{ editor.mode === 'insert' ? '-- INSERT --'
             : editor.mode === 'command' ? editor.pending : '-- NORMAL --' }}
        </span>
      </div>
      <textarea
        ref="buffer"
        v-model="editor.text"
        class="sl-editor__text"
        spellcheck="false"
        :readonly="editor.program === 'vi' && editor.mode !== 'insert'"
        @keydown="onEditorKey"
        @input="editor.dirty = true"
      ></textarea>
      <!-- The status on the left and the shortcuts on the right, and the
           status is EMPTY when there is nothing to say. Falling back to the
           help line there printed the shortcuts twice, side by side, which
           reads as a rendering fault rather than as a quiet editor. -->
      <div class="sl-editor__foot">
        <span class="sl-editor__status">{{ editor.status }}</span>
        <span class="sl-editor__hint">{{ editorHelpLine }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * One console, for all of them — and it is a TERMINAL now, not a text box.
 *
 * Docker, Compose, kubectl, Helm, HDFS, YARN, Spark, the AWS CLI, the az CLI,
 * Terraform, git and the shell are ONE component. They differ in the tool
 * record and in nothing else the browser cares about — a line goes out, text
 * comes back — so a component per tool would be twelve near-identical files and
 * the twelfth would drift.
 *
 * **The keys are the point of the 2026-09-04 rework.** Every lab console now
 * has a POSIX shell behind it (`utils/sims/shell.py`), and a shell reached
 * through an `<input>` with an up-arrow is not a shell: nobody types whole
 * paths, they type three letters and press Tab; nobody scrolls to find
 * yesterday's command, they press Ctrl+R. So Tab, Ctrl+R, Ctrl+L, Ctrl+A/E,
 * Ctrl+U/K/W/Y, Ctrl+C, Ctrl+D, Ctrl+P/N, Alt+B/F and `!!` are all handled
 * here. Every one of them has to be CLAIMED from the browser — Ctrl+W closes
 * the tab, Ctrl+L focuses the address bar — and claiming a key without
 * implementing it is worse than leaving it alone, which is why the decisions
 * live in `labTerminal.ts` with `npm run check:labs` over them rather than as
 * branches in here.
 *
 * Four more things in here are not cosmetic:
 *
 * **The transcript is text nodes, never `v-html`.** Command output on this
 * platform includes an access-log line a stranger chose and a filename a
 * student typed; `RichText` is for prose and a console is not prose.
 *
 * **The prompt shows the DIRECTORY, and each command keeps the prompt it was
 * typed at.** A shell prompt that did not move after `cd` would make the one
 * thing `cd` does invisible, and a transcript that rewrote every past prompt to
 * the current directory would be a lie about where each command ran.
 *
 * **`clear` is answered out of band.** The backend returns `clear: true` rather
 * than empty output, because a console that printed "(no output)" for `clear`
 * was the second thing reported about these labs.
 *
 * **Completion candidates are cached per directory and re-primed from every
 * response.** One fetch on the first Tab, and none after that: a round trip per
 * keystroke against a replica whose first answer of the day takes twenty
 * seconds is not a completion, it is a pause.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import {
  CornerDownLeft, Eraser, Keyboard, Terminal, Boxes, Cloud, Database, FileCode,
  GitBranch, HardDrive, Layers, Server, Zap,
} from 'lucide-vue-next';
import type { LabTool } from '@/utils/labCatalogue';
import {
  applyReadline, completeLine, editorHelp, editorKey, expandHistory, openEditor,
  searchHistory, type CompletionSource, type EditorRequest, type EditorState,
  type ReadlineKey, type SearchState,
} from '@/utils/labTerminal';

const props = defineProps<{
  tool: LabTool;
  hint?: string;
  run: (line: string) => Promise<ConsoleAnswer>;
  /** Tab candidates for the current directory. Optional: without it Tab is inert. */
  complete?: (toolId: string) => Promise<CompletionSource & { prompt?: string }>;
  /** Save an editor buffer back to the workspace. */
  save?: (path: string, content: string) => Promise<{ ok: boolean; error?: string }>;
}>();

interface ConsoleAnswer {
  ok: boolean;
  output?: string;
  error?: string;
  clear?: boolean;
  cwd?: string;
  prompt?: string;
  editor?: EditorRequest;
}

type Line = { kind: 'cmd' | 'out' | 'err' | 'note'; text: string; at?: string };

const lines = ref<Line[]>([]);
const entry = ref('');
const busy = ref(false);
const history = ref<string[]>([]);
const cursor = ref(-1);
const scroller = ref<HTMLElement | null>(null);
const field = ref<HTMLInputElement | null>(null);
const buffer = ref<HTMLTextAreaElement | null>(null);
const keysOpen = ref(false);
const editor = ref<EditorState | null>(null);
const yank = ref('');
const search = ref<SearchState | null>(null);
/** Where the shell is. Drawn in the prompt and the key for the Tab cache. */
const cwd = ref('~');
const candidates = ref<Record<string, CompletionSource>>({});

const ICONS: Record<string, any> = {
  terminal: Terminal, docker: Boxes, layers: Layers, kubernetes: Boxes,
  package: Layers, hdfs: HardDrive, server: Server, spark: Zap,
  aws: Cloud, azure: Cloud, terraform: Layers, git: GitBranch,
  database: Database, code: FileCode, file: FileCode,
};

const icon = computed(() => ICONS[props.tool.icon] || Terminal);
/**
 * The prompt.
 *
 * `student@lab:~/practice$` when the shell has told us where it is, and the
 * tool's own prompt otherwise — Spark's is `spark-sql> ` and pretending it is a
 * bash prompt would be wrong about which language the next line is in.
 */
const prompt = computed(() => {
  const own = props.tool.prompt || '$ ';
  if (own.trim() !== '$') return own;
  return `student@lab:${cwd.value}$ `;
});
const placeholder = computed(() => props.tool.summary.split('.')[0]);
const editorHelpLine = computed(() => (editor.value
  ? editorHelp(editor.value.program) : ''));
const searchLabel = computed(() => {
  if (!search.value) return '';
  const hit = searchHistory(history.value, search.value);
  const counter = hit.total > 1 ? ` (${hit.index}/${hit.total})` : '';
  return `(reverse-i-search)\`${search.value.query}'${counter}: `;
});

function focusField() {
  if (!editor.value) field.value?.focus();
}

function push(kind: Line['kind'], text: string, at?: string) {
  lines.value.push({ kind, text, at });
}

async function submit() {
  if (search.value) { search.value = null; return; }
  const typed = entry.value;
  const line = expandHistory(typed, history.value).trim();
  if (!line || busy.value) return;
  entry.value = '';
  cursor.value = -1;
  history.value.push(line);
  // The prompt the command was typed AT, kept with it. Re-rendering every past
  // line at the current directory would misreport where each one ran.
  push('cmd', line, prompt.value);
  busy.value = true;
  await scrollDown();
  try {
    const result = await props.run(line);
    // `clear` is a control signal, not output. Checked before anything is
    // printed, or `clear` would leave its own command line on screen.
    if (result?.clear) {
      lines.value = [];
    } else {
      if (result?.output) push('out', result.output);
      if (result?.error) push('err', result.error);
      if (!result?.output && !result?.error && !result?.editor) {
        // A real tool that answers with nothing has succeeded, and a console
        // that shows nothing at all reads as the command having been swallowed.
        push('note', '(no output)');
      }
    }
    if (result?.cwd !== undefined || result?.prompt) {
      const next = result.prompt || (result.cwd ? `~/${result.cwd}` : '~');
      if (next !== cwd.value) {
        cwd.value = next;
        // The directory moved, so the cached listing is for the wrong place.
        // Dropped rather than refetched: the next Tab press fetches it, and
        // most `cd`s are not followed by one.
        delete candidates.value[next];
      }
    }
    if (result?.editor) openBuffer(result.editor);
  } finally {
    busy.value = false;
    await scrollDown();
    focusField();
  }
}

function recall(step: number) {
  if (history.value.length === 0) return;
  if (cursor.value === -1) cursor.value = history.value.length;
  cursor.value = Math.min(history.value.length,
                          Math.max(0, cursor.value + step));
  entry.value = cursor.value >= history.value.length
    ? '' : history.value[cursor.value];
  moveCaret(entry.value.length);
}

function moveCaret(position: number) {
  nextTick(() => {
    const element = field.value;
    if (element) element.setSelectionRange(position, position);
  });
}

function readline(key: ReadlineKey) {
  const element = field.value;
  const caret = element?.selectionStart ?? entry.value.length;
  const next = applyReadline(key, { line: entry.value, caret, yank: yank.value });
  entry.value = next.line;
  yank.value = next.yank;
  moveCaret(next.caret);
}

/* --------------------------------------------------------------------- */
/* Tab completion                                                        */
/* --------------------------------------------------------------------- */

async function sourceFor(): Promise<CompletionSource | null> {
  const key = cwd.value;
  if (candidates.value[key]) return candidates.value[key];
  if (!props.complete) return null;
  try {
    const fetched = await props.complete(props.tool.id);
    if (!fetched) return null;
    // Keyed on the directory the BACKEND says it is in, not the one we thought
    // we were in. They differ for exactly one request after a `cd`, and caching
    // under the stale key means the listing is never found again.
    const at = fetched.prompt || key;
    candidates.value = { ...candidates.value, [at]: fetched };
    if (at !== key) cwd.value = at;
    return fetched;
  } catch {
    return null;
  }
}

async function tab() {
  const element = field.value;
  const caret = element?.selectionStart ?? entry.value.length;
  const source = await sourceFor();
  if (!source) return;
  const result = completeLine(entry.value, caret, source);
  entry.value = result.line;
  moveCaret(result.caret);
  if (result.listing.length > 1) {
    // Echoed with the line, as a shell does: the student needs to see what they
    // had typed above the list, or the list is a set of names with no context.
    push('cmd', entry.value, prompt.value);
    push('note', result.listing.join('  '));
    await scrollDown();
  }
}

/* --------------------------------------------------------------------- */
/* Reverse search                                                        */
/* --------------------------------------------------------------------- */

function beginSearch() {
  if (search.value) {
    search.value = { ...search.value, offset: search.value.offset + 1 };
  } else {
    search.value = { query: '', offset: 0 };
  }
  applySearch();
}

function applySearch() {
  if (!search.value) return;
  const hit = searchHistory(history.value, search.value);
  if (hit.match) entry.value = hit.match;
}

function endSearch(keep: boolean) {
  if (!keep) entry.value = '';
  search.value = null;
  moveCaret(entry.value.length);
}

/* --------------------------------------------------------------------- */
/* The one keydown handler                                               */
/* --------------------------------------------------------------------- */

function onKey(event: KeyboardEvent) {
  const key = event.key;
  const ctrl = event.ctrlKey || event.metaKey;

  if (search.value) {
    if (key === 'Escape') { event.preventDefault(); endSearch(false); return; }
    if (key === 'Enter') { search.value = null; return; }
    if (ctrl && key.toLowerCase() === 'r') {
      event.preventDefault(); beginSearch(); return;
    }
    if (ctrl && key.toLowerCase() === 'g') {
      event.preventDefault(); endSearch(false); return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      search.value = { query: search.value.query.slice(0, -1), offset: 0 };
      applySearch();
      return;
    }
    if (key.length === 1 && !ctrl && !event.altKey) {
      event.preventDefault();
      search.value = { query: search.value.query + key, offset: 0 };
      applySearch();
      return;
    }
    // An arrow key or Home leaves the search with the match in hand, which is
    // what a real shell does and is how somebody edits the line they found.
    endSearch(true);
    return;
  }

  if (key === 'Tab') { event.preventDefault(); tab(); return; }
  if (key === 'ArrowUp') { event.preventDefault(); recall(-1); return; }
  if (key === 'ArrowDown') { event.preventDefault(); recall(1); return; }

  if (ctrl) {
    const letter = key.toLowerCase();
    // Every one of these is claimed from the browser. `preventDefault` is not
    // optional: without it Ctrl+W closes the tab and Ctrl+L goes to the address
    // bar, which is a worse outcome than the shortcut not working.
    const READLINE: Record<string, ReadlineKey> = {
      a: 'home', e: 'end', k: 'kill-to-end', u: 'kill-to-start',
      w: 'kill-word', y: 'yank', d: 'delete-char', t: 'transpose',
    };
    if (letter === 'l') { event.preventDefault(); lines.value = []; return; }
    if (letter === 'r') { event.preventDefault(); beginSearch(); return; }
    if (letter === 'c') {
      event.preventDefault();
      // A shell echoes the abandoned line with a `^C` rather than silently
      // emptying the box, so the student can see what they threw away.
      if (entry.value) push('cmd', `${entry.value}^C`, prompt.value);
      entry.value = '';
      cursor.value = -1;
      scrollDown();
      return;
    }
    if (letter === 'd' && !entry.value) {
      // Ctrl+D on an empty line is end-of-input, not delete-forward. Reported
      // rather than acted on: there is nothing here to log out of, and closing
      // the pane would throw away the transcript.
      event.preventDefault();
      push('note', 'logout (this console stays open)');
      scrollDown();
      return;
    }
    if (letter === 'p') { event.preventDefault(); recall(-1); return; }
    if (letter === 'n') { event.preventDefault(); recall(1); return; }
    if (READLINE[letter]) { event.preventDefault(); readline(READLINE[letter]); return; }
  }

  if (event.altKey) {
    const letter = key.toLowerCase();
    if (letter === 'b') { event.preventDefault(); readline('word-left'); return; }
    if (letter === 'f') { event.preventDefault(); readline('word-right'); return; }
    if (letter === 'd') { event.preventDefault(); readline('kill-word-forward'); return; }
    if (letter === 'u') { event.preventDefault(); readline('upper-word'); return; }
    if (letter === 'l') { event.preventDefault(); readline('lower-word'); return; }
  }
}

/* --------------------------------------------------------------------- */
/* nano and vi                                                           */
/* --------------------------------------------------------------------- */

function openBuffer(request: EditorRequest) {
  editor.value = openEditor(request);
  nextTick(() => {
    const element = buffer.value;
    if (!element) return;
    element.focus();
    element.setSelectionRange(0, 0);
  });
}

async function writeBuffer(): Promise<boolean> {
  const state = editor.value;
  if (!state) return false;
  if (!props.save) {
    editor.value = { ...state, status: 'This lab cannot save from the editor' };
    return false;
  }
  const result = await props.save(state.path, state.text);
  if (!result?.ok) {
    editor.value = { ...state,
                     status: result?.error || 'The file could not be written' };
    return false;
  }
  const written = state.text.split('\n').length;
  editor.value = { ...state, dirty: false,
                   status: `[ Wrote ${written} lines ]` };
  return true;
}

function closeBuffer(note: string) {
  const state = editor.value;
  editor.value = null;
  if (state && note) push('note', note);
  nextTick(() => { focusField(); scrollDown(); });
}

async function onEditorKey(event: KeyboardEvent) {
  const state = editor.value;
  if (!state) return;
  const ctrl = event.ctrlKey || event.metaKey;

  // In vi's NORMAL mode a keypress is a command, so the textarea must not
  // receive it — that is the whole difference between vi and a text box, and a
  // `readonly` textarea alone would still scroll and beep.
  if (state.program === 'vi' && state.mode !== 'insert'
      && !ctrl && event.key.length === 1) {
    event.preventDefault();
  }
  if (state.program === 'vi' && state.mode === 'command'
      && (event.key === 'Enter' || event.key === 'Backspace')) {
    event.preventDefault();
  }
  if (state.program === 'nano' && ctrl
      && 'oxqk'.includes(event.key.toLowerCase())) {
    event.preventDefault();
  }
  if (event.key === 'Escape') event.preventDefault();

  const action = editorKey(state, event.key,
                           { ctrl, shift: event.shiftKey });
  editor.value = action.state;
  if (action.state.mode === 'insert' && state.mode !== 'insert') {
    nextTick(() => buffer.value?.focus());
  }

  if (action.kind === 'save') { await writeBuffer(); return; }
  if (action.kind === 'save-and-close') {
    const saved = await writeBuffer();
    if (saved) closeBuffer(`"${state.name}" written`);
    return;
  }
  if (action.kind === 'close') { closeBuffer(''); return; }
  if (action.kind === 'discard') {
    closeBuffer(state.dirty ? `"${state.name}" not written` : '');
  }
}

async function scrollDown() {
  await nextTick();
  const element = scroller.value;
  if (element) element.scrollTop = element.scrollHeight;
}

onMounted(() => focusField());
watch(() => props.tool.id, () => {
  lines.value = [];
  history.value = [];
  editor.value = null;
  search.value = null;
  candidates.value = {};
  cwd.value = '~';
});
</script>
