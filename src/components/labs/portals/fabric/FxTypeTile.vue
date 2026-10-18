<template>
  <!-- One item type, as the Create hub and a workload page draw it: the coloured
       item icon in a soft square, the name, a two-line description. A type this
       lab does not model is shown (the real hub lists it) and is not clickable. -->
  <button type="button" class="tt" :class="{ 'is-off': !info.available || blocked }"
          :disabled="!info.available || blocked" :title="title" @click="$emit('pick', type)">
    <span class="tt-icon"><FxIcon :name="type" :size="28" /></span>
    <span class="tt-text">
      <span class="tt-name">{{ info.label }}</span>
      <span class="tt-desc">{{ info.description }}</span>
      <span v-if="!info.available" class="tt-note">Not available in this lab</span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FxIcon from './FxIcon.vue';
import { typeInfo } from './fabric';

const props = defineProps<{ type: string; blocked?: boolean }>();
defineEmits<{ (event: 'pick', type: string): void }>();
const info = computed(() => typeInfo(props.type));
const title = computed(() => (info.value.available
  ? `Create a ${info.value.label.toLowerCase()}`
  : `${info.value.label} isn't part of this lab environment`));
</script>

<style scoped>
.tt {
  display: flex; align-items: flex-start; gap: 12px; width: 100%; min-width: 0; height: 100%;
  padding: 12px 14px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff;
  color: #242424; font: 14px/20px "Segoe UI", "Segoe UI Web (West European)", -apple-system, sans-serif;
  text-align: left; cursor: pointer; transition: box-shadow .12s, border-color .12s;
}
.tt:hover:not(:disabled) {
  border-color: transparent;
  box-shadow: 0 0 2px rgba(0, 0, 0, .12), 0 4px 8px rgba(0, 0, 0, .14);
}
.tt:focus-visible { outline: 2px solid #117865; outline-offset: 1px; }
.tt-icon {
  display: inline-grid; place-items: center; width: 40px; height: 40px; flex: none;
  border-radius: 8px; background: #f5f5f5;
}
.tt-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.tt-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tt-desc {
  color: #616161; font-size: 12px; line-height: 16px;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden;
}
.tt-note {
  align-self: flex-start; margin-top: 6px; padding: 0 6px; border-radius: 4px; background: #ebebeb;
  color: #616161; font-size: 12px; line-height: 18px; white-space: nowrap;
}
.tt.is-off { cursor: default; background: #fafafa; }
.tt.is-off .tt-icon { filter: grayscale(.85); opacity: .7; background: #f0f0f0; }
.tt.is-off .tt-name { color: #616161; }
</style>
