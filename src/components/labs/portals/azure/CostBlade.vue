<template>
  <div class="az-split">
    <nav class="az-svcmenu" aria-label="Cost Management menu">
      <template v-for="item in MENU" :key="item.key">
        <div v-if="item.group" class="az-svcmenu__group">{{ item.label }}</div>
        <button v-else type="button" class="az-svcmenu__item" :class="{ 'is-active': tab === item.key }" @click="emit('tab', item.key)">
          <AzIcon :name="item.icon || 'cost'" /> {{ item.label }}</button>
      </template>
    </nav>
    <div class="az-content">
      <template v-if="tab === 'costanalysis' || tab === 'overview'">
        <div class="az-cmdbar">
          <button type="button" class="az-cmd" @click="usage"><AzIcon name="refresh" /> Refresh</button>
          <button type="button" class="az-cmd" @click="exportCsv"><AzIcon name="download" /> Download</button>
        </div>
        <div class="az-filters">
          <span class="az-pill">Scope : <b>{{ az.p.value.account?.subscription_name }}</b></span>
          <span class="az-pill">View : <b>AccumulatedCosts</b></span>
          <span class="az-pill">This month</span>
          <label class="az-pill">Group by : <select v-model="by" aria-label="Group by" @change="usage">
            <option value="resource">Resource</option><option value="group">Resource group name</option>
            <option value="tag">Tag: owner</option><option value="service">Service name</option></select></label>
        </div>
        <div class="az-cost__kpis">
          <div><div class="az-muted">ACTUAL COST (USD)</div><div class="az-big">${{ total.toLocaleString() }}</div></div>
          <div><div class="az-muted">FORECAST: CHART VIEW ON</div><div class="az-big">${{ Math.round(total * 1.04).toLocaleString() }}</div></div>
          <div v-if="budgets[0]"><div class="az-muted">BUDGET: {{ String(budgets[0].name).toUpperCase() }}</div>
            <div class="az-big">${{ Number(budgets[0].amount).toLocaleString() }}</div></div>
        </div>
        <div class="az-cost__chart" role="img" :aria-label="`Cost by ${by}`">
          <div v-for="b in buckets" :key="b.label" class="az-cost__bar">
            <span class="az-cost__label" :title="b.label">{{ b.label }}</span>
            <span class="az-cost__track"><span class="az-cost__fill" :style="{ width: (100 * b.value / maxBucket) + '%' }"></span></span>
            <span class="az-cost__val">${{ b.value.toLocaleString() }}</span>
          </div>
          <div v-if="!buckets.length" class="az-muted" style="padding: 20px">No cost data. Nothing is costing anything yet.</div>
        </div>
        <AzTable :columns="cols" :rows="costRows" row-key="resource">
          <template #cell-monthly="{ row }">${{ Number(row.monthly).toLocaleString() }}</template>
          <template #cell-owner="{ row }"><span :class="{ 'az-warntext': !row.owner }">{{ row.owner || 'untagged' }}</span></template>
        </AzTable>
        <pre v-if="output" class="az-code" style="margin-top: 10px">{{ output }}</pre>
      </template>

      <template v-else-if="tab === 'budgets'">
        <div class="az-cmdbar"><button type="button" class="az-cmd" @click="openBudget"><AzIcon name="plus" /> Add</button>
          <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button></div>
        <AzTable :columns="budgetCols" :rows="budgetRows" row-key="name">
          <template #cell-actions="{ row }"><button type="button" class="az-link" @click="removeBudget(row)">Delete</button></template>
          <template #empty>No budgets. Spend with no budget is spend nobody is watching.</template>
        </AzTable>
      </template>

      <template v-else-if="tab === 'advisor'">
        <p class="az-intro">Right-size or shut down underutilized resources. Recommendations are computed from what is deployed.</p>
        <button type="button" class="az-btn az-btn--primary" @click="rightsize">Refresh recommendations</button>
        <pre v-if="advice" class="az-code" style="margin-top: 10px">{{ advice }}</pre>
      </template>

      <template v-else-if="tab === 'reservations'">
        <div class="az-cmdbar"><button type="button" class="az-cmd" @click="buying = true"><AzIcon name="plus" /> Purchase</button>
          <button type="button" class="az-cmd" @click="reservations"><AzIcon name="refresh" /> Refresh</button></div>
        <pre v-if="resOut" class="az-code">{{ resOut }}</pre>
        <div v-else class="az-empty"><AzIcon name="props" :size="48" />
          <h3>No reservations to display</h3>
          <p>Purchase a reservation to save on virtual machines you run continuously, or select Refresh to list them.</p></div>
        <AzPane v-if="buying" title="Purchase reservations" :error="error" @close="buying = false">
          <div class="az-field"><div class="az-field__label">Product</div>
            <div class="az-field__ctl"><select v-model="res.sku" class="az-select"><option value="compute">Virtual machines (compute)</option></select></div></div>
          <div class="az-field"><div class="az-field__label">Term</div>
            <div class="az-radios"><label class="az-radio"><input v-model="res.term" type="radio" value="1Y" /> One year</label>
              <label class="az-radio"><input v-model="res.term" type="radio" value="3Y" /> Three years</label></div></div>
          <div class="az-banner is-warning"><AzIcon name="warning" /><span>A reservation is a commitment, billed whether or not the capacity is used.</span></div>
          <template #foot>
            <button type="button" class="az-btn az-btn--primary" @click="purchase">Buy now</button>
            <button type="button" class="az-btn" @click="buying = false">Cancel</button>
          </template>
        </AzPane>
      </template>
    </div>

    <AzPane v-if="budgeting" title="Create budget" :error="error" @close="budgeting = false">
      <div class="az-field"><div class="az-field__label">Name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="b.name" class="az-input" /></div></div>
      <div class="az-field"><div class="az-field__label">Reset period</div><div class="az-field__ctl">Monthly</div></div>
      <div class="az-field"><div class="az-field__label">Amount <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="b.amount" class="az-input" type="number" min="1" />
          <div class="az-help">Current run rate: ${{ total.toLocaleString() }} / month</div></div></div>
      <h3 class="az-group-title">Alert conditions</h3>
      <div class="az-field"><div class="az-field__label">% of budget</div>
        <div class="az-field__ctl"><input v-model="b.thresholds" class="az-input" placeholder="80, 100" /></div></div>
      <div class="az-field"><div class="az-field__label">Alert recipients (email)</div>
        <div class="az-field__ctl"><input v-model="b.emails" class="az-input" placeholder="finops@selfstudy.jo" /></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!b.name || !(Number(b.amount) > 0)" @click="createBudget">Create</button>
        <button type="button" class="az-btn" @click="budgeting = false">Cancel</button>
      </template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/** Cost Management: cost analysis, budgets, Advisor recommendations, reservations. */
import { computed, reactive, ref } from 'vue';
import { cli, errorText, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTable from './AzTable.vue';
import { meta, useAz } from './azure';

defineProps<{ tab: string }>();
const emit = defineEmits<{ (event: 'tab', tab: string): void }>();
const az = useAz();
const MENU = [
  { key: 'g1', label: 'Reporting + analytics', group: true }, { key: 'costanalysis', label: 'Cost analysis', icon: 'cost' },
  { key: 'g2', label: 'Monitoring', group: true }, { key: 'budgets', label: 'Budgets', icon: 'cost' },
  { key: 'g3', label: 'Optimization', group: true }, { key: 'advisor', label: 'Advisor recommendations', icon: 'advisor' },
  { key: 'reservations', label: 'Reservations', icon: 'props' },
];
const cost = computed(() => rows(az.v.value, 'cost'));
const total = computed(() => cost.value.reduce((a, r) => a + Number(r.monthly || 0), 0));
const budgets = computed(() => rows(az.p.value, 'budgets'));
const by = ref('resource');
const buckets = computed(() => {
  const map = new Map<string, number>();
  for (const r of cost.value) {
    const key = by.value === 'group' ? String(r.group) : by.value === 'tag' ? (r.owner || '(untagged)')
      : by.value === 'service' ? meta(r.kind).plural : String(r.resource);
    map.set(key, (map.get(key) || 0) + Number(r.monthly || 0));
  }
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b2) => b2.value - a.value);
});
const maxBucket = computed(() => Math.max(1, ...buckets.value.map(x => x.value)));
const costRows = computed(() => cost.value.map((r): Record<string, any> => ({ ...r, service: meta(r.kind).plural })));
const cols = [{ key: 'resource', label: 'Resource' }, { key: 'service', label: 'Service name' }, { key: 'group', label: 'Resource group' },
              { key: 'sku', label: 'Meter' }, { key: 'owner', label: 'Tag: owner' }, { key: 'monthly', label: 'Cost' }, { key: 'share', label: 'Share' }];
const output = ref('');
async function usage() {
  const r = await az.run(cli(['az', 'consumption', 'usage', 'list'], { '--by': by.value === 'service' ? '' : by.value }), '', { quiet: true });
  output.value = String(r.ok ? r.output : r.error || '').trim();
}
function exportCsv() {
  const lines = ['Resource,Service,ResourceGroup,Cost'].concat(costRows.value.map(r => `"${r.resource}","${r.service}","${r.group}",${r.monthly}`));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'CostAnalysis.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

const budgetRows = computed(() => rows(az.v.value, 'budgets').map((x): Record<string, any> => ({ ...x, amountText: `$${Number(x.amount).toLocaleString()}`,
                                                                           actions: '' })));
const budgetCols = [{ key: 'name', label: 'Name' }, { key: 'amountText', label: 'Amount' }, { key: 'used', label: 'Evaluated spend' },
                    { key: 'thresholds', label: 'Alert thresholds (%)' }, { key: 'status', label: 'Status' },
                    { key: 'actions', label: '', sortable: false }];
const budgeting = ref(false);
const error = ref('');
const b = reactive({ name: '', amount: '', thresholds: '80, 100', emails: '' });
function openBudget() { Object.assign(b, { name: '', amount: String(Math.max(100, Math.round(total.value * 1.2))), thresholds: '80, 100', emails: '' }); error.value = ''; budgeting.value = true; }
async function createBudget() {
  const r = await az.run(cli(['az', 'consumption', 'budget', 'create'], { '--budget-name': b.name, '--amount': b.amount,
    '--category': 'cost', '--time-grain': 'monthly', '--thresholds': b.thresholds.replace(/\s/g, ''),
    '--contact-emails': b.emails }), `Budget '${b.name}' was created`, { quiet: true });
  if (!r.ok) { error.value = errorText(r); return; }
  budgeting.value = false;
}
async function removeBudget(row: Record<string, any>) {
  if (!(await az.confirm({ title: 'Delete budget', message: `Delete the budget '${row.name}'?`, confirmLabel: 'Yes', danger: true }))) return;
  await az.run(cli(['az', 'consumption', 'budget', 'delete'], { '--budget-name': row.name }), `Deleted budget '${row.name}'`);
}
const advice = ref('');
async function rightsize() {
  const r = await az.run(cli(['az', 'consumption', 'rightsize']), '', { quiet: true });
  advice.value = String(r.ok ? r.output : r.error || '').trim();
}
const resOut = ref('');
const buying = ref(false);
const res = reactive({ sku: 'compute', term: '1Y' });
async function reservations() {
  const r = await az.run(cli(['az', 'consumption', 'reservation', 'list']), '', { quiet: true });
  resOut.value = String(r.ok ? r.output : r.error || '').trim();
}
async function purchase() {
  const r = await az.run(cli(['az', 'consumption', 'reservation', 'purchase'], { '--sku': res.sku, '--term': res.term }),
                         'Reservation purchased', { quiet: true });
  if (!r.ok) { error.value = errorText(r); return; }
  resOut.value = String(r.output || '').trim();
  buying.value = false;
}
</script>

<style scoped>
.az-cost__kpis { display: flex; flex-wrap: wrap; gap: 32px; margin: 4px 0 12px; }
.az-big { font-size: 28px; font-weight: 600; }
.az-cost__chart { margin: 4px 0 16px; padding: 12px; border: 1px solid #e0e0e0; border-radius: 6px; }
.az-cost__bar { display: grid; grid-template-columns: minmax(80px, 200px) 1fr 80px; gap: 10px; align-items: center; padding: 3px 0; }
.az-cost__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.az-cost__track { height: 14px; background: #f0f0f0; border-radius: 2px; overflow: hidden; }
.az-cost__fill { display: block; height: 100%; background: #0f6cbd; }
.az-cost__val { text-align: right; font-variant-numeric: tabular-nums; }
.az-warntext { color: #bc4b09; font-weight: 600; }
</style>
