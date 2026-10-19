<template>
  <PgDialog v-model="tab" title="Create - Table" icon="table" :tabs="['General', 'Columns', 'Constraints', 'SQL']"
            :error="error" :busy="busy" :save-disabled="!!problem" @close="$emit('close')" @save="save" @reset="reset"
            @clear-error="error = ''" @info="info" @help="help">
    <div v-show="tab === 'General'" class="pg-form">
      <div class="pg-row"><label class="pg-row__label is-req" for="ct-name">Name</label>
        <input id="ct-name" v-model="spec.name" class="pg-input" :class="{ 'pg-input--err': !spec.name.trim() }" autocomplete="off" /></div>
      <div class="pg-row"><label class="pg-row__label" for="ct-owner">Owner</label>
        <select id="ct-owner" v-model="spec.owner" class="pg-select">
          <option v-for="r in loginRoles" :key="r" :value="r">{{ r }}</option>
        </select></div>
      <div class="pg-row"><label class="pg-row__label" for="ct-schema">Schema</label>
        <select id="ct-schema" v-model="spec.schema" class="pg-select"><option value="public">public</option></select></div>
      <div class="pg-row"><span class="pg-row__label">Tablespace</span><select class="pg-select" disabled aria-label="Tablespace"><option>pg_default</option></select></div>
      <div class="pg-row"><span class="pg-row__label">Partitioned table?</span><PgSwitch :model-value="false" label="Partitioned table?" disabled /></div>
      <div class="pg-row pg-row--top"><label class="pg-row__label" for="ct-comment">Comment</label>
        <textarea id="ct-comment" v-model="spec.comment" class="pg-textarea" rows="3" /></div>
    </div>

    <div v-show="tab === 'Columns'" class="pg-form">
      <div class="pg-dgrid__add"><h3 class="pg-sub">Columns</h3>
        <button type="button" class="pg-btn pg-btn--sm" @click="addColumn"><PgIcon name="plus" :size="13" />Add row</button></div>
      <div class="pg-dgrid__wrap">
        <table class="pg-dgrid">
          <thead><tr><th></th><th>Name</th><th>Data type</th><th>Length/Precision</th><th>Scale</th><th>Not NULL?</th><th>Primary key?</th><th>Default</th></tr></thead>
          <tbody>
            <tr v-if="!spec.columns.length"><td colspan="8" class="pg-muted">No rows found</td></tr>
            <tr v-for="(c, i) in spec.columns" :key="i">
              <td><button type="button" class="pg-btn pg-btn--icon pg-btn--sm" :aria-label="'Delete column row ' + (i + 1)" @click="spec.columns.splice(i, 1)"><PgIcon name="trash" :size="13" /></button></td>
              <td><input v-model="c.name" class="pg-input" :aria-label="'Column ' + (i + 1) + ' name'" /></td>
              <td><select v-model="c.type" class="pg-select" :aria-label="'Column ' + (i + 1) + ' data type'"><option v-for="t in DATA_TYPES" :key="t" :value="t">{{ t }}</option></select></td>
              <td><input v-model="c.length" class="pg-input" :disabled="!LENGTH_TYPES.has(c.type)" inputmode="numeric" :aria-label="'Column ' + (i + 1) + ' length'" /></td>
              <td><input v-model="c.scale" class="pg-input" :disabled="c.type !== 'numeric'" inputmode="numeric" :aria-label="'Column ' + (i + 1) + ' scale'" /></td>
              <td><PgSwitch v-model="c.notNull" :label="'Column ' + (i + 1) + ' not NULL'" :disabled="c.pk" /></td>
              <td><PgSwitch v-model="c.pk" :label="'Column ' + (i + 1) + ' primary key'" /></td>
              <td><input v-model="c.def" class="pg-input pg-mono" :aria-label="'Column ' + (i + 1) + ' default'" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-show="tab === 'Constraints'" class="pg-form">
      <div class="pg-dgrid__add"><h3 class="pg-sub">Foreign Key</h3>
        <button type="button" class="pg-btn pg-btn--sm" @click="spec.fks.push({ column: '', refTable: '', refColumn: '', onDelete: 'NO ACTION' })"><PgIcon name="plus" :size="13" />Add row</button></div>
      <div class="pg-dgrid__wrap">
        <table class="pg-dgrid">
          <thead><tr><th></th><th>Local column</th><th>References</th><th>Referencing</th><th>On delete</th></tr></thead>
          <tbody>
            <tr v-if="!spec.fks.length"><td colspan="5" class="pg-muted">No rows found</td></tr>
            <tr v-for="(f, i) in spec.fks" :key="i">
              <td><button type="button" class="pg-btn pg-btn--icon pg-btn--sm" :aria-label="'Delete foreign key ' + (i + 1)" @click="spec.fks.splice(i, 1)"><PgIcon name="trash" :size="13" /></button></td>
              <td><select v-model="f.column" class="pg-select" aria-label="Local column"><option value="">Select an item...</option><option v-for="c in namedColumns" :key="c" :value="c">{{ c }}</option></select></td>
              <td><select v-model="f.refTable" class="pg-select" aria-label="References table" @change="f.refColumn = pkOf(f.refTable)"><option value="">Select an item...</option><option v-for="t in model.tables" :key="t.name" :value="t.name">public.{{ t.name }}</option></select></td>
              <td><select v-model="f.refColumn" class="pg-select" aria-label="Referencing column"><option value="">Select an item...</option><option v-for="c in colsOf(f.refTable)" :key="c" :value="c">{{ c }}</option></select></td>
              <td><select v-model="f.onDelete" class="pg-select" aria-label="On delete"><option v-for="a in ACTIONS" :key="a">{{ a }}</option></select></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pg-dgrid__add"><h3 class="pg-sub">Unique</h3>
        <button type="button" class="pg-btn pg-btn--sm" @click="spec.uniques.push('')"><PgIcon name="plus" :size="13" />Add row</button></div>
      <div class="pg-dgrid__wrap">
        <table class="pg-dgrid">
          <thead><tr><th></th><th>Columns</th></tr></thead>
          <tbody>
            <tr v-if="!spec.uniques.length"><td colspan="2" class="pg-muted">No rows found</td></tr>
            <tr v-for="(u, i) in spec.uniques" :key="i + ':' + u">
              <td><button type="button" class="pg-btn pg-btn--icon pg-btn--sm" :aria-label="'Delete unique ' + (i + 1)" @click="spec.uniques.splice(i, 1)"><PgIcon name="trash" :size="13" /></button></td>
              <td><select v-model="spec.uniques[i]" class="pg-select" aria-label="Unique column"><option value="">Select an item...</option><option v-for="c in namedColumns" :key="c" :value="c">{{ c }}</option></select></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pg-dgrid__add"><h3 class="pg-sub">Check</h3>
        <button type="button" class="pg-btn pg-btn--sm" @click="spec.checks.push({ name: '', expr: '' })"><PgIcon name="plus" :size="13" />Add row</button></div>
      <div class="pg-dgrid__wrap">
        <table class="pg-dgrid">
          <thead><tr><th></th><th>Name</th><th>Check</th></tr></thead>
          <tbody>
            <tr v-if="!spec.checks.length"><td colspan="3" class="pg-muted">No rows found</td></tr>
            <tr v-for="(ch, i) in spec.checks" :key="i">
              <td><button type="button" class="pg-btn pg-btn--icon pg-btn--sm" :aria-label="'Delete check ' + (i + 1)" @click="spec.checks.splice(i, 1)"><PgIcon name="trash" :size="13" /></button></td>
              <td><input v-model="ch.name" class="pg-input" aria-label="Check name" /></td>
              <td><input v-model="ch.expr" class="pg-input pg-mono" placeholder="quantity > 0" aria-label="Check expression" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <PgCode v-if="tab === 'SQL'" :sql="problem ? '-- ' + problem : generated" />
  </PgDialog>
</template>

<script setup lang="ts">
/** Create - Table: General, Columns (type, length, Not NULL?, Primary key?, default), Constraints and the SQL it will run. */
import { computed, inject, reactive, ref } from 'vue';
import PgDialog from './PgDialog.vue';
import PgIcon from './PgIcon.vue';
import PgSwitch from './PgSwitch.vue';
import PgCode from './PgCode.vue';
import { PG } from './pgContext';
import { createTableSql, DATA_TYPES, LENGTH_TYPES, type TableSpec } from './pg';

const emit = defineEmits<{ (event: 'close'): void }>();
const ctx = inject(PG)!;
const model = ctx.model;
const ACTIONS = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'];

const tab = ref('General');
const error = ref('');
const busy = ref(false);

function blank(): TableSpec {
  return { name: '', schema: 'public', owner: 'postgres', comment: '', fks: [], uniques: [], checks: [],
    columns: [{ name: 'id', type: 'integer', length: '', scale: '', notNull: true, pk: true, def: '' }] };
}
const spec = reactive<TableSpec>(blank());
function reset() {
  Object.assign(spec, blank());
  error.value = '';
}
function addColumn() {
  spec.columns.push({ name: '', type: 'text', length: '', scale: '', notNull: false, pk: false, def: '' });
}

const loginRoles = computed(() => model.value.roles.filter(r => !r.builtin).map(r => r.name));
const namedColumns = computed(() => spec.columns.map(c => c.name.trim()).filter(Boolean));
function colsOf(table: string) {
  return ctx.table(table)?.columns.map(c => c.name) || [];
}
function pkOf(table: string) {
  return ctx.table(table)?.columns.find(c => c.pk)?.name || '';
}

const problem = computed(() => {
  if (!spec.name.trim()) return 'Name cannot be empty.';
  if (model.value.tables.some(t => t.name === spec.name.trim())) return `Table "${spec.name.trim()}" already exists.`;
  if (!spec.columns.some(c => c.name.trim())) return 'Please specify at least one column.';
  const names = namedColumns.value;
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) return `Column "${dup}" is specified more than once.`;
  return '';
});
const generated = computed(() => createTableSql(spec));

function info() {
  ctx.notify('info', 'Create - Table', 'Every field becomes part of the CREATE TABLE statement shown on the SQL tab, which is what Save runs.');
}
function help() {
  ctx.notify('info', 'pgAdmin documentation: table_dialog.html', 'This lab is offline; the dialog fields follow the PostgreSQL CREATE TABLE reference.');
}

async function save() {
  if (problem.value) {
    error.value = problem.value;
    return;
  }
  busy.value = true;
  const result = await ctx.runSql(generated.value, { quiet: true, success: `Table "${spec.name.trim()}" created.` });
  busy.value = false;
  if (result.ok) emit('close');
  else error.value = String(result.error || result.output || 'The table could not be created.').trim();
}
</script>

<style scoped src="./pg.css"></style>
