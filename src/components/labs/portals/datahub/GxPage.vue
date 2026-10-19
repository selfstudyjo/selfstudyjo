<template>
  <div class="dh-page">
    <div class="dh-page-head">
      <div>
        <h1 class="dh-title"><span class="dh-gx-logo" aria-hidden="true">GX</span> Great Expectations</h1>
        <p class="dh-subtitle">Expectation suites run as real queries against the asset; every checkpoint run reports its results to DataHub as assertions.</p>
      </div>
      <button type="button" class="dh-btn" :disabled="dh.busy.value" @click="buildDocs"><DhIcon name="docs" /> Build Data Docs</button>
    </div>
    <div v-if="dh.docsBuilt.value" class="dh-alert dh-alert--success"><DhIcon name="check-circle" /><div>Data Docs are built at <code>gx/uncommitted/data_docs/local_site/index.html</code>.</div></div>

    <nav class="dh-tabs" aria-label="Great Expectations">
      <button type="button" :class="{ 'is-active': tab === 'checkpoints' }" @click="tab = 'checkpoints'">Checkpoints <span class="dh-count">{{ dh.checkpoints.value.length }}</span></button>
      <button type="button" :class="{ 'is-active': tab === 'suites' }" @click="tab = 'suites'">Expectation Suites <span class="dh-count">{{ dh.suites.value.length }}</span></button>
      <button type="button" :class="{ 'is-active': tab === 'results' }" @click="tab = 'results'">Validation Results <span class="dh-count">{{ dh.results.value.length }}</span></button>
      <button type="button" :class="{ 'is-active': tab === 'profile' }" @click="tab = 'profile'">Profiling</button>
    </nav>

    <!-- ===== Checkpoints ===== -->
    <template v-if="tab === 'checkpoints'">
      <div class="dh-row"><span class="dh-spacer" />
        <button type="button" class="dh-btn dh-btn--primary" :disabled="!dh.suites.value.length" @click="cpForm = { name: '', suite: dh.suites.value[0]?.name || '', asset: '' }"><DhIcon name="plus" /> New Checkpoint</button>
      </div>
      <div v-if="!dh.checkpoints.value.length" class="dh-card dh-empty"><DhIcon name="quality" />
        <span>No checkpoints yet.{{ dh.suites.value.length ? '' : ' Create an expectation suite first.' }}</span></div>
      <div v-else class="dh-table-wrap">
        <table class="dh-table">
          <thead><tr><th>Checkpoint</th><th>Suite</th><th>Asset</th><th>Last result</th><th class="dh-actions">Actions</th></tr></thead>
          <tbody>
            <tr v-for="c in dh.checkpoints.value" :key="c.name">
              <td><b>{{ c.name }}</b></td><td>{{ c.suite }}</td>
              <td class="dh-mono">{{ c.asset || suiteAsset(c.suite) + ' (suite asset)' }}</td>
              <td><span v-if="c.last_result" class="dh-pill" :class="c.last_result === 'success' ? 'dh-pill--ok' : 'dh-pill--bad'">{{ c.last_result === 'success' ? 'Success' : 'Failure' }}</span><span v-else class="dh-muted">Never run</span></td>
              <td class="dh-actions">
                <button type="button" class="dh-btn dh-btn--sm dh-btn--primary" :disabled="dh.busy.value" @click="runCp(c.name)"><DhIcon name="play" :size="11" /> Run</button>
                <button type="button" class="dh-btn dh-btn--sm dh-btn--text dh-del" :disabled="dh.busy.value" :aria-label="'Delete ' + c.name" @click="deleteCp(c.name)"><DhIcon name="trash" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="lastOutput" class="dh-card"><div class="dh-card__head"><h3 class="dh-h4">Last run output</h3><span class="dh-spacer" />
        <button type="button" class="dh-btn dh-btn--text dh-btn--sm dh-btn--icon" aria-label="Close output" @click="lastOutput = ''"><DhIcon name="close" /></button></div>
        <div class="dh-card__body"><pre class="dh-pre">{{ lastOutput }}</pre></div></div>
    </template>

    <!-- ===== Suites ===== -->
    <template v-else-if="tab === 'suites'">
      <div class="dh-row"><span class="dh-spacer" />
        <button type="button" class="dh-btn dh-btn--primary" @click="suiteForm = { name: '', asset: queryable[0]?.urn || '' }"><DhIcon name="plus" /> New Suite</button>
      </div>
      <div v-if="!dh.suites.value.length" class="dh-card dh-empty"><DhIcon name="doc" /><span>No expectation suites. Suites are JSON files in <code>gx/suites/</code>.</span></div>
      <div v-for="err in suiteErrors" :key="err.path" class="dh-alert dh-alert--error"><DhIcon name="x-circle" /><div><b>{{ err.path }}</b>: {{ err.error }}</div></div>
      <section v-for="s in dh.suites.value" :key="s.name" class="dh-card">
        <div class="dh-card__head">
          <DhIcon name="doc" /><b>{{ s.name }}</b>
          <button v-if="s.asset && dh.dataset(s.asset)" type="button" class="dh-link dh-mono" @click="dh.openEntity(s.asset, 'Quality')">{{ s.asset }}</button>
          <span v-else class="dh-mono dh-muted">{{ s.asset || 'no asset' }}</span>
          <span class="dh-spacer" />
          <button type="button" class="dh-btn dh-btn--sm" @click="openExp(s.name, s.asset || '')"><DhIcon name="plus" :size="11" /> Add Expectation</button>
          <button type="button" class="dh-btn dh-btn--sm" :disabled="dh.busy.value || !s.expectations.length" @click="validateSuite(s.name)"><DhIcon name="play" :size="11" /> Validate</button>
          <button type="button" class="dh-btn dh-btn--sm dh-btn--text dh-del" :disabled="dh.busy.value" :aria-label="'Delete suite ' + s.name" @click="deleteSuite(s.name)"><DhIcon name="trash" /></button>
        </div>
        <div class="dh-card__body">
          <div v-if="!s.expectations.length" class="dh-muted">No expectations yet.</div>
          <table v-else class="dh-table">
            <thead><tr><th>#</th><th>Expectation</th><th>Arguments</th><th /></tr></thead>
            <tbody>
              <tr v-for="(x, i) in s.expectations" :key="i">
                <td>{{ i + 1 }}</td>
                <td><b class="dh-cap">{{ humanType(x.type) }}</b><div class="dh-mono dh-muted">{{ x.type }}</div></td>
                <td class="dh-mono">{{ kw(x.kwargs) }}</td>
                <td class="dh-actions"><button type="button" class="dh-btn dh-btn--sm dh-btn--text dh-del" :disabled="dh.busy.value" :aria-label="'Remove expectation ' + (i + 1)" @click="removeExp(s.name, i + 1, x.type)"><DhIcon name="trash" /></button></td>
              </tr>
            </tbody>
          </table>
          <div class="dh-mono dh-muted dh-path">{{ s.path }}</div>
        </div>
      </section>
    </template>

    <!-- ===== Results ===== -->
    <template v-else-if="tab === 'results'">
      <div v-if="!dh.results.value.length" class="dh-card dh-empty"><DhIcon name="quality" /><span>No validation results yet. Run a checkpoint.</span></div>
      <section v-for="r in resultsNewestFirst" :key="r.id" class="dh-card">
        <button type="button" class="dh-card__head dh-reshead" :aria-expanded="openResult === r.id" @click="openResult = openResult === r.id ? '' : r.id">
          <DhIcon :name="r.success ? 'check-circle' : 'x-circle'" :class="r.success ? 'is-ok' : 'is-bad'" />
          <b>{{ r.success ? 'Success' : 'Failure' }}</b>
          <span class="dh-mono">{{ r.id }}</span>
          <span class="dh-muted">suite {{ r.suite }}<template v-if="r.checkpoint"> · checkpoint {{ r.checkpoint }}</template></span>
          <span class="dh-mono dh-muted">{{ r.asset }}</span>
          <span class="dh-spacer" />
          <span class="dh-muted">{{ r.successful }}/{{ r.evaluated }} met · {{ r.time }}</span>
          <DhIcon :name="openResult === r.id ? 'chevron-down' : 'chevron-right'" />
        </button>
        <div v-if="openResult === r.id" class="dh-card__body">
          <table class="dh-table">
            <thead><tr><th>Status</th><th>Expectation</th><th>Column</th><th>Observed</th><th>Unexpected</th><th>Sample</th></tr></thead>
            <tbody>
              <tr v-for="(d, i) in r.details" :key="i">
                <td><span class="dh-pill" :class="d.success ? 'dh-pill--ok' : 'dh-pill--bad'">{{ d.success ? 'Pass' : 'Fail' }}</span></td>
                <td class="dh-cap">{{ humanType(d.type) }}</td><td class="dh-mono">{{ d.column || '—' }}</td>
                <td class="dh-mono">{{ d.error || String(d.observed) }}</td>
                <td>{{ d.unexpected_count }} ({{ d.unexpected_percent }}%)</td>
                <td class="dh-mono">{{ (d.partial || []).map(v => v === null ? 'null' : String(v)).join(', ') || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- ===== Profiling ===== -->
    <template v-else>
      <section class="dh-card">
        <div class="dh-card__head"><h3 class="dh-h4">Profile an asset</h3></div>
        <div class="dh-card__body dh-row">
          <select v-model="profileAsset" class="dh-select dh-prof-sel" aria-label="Asset to profile">
            <option value="" disabled>Select a dataset</option>
            <option v-for="d in queryable" :key="d.urn" :value="d.urn">{{ d.urn }}</option>
          </select>
          <button type="button" class="dh-btn dh-btn--primary" :disabled="dh.busy.value || !profileAsset" @click="profile"><DhIcon name="chart" /> Profile</button>
        </div>
      </section>
      <section v-for="p in profilesNewestFirst" :key="p.asset" class="dh-card">
        <div class="dh-card__head"><b class="dh-mono">{{ p.asset }}</b><span class="dh-muted">{{ p.rows.toLocaleString() }} rows</span></div>
        <div class="dh-card__body dh-scroll">
          <table class="dh-table">
            <thead><tr><th>Column</th><th>Type</th><th>Nulls</th><th>Null %</th><th>Distinct</th><th>Min</th><th>Max</th></tr></thead>
            <tbody>
              <tr v-for="c in p.columns" :key="c.column">
                <td class="dh-mono"><b>{{ c.column }}</b></td><td class="dh-mono">{{ c.type }}</td><td>{{ c.nulls }}</td>
                <td><span class="dh-bar"><span :style="{ width: Math.min(100, c.null_pct) + '%' }" /></span> {{ c.null_pct }}%</td>
                <td>{{ c.distinct }}</td><td class="dh-mono">{{ c.min }}</td><td class="dh-mono">{{ c.max }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- New checkpoint -->
    <DhModal v-if="cpForm" title="New Checkpoint" ok-text="Create" :ok-disabled="!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cpForm.name) || !cpForm.suite"
             :busy="dh.busy.value" @close="cpForm = null" @ok="createCp">
      <div class="dh-field"><span class="dh-label"><b>*</b>Name</span>
        <input v-model="cpForm.name" class="dh-input" placeholder="orders_daily" aria-label="Checkpoint name" />
        <span class="dh-hint">Letters, digits and underscores.</span></div>
      <div class="dh-field"><span class="dh-label"><b>*</b>Expectation suite</span>
        <select v-model="cpForm.suite" class="dh-select" aria-label="Suite"><option v-for="s in dh.suites.value" :key="s.name" :value="s.name">{{ s.name }}</option></select></div>
      <div class="dh-field"><span class="dh-label">Asset override</span>
        <select v-model="cpForm.asset" class="dh-select" aria-label="Asset override"><option value="">Use the suite's asset</option>
          <option v-for="d in queryable" :key="d.urn" :value="d.urn">{{ d.urn }}</option></select></div>
    </DhModal>

    <!-- New suite -->
    <DhModal v-if="suiteForm" title="New Expectation Suite" ok-text="Create" :ok-disabled="!/^[A-Za-z_][A-Za-z0-9_]*$/.test(suiteForm.name) || !suiteForm.asset"
             :busy="dh.busy.value" @close="suiteForm = null" @ok="createSuite">
      <div class="dh-field"><span class="dh-label"><b>*</b>Suite name</span>
        <input v-model="suiteForm.name" class="dh-input" placeholder="orders_suite" aria-label="Suite name" /></div>
      <div class="dh-field"><span class="dh-label"><b>*</b>Asset</span>
        <select v-model="suiteForm.asset" class="dh-select" aria-label="Asset"><option v-for="d in queryable" :key="d.urn" :value="d.urn">{{ d.urn }}</option></select>
        <span class="dh-hint">Written to gx/suites/&lt;name&gt;.json</span></div>
    </DhModal>

    <!-- Add expectation -->
    <DhModal v-if="expForm" :title="'Add Expectation to ' + expForm.suite" ok-text="Add" :ok-disabled="!expValid" :busy="dh.busy.value" :width="600"
             @close="expForm = null" @ok="addExp">
      <div class="dh-field"><span class="dh-label"><b>*</b>Expectation</span>
        <select v-model="expForm.type" class="dh-select" aria-label="Expectation type">
          <option v-for="x in EXPECTATIONS" :key="x.type" :value="x.type">{{ x.label }} ({{ x.type }})</option></select></div>
      <div v-if="spec.column" class="dh-field"><span class="dh-label"><b>*</b>Column</span>
        <select v-model="expForm.column" class="dh-select" aria-label="Column"><option value="" disabled>Select a column</option>
          <option v-for="c in expColumns" :key="c" :value="c">{{ c }}</option></select></div>
      <div v-if="spec.compound" class="dh-field"><span class="dh-label"><b>*</b>Columns (at least two)</span>
        <div class="dh-chkgrid"><label v-for="c in expColumns" :key="c"><input v-model="expForm.columns" type="checkbox" :value="c" /> {{ c }}</label></div></div>
      <div v-if="spec.range" class="dh-grid2">
        <div class="dh-field"><span class="dh-label">Min value</span><input v-model="expForm.min" class="dh-input" aria-label="Min value" placeholder="e.g. 0 or now-24h" /></div>
        <div class="dh-field"><span class="dh-label">Max value</span><input v-model="expForm.max" class="dh-input" aria-label="Max value" placeholder="e.g. 1000" /></div>
      </div>
      <div v-if="spec.set" class="dh-field"><span class="dh-label"><b>*</b>Value set</span>
        <input v-model="expForm.values" class="dh-input" placeholder="placed,paid,shipped,delivered" aria-label="Value set" />
        <span class="dh-hint">Comma separated.</span></div>
      <div v-if="spec.regex" class="dh-field"><span class="dh-label"><b>*</b>Regex</span>
        <input v-model="expForm.regex" class="dh-input dh-mono" placeholder="^[^@]+@[^@]+$" aria-label="Regex" /></div>
      <div v-if="spec.column || spec.compound" class="dh-field"><span class="dh-label">Mostly</span>
        <input v-model="expForm.mostly" class="dh-input" placeholder="1.0" aria-label="Mostly" />
        <span class="dh-hint">Fraction of rows that must meet it, 0 to 1. Empty means all.</span></div>
    </DhModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import DhIcon from './DhIcon.vue';
import DhModal from './DhModal.vue';
import { EXPECTATIONS, dh as cmd, humanType, isQueryable, useDh } from './dhContext';

const dh = useDh();
const tab = ref<'checkpoints' | 'suites' | 'results' | 'profile'>('checkpoints');
const openResult = ref('');
const lastOutput = ref('');
const profileAsset = ref('');
const cpForm = ref<{ name: string; suite: string; asset: string } | null>(null);
const suiteForm = ref<{ name: string; asset: string } | null>(null);
const expForm = ref<{ suite: string; asset: string; type: string; column: string; columns: string[]; min: string; max: string; values: string; regex: string; mostly: string } | null>(null);

const queryable = computed(() => dh.datasets.value.filter(d => isQueryable(d.urn)));
const resultsNewestFirst = computed(() => dh.results.value.slice().reverse());
const profilesNewestFirst = computed(() => dh.profiles.value.slice().reverse());
const suiteErrors = computed(() => dh.suiteErrors.value);

const spec = computed(() => EXPECTATIONS.find(x => x.type === expForm.value?.type) || EXPECTATIONS[0]!);
const expColumns = computed(() => dh.dataset(expForm.value?.asset || '')?.columns.map(c => c.name) || []);
const expValid = computed(() => {
  const f = expForm.value;
  if (!f) return false;
  const s = spec.value;
  if (s.column && !f.column) return false;
  if (s.compound && f.columns.length < 2) return false;
  if (s.range && !f.min.trim() && !f.max.trim()) return false;
  if (s.set && !f.values.trim()) return false;
  if (s.regex && !f.regex.trim()) return false;
  return true;
});

watch(() => expForm.value?.type, () => { if (expForm.value) { expForm.value.column = ''; expForm.value.columns = []; } });

function suiteAsset(name: string) {
  return dh.suites.value.find(s => s.name === name)?.asset || '?';
}

function kw(kwargs: Record<string, any>) {
  return Object.entries(kwargs || {}).map(([k, v]) => `${k}=${Array.isArray(v) ? '[' + v.join(', ') + ']' : v}`).join(', ') || '—';
}

async function runCp(name: string) {
  const result = await dh.run(cmd(['gx', 'checkpoint', 'run', name]), { quiet: true });
  lastOutput.value = String(result.ok ? result.output || '' : result.error || result.output || '');
  if (result.ok) dh.notify('success', `Checkpoint ${name} passed`);
  else dh.notify('error', `Checkpoint ${name} failed`, 'One or more expectations were not met.');
}

async function deleteCp(name: string) {
  const ok = await dh.confirm({ title: 'Delete Checkpoint?', message: `Delete checkpoint ${name}? Its past validation results are kept.`, yes: 'Delete', danger: true });
  if (ok) await dh.run(cmd(['gx', 'checkpoint', 'delete', name]), { success: `Checkpoint ${name} deleted` });
}

async function createCp() {
  const f = cpForm.value;
  if (!f) return;
  const result = await dh.run(cmd(['gx', 'checkpoint', 'new', f.name], { '--suite': f.suite, '--asset': f.asset || null }), { success: `Checkpoint ${f.name} created` });
  if (result.ok) cpForm.value = null;
}

async function createSuite() {
  const f = suiteForm.value;
  if (!f) return;
  const result = await dh.run(cmd(['gx', 'suite', 'new', f.name], { '--asset': f.asset }), { success: `Expectation suite ${f.name} created` });
  if (result.ok) suiteForm.value = null;
}

function openExp(suite: string, asset: string) {
  expForm.value = { suite, asset, type: EXPECTATIONS[0]!.type, column: '', columns: [], min: '', max: '', values: '', regex: '', mostly: '' };
}

async function addExp() {
  const f = expForm.value;
  if (!f || !expValid.value) return;
  const s = spec.value;
  const flags: Record<string, string | null> = {};
  if (s.column) flags['--column'] = f.column;
  if (s.compound) flags['--columns'] = f.columns.join(',');
  const text: Record<string, string> = {};
  if (s.range && f.min.trim()) text['--min'] = f.min.trim();
  if (s.range && f.max.trim()) text['--max'] = f.max.trim();
  if (s.set) flags['--value-set'] = f.values.split(',').map(v => v.trim()).filter(Boolean).join(',');
  if (s.regex) text['--regex'] = f.regex.trim();
  if ((s.column || s.compound) && f.mostly.trim()) flags['--mostly'] = f.mostly.trim();
  const result = await dh.run(cmd(['gx', 'suite', 'add', f.suite, f.type], flags, text), { success: 'Expectation added' });
  if (result.ok) expForm.value = null;
}

async function removeExp(suite: string, n: number, type: string) {
  const ok = await dh.confirm({ title: 'Remove Expectation?', message: `Remove #${n} ${type} from suite ${suite}?`, yes: 'Remove', danger: true });
  if (ok) await dh.run(cmd(['gx', 'suite', 'remove', suite, String(n)]), { success: 'Expectation removed' });
}

async function validateSuite(name: string) {
  const result = await dh.run(cmd(['gx', 'validate', name]), { quiet: true });
  lastOutput.value = String(result.ok ? result.output || '' : result.error || result.output || '');
  if (result.ok) dh.notify('success', `Suite ${name}: all expectations met`);
  else dh.notify('error', `Suite ${name}: validation failed`, 'See Validation Results.');
}

async function deleteSuite(name: string) {
  const ok = await dh.confirm({ title: 'Delete Suite?', message: `Delete expectation suite ${name} (gx/suites/${name}.json)? Checkpoints that use it will stop working.`, yes: 'Delete', danger: true, typeToConfirm: name });
  if (ok) await dh.run(cmd(['gx', 'suite', 'delete', name]), { success: `Suite ${name} deleted` });
}

async function buildDocs() {
  await dh.run(cmd(['gx', 'docs', 'build']), { success: 'Data Docs built' });
}

async function profile() {
  await dh.run(cmd(['gx', 'profile', profileAsset.value]), { success: 'Profile complete' });
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-gx-logo { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 6px; background: #ff6310; color: #fff; font-size: 13px; font-weight: 800; vertical-align: 3px; margin-right: 6px; }
.dh-alert code, .dh-empty code { background: rgba(0, 0, 0, .05); padding: 0 4px; border-radius: 3px; font-family: var(--dh-mono); font-size: 12px; }
.dh-del:hover:not(:disabled) { color: var(--dh-danger); }
.dh-cap { text-transform: capitalize; }
.dh-path { margin-top: 8px; }
.dh-reshead { width: 100%; border: 0; border-bottom: 1px solid var(--dh-border); background: none; font: inherit; text-align: left; cursor: pointer; color: var(--dh-text); }
.dh-reshead:hover { background: #fafafa; }
.dh-reshead .is-ok { color: #52c41a; }
.dh-reshead .is-bad { color: #ff4d4f; }
.dh-prof-sel { width: auto; min-width: 280px; max-width: 100%; }
.dh-scroll { overflow: auto; }
.dh-bar { display: inline-block; width: 60px; height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; vertical-align: middle; margin-right: 4px; }
.dh-bar span { display: block; height: 100%; background: #fa8c16; }
.dh-grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px; }
.dh-chkgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px 12px; font-size: 13px; }
.dh-chkgrid input { accent-color: var(--dh-primary); }
</style>
