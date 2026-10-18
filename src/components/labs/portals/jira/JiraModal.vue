<template>
  <div class="jm-blanket" role="presentation" @mousedown.self="onBlanket">
    <section ref="dialog" class="jm" :class="['jm--' + width]" role="dialog" aria-modal="true"
             :aria-label="title" tabindex="-1" @keydown.esc.stop="$emit('close')">
      <header v-if="!bare" class="jm__head">
        <JiraIcon v-if="icon" :name="icon" :size="20" class="jm__icon" :class="'jm__icon--' + icon" />
        <h2 class="jm__title">{{ title }}</h2>
        <slot name="head-actions" />
        <button type="button" class="jm__x" aria-label="Close" @click="$emit('close')">
          <JiraIcon name="close" />
        </button>
      </header>
      <div class="jm__body"><slot /></div>
      <footer v-if="$slots.footer" class="jm__foot"><slot name="footer" /></footer>
    </section>
  </div>
</template>

<script setup lang="ts">
/** Atlassian's modal dialog: a dimmed blanket, a raised surface, a footer of actions. */
import { nextTick, onMounted, ref } from 'vue';
import JiraIcon from './JiraIcon.vue';

const props = withDefaults(defineProps<{ title: string; width?: 'small' | 'medium' | 'large' | 'x-large';
                                          icon?: string; bare?: boolean; dismissable?: boolean }>(),
                           { width: 'medium', icon: '', bare: false, dismissable: false });
const emit = defineEmits<{ (event: 'close'): void }>();
const dialog = ref<HTMLElement | null>(null);

function onBlanket() {
  // Atlassian modals close on a blanket click only where nothing typed can be lost.
  if (props.dismissable) emit('close');
}

onMounted(() => nextTick(() => {
  const first = dialog.value?.querySelector<HTMLElement>('[autofocus], input, textarea, select');
  (first || dialog.value)?.focus();
}));
</script>

<style scoped>
.jm-blanket {
  position: absolute; inset: 0; z-index: 50; display: flex; align-items: flex-start;
  justify-content: center; padding: 60px 16px 16px; background: rgba(5, 21, 36, 0.48);
  overflow: auto;
}
.jm {
  width: 100%; max-height: calc(100% - 16px); display: flex; flex-direction: column;
  background: var(--j-surface); color: var(--j-text); border-radius: 3px;
  box-shadow: 0 8px 12px rgba(30, 31, 33, 0.15), 0 0 1px rgba(30, 31, 33, 0.31);
  outline: none;
}
.jm--small { max-width: 400px; }
.jm--medium { max-width: 600px; }
.jm--large { max-width: 800px; }
.jm--x-large { max-width: 1120px; }
.jm__head { display: flex; align-items: center; gap: 8px; padding: 24px 24px 2px; }
.jm__title { flex: 1; margin: 0; font-size: 20px; line-height: 24px; font-weight: 653; }
.jm__icon--warning { color: #E06C00; }
.jm__icon--error { color: #C9372C; }
.jm__x {
  display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 3px;
  background: transparent; color: var(--j-text-subtle); cursor: pointer;
}
.jm__x:hover { background: var(--j-neutral-hover); }
.jm__body { padding: 16px 24px; overflow: auto; min-height: 0; }
.jm__foot { display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 16px 24px 24px; }
@container sl-portal (max-width: 520px) {
  .jm-blanket { padding: 8px; }
  .jm__head { padding: 16px 16px 2px; }
  .jm__body { padding: 12px 16px; }
  .jm__foot { padding: 12px 16px 16px; flex-wrap: wrap; }
}
</style>
