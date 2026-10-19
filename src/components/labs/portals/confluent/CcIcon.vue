<template>
  <svg class="cc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ name: string }>();

const ICONS: Record<string, string[]> = {
  home: ['M3 11l9-8 9 8', 'M5 10v10h5v-6h4v6h5V10'],
  cluster: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M12 12l8-4.5', 'M12 12v9', 'M12 12L4 7.5'],
  brokers: ['M4 5h16v5H4z', 'M4 14h16v5H4z', 'M8 7.5h.01', 'M8 16.5h.01'],
  topics: ['M4 6h16', 'M4 12h16', 'M4 18h10'],
  connect: ['M9 7V3', 'M15 7V3', 'M7 7h10v4a5 5 0 01-10 0z', 'M12 16v5'],
  ksql: ['M8 4L4 8l4 4', 'M16 4l4 4-4 4', 'M14 2l-4 20'],
  consumers: ['M9 11a4 4 0 100-8 4 4 0 000 8z', 'M2 21v-1a6 6 0 0112 0v1', 'M16 3.5a4 4 0 010 7', 'M18 14a6 6 0 014 6v1'],
  replicators: ['M7 7h11l-3-3', 'M17 17H6l3 3'],
  settings: ['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z'],
  schema: ['M4 4h7v7H4z', 'M13 13h7v7h-7z', 'M7.5 11v5.5H13', 'M16.5 13V7.5H11'],
  plus: ['M12 5v14', 'M5 12h14'],
  search: ['M11 18a7 7 0 100-14 7 7 0 000 14z', 'M21 21l-5-5'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 12l5 5L20 7'],
  'check-circle': ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M8 12l3 3 5-6'],
  'x-circle': ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M9 9l6 6', 'M15 9l-6 6'],
  warning: ['M12 3l10 18H2z', 'M12 10v4', 'M12 17.5h.01'],
  info: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 11v6', 'M12 7.5h.01'],
  'chevron-right': ['M9 6l6 6-6 6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'chevron-left': ['M15 6l-6 6 6 6'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  pause: ['M8 5v14', 'M16 5v14'],
  play: ['M7 4l13 8-13 8z'],
  refresh: ['M20 11a8 8 0 10-2.3 5.7', 'M20 4v7h-7'],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 20h16'],
  edit: ['M4 20h4L20 8l-4-4L4 16z', 'M14 6l4 4'],
  copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  help: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M9.5 9a2.5 2.5 0 015 .5c0 2-2.5 2-2.5 4', 'M12 17.5h.01'],
  user: ['M12 12a4 4 0 100-8 4 4 0 000 8z', 'M4 21a8 8 0 0116 0'],
  bell: ['M6 16V11a6 6 0 0112 0v5l2 2H4z', 'M10 21h4'],
  send: ['M3 11l18-8-8 18-2-8z'],
  dot: ['M12 13a1 1 0 100-2 1 1 0 000 2z'],
  file: ['M6 3h8l4 4v14H6z', 'M14 3v4h4'],
  filter: ['M4 5h16l-6 8v6l-4-2v-4z'],
};

const paths = computed(() => ICONS[props.name] || ICONS.dot);
</script>

<style scoped>
.cc-ico { width: 16px; height: 16px; flex: none; display: inline-block; vertical-align: middle; }
</style>
