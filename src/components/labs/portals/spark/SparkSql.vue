<template>
  <section v-if="queryId === null">
    <h3 class="spk-h3">SQL / DataFrame</h3>
    <ul class="list-unstyled"><li><a href="#" @click.prevent><strong>Completed Queries:</strong></a> {{ app.jobs.length }}</li></ul>
    <h4 class="spk-h4"><span class="arrow-open"></span><a href="#" @click.prevent>Completed Queries ({{ app.jobs.length }})</a></h4>
    <div class="table-wrap">
      <table class="table table-bordered table-sm">
        <thead><tr><th>ID ▾</th><th>Description</th><th>Submitted</th><th>Duration</th><th>Job IDs</th></tr></thead>
        <tbody>
          <tr v-for="job in [...app.jobs].reverse()" :key="job.jobId">
            <td>{{ job.jobId }}</td>
            <td class="sql__desc">
              <a href="#" :title="job.description" @click.prevent="$emit('navigate', { page: 'query', app: app.id, id: job.jobId })">{{ job.description }}</a>
              <span class="expand-details">+details</span>
            </td>
            <td class="sql__nowrap">{{ date(job.submitted) }}</td>
            <td>{{ duration(job.durationMs) }}</td>
            <td><a href="#" @click.prevent="$emit('navigate', { page: 'job', app: app.id, id: job.jobId })">[{{ job.jobId }}]</a></td>
          </tr>
        </tbody>
      </table>
      <p v-if="!app.jobs.length" class="spk-empty">No SQL queries ran in this application.</p>
    </div>
  </section>

  <section v-else-if="job">
    <h3 class="spk-h3">Details for Query {{ job.jobId }}</h3>
    <ul class="list-unstyled">
      <li><strong>Submitted Time:</strong> {{ date(job.submitted) }}</li>
      <li><strong>Duration:</strong> {{ duration(job.durationMs) }}</li>
      <li><strong>Succeeded Jobs:</strong>{{ ' ' }}
        <a href="#" @click.prevent="$emit('navigate', { page: 'job', app: app.id, id: job.jobId })">{{ job.jobId }}</a></li>
    </ul>
    <pre class="sql__text">{{ job.description }}</pre>
    <div v-if="job.error" class="alert-danger">{{ job.error }}</div>
    <ul v-if="job.notes.length" class="list-unstyled sql__notes">
      <li v-for="(n, i) in job.notes" :key="i">{{ n }}</li>
    </ul>
    <div class="sql__plan">
      <template v-for="(node, i) in [...plan].reverse()" :key="i">
        <div class="sql__node">
          <strong>{{ node.split(/[ (]/)[0] }}</strong>
          <span v-if="i === 0">number of output rows: {{ scanned }}</span>
          <span v-else-if="node.startsWith('Exchange')">shuffle bytes written total: {{ bytes(shuffle) }}</span>
          <span v-else-if="i === plan.length - 1">number of output rows: {{ job.rowsReturned }}</span>
        </div>
        <span v-if="i < plan.length - 1" class="sql__edge">↓</span>
      </template>
    </div>
    <h4 class="spk-h4" @click="details = !details"><span :class="details ? 'arrow-open' : 'arrow-closed'"></span><a href="#" @click.prevent>Details</a></h4>
    <pre v-if="details" class="sql__text">== Physical Plan ==
{{ planLines(job).join('\n') }}<template v-if="job.aqe && job.initialPlan.length">

== Initial Plan ==
{{ planLines(job, true).join('\n') }}</template></pre>
  </section>
  <p v-else>No information to display for query {{ queryId }}</p>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { bytes, date, duration, planLines, planOperators, type SparkApp } from './spark';

const props = defineProps<{ app: SparkApp; queryId: number | null }>();
defineEmits<{ (event: 'navigate', route: any): void }>();

const details = ref(false);
const job = computed(() => props.app.jobs.find(j => j.jobId === props.queryId));
const plan = computed(() => (job.value ? [...planOperators(job.value)].reverse() : []));
const scanned = computed(() => job.value?.stages[0]?.inputRows ?? 0);
const shuffle = computed(() => (job.value?.stages || []).reduce((n, s) => n + s.shuffleWrite, 0));
</script>

<style scoped>
.sql__desc { max-width: min(560px, 60cqw); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sql__desc a { display: inline-block; max-width: calc(100% - 64px); overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; }
.sql__nowrap { white-space: nowrap; }
.expand-details { font-size: 12px; color: #6c757d; margin-left: 6px; }
.sql__text { background: #f7f7f7; border: 1px solid #ddd; padding: 10px; white-space: pre-wrap; }
.sql__plan { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 12px; border: 1px solid #eee; margin-bottom: 10px; }
.sql__node { background: #E5F2FF; border: 1px solid #3EC0FF; border-radius: 4px; padding: 8px 14px; min-width: min(240px, 100%); max-width: 100%; box-sizing: border-box; overflow-wrap: anywhere; text-align: center; display: flex; flex-direction: column; align-items: center; font-size: 12px; }
.sql__node strong { font-size: 13px; }
.sql__edge { color: #666; font-size: 16px; }
.sql__notes { font-size: 13px; color: #155724; }
</style>
