<template>
  <div class="dh-page">
    <div class="dh-page-head">
      <div>
        <h1 class="dh-title">Data Contracts</h1>
        <p class="dh-subtitle">Contracts are YAML files in <code>contracts/</code>. Validate one against the live dataset, compare two versions for breaking changes, and publish it onto the dataset in the catalogue.</p>
      </div>
      <button type="button" class="dh-btn" :disabled="dh.busy.value" @click="rescan"><DhIcon name="refresh" /> Rescan files</button>
    </div>

    <nav class="dh-tabs" aria-label="Contracts">
      <button type="button" :class="{ 'is-active': tab === 'contracts' }" @click="tab = 'contracts'">Contracts <span class="dh-count">{{ dh.contractFiles.value.length }}</span></button>
      <button type="button" :class="{ 'is-active': tab === 'diff' }" @click="tab = 'diff'">Compare versions <span class="dh-count">{{ dh.diffs.value.length }}</span></button>
    </nav>

    <template v-if="tab === 'contracts'">
      <div v-if="!dh.contractFiles.value.length" class="dh-card dh-empty">
        <DhIcon name="contract" />
        <span>No contract files found in <code>contracts/</code>.</span>
        <span class="dh-hint">Write one in the Files tool, then press Rescan files.</span>
        <pre class="dh-pre dh-sample">{{ SAMPLE }}</pre>
      </div>
      <div class="dh-table-wrap" v-else>
        <table class="dh-table">
          <thead><tr><th>Contract</th><th>Dataset</th><th>Version</th><th>Owner</th><th>Status</th><th>Published</th><th class="dh-actions">Actions</th></tr></thead>
          <tbody>
            <tr v-for="f in dh.contractFiles.value" :key="f.path" :class="{ 'is-sel': selected === f.path }">
              <td><button type="button" class="dh-link" @click="selected = selected === f.path ? '' : f.path"><b>{{ f.name }}</b></button><div class="dh-mono dh-muted">{{ f.path }}</div></td>
              <td class="dh-mono">{{ f.dataset || '—' }}</td>
              <td>{{ f.version || '—' }}</td>
              <td>{{ f.owner || '—' }}</td>
              <td><span class="dh-pill" :class="statusOf(f).cls">{{ statusOf(f).text }}</span></td>
              <td>{{ recordOf(f.path)?.published ? 'Yes' : 'No' }}</td>
              <td class="dh-actions">
                <button type="button" class="dh-btn dh-btn--sm" :disabled="dh.busy.value || Boolean(f.error)" @click="validate(f.path, f.name)">Validate</button>
                <button type="button" class="dh-btn dh-btn--sm dh-btn--primary" :disabled="dh.busy.value || Boolean(f.error)" @click="publish(f.path, f.name, f.version)">Publish</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ContractCard v-if="selectedFile" :key="selectedFile.path" :file="selectedFile" />
    </template>

    <template v-else>
      <section class="dh-card">
        <div class="dh-card__head"><h2 class="dh-h4">Compare two contract versions</h2></div>
        <div class="dh-card__body dh-diffform">
          <div class="dh-field">
            <span class="dh-label">Current version (old)</span>
            <select v-model="oldPath" class="dh-select" aria-label="Old contract"><option value="" disabled>Select a file</option>
              <option v-for="f in dh.contractFiles.value" :key="f.path" :value="f.path">{{ f.path }}{{ f.version ? ' (v' + f.version + ')' : '' }}</option></select>
          </div>
          <DhIcon name="chevron-right" class="dh-diffform__arrow" />
          <div class="dh-field">
            <span class="dh-label">Proposed version (new)</span>
            <select v-model="newPath" class="dh-select" aria-label="New contract"><option value="" disabled>Select a file</option>
              <option v-for="f in dh.contractFiles.value" :key="f.path" :value="f.path">{{ f.path }}{{ f.version ? ' (v' + f.version + ')' : '' }}</option></select>
          </div>
          <button type="button" class="dh-btn dh-btn--primary" :disabled="dh.busy.value || !oldPath || !newPath || oldPath === newPath" @click="diff"><DhIcon name="diff" /> Compare</button>
        </div>
      </section>
      <div v-if="!dh.diffs.value.length" class="dh-muted">No comparisons yet.</div>
      <section v-for="(d, i) in diffsNewestFirst" :key="i" class="dh-card">
        <div class="dh-card__head">
          <span class="dh-mono">{{ d.old }}</span><DhIcon name="chevron-right" /><span class="dh-mono">{{ d.new }}</span>
          <span class="dh-spacer" />
          <span class="dh-pill" :class="d.sufficient ? 'dh-pill--ok' : 'dh-pill--bad'">{{ d.sufficient ? 'Version bump OK' : 'Version bump too small' }}</span>
        </div>
        <div class="dh-card__body dh-diffres">
          <div class="dh-row dh-small">
            <span>Required bump: <b>{{ d.required_bump }}</b></span>
            <span>Declared: <b>{{ d.declared_bump }}</b></span>
            <span>Suggested version: <b>{{ d.suggested_version }}</b></span>
          </div>
          <div v-if="d.breaking.length">
            <div class="dh-h4 dh-bad">Breaking ({{ d.breaking.length }})</div>
            <ul><li v-for="(b, k) in d.breaking" :key="k">{{ b }}</li></ul>
          </div>
          <div v-if="d.non_breaking.length">
            <div class="dh-h4">Non-breaking ({{ d.non_breaking.length }})</div>
            <ul><li v-for="(b, k) in d.non_breaking" :key="k">{{ b }}</li></ul>
          </div>
          <div v-if="!d.breaking.length && !d.non_breaking.length" class="dh-muted">No changes.</div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import ContractCard from './ContractCard.vue';
import { dh as cmd, useDh, type DhContractFile } from './dhContext';

const dh = useDh();
const tab = ref<'contracts' | 'diff'>('contracts');
const selected = ref('');
const oldPath = ref('');
const newPath = ref('');

const SAMPLE = `# contracts/orders.yaml
dataset: postgres:shop.public.orders
owner: commerce-platform
version: 1.0.0
fields:
  - name: order_id
    type: integer
    required: true
    unique: true
  - name: customer_id
    type: integer
    required: true
sla:
  freshness_hours: 24
  field: updated_at
quality:
  - type: row_count_between
    min: 1`;

const selectedFile = computed(() => dh.contractFiles.value.find(f => f.path === selected.value) || null);
const diffsNewestFirst = computed(() => dh.diffs.value.slice().reverse());

function recordOf(path: string) {
  return dh.contracts.value.find(c => c.path === path) || null;
}

function statusOf(f: DhContractFile) {
  if (f.error) return { text: 'Invalid file', cls: 'dh-pill--bad' };
  const valid = recordOf(f.path)?.valid;
  if (valid === true) return { text: 'Passing', cls: 'dh-pill--ok' };
  if (valid === false) return { text: 'Failing', cls: 'dh-pill--bad' };
  return { text: 'Not validated', cls: 'dh-pill--grey' };
}

// `contract list` re-reads the workspace files, so a contract written in the
// Files tool a moment ago appears here.
async function rescan() {
  await dh.run(cmd(['contract', 'list']), { quiet: true });
}

onMounted(() => { void dh.read(cmd(['contract', 'list'])); });

async function validate(path: string, name: string) {
  selected.value = path;
  const result = await dh.run(cmd(['contract', 'validate', path]), { quiet: true });
  if (result.ok) dh.notify('success', `Contract ${name} passed`, 'The dataset honours the contract.');
  else dh.notify('error', `Contract ${name} failed`, 'See the problems listed under the contract.');
}

async function publish(path: string, name: string, version: string) {
  await dh.run(cmd(['contract', 'publish', path]), { success: `Published contract ${name} v${version}` });
}

async function diff() {
  const result = await dh.run(cmd(['contract', 'diff', oldPath.value, newPath.value]), { quiet: true });
  if (result.ok) dh.notify('success', 'The version change matches the changes');
  else if ((result.data as any)?.contract_diff) dh.notify('warning', 'The version bump is too small', 'See the breaking changes below.');
  else dh.notify('error', 'The comparison failed', String(result.error || result.output || '').split('\n')[0]);
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-subtitle code, .dh-empty code { background: #f5f5f5; padding: 0 4px; border-radius: 3px; font-family: var(--dh-mono); font-size: 12px; }
.dh-sample { text-align: left; max-width: 520px; width: 100%; }
.dh-table tr.is-sel td { background: #e6f4ff; }
.dh-diffform { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.dh-diffform .dh-field { flex: 1 1 240px; }
.dh-diffform__arrow { margin-bottom: 8px; color: var(--dh-text-2); }
.dh-diffres { display: flex; flex-direction: column; gap: 10px; }
.dh-diffres ul { margin: 4px 0 0; padding-left: 20px; }
.dh-small { font-size: 13px; gap: 6px 22px; }
.dh-bad { color: #a8071a; }
</style>
