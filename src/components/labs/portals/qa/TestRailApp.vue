<template>
  <div class="tr" dir="ltr">
    <header class="tr-head">
      <span class="tr-logo" aria-hidden="true">TR</span><strong>TestRail</strong>
      <span class="tr-proj">QA Shop &middot; Release 1.1</span>
      <div class="tr-spacer"></div>
      <span class="tr-muted">Build {{ build }}</span>
    </header>
    <nav class="tr-nav">
      <button v-for="t in TABS" :key="t.id" type="button" :class="{ 'is-active': tab === t.id }" @click="tab = t.id">{{ t.label }}</button>
    </nav>

    <main class="tr-main">
      <!-- Dashboard -->
      <section v-if="tab === 'dashboard'" class="tr-grid">
        <div class="tr-stat"><b>{{ cases.length }}</b><span>Test cases</span></div>
        <div class="tr-stat tr-stat--ok"><b>{{ passed }}</b><span>Passed</span></div>
        <div class="tr-stat tr-stat--bad"><b>{{ failed }}</b><span>Failed</span></div>
        <div class="tr-stat"><b>{{ untested }}</b><span>Untested</span></div>
        <div class="tr-card tr-wide">
          <h3>Progress</h3>
          <div class="tr-bar" role="img" :aria-label="`${passed} passed, ${failed} failed, ${untested} untested`">
            <span class="ok" :style="{ flexGrow: passed }"></span><span class="bad" :style="{ flexGrow: failed }"></span><span class="none" :style="{ flexGrow: untested || (cases.length ? 0 : 1) }"></span>
          </div>
          <p class="tr-muted">{{ cases.length ? Math.round(100 * passed / cases.length) : 0 }}% passed &middot; {{ risks.length }} risk(s) &middot; {{ sessions.length }} exploratory session(s)</p>
        </div>
        <div class="tr-card tr-wide">
          <h3>Coverage by requirement</h3>
          <div v-for="c in coverage" :key="c.req + c.technique" class="tr-cov">
            <span class="tr-badge" :class="c.complete ? 'ok' : 'warn'">{{ c.complete ? 'Complete' : 'Gaps' }}</span>
            <b>{{ c.req }}</b> {{ c.technique }} <span class="tr-muted">covered: {{ (c.covered || []).join(', ') || '-' }}<template v-if="c.missing?.length"> &middot; missing: {{ c.missing.join(', ') }}</template></span>
          </div>
        </div>
      </section>

      <!-- Requirements -->
      <section v-else-if="tab === 'requirements'" class="tr-list">
        <article v-for="r in requirements" :key="r.id" class="tr-card">
          <h3>{{ r.id }} &middot; {{ r.title }}</h3>
          <p>{{ r.text }}</p>
          <p class="tr-muted">Suggested techniques: {{ r.techniques.join(', ') }}</p>
          <button type="button" class="tr-btn" @click="newCase(r.id, r.techniques[0])">+ Add case for {{ r.id }}</button>
        </article>
      </section>

      <!-- Test cases -->
      <section v-else-if="tab === 'cases'">
        <div class="tr-toolbar">
          <button type="button" class="tr-btn tr-btn--primary" @click="newCase('REQ-1', 'bva')">+ Add Test Case</button>
          <button type="button" class="tr-btn" :disabled="busy || !selected.length" @click="runSelected">Run selected ({{ selected.length }})</button>
          <button type="button" class="tr-btn" :disabled="busy || !cases.length" @click="runAll">Run all</button>
          <button type="button" class="tr-btn tr-btn--danger" :disabled="busy || !selected.length" @click="removeSelected">Delete</button>
        </div>
        <form v-if="form" class="tr-form" @submit.prevent="saveCase">
          <h3>New test case</h3>
          <label>ID <input v-model="form.id" placeholder="TC-01" required></label>
          <label>Title <input v-model="form.title" placeholder="Quantity 0 is rejected"></label>
          <label>Requirement <select v-model="form.req"><option v-for="r in requirements" :key="r.id" :value="r.id">{{ r.id }} {{ r.title }}</option></select></label>
          <label>Technique <select v-model="form.technique"><option v-for="t in TECHNIQUES" :key="t.id" :value="t.id">{{ t.label }}</option></select></label>
          <label>Priority <select v-model="form.priority"><option>high</option><option>medium</option><option>low</option></select></label>
          <label class="tr-span">Input <input v-model="form.input" :placeholder="inputHint" required spellcheck="false"></label>
          <label>Expected <input v-model="form.expected" :placeholder="expectedHint" required spellcheck="false"></label>
          <div class="tr-span tr-actions">
            <button type="submit" class="tr-btn tr-btn--primary" :disabled="busy">Add Test Case</button>
            <button type="button" class="tr-btn" @click="form = null">Cancel</button>
          </div>
        </form>
        <div class="tr-tablewrap">
          <table class="tr-table">
            <thead><tr><th><input type="checkbox" :checked="selected.length === cases.length && cases.length > 0" aria-label="Select all" @change="toggleAll"></th>
              <th>ID</th><th>Title</th><th>Req</th><th>Technique</th><th>Input</th><th>Expected</th><th>Status</th><th>Actual</th></tr></thead>
            <tbody>
              <tr v-if="!cases.length"><td colspan="9" class="tr-muted">No test cases yet.</td></tr>
              <tr v-for="c in cases" :key="c.id">
                <td><input v-model="selected" type="checkbox" :value="c.id" :aria-label="'Select ' + c.id"></td>
                <td><b>{{ c.id }}</b></td><td>{{ c.title }}</td><td>{{ c.req }}</td><td>{{ c.technique }}</td>
                <td><code>{{ c.input }}</code></td><td>{{ c.expected }}</td>
                <td><span class="tr-status" :class="'is-' + c.status">{{ statusText(c.status) }}</span></td>
                <td>{{ c.actual }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Risks -->
      <section v-else-if="tab === 'risks'" class="tr-two">
        <form class="tr-form tr-form--narrow" @submit.prevent="addRisk">
          <h3>Add risk</h3>
          <label>Area <input v-model="risk.area" placeholder="checkout" required></label>
          <label>Likelihood (1-5) <input v-model.number="risk.likelihood" type="number" min="1" max="5" required></label>
          <label>Impact (1-5) <input v-model.number="risk.impact" type="number" min="1" max="5" required></label>
          <label>Note <input v-model="risk.note"></label>
          <button type="submit" class="tr-btn tr-btn--primary" :disabled="busy">Save risk</button>
        </form>
        <div class="tr-card">
          <h3>Risk matrix</h3>
          <div class="tr-heat">
            <template v-for="i in [5, 4, 3, 2, 1]" :key="'r' + i">
              <span class="tr-heat__axis">{{ i }}</span>
              <div v-for="l in [1, 2, 3, 4, 5]" :key="i + '-' + l" class="tr-heat__cell" :class="level(i * l)">
                <span v-for="r in risks.filter(x => x.impact === i && x.likelihood === l)" :key="r.area" class="tr-heat__tag">{{ r.area }}</span>
              </div>
            </template>
            <span></span><span v-for="l in [1, 2, 3, 4, 5]" :key="'x' + l" class="tr-heat__axis">{{ l }}</span>
          </div>
          <p class="tr-muted">Rows: impact &middot; columns: likelihood</p>
          <table class="tr-table"><thead><tr><th>Area</th><th>L</th><th>I</th><th>Score</th><th>Level</th><th>Note</th></tr></thead>
            <tbody><tr v-for="r in risks" :key="r.area"><td>{{ r.area }}</td><td>{{ r.likelihood }}</td><td>{{ r.impact }}</td><td>{{ r.score }}</td>
              <td><span class="tr-badge" :class="r.level === 'high' ? 'bad' : r.level === 'medium' ? 'warn' : 'ok'">{{ r.level }}</span></td><td>{{ r.note }}</td></tr></tbody></table>
        </div>
      </section>

      <!-- Exploratory sessions -->
      <section v-else class="tr-two">
        <div class="tr-card">
          <h3>{{ running ? running.id + ' - running' : 'Start a session' }}</h3>
          <form v-if="!running" class="tr-form tr-form--bare" @submit.prevent="startSession">
            <label>Charter <textarea v-model="charter" rows="3" required placeholder="Explore the cart with boundary quantities to discover validation defects"></textarea></label>
            <label>Timebox (min) <input v-model.number="timebox" type="number" min="5" max="240"></label>
            <button type="submit" class="tr-btn tr-btn--primary" :disabled="busy">Start session</button>
          </form>
          <template v-else>
            <p><b>Charter:</b> {{ running.charter }}</p>
            <form class="tr-note" @submit.prevent="addNote">
              <input v-model="note" placeholder="What you tried and what you saw" required>
              <button type="submit" class="tr-btn" :disabled="busy">Add note</button>
            </form>
            <ul class="tr-notes"><li v-for="(n, i) in running.notes" :key="i">{{ n }}</li></ul>
            <p class="tr-muted">Observations linked: {{ running.observations.length }}. Test in the QA Shop Browser while the session runs.</p>
            <button type="button" class="tr-btn tr-btn--danger" :disabled="busy" @click="exec(cli(['qa', 'explore', 'stop']), 'Session finished - report written')">Stop session</button>
          </template>
        </div>
        <div class="tr-card">
          <h3>Sessions</h3>
          <p v-if="!sessions.length" class="tr-muted">No sessions yet.</p>
          <div v-for="s in sessions" :key="s.id" class="tr-sess">
            <b>{{ s.id }}</b> <span class="tr-badge" :class="s.status === 'running' ? 'warn' : 'ok'">{{ s.status }}</span>
            <p>{{ s.charter }}</p><p class="tr-muted">{{ s.notes.length }} notes &middot; {{ s.observations.length }} observations &middot; {{ (s.bugs || []).length }} bugs</p>
          </div>
        </div>
      </section>
    </main>

    <div class="tr-flashes" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="tr-flash" :class="'tr-flash--' + f.type">
        {{ f.title }}<span v-if="f.detail"> - {{ f.detail }}</span>
        <button type="button" aria-label="Dismiss" @click="api.dismiss(f.id)">&times;</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'location', url: string): void; (e: 'refresh'): void }>();

const TABS = [
    { id: 'dashboard', label: 'Dashboard' }, { id: 'requirements', label: 'Requirements' },
    { id: 'cases', label: 'Test Cases' }, { id: 'risks', label: 'Risks' }, { id: 'sessions', label: 'Exploratory' },
] as const;
const TECHNIQUES = [
    { id: 'bva', label: 'Boundary value analysis' }, { id: 'ep', label: 'Equivalence partitioning' },
    { id: 'dt', label: 'Decision table' }, { id: 'state', label: 'State transition' }, { id: 'error-guessing', label: 'Error guessing' },
];

const tab = ref<(typeof TABS)[number]['id']>('dashboard');
const cases = computed(() => rows<any>(props.view, 'cases'));
const risks = computed(() => rows<any>(props.view, 'risks'));
const sessions = computed(() => rows<any>(props.view, 'sessions'));
const coverage = computed(() => rows<any>(props.view, 'coverage'));
const requirements = computed(() => rows<any>(props.view, 'requirements'));
const build = computed(() => String(pick(props.view, 'build', '1.0')));
const busy = computed(() => Boolean(props.busy) || props.api.busy.value);
const passed = computed(() => cases.value.filter(c => c.status === 'passed').length);
const failed = computed(() => cases.value.filter(c => c.status === 'failed').length);
const untested = computed(() => cases.value.length - passed.value - failed.value);
const running = computed(() => sessions.value.find(s => s.status === 'running') || null);
const selected = ref<string[]>([]);
const form = ref<any>(null);
const risk = reactive({ area: '', likelihood: 3, impact: 3, note: '' });
const charter = ref('');
const timebox = ref(30);
const note = ref('');
emit('location', 'https://qa-shop.testrail.io/index.php?/suites/view/1');

const inputHint = computed(() => ({ 'REQ-1': 'quantity=0', 'REQ-2': 'member=yes,total=60', 'REQ-3': 'from=fail2,event=fail' } as any)[form.value?.req] || '');
const expectedHint = computed(() => ({ 'REQ-1': 'accepted | rejected', 'REQ-2': 'free | paid', 'REQ-3': 'active | fail1 | fail2 | locked' } as any)[form.value?.req] || '');

function exec(command: string, success?: string) {
    return props.api.exec(command, success ? { success } : {});
}
function newCase(req: string, technique: string) {
    const n = cases.value.length + 1;
    form.value = { id: `TC-${String(n).padStart(2, '0')}`, title: '', req, technique: technique === 'st' ? 'state' : technique, priority: 'medium', input: '', expected: '' };
    tab.value = 'cases';
}
async function saveCase() {
    const f = form.value;
    const result = await exec(cli(['qa', 'case', 'add'], { '--id': f.id, '--req': f.req, '--technique': f.technique,
        '--input': f.input, '--expected': f.expected, '--title': f.title, '--priority': f.priority }), `Added ${f.id}`);
    if (result.ok) form.value = null;
}
async function runAll() {
    await props.api.exec(cli(['qa', 'case', 'run', '--all']), { quiet: true, success: 'Test run complete' });
}
async function runSelected() {
    await props.api.exec(cli(['qa', 'case', 'run', ...selected.value]), { quiet: true, success: 'Test run complete' });
}
async function removeSelected() {
    if (!window.confirm(`Delete ${selected.value.length} test case(s)?`)) return;
    const result = await exec(cli(['qa', 'case', 'rm', ...selected.value]), 'Deleted');
    if (result.ok) selected.value = [];
}
function toggleAll(event: Event) {
    selected.value = (event.target as HTMLInputElement).checked ? cases.value.map(c => c.id) : [];
}
async function addRisk() {
    const result = await exec(cli(['qa', 'risk', 'add'], { '--area': risk.area, '--likelihood': risk.likelihood,
        '--impact': risk.impact, '--note': risk.note }), `Risk ${risk.area} saved`);
    if (result.ok) { risk.area = ''; risk.note = ''; }
}
async function startSession() {
    const result = await exec(cli(['qa', 'explore', 'start'], { '--charter': charter.value, '--timebox': timebox.value }), 'Session started');
    if (result.ok) charter.value = '';
}
async function addNote() {
    const result = await exec(cli(['qa', 'explore', 'note', note.value]));
    if (result.ok) note.value = '';
}
function statusText(s: string) {
    return ({ passed: 'Passed', failed: 'Failed', not_run: 'Untested' } as Record<string, string>)[s] || s;
}
function level(score: number) {
    return score >= 15 ? 'is-high' : score >= 8 ? 'is-med' : 'is-low';
}
</script>

<style scoped>
.tr { --tr-blue: #0b5394; --tr-line: #dfe3e8; display: flex; flex-direction: column; height: 100%; min-height: 560px; background: #f4f6f8; color: #333;
  font: 13px/1.45 'Segoe UI', system-ui, Roboto, sans-serif; position: relative; }
.tr-head { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: #1f2d3d; color: #fff; flex-wrap: wrap; }
.tr-logo { background: #65c179; color: #0d2b14; font-weight: 800; border-radius: 4px; padding: 2px 5px; font-size: 11px; }
.tr-proj { color: #b8c4d0; }
.tr-spacer { flex: 1; }
.tr-head .tr-muted { color: #b8c4d0; }
.tr-nav { display: flex; gap: 2px; background: #fff; border-bottom: 1px solid var(--tr-line); padding: 0 10px; overflow-x: auto; }
.tr-nav button { border: 0; background: none; padding: 10px 14px; cursor: pointer; font: inherit; color: #555; border-bottom: 3px solid transparent; white-space: nowrap; }
.tr-nav .is-active { color: var(--tr-blue); border-bottom-color: var(--tr-blue); font-weight: 600; }
.tr-main { flex: 1; overflow: auto; padding: 14px; }
.tr-muted { color: #7a8691; }
.tr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.tr-wide { grid-column: 1 / -1; }
.tr-stat, .tr-card { background: #fff; border: 1px solid var(--tr-line); border-radius: 6px; padding: 12px 14px; }
.tr-stat { display: grid; } .tr-stat b { font-size: 28px; color: #1f2d3d; }
.tr-stat--ok b { color: #2e7d32; } .tr-stat--bad b { color: #c62828; }
.tr-card h3, .tr-form h3 { margin: 0 0 8px; font-size: 14px; color: #1f2d3d; }
.tr-bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: #e8ecf0; }
.tr-bar .ok { background: #43a047; } .tr-bar .bad { background: #e53935; } .tr-bar .none { background: #cfd8dc; }
.tr-cov { padding: 4px 0; border-bottom: 1px solid #f0f2f4; }
.tr-badge { display: inline-block; border-radius: 3px; padding: 0 6px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
.tr-badge.ok { background: #e8f5e9; color: #2e7d32; } .tr-badge.warn { background: #fff8e1; color: #8a6100; } .tr-badge.bad { background: #ffebee; color: #c62828; }
.tr-list { display: grid; gap: 12px; }
.tr-toolbar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.tr-btn { border: 1px solid #c5cdd5; background: #fff; border-radius: 4px; padding: 6px 12px; cursor: pointer; font: inherit; color: #333; }
.tr-btn--primary { background: var(--tr-blue); border-color: var(--tr-blue); color: #fff; }
.tr-btn--danger { color: #c62828; border-color: #e7b6b6; }
.tr-btn:disabled { opacity: .5; cursor: default; }
.tr-form { background: #fff; border: 1px solid var(--tr-line); border-radius: 6px; padding: 12px 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px; }
.tr-form--narrow { grid-template-columns: 1fr; align-content: start; }
.tr-form--bare { border: 0; padding: 0; grid-template-columns: 1fr; }
.tr-form h3, .tr-span { grid-column: 1 / -1; }
.tr-form label { display: grid; gap: 3px; font-size: 12px; color: #555; font-weight: 600; }
.tr-form input, .tr-form select, .tr-form textarea, .tr-note input { border: 1px solid #c5cdd5; border-radius: 4px; padding: 6px 8px; font: inherit; color: #333; background: #fff; font-weight: 400; }
.tr-actions { display: flex; gap: 6px; }
.tr-tablewrap { overflow-x: auto; background: #fff; border: 1px solid var(--tr-line); border-radius: 6px; }
.tr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.tr-table th { background: #f7f9fa; text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--tr-line); color: #555; }
.tr-table td { padding: 6px 8px; border-bottom: 1px solid #f0f2f4; vertical-align: top; }
.tr-status { border-radius: 3px; padding: 1px 7px; font-weight: 600; font-size: 11px; background: #eceff1; color: #546e7a; }
.tr-status.is-passed { background: #43a047; color: #fff; } .tr-status.is-failed { background: #e53935; color: #fff; }
.tr-two { display: grid; grid-template-columns: minmax(240px, 1fr) minmax(0, 2fr); gap: 12px; align-items: start; }
.tr-heat { display: grid; grid-template-columns: 20px repeat(5, 1fr); gap: 3px; max-width: 420px; }
.tr-heat__axis { text-align: center; color: #7a8691; font-size: 11px; align-self: center; }
.tr-heat__cell { min-height: 40px; border-radius: 3px; padding: 2px; display: flex; flex-wrap: wrap; gap: 2px; align-content: flex-start; }
.tr-heat__cell.is-low { background: #c8e6c9; } .tr-heat__cell.is-med { background: #ffe082; } .tr-heat__cell.is-high { background: #ef9a9a; }
.tr-heat__tag { background: rgba(255,255,255,.85); border-radius: 2px; font-size: 10px; padding: 0 3px; }
.tr-note { display: flex; gap: 6px; } .tr-note input { flex: 1; }
.tr-notes { padding-left: 18px; }
.tr-sess { border-bottom: 1px solid #f0f2f4; padding: 6px 0; } .tr-sess p { margin: 2px 0; }
.tr-flashes { position: absolute; right: 12px; bottom: 12px; display: grid; gap: 6px; max-width: 380px; z-index: 2; }
.tr-flash { background: #2e7d32; color: #fff; padding: 8px 28px 8px 10px; border-radius: 4px; position: relative; }
.tr-flash--error { background: #c62828; } .tr-flash--info { background: #1f2d3d; }
.tr-flash button { position: absolute; right: 6px; top: 4px; background: none; border: 0; color: inherit; cursor: pointer; font-size: 16px; }
@container sl-portal (max-width: 720px) { .tr-two { grid-template-columns: 1fr; } }
</style>
