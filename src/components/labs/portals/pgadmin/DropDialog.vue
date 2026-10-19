<template>
  <div class="pg-cf-wrap" @mousedown.self="$emit('close')">
    <div class="pg-cf" role="alertdialog" aria-modal="true" :aria-label="title">
      <header class="pg-cf__head"><h2>{{ title }}</h2>
        <button type="button" class="pg-cf__x" aria-label="Close" @click="$emit('close')"><PgIcon name="close" :size="14" /></button></header>
      <div class="pg-cf__body">
        <p>{{ message }}</p>
        <p v-if="warning" class="pg-cf__warn"><PgIcon name="warn" :size="14" /> {{ warning }}</p>
        <details class="pg-cf__sql">
          <summary>SQL</summary>
          <PgCode :sql="sql" />
        </details>
        <p v-if="error" class="pg-cf__err" role="alert">{{ error }}</p>
      </div>
      <footer class="pg-cf__foot">
        <button type="button" class="pg-btn" @click="$emit('close')"><PgIcon name="close" :size="13" />No</button>
        <button ref="yes" type="button" class="pg-btn pg-btn--primary" :disabled="busy" @click="confirm"><PgIcon name="commit" :size="13" />Yes</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * pgAdmin's delete / truncate confirmation ("Delete Table?", No / Yes), with
 * the statement it will run under a disclosure, because the cascade variant is
 * the one that removes more than the object that was clicked.
 */
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import PgIcon from './PgIcon.vue';
import PgCode from './PgCode.vue';
import { PG, type DialogRequest } from './pgContext';
import { dropColumnSql, dropConstraintSql, dropSql, fqn, qi, truncateSql } from './pg';

type DropLike = Extract<DialogRequest, { kind: 'drop' } | { kind: 'truncate' }>;
const props = defineProps<{ request: DropLike }>();
const emit = defineEmits<{ (event: 'close'): void; (event: 'done', request: DropLike): void }>();
const ctx = inject(PG)!;
const busy = ref(false);
const error = ref('');
const yes = ref<HTMLButtonElement | null>(null);

const LABEL: Record<string, string> = {
  TABLE: 'table', INDEX: 'index', VIEW: 'view', 'MATERIALIZED VIEW': 'materialized view', SEQUENCE: 'sequence',
  COLUMN: 'column', CONSTRAINT: 'constraint',
};
const names = computed(() => (props.request.kind === 'drop' ? props.request.names || [props.request.name] : [props.request.table]));

const title = computed(() => {
  const r = props.request;
  if (r.kind === 'truncate') return r.mode === 'cascade' ? 'Truncate Table Cascade?' : r.mode === 'restart' ? 'Truncate Table Restart Identity?' : 'Truncate Table?';
  const word = LABEL[r.objType] || 'object';
  const cap = word.charAt(0).toUpperCase() + word.slice(1);
  if (names.value.length > 1) return r.cascade ? 'Delete (Cascade) objects?' : 'Delete objects?';
  return r.cascade ? `Delete (Cascade) ${cap}?` : `Delete ${cap}?`;
});

const message = computed(() => {
  const r = props.request;
  if (r.kind === 'truncate') {
    return r.mode === 'cascade' ? `Are you sure you want to truncate table "${r.table}" and all tables that have foreign-key references to it?`
      : r.mode === 'restart' ? `Are you sure you want to truncate table "${r.table}" and restart its identity columns?`
        : `Are you sure you want to truncate table "${r.table}"?`;
  }
  const word = LABEL[r.objType] || 'object';
  if (names.value.length > 1) {
    return r.cascade ? `Are you sure you want to delete all the selected objects (${names.value.join(', ')}) and all the objects that depend on them?`
      : `Are you sure you want to delete all the selected objects (${names.value.join(', ')})?`;
  }
  return r.cascade ? `Are you sure you want to delete ${word} "${r.name}" and all the objects that depend on it?`
    : `Are you sure you want to delete ${word} "${r.name}"?`;
});

const warning = computed(() => {
  const r = props.request;
  if (r.kind === 'truncate') return 'TRUNCATE removes every row at once and cannot be undone.';
  if (r.objType === 'TABLE') return 'Dropping a table deletes its rows, indexes, constraints and triggers.';
  return '';
});

const sql = computed(() => {
  const r = props.request;
  if (r.kind === 'truncate') return truncateSql('public', r.table, r.mode);
  if (r.objType === 'COLUMN') return names.value.map(n => dropColumnSql('public', r.table || '', n, r.cascade)).join('\n');
  if (r.objType === 'CONSTRAINT') return names.value.map(n => dropConstraintSql('public', r.table || '', n, r.cascade)).join('\n');
  if (names.value.length > 1) {
    return `DROP ${r.objType} IF EXISTS ${names.value.map(n => fqn('public', n)).join(', ')}${r.cascade ? ' CASCADE' : ''};`;
  }
  return dropSql(r.objType, 'public', r.name, r.cascade);
});

async function confirm() {
  busy.value = true;
  error.value = '';
  const r = props.request;
  const what = r.kind === 'truncate' ? `Table "${r.table}" truncated.` : names.value.length > 1
    ? `${names.value.length} objects deleted.` : `${(LABEL[r.objType] || 'Object').replace(/^\w/, c => c.toUpperCase())} "${qi(r.name)}" deleted.`;
  const result = await ctx.runSql(sql.value, { quiet: true, success: what });
  busy.value = false;
  if (result.ok) {
    emit('done', r);
    emit('close');
  } else {
    error.value = String(result.error || result.output || 'The statement failed.').trim();
  }
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => { window.addEventListener('keydown', onKey); yes.value?.focus(); });
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped src="./pg.css"></style>
<style scoped>
.pg-cf-wrap { position: absolute; inset: 0; z-index: 75; background: rgba(0, 0, 0, .32); display: flex; align-items: flex-start; justify-content: center; padding: 80px 12px 12px; }
.pg-cf { width: 460px; max-width: 100%; background: #fff; border-radius: 4px; box-shadow: 0 8px 28px rgba(0, 0, 0, .3); display: flex; flex-direction: column; max-height: calc(100% - 20px); }
.pg-cf__head { display: flex; align-items: center; height: 36px; padding: 0 6px 0 12px; background: var(--pg-primary); color: #fff; border-radius: 4px 4px 0 0; }
.pg-cf__head h2 { flex: 1; margin: 0; font-size: 14px; font-weight: 500; }
.pg-cf__x { border: 0; background: none; color: #fff; width: 28px; height: 28px; display: grid; place-items: center; cursor: pointer; border-radius: 3px; }
.pg-cf__x:hover { background: rgba(255, 255, 255, .15); }
.pg-cf__body { padding: 14px 16px; font-size: 13px; color: var(--pg-text); overflow: auto; display: flex; flex-direction: column; gap: 8px; }
.pg-cf__body p { margin: 0; overflow-wrap: anywhere; }
.pg-cf__warn { display: flex; align-items: center; gap: 6px; color: #8a4b00; }
.pg-cf__warn .pg-ico { color: #ea7b00; }
.pg-cf__sql summary { cursor: pointer; color: var(--pg-primary); font-size: 12.5px; }
.pg-cf__sql :deep(.pg-code) { margin-top: 6px; }
.pg-cf__err { color: var(--pg-error); background: var(--pg-error-light); padding: 6px 8px; border-radius: var(--pg-radius); }
.pg-cf__foot { display: flex; justify-content: flex-end; gap: 6px; padding: 8px 10px; border-top: 1px solid var(--pg-border); background: var(--pg-grey-200); border-radius: 0 0 4px 4px; }
</style>
