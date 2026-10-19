<template>
  <section>
    <h3 class="spk-h3">Spark Jobs <span class="tip" title="A job is triggered by an action, like count() or saveAsTextFile(). Click on a job to see information about the stages of tasks inside it.">?</span></h3>
    <ul class="list-unstyled">
      <li><strong>User:</strong> {{ app.user }}</li>
      <li><strong>Started At:</strong> {{ date(app.started) }}</li>
      <li><strong>Total Uptime:</strong> {{ duration(app.durationMs) }}</li>
      <li><strong>Scheduling Mode:</strong> FIFO</li>
      <li v-if="failed.length"><strong>Failed Jobs:</strong> {{ failed.length }}</li>
      <li><strong>Completed Jobs:</strong> {{ done.length }}</li>
    </ul>

    <SparkTimeline :items="timeline" :executors="executorEvents" />

    <h4 class="spk-h4" @click="openCompleted = !openCompleted">
      <span :class="openCompleted ? 'arrow-open' : 'arrow-closed'"></span><a href="#" @click.prevent>Completed Jobs ({{ done.length }})</a>
    </h4>
    <div v-if="openCompleted" class="table-wrap">
      <table class="table table-bordered table-sm sortable">
        <thead>
          <tr>
            <th>Job Id ▾</th><th>Description</th><th>Submitted</th><th>Duration</th>
            <th>Stages: Succeeded/Total</th><th>Tasks (for all stages): Succeeded/Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="job in [...done].reverse()" :key="job.jobId">
            <td>{{ job.jobId }}</td>
            <td class="jobs__desc">
              <span class="jobs__sql" :title="job.description">{{ job.description }}</span><br />
              <a href="#" @click.prevent="$emit('navigate', { page: 'job', app: app.id, id: job.jobId })">run at ThreadPoolExecutor.java:1149</a>
            </td>
            <td class="jobs__nowrap">{{ date(job.submitted) }}</td>
            <td>{{ duration(job.durationMs) }}</td>
            <td>{{ job.stages.length }}/{{ job.stages.length }}</td>
            <td><SparkProgress :done="job.tasks" :total="job.tasks" /></td>
          </tr>
        </tbody>
      </table>
      <p v-if="!done.length" class="spk-empty">No completed jobs. This application ran no Spark SQL.</p>
    </div>

    <template v-if="failed.length">
      <h4 class="spk-h4"><span class="arrow-open"></span><a href="#" @click.prevent>Failed Jobs ({{ failed.length }})</a></h4>
      <div class="table-wrap">
        <table class="table table-bordered table-sm">
          <thead><tr><th>Job Id</th><th>Description</th><th>Submitted</th><th>Duration</th><th>Failure Reason</th></tr></thead>
          <tbody>
            <tr v-for="(job, i) in failed" :key="i">
              <td>{{ job.id }}</td><td class="jobs__fdesc">{{ job.name }}</td><td class="jobs__nowrap">{{ date(job.at) }}</td><td>{{ duration(job.ms) }}</td>
              <td class="jobs__fdesc">{{ job.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { date, duration, executorsFor, type SparkApp } from './spark';
import SparkProgress from './SparkProgress.vue';
import SparkTimeline from './SparkTimeline.vue';

const props = defineProps<{ app: SparkApp; view: Record<string, any> }>();
defineEmits<{ (event: 'navigate', route: any): void }>();

const openCompleted = ref(true);
const done = computed(() => props.app.jobs.filter(j => j.status !== 'FAILED'));
const failed = computed(() => {
  const own = props.app.jobs.filter(j => j.status === 'FAILED')
    .map(j => ({ id: j.jobId, name: j.description, at: j.submitted, ms: j.durationMs, reason: j.error || 'Job aborted' }));
  if (own.length || props.app.state !== 'FAILED') return own;
  return [{ id: props.app.jobs.length, name: props.app.name, at: props.app.started, ms: props.app.durationMs,
            reason: 'org.apache.spark.sql.AnalysisException (see the console for the full message)' }];
});
const timeline = computed(() => props.app.jobs.map(j => ({
  start: j.submitted, end: j.submitted + j.durationMs, label: `Job ${j.jobId}`, status: j.status === 'FAILED' ? 'failed' : 'succeeded',
})));
const executorEvents = computed(() => executorsFor(props.view).map((e, i) => ({ id: e.id, at: props.app.started + i * 400 })));
</script>

<style scoped>
.jobs__desc { max-width: 520px; min-width: 200px; }
.jobs__sql { display: inline-block; max-width: min(520px, 55cqw); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
.jobs__nowrap { white-space: nowrap; }
.jobs__fdesc { min-width: 200px; }
</style>
