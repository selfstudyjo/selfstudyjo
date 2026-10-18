<template>
  <div v-if="group">
    <!-- Edit inbound rules is its own page in the console -->
    <template v-if="editMode">
      <CsHeader title="Edit inbound rules" description="Inbound rules control the incoming traffic that's allowed to reach the instance." />
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Inbound rules" :level="2" /></div>
        <div class="cs-container__body"><SgRuleEditor v-model="draft" show-ids /></div>
      </section>
      <div v-if="draft.some(r => r.cidr.trim() === '0.0.0.0/0')" class="cs-alert cs-alert--warning">
        <CsIcon name="status-warning" class="cs-alert__icon" />
        <div>Rules with source of 0.0.0.0/0 or ::/0 allow all IP addresses to access your instance. We recommend setting security group rules to allow access from known IP addresses only.</div>
      </div>
      <div class="cs-form-actions">
        <button type="button" class="cs-btn cs-btn--link" @click="ctx.to(svc, 'sg', { id: group.id })">Cancel</button>
        <button type="button" class="cs-btn" disabled>Preview changes</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || draft.some(r => ruleProblem(r))" @click="saveRules">
          <span v-if="busy" class="cs-btn__spinner" />Save rules</button>
      </div>
    </template>

    <template v-else>
      <CsHeader :title="`${group.id} - ${group.name}`">
        <template #actions>
          <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Security group refreshed')"><CsIcon name="refresh" /></button>
          <CsDropdown :items="actions" @select="act" />
        </template>
      </CsHeader>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Details" :level="2" :info="false" /></div>
        <div class="cs-container__body">
          <dl class="cs-kv">
            <div><dt>Security group name</dt><dd>{{ group.name }}</dd></div>
            <div><dt>Security group ID</dt><dd class="cs-mono">{{ group.id }}</dd></div>
            <div><dt>Description</dt><dd>{{ group.description }}</dd></div>
            <div><dt>VPC ID</dt><dd><a href="#" class="cs-link" @click.prevent="ctx.to('vpc', 'vpcs')">{{ group.vpc }}</a></dd></div>
            <div><dt>Owner</dt><dd>{{ ctx.account.value }}</dd></div>
            <div><dt>Inbound rules count</dt><dd>{{ (group.ingress || []).length }} Permission entries</dd></div>
            <div><dt>Outbound rules count</dt><dd>{{ (group.egress || []).length || 1 }} Permission entry</dd></div>
          </dl>
        </div>
      </section>
      <div class="cs-tabs">
        <button v-for="t in ['Inbound rules', 'Outbound rules', 'Tags']" :key="t" type="button" class="cs-tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
      </div>
      <section v-if="tab !== 'Tags'" class="cs-container">
        <div class="cs-container__head">
          <CsHeader :title="`${tab} (${shown.length})`" :level="2">
            <template #actions>
              <button v-if="tab === 'Inbound rules'" type="button" class="cs-btn" @click="ctx.to(svc, 'sg-inbound', { id: group.id })">Edit inbound rules</button>
              <button v-else type="button" class="cs-btn" disabled>Edit outbound rules</button>
            </template>
          </CsHeader>
        </div>
        <div class="cs-container__body cs-scroll-x">
          <table class="cs-table-mini">
            <thead><tr><th>Name</th><th>Security group rule ID</th><th>IP version</th><th>Type</th><th>Protocol</th><th>Port range</th><th>{{ tab === 'Inbound rules' ? 'Source' : 'Destination' }}</th><th>Description</th></tr></thead>
            <tbody>
              <tr v-for="(rule, i) in shown" :key="i">
                <td>–</td><td class="cs-mono">sgr-{{ (Number(i) + 1).toString(16).padStart(17, '0') }}</td><td>IPv4</td>
                <td>{{ typeOf(rule) }}</td><td>{{ protocolLabel(rule.protocol) }}</td><td>{{ rule.port || 'All' }}</td>
                <td>{{ rule.cidr }}</td><td>–</td>
              </tr>
              <tr v-if="!shown.length"><td colspan="8" class="cs-empty"><strong>No security group rules found</strong>
                <button type="button" class="cs-btn" @click="ctx.to(svc, 'sg-inbound', { id: group.id })">Edit inbound rules</button></td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section v-else class="cs-container">
        <div class="cs-container__head"><CsHeader :title="`Tags (${Object.keys(group.tags || {}).length})`" :level="2">
          <template #actions><button type="button" class="cs-btn" @click="tagging = true">Manage tags</button></template></CsHeader></div>
        <div class="cs-container__body">
          <table v-if="Object.keys(group.tags || {}).length" class="cs-table-mini"><thead><tr><th>Key</th><th>Value</th></tr></thead>
            <tbody><tr v-for="(value, key) in group.tags" :key="key"><td>{{ key }}</td><td>{{ value || '–' }}</td></tr></tbody></table>
          <div v-else class="cs-empty"><strong>No tags</strong>No tags found for this resource.</div>
        </div>
      </section>
      <ManageTags v-if="tagging" :resource-id="group.id" :tags="group.tags || {}" @close="tagging = false" />
      <CsDelete v-if="deleting" title="Delete security groups" word="delete" :busy="busy" @close="deleting = false" @confirm="remove">
        <p class="sgd__p">Are you sure you want to delete <span class="cs-mono">{{ group.id }}</span> ({{ group.name }})?</p>
      </CsDelete>
    </template>
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>Security group not found</strong>The security group '{{ id }}' does not exist.
      <button type="button" class="cs-link" @click="ctx.to(svc, 'sgs')">View all security groups</button></div></div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import { useAws } from '../ctx';
import type { ServiceId } from '../nav';
import ManageTags from './Ec2ManageTags.vue';
import SgRuleEditor from './SgRuleEditor.vue';
import { protocolLabel, ruleOf, ruleProblem, sameRule, typeOf, type EditRule } from './sgRules';

const ctx = useAws();
const svc = computed<ServiceId>(() => (ctx.route.value.svc === 'vpc' ? 'vpc' : 'ec2'));
const id = computed(() => ctx.route.value.params?.id || '');
const editMode = computed(() => ctx.route.value.page === 'sg-inbound');
const group = computed(() => rows(ctx.view.value, 'ec2.security_groups').find(g => g.id === id.value) || null);
const tab = ref('Inbound rules');
const tagging = ref(false);
const deleting = ref(false);
const busy = ref(false);
const draft = ref<EditRule[]>([]);

const shown = computed(() => (tab.value === 'Inbound rules' ? group.value?.ingress || []
  : (group.value?.egress?.length ? group.value.egress : [{ protocol: 'all', port: '', cidr: '0.0.0.0/0' }])));

const actions = [
  { id: 'inbound', text: 'Edit inbound rules' }, { id: 'tags', text: 'Manage tags' },
  { id: 'delete', text: 'Delete security groups' },
];

function act(action: string) {
  if (action === 'inbound' && group.value) ctx.to(svc.value, 'sg-inbound', { id: group.value.id });
  if (action === 'tags') tagging.value = true;
  if (action === 'delete') deleting.value = true;
}

watch([editMode, group], () => {
  if (editMode.value && group.value && !draft.value.length) {
    draft.value = (group.value.ingress || []).map((r: any) => ({
      original: { protocol: r.protocol, port: String(r.port || ''), cidr: r.cidr },
      type: typeOf(r), port: String(r.port || ''), cidr: r.cidr,
      source: r.cidr === '0.0.0.0/0' ? 'Anywhere-IPv4' : 'Custom', description: '',
    }));
  }
}, { immediate: true });

async function saveRules() {
  if (!group.value) return;
  busy.value = true;
  const before = (group.value.ingress || []).map((r: any) => ({ protocol: r.protocol, port: String(r.port || ''), cidr: r.cidr }));
  const after = draft.value.map(ruleOf);
  let ok = true;
  for (const rule of before) {
    if (after.some(next => sameRule(next, rule))) continue;
    const result = await ctx.run(cli(['aws', 'ec2', 'revoke-security-group-ingress'], {
      '--group-id': group.value.id, '--protocol': rule.protocol, '--port': rule.port, '--cidr': rule.cidr,
    }));
    ok = ok && result.ok;
  }
  for (const rule of after) {
    if (before.some((old: any) => sameRule(old, rule))) continue;
    const result = await ctx.run(cli(['aws', 'ec2', 'authorize-security-group-ingress'], {
      '--group-id': group.value.id, '--protocol': rule.protocol, '--port': rule.port, '--cidr': rule.cidr,
    }));
    ok = ok && result.ok;
  }
  busy.value = false;
  if (ok) {
    ctx.api.notify('success', `Inbound security group rules successfully modified on security group (${group.value.id} | ${group.value.name})`);
    draft.value = [];
    ctx.to(svc.value, 'sg', { id: group.value.id });
  }
}
async function remove() {
  if (!group.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'delete-security-group'], { '--group-id': group.value.id }),
    `Successfully deleted security group ${group.value.id}`);
  busy.value = false;
  if (result.ok) { deleting.value = false; ctx.to(svc.value, 'sgs'); }
}
</script>

<style scoped>
.sgd__p { margin: 0; }
</style>
