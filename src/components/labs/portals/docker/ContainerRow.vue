<template>
  <tr :class="{ 'is-selected': selected }">
    <td class="dd-check"><input type="checkbox" class="dd-cb" :aria-label="`Select ${row.name}`" :checked="selected" @change="$emit('toggle')" /></td>
    <td>
      <div class="dd-name-cell" :class="{ 'is-child': child }">
        <DdIcon name="containers" :size="20" :class="iconClass" :title="statusLabel(row)" />
        <div class="dd-name-lines">
          <button type="button" class="dd-link cr-name" @click="$emit('go', { page: 'containers', id: row.name, tab: 'logs' })">{{ row.name }}</button>
          <small>{{ statusLabel(row) }}</small>
        </div>
      </div>
    </td>
    <td>
      <span class="cr-id dd-mono">{{ row.id }}</span>
      <button type="button" class="cr-copy" title="Copy" aria-label="Copy container ID" @click="copyText(row.full_id || row.id)"><DdIcon name="copy" :size="13" /></button>
    </td>
    <td><button type="button" class="dd-link" @click="$emit('go', { page: 'images', id: row.image })">{{ row.image }}</button></td>
    <td>
      <span v-if="!ports.length">-</span>
      <span v-for="(p, i) in ports" :key="i" class="cr-port">
        <button v-if="p.host" type="button" class="dd-link" :title="`http://localhost:${p.host}`"
                @click="$emit('action', 'open:' + p.host)">{{ p.host }}:{{ p.container }} <DdIcon name="external" :size="12" /></button>
        <span v-else class="dd-muted">{{ p.container }}/{{ p.proto }}</span>
      </span>
    </td>
    <td>{{ row.cpu === null || row.cpu === undefined ? 'N/A' : row.cpu.toFixed(2) + '%' }}</td>
    <td>{{ row.started_ago || '-' }}</td>
    <td class="dd-actions">
      <span class="dd-actions-inner">
        <button v-if="row.status === 'running' || row.status === 'paused'" type="button" class="dd-icon-btn dd-icon-btn--blue"
                title="Stop" aria-label="Stop" @click="$emit('action', 'stop')"><DdIcon name="stop" /></button>
        <button v-else type="button" class="dd-icon-btn dd-icon-btn--blue" title="Start" aria-label="Start"
                @click="$emit('action', 'start')"><DdIcon name="play" /></button>
        <DdMenu :items="menu" label="Show container actions" @select="key => $emit('action', key)" />
        <button type="button" class="dd-icon-btn dd-icon-btn--danger" title="Delete" aria-label="Delete"
                @click="$emit('action', 'delete')"><DdIcon name="trash" /></button>
      </span>
    </td>
  </tr>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DdIcon from './DdIcon.vue';
import DdMenu from './DdMenu.vue';
import { copyText, portPairs, statusLabel, type Container, type DdRoute, type MenuItem } from './dd';

const props = defineProps<{ row: Container; child?: boolean; selected?: boolean }>();
defineEmits<{ (event: 'toggle'): void; (event: 'go', route: DdRoute): void; (event: 'action', key: string): void }>();

const ports = computed(() => portPairs(props.row));
const iconClass = computed(() => props.row.status === 'running' ? 'is-green'
  : props.row.status === 'paused' ? 'is-amber' : 'is-grey');
const menu = computed<MenuItem[]>(() => {
  const running = props.row.status === 'running';
  const paused = props.row.status === 'paused';
  return [
    { key: 'terminal', label: 'Open in terminal', icon: 'terminal', disabled: !running },
    { key: 'details', label: 'View details', icon: 'info' },
    { key: 'image', label: 'View image packages and CVEs', icon: 'images' },
    { key: 'copy', label: 'Copy docker run', icon: 'copy' },
    paused ? { key: 'unpause', label: 'Resume', icon: 'play' }
      : { key: 'pause', label: 'Pause', icon: 'pause', disabled: !running },
    { key: 'restart', label: 'Restart', icon: 'restart' },
    { key: 'delete', label: 'Delete', icon: 'trash', danger: true },
  ];
});
</script>

<style scoped src="./dd.css"></style>
<style scoped>
.is-child { padding-left: 34px; }
.is-green { color: var(--dd-green); }
.is-amber { color: var(--dd-amber); }
.is-grey { color: var(--dd-grey-dot); }
.cr-name { font-weight: 500; }
.cr-id { color: var(--dd-text); }
.cr-copy { border: 0; background: none; color: var(--dd-text-2); cursor: pointer; padding: 2px 4px; vertical-align: middle; opacity: .7; }
.cr-copy:hover { opacity: 1; color: var(--dd-text); }
.cr-port { display: inline-flex; margin-right: 8px; }
.cr-port .dd-link { display: inline-flex; align-items: center; gap: 3px; }
</style>
