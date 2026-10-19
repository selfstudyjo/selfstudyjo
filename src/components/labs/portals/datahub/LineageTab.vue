<template>
  <div class="dh-lin">
    <div class="dh-lin__bar">
      <label class="dh-lin__ctl">Upstream
        <select v-model.number="up" class="dh-select dh-lin__sel" aria-label="Upstream hops">
          <option v-for="n in [0, 1, 2, 3, 4, 5]" :key="'u' + n" :value="n">{{ n === 0 ? 'Hidden' : n + (n === 1 ? ' hop' : ' hops') }}</option>
        </select>
      </label>
      <label class="dh-lin__ctl">Downstream
        <select v-model.number="down" class="dh-select dh-lin__sel" aria-label="Downstream hops">
          <option v-for="n in [0, 1, 2, 3, 4, 5]" :key="'d' + n" :value="n">{{ n === 0 ? 'Hidden' : n + (n === 1 ? ' hop' : ' hops') }}</option>
        </select>
      </label>
      <button type="button" class="dh-btn dh-btn--sm" @click="expandAll"><DhIcon name="plus" /> Expand all</button>
      <button v-if="expanded.size" type="button" class="dh-btn dh-btn--sm" @click="expanded = new Set()">Collapse</button>
      <span class="dh-spacer" />
      <span class="dh-muted dh-small">{{ graph.nodes.length - 1 }} related · {{ graph.edges.length }} edges</span>
      <div class="dh-lin__zoom" role="group" aria-label="Zoom">
        <button type="button" class="dh-btn dh-btn--sm dh-btn--icon" title="Zoom out" aria-label="Zoom out" @click="zoom(-0.15)"><DhIcon name="zoom-out" /></button>
        <span class="dh-lin__pct">{{ Math.round(scale * 100) }}%</span>
        <button type="button" class="dh-btn dh-btn--sm dh-btn--icon" title="Zoom in" aria-label="Zoom in" @click="zoom(0.15)"><DhIcon name="zoom-in" /></button>
        <button type="button" class="dh-btn dh-btn--sm dh-btn--icon" title="Reset zoom" aria-label="Reset zoom" @click="scale = 1"><DhIcon name="fit" /></button>
      </div>
    </div>

    <div class="dh-lin__stage">
      <div class="dh-lin__canvas">
        <svg :width="layout.width * scale" :height="layout.height * scale" :viewBox="`0 0 ${layout.width} ${layout.height}`"
             class="dh-lin__svg" role="img" :aria-label="'Lineage of ' + shortName(entity.urn)">
          <defs>
            <marker id="dh-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" fill="#8c8c8c" />
            </marker>
            <marker id="dh-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" fill="#1677ff" />
            </marker>
          </defs>
          <text v-for="col in layout.columns" :key="'h' + col.level" :x="col.x + NODE_W / 2" y="18" text-anchor="middle" class="dh-lin__colhead">
            {{ col.level === 0 ? 'This dataset' : col.level < 0 ? 'Upstream ' + -col.level : 'Downstream ' + col.level }}
          </text>
          <g v-for="e in layout.edges" :key="e.key" class="dh-lin__edge" :class="{ 'is-hot': e.hot }">
            <path :d="e.d" fill="none" :marker-end="e.hot ? 'url(#dh-arrow-hot)' : 'url(#dh-arrow)'" />
            <title>{{ e.from }} → {{ e.to }}{{ e.via ? '  (via ' + e.via + ')' : '' }}</title>
          </g>
          <g v-for="n in layout.nodes" :key="n.urn" class="dh-lin__node"
             :class="{ 'is-center': n.level === 0, 'is-selected': selected === n.urn, 'is-missing': !n.known }"
             :transform="`translate(${n.x},${n.y})`" tabindex="0" role="button"
             :aria-label="shortName(n.urn) + (n.known ? '' : ' (not in catalogue)')"
             @click="select(n.urn)" @dblclick="open(n.urn)" @keydown.enter="open(n.urn)"
             @mouseenter="hover = n.urn" @mouseleave="hover = ''">
            <rect :width="NODE_W" :height="NODE_H" rx="8" class="dh-lin__box" />
            <rect v-if="n.level === 0" :width="5" :height="NODE_H" rx="2" class="dh-lin__bar-accent" />
            <g transform="translate(12,9)"><PlatformIcon :platform="platformOf(n.urn)" :size="20" /></g>
            <text x="42" y="25" class="dh-lin__name">{{ clip(shortName(n.urn), 22) }}</text>
            <text x="42" y="44" class="dh-lin__sub">{{ platformLabel(platformOf(n.urn)) }} · {{ clip(browsePath(n.urn).join('.') || subtypeOf(platformOf(n.urn)), 20) }}</text>
            <g v-if="n.badge" :transform="`translate(${NODE_W - 22},10)`">
              <circle r="7" cx="6" cy="6" :class="n.badge === 'bad' ? 'dh-lin__bad' : 'dh-lin__ok'" />
              <title>{{ n.badge === 'bad' ? 'Failing assertions or active incident' : 'Assertions passing' }}</title>
            </g>
            <g v-if="n.expandable" class="dh-lin__expand" :transform="`translate(${n.level < 0 ? -11 : NODE_W - 11},${NODE_H / 2 - 11})`"
               @click.stop="expand(n.urn)">
              <circle cx="11" cy="11" r="10" />
              <path d="M11 6v10M6 11h10" />
              <title>Show more {{ n.level < 0 ? 'upstream' : 'downstream' }}</title>
            </g>
          </g>
        </svg>
      </div>

      <aside v-if="preview" class="dh-lin__preview">
        <div class="dh-row"><PlatformIcon :platform="platformOf(preview.urn)" :size="20" />
          <b class="dh-lin__pname">{{ shortName(preview.urn) }}</b><span class="dh-spacer" />
          <button type="button" class="dh-btn dh-btn--text dh-btn--sm dh-btn--icon" aria-label="Close preview" @click="selected = ''"><DhIcon name="close" /></button>
        </div>
        <div class="dh-mono dh-muted">{{ preview.urn }}</div>
        <template v-if="preview.dataset">
          <p class="dh-lin__pdesc" :class="{ 'dh-muted': !preview.dataset.description }">{{ preview.dataset.description || 'No description' }}</p>
          <div class="dh-small"><b>Owners:</b> {{ preview.dataset.owners.map(o => o.owner).join(', ') || '—' }}</div>
          <div class="dh-small"><b>Domain:</b> {{ preview.dataset.domain || '—' }}</div>
          <div class="dh-row"><span v-for="t in preview.dataset.tags" :key="t" class="dh-tag"><span class="dh-tag__dot" :style="{ background: tagColor(t) }" />{{ t }}</span></div>
          <div class="dh-small"><b>Columns:</b> {{ preview.dataset.columns.length }} · <b>Up</b> {{ preview.dataset.upstream }} · <b>Down</b> {{ preview.dataset.downstream }}</div>
          <button type="button" class="dh-btn dh-btn--primary" @click="open(preview.urn)"><DhIcon name="external" /> View dataset</button>
        </template>
        <div v-else class="dh-alert dh-alert--warning"><DhIcon name="warning" /><div>This upstream is referenced by lineage but was never ingested into the catalogue.</div></div>
        <div v-if="preview.via.length" class="dh-small"><b>Connected via:</b> <span class="dh-mono">{{ preview.via.join(', ') }}</span></div>
      </aside>
    </div>
    <p class="dh-hint">Click a node to preview it, double-click to open it. Use the + handle to expand one more hop.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import DhIcon from './DhIcon.vue';
import PlatformIcon from './PlatformIcon.vue';
import {
  browsePath, buildLineage, dh as cmd, platformLabel, platformOf, sameDataset, shortName, subtypeOf, tagColor,
  useDh, type DhDataset,
} from './dhContext';

const props = defineProps<{ entity: DhDataset }>();
const dh = useDh();

const NODE_W = 236;
const NODE_H = 58;
const COL_GAP = 96;
const ROW_GAP = 22;
const PAD = 28;
const TOP = 34;

const up = ref(2);
const down = ref(2);
const expanded = ref<Set<string>>(new Set());
const selected = ref('');
const hover = ref('');
const scale = ref(1);

const graph = computed(() => buildLineage(props.entity.urn, dh.edges.value, up.value, down.value, expanded.value));

const layout = computed(() => {
  const levels = graph.value.nodes.map(n => n.level);
  const min = Math.min(0, ...levels);
  const max = Math.max(0, ...levels);
  const byLevel = new Map<number, typeof graph.value.nodes>();
  for (const n of graph.value.nodes) {
    if (!byLevel.has(n.level)) byLevel.set(n.level, []);
    byLevel.get(n.level)!.push(n);
  }
  for (const list of byLevel.values()) list.sort((a, b) => shortName(a.urn).localeCompare(shortName(b.urn)));
  const tallest = Math.max(1, ...[...byLevel.values()].map(l => l.length));
  const height = TOP + PAD + tallest * NODE_H + (tallest - 1) * ROW_GAP + PAD;
  const width = PAD * 2 + (max - min + 1) * NODE_W + (max - min) * COL_GAP;
  const pos = new Map<string, { x: number; y: number }>();
  const columns: { level: number; x: number }[] = [];
  const nodes = [] as { urn: string; level: number; x: number; y: number; expandable: boolean; known: boolean; badge: string }[];
  for (let level = min; level <= max; level++) {
    const list = byLevel.get(level) || [];
    const x = PAD + (level - min) * (NODE_W + COL_GAP);
    columns.push({ level, x });
    const block = list.length * NODE_H + Math.max(0, list.length - 1) * ROW_GAP;
    const start = TOP + PAD + ((tallest * NODE_H + (tallest - 1) * ROW_GAP) - block) / 2;
    list.forEach((n, i) => {
      const y = start + i * (NODE_H + ROW_GAP);
      pos.set(n.urn.toLowerCase(), { x, y });
      const ds = dh.dataset(n.urn);
      const incident = dh.incidents.value.some(inc => inc.status !== 'resolved' && sameDataset(inc.dataset, n.urn));
      const badge = incident || ds?.assertions?.status === 'failing' ? 'bad' : ds?.assertions ? 'ok' : '';
      nodes.push({ urn: n.urn, level, x, y, expandable: n.expandable, known: Boolean(ds), badge });
    });
  }
  const focus = hover.value || selected.value;
  const edges = graph.value.edges.map((e, i) => {
    const a = pos.get(e.from.toLowerCase())!;
    const b = pos.get(e.to.toLowerCase())!;
    const x1 = a.x + NODE_W;
    const y1 = a.y + NODE_H / 2;
    const x2 = b.x - 2;
    const y2 = b.y + NODE_H / 2;
    const bend = Math.max(40, Math.abs(x2 - x1) / 2);
    const d = x2 > x1
      ? `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`
      : `M${x1},${y1} C${x1 + 60},${y1 - 50} ${x2 - 60},${y2 - 50} ${x2},${y2}`;
    const hot = Boolean(focus) && (e.from === focus || e.to === focus);
    return { key: `${i}-${e.from}-${e.to}`, d, hot, from: e.from, to: e.to, via: e.via };
  });
  return { width: Math.max(width, NODE_W + PAD * 2), height, nodes, edges, columns };
});

const preview = computed(() => {
  if (!selected.value) return null;
  const urn = selected.value;
  const via = [...new Set(dh.edges.value.filter(e => e.from === urn || e.to === urn).map(e => e.via).filter(Boolean))];
  return { urn, dataset: dh.dataset(urn), via };
});

function clip(text: string, n: number) {
  return text.length > n ? text.slice(0, n - 1) + '…' : text;
}

function select(urn: string) {
  selected.value = selected.value === urn ? '' : urn;
}

function open(urn: string) {
  if (!dh.dataset(urn)) {
    dh.notify('warning', 'Not in the catalogue', `${urn} is referenced by lineage but was never ingested.`);
    return;
  }
  if (urn === props.entity.urn) return;
  dh.openEntity(urn, 'Lineage');
}

function expand(urn: string) {
  const next = new Set(expanded.value);
  next.add(urn.toLowerCase());
  expanded.value = next;
}

function expandAll() {
  up.value = Math.min(5, Math.max(up.value, 1) + 1);
  down.value = Math.min(5, Math.max(down.value, 1) + 1);
}

function zoom(delta: number) {
  scale.value = Math.min(1.6, Math.max(0.4, Math.round((scale.value + delta) * 100) / 100));
}

// `datahub lineage --depth N` is the read the page stands for; logged on the lab
// (so a task can check the student walked the lineage) but not in the CLI strip.
watch([up, down], () => {
  const depth = Math.max(1, up.value, down.value);
  const flags: Record<string, string | boolean | null> = { '--urn': props.entity.urn };
  if (up.value === 0) flags['--downstream'] = true;
  else if (down.value === 0) flags['--upstream'] = true;
  flags['--depth'] = String(depth);
  void dh.read(cmd(['datahub', 'lineage'], flags));
}, { immediate: true });
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-lin { display: flex; flex-direction: column; gap: 10px; }
.dh-lin__bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.dh-lin__ctl { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--dh-text-2); }
.dh-lin__sel { width: auto; height: 28px; font-size: 13px; }
.dh-lin__zoom { display: inline-flex; align-items: center; gap: 4px; }
.dh-lin__pct { min-width: 40px; text-align: center; font-size: 12px; color: var(--dh-text-2); }
.dh-small { font-size: 13px; }
.dh-lin__stage { display: flex; gap: 12px; min-width: 0; align-items: flex-start; }
.dh-lin__canvas {
  flex: 1; min-width: 0; overflow: auto; border: 1px solid var(--dh-border); border-radius: 8px; min-height: 280px; max-height: 560px;
  background-color: #fbfcfd; background-image: radial-gradient(#dfe3e8 1px, transparent 1px); background-size: 18px 18px;
}
.dh-lin__svg { display: block; }
.dh-lin__colhead { font-size: 11px; fill: #595959; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }
.dh-lin__edge path { stroke: #a6a6a6; stroke-width: 1.5; }
.dh-lin__edge.is-hot path { stroke: #1677ff; stroke-width: 2.2; }
.dh-lin__node { cursor: pointer; outline: none; }
.dh-lin__box { fill: #fff; stroke: #d9d9d9; stroke-width: 1; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .06)); }
.dh-lin__node:hover .dh-lin__box, .dh-lin__node:focus-visible .dh-lin__box { stroke: #1677ff; }
.dh-lin__node.is-center .dh-lin__box { stroke: #1677ff; stroke-width: 2; }
.dh-lin__node.is-selected .dh-lin__box { stroke: #722ed1; stroke-width: 2; fill: #f9f0ff; }
.dh-lin__node.is-missing .dh-lin__box { stroke-dasharray: 4 3; fill: #fafafa; }
.dh-lin__bar-accent { fill: #1677ff; }
.dh-lin__name { font-size: 13px; font-weight: 700; fill: #262626; }
.dh-lin__sub { font-size: 11px; fill: #595959; }
.dh-lin__bad { fill: #ff4d4f; }
.dh-lin__ok { fill: #52c41a; }
.dh-lin__expand circle { fill: #fff; stroke: #1677ff; stroke-width: 1.5; }
.dh-lin__expand path { stroke: #1677ff; stroke-width: 1.8; stroke-linecap: round; }
.dh-lin__expand:hover circle { fill: #e6f4ff; }
.dh-lin__preview {
  flex: none; width: 280px; box-sizing: border-box; background: #fff; border: 1px solid var(--dh-border); border-radius: 8px;
  padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; min-width: 0;
}
.dh-lin__pname { overflow-wrap: anywhere; min-width: 0; }
.dh-lin__pdesc { margin: 0; overflow-wrap: anywhere; font-size: 13px; }
@container sl-portal (max-width: 900px) {
  .dh-lin__stage { flex-direction: column; align-items: stretch; }
  .dh-lin__preview { width: auto; }
}
</style>
