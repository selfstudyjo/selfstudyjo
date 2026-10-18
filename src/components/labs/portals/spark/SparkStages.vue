<template>
  <section>
    <h3 class="spk-h3">Stages for All Jobs</h3>
    <ul class="list-unstyled">
      <li><a href="#" @click.prevent>Completed Stages:</a> {{ app.stages.length }}</li>
    </ul>
    <h4 class="spk-h4" @click="open = !open">
      <span :class="open ? 'arrow-open' : 'arrow-closed'"></span><a href="#" @click.prevent>Completed Stages ({{ app.stages.length }})</a>
    </h4>
    <SparkStageTable v-if="open" :stages="app.stages" @open="id => $emit('navigate', { page: 'stage', app: app.id, id })" />
    <p v-if="!app.stages.length" class="spk-empty">No stages have run in this application.</p>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { SparkApp } from './spark';
import SparkStageTable from './SparkStageTable.vue';

defineProps<{ app: SparkApp }>();
defineEmits<{ (event: 'navigate', route: any): void }>();
const open = ref(true);
</script>
