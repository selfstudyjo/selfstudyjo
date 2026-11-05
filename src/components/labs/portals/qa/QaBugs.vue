<template>
  <div class="bt" dir="ltr">
    <header class="bt-head">
      <span class="bt-logo" aria-hidden="true">&#128030;</span><strong>Bug Tracker</strong>
      <span class="bt-muted">QA Shop &middot; build {{ build }}</span>
      <div class="bt-spacer"></div>
      <span v-if="pending.length" class="bt-pending">{{ pending.length }} fix(es) waiting for a deploy</span>
      <button type="button" class="bt-btn" :disabled="busy || !pending.length" @click="deploy">Deploy new build</button>
      <button type="button" class="bt-btn bt-btn--primary" :disabled="busy" @click="openCreate()">Create</button>
    </header>

    <div class="bt-body">
      <aside class="bt-inbox">
        <h3>Evidence inbox</h3>
        <p class="bt-muted bt-small">Failed tests, manual testing and scans record observations here. File a bug from one so a developer can reproduce it.</p>
        <div v-for="o in openEvidence" :key="o.id" class="bt-ev">
          <div><b>{{ o.id }}</b> <span class="bt-muted">{{ o.source }}</span></div>
          <p>{{ o.summary }}</p>
          <button type="button" class="bt-link" @click="openCreate(o)">File bug &rsaquo;</button>
        </div>
        <p v-if="!openEvidence.length" class="bt-muted bt-small">Nothing waiting - every observation has a bug.</p>
      </aside>

      <main class="bt-board">
        <div v-for="col in COLUMNS" :key="col.id" class="bt-col">
          <div class="bt-col__head">{{ col.label }} <span>{{ byStatus(col.states).length }}</span></div>
          <button v-for="b in byStatus(col.states)" :key="b.id" type="button" class="bt-card" :class="{ 'is-sel': current?.id === b.id }" @click="currentId = b.id">
            <span class="bt-card__title">{{ b.title }}</span>
            <span class="bt-card__meta">
              <span class="bt-sev" :class="'is-' + b.severity">{{ b.severity || '?' }}</span>
              <span class="bt-prio">{{ b.priority || '?' }}</span>
              <span class="bt-key">{{ b.id }}</span>
              <span v-if="!b.complete" class="bt-incomplete" title="Report is incomplete">!</span>
            </span>
          </button>
        </div>
      </main>

      <aside v-if="current" class="bt-detail">
        <div class="bt-detail__head">
          <span class="bt-key">{{ current.id }}</span>
          <button type="button" class="bt-x" aria-label="Close" @click="currentId = ''">&times;</button>
        </div>
        <h2>{{ current.title }}</h2>
        <div class="bt-actions">
          <span class="bt-status">{{ STATUS_LABEL[current.status] || current.status }}</span>
          <button v-for="t in transitions" :key="t" type="button" class="bt-btn" :disabled="busy" @click="move(t)">{{ STATUS_LABEL[t] || t }}</button>
          <button v-if="current.status === 'in_progress'" type="button" class="bt-btn bt-btn--dev" :disabled="busy" @click="devFix">Developer: fix</button>
          <button v-if="current.status === 'fixed'" type="button" class="bt-btn bt-btn--primary" :disabled="busy" @click="retest">Retest</button>
          <button type="button" class="bt-btn" :disabled="busy" @click="lint">Check report</button>
        </div>
        <dl class="bt-fields">
          <dt>Severity</dt><dd>{{ current.severity || '-' }}</dd>
          <dt>Priority</dt><dd>{{ current.priority || '-' }}</dd>
          <dt>Found in</dt><dd>build {{ current.build }}</dd>
          <dt>Environment</dt><dd>{{ current.env || '-' }}</dd>
          <dt>Evidence</dt><dd>{{ current.observation || current.finding || 'none attached' }}</dd>
          <dt>Report quality</dt><dd>{{ current.quality }}/8</dd>
        </dl>
        <h4>Steps to reproduce</h4><p class="bt-pre">{{ current.steps || '-' }}</p>
        <h4>Expected</h4><p>{{ current.expected || '-' }}</p>
        <h4>Actual</h4><p>{{ current.actual || '-' }}</p>
        <h4>History</h4><p class="bt-muted">{{ (current.history || []).map((h: string) => STATUS_LABEL[h] || h).join(' → ') }}</p>
      </aside>
    </div>

    <div v-if="create" class="bt-modal" role="dialog" aria-modal="true" aria-label="Create bug">
      <form class="bt-modal__card" @submit.prevent="submit">
        <h3>Create bug</h3>
        <label class="bt-span">Summary <input v-model="create.title" required placeholder="Cart accepts quantity 11 although the maximum is 10"></label>
        <label>Severity <select v-model="create.severity"><option v-for="s in SEVERITIES" :key="s">{{ s }}</option></select></label>
        <label>Priority <select v-model="create.priority"><option v-for="p in PRIORITIES" :key="p">{{ p }}</option></select></label>
        <label class="bt-span">Steps to reproduce <textarea v-model="create.steps" rows="3" placeholder="1. Open /product/2; 2. Enter quantity 11; 3. Click Add to cart"></textarea></label>
        <label>Expected <input v-model="create.expected" placeholder="Quantity must be between 1 and 10"></label>
        <label>Actual <input v-model="create.actual" placeholder="Added to cart"></label>
        <label>Environment <input v-model="create.env" placeholder="build 1.0, Chrome desktop, alice@qa.shop"></label>
        <label>Evidence
          <select v-model="create.evidence">
            <option value="">None</option>
            <option v-for="o in observations" :key="o.id" :value="'obs:' + o.id">{{ o.id }} - {{ o.summary.slice(0, 60) }}</option>
            <option v-for="f in findings" :key="f.id" :value="'find:' + f.id">{{ f.id }} - {{ f.rule }} {{ f.target }}</option>
          </select>
        </label>
        <div class="bt-span bt-row">
          <button type="submit" class="bt-btn bt-btn--primary" :disabled="busy">Create</button>
          <button type="button" class="bt-btn" @click="create = null">Cancel</button>
        </div>
      </form>
    </div>

    <div class="bt-flashes" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="bt-flash" :class="'bt-flash--' + f.type">
        <b>{{ f.title }}</b><span v-if="f.detail" class="bt-flash__d">{{ f.detail }}</span>
        <button type="button" aria-label="Dismiss" @click="api.dismiss(f.id)">&times;</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import { STATUS_LABEL } from './qaKit';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'location', url: string): void; (e: 'refresh'): void }>();

const COLUMNS = [
    { id: 'todo', label: 'To Do', states: ['new', 'reopened', 'deferred'] },
    { id: 'triaged', label: 'Triaged', states: ['triaged'] },
    { id: 'progress', label: 'In Progress', states: ['in_progress'] },
    { id: 'fixed', label: 'Fixed', states: ['fixed'] },
    { id: 'done', label: 'Done', states: ['verified', 'closed', 'rejected', 'duplicate'] },
];
const SEVERITIES = ['critical', 'major', 'minor', 'trivial'];
const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];

const bugs = computed(() => rows<any>(props.view, 'bugs'));
const observations = computed(() => rows<any>(props.view, 'observations'));
const findings = computed(() => rows<any>(props.view, 'findings'));
const pending = computed(() => rows<string>(props.view, 'pending'));
const flow = computed(() => pick<Record<string, string[]>>(props.view, 'flow', {}));
const build = computed(() => String(pick(props.view, 'build', '1.0')));
const busy = computed(() => Boolean(props.busy) || props.api.busy.value);
const currentId = ref('');
const current = computed(() => bugs.value.find(b => b.id === currentId.value) || null);
// "fixed" belongs to the developer and "verified" to a retest - the tracker
// offers neither as a plain transition, exactly as the engine refuses them.
const transitions = computed(() => (flow.value[current.value?.status] || []).filter(t => t !== 'fixed' && t !== 'verified'));
const openEvidence = computed(() => {
    const used = new Set(bugs.value.flatMap(b => [b.observation, b.finding]).filter(Boolean));
    return [...observations.value, ...findings.value.map(f => ({ ...f, summary: `${f.rule} on ${f.target}: ${f.detail || ''}`, source: f.kind }))]
        .filter(o => !used.has(o.id)).slice(-12).reverse();
});
const create = ref<any>(null);
emit('location', 'https://qa-shop.atlassian.net/jira/software/projects/QA/boards/2');

function byStatus(states: string[]) {
    return bugs.value.filter(b => states.includes(b.status));
}
function openCreate(evidence?: any) {
    create.value = { title: '', severity: 'major', priority: 'P2', steps: '', expected: '', actual: evidence?.summary || '',
        env: `build ${build.value}, Desktop Chrome`, evidence: evidence ? (String(evidence.id).startsWith('FIND') ? 'find:' : 'obs:') + evidence.id : '' };
}
async function submit() {
    const c = create.value;
    const [kind, id] = String(c.evidence || ':').split(':');
    const result = await props.api.exec(cli(['qa', 'bug', 'new'], {
        '--title': c.title, '--severity': c.severity, '--priority': c.priority, '--steps': c.steps,
        '--expected': c.expected, '--actual': c.actual, '--env': c.env,
        '--from-observation': kind === 'obs' ? id : '', '--from-finding': kind === 'find' ? id : '',
    }), { success: 'Bug created' });
    if (result.ok) {
        create.value = null;
        const created = /Created (BUG-\d+)/.exec(String(result.output || ''));
        if (created) currentId.value = created[1];
        if (/quality \d\/8/.test(String(result.output || ''))) props.api.notify('warning', 'The report is incomplete', 'Triage will bounce it - see Check report.');
    }
}
function move(target: string) {
    void props.api.exec(cli(['qa', 'bug', 'move', current.value.id, target]), { success: `${current.value.id} → ${STATUS_LABEL[target] || target}` });
}
function devFix() {
    void props.api.exec(cli(['qa', 'dev', 'fix', current.value.id]), { success: 'Fixed by development - deploy a new build, then retest' });
}
function retest() {
    void props.api.exec(cli(['qa', 'bug', 'retest', current.value.id]), { success: 'Retest passed - verified', failure: 'Retest failed' });
}
async function lint() {
    const result = await props.api.exec(cli(['qa', 'bug', 'lint', current.value.id]), { quiet: true });
    props.api.notify(result.ok ? 'success' : 'warning', result.ok ? 'Report is complete' : 'Report needs work',
                     String(result.ok ? result.output : result.error || result.output || '').trim());
}
function deploy() {
    void props.api.exec(cli(['qa', 'app', 'deploy']), { success: 'New build deployed to the test environment' });
}
</script>

<style scoped>
.bt { --bt-blue: #0c66e4; --bt-line: #dcdfe4; display: flex; flex-direction: column; height: 100%; min-height: 560px; background: #fff; color: #172b4d;
  font: 13px/1.45 -apple-system, 'Segoe UI', Roboto, sans-serif; position: relative; }
.bt-head { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--bt-line); flex-wrap: wrap; }
.bt-spacer { flex: 1; }
.bt-muted { color: #626f86; }
.bt-small { font-size: 12px; }
.bt-pending { background: #fff7d6; color: #7f5f01; border-radius: 3px; padding: 2px 8px; font-size: 12px; }
.bt-btn { border: 0; background: #f1f2f4; color: #172b4d; border-radius: 3px; padding: 6px 12px; cursor: pointer; font: inherit; font-weight: 500; }
.bt-btn:hover:not(:disabled) { background: #dcdfe4; }
.bt-btn--primary { background: var(--bt-blue); color: #fff; } .bt-btn--primary:hover:not(:disabled) { background: #0055cc; }
.bt-btn--dev { background: #dfd8fd; color: #352c63; }
.bt-btn:disabled { opacity: .5; cursor: default; }
.bt-body { flex: 1; display: grid; grid-template-columns: minmax(200px, 22%) minmax(0, 1fr) auto; min-height: 0; }
.bt-inbox { border-right: 1px solid var(--bt-line); padding: 10px; overflow: auto; background: #f7f8f9; }
.bt-inbox h3 { margin: 0 0 4px; font-size: 13px; }
.bt-ev { background: #fff; border: 1px solid var(--bt-line); border-radius: 4px; padding: 7px 8px; margin: 6px 0; font-size: 12px; }
.bt-ev p { margin: 4px 0; }
.bt-link { border: 0; background: none; color: var(--bt-blue); cursor: pointer; padding: 0; font: inherit; font-weight: 600; }
.bt-board { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(170px, 1fr); gap: 8px; padding: 10px; overflow: auto; align-items: start; }
.bt-col { background: #f1f2f4; border-radius: 6px; padding: 6px; min-height: 160px; }
.bt-col__head { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #44546f; padding: 4px 6px 8px; display: flex; justify-content: space-between; }
.bt-card { display: grid; gap: 6px; width: 100%; text-align: left; background: #fff; border: 1px solid transparent; border-radius: 4px; padding: 8px;
  box-shadow: 0 1px 1px rgba(9,30,66,.25); margin-bottom: 6px; cursor: pointer; font: inherit; color: inherit; }
.bt-card.is-sel { border-color: var(--bt-blue); }
.bt-card__meta { display: flex; gap: 6px; align-items: center; font-size: 11px; }
.bt-sev { border-radius: 3px; padding: 0 5px; font-weight: 700; text-transform: uppercase; font-size: 10px; background: #dcdfe4; }
.bt-sev.is-critical { background: #ffd5d2; color: #ae2e24; } .bt-sev.is-major { background: #fedec8; color: #a54800; }
.bt-sev.is-minor { background: #e9f2ff; color: #0055cc; }
.bt-prio { color: #44546f; font-weight: 600; }
.bt-key { color: #626f86; margin-left: auto; }
.bt-incomplete { background: #ae2e24; color: #fff; border-radius: 50%; width: 15px; height: 15px; display: grid; place-items: center; font-weight: 800; font-size: 10px; }
.bt-detail { width: min(360px, 40vw); border-left: 1px solid var(--bt-line); padding: 12px 14px; overflow: auto; }
.bt-detail__head { display: flex; justify-content: space-between; align-items: center; }
.bt-x { border: 0; background: none; font-size: 20px; cursor: pointer; color: #626f86; }
.bt-detail h2 { font-size: 18px; margin: 4px 0 10px; }
.bt-detail h4 { margin: 12px 0 2px; font-size: 12px; color: #44546f; }
.bt-detail p { margin: 0; }
.bt-pre { white-space: pre-wrap; }
.bt-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.bt-status { background: #e9f2ff; color: #0055cc; border-radius: 3px; padding: 4px 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
.bt-fields { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 12px 0 0; }
.bt-fields dt { color: #626f86; } .bt-fields dd { margin: 0; }
.bt-modal { position: absolute; inset: 0; background: rgba(9,30,66,.54); display: flex; align-items: flex-start; justify-content: center; padding: 30px 12px; z-index: 3; overflow: auto; }
.bt-modal__card { background: #fff; border-radius: 6px; padding: 16px 18px; width: min(640px, 100%); display: grid; grid-template-columns: 1fr 1fr; gap: 10px; box-shadow: 0 8px 24px rgba(9,30,66,.3); }
.bt-modal__card h3 { grid-column: 1 / -1; margin: 0; }
.bt-modal__card label { display: grid; gap: 3px; font-size: 12px; font-weight: 600; color: #44546f; }
.bt-modal__card input, .bt-modal__card select, .bt-modal__card textarea { border: 2px solid #dcdfe4; border-radius: 3px; padding: 6px 8px; font: inherit; font-weight: 400; color: #172b4d; background: #fff; }
.bt-span { grid-column: 1 / -1; }
.bt-row { display: flex; gap: 6px; justify-content: flex-end; }
.bt-flashes { position: absolute; left: 12px; bottom: 12px; display: grid; gap: 6px; max-width: 400px; z-index: 4; }
.bt-flash { background: #fff; border-left: 4px solid #22a06b; box-shadow: 0 4px 12px rgba(9,30,66,.25); padding: 9px 28px 9px 10px; border-radius: 3px; position: relative; display: grid; }
.bt-flash--error { border-left-color: #c9372c; } .bt-flash--warning { border-left-color: #e2b203; }
.bt-flash__d { white-space: pre-wrap; color: #44546f; font-size: 12px; }
.bt-flash button { position: absolute; right: 6px; top: 4px; background: none; border: 0; cursor: pointer; font-size: 16px; color: #626f86; }
@container sl-portal (max-width: 820px) {
  .bt-body { grid-template-columns: 1fr; }
  .bt-inbox { border-right: 0; border-bottom: 1px solid var(--bt-line); max-height: 200px; }
  .bt-detail { width: auto; border-left: 0; border-top: 1px solid var(--bt-line); }
}
</style>
