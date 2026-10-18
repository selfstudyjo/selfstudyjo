<template>
  <div class="form-page">
    <div class="bar">
      <h1 class="bar__title">Event Management</h1>
      <span class="bar__sub">{{ model.events.length }} events · {{ model.integrations.length }} connector(s) · {{ model.rules.length }} rule(s)</span>
      <span class="bar__spacer"></span>
      <button v-if="tab === 'rules'" type="button" class="btn btn--primary" @click="editRule()">New</button>
      <button v-if="tab === 'integrations'" type="button" class="btn btn--primary" @click="editConn()">New</button>
    </div>
    <div class="tabs" role="tablist">
      <button v-for="t in TABS" :key="t.id" type="button" class="tab" :class="{ 'is-active': tab === t.id }" role="tab"
              :aria-selected="tab === t.id" @click="$emit('navigate', { page: 'events', tab: t.id })">{{ t.label }}</button>
    </div>
    <div class="scroll">
      <div v-if="tab === 'alerts'" class="table-wrap">
        <div class="sev-summary">
          <span v-for="s in SEVS" :key="s" class="sev-chip" :class="'is-' + s.toLowerCase()">{{ s }} <b>{{ alerts.filter(a => a.severity.toLowerCase() === s.toLowerCase()).length }}</b></span>
        </div>
        <table class="table">
          <thead><tr><th>Severity</th><th>Node</th><th>Type</th><th>Source</th><th>Resource</th><th>State</th><th class="num">Event count</th><th>Incident</th><th>Last action</th><th>Updated</th></tr></thead>
          <tbody>
            <tr v-for="a in alerts" :key="a.key">
              <td><span class="sev" :class="'is-' + a.severity.toLowerCase()">{{ cap(a.severity) || '—' }}</span></td>
              <td>{{ a.node }}</td><td>{{ a.type }}</td><td>{{ a.source }}</td><td>{{ a.resource }}</td>
              <td>{{ a.state === 'OK' ? 'Closed' : 'Open' }}</td><td class="num">{{ a.count }}</td>
              <td><button v-if="a.incident" type="button" class="link" @click="$emit('navigate', { page: 'incident', id: a.incident })">{{ a.incident }}</button></td>
              <td class="muted">{{ a.action }}</td><td>{{ a.at }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!alerts.length" class="empty">No alerts. Events reach the instance only through a connector.</div>
      </div>
      <div v-else-if="tab === 'events'" class="table-wrap">
        <table class="table">
          <thead><tr><th>Time of event</th><th>Source</th><th>Node</th><th>Type</th><th>Severity</th><th>Resource</th><th>State</th><th>Incident</th><th>Processing</th></tr></thead>
          <tbody>
            <tr v-for="(e, i) in [...model.events].reverse()" :key="i">
              <td>{{ e.at }}</td><td>{{ e.source }}</td><td>{{ e.node }}</td><td>{{ e.type }}</td>
              <td><span class="sev" :class="'is-' + e.severity.toLowerCase()">{{ cap(e.severity) }}</span></td><td>{{ e.resource }}</td><td>{{ e.state }}</td>
              <td><button v-if="e.incident" type="button" class="link" @click="$emit('navigate', { page: 'incident', id: e.incident })">{{ e.incident }}</button></td>
              <td class="muted">{{ e.action }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!model.events.length" class="empty">No events received.</div>
      </div>
      <div v-else-if="tab === 'rules'" class="table-wrap">
        <table class="table">
          <thead><tr><th>Name</th><th>Source</th><th>Filter</th><th>Priority</th><th>Assignment group</th><th>Ignore event</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in model.rules" :key="r.name">
              <td><button type="button" class="link" @click="editRule(r.name)">{{ r.name }}</button></td>
              <td>{{ r.source }}</td><td><code>{{ r.match }}</code></td><td><i class="dot" :class="'dot--p' + r.priority"></i>{{ PRIORITY_LABEL[r.priority] }}</td>
              <td>{{ r.group || '—' }}</td><td>{{ r.ignore ? 'true' : 'false' }}</td>
              <td><button type="button" class="btn btn--sm btn--danger" :disabled="busy" @click="deleting = { kind: 'rule', name: r.name }">Delete</button></td>
            </tr>
          </tbody>
        </table>
        <div v-if="!model.rules.length" class="empty">No event rules: every event becomes a P5 for the Service Desk.</div>
      </div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead><tr><th>Name</th><th>Endpoint</th><th>Default assignment group</th><th>Auto-resolve on OK</th><th class="num">Events received</th><th></th></tr></thead>
          <tbody>
            <tr v-for="c in model.integrations" :key="c.source">
              <td><button type="button" class="link" @click="editConn(c.source)">{{ LABEL[c.source] || c.source }}</button></td>
              <td class="muted mono">{{ c.endpoint }}</td><td>{{ c.group || '—' }}</td><td>{{ c.auto_resolve ? 'true' : 'false' }}</td>
              <td class="num">{{ c.received }}</td>
              <td><button type="button" class="btn btn--sm btn--danger" :disabled="busy" @click="deleting = { kind: 'conn', name: c.source }">Delete</button></td>
            </tr>
          </tbody>
        </table>
        <div v-if="!model.integrations.length" class="empty">No inbound connectors. Events sent to this instance are dropped.</div>
      </div>
    </div>

    <SnModal v-if="rule" :title="ruleEditing ? 'Event Rule: ' + rule.name : 'New Event Rule'" @close="rule = null">
      <div class="field"><label class="field__label" for="r-name"><span class="field__req">*</span>Name</label>
        <input id="r-name" v-model="rule.name" class="input" :readonly="ruleEditing" /></div>
      <div class="field"><label class="field__label" for="r-src">Source</label>
        <select id="r-src" v-model="rule.source" class="select"><option value="cloudwatch">cloudwatch</option><option value="site24x7">site24x7</option><option value="*">* (any)</option></select></div>
      <div class="field"><label class="field__label" for="r-field">Filter</label>
        <div class="ref">
          <select id="r-field" v-model="rule.field" class="select f-sel"><option v-for="f in ['node', 'type', 'resource', 'severity']" :key="f" :value="f">{{ f }}</option></select>
          <span>matches</span>
          <input v-model="rule.pattern" class="input" placeholder="*-critical" aria-label="Pattern" />
        </div></div>
      <div class="field"><label class="field__label" for="r-imp">Impact</label>
        <select id="r-imp" v-model.number="rule.impact" class="select"><option v-for="l in [1, 2, 3]" :key="l" :value="l">{{ LEVEL_LABEL[l] }}</option></select></div>
      <div class="field"><label class="field__label" for="r-urg">Urgency</label>
        <select id="r-urg" v-model.number="rule.urgency" class="select"><option v-for="l in [1, 2, 3]" :key="l" :value="l">{{ LEVEL_LABEL[l] }}</option></select></div>
      <div class="field"><label class="field__label">Priority</label><div class="pri"><i class="dot" :class="'dot--p' + priorityOf(rule.impact, rule.urgency)"></i>{{ PRIORITY_LABEL[priorityOf(rule.impact, rule.urgency)] }}</div></div>
      <div class="field"><label class="field__label" for="r-grp">Assignment group</label>
        <select id="r-grp" v-model="rule.group" class="select"><option value="">-- None --</option><option v-for="g in model.groups" :key="g.name" :value="g.name">{{ g.name }}</option></select></div>
      <div class="field"><label class="field__label" for="r-ign">Ignore event</label><input id="r-ign" v-model="rule.ignore" type="checkbox" class="chk" /></div>
      <template #footer>
        <button type="button" class="btn" @click="rule = null">Cancel</button>
        <button type="button" class="btn btn--primary" :disabled="busy || !rule.name.trim() || !rule.pattern.trim()" @click="saveRule">{{ ruleEditing ? 'Update' : 'Submit' }}</button>
      </template>
    </SnModal>

    <SnModal v-if="conn" :title="connEditing ? 'Connector: ' + (LABEL[conn.source] || conn.source) : 'New Connector Instance'" @close="conn = null">
      <div class="field"><label class="field__label" for="c-src">Connector definition</label>
        <select id="c-src" v-model="conn.source" class="select" :disabled="connEditing"><option value="cloudwatch">AWS CloudWatch (SNS)</option><option value="site24x7">Site24x7</option></select></div>
      <div class="field"><label class="field__label" for="c-grp">Default assignment group</label>
        <select id="c-grp" v-model="conn.group" class="select"><option value="">-- None --</option><option v-for="g in model.groups" :key="g.name" :value="g.name">{{ g.name }}</option></select></div>
      <div class="field"><label class="field__label" for="c-ar">Auto-resolve on OK</label><input id="c-ar" v-model="conn.auto" type="checkbox" class="chk" /></div>
      <p class="field__help">Without a default group, events become unassigned incidents. Creating the CloudWatch connector also confirms any pending SNS subscription to the instance.</p>
      <template #footer>
        <button type="button" class="btn" @click="conn = null">Cancel</button>
        <button type="button" class="btn btn--primary" :disabled="busy" @click="saveConn">{{ connEditing ? 'Update' : 'Submit' }}</button>
      </template>
    </SnModal>

    <SnModal v-if="deleting" title="Confirmation" size="sm" @close="deleting = null">
      <p>Delete this record?</p>
      <p class="muted">{{ deleting.kind === 'rule' ? 'Event rule ' + deleting.name : 'Connector ' + (LABEL[deleting.name] || deleting.name) + ' — events from it will be dropped' }}.</p>
      <template #footer>
        <button type="button" class="btn" @click="deleting = null">Cancel</button>
        <button type="button" class="btn btn--danger-solid" :disabled="busy" @click="doDelete">Delete</button>
      </template>
    </SnModal>
  </div>
</template>

<script setup lang="ts">
/** Event Management: the alert console, the raw events, event rules and connectors. */
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import SnModal from './SnModal.vue';
import { LEVEL_LABEL, PRIORITY_LABEL, cap, cmd, priorityOf, type Model } from './snow';
import type { EventTab, Route } from './route';

const props = defineProps<{ model: Model; api: PortalApi; tab: EventTab }>();
defineEmits<{ (event: 'navigate', route: Route): void }>();

const TABS: { id: EventTab; label: string }[] = [
  { id: 'alerts', label: 'All Alerts' }, { id: 'events', label: 'All Events' },
  { id: 'rules', label: 'Event Rules' }, { id: 'integrations', label: 'Connectors' },
];
const SEVS = ['Critical', 'Major', 'Minor', 'Warning', 'OK'];
const LABEL: Record<string, string> = { cloudwatch: 'AWS CloudWatch (SNS)', site24x7: 'Site24x7' };
const busy = computed(() => props.api.busy.value);

const alerts = computed(() => {
  const map = new Map<string, { key: string; node: string; type: string; source: string; resource: string; severity: string;
    state: string; count: number; incident: string; action: string; at: string }>();
  for (const e of props.model.events) {
    const key = `${e.source}:${e.node}`;
    const row = map.get(key) || { key, node: e.node, type: e.type, source: e.source, resource: e.resource, severity: e.severity, state: e.state, count: 0, incident: '', action: '', at: e.at };
    row.count += 1;
    row.state = e.state; row.at = e.at; row.action = e.action; row.type = e.type;
    if (e.state !== 'OK') row.severity = e.severity;
    if (e.incident) row.incident = e.incident;
    map.set(key, row);
  }
  return [...map.values()].reverse();
});

const rule = ref<{ name: string; source: string; field: string; pattern: string; impact: number; urgency: number; group: string; ignore: boolean } | null>(null);
const ruleEditing = ref(false);
const conn = ref<{ source: string; group: string; auto: boolean } | null>(null);
const connEditing = ref(false);
const deleting = ref<{ kind: 'rule' | 'conn'; name: string } | null>(null);

function editRule(name?: string) {
  const r = props.model.rules.find(x => x.name === name);
  ruleEditing.value = Boolean(r);
  const [field, pattern] = r ? r.match.split('=') : ['node', ''];
  rule.value = r ? { name: r.name, source: r.source, field, pattern: pattern || '', impact: r.impact, urgency: r.urgency, group: r.group, ignore: r.ignore }
    : { name: '', source: 'cloudwatch', field: 'node', pattern: '', impact: 3, urgency: 3, group: '', ignore: false };
}
function editConn(source?: string) {
  const c = props.model.integrations.find(x => x.source === source);
  connEditing.value = Boolean(c);
  conn.value = c ? { source: c.source, group: c.group, auto: c.auto_resolve } : { source: 'cloudwatch', group: '', auto: true };
}
async function saveRule() {
  const r = rule.value!;
  const ok = (await props.api.exec(cmd.ruleAdd({ name: r.name.trim(), source: r.source, match: `${r.field}=${r.pattern.trim()}`,
    impact: r.impact, urgency: r.urgency, group: r.group, ignore: r.ignore }), { success: `Event rule ${r.name} saved` })).ok;
  if (ok) rule.value = null;
}
async function saveConn() {
  const c = conn.value!;
  const ok = (await props.api.exec(cmd.integrationAdd(c.source, c.group, c.auto), { success: `Connector ${LABEL[c.source]} saved` })).ok;
  if (ok) conn.value = null;
}
async function doDelete() {
  const d = deleting.value!;
  const ok = (await props.api.exec(d.kind === 'rule' ? cmd.ruleDelete(d.name) : cmd.integrationDelete(d.name), { success: 'Record deleted' })).ok;
  if (ok) deleting.value = null;
}
</script>

<style scoped src="./sn.css"></style>
<style scoped src="./form.css"></style>
<style scoped>
.tabs { padding: 0 1rem; }
.sev-summary { display: flex; gap: 0.4rem; flex-wrap: wrap; padding: 0.7rem 1rem; }
.sev-chip { padding: 0.25rem 0.6rem; border-radius: var(--sn-radius); background: var(--sn-surface-alt); font-size: 0.78rem; border-left: 4px solid var(--sn-text-faint); }
.sev, .sev-chip { --c: var(--sn-text-faint); }
.is-critical { --c: var(--sn-critical); }
.is-major { --c: var(--sn-high); }
.is-minor { --c: var(--sn-moderate); }
.is-warning { --c: var(--sn-low); }
.is-ok { --c: var(--sn-positive); }
.sev-chip { border-left-color: var(--c); }
.sev { display: inline-flex; align-items: center; gap: 0.35rem; }
.sev::before { content: ''; width: 0.6rem; height: 0.6rem; border-radius: 0.1rem; background: var(--c); }
.mono { font-family: Consolas, Menlo, monospace; font-size: 0.72rem; }
code { font-family: Consolas, Menlo, monospace; font-size: 0.75rem; color: var(--sn-text); background: var(--sn-surface-alt); padding: 0.05rem 0.3rem; border-radius: 0.2rem; }
.f-sel { flex: 0 0 7rem !important; }
.pri { display: flex; align-items: center; min-height: 2rem; font-weight: 700; font-size: 0.8125rem; }
.chk { width: 1rem; height: 1rem; margin-top: 0.5rem; }
</style>
