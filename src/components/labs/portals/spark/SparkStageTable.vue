<template>
  <div class="table-wrap">
    <table class="table table-bordered table-sm sortable">
      <thead>
        <tr>
          <th @click="sort('stageId')">Stage Id {{ arrow('stageId') }}</th>
          <th>Description</th>
          <th @click="sort('submitted')">Submitted {{ arrow('submitted') }}</th>
          <th @click="sort('durationMs')">Duration {{ arrow('durationMs') }}</th>
          <th>Tasks: Succeeded/Total</th>
          <th>Input</th><th>Output</th><th>Shuffle Read</th><th>Shuffle Write</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="stage in sorted" :key="stage.key">
          <td>{{ stage.stageId }}</td>
          <td class="st__desc">
            <a href="#" @click.prevent="$emit('open', stage.stageId)">{{ stage.description }}</a>
            <span class="expand-details" role="button" tabindex="0" @click="toggleRow(stage.key)"
                  @keydown.enter="toggleRow(stage.key)">{{ openRows.includes(stage.key) ? '-details' : '+details' }}</span>
            <pre v-if="openRows.includes(stage.key)" class="st__details">{{ stage.name }} at ThreadPoolExecutor.java:1149
{{ stage.tasks }} task(s) · {{ duration(stage.durationMs) }}</pre>
          </td>
          <td class="st__nowrap">{{ date(stage.submitted) }}</td>
          <td>{{ duration(stage.durationMs) }}</td>
          <td><SparkProgress :done="stage.tasks" :total="stage.tasks" /></td>
          <td>{{ stage.inputBytes ? bytes(stage.inputBytes) : '' }}</td>
          <td></td>
          <td>{{ stage.shuffleRead ? bytes(stage.shuffleRead) : '' }}</td>
          <td>{{ stage.shuffleWrite ? bytes(stage.shuffleWrite) : '' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { bytes, date, duration, type SparkStage } from './spark';
import SparkProgress from './SparkProgress.vue';

const props = defineProps<{ stages: SparkStage[] }>();
defineEmits<{ (event: 'open', stageId: number): void }>();

const key = ref<keyof SparkStage>('stageId');
const openRows = ref<string[]>([]);
function toggleRow(k: string) {
  openRows.value = openRows.value.includes(k) ? openRows.value.filter(x => x !== k) : [...openRows.value, k];
}
const dir = ref<'asc' | 'desc'>('desc');
const sorted = computed(() => [...props.stages].sort((a, b) => {
  const order = Number(a[key.value]) - Number(b[key.value]);
  return dir.value === 'asc' ? order : -order;
}));
function sort(k: keyof SparkStage) {
  if (key.value === k) dir.value = dir.value === 'asc' ? 'desc' : 'asc';
  else { key.value = k; dir.value = 'desc'; }
}
function arrow(k: string) {
  return key.value === k ? (dir.value === 'asc' ? '▴' : '▾') : '';
}
</script>

<style scoped>
.st__desc { max-width: 420px; }
.st__nowrap { white-space: nowrap; }
.st__details { margin: 6px 0 0; font-size: 12px; white-space: pre-wrap; background: #f7f7f7; border: 1px solid #ddd; padding: 6px; }
.expand-details { font-size: 12px; color: #6c757d; margin-left: 6px; cursor: pointer; white-space: nowrap; }
</style>
