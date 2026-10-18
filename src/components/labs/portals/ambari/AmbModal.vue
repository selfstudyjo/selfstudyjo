<template>
  <div class="amb-modal-backdrop" role="dialog" aria-modal="true" :aria-label="title"
       @keydown.esc="$emit('close')">
    <div class="amb-modal" :class="{ 'is-wide': wide, 'is-small': small }">
      <div class="amb-modal__header">
        <h4 class="amb-modal__title">{{ title }}</h4>
        <button type="button" class="amb-modal__close" aria-label="Close" @click="$emit('close')">×</button>
      </div>
      <div class="amb-modal__body">
        <slot />
      </div>
      <div class="amb-modal__footer">
        <slot name="footer">
          <button type="button" class="btn btn-default" @click="$emit('close')">{{ cancelText }}</button>
          <button v-if="okText" type="button" class="btn" :class="danger ? 'btn-danger' : 'btn-success'"
                  :disabled="okDisabled || busy" @click="$emit('ok')">{{ okText }}</button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** A Bootstrap 3 modal as Ambari draws it: header, body, right-aligned footer. */
withDefaults(defineProps<{
  title: string;
  okText?: string;
  cancelText?: string;
  okDisabled?: boolean;
  danger?: boolean;
  wide?: boolean;
  small?: boolean;
  busy?: boolean;
}>(), { okText: 'OK', cancelText: 'Cancel' });
defineEmits<{ (event: 'close'): void; (event: 'ok'): void }>();
</script>

<style scoped>
.amb-modal-backdrop {
  position: absolute; inset: 0; z-index: 50; background: rgba(0, 0, 0, .5);
  display: flex; align-items: flex-start; justify-content: center; overflow: auto; padding: 30px 12px;
}
.amb-modal {
  width: 600px; max-width: 100%; background: #fff; border-radius: 0; border: 1px solid rgba(0, 0, 0, .2);
  box-shadow: 0 5px 15px rgba(0, 0, 0, .5); display: flex; flex-direction: column; max-height: calc(100% - 20px);
}
.amb-modal.is-wide { width: 900px; }
.amb-modal.is-small { width: 420px; }
.amb-modal__header {
  display: flex; align-items: center; padding: 15px 20px; border-bottom: 1px solid #e5e5e5; min-height: 57px;
}
.amb-modal__title { margin: 0; flex: 1; font-size: 18px; font-weight: 500; color: #333; }
.amb-modal__close {
  border: 0; background: none; font-size: 24px; line-height: 1; color: #000; opacity: .45; cursor: pointer; padding: 0; width: 32px; height: 32px;
}
.amb-modal__close:hover { opacity: .6; }
.amb-modal__body { padding: 15px 20px; overflow: auto; font-size: 14px; color: #333; min-height: 0; }
.amb-modal__footer {
  display: flex; justify-content: flex-end; gap: 8px; padding: 15px 20px; border-top: 1px solid #e5e5e5; flex-wrap: wrap;
}
.amb-modal__title { min-width: 0; overflow-wrap: anywhere; }
.amb-modal__body :deep(a) { color: #107fab; text-decoration: none; }
.amb-modal__body :deep(a:hover) { text-decoration: underline; }
@container sl-portal (max-width: 560px) {
  .amb-modal-backdrop { padding: 8px; }
  .amb-modal, .amb-modal.is-wide, .amb-modal.is-small { width: 100%; max-height: 100%; }
  .amb-modal__header { padding: 10px 14px; min-height: 48px; }
  .amb-modal__body { padding: 12px 14px; }
  .amb-modal__footer { padding: 10px 14px; }
}
</style>
