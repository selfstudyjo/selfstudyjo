<template>
  <section class="kd-card kd-io">
    <header class="kd-io__head">
      <template v-if="mode === 'logs'">
        <span class="kd-io__title">Logs from</span>
        <select v-model="container" class="kd-io__select" aria-label="Container">
          <option v-for="c in containers" :key="c" :value="c">{{ c }}</option>
        </select>
        <span class="kd-io__title">in {{ pod.name }}</span>
        <span class="kd-spacer" />
        <button type="button" class="kd-iconbtn" title="Refresh" aria-label="Refresh logs" @click="loadLogs"><KIcon name="restart" /></button>
        <button type="button" class="kd-iconbtn" title="Download logs" aria-label="Download logs" @click="download"><KIcon name="upload" class="kd-flipy" /></button>
      </template>
      <template v-else>
        <span class="kd-io__title">Shell in</span>
        <select v-model="container" class="kd-io__select" aria-label="Container">
          <option v-for="c in containers" :key="c" :value="c">{{ c }}</option>
        </select>
        <span class="kd-io__title">in {{ pod.name }}</span>
      </template>
    </header>
    <div v-if="mode === 'logs'" ref="screen" class="kd-io__screen">
      <div v-if="loading && !logLines.length" class="kd-io__line kd-io__dim">Loading…</div>
      <div v-for="(line, i) in logLines" :key="i" class="kd-io__line">{{ line }}</div>
      <div v-if="!loading && !logLines.length" class="kd-io__line kd-io__dim">The selected container has not logged any messages yet.</div>
    </div>
    <div v-else ref="screen" class="kd-io__screen kd-io__term" @click="focusInput">
      <div v-for="(line, i) in transcript" :key="i" class="kd-io__line" :class="{ 'kd-io__err': line.err }">{{ line.text }}</div>
      <form class="kd-io__prompt" @submit.prevent>
        <span>{{ prompt }}</span>
        <input ref="input" v-model="typed" class="kd-io__input" spellcheck="false" autocomplete="off"
               aria-label="Command to run in the container" :disabled="running" @keydown.enter.prevent="send" />
      </form>
    </div>
    <footer v-if="mode === 'logs'" class="kd-io__foot">
      <span>Logs from {{ pod.createdAt ? formatDate(pod.createdAt) : '-' }} to now</span>
      <span class="kd-spacer" />
      <span>{{ logLines.length }} lines</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
/**
 * The Dashboard's log viewer and its "Exec into pod" terminal. Logs run
 * `kubectl logs`; each terminal line runs `kubectl exec POD -c CONTAINER -- …`
 * (an interactive TTY is not simulated, so each line is one exec, which is
 * also what the equivalent-CLI drawer then shows).
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { errorText } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import KIcon from './KIcon.vue';
import { execCommand, formatDate, logsCommand, splitWords, type Row } from './k8s';

const props = defineProps<{ pod: Row; mode: 'logs' | 'shell'; api: PortalApi }>();

const containers = computed<string[]>(() => ((props.pod.containers || []) as Row[]).map(c => String(c.name || 'app')));
const container = ref(containers.value[0] || 'app');
const logLines = ref<string[]>(((props.pod.logs || []) as unknown[]).map(String));
const loading = ref(false);
const screen = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const typed = ref('');
const running = ref(false);
const transcript = ref<{ text: string; err?: boolean }[]>([]);
const prompt = computed(() => `${props.pod.name}:/# `);

async function loadLogs() {
  loading.value = true;
  const result = await props.api.exec(logsCommand(props.pod.namespace, props.pod.name, container.value), { quiet: true });
  loading.value = false;
  logLines.value = result.ok ? String(result.output || '').split('\n').filter(Boolean) : [errorText(result)];
}

function download() {
  const blob = new Blob([logLines.value.join('\n') + '\n'], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${props.pod.name}.log`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function focusInput() { input.value?.focus(); }

async function send() {
  const line = typed.value.trim();
  if (!line) return;
  typed.value = '';
  transcript.value.push({ text: prompt.value + line });
  if (line === 'clear') { transcript.value = []; return; }
  if (line === 'exit') { transcript.value.push({ text: 'exit' }); return; }
  running.value = true;
  const result = await props.api.exec(execCommand(props.pod.namespace, props.pod.name, container.value, splitWords(line)), { quiet: true });
  running.value = false;
  const text = result.ok ? String(result.output || '') : String(result.error || result.output || '');
  for (const out of text.split('\n')) if (out !== '') transcript.value.push({ text: out, err: !result.ok });
  await nextTick();
  if (screen.value) screen.value.scrollTop = screen.value.scrollHeight;
  focusInput();
}

onMounted(() => {
  if (props.mode === 'logs') void loadLogs();
  else nextTick(focusInput);
});
watch(container, () => { if (props.mode === 'logs') void loadLogs(); });
</script>

<style scoped>
.kd-card { background: #fff; box-shadow: var(--kd-shadow); border-radius: 2px; }
.kd-io { display: flex; flex-direction: column; min-height: 420px; height: 100%; }
.kd-io__head { display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 0 8px 0 20px; flex-wrap: wrap; font-size: 16px; }
.kd-io__title { color: rgb(0 0 0 / 0.87); }
.kd-io__select { border: 0; border-bottom: 1px solid rgb(0 0 0 / 0.42); font: inherit; font-size: 16px; color: var(--kd-primary); background: transparent; padding: 2px 0; }
.kd-spacer { flex: 1; }
.kd-io__screen { flex: 1; min-height: 320px; background: #000; color: #fff; overflow: auto; padding: 12px 16px;
  font: 13px/1.55 'Roboto Mono', Consolas, Menlo, monospace; white-space: pre-wrap; word-break: break-all; }
.kd-io__dim { color: rgb(200 200 200 / 0.66); }
.kd-io__err { color: #ff8a80; }
.kd-io__prompt { display: flex; align-items: center; gap: 0; }
.kd-io__input { flex: 1; border: 0; outline: 0; background: transparent; color: #fff; font: inherit; padding: 0; caret-color: #fff; outline: none; box-shadow: none; }
.kd-io__foot { display: flex; align-items: center; min-height: 40px; padding: 0 20px; font-size: 12px; color: rgb(0 0 0 / 0.54); }
.kd-iconbtn { width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent; color: rgb(0 0 0 / 0.54);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.kd-flipy { transform: scaleY(-1); }
</style>
