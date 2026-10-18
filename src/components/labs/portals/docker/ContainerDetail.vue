<template>
  <section class="dd-page cd">
    <div v-if="!row" class="dd-empty">
      <h2>This container no longer exists</h2>
      <button type="button" class="dd-btn dd-btn--primary" @click="$emit('go', { page: 'containers' })">Back to Containers</button>
    </div>
    <template v-else>
      <div class="dd-detail-head">
        <button type="button" class="dd-icon-btn" aria-label="Back" title="Back" @click="$emit('go', { page: 'containers' })">
          <DdIcon name="back" :size="20" />
        </button>
        <DdIcon name="containers" :size="32" :class="row.status === 'running' ? 'is-green' : row.status === 'paused' ? 'is-amber' : 'is-grey'" />
        <div class="dd-detail-title">
          <h1>{{ row.name }}</h1>
          <div class="dd-detail-meta">
            <button type="button" class="dd-link" @click="$emit('go', { page: 'images', id: row.image })">{{ row.image }}</button>
            <span class="dd-mono">{{ row.id }}</span>
            <button type="button" class="cd-copy" title="Copy" aria-label="Copy container ID" @click="copyText(row.full_id || row.id)"><DdIcon name="copy" :size="13" /></button>
            <span v-for="(p, i) in ports" :key="i" class="dd-link">{{ p.host ? `${p.host}:${p.container}` : `${p.container}/${p.proto}` }}</span>
          </div>
        </div>
        <div class="cd-status">
          <span class="dd-muted">STATUS</span>
          <span class="dd-status"><span class="dd-dot" :class="dotClass"></span>{{ statusLabel(row) }}
            <template v-if="row.status === 'running'"> ({{ row.uptime.replace(/^Up /, '') }})</template></span>
        </div>
        <div class="dd-actions-inner cd-actions">
          <button v-if="row.status === 'running' || row.status === 'paused'" type="button" class="dd-icon-btn dd-icon-btn--blue" title="Stop" aria-label="Stop" @click="act(cmd.stop([row.name]), `Stopped ${row.name}`)"><DdIcon name="stop" :size="18" /></button>
          <button v-else type="button" class="dd-icon-btn dd-icon-btn--blue" title="Start" aria-label="Start" @click="act(cmd.start([row.name]), `Started ${row.name}`)"><DdIcon name="play" :size="18" /></button>
          <button v-if="row.status === 'paused'" type="button" class="dd-icon-btn" title="Resume" aria-label="Resume" @click="act(cmd.unpause(row.name), `Resumed ${row.name}`)"><DdIcon name="play" :size="18" /></button>
          <button v-else type="button" class="dd-icon-btn" title="Pause" aria-label="Pause" :disabled="row.status !== 'running'" @click="act(cmd.pause(row.name), `Paused ${row.name}`)"><DdIcon name="pause" :size="18" /></button>
          <button type="button" class="dd-icon-btn" title="Restart" aria-label="Restart" @click="act(cmd.restart([row.name]), `Restarted ${row.name}`)"><DdIcon name="restart" :size="18" /></button>
          <button type="button" class="dd-icon-btn dd-icon-btn--danger" title="Delete" aria-label="Delete" @click="deleting = true"><DdIcon name="trash" :size="18" /></button>
        </div>
      </div>

      <nav class="dd-tabs" aria-label="Container details">
        <button v-for="t in TABS" :key="t.key" type="button" class="dd-tab" :class="{ 'is-active': tab === t.key }"
                @click="setTab(t.key)">{{ t.label }}</button>
      </nav>

      <!-- Logs -->
      <div v-if="tab === 'logs'" class="cd-pane">
        <div class="dd-toolbar">
          <label class="dd-search"><DdIcon name="search" :size="16" /><input v-model="logFilter" type="search" placeholder="Search" aria-label="Search logs" /></label>
          <label class="dd-toggle"><input v-model="stamps" type="checkbox" /><span class="dd-toggle__track"></span>Timestamps</label>
          <span class="dd-spacer"></span>
          <button type="button" class="dd-icon-btn" title="Copy" aria-label="Copy logs" @click="copyText(logLines.join('\n'))"><DdIcon name="copy" /></button>
          <button type="button" class="dd-icon-btn" title="Clear terminal" aria-label="Clear terminal" @click="cleared = logLines.length + clearedBase"><DdIcon name="trash" /></button>
          <button type="button" class="dd-icon-btn" title="Refresh" aria-label="Refresh logs" @click="fetchLogs"><DdIcon name="refresh" /></button>
        </div>
        <pre class="dd-pre cd-logs dd-box">{{ shownLogs || 'No logs to show.' }}</pre>
      </div>

      <!-- Inspect -->
      <div v-else-if="tab === 'inspect'" class="cd-pane">
        <div class="dd-toolbar">
          <span class="dd-muted">docker inspect {{ row.name }}</span>
          <span class="dd-spacer"></span>
          <button type="button" class="dd-icon-btn" title="Copy" aria-label="Copy JSON" @click="copyText(inspectText)"><DdIcon name="copy" /></button>
        </div>
        <pre class="dd-pre dd-box cd-json">{{ inspectText || 'Loading…' }}</pre>
      </div>

      <!-- Bind mounts -->
      <div v-else-if="tab === 'mounts'" class="cd-pane">
        <div v-if="!mounts.length" class="dd-empty"><h2>No bind mounts or volumes</h2>
          <p>Data written inside this container lives in its writable layer and is lost when it is deleted. Mount a volume with <span class="dd-mono">-v name:/path</span>.</p></div>
        <div v-else class="dd-table-wrap">
          <table class="dd-table">
            <thead><tr><th>Type</th><th>Source</th><th>Destination</th><th>Mode</th></tr></thead>
            <tbody>
              <tr v-for="(m, i) in mounts" :key="i">
                <td><span class="dd-chip">{{ m.type }}</span></td>
                <td>
                  <button v-if="m.type === 'volume'" type="button" class="dd-link" @click="$emit('go', { page: 'volumes', id: m.source })">{{ m.source.length > 30 ? m.source.slice(0, 12) + '…' : m.source }}</button>
                  <span v-else class="dd-mono">{{ m.source }}</span>
                </td>
                <td class="dd-mono">{{ m.target }}</td>
                <td>{{ m.mode }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Exec -->
      <div v-else-if="tab === 'exec'" class="cd-pane">
        <div v-if="row.status !== 'running'" class="dd-empty"><h2>Container is not running</h2><p>Start the container to run commands in it.</p></div>
        <div v-else class="cd-term" @click="focusExec">
          <div v-for="(line, i) in execLines" :key="i" :class="line.kind">{{ line.text }}</div>
          <form class="cd-term__prompt" @submit.prevent>
            <span># </span>
            <input ref="execInput" v-model="execDraft" spellcheck="false" autocomplete="off" aria-label="Command" @keydown.enter.prevent="runExec" />
          </form>
        </div>
      </div>

      <!-- Files -->
      <div v-else-if="tab === 'files'" class="cd-pane">
        <div v-if="row.status !== 'running'" class="dd-empty"><h2>Container is not running</h2><p>Start the container to browse its files.</p></div>
        <template v-else>
          <div class="dd-toolbar">
            <button type="button" class="dd-icon-btn" aria-label="Up" title="Up" :disabled="cwd === '/'" @click="openDir(parent(cwd))"><DdIcon name="back" /></button>
            <input v-model="pathDraft" class="dd-input dd-mono cd-path" aria-label="Path" spellcheck="false"
                   @keydown.enter="openDir(pathDraft.trim() || '/')" />
            <span class="dd-spacer"></span>
            <button type="button" class="dd-btn dd-btn--ghost" @click="newFile"><DdIcon name="plus" :size="14" /> New file</button>
          </div>
          <div class="cd-files">
            <ul class="cd-tree dd-box">
              <li v-if="!entries.length" class="dd-muted cd-tree__none">Empty directory</li>
              <li v-for="name in entries" :key="name">
                <button type="button" class="cd-tree__item" :class="{ 'is-open': openFile === join(cwd, name) }" @click="openEntry(name)">
                  <DdIcon :name="guessDir(name) ? 'folder' : 'file'" :size="15" />{{ name }}
                </button>
              </li>
            </ul>
            <div v-if="openFile" class="cd-editor dd-box">
              <div class="cd-editor__bar">
                <span class="dd-mono">{{ openFile }}</span>
                <span class="dd-spacer"></span>
                <button type="button" class="dd-btn dd-btn--ghost" @click="deleteFile">Delete</button>
                <button type="button" class="dd-btn dd-btn--primary" :disabled="busy" @click="saveFile">Save</button>
              </div>
              <textarea v-model="fileBody" class="dd-textarea cd-editor__text" rows="12" aria-label="File contents"></textarea>
            </div>
          </div>
        </template>
      </div>

      <!-- Stats -->
      <div v-else class="cd-pane">
        <div v-if="row.status !== 'running'" class="dd-empty"><h2>No stats available</h2><p>Stats are only shown for running containers.</p></div>
        <div v-else class="cd-stats">
          <MiniChart label="CPU usage" unit="%" :points="series('c' + row.id, row.cpu || 0, 100)" :max="Math.max(4, (row.cpu || 0) * 2)" />
          <MiniChart label="Memory usage" unit="MB" :points="series('m' + row.id, row.mem_mib || 0, 8000)" :max="Math.max(64, (row.mem_mib || 0) * 1.6)" />
          <MiniChart label="Network I/O (received)" unit="kB" :points="series('n' + row.id, row.net_rx_kb || 0, 1e5)" :max="Math.max(100, (row.net_rx_kb || 0) * 1.6)" />
          <MiniChart label="PIDs" unit="" :points="series('p' + row.id, row.pids || 0, 100)" :max="Math.max(4, (row.pids || 0) * 2)" />
        </div>
      </div>
    </template>

    <DdModal v-if="deleting && row" title="Delete container?" @close="deleting = false">
      <p>The container <b>{{ row.name }}</b> will be permanently deleted. Any data not stored in a volume is lost.</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="deleting = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="confirmDelete">Delete forever</button>
      </template>
    </DdModal>
    <DdModal v-if="naming" title="New file" @close="naming = false">
      <div class="dd-field"><label for="cd-nf">File name</label>
        <input id="cd-nf" v-model="newName" class="dd-input" placeholder="notes.txt" /></div>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="naming = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--primary" :disabled="!newName.trim() || newName.includes('/')" @click="createFile">Create</button>
      </template>
    </DdModal>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import DdModal from './DdModal.vue';
import MiniChart from './MiniChart.vue';
import { cmd, containers, copyText, portPairs, series, statusLabel, type DdRoute } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
const emit = defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();

const TABS = [
  { key: 'logs', label: 'Logs' }, { key: 'inspect', label: 'Inspect' }, { key: 'mounts', label: 'Bind mounts' },
  { key: 'exec', label: 'Exec' }, { key: 'files', label: 'Files' }, { key: 'stats', label: 'Stats' },
];

const row = computed(() => containers(props.view).find(c => c.name === props.route.id || c.id === props.route.id));
const tab = computed(() => props.route.tab || 'logs');
const ports = computed(() => row.value ? portPairs(row.value) : []);
const mounts = computed(() => row.value?.mount_list || []);
const dotClass = computed(() => row.value?.status === 'running' ? 'dd-dot--green'
  : row.value?.status === 'paused' ? 'dd-dot--amber' : '');
const deleting = ref(false);

function setTab(key: string) { emit('go', { page: 'containers', id: props.route.id, tab: key }); }

async function act(command: string, success: string) { return props.api.exec(command, { success }); }

async function confirmDelete() {
  if (!row.value) return;
  const live = row.value.status === 'running' || row.value.status === 'paused';
  const name = row.value.name;
  const result = await act(cmd.rm([name], live), `Deleted ${name}`);
  if (result.ok) { deleting.value = false; emit('go', { page: 'containers' }); }
}

/* ---- logs ---- */
const fetched = ref<string[] | null>(null);
const logFilter = ref('');
const stamps = ref(false);
const cleared = ref(0);
const clearedBase = 0;
const logLines = computed(() => fetched.value ?? row.value?.all_logs ?? row.value?.logs ?? []);
const shownLogs = computed(() => logLines.value.slice(cleared.value)
  .filter(line => !logFilter.value || line.toLowerCase().includes(logFilter.value.toLowerCase()))
  .map((line, i) => stamps.value ? `${new Date(Date.now() - (logLines.value.length - i) * 1000).toISOString()} ${line}` : line)
  .join('\n'));
async function fetchLogs() {
  if (!row.value) return;
  const result = await props.api.exec(cmd.logs(row.value.name), {});
  if (result.ok) { fetched.value = String(result.output || '').split('\n'); cleared.value = 0; }
}

/* ---- inspect ---- */
const inspectText = ref('');
async function fetchInspect() {
  if (!row.value) return;
  const result = await props.api.exec(cmd.inspect(row.value.name), {});
  inspectText.value = result.ok ? String(result.output || '') : '';
}

/* ---- exec ---- */
const execLines = ref<{ kind: string; text: string }[]>([]);
const execDraft = ref('');
const execInput = ref<HTMLInputElement | null>(null);
function focusExec() { execInput.value?.focus(); }
async function runExec() {
  const line = execDraft.value.trim();
  if (!line || !row.value) return;
  execDraft.value = '';
  execLines.value.push({ kind: 'is-cmd', text: `# ${line}` });
  if (line === 'clear') { execLines.value = []; return; }
  const result = await props.api.exec(cmd.exec(row.value.name, line), { quiet: true });
  const text = String((result.ok ? result.output : result.error || result.output) || '').replace(/\s+$/, '');
  if (text) for (const t of text.split('\n')) execLines.value.push({ kind: result.ok ? '' : 'is-err', text: t });
  await nextTick();
  focusExec();
}

/* ---- files ---- */
const cwd = ref('/');
const pathDraft = ref('/');
watch(cwd, value => { pathDraft.value = value; });
const entries = ref<string[]>([]);
const knownDirs = ref(new Set<string>(['bin', 'boot', 'dev', 'etc', 'home', 'lib', 'media', 'mnt', 'opt', 'proc', 'root', 'run', 'sbin', 'srv', 'sys', 'tmp', 'usr', 'var']));
const openFile = ref('');
const fileBody = ref('');
const naming = ref(false);
const newName = ref('');

function join(dir: string, name: string) { return (dir.endsWith('/') ? dir : dir + '/') + name; }
function parent(path: string) { const cut = path.replace(/\/+$/, '').split('/').slice(0, -1).join('/'); return cut || '/'; }
function guessDir(name: string) { return knownDirs.value.has(join(cwd.value, name)) || (cwd.value === '/' && knownDirs.value.has(name)) || !name.includes('.'); }

async function openDir(path: string) {
  if (!row.value) return;
  const result = await props.api.exec(cmd.ls(row.value.name, path), { quiet: true, unlogged: true });
  const out = String(result.output || '');
  if (!result.ok) {
    props.api.notify('error', 'Could not open the directory', String(result.error || out));
    return;
  }
  cwd.value = path;
  /* A directory the simulated image has no listing for reads as empty. */
  entries.value = /No such file/.test(out) ? []
    : out.split('\n').map(s => s.trim()).filter(Boolean);
  openFile.value = '';
}

async function openEntry(name: string) {
  if (!row.value) return;
  const path = join(cwd.value, name);
  const result = await props.api.exec(cmd.cat(row.value.name, path), { quiet: true, unlogged: true });
  if (result.ok) {
    openFile.value = path;
    fileBody.value = String(result.output || '');
    return;
  }
  knownDirs.value.add(path);
  await openDir(path);
}

async function saveFile() {
  if (!row.value || !openFile.value) return;
  await props.api.exec(cmd.write(row.value.name, openFile.value, fileBody.value), { success: `Saved ${openFile.value}` });
}
async function deleteFile() {
  if (!row.value || !openFile.value) return;
  const result = await props.api.exec(cmd.rmFile(row.value.name, openFile.value), { success: `Deleted ${openFile.value}` });
  if (result.ok) await openDir(cwd.value);
}
function newFile() { newName.value = ''; naming.value = true; }
async function createFile() {
  if (!row.value) return;
  const path = join(cwd.value, newName.value.trim());
  const result = await props.api.exec(cmd.write(row.value.name, path, ''), { success: `Created ${path}` });
  if (result.ok) {
    naming.value = false;
    await openDir(cwd.value);
    openFile.value = path;
    fileBody.value = '';
  }
}

watch(() => [props.route.id, tab.value] as const, async ([, current], previous) => {
  if (!row.value) return;
  const changedContainer = !previous || previous[0] !== props.route.id;
  if (changedContainer) { fetched.value = null; inspectText.value = ''; execLines.value = []; cwd.value = '/'; entries.value = []; }
  if (current === 'logs' && (changedContainer || fetched.value === null)) await fetchLogs();
  if (current === 'inspect') await fetchInspect();
  if (current === 'files' && row.value.status === 'running' && !entries.value.length) await openDir(cwd.value);
  if (current === 'exec') { await nextTick(); focusExec(); }
}, { immediate: true });
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.cd { height: 100%; box-sizing: border-box; }
.dd-spacer { flex: 1; }
.is-green { color: var(--dd-green); }
.is-amber { color: var(--dd-amber); }
.is-grey { color: var(--dd-grey-dot); }
.cd-copy { border: 0; background: none; color: var(--dd-text-2); cursor: pointer; padding: 2px; }
.cd-status { display: flex; flex-direction: column; gap: 2px; font-size: 12px; padding-right: 8px; }
.cd-actions { align-self: center; }
.cd-pane { display: flex; flex-direction: column; gap: 10px; min-height: 0; flex: 1; }
.cd-logs, .cd-json { max-height: 460px; min-height: 220px; background: #FAFAFB; }
.cd-term { background: #0C0D10; color: #E6E8EC; border-radius: 6px; padding: 10px 12px; font: 13px/1.5 var(--dd-mono); min-height: 260px; max-height: 460px; overflow: auto; white-space: pre-wrap; word-break: break-word; cursor: text; }
.cd-term .is-err { color: #FF7B86; }
.cd-term .is-cmd { color: #9CC3FF; }
.cd-term__prompt { display: flex; gap: 4px; }
.cd-term__prompt input:focus, .cd-term__prompt input:focus-visible { outline: none; box-shadow: none; border: 0; }
.cd-term__prompt input { flex: 1; border: 0; box-shadow: none; padding: 0; background: transparent; border: 0; outline: none; color: inherit; font: inherit; caret-color: #fff; min-width: 0; }
.cd-path { flex: 1 1 260px; max-width: 520px; background: var(--dd-hover); }
.cd-files { display: grid; grid-template-columns: minmax(180px, 260px) minmax(0, 1fr); gap: 12px; align-items: start; }
.cd-tree { list-style: none; margin: 0; padding: 4px 0; max-height: 420px; overflow: auto; }
.cd-tree__none { padding: 10px 14px; font-size: 13px; }
.cd-tree__item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 12px; border: 0; background: none; font: inherit; font-size: 13px; color: var(--dd-text); cursor: pointer; text-align: left; }
.cd-tree__item:hover { background: var(--dd-hover); }
.cd-tree__item.is-open { background: var(--dd-blue-tint); color: var(--dd-blue); }
.cd-tree__item svg { color: var(--dd-text-2); }
.cd-editor { display: flex; flex-direction: column; }
.cd-editor__bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--dd-border); flex-wrap: wrap; }
.cd-editor__text { border: 0; border-radius: 0 0 6px 6px; min-height: 240px; }
.cd-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 12px; }
@container sl-portal (max-width: 700px) {
  .cd-files { grid-template-columns: minmax(0, 1fr); }
  .cd-status { display: none; }
  .cd-tree { max-height: 220px; }
}
</style>
