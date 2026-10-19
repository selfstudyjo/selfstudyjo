<template>
  <span class="af-circles">
    <button v-for="s in states" :key="s" type="button" class="af-circle" :class="{ 'is-zero': !counts[s] }"
            :title="`${stateLabel(s)}: ${counts[s] || 0}`" :aria-label="`${stateLabel(s)}: ${counts[s] || 0}`"
            @click="$emit('pick', s)">
      <svg viewBox="0 0 28 28" width="25" height="25" aria-hidden="true">
        <circle cx="14" cy="14" r="11" fill="#fff" :stroke="s === 'none' ? '#c4c4c4' : stateColor(s)" stroke-width="2.5" />
        <text x="14" y="18" text-anchor="middle" font-size="11" :fill="counts[s] ? '#333' : '#bbb'">{{ counts[s] || '' }}</text>
      </svg>
    </button>
  </span>
</template>

<script setup lang="ts">
import { stateColor, stateLabel } from './airflow';

defineProps<{ states: string[]; counts: Record<string, number> }>();
defineEmits<{ (event: 'pick', state: string): void }>();
</script>

<style scoped>
.af-circles { display: inline-flex; flex-wrap: nowrap; gap: 1px; align-items: center; }
.af-circle { flex: none; border: 0; background: none; padding: 0; cursor: pointer; line-height: 0; border-radius: 50%; }
.af-circle svg { display: block; max-width: none; }
.af-circle.is-zero svg circle { stroke-opacity: .25; }
.af-circle:hover svg circle { stroke-width: 3.5; }
.af-circle:focus-visible { outline: 2px solid #66afe9; outline-offset: 1px; }
</style>
