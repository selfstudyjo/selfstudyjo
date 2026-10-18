<template>
  <div class="mf-eval">
    <div class="mf-alert mf-alert--info">
      <MfIcon name="info" />
      <span>Evaluation results logged against the runs below - one row per evaluation (the
        <code class="mf-mono">eval_results_table</code> MLflow keeps for each <code class="mf-mono">mlflow.evaluate()</code> call).
        In this lab an evaluation is made with <code class="mf-mono">mlx eval --model &lt;name&gt; --suite holdout</code>.</span>
    </div>
    <div v-if="!rowsShown.length" class="mf-empty">
      <MfIcon name="eval" />
      <h3>No evaluation results</h3>
      <p>None of the runs shown has been evaluated yet. Register a run's model and evaluate it, then compare the results here.</p>
    </div>
    <div v-else class="mf-eval__layout">
      <div class="mf-table-wrap mf-eval__table">
        <table class="mf-table">
          <thead>
            <tr>
              <th>Run Name</th><th>Model</th><th>Suite</th><th class="mf-num">Rows</th><th class="mf-num">Threshold</th>
              <th class="mf-num">accuracy</th><th class="mf-num">precision</th><th class="mf-num">recall</th><th class="mf-num">f1</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rowsShown" :key="row.e.id" :class="{ 'is-selected': picked === row.e.id }" @click="picked = row.e.id">
              <td><span class="mf-dot" :style="{ background: runColor(row.e.run_id) }"></span>
                <button type="button" class="mf-link mf-eval__run" @click.stop="openRun(row.run)">{{ row.run.run_name }}</button></td>
              <td>{{ row.e.model }}</td>
              <td><span class="mf-tag">{{ row.e.suite }}</span></td>
              <td class="mf-num">{{ row.e.rows }}</td>
              <td class="mf-num">{{ num(row.e.threshold) }}</td>
              <td class="mf-num">{{ num(row.e.metrics.accuracy) }}</td>
              <td class="mf-num">{{ num(row.e.metrics.precision) }}</td>
              <td class="mf-num">{{ num(row.e.metrics.recall) }}</td>
              <td class="mf-num">{{ num(row.e.metrics.f1) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="current" class="mf-card mf-eval__cm">
        <h3 class="mf-h3">Confusion matrix</h3>
        <p class="mf-muted mf-eval__sub">{{ current.model }} on {{ current.suite }} ({{ current.rows }} rows, threshold {{ num(current.threshold) }})</p>
        <table class="mf-eval__matrix">
          <tr><th></th><th>Predicted 0</th><th>Predicted 1</th></tr>
          <tr><th>Actual 0</th><td :style="cell(current.confusion.tn)">{{ current.confusion.tn }}</td><td :style="cell(current.confusion.fp)">{{ current.confusion.fp }}</td></tr>
          <tr><th>Actual 1</th><td :style="cell(current.confusion.fn)">{{ current.confusion.fn }}</td><td :style="cell(current.confusion.tp)">{{ current.confusion.tp }}</td></tr>
        </table>
        <template v-if="current.slices.length">
          <h3 class="mf-h3 mf-eval__sl">Per slice</h3>
          <table class="mf-table">
            <thead><tr><th>Slice</th><th class="mf-num">Rows</th><th class="mf-num">recall</th><th class="mf-num">f1</th></tr></thead>
            <tbody>
              <tr v-for="s in current.slices" :key="s.slice"><td>{{ s.slice }}</td><td class="mf-num">{{ s.rows }}</td>
                <td class="mf-num">{{ num(s.recall) }}</td><td class="mf-num">{{ num(s.f1) }}</td></tr>
            </tbody>
          </table>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import { useMf } from './mfContext';
import { num, runColor, type MfRun } from './mlflow';

const props = defineProps<{ runs: MfRun[] }>();
const mf = useMf();
const picked = ref('');
const rowsShown = computed(() => {
  const byId = new Map(props.runs.map(r => [r.run_id, r]));
  return mf.evals.value.filter(e => byId.has(e.run_id)).map(e => ({ e, run: byId.get(e.run_id)! }));
});
const current = computed(() => (rowsShown.value.find(r => r.e.id === picked.value) || rowsShown.value[rowsShown.value.length - 1])?.e);
const maxCell = computed(() => Math.max(1, ...Object.values(current.value?.confusion || {}).map(Number)));
function cell(value: number) {
  const alpha = 0.08 + 0.6 * (Number(value) / maxCell.value);
  return { background: `rgba(34, 114, 180, ${alpha.toFixed(2)})`, color: alpha > 0.45 ? '#fff' : 'var(--mf-text)' };
}
function openRun(run: MfRun) {
  mf.go({ page: 'run', expId: run.experiment_id, runId: run.run_id, tab: 'overview' });
}
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-eval { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; overflow: auto; }
.mf-eval__layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 340px); gap: 12px; align-items: start; }
.mf-eval__table tr { cursor: pointer; }
.mf-eval__run { font-weight: 600; margin-left: 6px; }
.mf-eval__cm { display: flex; flex-direction: column; gap: 6px; }
.mf-eval__sub { margin: 0; font-size: 12px; }
.mf-eval__matrix { border-collapse: separate; border-spacing: 3px; font-size: 13px; }
.mf-eval__matrix th { font-weight: 600; color: var(--mf-text-2); padding: 4px 8px; text-align: center; font-size: 12px; }
.mf-eval__matrix td { width: 90px; height: 48px; text-align: center; border-radius: 4px; font-weight: 600; font-variant-numeric: tabular-nums; }
.mf-eval__sl { margin-top: 8px; }
@container sl-portal (max-width: 800px) {
  .mf-eval__layout { grid-template-columns: minmax(0, 1fr); }
}
</style>
