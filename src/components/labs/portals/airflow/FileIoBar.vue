<template>
  <div class="af-io">
    <button type="button" class="af-btn af-btn--sm" :disabled="af.busy.value" :title="`Writes ${file || defaultFile} in the lab's Files`"
            @click="doExport"><AfIcon name="download" /> Export {{ label }}</button>
    <button type="button" class="af-btn af-btn--sm" :aria-expanded="open" @click="open = !open"><AfIcon name="upload" /> Import {{ label }}</button>
    <span class="af-help">Through <code>airflow {{ noun }} export|import &lt;file&gt;</code> - a JSON file in the lab's Files tool.</span>
    <div v-if="open" class="af-io__row">
      <label class="af-label" :for="'af-io-' + noun">File</label>
      <input :id="'af-io-' + noun" v-model="file" class="af-input af-io__path" spellcheck="false" :placeholder="defaultFile" />
      <label v-if="noun === 'connections'" class="af-check"><input v-model="overwrite" type="checkbox" /> Overwrite existing connections</label>
      <button type="button" class="af-btn af-btn--sm af-btn--primary" :disabled="!path || af.busy.value" @click="doImport">Import</button>
      <code class="af-io__line">{{ importLine }}</code>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Export / import the list as Airflow's own JSON file. A browser upload has no
 * CLI equivalent, so the file lives in the lab's Files - the same place a
 * student would `airflow connections import` it from in the console.
 */
import { computed, ref } from 'vue';
import AfIcon from './AfIcon.vue';
import { useAf } from './afContext';
import { CMD } from './airflow';

const props = defineProps<{ noun: 'connections' | 'pools'; label: string; defaultFile: string }>();
const af = useAf();
const open = ref(false);
const file = ref(props.defaultFile);
const overwrite = ref(false);
const path = computed(() => file.value.trim());

const exportLine = computed(() => (props.noun === 'connections' ? CMD.exportConnections(path.value || props.defaultFile)
  : CMD.exportPools(path.value || props.defaultFile)));
const importLine = computed(() => (props.noun === 'connections' ? CMD.importConnections(path.value, overwrite.value)
  : CMD.importPools(path.value)));

async function doExport() {
  const result = await af.run(exportLine.value, { quiet: true });
  if (result.ok) af.notify('success', String(result.output || '').trim() || `Exported to ${path.value}`, 'Open it in the Files tool.');
  else af.notify('error', `Could not export ${props.label.toLowerCase()}`, String(result.error || ''));
}

async function doImport() {
  const result = await af.run(importLine.value, { quiet: true });
  if (!result.ok) {
    af.notify('error', `Could not import ${props.label.toLowerCase()}`, String(result.error || ''));
    return;
  }
  const text = String(result.output || '').trim();
  const skipped = /Could not import/.test(text);
  af.notify(skipped ? 'warning' : 'success', skipped ? 'Some records were not imported' : `${props.label} imported`, text);
  if (!skipped) open.value = false;
}
</script>

<style scoped src="./af.css"></style>
<style scoped>
.af-io { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; margin-bottom: 10px; }
.af-io__row { flex-basis: 100%; display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; padding: 8px 10px;
  border: 1px solid var(--af-border-light); border-radius: 4px; background: #fafafa; }
.af-io__path { width: 240px; height: 30px; font-size: 13px; }
.af-io__line { flex-basis: 100%; font-size: 12px; color: #6b6b6b; overflow-wrap: anywhere; }
</style>
