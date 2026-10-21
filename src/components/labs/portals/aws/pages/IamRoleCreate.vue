<template>
  <div class="cs-wizard">
    <ol class="cs-steps">
      <li v-for="(label, i) in steps" :key="label" :class="{ 'is-current': step === i, 'is-done': step > i }">Step {{ i + 1 }}<strong>{{ label }}</strong></li>
    </ol>
    <div>
      <template v-if="step === 0">
        <CsHeader title="Select trusted entity" />
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Trusted entity type" :level="2" /></div>
          <div class="cs-container__body">
            <div class="cs-tiles">
              <label v-for="t in entityTypes" :key="t.id" class="cs-tile" :class="{ 'is-checked': entity === t.id }">
                <input v-model="entity" type="radio" :value="t.id" />
                <span><strong>{{ t.title }}</strong><small>{{ t.text }}</small></span></label>
            </div>
          </div>
        </section>
        <section v-if="entity === 'service'" class="cs-container">
          <div class="cs-container__head"><CsHeader title="Use case" :level="2" :info="false"
            description="Allow an AWS service like EC2, Lambda, or others to perform actions in this account." /></div>
          <div class="cs-container__body cs-stack">
            <div class="cs-field"><label class="cs-label" for="rc-svc">Service or use case</label>
              <select id="rc-svc" v-model="service" class="cs-select">
                <option v-for="s in services" :key="s.principal" :value="s.principal">{{ s.name }}</option></select></div>
            <label class="cs-radio"><input type="radio" checked /> <span>{{ serviceName }}<small>Allows {{ serviceName }} to call AWS services on your behalf.</small></span></label>
          </div>
        </section>
        <section v-else-if="entity === 'account'" class="cs-container">
          <div class="cs-container__head"><CsHeader title="An AWS account" :level="2" :info="false" /></div>
          <div class="cs-container__body cs-stack">
            <label class="cs-radio"><input v-model="accountMode" type="radio" value="this" /> This account ({{ ctx.account.value }})</label>
            <label class="cs-radio"><input v-model="accountMode" type="radio" value="other" /> Another AWS account</label>
            <div v-if="accountMode === 'other'" class="cs-field"><label class="cs-label" for="rc-acct">Account ID</label>
              <input id="rc-acct" v-model.trim="otherAccount" class="cs-input" :class="{ 'is-invalid': otherAccount && !/^\d{12}$/.test(otherAccount) }" placeholder="123456789012" />
              <span class="cs-constraint">Identifier of the account that can use this role. Account ID is limited to 12 digits.</span></div>
          </div>
        </section>
        <section v-else class="cs-container">
          <div class="cs-container__head"><CsHeader title="Custom trust policy" :level="2" :info="false" description="Create a custom trust policy to enable others to perform actions in this account." /></div>
          <div class="cs-container__body cs-stack">
            <textarea v-model="customPolicy" class="cs-textarea cs-mono rc__policy" :class="{ 'is-invalid': customError }" spellcheck="false" aria-label="Custom trust policy" />
            <span v-if="customError" class="cs-error-text">{{ customError }}</span>
          </div>
        </section>
      </template>

      <template v-else-if="step === 1">
        <CsHeader title="Add permissions" />
        <PolicyPicker v-model="policies" />
        <section class="cs-container">
          <div class="cs-container__head"><button type="button" class="rc__adv" disabled><CsIcon name="caret-right" /> <strong>Set permissions boundary - <em>optional</em></strong></button></div>
        </section>
      </template>

      <template v-else>
        <CsHeader title="Name, review, and create" />
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Role details" :level="2" :info="false" /></div>
          <div class="cs-container__body cs-stack">
            <div class="cs-field"><label class="cs-label" for="rc-name">Role name</label>
              <div class="cs-desc">Enter a meaningful name to identify this role.</div>
              <input id="rc-name" v-model.trim="name" class="cs-input" :class="{ 'is-invalid': tried && nameError }" />
              <span v-if="tried && nameError" class="cs-error-text">{{ nameError }}</span>
              <span class="cs-constraint">Maximum 64 characters. Use alphanumeric and '+=,.@-_' characters.</span></div>
            <div class="cs-field"><label class="cs-label" for="rc-desc">Description</label>
              <div class="cs-desc">Add a short explanation for this role.</div>
              <textarea id="rc-desc" v-model="description" class="cs-textarea rc__desc" />
              <span class="cs-constraint">Maximum 1000 characters. Use letters (A-Z and a-z), numbers (0-9), tabs, new lines, or any of the following characters: _+=,.@-/\[]!#$%^&amp;*;"'&lt;&gt;?|~</span></div>
          </div>
        </section>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Step 1: Select trusted entities" :level="2" :info="false" /></div>
          <div class="cs-container__body"><span class="cs-label">Trust policy</span><pre class="cs-code">{{ trust }}</pre></div>
        </section>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Step 2: Add permissions" :level="2" :info="false" /></div>
          <div class="cs-container__body">
            <table class="cs-table-mini"><thead><tr><th>Policy name</th><th>Type</th><th>Attached as</th></tr></thead>
              <tbody><tr v-for="arn in policies" :key="arn"><td>{{ arn.split('/').pop() }}</td><td>AWS managed</td><td>Permissions policy</td></tr>
                <tr v-if="!policies.length"><td colspan="3" class="cs-muted">No policies selected</td></tr></tbody></table>
          </div>
        </section>
        <section class="cs-container">
          <div class="cs-container__head"><CsHeader title="Step 3: Add tags - optional" :level="2" :info="false" /></div>
          <div class="cs-container__body"><TagEditor v-model="tags" /></div>
        </section>
      </template>

      <div class="cs-form-actions">
        <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('iam', 'roles')">Cancel</button>
        <button v-if="step > 0" type="button" class="cs-btn" @click="step--">Previous</button>
        <button v-if="step < 2" type="button" class="cs-btn cs-btn--primary" :disabled="step === 0 && !!customError && entity === 'custom'" @click="step++">Next</button>
        <button v-else type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create">Create role</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import TagEditor, { type Tag } from '../TagEditor.vue';
import { tagProblem, tagWords, trustPolicy } from '../commands';
import { useAws } from '../ctx';
import PolicyPicker from './PolicyPicker.vue';

const ctx = useAws();
const steps = ['Select trusted entity', 'Add permissions', 'Name, review, and create'];
const step = ref(0);
const entity = ref('service');
const service = ref('lambda.amazonaws.com');
const accountMode = ref('this');
const otherAccount = ref('');
const customPolicy = ref(trustPolicy({ AWS: `arn:aws:iam::${ctx.account.value}:root` }));
const policies = ref<string[]>([]);
const name = ref('');
const description = ref('');
const tags = ref<Tag[]>([]);
const tried = ref(false);
const busy = ref(false);

const entityTypes = [
  { id: 'service', title: 'AWS service', text: 'Allow AWS services like EC2, Lambda, or others to perform actions in this account.' },
  { id: 'account', title: 'AWS account', text: 'Allow entities in other AWS accounts belonging to you or a 3rd party to perform actions in this account.' },
  { id: 'custom', title: 'Custom trust policy', text: 'Create a custom trust policy to enable others to perform actions in this account.' },
];
const services = [
  { name: 'Lambda', principal: 'lambda.amazonaws.com' },
  { name: 'EC2', principal: 'ec2.amazonaws.com' },
  { name: 'ECS Task', principal: 'ecs-tasks.amazonaws.com' },
  { name: 'API Gateway', principal: 'apigateway.amazonaws.com' },
  { name: 'Step Functions', principal: 'states.amazonaws.com' },
  { name: 'Glue', principal: 'glue.amazonaws.com' },
];
const serviceName = computed(() => services.find(s => s.principal === service.value)?.name || service.value);

const customError = computed(() => {
  try {
    const parsed = JSON.parse(customPolicy.value);
    return parsed && parsed.Statement ? '' : 'The policy must contain a Statement.';
  } catch {
    return 'This policy contains invalid JSON.';
  }
});
const trust = computed(() => {
  if (entity.value === 'service') return trustPolicy({ Service: service.value });
  if (entity.value === 'account') {
    const account = accountMode.value === 'other' && /^\d{12}$/.test(otherAccount.value) ? otherAccount.value : ctx.account.value;
    return trustPolicy({ AWS: `arn:aws:iam::${account}:root` });
  }
  return customPolicy.value;
});
const nameError = computed(() => {
  if (!name.value) return 'Role name is required.';
  if (name.value.length > 64) return 'Maximum 64 characters.';
  if (!/^[\w+=,.@-]+$/.test(name.value)) return "Use alphanumeric and '+=,.@-_' characters.";
  if (rows(ctx.view.value, 'iam.roles').some(r => String(r.name).toLowerCase() === name.value.toLowerCase())) {
    return `Role name ${name.value} already exists.`;
  }
  return '';
});

async function create() {
  tried.value = true;
  if (nameError.value || tags.value.some(t => tagProblem(t))) return;
  busy.value = true;
  const compact = JSON.stringify(JSON.parse(trust.value));
  const made = await ctx.run(cli(['aws', 'iam', 'create-role'], {
    '--role-name': name.value, '--assume-role-policy-document': compact,
    '--description': description.value.trim(), '--tags': tagWords(tags.value),
  }));
  if (!made.ok) { busy.value = false; return; }
  for (const arn of policies.value) {
    await ctx.run(cli(['aws', 'iam', 'attach-role-policy'], { '--role-name': name.value, '--policy-arn': arn }));
  }
  // The console makes an instance profile of the same name for a role EC2 can assume,
  // which is what "Modify IAM role" and the launch wizard then list.
  if (entity.value === 'service' && service.value === 'ec2.amazonaws.com') {
    const profile = await ctx.run(cli(['aws', 'iam', 'create-instance-profile'], { '--instance-profile-name': name.value }));
    if (profile.ok) {
      await ctx.run(cli(['aws', 'iam', 'add-role-to-instance-profile'], {
        '--instance-profile-name': name.value, '--role-name': name.value,
      }));
    }
  }
  busy.value = false;
  ctx.api.notify('success', `Role ${name.value} created.`);
  ctx.to('iam', 'roles');
}
</script>

<style scoped>
.rc__policy { min-height: 240px; font-size: 13px; }
.rc__desc { min-height: 64px; }
.rc__adv { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; font: inherit; font-size: 16px; color: #0f141a; padding: 0; text-align: left; }
.rc__adv:disabled { color: #0f141a; }
</style>
