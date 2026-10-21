<template>
  <div ref="root" class="mf-exp">
    <ExperimentList :collapsed="listHidden" @collapse="listHidden = true" @picked="onPicked" />
    <section class="mf-exp__main">
      <div v-if="!experiment" class="mf-empty">
        <MfIcon name="warning" />
        <h3>Experiment not found</h3>
        <p>No experiment with ID {{ expId }} exists (it may have been deleted).</p>
        <button type="button" class="mf-btn" @click="mf.go({ page: 'experiments', expId: '0', mode: 'table' })">Go to Default</button>
      </div>
      <template v-else>
        <div class="mf-exp__head">
          <button v-if="listHidden" type="button" class="mf-btn mf-btn--icon" title="Show experiment list" aria-label="Show experiment list"
                  @click="listHidden = false"><MfIcon name="menu" /></button>
          <h1 class="mf-title">{{ experiment.name }}</h1>
          <span v-if="experiment.lifecycle_stage === 'deleted'" class="mf-tag mf-exp__deleted">Deleted</span>
          <button type="button" class="mf-btn mf-btn--icon" aria-label="Experiment actions" title="More actions"
                  @click="expMenu"><MfIcon name="kebab" /></button>
          <span class="mf-spacer"></span>
          <span class="mf-muted mf-exp__id">Experiment ID: <span class="mf-mono">{{ experiment.id }}</span></span>
        </div>

        <!-- Description: the experiment's mlflow.note.content tag -->
        <div class="mf-exp__desc">
          <template v-if="!editingDesc">
            <span v-if="experiment.description" class="mf-desc">{{ experiment.description }}</span>
            <button type="button" class="mf-link mf-exp__desc-btn" @click="startDesc">
              <MfIcon name="pencil" />{{ experiment.description ? 'Edit description' : 'Add Description' }}
            </button>
          </template>
          <div v-else class="mf-exp__desc-edit">
            <textarea v-model="descDraft" class="mf-textarea" rows="3" aria-label="Experiment description"></textarea>
            <div class="mf-exp__desc-acts">
              <button type="button" class="mf-btn mf-btn--primary mf-btn--sm" @click="saveDesc">Save</button>
              <button type="button" class="mf-btn mf-btn--sm" @click="editingDesc = false">Cancel</button>
            </div>
          </div>
        </div>

        <!-- View toggle: Table / Chart / Evaluation / Traces -->
        <div class="mf-exp__bar">
          <div class="mf-seg" role="tablist" aria-label="View mode">
            <button v-for="m in modes" :key="m.id" type="button" role="tab" :aria-selected="mode === m.id"
                    :class="{ 'is-active': mode === m.id }" @click="setMode(m.id)">
              <MfIcon :name="m.icon" /><span class="mf-exp__seglabel">{{ m.label }}</span>
            </button>
          </div>
          <form class="mf-search mf-exp__search" role="search" @submit.prevent="applySearch">
            <MfIcon name="search" />
            <input v-model="searchDraft" class="mf-input" type="search" aria-label="Search runs"
                   placeholder='metrics.rmse < 1 and params.model = "tree"' @blur="applySearch" />
          </form>
          <select v-model="timeWindow" class="mf-select" aria-label="Time created">
            <option value="all">Time created: All time</option>
            <option value="1h">Time created: Last hour</option>
            <option value="24h">Time created: Last 24 hours</option>
            <option value="7d">Time created: Last 7 days</option>
          </select>
          <select v-model="lifecycle" class="mf-select" aria-label="State">
            <option value="active">State: Active</option>
            <option value="deleted">State: Deleted</option>
          </select>
          <select v-model="sortKey" class="mf-select" aria-label="Sort">
            <option value="created">Sort: Created</option>
            <option value="run_name">Sort: Run Name</option>
            <option value="duration">Sort: Duration</option>
            <option v-for="key in metricKeys" :key="key" :value="'metric:' + key">Sort: {{ key }}</option>
            <option v-for="key in paramKeys" :key="'p' + key" :value="'param:' + key">Sort: params.{{ key }}</option>
          </select>
          <button type="button" class="mf-btn mf-btn--icon" :title="sort.dir === 'asc' ? 'Ascending' : 'Descending'"
                  :aria-label="'Sort direction: ' + (sort.dir === 'asc' ? 'ascending' : 'descending')"
                  @click="sort = { key: sort.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }">{{ sort.dir === 'asc' ? '↑' : '↓' }}</button>
          <button type="button" class="mf-btn mf-btn--icon" title="Refresh" aria-label="Refresh" @click="mf.notify('info', 'Runs are up to date')">
            <MfIcon name="refresh" />
          </button>
        </div>

        <div v-if="experiment.lifecycle_stage === 'deleted'" class="mf-alert mf-alert--warning">
          <MfIcon name="warning" /><span>This experiment is deleted. Its runs stay in the tracking store until it is restored.</span>
          <button type="button" class="mf-btn mf-btn--sm" @click="restoreExperiment">Restore experiment</button>
        </div>

        <!-- Experiment tags, as the header shows them -->
        <div v-if="expTags.length" class="mf-tags mf-exp__tags">
          <span v-for="[k, v] in expTags" :key="k" class="mf-tag" :title="k + ': ' + v"><b>{{ k }}</b><template v-if="v">: {{ v }}</template></span>
          <button type="button" class="mf-btn mf-btn--link mf-btn--sm" @click="startTags"><MfIcon name="pencil" />Edit tags</button>
        </div>

        <div v-if="filter.error" class="mf-alert mf-alert--error">
          <MfIcon name="x-circle" /><span>{{ filter.error }}</span>
        </div>

        <!-- Actions on the selected runs -->
        <div v-if="mode !== 'traces' && selected.length" class="mf-exp__selbar">
          <span class="mf-muted">{{ selected.length }} selected</span>
          <button type="button" class="mf-btn" :disabled="selected.length < 2" @click="compare">Compare</button>
          <button type="button" class="mf-btn" :disabled="selected.length !== 1 || lifecycle === 'deleted'" @click="startRunRename">Rename</button>
          <button v-if="lifecycle === 'active'" type="button" class="mf-btn mf-btn--danger-ghost" @click="runDeleting = true">Delete</button>
          <button v-else type="button" class="mf-btn" @click="restoreRuns">Restore</button>
          <button type="button" class="mf-btn mf-btn--link" @click="selected = []">Clear selection</button>
        </div>

        <div class="mf-exp__content">
          <RunsTable v-if="mode === 'table'" v-model:selected="selected" v-model:sort="sort" :runs="filtered"
                     :deleted="lifecycle === 'deleted'" @action="onRunAction" />
          <RunsCharts v-else-if="mode === 'chart'" :runs="filtered" />
          <EvaluationView v-else-if="mode === 'evaluation'" :runs="filtered" />
          <div v-else class="mf-empty">
            <MfIcon name="traces" />
            <h3>No traces recorded</h3>
            <p>Traces are recorded by MLflow Tracing (<code class="mf-mono">mlflow.trace</code>, autologging for
              GenAI libraries). Nothing in this lab is instrumented with tracing, so this experiment has none.</p>
          </div>
        </div>
      </template>
    </section>

    <MfModal v-if="renaming" title="Rename Experiment" ok-text="Save" :ok-disabled="!renameDraft.trim()" @close="renaming = false" @ok="saveRename">
      <label class="mf-field">
        <span class="mf-label">New experiment name</span>
        <input v-model="renameDraft" class="mf-input" aria-label="New experiment name" @keydown.enter="saveRename" />
      </label>
      <div v-if="formError" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ formError }}</span></div>
    </MfModal>

    <MfModal v-if="runRenaming" title="Rename Run" ok-text="Save" :ok-disabled="!runNameDraft.trim()" @close="runRenaming = null" @ok="saveRunRename">
      <label class="mf-field">
        <span class="mf-label">New run name</span>
        <input v-model="runNameDraft" class="mf-input" aria-label="New run name" @keydown.enter="saveRunRename" />
      </label>
    </MfModal>

    <MfModal v-if="descRun" title="Edit description" ok-text="Save" :busy="saving" @close="descRun = null" @ok="saveRunDesc">
      <label class="mf-field">
        <span class="mf-label">Description of {{ descRun.run_name }}</span>
        <textarea v-model="runDescDraft" class="mf-textarea" rows="5" aria-label="Run description"></textarea>
        <span class="mf-hint">Stored as the run's <code class="mf-mono">mlflow.note.content</code> tag. Leave it empty to clear it.</span>
      </label>
    </MfModal>

    <RegisterModelModal v-if="registerRun" :run-id="registerRun" @close="registerRun = ''"
                        @done="(name, version) => { registerRun = ''; mf.go({ page: 'version', name, version }); }" />

    <TagEditorModal v-if="taggingExp && experiment" :title="`Add/Edit tags for ${experiment.name}`" :tags="experiment.tags"
                    :busy="saving" :error="formError" @close="taggingExp = false" @save="saveExpTags" />

    <MfModal v-if="runDeleting" title="Delete Experiment Runs" ok-text="Delete" danger @close="runDeleting = false" @ok="deleteRuns">
      <p class="mf-p">{{ selected.length }} experiment run{{ selected.length === 1 ? '' : 's' }} will be deleted.</p>
      <p class="mf-p mf-muted">Deleted runs can be restored from the State: Deleted view.</p>
    </MfModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MfIcon from './MfIcon.vue';
import MfModal from './MfModal.vue';
import ExperimentList from './ExperimentList.vue';
import RunsTable from './RunsTable.vue';
import RunsCharts from './RunsCharts.vue';
import EvaluationView from './EvaluationView.vue';
import RegisterModelModal from './RegisterModelModal.vue';
import TagEditorModal from './TagEditorModal.vue';
import { DESCRIPTION_TAG, parseFilter, parseStamp, runMatches, sortRuns, userTags, type MfRun, type RunAction,
         type RunsSort, type RunsViewMode } from './mlflow';
import { applyTags, mlflow, useMf } from './mfContext';

const mf = useMf();
const expId = computed(() => (mf.route.value.page === 'experiments' ? mf.route.value.expId : '0'));
const mode = computed<RunsViewMode>(() => (mf.route.value.page === 'experiments' ? mf.route.value.mode : 'table'));
const experiment = computed(() => mf.experiment(expId.value));
const listHidden = ref(false);
const root = ref<HTMLElement | null>(null);
let observer: ResizeObserver | null = null;
let wasNarrow = false;
onMounted(() => {
  // Under ~900px the experiment list is a drawer over the runs, closed by default.
  observer = new ResizeObserver(() => {
    const narrow = (root.value?.clientWidth || 1000) < 900;
    if (narrow && !wasNarrow) listHidden.value = true;
    if (!narrow && wasNarrow) listHidden.value = false;
    wasNarrow = narrow;
  });
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());
function onPicked() {
  if (wasNarrow) listHidden.value = true;
}

const modes: { id: RunsViewMode; label: string; icon: string }[] = [
  { id: 'table', label: 'Table', icon: 'table' },
  { id: 'chart', label: 'Chart', icon: 'chart' },
  { id: 'evaluation', label: 'Evaluation', icon: 'eval' },
  { id: 'traces', label: 'Traces', icon: 'traces' },
];
function setMode(next: RunsViewMode) {
  mf.go({ page: 'experiments', expId: expId.value, mode: next });
}

const searchDraft = ref('');
const search = ref('');
function applySearch() { search.value = searchDraft.value; }
const filter = computed(() => parseFilter(search.value));
const timeWindow = ref('all');
const lifecycle = ref<'active' | 'deleted'>('active');
const sort = ref<RunsSort>({ key: 'created', dir: 'desc' });
/** The toolbar's "Sort:" select and the table's headers drive one sort. */
const sortKey = computed({
  get: () => sort.value.key,
  set: (key: string) => {
    sort.value = { key, dir: key === 'run_name' || key.startsWith('param:') ? 'asc' : 'desc' };
  },
});
const selected = ref<string[]>([]);
watch(lifecycle, () => { selected.value = []; });

const expRuns = computed(() => mf.runs.value.filter(r => r.experiment_id === expId.value));
const metricKeys = computed(() => [...new Set(expRuns.value.flatMap(r => Object.keys(r.metrics)))].sort());
const paramKeys = computed(() => [...new Set(expRuns.value.flatMap(r => Object.keys(r.params)))].sort());
const expTags = computed(() => userTags(experiment.value?.tags || {}));

const filtered = computed(() => {
  const windows: Record<string, number> = { '1h': 3600e3, '24h': 86400e3, '7d': 7 * 86400e3 };
  const limit = windows[timeWindow.value];
  let list = expRuns.value.filter(r => r.lifecycle_stage === lifecycle.value);
  if (limit) list = list.filter(r => mf.now.value - parseStamp(r.start_time) <= limit);
  if (!filter.value.error) list = list.filter(r => runMatches(r, filter.value.clauses));
  return sortRuns(list, sort.value);
});

// --- experiment rename / delete / description ---
const renaming = ref(false);
const renameDraft = ref('');
const formError = ref('');
function expMenu(event: MouseEvent) {
  const exp = experiment.value;
  if (!exp) return;
  const gone = exp.lifecycle_stage === 'deleted';
  mf.menu(event, [
    { label: 'Rename', icon: 'pencil', disabled: exp.default || gone, action: startRename },
    { label: 'Edit description', icon: 'pencil', disabled: gone, action: startDesc },
    { label: 'Edit tags', icon: 'tag', disabled: gone, action: startTags },
    { label: 'Copy experiment ID', icon: 'copy', action: () => mf.copy(exp.id, 'experiment ID') },
    { divider: true },
    gone
      ? { label: 'Restore', icon: 'restore', action: restoreExperiment }
      : { label: 'Delete', icon: 'trash', danger: true, disabled: exp.default, action: startDelete },
  ], exp.name);
}
function startRename() {
  renameDraft.value = experiment.value?.name || '';
  formError.value = '';
  renaming.value = true;
}
async function saveRename() {
  const exp = experiment.value;
  const name = renameDraft.value.trim();
  if (!exp || !name) return;
  if (name === exp.name) { renaming.value = false; return; }
  const result = await mf.run(mlflow(['experiments', 'rename'], { '--experiment-id': exp.id, '--new-name': name }), { quiet: true });
  if (!result.ok) { formError.value = String(result.error || '').trim(); return; }
  renaming.value = false;
}
async function startDelete() {
  const exp = experiment.value;
  if (!exp) return;
  const yes = await mf.confirm({ title: 'Delete Experiment', yes: 'Delete', danger: true,
    message: `Experiment "${exp.name}" (Experiment ID: ${exp.id}) will be deleted.` });
  if (!yes) return;
  const result = await mf.run(mlflow(['experiments', 'delete'], { '--experiment-id': exp.id }),
                              { success: `Experiment "${exp.name}" deleted` });
  if (result.ok) {
    const live = mf.experiments.value.filter(e => e.lifecycle_stage !== 'deleted' && !e.default);
    mf.go({ page: 'experiments', expId: live.length ? live[live.length - 1].id : '0', mode: 'table' });
  }
}

const editingDesc = ref(false);
const descDraft = ref('');
function startDesc() {
  descDraft.value = experiment.value?.description || '';
  editingDesc.value = true;
}
async function saveDesc() {
  const exp = experiment.value;
  if (!exp) return;
  const text = descDraft.value;
  const command = text.trim()
    ? mlflow(['experiments', 'set-tag'], { '--experiment-id': exp.id, '--key': DESCRIPTION_TAG }, { '--value': text })
    : mlflow(['experiments', 'delete-tag'], { '--experiment-id': exp.id, '--key': DESCRIPTION_TAG });
  if (!text.trim() && !exp.description) { editingDesc.value = false; return; }
  const result = await mf.run(command);
  if (result.ok) editingDesc.value = false;
}

async function restoreExperiment() {
  const exp = experiment.value;
  if (!exp) return;
  await mf.run(mlflow(['experiments', 'restore'], { '--experiment-id': exp.id }), { success: `Experiment "${exp.name}" restored` });
}
const saving = ref(false);
const taggingExp = ref(false);
function startTags() { formError.value = ''; taggingExp.value = true; }
async function saveExpTags(changes: { set: [string, string][]; remove: string[] }) {
  const exp = experiment.value;
  if (!exp) return;
  saving.value = true;
  formError.value = await applyTags(mf, 'experiments', { '--experiment-id': exp.id }, changes);
  saving.value = false;
  if (!formError.value) taggingExp.value = false;
}

// --- a row's menu in the runs table ---
const registerRun = ref('');
const descRun = ref<MfRun | null>(null);
const runDescDraft = ref('');
async function onRunAction(kind: RunAction, run: MfRun) {
  if (kind === 'compare') {
    mf.go({ page: 'compare', runIds: [...new Set([...selected.value, run.run_id])] });
  } else if (kind === 'rename') {
    runRenaming.value = run.run_id;
    runNameDraft.value = run.run_name;
  } else if (kind === 'description') {
    descRun.value = run;
    runDescDraft.value = run.description;
  } else if (kind === 'register') {
    registerRun.value = run.run_id;
  } else if (kind === 'restore') {
    await mf.run(mlflow(['runs', 'restore'], { '--run-id': run.run_id }), { success: `Run "${run.run_name}" restored` });
    selected.value = selected.value.filter(id => id !== run.run_id);
  } else if (kind === 'delete') {
    const yes = await mf.confirm({ title: 'Delete Experiment Runs', yes: 'Delete', danger: true,
      message: `1 experiment run ("${run.run_name}") will be deleted. Deleted runs can be restored from the State: Deleted view.` });
    if (!yes) return;
    const result = await mf.run(mlflow(['runs', 'delete'], { '--run-id': run.run_id }), { success: `Run "${run.run_name}" deleted` });
    if (result.ok) selected.value = selected.value.filter(id => id !== run.run_id);
  }
}
async function saveRunDesc() {
  const run = descRun.value;
  if (!run) return;
  const text = runDescDraft.value;
  if (!text.trim() && !run.description) { descRun.value = null; return; }
  saving.value = true;
  const result = await mf.run(text.trim()
    ? mlflow(['runs', 'set-tag'], { '--run-id': run.run_id, '--key': DESCRIPTION_TAG }, { '--value': text })
    : mlflow(['runs', 'delete-tag'], { '--run-id': run.run_id, '--key': DESCRIPTION_TAG }), { success: 'Description saved' });
  saving.value = false;
  if (result.ok) descRun.value = null;
}

// --- runs: compare / rename / delete / restore ---
function compare() {
  mf.go({ page: 'compare', runIds: [...selected.value] });
}
const runRenaming = ref<string | null>(null);
const runNameDraft = ref('');
function startRunRename() {
  const run = mf.findRun(selected.value[0]);
  if (!run) return;
  runRenaming.value = run.run_id;
  runNameDraft.value = run.run_name;
}
async function saveRunRename() {
  const id = runRenaming.value;
  const name = runNameDraft.value.trim();
  if (!id || !name) return;
  const result = await mf.run(mlflow(['runs', 'rename'], { '--run-id': id, '--new-name': name }), { success: 'Run renamed' });
  if (result.ok) runRenaming.value = null;
}
const runDeleting = ref(false);
async function deleteRuns() {
  runDeleting.value = false;
  const ids = [...selected.value];
  let done = 0;
  for (const id of ids) {
    const result = await mf.run(mlflow(['runs', 'delete'], { '--run-id': id }));
    if (result.ok) done++;
  }
  selected.value = [];
  if (done) mf.notify('success', `${done} run${done === 1 ? '' : 's'} deleted`);
}
async function restoreRuns() {
  const ids = [...selected.value];
  let done = 0;
  for (const id of ids) {
    const result = await mf.run(mlflow(['runs', 'restore'], { '--run-id': id }));
    if (result.ok) done++;
  }
  selected.value = [];
  if (done) mf.notify('success', `${done} run${done === 1 ? '' : 's'} restored`);
}
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-exp { position: relative; display: flex; flex: 1; min-height: 0; }
.mf-exp__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; padding: 16px 24px 16px; overflow: hidden; }
.mf-exp__head { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
.mf-exp__id { font-size: 12px; }
.mf-exp__deleted { color: var(--mf-danger); }
.mf-exp__tags { align-items: center; }
.mf-exp__desc { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
.mf-exp__desc-btn { display: inline-flex; gap: 4px; align-items: center; font-size: 13px; }
.mf-exp__desc-edit { display: flex; flex-direction: column; gap: 6px; width: 100%; max-width: 720px; }
.mf-exp__desc-acts { display: flex; gap: 6px; }
.mf-exp__bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mf-exp__search { flex: 1 1 240px; min-width: 180px; }
.mf-exp__bar .mf-select { width: auto; }
.mf-exp__selbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 10px; background: var(--mf-bg-2); border-radius: var(--mf-radius); }
.mf-exp__content { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.mf-p { margin: 0; }
@container sl-portal (max-width: 900px) {
  .mf-exp__main { padding: 12px; }
}
@container sl-portal (max-width: 560px) {
  .mf-exp__seglabel { display: none; }
  .mf-exp__bar .mf-select { flex: 1 1 140px; }
  .mf-exp__main { overflow: auto; }
}
</style>
