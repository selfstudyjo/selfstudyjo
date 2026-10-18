<template>
  <figure class="mf-chart">
    <figcaption class="mf-chart__title" :title="title">{{ title }}</figcaption>
    <svg :viewBox="`0 0 ${W} ${H}`" class="mf-chart__svg" role="img" :aria-label="title" @mouseleave="hover = null">
      <g class="mf-chart__grid">
        <line v-for="t in yTicks" :key="'y' + t" :x1="L" :x2="W - R" :y1="sy(t)" :y2="sy(t)" />
      </g>
      <g class="mf-chart__axis">
        <text v-for="t in yTicks" :key="'yl' + t" :x="L - 6" :y="sy(t) + 3" text-anchor="end">{{ fmt(t) }}</text>
        <text v-for="t in xTicks" :key="'xl' + t" :x="sx(t)" :y="H - B + 14" text-anchor="middle">{{ fmt(t) }}</text>
        <text v-if="!bars" :x="(L + W - R) / 2" :y="H - 4" text-anchor="middle" class="mf-chart__xname">{{ xLabel }}</text>
      </g>
      <template v-if="bars">
        <g v-for="(s, i) in series" :key="s.name">
          <rect :x="barX(i)" :y="sy(Math.max(0, s.points[s.points.length - 1]?.[1] ?? 0))" :width="barW"
                :height="Math.max(1, sy(yMin) - sy(Math.max(0, s.points[s.points.length - 1]?.[1] ?? 0)))"
                :fill="s.color" rx="2" @mouseenter="hover = { s, p: s.points[s.points.length - 1] }" />
        </g>
      </template>
      <template v-else>
        <g v-for="s in series" :key="s.name">
          <polyline v-if="s.points.length > 1" :points="s.points.map(p => `${sx(p[0])},${sy(p[1])}`).join(' ')"
                    fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" />
          <circle v-for="p in s.points" :key="p[0]" :cx="sx(p[0])" :cy="sy(p[1])" :r="s.points.length > 1 ? 2.5 : 4"
                  :fill="s.color" class="mf-chart__pt" @mouseenter="hover = { s, p }" />
        </g>
      </template>
    </svg>
    <div v-if="hover && hover.p" class="mf-chart__tip">
      <span class="mf-dot" :style="{ background: hover.s.color }"></span>
      <b>{{ hover.s.name }}</b> <span>{{ bars ? '' : xLabel + ' ' + hover.p[0] + ': ' }}{{ fmt(hover.p[1]) }}</span>
    </div>
    <div v-else-if="!series.some(s => s.points.length)" class="mf-chart__none">No data</div>
  </figure>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

interface Series { name: string; color: string; points: [number, number][] }
const props = withDefaults(defineProps<{ title: string; series: Series[]; xLabel?: string; bars?: boolean }>(),
  { xLabel: 'Step', bars: false });

const W = 360; const H = 200; const L = 46; const R = 12; const T = 10; const B = 34;
const hover = ref<{ s: Series; p: [number, number] | undefined } | null>(null);

const all = computed(() => props.series.flatMap(s => s.points));
const yMin = computed(() => {
  const ys = all.value.map(p => p[1]);
  if (!ys.length) return 0;
  if (props.bars) return Math.min(0, ...ys);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  return lo === hi ? lo - Math.abs(lo || 1) * 0.1 : lo - (hi - lo) * 0.05;
});
const yMax = computed(() => {
  const ys = all.value.map(p => p[1]);
  if (!ys.length) return 1;
  const lo = Math.min(...ys); const hi = Math.max(...ys);
  return lo === hi ? hi + Math.abs(hi || 1) * 0.1 : hi + (hi - lo) * 0.05;
});
const xMin = computed(() => (all.value.length ? Math.min(...all.value.map(p => p[0])) : 0));
const xMax = computed(() => {
  const m = all.value.length ? Math.max(...all.value.map(p => p[0])) : 1;
  return m === xMin.value ? m + 1 : m;
});
function sx(x: number) { return L + ((x - xMin.value) / (xMax.value - xMin.value)) * (W - L - R); }
function sy(y: number) { return T + (1 - (y - yMin.value) / (yMax.value - yMin.value)) * (H - T - B); }
function ticks(lo: number, hi: number, n: number, integer = false) {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const v = lo + ((hi - lo) * i) / n;
    out.push(integer ? Math.round(v) : v);
  }
  return [...new Set(out)];
}
const yTicks = computed(() => ticks(yMin.value, yMax.value, 4));
const xTicks = computed(() => (props.bars ? [] : ticks(xMin.value, xMax.value, Math.min(5, xMax.value - xMin.value), true)));
const barW = computed(() => Math.max(6, Math.min(40, (W - L - R) / Math.max(1, props.series.length) - 8)));
function barX(i: number) {
  const slot = (W - L - R) / Math.max(1, props.series.length);
  return L + slot * i + (slot - barW.value) / 2;
}
function fmt(v: number) {
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return String(Math.round(v * 1000) / 1000);
}
</script>

<style scoped>
.mf-chart { position: relative; margin: 0; border: 1px solid var(--mf-border-light); border-radius: var(--mf-radius); padding: 10px 12px 6px; background: var(--mf-bg); min-width: 0; }
.mf-chart__title { font-size: 13px; font-weight: 600; color: var(--mf-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
.mf-chart__svg { width: 100%; height: auto; display: block; overflow: visible; }
.mf-chart__grid line { stroke: var(--mf-border-light); stroke-width: 1; }
.mf-chart__axis text { font-size: 10px; fill: var(--mf-text-2); font-family: var(--mf-font); }
.mf-chart__xname { font-size: 10px; }
.mf-chart__pt { cursor: pointer; }
.mf-chart__tip { position: absolute; top: 8px; right: 10px; background: var(--mf-bg); border: 1px solid var(--mf-border-light); box-shadow: var(--mf-shadow-lg);
  border-radius: var(--mf-radius); padding: 4px 8px; font-size: 12px; display: flex; align-items: center; gap: 6px; max-width: 75%; }
.mf-chart__tip b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: none; }
.mf-chart__none { position: absolute; inset: 30px 0 0 0; display: grid; place-items: center; color: var(--mf-text-3); font-size: 12px; }
</style>
