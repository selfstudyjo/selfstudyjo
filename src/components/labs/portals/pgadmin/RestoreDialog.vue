<template>
  <PgDialog v-model="tab" :title="title" icon="restore" :tabs="['General', 'Data Options', 'Query Options', 'Options', 'Command']"
            :error="error" :busy="busy" save-label="Restore" :width="700" :save-disabled="!!problem"
            @close="$emit('close')" @save="run" @reset="reset" @clear-error="error = ''" @info="info" @help="help">
    <div v-show="tab === 'General'" class="pg-form">
      <div class="pg-row"><span class="pg-row__label">Format</span>
        <select v-model="spec.format" class="pg-select" aria-label="Format">
          <option value="archive">Custom or tar</option><option value="archive" disabled>Directory</option><option value="p">Plain</option>
        </select></div>
      <div class="pg-row"><label class="pg-row__label is-req" for="rs-file">Filename</label>
        <PgFilePicker id="rs-file" v-model="spec.file" filter="dump" :invalid="!!spec.file && !fileOk" /></div>
      <p v-if="formatMismatch" class="pg-row__hint pg-rs-warn">{{ formatMismatch }}</p>
      <div class="pg-row"><span class="pg-row__label">Number of jobs</span><input class="pg-input" type="number" disabled placeholder="1" aria-label="Number of jobs" /></div>
      <div class="pg-row"><span class="pg-row__label">Role name</span>
        <select v-model="spec.role" class="pg-select" aria-label="Role name" :disabled="spec.format === 'p'"><option value="">(none)</option>
          <option v-for="r in roles" :key="r" :value="r">{{ r }}</option></select></div>
      <p class="pg-row__hint">{{ spec.format === 'p' ? 'A Plain backup is a SQL script: it is restored by running it with psql.' : 'An archive is restored with pg_restore, which can pick sections and tables.' }}</p>
    </div>
    <div v-show="tab === 'Data Options'" class="pg-form">
      <h3 class="pg-sub">Sections / Type of objects</h3>
      <div class="pg-row"><span class="pg-row__label">Only data</span><PgSwitch v-model="spec.dataOnly" label="Only data" :disabled="spec.format === 'p' || spec.schemaOnly" /></div>
      <div class="pg-row"><span class="pg-row__label">Only schema</span><PgSwitch v-model="spec.schemaOnly" label="Only schema" :disabled="spec.format === 'p' || spec.dataOnly" /></div>
      <h3 class="pg-sub">Do not save</h3>
      <div class="pg-row"><span class="pg-row__label">Owner</span><PgSwitch v-model="spec.noOwner" label="Owner" :disabled="spec.format === 'p'" /></div>
      <template v-if="request.target === 'table' && spec.format !== 'p'">
        <h3 class="pg-sub">Objects</h3>
        <div class="pg-row"><span class="pg-row__label">Restore only table</span><code class="pg-mono">{{ request.table }}</code></div>
      </template>
    </div>
    <div v-show="tab === 'Query Options'" class="pg-form">
      <div class="pg-row"><span class="pg-row__label">Clean before restore</span><PgSwitch v-model="spec.clean" label="Clean before restore" :disabled="spec.format === 'p' || spec.dataOnly" /></div>
      <div class="pg-row"><span class="pg-row__label">Include IF EXISTS clause</span><PgSwitch v-model="spec.ifExists" label="Include IF EXISTS clause" :disabled="!spec.clean" /></div>
      <div class="pg-row"><span class="pg-row__label">Single transaction</span><PgSwitch :model-value="false" label="Single transaction" disabled /></div>
      <p class="pg-row__hint">Clean drops each table before recreating it. Without it, restoring into tables that already exist fails on the CREATE and on the primary key - pg_restore reports the errors and carries on.</p>
    </div>
    <div v-show="tab === 'Options'" class="pg-form">
      <div class="pg-row"><span class="pg-row__label">Exit on error</span><PgSwitch v-model="spec.exitOnError" label="Exit on error" :disabled="spec.format === 'p'" /></div>
      <div class="pg-row"><span class="pg-row__label">Verbose messages</span><PgSwitch v-model="spec.verbose" label="Verbose messages" :disabled="spec.format === 'p'" /></div>
    </div>
    <PgCode v-if="tab === 'Command'" :sql="problem ? '# ' + problem : command" />
  </PgDialog>
</template>

<script setup lang="ts">
/**
 * Restore: pg_restore for a Custom/Tar archive, psql -f for a Plain script -
 * the two programs pgAdmin runs. The command runs on the psql console's
 * surface against the lab workspace's file and lands in the Processes tab.
 */
import { computed, inject, reactive, ref, watch } from 'vue';
import PgDialog from './PgDialog.vue';
import PgSwitch from './PgSwitch.vue';
import PgCode from './PgCode.vue';
import PgFilePicker from './PgFilePicker.vue';
import { PG, type DialogRequest } from './pgContext';
import { cli, errorText } from '../../../../utils/portalKit';
import { restoreArgs, safePath, type RestoreSpec } from './pg';
import { runJob } from './pgJobs';

const props = defineProps<{ request: Extract<DialogRequest, { kind: 'restore' }> }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const ctx = inject(PG)!;
const tab = ref('General');
const error = ref('');
const busy = ref(false);

const roles = computed(() => ctx.model.value.roles.filter(r => !r.builtin).map(r => r.name));
const title = computed(() => (props.request.target === 'table' ? `Restore (Table: ${props.request.table})`
  : props.request.target === 'schema' ? 'Restore (Schema: public)' : `Restore (Database: ${ctx.model.value.database})`));

function blank(): RestoreSpec {
  const latest = ctx.model.value.files.filter(f => f.archive || /\.sql$/i.test(f.path)).slice(-1)[0];
  return { file: latest?.path || '', format: latest && !latest.archive ? 'p' : 'archive', role: '', dataOnly: false, schemaOnly: false,
    clean: false, ifExists: false, exitOnError: false, noOwner: false, verbose: true,
    tables: props.request.target === 'table' && props.request.table ? [props.request.table] : [],
    server: ctx.model.value.server, database: ctx.model.value.database };
}
const spec = reactive<RestoreSpec>(blank());
function reset() { Object.assign(spec, blank()); error.value = ''; }

// Picking a file whose kind is known chooses the format for the student.
watch(() => spec.file, path => {
  const f = ctx.model.value.files.find(x => x.path === path.trim());
  if (f) spec.format = f.archive ? 'archive' : 'p';
});
const picked = computed(() => ctx.model.value.files.find(x => x.path === spec.file.trim()));
const formatMismatch = computed(() => {
  if (!picked.value) return '';
  if (picked.value.archive && spec.format === 'p') return 'This file is a pg_dump archive: restore it as Custom or tar.';
  if (!picked.value.archive && spec.format !== 'p') return 'This file is a plain-text SQL dump: pg_restore will refuse it - choose Plain.';
  return '';
});
const fileOk = computed(() => safePath(spec.file));
const problem = computed(() => {
  if (!spec.file.trim()) return 'Please select a backup file.';
  if (!fileOk.value) return 'The filename must be a relative workspace path without spaces or quotes.';
  if (!picked.value) return `${spec.file.trim()} is not in the workspace.`;
  return '';
});
const command = computed(() => {
  const args = restoreArgs(spec);
  return cli(args.base, args.flags) + (spec.format === 'archive' ? ' ' + cli([spec.file.trim()]) : '');
});

function info() { ctx.notify('info', 'Restore', 'Restore runs the command on the Command tab and records the job in the Processes tab.'); }
function help() { ctx.notify('info', 'pgAdmin documentation: restore_dialog.html', 'This lab is offline; see pg_restore and psql in the PostgreSQL reference.'); }

async function run() {
  if (problem.value) { error.value = problem.value; return; }
  busy.value = true;
  const line = command.value;
  const object = props.request.target === 'table' ? `${ctx.model.value.database}/public.${props.request.table}` : ctx.model.value.database;
  const result = await runJob(ctx, { type: 'Restore Object', object, command: line }, async () => {
    const r = await ctx.runCli(line, { quiet: true });
    // psql -f carries on past an error and exits 0, as it does for real; pgAdmin still flags the job.
    if (r.ok && spec.format === 'p' && /\bERROR:/.test(String(r.output || ''))) return { ...r, ok: false, error: String(r.output) };
    return r;
  });
  busy.value = false;
  if (result.ok) emit('close');
  else error.value = errorText(result);
}
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-rs-warn { color: #8a4b00; grid-column: 1 / -1; margin: 0; }
</style>
