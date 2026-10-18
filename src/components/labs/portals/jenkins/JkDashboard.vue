<template>
  <div class="jk-dash">
    <!-- Welcome, when there is nothing yet -->
    <section v-if="!jobs.length" class="jk-welcome">
      <h1 class="jk-welcome__title">Welcome to Jenkins!</h1>
      <p class="jk-welcome__lead">This page is where your Jenkins jobs will be displayed. To get started, you can set up distributed builds or start building a software project.</p>
      <h2 class="jk-welcome__h2">Start building your software project</h2>
      <button type="button" class="jk-welcome__card" @click="ctx.go({ page: 'newItem' })">
        <span>Create a job</span><JkIcon name="plus" />
      </button>
      <h2 class="jk-welcome__h2">Set up a distributed build</h2>
      <button type="button" class="jk-welcome__card" @click="ctx.go({ page: 'nodeNew' })">
        <span>Set up an agent</span><JkIcon name="computer" />
      </button>
      <button type="button" class="jk-welcome__card" @click="ctx.notify('info', 'Clouds need a cloud provider plugin, which this lab does not install.')">
        <span>Configure a cloud</span><JkIcon name="cloud" />
      </button>
      <button type="button" class="jk-welcome__card" @click="ctx.go({ page: 'nodes' })">
        <span>Learn more about distributed builds</span><JkIcon name="info" />
      </button>
    </section>

    <template v-else>
      <div class="jk-tabs" role="tablist">
        <button type="button" class="jk-tabs__tab is-active" role="tab" aria-selected="true">All</button>
        <button type="button" class="jk-tabs__tab jk-tabs__add" title="New View"
                @click="ctx.notify('info', 'This lab has a single view, All.')"><JkIcon name="plus" /></button>
      </div>
      <div class="jk-table-wrap">
        <table class="jk-table jk-dash__table">
          <thead>
            <tr>
              <th class="is-center"><button type="button" class="jk-sort" @click="sort('status')">S<span v-if="key === 'status'">{{ arrow }}</span></button></th>
              <th class="is-center"><button type="button" class="jk-sort" @click="sort('weather')">W<span v-if="key === 'weather'">{{ arrow }}</span></button></th>
              <th><button type="button" class="jk-sort" @click="sort('name')">Name<span v-if="key === 'name'">{{ arrow }}</span></button></th>
              <th><button type="button" class="jk-sort" @click="sort('success')">Last Success<span v-if="key === 'success'">{{ arrow }}</span></button></th>
              <th><button type="button" class="jk-sort" @click="sort('failure')">Last Failure<span v-if="key === 'failure'">{{ arrow }}</span></button></th>
              <th><button type="button" class="jk-sort" @click="sort('duration')">Last Duration<span v-if="key === 'duration'">{{ arrow }}</span></button></th>
              <th><span class="jk-sr">Build</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sorted" :key="row.job.name">
              <td class="is-center"><JkStatus :ball="row.ball" :size="22" /></td>
              <td class="is-center">
                <JkIcon v-if="row.job.type === 'folder'" name="folder" />
                <JkWeather v-else :icon="row.weather.icon" :text="row.weather.text" />
              </td>
              <td class="jk-dash__name">
                <button type="button" class="jk-link jk-dash__job" @click="ctx.go({ page: 'job', job: row.job.name })">{{ row.job.name }}</button>
                <span v-if="row.job.disabled" class="jk-dash__badge">Disabled</span>
              </td>
              <td>
                <template v-if="row.success">{{ since(row.success.at, ctx.now.value) }}
                  <button type="button" class="jk-link jk-dash__num" @click="ctx.go({ page: 'build', job: row.job.name, build: row.success.number })">#{{ row.success.number }}</button>
                </template>
                <span v-else class="jk-muted">N/A</span>
              </td>
              <td>
                <template v-if="row.failure">{{ since(row.failure.at, ctx.now.value) }}
                  <button type="button" class="jk-link jk-dash__num" @click="ctx.go({ page: 'build', job: row.job.name, build: row.failure.number })">#{{ row.failure.number }}</button>
                </template>
                <span v-else class="jk-muted">N/A</span>
              </td>
              <td>{{ row.last ? duration(row.last.duration) : 'N/A' }}</td>
              <td class="is-center">
                <button v-if="row.job.type !== 'folder'" type="button" class="jk-dash__build"
                        :title="`Schedule a Build for ${row.job.name}`" :aria-label="`Schedule a Build for ${row.job.name}`"
                        :disabled="row.job.disabled" @click="actions.buildNow(row.job.name)">
                  <JkIcon name="clock-play" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="jk-dash__legend">
        <span>Icon: <b class="jk-dash__size">S</b> <span class="jk-dash__size is-on">M</span> <span class="jk-dash__size">L</span></span>
        <span class="jk-dash__feeds">
          <span class="jk-link" @click="legend = !legend">Icon legend</span>
          <span class="jk-link">Atom feed for all</span>
          <span class="jk-link">Atom feed for failures</span>
          <span class="jk-link">Atom feed for just latest builds</span>
        </span>
      </div>
      <div v-if="legend" class="jk-card jk-dash__legend-card">
        <div><JkStatus ball="nobuilt" :size="18" /> The project has never been built.</div>
        <div><JkStatus ball="blue" :size="18" /> The last build was successful.</div>
        <div><JkStatus ball="yellow" :size="18" /> The last build was successful but unstable (tests failed).</div>
        <div><JkStatus ball="red" :size="18" /> The last build failed.</div>
        <div><JkStatus ball="disabled" :size="18" /> The project is disabled.</div>
        <div><JkWeather icon="sunny" :size="18" /> Project health is over 80%.</div>
        <div><JkWeather icon="storm" :size="18" /> Project health is less than 20%.</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import JkIcon from './JkIcon.vue';
import JkStatus from './JkStatus.vue';
import JkWeather from './JkWeather.vue';
import { useJk } from './jkContext';
import { useActions } from './jkActions';
import { ballOf, duration, lastWhere, parseStamp, since, weatherOf } from './jenkinsKit';

const ctx = useJk();
const actions = useActions(ctx);
const jobs = computed(() => ctx.jobs.value);
const legend = ref(false);
const key = ref('name');
const dir = ref<1 | -1>(1);
const arrow = computed(() => (dir.value === 1 ? ' ↓' : ' ↑'));

function sort(next: string) {
  if (key.value === next) dir.value = dir.value === 1 ? -1 : 1;
  else { key.value = next; dir.value = 1; }
}

const rows = computed(() => jobs.value.map(job => {
  const last = job.builds[0] || null;
  return {
    job,
    last,
    ball: ballOf(last?.result, job.disabled),
    weather: weatherOf(job),
    success: lastWhere(job, b => b.result === 'SUCCESS'),
    failure: lastWhere(job, b => b.result === 'FAILURE'),
  };
}));

const sorted = computed(() => {
  const value = (row: (typeof rows.value)[number]): string | number => {
    switch (key.value) {
      case 'status': return ['red', 'yellow', 'blue', 'nobuilt', 'disabled'].indexOf(row.ball);
      case 'weather': return row.weather.score;
      case 'success': return -parseStamp(row.success?.at);
      case 'failure': return -parseStamp(row.failure?.at);
      case 'duration': return row.last?.duration ?? -1;
      default: return row.job.name.toLowerCase();
    }
  };
  return rows.value.map((row, index) => ({ row, index })).sort((a, b) => {
    const left = value(a.row);
    const right = value(b.row);
    const order = typeof left === 'number' && typeof right === 'number' ? left - right
      : String(left).localeCompare(String(right));
    return order * dir.value || a.index - b.index;
  }).map(entry => entry.row);
});
</script>

<style scoped>
.jk-welcome { max-width: 736px; }
.jk-welcome__title { font-size: 29.6px; font-weight: 700; margin: 6.4px 0 9.6px; }
.jk-welcome__lead { color: var(--jk-text); margin: 0 0 25.6px; }
.jk-welcome__h2 { font-size: 16.8px; font-weight: 650; margin: 22.4px 0 9.6px; }
.jk-welcome__card {
  display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 480px;
  padding: 13.6px 16px; margin-bottom: 8px; border: 0; border-radius: 12.8px;
  background: var(--jk-btn-bg); color: var(--jk-text); font: inherit; font-weight: 600; cursor: pointer;
}
.jk-welcome__card:hover { background: var(--jk-btn-hover); }
.jk-tabs { display: flex; gap: 4px; margin-bottom: 9.6px; }
.jk-tabs__tab { display: inline-flex; align-items: center; padding: 5.6px 15.2px; border: 0; border-radius: 10.56px; background: none; font: inherit; font-weight: 600; color: var(--jk-text); cursor: pointer; }
.jk-tabs__tab.is-active { background: var(--jk-btn-bg); }
.jk-tabs__tab:hover { background: var(--jk-btn-hover); }
.jk-tabs__add .jk-icon { width: 16px; height: 16px; }
.jk-sort { background: none; border: 0; padding: 0 4px; margin: 0 -4px; min-width: 16px; font: inherit; font-weight: 600; color: inherit; cursor: pointer; white-space: nowrap; }
.jk-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.jk-dash__table td { white-space: nowrap; }
.jk-dash__table td:first-child, .jk-dash__table td:nth-child(2) { width: 40px; }
.jk-dash__name { min-width: 160px; }
.jk-dash__job { font-weight: 600; }
.jk-link.jk-dash__num { display: inline-block; min-width: 24px; text-align: left; }
.jk-link.jk-dash__job { display: inline-block; min-width: 24px; text-align: left; }
.jk-dash__badge { margin-left: 8px; padding: 0.8px 7.2px; border-radius: 6.4px; background: var(--jk-btn-bg); color: var(--jk-secondary); font-size: 12px; font-weight: 600; }
.jk-dash__build { display: inline-flex; padding: 4.8px; border: 0; border-radius: 8px; background: none; color: var(--jk-green); cursor: pointer; }
.jk-dash__build:hover:not(:disabled) { background: var(--jk-btn-hover); }
.jk-dash__build:disabled { color: var(--jk-secondary); opacity: 0.5; cursor: not-allowed; }
.jk-dash__legend { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px 24px; margin-top: 12.8px; font-size: 13px; color: var(--jk-secondary); }
.jk-dash__feeds { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.jk-dash__size { padding: 0 4px; font-weight: 500; }
.jk-dash__size.is-on { font-weight: 700; color: var(--jk-text); text-decoration: underline; }
.jk-dash__legend-card { margin-top: 12.8px; display: grid; gap: 5.6px; }
.jk-dash__legend-card > div { display: flex; align-items: center; gap: 8px; }
</style>
