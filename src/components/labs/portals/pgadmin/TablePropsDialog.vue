<template>
  <PgDialog v-model="tab" :title="`Table - ${table}`" icon="table" :tabs="['General', 'Columns', 'SQL']" :error="error" :busy="busy"
            :save-disabled="!!problem || !generated" @close="$emit('close')" @save="save" @reset="reset" @clear-error="error = ''"
            @info="info" @help="help">
    <div v-show="tab === 'General'" class="pg-form">
      <div class="pg-row"><label class="pg-row__label is-req" for="tp-name">Name</label>
        <input id="tp-name" v-model="form.name" class="pg-input" autocomplete="off" /></div>
      <div class="pg-row"><span class="pg-row__label">OID</span><input class="pg-input" :value="oid" disabled aria-label="OID" /></div>
      <div class="pg-row"><span class="pg-row__label">Owner</span><input class="pg-input" :value="t?.owner || 'postgres'" disabled aria-label="Owner" /></div>
      <div class="pg-row"><span class="pg-row__label">Schema</span><input class="pg-input" value="public" disabled aria-label="Schema" /></div>
      <div class="pg-row pg-row--top"><label class="pg-row__label" for="tp-comment">Comment</label>
        <textarea id="tp-comment" v-model="form.comment" class="pg-textarea" rows="3" /></div>
    </div>
    <div v-show="tab === 'Columns'" class="pg-form">
      <div class="pg-dgrid__add"><h3 class="pg-sub">Columns</h3>
        <button type="button" class="pg-btn pg-btn--sm" @click="ctx.openDialog({ kind: 'create-column', table })"><PgIcon name="plus" :size="13" />Add column...</button></div>
      <table class="pg-dgrid">
        <thead><tr><th>Name</th><th>Data type</th><th>Not NULL?</th><th>Primary key?</th><th>Default</th><th></th></tr></thead>
        <tbody>
          <tr v-for="c in t?.columns || []" :key="c.name">
            <td>{{ c.name }}</td><td>{{ c.type }}</td><td>{{ c.nullable ? 'No' : 'Yes' }}</td><td>{{ c.pk ? 'Yes' : 'No' }}</td><td class="pg-mono">{{ c.default || '' }}</td>
            <td><button type="button" class="pg-btn pg-btn--sm" @click="ctx.openDialog({ kind: 'column-props', table, column: c.name })">Edit</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <PgCode v-if="tab === 'SQL'" :sql="problem ? '-- ' + problem : generated || '-- No changes.'" />
  </PgDialog>
</template>

<script setup lang="ts">
/** A table's Properties dialog: rename and comment (ALTER TABLE ... RENAME TO, COMMENT ON TABLE), columns one click away. */
import { computed, inject, reactive, ref } from 'vue';
import PgDialog from './PgDialog.vue';
import PgIcon from './PgIcon.vue';
import PgCode from './PgCode.vue';
import { PG } from './pgContext';
import { alterTableSql, oidOf } from './pg';

const props = defineProps<{ table: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const ctx = inject(PG)!;

const tab = ref('General');
const error = ref('');
const busy = ref(false);
const t = computed(() => ctx.table(props.table));
const oid = computed(() => oidOf(props.table));
const form = reactive({ name: props.table, comment: t.value?.comment || '' });
function reset() {
  form.name = props.table;
  form.comment = t.value?.comment || '';
  error.value = '';
}

const problem = computed(() => {
  if (!form.name.trim()) return 'Name cannot be empty.';
  if (form.name.trim() !== props.table && ctx.model.value.tables.some(x => x.name === form.name.trim())) {
    return `Relation "${form.name.trim()}" already exists.`;
  }
  return '';
});
const generated = computed(() => (t.value ? alterTableSql(t.value, form) : ''));

function info() {
  ctx.notify('info', `Table - ${props.table}`, 'Save runs the ALTER TABLE / COMMENT ON statements on the SQL tab.');
}
function help() {
  ctx.notify('info', 'pgAdmin documentation: table_dialog.html', 'This lab is offline; see ALTER TABLE in the PostgreSQL reference.');
}

async function save() {
  if (problem.value || !generated.value) return;
  busy.value = true;
  const result = await ctx.runSql(generated.value, { quiet: true, success: `Table "${form.name.trim()}" updated.` });
  busy.value = false;
  if (result.ok) emit('close');
  else error.value = String(result.error || result.output || 'The statement failed.').trim();
}
</script>

<style scoped src="./pg.css"></style>
