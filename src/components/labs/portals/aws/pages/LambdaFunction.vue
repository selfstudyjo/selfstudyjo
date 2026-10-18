<template>
  <div v-if="fn">
    <CsHeader :title="fn.name">
      <template #actions>
        <button type="button" class="cs-btn" disabled>Throttle</button>
        <button type="button" class="cs-btn" @click="copyArn"><CsIcon name="copy" /> Copy ARN</button>
        <CsDropdown :items="[{ id: 'publish', text: 'Publish new version', disabled: true }, { id: 'alias', text: 'Create alias', disabled: true }, { id: 'delete', text: 'Delete function' }]" @select="id => id === 'delete' && (deleting = true)" />
      </template>
    </CsHeader>

    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Function overview" :level="2" /></div>
      <div class="cs-container__body lf__overview">
        <div class="lf__diagram">
          <div class="lf__fn"><ServiceIcon id="lambda" /><strong>{{ fn.name }}</strong><span class="cs-muted">Layers (0)</span></div>
          <div class="lf__adds">
            <button type="button" class="cs-btn" disabled><CsIcon name="add-plus" /> Add trigger</button>
            <button type="button" class="cs-btn" disabled><CsIcon name="add-plus" /> Add destination</button>
          </div>
        </div>
        <dl class="lf__meta">
          <dt>Description</dt><dd>{{ fn.description || '-' }}</dd>
          <dt>Last modified</dt><dd>{{ awsDate(fn.modified) }}</dd>
          <dt>Function ARN</dt><dd class="cs-mono">{{ fn.arn }}</dd>
          <dt>Function URL</dt><dd>-</dd>
        </dl>
      </div>
    </section>

    <div class="cs-tabs">
      <button v-for="t in tabs" :key="t.id" type="button" class="cs-tab" :class="{ 'is-active': tab === t.id }" :disabled="t.off" @click="tab = t.id">{{ t.text }}</button>
    </div>

    <template v-if="tab === 'code'">
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Code source" :level="2">
          <template #actions><button type="button" class="cs-btn" disabled>Upload from</button></template></CsHeader></div>
        <div class="cs-container__body lf__editor">
          <div class="lf__tree"><div class="lf__tree-h">EXPLORER</div><div class="lf__tree-f"><CsIcon name="folder" size="small" /> {{ fn.name }}</div>
            <div class="lf__tree-f lf__tree-file"><CsIcon name="file" size="small" /> {{ code.file }}</div></div>
          <div class="lf__code"><div class="lf__code-tab">{{ code.file }}</div>
            <pre class="lf__pre"><code><span v-for="(line, i) in code.code.split('\n')" :key="i" class="lf__line"><span class="lf__ln">{{ i + 1 }}</span>{{ line }}
</span></code></pre></div>
        </div>
        <div class="cs-container__foot cs-muted lf__ro">The code editor is read-only in this lab. Deploying code is not modelled; invoking the function runs the Hello World handler.</div>
      </section>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Runtime settings" :level="2">
          <template #actions><button v-if="!editRuntime" type="button" class="cs-btn" @click="startRuntime">Edit</button></template></CsHeader></div>
        <div class="cs-container__body">
          <div v-if="editRuntime" class="cs-stack">
            <div class="cs-field"><label class="cs-label" for="lf-rt">Runtime</label>
              <select id="lf-rt" v-model="rtDraft" class="cs-select"><option v-for="r in runtimes" :key="r" :value="r">{{ runtimeLabel(r) }}</option></select></div>
            <div class="cs-field"><label class="cs-label" for="lf-h">Handler</label>
              <input id="lf-h" v-model.trim="handlerDraft" class="cs-input" />
              <span class="cs-constraint">The handler format is file-name.method-name (Python, Node.js).</span></div>
            <div class="cs-form-actions"><button type="button" class="cs-btn cs-btn--link" @click="editRuntime = false">Cancel</button>
              <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !handlerDraft" @click="saveRuntime">Save</button></div>
          </div>
          <dl v-else class="cs-kv"><div><dt>Runtime</dt><dd>{{ runtimeLabel(fn.runtime) }}</dd></div>
            <div><dt>Handler</dt><dd class="cs-mono">{{ fn.handler }}</dd></div><div><dt>Architecture</dt><dd>x86_64</dd></div></dl>
        </div>
      </section>
    </template>

    <template v-else-if="tab === 'test'">
      <div v-if="testResult" class="lf__result" :class="testResult.ok ? 'is-ok' : 'is-bad'">
        <button type="button" class="lf__result-head" @click="resultOpen = !resultOpen">
          <CsIcon :name="resultOpen ? 'caret-down' : 'caret-right'" />
          <CsIcon :name="testResult.ok ? 'status-positive' : 'status-negative'" />
          <strong>Executing function: {{ testResult.ok ? 'succeeded' : 'failed' }}</strong>
          <span class="cs-link">({{ testResult.ok ? 'logs' : 'details' }})</span>
        </button>
        <div v-if="resultOpen" class="lf__result-body">
          <template v-if="testResult.ok">
            <div class="cs-kv__label">Details</div>
            <pre class="cs-code">{{ testResult.response }}</pre>
            <div class="cs-kv__label lf__gap">Summary</div>
            <dl class="cs-kv"><div><dt>Code SHA-256</dt><dd class="cs-mono">{{ sha }}</dd></div>
              <div><dt>Request ID</dt><dd class="cs-mono">{{ testResult.request }}</dd></div>
              <div><dt>Duration</dt><dd>{{ testResult.duration }} ms</dd></div>
              <div><dt>Billed duration</dt><dd>{{ testResult.duration }} ms</dd></div>
              <div><dt>Resources configured</dt><dd>{{ testResult.memory }} MB</dd></div></dl>
            <div class="cs-kv__label lf__gap">Log output</div>
            <pre class="cs-code">{{ testResult.log.join('\n') }}</pre>
          </template>
          <pre v-else class="cs-code">{{ testResult.error }}</pre>
        </div>
      </div>
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Test event" :level="2"
          description="To invoke your function without saving an event, configure the JSON event, then choose Test.">
          <template #actions>
            <button type="button" class="cs-btn" disabled>Save</button>
            <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !!eventError" @click="test"><span v-if="busy" class="cs-btn__spinner" />Test</button>
          </template></CsHeader></div>
        <div class="cs-container__body cs-stack">
          <div class="cs-field"><span class="cs-label">Test event action</span>
            <label class="cs-radio"><input type="radio" checked /> Create new event</label>
            <label class="cs-radio lf__off"><input type="radio" disabled /> Edit saved event</label></div>
          <div class="cs-field"><label class="cs-label" for="lf-ev">Event name</label>
            <input id="lf-ev" v-model="eventName" class="cs-input" placeholder="MyEventName" />
            <span class="cs-constraint">Maximum of 25 characters consisting of letters, numbers, dots, hyphens and underscores.</span></div>
          <div class="cs-field"><span class="cs-label">Template - <em>optional</em></span>
            <select class="cs-select" disabled><option>hello-world</option></select></div>
          <div class="cs-field lf__json"><span class="cs-label">Event JSON</span>
            <textarea v-model="event" class="cs-textarea cs-mono" :class="{ 'is-invalid': eventError }" spellcheck="false" aria-label="Event JSON" />
            <span v-if="eventError" class="cs-error-text">{{ eventError }}</span></div>
        </div>
      </section>
    </template>

    <section v-else-if="tab === 'monitor'" class="cs-container">
      <div class="cs-container__head"><CsHeader title="Metrics" :level="2">
        <template #actions><button type="button" class="cs-btn" @click="ctx.to('cloudwatch', 'group', { name: '/aws/lambda/' + fn.name })">View CloudWatch logs <CsIcon name="external" size="small" /></button></template></CsHeader></div>
      <div class="cs-container__body"><dl class="cs-kv"><div><dt>Invocations</dt><dd class="lf__big">{{ fn.invocations }}</dd></div>
        <div><dt>Error count and success rate (%)</dt><dd>{{ fn.invocations ? '100%' : '–' }}</dd></div></dl></div>
    </section>

    <div v-else-if="tab === 'configuration'" class="lf__config">
      <nav class="lf__side">
        <button v-for="s in configSections" :key="s" type="button" class="lf__side-item" :class="{ 'is-active': section === s }"
                :disabled="s !== 'General configuration' && s !== 'Environment variables' && s !== 'Permissions'" @click="section = s">{{ s }}</button>
      </nav>
      <div>
        <section v-if="section === 'General configuration'" class="cs-container">
          <div class="cs-container__head"><CsHeader title="General configuration" :level="2">
            <template #actions><button v-if="!editGeneral" type="button" class="cs-btn" @click="startGeneral">Edit</button></template></CsHeader></div>
          <div class="cs-container__body">
            <div v-if="editGeneral" class="cs-stack">
              <div class="cs-field"><label class="cs-label" for="lf-d">Description - <em>optional</em></label>
                <input id="lf-d" v-model="general.description" class="cs-input" /></div>
              <div class="cs-field"><label class="cs-label" for="lf-m">Memory</label>
                <div class="cs-desc">Your function is allocated CPU proportional to the memory configured.</div>
                <div class="cs-row"><input id="lf-m" v-model.number="general.memory" type="number" class="cs-input lf__num" :class="{ 'is-invalid': memoryProblem(general.memory) }" /> MB</div>
                <span class="cs-constraint">Set memory to between 128 MB and 10240 MB</span>
                <span v-if="memoryProblem(general.memory)" class="cs-error-text">{{ memoryProblem(general.memory) }}</span></div>
              <div class="cs-field"><span class="cs-label">Timeout</span>
                <div class="cs-row"><input v-model.number="general.min" type="number" min="0" max="15" class="cs-input lf__num" aria-label="Timeout minutes" /> min
                  <input v-model.number="general.sec" type="number" min="0" max="59" class="cs-input lf__num" aria-label="Timeout seconds" /> sec</div>
                <span v-if="timeoutProblem(general.min * 60 + general.sec)" class="cs-error-text">{{ timeoutProblem(general.min * 60 + general.sec) }}</span></div>
              <div class="cs-form-actions"><button type="button" class="cs-btn cs-btn--link" @click="editGeneral = false">Cancel</button>
                <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !!memoryProblem(general.memory) || !!timeoutProblem(general.min * 60 + general.sec)" @click="saveGeneral">Save</button></div>
            </div>
            <dl v-else class="cs-kv">
              <div><dt>Description</dt><dd>{{ fn.description || '-' }}</dd></div>
              <div><dt>Memory</dt><dd>{{ fn.memory }} MB</dd></div>
              <div><dt>Ephemeral storage</dt><dd>512 MB</dd></div>
              <div><dt>Timeout</dt><dd>{{ Math.floor(fn.timeout / 60) }} min {{ fn.timeout % 60 }} sec</dd></div>
              <div><dt>SnapStart</dt><dd>None</dd></div>
            </dl>
          </div>
        </section>
        <section v-else-if="section === 'Environment variables'" class="cs-container">
          <div class="cs-container__head"><CsHeader :title="`Environment variables (${envList.length})`" :level="2"
            description="The environment variables below are encrypted at rest with the default Lambda service key.">
            <template #actions><button v-if="!editEnv" type="button" class="cs-btn" @click="startEnv">Edit</button></template></CsHeader></div>
          <div class="cs-container__body">
            <div v-if="editEnv" class="cs-stack">
              <div v-for="(row, i) in envDraft" :key="i" class="lf__envrow">
                <input v-model="row.key" class="cs-input" placeholder="Key" :aria-label="'Key ' + (i + 1)" />
                <input v-model="row.value" class="cs-input" placeholder="Value" :aria-label="'Value ' + (i + 1)" />
                <button type="button" class="cs-btn" @click="envDraft.splice(i, 1)">Remove</button></div>
              <div><button type="button" class="cs-btn" @click="envDraft.push({ key: '', value: '' })">Add environment variable</button></div>
              <span v-if="envError" class="cs-error-text">{{ envError }}</span>
              <div class="cs-form-actions"><button type="button" class="cs-btn cs-btn--link" @click="editEnv = false">Cancel</button>
                <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !!envError" @click="saveEnv">Save</button></div>
            </div>
            <table v-else-if="envList.length" class="cs-table-mini"><thead><tr><th>Key</th><th>Value</th></tr></thead>
              <tbody><tr v-for="e in envList" :key="e.key"><td>{{ e.key }}</td><td>{{ e.value }}</td></tr></tbody></table>
            <div v-else class="cs-empty"><strong>No environment variables</strong>No environment variables associated with this function.</div>
          </div>
        </section>
        <section v-else class="cs-container">
          <div class="cs-container__head"><CsHeader title="Execution role" :level="2" /></div>
          <div class="cs-container__body"><dl class="cs-kv"><div><dt>Role name</dt><dd>
            <a href="#" class="cs-link" @click.prevent="ctx.to('iam', 'role', { name: roleName })">{{ roleName }}</a></dd></div>
            <div><dt>Role ARN</dt><dd class="cs-mono">{{ fn.role }}</dd></div></dl></div>
        </section>
      </div>
    </div>

    <CsDelete v-if="deleting" title="Delete function" word="confirm" :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="lf__p">Deleting a function permanently removes the function code. The related logs and roles are retained in your account.</p>
    </CsDelete>
  </div>
  <div v-else class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>Function not found</strong>Function not found: {{ name }}
      <button type="button" class="cs-link" @click="ctx.to('lambda', 'functions')">View functions</button></div></div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, errorText, pick, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import ServiceIcon from '../ServiceIcon.vue';
import { awsDate, useAws } from '../ctx';
import { HELLO_EVENT, codeFile, memoryProblem, runtimeLabel, timeoutProblem } from './lambdaKit';

const ctx = useAws();
const name = computed(() => ctx.route.value.params?.name || '');
const fn = computed(() => rows(ctx.view.value, 'lambda').find(f => f.name === name.value) || null);
const runtimes = computed(() => pick<string[]>(ctx.view.value, 'runtimes', []));
const code = computed(() => codeFile(fn.value?.runtime || 'python3.12'));
const roleName = computed(() => String(fn.value?.role || '').split('/').pop() || '');
const sha = computed(() => btoa(`${name.value}:${fn.value?.runtime}`).replace(/=/g, '').slice(0, 43) + '=');
const tabs = [
  { id: 'code', text: 'Code' }, { id: 'test', text: 'Test' }, { id: 'monitor', text: 'Monitor' },
  { id: 'configuration', text: 'Configuration' }, { id: 'aliases', text: 'Aliases', off: true }, { id: 'versions', text: 'Versions', off: true },
];
const tab = ref(ctx.route.value.params?.tab || 'code');
const busy = ref(false);
const deleting = ref(false);
const editRuntime = ref(false);
const rtDraft = ref('');
const handlerDraft = ref('');
const eventName = ref('');
const event = ref(HELLO_EVENT);
const testResult = ref<null | { ok: boolean; response?: string; request?: string; duration?: number; memory?: number; log: string[]; error?: string }>(null);
const resultOpen = ref(true);
const configSections = ['General configuration', 'Triggers', 'Permissions', 'Destinations', 'Function URL', 'Environment variables', 'Tags', 'VPC', 'Monitoring and operations tools', 'Concurrency and recursion detection'];
const section = ref('General configuration');
const editGeneral = ref(false);
const general = reactive({ description: '', memory: 128, min: 0, sec: 3 });
const editEnv = ref(false);
const envDraft = ref<{ key: string; value: string }[]>([]);

const eventError = computed(() => {
  try { JSON.parse(event.value); return ''; } catch { return 'There is an error in your JSON event. Correct it before saving or testing.'; }
});
const envList = computed(() => Object.entries(fn.value?.env || {}).map(([key, value]) => ({ key, value: String(value) })));
const envError = computed(() => {
  for (const row of envDraft.value) {
    if (!row.key && !row.value) continue;
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(row.key)) return `"${row.key}" is not a valid key: start with a letter, then letters, numbers or underscores.`;
    if (/[,={}]/.test(row.value)) return 'Values in this lab cannot contain , = { or }.';
  }
  return '';
});

async function copyArn() {
  try { await navigator.clipboard.writeText(fn.value?.arn || ''); } catch { /* ignored */ }
  ctx.api.notify('success', 'Function ARN copied', fn.value?.arn || '');
}
function startRuntime() {
  rtDraft.value = fn.value?.runtime || '';
  handlerDraft.value = fn.value?.handler || '';
  editRuntime.value = true;
}
async function saveRuntime() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'lambda', 'update-function-configuration'], {
    '--function-name': name.value, '--runtime': rtDraft.value, '--handler': handlerDraft.value,
  }), `Successfully updated the function ${name.value}.`);
  busy.value = false;
  if (result.ok) editRuntime.value = false;
}
async function test() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'lambda', 'invoke', 'response.json'], {
    '--function-name': name.value, '--cli-binary-format': 'raw-in-base64-out',
    '--payload': JSON.stringify(JSON.parse(event.value)),
  }), '', { quiet: true });
  busy.value = false;
  resultOpen.value = true;
  if (result.ok) {
    const data = (result.data || {}) as Record<string, any>;
    testResult.value = { ok: true, response: data.response || '{\n  "statusCode": 200\n}', request: data.request,
      duration: data.duration, memory: data.memory, log: data.log || [] };
  } else {
    testResult.value = { ok: false, error: errorText(result), log: [] };
  }
}
function startGeneral() {
  general.description = fn.value?.description || '';
  general.memory = Number(fn.value?.memory) || 128;
  general.min = Math.floor((Number(fn.value?.timeout) || 3) / 60);
  general.sec = (Number(fn.value?.timeout) || 3) % 60;
  editGeneral.value = true;
}
async function saveGeneral() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'lambda', 'update-function-configuration'], {
    '--function-name': name.value, '--memory-size': general.memory, '--timeout': general.min * 60 + general.sec,
    '--description': general.description.trim() !== (fn.value?.description || '') ? general.description.trim() : '',
  }), `Successfully updated the function ${name.value}.`);
  busy.value = false;
  if (result.ok) editGeneral.value = false;
}
function startEnv() {
  envDraft.value = envList.value.map(e => ({ ...e }));
  if (!envDraft.value.length) envDraft.value.push({ key: '', value: '' });
  editEnv.value = true;
}
async function saveEnv() {
  busy.value = true;
  const pairs = envDraft.value.filter(r => r.key).map(r => `${r.key}=${r.value}`).join(',');
  const result = await ctx.run(cli(['aws', 'lambda', 'update-function-configuration'], {
    '--function-name': name.value, '--environment': `Variables={${pairs}}`,
  }), `Successfully updated the function ${name.value}.`);
  busy.value = false;
  if (result.ok) editEnv.value = false;
}
async function remove() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'lambda', 'delete-function'], { '--function-name': name.value }),
    `Successfully deleted function ${name.value}.`);
  busy.value = false;
  if (result.ok) { deleting.value = false; ctx.to('lambda', 'functions'); }
}
</script>

<style scoped>
.lf__overview { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 360px); gap: 24px; }
.lf__diagram { display: flex; align-items: center; justify-content: center; gap: 24px; flex-wrap: wrap; background: #f8f8f8; border-radius: 8px; padding: 24px; }
.lf__fn { display: flex; flex-direction: column; align-items: center; gap: 6px; background: #fff; border: 1px solid #c6c6cd; border-radius: 8px; padding: 14px 24px; }
.lf__adds { display: flex; flex-direction: column; gap: 8px; }
.lf__meta { margin: 0; }
.lf__meta dt { font-weight: 700; color: #424650; margin-top: 8px; }
.lf__meta dt:first-child { margin-top: 0; }
.lf__meta dd { margin: 2px 0 0; word-break: break-all; }
.lf__editor { display: grid; grid-template-columns: 200px minmax(0, 1fr); padding: 0; background: #1e1e1e; color: #d4d4d4; border-radius: 0 0 0 0; min-height: 260px; }
.lf__tree { background: #252526; padding: 8px 0; font-size: 13px; }
.lf__tree-h { padding: 4px 12px; font-size: 11px; letter-spacing: .05em; color: #bbb; }
.lf__tree-f { padding: 3px 12px; display: flex; gap: 6px; align-items: center; }
.lf__tree-file { padding-left: 28px; background: #37373d; }
.lf__code { min-width: 0; }
.lf__code-tab { display: inline-block; padding: 6px 14px; background: #1e1e1e; border-top: 2px solid #ff9900; font-size: 13px; }
.lf__pre { margin: 0; padding: 8px 0; overflow: auto; font-family: Monaco, Menlo, Consolas, monospace; font-size: 13px; line-height: 19px; }
.lf__line { display: block; white-space: pre; }
.lf__ln { display: inline-block; width: 44px; padding-right: 14px; text-align: right; color: #858585; user-select: none; }
.lf__ro { font-size: 12px; }
.lf__result { border: 2px solid; border-radius: 12px; margin-bottom: 20px; }
.lf__result.is-ok { border-color: #00802f; background: #effff1; }
.lf__result.is-bad { border-color: #db0000; background: #fff5f5; }
.lf__result.is-ok .cs-icon { color: #00802f; }
.lf__result.is-bad .cs-icon { color: #db0000; }
.lf__result-head { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; background: none; font: inherit; padding: 10px 16px; cursor: pointer; text-align: left; }
.lf__result-body { padding: 0 16px 16px; }
.lf__gap { margin-top: 12px; }
.lf__json textarea { min-height: 200px; font-size: 13px; }
.lf__json { max-width: none; }
.lf__off { opacity: .55; }
.lf__big { font-size: 28px; line-height: 36px; font-weight: 700; }
.lf__config { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 20px; align-items: start; }
.lf__side { display: flex; flex-direction: column; border: 1px solid #c6c6cd; border-radius: 16px; padding: 8px 0; }
.lf__side-item { text-align: left; border: 0; background: none; padding: 6px 18px; font: inherit; color: #424650; cursor: pointer; }
.lf__side-item:disabled { cursor: default; color: #8c8c94; }
.lf__side-item.is-active { color: #006ce0; font-weight: 700; }
.lf__num { width: 110px; }
.lf__envrow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 10px; max-width: 760px; }
.lf__p { margin: 0; }
@container sl-portal (max-width: 900px) {
  .lf__overview, .lf__config, .lf__editor { grid-template-columns: minmax(0, 1fr); }
  .lf__tree { display: none; }
}
</style>
