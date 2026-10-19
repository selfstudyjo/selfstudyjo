<template>
  <div class="cc-page">
    <nav class="cc-crumbs"><button type="button" @click="cc.go({ page: 'home' })">Home</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'overview' })">{{ CLUSTER_NAME }}</button><span class="cc-sep">/</span>
      <button type="button" @click="cc.go({ page: 'connect' })">Connect</button><span class="cc-sep">/</span><span>{{ name }}</span></nav>

    <template v-if="conn">
      <div class="cc-title-row">
        <h1 class="cc-title">{{ conn.name }}</h1>
        <span class="cc-status" :class="statusClass">{{ statusText }}</span>
        <span class="cc-spacer"></span>
        <button v-if="conn.state === 'PAUSED'" type="button" class="cc-btn" :disabled="cc.busy.value" @click="act('resume')"><CcIcon name="play" />Resume</button>
        <button v-else type="button" class="cc-btn" :disabled="cc.busy.value" @click="act('pause')"><CcIcon name="pause" />Pause</button>
        <button type="button" class="cc-btn" :disabled="cc.busy.value" @click="act('restart')"><CcIcon name="refresh" />Restart</button>
        <button type="button" class="cc-btn cc-btn--danger-text" @click="remove"><CcIcon name="trash" />Delete</button>
      </div>
      <nav class="cc-tabs" aria-label="Connector">
        <button type="button" :class="{ 'is-active': tab === 'overview' }" @click="setTab('overview')">Overview</button>
        <button type="button" :class="{ 'is-active': tab === 'settings' }" @click="setTab('settings')">Settings</button>
      </nav>

      <template v-if="tab === 'overview'">
        <div class="cc-tiles">
          <div class="cc-tile"><span class="cc-tile__label">Category</span><span class="cc-tile__value cn-small">{{ conn.type === 'sink' ? 'Sink' : 'Source' }}</span></div>
          <div class="cc-tile"><span class="cc-tile__label">Records</span><span class="cc-tile__value">{{ num(conn.records) }}</span></div>
          <div class="cc-tile"><span class="cc-tile__label">Errors</span><span class="cc-tile__value" :class="{ 'cc-tile__value--bad': conn.errors }">{{ num(conn.errors) }}</span>
            <span class="cc-tile__sub">{{ num(conn.dlq_records) }} sent to the dead letter queue</span></div>
          <div class="cc-tile"><span class="cc-tile__label">Tasks</span><span class="cc-tile__value">{{ runningTasks }} / {{ conn.tasks.length }}</span><span class="cc-tile__sub">running</span></div>
        </div>
        <dl class="cc-kv cc-card cc-card__body">
          <dt>Connector class</dt><dd class="cc-mono">{{ conn.class }}</dd>
          <dt>Worker</dt><dd class="cc-mono">connect.shopflow.internal:8083</dd>
          <dt>Topics</dt><dd class="cc-mono">{{ (conn.topics || []).join(', ') || '-' }}</dd>
        </dl>
        <h2 class="cc-h2">Tasks</h2>
        <div class="cc-table-wrap">
          <table class="cc-table">
            <thead><tr><th class="is-num">Task ID</th><th>Status</th><th>Worker ID</th><th>Trace</th><th></th></tr></thead>
            <tbody>
              <template v-for="t in conn.tasks" :key="t.id">
                <tr>
                  <td class="is-num">{{ t.id }}</td>
                  <td><span class="cc-status" :class="t.state === 'RUNNING' ? 'cc-status--ok' : t.state === 'FAILED' ? 'cc-status--bad' : 'cc-status--off'">{{ t.state }}</span></td>
                  <td class="cc-mono">connect.shopflow.internal:8083</td>
                  <td class="cn-trace">{{ t.trace ? t.trace.split('\n')[0] : '-' }}</td>
                  <td class="cn-actions">
                    <button v-if="t.trace" type="button" class="cc-btn cc-btn--ghost cc-btn--sm" @click="toggle(t.id)">{{ open.has(t.id) ? 'Hide trace' : 'View trace' }}</button>
                    <button v-if="t.state === 'FAILED'" type="button" class="cc-btn cc-btn--sm" :disabled="cc.busy.value" @click="restartFailed">Restart task</button>
                  </td>
                </tr>
                <tr v-if="t.trace && open.has(t.id)" class="cn-trace-row"><td colspan="5"><pre class="cc-code">{{ t.trace }}</pre></td></tr>
              </template>
            </tbody>
          </table>
        </div>
      </template>

      <div v-else class="cc-card">
        <div class="cc-card__head"><strong>Connector configuration</strong><span class="cc-spacer"></span>
          <template v-if="!editing"><button type="button" class="cc-btn cc-btn--primary cc-btn--sm" @click="startEdit"><CcIcon name="edit" />Edit</button></template>
          <template v-else>
            <button type="button" class="cc-btn cc-btn--sm" @click="editing = false">Cancel</button>
            <button type="button" class="cc-btn cc-btn--primary cc-btn--sm" :disabled="cc.busy.value" @click="saveConfig">Save changes</button>
          </template>
        </div>
        <div class="cc-card__body cn-settings">
          <template v-if="editing">
            <textarea v-model="draft" class="cc-textarea" rows="16" spellcheck="false" aria-label="Connector configuration JSON"></textarea>
            <span class="cc-hint">The configuration object (without "name"). Saving re-creates the connector's tasks with it.</span>
          </template>
          <div v-else class="cc-table-wrap">
            <table class="cc-table">
              <thead><tr><th>Property</th><th>Value</th></tr></thead>
              <tbody><tr v-for="(v, k) in shownConfig" :key="k"><td class="cc-mono">{{ k }}</td><td class="cc-mono cn-val">{{ v }}</td></tr></tbody>
            </table>
          </div>
          <div v-if="error" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ error }}</span></div>
        </div>
      </div>
    </template>
    <div v-else class="cc-card cc-empty">Connector <strong>{{ name }}</strong> does not exist.
      <div><button type="button" class="cc-btn cc-btn--ghost" @click="cc.go({ page: 'connect' })">Back to connectors</button></div></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, errorText } from '@/utils/portalKit';
import CcIcon from './CcIcon.vue';
import { useCc } from './ccContext';
import { CLUSTER_NAME, connectCurl, num, restError } from './confluent';

const cc = useCc();
const name = computed(() => (cc.route.value.page === 'connector' ? cc.route.value.name : ''));
const tab = computed(() => (cc.route.value.page === 'connector' ? cc.route.value.tab : 'overview'));
const conn = computed(() => cc.connectors.value.find(c => c.name === name.value));
const runningTasks = computed(() => (conn.value?.tasks || []).filter(t => t.state === 'RUNNING').length);
const statusText = computed(() => {
  const c = conn.value;
  if (!c) return '';
  if (c.state === 'RUNNING' && c.tasks.some(t => t.state === 'FAILED')) return 'Degraded';
  return c.state.charAt(0) + c.state.slice(1).toLowerCase();
});
const statusClass = computed(() => ({ Running: 'cc-status--ok', Paused: 'cc-status--off', Degraded: 'cc-status--warn' } as Record<string, string>)[statusText.value] || 'cc-status--bad');
const SECRET = /password|private\.key|secret/i;
const shownConfig = computed(() => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(conn.value?.config || {})) out[k] = SECRET.test(k) && v ? '********' : String(v);
  return out;
});

function setTab(next: 'overview' | 'settings') { cc.go({ page: 'connector', name: name.value, tab: next }); }

const open = ref(new Set<number>());
function toggle(id: number) {
  const next = new Set(open.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  open.value = next;
}

async function act(verb: 'pause' | 'resume' | 'restart') {
  const words = verb === 'restart' ? ['connect', 'restart', name.value, '--include-tasks'] : ['connect', verb, name.value];
  const label = verb === 'pause' ? 'paused' : verb === 'resume' ? 'resumed' : 'restarted';
  await cc.run(cli(words), { success: `Connector ${name.value} ${label}` });
}
async function restartFailed() {
  await cc.run(cli(['connect', 'restart', name.value, '--include-tasks', '--only-failed']), { success: `Failed tasks of ${name.value} restarted` });
}

async function remove() {
  const ok = await cc.confirm({
    title: 'Delete connector',
    message: `Connector ${name.value} and its tasks will be stopped and deleted. Records already written are not removed.`,
    yes: 'Delete', danger: true, typeToConfirm: name.value,
  });
  if (!ok) return;
  const gone = name.value;
  const result = await cc.run(cli(['connect', 'delete', gone]), { success: `Connector ${gone} deleted` });
  if (result.ok) cc.go({ page: 'connect' });
}

const editing = ref(false);
const draft = ref('');
const error = ref('');
function startEdit() {
  draft.value = JSON.stringify(conn.value?.config || {}, null, 2);
  error.value = '';
  editing.value = true;
}
async function saveConfig() {
  error.value = '';
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(draft.value);
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('expected a JSON object');
  } catch (problem: any) {
    error.value = 'The configuration is not valid JSON: ' + String(problem?.message || problem);
    return;
  }
  const result = await cc.run(connectCurl('PUT', `/connectors/${encodeURIComponent(name.value)}/config`, config), { quiet: true });
  const rest = result.ok ? restError(result.output) : errorText(result);
  if (rest) { error.value = rest; return; }
  cc.notify('success', `Connector ${name.value} updated`);
  editing.value = false;
}
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.cn-small { font-size: 20px; font-weight: 400; }
.cn-trace { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--cc-danger-text); font-family: var(--cc-mono); font-size: 12px; }
.cn-actions { white-space: nowrap; text-align: right; }
.cn-trace-row td { background: var(--cc-code-bg); }
.cn-settings { display: flex; flex-direction: column; gap: 10px; }
.cn-val { overflow-wrap: anywhere; }
</style>
