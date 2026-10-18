<template>
  <svg v-if="kind === 'pie'" class="amb-chart" viewBox="0 0 100 100" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true">
    <circle cx="50" cy="50" r="42" :fill="track" />
    <path v-if="pct > 0 && pct < 100" :d="slice" :fill="pieColor" />
    <circle v-else-if="pct >= 100" cx="50" cy="50" r="42" :fill="pieColor" />
  </svg>
  <svg v-else class="amb-chart" :viewBox="`0 0 ${w} ${h}`" preserveAspectRatio="none" aria-hidden="true">
    <line v-for="g in 3" :key="g" x1="0" :x2="w" :y1="(h / 4) * g" :y2="(h / 4) * g" stroke="#eee" />
    <template v-for="(line, i) in lines" :key="i">
      <path :d="line.area" :fill="colors[i % colors.length]" fill-opacity=".35" />
      <path :d="line.path" :stroke="colors[i % colors.length]" fill="none" stroke-width="1.5" />
    </template>
  </svg>
</template>

<script setup lang="ts">
/** The Rickshaw-style area charts and the pies on Ambari's dashboard. Plain SVG. */
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  kind?: 'area' | 'pie';
  series?: number[][];
  max?: number;
  value?: number;
  size?: number;
  pieColor?: string;
}>(), { kind: 'area', series: () => [], size: 90, pieColor: '#41bfae', value: 0 });

const w = 200;
const h = 60;
const colors = ['#41bfae', '#79c7e3', '#5b9bd5', '#e8bc4e', '#c4aeff'];
const track = '#e6e6e6';

const pct = computed(() => Math.max(0, Math.min(100, Number(props.value) || 0)));
const slice = computed(() => {
  const angle = (pct.value / 100) * Math.PI * 2;
  const x = 50 + 42 * Math.sin(angle);
  const y = 50 - 42 * Math.cos(angle);
  const large = pct.value > 50 ? 1 : 0;
  return `M50,50 L50,8 A42,42 0 ${large} 1 ${x.toFixed(2)},${y.toFixed(2)} Z`;
});

const lines = computed(() => {
  const all = props.series.flat();
  const top = props.max || Math.max(1, ...all) * 1.15;
  return props.series.map(points => {
    if (!points.length) return { path: '', area: '' };
    const step = points.length > 1 ? w / (points.length - 1) : w;
    const xy = points.map((p, i) => [i * step, h - (Math.max(0, p) / top) * (h - 4) - 1]);
    const path = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    return { path, area: `${path} L${w},${h} L0,${h} Z` };
  });
});
</script>

<style scoped>
.amb-chart { display: block; width: 100%; height: 100%; }
</style>
