<template>
  <div class="gt">
    <div class="sf-toolbar">
      <span class="sf-muted">{{ grants.length }} privilege{{ grants.length === 1 ? '' : 's' }}</span>
      <span class="sf-spacer"></span>
      <button type="button" class="sf-btn sf-btn--primary sf-btn--sm" @click="granting = true"><SfIcon name="plus" /> Privilege</button>
    </div>
    <div class="sf-table-wrap">
      <table class="sf-table">
        <thead><tr><th>Privilege</th><th>Object type</th><th>Object</th><th>Granted to</th><th class="sf-actions"></th></tr></thead>
        <tbody>
          <tr v-for="(g, i) in grants" :key="i">
            <td><span class="sf-badge">{{ g.privilege }}</span></td>
            <td class="sf-muted">{{ g.on }}</td>
            <td class="sf-mono">{{ g.name }}</td>
            <td><span class="sf-cell-name"><SfIcon name="role" />{{ g.to || g.granted_to }}</span></td>
            <td class="sf-actions">
              <button v-if="g.privilege !== 'OWNERSHIP'" type="button" class="sf-btn sf-btn--ghost sf-btn--sm" :aria-label="'Revoke ' + g.privilege" @click="revoke(g)">Revoke</button>
            </td>
          </tr>
          <tr v-if="!grants.length"><td colspan="5"><div class="sf-empty"><SfIcon name="key" /><strong>No privileges granted</strong></div></td></tr>
        </tbody>
      </table>
    </div>
    <GrantDialog v-if="granting" mode="privilege" :on-kind="onKind" :on-name="onName" :to-role="toRole" @close="granting = false" />
  </div>
</template>

<script setup lang="ts">
/** The Privileges tab of an object, or the grants a role holds. */
import { computed, ref } from 'vue';
import SfIcon from './SfIcon.vue';
import GrantDialog from './GrantDialog.vue';
import { useSf } from './sfContext';
import { fqnSql, ident, list, type SfGrant } from './snowflake';

const props = defineProps<{ onKind?: string; onName?: string; toRole?: string }>();
const sf = useSf();
const granting = ref(false);

const grants = computed(() => list.grants(sf.view.value).filter(g => {
  if (props.toRole && String(g.to || g.granted_to || '').toUpperCase() !== props.toRole.toUpperCase()) return false;
  if (props.onKind && String(g.on).toUpperCase() !== props.onKind.toUpperCase()) return false;
  if (props.onName && String(g.name).toUpperCase() !== props.onName.toUpperCase()) return false;
  return true;
}));

async function revoke(g: SfGrant) {
  const role = String(g.to || g.granted_to || '');
  const kind = String(g.on).toUpperCase();
  const ok = await sf.confirm({ title: 'Revoke privilege?', message: `Revoke ${g.privilege} on ${kind.toLowerCase()} ${g.name} from role ${role}?`, yes: 'Revoke', danger: true });
  if (!ok) return;
  const on = kind === 'ACCOUNT' ? 'ACCOUNT' : `${kind} ${kind === 'WAREHOUSE' || kind === 'DATABASE' ? ident(g.name) : fqnSql(g.name)}`;
  await sf.sql(`REVOKE ${g.privilege} ON ${on} FROM ROLE ${ident(role)}`, { success: `Revoked ${g.privilege} from ${role}` });
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.gt { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
</style>
