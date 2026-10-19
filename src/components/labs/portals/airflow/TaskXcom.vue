<template>
  <div class="af-table-wrap">
    <table class="af-table af-table--striped">
      <thead><tr><th>Key</th><th>Value</th></tr></thead>
      <tbody>
        <tr v-for="x in entries" :key="x.key + (x.map_index ?? '')">
          <td class="af-mono af-nowrap">{{ x.key }}</td>
          <td><pre class="af-code af-code--wrap af-xc__val">{{ show(x.value) }}</pre></td>
        </tr>
        <tr v-if="!entries.length"><td colspan="2" class="af-empty-cell">No XCom</td></tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAf } from './afContext';
import type { AfTi } from './airflow';

const props = defineProps<{ ti: AfTi }>();
const af = useAf();
const entries = computed(() => af.xcom.value.filter(x => x.dag_id === props.ti.dag_id && x.run_id === props.ti.run_id && x.task_id === props.ti.task_id));
function show(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-xc__val { padding: 6px 8px; max-height: 240px; }
</style>
