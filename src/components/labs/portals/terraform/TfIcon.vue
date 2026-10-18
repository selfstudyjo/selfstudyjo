<template>
  <svg class="tf-icon" :class="{ 'tf-icon--spin': name === 'loading' }" :width="size" :height="size"
       viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'terraform'">
      <path d="M5.6 1.4l4.3 2.5v5L5.6 6.4z" fill="currentColor" stroke="none" />
      <path d="M10.6 3.9l4.3-2.5v5l-4.3 2.5z" fill="currentColor" stroke="none" opacity=".75" />
      <path d="M1.1 1.4L5.4 3.9v5L1.1 6.4zM5.6 7.1l4.3 2.5v5l-4.3-2.5z" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'hashicorp'">
      <path d="M6.6 1L1.7 3.8v8.4l1.9 1.1V5L6.6 3.3zM9.4 1v6.1H6.6V4.8l-1.9 1v7.3l1.9 1.1V9h2.8v2.3l1.9-1V3.9L9.4 1zm0 14l4.9-2.8V3.8l-1.9-1.1V11l-3 1.7z"
            fill="currentColor" stroke="none" />
    </template>
    <path v-else-if="name === 'folder'" d="M1.75 4.25c0-.83.67-1.5 1.5-1.5h3l1.5 1.75h5c.83 0 1.5.67 1.5 1.5v6.25c0 .83-.67 1.5-1.5 1.5h-9.5c-.83 0-1.5-.67-1.5-1.5z" />
    <template v-else-if="name === 'grid'">
      <rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" />
    </template>
    <template v-else-if="name === 'box'">
      <path d="M8 1.75l5.75 3v6.5L8 14.25l-5.75-3v-6.5z" /><path d="M2.25 4.75L8 7.75l5.75-3M8 7.75v6.5" />
    </template>
    <path v-else-if="name === 'chart'" d="M2 14h12M4 11V8m4 3V4m4 7V6.5" />
    <template v-else-if="name === 'settings'">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
    </template>
    <path v-else-if="name === 'chevron-down'" d="M4 6l4 4 4-4" />
    <path v-else-if="name === 'chevron-up'" d="M4 10l4-4 4 4" />
    <path v-else-if="name === 'chevron-right'" d="M6 4l4 4-4 4" />
    <path v-else-if="name === 'chevron-left'" d="M10 4L6 8l4 4" />
    <path v-else-if="name === 'arrow-left'" d="M13 8H3m4-4L3 8l4 4" />
    <path v-else-if="name === 'plus'" d="M8 3v10M3 8h10" />
    <template v-else-if="name === 'search'"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></template>
    <template v-else-if="name === 'help'">
      <circle cx="8" cy="8" r="6.25" /><path d="M6.2 6.2a1.9 1.9 0 0 1 3.6.8c0 1.3-1.8 1.5-1.8 2.6" /><path d="M8 11.6h.01" />
    </template>
    <template v-else-if="name === 'user'"><circle cx="8" cy="5.5" r="2.75" /><path d="M2.75 14c.6-2.6 2.7-4 5.25-4s4.65 1.4 5.25 4" /></template>
    <path v-else-if="name === 'menu'" d="M2 4h12M2 8h12M2 12h12" />
    <template v-else-if="name === 'check-circle'"><circle cx="8" cy="8" r="6.25" /><path d="M5.3 8.2l1.8 1.8 3.6-3.8" /></template>
    <template v-else-if="name === 'check'"><path d="M3 8.5l3 3 7-7" /></template>
    <template v-else-if="name === 'alert-circle'"><circle cx="8" cy="8" r="6.25" /><path d="M8 4.8v3.6M8 11h.01" /></template>
    <template v-else-if="name === 'alert-triangle'"><path d="M8 2L1.5 13.5h13z" /><path d="M8 6.5v3M8 11.7h.01" /></template>
    <template v-else-if="name === 'x-circle'"><circle cx="8" cy="8" r="6.25" /><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" /></template>
    <template v-else-if="name === 'skip'"><circle cx="8" cy="8" r="6.25" /><path d="M4.6 11.4l6.8-6.8" /></template>
    <template v-else-if="name === 'minus-circle'"><circle cx="8" cy="8" r="6.25" /><path d="M5 8h6" /></template>
    <template v-else-if="name === 'circle'"><circle cx="8" cy="8" r="6.25" /></template>
    <template v-else-if="name === 'clock'"><circle cx="8" cy="8" r="6.25" /><path d="M8 4.5V8l2.3 1.4" /></template>
    <template v-else-if="name === 'loading'"><path d="M8 1.75A6.25 6.25 0 1 1 1.75 8" /></template>
    <template v-else-if="name === 'lock'"><rect x="3" y="7" width="10" height="7" rx="1.25" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></template>
    <template v-else-if="name === 'unlock'"><rect x="3" y="7" width="10" height="7" rx="1.25" /><path d="M5 7V5a3 3 0 0 1 5.8-1" /></template>
    <template v-else-if="name === 'external'"><path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5" /><path d="M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" /></template>
    <path v-else-if="name === 'x'" d="M4 4l8 8M12 4l-8 8" />
    <template v-else-if="name === 'terminal'"><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" /><path d="M4.5 6l2 2-2 2M8.5 10.5h3" /></template>
    <template v-else-if="name === 'git'"><circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="6" r="1.5" /><path d="M4.5 5v6M11.5 7.5c0 2.5-3 2-6.4 3.6" /></template>
    <template v-else-if="name === 'file'"><path d="M9 1.75H4.25c-.83 0-1.5.67-1.5 1.5v9.5c0 .83.67 1.5 1.5 1.5h7.5c.83 0 1.5-.67 1.5-1.5V6z" /><path d="M9 1.75V6h4.25" /></template>
    <template v-else-if="name === 'copy'"><rect x="5.25" y="5.25" width="8.5" height="8.5" rx="1.25" /><path d="M10.75 5.25V3.5c0-.7-.55-1.25-1.25-1.25H3.5c-.7 0-1.25.55-1.25 1.25v6c0 .7.55 1.25 1.25 1.25h1.75" /></template>
    <template v-else-if="name === 'info'"><circle cx="8" cy="8" r="6.25" /><path d="M8 7.3v3.9M8 4.9h.01" /></template>
    <template v-else-if="name === 'trash'"><path d="M2.5 4.25h11M6 4.25V2.75h4v1.5M3.75 4.25l.75 9.5h7l.75-9.5" /></template>
    <template v-else-if="name === 'edit'"><path d="M10.5 2.5l3 3-8 8H2.5v-3z" /></template>
    <template v-else-if="name === 'eye'"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></template>
    <template v-else-if="name === 'eye-off'"><path d="M2 2l12 12M6.6 6.6a2 2 0 0 0 2.8 2.8M4.2 4.4C2.5 5.6 1.5 8 1.5 8S4 12.5 8 12.5c1.3 0 2.5-.5 3.5-1.1M7 3.6c.3 0 .7-.1 1-.1 4 0 6.5 4.5 6.5 4.5s-.5.9-1.3 1.9" /></template>
    <template v-else-if="name === 'more'"><circle cx="3.5" cy="8" r=".9" fill="currentColor" /><circle cx="8" cy="8" r=".9" fill="currentColor" /><circle cx="12.5" cy="8" r=".9" fill="currentColor" /></template>
    <template v-else-if="name === 'layers'"><path d="M8 1.75l6.25 3.25L8 8.25 1.75 5z" /><path d="M1.75 8L8 11.25 14.25 8M1.75 11L8 14.25 14.25 11" /></template>
    <template v-else-if="name === 'list'"><path d="M5.5 4h8.5M5.5 8h8.5M5.5 12h8.5M2 4h.01M2 8h.01M2 12h.01" /></template>
    <template v-else-if="name === 'code'"><path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" /></template>
    <template v-else-if="name === 'home'"><path d="M2 7.25L8 2.5l6 4.75V13.5c0 .4-.35.75-.75.75H10V10H6v4.25H2.75A.75.75 0 0 1 2 13.5z" /></template>
    <template v-else-if="name === 'play'"><path d="M4.5 2.75v10.5L13 8z" /></template>
    <template v-else-if="name === 'message'"><path d="M2 3.25c0-.7.55-1.25 1.25-1.25h9.5c.7 0 1.25.55 1.25 1.25v6.5c0 .7-.55 1.25-1.25 1.25H6l-3.5 3v-3h-.5z" /></template>
    <template v-else-if="name === 'dollar'"><path d="M8 1.5v13M11 4.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2.3 0 3.2 6.2 1.7 6.2 4.9 0 1.4-1.4 2.3-3.2 2.3-1.5 0-2.7-.6-3.2-1.7" /></template>
    <template v-else-if="name === 'shield'"><path d="M8 1.75l5.25 2v4c0 3.3-2.3 5.6-5.25 6.5-2.95-.9-5.25-3.2-5.25-6.5v-4z" /><path d="M5.6 8l1.7 1.7L10.6 6.4" /></template>
    <template v-else-if="name === 'refresh'"><path d="M13.5 3v3.5H10" /><path d="M13 9.5A5.25 5.25 0 1 1 12 4.6l1.5 1.9" /></template>
    <template v-else><circle cx="8" cy="8" r="2" /></template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 });
</script>

<style scoped>
.tf-icon { display: inline-block; flex: none; vertical-align: -3px; max-width: none; }
.tf-icon--spin { animation: tf-spin 0.9s linear infinite; }
@keyframes tf-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .tf-icon--spin { animation: none; } }
</style>
