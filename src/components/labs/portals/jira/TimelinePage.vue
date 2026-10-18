<template>
  <div class="j-page tl">
    <nav class="j-crumbs" aria-label="Breadcrumbs">
      <a href="#" @click.prevent>Projects</a><span class="sep">/</span><a href="#" @click.prevent>Platform</a>
    </nav>
    <div class="j-header">
      <h1 class="j-h1">Timeline</h1>
      <div class="j-actions">
        <div class="tl__search"><JiraIcon name="search" class="tl__search-icon" />
          <input v-model="text" class="j-input" type="search" placeholder="Search timeline" aria-label="Search timeline" /></div>
        <label class="j-check"><input v-model="hideDone" type="checkbox" /> Hide done</label>
      </div>
    </div>
    <div class="tl__chart" :style="{ '--cols': columns.length }">
      <div class="tl__corner">Issue</div>
      <div v-for="n in columns" :key="'h' + n" class="tl__col-head" :class="{ 'is-now': n === sprint.n }">
        Sprint {{ n }}<span v-if="n === sprint.n" class="tl__today">Now</span>
      </div>
      <template v-for="issue in shown" :key="issue.id">
        <button type="button" class="tl__row-label" @click="ctx.openIssue(issue.id)">
          <JiraIcon :name="issue.type" kind="type" />
          <span class="j-key" :class="{ 'j-key--done': issue.status === 'done' }">{{ issue.id }}</span>
          <span class="tl__title">{{ issue.title }}</span>
        </button>
        <div class="tl__track" :style="{ gridColumn: `2 / span ${columns.length}` }">
          <span v-for="n in columns" :key="n" class="tl__cell" :class="{ 'is-now': n === sprint.n }" />
          <button v-if="span(issue)" type="button" class="tl__bar" :class="'is-' + issue.status"
                  :style="barStyle(issue)" :title="`${issue.id}: Sprint ${span(issue)![0]}–${span(issue)![1]}`"
                  @click="ctx.openIssue(issue.id)">{{ issue.points }} pts</button>
        </div>
      </template>
      <div v-if="!shown.length" class="tl__none">No issues match.</div>
    </div>
    <p class="j-small tl__legend">Bars run from the sprint an issue was first committed to, to the sprint it was delivered (or now). Backlog issues that were never planned have no bar.</p>
  </div>
</template>

<script setup lang="ts">
/** A read-only timeline: each issue across the sprints it was planned and delivered in. */
import { computed, ref } from 'vue';
import JiraIcon from './JiraIcon.vue';
import type { Issue } from './jiraKit';
import { useJira } from './useJira';

const { ctx, all, sprint } = useJira();
const text = ref('');
const hideDone = ref(false);

const columns = computed(() => {
  const last = sprint.value.n + 3;
  const first = Math.max(1, last - 9);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
});

function sprintFrom(issue: Issue, pattern: RegExp): number[] {
  return issue.events.map(e => e.text.match(pattern)).filter(Boolean).map(m => Number(m![1]));
}

function span(issue: Issue): [number, number] | null {
  const firstCommit = sprintFrom(issue, /committed it to sprint (\d+)/i)[0] || (Number(issue.sprint) || 0);
  const delivered = sprintFrom(issue, /delivered in sprint (\d+)/i)[0];
  if (!firstCommit && !delivered && !issue.in_sprint) return null;
  const start = firstCommit || delivered || sprint.value.n;
  const end = delivered || (issue.status === 'done' ? start : (issue.in_sprint || issue.status === 'doing' ? sprint.value.n : start));
  return [Math.min(start, end), Math.max(start, end)];
}

function barStyle(issue: Issue) {
  const s = span(issue)!;
  const first = columns.value[0];
  const count = columns.value.length;
  const left = Math.max(0, s[0] - first);
  const width = Math.max(1, Math.min(count, s[1] - first + 1) - left);
  return { left: `calc(${(100 * left) / count}% + 4px)`, width: `calc(${(100 * width) / count}% - 8px)` };
}

const shown = computed(() => all.value.filter(issue => {
  if (hideDone.value && issue.status === 'done') return false;
  const needle = text.value.trim().toLowerCase();
  return !needle || issue.title.toLowerCase().includes(needle) || issue.id.toLowerCase().includes(needle);
}));
</script>

<style scoped>
.tl__search { position: relative; width: 180px; }
.j-page .tl__search .j-input { padding-left: 30px; height: 32px; min-height: 32px; }
.tl__search-icon { position: absolute; left: 8px; top: 8px; color: var(--j-text-subtle); }
.tl__chart { display: grid; grid-template-columns: minmax(220px, 300px) repeat(var(--cols), minmax(64px, 1fr)); border: 1px solid var(--j-border); border-radius: 6px; overflow: auto; }
.tl__corner, .tl__col-head { position: sticky; top: 0; z-index: 1; padding: 8px; background: var(--j-sunken); border-bottom: 1px solid var(--j-border); font-size: 12px; font-weight: 653; color: var(--j-text-subtle); white-space: nowrap; }
.tl__col-head { text-align: center; border-left: 1px solid var(--j-border); }
.tl__col-head.is-now { color: var(--j-brand); }
.tl__today { margin-left: 4px; padding: 0 4px; border-radius: 3px; background: var(--j-brand); color: #fff; font-size: 10px; }
.tl__row-label { display: flex; align-items: center; gap: 6px; min-width: 0; height: 40px; padding: 0 8px; border: 0; border-bottom: 1px solid var(--j-border); background: var(--j-surface); font: inherit; color: var(--j-text); text-align: left; cursor: pointer; }
.tl__row-label:hover { background: var(--j-subtle-hover); }
.tl__title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl__track { position: relative; display: grid; grid-template-columns: repeat(var(--cols), minmax(64px, 1fr)); height: 40px; border-bottom: 1px solid var(--j-border); }
.tl__cell { border-left: 1px solid var(--j-border); }
.tl__cell.is-now { background: #E9F2FE66; }
.tl__bar { position: absolute; top: 9px; height: 22px; border: 0; border-radius: 4px; background: #8F7EE7; color: #fff; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; overflow: hidden; white-space: nowrap; }
.tl__bar.is-done { background: #22A06B; }
.tl__bar.is-doing { background: #1868DB; }
.tl__bar.is-todo { background: #8C8F97; }
.tl__none { grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--j-text-subtle); }
.tl__legend { margin-top: 8px; }
@container sl-portal (max-width: 700px) { .tl__chart { grid-template-columns: 160px repeat(var(--cols), 56px); } }
</style>
