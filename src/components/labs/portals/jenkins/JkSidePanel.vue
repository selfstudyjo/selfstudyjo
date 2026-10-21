<template>
  <div class="jk-sp">
    <ul class="jk-tasks">
      <li v-for="task in tasks" :key="task.label">
        <button type="button" class="jk-task" :class="{ 'is-active': task.active, 'is-danger': task.danger }"
                :disabled="task.disabled" @click="task.run()">
          <JkIcon :name="task.icon" class="jk-task__icon" />
          <span>{{ task.label }}</span>
        </button>
      </li>
    </ul>

    <!-- Build History widget, on a job -->
    <section v-if="job && job.type !== 'folder'" class="jk-pane">
      <header class="jk-pane__head">
        <span>Build History</span>
        <button type="button" class="jk-link jk-pane__trend" @click="ctx.go({ page: 'history' })">trend</button>
      </header>
      <div class="jk-pane__filter">
        <JkIcon name="search" class="jk-pane__filter-icon" />
        <input v-model="filter" class="jk-pane__filter-input" type="search" placeholder="Filter builds..." aria-label="Filter builds" />
      </div>
      <ul v-if="history.length" class="jk-bh">
        <li v-for="build in history" :key="build.number" class="jk-bh__row"
            :class="{ 'is-current': currentBuild === build.number }">
          <JkStatus :ball="ballOf(build.result)" :size="16" />
          <button type="button" class="jk-link jk-bh__num" @click="ctx.go({ page: 'build', job: job.name, build: build.number })">#{{ build.number }}</button>
          <span class="jk-bh__date">{{ shortDate(build.at) }}</span>
        </li>
      </ul>
      <p v-else class="jk-pane__empty">{{ filter ? 'No builds match.' : 'No builds' }}</p>
      <footer v-if="job.builds.length" class="jk-pane__foot">
        <span class="jk-link">Atom feed for all</span>
        <span class="jk-link">Atom feed for failures</span>
      </footer>
    </section>

    <!-- Build Queue + Executors, everywhere else -->
    <template v-if="!job">
      <section class="jk-pane">
        <button type="button" class="jk-pane__head jk-pane__toggle" :aria-expanded="queueOpen" @click="queueOpen = !queueOpen">
          <span>Build Queue</span>
          <JkIcon :name="queueOpen ? 'chevron-down' : 'chevron'" class="jk-pane__chev" />
        </button>
        <p v-if="queueOpen" class="jk-pane__empty">No builds in the queue.</p>
      </section>
      <section class="jk-pane">
        <button type="button" class="jk-pane__head jk-pane__toggle" :aria-expanded="execOpen" @click="execOpen = !execOpen">
          <span>Build Executor Status</span>
          <span class="jk-pane__count">{{ idle }}/{{ total }}</span>
          <JkIcon :name="execOpen ? 'chevron-down' : 'chevron'" class="jk-pane__chev" />
        </button>
        <div v-if="execOpen" class="jk-exec">
          <div v-for="node in ctx.nodes.value" :key="node.name" class="jk-exec__node">
            <button type="button" class="jk-link jk-exec__name" @click="ctx.go({ page: 'node', node: node.name })">
              {{ node.name === 'built-in' ? 'Built-In Node' : node.name }}
            </button>
            <span v-if="!node.online" class="jk-exec__off">(offline)</span>
            <ol v-if="node.online" class="jk-exec__list">
              <li v-for="n in node.executors" :key="n"><span class="jk-exec__n">{{ n }}</span>Idle</li>
            </ol>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import JkIcon from './JkIcon.vue';
import JkStatus from './JkStatus.vue';
import { useJk } from './jkContext';
import { deleteLabel, hasParameters, useActions } from './jkActions';
import { ballOf, shortDate } from './jenkinsKit';

const ctx = useJk();
const actions = useActions(ctx);
const filter = ref('');
const queueOpen = ref(true);
const execOpen = ref(true);

const r = computed(() => ctx.route.value as any);
const job = computed(() => (r.value.job ? ctx.job(r.value.job) : undefined));
const currentBuild = computed(() => (r.value.page === 'build' ? Number(r.value.build) : 0));

const history = computed(() => {
  if (!job.value) return [];
  const needle = filter.value.trim().toLowerCase().replace(/^#/, '');
  return job.value.builds.filter(build => !needle || String(build.number).includes(needle)
    || String(build.result).toLowerCase().includes(needle)).slice(0, 25);
});

const total = computed(() => ctx.nodes.value.filter(n => n.online).reduce((sum, n) => sum + (n.executors || 0), 0));
const idle = computed(() => total.value);

interface Task { label: string; icon: string; run: () => void; active?: boolean; danger?: boolean; disabled?: boolean }

const tasks = computed<Task[]>(() => {
  const page = r.value.page;
  const go = ctx.go;
  if (job.value && page === 'build') {
    const name = job.value.name;
    const number = Number(r.value.build);
    const build = job.value.builds.find(b => b.number === number);
    const tab = r.value.tab || 'status';
    const pipeline = job.value.type !== 'freestyle';
    const numbers = job.value.builds.map(b => b.number);
    const prev = numbers.filter(n => n < number).sort((a, b) => b - a)[0];
    const next = numbers.filter(n => n > number).sort((a, b) => a - b)[0];
    const list: Task[] = [
      { label: 'Status', icon: 'status', active: tab === 'status', run: () => go({ page: 'build', job: name, build: number }) },
      { label: 'Changes', icon: 'changes', run: () => go({ page: 'changes', job: name }) },
      { label: 'Console Output', icon: 'terminal', active: tab === 'console', run: () => go({ page: 'build', job: name, build: number, tab: 'console' }) },
      { label: `Delete build ‘#${number}’`, icon: 'trash', danger: true, run: () => { void actions.deleteBuild(name, number); } },
    ];
    if (build && Object.keys(build.params || {}).length) {
      list.push({ label: 'Parameters', icon: 'list', active: tab === 'params', run: () => go({ page: 'build', job: name, build: number, tab: 'params' }) });
    }
    if (pipeline) {
      list.push(
        { label: 'Pipeline Overview', icon: 'overview', active: tab === 'overview', run: () => go({ page: 'build', job: name, build: number, tab: 'overview' }) },
        { label: 'Replay', icon: 'replay', active: tab === 'replay', run: () => go({ page: 'build', job: name, build: number, tab: 'replay' }) },
        { label: 'Pipeline Steps', icon: 'list', active: tab === 'steps', run: () => go({ page: 'build', job: name, build: number, tab: 'steps' }) },
      );
    }
    if (prev) list.push({ label: 'Previous Build', icon: 'chevron', run: () => go({ page: 'build', job: name, build: prev }) });
    if (next) list.push({ label: 'Next Build', icon: 'chevron', run: () => go({ page: 'build', job: name, build: next }) });
    return list;
  }
  if (job.value) {
    const name = job.value.name;
    const folder = job.value.type === 'folder';
    const pipeline = job.value.type === 'pipeline' || job.value.type === 'multibranch';
    const list: Task[] = [
      { label: 'Status', icon: 'status', active: page === 'job', run: () => go({ page: 'job', job: name }) },
    ];
    if (!folder) {
      list.push({ label: 'Changes', icon: 'changes', active: page === 'changes', run: () => go({ page: 'changes', job: name }) });
      list.push({ label: 'Workspace', icon: 'folder', active: page === 'workspace', run: () => go({ page: 'workspace', job: name }) });
      list.push(hasParameters(job.value)
        ? { label: 'Build with Parameters', icon: 'clock-play', active: page === 'buildParams', disabled: job.value.disabled, run: () => go({ page: 'buildParams', job: name }) }
        : { label: job.value.type === 'multibranch' ? 'Scan Multibranch Pipeline Now' : 'Build Now', icon: 'clock-play', disabled: job.value.disabled, run: () => { void actions.buildNow(name); } });
    }
    list.push({ label: 'Configure', icon: 'gear', active: page === 'configure', run: () => go({ page: 'configure', job: name }) });
    list.push({ label: deleteLabel(job.value), icon: 'trash', danger: true, run: () => { void actions.deleteJob(name); } });
    if (pipeline) list.push({ label: 'Full Stage View', icon: 'stages', active: page === 'stageView', run: () => go({ page: 'stageView', job: name }) });
    list.push({ label: 'Rename', icon: 'pencil', active: page === 'rename', run: () => go({ page: 'rename', job: name }) });
    if (pipeline) list.push({ label: 'Pipeline Syntax', icon: 'help', active: page === 'syntax', run: () => go({ page: 'syntax', job: name }) });
    return list;
  }
  const view = page === 'dashboard' && r.value.view ? String(r.value.view) : '';
  const global: Task[] = [
    { label: 'New Item', icon: 'plus', active: page === 'newItem', run: () => go({ page: 'newItem' }) },
    { label: 'Build History', icon: 'history', active: page === 'history', run: () => go({ page: 'history' }) },
    { label: 'Manage Jenkins', icon: 'gear', active: ['manage', 'plugins', 'nodes', 'node', 'nodeNew', 'credentials', 'credentialNew', 'credential', 'cli', 'about', 'system'].includes(page), run: () => go({ page: 'manage' }) },
    { label: 'My Views', icon: 'views', active: page === 'dashboard' && !view, run: () => go({ page: 'dashboard' }) },
    { label: 'New View', icon: 'plus', active: page === 'newView', run: () => go({ page: 'newView' }) },
  ];
  if (view) {
    global.push(
      { label: 'Edit View', icon: 'gear', run: () => go({ page: 'editView', view }) },
      { label: 'Delete View', icon: 'trash', danger: true, run: () => { void actions.deleteView(view); } },
    );
  }
  return global;
});
</script>

<style scoped>
.jk-tasks { list-style: none; margin: 0 0 20px; padding: 0; display: flex; flex-direction: column; gap: 1.6px; }
.jk-task {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 37.6px;
  padding: 5.6px 11.2px; border: 0; border-radius: 10.56px; background: none;
  color: var(--jk-text); font: inherit; font-weight: 500; text-align: left; cursor: pointer;
}
.jk-task:hover:not(:disabled) { background: var(--jk-btn-hover); }
.jk-task.is-active { background: var(--jk-btn-bg); font-weight: 600; }
.jk-task:disabled { opacity: 0.45; cursor: not-allowed; }
.jk-task__icon { width: 22.4px; height: 22.4px; color: var(--jk-text); }
.jk-task.is-danger .jk-task__icon { color: var(--jk-red); }
.jk-pane { border: 1px solid var(--jk-border); border-radius: 12.8px; margin-bottom: 16px; overflow: hidden; background: #fff; }
.jk-pane__head { box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; padding: 9.6px 13.6px; font-weight: 600; background: none; border: 0; font: inherit; font-weight: 600; color: var(--jk-text); text-align: left; }
.jk-pane__toggle { cursor: pointer; }
.jk-pane__toggle:hover { background: var(--jk-btn-bg); }
.jk-pane__head > span:first-child { flex: 1; }
.jk-pane__trend { font-weight: 500; font-size: 13px; }
.jk-pane__count { color: var(--jk-secondary); font-weight: 500; font-size: 12.8px; }
.jk-pane__chev { width: 14.4px; height: 14.4px; color: var(--jk-secondary); }
.jk-pane__empty { margin: 0; padding: 0 13.6px 12px; color: var(--jk-secondary); }
.jk-pane__filter { position: relative; padding: 0 9.6px 8px; }
.jk-pane__filter-icon { position: absolute; left: 18.4px; top: 8.8px; width: 14.4px; height: 14.4px; color: var(--jk-secondary); }
.jk-pane__filter-input { width: 100%; box-sizing: border-box; height: 32px; padding: 0 9.6px 0 30.4px; border: 2px solid var(--jk-input-border); border-radius: 9.6px; font: inherit; outline: none; }
.jk-pane__filter-input:focus { border-color: var(--jk-accent); }
.jk-pane__foot { display: flex; flex-wrap: wrap; gap: 4px 16px; padding: 8.8px 13.6px; border-top: 1px solid var(--jk-border); font-size: 12.8px; }
.jk-bh { list-style: none; margin: 0; padding: 0 5.6px 6.4px; }
.jk-bh__row { display: flex; align-items: center; gap: 8px; padding: 4.8px 8px; border-radius: 8px; }
.jk-bh__row.is-current { background: var(--jk-btn-bg); }
.jk-link.jk-bh__num { font-weight: 600; display: inline-block; min-width: 24px; text-align: left; }
.jk-bh__date { margin-left: auto; color: var(--jk-secondary); font-size: 12.48px; white-space: nowrap; }
.jk-exec { padding: 0 13.6px 11.2px; }
.jk-exec__node + .jk-exec__node { margin-top: 7.2px; }
.jk-exec__name { font-weight: 600; }
.jk-exec__off { color: var(--jk-secondary); margin-left: 5.6px; }
.jk-exec__list { list-style: none; margin: 2.4px 0 0; padding: 0; color: var(--jk-secondary); }
.jk-exec__list li { display: flex; gap: 9.6px; }
.jk-exec__n { width: 16px; text-align: right; color: var(--jk-text); }
</style>
