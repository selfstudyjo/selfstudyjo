<template>
  <section class="az-ess">
    <div class="az-ess__head">
      <button type="button" class="az-link az-ess__toggle" :aria-expanded="open" @click="open = !open">
        <AzIcon :name="open ? 'chevrondown' : 'chevron'" :size="12" /> <b>Essentials</b>
      </button>
      <span class="az-ess__links">
        <button v-if="json" type="button" class="az-link" @click="$emit('json')">JSON View</button>
      </span>
    </div>
    <template v-if="open">
      <div class="az-ess__grid">
        <div v-for="item in items" :key="item.label" class="az-ess__row">
          <span class="az-ess__k">{{ item.label }}<button v-if="item.change" type="button" class="az-link az-ess__chg"
                @click="item.change()"> ({{ item.changeLabel || 'move' }})</button></span>
          <span class="az-ess__v">
            <button v-if="item.link" type="button" class="az-link" @click="item.link()">{{ item.value || '—' }}</button>
            <span v-else :class="{ 'az-mono': item.mono }">{{ item.value === '' || item.value === undefined || item.value === null ? '—' : item.value }}</span>
          </span>
        </div>
      </div>
      <div class="az-ess__tags">
        <span class="az-ess__k">Tags (<button type="button" class="az-link" @click="$emit('edit-tags')">edit</button>)</span>
        <span>:</span>
        <template v-if="Object.keys(tags || {}).length">
          <span v-for="(value, key) in tags" :key="key" class="az-tagchip">{{ key }} : {{ value }}</span>
        </template>
        <button v-else type="button" class="az-link" @click="$emit('edit-tags')">Add tags</button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
/** The Essentials panel at the top of every Overview. */
import { ref } from 'vue';
import AzIcon from './AzIcon';

export interface EssItem {
  label: string;
  value: unknown;
  link?: () => void;
  change?: () => void;
  changeLabel?: string;
  mono?: boolean;
}
defineProps<{ items: EssItem[]; tags: Record<string, string>; json?: boolean }>();
defineEmits<{ (event: 'edit-tags'): void; (event: 'json'): void }>();
const open = ref(true);
</script>

<style scoped>
.az-ess__toggle { display: inline-flex; align-items: center; gap: 6px; color: #242424; }
.az-ess__chg { margin-left: 2px; }
</style>
