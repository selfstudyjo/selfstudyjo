<template>
  <div class="list">
    <div class="bar">
      <button type="button" class="icon-btn" :aria-label="title + ' list menu'" title="List controls">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
      </button>
      <h1 class="bar__title">{{ title }}</h1>
      <form class="list__search" role="search" @submit.prevent>
        <select v-model="searchField" class="select list__search-field" aria-label="Search field">
          <option v-for="col in searchable" :key="col.key" :value="col.key">{{ col.label }}</option>
        </select>
        <input v-model="searchText" class="input" type="search" placeholder="Search" :aria-label="'Search ' + title" />
      </form>
      <span class="bar__spacer"></span>
      <slot name="actions" />
      <button v-if="newLabel !== ''" type="button" class="btn btn--primary" @click="$emit('new')">{{ newLabel || 'New' }}</button>
      <div class="list__gear-wrap">
        <button type="button" class="icon-btn" aria-label="Personalize list" title="Personalize list" @click="gearOpen = !gearOpen">
          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.3" fill="none" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
        </button>
        <div v-if="gearOpen" class="list__gear card">
          <div class="card__head"><h3 class="card__title">Personalize List Columns</h3></div>
          <div class="card__body">
            <label v-for="col in columns" :key="col.key" class="list__gear-row">
              <input type="checkbox" :checked="!hidden.includes(col.key)" :disabled="col.key === columns[0].key"
                     @change="toggleColumn(col.key)" /> {{ col.label }}
            </label>
            <button type="button" class="btn btn--sm" @click="hidden = []">Reset to column defaults</button>
          </div>
        </div>
      </div>
    </div>

    <div class="list__crumbs">
      <slot name="filters" />
      <nav class="crumbs" aria-label="Filter conditions">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12l-4.6 5.4V13l-2.8 1.2V8.4z" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round" /></svg>
        <template v-for="(crumb, i) in allCrumbs" :key="i">
          <span v-if="i" class="crumbs__sep">&gt;</span>
          <button type="button" class="crumbs__item" :class="{ 'is-last': i === allCrumbs.length - 1 }" @click="crumb.go()">{{ crumb.label }}</button>
        </template>
      </nav>
    </div>

    <div class="list__scroll table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th class="list__check"><input type="checkbox" aria-label="Select all" :checked="allSelected" @change="toggleAll" /></th>
            <th class="list__info" aria-label="Preview"></th>
            <th v-for="col in shown" :key="col.key" :class="{ num: col.numeric }">
              <button type="button" class="list__sort" :aria-label="'Sort by ' + col.label" @click="sort(col.key)">
                {{ col.label }}
                <span class="list__arrow" :class="{ 'is-on': sortKey === col.key }">{{ sortKey === col.key && sortDir === 'desc' ? '▼' : '▲' }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visible" :key="String(row[rowKey])" :class="{ 'is-selected': selected.includes(String(row[rowKey])) }">
            <td class="list__check"><input type="checkbox" :aria-label="'Select ' + row[rowKey]" :checked="selected.includes(String(row[rowKey]))" @change="toggleRow(String(row[rowKey]))" /></td>
            <td class="list__info">
              <button type="button" class="list__i" :aria-label="'Preview ' + row[rowKey]" @click="$emit('open', row)">i</button>
            </td>
            <td v-for="(col, ci) in shown" :key="col.key" :class="{ num: col.numeric }">
              <slot name="cell" :row="row" :col="col">
                <button v-if="ci === 0" type="button" class="link" @click="$emit('open', row)">{{ row[col.key] }}</button>
                <template v-else>{{ display(row[col.key]) }}</template>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!visible.length" class="empty">No records to display</div>
    </div>

    <div class="list__foot">
      <select v-if="bulkActions.length" class="select list__bulk" aria-label="Actions on selected rows" :disabled="!selected.length"
              @change="bulk(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
        <option value="">Actions on selected rows...</option>
        <option v-for="a in bulkActions" :key="a" :value="a">{{ a }}</option>
      </select>
      <span class="bar__spacer"></span>
      <span class="muted">{{ visible.length ? 1 : 0 }} to {{ visible.length }} of {{ visible.length }}</span>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
/** A Next Experience classic list: title bar, search, condition breadcrumb, sortable columns. */
import { computed, ref, watch } from 'vue';
import { matches, sortBy } from '@/utils/portalKit';

export interface Column { key: string; label: string; numeric?: boolean; search?: boolean }

const props = withDefaults(defineProps<{
  title: string; columns: Column[]; rows: T[]; rowKey?: string; newLabel?: string;
  crumbs?: { label: string; go: () => void }[]; initialText?: string; bulkActions?: string[];
  defaultSort?: string; defaultDir?: 'asc' | 'desc';
}>(), { rowKey: 'number', newLabel: 'New', crumbs: () => [], initialText: '', bulkActions: () => [], defaultSort: '', defaultDir: 'asc' });
const emit = defineEmits<{ (event: 'new'): void; (event: 'open', row: T): void; (event: 'bulk', action: string, keys: string[]): void }>();

const searchable = computed(() => props.columns.filter(c => c.search !== false));
const searchField = ref(searchable.value[0]?.key || '');
const searchText = ref(props.initialText);
const sortKey = ref(props.defaultSort);
const sortDir = ref<'asc' | 'desc'>(props.defaultDir);
const hidden = ref<string[]>([]);
const gearOpen = ref(false);
const selected = ref<string[]>([]);

watch(() => props.initialText, value => { searchText.value = value; });

const shown = computed(() => props.columns.filter(c => !hidden.value.includes(c.key)));
const filtered = computed(() => {
  const fields = props.initialText && searchText.value === props.initialText
    ? props.columns.map(c => c.key) : [searchField.value];
  return props.rows.filter(row => matches(row, searchText.value, fields));
});
const visible = computed(() => (sortKey.value ? sortBy(filtered.value, sortKey.value, sortDir.value) : filtered.value));
const allSelected = computed(() => visible.value.length > 0 && visible.value.every(r => selected.value.includes(String(r[props.rowKey]))));
const allCrumbs = computed(() => {
  const list = [{ label: 'All', go: () => { searchText.value = ''; } }, ...props.crumbs];
  if (searchText.value.trim()) {
    const col = props.columns.find(c => c.key === searchField.value);
    list.push({ label: `${col && !(props.initialText && searchText.value === props.initialText) ? col.label : 'Keywords'} contains ${searchText.value.trim()}`, go: () => {} });
  }
  return list;
});

function sort(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = 'asc'; }
}
function toggleColumn(key: string) {
  hidden.value = hidden.value.includes(key) ? hidden.value.filter(k => k !== key) : [...hidden.value, key];
}
function toggleRow(key: string) {
  selected.value = selected.value.includes(key) ? selected.value.filter(k => k !== key) : [...selected.value, key];
}
function toggleAll() {
  selected.value = allSelected.value ? [] : visible.value.map(r => String(r[props.rowKey]));
}
function bulk(action: string) {
  if (!action) return;
  emit('bulk', action, [...selected.value]);
  selected.value = [];
}
function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}
</script>

<style scoped src="./sn.css"></style>
<style scoped>
.list { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--sn-surface); }
.list__search { display: flex; align-items: center; gap: 0; min-width: 0; }
.list__search .select { width: auto; max-width: 160px; border-radius: var(--sn-radius) 0 0 var(--sn-radius); border-right: 0; background: var(--sn-surface-alt); }
.list__search .input { width: 208px; border-radius: 0 var(--sn-radius) var(--sn-radius) 0; }
.list__gear-wrap { position: relative; }
.list__gear { position: absolute; right: 0; top: 36.8px; z-index: 5; width: 256px; }
.list__gear-row { display: flex; align-items: center; gap: 7.2px; padding: 3.2px 0; font-size: 13px; }
.list__gear .btn { margin-top: 8px; }
.list__crumbs { display: flex; align-items: center; gap: 9.6px; flex-wrap: wrap; padding: 7.2px 16px; border-bottom: 1px solid var(--sn-border); }
.crumbs { display: flex; align-items: center; gap: 4.8px; flex-wrap: wrap; font-size: 13px; }
.crumbs svg { width: 14.4px; height: 14.4px; color: var(--sn-text-muted); }
.crumbs__item { min-width: 16px; padding: 0 2px; margin: 0 -2px; border: 0; background: none; color: var(--sn-link); font: inherit; cursor: pointer; }
.crumbs__item:hover { text-decoration: underline; }
.crumbs__item.is-last { color: var(--sn-text); }
.crumbs__sep { color: var(--sn-text-muted); }
.list__scroll { flex: 1; min-height: 0; overflow: auto; }
.list__check { width: 32px; }
.list__info { width: 25.6px; padding-left: 0 !important; padding-right: 0 !important; }
.list__i { display: grid; place-items: center; width: 20px; height: 20px; border: 1px solid var(--sn-border-strong); border-radius: 50%;
  background: var(--sn-surface); color: var(--sn-text-muted); font: italic 700 12px Georgia, serif; cursor: pointer; }
.list__sort { display: inline-flex; align-items: center; gap: 4.8px; padding: 0; border: 0; background: none; color: inherit; font: inherit; font-weight: 700; cursor: pointer; }
.list__arrow { font-size: 12px; color: var(--sn-text-muted); opacity: 0; }
.list__sort:hover .list__arrow { opacity: 1; }
.list__arrow.is-on { color: var(--sn-text) !important; opacity: 1; }
tr.is-selected td { background: #ececfb; }
.list__foot { display: flex; align-items: center; gap: 9.6px; padding: 7.2px 16px; border-top: 1px solid var(--sn-border); font-size: 13px; background: var(--sn-surface-alt); }
.list__bulk { width: auto; }

@container sl-portal (max-width: 760px) {
  .list__search .input { width: 128px; }
  .list__search .select { max-width: 104px; }
}
@container sl-portal (max-width: 640px) {
  .list__sort, .crumbs__item { min-height: 32px; }
  .list__info { width: 36px; }
  .list__i { width: 28px; height: 28px; }
}
@container sl-portal (max-width: 520px) {
  .list__search { order: 9; width: 100%; }
  .list__search .input { flex: 1; width: auto; }
}
</style>
