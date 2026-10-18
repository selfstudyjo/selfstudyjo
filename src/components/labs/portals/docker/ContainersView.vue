<template>
  <section class="dd-page">
    <div class="dd-head">
      <h1>Containers</h1>
      <span class="dd-spacer"></span>
      <button type="button" class="dd-feedback"><DdIcon name="feedback" :size="15" /> Give feedback</button>
    </div>

    <div class="cv-usage">
      <div class="cv-usage__card">
        <span class="dd-muted">Container CPU usage <DdIcon name="info" :size="13" /></span>
        <strong>{{ cpuTotal.toFixed(2) }}% / 800% <small class="dd-muted">(8 CPUs available)</small></strong>
      </div>
      <div class="cv-usage__card">
        <span class="dd-muted">Container memory usage <DdIcon name="info" :size="13" /></span>
        <strong>{{ memTotal }} / 7.76GB</strong>
      </div>
      <button type="button" class="dd-link cv-usage__charts" @click="charts = !charts">{{ charts ? 'Hide charts' : 'Show charts' }}</button>
    </div>
    <div v-if="charts" class="cv-charts">
      <MiniChart label="CPU" :points="cpuSeries" unit="%" :max="Math.max(5, cpuTotal * 2)" />
      <MiniChart label="Memory" :points="memSeries" unit="MB" :max="Math.max(64, memMb * 2)" />
    </div>

    <div class="dd-toolbar">
      <template v-if="selected.length">
        <span class="dd-selected"><b>{{ selected.length }}</b> selected</span>
        <button type="button" class="dd-btn dd-btn--ghost" @click="bulk('start')"><DdIcon name="play" :size="14" /> Start</button>
        <button type="button" class="dd-btn dd-btn--ghost" @click="bulk('stop')"><DdIcon name="stop" :size="14" /> Stop</button>
        <button type="button" class="dd-btn dd-btn--danger-outline" @click="askDelete(selected)"><DdIcon name="trash" :size="14" /> Delete</button>
        <button type="button" class="dd-link" @click="selected = []">Clear selection</button>
      </template>
      <template v-else>
        <label class="dd-search">
          <DdIcon name="search" :size="16" />
          <input v-model="filter" type="search" placeholder="Search" aria-label="Search containers" />
        </label>
        <label class="dd-toggle">
          <input v-model="onlyRunning" type="checkbox" />
          <span class="dd-toggle__track"></span>
          Only show running containers
        </label>
        <span class="dd-spacer"></span>
        <button v-if="composeFiles.length" type="button" class="dd-btn dd-btn--secondary" @click="composeOpen = true">
          <DdIcon name="stack" :size="15" /> Compose up
        </button>
      </template>
    </div>

    <div v-if="!all.length" class="dd-empty">
      <DdIcon name="containers" :size="64" class="dd-empty__art" />
      <h2>Your running containers show up here</h2>
      <p>A container is an isolated environment for your code. Run one from an image on the
        <button type="button" class="dd-link" @click="$emit('go', { page: 'images' })">Images</button> view, or with
        <span class="dd-mono">docker run</span> in the terminal.</p>
    </div>

    <div v-else class="dd-table-wrap">
      <table class="dd-table">
        <thead>
          <tr>
            <th class="dd-check"><input type="checkbox" class="dd-cb" aria-label="Select all" :checked="allChecked" @change="toggleAll" /></th>
            <th class="sortable" @click="sortDesc = !sortDesc">Name {{ sortDesc ? '↓' : '↑' }}</th>
            <th>Container ID</th>
            <th>Image</th>
            <th>Port(s)</th>
            <th>CPU (%)</th>
            <th>Last started</th>
            <th class="dd-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="entry in entries" :key="entry.key">
            <tr v-if="entry.kind === 'stack'" class="cv-stack">
              <td class="dd-check"><input type="checkbox" class="dd-cb" :aria-label="`Select ${entry.project}`"
                     :checked="entry.members.every(m => selected.includes(m.name))"
                     @change="toggleMany(entry.members.map(m => m.name))" /></td>
              <td>
                <div class="dd-name-cell">
                  <button type="button" class="cv-expand" :aria-expanded="!collapsed.has(entry.project)"
                          @click="toggleStack(entry.project)">
                    <DdIcon :name="collapsed.has(entry.project) ? 'chevron-right' : 'chevron-down'" :size="14" />
                  </button>
                  <DdIcon name="stack" :size="20" :class="entry.running ? 'is-green' : 'is-grey'" />
                  <div class="dd-name-lines">
                    <button type="button" class="dd-link" @click="toggleStack(entry.project)">{{ entry.project }}</button>
                    <small>{{ entry.running ? `Running (${entry.running}/${entry.members.length})` : `Exited` }}</small>
                  </div>
                </div>
              </td>
              <td>-</td><td>-</td><td>-</td>
              <td>{{ entry.cpu === null ? 'N/A' : entry.cpu.toFixed(2) + '%' }}</td>
              <td>{{ entry.members[0]?.started_ago || '-' }}</td>
              <td class="dd-actions">
                <span class="dd-actions-inner">
                  <button v-if="entry.running" type="button" class="dd-icon-btn dd-icon-btn--blue" title="Stop" aria-label="Stop"
                          @click="act(cmd.compose('stop', entry.project, composeFile), `Stopped ${entry.project}`)"><DdIcon name="stop" /></button>
                  <button v-else type="button" class="dd-icon-btn dd-icon-btn--blue" title="Start" aria-label="Start"
                          @click="act(cmd.compose('start', entry.project, composeFile), `Started ${entry.project}`)"><DdIcon name="play" /></button>
                  <DdMenu :items="stackMenu(entry)" @select="key => stackAction(entry, key)" />
                  <button type="button" class="dd-icon-btn dd-icon-btn--danger" title="Delete" aria-label="Delete"
                          @click="askStackDelete(entry.project)"><DdIcon name="trash" /></button>
                </span>
              </td>
            </tr>
            <ContainerRow v-else-if="!entry.hidden" :row="entry.row" :child="entry.child"
                          :selected="selected.includes(entry.row.name)"
                          @toggle="toggleMany([entry.row.name])" @go="r => $emit('go', r)"
                          @action="(key: string) => rowAction(entry.row, key)" />
          </template>
        </tbody>
      </table>
      <p v-if="!entries.length" class="dd-empty"><span>No containers match your filters.</span></p>
    </div>

    <DdModal v-if="deleting.length" :title="deleting.length > 1 ? 'Delete containers?' : 'Delete container?'"
             @close="deleting = []">
      <p v-if="deleting.length === 1">The container <b>{{ deleting[0] }}</b> will be permanently deleted.
        Any data not stored in a volume is lost.</p>
      <p v-else>These {{ deleting.length }} containers will be permanently deleted:
        <b>{{ deleting.join(', ') }}</b>.</p>
      <p v-if="runningAmong(deleting)" class="dd-muted">Running containers are stopped first (<span class="dd-mono">docker rm -f</span>).</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="deleting = []">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="confirmDelete">Delete forever</button>
      </template>
    </DdModal>

    <DdModal v-if="stackDeleting" title="Delete the stack?" @close="stackDeleting = ''">
      <p>All containers in <b>{{ stackDeleting }}</b> and its default network are removed
        (<span class="dd-mono">docker compose down</span>). Named volumes are kept.</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="stackDeleting = ''">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="confirmStackDelete">Delete</button>
      </template>
    </DdModal>

    <DdModal v-if="composeOpen" title="Compose up" subtitle="Start a multi-container application from a Compose file" @close="composeOpen = false">
      <div class="dd-field">
        <label for="cv-cf">Compose file</label>
        <select id="cv-cf" v-model="composeFile" class="dd-select">
          <option v-for="file in composeFiles" :key="file" :value="file">{{ file }}</option>
        </select>
      </div>
      <div class="dd-field">
        <label for="cv-proj">Project name</label>
        <input id="cv-proj" v-model="projectName" class="dd-input" :class="{ 'is-invalid': projectError }" />
        <small v-if="!projectError">Containers are named &lt;project&gt;-&lt;service&gt;-1. Default: lab</small>
        <span v-else class="dd-err">{{ projectError }}</span>
      </div>
      <p class="dd-muted dd-mono">{{ cmd.composeUp(projectName || 'lab', composeFile) }}</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="composeOpen = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--primary" :disabled="busy || !!projectError" @click="composeUp">Up</button>
      </template>
    </DdModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches, pick } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import DdMenu from './DdMenu.vue';
import DdModal from './DdModal.vue';
import MiniChart from './MiniChart.vue';
import ContainerRow from './ContainerRow.vue';
import { cmd, containers, copyText, series, type Container, type DdRoute, type MenuItem } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
const emit = defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();

const filter = ref('');
const onlyRunning = ref(false);
const sortDesc = ref(false);
const selected = ref<string[]>([]);
const collapsed = ref(new Set<string>());
const deleting = ref<string[]>([]);
const stackDeleting = ref('');
const charts = ref(false);
const composeOpen = ref(false);
const composeFiles = computed(() => pick<string[]>(props.view, 'compose_files', []));
const composeFile = ref(composeFiles.value[0] || 'docker-compose.yml');
const projectName = ref('lab');
const projectError = computed(() => /^[a-z0-9][a-z0-9_-]*$/.test(projectName.value)
  ? '' : 'Project name must contain only lowercase letters, digits, dashes and underscores, and start with a letter or digit.');

const all = computed(() => containers(props.view));
const visible = computed(() => all.value
  .filter(c => !onlyRunning.value || c.status === 'running')
  .filter(c => matches(c as any, filter.value, ['name', 'image', 'id', 'service', 'project'])));

const cpuTotal = computed(() => all.value.reduce((sum, c) => sum + (c.cpu || 0), 0));
const memMb = computed(() => all.value.reduce((sum, c) => sum + (c.mem_mib || 0), 0));
const memTotal = computed(() => memMb.value ? `${memMb.value.toFixed(1)}MB` : '0B');
const cpuSeries = computed(() => series('cpu', cpuTotal.value, 800));
const memSeries = computed(() => series('mem', memMb.value, 8000));

type Entry =
  | { kind: 'stack'; key: string; project: string; members: Container[]; running: number; cpu: number | null }
  | { kind: 'row'; key: string; row: Container; child: boolean; hidden: boolean };

const entries = computed<Entry[]>(() => {
  const sorted = [...visible.value].sort((a, b) => a.name.localeCompare(b.name) * (sortDesc.value ? -1 : 1));
  const stacks = new Map<string, Container[]>();
  const out: Entry[] = [];
  for (const row of sorted) {
    if (row.service) {
      const name = row.project || 'lab';
      if (!stacks.has(name)) {
        stacks.set(name, []);
        out.push({ kind: 'stack', key: 's:' + name, project: name, members: stacks.get(name)!, running: 0, cpu: null });
      }
      stacks.get(name)!.push(row);
      out.push({ kind: 'row', key: 'r:' + row.id, row, child: true, hidden: collapsed.value.has(name) });
    } else {
      out.push({ kind: 'row', key: 'r:' + row.id, row, child: false, hidden: false });
    }
  }
  for (const entry of out) {
    if (entry.kind !== 'stack') continue;
    entry.running = entry.members.filter(m => m.status === 'running').length;
    entry.cpu = entry.running ? entry.members.reduce((s, m) => s + (m.cpu || 0), 0) : null;
  }
  return out;
});

const allChecked = computed(() => visible.value.length > 0 && visible.value.every(c => selected.value.includes(c.name)));

function toggleAll() {
  selected.value = allChecked.value ? [] : visible.value.map(c => c.name);
}
function toggleMany(names: string[]) {
  const every = names.every(n => selected.value.includes(n));
  selected.value = every ? selected.value.filter(n => !names.includes(n))
    : [...new Set([...selected.value, ...names])];
}
function toggleStack(name: string) {
  const next = new Set(collapsed.value);
  if (next.has(name)) next.delete(name); else next.add(name);
  collapsed.value = next;
}

async function act(command: string, success: string) {
  return props.api.exec(command, { success });
}

function runningAmong(names: string[]) {
  return all.value.some(c => names.includes(c.name) && (c.status === 'running' || c.status === 'paused'));
}

async function bulk(kind: 'start' | 'stop') {
  const names = [...selected.value];
  const result = await act(kind === 'start' ? cmd.start(names) : cmd.stop(names),
                           `${kind === 'start' ? 'Started' : 'Stopped'} ${names.length} container${names.length > 1 ? 's' : ''}`);
  if (result.ok) selected.value = [];
}

function askDelete(names: string[]) { deleting.value = [...names]; }

async function confirmDelete() {
  const names = deleting.value;
  const result = await act(cmd.rm(names, runningAmong(names)),
                           names.length > 1 ? `Deleted ${names.length} containers` : `Deleted ${names[0]}`);
  if (result.ok) {
    selected.value = selected.value.filter(n => !names.includes(n));
    deleting.value = [];
  }
}

function askStackDelete(project: string) { stackDeleting.value = project; }
async function confirmStackDelete() {
  const project = stackDeleting.value;
  const result = await act(cmd.compose('down', project, composeFile.value), `Deleted ${project}`);
  if (result.ok) stackDeleting.value = '';
}

function stackMenu(entry: { running: number }): MenuItem[] {
  return [
    { key: 'restart', label: 'Restart', icon: 'restart' },
    { key: 'pause', label: 'Pause', icon: 'pause', disabled: !entry.running },
    { key: 'unpause', label: 'Resume', icon: 'play' },
    { key: 'logs', label: 'View logs', icon: 'file' },
  ];
}
async function stackAction(entry: { project: string }, key: string) {
  if (key === 'logs') {
    const result = await props.api.exec(cmd.compose('logs', entry.project, composeFile.value), {});
    if (result.ok) props.api.notify('info', `${entry.project} logs`, String(result.output || '').split('\n').slice(-6).join('\n'));
    return;
  }
  await act(cmd.compose(key, entry.project, composeFile.value),
            `${key === 'restart' ? 'Restarted' : key === 'pause' ? 'Paused' : 'Resumed'} ${entry.project}`);
}

async function rowAction(row: Container, key: string) {
  if (key.startsWith('open:')) {
    props.api.notify('info', `http://localhost:${key.slice(5)}`,
                     `Published by ${row.name}. There is no browser on the lab host; reach it from another container with docker exec … curl.`);
    return;
  }
  switch (key) {
    case 'start': return act(cmd.start([row.name]), `Started ${row.name}`);
    case 'stop': return act(cmd.stop([row.name]), `Stopped ${row.name}`);
    case 'restart': return act(cmd.restart([row.name]), `Restarted ${row.name}`);
    case 'pause': return act(cmd.pause(row.name), `Paused ${row.name}`);
    case 'unpause': return act(cmd.unpause(row.name), `Resumed ${row.name}`);
    case 'delete': return askDelete([row.name]);
    case 'terminal': return emit('go', { page: 'containers', id: row.name, tab: 'exec' });
    case 'details': return emit('go', { page: 'containers', id: row.name, tab: 'logs' });
    case 'image': return emit('go', { page: 'images', id: row.image });
    case 'copy': copyText(runLine(row)); props.api.notify('info', 'Copied docker run command', runLine(row)); return;
  }
}

function runLine(row: Container): string {
  const parts = ['docker run -d', `--name ${row.name}`];
  for (const p of row.port_bindings || []) if (p.host) parts.push(`-p ${p.host}:${p.container}`);
  for (const m of row.mount_list || []) parts.push(`-v ${m.source}:${m.target}`);
  for (const e of row.env || []) parts.push(`-e ${e}`);
  parts.push(row.image);
  return parts.join(' ');
}

async function composeUp() {
  const result = await act(cmd.composeUp(projectName.value || 'lab', composeFile.value),
                           `Started ${projectName.value || 'lab'}`);
  if (result.ok) composeOpen.value = false;
}
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.dd-spacer { flex: 1; }
.cv-usage { display: flex; align-items: stretch; gap: 12px; flex-wrap: wrap; }
.cv-usage__card { display: flex; flex-direction: column; gap: 4px; padding: 10px 14px; border: 1px solid var(--dd-border); border-radius: 6px; min-width: 220px; flex: 1 1 220px; max-width: 320px; font-size: 13px; }
.cv-usage__card span { display: inline-flex; align-items: center; gap: 4px; }
.cv-usage__card strong { font-weight: 500; font-size: 15px; }
.cv-usage__card small { font-weight: 400; font-size: 12px; }
.cv-usage__charts { align-self: center; font-size: 13px; }
.cv-charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; }
.cv-stack td { background: #FAFAFB; }
@container sl-portal (max-width: 560px) { .cv-usage__card { max-width: none; } }
.cv-expand { display: grid; place-items: center; width: 22px; height: 22px; border: 0; border-radius: 4px; background: none; cursor: pointer; color: var(--dd-text-2); padding: 0; }
.cv-expand:hover { background: var(--dd-hover-strong); }
.is-green { color: var(--dd-green); }
.is-grey { color: var(--dd-grey-dot); }
</style>
