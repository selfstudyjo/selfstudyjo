<template>
  <!-- The Create hub (app.fabric.microsoft.com/create): every item type, grouped by
       the workload that makes it, created into the workspace picked at the top. -->
  <div class="fx-page cp">
    <div class="fx-page__head cp-head">
      <div class="fx-page__titles">
        <h1 class="fx-page__title">Create</h1>
        <p class="fx-page__sub">Create an item in a workspace. Items are grouped by the workload that makes them.</p>
      </div>
      <div class="fx-page__actions">
        <button type="button" class="fx-btn" @click="$emit('new-workspace')"><FxIcon name="plus" />New workspace</button>
      </div>
    </div>

    <div class="cp-bar">
      <label class="cp-ws">
        <span class="cp-ws__label"><FxIcon name="Workspace" :size="16" />Workspace</span>
        <select v-model="target" class="fx-select cp-ws__select" :disabled="!workspaces.length" aria-label="Workspace">
          <option v-if="!workspaces.length" value="">No workspaces</option>
          <option v-for="w in workspaces" :key="w.name" :value="w.name">{{ w.name }}</option>
        </select>
      </label>
      <div class="fx-input fx-input--search cp-filter">
        <FxIcon name="search" :size="14" />
        <input v-model="filter" placeholder="Filter by item type" aria-label="Filter by item type" />
      </div>
      <label class="cp-only">
        <button type="button" class="fx-switch" :class="{ 'is-on': onlyAvailable }" role="switch"
                :aria-checked="onlyAvailable" aria-label="Available in this lab only"
                @click="onlyAvailable = !onlyAvailable" />
        <span>Available in this lab only</span>
      </label>
    </div>

    <div class="fx-page__scroll">
      <div class="fx-page__body cp-body">
        <p v-if="!workspaces.length" class="fx-msgbar fx-msgbar--info cp-msg">
          <FxIcon name="info" /><span>Create a workspace first - every Fabric item lives in one.
            <button type="button" class="fx-link" @click="$emit('new-workspace')">New workspace</button></span></p>

        <section v-for="w in sections" :key="w.id" class="fx-section">
          <div class="fx-section__head">
            <FxIcon :name="w.icon" :size="24" />
            <h2 class="fx-section__title">{{ w.name }}</h2>
            <button type="button" class="fx-section__link" @click="go({ page: 'workload', wl: w.id })">
              See all<FxIcon name="chevronRight" :size="12" />
            </button>
          </div>
          <div class="cp-grid">
            <FxTypeTile v-for="t in w.list" :key="w.id + t" :type="t" :blocked="!workspaces.length"
                        @pick="creating = t" />
          </div>
        </section>

        <div v-if="!sections.length" class="fx-empty">
          <FxIcon name="search" :size="36" />
          <h3>No item types match "{{ filter }}"</h3>
          <p>Try another name, or turn off "Available in this lab only".</p>
        </div>
      </div>
    </div>

    <NewItemDialog v-if="creating" :ws="target" :initial-type="creating"
                   @close="creating = ''" @created="opened" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import FxIcon from './FxIcon.vue';
import FxTypeTile from './FxTypeTile.vue';
import NewItemDialog from './NewItemDialog.vue';
import { WORKLOADS, rows, typeInfo, useFabric } from './fabric';

defineEmits<{ (event: 'new-workspace'): void }>();
const { portal, route, go } = useFabric();
const creating = ref('');
const filter = ref('');
const onlyAvailable = ref(false);
const workspaces = computed(() => rows(portal.value, 'workspaces'));
const target = ref(route.value.ws || workspaces.value[0]?.name || '');
// A workspace created (or deleted) while the hub is open: keep the pick valid.
watch(workspaces, list => {
  if (!list.some(w => w.name === target.value)) target.value = list[0]?.name || '';
});

const sections = computed(() => {
  const text = filter.value.trim().toLowerCase();
  return WORKLOADS.map(w => {
    const list = w.types.filter(t => {
      const info = typeInfo(t);
      if (onlyAvailable.value && !info.available) return false;
      return !text || info.label.toLowerCase().includes(text) || info.description.toLowerCase().includes(text);
    });
    // Within a workload, what this lab can create comes first.
    list.sort((a, b) => Number(typeInfo(b).available) - Number(typeInfo(a).available));
    return { ...w, list };
  }).filter(w => w.list.length);
});

function opened(value: { ws: string; name: string; type: string }) {
  creating.value = '';
  go({ page: 'item', ws: value.ws, item: value.name, type: value.type });
}
</script>

<style scoped>
.cp-bar {
  display: flex; align-items: center; gap: 12px 16px; flex-wrap: wrap;
  padding: 0 var(--fx-gutter) 12px; border-bottom: 1px solid #e0e0e0;
}
.cp-ws { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cp-ws__label { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; white-space: nowrap; }
.cp-ws__select { width: 240px; max-width: 100%; }
.cp-filter { width: 260px; max-width: 100%; }
.cp-only { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: #424242; cursor: pointer; margin-left: auto; }
.cp-body { padding-top: 12px; }
.cp-msg { margin: 8px 0 0; align-items: center; }
.cp-grid {
  display: grid; gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
}
@container sl-portal (max-width: 760px) {
  .cp-only { margin-left: 0; }
}
@container sl-portal (max-width: 600px) {
  .cp-ws { flex: 1 1 100%; }
  .cp-ws__select { flex: 1; width: auto; min-width: 0; }
  .cp-filter { flex: 1 1 100%; width: auto; }
  .cp-grid { gap: 8px; }
}
</style>
