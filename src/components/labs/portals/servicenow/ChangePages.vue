<template>
  <SnList v-if="route.page === 'change_list'" title="Change Requests" :columns="COLUMNS" :rows="model.changes" table="change_request" :api="api"
          @new="$emit('navigate', { page: 'change_new' })" @open="r => $emit('navigate', { page: 'change', id: r.number })">
    <template #cell="{ row, col }">
      <button v-if="col.key === 'number'" type="button" class="link" @click="$emit('navigate', { page: 'change', id: row.number })">{{ row.number }}</button>
      <span v-else-if="col.key === 'type'">{{ cap(row.type) }}</span>
      <span v-else-if="col.key === 'risk'">{{ cap(row.risk) }}</span>
      <span v-else-if="col.key === 'state'"><i class="dot" :class="stateDot(row.state)"></i>{{ row.state }}</span>
      <template v-else>{{ (row as any)[col.key] }}</template>
    </template>
  </SnList>

  <!-- The change model landing page -->
  <div v-else-if="route.page === 'change_new'" class="form-page">
    <div class="bar"><h1 class="bar__title">Create New Change</h1></div>
    <div class="scroll landing">
      <p class="muted">Select a change model. Standard changes are pre-approved from the catalogue; anything else is a Normal change, and an Emergency change restores service for an incident.</p>
      <div class="models">
        <button v-for="m in MODELS" :key="m.type" type="button" class="model card" @click="$emit('navigate', { page: 'change', id: '-1', preset: { type: m.type } })">
          <span class="model__icon" :class="'is-' + m.type">{{ m.type.charAt(0).toUpperCase() }}</span>
          <span><b>{{ m.label }}</b><small>{{ m.help }}</small></span>
        </button>
      </div>
      <h2 class="section-title">Standard Change Templates</h2>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Template</th><th>Name</th><th>Configuration item</th><th></th></tr></thead>
          <tbody>
            <tr v-for="t in model.choices.templates" :key="t.id">
              <td>{{ t.id }}</td><td>{{ t.name }}</td><td>{{ t.ci }}</td>
              <td><button type="button" class="btn btn--sm" @click="$emit('navigate', { page: 'change', id: '-1', preset: { type: 'standard', template: t.id } })">Use template</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div v-else class="form-page">
    <div class="bar">
      <button type="button" class="icon-btn" aria-label="Back" @click="$emit('navigate', { page: 'change_list' })">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" /></svg>
      </button>
      <div class="title"><span class="title__table">{{ cap(draft.type) }} Change</span><span class="title__no">{{ isNew ? 'New record' : number }}</span></div>
      <span class="bar__spacer"></span>
      <button v-if="isNew" type="button" class="btn btn--primary" :disabled="busy" @click="submit">Submit</button>
      <template v-else-if="record">
        <button v-if="record.state === 'New'" type="button" class="btn btn--primary" :disabled="busy" @click="update">Update</button>
        <button v-if="record.state === 'New' && record.type !== 'standard'" type="button" class="btn" :disabled="busy" @click="requestApproval">Request Approval</button>
        <button v-if="['Assess', 'Authorize'].includes(record.state)" type="button" class="btn btn--primary" :disabled="busy" @click="approve">Approve ({{ record.type === 'emergency' ? 'ECAB' : 'CAB' }})</button>
        <button v-if="record.state === 'Scheduled'" type="button" class="btn btn--primary" :disabled="busy" @click="implement">Implement</button>
        <button v-if="record.state === 'Implement'" type="button" class="btn btn--primary" :disabled="busy" @click="complete">Complete</button>
        <button v-if="record.state === 'Review'" type="button" class="btn btn--primary" :disabled="busy" @click="review">Close</button>
        <button v-if="['New', 'Assess', 'Authorize', 'Scheduled'].includes(record.state)" type="button" class="btn" :disabled="busy" @click="dialog = 'cancel'">Cancel Change</button>
        <button v-if="['New', 'Canceled'].includes(record.state)" type="button" class="btn btn--danger" :disabled="busy" @click="dialog = 'delete'">Delete</button>
      </template>
    </div>
    <div class="scroll">
      <div v-if="!isNew && !record" class="empty">Record not found.</div>
      <template v-else>
        <div v-if="missing.length" class="mandatory" role="alert">The following mandatory fields are not filled in: {{ missing.join(', ') }}</div>
        <div v-if="record && record.in_freeze" class="notice notice--warn">The planned window falls inside a change freeze.</div>
        <div v-if="record && record.type === 'normal' && ['New', 'Assess'].includes(record.state) && record.lead_minutes < model.choices.normal_lead" class="notice notice--warn">
          The window opens in {{ leadText }}. A normal change needs {{ model.choices.normal_lead / 60 }} hours of lead time for CAB.
        </div>
        <ol class="flow">
          <li v-for="s in flow" :key="s" :class="{ 'is-current': stateNow === s, 'is-done': flow.indexOf(stateNow) > flow.indexOf(s) }">{{ s }}</li>
        </ol>
        <div class="form-grid sheet">
          <div class="field"><label class="field__label">Number</label><input class="input" :value="isNew ? nextNo : number" readonly /></div>
          <div class="field"><label class="field__label">Type</label><input class="input" :value="cap(draft.type)" readonly /></div>
          <div v-if="draft.type === 'standard'" class="field">
            <label class="field__label" for="chg-tpl"><span class="field__req" :class="{ 'is-met': draft.template }">*</span>Template</label>
            <select id="chg-tpl" v-model="draft.template" class="select" :disabled="!isNew" :class="{ 'is-invalid': missing.includes('Template') }">
              <option value="">-- None --</option>
              <option v-for="t in model.choices.templates" :key="t.id" :value="t.id">{{ t.id }} - {{ t.name }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="chg-ci">Configuration item</label>
            <select id="chg-ci" v-model="draft.ci" class="select" :disabled="!editable">
              <option value="">-- None --</option>
              <option v-for="ci in model.choices.cis" :key="ci" :value="ci">{{ ci }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="chg-risk"><span v-if="draft.type !== 'standard'" class="field__req" :class="{ 'is-met': draft.risk }">*</span>Risk</label>
            <select id="chg-risk" v-model="draft.risk" class="select" :disabled="!editable">
              <option value="">-- None --</option>
              <option v-for="r in model.choices.risks" :key="r" :value="r">{{ cap(r) }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="chg-inc"><span v-if="draft.type === 'emergency'" class="field__req" :class="{ 'is-met': draft.incident }">*</span>Incident</label>
            <select id="chg-inc" v-model="draft.incident" class="select" :disabled="!editable">
              <option value="">-- None --</option>
              <option v-for="i in model.incidents" :key="i.number" :value="i.number">{{ i.number }} - {{ i.short }}</option>
            </select>
          </div>
          <div class="field field--wide">
            <label class="field__label" for="chg-short"><span class="field__req" :class="{ 'is-met': draft.short || draft.template }">*</span>Short description</label>
            <input id="chg-short" v-model="draft.short" class="input" :class="{ 'is-invalid': missing.includes('Short description') }" :readonly="!editable"
                   :placeholder="draft.type === 'standard' ? 'Defaults to the template name' : ''" />
          </div>
        </div>
        <div class="tabs tabsm" role="tablist">
          <button v-for="t in TABS" :key="t" type="button" class="tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
        </div>
        <div v-if="tab === 'Planning'" class="form-grid form-grid--one sheet">
          <div class="field"><label class="field__label" for="chg-plan">Implementation plan</label><textarea id="chg-plan" v-model="draft.plan" class="textarea" :readonly="!editable"></textarea></div>
          <div class="field"><label class="field__label" for="chg-backout">Backout plan</label><textarea id="chg-backout" v-model="draft.backout" class="textarea" :readonly="!editable"></textarea></div>
          <div class="field"><label class="field__label" for="chg-test">Test plan</label><textarea id="chg-test" v-model="draft.test" class="textarea" :readonly="!editable"></textarea></div>
          <p class="field__help pad">CAB rejects a change it cannot back out of: the implementation, backout and test plans and the risk are all required to request approval.</p>
        </div>
        <div v-else-if="tab === 'Schedule'" class="form-grid sheet">
          <div class="field">
            <label class="field__label" for="chg-start">Planned start date</label>
            <div><input id="chg-start" v-model="draft.start" class="input" :readonly="!editable" :placeholder="record ? record.start : '+1h'" />
              <div class="field__help">Instance time {{ model.time }}. Enter +26h, +30m, 03:00 or now.{{ record ? ' Currently ' + record.start + ' to ' + record.end + '.' : '' }}</div></div>
          </div>
          <div class="field">
            <label class="field__label" for="chg-dur">Duration</label>
            <div><input id="chg-dur" v-model="draft.duration" class="input" :readonly="!editable" :placeholder="record ? record.duration_text : '60m'" />
              <div class="field__help">e.g. 60m or 2h</div></div>
          </div>
          <template v-if="record">
            <div class="field"><label class="field__label">Planned end date</label><input class="input" :value="record.end" readonly /></div>
            <div class="field"><label class="field__label">Actual start date</label><input class="input" :value="record.implemented" readonly /></div>
          </template>
        </div>
        <div v-else class="form-grid sheet">
          <div class="field">
            <label class="field__label" for="chg-code">Close code</label>
            <select id="chg-code" v-model="draft.result" class="select" :disabled="!record || record.state !== 'Implement'" :class="{ 'is-invalid': missing.includes('Close code') }">
              <option value="">-- None --</option>
              <option v-for="c in CLOSE_CODES" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </div>
          <div class="field"><label class="field__label">Result</label><input class="input" :value="record?.result || ''" readonly /></div>
          <div class="field field--wide">
            <label class="field__label" for="chg-notes">Close notes</label>
            <textarea id="chg-notes" v-model="draft.notes" class="textarea" :readonly="!record || record.state !== 'Implement'"></textarea>
          </div>
          <div class="field field--wide">
            <label class="field__label" for="chg-review"><span v-if="record && record.state === 'Review'" class="field__req">*</span>Post-implementation review</label>
            <textarea id="chg-review" v-model="draft.review" class="textarea" :readonly="!record || record.state !== 'Review'" :class="{ 'is-invalid': missing.includes('Post-implementation review') }"></textarea>
          </div>
        </div>
        <div v-if="record" class="related">
          <div class="tabs"><span class="tab is-active">Approvers ({{ record.approvals.length }})</span></div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>State</th><th>Approver</th><th>Created</th></tr></thead>
              <tbody>
                <tr v-for="(a, i) in record.approvals" :key="i"><td><i class="dot dot--achieved"></i>Approved</td><td>{{ a.by }}</td><td>{{ a.at }}</td></tr>
                <tr v-if="['Assess', 'Authorize'].includes(record.state)"><td><i class="dot dot--in-progress"></i>Requested</td><td>{{ record.type === 'emergency' ? 'ECAB (duty manager l.chen)' : 'CAB' }}</td><td>—</td></tr>
              </tbody>
            </table>
            <div v-if="!record.approvals.length && !['Assess', 'Authorize'].includes(record.state)" class="empty">No records to display</div>
          </div>
        </div>
      </template>
    </div>

    <SnModal v-if="dialog === 'cancel'" title="Cancel Change" size="sm" @close="dialog = ''">
      <div class="field field--stack"><label class="field__label" for="chg-cancel">Reason</label>
        <textarea id="chg-cancel" v-model="cancelReason" class="textarea"></textarea></div>
      <template #footer>
        <button type="button" class="btn" @click="dialog = ''">Close</button>
        <button type="button" class="btn btn--primary" :disabled="busy || !cancelReason.trim()" @click="cancelChange">Cancel Change</button>
      </template>
    </SnModal>
    <SnModal v-if="dialog === 'delete'" title="Confirmation" size="sm" @close="dialog = ''">
      <p>Delete this record?</p>
      <p class="muted">Only a New or Canceled change can be deleted; an authorised change is part of the audit trail.</p>
      <template #footer>
        <button type="button" class="btn" @click="dialog = ''">Cancel</button>
        <button type="button" class="btn btn--danger-solid" :disabled="busy" @click="doDelete">Delete</button>
      </template>
    </SnModal>
  </div>
</template>

<script setup lang="ts">
/** change_request_list.do, the change model landing page, and change_request.do. */
import { computed, reactive, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import SnList, { type Column } from './SnList.vue';
import SnModal from './SnModal.vue';
import { CHANGE_STATES, CLOSE_CODES, cap, cmd, mintedNumber, nextNumber, type Model } from './snow';
import type { Route } from './route';

const props = defineProps<{ model: Model; api: PortalApi; route: Route }>();
const emit = defineEmits<{ (event: 'navigate', route: Route): void }>();

const COLUMNS: Column[] = [
  { key: 'number', label: 'Number' }, { key: 'short', label: 'Short description' }, { key: 'type', label: 'Type' },
  { key: 'state', label: 'State' }, { key: 'risk', label: 'Risk' }, { key: 'start', label: 'Planned start date' },
  { key: 'end', label: 'Planned end date' }, { key: 'ci', label: 'Configuration item' }, { key: 'incident', label: 'Incident' },
];
const MODELS = [
  { type: 'normal', label: 'Normal', help: 'Assessed and authorised by the CAB; needs 24 hours of lead time.' },
  { type: 'standard', label: 'Standard', help: 'Pre-approved, low-risk, from the catalogue of templates.' },
  { type: 'emergency', label: 'Emergency', help: 'Restores service for an incident; authorised by the ECAB.' },
];
const TABS = ['Planning', 'Schedule', 'Closure Information'];

const number = computed(() => ('id' in props.route ? props.route.id : ''));
const preset = computed(() => ('preset' in props.route ? props.route.preset || {} : {}));
const isNew = computed(() => number.value === '-1');
const record = computed(() => props.model.changes.find(c => c.number === number.value));
const busy = computed(() => props.api.busy.value);
const editable = computed(() => isNew.value || record.value?.state === 'New');
const stateNow = computed(() => record.value?.state || 'New');
const flow = computed(() => (draft.type === 'standard' ? ['New', 'Scheduled', 'Implement', 'Review', 'Closed']
  : draft.type === 'emergency' ? ['New', 'Authorize', 'Scheduled', 'Implement', 'Review', 'Closed'] : CHANGE_STATES));
const nextNo = computed(() => nextNumber('CHG', 30000, props.model.changes.map(c => c.number)));
const leadText = computed(() => {
  const m = record.value?.lead_minutes || 0;
  return m < 0 ? 'the past' : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
});

const draft = reactive({ type: 'normal', template: '', short: '', ci: '', risk: '', incident: '', plan: '', backout: '', test: '',
  start: '', duration: '', result: '', notes: '', review: '' });
const missing = ref<string[]>([]);
const tab = ref('Planning');
const dialog = ref('');
const cancelReason = ref('');

function load() {
  const r = record.value;
  if (r) Object.assign(draft, { type: r.type, template: r.template, short: r.short, ci: r.ci, risk: r.risk, incident: r.incident,
    plan: r.plan, backout: r.backout, test: r.test, start: '', duration: '', result: r.result, notes: r.notes, review: r.review });
  else {
    const p = preset.value;
    const tpl = props.model.choices.templates.find(t => t.id === p.template);
    Object.assign(draft, { type: p.type || 'normal', template: p.template || '', short: p.short || '', ci: p.ci || tpl?.ci || '',
      risk: p.type === 'standard' ? 'low' : '', incident: p.incident || '', plan: '', backout: '', test: '', start: p.type === 'standard' ? '' : '+26h',
      duration: '60m', result: '', notes: '', review: '' });
  }
}
load();
watch(() => JSON.stringify(record.value), (_now, before) => {
  const r = record.value;
  if (!before || !r) { load(); return; }
  const o = JSON.parse(before);
  for (const k of ['type', 'template', 'short', 'ci', 'risk', 'incident', 'plan', 'backout', 'test', 'result', 'notes', 'review'] as const) {
    if (draft[k] === o[k]) draft[k] = (r as any)[k];
  }
});

function stateDot(state: string) {
  return state === 'Closed' ? 'dot--closed' : state === 'Canceled' ? 'dot--canceled' : state === 'New' ? 'dot--new' : 'dot--in-progress';
}
async function steps(list: { line: string; success: string }[]) {
  for (const s of list) {
    const r = await props.api.exec(s.line, { success: s.success });
    if (!r.ok) return false;
  }
  return true;
}
async function submit() {
  missing.value = [];
  if (draft.type === 'standard' && !draft.template) missing.value.push('Template');
  if (draft.type !== 'standard' && !draft.short.trim()) missing.value.push('Short description');
  if (missing.value.length) return;
  const line = draft.type === 'standard'
    ? cmd.changeCreate({ type: 'standard', template: draft.template, short: draft.short || undefined, start: draft.start || undefined,
      duration: draft.duration || undefined })
    : cmd.changeCreate({ type: draft.type, short: draft.short.trim(), ci: draft.ci, risk: draft.risk, plan: draft.plan, backout: draft.backout,
      test: draft.test, start: draft.start, duration: draft.duration, incident: draft.incident });
  const r = await props.api.exec(line, { success: 'Change request created' });
  const n = mintedNumber(r.output, 'CHG');
  if (r.ok && n) emit('navigate', { page: 'change', id: n });
}
function changedFields() {
  const r = record.value!;
  const out: Record<string, string> = {};
  for (const key of ['short', 'ci', 'risk', 'plan', 'backout', 'test', 'incident'] as const) {
    if (draft[key] && draft[key] !== (r as any)[key]) out[key] = draft[key];
  }
  if (draft.start.trim()) out.start = draft.start.trim();
  if (draft.duration.trim()) out.duration = draft.duration.trim();
  return out;
}
async function update() {
  const fields = changedFields();
  if (!Object.keys(fields).length) { props.api.notify('info', 'No changes to save.'); return; }
  if (await steps([{ line: cmd.changeUpdate(number.value, fields), success: `${number.value} updated` }])) {
    draft.start = ''; draft.duration = '';
  }
}
async function requestApproval() {
  const fields = changedFields();
  const list = Object.keys(fields).length ? [{ line: cmd.changeUpdate(number.value, fields), success: '' }] : [];
  list.push({ line: cmd.changeSubmit(number.value), success: `${number.value} submitted for approval` });
  await steps(list);
}
async function approve() {
  await steps([{ line: cmd.changeApprove(number.value, record.value!.type === 'emergency' ? 'ecab' : 'cab'), success: `${number.value} approved` }]);
}
async function implement() {
  await steps([{ line: cmd.changeImplement(number.value), success: `${number.value} is in Implement` }]);
}
async function complete() {
  tab.value = 'Closure Information';
  missing.value = draft.result ? [] : ['Close code'];
  if (missing.value.length) return;
  await steps([{ line: cmd.changeComplete(number.value, draft.result, draft.notes.trim()), success: `${number.value} completed` }]);
}
async function review() {
  tab.value = 'Closure Information';
  missing.value = draft.review.trim() ? [] : ['Post-implementation review'];
  if (missing.value.length) return;
  await steps([{ line: cmd.changeReview(number.value, draft.review.trim()), success: `${number.value} closed` }]);
}
async function cancelChange() {
  const ok = await steps([{ line: cmd.changeCancel(number.value, cancelReason.value.trim()), success: `${number.value} canceled` }]);
  if (ok) { dialog.value = ''; cancelReason.value = ''; }
}
async function doDelete() {
  const ok = await steps([{ line: cmd.changeDelete(number.value), success: `${number.value} deleted` }]);
  dialog.value = '';
  if (ok) emit('navigate', { page: 'change_list' });
}
</script>

<style scoped src="./sn.css"></style>
<style scoped src="./form.css"></style>
<style scoped>
.landing { padding: 16px 20px; }
.models { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 224px), 1fr)); gap: 12.8px; margin: 12.8px 0 19.2px; }
.model { display: flex; align-items: flex-start; gap: 11.2px; padding: 14.4px; text-align: left; cursor: pointer; font: inherit; color: var(--sn-text); }
.model:hover { border-color: var(--sn-primary); }
.model small { display: block; margin-top: 3.2px; color: var(--sn-text-muted); font-size: 12px; }
.model__icon { display: grid; place-items: center; width: 36.8px; height: 36.8px; flex: none; border-radius: 8px; color: #fff; font-weight: 800; }
.model__icon.is-normal { background: var(--sn-primary); }
.model__icon.is-standard { background: var(--sn-positive); }
.model__icon.is-emergency { background: var(--sn-critical); }
.pad { padding: 0 12.8px; }
.field--stack { grid-template-columns: minmax(0, 1fr); }
.field--stack .field__label { justify-content: flex-start; }
</style>
