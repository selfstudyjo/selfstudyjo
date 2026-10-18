<template>
  <div class="fx-page md">
    <ItemHeader :name="itemName" type="SemanticModel" :label="item?.label" :endorsement="item?.endorsement"
                :status="m?.refreshed ? 'Refreshed ' + m.refreshed : 'Not refreshed yet'" :tabs="['Home', 'Help']"
                model-value="Home" @settings="settings = 'about'" @share="settings = 'share'" />
    <div class="fx-cmdbar">
      <button type="button" class="fx-cmd" :disabled="!m" @click="newMeasure"><FxIcon name="sparkle" />New measure</button>
      <button type="button" class="fx-cmd" :disabled="!m" @click="dialog = 'rels'"><FxIcon name="lineage" />Manage relationships</button>
      <button type="button" class="fx-cmd" :disabled="!m" @click="openRoles"><FxIcon name="lock" />Manage roles</button>
      <span class="fx-cmdbar__sep" />
      <button type="button" class="fx-cmd" :disabled="!m" @click="refresh"><FxIcon name="refresh" />Refresh</button>
      <button type="button" class="fx-cmd" :disabled="!m" @click="settings = 'schedule'"><FxIcon name="calendar" />Schedule refresh</button>
      <button type="button" class="fx-cmd" :disabled="!m" @click="analyze"><FxIcon name="check" />Best Practice Analyzer</button>
    </div>
    <div class="md-views" role="tablist" aria-label="View">
      <button type="button" class="md-view" :class="{ 'is-on': mode === 'model' }" role="tab" :aria-selected="mode === 'model'" @click="setMode('model')">
        <FxIcon name="lineage" :size="14" />Model view</button>
      <button type="button" class="md-view" :class="{ 'is-on': mode === 'dax' }" role="tab" :aria-selected="mode === 'dax'" @click="setMode('dax')">
        <FxIcon name="code" :size="14" />DAX query view</button>
    </div>

    <div v-if="!m" class="fx-empty">
      <FxIcon name="SemanticModel" :size="48" /><h3>This semantic model has no definition yet</h3>
      <p>Import a TMDL definition with <code class="fx-mono">fab import</code>, or create a model from a lakehouse with New item → Semantic model.</p>
    </div>

    <div v-else-if="mode === 'model'" class="fx-split md-split">
      <section class="fx-content md-diagram">
        <div class="md-cards">
          <div v-for="t in m.tables" :key="t.name" class="md-card" :class="{ 'is-sel': selTable === t.name }" @click="selTable = t.name">
            <div class="md-card__head"><FxIcon name="Table" />{{ t.name }}<span class="md-mode">{{ t.mode }}</span></div>
            <ul class="md-card__list">
              <li v-for="mm in t.measures" :key="'m' + mm.name" class="md-measure" :class="{ 'is-sel': editing?.orig === mm.name }"
                  @click.stop="editMeasure(t.name, mm)">
                <span class="md-calc">∑</span>{{ mm.name }}<span v-if="mm.error" class="md-warn" :title="mm.error">⚠</span>
              </li>
              <li v-for="c in t.columns.slice(0, 14)" :key="'c' + c.name" class="md-col" :class="{ 'is-hidden': c.hidden }">{{ c.name }}</li>
              <li v-if="t.columns.length > 14" class="md-col fx-muted">+ {{ t.columns.length - 14 }} more</li>
            </ul>
          </div>
        </div>
        <h3 class="fx-h3 md-pad">Relationships</h3>
        <ul class="md-rels md-pad">
          <li v-for="r in m.relationships" :key="r.name">
            <span class="fx-mono">{{ r.from }}</span> <span class="md-card-arrow">*─1</span> <span class="fx-mono">{{ r.to }}</span>
            <span v-if="r.both" class="fx-pill">Both directions</span><span v-if="!r.active" class="fx-pill fx-pill--warn">Inactive</span>
          </li>
          <li v-if="!m.relationships.length" class="fx-muted">No relationships. Use Manage relationships to add one.</li>
        </ul>
      </section>
      <aside class="md-props">
        <template v-if="editing">
          <div class="md-props__head">{{ editing.orig ? 'Measure' : 'New measure' }}</div>
          <div v-if="propError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ propError }}</span></div>
          <div class="fx-field"><label for="md-mname">Name<span class="fx-field__req">*</span></label>
            <input id="md-mname" v-model="editing.name" class="fx-input" :disabled="!!editing.orig" /></div>
          <div class="fx-field"><span class="fx-field__label">Home table</span>
            <select v-model="editing.table" class="fx-select" :disabled="!!editing.orig" aria-label="Home table">
              <option v-for="t in m.tables" :key="t.name" :value="t.name">{{ t.name }}</option></select></div>
          <div class="fx-field"><label for="md-dax">DAX formula<span class="fx-field__req">*</span></label>
            <textarea id="md-dax" v-model="editing.expression" class="fx-code md-dax" spellcheck="false" /></div>
          <div class="fx-field"><span class="fx-field__label">Format</span>
            <select v-model="editing.format" class="fx-select" aria-label="Format">
              <option value="">General</option><option value="0">Whole number</option><option value="0.0">Decimal (0.0)</option>
              <option value="0.0%">Percentage</option><option value="#,0">Thousands separator</option></select></div>
          <div v-if="editing.value !== undefined && editing.orig" class="md-value">Current value:
            <b>{{ editing.error ? '—' : editing.value }}</b><div v-if="editing.error" class="fx-field__err">{{ editing.error }}</div></div>
          <div class="md-actions">
            <button type="button" class="fx-btn fx-btn--primary" :disabled="!editing.name.trim() || !editing.expression.trim()" @click="saveMeasure">
              {{ editing.orig ? 'Save' : 'Create' }}</button>
            <button v-if="editing.orig" type="button" class="fx-btn" @click="dialog = 'delmeasure'">Delete</button>
            <button type="button" class="fx-btn fx-btn--subtle" @click="editing = null">Close</button>
          </div>
        </template>
        <template v-else>
          <div class="md-props__head">Data</div>
          <p class="fx-muted md-small">Source: {{ m.source || '—' }} · {{ m.tables.length }} tables</p>
          <ul class="md-tree">
            <li v-for="t in m.tables" :key="t.name"><FxIcon name="Table" />{{ t.name }}
              <ul><li v-for="mm in t.measures" :key="mm.name"><button type="button" class="fx-link" @click="editMeasure(t.name, mm)">∑ {{ mm.name }}</button>
                <span class="fx-muted md-small"> = {{ mm.error ? 'error' : mm.value }}</span></li></ul>
            </li>
          </ul>
          <template v-if="bpa.length">
            <div class="md-props__head">Best Practice Analyzer ({{ bpa.length }})</div>
            <ul class="md-bpa"><li v-for="(f, i) in bpa" :key="i"><span class="fx-pill" :class="f.severity === 'error' ? 'fx-pill--bad' : 'fx-pill--warn'">{{ f.severity }}</span> {{ f.rule }} - {{ f.object }}</li></ul>
          </template>
        </template>
      </aside>
    </div>

    <!-- DAX query view -->
    <div v-else class="fx-content md-daxview">
      <div class="md-daxbar">
        <button type="button" class="fx-btn fx-btn--primary fx-btn--sm" :disabled="daxRunning" @click="runDax"><FxIcon name="play" :size="12" />Run</button>
        <select v-model="impersonate" class="fx-select md-imp" aria-label="View as">
          <option value="">Run as: me</option>
          <option v-for="r in m.roles" :key="r.name" :value="r.name">View as role: {{ r.name }}</option>
        </select>
        <span class="fx-muted md-small">Model: {{ itemName }}</span>
      </div>
      <textarea v-model="daxText" class="fx-code md-daxed" spellcheck="false" aria-label="DAX query"
                @keydown.ctrl.enter.prevent="runDax" @keydown.shift.enter.prevent="runDax" />
      <div v-if="daxError" class="fx-msgbar fx-msgbar--error md-pad"><FxIcon name="error" /><span>{{ daxError }}</span></div>
      <FxGrid :grid="daxGrid" :empty="daxRunning ? 'Running…' : 'Run a DAX query to see results'" />
      <pre v-if="daxInfo" class="md-info">{{ daxInfo }}</pre>
    </div>

    <!-- Manage relationships -->
    <FxModal v-if="dialog === 'rels' && m" title="Manage relationships" width="720px" @close="dialog = ''">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ dlgError }}</span></div>
      <div class="fx-tablewrap md-relwrap"><table class="fx-table">
        <thead><tr><th>Active</th><th>From: Table (Column)</th><th>To: Table (Column)</th><th>Cross-filter</th><th /></tr></thead>
        <tbody>
          <tr v-for="r in m.relationships" :key="r.name">
            <td>{{ r.active ? 'Yes' : 'No' }}</td><td>{{ r.from }}</td><td>{{ r.to }}</td><td>{{ r.both ? 'Both' : 'Single' }}</td>
            <td><button type="button" class="fx-btn fx-btn--sm" @click="deleteRel(r.name)">Delete</button></td>
          </tr>
          <tr v-if="!m.relationships.length"><td colspan="5" class="fx-muted">No relationships</td></tr>
        </tbody>
      </table></div>
      <h3 class="fx-h3">New relationship</h3>
      <div class="md-relform">
        <div class="md-relside">
          <span class="fx-field__label">From table</span>
          <select v-model="rel.fromTable" class="fx-select" aria-label="From table"><option v-for="t in m.tables" :key="t.name" :value="t.name">{{ t.name }}</option></select>
          <select v-model="rel.fromCol" class="fx-select" aria-label="From column"><option v-for="c in colsOf(rel.fromTable)" :key="c" :value="c">{{ c }}</option></select>
        </div>
        <span class="md-card-arrow" aria-hidden="true">→</span>
        <div class="md-relside">
          <span class="fx-field__label">To table</span>
          <select v-model="rel.toTable" class="fx-select" aria-label="To table"><option v-for="t in m.tables" :key="t.name" :value="t.name">{{ t.name }}</option></select>
          <select v-model="rel.toCol" class="fx-select" aria-label="To column"><option v-for="c in colsOf(rel.toTable)" :key="c" :value="c">{{ c }}</option></select>
        </div>
      </div>
      <label class="fx-check"><input v-model="rel.both" type="checkbox" />Cross-filter direction: Both</label>
      <label class="fx-check"><input v-model="rel.active" type="checkbox" />Make this relationship active</label>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!rel.fromCol || !rel.toCol" @click="addRel">Save</button>
        <button type="button" class="fx-btn" @click="dialog = ''">Close</button>
      </template>
    </FxModal>

    <!-- Manage roles -->
    <FxModal v-if="dialog === 'roles' && m" title="Manage security roles" width="760px" @close="dialog = ''">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ dlgError }}</span></div>
      <div class="md-roles">
        <div class="md-rolelist">
          <div class="fx-field__label">Roles</div>
          <button v-for="r in m.roles" :key="r.name" type="button" class="fx-node" :class="{ 'is-selected': role.orig === r.name }" @click="pickRole(r)">
            <FxIcon name="lock" />{{ r.name }}</button>
          <p v-if="!m.roles.length" class="fx-muted md-small md-p">No roles yet.</p>
          <button type="button" class="fx-btn fx-btn--sm md-newrole" @click="pickRole(null)"><FxIcon name="plus" :size="12" />New role</button>
        </div>
        <div class="md-roleedit">
          <div class="fx-field"><label for="md-rname">Role name<span class="fx-field__req">*</span></label>
            <input id="md-rname" v-model="role.name" class="fx-input" :disabled="!!role.orig" /></div>
          <div class="fx-field"><span class="fx-field__label">Filter data - table</span>
            <select v-model="role.table" class="fx-select" aria-label="Table">
              <option value="">(no change)</option>
              <option v-for="t in m.tables" :key="t.name" :value="t.name">{{ t.name }}</option></select></div>
          <div v-if="role.table" class="fx-field"><label for="md-rfilter">Table filter DAX expression</label>
            <textarea id="md-rfilter" v-model="role.filter" class="fx-code md-dax" spellcheck="false" placeholder='[group_name] = "Service Desk"' />
            <span class="fx-field__help">Leave empty to remove this table's filter.</span></div>
          <div v-if="role.orig" class="md-small">Current filters:
            <ul><li v-for="f in currentRole?.filters || []" :key="f.table"><span class="fx-mono">{{ f.table }}: {{ f.expression }}</span></li>
              <li v-if="!(currentRole?.filters || []).length" class="fx-muted">None</li></ul></div>
          <div class="fx-field"><label for="md-rmembers">Members</label>
            <input id="md-rmembers" v-model="role.members" class="fx-input" placeholder="user@acmepay.com, sg-ops-analysts" />
            <span class="fx-field__help">Comma-separated people or groups.</span></div>
        </div>
      </div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!role.name.trim()" @click="saveRole">Save</button>
        <button v-if="role.orig" type="button" class="fx-btn" @click="deleteRole">Delete role</button>
        <button type="button" class="fx-btn" @click="dialog = ''">Close</button>
      </template>
    </FxModal>

    <FxModal v-if="dialog === 'delmeasure' && editing" :title="'Delete measure ' + editing.orig + '?'" @close="dialog = ''">
      <p class="md-p">Visuals and other measures that use <b>[{{ editing.orig }}]</b> will stop working.</p>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--danger" @click="deleteMeasure">Delete</button>
        <button type="button" class="fx-btn" @click="dialog = ''">Cancel</button>
      </template>
    </FxModal>
    <ItemSettingsPanel v-if="settings && item" :item="item" :tab="settings" @close="settings = ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import FxIcon from './FxIcon.vue';
import FxModal from './FxModal.vue';
import FxGrid from './FxGrid.vue';
import ItemHeader from './ItemHeader.vue';
import ItemSettingsPanel from './ItemSettingsPanel.vue';
import { cli, errorText, gridsOf, itemPath, messagesOf, rows, useFabric, type Grid } from './fabric';

const { portal, view, route, go, run, api } = useFabric();
const wsName = computed(() => String(route.value.ws || ''));
const itemName = computed(() => String(route.value.item || ''));
const item = computed(() => rows(portal.value, 'items').find(i => i.workspace === wsName.value
  && i.name === itemName.value && i.type === 'SemanticModel'));
const m = computed<any>(() => rows(portal.value, 'models').find(x => x.workspace === wsName.value && x.name === itemName.value));
const path = computed(() => itemPath(wsName.value, itemName.value, 'SemanticModel'));
const bpa = computed(() => rows(view.value, 'bpa').filter(f => f.model === itemName.value));

const settings = ref('');
const mode = ref(route.value.tab === 'dax' ? 'dax' : 'model');
const selTable = ref('');
const dialog = ref('');
const dlgError = ref('');
const propError = ref('');

function setMode(value: string) {
  mode.value = value;
  go({ ...route.value, tab: value === 'dax' ? 'dax' : '' });
}

async function exec(command: string, success: string, target: 'dlg' | 'prop' = 'dlg') {
  dlgError.value = ''; propError.value = '';
  const r = await run(command, success, { quiet: true });
  if (!r.ok) { if (target === 'dlg') dlgError.value = errorText(r); else propError.value = errorText(r); }
  return r.ok;
}

// Measures
const editing = ref<null | { orig: string; name: string; table: string; expression: string; format: string;
  value?: unknown; error?: string }>(null);
function newMeasure() {
  propError.value = '';
  const table = selTable.value || m.value?.tables[0]?.name || '';
  const names = new Set((m.value?.tables || []).flatMap((t: any) => t.measures.map((x: any) => x.name)));
  let n = 1; while (names.has(`Measure ${n}`)) n++;
  editing.value = { orig: '', name: `Measure ${n}`, table, expression: `COUNTROWS(${table})`, format: '' };
}
function editMeasure(table: string, mm: Record<string, any>) {
  propError.value = '';
  editing.value = { orig: mm.name, name: mm.name, table, expression: mm.expression, format: mm.format || '',
    value: mm.value, error: mm.error };
}
watch(m, value => {
  if (!editing.value?.orig || !value) return;
  const found = value.tables.flatMap((t: any) => t.measures).find((x: any) => x.name === editing.value!.orig);
  if (found) { editing.value.value = found.value; editing.value.error = found.error; }
  else editing.value = null;
});
async function saveMeasure() {
  const e = editing.value;
  if (!e) return;
  // The format is always sent (an empty one is written as '' and means General).
  const ok = await exec(cli(['fab', 'model', 'measure', 'set', path.value, '--table', e.table, '--name', e.name.trim(),
    '--expression', e.expression.trim(), '--format', e.format]), `${e.orig ? 'Saved' : 'Created'} measure ${e.name.trim()}`, 'prop');
  if (ok) {
    e.orig = e.name.trim();
    const found = (m.value?.tables || []).flatMap((t: any) => t.measures).find((x: any) => x.name === e.orig);
    if (found) { e.value = found.value; e.error = found.error; }
  }
}
async function deleteMeasure() {
  const e = editing.value;
  if (!e) return;
  if (await exec(cli(['fab', 'model', 'measure', 'rm', path.value], { '--name': e.orig }), `Deleted measure ${e.orig}`)) {
    editing.value = null;
    dialog.value = '';
  }
}

// Relationships
const rel = reactive({ fromTable: '', fromCol: '', toTable: '', toCol: '', both: false, active: true });
function colsOf(table: string): string[] {
  return (m.value?.tables.find((t: any) => t.name === table)?.columns || []).map((c: any) => c.name);
}
watch(m, value => {
  if (!value) return;
  if (!rel.fromTable) rel.fromTable = value.tables[0]?.name || '';
  if (!rel.toTable) rel.toTable = value.tables[1]?.name || value.tables[0]?.name || '';
}, { immediate: true });
watch(() => rel.fromTable, t => { rel.fromCol = colsOf(t).find(c => /_key$|_id$/.test(c)) || colsOf(t)[0] || ''; }, { immediate: true });
watch(() => rel.toTable, t => { rel.toCol = colsOf(t).find(c => c === rel.fromCol) || colsOf(t).find(c => /_key$|_id$/.test(c)) || colsOf(t)[0] || ''; }, { immediate: true });
async function addRel() {
  await exec(cli(['fab', 'model', 'relationship', 'add', path.value], { '--from': `${rel.fromTable}.${rel.fromCol}`,
    '--to': `${rel.toTable}.${rel.toCol}`, '--both': rel.both, '--inactive': !rel.active }), 'Relationship created');
}
async function deleteRel(name: string) {
  await exec(cli(['fab', 'model', 'relationship', 'rm', path.value], { '--name': name }), 'Relationship deleted');
}

// Roles
const role = reactive({ orig: '', name: '', table: '', filter: '', members: '' });
const currentRole = computed(() => m.value?.roles.find((r: any) => r.name === role.orig));
function pickRole(r: Record<string, any> | null) {
  role.orig = r?.name || '';
  role.name = r?.name || 'New role';
  role.table = r?.filters?.[0]?.table || '';
  role.filter = r?.filters?.[0]?.expression || '';
  role.members = (r?.members || []).join(', ');
}
function openRoles() {
  dlgError.value = '';
  pickRole(m.value?.roles[0] || null);
  dialog.value = 'roles';
}
watch(() => role.table, t => {
  const f = currentRole.value?.filters?.find((x: any) => x.table === t);
  role.filter = f?.expression || '';
});
async function saveRole() {
  const name = role.name.trim();
  // An emptied filter or member list is sent as '' so the engine clears it.
  const words: string[] = ['fab', 'model', 'role', 'set', path.value, '--name', name];
  if (role.table) words.push('--table', role.table, '--filter', role.filter.trim());
  words.push('--members', role.members.trim());
  if (await exec(cli(words), `Role ${name} saved`)) role.orig = name;
}
async function deleteRole() {
  if (await exec(cli(['fab', 'model', 'role', 'rm', path.value], { '--name': role.orig }), `Role ${role.orig} deleted`)) {
    pickRole(m.value?.roles.find((r: any) => r.name !== role.orig) || null);
  }
}

async function refresh() { await run(cli(['fab', 'model', 'refresh', path.value]), `Refresh of ${itemName.value} succeeded`); }
async function analyze() {
  const r = await run(cli(['fab', 'model', 'analyze', path.value]), '', { quiet: true });
  api.notify(r.ok ? 'info' : 'error', 'Best Practice Analyzer', r.ok ? (r.output || '').split('\n')[0] : errorText(r));
  editing.value = null;
}

// DAX query view
const daxText = ref('EVALUATE\n    TOPN(10, ' + (rows(portal.value, 'models').find(x => x.name === itemName.value)?.tables?.[0]?.name || 'Table') + ')');
const impersonate = ref('');
const daxGrid = ref<Grid | null>(null);
const daxError = ref('');
const daxInfo = ref('');
const daxRunning = ref(false);
async function runDax() {
  daxRunning.value = true;
  daxError.value = '';
  const header = [`-- model: ${itemName.value}`];
  if (impersonate.value) header.push(`-- role: ${impersonate.value}`);
  const text = /--\s*model\s*:/i.test(daxText.value) ? daxText.value : header.join('\n') + '\n' + daxText.value;
  const r = await api.exec(text, { surface: 'fabric_dax', quiet: true });
  daxRunning.value = false;
  daxGrid.value = r.ok ? gridsOf(r).pop() || null : null;
  daxInfo.value = r.ok ? messagesOf(r).join('\n') : '';
  if (!r.ok) daxError.value = errorText(r);
}
</script>

<style scoped>
.md-views { display: flex; gap: 2px; padding: 4px 12px 0; border-bottom: 1px solid #e0e0e0; }
.md-view { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border: 1px solid transparent; border-bottom: 0; border-radius: 4px 4px 0 0; background: transparent; font: 13px "Segoe UI", sans-serif; color: #424242; cursor: pointer; }
.md-view.is-on { background: #fff; border-color: #e0e0e0; color: #242424; font-weight: 600; margin-bottom: -1px; }
.md-diagram { overflow: auto; background-color: #fafafa; background-image: radial-gradient(#dcdcdc 1px, transparent 1px); background-size: 16px 16px; }
.md-cards { display: flex; flex-wrap: wrap; gap: 20px; padding: 20px; align-items: flex-start; }
.md-card { width: 220px; background: #fff; border: 1px solid #d1d1d1; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,.08); cursor: pointer; }
.md-card.is-sel { border-color: #117865; box-shadow: 0 0 0 1px #117865; }
.md-card__head { display: flex; align-items: center; gap: 6px; padding: 8px 10px; font-weight: 600; font-size: 13px; border-bottom: 1px solid #e0e0e0; background: #f5f5f5; border-radius: 6px 6px 0 0; }
.md-mode { margin-left: auto; font-weight: 400; font-size: 12px; color: #616161; }
.md-card__list { list-style: none; margin: 0; padding: 4px 0; max-height: 300px; overflow: auto; }
.md-card__list li { padding: 2px 10px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.md-measure { color: #242424; cursor: pointer; }
.md-measure:hover, .md-measure.is-sel { background: #e6f2ef; }
.md-calc { display: inline-block; width: 16px; color: #117865; font-weight: 600; }
.md-warn { color: #c50f1f; margin-left: 4px; }
.md-col { color: #424242; padding-left: 26px !important; }
.md-col.is-hidden { color: #8a8a8a; }
.md-pad { padding-left: 20px; padding-right: 20px; }
.md-rels { list-style: none; margin: 0; font-size: 13px; display: flex; flex-direction: column; gap: 6px; padding-bottom: 20px; }
.md-card-arrow { color: #616161; padding: 0 4px; }
.md-props { width: 300px; flex: none; border-left: 1px solid #e0e0e0; overflow: auto; padding: 12px 14px; background: #fff; }
.md-props__head { font-weight: 600; margin: 4px 0 10px; }
.md-dax { white-space: pre-wrap; min-height: 90px; border: 1px solid #d1d1d1; border-radius: 4px; }
.md-value { font-size: 13px; margin-bottom: 12px; }
.md-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.md-small { font-size: 12px; }
.md-tree { list-style: none; padding: 0; margin: 0; font-size: 13px; }
.md-tree > li { display: block; margin-bottom: 6px; }
.md-tree > li > .fx-ico { vertical-align: -4px; margin-right: 6px; }
.md-relwrap { margin: 0 -2px; }
.md-tree ul { list-style: none; padding-left: 22px; margin: 2px 0; }
.md-bpa { padding-left: 0; list-style: none; font-size: 12px; display: flex; flex-direction: column; gap: 4px; }
.md-daxview { min-height: 0; }
.md-daxbar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; flex-wrap: wrap; }
.md-imp { width: 220px; min-height: 24px; padding: 2px 28px 2px 8px; }
.md-daxed { height: 32%; min-height: 110px; border-top: 1px solid #f0f0f0; border-bottom: 1px solid #e0e0e0; }
.md-info { margin: 0; padding: 6px 12px; font: 12px Consolas, monospace; color: #616161; border-top: 1px solid #e0e0e0; white-space: pre-wrap; }
.md-relform { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 8px; align-items: center; margin-bottom: 12px; }
.md-relside { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.md-relform .fx-select { width: 100%; }
.md-roles { display: flex; gap: 16px; }
.md-rolelist { width: 200px; flex: none; display: flex; flex-direction: column; gap: 4px; }
.md-roleedit { flex: 1; min-width: 0; }
.md-newrole { align-self: flex-start; margin-top: 4px; }
.md-p { margin: 0 0 8px; }
@container sl-portal (max-width: 700px) {
  .md-split { flex-direction: column; }
  .md-props { width: auto; border-left: 0; border-top: 1px solid #e0e0e0; max-height: 45%; }
  .md-relform { grid-template-columns: minmax(0, 1fr); }
  .md-relform .md-card-arrow { display: none; }
  .md-roles { flex-direction: column; }
  .md-rolelist { width: auto; }
}
</style>
