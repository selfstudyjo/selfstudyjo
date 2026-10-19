<template>
  <div class="af-page">
    <!-- ===== List Connection ===== -->
    <div v-if="mode === 'list'" class="af-panel">
      <div class="af-panel__head">
        <h3 class="af-panel__title">List Connection</h3>
        <button type="button" class="af-btn af-btn--sm af-btn--primary af-btn--icon" title="Add a new record" aria-label="Add a new record" @click="startAdd"><AfIcon name="plus" /></button>
        <span class="af-spacer"></span>
        <span class="af-menu-anchor">
          <button type="button" class="af-btn af-btn--sm" :disabled="!selected.size" :aria-expanded="actions" @click.stop="actions = !actions">Actions <AfIcon name="caret" /></button>
          <div v-if="actions" class="af-menu af-cn__menu" role="menu">
            <button type="button" role="menuitem" class="is-danger" @click="deleteSelected">Delete</button>
          </div>
        </span>
      </div>
      <div class="af-panel__body">
        <div class="af-cn__search"><AfIcon name="search" />
          <input v-model="query" class="af-input" type="search" placeholder="Search Conn Id, Conn Type, Host" aria-label="Search connections" /></div>
        <div class="af-table-wrap">
          <table class="af-table af-table--bordered af-table--striped">
            <thead>
              <tr>
                <th class="af-actions-col"><input type="checkbox" :checked="allChecked" aria-label="Select all" @change="toggleAll" /></th>
                <th class="af-actions-col"></th>
                <th>Conn Id</th><th>Conn Type</th><th>Description</th><th>Host</th><th>Port</th><th>Is Encrypted</th><th>Is Extra Encrypted</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in shown" :key="c.conn_id">
                <td class="af-actions-col"><input type="checkbox" :checked="selected.has(c.conn_id)" :aria-label="'Select ' + c.conn_id" @change="toggle(c.conn_id)" /></td>
                <td class="af-actions-col">
                  <span class="af-cn__rowact">
                    <button type="button" class="af-btn af-btn--xs" :aria-label="'Edit ' + c.conn_id" title="Edit record" @click="startEdit(c)"><AfIcon name="edit" /></button>
                    <button type="button" class="af-btn af-btn--xs" :aria-label="'Delete ' + c.conn_id" title="Delete record" @click="remove([c.conn_id])"><AfIcon name="trash" /></button>
                  </span>
                </td>
                <td class="af-mono">{{ c.conn_id }}</td><td>{{ c.conn_type }}</td><td>{{ c.description || '' }}</td>
                <td>{{ c.host }}</td><td>{{ c.port ?? '' }}</td><td>True</td><td>{{ c.extra ? 'True' : 'False' }}</td>
              </tr>
              <tr v-if="!shown.length"><td colspan="9" class="af-empty-cell">No records found</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="af-panel__foot">Record Count: {{ shown.length }}</div>
    </div>

    <!-- ===== Add / Edit Connection ===== -->
    <div v-else class="af-panel">
      <div class="af-panel__head"><h3 class="af-panel__title">{{ mode === 'add' ? 'Add Connection' : 'Edit Connection' }}</h3></div>
      <div class="af-panel__body">
        <div v-if="mode === 'edit'" class="af-alert af-alert--info"><div class="af-alert__body">The Airflow CLI has no "edit": saving re-creates the connection
          (<code>airflow connections delete</code> then <code>airflow connections add</code>). The password is not shown; leave it blank to save without one.</div></div>
        <div class="af-cn__form">
          <label class="af-cn__row"><span class="af-label">Connection Id *</span>
            <input v-model="form.conn_id" class="af-input" :class="{ 'af-input--error': idError }" :disabled="mode === 'edit'" aria-label="Connection Id" />
            <span v-if="idError" class="af-error-text">{{ idError }}</span></label>
          <label class="af-cn__row"><span class="af-label">Connection Type *</span>
            <select v-model="form.conn_type" class="af-select" aria-label="Connection Type">
              <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option></select>
            <span class="af-help">Connection Type missing? Make sure you've installed the corresponding Airflow Provider Package.</span></label>
          <label class="af-cn__row"><span class="af-label">Description</span><textarea v-model="form.description" class="af-textarea af-cn__desc" rows="2" aria-label="Description"></textarea></label>
          <label class="af-cn__row"><span class="af-label">Host</span><input v-model="form.host" class="af-input" aria-label="Host" /></label>
          <label class="af-cn__row"><span class="af-label">Schema</span><input v-model="form.schema" class="af-input" aria-label="Schema" /></label>
          <label class="af-cn__row"><span class="af-label">Login</span><input v-model="form.login" class="af-input" autocomplete="off" aria-label="Login" /></label>
          <label class="af-cn__row"><span class="af-label">Password</span><input v-model="form.password" class="af-input" type="password" autocomplete="new-password" aria-label="Password" /></label>
          <label class="af-cn__row"><span class="af-label">Port</span><input v-model="form.port" class="af-input" inputmode="numeric" aria-label="Port" />
            <span v-if="portError" class="af-error-text">{{ portError }}</span></label>
          <label class="af-cn__row"><span class="af-label">Extra</span><textarea v-model="form.extra" class="af-textarea" rows="4" spellcheck="false" aria-label="Extra" placeholder='{"account": "shopflow-xy12345", "warehouse": "TRANSFORM_WH"}'></textarea>
            <span v-if="extraError" class="af-error-text">{{ extraError }}</span></label>
        </div>
        <div class="af-cn__cli"><span class="af-label">Equivalent CLI</span><code class="af-cn__line">{{ command }}</code></div>
      </div>
      <div class="af-panel__foot">
        <button type="button" class="af-btn af-btn--primary" :disabled="Boolean(problem) || saving" @click="save">Save</button>
        <button type="button" class="af-btn" :disabled="!form.conn_id || mode === 'add' || saving" title="Test the saved connection" @click="test">Test</button>
        <button type="button" class="af-btn" @click="mode = 'list'"><AfIcon name="chevron-left" /> Back</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { matches, sortBy } from '@/utils/portalKit';
import AfIcon from './AfIcon.vue';
import { useAf } from './afContext';
import { CMD, CONN_TYPES, type AfConnection } from './airflow';

const af = useAf();
const mode = ref<'list' | 'add' | 'edit'>('list');
const query = ref('');
const selected = ref(new Set<string>());
const actions = ref(false);
const saving = ref(false);
function close() { actions.value = false; }
onMounted(() => window.addEventListener('click', close));
onBeforeUnmount(() => window.removeEventListener('click', close));

const blank = () => ({ conn_id: '', conn_type: 'postgres', description: '', host: '', schema: '', login: '', password: '', port: '', extra: '' });
const form = reactive(blank());

const shown = computed(() => sortBy(af.connections.value.filter(c => matches(c, query.value, ['conn_id', 'conn_type', 'host'])), 'conn_id'));
const allChecked = computed(() => shown.value.length > 0 && shown.value.every(c => selected.value.has(c.conn_id)));
const typeOptions = computed(() => [...new Set([...CONN_TYPES, form.conn_type].filter(Boolean))].sort());

const idError = computed(() => {
  const id = form.conn_id.trim();
  if (!id) return 'This field is required.';
  if (!/^[\w.-]+$/.test(id)) return 'Connection Id may only contain letters, numbers, underscores, dots and dashes.';
  if (mode.value === 'add' && af.connections.value.some(c => c.conn_id === id)) return `A connection with conn_id ${id} already exists.`;
  return '';
});
const portError = computed(() => (form.port.trim() && !/^\d+$/.test(form.port.trim()) ? 'Port must be a number.' : ''));
const extraError = computed(() => {
  if (!form.extra.trim()) return '';
  try { JSON.parse(form.extra); return ''; } catch { return 'Extra field must be a valid JSON.'; }
});
const problem = computed(() => idError.value || portError.value || extraError.value);
const command = computed(() => CMD.addConnection({ ...form, conn_id: form.conn_id.trim(), port: form.port.trim(),
  extra: form.extra.trim() ? JSON.stringify(JSON.parse(extraError.value ? '{}' : form.extra)) : '' }));

function toggle(id: string) { const s = new Set(selected.value); s.has(id) ? s.delete(id) : s.add(id); selected.value = s; }
function toggleAll() { selected.value = allChecked.value ? new Set() : new Set(shown.value.map(c => c.conn_id)); }

function startAdd() { Object.assign(form, blank()); mode.value = 'add'; }
function startEdit(c: AfConnection) {
  Object.assign(form, blank(), {
    conn_id: c.conn_id, conn_type: c.conn_type || 'generic', description: c.description || '', host: c.host || '',
    schema: c.schema || '', login: c.login || '', port: c.port != null ? String(c.port) : '',
    extra: typeof c.extra === 'string' ? c.extra : c.extra ? JSON.stringify(c.extra) : '',
  });
  mode.value = 'edit';
}

async function save() {
  if (problem.value) return;
  saving.value = true;
  try {
    if (mode.value === 'edit') {
      const del = await af.run(CMD.deleteConnection(form.conn_id.trim()), { quiet: true });
      if (!del.ok) { af.notify('error', 'Could not replace the connection', String(del.error || del.output || '').trim()); return; }
    }
    const result = await af.run(command.value, { success: mode.value === 'add' ? 'Added Row' : 'Changed Row' });
    if (result.ok) mode.value = 'list';
  } finally {
    saving.value = false;
  }
}

async function test() {
  await af.run(CMD.testConnection(form.conn_id.trim()), { success: 'Connection successfully tested' });
}

async function remove(ids: string[]) {
  if (!await af.confirm({ title: 'Delete', message: ids.length === 1 ? 'You sure you want to delete this item?' : `You sure you want to delete the ${ids.length} selected items?`,
    lines: ids, yes: 'Delete', danger: true })) return;
  let ok = 0;
  for (const id of ids) if ((await af.run(CMD.deleteConnection(id))).ok) ok += 1;
  if (ok) af.notify('success', ok === 1 ? 'Deleted Row' : `${ok} records deleted`);
  selected.value = new Set();
}
function deleteSelected() { actions.value = false; remove([...selected.value]); }
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-cn__menu { right: 0; top: 30px; }
.af-cn__search { position: relative; display: flex; align-items: center; max-width: 360px; }
.af-cn__search .af-ico { position: absolute; left: 9px; color: #999; pointer-events: none; }
.af-cn__search .af-input { padding-left: 30px; height: 30px; font-size: 13px; }
.af-cn__rowact { display: inline-flex; gap: 2px; }
.af-cn__form { display: flex; flex-direction: column; gap: 12px; max-width: 760px; }
.af-cn__row { display: grid; grid-template-columns: 180px minmax(0, 1fr); align-items: center; column-gap: 12px; row-gap: 2px; }
.af-cn__row > .af-error-text, .af-cn__row > .af-help { grid-column: 2; }
.af-cn__desc { min-height: 54px; font-family: inherit; }
.af-cn__cli { display: flex; flex-direction: column; gap: 4px; }
.af-cn__line { display: block; padding: 6px 8px; color: #24292e; background: #f6f8fa; border: 1px solid #e1e4e8; overflow-wrap: anywhere; white-space: pre-wrap; }
@container sl-portal (max-width: 640px) {
  .af-cn__row { grid-template-columns: minmax(0, 1fr); }
  .af-cn__row > .af-error-text, .af-cn__row > .af-help { grid-column: 1; }
}
</style>
