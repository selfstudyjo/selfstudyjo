<template>
  <svg class="amb-ico" viewBox="0 0 16 16" :width="size" :height="size" aria-hidden="true"
       fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <template v-if="name === 'dashboard'">
      <rect x="1.5" y="1.5" width="5.5" height="6" rx=".5" /><rect x="9" y="1.5" width="5.5" height="3.5" rx=".5" />
      <rect x="9" y="7" width="5.5" height="7.5" rx=".5" /><rect x="1.5" y="9.5" width="5.5" height="5" rx=".5" />
    </template>
    <template v-else-if="name === 'services'">
      <path d="M8 1.5 14 4.5 8 7.5 2 4.5Z" /><path d="M2 8 8 11 14 8" /><path d="M2 11.3 8 14.3 14 11.3" />
    </template>
    <template v-else-if="name === 'hosts'">
      <rect x="2" y="2" width="12" height="4.5" rx=".8" /><rect x="2" y="9.5" width="12" height="4.5" rx=".8" />
      <circle cx="4.6" cy="4.25" r=".5" fill="currentColor" /><circle cx="4.6" cy="11.75" r=".5" fill="currentColor" />
    </template>
    <template v-else-if="name === 'alerts'">
      <path d="M4 11V7a4 4 0 0 1 8 0v4l1.3 1.5H2.7Z" /><path d="M6.5 14a1.6 1.6 0 0 0 3 0" />
    </template>
    <template v-else-if="name === 'admin'">
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </template>
    <template v-else-if="name === 'ok'">
      <circle cx="8" cy="8" r="7" fill="currentColor" stroke="none" />
      <path d="M4.8 8.2 7 10.3l4.3-4.6" stroke="#fff" stroke-width="1.8" />
    </template>
    <template v-else-if="name === 'down'">
      <circle cx="8" cy="8" r="7" fill="currentColor" stroke="none" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff" stroke-width="1.8" />
    </template>
    <template v-else-if="name === 'warn'">
      <path d="M8 1.6 15 14H1Z" fill="currentColor" stroke="none" />
      <path d="M8 6v4" stroke="#fff" stroke-width="1.6" /><circle cx="8" cy="12" r=".6" fill="#fff" stroke="none" />
    </template>
    <template v-else-if="name === 'maint'">
      <circle cx="8" cy="8" r="7" fill="currentColor" stroke="none" />
      <path d="M4.5 8h7" stroke="#fff" stroke-width="2" />
    </template>
    <template v-else-if="name === 'restart-ind'">
      <path d="M13.5 8A5.5 5.5 0 1 1 11.6 3.9" stroke-width="2" /><path d="M12.4 1.5v3h-3" stroke-width="2" />
    </template>
    <template v-else-if="name === 'caret'"><path d="M4 6l4 4 4-4" /></template>
    <template v-else-if="name === 'chev-right'"><path d="M6 3.5 10.5 8 6 12.5" /></template>
    <template v-else-if="name === 'chev-left'"><path d="M10 3.5 5.5 8 10 12.5" /></template>
    <template v-else-if="name === 'grid'">
      <g fill="currentColor" stroke="none">
        <rect x="1.5" y="1.5" width="3.4" height="3.4" /><rect x="6.3" y="1.5" width="3.4" height="3.4" /><rect x="11.1" y="1.5" width="3.4" height="3.4" />
        <rect x="1.5" y="6.3" width="3.4" height="3.4" /><rect x="6.3" y="6.3" width="3.4" height="3.4" /><rect x="11.1" y="6.3" width="3.4" height="3.4" />
        <rect x="1.5" y="11.1" width="3.4" height="3.4" /><rect x="6.3" y="11.1" width="3.4" height="3.4" /><rect x="11.1" y="11.1" width="3.4" height="3.4" />
      </g>
    </template>
    <template v-else-if="name === 'user'"><circle cx="8" cy="5.2" r="3" /><path d="M2.5 14.5a5.5 5.5 0 0 1 11 0" /></template>
    <template v-else-if="name === 'folder'">
      <path d="M1.5 3.5h4.5l1.5 1.7h7v8.3h-13Z" fill="currentColor" fill-opacity=".18" />
    </template>
    <template v-else-if="name === 'file'"><path d="M3.5 1.5h6l3 3v10h-9Z" /><path d="M9.5 1.5v3h3" /></template>
    <template v-else-if="name === 'upload'"><path d="M8 11V2.5M4.8 5.7 8 2.5l3.2 3.2" /><path d="M2 11v3h12v-3" /></template>
    <template v-else-if="name === 'download'"><path d="M8 2.5V11M4.8 7.8 8 11l3.2-3.2" /><path d="M2 11v3h12v-3" /></template>
    <template v-else-if="name === 'plus'"><path d="M8 3v10M3 8h10" /></template>
    <template v-else-if="name === 'trash'"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.8 10h6.4L12 4" /></template>
    <template v-else-if="name === 'edit'"><path d="M10.5 2.5l3 3-8 8H2.5v-3Z" /></template>
    <template v-else-if="name === 'copy'"><rect x="5" y="5" width="9" height="9" rx="1" /><path d="M11 5V2H2v9h3" /></template>
    <template v-else-if="name === 'move'"><path d="M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2" /></template>
    <template v-else-if="name === 'lock'"><rect x="3" y="7" width="10" height="7.5" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></template>
    <template v-else-if="name === 'refresh'"><path d="M13.5 8A5.5 5.5 0 1 1 11.6 3.9" /><path d="M12.4 1.5v3h-3" /></template>
    <template v-else-if="name === 'search'"><circle cx="7" cy="7" r="4.5" /><path d="M10.4 10.4 14 14" /></template>
    <template v-else-if="name === 'play'"><path d="M4.5 2.5v11l9-5.5Z" fill="currentColor" stroke="none" /></template>
    <template v-else-if="name === 'stop'"><rect x="3.5" y="3.5" width="9" height="9" fill="currentColor" stroke="none" /></template>
    <template v-else-if="name === 'wrench'"><path d="M10.5 1.8a3.5 3.5 0 0 0-3.9 4.7L2 11.1 4.9 14l4.6-4.6a3.5 3.5 0 0 0 4.7-3.9l-2.1 2.1-2-.6-.6-2Z" /></template>
    <template v-else-if="name === 'close'"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></template>
    <template v-else-if="name === 'bars'"><path d="M2 4h12M2 8h12M2 12h12" /></template>
    <template v-else-if="name === 'database'">
      <ellipse cx="8" cy="3.5" rx="5.5" ry="2" /><path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9" /><path d="M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" />
    </template>
    <template v-else-if="name === 'table'"><rect x="1.5" y="2.5" width="13" height="11" /><path d="M1.5 6h13M1.5 9.5h13M6 6v7.5" /></template>
    <template v-else-if="name === 'column'"><path d="M3 3h10M3 8h10M3 13h6" /></template>
    <template v-else-if="name === 'save'"><path d="M2.5 2.5h9l2 2v9h-11Z" /><path d="M5 2.5v4h5v-4M5 13.5v-4h6v4" /></template>
    <template v-else-if="name === 'external'"><path d="M9 2.5h4.5V7M13.5 2.5 7 9" /><path d="M12 9.5v4H2.5V4h4" /></template>
    <template v-else-if="name === 'list'"><path d="M5.5 4h8M5.5 8h8M5.5 12h8" /><circle cx="2.6" cy="4" r=".6" fill="currentColor" /><circle cx="2.6" cy="8" r=".6" fill="currentColor" /><circle cx="2.6" cy="12" r=".6" fill="currentColor" /></template>
    <template v-else-if="name === 'gear'"><circle cx="8" cy="8" r="2.4" /><path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2M3.4 3.4 5 5M11 11l1.6 1.6M3.4 12.6 5 11M11 5l1.6-1.6" /></template>
    <template v-else-if="name === 'ops'"><path d="M2 13.5h12" /><path d="M4 11V7M8 11V3.5M12 11V5.5" stroke-width="2" /></template>
    <template v-else-if="name === 'info'"><circle cx="8" cy="8" r="6.5" /><path d="M8 7v4.5" /><circle cx="8" cy="4.8" r=".5" fill="currentColor" /></template>
    <template v-else><circle cx="8" cy="8" r="2" fill="currentColor" /></template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number | string }>(), { size: 14 });
</script>

<style scoped>
.amb-ico { display: inline-block; vertical-align: -2px; flex: 0 0 auto; }
</style>
