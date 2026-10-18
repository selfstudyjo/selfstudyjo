<template>
  <section v-if="job">
    <h3 class="spk-h3">Details for Job {{ job.jobId }}</h3>
    <ul class="list-unstyled">
      <li><strong>Status:</strong> {{ job.status }}</li>
      <li><strong>Submitted:</strong> {{ date(job.submitted) }}</li>
      <li><strong>Duration:</strong> {{ duration(job.durationMs) }}</li>
      <li><strong>Associated SQL Query:</strong>{{ ' ' }}
        <a href="#" @click.prevent="$emit('navigate', { page: 'query', app: app.id, id: job.jobId })">{{ job.jobId }}</a></li>
      <li><strong>Job Group:</strong> {{ app.id.slice(-4) }}-{{ job.jobId }}</li>
      <li><strong>Completed Stages:</strong> {{ job.stages.length }}</li>
    </ul>
    <SparkTimeline :items="timeline" item-label="Stages" />
    <SparkDag :stages="job.stages" />
    <h4 class="spk-h4"><span class="arrow-open"></span><a href="#" @click.prevent>Completed Stages ({{ job.stages.length }})</a></h4>
    <SparkStageTable :stages="job.stages" @open="id => $emit('navigate', { page: 'stage', app: app.id, id })" />
  </section>
  <p v-else>No information to display for job {{ jobId }}</p>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { date, duration, type SparkApp } from './spark';
import SparkDag from './SparkDag.vue';
import SparkStageTable from './SparkStageTable.vue';
import SparkTimeline from './SparkTimeline.vue';

const props = defineProps<{ app: SparkApp; jobId: number }>();
defineEmits<{ (event: 'navigate', route: any): void }>();

const job = computed(() => props.app.jobs.find(j => j.jobId === props.jobId));
const timeline = computed(() => (job.value?.stages || []).map(s => ({
  start: s.submitted, end: s.submitted + s.durationMs, label: `Stage ${s.stageId}: ${s.name}`, status: 'succeeded',
})));
</script>
