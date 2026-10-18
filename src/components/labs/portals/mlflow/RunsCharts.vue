<template>
  <div class="mf-charts">
    <aside class="mf-charts__runs">
      <div class="mf-charts__runs-head">
        <span class="mf-label">Runs</span>
        <span class="mf-muted">{{ visible.length }}/{{ runs.length }}</span>
      </div>
      <ul>
        <li v-for="run in runs" :key="run.run_id" :class="{ 'is-hidden': hidden.has(run.run_id) }">
          <button type="button" class="mf-charts__eye" :aria-label="(hidden.has(run.run_id) ? 'Show ' : 'Hide ') + run.run_name"
                  @click="toggle(run.run_id)"><MfIcon :name="hidden.has(run.run_id) ? 'eye-off' : 'eye'" /></button>
          <span class="mf-dot" :style="{ background: runColor(run.run_id) }"></span>
          <button type="button" class="mf-link mf-charts__name" :title="run.run_name"
                  @click="mf.go({ page: 'run', expId: run.experiment_id, runId: run.run_id, tab: 'overview' })">{{ run.run_name }}</button>
        </li>
      </ul>
    </aside>
    <div class="mf-charts__body">
      <div class="mf-charts__tools">
        <div class="mf-search mf-charts__search">
          <MfIcon name="search" />
          <input v-model="query" class="mf-input" type="search" placeholder="Search metric charts" aria-label="Search metric charts" />
        </div>
      </div>
      <div v-if="!runs.length" class="mf-empty">
        <MfIcon name="chart" /><h3>No runs to chart</h3>
        <p>Charts compare the metrics of the runs in this experiment.</p>
      </div>
      <template v-else>
        <section v-if="lineCharts.length" class="mf-charts__section">
          <h3 class="mf-h3">Model metrics</h3>
          <div class="mf-charts__grid">
            <LineChart v-for="c in lineCharts" :key="c.key" :title="c.key" :series="c.series" x-label="Step" />
          </div>
        </section>
        <section v-if="barCharts.length" class="mf-charts__section">
          <h3 class="mf-h3">Summary metrics</h3>
          <div class="mf-charts__grid">
            <LineChart v-for="c in barCharts" :key="c.key" :title="c.key" :series="c.series" bars />
          </div>
        </section>
        <div v-if="!lineCharts.length && !barCharts.length" class="mf-empty"><p>No metric matches "{{ query }}".</p></div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import LineChart from './LineChart.vue';
import { useMf } from './mfContext';
import { runColor, type MfRun } from './mlflow';

const props = defineProps<{ runs: MfRun[] }>();
const mf = useMf();
const hidden = ref(new Set<string>());
const query = ref('');
function toggle(id: string) {
  const next = new Set(hidden.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  hidden.value = next;
}
const visible = computed(() => props.runs.filter(r => !hidden.value.has(r.run_id)));
const wanted = (key: string) => key.toLowerCase().includes(query.value.trim().toLowerCase());

const lineCharts = computed(() => {
  const keys = [...new Set(visible.value.flatMap(r => Object.keys(r.history)))].filter(wanted).sort();
  return keys.map(key => ({
    key,
    series: visible.value.filter(r => r.history[key]?.length)
      .map(r => ({ name: r.run_name, color: runColor(r.run_id), points: r.history[key] })),
  }));
});
const barCharts = computed(() => {
  const keys = [...new Set(visible.value.flatMap(r => Object.keys(r.metrics)))]
    .filter(key => !visible.value.some(r => (r.history[key]?.length || 0) > 1)).filter(wanted).sort();
  return keys.map(key => ({
    key,
    series: visible.value.filter(r => typeof r.metrics[key] === 'number')
      .map(r => ({ name: r.run_name, color: runColor(r.run_id), points: [[0, r.metrics[key]]] as [number, number][] })),
  }));
});
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-charts { display: flex; gap: 12px; flex: 1; min-height: 0; }
.mf-charts__runs { width: 220px; flex: none; border: 1px solid var(--mf-border-light); border-radius: var(--mf-radius); display: flex; flex-direction: column; min-height: 0; }
.mf-charts__runs-head { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid var(--mf-border-light); }
.mf-charts__runs ul { list-style: none; margin: 0; padding: 4px 0; overflow: auto; }
.mf-charts__runs li { display: flex; align-items: center; gap: 6px; padding: 3px 8px; }
.mf-charts__runs li.is-hidden { opacity: .5; }
.mf-charts__eye { border: 0; background: none; color: var(--mf-text-2); padding: 2px; cursor: pointer; display: inline-flex; border-radius: 4px; }
.mf-charts__eye:hover { background: var(--mf-row-hover); color: var(--mf-text); }
.mf-charts__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.mf-charts__body { flex: 1; min-width: 0; overflow: auto; display: flex; flex-direction: column; gap: 12px; }
.mf-charts__tools { display: flex; gap: 8px; }
.mf-charts__search { width: 280px; max-width: 100%; }
.mf-charts__section { display: flex; flex-direction: column; gap: 8px; }
.mf-charts__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 12px; }
@container sl-portal (max-width: 700px) {
  .mf-charts { flex-direction: column; overflow: auto; }
  .mf-charts__runs { width: auto; max-height: 160px; }
  .mf-charts__body { overflow: visible; }
}
</style>
