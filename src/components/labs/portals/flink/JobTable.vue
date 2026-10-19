<template>
  <section class="fk-card">
    <header class="fk-card__head">
      <span class="fk-card__title">{{ title }}</span>
      <span class="fk-card__extra">
        <input v-if="filterable" v-model="filter" class="fk-input fk-filter" type="search" placeholder="Filter by job name or ID"
               aria-label="Filter jobs" />
      </span>
    </header>
    <div class="fk-table-wrap">
      <table class="fk-table">
        <thead>
          <tr>
            <th>Job Name</th>
            <th>Start Time</th>
            <th>Duration</th>
            <th>End Time</th>
            <th>Tasks</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="job in shown" :key="job.jid" class="is-link" tabindex="0"
              @click="open(job.jid)" @keydown.enter="open(job.jid)">
            <td class="wrap">
              <span class="fk-jobname">{{ job.name }}</span>
              <span class="fk-jid fk-mono">{{ job.jid }}</span>
            </td>
            <td class="nowrap">{{ fmtTime(job.start) }}</td>
            <td class="nowrap">{{ duration(job) }}</td>
            <td class="nowrap">{{ fmtTime(jobEndMs(job)) }}</td>
            <td>
              <span class="fk-tasks">
                <span class="fk-taskbox" :style="{ background: stateColor(taskState(job)) }"
                      :title="job.vertices.length + ' ' + taskState(job)">{{ job.vertices.length || 0 }}</span>
              </span>
            </td>
            <td><span class="fk-tag" :style="{ background: stateColor(job.state) }">{{ job.state }}</span></td>
          </tr>
          <tr v-if="!shown.length">
            <td colspan="6" class="fk-empty">
              <FkIcon name="inbox" class="fk-empty__ico" />
              {{ filter ? 'No job matches the filter.' : emptyText }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { matches } from '@/utils/portalKit';
import FkIcon from './FkIcon.vue';
import { useFk } from './fkContext';
import { fmtDuration, fmtTime, jobDurationMs, jobEndMs, stateColor, type FkJob } from './flink';

const props = withDefaults(defineProps<{ title: string; jobs: FkJob[]; emptyText?: string; filterable?: boolean }>(),
  { emptyText: 'No Data', filterable: false });

const fk = useFk();
const filter = ref('');

const shown = computed(() => props.jobs
  .filter(job => matches(job as Record<string, any>, filter.value, ['name', 'jid']))
  .map((job, index) => ({ job, index }))
  .sort((a, b) => ((b.job.startMs ?? 0) - (a.job.startMs ?? 0)) || b.index - a.index)
  .map(entry => entry.job));

function duration(job: FkJob) {
  return fmtDuration(jobDurationMs(job));
}

/** The Tasks column shows each task's state; a task follows its job in this simulation. */
function taskState(job: FkJob) {
  return job.state === 'CANCELLING' ? 'CANCELING' : String(job.state);
}

function open(jid: string) {
  fk.go({ page: 'job', jid, tab: 'overview' });
}
</script>

<style scoped src="./fk.css"></style>
<style scoped>
.fk-jobname { display: block; color: var(--fk-heading); }
.fk-jid { display: block; color: var(--fk-text-3); margin-top: 2px; }
.fk-tasks { display: inline-flex; gap: 4px; }
.fk-taskbox { display: inline-block; min-width: 22px; height: 20px; padding: 0 5px; border-radius: 2px; color: #fff; font-size: 12px; line-height: 20px; text-align: center; }
.fk-filter { width: 240px; max-width: 100%; }
@container sl-portal (max-width: 700px) {
  .fk-filter { width: 150px; }
}
</style>
