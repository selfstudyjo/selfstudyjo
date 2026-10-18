<template>
  <CsTable v-if="page === 'policies'" variant="full-page" title="Policies" :items="shown" :columns="cols" track-by="arn" selection-type="single" v-model:selected="sel"
           description="A policy is an object in AWS that defines permissions." filter-placeholder="Filter by Type">
    <template #actions>
      <CsDropdown :items="[{ id: 'delete', text: 'Delete', disabled: !selectedLocal }]" :disabled="!sel.length" @select="deleting = sel[0]" />
      <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('iam', 'policy-create')">Create policy</button>
    </template>
    <template #tools>
      <select v-model="filter" class="cs-select ip__type" aria-label="Filter by type">
        <option value="">All types</option><option value="aws">AWS managed</option><option value="local">Customer managed</option></select>
    </template>
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('iam', 'policy', { arn: row.arn, name: row.name })">{{ row.name }}</a></template>
  </CsTable>

  <div v-else-if="page === 'policy-create'">
    <CsHeader title="Specify permissions" description="Add permissions by selecting services, actions, resources, and conditions. Build permission statements using the JSON editor." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Policy editor" :level="2"><template #actions><span class="cs-badge cs-badge--blue">JSON</span></template></CsHeader></div>
      <div class="cs-container__body"><textarea v-model="doc" class="cs-textarea cs-mono ip__json" spellcheck="false" />
        <span v-if="docProblem" class="cs-error-text">{{ docProblem }}</span></div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Policy details" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Policy name</label><input v-model="name" class="cs-input" :class="{ 'is-invalid': nameProblem }" />
          <span v-if="nameProblem" class="cs-error-text">{{ nameProblem }}</span>
          <span v-else class="cs-constraint">Maximum 128 characters. Use alphanumeric and '+=,.@-_' characters.</span></div>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('iam', 'policies')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !name || !!nameProblem || !!docProblem" @click="create"><span v-if="busy" class="cs-btn__spinner" />Create policy</button>
    </div>
  </div>

  <div v-else-if="policy">
    <CsHeader :title="policy.name"><template #actions>
      <button v-if="!policy.aws" type="button" class="cs-btn" @click="deleting = policy.arn">Delete</button></template></CsHeader>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Policy details" :level="2" :info="false" /></div>
      <div class="cs-container__body"><dl class="cs-kv">
        <div><dt>Type</dt><dd>{{ policy.aws ? 'AWS managed' : 'Customer managed' }}</dd></div>
        <div><dt>ARN</dt><dd class="cs-mono">{{ policy.arn }}</dd></div>
        <div><dt>Attached entities</dt><dd>{{ policy.attachments }}</dd></div>
      </dl></div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Permissions defined in this policy" :level="2" /></div>
      <div class="cs-container__body"><pre class="cs-code">{{ pretty(policy.doc) }}</pre></div>
    </section>
  </div>
  <NotFound v-else what="Policy" :id="ctx.route.value.params?.name || ''" back="policies" />

  <CsDelete v-if="deleting" :title="`Delete ${lastPart(deleting)}?`" :word="lastPart(deleting)" :busy="busy" @close="deleting = ''" @confirm="remove">
    <p class="ip__p">A policy attached to users or roles cannot be deleted. Detach it first.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';
import { lastPart, parseJson as parseDoc, pretty } from '../kit';
import NotFound from './NotFound.vue';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const filter = ref('');
const busy = ref(false);
const deleting = ref('');
const name = ref('');
const doc = ref(pretty({ Version: '2012-10-17', Statement: [{ Sid: 'Statement1', Effect: 'Allow', Action: [], Resource: [] }] }));

const policies = computed(() => rows<any>(ctx.c.value, 'iam.policies').map(p => ({ ...p, type: p.aws ? 'AWS managed' : 'Customer managed', used: p.attachments ? 'Permissions policy' : '-' })));
const shown = computed(() => policies.value.filter(p => !filter.value || (filter.value === 'aws') === p.aws));
const policy = computed<any>(() => policies.value.find(p => p.arn === ctx.route.value.params?.arn) || null);
const selectedLocal = computed(() => policies.value.some(p => p.arn === sel.value[0] && !p.aws));
const cols = [{ id: 'name', header: 'Policy name', sortKey: 'name' }, { id: 'type', header: 'Type', sortKey: 'type' },
  { id: 'used', header: 'Used as' }, { id: 'attachments', header: 'Attached entities', sortKey: 'attachments' }];
const docProblem = computed(() => parseDoc(doc.value)[1]);
const nameProblem = computed(() => {
  if (!name.value) return '';
  if (!/^[\w+=,.@-]{1,128}$/.test(name.value)) return 'Use alphanumeric and \'+=,.@-_\' characters.';
  return policies.value.some(p => !p.aws && p.name === name.value) ? `A policy called ${name.value} already exists.` : '';
});
async function create() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'iam', 'create-policy'], {
    '--policy-name': name.value, '--policy-document': JSON.stringify(JSON.parse(doc.value)),
  }), `Policy ${name.value} created.`);
  busy.value = false;
  if (result.ok) ctx.to('iam', 'policies');
}
async function remove() {
  busy.value = true;
  const arn = deleting.value;
  const result = await ctx.run(cli(['aws', 'iam', 'delete-policy'], { '--policy-arn': arn }), `Policy ${lastPart(arn)} deleted.`);
  busy.value = false;
  deleting.value = '';
  if (result.ok) { sel.value = []; if (page.value === 'policy') ctx.to('iam', 'policies'); }
}
</script>

<style scoped>
.ip__p { margin: 0; }
.ip__json { min-height: 320px; }
.ip__type { width: 200px; }
</style>
