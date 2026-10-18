<template>
  <svg class="dd-icon" :width="size" :height="size" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true">
    <template v-if="name === 'whale'">
      <path fill="currentColor" stroke="none"
            d="M22.6 10.3c-.5-.3-1.6-.5-2.5-.3-.1-.9-.6-1.7-1.5-2.4l-.5-.3-.3.5c-.4.6-.6 1.5-.5 2.3 0 .3.1.8.4 1.2-.3.2-.9.4-1.7.4H1.4l-.1.5c-.1 1.6.1 3.6 1.4 5.2 1 1.2 2.6 1.9 4.6 1.9 4.4 0 7.6-2 9.1-5.7.6 0 1.9 0 2.6-1.3l.2-.3-.6-.3zM4.3 9.2h2v1.9h-2zm2.6 0h2v1.9h-2zm2.6 0h2v1.9h-2zm2.6 0h2v1.9h-2zm-5.2-2.5h2v1.9h-2zm2.6 0h2v1.9h-2zm2.6 0h2v1.9h-2zm0-2.5h2v1.9h-2zm2.6 5h2v1.9h-2z" />
    </template>
    <template v-else-if="name === 'containers' || name === 'cube'">
      <path d="M12 2.8 20 7.2v9.6l-8 4.4-8-4.4V7.2z" /><path d="M4 7.2l8 4.4 8-4.4M12 11.6v9.6" />
    </template>
    <template v-else-if="name === 'images'">
      <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v5M16 4v5" />
    </template>
    <template v-else-if="name === 'volumes'">
      <ellipse cx="12" cy="5.5" rx="8" ry="2.8" /><path d="M4 5.5v13c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8v-13M4 12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8" />
    </template>
    <template v-else-if="name === 'builds'">
      <path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3.5 17.5l3 3 5.7-5.7a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.6-.4-.4-2.6z" />
    </template>
    <template v-else-if="name === 'scout'">
      <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
    </template>
    <template v-else-if="name === 'extensions'">
      <path d="M9 3h6v4.5a1.5 1.5 0 0 0 3 0V7h3v6h-1.5a1.5 1.5 0 0 0 0 3H21v5H3V7h4.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </template>
    <template v-else-if="name === 'networks'">
      <circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="18" r="2.5" /><circle cx="19" cy="18" r="2.5" /><path d="M12 7.5v4M12 11.5l-5.5 4.5M12 11.5l5.5 4.5" />
    </template>
    <template v-else-if="name === 'hub'">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </template>
    <template v-else-if="name === 'search'"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></template>
    <template v-else-if="name === 'gear'">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </template>
    <template v-else-if="name === 'user'"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></template>
    <template v-else-if="name === 'cap'"><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6" /></template>
    <template v-else-if="name === 'sparkle'"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></template>
    <template v-else-if="name === 'play'"><path fill="currentColor" stroke="none" d="M7 4.5v15l12.5-7.5z" /></template>
    <template v-else-if="name === 'stop'"><rect fill="currentColor" stroke="none" x="5.5" y="5.5" width="13" height="13" rx="1.5" /></template>
    <template v-else-if="name === 'pause'"><rect fill="currentColor" stroke="none" x="6" y="5" width="4" height="14" rx="1" /><rect fill="currentColor" stroke="none" x="14" y="5" width="4" height="14" rx="1" /></template>
    <template v-else-if="name === 'restart'"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></template>
    <template v-else-if="name === 'trash'"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" /></template>
    <template v-else-if="name === 'dots'"><circle fill="currentColor" stroke="none" cx="12" cy="5" r="1.8" /><circle fill="currentColor" stroke="none" cx="12" cy="12" r="1.8" /><circle fill="currentColor" stroke="none" cx="12" cy="19" r="1.8" /></template>
    <template v-else-if="name === 'back'"><path d="M15 5l-7 7 7 7" /></template>
    <template v-else-if="name === 'chevron-right'"><path d="M9 5l7 7-7 7" /></template>
    <template v-else-if="name === 'chevron-down'"><path d="M5 9l7 7 7-7" /></template>
    <template v-else-if="name === 'copy'"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></template>
    <template v-else-if="name === 'external'"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></template>
    <template v-else-if="name === 'plus'"><path d="M12 5v14M5 12h14" /></template>
    <template v-else-if="name === 'minus'"><path d="M5 12h14" /></template>
    <template v-else-if="name === 'close'"><path d="M6 6l12 12M18 6 6 18" /></template>
    <template v-else-if="name === 'check'"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></template>
    <template v-else-if="name === 'error'"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.1" /></template>
    <template v-else-if="name === 'info'"><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5v.1" /></template>
    <template v-else-if="name === 'warning'"><path d="M12 3 2 20h20zM12 10v4.5M12 17.5v.1" /></template>
    <template v-else-if="name === 'terminal'"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M12 15h5" /></template>
    <template v-else-if="name === 'refresh'"><path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5" /></template>
    <template v-else-if="name === 'feedback'"><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></template>
    <template v-else-if="name === 'filter'"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" /></template>
    <template v-else-if="name === 'columns'"><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M9 4v16M15 4v16" /></template>
    <template v-else-if="name === 'stack'"><path d="M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5" /></template>
    <template v-else-if="name === 'menu'"><path d="M4 6h16M4 12h16M4 18h16" /></template>
    <template v-else-if="name === 'file'"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5" /></template>
    <template v-else-if="name === 'folder'"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></template>
    <template v-else-if="name === 'download'"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></template>
    <template v-else-if="name === 'bug'"><rect x="7" y="7" width="10" height="13" rx="5" /><path d="M12 7v13M3 13h4M17 13h4M5 8l2.5 2M19 8l-2.5 2M5 19l2.5-2M19 19l-2.5-2M9 4l1.5 2M15 4l-1.5 2" /></template>
    <template v-else-if="name === 'bell'"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20.5a2 2 0 0 0 4 0" /></template>
    <template v-else-if="name === 'clock'"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></template>
    <template v-else><circle cx="12" cy="12" r="8" /></template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number | string }>(), { size: 16 });
</script>

<style scoped>
.dd-icon { flex: none; display: inline-block; vertical-align: middle; }
</style>
