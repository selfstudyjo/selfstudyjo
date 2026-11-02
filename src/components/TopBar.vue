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

      <!-- EVERY TOOL'S PLAYGROUND, from every page.
           One free-practice workspace per tool on the platform - AWS, Azure,
           Fabric, Snowflake, Terraform, Jenkins, Docker, Kubernetes, Hive,
           Git, Ansible and the rest - each the student's OWN saved
           environment with the tool's consoles, dashboards and product
           portal, and none of it a lab: nothing is graded or recorded. -->
      <button
        ref="pgButton"
        type="button"
        class="sfs-topbar__btn"
        :class="{ 'is-open': menuOpen }"
        :aria-expanded="menuOpen"
        aria-haspopup="dialog"
        aria-controls="sfs-topbar-playgrounds"
        :title="$t('Open a playground for any tool')"
        @click="toggleMenu"
      >
        <LayoutGrid class="sfs-topbar__i" />
        <span class="sfs-topbar__label">{{ $t('Playgrounds') }}</span>
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

      <!--
        NOOR, beside the tour and for a complementary job: the tour explains the
        page in front of you in a fixed order, and she answers the question you
        actually have - including "where is X" and "how did I do in Y", neither
        of which any tour can be written to cover.

        Needs no account either. Somebody deciding whether to sign up is exactly
        who wants to ask what the platform does.
      -->
      <AssistantButton />

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
      The playgrounds menu. A popover under the bar on a desktop and a bottom
      sheet on a phone (labs.css). Escape closes it and returns focus to the
      button; arrow keys move between tools; a click outside closes it.
      Outside `__inner` on purpose: that bar has a backdrop-filter, which
      makes it the containing block for anything `position: fixed` inside it,
      and the phone sheet would then be pinned to a 40px strip.
    -->
    <div v-if="menuOpen" class="sfs-topbar__pgscrim" @click="closeMenu(true)"></div>
    <div
      v-if="menuOpen"
      id="sfs-topbar-playgrounds"
      ref="menuEl"
      class="sfs-topbar__pgmenu"
      role="dialog"
      :aria-label="$t('Playgrounds')"
      @keydown="onMenuKey"
    >
      <div class="sfs-topbar__pghead">
        <input
          ref="searchEl"
          v-model="pgQuery"
          type="search"
          class="sfs-topbar__pgsearch"
          :placeholder="$t('Search tools…')"
          :aria-label="$t('Search tools…')"
        />
        <router-link to="/playgrounds" class="sfs-topbar__pgall" @click="closeMenu(false)">
          {{ $t('All playgrounds') }}
        </router-link>
        <button type="button" class="sfs-dock__ctl" :title="$t('Close')"
                :aria-label="$t('Close')" @click="closeMenu(true)">
          <X class="sfs-topbar__i" />
        </button>
      </div>
      <p class="sfs-topbar__pgnote">
        {{ $t('Your own workspace for every tool. Practise freely - nothing is graded or recorded.') }}
      </p>

      <div class="sfs-topbar__pgbody">
        <p v-if="!username" class="sfs-dock__gate">
          {{ $t('Sign in to use the playgrounds.') }}
        </p>
        <p v-else-if="!hasLabAccess" class="sfs-dock__gate">
          {{ $t('Your plan does not include the playgrounds.') }}
          <router-link to="/plans" @click="closeMenu(false)">{{ $t('View Plans') }}</router-link>
        </p>
        <template v-else>
          <p v-if="pgLoading && !pgRows.length" class="sfs-dock__gate">
            {{ $t('Loading the playgrounds…') }}
          </p>
          <p v-else-if="!grouped.length" class="sfs-dock__gate">
            {{ pgQuery ? $t('No tool matches that search.') : $t('The playgrounds could not be loaded.') }}
          </p>
          <section v-for="group in grouped" :key="group.group" class="sfs-topbar__pggroup">
            <h3 class="sfs-topbar__pgtitle">{{ groupLabel(group.group) }}</h3>
            <ul class="sfs-topbar__pggrid">
              <li v-for="row in group.rows" :key="row.id">
                <router-link
                  :to="playgroundHref(row)"
                  class="sfs-topbar__pgitem"
                  data-pg-item
                  :title="playgroundSummary(row)"
                  @click="closeMenu(false)"
                >
                  <span class="sfs-topbar__pgglyph"><PlaygroundIcon :name="row.icon" /></span>
                  <span class="sfs-topbar__pgname">{{ playgroundTitle(row) }}</span>
                </router-link>
              </li>
            </ul>
          </section>
        </template>
      </div>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  ChevronDown, ChevronUp, Database, FileCode, FlaskConical, LayoutGrid,
  Maximize2, Terminal, X,
} from 'lucide-vue-next';
import { labsService } from '@/services/labs.service';
import { localeId } from '@/i18n/runtime';
import {
  groupPlaygrounds, playgroundHref, withLinked, type Playground,
} from '@/utils/playgrounds';
import {
  groupLabel, playgroundSearchText, playgroundSummary, playgroundTitle,
} from '@/composables/playgroundLabels';
import PlaygroundIcon from '@/components/playgrounds/PlaygroundIcon.vue';
import { useAuthStore } from '@/store/auth';
import { useTour } from '@/composables/useTour';
import { labService } from '@/services/lab.service';
import type { LabTool } from '@/utils/labCatalogue';
import LabCode from '@/components/labs/LabCode.vue';
import LabConsole from '@/components/labs/LabConsole.vue';
import LabQuery from '@/components/labs/LabQuery.vue';
import TourButton from '@/components/TourButton.vue';
import AssistantButton from '@/components/assistant/AssistantButton.vue';

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
  menuOpen.value = false;
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
  const result: any = await labService.runLinuxCommand(username.value, line);
  // The WHOLE answer: `screen` (top, ping, less), `editor` (nano, vi) and
  // `clear` are what let those programs take the console as they do in a lab.
  return { ...result, ok: !result?.error };
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

/* ─────────────── the playgrounds menu ─────────────── */

const route = useRoute();
const menuOpen = ref(false);
const pgQuery = ref('');
const pgRows = ref<Playground[]>([]);
const pgLoading = ref(false);
const pgButton = ref<HTMLButtonElement | null>(null);
const menuEl = ref<HTMLElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);

const grouped = computed(() => groupPlaygrounds(
  withLinked(pgRows.value), pgQuery.value, localeId.value, playgroundSearchText));

/**
 * The list is fetched on the FIRST open, never on mount: the top bar is on
 * every page and a page load must not wait on the lab service. The service
 * caches it for the tab, so later opens are instant.
 */
async function loadPlaygrounds() {
  if (pgRows.value.length || pgLoading.value || !username.value || !hasLabAccess.value) return;
  pgLoading.value = true;
  try {
    pgRows.value = await labsService.getPlaygrounds();
  } finally {
    pgLoading.value = false;
  }
}

function toggleMenu() {
  if (menuOpen.value) {
    closeMenu(true);
    return;
  }
  tour.stop();
  open.value = '';
  menuOpen.value = true;
  void loadPlaygrounds();
  void nextTick(() => searchEl.value?.focus());
}

/** `restore` returns focus to the button - not after following a link. */
function closeMenu(restore: boolean) {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  pgQuery.value = '';
  if (restore) void nextTick(() => pgButton.value?.focus());
}

/**
 * Arrow keys walk the tools in reading order (Left/Right as well as Up/Down,
 * mirrored under `dir="rtl"`), Home/End jump, Down from the search box enters
 * the grid. No focus trap: Tab leaves the menu normally, which is what a
 * non-modal popover should do.
 */
function onMenuKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeMenu(true);
    return;
  }
  const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  const items = Array.from(menuEl.value?.querySelectorAll<HTMLElement>('[data-pg-item]') || []);
  if (!items.length) return;
  const at = items.indexOf(document.activeElement as HTMLElement);
  // In the search box Left/Right/Home/End move the caret, not the focus.
  if (at < 0 && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  const rtl = document.documentElement.dir === 'rtl';
  const forward = event.key === 'ArrowDown'
    || (event.key === 'ArrowRight' && !rtl) || (event.key === 'ArrowLeft' && rtl);
  let next: number;
  if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = items.length - 1;
  else if (at < 0) next = forward ? 0 : items.length - 1;
  else next = (at + (forward ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value) {
    closeMenu(true);
    return;
  }
  if (event.key === 'Escape' && open.value) {
    open.value = '';
  }
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

// Following a link closes the menu; so does any other navigation.
watch(() => route.fullPath, () => closeMenu(false));

// A dock open while the reader signs out would keep a console pointed at a
// username that no longer exists.
watch(username, value => {
  if (!value) {
    open.value = '';
    ready.value = false;
    menuOpen.value = false;
    pgRows.value = [];
  }
});
</script>
