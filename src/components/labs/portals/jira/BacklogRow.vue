<template>
  <li class="br" draggable="true" :class="{ 'is-done': issue.status === 'done' }"
      @dragstart="onDragStart">
    <span class="br__grip" aria-hidden="true"><JiraIcon name="drag" :size="14" /></span>
    <JiraIcon :name="issue.type" kind="type" />
    <button type="button" class="br__key j-key" :class="{ 'j-key--done': issue.status === 'done' }"
            @click="ctx.openIssue(issue.id)">{{ issue.id }}</button>
    <button type="button" class="br__summary" @click="ctx.openIssue(issue.id)">{{ issue.title }}</button>
    <span v-if="issue.kr" class="br__kr" :title="'Rolls up to ' + issue.kr">{{ issue.kr }}</span>
    <span class="br__label" :title="'Label: ' + issue.skill">{{ issue.skill }}</span>
    <JiraDropdown :items="statusItems" :selected="issue.status" label="Change status"
                  trigger-class="br__status" @select="onStatus">
      <template #trigger>
        <span class="j-lozenge" :class="'j-lozenge--' + issue.status">{{ STATUS_LABEL[issue.status] || issue.status }}</span>
        <JiraIcon name="chevron-down" :size="12" />
      </template>
    </JiraDropdown>
    <form v-if="editing" class="br__est" @submit.prevent="saveEstimate">
      <input ref="estimate" v-model="points" class="j-input" type="number" min="0" max="100"
             aria-label="Story point estimate" @blur="saveEstimate" @keydown.esc="editing = false" />
    </form>
    <button v-else type="button" class="j-points br__points" :title="issue.status === 'done'
              ? 'Delivered work cannot be re-estimated' : 'Story point estimate — click to edit'"
            :disabled="issue.status === 'done'" @click="editEstimate">{{ issue.points }}</button>
    <JiraIcon :name="issue.value" kind="priority" />
    <JiraDropdown :items="assigneeItems" :selected="issue.assignee_id" label="Assignee" align="right"
                  trigger-class="br__assignee" heading="Assign to" @select="v => assign(issue, v)">
      <template #trigger><JiraAvatar :name="issue.assignee" :size="24" /></template>
    </JiraDropdown>
    <JiraDropdown :items="menu" label="More actions" align="right" trigger-class="br__more"
                  @select="onMenu">
      <template #trigger><JiraIcon name="more" /></template>
    </JiraDropdown>
  </li>
</template>

<script setup lang="ts">
/** One backlog row: the type, key and summary, and every inline edit Jira offers. */
import { computed, nextTick, ref } from 'vue';
import { cli } from '@/utils/portalKit';
import JiraIcon from './JiraIcon.vue';
import JiraAvatar from './JiraAvatar.vue';
import JiraDropdown, { type DropItem } from './JiraDropdown.vue';
import { sprintName, STATUS_LABEL, type Issue } from './jiraKit';
import { useJira } from './useJira';

const props = withDefaults(defineProps<{ issue: Issue; inSprint?: boolean }>(), { inSprint: false });
const { ctx, team, sprint, move, assign, addToSprint, moveToBacklog, deleteIssue } = useJira();

const editing = ref(false);
const points = ref('');
const estimate = ref<HTMLInputElement | null>(null);

function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/plain', props.issue.id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

const statusItems = computed<DropItem[]>(() => {
  const issue = props.issue;
  return [
    { label: 'To Do', value: 'todo' },
    { label: 'In Progress', value: 'doing', disabled: !props.inSprint && issue.status !== 'doing',
      hint: 'Only work in the sprint can be In Progress' },
    { label: 'Done', value: 'done', disabled: issue.status !== 'done' && issue.done_points + 0.01 < issue.points,
      hint: `Done follows delivery: ${issue.done_points} of ${issue.points} pts delivered` },
  ].filter(item => item.value !== issue.status);
});

async function onStatus(value: string) {
  await move(props.issue, value as 'todo' | 'doing' | 'done');
}

const assigneeItems = computed<DropItem[]>(() => [
  { label: 'Unassigned', value: '' },
  ...team.value.map(person => ({ label: person.name, value: person.id })),
]);

function editEstimate() {
  points.value = String(props.issue.points);
  editing.value = true;
  nextTick(() => estimate.value?.select());
}

async function saveEstimate() {
  if (!editing.value) return;
  editing.value = false;
  const value = String(points.value).trim();
  if (!value || Number(value) === props.issue.points) return;
  await ctx.exec(cli(['mgr', 'backlog', 'edit', props.issue.id], { '--points': value }), {
    success: `Story point estimate for ${props.issue.id} updated`,
  });
}

const menu = computed<DropItem[]>(() => [
  props.inSprint
    ? { label: 'Move to Backlog', value: 'backlog', section: 'Move to' }
    : { label: `Move to ${sprintName(sprint.value.n)}`, value: 'sprint', section: 'Move to',
        disabled: props.issue.status === 'done', hint: 'Done work is not planned again' },
  { label: 'Open issue', value: 'open' },
  { label: 'Delete', value: 'delete', danger: true },
]);

async function onMenu(value: string) {
  if (value === 'sprint') await addToSprint([props.issue.id]);
  else if (value === 'backlog') await moveToBacklog([props.issue.id]);
  else if (value === 'open') ctx.openIssue(props.issue.id);
  else if (value === 'delete') await deleteIssue(props.issue);
}
</script>

<style scoped>
.br {
  display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 8px 0 4px;
  background: var(--j-surface); box-shadow: 0 1px 0 var(--j-border); cursor: grab;
}
.br:hover { background: #F8F8F8; }
.br:first-child { border-radius: 3px 3px 0 0; }
.br:last-child { border-radius: 0 0 3px 3px; }
.br__grip { color: var(--j-text-subtlest); opacity: 0; display: inline-flex; }
.br:hover .br__grip { opacity: 1; }
.br__key { border: 0; background: none; padding: 0; cursor: pointer; }
.br__key:hover { text-decoration: underline; color: var(--j-link); }
.br__summary {
  flex: 1; min-width: 80px; border: 0; background: none; padding: 0; text-align: left; font: inherit; color: var(--j-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;
}
.br__summary:hover { text-decoration: underline; }
.is-done .br__summary { color: var(--j-text-subtle); }
.br__label {
  padding: 0 4px; border-radius: 3px; background: #EED7FC; color: #803FA5; font-size: 12px; font-weight: 700;
  text-transform: uppercase; line-height: 16px; white-space: nowrap;
}
.br__kr { font-size: 12px; font-weight: 700; color: #216E4E; background: #DCFFF1; padding: 0 4px; border-radius: 3px; line-height: 16px; }
.br :deep(.br__status) { gap: 2px; padding: 2px 4px; border-radius: 3px; }
.br :deep(.br__status:hover) { background: var(--j-neutral-hover); }
.br__points { border: 0; cursor: pointer; font-family: inherit; }
.br__points:hover:not(:disabled) { background: #C1C4CA; }
.br__points:disabled { cursor: default; }
.br__est .j-input { width: 64px; min-height: 26px; height: 26px; padding: 2px 6px; }
.br :deep(.br__assignee) { border-radius: 50%; }
.br :deep(.br__more) { width: 28px; height: 28px; justify-content: center; border-radius: 3px; color: var(--j-text-subtle); }
.br :deep(.br__more:hover) { background: var(--j-neutral-hover); }
@container sl-portal (max-width: 700px) {
  .br { flex-wrap: wrap; padding: 6px 8px; row-gap: 4px; }
  .br__summary { flex-basis: calc(100% - 90px); white-space: normal; }
  .br__label, .br__kr, .br__grip { display: none; }
  .br__key, .br__summary { min-height: 32px; }
  .br :deep(.br__status), .br :deep(.br__assignee), .br :deep(.br__more) { min-height: 32px; min-width: 32px; justify-content: center; }
  .br .br__points.j-points { height: 28px; min-width: 28px; line-height: 28px; border-radius: 14px; }
}
</style>
