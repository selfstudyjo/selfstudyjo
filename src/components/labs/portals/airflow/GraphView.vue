<template>
  <div class="af-graph">
    <div class="af-graph__bar">
      <span v-if="run" class="af-muted af-small">Run: <b class="af-graph__run">{{ run.run_id }}</b> - <span class="af-state"><i :style="{ background: stateColor(run.state) }"></i>{{ normState(run.state) }}</span></span>
      <span v-else class="af-muted af-small">No runs yet - borders show no status.</span>
      <span class="af-spacer"></span>
      <label class="af-check af-small"><input v-model="showOperator" type="checkbox" /> Show operator</label>
      <span class="af-btn-group">
        <button type="button" class="af-btn af-btn--sm af-btn--icon" aria-label="Zoom out" @click="zoom = Math.max(0.4, zoom - 0.15)">−</button>
        <button type="button" class="af-btn af-btn--sm" @click="zoom = 1">{{ Math.round(zoom * 100) }}%</button>
        <button type="button" class="af-btn af-btn--sm af-btn--icon" aria-label="Zoom in" @click="zoom = Math.min(2, zoom + 0.15)">+</button>
      </span>
    </div>
    <div v-if="!dag.tasks.length" class="af-empty"><strong>No tasks</strong></div>
    <div v-else class="af-graph__canvas">
      <svg :width="width * zoom" :height="height * zoom" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="'Graph of ' + dag.dag_id">
        <defs>
          <marker id="af-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#9e9e9e" />
          </marker>
        </defs>
        <path v-for="e in edges" :key="e.key" :d="e.d" fill="none" :stroke="e.hot ? '#017cee' : '#b0b0b0'" :stroke-width="e.hot ? 2 : 1.3" marker-end="url(#af-arrow)" />
        <g v-for="n in nodes" :key="n.task.task_id" class="af-graph__node" :transform="`translate(${n.x},${n.y})`" role="button" tabindex="0"
           :aria-label="`${n.task.task_id}: ${stateLabel(n.state)}`" @click="$emit('select-task', n.task.task_id)" @keydown.enter="$emit('select-task', n.task.task_id)">
          <title>{{ n.task.task_id }} ({{ n.task.operator }}) - {{ stateLabel(n.state) }}</title>
          <rect :width="NODE_W" :height="NODE_H" rx="6" fill="#fff" :stroke="n.task.task_id === taskId ? '#017cee' : n.state === 'none' ? '#c4c4c4' : stateColor(n.state)"
                :stroke-width="n.task.task_id === taskId ? 4 : 3" />
          <rect x="3" y="3" :width="NODE_W - 6" height="4" rx="2" :fill="operatorColor(n.task.operator)" />
          <text x="10" y="25" class="af-graph__tid">{{ clip(n.task.task_id + (n.task.mapped ? ' [ ]' : ''), 22) }}</text>
          <template v-if="showOperator">
            <rect x="10" y="33" :width="Math.min(NODE_W - 20, clip(n.task.operator, 24).length * 6.2 + 10)" height="16" rx="3" :fill="operatorColor(n.task.operator)" stroke="#ddd" />
            <text x="15" y="45" class="af-graph__op">{{ clip(n.task.operator, 24) }}</text>
          </template>
          <circle :cx="NODE_W - 14" cy="20" r="5" :fill="n.state === 'none' ? '#fff' : stateColor(n.state)" stroke="#999" stroke-width=".6" />
        </g>
      </svg>
    </div>
    <div class="af-graph__legend">
      <span v-for="op in operators" :key="op" class="af-graph__oplegend"><i :style="{ background: operatorColor(op) }"></i>{{ op }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAf } from './afContext';
import { layers, normState, operatorColor, stateColor, stateLabel, type AfDag, type AfRun } from './airflow';

const props = defineProps<{ dag: AfDag; run?: AfRun; taskId: string }>();
defineEmits<{ (event: 'select-task', taskId: string): void }>();
const af = useAf();

const NODE_W = 190;
const NODE_H = 58;
const COL_GAP = 70;
const ROW_GAP = 22;
const PAD = 20;
const zoom = ref(1);
const showOperator = ref(true);

const stateOf = computed(() => {
  const map = new Map<string, string>();
  if (props.run) for (const t of af.tisOf(props.dag.dag_id, props.run.run_id)) map.set(t.task_id, normState(t.state));
  return map;
});

const columns = computed(() => layers(props.dag.tasks));
const height = computed(() => PAD * 2 + Math.max(1, ...columns.value.map(c => c.length)) * (NODE_H + ROW_GAP) - ROW_GAP);
const width = computed(() => PAD * 2 + columns.value.length * (NODE_W + COL_GAP) - COL_GAP);

const nodes = computed(() => {
  const out: { task: AfDag['tasks'][number]; x: number; y: number; state: string }[] = [];
  columns.value.forEach((col, ci) => {
    const colHeight = col.length * (NODE_H + ROW_GAP) - ROW_GAP;
    const top = (height.value - colHeight) / 2;
    col.forEach((task, ri) => out.push({
      task, x: PAD + ci * (NODE_W + COL_GAP), y: top + ri * (NODE_H + ROW_GAP), state: stateOf.value.get(task.task_id) || 'none',
    }));
  });
  return out;
});

const edges = computed(() => {
  const pos = new Map(nodes.value.map(n => [n.task.task_id, n]));
  const out: { key: string; d: string; hot: boolean }[] = [];
  for (const n of nodes.value) {
    for (const down of n.task.downstream) {
      const m = pos.get(down);
      if (!m) continue;
      const x1 = n.x + NODE_W; const y1 = n.y + NODE_H / 2;
      const x2 = m.x - 2; const y2 = m.y + NODE_H / 2;
      const c = Math.max(30, (x2 - x1) / 2);
      out.push({ key: n.task.task_id + '>' + down, d: `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`,
        hot: props.taskId === n.task.task_id || props.taskId === down });
    }
  }
  return out;
});

const operators = computed(() => [...new Set(props.dag.tasks.map(t => t.operator).filter(Boolean))]);

function clip(text: unknown, n: number) {
  const s = String(text ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-graph { display: flex; flex-direction: column; gap: 8px; min-height: 0; flex: 1; }
.af-graph__bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.af-graph__run { font-family: var(--af-mono); font-weight: 400; color: var(--af-text-strong); overflow-wrap: anywhere; }
.af-graph__canvas { flex: 1; min-height: 260px; overflow: auto; border: 1px solid var(--af-border-light); border-radius: 4px; background-color: #fafafa;
  background-image: radial-gradient(#d9d9d9 1px, transparent 1px); background-size: 16px 16px; }
.af-graph__canvas svg { display: block; max-width: none; height: auto; }
.af-graph__node { cursor: pointer; }
.af-graph__node:hover rect:first-of-type { filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .2)); }
.af-graph__node:focus-visible { outline: none; }
.af-graph__node:focus-visible rect:first-of-type { stroke: #66afe9; }
.af-graph__tid { font-size: 13px; font-weight: 700; fill: #333; font-family: var(--af-font); }
.af-graph__op { font-size: 10.5px; fill: #333; font-family: var(--af-font); }
.af-graph__legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--af-text-2); }
.af-graph__oplegend { display: inline-flex; align-items: center; gap: 4px; }
.af-graph__oplegend i { width: 12px; height: 12px; border-radius: 2px; border: 1px solid #ccc; }
</style>
