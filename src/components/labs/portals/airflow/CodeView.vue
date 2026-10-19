<template>
  <div class="af-codev">
    <div class="af-codev__bar">
      <span class="af-muted af-small">{{ dag.fileloc }}</span>
      <span v-if="parsedAt" class="af-muted af-small">Parsed at: {{ fmtDate(parsedAt) }}</span>
      <span class="af-spacer"></span>
      <button type="button" class="af-btn af-btn--sm" :class="{ 'is-active': wrap }" @click="wrap = !wrap">Toggle Wrap</button>
    </div>
    <div v-if="code" class="af-codev__box" :class="{ 'is-wrap': wrap }">
      <div class="af-codev__nums" aria-hidden="true"><span v-for="n in lineCount" :key="n">{{ n }}</span></div>
      <pre class="af-codev__src"><code>{{ code }}</code></pre>
    </div>
    <div v-else class="af-alert af-alert--info">
      <div class="af-alert__body">The DAG source is in <code>{{ dag.fileloc || 'dags/' }}</code> - open it in the Files tool. This replica's
        engine does not send the file text with the view yet.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAf } from './afContext';
import { fmtDate, type AfDag } from './airflow';

const props = defineProps<{ dag: AfDag }>();
const af = useAf();
const wrap = ref(false);

const code = computed(() => {
  const d = props.dag;
  for (const key of ['code', 'source', 'file_content', 'source_code']) {
    if (typeof d[key] === 'string' && d[key]) return d[key] as string;
  }
  const files = af.airflowView.value?.files || af.airflowView.value?.dag_files;
  if (files && typeof files === 'object') {
    const text = (files as Record<string, unknown>)[d.fileloc] ?? Object.entries(files as Record<string, unknown>)
      .find(([path]) => d.fileloc && (path.endsWith(d.fileloc) || d.fileloc.endsWith(path)))?.[1];
    if (typeof text === 'string') return text;
  }
  return '';
});
const lineCount = computed(() => code.value.split('\n').length);
const parsedAt = computed(() => props.dag.last_parsed || props.dag.last_parsed_time || '');
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-codev { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.af-codev__bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; overflow-wrap: anywhere; }
.af-codev__box { display: flex; border: 1px solid var(--af-border); border-radius: 4px; background: #f8f8f8; overflow: auto; max-height: 640px; }
.af-codev__nums { display: flex; flex-direction: column; padding: 10px 8px; text-align: right; color: #aaa; background: #f0f0f0; border-right: 1px solid #e0e0e0;
  font-family: var(--af-mono); font-size: 12.5px; line-height: 19px; user-select: none; flex: none; }
.af-codev__src { margin: 0; padding: 10px 12px; font-family: var(--af-mono); font-size: 12.5px; line-height: 19px; color: #24292e; white-space: pre; background: none; border: 0; flex: 1; min-width: 0; tab-size: 4; }
.af-codev__src code { background: none; color: inherit; padding: 0; font-size: inherit; }
.af-codev__box.is-wrap .af-codev__src { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
