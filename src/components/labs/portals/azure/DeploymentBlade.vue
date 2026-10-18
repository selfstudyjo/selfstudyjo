<template>
  <div class="az-blade">
    <div class="az-blade__head">
      <AzIcon name="deploy" :size="32" />
      <div class="az-blade__titles"><h1 class="az-blade__title">{{ route.name }} <small>| Overview</small></h1>
        <div class="az-blade__sub">Deployment</div></div>
    </div>
    <div class="az-cmdbar">
      <button type="button" class="az-cmd" disabled><AzIcon name="trash" /> Delete</button>
      <button type="button" class="az-cmd" disabled><AzIcon name="close" /> Cancel</button>
      <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
    </div>

    <div class="az-dep__hero" :class="'is-' + job.status">
      <AzIcon :name="job.status === 'running' ? 'spinner' : job.status === 'ok' ? 'ok' : 'error'" :size="32"
              :class="{ 'az-spin': job.status === 'running' }" />
      <div>
        <h2 class="az-dep__title">{{ job.status === 'running' ? 'Deployment is in progress' : job.status === 'ok' ? 'Your deployment is complete' : 'Your deployment failed' }}</h2>
        <div class="az-dep__meta">
          <span>Deployment name : <b>{{ route.name }}</b></span>
          <span>Subscription : <b>{{ az.p.value.account?.subscription_name }}</b></span>
          <span>Resource group : <button type="button" class="az-link" @click="az.go({ page: 'group', name: route.group })">{{ route.group }}</button></span>
          <span>Start time : <b>{{ start }}</b></span>
          <span>Correlation ID : <b class="az-mono">{{ correlation }}</b></span>
        </div>
      </div>
    </div>

    <div v-if="job.status === 'fail'" class="az-banner is-error"><AzIcon name="error" />
      <span><b>Deployment failed.</b> {{ job.error }}</span></div>

    <details class="az-dep__details" open>
      <summary><b>Deployment details</b></summary>
      <AzTable :columns="cols" :rows="job.steps" row-key="i">
        <template #cell-status="{ row }"><span class="az-status">
          <AzIcon :name="row.status === 'OK' ? 'ok' : row.status === 'Failed' ? 'error' : row.status === 'Running' ? 'spinner' : 'stopped'" :size="14" />
          {{ row.status }}</span></template>
        <template #cell-command="{ row }"><span class="az-mono">{{ row.command }}</span></template>
      </AzTable>
    </details>

    <template v-if="job.status === 'ok'">
      <h3 class="az-section-title">Next steps</h3>
      <div style="display: flex; gap: 8px; flex-wrap: wrap">
        <button type="button" class="az-btn az-btn--primary" @click="goToResource">{{ kind === 'group' ? 'Go to resource group' : 'Go to resource' }}</button>
        <button type="button" class="az-btn" @click="az.go({ page: 'create', kind, group: route.group })">Create another</button>
      </div>
    </template>
    <template v-else-if="job.status === 'fail'">
      <div style="display: flex; gap: 8px; margin-top: 12px">
        <button type="button" class="az-btn az-btn--primary" @click="az.back()">Redeploy</button>
        <button type="button" class="az-btn" @click="az.go({ page: 'group', name: route.group })">Go to resource group</button>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
/** Deployments already run in this tab, by token, so a remount does not re-run one. */
interface DepStep { i: number; command: string; status: string; message: string }
interface DepJob { status: 'running' | 'ok' | 'fail'; steps: DepStep[]; error: string; started: number }
const JOBS = new Map<string, DepJob>();
</script>

<script setup lang="ts">
/**
 * "Deployment is in progress" → "Your deployment is complete": runs the
 * wizard's commands one after another, as ARM would run the template's
 * resources, and stops at the first failure with the engine's own message.
 */
import { computed, reactive } from 'vue';
import { errorText, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzTable from './AzTable.vue';
import { allResources, useAz } from './azure';

const az = useAz();
const route = computed(() => az.route.value);
const kind = computed(() => String(route.value.kind || ''));
const extra = route.value.extra || {};
const token = String(extra.token || route.value.name || '');
const commands: string[] = (extra.commands || []) as string[];

let existing = JOBS.get(token);
if (!existing) {
  existing = reactive<DepJob>({ status: 'running', error: '', started: Date.now(),
    steps: commands.map((command, i) => ({ i, command, status: 'Created', message: '' })) }) as DepJob;
  JOBS.set(token, existing);
  void execute(existing);
}
const job = existing;
const start = new Date(job.started).toLocaleString('en-US');
const correlation = token.split('').reduce((a, ch) => ((a * 31 + ch.charCodeAt(0)) >>> 0), 7).toString(16).padStart(8, '0')
  + '-1d2c-4f7a-9b3e-' + (token.length * 7919).toString(16).padStart(12, '0');
const cols = [{ key: 'command', label: 'Operation (az)' }, { key: 'status', label: 'Status' }, { key: 'message', label: 'Operation details' }];

async function execute(target: DepJob) {
  await new Promise(resolve => window.setTimeout(resolve, 600));
  for (const step of target.steps) {
    step.status = 'Running';
    const result = await az.api.exec(step.command, { quiet: true });
    if (!result.ok) {
      step.status = 'Failed';
      step.message = errorText(result);
      target.status = 'fail';
      target.error = errorText(result);
      az.note('error', 'Deployment failed', `Deployment to resource group '${route.value.group}' failed.`);
      az.api.notify('error', 'Deployment failed', target.error, step.command);
      for (const rest of target.steps) if (rest.status === 'Created') rest.status = 'Skipped';
      return;
    }
    step.status = 'OK';
    step.message = 'Created';
  }
  target.status = 'ok';
  az.note('success', 'Deployment succeeded', `Deployment '${route.value.name}' to resource group '${route.value.group}' was successful.`);
  az.api.notify('success', 'Deployment succeeded', `Deployment '${route.value.name}' to resource group '${route.value.group}' was successful.`);
}

function goToResource() {
  if (kind.value === 'group') { az.go({ page: 'group', name: route.value.group }); return; }
  const name = String(extra.resource || '');
  const target = kind.value === 'sqldb'
    ? allResources(az.p.value).find(r => r.kind === 'sqldb' && r.name === name)
    : rows(az.p.value, 'resources').find(r => r.kind === kind.value && r.name === name);
  if (target) az.go({ page: 'resource', id: target.id });
  else az.go({ page: 'group', name: route.value.group });
}
</script>

<style scoped>
.az-dep__hero { display: flex; gap: 16px; align-items: flex-start; padding: 16px 0 18px; }
.az-dep__title { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
.az-dep__meta { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 4px 24px; color: #424242; }
.az-dep__details { margin: 8px 0 16px; }
.az-dep__details summary { cursor: pointer; padding: 6px 0; }
.az-spin { animation: az-spin 1s linear infinite; }
@keyframes az-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .az-spin { animation: none; } }
</style>
