<template>
  <div class="mf-page mf-models">
    <div class="mf-title-row">
      <h1 class="mf-title">Registered Models</h1>
      <span class="mf-spacer"></span>
      <button type="button" class="mf-switch" :class="{ 'is-on': aliasUi }" role="switch" :aria-checked="aliasUi" @click="aliasUi = !aliasUi">
        <i></i>New model registry UI</button>
      <button type="button" class="mf-btn mf-btn--primary" @click="startCreate">Create Model</button>
    </div>
    <p class="mf-muted mf-models__intro">Share and manage machine learning models. Each model has versions; point an alias such as
      <span class="mf-tag mf-tag--alias">@champion</span> at the version a deployment should load.</p>
    <div class="mf-models__bar">
      <div class="mf-search mf-models__search"><MfIcon name="search" />
        <input v-model="query" class="mf-input" type="search" placeholder="Filter registered models by name or tags" aria-label="Filter registered models" /></div>
    </div>
    <div v-if="!mf.models.value.length" class="mf-empty">
      <MfIcon name="model" />
      <h3>No models registered yet</h3>
      <p>Register a run's model from its run page ("Register model"), or create an empty registered model here and add versions to it later.</p>
      <button type="button" class="mf-btn mf-btn--primary" @click="startCreate">Create Model</button>
    </div>
    <div v-else class="mf-table-wrap">
      <table class="mf-table mf-models__table">
        <thead>
          <tr>
            <th class="mf-sortable" @click="sortAsc = !sortAsc">Name {{ sortAsc ? '↑' : '↓' }}</th>
            <th>Latest version</th>
            <template v-if="aliasUi"><th>Aliased versions</th></template>
            <template v-else><th>Staging</th><th>Production</th></template>
            <th>Created by</th>
            <th>Last modified</th>
            <th>Tags</th>
            <th class="mf-models__kebabcol"><span class="mf-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in shown" :key="m.name" @contextmenu="rowMenu($event, m)">
            <td><button type="button" class="mf-link mf-models__name" @click="mf.go({ page: 'model', name: m.name })">{{ m.name }}</button></td>
            <td>
              <button v-if="m.latest_version" type="button" class="mf-link" @click="mf.go({ page: 'version', name: m.name, version: m.latest_version })">Version {{ m.latest_version }}</button>
              <span v-else class="mf-muted">-</span>
            </td>
            <td v-if="aliasUi">
              <span class="mf-tags">
                <button v-for="[alias, v] in Object.entries(m.aliases)" :key="alias" type="button" class="mf-tag mf-tag--alias mf-models__alias"
                        @click="mf.go({ page: 'version', name: m.name, version: v })">@ {{ alias }}: v{{ v }}</button>
                <span v-if="!Object.keys(m.aliases).length" class="mf-muted">-</span>
              </span>
            </td>
            <template v-else>
              <td><StageLink :model="m" stage="Staging" /></td>
              <td><StageLink :model="m" stage="Production" /></td>
            </template>
            <td>student</td>
            <td class="mf-models__nowrap">{{ fullTime(m.updated) }}</td>
            <td><span class="mf-tags"><span v-for="[k, v] in Object.entries(m.tags)" :key="k" class="mf-tag"><b>{{ k }}</b><template v-if="v">: {{ v }}</template></span>
              <span v-if="!Object.keys(m.tags).length" class="mf-muted">-</span></span></td>
            <td class="mf-models__kebabcol">
              <button type="button" class="mf-models__kebab" :aria-label="'Actions for ' + m.name" title="More actions"
                      @click.stop="rowMenu($event, m)"><MfIcon name="kebab" /></button></td>
          </tr>
          <tr v-if="!shown.length"><td :colspan="aliasUi ? 7 : 8" class="mf-muted">No models match the filter.</td></tr>
        </tbody>
      </table>
    </div>

    <MfModal v-if="creating" title="Create Model" ok-text="Create" :ok-disabled="!name.trim() || taken" :busy="saving" @close="creating = false" @ok="create">
      <label class="mf-field"><span class="mf-label">Model name</span>
        <input v-model="name" class="mf-input" :class="{ 'mf-input--error': taken }" placeholder="Input a model name" aria-label="Model name" @keydown.enter="create" />
        <span v-if="taken" class="mf-error-text">Model "{{ name.trim() }}" already exists.</span></label>
      <label class="mf-field"><span class="mf-label">Description <span class="mf-muted">(optional)</span></span>
        <textarea v-model="description" class="mf-textarea" rows="3" aria-label="Description"></textarea></label>
      <fieldset class="mf-models__newtags">
        <legend class="mf-label">Tags <span class="mf-muted">(optional)</span></legend>
        <div v-for="(row, i) in newTags" :key="i" class="mf-models__tagrow">
          <input v-model="row.key" class="mf-input" placeholder="Key" :aria-label="'Tag key ' + (i + 1)" />
          <input v-model="row.value" class="mf-input" placeholder="Value" :aria-label="'Tag value ' + (i + 1)" />
          <button type="button" class="mf-btn mf-btn--icon" :aria-label="'Remove tag ' + (i + 1)" @click="newTags.splice(i, 1)">
            <MfIcon name="close" /></button>
        </div>
        <button type="button" class="mf-btn mf-btn--link mf-btn--sm" @click="newTags.push({ key: '', value: '' })"><MfIcon name="plus" />Add tag</button>
      </fieldset>
      <div v-if="error" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ error }}</span></div>
    </MfModal>

    <MfModal v-if="renaming" title="Rename Model" ok-text="Save" :ok-disabled="!nameDraft.trim()" :busy="saving"
             @close="renaming = null" @ok="saveRename">
      <label class="mf-field"><span class="mf-label">New Model Name</span>
        <input v-model="nameDraft" class="mf-input" aria-label="New Model Name" @keydown.enter="saveRename" /></label>
      <div v-if="error" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ error }}</span></div>
    </MfModal>

    <MfModal v-if="describing" :title="`Edit description of ${describing.name}`" ok-text="Save" :busy="saving"
             @close="describing = null" @ok="saveDesc">
      <textarea v-model="descDraft" class="mf-textarea" rows="5" aria-label="Model description"></textarea>
    </MfModal>

    <TagEditorModal v-if="tagging" :title="`Add/Edit tags for ${tagging.name}`" :tags="tagging.tags" :busy="saving" :error="error"
                    @close="tagging = null" @save="saveTags" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, type PropType } from 'vue';
import MfIcon from './MfIcon.vue';
import MfModal from './MfModal.vue';
import TagEditorModal from './TagEditorModal.vue';
import { applyTags, mlflow, useMf } from './mfContext';
import { fullTime, type MfModel } from './mlflow';

const mf = useMf();
const aliasUi = ref(true);
const query = ref('');
const sortAsc = ref(true);
const shown = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = mf.models.value.filter(m => !q || m.name.toLowerCase().includes(q)
    || Object.entries(m.tags).some(([k, v]) => (k + ' ' + v).toLowerCase().includes(q)));
  return [...list].sort((a, b) => a.name.localeCompare(b.name) * (sortAsc.value ? 1 : -1));
});

/** A "Version N" link to the version in that stage, as the legacy registry page shows. */
const StageLink = defineComponent({
  props: { model: { type: Object as PropType<MfModel>, required: true }, stage: { type: String, required: true } },
  setup(props) {
    return () => {
      const versions = props.model.versions.filter(v => v.stage === props.stage);
      const latest = versions[versions.length - 1];
      if (!latest) return h('span', { class: 'mf-muted' }, '-');
      return h('button', { type: 'button', class: 'mf-link', style: 'color: var(--mf-link); background: none; border: 0; padding: 0; cursor: pointer; font: inherit;',
        onClick: () => mf.go({ page: 'version', name: props.model.name, version: latest.version }) }, `Version ${latest.version}`);
    };
  },
});

const creating = ref(false);
const name = ref('');
const description = ref('');
const saving = ref(false);
const error = ref('');
const taken = computed(() => Boolean(mf.model(name.value.trim())));
const newTags = ref<{ key: string; value: string }[]>([]);
function startCreate() {
  creating.value = true;
  name.value = '';
  description.value = '';
  newTags.value = [];
  error.value = '';
}
async function create() {
  const modelName = name.value.trim();
  if (!modelName || taken.value || saving.value) return;
  saving.value = true;
  const result = await mf.run(mlflow(['models', 'create'], { '--name': modelName },
    description.value.trim() ? { '--description': description.value } : {}), { quiet: true });
  saving.value = false;
  if (!result.ok) { error.value = String(result.error || result.output || '').trim(); return; }
  // MlflowClient.create_registered_model(name, tags=...) - one set-tag per tag, as the client sends them.
  const tags = newTags.value.map(t => [t.key.trim(), t.value] as [string, string]).filter(([k]) => k);
  if (tags.length) {
    const failed = await applyTags(mf, 'models', { '--name': modelName }, { set: tags, remove: [] });
    if (failed) mf.notify('error', 'The model was created but a tag was refused', failed);
  }
  creating.value = false;
  mf.notify('success', `Successfully registered model '${modelName}'`);
  mf.go({ page: 'model', name: modelName });
}

// --- a row's menu ("⋮" or right-click) ---
const BLOCK = "You cannot delete a model with versions in active stages ('Staging' or 'Production'). "
  + "Transition them to 'Archived' first.";
function activeIn(m: MfModel) { return m.versions.some(v => v.stage === 'Staging' || v.stage === 'Production'); }
function rowMenu(event: MouseEvent, m: MfModel) {
  mf.menu(event, [
    { label: 'Open', icon: 'chevron-right', action: () => mf.go({ page: 'model', name: m.name }) },
    { label: 'Latest version', icon: 'model', disabled: !m.latest_version,
      action: () => mf.go({ page: 'version', name: m.name, version: m.latest_version }) },
    { divider: true },
    { label: 'Rename', icon: 'pencil', action: () => { error.value = ''; nameDraft.value = m.name; renaming.value = m; } },
    { label: 'Edit description', icon: 'pencil', action: () => { descDraft.value = m.description; describing.value = m; } },
    { label: 'Edit tags', icon: 'tag', action: () => { error.value = ''; tagging.value = m; } },
    { label: 'Copy model URI', icon: 'copy', disabled: !m.latest_version,
      action: () => mf.copy(`models:/${m.name}/${m.latest_version}`, 'model URI') },
    { divider: true },
    { label: 'Delete', icon: 'trash', danger: true, disabled: activeIn(m), title: activeIn(m) ? BLOCK : '', action: () => remove(m) },
  ], m.name);
}

const renaming = ref<MfModel | null>(null);
const nameDraft = ref('');
async function saveRename() {
  const m = renaming.value;
  const next = nameDraft.value.trim();
  if (!m || !next || saving.value) return;
  if (next === m.name) { renaming.value = null; return; }
  saving.value = true;
  const result = await mf.run(mlflow(['models', 'rename'], { '--name': m.name, '--new-name': next }), { success: `Renamed to ${next}` });
  saving.value = false;
  if (!result.ok) { error.value = String(result.error || '').trim(); return; }
  renaming.value = null;
}

const describing = ref<MfModel | null>(null);
const descDraft = ref('');
async function saveDesc() {
  const m = describing.value;
  if (!m || saving.value) return;
  saving.value = true;
  const result = await mf.run(mlflow(['models', 'update'], { '--name': m.name }, { '--description': descDraft.value }),
                              { success: 'Description saved' });
  saving.value = false;
  if (result.ok) describing.value = null;
}

const tagging = ref<MfModel | null>(null);
async function saveTags(changes: { set: [string, string][]; remove: string[] }) {
  const m = tagging.value;
  if (!m) return;
  saving.value = true;
  error.value = await applyTags(mf, 'models', { '--name': m.name }, changes);
  saving.value = false;
  if (!error.value) tagging.value = null;
}

async function remove(m: MfModel) {
  if (activeIn(m)) { mf.notify('warning', 'Cannot delete model', BLOCK); return; }
  const yes = await mf.confirm({ title: 'Delete Model', yes: 'Delete', danger: true,
    message: `Are you sure you want to delete ${m.name}? Its ${m.versions.length} version(s) are deleted with it. This cannot be undone.` });
  if (!yes) return;
  await mf.run(mlflow(['models', 'delete'], { '--name': m.name }), { success: `Deleted model ${m.name}` });
}
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-models { flex: 1; overflow: auto; }
.mf-models__intro { margin: -4px 0 0; }
.mf-models__bar { display: flex; gap: 8px; }
.mf-models__search { width: 420px; max-width: 100%; }
.mf-models__name { font-weight: 600; }
.mf-models__alias { border: 0; cursor: pointer; }
.mf-models__nowrap { white-space: nowrap; }
.mf-models__table td { white-space: nowrap; }
.mf-models__kebabcol { width: 36px; text-align: right; }
.mf-models__kebab { border: 0; background: none; color: var(--mf-text-2); width: 28px; height: 28px; border-radius: var(--mf-radius);
  cursor: pointer; display: inline-grid; place-items: center; }
.mf-models__kebab:hover { background: var(--mf-border-light); color: var(--mf-text); }
.mf-models__newtags { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.mf-models__tagrow { display: grid; grid-template-columns: 1fr 1fr auto; gap: 6px; width: 100%; }
.mf-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@container sl-portal (max-width: 900px) { .mf-models { padding: 12px; } }
</style>
