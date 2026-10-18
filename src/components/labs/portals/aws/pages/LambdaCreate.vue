<template>
  <div>
    <CsHeader title="Create function" description="Choose one of the following options to create your function." />
    <div class="cs-tiles lc__tiles">
      <label class="cs-tile is-checked"><input type="radio" checked /><span><strong>Author from scratch</strong><small>Start with a simple Hello World example.</small></span></label>
      <label class="cs-tile lc__off"><input type="radio" disabled /><span><strong>Use a blueprint</strong><small>Build a Lambda application from sample code and configuration presets for common use cases.</small></span></label>
      <label class="cs-tile lc__off"><input type="radio" disabled /><span><strong>Container image</strong><small>Select a container image to deploy for your function.</small></span></label>
    </div>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Basic information" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="lc-name">Function name</label>
          <div class="cs-desc">Enter a name that describes the purpose of your function.</div>
          <input id="lc-name" v-model.trim="name" class="cs-input" :class="{ 'is-invalid': tried && nameError }" placeholder="myFunctionName" />
          <span v-if="tried && nameError" class="cs-error-text">{{ nameError }}</span>
          <span class="cs-constraint">Function name must be 1 to 64 characters, must be unique to the Region, and can't include spaces. Valid characters are a-z, A-Z, 0-9, hyphens (-), and underscores (_).</span></div>
        <div class="cs-field"><label class="cs-label" for="lc-rt">Runtime <a class="cs-link lc__info">Info</a></label>
          <div class="cs-desc">Choose the language to use to write your function. Note that the console code editor supports only Node.js, Python, and Ruby.</div>
          <select id="lc-rt" v-model="runtime" class="cs-select">
            <option v-for="r in runtimes" :key="r" :value="r">{{ runtimeLabel(r) }}</option></select></div>
        <div class="cs-field"><span class="cs-label">Architecture <a class="cs-link lc__info">Info</a></span>
          <label class="cs-radio"><input v-model="arch" type="radio" value="x86_64" /> x86_64</label>
          <label class="cs-radio"><input v-model="arch" type="radio" value="arm64" /> arm64</label></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Permissions" :level="2"
        description="By default, Lambda will create an execution role with permissions to upload logs to Amazon CloudWatch Logs. You can customize this default role later when adding triggers." /></div>
      <div class="cs-container__body cs-stack">
        <button type="button" class="lc__exp" @click="roleOpen = !roleOpen"><CsIcon :name="roleOpen ? 'caret-down' : 'caret-right'" /> <strong>Change default execution role</strong></button>
        <template v-if="roleOpen">
          <span class="cs-label">Execution role</span>
          <div class="cs-desc">Choose a role that defines the permissions of your function.</div>
          <label class="cs-radio"><input v-model="roleMode" type="radio" value="new" /> Create a new role with basic Lambda permissions</label>
          <label class="cs-radio"><input v-model="roleMode" type="radio" value="existing" /> Use an existing role</label>
          <label class="cs-radio lc__off"><input type="radio" disabled /> Create a new role from AWS policy templates</label>
          <div v-if="roleMode === 'existing'" class="cs-field"><label class="cs-label" for="lc-role">Existing role</label>
            <div class="cs-desc">Choose an existing role that you've created to be used with this Lambda function. The role must have permission to upload logs to Amazon CloudWatch Logs.</div>
            <select id="lc-role" v-model="roleArn" class="cs-select">
              <option value="" disabled>Choose an existing role</option>
              <option v-for="r in roles" :key="r.arn" :value="r.arn">{{ r.name }}</option></select>
            <span v-if="!roles.length" class="cs-error-text">There are no roles in this account. Create one in IAM, or let Lambda create one.</span></div>
          <div v-else class="cs-alert cs-alert--info"><CsIcon name="status-info" class="cs-alert__icon" />
            <div>Role creation might take a few minutes. Please do not delete the role or edit the trust or permissions policies in this role.
              <br />Lambda will create an execution role named <strong>{{ newRoleName }}</strong>, with permission to upload logs to Amazon CloudWatch Logs.</div></div>
        </template>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><button type="button" class="lc__exp" disabled><CsIcon name="caret-right" /> <strong>Additional configurations</strong></button></div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('lambda', 'functions')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create"><span v-if="busy" class="cs-btn__spinner" />Create function</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, parseJson, pick, rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import { trustPolicy } from '../commands';
import { useAws } from '../ctx';
import { defaultHandler, runtimeLabel } from './lambdaKit';

const ctx = useAws();
const runtimes = computed(() => pick<string[]>(ctx.view.value, 'runtimes', ['python3.12']));
const roles = computed(() => rows(ctx.view.value, 'iam.roles'));
const name = ref('');
const runtime = ref('python3.12');
const arch = ref('x86_64');
const roleOpen = ref(false);
const roleMode = ref<'new' | 'existing'>('new');
const roleArn = ref('');
const tried = ref(false);
const busy = ref(false);
const suffix = Math.random().toString(36).slice(2, 10);
const newRoleName = computed(() => `${name.value || 'myFunctionName'}-role-${suffix}`);

const nameError = computed(() => {
  if (!name.value) return 'Function name is required.';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(name.value)) return 'Function name must be 1 to 64 characters: a-z, A-Z, 0-9, hyphens (-), and underscores (_).';
  if (rows(ctx.view.value, 'lambda').some(f => f.name === name.value)) return `Function name ${name.value} already exists.`;
  return '';
});

async function create() {
  tried.value = true;
  if (nameError.value || (roleMode.value === 'existing' && !roleArn.value)) {
    if (roleMode.value === 'existing' && !roleArn.value) roleOpen.value = true;
    return;
  }
  busy.value = true;
  let role = roleArn.value;
  if (roleMode.value === 'new') {
    const made = await ctx.run(cli(['aws', 'iam', 'create-role'], {
      '--role-name': newRoleName.value,
      '--assume-role-policy-document': JSON.stringify(JSON.parse(trustPolicy({ Service: 'lambda.amazonaws.com' }))),
    }));
    if (!made.ok) { busy.value = false; return; }
    role = parseJson<{ Role: { Arn: string } }>(made.output)?.Role?.Arn || '';
    await ctx.run(cli(['aws', 'iam', 'attach-role-policy'], {
      '--role-name': newRoleName.value,
      '--policy-arn': 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    }));
  }
  const result = await ctx.run(cli(['aws', 'lambda', 'create-function'], {
    '--function-name': name.value, '--runtime': runtime.value, '--role': role,
    '--handler': defaultHandler(runtime.value), '--architectures': arch.value,
    '--zip-file': 'fileb://function.zip',
  }));
  busy.value = false;
  if (result.ok) {
    ctx.api.notify('success', `Successfully created the function ${name.value}. You can now change its code and configuration. To invoke your function with a test event, choose "Test".`);
    ctx.to('lambda', 'function', { name: name.value });
  }
}
</script>

<style scoped>
.lc__tiles { margin-bottom: 20px; }
.lc__off { opacity: .55; cursor: default; }
.lc__info { font-size: 12px; font-weight: 700; margin-left: 4px; }
.lc__exp, .lc__exp:disabled { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; font: inherit; font-size: 16px; color: #0f141a; padding: 0; cursor: default; text-align: left; }
</style>
