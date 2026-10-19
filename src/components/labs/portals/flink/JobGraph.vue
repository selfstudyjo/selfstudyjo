<template>
  <div class="fk-graph">
    <div class="fk-graph__tools">
      <button type="button" class="fk-gbtn" title="Zoom in" aria-label="Zoom in" @click="zoom(0.15)">+</button>
      <button type="button" class="fk-gbtn" title="Zoom out" aria-label="Zoom out" @click="zoom(-0.15)">−</button>
      <button type="button" class="fk-gbtn fk-gbtn--wide" title="Reset zoom" @click="scale = 1">1:1</button>
    </div>
    <div class="fk-graph__legend" aria-hidden="true">
      <span><i style="background:#e6f4ff;border-color:#91caff"></i>Idle</span>
      <span><i style="background:#d9363e"></i>Busy</span>
      <span><i style="background:#4d4d4d"></i>Backpressured</span>
    </div>
    <div class="fk-graph__canvas">
      <div v-if="!layout.nodes.length" class="fk-graph__empty">This job has no vertices to draw.</div>
      <svg v-else :width="layout.width * scale" :height="layout.height * scale"
           :viewBox="`0 0 ${layout.width} ${layout.height}`" role="img" :aria-label="'Job graph of ' + job.name">
        <defs>
          <marker id="fk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#8c8c8c" />
          </marker>
        </defs>
        <g v-for="edge in layout.edges" :key="edge.from + '>' + edge.to">
          <path :d="edge.path" fill="none" stroke="#8c8c8c" stroke-width="1.5" marker-end="url(#fk-arrow)" />
          <rect :x="edge.lx - edge.lw / 2" :y="edge.ly - 10" :width="edge.lw" height="20" rx="2" fill="#fff" stroke="#d9d9d9" />
          <text :x="edge.lx" :y="edge.ly + 4" text-anchor="middle" class="fk-edge-label">{{ edge.strategy }}</text>
        </g>
        <g v-for="node in layout.nodes" :key="node.v.id" class="fk-node" :class="{ 'is-selected': node.v.id === selected }"
           tabindex="0" role="button" :aria-label="node.v.name" @click="$emit('select', node.v.id)"
           @keydown.enter="$emit('select', node.v.id)">
          <title>{{ node.v.name }}</title>
          <rect :x="node.x" :y="node.y" :width="W" :height="H" rx="4" :fill="node.fill"
                :stroke="node.v.id === selected ? '#1890ff' : node.fill === '#e6f4ff' ? '#91caff' : node.fill" :stroke-width="node.v.id === selected ? 3 : 1" />
          <text v-for="(line, i) in node.lines" :key="i" :x="node.x + 12" :y="node.y + 22 + i * 17"
                :fill="node.ink" class="fk-node__name">{{ line }}</text>
          <text :x="node.x + 12" :y="node.y + H - 46" :fill="node.ink" class="fk-node__meta">Parallelism: {{ node.v.parallelism }}</text>
          <text :x="node.x + 12" :y="node.y + H - 28" :fill="node.ink" class="fk-node__meta">Backpressured (max): {{ node.bp }}%</text>
          <text :x="node.x + 12" :y="node.y + H - 10" :fill="node.ink" class="fk-node__meta">Busy (max): {{ node.busy }}%</text>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The job graph, laid out left to right the way the dashboard's dagre layout
 * does: each vertex a box with its parallelism, backpressured and busy maxima,
 * filled by the same rule Flink 1.19 uses (busy red, backpressured dark, idle
 * blue), and every edge labelled with its ship strategy.
 */
import { computed, ref } from 'vue';
import { backpressuredPct, busyPct, graphEdges, vertexFill, vertexInk, type FkJob, type FkVertex } from './flink';

const props = defineProps<{ job: FkJob; selected?: string }>();
defineEmits<{ (event: 'select', id: string): void }>();

const W = 240;
const H = 136;
const GAP_X = 110;
const GAP_Y = 40;
const PAD = 24;
const scale = ref(1);

function zoom(delta: number) {
  scale.value = Math.min(2, Math.max(0.4, Math.round((scale.value + delta) * 100) / 100));
}

function wrap(name: string): string[] {
  const max = 32;
  const words = name.replace(/\s*->\s*/g, ' -> ').split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
    if (lines.length === 3) break;
  }
  if (lines.length < 3 && line) lines.push(line);
  const used = lines.join(' ').length;
  if (used < name.length - 1 && lines.length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = (last.length > max - 1 ? last.slice(0, max - 1) : last) + '…';
  }
  return lines.map(l => (l.length > max + 1 ? l.slice(0, max) + '…' : l));
}

const layout = computed(() => {
  const vertices: FkVertex[] = props.job.vertices;
  const edges = graphEdges(vertices);
  const level = new Map<string, number>();
  for (const v of vertices) level.set(v.id, 0);
  // Longest path from a source: a few passes are enough for a DAG this size.
  for (let pass = 0; pass < vertices.length; pass += 1) {
    let moved = false;
    for (const edge of edges) {
      const next = (level.get(edge.from) ?? 0) + 1;
      if (next > (level.get(edge.to) ?? 0)) { level.set(edge.to, next); moved = true; }
    }
    if (!moved) break;
  }
  const columns = new Map<number, FkVertex[]>();
  for (const v of vertices) {
    const l = level.get(v.id) ?? 0;
    columns.set(l, [...(columns.get(l) || []), v]);
  }
  const maxRows = Math.max(1, ...[...columns.values()].map(list => list.length));
  const height = PAD * 2 + maxRows * H + (maxRows - 1) * GAP_Y;
  const pos = new Map<string, { x: number; y: number }>();
  const nodes = vertices.map(v => {
    const l = level.get(v.id) ?? 0;
    const col = columns.get(l) || [v];
    const index = col.indexOf(v);
    const colHeight = col.length * H + (col.length - 1) * GAP_Y;
    const x = PAD + l * (W + GAP_X);
    const y = (height - colHeight) / 2 + index * (H + GAP_Y);
    pos.set(v.id, { x, y });
    const fill = vertexFill(v, props.job);
    return { v, x, y, fill, ink: vertexInk(fill), lines: wrap(v.name),
      bp: backpressuredPct(v, props.job), busy: busyPct(v, props.job) };
  });
  const maxLevel = Math.max(0, ...[...level.values()]);
  const width = PAD * 2 + (maxLevel + 1) * W + maxLevel * GAP_X;
  const drawn = edges.map(edge => {
    const a = pos.get(edge.from)!;
    const b = pos.get(edge.to)!;
    const x1 = a.x + W;
    const y1 = a.y + H / 2;
    const x2 = b.x - 2;
    const y2 = b.y + H / 2;
    const mx = (x1 + x2) / 2;
    return {
      ...edge,
      path: `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
      lx: mx, ly: (y1 + y2) / 2, lw: edge.strategy.length * 7.4 + 14,
    };
  });
  return { nodes, edges: drawn, width, height };
});
</script>

<style scoped>
.fk-graph { position: relative; background: #fff; border: 1px solid var(--fk-border-split); min-width: 0; }
.fk-graph__tools { position: absolute; top: 12px; right: 12px; display: flex; gap: 4px; z-index: 2; }
.fk-gbtn { width: 28px; height: 28px; border: 1px solid #d9d9d9; background: #fff; border-radius: 2px; font: inherit; font-size: 16px; line-height: 1; cursor: pointer; color: var(--fk-text); }
.fk-gbtn--wide { width: auto; padding: 0 8px; font-size: 12px; }
.fk-gbtn:hover { color: #40a9ff; border-color: #40a9ff; }
.fk-graph__legend { position: absolute; left: 12px; top: 12px; display: flex; gap: 12px; font-size: 12px; color: var(--fk-text-2); z-index: 2; background: rgba(255, 255, 255, 0.9); padding: 2px 6px; }
.fk-graph__legend i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 4px; vertical-align: -2px; border: 1px solid transparent; }
.fk-graph__canvas { overflow: auto; min-height: 220px; max-height: 460px; padding-top: 40px; background-image: radial-gradient(#e8e8e8 1px, transparent 1px); background-size: 16px 16px; }
.fk-graph__canvas svg { display: block; margin: 0 auto; }
.fk-graph__empty { padding: 60px 16px; text-align: center; color: var(--fk-text-3); }
.fk-node { cursor: pointer; outline: none; }
.fk-node:hover rect, .fk-node:focus rect { filter: brightness(0.97); }
.fk-node__name { font-size: 13px; font-weight: 600; font-family: var(--fk-font); }
.fk-node__meta { font-size: 12px; font-family: var(--fk-font); }
.fk-edge-label { font-size: 11px; font-family: var(--fk-font); fill: rgba(0, 0, 0, 0.75); font-weight: 600; }
</style>
