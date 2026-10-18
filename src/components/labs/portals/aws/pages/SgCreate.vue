<template>
  <div>
    <CsHeader title="Create security group"
              description="A security group acts as a virtual firewall for your instance to control inbound and outbound traffic. To create a new security group, complete the fields below." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Basic details" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field">
          <label class="cs-label" for="sgc-name">Security group name <a class="cs-link sgc__info">Info</a></label>
          <input id="sgc-name" v-model="name" class="cs-input" :class="{ 'is-invalid': tried && nameError }" placeholder="MyWebServerGroup" />
          <span v-if="tried && nameError" class="cs-error-text">{{ nameError }}</span>
          <span class="cs-constraint">Name cannot be edited after creation.</span>
        </div>
        <div class="cs-field">
          <label class="cs-label" for="sgc-desc">Description <a class="cs-link sgc__info">Info</a></label>
          <input id="sgc-desc" v-model="description" class="cs-input" :class="{ 'is-invalid': tried && !description.trim() }" placeholder="Allows SSH access to developers" />
          <span v-if="tried && !description.trim()" class="cs-error-text">Description is required.</span>
        </div>
        <div class="cs-field">
          <label class="cs-label" for="sgc-vpc">VPC <a class="cs-link sgc__info">Info</a></label>
          <select id="sgc-vpc" v-model="vpc" class="cs-select">
            <option v-for="v in vpcs" :key="v.id" :value="v.id">{{ v.id }}{{ v.default ? ' (default)' : v.name ? ` (${v.name})` : '' }}</option>
          </select>
        </div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader :title="`Inbound rules`" :level="2" /></div>
      <div class="cs-container__body"><SgRuleEditor v-model="rules" /></div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Outbound rules" :level="2" /></div>
      <div class="cs-container__body cs-scroll-x">
        <table class="cs-table-mini"><thead><tr><th>Type</th><th>Protocol</th><th>Port range</th><th>Destination</th><th>Description - optional</th></tr></thead>
          <tbody><tr><td>All traffic</td><td>All</td><td>All</td><td>Custom 0.0.0.0/0</td><td>–</td></tr></tbody></table>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Tags - optional" :level="2"
        description="A tag is a label that you assign to an AWS resource. Each tag consists of a key and an optional value. You can use tags to search and filter your resources or track your AWS costs." /></div>
      <div class="cs-container__body"><TagEditor v-model="tags" /></div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to(svc, 'sgs')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create">
        <span v-if="busy" class="cs-btn__spinner" />Create security group</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, parseJson, rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import TagEditor, { type Tag } from '../TagEditor.vue';
import { tagProblem, tagSpec } from '../commands';
import { useAws } from '../ctx';
import type { ServiceId } from '../nav';
import SgRuleEditor from './SgRuleEditor.vue';
import { ruleOf, ruleProblem, type EditRule } from './sgRules';

const ctx = useAws();
const svc = computed<ServiceId>(() => (ctx.route.value.svc === 'vpc' ? 'vpc' : 'ec2'));
const vpcs = computed(() => rows(ctx.view.value, 'ec2.vpcs'));
const name = ref('');
const description = ref('');
const vpc = ref(vpcs.value.find(v => v.default)?.id || vpcs.value[0]?.id || '');
const rules = ref<EditRule[]>([]);
const tags = ref<Tag[]>([]);
const tried = ref(false);
const busy = ref(false);

const nameError = computed(() => {
  const value = name.value.trim();
  if (!value) return 'Security group name is required.';
  if (value.length > 255) return 'Name must be 255 characters or fewer.';
  if (/^sg-/i.test(value)) return 'Names cannot start with sg-.';
  if (!/^[A-Za-z0-9 ._\-:/()#,@[\]+=&;{}!$*]+$/.test(value)) return 'Valid characters are a-z, A-Z, 0-9, spaces, and ._-:/()#,@[]+=&;{}!$*';
  return '';
});

async function create() {
  tried.value = true;
  if (nameError.value || !description.value.trim() || rules.value.some(r => ruleProblem(r))
      || tags.value.some(t => tagProblem(t))) return;
  busy.value = true;
  const made = await ctx.run(cli(['aws', 'ec2', 'create-security-group'], {
    '--group-name': name.value.trim(), '--description': description.value.trim(), '--vpc-id': vpc.value,
    '--tag-specifications': tagSpec('security-group', tags.value),
  }));
  if (!made.ok) { busy.value = false; return; }
  const groupId = parseJson<{ GroupId: string }>(made.output)?.GroupId || '';
  for (const row of rules.value) {
    const rule = ruleOf(row);
    await ctx.run(cli(['aws', 'ec2', 'authorize-security-group-ingress'], {
      '--group-id': groupId, '--protocol': rule.protocol, '--port': rule.port, '--cidr': rule.cidr,
    }));
  }
  busy.value = false;
  ctx.api.notify('success', `Security group (${groupId} | ${name.value.trim()}) was created successfully`);
  ctx.to(svc.value, 'sg', { id: groupId });
}
</script>

<style scoped>
.sgc__info { font-size: 12px; font-weight: 700; margin-left: 4px; }
</style>
