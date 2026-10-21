<template>
  <svg class="pg-ico" :width="size" :height="size" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <!-- ===== Object Explorer ===== -->
    <template v-if="name === 'servers'">
      <rect x="2" y="2" width="12" height="4" rx="1" fill="#5a7ea6" /><rect x="2" y="7" width="12" height="4" rx="1" fill="#5a7ea6" />
      <circle cx="4.5" cy="4" r=".8" fill="#cfe5ff" /><circle cx="4.5" cy="9" r=".8" fill="#cfe5ff" />
      <rect x="2" y="12" width="12" height="2" rx="1" fill="#8aa6c4" />
    </template>
    <template v-else-if="name === 'server'">
      <!-- the elephant on a server: pgAdmin's connected-server icon -->
      <rect x="1.5" y="2" width="13" height="11" rx="2" fill="#336791" />
      <path d="M5 11V6.5C5 5 6.2 4 8 4s3 1 3 2.6V8c0 .9-.6 1.5-1.4 1.5H8.6V11M8.6 6.6h.8" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" />
      <circle cx="12.5" cy="12.5" r="2.5" fill="#2e9b5e" stroke="#fff" stroke-width=".8" />
    </template>
    <template v-else-if="name === 'database'">
      <ellipse cx="8" cy="3.5" rx="5.5" ry="2" fill="#ffc107" stroke="#b8860b" stroke-width=".7" />
      <path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9" fill="#ffd54f" stroke="#b8860b" stroke-width=".7" />
      <path d="M2.5 7c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2M2.5 10c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" fill="none" stroke="#b8860b" stroke-width=".6" />
    </template>
    <template v-else-if="name === 'schema'">
      <rect x="6" y="1.5" width="4" height="3.5" rx=".6" fill="#7b5ea7" />
      <rect x="1.5" y="10.5" width="4" height="3.5" rx=".6" fill="#7b5ea7" /><rect x="10.5" y="10.5" width="4" height="3.5" rx=".6" fill="#7b5ea7" />
      <path d="M8 5v3M3.5 10.5V8h9v2.5" fill="none" stroke="#7b5ea7" stroke-width="1" />
    </template>
    <template v-else-if="name === 'table'">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" fill="#fff" stroke="#3b6ea5" />
      <rect x="1.5" y="2.5" width="13" height="3" fill="#3b6ea5" />
      <path d="M1.5 9.2h13M6 5.5v8M10.3 5.5v8" stroke="#3b6ea5" stroke-width=".8" />
    </template>
    <template v-else-if="name === 'view'">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" fill="#fff" stroke="#2e8b57" />
      <rect x="1.5" y="2.5" width="13" height="3" fill="#2e8b57" />
      <circle cx="8" cy="9.5" r="2.2" fill="none" stroke="#2e8b57" stroke-width="1" /><circle cx="8" cy="9.5" r=".8" fill="#2e8b57" />
    </template>
    <template v-else-if="name === 'mview'">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" fill="#e8f5ee" stroke="#2e8b57" />
      <rect x="1.5" y="2.5" width="13" height="3" fill="#2e8b57" />
      <path d="M4 12V8l2 2 2-2 2 2 2-2v4" fill="none" stroke="#2e8b57" stroke-width="1" />
    </template>
    <template v-else-if="name === 'column' || name === 'column-pk'">
      <rect x="5" y="1.5" width="6" height="13" rx="1" fill="#e3edf7" stroke="#3b6ea5" />
      <path d="M5 5h6M5 8.5h6M5 12h6" stroke="#3b6ea5" stroke-width=".7" />
      <path v-if="name === 'column-pk'" d="M11 9.5a2 2 0 1 1 2.9 1.8L15 12.4v1.4h-1.2v-.9h-.9V12l-.6-.6A2 2 0 0 1 11 9.5z" fill="#e0a800" stroke="#8a6500" stroke-width=".5" />
    </template>
    <template v-else-if="name === 'constraints'">
      <path d="M3 13l5-10 5 10z" fill="#fde7c4" stroke="#c77700" stroke-width=".9" stroke-linejoin="round" />
      <path d="M8 6.5v3.2M8 11.2v.4" stroke="#c77700" stroke-width="1.1" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'pkey'">
      <circle cx="5.5" cy="8" r="3.4" fill="#ffc107" stroke="#8a6500" stroke-width=".8" />
      <circle cx="5.5" cy="8" r="1.1" fill="#fff" />
      <path d="M8.8 8h6v2.2M12.5 8v2" fill="none" stroke="#8a6500" stroke-width="1.3" />
    </template>
    <template v-else-if="name === 'fkey'">
      <circle cx="5.5" cy="8" r="3.4" fill="#cfd8dc" stroke="#546e7a" stroke-width=".8" />
      <circle cx="5.5" cy="8" r="1.1" fill="#fff" />
      <path d="M8.8 8h6v2.2M12.5 8v2" fill="none" stroke="#546e7a" stroke-width="1.3" />
    </template>
    <template v-else-if="name === 'ukey'">
      <circle cx="5.5" cy="8" r="3.4" fill="#b3e5fc" stroke="#0277bd" stroke-width=".8" />
      <text x="5.5" y="10" text-anchor="middle" font-size="5" font-weight="700" fill="#0277bd" font-family="Arial">U</text>
      <path d="M8.8 8h6v2.2M12.5 8v2" fill="none" stroke="#0277bd" stroke-width="1.3" />
    </template>
    <template v-else-if="name === 'check'">
      <rect x="2" y="2" width="12" height="12" rx="2" fill="#e8f5e9" stroke="#2e7d32" />
      <path d="M4.5 8.2l2.3 2.3 4.7-5" fill="none" stroke="#2e7d32" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'index'">
      <rect x="2" y="2" width="12" height="12" rx="1.5" fill="#e6eefc" stroke="#4169b8" />
      <path d="M5 5h6M5 8h4M5 11h6" stroke="#4169b8" stroke-width="1.2" stroke-linecap="round" />
      <path d="M12.5 7.5l-1.5 2h1.6l-1 2" fill="none" stroke="#e45d39" stroke-width=".9" />
    </template>
    <template v-else-if="name === 'sequence'">
      <rect x="1.5" y="4.5" width="13" height="7" rx="1" fill="#fff" stroke="#8e5ba8" />
      <text x="8" y="10.2" text-anchor="middle" font-size="5.6" font-family="Arial" font-weight="700" fill="#8e5ba8">123</text>
    </template>
    <template v-else-if="name === 'role-login'">
      <circle cx="8" cy="5" r="3" fill="#5f8fbf" /><path d="M2.5 14.5c.4-3.3 2.6-5 5.5-5s5.1 1.7 5.5 5z" fill="#5f8fbf" />
    </template>
    <template v-else-if="name === 'role-group'">
      <circle cx="5.5" cy="5.5" r="2.3" fill="#8aa6c4" /><circle cx="10.5" cy="5.5" r="2.3" fill="#5f8fbf" />
      <path d="M1.5 13.5c.3-2.6 1.8-4 4-4s3.6 1.4 4 4zM6.6 13.5c.3-2.6 1.8-4 4-4s3.6 1.4 3.9 4z" fill="#5f8fbf" />
    </template>
    <template v-else-if="name === 'tablespace'">
      <path d="M2 4.5h12v8H2z" fill="#eceff1" stroke="#607d8b" />
      <path d="M2 4.5l1.5-2.5h9L14 4.5" fill="#cfd8dc" stroke="#607d8b" />
    </template>
    <template v-else-if="name === 'extension'">
      <path d="M3 3h4v1.5a1.5 1.5 0 1 0 2 0V3h4v4h-1.5a1.5 1.5 0 1 0 0 2H13v4H3z" fill="#9ccc65" stroke="#558b2f" stroke-width=".8" />
    </template>
    <template v-else-if="name === 'language' || name === 'function'">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="#fff8e1" stroke="#a1887f" />
      <text x="8" y="11" text-anchor="middle" font-size="7.5" font-style="italic" font-family="Georgia, serif" fill="#6d4c41">f(x)</text>
    </template>
    <template v-else-if="name === 'catalog'">
      <rect x="3" y="1.5" width="10" height="13" rx="1" fill="#e3f2fd" stroke="#1976d2" />
      <path d="M5.5 5h5M5.5 8h5M5.5 11h3" stroke="#1976d2" stroke-width=".9" />
    </template>
    <template v-else-if="name === 'trigger'">
      <path d="M9 1.5L3.5 9H8l-1 5.5L12.5 7H8z" fill="#ffca28" stroke="#c68400" stroke-width=".7" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'policy'">
      <path d="M8 1.5l5.5 2v4.2c0 3.3-2.4 5.8-5.5 6.8-3.1-1-5.5-3.5-5.5-6.8V3.5z" fill="#e8eaf6" stroke="#3949ab" />
    </template>
    <!-- ===== toolbar, menus and dialogs ===== -->
    <template v-else-if="name === 'chev-right'"><path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></template>
    <template v-else-if="name === 'chev-down'"><path d="M3.5 6L8 10.5 12.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></template>
    <template v-else-if="name === 'caret-down'"><path d="M4 6h8l-4 5z" fill="currentColor" /></template>
    <template v-else-if="name === 'play'"><path d="M4.5 2.5v11l9-5.5z" fill="currentColor" /></template>
    <template v-else-if="name === 'stop'"><rect x="3.5" y="3.5" width="9" height="9" rx="1" fill="currentColor" /></template>
    <template v-else-if="name === 'explain'">
      <rect x="1.5" y="6" width="4" height="4" rx=".8" fill="none" stroke="currentColor" stroke-width="1.2" />
      <rect x="10.5" y="2" width="4" height="4" rx=".8" fill="none" stroke="currentColor" stroke-width="1.2" />
      <rect x="10.5" y="10" width="4" height="4" rx=".8" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M5.5 8h2.5M8 4v8M8 4h2.5M8 12h2.5" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'explain-analyze'">
      <rect x="1.5" y="6" width="4" height="4" rx=".8" fill="currentColor" />
      <rect x="10.5" y="2" width="4" height="4" rx=".8" fill="currentColor" />
      <rect x="10.5" y="10" width="4" height="4" rx=".8" fill="currentColor" />
      <path d="M5.5 8h2.5M8 4v8M8 4h2.5M8 12h2.5" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'commit'"><path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></template>
    <template v-else-if="name === 'rollback'"><path d="M5 4.5H10a3.5 3.5 0 0 1 0 7H4M5 4.5L2.5 7M5 4.5L2.5 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></template>
    <template v-else-if="name === 'folder-open'"><path d="M1.5 4h4.5l1.5 1.5h7v7.5h-13z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></template>
    <template v-else-if="name === 'save'">
      <path d="M2.5 2.5h9l2 2v9h-11z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
      <rect x="5" y="2.5" width="5" height="3.5" fill="none" stroke="currentColor" stroke-width="1.1" /><rect x="5" y="9" width="6" height="4.5" fill="none" stroke="currentColor" stroke-width="1.1" />
    </template>
    <template v-else-if="name === 'save-data'">
      <path d="M2.5 2.5h9l2 2v9h-11z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
      <path d="M5 9l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'filter'"><path d="M2 3h12L9.5 8.5V13l-3 1.5v-6z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></template>
    <template v-else-if="name === 'search'"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M10.4 10.4L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></template>
    <template v-else-if="name === 'query-tool'">
      <ellipse cx="6.5" cy="3.5" rx="4.5" ry="1.8" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M2 3.5v8c0 1 2 1.8 4.5 1.8M11 3.5v3" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M9 9.5l2 1.5-2 1.5M12 13h2.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'grid'">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M1.5 6h13M1.5 9.7h13M6 2.5v11M10.3 2.5v11" stroke="currentColor" stroke-width="1" />
    </template>
    <template v-else-if="name === 'terminal'">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M4 6l2.5 2L4 10M8 10.5h4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'refresh'"><path d="M13 7.5A5 5 0 1 1 11.5 4M13 2.5v3.5H9.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></template>
    <template v-else-if="name === 'close'"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></template>
    <template v-else-if="name === 'plus'"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></template>
    <template v-else-if="name === 'trash'">
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'copy'"><rect x="5" y="5" width="8.5" height="8.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.3" /><path d="M3 10.5V3.5a1 1 0 0 1 1-1h6.5" fill="none" stroke="currentColor" stroke-width="1.3" /></template>
    <template v-else-if="name === 'paste'"><rect x="3" y="3" width="10" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.3" /><rect x="5.5" y="1.5" width="5" height="3" rx=".6" fill="currentColor" /></template>
    <template v-else-if="name === 'info'"><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.3" /><path d="M8 7.2v4M8 4.8v.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></template>
    <template v-else-if="name === 'help'"><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.3" /><path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.7c-.6.3-.8.6-.8 1.3M8 11.4v.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></template>
    <template v-else-if="name === 'check-circle'"><circle cx="8" cy="8" r="6.5" fill="currentColor" /><path d="M5 8.2l2 2 4-4.2" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></template>
    <template v-else-if="name === 'error-circle'"><circle cx="8" cy="8" r="6.5" fill="currentColor" /><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="#fff" stroke-width="1.6" stroke-linecap="round" /></template>
    <template v-else-if="name === 'warn'"><path d="M8 1.5l7 12.5H1z" fill="currentColor" /><path d="M8 6v3.6M8 11.6v.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" /></template>
    <template v-else-if="name === 'reset'"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5V5h2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></template>
    <template v-else-if="name === 'download'"><path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13.5h11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></template>
    <template v-else-if="name === 'history'"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.3" /><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></template>
    <template v-else-if="name === 'menu'"><path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></template>
    <template v-else-if="name === 'sql'"><text x="8" y="11" text-anchor="middle" font-size="6.5" font-family="Arial" font-weight="700" fill="currentColor">SQL</text></template>
    <template v-else-if="name === 'macro'"><path d="M2.5 12.5V4l3 4.5 3-4.5v8.5M10.5 4v8.5h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></template>
    <template v-else-if="name === 'format'"><path d="M2.5 3.5h11M5 6.5h8.5M5 9.5h8.5M2.5 12.5h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></template>
    <template v-else-if="name === 'import-export'">
      <path d="M4 2v9M1.5 8.5 4 11l2.5-2.5M12 14V5M9.5 7.5 12 5l2.5 2.5" fill="none" stroke="#326690" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'backup'">
      <ellipse cx="7" cy="3.5" rx="5" ry="1.8" fill="#dbe8f4" stroke="#326690" stroke-width=".8" />
      <path d="M2 3.5v7c0 1 2.2 1.8 5 1.8M12 3.5V7" fill="none" stroke="#326690" stroke-width=".8" />
      <path d="M12 9v5.5M9.8 12.3 12 14.5l2.2-2.2" fill="none" stroke="#2e8b57" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'restore'">
      <ellipse cx="7" cy="3.5" rx="5" ry="1.8" fill="#dbe8f4" stroke="#326690" stroke-width=".8" />
      <path d="M2 3.5v7c0 1 2.2 1.8 5 1.8M12 3.5V7" fill="none" stroke="#326690" stroke-width=".8" />
      <path d="M12 14.5V9M9.8 11.2 12 9l2.2 2.2" fill="none" stroke="#c77700" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'grant'">
      <circle cx="5" cy="6" r="2.5" fill="none" stroke="#326690" stroke-width="1.1" />
      <path d="M1.5 14c0-2.4 1.6-3.8 3.5-3.8S8.5 11.6 8.5 14" fill="none" stroke="#326690" stroke-width="1.1" />
      <path d="M10 4.5h4.5M10 7.5h4.5M10 10.5h3" stroke="#2e8b57" stroke-width="1.2" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'rename'">
      <path d="M2 12.5 10.5 4l1.5 1.5L3.5 14H2z" fill="#fff" stroke="#326690" stroke-width="1" stroke-linejoin="round" />
      <path d="M9.5 5 11 6.5M12 2.5l1.5 1.5" stroke="#326690" stroke-width="1" />
    </template>
    <template v-else>
      <!-- an empty collection folder -->
      <path d="M1.5 4h4.5l1.5 1.5h7v7.5h-13z" fill="#ffe08a" stroke="#c9a227" stroke-width=".8" stroke-linejoin="round" />
    </template>
  </svg>
</template>

<script setup lang="ts">
/** pgAdmin's icons, drawn inline (a skin loads nothing remote). */
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 });
</script>

<style scoped>
.pg-ico { display: inline-block; flex: none; vertical-align: middle; }
</style>
