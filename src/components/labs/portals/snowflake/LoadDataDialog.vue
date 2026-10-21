<template>
  <SfModal title="Load Data into Table" :subtitle="target || 'Choose a table'" ok-text="Load" :busy="busy" :ok-disabled="!statement || done"
           :sql="statement" :error="error" :width="720" @close="$emit('close')" @ok="submit">
    <template v-if="!done">
      <div class="sf-row">
        <label class="sf-field"><span class="sf-label">Table</span>
          <select v-model="target" class="sf-select"><option value="" disabled>Select a table</option>
            <option v-for="t in tables" :key="t" :value="t">{{ t }}</option></select></label>
        <label class="sf-field"><span class="sf-label">Stage</span>
          <select v-model="stage" class="sf-select"><option value="" disabled>Select a stage</option>
            <option v-for="s in stages" :key="s.fqn" :value="s.fqn">{{ s.fqn }}</option></select></label>
      </div>
      <div class="ld__files">
        <div class="ld__fhead">
          <strong>Files on @{{ stage || '…' }}</strong>
          <span class="sf-spacer"></span>
          <label class="sf-check"><input v-model="usePattern" type="radio" :value="false" /> Pick files</label>
          <label class="sf-check"><input v-model="usePattern" type="radio" :value="true" /> Pattern</label>
          <button type="button" class="sf-btn sf-btn--sm" :disabled="!stage || listing" @click="listFiles"><SfIcon name="refresh" /> List</button>
        </div>
        <label v-if="usePattern" class="sf-field"><span class="sf-label">PATTERN (regular expression on the path)</span>
          <input v-model="pattern" class="sf-input sf-mono" placeholder=".*orders.*[.]csv" /></label>
        <label class="sf-field"><span class="sf-label">Path under the stage (optional)</span>
          <input v-model="path" class="sf-input sf-mono" placeholder="raw/orders/" /></label>
        <div v-if="!usePattern" class="ld__list">
          <p v-if="listing" class="sf-muted">Listing…</p>
          <p v-else-if="!files.length" class="sf-muted">No files listed. Choose a stage and press List.</p>
          <label v-for="f in shownFiles" :key="f.rel" class="sf-check ld__file">
            <input v-model="picked" type="checkbox" :value="f.rel" /><span class="sf-mono">{{ f.rel }}</span><span class="sf-muted sf-small">{{ fmtBytes(f.size) }}</span></label>
        </div>
      </div>
      <div class="sf-row">
        <label class="sf-field"><span class="sf-label">File format</span>
          <select v-model="format" class="sf-select">
            <option value="">Inline: CSV</option><option value="JSON">Inline: JSON</option><option value="PARQUET">Inline: PARQUET</option>
            <option v-for="f in formats" :key="f" :value="'@' + f">Named: {{ f }}</option>
          </select></label>
        <label class="sf-field"><span class="sf-label">On error</span>
          <select v-model="onError" class="sf-select"><option value="ABORT_STATEMENT">Do not load any data (ABORT_STATEMENT)</option>
            <option value="CONTINUE">Continue loading valid data (CONTINUE)</option><option value="SKIP_FILE">Skip the file (SKIP_FILE)</option></select></label>
      </div>
      <div v-if="format === ''" class="sf-row">
        <label class="sf-field"><span class="sf-label">Header lines to skip</span><input v-model="skipHeader" class="sf-input" inputmode="numeric" /></label>
        <label class="sf-field"><span class="sf-label">Field delimiter</span>
          <select v-model="delimiter" class="sf-select"><option value=",">Comma</option><option value="|">Pipe</option><option value=";">Semicolon</option><option value="\t">Tab</option></select></label>
        <label class="sf-field"><span class="sf-label">Field optionally enclosed by</span>
          <select v-model="enclosed" class="sf-select"><option value="">None</option><option value="&quot;">Double quote</option></select></label>
      </div>
      <label v-if="format === 'PARQUET' || format === 'JSON'" class="sf-check"><input v-model="matchByName" type="checkbox" /> Match columns by name (MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE)</label>
      <label class="sf-check"><input v-model="force" type="checkbox" /> Load files that were already loaded (FORCE = TRUE)</label>
    </template>
    <template v-else>
      <p class="ld__ok"><SfIcon name="check-circle" /> Load finished. Rows are in <b class="sf-mono">{{ target }}</b>.</p>
      <ResultPane :result="result" :running="false" />
    </template>
    <template v-if="done" #footer>
      <button type="button" class="sf-btn" @click="openTable">View table</button>
      <button type="button" class="sf-btn sf-btn--primary" @click="$emit('close')">Done</button>
    </template>
  </SfModal>
</template>

<script setup lang="ts">
/**
 * Load Data into Table: Snowsight's wizard in front of COPY INTO. It lists the
 * stage (LIST @stage), lets the student pick files or a pattern and a file
 * format, and runs the COPY INTO it shows - whose per-file result grid is what
 * Snowsight shows when a load finishes.
 */
import { computed, ref, watch } from 'vue';
import SfModal from './SfModal.vue';
import SfIcon from './SfIcon.vue';
import ResultPane from './ResultPane.vue';
import { useSf, type QueryResult } from './sfContext';
import { fmtBytes, fqnSql, list, splitFqn, str } from './snowflake';

const props = defineProps<{ table?: string; stage?: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const sf = useSf();
const view = sf.view;

const tables = computed(() => list.tables(view.value).filter(t => !t.dropped && String(t.kind || 'TABLE').toUpperCase() !== 'VIEW').map(t => t.fqn));
const stages = computed(() => list.stages(view.value));
const formats = computed(() => list.fileFormats(view.value).map(f => f.fqn || f.name));
const target = ref(props.table || '');
const stage = ref(props.stage || stages.value[0]?.fqn || '');
const usePattern = ref(false);
const pattern = ref('');
const path = ref('');
const picked = ref<string[]>([]);
const format = ref('');
const onError = ref('ABORT_STATEMENT');
const skipHeader = ref('1');
const delimiter = ref(',');
const enclosed = ref('"');
const matchByName = ref(true);
const force = ref(false);
const busy = ref(false);
const error = ref('');
const done = ref(false);
const result = ref<QueryResult | null>(null);
const listing = ref(false);
const files = ref<{ rel: string; size: number }[]>([]);

const stageUrl = computed(() => String(stages.value.find(s => s.fqn === stage.value)?.url || '').replace(/\/?$/, '/'));
const shownFiles = computed(() => files.value.filter(f => !path.value.trim() || f.rel.startsWith(path.value.trim().replace(/^\/+/, ''))));

async function listFiles() {
  if (!stage.value) return;
  listing.value = true;
  const r = await sf.query(`LIST @${fqnSql(stage.value)}`, { unlogged: true });
  listing.value = false;
  const grid = r.grids[0];
  const nameCol = Math.max(0, grid?.columns.findIndex(c => /name/i.test(c)) ?? 0);
  const sizeCol = grid?.columns.findIndex(c => /size/i.test(c)) ?? -1;
  files.value = (grid?.rows || []).map(row => {
    const full = String(row[nameCol] ?? '');
    const rel = stageUrl.value && full.startsWith(stageUrl.value) ? full.slice(stageUrl.value.length) : full.replace(/^[a-z0-9]+:\/\/[^/]+\//i, '');
    return { rel, size: Number(sizeCol >= 0 ? row[sizeCol] : 0) || 0 };
  });
  picked.value = picked.value.filter(p => files.value.some(f => f.rel === p));
}
watch(stage, () => { files.value = []; picked.value = []; void listFiles(); }, { immediate: true });

const statement = computed(() => {
  if (!target.value || !stage.value) return '';
  if (!usePattern.value && !picked.value.length) return '';
  if (usePattern.value && !pattern.value.trim()) return '';
  const sub = path.value.trim().replace(/^\/+/, '');
  const from = `@${fqnSql(stage.value)}${sub ? '/' + sub.replace(/[^\w./=-]/g, '') : ''}`;
  const lines = [`COPY INTO ${fqnSql(target.value)}`, `FROM ${from}`];
  if (usePattern.value) lines.push(`PATTERN = ${str(pattern.value.trim())}`);
  else {
    const rel = picked.value.map(p => (sub && p.startsWith(sub) ? p.slice(sub.length).replace(/^\/+/, '') : p));
    lines.push(`FILES = (${rel.map(str).join(', ')})`);
  }
  if (format.value.startsWith('@')) lines.push(`FILE_FORMAT = (FORMAT_NAME = ${str(format.value.slice(1))})`);
  else if (format.value) lines.push(`FILE_FORMAT = (TYPE = ${format.value})`);
  else {
    const skip = /^\d+$/.test(skipHeader.value.trim()) ? skipHeader.value.trim() : '0';
    const parts = [`TYPE = CSV`, `SKIP_HEADER = ${skip}`, `FIELD_DELIMITER = ${str(delimiter.value)}`];
    if (enclosed.value) parts.push(`FIELD_OPTIONALLY_ENCLOSED_BY = ${str(enclosed.value)}`);
    lines.push(`FILE_FORMAT = (${parts.join(' ')})`);
  }
  if ((format.value === 'PARQUET' || format.value === 'JSON') && matchByName.value) lines.push('MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE');
  lines.push(`ON_ERROR = ${str(onError.value)}`);
  if (force.value) lines.push('FORCE = TRUE');
  return lines.join('\n');
});

async function submit() {
  if (!statement.value) return;
  busy.value = true;
  error.value = '';
  const r = await sf.query(statement.value);
  busy.value = false;
  if (!r.ok) { error.value = r.error; return; }
  result.value = r;
  done.value = true;
  sf.notify('success', `Data loaded into ${splitFqn(target.value).slice(-1)[0]}`);
}
function openTable() {
  const [db, schema] = splitFqn(target.value);
  emit('close');
  sf.go({ page: 'databases', db, schema, kind: 'tables', object: target.value });
}
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.ld__files { display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--sf-border); border-radius: var(--sf-radius); padding: 10px; }
.ld__fhead { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ld__list { max-height: 200px; overflow: auto; display: flex; flex-direction: column; gap: 2px; }
.ld__file { display: flex; gap: 8px; align-items: center; }
.ld__file .sf-mono { flex: 1; overflow-wrap: anywhere; }
.ld__ok { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--sf-ok); }
</style>
