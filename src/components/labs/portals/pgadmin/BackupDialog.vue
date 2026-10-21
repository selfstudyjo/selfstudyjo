<template>
  <PgDialog v-model="tab" :title="title" icon="backup" :tabs="['General', 'Data Options', 'Query Options', 'Options', 'Objects', 'Command']"
            :error="error" :busy="busy" save-label="Backup" :width="720" :save-disabled="!!problem"
            @close="$emit('close')" @save="run" @reset="reset" @clear-error="error = ''" @info="info" @help="help">
    <div v-show="tab === 'General'" class="pg-form">
      <div class="pg-row"><label class="pg-row__label is-req" for="bk-file">Filename</label>
        <PgFilePicker id="bk-file" v-model="spec.file" filter="dump" :invalid="!fileOk" /></div>
      <div class="pg-row"><span class="pg-row__label">Format</span>
        <select v-model="spec.format" class="pg-select" aria-label="Format">
          <option value="c">Custom</option><option value="t">Tar</option><option value="p">Plain</option><option value="d">Directory</option>
        </select></div>
      <p class="pg-row__hint">{{ FORMAT_HINT[spec.format] }}</p>
      <div class="pg-row"><span class="pg-row__label">Compression ratio</span>
        <input class="pg-input" type="number" min="0" max="9" disabled placeholder="(default)" aria-label="Compression ratio" /></div>
      <div class="pg-row"><span class="pg-row__label">Encoding</span>
        <select v-model="spec.encoding" class="pg-select" aria-label="Encoding"><option value="">(default)</option><option>UTF8</option><option>LATIN1</option><option>SQL_ASCII</option></select></div>
      <div class="pg-row"><span class="pg-row__label">Role name</span>
        <select v-model="spec.role" class="pg-select" aria-label="Role name"><option value="">(none)</option>
          <option v-for="r in roles" :key="r" :value="r">{{ r }}</option></select></div>
    </div>
    <div v-show="tab === 'Data Options'" class="pg-form">
      <h3 class="pg-sub">Sections / Type of objects</h3>
      <div class="pg-row"><span class="pg-row__label">Only data</span><PgSwitch v-model="spec.dataOnly" label="Only data" :disabled="spec.schemaOnly" /></div>
      <div class="pg-row"><span class="pg-row__label">Only schema</span><PgSwitch v-model="spec.schemaOnly" label="Only schema" :disabled="spec.dataOnly" /></div>
      <h3 class="pg-sub">Do not save</h3>
      <div class="pg-row"><span class="pg-row__label">Owner</span><PgSwitch v-model="spec.noOwner" label="Owner" /></div>
      <div class="pg-row"><span class="pg-row__label">Privileges</span><PgSwitch v-model="spec.noPrivileges" label="Privileges" /></div>
    </div>
    <div v-show="tab === 'Query Options'" class="pg-form">
      <div class="pg-row"><span class="pg-row__label">Use INSERT commands</span><PgSwitch v-model="spec.inserts" label="Use INSERT commands" :disabled="spec.schemaOnly" /></div>
      <div class="pg-row"><span class="pg-row__label">Use Column INSERTS</span><PgSwitch v-model="spec.columnInserts" label="Use Column INSERTS" :disabled="spec.schemaOnly" /></div>
      <div class="pg-row"><span class="pg-row__label">Include DROP DATABASE / clean</span><PgSwitch v-model="spec.clean" label="Include DROP / clean" :disabled="spec.dataOnly" /></div>
      <div class="pg-row"><span class="pg-row__label">Include IF EXISTS clause</span><PgSwitch v-model="spec.ifExists" label="Include IF EXISTS clause" :disabled="!spec.clean" /></div>
      <p class="pg-row__hint">INSERT commands make the dump portable to non-PostgreSQL databases and much slower to restore. Clean adds a DROP before each CREATE (Plain format; for an archive choose Clean in the Restore dialog).</p>
    </div>
    <div v-show="tab === 'Options'" class="pg-form">
      <div class="pg-row"><span class="pg-row__label">Verbose messages</span><PgSwitch v-model="spec.verbose" label="Verbose messages" /></div>
    </div>
    <div v-show="tab === 'Objects'" class="pg-form">
      <p class="pg-muted pg-bk-p">Select the tables to back up. With every table selected the whole database is dumped.</p>
      <label class="pg-bk-check"><input type="checkbox" :checked="allSelected" @change="toggleAll" /> <strong>{{ ctx.model.value.database }} / public</strong>
        <span class="pg-muted">({{ spec.tables.length }} of {{ tables.length }})</span></label>
      <div class="pg-bk-objs">
        <label v-for="t in tables" :key="t.name" class="pg-bk-check">
          <input v-model="spec.tables" type="checkbox" :value="t.name" /> <PgIcon name="table" :size="13" /> {{ t.name }}
          <span class="pg-muted pg-bk-rows">{{ t.rows.toLocaleString('en-US') }} rows</span></label>
      </div>
      <p v-if="!spec.schemaOnly && rowTotal > 5000" class="pg-bk-warn"><PgIcon name="warn" :size="13" /> {{ rowTotal.toLocaleString('en-US') }} rows selected: this lab caps a data dump at 5,000 rows. Choose fewer tables or Only schema.</p>
    </div>
    <PgCode v-if="tab === 'Command'" :sql="problem ? '# ' + problem : command" />
  </PgDialog>
</template>

<script setup lang="ts">
/**
 * Backup (database, schema or table): pgAdmin's dialog in front of pg_dump.
 * The command it shows on the Command tab is the command that runs - on the
 * psql console's surface, writing into the lab workspace - and the job lands
 * in the Processes tab, as pgAdmin's background process does.
 */
import { computed, inject, reactive, ref, watch } from 'vue';
import PgDialog from './PgDialog.vue';
import PgSwitch from './PgSwitch.vue';
import PgCode from './PgCode.vue';
import PgIcon from './PgIcon.vue';
import PgFilePicker from './PgFilePicker.vue';
import { PG, type DialogRequest } from './pgContext';
import { cli, errorText } from '../../../../utils/portalKit';
import { backupArgs, safePath, type BackupSpec } from './pg';
import { runJob } from './pgJobs';

const props = defineProps<{ request: Extract<DialogRequest, { kind: 'backup' }> }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const ctx = inject(PG)!;
const tab = ref('General');
const error = ref('');
const busy = ref(false);

const FORMAT_HINT: Record<BackupSpec['format'], string> = {
  c: 'Custom: a compressed archive for pg_restore; tables can be restored selectively. (In this lab the archive holds readable SQL behind its PGDMP header.)',
  t: 'Tar: an archive for pg_restore, like Custom but uncompressed.',
  p: 'Plain: a SQL script you restore with psql (Restore dialog, format Plain).',
  d: 'Directory: one file per table, for pg_restore. (This lab writes it as a single archive file.)',
};
const tables = computed(() => ctx.model.value.tables.filter(t => (t.raw.kind || 'table') === 'table'));
const roles = computed(() => ctx.model.value.roles.filter(r => !r.builtin).map(r => r.name));
const title = computed(() => (props.request.target === 'table' ? `Backup (Table: ${props.request.table})`
  : props.request.target === 'schema' ? 'Backup (Schema: public)' : `Backup (Database: ${ctx.model.value.database})`));

function defaultFile(fmt: string) {
  const base = props.request.target === 'table' ? props.request.table : ctx.model.value.database;
  return `backups/${base}${fmt === 'p' ? '.sql' : fmt === 't' ? '.tar' : '.backup'}`;
}
function blank(): BackupSpec {
  return { file: defaultFile('c'), format: 'c', encoding: '', role: '', dataOnly: false, schemaOnly: false, noOwner: false,
    noPrivileges: false, inserts: false, columnInserts: false, clean: false, ifExists: false, verbose: true,
    tables: props.request.target === 'table' && props.request.table ? [props.request.table] : tables.value.map(t => t.name),
    server: ctx.model.value.server, database: ctx.model.value.database };
}
const spec = reactive<BackupSpec>(blank());
function reset() { Object.assign(spec, blank()); error.value = ''; }

// Changing the format moves the default extension with it, as pgAdmin does.
let lastFormat = spec.format;
watch(() => spec.format, fmt => {
  if (spec.file === defaultFile(lastFormat)) spec.file = defaultFile(fmt);
  lastFormat = fmt;
});

const allSelected = computed(() => spec.tables.length === tables.value.length);
function toggleAll() { spec.tables = allSelected.value ? [] : tables.value.map(t => t.name); }
const rowTotal = computed(() => tables.value.filter(t => spec.tables.includes(t.name)).reduce((n, t) => n + t.rows, 0));

const fileOk = computed(() => safePath(spec.file));
const problem = computed(() => {
  if (!spec.file.trim()) return 'Please provide a filename.';
  if (!fileOk.value) return 'The filename must be a relative workspace path without spaces or quotes.';
  if (!spec.tables.length) return 'Select at least one table on the Objects tab.';
  return '';
});
const command = computed(() => {
  const args = backupArgs({ ...spec, tables: allSelected.value && props.request.target !== 'table' ? [] : spec.tables });
  return cli(args.base, args.flags);
});

function info() { ctx.notify('info', 'Backup', 'Backup runs pg_dump with the options on the Command tab and records the job in the Processes tab.'); }
function help() { ctx.notify('info', 'pgAdmin documentation: backup_dialog.html', 'This lab is offline; see pg_dump in the PostgreSQL reference.'); }

async function run() {
  if (problem.value) { error.value = problem.value; return; }
  busy.value = true;
  const line = command.value;
  const object = props.request.target === 'table' ? `${ctx.model.value.database}/public.${props.request.table}` : ctx.model.value.database;
  const result = await runJob(ctx, { type: 'Backup Object', object, command: line }, () => ctx.runCli(line, { quiet: true }));
  busy.value = false;
  if (result.ok) emit('close');
  else error.value = errorText(result);
}
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-bk-p { margin: 0; }
.pg-bk-check { display: flex; align-items: center; gap: 6px; font-size: 13px; padding: 2px 0; cursor: pointer; }
.pg-bk-objs { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0 12px; padding: 6px 8px 6px 22px; border: 1px solid var(--pg-border); border-radius: var(--pg-radius); max-height: 260px; overflow: auto; }
.pg-bk-rows { margin-left: auto; font-size: 11.5px; }
.pg-bk-warn { margin: 0; display: flex; align-items: center; gap: 6px; color: #8a4b00; background: #fdf0dc; border: 1px solid #f2cf9b; padding: 6px 8px; border-radius: var(--pg-radius); font-size: 12.5px; }
</style>
