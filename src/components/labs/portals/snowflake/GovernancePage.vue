<template>
  <div class="sf-page">
    <div class="sf-page-head">
      <h1 class="sf-h1">Governance</h1>
      <span class="sf-spacer"></span>
      <div class="sf-rel">
        <button type="button" class="sf-btn sf-btn--primary" @click="menu = !menu"><SfIcon name="plus" /> Policy <SfIcon name="chevron-down" /></button>
        <div v-if="menu" class="sf-menu gv__menu" @mouseleave="menu = false">
          <button type="button" @click="menu = false; sf.create('masking-policy')"><SfIcon name="policy" /> Masking policy</button>
          <button type="button" @click="menu = false; sf.create('row-access-policy')"><SfIcon name="policy" /> Row access policy</button>
        </div>
      </div>
    </div>
    <div class="sf-tabs">
      <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'dashboard' }" @click="setTab('dashboard')">Dashboard</button>
      <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'policies' }" @click="setTab('policies')">Policies</button>
      <button type="button" class="sf-tab" :class="{ 'is-active': tab === 'columns' }" @click="setTab('columns')">Protected objects</button>
    </div>

    <template v-if="tab === 'dashboard'">
      <div class="sf-grid-cards">
        <div class="sf-card sf-stat"><b>{{ masking.length }}</b><span>Masking policies</span></div>
        <div class="sf-card sf-stat"><b>{{ rowAccess.length }}</b><span>Row access policies</span></div>
        <div class="sf-card sf-stat"><b>{{ maskedColumns.length }}</b><span>Columns with a masking policy</span></div>
        <div class="sf-card sf-stat"><b>{{ protectedTables.length }}</b><span>Tables with a row access policy</span></div>
      </div>
      <div class="sf-card gv__note">
        <h2 class="sf-h3">How policies apply</h2>
        <p class="sf-muted">A masking policy rewrites a column for every role the policy does not allow; a row access policy filters the rows of a table on every SELECT. Both are evaluated with CURRENT_ROLE(), so switching role in a worksheet changes what the same query returns.</p>
      </div>
    </template>

    <div v-else-if="tab === 'policies'" class="sf-table-wrap">
      <table class="sf-table">
        <thead><tr><th>Name</th><th>Type</th><th>Signature</th><th>Applied to</th><th class="sf-actions"></th></tr></thead>
        <tbody>
          <tr v-for="p in policies" :key="p.fqn">
            <td><button type="button" class="sf-link sf-cell-name" @click="openPolicy(p.fqn)"><SfIcon name="policy" />{{ p.fqn }}</button></td>
            <td><span class="sf-badge">{{ p.kind }}</span></td>
            <td class="sf-mono">{{ p.signature || '' }}</td>
            <td class="sf-muted"><span class="sf-ellipsis">{{ (p.attached || []).join(', ') || 'Not applied' }}</span></td>
            <td class="sf-actions"><button type="button" class="sf-btn sf-btn--ghost sf-btn--sm" @click="drop(p.fqn, p.kind)">Drop</button></td>
          </tr>
          <tr v-if="!policies.length"><td colspan="5"><div class="sf-empty"><SfIcon name="policy" /><strong>No policies</strong><span>Create a masking or row access policy to protect sensitive data.</span></div></td></tr>
        </tbody>
      </table>
    </div>

    <div v-else class="sf-table-wrap">
      <table class="sf-table">
        <thead><tr><th>Object</th><th>Kind</th><th>Policy</th><th class="sf-actions"></th></tr></thead>
        <tbody>
          <tr v-for="(m, i) in maskedColumns" :key="'m' + i">
            <td class="sf-mono">{{ m.target }}</td><td>Column</td><td><span class="sf-badge sf-badge--warn"><SfIcon name="lock" /> {{ m.policy }}</span></td>
            <td class="sf-actions"><button type="button" class="sf-btn sf-btn--ghost sf-btn--sm" @click="unsetMask(m.target)">Unset</button></td>
          </tr>
          <tr v-for="(t, i) in protectedTables" :key="'r' + i">
            <td class="sf-mono">{{ t.target }}</td><td>Table</td><td><span class="sf-badge sf-badge--warn"><SfIcon name="policy" /> {{ t.policy }}</span></td>
            <td class="sf-actions"><button type="button" class="sf-btn sf-btn--ghost sf-btn--sm" @click="removeRow(t.target, t.policy)">Remove</button></td>
          </tr>
          <tr v-if="!maskedColumns.length && !protectedTables.length"><td colspan="4"><div class="sf-empty"><strong>Nothing is protected yet</strong><span>Apply a policy from a table's Columns tab.</span></div></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Monitoring > Governance: masking and row access policies and where they apply. */
import { computed, ref } from 'vue';
import SfIcon from './SfIcon.vue';
import { useSf } from './sfContext';
import { fqnSql, ident, list, splitFqn } from './snowflake';

const sf = useSf();
const menu = ref(false);
const tab = computed(() => (sf.route.value.page === 'governance' ? sf.route.value.tab || 'dashboard' : 'dashboard'));
function setTab(t: string) { sf.go({ page: 'governance', tab: t }); }

const masking = computed(() => list.masking(sf.view.value));
const rowAccess = computed(() => list.rowAccess(sf.view.value));
const policies = computed(() => [
  ...masking.value.map(p => ({ ...p, kind: 'Masking' })),
  ...rowAccess.value.map(p => ({ ...p, kind: 'Row access' })),
]);
const maskedColumns = computed(() => masking.value.flatMap(p => (p.attached || []).map(target => ({ target: String(target), policy: p.fqn || p.name }))));
const protectedTables = computed(() => rowAccess.value.flatMap(p => (p.attached || []).map(target => ({ target: String(target), policy: p.fqn || p.name }))));

function openPolicy(fqn: string) {
  const [db, schema] = splitFqn(fqn);
  sf.go({ page: 'databases', db, schema, kind: 'policies', object: fqn });
}
async function drop(fqn: string, kind: string) {
  const word = kind === 'Masking' ? 'MASKING POLICY' : 'ROW ACCESS POLICY';
  const ok = await sf.confirm({ title: `Drop ${kind.toLowerCase()} policy?`, message: `${fqn} will be dropped. A policy that is still applied must be removed from its objects first.`, yes: 'Drop', danger: true });
  if (ok) await sf.sql(`DROP ${word} ${fqnSql(fqn)}`, { success: 'Policy dropped' });
}
async function unsetMask(target: string) {
  const parts = splitFqn(target);
  const column = parts.pop() || '';
  const ok = await sf.confirm({ title: 'Unset masking policy?', message: `${target} will be readable in clear text.`, yes: 'Unset', danger: true });
  if (ok) await sf.sql(`ALTER TABLE ${fqnSql(parts.join('.'))} MODIFY COLUMN ${ident(column)} UNSET MASKING POLICY`, { success: 'Masking policy removed' });
}
async function removeRow(table: string, policy: string) {
  const ok = await sf.confirm({ title: 'Remove row access policy?', message: `${policy} will no longer filter ${table}.`, yes: 'Remove', danger: true });
  if (ok) await sf.sql(`ALTER TABLE ${fqnSql(table)} DROP ROW ACCESS POLICY ${fqnSql(policy)}`, { success: 'Row access policy removed' });
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.gv__menu { right: 0; top: calc(100% + 4px); }
.gv__note p { margin: 6px 0 0; }
</style>
