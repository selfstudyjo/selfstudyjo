<template>
  <div class="sl-web">
    <div class="sl-console__head">
      <div class="sl-console__title">
        <Code2 class="sl-i" />
        <span>{{ $t('Web Playground') }}</span>
        <span class="sl-tag sl-tag--real">{{ $t('Real') }}</span>
      </div>
      <div class="sl-console__actions">
        <button type="button" class="sl-btn sl-btn--primary sl-btn--sm" @click="render">
          <Play class="sl-i" /> {{ $t('Run') }}
        </button>
        <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm" @click="save">
          <Save class="sl-i" /> {{ $t('Save') }}
        </button>
        <label class="sl-web__auto">
          <input v-model="live" type="checkbox"> {{ $t('Live') }}
        </label>
      </div>
    </div>

    <p class="sl-console__fidelity">
      {{ $t('Your own browser renders this in a sandboxed frame. Nothing runs on the server.') }}
    </p>

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
        <div class="sl-web__resulthead">{{ $t('Result') }}</div>
        <!--
          `sandbox="allow-scripts"` and NOTHING ELSE, and the omission is the
          security property.

          `allow-same-origin` alongside `allow-scripts` would let the student's
          script reach this page's DOM, its localStorage and the session token in
          it - which is not a sandbox, it is a same-origin script tag with extra
          steps. Without it the frame is a unique opaque origin, so `postMessage`
          is the only way out and that is exactly what the console shim uses.

          `srcdoc` rather than a blob URL: a blob inherits the creating page's
          origin, which would undo the same thing from the other direction.
        -->
        <iframe
          ref="frame"
          class="sl-web__frame"
          title="Result"
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          :srcdoc="document"
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
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Code2, Play, Save } from 'lucide-vue-next';
import { buildPreview } from '@/utils/labCatalogue';

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
const document = ref('');
const logs = ref<Array<{ level: string; text: string }>>([]);
const frame = ref<HTMLIFrameElement | null>(null);

let debounce: number | undefined;

function render() {
  logs.value = [];
  document.value = buildPreview(html.value, css.value, js.value);
}

async function save() {
  await props.save({ html: html.value, css: css.value, js: js.value });
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
  if (!live.value) return;
  window.clearTimeout(debounce);
  debounce = window.setTimeout(render, 500);
});

watch(() => props.initial, value => {
  html.value = value?.html || html.value;
  css.value = value?.css || css.value;
  js.value = value?.js || js.value;
  render();
});

onMounted(() => {
  window.addEventListener('message', onMessage);
  render();
});

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage);
  window.clearTimeout(debounce);
});
</script>
