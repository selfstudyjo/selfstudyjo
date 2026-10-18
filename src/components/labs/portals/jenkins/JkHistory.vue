<template>
  <div class="jk-hi">
    <h1 class="jk-h1">Build History of Jenkins</h1>
    <div v-if="!rows.length" class="jk-empty">No builds yet. Build a job and it appears here.</div>
    <div v-else class="jk-table-wrap">
      <table class="jk-table">
        <thead><tr><th class="is-center">S</th><th>Build</th><th>Time Since ↑</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.job + row.build.number">
            <td class="is-center"><JkStatus :ball="ballOf(row.build.result)" :size="20" /></td>
            <td>
              <button type="button" class="jk-link jk-hi__job" @click="ctx.go({ page: 'job', job: row.job })">{{ row.job }}</button>
              <button type="button" class="jk-link" @click="ctx.go({ page: 'build', job: row.job, build: row.build.number })">#{{ row.build.number }}</button>
            </td>
            <td>{{ since(row.build.at, ctx.now.value) }}</td>
            <td>{{ statusText(row.build) }}</td>
            <td class="is-center">
              <button type="button" class="jk-hi__icon" :aria-label="`Console output of ${row.job} #${row.build.number}`" title="Console Output"
                      @click="ctx.go({ page: 'build', job: row.job, build: row.build.number, tab: 'console' })"><JkIcon name="terminal" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="jk-hi__feeds"><span class="jk-link">Atom feed for all</span><span class="jk-link">Atom feed for failures</span><span class="jk-link">Atom feed for just latest builds</span></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import JkIcon from './JkIcon.vue';
import JkStatus from './JkStatus.vue';
import { useJk } from './jkContext';
import { ballOf, parseStamp, since, type Build } from './jenkinsKit';

const ctx = useJk();

const rows = computed(() => ctx.jobs.value
  .flatMap(job => job.builds.map(build => ({ job: job.name, build })))
  .map((row, index) => ({ row, index }))
  .sort((a, b) => parseStamp(b.row.build.at) - parseStamp(a.row.build.at) || b.row.build.number - a.row.build.number || a.index - b.index)
  .map(entry => entry.row));

function statusText(build: Build): string {
  if (build.result === 'SUCCESS') return 'stable';
  if (build.result === 'UNSTABLE') return build.tests?.failed ? `${build.tests.failed} test${build.tests.failed === 1 ? '' : 's'} failing` : 'unstable';
  if (build.result === 'FAILURE') return 'broken';
  return String(build.result || '').toLowerCase();
}
</script>

<style scoped>
.jk-hi { max-width: 70rem; }
.jk-hi__job { font-weight: 600; margin-right: 0.3rem; }
.jk-hi__icon { display: inline-flex; padding: 0.3rem; border: 0; border-radius: 0.5rem; background: none; cursor: pointer; color: var(--jk-text); }
.jk-hi__icon:hover { background: var(--jk-btn-hover); }
.jk-hi__icon .jk-icon { width: 1rem; height: 1rem; }
.jk-hi__feeds { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: flex-end; margin-top: 0.7rem; font-size: 0.8125rem; }
</style>
