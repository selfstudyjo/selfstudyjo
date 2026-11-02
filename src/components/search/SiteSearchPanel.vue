<template>
  <div
    class="sfs-gs"
    :class="[`sfs-gs--${mode}`]"
    :dir="dir"
    :role="mode === 'sheet' ? 'dialog' : undefined"
    :aria-modal="mode === 'sheet' ? 'true' : undefined"
    :aria-label="mode === 'sheet' ? $t('Search the site') : undefined"
    @mousedown="keepFocus"
  >
    <!-- A phone: a full-screen sheet with its own field, because the top bar is
         a strip of icons there and has no room for one. -->
    <div v-if="mode === 'sheet'" class="sfs-gs__sheethead">
      <SearchIcon class="sfs-gs__headicon" aria-hidden="true" />
      <input
        ref="sheetInput"
        :value="query"
        type="search"
        class="sfs-gs__input"
        role="combobox"
        enterkeyhint="go"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :placeholder="$t('Search the site…')"
        :aria-label="$t('Search courses, lessons, labs, quizzes, exams, runbooks and pages')"
        aria-autocomplete="list"
        :aria-expanded="true"
        :aria-controls="listboxId"
        :aria-activedescendant="activeId || undefined"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        @keydown="onKey"
      />
      <button ref="closeBtn" type="button" class="sfs-gs__close" :aria-label="$t('Close search')"
              @click="emit('close', true)" @keydown.tab.prevent="sheetInput?.focus()">
        <X class="sfs-gs__i" aria-hidden="true" />
      </button>
    </div>

    <div
      :id="listboxId"
      ref="listEl"
      class="sfs-gs__body"
      role="listbox"
      :aria-label="$t('Search results')"
    >
      <!-- ─── nothing typed yet: recent searches and where to start ─── -->
      <template v-if="!hasQuery">
        <section v-if="recent.length" class="sfs-gs__group" role="group" :aria-labelledby="`${listboxId}-h-recent`">
          <header class="sfs-gs__ghead">
            <h3 :id="`${listboxId}-h-recent`" class="sfs-gs__gtitle">
              <HistoryIcon class="sfs-gs__gicon" aria-hidden="true" />{{ $t('Recent searches') }}
            </h3>
            <button type="button" class="sfs-gs__textbtn" @click="clearRecent">{{ $t('Clear') }}</button>
          </header>
          <ul class="sfs-gs__list">
            <li
              v-for="row in recentRows"
              :id="optionId(row.index)"
              :key="row.text"
              role="option"
              class="sfs-gs__opt sfs-gs__opt--recent"
              :class="{ 'is-active': active === row.index }"
              :aria-selected="active === row.index"
              @mousemove="hover(row.index)"
              @click="activate(row.index)"
            >
              <span class="sfs-gs__glyph"><HistoryIcon class="sfs-gs__i" aria-hidden="true" /></span>
              <span class="sfs-gs__text"><span class="sfs-gs__title" dir="auto">{{ row.text }}</span></span>
              <CornerDownLeft class="sfs-gs__enter" aria-hidden="true" />
            </li>
          </ul>
        </section>

        <section class="sfs-gs__group" role="group" :aria-labelledby="`${listboxId}-h-jump`">
          <header class="sfs-gs__ghead">
            <h3 :id="`${listboxId}-h-jump`" class="sfs-gs__gtitle">
              <LayoutGrid class="sfs-gs__gicon" aria-hidden="true" />{{ $t('Jump to') }}
            </h3>
          </header>
          <ul class="sfs-gs__list sfs-gs__list--chips">
            <li
              v-for="row in quickRows"
              :id="optionId(row.index)"
              :key="row.doc.id"
              role="option"
              class="sfs-gs__chipopt"
              :class="{ 'is-active': active === row.index }"
              :aria-selected="active === row.index"
              @mousemove="hover(row.index)"
            >
              <router-link :to="destination(row.doc)" class="sfs-gs__chip" tabindex="-1" @click="onLinkClick($event, row.doc)">
                <component :is="iconFor(row.doc.icon)" class="sfs-gs__i" aria-hidden="true" />
                <span>{{ row.doc.title }}</span>
                <LockIcon v-if="row.doc.lock" class="sfs-gs__lockmini" aria-hidden="true" />
              </router-link>
            </li>
          </ul>
          <p class="sfs-gs__hint">{{ $t('Type to search courses, lessons, labs, quizzes, exams, runbooks and pages.') }}</p>
        </section>
      </template>

      <!-- ─── results, one section per kind ─── -->
      <template v-else>
        <section
          v-for="block in blocks"
          :key="block.section"
          class="sfs-gs__group"
          role="group"
          :aria-labelledby="`${listboxId}-h-${block.section}`"
        >
          <header class="sfs-gs__ghead">
            <h3 :id="`${listboxId}-h-${block.section}`" class="sfs-gs__gtitle">
              <component :is="SECTION_ICONS[block.section]" class="sfs-gs__gicon" aria-hidden="true" />
              {{ sectionLabel(block.section) }}
              <span v-if="block.total" class="sfs-gs__count">{{ n(block.total) }}</span>
            </h3>
            <span v-if="block.state === 'loading' && block.total" class="sfs-gs__updating">{{ $t('Loading…') }}</span>
          </header>

          <!-- Still arriving: a skeleton, never a blank. -->
          <ul v-if="block.state === 'loading' && !block.total" class="sfs-gs__list" aria-hidden="true">
            <li v-for="i in 2" :key="i" class="sfs-gs__skel">
              <span class="sfs-gs__skelglyph"></span>
              <span class="sfs-gs__skellines"><span></span><span></span></span>
            </li>
          </ul>

          <!-- Could not be loaded: say so, and offer to ask again. -->
          <ul v-else-if="block.state === 'error' && !block.total" class="sfs-gs__list">
            <li
              :id="optionId(block.retryIndex)"
              role="option"
              class="sfs-gs__opt sfs-gs__opt--error"
              :class="{ 'is-active': active === block.retryIndex }"
              :aria-selected="active === block.retryIndex"
              @mousemove="hover(block.retryIndex)"
              @click="activate(block.retryIndex)"
            >
              <span class="sfs-gs__glyph"><AlertTriangle class="sfs-gs__i" aria-hidden="true" /></span>
              <span class="sfs-gs__text">
                <span class="sfs-gs__title">{{ $t('This section could not be loaded.') }}</span>
                <span class="sfs-gs__sub">{{ $t('The service did not answer. Press to try again.') }}</span>
              </span>
              <RefreshCw class="sfs-gs__enter" aria-hidden="true" />
            </li>
          </ul>

          <ul v-else class="sfs-gs__list">
            <li
              v-for="row in block.rows"
              :id="optionId(row.index)"
              :key="row.hit.doc.id"
              role="option"
              class="sfs-gs__opt"
              :class="{ 'is-active': active === row.index, 'is-locked': !!row.hit.doc.lock }"
              :aria-selected="active === row.index"
              @mousemove="hover(row.index)"
            >
              <router-link
                :to="destination(row.hit.doc)"
                class="sfs-gs__link"
                tabindex="-1"
                @click="onLinkClick($event, row.hit.doc)"
              >
                <span class="sfs-gs__glyph">
                  <component :is="iconFor(row.hit.doc.icon)" class="sfs-gs__i" aria-hidden="true" />
                </span>
                <span class="sfs-gs__text">
                  <span class="sfs-gs__title" dir="auto">
                    <template v-for="(seg, i) in highlight(row.hit.doc.title, debounced)" :key="i">
                      <mark v-if="seg.match" class="sfs-gs__mark">{{ seg.text }}</mark>
                      <template v-else>{{ seg.text }}</template>
                    </template>
                  </span>
                  <span v-if="row.hit.doc.lock" class="sfs-gs__sub sfs-gs__sub--lock">
                    <LockIcon class="sfs-gs__lockmini" aria-hidden="true" />{{ lockLabel(row.hit.doc) }}
                  </span>
                  <span v-else-if="row.hit.doc.subtitle" class="sfs-gs__sub" dir="auto">{{ row.hit.doc.subtitle }}</span>
                </span>
                <span v-if="row.hit.doc.kind === 'playground'" class="sfs-gs__badge">{{ $t('Playground') }}</span>
                <CornerDownLeft class="sfs-gs__enter" aria-hidden="true" />
              </router-link>
            </li>
            <li
              v-if="block.more || block.expanded"
              :id="optionId(block.moreIndex)"
              role="option"
              class="sfs-gs__opt sfs-gs__opt--more"
              :class="{ 'is-active': active === block.moreIndex }"
              :aria-selected="active === block.moreIndex"
              @mousemove="hover(block.moreIndex)"
              @click="activate(block.moreIndex)"
            >
              <span class="sfs-gs__morelabel">
                {{ block.more ? $t('Show {v0} more', { v0: n(block.more) }) : $t('Show fewer') }}
              </span>
            </li>
          </ul>
        </section>

        <!-- Nothing anywhere, and nothing still arriving. -->
        <div v-if="!blocks.length" class="sfs-gs__empty">
          <SearchX class="sfs-gs__emptyicon" aria-hidden="true" />
          <p class="sfs-gs__emptytitle" dir="auto">{{ $t('No results for “{v0}”', { v0: debounced.trim() }) }}</p>
          <ul class="sfs-gs__tips">
            <li>{{ $t('Check the spelling, or try fewer or shorter words.') }}</li>
            <li>{{ $t('You can search in English, Arabic or Chinese.') }}</li>
          </ul>
          <p class="sfs-gs__browse">{{ $t('Browse instead') }}</p>
          <ul class="sfs-gs__list sfs-gs__list--chips">
            <li
              v-for="row in quickRows"
              :id="optionId(row.index)"
              :key="row.doc.id"
              role="option"
              class="sfs-gs__chipopt"
              :class="{ 'is-active': active === row.index }"
              :aria-selected="active === row.index"
              @mousemove="hover(row.index)"
            >
              <router-link :to="destination(row.doc)" class="sfs-gs__chip" tabindex="-1" @click="onLinkClick($event, row.doc)">
                <component :is="iconFor(row.doc.icon)" class="sfs-gs__i" aria-hidden="true" />
                <span>{{ row.doc.title }}</span>
              </router-link>
            </li>
          </ul>
        </div>
      </template>
    </div>

    <footer class="sfs-gs__foot">
      <span class="sfs-gs__keys" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> {{ $t('to move') }}</span>
        <span><kbd>↵</kbd> {{ $t('to open') }}</span>
        <span><kbd>Tab</kbd> {{ $t('next section') }}</span>
        <span><kbd>Esc</kbd> {{ $t('to close') }}</span>
      </span>
      <span v-if="pending" class="sfs-gs__pending">
        <Loader2 class="sfs-gs__spin" aria-hidden="true" />{{ $t('Some results are still loading') }}
      </span>
    </footer>

    <p class="sfs-gs__sr" role="status" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * The site search's results panel — the heavy half, and loaded only when the
 * box in the top bar is first used (`defineAsyncComponent` in TopBar.vue), so
 * the entry chunk carries a text field and nothing else.
 *
 * Everything this component DECIDES is in `src/utils/siteSearch.ts`, a plain
 * module `npm run check:sitesearch` drives in node: the folding, the scoring,
 * the order, the locks, the keyboard arithmetic. What is here is fetching (via
 * `siteSearch.service.ts`), drawing, and the combobox wiring.
 *
 * Three rules:
 *
 *  - **Every catalogue settles on its own.** A section that is still loading
 *    draws a skeleton and one that failed draws a retry, never a blank -- a
 *    blank reads as "there are no runbooks about Docker", which is a claim.
 *  - **Nothing reaches `v-html`.** Every title is a record fetched over the
 *    network; a match is drawn as `<mark>` segments from `highlight()`.
 *  - **Focus stays in the field** (the combobox pattern): the active row is
 *    `aria-activedescendant`, and a mouse press inside the panel does not take
 *    focus away from where the reader is typing.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  AlertTriangle, Award, BarChart3, BookMarked, BookOpen, Briefcase, Calendar, Car, Check,
  ClipboardCheck, CornerDownLeft, CreditCard, Database, FileCode, FileText, FileUser,
  FlaskConical, Gamepad2, Globe, GraduationCap, History as HistoryIcon, Home, IdCard, Import,
  Layers, LayoutGrid, Library, List, ListChecks, Loader2, Lock as LockIcon, Medal,
  MessageCircle, Mic, Microscope, Network, Package, PenLine, PenTool, Play, Plus, Radio,
  RefreshCw, Route, Search as SearchIcon, SearchX, ShieldCheck, Shapes, Sparkles, Terminal,
  Trophy, User, Users, Bell, Wallet, X,
} from 'lucide-vue-next';
import type { Component } from 'vue';
import { useAuthStore } from '@/store/auth';
import { dir, localeId, n, t } from '@/i18n/runtime';
import type { Access, IconName } from '@/navigation/appNav';
import {
  DEFAULT_LIMIT, EXPANDED_LIMIT, SECTIONS, addRecent, buildIndex, cleanRecent, courseDocs,
  destination, examDocs, highlight, labDocs, lessonDocs, pageDocs, quizDocs, runbookDocs,
  search, sectionJump, stepActive,
  type Hit, type SearchDoc, type SectionId,
} from '@/utils/siteSearch';
import {
  cached, load, wantsRefresh, type SourceId, type SourcePayloads,
} from '@/services/siteSearch.service';
import '@/assets/css/site-search.css';

const props = withDefaults(defineProps<{
  query: string;
  mode?: 'dropdown' | 'sheet';
  listboxId?: string;
}>(), { mode: 'dropdown', listboxId: 'sfs-gs-listbox' });

const emit = defineEmits<{
  (e: 'update:query', value: string): void;
  (e: 'close', restoreFocus: boolean): void;
  (e: 'active', id: string): void;
  (e: 'navigated'): void;
}>();

const router = useRouter();
const authStore = useAuthStore();

/* ─────────────── who is reading ─────────────── */

/** The same flattening the sidebar does, so a lock here is a hidden entry there. */
const access = computed<Access>(() => ({
  auth: authStore.isAuthenticated,
  ai: authStore.hasAiAccess,
  lab: authStore.hasLabAccess,
  runbook: authStore.hasRunbookAccess,
  research: authStore.hasResearchFlowAccess,
  toastmasters: authStore.hasToastmastersAccess,
  exam: authStore.hasExamFeature,
  proctor: authStore.isProctor,
}));

/* ─────────────── the catalogues ─────────────── */

type SourceState = 'loading' | 'ok' | 'error';
const state = reactive<Record<SourceId, SourceState>>({
  courses: 'loading', lessons: 'loading', labs: 'loading', assessments: 'loading', runbooks: 'loading',
});
const data = reactive<{ [K in SourceId]: SourcePayloads[K] | null }>({
  courses: null, lessons: null, labs: null, assessments: null, runbooks: null,
});

let alive = true;

/**
 * Serve what we already have, refresh behind it when it is old, and only show
 * an error when there is nothing at all to show.
 */
function fetchSource<K extends SourceId>(id: K, force = false): Promise<void> {
  const have = data[id] ?? cached(id);
  if (have) {
    (data as Record<SourceId, unknown>)[id] = have;
    state[id] = 'ok';
    if (!force && !wantsRefresh(id)) return Promise.resolve();
  } else {
    state[id] = 'loading';
  }
  return load(id).then(rows => {
    if (!alive) return;
    (data as Record<SourceId, unknown>)[id] = rows;
    state[id] = 'ok';
  }, () => {
    if (!alive) return;
    state[id] = data[id] ? 'ok' : 'error';
  });
}

function loadAll() {
  // The cheap catalogues together, then the lesson list -- by far the heaviest
  // request, and the one that must not delay the others.
  const first = (['courses', 'labs', 'assessments', 'runbooks'] as const).map(id => fetchSource(id));
  void Promise.race([Promise.allSettled(first), new Promise(r => setTimeout(r, 1500))])
    .then(() => { if (alive) void fetchSource('lessons'); });
}

/* ─────────────── the documents ─────────────── */

const empty = <T,>(): T[] => [];

const docs = computed<SearchDoc[]>(() => {
  const locale = localeId.value;
  const courses = data.courses ?? empty();
  const lessons = data.lessons ?? empty();
  const labs = data.labs;
  const assessments = data.assessments;
  return [
    ...pageDocs(access.value, t),
    ...courseDocs(courses, locale),
    ...lessonDocs(lessons, courses, locale),
    ...(labs ? labDocs(labs.labs, labs.tracks, labs.playgrounds, locale, access.value, t) : []),
    ...(assessments ? quizDocs(assessments.quizzes, lessons, courses, locale, access.value) : []),
    ...(assessments ? examDocs(assessments.exams, courses, locale) : []),
    ...runbookDocs(data.runbooks ?? empty(), lessons, courses, locale, access.value),
  ];
});

const index = computed(() => buildIndex(docs.value));

/* ─────────────── the query ─────────────── */

/** What the results are computed from: the query, after the reader pauses. */
const debounced = ref(props.query);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(() => props.query, value => {
  if (debounceTimer) clearTimeout(debounceTimer);
  // Clearing is instant; typing waits for a pause.
  if (!value.trim()) { debounced.value = value; return; }
  debounceTimer = setTimeout(() => { debounced.value = value; }, 110);
});
function flush() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounced.value = props.query;
}

const hasQuery = computed(() => debounced.value.trim().length > 0);
const expanded = ref<SectionId[]>([]);
watch(debounced, () => { expanded.value = []; });

const results = computed(() => search(index.value, debounced.value, {
  limit: DEFAULT_LIMIT, expanded: expanded.value, expandedLimit: EXPANDED_LIMIT,
}));

const SOURCE_OF: Record<SectionId, SourceId | null> = {
  pages: null, courses: 'courses', lessons: 'lessons', labs: 'labs',
  quizzes: 'assessments', exams: 'assessments', runbooks: 'runbooks',
};

const sectionState = (section: SectionId): SourceState => {
  const source = SOURCE_OF[section];
  return source ? state[source] : 'ok';
};

/* ─────────────── recent searches ─────────────── */

// Declared ABOVE the computeds that read it: a watcher below evaluates them
// during setup, and a `const` read before its declaration is a temporal dead
// zone (the TDZ CLAUDE.md records twice). Order is load-bearing here.

const recentKey = computed(() => `sfs-gs-recent:${authStore.user?.username || 'guest'}`);
const recent = ref<string[]>([]);

function readRecent() {
  try {
    recent.value = cleanRecent(JSON.parse(localStorage.getItem(recentKey.value) || '[]'));
  } catch {
    recent.value = [];
  }
}
function writeRecent() {
  try { localStorage.setItem(recentKey.value, JSON.stringify(recent.value)); } catch { /* quota */ }
}
function rememberQuery() {
  if (!props.query.trim()) return;
  recent.value = addRecent(recent.value, props.query);
  writeRecent();
}
function clearRecent() {
  recent.value = [];
  try { localStorage.removeItem(recentKey.value); } catch { /* nothing to do */ }
}
watch(recentKey, readRecent);

/* ─────────────── the rows, and the keyboard's view of them ─────────────── */

type Option =
  | { kind: 'hit'; section: string; doc: SearchDoc }
  | { kind: 'quick'; section: string; doc: SearchDoc }
  | { kind: 'recent'; section: string; text: string }
  | { kind: 'more'; section: string; target: SectionId }
  | { kind: 'retry'; section: string; target: SectionId };

interface Block {
  section: SectionId;
  state: SourceState;
  total: number;
  more: number;
  expanded: boolean;
  rows: { hit: Hit; index: number }[];
  moreIndex: number;
  retryIndex: number;
}

/** The shortcuts offered before anything is typed, and when nothing matched. */
const QUICK_PATHS = ['/courses', '/roadmaps', '/labs', '/exams', '/runbooks', '/playgrounds', '/leaderboard'];
const quickDocs = computed(() => {
  const pages = docs.value.filter(d => d.section === 'pages');
  return QUICK_PATHS
    .map(path => pages.find(d => d.id === path))
    .filter((d): d is SearchDoc => !!d);
});

/** The panel, as the keyboard walks it: every option in render order. */
const view = computed(() => {
  const options: Option[] = [];
  const recentRows: { text: string; index: number }[] = [];
  const quickRows: { doc: SearchDoc; index: number }[] = [];
  const blocks: Block[] = [];

  if (!hasQuery.value) {
    for (const text of recent.value) {
      recentRows.push({ text, index: options.length });
      options.push({ kind: 'recent', section: 'recent', text });
    }
    for (const doc of quickDocs.value) {
      quickRows.push({ doc, index: options.length });
      options.push({ kind: 'quick', section: 'quick', doc });
    }
    return { options, recentRows, quickRows, blocks };
  }

  for (const result of results.value) {
    const st = sectionState(result.section);
    if (!result.total && st === 'ok') continue;
    const block: Block = {
      section: result.section, state: st, total: result.total, more: result.more,
      expanded: expanded.value.includes(result.section),
      rows: [], moreIndex: -1, retryIndex: -1,
    };
    if (!result.total && st === 'error') {
      block.retryIndex = options.length;
      options.push({ kind: 'retry', section: result.section, target: result.section });
    }
    for (const hit of result.hits) {
      block.rows.push({ hit, index: options.length });
      options.push({ kind: 'hit', section: result.section, doc: hit.doc });
    }
    if (result.total && (result.more || block.expanded) && result.total > DEFAULT_LIMIT) {
      block.moreIndex = options.length;
      options.push({ kind: 'more', section: result.section, target: result.section });
    }
    blocks.push(block);
  }

  // Nothing anywhere: the "browse instead" shortcuts are the options.
  if (!blocks.length) {
    for (const doc of quickDocs.value) {
      quickRows.push({ doc, index: options.length });
      options.push({ kind: 'quick', section: 'quick', doc });
    }
  }
  return { options, recentRows, quickRows, blocks };
});

const blocks = computed(() => view.value.blocks);
const recentRows = computed(() => view.value.recentRows);
const quickRows = computed(() => view.value.quickRows);
const options = computed(() => view.value.options);

/** Results still arriving from some service, while others are already shown. */
const pending = computed(() => hasQuery.value
  && SECTIONS.some(s => sectionState(s) === 'loading'));

/* ─────────────── the active row ─────────────── */

const active = ref(-1);
const listEl = ref<HTMLElement | null>(null);
const sheetInput = ref<HTMLInputElement | null>(null);
const closeBtn = ref<HTMLButtonElement | null>(null);

const optionId = (i: number) => `${props.listboxId}-opt-${i}`;
const activeId = computed(() => (active.value >= 0 && active.value < options.value.length
  ? optionId(active.value) : ''));

/**
 * The best-scoring result anywhere in the panel. Sections are drawn in a fixed
 * order (pages first), so the FIRST row is often a page that matched on a
 * keyword while the course whose title IS the query sits further down; Enter
 * should open the course.
 */
/** Roughly the rows visible when the panel opens. */
const AUTO_WINDOW = 7;
const bestIndex = computed(() => {
  let best = -1;
  let score = -Infinity;
  for (const block of view.value.blocks) {
    for (const row of block.rows) {
      // Only among the rows the panel opens on: a best match twenty rows down
      // would scroll the panel past everything above it before the reader had
      // seen any of it. Further down, the first row stays the default.
      if (row.index >= AUTO_WINDOW) continue;
      if (row.hit.score > score) { score = row.hit.score; best = row.index; }
    }
  }
  return best >= 0 ? best : (hasQuery.value && options.value.length ? 0 : -1);
});

/**
 * Until the reader moves the cursor themselves, it follows the best result -
 * including as slower catalogues arrive and a better match appears. Once they
 * have pressed an arrow, Tab or moved the mouse, it is theirs and stays put.
 */
const following = ref(true);
watch(debounced, () => { following.value = true; });
watch(bestIndex, index => { if (following.value) active.value = index; }, { immediate: true });
// The list can shrink under the cursor as a catalogue arrives.
watch(() => options.value.length, count => {
  if (active.value >= count) active.value = count ? count - 1 : -1;
});

/** A real pointer movement takes the cursor; a row rendered under a resting pointer does not. */
function hover(index: number) {
  if (active.value === index) return;
  following.value = false;
  active.value = index;
}
watch(activeId, id => {
  emit('active', id);
  if (!id) return;
  void nextTick(() => {
    const el = document.getElementById(id);
    el?.scrollIntoView?.({ block: 'nearest' });
  });
});

/* ─────────────── doing things ─────────────── */

function navigate(doc: SearchDoc) {
  rememberQuery();
  emit('navigated');
  void router.push(destination(doc));
}

/** Follow the link; a modified click (new tab, new window) leaves the panel open. */
function onLinkClick(event: MouseEvent, doc: SearchDoc) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  rememberQuery();
  emit('navigated');
}

function activate(i: number) {
  const option = options.value[i];
  if (!option) return;
  if (option.kind === 'hit' || option.kind === 'quick') navigate(option.doc);
  else if (option.kind === 'recent') {
    emit('update:query', option.text);
    debounced.value = option.text;
  } else if (option.kind === 'more') {
    const set = new Set(expanded.value);
    if (set.has(option.target)) set.delete(option.target); else set.add(option.target);
    expanded.value = [...set];
  } else if (option.kind === 'retry') {
    const source = SOURCE_OF[option.target];
    if (source) void fetchSource(source, true);
  }
}

/**
 * The combobox keys. Returns true when it handled the key, so the field in the
 * top bar can leave everything else alone.
 *
 * Tab moves to the next SECTION while there are results, and falls through at
 * either end so focus leaves the field the way Tab always does.
 */
function onKey(event: KeyboardEvent): boolean {
  if (event.isComposing) return false; // an IME is still choosing a character
  const count = options.value.length;
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      if (props.query !== debounced.value) flush();
      event.preventDefault();
      following.value = false;
      active.value = stepActive(options.value.length, active.value, event.key === 'ArrowDown' ? 1 : -1);
      return true;
    }
    case 'Tab': {
      if (!hasQuery.value || !count) {
        if (props.mode !== 'sheet') return false;
        event.preventDefault();
        closeBtn.value?.focus();
        return true;
      }
      const next = sectionJump(options.value, active.value, event.shiftKey);
      if (next === null) {
        // The sheet is modal: Tab past the last section goes to its close
        // button rather than to the page hidden behind it.
        if (props.mode !== 'sheet') return false;
        event.preventDefault();
        closeBtn.value?.focus();
        return true;
      }
      event.preventDefault();
      following.value = false;
      active.value = next;
      return true;
    }
    case 'Enter': {
      if (props.query !== debounced.value) flush();
      const target = active.value >= 0 ? active.value : (hasQuery.value ? 0 : -1);
      if (target < 0 || !options.value[target]) return false;
      event.preventDefault();
      activate(target);
      return true;
    }
    case 'Escape': {
      event.preventDefault();
      event.stopPropagation();
      emit('close', true);
      return true;
    }
    default:
      return false;
  }
}

/** A press inside the panel must not move focus out of the field being typed in. */
function keepFocus(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('input, textarea')) return;
  event.preventDefault();
}



/* ─────────────── words ─────────────── */

/** Literal `t()` calls, so `check:i18n` can see every key. */
function sectionLabel(section: SectionId): string {
  switch (section) {
    case 'pages': return t('Pages & apps');
    case 'courses': return t('Courses');
    case 'lessons': return t('Lessons');
    case 'labs': return t('Labs & playgrounds');
    case 'quizzes': return t('Quizzes');
    case 'exams': return t('Exams');
    case 'runbooks': return t('Runbooks');
    default: return section;
  }
}

function lockLabel(doc: SearchDoc): string {
  const lock = doc.lock;
  if (!lock) return '';
  if (lock.kind === 'signin') return t('Sign in to open');
  switch (lock.feature) {
    case 'lab': return t('Needs a plan with labs');
    case 'runbook': return t('Needs a plan with runbooks');
    case 'ai': return t('Needs a plan with AI tools');
    case 'research': return t('Needs a plan with Research Flow');
    case 'toastmasters': return t('Needs a plan with Toastmasters');
    case 'exam': return t('Needs a plan with exams');
    default: return t('Needs a subscription');
  }
}

const announcement = computed(() => {
  if (!hasQuery.value) return '';
  const total = blocks.value.reduce((sum, b) => sum + b.total, 0);
  if (!total) return pending.value ? t('Some results are still loading') : t('No results');
  return t('{v0} results', { v0: n(total) });
});

/* ─────────────── glyphs ─────────────── */

const SECTION_ICONS: Record<SectionId, Component> = {
  pages: LayoutGrid, courses: BookOpen, lessons: FileText, labs: FlaskConical,
  quizzes: ListChecks, exams: GraduationCap, runbooks: BookMarked,
};

/** One glyph per sidebar icon name (exhaustive: a new name is a type error here). */
const PAGE_ICONS: Record<IconName, Component> = {
  home: Home, grid: LayoutGrid, courses: BookOpen, exams: ClipboardCheck, runbooks: BookMarked,
  lab: FlaskConical, netsim: Network, certificate: Award, allCertificates: Medal,
  results: BarChart3, plans: CreditCard, myPlans: Wallet, profile: User, notifications: Bell,
  messages: MessageCircle, draw: PenTool, ai: Sparkles, research: Microscope, toastmasters: Mic,
  jobInterview: Briefcase, roblox: Gamepad2, cvBuilder: FileUser, proctor: ShieldCheck,
  list: List, plus: Plus, search: SearchIcon, library: Library, users: Users, write: PenLine,
  import: Import, globe: Globe, play: Play, calendar: Calendar, check: Check, layers: Layers,
  learn: GraduationCap, idCard: IdCard, database: Database, terminal: Terminal, python: FileCode,
  newscast: Radio, leaderboard: Trophy, car: Car, roadmap: Route,
};

const DOC_ICONS: Record<string, Component> = {
  course: BookOpen, lesson: FileText, lab: FlaskConical, playground: Shapes,
  quiz: ListChecks, exam: GraduationCap, runbook: BookMarked,
};

const iconFor = (name: string): Component =>
  DOC_ICONS[name] || PAGE_ICONS[name as IconName] || Package;

/* ─────────────── lifecycle ─────────────── */

/** The page behind a full-screen sheet must not scroll under the reader's thumb. */
watch(() => props.mode, mode => {
  document.documentElement.classList.toggle('sfs-gs-lock', mode === 'sheet');
}, { immediate: true });

onMounted(() => {
  readRecent();
  loadAll();
  if (props.mode === 'sheet') void nextTick(() => sheetInput.value?.focus());
});
onBeforeUnmount(() => {
  alive = false;
  document.documentElement.classList.remove('sfs-gs-lock');
  if (debounceTimer) clearTimeout(debounceTimer);
  emit('active', '');
});

defineExpose({ onKey });
</script>
