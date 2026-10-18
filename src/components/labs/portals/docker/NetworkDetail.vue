<template>
  <section class="dd-page">
    <div v-if="!network" class="dd-empty">
      <h2>This network no longer exists</h2>
      <button type="button" class="dd-btn dd-btn--primary" @click="$emit('go', { page: 'networks' })">Back to Networks</button>
    </div>
    <template v-else>
      <div class="dd-detail-head">
        <button type="button" class="dd-icon-btn" aria-label="Back" title="Back" @click="$emit('go', { page: 'networks' })"><DdIcon name="back" :size="20" /></button>
        <DdIcon name="networks" :size="30" class="nd-icon" />
        <div class="dd-detail-title">
          <h1>{{ network.name }}</h1>
          <div class="dd-detail-meta">
            <span class="dd-mono">{{ network.id }}</span>
            <span>{{ network.driver }}</span>
            <span class="dd-mono">{{ network.subnet || 'no subnet' }}</span>
            <span v-if="network.builtin" class="dd-chip">default</span>
            <span v-else class="dd-chip dd-chip--blue">DNS by container name</span>
          </div>
        </div>
        <button type="button" class="dd-btn dd-btn--primary" :disabled="network.driver === 'null' || network.driver === 'host'" @click="openConnect"><DdIcon name="plus" :size="14" /> Connect container</button>
        <button type="button" class="dd-btn dd-btn--danger-outline" :disabled="network.builtin" @click="deleting = true"><DdIcon name="trash" :size="14" /> Delete</button>
      </div>

      <nav class="dd-tabs" aria-label="Network details">
        <button type="button" class="dd-tab" :class="{ 'is-active': tab === 'containers' }" @click="setTab('containers')">Containers</button>
        <button type="button" class="dd-tab" :class="{ 'is-active': tab === 'inspect' }" @click="setTab('inspect')">Inspect</button>
      </nav>

      <div v-if="tab === 'containers'">
        <div v-if="!endpoints.length" class="dd-empty"><h2>No containers are connected</h2>
          <p>Connect a container to give it an address on this network.</p></div>
        <div v-else class="dd-table-wrap">
          <table class="dd-table">
            <thead><tr><th>Container</th><th>IPv4 address</th><th>Alias</th><th>Status</th><th class="dd-actions">Actions</th></tr></thead>
            <tbody>
              <tr v-for="e in endpoints" :key="e.name">
                <td><button type="button" class="dd-link" @click="$emit('go', { page: 'containers', id: e.name })">{{ e.name }}</button></td>
                <td class="dd-mono">{{ e.ip || '-' }}</td>
                <td>{{ e.alias || '-' }}</td>
                <td><span class="dd-status"><span class="dd-dot" :class="{ 'dd-dot--green': e.status === 'running' }"></span>{{ e.status }}</span></td>
                <td class="dd-actions"><button type="button" class="dd-btn dd-btn--ghost" :disabled="busy" @click="disconnect(e.name)">Disconnect</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <pre v-else class="dd-pre dd-box nd-json">{{ inspectText || 'Loading…' }}</pre>
    </template>

    <DdModal v-if="connecting && network" title="Connect a container" :subtitle="`to ${network.name}`" @close="connecting = false">
      <div class="dd-field">
        <label for="nd-c">Container</label>
        <select id="nd-c" v-model="pickName" class="dd-select">
          <option value="" disabled>Select a container</option>
          <option v-for="c in candidates" :key="c.id" :value="c.name">{{ c.name }} ({{ c.image }})</option>
        </select>
      </div>
      <div class="dd-field">
        <label for="nd-a">Alias (optional)</label>
        <input id="nd-a" v-model="alias" class="dd-input" placeholder="api" />
        <small>Another name the container answers to on this network.</small>
      </div>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="connecting = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--primary" :disabled="busy || !pickName" @click="connect">Connect</button>
      </template>
    </DdModal>
    <DdModal v-if="deleting && network" title="Delete network?" @close="deleting = false">
      <p>Delete <b>{{ network.name }}</b>? A network with connected containers cannot be deleted.</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="deleting = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="confirmDelete">Delete</button>
      </template>
    </DdModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import DdModal from './DdModal.vue';
import { cmd, containers, networks, type DdRoute } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
const emit = defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();

const network = computed(() => networks(props.view).find(n => n.name === props.route.id));
const tab = computed(() => props.route.tab === 'inspect' ? 'inspect' : 'containers');
const endpoints = computed(() => network.value?.endpoints
  || (network.value?.members || []).map(name => ({ name, ip: '', alias: '', status: '' })));
const candidates = computed(() => containers(props.view).filter(c => !network.value?.members.includes(c.name)));
const connecting = ref(false);
const deleting = ref(false);
const pickName = ref('');
const alias = ref('');
const inspectText = ref('');

function setTab(value: string) { emit('go', { page: 'networks', id: props.route.id, tab: value }); }
function openConnect() { pickName.value = ''; alias.value = ''; connecting.value = true; }

async function connect() {
  if (!network.value) return;
  const result = await props.api.exec(cmd.networkConnect(network.value.name, pickName.value, alias.value.trim()),
                                      { success: `Connected ${pickName.value} to ${network.value.name}` });
  if (result.ok) connecting.value = false;
}
async function disconnect(name: string) {
  if (!network.value) return;
  await props.api.exec(cmd.networkDisconnect(network.value.name, name), { success: `Disconnected ${name} from ${network.value.name}` });
}
async function confirmDelete() {
  if (!network.value) return;
  const name = network.value.name;
  const result = await props.api.exec(cmd.networkRm([name]), { success: `Deleted ${name}` });
  if (result.ok) { deleting.value = false; emit('go', { page: 'networks' }); }
}

watch(() => [tab.value, props.route.id, network.value?.members.length], async ([current]) => {
  if (current !== 'inspect' || !network.value) return;
  const result = await props.api.exec(cmd.inspect(network.value.name), { unlogged: true });
  inspectText.value = result.ok ? String(result.output || '') : '';
}, { immediate: true });
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.nd-icon { color: var(--dd-blue); }
.nd-json { max-height: 460px; background: #FAFAFB; }
</style>
