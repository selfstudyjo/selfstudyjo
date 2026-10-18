<template>
  <div class="te">
    <p v-if="!modelValue.length" class="te__none">No tags associated with the resource.</p>
    <div v-for="(tag, index) in modelValue" :key="index" class="te__row">
      <div class="cs-field te__cell">
        <label v-if="index === 0" class="cs-label" :for="`te-k-${uid}-${index}`">Key</label>
        <input :id="`te-k-${uid}-${index}`" class="cs-input" :class="{ 'is-invalid': problem(tag) }"
               :value="tag.key" placeholder="Enter key" @input="set(index, 'key', ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="cs-field te__cell">
        <label v-if="index === 0" class="cs-label" :for="`te-v-${uid}-${index}`">Value <small>- optional</small></label>
        <input :id="`te-v-${uid}-${index}`" class="cs-input" :class="{ 'is-invalid': problem(tag) }"
               :value="tag.value" placeholder="Enter value" @input="set(index, 'value', ($event.target as HTMLInputElement).value)" />
      </div>
      <button type="button" class="cs-btn te__remove" :class="{ 'te__remove--first': index === 0 }" @click="remove(index)">Remove</button>
      <div v-if="problem(tag)" class="cs-error-text te__err">{{ problem(tag) }}</div>
    </div>
    <button type="button" class="cs-btn" :disabled="modelValue.length >= 50" @click="add">Add new tag</button>
    <div class="cs-constraint te__limit">You can add up to {{ 50 - modelValue.length }} more tags.</div>
  </div>
</template>

<script setup lang="ts">
import { tagProblem, type TagPair } from './commands';

export type Tag = TagPair;

const props = defineProps<{ modelValue: Tag[] }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: Tag[]): void }>();
const uid = Math.random().toString(36).slice(2, 7);

function set(index: number, field: 'key' | 'value', value: string) {
  emit('update:modelValue', props.modelValue.map((tag, i) => (i === index ? { ...tag, [field]: value } : tag)));
}
function add() {
  emit('update:modelValue', [...props.modelValue, { key: '', value: '' }]);
}
function remove(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index));
}
function problem(tag: Tag) {
  return tagProblem(tag);
}
</script>

<style scoped>
.te { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.te__none { margin: 0; color: #656871; }
.te__row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 4px 16px; width: 100%; max-width: 820px; align-items: end; }
.te__cell { max-width: none; }
.te__err { grid-column: 1 / -1; }
.te__limit { margin-top: -4px; }
@container sl-portal (max-width: 560px) {
  .te__row { grid-template-columns: minmax(0, 1fr); }
}
</style>
