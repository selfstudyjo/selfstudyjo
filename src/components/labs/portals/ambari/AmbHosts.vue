<template>
  <div v-if="!host">
    <div class="toolbar">
      <div class="amb-dd">
        <button type="button" class="btn btn-default" @click.stop="actions = !actions">
          Actions <AmbIcon name="caret" :size="11" />
        </button>
        <ul v-if="actions" class="amb-dd__menu" @click="actions = false">
          <li><a href="#" class="is-disabled">Add New Hosts</a></li>
          <li class="amb-dd__sep"></li>
          <li><a href="#" :class="{ 'is-disabled': !selected.length }">Selected Hosts ({{ selected.length }})</a></li>
          <li><a href="#">All Hosts ({{ hosts.length }})</a></li>
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
          <tr v-for="h in shown" :key="h.host" :class="{ 'is-selected': selected.includes(h.host) }">
            <td class="hosts__check"><input v-model="selected" type="checkbox" :value="h.host" :aria-label="`Select ${h.fqdn}`" /></td>
            <td class="hosts__name">
              <AmbIcon :name="downCount(h) ? 'warn' : 'ok'" :class="downCount(h) ? 'health-warn' : 'health-ok'" />
              <a href="#" @click.prevent="$emit('navigate', { page: 'host', id: h.host })">{{ h.fqdn }}</a>
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
            <td>{{ (h.components || []).length }} Components</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!shown.length" class="empty">No hosts to display</div>
    </div>
    <div class="text-muted hosts__count">{{ shown.length }} of {{ hosts.length }} hosts showing</div>
  </div>

  <div v-else-if="detail">
    <div class="toolbar">
      <a href="#" @click.prevent="$emit('navigate', { page: 'hosts' })">Hosts</a> <span class="text-muted">/</span>
      <strong>{{ detail.fqdn }}</strong>
    </div>
    <div class="host__grid">
      <div class="panel">
        <div class="panel-heading"><h4>Components</h4></div>
        <div class="table-wrap">
          <table class="table">
            <tbody>
              <tr v-for="comp in detail.components" :key="comp.name">
                <td style="width:24px">
                  <AmbIcon v-if="comp.category !== 'CLIENT'" :name="comp.state === 'STARTED' ? 'ok' : 'down'"
                           :class="comp.state === 'STARTED' ? 'health-ok' : 'health-down'" />
                </td>
                <td>{{ comp.display }}</td>
                <td><a href="#" @click.prevent="$emit('navigate', { page: 'service', id: comp.service })">{{ serviceName(comp.service) }}</a></td>
                <td>{{ comp.category === 'CLIENT' ? 'Installed' : comp.state === 'STARTED' ? 'Started' : 'Stopped' }}</td>
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
              <tr><th>Current Version</th><td>{{ detail.versions }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="empty">Host {{ host }} is not part of this cluster.</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches, rows } from '@/utils/portalKit';
import { SERVICE_NAMES } from './ambari';
import AmbIcon from './AmbIcon.vue';

const props = defineProps<{ view: Record<string, any>; host?: string }>();
defineEmits<{ (event: 'navigate', route: any): void }>();

const filter = ref('');
const selected = ref<string[]>([]);
const actions = ref(false);

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
function serviceName(id: string) {
  return SERVICE_NAMES[id] || id;
}
</script>

<style scoped>
.hosts__filter { max-width: 340px; }
.hosts__check { width: 30px; }
.hosts__name { white-space: nowrap; }
.hosts__name a { margin-left: 6px; }
.hosts__bar { width: 90px; height: 10px; background: #eee; border: 1px solid #ddd; }
.hosts__bar i { display: block; height: 100%; background: #41bfae; }
.hosts__count { font-size: 12px; margin-top: -10px; }
.host__grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
.host__kv th { font-weight: 400; color: #666; width: 40%; border-bottom: 0; border-top: 1px solid #ddd; }
@container sl-portal (max-width: 760px) { .host__grid { grid-template-columns: minmax(0, 1fr); } }
</style>
