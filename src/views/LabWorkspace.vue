<template>
  <div class="sl-workspace">
    <div v-if="loading" class="sl-loading">
      <div class="sl-spinner"></div>
      <p>{{ $t('Opening the lab...') }}</p>
    </div>

    <div v-else-if="!hasLabAccess" class="sl-gate">
      <FlaskConical class="sl-i sl-i--lg" />
      <h3>{{ $t('No Lab Access') }}</h3>
      <p>{{ $t('Your plan does not include the labs. Add the lab feature to your subscription to open every track.') }}</p>
      <router-link to="/plans" class="sl-btn sl-btn--primary">
        <Crown class="sl-i" /> {{ $t('View Plans') }}
      </router-link>
    </div>

    <div v-else-if="error" class="sl-gate">
      <AlertTriangle class="sl-i sl-i--lg" />
      <h3>{{ $t('This lab could not be opened') }}</h3>
      <p>{{ error }}</p>
      <div class="sl-gate__actions">
        <button type="button" class="sl-btn sl-btn--primary" @click="open">
          <RotateCw class="sl-i" /> {{ $t('Try Again') }}
        </button>
        <router-link to="/labs" class="sl-btn sl-btn--ghost">
          {{ $t('Back to the labs') }}
        </router-link>
      </div>
    </div>

    <template v-else-if="lab">
      <header class="sl-wshead">
        <nav class="sl-crumbs" aria-label="Breadcrumb">
          <router-link to="/labs">{{ $t('Labs') }}</router-link>
          <span aria-hidden="true">/</span>
          <router-link :to="`/labs?track=${lab.track}`">{{ trackTitle }}</router-link>
        </nav>
        <div class="sl-wshead__row">
          <div>
            <h1 class="sl-wshead__title">{{ $td(lab, 'title') }}</h1>
            <p class="sl-wshead__sub">{{ $td(lab, 'summary') }}</p>
          </div>
          <div class="sl-wshead__actions">
            <span class="sl-badge" :class="`sl-badge--${statusBadge}`">
              {{ $t(statusLabel) }}
            </span>
            <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm"
                    :disabled="busy" @click="reset">
              <RotateCcw class="sl-i" /> {{ $t('Reset environment') }}
            </button>
          </div>
        </div>
        <p v-if="note" class="sl-wshead__note">{{ note }}</p>
        <p v-if="lab.unknown_tools.length" class="sl-wshead__warn">
          {{ $t('This lab asks for a tool this version does not have: {v0}. It has been left out.', { v0: lab.unknown_tools.join(', ') }) }}
        </p>
      </header>

      <div class="sl-wsbody">
        <!-- The workbench -->
        <section class="sl-bench">
          <div class="sl-bench__tabs" role="tablist">
            <button
              v-for="pane in panes"
              :key="pane.family"
              type="button"
              role="tab"
              class="sl-bench__tab"
              :class="{ 'is-active': activePane === pane.family }"
              :aria-selected="activePane === pane.family"
              @click="activePane = pane.family"
            >
              {{ $t(pane.label) }}
              <span v-if="pane.simulated" class="sl-bench__dot" :title="$t('Simulated')"></span>
            </button>
            <button
              type="button"
              role="tab"
              class="sl-bench__tab"
              :class="{ 'is-active': activePane === '__brief' }"
              :aria-selected="activePane === '__brief'"
              @click="activePane = '__brief'"
            >{{ $t('Brief') }}</button>
          </div>

          <div v-if="activePane === '__brief'" class="sl-bench__panel">
            <LabBrief :text="$td(lab, 'brief')" />
            <div v-if="lab.objectives.length" class="sl-objectives">
              <h4>{{ $t('By the end of this lab') }}</h4>
              <ul>
                <li v-for="(item, index) in lab.objectives" :key="index">{{ item }}</li>
              </ul>
            </div>
          </div>

          <!-- `<template v-for>` with the `v-if` INSIDE, not `v-for` beside a
               `v-else-if`. Vue resolves `v-if` before `v-for` on the same
               element, so the condition cannot see the loop variable and the
               whole workbench fails to compile. -->
          <template v-for="pane in panes" :key="pane.family">
          <div v-if="activePane === pane.family" class="sl-bench__panel">
            <!-- Which tool inside the pane. A Big Data pane has nine; a Docker
                 pane has three. Drawn as one row of small buttons rather than as
                 nine top-level tabs, which is unreadable. -->
            <div v-if="pane.tools.length > 1" class="sl-bench__tools">
              <button
                v-for="tool in pane.tools"
                :key="tool.id"
                type="button"
                class="sl-bench__tool"
                :class="{ 'is-active': activeTool(pane.family) === tool.id }"
                @click="pickTool(pane.family, tool.id)"
              >{{ $t(tool.label) }}</button>
            </div>

            <template v-for="tool in pane.tools" :key="tool.id">
              <template v-if="activeTool(pane.family) === tool.id">
                <LabConsole
                  v-if="tool.kind === 'console'"
                  :tool="tool"
                  :hint="consoleHint(tool)"
                  :run="line => runTool(tool.id, { command: line })"
                />
                <LabCode
                  v-else-if="tool.kind === 'code'"
                  :tool="tool"
                  :run="code => runTool(tool.id, { code })"
                  :stop-run="stopProcess"
                />
                <LabQuery
                  v-else-if="tool.kind === 'query'"
                  :tool="tool"
                  :run="statement => runTool(tool.id, { query: statement })"
                />
                <LabFiles
                  v-else-if="tool.kind === 'editor'"
                  ref="filesPane"
                  :list="listFiles"
                  :read="readFile"
                  :write="writeFile"
                  :remove="deleteFile"
                  @changed="refreshViews"
                />
                <LabWeb
                  v-else-if="tool.kind === 'web'"
                  :initial="webSource"
                  :save="saveWeb"
                />
                <LabGui
                  v-else-if="tool.kind === 'gui'"
                  :family="pane.family"
                  :tools="lab.tools"
                  :view="views[pane.family] || {}"
                  :title="tool.label"
                  :busy="viewsBusy"
                  @refresh="refreshViews"
                />
                <div v-else-if="tool.kind === 'external'" class="sl-external">
                  <p>{{ tool.summary }}</p>
                  <a v-if="tool.href" :href="`#${tool.href}`"
                     class="sl-btn sl-btn--primary">
                    {{ $t('Open') }} {{ $t(tool.label) }}
                  </a>
                </div>
                <LabTutor
                  v-else-if="tool.kind === 'ai'"
                  ref="tutor"
                  :lab="lab"
                  :load-context="loadContext"
                />
              </template>
            </template>
          </div>
          </template>
        </section>

        <!-- The tasks -->
        <aside class="sl-side">
          <LabTasks
            :grade="grade"
            :busy="grading"
            @grade="grade0"
            @ask="askTutor"
            @self-mark="selfMark"
          />
          <div v-if="lab.datasets.length" class="sl-side__datasets">
            <h4>{{ $t('Datasets in this lab') }}</h4>
            <ul>
              <li v-for="name in lab.datasets" :key="name" dir="ltr">{{ name }}</li>
            </ul>
            <p class="sl-side__hint">
              {{ $t('Built for you on this replica. Real rows, real answers.') }}
            </p>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * One lab: the workbench, the brief and the tasks.
 *
 * The page is deliberately one route rather than a tab inside `/labs`, for the
 * reason the Labs page's three sandboxes needed routes of their own: a lab is a
 * place, so a reload lands back in it and a student can send a classmate the lab
 * they are stuck on.
 *
 * Three decisions worth not undoing:
 *
 * **`openLab` is ONE call.** It seeds the environment, returns the lab, its
 * tools, the grade and every GUI view. Four requests would be four round trips
 * to a PythonAnywhere worker whose first answer of the day is ~20 seconds.
 *
 * **The views are refreshed after a command that could have changed them, not on
 * a timer.** A poll would be a request every few seconds per open tab for a
 * state that only this reader can change; refreshing after their own command is
 * both cheaper and always right.
 *
 * **Grading is manual.** A lab that graded after every command would send a
 * request per keystroke-ful of typing and would tick a task off mid-thought.
 * `Check my work` is the same shape as `terraform plan` - the student decides
 * when to look.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  AlertTriangle, Crown, FlaskConical, RotateCcw, RotateCw,
} from 'lucide-vue-next';
import { useAuthStore } from '@/store/auth';
import { labService } from '@/services/lab.service';
import { labsService } from '@/services/labs.service';
import {
  STATUS_LABELS, toolPanes, type Lab, type LabGrade, type LabTask,
  type LabTool, type ToolPane,
} from '@/utils/labCatalogue';
import LabBrief from '@/components/labs/LabBrief.vue';
import LabCode from '@/components/labs/LabCode.vue';
import LabConsole from '@/components/labs/LabConsole.vue';
import LabFiles from '@/components/labs/LabFiles.vue';
import LabGui from '@/components/labs/LabGui.vue';
import LabQuery from '@/components/labs/LabQuery.vue';
import LabTasks from '@/components/labs/LabTasks.vue';
import LabTutor from '@/components/labs/LabTutor.vue';
import LabWeb from '@/components/labs/LabWeb.vue';

const route = useRoute();
const authStore = useAuthStore();

const lab = ref<Lab | null>(null);
const grade = ref<LabGrade>({
  tasks: [], done: 0, total: 0, earned: 0, possible: 0, percent: 0,
  status: 'not_started', unavailable: [],
});
const views = ref<Record<string, any>>({});
const webSource = ref<{ html?: string; css?: string; js?: string }>({});
const loading = ref(true);
const grading = ref(false);
const viewsBusy = ref(false);
const busy = ref(false);
const error = ref('');
const note = ref('');
const activePane = ref('');
const chosenTool = ref<Record<string, string>>({});
const selfMarked = ref<string[]>([]);
const tutor = ref<any>(null);
const filesPane = ref<any>(null);

const hasLabAccess = computed(() => authStore.hasLabAccess);
const username = computed(() => authStore.user?.username || '');
const userId = computed(() => String(authStore.user?.user_id || ''));
const labId = computed(() => String(route.params.labId || ''));

const panes = computed<ToolPane[]>(() =>
  lab.value ? toolPanes(lab.value.tool_detail) : []);

const trackTitle = computed(() => lab.value?.track || '');

const statusLabel = computed(() => STATUS_LABELS[grade.value.status]
  || STATUS_LABELS.not_started);

const statusBadge = computed(() => {
  if (grade.value.status === 'completed') return 'good';
  if (grade.value.status === 'in_progress') return 'warn';
  return 'quiet';
});

function activeTool(family: string): string {
  const chosen = chosenTool.value[family];
  if (chosen) return chosen;
  const pane = panes.value.find(row => row.family === family);
  return pane?.primary.id || '';
}

function pickTool(family: string, toolId: string) {
  chosenTool.value = { ...chosenTool.value, [family]: toolId };
}

/**
 * A first line for a console, taken from the lab's own brief.
 *
 * The first fenced block in the brief is nearly always the command the student
 * is meant to try, and putting it under the prompt saves them scrolling back to
 * the Brief tab for it.
 */
function consoleHint(tool: LabTool): string {
  const brief = lab.value?.brief || '';
  const match = brief.match(/```[a-z]*\n([^\n]+)/i);
  return match ? `Try: ${match[1]}` : '';
}

async function open() {
  if (!username.value || !labId.value) return;
  loading.value = true;
  error.value = '';
  note.value = '';
  try {
    const payload = await labsService.openLab(username.value, labId.value, {
      userId: userId.value,
      fullName: authStore.user?.full_name || '',
    });
    if (!payload?.lab) {
      error.value = 'The lab service could not open this lab. It may still be '
        + 'starting up.';
      return;
    }
    lab.value = payload.lab;
    grade.value = payload.grade;
    views.value = payload.views || {};
    webSource.value = (payload.views as any)?.web || {};
    note.value = payload.note || '';
    if (!activePane.value) {
      const first = toolPanes(payload.lab.tool_detail)[0];
      activePane.value = first ? first.family : '__brief';
    }
  } catch (problem: any) {
    error.value = problem?.message || 'The lab could not be opened.';
  } finally {
    loading.value = false;
  }
}

/**
 * Run one thing, then refresh the dashboards.
 *
 * The refresh is deliberately AFTER the command and only for the families this
 * lab has: a Terraform apply changes the AWS console too, so refreshing one
 * family would leave the other pane stale and the student would conclude the
 * apply had not worked.
 */
async function runTool(toolId: string, payload: Record<string, unknown>) {
  if (!lab.value) return { ok: false, error: 'The lab is not open' };
  const result = await labsService.runTool(username.value, lab.value.id,
                                          toolId, payload);
  if (result?.note) note.value = result.note;
  refreshViews();
  if (toolId === 'editor' || toolId === 'terminal') filesPane.value?.refresh?.();
  return result;
}

async function refreshViews() {
  if (!lab.value) return;
  viewsBusy.value = true;
  try {
    const fresh = await labsService.getViews(username.value, lab.value.id,
                                            lab.value.families);
    if (fresh && Object.keys(fresh).length) {
      views.value = fresh;
      if ((fresh as any).web) webSource.value = (fresh as any).web;
    }
  } finally {
    viewsBusy.value = false;
  }
}

async function grade0() {
  if (!lab.value) return;
  grading.value = true;
  try {
    const result = await labsService.gradeLab(username.value, lab.value.id, {
      userId: userId.value,
      selfMarked: selfMarked.value,
    });
    if (result?.grade) grade.value = result.grade;
    if (result?.views && Object.keys(result.views).length) {
      views.value = result.views as any;
    }
  } finally {
    grading.value = false;
  }
}

/**
 * Tick a self-marked task.
 *
 * Monotonic, and the backend is monotonic too: a manual task cannot be
 * un-ticked, because the progress record's `tasks_done` is joined by union and
 * an un-tick would be silently discarded anyway. Offering a checkbox that looks
 * reversible and is not would be worse than a one-way one.
 */
function selfMark(taskId: string) {
  if (!selfMarked.value.includes(taskId)) {
    selfMarked.value = [...selfMarked.value, taskId];
  }
  grade0();
}

async function askTutor(task: LabTask) {
  const pane = panes.value.find(row => row.tools.some(t => t.kind === 'ai'));
  if (pane) activePane.value = pane.family;
  // The tutor mounts inside a `v-if`, so it may not exist until the pane is
  // shown. Waiting a frame is what makes the click work the first time rather
  // than the second.
  requestAnimationFrame(() => tutor.value?.askAboutTask?.(task));
}

async function loadContext(): Promise<string> {
  if (!lab.value) return '';
  return labsService.getContext(username.value, lab.value.id);
}

async function listFiles() {
  return lab.value ? labsService.listFiles(username.value, lab.value.id) : [];
}

async function readFile(path: string) {
  return lab.value ? labsService.readFile(username.value, lab.value.id, path) : '';
}

async function writeFile(path: string, content: string) {
  if (!lab.value) return { ok: false, error: 'The lab is not open' };
  const result = await labsService.writeFile(username.value, lab.value.id,
                                             path, content);
  refreshViews();
  return result;
}

async function deleteFile(path: string) {
  if (!lab.value) return { ok: false, error: 'The lab is not open' };
  const result = await labsService.deleteFile(username.value, lab.value.id, path);
  refreshViews();
  return result;
}

async function saveWeb(source: { html: string; css: string; js: string }) {
  if (!lab.value) return null;
  const saved = await labsService.saveWeb(username.value, lab.value.id, source);
  grade0();
  return saved;
}

/** The Python tool's Stop, which kills the process on the replica. */
async function stopProcess() {
  return labService.killProcess(username.value);
}

async function reset() {
  if (!lab.value) return;
  busy.value = true;
  try {
    await labsService.resetLab(username.value, lab.value.id);
    await open();
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  if (hasLabAccess.value) open();
  else loading.value = false;
});

watch(labId, () => {
  activePane.value = '';
  chosenTool.value = {};
  selfMarked.value = [];
  if (hasLabAccess.value) open();
});

watch(hasLabAccess, value => {
  if (value && !lab.value) open();
});
</script>
