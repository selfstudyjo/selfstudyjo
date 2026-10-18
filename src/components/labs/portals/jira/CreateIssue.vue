<template>
  <JiraModal title="Create issue" width="medium" @close="$emit('close')">
    <template #head-actions>
      <span class="ci__import j-small">Required fields are marked with an asterisk <span class="j-req">*</span></span>
    </template>
    <div v-if="error" class="j-msg j-msg--error"><JiraIcon name="error" :size="20" />
      <div><div class="j-msg__title">We couldn't create the issue</div>{{ error }}</div></div>
    <form id="ci-form" class="ci" novalidate @submit.prevent="submit">
      <div class="j-field">
        <label class="j-label" for="ci-project">Project<span class="j-req">*</span></label>
        <select id="ci-project" class="j-select" disabled><option>Platform (PLAT)</option></select>
      </div>
      <div class="j-field ci__narrow">
        <label class="j-label" for="ci-type">Issue type<span class="j-req">*</span></label>
        <select id="ci-type" v-model="form.type" class="j-select">
          <option value="story">Story</option><option value="task">Task</option><option value="bug">Bug</option>
        </select>
        <a class="j-help" href="#" @click.prevent>Learn about issue types</a>
      </div>
      <hr class="ci__rule" />
      <div class="j-field ci__narrow">
        <span class="j-label">Status</span>
        <span><span class="j-lozenge j-lozenge--todo">To Do</span></span>
        <span class="j-help">This is the issue's initial status upon creation</span>
      </div>
      <div class="j-field">
        <label class="j-label" for="ci-summary">Summary<span class="j-req">*</span></label>
        <input id="ci-summary" v-model="form.title" class="j-input" :class="{ 'is-invalid': tried && !form.title.trim() }"
               type="text" maxlength="255" autofocus />
        <span v-if="tried && !form.title.trim()" class="j-error"><JiraIcon name="error" :size="14" />Summary is required</span>
      </div>
      <div class="j-field">
        <label class="j-label" for="ci-description">Description</label>
        <textarea id="ci-description" v-model="form.description" class="j-textarea" rows="4"
                  placeholder="Add a description…" />
      </div>
      <div class="j-field ci__narrow">
        <label class="j-label" for="ci-assignee">Assignee</label>
        <select id="ci-assignee" v-model="form.assignee" class="j-select">
          <option value="">Unassigned</option>
          <option v-for="person in team" :key="person.id" :value="person.id">{{ person.name }}</option>
        </select>
        <span v-if="skillNote" class="j-help">{{ skillNote }}</span>
      </div>
      <div class="j-field ci__narrow">
        <label class="j-label" for="ci-labels">Labels</label>
        <select id="ci-labels" v-model="form.skill" class="j-select">
          <option v-for="skill in skills" :key="skill" :value="skill">{{ skill }}</option>
        </select>
        <span class="j-help">The skill the work needs. Somebody untried in it costs more points to deliver.</span>
      </div>
      <div class="j-field ci__narrow">
        <label class="j-label" for="ci-points">Story point estimate</label>
        <input id="ci-points" v-model="form.points" class="j-input" :class="{ 'is-invalid': pointsError }"
               type="number" min="0" max="100" />
        <span v-if="pointsError" class="j-error"><JiraIcon name="error" :size="14" />{{ pointsError }}</span>
      </div>
      <div class="j-field ci__narrow">
        <label class="j-label" for="ci-priority">Priority</label>
        <select id="ci-priority" v-model="form.value" class="j-select">
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <span class="j-help">Delivery works through a sprint highest priority first.</span>
      </div>
      <div class="j-field ci__narrow">
        <label class="j-label" for="ci-sprint">Sprint</label>
        <select id="ci-sprint" v-model="form.sprint" class="j-select">
          <option :value="false">None (backlog)</option>
          <option :value="true">{{ sprintName(sprint.n) }}</option>
        </select>
      </div>
      <div class="j-field ci__narrow">
        <label class="j-label" for="ci-kr">Key result</label>
        <select id="ci-kr" v-model="form.kr" class="j-select">
          <option value="">None</option>
          <option v-for="kr in krs" :key="kr.id" :value="kr.id">{{ kr.id }} · {{ kr.text }}</option>
        </select>
      </div>
      <div class="j-field ci__narrow">
        <span class="j-label">Reporter</span>
        <span class="ci__reporter"><JiraAvatar name="You Manager" :size="24" /> You</span>
      </div>
    </form>
    <template #footer>
      <label class="j-check ci__another"><input v-model="another" type="checkbox" /> Create another</label>
      <button type="button" class="j-btn j-btn--subtle" @click="$emit('close')">Cancel</button>
      <button type="submit" form="ci-form" class="j-btn j-btn--primary" :disabled="saving">Create</button>
    </template>
  </JiraModal>
</template>

<script setup lang="ts">
/** The global "Create issue" dialog, with Jira's field names and order. */
import { computed, reactive, ref } from 'vue';
import { cli, errorText, pick, rows } from '@/utils/portalKit';
import JiraModal from './JiraModal.vue';
import JiraIcon from './JiraIcon.vue';
import JiraAvatar from './JiraAvatar.vue';
import { createdKey, sprintName } from './jiraKit';
import { useJira } from './useJira';

const props = defineProps<{ preset: Record<string, any> }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const { ctx, team, sprint, addToSprint } = useJira();

const skills = computed(() => {
  const list = pick<string[]>(ctx.view.value, 'skills', []);
  return list.length ? list : ['azure', 'terraform', 'networking', 'python', 'leadership', 'data'];
});
const krs = computed(() => rows<Record<string, any>>(ctx.view.value, 'objectives')
  .flatMap(objective => (objective.krs || []) as { id: string; text: string }[]));

function blank() {
  return {
    type: 'story', title: '', description: '', assignee: '', skill: 'azure', points: '5',
    value: 'medium', sprint: Boolean(props.preset.sprint), kr: '',
  };
}
const form = reactive(blank());
const another = ref(false);
const tried = ref(false);
const saving = ref(false);
const error = ref('');

const pointsError = computed(() => {
  const value = String(form.points).trim();
  if (value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 && Number.isInteger(n) ? '' : 'Enter a whole number from 0 to 100';
});

const skillNote = computed(() => {
  const person = team.value.find(p => p.id === form.assignee);
  if (!person) return '';
  const level = Number(person.skill_levels?.[form.skill] || 0);
  return level ? `${person.name.split(' ')[0]} is level ${level} in ${form.skill}.`
    : `${person.name.split(' ')[0]} has never worked in ${form.skill} — a stretch assignment.`;
});

async function submit() {
  tried.value = true;
  error.value = '';
  if (!form.title.trim() || pointsError.value) return;
  saving.value = true;
  try {
    const result = await ctx.exec(cli(['mgr', 'backlog', 'add'], {
      '--title': form.title.trim(), '--type': form.type, '--description': form.description.trim(),
      '--points': String(form.points).trim() || '0', '--skill': form.skill, '--value': form.value,
      '--assignee': form.assignee,
    }), { success: '', quiet: true });
    if (!result.ok) {
      error.value = errorText(result);
      return;
    }
    const key = createdKey(result);
    if (key && form.kr) {
      await ctx.exec(cli(['mgr', 'link', key], { '--kr': form.kr }), { success: '' });
    }
    if (key && form.sprint) await addToSprint([key]);
    ctx.flag('success', `${key} has been created`, form.title.trim());
    if (another.value) {
      Object.assign(form, { ...blank(), type: form.type, skill: form.skill, sprint: form.sprint });
      tried.value = false;
    } else {
      emit('close');
    }
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.ci__import { margin-right: 8px; }
.ci__narrow { max-width: 340px; }
.ci__rule { border: 0; border-top: 1px solid var(--j-border); margin: 4px 0 16px; }
.ci__reporter { display: inline-flex; align-items: center; gap: 8px; }
.ci__another { margin-right: auto; color: var(--j-text-subtle); }
@container sl-portal (max-width: 560px) { .ci__import { display: none; } .ci__narrow { max-width: none; } }
</style>
