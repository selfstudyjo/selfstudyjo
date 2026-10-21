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
          <label class="dd-toggle"><input v-model="stamps" type="checkbox" @change="fetchLogs" /><span class="dd-toggle__track"></span>Timestamps</label>
          <label class="dd-toggle" title="Re-read the log every few seconds"><input v-model="follow" type="checkbox" /><span class="dd-toggle__track"></span>Follow</label>
          <label class="cd-tail">Lines
            <select v-model.number="tail" class="dd-select cd-tail__box" aria-label="Lines to show" @change="fetchLogs">
              <option :value="0">All</option><option :value="50">50</option><option :value="100">100</option><option :value="500">500</option>
            </select>
          </label>
          <span class="dd-spacer"></span>
          <span v-if="logFilter" class="dd-muted cd-hits">{{ hitCount }} match{{ hitCount === 1 ? '' : 'es' }}</span>
          <button type="button" class="dd-icon-btn" title="Copy" aria-label="Copy logs" @click="copyText(visibleLogs.join('\n'))"><DdIcon name="copy" /></button>
          <button type="button" class="dd-icon-btn" title="Download" aria-label="Download logs" @click="download(`${row.name}.log`, visibleLogs.join('\n'))"><DdIcon name="download" /></button>
          <button type="button" class="dd-icon-btn" title="Clear terminal" aria-label="Clear terminal" @click="cleared = logLines.length"><DdIcon name="trash" /></button>
          <button type="button" class="dd-icon-btn" title="Refresh" aria-label="Refresh logs" @click="fetchLogs"><DdIcon name="refresh" /></button>
        </div>
        <div ref="logBox" class="dd-pre cd-logs dd-box" role="log" aria-live="off">
          <div v-if="!visibleLogs.length" class="dd-muted">No logs to show.</div>
          <div v-for="(line, i) in visibleLogs" :key="i" class="cd-logline" :class="logClass(line)">{{ line }}</div>
        </div>
      </div>

      <!-- Inspect -->
      <div v-else-if="tab === 'inspect'" class="cd-pane">
        <div class="dd-toolbar">
          <span class="dd-muted">docker inspect {{ row.name }}</span>
          <span class="dd-spacer"></span>
          <label class="dd-search"><DdIcon name="search" :size="16" /><input v-model="inspectFilter" type="search" placeholder="Search" aria-label="Search the JSON" /></label>
          <button type="button" class="dd-icon-btn" title="Copy" aria-label="Copy JSON" @click="copyText(inspectText)"><DdIcon name="copy" /></button>
          <button type="button" class="dd-icon-btn" title="Refresh" aria-label="Refresh" @click="fetchInspect"><DdIcon name="refresh" /></button>
        </div>
        <pre class="dd-pre dd-box cd-json">{{ inspectShown || 'Loading…' }}</pre>
      </div>

      <!-- Bind mounts -->
      <div v-else-if="tab === 'mounts'" class="cd-pane">
        <div v-if="!mounts.length" class="dd-empty"><h2>No bind mounts or volumes</h2>
          <p>Data written inside this container lives in its writable layer and is lost when it is deleted. Mount a volume with <span class="dd-mono">-v name:/path</span>.</p></div>
        <div v-else class="dd-table-wrap">
          <table class="dd-table">
            <thead><tr><th>Type</th><th>Source</th><th>Destination</th><th>Mode</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(m, i) in mounts" :key="i">
                <td><span class="dd-chip">{{ m.type }}</span></td>
                <td>
                  <button v-if="m.type === 'volume'" type="button" class="dd-link" @click="$emit('go', { page: 'volumes', id: m.source })">{{ m.source.length > 30 ? m.source.slice(0, 12) + '…' : m.source }}</button>
                  <span v-else class="dd-mono">{{ m.source }}</span>
                </td>
                <td class="dd-mono">{{ m.target }}</td>
                <td>{{ m.mode }}</td>
                <td class="dd-actions">
                  <button type="button" class="dd-link" :disabled="row.status !== 'running'" @click="browseMount(m.target)">Open in Files</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Exec -->
      <div v-else-if="tab === 'exec'" class="cd-pane">
        <div v-if="row.status !== 'running'" class="dd-empty"><h2>Container is not running</h2><p>Start the container to run commands in it.</p></div>
        <template v-else>
          <div class="dd-toolbar cd-exec-bar">
            <span class="dd-muted">docker exec -it {{ row.name }} sh</span>
            <span class="dd-spacer"></span>
            <button type="button" class="dd-icon-btn" title="Copy" aria-label="Copy terminal output" @click="copyText(execLines.map(l => l.text).join('\n'))"><DdIcon name="copy" /></button>
            <button type="button" class="dd-icon-btn" title="Clear terminal" aria-label="Clear terminal" @click="execLines = []"><DdIcon name="trash" /></button>
          </div>
          <div ref="execScreen" class="cd-term" @click="focusExec">
            <div v-for="(line, i) in execLines" :key="i" :class="line.kind">{{ line.text }}</div>
            <form class="cd-term__prompt" @submit.prevent>
              <span class="cd-term__ps">{{ promptText }}</span>
              <input ref="execInput" v-model="execDraft" spellcheck="false" autocomplete="off" aria-label="Command"
                     :disabled="execRunning"
                     @keydown.enter.prevent="runExec" @keydown.up.prevent="recallOlder" @keydown.down.prevent="recallNewer"
                     @keydown.tab.prevent="complete" @keydown.ctrl.l.prevent="execLines = []" @keydown.ctrl.c.prevent="cancelLine" />
            </form>
          </div>
          <p class="dd-muted cd-hint">Each line runs as <span class="dd-mono">docker exec -w &lt;dir&gt; {{ row.name }} sh -c "…"</span> - pipes, redirects, <span class="dd-mono">cd</span>, Tab completion and ↑/↓ history work.</p>
        </template>
      </div>

      <!-- Files -->
      <div v-else-if="tab === 'files'" class="cd-pane">
        <div v-if="row.status !== 'running'" class="dd-empty"><h2>Container is not running</h2><p>Start the container to browse its files.</p></div>
        <template v-else>
          <div class="dd-toolbar">
            <button type="button" class="dd-icon-btn" aria-label="Up" title="Up" :disabled="cwd === '/'" @click="openDir(parent(cwd))"><DdIcon name="back" /></button>
            <input v-model="pathDraft" class="dd-input dd-mono cd-path" aria-label="Path" spellcheck="false"
                   @keydown.enter="openDir(normPath(pathDraft.trim() || '/'))" />
            <button type="button" class="dd-icon-btn" title="Refresh" aria-label="Refresh" @click="openDir(cwd)"><DdIcon name="refresh" /></button>
            <span class="dd-spacer"></span>
            <button type="button" class="dd-btn dd-btn--ghost" @click="ask('file')"><DdIcon name="file" :size="14" /> New file</button>
            <button type="button" class="dd-btn dd-btn--ghost" @click="ask('folder')"><DdIcon name="folder" :size="14" /> New folder</button>
            <button type="button" class="dd-btn dd-btn--ghost" @click="ask('import')"><DdIcon name="download" :size="14" class="cd-flip" /> Import</button>
          </div>
          <div class="cd-files" :class="{ 'has-editor': openFile }">
            <div class="dd-table-wrap dd-box cd-filelist">
              <table class="dd-table">
                <thead><tr><th>Name</th><th>Note</th><th>Size</th><th>Last modified</th><th>Mode</th><th></th></tr></thead>
                <tbody>
                  <tr v-if="!entries.length"><td colspan="6" class="dd-muted">Empty directory</td></tr>
                  <tr v-for="e in entries" :key="e.name" :class="{ 'is-selected': openFile === join(cwd, e.name) }">
                    <td>
                      <button type="button" class="cd-tree__item" @click="openEntry(e)">
                        <DdIcon :name="e.dir ? 'folder' : 'file'" :size="15" :class="e.dir ? 'is-blue' : ''" />{{ e.name }}
                      </button>
                    </td>
                    <td><span v-if="noteOf(e)" class="dd-chip" :class="noteOf(e) === 'Added' ? 'cd-chip--added' : 'cd-chip--mod'">{{ noteOf(e) }}</span></td>
                    <td class="dd-muted">{{ e.dir ? '-' : fmtBytes(e.size) }}</td>
                    <td class="dd-muted">{{ e.modified }}</td>
                    <td class="dd-mono dd-muted">{{ e.mode }}</td>
                    <td class="dd-actions">
                      <DdMenu :items="fileMenu(e)" :label="`Actions for ${e.name}`" @select="key => fileAction(key, e)" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="openFile" class="cd-editor dd-box">
              <div class="cd-editor__bar">
                <span class="dd-mono cd-editor__path">{{ openFile }}<span v-if="dirty" class="cd-dirty" title="Unsaved changes"> ●</span></span>
                <span class="dd-spacer"></span>
                <button type="button" class="dd-btn dd-btn--ghost" @click="closeEditor">Close</button>
                <button type="button" class="dd-btn dd-btn--primary" :disabled="busy || !dirty" @click="saveFile">Save</button>
              </div>
              <textarea v-model="fileBody" class="dd-textarea cd-editor__text" rows="14" spellcheck="false" aria-label="File contents"
                        @keydown.ctrl.s.prevent="saveFile"></textarea>
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

    <DdModal v-if="asking" :title="askTitle" @close="asking = ''">
      <div class="dd-field"><label for="cd-ask">{{ askLabel }}</label>
        <input id="cd-ask" v-model="askValue" class="dd-input dd-mono" :placeholder="askPlaceholder" @keydown.enter="submitAsk" /></div>
      <p v-if="asking === 'import'" class="dd-muted">A file from this lab's workspace (the Files tool), copied with <span class="dd-mono">docker cp</span> into <span class="dd-mono">{{ cwd }}</span>.</p>
      <p v-else-if="asking === 'saveas'" class="dd-muted">Copied out of the container into this lab's workspace with <span class="dd-mono">docker cp</span>.</p>
      <p v-if="askError" class="cd-err">{{ askError }}</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="asking = ''">Cancel</button>
        <button type="button" class="dd-btn dd-btn--primary" :disabled="!askValue.trim() || busy" @click="submitAsk">{{ askButton }}</button>
      </template>
    </DdModal>

    <DdModal v-if="removing" :title="`Delete ${removing.dir ? 'folder' : 'file'}?`" @close="removing = null">
      <p><span class="dd-mono">{{ join(cwd, removing.name) }}</span> will be deleted from the container<template v-if="removing.dir"> with everything inside it</template>.</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="removing = null">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="confirmRemove">Delete</button>
      </template>
    </DdModal>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import DdMenu from './DdMenu.vue';
import DdModal from './DdModal.vue';
import MiniChart from './MiniChart.vue';
import { cmd, containers, copyText, portPairs, series, statusLabel, type DdRoute, type MenuItem } from './dd';
import { completeLine, download, fmtBytes, parseDiff, parseLsLong, type FileEntry } from './ddshell';

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
const follow = ref(false);
const tail = ref(0);
const cleared = ref(0);
const logBox = ref<HTMLElement | null>(null);
const logLines = computed(() => fetched.value ?? row.value?.all_logs ?? row.value?.logs ?? []);
const visibleLogs = computed(() => logLines.value.slice(cleared.value)
  .filter(line => !logFilter.value || line.toLowerCase().includes(logFilter.value.toLowerCase())));
const hitCount = computed(() => visibleLogs.value.length);
function logClass(line: string) {
  if (/\b(error|fatal|panic|emerg|crit)\b/i.test(line)) return 'is-error';
  if (/\bwarn(ing)?\b/i.test(line)) return 'is-warn';
  return '';
}
async function fetchLogs() {
  if (!row.value) return;
  /* A Follow poll is not something the student typed: kept out of the CLI drawer. */
  const result = await props.api.exec(cmd.logsTail(row.value.name, tail.value, stamps.value),
    { quiet: true, unlogged: follow.value && fetched.value !== null });
  if (result.ok) {
    const stick = logBox.value ? logBox.value.scrollTop + logBox.value.clientHeight >= logBox.value.scrollHeight - 8 : true;
    fetched.value = String(result.output || '').split('\n').filter((l, i, all) => l !== '' || i < all.length - 1);
    cleared.value = Math.min(cleared.value, fetched.value.length);
    await nextTick();
    if (stick && logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight;
  }
}
let followTimer: number | undefined;
watch([follow, tab], ([on, current]) => {
  window.clearInterval(followTimer);
  followTimer = undefined;
  if (on && current === 'logs') followTimer = window.setInterval(() => { void fetchLogs(); }, 3000);
});
onBeforeUnmount(() => window.clearInterval(followTimer));

/* ---- inspect ---- */
const inspectText = ref('');
const inspectFilter = ref('');
const inspectShown = computed(() => {
  if (!inspectFilter.value) return inspectText.value;
  const needle = inspectFilter.value.toLowerCase();
  return inspectText.value.split('\n').filter(l => l.toLowerCase().includes(needle)).join('\n');
});
async function fetchInspect() {
  if (!row.value) return;
  const result = await props.api.exec(cmd.inspect(row.value.name), {});
  inspectText.value = result.ok ? String(result.output || '') : '';
}

/* ---- exec: an interactive shell, one `docker exec` per line ---- */
const execLines = ref<{ kind: string; text: string }[]>([]);
const execDraft = ref('');
const execInput = ref<HTMLInputElement | null>(null);
const execScreen = ref<HTMLElement | null>(null);
const execRunning = ref(false);
const execCwd = ref('');
const recall: string[] = [];
let cursor = -1;
const promptText = computed(() => `${execCwd.value || '/'} # `);
function focusExec() { execInput.value?.focus(); }
function cwdOf(result: { data?: unknown }): string {
  const data = result.data as { cwd?: unknown } | undefined;
  return data && typeof data.cwd === 'string' ? data.cwd : '';
}
async function scrollExec() {
  await nextTick();
  if (execScreen.value) execScreen.value.scrollTop = execScreen.value.scrollHeight;
  focusExec();
}
async function runExec() {
  const line = execDraft.value.trim();
  if (!row.value) return;
  execLines.value.push({ kind: 'is-cmd', text: promptText.value + execDraft.value });
  execDraft.value = '';
  if (!line) { await scrollExec(); return; }
  recall.unshift(line);
  cursor = -1;
  if (line === 'clear') { execLines.value = []; return; }
  if (line === 'exit') { execLines.value.push({ kind: 'is-dim', text: '(each line is its own exec - there is no session to leave)' }); await scrollExec(); return; }
  execRunning.value = true;
  const result = await props.api.exec(cmd.execIn(row.value.name, execCwd.value, line), { quiet: true });
  execRunning.value = false;
  const where = cwdOf(result);
  if (where) execCwd.value = where;
  const out = String(result.output || '').replace(/\s+$/, '');
  const err = String(result.error || '').replace(/\s+$/, '');
  if (out) for (const t of out.split('\n')) execLines.value.push({ kind: '', text: t });
  if (err) for (const t of err.split('\n')) execLines.value.push({ kind: 'is-err', text: t });
  execLines.value = execLines.value.slice(-600);
  await scrollExec();
}
function recallOlder() {
  if (cursor < recall.length - 1) cursor += 1;
  if (recall[cursor] !== undefined) execDraft.value = recall[cursor];
}
function recallNewer() {
  cursor = Math.max(-1, cursor - 1);
  execDraft.value = cursor < 0 ? '' : recall[cursor];
}
function cancelLine() {
  execLines.value.push({ kind: 'is-cmd', text: promptText.value + execDraft.value + '^C' });
  execDraft.value = '';
}
/** Tab: list the directory the last word points into (unlogged), complete it. */
async function complete() {
  if (!row.value) return;
  const words = execDraft.value.split(/\s+/);
  const last = words[words.length - 1] || '';
  const slash = last.lastIndexOf('/');
  const dir = slash >= 0 ? (last.slice(0, slash + 1) || '/') : '.';
  const result = await props.api.exec(cmd.execIn(row.value.name, execCwd.value, `ls -Ap ${dir === '.' ? '.' : dir}`),
    { quiet: true, unlogged: true });
  if (!result.ok) return;
  const names = String(result.output || '').split('\n').filter(Boolean);
  const outcome = completeLine(execDraft.value, names);
  if (outcome.line !== execDraft.value) execDraft.value = outcome.line;
  else if (outcome.options.length > 1) {
    execLines.value.push({ kind: 'is-cmd', text: promptText.value + execDraft.value });
    execLines.value.push({ kind: '', text: outcome.options.join('  ') });
    await scrollExec();
  }
}

/* ---- files ---- */
const cwd = ref('/');
const pathDraft = ref('/');
watch(cwd, value => { pathDraft.value = value; });
const entries = ref<FileEntry[]>([]);
const openFile = ref('');
const fileBody = ref('');
const savedBody = ref('');
const dirty = computed(() => openFile.value !== '' && fileBody.value !== savedBody.value);
const asking = ref<'' | 'file' | 'folder' | 'import' | 'rename' | 'saveas'>('');
const askValue = ref('');
const askError = ref('');
const askTarget = ref<FileEntry | null>(null);
const removing = ref<FileEntry | null>(null);
/* What `docker diff` says about this container's layer: A / C / D per path. */
const changes = ref<Record<string, string>>({});

const askTitle = computed(() => ({ file: 'New file', folder: 'New folder', import: 'Import',
  rename: 'Rename', saveas: 'Save as', '': '' })[asking.value]);
const askLabel = computed(() => ({ file: 'File name', folder: 'Folder name', import: 'Workspace file',
  rename: 'New name', saveas: 'Save to (workspace path)', '': '' })[asking.value]);
const askPlaceholder = computed(() => ({ file: 'notes.txt', folder: 'conf.d', import: 'index.html',
  rename: '', saveas: 'copy.txt', '': '' })[asking.value]);
const askButton = computed(() => ({ file: 'Create', folder: 'Create', import: 'Import', rename: 'Rename',
  saveas: 'Save', '': '' })[asking.value]);

function join(dir: string, name: string) { return (dir.endsWith('/') ? dir : dir + '/') + name; }
function parent(path: string) { const cut = path.replace(/\/+$/, '').split('/').slice(0, -1).join('/'); return cut || '/'; }
function normPath(path: string) {
  const parts: string[] = [];
  for (const part of (path.startsWith('/') ? path : join(cwd.value, path)).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop(); else parts.push(part);
  }
  return '/' + parts.join('/');
}
function noteOf(e: FileEntry) {
  const kind = changes.value[join(cwd.value, e.name)];
  return kind === 'A' ? 'Added' : kind === 'C' ? 'Modified' : '';
}

function fileMenu(e: FileEntry): MenuItem[] {
  return e.dir
    ? [{ key: 'open', label: 'Open', icon: 'folder' }, { key: 'rename', label: 'Rename', icon: 'file' },
       { key: 'saveas', label: 'Save as…', icon: 'download' }, { key: 'delete', label: 'Delete', icon: 'trash', danger: true }]
    : [{ key: 'open', label: 'Edit file', icon: 'file' }, { key: 'rename', label: 'Rename', icon: 'file' },
       { key: 'saveas', label: 'Save as…', icon: 'download' }, { key: 'delete', label: 'Delete', icon: 'trash', danger: true }];
}
function fileAction(key: string, e: FileEntry) {
  if (key === 'open') void openEntry(e);
  else if (key === 'delete') removing.value = e;
  else { askTarget.value = e; askValue.value = e.name; askError.value = ''; asking.value = key as 'rename' | 'saveas'; }
}
function ask(kind: 'file' | 'folder' | 'import') { askValue.value = ''; askError.value = ''; askTarget.value = null; asking.value = kind; }

async function openDir(path: string) {
  if (!row.value) return;
  const result = await props.api.exec(cmd.lsLong(row.value.name, path), { quiet: true, unlogged: true });
  if (!result.ok) {
    props.api.notify('error', 'Could not open the directory', String(result.error || result.output));
    return;
  }
  cwd.value = path;
  entries.value = parseLsLong(String(result.output || ''));
  const diff = await props.api.exec(cmd.diff(row.value.name), { quiet: true, unlogged: true });
  changes.value = diff.ok ? parseDiff(String(diff.output || '')) : {};
  if (openFile.value && parent(openFile.value) !== path) closeEditor();
}

async function openEntry(e: FileEntry) {
  if (!row.value) return;
  const path = join(cwd.value, e.name);
  if (e.dir) { await openDir(path); return; }
  const result = await props.api.exec(cmd.cat(row.value.name, path), { quiet: true, unlogged: true });
  if (!result.ok) { props.api.notify('error', `Could not open ${path}`, String(result.error || '')); return; }
  openFile.value = path;
  fileBody.value = String(result.output || '');
  savedBody.value = fileBody.value;
}
function closeEditor() { openFile.value = ''; fileBody.value = ''; savedBody.value = ''; }

async function saveFile() {
  if (!row.value || !openFile.value || !dirty.value) return;
  const result = await props.api.exec(cmd.write(row.value.name, openFile.value, fileBody.value), { success: `Saved ${openFile.value}` });
  if (result.ok) { savedBody.value = fileBody.value; await openDir(cwd.value); }
}

async function submitAsk() {
  if (!row.value) return;
  const value = askValue.value.trim();
  if (!value) return;
  const name = row.value.name;
  if ((asking.value === 'file' || asking.value === 'folder' || asking.value === 'rename') && value.includes('/')) {
    askError.value = 'A name cannot contain "/".';
    return;
  }
  let command = '';
  let success = '';
  const target = askTarget.value ? join(cwd.value, askTarget.value.name) : '';
  switch (asking.value) {
    case 'file': command = cmd.write(name, join(cwd.value, value), ''); success = `Created ${join(cwd.value, value)}`; break;
    case 'folder': command = cmd.mkdir(name, join(cwd.value, value)); success = `Created ${join(cwd.value, value)}`; break;
    case 'import': command = cmd.cpIn(value, name, cwd.value); success = `Imported ${value}`; break;
    case 'rename': command = cmd.rename(name, target, join(cwd.value, value)); success = `Renamed to ${value}`; break;
    case 'saveas': command = cmd.cpOut(name, target, value); success = `Saved ${value} to the workspace`; break;
  }
  const result = await props.api.exec(command, { quiet: true, success });
  if (!result.ok) { askError.value = String(result.error || result.output || 'Failed'); return; }
  const kind = asking.value;
  asking.value = '';
  await openDir(cwd.value);
  if (kind === 'file') { openFile.value = join(cwd.value, value); fileBody.value = ''; savedBody.value = ''; }
}

async function confirmRemove() {
  if (!row.value || !removing.value) return;
  const path = join(cwd.value, removing.value.name);
  const result = await props.api.exec(removing.value.dir ? cmd.rmTree(row.value.name, path) : cmd.rmFile(row.value.name, path),
    { success: `Deleted ${path}` });
  if (result.ok) {
    if (openFile.value === path) closeEditor();
    removing.value = null;
    await openDir(cwd.value);
  }
}

async function browseMount(target: string) {
  setTab('files');
  await nextTick();
  await openDir(target);
}

watch(() => [props.route.id, tab.value] as const, async ([, current], previous) => {
  if (!row.value) return;
  const changedContainer = !previous || previous[0] !== props.route.id;
  if (changedContainer) {
    fetched.value = null; inspectText.value = ''; execLines.value = []; execCwd.value = '';
    cwd.value = '/'; entries.value = []; closeEditor(); follow.value = false;
  }
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
.is-blue { color: var(--dd-blue); }
.cd-copy { border: 0; background: none; color: var(--dd-text-2); cursor: pointer; padding: 2px; }
.cd-status { display: flex; flex-direction: column; gap: 2px; font-size: 12px; padding-right: 8px; }
.cd-actions { align-self: center; }
.cd-pane { display: flex; flex-direction: column; gap: 10px; min-height: 0; flex: 1; }
.cd-tail { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--dd-text-2); }
.cd-tail__box { height: 30px; padding: 0 6px; }
.cd-hits { font-size: 13px; }
.cd-logs { max-height: 460px; min-height: 220px; background: #FAFAFB; overflow: auto; }
.cd-logline { white-space: pre-wrap; word-break: break-word; }
.cd-logline.is-error { color: var(--dd-red); }
.cd-logline.is-warn { color: #9A6700; }
.cd-json { max-height: 460px; min-height: 220px; background: #FAFAFB; }
.cd-exec-bar { font-size: 13px; }
.cd-term { background: #0C0D10; color: #E6E8EC; border-radius: 6px; padding: 10px 12px; font: 13px/1.5 var(--dd-mono); min-height: 280px; max-height: 480px; overflow: auto; white-space: pre-wrap; word-break: break-word; cursor: text; }
.cd-term .is-err { color: #FF7B86; }
.cd-term .is-cmd { color: #9CC3FF; }
.cd-term .is-dim { color: #7D8594; }
.cd-term__prompt { display: flex; gap: 0; }
.cd-term__ps { color: #9CC3FF; flex: none; white-space: pre; }
.cd-term__prompt input:focus, .cd-term__prompt input:focus-visible { outline: none; box-shadow: none; border: 0; }
.cd-term__prompt input { flex: 1; border: 0; box-shadow: none; padding: 0; background: transparent; outline: none; color: inherit; font: inherit; caret-color: #fff; min-width: 0; }
.cd-hint { font-size: 12px; margin: 0; }
.cd-path { flex: 1 1 260px; max-width: 520px; background: var(--dd-hover); }
.cd-flip { transform: rotate(180deg); }
.cd-files { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start; }
.cd-files.has-editor { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
.cd-filelist { max-height: 460px; overflow: auto; border-top: 0; }
.cd-tree__item { display: inline-flex; align-items: center; gap: 8px; padding: 0; border: 0; background: none; font: inherit; font-size: 13px; color: var(--dd-text); cursor: pointer; text-align: left; }
.cd-tree__item:hover { color: var(--dd-link); text-decoration: underline; }
.cd-tree__item svg { color: var(--dd-text-2); }
.cd-tree__item .is-blue { color: var(--dd-blue); }
.cd-chip--added { background: #E3F5EA; color: #1B7F3B; }
.cd-chip--mod { background: #FFF4D6; color: #8A5A00; }
.cd-editor { display: flex; flex-direction: column; min-width: 0; }
.cd-editor__bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--dd-border); flex-wrap: wrap; }
.cd-editor__path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.cd-dirty { color: var(--dd-amber); }
.cd-editor__text { border: 0; border-radius: 0 0 6px 6px; min-height: 300px; font-family: var(--dd-mono); font-size: 13px; resize: vertical; }
.cd-err { color: var(--dd-red); font-size: 13px; margin: 8px 0 0; }
.cd-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 12px; }
@container sl-portal (max-width: 900px) {
  .cd-files.has-editor { grid-template-columns: minmax(0, 1fr); }
}
@container sl-portal (max-width: 700px) {
  .cd-status { display: none; }
  .cd-filelist { max-height: 260px; }
}
</style>
