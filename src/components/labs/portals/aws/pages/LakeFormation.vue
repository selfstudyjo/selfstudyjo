<template>
  <!-- Administrative roles -->
  <div v-if="page === 'admins'">
    <CsHeader title="Administrative roles and tasks" description="Data lake administrators can grant any principal any permission on Data Catalog resources and data locations." />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Data lake administrators" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <table v-if="admins.length" class="cs-table-mini"><thead><tr><th>Principal</th></tr></thead>
          <tbody><tr v-for="a in admins" :key="a"><td class="cs-mono">{{ a }}</td></tr></tbody></table>
        <div v-else class="cs-empty"><strong>No administrators</strong>Add one before granting permissions.</div>
        <div class="cs-field"><label class="cs-label" for="lf-admin">Add administrator</label>
          <select id="lf-admin" v-model="newAdmin" class="cs-select">
            <option :value="`arn:aws:iam::${ctx.account.value}:user/lab`">lab (IAM user)</option>
            <option v-for="r in roles" :key="r.arn" :value="r.arn">{{ r.name }} (IAM role)</option></select></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Default permissions for newly created databases and tables" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <label class="cs-check"><input v-model="iamDefault" type="checkbox" /> Use only IAM access control for new databases and tables
          <small>Grants ALL to IAMAllowedPrincipals on new tables, which means Lake Formation permissions are not enforced on them.</small></label>
      </div>
    </section>
    <div class="cs-form-actions"><button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="saveSettings">Save</button></div>
  </div>

  <!-- Locations -->
  <div v-else-if="page === 'locations'">
    <CsTable v-model:selected="selLoc" title="Data lake locations" variant="full-page" :items="locations" :columns="locColumns" track-by="arn"
             selection-type="single" empty-title="No locations registered"
             empty-text="Register an Amazon S3 path so Lake Formation can govern the data in it."
             description="Lake Formation enforces its permissions only on tables whose data is in a registered location.">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!selLoc.length" @click="deregister">Remove</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="locOpen = true">Register location</button>
      </template>
    </CsTable>
    <CsModal v-if="locOpen" title="Register location" @close="locOpen = false">
      <div class="cs-stack">
        <div class="cs-field"><label class="cs-label" for="lf-path">Amazon S3 path</label>
          <input id="lf-path" v-model.trim="locPath" class="cs-input cs-mono" placeholder="s3://shopflow-lake/silver" /></div>
        <label class="cs-radio"><input type="radio" checked /> AWSServiceRoleForLakeFormationDataAccess <small>The service-linked role.</small></label>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="locOpen = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!locPath.startsWith('s3://') || busy" @click="register">Register location</button>
      </template>
    </CsModal>
  </div>

  <!-- LF-Tags -->
  <div v-else-if="page === 'tags'">
    <CsTable title="LF-Tags" variant="full-page" :items="lfTags" :columns="tagColumns" track-by="key" empty-title="No LF-Tags">
      <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="tagOpen = true">Add LF-Tag</button></template>
    </CsTable>
    <CsModal v-if="tagOpen" title="Add LF-Tag" @close="tagOpen = false">
      <div class="cs-stack">
        <div class="cs-field"><label class="cs-label" for="lf-tk">Key</label><input id="lf-tk" v-model.trim="tagKey" class="cs-input" placeholder="classification" /></div>
        <div class="cs-field"><label class="cs-label" for="lf-tv">Values</label><input id="lf-tv" v-model="tagValues" class="cs-input" placeholder="public, internal, pii" />
          <span class="cs-constraint">Comma separated.</span></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="tagOpen = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!tagKey || !tagValues.trim() || busy" @click="createTag">Add LF-Tag</button>
      </template>
    </CsModal>
  </div>

  <!-- Data lake permissions -->
  <div v-else>
    <div v-if="tables.some(t => t.lf_registered && t.iam_allowed)" class="cs-alert cs-alert--warning">
      <CsIcon name="status-warning" class="cs-alert__icon" />
      <div><strong>IAMAllowedPrincipals still has access</strong>Some tables in registered locations grant ALL to IAMAllowedPrincipals, so Lake Formation permissions are not enforced on them.</div>
    </div>
    <CsTable v-model:selected="selPerm" title="Data permissions" variant="full-page" :items="perms" :columns="permColumns" track-by="key"
             selection-type="single" empty-title="No permissions" filter-placeholder="Find by principal or resource">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!currentPerm || busy" @click="revoke">Revoke</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="openGrant">Grant</button>
      </template>
    </CsTable>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="IAMAllowedPrincipals" :level="2" :info="false"
        description="Revoke the default grant to make Lake Formation the authority over a table." /></div>
      <div class="cs-container__body">
        <table class="cs-table-mini"><thead><tr><th>Table</th><th>Location registered</th><th>IAMAllowedPrincipals</th><th /></tr></thead>
          <tbody><tr v-for="t in tables" :key="t.database + t.name"><td>{{ t.database }}.{{ t.name }}</td>
            <td>{{ t.lf_registered ? 'Yes' : 'No' }}</td><td>{{ t.iam_allowed ? 'ALL' : 'Revoked' }}</td>
            <td><button v-if="t.iam_allowed" type="button" class="cs-btn cs-btn--inline" :disabled="busy" @click="revokeIam(t)">Revoke</button></td></tr></tbody></table>
      </div>
    </section>
    <CsModal v-if="grant.open" title="Grant data permissions" size="large" @close="grant.open = false">
      <div class="cs-stack">
        <div class="cs-field"><label class="cs-label" for="lg-p">IAM users and roles</label>
          <select id="lg-p" v-model="grant.principal" class="cs-select"><option value="">Choose IAM principals</option>
            <option v-for="r in roles" :key="r.arn" :value="r.arn">{{ r.name }}</option></select></div>
        <div class="cs-field"><label class="cs-label" for="lg-db">Databases</label>
          <select id="lg-db" v-model="grant.db" class="cs-select"><option v-for="d in databases" :key="d.name" :value="d.name">{{ d.name }}</option></select></div>
        <div class="cs-field"><label class="cs-label" for="lg-t">Tables</label>
          <select id="lg-t" v-model="grant.table" class="cs-select"><option value="*">All tables</option>
            <option v-for="t in grantTables" :key="t.name" :value="t.name">{{ t.name }}</option></select></div>
        <div v-if="grant.table !== '*'" class="cs-field"><span class="cs-label">Data permissions</span>
          <label class="cs-radio"><input v-model="grant.columns" type="radio" value="all" /> All data access</label>
          <label class="cs-radio"><input v-model="grant.columns" type="radio" value="exclude" /> Column-based access: exclude columns</label>
          <label class="cs-radio"><input v-model="grant.columns" type="radio" value="include" /> Column-based access: include columns</label>
          <div v-if="grant.columns !== 'all'" class="lf__cols">
            <label v-for="c in grantColumns" :key="c" class="cs-check"><input v-model="grant.picked" type="checkbox" :value="c" /> {{ c }}</label></div></div>
        <div class="cs-field"><span class="cs-label">Table permissions</span>
          <div class="cs-row"><label v-for="p in ['SELECT', 'DESCRIBE', 'INSERT', 'DELETE', 'ALTER', 'DROP']" :key="p" class="cs-check">
            <input v-model="grant.perms" type="checkbox" :value="p" /> {{ p[0] + p.slice(1).toLowerCase() }}</label></div></div>
      </div>
      <template #footer>
        <button type="button" class="cs-btn cs-btn--link" @click="grant.open = false">Cancel</button>
        <button type="button" class="cs-btn cs-btn--primary" :disabled="!grant.principal || !grant.db || !grant.perms.length || busy" @click="doGrant">Grant</button>
      </template>
    </CsModal>
  </div>
</template>

<script setup lang="ts">
/** AWS Lake Formation: administrators and defaults, registered locations, data permissions (column level), LF-Tags. */
import { computed, reactive, ref, watch } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsModal from '../CsModal.vue';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';

const ctx = useAws();
const page = computed(() => ctx.route.value.page);
const lf = computed(() => (ctx.view.value.lakeformation || {}) as Record<string, any>);
const admins = computed<string[]>(() => lf.value.admins || []);
const locations = computed(() => rows(ctx.view.value, 'lakeformation.locations'));
const perms = computed(() => rows(ctx.view.value, 'lakeformation.permissions').map(p => ({ ...p, key: `${p.principal}|${p.resource}` })));
const lfTags = computed(() => rows(ctx.view.value, 'lakeformation.lf_tags'));
const roles = computed(() => rows(ctx.view.value, 'iam.roles'));
const databases = computed(() => rows(ctx.view.value, 'glue.databases'));
const tables = computed(() => rows(ctx.view.value, 'glue.tables'));
const busy = ref(false);
const newAdmin = ref('');
const iamDefault = ref(true);
watch(lf, value => { iamDefault.value = value.default_iam !== false; newAdmin.value = (value.admins || [])[0] || `arn:aws:iam::${ctx.account.value}:user/lab`; }, { immediate: true });
const selLoc = ref<string[]>([]);
const locOpen = ref(false);
const locPath = ref('s3://shopflow-lake/silver');
const tagOpen = ref(false);
const tagKey = ref('');
const tagValues = ref('');
const selPerm = ref<string[]>([]);
const currentPerm = computed(() => perms.value.find(p => p.key === selPerm.value[0]) || null);
const grant = reactive({ open: false, principal: '', db: '', table: '*', columns: 'all', picked: [] as string[], perms: ['SELECT'] as string[] });
const grantTables = computed(() => tables.value.filter(t => t.database === grant.db));
const grantColumns = computed(() => {
  const t = grantTables.value.find(x => x.name === grant.table);
  return t ? [...t.column_names, ...t.partition_keys] : [];
});

const locColumns: Column[] = [{ id: 'arn', header: 'Amazon S3 path', cell: r => String(r.arn).replace('arn:aws:s3:::', 's3://') }, { id: 'role', header: 'IAM role' }];
const tagColumns: Column[] = [{ id: 'key', header: 'Key' }, { id: 'values', header: 'Values', cell: r => (r.values || []).join(', ') }];
const permColumns: Column[] = [
  { id: 'principal', header: 'Principal', cell: r => String(r.principal).split('/').pop() },
  { id: 'kind', header: 'Resource type' },
  { id: 'resource', header: 'Resource' },
  { id: 'permissions', header: 'Permissions', cell: r => (r.permissions || []).join(', ') },
  { id: 'grantable', header: 'Grantable', cell: r => (r.grantable || []).join(', ') || '-' },
];

function principal(arn: string) {
  return `DataLakePrincipalIdentifier=${arn}`;
}

async function saveSettings() {
  busy.value = true;
  const defaults = iamDefault.value ? [{ Principal: { DataLakePrincipalIdentifier: 'IAM_ALLOWED_PRINCIPALS' }, Permissions: ['ALL'] }] : [];
  const settings = { DataLakeAdmins: [{ DataLakePrincipalIdentifier: newAdmin.value }],
    CreateDatabaseDefaultPermissions: defaults, CreateTableDefaultPermissions: defaults };
  await ctx.run(cli(['aws', 'lakeformation', 'put-data-lake-settings'], { '--data-lake-settings': JSON.stringify(settings) }),
    'Data lake settings saved.');
  busy.value = false;
}
async function register() {
  busy.value = true;
  const arn = 'arn:aws:s3:::' + locPath.value.replace(/^s3:\/\//, '').replace(/\/$/, '');
  const result = await ctx.run(cli(['aws', 'lakeformation', 'register-resource'], { '--resource-arn': arn, '--use-service-linked-role': true }),
    `Location ${locPath.value} registered.`);
  busy.value = false;
  if (result.ok) locOpen.value = false;
}
async function deregister() {
  await ctx.run(cli(['aws', 'lakeformation', 'deregister-resource'], { '--resource-arn': selLoc.value[0] }), 'Location removed.');
  selLoc.value = [];
}
async function createTag() {
  busy.value = true;
  const values = tagValues.value.split(',').map(v => v.trim()).filter(Boolean);
  const result = await ctx.run(cli(['aws', 'lakeformation', 'create-lf-tag'], { '--tag-key': tagKey.value, '--tag-values': values }),
    `LF-Tag ${tagKey.value} added.`);
  busy.value = false;
  if (result.ok) tagOpen.value = false;
}
function openGrant() {
  Object.assign(grant, { open: true, principal: '', db: databases.value[0]?.name || '', table: '*', columns: 'all', picked: [], perms: ['SELECT'] });
}
function resourceFor(): string {
  if (grant.table === '*') return JSON.stringify({ Table: { DatabaseName: grant.db, TableWildcard: {} } });
  if (grant.columns === 'exclude') {
    return JSON.stringify({ TableWithColumns: { DatabaseName: grant.db, Name: grant.table, ColumnWildcard: { ExcludedColumnNames: grant.picked } } });
  }
  if (grant.columns === 'include') {
    return JSON.stringify({ TableWithColumns: { DatabaseName: grant.db, Name: grant.table, ColumnNames: grant.picked } });
  }
  return JSON.stringify({ Table: { DatabaseName: grant.db, Name: grant.table } });
}
async function doGrant() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'lakeformation', 'grant-permissions'], {
    '--principal': principal(grant.principal), '--permissions': grant.perms, '--resource': resourceFor() }),
  'Permissions granted.');
  busy.value = false;
  if (result.ok) grant.open = false;
}
function permResource(p: Record<string, any>): string {
  if (p.kind === 'TableWithColumns') {
    const t: Record<string, unknown> = { DatabaseName: p.database, Name: p.table };
    if ((p.columns || []).length) t.ColumnNames = p.columns;
    else t.ColumnWildcard = { ExcludedColumnNames: p.excluded || [] };
    return JSON.stringify({ TableWithColumns: t });
  }
  if (p.kind === 'Database') return JSON.stringify({ Database: { Name: p.database } });
  return JSON.stringify({ Table: p.table === '*' ? { DatabaseName: p.database, TableWildcard: {} } : { DatabaseName: p.database, Name: p.table } });
}
async function revoke() {
  const p = currentPerm.value!;
  busy.value = true;
  await ctx.run(cli(['aws', 'lakeformation', 'revoke-permissions'], {
    '--principal': principal(p.principal), '--permissions': p.permissions, '--resource': permResource(p) }), 'Permissions revoked.');
  busy.value = false;
  selPerm.value = [];
}
async function revokeIam(t: Record<string, any>) {
  busy.value = true;
  await ctx.run(cli(['aws', 'lakeformation', 'revoke-permissions'], {
    '--principal': principal('IAM_ALLOWED_PRINCIPALS'), '--permissions': ['ALL'],
    '--resource': JSON.stringify({ Table: { DatabaseName: t.database, Name: t.name } }) }),
  `IAMAllowedPrincipals revoked on ${t.name}.`);
  busy.value = false;
}
</script>

<style scoped>
.lf__cols { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 4px 12px; margin-top: 6px; }
</style>
