<template>
  <svg class="cs-icon" :class="'cs-icon--' + size" viewBox="0 0 16 16" focusable="false"
       aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <template v-if="name === 'search'"><circle cx="7" cy="7" r="5" /><path d="m15 15-4.5-4.5" /></template>
    <path v-else-if="name === 'caret-down'" d="M4 6h8l-4 5z" fill="currentColor" stroke-width="1" />
    <path v-else-if="name === 'caret-right'" d="M6 4v8l5-4z" fill="currentColor" stroke-width="1" />
    <path v-else-if="name === 'caret-up'" d="M4 10h8L8 5z" fill="currentColor" stroke-width="1" />
    <path v-else-if="name === 'angle-down'" d="m2 5 6 6 6-6" />
    <path v-else-if="name === 'angle-right'" d="m5 2 6 6-6 6" />
    <path v-else-if="name === 'angle-left'" d="m11 2-6 6 6 6" />
    <path v-else-if="name === 'angle-up'" d="m2 11 6-6 6 6" />
    <path v-else-if="name === 'close'" d="m2 2 12 12M14 2 2 14" />
    <path v-else-if="name === 'menu'" d="M1 3h14M1 8h14M1 13h14" />
    <path v-else-if="name === 'add-plus'" d="M8 2v12M2 8h12" />
    <path v-else-if="name === 'remove'" d="M2 8h12" />
    <template v-else-if="name === 'refresh'"><path d="M10 5h5V0" /><path d="M14.9 5A7 7 0 1 0 15 8" /></template>
    <template v-else-if="name === 'settings'"><circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M3 13l1.5-1.5M11.5 4.5 13 3" /></template>
    <template v-else-if="name === 'notification'"><path d="M8 1a4 4 0 0 0-4 4v4l-2 3h12l-2-3V5a4 4 0 0 0-4-4z" /><path d="M6 14a2 2 0 0 0 4 0" /></template>
    <template v-else-if="name === 'support'"><circle cx="8" cy="8" r="7" /><path d="M6 6a2 2 0 1 1 2 2v1.5" /><circle cx="8" cy="12" r=".5" fill="currentColor" /></template>
    <template v-else-if="name === 'external'"><path d="M10 2h4v4M14 2 8 8" /><path d="M12 9v5H2V4h5" /></template>
    <template v-else-if="name === 'copy'"><rect x="2" y="5" width="9" height="9" rx="1" /><path d="M5 5V2h9v9h-3" /></template>
    <template v-else-if="name === 'folder'"><path d="M1 3h5l2 2h7v9H1z" /></template>
    <template v-else-if="name === 'file'"><path d="M3 1h6l4 4v10H3z" /><path d="M9 1v4h4" /></template>
    <template v-else-if="name === 'upload'"><path d="M8 11V2M4 6l4-4 4 4M2 14h12" /></template>
    <template v-else-if="name === 'download'"><path d="M8 2v9M4 7l4 4 4-4M2 14h12" /></template>
    <template v-else-if="name === 'user'"><circle cx="8" cy="5" r="3" /><path d="M2 15c0-3 3-5 6-5s6 2 6 5" /></template>
    <template v-else-if="name === 'grid'"><rect x="1" y="1" width="5" height="5" /><rect x="10" y="1" width="5" height="5" /><rect x="1" y="10" width="5" height="5" /><rect x="10" y="10" width="5" height="5" /></template>
    <template v-else-if="name === 'star'"><path d="m8 1 2.2 4.5 4.8.7-3.5 3.4.8 4.9L8 12.2l-4.3 2.3.8-4.9L1 6.2l4.8-.7z" /></template>
    <template v-else-if="name === 'cloudshell'"><rect x="1" y="2" width="14" height="12" rx="1" /><path d="m4 6 2 2-2 2M8 10h4" /></template>
    <template v-else-if="name === 'edit'"><path d="m11 1 4 4-9 9H2v-4z" /></template>
    <template v-else-if="name === 'filter'"><path d="M1 2h14L9 9v5l-2 1V9z" /></template>
    <!-- Status icons: a filled circle with a white glyph, as Cloudscape draws them -->
    <template v-else-if="name === 'status-positive'"><circle cx="8" cy="8" r="7" /><path d="m5 8 2 2 4-4" /></template>
    <template v-else-if="name === 'status-negative'"><circle cx="8" cy="8" r="7" /><path d="m5.5 5.5 5 5M10.5 5.5l-5 5" /></template>
    <template v-else-if="name === 'status-stopped'"><circle cx="8" cy="8" r="7" /><path d="M5 8h6" /></template>
    <template v-else-if="name === 'status-warning'"><path d="M8 1 15 14H1z" /><path d="M8 6v3M8 11.5v.5" /></template>
    <template v-else-if="name === 'status-info'"><circle cx="8" cy="8" r="7" /><path d="M8 7v4M8 4.5V5" /></template>
    <template v-else-if="name === 'status-pending'"><circle cx="8" cy="8" r="7" /><path d="M8 4v4l2 2" /></template>
    <template v-else-if="name === 'status-in-progress'"><circle cx="8" cy="8" r="7" /><path d="M4.5 8h.01M8 8h.01M11.5 8h.01" stroke-width="2.5" /></template>
    <template v-else-if="name === 'check'"><path d="m2 8 4 4 8-8" /></template>
    <template v-else-if="name === 'lock'"><rect x="2" y="7" width="12" height="8" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></template>
    <template v-else-if="name === 'globe'"><circle cx="8" cy="8" r="7" /><path d="M1 8h14M8 1c2 2 3 4.5 3 7s-1 5-3 7c-2-2-3-4.5-3-7s1-5 3-7z" /></template>
    <template v-else><circle cx="8" cy="8" r="6" /></template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: 'small' | 'normal' | 'medium' | 'big' }>(), {
  size: 'normal',
});
</script>

<style scoped>
.cs-icon { display: inline-block; flex: none; vertical-align: -0.2em; }
.cs-icon--small { width: 12px; height: 12px; stroke-width: 2.4; }
.cs-icon--normal { width: 16px; height: 16px; }
.cs-icon--medium { width: 20px; height: 20px; }
.cs-icon--big { width: 32px; height: 32px; }
</style>
