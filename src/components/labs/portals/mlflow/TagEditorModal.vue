<template>
  <MfModal :title="title" ok-text="Save tags" :ok-disabled="!dirty" :busy="busy" :width="560" @close="$emit('close')" @ok="save">
    <form class="mf-tagform" @submit.prevent="add">
      <label class="mf-field">
        <span class="mf-label">Key</span>
        <input v-model="key" class="mf-input" list="mf-tag-keys" placeholder="Type a key" aria-label="Key" />
        <datalist id="mf-tag-keys"><option v-for="k in Object.keys(draft)" :key="k" :value="k" /></datalist>
      </label>
      <label class="mf-field">
        <span class="mf-label">Value</span>
        <input v-model="value" class="mf-input" placeholder="Type a value" aria-label="Value" />
      </label>
      <button type="submit" class="mf-btn mf-tagform__add" :disabled="!key.trim()">
        {{ key.trim() in draft ? 'Update tag' : 'Add tag' }}
      </button>
    </form>
    <p v-if="keyError" class="mf-error-text">{{ keyError }}</p>
    <div class="mf-tags mf-tagform__list">
      <span v-for="(v, k) in draft" :key="k" class="mf-tag" :title="k + ': ' + v">
        <b>{{ k }}</b><template v-if="v">: {{ v }}</template>
        <button type="button" :aria-label="'Remove tag ' + k" @click="remove(String(k))"><MfIcon name="close" /></button>
      </span>
      <span v-if="!Object.keys(draft).length" class="mf-muted">No tags</span>
    </div>
    <div v-if="error" class="mf-alert mf-alert--error"><MfIcon name="x-circle" /><span>{{ error }}</span></div>
  </MfModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MfIcon from './MfIcon.vue';
import MfModal from './MfModal.vue';

const props = defineProps<{ title: string; tags: Record<string, string>; busy?: boolean; error?: string }>();
const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'save', changes: { set: [string, string][]; remove: string[] }): void;
}>();

const draft = ref<Record<string, string>>({ ...props.tags });
const key = ref('');
const value = ref('');
const keyError = ref('');

function add() {
  const k = key.value.trim();
  if (!k) return;
  if (k.startsWith('mlflow.')) {
    keyError.value = "Keys starting with 'mlflow.' are reserved for MLflow's system tags.";
    return;
  }
  if (k.length > 250) {
    keyError.value = 'Tag keys are limited to 250 characters.';
    return;
  }
  keyError.value = '';
  draft.value = { ...draft.value, [k]: value.value };
  key.value = '';
  value.value = '';
}
function remove(k: string) {
  const next = { ...draft.value };
  delete next[k];
  draft.value = next;
}
const changes = computed(() => {
  const set: [string, string][] = [];
  const removed: string[] = [];
  for (const [k, v] of Object.entries(draft.value)) if (props.tags[k] !== v) set.push([k, v]);
  for (const k of Object.keys(props.tags)) if (!(k in draft.value)) removed.push(k);
  return { set, remove: removed };
});
const dirty = computed(() => changes.value.set.length + changes.value.remove.length > 0 || Boolean(key.value.trim()));
function save() {
  if (key.value.trim()) add();
  if (keyError.value) return;
  emit('save', changes.value);
}
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-tagform { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; }
.mf-tagform__list { min-height: 24px; }
@container sl-portal (max-width: 520px) {
  .mf-tagform { grid-template-columns: 1fr; }
}
</style>
