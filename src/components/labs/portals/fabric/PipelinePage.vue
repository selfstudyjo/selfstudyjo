<template>
  <div class="fx-page pl">
    <ItemHeader :name="itemName" type="DataPipeline" :label="item?.label" :endorsement="item?.endorsement"
                :status="dirty ? 'Unsaved changes' : 'Saved'" :tabs="['Home', 'Activities', 'Run', 'View']" :model-value="ribbon"
                @update:model-value="v => ribbon = v" @settings="settings = 'about'" @share="settings = 'share'" />
    <div class="fx-cmdbar">
      <template v-if="ribbon === 'Home' || ribbon === 'Run'">
        <button type="button" class="fx-cmd" :disabled="!dirty" @click="save"><FxIcon name="save" />Save</button>
        <button type="button" class="fx-cmd" @click="validate"><FxIcon name="check" />Validate</button>
        <button type="button" class="fx-cmd fx-cmd--primary" :disabled="!acts.length" @click="runNow"><FxIcon name="play" />Run</button>
        <button type="button" class="fx-cmd" @click="settings = 'schedule'"><FxIcon name="calendar" />Schedule</button>
        <button type="button" class="fx-cmd" @click="selected = -1; pane = 'output'"><FxIcon name="monitor" />View run history</button>
      </template>
      <template v-else-if="ribbon === 'Activities'">
        <button v-for="a in palette" :key="a.type" type="button" class="fx-cmd" @click="addActivity(a.type)">
          <FxIcon :name="a.icon" />{{ a.label }}</button>
      </template>
      <template v-else>
        <button type="button" class="fx-cmd" @click="openJson"><FxIcon name="code" />View JSON code</button>
      </template>
    </div>

    <div class="pl-canvas" @click.self="selected = -1">
      <div v-if="!acts.length" class="fx-empty pl-start">
        <FxIcon name="DataPipeline" :size="44" />
        <h3>Build a data pipeline to organize and move your data</h3>
        <p>Start with an activity from the Activities tab.</p>
        <div class="pl-starts">
          <button v-for="a in palette.slice(0, 3)" :key="a.type" type="button" class="fx-btn" @click="addActivity(a.type)">
            <FxIcon :name="a.icon" />{{ a.label }}</button>
        </div>
      </div>
      <div v-else class="pl-flow" @click.self="selected = -1">
        <template v-for="(level, li) in levels" :key="li">
          <div class="pl-col">
            <button v-for="ai in level" :key="acts[ai].name" type="button" class="pl-act"
                    :class="['is-' + statusOf(acts[ai].name).toLowerCase(), { 'is-sel': selected === ai }]"
                    @click.stop="selected = ai">
              <span class="pl-act__type"><FxIcon :name="iconFor(acts[ai].type)" :size="14" />{{ labelFor(acts[ai].type) }}</span>
              <span class="pl-act__name">{{ acts[ai].name }}</span>
              <span v-if="statusOf(acts[ai].name)" class="pl-act__status">{{ statusOf(acts[ai].name) }}</span>
            </button>
          </div>
          <div v-if="li < levels.length - 1" class="pl-arrow" aria-hidden="true">
            <svg width="40" height="12" viewBox="0 0 40 12"><path d="M0 6h34" stroke="#107c10" stroke-width="2" /><path d="m33 1 6 5-6 5z" fill="#107c10" /></svg>
          </div>
        </template>
      </div>
    </div>

    <!-- Bottom pane: properties of the selected activity, or parameters / output -->
    <div class="pl-pane">
      <div class="fx-tabs">
        <template v-if="sel">
          <button type="button" class="fx-tab" :class="{ 'is-active': actTab === 'general' }" @click="actTab = 'general'">General</button>
          <button type="button" class="fx-tab" :class="{ 'is-active': actTab === 'settings' }" @click="actTab = 'settings'">Settings</button>
        </template>
        <template v-else>
          <button type="button" class="fx-tab" :class="{ 'is-active': pane === 'parameters' }" @click="pane = 'parameters'">Parameters</button>
          <button type="button" class="fx-tab" :class="{ 'is-active': pane === 'output' }" @click="pane = 'output'">Output</button>
        </template>
      </div>
      <div class="pl-panebody">
        <template v-if="sel">
          <template v-if="actTab === 'general'">
            <div class="pl-grid">
              <div class="fx-field"><label for="pl-name">Name<span class="fx-field__req">*</span></label>
                <input id="pl-name" :value="sel.name" class="fx-input" @change="rename(($event.target as HTMLInputElement).value)" /></div>
              <div class="fx-field"><span class="fx-field__label">Depends on (on success)</span>
                <select class="fx-select" :value="(sel.dependsOn || [])[0]?.activity || ''" aria-label="Depends on"
                        @change="setDepends(($event.target as HTMLSelectElement).value)">
                  <option value="">(none)</option>
                  <option v-for="a in acts.filter(x => x.name !== sel!.name)" :key="a.name" :value="a.name">{{ a.name }}</option>
                </select></div>
              <div class="fx-field"><label for="pl-retry">Retry</label>
                <input id="pl-retry" :value="sel.policy?.retry || 0" class="fx-input" type="number" min="0" max="10"
                       @change="setRetry(Number(($event.target as HTMLInputElement).value))" /></div>
            </div>
            <button type="button" class="fx-btn fx-btn--sm" @click="removeActivity"><FxIcon name="delete" :size="12" />Delete activity</button>
          </template>
          <template v-else>
            <div v-if="sel.type === 'TridentNotebook'" class="fx-field"><span class="fx-field__label">Notebook<span class="fx-field__req">*</span></span>
              <select class="fx-select" :value="sel.typeProperties?.notebookId || ''" aria-label="Notebook"
                      @change="setProp('notebookId', ($event.target as HTMLSelectElement).value)">
                <option value="">Select…</option>
                <option v-for="n in notebooks" :key="n.name" :value="n.name">{{ n.name }}</option>
              </select></div>
            <div v-else-if="sel.type === 'Wait'" class="fx-field"><label for="pl-wait">Wait time in seconds<span class="fx-field__req">*</span></label>
              <input id="pl-wait" class="fx-input" type="number" min="1" :value="sel.typeProperties?.waitTimeInSeconds || 1"
                     @change="setProp('waitTimeInSeconds', Number(($event.target as HTMLInputElement).value))" /></div>
            <template v-else-if="sel.type === 'Fail'">
              <div class="fx-field"><label for="pl-fmsg">Fail message<span class="fx-field__req">*</span></label>
                <input id="pl-fmsg" class="fx-input" :value="sel.typeProperties?.message || ''" @change="setProp('message', ($event.target as HTMLInputElement).value)" /></div>
              <div class="fx-field"><label for="pl-fcode">Error code<span class="fx-field__req">*</span></label>
                <input id="pl-fcode" class="fx-input" :value="sel.typeProperties?.errorCode || ''" @change="setProp('errorCode', ($event.target as HTMLInputElement).value)" /></div>
            </template>
            <template v-else-if="sel.type === 'SqlServerStoredProcedure'">
              <div class="fx-field"><span class="fx-field__label">Warehouse</span>
                <select class="fx-select" :value="sel.typeProperties?.warehouse || ''" aria-label="Warehouse" @change="setProp('warehouse', ($event.target as HTMLSelectElement).value)">
                  <option v-for="w in warehouses" :key="w.name" :value="w.name">{{ w.name }}</option></select></div>
              <div class="fx-field"><label for="pl-sp">Stored procedure name</label>
                <input id="pl-sp" class="fx-input" :value="sel.typeProperties?.storedProcedureName || ''" @change="setProp('storedProcedureName', ($event.target as HTMLInputElement).value)" /></div>
            </template>
            <div v-else-if="sel.type === 'ExecutePipeline'" class="fx-field"><span class="fx-field__label">Invoked pipeline</span>
              <select class="fx-select" :value="sel.typeProperties?.pipeline?.referenceName || ''" aria-label="Pipeline"
                      @change="setProp('pipeline', { referenceName: ($event.target as HTMLSelectElement).value, type: 'PipelineReference' })">
                <option v-for="p in pipelines" :key="p.name" :value="p.name">{{ p.name }}</option></select></div>
            <pre v-else class="pl-json">{{ JSON.stringify(sel.typeProperties || {}, null, 2) }}</pre>
          </template>
        </template>
        <template v-else-if="pane === 'parameters'">
          <table class="fx-table"><thead><tr><th>Name</th><th>Default value</th></tr></thead>
            <tbody>
              <tr v-for="(v, k) in params" :key="k"><td>{{ k }}</td><td class="fx-mono">{{ v }}</td></tr>
              <tr v-if="!Object.keys(params).length"><td colspan="2" class="fx-muted">No parameters</td></tr>
            </tbody></table>
        </template>
        <template v-else>
          <table class="fx-table">
            <thead><tr><th>Run ID</th><th>Status</th><th>Trigger</th><th>Run start</th><th>Duration</th><th>Error</th><th /></tr></thead>
            <tbody>
              <tr v-for="r in runs" :key="r.id">
                <td class="fx-mono">{{ r.id.slice(0, 8) }}</td>
                <td><span class="fx-pill" :class="r.status === 'Succeeded' ? 'fx-pill--ok' : r.status === 'Failed' ? 'fx-pill--bad' : 'fx-pill--info'">{{ r.status }}</span></td>
                <td>{{ r.trigger }}</td><td>{{ r.start }}</td><td>{{ r.duration_s }}s</td>
                <td class="pl-err" :title="r.error">{{ r.error }}</td>
                <td><button v-if="r.status === 'Failed'" type="button" class="fx-btn fx-btn--sm" @click="rerun(r.id)">Rerun</button></td>
              </tr>
              <tr v-if="!runs.length"><td colspan="7" class="fx-muted">This pipeline hasn't run yet.</td></tr>
            </tbody>
          </table>
        </template>
      </div>
    </div>

    <FxModal v-if="json !== null" title="JSON code" width="720px" @close="json = null">
      <div v-if="jsonError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ jsonError }}</span></div>
      <textarea v-model="json" class="fx-code pl-jsoned" spellcheck="false" aria-label="Pipeline JSON" />
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" @click="saveJson">OK</button>
        <button type="button" class="fx-btn" @click="json = null">Cancel</button>
      </template>
    </FxModal>
    <ItemSettingsPanel v-if="settings && item" :item="item" :tab="settings" @close="settings = ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import FxIcon from './FxIcon.vue';
import FxModal from './FxModal.vue';
import ItemHeader from './ItemHeader.vue';
import ItemSettingsPanel from './ItemSettingsPanel.vue';
import { cli, errorText, itemPath, rows, useFabric } from './fabric';

const { portal, view, route, run, api } = useFabric();
const wsName = computed(() => String(route.value.ws || ''));
const itemName = computed(() => String(route.value.item || ''));
const item = computed(() => rows(portal.value, 'items').find(i => i.workspace === wsName.value
  && i.name === itemName.value && i.type === 'DataPipeline'));
const path = computed(() => itemPath(wsName.value, itemName.value, 'DataPipeline'));
const stored = computed(() => rows(portal.value, 'pipelines').find(p => p.workspace === wsName.value
  && p.name === itemName.value));
const notebooks = computed(() => rows(portal.value, 'items').filter(i => i.type === 'Notebook' && i.workspace === wsName.value));
const warehouses = computed(() => rows(portal.value, 'items').filter(i => i.type === 'Warehouse' && i.workspace === wsName.value));
const pipelines = computed(() => rows(portal.value, 'items').filter(i => i.type === 'DataPipeline'
  && i.workspace === wsName.value && i.name !== itemName.value));

const ribbon = ref('Home');
const settings = ref('');
const selected = ref(-1);
const actTab = ref('general');
const pane = ref('output');
const dirty = ref(false);
const doc = ref<Record<string, any>>({ properties: { activities: [] } });
const json = ref<string | null>(null);
const jsonError = ref('');

const palette = [
  { type: 'TridentNotebook', label: 'Notebook', icon: 'Notebook' },
  { type: 'Wait', label: 'Wait', icon: 'calendar' },
  { type: 'SqlServerStoredProcedure', label: 'Stored procedure', icon: 'Procedure' },
  { type: 'ExecutePipeline', label: 'Invoke pipeline', icon: 'DataPipeline' },
  { type: 'Fail', label: 'Fail', icon: 'error' },
];
const LABELS: Record<string, string> = { TridentNotebook: 'Notebook', Copy: 'Copy data', Lookup: 'Lookup',
  ForEach: 'ForEach', Script: 'Script', SqlServerStoredProcedure: 'Stored procedure', SetVariable: 'Set variable',
  IfCondition: 'If condition', Fail: 'Fail', Wait: 'Wait', Office365Outlook: 'Office 365 Outlook',
  TeamsNotification: 'Teams', ExecutePipeline: 'Invoke pipeline' };
function labelFor(type: string) { return LABELS[type] || type; }
function iconFor(type: string) {
  return ({ TridentNotebook: 'Notebook', Copy: 'DataPipeline', SqlServerStoredProcedure: 'Procedure', Wait: 'calendar',
    Fail: 'error', ExecutePipeline: 'DataPipeline', Lookup: 'search', ForEach: 'refresh', Script: 'code' } as Record<string, string>)[type] || 'sparkle';
}

function load() {
  if (dirty.value) return;
  try {
    const parsed = stored.value?.definition ? JSON.parse(stored.value.definition) : {};
    if (!parsed.properties) parsed.properties = { activities: parsed.activities || [] };
    if (!Array.isArray(parsed.properties.activities)) parsed.properties.activities = [];
    doc.value = parsed;
  } catch {
    doc.value = { properties: { activities: [] } };
  }
}
watch(stored, load, { immediate: true, deep: true });

const acts = computed<Record<string, any>[]>(() => doc.value.properties.activities);
const sel = computed(() => (selected.value >= 0 ? acts.value[selected.value] : null));
const params = computed(() => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.value.properties.parameters || {})) {
    out[k] = v && typeof v === 'object' ? (v as any).defaultValue : v;
  }
  return out;
});
watch(selected, () => { actTab.value = 'general'; });

// Lay the activities out left to right by dependency depth.
const levels = computed(() => {
  const depth = new Map<string, number>();
  const byName = new Map(acts.value.map((a, i) => [a.name, i]));
  const visit = (name: string, guard = 0): number => {
    if (depth.has(name)) return depth.get(name)!;
    const a = acts.value[byName.get(name) ?? -1];
    const deps = (a?.dependsOn || []).map((d: any) => d.activity).filter((d: string) => byName.has(d));
    const value = guard > 50 || !deps.length ? 0 : Math.max(...deps.map((d: string) => visit(d, guard + 1))) + 1;
    depth.set(name, value);
    return value;
  };
  acts.value.forEach(a => visit(a.name));
  const out: number[][] = [];
  acts.value.forEach((a, i) => { const d = depth.get(a.name) || 0; (out[d] ||= []).push(i); });
  return out.filter(Boolean);
});

const runs = computed(() => rows(portal.value, 'runs').filter(r => r.item === itemName.value).reverse());
const lastRunId = computed(() => runs.value[0]?.id?.slice(0, 8) || '');
function statusOf(name: string): string {
  const row = rows(view.value, 'activity_runs').find(a => a.run === lastRunId.value && a.activity === name && a.pipeline === itemName.value);
  return row ? String(row.status) : '';
}

function uniqueName(base: string) {
  const names = new Set(acts.value.map(a => a.name));
  let n = 1;
  while (names.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}

function addActivity(type: string) {
  const base = labelFor(type).replace(/\s+/g, '');
  const act: Record<string, any> = { name: uniqueName(base), type, dependsOn: [], typeProperties: {} };
  if (type === 'TridentNotebook') act.typeProperties = { notebookId: notebooks.value[0]?.name || '' };
  if (type === 'Wait') act.typeProperties = { waitTimeInSeconds: 30 };
  if (type === 'Fail') act.typeProperties = { message: 'Failed by the pipeline', errorCode: 'UserFail' };
  if (type === 'SqlServerStoredProcedure') act.typeProperties = { warehouse: warehouses.value[0]?.name || '', storedProcedureName: '' };
  if (type === 'ExecutePipeline') act.typeProperties = { pipeline: { referenceName: pipelines.value[0]?.name || '', type: 'PipelineReference' } };
  const last = acts.value[acts.value.length - 1];
  if (last) act.dependsOn = [{ activity: last.name, dependencyConditions: ['Succeeded'] }];
  acts.value.push(act);
  selected.value = acts.value.length - 1;
  actTab.value = 'settings';
  dirty.value = true;
}

function rename(value: string) {
  const name = value.trim();
  if (!sel.value || !name || acts.value.some(a => a !== sel.value && a.name === name)) return;
  const old = sel.value.name;
  sel.value.name = name;
  for (const a of acts.value) for (const d of a.dependsOn || []) if (d.activity === old) d.activity = name;
  dirty.value = true;
}
function setDepends(value: string) {
  if (!sel.value) return;
  sel.value.dependsOn = value ? [{ activity: value, dependencyConditions: ['Succeeded'] }] : [];
  dirty.value = true;
}
function setRetry(value: number) {
  if (!sel.value) return;
  sel.value.policy = { ...(sel.value.policy || {}), retry: value, retryIntervalInSeconds: 30 };
  dirty.value = true;
}
function setProp(key: string, value: unknown) {
  if (!sel.value) return;
  sel.value.typeProperties = { ...(sel.value.typeProperties || {}), [key]: value };
  dirty.value = true;
}
function removeActivity() {
  if (!sel.value) return;
  const name = sel.value.name;
  doc.value.properties.activities = acts.value.filter(a => a.name !== name);
  for (const a of acts.value) a.dependsOn = (a.dependsOn || []).filter((d: any) => d.activity !== name);
  selected.value = -1;
  dirty.value = true;
}

async function save() {
  const r = await run(cli(['fab', 'set', path.value], { '-q': 'definition', '-i': JSON.stringify(doc.value) }),
    `Saved ${itemName.value}`);
  if (r.ok) { dirty.value = false; load(); }
  return r.ok;
}
function validate() {
  const problems: string[] = [];
  for (const a of acts.value) {
    if (a.type === 'TridentNotebook' && !a.typeProperties?.notebookId) problems.push(`${a.name}: select a notebook`);
    if (a.type === 'SqlServerStoredProcedure' && !a.typeProperties?.storedProcedureName) problems.push(`${a.name}: enter a stored procedure`);
  }
  if (problems.length) api.notify('warning', 'Pipeline validation output', problems.join('; '));
  else api.notify('success', 'Your pipeline has been validated. No errors were found.');
}
async function runNow() {
  if (dirty.value && !await save()) return;
  pane.value = 'output';
  selected.value = -1;
  await run(cli(['fab', 'job', 'run', path.value]), `Pipeline ${itemName.value} run finished`);
}
async function rerun(id: string) {
  await run(cli(['fab', 'job', 'run', path.value], { '--rerun': id.slice(0, 8) }), 'Rerun from the failed activity finished');
}
function openJson() {
  jsonError.value = '';
  json.value = JSON.stringify({ name: itemName.value, ...doc.value }, null, 2);
}
async function saveJson() {
  try {
    const parsed = JSON.parse(json.value || '{}');
    delete parsed.name;
    const r = await run(cli(['fab', 'set', path.value], { '-q': 'definition', '-i': JSON.stringify(parsed) }),
      `Saved ${itemName.value}`, { quiet: true });
    if (!r.ok) { jsonError.value = errorText(r); return; }
    dirty.value = false;
    json.value = null;
  } catch (e: any) {
    jsonError.value = `Invalid JSON: ${e?.message || e}`;
  }
}
</script>

<style scoped>
.pl-canvas { flex: 1; min-height: 160px; overflow: auto; background-color: #fafafa; background-image: radial-gradient(#d6d6d6 1px, transparent 1px); background-size: 16px 16px; }
.pl-start { background: transparent; }
.pl-starts { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 10px; }
.pl-flow { display: flex; align-items: center; padding: 32px; min-width: max-content; }
.pl-col { display: flex; flex-direction: column; gap: 16px; }
.pl-arrow { padding: 0 6px; }
.pl-act { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; width: 180px; padding: 8px 10px; border: 1px solid #d1d1d1; border-left: 4px solid #0f6cbd; border-radius: 6px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.1); cursor: pointer; text-align: left; font: 13px "Segoe UI", sans-serif; }
.pl-act.is-sel { outline: 2px solid #117865; }
.pl-act.is-succeeded { border-left-color: #107c10; }
.pl-act.is-failed { border-left-color: #c50f1f; }
.pl-act__type { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #616161; }
.pl-act__name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.pl-act__status { font-size: 12px; }
.pl-act.is-failed .pl-act__status { color: #c50f1f; }
.pl-act.is-succeeded .pl-act__status { color: #107c10; }
.pl-pane { flex: 0 0 auto; height: 40%; min-height: 160px; display: flex; flex-direction: column; border-top: 1px solid #e0e0e0; }
.pl-panebody { flex: 1; overflow: auto; padding: 12px var(--fx-gutter); --fx-edge: 0px; }
.pl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0 16px; }
.pl-err { max-width: 320px; overflow: hidden; text-overflow: ellipsis; color: #c50f1f; }
.pl-json, .pl-jsoned { font: 12px Consolas, monospace; }
.pl-jsoned { min-height: 360px; border: 1px solid #d1d1d1; }
</style>
