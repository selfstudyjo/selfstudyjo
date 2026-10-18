<template>
  <div v-if="!gd.enabled">
    <CsHeader title="Amazon GuardDuty" description="Intelligent threat detection that continuously monitors your AWS accounts, workloads and data for malicious activity." />
    <section class="cs-container"><div class="cs-container__body cs-stack">
      <p class="gd__p">GuardDuty is not enabled. Findings that exist are reported the moment it is.</p>
      <div class="cs-row"><button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="enable">Enable GuardDuty</button></div>
    </div></section>
  </div>

  <div v-else-if="page === 'findings'">
    <CsTable variant="full-page" title="Findings" :items="shown" :columns="cols" track-by="id" selection-type="single" v-model:selected="sel"
             filter-placeholder="Add filter criteria" empty-title="No findings" empty-text="GuardDuty has not found anything.">
      <template #actions>
        <select v-model="view" class="cs-select gd__view" aria-label="Current or archived"><option value="current">Current</option><option value="archived">Archived</option><option value="all">All</option></select>
        <CsDropdown :items="[{ id: 'archive', text: 'Archive', disabled: selected?.archived }, { id: 'unarchive', text: 'Unarchive', disabled: !selected?.archived }]" :disabled="!sel.length" @select="act" />
      </template>
      <template #cell-sev="{ row }"><span class="gd__sev" :class="row.severity >= 7 ? 'is-high' : row.severity >= 4 ? 'is-med' : 'is-low'">{{ row.severity >= 7 ? 'High' : row.severity >= 4 ? 'Medium' : 'Low' }}</span></template>
    </CsTable>
    <section v-if="selected" class="cs-container gd__detail">
      <div class="cs-container__head"><CsHeader :title="selected.type" :level="2" :info="false" :description="`Finding ID: ${selected.id}`" /></div>
      <div class="cs-container__body cs-stack">
        <p class="gd__p">{{ selected.detail }}</p>
        <dl class="cs-kv"><div><dt>Severity</dt><dd>{{ selected.severity }}</dd></div><div><dt>Region</dt><dd>{{ selected.region }}</dd></div>
          <div><dt>Resource</dt><dd class="cs-mono">{{ selected.resource }}</dd></div><div><dt>Count</dt><dd>{{ selected.count }}</dd></div>
          <div><dt>First seen (shift)</dt><dd>{{ selected.time }}</dd></div><div><dt>Detector ID</dt><dd class="cs-mono">{{ gd.detector }}</dd></div></dl>
        <div class="cs-row">
          <button v-if="String(selected.resource).startsWith('AKIA')" type="button" class="cs-btn" @click="ctx.to('cloudtrail', 'events', { key: selected.resource })">Investigate in CloudTrail</button>
          <button v-if="String(selected.resource).startsWith('i-')" type="button" class="cs-btn" @click="ctx.to('ec2', 'instance', { id: selected.resource })">View instance</button>
        </div>
      </div>
    </section>
  </div>

  <div v-else>
    <CsHeader title="Settings" />
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Detector ID</dt><dd class="cs-mono">{{ gd.detector }}</dd></div><div><dt>Status</dt><dd><CsStatus type="success" label="Enabled" /></dd></div>
      <div><dt>Suppression rules</dt><dd>{{ gd.filters?.length || 0 }}</dd></div>
    </dl></div></section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const busy = ref(false);
const view = ref('current');
const gd = computed<any>(() => pick(ctx.c.value, 'security.guardduty', { enabled: false }));
const findings = computed(() => rows<any>(gd.value, 'findings'));
const shown = computed(() => findings.value.filter(f => view.value === 'all' || (view.value === 'archived') === Boolean(f.archived)));
const selected = computed<any>(() => findings.value.find(f => f.id === sel.value[0]) || null);
const cols = [{ id: 'sev', header: 'Severity', sortKey: 'severity' }, { id: 'type', header: 'Finding type', sortKey: 'type' },
  { id: 'resource', header: 'Resource' }, { id: 'region', header: 'Region' }, { id: 'time', header: 'Last seen (shift)' }, { id: 'count', header: 'Count' }];

async function enable() {
  busy.value = true;
  await ctx.run(cli(['aws', 'guardduty', 'create-detector'], { '--enable': true }), 'GuardDuty is enabled.');
  busy.value = false;
}
async function act(action: string) {
  busy.value = true;
  await ctx.run(cli(['aws', 'guardduty', `${action}-findings`], { '--detector-id': gd.value.detector, '--finding-ids': sel.value }),
    `Finding ${action === 'archive' ? 'archived' : 'unarchived'}.`);
  busy.value = false;
}
</script>

<style scoped>
.gd__p { margin: 0; }
.gd__view { width: 140px; }
.gd__detail { margin-top: 20px; }
.gd__sev { display: inline-block; padding: 0 8px; border-radius: 4px; font-weight: 700; font-size: 12px; color: #fff; }
.gd__sev.is-high { background: #d91515; }
.gd__sev.is-med { background: #ff9900; color: #0f141a; }
.gd__sev.is-low { background: #0972d3; }
</style>
