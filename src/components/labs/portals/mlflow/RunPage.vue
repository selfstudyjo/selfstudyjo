<template>
  <div class="mf-page mf-runpage">
    <div v-if="!run" class="mf-empty">
      <MfIcon name="warning" />
      <h3>Run not found</h3>
      <p>Run {{ runId }} does not exist.</p>
      <button type="button" class="mf-btn" @click="back">Back to experiment</button>
    </div>
    <template v-else>
      <nav class="mf-crumbs" aria-label="Breadcrumb">
        <button type="button" @click="mf.go({ page: 'experiments', expId: run.experiment_id, mode: 'table' })">Experiments</button>
        <span class="mf-sep">/</span>
        <button type="button" @click="back">{{ expName }}</button>
        <span class="mf-sep">/</span>
      </nav>
      <div class="mf-title-row">
        <span class="mf-dot mf-runpage__dot" :style="{ background: runColor(run.run_id) }"></span>
        <h1 class="mf-title">{{ run.run_name }}</h1>
        <span class="mf-status" :class="'mf-status--' + run.status">
          <MfIcon :name="run.status === 'FINISHED' ? 'check-circle' : run.status === 'FAILED' ? 'x-circle' : 'clock'" />
        </span>
        <span v-if="run.lifecycle_stage === 'deleted'" class="mf-tag mf-runpage__deleted">Deleted</span>
        <span class="mf-menu-anchor">
          <button type="button" class="mf-btn mf-btn--icon" aria-label="Run actions" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            <MfIcon name="kebab" />
          </button>
          <div v-if="menuOpen" class="mf-menu mf-runpage__menu" @mouseleave="menuOpen = false">
            <button type="button" :disabled="run.lifecycle_stage === 'deleted'" @click="startRename">Rename</button>
            <button v-if="run.lifecycle_stage !== 'deleted'" type="button" class="is-danger" @click="remove">Delete</button>
            <button v-else type="button" @click="restore">Restore</button>
          </div>
        </span>
        <span class="mf-spacer"></span>
        <button type="button" class="mf-btn mf-btn--primary" :disabled="!run.logged_model"
                :title="run.logged_model ? '' : 'This run did not log a model'" @click="registering = true">Register model</button>
      </div>

      <div class="mf-tabs" role="tablist">
        <button v-for="t in tabs" :key="t.id" type="button" role="tab" class="mf-tab" :class="{ 'is-active': tab === t.id }"
                :aria-selected="tab === t.id" @click="setTab(t.id)">{{ t.label }}</button>
      </div>

      <div class="mf-runpage__body">
        <!-- ===== Overview ===== -->
        <template v-if="tab === 'overview'">
          <section class="mf-section">
            <div class="mf-section-head">
              <h2 class="mf-h3">Description</h2>
              <button v-if="!editingDesc" type="button" class="mf-btn mf-btn--link mf-btn--sm" aria-label="Edit description" @click="startDesc">
                <MfIcon name="pencil" />
              </button>
            </div>
            <div v-if="!editingDesc" class="mf-desc" :class="{ 'mf-desc--none': !run.description }">{{ run.description || 'No description' }}</div>
            <div v-else class="mf-runpage__descedit">
              <textarea v-model="descDraft" class="mf-textarea" rows="4" aria-label="Run description"></textarea>
              <div class="mf-runpage__acts">
                <button type="button" class="mf-btn mf-btn--primary mf-btn--sm" @click="saveDesc">Save</button>
                <button type="button" class="mf-btn mf-btn--sm" @click="editingDesc = false">Cancel</button>
              </div>
            </div>
          </section>

          <section class="mf-section">
            <h2 class="mf-h3">Details</h2>
            <dl class="mf-kv">
              <dt>Created at</dt><dd>{{ fullTime(run.start_time) }}</dd>
              <dt>Created by</dt><dd>{{ run.user }}</dd>
              <dt>Experiment ID</dt>
              <dd><button type="button" class="mf-link" @click="back">{{ run.experiment_id }}</button></dd>
              <dt>Status</dt>
              <dd><span class="mf-status" :class="'mf-status--' + run.status">
                <MfIcon :name="run.status === 'FINISHED' ? 'check-circle' : 'x-circle'" /><span>{{ statusText }}</span></span></dd>
              <dt>Run ID</dt><dd><span class="mf-mono">{{ run.run_id }}</span>
                <button type="button" class="mf-btn mf-btn--link mf-btn--sm" aria-label="Copy run ID" @click="copyId"><MfIcon name="copy" /></button></dd>
              <dt>Duration</dt><dd>{{ duration(run.duration_s) }}</dd>
              <dt>Source</dt><dd><MfIcon name="laptop" class="mf-muted" /> {{ run.source }}</dd>
              <dt>Datasets used</dt>
              <dd><span v-if="run.dataset" class="mf-tag"><MfIcon name="dataset" />{{ run.dataset.name }} ({{ run.dataset.digest }})</span>
                <span v-if="run.dataset" class="mf-muted">{{ run.dataset.rows.toLocaleString() }} rows · split: {{ run.dataset.split || 'none' }}</span>
                <span v-else class="mf-muted">-</span></dd>
              <dt>Tags</dt>
              <dd>
                <span v-for="[k, v] in tagList" :key="k" class="mf-tag" :title="k + ': ' + v"><b>{{ k }}</b><template v-if="v">: {{ v }}</template></span>
                <button type="button" class="mf-btn mf-btn--sm" @click="editingTags = true">
                  <MfIcon :name="tagList.length ? 'pencil' : 'plus'" />{{ tagList.length ? 'Edit' : 'Add' }}
                </button>
              </dd>
              <dt>Logged models</dt>
              <dd><span v-if="run.logged_model" class="mf-runpage__model"><MfIcon name="model" />{{ run.flavor }}</span><span v-else class="mf-muted">-</span></dd>
              <dt>Registered models</dt>
              <dd>
                <button v-for="reg in run.registered" :key="reg.name + reg.version" type="button" class="mf-link mf-runpage__model"
                        @click="mf.go({ page: 'version', name: reg.name, version: reg.version })"><MfIcon name="model" />{{ reg.name }} v{{ reg.version }}</button>
                <span v-if="!run.registered.length" class="mf-muted">-</span>
              </dd>
            </dl>
          </section>

          <div class="mf-runpage__tables">
            <section class="mf-section">
              <h2 class="mf-h3">Parameters ({{ paramRows.length }})</h2>
              <div class="mf-search"><MfIcon name="search" />
                <input v-model="paramQuery" class="mf-input" type="search" placeholder="Search parameters" aria-label="Search parameters" /></div>
              <div class="mf-table-wrap">
                <table class="mf-table">
                  <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
                  <tbody>
                    <tr v-for="[k, v] in paramRows" :key="k"><td>{{ k }}</td><td class="mf-mono">{{ v }}</td></tr>
                    <tr v-if="!paramRows.length"><td colspan="2" class="mf-muted">No parameters</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
            <section class="mf-section">
              <h2 class="mf-h3">Metrics ({{ metricRows.length }})</h2>
              <div class="mf-search"><MfIcon name="search" />
                <input v-model="metricQuery" class="mf-input" type="search" placeholder="Search metrics" aria-label="Search metrics" /></div>
              <div class="mf-table-wrap">
                <table class="mf-table">
                  <thead><tr><th>Metric</th><th class="mf-num">Value</th></tr></thead>
                  <tbody>
                    <tr v-for="[k, v] in metricRows" :key="k">
                      <td><button type="button" class="mf-link" @click="setTab('metrics')">{{ k }}</button></td>
                      <td class="mf-num">{{ num(v) }}</td>
                    </tr>
                    <tr v-if="!metricRows.length"><td colspan="2" class="mf-muted">No metrics</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </template>

        <!-- ===== Model metrics ===== -->
        <template v-else-if="tab === 'metrics'">
          <div v-if="!Object.keys(run.metrics).length" class="mf-empty"><MfIcon name="chart" /><h3>No metrics recorded</h3>
            <p>This run failed before it logged any metric.</p></div>
          <div v-else class="mf-runpage__charts">
            <LineChart v-for="key in historyKeys" :key="key" :title="key" :series="[{ name: run.run_name, color: runColor(run.run_id), points: run.history[key] }]" />
            <LineChart v-for="key in scalarKeys" :key="key" :title="key" bars :series="[{ name: run.run_name, color: runColor(run.run_id), points: [[0, run.metrics[key]]] }]" />
          </div>
        </template>

        <!-- ===== System metrics ===== -->
        <template v-else-if="tab === 'system'">
          <div class="mf-empty">
            <MfIcon name="server" />
            <h3>No system metrics recorded</h3>
            <p>System metrics are logged when a run starts with <code class="mf-mono">log_system_metrics=True</code>.
              <template v-if="run.memory_gb">The trainer estimated a peak of {{ run.memory_gb }} GiB of GPU memory for this run.</template></p>
          </div>
        </template>

        <!-- ===== Artifacts ===== -->
        <ArtifactBrowser v-else :run="run" @register="registering = true" />
      </div>
    </template>

    <RegisterModelModal v-if="registering && run" :run-id="run.run_id" @close="registering = false"
                        @done="(name, version) => { registering = false; mf.go({ page: 'version', name, version }); }" />
    <TagEditorModal v-if="editingTags && run" title="Add/Edit tags" :tags="userTagMap" :busy="savingTags" :error="tagError"
                    @close="editingTags = false" @save="saveTags" />
    <MfModal v-if="renaming" title="Rename Run" ok-text="Save" :ok-disabled="!nameDraft.trim()" @close="renaming = false" @ok="saveRename">
      <label class="mf-field"><span class="mf-label">New run name</span>
        <input v-model="nameDraft" class="mf-input" aria-label="New run name" @keydown.enter="saveRename" /></label>
    </MfModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import MfModal from './MfModal.vue';
import LineChart from './LineChart.vue';
import ArtifactBrowser from './ArtifactBrowser.vue';
import RegisterModelModal from './RegisterModelModal.vue';
import TagEditorModal from './TagEditorModal.vue';
import { applyTags, mlflow, useMf } from './mfContext';
import { DESCRIPTION_TAG, duration, fullTime, num, runColor, userTags } from './mlflow';

const mf = useMf();
const runId = computed(() => (mf.route.value.page === 'run' ? mf.route.value.runId : ''));
const tab = computed(() => (mf.route.value.page === 'run' ? mf.route.value.tab : 'overview'));
const run = computed(() => mf.findRun(runId.value));
const expName = computed(() => mf.experiment(run.value?.experiment_id || '0')?.name || 'Default');
const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'metrics', label: 'Model metrics' },
  { id: 'system', label: 'System metrics' },
  { id: 'artifacts', label: 'Artifacts' },
] as const;
function setTab(id: 'overview' | 'metrics' | 'system' | 'artifacts') {
  if (!run.value) return;
  mf.go({ page: 'run', expId: run.value.experiment_id, runId: run.value.run_id, tab: id });
}
function back() {
  mf.go({ page: 'experiments', expId: run.value?.experiment_id || '0', mode: 'table' });
}
const menuOpen = ref(false);
const statusText = computed(() => ({ FINISHED: 'Finished', FAILED: 'Failed', RUNNING: 'Running' } as Record<string, string>)[run.value?.status || ''] || run.value?.status);

const paramQuery = ref('');
const metricQuery = ref('');
const paramRows = computed(() => Object.entries(run.value?.params || {})
  .filter(([k, v]) => (k + ' ' + v).toLowerCase().includes(paramQuery.value.toLowerCase())).sort());
const metricRows = computed(() => Object.entries(run.value?.metrics || {})
  .filter(([k]) => k.toLowerCase().includes(metricQuery.value.toLowerCase())).sort());
const historyKeys = computed(() => Object.keys(run.value?.history || {}).sort());
const scalarKeys = computed(() => Object.keys(run.value?.metrics || {}).filter(k => !(run.value?.history[k]?.length)).sort());
const tagList = computed(() => userTags(run.value?.tags || {}));
const userTagMap = computed(() => Object.fromEntries(tagList.value));

function copyId() {
  if (!run.value) return;
  navigator.clipboard?.writeText(run.value.run_id).catch(() => undefined);
  mf.notify('success', 'Copied run ID');
}

const editingDesc = ref(false);
const descDraft = ref('');
function startDesc() {
  descDraft.value = run.value?.description || '';
  editingDesc.value = true;
}
async function saveDesc() {
  const r = run.value;
  if (!r) return;
  const text = descDraft.value;
  if (!text.trim() && !r.description) { editingDesc.value = false; return; }
  const command = text.trim()
    ? mlflow(['runs', 'set-tag'], { '--run-id': r.run_id, '--key': DESCRIPTION_TAG }, { '--value': text })
    : mlflow(['runs', 'delete-tag'], { '--run-id': r.run_id, '--key': DESCRIPTION_TAG });
  const result = await mf.run(command);
  if (result.ok) editingDesc.value = false;
}

const editingTags = ref(false);
const savingTags = ref(false);
const tagError = ref('');
async function saveTags(changes: { set: [string, string][]; remove: string[] }) {
  if (!run.value) return;
  savingTags.value = true;
  tagError.value = await applyTags(mf, 'runs', { '--run-id': run.value.run_id }, changes);
  savingTags.value = false;
  if (!tagError.value) editingTags.value = false;
}

const renaming = ref(false);
const nameDraft = ref('');
function startRename() {
  menuOpen.value = false;
  nameDraft.value = run.value?.run_name || '';
  renaming.value = true;
}
async function saveRename() {
  if (!run.value || !nameDraft.value.trim()) return;
  const result = await mf.run(mlflow(['runs', 'rename'], { '--run-id': run.value.run_id, '--new-name': nameDraft.value.trim() }),
                              { success: 'Run renamed' });
  if (result.ok) renaming.value = false;
}
async function remove() {
  menuOpen.value = false;
  const r = run.value;
  if (!r) return;
  const yes = await mf.confirm({ title: 'Delete Experiment Runs', yes: 'Delete', danger: true, message: '1 experiment run will be deleted.' });
  if (!yes) return;
  await mf.run(mlflow(['runs', 'delete'], { '--run-id': r.run_id }), { success: `Run ${r.run_name} deleted` });
}
async function restore() {
  menuOpen.value = false;
  const r = run.value;
  if (!r) return;
  await mf.run(mlflow(['runs', 'restore'], { '--run-id': r.run_id }), { success: `Run ${r.run_name} restored` });
}

const registering = ref(false);
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-runpage { flex: 1; overflow: auto; }
.mf-runpage__dot { width: 14px; height: 14px; }
.mf-runpage__menu { top: 34px; left: 0; }
.mf-runpage__deleted { background: #FFF5F7; color: var(--mf-danger); }
.mf-runpage__body { display: flex; flex-direction: column; gap: 20px; padding-top: 4px; }
.mf-runpage__descedit { display: flex; flex-direction: column; gap: 6px; max-width: 760px; }
.mf-runpage__acts { display: flex; gap: 6px; }
.mf-runpage__model { display: inline-flex; align-items: center; gap: 4px; margin-right: 8px; }
.mf-runpage__tables { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 20px; }
.mf-runpage__charts { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 12px; }
@container sl-portal (max-width: 900px) {
  .mf-runpage { padding: 12px; }
}
@container sl-portal (max-width: 520px) {
  .mf-kv { grid-template-columns: minmax(0, 1fr); }
  .mf-kv > dt { border-bottom: 0; padding-bottom: 0; }
}
</style>
