<template>
  <span class="kd-chips">
    <span v-for="[key, value] in shown" :key="key" class="kd-chip" :title="`${key}: ${value}`">{{ key }}: {{ value }}</span>
    <button v-if="pairs.length > limit && !all" type="button" class="kd-chips__more" @click.stop="all = true">Show all</button>
    <button v-else-if="pairs.length > limit && all" type="button" class="kd-chips__more" @click.stop="all = false">Show less</button>
    <span v-if="!pairs.length" class="kd-chips__none">-</span>
  </span>
</template>

<script setup lang="ts">
/** Labels and annotations as the Dashboard draws them: grey chips, three at a time. */
import { computed, ref } from 'vue';
import { labelPairs } from './k8s';

const props = withDefaults(defineProps<{ labels: unknown; limit?: number }>(), { limit: 3 });
const all = ref(false);
const pairs = computed(() => labelPairs(props.labels));
const shown = computed(() => (all.value ? pairs.value : pairs.value.slice(0, props.limit)));
</script>

<style scoped>
.kd-chips { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.kd-chip {
  display: inline-block; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 2px 8px; border-radius: 12px; background: #e0e0e0; color: rgb(0 0 0 / 0.87);
  font-size: 12px; line-height: 18px;
}
.kd-chips__more { border: 0; background: none; color: var(--kd-primary, #326de6); font: inherit; font-size: 12px; cursor: pointer; padding: 0 4px; }
.kd-chips__none { color: rgb(0 0 0 / 0.54); }
</style>
