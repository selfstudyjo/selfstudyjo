<template>
  <div class="sl-web" :class="{ 'sl-web--wide': wide }">
    <div class="sl-console__head">
      <div class="sl-console__title">
        <Code2 class="sl-i" />
        <span>{{ $t('Web Playground') }}</span>
        <span class="sl-tag sl-tag--real">{{ $t('Real') }}</span>
      </div>
      <div class="sl-console__actions">
        <button type="button" class="sl-btn sl-btn--primary sl-btn--sm" @click="run">
          <Play class="sl-i" /> {{ $t('Run') }}
        </button>
        <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                :disabled="saving" @click="save">
          <Save class="sl-i" /> {{ saving ? $t('Saving...') : $t('Save') }}
        </button>
        <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                :aria-pressed="wide" @click="wide = !wide">
          <component :is="wide ? Minimize2 : Maximize2" class="sl-i" />
          {{ wide ? $t('Side by side') : $t('Big preview') }}
        </button>
        <label class="sl-web__auto">
          <input v-model="live" type="checkbox"> {{ $t('Live') }}
        </label>
      </div>
    </div>

    <p class="sl-console__fidelity">
      {{ $t('Your own browser renders this in a sandboxed frame. Nothing runs on the server.') }}
    </p>

    <!--
      What happened to the student's work, in words.

      The Save button used to report nothing at all, so a save that failed
      against a cold replica and a save that landed produced the same silence —
      and this is the pane whose whole content is unsaved work.
    -->
    <p v-if="note" class="sl-web__note" :class="`sl-web__note--${noteTone}`"
       role="status">{{ note }}</p>

    <div class="sl-web__panes">
      <div class="sl-web__editors">
        <div class="sl-web__tabs">
          <button
            v-for="pane in PANES"
            :key="pane.id"
            type="button"
            class="sl-web__tab"
            :class="{ 'is-active': active === pane.id }"
            @click="active = pane.id"
          >{{ pane.label }}</button>
        </div>
        <!-- LTR always: this is source. -->
        <textarea
          v-show="active === 'html'"
          v-model="html" class="sl-web__editor" dir="ltr" spellcheck="false"
          :placeholder="'<h1>Hello</h1>'"
          @keydown.tab.prevent="indent($event, 'html')"
        ></textarea>
        <textarea
          v-show="active === 'css'"
          v-model="css" class="sl-web__editor" dir="ltr" spellcheck="false"
          :placeholder="'body { font-family: system-ui; }'"
          @keydown.tab.prevent="indent($event, 'css')"
        ></textarea>
        <textarea
          v-show="active === 'js'"
          v-model="js" class="sl-web__editor" dir="ltr" spellcheck="false"
          :placeholder="'console.log(\'hello\');'"
          @keydown.tab.prevent="indent($event, 'js')"
        ></textarea>
      </div>

      <div class="sl-web__result">
        <div class="sl-web__resulthead">
          <span>{{ $t('Result') }}</span>
          <span v-if="stale" class="sl-web__stale">{{ $t('Press Run to update') }}</span>
        </div>
        <!--
          `allow-scripts` WITHOUT `allow-same-origin`, and that omission is the
          security property.

          `allow-same-origin` alongside `allow-scripts` would let the student's
          script reach this page's DOM, its localStorage and the session token in
          it - which is not a sandbox, it is a same-origin script tag with extra
          steps. Without it the frame is a unique opaque origin, so `postMessage`
          is the only way out and that is exactly what the console shim uses.

          `srcdoc` rather than a blob URL, and no "open in a new tab" button
          either: a `blob:` URL inherits the CREATING page's origin, so opening
          the student's document that way would undo the whole sandbox from the
          other direction. "Big preview" widens this frame instead, which is the
          same thing to look at and none of the risk.
        -->
        <iframe
          ref="frame"
          class="sl-web__frame"
          title="Result"
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          :srcdoc="srcdoc"
        ></iframe>
        <div class="sl-web__console" dir="ltr">
          <div class="sl-web__consolehead">
            <span>{{ $t('Console') }}</span>
            <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                    @click="logs = []">{{ $t('Clear') }}</button>
          </div>
          <p v-if="logs.length === 0" class="sl-web__quiet">
            {{ $t('console.log output appears here.') }}
          </p>
          <div v-for="(entry, index) in logs" :key="index"
               class="sl-web__log" :class="`sl-web__log--${entry.level}`">{{ entry.text }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The HTML/CSS/JS playground: three editors and a live result pane.
 *
 * The student's code runs in THEIR browser, in a sandboxed iframe, and nowhere
 * else. See the comment on the `<iframe>` for why the sandbox attribute is
 * spelled the way it is — that one omission is the whole security model.
 *
 * `buildPreview` in `labCatalogue.ts` assembles the document and installs the
 * console shim; it is a plain function so `npm run check:labs` can assert two
 * things no screenshot shows: that the shim is present before the student's
 * script, and that a FULL document the student wrote is not silently rewrapped.
 *
 * **Live mode is debounced and off by default for the JS pane's sake.** Typing
 * half a statement re-renders a frame whose script throws, which fills the
 * console with errors about code the student has not finished writing. The Run
 * button is the honest default; Live is a choice.
 *
 * Three things changed on 2026-09-01, after "I can't see my design", and all
 * three are the same fault seen from different angles: **the browser owns this
 * source and the server does not.**
 *
 * **An incoming `initial` is adopted only while the student has typed nothing.**
 * `LabWorkspace` re-seeds it from the environment payload after any tool run,
 * and the payload holds the last SAVED copy — so running one terminal command
 * silently replaced whatever was in these three boxes with the lab's starter
 * file. Verified by driving it: the editors came back reading `<h1>Hello</h1>`
 * with the student's own markup gone. The other half of that fix is in
 * `LabWorkspace`, which no longer re-seeds at all.
 *
 * **Run SAVES as well as rendering**, in the background. Rendering is local and
 * instant, grading is server-side, and a student who presses Run and then Check
 * my work was being graded on source the backend had never been sent. Run is
 * the button that means "this is my work now", so it is the honest place to
 * persist. The save is not awaited, so Run stays instant against a cold replica.
 *
 * **Every outcome says something.** Saved, saving, could not save, and "you have
 * typed since the last Run" were all silent.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Code2, Maximize2, Minimize2, Play, Save } from 'lucide-vue-next';
import { buildPreview } from '@/utils/labCatalogue';
import { t } from '@/i18n/runtime';

const props = defineProps<{
  initial?: { html?: string; css?: string; js?: string };
  save: (source: { html: string; css: string; js: string }) => Promise<unknown>;
}>();

const PANES = [
  { id: 'html' as const, label: 'HTML' },
  { id: 'css' as const, label: 'CSS' },
  { id: 'js' as const, label: 'JS' },
];

const html = ref(props.initial?.html || '');
const css = ref(props.initial?.css || '');
const js = ref(props.initial?.js || '');
const active = ref<'html' | 'css' | 'js'>('html');
const live = ref(false);
const wide = ref(false);
const saving = ref(false);
const note = ref('');
const noteTone = ref<'good' | 'bad' | 'quiet'>('quiet');
/** The document currently in the frame. NOT named `document` — see below. */
const srcdoc = ref('');
const logs = ref<Array<{ level: string; text: string }>>([]);
const frame = ref<HTMLIFrameElement | null>(null);

/**
 * Has the student changed anything since this component adopted a source?
 *
 * The one piece of state that makes the ownership rule above enforceable. It is
 * set by the editors and cleared only when a new source is deliberately adopted
 * (a different lab, or a Reset environment).
 */
const touched = ref(false);
/** What was last rendered, so "you have typed since Run" can be shown. */
const rendered = ref('');

const stale = computed(() => rendered.value !== signature());

let debounce: number | undefined;
let saveTimer: number | undefined;

function signature(): string {
  return `${html.value} ${css.value} ${js.value}`;
}

function adopt(value: { html?: string; css?: string; js?: string } | undefined) {
  html.value = value?.html || '';
  css.value = value?.css || '';
  js.value = value?.js || '';
  touched.value = false;
  render();
}

function render() {
  logs.value = [];
  srcdoc.value = buildPreview(html.value, css.value, js.value);
  rendered.value = signature();
}

/** Run: render now, persist in the background. */
function run() {
  render();
  queueSave();
}

/**
 * Persist without making the student wait.
 *
 * Debounced, because Live mode plus a fast typist would otherwise be a request
 * per keystroke to a PythonAnywhere worker; and it never throws, because the
 * frame has already rendered and a failed save must not read as a failed Run.
 */
function queueSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { void persist(true); }, 700);
}

async function persist(quiet = false) {
  if (saving.value) return;
  saving.value = true;
  if (!quiet) { note.value = ''; }
  try {
    const saved = await props.save({ html: html.value, css: css.value, js: js.value });
    if (saved === null || saved === undefined) {
      noteTone.value = 'bad';
      note.value = t('Your work is rendered here but could NOT be saved. The lab service did not answer.');
    } else {
      noteTone.value = 'good';
      note.value = t('Saved. Check my work will see this.');
    }
  } catch {
    noteTone.value = 'bad';
    note.value = t('Your work is rendered here but could NOT be saved. The lab service did not answer.');
  } finally {
    saving.value = false;
  }
}

async function save() {
  window.clearTimeout(saveTimer);
  await persist(false);
}

function indent(event: KeyboardEvent, pane: 'html' | 'css' | 'js') {
  const field = event.target as HTMLTextAreaElement;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const source = pane === 'html' ? html : pane === 'css' ? css : js;
  source.value = source.value.slice(0, start) + '  ' + source.value.slice(end);
  requestAnimationFrame(() => {
    field.selectionStart = field.selectionEnd = start + 2;
  });
}

/**
 * The console shim's messages.
 *
 * Filtered on `sfsLab`, because a sandboxed frame is not the only thing that can
 * post to this window - an extension, another frame, the page itself - and a
 * console that printed every message it received would be showing the reader
 * somebody else's traffic. The ORIGIN cannot be checked: a frame sandboxed
 * without `allow-same-origin` posts from `null` by design, which is the price of
 * the sandbox being real.
 */
function onMessage(event: MessageEvent) {
  const payload = event?.data;
  if (!payload || payload.sfsLab !== true) return;
  logs.value.push({ level: String(payload.level || 'log'),
                    text: String(payload.text || '') });
  if (logs.value.length > 200) logs.value.splice(0, logs.value.length - 200);
}

watch([html, css, js], () => {
  touched.value = true;
  if (!live.value) return;
  window.clearTimeout(debounce);
  debounce = window.setTimeout(() => { render(); queueSave(); }, 500);
});

/**
 * A source arriving from the server replaces these boxes ONLY if nothing has
 * been typed into them. See the header — adopting unconditionally is what threw
 * the student's markup away on every command they ran.
 */
watch(() => props.initial, value => {
  if (touched.value) return;
  adopt(value);
});

onMounted(() => {
  window.addEventListener('message', onMessage);
  render();
});

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage);
  window.clearTimeout(debounce);
  window.clearTimeout(saveTimer);
});
</script>
