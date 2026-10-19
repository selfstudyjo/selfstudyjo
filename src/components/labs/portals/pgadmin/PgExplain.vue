<template>
  <div class="pg-ex">
    <div v-if="!plan || !plan.root" class="pg-ex__empty">
      Use Explain/Explain Analyze button to generate the plan for a query. Alternatively, you can also execute
      "EXPLAIN (FORMAT JSON) [QUERY]".
    </div>
    <template v-else>
      <div class="pg-ex__tabs" role="tablist">
        <button v-for="t in TABS" :key="t" type="button" role="tab" :aria-selected="tab === t" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
        <span class="pg-ex__meta">
          <template v-if="plan.planningMs !== null">Planning Time: {{ fmt(plan.planningMs) }} ms</template>
          <template v-if="plan.executionMs !== null"> · Execution Time: {{ fmt(plan.executionMs) }} ms</template>
        </span>
      </div>

      <!-- ===== Graphical ===== -->
      <div v-if="tab === 'Graphical'" class="pg-ex__graph">
        <div class="pg-ex__zoom" role="toolbar" aria-label="Zoom">
          <button type="button" class="pg-btn pg-btn--icon pg-btn--sm" title="Zoom in" @click="zoom = Math.min(1.6, zoom + 0.1)">+</button>
          <button type="button" class="pg-btn pg-btn--icon pg-btn--sm" title="Zoom to original" @click="zoom = 1">1:1</button>
          <button type="button" class="pg-btn pg-btn--icon pg-btn--sm" title="Zoom out" @click="zoom = Math.max(0.5, zoom - 0.1)">−</button>
        </div>
        <div class="pg-ex__canvas" :style="{ width: layout.width * zoom + 'px', height: layout.height * zoom + 'px' }">
          <div class="pg-ex__inner" :style="{ width: layout.width + 'px', height: layout.height + 'px', transform: `scale(${zoom})` }">
            <svg class="pg-ex__arrows" :width="layout.width" :height="layout.height" aria-hidden="true">
              <defs>
                <marker :id="markerId" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0 0L10 5 0 10z" fill="#8a94a6" />
                </marker>
              </defs>
              <path v-for="e in layout.edges" :key="e.id" :d="e.d" fill="none" stroke="#8a94a6" :stroke-width="e.w" :marker-end="`url(#${markerId})`" />
            </svg>
            <button v-for="p in layout.nodes" :key="p.node.id" type="button" class="pg-ex__node"
                    :class="{ 'is-sel': selected === p.node.id, 'is-hot': hot(p.node) }"
                    :style="{ left: p.x + 'px', top: p.y + 'px' }" :title="tooltip(p.node)" @click="selected = selected === p.node.id ? 0 : p.node.id">
              <PgPlanIcon :name="planIcon(p.node.type)" :size="48" />
              <span class="pg-ex__type">{{ nodeLabel(p.node) }}</span>
              <span v-if="p.node.relation || p.node.index" class="pg-ex__rel">{{ subLabel(p.node) }}</span>
              <span class="pg-ex__nums">
                <span v-if="p.node.totalCost !== null">cost {{ c2(p.node.startupCost ?? 0) }}..{{ c2(p.node.totalCost) }}</span>
                <span>rows {{ p.node.actualRows !== null ? p.node.actualRows : p.node.planRows ?? '?' }}<template v-if="p.node.actualRows !== null && p.node.planRows !== null"> / est {{ p.node.planRows }}</template></span>
                <span v-if="p.node.actualTotal !== null" class="pg-ex__time">{{ t3(p.node.actualTotal) }} ms</span>
              </span>
            </button>
          </div>
        </div>
        <aside v-if="selectedNode" class="pg-ex__detail" aria-label="Node details">
          <header><strong>{{ nodeLabel(selectedNode) }}</strong>
            <button type="button" class="pg-btn pg-btn--icon pg-btn--sm" aria-label="Close" @click="selected = 0"><PgIcon name="close" :size="12" /></button></header>
          <table class="pg-table">
            <tbody>
              <tr v-for="row in detailRows(selectedNode)" :key="row[0]"><th>{{ row[0] }}</th><td>{{ row[1] }}</td></tr>
            </tbody>
          </table>
        </aside>
      </div>

      <!-- ===== Analysis ===== -->
      <div v-else-if="tab === 'Analysis'" class="pg-ex__scroll">
        <table class="pg-ex__an">
          <thead>
            <tr><th rowspan="2">#</th><th rowspan="2">Node</th><th colspan="2">Timings</th><th colspan="3">Rows</th><th rowspan="2">Loops</th></tr>
            <tr><th>Exclusive</th><th>Inclusive</th><th>Rows X</th><th>Actual</th><th>Plan</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in analysis" :key="r.node.id">
              <td class="is-num">{{ i + 1 }}.</td>
              <td class="pg-ex__nodecell" :style="{ paddingLeft: 8 + r.depth * 18 + 'px' }">
                <div><span v-if="r.depth" class="pg-ex__arrow">→</span> <strong>{{ nodeLabel(r.node) }}</strong><template v-if="r.node.index"> using {{ r.node.index }}</template><template v-if="r.node.relation"> on {{ r.node.relation }}<template v-if="r.node.alias && r.node.alias !== r.node.relation"> as {{ r.node.alias }}</template></template>
                  <span class="pg-muted"> (cost={{ c2(r.node.startupCost ?? 0) }}..{{ c2(r.node.totalCost ?? 0) }} rows={{ r.node.planRows ?? '?' }} width={{ r.node.width ?? '?' }})<template v-if="r.node.actualTotal !== null"> (actual time={{ t3(r.node.actualStartup ?? 0) }}..{{ t3(r.node.actualTotal) }} rows={{ r.node.actualRows }} loops={{ r.node.loops }})</template></span></div>
                <div v-for="d in r.node.details" :key="d[0]" class="pg-ex__d">{{ d[0] }}: {{ d[1] }}</div>
              </td>
              <td class="is-num" :class="'b' + r.exBand">{{ r.ex === null ? '' : fmt(r.ex) + ' ms' }}</td>
              <td class="is-num" :class="'b' + r.inBand">{{ r.node.actualTotal === null ? '' : fmt(r.node.actualTotal * r.node.loops) + ' ms' }}</td>
              <td class="is-num" :class="'b' + r.rowBand">{{ r.mis ? (r.mis.dir === 'up' ? '↑ ' : r.mis.dir === 'down' ? '↓ ' : '') + fmt(r.mis.factor) : '' }}</td>
              <td class="is-num">{{ r.node.actualRows ?? '' }}</td>
              <td class="is-num">{{ r.node.planRows ?? '' }}</td>
              <td class="is-num">{{ r.node.actualTotal === null ? '' : r.node.loops }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!plan.analyze" class="pg-ex__note">Timings and actual rows are only available for <strong>Explain Analyze</strong>.</p>
      </div>

      <!-- ===== Statistics ===== -->
      <div v-else class="pg-ex__scroll pg-ex__stats">
        <section>
          <h4>Statistics per Node Type</h4>
          <table class="pg-table">
            <thead><tr><th>Node type</th><th class="is-num">Count</th><th class="is-num">Time spent</th><th class="is-num">% of query</th></tr></thead>
            <tbody><tr v-for="s in byType" :key="s.type"><td>{{ s.type }}</td><td class="is-num">{{ s.count }}</td><td class="is-num">{{ s.ms === null ? '' : fmt(s.ms) + ' ms' }}</td><td class="is-num">{{ s.pct === null ? '' : s.pct.toFixed(2) + '%' }}</td></tr></tbody>
          </table>
        </section>
        <section>
          <h4>Statistics per Relation</h4>
          <table class="pg-table">
            <thead><tr><th>Relation name</th><th class="is-num">Scan count</th><th class="is-num">Total time</th><th class="is-num">% of query</th></tr></thead>
            <tbody>
              <tr v-if="!byRel.length"><td colspan="4" class="pg-muted">No rows found</td></tr>
              <tr v-for="s in byRel" :key="s.rel"><td>{{ s.rel }} <span class="pg-muted">({{ s.types.join(', ') }})</span></td><td class="is-num">{{ s.count }}</td><td class="is-num">{{ s.ms === null ? '' : fmt(s.ms) + ' ms' }}</td><td class="is-num">{{ s.pct === null ? '' : s.pct.toFixed(2) + '%' }}</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * The Query Tool's Explain tab: Graphical (node icons, arrows sized by rows,
 * cost / rows / time on every node, a details panel), Analysis (exclusive and
 * inclusive time, estimate vs actual with pgAdmin's misestimation colours) and
 * Statistics (per node type, per relation).
 */
import { computed, ref, watch } from 'vue';
import PgIcon from './PgIcon.vue';
import PgPlanIcon from './PgPlanIcon.vue';
import { band, exclusiveMs, flattenPlan, misestimate, nodeLabel, planIcon, type Plan, type PlanNode } from './pg';

const props = defineProps<{ plan: Plan | null }>();
const TABS = ['Graphical', 'Analysis', 'Statistics'] as const;
const tab = ref<(typeof TABS)[number]>('Graphical');
const zoom = ref(1);
const selected = ref(0);
const markerId = 'pg-ex-arrow-' + Math.random().toString(36).slice(2, 8);
watch(() => props.plan, () => { selected.value = 0; });

function fmt(n: number) {
  if (!Number.isFinite(n)) return '';
  return Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2).replace(/\.?0+$/, '') || '0';
}

function c2(n: number) { return Number.isFinite(n) ? n.toFixed(2) : ''; }
function t3(n: number) { return Number.isFinite(n) ? n.toFixed(3) : ''; }

const flat = computed(() => flattenPlan(props.plan?.root || null));
const totalMs = computed(() => {
  const root = props.plan?.root;
  if (!root || root.actualTotal === null) return null;
  return props.plan?.executionMs ?? root.actualTotal * root.loops;
});

const COL = 190;
const ROW = 150;
const layout = computed(() => {
  const nodes: { node: PlanNode; x: number; y: number }[] = [];
  const edges: { id: string; d: string; w: number }[] = [];
  const root = props.plan?.root;
  if (!root) return { nodes, edges, width: 200, height: 200 };
  let slot = 0;
  let maxDepth = 0;
  const pos = new Map<number, { x: number; y: number }>();
  const place = (n: PlanNode, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    let y: number;
    if (!n.children.length) y = slot++ * ROW;
    else {
      const ys = n.children.map(c => place(c, depth + 1));
      y = ((ys[0] ?? 0) + (ys[ys.length - 1] ?? 0)) / 2;
    }
    pos.set(n.id, { x: 20 + depth * COL, y: 16 + y });
    return y;
  };
  place(root, 0);
  const maxRows = Math.max(1, ...flat.value.map(f => (f.node.actualRows ?? f.node.planRows ?? 1) * (f.node.loops || 1)));
  for (const f of flat.value) {
    const p = pos.get(f.node.id)!;
    nodes.push({ node: f.node, x: p.x, y: p.y });
    for (const c of f.node.children) {
      const q = pos.get(c.id)!;
      const rowsC = (c.actualRows ?? c.planRows ?? 1) * (c.loops || 1);
      const w = 1.2 + 5 * Math.log10(1 + rowsC) / Math.log10(1 + maxRows);
      // Data flows from the child (right) into its parent (left): the arrow
      // leaves the child's icon and points at the parent's.
      const x1 = q.x + 49;
      const y1 = q.y + 28;
      const x2 = p.x + 104;
      const y2 = p.y + 28;
      const mid = (x1 + x2) / 2;
      edges.push({ id: `${f.node.id}-${c.id}`, w, d: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}` });
    }
  }
  return { nodes, edges, width: 40 + (maxDepth + 1) * COL, height: 40 + Math.max(1, slot) * ROW };
});

function subLabel(n: PlanNode) {
  if (n.index && n.relation) return `using ${n.index} on ${n.relation}`;
  if (n.index) return `using ${n.index}`;
  return `on ${n.relation}${n.alias && n.alias !== n.relation ? ' as ' + n.alias : ''}`;
}

function hot(n: PlanNode) {
  const ex = exclusiveMs(n);
  return ex !== null && totalMs.value ? (ex / totalMs.value) * 100 > 50 : false;
}

function detailRows(n: PlanNode): [string, string][] {
  const out: [string, string][] = [['Node Type', n.type]];
  if (n.joinType) out.push(['Join Type', n.joinType]);
  if (n.relation) out.push(['Relation Name', n.relation]);
  if (n.alias) out.push(['Alias', n.alias]);
  if (n.index) out.push(['Index Name', n.index]);
  if (n.startupCost !== null) out.push(['Startup Cost', c2(n.startupCost)]);
  if (n.totalCost !== null) out.push(['Total Cost', c2(n.totalCost)]);
  if (n.planRows !== null) out.push(['Plan Rows', String(n.planRows)]);
  if (n.width !== null) out.push(['Plan Width', String(n.width)]);
  if (n.actualStartup !== null) out.push(['Actual Startup Time', t3(n.actualStartup)]);
  if (n.actualTotal !== null) out.push(['Actual Total Time', t3(n.actualTotal)]);
  if (n.actualRows !== null) out.push(['Actual Rows', String(n.actualRows)]);
  if (n.actualTotal !== null) out.push(['Actual Loops', String(n.loops)]);
  return out.concat(n.details);
}

function tooltip(n: PlanNode) {
  return detailRows(n).map(r => `${r[0]}: ${r[1]}`).join('\n');
}

const selectedNode = computed(() => flat.value.find(f => f.node.id === selected.value)?.node || null);

const analysis = computed(() => flat.value.map(({ node, depth }) => {
  const ex = exclusiveMs(node);
  const total = totalMs.value;
  const mis = misestimate(node);
  return {
    node, depth, ex, mis,
    exBand: band(ex !== null && total ? (ex / total) * 100 : null, 'time'),
    inBand: band(node.actualTotal !== null && total ? (node.actualTotal * node.loops / total) * 100 : null, 'time'),
    rowBand: band(mis ? mis.factor : null, 'rows'),
  };
}));

const byType = computed(() => {
  const map = new Map<string, { type: string; count: number; ms: number | null }>();
  for (const { node } of flat.value) {
    const entry = map.get(node.type) || { type: node.type, count: 0, ms: null };
    entry.count += 1;
    const ex = exclusiveMs(node);
    if (ex !== null) entry.ms = (entry.ms ?? 0) + ex;
    map.set(node.type, entry);
  }
  return [...map.values()].map(e => ({ ...e, pct: e.ms !== null && totalMs.value ? (e.ms / totalMs.value) * 100 : null }))
    .sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0));
});
const byRel = computed(() => {
  const map = new Map<string, { rel: string; count: number; ms: number | null; types: string[] }>();
  for (const { node } of flat.value) {
    if (!node.relation) continue;
    const entry = map.get(node.relation) || { rel: node.relation, count: 0, ms: null, types: [] };
    entry.count += 1;
    if (!entry.types.includes(node.type)) entry.types.push(node.type);
    const ex = exclusiveMs(node);
    if (ex !== null) entry.ms = (entry.ms ?? 0) + ex;
    map.set(node.relation, entry);
  }
  return [...map.values()].map(e => ({ ...e, pct: e.ms !== null && totalMs.value ? (e.ms / totalMs.value) * 100 : null }));
});
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-ex { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.pg-ex__empty { padding: 14px; color: var(--pg-muted); font-size: 13px; }
.pg-ex__tabs { flex: none; display: flex; align-items: center; border-bottom: 1px solid var(--pg-border); background: var(--pg-grey-200); padding: 0 6px; flex-wrap: wrap; }
.pg-ex__tabs button { border: 0; background: none; padding: 6px 12px; font: inherit; font-size: 12.5px; color: var(--pg-muted); cursor: pointer; border-bottom: 2px solid transparent; }
.pg-ex__tabs button.is-active { color: var(--pg-primary); border-bottom-color: var(--pg-primary); font-weight: 600; }
.pg-ex__meta { margin-left: auto; font-size: 12px; color: var(--pg-muted); padding: 0 6px; }
.pg-ex__graph { position: relative; flex: 1; min-height: 0; overflow: auto; background: #fbfcfd; }
.pg-ex__zoom { position: sticky; top: 6px; left: 6px; z-index: 3; display: inline-flex; gap: 4px; margin: 6px; padding: 3px; background: #fff; border: 1px solid var(--pg-border); border-radius: var(--pg-radius); }
.pg-ex__canvas { position: relative; }
.pg-ex__inner { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.pg-ex__arrows { position: absolute; left: 0; top: 0; }
.pg-ex__node {
  position: absolute; width: 150px; display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center;
  border: 1px solid transparent; border-radius: 6px; background: transparent; padding: 2px 4px 4px; font: inherit; cursor: pointer; color: var(--pg-text);
}
.pg-ex__node:hover { background: #fff; border-color: var(--pg-border); }
.pg-ex__node.is-sel { background: var(--pg-tree-selected); border-color: var(--pg-primary); }
.pg-ex__node.is-hot .pg-ex__time { color: #fff; background: #cc0000; }
.pg-ex__type { font-size: 12px; font-weight: 600; line-height: 1.25; }
.pg-ex__rel { font-size: 11px; color: var(--pg-muted); line-height: 1.25; overflow-wrap: anywhere; }
.pg-ex__nums { display: flex; flex-direction: column; font-size: 10.5px; color: #44506a; line-height: 1.3; font-family: var(--pg-mono); }
.pg-ex__time { align-self: center; padding: 0 4px; border-radius: 3px; background: #e7f5ea; color: #1b5e20; }
.pg-ex__detail { position: sticky; float: right; top: 6px; right: 6px; margin: 6px; width: 300px; max-height: calc(100% - 12px); overflow: auto; z-index: 4; background: #fff; border: 1px solid var(--pg-border); border-radius: var(--pg-radius); box-shadow: 0 4px 12px rgba(0, 0, 0, .12); }
.pg-ex__detail header { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-bottom: 1px solid var(--pg-border); background: var(--pg-grey-200); font-size: 13px; }
.pg-ex__detail th { width: 44%; font-weight: 400; color: var(--pg-muted); position: static; background: #fff; }
.pg-ex__detail td { overflow-wrap: anywhere; font-family: var(--pg-mono); font-size: 12px; }
.pg-ex__scroll { flex: 1; min-height: 0; overflow: auto; }
.pg-ex__an { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.pg-ex__an th { background: var(--pg-grey-200); border: 1px solid var(--pg-border); padding: 4px 8px; font-weight: 600; position: sticky; top: 0; }
.pg-ex__an thead tr:nth-child(2) th { top: 25px; }
.pg-ex__an td { border: 1px solid var(--pg-border); padding: 4px 8px; vertical-align: top; }
.pg-ex__an .is-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pg-ex__nodecell { font-family: var(--pg-mono); font-size: 12px; }
.pg-ex__arrow { color: var(--pg-muted); }
.pg-ex__d { color: #44506a; padding-left: 16px; }
.b1 { background: #ffe4b5; }
.b2 { background: #ff6347; color: #fff; }
.b3 { background: #880000; color: #fff; }
.pg-ex__note { margin: 8px 10px; font-size: 12px; color: var(--pg-muted); }
.pg-ex__stats { padding: 10px; display: flex; flex-direction: column; gap: 14px; }
.pg-ex__stats h4 { margin: 0 0 6px; font-size: 13px; }
</style>
