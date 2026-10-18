<template>
  <div class="kd-overview">
    <template v-if="present.length">
      <section class="kd-card kd-status-card">
        <header class="kd-card__head"><h2 class="kd-card__title">Workload Status</h2></header>
        <div class="kd-donuts">
          <figure v-for="item in charts" :key="item.def.kind" class="kd-donut">
            <svg viewBox="0 0 42 42" class="kd-donut__svg" role="img" :aria-label="`${item.def.title}: ${item.total}`">
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e0e0e0" stroke-width="5" />
              <circle v-for="seg in item.segments" :key="seg.label" cx="21" cy="21" r="15.9155" fill="none"
                      :stroke="seg.color" stroke-width="5" :stroke-dasharray="`${seg.share} ${100 - seg.share}`"
                      :stroke-dashoffset="25 - seg.offset" />
              <text x="21" y="23.5" text-anchor="middle" class="kd-donut__num">{{ item.total }}</text>
            </svg>
            <figcaption>
              <a href="#" class="kd-donut__title" @click.prevent="$emit('list', item.def)">{{ item.def.title }}</a>
              <ul class="kd-legend">
                <li v-for="seg in item.legend" :key="seg.label">
                  <i :style="{ background: seg.color }" />{{ seg.label }}: {{ seg.value }}
                </li>
              </ul>
            </figcaption>
          </figure>
        </div>
      </section>
      <KdTable v-for="def in present" :key="def.kind" :def="def" :rows="lists[def.kind]" :all-namespaces="allNamespaces"
               :per-page="perPage" @open="row => $emit('open', def, row)" @act="p => $emit('act', def, p)" />
    </template>
    <section v-else class="kd-card kd-empty">
      <h2>There is nothing to display here</h2>
      <p>You can <a href="#" class="kd-link" @click.prevent="$emit('create')">deploy a containerized app</a>, select other namespace or take the Dashboard Tour to learn more.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
/** The Workloads page: "Workload Status" donuts, then one list per workload kind. */
import { computed } from 'vue';
import KdTable from './KdTable.vue';
import { listOf, statusCounts, WORKLOAD_KINDS, type KindDef, type Row } from './k8s';

const props = defineProps<{ view: Record<string, any>; namespace: string; allNamespaces: boolean; perPage: number }>();
defineEmits<{
  (e: 'open', def: KindDef, row: Row): void;
  (e: 'act', def: KindDef, payload: { type: string; row: Row }): void;
  (e: 'list', def: KindDef): void;
  (e: 'create'): void;
}>();

const COLORS = { running: '#00c752', pending: '#ffad20', failed: '#ff481b', succeeded: '#006028' };

const lists = computed<Record<string, Row[]>>(() => {
  const out: Record<string, Row[]> = {};
  for (const def of WORKLOAD_KINDS) out[def.kind] = listOf(props.view, def, props.namespace);
  return out;
});
const present = computed(() => WORKLOAD_KINDS.filter(def => lists.value[def.kind].length));

const charts = computed(() => present.value.map(def => {
  const counts = statusCounts(lists.value[def.kind]);
  const total = lists.value[def.kind].length;
  const parts = [
    { label: 'Running', value: counts.running, color: COLORS.running },
    { label: 'Pending', value: counts.pending, color: COLORS.pending },
    { label: 'Failed', value: counts.failed, color: COLORS.failed },
    { label: 'Succeeded', value: counts.succeeded, color: COLORS.succeeded },
  ];
  let offset = 0;
  const segments = parts.filter(p => p.value > 0).map(p => {
    const share = (p.value / Math.max(1, total)) * 100;
    const seg = { ...p, share, offset };
    offset += share;
    return seg;
  });
  return { def, total, segments, legend: parts.filter(p => p.value > 0 || p.label !== 'Succeeded') };
}));
</script>

<style scoped>
.kd-card { background: #fff; box-shadow: var(--kd-shadow); border-radius: 2px; margin-bottom: 16px; }
.kd-card__head { display: flex; align-items: center; min-height: 56px; padding: 0 20px; }
.kd-card__title { margin: 0; font-size: 18px; font-weight: 400; color: rgb(0 0 0 / 0.87); }
.kd-donuts { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px 8px; padding: 4px 20px 24px; }
.kd-donut { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.kd-donut__svg { width: 116px; height: 116px; }
.kd-donut__num { font-size: 12px; fill: rgb(0 0 0 / 0.87); font-family: inherit; }
.kd-donut figcaption { text-align: center; }
.kd-donut__title { display: block; font-size: 16px; color: var(--kd-primary); text-decoration: none; margin-bottom: 4px; }
.kd-legend { list-style: none; margin: 0; padding: 0; font-size: 12px; color: rgb(0 0 0 / 0.54); text-align: left; }
.kd-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
.kd-empty { padding: 32px 24px; text-align: center; color: rgb(0 0 0 / 0.54); }
.kd-empty h2 { font-size: 20px; font-weight: 400; margin: 0 0 12px; color: rgb(0 0 0 / 0.87); }
.kd-empty p { font-size: 14px; margin: 0; }
.kd-link { color: var(--kd-primary); text-decoration: none; }
</style>
