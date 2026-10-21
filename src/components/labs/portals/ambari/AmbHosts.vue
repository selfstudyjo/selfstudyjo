<template>
  <div v-if="!host">
    <div class="toolbar">
      <div class="amb-dd">
        <button type="button" class="btn btn-default" :disabled="busy" @click.stop="actions = !actions">
          Actions <AmbIcon name="caret" :size="11" />
        </button>
        <ul v-if="actions" class="amb-dd__menu" @click="actions = false">
          <li><a href="#" class="is-disabled" title="Adding hosts needs a new machine, which this lab does not model">Add New Hosts</a></li>
          <li class="amb-dd__sep"></li>
          <li class="amb-dd__header">Selected Hosts ({{ selected.length }})</li>
          <li v-for="op in BULK" :key="'s' + op.id">
            <a href="#" :class="{ 'is-disabled': !selected.length }" @click.prevent="askBulk(op.id, selected)">
              <AmbIcon :name="op.icon" :size="12" />{{ op.label }}</a>
          </li>
          <li class="amb-dd__sep"></li>
          <li class="amb-dd__header">All Hosts ({{ hosts.length }})</li>
          <li v-for="op in BULK" :key="'a' + op.id">
            <a href="#" @click.prevent="askBulk(op.id, hosts.map(h => h.host))"><AmbIcon :name="op.icon" :size="12" />{{ op.label }}</a>
          </li>
        </ul>
      </div>
      <span class="spacer"></span>
      <input v-model="filter" class="form-control hosts__filter" placeholder="Filter by host and component attributes"
             aria-label="Filter hosts" />
    </div>
    <div class="table-wrap panel">
      <table class="table">
        <thead>
          <tr>
            <th class="hosts__check"><input type="checkbox" :checked="allSelected" aria-label="Select all" @change="toggleAll" /></th>
            <th>Name</th><th>IP Address</th><th>Rack</th><th>Cores</th><th>RAM</th>
            <th>Disk Usage</th><th>Load Avg</th><th>Versions</th><th>Components</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in shown" :key="h.host" :class="{ 'is-selected': selected.includes(h.host) }"
              @contextmenu.prevent="hostMenu($event, h)">
            <td class="hosts__check"><input v-model="selected" type="checkbox" :value="h.host" :aria-label="`Select ${h.fqdn}`" /></td>
            <td class="hosts__name">
              <AmbIcon :name="healthIcon(h)" :class="healthClass(h)" :title="healthTitle(h)" />
              <a href="#" @click.prevent="$emit('navigate', { page: 'host', id: h.host })">{{ h.fqdn }}</a>
              <span v-if="h.alerts" class="hosts__alerts" :title="`${h.alerts} alert(s)`">{{ h.alerts }}</span>
            </td>
            <td>{{ h.ip }}</td>
            <td>{{ h.rack }}</td>
            <td>{{ h.cores }} ({{ h.cores }})</td>
            <td>{{ h.ram_gb }}.00GB</td>
            <td>
              <div class="hosts__bar" :title="`${h.disk_used_percent}%`"><i :style="{ width: Math.min(100, h.disk_used_percent || 0) + '%' }"></i></div>
            </td>
            <td>{{ h.load_avg }}</td>
            <td>{{ h.versions }}</td>
            <td>
              <a href="#" @click.prevent="$emit('navigate', { page: 'host', id: h.host })">{{ (h.components || []).length }} Components</a>
              <span v-if="downCount(h)" class="hosts__down"> · {{ downCount(h) }} stopped</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!shown.length" class="empty">No hosts to display</div>
    </div>
    <div class="text-muted hosts__count">{{ shown.length }} of {{ hosts.length }} hosts showing · right-click a host for its actions</div>
  </div>

  <div v-else-if="detail">
    <div class="toolbar">
      <a href="#" @click.prevent="$emit('navigate', { page: 'hosts' })">Hosts</a> <span class="text-muted">/</span>
      <strong>{{ detail.fqdn }}</strong>
      <span v-if="detail.maintenance === 'ON'" class="label label-unknown">Maintenance Mode</span>
      <span class="spacer"></span>
      <div class="amb-dd">
        <button type="button" class="btn btn-success" :disabled="busy" @click.stop="hostActions = !hostActions">
          Host Actions <AmbIcon name="caret" :size="11" />
        </button>
        <ul v-if="hostActions" class="amb-dd__menu is-right" @click="hostActions = false">
          <li v-for="op in BULK" :key="op.id">
            <a href="#" @click.prevent="askBulk(op.id, [detail.host])"
               :class="{ 'is-disabled': (op.id === 'maint-on' && detail.maintenance === 'ON') || (op.id === 'maint-off' && detail.maintenance !== 'ON') }">
              <AmbIcon :name="op.icon" :size="12" />{{ op.label }}</a>
          </li>
        </ul>
      </div>
    </div>
    <div v-if="detail.maintenance === 'ON'" class="alert alert-info">This host is in Maintenance Mode: alerts raised by its components are suppressed.</div>
    <div class="host__grid">
      <div class="panel">
        <div class="panel-heading"><h4>Components</h4></div>
        <div class="table-wrap">
          <table class="table">
            <tbody>
              <tr v-for="comp in detail.components" :key="comp.name" @contextmenu.prevent="compMenu($event, comp)">
                <td style="width:24px">
                  <AmbIcon v-if="comp.category !== 'CLIENT'" :name="comp.state === 'STARTED' ? 'ok' : 'down'"
                           :class="comp.state === 'STARTED' ? 'health-ok' : 'health-down'" />
                </td>
                <td>{{ comp.display }}</td>
                <td><a href="#" @click.prevent="$emit('navigate', { page: 'service', id: comp.service })">{{ serviceName(comp.service) }}</a></td>
                <td>{{ comp.category === 'CLIENT' ? 'Installed' : comp.state === 'STARTED' ? 'Started' : 'Stopped' }}</td>
                <td class="host__act">
                  <button v-if="comp.category !== 'CLIENT'" type="button" class="host__btn"
                          :class="comp.state === 'STARTED' ? 'is-ok' : 'is-down'" :disabled="busy"
                          :aria-label="`${comp.display} actions`" @click.stop="compMenu($event, comp)">
                    {{ comp.state === 'STARTED' ? 'Started' : 'Stopped' }} <AmbIcon name="caret" :size="10" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-heading"><h4>Summary</h4></div>
        <div class="table-wrap">
          <table class="table host__kv">
            <tbody>
              <tr><th>Hostname</th><td>{{ detail.fqdn }}</td></tr>
              <tr><th>IP Address</th><td>{{ detail.ip }}</td></tr>
              <tr><th>Rack</th><td>{{ detail.rack }}</td></tr>
              <tr><th>OS</th><td>{{ detail.os }} (x86_64)</td></tr>
              <tr><th>Cores (CPU)</th><td>{{ detail.cores }} ({{ detail.cores }})</td></tr>
              <tr><th>Disk</th><td>{{ detail.disk_used_percent }}% used</td></tr>
              <tr><th>Memory</th><td>{{ detail.ram_gb }}.00GB</td></tr>
              <tr><th>Load Avg</th><td>{{ detail.load_avg }}</td></tr>
              <tr><th>Heartbeat</th><td>less than a minute ago</td></tr>
              <tr><th>Maintenance Mode</th><td>{{ detail.maintenance === 'ON' ? 'On' : 'Off' }}</td></tr>
              <tr><th>Alerts</th><td>{{ detail.alerts || 0 }}</td></tr>
              <tr><th>Current Version</th><td>{{ detail.versions }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="empty">Host {{ host }} is not part of this cluster.</div>

  <!-- one component on one host -->
  <AmbModal v-if="confirm" title="Confirmation" :ok-text="confirm.verb" :danger="confirm.verb === 'Stop'" :busy="busy"
            @close="confirm = null" @ok="perform">
    <p>Are you sure you want to {{ confirm.verb.toLowerCase() }} {{ confirm.display }} on {{ confirm.host }}.lab.internal?</p>
    <div v-if="confirm.verb === 'Stop' && confirm.name === 'DATANODE'" class="alert alert-warning">
      Blocks it holds will be under-replicated, or missing if it held the only replica.</div>
    <div v-else-if="confirm.verb === 'Stop' && KEY.includes(confirm.name)" class="alert alert-warning">
      Clients of {{ serviceName(confirm.service) }} connect to {{ confirm.display }}: they fail until it is started again.</div>
  </AmbModal>

  <!-- Host Actions, on one or several hosts -->
  <AmbModal v-if="bulk" title="Confirmation" :ok-text="bulkOp?.ok || 'OK'" :danger="bulk.op === 'stop'" :busy="busy"
            @close="bulk = null" @ok="performBulk">
    <p>{{ bulkOp?.label }} on {{ bulk.hosts.length === 1 ? bulk.hosts[0] + '.lab.internal' : bulk.hosts.length + ' hosts' }}?</p>
    <ul v-if="bulk.hosts.length > 1" class="hosts__list"><li v-for="h in bulk.hosts" :key="h">{{ h }}.lab.internal</li></ul>
    <p v-if="bulk.op === 'maint-on'" class="text-muted">Alerts raised by components on {{ bulk.hosts.length === 1 ? 'this host' : 'these hosts' }} will be suppressed.</p>
  </AmbModal>

  <AmbContextMenu v-if="ctx" :x="ctx.x" :y="ctx.y" :items="ctx.items" @close="ctx = null" />
</template>

<script setup lang="ts">
/**
 * Hosts: the host list with its bulk Actions menu, and one host's page with its
 * Host Actions and a per-component Start / Stop / Restart menu. Every action is
 * a curl against Ambari's REST API (see ambari.ts).
 */
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import { matches, pick, rows } from '@/utils/portalKit';
import {
  SERVICE_NAMES, hostAllComponentsCommand, hostComponentCommand, hostMaintenanceCommand, restartComponentsCommand,
  restartHostCommand, type AmbMenuItem,
} from './ambari';
import AmbContextMenu from './AmbContextMenu.vue';
import AmbIcon from './AmbIcon.vue';
import AmbModal from './AmbModal.vue';

const props = defineProps<{ view: Record<string, any>; host?: string; api?: PortalApi; busy?: boolean }>();
const emit = defineEmits<{ (event: 'navigate', route: any): void }>();

const KEY = ['NAMENODE', 'RESOURCEMANAGER', 'HIVE_SERVER', 'HIVE_METASTORE'];
type BulkId = 'start' | 'stop' | 'restart' | 'maint-on' | 'maint-off';
const BULK: { id: BulkId; label: string; icon: string; ok: string }[] = [
  { id: 'start', label: 'Start All Components', icon: 'play', ok: 'Start' },
  { id: 'stop', label: 'Stop All Components', icon: 'stop', ok: 'Stop' },
  { id: 'restart', label: 'Restart All Components', icon: 'refresh', ok: 'Restart' },
  { id: 'maint-on', label: 'Turn On Maintenance Mode', icon: 'maint', ok: 'OK' },
  { id: 'maint-off', label: 'Turn Off Maintenance Mode', icon: 'maint', ok: 'OK' },
];

const filter = ref('');
const selected = ref<string[]>([]);
const actions = ref(false);
const hostActions = ref(false);
const ctx = ref<{ x: number; y: number; items: AmbMenuItem[] } | null>(null);
const confirm = ref<{ verb: 'Start' | 'Stop' | 'Restart'; name: string; display: string; service: string; host: string } | null>(null);
const bulk = ref<{ op: BulkId; hosts: string[] } | null>(null);
const bulkOp = computed(() => BULK.find(b => b.id === bulk.value?.op));

const cluster = computed(() => String(pick(props.view, 'ambari.api.cluster', pick(props.view, 'cluster', 'cluster'))));
const hosts = computed(() => rows(props.view, 'ambari.host_details'));
const shown = computed(() => hosts.value.filter(h => matches(
  { ...h, comps: (h.components || []).map((c: any) => c.display).join(' ') }, filter.value,
  ['fqdn', 'ip', 'rack', 'comps'])));
const detail = computed(() => hosts.value.find(h => h.host === props.host));
const allSelected = computed(() => shown.value.length > 0 && shown.value.every(h => selected.value.includes(h.host)));

function toggleAll() {
  selected.value = allSelected.value ? [] : shown.value.map(h => h.host);
}
function downCount(h: Record<string, any>) {
  return (h.components || []).filter((c: any) => c.category !== 'CLIENT' && c.state !== 'STARTED').length;
}
function healthIcon(h: Record<string, any>) {
  if (h.maintenance === 'ON') return 'maint';
  return downCount(h) ? 'warn' : 'ok';
}
function healthClass(h: Record<string, any>) {
  if (h.maintenance === 'ON') return 'health-maint';
  return downCount(h) ? 'health-warn' : 'health-ok';
}
function healthTitle(h: Record<string, any>) {
  if (h.maintenance === 'ON') return 'Maintenance Mode';
  return downCount(h) ? `${downCount(h)} component(s) stopped` : 'Healthy';
}
function serviceName(id: string) {
  return SERVICE_NAMES[id] || id;
}

function compMenu(event: MouseEvent, comp: Record<string, any>) {
  const host = detail.value;
  if (!host || comp.category === 'CLIENT') return;
  const up = comp.state === 'STARTED';
  const base = { name: String(comp.name), display: String(comp.display), service: String(comp.service), host: String(host.host) };
  ctx.value = {
    x: event.clientX, y: event.clientY,
    items: [
      { header: true, label: comp.display },
      { label: 'Start', icon: 'play', disabled: up, run: () => { confirm.value = { verb: 'Start', ...base }; } },
      { label: 'Stop', icon: 'stop', disabled: !up, run: () => { confirm.value = { verb: 'Stop', ...base }; } },
      { label: 'Restart', icon: 'refresh', run: () => { confirm.value = { verb: 'Restart', ...base }; } },
      { sep: true },
      { label: `Go to ${serviceName(comp.service)}`, icon: 'services', run: () => emit('navigate', { page: 'service', id: comp.service }) },
    ],
  };
}

function hostMenu(event: MouseEvent, h: Record<string, any>) {
  ctx.value = {
    x: event.clientX, y: event.clientY,
    items: [
      { header: true, label: h.fqdn },
      { label: 'Open host page', icon: 'hosts', run: () => emit('navigate', { page: 'host', id: h.host }) },
      { sep: true },
      ...BULK.map(op => ({
        label: op.label, icon: op.icon,
        disabled: (op.id === 'maint-on' && h.maintenance === 'ON') || (op.id === 'maint-off' && h.maintenance !== 'ON'),
        run: () => askBulk(op.id, [h.host]),
      })),
    ],
  };
}

async function perform() {
  const target = confirm.value;
  if (!target || !props.api) return;
  const context = `${target.verb} ${target.display}`;
  const command = target.verb === 'Restart'
    ? restartComponentsCommand(cluster.value, target.service, target.name, [target.host], context)
    : hostComponentCommand(cluster.value, target.host, target.name, target.verb === 'Start' ? 'STARTED' : 'INSTALLED', context);
  const result = await props.api.exec(command, { success: `${context} on ${target.host}.lab.internal: completed`,
                                                 failure: 'Ambari could not complete the request' });
  if (result.ok) confirm.value = null;
}

function askBulk(op: BulkId, list: string[]) {
  actions.value = false;
  hostActions.value = false;
  if (!list.length) return;
  bulk.value = { op, hosts: [...list] };
}

async function performBulk() {
  const job = bulk.value;
  if (!job || !props.api) return;
  for (const name of job.hosts) {
    const h = hosts.value.find(x => x.host === name);
    if (!h) continue;
    let command = '';
    const fqdn = `${name}.lab.internal`;
    if (job.op === 'start' || job.op === 'stop') {
      const wanted = job.op === 'start' ? 'STARTED' : 'INSTALLED';
      command = hostAllComponentsCommand(cluster.value, name, wanted,
                                         `${job.op === 'start' ? 'Start' : 'Stop'} All Host Components on ${fqdn}`);
    } else if (job.op === 'restart') {
      const comps = (h.components || []).filter((c: any) => c.category !== 'CLIENT')
        .map((c: any) => ({ service: String(c.service), component: String(c.name) }));
      if (!comps.length) continue;
      command = restartHostCommand(cluster.value, name, comps);
    } else {
      command = hostMaintenanceCommand(cluster.value, name, job.op === 'maint-on');
    }
    const result = await props.api.exec(command, { success: `${bulkOp.value?.label}: ${fqdn}`,
                                                   failure: `Ambari could not complete the request for ${fqdn}` });
    if (!result.ok) return;
  }
  bulk.value = null;
}
</script>

<style scoped>
.hosts__filter { max-width: 340px; }
.host__act { width: 110px; text-align: right; }
.hosts__check { width: 30px; }
.hosts__name { white-space: nowrap; }
.hosts__name a { margin-left: 6px; }
.hosts__alerts { display: inline-block; margin-left: 6px; background: #d43f3a; color: #fff; border-radius: 9px; font-size: 11px; padding: 0 6px; line-height: 16px; }
.hosts__down { color: #a94442; font-size: 12px; }
.hosts__bar { width: 90px; height: 10px; background: #eee; border: 1px solid #ddd; }
.hosts__bar i { display: block; height: 100%; background: #41bfae; }
.hosts__count { font-size: 12px; margin-top: -10px; }
.hosts__list { margin: 0 0 10px; padding-left: 18px; font-size: 13px; max-height: 140px; overflow: auto; }
.host__grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
.host__kv th { font-weight: 400; color: #666; width: 40%; border-bottom: 0; border-top: 1px solid #ddd; }
.host__btn {
  display: inline-flex; align-items: center; gap: 4px; border: 1px solid #ccc; background: #fff; border-radius: 3px;
  padding: 2px 8px; font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap;
}
.host__btn.is-ok { color: #158a57; border-color: #9fd3b8; }
.host__btn.is-down { color: #c9302c; border-color: #e7a9a7; }
.host__btn:hover:not(:disabled) { background: #f5f5f5; }
@container sl-portal (max-width: 760px) { .host__grid { grid-template-columns: minmax(0, 1fr); } }
</style>
