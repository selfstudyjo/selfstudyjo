<template>
  <div class="af-logs">
    <div class="af-logs__bar">
      <span class="af-small af-muted">Tries</span>
      <span class="af-btn-group" role="tablist" aria-label="Tries">
        <button v-for="n in tries" :key="n" type="button" role="tab" class="af-btn af-btn--sm" :class="{ 'is-active': n === tryNo }"
                :aria-selected="n === tryNo" @click="pickTry(n)">{{ n }}</button>
      </span>
      <span class="af-spacer"></span>
      <select v-model="level" class="af-select af-logs__level" aria-label="Filter log level">
        <option value="">All Levels</option>
        <option v-for="l in ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']" :key="l" :value="l">{{ l }}</option>
      </select>
      <button type="button" class="af-btn af-btn--sm" :class="{ 'is-active': wrap }" @click="wrap = !wrap">Wrap</button>
      <button type="button" class="af-btn af-btn--sm" title="Download" @click="download"><AfIcon name="download" /> Download</button>
      <button type="button" class="af-btn af-btn--sm" :disabled="loading" title="Fetch the full log through the CLI" @click="fetchLog(tryNo)">
        <AfIcon name="terminal" /> Full log</button>
    </div>
    <div class="af-small af-muted">*** Found local files:<br />***   * /opt/airflow/logs/dag_id={{ ti.dag_id }}/run_id={{ ti.run_id }}/task_id={{ ti.task_id }}/attempt={{ tryNo }}.log</div>
    <pre class="af-logs__box" :class="{ 'is-wrap': wrap }"><span v-for="(line, i) in shownLines" :key="i" class="af-logs__line" :class="lineClass(line)">{{ line }}
</span><span v-if="!shownLines.length" class="af-muted">{{ loading ? 'Loading…' : emptyText }}</span></pre>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AfIcon from './AfIcon.vue';
import { useAf } from './afContext';
import { CMD, type AfTi } from './airflow';

const props = defineProps<{ ti: AfTi }>();
const af = useAf();
const tries = computed(() => Array.from({ length: Math.max(1, Number(props.ti.try_number) || 1) }, (_, i) => i + 1));
const tryNo = ref(Math.max(1, Number(props.ti.try_number) || 1));
const level = ref('');
const wrap = ref(true);
const loading = ref(false);
const fetched = ref<Record<number, string[]>>({});

function viewLog(n: number): string[] | null {
  const byTry = props.ti.logs || props.ti.logs_by_try || props.ti.tries;
  if (byTry && typeof byTry === 'object') {
    const entry = (byTry as any)[n] ?? (byTry as any)[String(n)] ?? (Array.isArray(byTry) ? byTry[n - 1] : undefined);
    if (Array.isArray(entry)) return entry.map(String);
    if (entry && Array.isArray(entry.log)) return entry.log.map(String);
    if (typeof entry === 'string') return entry.split('\n');
  }
  if (n === tries.value.length) return props.ti.log;
  return null;
}

const lines = computed(() => fetched.value[tryNo.value] || viewLog(tryNo.value) || []);
const shownLines = computed(() => (level.value ? lines.value.filter(l => l.includes(level.value)) : lines.value));
const emptyText = computed(() => (viewLog(tryNo.value) === null
  ? `The view only keeps the latest try's log - press "Full log" to fetch try ${tryNo.value} through the CLI.`
  : props.ti.state ? 'No log lines yet.' : 'Task has not run yet: no log.'));

function lineClass(line: string) {
  if (/\b(ERROR|CRITICAL)\b|Traceback|Exception/.test(line)) return 'is-error';
  if (/\bWARNING\b/.test(line)) return 'is-warn';
  return '';
}

function pickTry(n: number) {
  tryNo.value = n;
  if (!fetched.value[n] && viewLog(n) === null) fetchLog(n);
}

async function fetchLog(n: number) {
  loading.value = true;
  const result = await af.run(CMD.taskLogs(props.ti.dag_id, props.ti.task_id, props.ti.run_id, n), { quiet: true });
  loading.value = false;
  if (result.ok) fetched.value = { ...fetched.value, [n]: String(result.output || '').split('\n') };
  else af.notify('error', `Could not read the log of try ${n}`, String(result.error || result.output || '').trim());
}

function download() {
  const blob = new Blob([lines.value.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.ti.dag_id}__${props.ti.task_id}__attempt-${tryNo.value}.log`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-logs { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.af-logs__bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.af-logs__level { width: auto; height: 26px; font-size: 12px; padding: 2px 6px; }
.af-logs__box { margin: 0; padding: 10px 12px; min-height: 240px; max-height: 560px; overflow: auto; background: #f8f8f8; color: #333;
  border: 1px solid var(--af-border); border-radius: 4px; font-family: var(--af-mono); font-size: 12px; line-height: 18px; white-space: pre; }
.af-logs__box.is-wrap { white-space: pre-wrap; overflow-wrap: anywhere; }
.af-logs__line.is-error { color: #c00; }
.af-logs__line.is-warn { color: #8a5a00; }
</style>
