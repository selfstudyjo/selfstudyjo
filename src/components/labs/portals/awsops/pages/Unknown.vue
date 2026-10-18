<template>
  <div class="cs-alert cs-alert--info">
    <CsIcon name="status-info" class="cs-alert__icon" />
    <div><strong>This page is not modelled in this lab</strong>The simulated console covers the pages the Cloud Operations labs use.
      <button type="button" class="cs-link" @click="ctx.to('home', 'home')">Console Home</button></div>
  </div>
</template>

<script setup lang="ts">
import CsIcon from '../../aws/CsIcon.vue';
import { useOps } from '../ctx';

const ctx = useOps();
</script>
