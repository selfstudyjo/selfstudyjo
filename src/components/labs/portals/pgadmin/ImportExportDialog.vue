<template>
  <PgDialog v-model="tab" :title="`Import/Export data - table '${table}'`" icon="import-export"
            :tabs="['General', 'Options', 'Columns', 'SQL']" :error="error" :busy="busy" save-label="OK" :width="680"
            :save-disabled="!!problem" @close="$emit('close')" @save="run" @reset="reset" @clear-error="error = ''" @info="info" @help="help">
    <div v-show="tab === 'General'" class="pg-form">
      <div class="pg-row"><span class="pg-row__label">Import/Export</span>
        <div class="pg-seg" role="radiogroup" aria-label="Import or export">
          <button type="button" role="radio" :aria-checked="spec.direction === 'import'" :class="{ 'is-on': spec.direction === 'import' }" @click="spec.direction = 'import'">Import</button>
          <button type="button" role="radio" :aria-checked="spec.direction === 'export'" :class="{ 'is-on': spec.direction === 'export' }" @click="spec.direction = 'export'">Export</button>
        </div></div>
      <div class="pg-row"><label class="pg-row__label is-req" for="ie-file">Filename</label>
        <PgFilePicker id="ie-file" v-model="spec.file" filter="data" :invalid="!fileOk" :placeholder="'exports/' + table + '.csv'" /></div>
      <p v-if="spec.file && !fileOk" class="pg-row__hint pg-ie-err">Use a relative path inside the workspace with no spaces or quotes (e.g. exports/{{ table }}.csv).</p>
      <div class="pg-row"><span class="pg-row__label">Format</span>
        <select v-model="spec.format" class="pg-select" aria-label="Format">
          <option value="csv">csv</option><option value="text">text</option><option value="binary" disabled>binary (not available in this lab)</option>
        </select></div>
      <div class="pg-row"><span class="pg-row__label">Encoding</span>
        <select v-model="spec.encoding" class="pg-select" aria-label="Encoding">
          <option value="">(default)</option><option>UTF8</option><option>LATIN1</option><option>SQL_ASCII</option><option>WIN1252</option>
        </select></div>
      <div v-if="spec.direction === 'export'" class="pg-row pg-row--top"><span class="pg-row__label">Export source</span>
        <div class="pg-ie-src">
          <label class="pg-ie-radio"><input v-model="source" type="radio" value="table" /> Table <code class="pg-mono">public.{{ table }}</code></label>
          <label class="pg-ie-radio"><input v-model="source" type="radio" value="query" /> Query</label>
          <textarea v-if="source === 'query'" v-model="spec.query" class="pg-textarea pg-mono" rows="4" spellcheck="false" aria-label="Export query"
                    :placeholder="`SELECT * FROM public.${table} WHERE ...`" />
        </div></div>
      <p class="pg-row__hint pg-ie-note">{{ spec.direction === 'import'
        ? 'Rows are appended to the table. A row that breaks a constraint stops the import and nothing after it is loaded.'
        : 'The file is written client-side with psql\'s \\copy, into the lab workspace.' }}</p>
    </div>
    <div v-show="tab === 'Options'" class="pg-form">
      <h3 class="pg-sub">Options</h3>
      <div class="pg-row"><span class="pg-row__label">Header</span><PgSwitch v-model="spec.header" label="Header" :disabled="spec.format !== 'csv'" /></div>
      <div class="pg-row"><label class="pg-row__label" for="ie-delim">Delimiter</label>
        <select id="ie-delim" v-model="spec.delimiter" class="pg-select">
          <option value=",">,</option><option value=";">;</option><option value="|">|</option><option :value="'\t'">[tab]</option><option value="">(default)</option>
        </select></div>
      <template v-if="spec.format === 'csv'">
        <div class="pg-row"><label class="pg-row__label" for="ie-quote">Quote</label>
          <select id="ie-quote" v-model="spec.quote" class="pg-select"><option value="&quot;">"</option><option value="'">'</option></select></div>
        <div class="pg-row"><label class="pg-row__label" for="ie-escape">Escape</label>
          <select id="ie-escape" v-model="spec.escape" class="pg-select"><option value="'">'</option><option value="&quot;">"</option></select></div>
      </template>
      <div class="pg-row"><label class="pg-row__label" for="ie-null">NULL Strings</label>
        <input id="ie-null" v-model="spec.nullString" class="pg-input" maxlength="16" placeholder="(empty)" autocomplete="off" /></div>
    </div>
    <div v-show="tab === 'Columns'" class="pg-form">
      <div class="pg-row pg-row--top"><span class="pg-row__label">Columns to {{ spec.direction }}</span>
        <div>
          <label class="pg-ie-radio"><input v-model="spec.allColumns" type="checkbox" /> All columns</label>
          <div class="pg-ie-cols" :class="{ 'is-off': spec.allColumns }">
            <label v-for="c in columns" :key="c.name" class="pg-ie-radio">
              <input v-model="spec.columns" type="checkbox" :value="c.name" :disabled="spec.allColumns" /> {{ c.name }}
              <span class="pg-muted pg-ie-type">{{ c.type }}</span></label>
          </div>
        </div></div>
      <p class="pg-row__hint">The column order in the file must match the selected columns.</p>
    </div>
    <PgCode v-if="tab === 'SQL'" :sql="problem ? '-- ' + problem : generated" />
  </PgDialog>
</template>

<script setup lang="ts">
/**
 * Import/Export Data: pgAdmin builds a psql `\copy` and runs it as a
 * background job. Here the same `\copy` runs on the Query Tool surface, which
 * reads and writes the LAB WORKSPACE's files - the file appears in the Files
 * tab and the console can `cat` it - and the job lands in the Processes tab.
 */
import { computed, inject, reactive, ref, watch } from 'vue';
import PgDialog from './PgDialog.vue';
import PgSwitch from './PgSwitch.vue';
import PgCode from './PgCode.vue';
import PgFilePicker from './PgFilePicker.vue';
import { PG } from './pgContext';
import { errorText } from '../../../../utils/portalKit';
import { copySql, safePath, type CopySpec } from './pg';
import { runJob } from './pgJobs';

const props = defineProps<{ table: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const ctx = inject(PG)!;
const tab = ref('General');
const error = ref('');
const busy = ref(false);
const source = ref<'table' | 'query'>('table');

const columns = computed(() => ctx.table(props.table)?.columns || []);
function blank(): CopySpec {
  return { direction: 'export', schema: 'public', table: props.table, columns: columns.value.map(c => c.name), allColumns: true,
    file: `exports/${props.table}.csv`, format: 'csv', header: true, delimiter: ',', quote: '"', escape: "'", nullString: '',
    encoding: 'UTF8', query: '' };
}
const spec = reactive<CopySpec>(blank());
function reset() {
  Object.assign(spec, blank());
  source.value = 'table';
  error.value = '';
}
watch(() => spec.format, f => { if (f === 'text' && spec.delimiter === ',') spec.delimiter = '\t'; if (f === 'csv' && spec.delimiter === '\t') spec.delimiter = ','; });
watch(() => spec.direction, d => { if (d === 'import') source.value = 'table'; });

const fileOk = computed(() => safePath(spec.file));
const problem = computed(() => {
  if (!spec.file.trim()) return 'Please provide a filename.';
  if (!fileOk.value) return 'The filename must be a relative workspace path without spaces or quotes.';
  if (!spec.allColumns && !spec.columns.length) return 'Select at least one column.';
  if (source.value === 'query' && spec.direction === 'export' && !/^\s*(select|with)\b/i.test(spec.query || '')) return 'The export query must be a SELECT.';
  if (spec.direction === 'import' && !ctx.model.value.files.some(f => f.path === spec.file.trim()))
    return `${spec.file.trim()} is not in the workspace - export it, upload it in the Files tab, or pick one with the folder button.`;
  return '';
});
const generated = computed(() => copySql({ ...spec, query: source.value === 'query' && spec.direction === 'export' ? spec.query : '' }));

function info() {
  ctx.notify('info', 'Import/Export data', 'OK runs the \\copy on the SQL tab as a background process; its outcome is in the Processes tab.');
}
function help() {
  ctx.notify('info', 'pgAdmin documentation: import_export_data.html', 'This lab is offline; see COPY and psql\'s \\copy in the PostgreSQL reference.');
}

async function run() {
  if (problem.value) { error.value = problem.value; return; }
  busy.value = true;
  const statement = generated.value;
  const result = await runJob(ctx, { type: spec.direction === 'import' ? 'Import Data' : 'Export Data',
    object: `${ctx.model.value.database}/public.${props.table}`, command: statement },
  () => ctx.runSql(statement, { quiet: true }));
  busy.value = false;
  if (result.ok) emit('close');
  else error.value = errorText(result);
}
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-seg { display: inline-flex; border: 1px solid var(--pg-btn-border); border-radius: var(--pg-radius); overflow: hidden; width: fit-content; }
.pg-seg button { border: 0; border-right: 1px solid var(--pg-btn-border); background: #fff; padding: 5px 14px; font: inherit; font-size: 12.5px; cursor: pointer; color: var(--pg-text); }
.pg-seg button:last-child { border-right: 0; }
.pg-seg button.is-on { background: var(--pg-primary); color: #fff; }
.pg-ie-radio { display: flex; align-items: center; gap: 6px; font-size: 13px; padding: 2px 0; cursor: pointer; }
.pg-ie-src { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.pg-ie-cols { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0 12px; margin-top: 4px; padding: 6px 8px; border: 1px solid var(--pg-border); border-radius: var(--pg-radius); max-height: 220px; overflow: auto; }
.pg-ie-cols.is-off { opacity: .55; }
.pg-ie-type { font-size: 11.5px; }
.pg-ie-note { grid-column: 1 / -1; margin: 0; }
.pg-ie-err { color: var(--pg-error); grid-column: 1 / -1; margin: 0; }
</style>
