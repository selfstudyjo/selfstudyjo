<template>
  <div v-if="job && build" class="jk-build">
    <!-- ===== Status ===== -->
    <template v-if="tab === 'status'">
      <div class="jk-app-bar">
        <h1 class="jk-h1"><JkStatus :ball="ballOf(build.result)" :size="28" />#{{ build.number }} ({{ shortDate(build.at, true) }})</h1>
        <div class="jk-build__times">
          <div>Started {{ since(build.at, ctx.now.value) }} ago</div>
          <div>Took {{ duration(build.duration) }}</div>
          <button type="button" class="jk-btn jk-build__keep" disabled title="Not modelled in this lab">Keep this build forever</button>
        </div>
      </div>
      <ul class="jk-build__facts">
        <li><JkIcon name="user" /><span>{{ causeText }}</span></li>
        <li v-if="job.type !== 'freestyle' && job.from_scm"><JkIcon name="branch" /><span>Pipeline script from SCM: <code>{{ job.script_path }}</code></span></li>
        <li><JkIcon name="info" /><span>Result: <strong :class="'jk-build__result is-' + ballOf(build.result)">{{ build.result }}</strong></span></li>
        <li v-if="build.tests && build.tests.total">
          <JkIcon name="chart" />
          <span>Test Result ({{ build.tests.failed ? `${build.tests.failed} failure${build.tests.failed === 1 ? '' : 's'}` : 'no failures' }}) — {{ build.tests.total }} tests<template v-if="build.tests.skipped">, {{ build.tests.skipped }} skipped</template></span>
        </li>
      </ul>
      <template v-if="build.artifacts.length">
        <h2 class="jk-h2">Build Artifacts</h2>
        <ul class="jk-build__artifacts">
          <li v-for="path in build.artifacts" :key="path"><JkIcon name="artifact" /><code>{{ path }}</code></li>
        </ul>
      </template>
      <template v-if="build.stages.length">
        <h2 class="jk-h2">Stages</h2>
        <JkPipelineGraph :stages="build.stages" @select="ctx.go({ page: 'build', job: job.name, build: build.number, tab: 'overview' })" />
      </template>
    </template>

    <!-- ===== Console Output ===== -->
    <template v-else-if="tab === 'console'">
      <div class="jk-app-bar">
        <h1 class="jk-h1"><JkIcon name="terminal" class="jk-build__h1-icon" />Console Output</h1>
        <div class="jk-build__console-actions">
          <button type="button" class="jk-btn" :disabled="!log" @click="download"><JkIcon name="download" />Download</button>
          <button type="button" class="jk-btn" :disabled="!log" @click="copy"><JkIcon name="copy" />Copy</button>
          <button type="button" class="jk-btn" @click="plain = !plain">{{ plain ? 'View formatted' : 'View as plain text' }}</button>
        </div>
      </div>
      <div v-if="consoleError" class="jk-alert jk-alert--danger">{{ consoleError }}</div>
      <div v-else-if="log === null" class="jk-muted">Loading…</div>
      <pre v-else class="jk-console" :class="{ 'is-plain': plain }"><span v-for="(line, index) in lines" :key="index" class="jk-console__line" :class="lineClass(line)">{{ line + '\n' }}</span></pre>
    </template>

    <!-- ===== Parameters ===== -->
    <template v-else-if="tab === 'params'">
      <h1 class="jk-h1"><JkIcon name="list" class="jk-build__h1-icon" />Parameters</h1>
      <div v-for="(value, key) in build.params" :key="key" class="jk-field jk-build__param">
        <label class="jk-label">{{ key }}</label>
        <input class="jk-input" type="text" :value="String(value)" readonly />
      </div>
    </template>

    <!-- ===== Replay ===== -->
    <template v-else-if="tab === 'replay'">
      <h1 class="jk-h1"><JkIcon name="replay" class="jk-build__h1-icon" />Replay #{{ build.number }}</h1>
      <p class="jk-muted">Allows you to replay a Pipeline build with a modified script. It saves nothing in the job or the repository.</p>
      <div v-if="replayError" class="jk-alert jk-alert--danger">{{ replayError }}</div>
      <div v-else-if="script === null" class="jk-muted">Loading…</div>
      <form v-else @submit.prevent="replay">
        <label class="jk-label">Main Script</label>
        <JkCodeEditor v-model="script" label="Main Script" />
        <div class="jk-bottom-bar">
          <button type="submit" class="jk-btn jk-btn--primary" :disabled="running">Run</button>
        </div>
      </form>
    </template>

    <!-- ===== Pipeline Steps ===== -->
    <template v-else-if="tab === 'steps'">
      <h1 class="jk-h1"><JkIcon name="list" class="jk-build__h1-icon" />Pipeline Steps</h1>
      <div class="jk-table-wrap">
        <table class="jk-table">
          <thead><tr><th>Step</th><th>Arguments</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in stepRows" :key="index">
              <td :style="{ paddingLeft: 0.8 + row.depth * 1.4 + 'rem' }">{{ row.step }}</td>
              <td>{{ row.args }}</td>
              <td><span class="jk-build__step-status" :class="'is-' + ballOf(row.status === 'NOT_EXECUTED' ? '' : row.status)">
                <JkStatus :ball="row.status === 'NOT_EXECUTED' ? 'nobuilt' : ballOf(row.status)" :size="16" />{{ resultLabel(row.status) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ===== Pipeline Overview ===== -->
    <template v-else-if="tab === 'overview'">
      <h1 class="jk-h1"><JkIcon name="overview" class="jk-build__h1-icon" />Pipeline Overview</h1>
      <div v-if="!build.stages.length" class="jk-empty">No stages ran in this build.</div>
      <template v-else>
        <JkPipelineGraph :stages="build.stages" :selected="selected" @select="selected = $event" />
        <div v-if="current" class="jk-card jk-build__stage">
          <h2 class="jk-build__stage-title"><JkStatus :ball="current.status === 'NOT_EXECUTED' ? 'nobuilt' : ballOf(current.status)" :size="20" />{{ current.name }}</h2>
          <p>{{ resultLabel(current.status) }}<template v-if="current.ms"> · {{ stageTime(current.ms) }}</template> · {{ current.steps }} step{{ current.steps === 1 ? '' : 's' }}</p>
          <p v-if="current.note" class="jk-muted">{{ current.note }}</p>
          <button type="button" class="jk-link" @click="ctx.go({ page: 'build', job: job.name, build: build.number, tab: 'console' })">View the console output</button>
        </div>
      </template>
    </template>
  </div>
  <div v-else class="jk-empty">Build #{{ r.build }} does not exist (it may have been deleted).</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import JkIcon from './JkIcon.vue';
import JkStatus from './JkStatus.vue';
import JkCodeEditor from './JkCodeEditor.vue';
import JkPipelineGraph from './JkPipelineGraph.vue';
import { useJk } from './jkContext';
import { ballOf, duration, jcli, resultLabel, shortDate, since, stageTime, type JobConfig } from './jenkinsKit';

const ctx = useJk();
const r = computed(() => ctx.route.value as any);
const tab = computed(() => r.value.tab || 'status');
const job = computed(() => ctx.job(r.value.job));
const build = computed(() => job.value?.builds.find(b => b.number === Number(r.value.build)));

const causeText = computed(() => {
  const cause = String(build.value?.cause || '');
  if (/^started by /i.test(cause)) return cause.charAt(0).toUpperCase() + cause.slice(1);
  if (/^Replayed/.test(cause)) return cause;
  return `Started by ${cause}`;
});

// ---- Console ----
const log = ref<string | null>(null);
const consoleError = ref('');
const plain = ref(false);
const lines = computed(() => String(log.value || '').split('\n'));

function lineClass(line: string): string {
  if (line.startsWith('[Pipeline]')) return 'is-pipeline';
  if (line.startsWith('+ ')) return 'is-cmd';
  if (/^(ERROR|java\.|org\.codehaus|WorkflowScript)/.test(line)) return 'is-error';
  if (/^Finished: (FAILURE)/.test(line)) return 'is-error';
  if (/^(WARN|WARNING)/.test(line) || /^Finished: UNSTABLE/.test(line)) return 'is-warn';
  if (/^Finished: SUCCESS/.test(line)) return 'is-ok';
  return '';
}

async function loadConsole() {
  // `jenkins-cli console JOB N` - the lab's "read an old build back" tasks
  // look for exactly this command.
  const result = await ctx.run(jcli(['console', r.value.job, String(r.value.build)]), { quiet: true });
  if (!result.ok) consoleError.value = String(result.error || result.output || 'The log could not be read.');
  else log.value = String(result.output || '');
}

function download() {
  const blob = new Blob([log.value || ''], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${r.value.job}-${r.value.build}-consoleText.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copy() {
  try {
    await navigator.clipboard.writeText(log.value || '');
    ctx.notify('info', 'Copied');
  } catch { /* clipboard refused */ }
}

// ---- Replay ----
const script = ref<string | null>(null);
const replayError = ref('');
const running = ref(false);

async function loadScript() {
  const result = await ctx.run(jcli(['get-job', r.value.job]), { quiet: true, unlogged: true, direct: true });
  const data = result.data as JobConfig | undefined;
  if (!result.ok || !data) {
    replayError.value = String(result.error || 'The job could not be read.');
    return;
  }
  script.value = data.from_scm ? String(data.scm_text ?? '') : String(data.script || '');
}

async function replay() {
  if (script.value === null) return;
  running.value = true;
  try {
    const result = await ctx.run(jcli(['replay-pipeline', r.value.job], { '-n': String(r.value.build), '--script-text': script.value }),
                                 { success: 'Build scheduled' });
    if (result.ok) ctx.go({ page: 'job', job: r.value.job });
  } finally {
    running.value = false;
  }
}

// ---- Steps / overview ----
const selected = ref('');
const current = computed(() => {
  const stages = build.value?.stages || [];
  return stages.find(s => s.name === selected.value) || stages.find(s => s.status === 'FAILURE') || stages[0];
});

const stepRows = computed(() => {
  const out: { step: string; args: string; status: string; depth: number }[] = [];
  const b = build.value;
  if (!b) return out;
  out.push({ step: 'Start of Pipeline', args: '', status: b.result, depth: 0 });
  for (const stage of b.stages) {
    out.push({ step: 'Stage : Start', args: stage.name, status: stage.status, depth: 1 });
    if (stage.status !== 'NOT_EXECUTED') {
      out.push({ step: `Stage : Body : Start (${stage.steps} step${stage.steps === 1 ? '' : 's'})`, args: '', status: stage.status, depth: 2 });
    } else {
      out.push({ step: 'Stage skipped', args: stage.note, status: stage.status, depth: 2 });
    }
  }
  out.push({ step: 'End of Pipeline', args: '', status: b.result, depth: 0 });
  return out;
});

onMounted(() => {
  if (!build.value) return;
  if (tab.value === 'console') void loadConsole();
  if (tab.value === 'replay') void loadScript();
});
</script>

<style scoped>
.jk-build { max-width: 80rem; }
.jk-build__h1-icon { width: 1.6rem; height: 1.6rem; }
.jk-build__times { text-align: right; color: var(--jk-secondary); font-size: 0.8125rem; line-height: 1.5; }
.jk-build__keep { margin-top: 0.4rem; }
.jk-build__facts { list-style: none; padding: 0; margin: 0 0 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.jk-build__facts li { display: flex; align-items: center; gap: 0.75rem; }
.jk-build__facts .jk-icon { width: 1.5rem; height: 1.5rem; color: var(--jk-secondary); }
.jk-build__result.is-blue { color: var(--jk-green); }
.jk-build__result.is-red { color: var(--jk-red); }
.jk-build__result.is-yellow { color: var(--jk-orange); }
.jk-build__artifacts { list-style: none; padding: 0; margin: 0; }
.jk-build__artifacts li { display: flex; align-items: center; gap: 0.5rem; padding: 0.15rem 0; }
.jk-build__artifacts .jk-icon { width: 1rem; height: 1rem; color: var(--jk-secondary); }
.jk-build__console-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.jk-console {
  margin: 0; padding: 1rem 1.1rem; background: #fff; border: 1px solid var(--jk-border); border-radius: 0.6rem;
  font-family: var(--jk-mono); font-size: 0.8125rem; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
  color: var(--jk-text); max-width: 100%; overflow-x: auto;
}
.jk-console__line.is-pipeline { color: #9a99a0; }
.jk-console__line.is-cmd { color: #2f3138; font-weight: 600; }
.jk-console__line.is-error { color: var(--jk-red); }
.jk-console__line.is-warn { color: #b45309; }
.jk-console__line.is-ok { color: var(--jk-green); font-weight: 600; }
.jk-console.is-plain .jk-console__line { color: var(--jk-text); font-weight: 400; }
.jk-build__param { max-width: 32rem; }
.jk-build__step-status { display: inline-flex; align-items: center; gap: 0.4rem; }
.jk-build__stage { margin-top: 1rem; max-width: 40rem; }
.jk-build__stage-title { display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.3rem; font-size: 1.05rem; }
.jk-build__stage p { margin: 0.15rem 0; }
</style>
