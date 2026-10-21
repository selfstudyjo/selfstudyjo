<template>
  <JiraModal :title="'Edit sprint: ' + sprintName(sprint.n)" width="small" @close="$emit('close')">
    <form id="jse-form" @submit.prevent="save">
      <div class="j-field"><label class="j-label" for="jse-name">Sprint name</label>
        <input id="jse-name" class="j-input" :value="sprintName(sprint.n)" disabled />
        <span class="j-help">Sprints are numbered by the simulation, one per `mgr advance`.</span></div>
      <div class="j-field"><label class="j-label" for="jse-dur">Duration</label>
        <input id="jse-dur" class="j-input" :value="days + ' days'" disabled /></div>
      <div class="j-field"><label class="j-label" for="jse-goal">Sprint goal</label>
        <textarea id="jse-goal" v-model="goal" class="j-textarea" rows="3" maxlength="300" autofocus /></div>
    </form>
    <template #footer>
      <button type="button" class="j-btn j-btn--subtle" @click="$emit('close')">Cancel</button>
      <button type="submit" form="jse-form" class="j-btn j-btn--primary" :disabled="busy || goal.trim() === sprint.goal">Update</button>
    </template>
  </JiraModal>
</template>

<script setup lang="ts">
/** Jira's "Edit sprint" dialog. Only the goal is the student's to change: `mgr sprint goal`. */
import { computed, ref } from 'vue';
import { cli, pick } from '@/utils/portalKit';
import JiraModal from './JiraModal.vue';
import { sprintName } from './jiraKit';
import { useJira } from './useJira';

const emit = defineEmits<{ (event: 'close'): void }>();
const { ctx, sprint } = useJira();
const busy = ctx.busy;
const goal = ref(sprint.value.goal);
const days = computed(() => Number(pick(ctx.view.value, 'org.sprint_days', 14)));

async function save() {
  const text = goal.value.trim();
  // cli() omits an empty value, so clearing the goal is spelled out: --goal ''
  const command = text ? cli(['mgr', 'sprint', 'goal'], { '--goal': text }) : cli(['mgr', 'sprint', 'goal']) + " --goal ''";
  const result = await ctx.exec(command, { success: `${sprintName(sprint.value.n)} updated` });
  if (result.ok) emit('close');
}
</script>
