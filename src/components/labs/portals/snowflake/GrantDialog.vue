<template>
  <SfModal :title="mode === 'role' ? 'Grant role' : 'Grant privileges'" :subtitle="subtitle" ok-text="Grant" :busy="busy"
           :ok-disabled="!valid" :sql="statement" :error="error" @close="$emit('close')" @ok="submit">
    <template v-if="mode === 'privilege'">
      <div class="sf-row">
        <label class="sf-field"><span class="sf-label">Object type</span>
          <select v-model="kind" class="sf-select" :disabled="Boolean(onKind)">
            <option v-for="k in Object.keys(PRIVILEGES)" :key="k" :value="k">{{ k }}</option>
          </select></label>
        <label v-if="kind !== 'ACCOUNT'" class="sf-field"><span class="sf-label">Object</span>
          <select v-model="name" class="sf-select" :disabled="Boolean(onName)">
            <option v-for="o in objects" :key="o" :value="o">{{ o }}</option>
          </select></label>
      </div>
      <div class="sf-field">
        <span class="sf-label">Privileges</span>
        <div class="privs">
          <label v-for="p in PRIVILEGES[kind] || []" :key="p" class="sf-check"><input v-model="privs" type="checkbox" :value="p" /> {{ p }}</label>
        </div>
      </div>
      <label class="sf-field"><span class="sf-label">Grant to role</span>
        <select v-model="role" class="sf-select" :disabled="Boolean(toRole)"><option v-for="r in roles" :key="r" :value="r">{{ r }}</option></select></label>
      <label class="sf-check"><input v-model="grantOption" type="checkbox" /> WITH GRANT OPTION (the role may grant these privileges on)</label>
    </template>
    <template v-else>
      <label class="sf-field"><span class="sf-label">Role to grant</span>
        <select v-model="grantee" class="sf-select"><option v-for="r in roles" :key="r" :value="r">{{ r }}</option></select></label>
      <div class="sf-row">
        <label class="sf-field"><span class="sf-label">To</span>
          <select v-model="toType" class="sf-select"><option value="ROLE">Role</option><option value="USER">User</option></select></label>
        <label class="sf-field"><span class="sf-label">{{ toType === 'ROLE' ? 'Parent role' : 'User' }}</span>
          <select v-model="target" class="sf-select"><option v-for="t in targets" :key="t" :value="t">{{ t }}</option></select></label>
      </div>
      <p class="sf-hint">Granting a role to another role makes the second role inherit every privilege of the first.</p>
    </template>
  </SfModal>
</template>

<script setup lang="ts">
/** GRANT <privileges> ON <object> TO ROLE, and GRANT ROLE ... TO ROLE / USER. */
import { computed, ref, watch } from 'vue';
import SfModal from './SfModal.vue';
import { useSf } from './sfContext';
import { fqnSql, ident, list, PRIVILEGES } from './snowflake';

const props = defineProps<{ mode: 'privilege' | 'role'; onKind?: string; onName?: string; toRole?: string; grantRole?: string; toUser?: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const sf = useSf();

const kind = ref((props.onKind || 'TABLE').toUpperCase());
const name = ref(props.onName || '');
const privs = ref<string[]>([]);
const roles = computed(() => list.roles(sf.view.value).map(r => r.name));
const role = ref(props.toRole || '');
const grantOption = ref(false);
const grantee = ref(props.grantRole || '');
const toType = ref<'ROLE' | 'USER'>(props.toUser ? 'USER' : 'ROLE');
const target = ref(props.toUser || '');
const busy = ref(false);
const error = ref('');

if (!role.value) role.value = roles.value.find(r => !['ACCOUNTADMIN', 'ORGADMIN'].includes(r)) || roles.value[0] || '';
if (!grantee.value) grantee.value = roles.value[0] || '';

const objects = computed(() => {
  const v = sf.view.value;
  switch (kind.value) {
    case 'DATABASE': return list.databases(v).filter(d => !d.dropped).map(d => d.name);
    case 'SCHEMA': return list.schemas(v).filter(s => !s.dropped).map(s => `${s.database}.${s.name}`);
    case 'TABLE': return list.tables(v).filter(t => !t.dropped && String(t.kind || 'TABLE').toUpperCase() !== 'VIEW').map(t => t.fqn);
    case 'VIEW': return list.tables(v).filter(t => !t.dropped && String(t.kind).toUpperCase() === 'VIEW').map(t => t.fqn);
    case 'WAREHOUSE': return list.warehouses(v).map(w => w.name);
    case 'STAGE': return list.stages(v).map(s => s.fqn);
    default: return [];
  }
});
watch(kind, () => { privs.value = []; if (!props.onName) name.value = objects.value[0] || ''; }, { immediate: !props.onName });

const targets = computed(() => (toType.value === 'ROLE' ? roles.value.filter(r => r !== grantee.value) : list.users(sf.view.value).map(u => u.name)));
watch([toType, targets], () => { if (!targets.value.includes(target.value)) target.value = targets.value[0] || ''; }, { immediate: true });

const subtitle = computed(() => (props.mode === 'privilege' && props.onName ? `${kind.value} ${props.onName}` : ''));

const statement = computed(() => {
  if (props.mode === 'role') {
    if (!grantee.value || !target.value) return '';
    return `GRANT ROLE ${ident(grantee.value)} TO ${toType.value} ${ident(target.value)}`;
  }
  if (!privs.value.length || !role.value) return '';
  const on = kind.value === 'ACCOUNT' ? 'ACCOUNT' : `${kind.value} ${kind.value === 'WAREHOUSE' || kind.value === 'DATABASE' ? ident(name.value) : fqnSql(name.value)}`;
  if (kind.value !== 'ACCOUNT' && !name.value) return '';
  return `GRANT ${privs.value.join(', ')} ON ${on} TO ROLE ${ident(role.value)}${grantOption.value ? ' WITH GRANT OPTION' : ''}`;
});
const valid = computed(() => Boolean(statement.value));

async function submit() {
  if (!valid.value) return;
  busy.value = true;
  error.value = '';
  const result = await sf.sql(statement.value, { quiet: true, success: props.mode === 'role' ? `Granted role ${grantee.value}` : `Granted ${privs.value.join(', ')} to ${role.value}` });
  busy.value = false;
  if (result.ok) emit('close');
  else error.value = String(result.error || result.output || 'The grant failed.').trim();
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.privs { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 8px 10px; border: 1px solid var(--sf-border); border-radius: 6px; }
</style>
