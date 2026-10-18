<template>
  <div class="form-page" :class="{ 'is-ws': variant === 'workspace' }">
    <div class="bar form-bar">
      <button v-if="variant !== 'workspace'" type="button" class="icon-btn" aria-label="Back" title="Back to list"
              @click="$emit('navigate', { page: 'incident_list', filter: 'open' })">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" /></svg>
      </button>
      <div class="menu-wrap">
        <button type="button" class="icon-btn" aria-label="Additional actions" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
        </button>
        <div v-if="menuOpen && record" class="ctx card" role="menu">
          <button type="button" class="ctx__item" role="menuitem" @click="act('problem')">Create Problem</button>
          <button type="button" class="ctx__item" role="menuitem" @click="act('normal')">Create Normal Change</button>
          <button type="button" class="ctx__item" role="menuitem" @click="act('emergency')">Create Emergency Change</button>
          <button type="button" class="ctx__item" role="menuitem" :disabled="Boolean(record.major)" @click="act('major')">Promote to Major Incident</button>
          <button type="button" class="ctx__item" role="menuitem" @click="act('page')">Page on-call</button>
          <button type="button" class="ctx__item" role="menuitem" @click="act('child')">Add child incident</button>
          <button type="button" class="ctx__item" role="menuitem" @click="act('sla')">Show Task SLAs (snow sla)</button>
        </div>
      </div>
      <div class="form-bar__title">
        <span class="form-bar__table">Incident</span>
        <span class="form-bar__number">{{ isNew ? 'New record' : number }}</span>
      </div>
      <span v-if="record && record.major" class="pill pill--critical">Major incident</span>
      <span class="bar__spacer"></span>
      <template v-if="isNew">
        <button type="button" class="btn btn--primary" :disabled="busy" @click="submitNew">Submit</button>
      </template>
      <template v-else-if="record">
        <button v-if="canAck" type="button" class="btn" :disabled="busy" @click="assignToMe">Assign to me</button>
        <button type="button" class="btn btn--primary" :disabled="busy || isLocked" @click="update">Update</button>
        <button v-if="['New', 'In Progress', 'On Hold'].includes(record.state)" type="button" class="btn" :disabled="busy" @click="resolve">Resolve</button>
        <button v-if="record.state === 'Resolved'" type="button" class="btn" :disabled="busy" @click="close">Close Incident</button>
        <button type="button" class="btn btn--danger" :disabled="busy" @click="confirmDelete = true">Delete</button>
      </template>
    </div>

    <div class="form-scroll">
      <div v-if="!isNew && !record" class="empty">Record not found. It may have been deleted. <button type="button" class="link" @click="$emit('navigate', { page: 'incident_list', filter: 'all' })">Back to Incidents</button></div>
      <template v-else>
        <div v-if="missing.length" class="mandatory" role="alert">The following mandatory fields are not filled in: {{ missing.join(', ') }}</div>
        <div v-if="isLocked && record" class="locked">This incident is {{ record.state }}. A closed incident is a record, not a work item.</div>

        <!-- Process flow formatter -->
        <ol class="flow" aria-label="State flow">
          <li v-for="s in FLOW" :key="s" :class="{ 'is-done': flowIndex > FLOW.indexOf(s), 'is-current': currentState === s }">{{ s }}</li>
        </ol>

        <div class="form-grid sheet">
          <div class="field">
            <label class="field__label" for="inc-number">Number</label>
            <input id="inc-number" class="input" :value="isNew ? nextNo : number" readonly />
          </div>
          <div class="field">
            <label class="field__label" for="inc-state">State</label>
            <select id="inc-state" v-model="draft.state" class="select" :disabled="isNew || isLocked">
              <option v-for="s in model.choices.states" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="inc-caller"><span class="field__req" :class="{ 'is-met': draft.caller }">*</span>Caller</label>
            <div class="ref">
              <select id="inc-caller" v-model="draft.caller" class="select" :class="{ 'is-invalid': invalid.includes('Caller') }" :disabled="isLocked">
                <option value="">-- None --</option>
                <option v-for="p in model.people" :key="p.id" :value="p.id">{{ p.name }} ({{ p.id }})</option>
              </select>
              <span class="ref__btn" aria-hidden="true"><svg viewBox="0 0 16 16" width="14"><circle cx="7" cy="7" r="4.6" stroke="currentColor" stroke-width="1.5" fill="none" /><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" /></svg></span>
            </div>
          </div>
          <div v-if="draft.state === 'On Hold'" class="field">
            <label class="field__label" for="inc-hold"><span class="field__req" :class="{ 'is-met': draft.hold_reason }">*</span>On hold reason</label>
            <div>
              <select id="inc-hold" v-model="draft.hold_reason" class="select" :class="{ 'is-invalid': invalid.includes('On hold reason') }">
                <option value="">-- None --</option>
                <option v-for="h in model.choices.hold_reasons" :key="h" :value="h">{{ HOLD_LABEL[h] || h }}</option>
              </select>
              <div class="field__help">Only Awaiting Caller pauses the resolution SLA. A P1 cannot be placed On Hold.</div>
            </div>
          </div>
          <div v-else class="field">
            <label class="field__label" for="inc-impact">Impact</label>
            <select id="inc-impact" v-model.number="draft.impact" class="select" :disabled="isLocked">
              <option v-for="l in [1, 2, 3]" :key="l" :value="l">{{ LEVEL_LABEL[l] }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="inc-cat">Category</label>
            <select id="inc-cat" v-model="draft.category" class="select" :disabled="isLocked" @change="draft.subcategory = ''">
              <option value="">-- None --</option>
              <option v-for="c in Object.keys(model.choices.categories)" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div v-if="draft.state === 'On Hold'" class="field">
            <label class="field__label" for="inc-impact2">Impact</label>
            <select id="inc-impact2" v-model.number="draft.impact" class="select" :disabled="isLocked">
              <option v-for="l in [1, 2, 3]" :key="l" :value="l">{{ LEVEL_LABEL[l] }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="inc-urg">Urgency</label>
            <select id="inc-urg" v-model.number="draft.urgency" class="select" :disabled="isLocked">
              <option v-for="l in [1, 2, 3]" :key="l" :value="l">{{ LEVEL_LABEL[l] }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="inc-sub">Subcategory</label>
            <select id="inc-sub" v-model="draft.subcategory" class="select" :disabled="isLocked || !draft.category">
              <option value="">-- None --</option>
              <option v-for="s in model.choices.categories[draft.category] || []" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="inc-pri">Priority</label>
            <div>
              <div class="pri-read"><i class="dot" :class="'dot--p' + computedPriority"></i>{{ PRIORITY_LABEL[computedPriority] }}</div>
              <div class="field__help">Calculated from Impact × Urgency.</div>
            </div>
          </div>
          <div v-if="priorityChanged" class="field">
            <label class="field__label" for="inc-reason"><span class="field__req" :class="{ 'is-met': draft.reason }">*</span>Reason for priority change</label>
            <div>
              <input id="inc-reason" v-model="draft.reason" class="input" :class="{ 'is-invalid': invalid.includes('Reason for priority change') }" />
              <div class="field__help">SLAs are re-attached from the time the incident was opened, not from now.</div>
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="inc-ci">Configuration item</label>
            <div class="ref">
              <select id="inc-ci" v-model="draft.ci" class="select" :disabled="isLocked">
                <option value="">-- None --</option>
                <option v-for="ci in model.choices.cis" :key="ci" :value="ci">{{ ci }}</option>
              </select>
              <span class="ref__btn" aria-hidden="true"><svg viewBox="0 0 16 16" width="14"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" fill="none" /><path d="M5 7h6M5 10h4" stroke="currentColor" /></svg></span>
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="inc-group">Assignment group</label>
            <select id="inc-group" v-model="draft.group" class="select" :disabled="isLocked" @change="onGroup">
              <option value="">-- None --</option>
              <option v-for="g in model.groups" :key="g.name" :value="g.name">{{ g.name }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="inc-channel">Channel</label>
            <select id="inc-channel" v-model="draft.channel" class="select" :disabled="isLocked">
              <option value="">-- None --</option>
              <option v-for="c in model.choices.channels" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="inc-to">Assigned to</label>
            <select id="inc-to" v-model="draft.assigned_to" class="select" :disabled="isLocked || !draft.group">
              <option value="">-- None --</option>
              <option v-for="m in groupMembers" :key="m" :value="m">{{ personName(model, m) }}</option>
            </select>
          </div>

          <div class="field field--wide">
            <label class="field__label" for="inc-short"><span class="field__req" :class="{ 'is-met': draft.short }">*</span>Short description</label>
            <input id="inc-short" v-model="draft.short" class="input" :class="{ 'is-invalid': invalid.includes('Short description') }" :readonly="isLocked" />
          </div>
          <div class="field field--wide">
            <label class="field__label" for="inc-desc">Description</label>
            <textarea id="inc-desc" v-model="draft.description" class="textarea" :readonly="isLocked"></textarea>
          </div>
        </div>

        <div class="tabs form-tabs" role="tablist">
          <button v-for="t in SECTIONS" :key="t" type="button" class="tab" :class="{ 'is-active': section === t }" role="tab"
                  :aria-selected="section === t" @click="section = t">{{ t }}</button>
        </div>

        <div v-if="section === 'Notes'" class="sheet notes">
          <div class="compose">
            <label class="compose__label" for="inc-journal">{{ customerVisible ? 'Additional comments (Customer visible)' : 'Work notes' }}</label>
            <textarea id="inc-journal" v-model="journal" class="textarea" :class="{ 'is-work': !customerVisible, 'is-invalid': invalid.includes('Work notes') }"
                      :placeholder="customerVisible ? 'Additional comments (Customer visible)' : 'Work notes'" :readonly="isLocked"></textarea>
            <div class="compose__row">
              <label class="compose__check"><input v-model="customerVisible" type="checkbox" /> Additional comments (Customer visible)</label>
              <span class="bar__spacer"></span>
              <button v-if="!isNew" type="button" class="btn btn--sm" :disabled="busy || !journal.trim() || isLocked" @click="post">Post</button>
            </div>
            <p class="field__help">A work note is internal and does not stop the response SLA; only a customer-visible comment does.</p>
          </div>
          <h3 class="section-title">Activity: {{ notes.length }}</h3>
          <ul class="stream">
            <li v-for="(n, i) in notes" :key="i" class="stream__item" :class="'is-' + n.kind">
              <div class="stream__head">
                <span class="stream__avatar">{{ initials(n.by) }}</span>
                <b>{{ personName(model, n.by) || n.by }}</b>
                <span class="stream__kind">{{ KIND[n.kind] || n.kind }}</span>
                <span class="bar__spacer"></span>
                <span class="muted">{{ n.at }}</span>
              </div>
              <div class="stream__text">{{ n.text }}</div>
            </li>
            <li v-if="!notes.length" class="muted">No activity yet.</li>
          </ul>
        </div>

        <div v-else-if="section === 'Related Records'" class="sheet form-grid">
          <div class="field">
            <label class="field__label" for="inc-parent">Parent Incident</label>
            <select id="inc-parent" v-model="draft.parent" class="select" :disabled="isNew">
              <option value="">-- None --</option>
              <option v-for="i in model.incidents.filter(x => x.number !== number)" :key="i.number" :value="i.number">{{ i.number }} - {{ i.short }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="inc-problem">Problem</label>
            <select id="inc-problem" v-model="draft.problem" class="select" :disabled="isNew">
              <option value="">-- None --</option>
              <option v-for="p in model.problems" :key="p.number" :value="p.number">{{ p.number }} - {{ p.short }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="inc-change">Change Request</label>
            <select id="inc-change" v-model="draft.change" class="select" :disabled="isNew">
              <option value="">-- None --</option>
              <option v-for="c in model.changes" :key="c.number" :value="c.number">{{ c.number }} - {{ c.short }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label">Source</label>
            <input class="input" :value="record ? record.source + (record.events > 1 ? ' (' + record.events + ' events)' : '') : 'manual'" readonly />
          </div>
          <div v-if="record && record.reprioritised.length" class="field field--wide">
            <label class="field__label">Priority history</label>
            <ul class="plain">
              <li v-for="(p, i) in record.reprioritised" :key="i">{{ p.at }} — P{{ p.from }} → P{{ p.to }}: {{ p.reason }}</li>
            </ul>
          </div>
        </div>

        <div v-else class="sheet form-grid">
          <div class="field">
            <label class="field__label" for="inc-code"><span class="field__req" :class="{ 'is-met': draft.resolution_code }">*</span>Resolution code</label>
            <select id="inc-code" v-model="draft.resolution_code" class="select" :class="{ 'is-invalid': invalid.includes('Resolution code') }" :disabled="isLocked || draft.state === 'Resolved' && record?.state === 'Resolved'">
              <option value="">-- None --</option>
              <option v-for="c in model.choices.resolution_codes" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label">Resolved by</label>
            <input class="input" :value="record && record.resolved ? personName(model, record.assigned_to) : ''" readonly />
          </div>
          <div class="field">
            <label class="field__label">Resolved</label>
            <input class="input" :value="record?.resolved || ''" readonly />
          </div>
          <div class="field">
            <label class="field__label">Closed</label>
            <input class="input" :value="record?.closed || ''" readonly />
          </div>
          <div class="field field--wide">
            <label class="field__label" for="inc-notes"><span class="field__req" :class="{ 'is-met': draft.resolution_notes }">*</span>Resolution notes</label>
            <div>
              <textarea id="inc-notes" v-model="draft.resolution_notes" class="textarea" :class="{ 'is-invalid': invalid.includes('Resolution notes') }"
                        :readonly="isLocked || record?.state === 'Resolved'"></textarea>
              <div class="field__help">Say what restored service (four words at least).</div>
            </div>
          </div>
        </div>

        <!-- Related lists -->
        <div v-if="record" class="related">
          <div class="tabs" role="tablist">
            <button v-for="t in relatedTabs" :key="t.id" type="button" class="tab" :class="{ 'is-active': related === t.id }"
                    role="tab" :aria-selected="related === t.id" @click="related = t.id">{{ t.label }} ({{ t.count }})</button>
          </div>
          <div class="table-wrap">
            <table v-if="related === 'sla'" class="table">
              <thead><tr><th>SLA definition</th><th>Type</th><th>Target</th><th>Stage</th><th>Business time left</th><th>Business elapsed time</th><th>Business elapsed percentage</th><th>Has breached</th><th>Start time</th><th>Stop time</th><th>Breach time</th></tr></thead>
              <tbody>
                <tr v-for="s in record.slas" :key="s.name">
                  <td>{{ s.definition }}</td><td>{{ s.type }}</td><td>{{ SLA_LABEL[s.name] || s.name }}</td>
                  <td><i class="dot" :class="'dot--' + s.stage.replace(' ', '-')"></i>{{ STAGE_LABEL[s.stage] || s.stage }}</td>
                  <td>{{ s.stage === 'in progress' || s.stage === 'paused' ? s.left + 'm' : '0m' }}</td>
                  <td>{{ s.elapsed_text }}</td><td><SlaBar :sla="s" /></td>
                  <td>{{ s.has_breached ? 'true' : 'false' }}</td><td>{{ s.start }}</td><td>{{ s.stop }}</td><td>{{ s.breach_time }}</td>
                </tr>
              </tbody>
            </table>
            <table v-else-if="related === 'child'" class="table">
              <thead><tr><th>Number</th><th>Short description</th><th>Priority</th><th>State</th><th>Assignment group</th></tr></thead>
              <tbody>
                <tr v-for="c in children" :key="c.number">
                  <td><button type="button" class="link" @click="$emit('navigate', { page: 'incident', id: c.number })">{{ c.number }}</button></td>
                  <td>{{ c.short }}</td><td><i class="dot" :class="'dot--p' + c.priority"></i>{{ PRIORITY_LABEL[c.priority] }}</td><td>{{ c.state }}</td><td>{{ c.group }}</td>
                </tr>
              </tbody>
            </table>
            <table v-else-if="related === 'problem'" class="table">
              <thead><tr><th>Number</th><th>Problem statement</th><th>State</th><th>Known error</th></tr></thead>
              <tbody>
                <tr v-for="p in linkedProblems" :key="p.number">
                  <td><button type="button" class="link" @click="$emit('navigate', { page: 'problem', id: p.number })">{{ p.number }}</button></td>
                  <td>{{ p.short }}</td><td>{{ p.state }}</td><td>{{ p.known_error ? 'true' : 'false' }}</td>
                </tr>
              </tbody>
            </table>
            <table v-else-if="related === 'change'" class="table">
              <thead><tr><th>Number</th><th>Type</th><th>Short description</th><th>State</th><th>Planned start</th></tr></thead>
              <tbody>
                <tr v-for="c in linkedChanges" :key="c.number">
                  <td><button type="button" class="link" @click="$emit('navigate', { page: 'change', id: c.number })">{{ c.number }}</button></td>
                  <td>{{ cap(c.type) }}</td><td>{{ c.short }}</td><td>{{ c.state }}</td><td>{{ c.start }}</td>
                </tr>
              </tbody>
            </table>
            <table v-else class="table">
              <thead><tr><th>Page</th><th>With</th><th>Level</th><th>Status</th><th>Sent</th><th>Acknowledged by</th><th>History</th></tr></thead>
              <tbody>
                <tr v-for="p in pages" :key="p.id">
                  <td>{{ p.id }}</td><td>{{ personName(model, p.who) }}</td><td>{{ p.level }}</td><td>{{ p.status }}</td><td>{{ p.sent }}</td>
                  <td>{{ personName(model, p.acked_by) }}</td><td class="muted wrap">{{ p.history.map(h => h.at + ' ' + h.what + ' (' + h.who + ')').join('; ') }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="relatedEmpty" class="empty">No records to display</div>
          </div>
        </div>
      </template>
    </div>

    <SnModal v-if="confirmDelete && record" title="Confirmation" size="sm" @close="confirmDelete = false">
      <p>Delete this record?</p>
      <p class="muted">The following related records will also be deleted: Task SLA ({{ record.slas.length }}){{ pages.length ? ', On-call page (' + pages.length + ')' : '' }}.</p>
      <template #footer>
        <button type="button" class="btn" @click="confirmDelete = false">Cancel</button>
        <button type="button" class="btn btn--danger-solid" :disabled="busy" @click="doDelete">Delete</button>
      </template>
    </SnModal>

    <SnModal v-if="dialog === 'major'" title="Promote to Major Incident" @close="dialog = ''">
      <p class="muted">Major incident management is for P1s. Name the major incident manager who runs the bridge and the communications.</p>
      <div class="field"><label class="field__label" for="mim-mgr">Major incident manager</label>
        <select id="mim-mgr" v-model="majorManager" class="select">
          <option v-for="p in model.people" :key="p.id" :value="p.id">{{ p.name }} — {{ p.role }}</option>
        </select>
      </div>
      <template #footer>
        <button type="button" class="btn" @click="dialog = ''">Cancel</button>
        <button type="button" class="btn btn--primary" :disabled="busy" @click="promote">Promote</button>
      </template>
    </SnModal>

    <SnModal v-if="dialog === 'child'" title="Add child incident" @close="dialog = ''">
      <p class="muted">Resolving the parent resolves its children.</p>
      <div class="field"><label class="field__label" for="child-pick">Incident</label>
        <select id="child-pick" v-model="childPick" class="select">
          <option value="">-- None --</option>
          <option v-for="i in model.incidents.filter(x => x.number !== number && x.parent !== number)" :key="i.number" :value="i.number">{{ i.number }} - {{ i.short }}</option>
        </select>
      </div>
      <template #footer>
        <button type="button" class="btn" @click="dialog = ''">Cancel</button>
        <button type="button" class="btn btn--primary" :disabled="busy || !childPick" @click="addChild">Add</button>
      </template>
    </SnModal>
  </div>
</template>

<script setup lang="ts">
/**
 * incident.do: the incident form. Update turns the edited fields into the
 * snow verbs they stand for, in an order the SLA rules accept: fields, then
 * priority (with its reason), assignment, notes, relationships, and the state
 * transition last.
 */
import { computed, reactive, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import SnModal from './SnModal.vue';
import SlaBar from './SlaBar.vue';
import {
  HOLD_LABEL, LEVEL_LABEL, PRIORITY_LABEL, SLA_LABEL, STAGE_LABEL, cap, cmd, mintedNumber, nextNumber,
  personName, priorityOf, type Incident, type Model,
} from './snow';
import type { Route } from './route';

const props = withDefaults(defineProps<{
  model: Model; api: PortalApi; number: string; preset?: Record<string, string>; variant?: 'classic' | 'workspace';
}>(), { preset: undefined, variant: 'classic' });
const emit = defineEmits<{ (event: 'navigate', route: Route): void }>();

const FLOW = ['New', 'In Progress', 'On Hold', 'Resolved', 'Closed'];
const SECTIONS = ['Notes', 'Related Records', 'Resolution Information'];
const KIND: Record<string, string> = { work: 'Work notes', customer: 'Additional comments', system: 'Field changes' };

const isNew = computed(() => props.number === '-1');
const record = computed<Incident | undefined>(() => props.model.incidents.find(i => i.number === props.number));
const busy = computed(() => props.api.busy.value);
const isLocked = computed(() => Boolean(record.value && ['Closed', 'Canceled'].includes(record.value.state)));
const nextNo = computed(() => nextNumber('INC', 10000, props.model.incidents.map(i => i.number)));

function blank() {
  return {
    short: props.preset?.short || '', description: '', caller: props.model.user, category: '', subcategory: '',
    channel: 'Phone', ci: props.preset?.ci || '', impact: 3, urgency: 3, group: '', assigned_to: '',
    state: 'New', hold_reason: '', reason: '', parent: '', problem: '', change: '',
    resolution_code: '', resolution_notes: '',
  };
}
const draft = reactive(blank());
const journal = ref('');
const customerVisible = ref(false);
const section = ref('Notes');
const related = ref('sla');
const missing = ref<string[]>([]);
const invalid = ref<string[]>([]);
const confirmDelete = ref(false);
const menuOpen = ref(false);
const dialog = ref('');
const majorManager = ref('l.chen');
const childPick = ref('');

function load() {
  const r = record.value;
  if (!r) { Object.assign(draft, blank()); return; }
  Object.assign(draft, {
    short: r.short, description: r.description, caller: r.caller, category: r.category, subcategory: r.subcategory,
    channel: r.channel, ci: r.ci, impact: r.impact, urgency: r.urgency, group: r.group, assigned_to: r.assigned_to,
    state: r.state, hold_reason: r.hold_reason, reason: '', parent: r.parent, problem: r.problem, change: r.change,
    resolution_code: r.resolution_code, resolution_notes: r.resolution_notes,
  });
}
load();
// The record changes under the form whenever any command refreshes the view
// (the clock, another tab). Reload only the fields the user has not touched.
watch(() => JSON.stringify(record.value), (now, before) => {
  if (!before || !record.value) { load(); return; }
  const old = JSON.parse(before) as Incident;
  const r = record.value;
  for (const key of ['short', 'description', 'caller', 'category', 'subcategory', 'channel', 'ci', 'impact', 'urgency',
    'group', 'assigned_to', 'state', 'hold_reason', 'parent', 'problem', 'change', 'resolution_code', 'resolution_notes'] as const) {
    if ((draft as any)[key] === (old as any)[key]) (draft as any)[key] = (r as any)[key];
  }
});

const computedPriority = computed(() => priorityOf(draft.impact, draft.urgency));
const priorityChanged = computed(() => Boolean(record.value) &&
  (draft.impact !== record.value!.impact || draft.urgency !== record.value!.urgency));
const groupMembers = computed(() => props.model.groups.find(g => g.name === draft.group)?.members || []);
const currentState = computed(() => (record.value ? record.value.state : 'New'));
const flowIndex = computed(() => FLOW.indexOf(currentState.value));
const canAck = computed(() => {
  const r = record.value;
  if (!r || !['New', 'In Progress', 'On Hold'].includes(r.state)) return false;
  return !(r.state === 'In Progress' && r.assigned_to === props.model.user);
});
const notes = computed(() => (record.value ? [...record.value.notes].reverse() : []));
const children = computed(() => props.model.incidents.filter(i => i.parent === props.number));
const linkedProblems = computed(() => props.model.problems.filter(p => p.number === record.value?.problem || p.incidents.includes(props.number)));
const linkedChanges = computed(() => props.model.changes.filter(c => c.number === record.value?.change || c.incident === props.number));
const pages = computed(() => props.model.pages.filter(p => p.incident === props.number));
const relatedTabs = computed(() => [
  { id: 'sla', label: 'Task SLAs', count: record.value?.slas.length || 0 },
  { id: 'child', label: 'Child Incidents', count: children.value.length },
  { id: 'problem', label: 'Problems', count: linkedProblems.value.length },
  { id: 'change', label: 'Change Requests', count: linkedChanges.value.length },
  { id: 'pages', label: 'On-call pages', count: pages.value.length },
]);
const relatedEmpty = computed(() => (relatedTabs.value.find(t => t.id === related.value)?.count || 0) === 0);

function onGroup() {
  if (!groupMembers.value.includes(draft.assigned_to)) draft.assigned_to = '';
}
function initials(id: string) {
  const name = personName(props.model, id) || id || '?';
  return name.split(/[\s.]+/).map(p => p.charAt(0).toUpperCase()).join('').slice(0, 2);
}

function requireFields(fields: [string, unknown][]): boolean {
  const empty = fields.filter(([, v]) => !String(v ?? '').trim()).map(([k]) => k);
  missing.value = empty;
  invalid.value = empty;
  return empty.length === 0;
}

async function run(commands: { line: string; success: string }[]): Promise<boolean> {
  for (const c of commands) {
    const result = await props.api.exec(c.line, { success: c.success });
    if (!result.ok) return false;
  }
  return true;
}

async function submitNew() {
  if (!requireFields([['Caller', draft.caller], ['Short description', draft.short]])) return;
  const result = await props.api.exec(cmd.incidentCreate({
    short: draft.short, description: draft.description, caller: draft.caller, category: draft.category,
    subcategory: draft.subcategory, channel: draft.channel, ci: draft.ci, impact: draft.impact, urgency: draft.urgency,
    group: draft.group, assigned_to: '',
  }), { success: 'Incident created' });
  if (!result.ok) return;
  const number = mintedNumber(result.output, 'INC');
  if (!number) return;
  const follow: { line: string; success: string }[] = [];
  if (draft.group && draft.assigned_to) follow.push({ line: cmd.incidentAssign(number, draft.group, draft.assigned_to), success: '' });
  if (journal.value.trim()) {
    follow.push({ line: customerVisible.value ? cmd.incidentComment(number, journal.value.trim()) : cmd.incidentWorknote(number, journal.value.trim()), success: '' });
  }
  await run(follow);
  journal.value = '';
  emit('navigate', { page: props.variant === 'workspace' ? 'sow-record' : 'incident', id: number });
}

/** Build the command sequence for everything edited on the form. */
function plan(): { line: string; success: string }[] | null {
  const r = record.value!;
  const n = r.number;
  const out: { line: string; success: string }[] = [];
  const need: [string, unknown][] = [['Caller', draft.caller], ['Short description', draft.short]];
  if (priorityChanged.value) need.push(['Reason for priority change', draft.reason]);
  if (draft.state === 'On Hold' && r.state !== 'On Hold') need.push(['On hold reason', draft.hold_reason]);
  if (draft.state === 'Resolved' && r.state !== 'Resolved') {
    need.push(['Resolution code', draft.resolution_code], ['Resolution notes', draft.resolution_notes]);
  }
  if (draft.state === 'Canceled' && r.state !== 'Canceled') need.push(['Work notes', journal.value]);
  if (!requireFields(need)) {
    if (invalid.value.some(k => k.startsWith('Resolution'))) section.value = 'Resolution Information';
    if (invalid.value.includes('Work notes')) section.value = 'Notes';
    return null;
  }
  const fields: Record<string, string> = {};
  for (const key of ['short', 'description', 'ci', 'caller', 'category', 'subcategory', 'channel'] as const) {
    if (String(draft[key] ?? '') !== String(r[key] ?? '') && String(draft[key] ?? '') !== '') fields[key] = String(draft[key]);
  }
  if (Object.keys(fields).length) out.push({ line: cmd.incidentUpdate(n, fields), success: '' });
  if (priorityChanged.value) out.push({ line: cmd.incidentPriority(n, draft.impact, draft.urgency, draft.reason.trim()), success: '' });
  if (draft.group && (draft.group !== r.group || draft.assigned_to !== r.assigned_to)) {
    out.push({ line: cmd.incidentAssign(n, draft.group, draft.assigned_to || undefined), success: '' });
  }
  if (journal.value.trim() && draft.state !== 'Canceled') {
    out.push({ line: customerVisible.value ? cmd.incidentComment(n, journal.value.trim()) : cmd.incidentWorknote(n, journal.value.trim()), success: '' });
  }
  if (draft.parent && draft.parent !== r.parent) out.push({ line: cmd.incidentLink(n, 'parent', draft.parent), success: '' });
  if (draft.problem && draft.problem !== r.problem) out.push({ line: cmd.incidentLink(n, 'problem', draft.problem), success: '' });
  if (draft.change && draft.change !== r.change) out.push({ line: cmd.incidentLink(n, 'change', draft.change), success: '' });
  if (draft.state !== r.state) {
    if (draft.state === 'In Progress') {
      out.push({ line: r.state === 'On Hold' && r.acked ? cmd.incidentResume(n) : cmd.incidentAck(n), success: '' });
    } else if (draft.state === 'On Hold') out.push({ line: cmd.incidentHold(n, draft.hold_reason), success: '' });
    else if (draft.state === 'Resolved') out.push({ line: cmd.incidentResolve(n, draft.resolution_code, draft.resolution_notes.trim()), success: '' });
    else if (draft.state === 'Closed') out.push({ line: cmd.incidentClose(n), success: '' });
    else if (draft.state === 'Canceled') out.push({ line: cmd.incidentCancel(n, journal.value.trim()), success: '' });
    else if (draft.state === 'New') {
      props.api.notify('warning', 'An incident cannot be moved back to New.');
      return null;
    }
  }
  return out;
}

async function update() {
  const steps = plan();
  if (!steps) return;
  if (!steps.length) {
    props.api.notify('info', 'No changes to save.');
    return;
  }
  steps[steps.length - 1].success = `${record.value!.number} updated`;
  if (await run(steps)) {
    journal.value = '';
    draft.reason = '';
    missing.value = [];
    invalid.value = [];
  }
}
async function resolve() {
  draft.state = 'Resolved';
  section.value = 'Resolution Information';
  if (!draft.resolution_code || !draft.resolution_notes.trim()) {
    requireFields([['Resolution code', draft.resolution_code], ['Resolution notes', draft.resolution_notes]]);
    return;
  }
  await update();
}
async function close() {
  await run([{ line: cmd.incidentClose(props.number), success: `${props.number} closed` }]);
}
async function assignToMe() {
  await run([{ line: cmd.incidentAck(props.number), success: `${props.number} assigned to you and In Progress` }]);
}
async function post() {
  const text = journal.value.trim();
  if (!text) return;
  const ok = await run([{
    line: customerVisible.value ? cmd.incidentComment(props.number, text) : cmd.incidentWorknote(props.number, text),
    success: customerVisible.value ? 'Additional comment posted' : 'Work note posted',
  }]);
  if (ok) journal.value = '';
}
async function doDelete() {
  const ok = await run([{ line: cmd.incidentDelete(props.number), success: `${props.number} deleted` }]);
  confirmDelete.value = false;
  if (ok) emit('navigate', props.variant === 'workspace' ? { page: 'sow' } : { page: 'incident_list', filter: 'all' });
}
async function promote() {
  const ok = await run([{ line: cmd.majorDeclare(props.number, majorManager.value), success: `${props.number} promoted to a major incident` }]);
  dialog.value = '';
  if (ok) emit('navigate', { page: 'major', id: props.number });
}
async function addChild() {
  const ok = await run([{ line: cmd.incidentLink(childPick.value, 'parent', props.number), success: `${childPick.value} added as a child` }]);
  if (ok) { dialog.value = ''; childPick.value = ''; related.value = 'child'; }
}
async function act(what: string) {
  menuOpen.value = false;
  const r = record.value;
  if (!r) return;
  if (what === 'problem') emit('navigate', { page: 'problem', id: '-1', preset: { incidents: r.number, short: r.short, ci: r.ci } });
  else if (what === 'normal' || what === 'emergency') {
    emit('navigate', { page: 'change', id: '-1', preset: { type: what, incident: what === 'emergency' ? r.number : '', short: r.short, ci: r.ci } });
  } else if (what === 'major') dialog.value = 'major';
  else if (what === 'child') dialog.value = 'child';
  else if (what === 'page') await run([{ line: cmd.oncallPage(r.number), success: `On-call paged for ${r.number}` }]);
  else if (what === 'sla') {
    related.value = 'sla';
    await props.api.exec(cmd.sla(r.number), { success: '' });
  }
}
</script>

<style scoped src="./sn.css"></style>
<style scoped>
.form-page { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--sn-surface); }
.form-bar__title { display: flex; flex-direction: column; line-height: 1.15; }
.form-bar__table { font-size: 0.72rem; color: var(--sn-text-muted); }
.form-bar__number { font-size: 1rem; font-weight: 700; }
.menu-wrap { position: relative; }
.ctx { position: absolute; top: 2.3rem; left: 0; z-index: 6; display: flex; flex-direction: column; min-width: 15rem; padding: 0.3rem 0; }
.ctx__item { padding: 0.45rem 0.9rem; border: 0; background: none; color: var(--sn-text); font: inherit; font-size: 0.8125rem; text-align: left; cursor: pointer; }
.ctx__item:hover:not(:disabled) { background: var(--sn-row-hover); }
.ctx__item:disabled { color: var(--sn-text-faint); cursor: not-allowed; }
.form-scroll { flex: 1; min-height: 0; overflow: auto; padding-bottom: 2rem; }
.sheet { padding: 0.6rem 1.5rem 0.4rem 0.5rem; }
.mandatory { margin: 0.6rem 1rem 0; padding: 0.55rem 0.8rem; border-radius: var(--sn-radius); background: var(--sn-critical-bg); color: var(--sn-critical-ink); font-size: 0.8125rem; }
.locked { margin: 0.6rem 1rem 0; padding: 0.55rem 0.8rem; border-radius: var(--sn-radius); background: var(--sn-info-bg); color: var(--sn-info-ink); font-size: 0.8125rem; }
.flow { display: flex; margin: 0.8rem 1rem 0.2rem; padding: 0; list-style: none; overflow-x: auto; scrollbar-width: none; }
.flow li { position: relative; flex: 1; min-width: 6rem; padding: 0.4rem 0.6rem 0.4rem 1.1rem; background: var(--sn-surface-alt); color: var(--sn-text-muted);
  font-size: 0.75rem; font-weight: 700; white-space: nowrap; clip-path: polygon(0 0, calc(100% - 0.7rem) 0, 100% 50%, calc(100% - 0.7rem) 100%, 0 100%, 0.7rem 50%); margin-right: -0.4rem; }
.flow li:first-child { clip-path: polygon(0 0, calc(100% - 0.7rem) 0, 100% 50%, calc(100% - 0.7rem) 100%, 0 100%); padding-left: 0.8rem; }
.flow li.is-done { background: #d9dcf3; color: var(--sn-brand); }
.flow li.is-current { background: var(--sn-brand); color: #fff; }
.pri-read { display: flex; align-items: center; min-height: 2rem; font-size: 0.8125rem; font-weight: 700; }
.form-tabs { margin: 0.6rem 1rem 0; }
.notes { padding: 0.8rem 1rem; }
.compose { padding: 0.6rem; border: 1px solid var(--sn-border); border-radius: var(--sn-radius-lg); background: var(--sn-surface-alt); }
.compose__label { display: block; margin-bottom: 0.3rem; font-size: 0.8125rem; font-weight: 700; }
.compose .textarea.is-work { background: #fffbe8; border-color: #e7cf72; }
.compose__row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.4rem; }
.compose__check { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8125rem; }
.stream { margin: 0; padding: 0; list-style: none; }
.stream__item { margin-bottom: 0.55rem; padding: 0.5rem 0.7rem; border: 1px solid var(--sn-border); border-left: 4px solid var(--sn-border-strong); border-radius: var(--sn-radius); background: var(--sn-surface); }
.stream__item.is-work { border-left-color: #e2b91f; background: #fffdf3; }
.stream__item.is-customer { border-left-color: var(--sn-primary); }
.stream__item.is-system { border-left-color: var(--sn-text-faint); background: var(--sn-surface-alt); }
.stream__head { display: flex; align-items: center; gap: 0.45rem; font-size: 0.78rem; }
.stream__avatar { display: grid; place-items: center; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: #d9dcf3; color: var(--sn-brand); font-size: 0.62rem; font-weight: 800; }
.stream__kind { color: var(--sn-text-muted); }
.stream__text { margin-top: 0.3rem; padding-left: 1.95rem; font-size: 0.8125rem; white-space: pre-wrap; overflow-wrap: anywhere; }
.related { margin: 1rem; border: 1px solid var(--sn-border); border-radius: var(--sn-radius-lg); overflow: hidden; }
.related .tabs { background: var(--sn-surface-alt); }
.plain { margin: 0.4rem 0; padding-left: 1rem; font-size: 0.8125rem; }
@container sl-portal (max-width: 760px) {
  .sheet { padding: 0.5rem 0.8rem; }
  .form-bar .btn { padding: 0 0.55rem; }
}
</style>
