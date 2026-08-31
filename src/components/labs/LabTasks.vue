<template>
  <div class="sl-tasks">
    <div class="sl-tasks__head">
      <div>
        <h3 class="sl-tasks__title">{{ $t('Tasks') }}</h3>
        <p class="sl-tasks__count">
          {{ $t('{v0} of {v1} done', { v0: grade.done, v1: grade.total }) }}
        </p>
      </div>
      <button type="button" class="sl-btn sl-btn--primary sl-btn--sm"
              :disabled="busy" @click="$emit('grade')">
        <CheckCheck class="sl-i" />
        {{ busy ? $t('Checking...') : $t('Check my work') }}
      </button>
    </div>

    <!-- The meter, and the reason it is a meter rather than a number.
         A task list with a bar reads as progress; twelve rows with ticks reads
         as a checklist somebody has to count. -->
    <div class="sl-meter" role="progressbar" :aria-valuenow="grade.percent"
         aria-valuemin="0" aria-valuemax="100" dir="ltr">
      <div class="sl-meter__fill" :style="{ width: grade.percent + '%' }"></div>
    </div>
    <p class="sl-tasks__points">
      {{ $t('{v0} of {v1} points', { v0: grade.earned, v1: grade.possible }) }}
    </p>

    <ol class="sl-tasks__list">
      <li v-for="task in grade.tasks" :key="task.id" class="sl-task"
          :class="`sl-task--${task.status}`">
        <div class="sl-task__mark" aria-hidden="true">
          <Check v-if="task.status === 'passed'" class="sl-i" />
          <AlertTriangle v-else-if="task.status === 'unavailable'" class="sl-i" />
          <Circle v-else class="sl-i" />
        </div>
        <div class="sl-task__body">
          <p class="sl-task__title">
            {{ task.title }}
            <span class="sl-task__points">{{ task.points }}</span>
          </p>
          <p v-if="task.detail" class="sl-task__detail">{{ task.detail }}</p>

          <!--
            The status LINE is always visible text, never colour alone.

            In several galaxies two of the three accents are within a few dE of
            each other, and in Triangulum `accent` and `accent-2` are the same
            colour to a deuteranope - so a task whose only signal is a green or
            amber mark has no signal at all for some readers. Working rule 37.
          -->
          <p class="sl-task__state">
            <span class="sl-badge" :class="`sl-badge--${badge(task.status)}`">
              {{ $t(statusLabel(task.status)) }}
            </span>
            <span v-if="task.note" class="sl-task__note">{{ task.note }}</span>
          </p>

          <p v-if="task.status === 'unavailable'" class="sl-task__warn">
            {{ $t('This lab cannot check that here. Tell an operator - the task names an environment the lab does not provide.') }}
          </p>

          <div class="sl-task__actions">
            <button v-if="task.hint" type="button"
                    class="sl-btn sl-btn--ghost sl-btn--sm"
                    @click="toggle(task.id)">
              <Lightbulb class="sl-i" />
              {{ open.has(task.id) ? $t('Hide hint') : $t('Hint') }}
            </button>
            <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                    @click="$emit('ask', task)">
              <Sparkles class="sl-i" /> {{ $t('Ask the tutor') }}
            </button>
            <!--
              Self-marking is offered ONLY for a task the lab declared manual.

              Not for a `state` check that has not passed: a student who could
              tick that would be telling the platform they had done something the
              environment says they have not, and the whole point of grading
              against the environment is that it cannot be talked out of.
            -->
            <label v-if="task.manual" class="sl-task__self">
              <input type="checkbox" :checked="task.status === 'passed'"
                     @change="$emit('self-mark', task.id)">
              {{ $t('I have done this') }}
            </label>
          </div>

          <p v-if="open.has(task.id)" class="sl-task__hint">{{ task.hint }}</p>
          <p v-if="showChecks" class="sl-task__requires" dir="ltr">
            {{ $t('Checked by') }}: {{ task.requires }}
          </p>
        </div>
      </li>
    </ol>

    <p v-if="grade.tasks.length === 0" class="sl-tasks__empty">
      {{ $t('This lab has no tasks yet.') }}
    </p>

    <label class="sl-tasks__reveal">
      <input v-model="showChecks" type="checkbox">
      {{ $t('Show what each task checks') }}
    </label>
  </div>
</template>

<script setup lang="ts">
/**
 * The task list, with the grade.
 *
 * Every task carries **three** states and not two: done, to do, and *cannot be
 * checked* - the last when the lab's own manifest names an environment none of
 * its tools provides. Collapsing that into "to do" would tell a student they had
 * not done something they cannot do, which is the one answer worse than an
 * error. `utils/labgrade.py` answers the three; this draws them.
 */
import { ref } from 'vue';
import {
  AlertTriangle, Check, CheckCheck, Circle, Lightbulb, Sparkles,
} from 'lucide-vue-next';
import { TASK_STATUS_LABELS, type LabGrade, type LabTask, type TaskStatus }
  from '@/utils/labCatalogue';

defineProps<{ grade: LabGrade; busy?: boolean }>();
defineEmits<{
  (event: 'grade'): void;
  (event: 'ask', task: LabTask): void;
  (event: 'self-mark', taskId: string): void;
}>();

const open = ref(new Set<string>());
const showChecks = ref(false);

function toggle(id: string) {
  const next = new Set(open.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  open.value = next;
}

function statusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status] || String(status);
}

function badge(status: TaskStatus): string {
  if (status === 'passed') return 'good';
  if (status === 'unavailable') return 'bad';
  return 'warn';
}
</script>
