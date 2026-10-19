<template>
  <svg class="dbt-ico" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
       stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'plus'"><path d="M8 3v10M3 8h10" /></template>
    <template v-else-if="name === 'search'"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></template>
    <template v-else-if="name === 'pencil'"><path d="M10.5 2.5 13.5 5.5 6 13H3v-3z" /><path d="m9 4 3 3" /></template>
    <template v-else-if="name === 'trash'"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9" /><path d="M7 7v4M9 7v4" /></template>
    <template v-else-if="name === 'ok'"><circle cx="8" cy="8" r="6.2" fill="currentColor" stroke="none" /><path d="m5.2 8.2 1.9 1.9 3.7-3.9" stroke="#fff" stroke-width="1.6" /></template>
    <template v-else-if="name === 'bad'"><circle cx="8" cy="8" r="6.2" fill="currentColor" stroke="none" /><path d="m5.8 5.8 4.4 4.4M10.2 5.8l-4.4 4.4" stroke="#fff" stroke-width="1.6" /></template>
    <template v-else-if="name === 'warn'"><path d="M8 1.8 14.8 13.8H1.2z" fill="currentColor" stroke="none" /><path d="M8 6v3.6M8 11.4v.1" stroke="#fff" stroke-width="1.6" /></template>
    <template v-else-if="name === 'skip'"><circle cx="8" cy="8" r="6" /><path d="M5 8h6" /></template>
    <template v-else-if="name === 'none'"><circle cx="8" cy="8" r="5.5" stroke-dasharray="2 2" /></template>
    <template v-else-if="name === 'clock'"><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8V8l2.2 1.4" /></template>
    <template v-else-if="name === 'code'"><path d="m5.5 4.5-3 3.5 3 3.5M10.5 4.5l3 3.5-3 3.5M9 3l-2 10" /></template>
    <template v-else-if="name === 'rocket'"><path d="M9.5 2.5c2.5 0 4 1.5 4 4L9 11 5 7z" /><path d="M5 7 3 7.5 2 10l3-.5M9 11l-.5 2L6 14l.5-3" /><circle cx="10" cy="6" r="1" /></template>
    <template v-else-if="name === 'compass'"><circle cx="8" cy="8" r="6" /><path d="m10.5 5.5-1.5 3.5-3.5 1.5 1.5-3.5z" /></template>
    <template v-else-if="name === 'history'"><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" /><path d="M2.5 2.5v2.5H5M8 5v3l2 1.5" /></template>
    <template v-else-if="name === 'jobs'"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M5 6h6M5 8.5h6M5 11h3.5" /></template>
    <template v-else-if="name === 'env'"><rect x="2" y="3" width="12" height="4" rx="1" /><rect x="2" y="9" width="12" height="4" rx="1" /><path d="M4.5 5h.1M4.5 11h.1" /></template>
    <template v-else-if="name === 'settings'"><circle cx="8" cy="8" r="2" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" /></template>
    <template v-else-if="name === 'chevron-down'"><path d="m4 6 4 4 4-4" /></template>
    <template v-else-if="name === 'chevron-right'"><path d="m6 4 4 4-4 4" /></template>
    <template v-else-if="name === 'chevron-left'"><path d="m10 4-4 4 4 4" /></template>
    <template v-else-if="name === 'folder'"><path d="M2 4.5c0-.6.4-1 1-1h3l1.5 1.5H13c.6 0 1 .4 1 1V12c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z" /></template>
    <template v-else-if="name === 'folder-open'"><path d="M2 12V4.5c0-.6.4-1 1-1h3l1.5 1.5H12c.6 0 1 .4 1 1v1" /><path d="M2 12l1.6-4.5h10.9L12.9 12z" /></template>
    <template v-else-if="name === 'file'"><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3" /></template>
    <template v-else-if="name === 'sql'"><path d="M4 2h5l3 3v9H4z" /><path d="M6 9.5h4M6 11.5h3" /></template>
    <template v-else-if="name === 'yaml'"><path d="M4 2h5l3 3v9H4z" /><path d="M6 8l1 1.5L8 8M7 9.5V12" /></template>
    <template v-else-if="name === 'model'"><path d="M8 2 13.5 5v6L8 14 2.5 11V5z" /><path d="M2.5 5 8 8l5.5-3M8 8v6" /></template>
    <template v-else-if="name === 'source'"><ellipse cx="8" cy="4" rx="5" ry="1.8" /><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" /></template>
    <template v-else-if="name === 'seed'"><path d="M8 13.5V8M8 8c0-3 2-5 5-5 0 3-2 5-5 5zM8 9.5C8 7 6.5 5.5 4 5.5 4 8 5.5 9.5 8 9.5z" /></template>
    <template v-else-if="name === 'snapshot'"><rect x="2" y="4" width="12" height="9" rx="1.5" /><circle cx="8" cy="8.5" r="2.3" /><path d="M5.5 4l1-1.5h3l1 1.5" /></template>
    <template v-else-if="name === 'test'"><path d="M6 2h4M6.5 2v4L3 13c-.3.6.1 1 .7 1h8.6c.6 0 1-.4.7-1L9.5 6V2" /><path d="M4.8 10h6.4" /></template>
    <template v-else-if="name === 'exposure'"><rect x="2" y="2.5" width="12" height="9" rx="1" /><path d="M5 14h6M8 11.5V14M5 8.5l2-2 2 1.5 2.5-3" /></template>
    <template v-else-if="name === 'close'"><path d="m4 4 8 8M12 4l-8 8" /></template>
    <template v-else-if="name === 'info'"><circle cx="8" cy="8" r="6" /><path d="M8 7.2v3.6M8 5.2v.1" /></template>
    <template v-else-if="name === 'play'"><path d="M5 3.5v9l7-4.5z" fill="currentColor" /></template>
    <template v-else-if="name === 'branch'"><circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="5.5" r="1.5" /><path d="M4.5 5v6M11.5 7c0 2.5-2.5 2.5-7 4" /></template>
    <template v-else-if="name === 'lineage'"><circle cx="3.5" cy="8" r="1.8" /><circle cx="12.5" cy="4" r="1.8" /><circle cx="12.5" cy="12" r="1.8" /><path d="M5.3 8C8 8 8 4 10.7 4M5.3 8c2.7 0 2.7 4 5.4 4" /></template>
    <template v-else-if="name === 'eye'"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></template>
    <template v-else-if="name === 'copy'"><rect x="5" y="5" width="8.5" height="8.5" rx="1" /><path d="M3 11V3h8" /></template>
    <template v-else-if="name === 'refresh'"><path d="M13 3.5v3h-3" /><path d="M12.6 6.5A5 5 0 1 0 13 9" /></template>
    <template v-else-if="name === 'book'"><path d="M2.5 3.5c2-1 4-1 5.5.5 1.5-1.5 3.5-1.5 5.5-.5v9c-2-1-4-1-5.5.5-1.5-1.5-3.5-1.5-5.5-.5z" /><path d="M8 4v9" /></template>
    <template v-else-if="name === 'menu'"><path d="M2.5 4h11M2.5 8h11M2.5 12h11" /></template>
    <template v-else-if="name === 'terminal'"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" /><path d="m4 6 2 2-2 2M7.5 10.5h4" /></template>
    <template v-else-if="name === 'hammer'"><path d="M9 3.5 12.5 7M7 5.5l4 4M2.5 13.5 8 8" /><path d="M8.5 2.5l1.5-1 4.5 4.5-1 1.5" /></template>
    <template v-else-if="name === 'calendar'"><rect x="2" y="3" width="12" height="11" rx="1" /><path d="M2 6.5h12M5 1.5v3M11 1.5v3" /></template>
    <template v-else-if="name === 'user'"><circle cx="8" cy="5.5" r="2.7" /><path d="M2.5 14c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" /></template>
    <template v-else-if="name === 'help'"><circle cx="8" cy="8" r="6" /><path d="M6.3 6.2c0-1 .8-1.7 1.8-1.7s1.7.6 1.7 1.5c0 1.3-1.8 1.4-1.8 2.8M8 11.2v.1" /></template>
    <template v-else-if="name === 'lock'"><rect x="3.5" y="7" width="9" height="6.5" rx="1" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></template>
    <template v-else-if="name === 'zoom-in'"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3M5 7h4M7 5v4" /></template>
    <template v-else-if="name === 'zoom-out'"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3M5 7h4" /></template>
    <template v-else-if="name === 'fit'"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" /></template>
    <template v-else><circle cx="8" cy="8" r="2" /></template>
  </svg>
</template>

<script setup lang="ts">
/** The dbt Cloud icon set, inline SVG (no icon font, no network). */
defineProps<{ name: string }>();
</script>

<style scoped>
.dbt-ico { width: 1em; height: 1em; flex: none; display: inline-block; vertical-align: -0.125em; }
</style>
