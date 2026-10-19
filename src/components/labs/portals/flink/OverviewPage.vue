<template>
  <div class="fk-page">
    <!-- ===== The two statistic cards the Flink overview opens with ===== -->
    <div class="fk-stats">
      <section class="fk-card fk-stat">
        <div class="fk-stat__label">Available Task Slots</div>
        <div class="fk-stat__value">{{ fk.cluster.value.slots_free }}</div>
        <div class="fk-stat__foot">
          <span>Total Task Slots <strong>{{ fk.cluster.value.slots_total }}</strong></span>
          <span>Task Managers <strong>{{ fk.cluster.value.taskmanagers }}</strong></span>
        </div>
      </section>
      <section class="fk-card fk-stat">
        <div class="fk-stat__label">Running Jobs</div>
        <div class="fk-stat__value">{{ running.length }}</div>
        <div class="fk-stat__foot">
          <span><i class="fk-dot" :style="{ background: stateColor('FINISHED') }"></i>Finished <strong>{{ count('FINISHED') }}</strong></span>
          <span><i class="fk-dot" :style="{ background: stateColor('CANCELED') }"></i>Canceled <strong>{{ count('CANCELED') }}</strong></span>
          <span><i class="fk-dot" :style="{ background: stateColor('FAILED') }"></i>Failed <strong>{{ count('FAILED') }}</strong></span>
        </div>
      </section>
    </div>

    <JobTable title="Running Job List" :jobs="running" empty-text="No running jobs. Submit Flink SQL from Submit New Job." />
    <JobTable title="Completed Job List" :jobs="completed" empty-text="No completed jobs." />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import JobTable from './JobTable.vue';
import { useFk } from './fkContext';
import { isRunning, stateColor } from './flink';

const fk = useFk();
const running = computed(() => fk.jobs.value.filter(isRunning));
const completed = computed(() => fk.jobs.value.filter(job => !isRunning(job)));
const count = (state: string) => fk.jobs.value.filter(job => job.state === state).length;
</script>

<style scoped src="./fk.css"></style>
<style scoped>
.fk-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.fk-stat { padding: 20px 24px 0; }
.fk-stat__label { font-size: 14px; color: var(--fk-text-3); }
.fk-stat__value { font-size: 30px; line-height: 38px; color: var(--fk-heading); margin: 4px 0 12px; font-variant-numeric: tabular-nums; }
.fk-stat__foot {
  display: flex; flex-wrap: wrap; gap: 8px 24px; border-top: 1px solid var(--fk-border-split); padding: 10px 0 12px; font-size: 14px; color: var(--fk-text-2);
}
.fk-stat__foot strong { color: var(--fk-heading); font-weight: 500; margin-left: 6px; }
.fk-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }
@container sl-portal (max-width: 760px) {
  .fk-stats { grid-template-columns: minmax(0, 1fr); }
}
</style>
