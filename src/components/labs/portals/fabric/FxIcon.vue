<template>
  <svg class="fx-ico" :width="size" :height="size" viewBox="0 0 20 20" aria-hidden="true"
       focusable="false">
    <!-- Item types: coloured glyphs, drawn small, the way Fabric's item icons read -->
    <template v-if="name === 'Lakehouse'">
      <path d="M10 2.5 3 8v9.5h14V8z" fill="#0e7a6b" />
      <path d="M5 12.6c1.3-.9 2.6-.9 3.9 0s2.6.9 3.9 0 2.1-.7 2.2-.5v1.6c-1.1.7-2.4.7-3.6-.1-1.2-.8-2.4-.8-3.6 0s-2 .7-2.8 0z" fill="#9fe2d4" />
      <path d="M5 15.3c1.3-.9 2.6-.9 3.9 0s2.6.9 3.9 0 2.1-.7 2.2-.5v1.6H5z" fill="#55c4ad" />
    </template>
    <template v-else-if="name === 'Warehouse'">
      <rect x="3" y="4" width="14" height="13" rx="1" fill="#1f5fc4" />
      <path d="M3 8h14M3 12h14M8 4v13M12 4v13" stroke="#a9c8f5" stroke-width="1" />
    </template>
    <template v-else-if="name === 'SQLEndpoint'">
      <ellipse cx="10" cy="5" rx="6" ry="2.3" fill="#2a7ec8" />
      <path d="M4 5v9.5c0 1.3 2.7 2.3 6 2.3s6-1 6-2.3V5c0 1.3-2.7 2.3-6 2.3S4 6.3 4 5z" fill="#1260a8" />
      <path d="M4 9.7c0 1.3 2.7 2.3 6 2.3s6-1 6-2.3" stroke="#9ccbf2" stroke-width="1" fill="none" />
    </template>
    <template v-else-if="name === 'Notebook'">
      <rect x="4" y="2.5" width="12" height="15" rx="1.4" fill="#8a3ffc" />
      <rect x="3" y="5" width="2.4" height="1.6" rx=".5" fill="#4d1fa3" />
      <rect x="3" y="9" width="2.4" height="1.6" rx=".5" fill="#4d1fa3" />
      <rect x="3" y="13" width="2.4" height="1.6" rx=".5" fill="#4d1fa3" />
      <path d="m9 8-2 2 2 2M12 8l2 2-2 2" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'DataPipeline'">
      <rect x="2" y="3" width="6" height="5" rx="1" fill="#0f6cbd" />
      <rect x="12" y="12" width="6" height="5" rx="1" fill="#0f6cbd" />
      <path d="M8 5.5h3.5a1.5 1.5 0 0 1 1.5 1.5v5" stroke="#62abf5" stroke-width="1.6" fill="none" />
      <path d="m11 10 2 2.2 2-2.2" stroke="#62abf5" stroke-width="1.4" fill="none" />
    </template>
    <template v-else-if="name === 'SemanticModel'">
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1" fill="#c87800" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1" fill="#c87800" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1" fill="#f2b31b" />
      <path d="M9 5.7h2M14.2 9v2M5.8 9v5.3H11" stroke="#7a4900" stroke-width="1.2" fill="none" />
    </template>
    <template v-else-if="name === 'Report'">
      <rect x="2.5" y="3" width="15" height="14" rx="1.5" fill="#f0b400" />
      <rect x="5" y="10" width="2.2" height="4.5" fill="#6b4c00" />
      <rect x="8.9" y="7" width="2.2" height="7.5" fill="#6b4c00" />
      <rect x="12.8" y="5.5" width="2.2" height="9" fill="#6b4c00" />
    </template>
    <template v-else-if="name === 'Environment'">
      <circle cx="10" cy="10" r="7" fill="#107c41" />
      <path d="M10 5.5v9M5.5 10h9M6.8 6.8l6.4 6.4M13.2 6.8l-6.4 6.4" stroke="#a7e1c0" stroke-width="1.1" />
      <circle cx="10" cy="10" r="2.2" fill="#107c41" stroke="#fff" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'Folder'">
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h4l1.6 1.6h7.4A1.5 1.5 0 0 1 18 7.1v8.4a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 15.5z" fill="#e8a33d" />
      <path d="M2 8h16v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 15.5z" fill="#f4c35b" />
    </template>
    <template v-else-if="name === 'Table'">
      <rect x="3" y="4" width="14" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M3 8h14M3 12h14M8 4v12" stroke="currentColor" stroke-width="1.1" />
    </template>
    <template v-else-if="name === 'View'">
      <rect x="3" y="4" width="14" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
      <circle cx="10" cy="10" r="2.2" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'Shortcut'">
      <rect x="3" y="4" width="14" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M8 13l4.5-4.5M9 8.5h3.5V12" stroke="#0f6cbd" stroke-width="1.4" fill="none" />
    </template>
    <template v-else-if="name === 'Procedure'">
      <path d="M5 3.5h10v13H5z" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M7.5 7h5M7.5 10h5M7.5 13h3" stroke="currentColor" stroke-width="1.1" />
    </template>
    <template v-else-if="name === 'File'">
      <path d="M5 2.5h6.5L15.5 6.5V17.5H5z" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M11.5 2.5v4h4" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'Schema'">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3l1.4 1.4h6.6A1.5 1.5 0 0 1 17 8v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'Workspace'">
      <rect x="2.5" y="2.5" width="15" height="15" rx="3" fill="#2b88d8" />
      <path d="M6 7h8M6 10h8M6 13h5" stroke="#fff" stroke-width="1.4" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'Capacity'">
      <rect x="3" y="4" width="14" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
      <rect x="3" y="11" width="14" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
      <circle cx="6" cy="6" r=".9" fill="currentColor" /><circle cx="6" cy="13" r=".9" fill="currentColor" />
    </template>
    <!-- Chrome: Fluent System Icons-style line glyphs -->
    <template v-else-if="name === 'waffle'">
      <g fill="currentColor"><circle cx="4" cy="4" r="1.5" /><circle cx="10" cy="4" r="1.5" /><circle cx="16" cy="4" r="1.5" />
        <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="16" cy="10" r="1.5" />
        <circle cx="4" cy="16" r="1.5" /><circle cx="10" cy="16" r="1.5" /><circle cx="16" cy="16" r="1.5" /></g>
    </template>
    <template v-else-if="name === 'fabric'">
      <path d="M4.5 3.5 12 2l3.5 3.7-7.6 1.6z" fill="#0bb48f" />
      <path d="M2.8 9.4 7.9 7.3l7.6-1.6-5.4 4.7-7.5 1z" fill="#1aa26b" />
      <path d="M2.6 11.4 10.1 10.4l-3 6.6L3 18z" fill="#117865" />
      <path d="M10.1 10.4 15.5 5.7 17 8.5l-6.9 8.5z" fill="#0d6b5a" />
    </template>
    <template v-else-if="name === 'home'">
      <path d="M3.5 8.5 10 3l6.5 5.5V16a1 1 0 0 1-1 1H12v-4.5H8V17H4.5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'workspaces'">
      <rect x="3" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.3" />
      <rect x="11" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.3" />
      <rect x="3" y="11" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.3" />
      <rect x="11" y="11" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.3" />
    </template>
    <template v-else-if="name === 'onelake'">
      <ellipse cx="10" cy="5.5" rx="6" ry="2.3" fill="none" stroke="currentColor" stroke-width="1.3" />
      <path d="M4 5.5v9c0 1.3 2.7 2.3 6 2.3s6-1 6-2.3v-9" fill="none" stroke="currentColor" stroke-width="1.3" />
      <path d="M4 10c0 1.3 2.7 2.3 6 2.3s6-1 6-2.3" fill="none" stroke="currentColor" stroke-width="1.3" />
    </template>
    <template v-else-if="name === 'monitor'">
      <path d="M2.5 10.5h3l2-5 3.5 9 2-4h4.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'realtime'">
      <path d="M11 2.5 4.5 11h5l-1 6.5L15.5 9h-5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'workloads'">
      <path d="M10 2.5 16.5 6v8L10 17.5 3.5 14V6z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
      <path d="M3.5 6 10 9.5 16.5 6M10 9.5v8" fill="none" stroke="currentColor" stroke-width="1.3" />
    </template>
    <template v-else-if="name === 'create'">
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.3" />
      <path d="M10 6.5v7M6.5 10h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'deploy'">
      <rect x="2" y="7.5" width="4" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
      <rect x="8" y="7.5" width="4" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
      <rect x="14" y="7.5" width="4" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M6 10h2M12 10h2" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'admin'">
      <path d="M10 2.5 16 5v4.5c0 4-2.6 6.6-6 8-3.4-1.4-6-4-6-8V5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="8.5" cy="8.5" r="5" fill="none" stroke="currentColor" stroke-width="1.4" />
      <path d="m12.3 12.3 4.5 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'bell'">
      <path d="M10 2.8a4.7 4.7 0 0 0-4.7 4.7v3.4L3.8 14h12.4l-1.5-3.1V7.5A4.7 4.7 0 0 0 10 2.8zM8 15.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="10" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="1.3" />
      <path d="M10 2.5l1.3 1.9 2.2-.6.5 2.2 2.1.9-.9 2.1 1.3 1.8-1.9 1.3.1 2.3-2.3.1-1 2-2.1-1-1.9 1.3-1.1-2-2.3-.2.4-2.3-1.8-1.4 1.5-1.7-.8-2.2 2.2-.6.6-2.2 2.2.8z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'help'">
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.3" />
      <path d="M8 8a2 2 0 1 1 2.8 1.8c-.6.3-.8.7-.8 1.4v.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      <circle cx="10" cy="14" r=".9" fill="currentColor" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M10 3v9.5M6 9l4 4 4-4M4 16.5h12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'share'">
      <circle cx="14.5" cy="5" r="2" fill="none" stroke="currentColor" stroke-width="1.2" />
      <circle cx="5.5" cy="10" r="2" fill="none" stroke="currentColor" stroke-width="1.2" />
      <circle cx="14.5" cy="15" r="2" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="m7.3 9 5.4-3M7.3 11l5.4 3" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'folderAdd'">
      <path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3.5l1.5 1.5h7A1.5 1.5 0 0 1 17.5 7v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 15z" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M10 8.5v5M7.5 11h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'upload'">
      <path d="M10 16V6.5M6 10.5l4-4 4 4M4 3.5h12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'more'">
      <g fill="currentColor"><circle cx="4.5" cy="10" r="1.3" /><circle cx="10" cy="10" r="1.3" /><circle cx="15.5" cy="10" r="1.3" /></g>
    </template>
    <template v-else-if="name === 'chevronRight'">
      <path d="m7.5 4.5 5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'chevronDown'">
      <path d="m4.5 7.5 5.5 5.5 5.5-5.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'play'">
      <path d="M6.5 4.2v11.6L15.5 10z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'stop'">
      <rect x="5" y="5" width="10" height="10" rx="1" fill="currentColor" />
    </template>
    <template v-else-if="name === 'refresh'">
      <path d="M15.5 6.5A6 6 0 1 0 16 11M16 3v4h-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'filter'">
      <path d="M3 4.5h14l-5.5 6.5v4.5l-3 1.5v-6z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'list'">
      <path d="M7 5h10M7 10h10M7 15h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      <g fill="currentColor"><circle cx="3.8" cy="5" r="1" /><circle cx="3.8" cy="10" r="1" /><circle cx="3.8" cy="15" r="1" /></g>
    </template>
    <template v-else-if="name === 'lineage'">
      <circle cx="4" cy="10" r="2" fill="none" stroke="currentColor" stroke-width="1.2" />
      <circle cx="16" cy="5" r="2" fill="none" stroke="currentColor" stroke-width="1.2" />
      <circle cx="16" cy="15" r="2" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M6 10h4l4-5M10 10l4 5" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'people'">
      <circle cx="7.5" cy="7" r="2.6" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M2.8 16c.4-2.7 2.3-4.3 4.7-4.3s4.3 1.6 4.7 4.3" fill="none" stroke="currentColor" stroke-width="1.2" />
      <circle cx="14" cy="7.5" r="2" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M13.5 11.6c2 0 3.4 1.3 3.8 3.6" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'git'">
      <circle cx="6" cy="5" r="1.8" fill="none" stroke="currentColor" stroke-width="1.2" />
      <circle cx="6" cy="15" r="1.8" fill="none" stroke="currentColor" stroke-width="1.2" />
      <circle cx="14" cy="8" r="1.8" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M6 6.8v6.4M14 9.8c0 2.4-4 2.2-7 3.6" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'edit'">
      <path d="M13.3 3.5 16.5 6.7 7 16.2l-3.8.6.6-3.8z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'delete'">
      <path d="M4 5.5h12M8 5.5V4h4v1.5M5.5 5.5l.8 11h7.4l.8-11M8.5 8.5v5M11.5 8.5v5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m4 10.5 4 4 8-9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'success'">
      <circle cx="10" cy="10" r="7.5" fill="#107c10" />
      <path d="m6.5 10.2 2.4 2.4 4.6-5" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'error'">
      <circle cx="10" cy="10" r="7.5" fill="#c50f1f" />
      <path d="m7.2 7.2 5.6 5.6M12.8 7.2l-5.6 5.6" stroke="#fff" stroke-width="1.5" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'warning'">
      <path d="M10 2.8 18 16.8H2z" fill="#f7630c" />
      <path d="M10 8v4.3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" /><circle cx="10" cy="14.4" r=".9" fill="#fff" />
    </template>
    <template v-else-if="name === 'info'">
      <circle cx="10" cy="10" r="7.5" fill="#0f6cbd" />
      <path d="M10 9v4.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" /><circle cx="10" cy="6.5" r=".9" fill="#fff" />
    </template>
    <template v-else-if="name === 'running'">
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="#c7e0f4" stroke-width="2" />
      <path d="M10 3.5a6.5 6.5 0 0 1 6.5 6.5" fill="none" stroke="#0f6cbd" stroke-width="2" />
    </template>
    <template v-else-if="name === 'save'">
      <path d="M4 3.5h9.5l2.5 2.5v10.5H4z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
      <path d="M7 3.5v4h6v-4M7 16.5v-5h6v5" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'code'">
      <path d="m7 6-4 4 4 4M13 6l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'text'">
      <path d="M4 5h12M10 5v11M7 16h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="3" y="4" width="14" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M3 8h14M7 2.5v3M13 2.5v3" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'hamburger'">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'lock'">
      <rect x="4.5" y="9" width="11" height="8" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.2" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'badge'">
      <path d="M10 2.5l2 1.6 2.5-.3.6 2.5 2.1 1.4-1.1 2.3 1.1 2.3-2.1 1.4-.6 2.5-2.5-.3-2 1.6-2-1.6-2.5.3-.6-2.5-2.1-1.4 1.1-2.3-1.1-2.3 2.1-1.4.6-2.5 2.5.3z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
      <path d="m7.3 10 1.9 1.9 3.5-3.6" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'sparkle'">
      <path d="M10 2.5 11.6 8.4 17.5 10l-5.9 1.6L10 17.5l-1.6-5.9L2.5 10l5.9-1.6z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'compare'">
      <rect x="2.5" y="4" width="6" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
      <rect x="11.5" y="4" width="6" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
    <template v-else-if="name === 'pause'">
      <path d="M7 4.5v11M13 4.5v11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>
    <template v-else>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.2" />
    </template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number | string }>(), { size: 16 });
</script>

<style scoped>
.fx-ico { flex: none; display: inline-block; vertical-align: middle; }
</style>
