<template>
  <div class="fx-page ad">
    <div class="fx-page__head"><h1 class="fx-page__title">{{ title }}</h1></div>
    <div class="fx-split">
      <nav class="ad-nav" aria-label="Admin portal">
        <button v-for="t in tabs" :key="t.id" type="button" :class="{ 'is-active': tab === t.id }" @click="setTab(t.id)">{{ t.label }}</button>
      </nav>
      <section class="fx-content">
        <div v-if="error" class="fx-msgbar fx-msgbar--error ad-msg"><FxIcon name="error" /><span>{{ error }}</span></div>

        <!-- Capacity settings -->
        <template v-if="tab === 'capacities'">
          <div class="fx-cmdbar ad-bar">
            <button type="button" class="fx-btn fx-btn--primary" @click="newCap = true"><FxIcon name="plus" />New capacity</button>
            <span class="fx-cmdbar__grow" />
            <span class="fx-muted ad-note">Fabric capacities · Pay-as-you-go</span>
          </div>
          <div class="fx-page__scroll fx-tablewrap">
            <table class="fx-table ad-table">
              <thead><tr><th>Capacity name</th><th>SKU</th><th>Region</th><th>State</th><th>Utilization</th><th>Throttling</th>
                <th>Est. monthly cost</th><th>Workspaces</th><th>Actions</th></tr></thead>
              <tbody>
                <tr v-for="c in capacities" :key="c.name">
                  <td><span class="fx-cellname"><FxIcon name="Capacity" />{{ c.name }}</span></td>
                  <td>{{ c.sku }} <span class="fx-muted">({{ c.cu }} CU)</span></td>
                  <td>{{ regionOf(c.name) }}</td>
                  <td><span class="fx-pill" :class="c.state === 'Active' ? 'fx-pill--ok' : 'fx-pill--warn'">{{ c.state }}</span></td>
                  <td><span class="ad-meter"><span :style="{ width: Math.min(100, c.utilization) + '%', background: c.utilization > 100 ? '#c50f1f' : '#117865' }" /></span> {{ c.utilization }}%</td>
                  <td>{{ c.throttling }}</td>
                  <td>${{ Number(c.monthly_usd).toLocaleString() }}</td>
                  <td class="ad-ws">{{ c.workspaces || '—' }}</td>
                  <td class="ad-actions">
                    <button v-if="c.state === 'Active'" type="button" class="fx-btn fx-btn--sm" @click="pauseCap(c.name)"><FxIcon name="pause" :size="12" />Pause</button>
                    <button v-else type="button" class="fx-btn fx-btn--sm" @click="resume(c.name)"><FxIcon name="play" :size="12" />Resume</button>
                    <button type="button" class="fx-btn fx-btn--sm" @click="openResize(c)">Change size</button>
                    <button type="button" class="fx-btn fx-btn--sm" @click="openMetrics(c.name)">Metrics</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="metrics" class="ad-metrics">
              <h3 class="fx-h3">Microsoft Fabric Capacity Metrics - {{ metrics.name }}</h3>
              <FxGrid v-for="(g, i) in metrics.grids" :key="i" :grid="g" />
              <pre class="ad-pre">{{ metrics.text }}</pre>
            </div>
          </div>
        </template>

        <!-- Connections -->
        <template v-else-if="tab === 'connections'">
          <div class="fx-cmdbar ad-bar">
            <button type="button" class="fx-btn fx-btn--primary" @click="openConn(null)"><FxIcon name="plus" />New</button>
          </div>
          <div class="fx-page__scroll fx-tablewrap">
            <table class="fx-table ad-table">
              <thead><tr><th>Name</th><th>Connection type</th><th>Authentication</th><th>Credential</th><th>Server</th><th>Expires</th><th /></tr></thead>
              <tbody>
                <tr v-for="c in connections" :key="c.name">
                  <td><span class="fx-cellname"><FxIcon name="share" />{{ c.name }}</span></td>
                  <td>{{ c.type }}</td><td>{{ c.auth }}</td>
                  <td><span class="fx-pill" :class="c.secret === 'Key Vault' ? 'fx-pill--ok' : c.secret === 'inline' ? 'fx-pill--warn' : ''">{{ c.secret }}</span></td>
                  <td>{{ detailOf(c.name).server || '—' }}</td>
                  <td>{{ c.expires || '—' }}</td>
                  <td class="ad-actions"><button type="button" class="fx-btn fx-btn--sm" @click="openConn(c)">Settings</button>
                    <button type="button" class="fx-btn fx-btn--sm" @click="askRemoveConn = c.name">Remove</button></td>
                </tr>
                <tr v-if="!connections.length"><td colspan="7" class="fx-muted">No connections</td></tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- Audit logs -->
        <template v-else>
          <div class="fx-page__scroll fx-tablewrap">
            <table class="fx-table ad-table">
              <thead><tr><th>Time</th><th>User</th><th>Activity</th><th>Item</th><th>Detail</th></tr></thead>
              <tbody>
                <tr v-for="(a, i) in audit" :key="i"><td>{{ a.at }}</td><td>{{ a.user }}</td><td>{{ a.operation }}</td><td>{{ a.target }}</td><td class="fx-muted">{{ a.detail }}</td></tr>
                <tr v-if="!audit.length"><td colspan="5" class="fx-muted">No audit events yet.</td></tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>
    </div>

    <FxPanel v-if="newCap" title="Create a Fabric capacity" @close="newCap = false">
      <div v-if="error" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ error }}</span></div>
      <div class="fx-field"><label for="ad-cname">Capacity name<span class="fx-field__req">*</span></label>
        <input id="ad-cname" v-model="capName" class="fx-input" /></div>
      <div class="fx-field"><span class="fx-field__label">Size</span>
        <select v-model="capSku" class="fx-select" aria-label="Size"><option v-for="s in skus" :key="s" :value="s">{{ s }}</option></select></div>
      <div class="fx-field"><span class="fx-field__label">Region</span>
        <select v-model="capRegion" class="fx-select" aria-label="Region"><option>West Europe</option><option>North Europe</option><option>UAE North</option><option>East US</option></select></div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!capName.trim()" @click="createCap">Create</button>
        <button type="button" class="fx-btn" @click="newCap = false">Cancel</button>
      </template>
    </FxPanel>

    <FxModal v-if="resize" :title="'Change size - ' + resize.name" @close="resize = null">
      <div v-if="error" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ error }}</span></div>
      <div class="fx-field"><span class="fx-field__label">Capacity size</span>
        <select v-model="resizeSku" class="fx-select" aria-label="Capacity size"><option v-for="s in skus" :key="s" :value="s">{{ s }}</option></select>
        <span class="fx-field__help">Resizing takes effect immediately; utilization smoothing restarts on the new size.</span></div>
      <div class="fx-field"><label for="ad-surge">Surge protection - reject background jobs above (%)</label>
        <input id="ad-surge" v-model.number="surge" class="fx-input" type="number" min="0" max="100" /></div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" @click="doResize">Save</button>
        <button type="button" class="fx-btn" @click="resize = null">Cancel</button>
      </template>
    </FxModal>

    <FxPanel v-if="conn" :title="conn.edit ? 'Settings - ' + conn.name : 'New connection'" @close="conn = null">
      <div v-if="error" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ error }}</span></div>
      <div class="fx-field"><label for="ad-conname">Connection name<span class="fx-field__req">*</span></label>
        <input id="ad-conname" v-model="conn.name" class="fx-input" :disabled="conn.edit" /></div>
      <div class="fx-field"><span class="fx-field__label">Connection type</span>
        <select v-model="conn.type" class="fx-select" :disabled="conn.edit" aria-label="Connection type"><option>ServiceNow</option><option>AzureDataLakeStorage</option><option>SQL</option></select></div>
      <div class="fx-field"><label for="ad-server">Instance / server</label>
        <input id="ad-server" v-model="conn.server" class="fx-input" :disabled="conn.edit" placeholder="acmepay.service-now.com" /></div>
      <div class="fx-field"><span class="fx-field__label">Authentication method</span>
        <select v-model="conn.auth" class="fx-select" aria-label="Authentication method"><option v-for="a in authTypes" :key="a">{{ a }}</option></select></div>
      <div v-if="conn.auth === 'Basic'" class="fx-field"><label for="ad-user">Username</label>
        <input id="ad-user" v-model="conn.username" class="fx-input" /></div>
      <div v-if="conn.auth !== 'WorkspaceIdentity'" class="fx-field"><span class="fx-field__label">Secret</span>
        <select v-model="conn.secret" class="fx-select" aria-label="Secret"><option value="">(none)</option>
          <option v-for="s in vaultSecrets" :key="s" :value="s">Azure Key Vault: {{ s }}</option></select>
        <span class="fx-field__help">Reference a Key Vault secret rather than storing a password in the connection.</span></div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!conn.name.trim()" @click="saveConn">{{ conn.edit ? 'Save' : 'Create' }}</button>
        <button type="button" class="fx-btn" @click="conn = null">Cancel</button>
      </template>
    </FxPanel>

    <FxModal v-if="askRemoveConn" :title="'Remove ' + askRemoveConn + '?'" @close="askRemoveConn = ''">
      <p class="ad-p">Pipelines and notebooks that use this connection will fail.</p>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--danger" @click="removeConn">Remove</button>
        <button type="button" class="fx-btn" @click="askRemoveConn = ''">Cancel</button>
      </template>
    </FxModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FxIcon from './FxIcon.vue';
import FxModal from './FxModal.vue';
import FxPanel from './FxPanel.vue';
import FxGrid from './FxGrid.vue';
import { cli, errorText, gridsOf, messagesOf, rows, useFabric, type Grid } from './fabric';

const { portal, view, route, go, run } = useFabric();
const tabs = [
  { id: 'capacities', label: 'Capacity settings' },
  { id: 'connections', label: 'Manage connections and gateways' },
  { id: 'audit', label: 'Audit logs' },
];
const tab = computed(() => tabs.some(t => t.id === route.value.tab) ? String(route.value.tab) : 'capacities');
const title = computed(() => tab.value === 'connections' ? 'Manage connections and gateways' : 'Admin portal');
function setTab(id: string) { error.value = ''; go({ page: 'admin', tab: id }); }
const error = ref('');
const capacities = computed(() => rows(view.value, 'capacities'));
const connections = computed(() => rows(view.value, 'connections'));
const audit = computed(() => [...rows(view.value, 'audit')].reverse());
const skus = computed(() => (portal.value.skus as string[]) || ['F2', 'F4', 'F8', 'F16', 'F32', 'F64']);
const vaultSecrets = computed(() => (portal.value.vault_secrets as string[]) || []);
const authTypes = ['Basic', 'OAuth2', 'ServicePrincipal', 'WorkspaceIdentity'];
function regionOf(name: string) { return rows(portal.value, 'capacities').find(c => c.name === name)?.region || '—'; }
function detailOf(name: string) { return rows(portal.value, 'connections').find(c => c.name === name) || {}; }

async function exec(command: string, success: string) {
  error.value = '';
  const r = await run(command, success, { quiet: true });
  if (!r.ok) error.value = errorText(r);
  return r;
}

const capPath = (name: string) => `.capacities/${name}.Capacity`;
async function pauseCap(name: string) { await exec(cli(['fab', 'stop', capPath(name)]), `Capacity ${name} paused`); }
async function resume(name: string) { await exec(cli(['fab', 'start', capPath(name)]), `Capacity ${name} resumed`); }

const newCap = ref(false);
const capName = ref('cap-ops-new');
const capSku = ref('F2');
const capRegion = ref('West Europe');
async function createCap() {
  if ((await exec(cli(['fab', 'mkdir', capPath(capName.value.trim())], { '-P': `sku=${capSku.value},region=${capRegion.value}` }),
    `Capacity ${capName.value.trim()} created`)).ok) newCap.value = false;
}

const resize = ref<Record<string, any> | null>(null);
const resizeSku = ref('F8');
const surge = ref(0);
function openResize(c: Record<string, any>) { error.value = ''; resize.value = c; resizeSku.value = c.sku; surge.value = Number(c.surge_limit || 0); }
async function doResize() {
  const c = resize.value;
  if (!c) return;
  if (resizeSku.value !== c.sku && !(await exec(cli(['fab', 'set', capPath(c.name)], { '-q': 'sku', '-i': resizeSku.value }), `${c.name} resized to ${resizeSku.value}`)).ok) return;
  if (surge.value !== Number(c.surge_limit || 0) && !(await exec(cli(['fab', 'set', capPath(c.name)], { '-q': 'surgeProtection', '-i': String(surge.value) }), 'Surge protection saved')).ok) return;
  resize.value = null;
}

const metrics = ref<{ name: string; grids: Grid[]; text: string } | null>(null);
async function openMetrics(name: string) {
  const r = await exec(cli(['fab', 'capacity', 'metrics', name], { '--hours': '24' }), '');
  if (r.ok) metrics.value = { name, grids: gridsOf(r), text: messagesOf(r).join('\n') };
}

const conn = ref<null | { edit: boolean; name: string; type: string; server: string; auth: string; username: string; secret: string;
  orig: Record<string, any> }>(null);
function openConn(c: Record<string, any> | null) {
  error.value = '';
  const d = c ? detailOf(c.name) : {};
  conn.value = { edit: Boolean(c), name: c?.name || 'conn_servicenow_oauth', type: c?.type || 'ServiceNow',
    server: d.server || 'acmepay.service-now.com', auth: c?.auth || 'OAuth2', username: d.username || '',
    secret: d.secret_ref || vaultSecrets.value[0] || '', orig: { ...d, auth: c?.auth } };
}
async function saveConn() {
  const c = conn.value;
  if (!c) return;
  const path = `.connections/${c.name.trim()}.Connection`;
  if (!c.edit) {
    const props = [`connectionDetails.type=${c.type}`, `connectionDetails.parameters.instance=${c.server}`,
      `credentialDetails.type=${c.auth}`];
    if (c.username) props.push(`credentialDetails.username=${c.username}`);
    if (c.secret && c.auth !== 'WorkspaceIdentity') props.push(`credentialDetails.keyVaultReference=${c.secret}`);
    if ((await exec(cli(['fab', 'mkdir', path], { '-P': props.join(',') }), `Connection ${c.name.trim()} created`)).ok) conn.value = null;
    return;
  }
  if (c.auth !== c.orig.auth && !(await exec(cli(['fab', 'set', path], { '-q': 'credentialDetails.type', '-i': c.auth }), 'Authentication method saved')).ok) return;
  if (c.username !== (c.orig.username || '') && c.username && !(await exec(cli(['fab', 'set', path], { '-q': 'credentialDetails.username', '-i': c.username }), 'Username saved')).ok) return;
  if (c.secret && c.secret !== (c.orig.secret_ref || '') && !(await exec(cli(['fab', 'set', path], { '-q': 'credentialDetails.keyVaultReference', '-i': c.secret }), 'Key Vault reference saved')).ok) return;
  conn.value = null;
}
const askRemoveConn = ref('');
async function removeConn() {
  if ((await exec(cli(['fab', 'rm', `.connections/${askRemoveConn.value}.Connection`, '-f']), `Connection ${askRemoveConn.value} removed`)).ok) askRemoveConn.value = '';
}
</script>

<style scoped>
.ad-nav { width: 240px; flex: none; padding: 4px 8px; border-right: 1px solid #e0e0e0; overflow: auto; }
.ad-nav button { display: block; width: 100%; padding: 8px 12px; border: 0; border-radius: 4px; background: transparent; text-align: left; font: 14px "Segoe UI", sans-serif; cursor: pointer; color: #242424; }
.ad-nav button:hover { background: #f0f0f0; }
.ad-nav button.is-active { background: #e6f2ef; font-weight: 600; }
.ad-bar { padding: 8px 16px; }
.ad-note { font-size: 12px; }
.ad-msg { margin: 8px 16px 0; }
.ad-table { min-width: 960px; }
.ad-actions { display: flex; gap: 6px; align-items: center; height: 44px; }
.ad-ws { max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
.ad-meter { display: inline-block; width: 60px; height: 6px; border-radius: 3px; background: #ebebeb; overflow: hidden; vertical-align: middle; }
.ad-meter span { display: block; height: 100%; }
.ad-metrics { padding: 0 16px 16px; }
.ad-pre { font: 12px Consolas, monospace; white-space: pre-wrap; color: #424242; }
.ad-p { margin: 0 0 8px; }
@container sl-portal (max-width: 700px) {
  .ad-nav { width: auto; display: flex; border-right: 0; border-bottom: 1px solid #e0e0e0; overflow-x: auto; }
  .ad-nav button { white-space: nowrap; width: auto; }
}
</style>
