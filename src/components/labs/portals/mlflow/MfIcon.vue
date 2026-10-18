<template>
  <svg class="mf-ico" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
       stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'plus'"><path d="M8 3v10M3 8h10" /></template>
    <template v-else-if="name === 'search'"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></template>
    <template v-else-if="name === 'pencil'"><path d="M10.5 2.5 13.5 5.5 6 13H3v-3z" /><path d="m9 4 3 3" /></template>
    <template v-else-if="name === 'trash'"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9" /><path d="M7 7v4M9 7v4" /></template>
    <template v-else-if="name === 'kebab'"><circle cx="8" cy="3.5" r=".9" fill="currentColor" /><circle cx="8" cy="8" r=".9" fill="currentColor" /><circle cx="8" cy="12.5" r=".9" fill="currentColor" /></template>
    <template v-else-if="name === 'check-circle'"><circle cx="8" cy="8" r="6" fill="currentColor" stroke="none" /><path d="m5.3 8.2 1.9 1.9 3.6-3.8" stroke="#fff" /></template>
    <template v-else-if="name === 'x-circle'"><circle cx="8" cy="8" r="6" fill="currentColor" stroke="none" /><path d="m5.8 5.8 4.4 4.4M10.2 5.8l-4.4 4.4" stroke="#fff" /></template>
    <template v-else-if="name === 'clock'"><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8V8l2.2 1.4" /></template>
    <template v-else-if="name === 'table'"><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M2 6.5h12M2 9.8h12M6.5 3v10" /></template>
    <template v-else-if="name === 'chart'"><path d="M2.5 13.5h11" /><path d="M3.5 11 6.5 7l2.5 2.5 4-5" /></template>
    <template v-else-if="name === 'eval'"><rect x="2" y="2.5" width="12" height="11" rx="1" /><path d="m4.5 6.5 1.2 1.2L8 5.5M4.5 10.5l1.2 1.2L8 9.5M9.5 6.5H12M9.5 10.5H12" /></template>
    <template v-else-if="name === 'traces'"><path d="M2.5 4h6M4.5 8h7M6.5 12h7" /><path d="M2.5 4v8" /></template>
    <template v-else-if="name === 'chevron-down'"><path d="m4 6 4 4 4-4" /></template>
    <template v-else-if="name === 'chevron-right'"><path d="m6 4 4 4-4 4" /></template>
    <template v-else-if="name === 'chevron-left'"><path d="m10 4-4 4 4 4" /></template>
    <template v-else-if="name === 'folder'"><path d="M2 4.5c0-.6.4-1 1-1h3l1.5 1.5H13c.6 0 1 .4 1 1V12c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z" /></template>
    <template v-else-if="name === 'file'"><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3" /></template>
    <template v-else-if="name === 'model'"><path d="M8 2 13.5 5v6L8 14 2.5 11V5z" /><path d="M2.5 5 8 8l5.5-3M8 8v6" /></template>
    <template v-else-if="name === 'close'"><path d="m4 4 8 8M12 4l-8 8" /></template>
    <template v-else-if="name === 'info'"><circle cx="8" cy="8" r="6" /><path d="M8 7.2v3.6M8 5.2v.1" /></template>
    <template v-else-if="name === 'warning'"><path d="M8 2.2 14.5 13.5h-13z" /><path d="M8 6.5v3.2M8 11.6v.1" /></template>
    <template v-else-if="name === 'columns'"><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M6 3v10M10 3v10" /></template>
    <template v-else-if="name === 'refresh'"><path d="M13 3.5v3h-3" /><path d="M12.6 6.5A5 5 0 1 0 13 9" /></template>
    <template v-else-if="name === 'external'"><path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5" /><path d="M11.5 9.5v3.5h-9v-9H6" /></template>
    <template v-else-if="name === 'github'"><path d="M6 13c-3 1-3-1.5-4-2m8 3.5v-2.4c0-.7.1-1.1-.4-1.6 1.9-.2 3.8-.9 3.8-4.1 0-.9-.3-1.6-.9-2.2.1-.3.4-1.1-.1-2.2 0 0-.7-.2-2.3.9a7.6 7.6 0 0 0-4.1 0C4.4 1.8 3.7 2 3.7 2c-.4 1.1-.2 1.9-.1 2.2-.6.6-.9 1.3-.9 2.2 0 3.2 1.9 3.9 3.8 4.1-.4.4-.5.9-.5 1.6v2.4" /></template>
    <template v-else-if="name === 'book'"><path d="M2.5 3.5c2-1 4-1 5.5.5 1.5-1.5 3.5-1.5 5.5-.5v9c-2-1-4-1-5.5.5-1.5-1.5-3.5-1.5-5.5-.5z" /><path d="M8 4v9" /></template>
    <template v-else-if="name === 'menu'"><path d="M2.5 4h11M2.5 8h11M2.5 12h11" /></template>
    <template v-else-if="name === 'eye'"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></template>
    <template v-else-if="name === 'eye-off'"><path d="M2 2l12 12M6.6 4c.5-.1.9-.2 1.4-.2 4 0 6.5 4.2 6.5 4.2a12 12 0 0 1-1.7 2.2M4.2 5.1A11 11 0 0 0 1.5 8S4 12.2 8 12.2c1.1 0 2.1-.3 3-.8" /></template>
    <template v-else-if="name === 'code'"><path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" /></template>
    <template v-else-if="name === 'laptop'"><rect x="3" y="3.5" width="10" height="7" rx="1" /><path d="M1.5 12.5h13" /></template>
    <template v-else-if="name === 'dataset'"><ellipse cx="8" cy="4" rx="5" ry="1.8" /><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8" /></template>
    <template v-else-if="name === 'server'"><rect x="2.5" y="2.5" width="11" height="4.5" rx="1" /><rect x="2.5" y="9" width="11" height="4.5" rx="1" /><path d="M5 4.8h.1M5 11.3h.1" /></template>
    <template v-else-if="name === 'sparkle'"><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" /></template>
    <template v-else-if="name === 'copy'"><rect x="5" y="5" width="8.5" height="8.5" rx="1" /><path d="M3 10.5V3.5c0-.6.4-1 1-1h6.5" /></template>
    <template v-else-if="name === 'restore'"><path d="M3 3.5v3h3" /><path d="M3.4 6.5A5 5 0 1 1 3 9" /></template>
    <template v-else-if="name === 'tag'"><path d="M2.5 2.5h5l6 6-5 5-6-6z" /><circle cx="5.3" cy="5.3" r=".8" /></template>
    <template v-else><circle cx="8" cy="8" r="2" /></template>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: string }>();
</script>

<style scoped>
.mf-ico { flex: none; display: inline-block; vertical-align: -3px; }
</style>
