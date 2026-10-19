<template>
  <PgDialog v-model="tab" :title="materialized ? 'Create - Materialized View' : 'Create - View'" :icon="materialized ? 'mview' : 'view'"
            :tabs="['General', 'Code', 'SQL']" :error="error" :busy="busy" :save-disabled="!!problem"
            @close="$emit('close')" @save="save" @reset="reset" @clear-error="error = ''" @info="info" @help="help">
    <div v-show="tab === 'General'" class="pg-form">
      <div class="pg-row"><label class="pg-row__label is-req" for="cv-name">Name</label>
        <input id="cv-name" v-model="form.name" class="pg-input" :class="{ 'pg-input--err': !form.name.trim() }" autocomplete="off" /></div>
      <div class="pg-row"><span class="pg-row__label">Owner</span><select class="pg-select" disabled aria-label="Owner"><option>postgres</option></select></div>
      <div class="pg-row"><span class="pg-row__label">Schema</span><select class="pg-select" disabled aria-label="Schema"><option>public</option></select></div>
    </div>
    <div v-show="tab === 'Code'" class="pg-form pg-cv-code">
      <label class="pg-row__label is-req" for="cv-def">Definition</label>
      <textarea id="cv-def" v-model="form.definition" class="pg-textarea pg-mono" rows="12" spellcheck="false"
                placeholder="SELECT customer_id, count(*) AS orders&#10;FROM orders&#10;GROUP BY customer_id" />
    </div>
    <PgCode v-if="tab === 'SQL'" :sql="problem ? '-- ' + problem : generated" />
  </PgDialog>
</template>

<script setup lang="ts">
/** Create - View / Materialized View: a name and a SELECT; Save runs CREATE [MATERIALIZED] VIEW. */
import { computed, inject, reactive, ref } from 'vue';
import PgDialog from './PgDialog.vue';
import PgCode from './PgCode.vue';
import { PG } from './pgContext';
import { createViewSql } from './pg';

const props = defineProps<{ materialized?: boolean }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const ctx = inject(PG)!;
const tab = ref('General');
const error = ref('');
const busy = ref(false);
const form = reactive({ name: '', definition: '' });
function reset() {
  form.name = '';
  form.definition = '';
  error.value = '';
}
const problem = computed(() => {
  if (!form.name.trim()) return 'Name cannot be empty.';
  if (!form.definition.trim()) return 'Definition cannot be empty.';
  if (!/^\s*(select|with|values)\b/i.test(form.definition)) return 'The definition must be a SELECT statement.';
  return '';
});
const generated = computed(() => createViewSql('public', form.name.trim(), form.definition, Boolean(props.materialized)));

function info() {
  ctx.notify('info', 'Create - View', 'Save runs the statement on the SQL tab.');
}
function help() {
  ctx.notify('info', 'pgAdmin documentation: view_dialog.html', 'This lab is offline; see CREATE VIEW in the PostgreSQL reference.');
}

async function save() {
  if (problem.value) {
    error.value = problem.value;
    return;
  }
  busy.value = true;
  const result = await ctx.runSql(generated.value, { quiet: true, success: `View "${form.name.trim()}" created.` });
  busy.value = false;
  if (result.ok) emit('close');
  else error.value = String(result.error || result.output || 'The view could not be created.').trim();
}
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-cv-code { flex: 1; }
.pg-cv-code .pg-textarea { min-height: 200px; }
</style>
