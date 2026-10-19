<template>
  <div class="pg-qt">
    <!-- ===== Query Tool toolbar ===== -->
    <div class="pg-qt__bar" role="toolbar" aria-label="Query Tool">
      <div class="pg-qt__group">
        <button type="button" class="pg-qt__tb" title="Edit" aria-haspopup="menu" @click.stop="menuFor('edit', $event)">
          <PgIcon name="format" /><PgIcon name="caret-down" :size="10" /></button>
      </div>
      <div v-if="tab.kind === 'data'" class="pg-qt__group">
        <button type="button" class="pg-qt__tb" :class="{ 'is-on': filterOpen }" title="Sort/Filter" @click="filterOpen = !filterOpen"><PgIcon name="filter" /></button>
      </div>
      <div class="pg-qt__group">
        <button type="button" class="pg-qt__tb pg-qt__tb--run" :disabled="running" :title="tab.kind === 'data' ? 'Refresh (F5)' : 'Execute script (F5)'" @click="execute()">
          <PgIcon :name="tab.kind === 'data' ? 'refresh' : 'play'" /></button>
        <button type="button" class="pg-qt__tb pg-qt__tb--split" title="Execute options" aria-haspopup="menu" @click.stop="menuFor('exec', $event)"><PgIcon name="caret-down" :size="10" /></button>
        <button type="button" class="pg-qt__tb" :disabled="!running" title="Cancel query"><PgIcon name="stop" /></button>
        <button type="button" class="pg-qt__tb" :disabled="running || tab.kind === 'data'" title="Explain (F7)" @click="explain(false)"><PgIcon name="explain" /></button>
        <button type="button" class="pg-qt__tb" :disabled="running || tab.kind === 'data'" title="Explain Analyze (Shift+F7)" @click="explain(true)"><PgIcon name="explain-analyze" /></button>
        <button type="button" class="pg-qt__tb pg-qt__tb--split" title="Explain Settings" aria-haspopup="menu" @click.stop="menuFor('explain', $event)"><PgIcon name="caret-down" :size="10" /></button>
      </div>
      <div class="pg-qt__group">
        <button type="button" class="pg-qt__tb" :disabled="autoCommit || !txOpen || running" title="Commit" @click="endTx('COMMIT')"><PgIcon name="commit" /></button>
        <button type="button" class="pg-qt__tb" :disabled="autoCommit || !txOpen || running" title="Rollback" @click="endTx('ROLLBACK')"><PgIcon name="rollback" /></button>
      </div>
      <div class="pg-qt__conn" :title="'Connection: ' + connLabel">
        <span class="pg-qt__dot" :class="{ 'is-tx': txOpen, 'is-busy': running }" />
        <span class="pg-qt__connlabel">{{ connLabel }}</span>
      </div>
    </div>

    <!-- ===== Sort/Filter (View/Edit Data) ===== -->
    <div v-if="tab.kind === 'data' && filterOpen" class="pg-qt__filter">
      <label class="pg-qt__flabel">SQL Filter<input v-model="filterWhere" class="pg-input pg-mono" placeholder="e.g. status = 'paid'" aria-label="SQL Filter" @keydown.enter="applyFilter" /></label>
      <label class="pg-qt__flabel">Order by<input v-model="filterOrder" class="pg-input pg-mono" placeholder="e.g. order_ts DESC" aria-label="Order by" @keydown.enter="applyFilter" /></label>
      <button type="button" class="pg-btn pg-btn--primary pg-btn--sm" @click="applyFilter">OK</button>
      <button type="button" class="pg-btn pg-btn--sm" @click="filterWhere = ''; filterOrder = ''; applyFilter()">Clear</button>
    </div>

    <!-- ===== Editor | Results ===== -->
    <div class="pg-qt__split" :style="{ gridTemplateRows: editorRows }">
      <div class="pg-qt__editor">
        <PgEditor ref="editor" v-model="sql" :label="tab.title" @run="execute()" @explain="explain" @cursor="(l, c) => { cursor = [l, c]; }" />
        <div v-if="running" class="pg-qt__wait" role="status"><span class="pg-qt__spin" />Waiting for the query to complete...</div>
      </div>
      <div class="pg-qt__hsplit" role="separator" aria-orientation="horizontal" aria-label="Resize editor" tabindex="0"
           @pointerdown="startSplit" @keydown.up.prevent="editorPct = Math.max(12, editorPct - 4)" @keydown.down.prevent="editorPct = Math.min(80, editorPct + 4)" />
      <div class="pg-qt__results">
        <div class="pg-qt__rtabs" role="tablist">
          <button v-for="t in RESULT_TABS" :key="t.id" type="button" role="tab" :aria-selected="bottom === t.id"
                  :class="{ 'is-active': bottom === t.id }" @click="bottom = t.id">{{ t.label }}</button>
        </div>
        <PgDataGrid v-if="bottom === 'data'" :grid="grid" :types="gridTypes" :editable="editable" :pk-index="pkIndex"
                    :read-only-why="readOnlyWhy" @save="saveData" @copied="n => ctx.notify('info', `${n} row(s) copied to the clipboard.`)" />
        <pre v-else-if="bottom === 'messages'" class="pg-qt__msgs" :class="{ 'is-err': lastError }">{{ messages || 'No messages.' }}</pre>
        <div v-else-if="bottom === 'notifications'" class="pg-qt__note">No notifications. <span class="pg-muted">(LISTEN/NOTIFY payloads received on this connection appear here.)</span></div>
        <PgExplain v-else-if="bottom === 'explain'" :plan="plan" />
        <div v-else class="pg-qh">
          <ul class="pg-qh__list" role="listbox" aria-label="Query history">
            <li v-if="!historyRows.length" class="pg-muted pg-qh__none">No history found</li>
            <li v-for="h in historyRows" :key="h.key" role="option" :aria-selected="historyKey === h.key"
                :class="{ 'is-sel': historyKey === h.key }" @click="historyKey = h.key">
              <PgIcon :name="h.ok ? 'check-circle' : 'error-circle'" :size="13" :class="h.ok ? 'pg-ok' : 'pg-bad'" />
              <span class="pg-qh__sql">{{ h.sql.split('\n')[0] }}</span>
              <span class="pg-qh__time">{{ h.when }}</span>
            </li>
          </ul>
          <div v-if="historyItem" class="pg-qh__detail">
            <div class="pg-qh__btns">
              <button type="button" class="pg-btn pg-btn--sm" @click="copyText(historyItem.sql)"><PgIcon name="copy" :size="13" />Copy</button>
              <button type="button" class="pg-btn pg-btn--sm" @click="sql = historyItem.sql; bottom = 'data'"><PgIcon name="paste" :size="13" />Copy to Query Editor</button>
            </div>
            <dl class="pg-qh__meta">
              <dt>Date</dt><dd>{{ historyItem.when }}</dd>
              <dt>Rows affected</dt><dd>{{ historyItem.rows ?? '' }}</dd>
              <dt>Duration</dt><dd>{{ historyItem.ms === null ? '' : historyItem.ms + ' msec' }}</dd>
              <dt>Source</dt><dd>{{ historyItem.source }}</dd>
              <dt v-if="historyItem.message">Message</dt><dd v-if="historyItem.message">{{ historyItem.message }}</dd>
            </dl>
            <PgCode :sql="historyItem.sql" />
          </div>
        </div>
      </div>
    </div>

    <!-- ===== status bar ===== -->
    <footer class="pg-qt__status">
      <span>Total rows: {{ grid ? grid.total : 0 }}<template v-if="grid && grid.total > grid.rows.length"> (showing {{ grid.rows.length }})</template></span>
      <span v-if="lastMs !== null">Query complete {{ duration(lastMs) }}</span>
      <span class="pg-qt__grow" />
      <span>{{ txOpen ? 'Transaction: open' : 'Idle' }}</span>
      <span>Ln {{ cursor[0] }}, Col {{ cursor[1] }}</span>
    </footer>

    <PgMenu v-if="menu" :items="menu.items" :x="menu.x" :y="menu.y" @close="menu = null" />
  </div>
</template>

<script setup lang="ts">
/**
 * pgAdmin's Query Tool (and its View/Edit Data mode).
 *
 * Execute (F5) runs the editor text - or the selection - on the `pg_sql`
 * surface, which is the PostgreSQL Query Tool tool of the same engine: the
 * statement is logged as the student's own, so a lab task written against it
 * passes whichever way it was run. Explain / Explain Analyze wrap the text in
 * EXPLAIN with the ticked options and draw the plan the engine attaches (or,
 * failing that, the plan parsed from EXPLAIN's text output).
 */
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { errorText } from '../../../../utils/portalKit';
import PgIcon from './PgIcon.vue';
import PgEditor from './PgEditor.vue';
import PgDataGrid from './PgDataGrid.vue';
import PgExplain from './PgExplain.vue';
import PgCode from './PgCode.vue';
import PgMenu from './PgMenu.vue';
import { PG, type MenuItem, type QueryTab } from './pgContext';
import {
  columnType, explainSql, fqn, gridsOf, messagesOf, normalizePlan, parsePlanText, qi, queryToolUrl, sqlLiteral,
  type DataChanges, type ExplainOptions, type Grid, type Plan,
} from './pg';

const props = defineProps<{ tab: QueryTab; active: boolean }>();
const ctx = inject(PG)!;
const model = ctx.model;

const RESULT_TABS = [
  { id: 'data', label: 'Data Output' }, { id: 'messages', label: 'Messages' }, { id: 'notifications', label: 'Notifications' },
  { id: 'explain', label: 'Explain' }, { id: 'history', label: 'Query History' },
] as const;
type Bottom = (typeof RESULT_TABS)[number]['id'];

const editor = ref<InstanceType<typeof PgEditor> | null>(null);
const sql = ref(props.tab.sql || '');
const bottom = ref<Bottom>('data');
const grid = ref<Grid | null>(null);
const gridTable = ref('');
const messages = ref('');
const lastError = ref(false);
const lastMs = ref<number | null>(null);
const plan = ref<Plan | null>(null);
const running = ref(false);
const cursor = ref<[number, number]>([1, 1]);
const autoCommit = ref(true);
const autoRollback = ref(false);
const txOpen = ref(false);
const explainOpts = ref<ExplainOptions>({ verbose: false, costs: true, buffers: false, timing: true, summary: false });
const menu = ref<{ items: MenuItem[]; x: number; y: number } | null>(null);
const filterOpen = ref(Boolean(props.tab.filter));
const filterWhere = ref('');
const filterOrder = ref('');

interface HistoryEntry { key: string; sql: string; ok: boolean; ms: number | null; rows: number | null; when: string; source: string; message: string }
const history = ref<HistoryEntry[]>([]);
const historyKey = ref('');

const connLabel = computed(() => `${model.value.database}/postgres@${model.value.server}`);
const editorPct = ref(props.tab.kind === 'data' ? 20 : 36);
const editorRows = computed(() => `minmax(60px, ${editorPct.value}%) 6px minmax(0, 1fr)`);

function startSplit(event: PointerEvent) {
  const box = (event.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
  if (!box) return;
  const move = (e: PointerEvent) => { editorPct.value = Math.max(12, Math.min(80, ((e.clientY - box.top) / box.height) * 100)); };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

watch(() => props.active, on => {
  if (on) ctx.location(queryToolUrl(props.tab.id, model.value.database, props.tab.kind === 'data' ? 'table' : '', props.tab.table || ''));
}, { immediate: true });

/* ---------- executing ---------- */

function sqlState(message: string): string {
  if (/relation .* does not exist|no such table/i.test(message)) return '42P01';
  if (/column .* does not exist|no such column/i.test(message)) return '42703';
  if (/syntax error/i.test(message)) return '42601';
  if (/already exists/i.test(message)) return '42P07';
  if (/unique|duplicate key/i.test(message)) return '23505';
  if (/not.null|NOT NULL constraint/i.test(message)) return '23502';
  if (/foreign key/i.test(message)) return '23503';
  return 'XX000';
}

function now(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function duration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `00:00:${String(s).padStart(2, '0')}.${String(Math.round(ms % 1000)).padStart(3, '0')}`;
}

async function runText(text: string, opts: { explainOf?: string; keepTab?: boolean } = {}) {
  if (!text.trim()) {
    ctx.notify('warning', 'Query Tool', 'There is nothing to execute: the editor is empty.');
    return null;
  }
  let toSend = text;
  if (!autoCommit.value && !txOpen.value && !/^\s*(begin|commit|rollback)\b/i.test(text)) {
    toSend = 'BEGIN;\n' + text;
  }
  running.value = true;
  const started = performance.now();
  const result = await ctx.runSql(toSend, { quiet: true });
  const ms = Math.max(1, Math.round(performance.now() - started));
  running.value = false;
  lastMs.value = ms;
  if (toSend !== text && result.ok) txOpen.value = true;
  const grids = gridsOf(result);
  const body = messagesOf(result);
  let affected: number | null = null;
  if (result.ok) {
    lastError.value = false;
    const isPlan = Boolean(opts.explainOf) || /^\s*explain\b/i.test(text);
    if (isPlan) {
      const raw = (result.data as any)?.plan;
      plan.value = (raw ? normalizePlan(raw, (result.data as any)?.plan_meta) : null) || parsePlanText(String(result.output || ''));
    }
    if (grids.length && !isPlan) {
      const lastGrid = grids[grids.length - 1] || null;
      grid.value = lastGrid;
      gridTable.value = props.tab.kind === 'data' ? props.tab.table || '' : (text.match(/\bfrom\s+(?:public\.)?"?([a-z_][a-z0-9_]*)/i)?.[1] || '');
      affected = lastGrid?.total ?? 0;
      messages.value = `${body ? body + '\n\n' : ''}Successfully run. Total query runtime: ${ms} msec.\n${affected} rows affected.`;
    } else {
      const m = body.match(/(?:INSERT 0|UPDATE|DELETE|SELECT)\s+(\d+)/);
      affected = m ? Number(m[1]) : null;
      messages.value = `${body || 'Query OK'}\n\nQuery returned successfully in ${ms} msec.`;
    }
    bottom.value = isPlan ? 'explain' : grids.length ? 'data' : opts.keepTab ? bottom.value : 'messages';
  } else {
    lastError.value = true;
    const message = errorText(result);
    messages.value = `ERROR:  ${message}\n\nSQL state: ${sqlState(message)}`;
    bottom.value = 'messages';
    if (txOpen.value && autoRollback.value) {
      await ctx.runSql('ROLLBACK;', { quiet: true, unlogged: true });
      txOpen.value = false;
      messages.value += '\n\nThe transaction was rolled back (Auto rollback on error).';
    }
  }
  history.value = [{
    key: 'l' + Date.now() + Math.random(), sql: text, ok: Boolean(result.ok), ms, rows: affected, when: now(),
    source: 'This Query Tool', message: result.ok ? '' : errorText(result),
  }, ...history.value].slice(0, 100);
  return result;
}

function currentText() {
  const picked = editor.value?.selection() || '';
  return picked.trim() ? picked : sql.value;
}

async function execute() {
  await runText(currentText());
}

async function explain(analyze: boolean) {
  const text = currentText().trim();
  if (!text) {
    ctx.notify('warning', 'Query Tool', 'There is nothing to explain: the editor is empty.');
    return;
  }
  const first = text.split(/;\s*(?=\S)/)[0] ?? text;
  await runText(explainSql(first, analyze, explainOpts.value), { explainOf: first });
}

async function endTx(word: 'COMMIT' | 'ROLLBACK') {
  const result = await ctx.runSql(word + ';', { quiet: true });
  txOpen.value = false;
  messages.value = result.ok ? `${word}\n\nQuery returned successfully.` : `ERROR:  ${errorText(result)}`;
  lastError.value = !result.ok;
  bottom.value = 'messages';
}

/* ---------- View/Edit Data ---------- */

const dataTable = computed(() => (props.tab.kind === 'data' && props.tab.table ? ctx.table(props.tab.table) : undefined));
const gridTypes = computed(() => {
  const g = grid.value;
  if (!g) return [];
  return g.columns.map((c, i) => columnType(model.value, c, g.rows.map(r => (r as unknown[])[i]), gridTable.value || undefined));
});
const pkIndex = computed(() => {
  const t = dataTable.value;
  const g = grid.value;
  if (!t || !g) return -1;
  const pk = t.columns.find(c => c.pk);
  return pk ? g.columns.indexOf(pk.name) : -1;
});
const editable = computed(() => props.tab.kind === 'data' && pkIndex.value >= 0 && Boolean(grid.value));
const readOnlyWhy = computed(() => (props.tab.kind === 'data'
  ? 'The table has no primary key, so its rows cannot be identified for editing.'
  : 'Query results are read-only. Use View/Edit Data on a table with a primary key to edit rows.'));

function dataSql(): string {
  const t = dataTable.value;
  if (!t) return sql.value;
  const pk = t.columns.find(c => c.pk);
  const order = filterOrder.value.trim() || (pk ? `${qi(pk.name)} ${props.tab.limit === 'last' ? 'DESC' : 'ASC'}` : '');
  let out = `SELECT * FROM ${fqn(t.schema, t.name)}`;
  if (filterWhere.value.trim()) out += `\nWHERE ${filterWhere.value.trim()}`;
  if (order) out += `\nORDER BY ${order}`;
  if (props.tab.limit !== 'all') out += '\nLIMIT 100';
  return out;
}

async function applyFilter() {
  sql.value = dataSql();
  filterOpen.value = false;
  await runText(sql.value);
}

async function saveData(changes: DataChanges) {
  const t = dataTable.value;
  if (!t) return;
  const pk = t.columns.find(c => c.pk);
  if (!pk) return;
  const type = (col: string) => t.columns.find(c => c.name === col)?.type || 'text';
  const name = fqn(t.schema, t.name);
  const stmts: string[] = [];
  for (const u of changes.updates) {
    const sets = Object.entries(u.values).map(([col, value]) => `${qi(col)} = ${sqlLiteral(value, type(col))}`);
    if (sets.length) stmts.push(`UPDATE ${name}\n\tSET ${sets.join(', ')}\n\tWHERE ${qi(pk.name)} = ${sqlLiteral(u.pk, pk.type)};`);
  }
  for (const ins of changes.inserts) {
    const cols = Object.keys(ins);
    stmts.push(`INSERT INTO ${name} (${cols.map(qi).join(', ')})\n\tVALUES (${cols.map(c => sqlLiteral(ins[c], type(c))).join(', ')});`);
  }
  if (changes.deletes.length) {
    stmts.push(`DELETE FROM ${name}\n\tWHERE ${qi(pk.name)} IN (${changes.deletes.map(v => sqlLiteral(v, pk.type)).join(', ')});`);
  }
  if (!stmts.length) return;
  const text = stmts.join('\n');
  const result = await ctx.runSql(text, { quiet: true });
  history.value = [{ key: 's' + Date.now(), sql: text, ok: result.ok, ms: null, rows: stmts.length, when: now(),
    source: 'Save Data Changes', message: result.ok ? '' : errorText(result) }, ...history.value];
  if (result.ok) {
    ctx.notify('success', 'Data saved successfully.');
    await runText(sql.value, { keepTab: true });
  } else {
    lastError.value = true;
    messages.value = `ERROR:  ${errorText(result)}\n\nSQL state: ${sqlState(errorText(result))}\n\nThe data changes were not saved.`;
    bottom.value = 'messages';
    ctx.notify('error', 'Saving data changes failed', errorText(result));
  }
}

/* ---------- menus ---------- */

function formatSql(text: string) {
  return text.replace(/\s+/g, ' ').trim()
    .replace(/\b(select|from|where|group by|order by|having|limit|offset|insert into|values|update|set|delete from|left join|right join|inner join|full join|join|union all|union|with|returning)\b/gi,
      (w, _m, i) => (i === 0 ? '' : '\n') + w.toUpperCase())
    .replace(/\b(and|or|on|as|in|is|not|null|distinct|case|when|then|else|end|asc|desc|count|sum|avg|min|max)\b/gi, w => w.toUpperCase())
    .replace(/,\s*/g, ', ');
}

function toggleComment() {
  const lines = sql.value.split('\n');
  const all = lines.every(l => !l.trim() || l.trimStart().startsWith('--'));
  sql.value = lines.map(l => (all ? l.replace(/^(\s*)--\s?/, '$1') : l.trim() ? '-- ' + l : l)).join('\n');
}

function menuFor(which: 'edit' | 'exec' | 'explain', event: MouseEvent) {
  const host = (event.currentTarget as HTMLElement);
  const root = host.closest('.pg-qt') as HTMLElement;
  const a = host.getBoundingClientRect();
  const b = root.getBoundingClientRect();
  const x = Math.max(0, Math.min(a.left - b.left, b.width - 230));
  const y = a.bottom - b.top + 2;
  const tick = (on: boolean) => (on ? 'commit' : undefined);
  let items: MenuItem[] = [];
  if (which === 'edit') {
    items = [
      { label: 'Format SQL', shortcut: 'Ctrl+K', action: () => { sql.value = formatSql(sql.value); } },
      { label: 'Toggle Comment', shortcut: 'Ctrl+/', action: toggleComment },
      { label: 'Upper Case', action: () => { sql.value = sql.value.toUpperCase(); } },
      { label: 'Lower Case', action: () => { sql.value = sql.value.toLowerCase(); } },
      { sep: true },
      { label: 'Clear Query', action: () => { sql.value = ''; } },
    ];
  } else if (which === 'exec') {
    items = [
      { label: 'Auto commit?', icon: tick(autoCommit.value), action: () => { autoCommit.value = !autoCommit.value; } },
      { label: 'Auto rollback on error?', icon: tick(autoRollback.value), action: () => { autoRollback.value = !autoRollback.value; } },
    ];
  } else {
    const o = explainOpts.value;
    const flip = (k: keyof ExplainOptions) => () => { explainOpts.value = { ...o, [k]: !o[k] }; };
    items = [
      { label: 'Verbose', icon: tick(o.verbose), action: flip('verbose') },
      { label: 'Costs', icon: tick(o.costs), action: flip('costs') },
      { label: 'Buffers', icon: tick(o.buffers), action: flip('buffers') },
      { label: 'Timing', icon: tick(o.timing), action: flip('timing') },
      { label: 'Summary', icon: tick(o.summary), action: flip('summary') },
    ];
  }
  menu.value = { items, x, y };
}

function closeMenu() { menu.value = null; }
onMounted(() => {
  window.addEventListener('mousedown', closeMenu);
  if (props.tab.kind === 'data') sql.value = dataSql();
  if (props.tab.autorun && !props.tab.filter) execute();
  else editor.value?.focus();
});
onBeforeUnmount(() => window.removeEventListener('mousedown', closeMenu));

/* ---------- history ---------- */

const historyRows = computed<HistoryEntry[]>(() => {
  const server = model.value.queries.slice().reverse().map((q, i) => ({
    key: 'v' + q.id + ':' + i, sql: q.sql, ok: true, ms: q.ms, rows: q.rows, when: q.at || '',
    source: q.planKind ? `server log (${q.planKind})` : 'server log', message: '',
  }));
  const local = new Set(history.value.map(h => h.sql.trim()));
  return history.value.concat(server.filter(s => !local.has(s.sql.trim())));
});
const historyItem = computed(() => historyRows.value.find(h => h.key === historyKey.value) || historyRows.value[0] || null);

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    ctx.notify('info', 'Query copied to the clipboard.');
  } catch { /* ignored */ }
}
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-qt { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; background: #fff; }
.pg-qt__bar { flex: none; display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-bottom: 1px solid var(--pg-border); background: var(--pg-grey-200); flex-wrap: wrap; }
.pg-qt__group { display: inline-flex; align-items: center; border: 1px solid var(--pg-btn-border); border-radius: var(--pg-radius); background: #fff; overflow: hidden; }
.pg-qt__tb {
  height: 28px; min-width: 30px; padding: 0 6px; border: 0; border-right: 1px solid var(--pg-border); background: #fff;
  color: var(--pg-text); display: inline-flex; align-items: center; justify-content: center; gap: 2px; cursor: pointer;
}
.pg-qt__tb:last-child { border-right: 0; }
.pg-qt__tb:hover:not(:disabled) { background: var(--pg-hover); }
.pg-qt__tb:disabled { color: var(--pg-grey-800); opacity: .6; cursor: not-allowed; }
.pg-qt__tb.is-on { background: var(--pg-primary-light); }
.pg-qt__tb--run:not(:disabled) { color: var(--pg-primary); }
.pg-qt__tb--split { min-width: 18px; padding: 0 3px; }
.pg-qt__conn { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; height: 28px; border: 1px solid var(--pg-btn-border); border-radius: var(--pg-radius); background: #fff; font-size: 12.5px; min-width: 0; max-width: 100%; }
.pg-qt__connlabel { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pg-qt__dot { width: 9px; height: 9px; border-radius: 50%; background: #26852b; flex: none; }
.pg-qt__dot.is-tx { background: #ea7b00; }
.pg-qt__dot.is-busy { background: #326690; }
.pg-qt__filter { flex: none; display: flex; align-items: flex-end; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--pg-border); background: #fffdf3; flex-wrap: wrap; }
.pg-qt__flabel { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--pg-muted); flex: 1 1 200px; }
.pg-qt__split { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr); }
.pg-qt__editor { position: relative; display: flex; min-height: 0; }
.pg-qt__hsplit { cursor: row-resize; background: var(--pg-grey-400); border-top: 1px solid var(--pg-border); border-bottom: 1px solid var(--pg-border); }
.pg-qt__hsplit:hover, .pg-qt__hsplit:focus-visible { background: var(--pg-primary-light-2); outline: none; }
.pg-qt__wait { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 10px; background: rgba(255, 255, 255, .7); font-size: 13px; color: var(--pg-text); }
.pg-qt__spin { width: 18px; height: 18px; border-radius: 50%; border: 3px solid var(--pg-primary-light-2); border-top-color: var(--pg-primary); animation: pg-spin .8s linear infinite; }
@keyframes pg-spin { to { transform: rotate(360deg); } }
.pg-qt__results { min-height: 0; display: flex; flex-direction: column; }
.pg-qt__rtabs { flex: none; display: flex; border-bottom: 1px solid var(--pg-border); background: #fff; overflow-x: auto; }
.pg-qt__rtabs button { border: 0; background: none; padding: 6px 12px; font: inherit; font-size: 12.5px; color: var(--pg-muted); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
.pg-qt__rtabs button.is-active { color: var(--pg-primary); border-bottom-color: var(--pg-primary); font-weight: 600; }
.pg-qt__msgs { flex: 1; min-height: 0; margin: 0; padding: 10px 12px; overflow: auto; font-family: var(--pg-mono); font-size: 12.5px; color: var(--pg-text); white-space: pre-wrap; overflow-wrap: anywhere; }
.pg-qt__msgs.is-err { color: #b00020; background: #fdf3f3; }
.pg-qt__note { padding: 12px; font-size: 13px; }
.pg-qt__status { flex: none; display: flex; align-items: center; gap: 16px; padding: 3px 10px; border-top: 1px solid var(--pg-border); background: var(--pg-grey-200); font-size: 12px; color: var(--pg-muted); flex-wrap: wrap; }
.pg-qt__grow { flex: 1; }
.pg-qh { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(200px, 38%) minmax(0, 1fr); }
.pg-qh__list { margin: 0; padding: 0; list-style: none; overflow: auto; border-right: 1px solid var(--pg-border); }
.pg-qh__list li { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-bottom: 1px solid var(--pg-border); cursor: pointer; font-size: 12.5px; }
.pg-qh__list li.is-sel { background: var(--pg-tree-selected); }
.pg-qh__list li:hover:not(.is-sel) { background: var(--pg-grey-200); }
.pg-qh__none { cursor: default !important; }
.pg-qh__sql { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--pg-mono); font-size: 12px; }
.pg-qh__time { color: var(--pg-muted); font-size: 11px; white-space: nowrap; }
.pg-qh__detail { min-width: 0; overflow: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; }
.pg-qh__btns { display: flex; gap: 6px; flex-wrap: wrap; }
.pg-qh__meta { margin: 0; display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 3px 8px; font-size: 12.5px; }
.pg-qh__meta dt { color: var(--pg-muted); }
.pg-qh__meta dd { margin: 0; overflow-wrap: anywhere; }
.pg-ok { color: #26852b; }
.pg-bad { color: #cc0000; }
@container sl-portal (max-width: 760px) {
  .pg-qh { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(90px, 40%) minmax(0, 1fr); }
  .pg-qh__list { border-right: 0; border-bottom: 1px solid var(--pg-border); }
}
</style>
