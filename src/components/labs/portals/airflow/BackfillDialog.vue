<template>
  <AfModal :title="'Backfill (CLI): ' + dag.dag_id" ok-text="Run in the CLI" :ok-disabled="Boolean(problem)" :busy="saving" :width="640"
           @close="$emit('close')" @ok="submit">
    <div class="af-alert af-alert--info">
      <div class="af-alert__body"><strong>Airflow 2.9 has no Backfill button.</strong> A backfill is started from the command line with
        <code>airflow dags backfill</code>; this helper builds that command for you and runs it in the Airflow CLI console.
        It creates one <code>backfill</code> run per schedule interval between the two dates.</div>
    </div>
    <div class="af-bf__grid">
      <label class="af-field"><span class="af-label">Start date (-s)</span>
        <input v-model="start" class="af-input" placeholder="2026-10-25" aria-label="Start date" /></label>
      <label class="af-field"><span class="af-label">End date (-e)</span>
        <input v-model="end" class="af-input" placeholder="2026-11-01" aria-label="End date" /></label>
    </div>
    <label class="af-check"><input v-model="reset" type="checkbox" /> <span><code>--reset-dagruns</code> - clear and re-run existing runs in the range (implies <code>-y</code>)</span></label>
    <p class="af-help af-bf__note">A run in the range that already failed is run again; a successful one is kept unless you reset it.</p>
    <label class="af-field"><span class="af-label">Conf <i>(optional JSON, -c)</i></span>
      <textarea v-model="conf" class="af-textarea af-bf__conf" rows="3" spellcheck="false" aria-label="Conf"></textarea></label>
    <span v-if="problem" class="af-error-text">{{ problem }}</span>
    <div class="af-field"><span class="af-label">Command</span><code class="af-bf__line">{{ command }}</code></div>
  </AfModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AfModal from './AfModal.vue';
import { useAf } from './afContext';
import { CMD, dayOf, parseConf, type AfDag } from './airflow';

const props = defineProps<{ dag: AfDag }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const af = useAf();

const start = ref(dayOf(props.dag.start_date) || '');
// The newest interval the DAG has: its latest run, else the start date.
const end = ref(dayOf(af.runsOf(props.dag.dag_id).map(r => String(r.logical_date)).sort().pop()) || dayOf(props.dag.start_date) || '');
const reset = ref(false);
const conf = ref('');
const saving = ref(false);

const parsed = computed(() => parseConf(conf.value));
const problem = computed(() => {
  const s = start.value.trim(); const e = end.value.trim();
  if (!s || !e) return 'Both a start and an end date are required.';
  if (!/^\d{4}-\d{2}-\d{2}/.test(s) || !/^\d{4}-\d{2}-\d{2}/.test(e)) return 'Dates look like 2026-10-25.';
  if (e < s) return 'The end date is before the start date.';
  return parsed.value.ok ? '' : parsed.value.error;
});
const command = computed(() => CMD.backfill(props.dag.dag_id, start.value.trim(), end.value.trim(), {
  reset: reset.value, conf: parsed.value.ok ? parsed.value.value : '',
}));

async function submit() {
  if (problem.value) return;
  saving.value = true;
  const result = await af.run(command.value, { success: `Backfill of ${props.dag.dag_id} from ${start.value.trim()} to ${end.value.trim()} started` });
  saving.value = false;
  if (result.ok) emit('close');
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-bf__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px; }
.af-bf__conf { min-height: 64px; }
.af-bf__line { display: block; padding: 6px 8px; color: #24292e; background: #f6f8fa; border: 1px solid #e1e4e8; overflow-wrap: anywhere; white-space: pre-wrap; }
.af-bf__note { margin: 0; }
.af-check { align-items: flex-start; }
.af-check input { margin-top: 3px; }
</style>
