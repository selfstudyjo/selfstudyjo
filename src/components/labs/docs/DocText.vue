<template>
  <!-- Glossary text with `backticks` drawn as code. Text nodes and <code>
       elements only - nothing reaches v-html. A command stays LTR in Arabic. -->
  <component :is="tag || 'span'"><template v-for="(part, at) in parts" :key="at"><code
    v-if="part.code" class="sdt__code" dir="ltr">{{ part.text }}</code><template v-else>{{ part.text }}</template></template></component>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ text: string; tag?: string }>();
const parts = computed(() => String(props.text || '').split(/(`[^`]+`)/g).filter(Boolean)
  .map(chunk => (chunk.length > 2 && chunk.startsWith('`') && chunk.endsWith('`')
    ? { code: true, text: chunk.slice(1, -1) } : { code: false, text: chunk })));
</script>

<style scoped>
.sdt__code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.88em;
  padding: 0.08em 0.38em; border-radius: 5px; background: rgb(var(--sfs-sink-rgb, 0 0 0) / 0.32);
  overflow-wrap: anywhere; unicode-bidi: isolate; }
</style>
