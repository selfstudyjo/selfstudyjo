<template>
  <div>
    <div class="az-cmdbar">
      <button type="button" class="az-cmd" @click="openAdd"><AzIcon name="plus" /> Add role assignment</button>
      <button type="button" class="az-cmd az-cmd--danger" :disabled="!selected.length" @click="removeSelected">
        <AzIcon name="trash" /> Remove</button>
      <span class="az-cmdsep"></span>
      <button type="button" class="az-cmd" @click="az.refresh()"><AzIcon name="refresh" /> Refresh</button>
    </div>
    <div class="az-tabs" role="tablist">
      <button v-for="t in tabs" :key="t" type="button" class="az-tab" :class="{ 'is-active': tab === t }"
              role="tab" @click="tab = t">{{ t }}</button>
    </div>

    <template v-if="tab === 'Check access'">
      <div class="az-cards" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))">
        <div class="az-card">
          <h3>Check access</h3>
          <p class="az-muted">Review the level of access a user, group, service principal, or managed identity has
            to this resource.</p>
          <div class="az-field"><div class="az-field__label">Principal</div>
            <div class="az-field__ctl"><select v-model="check.who" class="az-select">
              <option value="">Select a principal</option>
              <option v-for="pr in principals" :key="pr.id" :value="pr.name">{{ pr.name }} ({{ pr.kind }})</option>
            </select></div></div>
          <div class="az-field"><div class="az-field__label">Action</div>
            <div class="az-field__ctl"><input v-model="check.action" class="az-input" list="az-actions"
                   placeholder="Microsoft.Storage/storageAccounts/write" />
              <datalist id="az-actions">
                <option v-for="a in ACTIONS" :key="a" :value="a" />
              </datalist></div></div>
          <button type="button" class="az-btn az-btn--primary" :disabled="!check.who || !check.action" @click="runCheck">Check access</button>
        </div>
        <div class="az-card">
          <h3>View my access</h3>
          <p class="az-muted">View the role assignments and deny assignments for your account on this scope.</p>
          <p>You (<b>{{ az.p.value.account?.user }}</b>) are <b>Owner</b> of the subscription.</p>
        </div>
      </div>
      <div v-if="checkOut" class="az-banner" :class="checkOk ? 'is-success' : 'is-error'" style="margin-top: 12px">
        <AzIcon :name="checkOk ? 'ok' : 'error'" /><pre class="az-checkout">{{ checkOut }}</pre></div>
    </template>

    <template v-else-if="tab === 'Role assignments'">
      <div class="az-filters">
        <input v-model="needle" class="az-filter" placeholder="Search by name" aria-label="Search role assignments" />
        <span class="az-pill">Type : <b>All</b></span><span class="az-pill">Role : <b>All</b></span>
        <span class="az-pill">Scope : <b>All scopes</b></span>
      </div>
      <div class="az-count">{{ assigned.length }} items ({{ assigned.filter(a => a.kind === 'User').length }} Users,
        {{ assigned.filter(a => a.kind === 'Group').length }} Groups,
        {{ assigned.filter(a => a.kind !== 'User' && a.kind !== 'Group').length }} Service Principals / Managed identities)</div>
      <AzTable v-model:selected="selected" :columns="cols" :rows="assigned" row-key="key" selectable>
        <template #cell-principal="{ row }">
          <span class="az-namecell"><AzIcon :name="row.kind === 'ManagedIdentity' ? 'identity' : 'entra'" />
            {{ row.principal }}</span></template>
        <template #cell-where="{ row }">
          <span :class="{ 'az-muted': row.where !== 'This resource' }">{{ row.where }}</span></template>
        <template #empty>No role assignments at this scope.</template>
      </AzTable>
    </template>

    <template v-else-if="tab === 'Roles'">
      <AzTable :columns="roleCols" :rows="roles" row-key="name">
        <template #cell-name="{ row }"><button type="button" class="az-link" @click="showRole(row.name)"><b>{{ row.name }}</b></button></template>
      </AzTable>
      <AzPane v-if="roleOut" :title="roleOut.name" subtitle="Built-in role" @close="roleOut = null">
        <h3 class="az-section-title">Permissions</h3>
        <pre class="az-code">{{ roleOut.text }}</pre>
        <template #foot><button type="button" class="az-btn" @click="roleOut = null">Close</button></template>
      </AzPane>
    </template>

    <template v-else>
      <div class="az-cmdbar"><button type="button" class="az-cmd" @click="openDeny"><AzIcon name="plus" /> Add deny assignment</button></div>
      <AzTable :columns="denyCols" :rows="denies" row-key="key">
        <template #empty>No deny assignments. Deny assignments are created by Azure managed applications and
          Blueprints, and they override every role assignment.</template>
      </AzTable>
    </template>

    <AzPane v-if="denying" title="Add deny assignment" :subtitle="scopeName" :error="addError" @close="denying = false">
      <div class="az-banner is-warning"><AzIcon name="warning" /><span>In Azure, deny assignments are created by Blueprints and managed
        applications rather than by hand. They override every role assignment, including Owner.</span></div>
      <div class="az-field"><div class="az-field__label">Name <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="deny.name" class="az-input" /></div></div>
      <div class="az-field"><div class="az-field__label">Principal <span class="az-req">*</span></div>
        <div class="az-field__ctl"><select v-model="deny.who" class="az-select"><option value="">Select</option>
          <option v-for="pr in principals" :key="pr.id" :value="pr.name">{{ pr.name }} ({{ pr.kind }})</option></select></div></div>
      <div class="az-field"><div class="az-field__label">Denied actions <span class="az-req">*</span></div>
        <div class="az-field__ctl"><input v-model="deny.actions" class="az-input" placeholder="*/delete" /></div></div>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!deny.name || !deny.who || !deny.actions" @click="createDeny">Create</button>
        <button type="button" class="az-btn" @click="denying = false">Cancel</button>
      </template>
    </AzPane>

    <!-- Add role assignment wizard -->
    <AzPane v-if="adding" title="Add role assignment" :subtitle="scopeName" :error="addError" @close="adding = false">
      <div class="az-tabs">
        <button v-for="(t, i) in ['Role', 'Members', 'Review + assign']" :key="t" type="button" class="az-tab"
                :class="{ 'is-active': step === i }" @click="step = i">{{ t }}</button>
      </div>
      <template v-if="step === 0">
        <p class="az-intro">A role definition is a collection of permissions. You can use the built-in roles or create your own.</p>
        <input v-model="roleNeedle" class="az-input" placeholder="Search by role name or description" style="margin-bottom: 8px" />
        <div class="az-rolelist">
          <label v-for="r in roles.filter(r => !roleNeedle || r.name.toLowerCase().includes(roleNeedle.toLowerCase()))"
                 :key="r.name" class="az-roleitem" :class="{ 'is-on': form.role === r.name }">
            <input v-model="form.role" type="radio" name="az-role" :value="r.name" />
            <span><b>{{ r.name }}</b><br /><span class="az-muted">{{ r.note }}</span></span>
          </label>
        </div>
      </template>
      <template v-else-if="step === 1">
        <div class="az-field"><div class="az-field__label">Assign access to</div>
          <div class="az-radios">
            <label class="az-radio"><input v-model="form.type" type="radio" value="user" /> User, group, or service principal</label>
            <label class="az-radio"><input v-model="form.type" type="radio" value="mi" /> Managed identity</label>
          </div></div>
        <div class="az-field"><div class="az-field__label">Members <span class="az-req">*</span></div>
          <div class="az-field__ctl"><select v-model="form.who" class="az-select">
            <option value="">+ Select members</option>
            <option v-for="pr in principals.filter(x => form.type === 'mi' ? x.kind === 'ManagedIdentity' : x.kind !== 'ManagedIdentity')"
                    :key="pr.id" :value="pr.name">{{ pr.name }} — {{ pr.kind }}</option>
          </select></div></div>
        <div class="az-field"><div class="az-field__label">Description</div>
          <div class="az-field__ctl"><input v-model="form.description" class="az-input" placeholder="Optional" /></div></div>
      </template>
      <template v-else>
        <div class="az-kv"><span>Role</span><span>{{ form.role || '—' }}</span></div>
        <div class="az-kv"><span>Scope</span><span class="az-mono">{{ scope }}</span></div>
        <div class="az-kv"><span>Members</span><span>{{ form.who || '—' }}</span></div>
        <div class="az-kv"><span>Description</span><span>{{ form.description || 'No description' }}</span></div>
      </template>
      <template #foot>
        <button v-if="step < 2" type="button" class="az-btn az-btn--primary" @click="step++">Next</button>
        <button v-else type="button" class="az-btn az-btn--primary" :disabled="!form.role || !form.who" @click="assign">Review + assign</button>
        <button v-if="step > 0" type="button" class="az-btn" @click="step--">Previous</button>
        <button type="button" class="az-btn" @click="adding = false">Cancel</button>
      </template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/** Access control (IAM) at any scope: management group, subscription, group or resource. */
import { computed, reactive, ref } from 'vue';
import { cli, errorText, matches, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTable from './AzTable.vue';
import { useAz } from './azure';

const props = defineProps<{ scope: string; scopeName: string }>();
const az = useAz();
const tabs = ['Check access', 'Role assignments', 'Roles', 'Deny assignments'];
const tab = ref('Role assignments');
const needle = ref('');
const selected = ref<string[]>([]);

const ACTIONS = [
  'Microsoft.Storage/storageAccounts/write', 'Microsoft.Storage/storageAccounts/delete',
  'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read',
  'Microsoft.KeyVault/vaults/secrets/getSecret/action', 'Microsoft.Network/virtualNetworks/write',
  'Microsoft.Network/azureFirewalls/delete', 'Microsoft.Compute/virtualMachines/start/action',
  'Microsoft.Authorization/roleAssignments/write', 'Microsoft.Resources/subscriptions/resourceGroups/read',
];

const principals = computed(() => rows(az.p.value, 'principals'));
const roles = computed(() => rows(az.p.value, 'role_definitions'));

/** The chain of scopes above this one that an assignment can be inherited from. */
const chain = computed(() => {
  const p = az.p.value;
  const sub = `/subscriptions/${p.account?.subscription}`;
  const groups = rows(p, 'mgmt_groups');
  const subRow = rows(p, 'subscriptions').find(s => String(s.id) === String(p.account?.subscription));
  const out: string[] = [];
  let current = subRow?.mgmt_group || '';
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    out.push(`/providers/Microsoft.Management/managementGroups/${current}`);
    current = groups.find(g => g.name === current)?.parent || '';
  }
  if (props.scope.startsWith('/subscriptions/')) out.push(sub);
  const parts = props.scope.split('/');
  const rgIndex = parts.indexOf('resourceGroups');
  if (rgIndex > 0) out.push(parts.slice(0, rgIndex + 2).join('/'));
  return out;
});
function where(scope: string): string {
  if (scope === props.scope) return 'This resource';
  if (scope.includes('/managementGroups/')) return `${scope.split('/').pop()} (Management group) (Inherited)`;
  if (scope.includes('/resourceGroups/')) return `${scope.split('/resourceGroups/')[1]} (Resource group) (Inherited)`;
  return 'Subscription (Inherited)';
}
const assigned = computed(() => rows(az.p.value, 'role_assignments')
  .filter(a => a.scope === props.scope || chain.value.includes(String(a.scope)))
  .map(a => ({ key: `${a.principal}|${a.role}|${a.scope}`, principal: a.principal, kind: a.principal_kind,
               role: a.role, scope: a.scope, where: where(String(a.scope)) }))
  .filter(a => matches(a, needle.value, ['principal', 'role'])));
const cols = [
  { key: 'principal', label: 'Name' }, { key: 'kind', label: 'Type' },
  { key: 'role', label: 'Role' }, { key: 'where', label: 'Scope' },
];
const roleCols = [{ key: 'name', label: 'Name' }, { key: 'note', label: 'Description', sortable: false }];
const denies = computed(() => rows(az.p.value, 'deny_assignments')
  .map((d, i) => ({ key: String(i), name: d.name, principal: d.principal, actions: (d.actions || []).join(', '),
                    scope: where(String(d.scope)) })));
const denyCols = [{ key: 'name', label: 'Name' }, { key: 'principal', label: 'Principal' },
                  { key: 'actions', label: 'Denied actions' }, { key: 'scope', label: 'Scope' }];

// ----- add -----
const adding = ref(false);
const step = ref(0);
const roleNeedle = ref('');
const addError = ref('');
const form = reactive({ role: '', who: '', type: 'user', description: '' });
function openAdd() {
  Object.assign(form, { role: '', who: '', type: 'user', description: '' });
  step.value = 0;
  addError.value = '';
  adding.value = true;
}
async function assign() {
  const result = await az.run(cli(['az', 'role', 'assignment', 'create'],
                                  { '--assignee': form.who, '--role': form.role, '--scope': props.scope }),
                              `Added role assignment: ${form.who} was added as ${form.role} for ${props.scopeName}.`,
                              { quiet: true });
  if (!result.ok) { addError.value = errorText(result); return; }
  adding.value = false;
  tab.value = 'Role assignments';
}

async function removeSelected() {
  const items = assigned.value.filter(a => selected.value.includes(a.key));
  const inherited = items.filter(a => a.scope !== props.scope);
  if (inherited.length) {
    az.note('error', 'Cannot remove inherited role assignments',
            'Inherited assignments must be removed at the scope where they were assigned.');
    return;
  }
  const ok = await az.confirm({ title: 'Remove role assignments',
                                message: 'Do you want to remove the selected role assignments?',
                                items: items.map(a => `${a.principal} — ${a.role}`), confirmLabel: 'Yes', danger: false });
  if (!ok) return;
  for (const a of items) {
    await az.run(cli(['az', 'role', 'assignment', 'delete'], { '--assignee': a.principal, '--role': a.role, '--scope': a.scope }),
                 `Removed role assignment for ${a.principal}`);
  }
  selected.value = [];
}

// ----- roles and deny assignments -----
const roleOut = ref<{ name: string; text: string } | null>(null);
async function showRole(name: string) {
  const result = await az.run(cli(['az', 'role', 'definition', 'show'], { '--name': name }), '', { quiet: true });
  roleOut.value = { name, text: String(result.ok ? result.output : result.error || '').trim() };
}
const denying = ref(false);
const deny = reactive({ name: 'deny-delete', who: '', actions: '*/delete' });
function openDeny() { Object.assign(deny, { name: 'deny-delete', who: '', actions: '*/delete' }); addError.value = ''; denying.value = true; }
async function createDeny() {
  const result = await az.run(cli(['az', 'role', 'assignment', 'create-deny'], { '--name': deny.name, '--assignee': deny.who,
                                  '--actions': deny.actions, '--scope': props.scope }), `Created deny assignment '${deny.name}'`, { quiet: true });
  if (!result.ok) { addError.value = errorText(result); return; }
  denying.value = false;
}

// ----- check access -----
const check = reactive({ who: '', action: ACTIONS[0] });
const checkOut = ref('');
const checkOk = ref(false);
async function runCheck() {
  const result = await az.api.exec(cli(['az', 'role', 'assignment', 'check'],
                                       { '--assignee': check.who, '--action': check.action, '--scope': props.scope }),
                                   { quiet: true });
  checkOk.value = result.ok;
  checkOut.value = String(result.ok ? result.output : result.error || result.output || '').trim();
}
</script>

<style scoped>
.az-checkout { margin: 0; white-space: pre-wrap; font: 12px Consolas, monospace; color: #242424; background: none; }
.az-rolelist { display: flex; flex-direction: column; gap: 4px; }
.az-roleitem { display: flex; gap: 10px; align-items: flex-start; padding: 8px; border-radius: 4px; cursor: pointer;
  border: 1px solid transparent; }
.az-roleitem:hover { background: #f5f5f5; }
.az-roleitem.is-on { background: #ebf3fc; border-color: #b4d6fa; }
.az-roleitem input { margin-top: 3px; accent-color: #0f6cbd; }
</style>
