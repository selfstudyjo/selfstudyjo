<template>
  <span class="tf-badge" :class="'tf-badge--' + meta.tone">
    <TfIcon :name="meta.icon" :size="14" />
    {{ meta.label }}
  </span>
</template>

<script setup lang="ts">
/** A run status, as the Workspaces list and every run row draw it. */
import { computed } from 'vue';
import TfIcon from './TfIcon.vue';
import { statusMeta } from './tfKit';

const props = defineProps<{ status?: string | null }>();
const meta = computed(() => statusMeta(props.status));
</script>

<style scoped src="./tfBase.css"></style>
