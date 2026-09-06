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
            <!--
              THE TOUR BUTTON, here as well as in the top bar.

              This route sets `meta.hideTopBar` - the workbench already has the
              same three tools and two consoles for one command is a student
              wondering which one they are typing into - so the button that is
              on every other page is not on this one, which is the page with the
              most to explain. Both reach the same overlay through `useTour`.
            -->
            <TourButton />
            <!-- The one page the top bar is hidden on, so her button has to be
                 here or she is missing from the screen with the most to ask
                 about. One window either way - see `useAssistant`. -->
            <AssistantButton />
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
              @click="showPane(pane.family)"
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
              @click="showPane('__brief')"
            >{{ $t('Brief') }}</button>
          </div>

          <div v-show="activePane === '__brief'" class="sl-bench__panel">
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
          <!--
            `v-if="opened"` then `v-show="active"`, and the pair is the point.

            A bare `v-if` on the active pane DESTROYS every other one, so
            switching to the Brief and back re-created the web playground from
            the last SAVED source and the student's unsaved markup was gone —
            along with every console transcript and every code editor's
            contents. That is most of "I can't see my design". A bare `v-show`
            would fix it and mount all of them at once, which for the Network
            Simulator means building app 27's whole studio for a lab nobody has
            opened it in. First mount on first view; alive from then on.
          -->
          <div v-if="opened.has(pane.family)" v-show="activePane === pane.family"
               class="sl-bench__panel">
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
              <div v-show="activeTool(pane.family) === tool.id" class="sl-bench__tool-slot">
                <LabConsole
                  v-if="tool.kind === 'console'"
                  :tool="tool"
                  :hint="consoleHint(tool)"
                  :run="line => runTool(tool.id, { command: line })"
                  :complete="completeIn"
                  :save="writeFile"
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
                  :tree="listTree"
                  :read="readFile"
                  :write="writeFile"
                  :remove="deleteFile"
                  :mkdir="makeFolder"
                  :move="movePath"
                  @changed="refreshViews"
                />
                <!--
                  `:key="sourceEpoch"` so RESET actually resets it.

                  The playground refuses an incoming `initial` once the student
                  has typed (see its header), which is what stops a stray
                  command wiping their work — and would also stop Reset
                  environment doing the one thing it is for. The epoch moves
                  only when the lab is loaded from the server, so a reset
                  remounts the pane on the seed and nothing else does.
                -->
                <LabWeb
                  v-else-if="tool.kind === 'web'"
                  :key="sourceEpoch"
                  :initial="webSource"
                  :save="saveWeb"
                />
                <!--
                  THE TWO VISUAL PANES FOR A BACKEND OR A MOBILE LAB.

                  A Django or Flask course otherwise has no way to show the
                  thing the student is building: they write a model, a view, a
                  URL and a template, and a console can only hand back a wall
                  of HTML. `LabPreview` requests the URL through the lab
                  service - which runs the real view against the real database
                  and renders the real template - and draws the answer.

                  `LabMobile` is the same idea for Ionic, with the one
                  difference that matters: the frame is the DEVICE's own pixel
                  size and the device is then scaled, so a media query fires
                  where it really would.

                  Both are keyed on `sourceEpoch` for the reason `LabWeb` is:
                  Reset environment has to actually reset them.
                -->
                <LabPreview
                  v-else-if="tool.kind === 'preview'"
                  :key="`p${sourceEpoch}`"
                  :family="pane.family"
                  :tool-id="tool.id"
                  :running="isServerRunning(pane.family)"
                  :run="runTool"
                />
                <LabMobile
                  v-else-if="tool.kind === 'mobile'"
                  :key="`m${sourceEpoch}`"
                  :tool-id="tool.id"
                  :run="runTool"
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
                <!--
                  An external tool RENDERED IN PLACE where this build has the
                  component for it, and only linked where it does not.

                  The Network Simulator is app 27's studio and this pane used to
                  be a button that navigated to it — which throws away the brief,
                  the tasks and the Check my work button, i.e. everything the
                  curriculum around the simulator exists to add. It is loaded
                  with `defineAsyncComponent` so the ~3,000 lines of netsim
                  components stay out of this route's chunk until a lab actually
                  opens the pane (working rule 47).
                -->
                <div v-else-if="tool.kind === 'external' && canEmbed(tool)" class="sl-embed">
                  <div class="sl-embed__bar">
                    <span class="sl-embed__note">{{ tool.fidelity }}</span>
                    <a v-if="tool.href" :href="`#${tool.href}`" target="_blank"
                       rel="noopener" class="sl-btn sl-btn--ghost sl-btn--sm">
                      <ExternalLink class="sl-i" /> {{ $t('Open full screen') }}
                    </a>
                  </div>
                  <NetworkStudio v-if="tool.id === 'netsim'" embedded />
                </div>
                <div v-else-if="tool.kind === 'external'" class="sl-external">
                  <p>{{ tool.summary }}</p>
                  <a v-if="tool.href" :href="`#${tool.href}`"
                     class="sl-btn sl-btn--primary">
                    {{ $t('Open') }} {{ $t(tool.label) }}
                  </a>
                </div>
                <!--
                  A FUNCTION REF, not `ref="tutor"`.

                  This component sits inside two nested `v-for`s, and Vue
                  collects a template ref inside a `v-for` into an ARRAY - so
                  `tutor.value?.askAboutTask?.()` was reading a method off an
                  array, finding `undefined`, and the optional call swallowed
                  it. That is the whole of "Ask the tutor does nothing": no
                  error, no request, nothing in the browser console. Only one
                  tool in a lab has `kind === 'ai'`, so a function ref keeping
                  the last one it is handed is exact rather than adequate.
                -->
                <template v-else-if="tool.kind === 'ai'">
                  <!--
                    THE ALLOWANCE, said before the ask rather than after it.

                    Three asks are free and each one after that costs points.
                    A student who finds that out from a points total that went
                    down has been penalised for something nobody told them
                    about - which is the same unfairness the exam's rules gate
                    exists to prevent, at a much smaller scale.
                  -->
                  <p class="sl-tutorNote" :class="{ 'is-over': tutorAsks >= AI_FREE_ASKS }">
                    <template v-if="tutorAsks < AI_FREE_ASKS">
                      {{ $t('{v0} of your {v1} free tutor asks used in this lab. Each ask after that costs {v2} points — and finishing within the allowance earns {v3}.', { v0: tutorAsks, v1: AI_FREE_ASKS, v2: overusePenalty, v3: cleanBonus }) }}
                    </template>
                    <template v-else>
                      {{ $t('Your {v0} free asks are used. Each further ask costs {v1} points. It will not fail the lab and it will not take a verified task away from you.', { v0: AI_FREE_ASKS, v1: overusePenalty }) }}
                    </template>
                  </p>
                  <LabTutor
                    :ref="el => { if (el) tutor = el }"
                    :lab="lab"
                    :load-context="loadContext"
                    @asked="noteTutorAsk"
                  />
                </template>
              </div>
            </template>
          </div>
          </template>
        </section>

        <!-- The tasks -->
        <aside class="sl-side">
          <!--
            The practice record, above the tasks.

            A LAB'S VERSION OF THIS PANEL CANNOT FAIL ANYBODY - `FAILS_AT.lab`
            is null, so `IntegrityMeter` draws no strike pips and says so in
            words. It is here at all because the points are public and a
            student is owed the running total that produced them, not because
            anything is being invigilated.
          -->
          <IntegrityMeter
            context="lab"
            :verdict="sitting.verdict.value"
            :events="sitting.log.value"
          />

          <LabTasks
            :grade="grade"
            :busy="grading"
            :report="report"
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
 * Four decisions worth not undoing:
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
 * **A pane keeps its state once it has been opened.** See the comment on the
 * panel element: `v-if` on the active pane alone was destroying the web
 * playground's unsaved source, every console transcript and every code editor
 * on each tab switch.
 *
 * **Grading is manual.** A lab that graded after every command would send a
 * request per keystroke-ful of typing and would tick a task off mid-thought.
 * `Check my work` is the same shape as `terraform plan` - the student decides
 * when to look. What it must not be is SILENT, which it was: see `report`.
 */
import { computed, defineAsyncComponent, h, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  AlertTriangle, Crown, ExternalLink, FlaskConical, RotateCcw, RotateCw,
} from 'lucide-vue-next';
import { t } from '@/i18n/runtime';
import { useAuthStore } from '@/store/auth';
import { labService } from '@/services/lab.service';
import { labsService } from '@/services/labs.service';
import {
  STATUS_LABELS, canEmbed, defaultPane, gradeReport, toolPanes,
  taskQuestion,
  type GradeReport, type Lab, type LabGrade, type LabTask, type LabTool,
  type ToolPane,
} from '@/utils/labCatalogue';
import LabBrief from '@/components/labs/LabBrief.vue';
import LabCode from '@/components/labs/LabCode.vue';
import LabConsole from '@/components/labs/LabConsole.vue';
import LabFiles from '@/components/labs/LabFiles.vue';
import LabGui from '@/components/labs/LabGui.vue';
import LabMobile from '@/components/labs/LabMobile.vue';
import LabPreview from '@/components/labs/LabPreview.vue';
import LabQuery from '@/components/labs/LabQuery.vue';
import LabTasks from '@/components/labs/LabTasks.vue';
import LabTutor from '@/components/labs/LabTutor.vue';
import LabWeb from '@/components/labs/LabWeb.vue';
import IntegrityMeter from '@/components/practice/IntegrityMeter.vue';
import { usePracticeSitting } from '@/composables/usePracticeSitting';
import TourButton from '@/components/TourButton.vue';
import AssistantButton from '@/components/assistant/AssistantButton.vue';
import { ACTIONS, AI_FREE_ASKS } from '@/utils/practiceIntegrity';

/**
 * App 27's studio, embedded in the Network Simulator pane.
 *
 * Async, and it is worth being exact about what that buys TODAY, because it is
 * less than it looks: `router/index.ts` imports this view statically for
 * `/network-simulator/studio`, so its ~570 kB is already in the entry chunk and
 * this dynamic import currently resolves to a 61-byte re-export. Measured, not
 * assumed — `dist/assets/NetworkSimulatorStudio-*.js` is that shim.
 *
 * It is still the right spelling. A static import HERE would make the eleven
 * other tracks' pane depend on the netsim stack directly, so the day the router
 * lazy-loads these three routes — which working rule 47 says it should, and
 * which is the obvious follow-up — the labs would drag all of it back into the
 * entry chunk and the split would silently buy nothing. One line now, or a
 * regression nobody would attribute to this file later.
 */
const NetworkStudio = defineAsyncComponent({
  loader: () => import('@/views/NetworkSimulatorStudio.vue'),
  /*
    A chunk that will not load must SAY so.

    `defineAsyncComponent` renders nothing at all when its loader rejects, and
    an empty pane under a tab labelled Network Simulator is indistinguishable
    from a lab that forgot to include one. It rejects for reasons that happen:
    a deploy replaces the hashed chunk under a tab somebody left open, or the
    connection drops between opening the lab and opening the pane. Both are
    recoverable by reloading, which is what this says.
  */
  loadingComponent: {
    render: () => h('div', { class: 'sl-embed__wait' }, t('Loading the Network Simulator...')),
  },
  errorComponent: {
    render: () => h('div', { class: 'sl-embed__wait sl-embed__wait--bad' },
      t('The Network Simulator could not be loaded. Reload the page, or open it full screen.')),
  },
  delay: 150,
  timeout: 30_000,
});

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
/** Which panes have ever been shown, so each mounts once and then stays alive. */
const opened = ref(new Set<string>());
/** Bumped whenever the lab is loaded from the server. See the LabWeb key. */
const sourceEpoch = ref(0);
const chosenTool = ref<Record<string, string>>({});
const selfMarked = ref<string[]>([]);
/** What the last Check my work actually did. Null until it has been pressed. */
const report = ref<GradeReport | null>(null);
const tutor = ref<any>(null);
const filesPane = ref<any>(null);

/* ------------------------------------------------------------------ *
 * The practice record
 * ------------------------------------------------------------------ */

/**
 * This lab session's ledger.
 *
 * NO `onVoided`, and that is the whole difference from an exam: `FAILS_AT.lab`
 * is null, so `verdictFor` never reports a failure and the callback could not
 * fire. A lab is a place to try things - leaving the window to read the
 * documentation is what a practitioner does, and failing somebody for it would
 * teach them to work worse.
 *
 * The DETECTORS are narrowed for the same reason. `devtools` and `print` are
 * off: a lab's whole subject is sometimes the page the student is building, so
 * opening the developer tools in one is work rather than misconduct, and
 * printing a brief is reading it.
 */
const sitting = usePracticeSitting({
  context: 'lab',
  // `clipboard` is off as well now, and that is a correction rather than a
  // preference: copying in a lab is how a command gets from the brief into the
  // terminal, so charging for it penalised the intended behaviour. App 20 no
  // longer accepts a clipboard action in a lab context at all.
  watch: { devtools: false, print: false, fullscreen: false, clipboard: false },
});

/** How many times the tutor has been asked in this lab. */
const tutorAsks = ref(0);

const overusePenalty = Math.abs(ACTIONS['ai.overused'].points);
const cleanBonus = ACTIONS['lab.clean_session'].points;

/**
 * Record a tutor ask, and charge for it past the allowance.
 *
 * The FIRST THREE are `lab.ai_asked`, which is neutral and capped at three by
 * the catalogue; everything after is `ai.overused`, which costs. Two actions
 * rather than one with a conditional value, because the value has to come from
 * the server's catalogue (see `practiceIntegrity`'s header) and a catalogue
 * entry has one price.
 */
function noteTutorAsk() {
  tutorAsks.value += 1;
  sitting.note(tutorAsks.value <= AI_FREE_ASKS ? 'lab.ai_asked' : 'ai.overused');
}

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

function showPane(family: string) {
  activePane.value = family;
  if (family !== '__brief' && !opened.value.has(family)) {
    opened.value = new Set([...opened.value, family]);
  }
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
    /*
      The ledger opens with the lab.

      `begin` is idempotent, so a re-open after Reset environment does not
      start a second session - which would be a second session id and a verdict
      computed over half the work each. The tutor count is deliberately NOT
      reset by a re-open either: the allowance is per lab, not per reload, or
      it would be three free asks every time somebody pressed Reset.
    */
    sitting.begin(
      { id: payload.lab.id, name: payload.lab.title },
      { userId: userId.value, username: username.value },
    );
    sitting.note('lab.opened');
    /*
      A LAB THAT IS ALREADY FINISHED OPENS CLOSED.

      Re-opening a completed lab to re-read the brief is ordinary, and without
      this it started a fresh sitting that charged for every switch away - the
      reported bug arriving by the other door. `complete` is idempotent and the
      terminal action is capped at one per sitting, so this costs nothing when
      the same lab is opened again.
    */
    if (payload.grade?.status === 'completed') void sitting.complete();
    views.value = payload.views || {};
    webSource.value = (payload.views as any)?.web || {};
    note.value = payload.note || '';
    /*
      Seed the self-marked set from what the SERVER already believes.

      Without this a reload starts the list empty, and the first tick after a
      reload posts only that one id — which the grader used to read as the whole
      set, so every task ticked before the reload came back to-do. The backend
      now unions its own record in as well; doing both is what makes the tick
      feel permanent whichever end answers first.
    */
    selfMarked.value = payload.grade.tasks
      .filter(task => task.manual && task.status === 'passed')
      .map(task => task.id);
    report.value = null;
    sourceEpoch.value += 1;
    /*
      Open on the pane the LAB IS ABOUT, not on `panes[0]`.

      `toolPanes` orders by each tool's global `order`, and the supporting tools
      — the file browser and the tutor — sort ahead of every subject tool in the
      catalogue. So `web-01-html` opened on an empty file browser and
      `net-01-addressing` opened on an empty file browser, with the thing the
      lab is named after one tab to the right. `defaultPane` picks the subject.

      A re-open keeps whatever pane the student was on if it still exists, so
      Reset environment does not also move them.
    */
    const fresh = toolPanes(payload.lab.tool_detail);
    const stillThere = fresh.some(pane => pane.family === activePane.value);
    showPane(activePane.value && (stillThere || activePane.value === '__brief')
      ? activePane.value : defaultPane(fresh));
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
/**
 * Is the dev server up in this family's engine?
 *
 * Read from the GUI view rather than tracked here, so the Browser pane and the
 * console can never disagree about it - the console is what started the server
 * and the view is what the console wrote.
 */
function isServerRunning(family: string): boolean {
  const view: any = views.value?.[family];
  return !!view?.server?.running;
}

async function runTool(toolId: string, payload: Record<string, unknown>) {
  if (!lab.value) return { ok: false, error: 'The lab is not open' };
  const result = await labsService.runTool(username.value, lab.value.id,
                                          toolId, payload);
  if (result?.note) note.value = result.note;
  refreshViews();
  // ANY console can write a file now, not just the terminal and the Files tool:
  // every one of them is a shell, so `echo x > f` and `nano f` work in the
  // Terraform and AWS consoles too. Keyed on the tool KIND rather than on two
  // hardcoded ids, or the file tree silently stops following what a student can
  // watch themselves doing.
  if (toolId === 'editor' || panes.value.some(pane => pane.tools.some(
      tool => tool.id === toolId && tool.kind === 'console'))) {
    filesPane.value?.refresh?.();
  }
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
      /*
        `webSource` is NOT re-seeded here, and that is the fix rather than an
        omission.

        The views payload carries the last SAVED html/css/js, so assigning it
        back after every command replaced whatever the student had typed with
        the lab's starter file — silently, on any tool run, in the one pane whose
        entire content is unsaved work. The browser owns this source once the
        lab is open; only `open()` and `reset()` may seed it.
      */
    }
  } finally {
    viewsBusy.value = false;
  }
}

async function grade0() {
  if (!lab.value) return;
  grading.value = true;
  const before = grade.value;
  try {
    const result = await labsService.gradeLab(username.value, lab.value.id, {
      userId: userId.value,
      selfMarked: selfMarked.value,
    });
    if (result?.grade) {
      grade.value = result.grade;
      // Keep the tick list in step with what the server now believes, so a task
      // it has recorded is not re-posted for ever and one it has not is.
      selfMarked.value = result.grade.tasks
        .filter(task => task.manual && task.status === 'passed')
        .map(task => task.id);
    }
    if (result?.views && Object.keys(result.views).length) {
      views.value = result.views as any;
    }
    report.value = gradeReport(before, result?.grade ?? null);
    /*
      RECORDED ON WHAT IT FOUND, not on the press.

      `lab.checked` is free and unlimited, because checking often is how a lab
      is meant to be worked. `lab.persisted` is the award, and it is paid only
      when the grade actually MOVED - capped at four by the catalogue, so a
      twelve-task lab cannot out-earn an exam by being long. Paying per press
      would pay for pressing a button.
    */
    sitting.note('lab.checked');
    if ((result?.grade?.earned ?? 0) > (before.earned ?? 0)) {
      sitting.note('lab.persisted');
    }
    /*
      Finishing within the tutor allowance, awarded once by the catalogue's
      own cap.

      Read off the fresh grade rather than the ref, because `grade.value` is
      assigned above and a re-read would be the same object - the point is that
      the award depends on the state AFTER this grading, and on the tutor count
      as it stands now rather than at the start.
    */
    if (result?.grade?.status === 'completed' && tutorAsks.value <= AI_FREE_ASKS) {
      sitting.note('lab.clean_session');
    }
    /*
      AND THE LAB IS OVER, which is the fix for the reported bug.

      Until this line a lab had no end at all: a student who verified every
      task and left the workspace open went on paying for every switch to their
      editor, indefinitely, on a public record. `complete` records the terminal
      action and closes the sitting on the service, so nothing after it scores.

      LAST in this block, deliberately - `lab.clean_session` is an award and a
      closed sitting cannot earn, so recording the close first would throw away
      the one thing finishing cleanly is worth. Awaited so the close has left
      the browser before anything else can end the page.
    */
    if (result?.grade?.status === 'completed') await sitting.complete();
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

/**
 * Ask the tutor about a task: open the pane and FILL THE BOX.
 *
 * Two bugs, one button. The ref it went through was an array (see the template),
 * so the click did nothing at all; and what it did when it worked was SEND a
 * sentence assembled at the call site, so a student got an answer to a question
 * they had never read.
 *
 * Filled and not sent, deliberately. A question the student can see is one they
 * can correct before spending a model call on it - which is usually all the
 * nudge they needed - and it is the only way to add "I have already tried X".
 * The sentence itself is `taskQuestion` in `labCatalogue.ts`, where
 * `npm run check:labs` drives it, because what makes it a good question is the
 * checker's own note and the task's position in the lab, and neither is obvious.
 */
async function askTutor(task: LabTask) {
  const pane = panes.value.find(row => row.tools.some(t => t.kind === 'ai'));
  if (pane) showPane(pane.family);
  const tasks = grade.value.tasks || [];
  const position = tasks.findIndex(row => row.id === task.id) + 1;
  const question = taskQuestion(lab.value, task, position, tasks.length);
  // The tutor mounts inside a `v-if`, so it may not exist until the pane is
  // shown. Waiting a frame is what makes the click work the first time rather
  // than the second.
  requestAnimationFrame(() => tutor.value?.fillQuestion?.(question));
}

/**
 * The Tab candidates for a console, fetched once per directory.
 *
 * Here rather than in the console because it needs the username and the lab id,
 * and `LabConsole` is deliberately given nothing but the tool record and three
 * callbacks - that is what lets one component serve twelve consoles.
 */
async function completeIn(toolId: string) {
  if (!lab.value) return { commands: [], dirs: [], files: [], paths: [] };
  return labsService.completions(username.value, lab.value.id, toolId);
}

async function loadContext(): Promise<string> {
  if (!lab.value) return '';
  return labsService.getContext(username.value, lab.value.id);
}

async function listFiles() {
  return lab.value ? labsService.listFiles(username.value, lab.value.id) : [];
}

/**
 * The whole filesystem, files AND folders, for the explorer.
 *
 * `dirs` is not derived in the browser from the file paths: the implied folders
 * could be, and an EMPTY one is implied by nothing — which is exactly the folder
 * a student has just made with New Folder and is waiting to see.
 */
async function listTree() {
  if (!lab.value) return { files: [], dirs: [] };
  return labsService.listTree(username.value, lab.value.id);
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

async function deleteFile(path: string, recursive = false) {
  if (!lab.value) return { ok: false, error: 'The lab is not open' };
  const result = await labsService.deleteFile(username.value, lab.value.id,
                                              path, recursive);
  refreshViews();
  return result;
}

async function makeFolder(path: string) {
  if (!lab.value) return { ok: false, error: 'The lab is not open' };
  return labsService.makeFolder(username.value, lab.value.id, path);
}

/**
 * A rename or a drag between folders — one call, because it is one operation.
 *
 * `refreshViews` afterwards for the reason a write needs it: a GUI panel or the
 * Browser pane may be drawing something the moved file produced, and the file
 * tree and the panes disagreeing about which paths exist is the confusing half
 * of a move.
 */
async function movePath(path: string, to: string) {
  if (!lab.value) return { ok: false, error: 'The lab is not open' };
  const result = await labsService.movePath(username.value, lab.value.id,
                                            path, to);
  refreshViews();
  return result;
}

async function saveWeb(source: { html: string; css: string; js: string }) {
  if (!lab.value) return null;
  const saved = await labsService.saveWeb(username.value, lab.value.id, source);
  // Only re-grade when the save landed. Grading against a source the backend
  // never received is how "I pressed Run and Check my work says nothing".
  if (saved) grade0();
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
    // Recorded as neutral: starting again costs nothing, and a student who
    // believed otherwise would keep working in a broken environment.
    sitting.note('lab.reset');
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
  opened.value = new Set();
  chosenTool.value = {};
  selfMarked.value = [];
  report.value = null;
  if (hasLabAccess.value) open();
});

watch(hasLabAccess, value => {
  if (value && !lab.value) open();
});
</script>
