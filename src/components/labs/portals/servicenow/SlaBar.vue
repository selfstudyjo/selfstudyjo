<template>
  <span v-if="sla" class="sla-bar" :title="title">
    <span class="sla-bar__track"><span class="sla-bar__fill" :class="tone" :style="{ width: width + '%' }"></span></span>
    <span class="sla-bar__text">{{ Math.round(sla.percent) }}%</span>
  </span>
  <span v-else class="muted">—</span>
</template>

<script setup lang="ts">
/** The business elapsed percentage, as a Task SLA's progress bar draws it. */
import { computed } from 'vue';
import { SLA_LABEL, STAGE_LABEL, type Sla } from './snow';

const props = defineProps<{ sla: Sla | null }>();
const width = computed(() => Math.max(2, Math.min(100, props.sla?.percent || 0)));
const tone = computed(() => {
  const s = props.sla;
  if (!s) return '';
  if (s.stage === 'paused') return 'is-paused';
  if (s.stage === 'breached' || s.percent >= 100) return 'is-bad';
  if (s.percent >= 75 && s.stage !== 'achieved') return 'is-warn';
  return '';
});
const title = computed(() => {
  const s = props.sla;
  if (!s) return '';
  return `${SLA_LABEL[s.name] || s.name}: ${STAGE_LABEL[s.stage] || s.stage}, ${s.elapsed_text} of ${s.target_text}`;
});
</script>

<style scoped src="./sn.css"></style>
