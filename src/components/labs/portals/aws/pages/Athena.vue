<template>
  <!-- Workgroups -->
  <div v-if="page === 'workgroups'">
    <CsTable v-model:selected="selWg" title="Workgroups" variant="full-page" :items="workgroups" :columns="wgColumns" track-by="name"
             selection-type="single" empty-title="No workgroups"
             description="Workgroups separate users, teams and applications, enforce a query result location and limit the data each query may scan.">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!currentWg" @click="openEdit">Edit</button>
        <button type="button" class="cs-btn" :disabled="!currentWg || currentWg.name === 'primary'" @click="wgDeleting = true">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="openCreate">Create workgroup</button>
      </template>
      <template #cell-state="{ row }"><CsStatus :state="row.state === 'ENABLED' ? 'enabled' : 'disabled'" :label="row.state === 'ENABLED' ? 'Enabled' : 'Disabled'" /></template>
    </CsTable>
    <CsModal v-if="wgForm.open" :title="wgForm.editing ? `Edit workgroup: ${wgForm.name}` : 'Create workgroup'" size="large" @close="wgForm.open = false">
      <div class="cs-stack">
        <div class="cs-field"><label class="cs-label" for="wg-name">Workgroup name</label>
          <input id="wg-name" v-model.trim="wgForm.name" class="cs-input" :disabled="wgForm.editing" /></div>
        <div class="cs-field"><label class="cs-label" for="wg-desc">Description <small>- optional</small></label>
          <input id="wg-desc" v-model="wgForm.description" class="cs-input" :disabled="wgForm.editing" /></div>
        <div class="cs-field"><label class="cs-label" for="wg-out">Location of query result</label>
          <input id="wg-out" v-model.trim="wgForm.output" class="cs-input cs-mono" placeholder="s3://bucket/prefix/" /></div>
        <label class="cs-check"><input v-model="wgForm.enforce" type="checkbox" /> Override client-side settings
          <small>Queries in this workgroup always use the workgroup's result location and settings.</small></label>
        <label class="cs-check"><input v-model="wgForm.metrics" type="checkbox" /> Publish query metrics to AWS CloudWatch</label>
        <div class="cs-field"><label class="cs-label" for="wg-cut">Per query data usage control <small>- bytes scanned limit</small></label>
          <div class="cs-row"><input id="wg-cut" v-model.number="wgForm.limit" type="number" min="0" class="cs-input at__num" />
            <select v-model="wgForm.unit" class="cs-select at__unit" aria-label="Unit"><option value="MB">MB</option><option value="GB">GB</option><option value="TB">TB</option></select></div>
          <span class="cs-constraint">Minimum 10 MB. Leave 0 for no limit. A query that would scan more is cancelled.</span></div>
        <div v-if="!wgForm.editing" class="cs-field"><label class="cs-label" for="wg-tag">Tag cost-center <small>- optional</small></label>
          <input id="wg-tag" v-model.trim="wgForm.costCenter" class="cs-input" /></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="wgForm.open = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !wgForm.name" @click="saveWg">{{ wgForm.editing ? 'Save changes' : 'Create workgroup' }}</button>
      </template>
    </CsModal>
    <CsDelete v-if="wgDeleting && currentWg" :title="`Delete workgroup ${currentWg.name}?`" word="delete" :busy="busy"
              @close="wgDeleting = false" @confirm="deleteWg" />
  </div>

  <!-- Query editor -->
  <div v-else class="at">
    <div class="at__top">
      <h1 class="at__h">Query editor</h1>
      <div class="cs-row">
        <label class="at__wglabel" for="at-wg">Workgroup</label>
        <select id="at-wg" v-model="workgroup" class="cs-select at__wg">
          <option v-for="w in workgroups" :key="w.name" :value="w.name">{{ w.name }}</option></select>
      </div>
    </div>
    <div class="cs-tabs" role="tablist">
      <button v-for="t in ['Editor', 'Recent queries', 'Saved queries']" :key="t" type="button" class="cs-tab" role="tab"
              :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
    </div>
    <div v-if="tab === 'Editor'" class="at__grid">
      <aside class="at__side">
        <div class="cs-field"><label class="cs-label" for="at-src">Data source</label><select id="at-src" class="cs-select" disabled><option>AwsDataCatalog</option></select></div>
        <div class="cs-field"><label class="cs-label" for="at-db">Database</label>
          <select id="at-db" v-model="database" class="cs-select"><option v-for="d in databases" :key="d.name" :value="d.name">{{ d.name }}</option></select></div>
        <div class="at__tables">
          <strong>Tables ({{ dbTables.length }})</strong>
          <details v-for="t in dbTables" :key="t.name" class="at__table">
            <summary><span class="cs-mono">{{ t.name }}</span> <span v-if="t.partition_keys.length" class="cs-badge cs-badge--grey">Partitioned</span></summary>
            <ul><li v-for="c in t.columns" :key="c.name">{{ c.name }} <span class="cs-muted">{{ c.type }}</span></li>
              <li v-for="k in t.partition_keys" :key="k">{{ k }} <span class="cs-muted">string (Partitioned)</span></li></ul>
            <button type="button" class="cs-btn cs-btn--inline" @click="preview(t.name)">Preview Table</button>
          </details>
        </div>
      </aside>
      <div class="at__main">
        <textarea v-model="sql" class="cs-textarea cs-mono at__sql" spellcheck="false" aria-label="Query" />
        <div class="cs-row at__bar">
          <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !sql.trim()" @click="runQuery"><span v-if="busy" class="cs-btn__spinner" />Run</button>
          <button type="button" class="cs-btn" :disabled="!sql.trim()" @click="saving = true">Save as</button>
          <button type="button" class="cs-btn cs-btn--link" @click="sql = ''">Clear</button>
        </div>
        <section class="cs-container at__results">
          <div class="cs-container__head"><CsHeader title="Query results" :level="2" :info="false" /></div>
          <div class="cs-container__body">
            <template v-if="last">
              <div class="at__stats">
                <span><strong>Status</strong> <CsStatus :state="last.state === 'SUCCEEDED' ? 'success' : 'failed'" :label="last.state === 'SUCCEEDED' ? 'Completed' : 'Failed'" /></span>
                <span><strong>Run time</strong> {{ (last.engine_ms / 1000).toFixed(3) }} sec</span>
                <span><strong>Data scanned</strong> {{ scanned(last.scanned) }}</span>
                <span v-if="last.partitions_total"><strong>Partitions read</strong> {{ last.partitions_read }} of {{ last.partitions_total }}</span>
              </div>
              <div v-if="last.error" class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" /><div>{{ last.error }}</div></div>
              <div v-else-if="last.columns.length" class="cs-scroll-x">
                <table class="cs-table-mini at__res"><thead><tr><th>#</th><th v-for="c in last.columns" :key="c">{{ c }}</th></tr></thead>
                  <tbody><tr v-for="(r, i) in last.rows" :key="i"><td>{{ i + 1 }}</td><td v-for="(v, j) in r" :key="j">{{ v }}</td></tr></tbody></table>
              </div>
              <div v-else class="cs-empty">Query successful.</div>
            </template>
            <div v-else-if="refused" class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" /><div>{{ refused }}</div></div>
            <div v-else class="cs-empty">Run a query to see results.</div>
          </div>
        </section>
      </div>
    </div>
    <CsTable v-else-if="tab === 'Recent queries'" title="Recent queries" :items="executions" :columns="exColumns" track-by="id" empty-title="No queries">
      <template #cell-state="{ row }"><CsStatus :state="row.state === 'SUCCEEDED' ? 'success' : 'failed'" :label="row.state === 'SUCCEEDED' ? 'Completed' : 'Failed'" /></template>
      <template #cell-query="{ row }"><a href="#" class="cs-link cs-mono at__q" @click.prevent="sql = row.query; tab = 'Editor'">{{ row.query }}</a></template>
    </CsTable>
    <CsTable v-else title="Saved queries" :items="saved" :columns="savedColumns" track-by="id" empty-title="No saved queries">
      <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="openSaved(row)">{{ row.name }}</a></template>
    </CsTable>
    <CsModal v-if="saving" title="Save query" @close="saving = false">
      <div class="cs-stack">
        <div class="cs-field"><label class="cs-label" for="at-sname">Query name</label><input id="at-sname" v-model.trim="saveName" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label" for="at-sdesc">Description <small>- optional</small></label><input id="at-sdesc" v-model="saveDesc" class="cs-input" /></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="saving = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!saveName || busy" @click="saveQuery">Save query</button>
      </template>
    </CsModal>
  </div>
</template>

<script setup lang="ts">
/** Amazon Athena: the query editor (results, data scanned, partitions read), recent and saved queries, workgroups. */
import { computed, reactive, ref, watch } from 'vue';
import { cli, errorText, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { awsDate, useAws } from '../ctx';

const ctx = useAws();
const page = computed(() => ctx.route.value.page);
const params = computed(() => ctx.route.value.params || {});
const workgroups = computed(() => rows(ctx.view.value, 'athena.workgroups'));
const executions = computed(() => rows(ctx.view.value, 'athena.executions'));
const saved = computed(() => rows(ctx.view.value, 'athena.named_queries'));
const databases = computed(() => rows(ctx.view.value, 'glue.databases'));
const workgroup = ref(workgroups.value.find(w => w.name !== 'primary')?.name || 'primary');
const database = ref(params.value.db || databases.value[0]?.name || 'default');
const dbTables = computed(() => rows(ctx.view.value, 'glue.tables').filter(t => t.database === database.value));
const sql = ref(params.value.table ? `SELECT * FROM "${params.value.db}"."${params.value.table}" LIMIT 10;` : '');
const lastId = ref('');
const refused = ref('');
const last = computed(() => executions.value.find(e => e.id === lastId.value) || null);
const tab = ref('Editor');
const busy = ref(false);
const saving = ref(false);
const saveName = ref('daily-revenue');
const saveDesc = ref('');
const selWg = ref<string[]>([]);
const currentWg = computed(() => workgroups.value.find(w => w.name === selWg.value[0]) || null);
const wgDeleting = ref(false);
const wgForm = reactive({ open: false, editing: false, name: '', description: '', output: '', enforce: true, metrics: true,
  limit: 10, unit: 'GB', costCenter: '' });
watch(databases, list => { if (!list.some(d => d.name === database.value) && list[0]) database.value = list[0].name; });

const MB = 1024 ** 2;
const GB = 1024 ** 3;
const TB = 1024 ** 4;
const UNIT: Record<string, number> = { MB, GB, TB };
const unitOf = (u: string) => UNIT[u] ?? GB;
function scanned(n: number) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${n} bytes`;
}

const wgColumns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' }, { id: 'state', header: 'State' },
  { id: 'output', header: 'Query result location', cell: r => r.output || '-' },
  { id: 'enforced', header: 'Override client-side settings', cell: r => (r.enforced ? 'Yes' : 'No') },
  { id: 'cutoff', header: 'Per-query limit', cell: r => (r.cutoff ? scanned(r.cutoff) : 'None') },
  { id: 'description', header: 'Description' },
];
const exColumns: Column[] = [
  { id: 'id', header: 'Execution ID' }, { id: 'query', header: 'Query' }, { id: 'state', header: 'Status' },
  { id: 'scanned', header: 'Data scanned', cell: r => scanned(r.scanned) }, { id: 'workgroup', header: 'Workgroup' },
  { id: 'submitted', header: 'Start time', cell: r => awsDate(r.submitted) },
];
const savedColumns: Column[] = [
  { id: 'name', header: 'Name' }, { id: 'database', header: 'Database' }, { id: 'workgroup', header: 'Workgroup' },
  { id: 'description', header: 'Description' },
];

async function runQuery() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'athena', 'start-query-execution'], {
    '--work-group': workgroup.value, '--query-execution-context': `Database=${database.value}`, '--query-string': sql.value.trim(),
  }), '', { quiet: true });
  const data = (result.data || {}) as { execution?: { id: string } };
  refused.value = result.ok ? '' : errorText(result);
  if (!result.ok) lastId.value = '';
  if (data.execution) lastId.value = data.execution.id;
  else if (result.ok) lastId.value = executions.value[0]?.id || '';
  busy.value = false;
}
function preview(name: string) {
  sql.value = `SELECT * FROM "${database.value}"."${name}" LIMIT 10;`;
  runQuery();
}
function openSaved(row: Record<string, any>) {
  sql.value = row.query;
  database.value = row.database;
  workgroup.value = row.workgroup;
  tab.value = 'Editor';
}
async function saveQuery() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'athena', 'create-named-query'], {
    '--name': saveName.value, '--database': database.value, '--work-group': workgroup.value,
    '--query-string': sql.value.trim(), '--description': saveDesc.value,
  }), `Saved query ${saveName.value}.`);
  busy.value = false;
  if (result.ok) saving.value = false;
}
function openCreate() {
  Object.assign(wgForm, { open: true, editing: false, name: '', description: '', output: 's3://shopflow-lake/_athena_results/', enforce: true,
    metrics: true, limit: 10, unit: 'GB', costCenter: '' });
}
function openEdit() {
  const w = currentWg.value!;
  const unit = w.cutoff >= TB ? 'TB' : w.cutoff >= GB ? 'GB' : 'MB';
  Object.assign(wgForm, { open: true, editing: true, name: w.name, description: w.description, output: w.output,
    enforce: w.enforced, metrics: w.metrics, limit: w.cutoff ? Math.round(w.cutoff / unitOf(unit)) : 0, unit });
}
async function saveWg() {
  const cutoff = Math.round((wgForm.limit || 0) * unitOf(wgForm.unit));
  const parts = [];
  if (wgForm.output) parts.push(`ResultConfiguration${wgForm.editing ? 'Updates' : ''}={OutputLocation=${wgForm.output}}`);
  parts.push(`EnforceWorkGroupConfiguration=${wgForm.enforce}`, `PublishCloudWatchMetricsEnabled=${wgForm.metrics}`);
  if (cutoff) parts.push(`BytesScannedCutoffPerQuery=${cutoff}`);
  else if (wgForm.editing) parts.push('RemoveBytesScannedCutoffPerQuery=true');
  busy.value = true;
  const result = wgForm.editing
    ? await ctx.run(cli(['aws', 'athena', 'update-work-group'], { '--work-group': wgForm.name, '--configuration-updates': parts.join(',') }),
      `Workgroup ${wgForm.name} updated.`)
    : await ctx.run(cli(['aws', 'athena', 'create-work-group'], { '--name': wgForm.name, '--description': wgForm.description,
      '--configuration': parts.join(','), '--tags': wgForm.costCenter ? `Key=cost-center,Value=${wgForm.costCenter}` : '' }),
    `Workgroup ${wgForm.name} created.`);
  busy.value = false;
  if (result.ok) wgForm.open = false;
}
async function deleteWg() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'athena', 'delete-work-group'], { '--work-group': currentWg.value!.name, '--recursive-delete-option': true }),
    'Workgroup deleted.');
  busy.value = false;
  if (result.ok) { wgDeleting.value = false; selWg.value = []; }
}
</script>

<style scoped>
.at__top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 12px; }
.at__h { font-size: 24px; line-height: 30px; margin: 0; }
.at__wglabel { font-weight: 700; }
.at__wg { width: 220px; }
.at__grid { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 16px; }
.at__side { border: 1px solid #c6c6cd; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 12px; align-self: start; }
.at__tables { display: flex; flex-direction: column; gap: 6px; }
.at__table summary { cursor: pointer; padding: 2px 0; }
.at__table ul { margin: 4px 0 4px 16px; padding: 0; list-style: none; font-size: 13px; }
.at__sql { min-height: 180px; background: #fbfbfc; }
.at__bar { margin: 8px 0 16px; }
.at__stats { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-bottom: 12px; align-items: center; }
.at__res td { white-space: nowrap; }
.at__q { display: inline-block; max-width: 460px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; }
.at__num { width: 130px; }
.at__unit { width: 90px; }
@container sl-portal (max-width: 900px) { .at__grid { grid-template-columns: minmax(0, 1fr); } }
</style>
