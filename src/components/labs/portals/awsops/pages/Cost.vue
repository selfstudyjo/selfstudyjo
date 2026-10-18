<template>
  <div v-if="page === 'explorer'">
    <CsHeader title="Cost Explorer" description="September 2026 - monthly, unblended cost." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Report parameters" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-row co__params">
        <div class="cs-field"><label class="cs-label">Group by</label>
          <select v-model="groupBy" class="cs-select"><option value="SERVICE">Service</option><option v-for="t in tagKeys" :key="t" :value="`TAG:${t}`">Tag: {{ t }}</option></select></div>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="runReport">Apply</button>
        <button type="button" class="cs-btn" :disabled="busy" @click="forecast">Forecast next month</button>
      </div>
    </section>
    <div v-if="note" class="cs-alert cs-alert--warning co__space"><CsIcon name="status-warning" class="cs-alert__icon" /><div>{{ note }}</div></div>
    <section class="cs-container co__space">
      <div class="cs-container__head"><CsHeader :title="`Total cost: ${money(total)}`" :level="2" :info="false" :description="forecastText" /></div>
      <div class="cs-container__body">
        <div v-for="b in bars" :key="b.label" class="co__bar">
          <span class="co__label">{{ b.label }}</span>
          <span class="co__track"><span class="co__fill" :style="{ width: `${total ? (100 * b.amount) / max : 0}%` }" /></span>
          <span class="co__amt">{{ money(b.amount) }}</span>
        </div>
      </div>
    </section>
  </div>

  <div v-else-if="page === 'tags'" class="cs-stack">
    <CsTable title="User-defined cost allocation tags" :items="cost.allocation_tags" :columns="tagCols" track-by="key" selection-type="multi" v-model:selected="tagSel">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!tagSel.length || busy" @click="setTags('Inactive')">Deactivate</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!tagSel.length || busy" @click="setTags('Active')">Activate</button>
      </template>
      <template #cell-active="{ row }"><CsStatus :type="row.active ? 'success' : 'stopped'" :label="row.active ? 'Active' : 'Inactive'" /></template>
    </CsTable>
    <CsTable title="Resources missing CostCenter" description="Tag Editor - running instances whose spend no cost centre owns."
             :items="untagged" :columns="untagCols" track-by="id" selection-type="multi" v-model:selected="untagSel" empty-title="Every running instance is tagged">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" :disabled="!untagSel.length" @click="tagging = { cc: 'CC-PAY-001', owner: 'cloud-ops' }">Manage tags of selected resources</button></template>
    </CsTable>
  </div>

  <div v-else-if="page === 'budgets'">
    <CsTable variant="full-page" title="Budgets" :items="budgets" :columns="budgetCols" track-by="name" empty-title="No budgets" empty-text="Create a budget to be alerted before the bill arrives.">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="budgetForm = { name: 'monthly-cost', limit: '7200', email: true }">Create budget</button></template>
    </CsTable>
  </div>

  <div v-else-if="page === 'rightsizing'">
    <CsTable variant="full-page" title="Rightsizing recommendations" :items="cost.rightsizing" :columns="rsCols" track-by="id" empty-title="No recommendations"
             empty-text="Nothing running is oversized.">
      <template #cell-instance="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('ec2', 'instance', { id: row.id })">{{ row.instance }}</a></template>
    </CsTable>
  </div>

  <div v-else-if="page === 'savings-plans'" class="cs-stack">
    <CsHeader title="Savings Plans" description="Commit to an hourly spend on compute for one or three years." />
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Utilization</dt><dd>{{ cost.coverage?.[1] ?? 0 }}%</dd></div><div><dt>Coverage</dt><dd>{{ cost.coverage?.[0] ?? 0 }}%</dd></div>
      <div><dt>Active plans</dt><dd>{{ plans.length }}</dd></div>
      <div><dt>Recommended commitment</dt><dd>${{ cost.recommendation?.commitment }}/hour (Compute, 1 year, no upfront)</dd></div>
    </dl></div></section>
    <CsTable title="Recommendations" :items="recs" :columns="recCols" track-by="key" empty-title="No recommendation yet" empty-text="Choose Refresh to ask Cost Explorer.">
      <template #actions><button type="button" class="cs-btn" :disabled="busy" @click="recommend">Refresh</button></template>
    </CsTable>
    <CsTable title="Inventory" :items="plans" :columns="planCols" track-by="id" empty-title="No Savings Plans">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="openPurchase">Purchase Savings Plans</button></template>
    </CsTable>
  </div>

  <div v-else-if="page === 'reservations'" class="cs-stack">
    <CsHeader title="Reservations" description="Reserved Instances - for services a Savings Plan does not cover, such as RDS." />
    <CsTable title="RDS databases" :items="cost.rds" :columns="rdsCols" track-by="id">
      <template #cell-covered="{ row }"><CsStatus :type="covered(row) ? 'success' : 'warning'" :label="covered(row) ? 'Reserved' : 'On-Demand'" /></template>
    </CsTable>
    <CsTable title="Reserved DB instance offerings" description="db.m5.large, postgresql, 1 year, No Upfront" :items="cost.rds_offerings" :columns="offCols" track-by="id"
             selection-type="single" v-model:selected="riSel">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" :disabled="!riSel.length || busy" @click="buyRi">Purchase Reserved DB Instance</button></template>
    </CsTable>
    <CsTable title="Purchased reservations" :items="cost.reserved_db.map((r: any, i: number) => ({ ...r, key: i }))" :columns="riCols" track-by="key" empty-title="No reservations" />
  </div>

  <CsModal v-if="tagging" title="Manage tags" @close="tagging = null">
    <div class="cs-stack">
      <p class="co__p">Add tags to {{ untagSel.length }} resource(s). Existing tags with the same key are replaced.</p>
      <div class="cs-field"><label class="cs-label">CostCenter</label><input v-model="tagging.cc" class="cs-input" /></div>
      <div class="cs-field"><label class="cs-label">Owner</label><input v-model="tagging.owner" class="cs-input" /></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="tagging = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !tagging.cc.trim()" @click="applyTags">Save changes</button>
    </template>
  </CsModal>

  <CsModal v-if="budgetForm" title="Create budget" @close="budgetForm = null">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Budget name</label><input v-model="budgetForm.name" class="cs-input" /></div>
      <div class="cs-field"><label class="cs-label">Budgeted amount ($ per month)</label><input v-model="budgetForm.limit" class="cs-input" inputmode="decimal" /></div>
      <label class="cs-check"><input v-model="budgetForm.email" type="checkbox" /><span>Alert finops-alerts (SNS) when forecasted spend exceeds 100%</span></label>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="budgetForm = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !budgetForm.name.trim() || !(Number(budgetForm.limit) > 0)" @click="createBudget">Create budget</button>
    </template>
  </CsModal>

  <CsModal v-if="purchase" title="Purchase Savings Plans" @close="purchase = null">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Offering</label>
        <select v-model="purchase.offering" class="cs-select"><option v-for="o in cost.offerings" :key="o.id" :value="o.id">{{ planName(o.type) }} - {{ o.term === 'ONE_YEAR' ? '1 year' : '3 years' }} - {{ o.payment.replace('_', ' ').toLowerCase() }} ({{ Math.round((1 - o.rate) * 100) }}% off)</option></select></div>
      <div class="cs-field"><label class="cs-label">Hourly commitment ($)</label><input v-model="purchase.commitment" class="cs-input" inputmode="decimal" />
        <span class="cs-constraint">Commit at the always-on baseline - above it the quiet hours are paid for and unused.</span></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="purchase = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !(Number(purchase.commitment) > 0)" @click="buyPlan">Submit order</button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, parseJson, pick, rows } from '@/utils/portalKit';
import CsHeader from '../../aws/CsHeader.vue';
import CsIcon from '../../aws/CsIcon.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import { money } from '../kit';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const busy = ref(false);
const cost = computed<any>(() => pick(ctx.c.value, 'cost', {}));
const tagKeys = computed(() => (cost.value.allocation_tags || []).map((t: any) => t.key));

const groupBy = ref('SERVICE');
const report = ref<{ label: string; amount: number }[] | null>(null);
const note = ref('');
const forecastText = ref('');
const bars = computed(() => report.value || (cost.value.monthly || []).map((m: any) => ({ label: m.service, amount: m.amount })));
const total = computed(() => bars.value.reduce((a: number, b: any) => a + b.amount, 0));
const max = computed(() => Math.max(1, ...bars.value.map((b: any) => b.amount)));
const PERIOD = 'Start=2026-09-01,End=2026-10-01';
async function runReport() {
  busy.value = true;
  const group = groupBy.value === 'SERVICE' ? 'Type=DIMENSION,Key=SERVICE' : `Type=TAG,Key=${groupBy.value.slice(4)}`;
  const result = await ctx.run(cli(['aws', 'ce', 'get-cost-and-usage'], { '--time-period': PERIOD, '--granularity': 'MONTHLY', '--metrics': 'UnblendedCost',
    '--group-by': group }), undefined, { quiet: true });
  busy.value = false;
  if (!result.ok) return;
  const data = parseJson<any>(result.output) || {};
  note.value = data.Note || '';
  report.value = (data.ResultsByTime?.[0]?.Groups || []).map((g: any) => ({ label: g.Keys[0], amount: Number(g.Metrics.UnblendedCost.Amount) }));
}
async function forecast() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ce', 'get-cost-forecast'], { '--time-period': 'Start=2026-10-01,End=2026-11-01', '--metric': 'UNBLENDED_COST',
    '--granularity': 'MONTHLY' }), undefined, { quiet: true });
  busy.value = false;
  if (result.ok) forecastText.value = `Forecast for October: ${money(Number(parseJson<any>(result.output)?.Total?.Amount || 0))}`;
}

const tagSel = ref<string[]>([]);
const tagCols = [{ id: 'key', header: 'Tag key', sortKey: 'key' }, { id: 'active', header: 'Status' }, { id: 'type', header: 'Type', cell: () => 'User-defined' }];
async function setTags(status: string) {
  busy.value = true;
  await ctx.run(cli(['aws', 'ce', 'update-cost-allocation-tags-status'], { '--cost-allocation-tags-status': tagSel.value.map(k => `TagKey=${k},Status=${status}`) }),
    `${tagSel.value.length} tag(s) ${status === 'Active' ? 'activated' : 'deactivated'}.`);
  busy.value = false;
  tagSel.value = [];
}
const untagSel = ref<string[]>([]);
const tagging = ref<any>(null);
const untagged = computed(() => rows<any>(ctx.c.value, 'ec2.instances').filter(i => i.state === 'running' && !i.region && !(i.tags || {}).CostCenter)
  .map(i => ({ ...i, arn: `arn:aws:ec2:${ctx.home.value}:${ctx.account.value}:instance/${i.id}` })));
const untagCols = [{ id: 'name', header: 'Name' }, { id: 'id', header: 'Identifier' }, { id: 'type', header: 'Type', cell: () => 'EC2 Instance' }, { id: 'arn', header: 'ARN' }];
async function applyTags() {
  busy.value = true;
  const arns = untagged.value.filter(i => untagSel.value.includes(i.id)).map(i => i.arn);
  const tags = [`CostCenter=${tagging.value.cc.trim()}`, tagging.value.owner.trim() ? `Owner=${tagging.value.owner.trim()}` : ''].filter(Boolean).join(',');
  const result = await ctx.run(cli(['aws', 'resourcegroupstaggingapi', 'tag-resources'], { '--resource-arn-list': arns, '--tags': tags }), `Tags applied to ${arns.length} resource(s).`);
  busy.value = false;
  if (result.ok) { tagging.value = null; untagSel.value = []; }
}

const budgets = computed(() => (cost.value.budgets || []).map((b: any) => ({ ...b, limitText: money(b.limit), forecast: money(total.value) })));
const budgetCols = [{ id: 'name', header: 'Name' }, { id: 'limitText', header: 'Budgeted amount' }, { id: 'forecast', header: 'Forecasted amount' },
  { id: 'notifications', header: 'Alerts', cell: (b: any) => (b.notifications ? 'Configured' : '-') }];
const budgetForm = ref<any>(null);
async function createBudget() {
  const f = budgetForm.value;
  const budget = { BudgetName: f.name.trim(), BudgetLimit: { Amount: String(Number(f.limit)), Unit: 'USD' }, TimeUnit: 'MONTHLY', BudgetType: 'COST' };
  const notifications = [{ Notification: { NotificationType: 'FORECASTED', ComparisonOperator: 'GREATER_THAN', Threshold: 100 },
    Subscribers: [{ SubscriptionType: 'SNS', Address: `arn:aws:sns:${ctx.home.value}:${ctx.account.value}:finops-alerts` }] }];
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'budgets', 'create-budget'], { '--account-id': ctx.account.value, '--budget': JSON.stringify(budget),
    '--notifications-with-subscribers': f.email ? JSON.stringify(notifications) : '' }), `Budget ${f.name} created.`);
  busy.value = false;
  if (result.ok) budgetForm.value = null;
}

const rsCols = [{ id: 'instance', header: 'Instance name' }, { id: 'id', header: 'Instance ID' }, { id: 'type', header: 'Current type' },
  { id: 'action', header: 'Recommended action' }, { id: 'target', header: 'Recommended type' }, { id: 'cpu_p95', header: 'CPU p95 %' },
  { id: 'saving', header: 'Estimated monthly savings', cell: (r: any) => money(r.saving) }];

function planName(t: string) { return t === 'COMPUTE_SP' ? 'Compute Savings Plan' : 'EC2 Instance Savings Plan'; }
const plans = computed(() => (cost.value.savings_plans || []).map((p: any) => ({ ...p, name: planName(p.type) })));
const planCols = [{ id: 'id', header: 'Savings Plan ID' }, { id: 'name', header: 'Type' }, { id: 'term', header: 'Term' }, { id: 'payment', header: 'Payment option' },
  { id: 'commitment', header: 'Commitment', cell: (p: any) => `$${Number(p.commitment).toFixed(2)}/hour` }, { id: 'state', header: 'State', cell: () => 'Active' }];
const recs = ref<any[]>([]);
const recCols = [{ id: 'type', header: 'Savings Plan type' }, { id: 'commit', header: 'Hourly commitment' }, { id: 'saving', header: 'Estimated monthly savings' },
  { id: 'util', header: 'Estimated utilization' }];
async function recommend() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ce', 'get-savings-plans-purchase-recommendation'], { '--savings-plans-type': 'COMPUTE_SP', '--term-in-years': 'ONE_YEAR',
    '--payment-option': 'NO_UPFRONT', '--lookback-period-in-days': 'THIRTY_DAYS' }), undefined, { quiet: true });
  busy.value = false;
  const d = parseJson<any>(result.output)?.SavingsPlansPurchaseRecommendation;
  const row = d?.SavingsPlansPurchaseRecommendationDetails?.[0];
  if (row) recs.value = [{ key: 1, type: 'Compute, 1 year, No Upfront', commit: `$${row.HourlyCommitmentToPurchase}/hour`,
    saving: money(Number(row.EstimatedMonthlySavingsAmount)), util: `${row.EstimatedAverageUtilization}%` }];
}
const purchase = ref<any>(null);
function openPurchase() {
  const off = (cost.value.offerings || []).find((o: any) => o.type === 'COMPUTE_SP' && o.term === 'ONE_YEAR' && o.payment === 'NO_UPFRONT');
  purchase.value = { offering: off?.id || '', commitment: String(cost.value.recommendation?.commitment ?? '') };
}
async function buyPlan() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'savingsplans', 'create-savings-plan'], { '--savings-plan-offering-id': purchase.value.offering,
    '--commitment': purchase.value.commitment }), 'Savings Plan purchased.');
  busy.value = false;
  if (result.ok) purchase.value = null;
}

const riSel = ref<string[]>([]);
function covered(db: any) { return (cost.value.reserved_db || []).some((r: any) => r.class === db.class && r.multi_az === db.multi_az); }
const rdsCols = [{ id: 'id', header: 'DB identifier' }, { id: 'class', header: 'Class' }, { id: 'engine', header: 'Engine' },
  { id: 'multi_az', header: 'Multi-AZ', cell: (d: any) => (d.multi_az ? 'Yes' : 'No') }, { id: 'covered', header: 'Pricing' }];
const offCols = [{ id: 'id', header: 'Offering ID' }, { id: 'class', header: 'DB instance class' },
  { id: 'multi_az', header: 'Multi-AZ', cell: (o: any) => (o.multi_az ? 'Yes' : 'No') }, { id: 'rate', header: 'Hourly charge', cell: (o: any) => `$${Number(o.rate).toFixed(3)}` }];
const riCols = [{ id: 'class', header: 'DB instance class' }, { id: 'multi_az', header: 'Multi-AZ', cell: (r: any) => (r.multi_az ? 'Yes' : 'No') },
  { id: 'state', header: 'State', cell: () => 'active' }];
async function buyRi() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'rds', 'purchase-reserved-db-instances-offering'], { '--reserved-db-instances-offering-id': riSel.value[0] }), 'Reserved DB instance purchased.');
  busy.value = false;
  if (result.ok) riSel.value = [];
}
</script>

<style scoped>
.co__params { align-items: flex-end; flex-wrap: wrap; }
.co__space { margin-top: 20px; }
.co__p { margin: 0; }
.co__bar { display: grid; grid-template-columns: minmax(0, 260px) 1fr 100px; gap: 12px; align-items: center; padding: 4px 0; }
.co__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.co__track { height: 14px; background: #f3f3f7; border-radius: 2px; overflow: hidden; }
.co__fill { display: block; height: 100%; background: #688ae8; }
.co__amt { text-align: right; font-variant-numeric: tabular-nums; }
@container sl-portal (max-width: 560px) { .co__bar { grid-template-columns: 1fr 90px; } .co__track { display: none; } }
</style>
