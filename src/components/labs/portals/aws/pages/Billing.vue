<template>
  <!-- Budgets -->
  <div v-if="page === 'budgets'">
    <CsTable v-model:selected="selected" title="Budgets" variant="full-page" :items="budgets" :columns="budgetColumns" track-by="name"
             selection-type="single" empty-title="No budgets" empty-text="A budget alerts you before the bill surprises you.">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!selected.length" @click="deleting = true">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="form.open = true">Create budget</button>
      </template>
    </CsTable>
    <CsModal v-if="form.open" title="Create budget - Cost budget" size="large" @close="form.open = false">
      <div class="cs-stack">
        <div class="cs-grid-2">
          <div class="cs-field"><label class="cs-label" for="bd-name">Budget name</label><input id="bd-name" v-model.trim="form.name" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="bd-period">Period</label>
            <select id="bd-period" v-model="form.period" class="cs-select"><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="ANNUALLY">Annually</option></select></div>
          <div class="cs-field"><label class="cs-label" for="bd-amt">Budgeted amount ($)</label><input id="bd-amt" v-model.number="form.amount" type="number" min="1" class="cs-input" /></div>
        </div>
        <div class="cs-field"><span class="cs-label">Alert thresholds</span>
          <table class="cs-table-mini"><thead><tr><th>Trigger</th><th>Threshold (% of budget)</th><th /></tr></thead>
            <tbody><tr v-for="(a, i) in form.alerts" :key="i">
              <td><select v-model="a.type" class="cs-select" aria-label="Trigger"><option value="ACTUAL">Actual</option><option value="FORECASTED">Forecasted</option></select></td>
              <td><input v-model.number="a.threshold" type="number" min="1" class="cs-input" aria-label="Threshold" /></td>
              <td><button type="button" class="cs-btn cs-btn--inline" @click="form.alerts.splice(i, 1)">Remove</button></td></tr></tbody></table>
          <div><button type="button" class="cs-btn" @click="form.alerts.push({ type: 'ACTUAL', threshold: 100 })">Add alert threshold</button></div></div>
        <div class="cs-field"><label class="cs-label" for="bd-sns">Amazon SNS alerts</label>
          <select id="bd-sns" v-model="form.topic" class="cs-select"><option value="">None</option>
            <option v-for="t in topics" :key="t.arn" :value="t.arn">{{ t.arn }}</option></select></div>
        <div class="cs-field"><label class="cs-label" for="bd-mail">Email recipients <small>- optional</small></label><input id="bd-mail" v-model.trim="form.email" class="cs-input" /></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="form.open = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!form.name || !form.amount || busy" @click="createBudget">Create budget</button>
      </template>
    </CsModal>
    <CsDelete v-if="deleting" :title="`Delete ${selected[0]}?`" :busy="busy" @close="deleting = false" @confirm="deleteBudget" />
  </div>

  <!-- Cost allocation tags -->
  <div v-else-if="page === 'tags'">
    <CsHeader title="Cost allocation tags" description="Activated tags appear as a dimension in Cost Explorer for usage recorded after activation - start a backfill for earlier months." />
    <section class="cs-container"><div class="cs-container__body cs-stack">
      <table class="cs-table-mini"><thead><tr><th>Tag key</th><th>Status</th><th /></tr></thead>
        <tbody><tr v-for="k in tagKeys" :key="k"><td>{{ k }}</td><td>{{ active.includes(k) ? 'Active' : 'Inactive' }}</td>
          <td><button type="button" class="cs-btn cs-btn--inline" :disabled="busy" @click="toggleTag(k)">{{ active.includes(k) ? 'Deactivate' : 'Activate' }}</button></td></tr></tbody></table>
      <div class="cs-row"><label class="cs-label" for="bf-from">Backfill from</label>
        <input id="bf-from" v-model="backfillFrom" type="date" class="cs-input bl__date" />
        <button type="button" class="cs-btn" :disabled="busy" @click="backfill">Backfill tags</button>
        <span class="cs-muted">{{ cost.backfill ? 'Last backfill from ' + cost.backfill : '' }}</span></div>
    </div></section>
  </div>

  <!-- Cost Explorer -->
  <div v-else>
    <CsHeader title="Cost Explorer" description="Every request to the Cost Explorer API costs $0.01." />
    <section class="cs-container"><div class="cs-container__body">
      <div class="bl__controls">
        <div class="cs-field"><label class="cs-label" for="ce-from">Start</label><input id="ce-from" v-model="start" type="date" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label" for="ce-to">End</label><input id="ce-to" v-model="end" type="date" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label" for="ce-gran">Granularity</label>
          <select id="ce-gran" v-model="granularity" class="cs-select"><option value="MONTHLY">Monthly</option><option value="DAILY">Daily</option></select></div>
        <div class="cs-field"><label class="cs-label" for="ce-group">Group by</label>
          <select id="ce-group" v-model="groupBy" class="cs-select"><option value="DIMENSION:SERVICE">Service</option><option value="DIMENSION:USAGE_TYPE">Usage type</option>
            <option v-for="k in tagKeys" :key="k" :value="'TAG:' + k">Tag: {{ k }}</option></select></div>
        <button type="button" class="cs-btn cs-btn--primary bl__apply" :disabled="busy" @click="report">Apply</button>
      </div>
    </div></section>
    <section v-if="results.length" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Cost and usage breakdown" :level="2" :info="false" /></div>
      <div class="cs-container__body">
        <div v-for="period in results" :key="period.TimePeriod.Start" class="bl__period">
          <strong>{{ period.TimePeriod.Start }}{{ period.Estimated ? ' (estimated)' : '' }}</strong>
          <div v-for="g in period.Groups" :key="g.Keys.join('|')" class="bl__bar">
            <span class="bl__label">{{ g.Keys.join(', ') || 'Total' }}</span>
            <span class="bl__track"><span class="bl__fill" :style="{ width: pct(g, period) + '%' }" /></span>
            <span class="bl__amt">${{ g.Metrics.UnblendedCost.Amount }}</span>
          </div>
          <div v-if="!period.Groups.length" class="bl__bar"><span class="bl__label">Total</span><span class="bl__amt">${{ period.Total.UnblendedCost.Amount }}</span></div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/** Billing and Cost Management: Cost Explorer (group by service, usage type, tag), cost allocation tags, Budgets. */
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsHeader from '../CsHeader.vue';
import CsModal from '../CsModal.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const page = computed(() => ctx.route.value.page);
const budgets = computed(() => rows(ctx.view.value, 'budgets'));
const topics = computed(() => rows(ctx.view.value, 'sns'));
const cost = computed(() => (ctx.view.value.cost || {}) as Record<string, any>);
const active = computed<string[]>(() => cost.value.active_tags || []);
const tagKeys = computed(() => Array.from(new Set(['cost-center', ...active.value])));
const busy = ref(false);
const selected = ref<string[]>([]);
const deleting = ref(false);
const start = ref('2026-10-01');
const end = ref('2026-11-01');
const granularity = ref('MONTHLY');
const groupBy = ref('DIMENSION:SERVICE');
const results = ref<any[]>([]);
const backfillFrom = ref('2026-10-01');
const form = reactive({ open: false, name: 'shopflow-data-platform-monthly', period: 'MONTHLY', amount: 3000, topic: '', email: '',
  alerts: [{ type: 'ACTUAL', threshold: 80 }, { type: 'FORECASTED', threshold: 100 }] });

const budgetColumns: Column[] = [
  { id: 'name', header: 'Name' }, { id: 'limit', header: 'Budgeted', cell: r => `$${Number(r.limit).toFixed(2)}` },
  { id: 'actual', header: 'Amount used', cell: r => `$${Number(r.actual).toFixed(2)}` },
  { id: 'forecast', header: 'Forecasted amount', cell: r => `$${Number(r.forecast).toFixed(2)}` },
  { id: 'alerts', header: 'Alerts' }, { id: 'time_unit', header: 'Period' },
];

function pct(g: any, period: any) {
  const max = Math.max(...period.Groups.map((x: any) => Number(x.Metrics.UnblendedCost.Amount)), 0.0001);
  return Math.max(1, Math.round(Number(g.Metrics.UnblendedCost.Amount) / max * 100));
}
async function report() {
  busy.value = true;
  const [type, key] = groupBy.value.split(':');
  const result = await ctx.run(cli(['aws', 'ce', 'get-cost-and-usage'], {
    '--time-period': `Start=${start.value},End=${end.value}`, '--granularity': granularity.value,
    '--metrics': ['UnblendedCost'], '--group-by': `Type=${type},Key=${key}` }), '', { quiet: true });
  results.value = ((result.data || {}) as { cost?: any[] }).cost || [];
  busy.value = false;
}
async function toggleTag(key: string) {
  busy.value = true;
  await ctx.run(cli(['aws', 'ce', 'update-cost-allocation-tags-status'], {
    '--cost-allocation-tags-status': `TagKey=${key},Status=${active.value.includes(key) ? 'Inactive' : 'Active'}` }), 'Cost allocation tags updated.');
  busy.value = false;
}
async function backfill() {
  busy.value = true;
  await ctx.run(cli(['aws', 'ce', 'start-cost-allocation-tag-backfill'], { '--backfill-from': `${backfillFrom.value}T00:00:00Z` }),
    'Backfill requested.');
  busy.value = false;
}
async function createBudget() {
  busy.value = true;
  const budget = { BudgetName: form.name, BudgetLimit: { Amount: String(form.amount), Unit: 'USD' }, TimeUnit: form.period, BudgetType: 'COST' };
  const subscribers = [
    ...(form.topic ? [{ SubscriptionType: 'SNS', Address: form.topic }] : []),
    ...(form.email ? [{ SubscriptionType: 'EMAIL', Address: form.email }] : []),
  ];
  const notes = subscribers.length ? form.alerts.map(a => ({ Notification: { NotificationType: a.type, ComparisonOperator: 'GREATER_THAN',
    Threshold: a.threshold, ThresholdType: 'PERCENTAGE' }, Subscribers: subscribers })) : [];
  const result = await ctx.run(cli(['aws', 'budgets', 'create-budget'], { '--account-id': ctx.account.value,
    '--budget': JSON.stringify(budget), '--notifications-with-subscribers': notes.length ? JSON.stringify(notes) : '' }),
  `Budget ${form.name} created.`);
  busy.value = false;
  if (result.ok) form.open = false;
}
async function deleteBudget() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'budgets', 'delete-budget'], { '--account-id': ctx.account.value, '--budget-name': selected.value[0] }),
    'Budget deleted.');
  busy.value = false;
  if (result.ok) { deleting.value = false; selected.value = []; }
}
</script>

<style scoped>
.bl__controls { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: flex-end; }
.bl__controls .cs-field { width: 180px; }
.bl__apply { margin-bottom: 2px; }
.bl__date { width: 170px; }
.bl__period { margin-bottom: 16px; }
.bl__bar { display: grid; grid-template-columns: minmax(120px, 280px) minmax(80px, 1fr) 100px; gap: 10px; align-items: center; padding: 3px 0; }
.bl__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bl__track { height: 12px; background: #ebebf0; border-radius: 6px; overflow: hidden; }
.bl__fill { display: block; height: 100%; background: #006ce0; }
.bl__amt { text-align: right; font-variant-numeric: tabular-nums; }
</style>
