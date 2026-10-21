<template>
  <div class="svc">
    <div class="svc__head">
      <ul class="nav-tabs svc__tabs">
        <li :class="{ active: tab === 'summary' }"><a href="#" @click.prevent="nav('summary')">Summary</a></li>
        <li :class="{ active: tab === 'configs' }"><a href="#" @click.prevent="nav('configs')">Configs</a></li>
        <li :class="{ active: tab === 'metrics' }"><a href="#" @click.prevent="nav('metrics')">Metrics</a></li>
      </ul>
      <div class="svc__actions">
        <div class="amb-dd">
          <button type="button" class="btn btn-default svc__qlinks" @click.stop="menu = menu === 'links' ? '' : 'links'">
            Quick Links <AmbIcon name="caret" :size="11" />
          </button>
          <ul v-if="menu === 'links'" class="amb-dd__menu is-right" @click="menu = ''">
            <li v-for="link in quickLinks" :key="link.label">
              <a href="#" @click.prevent="openLink(link)"><AmbIcon name="external" :size="12" />{{ link.label }}</a>
            </li>
          </ul>
        </div>
        <div class="amb-dd">
          <button type="button" class="btn btn-success" :disabled="busy" @click.stop="menu = menu === 'actions' ? '' : 'actions'">
            Actions <AmbIcon name="caret" :size="11" />
          </button>
          <ul v-if="menu === 'actions'" class="amb-dd__menu is-right" @click="menu = ''">
            <li><a href="#" :class="{ 'is-disabled': started }" @click.prevent="ask('start')"><AmbIcon name="play" :size="12" />Start</a></li>
            <li><a href="#" :class="{ 'is-disabled': !started }" @click.prevent="ask('stop')"><AmbIcon name="stop" :size="12" />Stop</a></li>
            <li><a href="#" @click.prevent="ask('restart')"><AmbIcon name="refresh" :size="12" />Restart All</a></li>
            <li class="amb-dd__sep"></li>
            <li><a href="#" @click.prevent="ask('check')"><AmbIcon name="wrench" :size="12" />Run Service Check</a></li>
            <li><a href="#" @click.prevent="ask('maint')"><AmbIcon name="maint" :size="12" />
              Turn {{ maint ? 'Off' : 'On' }} Maintenance Mode</a></li>
            <li class="amb-dd__sep"></li>
            <li><a href="#" @click.prevent="downloadConfigs"><AmbIcon name="download" :size="12" />Download Client Configs</a></li>
          </ul>
        </div>
      </div>
    </div>

    <div v-if="svc.stale_configs" class="alert alert-warning svc__restart">
      <AmbIcon name="restart-ind" :size="14" />
      <span><strong>Restart Required:</strong> {{ restartCount }} Components on {{ hostCount }} Hosts</span>
      <button type="button" class="btn btn-default btn-sm" :disabled="busy" @click="ask('restart')">Restart All Affected</button>
    </div>
    <div v-if="maint" class="alert alert-info">This service is in Maintenance Mode: its alerts are suppressed.</div>

    <!-- SUMMARY -->
    <div v-if="tab === 'summary'" class="svc__summary">
      <div class="panel svc__components">
        <div class="panel-heading"><h4>Components</h4></div>
        <div class="table-wrap">
          <table class="table">
            <tbody>
              <tr v-for="comp in components" :key="comp.name" @contextmenu.prevent="compMenu($event, comp)">
                <td class="svc__status">
                  <AmbIcon v-if="comp.category !== 'CLIENT'" :name="comp.started === comp.total ? 'ok' : 'down'"
                           :class="comp.started === comp.total ? 'health-ok' : 'health-down'" />
                </td>
                <td>{{ comp.display }}</td>
                <td>
                  <template v-if="comp.category === 'CLIENT'">{{ comp.total }} {{ comp.display }}s Installed</template>
                  <template v-else-if="comp.category === 'MASTER' && comp.total === 1">{{ comp.started ? 'Started' : 'Stopped' }}</template>
                  <template v-else>{{ comp.started }}/{{ comp.total }} Started</template>
                </td>
                <td class="svc__hosts">
                  <a v-if="comp.total === 1" href="#" @click.prevent="$emit('navigate', { page: 'host', id: comp.hosts[0] })">{{ comp.hosts[0] }}.lab.internal</a>
                  <a v-else href="#" @click.prevent="$emit('navigate', { page: 'hosts' })">{{ comp.total }} hosts</a>
                </td>
                <td class="svc__rowact">
                  <button v-if="comp.category !== 'CLIENT'" type="button" class="svc__kebab" :disabled="busy"
                          :aria-label="`${comp.display} actions`" title="Actions" @click.stop="compMenu($event, comp)">
                    <AmbIcon name="gear" :size="13" /><AmbIcon name="caret" :size="10" />
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
          <table class="table svc__kv">
            <tbody>
              <tr v-for="row in summaryRows" :key="row[0]"><th>{{ row[0] }}</th><td>{{ row[1] }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- CONFIGS -->
    <div v-else-if="tab === 'configs'" class="cfg">
      <div class="cfg__versions">
        <div v-for="v in versions" :key="v.version" class="cfg__version"
             :class="{ 'is-current': v.current, 'is-viewing': viewingNumber === v.version }">
          <button type="button" class="cfg__vbtn" :title="`View V${v.version}`" @click="viewVersion(v.version)">
            <strong>V{{ v.version }}</strong>
            <span>{{ v.user }} · {{ v.at }}</span>
            <span class="cfg__note" :title="v.note">{{ v.note || 'No notes' }}</span>
          </button>
          <div class="cfg__vfoot">
            <span v-if="v.current" class="label label-ok">Current</span>
            <template v-else>
              <a href="#" @click.prevent="compareWith(v.version)">Compare</a>
              <a href="#" @click.prevent="askRevert(v.version)">Make Current</a>
            </template>
          </div>
        </div>
      </div>
      <div v-if="viewing && !viewing.current" class="alert alert-info cfg__viewing">
        <AmbIcon name="info" :size="14" />
        <span>Viewing <strong>V{{ viewing.version }}</strong> ({{ viewing.note || 'no notes' }}), saved by
          {{ viewing.user }} on {{ viewing.at }}. Properties are read-only.</span>
        <button type="button" class="btn btn-default btn-sm" @click="compareWith(viewing.version)">Compare</button>
        <button type="button" class="btn btn-success btn-sm" :disabled="busy" @click="askRevert(viewing.version)">Make V{{ viewing.version }} Current</button>
        <button type="button" class="btn btn-link btn-sm" @click="viewingNumber = null">Back to current</button>
      </div>
      <div class="cfg__bar">
        <input v-model="filter" class="form-control cfg__filter" placeholder="Filter..." aria-label="Filter properties" />
        <label class="cfg__only"><input v-model="onlyChanged" type="checkbox" /> Changed properties only</label>
        <span class="spacer"></span>
        <button type="button" class="btn btn-default" :disabled="!dirty || busy || readOnly" @click="discard">Discard</button>
        <button type="button" class="btn btn-success" :disabled="!dirty || busy || hasErrors || readOnly" @click="saving = true">Save</button>
      </div>
      <div v-for="type in types" :key="type" class="panel">
        <button type="button" class="panel-heading cfg__head" @click="toggle(type)">
          <AmbIcon :name="open[type] === false ? 'chev-right' : 'caret'" :size="12" />
          <h4>Advanced {{ type }}</h4>
          <span v-if="changedIn(type)" class="label label-warn">{{ changedIn(type) }} changed</span>
        </button>
        <div v-if="open[type] !== false" class="panel-body cfg__props">
          <div v-for="key in keysOf(type)" :key="key" class="cfg__row"
               :class="{ 'has-error': errorFor(type, key), 'is-changed': edits[type]?.[key] !== undefined }">
            <label class="cfg__key" :for="`cfg-${type}-${key}`">{{ key }}</label>
            <div class="cfg__val">
              <input :id="`cfg-${type}-${key}`" class="form-control" :value="shownValue(type, key)"
                     :readonly="readOnly" :class="{ 'is-ro': readOnly }"
                     @input="edit(type, key, ($event.target as HTMLInputElement).value)" />
              <span v-if="!readOnly && differsFromStock(type, key)" class="cfg__stock" :title="`Default: ${stockValue(type, key)}`">
                Default: {{ stockValue(type, key) || '(empty)' }}</span>
              <span v-if="errorFor(type, key)" class="help-block">{{ errorFor(type, key) }}</span>
            </div>
            <button v-if="!readOnly && edits[type]?.[key] !== undefined" type="button" class="btn btn-link" title="Undo"
                    @click="undo(type, key)"><AmbIcon name="refresh" :size="12" /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- METRICS -->
    <div v-else class="svc__metrics">
      <div v-for="chart in charts" :key="chart.title" class="panel svc__chart">
        <div class="panel-heading"><h4>{{ chart.title }}</h4></div>
        <div class="panel-body"><div class="svc__plot"><AmbChart :series="chart.series" /></div></div>
      </div>
    </div>

    <AmbModal v-if="confirm" :title="confirmTitle" :ok-text="confirmOk" :danger="confirm === 'stop'" :busy="busy"
              @close="confirm = ''" @ok="perform">
      <p>{{ confirmText }}</p>
      <div v-if="confirm === 'stop' && svc.id === 'HDFS'" class="alert alert-warning">
        Stopping HDFS makes Hive, Spark2 and YARN applications that read HDFS fail until it is started again.
      </div>
    </AmbModal>

    <AmbModal v-if="saving" title="Save Configuration" ok-text="Save" :busy="busy" @close="saving = false" @ok="save">
      <div class="form-group">
        <label for="cfg-notes">Notes</label>
        <textarea id="cfg-notes" v-model="notes" class="form-control" rows="3" placeholder="What did you change?"></textarea>
      </div>
      <p class="text-muted">{{ changeCount }} propert{{ changeCount === 1 ? 'y' : 'ies' }} will change in
        {{ changedTypes.join(', ') }}. Affected components need a restart.</p>
    </AmbModal>

    <!-- A component across its hosts: Start / Stop / Restart. -->
    <AmbModal v-if="compAsk" title="Confirmation" :ok-text="compAsk.verb" :danger="compAsk.verb === 'Stop'"
              :busy="busy" @close="compAsk = null" @ok="performComp">
      <p>You are about to {{ compAsk.verb.toLowerCase() }} {{ compAsk.label }}. Are you sure?</p>
      <div v-if="compAsk.verb === 'Stop' && compAsk.key" class="alert alert-warning">
        {{ compAsk.label }} is what clients of {{ display }} connect to: they will fail until it is started again.
      </div>
    </AmbModal>

    <!-- Compare two service config versions. -->
    <AmbModal v-if="comparing" :title="`Compare V${comparing.left.version} with V${comparing.right.version}`"
              ok-text="" cancel-text="Close" wide @close="comparing = null">
      <p class="text-muted">V{{ comparing.left.version }}: {{ comparing.left.note || 'no notes' }} ·
        V{{ comparing.right.version }}: {{ comparing.right.note || 'no notes' }}</p>
      <div v-if="!compareRows.length" class="alert alert-success">The two versions have identical properties.</div>
      <div v-else class="table-wrap">
        <table class="table cfg__diff">
          <thead><tr><th>Config type</th><th>Property</th><th>V{{ comparing.left.version }}</th><th>V{{ comparing.right.version }}</th></tr></thead>
          <tbody>
            <tr v-for="row in compareRows" :key="row.type + row.key">
              <td>{{ row.type }}</td><td class="mono">{{ row.key }}</td>
              <td class="mono cfg__old">{{ row.left ?? '(not set)' }}</td>
              <td class="mono cfg__new">{{ row.right ?? '(not set)' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <button type="button" class="btn btn-default" @click="comparing = null">Close</button>
        <button v-if="!comparing.left.current" type="button" class="btn btn-success" :disabled="busy"
                @click="askRevert(comparing.left.version); comparing = null">Make V{{ comparing.left.version }} Current</button>
      </template>
    </AmbModal>

    <!-- Make Current -->
    <AmbModal v-if="reverting" title="Make Current Confirmation" ok-text="Make Current" :busy="busy"
              @close="reverting = null" @ok="revert">
      <p>Are you sure you want to make <strong>V{{ reverting.version }}</strong> the current configuration of
        {{ display }}? A new version is created from it; affected components need a restart.</p>
      <div class="form-group">
        <label for="cfg-revert-notes">Notes</label>
        <textarea id="cfg-revert-notes" v-model="revertNotes" class="form-control" rows="2"></textarea>
      </div>
    </AmbModal>

    <AmbContextMenu v-if="ctx" :x="ctx.x" :y="ctx.y" :items="ctx.items" @close="ctx = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import { pick, rows } from '@/utils/portalKit';
import {
  componentStateCommand, configCommand, maintenanceCommand, requestCommand, restartComponentsCommand,
  revertConfigCommand, serviceStateCommand, SERVICE_NAMES, shortStamp, uptime, type AmbMenuItem,
} from './ambari';
import AmbChart from './AmbChart.vue';
import AmbContextMenu from './AmbContextMenu.vue';
import AmbIcon from './AmbIcon.vue';
import AmbModal from './AmbModal.vue';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; serviceId: string; tab: string }>();
const emit = defineEmits<{ (event: 'navigate', route: any): void }>();

const menu = ref('');
const confirm = ref('');
const saving = ref(false);
const notes = ref('');
const filter = ref('');
const edits = reactive<Record<string, Record<string, string>>>({});
const open = reactive<Record<string, boolean>>({});

const cluster = computed(() => String(pick(props.view, 'cluster', 'cluster')));
const svc = computed<Record<string, any>>(() =>
  rows(props.view, 'ambari.cluster_services').find(s => s.id === props.serviceId)
  || { id: props.serviceId, display: SERVICE_NAMES[props.serviceId], state: 'STARTED', components: [] });
const display = computed(() => svc.value.display || props.serviceId);
const started = computed(() => svc.value.state === 'STARTED');
const maint = computed(() => svc.value.maintenance === 'ON');
const components = computed(() => rows(svc.value, 'components'));
const restartCount = computed(() => components.value.filter(c => c.category !== 'CLIENT')
  .reduce((n, c) => n + Number(c.total || 0), 0));
const hostCount = computed(() => new Set(components.value.flatMap(c => c.hosts || [])).size);

function nav(tab: string) {
  emit('navigate', { page: 'service', id: props.serviceId, tab });
}

// ---- actions ----
const confirmTitle = computed(() => confirm.value === 'maint'
  ? `Turn ${maint.value ? 'Off' : 'On'} Maintenance Mode for ${display.value}` : 'Confirmation');
const confirmOk = computed(() => confirm.value === 'check' ? 'OK' : 'Confirm');
const confirmText = computed(() => ({
  start: `You are about to start ${display.value}. Are you sure?`,
  stop: `You are about to stop ${display.value}. Are you sure?`,
  restart: `You are about to restart all components of ${display.value}. Are you sure?`,
  check: `${display.value} service check will be run. Are you sure?`,
  maint: maint.value
    ? `Are you sure you want to turn off Maintenance Mode for ${display.value}? Alerts for it will be shown again.`
    : `Are you sure you want to turn on Maintenance Mode for ${display.value}? Alerts for ${display.value} will be suppressed.`,
} as Record<string, string>)[confirm.value] || '');

function ask(kind: string) {
  menu.value = '';
  confirm.value = kind;
}

async function perform() {
  const kind = confirm.value;
  const id = props.serviceId;
  let command = '';
  let success = '';
  if (kind === 'start') {
    command = serviceStateCommand(cluster.value, id, 'STARTED', `Start ${display.value}`);
    success = `Start ${display.value}: completed`;
  } else if (kind === 'stop') {
    command = serviceStateCommand(cluster.value, id, 'INSTALLED', `Stop ${display.value}`);
    success = `Stop ${display.value}: completed`;
  } else if (kind === 'restart') {
    command = requestCommand(cluster.value, id, 'RESTART', `Restart all components for ${display.value}`);
    success = `Restart all components for ${display.value}: completed`;
  } else if (kind === 'check') {
    command = requestCommand(cluster.value, id, String(svc.value.service_check || `${id}_SERVICE_CHECK`),
                             `${display.value} Service Check`);
    success = `${display.value} Service Check: submitted`;
  } else if (kind === 'maint') {
    command = maintenanceCommand(cluster.value, id, !maint.value);
    success = `Maintenance Mode turned ${maint.value ? 'off' : 'on'} for ${display.value}`;
  }
  const result = await props.api.exec(command, { success, failure: 'Ambari could not complete the request' });
  if (result.ok) confirm.value = '';
}

function downloadConfigs() {
  menu.value = '';
  const lines: string[] = [];
  for (const type of types.value) {
    lines.push(`# ${type}`);
    for (const key of keysOf(type)) lines.push(`${key}=${valueOf(type, key)}`);
    lines.push('');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.serviceId}_CLIENT-configs.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- quick links ----
const quickLinks = computed(() => ({
  HDFS: [{ label: 'NameNode UI', url: 'http://namenode.lab.internal:9870' },
         { label: 'NameNode Logs', url: 'http://namenode.lab.internal:9870/logs' },
         { label: 'NameNode JMX', url: 'http://namenode.lab.internal:9870/jmx' }],
  YARN: [{ label: 'ResourceManager UI', url: 'rm' }, { label: 'ResourceManager logs', url: 'rm' }],
  MAPREDUCE2: [{ label: 'JobHistory UI', url: 'rm' }],
  HIVE: [{ label: 'Hive View 2.0', url: 'hive' }],
  SPARK2: [{ label: 'Spark2 History Server UI', url: 'http://spark-history.lab.internal:18081' }],
  ZOOKEEPER: [{ label: 'ZooKeeper Server', url: 'http://master-1.lab.internal:2181' }],
} as Record<string, { label: string; url: string }[]>)[props.serviceId] || []);

function openLink(link: { label: string; url: string }) {
  if (link.url === 'rm') emit('navigate', { page: 'rm' });
  else if (link.url === 'hive') emit('navigate', { page: 'hive', tab: 'query' });
  else props.api.notify('info', `${link.label}`, `${link.url} — open the matching tool in this lab's tool bar.`);
}

// ---- summary ----
function compRow(name: string) {
  return components.value.find(c => c.name === name);
}
function upCount(name: string): number {
  const row = compRow(name);
  if (!row) return started.value ? 1 : 0;
  return Number(row.started || 0);
}
function compText(name: string): string {
  const row = compRow(name);
  if (!row) return started.value ? 'Started' : 'Stopped';
  if (Number(row.total) === 1) return row.started ? 'Started' : 'Stopped';
  return `${row.started}/${row.total} Started`;
}
const summaryRows = computed<[string, string][]>(() => {
  const nn = pick<Record<string, any>>(props.view, 'namenode', {});
  const yarn = pick<Record<string, any>>(props.view, 'yarn', {});
  const hive = pick<Record<string, any>>(props.view, 'hive', {});
  const m = pick<Record<string, any>>(props.view, 'ambari.metrics', {});
  const dn = rows(props.view, 'datanodes').length;
  const on = started.value;
  switch (props.serviceId) {
    case 'HDFS':
      return [
        ['NameNode', compText('NAMENODE')], ['SNameNode', compText('SECONDARY_NAMENODE')],
        ['DataNodes', compText('DATANODE')],
        ['DataNodes Status', `${upCount('DATANODE')} live / ${dn - upCount('DATANODE')} dead / 0 decommissioning`],
        ['NameNode Uptime', upCount('NAMENODE') ? uptime(m.uptime_s || 0) : 'Not Running'],
        ['NameNode Heap', `${Number(m.namenode_heap_used_mb || 0).toFixed(0)} MB / ${m.namenode_heap_max_mb || 1024} MB`],
        ['Disk Usage (DFS Used)', `${nn.used_h || '0B'} / ${nn.capacity_h || '0B'} (${nn.used_percent || 0}%)`],
        ['Disk Remaining', `${nn.remaining_h || '0B'} / ${nn.capacity_h || '0B'}`],
        ['Blocks (total)', String(nn.blocks ?? 0)],
        ['Block Errors', '0 corrupt replica / 0 missing / 0 under replicated'],
        ['Total Files + Directories', String((nn.files || 0) + (nn.dirs || 0))],
        ['Upgrade Status', 'No pending upgrade'],
        ['Safe Mode Status', nn.safemode ? 'In safe mode' : 'Not in safe mode'],
      ];
    case 'YARN': {
      const apps = rows(yarn, 'apps');
      const count = (s: string) => apps.filter(a => a.state === s).length;
      return [
        ['ResourceManager', compText('RESOURCEMANAGER')],
        ['NodeManagers Status', `${upCount('NODEMANAGER')} active / ${dn - upCount('NODEMANAGER')} lost / 0 unhealthy / 0 rebooted / 0 decommissioned`],
        ['ResourceManager Uptime', upCount('RESOURCEMANAGER') ? uptime(m.uptime_s || 0) : 'Not Running'],
        ['Applications', `${apps.length} submitted / ${count('RUNNING')} running / 0 pending / ${count('FINISHED')} completed / ${count('KILLED')} killed / ${count('FAILED')} failed`],
        ['Cluster Memory', `${m.yarn_memory_used_mb || 0} MB used / ${m.yarn_memory_total_mb || 0} MB total`],
        ['Queues', `${rows(yarn, 'queues').length || 1} Queues`],
      ];
    }
    case 'HIVE':
      return [
        ['HiveServer2', compText('HIVE_SERVER')], ['Hive Metastore', compText('HIVE_METASTORE')],
        ['Databases', String(pick<string[]>(hive, 'databases', []).length)],
        ['Tables', String(rows(hive, 'tables').length)],
        ['HiveServer2 JDBC URL', 'jdbc:hive2://hiveserver.lab.internal:10000/default'],
      ];
    case 'SPARK2':
      return [
        ['Spark2 History Server', compText('SPARK2_JOBHISTORYSERVER')], ['Spark2 Thrift Server', compText('SPARK2_THRIFTSERVER')],
        ['Applications in history', String(rows(props.view, 'spark.applications').length)],
        ['Jobs in history', String(rows(props.view, 'spark.jobs').length)],
      ];
    case 'MAPREDUCE2':
      return [
        ['History Server', compText('HISTORYSERVER')],
        ['MapReduce jobs', String(rows(props.view, 'spark.jobs').filter(j => j.engine === 'mapreduce').length)],
      ];
    default:
      return [['ZooKeeper Servers', compText('ZOOKEEPER_SERVER')], ['Quorum', upCount('ZOOKEEPER_SERVER') >= 2 ? 'OK' : 'Lost']];
  }
});

// ---- configs ----
const configs = computed(() => pick<Record<string, any>>(props.view, 'ambari.configs', {}));
const types = computed(() => Object.keys(configs.value).filter(t => configs.value[t]?.service === props.serviceId));

function keysOf(type: string) {
  const keys = Object.keys(pick<Record<string, string>>(configs.value, `${type}.properties`, {}));
  const needle = filter.value.trim().toLowerCase();
  const shown = onlyChanged.value ? keys.filter(k => differsFromStock(type, k)) : keys;
  return needle ? shown.filter(k => k.toLowerCase().includes(needle)
    || String(shownValue(type, k)).toLowerCase().includes(needle)) : shown;
}
function stored(type: string, key: string) {
  return String(pick<Record<string, string>>(configs.value, `${type}.properties`, {})[key] ?? '');
}
function valueOf(type: string, key: string) {
  return edits[type]?.[key] ?? stored(type, key);
}
function edit(type: string, key: string, value: string) {
  if (!edits[type]) edits[type] = {};
  if (value === stored(type, key)) delete edits[type][key];
  else edits[type][key] = value;
}
function undo(type: string, key: string) {
  if (edits[type]) delete edits[type][key];
}
function toggle(type: string) {
  open[type] = open[type] === false;
}
function changedIn(type: string) {
  return Object.keys(edits[type] || {}).length;
}
const changedTypes = computed(() => types.value.filter(t => changedIn(t)));
const changeCount = computed(() => changedTypes.value.reduce((n, t) => n + changedIn(t), 0));
const dirty = computed(() => changeCount.value > 0);

const NUMERIC = /^-?\d+(\.\d+)?$/;
function errorFor(type: string, key: string) {
  const value = edits[type]?.[key];
  if (value === undefined) return '';
  if (!value.trim()) return 'This is required';
  if (NUMERIC.test(stored(type, key)) && !NUMERIC.test(value.trim())) return 'Must contain digits only';
  if (key === 'dfs.replication' && (Number(value) < 1 || Number(value) > 512)) return 'Value should be between 1 and 512';
  if (['true', 'false'].includes(stored(type, key)) && !['true', 'false'].includes(value.trim())) return 'Must be true or false';
  return '';
}
const hasErrors = computed(() => types.value.some(t => Object.keys(edits[t] || {}).some(k => errorFor(t, k))));

function discard() {
  for (const t of Object.keys(edits)) delete edits[t];
}

async function save() {
  for (const type of changedTypes.value) {
    const properties: Record<string, string> = {};
    for (const key of Object.keys(pick<Record<string, string>>(configs.value, `${type}.properties`, {}))) {
      properties[key] = valueOf(type, key).trim();
    }
    const result = await props.api.exec(configCommand(cluster.value, type, properties, notes.value.trim()),
                                        { success: `Saved ${type}`, failure: 'Configuration could not be saved' });
    if (!result.ok) return;
    delete edits[type];
  }
  saving.value = false;
  notes.value = '';
}

interface CfgVersion {
  version: number; user: string; at: string; note: string; current: boolean;
  snapshot: Record<string, Record<string, string>> | null;
}
const versions = computed<CfgVersion[]>(() => {
  const full = rows(props.view, `ambari.config_versions.${props.serviceId}`);
  if (full.length) {
    return full.map(v => ({ version: Number(v.version), user: String(v.user || 'admin'), at: shortStamp(v.at) || 'Initial',
                            note: String(v.note || ''), current: !!v.current, snapshot: v.snapshot || null }));
  }
  // A replica a release behind sends only the history list, without snapshots.
  const list = rows(props.view, 'ambari.config_history').filter(h => h.service === props.serviceId);
  const out: CfgVersion[] = list.map((h, i) => ({ version: h.version, user: h.user, at: shortStamp(h.at), note: h.note,
                                                  current: i === 0, snapshot: null }));
  out.push({ version: 1, user: 'admin', at: 'Initial', note: `Initial configurations for ${display.value}`,
             current: !list.length, snapshot: null });
  return out;
});
const viewingNumber = ref<number | null>(null);
const viewing = computed(() => versions.value.find(v => v.version === viewingNumber.value) || null);
const readOnly = computed(() => !!viewing.value && !viewing.value.current);
const onlyChanged = ref(false);
const stock = computed(() => versions.value.find(v => v.version === 1)?.snapshot || null);

function viewVersion(version: number) {
  const target = versions.value.find(v => v.version === version);
  if (!target) return;
  if (target.current) { viewingNumber.value = null; return; }
  if (!target.snapshot) {
    props.api.notify('info', `V${version} cannot be displayed`, 'This replica has not sent version snapshots yet.');
    return;
  }
  if (dirty.value) {
    props.api.notify('warning', 'You have unsaved changes', 'Save or discard them before viewing another version.');
    return;
  }
  viewingNumber.value = version;
}
function shownValue(type: string, key: string) {
  if (readOnly.value) return String(viewing.value?.snapshot?.[type]?.[key] ?? '');
  return valueOf(type, key);
}
function stockValue(type: string, key: string) {
  return String(stock.value?.[type]?.[key] ?? '');
}
function differsFromStock(type: string, key: string) {
  return !!stock.value && stockValue(type, key) !== valueOf(type, key);
}

// Compare: the chosen version (left) against the current one (right).
const comparing = ref<{ left: CfgVersion; right: CfgVersion } | null>(null);
function compareWith(version: number) {
  const left = versions.value.find(v => v.version === version);
  const right = versions.value.find(v => v.current);
  if (!left || !right) return;
  if (!left.snapshot || !right.snapshot) {
    props.api.notify('info', 'Compare is not available', 'This replica has not sent version snapshots yet.');
    return;
  }
  comparing.value = { left, right };
}
const compareRows = computed(() => {
  const c = comparing.value;
  if (!c || !c.left.snapshot || !c.right.snapshot) return [];
  const out: { type: string; key: string; left: string | null; right: string | null }[] = [];
  const typeNames = Array.from(new Set([...Object.keys(c.left.snapshot), ...Object.keys(c.right.snapshot)])).sort();
  for (const type of typeNames) {
    const a = c.left.snapshot[type] || {};
    const b = c.right.snapshot[type] || {};
    for (const key of Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort()) {
      if (a[key] !== b[key]) out.push({ type, key, left: a[key] ?? null, right: b[key] ?? null });
    }
  }
  return out;
});

const reverting = ref<CfgVersion | null>(null);
const revertNotes = ref('');
function askRevert(version: number) {
  const target = versions.value.find(v => v.version === version);
  if (!target || target.current) return;
  revertNotes.value = `Created from service config version V${version}`;
  reverting.value = target;
}
async function revert() {
  const target = reverting.value;
  if (!target) return;
  const result = await props.api.exec(
    revertConfigCommand(cluster.value, props.serviceId, target.version, revertNotes.value.trim()),
    { success: `V${target.version} of ${display.value} is now current`, failure: 'The version could not be made current' });
  if (result.ok) {
    reverting.value = null;
    viewingNumber.value = null;
  }
}

// ---- components: the row actions menu ----
const ctx = ref<{ x: number; y: number; items: AmbMenuItem[] } | null>(null);
const compAsk = ref<{ verb: 'Start' | 'Stop' | 'Restart'; label: string; comp: Record<string, any>; key: boolean } | null>(null);
const KEY_COMPONENTS = ['NAMENODE', 'RESOURCEMANAGER', 'HIVE_SERVER', 'HIVE_METASTORE'];

function compMenu(event: MouseEvent, comp: Record<string, any>) {
  if (comp.category === 'CLIENT') return;
  const many = Number(comp.total || 0) > 1;
  const label = many ? `all ${comp.display}s` : comp.display;
  const allUp = Number(comp.started || 0) === Number(comp.total || 0);
  const allDown = Number(comp.started || 0) === 0;
  const items: AmbMenuItem[] = [
    { header: true, label: comp.display },
    { label: `Start ${label}`, icon: 'play', disabled: allUp, run: () => askComp('Start', comp, label) },
    { label: `Stop ${label}`, icon: 'stop', disabled: allDown, run: () => askComp('Stop', comp, label) },
    { label: `Restart ${label}`, icon: 'refresh', run: () => askComp('Restart', comp, label) },
    { sep: true },
  ];
  for (const host of (comp.hosts || []).slice(0, 6)) {
    items.push({ label: `Go to ${host}.lab.internal`, icon: 'hosts', run: () => emit('navigate', { page: 'host', id: host }) });
  }
  ctx.value = { x: event.clientX, y: event.clientY, items };
}
function askComp(verb: 'Start' | 'Stop' | 'Restart', comp: Record<string, any>, label: string) {
  compAsk.value = { verb, label, comp, key: KEY_COMPONENTS.includes(comp.name) };
}
async function performComp() {
  const ask = compAsk.value;
  if (!ask) return;
  const { comp } = ask;
  const context = `${ask.verb} ${ask.label}`;
  const command = ask.verb === 'Restart'
    ? restartComponentsCommand(cluster.value, props.serviceId, comp.name, comp.hosts || [], context)
    : componentStateCommand(cluster.value, props.serviceId, comp.name, ask.verb === 'Start' ? 'STARTED' : 'INSTALLED', context);
  const result = await props.api.exec(command, { success: `${context}: completed`, failure: 'Ambari could not complete the request' });
  if (result.ok) compAsk.value = null;
}

// ---- metrics ----
const charts = computed(() => {
  const activity: number[] = pick<number[]>(props.view, 'ambari.metrics.activity', []);
  const wave = (base: number, amp: number, seed: number) =>
    Array.from({ length: 12 }, (_, i) => Math.max(0, base + amp * 0.4 * Math.sin((i + seed) * 0.8) + (activity[i] || 0) * amp));
  const names: Record<string, string[]> = {
    HDFS: ['NameNode GC count', 'NameNode Host Load', 'NameNode RPC', 'Total Files'],
    YARN: ['Memory Utilization', 'CPU Utilization', 'Container Failures', 'Pending Apps'],
    HIVE: ['JVM Heap Memory', 'Open Connections', 'Query Rate'],
    SPARK2: ['Executor Memory', 'Active Applications'],
    MAPREDUCE2: ['JobHistory Heap', 'Jobs Completed'],
    ZOOKEEPER: ['Outstanding Requests', 'Avg Latency'],
  };
  return (names[props.serviceId] || []).map((title, i) => ({
    title, series: started.value ? [wave(2 + i, 1.5, i * 2)] : [Array(12).fill(0)],
  }));
});
</script>

<style scoped>
.svc__head { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid #ddd; margin-bottom: 18px; }
.svc__head .svc__tabs.nav-tabs, .svc .svc__tabs.nav-tabs { flex: 1 1 auto; min-width: 0; margin: 0; border-bottom: 0; }
.svc__actions { display: flex; gap: 8px; padding-bottom: 8px; margin-left: auto; }
.svc__restart { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.svc__restart span { flex: 1; }
.svc__summary { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
.svc__status { width: 24px; }
.svc__hosts { white-space: nowrap; }
.svc__kv th { width: 45%; font-weight: 400; color: #666; border-bottom: 0; border-top: 1px solid #ddd; white-space: normal; }
.svc__metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 16px; }
.svc__chart { margin: 0; }
.svc__plot { height: 140px; }
.cfg__versions { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 16px; }
.cfg__version {
  flex: 0 0 200px; background: #fff; border: 1px solid #ddd; padding: 8px 10px; display: flex; flex-direction: column;
  gap: 2px; font-size: 12px; color: #666;
}
.cfg__version strong { color: #333; font-size: 14px; }
.cfg__version.is-viewing { border-color: #1491c1; box-shadow: inset 0 3px 0 #1491c1; }
.cfg__vbtn { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; background: none; border: 0; padding: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; min-width: 0; width: 100%; }
.cfg__vfoot { display: flex; gap: 10px; align-items: center; margin-top: 4px; min-height: 18px; }
.cfg__viewing { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cfg__viewing span { flex: 1 1 260px; }
.cfg__only { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #555; white-space: nowrap; }
.cfg__stock { display: block; margin-top: 3px; font-size: 11px; color: #8a6d3b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.form-control.is-ro { background: #f5f5f5; color: #555; }
.cfg__diff td { word-break: break-all; white-space: normal; }
.cfg__old { background: #fdecea; }
.cfg__new { background: #e6f4e3; }
.svc__rowact { width: 48px; text-align: right; }
.svc__kebab { display: inline-flex; align-items: center; gap: 2px; border: 1px solid #ccc; background: #fff; border-radius: 3px; padding: 3px 6px; color: #666; cursor: pointer; }
.svc__kebab:hover:not(:disabled) { background: #f5f5f5; color: #333; }
.cfg__version.is-current { border-color: #3FAE2A; box-shadow: inset 0 3px 0 #3FAE2A; }
.cfg__note { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cfg__bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; position: sticky; top: -20px; background: #f0f0f0; padding: 6px 0; z-index: 2; }
.cfg__bar .spacer { flex: 1; }
.cfg__filter { max-width: 280px; min-width: 0; flex: 1 1 160px; }
.cfg__head { width: 100%; background: none; border: 0; border-bottom: 1px solid #eee; cursor: pointer; text-align: left; font: inherit; }
.cfg__props { display: flex; flex-direction: column; gap: 10px; }
.cfg__row { display: grid; grid-template-columns: minmax(180px, 38%) minmax(0, 1fr) 30px; gap: 12px; align-items: start; }
.cfg__key { font-size: 13px; color: #333; padding-top: 7px; word-break: break-all; }
.cfg__row.is-changed .form-control { border-color: #e98a41; }
@container sl-portal (max-width: 760px) {
  .svc__summary { grid-template-columns: minmax(0, 1fr); }
  .cfg__row { grid-template-columns: minmax(0, 1fr) 30px; }
  .cfg__key { grid-column: 1 / -1; padding: 0; }
}
@container sl-portal (max-width: 720px) {
  .svc__head { align-items: stretch; border-bottom: 0; row-gap: 0; }
  .svc .svc__tabs.nav-tabs { flex-basis: 100%; border-bottom: 1px solid #ddd; }
  .svc__actions { padding: 10px 0 0; }
  .cfg__bar { top: -12px; flex-wrap: wrap; }
  .cfg__filter { max-width: none; flex-basis: 100%; }
  .cfg__version { flex-basis: 170px; }
}
</style>
