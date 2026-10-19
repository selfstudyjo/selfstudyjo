<template>
  <div class="af-page">
    <div v-if="mode === 'list'" class="af-panel">
      <div class="af-panel__head">
        <h3 class="af-panel__title">List Variable</h3>
        <button type="button" class="af-btn af-btn--sm af-btn--primary af-btn--icon" title="Add a new record" aria-label="Add a new record" @click="startAdd"><AfIcon name="plus" /></button>
        <span class="af-spacer"></span>
        <span class="af-menu-anchor">
          <button type="button" class="af-btn af-btn--sm" :disabled="!selected.size" :aria-expanded="actions" @click.stop="actions = !actions">Actions <AfIcon name="caret" /></button>
          <div v-if="actions" class="af-menu af-var__menu" role="menu">
            <button type="button" role="menuitem" @click="exportSelected">Export</button>
            <button type="button" role="menuitem" class="is-danger" @click="deleteSelected">Delete</button>
          </div>
        </span>
      </div>
      <div class="af-panel__body">
        <!-- Import Variables, as the list page offers it above the table. -->
        <div class="af-var__import">
          <span class="af-label">Import Variables</span>
          <input ref="fileInput" class="af-var__file" type="file" accept=".json,application/json" aria-label="Choose a variables JSON file" @change="onFile" />
          <button type="button" class="af-btn af-btn--sm" @click="pasting = !pasting">{{ pasting ? 'Hide' : 'Paste JSON' }}</button>
          <span class="af-help">A JSON object of <code>{"key": "value"}</code>; each one is set with <code>airflow variables set</code>.</span>
        </div>
        <div v-if="pasting" class="af-var__paste">
          <textarea v-model="importText" class="af-textarea" rows="5" spellcheck="false" aria-label="Variables JSON" placeholder='{"shopflow_env": "dev", "load_days": "7"}'></textarea>
          <div class="af-row">
            <label class="af-check"><input v-model="overwrite" type="checkbox" /> Overwrite existing variables</label>
            <span class="af-spacer"></span>
            <button type="button" class="af-btn af-btn--sm af-btn--primary" :disabled="!importText.trim() || importing" @click="importJson(importText)"><AfIcon name="upload" /> Import Variables</button>
          </div>
        </div>
        <div class="af-var__search"><AfIcon name="search" />
          <input v-model="query" class="af-input" type="search" placeholder="Search Key, Val" aria-label="Search variables" /></div>
        <div class="af-table-wrap">
          <table class="af-table af-table--bordered af-table--striped">
            <thead>
              <tr>
                <th class="af-actions-col"><input type="checkbox" :checked="allChecked" aria-label="Select all" @change="toggleAll" /></th>
                <th class="af-actions-col"></th><th>Key</th><th>Val</th><th>Description</th><th>Is Encrypted</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in shown" :key="v.key">
                <td class="af-actions-col"><input type="checkbox" :checked="selected.has(v.key)" :aria-label="'Select ' + v.key" @change="toggle(v.key)" /></td>
                <td class="af-actions-col"><span class="af-var__rowact">
                  <button type="button" class="af-btn af-btn--xs" :aria-label="'Edit ' + v.key" title="Edit record" @click="startEdit(v)"><AfIcon name="edit" /></button>
                  <button type="button" class="af-btn af-btn--xs" :aria-label="'Delete ' + v.key" title="Delete record" @click="remove([v.key])"><AfIcon name="trash" /></button></span></td>
                <td class="af-mono">{{ v.key }}</td>
                <td class="af-mono af-var__val">{{ sensitive(v.key) ? '***' : String(v.value ?? '') }}</td>
                <td>{{ v.description || '' }}</td>
                <td>True</td>
              </tr>
              <tr v-if="!shown.length"><td colspan="6" class="af-empty-cell">No records found</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="af-panel__foot">Record Count: {{ shown.length }}</div>
    </div>

    <div v-else class="af-panel">
      <div class="af-panel__head"><h3 class="af-panel__title">{{ mode === 'add' ? 'Add Variable' : 'Edit Variable' }}</h3></div>
      <div class="af-panel__body af-var__form">
        <label class="af-var__row"><span class="af-label">Key *</span>
          <input v-model="form.key" class="af-input" :class="{ 'af-input--error': keyError }" :disabled="mode === 'edit'" aria-label="Key" />
          <span v-if="keyError" class="af-error-text">{{ keyError }}</span></label>
        <label class="af-var__row"><span class="af-label">Val</span>
          <textarea v-model="form.value" class="af-textarea" rows="5" spellcheck="false" aria-label="Val"></textarea></label>
        <label class="af-var__row"><span class="af-label">Description</span>
          <textarea v-model="form.description" class="af-textarea af-var__desc" rows="2" aria-label="Description"></textarea></label>
        <div class="af-var__row"><span class="af-label">Equivalent CLI</span><code class="af-var__line">{{ command }}</code></div>
      </div>
      <div class="af-panel__foot">
        <button type="button" class="af-btn af-btn--primary" :disabled="Boolean(keyError) || saving" @click="save">Save</button>
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
import { CMD, type AfVariable } from './airflow';

const af = useAf();
const mode = ref<'list' | 'add' | 'edit'>('list');
const query = ref('');
const selected = ref(new Set<string>());
const actions = ref(false);
const saving = ref(false);
const pasting = ref(false);
const importing = ref(false);
const importText = ref('');
const overwrite = ref(true);
const fileInput = ref<HTMLInputElement | null>(null);
const form = reactive({ key: '', value: '', description: '' });
function close() { actions.value = false; }
onMounted(() => window.addEventListener('click', close));
onBeforeUnmount(() => window.removeEventListener('click', close));

/** Airflow masks a variable whose key names a secret (core.sensitive_var_conn_names). */
function sensitive(key: string) { return /password|secret|passwd|authorization|api_key|apikey|access_token|private_key/i.test(key); }

const shown = computed(() => sortBy(af.variables.value.filter(v => matches(v, query.value, ['key', 'value'])), 'key'));
const allChecked = computed(() => shown.value.length > 0 && shown.value.every(v => selected.value.has(v.key)));
const keyError = computed(() => {
  const k = form.key.trim();
  if (!k) return 'This field is required.';
  if (mode.value === 'add' && af.variables.value.some(v => v.key === k)) return `The Variable key ${k} already exists`;
  return '';
});
const command = computed(() => CMD.setVariable(form.key.trim(), form.value, form.description));

function toggle(k: string) { const s = new Set(selected.value); s.has(k) ? s.delete(k) : s.add(k); selected.value = s; }
function toggleAll() { selected.value = allChecked.value ? new Set() : new Set(shown.value.map(v => v.key)); }
function startAdd() { Object.assign(form, { key: '', value: '', description: '' }); mode.value = 'add'; }
function startEdit(v: AfVariable) { Object.assign(form, { key: v.key, value: String(v.value ?? ''), description: v.description || '' }); mode.value = 'edit'; }

async function save() {
  if (keyError.value) return;
  saving.value = true;
  const result = await af.run(command.value, { success: mode.value === 'add' ? 'Added Row' : 'Changed Row' });
  saving.value = false;
  if (result.ok) mode.value = 'list';
}

async function remove(keys: string[]) {
  if (!await af.confirm({ title: 'Delete', message: keys.length === 1 ? 'You sure you want to delete this item?' : `You sure you want to delete the ${keys.length} selected items?`,
    lines: keys, yes: 'Delete', danger: true })) return;
  let ok = 0;
  for (const k of keys) if ((await af.run(CMD.deleteVariable(k))).ok) ok += 1;
  if (ok) af.notify('success', ok === 1 ? 'Deleted Row' : `${ok} records deleted`);
  selected.value = new Set();
}
function deleteSelected() { actions.value = false; remove([...selected.value]); }

function exportSelected() {
  actions.value = false;
  const out: Record<string, string> = {};
  for (const v of af.variables.value) if (selected.value.has(v.key)) out[v.key] = String(v.value ?? '');
  const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 4)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'variables.json'; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { importJson(String(reader.result || '')); if (fileInput.value) fileInput.value.value = ''; };
  reader.readAsText(file);
}

async function importJson(text: string) {
  let data: unknown;
  try { data = JSON.parse(text); } catch { af.notify('error', 'Missing file or syntax error.'); return; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) { af.notify('error', 'Invalid variables file: it must be a JSON object.'); return; }
  importing.value = true;
  let ok = 0; let skipped = 0; let failed = 0;
  for (const [key, raw] of Object.entries(data as Record<string, unknown>)) {
    if (!overwrite.value && af.variables.value.some(v => v.key === key)) { skipped += 1; continue; }
    const isObj = raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in (raw as any);
    const value = isObj ? (raw as any).value : raw;
    const description = isObj ? String((raw as any).description || '') : '';
    const result = await af.run(CMD.setVariable(key, typeof value === 'string' ? value : JSON.stringify(value), description), { quiet: true });
    if (result.ok) ok += 1; else failed += 1;
  }
  importing.value = false;
  if (ok) af.notify('success', `${ok} variable(s) successfully updated.`);
  if (skipped) af.notify('info', `${skipped} variable(s) were skipped because they already exist.`);
  if (failed) af.notify('error', `${failed} variable(s) failed to be updated.`);
  if (ok && !failed) { importText.value = ''; pasting.value = false; }
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-var__menu { right: 0; top: 30px; }
.af-var__import { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 10px; border: 1px solid var(--af-border-light); border-radius: 4px; background: #fafafa; }
.af-var__file { font-size: 13px; max-width: 260px; }
.af-var__paste { display: flex; flex-direction: column; gap: 8px; }
.af-var__search { position: relative; display: flex; align-items: center; max-width: 360px; }
.af-var__search .af-ico { position: absolute; left: 9px; color: #999; pointer-events: none; }
.af-var__search .af-input { padding-left: 30px; height: 30px; font-size: 13px; }
.af-var__rowact { display: inline-flex; gap: 2px; }
.af-var__val { max-width: 360px; overflow-wrap: anywhere; white-space: pre-wrap; }
.af-var__form { max-width: 760px; }
.af-var__row { display: grid; grid-template-columns: 140px minmax(0, 1fr); align-items: start; column-gap: 12px; row-gap: 2px; }
.af-var__row > .af-error-text { grid-column: 2; }
.af-var__desc { min-height: 54px; font-family: inherit; }
.af-var__line { display: block; padding: 6px 8px; color: #24292e; background: #f6f8fa; border: 1px solid #e1e4e8; overflow-wrap: anywhere; white-space: pre-wrap; }
@container sl-portal (max-width: 640px) {
  .af-var__row { grid-template-columns: minmax(0, 1fr); }
  .af-var__row > .af-error-text { grid-column: 1; }
}
</style>
