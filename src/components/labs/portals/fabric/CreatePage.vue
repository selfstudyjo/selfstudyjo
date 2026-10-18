<template>
  <div class="fx-page">
    <div class="fx-page__head">
      <h1 class="fx-page__title">{{ route.page === 'workloads' ? 'Workloads' : 'Create' }}</h1>
      <span class="fx-page__sub">Create an item in a workspace, or a new workspace.</span>
      <span class="fx-cmdbar__grow" />
      <button type="button" class="fx-btn" @click="$emit('new-workspace')"><FxIcon name="plus" />New workspace</button>
    </div>
    <div class="fx-page__scroll cp-body">
      <section v-for="w in workloads" :key="w.name" class="cp-section">
        <h2 class="fx-h3">{{ w.name }}</h2>
        <p class="fx-muted cp-desc">{{ w.desc }}</p>
        <div class="fx-cards">
          <button v-for="t in w.types" :key="t" type="button" class="fx-card"
                  :disabled="!workspaces.length" @click="creating = t">
            <span class="fx-card__title"><FxIcon :name="t" :size="24" />{{ info(t).label }}</span>
            <span class="fx-card__desc">{{ info(t).description }}</span>
          </button>
        </div>
      </section>
      <p v-if="!workspaces.length" class="fx-msgbar fx-msgbar--info">
        <FxIcon name="info" />Create a workspace first - every Fabric item lives in one.</p>
    </div>
    <NewItemDialog v-if="creating" :ws="route.ws || workspaces[0]?.name" :initial-type="creating"
                   @close="creating = ''" @created="opened" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FxIcon from './FxIcon.vue';
import NewItemDialog from './NewItemDialog.vue';
import { ITEM_TYPES, rows, useFabric } from './fabric';

defineEmits<{ (event: 'new-workspace'): void }>();
const { portal, route, go } = useFabric();
const creating = ref('');
const workspaces = computed(() => rows(portal.value, 'workspaces'));
const workloads = [
  { name: 'Data Engineering', desc: 'Lakehouses, notebooks and Spark environments.',
    types: ['Lakehouse', 'Notebook', 'Environment'] },
  { name: 'Data Factory', desc: 'Ingest and orchestrate data at scale.', types: ['DataPipeline'] },
  { name: 'Data Warehouse', desc: 'A fully transactional T-SQL warehouse on OneLake.',
    types: ['Warehouse'] },
  { name: 'Power BI', desc: 'Model and visualize your data.', types: ['SemanticModel', 'Report'] },
];
function info(type: string) { return ITEM_TYPES[type]; }
function opened(value: { ws: string; name: string; type: string }) {
  creating.value = '';
  go({ page: 'item', ws: value.ws, item: value.name, type: value.type });
}
</script>

<style scoped>
.cp-body { padding: 0 24px 24px; }
.cp-section { margin-bottom: 8px; }
.cp-desc { margin: -4px 0 10px; font-size: 13px; }
</style>
