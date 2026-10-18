<template>
  <div class="j-page bl">
    <nav class="j-crumbs" aria-label="Breadcrumbs">
      <a href="#" @click.prevent>Projects</a><span class="sep">/</span>
      <a href="#" @click.prevent="ctx.go('board')">Platform</a>
    </nav>
    <div class="j-header">
      <h1 class="j-h1">Backlog</h1>
    </div>

    <div class="bl__filters">
      <div class="bl__search">
        <JiraIcon name="search" class="bl__search-icon" />
        <input v-model="text" class="j-input" type="search" placeholder="Search backlog" aria-label="Search backlog" />
      </div>
      <JiraDropdown :items="labelItems" label="Label" trigger-class="j-btn j-btn--subtle" @select="v => label = v">
        <template #trigger>{{ label || 'Label' }} <JiraIcon name="chevron-down" :size="12" /></template>
      </JiraDropdown>
      <label class="j-check bl__showdone"><input v-model="showDone" type="checkbox" /> Show done issues</label>
    </div>

    <!-- The sprint container -->
    <section class="bl__section" :class="{ 'is-target': target === 'sprint' }"
             @dragover.prevent="target = 'sprint'" @dragleave="leave('sprint')" @drop.prevent="dropOn('sprint')">
      <header class="bl__head">
        <button type="button" class="bl__twisty" :aria-expanded="openSprint" @click="openSprint = !openSprint">
          <JiraIcon :name="openSprint ? 'chevron-down' : 'chevron-right'" />
        </button>
        <h2 class="bl__title">{{ sprintName(sprint.n) }}</h2>
        <span class="bl__meta">{{ sprint.status === 'active' ? 'Active' : 'Planned' }} · {{ sprintItems.length }} issues</span>
        <span class="bl__spacer" />
        <span class="bl__totals" aria-label="Story points by status">
          <span class="j-points" title="To Do">{{ totals.todo }}</span>
          <span class="j-points j-points--doing" title="In Progress">{{ totals.doing }}</span>
          <span class="j-points j-points--done" title="Done">{{ totals.done }}</span>
        </span>
        <button v-if="sprint.status !== 'active'" type="button" class="j-btn"
                :class="{ 'j-btn--primary': sprintItems.length }" :disabled="!sprintItems.length || busy"
                @click="start">Start sprint</button>
        <button v-else type="button" class="j-btn" :disabled="busy" @click="completeSprint">Complete sprint</button>
      </header>
      <div v-if="openSprint" class="bl__capacity">
        <div class="bl__cap-bar" :title="`${sprint.committedPoints} of ${sprint.capacity} points`">
          <span :style="{ width: Math.min(100, capPercent) + '%' }" :class="{ 'is-over': over > 0 }" />
        </div>
        <span :class="{ 'bl__over': over > 0 }">
          {{ sprint.committedPoints }} of {{ sprint.capacity }} pts effective capacity
          <template v-if="over > 0"> · {{ over.toFixed(0) }} pts over — the overflow carries and burns people out</template>
        </span>
        <input v-if="sprint.status !== 'active'" v-model="goal" class="j-input bl__goal" type="text"
               placeholder="Sprint goal (optional)" aria-label="Sprint goal" />
        <span v-else-if="sprint.goal" class="j-muted">Goal: {{ sprint.goal }}</span>
      </div>
      <ul v-if="openSprint" class="bl__list">
        <BacklogRow v-for="issue in sprintItems" :key="issue.id" :issue="issue" in-sprint
                    @dragstart="dragging = issue.id" @dragend="dragging = ''" />
        <li v-if="!sprintItems.length" class="bl__drop">Plan a sprint by dragging issues here from the backlog,
          or with each row's ••• menu.</li>
      </ul>
      <InlineCreate v-if="openSprint" :to-sprint="true" />
    </section>

    <!-- The backlog container -->
    <section class="bl__section" :class="{ 'is-target': target === 'backlog' }"
             @dragover.prevent="target = 'backlog'" @dragleave="leave('backlog')" @drop.prevent="dropOn('backlog')">
      <header class="bl__head">
        <button type="button" class="bl__twisty" :aria-expanded="openBacklog" @click="openBacklog = !openBacklog">
          <JiraIcon :name="openBacklog ? 'chevron-down' : 'chevron-right'" />
        </button>
        <h2 class="bl__title">Backlog</h2>
        <span class="bl__meta">{{ backlogItems.length }} issues</span>
        <span class="bl__spacer" />
        <span class="bl__totals">
          <span class="j-points">{{ backlogItems.filter(i => i.status !== 'doing').reduce((a, i) => a + i.points, 0) }}</span>
          <span class="j-points j-points--doing">{{ backlogItems.filter(i => i.status === 'doing').reduce((a, i) => a + i.points, 0) }}</span>
          <span class="j-points j-points--done">0</span>
        </span>
        <button type="button" class="j-btn" @click="ctx.openCreate()">Create issue</button>
      </header>
      <ul v-if="openBacklog" class="bl__list">
        <BacklogRow v-for="issue in backlogItems" :key="issue.id" :issue="issue"
                    @dragstart="dragging = issue.id" @dragend="dragging = ''" />
        <li v-if="!backlogItems.length" class="bl__drop">Your backlog is empty.</li>
      </ul>
      <InlineCreate v-if="openBacklog" :to-sprint="false" />
    </section>

    <section v-if="showDone && doneItems.length" class="bl__section">
      <header class="bl__head"><h2 class="bl__title bl__title--pad">Done</h2>
        <span class="bl__meta">{{ doneItems.length }} issues delivered</span></header>
      <ul class="bl__list"><BacklogRow v-for="issue in doneItems" :key="issue.id" :issue="issue" /></ul>
    </section>
  </div>
</template>

<script setup lang="ts">
/** The backlog: the sprint container, the backlog container, drag to plan. */
import { computed, ref } from 'vue';
import JiraIcon from './JiraIcon.vue';
import JiraDropdown, { type DropItem } from './JiraDropdown.vue';
import BacklogRow from './BacklogRow.vue';
import InlineCreate from './InlineCreate.vue';
import { sprintName } from './jiraKit';
import { useJira } from './useJira';

const { ctx, all, sprint, addToSprint, moveToBacklog, startSprint, completeSprint } = useJira();
const busy = ctx.busy;

const text = ref('');
const label = ref('');
const showDone = ref(false);
const openSprint = ref(true);
const openBacklog = ref(true);
const goal = ref('');
const dragging = ref('');
const target = ref('');

function matches(issue: { id: string; title: string; skill: string }) {
  const needle = text.value.trim().toLowerCase();
  if (needle && !issue.title.toLowerCase().includes(needle) && !issue.id.toLowerCase().includes(needle)) return false;
  if (label.value && issue.skill !== label.value) return false;
  return true;
}

const sprintItems = computed(() => sprint.value.committed
  .map(key => all.value.find(issue => issue.id === key))
  .filter((issue): issue is NonNullable<typeof issue> => Boolean(issue) && matches(issue!)));
const backlogItems = computed(() => all.value.filter(issue =>
  !sprint.value.committed.includes(issue.id) && issue.status !== 'done' && matches(issue)));
const doneItems = computed(() => all.value.filter(issue =>
  !sprint.value.committed.includes(issue.id) && issue.status === 'done' && matches(issue)));

const totals = computed(() => {
  const out = { todo: 0, doing: 0, done: 0 } as Record<string, number>;
  for (const issue of sprintItems.value) out[issue.status] = (out[issue.status] || 0) + issue.points;
  return out;
});
const capPercent = computed(() => sprint.value.capacity
  ? 100 * sprint.value.committedPoints / sprint.value.capacity : 0);
const over = computed(() => sprint.value.committedPoints - sprint.value.capacity);

const labelItems = computed<DropItem[]>(() => [{ label: 'All labels', value: '' },
  ...Array.from(new Set(all.value.map(issue => issue.skill))).sort().map(skill => ({ label: skill, value: skill }))]);

function leave(which: string) {
  if (target.value === which) target.value = '';
}

async function dropOn(which: 'sprint' | 'backlog') {
  const key = dragging.value;
  dragging.value = '';
  target.value = '';
  if (!key) return;
  const inSprint = sprint.value.committed.includes(key);
  if (which === 'sprint' && !inSprint) await addToSprint([key]);
  if (which === 'backlog' && inSprint) await moveToBacklog([key]);
}

async function start() {
  if (await startSprint(goal.value.trim())) goal.value = '';
}
</script>

<style scoped>
.bl__filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.bl__search { position: relative; width: 180px; }
.j-page .bl__search .j-input { padding-left: 30px; height: 32px; min-height: 32px; }
.bl__search-icon { position: absolute; left: 8px; top: 8px; color: var(--j-text-subtle); }
.bl__showdone { margin-left: auto; color: var(--j-text-subtle); }
.bl__section {
  margin-bottom: 16px; padding: 8px 8px 4px; border-radius: 4px; background: var(--j-sunken);
  outline: 2px solid transparent;
}
.bl__section.is-target { outline-color: var(--j-focus); background: #E9F2FE; }
.bl__head { display: flex; align-items: center; gap: 8px; min-height: 40px; flex-wrap: wrap; padding: 0 4px; }
.bl__twisty { display: grid; place-items: center; width: 24px; height: 24px; border: 0; border-radius: 3px; background: transparent; color: var(--j-text-subtle); cursor: pointer; }
.bl__twisty:hover { background: var(--j-neutral-hover); }
.bl__title { margin: 0; font-size: 14px; font-weight: 653; }
.bl__title--pad { padding-left: 4px; }
.bl__meta { color: var(--j-text-subtle); font-size: 14px; }
.bl__spacer { flex: 1; }
.bl__totals { display: inline-flex; gap: 4px; margin-right: 4px; }
.bl__capacity { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 0 8px 8px 36px; font-size: 12px; color: var(--j-text-subtle); }
.bl__cap-bar { position: relative; width: 160px; height: 6px; border-radius: 3px; background: #DDDEE1; overflow: hidden; }
.bl__cap-bar span { position: absolute; inset: 0 auto 0 0; background: #1868DB; border-radius: 3px; }
.bl__cap-bar span.is-over { background: #E2483D; }
.bl__over { color: var(--j-danger-text); font-weight: 600; }
.bl__goal { width: 260px; min-height: 28px; height: 28px; font-size: 12px; }
.bl__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px;
  border-radius: 3px; overflow: visible; }
.bl__drop {
  margin: 4px 0; padding: 20px; border: 2px dashed var(--j-border); border-radius: 4px; color: var(--j-text-subtle);
  text-align: center; background: var(--j-surface);
}
@container sl-portal (max-width: 700px) {
  .bl__showdone { margin-left: 0; }
  .bl__capacity { padding-left: 8px; }
  .bl__goal { width: 100%; }
}
</style>
