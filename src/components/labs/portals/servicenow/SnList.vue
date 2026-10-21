<template>
  <div class="list">
    <div class="bar">
      <button type="button" class="icon-btn" :aria-label="title + ' list menu'" title="List controls" @click="openTitleMenu">
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
            <label class="list__gear-row list__gear-sep"><input v-model="wrapText" type="checkbox" /> Wrap column text</label>
            <button type="button" class="btn btn--sm" @click="hidden = []">Reset to column defaults</button>
          </div>
        </div>
      </div>
    </div>

    <div class="list__crumbs">
      <button type="button" class="icon-btn list__funnel" :class="{ 'is-on': builderOpen }" :aria-expanded="builderOpen"
              aria-label="Show / hide filter" title="Show / hide filter" @click="toggleBuilder">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12l-4.6 5.4V13l-2.8 1.2V8.4z" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round" /></svg>
      </button>
      <slot name="filters" />
      <nav class="crumbs" aria-label="Filter conditions">
        <template v-for="(crumb, i) in allCrumbs" :key="i">
          <span v-if="i" class="crumbs__sep">&gt;</span>
          <button type="button" class="crumbs__item" :class="{ 'is-last': i === allCrumbs.length - 1 }"
                  :title="i < allCrumbs.length - 1 ? 'Remove the conditions after this one' : ''" @click="crumb.go()">{{ crumb.label }}</button>
        </template>
      </nav>
    </div>

    <!-- Condition builder -->
    <div v-if="builderOpen" class="cb">
      <div class="cb__head">
        <b>All of these conditions must be met</b>
        <span class="bar__spacer"></span>
        <button type="button" class="btn btn--sm btn--primary" @click="runBuilder">Run</button>
        <button type="button" class="btn btn--sm" @click="draft = []">Clear all</button>
        <button type="button" class="btn btn--sm" @click="builderOpen = false">Close</button>
      </div>
      <div v-for="(cond, i) in draft" :key="i" class="cb__row">
        <span class="cb__and">{{ i ? 'and' : '' }}</span>
        <select v-model="cond.field" class="select cb__field" :aria-label="'Field ' + (i + 1)">
          <option v-for="col in filterable" :key="col.key" :value="col.key">{{ col.label }}</option>
        </select>
        <select v-model="cond.op" class="select cb__op" :aria-label="'Operator ' + (i + 1)">
          <option v-for="op in OPS" :key="op.id" :value="op.id">{{ op.label }}</option>
        </select>
        <input v-if="!['empty', 'notempty'].includes(cond.op)" v-model="cond.value" class="input cb__value" :list="'cb-values-' + uid + '-' + i"
               :aria-label="'Value ' + (i + 1)" @keydown.enter.prevent="runBuilder" />
        <datalist :id="'cb-values-' + uid + '-' + i"><option v-for="v in valuesOf(cond.field)" :key="v" :value="v" /></datalist>
        <button type="button" class="icon-btn" :aria-label="'Remove condition ' + (i + 1)" @click="draft.splice(i, 1)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
        </button>
      </div>
      <div class="cb__foot">
        <button type="button" class="btn btn--sm" @click="addDraft">AND</button>
        <span v-if="!draft.length" class="muted">No conditions. Add one with AND, or Run to show every record.</span>
      </div>
    </div>

    <div class="list__scroll table-wrap">
      <table class="table" :class="{ 'is-wrapped': wrapText }">
        <thead>
          <tr @contextmenu="headMenu($event, '')">
            <th class="list__check"><input type="checkbox" aria-label="Select all" :checked="allSelected" @change="toggleAll" /></th>
            <th class="list__info" aria-label="Preview"></th>
            <th v-for="col in shown" :key="col.key" :class="{ num: col.numeric }" @contextmenu.stop="headMenu($event, col.key)">
              <button type="button" class="list__sort" :aria-label="'Sort by ' + col.label" @click="sort(col.key)">
                {{ col.label }}
                <span class="list__arrow" :class="{ 'is-on': sortKey === col.key }">{{ sortKey === col.key && sortDir === 'desc' ? '▼' : '▲' }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in grouped" :key="group.value">
            <tr v-if="groupKey" class="list__group">
              <td :colspan="shown.length + 2">
                <button type="button" class="list__group-btn" :aria-expanded="!collapsed.includes(group.value)" @click="toggleGroup(group.value)">
                  <span class="list__caret" :class="{ 'is-open': !collapsed.includes(group.value) }">▶</span>
                  {{ groupLabel }}: <b>{{ group.value || '(empty)' }}</b> <span class="muted">({{ group.rows.length }})</span>
                </button>
              </td>
            </tr>
            <template v-if="!groupKey || !collapsed.includes(group.value)">
              <tr v-for="row in group.rows" :key="String(row[rowKey])" :class="{ 'is-selected': selected.includes(String(row[rowKey])) }">
                <td class="list__check"><input type="checkbox" :aria-label="'Select ' + row[rowKey]" :checked="selected.includes(String(row[rowKey]))" @change="toggleRow(String(row[rowKey]))" /></td>
                <td class="list__info">
                  <button type="button" class="list__i" :aria-label="'Preview ' + row[rowKey]" @click="$emit('open', row)">i</button>
                </td>
                <td v-for="(col, ci) in shown" :key="col.key" :class="{ num: col.numeric }" @contextmenu="cellMenu($event, row, col.key)">
                  <slot name="cell" :row="row" :col="col">
                    <button v-if="ci === 0" type="button" class="link" @click="$emit('open', row)">{{ row[col.key] }}</button>
                    <template v-else>{{ display(row[col.key]) }}</template>
                  </slot>
                </td>
              </tr>
            </template>
          </template>
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
      <span v-if="selected.length" class="muted">{{ selected.length }} selected</span>
      <span class="bar__spacer"></span>
      <span class="muted">{{ visible.length ? 1 : 0 }} to {{ visible.length }} of {{ visible.length }}</span>
    </div>

    <SnMenu v-if="menu" :x="menu.x" :y="menu.y" :items="menu.items" :label="menu.label" @select="menuPick" @close="menu = null" />
  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
/**
 * A Next Experience classic list: title bar, search, condition breadcrumb and
 * condition builder, sortable columns, group by, and the two context menus the
 * platform has on every list - right-click a column header (sort, group by,
 * hide, export) or a cell (Show Matching, Filter Out, Copy URL / sys_id, and
 * whatever the page adds, e.g. Assign to me).
 *
 * Conditions match on the text the cell SHOWS (`textOf`), so "Caller is
 * Amira Khan" means what the student read rather than an internal id.
 */
import { computed, ref, watch } from 'vue';
import { matches, sortBy } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import SnMenu, { type SnMenuItem } from './SnMenu.vue';
import { copyText, downloadText } from './clip';
import { BASE, csvCell, recordUrl, sysId } from './snow';

export interface Column { key: string; label: string; numeric?: boolean; search?: boolean }
export interface RowAction<R = any> { id: string; label: string; disabled?: (row: R) => boolean }
interface Condition { field: string; op: string; value: string }

const OPS = [
  { id: 'is', label: 'is' }, { id: 'isnot', label: 'is not' }, { id: 'contains', label: 'contains' },
  { id: 'notcontains', label: 'does not contain' }, { id: 'starts', label: 'starts with' },
  { id: 'empty', label: 'is empty' }, { id: 'notempty', label: 'is not empty' },
];

const props = withDefaults(defineProps<{
  title: string; columns: Column[]; rows: T[]; rowKey?: string; newLabel?: string;
  crumbs?: { label: string; go: () => void }[]; initialText?: string; bulkActions?: string[];
  defaultSort?: string; defaultDir?: 'asc' | 'desc';
  /** The table name, for Copy URL / sys_id and the export file (`incident`, `problem`...). */
  table?: string;
  /** The text a cell shows, for conditions, grouping and export. */
  textOf?: (row: T, key: string) => string;
  rowActions?: RowAction<T>[];
  api?: PortalApi;
}>(), {
  rowKey: 'number', newLabel: 'New', crumbs: () => [], initialText: '', bulkActions: () => [], defaultSort: '',
  defaultDir: 'asc', table: '', textOf: undefined, rowActions: () => [], api: undefined,
});
const emit = defineEmits<{
  (event: 'new'): void; (event: 'open', row: T): void; (event: 'bulk', action: string, keys: string[]): void;
  (event: 'row-action', action: string, row: T): void;
}>();

const uid = Math.random().toString(36).slice(2, 8);
const searchable = computed(() => props.columns.filter(c => c.search !== false));
const filterable = computed(() => props.columns);
const searchField = ref(searchable.value[0]?.key || '');
const searchText = ref(props.initialText);
const sortKey = ref(props.defaultSort);
const sortDir = ref<'asc' | 'desc'>(props.defaultDir);
const hidden = ref<string[]>([]);
const gearOpen = ref(false);
const wrapText = ref(false);
const selected = ref<string[]>([]);
const conditions = ref<Condition[]>([]);
const draft = ref<Condition[]>([]);
const builderOpen = ref(false);
const groupKey = ref('');
const collapsed = ref<string[]>([]);
const menu = ref<{ x: number; y: number; items: SnMenuItem[]; label: string; row?: any; key?: string } | null>(null);

watch(() => props.initialText, value => { searchText.value = value; });

function text(row: T, key: string): string {
  if (props.textOf) {
    const shown = props.textOf(row, key);
    if (shown !== undefined && shown !== null) return String(shown);
  }
  return display(row[key]);
}
function test(row: T, cond: Condition): boolean {
  const have = text(row, cond.field).toLowerCase();
  const want = String(cond.value || '').trim().toLowerCase();
  switch (cond.op) {
    case 'is': return have === want;
    case 'isnot': return have !== want;
    case 'contains': return have.includes(want);
    case 'notcontains': return !have.includes(want);
    case 'starts': return have.startsWith(want);
    case 'empty': return have === '';
    case 'notempty': return have !== '';
  }
  return true;
}
function condLabel(cond: Condition): string {
  const col = props.columns.find(c => c.key === cond.field)?.label || cond.field;
  const op = OPS.find(o => o.id === cond.op)?.label || cond.op;
  return ['empty', 'notempty'].includes(cond.op) ? `${col} ${op}` : `${col} ${op} ${cond.value}`;
}

const shown = computed(() => props.columns.filter(c => !hidden.value.includes(c.key)));
const filtered = computed(() => {
  const fields = props.initialText && searchText.value === props.initialText
    ? props.columns.map(c => c.key) : [searchField.value];
  return props.rows
    .filter(row => matches(row, searchText.value, fields) || (searchText.value.trim() !== '' && fields.some(f =>
      text(row, f).toLowerCase().includes(searchText.value.trim().toLowerCase()))))
    .filter(row => conditions.value.every(cond => test(row, cond)));
});
const visible = computed(() => (sortKey.value ? sortBy(filtered.value, sortKey.value, sortDir.value) : filtered.value));
const grouped = computed(() => {
  if (!groupKey.value) return [{ value: '', rows: visible.value }];
  const out: { value: string; rows: T[] }[] = [];
  for (const row of visible.value) {
    const value = text(row, groupKey.value);
    let bucket = out.find(g => g.value === value);
    if (!bucket) { bucket = { value, rows: [] }; out.push(bucket); }
    bucket.rows.push(row);
  }
  return out;
});
const groupLabel = computed(() => props.columns.find(c => c.key === groupKey.value)?.label || groupKey.value);
const allSelected = computed(() => visible.value.length > 0 && visible.value.every(r => selected.value.includes(String(r[props.rowKey]))));
const allCrumbs = computed(() => {
  const list = [{ label: 'All', go: () => { searchText.value = ''; conditions.value = []; } }, ...props.crumbs];
  conditions.value.forEach((cond, i) => {
    list.push({ label: condLabel(cond), go: () => { conditions.value = conditions.value.slice(0, i + 1); } });
  });
  if (groupKey.value) list.push({ label: `Group by ${groupLabel.value}`, go: () => { groupKey.value = ''; } });
  if (searchText.value.trim()) {
    const col = props.columns.find(c => c.key === searchField.value);
    list.push({ label: `${col && !(props.initialText && searchText.value === props.initialText) ? col.label : 'Keywords'} contains ${searchText.value.trim()}`, go: () => {} });
  }
  return list;
});

function sort(key: string, dir?: 'asc' | 'desc') {
  if (dir) { sortKey.value = key; sortDir.value = dir; return; }
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
function toggleGroup(value: string) {
  collapsed.value = collapsed.value.includes(value) ? collapsed.value.filter(v => v !== value) : [...collapsed.value, value];
}
function bulk(action: string) {
  if (!action) return;
  emit('bulk', action, [...selected.value]);
  selected.value = [];
}
function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}
function valuesOf(key: string): string[] {
  return [...new Set(props.rows.map(r => text(r, key)).filter(Boolean))].slice(0, 40);
}

// ---- condition builder ----
function toggleBuilder() {
  builderOpen.value = !builderOpen.value;
  if (builderOpen.value) {
    draft.value = conditions.value.map(c => ({ ...c }));
    if (!draft.value.length) addDraft();
  }
}
function addDraft() { draft.value.push({ field: filterable.value[0]?.key || '', op: 'is', value: '' }); }
function runBuilder() {
  conditions.value = draft.value.filter(c => c.field && (['empty', 'notempty'].includes(c.op) || String(c.value).trim() !== ''))
    .map(c => ({ ...c, value: String(c.value).trim() }));
  builderOpen.value = false;
}

// ---- context menus ----
function notify(type: 'success' | 'error' | 'info', title: string) { props.api?.notify(type, title); }
async function copy(value: string, what: string) {
  const ok = await copyText(value);
  notify(ok ? 'success' : 'error', ok ? `${what} copied to clipboard` : 'Could not copy to the clipboard');
}
function headMenu(event: MouseEvent, key: string) {
  event.preventDefault();
  openHead(event.clientX, event.clientY, key);
}
function openHead(x: number, y: number, key: string) {
  const items: SnMenuItem[] = [];
  if (key) {
    const label = props.columns.find(c => c.key === key)?.label || key;
    items.push({ id: 'sort-asc', text: 'Sort (a to z)' }, { id: 'sort-desc', text: 'Sort (z to a)' },
      groupKey.value === key ? { id: 'ungroup', text: 'Ungroup' } : { id: 'group', text: `Group By ${label}` },
      { id: 'divider-1', divider: true },
      { id: 'hide', text: `Hide column "${label}"`, disabled: key === props.columns[0]?.key });
  } else if (groupKey.value) {
    items.push({ id: 'ungroup', text: 'Ungroup' });
  }
  items.push({ id: 'filter', text: builderOpen.value ? 'Hide filter' : 'Show filter' },
    { id: 'personalize', text: 'Configure > Personalize columns' },
    { id: 'divider-2', divider: true }, { id: 'heading-export', text: 'Export', heading: true },
    { id: 'export-csv', text: 'CSV', sub: true }, { id: 'export-selected', text: 'CSV (selected rows)', sub: true, disabled: !selected.value.length },
    { id: 'divider-3', divider: true }, { id: 'copy-list-url', text: 'Copy URL' });
  menu.value = { x, y, items, label: 'Column options', key };
}
function cellMenu(event: MouseEvent, row: T, key: string) {
  const target = event.target as HTMLElement;
  if (target.closest('input, textarea, select')) return;
  event.preventDefault();
  const items: SnMenuItem[] = [
    { id: 'open', text: 'Open record' },
    { id: 'divider-0', divider: true },
    { id: 'match', text: 'Show Matching' }, { id: 'out', text: 'Filter Out' },
    { id: 'divider-1', divider: true },
  ];
  for (const action of props.rowActions) {
    items.push({ id: 'action:' + action.id, text: action.label, disabled: action.disabled ? action.disabled(row) : false });
  }
  if (props.rowActions.length) items.push({ id: 'divider-2', divider: true });
  items.push({ id: 'copy-value', text: 'Copy field value' }, { id: 'copy-url', text: 'Copy URL', disabled: !props.table },
    { id: 'copy-sys', text: 'Copy sys_id', disabled: !props.table });
  menu.value = { x: event.clientX, y: event.clientY, items, label: 'Record options', row, key };
}
function exportCsv(onlySelected: boolean) {
  const rows = visible.value.filter(r => !onlySelected || selected.value.includes(String(r[props.rowKey])));
  const lines = [shown.value.map(c => csvCell(c.label)).join(',')];
  for (const row of rows) lines.push(shown.value.map(c => csvCell(text(row, c.key))).join(','));
  const name = `${props.table || props.title.toLowerCase().replace(/\s+/g, '_')}.csv`;
  downloadText(name, lines.join('\r\n') + '\r\n');
  notify('success', `Export complete: ${rows.length} record${rows.length === 1 ? '' : 's'} to ${name}`);
}
async function menuPick(id: string) {
  const m = menu.value;
  if (!m) return;
  const row = m.row;
  const key = m.key || '';
  if (id === 'sort-asc') sort(key, 'asc');
  else if (id === 'sort-desc') sort(key, 'desc');
  else if (id === 'group') { groupKey.value = key; collapsed.value = []; }
  else if (id === 'ungroup') groupKey.value = '';
  else if (id === 'hide') toggleColumn(key);
  else if (id === 'filter') toggleBuilder();
  else if (id === 'personalize') gearOpen.value = true;
  else if (id === 'export-csv') exportCsv(false);
  else if (id === 'export-selected') exportCsv(true);
  else if (id === 'copy-list-url') await copy(`${BASE}/${props.table || 'task'}_list.do`, 'URL');
  else if (row) {
    const rowId = String(row[props.rowKey]);
    if (id === 'open') emit('open', row);
    else if (id === 'match' || id === 'out') {
      const value = text(row, key);
      conditions.value = [...conditions.value, value === ''
        ? { field: key, op: id === 'match' ? 'empty' : 'notempty', value: '' }
        : { field: key, op: id === 'match' ? 'is' : 'isnot', value }];
    } else if (id === 'copy-value') await copy(text(row, key), 'Value');
    else if (id === 'copy-url') await copy(recordUrl(props.table, rowId), 'URL');
    else if (id === 'copy-sys') await copy(sysId(props.table, rowId), 'sys_id');
    else if (id.startsWith('action:')) emit('row-action', id.slice(7), row);
  }
}
function openTitleMenu(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  openHead(rect.left, rect.bottom + 4, '');
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
.list__gear-sep { margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--sn-border); }
.list__gear .btn { margin-top: 8px; }
.list__crumbs { display: flex; align-items: center; gap: 9.6px; flex-wrap: wrap; padding: 7.2px 16px; border-bottom: 1px solid var(--sn-border); }
.list__funnel.is-on { background: #e8eaf6; color: var(--sn-brand); }
.crumbs { display: flex; align-items: center; gap: 4.8px; flex-wrap: wrap; font-size: 13px; }
.crumbs__item { min-width: 16px; padding: 0 2px; margin: 0 -2px; border: 0; background: none; color: var(--sn-link); font: inherit; cursor: pointer; }
.crumbs__item:hover { text-decoration: underline; }
.crumbs__item.is-last { color: var(--sn-text); }
.crumbs__sep { color: var(--sn-text-muted); }
.cb { padding: 9.6px 16px; border-bottom: 1px solid var(--sn-border); background: var(--sn-surface-alt); font-size: 13px; }
.cb__head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.cb__row { display: grid; grid-template-columns: 32px minmax(120px, 200px) minmax(110px, 160px) minmax(120px, 1fr) 32px; gap: 6.4px; align-items: center; margin-bottom: 6.4px; }
.cb__and { color: var(--sn-text-muted); font-style: italic; text-align: right; }
.cb__foot { display: flex; align-items: center; gap: 9.6px; }
.list__scroll { flex: 1; min-height: 0; overflow: auto; }
.list__check { width: 32px; }
.list__info { width: 25.6px; padding-left: 0 !important; padding-right: 0 !important; }
.list__i { display: grid; place-items: center; width: 20px; height: 20px; border: 1px solid var(--sn-border-strong); border-radius: 50%;
  background: var(--sn-surface); color: var(--sn-text-muted); font: italic 700 12px Georgia, serif; cursor: pointer; }
.list__sort { display: inline-flex; align-items: center; gap: 4.8px; padding: 0; border: 0; background: none; color: inherit; font: inherit; font-weight: 700; cursor: pointer; }
.list__arrow { font-size: 12px; color: var(--sn-text-muted); opacity: 0; }
.list__sort:hover .list__arrow { opacity: 1; }
.list__arrow.is-on { color: var(--sn-text) !important; opacity: 1; }
.table.is-wrapped td { white-space: normal; }
.list__group td { background: var(--sn-surface-alt) !important; padding: 4.8px 9.6px; }
.list__group-btn { display: inline-flex; align-items: center; gap: 6.4px; border: 0; background: none; font: inherit; color: var(--sn-text); cursor: pointer; padding: 0; }
.list__caret { display: inline-block; font-size: 9px; transition: transform .12s; color: var(--sn-text-muted); }
.list__caret.is-open { transform: rotate(90deg); }
tr.is-selected td { background: #ececfb; }
.list__foot { display: flex; align-items: center; gap: 9.6px; padding: 7.2px 16px; border-top: 1px solid var(--sn-border); font-size: 13px; background: var(--sn-surface-alt); }
.list__bulk { width: auto; }

@container sl-portal (max-width: 760px) {
  .list__search .input { width: 128px; }
  .list__search .select { max-width: 104px; }
  .cb__row { grid-template-columns: 24px minmax(0, 1fr) minmax(0, 1fr) 32px; }
  .cb__value { grid-column: 2 / 4; }
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
