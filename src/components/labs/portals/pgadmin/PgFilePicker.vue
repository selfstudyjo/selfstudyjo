<template>
  <div class="pg-fp">
    <div class="pg-fp__row">
      <input :id="id" class="pg-input pg-fp__input" :class="{ 'pg-input--err': invalid }" :value="modelValue" :placeholder="placeholder"
             autocomplete="off" spellcheck="false" :aria-label="label" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
      <button type="button" class="pg-btn pg-btn--icon" :title="'Select file'" aria-label="Select file" :aria-expanded="open" @click="open = !open">
        <PgIcon name="folder-open" :size="15" /></button>
    </div>
    <div v-if="open" class="pg-fp__pop" role="dialog" aria-label="Select file">
      <header class="pg-fp__head"><PgIcon name="folder-open" :size="14" /><strong>Storage Manager</strong>
        <span class="pg-muted">/ (lab workspace)</span>
        <button type="button" class="pg-btn pg-btn--icon pg-btn--sm pg-fp__x" aria-label="Close" @click="open = false"><PgIcon name="close" :size="11" /></button></header>
      <table class="pg-table pg-fp__table">
        <thead><tr><th>Name</th><th class="is-num">Size</th></tr></thead>
        <tbody>
          <tr v-if="!shown.length"><td colspan="2" class="pg-muted">No {{ kindLabel }} files in the workspace yet.</td></tr>
          <tr v-for="f in shown" :key="f.path" class="pg-fp__item" :class="{ 'is-sel': f.path === modelValue }"
              tabindex="0" @click="pick(f.path)" @keydown.enter="pick(f.path)">
            <td><PgIcon :name="f.archive ? 'backup' : 'sql'" :size="13" /> {{ f.path }}</td><td class="is-num">{{ fmtBytes(f.bytes) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="pg-fp__hint pg-muted">Files are read from and written to the lab workspace - the Files tab and the console see the same files.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/** pgAdmin's file field: a path, and a Storage Manager pop-up listing the workspace's data files. */
import { computed, inject, ref } from 'vue';
import PgIcon from './PgIcon.vue';
import { PG } from './pgContext';
import { fmtBytes } from './pg';

const props = withDefaults(defineProps<{ modelValue: string; id?: string; label?: string; placeholder?: string;
  filter?: 'any' | 'data' | 'dump'; invalid?: boolean }>(), { id: '', label: 'Filename', placeholder: '', filter: 'any', invalid: false });
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>();
const ctx = inject(PG)!;
const open = ref(false);
const kindLabel = computed(() => (props.filter === 'dump' ? 'backup' : props.filter === 'data' ? 'data' : ''));
const shown = computed(() => ctx.model.value.files.filter(f => {
  if (props.filter === 'data') return /\.(csv|tsv|txt|dat)$/i.test(f.path);
  if (props.filter === 'dump') return f.archive || /\.(sql|dump|backup|tar)$/i.test(f.path);
  return true;
}));
function pick(path: string) {
  emit('update:modelValue', path);
  open.value = false;
}
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-fp { position: relative; min-width: 0; }
.pg-fp__row { display: flex; gap: 4px; }
.pg-fp__input { flex: 1; }
.pg-fp__pop { position: absolute; z-index: 5; left: 0; right: 0; top: calc(100% + 4px); background: #fff; border: 1px solid var(--pg-border);
  border-radius: var(--pg-radius); box-shadow: 0 6px 18px rgba(0, 0, 0, .2); max-height: 260px; overflow: auto; }
.pg-fp__head { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: var(--pg-grey-200); border-bottom: 1px solid var(--pg-border); font-size: 12.5px; }
.pg-fp__x { margin-left: auto; }
.pg-fp__table td { cursor: pointer; font-size: 12.5px; }
.pg-fp__item.is-sel td { background: var(--pg-tree-selected); }
.pg-fp__hint { margin: 0; padding: 6px 8px; font-size: 11.5px; }
</style>
