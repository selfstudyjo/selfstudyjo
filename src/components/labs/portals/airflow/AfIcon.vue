<template>
  <svg v-if="name === 'logo'" class="af-ico af-ico--logo" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
    <!-- The Airflow pinwheel: four blades around a hub. -->
    <path d="M16 16 C 14 9, 15 3, 17.5 2 C 22 6, 20 12, 16 16 Z" fill="#017CEE" />
    <path d="M16 16 C 23 14, 29 15, 30 17.5 C 26 22, 20 20, 16 16 Z" fill="#00AD46" />
    <path d="M16 16 C 18 23, 17 29, 14.5 30 C 10 26, 12 20, 16 16 Z" fill="#04D659" />
    <path d="M16 16 C 9 18, 3 17, 2 14.5 C 6 10, 12 12, 16 16 Z" fill="#00C7D4" />
    <circle cx="16" cy="16" r="1.6" fill="#fff" />
  </svg>
  <svg v-else class="af-ico" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
       stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'play'"><path d="M5 3.5v9l7-4.5z" fill="currentColor" stroke="none" /></template>
    <template v-else-if="name === 'trash'"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9" /><path d="M7 7v4M9 7v4" /></template>
    <template v-else-if="name === 'refresh'"><path d="M13 3.5v3h-3" /><path d="M12.6 6.5A5 5 0 1 0 13 9" /></template>
    <template v-else-if="name === 'search'"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></template>
    <template v-else-if="name === 'caret'"><path d="m4.5 6.5 3.5 3.5 3.5-3.5" /></template>
    <template v-else-if="name === 'chevron-right'"><path d="m6 4 4 4-4 4" /></template>
    <template v-else-if="name === 'chevron-left'"><path d="m10 4-4 4 4 4" /></template>
    <template v-else-if="name === 'close'"><path d="m4 4 8 8M12 4l-8 8" /></template>
    <template v-else-if="name === 'info'"><circle cx="8" cy="8" r="6" /><path d="M8 7.2v3.6M8 5.2v.1" /></template>
    <template v-else-if="name === 'warning'"><path d="M8 2.2 14.5 13.5h-13z" /><path d="M8 6.5v3.2M8 11.6v.1" /></template>
    <template v-else-if="name === 'check'"><path d="m3.5 8.5 3 3 6-7" /></template>
    <template v-else-if="name === 'plus'"><path d="M8 3v10M3 8h10" /></template>
    <template v-else-if="name === 'edit'"><path d="M10.5 2.5 13.5 5.5 6 13H3v-3z" /></template>
    <template v-else-if="name === 'eye'"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></template>
    <template v-else-if="name === 'grid'"><rect x="2.5" y="2.5" width="4" height="4" /><rect x="9.5" y="2.5" width="4" height="4" /><rect x="2.5" y="9.5" width="4" height="4" /><rect x="9.5" y="9.5" width="4" height="4" /></template>
    <template v-else-if="name === 'graph'"><rect x="1.5" y="6" width="4" height="4" rx="1" /><rect x="10.5" y="2" width="4" height="4" rx="1" /><rect x="10.5" y="10" width="4" height="4" rx="1" /><path d="M5.5 8h2.5V4h2.5M8 8v4h2.5" /></template>
    <template v-else-if="name === 'calendar'"><rect x="2.5" y="3.5" width="11" height="10" rx="1" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></template>
    <template v-else-if="name === 'code'"><path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" /></template>
    <template v-else-if="name === 'details'"><circle cx="8" cy="8" r="6" /><path d="M8 7.2v3.6M8 5.2v.1" /></template>
    <template v-else-if="name === 'clock'"><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8V8l2.2 1.4" /></template>
    <template v-else-if="name === 'user'"><circle cx="8" cy="5.5" r="2.7" /><path d="M2.8 14c.6-2.8 2.6-4.2 5.2-4.2s4.6 1.4 5.2 4.2" /></template>
    <template v-else-if="name === 'list'"><path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.1M2.5 8h.1M2.5 12h.1" /></template>
    <template v-else-if="name === 'log'"><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3M6 8h4M6 10.5h4" /></template>
    <template v-else-if="name === 'upload'"><path d="M8 11V3M5 5.8 8 3l3 2.8M3 11.5V13h10v-1.5" /></template>
    <template v-else-if="name === 'download'"><path d="M8 3v8M5 8.2 8 11l3-2.8M3 11.5V13h10v-1.5" /></template>
    <template v-else-if="name === 'filter'"><path d="M2.5 3.5h11L9.5 8.5v4l-3 1.5V8.5z" /></template>
    <template v-else-if="name === 'terminal'"><rect x="1.5" y="2.5" width="13" height="11" rx="1" /><path d="m4 6 2 2-2 2M7.5 10.5h4" /></template>
    <template v-else-if="name === 'menu'"><path d="M2.5 4h11M2.5 8h11M2.5 12h11" /></template>
    <template v-else-if="name === 'link'"><path d="M6.5 9.5 9.5 6.5" /><path d="M7.5 4.5 9 3a2.5 2.5 0 0 1 3.5 3.5L11 8M8.5 11.5 7 13a2.5 2.5 0 0 1-3.5-3.5L5 8" /></template>
    <template v-else-if="name === 'dataset'"><ellipse cx="8" cy="4" rx="5" ry="1.8" /><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8" /></template>
    <template v-else-if="name === 'pause'"><path d="M5.5 3.5v9M10.5 3.5v9" /></template>
    <template v-else-if="name === 'copy'"><rect x="5" y="5" width="8.5" height="8.5" rx="1" /><path d="M3 10.5V3.5c0-.6.4-1 1-1h6.5" /></template>
    <template v-else-if="name === 'heart'"><path d="M8 13.5S2 9.8 2 5.8A3 3 0 0 1 8 4.4a3 3 0 0 1 6 1.4c0 4-6 7.7-6 7.7z" /></template>
    <template v-else-if="name === 'retry'"><path d="M3 3.5v3h3" /><path d="M3.4 6.5A5 5 0 1 1 3 9" /></template>
    <template v-else-if="name === 'expand'"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" /></template>
    <template v-else><circle cx="8" cy="8" r="2" /></template>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: string }>();
</script>

<style scoped>
.af-ico { flex: none; display: inline-block; vertical-align: -3px; max-width: none; }
.af-ico--logo { vertical-align: middle; }
</style>
