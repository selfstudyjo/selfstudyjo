<template>
  <div class="az-tags">
    <p class="az-intro">Tags are name/value pairs that enable you to categorize resources and view consolidated
      billing by applying the same tag to multiple resources and resource groups.</p>
    <div class="az-tags__head"><span>Name</span><span></span><span>Value</span><span></span></div>
    <div v-for="(row, i) in items" :key="i" class="az-tags__row">
      <input v-model="row.key" class="az-input" aria-label="Tag name" :class="{ 'is-bad': badKey(row.key) }"
             @input="sync" />
      <span class="az-tags__colon">:</span>
      <input v-model="row.value" class="az-input" aria-label="Tag value" @input="sync" />
      <button type="button" class="az-x" :disabled="!row.key && !row.value" aria-label="Delete tag" @click="drop(i)">
        <AzIcon name="trash" />
      </button>
    </div>
    <div v-if="problem" class="az-err"><AzIcon name="error" :size="12" /> {{ problem }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * The portal's tag grid: a name : value row per tag and always one empty row
 * at the bottom to type the next one into. Emits a plain record.
 */
import { computed, ref, watch } from 'vue';
import AzIcon from './AzIcon';

const props = defineProps<{ modelValue: Record<string, string> }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: Record<string, string>): void }>();

const items = ref<{ key: string; value: string }[]>([]);
function load(source: Record<string, string>) {
  items.value = [...Object.entries(source || {}).map(([key, value]) => ({ key, value: String(value) })),
    { key: '', value: '' }];
}
load(props.modelValue);
watch(() => props.modelValue, value => {
  const current = JSON.stringify(collect());
  if (JSON.stringify(value || {}) !== current) load(value);
});

function collect(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of items.value) if (row.key.trim()) out[row.key.trim()] = row.value;
  return out;
}
function sync() {
  const last = items.value[items.value.length - 1];
  if (last && (last.key || last.value)) items.value.push({ key: '', value: '' });
  emit('update:modelValue', collect());
}
function drop(index: number) {
  items.value.splice(index, 1);
  if (!items.value.length || items.value[items.value.length - 1].key) items.value.push({ key: '', value: '' });
  emit('update:modelValue', collect());
}
function badKey(key: string) { return /[<>%&\\?/]/.test(key) || key.length > 512; }
const problem = computed(() => {
  const bad = items.value.find(row => badKey(row.key));
  if (bad) return 'The tag name cannot contain these characters: <, >, %, &, \\, ?, /';
  const names = items.value.map(row => row.key.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) return 'Tag names must be unique (they are not case sensitive).';
  return '';
});
defineExpose({ problem });
</script>

<style scoped>
.az-tags__head, .az-tags__row { display: grid; grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr) 32px; gap: 6px;
  align-items: center; margin-bottom: 6px; }
.az-tags__head { font-weight: 600; }
.az-tags__colon { text-align: center; }
</style>
