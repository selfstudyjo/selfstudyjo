<template>
  <div class="pw" dir="ltr">
    <header class="pw-head">
      <span class="pw-logo" aria-hidden="true">&#127917;</span><strong>Playwright Test</strong>
      <span class="pw-muted">UI mode &middot; QA Shop build {{ build }}</span>
      <div class="pw-spacer"></div>
      <label class="pw-dev">Project
        <select v-model="device">
          <option v-for="d in devices" :key="d.name" :value="d.name">{{ d.name }}</option>
        </select>
      </label>
      <button type="button" class="pw-btn pw-btn--go" :disabled="busy || !files.length" @click="runPytest([])">&#9654; Run all</button>
    </header>

    <div class="pw-body">
      <aside class="pw-tree">
        <input v-model="filter" class="pw-filter" placeholder="Filter (e.g. login)" spellcheck="false" aria-label="Filter tests">
        <p v-if="!files.length" class="pw-muted pw-pad">No test files yet. Create <code>tests/test_*.py</code> in Files, or record one in the QA Shop Browser.</p>
        <div v-for="f in shownFiles" :key="f.path" class="pw-file">
          <div class="pw-file__row">
            <span class="pw-status" :class="'is-' + fileStatus(f)"></span>
            <span class="pw-file__name" :title="f.path">{{ f.path }}</span>
            <button type="button" class="pw-mini" title="Run file" :disabled="busy" @click="runPytest([f.path])">&#9654;</button>
          </div>
          <div v-for="t in f.tests.filter(matchName)" :key="t" class="pw-test" :class="{ 'is-sel': selected === f.path + '::' + t }"
               @click="selected = f.path + '::' + t">
            <span class="pw-status" :class="'is-' + testStatus(f.path, t)"></span>
            <span class="pw-test__name">{{ t }}</span>
            <button type="button" class="pw-mini" title="Run test" :disabled="busy" @click.stop="runPytest([f.path + '::' + t])">&#9654;</button>
          </div>
        </div>
        <div class="pw-matrix">
          <h4>Device matrix</h4>
          <label v-for="d in devices" :key="d.name" class="pw-chk"><input v-model="matrix" type="checkbox" :value="d.name"> {{ d.name }}</label>
          <button type="button" class="pw-btn" :disabled="busy || matrix.length < 2 || !files.length" @click="runMatrix">Run on {{ matrix.length }} devices</button>
        </div>
      </aside>

      <main class="pw-main">
        <div class="pw-tabs">
          <button type="button" :class="{ 'is-active': tab === 'results' }" @click="tab = 'results'">Results</button>
          <button type="button" :class="{ 'is-active': tab === 'runs' }" @click="tab = 'runs'">Runs ({{ runs.length }})</button>
          <button type="button" :class="{ 'is-active': tab === 'matrix' }" @click="tab = 'matrix'">Matrix ({{ matrices.length }})</button>
        </div>

        <section v-if="tab === 'results'" class="pw-pane">
          <p v-if="!run" class="pw-muted">Run a test to see its result here.</p>
          <template v-else>
            <div class="pw-summary">
              <span class="pw-pill is-passed">{{ run.passed || 0 }} passed</span>
              <span class="pw-pill is-failed">{{ (run.failed || 0) + (run.errors || 0) }} failed</span>
              <span v-if="run.skipped" class="pw-pill">{{ run.skipped }} skipped</span>
              <span v-if="run.xfailed" class="pw-pill">{{ run.xfailed }} xfailed</span>
              <span class="pw-muted">{{ run.id }} &middot; {{ run.tool }} {{ run.target }} &middot; {{ run.device || '' }} &middot; build {{ run.build }}</span>
            </div>
            <div v-for="t in run.tests || []" :key="t.nodeid" class="pw-case" :class="'is-' + t.status">
              <div class="pw-case__head"><span class="pw-status" :class="'is-' + t.status"></span><b>{{ t.nodeid }}</b><span class="pw-muted">{{ t.status }}</span></div>
              <pre v-if="t.message && t.status !== 'passed'" class="pw-err">{{ t.message }}</pre>
            </div>
            <p v-if="run.junit" class="pw-muted">JUnit report: {{ run.junit }}</p>
          </template>
        </section>

        <section v-else-if="tab === 'runs'" class="pw-pane">
          <table class="pw-table">
            <thead><tr><th>Run</th><th>Tool</th><th>Target</th><th>Device</th><th>Build</th><th>Result</th></tr></thead>
            <tbody>
              <tr v-for="r in runs" :key="r.id" :class="{ 'is-sel': run && r.id === run.id }" @click="pinned = r.id; tab = 'results'">
                <td>{{ r.id }}</td><td>{{ r.tool }}</td><td>{{ r.target }}</td><td>{{ r.device || '-' }}</td><td>{{ r.build }}</td>
                <td><span class="pw-pill" :class="'is-' + (r.status === 'passed' ? 'passed' : 'failed')">{{ r.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-else class="pw-pane">
          <p v-if="!matrices.length" class="pw-muted">Pick two or more devices and run the matrix.</p>
          <div v-for="m in matrices" :key="m.id" class="pw-mx">
            <b>{{ m.id }}</b> <span class="pw-muted">{{ m.target || 'tests' }} &middot; build {{ m.build }}</span>
            <div class="pw-mx__grid">
              <div v-for="d in m.devices" :key="d.device" class="pw-mx__cell" :class="'is-' + d.status">
                {{ d.device }}<small>{{ d.width }}px &middot; {{ d.passed }}/{{ d.passed + d.failed }}</small>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>

    <div class="pw-flashes" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="pw-flash" :class="'pw-flash--' + f.type">
        {{ f.title }}<span v-if="f.detail"> - {{ f.detail }}</span>
        <button type="button" aria-label="Dismiss" @click="api.dismiss(f.id)">&times;</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import type { PortalApi } from '../usePortal';
import { devicesOf } from './qaKit';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'location', url: string): void; (e: 'refresh'): void }>();

const files = computed(() => rows<{ path: string; tests: string[] }>(props.view, 'files.tests'));
const runs = computed(() => rows<any>(props.view, 'runs'));
const matrices = computed(() => rows<any>(props.view, 'matrices'));
const devices = computed(() => devicesOf(props.view));
const build = computed(() => String(pick(props.view, 'build', '1.0')));
const busy = computed(() => Boolean(props.busy) || props.api.busy.value);
const device = ref('Desktop Chrome');
const filter = ref('');
const selected = ref('');
const tab = ref<'results' | 'runs' | 'matrix'>('results');
const pinned = ref('');
const matrix = ref<string[]>(['Desktop Chrome', 'iPhone SE']);
const pytestRuns = computed(() => runs.value.filter(r => r.tool === 'pytest'));
const run = computed(() => runs.value.find(r => r.id === pinned.value) || runs.value[0] || null);
emit('location', 'http://localhost:9323/#?testId=');

function matchName(name: string) {
    return !filter.value || name.toLowerCase().includes(filter.value.toLowerCase());
}
const shownFiles = computed(() => files.value.filter(f => !filter.value
    || f.path.toLowerCase().includes(filter.value.toLowerCase()) || f.tests.some(matchName)));

function lastStatus(nodeStart: string) {
    for (const r of pytestRuns.value) {
        const hit = (r.tests || []).filter((t: any) => t.nodeid === nodeStart || t.nodeid.startsWith(nodeStart + '['));
        if (hit.length) return hit.some((t: any) => t.status === 'failed' || t.status === 'error') ? 'failed' : 'passed';
    }
    return 'none';
}
function testStatus(path: string, name: string) {
    return lastStatus(`${path}::${name}`);
}
function fileStatus(f: { path: string; tests: string[] }) {
    const states = f.tests.map(t => testStatus(f.path, t));
    if (states.includes('failed')) return 'failed';
    if (states.length && states.every(s => s === 'passed')) return 'passed';
    return 'none';
}
async function runPytest(targets: string[]) {
    pinned.value = '';
    tab.value = 'results';
    await props.api.exec(cli(['pytest', ...targets], { '--device': device.value === 'Desktop Chrome' ? '' : device.value }),
                         { quiet: true });
}
async function runMatrix() {
    pinned.value = '';
    tab.value = 'matrix';
    await props.api.exec(cli(['qa', 'matrix', 'run', 'tests'], { '--devices': matrix.value.join(',') }), { quiet: true });
}
</script>

<style scoped>
.pw { display: flex; flex-direction: column; height: 100%; min-height: 560px; background: #1e1e1e; color: #ccc;
  font: 13px/1.45 system-ui, 'Segoe UI', Roboto, sans-serif; position: relative; }
.pw-head { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #252526; border-bottom: 1px solid #333; flex-wrap: wrap; }
.pw-head strong { color: #fff; }
.pw-spacer { flex: 1; }
.pw-muted { color: #8b8b8b; }
.pw-pad { padding: 8px; }
.pw-dev select { margin-left: 6px; background: #3c3c3c; color: #ddd; border: 1px solid #555; border-radius: 3px; padding: 3px 6px; font: inherit; }
.pw-btn { background: #3c3c3c; color: #ddd; border: 1px solid #555; border-radius: 3px; padding: 5px 12px; cursor: pointer; font: inherit; }
.pw-btn--go { background: #2ea043; border-color: #2ea043; color: #fff; }
.pw-btn:disabled { opacity: .45; cursor: default; }
.pw-body { flex: 1; display: grid; grid-template-columns: minmax(230px, 32%) minmax(0, 1fr); min-height: 0; }
.pw-tree { border-right: 1px solid #333; overflow: auto; background: #252526; }
.pw-filter { width: calc(100% - 16px); margin: 8px; box-sizing: border-box; background: #3c3c3c; border: 1px solid #555; color: #ddd; border-radius: 3px; padding: 5px 8px; font: inherit; }
.pw-file__row, .pw-test { display: flex; align-items: center; gap: 6px; padding: 3px 8px; }
.pw-file__row { font-weight: 600; color: #e0e0e0; }
.pw-file__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pw-test { padding-left: 24px; cursor: pointer; }
.pw-test:hover, .pw-test.is-sel { background: #37373d; }
.pw-test__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
.pw-mini { background: none; border: 0; color: #89d185; cursor: pointer; font-size: 11px; padding: 2px 4px; }
.pw-mini:disabled { opacity: .4; }
.pw-status { width: 10px; height: 10px; border-radius: 50%; background: #555; flex: none; }
.pw-status.is-passed { background: #2ea043; } .pw-status.is-failed, .pw-status.is-error { background: #f85149; }
.pw-status.is-skipped, .pw-status.is-xfailed { background: #d29922; }
.pw-matrix { border-top: 1px solid #333; padding: 8px; display: grid; gap: 3px; }
.pw-matrix h4 { margin: 0 0 4px; color: #e0e0e0; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
.pw-chk { display: flex; gap: 6px; align-items: center; }
.pw-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.pw-tabs { display: flex; background: #252526; border-bottom: 1px solid #333; }
.pw-tabs button { background: none; border: 0; color: #8b8b8b; padding: 7px 14px; cursor: pointer; font: inherit; border-bottom: 2px solid transparent; }
.pw-tabs .is-active { color: #fff; border-bottom-color: #2ea043; }
.pw-pane { overflow: auto; padding: 10px 12px; flex: 1; }
.pw-summary { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.pw-pill { border-radius: 10px; padding: 1px 9px; background: #3c3c3c; font-size: 12px; }
.pw-pill.is-passed { background: #1f4d2b; color: #89d185; } .pw-pill.is-failed { background: #5a1d1d; color: #f85149; }
.pw-case { border: 1px solid #333; border-radius: 4px; margin-bottom: 6px; padding: 6px 8px; }
.pw-case__head { display: flex; gap: 8px; align-items: center; }
.pw-case__head b { flex: 1; font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #e0e0e0; font-weight: 500; }
.pw-err { margin: 6px 0 0; background: #2d1414; color: #ffa198; padding: 8px; border-radius: 3px; white-space: pre-wrap; font-size: 12px; }
.pw-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.pw-table th, .pw-table td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #333; }
.pw-table tbody tr { cursor: pointer; } .pw-table tbody tr:hover, .pw-table .is-sel { background: #37373d; }
.pw-mx { margin-bottom: 12px; }
.pw-mx__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; margin-top: 6px; }
.pw-mx__cell { border-radius: 4px; padding: 8px; background: #1f4d2b; color: #c8f3c8; display: grid; }
.pw-mx__cell.is-failed { background: #5a1d1d; color: #ffd1cc; }
.pw-mx__cell small { opacity: .8; }
.pw-flashes { position: absolute; right: 12px; bottom: 12px; display: grid; gap: 6px; max-width: 380px; z-index: 2; }
.pw-flash { background: #333; color: #fff; padding: 8px 28px 8px 10px; border-radius: 4px; position: relative; }
.pw-flash--error { background: #8c1d18; }
.pw-flash button { position: absolute; right: 6px; top: 4px; background: none; border: 0; color: inherit; cursor: pointer; font-size: 16px; }
@container sl-portal (max-width: 720px) { .pw-body { grid-template-columns: 1fr; } .pw-tree { border-right: 0; max-height: 280px; } }
</style>
