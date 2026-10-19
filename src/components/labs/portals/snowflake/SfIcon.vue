<template>
  <svg class="sf-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-for="(d, i) in paths" :key="i" :d="d" />
    <circle v-for="(c, i) in circles" :key="'c' + i" :cx="c[0]" :cy="c[1]" :r="c[2]"
            :fill="c[3] ? 'currentColor' : 'none'" :stroke="c[3] ? 'none' : 'currentColor'" />
  </svg>
</template>

<script setup lang="ts">
/**
 * Snowsight's icon set, as inline SVG (a skin loads nothing remote). Line
 * icons on a 24px grid at 1.8 stroke, which is the weight the product's own
 * navigation icons are drawn at.
 */
import { computed } from 'vue';

const props = defineProps<{ name: string }>();

const ICONS: Record<string, { p?: string[]; c?: [number, number, number, boolean?][] }> = {
  home: { p: ['M3 11l9-7 9 7', 'M5 10v10h5v-6h4v6h5V10'] },
  plus: { p: ['M12 5v14', 'M5 12h14'] },
  folder: { p: ['M3 6.5A1.5 1.5 0 014.5 5H9l2 2h8.5A1.5 1.5 0 0121 8.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5z'] },
  projects: { p: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'] },
  worksheet: { p: ['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M9.5 13l-2 2 2 2', 'M14.5 13l2 2-2 2'] },
  database: { p: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'] },
  schema: { p: ['M3 7h18', 'M3 12h18', 'M3 17h18', 'M7 4v16'] },
  table: { p: ['M3 5h18v14H3z', 'M3 10h18', 'M3 15h18', 'M9 5v14', 'M15 5v14'] },
  view: { p: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z'], c: [[12, 12, 3]] },
  stage: { p: ['M4 7l8-4 8 4-8 4z', 'M4 12l8 4 8-4', 'M4 17l8 4 8-4'] },
  pipe: { p: ['M3 9h8v6H3z', 'M11 12h4', 'M15 7h6v10h-6z'] },
  stream: { p: ['M3 8c3 0 3-3 6-3s3 3 6 3 3-3 6-3', 'M3 14c3 0 3-3 6-3s3 3 6 3 3-3 6-3', 'M3 20c3 0 3-3 6-3s3 3 6 3 3-3 6-3'] },
  task: { p: ['M12 7v5l3 2'], c: [[12, 12, 9]] },
  policy: { p: ['M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z', 'M9 12l2 2 4-4'] },
  format: { p: ['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M9 13h6', 'M9 17h6'] },
  warehouse: { p: ['M4 5h16v5H4z', 'M4 14h16v5H4z', 'M7.5 7.5h.01', 'M7.5 16.5h.01', 'M11 7.5h5', 'M11 16.5h5'] },
  monitoring: { p: ['M3 12h4l3-7 4 14 3-7h4'] },
  history: { p: ['M3 12a9 9 0 103-6.7', 'M3 4v4h4', 'M12 7v5l3 2'] },
  admin: { p: ['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z'] },
  cost: { p: ['M12 2v20', 'M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'] },
  users: { p: ['M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2', 'M22 21v-2a4 4 0 00-3-3.9', 'M16 3.1a4 4 0 010 7.8'], c: [[9, 7, 4]] },
  user: { p: ['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2'], c: [[12, 7, 4]] },
  role: { p: ['M15 7a3 3 0 11-6 0 3 3 0 016 0z', 'M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1', 'M12 14v3'] },
  key: { p: ['M21 2l-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4'] },
  governance: { p: ['M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z'] },
  data: { p: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6'] },
  'chevron-right': { p: ['M9 6l6 6-6 6'] },
  'chevron-down': { p: ['M6 9l6 6 6-6'] },
  'chevron-left': { p: ['M15 6l-6 6 6 6'] },
  'chevron-up': { p: ['M6 15l6-6 6 6'] },
  play: { p: ['M7 4.5v15l12-7.5z'] },
  more: { c: [[5, 12, 1.4, true], [12, 12, 1.4, true], [19, 12, 1.4, true]] },
  search: { p: ['M21 21l-4.3-4.3'], c: [[11, 11, 7]] },
  close: { p: ['M6 6l12 12', 'M18 6L6 18'] },
  check: { p: ['M5 12.5l4.5 4.5L19 7'] },
  'check-circle': { p: ['M8 12.5l2.7 2.7L16 10'], c: [[12, 12, 9]] },
  'x-circle': { p: ['M9 9l6 6', 'M15 9l-6 6'], c: [[12, 12, 9]] },
  info: { p: ['M12 11v5', 'M12 8h.01'], c: [[12, 12, 9]] },
  warning: { p: ['M12 3l10 18H2z', 'M12 10v4', 'M12 17.5h.01'] },
  refresh: { p: ['M21 12a9 9 0 11-2.6-6.4', 'M21 4v5h-5'] },
  filter: { p: ['M3 5h18l-7 8v6l-4 2v-8z'] },
  copy: { p: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'] },
  trash: { p: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'] },
  edit: { p: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z'] },
  undo: { p: ['M9 14L4 9l5-5', 'M4 9h11a5 5 0 010 10h-3'] },
  clone: { p: ['M8 8h12v12H8z', 'M4 16V4h12'] },
  lock: { p: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 018 0v4'] },
  snowflake: { p: ['M12 2v20', 'M3.3 7l17.4 10', 'M3.3 17L20.7 7', 'M9.5 3.5L12 6l2.5-2.5', 'M9.5 20.5L12 18l2.5 2.5', 'M3.7 10.4l3.4-.9-.9-3.4', 'M20.3 13.6l-3.4.9.9 3.4', 'M6.2 17.9l.9-3.4-3.4-.9', 'M17.8 6.1l-.9 3.4 3.4.9'] },
  chart: { p: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'] },
  external: { p: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v6H4V6h6'] },
  pause: { p: ['M8 5v14', 'M16 5v14'] },
  stop: { p: ['M6 6h12v12H6z'] },
  menu: { p: ['M4 6h16', 'M4 12h16', 'M4 18h16'] },
  'panel-left': { p: ['M3 4h18v16H3z', 'M9 4v16'] },
  share: { p: ['M4 12v7h16v-7', 'M12 3v12', 'M7.5 7.5L12 3l4.5 4.5'] },
  sparkle: { p: ['M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z', 'M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z'] },
  lineage: { p: ['M6 6h.01', 'M18 6h.01', 'M12 18h.01', 'M6 6c0 6 6 6 6 12', 'M18 6c0 6-6 6-6 12'], c: [[6, 6, 2.5], [18, 6, 2.5], [12, 18, 2.5]] },
  help: { p: ['M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3', 'M12 17h.01'], c: [[12, 12, 9]] },
  bell: { p: ['M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 01-3.4 0'] },
  ai: { p: ['M12 2l2.4 4.9L20 8l-4 3.9.9 5.6L12 15l-4.9 2.5.9-5.6L4 8l5.6-1.1z'] },
  products: { p: ['M21 8l-9-5-9 5 9 5z', 'M3 8v8l9 5 9-5V8', 'M12 13v8'] },
  sort: { p: ['M8 4v16', 'M4 8l4-4 4 4', 'M16 20V4', 'M12 16l4 4 4-4'] },
  dot: { c: [[12, 12, 4, true]] },
  grip: { c: [[9, 6, 1.2, true], [15, 6, 1.2, true], [9, 12, 1.2, true], [15, 12, 1.2, true], [9, 18, 1.2, true], [15, 18, 1.2, true]] },
  download: { p: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 21h16'] },
  upload: { p: ['M12 21V9', 'M7 14l5-5 5 5', 'M4 3h16'] },
  graph: { p: ['M6 4h6v4H6z', 'M4 16h6v4H4z', 'M14 16h6v4h-6z', 'M9 8v4H7v4', 'M9 12h8v4'] },
  clock: { p: ['M12 7v5l3 2'], c: [[12, 12, 9]] },
  power: { p: ['M12 3v9', 'M6.4 6.4a8 8 0 1011.2 0'] },
};

const icon = computed(() => ICONS[props.name] || ICONS.dot);
const paths = computed(() => icon.value.p || []);
const circles = computed(() => icon.value.c || []);
</script>

<style scoped>
.sf-ico { width: 16px; height: 16px; flex: none; display: inline-block; vertical-align: middle; }
</style>
