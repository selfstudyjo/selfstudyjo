<template>
  <div class="pg-dg">
    <div class="pg-dg__bar" role="toolbar" aria-label="Data output">
      <button type="button" class="pg-btn pg-btn--icon pg-btn--sm" title="Add row" :disabled="!editable" @click="addRow"><PgIcon name="plus" :size="14" /></button>
      <button type="button" class="pg-btn pg-btn--icon pg-btn--sm" title="Copy" :disabled="!grid" @click="copy"><PgIcon name="copy" :size="14" /></button>
      <button type="button" class="pg-btn pg-btn--icon pg-btn--sm" title="Paste" :disabled="!editable || !clip" @click="paste"><PgIcon name="paste" :size="14" /></button>
      <button type="button" class="pg-btn pg-btn--icon pg-btn--sm" title="Delete" :disabled="!editable || !selectedRows.length" @click="markDelete"><PgIcon name="trash" :size="14" /></button>
      <button type="button" class="pg-btn pg-btn--icon pg-btn--sm" title="Save Data Changes (F6)" :disabled="!dirty" @click="save"><PgIcon name="save-data" :size="14" /></button>
      <span class="pg-dg__sep" />
      <span v-if="!editable && grid" class="pg-dg__ro" :title="readOnlyWhy"><PgIcon name="info" :size="13" /> Read-only</span>
      <span v-if="dirty" class="pg-dg__dirty">{{ changeCount }} pending change{{ changeCount === 1 ? '' : 's' }}</span>
    </div>
    <div v-if="!grid" class="pg-dg__empty">{{ empty }}</div>
    <div v-else class="pg-dg__scroll" tabindex="0" @keydown="onKey">
      <table class="pg-dg__table">
        <thead>
          <tr>
            <th class="pg-dg__num"></th>
            <th v-for="(col, ci) in grid.columns" :key="ci">
              <div class="pg-dg__name">{{ col }}<PgIcon v-if="ci === pkIndex" name="pkey" :size="12" class="pg-dg__key" /></div>
              <div class="pg-dg__type">{{ types[ci] || 'text' }}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in shownRows" :key="row.key"
              :class="{ 'is-sel': selectedRows.includes(row.key), 'is-del': deleted.has(row.key), 'is-new': row.isNew }">
            <td class="pg-dg__num" @click="selectRow(row.key, $event)">{{ row.isNew ? '*' : ri + 1 }}</td>
            <td v-for="(cell, ci) in row.cells" :key="ci" :class="{ 'is-null': cell === null, 'is-edited': isEdited(row, ci), 'is-num': isNum(ci) }"
                :title="cell === null ? 'NULL' : String(cell)" @dblclick="startEdit(row, ci)">
              <input v-if="editing && editing.key === row.key && editing.col === ci" v-model="editing.value" v-focus class="pg-dg__edit"
                     :aria-label="'Edit ' + grid.columns[ci]" @keydown.enter.prevent="commitEdit" @keydown.esc.prevent="editing = null" @blur="commitEdit" />
              <template v-else>{{ cell === null ? '[null]' : String(cell) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Query Tool's Data Output grid: the column name with its PostgreSQL type
 * under it, `[null]` for a NULL, and - in View/Edit Data on a table with a
 * primary key - pgAdmin's in-grid editing: double-click a cell, add a row,
 * delete rows, then Save Data Changes, which the Query Tool turns into the
 * UPDATE / INSERT / DELETE statements it runs.
 */
import { computed, ref, watch } from 'vue';
import PgIcon from './PgIcon.vue';
import type { DataChanges, Grid } from './pg';


const props = withDefaults(defineProps<{
  grid: Grid | null; types: string[]; editable?: boolean; pkIndex?: number; empty?: string; readOnlyWhy?: string;
}>(), { editable: false, pkIndex: -1, empty: 'No data output. Execute a query to get output.', readOnlyWhy: '' });
const emit = defineEmits<{ (event: 'save', changes: DataChanges): void; (event: 'copied', rows: number): void }>();

const vFocus = { mounted: (el: HTMLInputElement) => { el.focus(); el.select(); } };

interface Row { key: string; cells: unknown[]; isNew: boolean; base: unknown[] }

const edits = ref<Record<string, Record<number, unknown>>>({});
const added = ref<Row[]>([]);
const deleted = ref(new Set<string>());
const selectedRows = ref<string[]>([]);
const editing = ref<{ key: string; col: number; value: string } | null>(null);
const clip = ref<unknown[][] | null>(null);
let nextNew = 0;

watch(() => props.grid, () => {
  edits.value = {};
  added.value = [];
  deleted.value = new Set();
  selectedRows.value = [];
  editing.value = null;
});

const shownRows = computed<Row[]>(() => {
  const g = props.grid;
  if (!g) return [];
  const base = g.rows.map((r, i) => {
    const key = 'r' + i;
    const cells = (r as unknown[]).slice();
    for (const [col, value] of Object.entries(edits.value[key] || {})) cells[Number(col)] = value;
    return { key, cells, isNew: false, base: r as unknown[] };
  });
  return base.concat(added.value);
});

const changeCount = computed(() => Object.keys(edits.value).length + added.value.length + deleted.value.size);
const dirty = computed(() => changeCount.value > 0);

function isEdited(row: Row, col: number) {
  return row.isNew || col in (edits.value[row.key] || {});
}
function isNum(col: number) {
  return /int|numeric|real|double|serial/.test(props.types[col] || '');
}

function selectRow(key: string, event: MouseEvent) {
  if (event.ctrlKey || event.metaKey) {
    selectedRows.value = selectedRows.value.includes(key) ? selectedRows.value.filter(k => k !== key) : [...selectedRows.value, key];
  } else {
    selectedRows.value = [key];
  }
}

function startEdit(row: Row, col: number) {
  if (!props.editable || deleted.value.has(row.key)) return;
  if (col === props.pkIndex && !row.isNew) return;
  const cell = row.cells[col];
  editing.value = { key: row.key, col, value: cell === null || cell === undefined ? '' : String(cell) };
}

function commitEdit() {
  const e = editing.value;
  if (!e) return;
  editing.value = null;
  const value: unknown = e.value === '' ? null : e.value;
  const fresh = added.value.find(r => r.key === e.key);
  if (fresh) {
    fresh.cells[e.col] = value;
    return;
  }
  const row = shownRows.value.find(r => r.key === e.key);
  if (!row) return;
  const original = row.base[e.col];
  const same = (original === null && value === null) || String(original) === String(value);
  const next = { ...edits.value };
  const forRow = { ...(next[e.key] || {}) };
  if (same) delete forRow[e.col];
  else forRow[e.col] = value;
  if (Object.keys(forRow).length) next[e.key] = forRow;
  else delete next[e.key];
  edits.value = next;
}

function addRow() {
  const g = props.grid;
  if (!g) return;
  added.value = [...added.value, { key: 'n' + nextNew++, cells: g.columns.map(() => null), isNew: true, base: [] }];
}

function markDelete() {
  const next = new Set(deleted.value);
  for (const key of selectedRows.value) {
    if (key.startsWith('n')) added.value = added.value.filter(r => r.key !== key);
    else if (next.has(key)) next.delete(key);
    else next.add(key);
  }
  deleted.value = next;
  selectedRows.value = [];
}

async function copy() {
  const g = props.grid;
  if (!g) return;
  const picked = selectedRows.value.length ? shownRows.value.filter(r => selectedRows.value.includes(r.key)) : shownRows.value;
  clip.value = picked.map(r => r.cells.slice());
  const text = [g.columns.join('\t'), ...picked.map(r => r.cells.map(c => (c === null ? '' : String(c))).join('\t'))].join('\n');
  try { await navigator.clipboard.writeText(text); } catch { /* the in-grid paste still works */ }
  emit('copied', picked.length);
}

function paste() {
  if (!clip.value) return;
  added.value = [...added.value, ...clip.value.map(cells => ({
    key: 'n' + nextNew++, cells: cells.map((c, i) => (i === props.pkIndex ? null : c)), isNew: true, base: [],
  }))];
}

function save() {
  const g = props.grid;
  if (!g) return;
  const pk = props.pkIndex;
  const changes: DataChanges = { updates: [], inserts: [], deletes: [] };
  for (const [key, cols] of Object.entries(edits.value)) {
    if (deleted.value.has(key)) continue;
    const row = shownRows.value.find(r => r.key === key);
    if (!row) continue;
    const values: Record<string, unknown> = {};
    for (const [col, value] of Object.entries(cols)) values[g.columns[Number(col)] ?? col] = value;
    changes.updates.push({ pk: row.base[pk], values });
  }
  for (const row of added.value) {
    const values: Record<string, unknown> = {};
    row.cells.forEach((c, i) => { if (c !== null && c !== undefined && c !== '') values[g.columns[i] ?? String(i)] = c; });
    if (Object.keys(values).length) changes.inserts.push(values);
  }
  for (const key of deleted.value) {
    const row = shownRows.value.find(r => r.key === key);
    if (row) changes.deletes.push(row.base[pk]);
  }
  emit('save', changes);
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'F6' && dirty.value) {
    event.preventDefault();
    save();
  }
}

defineExpose({ save, dirty });
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-dg { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.pg-dg__bar { flex: none; display: flex; align-items: center; gap: 4px; padding: 4px 6px; border-bottom: 1px solid var(--pg-border); background: var(--pg-grey-200); }
.pg-dg__sep { width: 1px; height: 18px; background: var(--pg-border); margin: 0 4px; }
.pg-dg__ro { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--pg-muted); }
.pg-dg__dirty { font-size: 12px; color: #8a4b00; background: #fce5c5; padding: 1px 6px; border-radius: 8px; }
.pg-dg__empty { padding: 14px; color: var(--pg-muted); font-size: 13px; }
.pg-dg__scroll { flex: 1; min-height: 0; overflow: auto; outline: none; }
.pg-dg__table { border-collapse: separate; border-spacing: 0; font-size: 12.5px; font-family: var(--pg-mono); }
.pg-dg__table th {
  position: sticky; top: 0; z-index: 2; background: var(--pg-grey-200); border-right: 1px solid var(--pg-border);
  border-bottom: 1px solid var(--pg-border); padding: 4px 8px; text-align: left; font-family: Roboto, 'Helvetica Neue', Arial, sans-serif; min-width: 90px;
}
.pg-dg__name { font-weight: 600; color: var(--pg-text); white-space: nowrap; display: flex; align-items: center; gap: 4px; }
.pg-dg__type { font-size: 11px; color: var(--pg-muted); font-weight: 400; white-space: nowrap; }
.pg-dg__table td {
  border-right: 1px solid var(--pg-border); border-bottom: 1px solid var(--pg-border); padding: 3px 8px; white-space: nowrap;
  max-width: 320px; overflow: hidden; text-overflow: ellipsis; color: var(--pg-text); background: #fff;
}
.pg-dg__table td.is-num { text-align: right; }
.pg-dg__table td.is-null { color: #999; font-style: italic; }
.pg-dg__table td.is-edited { background: #fff6d6; }
.pg-dg__num { position: sticky; left: 0; z-index: 1; background: var(--pg-grey-200) !important; color: var(--pg-muted) !important; text-align: right; min-width: 36px !important; cursor: pointer; }
thead .pg-dg__num { z-index: 3; }
tr.is-sel td { background: var(--pg-tree-selected); }
tr.is-del td { text-decoration: line-through; color: var(--pg-error) !important; background: #fdecec; }
tr.is-new td { background: #eaf6ec; }
.pg-dg__edit { width: 100%; min-width: 80px; border: 1px solid var(--pg-primary); font: inherit; padding: 1px 4px; box-sizing: border-box; color: var(--pg-text); background: #fff; }
.pg-dg__key { color: #b8860b; }
</style>
