<template>
  <section class="kd-card kd-io">
    <header class="kd-io__head">
      <template v-if="mode === 'logs'">
        <span class="kd-io__title">Logs from</span>
        <select v-model="container" class="kd-io__select" aria-label="Container" :disabled="allContainers">
          <option v-for="c in containers" :key="c" :value="c">{{ c }}</option>
        </select>
        <span class="kd-io__title">in {{ pod.name }}</span>
        <span class="kd-spacer" />
        <label class="kd-io__search">
          <KIcon name="search" />
          <input v-model="filter" type="search" placeholder="Filter" aria-label="Filter log lines" />
        </label>
        <button type="button" class="kd-iconbtn" :class="{ 'is-on': follow }" :title="follow ? 'Stop following' : 'Follow logs'"
                :aria-label="follow ? 'Stop following' : 'Follow logs'" :aria-pressed="follow" @click="follow = !follow"><KIcon name="play" /></button>
        <button type="button" class="kd-iconbtn" title="Refresh" aria-label="Refresh logs" @click="loadLogs"><KIcon name="restart" /></button>
        <button type="button" class="kd-iconbtn" title="Download logs" aria-label="Download logs" @click="download"><KIcon name="upload" class="kd-flipy" /></button>
        <div class="kd-io__menuwrap">
          <button type="button" class="kd-iconbtn" title="Log options" aria-label="Log options" :aria-expanded="optionsOpen" @click="optionsOpen = !optionsOpen"><KIcon name="more" /></button>
          <div v-if="optionsOpen" class="kd-io__menu" role="menu">
            <label class="kd-io__opt"><input v-model="timestamps" type="checkbox" /> Show timestamps</label>
            <label class="kd-io__opt"><input v-model="allContainers" type="checkbox" :disabled="containers.length < 2" /> All containers</label>
            <label class="kd-io__opt">Last
              <select v-model.number="tail" class="kd-io__mini" aria-label="Lines">
                <option :value="0">all</option><option :value="20">20</option><option :value="100">100</option><option :value="500">500</option>
              </select> lines</label>
            <label class="kd-io__opt"><input v-model="wrap" type="checkbox" /> Wrap lines</label>
          </div>
        </div>
      </template>
      <template v-else>
        <span class="kd-io__title">Shell in</span>
        <select v-model="container" class="kd-io__select" aria-label="Container">
          <option v-for="c in containers" :key="c" :value="c">{{ c }}</option>
        </select>
        <span class="kd-io__title">in {{ pod.name }}</span>
        <span class="kd-spacer" />
        <button type="button" class="kd-iconbtn" title="Clear" aria-label="Clear terminal" @click="transcript = []"><KIcon name="delete" /></button>
      </template>
    </header>
    <div v-if="mode === 'logs'" ref="screen" class="kd-io__screen" :class="{ 'kd-io__nowrap': !wrap }">
      <div v-if="loading && !logLines.length" class="kd-io__line kd-io__dim">Loading…</div>
      <div v-for="(line, i) in shownLines" :key="i" class="kd-io__line">{{ line }}</div>
      <div v-if="!loading && !logLines.length" class="kd-io__line kd-io__dim">The selected container has not logged any messages yet.</div>
      <div v-else-if="filter && !shownLines.length" class="kd-io__line kd-io__dim">No line matches "{{ filter }}".</div>
    </div>
    <div v-else ref="screen" class="kd-io__screen kd-io__term" @click="focusInput">
      <div v-if="!transcript.length" class="kd-io__line kd-io__dim">Each line runs as kubectl exec {{ pod.name }} -c {{ container }} -- sh -c "…". ↑/↓ history, Tab completes, Ctrl+L clears.</div>
      <div v-for="(line, i) in transcript" :key="i" class="kd-io__line" :class="{ 'kd-io__err': line.err, 'kd-io__cmd': line.cmd }">{{ line.text }}</div>
      <form class="kd-io__prompt" @submit.prevent>
        <span class="kd-io__ps">{{ prompt }}</span>
        <input ref="input" v-model="typed" class="kd-io__input" spellcheck="false" autocomplete="off"
               aria-label="Command to run in the container" :disabled="running"
               @keydown.enter.prevent="send" @keydown.up.prevent="older" @keydown.down.prevent="newer"
               @keydown.tab.prevent="complete" @keydown.ctrl.l.prevent="transcript = []" @keydown.ctrl.c.prevent="cancel" />
      </form>
    </div>
    <footer v-if="mode === 'logs'" class="kd-io__foot">
      <span>Logs from {{ pod.createdAt ? formatDate(pod.createdAt) : '-' }} to now</span>
      <span v-if="follow" class="kd-io__live">● Following</span>
      <span class="kd-spacer" />
      <span>{{ filter ? `${shownLines.length} of ${logLines.length}` : logLines.length }} lines</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
/**
 * The Dashboard's log viewer and its "Exec into pod" terminal. Logs run
 * `kubectl logs` with the viewer's options (container, --all-containers,
 * --tail, --timestamps); Follow re-reads every few seconds and keeps the view
 * pinned to the bottom. Each terminal line runs `kubectl exec POD -c CONTAINER
 * -- sh -c "…"` against the container shell in app 11, carrying the working
 * directory across lines the way a student would by hand (`cd dir && …`).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { errorText } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import KIcon from './KIcon.vue';
import { formatDate, logsOptionsCommand, shellCommand, type Row } from './k8s';

const props = defineProps<{ pod: Row; mode: 'logs' | 'shell'; api: PortalApi }>();

const containers = computed<string[]>(() => ((props.pod.containers || []) as Row[]).map(c => String(c.name || 'app')));
const container = ref(containers.value[0] || 'app');
const logLines = ref<string[]>(((props.pod.logs || []) as unknown[]).map(String));
const loading = ref(false);
const screen = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);

/* ---- logs ---- */
const filter = ref('');
const follow = ref(false);
const timestamps = ref(false);
const allContainers = ref(false);
const tail = ref(0);
const wrap = ref(true);
const optionsOpen = ref(false);
const shownLines = computed(() => filter.value
  ? logLines.value.filter(l => l.toLowerCase().includes(filter.value.toLowerCase()))
  : logLines.value);
async function loadLogs(poll = false) {
  loading.value = !poll;
  const result = await props.api.exec(logsOptionsCommand(props.pod.namespace, props.pod.name, {
    container: container.value, tail: tail.value, timestamps: timestamps.value, allContainers: allContainers.value,
  }), { quiet: true, unlogged: poll });
  loading.value = false;
  const el = screen.value;
  const atBottom = !el || el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
  logLines.value = result.ok ? String(result.output || '').split('\n').filter(Boolean) : [errorText(result)];
  await nextTick();
  if ((atBottom || follow.value) && screen.value) screen.value.scrollTop = screen.value.scrollHeight;
}

function download() {
  const blob = new Blob([logLines.value.join('\n') + '\n'], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${props.pod.name}${allContainers.value ? '' : '-' + container.value}.log`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

let timer: number | undefined;
watch(follow, on => {
  window.clearInterval(timer);
  timer = undefined;
  if (on) {
    void loadLogs();
    timer = window.setInterval(() => { void loadLogs(true); }, 3000);
  }
});
onBeforeUnmount(() => window.clearInterval(timer));

/* ---- shell ---- */
const typed = ref('');
const running = ref(false);
const transcript = ref<{ text: string; err?: boolean; cmd?: boolean }[]>([]);
const cwd = ref('/');
const recall: string[] = [];
let cursor = -1;
const prompt = computed(() => `root@${props.pod.name}:${cwd.value}# `);

function focusInput() { input.value?.focus(); }
async function scroll() {
  await nextTick();
  if (screen.value) screen.value.scrollTop = screen.value.scrollHeight;
  focusInput();
}

async function send() {
  const line = typed.value.trim();
  transcript.value.push({ text: prompt.value + typed.value, cmd: true });
  typed.value = '';
  if (!line) { await scroll(); return; }
  recall.unshift(line);
  cursor = -1;
  if (line === 'clear') { transcript.value = []; return; }
  if (line === 'exit') { transcript.value.push({ text: 'exit' }); await scroll(); return; }
  running.value = true;
  const result = await props.api.exec(shellCommand(props.pod.namespace, props.pod.name, container.value, cwd.value, line), { quiet: true });
  running.value = false;
  const data = result.data as { cwd?: unknown } | undefined;
  if (data && typeof data.cwd === 'string' && data.cwd) cwd.value = data.cwd;
  const out = String(result.output || '').replace(/\s+$/, '');
  const err = String(result.error || '').replace(/\s+$/, '');
  for (const text of out ? out.split('\n') : []) transcript.value.push({ text });
  for (const text of err ? err.split('\n') : []) transcript.value.push({ text, err: true });
  transcript.value = transcript.value.slice(-600);
  await scroll();
}

function older() {
  if (cursor < recall.length - 1) cursor += 1;
  if (recall[cursor] !== undefined) typed.value = recall[cursor];
}
function newer() {
  cursor = Math.max(-1, cursor - 1);
  typed.value = cursor < 0 ? '' : recall[cursor];
}
function cancel() {
  transcript.value.push({ text: prompt.value + typed.value + '^C', cmd: true });
  typed.value = '';
}

/** Tab: list the directory the last word points into (unlogged) and complete it. */
async function complete() {
  const cut = typed.value.search(/\S*$/);
  const last = typed.value.slice(cut);
  const slash = last.lastIndexOf('/');
  const dir = slash >= 0 ? (last.slice(0, slash + 1) || '/') : '.';
  const stem = slash >= 0 ? last.slice(slash + 1) : last;
  const result = await props.api.exec(shellCommand(props.pod.namespace, props.pod.name, container.value, cwd.value, `ls -Ap ${dir}`),
    { quiet: true, unlogged: true });
  if (!result.ok) return;
  const hits = String(result.output || '').split('\n').filter(n => n && n.startsWith(stem) && (stem.startsWith('.') || !n.startsWith('.')));
  if (!hits.length) return;
  let prefix = hits[0];
  for (const hit of hits.slice(1)) while (!hit.startsWith(prefix)) prefix = prefix.slice(0, -1);
  const head = slash >= 0 ? last.slice(0, slash + 1) : '';
  if (hits.length === 1) typed.value = typed.value.slice(0, cut) + head + prefix + (prefix.endsWith('/') ? '' : ' ');
  else if (prefix.length > stem.length) typed.value = typed.value.slice(0, cut) + head + prefix;
  else {
    transcript.value.push({ text: prompt.value + typed.value, cmd: true }, { text: hits.join('  ') });
    await scroll();
  }
}

onMounted(() => {
  if (props.mode === 'logs') void loadLogs();
  else nextTick(focusInput);
});
watch([container, timestamps, allContainers, tail], () => { if (props.mode === 'logs') void loadLogs(); });
watch(container, () => { if (props.mode === 'shell') { cwd.value = '/'; transcript.value.push({ text: `--- now in container ${container.value} ---` }); } });
</script>

<style scoped>
.kd-card { background: #fff; box-shadow: var(--kd-shadow); border-radius: 2px; }
.kd-io { display: flex; flex-direction: column; min-height: 420px; height: 100%; }
.kd-io__head { display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 0 8px 0 20px; flex-wrap: wrap; font-size: 16px; }
.kd-io__title { color: rgb(0 0 0 / 0.87); }
.kd-io__select { border: 0; border-bottom: 1px solid rgb(0 0 0 / 0.42); font: inherit; font-size: 16px; color: var(--kd-primary); background: transparent; padding: 2px 0; }
.kd-spacer { flex: 1; }
.kd-io__search { display: inline-flex; align-items: center; gap: 4px; border-bottom: 1px solid rgb(0 0 0 / 0.42); color: rgb(0 0 0 / 0.54); }
.kd-io__search input { border: 0; outline: none; box-shadow: none; font: inherit; font-size: 14px; width: 140px; background: transparent; padding: 4px 0; color: rgb(0 0 0 / 0.87); }
.kd-io__menuwrap { position: relative; }
.kd-io__menu { position: absolute; right: 0; top: 42px; z-index: 5; background: #fff; border-radius: 4px; min-width: 210px; padding: 8px 0;
  box-shadow: 0 2px 4px -1px rgb(0 0 0 / 0.2), 0 4px 5px 0 rgb(0 0 0 / 0.14), 0 1px 10px 0 rgb(0 0 0 / 0.12); }
.kd-io__opt { display: flex; align-items: center; gap: 8px; padding: 8px 16px; font-size: 14px; color: rgb(0 0 0 / 0.87); cursor: pointer; }
.kd-io__opt:hover { background: rgb(0 0 0 / 0.04); }
.kd-io__mini { font: inherit; font-size: 14px; border: 0; border-bottom: 1px solid rgb(0 0 0 / 0.42); background: transparent; }
.kd-io__screen { flex: 1; min-height: 320px; background: #000; color: #fff; overflow: auto; padding: 12px 16px;
  font: 13px/1.55 'Roboto Mono', Consolas, Menlo, monospace; white-space: pre-wrap; word-break: break-all; }
.kd-io__nowrap { white-space: pre; word-break: normal; }
.kd-io__dim { color: rgb(200 200 200 / 0.66); }
.kd-io__err { color: #ff8a80; }
.kd-io__cmd { color: #c5e1a5; }
.kd-io__prompt { display: flex; align-items: center; gap: 0; }
.kd-io__ps { color: #c5e1a5; white-space: pre; flex: none; }
.kd-io__input { flex: 1; border: 0; outline: 0; background: transparent; color: #fff; font: inherit; padding: 0; caret-color: #fff; outline: none; box-shadow: none; min-width: 0; }
.kd-io__foot { display: flex; align-items: center; gap: 16px; min-height: 40px; padding: 0 20px; font-size: 12px; color: rgb(0 0 0 / 0.54); }
.kd-io__live { color: var(--kd-primary); font-weight: 500; }
.kd-iconbtn { width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent; color: rgb(0 0 0 / 0.54);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.kd-iconbtn:hover { background: rgb(0 0 0 / 0.04); }
.kd-iconbtn.is-on { color: var(--kd-primary); background: rgb(50 108 229 / 0.1); }
.kd-flipy { transform: scaleY(-1); }
</style>
