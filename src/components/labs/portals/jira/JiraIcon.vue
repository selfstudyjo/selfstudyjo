<template>
  <!-- Issue types: Jira's 16px rounded-square glyphs, in their own colours. -->
  <svg v-if="kind === 'type'" class="ji" :width="size" :height="size" viewBox="0 0 16 16"
       aria-hidden="true" focusable="false">
    <template v-if="name === 'story'">
      <rect width="16" height="16" rx="3" fill="#63BA3C" />
      <path d="M5 4h6v8.2L8 10.3 5 12.2z" fill="#fff" />
    </template>
    <template v-else-if="name === 'task'">
      <rect width="16" height="16" rx="3" fill="#4BADE8" />
      <path d="M4.5 8.2l2.3 2.3 4.7-5" fill="none" stroke="#fff" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'bug'">
      <rect width="16" height="16" rx="3" fill="#E5493A" />
      <circle cx="8" cy="8" r="3.4" fill="#fff" />
    </template>
    <template v-else-if="name === 'epic'">
      <rect width="16" height="16" rx="3" fill="#904EE2" />
      <path d="M9 3L5 9h3l-1 4 4-6H8z" fill="#fff" />
    </template>
    <template v-else-if="name === 'risk'">
      <rect width="16" height="16" rx="3" fill="#E2B203" />
      <path d="M8 3.5l4.5 8h-9z" fill="#fff" />
      <path d="M8 6.6v2.3M8 10.1v.3" stroke="#B38600" stroke-width="1.3" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'issue'">
      <rect width="16" height="16" rx="3" fill="#F87168" />
      <path d="M8 4v5M8 11v.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'assumption'">
      <rect width="16" height="16" rx="3" fill="#6CC3E0" />
      <path d="M6.2 6.2a1.9 1.9 0 113 1.5c-.8.5-1.2.9-1.2 1.8M8 11.4v.2" fill="none"
            stroke="#fff" stroke-width="1.6" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'dependency'">
      <rect width="16" height="16" rx="3" fill="#8F7EE7" />
      <circle cx="5.5" cy="8" r="1.8" fill="#fff" /><circle cx="10.5" cy="8" r="1.8" fill="#fff" />
      <path d="M7 8h2" stroke="#fff" stroke-width="1.4" />
    </template>
    <template v-else-if="name === 'incident'">
      <rect width="16" height="16" rx="3" fill="#C9372C" />
      <path d="M4.5 11.5h7M5.5 11.5V8a2.5 2.5 0 015 0v3.5" fill="none" stroke="#fff"
            stroke-width="1.5" stroke-linecap="round" />
      <path d="M8 3v1" stroke="#fff" stroke-width="1.5" stroke-linecap="round" />
    </template>
    <template v-else>
      <rect width="16" height="16" rx="3" fill="#4BADE8" />
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" fill="#fff" />
    </template>
  </svg>

  <!-- Priorities: the arrow glyphs Jira draws beside an issue. -->
  <svg v-else-if="kind === 'priority'" class="ji" :width="size" :height="size" viewBox="0 0 16 16"
       aria-hidden="true" focusable="false">
    <template v-if="name === 'high'">
      <path d="M3.5 10l4.5-4.5 4.5 4.5" fill="none" stroke="#E2483D" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'low'">
      <path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="#1868DB" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else>
      <path d="M3.5 6.2h9M3.5 9.8h9" stroke="#E2B203" stroke-width="2" stroke-linecap="round" />
    </template>
  </svg>

  <!-- Interface glyphs: 16px line icons in currentColor. -->
  <svg v-else class="ji" :width="size" :height="size" viewBox="0 0 16 16" fill="none"
       stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true" focusable="false">
    <template v-if="name === 'apps'">
      <g fill="currentColor" stroke="none">
        <rect x="2" y="2" width="3" height="3" rx=".6" /><rect x="6.5" y="2" width="3" height="3" rx=".6" />
        <rect x="11" y="2" width="3" height="3" rx=".6" /><rect x="2" y="6.5" width="3" height="3" rx=".6" />
        <rect x="6.5" y="6.5" width="3" height="3" rx=".6" /><rect x="11" y="6.5" width="3" height="3" rx=".6" />
        <rect x="2" y="11" width="3" height="3" rx=".6" /><rect x="6.5" y="11" width="3" height="3" rx=".6" />
        <rect x="11" y="11" width="3" height="3" rx=".6" />
      </g>
    </template>
    <path v-else-if="name === 'chevron-down'" d="M4 6l4 4 4-4" />
    <path v-else-if="name === 'chevron-up'" d="M4 10l4-4 4 4" />
    <path v-else-if="name === 'chevron-right'" d="M6 4l4 4-4 4" />
    <path v-else-if="name === 'chevron-left'" d="M10 4L6 8l4 4" />
    <template v-else-if="name === 'search'"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></template>
    <template v-else-if="name === 'bell'">
      <path d="M4 11V7a4 4 0 018 0v4l1 1.5H3z" /><path d="M6.5 14h3" />
    </template>
    <template v-else-if="name === 'help'">
      <circle cx="8" cy="8" r="6.2" /><path d="M6.3 6.2a1.8 1.8 0 113 1.4c-.8.5-1.3.9-1.3 1.8" /><path d="M8 11.4v.1" />
    </template>
    <template v-else-if="name === 'gear'">
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" />
    </template>
    <path v-else-if="name === 'plus'" d="M8 3v10M3 8h10" />
    <template v-else-if="name === 'more'">
      <g fill="currentColor" stroke="none"><circle cx="3.5" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="12.5" cy="8" r="1.3" /></g>
    </template>
    <path v-else-if="name === 'close'" d="M4 4l8 8M12 4l-8 8" />
    <path v-else-if="name === 'menu'" d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    <template v-else-if="name === 'timeline'"><path d="M2.5 4h6M5 8h7M3.5 12h5" /></template>
    <template v-else-if="name === 'backlog'"><path d="M2.5 3.5h11M2.5 7h11M2.5 10.5h11M2.5 14h6" /></template>
    <template v-else-if="name === 'board'"><rect x="2" y="2.5" width="12" height="11" rx="1.5" /><path d="M6 2.5v11M10 2.5v11" /></template>
    <template v-else-if="name === 'goals'"><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="3.2" /><circle cx="8" cy="8" r=".6" fill="currentColor" /></template>
    <template v-else-if="name === 'reports'"><path d="M2.5 13.5h11" /><path d="M4.5 11V8M8 11V4.5M11.5 11V6.5" /></template>
    <template v-else-if="name === 'shield'"><path d="M8 1.8l5 2v3.9c0 3.2-2.2 5.6-5 6.6-2.8-1-5-3.4-5-6.6V3.8z" /><path d="M8 5.5v3M8 10.5v.1" /></template>
    <template v-else-if="name === 'siren'"><path d="M3 13h10M4.5 13V8.5a3.5 3.5 0 017 0V13" /><path d="M8 2v1.3M2.6 4.2l.9.9M13.4 4.2l-.9.9" /></template>
    <template v-else-if="name === 'people'"><circle cx="6" cy="5.5" r="2.3" /><path d="M2 13.5c.4-2.4 2-3.8 4-3.8s3.6 1.4 4 3.8" /><path d="M10.5 3.6a2.2 2.2 0 010 4M12 9.9c1.1.5 1.8 1.8 2 3.6" /></template>
    <template v-else-if="name === 'team'"><circle cx="8" cy="5" r="2.4" /><path d="M3.5 13.5c.5-2.6 2.3-4 4.5-4s4 1.4 4.5 4" /></template>
    <path v-else-if="name === 'check'" d="M3.5 8.5l3 3 6-7" />
    <template v-else-if="name === 'link'"><path d="M6.8 9.2a2.6 2.6 0 003.7 0l2-2a2.6 2.6 0 00-3.7-3.7l-.8.8" /><path d="M9.2 6.8a2.6 2.6 0 00-3.7 0l-2 2a2.6 2.6 0 003.7 3.7l.8-.8" /></template>
    <path v-else-if="name === 'attach'" d="M10.5 5.5l-4.3 4.3a1.3 1.3 0 001.8 1.8l4.7-4.7a2.6 2.6 0 00-3.7-3.7L4.3 7.9a3.9 3.9 0 005.5 5.5l3.2-3.2" />
    <template v-else-if="name === 'eye'"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></template>
    <template v-else-if="name === 'share'"><circle cx="12" cy="3.8" r="1.8" /><circle cx="4" cy="8" r="1.8" /><circle cx="12" cy="12.2" r="1.8" /><path d="M5.6 7.1l4.8-2.4M5.6 8.9l4.8 2.4" /></template>
    <template v-else-if="name === 'like'"><path d="M5 7l2.5-4.5c1 0 1.6.8 1.4 1.8L8.5 6.5h4a1 1 0 011 1.2l-1 5a1 1 0 01-1 .8H5z" /><path d="M2.5 7H5v6.5H2.5z" /></template>
    <template v-else-if="name === 'filter'"><path d="M2.5 3.5h11l-4.3 5v4.5l-2.4-1.3V8.5z" /></template>
    <template v-else-if="name === 'calendar'"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></template>
    <template v-else-if="name === 'star'"><path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4-2.9-2.8 4-.6z" /></template>
    <template v-else-if="name === 'info'"><circle cx="8" cy="8" r="6.2" /><path d="M8 7.2v4M8 4.9v.1" /></template>
    <template v-else-if="name === 'warning'"><path d="M8 2l6.5 11.5h-13z" /><path d="M8 6.5v3.2M8 11.6v.1" /></template>
    <template v-else-if="name === 'error'"><circle cx="8" cy="8" r="6.2" /><path d="M6 6l4 4M10 6l-4 4" /></template>
    <template v-else-if="name === 'success'"><circle cx="8" cy="8" r="6.2" /><path d="M5.3 8.2l1.9 1.9 3.6-4" /></template>
    <template v-else-if="name === 'drag'"><g fill="currentColor" stroke="none"><circle cx="6" cy="4" r="1" /><circle cx="10" cy="4" r="1" /><circle cx="6" cy="8" r="1" /><circle cx="10" cy="8" r="1" /><circle cx="6" cy="12" r="1" /><circle cx="10" cy="12" r="1" /></g></template>
    <template v-else-if="name === 'pencil'"><path d="M10.5 2.5l3 3-8 8H2.5v-3z" /></template>
    <template v-else-if="name === 'trash'"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9" /></template>
    <template v-else-if="name === 'clock'"><circle cx="8" cy="8" r="6" /><path d="M8 4.8V8l2.2 1.4" /></template>
    <template v-else-if="name === 'external'"><path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v3.5h-9v-9H6" /></template>
    <template v-else-if="name === 'project'"><rect x="2" y="2" width="12" height="12" rx="2" /></template>
    <template v-else-if="name === 'code'"><path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" /></template>
    <template v-else-if="name === 'grid'"><rect x="2.5" y="2.5" width="11" height="11" rx="1" /><path d="M2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11" /></template>
    <template v-else><circle cx="8" cy="8" r="5" /></template>
  </svg>
</template>

<script setup lang="ts">
/** Every glyph the skin draws, inline SVG (no icon font, no network). */
withDefaults(defineProps<{ name: string; kind?: 'ui' | 'type' | 'priority'; size?: number }>(),
             { kind: 'ui', size: 16 });
</script>

<style scoped>
.ji { display: inline-block; flex: none; vertical-align: middle; }
</style>
