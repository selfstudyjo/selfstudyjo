<template>
  <svg :width="size" :height="size" viewBox="0 0 48 48" aria-hidden="true" focusable="false" class="pg-plan-ico">
    <rect x="2" y="2" width="44" height="44" rx="6" :fill="tone.bg" :stroke="tone.fg" stroke-width="1.5" />
    <template v-if="name === 'seq-scan'">
      <rect x="10" y="11" width="28" height="26" rx="2" fill="#fff" :stroke="tone.fg" stroke-width="1.5" />
      <path d="M10 18h28M10 24.5h28M10 31h28" :stroke="tone.fg" stroke-width="1.2" />
      <path d="M6 24.5h33m-5-4l5 4-5 4" fill="none" stroke="#e45d39" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'index-scan' || name === 'index-only' || name === 'bitmap-index'">
      <rect x="9" y="10" width="22" height="28" rx="2" fill="#fff" :stroke="tone.fg" stroke-width="1.5" />
      <path d="M13 17h14M13 23h10M13 29h14" :stroke="tone.fg" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="31" cy="30" r="6" fill="#fff" stroke="#e45d39" stroke-width="2" /><path d="M35.5 34.5L40 39" stroke="#e45d39" stroke-width="2.4" stroke-linecap="round" />
      <text v-if="name === 'index-only'" x="38" y="15" text-anchor="middle" font-size="9" font-weight="700" :fill="tone.fg" font-family="Arial">IO</text>
      <text v-if="name === 'bitmap-index'" x="38" y="15" text-anchor="middle" font-size="9" font-weight="700" :fill="tone.fg" font-family="Arial">01</text>
    </template>
    <template v-else-if="name === 'bitmap-heap'">
      <rect x="10" y="11" width="28" height="26" rx="2" fill="#fff" :stroke="tone.fg" stroke-width="1.5" />
      <text x="24" y="29" text-anchor="middle" font-size="12" font-weight="700" :fill="tone.fg" font-family="monospace">0101</text>
    </template>
    <template v-else-if="name === 'hash' || name === 'hash-join'">
      <text x="24" y="33" text-anchor="middle" font-size="24" font-weight="700" :fill="tone.fg" font-family="Arial">#</text>
      <path v-if="name === 'hash-join'" d="M8 14l8 6M8 34l8-6" :stroke="tone.fg" stroke-width="2" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'nested'">
      <path d="M14 24a10 10 0 1 1 10 10" fill="none" :stroke="tone.fg" stroke-width="2.4" stroke-linecap="round" />
      <path d="M24 34l-5-3.5 5-3.5" fill="none" :stroke="tone.fg" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="24" cy="24" r="3" :fill="tone.fg" />
    </template>
    <template v-else-if="name === 'merge-join'">
      <path d="M9 14h10l10 10h10M9 34h10l10-10" fill="none" :stroke="tone.fg" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'sort'">
      <path d="M14 12v24m-5-5l5 5 5-5" fill="none" :stroke="tone.fg" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M25 14h14M25 21h11M25 28h8M25 35h5" :stroke="tone.fg" stroke-width="2.2" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'aggregate' || name === 'window'">
      <text x="24" y="34" text-anchor="middle" font-size="26" font-weight="700" :fill="tone.fg" font-family="Georgia, serif">Σ</text>
      <rect v-if="name === 'window'" x="31" y="9" width="9" height="9" fill="none" :stroke="tone.fg" stroke-width="1.6" />
    </template>
    <template v-else-if="name === 'limit'">
      <path d="M10 24h20" :stroke="tone.fg" stroke-width="2.4" stroke-linecap="round" />
      <path d="M34 13v22" stroke="#e45d39" stroke-width="3" stroke-linecap="round" />
      <path d="M24 18l6 6-6 6" fill="none" :stroke="tone.fg" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'materialize' || name === 'cte' || name === 'subquery'">
      <rect x="11" y="13" width="26" height="22" rx="3" fill="#fff" :stroke="tone.fg" stroke-width="1.6" />
      <text x="24" y="28" text-anchor="middle" font-size="10" font-weight="700" :fill="tone.fg" font-family="Arial">{{ name === 'cte' ? 'CTE' : name === 'subquery' ? 'SUB' : 'MAT' }}</text>
    </template>
    <template v-else-if="name === 'unique'">
      <text x="24" y="31" text-anchor="middle" font-size="18" font-weight="700" :fill="tone.fg" font-family="Arial">1!</text>
    </template>
    <template v-else-if="name === 'append' || name === 'gather'">
      <path d="M10 14h14M10 24h14M10 34h14M24 14l10 10-10 10M34 24h6" fill="none" :stroke="tone.fg" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'modify'">
      <path d="M13 34l3-9 15-15 6 6-15 15z" fill="#fff" :stroke="tone.fg" stroke-width="2" stroke-linejoin="round" />
    </template>
    <template v-else>
      <path d="M14 25l7 7 13-15" fill="none" :stroke="tone.fg" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </template>
  </svg>
</template>

<script setup lang="ts">
/** The graphical EXPLAIN's node images (pgAdmin's ex_*.svg family), drawn inline. */
import { computed } from 'vue';

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 48 });

const TONES: Record<string, { bg: string; fg: string }> = {
  scan: { bg: '#e6eefc', fg: '#2f5597' },
  join: { bg: '#fff1d6', fg: '#a86a00' },
  agg: { bg: '#e7f5ea', fg: '#2e7d32' },
  misc: { bg: '#f1ecf9', fg: '#6a4c9c' },
};
const tone = computed<{ bg: string; fg: string }>(() => {
  const n = props.name;
  if (/scan|index|bitmap/.test(n)) return TONES.scan!;
  if (/join|nested|hash/.test(n)) return TONES.join!;
  if (/aggregate|window|sort|unique/.test(n)) return TONES.agg!;
  return TONES.misc!;
});
</script>

<style scoped>
.pg-plan-ico { display: block; }
</style>
