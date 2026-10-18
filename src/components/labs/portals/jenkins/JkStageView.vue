<template>
  <div class="jk-sv">
    <div v-if="!builds.length" class="jk-empty">No data available. This Pipeline has not yet run.</div>
    <div v-else class="jk-sv__scroll">
      <table class="jk-sv__table">
        <thead>
          <tr>
            <th class="jk-sv__corner"></th>
            <th v-for="(column, index) in columns" :key="column" class="jk-sv__head" :class="'tone-' + (index % 2)">
              <div class="jk-sv__stage">{{ column }}</div>
            </th>
          </tr>
          <tr class="jk-sv__avg-row">
            <td class="jk-sv__avg-label">
              <div>Average stage times:</div>
              <div class="jk-muted">(Average <u>full</u> run time: ~{{ averageRun }})</div>
            </td>
            <td v-for="column in columns" :key="column" class="jk-sv__avg">{{ average(column) }}</td>
          </tr>
        </thead>
        <tbody>
          <tr v-for="build in shown" :key="build.number">
            <td class="jk-sv__build">
              <button type="button" class="jk-sv__badge" :class="'is-' + ballOf(build.result)"
                      @click="ctx.go({ page: 'build', job: job.name, build: build.number })">#{{ build.number }}</button>
              <div class="jk-sv__when">
                <span>{{ day(build.at) }}</span>
                <span>{{ time(build.at) }}</span>
              </div>
              <span class="jk-sv__changes">No Changes</span>
            </td>
            <td v-for="column in columns" :key="column" class="jk-sv__cell"
                :class="cellClass(stageOf(build, column))"
                :title="stageOf(build, column)?.note || resultLabel(stageOf(build, column)?.status)">
              <button v-if="stageOf(build, column)" type="button" class="jk-sv__cell-btn"
                      @click="ctx.go({ page: 'build', job: job.name, build: build.number, tab: 'console' })">
                <span class="jk-sv__time">{{ cellText(stageOf(build, column)) }}</span>
                <span v-if="stageOf(build, column)?.status === 'FAILURE'" class="jk-sv__flag">failed</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useJk } from './jkContext';
import { ballOf, parseStamp, resultLabel, stageColumns, stageTime, type Build, type Job, type Stage } from './jenkinsKit';

const props = withDefaults(defineProps<{ job: Job; limit?: number }>(), { limit: 10 });
const ctx = useJk();

const builds = computed(() => props.job.builds);
const shown = computed(() => builds.value.slice(0, props.limit));
const columns = computed(() => stageColumns(shown.value));

function stageOf(build: Build, column: string): Stage | undefined {
  return (build.stages || []).find(stage => stage.name === column);
}

function average(column: string): string {
  const times = shown.value.map(build => stageOf(build, column)).filter(s => s && s.ms > 0).map(s => (s as Stage).ms);
  if (!times.length) return '';
  return stageTime(Math.round(times.reduce((a, b) => a + b, 0) / times.length));
}

const averageRun = computed(() => {
  const list = shown.value.map(build => build.duration);
  const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
  return `${Math.round(avg)}s`;
});

function cellClass(stage: Stage | undefined): string {
  if (!stage) return 'is-none';
  return { SUCCESS: 'is-success', FAILURE: 'is-failed', UNSTABLE: 'is-unstable', ABORTED: 'is-aborted', NOT_EXECUTED: 'is-skipped' }[stage.status] || 'is-none';
}

function cellText(stage: Stage | undefined): string {
  if (!stage) return '';
  if (stage.status === 'NOT_EXECUTED') return '';
  return stageTime(stage.ms) || '0ms';
}

function day(at: string): string {
  const t = parseStamp(at);
  if (!t) return '';
  const d = new Date(t);
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
}

function time(at: string): string {
  const t = parseStamp(at);
  if (!t) return '';
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
</script>

<style scoped>
.jk-sv__scroll { display: inline-block; max-width: 100%; box-sizing: border-box; overflow-x: auto; border: 1px solid var(--jk-border); border-radius: 9.6px; }
.jk-sv__table { border-collapse: collapse; font-size: 13px; }
.jk-sv__corner { min-width: 176px; }
.jk-sv__head { width: 120px; min-width: 120px; padding: 8.8px 8px; font-weight: 600; text-align: center; vertical-align: bottom; border-left: 1px solid #fff; }
.jk-sv__head.tone-0 { background: #f1f1f1; }
.jk-sv__head.tone-1 { background: #e8e8e8; }
.jk-sv__stage { word-break: break-word; line-height: 1.3; }
.jk-sv__avg-row td { padding: 7.2px 8px; border-bottom: 1px solid var(--jk-border); }
.jk-sv__avg-label { font-size: 12.48px; color: var(--jk-text); }
.jk-sv__avg { text-align: center; color: var(--jk-text); background: #fafafa; }
.jk-sv__build { position: relative; padding: 6.4px 9.6px; min-width: 176px; border-bottom: 1px solid var(--jk-border); background: #fafafa; }
.jk-sv__badge { display: inline-block; min-width: 41.6px; padding: 1.6px 7.2px; border: 0; border-radius: 4px; font: inherit; font-weight: 700; font-size: 12.48px; color: #fff; cursor: pointer; background: #8b8a90; }
.jk-sv__badge.is-blue { background: #4a9c35; }
.jk-sv__badge.is-red { background: #d24939; }
.jk-sv__badge.is-yellow { background: #e9a61d; }
.jk-sv__when { display: inline-flex; flex-direction: column; margin-left: 9.6px; vertical-align: middle; line-height: 1.2; color: var(--jk-secondary); font-size: 12px; }
.jk-sv__changes { position: absolute; right: 8px; top: 8.8px; color: var(--jk-secondary); font-size: 12px; }
.jk-sv__cell { padding: 0; text-align: center; border-left: 1px solid #fff; border-bottom: 1px solid #fff; height: 48px; }
.jk-sv__cell-btn { width: 100%; height: 100%; min-height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 0; background: transparent; font: inherit; color: inherit; cursor: pointer; }
.jk-sv__cell.is-success { background: #e2f3dc; }
.jk-sv__cell.is-success:hover { background: #cfeac5; }
.jk-sv__cell.is-failed { background: repeating-linear-gradient(-45deg, #f6d7d2, #f6d7d2 6px, #fbe6e3 6px, #fbe6e3 12px); color: #8f2316; }
.jk-sv__cell.is-unstable { background: #fbf0cc; color: #7a5a06; }
.jk-sv__cell.is-aborted { background: #e7e7e7; }
.jk-sv__cell.is-skipped { background: #f6f6f6; }
.jk-sv__cell.is-none { background: transparent; }
.jk-sv__time { font-size: 12.8px; }
.jk-sv__flag { font-size: 12px; font-weight: 700; letter-spacing: 0.02em; }
</style>
