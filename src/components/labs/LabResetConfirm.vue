<!--
  "Are you sure?" before Reset environment.

  A reset is the one action in a lab that cannot be undone: it throws the
  environment away AND marks every task in the lab as not done again (app 11
  starts a new progress epoch -- see `reset_at` in selfstudyuserlab/utils/
  store.py). So it is asked, in words that say both halves, and the safe
  button has the focus.

  Teleported through `useTeleportTarget`, never to <body>: in a full-screen
  workbench only the full-screen element is painted, and a dialog teleported
  outside it opens invisibly.
-->
<template>
  <Teleport :to="teleportTo">
    <div v-if="open" class="slr-overlay" role="presentation" @mousedown.self="$emit('cancel')">
      <div class="slr-dialog" role="alertdialog" aria-modal="true"
           aria-labelledby="slr-title" aria-describedby="slr-body"
           @keydown.esc.stop.prevent="$emit('cancel')" @keydown.tab="trap">
        <h2 id="slr-title" class="slr-title">
          <RotateCcw class="slr-i" aria-hidden="true" /> {{ $t('Reset this lab?') }}
        </h2>
        <div id="slr-body" class="slr-body">
          <p>{{ $t('Are you sure? Resetting restarts the lab environment from the beginning, so everything you created in it is removed.') }}</p>
          <p v-if="!graded">{{ $t('A playground keeps no tasks, so only the environment is reset.') }}</p>
          <p v-else-if="done > 0"><strong>{{ $t('All {v0} completed task(s) will be marked as not done, and the points you earned in this lab are cleared.', { v0: done }) }}</strong></p>
          <p v-else-if="graded">{{ $t('Every task in this lab will be marked as not done.') }}</p>
          <p class="slr-note">{{ $t('This cannot be undone.') }}</p>
        </div>
        <div class="slr-actions">
          <button ref="cancelBtn" type="button" class="slr-btn" @click="$emit('cancel')">{{ $t('Cancel') }}</button>
          <button type="button" class="slr-btn slr-btn--danger" :disabled="busy" @click="$emit('confirm')">
            {{ busy ? $t('Resetting…') : $t('Yes, reset the lab') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { RotateCcw } from 'lucide-vue-next';
import { useTeleportTarget } from '@/composables/useFullscreen';

const props = withDefaults(defineProps<{ open: boolean; done: number; busy?: boolean; graded?: boolean }>(), { busy: false, graded: true });
defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>();

const teleportTo = useTeleportTarget();
const cancelBtn = ref<HTMLButtonElement | null>(null);

watch(() => props.open, value => { if (value) nextTick(() => cancelBtn.value?.focus()); });

function trap(event: KeyboardEvent) {
  const root = (event.currentTarget as HTMLElement);
  const items = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled])'));
  const first = items[0];
  const last = items[items.length - 1] || first;
  if (!first) return;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
</script>

<style scoped>
.slr-overlay {
  position: fixed; inset: 0; z-index: 2147483100;
  display: flex; align-items: center; justify-content: center; padding: 1rem;
  background: var(--sfs-overlay, rgba(8, 10, 24, 0.62));
}
.slr-dialog {
  width: min(30rem, 100%);
  background: var(--sfs-surface, #161a2e); color: var(--sfs-text, #e5e7eb);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  border-radius: 0.9rem; padding: 1.2rem 1.25rem;
  box-shadow: 0 1.5rem 3rem rgb(0 0 0 / 0.35);
}
.slr-title { display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.6rem; font-size: 1.15rem; }
.slr-i { width: 1.1em; height: 1.1em; }
.slr-body p { margin: 0 0 0.55rem; line-height: 1.55; }
.slr-note { color: var(--sfs-text-muted, #9ca3af); font-size: 0.9rem; }
.slr-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.6rem; margin-top: 0.9rem; }
.slr-btn {
  min-height: max(2.5rem, 40px); padding: 0.5rem 1rem; border-radius: 0.6rem;
  font: inherit; font-weight: 600; cursor: pointer;
  background: transparent; color: var(--sfs-text, #e5e7eb);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.22);
}
.slr-btn--danger { background: var(--sfs-danger, #dc2626); color: var(--sfs-on-danger, #fff); border-color: transparent; }
.slr-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.slr-btn:focus-visible { outline: 2px solid var(--sfs-focus, #a5b4fc); outline-offset: 2px; }
</style>
