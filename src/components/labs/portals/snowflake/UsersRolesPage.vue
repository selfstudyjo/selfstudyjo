<template>
  <div class="sf-page">
    <div class="sf-crumbs" v-if="detailName">
      <button type="button" @click="sf.go({ page: 'users-roles', tab })">{{ tab === 'roles' ? 'Roles' : 'Users' }}</button><SfIcon name="chevron-right" /><span>{{ detailName }}</span>
    </div>
    <div class="sf-page-head">
      <h1 class="sf-h1">{{ detailName || 'Users & Roles' }}</h1>
      <span class="sf-spacer"></span>
      <template v-if="!detailName">
        <button v-if="tab === 'users'" type="button" class="sf-btn sf-btn--primary" @click="sf.create('user')"><SfIcon name="plus" /> User</button>
        <template v-else>
          <button type="button" class="sf-btn" @click="grantRole = {}"><SfIcon name="key" /> Grant role</button>
          <button type="button" class="sf-btn sf-btn--primary" @click="sf.create('role')"><SfIcon name="plus" /> Role</button>
        </template>
      </template>
    </div>

    <!-- ===== A user ===== -->
    <template v-if="tab === 'users' && user">
      <div class="ur__actions">
        <button type="button" class="sf-btn" @click="editUser(user.name)"><SfIcon name="edit" /> Edit</button>
        <button type="button" class="sf-btn" @click="grantRole = { toUser: user.name }"><SfIcon name="key" /> Grant role</button>
        <button type="button" class="sf-btn" @click="toggleUser(user.name, !user.disabled)">{{ user.disabled ? 'Enable' : 'Disable' }} user</button>
      </div>
      <dl class="sf-kv sf-card">
        <dt>Login name</dt><dd>{{ user.login_name || user.name }}</dd>
        <dt>Email</dt><dd>{{ user.email || '—' }}</dd>
        <dt>Default role</dt><dd>{{ user.default_role || 'PUBLIC' }}</dd>
        <dt>Default warehouse</dt><dd>{{ user.default_warehouse || '—' }}</dd>
        <dt>Status</dt><dd>{{ user.disabled ? 'Disabled' : 'Enabled' }}</dd>
      </dl>
      <h2 class="sf-h3">Granted roles</h2>
      <div class="sf-table-wrap">
        <table class="sf-table">
          <thead><tr><th>Role</th><th class="sf-actions"></th></tr></thead>
          <tbody>
            <tr v-for="r in rolesOfUser(user.name)" :key="r">
              <td><button type="button" class="sf-link sf-cell-name" @click="sf.go({ page: 'users-roles', tab: 'roles', name: r })"><SfIcon name="role" />{{ r }}</button></td>
              <td class="sf-actions"><button type="button" class="sf-btn sf-btn--ghost sf-btn--sm" @click="revokeRole(r, 'USER', user.name)">Revoke</button></td>
            </tr>
            <tr v-if="!rolesOfUser(user.name).length"><td colspan="2"><div class="sf-empty">No roles granted</div></td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ===== A role ===== -->
    <template v-else-if="tab === 'roles' && role">
      <div class="ur__actions">
        <button type="button" class="sf-btn" @click="grantRole = { grantRole: role.name }"><SfIcon name="key" /> Grant to role or user</button>
        <button type="button" class="sf-btn" @click="grantPriv = true"><SfIcon name="plus" /> Grant privilege</button>
        <button v-if="!SYSTEM.includes(role.name)" type="button" class="sf-btn sf-btn--icon" aria-label="Drop role" title="Drop role" @click="dropRole(role.name)"><SfIcon name="trash" /></button>
      </div>
      <div class="ur__cols">
        <section class="sf-card">
          <h2 class="sf-h3">Granted to</h2>
          <ul class="ur__list">
            <li v-for="g in parentsOf(role.name)" :key="g.type + g.name">
              <SfIcon :name="g.type === 'USER' ? 'user' : 'role'" /><span>{{ g.name }}</span><span class="sf-muted sf-small">{{ g.type.toLowerCase() }}</span>
              <span class="sf-spacer"></span>
              <button type="button" class="sf-btn sf-btn--ghost sf-btn--sm" @click="revokeRole(role.name, g.type, g.name)">Revoke</button>
            </li>
            <li v-if="!parentsOf(role.name).length" class="sf-muted">Not granted to any role or user</li>
          </ul>
        </section>
        <section class="sf-card">
          <h2 class="sf-h3">Inherits from</h2>
          <ul class="ur__list">
            <li v-for="c in childrenOf(role.name)" :key="c"><SfIcon name="role" />
              <button type="button" class="sf-link" @click="sf.go({ page: 'users-roles', tab: 'roles', name: c })">{{ c }}</button></li>
            <li v-if="!childrenOf(role.name).length" class="sf-muted">No roles granted to this role</li>
          </ul>
        </section>
      </div>
      <h2 class="sf-h3">Privileges</h2>
      <GrantsTable :to-role="role.name" />
      <GrantDialog v-if="grantPriv" mode="privilege" :to-role="role.name" @close="grantPriv = false" />
    </template>

    <!-- ===== Lists ===== -->
    <template v-else>
      <div class="sf-tabs">
        <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'users' }" @click="sf.go({ page: 'users-roles', tab: 'users' })">Users</button>
        <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'roles' }" @click="sf.go({ page: 'users-roles', tab: 'roles' })">Roles</button>
      </div>

      <div v-if="tab === 'users'" class="sf-table-wrap">
        <table class="sf-table">
          <thead><tr><th>User name</th><th>Login name</th><th>Default role</th><th>Default warehouse</th><th>Status</th><th class="sf-actions"></th></tr></thead>
          <tbody>
            <tr v-for="u in users" :key="u.name" class="is-clickable" @click="sf.go({ page: 'users-roles', tab: 'users', name: u.name })">
              <td><span class="sf-cell-name"><span class="ur__avatar">{{ initials(u.name) }}</span><b>{{ u.name }}</b></span></td>
              <td class="sf-muted">{{ u.login_name || u.name }}</td>
              <td>{{ u.default_role || 'PUBLIC' }}</td>
              <td class="sf-muted">{{ u.default_warehouse || '—' }}</td>
              <td><span class="sf-badge" :class="u.disabled ? 'sf-badge--bad' : 'sf-badge--ok'">{{ u.disabled ? 'Disabled' : 'Enabled' }}</span></td>
              <td class="sf-actions sf-rel" @click.stop>
                <button type="button" class="sf-btn sf-btn--ghost sf-btn--icon sf-btn--sm" :aria-label="'Actions for ' + u.name" @click="menu = menu === u.name ? '' : u.name"><SfIcon name="more" /></button>
                <div v-if="menu === u.name" class="sf-menu ur__menu" @mouseleave="menu = ''">
                  <button type="button" @click="editUser(u.name)"><SfIcon name="edit" /> Edit</button>
                  <button type="button" @click="menu = ''; grantRole = { toUser: u.name }"><SfIcon name="key" /> Grant role</button>
                  <button type="button" @click="toggleUser(u.name, !u.disabled)">{{ u.disabled ? 'Enable' : 'Disable' }}</button>
                  <hr />
                  <button type="button" class="is-danger" :disabled="u.name === me" @click="dropUser(u.name)"><SfIcon name="trash" /> Drop</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template v-else>
        <div class="sf-toolbar">
          <div class="ur__seg">
            <button type="button" :class="{ 'is-on': roleView === 'graph' }" @click="roleView = 'graph'"><SfIcon name="graph" /> Graph</button>
            <button type="button" :class="{ 'is-on': roleView === 'table' }" @click="roleView = 'table'"><SfIcon name="table" /> Table</button>
          </div>
          <span class="sf-muted sf-small">A role inherits every privilege of the roles granted to it.</span>
        </div>
        <div v-if="roleView === 'graph'" class="ur__graph">
          <div class="ur__tree">
            <RoleNode v-for="root in roots" :key="root" :name="root" :children-of="childrenOf" :users-of="usersOf" :depth="0" @open="n => sf.go({ page: 'users-roles', tab: 'roles', name: n })" />
          </div>
        </div>
        <div v-else class="sf-table-wrap">
          <table class="sf-table">
            <thead><tr><th>Role</th><th>Granted to roles</th><th>Granted to users</th><th class="sf-num">Privileges</th><th>Owner</th></tr></thead>
            <tbody>
              <tr v-for="r in roles" :key="r.name" class="is-clickable" @click="sf.go({ page: 'users-roles', tab: 'roles', name: r.name })">
                <td><span class="sf-cell-name"><SfIcon name="role" /><b>{{ r.name }}</b><span v-if="SYSTEM.includes(r.name)" class="sf-badge">System</span></span></td>
                <td class="sf-muted">{{ parentsOf(r.name).filter(g => g.type === 'ROLE').map(g => g.name).join(', ') || '—' }}</td>
                <td class="sf-muted">{{ usersOf(r.name).join(', ') || '—' }}</td>
                <td class="sf-num">{{ privCount(r.name) }}</td>
                <td class="sf-muted">{{ r.owner || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <GrantDialog v-if="grantRole" mode="role" :grant-role="grantRole.grantRole" :to-user="grantRole.toUser" @close="grantRole = null" />
    <PromptDialog v-if="prompt" v-bind="prompt" @close="prompt = null" />
  </div>
</template>

<script setup lang="ts">
/** Admin > Users & Roles: users, the role hierarchy (graph and table), and grants. */
import { computed, ref } from 'vue';
import SfIcon from './SfIcon.vue';
import GrantsTable from './GrantsTable.vue';
import GrantDialog from './GrantDialog.vue';
import PromptDialog, { type PromptField } from './PromptDialog.vue';
import RoleNode from './RoleNode.vue';
import { useSf } from './sfContext';
import { ident, initials, list } from './snowflake';

const sf = useSf();
const SYSTEM = ['ACCOUNTADMIN', 'SECURITYADMIN', 'USERADMIN', 'SYSADMIN', 'ORGADMIN', 'PUBLIC'];
const r = computed(() => (sf.route.value.page === 'users-roles' ? sf.route.value : { page: 'users-roles' as const }));
const tab = computed(() => ((r.value as { tab?: string }).tab === 'roles' ? 'roles' : 'users'));
const detailName = computed(() => (r.value as { name?: string }).name || '');

const users = computed(() => list.users(sf.view.value));
const roles = computed(() => list.roles(sf.view.value));
const me = computed(() => users.value[0]?.name || '');
const user = computed(() => (tab.value === 'users' && detailName.value ? users.value.find(u => u.name === detailName.value) || null : null));
const role = computed(() => (tab.value === 'roles' && detailName.value ? roles.value.find(x => x.name === detailName.value) || null : null));

const menu = ref('');
const roleView = ref<'graph' | 'table'>('graph');
const grantRole = ref<null | { grantRole?: string; toUser?: string }>(null);
const grantPriv = ref(false);

interface Grantee { type: 'ROLE' | 'USER'; name: string }
const userNames = computed(() => new Set(users.value.map(u => u.name.toUpperCase())));
/** A `granted_to` entry, however the engine spells it: "SYSADMIN", "ROLE SYSADMIN", "USER:X" or {type, name}. */
function parseGrantee(entry: unknown): Grantee | null {
  if (!entry) return null;
  if (typeof entry === 'object') {
    const e = entry as Record<string, unknown>;
    const name = String(e.name || e.grantee || '');
    const type = String(e.type || e.granted_to || '').toUpperCase() === 'USER' ? 'USER' : 'ROLE';
    return name ? { type, name } : null;
  }
  const text = String(entry).trim();
  const m = text.match(/^(ROLE|USER)[\s:]+(.+)$/i);
  if (m) return { type: m[1].toUpperCase() as 'ROLE' | 'USER', name: m[2].trim() };
  return { type: userNames.value.has(text.toUpperCase()) ? 'USER' : 'ROLE', name: text };
}
function parentsOf(name: string): Grantee[] {
  const found = roles.value.find(x => x.name === name);
  if (found && (Array.isArray(found.granted_to_roles) || Array.isArray(found.granted_to_users))) {
    return [...(found.granted_to_roles || []).map(n => ({ type: 'ROLE' as const, name: String(n) })),
      ...(found.granted_to_users || []).map(n => ({ type: 'USER' as const, name: String(n) }))];
  }
  return (found?.granted_to || []).map(parseGrantee).filter((g): g is Grantee => Boolean(g));
}
function childrenOf(name: string): string[] {
  return roles.value.filter(x => parentsOf(x.name).some(g => g.type === 'ROLE' && g.name.toUpperCase() === name.toUpperCase())).map(x => x.name);
}
function usersOf(name: string): string[] { return parentsOf(name).filter(g => g.type === 'USER').map(g => g.name); }
function rolesOfUser(userName: string): string[] {
  return roles.value.filter(x => parentsOf(x.name).some(g => g.type === 'USER' && g.name.toUpperCase() === userName.toUpperCase())).map(x => x.name);
}
const roots = computed(() => roles.value.filter(x => !parentsOf(x.name).some(g => g.type === 'ROLE')).map(x => x.name)
  .sort((a, b) => (a === 'ACCOUNTADMIN' ? -1 : b === 'ACCOUNTADMIN' ? 1 : a === 'PUBLIC' ? 1 : b === 'PUBLIC' ? -1 : a.localeCompare(b))));
function privCount(name: string) { return list.grants(sf.view.value).filter(g => String(g.to || g.granted_to || '').toUpperCase() === name.toUpperCase()).length; }

async function revokeRole(roleName: string, type: string, from: string) {
  const ok = await sf.confirm({ title: 'Revoke role?', message: `Revoke role ${roleName} from ${type.toLowerCase()} ${from}? It loses every privilege that role carries.`, yes: 'Revoke', danger: true });
  if (ok) await sf.sql(`REVOKE ROLE ${ident(roleName)} FROM ${type === 'USER' ? 'USER' : 'ROLE'} ${ident(from)}`, { success: `Revoked ${roleName} from ${from}` });
}
async function dropRole(name: string) {
  const ok = await sf.confirm({ title: `Drop role ${name}?`, message: 'Users and roles that were granted it lose its privileges. Objects it owns pass to the role that runs the drop.', yes: 'Drop Role', danger: true });
  if (!ok) return;
  const res = await sf.sql(`DROP ROLE ${ident(name)}`, { success: `Role ${name} dropped` });
  if (res.ok) sf.go({ page: 'users-roles', tab: 'roles' });
}
async function dropUser(name: string) {
  menu.value = '';
  const ok = await sf.confirm({ title: `Drop user ${name}?`, message: 'The user can no longer sign in. This cannot be undone.', yes: 'Drop User', danger: true, typeToConfirm: name });
  if (ok) await sf.sql(`DROP USER ${ident(name)}`, { success: `User ${name} dropped` });
}
async function toggleUser(name: string, disable: boolean) {
  menu.value = '';
  await sf.sql(`ALTER USER ${ident(name)} SET DISABLED = ${disable ? 'TRUE' : 'FALSE'}`, { success: `User ${name} ${disable ? 'disabled' : 'enabled'}` });
}

const prompt = ref<null | { title: string; okText?: string; fields: PromptField[]; build: (v: Record<string, string>) => string | string[]; success?: string }>(null);
function editUser(name: string) {
  menu.value = '';
  const u = users.value.find(x => x.name === name);
  const before = { role: u?.default_role || '', wh: u?.default_warehouse || '' };
  prompt.value = {
    title: `Edit ${name}`, okText: 'Save User',
    fields: [
      { key: 'role', label: 'Default role', value: before.role, options: [['', 'PUBLIC'], ...roles.value.map(x => [x.name, x.name] as [string, string])] },
      { key: 'wh', label: 'Default warehouse', value: before.wh, options: [['', '— None —'], ...list.warehouses(sf.view.value).map(w => [w.name, w.name] as [string, string])] },
    ],
    build: v => {
      const sets: string[] = [];
      if (v.role !== before.role) sets.push(v.role ? `DEFAULT_ROLE = ${ident(v.role)}` : 'DEFAULT_ROLE = PUBLIC');
      if (v.wh !== before.wh) sets.push(v.wh ? `DEFAULT_WAREHOUSE = ${ident(v.wh)}` : 'DEFAULT_WAREHOUSE = NULL');
      return sets.length ? `ALTER USER ${ident(name)} SET ${sets.join(' ')}` : '';
    },
    success: `User ${name} updated`,
  };
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.ur__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.ur__cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 16px; }
.ur__list { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.ur__list li { display: flex; align-items: center; gap: 8px; min-height: 30px; }
.ur__list .sf-ico { color: var(--sf-text-2); }
.ur__avatar { width: 26px; height: 26px; border-radius: 50%; background: #1D3E6E; color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 600; flex: none; }
.ur__menu { right: 8px; top: 34px; }
.ur__seg { display: inline-flex; border: 1px solid var(--sf-border-strong); border-radius: 6px; overflow: hidden; }
.ur__seg button { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border: 0; background: var(--sf-bg); font: inherit; font-size: 12px; color: var(--sf-text-2); cursor: pointer; }
.ur__seg button + button { border-left: 1px solid var(--sf-border-strong); }
.ur__seg button.is-on { background: var(--sf-selected); color: var(--sf-primary-text); font-weight: 600; }
.ur__graph { border: 1px solid var(--sf-border); border-radius: var(--sf-radius-lg); padding: 20px; overflow: auto; background-color: var(--sf-bg-2);
  background-image: radial-gradient(circle, #D9DEE6 1px, transparent 1px); background-size: 16px 16px; }
.ur__tree { display: flex; flex-direction: column; gap: 6px; min-width: max-content; }
</style>
