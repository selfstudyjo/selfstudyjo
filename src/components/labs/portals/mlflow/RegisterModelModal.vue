<template>
  <MfModal title="Register Model" ok-text="Register" :ok-disabled="!canSubmit" :busy="saving" @close="$emit('close')" @ok="submit">
    <p class="mf-p mf-muted">Registering this run's model (<code class="mf-mono">runs:/{{ runId.slice(0, 8) }}…/model</code>)
      creates a new version of a registered model.</p>
    <label class="mf-field">
      <span class="mf-label">Model</span>
      <select v-model="choice" class="mf-select" aria-label="Model">
        <option value="__new__">+ Create New Model</option>
        <option v-for="m in mf.models.value" :key="m.name" :value="m.name">{{ m.name }}</option>
      </select>
    </label>
    <label v-if="choice === '__new__'" class="mf-field">
      <span class="mf-label">Model Name</span>
      <input v-model="name" class="mf-input" :class="{ 'mf-input--error': taken }" placeholder="Input a model name" aria-label="Model Name"
             @keydown.enter="submit" />
      <span v-if="taken" class="mf-error-text">Model "{{ name.trim() }}" already exists. Pick it from the list to add a new version.</span>
    </label>
    <p v-else class="mf-hint">The model will be registered as version {{ nextVersion }} of {{ choice }}.</p>
    <div v-if="error" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ error }}</span></div>
  </MfModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import MfModal from './MfModal.vue';
import { mlflow, useMf } from './mfContext';

const props = defineProps<{ runId: string }>();
const emit = defineEmits<{ (event: 'close'): void; (event: 'done', name: string, version: number): void }>();
const mf = useMf();
const choice = ref('__new__');
const name = ref('');
const saving = ref(false);
const error = ref('');
const taken = computed(() => choice.value === '__new__' && Boolean(mf.model(name.value.trim())));
const target = computed(() => (choice.value === '__new__' ? name.value.trim() : choice.value));
const canSubmit = computed(() => Boolean(target.value) && !taken.value);
const nextVersion = computed(() => (mf.model(choice.value)?.latest_version || 0) + 1);

async function submit() {
  if (!canSubmit.value || saving.value) return;
  saving.value = true;
  const modelName = target.value;
  const result = await mf.run(mlflow(['models', 'register'], { '--name': modelName, '--run-id': props.runId }), { quiet: true });
  saving.value = false;
  if (!result.ok) {
    error.value = String(result.error || result.output || '').trim();
    return;
  }
  const match = String(result.output || '').match(/version (\d+)/);
  const version = match ? Number(match[1]) : (mf.model(modelName)?.latest_version || 1);
  mf.notify('success', `Successfully registered model '${modelName}'`, `Created version ${version}.`);
  emit('done', modelName, version);
}
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-p { margin: 0; }
</style>
