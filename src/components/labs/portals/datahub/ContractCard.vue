<template>
  <section class="dh-card dh-cc">
    <div class="dh-card__head">
      <DhIcon name="contract" class="dh-cc__icon" />
      <div class="dh-cc__title">
        <b>{{ file.name }}</b> <span class="dh-muted">v{{ file.version || '?' }}</span>
        <div class="dh-mono dh-muted">{{ file.path }}</div>
      </div>
      <span class="dh-pill" :class="statusClass">{{ statusText }}</span>
      <span v-if="record && record.published" class="dh-pill dh-pill--info">Published</span>
      <span class="dh-spacer" />
      <button type="button" class="dh-btn dh-btn--sm" :disabled="dh.busy.value || Boolean(file.error)" @click="validate"><DhIcon name="play" :size="12" /> Validate</button>
      <button type="button" class="dh-btn dh-btn--sm dh-btn--primary" :disabled="dh.busy.value || Boolean(file.error)" @click="publish"><DhIcon name="external" :size="12" /> Publish</button>
    </div>
    <div class="dh-card__body dh-cc__body">
      <div v-if="file.error" class="dh-alert dh-alert--error"><DhIcon name="x-circle" /><div>{{ file.error }}</div></div>
      <div class="dh-cc__facts">
        <span><b>Dataset</b> <button v-if="datasetUrn" type="button" class="dh-link" @click="dh.openEntity(datasetUrn)">{{ file.dataset }}</button><span v-else class="dh-mono">{{ file.dataset || '—' }}</span></span>
        <span><b>Owner</b> {{ file.owner || '—' }}</span>
        <span><b>Fields</b> {{ file.fields }}</span>
        <span v-if="record && record.sla && record.sla.freshness_h"><b>Freshness SLA</b> {{ record.sla.freshness_h }}h<template v-if="record.sla.field"> on {{ record.sla.field }}</template></span>
        <span v-if="record && record.rows !== undefined"><b>Rows checked</b> {{ record.rows }}</span>
      </div>
      <div v-if="record && record.problems && record.problems.length" class="dh-alert dh-alert--error">
        <DhIcon name="x-circle" />
        <div><b>{{ record.problems.length }} problem{{ record.problems.length === 1 ? '' : 's' }} in the last validation</b>
          <ul class="dh-cc__list"><li v-for="(p, i) in record.problems" :key="i">{{ p }}</li></ul>
        </div>
      </div>
      <div v-if="record && record.breaking && record.breaking.length" class="dh-alert dh-alert--warning">
        <DhIcon name="warning" />
        <div><b>Breaking changes since the previous version</b>
          <ul class="dh-cc__list"><li v-for="(p, i) in record.breaking" :key="i">{{ p }}</li></ul>
        </div>
      </div>
      <div v-if="record && record.fields && record.fields.length" class="dh-table-wrap">
        <table class="dh-table">
          <thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Unique</th><th>PII</th><th>Description</th></tr></thead>
          <tbody>
            <tr v-for="f in record.fields" :key="f.name">
              <td class="dh-mono"><b>{{ f.name }}</b></td><td class="dh-mono">{{ f.type }}</td>
              <td>{{ f.required ? 'Yes' : '—' }}</td><td>{{ f.unique ? 'Yes' : '—' }}</td>
              <td><span v-if="f.pii" class="dh-pill dh-pill--warn">PII</span><span v-else>—</span></td>
              <td :class="{ 'dh-muted': !f.description }">{{ f.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="!file.error" class="dh-muted dh-small">Validate the contract to check the live dataset against its {{ file.fields }} declared fields.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DhIcon from './DhIcon.vue';
import { canonical, dh as cmd, useDh, type DhContractFile } from './dhContext';

const props = defineProps<{ file: DhContractFile }>();
const dh = useDh();

const record = computed(() => dh.contracts.value.find(c => c.path === props.file.path) || null);
const datasetUrn = computed(() => {
  const target = canonical(props.file.dataset);
  return dh.datasets.value.find(d => canonical(d.urn) === target)?.urn || '';
});
const statusText = computed(() => {
  if (props.file.error) return 'Invalid file';
  const valid = record.value?.valid;
  return valid === true ? 'Passing' : valid === false ? 'Failing' : 'Not validated';
});
const statusClass = computed(() => {
  if (props.file.error) return 'dh-pill--bad';
  const valid = record.value?.valid;
  return valid === true ? 'dh-pill--ok' : valid === false ? 'dh-pill--bad' : 'dh-pill--grey';
});

async function validate() {
  const result = await dh.run(cmd(['contract', 'validate', props.file.path]), { quiet: true });
  if (result.ok) dh.notify('success', `Contract ${props.file.name} passed`, 'The dataset honours the contract.');
  else dh.notify('error', `Contract ${props.file.name} failed`, 'The live dataset breaks the contract - see the problems listed.');
}

async function publish() {
  await dh.run(cmd(['contract', 'publish', props.file.path]), { success: `Published contract ${props.file.name} v${props.file.version}` });
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-cc__icon { color: var(--dh-primary); }
.dh-cc__title { min-width: 0; }
.dh-cc__body { display: flex; flex-direction: column; gap: 12px; }
.dh-cc__facts { display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: 13px; }
.dh-cc__facts b { color: var(--dh-text-2); font-weight: 600; margin-right: 4px; }
.dh-cc__list { margin: 4px 0 0; padding-left: 18px; }
.dh-small { font-size: 13px; }
</style>
