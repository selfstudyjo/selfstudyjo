<template>
  <!-- Query editor v2 -->
  <div v-if="page === 'editor'" class="qe">
    <aside class="qe__tree">
      <strong class="qe__h">Serverless</strong>
      <div v-if="!workgroups.length" class="cs-muted">No workgroups yet.</div>
      <div v-for="w in workgroups" :key="w.name">
        <button type="button" class="qe__node" :class="{ 'is-on': w.name === wg }" @click="wg = w.name">{{ w.name }}</button>
        <div v-if="w.name === wg" class="qe__inner">
          <div class="cs-muted">dev</div>
          <details v-for="schema in schemas" :key="schema" open>
            <summary>{{ schema }}</summary>
            <ul><li v-for="t in tablesIn(schema)" :key="t.name"><button type="button" class="cs-btn cs-btn--inline" @click="sql = `SELECT * FROM ${t.name} LIMIT 10;`">{{ t.name.split('.')[1] }}</button>
              <span class="cs-muted"> ({{ t.rows }})</span></li></ul>
          </details>
        </div>
      </div>
    </aside>
    <div class="qe__main">
      <div class="cs-row qe__bar">
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!wg || !sql.trim() || busy" @click="run"><span v-if="busy" class="cs-btn__spinner" />Run</button>
        <span class="cs-muted">Workgroup: <strong>{{ wg || 'select a workgroup' }}</strong> - database: dev</span>
      </div>
      <textarea v-model="sql" class="cs-textarea cs-mono qe__sql" spellcheck="false" aria-label="SQL" />
      <section class="cs-container">
        <div class="cs-container__head"><CsHeader title="Result" :level="2" :info="false" /></div>
        <div class="cs-container__body">
          <template v-if="last">
            <div class="cs-row qe__stats"><CsStatus :state="last.status === 'FINISHED' ? 'success' : 'failed'" :label="last.status === 'FINISHED' ? 'Finished' : 'Failed'" />
              <span>Elapsed time: {{ last.duration_ms }} ms</span>
              <span v-if="last.kind === 'COPY'">Rows loaded: {{ last.rows_loaded }}</span></div>
            <div v-if="last.error" class="cs-alert cs-alert--error"><CsIcon name="status-negative" class="cs-alert__icon" /><div>{{ last.error }}</div></div>
            <div v-else-if="last.columns.length" class="cs-scroll-x"><table class="cs-table-mini">
              <thead><tr><th v-for="c in last.columns" :key="c">{{ c }}</th></tr></thead>
              <tbody><tr v-for="(r, i) in last.records" :key="i"><td v-for="(v, j) in r" :key="j">{{ v }}</td></tr></tbody></table></div>
            <div v-else class="cs-empty">Statement completed successfully.</div>
          </template>
          <div v-else class="cs-empty">Run a statement to see the result.</div>
        </div>
      </section>
    </div>
  </div>

  <!-- Serverless dashboard -->
  <div v-else>
    <CsHeader title="Serverless dashboard" description="Redshift Serverless: a namespace holds the database, users and IAM roles; a workgroup is the compute, measured in RPUs." />
    <CsTable v-model:selected="selNs" title="Namespaces" :items="namespaces" :columns="nsColumns" track-by="name" selection-type="single" empty-title="No namespaces">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!selNs.length" @click="nsDeleting = true">Delete</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="create.open = true">Create workgroup</button>
      </template>
    </CsTable>
    <CsTable v-model:selected="selWg" title="Workgroups" :items="workgroups" :columns="wgColumns" track-by="name" selection-type="single" empty-title="No workgroups">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!selWg.length" @click="wgDeleting = true">Delete</button>
        <button type="button" class="cs-btn" @click="ctx.to('redshift', 'editor')">Query data</button>
      </template>
    </CsTable>
    <CsModal v-if="create.open" title="Create workgroup" size="large" @close="create.open = false">
      <div class="cs-stack">
        <div class="cs-grid-2">
          <div class="cs-field"><label class="cs-label" for="rs-wg">Workgroup name</label><input id="rs-wg" v-model.trim="create.wg" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="rs-base">Base capacity (RPUs)</label>
            <select id="rs-base" v-model.number="create.base" class="cs-select"><option v-for="n in [8, 16, 32, 64, 128]" :key="n" :value="n">{{ n }}</option></select></div>
          <div class="cs-field"><label class="cs-label" for="rs-ns">Namespace name</label><input id="rs-ns" v-model.trim="create.ns" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="rs-db">Database name</label><input id="rs-db" v-model.trim="create.db" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="rs-admin">Admin user name</label><input id="rs-admin" v-model.trim="create.admin" class="cs-input" /></div>
          <div class="cs-field"><label class="cs-label" for="rs-role">Associated IAM role</label>
            <select id="rs-role" v-model="create.role" class="cs-select"><option value="">None</option>
              <option v-for="r in roles" :key="r.arn" :value="r.arn">{{ r.name }}</option></select></div>
        </div>
        <label class="cs-check"><input type="checkbox" checked disabled /> Manage admin credentials in AWS Secrets Manager</label>
        <span class="cs-constraint">Network: the default VPC's subnets in three Availability Zones.</span>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="create.open = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!create.wg || !create.ns || busy" @click="createWorkgroup">Create</button>
      </template>
    </CsModal>
    <CsDelete v-if="wgDeleting" :title="`Delete workgroup ${selWg[0]}?`" word="delete" :busy="busy" @close="wgDeleting = false" @confirm="deleteWg" />
    <CsDelete v-if="nsDeleting" :title="`Delete namespace ${selNs[0]}?`" word="delete" :busy="busy" @close="nsDeleting = false" @confirm="deleteNs" />
  </div>
</template>

<script setup lang="ts">
/** Amazon Redshift Serverless: namespaces and workgroups, and Query editor v2 over the Data API. */
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import CsStatus from '../CsStatus.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const page = computed(() => ctx.route.value.page);
const namespaces = computed(() => rows(ctx.view.value, 'redshift.namespaces'));
const workgroups = computed(() => rows(ctx.view.value, 'redshift.workgroups'));
const statements = computed(() => rows(ctx.view.value, 'redshift.statements'));
const schemas = computed<string[]>(() => ((ctx.view.value.redshift || {}).schemas || ['public']));
const tables = computed(() => rows(ctx.view.value, 'redshift.tables'));
const roles = computed(() => rows(ctx.view.value, 'iam.roles'));
const wg = ref(workgroups.value[0]?.name || '');
const sql = ref('SELECT event_type, count(*) AS events, count(DISTINCT session_id) AS sessions\nFROM analytics.web_events\nGROUP BY event_type\nORDER BY events DESC;');
const lastId = ref('');
const last = computed(() => statements.value.find(s => s.id === lastId.value) || null);
const busy = ref(false);
const selNs = ref<string[]>([]);
const selWg = ref<string[]>([]);
const wgDeleting = ref(false);
const nsDeleting = ref(false);
const create = reactive({ open: false, wg: 'shopflow-wh', base: 8, ns: 'shopflow', db: 'dev', admin: 'admin', role: '' });

const nsColumns: Column[] = [
  { id: 'name', header: 'Namespace' }, { id: 'status', header: 'Status' }, { id: 'db', header: 'Database' },
  { id: 'roles', header: 'IAM roles', cell: r => (r.roles || []).map((x: string) => x.split('/').pop()).join(', ') || '-' },
];
const wgColumns: Column[] = [
  { id: 'name', header: 'Workgroup' }, { id: 'namespace', header: 'Namespace' }, { id: 'status', header: 'Status' },
  { id: 'base', header: 'Base capacity', cell: r => `${r.base} RPUs` }, { id: 'endpoint', header: 'Endpoint' },
  { id: 'rpu', header: 'RPU-seconds used', cell: r => r.rpu_seconds },
];

function tablesIn(schema: string) {
  return tables.value.filter(t => String(t.name).startsWith(`${schema}.`));
}

async function run() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'redshift-data', 'execute-statement'], {
    '--workgroup-name': wg.value, '--database': 'dev', '--sql': sql.value.trim() }), '', { quiet: true });
  const data = (result.data || {}) as { statement?: { id: string } };
  if (data.statement) lastId.value = data.statement.id;
  busy.value = false;
}
async function createWorkgroup() {
  busy.value = true;
  if (!namespaces.value.some(n => n.name === create.ns)) {
    const ns = await ctx.run(cli(['aws', 'redshift-serverless', 'create-namespace'], {
      '--namespace-name': create.ns, '--admin-username': create.admin, '--manage-admin-password': true,
      '--db-name': create.db, '--iam-roles': create.role ? [create.role] : [], '--default-iam-role-arn': create.role }),
    `Namespace ${create.ns} created.`);
    if (!ns.ok) { busy.value = false; return; }
  }
  const result = await ctx.run(cli(['aws', 'redshift-serverless', 'create-workgroup'], {
    '--workgroup-name': create.wg, '--namespace-name': create.ns, '--base-capacity': create.base }),
  `Workgroup ${create.wg} created.`);
  busy.value = false;
  if (result.ok) { create.open = false; wg.value = create.wg; }
}
async function deleteWg() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'redshift-serverless', 'delete-workgroup'], { '--workgroup-name': selWg.value[0] }), 'Workgroup deleted.');
  busy.value = false;
  if (result.ok) { wgDeleting.value = false; selWg.value = []; }
}
async function deleteNs() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'redshift-serverless', 'delete-namespace'], { '--namespace-name': selNs.value[0] }), 'Namespace deleted.');
  busy.value = false;
  if (result.ok) { nsDeleting.value = false; selNs.value = []; }
}
</script>

<style scoped>
.qe { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 16px; }
.qe__tree { border: 1px solid #c6c6cd; border-radius: 12px; padding: 12px; align-self: start; display: flex; flex-direction: column; gap: 6px; }
.qe__h { font-size: 14px; }
.qe__node { border: 0; background: none; padding: 4px 6px; font: inherit; cursor: pointer; border-radius: 6px; width: 100%; text-align: left; }
.qe__node.is-on { background: #f0fbff; color: #006ce0; font-weight: 700; }
.qe__inner { margin-left: 12px; font-size: 13px; }
.qe__inner ul { margin: 2px 0 6px 12px; padding: 0; list-style: none; }
.qe__bar { margin-bottom: 8px; }
.qe__sql { min-height: 160px; background: #fbfbfc; margin-bottom: 16px; }
.qe__stats { margin-bottom: 10px; gap: 16px; }
@container sl-portal (max-width: 900px) { .qe { grid-template-columns: minmax(0, 1fr); } }
</style>
