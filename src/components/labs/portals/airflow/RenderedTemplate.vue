<template>
  <div class="af-rt">
    <template v-if="fields.length">
      <table class="af-kv">
        <tbody>
          <tr v-for="[k, v] in fields" :key="k"><th class="af-mono">{{ k }}</th><td><pre class="af-code af-code--wrap">{{ v }}</pre></td></tr>
        </tbody>
      </table>
    </template>
    <template v-else>
      <div class="af-row">
        <span class="af-muted af-small">Rendered with <code>airflow tasks render</code> for {{ fmtDate(run.logical_date) }}</span>
        <span class="af-spacer"></span>
        <button type="button" class="af-btn af-btn--sm" :disabled="loading" @click="render"><AfIcon name="refresh" /> Re-render</button>
      </div>
      <pre class="af-code af-code--wrap af-rt__out">{{ loading ? 'Rendering…' : output || error || 'Nothing rendered.' }}</pre>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AfIcon from './AfIcon.vue';
import { useAf } from './afContext';
import { CMD, fmtDate, type AfDag, type AfRun, type AfTi } from './airflow';

const props = defineProps<{ dag: AfDag; ti: AfTi; run: AfRun }>();
const af = useAf();
const output = ref('');
const error = ref('');
const loading = ref(false);

/** A replica that sends rendered fields with the task instance needs no command. */
const fields = computed<[string, string][]>(() => {
  const r = props.ti.rendered || props.ti.rendered_fields;
  if (!r || typeof r !== 'object') return [];
  return Object.entries(r as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v, null, 2)]);
});

async function render() {
  loading.value = true;
  error.value = '';
  const result = await af.run(CMD.renderTask(props.dag.dag_id, props.ti.task_id, props.run.logical_date || props.run.run_id), { quiet: true });
  loading.value = false;
  if (result.ok) output.value = String(result.output || '');
  else error.value = String(result.error || result.output || 'The render failed.').trim();
}

onMounted(() => { if (!fields.value.length) render(); });
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-rt { display: flex; flex-direction: column; gap: 8px; }
.af-rt__out { min-height: 160px; }
</style>
