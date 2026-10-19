<template>
  <SfModal :title="spec.title" :subtitle="spec.subtitle" :ok-text="spec.ok || 'Create'" :ok-disabled="!!spec.invalid"
           :busy="busy" :sql="spec.statements.join(';\n') + (spec.statements.length ? ';' : '')" :error="error"
           :width="kind === 'table' || kind === 'warehouse' || kind === 'monitor' ? 680 : 560"
           @close="$emit('close')" @ok="submit">
    <!-- Location: database (and schema) for schema-level objects -->
    <div v-if="needsDb" class="sf-row">
      <label class="sf-field">
        <span class="sf-label">Database</span>
        <select v-model="f.database" class="sf-select">
          <option v-for="d in databases" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <label v-if="needsSchema" class="sf-field">
        <span class="sf-label">Schema</span>
        <select v-model="f.schema" class="sf-select">
          <option v-for="s in schemas" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
    </div>

    <label class="sf-field">
      <span class="sf-label">{{ kind === 'user' ? 'User name' : 'Name' }}</span>
      <input v-model="f.name" class="sf-input" :class="{ 'sf-input--error': nameError }" :placeholder="placeholder" autocomplete="off" />
      <span v-if="nameError" class="sf-error-text">{{ nameError }}</span>
      <span v-else-if="f.name && !isPlainIdent(f.name)" class="sf-hint">This name will be created as a quoted, case-sensitive identifier.</span>
    </label>

    <!-- DATABASE -->
    <template v-if="kind === 'database'">
      <label class="sf-check"><input v-model="f.transient" type="checkbox" /> Transient database (no Fail-safe, Time Travel up to 1 day)</label>
      <label class="sf-field"><span class="sf-label">Data retention time (days)</span><input v-model="f.retention" class="sf-input" inputmode="numeric" placeholder="1" /></label>
    </template>

    <!-- SCHEMA -->
    <template v-if="kind === 'schema'">
      <label class="sf-check"><input v-model="f.managed" type="checkbox" /> Managed access (only the schema owner can grant privileges)</label>
      <label class="sf-check"><input v-model="f.transient" type="checkbox" /> Transient schema</label>
    </template>

    <!-- TABLE -->
    <template v-if="kind === 'table'">
      <div class="sf-row">
        <label class="sf-field"><span class="sf-label">Table type</span>
          <select v-model="f.tableType" class="sf-select"><option value="">Permanent</option><option value="TRANSIENT">Transient</option></select>
        </label>
        <label class="sf-field"><span class="sf-label">Data retention (days)</span><input v-model="f.retention" class="sf-input" inputmode="numeric" placeholder="Default" /></label>
      </div>
      <div class="sf-field">
        <span class="sf-label">Columns</span>
        <div class="cols">
          <div class="cols__head"><span>Name</span><span>Type</span><span>Not null</span><span></span></div>
          <div v-for="(c, i) in columns" :key="i" class="cols__row">
            <input v-model="c.name" class="sf-input" placeholder="COLUMN_NAME" :aria-label="'Column ' + (i + 1) + ' name'" />
            <select v-model="c.type" class="sf-select" :aria-label="'Column ' + (i + 1) + ' type'">
              <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
            <label class="cols__nn"><input v-model="c.notNull" type="checkbox" :aria-label="'Column ' + (i + 1) + ' not null'" /></label>
            <button type="button" class="sf-btn sf-btn--ghost sf-btn--icon sf-btn--sm" aria-label="Remove column" :disabled="columns.length === 1" @click="columns.splice(i, 1)"><SfIcon name="trash" /></button>
          </div>
          <button type="button" class="sf-btn sf-btn--sm cols__add" @click="columns.push({ name: '', type: 'VARCHAR', notNull: false })"><SfIcon name="plus" /> Add column</button>
        </div>
      </div>
      <div class="sf-row">
        <label class="sf-field"><span class="sf-label">Cluster by (optional)</span><input v-model="f.cluster" class="sf-input" placeholder="e.g. order_date" /></label>
        <label class="sf-field sf-field--check"><span class="sf-label">Change tracking</span>
          <label class="sf-check"><input v-model="f.changeTracking" type="checkbox" /> Enable</label>
        </label>
      </div>
    </template>

    <!-- VIEW -->
    <template v-if="kind === 'view'">
      <label class="sf-check"><input v-model="f.secure" type="checkbox" /> Secure view</label>
      <label class="sf-field"><span class="sf-label">Query</span>
        <textarea v-model="f.query" class="sf-textarea sf-mono" rows="6" placeholder="SELECT ... FROM ..."></textarea></label>
    </template>

    <!-- STAGE -->
    <template v-if="kind === 'stage'">
      <label class="sf-field"><span class="sf-label">Stage type</span>
        <select v-model="f.stageType" class="sf-select"><option value="external">External stage - Amazon S3</option><option value="internal">Snowflake managed (internal)</option></select>
      </label>
      <label v-if="f.stageType === 'external'" class="sf-field"><span class="sf-label">URL</span>
        <input v-model="f.url" class="sf-input sf-mono" placeholder="s3://shopflow-lake/landing/" /></label>
      <label v-if="f.stageType === 'external'" class="sf-field"><span class="sf-label">Storage integration (optional)</span>
        <input v-model="f.integration" class="sf-input" placeholder="SHOPFLOW_S3_INT" /></label>
      <label class="sf-field"><span class="sf-label">File format (optional)</span>
        <select v-model="f.format" class="sf-select"><option value="">None</option><option v-for="ff in formats" :key="ff" :value="ff">{{ ff }}</option></select></label>
    </template>

    <!-- FILE FORMAT -->
    <template v-if="kind === 'file-format'">
      <label class="sf-field"><span class="sf-label">File type</span>
        <select v-model="f.ffType" class="sf-select"><option>CSV</option><option>JSON</option><option>PARQUET</option><option>AVRO</option></select></label>
      <template v-if="f.ffType === 'CSV'">
        <div class="sf-row">
          <label class="sf-field"><span class="sf-label">Field delimiter</span><input v-model="f.delimiter" class="sf-input sf-mono" /></label>
          <label class="sf-field"><span class="sf-label">Header lines to skip</span><input v-model="f.skipHeader" class="sf-input" inputmode="numeric" /></label>
          <label class="sf-field"><span class="sf-label">Field optionally enclosed by</span>
            <select v-model="f.enclosed" class="sf-select"><option value="">None</option><option value='"'>Double quote</option><option value="'">Single quote</option></select></label>
        </div>
        <label class="sf-check"><input v-model="f.errorOnColumnMismatch" type="checkbox" /> Error on column count mismatch</label>
      </template>
      <label v-if="f.ffType === 'JSON'" class="sf-check"><input v-model="f.stripOuter" type="checkbox" /> Strip outer array</label>
      <label v-if="f.ffType !== 'CSV'" class="sf-field"><span class="sf-label">Compression</span>
        <select v-model="f.compression" class="sf-select"><option value="">AUTO</option><option>NONE</option><option>GZIP</option><option>SNAPPY</option><option>ZSTD</option></select></label>
    </template>

    <!-- WAREHOUSE -->
    <template v-if="kind === 'warehouse'">
      <div class="sf-row">
        <label class="sf-field"><span class="sf-label">Type</span>
          <select v-model="f.whType" class="sf-select"><option value="STANDARD">Standard</option><option value="SNOWPARK-OPTIMIZED">Snowpark-optimized</option></select></label>
        <label class="sf-field"><span class="sf-label">Size</span>
          <select v-model="f.size" class="sf-select">
            <option v-for="[id, label, credits] in SIZES" :key="id" :value="id">{{ label }} ({{ credits }} credit{{ credits === 1 ? '' : 's' }}/hour)</option>
          </select></label>
      </div>
      <details class="adv" open>
        <summary>Advanced options</summary>
        <div class="adv__body">
          <div class="sf-row">
            <label class="sf-field"><span class="sf-label">Auto suspend</span>
              <select v-model="f.suspend" class="sf-select">
                <option value="60">1 minute</option><option value="120">2 minutes</option><option value="300">5 minutes</option>
                <option value="600">10 minutes</option><option value="900">15 minutes</option><option value="1800">30 minutes</option>
                <option value="3600">1 hour</option><option value="0">Never</option>
              </select></label>
            <label class="sf-field sf-field--check"><span class="sf-label">Auto resume</span>
              <label class="sf-check"><input v-model="f.autoResume" type="checkbox" /> Resume when a query is submitted</label></label>
          </div>
          <label class="sf-check"><input v-model="f.multiCluster" type="checkbox" /> Multi-cluster warehouse</label>
          <div v-if="f.multiCluster" class="sf-row">
            <label class="sf-field"><span class="sf-label">Min clusters</span><input v-model="f.minClusters" class="sf-input" inputmode="numeric" /></label>
            <label class="sf-field"><span class="sf-label">Max clusters</span><input v-model="f.maxClusters" class="sf-input" inputmode="numeric" /></label>
            <label class="sf-field"><span class="sf-label">Scaling policy</span>
              <select v-model="f.policy" class="sf-select"><option>STANDARD</option><option>ECONOMY</option></select></label>
          </div>
          <label class="sf-check"><input v-model="f.initiallySuspended" type="checkbox" /> Initially suspended</label>
        </div>
      </details>
    </template>

    <!-- ROLE -->
    <template v-if="kind === 'role'">
      <label class="sf-field"><span class="sf-label">Grant to role (parent in the hierarchy)</span>
        <select v-model="f.parent" class="sf-select"><option value="">— None —</option><option v-for="r in roleNames" :key="r" :value="r">{{ r }}</option></select>
        <span class="sf-hint">Snowflake recommends granting custom roles to SYSADMIN so its users can manage the objects they own.</span></label>
    </template>

    <!-- USER -->
    <template v-if="kind === 'user'">
      <div class="sf-row">
        <label class="sf-field"><span class="sf-label">Login name</span><input v-model="f.login" class="sf-input" /></label>
        <label class="sf-field"><span class="sf-label">Email</span><input v-model="f.email" class="sf-input" /></label>
      </div>
      <label class="sf-field"><span class="sf-label">Password</span><input v-model="f.password" type="password" class="sf-input" autocomplete="new-password" /></label>
      <div class="sf-row">
        <label class="sf-field"><span class="sf-label">Default role</span>
          <select v-model="f.defaultRole" class="sf-select"><option value="">PUBLIC</option><option v-for="r in roleNames" :key="r" :value="r">{{ r }}</option></select></label>
        <label class="sf-field"><span class="sf-label">Default warehouse</span>
          <select v-model="f.defaultWarehouse" class="sf-select"><option value="">— None —</option><option v-for="w in warehouseNames" :key="w" :value="w">{{ w }}</option></select></label>
      </div>
    </template>

    <!-- RESOURCE MONITOR -->
    <template v-if="kind === 'monitor'">
      <div class="sf-row">
        <label class="sf-field"><span class="sf-label">Credit quota</span><input v-model="f.quota" class="sf-input" inputmode="decimal" /></label>
        <label class="sf-field"><span class="sf-label">Monitor type</span>
          <select v-model="f.monitorLevel" class="sf-select"><option value="WAREHOUSE">Warehouse</option><option value="ACCOUNT">Account</option></select></label>
        <label class="sf-field"><span class="sf-label">Schedule</span>
          <select v-model="f.frequency" class="sf-select"><option>MONTHLY</option><option>DAILY</option><option>WEEKLY</option><option>YEARLY</option><option>NEVER</option></select></label>
      </div>
      <div v-if="f.monitorLevel === 'WAREHOUSE'" class="sf-field">
        <span class="sf-label">Warehouses</span>
        <div class="whpick">
          <label v-for="w in warehouseNames" :key="w" class="sf-check"><input v-model="monitorWarehouses" type="checkbox" :value="w" /> {{ w }}</label>
        </div>
      </div>
      <div class="sf-field">
        <span class="sf-label">Actions</span>
        <div class="triggers">
          <label class="sf-check"><input v-model="f.notifyOn" type="checkbox" /> Notify at</label><input v-model="f.notifyPct" class="sf-input trig" inputmode="numeric" /><span>% of quota</span>
          <label class="sf-check"><input v-model="f.suspendOn" type="checkbox" /> Suspend at</label><input v-model="f.suspendPct" class="sf-input trig" inputmode="numeric" /><span>% (running queries finish)</span>
          <label class="sf-check"><input v-model="f.suspendNowOn" type="checkbox" /> Suspend immediately at</label><input v-model="f.suspendNowPct" class="sf-input trig" inputmode="numeric" /><span>% (cancels running queries)</span>
        </div>
      </div>
    </template>

    <!-- MASKING POLICY -->
    <template v-if="kind === 'masking-policy'">
      <label class="sf-field"><span class="sf-label">Data type</span>
        <select v-model="f.dataType" class="sf-select"><option>STRING</option><option>NUMBER</option><option>DATE</option><option>TIMESTAMP_NTZ</option><option>VARIANT</option></select></label>
      <div class="sf-field">
        <span class="sf-label">Roles that see the unmasked value</span>
        <div class="whpick"><label v-for="r in roleNames" :key="r" class="sf-check"><input v-model="policyRoles" type="checkbox" :value="r" /> {{ r }}</label></div>
      </div>
      <label class="sf-field"><span class="sf-label">Masked value (SQL expression)</span>
        <input v-model="f.maskExpr" class="sf-input sf-mono" /><span class="sf-hint">What every other role sees, e.g. '***MASKED***', NULL, or SHA2(val).</span></label>
    </template>

    <!-- ROW ACCESS POLICY -->
    <template v-if="kind === 'row-access-policy'">
      <div class="sf-row">
        <label class="sf-field"><span class="sf-label">Argument</span><input v-model="f.argName" class="sf-input" /></label>
        <label class="sf-field"><span class="sf-label">Argument type</span>
          <select v-model="f.dataType" class="sf-select"><option>STRING</option><option>NUMBER</option><option>DATE</option></select></label>
      </div>
      <div class="sf-field">
        <span class="sf-label">Roles that see every row</span>
        <div class="whpick"><label v-for="r in roleNames" :key="r" class="sf-check"><input v-model="policyRoles" type="checkbox" :value="r" /> {{ r }}</label></div>
      </div>
      <label class="sf-field"><span class="sf-label">Otherwise, rows where (SQL condition)</span>
        <input v-model="f.rowCond" class="sf-input sf-mono" placeholder="FALSE" /><span class="sf-hint">e.g. {{ f.argName || 'region' }} = 'EU'</span></label>
    </template>

    <!-- STREAM -->
    <template v-if="kind === 'stream'">
      <label class="sf-field"><span class="sf-label">On table</span>
        <select v-model="f.onTable" class="sf-select"><option v-for="t in tableFqns" :key="t" :value="t">{{ t }}</option></select></label>
      <label class="sf-check"><input v-model="f.appendOnly" type="checkbox" /> Append-only (track inserts only)</label>
    </template>

    <!-- TASK -->
    <template v-if="kind === 'task'">
      <div class="sf-row">
        <label class="sf-field"><span class="sf-label">Warehouse</span>
          <select v-model="f.taskWarehouse" class="sf-select"><option v-for="w in warehouseNames" :key="w" :value="w">{{ w }}</option></select></label>
        <label class="sf-field"><span class="sf-label">Schedule</span><input v-model="f.schedule" class="sf-input" placeholder="5 MINUTE" /></label>
      </div>
      <label class="sf-field"><span class="sf-label">SQL to run</span>
        <textarea v-model="f.body" class="sf-textarea sf-mono" rows="5" placeholder="INSERT INTO ... SELECT ..."></textarea></label>
      <span class="sf-hint">A new task is created suspended. Resume it from Task History to start the schedule.</span>
    </template>

    <!-- PIPE -->
    <template v-if="kind === 'pipe'">
      <label class="sf-check"><input v-model="f.autoIngest" type="checkbox" /> Auto-ingest (load new files as they arrive)</label>
      <label class="sf-field"><span class="sf-label">COPY statement</span>
        <textarea v-model="f.body" class="sf-textarea sf-mono" rows="5" placeholder="COPY INTO RAW.SHOP.ORDERS FROM @RAW.SHOP.LAKE_STAGE"></textarea></label>
    </template>

    <label v-if="hasComment" class="sf-field">
      <span class="sf-label">Comment (optional)</span>
      <textarea v-model="f.comment" class="sf-textarea" rows="2"></textarea>
    </label>
  </SfModal>
</template>

<script setup lang="ts">
/**
 * Every "Create" dialog Snowsight has, as forms over the statements they
 * stand for. The SQL preview shows exactly what will run; Create runs it on
 * the Worksheet surface and the new object is in the view when it closes.
 */
import { computed, reactive, ref, watch } from 'vue';
import SfModal from './SfModal.vue';
import SfIcon from './SfIcon.vue';
import { useSf, type CreateKind } from './sfContext';
import { fqnSql, ident, isPlainIdent, list, SIZES, str } from './snowflake';

const props = defineProps<{ kind: CreateKind; defaults?: Record<string, string> }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const sf = useSf();

const TYPES = ['VARCHAR', 'NUMBER', 'NUMBER(38,2)', 'INTEGER', 'FLOAT', 'BOOLEAN', 'DATE', 'TIMESTAMP_NTZ', 'TIMESTAMP_TZ', 'VARIANT', 'ARRAY', 'OBJECT'];
const d = props.defaults || {};
const cur = sf.current.value;
const f = reactive({
  database: d.database || cur.database || '', schema: d.schema || cur.schema || 'PUBLIC', name: d.name || '',
  comment: '', transient: false, retention: '', managed: false,
  tableType: '', cluster: '', changeTracking: false, secure: false, query: d.query || '',
  stageType: 'external', url: d.url || 's3://shopflow-lake/landing/', integration: '', format: '',
  ffType: 'CSV', delimiter: ',', skipHeader: '1', enclosed: '"', errorOnColumnMismatch: true, stripOuter: true, compression: '',
  whType: 'STANDARD', size: 'XSMALL', suspend: '600', autoResume: true, multiCluster: false, minClusters: '1', maxClusters: '2', policy: 'STANDARD', initiallySuspended: true,
  parent: 'SYSADMIN', login: '', email: '', password: '', defaultRole: '', defaultWarehouse: '',
  quota: '100', monitorLevel: 'WAREHOUSE', frequency: 'MONTHLY', notifyOn: true, notifyPct: '75', suspendOn: true, suspendPct: '100', suspendNowOn: false, suspendNowPct: '110',
  dataType: 'STRING', maskExpr: "'***MASKED***'", argName: 'region', rowCond: 'FALSE',
  onTable: d.table || '', appendOnly: false, taskWarehouse: cur.warehouse || 'COMPUTE_WH', schedule: '5 MINUTE', body: '', autoIngest: true,
});
const columns = reactive([{ name: 'ID', type: 'NUMBER', notNull: true }, { name: '', type: 'VARCHAR', notNull: false }]);
const monitorWarehouses = ref<string[]>(d.warehouse ? [d.warehouse] : []);
const policyRoles = ref<string[]>([]);
const busy = ref(false);
const error = ref('');

const view = sf.view;
const databases = computed(() => list.databases(view.value).filter(x => !x.dropped).map(x => x.name));
const schemas = computed(() => list.schemas(view.value).filter(s => s.database.toUpperCase() === f.database.toUpperCase() && !s.dropped).map(s => s.name));
const formats = computed(() => list.fileFormats(view.value).map(ff => ff.fqn || ff.name));
const roleNames = computed(() => list.roles(view.value).map(r => r.name));
const warehouseNames = computed(() => list.warehouses(view.value).map(w => w.name));
const tableFqns = computed(() => list.tables(view.value).filter(t => !t.dropped && String(t.kind || 'TABLE').toUpperCase() !== 'VIEW').map(t => t.fqn));
watch(() => f.database, () => { if (schemas.value.length && !schemas.value.includes(f.schema)) f.schema = schemas.value.includes('PUBLIC') ? 'PUBLIC' : schemas.value[0]; });
if (!f.onTable && tableFqns.value.length) f.onTable = tableFqns.value[0];

const needsDb = computed(() => !['database', 'warehouse', 'role', 'user', 'monitor'].includes(props.kind));
const needsSchema = computed(() => needsDb.value && props.kind !== 'schema');
const hasComment = computed(() => !['monitor', 'stream', 'pipe', 'task', 'row-access-policy'].includes(props.kind));
const placeholder = computed(() => ({
  database: 'MY_DATABASE', schema: 'MY_SCHEMA', table: 'MY_TABLE', view: 'MY_VIEW', stage: 'MY_STAGE', 'file-format': 'MY_CSV_FORMAT',
  warehouse: 'MY_WH', role: 'MY_ROLE', user: 'NEW_USER', monitor: 'MONTHLY_LIMIT', 'masking-policy': 'EMAIL_MASK',
  'row-access-policy': 'REGION_POLICY', stream: 'ORDERS_STREAM', task: 'MY_TASK', pipe: 'MY_PIPE',
} as Record<string, string>)[props.kind] || '');

const nameError = computed(() => {
  const name = f.name.trim();
  if (!name) return '';
  if (/[.]/.test(name)) return 'A name cannot contain a dot.';
  if (name.length > 255) return 'A name is at most 255 characters.';
  return '';
});

function intOk(value: string) { return value.trim() === '' || /^\d+$/.test(value.trim()); }
function where(name: string) {
  if (props.kind === 'schema') return `${ident(f.database)}.${ident(name)}`;
  return `${ident(f.database)}.${ident(f.schema)}.${ident(name)}`;
}
function comment() { return f.comment.trim() ? ` COMMENT = ${str(f.comment.trim())}` : ''; }
function roleList() { return policyRoles.value.map(r => str(r)).join(', '); }

const spec = computed(() => {
  const name = f.name.trim();
  const statements: string[] = [];
  let invalid = !name || !!nameError.value;
  let title = '';
  let subtitle = '';
  let success = '';
  const k = props.kind;
  if (k === 'database') {
    title = 'New Database';
    invalid = invalid || !intOk(f.retention);
    statements.push(`CREATE ${f.transient ? 'TRANSIENT ' : ''}DATABASE ${ident(name)}${f.retention.trim() ? ` DATA_RETENTION_TIME_IN_DAYS = ${f.retention.trim()}` : ''}${comment()}`);
    success = `Database ${name.toUpperCase()} created`;
  } else if (k === 'schema') {
    title = 'New Schema'; subtitle = `in ${f.database}`;
    invalid = invalid || !f.database;
    statements.push(`CREATE ${f.transient ? 'TRANSIENT ' : ''}SCHEMA ${where(name)}${f.managed ? ' WITH MANAGED ACCESS' : ''}${comment()}`);
    success = `Schema ${name.toUpperCase()} created`;
  } else if (k === 'table') {
    title = 'Create Table'; subtitle = `in ${f.database}.${f.schema}`;
    const cols = columns.filter(c => c.name.trim());
    invalid = invalid || !cols.length || !intOk(f.retention) || !f.schema;
    const body = cols.map(c => `${ident(c.name)} ${c.type}${c.notNull ? ' NOT NULL' : ''}`).join(', ');
    let sql = `CREATE ${f.tableType ? f.tableType + ' ' : ''}TABLE ${where(name)} (${body})`;
    if (f.cluster.trim()) sql += ` CLUSTER BY (${f.cluster.split(',').map(x => ident(x.trim())).filter(Boolean).join(', ')})`;
    if (f.retention.trim()) sql += ` DATA_RETENTION_TIME_IN_DAYS = ${f.retention.trim()}`;
    if (f.changeTracking) sql += ' CHANGE_TRACKING = TRUE';
    statements.push(sql + comment());
    success = `Table ${name.toUpperCase()} created`;
  } else if (k === 'view') {
    title = 'Create View'; subtitle = `in ${f.database}.${f.schema}`;
    invalid = invalid || !f.query.trim();
    statements.push(`CREATE ${f.secure ? 'SECURE ' : ''}VIEW ${where(name)}${comment()} AS ${f.query.trim().replace(/;\s*$/, '')}`);
    success = `View ${name.toUpperCase()} created`;
  } else if (k === 'stage') {
    title = 'Create Stage'; subtitle = f.stageType === 'external' ? 'External stage · Amazon S3' : 'Snowflake managed';
    let sql = `CREATE STAGE ${where(name)}`;
    if (f.stageType === 'external') {
      invalid = invalid || !/^s3:\/\//i.test(f.url.trim());
      sql += ` URL = ${str(f.url.trim())}`;
      if (f.integration.trim()) sql += ` STORAGE_INTEGRATION = ${ident(f.integration.trim())}`;
    }
    if (f.format) sql += ` FILE_FORMAT = (FORMAT_NAME = ${str(f.format)})`;
    statements.push(sql + comment());
    success = `Stage ${name.toUpperCase()} created`;
  } else if (k === 'file-format') {
    title = 'Create File Format'; subtitle = `in ${f.database}.${f.schema}`;
    let sql = `CREATE FILE FORMAT ${where(name)} TYPE = ${f.ffType}`;
    if (f.ffType === 'CSV') {
      invalid = invalid || !intOk(f.skipHeader);
      sql += ` FIELD_DELIMITER = ${str(f.delimiter || ',')} SKIP_HEADER = ${f.skipHeader.trim() || '0'}`;
      if (f.enclosed) sql += ` FIELD_OPTIONALLY_ENCLOSED_BY = ${str(f.enclosed)}`;
      sql += ` ERROR_ON_COLUMN_COUNT_MISMATCH = ${f.errorOnColumnMismatch ? 'TRUE' : 'FALSE'}`;
    } else {
      if (f.ffType === 'JSON') sql += ` STRIP_OUTER_ARRAY = ${f.stripOuter ? 'TRUE' : 'FALSE'}`;
      if (f.compression) sql += ` COMPRESSION = ${f.compression}`;
    }
    statements.push(sql + comment());
    success = `File format ${name.toUpperCase()} created`;
  } else if (k === 'warehouse') {
    title = 'New Warehouse';
    invalid = invalid || (f.multiCluster && (!/^\d+$/.test(f.minClusters) || !/^\d+$/.test(f.maxClusters) || Number(f.minClusters) > Number(f.maxClusters) || Number(f.minClusters) < 1));
    let sql = `CREATE WAREHOUSE ${ident(name)} WITH WAREHOUSE_SIZE = ${str(f.size)}`;
    if (f.whType !== 'STANDARD') sql += ` WAREHOUSE_TYPE = ${str(f.whType)}`;
    sql += ` AUTO_SUSPEND = ${f.suspend === '0' ? 'NULL' : f.suspend} AUTO_RESUME = ${f.autoResume ? 'TRUE' : 'FALSE'}`;
    if (f.multiCluster) sql += ` MIN_CLUSTER_COUNT = ${f.minClusters} MAX_CLUSTER_COUNT = ${f.maxClusters} SCALING_POLICY = ${str(f.policy)}`;
    if (f.initiallySuspended) sql += ' INITIALLY_SUSPENDED = TRUE';
    statements.push(sql + comment());
    success = `Warehouse ${name.toUpperCase()} created`;
  } else if (k === 'role') {
    title = 'New Role';
    statements.push(`CREATE ROLE ${ident(name)}${comment()}`);
    if (f.parent) statements.push(`GRANT ROLE ${ident(name)} TO ROLE ${ident(f.parent)}`);
    success = `Role ${name.toUpperCase()} created`;
  } else if (k === 'user') {
    title = 'New User';
    invalid = invalid || !f.password;
    let sql = `CREATE USER ${ident(name)} PASSWORD = ${str(f.password)}`;
    if (f.login.trim()) sql += ` LOGIN_NAME = ${str(f.login.trim())}`;
    if (f.email.trim()) sql += ` EMAIL = ${str(f.email.trim())}`;
    if (f.defaultRole) sql += ` DEFAULT_ROLE = ${ident(f.defaultRole)}`;
    if (f.defaultWarehouse) sql += ` DEFAULT_WAREHOUSE = ${ident(f.defaultWarehouse)}`;
    statements.push(sql + comment());
    if (f.defaultRole) statements.push(`GRANT ROLE ${ident(f.defaultRole)} TO USER ${ident(name)}`);
    success = `User ${name.toUpperCase()} created`;
  } else if (k === 'monitor') {
    title = 'New Resource Monitor';
    invalid = invalid || !/^\d+(\.\d+)?$/.test(f.quota.trim())
      || [[f.notifyOn, f.notifyPct], [f.suspendOn, f.suspendPct], [f.suspendNowOn, f.suspendNowPct]].some(([on, pct]) => on && !/^\d+$/.test(String(pct)));
    const triggers: string[] = [];
    if (f.notifyOn) triggers.push(`ON ${f.notifyPct} PERCENT DO NOTIFY`);
    if (f.suspendOn) triggers.push(`ON ${f.suspendPct} PERCENT DO SUSPEND`);
    if (f.suspendNowOn) triggers.push(`ON ${f.suspendNowPct} PERCENT DO SUSPEND_IMMEDIATE`);
    statements.push(`CREATE RESOURCE MONITOR ${ident(name)} WITH CREDIT_QUOTA = ${f.quota.trim()} FREQUENCY = ${f.frequency} START_TIMESTAMP = IMMEDIATELY${triggers.length ? ' TRIGGERS ' + triggers.join(' ') : ''}`);
    if (f.monitorLevel === 'ACCOUNT') statements.push(`ALTER ACCOUNT SET RESOURCE_MONITOR = ${ident(name)}`);
    else for (const w of monitorWarehouses.value) statements.push(`ALTER WAREHOUSE ${ident(w)} SET RESOURCE_MONITOR = ${ident(name)}`);
    success = `Resource monitor ${name.toUpperCase()} created`;
  } else if (k === 'masking-policy') {
    title = 'Create Masking Policy'; subtitle = `in ${f.database}.${f.schema}`;
    invalid = invalid || !f.maskExpr.trim();
    const allow = policyRoles.value.length ? `CASE WHEN CURRENT_ROLE() IN (${roleList()}) THEN val ELSE ${f.maskExpr.trim()} END` : f.maskExpr.trim();
    statements.push(`CREATE MASKING POLICY ${where(name)} AS (val ${f.dataType}) RETURNS ${f.dataType} -> ${allow}${comment()}`);
    success = `Masking policy ${name.toUpperCase()} created`;
  } else if (k === 'row-access-policy') {
    title = 'Create Row Access Policy'; subtitle = `in ${f.database}.${f.schema}`;
    invalid = invalid || !isPlainIdent(f.argName);
    const cond = f.rowCond.trim() || 'FALSE';
    const body = policyRoles.value.length ? `CURRENT_ROLE() IN (${roleList()}) OR ${cond}` : cond;
    statements.push(`CREATE ROW ACCESS POLICY ${where(name)} AS (${ident(f.argName)} ${f.dataType}) RETURNS BOOLEAN -> ${body}`);
    success = `Row access policy ${name.toUpperCase()} created`;
  } else if (k === 'stream') {
    title = 'Create Stream'; subtitle = `in ${f.database}.${f.schema}`;
    invalid = invalid || !f.onTable;
    statements.push(`CREATE STREAM ${where(name)} ON TABLE ${fqnSql(f.onTable)}${f.appendOnly ? ' APPEND_ONLY = TRUE' : ''}`);
    success = `Stream ${name.toUpperCase()} created`;
  } else if (k === 'task') {
    title = 'Create Task'; subtitle = `in ${f.database}.${f.schema}`;
    invalid = invalid || !f.body.trim() || !f.taskWarehouse;
    statements.push(`CREATE TASK ${where(name)} WAREHOUSE = ${ident(f.taskWarehouse)}${f.schedule.trim() ? ` SCHEDULE = ${str(f.schedule.trim())}` : ''} AS ${f.body.trim().replace(/;\s*$/, '')}`);
    success = `Task ${name.toUpperCase()} created`;
  } else if (k === 'pipe') {
    title = 'Create Pipe'; subtitle = `in ${f.database}.${f.schema}`;
    invalid = invalid || !/^\s*copy\s+into/i.test(f.body);
    statements.push(`CREATE PIPE ${where(name)} AUTO_INGEST = ${f.autoIngest ? 'TRUE' : 'FALSE'} AS ${f.body.trim().replace(/;\s*$/, '')}`);
    success = `Pipe ${name.toUpperCase()} created`;
  }
  return { title, subtitle, statements, invalid, success, ok: 'Create' };
});

async function submit() {
  if (spec.value.invalid) return;
  busy.value = true;
  error.value = '';
  try {
    const list2 = spec.value.statements;
    for (let i = 0; i < list2.length; i++) {
      const last = i === list2.length - 1;
      const result = await sf.sql(list2[i], { quiet: true, success: last ? spec.value.success : undefined });
      if (!result.ok) {
        error.value = String(result.error || result.output || 'The statement failed.').trim();
        return;
      }
    }
    emit('close');
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.cols { display: flex; flex-direction: column; gap: 6px; }
.cols__head, .cols__row { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) 64px 32px; gap: 8px; align-items: center; }
.cols__head span { font-size: 12px; color: var(--sf-text-2); }
.cols__nn { display: flex; justify-content: center; }
.cols__nn input { width: 16px; height: 16px; accent-color: var(--sf-primary); }
.cols__add { align-self: flex-start; }
.adv { border: 1px solid var(--sf-border); border-radius: 8px; padding: 10px 12px; }
.adv summary { cursor: pointer; font-weight: 500; }
.adv__body { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
.sf-field--check { justify-content: flex-start; }
.sf-field--check .sf-check { height: 32px; }
.whpick { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 8px 10px; border: 1px solid var(--sf-border); border-radius: 6px; max-height: 140px; overflow: auto; }
.triggers { display: grid; grid-template-columns: max-content 72px minmax(0, 1fr); gap: 8px 10px; align-items: center; }
.triggers span { font-size: 12px; color: var(--sf-text-2); }
.trig { height: 28px; }
</style>
