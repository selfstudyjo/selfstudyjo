<template>
  <!--
    The roadmap as an SVG map. Stage columns on a wide container, stage rows on
    a narrow one - the orientation follows the CONTAINER (ResizeObserver), not
    the viewport, because the map is sometimes a column inside a wide page.

    A place, not a paragraph: pinned `direction: ltr` in both languages.
    Every node is a focusable button (Tab, Enter, Space), so the map is usable
    without a pointer. Nothing here reaches v-html; every label is a text node.
  -->
  <div ref="host" class="rm2d" :class="{ 'is-animated': animate }">
    <svg
      v-if="layout"
      class="rm2d__svg"
      :viewBox="`0 0 ${layout.width} ${layout.height}`"
      :width="svgWidth"
      :height="svgHeight"
      role="group"
      :aria-label="$t('Roadmap map')"
    >
      <defs>
        <marker id="rm2d-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7"
                orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" class="rm2d__arrowhead" />
        </marker>
      </defs>

      <!-- The journey drawn on first, then everything hangs off it. -->
      <path :d="layout.journey" class="rm2d__journey" pathLength="1" />
      <path v-for="(edge, i) in layout.edges.filter(e => e.type === 'rail')" :key="'r' + i"
            :d="edge.d" class="rm2d__rail" />
      <!--
        Dependencies only for the SELECTED step. Real roadmaps carry ~one per
        node (64-96 per map), and all of them at once is a hairball that hides
        the boxes; for one step they answer "what do I need first".
      -->
      <path v-for="(edge, i) in litEdges" :key="'d' + i"
            :d="edge.d" class="rm2d__dep" marker-end="url(#rm2d-arrow)" />

      <g v-for="stage in layout.stages" :key="stage.id" class="rm2d__stage"
         :class="{ 'is-focus': focusStageId === stage.id }"
         :style="{ '--i': stage.index }">
        <template v-if="layout.orientation === 'vertical'">
          <circle :cx="stage.cx" :cy="stage.cy" r="11" class="rm2d__stop" />
          <text :x="stage.cx" :y="stage.cy + 4" class="rm2d__stopnum" text-anchor="middle">{{ stage.index + 1 }}</text>
        </template>
        <rect :x="stage.x" :y="stage.y" :width="stage.w" :height="stage.h" rx="14" class="rm2d__header" />
        <text :x="stage.x + 14" :y="stage.y + 24" class="rm2d__eyebrow">
          {{ $t('Stage {v0}', { v0: stage.index + 1 }) }}<tspan v-if="stageOf(stage.id)?.weeks"> · {{ $t('{v0} wk', { v0: stageOf(stage.id)!.weeks }) }}</tspan>
        </text>
        <text v-for="(line, li) in stageLines(stage.id)" :key="li" :x="stage.x + 14"
              :y="stage.y + 46 + li * 18" class="rm2d__stitle">{{ line }}</text>
        <rect :x="stage.x + 14" :y="stage.y + stage.h - 16" :width="stage.w - 28" height="6" rx="3" class="rm2d__track" />
        <rect :x="stage.x + 14" :y="stage.y + stage.h - 16"
              :width="Math.max(0, (stage.w - 28) * stagePercent(stage.id) / 100)" height="6" rx="3"
              class="rm2d__fill" />
      </g>

      <g v-for="(p, n) in layout.nodes" :key="p.id" class="rm2d__node"
         :class="[`is-${p.kind}`, `is-${statusClass(p.id)}`, {
           'is-selected': selectedId === p.id,
           'is-optional': nodeOf(p.id)?.optional,
         }]"
         :style="{ '--i': n, '--s': stageIndex(p.stageId) }"
         tabindex="0" role="button"
         :aria-label="nodeAria(p.id)"
         :aria-pressed="selectedId === p.id"
         @click="emit('select', p.id)"
         @keydown.enter.prevent="emit('select', p.id)"
         @keydown.space.prevent="emit('select', p.id)">
        <rect :x="p.x" :y="p.y" :width="p.w" :height="p.h" rx="12" class="rm2d__box" />
        <g :transform="`translate(${p.x + 26} ${p.cy})`" class="rm2d__glyph">
          <polygon v-if="shapeOf(p.kind) === 'hexagon'" points="0,-14 12.1,-7 12.1,7 0,14 -12.1,7 -12.1,-7" />
          <circle v-else-if="shapeOf(p.kind) === 'circle'" r="12.5" />
          <rect v-else-if="shapeOf(p.kind) === 'square'" x="-11.5" y="-11.5" width="23" height="23" rx="4" />
          <path v-else-if="shapeOf(p.kind) === 'document'" d="M -10 -13 H 5 L 11 -7 V 13 H -10 Z" />
          <polygon v-else points="0,-14 14,0 0,14 -14,0" />
        </g>
        <text v-for="(line, li) in titleLines(p.id)" :key="li" :x="p.x + 48"
              :y="p.cy + (titleLines(p.id).length > 1 ? -12 : -4) + li * 15" class="rm2d__title">{{ line }}</text>
        <text :x="p.x + 48" :y="p.cy + (titleLines(p.id).length > 1 ? 21 : 14)" class="rm2d__kind">{{ kindLabel(p.kind) }}<tspan v-if="nodeOf(p.id)?.optional"> · {{ $t('optional') }}</tspan></text>
        <g v-if="statusClass(p.id) !== 'todo'" :transform="`translate(${p.x + p.w - 16} ${p.y + 16})`" class="rm2d__badge">
          <circle r="8" />
          <path v-if="statusClass(p.id) === 'done'" d="M -4 0 L -1 3 L 4 -3" class="rm2d__tick" />
          <circle v-else r="3" class="rm2d__dot" />
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from '@/i18n/runtime';
import {
  KIND_META, layout2D, statusOf, progressStats, wrapLabel,
  type NodeKind, type RoadmapDoc,
} from '@/utils/roadmapLayout';

const props = defineProps<{
  doc: RoadmapDoc;
  selectedId?: string | null;
  focusStageId?: string | null;
  /** Off under prefers-reduced-motion: the settled map, at once. */
  animate?: boolean;
}>();
const emit = defineEmits<{ (e: 'select', id: string): void }>();
const { t } = useI18n();

const host = ref<HTMLElement | null>(null);
const width = ref(0);
let observer: ResizeObserver | null = null;

/** Rows below 640 px of CONTAINER, columns above. */
const orientation = computed(() => (width.value && width.value < 640 ? 'vertical' : 'horizontal'));
const layout = computed(() => layout2D(props.doc, orientation.value));
const stats = computed(() => progressStats(props.doc));

/*
  Vertical fills the width. Horizontal keeps its natural size and scrolls
  sideways when it is wider than the container, rather than shrinking six
  stages into 900 px of 7-pixel text.
*/
const svgWidth = computed(() => {
  const l = layout.value;
  if (!l) return 0;
  // A phone column fills; a wider container never scales the rows past 1.35x,
  // which is where a step box stops looking like a box and starts looking
  // like a banner.
  if (l.orientation === 'vertical') return Math.max(280, Math.min(width.value || l.width, l.width * 1.35));
  return l.width;
});
const svgHeight = computed(() => {
  const l = layout.value;
  if (!l) return 0;
  return l.orientation === 'vertical' ? (svgWidth.value / l.width) * l.height : l.height;
});

const litEdges = computed(() => props.selectedId
  ? layout.value.edges.filter(e => e.type === 'dependency'
      && (e.from === props.selectedId || e.to === props.selectedId))
  : []);

const titleCache = computed(() => {
  const per = layout.value.labelChars;
  const map = new Map<string, string[]>();
  for (const s of props.doc.stages) for (const n of s.nodes) map.set(n.id, wrapLabel(n.title, per, 2));
  return map;
});
const titleLines = (id: string) => titleCache.value.get(id) || [];
const stageLines = (id: string) =>
  wrapLabel(stageOf(id)?.title || '', layout.value.orientation === 'vertical' ? 34 : 27, 2);

const byId = computed(() => {
  const nodes = new Map<string, RoadmapDoc['stages'][number]['nodes'][number]>();
  for (const s of props.doc.stages) for (const n of s.nodes) nodes.set(n.id, n);
  return nodes;
});
const nodeOf = (id: string) => byId.value.get(id);
const stageOf = (id: string) => props.doc.stages.find(s => s.id === id);
const stageIndex = (id: string) => props.doc.stages.findIndex(s => s.id === id);
const stagePercent = (id: string) => stats.value.stages.find(s => s.id === id)?.percent ?? 0;
const shapeOf = (kind: NodeKind) => KIND_META[kind].shape2d;
const statusClass = (id: string) => statusOf(props.doc, id) || 'todo';

function kindLabel(kind: NodeKind): string {
  switch (kind) {
    case 'course': return t('Course');
    case 'lesson': return t('Lesson');
    case 'lab': return t('Lab');
    case 'runbook': return t('Runbook');
    default: return t('Topic');
  }
}

function nodeAria(id: string): string {
  const node = nodeOf(id);
  if (!node) return '';
  const s = statusOf(props.doc, id);
  const status = s === 'done' ? t('Done') : s === 'doing' ? t('In progress') : t('Not started');
  return `${kindLabel(node.kind)}: ${node.title} — ${status}`;
}

onMounted(() => {
  if (!host.value) return;
  width.value = host.value.clientWidth;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(entries => {
      const w = Math.round(entries[0]?.contentRect.width || 0);
      if (w && w !== width.value) width.value = w;
    });
    observer.observe(host.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());

/** Scroll a node into view, e.g. after the 3D map picked it. */
function reveal(id: string) {
  const el = host.value?.querySelector<SVGGElement>(`.rm2d__node[aria-pressed="true"]`);
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  void id;
}
defineExpose({ reveal });
</script>

<style scoped>
.rm2d {
  direction: ltr;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.rm2d__svg { display: block; margin-inline: auto; max-width: none; }

.rm2d__journey {
  fill: none;
  stroke: var(--sfs-accent, #667eea);
  stroke-width: 4;
  stroke-linecap: round;
  opacity: 0.55;
}
.rm2d__rail { fill: none; stroke: rgb(var(--sfs-line-rgb, 255 255 255) / 0.18); stroke-width: 2; stroke-dasharray: 2 6; }
.rm2d__dep {
  fill: none;
  stroke: var(--sfs-accent, #667eea);
  stroke-width: 2.2;
  stroke-dasharray: 6 4;
}
.rm2d__arrowhead { fill: var(--sfs-accent, #667eea); }

.rm2d__header {
  fill: var(--sfs-surface-2, #1e2235);
  stroke: var(--sfs-border, rgba(255, 255, 255, 0.14));
  stroke-width: 1;
}
.rm2d__stage.is-focus .rm2d__header { stroke: var(--sfs-accent, #667eea); stroke-width: 2.5; }
.rm2d__stop { fill: var(--sfs-accent, #667eea); }
.rm2d__stopnum { fill: var(--sfs-on-accent, #fff); font-size: 11px; font-weight: 700; }
.rm2d__eyebrow {
  fill: var(--sfs-accent-text, #a5b4fc);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.rm2d__stitle { fill: var(--sfs-text, #f1f5f9); font-size: 14px; font-weight: 700; }
.rm2d__track { fill: rgb(var(--sfs-line-rgb, 255 255 255) / 0.12); }
.rm2d__fill { fill: var(--sfs-success, #34d399); }

.rm2d__node { cursor: pointer; outline: none; }
.rm2d__box {
  fill: var(--sfs-surface, #161a2b);
  stroke: var(--sfs-border, rgba(255, 255, 255, 0.14));
  stroke-width: 1.2;
  transition: stroke var(--sfs-dur-fast, 0.15s), fill var(--sfs-dur-fast, 0.15s);
}
.rm2d__node.is-optional .rm2d__box { stroke-dasharray: 6 4; }
.rm2d__node:hover .rm2d__box { fill: var(--sfs-surface-2, #1e2235); }
.rm2d__node.is-doing .rm2d__box { stroke: var(--sfs-warning, #fbbf24); stroke-width: 2; }
.rm2d__node.is-done .rm2d__box { stroke: var(--sfs-success, #34d399); stroke-width: 2; }
.rm2d__node.is-selected .rm2d__box,
.rm2d__node:focus-visible .rm2d__box { stroke: var(--sfs-focus, #a5b4fc); stroke-width: 3; }

.rm2d__glyph > * { stroke: var(--sfs-surface, #161a2b); stroke-width: 1.5; }
.rm2d__node.is-course .rm2d__glyph > * { fill: var(--sfs-accent, #667eea); }
.rm2d__node.is-lesson .rm2d__glyph > * { fill: var(--sfs-accent-2, #764ba2); }
.rm2d__node.is-lab .rm2d__glyph > * { fill: var(--sfs-accent-3, #f093fb); }
.rm2d__node.is-runbook .rm2d__glyph > * { fill: var(--sfs-info, #38bdf8); }
.rm2d__node.is-topic .rm2d__glyph > * { fill: var(--sfs-text-muted, #94a3b8); }

.rm2d__title { fill: var(--sfs-text, #f1f5f9); font-size: 12.5px; font-weight: 600; }
.rm2d__kind { fill: var(--sfs-text-muted, #94a3b8); font-size: 11px; }
.rm2d__badge > circle:first-child { fill: var(--sfs-warning, #fbbf24); }
.rm2d__node.is-done .rm2d__badge > circle:first-child { fill: var(--sfs-success, #34d399); }
.rm2d__tick { fill: none; stroke: var(--sfs-on-success, #052e16); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.rm2d__dot { fill: var(--sfs-on-warning, #451a03); }

/*
  The reveal: the journey draws itself on, each stage rises in after it, and
  each node in a stage follows. Only ever with motion allowed - the component
  is told `animate=false` under prefers-reduced-motion, and the media query is
  a second line of defence for the same promise.
*/
@media (prefers-reduced-motion: no-preference) {
  .rm2d.is-animated .rm2d__journey {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: rm2d-draw 1.6s var(--sfs-ease-out, ease-out) forwards;
  }
  .rm2d.is-animated .rm2d__stage {
    opacity: 0;
    animation: rm2d-rise 0.55s var(--sfs-ease-out, ease-out) forwards;
    animation-delay: calc(var(--i) * 160ms + 120ms);
  }
  .rm2d.is-animated .rm2d__node {
    opacity: 0;
    animation: rm2d-pop 0.45s var(--sfs-ease-out, ease-out) forwards;
    animation-delay: calc(var(--s) * 160ms + var(--i) * 25ms + 380ms);
  }
  .rm2d__node.is-doing .rm2d__badge { animation: rm2d-pulse 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
}
@keyframes rm2d-draw { to { stroke-dashoffset: 0; } }
@keyframes rm2d-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes rm2d-pop { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes rm2d-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
</style>
