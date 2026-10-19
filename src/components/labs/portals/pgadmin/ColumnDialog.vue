<template>
  <PgDialog v-model="tab" :title="editing ? `Column - ${column}` : 'Create - Column'" icon="column" :tabs="['General', 'Definition', 'SQL']"
            :error="error" :busy="busy" :save-disabled="!!problem || (editing && !generated)" :width="620"
            @close="$emit('close')" @save="save" @reset="reset" @clear-error="error = ''" @info="info" @help="help">
    <div v-show="tab === 'General'" class="pg-form">
      <div class="pg-row"><label class="pg-row__label is-req" for="cd-name">Name</label>
        <input id="cd-name" v-model="form.name" class="pg-input" :class="{ 'pg-input--err': !form.name.trim() }" autocomplete="off" /></div>
      <div class="pg-row"><span class="pg-row__label">Table</span><input class="pg-input" :value="`public.${table}`" disabled aria-label="Table" /></div>
    </div>
    <div v-show="tab === 'Definition'" class="pg-form">
      <div class="pg-row"><label class="pg-row__label is-req" for="cd-type">Data type</label>
        <select id="cd-type" v-model="form.type" class="pg-select" :disabled="editing">
          <option v-if="editing && !DATA_TYPES.includes(form.type)" :value="form.type">{{ form.type }}</option>
          <option v-for="t in DATA_TYPES" :key="t" :value="t">{{ t }}</option>
        </select></div>
      <div class="pg-row"><label class="pg-row__label" for="cd-len">Length/Precision</label>
        <input id="cd-len" v-model="form.length" class="pg-input" :disabled="editing || !LENGTH_TYPES.has(form.type)" inputmode="numeric" /></div>
      <div class="pg-row"><label class="pg-row__label" for="cd-scale">Scale</label>
        <input id="cd-scale" v-model="form.scale" class="pg-input" :disabled="editing || form.type !== 'numeric'" inputmode="numeric" /></div>
      <div class="pg-row"><span class="pg-row__label">Not NULL?</span><PgSwitch v-model="form.notNull" label="Not NULL?" :disabled="isPk" /></div>
      <div class="pg-row"><label class="pg-row__label" for="cd-def">Default</label>
        <input id="cd-def" v-model="form.def" class="pg-input pg-mono" placeholder="e.g. 0, 'web', now()" /></div>
      <p v-if="editing" class="pg-row__hint">Changing the data type of an existing column is done with ALTER COLUMN ... TYPE in the Query Tool.</p>
    </div>
    <PgCode v-if="tab === 'SQL'" :sql="problem ? '-- ' + problem : generated || '-- No changes.'" />
  </PgDialog>
</template>

<script setup lang="ts">
/** Create - Column (ALTER TABLE ... ADD COLUMN) and a column's properties (RENAME, SET/DROP NOT NULL, SET/DROP DEFAULT). */
import { computed, inject, reactive, ref } from 'vue';
import PgDialog from './PgDialog.vue';
import PgSwitch from './PgSwitch.vue';
import PgCode from './PgCode.vue';
import { PG } from './pgContext';
import { addColumnSql, alterColumnSql, DATA_TYPES, LENGTH_TYPES } from './pg';

const props = defineProps<{ table: string; column?: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const ctx = inject(PG)!;

const tab = ref('General');
const error = ref('');
const busy = ref(false);
const editing = computed(() => Boolean(props.column));
const existing = computed(() => ctx.table(props.table)?.columns.find(c => c.name === props.column));
const isPk = computed(() => Boolean(existing.value?.pk));

function initial() {
  const c = existing.value;
  return c ? { name: c.name, type: c.type, length: '', scale: '', notNull: !c.nullable, pk: c.pk, def: c.default || '' }
    : { name: '', type: 'text', length: '', scale: '', notNull: false, pk: false, def: '' };
}
const form = reactive(initial());
function reset() {
  Object.assign(form, initial());
  error.value = '';
}

const problem = computed(() => {
  if (!form.name.trim()) return 'Name cannot be empty.';
  const clash = ctx.table(props.table)?.columns.some(c => c.name === form.name.trim() && c.name !== props.column);
  if (clash) return `Column "${form.name.trim()}" of relation "${props.table}" already exists.`;
  return '';
});
const generated = computed(() => {
  if (editing.value && existing.value) return alterColumnSql('public', props.table, existing.value, form);
  return addColumnSql('public', props.table, form);
});

function info() {
  ctx.notify('info', editing.value ? 'Column properties' : 'Create - Column', 'Save runs the ALTER TABLE statement(s) on the SQL tab.');
}
function help() {
  ctx.notify('info', 'pgAdmin documentation: column_dialog.html', 'This lab is offline; see ALTER TABLE in the PostgreSQL reference.');
}

async function save() {
  if (problem.value || !generated.value) return;
  busy.value = true;
  const result = await ctx.runSql(generated.value, { quiet: true,
    success: editing.value ? `Column "${form.name.trim()}" updated.` : `Column "${form.name.trim()}" added to ${props.table}.` });
  busy.value = false;
  if (result.ok) emit('close');
  else error.value = String(result.error || result.output || 'The statement failed.').trim();
}
</script>

<style scoped src="./pg.css"></style>
