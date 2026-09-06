<template>
  <div class="sfs-topbar">
    <div class="sfs-topbar__inner">
      <!-- The three practice tools, on every page.
           These are not labs and the Labs page no longer pretends they are: a
           terminal, a SQL editor and a Python compiler are a SCRATCHPAD, and the
           whole point of a scratchpad is that it is one click away from whatever
           you are reading. -->
      <button
        v-for="tool in TOOLS"
        :key="tool.id"
        type="button"
        class="sfs-topbar__btn"
        :class="{ 'is-open': open === tool.id }"
        :aria-pressed="open === tool.id"
        :title="$t(tool.title)"
        @click="toggle(tool.id)"
      >
        <component :is="tool.icon" class="sfs-topbar__i" />
        <span class="sfs-topbar__label">{{ $t(tool.label) }}</span>
      </button>

      <span class="sfs-topbar__spacer"></span>

      <!--
        THE TOUR, and it is here rather than in the sidebar for one reason: it
        describes the page you are looking at, and the top bar is the only strip
        of chrome that is on every page and is about the page rather than about
        where else you could go.

        It needs no account. Somebody who cannot work out how to sign in is
        exactly who a tour is for, and the platform tail explains the sidebar,
        the search, the language and the theme - all of which are there signed
        out.
      -->
      <TourButton />

      <router-link to="/labs" class="sfs-topbar__link">
        <FlaskConical class="sfs-topbar__i" />
        <span class="sfs-topbar__label">{{ $t('Labs') }}</span>
      </router-link>
      <a
        v-if="open"
        class="sfs-topbar__link"
        :href="`#/tools${open === 'sql' ? '' : '/' + open}`"
        @click="open = ''"
      >
        <Maximize2 class="sfs-topbar__i" />
        <span class="sfs-topbar__label">{{ $t('Full page') }}</span>
      </a>
    </div>

    <!--
      The dock, and why it is NOT a modal.

      A student uses these while reading something: a lesson, a runbook, a course
      page. A modal would cover what they are reading and take the focus, which
      is exactly the wrong shape - so this is a resizable panel pinned to the
      bottom of the viewport with the page still scrollable behind it. Escape
      closes it, because a panel with no keyboard way out is a trap.
    -->
    <section
      v-if="open"
      class="sfs-dock"
      :class="{ 'is-tall': tall }"
      role="region"
      :aria-label="$t('Practice tools')"
    >
      <header class="sfs-dock__head">
        <div class="sfs-dock__tabs">
          <button
            v-for="tool in TOOLS"
            :key="tool.id"
            type="button"
            class="sfs-dock__tab"
            :class="{ 'is-active': open === tool.id }"
            @click="open = tool.id"
          >{{ $t(tool.label) }}</button>
        </div>
        <div class="sfs-dock__actions">
          <button type="button" class="sfs-dock__ctl" :title="$t('Resize')"
                  @click="tall = !tall">
            <component :is="tall ? ChevronDown : ChevronUp" class="sfs-topbar__i" />
          </button>
          <button type="button" class="sfs-dock__ctl" :title="$t('Close')"
                  @click="open = ''">
            <X class="sfs-topbar__i" />
          </button>
        </div>
      </header>

      <div class="sfs-dock__body">
        <p v-if="!username" class="sfs-dock__gate">
          {{ $t('Sign in to use the practice tools.') }}
        </p>
        <p v-else-if="!hasLabAccess" class="sfs-dock__gate">
          {{ $t('Your plan does not include the practice tools.') }}
          <router-link to="/plans">{{ $t('View Plans') }}</router-link>
        </p>
        <template v-else>
          <!-- One console/editor per tool, the same components the labs use.
               Reusing them rather than writing a second set is the reason a fix
               to the console lands in both places. -->
          <LabConsole
            v-if="open === 'linux'"
            :tool="TOOL_RECORDS.linux"
            :run="runShell"
          />
          <LabQuery
            v-else-if="open === 'sql'"
            :tool="TOOL_RECORDS.sql"
            :run="runSql"
          />
          <LabCode
            v-else-if="open === 'python'"
            :tool="TOOL_RECORDS.python"
            :run="runPython"
            :stop-run="stopPython"
          />
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * The top bar: a terminal, a SQL editor and a Python compiler, everywhere.
 *
 * **This is what the Labs page used to be**, and moving it here is the whole
 * point of the change: those three are not labs, they are a place to try
 * something. A student reading a lesson about `GROUP BY` wants to run one
 * without leaving the lesson, and a student halfway through a Python chapter
 * wants to test one line.
 *
 * Two things are load-bearing:
 *
 * **The student record is created lazily, on the first command.** `getOrCreateStudent`
 * is a request to a PythonAnywhere replica that can take twenty seconds when
 * cold; doing it on mount would mean every page load on the platform waits for
 * the lab service. Opening the dock does nothing but draw it.
 *
 * **The dock is a panel, not a modal.** See the comment in the template - the
 * whole value is that the page behind it is still readable.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  ChevronDown, ChevronUp, Database, FileCode, FlaskConical, Maximize2,
  Terminal, X,
} from 'lucide-vue-next';
import { useAuthStore } from '@/store/auth';
import { useTour } from '@/composables/useTour';
import { labService } from '@/services/lab.service';
import type { LabTool } from '@/utils/labCatalogue';
import LabCode from '@/components/labs/LabCode.vue';
import LabConsole from '@/components/labs/LabConsole.vue';
import LabQuery from '@/components/labs/LabQuery.vue';
import TourButton from '@/components/TourButton.vue';

const authStore = useAuthStore();

const TOOLS = [
  { id: 'linux', label: 'Terminal', title: 'Open a Linux terminal',
    icon: Terminal },
  { id: 'sql', label: 'SQL', title: 'Open the SQL editor', icon: Database },
  { id: 'python', label: 'Python', title: 'Open the Python compiler',
    icon: FileCode },
];

/**
 * Tool records shaped like the lab service's, so the lab components can be
 * reused unchanged.
 *
 * `simulated: false` on all three and that is the truth: these are the real
 * sandboxes - a real shell in a contained directory, real CPython, real SQLite.
 */
const TOOL_RECORDS: Record<string, LabTool> = {
  linux: {
    id: 'terminal', label: 'Linux Terminal', kind: 'console', engine: 'linux',
    icon: 'terminal', summary: 'A real shell in your own workspace directory.',
    simulated: false, prompt: '$ ',
    fidelity: 'Real: a contained directory on the lab replica. Paths outside it '
      + 'are refused.',
    family: 'shell', order: 1,
  },
  sql: {
    id: 'sql', label: 'SQL Editor', kind: 'query', engine: 'sqlite',
    icon: 'database', summary: 'Your own copy of the demo database.',
    simulated: false, prompt: '',
    fidelity: 'Real: SQLite. Break it and reset it.',
    family: 'sql', order: 3,
  },
  python: {
    id: 'python', label: 'Python', kind: 'code', engine: 'python',
    icon: 'code', summary: 'A real CPython process.',
    simulated: false, prompt: '',
    fidelity: 'Real: CPython, with a wall-clock limit.',
    family: 'python', order: 2,
  },
};

const open = ref('');
const tall = ref(false);
const ready = ref(false);
const tour = useTour();

const username = computed(() => authStore.user?.username || '');
const hasLabAccess = computed(() => authStore.hasLabAccess);

function toggle(id: string) {
  // A dock opened mid-tour would slide up over the caption, and the caption is
  // pinned in viewport coordinates so it would not move out of the way. The
  // tour stops rather than being covered by something the reader just asked
  // for - they made a choice, and it was not the tour.
  tour.stop();
  open.value = open.value === id ? '' : id;
}

/**
 * Make sure the student record and the workspace exist.
 *
 * Called before the FIRST command rather than on mount, so a page load never
 * waits on the lab service. `getOrCreateStudent` is idempotent and remembers the
 * home replica, so this costs one request per session.
 */
async function ensureStudent(): Promise<boolean> {
  if (ready.value) return true;
  if (!username.value) return false;
  const student = await labService.getOrCreateStudent(username.value);
  ready.value = Boolean(student);
  return ready.value;
}

async function runShell(line: string) {
  if (!(await ensureStudent())) {
    return { ok: false, error: 'Your workspace could not be opened.' };
  }
  const result = await labService.runLinuxCommand(username.value, line);
  return { ok: !result.error, output: result.output, error: result.error };
}

async function runPython(code: string) {
  if (!(await ensureStudent())) {
    return { ok: false, error: 'Your workspace could not be opened.' };
  }
  const result = await labService.runPythonCode(username.value, code);
  return { ok: !result.error, output: result.output, error: result.error };
}

async function stopPython() {
  if (!username.value) return;
  return labService.killProcess(username.value);
}

async function runSql(statement: string) {
  if (!(await ensureStudent())) {
    return { ok: false, error: 'Your workspace could not be opened.' };
  }
  const result = await labService.runSQL(username.value, statement);
  return {
    ok: !result.error,
    error: result.error,
    rows: Array.isArray(result.result) ? result.result : [],
    truncated: Boolean(result.truncated),
  };
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    open.value = '';
  }
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

// A dock open while the reader signs out would keep a console pointed at a
// username that no longer exists.
watch(username, value => {
  if (!value) {
    open.value = '';
    ready.value = false;
  }
});
</script>
