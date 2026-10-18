<template>
  <div class="cs-alert cs-alert--error">
    <CsIcon name="status-negative" class="cs-alert__icon" />
    <div><strong>{{ what }} not found</strong>The {{ what.toLowerCase() }} '{{ id }}' does not exist or was deleted.
      <button v-if="back" type="button" class="cs-link" @click="ctx.to(ctx.route.value.svc, back)">Return to the list</button></div>
  </div>
</template>

<script setup lang="ts">
import CsIcon from '../../aws/CsIcon.vue';
import { useOps } from '../ctx';

defineProps<{ what: string; id: string; back?: string }>();
const ctx = useOps();
</script>
