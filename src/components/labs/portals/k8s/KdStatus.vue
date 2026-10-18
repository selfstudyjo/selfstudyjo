<template>
  <span v-if="health !== 'none'" class="kd-status" :class="`is-${health}`" :title="title">
    <KIcon :name="icon" :size="20" />
  </span>
  <span v-else class="kd-status is-none" />
</template>

<script setup lang="ts">
/** The status column's icon: check_circle, timelapse or error - as in the Dashboard. */
import { computed } from 'vue';
import KIcon from './KIcon.vue';
import type { Health } from './k8s';

const props = defineProps<{ health: Health; title?: string }>();
const icon = computed(() => ({ success: 'check', pending: 'timelapse', error: 'error', none: 'help' })[props.health]);
</script>

<style scoped>
.kd-status { display: inline-flex; width: 20px; height: 20px; }
.is-success { color: var(--kd-success, #008000); }
.is-pending { color: var(--kd-warning, #ffad20); }
.is-error { color: var(--kd-error, #ff481b); }
</style>
