<template>
  <div class="mf-page mf-model">
    <nav class="mf-crumbs" aria-label="Breadcrumb">
      <button type="button" @click="mf.go({ page: 'models' })">Registered Models</button><span class="mf-sep">/</span>
    </nav>
    <div v-if="!model" class="mf-empty">
      <MfIcon name="warning" /><h3>Model not found</h3>
      <p>RESOURCE_DOES_NOT_EXIST: Registered Model with name={{ name }} not found</p>
      <button type="button" class="mf-btn" @click="mf.go({ page: 'models' })">Back to Registered Models</button>
    </div>
    <template v-else>
      <div class="mf-title-row">
        <h1 class="mf-title">{{ model.name }}</h1>
        <span class="mf-menu-anchor">
          <button type="button" class="mf-btn mf-btn--icon" aria-label="Model actions" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            <MfIcon name="kebab" /></button>
          <div v-if="menuOpen" class="mf-menu mf-model__menu" @mouseleave="menuOpen = false">
            <button type="button" @click="startRename">Rename</button>
            <button type="button" class="is-danger" :disabled="activeVersions.length > 0"
                    :title="activeVersions.length ? blockText : ''" @click="startDelete">Delete</button>
          </div>
        </span>
      </div>
      <dl class="mf-model__meta">
        <div><dt>Created Time:</dt><dd>{{ fullTime(model.created) }}</dd></div>
        <div><dt>Last Modified:</dt><dd>{{ fullTime(model.updated) }}</dd></div>
      </dl>

      <section class="mf-section">
        <div class="mf-section-head">
          <button type="button" class="mf-collapse mf-h3" :class="{ 'is-closed': !descOpen }" @click="descOpen = !descOpen"><MfIcon name="chevron-down" />Description</button>
          <button v-if="descOpen && !editingDesc" type="button" class="mf-btn mf-btn--link mf-btn--sm" aria-label="Edit description" @click="startDesc"><MfIcon name="pencil" /></button>
        </div>
        <template v-if="descOpen">
          <div v-if="!editingDesc" class="mf-desc" :class="{ 'mf-desc--none': !model.description }">{{ model.description || 'None' }}</div>
          <div v-else class="mf-model__descedit">
            <textarea v-model="descDraft" class="mf-textarea" rows="4" aria-label="Model description"></textarea>
            <div class="mf-model__acts">
              <button type="button" class="mf-btn mf-btn--primary mf-btn--sm" @click="saveDesc">Save</button>
              <button type="button" class="mf-btn mf-btn--sm" @click="editingDesc = false">Cancel</button>
            </div>
          </div>
        </template>
      </section>

      <section class="mf-section">
        <div class="mf-section-head">
          <button type="button" class="mf-collapse mf-h3" :class="{ 'is-closed': !tagsOpen }" @click="tagsOpen = !tagsOpen"><MfIcon name="chevron-down" />Tags</button>
        </div>
        <div v-if="tagsOpen" class="mf-tags">
          <span v-for="[k, v] in Object.entries(model.tags)" :key="k" class="mf-tag"><b>{{ k }}</b><template v-if="v">: {{ v }}</template></span>
          <button type="button" class="mf-btn mf-btn--sm" @click="editingTags = true">
            <MfIcon :name="Object.keys(model.tags).length ? 'pencil' : 'plus'" />{{ Object.keys(model.tags).length ? 'Edit' : 'Add' }}</button>
        </div>
      </section>

      <section class="mf-section">
        <div class="mf-section-head">
          <h2 class="mf-h3">Versions</h2>
          <span class="mf-spacer"></span>
          <button type="button" class="mf-btn mf-btn--sm" :disabled="picked.length < 2" @click="compare">Compare</button>
        </div>
        <div v-if="!model.versions.length" class="mf-empty">
          <h3>No models versions are registered yet.</h3>
          <p>Register a run's model as a version of {{ model.name }} from the run page ("Register model").</p>
        </div>
        <div v-else class="mf-table-wrap">
          <table class="mf-table mf-model__table">
            <thead>
              <tr><th class="mf-model__chk"></th><th>Version</th><th>Registered at</th><th>Created by</th><th>Tags</th>
                <th>Aliases</th><th>Stage</th><th>Description</th><th class="mf-model__kebabcol"><span class="mf-sr">Actions</span></th></tr>
            </thead>
            <tbody>
              <tr v-for="v in sortedVersions" :key="v.version" :class="{ 'is-selected': picked.includes(v.version) }"
                  @contextmenu="versionMenu($event, v)">
                <td class="mf-model__chk"><input type="checkbox" class="mf-check" :checked="picked.includes(v.version)"
                                                 :aria-label="'Select version ' + v.version" @change="toggle(v.version)" /></td>
                <td><button type="button" class="mf-link mf-model__ver" @click="mf.go({ page: 'version', name: model.name, version: v.version })">Version {{ v.version }}</button></td>
                <td>{{ fullTime(v.created) }}</td>
                <td>student</td>
                <td><span class="mf-tags"><span v-for="[k, val] in Object.entries(v.tags)" :key="k" class="mf-tag"><b>{{ k }}</b><template v-if="val">: {{ val }}</template></span>
                  <span v-if="!Object.keys(v.tags).length" class="mf-muted">-</span></span></td>
                <td><span class="mf-tags"><span v-for="a in v.aliases" :key="a" class="mf-tag mf-tag--alias">@ {{ a }}</span>
                  <span v-if="!v.aliases.length" class="mf-muted">-</span></span></td>
                <td><span class="mf-stage" :class="'mf-stage--' + v.stage">{{ v.stage }}</span></td>
                <td class="mf-model__desc">{{ v.description || '' }}</td>
                <td class="mf-model__kebabcol">
                  <button type="button" class="mf-model__kebab" :aria-label="'Actions for version ' + v.version" title="More actions"
                          @click.stop="versionMenu($event, v)"><MfIcon name="kebab" /></button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <ServingPanel :model="model" />
    </template>

    <CopyVersionModal v-if="copying && model" :name="model.name" :version="copying" @close="copying = 0"
                      @done="(dst, v) => { copying = 0; mf.go({ page: 'version', name: dst, version: v }); }" />

    <MfModal v-if="transitioning && model" title="Stage Transition" ok-text="OK" :busy="savingTags" @close="transitioning = null" @ok="transition">
      <p class="mf-p">Transition model version {{ transitioning.version }} from
        <span class="mf-stage" :class="'mf-stage--' + transitioning.from">{{ transitioning.from }}</span> to
        <span class="mf-stage" :class="'mf-stage--' + transitioning.to">{{ transitioning.to }}</span>.</p>
      <p v-if="transitioning.to === 'Production'" class="mf-p mf-muted">Existing Production versions of {{ model.name }} move to Archived.</p>
      <div v-if="formError" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ formError }}</span></div>
    </MfModal>

    <TagEditorModal v-if="editingTags && model" title="Add/Edit tags" :tags="model.tags" :busy="savingTags" :error="tagError"
                    @close="editingTags = false" @save="saveTags" />
    <MfModal v-if="renaming" title="Rename Model" ok-text="Save" :ok-disabled="!nameDraft.trim()" @close="renaming = false" @ok="saveRename">
      <label class="mf-field"><span class="mf-label">New Model Name</span>
        <input v-model="nameDraft" class="mf-input" aria-label="New Model Name" @keydown.enter="saveRename" /></label>
      <div v-if="formError" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ formError }}</span></div>
    </MfModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import MfModal from './MfModal.vue';
import TagEditorModal from './TagEditorModal.vue';
import ServingPanel from './ServingPanel.vue';
import CopyVersionModal from './CopyVersionModal.vue';
import { applyTags, mlflow, useMf, type MenuItem } from './mfContext';
import { fullTime, type MfVersion } from './mlflow';

const mf = useMf();
const name = computed(() => (mf.route.value.page === 'model' ? mf.route.value.name : ''));
const model = computed(() => mf.model(name.value));
const menuOpen = ref(false);
const descOpen = ref(true);
const tagsOpen = ref(true);
const sortedVersions = computed(() => [...(model.value?.versions || [])].sort((a, b) => b.version - a.version));
const activeVersions = computed(() => (model.value?.versions || []).filter(v => v.stage === 'Staging' || v.stage === 'Production'));
const blockText = "You cannot delete a model with versions in active stages ('Staging' or 'Production'). To delete this model, "
  + "transition versions in active stages to the 'Archived' stage first.";

const picked = ref<number[]>([]);
function toggle(v: number) { picked.value = picked.value.includes(v) ? picked.value.filter(x => x !== v) : [...picked.value, v]; }
function compare() {
  const runs = (model.value?.versions || []).filter(v => picked.value.includes(v.version)).map(v => v.run_id);
  mf.go({ page: 'compare', runIds: [...new Set(runs)] });
}

const editingDesc = ref(false);
const descDraft = ref('');
function startDesc() { descDraft.value = model.value?.description || ''; editingDesc.value = true; }
async function saveDesc() {
  if (!model.value) return;
  const result = await mf.run(mlflow(['models', 'update'], { '--name': model.value.name }, { '--description': descDraft.value }));
  if (result.ok) editingDesc.value = false;
}

const editingTags = ref(false);
const savingTags = ref(false);
const tagError = ref('');
async function saveTags(changes: { set: [string, string][]; remove: string[] }) {
  if (!model.value) return;
  savingTags.value = true;
  tagError.value = await applyTags(mf, 'models', { '--name': model.value.name }, changes);
  savingTags.value = false;
  if (!tagError.value) editingTags.value = false;
}

const renaming = ref(false);
const nameDraft = ref('');
const formError = ref('');
function startRename() { menuOpen.value = false; nameDraft.value = model.value?.name || ''; formError.value = ''; renaming.value = true; }
async function saveRename() {
  const m = model.value;
  const next = nameDraft.value.trim();
  if (!m || !next) return;
  if (next === m.name) { renaming.value = false; return; }
  const result = await mf.run(mlflow(['models', 'rename'], { '--name': m.name, '--new-name': next }), { quiet: true });
  if (!result.ok) { formError.value = String(result.error || '').trim(); return; }
  renaming.value = false;
  mf.go({ page: 'model', name: next });
}
// --- a version row's menu ("⋮" or right-click) ---
const copying = ref(0);
const transitioning = ref<{ version: number; from: string; to: string } | null>(null);
function versionMenu(event: MouseEvent, v: MfVersion) {
  const m = model.value;
  if (!m) return;
  const live = v.stage === 'Staging' || v.stage === 'Production';
  const items: MenuItem[] = [
    { label: 'Open version', icon: 'chevron-right', action: () => mf.go({ page: 'version', name: m.name, version: v.version }) },
    { label: 'Open source run', icon: 'chevron-right', disabled: !mf.findRun(v.run_id), action: () => {
      const run = mf.findRun(v.run_id);
      if (run) mf.go({ page: 'run', expId: run.experiment_id, runId: run.run_id, tab: 'overview' });
    } },
    { heading: 'Transition to' },
    ...['Staging', 'Production', 'Archived', 'None'].filter(s => s !== v.stage).map(stage => ({
      label: stage, icon: 'chevron-right',
      action: () => { formError.value = ''; transitioning.value = { version: v.version, from: v.stage, to: stage }; },
    })),
    { divider: true },
    { label: 'Copy to another model', icon: 'copy', action: () => { copying.value = v.version; } },
    { label: 'Copy model URI', icon: 'copy', action: () => mf.copy(`models:/${m.name}/${v.version}`, 'model URI') },
    { divider: true },
    { label: 'Delete version', icon: 'trash', danger: true, disabled: live,
      title: live ? "Transition it to 'Archived' before deleting it" : '', action: () => deleteVersion(v) },
  ];
  mf.menu(event, items, `Version ${v.version}`);
}
async function transition() {
  const t = transitioning.value;
  const m = model.value;
  if (!t || !m || savingTags.value) return;
  savingTags.value = true;
  const result = await mf.run(mlflow(['models', 'transition'], { '--name': m.name, '--version': t.version, '--stage': t.to }), { quiet: true });
  savingTags.value = false;
  if (!result.ok) { formError.value = String(result.error || '').trim(); return; }
  mf.notify('success', `Version ${t.version} transitioned to ${t.to}`, String(result.output || '').split('\n').slice(1).join(' ').trim());
  transitioning.value = null;
}
async function deleteVersion(v: MfVersion) {
  const m = model.value;
  if (!m) return;
  const yes = await mf.confirm({ title: 'Delete Model Version', yes: 'Delete', danger: true,
    message: `Are you sure you want to delete model version ${v.version}? This cannot be undone.` });
  if (!yes) return;
  await mf.run(mlflow(['models', 'delete-version'], { '--name': m.name, '--version': v.version }),
               { success: `Deleted version ${v.version} of ${m.name}` });
  picked.value = picked.value.filter(x => x !== v.version);
}

async function startDelete() {
  menuOpen.value = false;
  const m = model.value;
  if (!m) return;
  if (activeVersions.value.length) { mf.notify('warning', 'Cannot delete model', blockText); return; }
  const yes = await mf.confirm({ title: 'Delete Model', yes: 'Delete', danger: true,
    message: `Are you sure you want to delete ${m.name}? This cannot be undone.` });
  if (!yes) return;
  const result = await mf.run(mlflow(['models', 'delete'], { '--name': m.name }), { success: `Deleted model ${m.name}` });
  if (result.ok) mf.go({ page: 'models' });
}
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-model { flex: 1; overflow: auto; gap: 14px; }
.mf-model__menu { top: 34px; left: 0; }
.mf-model__meta { display: flex; gap: 6px 24px; flex-wrap: wrap; margin: 0; font-size: 13px; }
.mf-model__meta > div { display: flex; gap: 6px; }
.mf-model__meta dt { color: var(--mf-text-2); font-weight: 600; }
.mf-model__meta dd { margin: 0; }
.mf-model__descedit { display: flex; flex-direction: column; gap: 6px; max-width: 760px; }
.mf-model__acts { display: flex; gap: 6px; }
.mf-model__chk { width: 32px; }
.mf-model__ver { font-weight: 600; }
.mf-model__table td { white-space: nowrap; }
.mf-model__desc { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
.mf-model__kebabcol { width: 36px; text-align: right; }
.mf-model__kebab { border: 0; background: none; color: var(--mf-text-2); width: 28px; height: 28px; border-radius: var(--mf-radius);
  cursor: pointer; display: inline-grid; place-items: center; }
.mf-model__kebab:hover { background: var(--mf-border-light); color: var(--mf-text); }
.mf-p { margin: 0; }
.mf-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@container sl-portal (max-width: 900px) { .mf-model { padding: 12px; } }
</style>
