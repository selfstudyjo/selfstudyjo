<template>
  <div class="j-page bp">
    <nav class="j-crumbs" aria-label="Breadcrumbs">
      <a href="#" @click.prevent>Projects</a><span class="sep">/</span>
      <a href="#" @click.prevent="ctx.go('board')">Platform</a>
    </nav>
    <div class="j-header">
      <h1 class="j-h1">{{ sprintName(sprint.n) }}</h1>
      <div class="j-actions">
        <span class="bp__days" :title="'Sprint length ' + sprintDays + ' days'">
          <JiraIcon name="clock" /> {{ sprint.status === 'active' ? sprintDays + ' days remaining' : 'Not started' }}
        </span>
        <button v-if="sprint.status !== 'active'" type="button" class="j-btn"
                :disabled="!sprint.committed.length || busy" @click="startSprint()">Start sprint</button>
        <button type="button" class="j-btn" :disabled="busy" @click="completeSprint">Complete sprint</button>
        <JiraDropdown :items="boardMenu" label="More actions" align="right" trigger-class="j-btn j-btn--icon"
                      @select="onBoardMenu">
          <template #trigger><JiraIcon name="more" /></template>
        </JiraDropdown>
      </div>
    </div>
    <p v-if="sprint.goal" class="bp__goal"><strong>Sprint goal:</strong> {{ sprint.goal }}</p>
    <SprintEditDialog v-if="editing" @close="editing = false" />

    <div class="bp__filters">
      <div class="bp__search">
        <JiraIcon name="search" class="bp__search-icon" />
        <input v-model="text" class="j-input" type="search" placeholder="Search board" aria-label="Search board" />
      </div>
      <div class="bp__avatars" role="group" aria-label="Filter by assignee">
        <button v-for="person in assignees" :key="person.id" type="button" class="bp__avatar"
                :class="{ 'is-on': who.includes(person.id) }" :aria-pressed="who.includes(person.id)"
                :title="person.name" @click="toggle(person.id)">
          <JiraAvatar :name="person.name" :size="32" :title="false" />
        </button>
      </div>
      <button type="button" class="j-btn j-btn--subtle" :class="{ 'is-on': onlyUnassigned }"
              :aria-pressed="onlyUnassigned" @click="onlyUnassigned = !onlyUnassigned">Unassigned</button>
      <JiraDropdown :items="typeItems" label="Type" trigger-class="j-btn j-btn--subtle" @select="v => type = v">
        <template #trigger>{{ type ? TYPE_LABEL[type] : 'Type' }} <JiraIcon name="chevron-down" :size="12" /></template>
      </JiraDropdown>
      <button v-if="who.length || text || onlyUnassigned || type" type="button" class="j-btn j-btn--subtle"
              @click="clearFilters">Clear filters</button>
      <span class="bp__capacity" :class="{ 'is-over': sprint.committedPoints > sprint.capacity + 2 }">
        {{ sprint.committedPoints }} of {{ sprint.capacity }} pts capacity
      </span>
    </div>

    <div v-if="sprint.status !== 'active' && sprint.committed.length" class="j-msg">
      <JiraIcon name="info" :size="20" />
      <div><div class="j-msg__title">This sprint hasn't been started</div>
        Start it from here or from the backlog. Cards can be moved between To Do and In Progress either way;
        work reaches Done when the sprint is completed and the team had the capacity to deliver it.</div>
    </div>

    <div v-if="!sprint.committed.length" class="j-empty">
      <svg width="120" height="90" viewBox="0 0 120 90" aria-hidden="true">
        <rect x="10" y="10" width="30" height="70" rx="4" fill="#E9F2FE" />
        <rect x="45" y="10" width="30" height="70" rx="4" fill="#F8F8F8" />
        <rect x="80" y="10" width="30" height="70" rx="4" fill="#DCFFF1" />
        <rect x="15" y="18" width="20" height="10" rx="2" fill="#fff" stroke="#8FB8F6" />
        <rect x="50" y="18" width="20" height="10" rx="2" fill="#fff" stroke="#B7B9BE" />
      </svg>
      <h3>Your board has no issues in this sprint</h3>
      <p>Plan the sprint from the backlog: drag issues into {{ sprintName(sprint.n) }}, then start it.</p>
      <button type="button" class="j-btn j-btn--primary" @click="ctx.go('backlog')">Go to backlog</button>
    </div>

    <div v-else class="bp__columns">
      <section v-for="column in columns" :key="column.id" class="bp__column"
               :class="{ 'is-target': dropTarget === column.id, 'is-done': column.id === 'done' }"
               :aria-label="column.label"
               @dragover.prevent="onDragOver($event, column.id)" @dragleave="onDragLeave(column.id)"
               @drop.prevent="onDrop(column.id)">
        <header class="bp__column-head">
          {{ column.label }} <span class="bp__column-count">{{ column.items.length }}</span>
          <JiraIcon v-if="column.id === 'done'" name="check" class="bp__done-check" />
        </header>
        <ul class="bp__cards">
          <li v-for="issue in column.items" :key="issue.id">
            <article class="bp__card" tabindex="0" draggable="true"
                     :class="{ 'is-dragging': dragging === issue.id, 'is-flagged': issue.flagged }"
                     :aria-label="`${issue.id} ${issue.title}. ${STATUS_LABEL[issue.status]}. Shift plus arrow keys move it.`"
                     @dragstart="onDragStart($event, issue)" @dragend="dragging = ''; dropTarget = ''"
                     @click="ctx.openIssue(issue.id)" @keydown.enter.prevent="ctx.openIssue(issue.id)"
                     @contextmenu="contextMenu($event, issue)" @keydown.shift.f10.prevent="keyMenu($event, issue)"
                     @keydown.shift.right.prevent="shift(issue, 1)" @keydown.shift.left.prevent="shift(issue, -1)">
              <div class="bp__card-top">
                <p class="bp__summary">{{ issue.title }}</p>
                <JiraDropdown :items="issueMenu(issue)" label="Card actions" align="right"
                              trigger-class="bp__card-more" @click.stop @select="v => onIssueMenu(issue, v)">
                  <template #trigger><JiraIcon name="more" /></template>
                </JiraDropdown>
              </div>
              <div v-if="issue.labels.length || issue.skill" class="bp__labels">
                <span v-for="l in issue.labels" :key="l" class="bp__tag">{{ l }}</span>
                <span v-if="issue.skill" class="bp__label" :title="'Component: ' + issue.skill">{{ issue.skill }}</span>
              </div>
              <div class="bp__card-foot">
                <JiraIcon :name="issue.type" kind="type" />
                <span class="j-key" :class="{ 'j-key--done': issue.status === 'done' }">{{ issue.id }}</span>
                <JiraIcon v-if="issue.flagged" name="flag" :size="14" class="bp__flag" title="Flagged" />
                <span v-if="issue.subtasks.length" class="bp__subs" :title="`${subsDone(issue)} of ${issue.subtasks.length} subtasks done`">
                  <JiraIcon name="subtask" :size="14" /> {{ subsDone(issue) }}/{{ issue.subtasks.length }}</span>
                <JiraIcon v-if="issue.links.length" name="link" :size="14" class="bp__muted" :title="`${issue.links.length} linked work item(s)`" />
                <span class="bp__spacer" />
                <span v-if="issue.carried" class="bp__carried" :title="`Carried over ${issue.carried} time(s)`">↻{{ issue.carried }}</span>
                <span class="j-points" :class="'j-points--' + issue.status"
                      :title="`Story point estimate: ${issue.points}`">{{ issue.points }}</span>
                <JiraIcon :name="issue.value" kind="priority" :title="PRIORITY_LABEL[issue.value]" />
                <JiraAvatar :name="issue.assignee" :size="24" />
              </div>
            </article>
          </li>
          <li v-if="!column.items.length" class="bp__none">{{ column.id === 'done' ? 'Delivered work appears here' : '' }}</li>
        </ul>
        <button v-if="column.id === 'todo'" type="button" class="bp__create"
                @click="ctx.openCreate({ sprint: true })">
          <JiraIcon name="plus" /> Create issue
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
/** The active sprint board: To Do / In Progress / Done, drag-and-drop transitions. */
import { computed, ref } from 'vue';
import { pick } from '@/utils/portalKit';
import JiraIcon from './JiraIcon.vue';
import JiraAvatar from './JiraAvatar.vue';
import JiraDropdown, { type DropItem } from './JiraDropdown.vue';
import SprintEditDialog from './SprintEditDialog.vue';
import { PRIORITY_LABEL, sprintName, STATUS_LABEL, TYPE_LABEL, type Issue } from './jiraKit';
import { useJira } from './useJira';

const { ctx, all, team, sprint, move, startSprint, completeSprint, issueMenu, onIssueMenu, contextMenu } = useJira();
const editing = ref(false);
const subsDone = (issue: Issue) => issue.subtasks.filter(sub => sub.done).length;

/** Shift+F10 / the menu key: the context menu, anchored to the focused card. */
function keyMenu(event: KeyboardEvent, issue: Issue) {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  contextMenu(new MouseEvent('contextmenu', { clientX: box.left + 24, clientY: box.top + 24 }), issue);
}
const busy = ctx.busy;
const sprintDays = computed(() => Number(pick(ctx.view.value, 'org.sprint_days', 14)));

const text = ref('');
const who = ref<string[]>([]);
const onlyUnassigned = ref(false);
const type = ref('');
const dragging = ref('');
const dropTarget = ref('');

const inSprint = computed(() => all.value.filter(issue => sprint.value.committed.includes(issue.id)));
const assignees = computed(() => team.value.filter(person =>
  inSprint.value.some(issue => issue.assignee_id === person.id)));

const filtered = computed(() => inSprint.value.filter(issue => {
  const needle = text.value.trim().toLowerCase();
  if (needle && !issue.title.toLowerCase().includes(needle) && !issue.id.toLowerCase().includes(needle)) return false;
  if (who.value.length && !who.value.includes(issue.assignee_id)) return false;
  if (onlyUnassigned.value && issue.assignee_id) return false;
  if (type.value && issue.type !== type.value) return false;
  return true;
}));

const ORDER = ['todo', 'doing', 'done'] as const;
const columns = computed(() => ORDER.map(id => ({
  id, label: STATUS_LABEL[id], items: filtered.value.filter(issue => issue.status === id),
})));

const typeItems: DropItem[] = [{ label: 'All types', value: '' },
  { label: 'Story', value: 'story' }, { label: 'Task', value: 'task' }, { label: 'Bug', value: 'bug' }];

function toggle(id: string) {
  who.value = who.value.includes(id) ? who.value.filter(x => x !== id) : [...who.value, id];
}

function clearFilters() {
  who.value = []; text.value = ''; onlyUnassigned.value = false; type.value = '';
}

function onDragStart(event: DragEvent, issue: Issue) {
  dragging.value = issue.id;
  event.dataTransfer?.setData('text/plain', issue.id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function onDragOver(event: DragEvent, column: string) {
  dropTarget.value = column;
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}

function onDragLeave(column: string) {
  if (dropTarget.value === column) dropTarget.value = '';
}

async function onDrop(column: string) {
  const key = dragging.value;
  dragging.value = '';
  dropTarget.value = '';
  const issue = all.value.find(row => row.id === key);
  if (issue) await move(issue, column as 'todo' | 'doing' | 'done');
}

async function shift(issue: Issue, delta: number) {
  const index = ORDER.indexOf(issue.status as typeof ORDER[number]);
  const next = ORDER[Math.max(0, Math.min(ORDER.length - 1, index + delta))];
  if (next !== issue.status) await move(issue, next);
}

const boardMenu: DropItem[] = [
  { label: 'Edit sprint', value: 'edit' },
  { label: 'Go to backlog', value: 'backlog' }, { label: 'View sprint reports', value: 'reports' },
  { label: 'Search work items', value: 'issues' },
  { label: 'Board settings', value: 'settings', disabled: true, hint: 'Columns follow the engine\'s three states' },
];
function onBoardMenu(value: string) {
  if (value === 'edit') editing.value = true;
  else if (value === 'backlog' || value === 'reports' || value === 'issues') ctx.go(value);
}
</script>

<style scoped>
.bp__days { display: inline-flex; align-items: center; gap: 4px; color: var(--j-text-subtle); margin-right: 4px; }
.bp__goal { margin: -8px 0 16px; color: var(--j-text-subtle); }
.bp__filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.bp__search { position: relative; width: 160px; }
.j-page .bp__search .j-input { padding-left: 30px; min-height: 32px; height: 32px; }
.bp__search-icon { position: absolute; left: 8px; top: 8px; color: var(--j-text-subtle); }
.bp__avatars { display: flex; padding-left: 4px; }
.bp__avatar { margin-left: -4px; padding: 0; border: 0; background: none; border-radius: 50%; cursor: pointer; }
.bp__avatar:hover { transform: translateY(-2px); }
.bp__avatar.is-on :deep(.ja) { box-shadow: 0 0 0 2px var(--j-brand); }
.j-btn.is-on { background: var(--j-selected); color: var(--j-selected-text); }
.bp__capacity { margin-left: auto; font-size: 12px; color: var(--j-text-subtle); }
.bp__capacity.is-over { color: var(--j-danger-text); font-weight: 600; }
.bp__columns { display: grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap: 8px; align-items: start; overflow-x: auto; }
.bp__column {
  display: flex; flex-direction: column; min-height: 240px; padding: 0 0 8px; border-radius: 6px;
  background: var(--j-sunken); outline: 2px solid transparent; transition: outline-color .1s;
}
.bp__column.is-target { outline-color: var(--j-focus); background: #E9F2FE; }
.bp__column-head {
  display: flex; align-items: center; gap: 6px; padding: 12px 12px 8px; font-size: 12px; font-weight: 653;
  color: var(--j-text-subtle); text-transform: uppercase;
}
.bp__column-count { font-weight: 400; }
.bp__done-check { color: #22A06B; }
.bp__cards { list-style: none; margin: 0; padding: 0 8px; display: flex; flex-direction: column; gap: 4px; }
.bp__card {
  padding: 12px 12px 10px; border-radius: 4px; background: var(--j-surface); box-shadow: var(--j-card-shadow);
  cursor: pointer; outline: none;
}
.bp__card:hover { background: #F8F8F8; }
.bp__card:focus-visible { box-shadow: 0 0 0 2px var(--j-focus); }
.bp__card.is-dragging { opacity: 0.4; }
.bp__card-top { display: flex; gap: 4px; align-items: flex-start; }
.bp__summary { flex: 1; margin: 0 0 8px; color: var(--j-text); overflow-wrap: anywhere; }
.bp__card :deep(.bp__card-more) {
  width: 24px; height: 24px; justify-content: center; border-radius: 3px; color: var(--j-text-subtle); opacity: 0;
}
.bp__card:hover :deep(.bp__card-more), .bp__card:focus-within :deep(.bp__card-more), .bp__card :deep(.jd.is-open .bp__card-more) { opacity: 1; }
.bp__card :deep(.bp__card-more:hover) { background: var(--j-neutral-hover); }
.bp__label {
  display: inline-block; margin-bottom: 8px; padding: 0 4px; border-radius: 3px; background: #EED7FC; color: #803FA5;
  font-size: 12px; font-weight: 700; text-transform: uppercase; line-height: 16px;
}
.bp__card-foot { display: flex; align-items: center; gap: 6px; }
.bp__card.is-flagged { background: #FFF7D6; }
.bp__card.is-flagged:hover { background: #FFF0B3; }
.bp__flag { color: #C9372C; }
.bp__subs { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; color: var(--j-text-subtle); }
.bp__muted { color: var(--j-text-subtle); }
.bp__labels { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.bp__labels .bp__label { margin-bottom: 0; }
.bp__tag { padding: 0 4px; border-radius: 3px; background: var(--j-neutral); color: var(--j-text); font-size: 12px; line-height: 16px; }
.bp__spacer { flex: 1; }
.bp__carried { font-size: 12px; color: #A54800; font-weight: 600; }
.bp__none { padding: 12px 4px; font-size: 12px; color: var(--j-text-subtlest); text-align: center; }
.bp__create {
  display: flex; align-items: center; gap: 6px; margin: 6px 8px 0; padding: 8px; border: 0; border-radius: 3px;
  background: transparent; color: var(--j-text-subtle); font: inherit; font-weight: 500; cursor: pointer; text-align: left;
}
.bp__create:hover { background: var(--j-neutral-hover); }
@container sl-portal (max-width: 700px) {
  /* Jira on a narrow screen: one column at a time, swiped sideways inside the
     board (the page itself never scrolls sideways). */
  .bp__columns { grid-template-columns: repeat(3, minmax(240px, 82%)); scroll-snap-type: x mandatory;
    overscroll-behavior-x: contain; padding-bottom: 4px; }
  .bp__column { scroll-snap-align: start; }
  .bp__capacity { margin-left: 0; width: 100%; }
  .bp__search { flex: 1 1 160px; }
  .bp__card :deep(.bp__card-more) { opacity: 1; width: 32px; height: 32px; margin: -6px -6px 0 0; }
}
@media (hover: none) { .bp__card :deep(.bp__card-more) { opacity: 1; } }
</style>
