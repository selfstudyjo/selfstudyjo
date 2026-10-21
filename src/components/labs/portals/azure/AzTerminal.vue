<template>
  <div class="az-term" :class="{ 'is-light': light }" @click="focus">
    <div ref="screen" class="az-term__screen" role="log" aria-live="polite">
      <div v-for="line in lines" :key="line.id" class="az-term__line" :class="'is-' + line.kind">
        <template v-if="line.kind === 'in'"><span class="az-term__prompt">{{ line.prompt }}</span>{{ line.text }}</template>
        <template v-else>{{ line.text }}</template>
      </div>
      <div v-if="running" class="az-term__line is-info">{{ runningText }}</div>
      <label v-show="!running && !disabled" class="az-term__input">
        <span class="az-term__prompt">{{ prompt }}</span>
        <input ref="input" v-model="draft" type="text" spellcheck="false" autocomplete="off" autocapitalize="off"
               :aria-label="label" @keydown="onKey" />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * A terminal: the Bastion session, the serial console, `az ssh vm` and Cloud
 * Shell all draw this. It only collects a line and prints what came back -
 * what a line MEANS is the caller's `send`, which always runs the `az` command
 * line a student could have typed (so every keystroke that does anything is
 * also a line in the equivalent-CLI drawer).
 *
 * Text is rendered as text nodes; nothing here reaches innerHTML.
 */
import { nextTick, onMounted, ref, watch } from 'vue';

export interface TermReply { text?: string; error?: boolean; clear?: boolean; exit?: boolean }

const props = withDefaults(defineProps<{
  prompt: string;
  banner?: string;
  send: (line: string) => Promise<TermReply>;
  disabled?: boolean;
  light?: boolean;
  label?: string;
  runningText?: string;
  autofocus?: boolean;
}>(), { banner: '', disabled: false, light: false, label: 'Terminal input', runningText: '', autofocus: true });

const emit = defineEmits<{ (event: 'exit'): void }>();

interface Line { id: number; kind: 'in' | 'out' | 'err' | 'info'; text: string; prompt?: string }
let seq = 0;
const lines = ref<Line[]>([]);
const draft = ref('');
const running = ref(false);
const history = ref<string[]>([]);
let cursor = -1;
const screen = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);

function push(kind: Line['kind'], text: string, prompt?: string) {
  for (const part of String(text).replace(/\r/g, '').split('\n')) {
    lines.value.push({ id: ++seq, kind, text: part, prompt });
    prompt = undefined;
  }
  if (lines.value.length > 600) lines.value = lines.value.slice(-600);
  scroll();
}
function scroll() { nextTick(() => { if (screen.value) screen.value.scrollTop = screen.value.scrollHeight; }); }
function focus() {
  const sel = window.getSelection?.();
  if (sel && String(sel).length) return; // selecting text to copy must not steal it
  input.value?.focus({ preventScroll: true });
}
function print(text: string, kind: Line['kind'] = 'out') { push(kind, text); }
function clear() { lines.value = []; }
defineExpose({ print, clear, focus });

watch(() => props.banner, text => { if (text) push('info', text); }, { immediate: true });

async function submit() {
  const line = draft.value;
  draft.value = '';
  push('in', line, props.prompt);
  if (line.trim()) {
    history.value = [...history.value.filter(h => h !== line), line].slice(-100);
  }
  cursor = -1;
  if (!line.trim()) return;
  running.value = true;
  try {
    const reply = await props.send(line);
    if (reply.clear) clear();
    if (reply.text) push(reply.error ? 'err' : 'out', reply.text.replace(/\n+$/, ''));
    if (reply.exit) emit('exit');
  } catch (error: any) {
    push('err', String(error?.message || error || 'The command failed.'));
  } finally {
    running.value = false;
    nextTick(() => input.value?.focus({ preventScroll: true }));
  }
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter') { event.preventDefault(); void submit(); return; }
  if (event.key === 'ArrowUp' && history.value.length) {
    event.preventDefault();
    cursor = cursor < 0 ? history.value.length - 1 : Math.max(0, cursor - 1);
    draft.value = history.value[cursor];
    return;
  }
  if (event.key === 'ArrowDown' && cursor >= 0) {
    event.preventDefault();
    cursor += 1;
    if (cursor >= history.value.length) { cursor = -1; draft.value = ''; } else draft.value = history.value[cursor];
    return;
  }
  if (event.ctrlKey && (event.key === 'l' || event.key === 'L')) { event.preventDefault(); clear(); return; }
  if (event.ctrlKey && (event.key === 'c' || event.key === 'C') && !String(window.getSelection?.() || '')) {
    event.preventDefault();
    push('in', draft.value + '^C', props.prompt);
    draft.value = '';
  }
}

onMounted(() => { if (props.autofocus) nextTick(() => input.value?.focus({ preventScroll: true })); });
</script>

<style scoped>
.az-term { display: flex; flex-direction: column; min-height: 0; height: 100%; background: #0c0c0c; color: #e6e6e6;
  font: 13px/1.45 Consolas, 'Cascadia Mono', 'Courier New', monospace; cursor: text; }
.az-term.is-light { background: #ffffff; color: #242424; }
.az-term__screen { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 8px 10px 12px; }
.az-term__line { white-space: pre-wrap; overflow-wrap: anywhere; min-height: 1.45em; }
.az-term__line.is-err { color: #ff8a80; }
.az-term__line.is-info { color: #9cdcfe; }
.az-term.is-light .az-term__line.is-err { color: #c50f1f; }
.az-term.is-light .az-term__line.is-info { color: #0f6cbd; }
.az-term__prompt { color: #4ec9b0; white-space: pre; }
.az-term.is-light .az-term__prompt { color: #107c10; }
.az-term__input { display: flex; align-items: baseline; }
.az-term__input input { flex: 1 1 auto; min-width: 40px; padding: 0; border: 0; outline: none; background: transparent;
  color: inherit; font: inherit; caret-color: #e6e6e6; }
.az-term.is-light .az-term__input input { caret-color: #242424; }
</style>
