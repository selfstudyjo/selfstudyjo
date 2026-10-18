<template>
  <div class="progress" role="progressbar" :aria-valuenow="done" :aria-valuemax="total">
    <span class="progress-label">{{ done }}/{{ total }}<template v-if="failed"> ({{ failed }} failed)</template></span>
    <div class="progress-bar" :style="{ width: (total ? (100 * done) / total : 0) + '%' }"></div>
  </div>
</template>

<script setup lang="ts">
/** Spark's task progress bar: completed in blue, the count centred on top. */
defineProps<{ done: number; total: number; failed?: number }>();
</script>
