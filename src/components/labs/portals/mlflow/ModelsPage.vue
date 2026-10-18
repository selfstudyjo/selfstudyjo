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
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in shown" :key="m.name">
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
          </tr>
          <tr v-if="!shown.length"><td :colspan="aliasUi ? 6 : 7" class="mf-muted">No models match the filter.</td></tr>
        </tbody>
      </table>
    </div>

    <MfModal v-if="creating" title="Create Model" ok-text="Create" :ok-disabled="!name.trim() || taken" :busy="saving" @close="creating = false" @ok="create">
      <label class="mf-field"><span class="mf-label">Model name</span>
        <input v-model="name" class="mf-input" :class="{ 'mf-input--error': taken }" placeholder="Input a model name" aria-label="Model name" @keydown.enter="create" />
        <span v-if="taken" class="mf-error-text">Model "{{ name.trim() }}" already exists.</span></label>
      <label class="mf-field"><span class="mf-label">Description <span class="mf-muted">(optional)</span></span>
        <textarea v-model="description" class="mf-textarea" rows="3" aria-label="Description"></textarea></label>
      <div v-if="error" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ error }}</span></div>
    </MfModal>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, type PropType } from 'vue';
import MfIcon from './MfIcon.vue';
import MfModal from './MfModal.vue';
import { mlflow, useMf } from './mfContext';
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
function startCreate() {
  creating.value = true;
  name.value = '';
  description.value = '';
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
  creating.value = false;
  mf.notify('success', `Successfully registered model '${modelName}'`);
  mf.go({ page: 'model', name: modelName });
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
@container sl-portal (max-width: 900px) { .mf-models { padding: 12px; } }
</style>
