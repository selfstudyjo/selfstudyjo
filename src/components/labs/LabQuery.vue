<template>
  <div class="sl-query">
    <div class="sl-console__head">
      <div class="sl-console__title">
        <Database class="sl-i" />
        <span>{{ $t(tool.label) }}</span>
        <span v-if="tool.simulated" class="sl-tag sl-tag--sim">{{ $t('Simulated') }}</span>
        <span v-else class="sl-tag sl-tag--real">{{ $t('Real') }}</span>
      </div>
      <div class="sl-console__actions">
        <button type="button" class="sl-btn sl-btn--primary sl-btn--sm"
                :disabled="busy || !statement.trim()" @click="submit">
          <Play class="sl-i" /> {{ $t('Run') }}
        </button>
        <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                @click="clear">
          <Eraser class="sl-i" /> {{ $t('Clear') }}
        </button>
      </div>
    </div>

    <p v-if="tool.fidelity" class="sl-console__fidelity">{{ tool.fidelity }}</p>

    <!-- LTR always. SQL is a machine language: mirrored, the bidi algorithm
         moves the parentheses and the commas and a copied statement no longer
         parses. -->
    <textarea
      v-model="statement"
      class="sl-query__editor"
      dir="ltr"
      spellcheck="false"
      rows="7"
      :placeholder="$t('Write a statement and press Run, or Ctrl+Enter')"
      @keydown.ctrl.enter.prevent="submit"
      @keydown.meta.enter.prevent="submit"
    ></textarea>

    <div v-if="busy" class="sl-query__status">{{ $t('Running...') }}</div>

    <div v-else-if="error" class="sl-query__error" dir="ltr">
      <AlertTriangle class="sl-i" />
      <pre>{{ error }}</pre>
    </div>

    <div v-else-if="report" class="sl-query__report" dir="ltr">
      <pre>{{ report }}</pre>
    </div>

    <div v-if="columns.length" class="sl-query__results">
      <div class="sl-query__meta">
        {{ $t('{v0} row(s)', { v0: rows.length }) }}
        <span v-if="truncated" class="sl-tag sl-tag--warn">{{ $t('Truncated') }}</span>
      </div>
      <!-- `sl-scroll` and `min-width: min(100%, ...)` on the table: a result set
           with a uuid or a long path in it must scroll rather than push the
           whole workbench sideways. Same trap `exam-system.css` documents. -->
      <div class="sl-scroll">
        <table class="sl-table">
          <thead>
            <tr><th v-for="name in columns" :key="name">{{ name }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="index">
              <td v-for="name in columns" :key="name">{{ cell(row[name]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="ranOnce && !error && !report" class="sl-query__status">
      {{ $t('The statement ran and returned no rows.') }}
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The SQL-shaped tools: the SQL editor, and Hive.
 *
 * Two answer shapes, because two backends: the real SQLite path returns
 * `{columns, rows}` and the Hive path returns formatted TEXT with the execution
 * plan above the table — and that text is the point of the Hive tool, so it is
 * rendered rather than parsed back into a grid.
 *
 * `columns` is taken from the response and never derived from the first row's
 * keys, which matters for a query whose first row happens to hold a NULL in a
 * column: `Object.keys` on that row would drop the column from every row.
 */
import { computed, ref } from 'vue';
import { AlertTriangle, Database, Eraser, Play } from 'lucide-vue-next';
import type { LabTool } from '@/utils/labCatalogue';

const props = defineProps<{
  tool: LabTool;
  initial?: string;
  run: (statement: string) => Promise<{
    ok: boolean; output?: string; error?: string;
    columns?: string[]; rows?: Array<Record<string, unknown>>;
    truncated?: boolean;
  }>;
}>();

const statement = ref(props.initial || '');
const busy = ref(false);
const error = ref('');
const report = ref('');
const columns = ref<string[]>([]);
const rows = ref<Array<Record<string, unknown>>>([]);
const truncated = ref(false);
const ranOnce = ref(false);

function clear() {
  error.value = '';
  report.value = '';
  columns.value = [];
  rows.value = [];
  ranOnce.value = false;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

async function submit() {
  const text = statement.value.trim();
  if (!text || busy.value) return;
  busy.value = true;
  clear();
  try {
    const result = await props.run(text);
    ranOnce.value = true;
    if (result?.error) error.value = result.error;
    if (result?.columns?.length) {
      columns.value = result.columns;
      rows.value = result.rows || [];
      truncated.value = Boolean(result.truncated);
    } else if (result?.rows?.length) {
      // The real SQLite path answers with dicts and no explicit column list on
      // some paths; fall back to the union of every row's keys rather than the
      // first row's, so a NULL in row one does not lose a column.
      const names: string[] = [];
      for (const row of result.rows) {
        for (const key of Object.keys(row || {})) {
          if (!names.includes(key)) names.push(key);
        }
      }
      columns.value = names;
      rows.value = result.rows;
      truncated.value = Boolean(result.truncated);
    }
    if (result?.output) report.value = result.output;
  } finally {
    busy.value = false;
  }
}
</script>
