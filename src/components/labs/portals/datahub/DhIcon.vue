<template>
  <svg class="dh-ico" viewBox="0 0 16 16" :width="size" :height="size" fill="none" stroke="currentColor"
       stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'search'"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></template>
    <template v-else-if="name === 'plus'"><path d="M8 3v10M3 8h10" /></template>
    <template v-else-if="name === 'close'"><path d="m4 4 8 8M12 4l-8 8" /></template>
    <template v-else-if="name === 'pencil'"><path d="M10.5 2.5 13.5 5.5 6 13H3v-3z" /><path d="m9 4 3 3" /></template>
    <template v-else-if="name === 'trash'"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9" /><path d="M7 7v4M9 7v4" /></template>
    <template v-else-if="name === 'tag'"><path d="M2.5 2.5h5l6 6-5 5-6-6z" /><circle cx="5.3" cy="5.3" r=".8" /></template>
    <template v-else-if="name === 'book'"><path d="M3 2.5h7.5a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2z" /><path d="M3 11.5a2 2 0 0 1 2-2h7.5M6 5h4" /></template>
    <template v-else-if="name === 'domain'"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></template>
    <template v-else-if="name === 'user'"><circle cx="8" cy="5.5" r="2.7" /><path d="M2.8 14c.6-2.8 2.7-4.3 5.2-4.3s4.6 1.5 5.2 4.3" /></template>
    <template v-else-if="name === 'check-circle'"><circle cx="8" cy="8" r="6.2" fill="currentColor" stroke="none" /><path d="m5.3 8.2 1.9 1.9 3.6-3.8" stroke="#fff" /></template>
    <template v-else-if="name === 'x-circle'"><circle cx="8" cy="8" r="6.2" fill="currentColor" stroke="none" /><path d="m5.8 5.8 4.4 4.4M10.2 5.8l-4.4 4.4" stroke="#fff" /></template>
    <template v-else-if="name === 'warning'"><path d="M8 2.2 14.5 13.5h-13z" fill="currentColor" stroke="none" /><path d="M8 6.5v3.2M8 11.6v.1" stroke="#fff" /></template>
    <template v-else-if="name === 'info'"><circle cx="8" cy="8" r="6.2" fill="currentColor" stroke="none" /><path d="M8 7.2v3.6M8 5.2v.1" stroke="#fff" /></template>
    <template v-else-if="name === 'chevron-down'"><path d="m4 6 4 4 4-4" /></template>
    <template v-else-if="name === 'chevron-right'"><path d="m6 4 4 4-4 4" /></template>
    <template v-else-if="name === 'chevron-left'"><path d="m10 4-4 4 4 4" /></template>
    <template v-else-if="name === 'copy'"><rect x="5" y="5" width="8.5" height="8.5" rx="1" /><path d="M3 10.5V3.5c0-.6.4-1 1-1h6.5" /></template>
    <template v-else-if="name === 'lineage'"><rect x="1.5" y="6" width="4" height="4" rx="1" /><rect x="10.5" y="2" width="4" height="4" rx="1" /><rect x="10.5" y="10" width="4" height="4" rx="1" /><path d="M5.5 8h2.5M8 4v8M8 4h2.5M8 12h2.5" /></template>
    <template v-else-if="name === 'schema'"><rect x="2" y="2.5" width="12" height="11" rx="1" /><path d="M2 6h12M6 6v7.5" /></template>
    <template v-else-if="name === 'doc'"><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3M6 8h4M6 10.5h4" /></template>
    <template v-else-if="name === 'props'"><path d="M3 4h10M3 8h10M3 12h6" /></template>
    <template v-else-if="name === 'quality'"><path d="M8 1.8 13.5 4v4c0 3.2-2.4 5.4-5.5 6.2C4.9 13.4 2.5 11.2 2.5 8V4z" /><path d="m5.6 8 1.7 1.7 3.2-3.4" /></template>
    <template v-else-if="name === 'contract'"><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3" /><path d="m6 10 1.4 1.4L10.2 8.6" /></template>
    <template v-else-if="name === 'incident'"><path d="M8 2.2 14.5 13.5h-13z" /><path d="M8 6.5v3.2M8 11.6v.1" /></template>
    <template v-else-if="name === 'pulse'"><path d="M1.5 8.5h3l1.8-4.5 3.4 8 1.8-3.5h3" /></template>
    <template v-else-if="name === 'play'"><path d="M5 3.5v9l7-4.5z" fill="currentColor" stroke="none" /></template>
    <template v-else-if="name === 'pause'"><path d="M5.5 3.5v9M10.5 3.5v9" stroke-width="2" /></template>
    <template v-else-if="name === 'refresh'"><path d="M13 3.5v3h-3" /><path d="M12.6 6.5A5 5 0 1 0 13 9" /></template>
    <template v-else-if="name === 'shield'"><path d="M8 1.8 13.5 4v4c0 3.2-2.4 5.4-5.5 6.2C4.9 13.4 2.5 11.2 2.5 8V4z" /></template>
    <template v-else-if="name === 'eraser'"><path d="m6.5 13.5-4-4 6.8-6.8 4 4z" /><path d="M6.5 13.5h7M4.8 7.2l4 4" /></template>
    <template v-else-if="name === 'plug'"><path d="M6 2v3M10 2v3M4.5 5h7v2.5a3.5 3.5 0 0 1-7 0zM8 11v3" /></template>
    <template v-else-if="name === 'zoom-in'"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3M7 5v4M5 7h4" /></template>
    <template v-else-if="name === 'zoom-out'"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3M5 7h4" /></template>
    <template v-else-if="name === 'fit'"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" /></template>
    <template v-else-if="name === 'external'"><path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5" /><path d="M11.5 9.5v3.5h-9v-9H6" /></template>
    <template v-else-if="name === 'menu'"><path d="M2.5 4h11M2.5 8h11M2.5 12h11" /></template>
    <template v-else-if="name === 'filter'"><path d="M2 3h12L9.5 8.5V13L6.5 11.5v-3z" /></template>
    <template v-else-if="name === 'help'"><circle cx="8" cy="8" r="6.2" /><path d="M6.3 6.2a1.8 1.8 0 1 1 2.5 1.7c-.5.3-.8.6-.8 1.2v.4M8 11.6v.1" /></template>
    <template v-else-if="name === 'settings'"><circle cx="8" cy="8" r="2" /><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" /></template>
    <template v-else-if="name === 'chart'"><path d="M2.5 13.5h11" /><path d="M4 11V8M7 11V5M10 11V7M13 11V3.5" /></template>
    <template v-else-if="name === 'column'"><rect x="5.5" y="2" width="5" height="12" rx="1" /></template>
    <template v-else-if="name === 'key'"><circle cx="5.5" cy="10.5" r="3" /><path d="m7.6 8.4 5.4-5.4M11 5l1.5 1.5" /></template>
    <template v-else-if="name === 'diff'"><path d="M5 2v8M2 6h6M8 13h6" /><path d="M11 3v5" /></template>
    <template v-else-if="name === 'eye'"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></template>
    <template v-else-if="name === 'lock'"><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></template>
    <template v-else-if="name === 'clock'"><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8V8l2.2 1.4" /></template>
    <template v-else-if="name === 'docs'"><path d="M2.5 3.5c2-1 4-1 5.5.5 1.5-1.5 3.5-1.5 5.5-.5v9c-2-1-4-1-5.5.5-1.5-1.5-3.5-1.5-5.5-.5z" /><path d="M8 4v9" /></template>
    <template v-else-if="name === 'more'"><circle cx="8" cy="3.5" r="1" fill="currentColor" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="8" cy="12.5" r="1" fill="currentColor" /></template>
    <template v-else-if="name === 'deprecated'"><circle cx="8" cy="8" r="6" /><path d="m3.8 3.8 8.4 8.4" /></template>
    <template v-else><circle cx="8" cy="8" r="2" /></template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 });
</script>

<style scoped>
.dh-ico { flex: none; display: inline-block; vertical-align: -3px; }
</style>
