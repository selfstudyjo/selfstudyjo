<template>
  <AzPane title="Edit tags" :subtitle="name" :error="error" @close="$emit('close')">
    <div class="az-field"><div class="az-field__label">Resource</div>
      <div class="az-field__ctl az-mono">{{ name }} ({{ type }})</div></div>
    <AzTagEditor ref="editor" v-model="draft" />
    <template #foot>
      <button type="button" class="az-btn az-btn--primary" :disabled="saving || Boolean(problem)" @click="save">Save</button>
      <button type="button" class="az-btn" @click="$emit('close')">Cancel</button>
    </template>
  </AzPane>
</template>

<script setup lang="ts">
/** "Edit tags" for a resource group or a resource: one `az tag update --operation Replace`. */
import { computed, ref } from 'vue';
import { errorText } from '@/utils/portalKit';
import AzPane from './AzPane.vue';
import AzTagEditor from './AzTagEditor.vue';
import { tagCommand, useAz } from './azure';

const props = defineProps<{ targetId: string; name: string; type: string; tags: Record<string, string> }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const az = useAz();
const draft = ref<Record<string, string>>({ ...(props.tags || {}) });
const editor = ref<InstanceType<typeof AzTagEditor> | null>(null);
const problem = computed(() => (editor.value as any)?.problem || '');
const saving = ref(false);
const error = ref('');

async function save() {
  saving.value = true;
  error.value = '';
  const result = await az.run(tagCommand(props.targetId, draft.value), `Updated tags for ${props.name}`, { quiet: true });
  saving.value = false;
  if (!result.ok) { error.value = errorText(result); return; }
  emit('close');
}
</script>
