<template>
  <div class="az-split">
    <nav class="az-svcmenu" aria-label="Microsoft Entra ID menu">
      <template v-for="item in MENU" :key="item.key">
        <div v-if="item.group" class="az-svcmenu__group">{{ item.label }}</div>
        <button v-else type="button" class="az-svcmenu__item" :class="{ 'is-active': tab === item.key }" @click="emit('tab', item.key)">
          <AzIcon :name="item.icon || 'entra'" /> {{ item.label }}</button>
      </template>
    </nav>
    <div class="az-content">
      <template v-if="tab === 'overview'">
        <h3 class="az-section-title">Basic information</h3>
        <div class="az-kv"><span>Name</span><span>{{ acct.directory }}</span></div>
        <div class="az-kv"><span>Tenant ID</span><span class="az-mono">{{ acct.tenant }}</span></div>
        <div class="az-kv"><span>Primary domain</span><span>{{ acct.domain }}</span></div>
        <div class="az-kv"><span>License</span><span>Microsoft Entra ID Free</span></div>
        <div class="az-kv"><span>Users</span><span>{{ list('User').length + 1 }}</span></div>
        <div class="az-kv"><span>Groups</span><span>{{ list('Group').length }}</span></div>
        <div class="az-kv"><span>Applications</span><span>{{ list('ServicePrincipal').length }}</span></div>
      </template>
      <template v-else>
        <div class="az-cmdbar">
          <button type="button" class="az-cmd" @click="openCreate"><AzIcon name="plus" /> {{ createLabel }}</button>
          <button type="button" class="az-cmd" @click="refreshList"><AzIcon name="refresh" /> Refresh</button>
          <button type="button" class="az-cmd az-cmd--danger" :disabled="!selected.length" @click="remove"><AzIcon name="trash" /> Delete</button>
        </div>
        <div class="az-filters"><input v-model="needle" class="az-filter" placeholder="Search" /></div>
        <AzTable v-model:selected="selected" :columns="cols" :rows="shown" row-key="id" selectable>
          <template #cell-name="{ row }"><span class="az-namecell"><span class="az-avatar">{{ initials(row.name) }}</span> {{ row.name }}</span></template>
          <template #empty>No {{ tabLabel.toLowerCase() }} found.</template>
        </AzTable>
      </template>
    </div>

    <AzPane v-if="creating" :title="createLabel" :error="error" @close="creating = false">
      <template v-if="kind === 'User'">
        <div class="az-field"><div class="az-field__label">User principal name <span class="az-req">*</span></div>
          <div class="az-field__ctl"><input v-model="form.upn" class="az-input" placeholder="alex" /><div class="az-help">@{{ acct.domain }}</div></div></div>
        <div class="az-field"><div class="az-field__label">Display name <span class="az-req">*</span></div>
          <div class="az-field__ctl"><input v-model="form.name" class="az-input" /></div></div>
        <div class="az-field"><div class="az-field__label">Password <span class="az-req">*</span></div>
          <div class="az-field__ctl"><input v-model="form.password" class="az-input" type="password" /></div></div>
      </template>
      <template v-else>
        <div class="az-field"><div class="az-field__label">{{ kind === 'Group' ? 'Group name' : 'Name' }} <span class="az-req">*</span></div>
          <div class="az-field__ctl"><input v-model="form.name" class="az-input" /></div></div>
        <div v-if="kind === 'Group'" class="az-field"><div class="az-field__label">Group type</div><div class="az-field__ctl">Security</div></div>
      </template>
      <template #foot>
        <button type="button" class="az-btn az-btn--primary" :disabled="!form.name || (kind === 'User' && (!form.upn || form.password.length < 8))" @click="create">Create</button>
        <button type="button" class="az-btn" @click="creating = false">Cancel</button>
      </template>
    </AzPane>
  </div>
</template>

<script setup lang="ts">
/** Microsoft Entra ID: users, groups and enterprise applications (service principals). */
import { computed, reactive, ref, watch } from 'vue';
import { cli, errorText, matches, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import AzTable from './AzTable.vue';
import { useAz } from './azure';

const props = defineProps<{ tab: string }>();
const emit = defineEmits<{ (event: 'tab', tab: string): void }>();
const az = useAz();
const MENU = [
  { key: 'overview', label: 'Overview', icon: 'entra' }, { key: 'g', label: 'Manage', group: true },
  { key: 'users', label: 'Users', icon: 'iam' }, { key: 'groups', label: 'Groups', icon: 'iam' },
  { key: 'apps', label: 'Enterprise applications', icon: 'allservices' },
];
const acct = computed(() => az.p.value.account || {});
const kind = computed(() => ({ users: 'User', groups: 'Group', apps: 'ServicePrincipal' } as Record<string, string>)[props.tab] || 'User');
const word = computed(() => ({ User: 'user', Group: 'group', ServicePrincipal: 'sp' } as Record<string, string>)[kind.value]);
const tabLabel = computed(() => MENU.find(m => m.key === props.tab)?.label || '');
const createLabel = computed(() => ({ User: 'New user', Group: 'New group', ServicePrincipal: 'New application' } as Record<string, string>)[kind.value]);
function list(k: string) { return rows(az.p.value, 'principals').filter(p => p.kind === k); }
const needle = ref('');
const selected = ref<string[]>([]);
const shown = computed(() => list(kind.value).map((p): Record<string, any> => ({ ...p, type: kind.value === 'ServicePrincipal' ? 'Enterprise Application' : kind.value === 'Group' ? 'Security' : 'Member',
  roles: rows(az.p.value, 'role_assignments').filter(a => a.principal === p.name).length }))
  .filter(p => matches(p, needle.value, ['name', 'id'])));
const cols = [{ key: 'name', label: 'Display name' }, { key: 'id', label: 'Object ID' }, { key: 'type', label: 'Type' }, { key: 'roles', label: 'Role assignments' }];
function initials(name: string) { return String(name).split(/[-\s_]/).map(x => x[0]).join('').slice(0, 2).toUpperCase(); }
watch(() => props.tab, () => { selected.value = []; });
async function refreshList() { await az.run(cli(['az', 'ad', word.value, 'list']), '', { quiet: true }); }

const creating = ref(false);
const error = ref('');
const form = reactive({ name: '', upn: '', password: '' });
function openCreate() { Object.assign(form, { name: '', upn: '', password: '' }); error.value = ''; creating.value = true; }
async function create() {
  const flags: Record<string, any> = { '--display-name': form.name };
  if (kind.value === 'User') { flags['--user-principal-name'] = `${form.upn}@${acct.value.domain}`; flags['--password'] = form.password; }
  if (kind.value === 'Group') flags['--mail-nickname'] = form.name.replace(/\s/g, '');
  const r = await az.run(cli(['az', 'ad', word.value, 'create'], flags), `Created ${kind.value === 'ServicePrincipal' ? 'application' : kind.value.toLowerCase()} '${form.name}'`, { quiet: true });
  if (!r.ok) { error.value = errorText(r); return; }
  creating.value = false;
}
async function remove() {
  const items = shown.value.filter(p => selected.value.includes(String(p.id)));
  if (!(await az.confirm({ title: `Delete ${kind.value === 'ServicePrincipal' ? 'applications' : kind.value.toLowerCase() + 's'}`, message: 'Delete the selected objects? Their role assignments are removed with them.', items: items.map(i => i.name), confirmLabel: 'OK', danger: true }))) return;
  for (const p of items) {
    await az.run(cli(['az', 'ad', word.value, 'delete'], kind.value === 'Group' ? { '--group': p.name } : { '--id': p.id }), `Deleted '${p.name}'`);
  }
  selected.value = [];
}
</script>

<style scoped>
.az-avatar { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #c7e0f4; color: #0f548c; font-size: 10px; font-weight: 600; }
</style>
