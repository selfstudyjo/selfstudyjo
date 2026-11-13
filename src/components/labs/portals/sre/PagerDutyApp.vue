<template>
  <div class="pd" dir="ltr">
    <header class="pd-top">
      <span class="pd-logo" aria-label="PagerDuty"><svg viewBox="0 0 24 24" width="22" height="22"><rect width="24" height="24" rx="4" fill="#06AC38"/><path d="M8 5h4.6c3 0 4.9 1.6 4.9 4.3 0 2.8-2 4.4-5 4.4H10.9V19H8V5zm2.9 2.5v3.8h1.5c1.4 0 2.1-.7 2.1-1.9s-.7-1.9-2.1-1.9h-1.5z" fill="#fff"/></svg></span>
      <nav class="pd-nav" aria-label="PagerDuty">
        <button v-for="p in PAGES" :key="p.id" type="button" class="pd-nav__item" :class="{ 'is-active': page === p.id || (p.id === 'incidents' && page === 'incident') }" @click="go(p.id)">
          {{ p.label }}<span v-if="p.id === 'incidents' && openPages.length" class="pd-count">{{ openPages.length }}</span>
        </button>
      </nav>
      <span class="pd-top__spacer"></span>
      <span class="pd-oncall" :title="'On call now: ' + oncall.primary">● On call: <b>{{ oncall.primary }}</b></span>
      <span class="pd-avatar" title="you">YO</span>
    </header>

    <main class="pd-main">
      <!-- ===== Incidents (pages) ===== -->
      <section v-if="page === 'incidents'">
        <div class="pd-head">
          <h1 class="pd-h1">Incidents on All Teams</h1>
          <div class="pd-head__actions">
            <button type="button" class="pd-btn pd-btn--primary" @click="declareOpen = true">＋ New Incident</button>
          </div>
        </div>
        <div class="pd-statusbar">
          <button v-for="t in TABS" :key="t.id" type="button" class="pd-tab" :class="{ 'is-active': tab === t.id }" @click="tab = t.id">
            <span class="pd-dot" :class="'is-' + t.id"></span>{{ t.label }} <b>{{ countFor(t.id) }}</b>
          </button>
        </div>
        <div class="pd-bulk">
          <button type="button" class="pd-btn" :disabled="!checked.length || busy" @click="bulk('ack')">✓ Acknowledge</button>
          <button type="button" class="pd-btn" :disabled="!checked.length || busy" @click="bulk('escalate')">⇧ Escalate</button>
          <button type="button" class="pd-btn" :disabled="!checked.length || busy" @click="bulk('resolve')">✔ Resolve</button>
          <span class="pd-muted">{{ checked.length }} selected</span>
        </div>
        <table class="pd-table">
          <thead><tr><th><input type="checkbox" :checked="allChecked" aria-label="Select all" @change="toggleAll" /></th><th>Status</th><th>Urgency</th><th>Title</th><th>Created</th><th>Service</th><th>Assigned To</th><th></th></tr></thead>
          <tbody>
            <tr v-for="p in tabPages" :key="p.id">
              <td><input v-model="checked" type="checkbox" :value="p.id" :aria-label="'Select ' + p.id" /></td>
              <td><span class="pd-status" :class="'is-' + statusKey(p)">{{ statusLabel(p) }}</span></td>
              <td><span class="pd-urgency" :class="urgency(p) === 'High' ? 'is-high' : ''">{{ urgency(p) }}</span></td>
              <td><span class="pd-title">[{{ p.id }}] {{ p.alert }}</span><div class="pd-muted pd-small">{{ summaryOf(p.alert) }}</div></td>
              <td class="pd-nowrap">{{ p.created }}<div v-if="p.ack_seconds !== null && p.ack_seconds !== undefined" class="pd-muted pd-small">ack after {{ p.ack_seconds }}s</div></td>
              <td>shopapi</td>
              <td>{{ p.to }}<span v-if="p.escalated" class="pd-muted pd-small"> (escalated)</span></td>
              <td class="pd-actions">
                <button v-if="statusKey(p) === 'triggered'" type="button" class="pd-btn pd-btn--sm" :disabled="busy" @click="act('ack', p.id)">Acknowledge</button>
                <button v-if="statusKey(p) !== 'resolved'" type="button" class="pd-btn pd-btn--sm" :disabled="busy" @click="act('resolve', p.id)">Resolve</button>
              </td>
            </tr>
            <tr v-if="!tabPages.length"><td colspan="8" class="pd-empty">🎉 No {{ tab === 'any' ? '' : tab }} incidents.</td></tr>
          </tbody>
        </table>

        <h2 class="pd-h2">Major incidents <span class="pd-muted pd-small">Incident Response</span></h2>
        <table class="pd-table">
          <thead><tr><th>#</th><th>Priority</th><th>Title</th><th>Status</th><th>Incident Commander</th><th>Time to mitigate</th></tr></thead>
          <tbody>
            <tr v-for="i in incidents" :key="i.id" class="is-link" @click="openIncident(i.id)">
              <td>{{ i.id }}</td><td><span class="pd-prio" :class="'is-' + String(i.severity).toLowerCase()">{{ prio(i.severity) }}</span></td>
              <td class="pd-title">{{ i.title }}</td>
              <td><span class="pd-status" :class="'is-' + (i.status === 'resolved' ? 'resolved' : i.mitigated ? 'acknowledged' : 'triggered')">{{ i.status }}</span></td>
              <td>{{ i.commander || '—' }}</td><td>{{ i.ttm_min === null || i.ttm_min === undefined ? '—' : i.ttm_min + ' min' }}</td>
            </tr>
            <tr v-if="!incidents.length"><td colspan="6" class="pd-empty">No major incidents declared.</td></tr>
          </tbody>
        </table>
      </section>

      <!-- ===== One major incident ===== -->
      <section v-else-if="page === 'incident' && inc">
        <button type="button" class="pd-back" @click="go('incidents')">← Incidents</button>
        <div class="pd-inc-head">
          <span class="pd-prio" :class="'is-' + String(inc.severity).toLowerCase()">{{ prio(inc.severity) }}</span>
          <h1 class="pd-h1">#{{ inc.id }} {{ inc.title }}</h1>
          <span class="pd-status" :class="'is-' + (inc.status === 'resolved' ? 'resolved' : inc.mitigated ? 'acknowledged' : 'triggered')">{{ inc.status }}</span>
        </div>
        <div class="pd-inc-actions">
          <button type="button" class="pd-btn" @click="panel = 'roles'">Assign roles</button>
          <button type="button" class="pd-btn" @click="panel = 'update'">Add status update</button>
          <button type="button" class="pd-btn" @click="panel = 'statuspage'">Update status page</button>
          <button type="button" class="pd-btn" :disabled="!!inc.mitigated" @click="panel = 'mitigate'">Mark mitigated</button>
          <button type="button" class="pd-btn pd-btn--primary" :disabled="!inc.mitigated || inc.status === 'resolved' || busy" @click="resolveIncident">Resolve</button>
          <button type="button" class="pd-btn" :disabled="busy" @click="postmortem">{{ inc.postmortem ? 'Open postmortem' : 'Create postmortem' }}</button>
          <button v-if="inc.postmortem" type="button" class="pd-btn" :disabled="busy" @click="review">Request review</button>
        </div>
        <div class="pd-inc-grid">
          <div class="pd-card">
            <h3>Responders</h3>
            <dl class="pd-dl">
              <dt>Incident Commander</dt><dd>{{ inc.commander || 'Unassigned' }}</dd>
              <dt>Communications</dt><dd>{{ inc.comms || 'Unassigned' }}</dd>
              <dt>Status page updates</dt><dd>{{ inc.statuspage_updates || 0 }}</dd>
              <dt>Postmortem</dt><dd>{{ inc.postmortem || '—' }} <span v-if="inc.review" class="pd-tag" :class="inc.review === 'approved' ? 'is-ok' : 'is-bad'">{{ inc.review }}</span></dd>
            </dl>
          </div>
          <div class="pd-card pd-card--wide">
            <h3>Timeline</h3>
            <ol class="pd-timeline">
              <li v-for="(e, idx) in incTimeline" :key="idx"><span class="pd-timeline__t">{{ e.time }}</span><span>{{ e.text }}</span></li>
              <li v-if="!incTimeline.length" class="pd-muted">No events yet.</li>
            </ol>
          </div>
        </div>
        <div v-if="panel" class="pd-card pd-form">
          <template v-if="panel === 'roles'">
            <h3>Assign roles</h3>
            <div class="pd-form__row">
              <label>Incident Commander<select v-model="roles.commander" class="pd-input"><option value="">—</option><option v-for="p in PEOPLE" :key="p" :value="p">{{ p }}</option></select></label>
              <label>Communications<select v-model="roles.comms" class="pd-input"><option value="">—</option><option v-for="p in PEOPLE" :key="p" :value="p">{{ p }}</option></select></label>
              <label>Operations<select v-model="roles.ops" class="pd-input"><option value="">—</option><option v-for="p in PEOPLE" :key="p" :value="p">{{ p }}</option></select></label>
            </div>
            <div class="pd-form__actions"><button type="button" class="pd-btn" @click="panel = ''">Cancel</button><button type="button" class="pd-btn pd-btn--primary" :disabled="busy" @click="assignRoles">Save</button></div>
          </template>
          <template v-else-if="panel === 'update'">
            <h3>Add status update</h3>
            <label>Status<select v-model="update.status" class="pd-input"><option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option></select></label>
            <label>Note<textarea v-model="update.note" class="pd-input" rows="3" placeholder="What we know, what we are doing, when the next update is"></textarea></label>
            <div class="pd-form__actions"><button type="button" class="pd-btn" @click="panel = ''">Cancel</button><button type="button" class="pd-btn pd-btn--primary" :disabled="!update.note.trim() || busy" @click="postUpdate">Post update</button></div>
          </template>
          <template v-else-if="panel === 'statuspage'">
            <h3>Update status page (shop.example.com)</h3>
            <label>Message to customers<textarea v-model="statusMessage" class="pd-input" rows="3" placeholder="What customers see, and when we will update next (at least 25 characters)"></textarea></label>
            <div class="pd-form__actions"><button type="button" class="pd-btn" @click="panel = ''">Cancel</button><button type="button" class="pd-btn pd-btn--primary" :disabled="busy" @click="postStatusPage">Publish</button></div>
          </template>
          <template v-else-if="panel === 'mitigate'">
            <h3>Mark mitigated</h3>
            <label>What mitigated it<input v-model="mitigation" class="pd-input" placeholder="rolled back shopapi to 2.4.0" /></label>
            <p class="pd-muted pd-small">PagerDuty checks the service: it refuses while users still see errors.</p>
            <div class="pd-form__actions"><button type="button" class="pd-btn" @click="panel = ''">Cancel</button><button type="button" class="pd-btn pd-btn--primary" :disabled="!mitigation.trim() || busy" @click="mitigate">Mark mitigated</button></div>
          </template>
        </div>
        <pre v-if="output" class="pd-output">{{ output }}</pre>
      </section>

      <!-- ===== On-call schedules ===== -->
      <section v-else-if="page === 'schedules'">
        <h1 class="pd-h1">On-Call Schedules</h1>
        <div class="pd-card">
          <h3>shopapi-primary <span class="pd-muted pd-small">weekly rotation · hand-off Mon 09:00 UTC · escalates after 5 min</span></h3>
          <div class="pd-oncall-now">
            <div><span class="pd-muted">Primary (now)</span><b>{{ oncall.primary }}</b></div>
            <div><span class="pd-muted">Secondary (now)</span><b>{{ oncall.secondary }}</b></div>
          </div>
          <table class="pd-table">
            <thead><tr><th>Week</th><th>Primary</th><th>Secondary</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in oncall.rota" :key="i" :class="{ 'is-current': r[0] === oncall.primary && r[1] === oncall.secondary }">
                <td>Week {{ i + 1 }}</td><td>{{ r[0] }}</td><td>{{ r[1] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pd-card">
          <h3>Escalation policy: shopapi</h3>
          <ol class="pd-esc"><li>Notify the on-call primary immediately</li><li>If not acknowledged in 5 minutes, notify the secondary</li><li>If not acknowledged in 15 minutes, notify the engineering manager</li></ol>
        </div>
      </section>

      <!-- ===== Services ===== -->
      <section v-else-if="page === 'services'">
        <h1 class="pd-h1">Service Directory</h1>
        <table class="pd-table">
          <thead><tr><th>Name</th><th>Status</th><th>Open incidents</th><th>Escalation policy</th></tr></thead>
          <tbody>
            <tr><td class="pd-title">shopapi</td><td><span class="pd-status" :class="'is-' + (openPages.length ? 'triggered' : 'resolved')">{{ openPages.length ? 'Critical' : 'OK' }}</span></td><td>{{ openPages.length }}</td><td>shopapi</td></tr>
            <tr v-for="h in hosts" :key="h.host"><td>{{ h.host }} <span class="pd-muted pd-small">{{ h.role }}</span></td><td><span class="pd-status" :class="'is-' + (h.status === 'healthy' ? 'resolved' : h.status === 'degraded' ? 'acknowledged' : 'triggered')">{{ h.status }}</span></td><td>—</td><td>infrastructure</td></tr>
          </tbody>
        </table>
      </section>

      <!-- ===== Change events & automation ===== -->
      <section v-else-if="page === 'changes'">
        <h1 class="pd-h1">Change Events</h1>
        <table class="pd-table">
          <thead><tr><th>Time</th><th>Summary</th><th>Strategy</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="(d, i) in deploys" :key="i"><td class="pd-nowrap">{{ d.time }}</td><td>Deploy shopapi {{ d.version }} <span class="pd-muted">{{ d.note }}</span></td><td>{{ d.strategy }}</td><td>{{ d.status }}</td></tr>
          </tbody>
        </table>
        <h2 class="pd-h2">Automation Actions</h2>
        <div class="pd-card">
          <div class="pd-rollout">
            <div><span class="pd-muted">Running version</span><b>{{ currentVersion }}</b></div>
            <div v-if="rollout.status"><span class="pd-muted">Canary</span><b>{{ rollout.version }} · {{ rollout.weight_pct }}% · {{ rollout.status }}</b></div>
            <div v-if="rollout.analysis"><span class="pd-muted">Analysis</span><b :class="rollout.analysis === 'pass' ? 'pd-ok' : 'pd-bad'">{{ rollout.analysis }} · {{ rollout.canary_error_pct }}% errors · p99 {{ rollout.canary_p99_ms }} ms</b></div>
          </div>
          <div class="pd-form__row">
            <label>Release<select v-model="release.version" class="pd-input"><option v-for="v in versions" :key="v.version" :value="v.version">{{ v.version }}{{ v.current ? ' (running)' : '' }} - {{ v.notes }}</option></select></label>
            <label>Strategy<select v-model="release.strategy" class="pd-input"><option value="canary">canary</option><option value="rolling">rolling</option></select></label>
            <label v-if="release.strategy === 'canary'">Canary weight %<input v-model.number="release.weight" type="number" min="1" max="50" class="pd-input" /></label>
          </div>
          <div class="pd-form__actions pd-form__actions--left">
            <button type="button" class="pd-btn pd-btn--primary" :disabled="busy || !release.version" @click="deploy('rollout')">Run: Deploy</button>
            <button type="button" class="pd-btn" :disabled="busy || !rollout.status" @click="deploy('analyze')">Run: Analyze canary</button>
            <button type="button" class="pd-btn" :disabled="busy || !rollout.status" @click="deploy('promote')">Run: Promote</button>
            <button type="button" class="pd-btn" :disabled="busy || !rollout.status" @click="deploy('abort')">Run: Abort</button>
            <button type="button" class="pd-btn pd-btn--danger" :disabled="busy" @click="deploy('rollback')">Run: Roll back</button>
          </div>
          <pre v-if="output" class="pd-output">{{ output }}</pre>
        </div>
      </section>
    </main>

    <!-- New incident -->
    <div v-if="declareOpen" class="pd-modal" role="dialog" aria-modal="true" aria-label="New incident">
      <div class="pd-modal__card">
        <h2>New Incident</h2>
        <label>Impacted service<select v-model="declare.service" class="pd-input"><option value="shopapi">shopapi</option></select></label>
        <label>Title<input v-model="declare.title" class="pd-input" placeholder="Checkout returns 502 errors" /></label>
        <label>Priority<select v-model="declare.severity" class="pd-input"><option value="SEV1">P1 - SEV1 total outage</option><option value="SEV2">P2 - SEV2 major degradation</option><option value="SEV3">P3 - SEV3 minor</option><option value="SEV4">P4 - SEV4</option></select></label>
        <p v-if="declareError" class="pd-error">{{ declareError }}</p>
        <div class="pd-form__actions"><button type="button" class="pd-btn" @click="declareOpen = false">Cancel</button><button type="button" class="pd-btn pd-btn--primary" :disabled="!declare.title.trim() || busy" @click="declareIncident">Create Incident</button></div>
      </div>
    </div>

    <div class="pd-toasts" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="pd-toast" :class="'is-' + f.type">
        <b>{{ f.title }}</b><span v-if="f.detail">{{ f.detail }}</span>
        <button type="button" aria-label="Dismiss" @click="api.dismiss(f.id)">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PagerDuty over the ShopFront estate. Pages (the engine's notifications to
 * the on-call) are PagerDuty incidents: acknowledge / escalate / resolve run
 * `oncall ack|escalate|resolve`. Declared incidents are Incident Response:
 * `incident declare|role|update|statuspage|mitigate|resolve|postmortem|review`.
 * Automation Actions run the release commands (`deploy rollout|analyze|...`).
 */
import { computed, reactive, ref, watch } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import { str } from './sreKit';

const props = defineProps<{ view: Record<string, any>; api: any; tool: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'location', url: string): void; (e: 'refresh'): void }>();
const api = props.api;

const PAGES = [{ id: 'incidents', label: 'Incidents' }, { id: 'services', label: 'Services' },
    { id: 'schedules', label: 'People' }, { id: 'changes', label: 'Automation' }];
const TABS = [{ id: 'triggered', label: 'Triggered' }, { id: 'acknowledged', label: 'Acknowledged' },
    { id: 'resolved', label: 'Resolved' }, { id: 'any', label: 'Any Status' }];
const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'];
const PEOPLE = ['you', 'sam', 'lena'];

const page = ref('incidents');
const tab = ref('triggered');
const checked = ref<string[]>([]);
const selectedInc = ref('');
const panel = ref('');
const output = ref('');
const declareOpen = ref(false);
const declareError = ref('');
const declare = reactive({ service: 'shopapi', title: '', severity: 'SEV2' });
const roles = reactive({ commander: 'you', comms: 'sam', ops: 'lena' });
const update = reactive({ status: 'identified', note: '' });
const statusMessage = ref('');
const mitigation = ref('');
const release = reactive({ version: '', strategy: 'canary', weight: 10 });

const pages = computed(() => rows<any>(props.view, 'pages').slice().reverse());
const openPages = computed(() => pages.value.filter(p => statusKey(p) !== 'resolved'));
const incidents = computed(() => rows<any>(props.view, 'incidents').slice().reverse());
const inc = computed(() => incidents.value.find(i => i.id === selectedInc.value) || null);
const hosts = computed(() => rows<any>(props.view, 'hosts'));
const deploys = computed(() => rows<any>(props.view, 'deploys').slice().reverse());
const rollout = computed(() => pick<Record<string, any>>(props.view, 'rollout', {}));
const versions = computed(() => rows<any>(props.view, 'versions'));
const currentVersion = computed(() => str(pick(props.view, 'overview.version', '')));
const oncall = computed(() => {
    const o = pick<Record<string, any>>(props.view, 'oncall', {});
    return { primary: str(o.primary, 'you'), secondary: str(o.secondary, 'sam'), rota: Array.isArray(o.rota) ? o.rota : [] };
});
const alerts = computed(() => rows<any>(props.view, 'alerts'));
const incTimeline = computed(() => {
    if (!inc.value) return [];
    const id = inc.value.id;
    return (pick<string[]>(props.view, 'timeline', []) || []).filter(l => String(l).split(' ')[1] === id).map(l => {
        const parts = String(l).split(' ');
        return { time: parts[0], text: parts.slice(2).join(' ') };
    }).reverse();
});
const tabPages = computed(() => tab.value === 'any' ? pages.value : pages.value.filter(p => statusKey(p) === tab.value));
const allChecked = computed(() => tabPages.value.length > 0 && tabPages.value.every(p => checked.value.includes(p.id)));

watch(versions, list => { if (!release.version && list.length) release.version = (list.find(v => !v.current) || list[0]).version; }, { immediate: true });
watch([page, selectedInc], () => {
    const base = 'https://shopfront.pagerduty.com';
    emit('location', page.value === 'incident' ? `${base}/incidents/${selectedInc.value}` : page.value === 'schedules' ? `${base}/schedules`
        : page.value === 'services' ? `${base}/service-directory` : page.value === 'changes' ? `${base}/automation/actions` : `${base}/incidents`);
}, { immediate: true });

function statusKey(p: any) { const s = String(p.status || ''); return s === 'resolved' ? 'resolved' : s === 'acknowledged' ? 'acknowledged' : 'triggered'; }
function statusLabel(p: any) { return { triggered: 'Triggered', acknowledged: 'Acknowledged', resolved: 'Resolved' }[statusKey(p)]; }
function countFor(id: string) { return id === 'any' ? pages.value.length : pages.value.filter(p => statusKey(p) === id).length; }
function urgency(p: any) { const a = alerts.value.find(x => x.name === p.alert); return !a || /page|critical/.test(String(a.severity)) ? 'High' : 'Low'; }
function summaryOf(name: string) { const a = alerts.value.find(x => x.name === name); return a ? a.summary : ''; }
function prio(sev: string) { return 'P' + String(sev).replace(/\D/g, ''); }
function go(p: string) { page.value = p; panel.value = ''; output.value = ''; }
function openIncident(id: string) { selectedInc.value = id; page.value = 'incident'; panel.value = ''; output.value = ''; }
function toggleAll() {
    checked.value = allChecked.value ? [] : tabPages.value.map(p => p.id);
}

async function act(verb: 'ack' | 'resolve' | 'escalate', id: string) {
    const label = { ack: 'acknowledged', resolve: 'resolved', escalate: 'escalated' }[verb];
    await api.exec(cli(['oncall', verb, id]), { success: `${id} ${label}` });
}
async function bulk(verb: 'ack' | 'resolve' | 'escalate') {
    const ids = [...checked.value];
    for (const id of ids) await act(verb, id);
    checked.value = [];
}

async function declareIncident() {
    declareError.value = '';
    const result = await api.exec(cli(['incident', 'declare'], {
        '--title': declare.title.trim(), '--severity': declare.severity, '--service': declare.service,
    }), { quiet: true });
    if (!result.ok) { declareError.value = String(result.error || result.output || 'Could not create the incident.'); return; }
    api.notify('success', 'Incident created', String(result.output || '').split('\n')[0]);
    declareOpen.value = false;
    declare.title = '';
    const m = /(INC-\d+)/.exec(String(result.output || ''));
    if (m) openIncident(m[1]);
}
async function run(command: string, success: string) {
    const result = await api.exec(command, { success, quiet: false });
    output.value = String(result.ok ? result.output : (result.error || result.output) || '');
    if (result.ok) panel.value = '';
    return result;
}
function assignRoles() {
    return run(cli(['incident', 'role', selectedInc.value], { '--commander': roles.commander, '--comms': roles.comms, '--ops': roles.ops }), 'Roles assigned');
}
async function postUpdate() {
    const r = await run(cli(['incident', 'update', selectedInc.value], { '--status': update.status, '--note': update.note.trim() }), 'Status update posted');
    if (r.ok) update.note = '';
}
async function postStatusPage() {
    const r = await run(cli(['incident', 'statuspage', selectedInc.value], { '--message': statusMessage.value.trim() }), 'Status page updated');
    if (r.ok) statusMessage.value = '';
}
function mitigate() { return run(cli(['incident', 'mitigate', selectedInc.value], { '--action': mitigation.value.trim() }), 'Marked mitigated'); }
function resolveIncident() { return run(cli(['incident', 'resolve', selectedInc.value]), 'Incident resolved'); }
function postmortem() { return run(cli(['incident', 'postmortem', selectedInc.value]), 'Postmortem draft ready - complete it in the Files tab'); }
function review() { return run(cli(['incident', 'review', selectedInc.value]), 'Postmortem reviewed'); }

async function deploy(verb: string) {
    if (verb === 'rollback' && !window.confirm('Roll shopapi back to the previous good release?')) return;
    let command = cli(['deploy', verb]);
    if (verb === 'rollout') {
        command = cli(['deploy', 'rollout'], {
            '--version': release.version, '--strategy': release.strategy,
            '--canary-weight': release.strategy === 'canary' ? String(release.weight || 10) : '',
        });
    }
    const result = await api.exec(command, { success: `Automation action "${verb}" finished` });
    output.value = String(result.ok ? result.output : (result.error || result.output) || '');
}
</script>

<style scoped>
.pd { --g: #06ac38; --b: #e1e4e8; --t: #202020; --m: #6c6f73; display: flex; flex-direction: column; height: 100%; min-height: 34rem; background: #f6f7f9; color: var(--t); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; position: relative; }
.pd-top { display: flex; align-items: center; gap: 14px; height: 48px; padding: 0 16px; background: #0b3d1e; color: #fff; flex: none; }
.pd-nav { display: flex; gap: 2px; height: 100%; }
.pd-nav__item { background: none; border: 0; color: rgba(255, 255, 255, 0.82); font: inherit; padding: 0 12px; cursor: pointer; height: 100%; border-bottom: 3px solid transparent; display: flex; align-items: center; gap: 6px; }
.pd-nav__item:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }
.pd-nav__item.is-active { color: #fff; border-bottom-color: var(--g); }
.pd-count { background: #d0021b; color: #fff; border-radius: 9px; padding: 0 6px; font-size: 11px; }
.pd-top__spacer { flex: 1; }
.pd-oncall { font-size: 12.5px; color: rgba(255, 255, 255, 0.85); }
.pd-oncall::first-letter { color: #6fe39a; }
.pd-avatar { width: 28px; height: 28px; border-radius: 50%; background: #5b6ee1; display: grid; place-items: center; font-size: 11px; font-weight: 700; }
.pd-main { flex: 1; overflow: auto; padding: 18px 22px 40px; min-height: 0; }
.pd-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
.pd-h1 { font-size: 22px; font-weight: 500; margin: 0; }
.pd-h2 { font-size: 17px; font-weight: 500; margin: 24px 0 10px; }
.pd-muted { color: var(--m); }
.pd-small { font-size: 12px; }
.pd-nowrap { white-space: nowrap; }
.pd-btn { background: #fff; border: 1px solid #c7cbd1; border-radius: 4px; padding: 7px 14px; font: inherit; font-size: 13px; cursor: pointer; color: var(--t); }
.pd-btn:hover { background: #f1f2f4; }
.pd-btn--primary { background: var(--g); border-color: var(--g); color: #fff; font-weight: 600; }
.pd-btn--primary:hover { background: #048a2d; }
.pd-btn--danger { color: #d0021b; border-color: #e6a3ab; }
.pd-btn--sm { padding: 3px 10px; font-size: 12px; }
.pd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pd-input { width: 100%; border: 1px solid #c7cbd1; border-radius: 4px; padding: 7px 10px; font: inherit; background: #fff; }
.pd-statusbar { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.pd-tab { background: #fff; border: 1px solid var(--b); border-radius: 4px; padding: 6px 14px; cursor: pointer; font: inherit; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.pd-tab.is-active { border-color: var(--g); box-shadow: inset 0 -2px 0 var(--g); }
.pd-tab b { font-weight: 600; }
.pd-dot { width: 9px; height: 9px; border-radius: 50%; }
.pd-dot.is-triggered { background: #d0021b; } .pd-dot.is-acknowledged { background: #f5a623; } .pd-dot.is-resolved { background: var(--g); } .pd-dot.is-any { background: #8a8d91; }
.pd-bulk { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.pd-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--b); }
.pd-table th { text-align: left; font-size: 12px; color: var(--m); font-weight: 600; padding: 8px 10px; border-bottom: 1px solid var(--b); background: #fafbfc; }
.pd-table td { padding: 10px; border-bottom: 1px solid var(--b); vertical-align: top; }
.pd-table tr.is-link { cursor: pointer; }
.pd-table tr.is-link:hover td { background: #f5f8ff; }
.pd-table tr.is-current td { background: #eaf8ef; font-weight: 600; }
.pd-empty { text-align: center; color: var(--m); padding: 24px !important; }
.pd-title { color: #005cc5; font-weight: 500; }
.pd-actions { white-space: nowrap; display: flex; gap: 4px; }
.pd-status { display: inline-block; border-radius: 3px; padding: 2px 8px; font-size: 12px; font-weight: 600; color: #fff; text-transform: capitalize; }
.pd-status.is-triggered { background: #d0021b; } .pd-status.is-acknowledged { background: #f5a623; color: #3a2700; } .pd-status.is-resolved { background: var(--g); }
.pd-urgency { font-size: 12px; color: var(--m); }
.pd-urgency.is-high { color: #d0021b; font-weight: 700; }
.pd-prio { display: inline-block; border-radius: 3px; padding: 1px 6px; font-size: 12px; font-weight: 700; color: #fff; background: #8a8d91; }
.pd-prio.is-sev1 { background: #a30014; } .pd-prio.is-sev2 { background: #e8590c; } .pd-prio.is-sev3 { background: #f5a623; color: #3a2700; }
.pd-back { background: none; border: 0; color: #005cc5; cursor: pointer; font: inherit; padding: 0; margin-bottom: 10px; }
.pd-inc-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.pd-inc-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.pd-inc-grid { display: grid; grid-template-columns: minmax(14rem, 1fr) minmax(0, 2fr); gap: 12px; }
.pd-card { background: #fff; border: 1px solid var(--b); border-radius: 6px; padding: 14px 16px; margin-bottom: 12px; }
.pd-card h3 { font-size: 15px; margin: 0 0 10px; font-weight: 600; }
.pd-dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; margin: 0; }
.pd-dl dt { color: var(--m); font-size: 13px; }
.pd-dl dd { margin: 0; }
.pd-tag { border-radius: 3px; padding: 0 6px; font-size: 11.5px; margin-left: 4px; }
.pd-tag.is-ok { background: #eaf8ef; color: #046b25; } .pd-tag.is-bad { background: #fdecee; color: #a30014; }
.pd-timeline { list-style: none; margin: 0; padding: 0; max-height: 22rem; overflow: auto; }
.pd-timeline li { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid #f0f1f3; }
.pd-timeline__t { color: var(--m); font-variant-numeric: tabular-nums; min-width: 3.4rem; }
.pd-form label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 600; margin-bottom: 10px; flex: 1; min-width: 10rem; }
.pd-form__row { display: flex; gap: 12px; flex-wrap: wrap; }
.pd-form__actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.pd-form__actions--left { justify-content: flex-start; }
.pd-output { background: #1f2328; color: #e6edf3; border-radius: 6px; padding: 10px 12px; white-space: pre-wrap; font-family: SFMono-Regular, Menlo, monospace; font-size: 12px; margin-top: 10px; }
.pd-oncall-now, .pd-rollout { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 12px; }
.pd-oncall-now div, .pd-rollout div { display: flex; flex-direction: column; }
.pd-oncall-now b { font-size: 18px; }
.pd-esc { margin: 0; padding-left: 20px; line-height: 1.8; }
.pd-ok { color: #046b25; } .pd-bad { color: #a30014; }
.pd-error { color: #a30014; background: #fdecee; padding: 8px 10px; border-radius: 4px; }
.pd-modal { position: absolute; inset: 0; z-index: 20; background: rgba(0, 0, 0, 0.45); display: grid; place-items: center; padding: 16px; }
.pd-modal__card { background: #fff; border-radius: 8px; padding: 20px 22px; width: min(32rem, 100%); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25); }
.pd-modal__card h2 { font-size: 19px; margin: 0 0 12px; }
.pd-modal__card label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 600; margin-bottom: 10px; }
.pd-toasts { position: absolute; left: 12px; bottom: 12px; display: flex; flex-direction: column; gap: 8px; z-index: 30; }
.pd-toast { background: #fff; border: 1px solid var(--b); border-left: 4px solid #0366d6; border-radius: 4px; padding: 8px 30px 8px 10px; position: relative; max-width: 24rem; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
.pd-toast.is-success { border-left-color: var(--g); }
.pd-toast.is-error { border-left-color: #d0021b; }
.pd-toast button { position: absolute; right: 6px; top: 4px; background: none; border: 0; color: var(--m); cursor: pointer; font-size: 16px; }
@container sl-portal (max-width: 760px) {
    .pd-inc-grid { grid-template-columns: 1fr; }
    .pd-table th:nth-child(6), .pd-table td:nth-child(6) { display: none; }
}
</style>
