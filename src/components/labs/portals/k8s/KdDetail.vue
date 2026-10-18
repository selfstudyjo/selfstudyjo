<template>
  <div class="kd-detail">
    <section class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Metadata</h2></header>
      <div class="kd-props">
        <div class="kd-prop"><span class="kd-prop__k">Name</span><span class="kd-prop__v">{{ row.name }}</span></div>
        <div v-if="def.namespaced" class="kd-prop"><span class="kd-prop__k">Namespace</span>
          <span class="kd-prop__v"><a href="#" class="kd-link" @click.prevent="openNamespace">{{ row.namespace }}</a></span></div>
        <div class="kd-prop"><span class="kd-prop__k">Created</span><span class="kd-prop__v">{{ formatDate(row.createdAt) }}</span></div>
        <div class="kd-prop"><span class="kd-prop__k">Age</span><span class="kd-prop__v">{{ row.age }}</span></div>
        <div v-if="row.uid" class="kd-prop"><span class="kd-prop__k">UID</span><span class="kd-prop__v kd-mono">{{ row.uid }}</span></div>
      </div>
      <div class="kd-props kd-props--block">
        <div class="kd-prop"><span class="kd-prop__k">Labels</span><KdChips :labels="row.labels" :limit="20" /></div>
        <div v-if="annotationPairs.length" class="kd-prop"><span class="kd-prop__k">Annotations</span><KdChips :labels="row.annotations" :limit="20" /></div>
      </div>
    </section>

    <section v-if="info.length" class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Resource information</h2></header>
      <div class="kd-props">
        <div v-for="[k, v] in info" :key="k" class="kd-prop"><span class="kd-prop__k">{{ k }}</span><span class="kd-prop__v">{{ v }}</span></div>
      </div>
      <div v-if="row.kind === 'Deployment' || row.kind === 'Service'" class="kd-props kd-props--block">
        <div class="kd-prop"><span class="kd-prop__k">Selector</span><KdChips :labels="row.selector" :limit="20" /></div>
      </div>
    </section>

    <section v-if="row.kind === 'Deployment'" class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Rolling update strategy</h2></header>
      <div class="kd-props">
        <div class="kd-prop"><span class="kd-prop__k">Max surge</span><span class="kd-prop__v">25%</span></div>
        <div class="kd-prop"><span class="kd-prop__k">Max unavailable</span><span class="kd-prop__v">25%</span></div>
      </div>
    </section>

    <section v-if="hasPodStatus" class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Pod status</h2></header>
      <div class="kd-props">
        <div class="kd-prop"><span class="kd-prop__k">Updated</span><span class="kd-prop__v">{{ row.desired ?? 0 }}</span></div>
        <div class="kd-prop"><span class="kd-prop__k">Total</span><span class="kd-prop__v">{{ (row.pods || []).length }}</span></div>
        <div class="kd-prop"><span class="kd-prop__k">Available</span><span class="kd-prop__v">{{ row.running ?? 0 }}</span></div>
      </div>
    </section>

    <section v-if="conditions.length" class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Conditions</h2></header>
      <div class="kd-table-wrap">
        <table class="kd-table">
          <thead><tr><th>Type</th><th>Status</th><th>Last probe time</th><th>Last transition time</th><th>Reason</th><th>Message</th></tr></thead>
          <tbody>
            <tr v-for="c in conditions" :key="c.type">
              <td>{{ c.type }}</td><td>{{ c.status }}</td><td>-</td><td>{{ row.age }}</td><td>{{ c.reason }}</td><td>{{ c.message }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="row.kind === 'Deployment'" class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Revision history</h2></header>
      <div class="kd-table-wrap">
        <table class="kd-table">
          <thead><tr><th>Revision</th><th>Replica Set</th><th>Images</th><th>Pods</th><th>Created</th><th /></tr></thead>
          <tbody>
            <tr v-for="rs in revisions" :key="rs.name">
              <td>{{ rs.revision }}<span v-if="rs.replicas > 0" class="kd-current"> (current)</span></td>
              <td><a href="#" class="kd-link" @click.prevent="openReplicaSet(rs.name)">{{ rs.name }}</a></td>
              <td class="kd-mono">{{ (rs.images || []).join(', ') }}</td>
              <td>{{ rs.replicas }}</td>
              <td>{{ rs.age }}</td>
              <td class="kd-right">
                <button v-if="rs.replicas === 0" type="button" class="kd-textbtn" @click="$emit('act', { type: 'rollback', row, revision: rs.revision })">Rollback</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <KdTable v-if="newReplicaSet.length" :def="rsDef" title="New Replica Set" :rows="newReplicaSet" :per-page="10"
             @open="r => $emit('open', rsDef, r)" @act="p => $emit('act', p, rsDef)" />
    <KdTable v-if="oldReplicaSets.length" :def="rsDef" title="Old Replica Sets" :rows="oldReplicaSets" :per-page="10"
             @open="r => $emit('open', rsDef, r)" @act="p => $emit('act', p, rsDef)" />

    <section v-if="row.kind === 'Service'" class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Endpoints</h2></header>
      <div v-if="!(row.endpoints || []).length" class="kd-card__empty">There is nothing to display here</div>
      <div v-else class="kd-table-wrap">
        <table class="kd-table">
          <thead><tr><th>Host</th><th>Ports (Name, Port, Protocol)</th><th>Node</th><th>Ready</th></tr></thead>
          <tbody>
            <tr v-for="ip in row.endpoints" :key="ip">
              <td>{{ ip }}</td>
              <td>{{ (row.ports || []).map((p: any) => `${p.name || '<unset>'}, ${p.targetPort ?? p.port}, ${p.protocol || 'TCP'}`).join('; ') }}</td>
              <td>{{ nodeOfIp(ip) }}</td><td>true</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="row.kind === 'ConfigMap'" class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Data</h2></header>
      <div v-if="!(row.keys || []).length" class="kd-card__empty">There is nothing to display here</div>
      <div v-for="k in row.keys" :key="k" class="kd-data">
        <div class="kd-data__k">{{ k }}</div>
        <pre class="kd-data__v">{{ (row.data || {})[k] }}</pre>
      </div>
    </section>

    <section v-if="row.kind === 'Secret'" class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Data</h2></header>
      <div v-if="!(row.keys || []).length" class="kd-card__empty">There is nothing to display here</div>
      <div v-for="k in row.keys" :key="k" class="kd-data">
        <div class="kd-data__k">
          <button type="button" class="kd-iconbtn kd-iconbtn--sm" :aria-label="`Show ${k}`" @click="reveal(k)"><KIcon name="eye" :size="18" /></button>
          {{ k }}
        </div>
        <pre class="kd-data__v">{{ revealed[k] !== undefined ? revealed[k] : `${(row.sizes || {})[k] ?? 0} bytes` }}</pre>
      </div>
    </section>

    <section v-if="row.kind === 'Pod'" class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Containers</h2></header>
      <div v-for="ctr in row.containers || []" :key="ctr.name" class="kd-container">
        <div class="kd-container__head">
          <KdStatus :health="row.status === 'Running' ? 'success' : row.status === 'Pending' ? 'pending' : 'error'" />
          <strong>{{ ctr.name }}</strong>
        </div>
        <div class="kd-props">
          <div class="kd-prop"><span class="kd-prop__k">Image</span><span class="kd-prop__v kd-mono">{{ ctr.image }}</span></div>
          <div class="kd-prop"><span class="kd-prop__k">Status</span><span class="kd-prop__v">{{ row.status }}</span></div>
          <div class="kd-prop"><span class="kd-prop__k">Environment variables</span>
            <span class="kd-prop__v">{{ (ctr.env || []).map((e: any) => `${e.name}: ${e.value ?? '(from ' + Object.keys(e.valueFrom || {})[0] + ')'}`).join(', ') || '-' }}</span></div>
        </div>
      </div>
    </section>

    <section v-if="row.kind === 'Pod' && row.owner" class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Controlled By</h2></header>
      <div class="kd-props">
        <div class="kd-prop"><span class="kd-prop__k">Kind</span><span class="kd-prop__v">{{ row.ownerKind || 'ReplicaSet' }}</span></div>
        <div class="kd-prop"><span class="kd-prop__k">Name</span>
          <span class="kd-prop__v"><a href="#" class="kd-link" @click.prevent="openOwner">{{ row.owner }}</a></span></div>
      </div>
    </section>

    <KdTable v-if="childPods.length" :def="podDef" title="Pods" :rows="childPods" :per-page="10"
             @open="r => $emit('open', podDef, r)" @act="p => $emit('act', p, podDef)" />

    <section class="kd-card">
      <header class="kd-card__head"><h2 class="kd-card__title">Events</h2></header>
      <div v-if="!events.length" class="kd-card__empty">There is nothing to display here</div>
      <div v-else class="kd-table-wrap">
        <table class="kd-table">
          <thead><tr><th>Message</th><th>Source</th><th>Sub-object</th><th>Count</th><th>First seen</th><th>Last seen</th></tr></thead>
          <tbody>
            <tr v-for="(e, i) in events" :key="i">
              <td><KdStatus :health="e.type === 'Warning' ? 'error' : 'success'" :title="e.type" /> {{ e.message }}</td>
              <td>{{ e.reason }}</td><td>-</td><td>1</td><td>{{ e.age }}</td><td>{{ e.age }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/** A resource's detail page: Metadata, Resource information, Conditions, the
 *  pods/replica sets it owns, kind-specific cards and its Events. */
import { computed, reactive, watch } from 'vue';
import { parseJson } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import KIcon from './KIcon.vue';
import KdChips from './KdChips.vue';
import KdStatus from './KdStatus.vue';
import KdTable from './KdTable.vue';
import { dash, eventsFor, findObject, formatDate, getYamlCommand, kindByKind, kindByRoute,
  labelPairs, type KindDef, type Row } from './k8s';

const props = defineProps<{ view: Record<string, any>; def: KindDef; row: Row; api: PortalApi }>();
const emit = defineEmits<{
  (e: 'open', def: KindDef, row: Row): void;
  (e: 'act', payload: { type: string; row: Row; revision?: number }, def?: KindDef): void;
}>();

const rsDef = kindByRoute('replicaset')!;
const podDef = kindByRoute('pod')!;
const nsDef = kindByRoute('namespace')!;
const revealed = reactive<Record<string, string>>({});
watch(() => props.row.name, () => { for (const k of Object.keys(revealed)) delete revealed[k]; });

const annotationPairs = computed(() => labelPairs(props.row.annotations));
const objects = computed<Row[]>(() => (dash(props.view).objects || []) as Row[]);

const info = computed<[string, string][]>(() => {
  const r = props.row;
  switch (r.kind) {
    case 'Deployment': return [['Strategy', r.strategy || 'RollingUpdate'], ['Min ready seconds', '0'],
      ['Revision history limit', '10'], ['Revision', String(r.revision ?? 1)]];
    case 'Pod': return [['Node', r.node || '-'], ['Status', r.status], ['IP', r.ip || '-'],
      ['QoS Class', 'BestEffort'], ['Restarts', String(r.restarts ?? 0)], ['Service Account', 'default'],
      ...(r.reason ? [['Reason', r.reason] as [string, string]] : [])];
    case 'Service': return [['Type', r.type], ['Cluster IP', r.clusterIP || '-'], ['Session Affinity', 'None'],
      ...(r.nodePort ? [['Node Port', String(r.nodePort)] as [string, string]] : [])];
    case 'ReplicaSet': case 'StatefulSet': case 'DaemonSet': return [['Images', (r.images || []).join(', ')],
      ['Desired', String(r.desired ?? 0)], ...(r.owner ? [['Controlled By', `Deployment/${r.owner}`] as [string, string]] : [])];
    case 'Job': return [['Completions', r.completions || '1/1'], ['Status', r.status || 'Complete']];
    case 'CronJob': return [['Schedule', r.schedule || '-'], ['Suspend', r.suspend ? 'true' : 'false'], ['Active', '0'],
      ['Concurrency policy', 'Allow'], ['Last schedule', '-']];
    case 'Namespace': return [['Status', r.status || 'Active']];
    case 'Node': return [['Addresses', `InternalIP: ${r.ip}`], ['Role', r.role], ['Kubelet version', r.version],
      ['OS image', r.os || '-'], ['Container runtime', r.runtime || '-'], ['CPU capacity (cores)', String(r.cpu)],
      ['Memory capacity (bytes)', String(r.memory)], ['Pods', String(r.pods ?? 0)], ['Unschedulable', 'false']];
    case 'PersistentVolumeClaim': return [['Status', r.status], ['Volume', r.volume || '-'], ['Capacity', r.capacity || '-'],
      ['Access modes', (r.accessModes || []).join(', ')], ['Storage class', r.storageClass || 'standard']];
    case 'PersistentVolume': return [['Status', r.status], ['Claim', r.claim], ['Capacity', r.capacity],
      ['Reclaim policy', r.reclaimPolicy], ['Storage class', r.storageClass]];
    case 'Secret': return [['Type', r.type || 'Opaque']];
    case 'Ingress': return [['Ingress Class', r.ingressClass || '-'], ['Hosts', (r.hosts || []).join(', ') || '*']];
    default: return [];
  }
});

const hasPodStatus = computed(() => ['Deployment', 'ReplicaSet', 'StatefulSet', 'DaemonSet'].includes(props.row.kind));

const conditions = computed(() => {
  const r = props.row;
  if (r.kind === 'Deployment') {
    const available = (r.running ?? 0) >= (r.desired ?? 0);
    const newest = (r.replicaSets || []).find((s: Row) => s.replicas > 0);
    return [
      { type: 'Available', status: available ? 'True' : 'False', reason: available ? 'MinimumReplicasAvailable' : 'MinimumReplicasUnavailable',
        message: available ? 'Deployment has minimum availability.' : 'Deployment does not have minimum availability.' },
      { type: 'Progressing', status: 'True', reason: 'NewReplicaSetAvailable',
        message: `ReplicaSet "${newest?.name || r.name}" has successfully progressed.` },
    ];
  }
  if (r.kind === 'Pod') {
    const running = r.status === 'Running';
    return [
      { type: 'Initialized', status: 'True', reason: '-', message: '-' },
      { type: 'Ready', status: running ? 'True' : 'False', reason: running ? '-' : 'ContainersNotReady', message: running ? '-' : 'containers with unready status' },
      { type: 'ContainersReady', status: running ? 'True' : 'False', reason: '-', message: '-' },
      { type: 'PodScheduled', status: r.status === 'Pending' ? 'False' : 'True', reason: r.status === 'Pending' ? 'Unschedulable' : '-',
        message: r.reason || '-' },
    ];
  }
  if (r.kind === 'Node') {
    return [
      { type: 'MemoryPressure', status: 'False', reason: 'KubeletHasSufficientMemory', message: 'kubelet has sufficient memory available' },
      { type: 'DiskPressure', status: 'False', reason: 'KubeletHasNoDiskPressure', message: 'kubelet has no disk pressure' },
      { type: 'PIDPressure', status: 'False', reason: 'KubeletHasSufficientPID', message: 'kubelet has sufficient PID available' },
      { type: 'Ready', status: r.status === 'Ready' ? 'True' : 'False', reason: 'KubeletReady', message: 'kubelet is posting ready status' },
    ];
  }
  return [];
});

const revisions = computed<Row[]>(() => ((props.row.replicaSets || []) as Row[]).slice().reverse());
const replicaSetRows = computed(() => objects.value.filter(o => o.kind === 'ReplicaSet' && o.namespace === props.row.namespace
  && o.owner === props.row.name));
const newReplicaSet = computed(() => props.row.kind === 'Deployment' ? replicaSetRows.value.filter(r => (r.desired ?? 0) > 0) : []);
const oldReplicaSets = computed(() => props.row.kind === 'Deployment' ? replicaSetRows.value.filter(r => (r.desired ?? 0) === 0) : []);

const childPods = computed(() => {
  const r = props.row;
  if (r.kind === 'Node') return objects.value.filter(o => o.kind === 'Pod' && o.node === r.name);
  if (!['Deployment', 'ReplicaSet', 'StatefulSet', 'DaemonSet', 'Job', 'Service'].includes(r.kind)) return [];
  const names = new Set(r.pods || []);
  return objects.value.filter(o => o.kind === 'Pod' && o.namespace === r.namespace && names.has(o.name));
});

const events = computed(() => {
  if (props.row.kind === 'Deployment') {
    const owned = new Set([props.row.name, ...replicaSetRows.value.map(r => r.name)]);
    return ((dash(props.view).events || []) as Row[]).filter(e => {
      const [k, n] = String(e.object).split('/');
      return (k === 'deployment' || k === 'replicaset') && owned.has(n);
    }).slice().reverse();
  }
  return eventsFor(props.view, props.row.kind, props.row.name);
});

function nodeOfIp(ip: string) {
  return objects.value.find(o => o.kind === 'Pod' && o.ip === ip)?.node || '-';
}

function openNamespace() {
  const ns = (dash(props.view).namespaces || []).find((n: Row) => n.name === props.row.namespace);
  if (ns) emit('open', nsDef, { ...ns, kind: 'Namespace' });
}
function openReplicaSet(name: string) {
  const rs = findObject(props.view, rsDef, props.row.namespace, name);
  if (rs) emit('open', rsDef, rs);
}
function openOwner() {
  const def = kindByKind(props.row.ownerKind || 'ReplicaSet') || rsDef;
  const owner = findObject(props.view, def, props.row.namespace, props.row.owner);
  if (owner) emit('open', def, owner);
}

async function reveal(key: string) {
  if (revealed[key] !== undefined) { delete revealed[key]; return; }
  const result = await props.api.exec(getYamlCommand(props.def, props.row.namespace, props.row.name, 'json'),
    { unlogged: true, quiet: true });
  const doc = parseJson<Row>(result.output);
  const encoded = doc?.data?.[key];
  try {
    revealed[key] = encoded ? atob(String(encoded)) : '';
  } catch {
    revealed[key] = String(encoded || '');
  }
}
</script>

<style scoped>
.kd-card { background: #fff; box-shadow: var(--kd-shadow); border-radius: 2px; margin-bottom: 16px; }
.kd-card__head { display: flex; align-items: center; min-height: 56px; padding: 0 20px; }
.kd-card__title { margin: 0; font-size: 18px; font-weight: 400; color: rgb(0 0 0 / 0.87); }
.kd-card__empty { padding: 4px 20px 24px; color: rgb(0 0 0 / 0.54); font-size: 14px; }
.kd-props { display: flex; flex-wrap: wrap; gap: 16px 40px; padding: 0 20px 20px; }
.kd-props--block { flex-direction: column; gap: 12px; }
.kd-prop { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.kd-prop__k { font-size: 12px; color: rgb(0 0 0 / 0.54); }
.kd-prop__v { font-size: 14px; color: rgb(0 0 0 / 0.87); word-break: break-word; }
.kd-mono { font-family: 'Roboto Mono', Consolas, Menlo, monospace; font-size: 13px; }
.kd-link { color: var(--kd-primary); text-decoration: none; }
.kd-link:hover { text-decoration: underline; }
.kd-table-wrap { overflow-x: auto; }
.kd-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.kd-table th { text-align: left; font-size: 12px; font-weight: 500; color: rgb(0 0 0 / 0.54); height: 56px; padding: 0 12px 0 20px;
  border-bottom: 1px solid rgb(0 0 0 / 0.12); white-space: nowrap; }
.kd-table td { height: 48px; padding: 4px 12px 4px 20px; border-bottom: 1px solid rgb(0 0 0 / 0.12); color: rgb(0 0 0 / 0.87); }
.kd-current { color: rgb(0 0 0 / 0.54); font-size: 12px; }
.kd-right { text-align: right; }
.kd-textbtn { border: 0; background: none; color: var(--kd-primary); font: inherit; font-size: 14px; font-weight: 500;
  text-transform: uppercase; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.kd-textbtn:hover { background: rgb(50 109 230 / 0.08); }
.kd-data { padding: 0 20px 16px; }
.kd-data__k { display: flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 500; color: rgb(0 0 0 / 0.87); margin-bottom: 6px; }
.kd-data__v { margin: 0; padding: 12px; background: #f5f5f5; border-radius: 2px; font: 13px/1.5 'Roboto Mono', Consolas, monospace;
  white-space: pre-wrap; word-break: break-word; color: rgb(0 0 0 / 0.87); }
.kd-iconbtn { width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent; color: rgb(0 0 0 / 0.54);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.kd-iconbtn--sm { width: 28px; height: 28px; }
.kd-container { padding: 0 0 8px; border-top: 1px solid rgb(0 0 0 / 0.08); }
.kd-container__head { display: flex; align-items: center; gap: 8px; padding: 12px 20px; font-size: 14px; }
</style>
