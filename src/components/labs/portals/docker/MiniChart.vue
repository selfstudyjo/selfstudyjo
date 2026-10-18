<template>
  <figure class="mc">
    <figcaption>
      <span>{{ label }}</span>
      <strong>{{ format(points[points.length - 1] || 0) }}</strong>
    </figcaption>
    <svg viewBox="0 0 200 60" preserveAspectRatio="none" role="img" :aria-label="`${label} over time`">
      <line v-for="y in [15, 30, 45]" :key="y" x1="0" x2="200" :y1="y" :y2="y" class="mc__grid" />
      <path :d="area" class="mc__area" />
      <path :d="line" class="mc__line" />
    </svg>
  </figure>
</template>

<script setup lang="ts">
/** A Docker Desktop resource chart: one blue series, a soft fill, three hairlines. */
import { computed } from 'vue';

const props = withDefaults(defineProps<{ label: string; points: number[]; unit?: string; max?: number }>(),
                           { unit: '', max: 100 });

const coords = computed(() => {
  const n = Math.max(1, props.points.length - 1);
  const top = props.max || 1;
  return props.points.map((v, i) => [i * 200 / n, 58 - Math.min(1, v / top) * 54]);
});
const line = computed(() => coords.value.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
const area = computed(() => coords.value.length ? `${line.value} L200,60 L0,60 Z` : '');

function format(value: number) {
  return `${value < 10 ? value.toFixed(2) : value.toFixed(1)}${props.unit === '%' ? '%' : ' ' + props.unit}`;
}
</script>

<style scoped>
.mc { margin: 0; padding: 10px 12px; border: 1px solid var(--dd-border); border-radius: 6px; display: flex; flex-direction: column; gap: 6px; }
figcaption { display: flex; justify-content: space-between; font-size: 13px; color: var(--dd-text-2); }
figcaption strong { color: var(--dd-text); font-weight: 500; }
svg { width: 100%; height: 70px; display: block; }
.mc__grid { stroke: var(--dd-border); stroke-width: 1; vector-effect: non-scaling-stroke; }
.mc__line { fill: none; stroke: var(--dd-blue); stroke-width: 2; vector-effect: non-scaling-stroke; }
.mc__area { fill: var(--dd-blue); opacity: .1; }
</style>
