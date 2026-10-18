<template>
  <CsModal title="Manage tags" size="large" @close="$emit('close')">
    <p class="mt__p">A tag is a custom label that you assign to an AWS resource. You can use tags to help organize and identify your resources.</p>
    <p class="mt__p">Resource: <span class="cs-mono">{{ resourceId }}</span></p>
    <TagEditor v-model="list" />
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="$emit('close')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || list.some(t => tagProblem(t))" @click="save">Save</button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
/** EC2 / VPC "Manage tags": create-tags for what is set, delete-tags for what was removed. */
import { ref } from 'vue';
import { cli } from '@/utils/portalKit';
import CsModal from '../CsModal.vue';
import TagEditor, { type Tag } from '../TagEditor.vue';
import { tagProblem } from '../commands';
import { useAws } from '../ctx';

const props = defineProps<{ resourceId: string; tags: Record<string, string> }>();
const emit = defineEmits<{ (e: 'close'): void }>();
const ctx = useAws();
const busy = ref(false);
const list = ref<Tag[]>(Object.entries(props.tags || {}).map(([key, value]) => ({ key, value: String(value ?? '') })));

async function save() {
  busy.value = true;
  const kept = list.value.filter(t => t.key.trim());
  const removed = Object.keys(props.tags || {}).filter(key => !kept.some(t => t.key.trim() === key));
  let ok = true;
  if (removed.length) {
    const result = await ctx.run(cli(['aws', 'ec2', 'delete-tags'], {
      '--resources': props.resourceId, '--tags': removed.map(key => `Key=${key}`),
    }));
    ok = ok && result.ok;
  }
  if (kept.length) {
    const result = await ctx.run(cli(['aws', 'ec2', 'create-tags'], {
      '--resources': props.resourceId, '--tags': kept.map(t => `Key=${t.key.trim()},Value=${t.value.trim()}`),
    }));
    ok = ok && result.ok;
  }
  busy.value = false;
  if (ok) {
    ctx.api.notify('success', `Successfully saved tags for ${props.resourceId}`);
    emit('close');
  }
}
</script>

<style scoped>
.mt__p { margin: 0 0 12px; }
</style>
