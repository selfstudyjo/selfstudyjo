<template>
  <SfModal title="Unload Data" :subtitle="table" ok-text="Unload" :busy="busy" :ok-disabled="!statement" :sql="statement" :error="error"
           :width="620" @close="$emit('close')" @ok="submit">
    <p class="sf-muted ul__p">COPY INTO a stage location writes the rows to files in the lake that the stage points at.</p>
    <div class="sf-row">
      <label class="sf-field"><span class="sf-label">Stage</span>
        <select v-model="stage" class="sf-select"><option v-for="s in stages" :key="s.fqn" :value="s.fqn">{{ s.fqn }}</option></select></label>
      <label class="sf-field"><span class="sf-label">Path under the stage</span>
        <input v-model="path" class="sf-input sf-mono" /></label>
    </div>
    <label class="sf-field"><span class="sf-label">Rows</span>
      <select v-model="source" class="sf-select"><option value="table">Every row of the table</option><option value="query">The rows of a query</option></select></label>
    <label v-if="source === 'query'" class="sf-field"><span class="sf-label">Query</span>
      <textarea v-model="queryText" class="sf-textarea sf-mono" rows="3"></textarea></label>
    <div class="sf-row">
      <label class="sf-field"><span class="sf-label">File format</span>
        <select v-model="format" class="sf-select"><option>CSV</option><option>JSON</option><option>PARQUET</option></select></label>
      <label class="sf-check ul__chk"><input v-model="header" type="checkbox" :disabled="format !== 'CSV'" /> Include a header row (HEADER = TRUE)</label>
    </div>
    <label class="sf-check"><input v-model="overwrite" type="checkbox" /> Overwrite existing files (OVERWRITE = TRUE)</label>
    <label class="sf-check"><input v-model="single" type="checkbox" /> One file (SINGLE = TRUE)</label>
  </SfModal>
</template>

<script setup lang="ts">
/** Unload: COPY INTO @stage/path FROM <table | (query)> with a file format - the inverse of a load. */
import { computed, ref } from 'vue';
import SfModal from './SfModal.vue';
import { useSf } from './sfContext';
import { fqnSql, leaf, list } from './snowflake';

const props = defineProps<{ table: string; stage?: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const sf = useSf();
const stages = computed(() => list.stages(sf.view.value));
const stage = ref(props.stage || stages.value[0]?.fqn || '');
const path = ref(`exports/${leaf(props.table).toLowerCase()}/`);
const source = ref<'table' | 'query'>('table');
const queryText = ref(`SELECT * FROM ${props.table}`);
const format = ref('CSV');
const header = ref(true);
const overwrite = ref(true);
const single = ref(false);
const busy = ref(false);
const error = ref('');

const statement = computed(() => {
  if (!stage.value) return '';
  const sub = path.value.trim().replace(/^\/+/, '').replace(/[^\w./=-]/g, '');
  const from = source.value === 'query' ? `(${queryText.value.trim().replace(/;\s*$/, '')})` : fqnSql(props.table);
  if (source.value === 'query' && !/^\s*(select|with)\b/i.test(queryText.value)) return '';
  const fmt = format.value === 'CSV' ? 'TYPE = CSV COMPRESSION = NONE' : `TYPE = ${format.value}`;
  const lines = [`COPY INTO @${fqnSql(stage.value)}${sub ? '/' + sub : ''}`, `FROM ${from}`, `FILE_FORMAT = (${fmt})`];
  if (format.value === 'CSV' && header.value) lines.push('HEADER = TRUE');
  if (overwrite.value) lines.push('OVERWRITE = TRUE');
  if (single.value) lines.push('SINGLE = TRUE');
  return lines.join('\n');
});

async function submit() {
  busy.value = true;
  error.value = '';
  const r = await sf.query(statement.value);
  busy.value = false;
  if (!r.ok) { error.value = r.error; return; }
  const rows = r.grids[0]?.rows?.[0]?.[0];
  sf.notify('success', `Unloaded ${rows ?? ''} row(s) to @${stage.value}`.replace('  ', ' '));
  emit('close');
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.ul__p { margin: 0; }
.ul__chk { align-self: end; padding-bottom: 6px; }
</style>
