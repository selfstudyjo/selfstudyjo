<template>
  <div class="fx-page">
    <div class="fx-page__head">
      <h1 class="fx-page__title">Workspaces</h1>
      <span class="fx-pill">{{ list.length }}</span>
      <span class="fx-cmdbar__grow" />
      <button type="button" class="fx-btn fx-btn--primary" @click="$emit('new-workspace')">
        <FxIcon name="plus" />New workspace
      </button>
    </div>
    <div class="fx-page__scroll fx-tablewrap">
      <table class="fx-table">
        <thead><tr><th>Name</th><th>Description</th><th>Capacity</th><th>Your role</th>
          <th>Items</th><th>Git</th></tr></thead>
        <tbody>
          <tr v-for="w in list" :key="w.name">
            <td><span class="fx-cellname"><FxIcon name="Workspace" :size="20" />
              <button type="button" @click="go({ page: 'workspace', ws: w.name })">{{ w.name }}</button></span></td>
            <td class="fx-muted">{{ w.description || '—' }}</td>
            <td>{{ w.capacity || 'None' }}</td>
            <td>{{ myRole(w) }}</td>
            <td>{{ countIn(w.name) }}</td>
            <td>{{ w.git ? w.git.repo + '@' + w.git.branch : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!list.length" class="fx-empty"><FxIcon name="workspaces" :size="40" />
        <h3>No workspaces</h3><p>Create a workspace to start working with Fabric items.</p></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FxIcon from './FxIcon.vue';
import { rows, useFabric } from './fabric';

defineEmits<{ (event: 'new-workspace'): void }>();
const { portal, go } = useFabric();
const list = computed(() => rows(portal.value, 'workspaces'));
function countIn(ws: string) {
  return rows(portal.value, 'items').filter(i => i.workspace === ws).length;
}
function myRole(w: Record<string, any>) {
  const me = portal.value.me;
  return (w.roles || []).find((r: any) => r.principal === me)?.role || 'Member (via group)';
}
</script>
