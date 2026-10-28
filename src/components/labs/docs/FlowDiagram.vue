<template>
  <!--
    A FLOW DIAGRAM, drawn as plain SVG from `layoutDiagram` - no flowchart
    library. Pinned `dir="ltr"`: a flow is a place, not a paragraph, and the
    arrows would otherwise point the wrong way in Arabic. Every label is a text
    node (no v-html), and the same flow is also written out as a list for a
    screen reader, since an SVG of boxes says nothing on its own.
  -->
  <figure class="sfd" dir="ltr">
    <div class="sfd__scroll">
      <svg class="sfd__svg" :viewBox="`0 0 ${layout.width} ${layout.height}`"
           :width="layout.width" :height="layout.height" role="img" :aria-label="summary">
        <defs>
          <marker :id="markerId" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7"
                  orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" class="sfd__head" />
          </marker>
        </defs>
        <g v-for="(edge, at) in layout.edges" :key="'e' + at">
          <path :d="edge.d" class="sfd__edge" :class="{ 'is-back': edge.back }"
                :marker-end="`url(#${markerId})`" />
          <path v-if="animate" :d="edge.d" class="sfd__flow" :style="{ animationDelay: `${at * 0.35}s` }" />
          <text v-if="edge.label" :x="edge.lx" :y="edge.ly - 6" class="sfd__elabel" text-anchor="middle">{{ edge.label }}</text>
        </g>
        <g v-for="node in layout.nodes" :key="node.id" :class="['sfd__node', `is-${node.kind}`]">
          <polygon v-if="node.kind === 'decision'" :points="diamond(node)" class="sfd__shape" />
          <rect v-else :x="node.x" :y="node.y" :width="node.w" :height="node.h"
                :rx="node.kind === 'start' || node.kind === 'end' ? node.h / 2 : 10" class="sfd__shape" />
          <rect v-if="node.kind === 'data'" :x="node.x + 4" :y="node.y + 4" :width="node.w - 8" :height="node.h - 8"
                rx="7" class="sfd__inner" />
          <circle v-if="node.kind === 'actor'" :cx="node.x + 16" :cy="node.y + node.h / 2" r="6" class="sfd__actor" />
          <text :x="node.x + node.w / 2 + (node.kind === 'actor' ? 8 : 0)"
                :y="node.y + node.h / 2 - (node.lines.length - 1) * 8" class="sfd__label" text-anchor="middle">
            <tspan v-for="(line, i) in node.lines" :key="i" :x="node.x + node.w / 2 + (node.kind === 'actor' ? 8 : 0)"
                   :dy="i === 0 ? 0 : 17">{{ line }}</tspan>
          </text>
        </g>
      </svg>
    </div>
    <figcaption v-if="caption" class="sfd__caption">{{ caption }}</figcaption>
    <ol class="sfd__sr">
      <li v-for="(edge, at) in diagram.edges" :key="at">
        {{ nameOf(edge.from) }} → {{ nameOf(edge.to) }}<template v-if="edge.label">: {{ edge.label }}</template>
      </li>
    </ol>
  </figure>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { layoutDiagram, type Diagram, type PlacedNode } from '@/utils/labDocs';

const props = defineProps<{ diagram: Diagram; caption?: string; lineChars?: number }>();

/*
 * A left-to-right flow wider than the reading column would be scaled down until
 * its labels are unreadable, so it is laid out top-to-bottom instead: a tall
 * diagram scrolls with the text, a shrunken one is not read at all.
 */
const MAX_LR_WIDTH = 720;
const layout = computed(() => {
  const first = layoutDiagram(props.diagram, { lineChars: props.lineChars });
  if (props.diagram.dir !== 'LR' || first.width <= MAX_LR_WIDTH) return first;
  return layoutDiagram({ ...props.diagram, dir: 'TB' }, { lineChars: props.lineChars });
});
const markerId = `sfd-head-${Math.random().toString(36).slice(2, 8)}`;
const animate = typeof window !== 'undefined'
  && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function nameOf(id: string) {
  return props.diagram.nodes.find(n => n.id === id)?.label || id;
}
const summary = computed(() => props.diagram.nodes.map(n => n.label).join(', '));

function diamond(n: PlacedNode) {
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  return `${n.x},${cy} ${cx},${n.y - 6} ${n.x + n.w},${cy} ${cx},${n.y + n.h + 6}`;
}
</script>

<style scoped>
.sfd { margin: 0.75rem 0; }
.sfd__scroll { overflow-x: auto; padding: 0.25rem 0; }
.sfd__svg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
.sfd__edge { fill: none; stroke: rgb(var(--sfs-line-rgb, 148 163 184) / 0.75); stroke-width: 2; }
.sfd__edge.is-back { stroke-dasharray: 5 5; }
.sfd__head { fill: rgb(var(--sfs-line-rgb, 148 163 184) / 0.9); }
.sfd__flow {
  fill: none; stroke: var(--sfs-accent, #667eea); stroke-width: 3; stroke-linecap: round;
  stroke-dasharray: 10 400; animation: sfd-flow 2.6s linear infinite;
}
@keyframes sfd-flow { from { stroke-dashoffset: 410; } to { stroke-dashoffset: 0; } }
.sfd__elabel { font: 600 12px system-ui, sans-serif; fill: var(--sfs-text-muted, #94a3b8); paint-order: stroke;
  stroke: var(--sfs-surface, #0f172a); stroke-width: 4px; stroke-linejoin: round; }
.sfd__shape { fill: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08); stroke: rgb(var(--sfs-line-rgb, 148 163 184) / 0.6); stroke-width: 1.5; }
.is-start .sfd__shape, .is-end .sfd__shape { fill: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.22); stroke: var(--sfs-accent, #667eea); }
.is-decision .sfd__shape { fill: rgb(var(--sfs-accent-2-rgb, 244 114 182) / 0.16); stroke: var(--sfs-accent-2, #f472b6); }
.is-data .sfd__shape { stroke: var(--sfs-accent-3, #22d3ee); }
.sfd__inner { fill: none; stroke: rgb(var(--sfs-accent-3-rgb, 34 211 238) / 0.5); }
.sfd__actor { fill: var(--sfs-accent, #667eea); }
.sfd__label { font: 600 13px system-ui, sans-serif; fill: var(--sfs-text, #e5e7eb); dominant-baseline: middle; }
.sfd__caption { text-align: center; font-size: 0.85rem; color: var(--sfs-text-muted, #94a3b8); margin-top: 0.25rem; }
.sfd__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .sfd__flow { animation: none; } }
</style>
