<template>
  <div class="ts" :class="['ts--' + theme, { 'ts--bars': bars }]">
    <div ref="box" class="ts__plot" @mousemove="onMove" @mouseleave="hover = null">
      <svg v-if="width > 0" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img"
           :aria-label="ariaLabel">
        <g class="ts__grid">
          <line v-for="y in yTicks" :key="'y' + y" :x1="left" :x2="width - 8" :y1="yOf(y)" :y2="yOf(y)" />
          <line v-for="x in xTicks" :key="'x' + x" :x1="xOf(x)" :x2="xOf(x)" :y1="top" :y2="height - bottom" />
        </g>
        <g class="ts__axis">
          <text v-for="y in yTicks" :key="'yl' + y" :x="left - 6" :y="yOf(y) + 4" text-anchor="end">{{ fmtAxis(y) }}</text>
          <text v-for="x in xTicks" :key="'xl' + x" :x="xOf(x)" :y="height - 6" text-anchor="middle">{{ clockOf(x) }}</text>
        </g>
        <g v-for="t in thresholdLines" :key="'th' + t.value">
          <line class="ts__threshold" :x1="left" :x2="width - 8" :y1="yOf(t.value)" :y2="yOf(t.value)" :stroke="t.color" />
        </g>
        <g v-for="(s, i) in drawn" :key="s.name + i">
          <path v-if="fill && !bars" :d="areaPath(s)" :fill="s.color" class="ts__area" />
          <path v-if="!bars" :d="linePath(s)" :stroke="s.color" class="ts__line" />
          <template v-else>
            <rect v-for="(p, j) in s.values" :key="j" :x="xOf(p[0]) - (barW * visible.length) / 2 + barW * Math.max(0, visible.indexOf(s))" :y="yOf(Math.max(0, p[1]))"
                  :width="barW" :height="Math.max(0, yOf(0) - yOf(Math.max(0, p[1])))" :fill="s.color" />
          </template>
        </g>
        <g v-if="hover">
          <line class="ts__cursor" :x1="hover.x" :x2="hover.x" :y1="top" :y2="height - bottom" />
          <circle v-for="p in hover.points" :key="p.name" :cx="hover.x" :cy="yOf(p.value)" r="3.5" :fill="p.color" />
        </g>
        <text v-if="!hasData" class="ts__nodata" :x="width / 2" :y="height / 2" text-anchor="middle">No data</text>
      </svg>
      <div v-if="hover && hover.points.length" class="ts__tip" :style="tipStyle">
        <div class="ts__tip-time">{{ dateTimeOf(hover.t) }}</div>
        <div v-for="p in hover.points" :key="p.name" class="ts__tip-row">
          <i :style="{ background: p.color }"></i><span>{{ p.name }}</span><b>{{ fmtUnit(p.value, unit) }}</b>
        </div>
      </div>
    </div>
    <ul v-if="legend && drawn.length" class="ts__legend">
      <li v-for="(s, i) in drawn" :key="s.name + i" :class="{ 'is-off': hidden.has(s.name) }" @click="toggle(s.name)">
        <i :style="{ background: s.color }"></i>{{ s.name }}
        <span v-if="legendValues" class="ts__lv">{{ fmtUnit(last(s), unit) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * A time-series panel drawn in SVG: the shape of a Grafana "Time series" panel
 * or the Prometheus graph tab. Hover shows every series at that instant, the
 * legend toggles a series (click), thresholds draw as dashed lines.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { clockOf, dateTimeOf, fmtUnit, ticks, type PlotSeries } from './sreKit';

const props = withDefaults(defineProps<{
    series: PlotSeries[];
    unit?: string;
    height?: number;
    theme?: 'dark' | 'light';
    fill?: boolean;
    bars?: boolean;
    legend?: boolean;
    legendValues?: boolean;
    min?: number | null;
    max?: number | null;
    thresholds?: { value: number; color: string }[];
    ariaLabel?: string;
}>(), {
    unit: 'short', height: 180, theme: 'dark', fill: true, bars: false, legend: true,
    legendValues: false, min: null, max: null, thresholds: () => [], ariaLabel: 'Time series',
});

const box = ref<HTMLElement | null>(null);
const width = ref(0);
const hidden = ref(new Set<string>());
const hover = ref<null | { x: number; t: number; points: { name: string; value: number; color: string }[] }>(null);
const left = 48;
const top = 8;
const bottom = 22;
let observer: ResizeObserver | null = null;

onMounted(() => {
    const measure = () => { width.value = box.value ? box.value.clientWidth : 0; };
    measure();
    if (typeof ResizeObserver !== 'undefined' && box.value) {
        observer = new ResizeObserver(measure);
        observer.observe(box.value);
    }
});
onBeforeUnmount(() => observer?.disconnect());

const drawn = computed(() => props.series.map((s, i) => ({ ...s, color: s.color || '#73BF69', key: i })));
const visible = computed(() => drawn.value.filter(s => !hidden.value.has(s.name)));
const hasData = computed(() => visible.value.some(s => s.values.length));

const xs = computed(() => {
    const all = visible.value.flatMap(s => s.values.map(p => p[0]));
    if (!all.length) { const now = Date.now() / 1000; return [now - 3600, now]; }
    return [Math.min(...all), Math.max(...all)];
});
const ys = computed(() => {
    const all = visible.value.flatMap(s => s.values.map(p => p[1]));
    let lo = props.min ?? (all.length ? Math.min(0, ...all) : 0);
    let hi = props.max ?? (all.length ? Math.max(...all) : 1);
    for (const t of props.thresholds) hi = Math.max(hi, t.value);
    if (hi <= lo) hi = lo + (lo === 0 ? 1 : Math.abs(lo) * 0.1);
    if (props.max === null) hi = hi * 1.1;
    return [lo, hi];
});
const yTicks = computed(() => ticks(ys.value[0], ys.value[1], Math.max(2, Math.round(props.height / 45))));
const xTicks = computed(() => {
    const [a, b] = xs.value;
    const n = Math.max(2, Math.floor(width.value / 110));
    const step = (b - a) / n;
    return Array.from({ length: n + 1 }, (_v, i) => Math.round(a + i * step));
});
const thresholdLines = computed(() => props.thresholds.filter(t => Number.isFinite(t.value)));
const barW = computed(() => {
    const n = Math.max(1, ...visible.value.map(s => s.values.length));
    // Bars from several series sit side by side in one slot, never on top.
    return Math.max(1.5, (width.value - left - 8) / n * 0.75 / Math.max(1, visible.value.length));
});

function xOf(t: number) {
    const [a, b] = xs.value;
    return left + ((t - a) / Math.max(1, b - a)) * (width.value - left - 8);
}
function yOf(v: number) {
    const [lo, hi] = ys.value;
    return top + (1 - (v - lo) / (hi - lo)) * (props.height - top - bottom);
}
function linePath(s: PlotSeries) {
    return s.values.map((p, i) => (i ? 'L' : 'M') + xOf(p[0]).toFixed(1) + ',' + yOf(p[1]).toFixed(1)).join(' ');
}
function areaPath(s: PlotSeries) {
    if (!s.values.length) return '';
    const base = yOf(Math.max(ys.value[0], 0));
    return linePath(s) + ` L${xOf(s.values[s.values.length - 1][0]).toFixed(1)},${base} L${xOf(s.values[0][0]).toFixed(1)},${base} Z`;
}
function fmtAxis(v: number) {
    const text = fmtUnit(v, props.unit, Math.abs(v) < 10 && v % 1 ? 2 : 0);
    return text === 'No data' ? '' : text.replace(' req/s', '');
}
function last(s: PlotSeries) { return s.values.length ? s.values[s.values.length - 1][1] : null; }
function toggle(name: string) {
    const next = new Set(hidden.value);
    if (next.has(name)) next.delete(name); else next.add(name);
    hidden.value = next;
}
function onMove(event: MouseEvent) {
    if (!box.value || !hasData.value) return;
    const rect = box.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (x < left) { hover.value = null; return; }
    const [a, b] = xs.value;
    const t = a + ((x - left) / Math.max(1, width.value - left - 8)) * (b - a);
    const points = visible.value.map(s => {
        let best: [number, number] | null = null;
        for (const p of s.values) if (!best || Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
        return best ? { name: s.name, value: best[1], color: s.color as string, t: best[0] } : null;
    }).filter(Boolean) as { name: string; value: number; color: string; t: number }[];
    if (!points.length) { hover.value = null; return; }
    hover.value = { x: xOf(points[0].t), t: points[0].t, points: points.slice(0, 8) };
}
const tipStyle = computed(() => {
    const x = hover.value ? hover.value.x : 0;
    const flip = x > width.value * 0.6;
    return flip ? { right: (width.value - x + 12) + 'px', top: '8px' } : { left: (x + 12) + 'px', top: '8px' };
});
</script>

<style scoped>
.ts { display: flex; flex-direction: column; min-width: 0; height: 100%; }
.ts__plot { position: relative; flex: 1; min-height: 0; }
.ts--dark { --ts-grid: rgba(204, 204, 220, 0.07); --ts-axis: #8e8e8e; --ts-tip: #22252b; --ts-tip-text: #ccccdc; --ts-cursor: rgba(204, 204, 220, 0.4); }
.ts--light { --ts-grid: #e8e8e8; --ts-axis: #6b6b6b; --ts-tip: #ffffff; --ts-tip-text: #212529; --ts-cursor: #9aa0a6; }
.ts__grid line { stroke: var(--ts-grid); stroke-width: 1; }
.ts__axis text { fill: var(--ts-axis); font-size: 10.5px; font-family: inherit; }
.ts__line { fill: none; stroke-width: 1.6; stroke-linejoin: round; }
.ts__area { opacity: 0.12; }
.ts__threshold { stroke-dasharray: 4 4; stroke-width: 1; opacity: 0.8; }
.ts__cursor { stroke: var(--ts-cursor); stroke-width: 1; }
.ts__nodata { fill: var(--ts-axis); font-size: 13px; }
.ts__tip {
    position: absolute; z-index: 2; pointer-events: none; min-width: 12rem; max-width: 22rem;
    background: var(--ts-tip); color: var(--ts-tip-text); border-radius: 4px; padding: 6px 8px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35); font-size: 11.5px;
}
.ts__tip-time { opacity: 0.75; margin-bottom: 3px; }
.ts__tip-row { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.ts__tip-row i { width: 10px; height: 3px; border-radius: 1px; flex: none; }
.ts__tip-row span { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.ts__legend { list-style: none; margin: 4px 0 0; padding: 0 0 0 8px; display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 11.5px; }
.ts__legend li { display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--ts-axis); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ts__legend li i { width: 14px; height: 3px; border-radius: 1px; flex: none; }
.ts__legend li.is-off { opacity: 0.4; }
.ts__lv { font-weight: 600; margin-left: 4px; }
</style>
