<template>
  <CsModal :title="title" @close="$emit('close')">
    <div v-if="warning" class="cs-alert cs-alert--warning">
      <CsIcon name="status-warning" class="cs-alert__icon" />
      <div>{{ warning }}</div>
    </div>
    <slot />
    <div v-if="word" class="cs-field cs-delete__field">
      <label class="cs-label" :for="inputId">
        To confirm{{ noun }}, type <em>{{ word }}</em> in the field.
      </label>
      <input :id="inputId" v-model="typed" class="cs-input" type="text" :placeholder="word" autocomplete="off"
             @keydown.enter="ready && allowed && !busy && $emit('confirm')" />
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="$emit('close')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="!ready || busy || !allowed" @click="$emit('confirm')">
        <span v-if="busy" class="cs-btn__spinner" />{{ action }}
      </button>
    </template>
  </CsModal>
</template>

<script setup lang="ts">
/**
 * The delete confirmation AWS uses: say what goes, and (for anything that
 * matters) make the operator type a word - the resource's name, "delete",
 * "confirm", "delete me" - before the button arms. Which word is per service,
 * as in the real console.
 */
import { computed, ref } from 'vue';
import CsIcon from './CsIcon.vue';
import CsModal from './CsModal.vue';

const props = withDefaults(defineProps<{
  title: string; word?: string; action?: string; warning?: string; busy?: boolean; allowed?: boolean;
}>(), { word: '', action: 'Delete', warning: '', busy: false, allowed: true });
defineEmits<{ (e: 'close'): void; (e: 'confirm'): void }>();

const typed = ref('');
const inputId = 'cs-del-' + Math.random().toString(36).slice(2);
const noun = computed(() => {
  const verb = props.action.toLowerCase();
  if (verb.startsWith('terminate')) return ' termination';
  if (verb.startsWith('delete') || verb === 'empty') return ' deletion';
  return '';
});
const ready = computed(() => !props.word || typed.value === props.word);
</script>

<style scoped>
.cs-delete__field { margin-top: 16px; }
</style>
