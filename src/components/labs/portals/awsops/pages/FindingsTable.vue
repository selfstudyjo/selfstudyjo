<template>
  <CsTable :variant="full ? 'full-page' : 'container'" title="Findings" :items="items" :columns="cols" track-by="id"
           selection-type="multi" v-model:selected="sel" filter-placeholder="Add filter" empty-title="No findings" empty-text="No failed checks.">
    <template #actions>
      <CsDropdown label="Workflow status" :items="[{ id: 'set', text: 'Set status' }]" :disabled="!sel.length" @select="$emit('workflow', sel)" />
    </template>
    <template #cell-severity="{ row }"><CsStatus :type="['CRITICAL', 'HIGH'].includes(row.severity) ? 'error' : 'warning'" :label="row.severity" /></template>
    <template #cell-workflow="{ row }">{{ row.workflow }}<div v-if="row.note" class="cs-muted ft__note">{{ row.note }}</div></template>
  </CsTable>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';

defineProps<{ items: Record<string, any>[]; full?: boolean }>();
defineEmits<{ (e: 'workflow', ids: string[]): void }>();
const sel = ref<string[]>([]);
const cols = [{ id: 'severity', header: 'Severity', sortKey: 'severity' }, { id: 'workflow', header: 'Workflow status' },
  { id: 'control', header: 'Control', sortKey: 'control' }, { id: 'title', header: 'Title' }, { id: 'resource', header: 'Resource' }];
</script>

<style scoped>
.ft__note { white-space: normal; max-width: 320px; font-size: 12px; }
</style>
