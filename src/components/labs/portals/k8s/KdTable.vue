<template>
  <section class="kd-card">
    <header class="kd-card__head">
      <h2 class="kd-card__title">{{ title || def.title }}</h2>
      <span class="kd-card__spacer" />
      <div v-if="filtering" class="kd-card__filter">
        <KIcon name="filter" :size="18" />
        <input ref="filterBox" v-model="needle" type="text" placeholder="Filter objects by name" aria-label="Filter objects by name" />
        <button type="button" class="kd-iconbtn" aria-label="Close filter" @click="filtering = false; needle = ''"><KIcon name="close" :size="18" /></button>
      </div>
      <button v-else type="button" class="kd-iconbtn" title="Filter objects by name" aria-label="Filter" @click="openFilter">
        <KIcon name="filter" />
      </button>
    </header>
    <div v-if="!pageRows.length" class="kd-card__empty">
      There is nothing to display here
    </div>
    <div v-else class="kd-table-wrap">
      <table class="kd-table">
        <thead>
          <tr>
            <th v-if="hasStatus" class="kd-col-status" />
            <th v-for="col in columns" :key="col.key" :class="`kd-col-${col.key}`">
              <button type="button" class="kd-sort" :class="{ 'is-sorted': sortKey === col.key }" @click="toggleSort(col.key)">
                {{ col.label }}<span v-if="sortKey === col.key" class="kd-sort__arrow">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
              </button>
            </th>
            <th class="kd-col-menu" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pageRows" :key="(row.namespace || '') + '/' + row.name + row.kind">
            <td v-if="hasStatus" class="kd-col-status"><KdStatus :health="healthOf(row)" :title="row.status" /></td>
            <td v-for="col in columns" :key="col.key" :class="`kd-col-${col.key}`">
              <template v-if="col.key === 'name'">
                <a v-if="linkable" href="#" class="kd-link" @click.prevent="$emit('open', row)">{{ displayName(row) }}</a>
                <span v-else>{{ displayName(row) }}</span>
              </template>
              <KdChips v-else-if="col.key === 'labels'" :labels="row.labels" />
              <span v-else-if="col.key === 'images'" class="kd-images">
                <span v-for="image in row.images || []" :key="image" class="kd-chip-image">{{ image }}</span>
              </span>
              <span v-else-if="col.key === 'created'" :title="formatDate(row.createdAt)">{{ row.age || '-' }}</span>
              <span v-else>{{ cell(row, col.key) }}</span>
            </td>
            <td class="kd-col-menu">
              <div v-if="menuFor(row).length" class="kd-menu-anchor">
                <button type="button" class="kd-iconbtn" :aria-label="`Actions for ${row.name}`" @click.stop="toggleMenu(row)">
                  <KIcon name="more" />
                </button>
                <div v-if="menuOpen === key(row)" class="kd-menu" role="menu">
                  <button v-for="item in menuFor(row)" :key="item.type" type="button" role="menuitem" class="kd-menu__item"
                          @click.stop="menuOpen = ''; $emit('act', { type: item.type, row })">
                    <KIcon :name="item.icon" :size="20" /><span>{{ item.label }}</span>
                  </button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <footer v-if="filtered.length > perPage" class="kd-paginator">
      <span>Items per page: {{ perPage }}</span>
      <span>{{ page * perPage + 1 }} – {{ Math.min(filtered.length, (page + 1) * perPage) }} of {{ filtered.length }}</span>
      <button type="button" class="kd-iconbtn" :disabled="page === 0" aria-label="Previous page" @click="page--"><KIcon name="chevron" class="kd-flip" /></button>
      <button type="button" class="kd-iconbtn" :disabled="(page + 1) * perPage >= filtered.length" aria-label="Next page" @click="page++"><KIcon name="chevron" /></button>
    </footer>
    <footer v-else-if="pageRows.length" class="kd-paginator">
      <span>{{ filtered.length ? `1 – ${filtered.length} of ${filtered.length}` : '' }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
/**
 * One resource list card - the Dashboard's `kd-*-list` components. Material
 * table, a filter in the card header, a status icon column and the per-row
 * three-dot menu (Scale / Restart / Logs / Exec / Edit / Delete).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { matches, sortBy } from '@/utils/portalKit';
import KIcon from './KIcon.vue';
import KdChips from './KdChips.vue';
import KdStatus from './KdStatus.vue';
import { formatDate, healthOf, podsCell, type KindDef, type Row } from './k8s';

const props = withDefaults(defineProps<{
  def: KindDef; rows: Row[]; title?: string; allNamespaces?: boolean; perPage?: number;
}>(), { perPage: 10 });
defineEmits<{ (e: 'open', row: Row): void; (e: 'act', payload: { type: string; row: Row }): void }>();

const needle = ref('');
const filtering = ref(false);
const filterBox = ref<HTMLInputElement | null>(null);
const page = ref(0);
const sortKey = ref('');
const sortDir = ref<'asc' | 'desc'>('asc');
const menuOpen = ref('');

function key(row: Row) { return `${row.namespace || ''}/${row.name}`; }
function toggleMenu(row: Row) { menuOpen.value = menuOpen.value === key(row) ? '' : key(row); }
function close() { menuOpen.value = ''; }
onMounted(() => document.addEventListener('click', close));
onBeforeUnmount(() => document.removeEventListener('click', close));

async function openFilter() {
  filtering.value = true;
  await nextTick();
  filterBox.value?.focus();
}

function toggleSort(col: string) {
  if (sortKey.value === col) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = col; sortDir.value = 'asc'; }
}

const hasStatus = computed(() => ['Pod', 'Deployment', 'ReplicaSet', 'StatefulSet', 'DaemonSet', 'Job',
  'Node', 'Namespace', 'PersistentVolumeClaim', 'PersistentVolume'].includes(props.def.kind));
const linkable = computed(() => !['Event', 'StorageClass', 'ClusterRole', 'CustomResourceDefinition'].includes(props.def.kind));

const COLS: Record<string, [string, string][]> = {
  Deployment: [['name', 'Name'], ['images', 'Images'], ['labels', 'Labels'], ['pods', 'Pods'], ['created', 'Created']],
  ReplicaSet: [['name', 'Name'], ['images', 'Images'], ['labels', 'Labels'], ['pods', 'Pods'], ['created', 'Created']],
  StatefulSet: [['name', 'Name'], ['images', 'Images'], ['labels', 'Labels'], ['pods', 'Pods'], ['created', 'Created']],
  DaemonSet: [['name', 'Name'], ['images', 'Images'], ['labels', 'Labels'], ['pods', 'Pods'], ['created', 'Created']],
  ReplicationController: [['name', 'Name'], ['images', 'Images'], ['labels', 'Labels'], ['pods', 'Pods'], ['created', 'Created']],
  Job: [['name', 'Name'], ['images', 'Images'], ['labels', 'Labels'], ['pods', 'Pods'], ['created', 'Created']],
  CronJob: [['name', 'Name'], ['images', 'Images'], ['labels', 'Labels'], ['schedule', 'Schedule'], ['suspend', 'Suspend'],
    ['active', 'Active'], ['lastSchedule', 'Last Schedule'], ['created', 'Created']],
  Pod: [['name', 'Name'], ['images', 'Images'], ['labels', 'Labels'], ['node', 'Node'], ['status', 'Status'],
    ['restarts', 'Restarts'], ['cpu', 'CPU Usage (cores)'], ['memory', 'Memory Usage (bytes)'], ['created', 'Created']],
  Service: [['name', 'Name'], ['labels', 'Labels'], ['type', 'Type'], ['clusterIP', 'Cluster IP'],
    ['internal', 'Internal Endpoints'], ['external', 'External Endpoints'], ['created', 'Created']],
  Ingress: [['name', 'Name'], ['labels', 'Labels'], ['endpoints', 'Endpoints'], ['hosts', 'Hosts'], ['created', 'Created']],
  ConfigMap: [['name', 'Name'], ['labels', 'Labels'], ['created', 'Created']],
  Secret: [['name', 'Name'], ['labels', 'Labels'], ['type', 'Type'], ['created', 'Created']],
  PersistentVolumeClaim: [['name', 'Name'], ['labels', 'Labels'], ['status', 'Status'], ['volume', 'Volume'],
    ['capacity', 'Capacity'], ['access', 'Access Modes'], ['storageClass', 'Storage Class'], ['created', 'Created']],
  Namespace: [['name', 'Name'], ['labels', 'Labels'], ['phase', 'Phase'], ['created', 'Created']],
  Node: [['name', 'Name'], ['labels', 'Labels'], ['ready', 'Ready'], ['cpuCap', 'CPU capacity (cores)'],
    ['memCap', 'Memory capacity (bytes)'], ['podCount', 'Pods'], ['created', 'Created']],
  PersistentVolume: [['name', 'Name'], ['capacity', 'Capacity'], ['access', 'Access Modes'], ['reclaim', 'Reclaim Policy'],
    ['status', 'Status'], ['claim', 'Claim'], ['storageClass', 'Storage Class'], ['created', 'Created']],
  StorageClass: [['name', 'Name'], ['provisioner', 'Provisioner'], ['parameters', 'Parameters'], ['created', 'Created']],
  ClusterRole: [['name', 'Name'], ['created', 'Created']],
  Event: [['message', 'Message'], ['source', 'Source'], ['subobject', 'Sub-object'], ['count', 'Count'],
    ['firstSeen', 'First Seen'], ['lastSeen', 'Last Seen']],
  CustomResourceDefinition: [['name', 'Name'], ['group', 'Group'], ['fullName', 'Full Name'], ['namespaced', 'Namespaced'], ['created', 'Created']],
};

const columns = computed(() => {
  const base = (COLS[props.def.kind] || [['name', 'Name'], ['created', 'Created']]).map(([k, label]) => ({ key: k, label }));
  if (props.allNamespaces && props.def.namespaced && props.def.kind !== 'Event') {
    base.splice(1, 0, { key: 'namespace', label: 'Namespace' });
  }
  return base;
});

function displayName(row: Row) { return row.name; }

function cell(row: Row, col: string): string {
  switch (col) {
    case 'pods': return podsCell(row);
    case 'namespace': return row.namespace || '-';
    case 'node': return row.node || '-';
    case 'restarts': return String(row.restarts ?? 0);
    case 'cpu': case 'memory': return '-';
    case 'schedule': return row.schedule || '-';
    case 'suspend': return row.suspend ? 'true' : 'false';
    case 'active': return String(row.active ?? 0);
    case 'lastSchedule': return row.lastSchedule || '-';
    case 'clusterIP': return row.clusterIP || '-';
    case 'internal': return (row.ports || []).map((p: Row) => `${row.name}.${row.namespace}:${p.port} ${p.protocol || 'TCP'}`)
      .concat((row.ports || []).filter(() => row.nodePort).map((p: Row) => `${row.name}.${row.namespace}:${row.nodePort} ${p.protocol || 'TCP'}`))
      .join(', ') || '-';
    case 'external': return row.type === 'LoadBalancer' ? 'Pending' : '-';
    case 'endpoints': return 'localhost';
    case 'hosts': return (row.hosts || []).join(', ') || '*';
    case 'phase': return row.status || 'Active';
    case 'ready': return row.status === 'Ready' ? 'True' : 'False';
    case 'cpuCap': return String(row.cpu ?? '-');
    case 'memCap': return String(row.memory ?? '-');
    case 'podCount': return String(row.pods ?? 0);
    case 'access': return (row.accessModes || []).join(', ') || 'RWO';
    case 'reclaim': return row.reclaimPolicy || 'Delete';
    case 'provisioner': return row.provisioner || '-';
    case 'parameters': return '-';
    case 'message': return row.message || '';
    case 'source': return row.object || '';
    case 'subobject': return '-';
    case 'count': return '1';
    case 'firstSeen': case 'lastSeen': return row.age || '-';
    case 'group': return row.group || '-';
    case 'fullName': return row.fullName || row.name;
    case 'namespaced': return row.namespaced ? 'true' : 'false';
    default: return row[col] === undefined || row[col] === '' ? '-' : String(row[col]);
  }
}

function menuFor(row: Row): { type: string; label: string; icon: string }[] {
  const kind = props.def.kind;
  if (props.def.readOnly) return [];
  const items: { type: string; label: string; icon: string }[] = [];
  if (kind === 'Pod') {
    items.push({ type: 'logs', label: 'Logs', icon: 'logs' });
    if (row.status === 'Running') items.push({ type: 'exec', label: 'Exec', icon: 'exec' });
  }
  if (props.def.scalable) items.push({ type: 'scale', label: 'Scale', icon: 'scale' });
  if (props.def.restartable) items.push({ type: 'restart', label: 'Restart', icon: 'restart' });
  items.push({ type: 'edit', label: 'Edit', icon: 'edit' });
  items.push({ type: 'delete', label: 'Delete', icon: 'delete' });
  return items;
}

const filtered = computed<Row[]>(() => {
  const list = props.rows.filter(row => matches(row, needle.value, ['name', 'message', 'object']));
  if (!sortKey.value) return list;
  const prepared: Row[] = list.map(row => ({ ...row, __sort: sortKey.value === 'created' ? Number(row.created || 0) : cell(row, sortKey.value) }));
  return sortBy(prepared, '__sort', sortDir.value);
});
const pageRows = computed(() => filtered.value.slice(page.value * props.perPage, (page.value + 1) * props.perPage));
watch(() => props.rows.length, () => { if (page.value * props.perPage >= filtered.value.length) page.value = 0; });
watch(needle, () => { page.value = 0; });
</script>

<style scoped>
.kd-card { background: #fff; box-shadow: var(--kd-shadow); border-radius: 2px; margin-bottom: 16px; }
.kd-card__head { display: flex; align-items: center; min-height: 56px; padding: 0 8px 0 20px; }
.kd-card__title { margin: 0; font-size: 18px; font-weight: 400; color: rgb(0 0 0 / 0.87); }
.kd-card__spacer { flex: 1; }
.kd-card__filter { display: flex; align-items: center; gap: 6px; color: rgb(0 0 0 / 0.54); border-bottom: 1px solid var(--kd-primary); }
.kd-card__filter input { border: 0; outline: 0; font: inherit; font-size: 14px; width: 220px; padding: 6px 0; background: transparent; }
.kd-card__empty { padding: 24px 20px 28px; color: rgb(0 0 0 / 0.54); font-size: 14px; }
.kd-table-wrap { overflow-x: auto; }
.kd-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.kd-table th { text-align: left; font-size: 12px; font-weight: 500; color: rgb(0 0 0 / 0.54); height: 56px; padding: 0 12px;
  border-bottom: 1px solid rgb(0 0 0 / 0.12); white-space: nowrap; }
.kd-table td { height: 48px; padding: 4px 12px; border-bottom: 1px solid rgb(0 0 0 / 0.12); color: rgb(0 0 0 / 0.87); vertical-align: middle; }
.kd-table tbody tr:hover { background: #f5f5f5; }
.kd-col-status { width: 36px; padding-left: 20px !important; padding-right: 0 !important; }
.kd-col-menu { width: 48px; text-align: right; }
.kd-col-name { min-width: 140px; word-break: break-word; }
.kd-col-created { white-space: nowrap; }
.kd-sort { border: 0; background: none; font: inherit; color: inherit; cursor: pointer; padding: 0; }
.kd-sort.is-sorted { color: rgb(0 0 0 / 0.87); }
.kd-sort__arrow { margin-left: 4px; }
.kd-link { color: var(--kd-primary); text-decoration: none; }
.kd-link:hover { text-decoration: underline; }
.kd-images { display: flex; flex-direction: column; gap: 2px; }
.kd-chip-image { font-size: 13px; word-break: break-all; }
.kd-iconbtn { width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent; color: rgb(0 0 0 / 0.54);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.kd-iconbtn:hover:not(:disabled) { background: rgb(0 0 0 / 0.04); }
.kd-iconbtn:disabled { opacity: 0.38; cursor: default; }
.kd-menu-anchor { position: relative; display: inline-block; }
.kd-menu { position: absolute; right: 8px; top: 36px; z-index: 30; min-width: 160px; background: #fff; border-radius: 4px; padding: 8px 0;
  box-shadow: 0 2px 4px -1px rgb(0 0 0 / 0.2), 0 4px 5px 0 rgb(0 0 0 / 0.14), 0 1px 10px 0 rgb(0 0 0 / 0.12); }
.kd-menu__item { display: flex; align-items: center; gap: 16px; width: 100%; height: 48px; padding: 0 16px; border: 0; background: none;
  font: inherit; font-size: 14px; color: rgb(0 0 0 / 0.87); cursor: pointer; text-align: left; }
.kd-menu__item :deep(.kd-icon) { color: rgb(0 0 0 / 0.54); }
.kd-menu__item:hover { background: rgb(0 0 0 / 0.04); }
.kd-paginator { display: flex; align-items: center; justify-content: flex-end; gap: 16px; min-height: 48px; padding: 0 8px 0 20px;
  font-size: 12px; color: rgb(0 0 0 / 0.54); }
.kd-flip { transform: scaleX(-1); }
@container sl-portal (max-width: 600px) {
  .kd-card__filter input { width: 120px; }
  .kd-card__head { padding-left: 12px; }
}
</style>
