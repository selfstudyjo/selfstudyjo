<template>
  <pre class="cc-json"><span v-for="(t, i) in tokens" :key="i" :class="'cc-json--' + t.kind">{{ t.text }}</span></pre>
</template>

<script setup lang="ts">
/** The JSON viewer Control Center uses for message values and schemas. Text spans only. */
import { computed } from 'vue';
import { jsonTokens } from './confluent';

const props = defineProps<{ text: string }>();
const tokens = computed(() => jsonTokens(props.text || ''));
</script>

<style scoped>
.cc-json {
  margin: 0; padding: 12px; background: var(--cc-code-bg); border: 1px solid var(--cc-border); border-radius: 4px;
  font-family: var(--cc-mono); font-size: 12px; line-height: 18px; white-space: pre-wrap; overflow-wrap: anywhere;
  color: var(--cc-text); max-height: 420px; overflow: auto;
}
.cc-json--key { color: #7a3e9d; }
.cc-json--string { color: #1d6b38; }
.cc-json--number { color: #a1430f; }
.cc-json--bool, .cc-json--null { color: #0b5cad; font-weight: 600; }
.cc-json--punct { color: #4a5563; }
</style>
