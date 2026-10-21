<template>
  <div class="mf-page mf-ver">
    <nav class="mf-crumbs" aria-label="Breadcrumb">
      <button type="button" @click="mf.go({ page: 'models' })">Registered Models</button><span class="mf-sep">/</span>
      <button type="button" @click="mf.go({ page: 'model', name })">{{ name }}</button><span class="mf-sep">/</span>
    </nav>
    <div v-if="!ver || !model" class="mf-empty">
      <MfIcon name="warning" /><h3>Model version not found</h3>
      <p>RESOURCE_DOES_NOT_EXIST: Model Version (name={{ name }}, version={{ number }}) not found</p>
      <button type="button" class="mf-btn" @click="mf.go({ page: model ? 'model' : 'models', name } as any)">Back</button>
    </div>
    <template v-else>
      <div class="mf-title-row">
        <h1 class="mf-title">Version {{ ver.version }}</h1>
        <span class="mf-menu-anchor">
          <button type="button" class="mf-btn mf-btn--icon" aria-label="Version actions" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            <MfIcon name="kebab" /></button>
          <div v-if="menuOpen" class="mf-menu mf-ver__menu" @mouseleave="menuOpen = false">
            <button type="button" @click="menuOpen = false; copying = true">Copy to another model</button>
            <button type="button" @click="menuOpen = false; mf.copy(`models:/${name}/${ver.version}`, 'model URI')">Copy model URI</button>
            <hr />
            <button type="button" class="is-danger" :disabled="active" :title="active ? blockText : ''" @click="remove">Delete</button>
          </div>
        </span>
      </div>

      <dl class="mf-ver__meta">
        <div><dt>Registered At:</dt><dd>{{ fullTime(ver.created) }}</dd></div>
        <div><dt>Creator:</dt><dd>student</dd></div>
        <div><dt>Last Modified:</dt><dd>{{ fullTime(ver.updated) }}</dd></div>
        <div><dt>Source Run:</dt><dd><button type="button" class="mf-link" @click="openRun">{{ ver.run_name || ver.run_id.slice(0, 12) }}</button></dd></div>
        <div class="mf-ver__aliases"><dt>Aliases:</dt><dd>
          <span v-for="a in ver.aliases" :key="a" class="mf-tag mf-tag--alias">@ {{ a }}</span>
          <button type="button" class="mf-btn mf-btn--sm" @click="startAliases"><MfIcon :name="ver.aliases.length ? 'pencil' : 'plus'" />{{ ver.aliases.length ? 'Edit' : 'Add' }}</button>
        </dd></div>
        <div><dt>Stage:</dt><dd>
          <span class="mf-menu-anchor">
            <button type="button" class="mf-ver__stage" :aria-expanded="stageOpen" @click="stageOpen = !stageOpen">
              <span class="mf-stage" :class="'mf-stage--' + ver.stage">{{ ver.stage }}</span><MfIcon name="chevron-down" />
            </button>
            <div v-if="stageOpen" class="mf-menu mf-ver__stagemenu" @mouseleave="stageOpen = false">
              <span class="mf-ver__menulabel">Transition to</span>
              <button v-for="s in targets" :key="s" type="button" @click="startTransition(s)">
                <MfIcon name="chevron-right" /><span class="mf-stage" :class="'mf-stage--' + s">{{ s }}</span></button>
            </div>
          </span>
        </dd></div>
      </dl>

      <section class="mf-section">
        <div class="mf-section-head">
          <h2 class="mf-h3">Description</h2>
          <button v-if="!editingDesc" type="button" class="mf-btn mf-btn--link mf-btn--sm" aria-label="Edit description" @click="startDesc"><MfIcon name="pencil" /></button>
        </div>
        <div v-if="!editingDesc" class="mf-desc" :class="{ 'mf-desc--none': !ver.description }">{{ ver.description || 'None' }}</div>
        <div v-else class="mf-ver__descedit">
          <textarea v-model="descDraft" class="mf-textarea" rows="4" aria-label="Version description"></textarea>
          <div class="mf-ver__acts">
            <button type="button" class="mf-btn mf-btn--primary mf-btn--sm" @click="saveDesc">Save</button>
            <button type="button" class="mf-btn mf-btn--sm" @click="editingDesc = false">Cancel</button>
          </div>
        </div>
      </section>

      <section class="mf-section">
        <h2 class="mf-h3">Tags</h2>
        <div class="mf-tags">
          <span v-for="[k, v] in Object.entries(ver.tags)" :key="k" class="mf-tag"><b>{{ k }}</b><template v-if="v">: {{ v }}</template></span>
          <button type="button" class="mf-btn mf-btn--sm" @click="editingTags = true">
            <MfIcon :name="Object.keys(ver.tags).length ? 'pencil' : 'plus'" />{{ Object.keys(ver.tags).length ? 'Edit' : 'Add' }}</button>
        </div>
      </section>

      <section class="mf-section">
        <h2 class="mf-h3">Schema</h2>
        <div class="mf-table-wrap">
          <table class="mf-table">
            <thead><tr><th>Name</th><th>Type</th></tr></thead>
            <tbody>
              <tr><td colspan="2" class="mf-muted">Inputs: no schema logged. Outputs: no schema logged. Log a model signature
                (<code class="mf-mono">infer_signature</code>) to record one.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="mf-section">
        <h2 class="mf-h3">Details</h2>
        <dl class="mf-kv">
          <dt>Source</dt><dd class="mf-mono">{{ ver.source }}</dd>
          <dt>Status</dt><dd>{{ ver.status }}</dd>
          <dt>Base model</dt><dd>{{ ver.base || '-' }}</dd>
          <dt>Flavor</dt><dd>{{ ver.format || '-' }}</dd>
          <dt>Size</dt><dd>{{ ver.size_mb ? ver.size_mb.toLocaleString() + ' MB' : '-' }}</dd>
          <dt>Metrics at registration</dt>
          <dd><span v-for="[k, v] in Object.entries(ver.metrics)" :key="k" class="mf-tag"><b>{{ k }}</b>: {{ num(v) }}</span></dd>
        </dl>
      </section>
    </template>

    <MfModal v-if="transitionTo && ver" title="Stage Transition" ok-text="OK" :busy="saving" @close="transitionTo = ''" @ok="transition">
      <p class="mf-p">Transition model version {{ ver.version }} from <span class="mf-stage" :class="'mf-stage--' + ver.stage">{{ ver.stage }}</span>
        to <span class="mf-stage" :class="'mf-stage--' + transitionTo">{{ transitionTo }}</span>.</p>
      <label v-if="transitionTo === 'Production'" class="mf-ver__archive">
        <input type="checkbox" class="mf-check" checked disabled />
        <span>Transition existing Production model versions to Archived
          <span class="mf-muted">- this registry always does, so only one version is ever live.</span></span>
      </label>
      <div v-if="formError" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ formError }}</span></div>
    </MfModal>

    <MfModal v-if="aliasEditing && ver" :title="`Add/Edit alias for model version ${ver.version}`" ok-text="Save aliases" :busy="saving" :width="560"
             @close="aliasEditing = false" @ok="saveAliases">
      <p class="mf-p mf-muted">Aliases allow you to assign a mutable, named reference to a particular model version.</p>
      <form class="mf-ver__aliasform" @submit.prevent="addAlias">
        <input v-model="aliasInput" class="mf-input" placeholder="Enter aliases (champion, challenger, etc)" aria-label="Alias" />
        <button type="submit" class="mf-btn" :disabled="!aliasInput.trim()">Add</button>
      </form>
      <div class="mf-tags">
        <span v-for="a in aliasDraft" :key="a" class="mf-tag mf-tag--alias">@ {{ a }}
          <button type="button" :aria-label="'Remove alias ' + a" @click="aliasDraft = aliasDraft.filter(x => x !== a)"><MfIcon name="close" /></button></span>
        <span v-if="!aliasDraft.length" class="mf-muted">No aliases</span>
      </div>
      <div v-for="w in aliasWarnings" :key="w" class="mf-alert mf-alert--warning"><MfIcon name="warning" /><span>{{ w }}</span></div>
      <div v-if="formError" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ formError }}</span></div>
    </MfModal>

    <CopyVersionModal v-if="copying && ver" :name="name" :version="ver.version" @close="copying = false"
                      @done="(dst, v) => { copying = false; mf.go({ page: 'version', name: dst, version: v }); }" />

    <TagEditorModal v-if="editingTags && ver" title="Add/Edit tags" :tags="ver.tags" :busy="saving" :error="formError"
                    @close="editingTags = false" @save="saveTags" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import MfModal from './MfModal.vue';
import TagEditorModal from './TagEditorModal.vue';
import CopyVersionModal from './CopyVersionModal.vue';
import { applyTags, mlflow, useMf } from './mfContext';
import { fullTime, num } from './mlflow';

const mf = useMf();
const name = computed(() => (mf.route.value.page === 'version' ? mf.route.value.name : ''));
const number = computed(() => (mf.route.value.page === 'version' ? mf.route.value.version : 0));
const model = computed(() => mf.model(name.value));
const ver = computed(() => model.value?.versions.find(v => v.version === number.value));
const active = computed(() => ver.value?.stage === 'Staging' || ver.value?.stage === 'Production');
const blockText = "You cannot delete a model version in an active stage. To delete this model version, transition it to the 'Archived' stage first.";
const menuOpen = ref(false);
const copying = ref(false);
const stageOpen = ref(false);
const saving = ref(false);
const formError = ref('');
const targets = computed(() => ['Staging', 'Production', 'Archived', 'None'].filter(s => s !== ver.value?.stage));

function openRun() {
  const v = ver.value;
  if (!v) return;
  const run = mf.findRun(v.run_id);
  if (run) mf.go({ page: 'run', expId: run.experiment_id, runId: run.run_id, tab: 'overview' });
  else mf.notify('error', 'Run not found', `The source run ${v.run_id} no longer exists.`);
}

const transitionTo = ref('');
function startTransition(stage: string) { stageOpen.value = false; formError.value = ''; transitionTo.value = stage; }
async function transition() {
  const v = ver.value;
  if (!v || !transitionTo.value || saving.value) return;
  saving.value = true;
  const result = await mf.run(mlflow(['models', 'transition'], { '--name': name.value, '--version': v.version, '--stage': transitionTo.value }), { quiet: true });
  saving.value = false;
  if (!result.ok) { formError.value = String(result.error || '').trim(); return; }
  mf.notify('success', `Version ${v.version} transitioned to ${transitionTo.value}`, String(result.output || '').split('\n').slice(1).join(' ').trim());
  transitionTo.value = '';
}

const editingDesc = ref(false);
const descDraft = ref('');
function startDesc() { descDraft.value = ver.value?.description || ''; editingDesc.value = true; }
async function saveDesc() {
  const v = ver.value;
  if (!v) return;
  const result = await mf.run(mlflow(['models', 'update-version'], { '--name': name.value, '--version': v.version }, { '--description': descDraft.value }));
  if (result.ok) editingDesc.value = false;
}

const editingTags = ref(false);
async function saveTags(changes: { set: [string, string][]; remove: string[] }) {
  const v = ver.value;
  if (!v) return;
  saving.value = true;
  formError.value = await applyTags(mf, 'models', { '--name': name.value, '--version': v.version }, changes);
  saving.value = false;
  if (!formError.value) editingTags.value = false;
}

const aliasEditing = ref(false);
const aliasDraft = ref<string[]>([]);
const aliasInput = ref('');
function startAliases() { aliasDraft.value = [...(ver.value?.aliases || [])]; aliasInput.value = ''; formError.value = ''; aliasEditing.value = true; }
function addAlias() {
  for (const raw of aliasInput.value.split(',')) {
    const a = raw.trim();
    if (a && !aliasDraft.value.includes(a)) aliasDraft.value = [...aliasDraft.value, a];
  }
  aliasInput.value = '';
}
const aliasWarnings = computed(() => aliasDraft.value
  .filter(a => model.value && a in model.value.aliases && model.value.aliases[a] !== number.value)
  .map(a => `The "${a}" alias is also being used on version ${model.value!.aliases[a]}. Adding it to this version will remove it from version ${model.value!.aliases[a]}.`));
async function saveAliases() {
  const v = ver.value;
  if (!v || saving.value) return;
  if (aliasInput.value.trim()) addAlias();
  saving.value = true;
  formError.value = '';
  for (const a of aliasDraft.value.filter(x => !v.aliases.includes(x))) {
    const result = await mf.run(mlflow(['models', 'set-alias'], { '--name': name.value, '--alias': a, '--version': v.version }), { quiet: true });
    if (!result.ok) { formError.value = String(result.error || '').trim(); saving.value = false; return; }
  }
  for (const a of v.aliases.filter(x => !aliasDraft.value.includes(x))) {
    const result = await mf.run(mlflow(['models', 'delete-alias'], { '--name': name.value, '--alias': a }), { quiet: true });
    if (!result.ok) { formError.value = String(result.error || '').trim(); saving.value = false; return; }
  }
  saving.value = false;
  aliasEditing.value = false;
  mf.notify('success', 'Aliases saved');
}

async function remove() {
  menuOpen.value = false;
  const v = ver.value;
  if (!v) return;
  if (active.value) { mf.notify('warning', 'Cannot delete model version', blockText); return; }
  const yes = await mf.confirm({ title: 'Delete Model Version', yes: 'Delete', danger: true,
    message: `Are you sure you want to delete model version ${v.version}? This cannot be undone.` });
  if (!yes) return;
  const result = await mf.run(mlflow(['models', 'delete-version'], { '--name': name.value, '--version': v.version }),
                              { success: `Deleted version ${v.version} of ${name.value}` });
  if (result.ok) mf.go({ page: 'model', name: name.value });
}
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-ver { flex: 1; overflow: auto; gap: 16px; }
.mf-ver__menu { top: 34px; left: 0; }
.mf-ver__meta { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 8px 24px; margin: 0; font-size: 13px; }
.mf-ver__meta > div { display: flex; gap: 6px; align-items: center; min-width: 0; flex-wrap: wrap; }
.mf-ver__meta dt { color: var(--mf-text-2); font-weight: 600; white-space: nowrap; }
.mf-ver__meta dd { margin: 0; display: flex; gap: 4px; align-items: center; flex-wrap: wrap; min-width: 0; }
.mf-ver__stage { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; padding: 0; cursor: pointer; color: var(--mf-text-2); }
.mf-ver__stagemenu { top: 26px; left: 0; }
.mf-ver__menulabel { padding: 4px 12px; font-size: 12px; color: var(--mf-text-2); }
.mf-ver__descedit { display: flex; flex-direction: column; gap: 6px; max-width: 760px; }
.mf-ver__acts { display: flex; gap: 6px; }
.mf-ver__archive { display: flex; gap: 8px; align-items: flex-start; }
.mf-ver__aliasform { display: flex; gap: 8px; }
.mf-ver__aliasform .mf-input { flex: 1; }
.mf-p { margin: 0; }
@container sl-portal (max-width: 900px) { .mf-ver { padding: 12px; } }
</style>
