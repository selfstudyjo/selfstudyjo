<template>
  <div class="ca">
    <div class="fx-tabs ca-tabs">
      <button type="button" class="fx-tab" :class="{ 'is-active': tab === 'source' }" @click="tab = 'source'">Source</button>
      <button type="button" class="fx-tab" :class="{ 'is-active': tab === 'destination' }" @click="tab = 'destination'">Destination</button>
      <button type="button" class="fx-tab" :class="{ 'is-active': tab === 'mapping' }" @click="tab = 'mapping'">Mapping</button>
    </div>

    <!-- Source -->
    <div v-if="tab === 'source'" class="ca-grid">
      <div class="fx-field"><span class="fx-field__label">Connection<span class="fx-field__req">*</span></span>
        <select class="fx-select" :value="srcKind" aria-label="Source connection" @change="setSrcKind(($event.target as HTMLSelectElement).value)">
          <option value="lakehouse">Lakehouse</option>
          <option value="warehouse">Warehouse</option>
          <option value="servicenow">ServiceNow</option>
        </select></div>
      <template v-if="srcKind === 'lakehouse'">
        <div class="fx-field"><span class="fx-field__label">Lakehouse<span class="fx-field__req">*</span></span>
          <select class="fx-select" :value="src.lakehouse || ''" aria-label="Source lakehouse" @change="setSrc({ lakehouse: val($event) })">
            <option value="">Select…</option>
            <option v-for="l in lakehouses" :key="l.name" :value="l.name">{{ l.name }}</option></select></div>
        <div class="fx-field"><span class="fx-field__label">Root folder</span>
          <div class="ca-radios">
            <label class="fx-check"><input type="radio" :checked="!srcFiles" @change="setSrcRoot('Tables')" />Tables</label>
            <label class="fx-check"><input type="radio" :checked="srcFiles" @change="setSrcRoot('Files')" />Files</label>
          </div></div>
        <div v-if="!srcFiles" class="fx-field"><span class="fx-field__label">Table<span class="fx-field__req">*</span></span>
          <select class="fx-select" :value="src.table || ''" aria-label="Source table" @change="setSrc({ table: val($event) })">
            <option value="">Select…</option>
            <option v-for="t in tablesOf(src.lakehouse)" :key="t" :value="t">{{ t }}</option></select></div>
        <div v-else class="fx-field"><span class="fx-field__label">File path<span class="fx-field__req">*</span></span>
          <select class="fx-select" :value="src.path || ''" aria-label="Source file path" @change="setSrc({ path: val($event) })">
            <option value="">Select…</option>
            <option v-for="f in pathsOf(src.lakehouse)" :key="f" :value="f">{{ f }}</option></select></div>
      </template>
      <template v-else-if="srcKind === 'warehouse'">
        <div class="fx-field"><span class="fx-field__label">Warehouse<span class="fx-field__req">*</span></span>
          <select class="fx-select" :value="src.warehouse || ''" aria-label="Source warehouse" @change="setSrc({ warehouse: val($event) })">
            <option value="">Select…</option>
            <option v-for="w in warehouses" :key="w.name" :value="w.name">{{ w.name }}</option></select></div>
        <div class="fx-field"><span class="fx-field__label">Use query</span>
          <div class="ca-radios">
            <label class="fx-check"><input type="radio" :checked="!src.sqlReaderQuery" @change="setSrc({ sqlReaderQuery: undefined })" />Table</label>
            <label class="fx-check"><input type="radio" :checked="!!src.sqlReaderQuery" @change="setSrc({ sqlReaderQuery: 'SELECT * FROM ' + (src.table || 'dbo.table_name') })" />Query</label>
          </div></div>
        <div v-if="!src.sqlReaderQuery" class="fx-field"><span class="fx-field__label">Table<span class="fx-field__req">*</span></span>
          <select class="fx-select" :value="src.table || ''" aria-label="Source warehouse table" @change="setSrc({ table: val($event) })">
            <option value="">Select…</option>
            <option v-for="t in tablesOf(src.warehouse)" :key="t" :value="t">{{ t }}</option></select></div>
        <div v-else class="fx-field ca-wide"><label :for="id + '-q'">Query</label>
          <textarea :id="id + '-q'" class="fx-code ca-query" :value="src.sqlReaderQuery" spellcheck="false" @change="setSrc({ sqlReaderQuery: val($event) })" /></div>
      </template>
      <template v-else>
        <div class="fx-field"><span class="fx-field__label">Connection name<span class="fx-field__req">*</span></span>
          <select class="fx-select" :value="src.connection || ''" aria-label="ServiceNow connection" @change="setSrc({ connection: val($event) })">
            <option value="">Select…</option>
            <option v-for="c in connections" :key="c.name" :value="c.name">{{ c.name }}</option></select></div>
        <div class="fx-field"><label :for="id + '-snt'">Table<span class="fx-field__req">*</span></label>
          <input :id="id + '-snt'" class="fx-input" :list="id + '-sntl'" :value="src.table || ''" @change="setSrc({ table: val($event) })" />
          <datalist :id="id + '-sntl'"><option v-for="t in SNOW_TABLES" :key="t" :value="t" /></datalist></div>
        <div class="fx-field ca-wide"><label :for="id + '-snf'">Filter (optional)</label>
          <input :id="id + '-snf'" class="fx-input" :value="src.filter || ''" placeholder="sys_updated_on > '2026-10-01 00:00:00'" @change="setSrc({ filter: val($event) || undefined })" /></div>
      </template>
    </div>

    <!-- Destination -->
    <div v-else-if="tab === 'destination'" class="ca-grid">
      <div class="fx-field"><span class="fx-field__label">Connection<span class="fx-field__req">*</span></span>
        <select class="fx-select" :value="dstKind" aria-label="Destination connection" @change="setDstKind(($event.target as HTMLSelectElement).value)">
          <option value="lakehouse">Lakehouse</option>
          <option value="warehouse">Warehouse</option>
        </select></div>
      <template v-if="dstKind === 'lakehouse'">
        <div class="fx-field"><span class="fx-field__label">Lakehouse<span class="fx-field__req">*</span></span>
          <select class="fx-select" :value="sink.lakehouse || ''" aria-label="Destination lakehouse" @change="setSink({ lakehouse: val($event) })">
            <option value="">Select…</option>
            <option v-for="l in lakehouses" :key="l.name" :value="l.name">{{ l.name }}</option></select></div>
        <div class="fx-field"><span class="fx-field__label">Root folder</span>
          <div class="ca-radios">
            <label class="fx-check"><input type="radio" :checked="!dstFiles" @change="setDstRoot('Tables')" />Tables</label>
            <label class="fx-check"><input type="radio" :checked="dstFiles" @change="setDstRoot('Files')" />Files</label>
          </div></div>
        <template v-if="!dstFiles">
          <div class="fx-field"><label :for="id + '-dt'">Table name<span class="fx-field__req">*</span></label>
            <input :id="id + '-dt'" class="fx-input" :list="id + '-dtl'" :value="sink.table || ''" @change="setSink({ table: val($event) })" />
            <datalist :id="id + '-dtl'"><option v-for="t in tablesOf(sink.lakehouse)" :key="t" :value="t" /></datalist>
            <span class="fx-field__help">A new table is created if it doesn't exist.</span></div>
          <div class="fx-field"><span class="fx-field__label">Table action</span>
            <div class="ca-radios">
              <label class="fx-check"><input type="radio" :checked="(sink.tableActionOption || 'Append') === 'Append'" @change="setSink({ tableActionOption: 'Append' })" />Append</label>
              <label class="fx-check"><input type="radio" :checked="sink.tableActionOption === 'Overwrite'" @change="setSink({ tableActionOption: 'Overwrite' })" />Overwrite</label>
            </div></div>
        </template>
        <template v-else>
          <div class="fx-field"><label :for="id + '-dp'">Folder path<span class="fx-field__req">*</span></label>
            <input :id="id + '-dp'" class="fx-input" :list="id + '-dpl'" :value="sink.path || ''" placeholder="Files/landing" @change="setSink({ path: val($event) })" />
            <datalist :id="id + '-dpl'"><option v-for="f in foldersOf(sink.lakehouse)" :key="f" :value="f" /></datalist></div>
          <div class="fx-field"><span class="fx-field__label">File format</span>
            <select class="fx-select" :value="sink.type" aria-label="File format" @change="setSink({ type: val($event) })">
              <option value="JsonSink">JSON</option>
              <option value="DelimitedTextSink">DelimitedText (CSV)</option>
              <option value="ParquetSink">Parquet</option></select></div>
        </template>
      </template>
      <template v-else>
        <div class="fx-field"><span class="fx-field__label">Warehouse<span class="fx-field__req">*</span></span>
          <select class="fx-select" :value="sink.warehouse || ''" aria-label="Destination warehouse" @change="setSink({ warehouse: val($event) })">
            <option value="">Select…</option>
            <option v-for="w in warehouses" :key="w.name" :value="w.name">{{ w.name }}</option></select></div>
        <div class="fx-field"><span class="fx-field__label">Table<span class="fx-field__req">*</span></span>
          <select class="fx-select" :value="sink.table || ''" aria-label="Destination warehouse table" @change="setSink({ table: val($event) })">
            <option value="">Select…</option>
            <option v-for="t in tablesOf(sink.warehouse)" :key="t" :value="t">{{ t }}</option></select>
          <span class="fx-field__help">The table must exist - create it in the warehouse first.</span></div>
      </template>
    </div>

    <!-- Mapping -->
    <div v-else class="ca-map">
      <p class="fx-muted ca-p">Columns are mapped by name. Add a column with a fixed value or a pipeline expression to every row:</p>
      <table class="fx-table">
        <thead><tr><th>Name</th><th>Value</th><th aria-label="Remove" /></tr></thead>
        <tbody>
          <tr v-for="(c, i) in extra" :key="i">
            <td><input class="fx-input" :value="c.name" :aria-label="'Column ' + (i + 1) + ' name'" @change="setExtra(i, 'name', val($event))" /></td>
            <td><input class="fx-input fx-mono" :value="c.value" :aria-label="'Column ' + (i + 1) + ' value'" @change="setExtra(i, 'value', val($event))" /></td>
            <td><button type="button" class="fx-iconbtn" :aria-label="'Remove column ' + c.name" @click="removeExtra(i)"><FxIcon name="delete" :size="14" /></button></td>
          </tr>
          <tr v-if="!extra.length"><td colspan="3" class="fx-muted">No additional columns</td></tr>
        </tbody>
      </table>
      <button type="button" class="fx-btn fx-btn--sm ca-add" @click="addExtra"><FxIcon name="plus" :size="12" />New</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Copy data activity's Source / Destination / Mapping tabs. It edits the
 * activity's `typeProperties` the way the real editor does and hands the new
 * object back; the pipeline is saved (fab set -q definition) by the page.
 */
import { computed, ref } from 'vue';
import FxIcon from './FxIcon.vue';
import { rows, useFabric } from './fabric';

const props = defineProps<{ tp: Record<string, any>; ws: string }>();
const emit = defineEmits<{ (event: 'change', value: Record<string, any>): void }>();
const { portal } = useFabric();

const SNOW_TABLES = ['incident', 'problem', 'change_request', 'sys_user', 'sys_user_group', 'cmdb_ci', 'task_sla', 'alm_asset'];
const id = `ca${Math.random().toString(36).slice(2, 8)}`;
const tab = ref<'source' | 'destination' | 'mapping'>('source');

const lakehouses = computed(() => rows(portal.value, 'items').filter(i => i.type === 'Lakehouse' && i.workspace === props.ws));
const warehouses = computed(() => rows(portal.value, 'items').filter(i => i.type === 'Warehouse' && i.workspace === props.ws));
const connections = computed(() => rows(portal.value, 'connections'));
function tablesOf(item: string | undefined) {
  return rows(portal.value, 'objects').filter(o => o.item === item && o.workspace === props.ws)
    .map(o => `${o.schema}.${o.name}`).sort();
}
function foldersOf(item: string | undefined) {
  const lh = lakehouses.value.find(l => l.name === item);
  return ['Files', ...((lh?.file_folders as string[] | undefined) || [])];
}
function pathsOf(item: string | undefined) {
  const files = rows(portal.value, 'files').filter(f => f.item === item).map(f => String(f.path));
  return [...new Set([...foldersOf(item).filter(f => f !== 'Files'), ...files])].sort();
}
function val(e: Event) { return (e.target as HTMLInputElement).value; }

const src = computed<Record<string, any>>(() => props.tp.source || {});
const sink = computed<Record<string, any>>(() => props.tp.sink || {});
const extra = computed<{ name: string; value: string }[]>(() => props.tp.additionalColumns || []);
const srcKind = computed(() => /Warehouse/.test(src.value.type || '') ? 'warehouse'
  : /ServiceNow/.test(src.value.type || '') ? 'servicenow' : 'lakehouse');
const srcFiles = computed(() => src.value.type === 'LakehouseFilesSource');
const dstKind = computed(() => /Warehouse/.test(sink.value.type || '') ? 'warehouse' : 'lakehouse');
const dstFiles = computed(() => ['JsonSink', 'DelimitedTextSink', 'ParquetSink'].includes(sink.value.type));

function clean(o: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') out[k] = v;
  return out;
}
function patch(next: Record<string, any>) { emit('change', clean({ ...props.tp, ...next })); }
function setSrc(p: Record<string, any>) { patch({ source: clean({ ...src.value, ...p }) }); }
function setSink(p: Record<string, any>) { patch({ sink: clean({ ...sink.value, ...p }) }); }
function setSrcKind(kind: string) {
  const first = kind === 'warehouse' ? warehouses.value[0]?.name : lakehouses.value[0]?.name;
  if (kind === 'warehouse') patch({ source: { type: 'DataWarehouseSource', warehouse: first || '' } });
  else if (kind === 'servicenow') patch({ source: { type: 'ServiceNowV2Source', connection: connections.value[0]?.name || '', table: 'incident' } });
  else patch({ source: { type: 'LakehouseTableSource', lakehouse: first || '' } });
}
function setSrcRoot(root: string) {
  patch({ source: { type: root === 'Files' ? 'LakehouseFilesSource' : 'LakehouseTableSource', lakehouse: src.value.lakehouse || '' } });
}
function setDstKind(kind: string) {
  if (kind === 'warehouse') patch({ sink: { type: 'DataWarehouseSink', warehouse: warehouses.value[0]?.name || '' } });
  else patch({ sink: { type: 'LakehouseTableSink', lakehouse: lakehouses.value[0]?.name || '', tableActionOption: 'Append' } });
}
function setDstRoot(root: string) {
  patch({ sink: root === 'Files'
    ? { type: 'JsonSink', lakehouse: sink.value.lakehouse || '', path: 'Files/landing' }
    : { type: 'LakehouseTableSink', lakehouse: sink.value.lakehouse || '', tableActionOption: 'Append' } });
}
function setExtra(i: number, key: 'name' | 'value', value: string) {
  patch({ additionalColumns: extra.value.map((c, j) => (j === i ? { ...c, [key]: value } : c)) });
}
function addExtra() { patch({ additionalColumns: [...extra.value, { name: `column${extra.value.length + 1}`, value: '@pipeline().RunId' }] }); }
function removeExtra(i: number) {
  const next = extra.value.filter((_c, j) => j !== i);
  patch({ additionalColumns: next.length ? next : undefined });
}
</script>

<style scoped>
.ca-tabs { margin: -4px 0 12px; padding: 0; }
.ca-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0 16px; }
.ca-wide { grid-column: 1 / -1; }
.ca-radios { display: flex; gap: 16px; }
.ca-radios .fx-check { margin-bottom: 0; }
.ca-query { min-height: 70px; border: 1px solid #d1d1d1; border-radius: 4px; }
.ca-p { margin: 0 0 8px; font-size: 13px; }
.ca-add { margin-top: 8px; }
</style>
