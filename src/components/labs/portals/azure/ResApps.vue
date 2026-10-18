<template>
  <div>
    <!-- ===== Web App ===== -->
    <template v-if="res.kind === 'webapp'">
      <template v-if="tab === 'overview'">
        <div class="az-tabs"><button type="button" class="az-tab is-active">Properties</button></div>
        <div class="az-kv"><span>Default domain</span><span>{{ p.host }}</span></div>
        <div class="az-kv"><span>HTTPS Only</span><span>{{ p.https_only ? 'On' : 'Off' }}</span></div>
        <div class="az-kv"><span>Stack</span><span>{{ p.runtime }}</span></div>
      </template>
      <template v-else-if="tab === 'env'">
        <div class="az-tabs"><button type="button" class="az-tab is-active">App settings</button>
          <button type="button" class="az-tab" disabled>Connection strings</button></div>
        <p class="az-intro">App settings are exposed as environment variables for access by your application at runtime.</p>
        <div class="az-cmdbar"><button type="button" class="az-cmd" @click="openSetting"><AzIcon name="plus" /> Add</button>
          <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button></div>
        <AzTable :columns="[{ key: 'name', label: 'Name' }, { key: 'value', label: 'Value' }]" :rows="settings" row-key="name">
          <template #cell-value="{ row }"><span class="az-mono">{{ showValues ? row.value : 'Hidden value. Click show values button above to view' }}</span></template>
          <template #empty>No application settings to display.</template>
        </AzTable>
        <button type="button" class="az-link" style="margin-top: 8px" @click="showValues = !showValues">{{ showValues ? 'Hide' : 'Show' }} values</button>
      </template>
      <template v-else-if="tab === 'webconfig'">
        <div class="az-field"><div class="az-field__label">HTTPS Only</div>
          <div class="az-radios"><label class="az-radio"><input v-model="httpsOnly" type="radio" value="true" /> On</label>
            <label class="az-radio"><input v-model="httpsOnly" type="radio" value="false" /> Off</label></div></div>
        <button type="button" class="az-btn az-btn--primary" @click="saveHttps">Save</button>
      </template>
    </template>

    <!-- ===== App Service plan ===== -->
    <template v-else-if="res.kind === 'plan'">
      <template v-if="tab === 'overview' || tab === 'apps'">
        <h3 class="az-section-title">Apps</h3>
        <AzTable :columns="[{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }]" :rows="apps" row-key="name">
          <template #empty>No apps in this plan.</template></AzTable>
      </template>
      <template v-else-if="tab === 'scale'">
        <p class="az-intro">Pricing plans determine the features and compute available to apps in this plan.</p>
        <div class="az-skus">
          <label v-for="s in PLAN_SKUS" :key="s.name" class="az-sku" :class="{ 'is-on': planSku === s.name }">
            <input v-model="planSku" type="radio" :value="s.name" /> <b>{{ s.name }}</b>
            <span class="az-muted">{{ s.desc }}</span></label>
        </div>
        <button type="button" class="az-btn az-btn--primary" style="margin-top: 12px" :disabled="planSku === p.sku" @click="savePlan">Select</button>
      </template>
    </template>

    <!-- ===== AKS ===== -->
    <template v-else-if="res.kind === 'aks'">
      <template v-if="tab === 'overview' || tab === 'nodepools'">
        <h3 class="az-section-title">Node pools</h3>
        <AzTable :columns="[{ key: 'name', label: 'Node pool' }, { key: 'mode', label: 'Mode' }, { key: 'count', label: 'Node count' }, { key: 'size', label: 'Node size' }, { key: 'k8s', label: 'Kubernetes version' }]"
                 :rows="[{ name: 'nodepool1', mode: 'System', count: p.nodes, size: p.node_size, k8s: p.version }]" row-key="name" />
        <div v-if="tab === 'nodepools'" class="az-card" style="margin-top: 12px; max-width: 420px">
          <h3>Scale node pool</h3>
          <div class="az-field"><div class="az-field__label">Node count</div>
            <div class="az-field__ctl"><input v-model.number="nodeCount" type="range" min="1" max="10" style="width: 100%" /> {{ nodeCount }}</div></div>
          <button type="button" class="az-btn az-btn--primary" :disabled="nodeCount === p.nodes" @click="scale">Apply</button>
        </div>
      </template>
      <template v-else-if="tab === 'aksconnect'">
        <p class="az-intro">Run the following commands to connect to the cluster.</p>
        <pre class="az-code">az account set --subscription {{ az.p.value.account?.subscription }}
az aks get-credentials --resource-group {{ res.group }} --name {{ res.name }} --overwrite-existing</pre>
        <button type="button" class="az-btn" @click="getCreds">Run get-credentials</button>
        <pre v-if="credOut" class="az-code" style="margin-top: 10px">{{ credOut }}</pre>
      </template>
    </template>

    <!-- ===== SQL server ===== -->
    <template v-else-if="res.kind === 'sql'">
      <template v-if="tab === 'overview' || tab === 'databases'">
        <div class="az-cmdbar"><button type="button" class="az-cmd" @click="az.go({ page: 'create', kind: 'sqldb', group: res.group, extra: { server: res.name } })">
          <AzIcon name="plus" /> Create database</button></div>
        <AzTable :columns="[{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }, { key: 'sku', label: 'Pricing tier' }]"
                 :rows="(p.databases || []).map((d: any) => ({ ...d, status: 'Online' }))" row-key="name">
          <template #cell-name="{ row }"><button type="button" class="az-link az-namecell" @click="az.go({ page: 'resource', id: res.id + '/databases/' + row.name })">
            <AzIcon name="sqldb" /> {{ row.name }}</button></template>
          <template #empty>No SQL databases.</template>
        </AzTable>
      </template>
    </template>

    <!-- ===== SQL database ===== -->
    <template v-else-if="res.kind === 'sqldb'">
      <template v-if="tab === 'overview' || tab === 'compute'">
        <div class="az-field"><div class="az-field__label">Service tier / compute size</div>
          <div class="az-field__ctl"><select v-model="dbSku" class="az-select" :disabled="tab === 'overview'">
            <option v-for="s in ['Basic', 'S0', 'S1', 'S2', 'S3', 'P1', 'GP_Gen5_2', 'GP_S_Gen5_1']" :key="s" :value="s">{{ s }}</option></select></div></div>
        <button v-if="tab === 'compute'" type="button" class="az-btn az-btn--primary" :disabled="dbSku === p.sku" @click="saveDb">Apply</button>
      </template>
    </template>

    <!-- ===== Key vault ===== -->
    <template v-else-if="res.kind === 'keyvault'">
      <template v-if="tab === 'overview'">
        <div class="az-banner"><AzIcon name="infofill" /><span>Permission model: <b>{{ p.rbac ? 'Azure role-based access control' : 'Vault access policy' }}</b>.
          {{ p.rbac ? 'Reading a secret needs a data-plane role such as Key Vault Secrets User — Owner and Contributor do not grant it.' : '' }}</span></div>
      </template>
      <template v-else-if="tab === 'secrets' && !secret">
        <div class="az-cmdbar">
          <button type="button" class="az-cmd" @click="openSecret"><AzIcon name="plus" /> Generate/Import</button>
          <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
        </div>
        <AzTable :columns="[{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'expires', label: 'Expiration date' }, { key: 'updated', label: 'Updated' }]"
                 :rows="secrets" row-key="name">
          <template #cell-name="{ row }"><button type="button" class="az-link" @click="secret = row.name; reveal = false">{{ row.name }}</button></template>
          <template #empty>There are no secrets available.</template>
        </AzTable>
      </template>
      <template v-else-if="tab === 'secrets' && secret">
        <div class="az-crumbline"><button type="button" class="az-link" @click="secret = ''">Secrets</button> &gt; <b>{{ secret }}</b></div>
        <div class="az-cmdbar">
          <button type="button" class="az-cmd" @click="openSecret(secret)"><AzIcon name="plus" /> New Version</button>
          <button type="button" class="az-cmd az-cmd--danger" @click="deleteSecret"><AzIcon name="trash" /> Delete</button>
        </div>
        <div class="az-kv"><span>Secret Identifier</span><span class="az-mono">{{ p.uri }}secrets/{{ secret }}</span></div>
        <div class="az-kv"><span>Versions</span><span>{{ curSecret?.versions }}</span></div>
        <div class="az-kv"><span>Content type</span><span>{{ curSecret?.content_type || '—' }}</span></div>
        <div class="az-field" style="margin-top: 10px"><div class="az-field__label">Secret value</div>
          <div class="az-field__ctl"><input class="az-input az-mono" readonly :type="reveal ? 'text' : 'password'" :value="reveal ? revealed : '••••••••'" />
            <button type="button" class="az-link" style="margin-top: 6px" @click="showSecret">{{ reveal ? 'Hide' : 'Show' }} Secret Value</button></div></div>
      </template>
      <template v-else-if="tab === 'kvaccess'">
        <div class="az-field"><div class="az-field__label">Permission model</div>
          <div class="az-radios" style="flex-direction: column">
            <label class="az-radio"><input v-model="rbac" type="radio" value="true" /> Azure role-based access control (recommended)</label>
            <label class="az-radio"><input v-model="rbac" type="radio" value="false" /> Vault access policy</label></div></div>
        <button type="button" class="az-btn az-btn--primary" :disabled="rbac === String(Boolean(p.rbac))" @click="saveRbac">Apply</button>
      </template>
      <template v-else-if="tab === 'kvprops'">
        <div class="az-kv"><span>Soft-delete</span><span>Soft delete has been enabled on this key vault</span></div>
        <div class="az-kv"><span>Days to retain deleted vaults</span><span>{{ p.soft_delete_days }}</span></div>
        <div class="az-field" style="margin-top: 12px"><div class="az-field__label">Purge protection</div>
          <div class="az-radios" style="flex-direction: column">
            <label class="az-radio"><input v-model="purge" type="radio" value="false" :disabled="p.purge_protection" /> Disable purge protection (allow key vault and objects to be purged during retention period)</label>
            <label class="az-radio"><input v-model="purge" type="radio" value="true" /> Enable purge protection (enforce a mandatory retention period for deleted vaults and vault objects)</label></div>
          <div class="az-help">Once enabled, this option cannot be disabled.</div></div>
        <button type="button" class="az-btn az-btn--primary" :disabled="purge === String(Boolean(p.purge_protection))" @click="savePurge">Save</button>
      </template>
    </template>

    <!-- ===== Container registry ===== -->
    <template v-else-if="res.kind === 'acr'">
      <template v-if="tab === 'acrkeys'">
        <div class="az-kv"><span>Registry name</span><span>{{ res.name }}</span></div>
        <div class="az-kv"><span>Login server</span><span>{{ p.login_server }}</span></div>
        <div class="az-field" style="margin-top: 12px"><div class="az-field__label">Admin user</div>
          <div class="az-field__ctl"><label class="az-check"><input type="checkbox" :checked="Boolean(p.admin_enabled)" @change="toggleAdmin" /> Enabled</label></div></div>
      </template>
      <template v-else-if="tab === 'repos'">
        <AzTable :columns="[{ key: 'name', label: 'Repositories' }]" :rows="[]" row-key="name">
          <template #empty>No results. Push an image: <span class="az-mono">docker push {{ p.login_server }}/app:v1</span></template></AzTable>
      </template>
    </template>

    <!-- ===== Cosmos DB ===== -->
    <template v-else-if="res.kind === 'cosmos'">
      <template v-if="tab === 'consistency'">
        <div class="az-radios" style="flex-direction: column">
          <label v-for="c in ['Strong', 'BoundedStaleness', 'Session', 'ConsistentPrefix', 'Eventual']" :key="c" class="az-radio">
            <input v-model="consistency" type="radio" :value="c" /> {{ c === 'BoundedStaleness' ? 'Bounded staleness' : c === 'ConsistentPrefix' ? 'Consistent prefix' : c }}</label>
        </div>
        <button type="button" class="az-btn az-btn--primary" style="margin-top: 12px" :disabled="consistency === p.consistency" @click="saveConsistency">Save</button>
      </template>
    </template>

    <!-- ===== Log Analytics workspace ===== -->
    <template v-else-if="res.kind === 'workspace'">
      <LogsQuery v-if="tab === 'logs'" :workspace="res.name" />
      <template v-else-if="tab === 'tables' || tab === 'overview'">
        <h3 class="az-section-title">Tables with data</h3>
        <AzTable :columns="[{ key: 'name', label: 'Table name' }, { key: 'plan', label: 'Plan' }]"
                 :rows="(az.p.value.log_tables || []).map((t: string) => ({ name: t, plan: 'Analytics' }))" row-key="name" />
      </template>
    </template>

    <!-- ===== Managed identity ===== -->
    <template v-else-if="res.kind === 'identity'">
      <template v-if="tab === 'roles' || tab === 'overview'">
        <h3 class="az-section-title">Azure role assignments</h3>
        <AzTable :columns="[{ key: 'role', label: 'Role' }, { key: 'scope', label: 'Scope' }]" :rows="identityRoles" row-key="key">
          <template #empty>No role assignments. A managed identity with no role can authenticate and do nothing.</template></AzTable>
        <button v-if="tab === 'roles'" type="button" class="az-btn az-btn--primary" style="margin-top: 10px" @click="$emit('tab', 'iam')">+ Add role assignment</button>
      </template>
    </template>

    <template v-else-if="tab === 'overview'"><span></span></template>

    <!-- panes -->
    <AzPane v-if="settingPane" title="Add/Edit application setting" :subtitle="res.name" :error="paneError" @close="settingPane = false">
      <div class="az-field"><div class="az-field__label">Name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="sForm.name" class="az-input" /></div></div>
      <div class="az-field"><div class="az-field__label">Value</div>
        <div class="az-field__ctl"><input v-model="sForm.value" class="az-input" /></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(sForm.name)" @click="saveSetting">Apply</button>
        <button type="button" class="az-btn" @click="settingPane = false">Cancel</button>
      </template>
    </AzPane>
    <AzPane v-if="secretPane" title="Create a secret" :subtitle="res.name" :error="paneError" @close="secretPane = false">
      <div class="az-field"><div class="az-field__label">Upload options</div><div class="az-field__ctl">Manual</div></div>
      <div class="az-field"><div class="az-field__label">Name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="kForm.name" class="az-input" :disabled="Boolean(kForm.fixed)" /></div></div>
      <div class="az-field"><div class="az-field__label">Secret value <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="kForm.value" class="az-input" type="password" /></div></div>
      <div class="az-field"><div class="az-field__label">Content type (optional)</div>
        <div class="az-field__ctl"><input v-model="kForm.type" class="az-input" /></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!kForm.name || !kForm.value" @click="saveSecret">Create</button>
        <button type="button" class="az-btn" @click="secretPane = false">Cancel</button>
      </template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/** App Service, AKS, SQL, Key Vault, ACR, Cosmos DB, Log Analytics and managed identity blades. */
import { computed, reactive, ref } from 'vue';
import { cli, errorText, parseJson, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTable from './AzTable.vue';
import LogsQuery from './LogsQuery.vue';
import { fmtDate, scopeLabel, useAz } from './azure';

const props = defineProps<{ res: Record<string, any>; tab: string }>();
defineEmits<{ (event: 'tab', tab: string): void }>();
const az = useAz();
const p = computed(() => props.res.props || {});
const g = computed(() => String(props.res.group));
const n = computed(() => String(props.res.name));
const paneError = ref('');

// web app
const settings = computed(() => Object.entries(p.value.app_settings || {}).map(([name, value]) => ({ name, value })));
const showValues = ref(false);
const settingPane = ref(false);
const sForm = reactive({ name: '', value: '' });
function openSetting() { Object.assign(sForm, { name: '', value: '' }); paneError.value = ''; settingPane.value = true; }
async function saveSetting() {
  const result = await az.run(cli(['az', 'webapp', 'config', 'appsettings', 'set'], { '-g': g.value, '-n': n.value,
                                  '--settings': [`${sForm.name}=${sForm.value}`] }), `Updated app setting '${sForm.name}'`, { quiet: true });
  if (!result.ok) { paneError.value = errorText(result); return; }
  settingPane.value = false;
}
const httpsOnly = ref(String(Boolean(p.value.https_only)));
async function saveHttps() {
  await az.run(cli(['az', 'webapp', 'update'], { '-g': g.value, '-n': n.value, '--https-only': httpsOnly.value }),
               `Updated configuration of '${n.value}'`);
}

// plan
const apps = computed(() => rows(az.p.value, 'resources').filter(r => r.kind === 'webapp' && r.props?.plan === n.value)
  .map(r => ({ name: r.name, status: r.props?.web_state || 'Running' })));
const PLAN_SKUS = [{ name: 'F1', desc: 'Free · 60 CPU minutes/day' }, { name: 'B1', desc: 'Basic · 1 core, 1.75 GB' },
                   { name: 'S1', desc: 'Standard · 1 core, 1.75 GB, staging slots' },
                   { name: 'P1v3', desc: 'Premium v3 · 2 cores, 8 GB' }];
const planSku = ref(String(p.value.sku || 'B1'));
async function savePlan() {
  await az.run(cli(['az', 'appservice', 'plan', 'update'], { '-g': g.value, '-n': n.value, '--sku': planSku.value }),
               `Scaled App Service plan '${n.value}' to ${planSku.value}`);
}

// aks
const nodeCount = ref(Number(p.value.nodes || 3));
async function scale() {
  await az.run(cli(['az', 'aks', 'scale'], { '-g': g.value, '-n': n.value, '--node-count': nodeCount.value }),
               `Scaled node pool to ${nodeCount.value} nodes`);
}
const credOut = ref('');
async function getCreds() {
  const result = await az.run(cli(['az', 'aks', 'get-credentials'], { '--resource-group': g.value, '--name': n.value }), '', { quiet: true });
  credOut.value = String(result.ok ? result.output : result.error || '').trim();
}

// sql db
const dbSku = ref(String(p.value.sku || 'S0'));
async function saveDb() {
  await az.run(cli(['az', 'sql', 'db', 'update'], { '-g': g.value, '-s': p.value.server, '-n': n.value, '--service-objective': dbSku.value }),
               `Updated database '${n.value}' to ${dbSku.value}`);
}

// key vault
const secrets = computed(() => (p.value.secrets || []).map((s: any) => ({ ...s, type: s.content_type || '', status: '✓ Enabled', expires: '—', updated: fmtDate(s.updated) })));
const secret = ref('');
const curSecret = computed(() => (p.value.secrets || []).find((s: any) => s.name === secret.value));
const reveal = ref(false);
const revealed = ref('');
async function showSecret() {
  if (reveal.value) { reveal.value = false; return; }
  const result = await az.run(cli(['az', 'keyvault', 'secret', 'show'], { '--vault-name': n.value, '--name': secret.value }), '', { quiet: true });
  if (result.ok) { revealed.value = String(parseJson<Record<string, any>>(result.output)?.value ?? ''); reveal.value = true; }
}
const secretPane = ref(false);
const kForm = reactive({ name: '', value: '', type: '', fixed: '' });
function openSecret(fixed?: unknown) {
  const name = typeof fixed === 'string' ? fixed : '';
  Object.assign(kForm, { name, value: '', type: '', fixed: name });
  paneError.value = '';
  secretPane.value = true;
}
async function saveSecret() {
  const result = await az.run(cli(['az', 'keyvault', 'secret', 'set'], { '--vault-name': n.value, '--name': kForm.name,
                                  '--value': kForm.value, '--content-type': kForm.type }), `The secret '${kForm.name}' has been successfully created.`, { quiet: true });
  if (!result.ok) { paneError.value = errorText(result); return; }
  secretPane.value = false;
}
async function deleteSecret() {
  if (!(await az.confirm({ title: 'Delete secret', message: `Are you sure you want to delete the secret '${secret.value}'?`, confirmLabel: 'Yes', danger: true }))) return;
  const result = await az.run(cli(['az', 'keyvault', 'secret', 'delete'], { '--vault-name': n.value, '--name': secret.value }),
                              `Deleted secret '${secret.value}'`);
  if (result.ok) secret.value = '';
}
const rbac = ref(String(Boolean(p.value.rbac)));
async function saveRbac() {
  await az.run(cli(['az', 'keyvault', 'update'], { '-g': g.value, '-n': n.value, '--enable-rbac-authorization': rbac.value }),
               `Updated access configuration of '${n.value}'`);
}
const purge = ref(String(Boolean(p.value.purge_protection)));
async function savePurge() {
  await az.run(cli(['az', 'keyvault', 'update'], { '-g': g.value, '-n': n.value, '--enable-purge-protection': purge.value }),
               `Updated properties of '${n.value}'`);
}

// acr
async function toggleAdmin() {
  await az.run(cli(['az', 'acr', 'update'], { '-g': g.value, '-n': n.value, '--admin-enabled': String(!p.value.admin_enabled) }),
               `Updated admin user of '${n.value}'`);
}

// cosmos
const consistency = ref(String(p.value.consistency || 'Session'));
async function saveConsistency() {
  await az.run(cli(['az', 'cosmosdb', 'update'], { '-g': g.value, '-n': n.value, '--default-consistency-level': consistency.value }),
               `Updated default consistency of '${n.value}'`);
}

// identity
const identityRoles = computed(() => rows(az.p.value, 'role_assignments').filter(a => a.principal === n.value)
  .map(a => ({ key: `${a.role}|${a.scope}`, role: a.role, scope: scopeLabel(String(a.scope)) })));
</script>

<style scoped>
.az-crumbline { margin: 0 0 8px; }
.az-skus { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
.az-sku { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px solid #e0e0e0; border-radius: 6px; cursor: pointer; }
.az-sku.is-on { border-color: #0f6cbd; background: #ebf3fc; }
.az-sku input { accent-color: #0f6cbd; }
</style>
