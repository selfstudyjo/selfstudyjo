<template>
  <section class="dd-page">
    <div class="dd-head">
      <h1>Networks</h1>
      <span class="dd-spacer"></span>
      <button type="button" class="dd-feedback"><DdIcon name="feedback" :size="15" /> Give feedback</button>
    </div>

    <div class="dd-toolbar">
      <template v-if="selected.length">
        <span class="dd-selected"><b>{{ selected.length }}</b> selected</span>
        <button type="button" class="dd-btn dd-btn--danger-outline" @click="deleting = [...selected]"><DdIcon name="trash" :size="14" /> Delete</button>
        <button type="button" class="dd-link" @click="selected = []">Clear selection</button>
      </template>
      <template v-else>
        <label class="dd-search"><DdIcon name="search" :size="16" /><input v-model="filter" type="search" placeholder="Search" aria-label="Search networks" /></label>
        <span class="dd-spacer"></span>
        <DdMenu :items="[{ key: 'prune', label: 'Delete unused networks', icon: 'trash', danger: true }]" label="More network actions" @select="pruning = true" />
        <button type="button" class="dd-btn dd-btn--primary" @click="openCreate"><DdIcon name="plus" :size="15" /> Create</button>
      </template>
    </div>

    <div class="dd-table-wrap">
      <table class="dd-table">
        <thead><tr>
          <th class="dd-check"></th><th>Name</th><th>Network ID</th><th>Driver</th><th>Subnet</th><th>Containers</th><th>Created</th><th class="dd-actions">Actions</th>
        </tr></thead>
        <tbody>
          <tr v-for="n in shown" :key="n.id" :class="{ 'is-selected': selected.includes(n.name) }">
            <td class="dd-check"><input type="checkbox" class="dd-cb" :disabled="n.builtin" :aria-label="`Select ${n.name}`" :checked="selected.includes(n.name)" @change="toggle(n.name)" /></td>
            <td>
              <div class="dd-name-cell">
                <DdIcon name="networks" :size="18" class="nv-icon" />
                <button type="button" class="dd-link nv-name" @click="$emit('go', { page: 'networks', id: n.name })">{{ n.name }}</button>
                <span v-if="n.builtin" class="dd-chip">default</span>
              </div>
            </td>
            <td class="dd-mono">{{ n.id }}</td>
            <td>{{ n.driver }}</td>
            <td class="dd-mono">{{ n.subnet || '-' }}</td>
            <td>{{ n.members.length }}</td>
            <td>{{ n.created_ago || '-' }}</td>
            <td class="dd-actions">
              <button type="button" class="dd-icon-btn dd-icon-btn--danger" title="Delete" aria-label="Delete" :disabled="n.builtin" @click="deleting = [n.name]"><DdIcon name="trash" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <DdModal v-if="creating" title="New Network" @close="creating = false">
      <div class="dd-field">
        <label for="nv-name">Network name</label>
        <input id="nv-name" v-model="form.name" class="dd-input" :class="{ 'is-invalid': nameError }" placeholder="appnet" />
        <span v-if="nameError" class="dd-err">{{ nameError }}</span>
      </div>
      <div class="dd-field">
        <label for="nv-driver">Driver</label>
        <select id="nv-driver" v-model="form.driver" class="dd-select">
          <option value="bridge">bridge</option>
          <option value="macvlan">macvlan</option>
          <option value="ipvlan">ipvlan</option>
        </select>
        <small>Containers on a network you create resolve each other by name. The default bridge does not.</small>
      </div>
      <div class="dd-field">
        <label for="nv-subnet">Subnet (optional)</label>
        <input id="nv-subnet" v-model="form.subnet" class="dd-input" :class="{ 'is-invalid': subnetError }" placeholder="172.30.0.0/16" />
        <span v-if="subnetError" class="dd-err">{{ subnetError }}</span>
      </div>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="creating = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--primary" :disabled="busy || !form.name || !!nameError || !!subnetError" @click="create">Create</button>
      </template>
    </DdModal>

    <DdModal v-if="deleting.length" :title="deleting.length > 1 ? 'Delete networks?' : 'Delete network?'" @close="deleting = []">
      <p>Delete <b>{{ deleting.join(', ') }}</b>? A network with connected containers cannot be deleted; disconnect them first.</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="deleting = []">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="confirmDelete">Delete</button>
      </template>
    </DdModal>

    <DdModal v-if="pruning" title="Delete unused networks?" @close="pruning = false">
      <p>Every network you created that has no connected container is deleted (<span class="dd-mono">docker network prune</span>).</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="pruning = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="prune">Delete</button>
      </template>
    </DdModal>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { matches, RULES } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import DdMenu from './DdMenu.vue';
import DdModal from './DdModal.vue';
import { cmd, NAME_RE, networks, type DdRoute } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();

const filter = ref('');
const selected = ref<string[]>([]);
const creating = ref(false);
const deleting = ref<string[]>([]);
const pruning = ref(false);
const form = reactive({ name: '', driver: 'bridge', subnet: '' });

const list = computed(() => networks(props.view));
const shown = computed(() => list.value.filter(n => matches(n as any, filter.value, ['name', 'driver', 'id', 'subnet'])));
const nameError = computed(() => !form.name ? '' : !NAME_RE.test(form.name) ? 'Invalid name. Only [a-zA-Z0-9][a-zA-Z0-9_.-] are allowed.'
  : list.value.some(n => n.name === form.name) ? `network with name ${form.name} already exists` : '');
const subnetError = computed(() => RULES.cidr('Subnet')(form.subnet));

function toggle(name: string) { selected.value = selected.value.includes(name) ? selected.value.filter(n => n !== name) : [...selected.value, name]; }
function openCreate() { Object.assign(form, { name: '', driver: 'bridge', subnet: '' }); creating.value = true; }

async function create() {
  const result = await props.api.exec(cmd.networkCreate(form.name, form.driver, form.subnet.trim()), { success: `Network ${form.name} created` });
  if (result.ok) creating.value = false;
}
async function confirmDelete() {
  const names = deleting.value;
  const result = await props.api.exec(cmd.networkRm(names), { success: names.length > 1 ? `Deleted ${names.length} networks` : `Deleted ${names[0]}` });
  if (result.ok) { deleting.value = []; selected.value = selected.value.filter(n => !names.includes(n)); }
}
async function prune() {
  const result = await props.api.exec(cmd.networkPrune(), { success: 'Deleted unused networks' });
  if (result.ok) pruning.value = false;
}
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.dd-spacer { flex: 1; }
.nv-icon { color: var(--dd-text-2); }
.nv-name { font-weight: 500; }
</style>
