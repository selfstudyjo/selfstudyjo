<template>
  <div>
    <h4 class="spk-h4" @click="open = !open">
      <span :class="open ? 'arrow-open' : 'arrow-closed'"></span><a href="#" @click.prevent>Event Timeline</a>
    </h4>
    <div v-if="open" class="tl">
      <div class="tl__legend">
        <span v-if="executors.length"><i class="is-added"></i>Executor Added</span>
        <span v-if="executors.length"><i class="is-removed"></i>Executor Removed</span>
        <span><i class="is-succeeded"></i>Succeeded</span>
        <span><i class="is-failed"></i>Failed</span>
        <span><i class="is-running"></i>Running</span>
      </div>
      <svg class="tl__svg" :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none" role="img" aria-label="Event timeline">
        <g v-if="executors.length">
          <rect x="0" y="0" :width="LABEL" :height="laneH" fill="#f5f5f5" />
          <text x="8" :y="laneH / 2 + 4" font-size="12" fill="#333">Executors</text>
          <g v-for="(e, i) in executors" :key="e.id">
            <rect :x="x(e.at)" :y="8 + (i % 3) * 14" width="150" height="12" class="tl__added" />
            <text :x="x(e.at) + 4" :y="18 + (i % 3) * 14" font-size="10" fill="#333">Executor {{ e.id }} added</text>
          </g>
        </g>
        <g :transform="`translate(0, ${executors.length ? laneH : 0})`">
          <rect x="0" y="0" :width="LABEL" :height="itemsH" fill="#f5f5f5" />
          <text x="8" :y="itemsH / 2 + 4" font-size="12" fill="#333">{{ itemLabel }}</text>
          <g v-for="(item, i) in items" :key="i">
            <rect :x="x(item.start)" :y="6 + (i % rowsN) * 20" :width="Math.max(30, x(item.end) - x(item.start))" height="16"
                  :class="'tl__' + item.status" rx="2" />
            <text :x="x(item.start) + 4" :y="18 + (i % rowsN) * 20" font-size="10" fill="#333">{{ item.label }}</text>
          </g>
        </g>
        <line :x1="LABEL" :x2="W" :y1="height - 18" :y2="height - 18" stroke="#ccc" />
        <text v-for="t in ticks" :key="t.x" :x="t.x" :y="height - 4" font-size="10" fill="#666" text-anchor="middle">{{ t.label }}</text>
      </svg>
      <label class="tl__zoom"><input v-model="zoom" type="checkbox" /> Enable zooming</label>
    </div>
  </div>
</template>

<script setup lang="ts">
/** The vis.js event timeline Spark draws above its job and stage lists. Plain SVG. */
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{
  items: { start: number; end: number; label: string; status: string }[];
  executors?: { id: string; at: number }[];
  itemLabel?: string;
}>(), { executors: () => [], itemLabel: 'Jobs' });

const open = ref(false);
const zoom = ref(false);
const W = 1000;
const LABEL = 80;
const laneH = 54;
const rowsN = computed(() => Math.min(4, Math.max(1, props.items.length)));
const itemsH = computed(() => 12 + rowsN.value * 20);
const height = computed(() => (props.executors.length ? laneH : 0) + itemsH.value + 22);

const range = computed(() => {
  const times = [...props.items.flatMap(i => [i.start, i.end]), ...props.executors.map(e => e.at)].filter(Boolean);
  const lo = times.length ? Math.min(...times) : Date.now() - 60000;
  const hi = times.length ? Math.max(...times) : Date.now();
  const pad = Math.max(500, (hi - lo) * 0.08);
  return [lo - pad, hi + pad];
});
function x(t: number) {
  const [lo, hi] = range.value;
  return LABEL + ((t - lo) / Math.max(1, hi - lo)) * (W - LABEL - 160);
}
const ticks = computed(() => {
  const [lo, hi] = range.value;
  return Array.from({ length: 5 }, (_, i) => {
    const t = lo + ((hi - lo) * i) / 4;
    const d = new Date(t);
    return { x: x(t), label: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}` };
  });
});
</script>

<style scoped>
.tl { border: 1px solid #ddd; padding: 8px; margin-bottom: 12px; }
.tl__legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; margin-bottom: 6px; }
.tl__legend span { display: flex; align-items: center; gap: 5px; }
.tl__legend i { display: inline-block; width: 14px; height: 10px; border: 1px solid #999; }
.is-added { background: #D5DDF6; }
.is-removed { background: #EBCA59; }
.is-succeeded { background: #D5DDF6; }
.is-failed { background: #FF5475; }
.is-running { background: #FDFFCA; }
.tl__svg { width: 100%; height: auto; display: block; }
.tl__added { fill: #D5DDF6; stroke: #7e9bd4; }
.tl__succeeded { fill: #D5DDF6; stroke: #3EC0FF; }
.tl__failed { fill: #FF5475; stroke: #c82333; }
.tl__running { fill: #FDFFCA; stroke: #d4c94a; }
.tl__zoom { display: inline-flex; gap: 6px; align-items: center; font-size: 12px; margin-top: 4px; }
</style>
