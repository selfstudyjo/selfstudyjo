<template>
  <div class="af-tip">
    <div class="af-tip__head">
      <span class="af-state"><i :style="{ background: state === 'none' ? '#fff' : stateColor(state) }"></i>{{ stateLabel(state) }}</span>
      <span class="af-tip__title">{{ taskId }}</span>
      <span v-if="task" class="af-pill">{{ task.operator }}</span>
    </div>

    <!-- Task actions, as the 2.9 panel lays them out: Clear, Mark Failed, Mark Success, each with its toggles. -->
    <div class="af-tip__actions">
      <div class="af-tip__action">
        <div class="af-tip__toggles" role="group" aria-label="Clear options">
          <button v-for="o in CLEAR_OPTS" :key="o" type="button" class="af-toggle" :class="{ 'is-on': clearOpts[o] }"
                  :aria-pressed="clearOpts[o]" @click="clearOpts[o] = !clearOpts[o]">{{ LABELS[o] }}</button>
        </div>
        <button type="button" class="af-btn af-btn--sm af-btn--primary" :disabled="af.busy.value" @click="clear">Clear task</button>
      </div>
      <div class="af-tip__action">
        <div class="af-tip__toggles" role="group" aria-label="Mark options">
          <button v-for="o in MARK_OPTS" :key="o" type="button" class="af-toggle" :class="{ 'is-on': markOpts[o] }"
                  :aria-pressed="markOpts[o]" @click="markOpts[o] = !markOpts[o]">{{ LABELS[o] }}</button>
        </div>
        <span class="af-btn-group">
          <button type="button" class="af-btn af-btn--sm af-tip__failed" :disabled="af.busy.value || state === 'failed'" @click="mark('failed')">Mark Failed</button>
          <button type="button" class="af-btn af-btn--sm af-tip__success" :disabled="af.busy.value || state === 'success'" @click="mark('success')">Mark Success</button>
        </span>
      </div>
      <div class="af-tip__action">
        <div class="af-tip__toggles" role="group" aria-label="Run options">
          <button v-for="o in RUN_OPTS" :key="o" type="button" class="af-toggle" :class="{ 'is-on': runOpts[o] }"
                  :aria-pressed="runOpts[o]" @click="runOpts[o] = !runOpts[o]">{{ LABELS[o] }}</button>
        </div>
        <button type="button" class="af-btn af-btn--sm" :disabled="af.busy.value" @click="runTask"><AfIcon name="play" /> Run</button>
      </div>
    </div>

    <table class="af-kv">
      <tbody>
        <tr class="af-kv__section"><th colspan="2">Task Instance Details</th></tr>
        <tr><th>Status</th><td><span class="af-state"><i :style="{ background: state === 'none' ? '#fff' : stateColor(state) }"></i>{{ stateLabel(state) }}</span></td></tr>
        <tr><th>Task Id</th><td class="af-mono">{{ taskId }}</td></tr>
        <tr><th>Run Id</th><td class="af-mono">{{ run.run_id }}</td></tr>
        <tr v-if="ti && ti.map_index !== undefined && ti.map_index !== -1"><th>Map Index</th><td>{{ ti.map_index }}</td></tr>
        <tr><th>Operator</th><td>{{ task?.operator }}</td></tr>
        <tr><th>Trigger Rule</th><td>{{ task?.trigger_rule || 'all_success' }}</td></tr>
        <tr><th>Try Number</th><td>{{ ti?.try_number ?? 0 }}</td></tr>
        <tr><th>Max Tries</th><td>{{ ti?.max_tries ?? task?.retries ?? 0 }}</td></tr>
        <tr><th>Started</th><td>{{ fmtDate(ti?.start) }}</td></tr>
        <tr><th>Ended</th><td>{{ fmtDate(ti?.end) }}</td></tr>
        <tr><th>Duration</th><td>{{ fmtDuration(ti?.duration_s) }}</td></tr>
        <tr><th>Pool</th><td>{{ task?.pool || 'default_pool' }}</td></tr>
        <tr><th>Retries</th><td>{{ task?.retries ?? 0 }}</td></tr>
        <tr><th>Retry Delay</th><td>{{ task?.retry_delay_min != null ? fmtDuration(Number(task.retry_delay_min) * 60) : '' }}</td></tr>
        <tr><th>SLA</th><td>{{ task?.sla_min ? fmtDuration(Number(task.sla_min) * 60) : 'None' }}</td></tr>
        <tr><th>Upstream</th><td>
          <span class="af-tip__rel"><button v-for="u in task?.upstream || []" :key="u" type="button" class="af-link" @click="$emit('select', run.run_id, u)">{{ u }}</button></span>
          <span v-if="!task?.upstream.length" class="af-muted">None</span></td></tr>
        <tr><th>Downstream</th><td>
          <span class="af-tip__rel"><button v-for="d in task?.downstream || []" :key="d" type="button" class="af-link" @click="$emit('select', run.run_id, d)">{{ d }}</button></span>
          <span v-if="!task?.downstream.length" class="af-muted">None</span></td></tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import AfIcon from './AfIcon.vue';
import { useAf } from './afContext';
import { CMD, fmtDate, fmtDuration, normState, relatives, stateColor, stateLabel, taskRegex, type AfDag, type AfRun } from './airflow';

const props = defineProps<{ dag: AfDag; run: AfRun; taskId: string }>();
defineEmits<{ (event: 'select', runId: string, taskId: string): void }>();
const af = useAf();

type Opt = 'past' | 'future' | 'upstream' | 'downstream' | 'failed' | 'allDeps' | 'taskState' | 'taskDeps';
const LABELS: Record<Opt, string> = { past: 'Past', future: 'Future', upstream: 'Upstream', downstream: 'Downstream', failed: 'Failed only',
  allDeps: 'Ignore All Deps', taskState: 'Ignore Task State', taskDeps: 'Ignore Task Deps' };
const CLEAR_OPTS: Opt[] = ['past', 'future', 'upstream', 'downstream', 'failed'];
const MARK_OPTS: Opt[] = ['past', 'future', 'upstream', 'downstream'];
const RUN_OPTS: Opt[] = ['allDeps', 'taskState', 'taskDeps'];
const clearOpts = reactive<Record<string, boolean>>({ past: false, future: false, upstream: false, downstream: true, failed: false });
const markOpts = reactive<Record<string, boolean>>({ past: false, future: false, upstream: false, downstream: false });
const runOpts = reactive<Record<string, boolean>>({ allDeps: false, taskState: false, taskDeps: false });

const task = computed(() => props.dag.tasks.find(t => t.task_id === props.taskId));
const ti = computed(() => af.tis.value.find(t => t.dag_id === props.dag.dag_id && t.run_id === props.run.run_id && t.task_id === props.taskId));
const state = computed(() => normState(ti.value?.state));

function affected(opts: Record<string, boolean>, onlyFailed = false) {
  const ids = new Set([props.taskId]);
  if (opts.downstream) relatives(props.dag.tasks, props.taskId, 'downstream').forEach(id => ids.add(id));
  if (opts.upstream) relatives(props.dag.tasks, props.taskId, 'upstream').forEach(id => ids.add(id));
  const mine = String(props.run.logical_date);
  const runIds = new Set(af.runsOf(props.dag.dag_id).filter(r => {
    const d = String(r.logical_date);
    return d === mine || (opts.past && d < mine) || (opts.future && d > mine);
  }).map(r => r.run_id));
  return af.tisOf(props.dag.dag_id).filter(t => ids.has(t.task_id) && runIds.has(t.run_id)
    && (!onlyFailed || ['failed', 'upstream_failed'].includes(normState(t.state))));
}

async function clear() {
  const list = affected(clearOpts, clearOpts.failed);
  const yes = await af.confirm({
    title: 'Clear task instances',
    message: `Here's the list of task instances you are about to clear (${list.length}):`,
    lines: list.map(t => `${t.task_id} - ${t.run_id} [${stateLabel(t.state)}]`),
    yes: 'Confirm',
  });
  if (!yes) return;
  await af.run(CMD.clear(props.dag.dag_id, {
    taskRegex: taskRegex(props.taskId),
    start: clearOpts.past ? '' : props.run.logical_date,
    end: clearOpts.future ? '' : props.run.logical_date,
    downstream: clearOpts.downstream, upstream: clearOpts.upstream, onlyFailed: clearOpts.failed,
  }), { success: `${list.length} task instance${list.length === 1 ? '' : 's'} cleared` });
}

async function mark(target: 'success' | 'failed') {
  const list = affected(markOpts).filter(t => normState(t.state) !== target);
  const yes = await af.confirm({
    title: `Mark task instances as ${target}`,
    message: `Here's the list of task instances you are about to mark as ${target} (${list.length}):`,
    lines: list.map(t => `${t.task_id} - ${t.run_id} [${stateLabel(t.state)}]`),
    yes: 'Confirm',
    danger: target === 'failed',
  });
  if (!yes) return;
  await af.run(CMD.markTask(props.dag.dag_id, props.taskId, props.run.run_id, target, {
    past: markOpts.past, future: markOpts.future, upstream: markOpts.upstream, downstream: markOpts.downstream,
  }), { success: `Marked ${props.taskId} as ${target}` });
}

async function runTask() {
  await af.run(CMD.runTask(props.dag.dag_id, props.taskId, props.run.run_id, {
    ignoreAllDeps: runOpts.allDeps, ignoreTaskState: runOpts.taskState, ignoreTaskDeps: runOpts.taskDeps,
  }), { success: `Sent ${props.taskId} to the message queue, it should start any moment now.` });
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-tip { display: flex; flex-direction: column; gap: 12px; }
.af-tip__head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.af-tip__title { font-size: 17px; font-weight: 600; color: var(--af-text-strong); font-family: var(--af-mono); overflow-wrap: anywhere; min-width: 0; }
.af-tip__actions { display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid var(--af-border-light); border-radius: 4px; background: #fafafa; }
.af-tip__action { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.af-tip__toggles { display: inline-flex; flex-wrap: wrap; }
.af-tip__failed { color: #a94442; border-color: #e4b9b9; }
.af-tip__success { color: #2b6e2b; border-color: #b9dbb9; }
.af-tip__rel { display: inline-flex; flex-wrap: wrap; gap: 4px 10px; }
</style>
