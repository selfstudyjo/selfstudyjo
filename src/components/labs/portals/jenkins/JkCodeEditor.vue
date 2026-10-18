<template>
  <div class="jk-code" :style="{ height }">
    <div ref="gutter" class="jk-code__gutter" aria-hidden="true">
      <div v-for="n in lines" :key="n" class="jk-code__ln">{{ n }}</div>
    </div>
    <textarea ref="area" class="jk-code__area" :value="modelValue" spellcheck="false" wrap="off"
              :aria-label="label" :readonly="readonly"
              @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
              @scroll="sync" @keydown.tab.prevent="indent"></textarea>
  </div>
</template>

<script setup lang="ts">
/** The ACE-style script box: line numbers, monospace, Tab indents four spaces. */
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{ modelValue: string; label?: string; height?: string; readonly?: boolean }>(),
                           { label: 'Script', height: '22rem', readonly: false });
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>();
const area = ref<HTMLTextAreaElement | null>(null);
const gutter = ref<HTMLDivElement | null>(null);
const lines = computed(() => Math.max(1, String(props.modelValue || '').split('\n').length));

function sync() {
  if (gutter.value && area.value) gutter.value.scrollTop = area.value.scrollTop;
}

function indent() {
  const el = area.value;
  if (!el || props.readonly) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const text = el.value;
  const next = text.slice(0, start) + '    ' + text.slice(end);
  emit('update:modelValue', next);
  requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 4; });
}
</script>

<style scoped>
.jk-code { display: flex; border: 2px solid var(--jk-input-border); border-radius: var(--jk-radius); overflow: hidden; background: #fff; max-width: 60rem; }
.jk-code:focus-within { border-color: var(--jk-accent); box-shadow: 0 0 0 3px rgba(11, 102, 228, 0.15); }
.jk-code__gutter { flex: none; overflow: hidden; padding: 0.5rem 0; background: #f3f3f5; color: #9a99a0; text-align: right; font-family: var(--jk-mono); font-size: 0.8125rem; line-height: 1.5; user-select: none; }
.jk-code__ln { padding: 0 0.55rem 0 0.8rem; min-width: 1.6rem; }
.jk-code__area { flex: 1; min-width: 0; border: 0; outline: none; resize: none; padding: 0.5rem 0.75rem; font-family: var(--jk-mono); font-size: 0.8125rem; line-height: 1.5; color: var(--jk-text); background: transparent; white-space: pre; overflow: auto; tab-size: 4; }
</style>
