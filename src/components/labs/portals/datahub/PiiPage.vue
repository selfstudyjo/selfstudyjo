<template>
  <div class="dh-page">
    <div class="dh-page-head">
      <div>
        <h1 class="dh-title">PII Audit</h1>
        <p class="dh-subtitle">Every column classified or tagged as personal data, and whether the warehouse masks it. The audit fails while any PII column in Snowflake has no masking policy attached.</p>
      </div>
      <button type="button" class="dh-btn dh-btn--primary" :disabled="dh.busy.value" @click="audit"><DhIcon name="shield" /> Run PII audit</button>
    </div>

    <div v-if="dh.lastAudit.value" class="dh-alert" :class="dh.lastAudit.value.unmasked.length ? 'dh-alert--error' : 'dh-alert--success'">
      <DhIcon :name="dh.lastAudit.value.unmasked.length ? 'x-circle' : 'check-circle'" />
      <div>
        <b>Last audit {{ clockAgo(dh.lastAudit.value.at, dh.clock.value) }}:</b>
        <template v-if="dh.lastAudit.value.unmasked.length"> {{ dh.lastAudit.value.unmasked.length }} PII column(s) WITHOUT a masking policy.</template>
        <template v-else> every PII column in Snowflake has a masking policy attached.</template>
      </div>
    </div>
    <div v-else class="dh-alert dh-alert--info"><DhIcon name="info" /><div>The audit has not been run yet in this environment.</div></div>

    <div class="dh-pii-stats">
      <div class="dh-card dh-stat"><span class="dh-stat__n">{{ rows.length }}</span><span class="dh-muted">PII columns</span></div>
      <div class="dh-card dh-stat"><span class="dh-stat__n is-bad">{{ unmaskedCount }}</span><span class="dh-muted">Unmasked in Snowflake</span></div>
      <div class="dh-card dh-stat"><span class="dh-stat__n">{{ datasetsWithPii }}</span><span class="dh-muted">Datasets with PII</span></div>
      <div class="dh-card dh-stat"><span class="dh-stat__n">{{ candidates.length }}</span><span class="dh-muted">Untagged candidates</span></div>
    </div>

    <section class="dh-card">
      <div class="dh-card__head"><h2 class="dh-h4">Classified columns</h2><span class="dh-spacer" />
        <input v-model="filter" class="dh-input dh-pii-filter" placeholder="Filter…" aria-label="Filter PII columns" /></div>
      <div class="dh-card__body dh-scroll">
        <div v-if="!shown.length" class="dh-muted">No PII columns are known yet. Run an ingestion recipe with classification enabled, or tag columns PII.</div>
        <table v-else class="dh-table">
          <thead><tr><th>Dataset</th><th>Column</th><th>Type</th><th>Source</th><th>Masking</th><th class="dh-actions" /></tr></thead>
          <tbody>
            <tr v-for="r in shown" :key="r.urn + r.column">
              <td><span class="dh-src"><PlatformIcon :platform="r.platform" :size="14" /><button type="button" class="dh-link" @click="dh.openEntity(r.urn)">{{ r.urn }}</button></span></td>
              <td class="dh-mono"><b>{{ r.column }}</b></td>
              <td class="dh-mono">{{ r.type || '—' }}</td>
              <td>{{ r.classified ? 'Auto-classified' : 'Tagged' }}</td>
              <td>
                <span v-if="r.platform !== 'snowflake'" class="dh-pill dh-pill--grey">Not applicable</span>
                <span v-else-if="r.unmasked" class="dh-pill dh-pill--bad">No masking policy</span>
                <span v-else class="dh-pill dh-pill--ok">Masked</span>
              </td>
              <td class="dh-actions"><button type="button" class="dh-btn dh-btn--sm" :disabled="dh.busy.value || r.classified" :title="r.classified ? 'Classified by ingestion' : ''" @click="untag(r.urn, r.column)">Remove PII tag</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="dh-card">
      <div class="dh-card__head"><h2 class="dh-h4">Likely personal data, not yet tagged</h2></div>
      <div class="dh-card__body dh-scroll">
        <div v-if="!candidates.length" class="dh-muted">No untagged columns look like personal data.</div>
        <table v-else class="dh-table">
          <thead><tr><th>Dataset</th><th>Column</th><th>Why</th><th class="dh-actions" /></tr></thead>
          <tbody>
            <tr v-for="c in candidates" :key="c.urn + c.column">
              <td class="dh-mono">{{ c.urn }}</td><td class="dh-mono"><b>{{ c.column }}</b></td>
              <td class="dh-muted">name matches a PII pattern</td>
              <td class="dh-actions"><button type="button" class="dh-btn dh-btn--sm dh-btn--primary" :disabled="dh.busy.value" @click="tag(c.urn, c.column)"><DhIcon name="tag" :size="11" /> Tag as PII</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DhIcon from './DhIcon.vue';
import PlatformIcon from './PlatformIcon.vue';
import { clockAgo, dh as cmd, useDh } from './dhContext';
import { addTag, removeTag } from './edits';

const dh = useDh();
const filter = ref('');
const PII_NAME = /^(e_?mail|email_address|phone|phone_number|mobile|first_name|last_name|full_name|ip|ip_address|client_ip)$/i;

const unmaskedSet = computed(() => new Set(dh.piiUnmasked.value.map(s => s.toLowerCase())));
const rows = computed(() => dh.datasets.value.flatMap(d => d.columns.filter(c => c.pii).map(c => ({
  urn: d.urn, platform: d.platform, column: c.name, type: c.type, classified: c.classified,
  unmasked: unmaskedSet.value.has(`${d.urn}.${c.name}`.toLowerCase()),
}))));
const shown = computed(() => rows.value.filter(r => !filter.value.trim()
  || `${r.urn} ${r.column}`.toLowerCase().includes(filter.value.trim().toLowerCase())));
const unmaskedCount = computed(() => dh.piiUnmasked.value.length);
const datasetsWithPii = computed(() => new Set(rows.value.map(r => r.urn)).size);
const candidates = computed(() => dh.datasets.value.flatMap(d => d.columns
  .filter(c => !c.pii && PII_NAME.test(c.name)).map(c => ({ urn: d.urn, column: c.name }))));

async function audit() {
  const result = await dh.run(cmd(['datahub', 'audit', 'pii']), { quiet: true });
  if (result.ok) dh.notify('success', 'PII audit passed', 'Every PII column in Snowflake is masked.');
  else if (/WITHOUT a masking policy/.test(String(result.error || result.output || ''))) dh.notify('warning', 'PII audit found unmasked columns', 'Attach a masking policy in Snowflake, then run the audit again.');
  else dh.notify('error', 'The audit could not run', String(result.error || result.output || '').split('\n')[0]);
}

async function tag(urn: string, column: string) { await addTag(dh, urn, 'PII', column); }
async function untag(urn: string, column: string) { await removeTag(dh, urn, 'PII', column); }
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-pii-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 12px; }
.dh-stat { padding: 12px 16px; display: flex; flex-direction: column; }
.dh-stat__n { font-size: 24px; line-height: 32px; font-weight: 700; }
.dh-stat__n.is-bad { color: #cf1322; }
.dh-pii-filter { width: 220px; }
.dh-scroll { overflow: auto; }
.dh-src { display: inline-flex; align-items: center; gap: 6px; }
</style>
