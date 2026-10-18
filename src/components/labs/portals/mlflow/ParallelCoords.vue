<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="mf-pc" role="img" aria-label="Parallel coordinates plot">
    <g v-for="(axis, i) in axes" :key="axis.key">
      <line :x1="ax(i)" :x2="ax(i)" :y1="T" :y2="H - B" class="mf-pc__axis" />
      <text :x="ax(i)" :y="T - 8" text-anchor="middle" class="mf-pc__name">{{ short(axis.key) }}</text>
      <text :x="ax(i) + 4" :y="T + 4" class="mf-pc__tick">{{ axis.labelHi }}</text>
      <text :x="ax(i) + 4" :y="H - B" class="mf-pc__tick">{{ axis.labelLo }}</text>
    </g>
    <polyline v-for="line in lines" :key="line.id" :points="line.points" fill="none" :stroke="line.color" stroke-width="2.5" stroke-opacity="0.85" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Row { id: string; color: string; values: Record<string, string | number | undefined> }
const props = defineProps<{ rows: Row[]; keys: string[] }>();
const W = 760; const H = 300; const L = 50; const R = 50; const T = 32; const B = 16;

const axes = computed(() => props.keys.map(key => {
  const vals = props.rows.map(r => r.values[key]).filter(v => v !== undefined && v !== '');
  const numeric = vals.length > 0 && vals.every(v => !Number.isNaN(Number(v)));
  if (numeric) {
    const nums = vals.map(Number);
    const lo = Math.min(...nums); const hi = Math.max(...nums);
    return { key, numeric, lo, hi, cats: [] as string[], labelLo: fmt(lo), labelHi: fmt(hi) };
  }
  const cats = [...new Set(vals.map(String))].sort();
  return { key, numeric, lo: 0, hi: Math.max(1, cats.length - 1), cats, labelLo: cats[0] || '', labelHi: cats[cats.length - 1] || '' };
}));
function ax(i: number) { return L + (axes.value.length <= 1 ? 0 : (i * (W - L - R)) / (axes.value.length - 1)); }
function ay(axis: typeof axes.value[number], value: string | number | undefined) {
  if (value === undefined || value === '') return null;
  const v = axis.numeric ? Number(value) : axis.cats.indexOf(String(value));
  const t = axis.hi === axis.lo ? 0.5 : (v - axis.lo) / (axis.hi - axis.lo);
  return T + (1 - t) * (H - T - B);
}
const lines = computed(() => props.rows.map(row => ({
  id: row.id, color: row.color,
  points: axes.value.map((axis, i) => {
    const y = ay(axis, row.values[axis.key]);
    return y === null ? null : `${ax(i)},${y}`;
  }).filter(Boolean).join(' '),
})));
function fmt(v: number) { return Math.abs(v) < 0.01 && v !== 0 ? v.toExponential(1) : String(Math.round(v * 1000) / 1000); }
function short(text: string) { return text.length > 18 ? text.slice(0, 17) + '…' : text; }
</script>

<style scoped>
.mf-pc { width: 100%; height: auto; display: block; min-width: 520px; }
.mf-pc__axis { stroke: #8396A5; stroke-width: 1; }
.mf-pc__name { font-size: 11px; font-weight: 600; fill: #11171C; font-family: var(--mf-font); }
.mf-pc__tick { font-size: 10px; fill: #5F7281; font-family: var(--mf-font); }
</style>
