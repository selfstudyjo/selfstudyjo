<template>
  <div class="pg-ed">
    <div class="pg-ed__gutter" aria-hidden="true">
      <div :style="{ transform: `translateY(${-scrollTop}px)` }">
        <div v-for="n in lineCount" :key="n" class="pg-ed__ln" :class="{ 'is-current': n === line }">{{ n }}</div>
      </div>
    </div>
    <div class="pg-ed__body">
      <pre ref="mirror" class="pg-ed__mirror" aria-hidden="true"><span v-for="(t, i) in tokens" :key="i" :class="t.cls ? 'tk-' + t.cls : undefined">{{ t.text }}</span>{{ '\n' }}</pre>
      <textarea ref="area" class="pg-ed__area" :value="modelValue" spellcheck="false" autocapitalize="off" autocomplete="off"
                wrap="off" :aria-label="label" @input="onInput" @scroll="onScroll" @keydown="onKey" @keyup="caret" @click="caret" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Query Tool's SQL editor. pgAdmin uses CodeMirror; this is a textarea
 * over a coloured mirror of the same text (tokens rendered as spans, never as
 * markup), with the gutter, the current-line marker and pgAdmin's keys:
 * F5 / Ctrl+Enter execute, F7 explain, Shift+F7 explain analyze.
 */
import { computed, ref } from 'vue';
import { tokenize } from './pg';

const props = withDefaults(defineProps<{ modelValue: string; label?: string }>(), { label: 'SQL editor' });
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'run'): void;
  (event: 'explain', analyze: boolean): void;
  (event: 'cursor', line: number, col: number): void;
}>();

const area = ref<HTMLTextAreaElement | null>(null);
const mirror = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const line = ref(1);

const tokens = computed(() => tokenize(props.modelValue || ''));
const lineCount = computed(() => Math.max(1, (props.modelValue || '').split('\n').length));

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
  caret();
}

function onScroll() {
  const el = area.value;
  if (!el) return;
  scrollTop.value = el.scrollTop;
  if (mirror.value) {
    mirror.value.scrollTop = el.scrollTop;
    mirror.value.scrollLeft = el.scrollLeft;
  }
}

function caret() {
  const el = area.value;
  if (!el) return;
  const before = el.value.slice(0, el.selectionStart);
  const lines = before.split('\n');
  line.value = lines.length;
  emit('cursor', lines.length, (lines[lines.length - 1] || '').length + 1);
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && event.key === 'Enter')) {
    event.preventDefault();
    emit('run');
  } else if (event.key === 'F7') {
    event.preventDefault();
    emit('explain', event.shiftKey);
  } else if (event.key === 'Tab' && !event.ctrlKey && !event.altKey) {
    const el = area.value;
    if (!el) return;
    event.preventDefault();
    const { selectionStart: s, selectionEnd: e, value } = el;
    const next = value.slice(0, s) + '    ' + value.slice(e);
    emit('update:modelValue', next);
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
  }
}

/** The text to run: the selection when there is one, as pgAdmin does. */
function selection(): string {
  const el = area.value;
  if (!el) return '';
  return el.value.slice(el.selectionStart, el.selectionEnd);
}

function focus() {
  area.value?.focus();
}

defineExpose({ selection, focus });
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-ed { display: flex; min-height: 0; flex: 1; background: var(--pg-editor-bg); font-family: var(--pg-mono); font-size: 13px; line-height: 19px; }
.pg-ed__gutter { flex: none; width: 42px; overflow: hidden; background: var(--pg-gutter); border-right: 1px solid var(--pg-border); color: #6e7687; text-align: right; padding-top: 6px; user-select: none; }
.pg-ed__ln { padding-right: 8px; height: 19px; }
.pg-ed__ln.is-current { color: var(--pg-text); background: #e8f2ff; }
.pg-ed__body { position: relative; flex: 1; min-width: 0; }
.pg-ed__mirror, .pg-ed__area {
  position: absolute; inset: 0; margin: 0; padding: 6px 10px; border: 0; box-sizing: border-box;
  font: inherit; line-height: inherit; letter-spacing: normal; tab-size: 4; white-space: pre; overflow: auto;
}
.pg-ed__mirror { color: var(--pg-text); pointer-events: none; overflow: hidden; }
.pg-ed__area {
  background: transparent; color: var(--pg-text); -webkit-text-fill-color: transparent; caret-color: #111; resize: none; outline: none; z-index: 1;
}
.pg-ed__area::selection { background: rgba(50, 102, 144, .25); color: transparent; }
</style>
