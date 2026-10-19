<template>
  <section class="pg-chart">
    <header class="pg-chart__head">
      <h3 class="pg-chart__title">{{ title }}</h3>
      <ul class="pg-chart__legend">
        <li v-for="s in series" :key="s.name"><i :style="{ background: s.colour }" />{{ s.name }}</li>
      </ul>
    </header>
    <svg class="pg-chart__svg" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="title + ': ' + summary">
      <g class="pg-chart__grid">
        <template v-for="(tick, i) in ticks" :key="i">
          <line :x1="PAD_L" :x2="W - 6" :y1="y(tick)" :y2="y(tick)" />
          <text :x="PAD_L - 6" :y="y(tick) + 3" text-anchor="end">{{ tick }}</text>
        </template>
      </g>
      <polyline v-for="s in series" :key="s.name" :points="points(s.points)" fill="none" :stroke="s.colour"
                stroke-width="1.6" stroke-linejoin="round" />
    </svg>
  </section>
</template>

<script setup lang="ts">
/** One of the Dashboard's line graphs (pgAdmin's StreamingChart), drawn as SVG. */
import { computed } from 'vue';
import type { Series } from './pg';

const props = defineProps<{ title: string; series: Series[] }>();

const W = 420;
const H = 150;
const PAD_L = 34;
const PAD_T = 8;
const PAD_B = 10;

const max = computed(() => {
  const top = Math.max(4, ...props.series.flatMap(s => s.points));
  const magnitude = Math.pow(10, Math.floor(Math.log10(top)));
  const nice = [1, 2, 4, 5, 8, 10].map(f => f * magnitude).find(v => v >= top) || 10 * magnitude;
  return nice;
});
const ticks = computed(() => {
  const n = 4;
  return Array.from({ length: n + 1 }, (_, i) => Math.round((max.value / n) * i * 10) / 10);
});
function y(v: number) {
  return PAD_T + (H - PAD_T - PAD_B) * (1 - v / max.value);
}
function points(list: number[]) {
  const step = (W - 6 - PAD_L) / Math.max(1, list.length - 1);
  return list.map((v, i) => `${(PAD_L + i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
}
const summary = computed(() => props.series.map(s => `${s.name} ${s.points[s.points.length - 1] ?? 0}`).join(', '));
</script>

<style scoped>
.pg-chart { border: 1px solid var(--pg-border); border-radius: var(--pg-radius); background: #fff; min-width: 0; display: flex; flex-direction: column; }
.pg-chart__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 6px 10px; border-bottom: 1px solid var(--pg-border); background: var(--pg-grey-200); }
.pg-chart__title { margin: 0; font-size: 13px; font-weight: 600; color: var(--pg-text); }
.pg-chart__legend { margin: 0; padding: 0; list-style: none; display: flex; gap: 10px; flex-wrap: wrap; font-size: 11.5px; color: var(--pg-muted); }
.pg-chart__legend li { display: inline-flex; align-items: center; gap: 4px; }
.pg-chart__legend i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.pg-chart__svg { width: 100%; height: auto; display: block; padding: 4px 6px; box-sizing: border-box; }
.pg-chart__grid line { stroke: #e6e9ef; stroke-width: 1; }
.pg-chart__grid text { font-size: 9px; fill: #646b82; font-family: Roboto, Arial, sans-serif; }
</style>
