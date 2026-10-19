<template>
  <div class="af-gantt">
    <div v-if="!run" class="af-empty"><strong>No DAG runs yet</strong><span>Trigger the DAG to see how long each task took.</span></div>
    <template v-else>
      <div class="af-muted af-small">Run <b class="af-gantt__run">{{ run.run_id }}</b>
        <template v-if="span"> - {{ fmtDate(new Date(span.start).toISOString()) }} → {{ fmtDuration((span.end - span.start) / 1000) }}</template></div>
      <div v-if="!bars.length" class="af-empty"><span>No task in this run has started yet.</span></div>
      <div v-else class="af-gantt__rows">
        <div v-for="b in bars" :key="b.task" class="af-gantt__row" :class="{ 'is-sel': b.task === taskId }">
          <button type="button" class="af-gantt__name af-link" :title="b.task" @click="$emit('select-task', b.task)">{{ b.task }}</button>
          <div class="af-gantt__track">
            <button type="button" class="af-gantt__bar" :style="{ left: b.left + '%', width: b.width + '%', background: stateColor(b.state) }"
                    :title="`${b.task}\n${stateLabel(b.state)}\nStarted: ${fmtDate(b.startText)}\nDuration: ${fmtDuration(b.dur)}`"
                    :aria-label="`${b.task} ${stateLabel(b.state)}`" @click="$emit('select-task', b.task)"></button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAf } from './afContext';
import { fmtDate, fmtDuration, stateColor, stateLabel, topoOrder, type AfDag, type AfRun } from './airflow';

const props = defineProps<{ dag: AfDag; run?: AfRun; taskId: string }>();
defineEmits<{ (event: 'select-task', taskId: string): void }>();
const af = useAf();

function ms(value: unknown) {
  const n = Date.parse(String(value || '').replace(' ', 'T'));
  return Number.isNaN(n) ? null : n;
}

const items = computed(() => {
  if (!props.run) return [];
  const order = topoOrder(props.dag.tasks).map(t => t.task_id);
  return af.tisOf(props.dag.dag_id, props.run.run_id)
    .map(t => ({ task: t.task_id, state: t.state, start: ms(t.start), end: ms(t.end) ?? (ms(t.start) !== null ? (ms(t.start) as number) + (Number(t.duration_s) || 1) * 1000 : null), startText: t.start, dur: t.duration_s }))
    .filter(t => t.start !== null)
    .sort((a, b) => order.indexOf(a.task) - order.indexOf(b.task));
});
const span = computed(() => {
  if (!items.value.length) return null;
  const start = Math.min(...items.value.map(i => i.start as number));
  const end = Math.max(...items.value.map(i => (i.end ?? i.start) as number), start + 1000);
  return { start, end };
});
const bars = computed(() => {
  const s = span.value;
  if (!s) return [];
  const total = s.end - s.start || 1;
  return items.value.map(i => ({
    ...i,
    left: (((i.start as number) - s.start) / total) * 100,
    width: Math.max(0.8, ((((i.end ?? i.start) as number) - (i.start as number)) / total) * 100),
  }));
});
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-gantt { display: flex; flex-direction: column; gap: 8px; }
.af-gantt__run { font-family: var(--af-mono); font-weight: 400; color: var(--af-text-strong); overflow-wrap: anywhere; }
.af-gantt__rows { display: flex; flex-direction: column; border: 1px solid var(--af-border-light); border-radius: 4px; }
.af-gantt__row { display: grid; grid-template-columns: minmax(110px, 34%) minmax(0, 1fr); align-items: center; border-bottom: 1px solid #f0f0f0; min-height: 26px; }
.af-gantt__row:last-child { border-bottom: 0; }
.af-gantt__row.is-sel { background: #e6f1fd; }
.af-gantt__name { padding: 0 8px; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af-gantt__track { position: relative; height: 16px; margin-right: 8px; background: repeating-linear-gradient(90deg, #fafafa 0 10%, #f2f2f2 10% 10.2%); }
.af-gantt__bar { position: absolute; top: 2px; height: 12px; border: 1px solid rgba(0, 0, 0, .15); border-radius: 2px; padding: 0; cursor: pointer; }
</style>
