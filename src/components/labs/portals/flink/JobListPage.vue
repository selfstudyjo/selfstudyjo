<template>
  <div class="fk-page">
    <JobTable :title="kind === 'running' ? 'Running Jobs' : 'Completed Jobs'" :jobs="list" filterable
              :empty-text="kind === 'running' ? 'No running jobs. An INSERT INTO submitted from Submit New Job appears here.' : 'No completed jobs.'" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import JobTable from './JobTable.vue';
import { useFk } from './fkContext';
import { isRunning } from './flink';

const props = defineProps<{ kind: 'running' | 'completed' }>();
const fk = useFk();
const list = computed(() => fk.jobs.value.filter(job => (props.kind === 'running' ? isRunning(job) : !isRunning(job))));
</script>

<style scoped src="./fk.css"></style>
