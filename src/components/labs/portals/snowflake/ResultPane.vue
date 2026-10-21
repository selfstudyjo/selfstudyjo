<template>
  <div class="rp">
    <div class="rp__bar">
      <div class="rp__views" role="tablist">
        <button type="button" role="tab" class="rp__view" :class="{ 'is-active': mode === 'results' }" :aria-selected="mode === 'results'" @click="mode = 'results'">
          <SfIcon name="table" /> Results
        </button>
        <button type="button" role="tab" class="rp__view" :class="{ 'is-active': mode === 'chart' }" :aria-selected="mode === 'chart'"
                :disabled="!grid || !chartable" @click="mode = 'chart'">
          <SfIcon name="chart" /> Chart
        </button>
        <button type="button" role="tab" class="rp__view" :class="{ 'is-active': mode === 'profile' }" :aria-selected="mode === 'profile'"
                :disabled="!result" @click="mode = 'profile'">
          <SfIcon name="graph" /> Query Profile
        </button>
      </div>
      <span v-if="result && result.grids.length > 1" class="rp__sets">
        <button v-for="(g, i) in result.grids" :key="i" type="button" class="sf-chip" :class="{ 'is-on': gridIndex === i }" @click="gridIndex = i">
          {{ g.title || 'Result ' + (i + 1) }}
        </button>
      </span>
      <span class="sf-spacer"></span>
      <span v-if="result && result.ok && grid" class="rp__meta">
        {{ fmtNum(grid.total) }} row{{ grid.total === 1 ? '' : 's' }}<template v-if="grid.total > grid.rows.length"> · showing first {{ grid.rows.length }}</template>
      </span>
      <span v-if="grid && result && result.ok" class="sf-rel rp__dl">
        <button type="button" class="sf-btn sf-btn--ghost sf-btn--sm" title="Copy results" aria-label="Copy results" @click="copyRows"><SfIcon name="copy" /></button>
        <button type="button" class="sf-btn sf-btn--ghost sf-btn--sm" title="Download results" aria-label="Download results" :aria-expanded="dlOpen" @click="dlOpen = !dlOpen"><SfIcon name="download" /></button>
        <span v-if="dlOpen" class="sf-menu rp__dlmenu" @mouseleave="dlOpen = false">
          <button type="button" @click="download(',')">Download as .csv</button>
          <button type="button" @click="download('\t')">Download as .tsv</button>
        </span>
      </span>
      <button v-if="grid" type="button" class="sf-btn sf-btn--ghost sf-btn--sm" :title="showSide ? 'Hide details' : 'Show details'" @click="showSide = !showSide">
        <SfIcon name="panel-left" />
      </button>
    </div>

    <div class="rp__body">
      <div v-if="running" class="sf-empty"><span class="rp__spinner" aria-hidden="true"></span><strong>Running…</strong></div>
      <div v-else-if="!result" class="sf-empty">
        <SfIcon name="play" />
        <strong>Run a query to see results</strong>
        <span>Ctrl+Enter runs the statement under the cursor. Ctrl+Shift+Enter runs all.</span>
      </div>
      <div v-else-if="!result.ok" class="rp__error">
        <div class="sf-alert sf-alert--error"><SfIcon name="x-circle" /><span class="rp__errtext">{{ result.error }}</span></div>
      </div>
      <template v-else-if="mode === 'profile'">
        <QueryProfile :profile="result.profile" />
      </template>
      <template v-else-if="!grid">
        <div class="sf-empty">
          <SfIcon name="check-circle" />
          <strong>Statement executed successfully.</strong>
          <pre v-if="result.output" class="sf-code rp__out">{{ result.output }}</pre>
        </div>
      </template>
      <div v-else class="rp__main">
        <div v-if="mode === 'results'" class="rp__scroll">
          <table class="rp__table">
            <thead>
              <tr>
                <th class="rp__rownum" aria-label="Row"></th>
                <th v-for="(col, ci) in grid.columns" :key="ci" :class="{ 'is-focus': focusCol === ci }" @click="focusCol = focusCol === ci ? -1 : ci">
                  {{ col }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in grid.rows" :key="ri">
                <td class="rp__rownum">{{ ri + 1 }}</td>
                <td v-for="(cell, ci) in row" :key="ci" :class="{ 'is-null': cell === null, 'is-num': typeof cell === 'number', 'is-focus': focusCol === ci }"
                    :title="cell === null ? 'NULL' : String(cell)">{{ cell === null ? 'NULL' : cell }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="rp__chart">
          <div class="rp__chartctl">
            <label>Bars <select v-model.number="chartY" class="sf-select">
              <option v-for="i in numericCols" :key="i" :value="i">{{ grid.columns[i] }}</option>
            </select></label>
            <label>X-axis <select v-model.number="chartX" class="sf-select">
              <option v-for="(c, i) in grid.columns" :key="i" :value="i">{{ c }}</option>
            </select></label>
          </div>
          <svg class="rp__svg" :viewBox="`0 0 ${chart.width} 260`" preserveAspectRatio="none" role="img" :aria-label="'Bar chart of ' + grid.columns[chartY]">
            <line x1="40" :x2="chart.width" y1="230" y2="230" class="rp__axis" />
            <g v-for="(bar, i) in chart.bars" :key="i">
              <rect :x="bar.x" :y="bar.y" :width="bar.w" :height="bar.h" rx="2" class="rp__barrect"><title>{{ bar.label }}: {{ bar.value }}</title></rect>
              <text :x="bar.x + bar.w / 2" y="246" text-anchor="middle" class="rp__tick">{{ bar.short }}</text>
            </g>
            <text x="36" y="20" text-anchor="end" class="rp__tick">{{ chart.maxLabel }}</text>
            <text x="36" y="230" text-anchor="end" class="rp__tick">0</text>
          </svg>
        </div>

        <aside v-if="showSide" class="rp__side">
          <section class="rp__sec">
            <h4>Query details</h4>
            <div class="rp__kv"><span>Query duration</span><b>{{ fmtMs(result.elapsedMs) }}</b></div>
            <div class="rp__kv"><span>Rows</span><b>{{ fmtNum(grid.total) }}</b></div>
            <div v-if="result.queryId" class="rp__kv"><span>Query ID</span>
              <button type="button" class="sf-link sf-mono rp__qid" :title="result.queryId" @click="$emit('open-query', result.queryId)">{{ result.queryId }}</button>
            </div>
            <div v-if="result.profile?.fromResultCache" class="rp__kv"><span>Result</span><b>Reused from cache</b></div>
          </section>
          <section class="rp__sec">
            <h4>Columns</h4>
            <button v-for="(s, ci) in stats" :key="ci" type="button" class="rp__col" :class="{ 'is-focus': focusCol === ci }" @click="focusCol = focusCol === ci ? -1 : ci">
              <span class="rp__colhead">
                <span class="rp__coltype">{{ s.kind === 'number' ? '#' : s.kind === 'date' ? '◷' : s.kind === 'bool' ? '◐' : 'Aa' }}</span>
                <b>{{ s.name }}</b>
                <span class="rp__nulls">{{ s.count ? Math.round((s.nulls / s.count) * 100) : 0 }}% null</span>
              </span>
              <span v-if="s.histogram.length" class="rp__hist" aria-hidden="true">
                <i v-for="(h, hi) in s.histogram" :key="hi" :style="{ height: Math.max(2, (h / Math.max(...s.histogram)) * 100) + '%' }"></i>
              </span>
              <span v-if="s.kind === 'number'" class="rp__range"><span>{{ s.min }}</span><span>{{ s.max }}</span></span>
              <span v-else-if="s.kind === 'date'" class="rp__range"><span>{{ s.min }}</span><span>{{ s.max }}</span></span>
              <template v-else-if="focusCol === ci && s.top.length">
                <span v-for="[v, n] in s.top" :key="v" class="rp__top"><span class="rp__topv">{{ v }}</span><span>{{ n }}</span></span>
              </template>
              <span v-else class="rp__range"><span>{{ s.distinct }} distinct</span></span>
            </button>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * A worksheet's result pane: the grid, the column-stats sidebar, the chart
 * and the query profile, as Snowsight lays them out below the editor.
 */
import { computed, ref, watch } from 'vue';
import SfIcon from './SfIcon.vue';
import QueryProfile from './QueryProfile.vue';
import type { QueryResult } from './sfContext';
import { columnStats, fmtMs, fmtNum } from './snowflake';

const props = defineProps<{ result: QueryResult | null; running?: boolean }>();
defineEmits<{ (event: 'open-query', id: string): void }>();

const mode = ref<'results' | 'chart' | 'profile'>('results');
const gridIndex = ref(0);
const focusCol = ref(-1);
const showSide = ref(true);

watch(() => props.result?.id, () => {
  gridIndex.value = Math.max(0, (props.result?.grids.length || 1) - 1);
  focusCol.value = -1;
  if (mode.value === 'chart') mode.value = 'results';
});

const grid = computed(() => props.result?.grids[gridIndex.value] || null);

/* ---------- Copy / Download results (as Snowsight's result toolbar) ---------- */
const dlOpen = ref(false);
function delimited(sep: string): string {
  const g = grid.value;
  if (!g) return '';
  const cell = (v: unknown) => {
    const text = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return sep === ',' && /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text.replace(/[\t\n\r]/g, ' ');
  };
  return [g.columns.map(cell).join(sep), ...g.rows.map(r => r.map(cell).join(sep))].join('\n') + '\n';
}
function download(sep: string) {
  dlOpen.value = false;
  const text = delimited(sep);
  if (!text) return;
  const ext = sep === ',' ? 'csv' : 'tsv';
  const url = URL.createObjectURL(new Blob([text], { type: ext === 'csv' ? 'text/csv;charset=utf-8' : 'text/tab-separated-values;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(props.result?.queryId || 'results').slice(0, 36)}.${ext}`;
  a.rel = 'noopener';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copyRows() {
  try { await navigator.clipboard.writeText(delimited('\t')); } catch { /* refused by the browser */ }
}
const stats = computed(() => (grid.value ? grid.value.columns.map((_, i) => columnStats(grid.value!, i)) : []));
const numericCols = computed(() => stats.value.map((s, i) => (s.kind === 'number' ? i : -1)).filter(i => i >= 0));
const chartable = computed(() => numericCols.value.length > 0);
const chartY = ref(0);
const chartX = ref(0);
watch(grid, () => {
  chartY.value = numericCols.value[numericCols.value.length - 1] ?? 0;
  chartX.value = stats.value.findIndex((s, i) => s.kind !== 'number' && i !== chartY.value);
  if (chartX.value < 0) chartX.value = 0;
}, { immediate: true });

const chart = computed(() => {
  const g = grid.value;
  const width = 760;
  if (!g) return { width, bars: [], maxLabel: '' };
  const rows = g.rows.slice(0, 40);
  const values = rows.map(r => Number(r[chartY.value]) || 0);
  const max = Math.max(1, ...values);
  const slot = (width - 48) / Math.max(1, rows.length);
  const bars = rows.map((r, i) => {
    const h = (values[i] / max) * 210;
    const label = String(r[chartX.value] ?? '');
    return { x: 44 + i * slot + slot * 0.15, w: slot * 0.7, y: 230 - h, h, value: values[i], label, short: label.length > 8 ? label.slice(0, 7) + '…' : label };
  });
  return { width, bars, maxLabel: fmtNum(max) };
});
</script>

<style scoped src="./sf.css"></style>
<style scoped>
.rp { display: flex; flex-direction: column; min-height: 0; flex: 1; background: var(--sf-bg); }
.rp__bar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-bottom: 1px solid var(--sf-border); flex: none; flex-wrap: wrap; }
.rp__views { display: flex; gap: 2px; background: var(--sf-hover); padding: 2px; border-radius: 6px; }
.rp__view { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border: 0; border-radius: 5px; background: none; font: inherit; font-size: 12px; color: var(--sf-text-2); cursor: pointer; }
.rp__view.is-active { background: var(--sf-bg); color: var(--sf-text); box-shadow: 0 1px 2px rgba(30, 37, 47, .12); font-weight: 600; }
.rp__view:disabled { opacity: .45; cursor: not-allowed; }
.rp__view .sf-ico { width: 14px; height: 14px; }
.rp__sets { display: flex; gap: 6px; flex-wrap: wrap; }
.rp__meta { font-size: 12px; color: var(--sf-text-2); }
.rp__body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.rp__body > .sf-empty { flex: 1; justify-content: center; }
.rp__out { max-width: 100%; text-align: left; max-height: 200px; }
.rp__error { padding: 12px; overflow: auto; }
.rp__errtext { white-space: pre-wrap; font-family: var(--sf-mono); font-size: 12px; }
.rp__main { flex: 1; min-height: 0; display: flex; }
.rp__scroll { flex: 1; min-width: 0; overflow: auto; }
.rp__table { border-collapse: separate; border-spacing: 0; font-size: 12px; font-family: var(--sf-mono); min-width: 100%; }
.rp__table th {
  position: sticky; top: 0; z-index: 1; text-align: left; font-family: var(--sf-font); font-weight: 600; font-size: 12px; color: var(--sf-text);
  background: var(--sf-bg-2); border-bottom: 1px solid var(--sf-border); border-right: 1px solid var(--sf-border); padding: 6px 10px; white-space: nowrap; cursor: pointer;
}
.rp__table td { padding: 4px 10px; border-bottom: 1px solid var(--sf-border); border-right: 1px solid var(--sf-border); white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis; color: var(--sf-text); }
.rp__table td.is-num { text-align: right; }
.rp__table td.is-null { color: var(--sf-text-3); font-style: italic; }
.rp__table .is-focus { background: var(--sf-selected) !important; }
.rp__table tbody tr:hover td { background: var(--sf-row-hover); }
.rp__rownum { position: sticky; left: 0; background: var(--sf-bg-2) !important; color: var(--sf-text-3) !important; text-align: right !important; width: 36px; font-size: 11px; }
.rp__side { width: 260px; flex: none; border-left: 1px solid var(--sf-border); overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 14px; }
.rp__sec { display: flex; flex-direction: column; gap: 6px; }
.rp__sec h4 { margin: 0; font-size: 12px; font-weight: 600; color: var(--sf-text-2); text-transform: uppercase; letter-spacing: .04em; }
.rp__kv { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; min-width: 0; }
.rp__kv span { color: var(--sf-text-2); flex: none; }
.rp__kv b { font-weight: 500; }
.rp__qid { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.rp__col { display: flex; flex-direction: column; gap: 4px; padding: 8px; border: 1px solid var(--sf-border); border-radius: 6px; background: var(--sf-bg); text-align: left; cursor: pointer; font: inherit; color: var(--sf-text); }
.rp__col:hover { border-color: var(--sf-border-strong); }
.rp__col.is-focus { border-color: var(--sf-primary); background: var(--sf-selected); }
.rp__colhead { display: flex; align-items: center; gap: 6px; font-size: 12px; min-width: 0; }
.rp__colhead b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.rp__coltype { flex: none; width: 20px; height: 18px; border-radius: 4px; background: var(--sf-tag); color: var(--sf-text-2); font-size: 10px; display: grid; place-items: center; font-weight: 600; }
.rp__nulls { font-size: 11px; color: var(--sf-text-3); flex: none; }
.rp__hist { display: flex; align-items: flex-end; gap: 2px; height: 28px; }
.rp__hist i { flex: 1; background: #7EB0F5; border-radius: 1px 1px 0 0; }
.rp__range { display: flex; justify-content: space-between; gap: 6px; font-size: 11px; color: var(--sf-text-2); font-family: var(--sf-mono); }
.rp__top { display: flex; justify-content: space-between; gap: 6px; font-size: 11px; color: var(--sf-text-2); }
.rp__topv { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; color: var(--sf-text); }
.rp__chart { flex: 1; min-width: 0; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; overflow: auto; }
.rp__chartctl { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: var(--sf-text-2); }
.rp__chartctl label { display: inline-flex; align-items: center; gap: 6px; }
.rp__chartctl .sf-select { height: 28px; }
.rp__svg { width: 100%; height: 260px; }
.rp__axis { stroke: var(--sf-border-strong); }
.rp__barrect { fill: #29B5E8; }
.rp__barrect:hover { fill: #1A6CE7; }
.rp__tick { font-size: 10px; fill: var(--sf-text-2); font-family: var(--sf-font); }
.rp__spinner { width: 24px; height: 24px; border: 3px solid var(--sf-hover); border-top-color: var(--sf-primary); border-radius: 50%; animation: rp-spin .8s linear infinite; }
@keyframes rp-spin { to { transform: rotate(360deg); } }
@container sl-portal (max-width: 900px) {
  .rp__side { display: none; }
}
</style>
<style scoped>
.rp__dl { display: inline-flex; gap: 2px; }
.rp__dlmenu { right: 0; top: calc(100% + 4px); min-width: 170px; }
</style>
