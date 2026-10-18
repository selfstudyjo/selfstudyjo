<template>
  <div class="az-pane-scrim" @click="$emit('close')"></div>
  <section class="az-pane" role="dialog" :aria-label="title">
    <div class="az-pane__head">
      <div style="flex: 1; min-width: 0">
        <h2>{{ title }}</h2>
        <div v-if="subtitle" class="az-pane__sub">{{ subtitle }}</div>
      </div>
      <button type="button" class="az-x" aria-label="Close" @click="$emit('close')"><AzIcon name="close" /></button>
    </div>
    <div class="az-pane__body">
      <div v-if="error" class="az-banner is-error"><AzIcon name="error" /><span>{{ error }}</span></div>
      <slot />
    </div>
    <div class="az-pane__foot">
      <slot name="foot" />
    </div>
  </section>
</template>

<script setup lang="ts">
/** A context pane: the portal's right-hand blade for "Edit tags", "Add rule"... */
import AzIcon from './AzIcon';

defineProps<{ title: string; subtitle?: string; error?: string }>();
defineEmits<{ (event: 'close'): void }>();
</script>
