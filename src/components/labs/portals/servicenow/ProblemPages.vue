<template>
  <SnList v-if="route.page === 'problem_list'" title="Problems" :columns="COLUMNS" :rows="model.problems" :crumbs="[]" table="problem" :api="api"
          @new="$emit('navigate', { page: 'problem', id: '-1' })" @open="r => $emit('navigate', { page: 'problem', id: r.number })">
    <template #cell="{ row, col }">
      <button v-if="col.key === 'number'" type="button" class="link" @click="$emit('navigate', { page: 'problem', id: row.number })">{{ row.number }}</button>
      <span v-else-if="col.key === 'state'"><i class="dot" :class="row.state === 'Resolved' ? 'dot--resolved' : 'dot--new'"></i>{{ row.state }}</span>
      <span v-else-if="col.key === 'known_error'">{{ row.known_error ? 'true' : 'false' }}</span>
      <span v-else-if="col.key === 'incidents'">{{ row.incidents.length }}</span>
      <template v-else>{{ (row as any)[col.key] }}</template>
    </template>
  </SnList>

  <div v-else class="form-page">
    <div class="bar">
      <button type="button" class="icon-btn" aria-label="Back" @click="$emit('navigate', { page: 'problem_list' })">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" /></svg>
      </button>
      <div class="title"><span class="title__table">Problem</span><span class="title__no">{{ isNew ? 'New record' : number }}</span></div>
      <span v-if="record && record.known_error" class="pill pill--warning">Known error</span>
      <span class="bar__spacer"></span>
      <button v-if="isNew" type="button" class="btn btn--primary" :disabled="busy" @click="submit">Submit</button>
      <template v-else-if="record">
        <button type="button" class="btn btn--primary" :disabled="busy || locked" @click="update">Update</button>
        <button type="button" class="btn" :disabled="busy || locked || !draft.workaround.trim()" @click="knownError">Create Known Error</button>
        <button type="button" class="btn" :disabled="busy || locked" @click="resolveProblem">Resolve</button>
        <button type="button" class="btn btn--danger" :disabled="busy" @click="confirmDelete = true">Delete</button>
      </template>
    </div>
    <div class="scroll">
      <div v-if="!isNew && !record" class="empty">Record not found.</div>
      <template v-else>
        <div v-if="missing.length" class="mandatory" role="alert">The following mandatory fields are not filled in: {{ missing.join(', ') }}</div>
        <ol class="flow">
          <li v-for="s in FLOW" :key="s" :class="{ 'is-current': (record ? record.state : 'New') === s, 'is-done': FLOW.indexOf(record ? record.state : 'New') > FLOW.indexOf(s) }">{{ s }}</li>
        </ol>
        <div class="form-grid sheet">
          <div class="field"><label class="field__label">Number</label><input class="input" :value="isNew ? nextNo : number" readonly /></div>
          <div class="field"><label class="field__label">State</label><input class="input" :value="record ? record.state : 'New'" readonly /></div>
          <div class="field">
            <label class="field__label" for="prb-ci">Configuration item</label>
            <select id="prb-ci" v-model="draft.ci" class="select" :disabled="locked">
              <option value="">-- None --</option>
              <option v-for="ci in model.choices.cis" :key="ci" :value="ci">{{ ci }}</option>
            </select>
          </div>
          <div class="field"><label class="field__label">Opened</label><input class="input" :value="record ? record.opened : model.time" readonly /></div>
          <div class="field field--wide">
            <label class="field__label" for="prb-short"><span class="field__req" :class="{ 'is-met': draft.short }">*</span>Problem statement</label>
            <input id="prb-short" v-model="draft.short" class="input" :class="{ 'is-invalid': missing.includes('Problem statement') }" :readonly="locked" />
          </div>
          <div class="field field--wide">
            <label class="field__label" for="prb-desc">Description</label>
            <textarea id="prb-desc" v-model="draft.description" class="textarea" :readonly="locked"></textarea>
          </div>
          <div v-if="isNew" class="field field--wide">
            <label class="field__label"><span class="field__req" :class="{ 'is-met': draft.incidents.length }">*</span>Related incidents</label>
            <div>
              <div class="checks" :class="{ 'is-invalid': missing.includes('Related incidents') }">
                <label v-for="i in model.incidents" :key="i.number" class="checks__row">
                  <input v-model="draft.incidents" type="checkbox" :value="i.number" /> {{ i.number }} — {{ i.short }} <span class="muted">({{ i.state }})</span>
                </label>
                <span v-if="!model.incidents.length" class="muted">No incidents.</span>
              </div>
              <div class="field__help">A problem record exists to find the cause of one or more incidents.</div>
            </div>
          </div>
        </div>
        <template v-if="!isNew && record">
          <div class="tabs tabsm" role="tablist">
            <button v-for="t in ['Analysis Information', 'Resolution Information']" :key="t" type="button" class="tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
          </div>
          <div v-if="tab === 'Analysis Information'" class="form-grid form-grid--one sheet">
            <div class="field">
              <label class="field__label" for="prb-wa">Workaround</label>
              <div><textarea id="prb-wa" v-model="draft.workaround" class="textarea" :readonly="locked"></textarea>
                <div class="field__help">Publishing a workaround makes this a Known Error the Service Desk can use at first contact.</div></div>
            </div>
            <div class="field">
              <label class="field__label" for="prb-cause">Cause notes</label>
              <div><textarea id="prb-cause" v-model="draft.cause" class="textarea" :readonly="locked"></textarea>
                <div class="field__help">Say what in the system let it happen (five words at least). "Human error" is where an investigation starts, not where it ends.</div></div>
            </div>
          </div>
          <div v-else class="form-grid sheet">
            <div class="field">
              <label class="field__label" for="prb-fix">Fix change</label>
              <select id="prb-fix" v-model="draft.fix" class="select" :disabled="locked">
                <option value="">-- None --</option>
                <option v-for="c in model.changes" :key="c.number" :value="c.number">{{ c.number }} - {{ c.short }} ({{ c.state }})</option>
              </select>
            </div>
            <div class="field"><label class="field__label">Known error</label><input class="input" :value="record.known_error ? 'true' : 'false'" readonly /></div>
          </div>
          <div class="related">
            <div class="tabs"><span class="tab is-active">Incidents ({{ linked.length }})</span>
              <span class="bar__spacer"></span>
              <select v-model="addInc" class="select add" aria-label="Add incident" :disabled="locked">
                <option value="">Add incident…</option>
                <option v-for="i in model.incidents.filter(x => !linked.some(l => l.number === x.number))" :key="i.number" :value="i.number">{{ i.number }}</option>
              </select>
              <button type="button" class="btn btn--sm" :disabled="!addInc || busy" @click="link">Add</button>
            </div>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Number</th><th>Short description</th><th>Priority</th><th>State</th><th>Resolution code</th></tr></thead>
                <tbody>
                  <tr v-for="i in linked" :key="i.number">
                    <td><button type="button" class="link" @click="$emit('navigate', { page: 'incident', id: i.number })">{{ i.number }}</button></td>
                    <td>{{ i.short }}</td><td><i class="dot" :class="'dot--p' + i.priority"></i>{{ PRIORITY_LABEL[i.priority] }}</td><td>{{ i.state }}</td><td>{{ i.resolution_code }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-if="!linked.length" class="empty">No records to display</div>
            </div>
          </div>
        </template>
      </template>
    </div>
    <SnModal v-if="confirmDelete" title="Confirmation" size="sm" @close="confirmDelete = false">
      <p>Delete this record?</p>
      <p class="muted">{{ record?.incidents.length || 0 }} incident(s) will be unlinked from {{ number }}. Only a New problem with no investigation recorded can be deleted.</p>
      <template #footer>
        <button type="button" class="btn" @click="confirmDelete = false">Cancel</button>
        <button type="button" class="btn btn--danger-solid" :disabled="busy" @click="doDelete">Delete</button>
      </template>
    </SnModal>
  </div>
</template>

<script setup lang="ts">
/** problem_list.do / problem.do: problem management, known errors and the fix change. */
import { computed, reactive, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import SnList, { type Column } from './SnList.vue';
import SnModal from './SnModal.vue';
import { PRIORITY_LABEL, cmd, mintedNumber, nextNumber, type Model } from './snow';
import type { Route } from './route';

const props = defineProps<{ model: Model; api: PortalApi; route: Route }>();
const emit = defineEmits<{ (event: 'navigate', route: Route): void }>();

const COLUMNS: Column[] = [
  { key: 'number', label: 'Number' }, { key: 'short', label: 'Problem statement' }, { key: 'state', label: 'State' },
  { key: 'ci', label: 'Configuration item' }, { key: 'known_error', label: 'Known error', search: false },
  { key: 'incidents', label: 'Related incidents', search: false, numeric: true }, { key: 'fix_change', label: 'Fix change' },
  { key: 'opened', label: 'Opened' },
];
const FLOW = ['New', 'Root Cause Analysis', 'Known Error', 'Fix in Progress', 'Resolved'];

const number = computed(() => ('id' in props.route ? props.route.id : ''));
const preset = computed(() => ('preset' in props.route ? props.route.preset || {} : {}));
const isNew = computed(() => number.value === '-1');
const record = computed(() => props.model.problems.find(p => p.number === number.value));
const busy = computed(() => props.api.busy.value);
const locked = computed(() => record.value?.state === 'Resolved');
const nextNo = computed(() => nextNumber('PRB', 40000, props.model.problems.map(p => p.number)));
const linked = computed(() => props.model.incidents.filter(i => i.problem === number.value || record.value?.incidents.includes(i.number)));

const draft = reactive({ short: '', description: '', ci: '', workaround: '', cause: '', fix: '', incidents: [] as string[] });
const missing = ref<string[]>([]);
const tab = ref('Analysis Information');
const addInc = ref('');
const confirmDelete = ref(false);

function load() {
  const r = record.value;
  if (r) Object.assign(draft, { short: r.short, description: r.description, ci: r.ci, workaround: r.workaround, cause: r.cause, fix: r.fix_change, incidents: [...r.incidents] });
  else Object.assign(draft, { short: preset.value.short || '', description: '', ci: preset.value.ci || '', workaround: '', cause: '', fix: '',
    incidents: preset.value.incidents ? preset.value.incidents.split(',') : [] });
}
load();
// Reload only the fields nobody has typed into since the last load: a refresh
// in the middle of an edit must not throw the typing away.
watch(() => JSON.stringify(record.value), (_now, before) => {
  const r = record.value;
  if (!before || !r) { load(); return; }
  const o = JSON.parse(before);
  const map: [keyof typeof draft, string][] = [['short', 'short'], ['description', 'description'], ['ci', 'ci'],
    ['workaround', 'workaround'], ['cause', 'cause'], ['fix', 'fix_change']];
  for (const [d, k] of map) if (draft[d] === o[k]) (draft as any)[d] = (r as any)[k];
  draft.incidents = [...r.incidents];
});

async function steps(list: { line: string; success: string }[]) {
  for (const s of list) {
    const r = await props.api.exec(s.line, { success: s.success });
    if (!r.ok) return false;
  }
  return true;
}
async function submit() {
  missing.value = [];
  if (!draft.short.trim()) missing.value.push('Problem statement');
  if (!draft.incidents.length) missing.value.push('Related incidents');
  if (missing.value.length) return;
  const r = await props.api.exec(cmd.problemCreate(draft.short.trim(), draft.incidents, draft.ci || undefined, draft.description || undefined),
    { success: 'Problem created' });
  const n = mintedNumber(r.output, 'PRB');
  if (r.ok && n) emit('navigate', { page: 'problem', id: n });
}
async function update() {
  const r = record.value!;
  missing.value = draft.short.trim() ? [] : ['Problem statement'];
  if (missing.value.length) return;
  const list: { line: string; success: string }[] = [];
  const fields: { short?: string; description?: string; ci?: string } = {};
  if (draft.short !== r.short) fields.short = draft.short;
  if (draft.description !== r.description && draft.description) fields.description = draft.description;
  if (draft.ci !== r.ci && draft.ci) fields.ci = draft.ci;
  if (Object.keys(fields).length) list.push({ line: cmd.problemUpdate(r.number, fields), success: '' });
  if (draft.cause.trim() && draft.cause !== r.cause) list.push({ line: cmd.problemRca(r.number, draft.cause.trim()), success: '' });
  if (draft.workaround.trim() && draft.workaround !== r.workaround) list.push({ line: cmd.problemWorkaround(r.number, draft.workaround.trim()), success: '' });
  if (draft.fix && draft.fix !== r.fix_change) list.push({ line: cmd.problemFix(r.number, draft.fix), success: '' });
  if (!list.length) { props.api.notify('info', 'No changes to save.'); return; }
  list[list.length - 1].success = `${r.number} updated`;
  await steps(list);
}
async function knownError() {
  await steps([{ line: cmd.problemWorkaround(number.value, draft.workaround.trim()), success: `${number.value} published as a Known Error` }]);
}
async function resolveProblem() {
  await steps([{ line: cmd.problemClose(number.value), success: `${number.value} resolved` }]);
}
async function link() {
  if (await steps([{ line: cmd.incidentLink(addInc.value, 'problem', number.value), success: `${addInc.value} linked to ${number.value}` }])) addInc.value = '';
}
async function doDelete() {
  const ok = await steps([{ line: cmd.problemDelete(number.value), success: `${number.value} deleted` }]);
  confirmDelete.value = false;
  if (ok) emit('navigate', { page: 'problem_list' });
}
</script>

<style scoped src="./sn.css"></style>
<style scoped src="./form.css"></style>
