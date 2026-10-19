<template>
  <label class="pg-switch" :title="label">
    <input type="checkbox" role="switch" :checked="modelValue" :disabled="disabled" :aria-label="label"
           @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)" />
    <span class="pg-switch__track" /><span class="pg-switch__thumb" />
  </label>
</template>

<script setup lang="ts">
/** The switch pgAdmin uses for every boolean field ("Not NULL?", "Unique?", "Concurrent build?"). */
defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>();
defineEmits<{ (event: 'update:modelValue', value: boolean): void }>();
</script>

<style scoped src="./pg.css"></style>
