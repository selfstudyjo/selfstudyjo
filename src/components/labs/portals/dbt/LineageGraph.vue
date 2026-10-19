<template>
  <div class="lg" :class="{ 'lg--compact': compact }">
    <div class="lg__tools">
      <button type="button" class="lg__tool" title="Zoom in" aria-label="Zoom in" @click="zoom(1.2)"><DbtIcon name="zoom-in" /></button>
      <button type="button" class="lg__tool" title="Zoom out" aria-label="Zoom out" @click="zoom(1 / 1.2)"><DbtIcon name="zoom-out" /></button>
      <button type="button" class="lg__tool" title="Fit to screen" aria-label="Fit to screen" @click="fit"><DbtIcon name="fit" /></button>
    </div>
    <div v-if="!placedList.length" class="lg__empty">{{ emptyText }}</div>
    <svg v-else ref="svg" class="lg__svg" role="img" aria-label="Lineage graph"
         @mousedown="startPan" @mousemove="movePan" @mouseup="endPan" @mouseleave="endPan" @wheel.prevent="onWheel">
      <defs>
        <marker id="lg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="#9AA1B3" />
        </marker>
        <marker id="lg-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="#3D4357" />
        </marker>
      </defs>
      <g :transform="`translate(${tx} ${ty}) scale(${k})`">
        <path v-for="edge in edges" :key="edge.key" class="lg__edge" :class="{ 'is-on': edge.on, 'is-dim': edge.dim }"
              :d="edge.d" :marker-end="edge.on ? 'url(#lg-arrow-on)' : 'url(#lg-arrow)'" />
        <g v-for="p in placedList" :key="p.id" class="lg__node" :class="['lg__node--' + nodeOf(p.id).kind,
             { 'is-active': p.id === activeId, 'is-dim': isDim(p.id), 'is-hit': isHit(p.id) }]"
           :transform="`translate(${p.x} ${p.y})`" tabindex="0" role="button"
           :aria-label="kindLabel(p.id) + ' ' + nodeOf(p.id).name"
           @mousedown.stop @click.stop="$emit('select', p.id)" @keydown.enter="$emit('select', p.id)">
          <title>{{ kindLabel(p.id) }}: {{ nodeOf(p.id).name }}{{ nodeOf(p.id).status ? ' (' + nodeOf(p.id).status + ')' : '' }}</title>
          <rect class="lg__box" :width="W" :height="H" rx="6" />
          <rect class="lg__bar" width="5" :height="H" rx="2" />
          <text class="lg__kind" x="14" y="13">{{ kindLabel(p.id).toUpperCase() }}</text>
          <text class="lg__name" x="14" y="27">{{ clip(nodeOf(p.id).label) }}</text>
          <circle v-if="nodeOf(p.id).status" class="lg__dot" :class="'lg__dot--' + tone(nodeOf(p.id).status)" :cx="W - 12" cy="12" r="4.5" />
        </g>
      </g>
    </svg>
    <div v-if="!compact" class="lg__legend" aria-label="Legend">
      <span v-for="k in legendKinds" :key="k" class="lg__legend-item"><i :class="'lg__swatch lg__swatch--' + k"></i>{{ KIND_LABEL[k] }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The dbt lineage graph: sources green, models blue, seeds purple, snapshots
 * teal, tests amber, exposures orange. Laid out left-to-right by DAG depth.
 * `highlight` (a set of ids from a `--select` expression) dims everything
 * else, the way dbt Explorer's "Update graph" does. Pan by dragging, zoom
 * with the wheel or the buttons.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import DbtIcon from './DbtIcon.vue';
import { KIND_LABEL, layout, statusTone, type Graph, type NodeKind } from './dbt';

const props = withDefaults(defineProps<{
  graph: Graph;
  ids?: Set<string> | null;
  highlight?: Set<string> | null;
  activeId?: string;
  compact?: boolean;
  emptyText?: string;
}>(), { ids: null, highlight: null, activeId: '', compact: false, emptyText: 'Nothing to show yet.' });

defineEmits<{ (event: 'select', id: string): void }>();

const W = 168;
const H = 36;
const svg = ref<SVGSVGElement | null>(null);
const tx = ref(0);
const ty = ref(0);
const k = ref(1);

const laid = computed(() => layout(props.graph, props.ids, props.compact ? 200 : 214, props.compact ? 50 : 56));
const placedList = computed(() => [...laid.value.placed.values()]);

function nodeOf(id: string) { return props.graph.nodes.get(id)!; }
function kindLabel(id: string) { return KIND_LABEL[nodeOf(id).kind]; }
function tone(status: string | null) { return statusTone(status); }
function clip(text: string) { return text.length > 22 ? text.slice(0, 21) + '…' : text; }
function isDim(id: string) { return !!props.highlight && props.highlight.size > 0 && !props.highlight.has(id); }
function isHit(id: string) { return !!props.highlight && props.highlight.has(id); }

const edges = computed(() => {
  const out: { key: string; d: string; on: boolean; dim: boolean }[] = [];
  const placed = laid.value.placed;
  for (const [id, parents] of props.graph.parents) {
    const to = placed.get(id);
    if (!to) continue;
    for (const pid of parents) {
      const from = placed.get(pid);
      if (!from) continue;
      const x1 = from.x + W; const y1 = from.y + H / 2;
      const x2 = to.x - 2; const y2 = to.y + H / 2;
      const mid = (x1 + x2) / 2;
      const hl = props.highlight;
      const on = props.activeId ? (id === props.activeId || pid === props.activeId) : !!hl && hl.has(id) && hl.has(pid);
      const dim = !!hl && hl.size > 0 && !(hl.has(id) && hl.has(pid));
      out.push({ key: pid + '>' + id, d: `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`, on, dim });
    }
  }
  return out;
});

const legendKinds = computed<NodeKind[]>(() => {
  const present = new Set([...props.graph.nodes.values()].map(n => n.kind));
  return (['source', 'seed', 'snapshot', 'model', 'test', 'exposure'] as NodeKind[]).filter(x => present.has(x));
});

function fit() {
  const el = svg.value;
  if (!el) return;
  const box = el.getBoundingClientRect();
  const w = Math.max(1, laid.value.width);
  const h = Math.max(1, laid.value.height);
  const scale = Math.min(1.15, Math.max(0.6, Math.min(box.width / w, box.height / h)));
  k.value = scale;
  tx.value = Math.max(0, (box.width - w * scale) / 2);
  ty.value = Math.max(0, (box.height - h * scale) / 2);
}
function zoom(f: number) {
  const el = svg.value;
  const box = el ? el.getBoundingClientRect() : { width: 0, height: 0 };
  const cx = box.width / 2; const cy = box.height / 2;
  const next = Math.min(2.5, Math.max(0.25, k.value * f));
  tx.value = cx - (cx - tx.value) * (next / k.value);
  ty.value = cy - (cy - ty.value) * (next / k.value);
  k.value = next;
}
function onWheel(event: WheelEvent) { zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1); }

let pan: { x: number; y: number; tx: number; ty: number } | null = null;
function startPan(event: MouseEvent) { pan = { x: event.clientX, y: event.clientY, tx: tx.value, ty: ty.value }; }
function movePan(event: MouseEvent) {
  if (!pan) return;
  tx.value = pan.tx + event.clientX - pan.x;
  ty.value = pan.ty + event.clientY - pan.y;
}
function endPan() { pan = null; }

onMounted(() => nextTick(fit));
watch(() => [placedList.value.length, props.ids], () => nextTick(fit));
</script>

<style scoped>
.lg { position: relative; display: flex; flex-direction: column; min-height: 0; height: 100%; background:
  radial-gradient(circle, #DCDFE7 1px, transparent 1px) 0 0 / 18px 18px, #FAFBFC; border-radius: 8px; overflow: hidden; }
.lg__svg { flex: 1; width: 100%; min-height: 0; cursor: grab; display: block; user-select: none; }
.lg__svg:active { cursor: grabbing; }
.lg__tools { position: absolute; top: 10px; right: 10px; z-index: 2; display: flex; flex-direction: column; background: #fff; border: 1px solid #DCDFE7; border-radius: 6px; overflow: hidden; }
.lg__tool { width: 30px; height: 30px; border: 0; background: #fff; color: #3D4357; cursor: pointer; display: grid; place-items: center; }
.lg__tool + .lg__tool { border-top: 1px solid #ECEEF3; }
.lg__tool:hover { background: #F0F2F5; }
.lg__empty { flex: 1; display: grid; place-items: center; color: #5C6378; padding: 20px; text-align: center; }
.lg__edge { fill: none; stroke: #9AA1B3; stroke-width: 1.4; }
.lg__edge.is-on { stroke: #3D4357; stroke-width: 2; }
.lg__edge.is-dim { opacity: 0.25; }
.lg__node { cursor: pointer; outline: none; }
.lg__box { fill: #fff; stroke: #C9CEDA; stroke-width: 1; }
.lg__node:hover .lg__box, .lg__node:focus-visible .lg__box { stroke: #3D4357; }
.lg__node.is-active .lg__box { stroke: #262A38; stroke-width: 2.2; }
.lg__node.is-hit .lg__box { stroke-width: 1.6; }
.lg__node.is-dim { opacity: 0.32; }
.lg__kind { font: 600 8.5px Inter, -apple-system, 'Segoe UI', sans-serif; letter-spacing: 0.06em; fill: #5C6378; }
.lg__name { font: 500 12px Inter, -apple-system, 'Segoe UI', sans-serif; fill: #262A38; }
.lg__node--source .lg__bar { fill: #5FB825; }
.lg__node--model .lg__bar { fill: #0094B3; }
.lg__node--seed .lg__bar { fill: #8C6BC8; }
.lg__node--snapshot .lg__bar { fill: #2A8FA8; }
.lg__node--test .lg__bar { fill: #D4A017; }
.lg__node--exposure .lg__bar { fill: #FF694A; }
.lg__node--source .lg__box { fill: #F3FAEE; }
.lg__node--model .lg__box { fill: #EEF8FB; }
.lg__node--exposure .lg__box { fill: #FFF3EF; }
.lg__node--test .lg__box { fill: #FFFBEB; }
.lg__dot--ok { fill: #178A4F; }
.lg__dot--bad { fill: #C8352B; }
.lg__dot--warn { fill: #E08A00; }
.lg__dot--skip, .lg__dot--none { fill: #9AA1B3; }
.lg__legend { flex: none; display: flex; gap: 14px; flex-wrap: wrap; padding: 8px 12px; border-top: 1px solid #ECEEF3; background: #fff; font-size: 12px; color: #3D4357; }
.lg__legend-item { display: inline-flex; align-items: center; gap: 6px; }
.lg__swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.lg__swatch--source { background: #5FB825; }
.lg__swatch--model { background: #0094B3; }
.lg__swatch--seed { background: #8C6BC8; }
.lg__swatch--snapshot { background: #2A8FA8; }
.lg__swatch--test { background: #D4A017; }
.lg__swatch--exposure { background: #FF694A; }
</style>
