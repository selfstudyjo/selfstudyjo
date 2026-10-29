<template>
  <!--
    The toolbar and the confirm dialog for deleting several records at once.
    Shared by the Job Interview results, the Toastmasters results and the CV
    Builder list; the buttons take the HOST view's own classes, so each page
    keeps its look, and the layout here is scoped under `sfs-bulk-`.
  -->
  <div class="sfs-bulk" v-if="total > 0 || notice">
   <template v-if="total > 0">
    <label v-if="showSelectAll" class="sfs-bulk__all">
      <input ref="allBox" type="checkbox" :checked="allSelected" :disabled="busy"
             @change="emit('toggle-all')" />
      <span>{{ $t('Select all') }}</span>
    </label>
    <span class="sfs-bulk__count" role="status" aria-live="polite">
      <template v-if="count">{{ $t('{n} selected', { n: count }) }}</template>
    </span>
    <div class="sfs-bulk__actions">
      <button v-if="count" type="button" :class="ghostClass" :disabled="busy" @click="emit('clear')">
        {{ $t('Clear selection') }}
      </button>
      <button type="button" :class="dangerClass" :disabled="busy || !count" @click="ask('selected')">
        {{ $t('Delete selected') }}
      </button>
      <button type="button" :class="dangerClass" :disabled="busy" @click="ask('all')">
        {{ $t('Delete all') }}
      </button>
    </div>
   </template>
    <p v-if="notice" class="sfs-bulk__notice" :class="'is-' + noticeKind" role="status">{{ notice }}</p>
  </div>

  <Teleport to="body">
    <div v-if="pending" class="sfs-bulk-backdrop" @click.self="!busy && (pending = null)">
      <div class="sfs-bulk-dialog" role="alertdialog" aria-modal="true" :aria-label="title">
        <h3>{{ title }}</h3>
        <p>{{ $t('They will be permanently deleted. This cannot be undone.') }}</p>
        <div class="sfs-bulk-dialog__actions">
          <button type="button" :class="dangerClass" :disabled="busy" @click="confirm">
            {{ busy ? $t('Deleting…') : $t('Delete') }}
          </button>
          <button type="button" :class="ghostClass" :disabled="busy" @click="pending = null">
            {{ $t('Cancel') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { useI18n } from '@/i18n/runtime';

const props = withDefaults(defineProps<{
  count: number;
  total: number;
  allSelected?: boolean;
  someSelected?: boolean;
  busy?: boolean;
  showSelectAll?: boolean;
  dangerClass?: string;
  ghostClass?: string;
}>(), { allSelected: false, someSelected: false, busy: false, showSelectAll: false,
        dangerClass: '', ghostClass: '' });

const emit = defineEmits<{
  (e: 'toggle-all'): void;
  (e: 'clear'): void;
  (e: 'delete-selected'): void;
  (e: 'delete-all'): void;
}>();

const { t } = useI18n();
const pending = ref<'selected' | 'all' | null>(null);
const allBox = ref<HTMLInputElement | null>(null);

// `indeterminate` is a DOM property with no attribute, so it is set by hand.
watchEffect(() => { if (allBox.value) allBox.value.indeterminate = props.someSelected; });

const title = computed(() => pending.value === 'all'
  ? t('Delete all {n}?', { n: props.total })
  : t('Delete {n} selected?', { n: props.count }));

function ask(kind: 'selected' | 'all') { pending.value = kind; }

function confirm() {
  if (pending.value === 'all') emit('delete-all'); else emit('delete-selected');
}

const notice = ref('');
const noticeKind = ref<'ok' | 'error'>('ok');
let noticeTimer = 0;

/**
 * The host calls this once its delete has finished: it closes the dialog and
 * says what happened. A partial failure is named and stays until dismissed by
 * the next action, because "4 of 6 deleted" read as "done" is two records the
 * user believes are gone.
 */
function finish(result: { deleted: string[]; failed: string[] } | null, error?: string) {
  pending.value = null;
  window.clearTimeout(noticeTimer);
  if (!result) {
    notice.value = error || t('Nothing could be deleted. Try again.');
    noticeKind.value = 'error';
    return;
  }
  const done = result.deleted.length;
  const failed = result.failed.length;
  if (failed && !done) {
    notice.value = t('Nothing could be deleted. Try again.');
    noticeKind.value = 'error';
  } else if (failed) {
    notice.value = t('{n} deleted, {v0} could not be deleted. Try again.', { n: done, v0: failed });
    noticeKind.value = 'error';
  } else {
    notice.value = t('{n} deleted.', { n: done });
    noticeKind.value = 'ok';
    noticeTimer = window.setTimeout(() => { notice.value = ''; }, 5000);
  }
}
defineExpose({ finish });
</script>

<style scoped>
.sfs-bulk {
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.6rem 1rem;
  margin: 0 0 0.85rem; padding: 0.55rem 0.8rem; border-radius: 10px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
}
.sfs-bulk__all { display: inline-flex; align-items: center; gap: 0.45rem; cursor: pointer;
  color: var(--sfs-text, #fff); font-size: 0.88rem; }
.sfs-bulk__all input { width: 1.05rem; height: 1.05rem; accent-color: var(--sfs-accent, #667eea); }
.sfs-bulk__count { color: var(--sfs-text-muted, rgb(255 255 255 / 0.7)); font-size: 0.86rem; min-width: 0; }
.sfs-bulk__notice { flex-basis: 100%; margin: 0; font-size: 0.86rem; }
.sfs-bulk__notice.is-ok { color: var(--sfs-success-text, #86efac); }
.sfs-bulk__notice.is-error { color: var(--sfs-danger-text, #fca5a5); }
.sfs-bulk__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-inline-start: auto; }

.sfs-bulk-backdrop {
  position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 20px;
  background: var(--sfs-overlay, rgb(0 0 0 / 0.6));
}
.sfs-bulk-dialog {
  width: 100%; max-width: 420px; padding: 22px; border-radius: 14px;
  background: var(--sfs-surface-2, #131327); color: var(--sfs-text, #fff);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
}
.sfs-bulk-dialog h3 { font-size: 1.1rem; font-weight: 650; margin: 0 0 8px; }
.sfs-bulk-dialog p { color: var(--sfs-text-muted, rgb(255 255 255 / 0.7)); font-size: 0.9rem;
  line-height: 1.55; margin: 0 0 16px; }
.sfs-bulk-dialog__actions { display: flex; flex-wrap: wrap; gap: 9px; }
</style>
