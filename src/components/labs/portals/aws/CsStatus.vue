<template>
  <span class="cs-status" :class="'cs-status--' + kind">
    <CsIcon :name="'status-' + icon" class="cs-status__icon" />
    <span><slot>{{ text }}</slot></span>
  </span>
</template>

<script setup lang="ts">
/**
 * A Cloudscape status indicator. Give it either an explicit `type` or a raw
 * product `state` ("running", "available", "terminated", "stopping"…) and it
 * picks the colour and icon the real console uses for that word.
 */
import { computed } from 'vue';
import CsIcon from './CsIcon.vue';

const props = defineProps<{ type?: string; state?: string; label?: string }>();

const WORDS: Record<string, [string, string]> = {
  running: ['success', 'Running'], available: ['success', 'Available'],
  active: ['success', 'Active'], enabled: ['success', 'Enabled'], confirmed: ['success', 'Confirmed'],
  'in-use': ['success', 'In-use'], attached: ['success', 'Attached'], success: ['success', 'Success'],
  stopped: ['stopped', 'Stopped'], disabled: ['stopped', 'Disabled'], suspended: ['stopped', 'Suspended'],
  terminated: ['stopped', 'Terminated'], deleted: ['stopped', 'Deleted'],
  pending: ['pending', 'Pending'], 'pending confirmation': ['pending', 'Pending confirmation'],
  stopping: ['in-progress', 'Stopping'], starting: ['in-progress', 'Starting'],
  creating: ['in-progress', 'Creating'], deleting: ['in-progress', 'Deleting'],
  modifying: ['in-progress', 'Modifying'], updating: ['in-progress', 'Updating'],
  error: ['error', 'Error'], failed: ['error', 'Failed'],
  warning: ['warning', 'Warning'], info: ['info', 'Info'],
};

const resolved = computed<[string, string]>(() => {
  if (props.type) return [props.type, props.label || ''];
  const word = String(props.state || '').toLowerCase();
  const hit = WORDS[word];
  if (hit) return [hit[0], props.label || hit[1]];
  return ['info', props.label || String(props.state || '-')];
});
const kind = computed(() => resolved.value[0]);
const text = computed(() => resolved.value[1]);
const icon = computed(() => ({
  success: 'positive', error: 'negative', stopped: 'stopped', pending: 'pending',
  'in-progress': 'in-progress', warning: 'warning', info: 'info',
} as Record<string, string>)[kind.value] || 'info');
</script>

<style scoped>
.cs-status { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.cs-status__icon { width: 16px; height: 16px; }
.cs-status--success { color: #00802f; }
.cs-status--error { color: #db0000; }
.cs-status--stopped { color: #656871; }
.cs-status--pending { color: #656871; }
.cs-status--in-progress { color: #656871; }
.cs-status--warning { color: #855900; }
.cs-status--info { color: #006ce0; }
.cs-status--success > span, .cs-status--error > span, .cs-status--warning > span,
.cs-status--info > span { color: inherit; }
</style>
