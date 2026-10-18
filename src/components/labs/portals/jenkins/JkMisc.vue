<template>
  <div class="jk-misc">
    <!-- ===== Rename ===== -->
    <form v-if="r.page === 'rename'" class="jk-misc__form" @submit.prevent="rename">
      <h1 class="jk-h1">Rename {{ TYPE_LABEL[job?.type || 'pipeline'] || 'Pipeline' }} {{ r.job }}</h1>
      <div class="jk-field">
        <label class="jk-label" for="jk-rn-name">New Name</label>
        <input id="jk-rn-name" v-model="newName" class="jk-input" type="text" autocomplete="off" />
        <p v-if="renameProblem" class="jk-error">{{ renameProblem }}</p>
      </div>
      <div class="jk-bottom-bar">
        <button type="submit" class="jk-btn jk-btn--primary" :disabled="Boolean(renameProblem) || busy">Rename</button>
      </div>
    </form>

    <!-- ===== Pipeline Syntax (Snippet Generator) ===== -->
    <template v-else-if="r.page === 'syntax'">
      <h1 class="jk-h1">Pipeline Syntax</h1>
      <h2 class="jk-misc__h2">Overview</h2>
      <p>This Snippet Generator will help you learn the Pipeline Script code which can be used to define various steps. Pick a step you are interested in from the list, configure it, click <strong>Generate Pipeline Script</strong>, and you will see a Pipeline Script statement that would call the step with that configuration.</p>
      <h2 class="jk-misc__h2">Steps</h2>
      <div class="jk-field">
        <label class="jk-label" for="jk-sx-step">Sample Step</label>
        <select id="jk-sx-step" v-model="step" class="jk-select jk-misc__select">
          <option v-for="s in STEPS" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
      </div>
      <div v-for="field in current.fields" :key="field.key" class="jk-field jk-misc__arg">
        <label v-if="field.kind === 'bool'" class="jk-check"><input v-model="args[field.key]" type="checkbox" true-value="true" false-value="" /> {{ field.label }}</label>
        <template v-else>
          <label class="jk-label">{{ field.label }}</label>
          <select v-if="field.kind === 'cred'" v-model="args[field.key]" class="jk-select">
            <option value="">- none -</option>
            <option v-for="c in ctx.credentials.value" :key="c.id" :value="c.id">{{ c.id }}</option>
          </select>
          <textarea v-else-if="field.kind === 'text'" v-model="args[field.key]" class="jk-textarea jk-mono" rows="3"></textarea>
          <input v-else v-model="args[field.key]" class="jk-input" type="text" />
        </template>
      </div>
      <button type="button" class="jk-btn" @click="generated = snippet()">Generate Pipeline Script</button>
      <textarea v-if="generated" class="jk-textarea jk-mono jk-misc__out" rows="4" readonly :value="generated"></textarea>
      <h2 class="jk-misc__h2">Declarative Pipeline Linter</h2>
      <p>Validate a <code>Jenkinsfile</code> in the repository before you build it (<code>jenkins-cli declarative-linter</code>).</p>
      <form class="jk-misc__lint" @submit.prevent="lint">
        <input v-model="lintPath" class="jk-input jk-misc__lint-path" type="text" aria-label="Jenkinsfile path" />
        <button type="submit" class="jk-btn jk-btn--primary jk-misc__lint-btn" :disabled="busy">Validate</button>
      </form>
      <pre v-if="lintOut" class="jk-misc__pre" :class="lintOk ? 'is-ok' : 'is-bad'">{{ lintOut }}</pre>
      <h2 class="jk-misc__h2">Global Variables</h2>
      <p class="jk-muted">Available inside a <code>sh</code> step or <code>${...}</code>: BUILD_NUMBER, BUILD_ID, JOB_NAME, WORKSPACE, BRANCH_NAME, BUILD_URL, JENKINS_URL, GIT_COMMIT (after checkout), params.NAME.</p>
    </template>

    <!-- ===== Jenkins CLI ===== -->
    <template v-else-if="r.page === 'cli'">
      <h1 class="jk-h1">Jenkins CLI</h1>
      <p>You can access various features in Jenkins through a command-line tool. See <span class="jk-link">the documentation</span> for more details of this feature. To get started, download <span class="jk-link">jenkins-cli.jar</span>, and run it as follows:</p>
      <pre class="jk-misc__pre">java -jar jenkins-cli.jar -s {{ ctx.base.value }} -webSocket help</pre>
      <p class="jk-muted">In this lab the Jenkins CLI console beside the portal is <code>jenkins-cli</code>. Every action in this web UI runs one of these commands.</p>
      <div class="jk-table-wrap">
        <table class="jk-table">
          <thead><tr><th>Command</th><th>Description</th></tr></thead>
          <tbody><tr v-for="c in COMMANDS" :key="c[0]"><td><code>{{ c[0] }}</code></td><td>{{ c[1] }}</td></tr></tbody>
        </table>
      </div>
    </template>

    <!-- ===== About ===== -->
    <template v-else>
      <h1 class="jk-h1">About Jenkins {{ version }}</h1>
      <p>Jenkins is a community-developed open-source automation server.</p>
      <p class="jk-muted">This is a simulated controller for the Self Study labs: pipelines are really parsed and run stage by stage in a workspace that starts empty; everything else is modelled.</p>
      <h2 class="jk-misc__h2">Plugins</h2>
      <ul><li v-for="p in ctx.plugins.value" :key="p.id">{{ p.name }} {{ p.version }}</li></ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { pick } from '@/utils/portalKit';
import { useJk } from './jkContext';
import { jcli, nameProblem, TYPE_LABEL } from './jenkinsKit';

const ctx = useJk();
const r = computed(() => ctx.route.value as any);
const job = computed(() => (r.value.job ? ctx.job(r.value.job) : undefined));
const version = computed(() => String(pick(ctx.view.value, 'version', '2.440.1')));

// ---- Rename ----
const newName = ref(String(r.value.job || ''));
const busy = ref(false);
const renameProblem = computed(() => {
  if (newName.value.trim() === r.value.job) return 'The new name is the same as the current name.';
  return nameProblem(newName.value, ctx.jobs.value);
});

async function rename() {
  if (renameProblem.value) return;
  busy.value = true;
  try {
    const target = newName.value.trim();
    const result = await ctx.run(jcli(['rename-job', r.value.job, target]), { success: `Renamed to ‘${target}’` });
    if (result.ok) ctx.go({ page: 'job', job: target });
  } finally {
    busy.value = false;
  }
}

// ---- Snippet generator ----
interface Field { key: string; label: string; kind?: 'text' | 'bool' | 'cred' }
const STEPS: { id: string; label: string; fields: Field[] }[] = [
  { id: 'sh', label: 'sh: Shell Script', fields: [{ key: 'script', label: 'Shell Script', kind: 'text' }, { key: 'returnStatus', label: 'Return exit status', kind: 'bool' }] },
  { id: 'echo', label: 'echo: Print Message', fields: [{ key: 'message', label: 'Message' }] },
  { id: 'checkout', label: 'checkout: Check out from version control', fields: [] },
  { id: 'archiveArtifacts', label: 'archiveArtifacts: Archive the artifacts', fields: [{ key: 'artifacts', label: 'Files to archive' }, { key: 'allowEmptyArchive', label: 'Do not fail build if archiving returns nothing', kind: 'bool' }] },
  { id: 'junit', label: 'junit: Archive JUnit-formatted test results', fields: [{ key: 'testResults', label: 'Test report XMLs' }] },
  { id: 'stash', label: 'stash: Stash some files to be used later in the build', fields: [{ key: 'name', label: 'Name' }, { key: 'includes', label: 'Includes' }] },
  { id: 'unstash', label: 'unstash: Restore files previously stashed', fields: [{ key: 'name', label: 'Name' }] },
  { id: 'withCredentials', label: 'withCredentials: Bind credentials to variables', fields: [{ key: 'credentialsId', label: 'Credentials', kind: 'cred' }, { key: 'usernameVariable', label: 'Username Variable' }, { key: 'passwordVariable', label: 'Password Variable' }] },
  { id: 'input', label: 'input: Wait for interactive input', fields: [{ key: 'message', label: 'Message' }] },
  { id: 'timeout', label: 'timeout: Enforce time limit', fields: [{ key: 'time', label: 'Timeout' }] },
];
const step = ref('sh');
const args = reactive<Record<string, string>>({});
const generated = ref('');
const current = computed(() => STEPS.find(s => s.id === step.value) || STEPS[0]);
watch(step, () => { for (const k of Object.keys(args)) delete args[k]; generated.value = ''; });

function q(value: string) { return `'${String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`; }

function snippet(): string {
  const a = args;
  switch (step.value) {
    case 'sh': return a.returnStatus ? `sh returnStatus: true, script: ${q(a.script)}` : `sh ${q(a.script)}`;
    case 'echo': return `echo ${q(a.message)}`;
    case 'checkout': return 'checkout scm';
    case 'archiveArtifacts': return a.allowEmptyArchive ? `archiveArtifacts allowEmptyArchive: true, artifacts: ${q(a.artifacts)}` : `archiveArtifacts artifacts: ${q(a.artifacts)}`;
    case 'junit': return `junit ${q(a.testResults)}`;
    case 'stash': return a.includes ? `stash includes: ${q(a.includes)}, name: ${q(a.name)}` : `stash name: ${q(a.name)}`;
    case 'unstash': return `unstash ${q(a.name)}`;
    case 'withCredentials': return `withCredentials([usernamePassword(credentialsId: ${q(a.credentialsId)}, passwordVariable: ${q(a.passwordVariable || 'PASSWORD')}, usernameVariable: ${q(a.usernameVariable || 'USERNAME')})]) {\n    // some block\n}`;
    case 'input': return `input ${q(a.message || 'Proceed?')}`;
    case 'timeout': return `timeout(time: ${Number(a.time) || 5}, unit: 'MINUTES') {\n    // some block\n}`;
    default: return '';
  }
}

const lintPath = ref(job.value?.script_path || 'Jenkinsfile');
const lintOut = ref('');
const lintOk = ref(false);

async function lint() {
  busy.value = true;
  try {
    const result = await ctx.run(jcli(['declarative-linter', lintPath.value.trim() || 'Jenkinsfile']), { quiet: true });
    lintOk.value = result.ok;
    lintOut.value = String(result.ok ? result.output : (result.error || result.output) || '').trim();
  } finally {
    busy.value = false;
  }
}

const COMMANDS: [string, string][] = [
  ['build', 'Builds a job, and optionally waits until its completion.'],
  ['console', 'Retrieves console output of a build.'],
  ['copy-job', 'Copies a job.'],
  ['create-credential', 'Creates a credential in the system store (lab spelling).'],
  ['create-job', 'Creates a new job.'],
  ['create-node', 'Creates a new node.'],
  ['declarative-linter', 'Validate a Jenkinsfile containing a Declarative Pipeline.'],
  ['delete-builds', 'Deletes build record(s).'],
  ['delete-credentials', 'Delete credentials.'],
  ['delete-job', 'Deletes job(s).'],
  ['delete-node', 'Deletes node(s).'],
  ['disable-job', 'Disables a job.'],
  ['enable-job', 'Enables a job.'],
  ['get-job', 'Dumps the job definition.'],
  ['install-plugin', 'Installs a plugin.'],
  ['list-credentials', 'Lists the Credentials in a specific Store.'],
  ['list-jobs', 'Lists all jobs in a specific view or item group.'],
  ['list-plugins', 'Outputs a list of installed plugins.'],
  ['offline-node', 'Stop using a node for performing builds temporarily.'],
  ['online-node', 'Resume using a node for performing builds.'],
  ['replay-pipeline', 'Replay a Pipeline build with edited script.'],
  ['update-job', 'Updates the job definition.'],
  ['who-am-i', 'Reports your credential and permissions.'],
];
</script>

<style scoped>
.jk-misc { max-width: 1024px; }
.jk-misc__form { max-width: 640px; }
.jk-misc__h2 { font-size: 17.6px; font-weight: 650; margin: 20.8px 0 8px; }
.jk-misc__select { max-width: 512px; }
.jk-misc__arg { max-width: 640px; }
.jk-misc__out { margin-top: 12.8px; max-width: 832px; }
.jk-misc__lint { display: flex; gap: 8px; max-width: 544px; }
.jk-misc__pre.is-ok { color: var(--jk-green); }
.jk-misc__pre.is-bad { color: var(--jk-red); }
.jk-misc__pre { padding: 12.8px 16px; background: var(--jk-table-bg); border-radius: 9.6px; font-family: var(--jk-mono); font-size: 13px; overflow-x: auto; }
</style>
