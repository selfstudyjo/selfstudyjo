<template>
  <CsTable v-if="page === 'acls'" variant="full-page" title="Web ACLs" :description="`Region: ${ctx.home.value} - REGIONAL resources (Application Load Balancers)`" :items="acls" :columns="cols" track-by="name"
           selection-type="single" v-model:selected="sel" empty-title="No web ACLs" empty-text="Create a web ACL to protect a load balancer.">
    <template #actions>
      <button type="button" class="cs-btn" :disabled="!sel.length" @click="deleting = sel[0]">Delete</button>
      <button type="button" class="cs-btn cs-btn--primary" @click="openCreate">Create web ACL</button>
    </template>
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('waf', 'acl', { name: row.name })">{{ row.name }}</a></template>
  </CsTable>

  <div v-else-if="page === 'acl' && acl">
    <CsHeader :title="acl.name" :description="acl.arn"><template #actions><button type="button" class="cs-btn" @click="deleting = acl.name">Delete</button></template></CsHeader>
    <section class="cs-container"><div class="cs-container__body"><dl class="cs-kv">
      <div><dt>Default web ACL action</dt><dd>{{ acl.default === 'block' ? 'Block' : 'Allow' }}</dd></div><div><dt>Rules</dt><dd>{{ acl.rules.length }}</dd></div>
      <div><dt>Associated resources</dt><dd>{{ acl.resources.length }}</dd></div>
    </dl></div></section>
    <CsTable title="Rules" :items="acl.rules" :columns="ruleCols" track-by="name" empty-title="No rules" />
    <CsTable class="waf__space" title="Associated AWS resources" :items="assoc" :columns="resCols" track-by="arn" selection-type="single" v-model:selected="resSel"
             empty-title="No associated resources">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!resSel.length || busy" @click="disassociate(resSel[0])">Disassociate</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!free.length" @click="adding = free[0]?.arn || ''">Add AWS resources</button>
      </template>
    </CsTable>
  </div>

  <CsModal v-if="form" title="Create web ACL" size="large" @close="form = null">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Name</label><input v-model="form.name" class="cs-input" placeholder="payments-api-waf" /></div>
      <div class="cs-field"><label class="cs-label">Default web ACL action for requests that don't match any rules</label>
        <div class="cs-row"><label class="cs-radio"><input v-model="form.default" type="radio" value="Allow" /><span>Allow</span></label>
          <label class="cs-radio"><input v-model="form.default" type="radio" value="Block" /><span>Block</span></label></div></div>
      <div class="cs-field"><label class="cs-label">AWS managed rule groups</label>
        <div v-for="g in GROUPS" :key="g.name" class="cs-row waf__group">
          <label class="cs-check"><input v-model="form.groups[g.name].on" type="checkbox" /><span>{{ g.label }}<small>{{ g.name }}</small></span></label>
          <select v-model="form.groups[g.name].mode" class="cs-select waf__mode" :disabled="!form.groups[g.name].on"><option value="none">Use rule actions</option><option value="count">Override to Count</option></select>
        </div></div>
      <label class="cs-check"><input v-model="form.rate" type="checkbox" /><span>Rate-based rule (requests per 5 minutes per IP)</span></label>
      <div v-if="form.rate" class="cs-field"><label class="cs-label">Rate limit</label><input v-model="form.limit" class="cs-input" inputmode="numeric" /></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="form = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !/^[\w-]{1,128}$/.test(form.name)" @click="create">Create web ACL</button>
    </template>
  </CsModal>

  <CsModal v-if="adding !== null" title="Add AWS resources" @close="adding = null">
    <div class="cs-field"><label class="cs-label">Application Load Balancer</label>
      <select v-model="adding" class="cs-select"><option v-for="a in free" :key="a.arn" :value="a.arn">{{ a.name }}{{ a.waf ? ` (currently ${a.waf})` : '' }}</option></select></div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="adding = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !adding" @click="associate">Add</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete web ACL" :word="deleting" :busy="busy" @close="deleting = ''" @confirm="remove">
    <p class="waf__p">A web ACL that is still associated with a resource cannot be deleted - disassociate it first.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const GROUPS = [{ name: 'AWSManagedRulesCommonRuleSet', label: 'Core rule set' }, { name: 'AWSManagedRulesSQLiRuleSet', label: 'SQL database' },
  { name: 'AWSManagedRulesKnownBadInputsRuleSet', label: 'Known bad inputs' }, { name: 'AWSManagedRulesAmazonIpReputationList', label: 'Amazon IP reputation list' }];
const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const resSel = ref<string[]>([]);
const busy = ref(false);
const deleting = ref('');
const adding = ref<string | null>(null);
const form = ref<any>(null);
const acls = computed(() => rows<any>(ctx.c.value, 'security.waf').map(a => ({ ...a, defaultText: a.default === 'block' ? 'Block' : 'Allow', count: a.rules.length })));
const acl = computed<any>(() => acls.value.find(a => a.name === ctx.route.value.params?.name) || null);
const albs = computed(() => rows<any>(ctx.c.value, 'ec2.albs'));
const assoc = computed(() => albs.value.filter(a => acl.value?.resources.includes(a.arn)));
const free = computed(() => albs.value.filter(a => !acl.value?.resources.includes(a.arn)));
const cols = [{ id: 'name', header: 'Name', sortKey: 'name' }, { id: 'defaultText', header: 'Default action' }, { id: 'count', header: 'Rules' },
  { id: 'resources', header: 'Associated resources', cell: (a: any) => a.resources.length }];
const ruleCols = [{ id: 'name', header: 'Name' }, { id: 'priority', header: 'Priority' }, { id: 'kind', header: 'Type', cell: (r: any) => (r.kind === 'rate' ? `Rate-based (${r.limit})` : r.group) },
  { id: 'mode', header: 'Action', cell: (r: any) => (r.mode === 'count' ? 'Count' : 'Block') }];
const resCols = [{ id: 'name', header: 'Name' }, { id: 'type', header: 'Resource type', cell: () => 'Application Load Balancer' }, { id: 'arn', header: 'ARN' }];

function openCreate() {
  form.value = { name: '', default: 'Allow', rate: false, limit: '2000',
    groups: Object.fromEntries(GROUPS.map((g, i) => [g.name, { on: i < 2, mode: 'none' }])) };
}
async function create() {
  const f = form.value;
  const rules: any[] = [];
  let priority = 0;
  for (const g of GROUPS) {
    if (!f.groups[g.name].on) continue;
    rules.push({ Name: g.name, Priority: priority++, Statement: { ManagedRuleGroupStatement: { VendorName: 'AWS', Name: g.name } },
      OverrideAction: f.groups[g.name].mode === 'count' ? { Count: {} } : { None: {} },
      VisibilityConfig: { SampledRequestsEnabled: true, CloudWatchMetricsEnabled: true, MetricName: g.name } });
  }
  if (f.rate) rules.push({ Name: 'rate-limit', Priority: priority++, Statement: { RateBasedStatement: { Limit: Number(f.limit), AggregateKeyType: 'IP' } },
    Action: { Block: {} }, VisibilityConfig: { SampledRequestsEnabled: true, CloudWatchMetricsEnabled: true, MetricName: 'rate-limit' } });
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'wafv2', 'create-web-acl'], { '--name': f.name, '--scope': 'REGIONAL', '--default-action': `${f.default}={}`,
    '--rules': JSON.stringify(rules), '--visibility-config': `SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=${f.name}` }),
    `You successfully created web ACL ${f.name}.`);
  busy.value = false;
  if (result.ok) form.value = null;
}
async function associate() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'wafv2', 'associate-web-acl'], { '--web-acl-arn': acl.value.arn, '--resource-arn': adding.value }), 'Resource associated.');
  busy.value = false;
  if (result.ok) adding.value = null;
}
async function disassociate(arn: string) {
  busy.value = true;
  await ctx.run(cli(['aws', 'wafv2', 'disassociate-web-acl'], { '--resource-arn': arn }), 'Resource disassociated.');
  busy.value = false;
  resSel.value = [];
}
async function remove() {
  const target = acls.value.find(a => a.name === deleting.value);
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'wafv2', 'delete-web-acl'], { '--name': deleting.value, '--scope': 'REGIONAL', '--id': target?.arn.split('/').pop() }),
    `Web ACL ${deleting.value} deleted.`);
  busy.value = false;
  deleting.value = '';
  if (result.ok) { sel.value = []; if (page.value === 'acl') ctx.to('waf', 'acls'); }
}
</script>

<style scoped>
.waf__space { margin-top: 20px; display: block; }
.waf__p { margin: 0; }
.waf__group { justify-content: space-between; flex-wrap: wrap; }
.waf__mode { width: 200px; }
</style>
