<template>
  <section class="csh" aria-label="AWS CloudShell">
    <header class="csh__bar">
      <strong>CloudShell</strong>
      <span class="csh__tab">{{ region }}</span>
      <span class="csh__spacer" />
      <button type="button" class="csh__icon" aria-label="Clear" title="Clear" @click="lines = []">Clear</button>
      <button type="button" class="csh__icon" aria-label="Close CloudShell" title="Close" @click="$emit('close')">
        <CsIcon name="close" size="small" />
      </button>
    </header>
    <div ref="screen" class="csh__screen" role="log" tabindex="-1" @click="focus">
      <div v-for="(line, i) in lines" :key="i" class="csh__line" :class="'csh__line--' + line.kind">{{ line.text }}</div>
      <div class="csh__row">
        <span class="csh__prompt">{{ promptText }}</span>
        <input ref="input" v-model="draft" class="csh__input" :disabled="busy" spellcheck="false" autocomplete="off"
               aria-label="CloudShell command" @keydown="onKey" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * AWS CloudShell: a terminal in the console with the AWS CLI already signed in
 * as the console user. Every line is a CLI line the student typed, so each one
 * runs exactly as typed and appears in the equivalent-CLI drawer.
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import CsIcon from './CsIcon.vue';
import { useAws } from './ctx';

defineEmits<{ (e: 'close'): void }>();
const ctx = useAws();
const region = computed(() => ctx.region.value);
const promptText = '[cloudshell-user@ip-10-130-42-7 ~]$ ';
const lines = ref<{ text: string; kind: 'out' | 'err' | 'cmd' | 'info' }[]>([
  { text: 'Preparing your terminal...', kind: 'info' },
  { text: 'Try these commands to get started:', kind: 'info' },
  { text: 'aws help  or  aws <command> help  or  aws <command> --cli-auto-prompt', kind: 'info' },
]);
const draft = ref('');
const busy = ref(false);
const history = ref<string[]>([]);
const cursor = ref(-1);
const screen = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);

function push(text: string, kind: 'out' | 'err' | 'cmd' | 'info') {
  if (!text) return;
  for (const part of text.split('\n')) lines.value.push({ text: part, kind });
  if (lines.value.length > 500) lines.value.splice(0, lines.value.length - 500);
}
function focus() {
  if (!window.getSelection()?.toString()) input.value?.focus();
}
async function down() {
  await nextTick();
  if (screen.value) screen.value.scrollTop = screen.value.scrollHeight;
  input.value?.focus();
}
async function submit() {
  const line = draft.value.trim();
  draft.value = '';
  cursor.value = -1;
  push(promptText + line, 'cmd');
  if (!line) { down(); return; }
  history.value.push(line);
  if (line === 'clear') { lines.value = []; down(); return; }
  busy.value = true;
  const result = await ctx.run(line, '', { quiet: true });
  busy.value = false;
  push(String(result.output || ''), 'out');
  if (!result.ok || result.error) push(String(result.error || ''), 'err');
  down();
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter') { event.preventDefault(); submit(); }
  else if (event.key === 'ArrowUp' && history.value.length) {
    event.preventDefault();
    cursor.value = cursor.value < 0 ? history.value.length - 1 : Math.max(0, cursor.value - 1);
    draft.value = history.value[cursor.value];
  } else if (event.key === 'ArrowDown' && cursor.value >= 0) {
    event.preventDefault();
    cursor.value += 1;
    if (cursor.value >= history.value.length) { cursor.value = -1; draft.value = ''; } else draft.value = history.value[cursor.value];
  } else if (event.ctrlKey && (event.key === 'l' || event.key === 'L')) { event.preventDefault(); lines.value = []; }
}
onMounted(() => input.value?.focus());
</script>

<style scoped>
.csh { flex: none; height: 280px; display: flex; flex-direction: column; border-top: 2px solid #ff9900; background: #0f141a; }
.csh__bar { display: flex; align-items: center; gap: 12px; padding: 4px 12px; background: #232f3e; color: #fff; font-size: 13px; }
.csh__tab { padding: 2px 10px; border-radius: 4px; background: #0f141a; font-size: 12px; }
.csh__spacer { flex: 1; }
.csh__icon { display: inline-flex; align-items: center; border: 0; background: none; color: #d1d5db; font: inherit; font-size: 12px; cursor: pointer; padding: 2px 6px; border-radius: 4px; }
.csh__icon:hover { color: #fff; background: #414d5c; }
.csh__screen { flex: 1; min-height: 0; overflow: auto; padding: 6px 12px; color: #e9ebed; font-family: Monaco, Menlo, Consolas, 'Courier New', monospace; font-size: 13px; line-height: 18px; outline: none; cursor: text; }
.csh__line { white-space: pre-wrap; word-break: break-word; min-height: 18px; }
.csh__line--err { color: #ff8a80; }
.csh__line--info { color: #9ba7b6; }
.csh__row { display: flex; align-items: baseline; flex-wrap: wrap; }
.csh__prompt { white-space: pre; color: #7ed08a; }
.csh__input { flex: 1 1 120px; min-width: 40px; border: 0; outline: none; background: transparent; color: #e9ebed; font: inherit; padding: 0; caret-color: #e9ebed; }
@container sl-portal (max-width: 560px) {
  .csh { height: 220px; }
}
</style>
