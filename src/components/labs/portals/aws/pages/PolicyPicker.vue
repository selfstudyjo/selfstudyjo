<template>
  <CsTable v-model:selected="model" :title="title" :items="policies" :columns="columns" track-by="arn"
           selection-type="multi" filter-placeholder="Search" :filter-fields="['name', 'type', 'description']"
           :description="description">
    <template #cell-name="{ row }"><span class="cs-link">{{ row.name }}</span></template>
  </CsTable>
</template>

<script setup lang="ts">
/** The "Permissions policies" table the IAM wizards use to attach managed policies. */
import { computed } from 'vue';
import { rows } from '@/utils/portalKit';
import CsTable, { type Column } from '../CsTable.vue';
import { useAws } from '../ctx';

const props = withDefaults(defineProps<{ modelValue: string[]; exclude?: string[]; title?: string; description?: string }>(),
  { exclude: () => [], title: 'Permissions policies', description: 'Choose one or more policies to attach to your new role.' });
const emit = defineEmits<{ (e: 'update:modelValue', value: string[]): void }>();
const ctx = useAws();
const model = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) });
const policies = computed(() => rows(ctx.view.value, 'iam.managed_policies')
  .filter(p => !props.exclude.includes(p.arn)));
const columns: Column[] = [
  { id: 'name', header: 'Policy name', sortKey: 'name' },
  { id: 'type', header: 'Type', sortKey: 'type' },
  { id: 'description', header: 'Description' },
];
</script>
