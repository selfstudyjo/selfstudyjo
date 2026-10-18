<template>
  <div>
    <h4 class="spk-h4" @click="open = !open">
      <span :class="open ? 'arrow-open' : 'arrow-closed'"></span><a href="#" @click.prevent>DAG Visualization</a>
    </h4>
    <div v-if="open" class="dag">
      <svg :viewBox="`0 0 ${width} ${height}`" :style="{ width: width + 'px' }" role="img" aria-label="DAG visualization">
        <defs>
          <marker :id="arrowId" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#666" />
          </marker>
        </defs>
        <g v-for="(stage, i) in stages" :key="stage.key" :transform="`translate(${i * (BOX + GAP) + 10}, 10)`">
          <rect :width="BOX" :height="height - 20" class="dag__stage" rx="3" />
          <text x="8" y="18" class="dag__title">Stage {{ stage.stageId }}</text>
          <g v-for="(node, n) in nodesFor(stage, i)" :key="n">
            <rect x="14" :y="34 + n * 52" :width="BOX - 28" height="34" class="dag__node" rx="4" />
            <text :x="BOX / 2" :y="55 + n * 52" text-anchor="middle" class="dag__label">{{ node }}</text>
            <line v-if="n > 0" :x1="BOX / 2" :x2="BOX / 2" :y1="34 + (n - 1) * 52 + 34" :y2="34 + n * 52 - 2"
                  stroke="#666" :marker-end="`url(#${arrowId})`" />
          </g>
        </g>
        <line v-for="(_, i) in stages.slice(1)" :key="'e' + i" :x1="i * (BOX + GAP) + 10 + BOX"
              :x2="(i + 1) * (BOX + GAP) + 10 - 2" :y1="height / 2" :y2="height / 2" stroke="#666"
              :marker-end="`url(#${arrowId})`" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Spark's DAG visualization: a box per stage, the operators inside it, shuffles between. */
import { computed, ref } from 'vue';
import type { SparkStage } from './spark';

const props = withDefaults(defineProps<{ stages: SparkStage[]; startOpen?: boolean }>(), { startOpen: true });
const open = ref(props.startOpen);
const arrowId = `dag-arrow-${Math.random().toString(36).slice(2, 8)}`;
const BOX = 190;
const GAP = 50;

function nodesFor(stage: SparkStage, index: number): string[] {
  const name = stage.name;
  if (index === 0) {
    return ['Scan csv', 'WholeStageCodegen (1)', stage.shuffleWrite ? 'Exchange' : 'mapPartitionsInternal'];
  }
  if (/Join/.test(name)) return ['Exchange', 'WholeStageCodegen (2)', 'ShuffledHashJoin'];
  if (/Aggregate|Reducer/.test(name)) return ['Exchange', 'WholeStageCodegen (3)', 'HashAggregate'];
  if (/Sort/.test(name)) return ['Exchange', 'WholeStageCodegen (4)', 'mapPartitionsInternal'];
  return ['ShuffledRowRDD', 'WholeStageCodegen', 'mapPartitionsInternal'];
}

const width = computed(() => Math.max(1, props.stages.length) * (BOX + GAP) - GAP + 20);
const height = 230;
</script>

<style scoped>
.dag { overflow-x: auto; border: 1px solid #eee; padding: 6px; margin-bottom: 12px; }
.dag svg { max-width: none; height: auto; display: block; }
.dag__stage { fill: #fff; stroke: #FF99AC; stroke-width: 1.5; }
.dag__title { font-size: 12px; fill: #FF5475; font-weight: 700; }
.dag__node { fill: #C3EBFF; stroke: #3EC0FF; }
.dag__label { font-size: 12px; fill: #333; }
</style>
