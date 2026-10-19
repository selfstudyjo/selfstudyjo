<template>
  <div class="af-rdet">
    <div class="af-rdet__actions">
      <span class="af-menu-anchor">
        <button type="button" class="af-btn af-btn--sm" :disabled="af.busy.value" :aria-expanded="menu === 'clear'" @click.stop="menu = menu === 'clear' ? '' : 'clear'">
          Clear <AfIcon name="caret" /></button>
        <div v-if="menu === 'clear'" class="af-menu af-rdet__menu" role="menu">
          <button type="button" role="menuitem" @click="clear(false)">Clear existing tasks</button>
          <button type="button" role="menuitem" :disabled="!failedCount" @click="clear(true)">Clear only failed tasks</button>
        </div>
      </span>
      <span class="af-menu-anchor">
        <button type="button" class="af-btn af-btn--sm" :disabled="af.busy.value" :aria-expanded="menu === 'mark'" @click.stop="menu = menu === 'mark' ? '' : 'mark'">
          Mark state as... <AfIcon name="caret" /></button>
        <div v-if="menu === 'mark'" class="af-menu af-rdet__menu" role="menu">
          <button type="button" role="menuitem" :disabled="normState(run.state) === 'success'" @click="mark('success')">
            <span class="af-state"><i :style="{ background: stateColor('success') }"></i>success</span></button>
          <button type="button" role="menuitem" :disabled="normState(run.state) === 'failed'" @click="mark('failed')">
            <span class="af-state"><i :style="{ background: stateColor('failed') }"></i>failed</span></button>
          <button type="button" role="menuitem" :disabled="normState(run.state) === 'queued'" @click="mark('queued')">
            <span class="af-state"><i :style="{ background: stateColor('queued') }"></i>queued</span></button>
        </div>
      </span>
    </div>

    <table class="af-kv">
      <tbody>
        <tr><th>Status</th><td><span class="af-state"><i :style="{ background: stateColor(run.state) }"></i>{{ normState(run.state) }}</span></td></tr>
        <tr><th>Run ID</th><td class="af-mono">{{ run.run_id }}</td></tr>
        <tr><th>Run type</th><td>{{ run.run_type }}</td></tr>
        <tr><th>Run duration</th><td>{{ fmtDuration(secondsBetween(run.start, run.end)) }}</td></tr>
        <tr><th>Logical date</th><td>{{ fmtDate(run.logical_date) }}</td></tr>
        <tr><th>Queued at</th><td>{{ fmtDate(run.queued_at) }}</td></tr>
        <tr><th>Started</th><td>{{ fmtDate(run.start) }}</td></tr>
        <tr><th>Ended</th><td>{{ fmtDate(run.end) }}</td></tr>
        <tr><th>Data interval start</th><td>{{ fmtDate(run.data_interval_start) }}</td></tr>
        <tr><th>Data interval end</th><td>{{ fmtDate(run.data_interval_end) }}</td></tr>
        <tr><th>Externally triggered</th><td>{{ run.run_type === 'manual' ? 'true' : 'false' }}</td></tr>
        <tr><th>Run config</th><td><pre class="af-code af-code--wrap">{{ confText }}</pre></td></tr>
        <tr><th>Task instances</th><td>
          <span class="af-rdet__counts">
            <span v-for="[s, n] in tiCounts" :key="s" class="af-state"><i :style="{ background: s === 'none' ? '#fff' : stateColor(s) }"></i>{{ stateLabel(s) }}: {{ n }}</span>
          </span></td></tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AfIcon from './AfIcon.vue';
import { useAf } from './afContext';
import { CMD, fmtDate, fmtDuration, normState, secondsBetween, stateColor, stateLabel, type AfDag, type AfRun } from './airflow';

const props = defineProps<{ dag: AfDag; run: AfRun }>();
const af = useAf();
const menu = ref('');
function close() { menu.value = ''; }
onMounted(() => window.addEventListener('click', close));
onBeforeUnmount(() => window.removeEventListener('click', close));

const tis = computed(() => af.tisOf(props.dag.dag_id, props.run.run_id));
const failedCount = computed(() => tis.value.filter(t => ['failed', 'upstream_failed'].includes(normState(t.state))).length);
const tiCounts = computed(() => {
  const counts = new Map<string, number>();
  tis.value.forEach(t => { const s = normState(t.state); counts.set(s, (counts.get(s) || 0) + 1); });
  return [...counts.entries()];
});
const confText = computed(() => {
  const c = props.run.conf;
  if (c === undefined || c === null || c === '') return '{}';
  return typeof c === 'string' ? c : JSON.stringify(c, null, 2);
});

async function clear(onlyFailed: boolean) {
  menu.value = '';
  const affected = tis.value.filter(t => !onlyFailed || ['failed', 'upstream_failed'].includes(normState(t.state)));
  const yes = await af.confirm({
    title: onlyFailed ? 'Clear only failed tasks' : 'Clear existing tasks',
    message: `Here's the list of task instances you are about to clear (${affected.length}). They will be re-run by the scheduler:`,
    lines: affected.map(t => `${t.dag_id}.${t.task_id} - ${props.run.run_id} [${stateLabel(t.state)}]`),
    yes: 'Clear',
  });
  if (!yes) return;
  await af.run(CMD.clear(props.dag.dag_id, { start: props.run.logical_date, end: props.run.logical_date, onlyFailed }),
    { success: `${affected.length} task instance${affected.length === 1 ? '' : 's'} cleared` });
}

async function mark(state: 'success' | 'failed' | 'queued') {
  menu.value = '';
  const yes = await af.confirm({
    title: `Mark DAG run as ${state}`,
    message: state === 'queued'
      ? `Mark ${props.run.run_id} as queued? Its task instances are cleared so the scheduler runs it again.`
      : `Mark ${props.run.run_id} as ${state}? Every unfinished task instance in the run is set to ${state} too.`,
    yes: 'Confirm',
    danger: state === 'failed',
  });
  if (!yes) return;
  await af.run(CMD.markRun(props.dag.dag_id, props.run.run_id, state), { success: `Marked DAG run ${props.run.run_id} as ${state}` });
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-rdet { display: flex; flex-direction: column; gap: 12px; }
.af-rdet__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.af-rdet__menu { top: 30px; left: 0; }
.af-rdet__counts { display: flex; flex-wrap: wrap; gap: 4px 12px; }
</style>
