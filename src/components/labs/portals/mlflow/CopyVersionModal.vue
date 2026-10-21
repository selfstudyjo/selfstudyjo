<template>
  <MfModal :title="`Copy version ${version} of ${name}`" ok-text="Copy" :ok-disabled="!target || target === name" :busy="saving"
           @close="$emit('close')" @ok="submit">
    <p class="mf-p mf-muted">Copying creates a new version of the destination model that points at the same source run
      (<code class="mf-mono">MlflowClient.copy_model_version</code>). The copy starts in stage None with no aliases; its tags come along.
      This is how a model is promoted from a development registry name to a production one.</p>
    <label class="mf-field">
      <span class="mf-label">Destination model</span>
      <select v-model="choice" class="mf-select" aria-label="Destination model">
        <option value="__new__">+ Create New Model</option>
        <option v-for="m in others" :key="m.name" :value="m.name">{{ m.name }}</option>
      </select>
    </label>
    <label v-if="choice === '__new__'" class="mf-field">
      <span class="mf-label">New model name</span>
      <input v-model="newName" class="mf-input" placeholder="e.g. churn-prod" aria-label="New model name" @keydown.enter="submit" />
      <span v-if="newName.trim() && mf.model(newName.trim())" class="mf-hint">That model exists - the copy is added to it as a new version.</span>
    </label>
    <p v-else class="mf-hint">Becomes version {{ (mf.model(choice)?.latest_version || 0) + 1 }} of {{ choice }}.</p>
    <div v-if="error" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ error }}</span></div>
  </MfModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import MfModal from './MfModal.vue';
import { mlflow, useMf } from './mfContext';

const props = defineProps<{ name: string; version: number }>();
const emit = defineEmits<{ (event: 'close'): void; (event: 'done', name: string, version: number): void }>();
const mf = useMf();
const others = computed(() => mf.models.value.filter(m => m.name !== props.name));
const choice = ref('__new__');
const newName = ref('');
const saving = ref(false);
const error = ref('');
const target = computed(() => (choice.value === '__new__' ? newName.value.trim() : choice.value));

async function submit() {
  const dst = target.value;
  if (!dst || dst === props.name || saving.value) return;
  saving.value = true;
  const result = await mf.run(mlflow(['models', 'copy-version'], { '--name': props.name, '--version': props.version, '--dst-name': dst }),
                              { quiet: true });
  saving.value = false;
  if (!result.ok) { error.value = String(result.error || result.output || '').trim(); return; }
  const match = String(result.output || '').match(/as version (\d+)/);
  const made = match ? Number(match[1]) : (mf.model(dst)?.latest_version || 1);
  mf.notify('success', `Copied to ${dst}`, `Created version ${made} of ${dst} from ${props.name} version ${props.version}.`);
  emit('done', dst, made);
}
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-p { margin: 0; }
</style>
