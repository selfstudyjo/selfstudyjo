<template>
  <!--
    The roadmap as an SVG map. Stage columns on a wide container, stage rows on
    a narrow one - the orientation follows the CONTAINER (ResizeObserver), not
    the viewport, because the map is sometimes a column inside a wide page.

    Above it, a stage TIMELINE: one pill per stage with its progress ring,
    sticky while the map scrolls, that jumps the map to that stage.

    A place, not a paragraph: pinned `direction: ltr` in both languages.
    Every node is a focusable button (Tab, Enter, Space), so the map is usable
    without a pointer. Nothing here reaches v-html; every label is a text node.
  -->
  <div ref="host" class="rm2d" :class="[{ 'is-animated': animate }, `is-${layout.orientation}`]">
    <nav class="rm2d__timeline" :aria-label="$t('Stage timeline')">
      <button v-for="(st, i) in doc.stages" :key="st.id" type="button" class="rm2d__tl"
              :class="{ 'is-focus': focusStageId === st.id, 'is-complete': stageComplete(st.id) }"
              :aria-pressed="focusStageId === st.id" @click="jump(st.id)">
        <svg class="rm2d__tlring" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="15" class="rm2d__ringtrack" />
          <circle cx="18" cy="18" r="15" class="rm2d__ringfill" transform="rotate(-90 18 18)"
                  :stroke-dasharray="ringDash(stagePercent(st.id), 15)" />
          <text x="18" y="22.5" text-anchor="middle" class="rm2d__tlnum">{{ i + 1 }}</text>
        </svg>
        <span class="rm2d__tltext">
          <span class="rm2d__tltitle">{{ st.title }}</span>
          <span class="rm2d__tlmeta">{{ stageCount(st.id) }}</span>
        </span>
      </button>
    </nav>

    <div ref="scroller" class="rm2d__scroll">
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
          <linearGradient :id="`${uid}-jg`" gradientUnits="userSpaceOnUse"
                          :x1="0" :y1="0" :x2="layout.orientation === 'vertical' ? 0 : layout.width"
                          :y2="layout.orientation === 'vertical' ? layout.height : 0">
            <stop offset="0" class="rm2d__s1" />
            <stop offset="0.55" class="rm2d__s2" />
            <stop offset="1" class="rm2d__s3" />
          </linearGradient>
          <linearGradient :id="`${uid}-sheen`" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" class="rm2d__sheen0" />
            <stop offset="1" class="rm2d__sheen1" />
          </linearGradient>
          <filter :id="`${uid}-glow`" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <marker :id="`${uid}-arrow`" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7"
                  orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" class="rm2d__arrowhead" />
          </marker>
        </defs>

        <!-- The journey: a soft glow under a crisp gradient line, drawn on
             first, with light flowing along it. -->
        <path :d="layout.journey" class="rm2d__journey-glow" :stroke="`url(#${uid}-jg)`" :filter="`url(#${uid}-glow)`" />
        <path :d="layout.journey" class="rm2d__journey" :stroke="`url(#${uid}-jg)`" pathLength="1" />
        <path v-if="animate" :d="layout.journey" class="rm2d__flow" />

        <!-- Each stage's stepper line through its steps' badges; a segment
             turns the success hue when the step below it is done. -->
        <path v-for="seg in stepper" :key="seg.id" :d="seg.d" class="rm2d__stepper"
              :class="{ 'is-done': seg.done }" />

        <!-- Dependencies only for the SELECTED step. Real roadmaps carry ~one
             per node (64-96 per map); all at once is a hairball that hides the
             cards; for one step they answer "what do I need first". -->
        <path v-for="(edge, i) in litEdges" :key="'d' + i"
              :d="edge.d" class="rm2d__dep" :marker-end="`url(#${uid}-arrow)`" />

        <g v-for="stage in layout.stages" :key="stage.id" class="rm2d__stage"
           :class="{ 'is-focus': focusStageId === stage.id, 'is-complete': stageComplete(stage.id) }"
           :data-stage="stage.id"
           :style="{ '--i': stage.index }">
          <g v-if="layout.orientation === 'vertical'" class="rm2d__stop">
            <circle :cx="stage.cx" :cy="stage.cy" r="9" class="rm2d__stopglow" />
            <circle :cx="stage.cx" :cy="stage.cy" r="5" class="rm2d__stopdot" />
          </g>
          <rect :x="stage.x - 2" :y="stage.y - 2" :width="stage.w + 4" :height="stage.h + 4" rx="20"
                class="rm2d__focusglow" :filter="`url(#${uid}-glow)`" />
          <rect :x="stage.x" :y="stage.y" :width="stage.w" :height="stage.h" rx="18" class="rm2d__header" />
          <rect :x="stage.x" :y="stage.y" :width="stage.w" :height="stage.h" rx="18" class="rm2d__sheen"
                :fill="`url(#${uid}-sheen)`" />
          <g :transform="`translate(${ringX(stage)} ${stage.y + 36})`" class="rm2d__ring">
            <circle r="17" class="rm2d__ringtrack" />
            <circle r="17" class="rm2d__ringfill" transform="rotate(-90)"
                    :stroke-dasharray="ringDash(stagePercent(stage.id), 17)" />
            <text y="5" text-anchor="middle" class="rm2d__ringnum">{{ stage.index + 1 }}</text>
          </g>
          <text :x="ringX(stage) + 28" :y="stage.y + 27" class="rm2d__eyebrow">
            {{ $t('Stage {v0}', { v0: stage.index + 1 }) }}<tspan v-if="stageOf(stage.id)?.weeks"> · {{ $t('{v0} wk', { v0: stageOf(stage.id)!.weeks }) }}</tspan>
          </text>
          <text :x="stage.x + stage.w - 14" :y="stage.y + 27" text-anchor="end" class="rm2d__count">{{ stageCount(stage.id) }}</text>
          <text v-for="(line, li) in stageLines(stage.id)" :key="li" :x="ringX(stage) + 28"
                :y="stage.y + 49 + li * 18" class="rm2d__stitle">{{ line }}</text>
          <rect :x="stage.x + 16" :y="stage.y + stage.h - 13" :width="stage.w - 32" height="4" rx="2" class="rm2d__track" />
          <rect :x="stage.x + 16" :y="stage.y + stage.h - 13" :width="Math.max(0, (stage.w - 32) * stagePercent(stage.id) / 100)"
                height="4" rx="2" class="rm2d__fill" />
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
          <g class="rm2d__lift">
            <rect :x="p.x - 3" :y="p.y - 3" :width="p.w + 6" :height="p.h + 6" rx="17" class="rm2d__halo" />
            <!-- A soft shadow as two offset rects, not an SVG filter: sixty
                 filtered cards are sixty offscreen passes, and the filter
                 regions tiled into visible bands in a light galaxy. -->
            <rect :x="p.x + 2" :y="p.y + 6" :width="p.w - 4" :height="p.h" rx="14" class="rm2d__shadow rm2d__shadow--far" />
            <rect :x="p.x + 1" :y="p.y + 3" :width="p.w - 2" :height="p.h" rx="14" class="rm2d__shadow" />
            <rect :x="p.x" :y="p.y" :width="p.w" :height="p.h" rx="14" class="rm2d__box" />
            <rect :x="p.x" :y="p.y" :width="p.w" :height="p.h" rx="14" class="rm2d__sheen" :fill="`url(#${uid}-sheen)`" />
            <rect :x="p.x" :y="p.y + 14" width="3" :height="p.h - 28" rx="1.5" class="rm2d__bar" />
            <g :transform="`translate(${p.x + 28} ${p.cy})`" class="rm2d__glyph">
              <polygon :points="outlinePoints(p.kind, 15.5)" class="rm2d__shape" />
              <g transform="translate(-8 -8) scale(0.6667)" class="rm2d__icon">
                <path v-for="(d, di) in KIND_ICON[p.kind]" :key="di" :d="d" />
              </g>
            </g>
            <text v-for="(line, li) in titleLines(p.id)" :key="li" :x="p.x + 54"
                  :y="p.cy + (titleLines(p.id).length > 1 ? -11 : -3) + li * 15" class="rm2d__title">{{ line }}</text>
            <text :x="p.x + 54" :y="p.cy + (titleLines(p.id).length > 1 ? 21 : 14)" class="rm2d__kind">{{ kindLabel(p.kind) }}<tspan v-if="nodeOf(p.id)?.optional"> · {{ $t('optional') }}</tspan></text>
            <g v-if="statusClass(p.id) !== 'todo'" :transform="`translate(${p.x + p.w - 15} ${p.y + 15})`" class="rm2d__badge">
              <circle r="11" class="rm2d__badgering" />
              <circle r="8" class="rm2d__badgefill" />
              <path v-if="statusClass(p.id) === 'done'" d="M -3.6 0.2 L -1 2.8 L 3.8 -2.6" class="rm2d__tick" />
              <circle v-else r="2.6" class="rm2d__dot" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { useI18n } from '@/i18n/runtime';
import {
  KIND_ICON, layout2D, outlinePoints, progressStats, ringDash, statusOf, wrapLabel,
  type NodeKind, type Placed2DStage, type RoadmapDoc,
} from '@/utils/roadmapLayout';

const props = defineProps<{
  doc: RoadmapDoc;
  selectedId?: string | null;
  focusStageId?: string | null;
  /** Off under prefers-reduced-motion: the settled map, at once. */
  animate?: boolean;
}>();
const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'focus', stageId: string): void;
}>();
const { t } = useI18n();

// Gradient and filter ids are document-global, so each instance has its own.
const uid = `rm2d-${useId()}`;

const host = ref<HTMLElement | null>(null);
const scroller = ref<HTMLElement | null>(null);
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
  // which is where a step card stops looking like a card and starts looking
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

/** The x of a stage's ring: aligned with its steps' badges. */
function ringX(stage: Placed2DStage): number {
  const first = layout.value.nodes.find(n => n.stageId === stage.id);
  return (first ? first.x : stage.x + 10) + 28;
}

/** Stepper segments: header to first badge, then badge to badge. */
const stepper = computed(() => {
  const out: { id: string; d: string; done: boolean }[] = [];
  const l = layout.value;
  for (const st of l.stages) {
    const nodes = l.nodes.filter(n => n.stageId === st.id);
    let from = st.y + st.h;
    for (const n of nodes) {
      const x = n.x + 28;
      out.push({ id: n.id, d: `M ${x} ${from} L ${x} ${n.y}`, done: statusOf(props.doc, n.id) === 'done' });
      from = n.y + n.h;
    }
  }
  return out;
});

const titleCache = computed(() => {
  const per = layout.value.labelChars - 1;
  const map = new Map<string, string[]>();
  for (const s of props.doc.stages) for (const n of s.nodes) map.set(n.id, wrapLabel(n.title, per, 2));
  return map;
});
const titleLines = (id: string) => titleCache.value.get(id) || [];
const stageLines = (id: string) =>
  wrapLabel(stageOf(id)?.title || '', layout.value.orientation === 'vertical' ? 28 : 21, 2);

const byId = computed(() => {
  const nodes = new Map<string, RoadmapDoc['stages'][number]['nodes'][number]>();
  for (const s of props.doc.stages) for (const n of s.nodes) nodes.set(n.id, n);
  return nodes;
});
const nodeOf = (id: string) => byId.value.get(id);
const stageOf = (id: string) => props.doc.stages.find(s => s.id === id);
const stageIndex = (id: string) => props.doc.stages.findIndex(s => s.id === id);
const stageStat = (id: string) => stats.value.stages.find(s => s.id === id);
const stagePercent = (id: string) => stageStat(id)?.percent ?? 0;
const stageComplete = (id: string) => { const s = stageStat(id); return !!s && s.total > 0 && s.done === s.total; };
const stageCount = (id: string) => { const s = stageStat(id); return s && s.total ? `${s.done}/${s.total}` : ''; };
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

const smooth = typeof matchMedia === 'undefined' || !matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The timeline's jump: highlight the stage and bring its column into view. */
function jump(stageId: string) {
  emit('focus', stageId);
  const el = host.value?.querySelector<SVGGElement>(`.rm2d__stage[data-stage="${CSS.escape(stageId)}"] .rm2d__header`);
  el?.scrollIntoView?.({ block: 'nearest', inline: 'start', behavior: smooth ? 'smooth' : 'auto' });
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
  min-width: 0;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.rm2d__scroll { overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; padding-block-end: 0.5rem; }
.rm2d__svg { display: block; margin-inline: auto; max-width: none; overflow: visible; }

/* ---------------------------------------------------- the stage timeline */
.rm2d__timeline {
  position: sticky; top: 0; z-index: 2;
  display: flex; gap: 0.45rem; overflow-x: auto; scrollbar-width: none;
  padding: 0.65rem 0.75rem;
  background: linear-gradient(to bottom, var(--sfs-surface, #161a2b) 70%, transparent);
}
.rm2d__timeline::-webkit-scrollbar { display: none; }
.rm2d__tl {
  flex: none; display: inline-flex; align-items: center; gap: 0.5rem;
  max-width: 15rem; padding: 0.3rem 0.8rem 0.3rem 0.35rem;
  border-radius: var(--sfs-radius-pill, 999px);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05);
  color: var(--sfs-text, #f1f5f9); font: inherit; cursor: pointer; text-align: start;
  transition: border-color var(--sfs-dur-fast, 0.15s), background var(--sfs-dur-fast, 0.15s), transform var(--sfs-dur-fast, 0.15s);
}
.rm2d__tl:hover { border-color: var(--sfs-accent, #667eea); background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.1); }
.rm2d__tl[aria-pressed='true'] { border-color: var(--sfs-accent, #667eea); background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.18); }
.rm2d__tl:focus-visible { outline: 2px solid var(--sfs-focus, #a5b4fc); outline-offset: 2px; }
.rm2d__tlring { width: 2rem; height: 2rem; flex: none; }
.rm2d__tlnum { fill: var(--sfs-text, #f1f5f9); font-size: 12px; font-weight: 800; }
.rm2d__tltext { display: grid; min-width: 0; line-height: 1.2; }
.rm2d__tltitle { font-size: 0.8rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; unicode-bidi: plaintext; }
.rm2d__tlmeta { font-size: 0.7rem; color: var(--sfs-text-muted, #94a3b8); font-variant-numeric: tabular-nums; }

/* Rings, shared by the timeline and the stage headers. */
.rm2d__ringtrack { fill: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.04); stroke: rgb(var(--sfs-line-rgb, 255 255 255) / 0.16); stroke-width: 3; }
.rm2d__ringfill { fill: none; stroke: var(--sfs-success, #34d399); stroke-width: 3; stroke-linecap: round; }
.rm2d__tl.is-complete .rm2d__ringtrack, .rm2d__stage.is-complete .rm2d__ringtrack { fill: rgb(var(--sfs-success-rgb, 52 211 153) / 0.16); }

/* ---------------------------------------------------- the journey */
.rm2d__s1 { stop-color: var(--sfs-accent, #667eea); }
.rm2d__s2 { stop-color: var(--sfs-accent-2, #764ba2); }
.rm2d__s3 { stop-color: var(--sfs-accent-3, #f093fb); }
.rm2d__journey-glow { fill: none; stroke-width: 12; stroke-linecap: round; opacity: 0.35; }
.rm2d__journey { fill: none; stroke-width: 4; stroke-linecap: round; }
.rm2d__flow {
  fill: none; stroke: var(--sfs-on-accent, #fff); stroke-width: 2; stroke-linecap: round;
  stroke-dasharray: 2 22; opacity: 0.75;
}
.rm2d__stepper { fill: none; stroke: rgb(var(--sfs-line-rgb, 255 255 255) / 0.22); stroke-width: 2.5; stroke-linecap: round; }
.rm2d__stepper.is-done { stroke: var(--sfs-success, #34d399); }
.rm2d__dep {
  fill: none;
  stroke: var(--sfs-focus, #a5b4fc);
  stroke-width: 2.2;
  stroke-dasharray: 7 5;
}
.rm2d__arrowhead { fill: var(--sfs-focus, #a5b4fc); }

/* ---------------------------------------------------- stage headers */
.rm2d__header {
  fill: var(--sfs-surface-2, #1e2235);
  stroke: rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  stroke-width: 1;
}
.rm2d__sheen { pointer-events: none; }
.rm2d__sheen0 { stop-color: rgb(var(--sfs-tint-rgb, 255 255 255)); stop-opacity: 0.09; }
.rm2d__sheen1 { stop-color: rgb(var(--sfs-tint-rgb, 255 255 255)); stop-opacity: 0; }
.rm2d__focusglow { fill: var(--sfs-accent, #667eea); opacity: 0; transition: opacity var(--sfs-dur, 0.3s); }
.rm2d__stage.is-focus .rm2d__focusglow { opacity: 0.38; }
.rm2d__stage.is-focus .rm2d__header { stroke: var(--sfs-accent, #667eea); stroke-width: 2; }
.rm2d__stage.is-complete .rm2d__header { stroke: rgb(var(--sfs-success-rgb, 52 211 153) / 0.7); }
.rm2d__stopglow { fill: var(--sfs-accent, #667eea); opacity: 0.3; }
.rm2d__stopdot { fill: var(--sfs-accent, #667eea); stroke: var(--sfs-surface, #161a2b); stroke-width: 2; }
.rm2d__stage.is-complete .rm2d__stopdot, .rm2d__stage.is-complete .rm2d__stopglow { fill: var(--sfs-success, #34d399); }
.rm2d__track { fill: rgb(var(--sfs-line-rgb, 255 255 255) / 0.12); }
.rm2d__fill { fill: var(--sfs-success, #34d399); }
.rm2d__ringnum { fill: var(--sfs-text, #f1f5f9); font-size: 14px; font-weight: 800; }
.rm2d__eyebrow {
  fill: var(--sfs-accent-text, #a5b4fc);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.rm2d__count { fill: var(--sfs-text-muted, #94a3b8); font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
.rm2d__stitle { fill: var(--sfs-text, #f1f5f9); font-size: 13.5px; font-weight: 700; }

/* ---------------------------------------------------- step cards */
.rm2d__node { cursor: pointer; outline: none; }
.rm2d__lift { transition: transform 0.22s var(--sfs-ease-out, ease-out); transform-box: fill-box; transform-origin: center; }
.rm2d__shadow { fill: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.16); }
.rm2d__shadow--far { fill: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.1); }
.rm2d__box {
  fill: var(--sfs-surface, #161a2b);
  stroke: rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  stroke-width: 1.2;
  transition: stroke var(--sfs-dur-fast, 0.15s), fill var(--sfs-dur-fast, 0.15s);
}
.rm2d__halo { fill: none; stroke: var(--sfs-focus, #a5b4fc); stroke-width: 6; opacity: 0; transition: opacity var(--sfs-dur-fast, 0.15s); }
.rm2d__bar { fill: var(--sfs-accent, #667eea); }
.rm2d__node.is-optional .rm2d__box { stroke-dasharray: 6 4; }
.rm2d__node:hover .rm2d__box { fill: var(--sfs-surface-2, #1e2235); stroke: rgb(var(--sfs-line-rgb, 255 255 255) / 0.3); }
.rm2d__node:hover .rm2d__lift, .rm2d__node:focus-visible .rm2d__lift { transform: translateY(-2px); }
.rm2d__node.is-doing .rm2d__box { stroke: var(--sfs-warning, #fbbf24); stroke-width: 1.8; }
.rm2d__node.is-done .rm2d__box {
  stroke: var(--sfs-success, #34d399); stroke-width: 1.8;
  fill: color-mix(in srgb, var(--sfs-success, #34d399) 9%, var(--sfs-surface, #161a2b));
}
.rm2d__node.is-selected .rm2d__box,
.rm2d__node:focus-visible .rm2d__box { stroke: var(--sfs-focus, #a5b4fc); stroke-width: 2.4; }
.rm2d__node.is-selected .rm2d__halo { opacity: 0.35; }

.rm2d__shape { stroke: var(--sfs-surface, #161a2b); stroke-width: 1.5; stroke-linejoin: round; }
.rm2d__icon path { fill: none; stroke-width: 2.3; stroke-linecap: round; stroke-linejoin: round; }
.rm2d__node.is-course .rm2d__shape, .rm2d__node.is-course .rm2d__bar { fill: var(--sfs-accent, #667eea); }
.rm2d__node.is-course .rm2d__icon path { stroke: var(--sfs-on-accent, #fff); }
.rm2d__node.is-lesson .rm2d__shape, .rm2d__node.is-lesson .rm2d__bar { fill: var(--sfs-accent-2, #764ba2); }
.rm2d__node.is-lesson .rm2d__icon path { stroke: var(--sfs-on-accent-2, #fff); }
.rm2d__node.is-lab .rm2d__shape, .rm2d__node.is-lab .rm2d__bar { fill: var(--sfs-accent-3, #f093fb); }
.rm2d__node.is-lab .rm2d__icon path { stroke: var(--sfs-on-accent-3, #1f1033); }
.rm2d__node.is-runbook .rm2d__shape, .rm2d__node.is-runbook .rm2d__bar { fill: var(--sfs-info, #38bdf8); }
.rm2d__node.is-runbook .rm2d__icon path { stroke: var(--sfs-on-info, #082f49); }
.rm2d__node.is-topic .rm2d__shape, .rm2d__node.is-topic .rm2d__bar { fill: var(--sfs-text-muted, #94a3b8); }
.rm2d__node.is-topic .rm2d__icon path { stroke: var(--sfs-surface, #161a2b); }

.rm2d__title { fill: var(--sfs-text, #f1f5f9); font-size: 12.5px; font-weight: 650; }
.rm2d__kind { fill: var(--sfs-text-muted, #94a3b8); font-size: 10.5px; font-weight: 600; letter-spacing: 0.02em; }
.rm2d__badgering { fill: none; stroke: var(--sfs-warning, #fbbf24); stroke-width: 1.5; opacity: 0.5; }
.rm2d__badgefill { fill: var(--sfs-warning, #fbbf24); }
.rm2d__node.is-done .rm2d__badgefill { fill: var(--sfs-success, #34d399); }
.rm2d__node.is-done .rm2d__badgering { stroke: var(--sfs-success, #34d399); }
.rm2d__tick { fill: none; stroke: var(--sfs-on-success, #052e16); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.rm2d__dot { fill: var(--sfs-on-warning, #451a03); }

/*
  The reveal: the journey draws itself on, each stage rises in after it on a
  spring, each step in a stage follows, and light flows along the journey.
  Only ever with motion allowed - the component is told `animate=false` under
  prefers-reduced-motion, and the media query is a second line of defence for
  the same promise.
*/
@media (prefers-reduced-motion: no-preference) {
  .rm2d.is-animated .rm2d__journey,
  .rm2d.is-animated .rm2d__journey-glow {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: rm2d-draw 1.6s var(--sfs-ease-out, ease-out) forwards;
  }
  .rm2d.is-animated .rm2d__journey-glow { stroke-dasharray: 100000; stroke-dashoffset: 100000; animation-duration: 2.2s; }
  .rm2d.is-animated .rm2d__flow { animation: rm2d-flow 1.4s linear infinite; }
  .rm2d.is-animated .rm2d__dep { animation: rm2d-flow 0.9s linear infinite; }
  .rm2d.is-animated .rm2d__stage {
    opacity: 0;
    animation: rm2d-rise 0.65s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
    animation-delay: calc(var(--i) * 140ms + 120ms);
  }
  .rm2d.is-animated .rm2d__node {
    opacity: 0;
    animation: rm2d-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    animation-delay: calc(var(--s) * 140ms + var(--i) * 22ms + 360ms);
    transform-box: fill-box; transform-origin: center;
  }
  .rm2d.is-animated .rm2d__stepper { stroke-dasharray: 60; stroke-dashoffset: 60; animation: rm2d-draw 0.6s ease-out 0.9s forwards; }
  .rm2d__node.is-doing .rm2d__badgering { animation: rm2d-pulse 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
}
@keyframes rm2d-draw { to { stroke-dashoffset: 0; } }
@keyframes rm2d-flow { to { stroke-dashoffset: -24; } }
@keyframes rm2d-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes rm2d-pop { from { opacity: 0; transform: scale(0.86) translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes rm2d-pulse { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0; transform: scale(1.55); } }
</style>
