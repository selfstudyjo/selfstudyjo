<template>
  <div class="pg-code" :class="{ 'is-fill': fill }">
    <ol class="pg-code__lines" aria-hidden="true"><li v-for="n in lineCount" :key="n">{{ n }}</li></ol>
    <pre class="pg-code__text"><code><span v-for="(t, i) in tokens" :key="i" :class="t.cls ? 'tk-' + t.cls : undefined">{{ t.text }}</span></code></pre>
  </div>
</template>

<script setup lang="ts">
/** Read-only SQL as CodeMirror draws it in pgAdmin's SQL tab: gutter + colours, no markup injected. */
import { computed } from 'vue';
import { tokenize } from './pg';

const props = withDefaults(defineProps<{ sql: string; fill?: boolean }>(), { fill: false });
const tokens = computed(() => tokenize(props.sql || ''));
const lineCount = computed(() => Math.max(1, (props.sql || '').split('\n').length));
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-code {
  display: flex; min-height: 0; overflow: auto; background: var(--pg-editor-bg); border: 1px solid var(--pg-border);
  font-family: var(--pg-mono); font-size: 12.5px; line-height: 18px;
}
.pg-code.is-fill { flex: 1; border: 0; }
.pg-code__lines {
  margin: 0; padding: 6px 8px 6px 4px; list-style: none; text-align: right; color: #6e7687; background: var(--pg-gutter);
  border-right: 1px solid var(--pg-border); user-select: none; min-width: 34px; flex: none; position: sticky; left: 0;
}
.pg-code__text { margin: 0; padding: 6px 10px; color: var(--pg-text); white-space: pre; flex: 1; }
.pg-code__text code { font: inherit; }
</style>
