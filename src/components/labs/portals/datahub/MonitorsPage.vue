<template>
  <div class="dh-page">
    <div class="dh-page-head">
      <div>
        <h1 class="dh-title">Monitors</h1>
        <p class="dh-subtitle">Freshness, volume, schema and distribution monitors evaluate the live data on every platform clock tick. An alert opens an incident.</p>
      </div>
      <button type="button" class="dh-btn" :disabled="dh.busy.value || !dh.monitors.value.length" @click="runAll"><DhIcon name="refresh" /> Run all</button>
      <button type="button" class="dh-btn dh-btn--primary" @click="openCreate"><DhIcon name="plus" /> Create monitor</button>
    </div>

    <div class="dh-mon-stats">
      <div class="dh-card dh-stat"><span class="dh-stat__n">{{ dh.monitors.value.length }}</span><span class="dh-muted">Monitors</span></div>
      <div class="dh-card dh-stat"><span class="dh-stat__n is-bad">{{ alerting }}</span><span class="dh-muted">Alerting</span></div>
      <div class="dh-card dh-stat"><span class="dh-stat__n is-ok">{{ healthy }}</span><span class="dh-muted">Healthy</span></div>
      <div class="dh-card dh-stat"><span class="dh-stat__n">{{ paused }}</span><span class="dh-muted">Paused</span></div>
    </div>

    <div class="dh-row">
      <input v-model="filter" class="dh-input dh-mon-filter" placeholder="Filter monitors…" aria-label="Filter monitors" />
      <select v-model="typeFilter" class="dh-select dh-mon-sel" aria-label="Type"><option value="">All types</option><option v-for="t in TYPES" :key="t.key" :value="t.key">{{ t.label }}</option></select>
    </div>

    <div v-if="!shown.length" class="dh-card dh-empty">
      <DhIcon name="pulse" />
      <span>{{ dh.monitors.value.length ? 'No monitors match the filter.' : 'No monitors yet. Create one to start watching a dataset.' }}</span>
    </div>
    <div v-else class="dh-table-wrap">
      <table class="dh-table">
        <thead><tr><th>Status</th><th>Name</th><th>Type</th><th>Asset</th><th>Threshold</th><th>Last value</th><th>Detail</th><th class="dh-actions">Actions</th></tr></thead>
        <tbody>
          <tr v-for="m in shown" :key="m.name">
            <td><span class="dh-pill" :class="m.paused ? 'dh-pill--grey' : m.status === 'ALERT' ? 'dh-pill--bad' : m.status === 'OK' ? 'dh-pill--ok' : 'dh-pill--grey'">{{ m.paused ? 'Paused' : m.status === 'ALERT' ? 'Alerting' : m.status === 'OK' ? 'Healthy' : 'Pending' }}</span></td>
            <td><b>{{ m.name }}</b></td>
            <td><span class="dh-type"><DhIcon :name="iconFor(m.type)" :size="13" /> {{ labelFor(m.type) }}</span><div v-if="m.field || m.column" class="dh-mono dh-muted">{{ m.field || m.column }}</div></td>
            <td><button type="button" class="dh-link dh-mono" @click="open(m.dataset)">{{ m.dataset }}</button></td>
            <td>{{ m.threshold }}</td>
            <td class="dh-mono">{{ m.last_value === null || m.last_value === undefined ? '—' : m.last_value }}</td>
            <td class="dh-detail">{{ m.detail }}</td>
            <td class="dh-actions">
              <button type="button" class="dh-btn dh-btn--sm" :disabled="dh.busy.value" title="Evaluate now" @click="runOne(m.name)"><DhIcon name="play" :size="11" /> Run</button>
              <button type="button" class="dh-btn dh-btn--sm" :disabled="dh.busy.value" @click="togglePause(m.name, Boolean(m.paused))">
                <DhIcon :name="m.paused ? 'play' : 'pause'" :size="11" /> {{ m.paused ? 'Resume' : 'Pause' }}</button>
              <button v-if="m.type !== 'freshness'" type="button" class="dh-btn dh-btn--sm" :disabled="dh.busy.value" title="Re-baseline on the current data" @click="baseline(m.name)">Reset baseline</button>
              <button type="button" class="dh-btn dh-btn--sm dh-btn--text dh-del" :disabled="dh.busy.value" :aria-label="'Delete ' + m.name" @click="remove(m.name)"><DhIcon name="trash" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <DhModal v-if="form" title="Create Monitor" ok-text="Create" :ok-disabled="!canCreate" :busy="dh.busy.value" :width="620"
             @close="form = null" @ok="create">
      <div class="dh-field">
        <span class="dh-label">Monitor type</span>
        <div class="dh-types">
          <label v-for="t in TYPES" :key="t.key" class="dh-typecard" :class="{ 'is-on': form.type === t.key }">
            <input v-model="form.type" type="radio" name="dh-mon-type" :value="t.key" />
            <DhIcon :name="t.icon" :size="18" />
            <span><b>{{ t.label }}</b><small>{{ t.help }}</small></span>
          </label>
        </div>
      </div>
      <div class="dh-field">
        <span class="dh-label"><b>*</b>Asset</span>
        <select v-model="form.dataset" class="dh-select" aria-label="Asset">
          <option value="" disabled>Select a dataset</option>
          <option v-for="d in queryable" :key="d.urn" :value="d.urn">{{ d.urn }}</option>
        </select>
      </div>
      <div v-if="form.type === 'freshness'" class="dh-grid2">
        <div class="dh-field">
          <span class="dh-label">Timestamp field</span>
          <select v-model="form.field" class="dh-select" aria-label="Timestamp field">
            <option v-for="c in columns" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="dh-field">
          <span class="dh-label">Max age</span>
          <input v-model="form.threshold" class="dh-input" placeholder="24h" aria-label="Max age" />
          <span class="dh-hint">e.g. 6h, 24h, 2d</span>
        </div>
      </div>
      <div v-else-if="form.type === 'volume'" class="dh-grid2">
        <div class="dh-field">
          <span class="dh-label">Allowed change</span>
          <input v-model="form.threshold" class="dh-input" placeholder="20%" aria-label="Allowed change" />
        </div>
        <div class="dh-field">
          <span class="dh-label">Baseline row count</span>
          <input v-model="form.baseline" class="dh-input" type="number" min="0" placeholder="current rows" aria-label="Baseline rows" />
          <span class="dh-hint">Empty: the current row count.</span>
        </div>
      </div>
      <div v-else-if="form.type === 'distribution'" class="dh-grid2">
        <div class="dh-field">
          <span class="dh-label"><b>*</b>Column</span>
          <select v-model="form.column" class="dh-select" aria-label="Column">
            <option value="" disabled>Select a column</option>
            <option v-for="c in columns" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="dh-field">
          <span class="dh-label">Allowed drift</span>
          <input v-model="form.threshold" class="dh-input" placeholder="10%" aria-label="Allowed drift" />
        </div>
      </div>
      <p v-else class="dh-hint">A schema monitor alerts on any added, removed or retyped column, compared with the schema at creation.</p>
      <div class="dh-field">
        <span class="dh-label">Name</span>
        <input v-model="form.name" class="dh-input" :placeholder="defaultName" aria-label="Monitor name" />
      </div>
    </DhModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import DhIcon from './DhIcon.vue';
import DhModal from './DhModal.vue';
import { dh as cmd, isQueryable, shortName, useDh } from './dhContext';

const dh = useDh();
const TYPES = [
  { key: 'freshness', label: 'Freshness', icon: 'clock', help: 'The newest row is older than allowed' },
  { key: 'volume', label: 'Volume', icon: 'chart', help: 'Row count moves more than a percentage' },
  { key: 'schema', label: 'Schema', icon: 'schema', help: 'Columns added, removed or retyped' },
  { key: 'distribution', label: 'Column', icon: 'pulse', help: 'Null rate or mean of a column drifts' },
];
const filter = ref('');
const typeFilter = ref('');
const form = ref<{ type: string; dataset: string; field: string; column: string; threshold: string; baseline: string; name: string } | null>(null);

const alerting = computed(() => dh.monitors.value.filter(m => !m.paused && m.status === 'ALERT').length);
const healthy = computed(() => dh.monitors.value.filter(m => !m.paused && m.status === 'OK').length);
const paused = computed(() => dh.monitors.value.filter(m => m.paused).length);
const shown = computed(() => dh.monitors.value.filter(m => (!typeFilter.value || m.type === typeFilter.value)
  && (!filter.value.trim() || [m.name, m.dataset, m.type, m.detail].join(' ').toLowerCase().includes(filter.value.trim().toLowerCase()))));
const queryable = computed(() => dh.datasets.value.filter(d => isQueryable(d.urn)));
const columns = computed(() => dh.dataset(form.value?.dataset || '')?.columns.map(c => c.name) || []);
const defaultName = computed(() => form.value && form.value.dataset ? `${form.value.type}_${shortName(form.value.dataset).toLowerCase()}` : 'auto');
const canCreate = computed(() => Boolean(form.value && form.value.dataset && (form.value.type !== 'distribution' || form.value.column)));

watch(() => form.value?.dataset, () => {
  if (!form.value) return;
  const cols = columns.value;
  const ts = cols.find(c => /^updated_at$/i.test(c)) || cols.find(c => /(_at|_ts|date|time)$/i.test(c)) || cols[0] || 'updated_at';
  form.value.field = ts;
  form.value.column = '';
});

function iconFor(type: string) { return TYPES.find(t => t.key === type)?.icon || 'pulse'; }
function labelFor(type: string) { return TYPES.find(t => t.key === type)?.label || type; }

function openCreate() {
  form.value = { type: 'freshness', dataset: '', field: 'updated_at', column: '', threshold: '', baseline: '', name: '' };
}

function open(urn: string) {
  if (dh.dataset(urn)) dh.openEntity(urn, 'Quality');
}

async function create() {
  const f = form.value;
  if (!f || !canCreate.value) return;
  const flags: Record<string, string | null> = { '--dataset': f.dataset };
  if (f.type === 'freshness') flags['--field'] = f.field || null;
  if (f.type === 'distribution') flags['--column'] = f.column || null;
  if (f.type !== 'schema') flags['--threshold'] = f.threshold.trim() || null;
  if (f.type === 'volume') flags['--baseline'] = String(f.baseline ?? '').trim() || null;
  flags['--name'] = f.name.trim() || null;
  const result = await dh.run(cmd(['monitor', 'create', f.type], flags), { success: 'Monitor created' });
  if (result.ok) form.value = null;
}

async function runAll() { await dh.run(cmd(['monitor', 'run']), { success: 'Monitors evaluated' }); }
async function runOne(name: string) { await dh.run(cmd(['monitor', 'run', name]), { success: `Monitor ${name} evaluated` }); }
async function togglePause(name: string, isPaused: boolean) {
  await dh.run(cmd(['monitor', isPaused ? 'resume' : 'pause', name]), { success: `Monitor ${name} ${isPaused ? 'resumed' : 'paused'}` });
}
async function baseline(name: string) { await dh.run(cmd(['monitor', 'baseline', name]), { success: `Baseline of ${name} reset` }); }
async function remove(name: string) {
  const ok = await dh.confirm({ title: 'Delete Monitor?', message: `Are you sure you want to delete the monitor ${name}? Its evaluation history is lost; open incidents stay.`, yes: 'Delete', danger: true });
  if (ok) await dh.run(cmd(['monitor', 'delete', name]), { success: `Monitor ${name} deleted` });
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-mon-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 12px; }
.dh-stat { padding: 12px 16px; display: flex; flex-direction: column; }
.dh-stat__n { font-size: 24px; line-height: 32px; font-weight: 700; }
.dh-stat__n.is-bad { color: #cf1322; }
.dh-stat__n.is-ok { color: #237804; }
.dh-mon-filter { width: 260px; }
.dh-mon-sel { width: auto; }
.dh-type { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.dh-detail { font-size: 13px; color: var(--dh-text-2); min-width: 200px; overflow-wrap: anywhere; }
.dh-del:hover:not(:disabled) { color: var(--dh-danger); }
.dh-types { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 8px; }
.dh-typecard { position: relative; display: flex; gap: 10px; align-items: flex-start; padding: 10px; border: 1px solid var(--dh-border-2); border-radius: 8px; cursor: pointer; }
.dh-typecard.is-on { border-color: var(--dh-primary); background: #e6f4ff; }
.dh-typecard input { position: absolute; opacity: 0; pointer-events: none; }
.dh-typecard .dh-ico { color: var(--dh-primary); margin-top: 2px; }
.dh-typecard span { display: flex; flex-direction: column; min-width: 0; }
.dh-typecard small { color: var(--dh-text-2); font-size: 12px; line-height: 17px; }
.dh-grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; }
</style>
