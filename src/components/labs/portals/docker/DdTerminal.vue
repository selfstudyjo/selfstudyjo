<template>
  <section class="dd-term" aria-label="Terminal">
    <header class="dd-term__bar">
      <span class="dd-term__tab"><DdIcon name="terminal" :size="14" /> Terminal</span>
      <button type="button" class="dd-term__btn" title="Clear terminal" aria-label="Clear terminal" @click="lines = []">
        <DdIcon name="trash" :size="14" />
      </button>
      <button type="button" class="dd-term__btn" title="Close" aria-label="Close terminal" @click="$emit('close')">
        <DdIcon name="close" :size="14" />
      </button>
    </header>
    <div ref="screen" class="dd-term__screen" @click="focus">
      <div v-for="(line, index) in lines" :key="index" :class="line.kind">{{ line.text }}</div>
      <form class="dd-term__prompt" @submit.prevent>
        <span>PS C:\Users\student&gt;</span>
        <input ref="input" v-model="draft" spellcheck="false" autocomplete="off" aria-label="Command"
               :disabled="running" @keydown.enter.prevent="submit" @keydown.up.prevent="older" @keydown.down.prevent="newer" />
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
/** Docker Desktop's built-in terminal: a command line straight to the engine. */
import { nextTick, onMounted, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';

const props = defineProps<{ api: PortalApi }>();
defineEmits<{ (event: 'close'): void }>();

const lines = ref<{ kind: string; text: string }[]>([
  { kind: 'is-dim', text: 'Windows PowerShell — docker and docker compose talk to the Docker Desktop engine.' },
]);
const draft = ref('');
const running = ref(false);
const recall: string[] = [];
let cursor = -1;
const screen = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);

function focus() { input.value?.focus(); }

async function submit() {
  const command = draft.value.trim();
  if (!command) return;
  lines.value.push({ kind: 'is-cmd', text: `PS C:\\Users\\student> ${command}` });
  draft.value = '';
  recall.unshift(command);
  cursor = -1;
  if (command === 'clear' || command === 'cls') {
    lines.value = [];
    return;
  }
  running.value = true;
  const result = await props.api.exec(command, { quiet: true });
  running.value = false;
  const text = String((result.ok ? result.output : (result.error || result.output)) || '').replace(/\s+$/, '');
  if (text) for (const line of text.split('\n')) lines.value.push({ kind: result.ok ? '' : 'is-err', text: line });
  lines.value = lines.value.slice(-400);
  await nextTick();
  if (screen.value) screen.value.scrollTop = screen.value.scrollHeight;
  focus();
}

function older() {
  if (cursor < recall.length - 1) cursor += 1;
  draft.value = recall[cursor] || draft.value;
}
function newer() {
  cursor = Math.max(-1, cursor - 1);
  draft.value = cursor < 0 ? '' : recall[cursor];
}

onMounted(focus);
</script>

<style scoped>
.dd-term { display: grid; grid-template-rows: 32px minmax(0, 1fr); border-top: 1px solid var(--dd-border); background: #0C0D10; min-height: 0; }
.dd-term__bar { display: flex; align-items: center; gap: 4px; padding: 0 6px 0 10px; background: #1B1D22; color: #C9CED8; font-size: 12px; }
.dd-term__tab { display: inline-flex; align-items: center; gap: 6px; margin-right: auto; }
.dd-term__btn { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 4px; background: none; color: #C9CED8; cursor: pointer; }
.dd-term__btn:hover { background: #2A2D34; }
.dd-term__screen { overflow: auto; padding: 8px 12px; font: 13px/1.5 var(--dd-mono); color: #E6E8EC; white-space: pre-wrap; word-break: break-word; cursor: text; }
.is-dim { color: #7D8594; }
.is-cmd { color: #E6E8EC; }
.is-err { color: #FF7B86; }
.dd-term__prompt { display: flex; gap: 6px; align-items: center; }
.dd-term__prompt span { color: #E6E8EC; flex: none; }
.dd-term__prompt input:focus, .dd-term__prompt input:focus-visible { outline: none; box-shadow: none; }
.dd-term__prompt input { flex: 1; padding: 0; box-shadow: none; min-width: 0; background: transparent; border: 0; outline: none; color: #E6E8EC; font: inherit; caret-color: #E6E8EC; }
</style>
