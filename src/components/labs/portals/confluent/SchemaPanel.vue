<template>
  <div class="sp">
    <div v-if="topic" class="sp-switch" role="tablist" aria-label="Schema">
      <button type="button" :class="{ 'is-active': side === 'value' }" @click="side = 'value'">Value</button>
      <button type="button" :class="{ 'is-active': side === 'key' }" @click="side = 'key'">Key</button>
    </div>

    <!-- ===== Editing: set a schema / evolve the schema ===== -->
    <div v-if="editing" class="cc-card">
      <div class="cc-card__head"><h3 class="cc-h3">{{ subj ? 'Evolve schema' : 'Set a schema' }}</h3>
        <span class="cc-muted cc-small">Subject <span class="cc-mono">{{ current }}</span> · Avro</span></div>
      <div class="cc-card__body sp-edit">
        <textarea v-model="draft" class="cc-textarea" rows="18" spellcheck="false" aria-label="Schema"></textarea>
        <div v-if="draftError" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ draftError }}</span></div>
        <div v-if="check" class="cc-alert" :class="check.ok ? 'cc-alert--ok' : 'cc-alert--error'">
          <CcIcon :name="check.ok ? 'check-circle' : 'x-circle'" />
          <div><strong>{{ check.ok ? `Compatible with ${level}` : `Not compatible (${level})` }}</strong>
            <div v-for="(m, i) in check.messages" :key="i" class="sp-msg">{{ m }}</div></div>
        </div>
        <div class="cc-toolbar">
          <button v-if="subj" type="button" class="cc-btn" :disabled="cc.busy.value" @click="validate">Validate</button>
          <button type="button" class="cc-btn cc-btn--primary" :disabled="cc.busy.value" @click="save">Save</button>
          <button type="button" class="cc-btn cc-btn--ghost" @click="editing = false">Discard changes</button>
        </div>
      </div>
    </div>

    <!-- ===== No schema ===== -->
    <div v-else-if="!subj" class="cc-card cc-empty sp-none">
      <CcIcon name="schema" />
      <div><strong>No {{ side }} schema</strong></div>
      <div class="cc-muted">Subject <span class="cc-mono">{{ current }}</span> has no registered schema in Schema Registry.</div>
      <button type="button" class="cc-btn cc-btn--primary" @click="startSet">Set a schema</button>
    </div>

    <!-- ===== Viewing ===== -->
    <template v-else>
      <div class="cc-toolbar">
        <label class="cc-field sp-inline"><span class="cc-label">Version</span>
          <select v-model.number="version" class="cc-select" @change="loadVersion">
            <option v-for="v in [...subj.versions].reverse()" :key="v" :value="v">Version {{ v }}{{ v === subj.latest_version ? ' (current)' : '' }}</option>
          </select></label>
        <span class="cc-badge">Avro</span>
        <span class="cc-badge cc-badge--blue">Compatibility: {{ level }}</span>
        <span v-if="schemaId" class="cc-muted cc-small">Schema ID {{ schemaId }}</span>
        <span class="cc-spacer"></span>
        <button type="button" class="cc-btn" @click="openCompat"><CcIcon name="settings" />Edit compatibility mode</button>
        <button type="button" class="cc-btn cc-btn--primary" @click="startEvolve"><CcIcon name="edit" />Evolve schema</button>
        <button type="button" class="cc-btn cc-btn--danger-text" @click="removeVersion"><CcIcon name="trash" />Delete</button>
      </div>
      <div class="sp-grid">
        <div class="cc-table-wrap">
          <table class="cc-table">
            <thead><tr><th>Field</th><th>Type</th><th>Default</th><th>Doc</th></tr></thead>
            <tbody>
              <tr v-if="!fields.length"><td colspan="4" class="cc-empty">Not a record schema.</td></tr>
              <tr v-for="f in fields" :key="f.name"><td class="cc-mono">{{ f.name }}</td><td class="cc-mono">{{ f.type }}</td>
                <td class="cc-mono">{{ f.def }}</td><td class="cc-muted">{{ f.doc }}</td></tr>
            </tbody>
          </table>
        </div>
        <CcJson :text="shownSchema" />
      </div>
    </template>

    <CcModal v-if="compatOpen" title="Edit compatibility mode" ok-text="Save" :busy="cc.busy.value" :width="600"
             @close="compatOpen = false" @ok="saveCompat">
      <p class="cc-muted sp-p">Subject <span class="cc-mono">{{ current }}</span>. Schema Registry checks every new version against this mode.</p>
      <label v-for="row in COMPAT_LEVELS" :key="row[0]" class="sp-radio" :class="{ 'is-on': compatChoice === row[0] }">
        <input v-model="compatChoice" type="radio" name="compat" :value="row[0]" />
        <span><strong>{{ row[0] }}</strong><span class="cc-muted"> - {{ row[1] }}</span></span>
      </label>
      <div v-if="compatError" class="cc-alert cc-alert--error"><CcIcon name="x-circle" /><span>{{ compatError }}</span></div>
    </CcModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { cli, errorText, parseJson } from '@/utils/portalKit';
import CcIcon from './CcIcon.vue';
import CcJson from './CcJson.vue';
import CcModal from './CcModal.vue';
import { useCc } from './ccContext';
import { COMPAT_LEVELS, pretty, registryCurl, restError, schemaFields } from './confluent';

const props = defineProps<{ subject: string; topic?: string }>();
const cc = useCc();

const side = ref<'value' | 'key'>(props.subject.endsWith('-key') ? 'key' : 'value');
const current = computed(() => (props.topic ? `${props.topic}-${side.value}` : props.subject));
const subj = computed(() => cc.subject(current.value));
const level = computed(() => subj.value?.compatibility || cc.registryCompat.value);
const version = ref(0);
const loaded = ref<{ version: number; schema: string; id: number } | null>(null);

watch(subj, s => { if (s && !s.versions.includes(version.value)) { version.value = s.latest_version; loaded.value = null; } }, { immediate: true });
watch(current, () => { editing.value = false; loaded.value = null; version.value = subj.value?.latest_version || 0; });

const shownSchema = computed(() => {
  if (loaded.value && loaded.value.version === version.value) return loaded.value.schema;
  return subj.value?.latest_schema || '';
});
const schemaId = computed(() => (loaded.value && loaded.value.version === version.value ? loaded.value.id : subj.value?.latest_id));
const fields = computed(() => schemaFields(shownSchema.value));

async function loadVersion() {
  if (!subj.value || version.value === subj.value.latest_version) { loaded.value = null; return; }
  const result = await cc.run(registryCurl('GET', `/subjects/${encodeURIComponent(current.value)}/versions/${version.value}`), { quiet: true });
  const body = parseJson<any>(String(result.output || ''));
  if (result.ok && body?.schema) loaded.value = { version: version.value, schema: String(body.schema), id: Number(body.id) };
}

/* -------- set / evolve -------- */
const editing = ref(false);
const draft = ref('');
const draftError = ref('');
const check = ref<{ ok: boolean; messages: string[] } | null>(null);

function startSet() {
  const base = (props.topic || current.value).replace(/[^A-Za-z0-9_]/g, '_');
  draft.value = JSON.stringify({
    type: 'record', name: side.value === 'key' ? 'Key' : 'Value', namespace: 'io.shopflow.' + base.toLowerCase(),
    fields: [{ name: 'id', type: 'string' }],
  }, null, 2);
  draftError.value = '';
  check.value = null;
  editing.value = true;
}
function startEvolve() {
  draft.value = pretty(subj.value?.latest_schema || '');
  draftError.value = '';
  check.value = null;
  editing.value = true;
}
function compact(): string {
  try {
    return JSON.stringify(JSON.parse(draft.value));
  } catch (problem: any) {
    draftError.value = 'The schema is not valid JSON: ' + String(problem?.message || problem);
    return '';
  }
}
async function validate() {
  draftError.value = '';
  check.value = null;
  const text = compact();
  if (!text) return;
  const result = await cc.run(cli(['schema-registry', 'compatibility'], { '--subject': current.value, '--schema': text }), { quiet: true });
  if (!result.ok) { draftError.value = errorText(result); return; }
  const body = parseJson<any>(String(result.output || ''));
  check.value = { ok: Boolean(body?.is_compatible), messages: Array.isArray(body?.messages) ? body.messages.map(String) : [] };
}
async function save() {
  draftError.value = '';
  const text = compact();
  if (!text) return;
  const result = await cc.run(cli(['schema-registry', 'register'], { '--subject': current.value, '--schema': text }), { quiet: true });
  if (!result.ok) {
    const body = parseJson<any>(String(result.error || result.output || ''));
    draftError.value = body?.message ? String(body.message) : errorText(result);
    return;
  }
  cc.notify('success', `Schema saved for ${current.value}`, String(result.output || '').split('\n').slice(-1)[0]?.replace(/[()]/g, '') || '');
  editing.value = false;
  loaded.value = null;
  version.value = subj.value?.latest_version || 0;
}

/* -------- compatibility -------- */
const compatOpen = ref(false);
const compatChoice = ref('BACKWARD');
const compatError = ref('');
function openCompat() {
  compatChoice.value = level.value;
  compatError.value = '';
  compatOpen.value = true;
}
async function saveCompat() {
  const result = await cc.run(cli(['schema-registry', 'config'], { '--subject': current.value, '--set': compatChoice.value }),
    { success: `Compatibility mode of ${current.value} set to ${compatChoice.value}`, quiet: true });
  if (!result.ok) { compatError.value = errorText(result); return; }
  compatOpen.value = false;
}

/* -------- delete -------- */
async function removeVersion() {
  if (!subj.value) return;
  const only = subj.value.versions.length === 1;
  const ok = await cc.confirm({
    title: only ? 'Delete subject' : `Delete version ${version.value}`,
    message: only
      ? `Deleting the only version deletes subject ${current.value}. Producers that use this schema will fail to serialize new records.`
      : `Version ${version.value} of ${current.value} will be soft-deleted from Schema Registry.`,
    yes: 'Delete', danger: true, typeToConfirm: only ? current.value : undefined,
  });
  if (!ok) return;
  const result = only
    ? await cc.run(cli(['schema-registry', 'delete'], { '--subject': current.value }), { success: `Subject ${current.value} deleted` })
    : await cc.run(registryCurl('DELETE', `/subjects/${encodeURIComponent(current.value)}/versions/${version.value}`), { quiet: true });
  const rest = result.ok ? restError(result.output) : '';
  if (rest) { cc.notify('error', 'The request failed', rest); return; }
  if (!only && result.ok) cc.notify('success', `Version ${version.value} deleted`);
  if (result.ok) loaded.value = null;
}
</script>

<style scoped src="./cc.css"></style>
<style scoped>
.sp { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.sp-switch { display: inline-flex; border: 1px solid var(--cc-border-strong); border-radius: 4px; overflow: hidden; align-self: flex-start; }
.sp-switch button { border: 0; background: #fff; padding: 6px 16px; font: inherit; font-weight: 600; color: var(--cc-text-2); cursor: pointer; }
.sp-switch button + button { border-left: 1px solid var(--cc-border-strong); }
.sp-switch button.is-active { background: var(--cc-primary); color: #fff; }
.sp-inline { flex-direction: row; align-items: center; gap: 6px; }
.sp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 12px; align-items: start; }
.sp-none { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.sp-none .cc-ico { width: 28px; height: 28px; color: var(--cc-text-3); }
.sp-edit { display: flex; flex-direction: column; gap: 10px; }
.sp-msg { font-family: var(--cc-mono); font-size: 12px; margin-top: 4px; }
.sp-p { margin: 0; }
.sp-radio { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border: 1px solid var(--cc-border); border-radius: 4px; cursor: pointer; }
.sp-radio.is-on { border-color: var(--cc-primary); background: var(--cc-blue-bg); }
.sp-radio input { margin-top: 3px; }
</style>
