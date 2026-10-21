<template>
  <div ref="root" class="jk-dash" @keydown.esc="menu = null">
    <!-- System message (Manage Jenkins > System) -->
    <div v-if="ctx.systemMessage.value" class="jk-dash__sysmsg" role="note">{{ ctx.systemMessage.value }}</div>

    <!-- Welcome, when there is nothing yet -->
    <section v-if="!jobs.length && !ctx.views.value.length" class="jk-welcome">
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
        <button type="button" class="jk-tabs__tab" :class="{ 'is-active': !viewName }" role="tab" :aria-selected="!viewName"
                @click="ctx.go({ page: 'dashboard' })">All</button>
        <button v-for="v in ctx.views.value" :key="v.name" type="button" class="jk-tabs__tab" :class="{ 'is-active': viewName === v.name }"
                role="tab" :aria-selected="viewName === v.name" @click="ctx.go({ page: 'dashboard', view: v.name })">{{ v.name }}</button>
        <button type="button" class="jk-tabs__tab jk-tabs__add" title="New View" aria-label="New View"
                @click="ctx.go({ page: 'newView' })"><JkIcon name="plus" /></button>
      </div>
      <p v-if="currentView && currentView.description" class="jk-dash__desc">{{ currentView.description }}</p>
      <div v-if="currentView && !sorted.length" class="jk-dash__empty">
        <p>This view has no jobs associated with it. You can either <button type="button" class="jk-link" @click="ctx.go({ page: 'editView', view: currentView.name })">add some existing jobs to this view</button> or <button type="button" class="jk-link" @click="ctx.go({ page: 'newItem' })">create a new job</button> in this view.</p>
      </div>
      <div v-else class="jk-table-wrap">
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
                <button type="button" class="jk-dash__chev" :class="{ 'is-open': menu?.job === row.job.name }"
                        :aria-label="`Open the menu for ${row.job.name}`" aria-haspopup="menu" :aria-expanded="menu?.job === row.job.name"
                        @click.stop="openMenu($event, row.job.name)"><JkIcon name="chevron-down" /></button>
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

    <!-- The job's dropdown (the chevron beside a job name, as in Jenkins 2.4xx) -->
    <div v-if="menu && menuJob" class="jk-dash__menu" role="menu" :style="{ top: menu.top + 'px', left: menu.left + 'px' }" @click.stop>
      <template v-for="(item, index) in menuItems" :key="index">
        <div v-if="item.separator" class="jk-dash__menu-sep" role="separator"></div>
        <button v-else type="button" class="jk-dash__menu-item" :class="{ 'is-danger': item.danger }" role="menuitem"
                :disabled="item.disabled" @click="choose(item)">
          <JkIcon :name="item.icon || 'chevron'" />{{ item.label }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import JkIcon from './JkIcon.vue';
import JkStatus from './JkStatus.vue';
import JkWeather from './JkWeather.vue';
import { useJk } from './jkContext';
import { deleteLabel, hasParameters, useActions } from './jkActions';
import { ballOf, duration, jcli, lastWhere, parseStamp, since, weatherOf } from './jenkinsKit';

const ctx = useJk();
const actions = useActions(ctx);
const viewName = computed(() => String((ctx.route.value as any).view || ''));
const currentView = computed(() => ctx.views.value.find(v => v.name === viewName.value));
const jobs = computed(() => (currentView.value
  ? ctx.jobs.value.filter(job => currentView.value!.jobs.includes(job.name))
  : ctx.jobs.value));
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

// ---- The job dropdown ----
const root = ref<HTMLElement | null>(null);
const menu = ref<{ job: string; top: number; left: number } | null>(null);
const menuJob = computed(() => (menu.value ? ctx.job(menu.value.job) : undefined));

interface MenuItem { label: string; icon?: string; run?: () => void; danger?: boolean; disabled?: boolean; separator?: boolean }

const menuItems = computed<MenuItem[]>(() => {
  const job = menuJob.value;
  if (!job) return [];
  const name = job.name;
  const go = ctx.go;
  const folder = job.type === 'folder';
  const pipeline = job.type === 'pipeline' || job.type === 'multibranch';
  const items: MenuItem[] = [];
  if (!folder) {
    items.push({ label: 'Changes', icon: 'changes', run: () => go({ page: 'changes', job: name }) });
    items.push({ label: 'Workspace', icon: 'folder', run: () => go({ page: 'workspace', job: name }) });
    items.push(hasParameters(job)
      ? { label: 'Build with Parameters', icon: 'clock-play', disabled: job.disabled, run: () => go({ page: 'buildParams', job: name }) }
      : { label: job.type === 'multibranch' ? 'Scan Multibranch Pipeline Now' : 'Build Now', icon: 'clock-play', disabled: job.disabled, run: () => { void actions.buildNow(name); } });
  }
  items.push({ label: 'Configure', icon: 'gear', run: () => go({ page: 'configure', job: name }) });
  if (!folder) {
    items.push(job.disabled
      ? { label: 'Enable Project', icon: 'power', run: () => { void actions.setEnabled(name, true); } }
      : { label: 'Disable Project', icon: 'power', run: () => { void actions.setEnabled(name, false); } });
  }
  if (pipeline) items.push({ label: 'Full Stage View', icon: 'stages', run: () => go({ page: 'stageView', job: name }) });
  items.push({ label: 'Rename', icon: 'pencil', run: () => go({ page: 'rename', job: name }) });
  if (pipeline) items.push({ label: 'Pipeline Syntax', icon: 'help', run: () => go({ page: 'syntax', job: name }) });
  const view = currentView.value?.name;
  if (view) {
    items.push({ label: 'Remove from this view', icon: 'views',
                 run: () => { void ctx.run(jcli(['remove-job-from-view', view, name]), { success: 'Removed from the view' }); } });
  }
  items.push({ label: '', separator: true });
  items.push({ label: deleteLabel(job), icon: 'trash', danger: true, run: () => { void actions.deleteJob(name); } });
  return items;
});

function openMenu(event: MouseEvent, job: string) {
  if (menu.value?.job === job) { menu.value = null; return; }
  const button = event.currentTarget as HTMLElement;
  const host = root.value;
  if (!host) return;
  const a = button.getBoundingClientRect();
  const b = host.getBoundingClientRect();
  const width = 248;
  const left = Math.max(0, Math.min(a.left - b.left, b.width - width));
  menu.value = { job, top: a.bottom - b.top + 4, left };
}

function choose(item: MenuItem) {
  menu.value = null;
  item.run?.();
}

function close() { menu.value = null; }
onMounted(() => document.addEventListener('click', close));
onBeforeUnmount(() => document.removeEventListener('click', close));
</script>

<style scoped>
.jk-dash { position: relative; }
.jk-dash__sysmsg { margin-bottom: 16px; padding: 12px 16px; border-radius: 10.56px; background: var(--jk-table-bg); white-space: pre-wrap; }
.jk-dash__desc { margin: 0 0 12px; white-space: pre-wrap; }
.jk-dash__empty { padding: 24px; border-radius: 10.56px; background: var(--jk-table-bg); }
.jk-dash__empty p { margin: 0; }
.jk-dash__chev {
  display: inline-flex; vertical-align: middle; margin-left: 4px; padding: 2px; border: 0; border-radius: 6px;
  background: none; color: var(--jk-secondary); cursor: pointer; opacity: 0; transition: opacity 0.1s;
}
.jk-dash__chev .jk-icon { width: 14px; height: 14px; }
tr:hover .jk-dash__chev, .jk-dash__chev:focus-visible, .jk-dash__chev.is-open { opacity: 1; }
.jk-dash__chev:hover, .jk-dash__chev.is-open { background: var(--jk-btn-hover); color: var(--jk-text); }
.jk-dash__menu {
  position: absolute; z-index: 30; width: 248px; padding: 6.4px; border-radius: 12px; background: #fff;
  box-shadow: 0 0 0 1px rgba(20, 20, 31, 0.08), 0 12px 32px rgba(20, 20, 31, 0.18);
}
.jk-dash__menu-item {
  display: flex; align-items: center; gap: 9.6px; width: 100%; padding: 6.4px 9.6px; border: 0; border-radius: 8px;
  background: none; font: inherit; font-weight: 500; color: var(--jk-text); text-align: left; cursor: pointer;
}
.jk-dash__menu-item .jk-icon { width: 17.6px; height: 17.6px; flex: none; }
.jk-dash__menu-item:hover:not(:disabled) { background: var(--jk-btn-hover); }
.jk-dash__menu-item:disabled { opacity: 0.45; cursor: not-allowed; }
.jk-dash__menu-item.is-danger, .jk-dash__menu-item.is-danger .jk-icon { color: var(--jk-red); }
.jk-dash__menu-sep { height: 1px; margin: 4.8px 0; background: var(--jk-border); }
@media (hover: none) { .jk-dash__chev { opacity: 1; } }
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
