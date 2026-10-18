<template>
  <section class="dd-page">
    <div class="dd-head">
      <h1>Volumes</h1>
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
        <label class="dd-search"><DdIcon name="search" :size="16" /><input v-model="filter" type="search" placeholder="Search" aria-label="Search volumes" /></label>
        <select v-model="show" class="dd-select vv-show" aria-label="Filter volumes">
          <option value="all">All volumes</option>
          <option value="used">In use</option>
          <option value="unused">Unused</option>
        </select>
        <span class="dd-spacer"></span>
        <DdMenu :items="[{ key: 'prune', label: 'Delete unused volumes', icon: 'trash', danger: true, disabled: !unusedCount }]"
                label="More volume actions" @select="pruning = true" />
        <button type="button" class="dd-btn dd-btn--primary" @click="openCreate"><DdIcon name="plus" :size="15" /> Create</button>
      </template>
    </div>

    <div v-if="!list.length" class="dd-empty">
      <DdIcon name="volumes" :size="64" class="dd-empty__art" />
      <h2>No volumes yet</h2>
      <p>Volumes store data outside a container's writable layer, so it survives the container being deleted.</p>
      <button type="button" class="dd-btn dd-btn--primary" @click="openCreate">Create a volume</button>
    </div>
    <div v-else class="dd-table-wrap">
      <table class="dd-table">
        <thead><tr>
          <th class="dd-check"><input type="checkbox" class="dd-cb" aria-label="Select all" :checked="allChecked" @change="toggleAll" /></th>
          <th>Name</th><th>Status</th><th>Created</th><th>Size</th><th>Scheduled exports</th><th class="dd-actions">Actions</th>
        </tr></thead>
        <tbody>
          <tr v-for="v in shown" :key="v.name" :class="{ 'is-selected': selected.includes(v.name) }">
            <td class="dd-check"><input type="checkbox" class="dd-cb" :aria-label="`Select ${v.name}`" :checked="selected.includes(v.name)" @change="toggle(v.name)" /></td>
            <td>
              <div class="dd-name-cell">
                <DdIcon name="volumes" :size="18" class="vv-icon" />
                <button type="button" class="dd-link vv-name" :title="v.name" @click="$emit('go', { page: 'volumes', id: v.name })">{{ v.anonymous ? v.name.slice(0, 12) + '…' : v.name }}</button>
                <span v-if="v.anonymous" class="dd-chip">anonymous</span>
              </div>
            </td>
            <td><span class="dd-status"><span class="dd-dot" :class="{ 'dd-dot--green': v.used_by.length }"></span>{{ v.used_by.length ? 'In use' : '-' }}</span></td>
            <td>{{ v.created_ago || '-' }}</td>
            <td>{{ v.size || '0 B' }}</td>
            <td class="dd-muted">-</td>
            <td class="dd-actions">
              <span class="dd-actions-inner">
                <DdMenu :items="[{ key: 'view', label: 'View details', icon: 'info' }, { key: 'data', label: 'Stored data', icon: 'folder' }]"
                        label="More volume actions" @select="key => $emit('go', { page: 'volumes', id: v.name, tab: key === 'data' ? 'data' : 'containers' })" />
                <button type="button" class="dd-icon-btn dd-icon-btn--danger" title="Delete" aria-label="Delete" @click="deleting = [v.name]"><DdIcon name="trash" /></button>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <DdModal v-if="creating" title="New Volume" @close="creating = false">
      <div class="dd-field">
        <label for="vv-name">Volume name</label>
        <input id="vv-name" v-model="newName" class="dd-input" :class="{ 'is-invalid': nameError }" placeholder="my-volume" @keydown.enter="create" />
        <small v-if="!nameError">Leave empty and Docker generates a name.</small>
        <span v-else class="dd-err">{{ nameError }}</span>
      </div>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="creating = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--primary" :disabled="busy || !!nameError" @click="create">Create</button>
      </template>
    </DdModal>

    <DdModal v-if="deleting.length" :title="deleting.length > 1 ? 'Delete volumes?' : 'Delete volume?'" @close="deleting = []">
      <p v-if="deleting.length === 1">Are you sure you want to delete <b>{{ short(deleting[0]) }}</b>? All the data in it is deleted and cannot be recovered.</p>
      <p v-else>Are you sure you want to delete these {{ deleting.length }} volumes? All their data is deleted and cannot be recovered.</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="deleting = []">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="confirmDelete">Delete forever</button>
      </template>
    </DdModal>

    <DdModal v-if="pruning" title="Delete unused volumes?" @close="pruning = false">
      <p>{{ unusedCount }} volume{{ unusedCount === 1 ? '' : 's' }} not referenced by any container will be deleted with all their data
        (<span class="dd-mono">docker volume prune</span>).</p>
      <template #footer>
        <button type="button" class="dd-btn dd-btn--ghost" @click="pruning = false">Cancel</button>
        <button type="button" class="dd-btn dd-btn--danger" :disabled="busy" @click="prune">Delete forever</button>
      </template>
    </DdModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import DdIcon from './DdIcon.vue';
import DdMenu from './DdMenu.vue';
import DdModal from './DdModal.vue';
import { cmd, NAME_RE, volumes, type DdRoute } from './dd';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; busy?: boolean; route: DdRoute }>();
defineEmits<{ (event: 'go', route: DdRoute): void; (event: 'refresh'): void }>();

const filter = ref('');
const show = ref('all');
const selected = ref<string[]>([]);
const creating = ref(false);
const newName = ref('');
const deleting = ref<string[]>([]);
const pruning = ref(false);

const list = computed(() => volumes(props.view));
const shown = computed(() => list.value
  .filter(v => show.value === 'all' || (show.value === 'used' ? v.used_by.length : !v.used_by.length))
  .filter(v => matches(v as any, filter.value, ['name', 'driver'])));
const unusedCount = computed(() => list.value.filter(v => !v.used_by.length).length);
const allChecked = computed(() => shown.value.length > 0 && shown.value.every(v => selected.value.includes(v.name)));
const nameError = computed(() => {
  if (!newName.value) return '';
  if (!NAME_RE.test(newName.value)) return 'Invalid name. Only [a-zA-Z0-9][a-zA-Z0-9_.-] are allowed.';
  if (list.value.some(v => v.name === newName.value)) return 'A volume with this name already exists.';
  return '';
});

function short(name: string) { return name.length > 40 ? name.slice(0, 12) + '…' : name; }
function toggle(name: string) { selected.value = selected.value.includes(name) ? selected.value.filter(n => n !== name) : [...selected.value, name]; }
function toggleAll() { selected.value = allChecked.value ? [] : shown.value.map(v => v.name); }
function openCreate() { newName.value = ''; creating.value = true; }

async function create() {
  if (nameError.value) return;
  const command = newName.value ? cmd.volumeCreate(newName.value) : 'docker volume create';
  const result = await props.api.exec(command, { success: newName.value ? `Volume ${newName.value} created` : 'Volume created' });
  if (result.ok) creating.value = false;
}
async function confirmDelete() {
  const names = deleting.value;
  const result = await props.api.exec(cmd.volumeRm(names), { success: names.length > 1 ? `Deleted ${names.length} volumes` : `Deleted ${short(names[0])}` });
  if (result.ok) { deleting.value = []; selected.value = selected.value.filter(n => !names.includes(n)); }
}
async function prune() {
  const result = await props.api.exec(cmd.volumePrune(), { success: 'Deleted unused volumes' });
  if (result.ok) pruning.value = false;
}
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.dd-spacer { flex: 1; }
.vv-show { width: auto; }
.vv-icon { color: var(--dd-text-2); }
.vv-name { font-weight: 500; }
</style>
