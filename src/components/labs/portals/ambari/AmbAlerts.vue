<template>
  <div>
    <div class="toolbar">
      <select v-model="status" class="form-control alerts__select" aria-label="Status filter">
        <option value="">All</option><option value="CRITICAL">CRIT</option><option value="WARNING">WARN</option>
        <option value="OK">OK</option><option value="NONE">NONE (disabled)</option>
      </select>
      <select v-model="service" class="form-control alerts__select" aria-label="Service filter">
        <option value="">All services</option>
        <option v-for="s in services" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="stateFilter" class="form-control alerts__select" aria-label="State filter">
        <option value="">Enabled and disabled</option><option value="on">Enabled</option><option value="off">Disabled</option>
      </select>
      <span class="spacer"></span>
      <input v-model="filter" class="form-control alerts__filter" placeholder="Filter alert definitions"
             aria-label="Filter alerts" />
    </div>
    <div class="panel table-wrap">
      <table class="table">
        <thead>
          <tr><th>Alert Definition Name</th><th>Status</th><th>Service</th><th>Last Status Changed</th><th>State</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in shown" :key="row.key" :class="{ 'alerts__off': !row.enabled }"
              @contextmenu.prevent="rowMenu($event, row)">
            <td>
              <a href="#" @click.prevent="openDef(row)">{{ row.label }}</a>
              <div v-if="row.text" class="alerts__text">{{ row.text }}</div>
            </td>
            <td><span class="label" :class="labelClass(row.level)">{{ short(row.level) }}</span>
              <span v-if="row.count" class="text-muted"> ({{ row.count }})</span></td>
            <td><a href="#" @click.prevent="goService(row)">{{ row.service }}</a></td>
            <td>{{ row.count ? 'less than a minute ago' : 'about an hour ago' }}</td>
            <td>
              <a v-if="row.id" href="#" :class="{ 'is-busy': busy }" :title="row.enabled ? 'Disable' : 'Enable'"
                 @click.prevent="askToggle(row)">{{ row.enabled ? 'Enabled' : 'Disabled' }}</a>
              <span v-else>Enabled</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!shown.length" class="empty">No alerts to display</div>
    </div>

    <!-- One alert definition: its configs and its instances. -->
    <AmbModal v-if="open" :title="open.label" ok-text="" cancel-text="Close" wide @close="open = null">
      <ul class="nav-tabs">
        <li :class="{ active: dtab === 'summary' }"><a href="#" @click.prevent="dtab = 'summary'">Summary</a></li>
        <li :class="{ active: dtab === 'instances' }"><a href="#" @click.prevent="dtab = 'instances'">Instances ({{ open.count }})</a></li>
      </ul>
      <template v-if="dtab === 'summary'">
        <table class="table alerts__kv">
          <tbody>
            <tr><th>Name</th><td class="mono">{{ open.name }}</td></tr>
            <tr><th>Service</th><td>{{ open.service }}</td></tr>
            <tr><th>Type</th><td>{{ open.source }}</td></tr>
            <tr><th>Status</th><td><span class="label" :class="labelClass(open.level)">{{ short(open.level) }}</span></td></tr>
            <tr><th>Description</th><td>{{ describe(open) }}</td></tr>
            <tr>
              <th><label for="alert-interval">Check Interval</label></th>
              <td>
                <div class="alerts__interval">
                  <input id="alert-interval" v-model.number="interval" class="form-control" type="number" min="1" max="1440"
                         :disabled="!open.id" />
                  <span>Minute(s)</span>
                </div>
                <span v-if="intervalError" class="help-block alerts__err">{{ intervalError }}</span>
              </td>
            </tr>
            <tr><th>State</th><td>{{ open.enabled ? 'Enabled' : 'Disabled' }}</td></tr>
          </tbody>
        </table>
      </template>
      <div v-else class="table-wrap">
        <table class="table">
          <thead><tr><th>Status</th><th>Host</th><th>Response</th></tr></thead>
          <tbody>
            <tr v-for="(h, i) in instanceRows" :key="i">
              <td><span class="label" :class="labelClass(open.level)">{{ short(open.level) }}</span></td>
              <td>{{ h }}.lab.internal</td><td>{{ open.text }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!instanceRows.length" class="empty">No alert instances: every host responds OK.</div>
      </div>
      <template #footer>
        <button type="button" class="btn btn-default" @click="open = null">Close</button>
        <button v-if="open.id" type="button" class="btn btn-default" :disabled="busy" @click="askToggle(open)">
          {{ open.enabled ? 'Disable' : 'Enable' }}</button>
        <button v-if="open.id" type="button" class="btn btn-success" :disabled="busy || !!intervalError || interval === open.interval"
                @click="saveInterval">Save</button>
      </template>
    </AmbModal>

    <AmbModal v-if="toggling" title="Confirmation" :ok-text="toggling.enabled ? 'Disable' : 'Enable'"
              :danger="toggling.enabled" small :busy="busy" @close="toggling = null" @ok="toggle">
      <p v-if="toggling.enabled">You are about to disable the <strong>{{ toggling.label }}</strong> alert definition.
        Its alerts will not be raised until it is enabled again. Are you sure?</p>
      <p v-else>You are about to enable the <strong>{{ toggling.label }}</strong> alert definition. Are you sure?</p>
    </AmbModal>

    <AmbContextMenu v-if="ctx" :x="ctx.x" :y="ctx.y" :items="ctx.items" @close="ctx = null" />
  </div>
</template>

<script setup lang="ts">
/**
 * Alerts: the alert definitions, their live status, and enable / disable / the
 * check interval - each a PUT on /alert_definitions/<id> through curl.
 */
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import { matches, pick, rows } from '@/utils/portalKit';
import { SERVICE_NAMES, alertDefinitionCommand, type AmbMenuItem } from './ambari';
import AmbContextMenu from './AmbContextMenu.vue';
import AmbModal from './AmbModal.vue';

const props = defineProps<{ view: Record<string, any>; api?: PortalApi; busy?: boolean }>();
const emit = defineEmits<{ (event: 'navigate', route: any): void }>();

interface AlertRow {
  key: string; id: number; name: string; label: string; service: string; serviceId: string; source: string;
  level: string; count: number; text: string; enabled: boolean; interval: number; hosts: string[];
}

const status = ref('');
const service = ref('');
const stateFilter = ref('');
const filter = ref('');
const open = ref<AlertRow | null>(null);
const dtab = ref('summary');
const interval = ref(1);
const toggling = ref<AlertRow | null>(null);
const ctx = ref<{ x: number; y: number; items: AmbMenuItem[] } | null>(null);
const cluster = computed(() => String(pick(props.view, 'ambari.api.cluster', pick(props.view, 'cluster', 'cluster'))));

// Older replicas send no definitions: fall back to the alerts with a static list.
const LEGACY: [string, string, string][] = [
  ['HDFS', 'NameNode Web UI', 'WEB'], ['HDFS', 'DataNode Health Summary', 'AGGREGATE'],
  ['HDFS', 'HDFS Capacity Utilization', 'METRIC'], ['YARN', 'ResourceManager Web UI', 'WEB'],
  ['Hive', 'HiveServer2 Process', 'SCRIPT'], ['Spark2', 'Spark2 History Server', 'PORT'],
  ['ZooKeeper', 'ZooKeeper Server Process', 'PORT'],
];

const all = computed<AlertRow[]>(() => {
  const defs = rows(props.view, 'ambari.alert_definitions');
  let out: AlertRow[];
  if (defs.length) {
    out = defs.map(d => ({
      key: String(d.name), id: Number(d.id || 0), name: String(d.name), label: String(d.label || d.name),
      service: String(d.service), serviceId: String(d.service_id || ''), source: String(d.source || 'SCRIPT'),
      level: String(d.level || 'OK'), count: Number(d.count || 0), text: String(d.text || ''),
      enabled: d.enabled !== false, interval: Number(d.interval || 1), hosts: (d.hosts || []).map(String),
    }));
  } else {
    const live = rows(props.view, 'ambari.alerts');
    out = live.map((a, i) => ({
      key: 'live' + i, id: 0, name: String(a.definition || a.service), label: String(a.definition || `${a.service} Alert`),
      service: SERVICE_NAMES[String(a.service).toUpperCase()] || String(a.service), serviceId: '', source: 'SCRIPT',
      level: String(a.level), count: 1, text: String(a.text || ''), enabled: true, interval: 1, hosts: [],
    }));
    for (const [svc, label, source] of LEGACY) {
      if (out.some(o => o.label === label)) continue;
      out.push({ key: label, id: 0, name: label, label, service: svc, serviceId: '', source, level: 'OK', count: 0,
                 text: '', enabled: true, interval: 1, hosts: [] });
    }
  }
  const rank: Record<string, number> = { CRITICAL: 0, WARNING: 1, OK: 2, NONE: 3 };
  return out.sort((a, b) => (rank[a.level] ?? 3) - (rank[b.level] ?? 3) || a.label.localeCompare(b.label));
});
const services = computed(() => Array.from(new Set(all.value.map(a => a.service))));
const shown = computed(() => all.value.filter(a => (!status.value || a.level === status.value)
  && (!service.value || a.service === service.value)
  && (!stateFilter.value || (stateFilter.value === 'on') === a.enabled)
  && matches(a, filter.value, ['label', 'name', 'service', 'text'])));
const instanceRows = computed(() => (open.value && open.value.count ? (open.value.hosts.length ? open.value.hosts : ['master-1']) : []));
const intervalError = computed(() => (!Number.isInteger(interval.value) || interval.value < 1 || interval.value > 1440
  ? 'Enter a whole number of minutes between 1 and 1440' : ''));

function short(level: string) {
  return ({ CRITICAL: 'CRIT', WARNING: 'WARN', OK: 'OK', NONE: 'NONE' } as Record<string, string>)[level] || level;
}
function labelClass(level: string) {
  return ({ CRITICAL: 'label-crit', WARNING: 'label-warn', OK: 'label-ok' } as Record<string, string>)[level] || 'label-unknown';
}
function describe(row: AlertRow) {
  if (!row.enabled) return 'This alert definition is disabled: it is not checked and raises no alerts.';
  return row.text || `${row.label} is responding normally.`;
}
function goService(row: AlertRow) {
  const id = row.serviceId || Object.keys(SERVICE_NAMES).find(k => SERVICE_NAMES[k] === row.service) || row.service;
  emit('navigate', { page: 'service', id, tab: 'summary' });
}
function openDef(row: AlertRow) {
  open.value = row;
  dtab.value = 'summary';
  interval.value = row.interval;
}
function rowMenu(event: MouseEvent, row: AlertRow) {
  ctx.value = {
    x: event.clientX, y: event.clientY,
    items: [
      { header: true, label: row.label },
      { label: 'View', icon: 'info', run: () => openDef(row) },
      { label: row.enabled ? 'Disable' : 'Enable', icon: row.enabled ? 'stop' : 'play', disabled: !row.id,
        run: () => askToggle(row) },
      { sep: true },
      { label: `Go to ${row.service}`, icon: 'services', run: () => goService(row) },
    ],
  };
}
function askToggle(row: AlertRow) {
  if (!row.id || props.busy) return;
  toggling.value = row;
}
async function toggle() {
  const row = toggling.value;
  if (!row || !props.api) return;
  const result = await props.api.exec(alertDefinitionCommand(cluster.value, row.id, { enabled: !row.enabled }),
                                      { success: `${row.label}: ${row.enabled ? 'disabled' : 'enabled'}`,
                                        failure: 'The alert definition could not be updated' });
  if (result.ok) {
    toggling.value = null;
    if (open.value) open.value = all.value.find(a => a.name === row.name) || null;
  }
}
async function saveInterval() {
  const row = open.value;
  if (!row || !props.api || intervalError.value) return;
  const result = await props.api.exec(alertDefinitionCommand(cluster.value, row.id, { interval: interval.value }),
                                      { success: `${row.label}: check interval set to ${interval.value} minute(s)`,
                                        failure: 'The alert definition could not be updated' });
  if (result.ok) open.value = all.value.find(a => a.name === row.name) || null;
}
</script>

<style scoped>
.toolbar .form-control.alerts__select { width: 150px; flex: 0 1 150px; min-width: 0; }
.toolbar .form-control.alerts__filter { max-width: 300px; flex: 1 1 200px; min-width: 0; }
@container sl-portal (max-width: 620px) {
  .toolbar .form-control.alerts__select { flex: 1 1 120px; width: auto; }
  .toolbar .form-control.alerts__filter { max-width: none; flex-basis: 100%; }
  .toolbar .spacer { display: none; }
}
.alerts__text { font-size: 12px; color: #a94442; margin-top: 3px; }
.alerts__off td { color: #888; }
.alerts__kv th { width: 30%; font-weight: 400; color: #666; border-bottom: 0; border-top: 1px solid #ddd; }
.alerts__interval { display: flex; align-items: center; gap: 8px; }
.alerts__interval .form-control { width: 110px; }
.alerts__err { color: #a94442; }
.is-busy { pointer-events: none; opacity: .6; }
</style>
