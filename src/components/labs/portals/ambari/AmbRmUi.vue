<template>
  <div class="rm">
    <div class="rm__banner">
      <svg class="rm__logo" viewBox="0 0 40 28" aria-hidden="true">
        <ellipse cx="20" cy="15" rx="15" ry="10" fill="#f8d33a" />
        <ellipse cx="9" cy="10" rx="5" ry="6" fill="#f0c419" />
        <path d="M6 18c-3 2-4 6-2 8" stroke="#f0c419" stroke-width="3" fill="none" />
        <circle cx="12" cy="9" r="1.3" fill="#333" />
      </svg>
      <span class="rm__hadoop">hadoop</span>
      <h2 class="rm__title">{{ title }}</h2>
      <span class="rm__who">Logged in as: dr.who</span>
    </div>
    <div class="rm__body">
      <nav class="rm__nav">
        <a href="#" class="rm__back" @click.prevent="$emit('navigate', { page: 'service', id: 'YARN' })">« Back to Ambari</a>
        <h4>Cluster</h4>
        <ul>
          <li><a href="#" @click.prevent="section = 'nodes'; listNodes()">Nodes</a></li>
          <li><a href="#" @click.prevent="section = 'apps'; stateFilter = ''; $emit('navigate', { page: 'rm' })">Applications</a>
            <ul>
              <li v-for="s in STATES" :key="s"><a href="#" @click.prevent="section = 'apps'; stateFilter = s; $emit('navigate', { page: 'rm' })">{{ s }}</a></li>
            </ul>
          </li>
          <li><a href="#" @click.prevent="section = 'scheduler'">Scheduler</a></li>
        </ul>
      </nav>

      <div class="rm__main">
        <table class="rm__metrics">
          <thead>
            <tr><th>Apps Submitted</th><th>Apps Running</th><th>Apps Completed</th><th>Containers Running</th>
              <th>Memory Used</th><th>Memory Total</th><th>Active Nodes</th></tr>
          </thead>
          <tbody>
            <tr><td>{{ apps.length }}</td><td>{{ count('RUNNING') }}</td><td>{{ apps.length - count('RUNNING') }}</td>
              <td>{{ runningContainers }}</td><td>{{ memUsed }} MB</td><td>{{ memTotal }} MB</td><td>{{ nodes.length }}</td></tr>
          </tbody>
        </table>

        <!-- One application -->
        <template v-if="appId">
          <div class="rm__appbar">
            <button type="button" class="rm__btn" :disabled="busy" @click="status">Refresh status</button>
            <button v-if="app && app.state === 'RUNNING'" type="button" class="rm__btn is-kill" :disabled="busy" @click="killing = app.id">Kill Application</button>
          </div>
          <table v-if="app" class="rm__kv">
            <tbody>
              <tr><th>User:</th><td>{{ app.user }}</td></tr>
              <tr><th>Name:</th><td>{{ app.name }}</td></tr>
              <tr><th>Application Type:</th><td>{{ app.type }}</td></tr>
              <tr><th>Queue:</th><td>{{ detail(app.id).queue || app.queue }}</td></tr>
              <tr><th>YarnApplicationState:</th><td>{{ app.state }}</td></tr>
              <tr><th>FinalStatus Reported by AM:</th><td>{{ app.final }}</td></tr>
              <tr><th>Started:</th><td>{{ app.started }}</td></tr>
              <tr><th>Elapsed:</th><td>{{ elapsed(app.elapsed_ms) }}</td></tr>
              <tr><th>Aggregate Resource Allocation:</th><td>{{ app.memory_mb }} MB-seconds, {{ app.vcores }} vcore-seconds</td></tr>
            </tbody>
          </table>
          <pre v-if="statusText" class="rm__status">{{ statusText }}</pre>
          <p v-if="!app">Application {{ appId }} is not known to this ResourceManager.</p>
        </template>

        <!-- Nodes -->
        <template v-else-if="section === 'nodes'">
          <table class="rm__table">
            <thead><tr><th>Node Labels</th><th>Rack</th><th>Node State</th><th>Node Address</th><th>Node HTTP Address</th><th>Containers</th><th>Version</th></tr></thead>
            <tbody>
              <tr v-for="n in nodes" :key="n.host">
                <td></td><td>{{ n.rack }}</td><td>{{ yarnUp ? 'RUNNING' : 'LOST' }}</td><td>{{ n.host }}:8041</td>
                <td><a href="#" @click.prevent>{{ n.host }}:8042</a></td><td>{{ count('RUNNING') }}</td><td>{{ n.version }}</td>
              </tr>
            </tbody>
          </table>
        </template>

        <!-- Scheduler -->
        <template v-else-if="section === 'scheduler'">
          <h3 class="rm__h3">Application Queues</h3>
          <div v-for="q in queues" :key="q.name" class="rm__queue">
            <div class="rm__qbar"><i :style="{ width: q.capacity + '%' }"></i><b :style="{ width: Math.min(q.used, q.capacity) + '%' }"></b></div>
            <span>root.{{ q.name }} — {{ q.capacity }}% capacity, {{ q.state }}</span>
          </div>
        </template>

        <!-- All applications -->
        <template v-else>
          <div class="rm__search">
            <label>Search: <input v-model="search" aria-label="Search applications" /></label>
          </div>
          <div class="rm__wrap">
            <table class="rm__table">
              <thead>
                <tr><th>ID</th><th>User</th><th>Name</th><th>Application Type</th><th>Queue</th><th>StartTime</th>
                  <th>State</th><th>FinalStatus</th><th>Running Containers</th><th>Allocated Memory MB</th><th>Progress</th><th>Tracking UI</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="a in shown" :key="a.id">
                  <td><a href="#" @click.prevent="$emit('navigate', { page: 'rm', id: a.id })">{{ a.id }}</a></td>
                  <td>{{ a.user }}</td>
                  <td class="rm__name" :title="a.name">{{ a.name }}</td>
                  <td>{{ a.type }}</td>
                  <td>{{ detail(a.id).queue || a.queue }}</td>
                  <td class="rm__nowrap">{{ a.started }}</td>
                  <td>{{ a.state }}</td>
                  <td>{{ a.final }}</td>
                  <td>{{ a.state === 'RUNNING' ? a.containers : 0 }}</td>
                  <td>{{ a.state === 'RUNNING' ? a.memory_mb : 0 }}</td>
                  <td><div class="rm__prog"><i :style="{ width: a.progress + '%' }"></i></div></td>
                  <td>{{ a.state === 'RUNNING' ? 'ApplicationMaster' : 'History' }}</td>
                  <td><button v-if="a.state === 'RUNNING'" type="button" class="rm__btn is-kill" :disabled="busy" @click="killing = a.id">Kill</button></td>
                </tr>
              </tbody>
            </table>
            <p v-if="!shown.length" class="rm__empty">No data available in table</p>
          </div>
          <p class="rm__hint">Showing {{ shown.length }} of {{ apps.length }} entries. A long-running job to practise
            killing: <code>hadoop jar hadoop-mapreduce-client-jobclient-tests.jar sleep -m 1 -r 1 -mt 600000</code></p>
        </template>
      </div>
    </div>

    <AmbModal v-if="killing" title="Kill Application" ok-text="Kill" danger small :busy="busy" @close="killing = ''" @ok="kill">
      <p>Are you sure you want to kill {{ killing }}?</p>
    </AmbModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import { cli, matches, pick, rows } from '@/utils/portalKit';
import AmbModal from './AmbModal.vue';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; appId: string }>();
defineEmits<{ (event: 'navigate', route: any): void }>();

const STATES = ['NEW', 'SUBMITTED', 'ACCEPTED', 'RUNNING', 'FINISHED', 'FAILED', 'KILLED'];
const section = ref('apps');
const stateFilter = ref('');
const search = ref('');
const killing = ref('');
const statusText = ref('');

const apps = computed(() => rows(props.view, 'yarn.apps'));
const details = computed(() => rows(props.view, 'yarn.app_details'));
const nodes = computed(() => rows(props.view, 'datanodes'));
const queues = computed(() => rows(props.view, 'yarn.queues'));
const yarnUp = computed(() => rows(props.view, 'ambari.cluster_services').find(s => s.id === 'YARN')?.state !== 'INSTALLED');
const app = computed(() => apps.value.find(a => a.id === props.appId));
const shown = computed(() => apps.value.filter(a => (!stateFilter.value || a.state === stateFilter.value)
  && matches(a, search.value, ['id', 'name', 'user', 'type', 'queue', 'state'])));
const runningContainers = computed(() => apps.value.filter(a => a.state === 'RUNNING').reduce((n, a) => n + Number(a.containers || 0), 0));
const memUsed = computed(() => pick<number>(props.view, 'ambari.metrics.yarn_memory_used_mb', 0));
const memTotal = computed(() => pick<number>(props.view, 'ambari.metrics.yarn_memory_total_mb', 0));
const title = computed(() => props.appId ? `Application ${props.appId}`
  : section.value === 'nodes' ? 'Nodes of the cluster' : section.value === 'scheduler' ? 'Scheduler'
    : stateFilter.value ? `${stateFilter.value} Applications` : 'All Applications');

function count(state: string) {
  return apps.value.filter(a => a.state === state).length;
}
function detail(id: string) {
  return details.value.find(d => d.id === id) || {};
}
function elapsed(ms: number) {
  const s = Math.round((ms || 0) / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}mins, ${s % 60}sec` : `${s}sec`;
}

async function status() {
  if (!props.appId) return;
  const result = await props.api.exec(cli(['yarn', 'application', '-status', props.appId]), { failure: 'Could not read the application status' });
  statusText.value = result.ok ? String(result.output || '') : '';
}
async function listNodes() {
  await props.api.exec(cli(['yarn', 'node', '-list']), { failure: 'Could not list the nodes' });
}
async function kill() {
  const id = killing.value;
  const result = await props.api.exec(cli(['yarn', 'application', '-kill', id]), { success: `Killed application ${id}` });
  if (result.ok) killing.value = '';
}

watch(() => props.appId, id => {
  statusText.value = '';
  if (id) void status();
}, { immediate: true });
</script>

<style scoped>
.rm { background: #fff; font-family: Verdana, Helvetica, Arial, sans-serif; font-size: 12px; color: #000; margin: -20px; min-height: calc(100% + 40px); }
.rm__banner { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid #ccc; background: linear-gradient(#fff, #eee); flex-wrap: wrap; }
.rm__logo { width: 40px; height: 28px; }
.rm__hadoop { font-family: Georgia, serif; font-size: 22px; font-weight: 700; color: #333; letter-spacing: -.5px; }
.rm__title { margin: 0 0 0 20px; font-size: 22px; font-weight: 400; flex: 1; }
.rm__who { color: #666; }
.rm__body { display: flex; min-height: calc(100% - 50px); }
.rm__nav { width: 170px; flex: 0 0 170px; background: #f2f2f2; border-right: 1px solid #ccc; padding: 10px; }
.rm__nav h4 { margin: 10px 0 4px; font-size: 13px; }
.rm__nav ul { list-style: none; margin: 0; padding-left: 10px; }
.rm__nav li { padding: 2px 0; }
.rm__nav a { color: #0066cc; }
.rm__back { display: block; margin-bottom: 8px; }
.rm__main { flex: 1; min-width: 0; padding: 10px 14px; }
.rm__metrics, .rm__table, .rm__kv { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
.rm__metrics th, .rm__table th { background: #c7d5e0; border: 1px solid #a6b8c6; padding: 4px 6px; text-align: left; font-weight: 700; white-space: nowrap; }
.rm__metrics td, .rm__table td { border: 1px solid #ddd; padding: 4px 6px; }
.rm__table tbody tr:nth-child(odd) { background: #f4f8fb; }
.rm__kv th { text-align: right; padding: 3px 8px; width: 240px; white-space: nowrap; }
.rm__kv td { padding: 3px 8px; }
.rm__wrap { overflow-x: auto; }
.rm__search { text-align: right; margin-bottom: 6px; }
.rm__search input { border: 1px solid #aaa; padding: 2px 4px; font: inherit; }
.rm__name { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rm__nowrap { white-space: nowrap; }
.rm__prog { width: 60px; height: 10px; border: 1px solid #aaa; background: #fff; }
.rm__prog i { display: block; height: 100%; background: #5ea1d8; }
.rm__btn { color: #000; font: inherit; padding: 2px 8px; border: 1px solid #999; background: linear-gradient(#fff, #ddd); cursor: pointer; border-radius: 2px; }
.rm__btn.is-kill { color: #a00; }
.rm__appbar { display: flex; gap: 8px; margin-bottom: 10px; }
.rm__status { background: #f8f8f8; border: 1px solid #ddd; padding: 8px; white-space: pre-wrap; }
.rm__empty { text-align: center; color: #666; padding: 12px; }
.rm__hint { color: #666; }
.rm__hint code { font-size: 11px; }
.rm__h3 { font-size: 15px; margin: 6px 0 10px; }
.rm__queue { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.rm__qbar { position: relative; width: 300px; height: 16px; border: 1px solid #888; background: #fff; }
.rm__qbar i { position: absolute; inset: 0 auto 0 0; background: #b5d4ee; }
.rm__qbar b { position: absolute; inset: 0 auto 0 0; background: #5ea1d8; }
@container sl-portal (max-width: 700px) {
  .rm { margin: -12px; min-height: calc(100% + 24px); }
  .rm__body { flex-direction: column; }
  .rm__nav { width: auto; flex: none; border-right: 0; border-bottom: 1px solid #ccc; }
  .rm__title { margin: 0; font-size: 17px; }
}
</style>
