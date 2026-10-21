<template>
  <div class="af-page">
    <div v-if="mode === 'list'" class="af-panel">
      <div class="af-panel__head">
        <h3 class="af-panel__title">List Pools</h3>
        <button type="button" class="af-btn af-btn--sm af-btn--primary af-btn--icon" title="Add a new record" aria-label="Add a new record" @click="startAdd"><AfIcon name="plus" /></button>
        <span class="af-spacer"></span>
        <span class="af-menu-anchor">
          <button type="button" class="af-btn af-btn--sm" :disabled="!selected.size" :aria-expanded="actions" @click.stop="actions = !actions">Actions <AfIcon name="caret" /></button>
          <div v-if="actions" class="af-menu af-pool__menu" role="menu">
            <button type="button" role="menuitem" class="is-danger" @click="deleteSelected">Delete</button>
          </div>
        </span>
      </div>
      <div class="af-panel__body">
        <FileIoBar noun="pools" label="Pools" default-file="pools.json" />
        <div class="af-table-wrap">
          <table class="af-table af-table--bordered af-table--striped">
            <thead>
              <tr>
                <th class="af-actions-col"><input type="checkbox" :checked="allChecked" aria-label="Select all" @change="toggleAll" /></th>
                <th class="af-actions-col"></th><th>Pool</th><th class="af-num">Slots</th><th class="af-num">Running Slots</th>
                <th class="af-num">Queued Slots</th><th class="af-num">Scheduled Slots</th><th class="af-num">Deferred Slots</th><th>Description</th><th>Include Deferred</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in shown" :key="p.pool">
                <td class="af-actions-col"><input type="checkbox" :checked="selected.has(p.pool)" :aria-label="'Select ' + p.pool" @change="toggle(p.pool)" /></td>
                <td class="af-actions-col"><span class="af-pool__rowact">
                  <button type="button" class="af-btn af-btn--xs" :aria-label="'Edit ' + p.pool" title="Edit record" @click="startEdit(p)"><AfIcon name="edit" /></button>
                  <button type="button" class="af-btn af-btn--xs" :aria-label="'Delete ' + p.pool" title="Delete record" @click="remove([p.pool])"><AfIcon name="trash" /></button></span></td>
                <td class="af-mono">{{ p.pool }}</td>
                <td class="af-num">{{ p.slots === -1 ? 'Infinite' : p.slots }}</td>
                <td class="af-num"><button type="button" class="af-link" @click="af.go({ page: 'tis' })">{{ p.running ?? 0 }}</button></td>
                <td class="af-num"><button type="button" class="af-link" @click="af.go({ page: 'tis' })">{{ p.queued ?? 0 }}</button></td>
                <td class="af-num">{{ p.scheduled ?? 0 }}</td>
                <td class="af-num">{{ p.deferred ?? 0 }}</td>
                <td>{{ p.description || (p.pool === 'default_pool' ? 'Default pool' : '') }}</td>
                <td>{{ p.include_deferred ? 'True' : 'False' }}</td>
              </tr>
              <tr v-if="!shown.length"><td colspan="10" class="af-empty-cell">No records found</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="af-panel__foot">Record Count: {{ shown.length }}</div>
    </div>

    <div v-else class="af-panel">
      <div class="af-panel__head"><h3 class="af-panel__title">{{ mode === 'add' ? 'Add Pool' : 'Edit Pool' }}</h3></div>
      <div class="af-panel__body af-pool__form">
        <label class="af-pool__row"><span class="af-label">Pool *</span>
          <input v-model="form.pool" class="af-input" :class="{ 'af-input--error': nameError }" :disabled="mode === 'edit'" aria-label="Pool" />
          <span v-if="nameError" class="af-error-text">{{ nameError }}</span></label>
        <label class="af-pool__row"><span class="af-label">Slots *</span>
          <input v-model="form.slots" class="af-input" inputmode="numeric" aria-label="Slots" />
          <span v-if="slotsError" class="af-error-text">{{ slotsError }}</span></label>
        <label class="af-pool__row"><span class="af-label">Description</span>
          <textarea v-model="form.description" class="af-textarea af-pool__desc" rows="2" aria-label="Description"></textarea></label>
        <div class="af-pool__row"><span class="af-label">Equivalent CLI</span><code class="af-pool__line">{{ command }}</code></div>
      </div>
      <div class="af-panel__foot">
        <button type="button" class="af-btn af-btn--primary" :disabled="Boolean(nameError || slotsError) || saving" @click="save">Save</button>
        <button type="button" class="af-btn" @click="mode = 'list'"><AfIcon name="chevron-left" /> Back</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { sortBy } from '@/utils/portalKit';
import AfIcon from './AfIcon.vue';
import FileIoBar from './FileIoBar.vue';
import { useAf } from './afContext';
import { CMD, type AfPool } from './airflow';

const af = useAf();
const mode = ref<'list' | 'add' | 'edit'>('list');
const selected = ref(new Set<string>());
const actions = ref(false);
const saving = ref(false);
const form = reactive({ pool: '', slots: '128', description: '' });
function close() { actions.value = false; }
onMounted(() => window.addEventListener('click', close));
onBeforeUnmount(() => window.removeEventListener('click', close));

const shown = computed(() => sortBy(af.pools.value, 'pool'));
const allChecked = computed(() => shown.value.length > 0 && shown.value.every(p => selected.value.has(p.pool)));
const nameError = computed(() => {
  const n = form.pool.trim();
  if (!n) return 'This field is required.';
  if (mode.value === 'add' && af.pools.value.some(p => p.pool === n)) return 'Already exists.';
  return '';
});
const slotsError = computed(() => (/^-?\d+$/.test(form.slots.trim()) && Number(form.slots) >= -1 ? '' : 'Slots must be a whole number (-1 for infinite).'));
const command = computed(() => CMD.setPool(form.pool.trim(), form.slots.trim(), form.description));

function toggle(n: string) { const s = new Set(selected.value); s.has(n) ? s.delete(n) : s.add(n); selected.value = s; }
function toggleAll() { selected.value = allChecked.value ? new Set() : new Set(shown.value.map(p => p.pool)); }
function startAdd() { Object.assign(form, { pool: '', slots: '128', description: '' }); mode.value = 'add'; }
function startEdit(p: AfPool) { Object.assign(form, { pool: p.pool, slots: String(p.slots ?? 128), description: p.description || '' }); mode.value = 'edit'; }

async function save() {
  if (nameError.value || slotsError.value) return;
  saving.value = true;
  const result = await af.run(command.value, { success: mode.value === 'add' ? 'Added Row' : 'Changed Row' });
  saving.value = false;
  if (result.ok) mode.value = 'list';
}

async function remove(names: string[]) {
  if (names.includes('default_pool')) { af.notify('error', 'default_pool cannot be deleted'); return; }
  if (!await af.confirm({ title: 'Delete', message: names.length === 1 ? 'You sure you want to delete this item?' : `You sure you want to delete the ${names.length} selected items?`,
    lines: names, yes: 'Delete', danger: true })) return;
  let ok = 0;
  for (const n of names) if ((await af.run(CMD.deletePool(n))).ok) ok += 1;
  if (ok) af.notify('success', ok === 1 ? 'Deleted Row' : `${ok} records deleted`);
  selected.value = new Set();
}
function deleteSelected() { actions.value = false; remove([...selected.value]); }
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-pool__menu { right: 0; top: 30px; }
.af-pool__rowact { display: inline-flex; gap: 2px; }
.af-pool__form { max-width: 700px; }
.af-pool__row { display: grid; grid-template-columns: 140px minmax(0, 1fr); align-items: start; column-gap: 12px; row-gap: 2px; }
.af-pool__row > .af-error-text { grid-column: 2; }
.af-pool__desc { min-height: 54px; font-family: inherit; }
.af-pool__line { display: block; padding: 6px 8px; color: #24292e; background: #f6f8fa; border: 1px solid #e1e4e8; overflow-wrap: anywhere; white-space: pre-wrap; }
@container sl-portal (max-width: 640px) {
  .af-pool__row { grid-template-columns: minmax(0, 1fr); }
  .af-pool__row > .af-error-text { grid-column: 1; }
}
</style>
