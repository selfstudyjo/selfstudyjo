<template>
  <PgDialog v-model="tab" title="Grant Wizard" icon="grant" :tabs="['Object Selection', 'Privilege Selection', 'Review']"
            :error="error" :busy="busy" save-label="Finish" :width="720" :save-disabled="!!problem"
            @close="$emit('close')" @save="run" @reset="reset" @clear-error="error = ''" @info="info" @help="help">
    <div v-show="tab === 'Object Selection'" class="pg-form">
      <div class="pg-gw-head">
        <input v-model="filter" class="pg-input" placeholder="Search objects" aria-label="Search objects" />
        <span class="pg-muted">{{ spec.objects.length }} selected</span>
      </div>
      <table class="pg-table pg-gw-table">
        <thead><tr><th class="pg-gw-cb"><input type="checkbox" :checked="allShown" aria-label="Select all" @change="toggleAll" /></th><th>Object Type</th><th>Schema</th><th>Name</th></tr></thead>
        <tbody>
          <tr v-for="o in shown" :key="o.kind + o.name">
            <td class="pg-gw-cb"><input type="checkbox" :checked="isSel(o)" :aria-label="'Select ' + o.name" @change="toggle(o)" /></td>
            <td><PgIcon :name="o.kind === 'TABLE' ? 'table' : o.kind === 'VIEW' ? 'view' : 'mview'" :size="13" /> {{ o.kind === 'TABLE' ? 'Table' : o.kind === 'VIEW' ? 'View' : 'Materialized View' }}</td>
            <td>public</td><td>{{ o.name }}</td>
          </tr>
          <tr v-if="!shown.length"><td colspan="4" class="pg-muted">No objects match.</td></tr>
        </tbody>
      </table>
    </div>
    <div v-show="tab === 'Privilege Selection'" class="pg-form">
      <div class="pg-row"><span class="pg-row__label">Action</span>
        <select v-model="action" class="pg-select" aria-label="Action"><option value="grant">GRANT</option><option value="revoke">REVOKE</option></select></div>
      <div class="pg-row"><label class="pg-row__label is-req" for="gw-grantee">Grantee</label>
        <select id="gw-grantee" v-model="spec.grantee" class="pg-select"><option value="">Select a role</option><option value="PUBLIC">PUBLIC</option>
          <option v-for="r in roles" :key="r" :value="r">{{ r }}</option></select></div>
      <div class="pg-row pg-row--top"><span class="pg-row__label is-req">Privileges</span>
        <div class="pg-gw-privs">
          <label class="pg-gw-check"><input type="checkbox" :checked="allPrivs" @change="spec.privileges = allPrivs ? [] : [...TABLE_PRIVILEGES]" /> <strong>ALL</strong></label>
          <label v-for="p in TABLE_PRIVILEGES" :key="p" class="pg-gw-check"><input v-model="spec.privileges" type="checkbox" :value="p" /> {{ p }}</label>
        </div></div>
      <div class="pg-row"><span class="pg-row__label">WITH GRANT OPTION</span><PgSwitch v-model="spec.grantOption" label="WITH GRANT OPTION" :disabled="action === 'revoke'" /></div>
    </div>
    <PgCode v-if="tab === 'Review'" :sql="problem ? '-- ' + problem : generated" />
  </PgDialog>
</template>

<script setup lang="ts">
/** The Grant Wizard: pick objects, a grantee and privileges; Finish runs one GRANT (or REVOKE) per object. */
import { computed, inject, reactive, ref } from 'vue';
import PgDialog from './PgDialog.vue';
import PgSwitch from './PgSwitch.vue';
import PgCode from './PgCode.vue';
import PgIcon from './PgIcon.vue';
import { PG } from './pgContext';
import { errorText } from '../../../../utils/portalKit';
import { grantSql, TABLE_PRIVILEGES, type GrantSpec } from './pg';

const props = defineProps<{ table?: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const ctx = inject(PG)!;
const tab = ref('Object Selection');
const error = ref('');
const busy = ref(false);
const filter = ref('');
const action = ref<'grant' | 'revoke'>('grant');

type Obj = GrantSpec['objects'][number];
const objects = computed<Obj[]>(() => [
  ...ctx.model.value.tables.map(t => ({ kind: (t.raw.kind === 'matview' ? 'MATERIALIZED VIEW' : 'TABLE') as Obj['kind'], name: t.name })),
  ...ctx.model.value.views.map(v => ({ kind: (v.materialized ? 'MATERIALIZED VIEW' : 'VIEW') as Obj['kind'], name: v.name })),
]);
const roles = computed(() => ctx.model.value.roles.filter(r => !r.builtin).map(r => r.name));
function blank(): GrantSpec {
  return { objects: props.table ? objects.value.filter(o => o.name === props.table) : [], grantee: '', privileges: ['SELECT'], grantOption: false, revoke: false };
}
const spec = reactive<GrantSpec>(blank());
function reset() { Object.assign(spec, blank()); action.value = 'grant'; error.value = ''; }

const shown = computed(() => objects.value.filter(o => o.name.toLowerCase().includes(filter.value.trim().toLowerCase())));
const isSel = (o: Obj) => spec.objects.some(x => x.name === o.name && x.kind === o.kind);
function toggle(o: Obj) { spec.objects = isSel(o) ? spec.objects.filter(x => !(x.name === o.name && x.kind === o.kind)) : [...spec.objects, o]; }
const allShown = computed(() => shown.value.length > 0 && shown.value.every(isSel));
function toggleAll() {
  spec.objects = allShown.value ? spec.objects.filter(o => !shown.value.some(s => s.name === o.name && s.kind === o.kind))
    : [...spec.objects, ...shown.value.filter(o => !isSel(o))];
}
const allPrivs = computed(() => TABLE_PRIVILEGES.every(p => spec.privileges.includes(p)));
const generated = computed(() => grantSql({ ...spec, revoke: action.value === 'revoke' }));
const problem = computed(() => (!spec.objects.length ? 'Select at least one object.' : !spec.grantee ? 'Select a grantee.'
  : !spec.privileges.length ? 'Select at least one privilege.' : ''));

function info() { ctx.notify('info', 'Grant Wizard', 'Finish runs the statements on the Review tab.'); }
function help() { ctx.notify('info', 'pgAdmin documentation: grant_wizard.html', 'This lab is offline; see GRANT and REVOKE in the PostgreSQL reference.'); }

async function run() {
  if (problem.value) { error.value = problem.value; return; }
  busy.value = true;
  const result = await ctx.runSql(generated.value, { quiet: true });
  busy.value = false;
  if (result.ok) {
    ctx.notify('success', `${action.value === 'grant' ? 'Privileges granted' : 'Privileges revoked'} on ${spec.objects.length} object(s)`);
    emit('close');
  } else {
    error.value = errorText(result);
  }
}
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-gw-head { display: flex; align-items: center; gap: 10px; }
.pg-gw-head .pg-input { flex: 1; }
.pg-gw-table { display: block; max-height: 300px; overflow: auto; }
.pg-gw-cb { width: 28px; }
.pg-gw-privs { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 2px 12px; }
.pg-gw-check { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
</style>
