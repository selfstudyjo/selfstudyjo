<template>
  <div class="sl-tasks">
    <div class="sl-tasks__head">
      <div>
        <h3 class="sl-tasks__title">{{ $t('Tasks') }}</h3>
        <p class="sl-tasks__count">
          {{ $t('{v0} of {v1} done', { v0: grade.done, v1: grade.total }) }}
        </p>
      </div>
      <div class="sl-tasks__head-actions">
        <!--
          READ THE OBJECTIVES ALOUD.

          One control for the whole list rather than one per task: a task is a
          single line, and a fourth button on a card that already carries Hint,
          Ask the tutor and I have done this is clutter on the one row a student
          works from. What is read is each task's title and its detail -- the
          detail is where the requirement actually is (`local.full_name = ...`),
          the title being only a label -- and the HINTS are left out, because a
          hint is a thing somebody chooses to reveal and reading them all aloud
          would hand over every answer in the lab to anybody who pressed play.
        -->
        <ReadAloud v-if="spokenTasks.length" id="lab-tasks"
                   :parts="spokenTasks" :title="$t('Tasks')" compact />
        <button type="button" class="sl-btn sl-btn--primary sl-btn--sm"
                :disabled="busy" @click="$emit('grade')">
          <CheckCheck class="sl-i" />
          {{ busy ? $t('Checking...') : $t('Check my work') }}
        </button>
      </div>
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

    <!--
      WHAT CHECK MY WORK JUST DID, in words.

      The button had no outcome a reader could see. Three of the four things it
      can do are invisible — the grade not moving, every task in the lab being
      self-marked so it can never move, and the lab service not answering (which
      `labsService.gradeLab` swallows on purpose so the tools keep working) — and
      all three produced the identical nothing. `gradeReport` in
      `labCatalogue.ts` decides the sentence; this draws it.

      `role="status"`, so a screen reader hears it without the focus moving: the
      student pressed a button and the answer belongs to that press.
    -->
    <p v-if="report" class="sl-tasks__feedback"
       :class="`sl-tasks__feedback--${report.tone}`" role="status">
      {{ $t(report.key, report.params) }}
    </p>

    <!--
      A lab whose every task is self-marked says so ONCE, at the top, rather
      than leaving a student to press a button that cannot move. The whole
      Networking track is like this: the Network Simulator is app 27 and this
      service cannot see inside its topology, so the honest check is to ask.
    -->
    <p v-else-if="allManual" class="sl-tasks__feedback sl-tasks__feedback--quiet">
      {{ $t('You mark these tasks yourself — this lab cannot inspect them for you.') }}
    </p>

    <ol class="sl-tasks__list">
      <li v-for="(task, at) in grade.tasks" :key="task.id" class="sl-task"
          :class="`sl-task--${task.status}`">
        <div class="sl-task__mark" aria-hidden="true">
          <Check v-if="task.status === 'passed'" class="sl-i" />
          <AlertTriangle v-else-if="task.status === 'unavailable'" class="sl-i" />
          <Circle v-else class="sl-i" />
        </div>
        <div class="sl-task__body">
          <p class="sl-task__title">
            <span class="sl-task__title-text">{{ task.title }}</span>
            <span class="sl-task__points">{{ task.points }}</span>
            <!--
              THE "i": how to do this task, step by step, in a window. On the
              title row rather than among the actions, because it is the first
              thing somebody stuck on a task looks for - and it changes nothing,
              so a task that is done stays done however often it is opened.
            -->
            <button type="button" class="sl-task__info"
                    :title="$t('How to do this task')"
                    :aria-label="$t('How to do this task: {v0}', { v0: task.title })"
                    @click="infoAt = at">
              <Info class="sl-i" aria-hidden="true" />
            </button>
          </p>
          <!--
            WHAT TO DO, IN FULL. A title and a one-line detail were not enough
            to act on ("Compare a row against an aggregate"), so every task
            carries a goal, numbered steps and the exact thing the grader
            verifies - visible on the card, not behind a click. The steps are
            open on the task the student is working on (the first not done)
            and one press away on the others, so twelve cards do not become a
            wall of text.
          -->
          <div v-if="task.instructions" class="sl-task__plan">
            <p class="sl-task__goal">
              <span class="sl-task__label">{{ $t('Goal') }}</span>
              <span class="sl-task__text">{{ task.instructions.goal }}</span>
            </p>
            <template v-if="task.instructions.steps.length">
              <ol v-if="stepsOpen(task, at)" class="sl-task__steps">
                <li v-for="(step, n) in task.instructions.steps" :key="n">{{ step }}</li>
              </ol>
              <button type="button" class="sl-task__steps-toggle"
                      :aria-expanded="stepsOpen(task, at)" @click="toggleSteps(task, at)">
                <ChevronDown v-if="!stepsOpen(task, at)" class="sl-i" aria-hidden="true" />
                <ChevronUp v-else class="sl-i" aria-hidden="true" />
                {{ stepsOpen(task, at)
                  ? $t('Hide the steps')
                  : $t('Show the {v0} steps', { v0: task.instructions.steps.length }) }}
              </button>
            </template>
            <p v-if="task.instructions.done_when" class="sl-task__done">
              <span class="sl-task__label">{{ $t('Done when') }}</span>
              <span class="sl-task__text">{{ task.instructions.done_when }}</span>
            </p>
            <!--
              USE THE AI. Said on every task that is not done, with a question
              worth asking about THIS task, because a student who is stuck and
              does not ask learns nothing - and the tutor gives a nudge, not
              the answer.
            -->
            <p v-if="task.status !== 'passed' && task.instructions.ask_ai" class="sl-task__ai">
              <Sparkles class="sl-i" aria-hidden="true" />
              <span>
                {{ $t('Stuck, or curious? Ask the AI tutor - for example:') }}
                <button type="button" class="sl-task__ai-ask"
                        @click="$emit('ask', task, task.instructions.ask_ai)">"{{ task.instructions.ask_ai }}"</button>
              </span>
            </p>
          </div>
          <p v-else-if="task.detail" class="sl-task__detail">{{ task.detail }}</p>

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
            <span v-if="task.kept" class="sl-task__note">{{ $t('Verified earlier - it stays done.') }}</span>
            <!-- The grader's raw note ("nothing at images.repository") is
                 jargon beside a written "Done when", so with instructions it
                 lives in the "i" window - except when it says something the
                 student must know (the task was already true at the start). -->
            <span v-else-if="isBaseline(task)" class="sl-task__note">{{ $t('This was already true when you started, so it does not count yet. Do the step yourself - edit the file or run the command - and it will.') }}</span>
            <span v-else-if="task.note && showNote(task)" class="sl-task__note">{{ task.note }}</span>
          </p>

          <!--
            WHERE THIS TASK CAN BE DONE. A portal writes by running the same
            command line the console accepts, so a task the grader says a
            portal can reach is done equally well in either - and saying so is
            the difference between a GUI a student uses and one they never
            open because the brief only ever showed commands. Only drawn in a
            lab that HAS a portal; a terminal-only lab needs no sentence about it.
          -->
          <p v-if="hasPortals && task.gui && task.status !== 'passed'" class="sl-task__route">
            <template v-if="guiFor(task).length">
              <MonitorSmartphone class="sl-i" aria-hidden="true" />
              <span>{{ $t('You can do this in the GUI or in the terminal:') }}</span>
              <button v-for="tool in guiFor(task)" :key="tool.id" type="button"
                      class="sl-btn sl-btn--ghost sl-btn--sm"
                      @click="$emit('open-tool', tool.id)">{{ tool.label }}</button>
            </template>
            <template v-else>
              <TerminalSquare class="sl-i" aria-hidden="true" />
              <span>{{ $t('Do this one in the terminal or the Files tool.') }}</span>
            </template>
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

              A BUTTON, not a checkbox, and it disappears once it is done.
              A checkbox reads as a preference that can be unticked, and this one
              cannot be: `tasks_done` is joined by union on both the environment
              and the replicated record, so an untick is discarded in silence.
              Offering a control that looks reversible and is not is worse than
              a one-way one. As a small trailing label it was also the least
              visible thing on a card whose ONLY way forward it is, in a track
              where every single task is marked this way.
            -->
            <button v-if="task.manual && task.status !== 'passed'" type="button"
                    class="sl-btn sl-btn--primary sl-btn--sm sl-task__self"
                    :disabled="busy"
                    @click="$emit('self-mark', task.id)">
              <Check class="sl-i" /> {{ $t('I have done this') }}
            </button>
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

    <LabTaskGuide :task="infoTask" :index="infoAt ?? 0" :total="grade.tasks.length"
                  :tools="tools || []" @close="infoAt = null"
                  @ask="(task, focus) => $emit('ask', task, focus)"
                  @open-tool="id => $emit('open-tool', id)"
                  @self-mark="id => $emit('self-mark', id)" />
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
import { computed, ref } from 'vue';
import {
  AlertTriangle, Check, CheckCheck, ChevronDown, ChevronUp, Circle, Info, Lightbulb,
  MonitorSmartphone, Sparkles, TerminalSquare,
} from 'lucide-vue-next';
import ReadAloud from '@/components/ReadAloud.vue';
import LabTaskGuide from '@/components/labs/LabTaskGuide.vue';
import {
  TASK_STATUS_LABELS, guiToolsFor, type GradeReport, type LabGrade, type LabTask,
  type LabTool, type TaskStatus,
} from '@/utils/labCatalogue';

const props = defineProps<{
  grade: LabGrade;
  busy?: boolean;
  /** What the last grading run did. See `gradeReport`. */
  report?: GradeReport | null;
  /** The lab's tools, so a task can name the portal it can be done in. */
  tools?: LabTool[];
}>();

const hasPortals = computed(() => (props.tools || []).some(tool => tool.kind === 'portal'));
function guiFor(task: LabTask): LabTool[] {
  return guiToolsFor(task, props.tools || []);
}

/**
 * The task list as something a voice can read: each title, then its detail.
 *
 * NUMBERED, because a spoken list with no numbers is a paragraph -- and these
 * are steps, so a student listening needs to know which one they are on. The
 * numbering is the position in the list rather than anything stored, which is
 * what the screen shows too (`<ol>`).
 *
 * The HINTS are deliberately absent. A hint is revealed one at a time by a
 * student who chose to ask for it; reading them all aloud would hand over every
 * answer in the lab to anybody who pressed play, which is the same line
 * `_generate_lesson_content.py` refuses to cross for an exam paper.
 */
const spokenTasks = computed(() => props.grade.tasks.flatMap((task, at) => {
  const lines = [`${at + 1}. ${task.title}`];
  // The goal is the requirement in full; the detail was often a fragment.
  const goal = task.instructions?.goal || task.detail;
  if (goal) lines.push(goal);
  return lines;
}));
defineEmits<{
  (event: 'grade'): void;
  (event: 'ask', task: LabTask, focus?: string): void;
  (event: 'self-mark', taskId: string): void;
  (event: 'open-tool', toolId: string): void;
}>();

const open = ref(new Set<string>());
const showChecks = ref(false);
/**
 * Which task's information window is open, by POSITION in the live grade, so
 * the window shows the task as it is now - a Check my work while it is open
 * updates its status in place rather than leaving a stale copy on screen.
 */
const infoAt = ref<number | null>(null);

/**
 * Whose steps are open. By default the CURRENT task's - the first one not
 * done - so the student always sees how to do the next thing; a press opens
 * or closes any other. Keyed on the id, so a Check my work that moves the
 * current task along does not shut a card the student opened deliberately.
 */
const stepsToggled = ref(new Map<string, boolean>());
const currentAt = computed(() => props.grade.tasks.findIndex(task => task.status !== 'passed'));
function stepsOpen(task: LabTask, at: number): boolean {
  const chosen = stepsToggled.value.get(task.id);
  return chosen === undefined ? at === currentAt.value : chosen;
}
function toggleSteps(task: LabTask, at: number) {
  const next = new Map(stepsToggled.value);
  next.set(task.id, !stepsOpen(task, at));
  stepsToggled.value = next;
}
const infoTask = computed<LabTask | null>(() =>
  (infoAt.value === null ? null : props.grade.tasks[infoAt.value] || null));

/** Is there anything here Check my work could ever move on its own? */
const allManual = computed(() => props.grade.tasks.length > 0
  && props.grade.tasks.every(task => task.manual));

function toggle(id: string) {
  const next = new Set(open.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  open.value = next;
}

function isBaseline(task: LabTask): boolean {
  return task.status === 'pending' && /^already true/i.test(task.note || '');
}
function showNote(task: LabTask): boolean {
  return !task.instructions?.done_when || task.status === 'unavailable';
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
