<template>
  <aside class="mf-explist" :class="{ 'is-collapsed': collapsed }">
    <div class="mf-explist__head">
      <h2 class="mf-explist__title">Experiments</h2>
      <button type="button" class="mf-iconbtn" title="New Experiment" aria-label="New Experiment" @click="openCreate">
        <MfIcon name="plus" />
      </button>
      <button type="button" class="mf-iconbtn" title="Hide experiment list" aria-label="Hide experiment list" @click="$emit('collapse')">
        <MfIcon name="chevron-left" />
      </button>
    </div>
    <div class="mf-search">
      <MfIcon name="search" />
      <input v-model="query" class="mf-input" type="search" placeholder="Search Experiments" aria-label="Search Experiments" />
    </div>
    <ul class="mf-explist__items" :aria-label="showDeleted ? 'Deleted experiments' : 'Experiments'">
      <li v-for="exp in shown" :key="exp.id" class="mf-explist__item"
          :class="{ 'is-active': exp.id === activeId, 'is-deleted': exp.lifecycle_stage === 'deleted' }"
          @click="exp.lifecycle_stage === 'deleted' ? null : open(exp.id)" @contextmenu="rowMenu($event, exp)">
        <input v-if="!showDeleted" type="checkbox" class="mf-check" :checked="exp.id === activeId" :aria-label="'Select ' + exp.name"
               @click.stop="open(exp.id)" />
        <MfIcon v-else name="trash" class="mf-muted" />
        <span class="mf-explist__name" :title="exp.name">{{ exp.name }}</span>
        <button v-if="exp.lifecycle_stage === 'deleted'" type="button" class="mf-btn mf-btn--sm mf-explist__restore"
                :aria-label="'Restore ' + exp.name" @click.stop="restore(exp)">Restore</button>
        <span v-else class="mf-explist__acts">
          <button type="button" class="mf-iconbtn mf-iconbtn--sm" :aria-label="'Actions for ' + exp.name" title="More actions"
                  @click.stop="rowMenu($event, exp)"><MfIcon name="kebab" /></button>
        </span>
      </li>
      <li v-if="!shown.length" class="mf-explist__none">{{ showDeleted ? 'No deleted experiments' : 'No experiments found' }}</li>
    </ul>
    <button type="button" class="mf-explist__toggle" :aria-pressed="showDeleted" @click="showDeleted = !showDeleted">
      <MfIcon :name="showDeleted ? 'chevron-left' : 'trash'" />
      {{ showDeleted ? 'Back to active experiments' : `Deleted experiments (${deletedCount})` }}
    </button>

    <TagEditorModal v-if="tagging" :title="`Add/Edit tags for ${tagging.name}`" :tags="tagging.tags" :busy="saving" :error="formError"
                    @close="tagging = null" @save="saveTags" />

    <MfModal v-if="creating" title="Create Experiment" ok-text="Create" :ok-disabled="!createName.trim()" :busy="saving"
             @close="creating = false" @ok="create">
      <label class="mf-field">
        <span class="mf-label">Experiment Name</span>
        <input v-model="createName" class="mf-input" :class="{ 'mf-input--error': nameTaken }" placeholder="Input an experiment name"
               aria-label="Experiment Name" @keydown.enter="create" />
        <span v-if="nameTaken" class="mf-error-text">Experiment "{{ createName.trim() }}" already exists.</span>
      </label>
      <label class="mf-field">
        <span class="mf-label">Artifact Location</span>
        <input v-model="createLocation" class="mf-input" placeholder="Input an artifact location (optional)" aria-label="Artifact Location" />
      </label>
      <div v-if="formError" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ formError }}</span></div>
    </MfModal>

    <MfModal v-if="renaming" title="Rename Experiment" ok-text="Save" :ok-disabled="!newName.trim() || newName.trim() === renaming.name"
             :busy="saving" @close="renaming = null" @ok="rename">
      <label class="mf-field">
        <span class="mf-label">New experiment name</span>
        <input v-model="newName" class="mf-input" aria-label="New experiment name" @keydown.enter="rename" />
      </label>
      <div v-if="formError" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ formError }}</span></div>
    </MfModal>

    <MfModal v-if="deleting" title="Delete Experiment" ok-text="Delete" danger :busy="saving"
             @close="deleting = null" @ok="remove">
      <p class="mf-p">Experiment "{{ deleting.name }}" (Experiment ID: {{ deleting.id }}) will be deleted.</p>
      <p class="mf-p mf-muted">Its runs stay in the tracking store. A deleted experiment can be restored with
        <code class="mf-mono">mlflow experiments restore --experiment-id {{ deleting.id }}</code>.</p>
    </MfModal>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches } from '@/utils/portalKit';
import MfIcon from './MfIcon.vue';
import MfModal from './MfModal.vue';
import TagEditorModal from './TagEditorModal.vue';
import { applyTags, mlflow, useMf } from './mfContext';
import type { MfExperiment } from './mlflow';

defineProps<{ collapsed?: boolean }>();
const emit = defineEmits<{ (event: 'collapse'): void; (event: 'picked'): void }>();

const mf = useMf();
const query = ref('');
const activeId = computed(() => (mf.route.value.page === 'experiments' ? mf.route.value.expId : ''));
const showDeleted = ref(false);
const live = computed(() => mf.experiments.value.filter(e => e.lifecycle_stage !== 'deleted'));
const deleted = computed(() => mf.experiments.value.filter(e => e.lifecycle_stage === 'deleted'));
const deletedCount = computed(() => deleted.value.length);
const shown = computed(() => {
  // MLflow lists the newest experiment first, with Default last.
  const list = (showDeleted.value ? deleted.value : live.value).filter(e => matches(e as any, query.value, ['name', 'id']));
  return [...list].sort((a, b) => Number(b.id) - Number(a.id));
});

function open(id: string) {
  emit('picked');
  mf.go({ page: 'experiments', expId: id, mode: 'table' });
}

const saving = ref(false);
const formError = ref('');

const creating = ref(false);
const createName = ref('');
const createLocation = ref('');
const nameTaken = computed(() => mf.experiments.value.some(e => e.name === createName.value.trim()));
function openCreate() {
  creating.value = true;
  createName.value = '';
  createLocation.value = '';
  formError.value = '';
}
async function create() {
  const name = createName.value.trim();
  if (!name || saving.value) return;
  saving.value = true;
  const result = await mf.run(mlflow(['experiments', 'create'], {
    '--experiment-name': name,
    '--artifact-location': createLocation.value.trim(),
  }), { quiet: true });
  saving.value = false;
  if (!result.ok) {
    formError.value = String(result.error || result.output || '').trim();
    return;
  }
  creating.value = false;
  const made = mf.experiments.value.find(e => e.name === name);
  if (made) open(made.id);
}

const renaming = ref<MfExperiment | null>(null);
const newName = ref('');
function openRename(exp: MfExperiment) {
  renaming.value = exp;
  newName.value = exp.name;
  formError.value = '';
}
async function rename() {
  const exp = renaming.value;
  const name = newName.value.trim();
  if (!exp || !name || name === exp.name || saving.value) return;
  saving.value = true;
  const result = await mf.run(mlflow(['experiments', 'rename'], { '--experiment-id': exp.id, '--new-name': name }),
                              { quiet: true });
  saving.value = false;
  if (!result.ok) {
    formError.value = String(result.error || result.output || '').trim();
    return;
  }
  renaming.value = null;
}

const deleting = ref<MfExperiment | null>(null);
function openDelete(exp: MfExperiment) {
  deleting.value = exp;
}
async function remove() {
  const exp = deleting.value;
  if (!exp || saving.value) return;
  saving.value = true;
  const result = await mf.run(mlflow(['experiments', 'delete'], { '--experiment-id': exp.id }),
                              { success: `Experiment "${exp.name}" deleted` });
  saving.value = false;
  deleting.value = null;
  if (result.ok && activeId.value === exp.id) {
    const next = shown.value[0];
    open(next ? next.id : '0');
  }
}

function rowMenu(event: MouseEvent, exp: MfExperiment) {
  if (exp.lifecycle_stage === 'deleted') {
    mf.menu(event, [
      { label: 'Restore', icon: 'restore', action: () => restore(exp) },
      { label: 'Copy experiment ID', icon: 'copy', action: () => mf.copy(exp.id, 'experiment ID') },
    ], exp.name);
    return;
  }
  mf.menu(event, [
    { label: 'Open', icon: 'chevron-right', action: () => open(exp.id) },
    { label: 'Compare runs (Chart view)', icon: 'chart',
      action: () => { emit('picked'); mf.go({ page: 'experiments', expId: exp.id, mode: 'chart' }); } },
    { divider: true },
    { label: 'Rename', icon: 'pencil', disabled: exp.default, title: exp.default ? 'The Default experiment cannot be renamed' : '',
      action: () => openRename(exp) },
    { label: 'Edit tags', icon: 'tag', action: () => { formError.value = ''; tagging.value = exp; } },
    { label: 'Copy experiment ID', icon: 'copy', action: () => mf.copy(exp.id, 'experiment ID') },
    { label: 'Copy artifact location', icon: 'copy', action: () => mf.copy(exp.artifact_location, 'artifact location') },
    { divider: true },
    { label: 'Delete', icon: 'trash', danger: true, disabled: exp.default,
      title: exp.default ? 'The Default experiment cannot be deleted' : '', action: () => openDelete(exp) },
  ], exp.name);
}

async function restore(exp: MfExperiment) {
  const result = await mf.run(mlflow(['experiments', 'restore'], { '--experiment-id': exp.id }),
                              { success: `Experiment "${exp.name}" restored` });
  if (result.ok) {
    if (!deleted.value.length) showDeleted.value = false;
  }
}

const tagging = ref<MfExperiment | null>(null);
async function saveTags(changes: { set: [string, string][]; remove: string[] }) {
  const exp = tagging.value;
  if (!exp) return;
  saving.value = true;
  formError.value = await applyTags(mf, 'experiments', { '--experiment-id': exp.id }, changes);
  saving.value = false;
  if (!formError.value) tagging.value = null;
}

defineExpose({ openCreate });
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-explist { display: flex; flex-direction: column; gap: 8px; width: 240px; flex: none; padding: 16px 12px 16px 24px; border-right: 1px solid var(--mf-border-light); min-height: 0; background: var(--mf-bg); }
.mf-explist.is-collapsed { display: none; }
.mf-explist__head { display: flex; align-items: center; gap: 4px; }
.mf-explist__title { margin: 0; flex: 1; font-size: 18px; line-height: 24px; font-weight: 600; }
.mf-iconbtn { border: 0; background: none; color: var(--mf-text-2); width: 28px; height: 28px; border-radius: var(--mf-radius); cursor: pointer; display: inline-grid; place-items: center; padding: 0; }
.mf-iconbtn:hover:not(:disabled) { background: var(--mf-row-hover); color: var(--mf-link); }
.mf-iconbtn:disabled { opacity: .35; cursor: not-allowed; }
.mf-iconbtn--sm { width: 24px; height: 24px; }
.mf-explist__items { list-style: none; margin: 0; padding: 0; overflow: auto; min-height: 0; flex: 1; display: flex; flex-direction: column; }
.mf-explist__item { display: flex; align-items: center; gap: 8px; padding: 0 4px 0 8px; height: 32px; border-radius: var(--mf-radius); cursor: pointer; flex: none; }
.mf-explist__item:hover { background: var(--mf-row-hover); }
.mf-explist__item.is-active { background: var(--mf-row-selected); }
.mf-explist__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-explist__item.is-active .mf-explist__name { font-weight: 600; }
.mf-explist__acts { display: none; gap: 0; }
.mf-explist__item:hover .mf-explist__acts, .mf-explist__item.is-active .mf-explist__acts { display: inline-flex; }
.mf-explist__none { color: var(--mf-text-2); padding: 8px; }
.mf-explist__item.is-deleted { cursor: default; color: var(--mf-text-2); }
.mf-explist__restore { flex: none; }
.mf-explist__toggle { display: flex; align-items: center; gap: 6px; border: 0; border-top: 1px solid var(--mf-border-light); background: none;
  padding: 8px 4px 0; color: var(--mf-link); font: inherit; font-size: 12px; cursor: pointer; text-align: left; }
.mf-explist__toggle:hover { color: var(--mf-link-hover); text-decoration: underline; }
.mf-p { margin: 0; }
@container sl-portal (max-width: 900px) {
  .mf-explist { position: absolute; top: 0; bottom: 0; left: 0; z-index: 15; box-shadow: var(--mf-shadow-lg); padding-left: 16px; }
  .mf-explist__acts { display: inline-flex; }
}
</style>
