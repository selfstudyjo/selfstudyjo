<template>
  <div class="mc">
    <svg :viewBox="`0 0 ${W} ${H}`" class="mc__svg" role="img" :aria-label="label">
      <g v-for="t in ticks" :key="'y' + t">
        <line :x1="L" :x2="W - R" :y1="y(t)" :y2="y(t)" class="mc__grid" />
        <text :x="L - 6" :y="y(t) + 4" class="mc__axis" text-anchor="end">{{ fmt(t) }}</text>
      </g>
      <g v-for="(p, i) in points" :key="'x' + i">
        <text v-if="i % step === 0" :x="x(i)" :y="H - 6" class="mc__axis" text-anchor="middle">{{ p.t }}</text>
      </g>
      <line v-if="threshold !== undefined && threshold !== null" :x1="L" :x2="W - R" :y1="y(threshold)" :y2="y(threshold)" class="mc__thr" />
      <polyline :points="line" class="mc__line" />
      <circle v-for="(p, i) in valued" :key="'c' + i" :cx="x(p.i)" :cy="y(p.v)" r="2.5" class="mc__dot"><title>{{ p.t }}: {{ fmt(p.v) }}</title></circle>
    </svg>
    <div class="mc__legend"><span class="mc__sw" /> {{ label }}<template v-if="threshold !== undefined && threshold !== null"><span class="mc__sw mc__sw--thr" /> Threshold {{ threshold }}</template></div>
  </div>
</template>

<script setup lang="ts">
/** A Cloudscape-style line chart in plain SVG: the metric and its alarm threshold. */
import { computed } from 'vue';

const props = defineProps<{ points: { t: string; v: number | null }[]; label: string; threshold?: number | null }>();
const W = 640; const H = 200; const L = 44; const R = 12; const T = 10; const B = 24;
const values = computed(() => props.points.map(p => p.v).filter((v): v is number => typeof v === 'number'));
const max = computed(() => {
  const top = Math.max(1, ...values.value, props.threshold ?? 0);
  const pow = Math.pow(10, Math.floor(Math.log10(top)));
  return Math.ceil(top / pow) * pow;
});
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map(f => +(max.value * f).toFixed(3)));
const step = computed(() => Math.max(1, Math.ceil(props.points.length / 6)));
function x(i: number) { return L + (props.points.length <= 1 ? 0 : (i * (W - L - R)) / (props.points.length - 1)); }
function y(v: number) { return T + (H - T - B) * (1 - v / max.value); }
function fmt(v: number) { return Math.abs(v) >= 100 ? v.toFixed(0) : +v.toFixed(2) + ''; }
const valued = computed(() => props.points.map((p, i) => ({ ...p, i })).filter(p => typeof p.v === 'number') as { t: string; v: number; i: number }[]);
const line = computed(() => valued.value.map(p => `${x(p.i)},${y(p.v)}`).join(' '));
</script>

<style scoped>
.mc__svg { width: 100%; height: auto; display: block; }
.mc__grid { stroke: #ebebf0; stroke-width: 1; }
.mc__axis { font-size: 11px; fill: #656871; }
.mc__line { fill: none; stroke: #688ae8; stroke-width: 2; }
.mc__dot { fill: #688ae8; }
.mc__thr { stroke: #d63f38; stroke-width: 1.5; stroke-dasharray: 6 4; }
.mc__legend { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #424650; flex-wrap: wrap; }
.mc__sw { display: inline-block; width: 14px; height: 3px; background: #688ae8; margin-left: 8px; }
.mc__sw--thr { background: #d63f38; }
</style>
