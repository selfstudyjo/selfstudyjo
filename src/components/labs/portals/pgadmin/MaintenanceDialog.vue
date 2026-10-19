<template>
  <PgDialog v-model="tab" :title="`Maintenance - ${request.target === 'database' ? request.name : request.name}`" icon="refresh"
            :tabs="['Options', 'SQL']" :error="error" :busy="busy" save-label="OK" :width="620"
            @close="$emit('close')" @save="run" @reset="reset" @clear-error="error = ''" @info="info" @help="help">
    <div v-show="tab === 'Options'" class="pg-form">
      <div class="pg-row"><span class="pg-row__label">Maintenance operation</span>
        <div class="pg-seg" role="radiogroup" aria-label="Maintenance operation">
          <button v-for="op in ops" :key="op" type="button" role="radio" :aria-checked="spec.op === op"
                  :class="{ 'is-on': spec.op === op }" @click="spec.op = op">{{ op }}</button>
          <button v-for="op in unavailable" :key="op" type="button" role="radio" aria-checked="false" disabled
                  title="Not available on this lab server">{{ op }}</button>
        </div></div>
      <template v-if="spec.op === 'VACUUM'">
        <h3 class="pg-sub">Vacuum</h3>
        <div class="pg-row"><span class="pg-row__label">FULL</span><PgSwitch v-model="spec.full" label="FULL" /></div>
        <div class="pg-row"><span class="pg-row__label">FREEZE</span><PgSwitch v-model="spec.freeze" label="FREEZE" /></div>
        <div class="pg-row"><span class="pg-row__label">ANALYZE</span><PgSwitch v-model="spec.analyze" label="ANALYZE" /></div>
        <div class="pg-row"><span class="pg-row__label">DISABLE_PAGE_SKIPPING</span><PgSwitch v-model="spec.disablePageSkipping" label="DISABLE_PAGE_SKIPPING" /></div>
        <div class="pg-row"><span class="pg-row__label">SKIP_LOCKED</span><PgSwitch v-model="spec.skipLocked" label="SKIP_LOCKED" /></div>
      </template>
      <div class="pg-row"><span class="pg-row__label">Verbose Messages</span><PgSwitch v-model="spec.verbose" label="Verbose Messages" /></div>
      <p class="pg-row__hint pg-mhint">{{ hint }}</p>
    </div>
    <PgCode v-if="tab === 'SQL'" :sql="generated" />
  </PgDialog>
</template>

<script setup lang="ts">
/**
 * Maintenance: VACUUM (FULL, FREEZE, ANALYZE, ...), ANALYZE, REINDEX or
 * CLUSTER on a table, an index or the whole database. pgAdmin runs it as a
 * background process; here it runs on the Query Tool surface and is recorded
 * in the Processes tab with its outcome.
 */
import { computed, inject, reactive, ref } from 'vue';
import PgDialog from './PgDialog.vue';
import PgSwitch from './PgSwitch.vue';
import PgCode from './PgCode.vue';
import { PG, type DialogRequest } from './pgContext';
import { errorText } from '../../../../utils/portalKit';
import { maintenanceSql, type MaintenanceSpec } from './pg';

const props = defineProps<{ request: Extract<DialogRequest, { kind: 'maintenance' }> }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const ctx = inject(PG)!;

const tab = ref('Options');
const error = ref('');
const busy = ref(false);
// REINDEX and CLUSTER are pgAdmin's other two operations; this lab's server
// does not implement them, so they are shown and not offered rather than
// offered and refused with a syntax error.
const ops: MaintenanceSpec['op'][] = ['VACUUM', 'ANALYZE'];
const unavailable = ['REINDEX', 'CLUSTER'];

function blank(): MaintenanceSpec {
  return { op: 'VACUUM', full: false, freeze: false, analyze: false,
    disablePageSkipping: false, skipLocked: false, verbose: true };
}
const spec = reactive<MaintenanceSpec>(blank());
function reset() {
  Object.assign(spec, blank());
  error.value = '';
}

const target = computed(() => ({ kind: props.request.target, schema: 'public', name: props.request.name }));
const generated = computed(() => maintenanceSql(spec, target.value));
const hint = computed(() => ({
  VACUUM: 'VACUUM reclaims storage held by dead tuples; with ANALYZE it also refreshes the planner statistics.',
  ANALYZE: 'ANALYZE collects statistics about the contents of tables, which the query planner uses to choose plans.',
  REINDEX: 'REINDEX rebuilds an index using the data stored in the index\'s table, replacing the old copy.',
  CLUSTER: 'CLUSTER physically reorders a table on disk based on an index it was previously clustered on.',
}[spec.op]));

function info() {
  ctx.notify('info', 'Maintenance', 'OK runs the statement on the SQL tab and records it in the Processes tab.');
}
function help() {
  ctx.notify('info', 'pgAdmin documentation: maintenance_dialog.html', 'This lab is offline; see VACUUM, ANALYZE, REINDEX and CLUSTER in the PostgreSQL reference.');
}

async function run() {
  busy.value = true;
  const started = performance.now();
  const result = await ctx.runSql(generated.value, { quiet: true });
  busy.value = false;
  const ms = Math.round(performance.now() - started);
  const object = props.request.target === 'database' ? props.request.name : `public.${props.request.name}`;
  ctx.processes.value = [{
    id: Date.now(), type: `Maintenance (${spec.op})`, server: `${ctx.model.value.server} (shop-db.shopflow.internal:5432)`,
    object, sql: generated.value, ok: result.ok, at: new Date().toISOString().replace('T', ' ').slice(0, 19), ms,
    detail: result.ok ? String(result.output || spec.op).trim() : errorText(result),
  }, ...ctx.processes.value].slice(0, 30);
  if (result.ok) {
    ctx.notify('success', `Maintenance (${spec.op}) - ${object}`, 'Successfully completed.');
    emit('close');
  } else {
    error.value = errorText(result);
  }
}
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--pg-btn-border); border-radius: var(--pg-radius); overflow: hidden; width: fit-content; }
.pg-seg button { border: 0; border-right: 1px solid var(--pg-btn-border); background: #fff; padding: 5px 12px; font: inherit; font-size: 12.5px; cursor: pointer; color: var(--pg-text); }
.pg-seg button:last-child { border-right: 0; }
.pg-seg button.is-on { background: var(--pg-primary); color: #fff; }
.pg-seg button:disabled { color: var(--pg-grey-800); background: var(--pg-grey-200); cursor: not-allowed; }
.pg-mhint { margin: 4px 0 0; }
</style>
