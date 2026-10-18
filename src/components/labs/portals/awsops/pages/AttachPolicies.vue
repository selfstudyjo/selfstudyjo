<template>
  <CsModal :title="title" size="large" @close="$emit('close')">
    <p class="cs-muted ap__p">Attach one or more managed policies. Policies already attached are not listed.</p>
    <CsTable title="Other permissions policies" :items="available" :columns="cols" track-by="arn" selection-type="multi"
             v-model:selected="picked" filter-placeholder="Filter by property or policy name and press enter" :info="false">
      <template #cell-type="{ row }">{{ row.aws ? 'AWS managed' : 'Customer managed' }}</template>
    </CsTable>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="$emit('close')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="!picked.length || busy" @click="$emit('attach', picked)">
        <span v-if="busy" class="cs-btn__spinner" />{{ action }}</button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { rows } from '@/utils/portalKit';
import CsModal from '../../aws/CsModal.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const props = withDefaults(defineProps<{ attached: string[]; title?: string; action?: string; busy?: boolean }>(),
  { title: 'Attach policy', action: 'Attach policies', busy: false });
defineEmits<{ (e: 'close'): void; (e: 'attach', arns: string[]): void }>();

const ctx = useOps();
const picked = ref<string[]>([]);
const available = computed(() => rows<any>(ctx.c.value, 'iam.policies').filter(p => !props.attached.includes(p.arn)));
const cols = [{ id: 'name', header: 'Policy name', sortKey: 'name' }, { id: 'type', header: 'Type' },
  { id: 'attachments', header: 'Attached entities', sortKey: 'attachments' }];
</script>

<style scoped>
.ap__p { margin: 0 0 12px; }
</style>
