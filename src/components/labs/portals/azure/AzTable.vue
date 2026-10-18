<template>
  <div class="az-tablewrap">
    <table class="az-table">
      <thead>
        <tr>
          <th v-if="selectable" class="az-cb">
            <input type="checkbox" :checked="allOn" :indeterminate.prop="someOn" aria-label="Select all"
                   @change="toggleAll" />
          </th>
          <th v-for="col in columns" :key="col.key" :style="col.width ? { width: col.width } : undefined">
            <button v-if="col.sortable !== false" type="button" @click="sort(col.key)">
              {{ col.label }}
              <span v-if="sortKey === col.key" aria-hidden="true">{{ dir === 'asc' ? '↑' : '↓' }}</span>
              <span v-else class="az-sorthint" aria-hidden="true">↑↓</span>
            </button>
            <span v-else>{{ col.label }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in sorted" :key="String(row[rowKey])" :class="{ 'is-sel': isOn(row) }">
          <td v-if="selectable" class="az-cb">
            <input type="checkbox" :checked="isOn(row)" :aria-label="'Select ' + row[rowKey]" @change="toggle(row)" />
          </td>
          <td v-for="col in columns" :key="col.key">
            <slot :name="'cell-' + col.key" :row="row" :value="row[col.key]">{{ show(row[col.key]) }}</slot>
          </td>
        </tr>
        <tr v-if="!sorted.length">
          <td :colspan="columns.length + (selectable ? 1 : 0)" class="az-tableempty">
            <div class="az-tableempty__msg"><slot name="empty">No results.</slot></div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
/** The portal's grid: selection checkboxes, sortable headers, cell slots. */
import { computed, ref } from 'vue';
import { sortBy } from '@/utils/portalKit';

export interface AzColumn { key: string; label: string; width?: string; sortable?: boolean }

const props = withDefaults(defineProps<{
  columns: AzColumn[];
  rows: Record<string, any>[];
  rowKey?: string;
  selectable?: boolean;
  selected?: string[];
}>(), { rowKey: 'id', selectable: false, selected: () => [] });

const emit = defineEmits<{ (event: 'update:selected', value: string[]): void }>();

const sortKey = ref('');
const dir = ref<'asc' | 'desc'>('asc');
const sorted = computed(() => (sortKey.value ? sortBy(props.rows, sortKey.value, dir.value) : props.rows));

function sort(key: string) {
  if (sortKey.value === key) dir.value = dir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; dir.value = 'asc'; }
}
function show(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ') || '—';
  return String(value);
}
const keys = computed(() => props.rows.map(r => String(r[props.rowKey])));
const allOn = computed(() => keys.value.length > 0 && keys.value.every(k => props.selected.includes(k)));
const someOn = computed(() => !allOn.value && keys.value.some(k => props.selected.includes(k)));
function isOn(row: Record<string, any>) { return props.selected.includes(String(row[props.rowKey])); }
function toggle(row: Record<string, any>) {
  const key = String(row[props.rowKey]);
  emit('update:selected', isOn(row) ? props.selected.filter(k => k !== key) : [...props.selected, key]);
}
function toggleAll() { emit('update:selected', allOn.value ? [] : [...keys.value]); }
</script>

<style scoped>
.az-sorthint { opacity: 0; color: #707070; font-weight: 400; }
th:hover .az-sorthint { opacity: 1; }
.az-tableempty { padding: 28px 8px !important; text-align: center; color: #616161; white-space: normal; }
/* a wide grid scrolls sideways; its empty message stays in view and wraps to the visible width */
.az-tableempty__msg { position: sticky; left: 8px; width: min(100%, calc(100cqw - 56px)); }
</style>
