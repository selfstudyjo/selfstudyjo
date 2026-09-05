<template>
  <!--
    A dialog rather than a route, and that is a deliberate choice.

    A `/learner/:id` route would be a public profile page, and this platform
    does not have one on purpose - `/profile` is your own, so a name on the
    board is a label and not a doorway. A panel opened from a row is the same
    information without becoming an addressable page that search engines index
    and that somebody can send a link to.
  -->
  <div
    class="lb-sheet"
    role="dialog"
    aria-modal="true"
    :aria-label="$t('Activity record for {v0}', { v0: dossier.name || $t('this learner') })"
    @click.self="$emit('close')"
  >
    <div class="lb-sheet__panel" ref="panel" tabindex="-1">
      <!-- ------------------------------------------------------------ -->
      <!-- Who, and the headline figures                                -->
      <!-- ------------------------------------------------------------ -->
      <header class="lb-sheet__head">
        <div class="lb-sheet__who">
          <span class="lb-sheet__avatar">
            <img
              v-if="dossier.avatarUrl && !brokenAvatar"
              :src="getProxiedImageUrl(dossier.avatarUrl)"
              :alt="$t('{v0}\'s picture', { v0: dossier.name })"
              loading="lazy"
              decoding="async"
              @error="brokenAvatar = true"
            />
            <span v-else aria-hidden="true">{{ initialsOf(dossier.name) }}</span>
          </span>
          <div>
            <p class="lb-sheet__eyebrow">
              {{ row ? $t('Rank {v0}', { v0: row.rank }) : $t('Activity record') }}
            </p>
            <h2 class="lb-sheet__name">{{ dossier.name || $t('Learner') }}</h2>
            <p class="lb-sheet__sub">
              {{ $t('Everything on this platform, with the time it happened. This record is public.') }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="lb-sheet__close"
          :aria-label="$t('Close the activity record')"
          @click="$emit('close')"
        >&times;</button>
      </header>

      <!-- ------------------------------------------------------------ -->
      <!-- The point split, which is the panel's whole reason for being  -->
      <!-- ------------------------------------------------------------ -->
      <section class="lb-sheet__tiles" :aria-label="$t('Points')">
        <article class="lb-sheet__tile lb-sheet__tile--lead">
          <p class="lb-sheet__tileLabel">{{ $t('Total points') }}</p>
          <p class="lb-sheet__tileValue">{{ dossier.points.toLocaleString() }}</p>
          <p class="lb-sheet__tileFoot">{{ $t('achievements and conduct together') }}</p>
        </article>
        <article class="lb-sheet__tile">
          <p class="lb-sheet__tileLabel">{{ $t('Earned by achievement') }}</p>
          <p class="lb-sheet__tileValue">{{ dossier.achievementPoints.toLocaleString() }}</p>
          <p class="lb-sheet__tileFoot">{{ $t('exams, quizzes, labs, certificates') }}</p>
        </article>
        <!--
          The one figure on the platform that can be negative, and it is given
          its own tile for exactly that reason: a total that quietly went down
          tells nobody why.
        -->
        <article
          class="lb-sheet__tile"
          :class="dossier.conductPoints < 0 ? 'is-down' : dossier.conductPoints > 0 ? 'is-up' : ''"
        >
          <p class="lb-sheet__tileLabel">{{ $t('Conduct') }}</p>
          <p class="lb-sheet__tileValue">{{ signed(dossier.conductPoints) }}</p>
          <p class="lb-sheet__tileFoot">
            {{ $t('{v0} earned, {v1} lost', { v0: dossier.conduct.positives, v1: dossier.conduct.negatives }) }}
          </p>
        </article>
        <article class="lb-sheet__tile">
          <p class="lb-sheet__tileLabel">{{ $t('Active days') }}</p>
          <p class="lb-sheet__tileValue">{{ activeDayCount }}</p>
          <p class="lb-sheet__tileFoot">
            {{ dossier.firstActiveAt ? $t('since {v0}', { v0: shortDate(dossier.firstActiveAt) }) : $t('no dated activity') }}
          </p>
        </article>
      </section>

      <!--
        A voided sitting is said ONCE, at the top, and in words.

        Buried in a list of thirty lines it would read as one entry among many,
        and it is not: it is the only thing here that changed a mark. It names
        the count and points at the ledger rather than restating the breaches,
        because the ledger is directly below and a second copy of the list is a
        second thing that can go stale.
      -->
      <p
        v-if="dossier.conduct.voidedSittings.length"
        class="lb-sheet__void"
        role="status"
      >
        <strong>{{ $t('{v0} sitting(s) were ended for cheating and scored zero.', { v0: dossier.conduct.voidedSittings.length }) }}</strong>
        {{ $t('Five recorded integrity breaches end an exam or a quiz. Every action is in the record below with the time it happened.') }}
      </p>

      <!-- ------------------------------------------------------------ -->
      <!-- Tabs, because six lists stacked is a page nobody scrolls      -->
      <!-- ------------------------------------------------------------ -->
      <div class="lb-sheet__tabs" role="tablist" :aria-label="$t('Which part of the record')">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="lb-sheet__tab"
          :class="{ 'is-active': active === tab.id }"
          :aria-selected="active === tab.id"
          @click="active = tab.id"
        >
          {{ tab.label }}
          <span v-if="tab.count !== null" class="lb-sheet__tabCount">{{ tab.count }}</span>
        </button>
      </div>

      <!-- ------------------------------------------------------------ -->
      <!-- Everything, newest first                                      -->
      <!-- ------------------------------------------------------------ -->
      <section v-show="active === 'ledger'" class="lb-sheet__body" role="tabpanel">
        <p class="lb-sheet__note">
          {{ $t('Every action, in the order it happened. A line with no points beside it changed nothing — it is here because it is what the rest is read against.') }}
        </p>
        <ol v-if="dossier.ledger.length" class="lb-feed">
          <li
            v-for="line in shownLedger"
            :key="line.id"
            class="lb-feed__row"
            :class="`is-${line.severity}`"
          >
            <span class="lb-feed__mark" aria-hidden="true"></span>
            <div class="lb-feed__text">
              <p class="lb-feed__title">
                {{ $t(line.title) }}
                <span v-if="line.title !== kindLabel(line.kind)" class="lb-feed__kind">
                  {{ $t(kindLabel(line.kind)) }}
                </span>
              </p>
              <p v-if="line.reason" class="lb-feed__why">{{ $t(line.reason, reasonParams(line)) }}</p>
              <p class="lb-feed__meta">
                <span class="lb-feed__when" :title="fullDate(line.at)">{{ when(line.at) }}</span>
                <span v-if="line.detail" class="lb-feed__detail">{{ line.detail }}</span>
                <span v-if="typeof line.score === 'number'" class="lb-feed__score">
                  {{ $t('{v0}%', { v0: line.score }) }}
                </span>
              </p>
            </div>
            <span
              v-if="line.points !== 0"
              class="lb-feed__points"
              :class="line.points > 0 ? 'is-up' : 'is-down'"
            >{{ signed(line.points) }}</span>
            <span v-else class="lb-feed__points is-flat" :aria-label="$t('no points')">—</span>
          </li>
        </ol>
        <p v-else class="lb-sheet__empty">{{ $t('Nothing has been recorded for this learner yet.') }}</p>
        <button
          v-if="shownLedger.length < dossier.ledger.length"
          type="button"
          class="lb-sheet__more"
          @click="ledgerShown += LEDGER_PAGE"
        >
          {{ $t('Show {v0} more', { v0: Math.min(LEDGER_PAGE, dossier.ledger.length - shownLedger.length) }) }}
        </button>
      </section>

      <!-- ------------------------------------------------------------ -->
      <!-- Conduct: the reasons, per action                              -->
      <!-- ------------------------------------------------------------ -->
      <section v-show="active === 'conduct'" class="lb-sheet__body" role="tabpanel">
        <p class="lb-sheet__note">
          {{ $t('What was earned and what was lost, per kind of action. Nothing here records what was copied or typed — a copy is recorded as a character count and never as the text.') }}
        </p>
        <!--
          A LIST WITH METERS, not a chart.

          The values are signed and about half of them are negative, and a
          Chart.js series of negatives would either need a second colour to
          read - which working rule 37 rules out, because no galaxy's accents
          separate reliably - or would have to be plotted as magnitudes with
          the sign only in the table twin, which is a chart that is wrong about
          its own data. A meter per row carries the magnitude and the number
          carries the sign.
        -->
        <ul v-if="dossier.conduct.byAction.length" class="lb-conduct">
          <li v-for="row in dossier.conduct.byAction" :key="row.action" class="lb-conduct__row">
            <div class="lb-conduct__head">
              <span class="lb-conduct__label">{{ $t(row.label) }}</span>
              <span class="lb-conduct__count">{{ $t('{v0}×', { v0: row.count }) }}</span>
              <span
                class="lb-conduct__points"
                :class="row.points > 0 ? 'is-up' : row.points < 0 ? 'is-down' : 'is-flat'"
              >{{ row.points === 0 ? '—' : signed(row.points) }}</span>
            </div>
            <div
              class="lb-sheet__meter"
              :class="row.points < 0 ? 'is-down' : ''"
              role="meter"
              :aria-valuenow="Math.abs(row.points)"
              aria-valuemin="0"
              :aria-valuemax="conductPeak"
              :aria-label="`${row.label}: ${Math.abs(row.points)} points`"
            >
              <span class="lb-sheet__meterFill" :style="{ width: conductWidth(row.points) + '%' }"></span>
            </div>
            <p v-if="row.reason" class="lb-conduct__why">{{ row.reason }}</p>
          </li>
        </ul>
        <p v-else class="lb-sheet__empty">
          {{ $t('No conduct has been recorded — this learner has sat nothing since the practice record was introduced.') }}
        </p>
      </section>

      <!-- ------------------------------------------------------------ -->
      <!-- Assessments, passed and failed                                -->
      <!-- ------------------------------------------------------------ -->
      <section v-show="active === 'results'" class="lb-sheet__body" role="tabpanel">
        <div class="lb-sheet__cols">
          <div>
            <h3 class="lb-sheet__h3">{{ $t('Exams') }}</h3>
            <ul v-if="dossier.exams.passed.length || dossier.exams.failed.length" class="lb-list">
              <li v-for="row in dossier.exams.passed" :key="row.subjectId" class="lb-list__row is-pass">
                <span class="lb-list__title">{{ row.title || $t('An exam the platform cannot name') }}</span>
                <span class="lb-list__score">{{ row.score === null ? '—' : `${row.score}%` }}</span>
                <span class="lb-list__when">{{ when(row.at) }}</span>
              </li>
              <li v-for="row in dossier.exams.failed" :key="`f-${row.subjectId}`" class="lb-list__row is-fail">
                <span class="lb-list__title">{{ row.title || $t('An exam the platform cannot name') }}</span>
                <span class="lb-list__score">{{ row.score === null ? '—' : `${row.score}%` }}</span>
                <span class="lb-list__when">{{ when(row.at) }}</span>
              </li>
            </ul>
            <p v-else class="lb-sheet__empty">{{ $t('No exam sat.') }}</p>
          </div>
          <div>
            <h3 class="lb-sheet__h3">{{ $t('Quizzes') }}</h3>
            <ul v-if="dossier.quizzes.passed.length || dossier.quizzes.failed.length" class="lb-list">
              <li v-for="row in dossier.quizzes.passed" :key="row.subjectId" class="lb-list__row is-pass">
                <span class="lb-list__title">{{ row.title || $t('A quiz — the platform cannot name one without publishing its answer key') }}</span>
                <span class="lb-list__score">{{ row.score === null ? '—' : `${row.score}%` }}</span>
                <span class="lb-list__when">{{ when(row.at) }}</span>
              </li>
              <li v-for="row in dossier.quizzes.failed" :key="`f-${row.subjectId}`" class="lb-list__row is-fail">
                <span class="lb-list__title">{{ row.title || $t('A quiz — the platform cannot name one without publishing its answer key') }}</span>
                <span class="lb-list__score">{{ row.score === null ? '—' : `${row.score}%` }}</span>
                <span class="lb-list__when">{{ when(row.at) }}</span>
              </li>
            </ul>
            <p v-else class="lb-sheet__empty">{{ $t('No quiz taken.') }}</p>
          </div>
        </div>
        <p class="lb-sheet__note">
          {{ $t('Only the best attempt at each assessment is shown, which is the same attempt the ranking counts. A failure earns nothing and stays on the record.') }}
        </p>
      </section>

      <!-- ------------------------------------------------------------ -->
      <!-- Labs and courses                                              -->
      <!-- ------------------------------------------------------------ -->
      <section v-show="active === 'work'" class="lb-sheet__body" role="tabpanel">
        <div class="lb-sheet__cols">
          <div>
            <h3 class="lb-sheet__h3">
              {{ $t('Labs finished') }}
              <span class="lb-sheet__tabCount">{{ dossier.labsCompleted.length }}</span>
            </h3>
            <ul v-if="dossier.labsCompleted.length" class="lb-list">
              <li v-for="lab in dossier.labsCompleted" :key="lab.labId" class="lb-list__row is-pass">
                <span class="lb-list__title">{{ lab.labName || lab.labId }}</span>
                <span class="lb-list__score">{{ $t('{v0}/{v1} tasks', { v0: lab.earned, v1: lab.possible }) }}</span>
                <span class="lb-list__when">{{ when(lab.completedAt || lab.lastAt) }}</span>
              </li>
            </ul>
            <p v-else class="lb-sheet__empty">{{ $t('No lab finished yet.') }}</p>

            <h3 class="lb-sheet__h3">
              {{ $t('Labs in progress') }}
              <span class="lb-sheet__tabCount">{{ dossier.labsCurrent.length }}</span>
            </h3>
            <ul v-if="dossier.labsCurrent.length" class="lb-list">
              <li v-for="lab in dossier.labsCurrent" :key="lab.labId" class="lb-list__row">
                <span class="lb-list__title">{{ lab.labName || lab.labId }}</span>
                <span class="lb-list__score">{{ $t('{v0} of {v1}', { v0: lab.earned, v1: lab.possible }) }}</span>
                <span class="lb-list__when">{{ when(lab.lastAt) }}</span>
              </li>
            </ul>
            <p v-else class="lb-sheet__empty">{{ $t('Nothing open at the moment.') }}</p>
          </div>
          <div>
            <h3 class="lb-sheet__h3">
              {{ $t('Courses enrolled') }}
              <span class="lb-sheet__tabCount">{{ dossier.enrolments.length }}</span>
            </h3>
            <ul v-if="dossier.enrolments.length" class="lb-list">
              <li v-for="row in dossier.enrolments" :key="row.courseId" class="lb-list__row">
                <span class="lb-list__title">{{ row.courseName || row.courseId }}</span>
                <span class="lb-list__when">{{ when(row.at) }}</span>
              </li>
            </ul>
            <p v-else class="lb-sheet__empty">{{ $t('Not enrolled on anything.') }}</p>

            <h3 class="lb-sheet__h3">
              {{ $t('Credentials') }}
              <span class="lb-sheet__tabCount">{{ dossier.credentials.length }}</span>
            </h3>
            <ul v-if="dossier.credentials.length" class="lb-list">
              <li v-for="row in dossier.credentials" :key="`${row.kind}-${row.subjectId}`" class="lb-list__row is-pass">
                <span class="lb-list__title">{{ row.title || row.subjectId }}</span>
                <span class="lb-list__score">
                  {{ row.kind === 'course_certificate' ? $t('course') : $t('exam') }}
                </span>
                <span class="lb-list__when">{{ when(row.at) }}</span>
              </li>
            </ul>
            <p v-else class="lb-sheet__empty">{{ $t('None issued.') }}</p>
          </div>
        </div>
        <p class="lb-sheet__note">
          {{ $t('Enrolling on a course earns nothing — it is here because it is what somebody is working on. An exam certificate earns nothing either: the pass already earned the points.') }}
        </p>
      </section>

      <!-- ------------------------------------------------------------ -->
      <!-- Charts                                                        -->
      <!-- ------------------------------------------------------------ -->
      <section v-show="active === 'charts'" class="lb-sheet__body" role="tabpanel">
        <div class="lb-sheet__charts">
          <LeaderboardChart
            :title="$t('Points over time')"
            :subtitle="$t('The running total, including the quiet periods — a series that skipped them would imply activity that never happened.')"
            kind="area"
            :labels="series.map(point => point.label)"
            :values="series.map(point => point.cumulative)"
            :category-label="$t('Period')"
            :value-label="$t('Points')"
            :height="220"
            :empty-text="$t('Nothing dated to plot.')"
          />
          <LeaderboardChart
            :title="$t('Activity over time')"
            :subtitle="$t('How many things happened in each period. Beside the points and not instead of them: a busy period that lost most of its points is not a quiet one.')"
            kind="column"
            :labels="series.map(point => point.label)"
            :values="series.map(point => point.count)"
            :emphasis="busiestIndex"
            :category-label="$t('Period')"
            :value-label="$t('Actions')"
            :height="220"
            :empty-text="$t('Nothing dated to plot.')"
          />
          <LeaderboardChart
            v-if="sources.length"
            :title="$t('Where the points came from')"
            :subtitle="$t('Only the sources that earned. Conduct is shown on its own tile above, because it is the one figure here that can be negative.')"
            kind="bar"
            :labels="sources.map(row => $t(row.label))"
            :values="sources.map(row => row.points)"
            :emphasis="0"
            :category-label="$t('Source')"
            :value-label="$t('Points')"
            :height="Math.max(180, sources.length * 42 + 48)"
            :empty-text="$t('Nothing earned yet.')"
          />
        </div>
      </section>

      <footer class="lb-sheet__foot">
        <p>
          {{ $t('Built in your browser from the same public collections the board is built from. No account identifiers are shown, and no answer, question or copied text is ever recorded.') }}
        </p>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * One learner's activity record.
 *
 * The component draws; `learnerDossier.ts` decides. Every list, every total and
 * every series comes out of `buildDossier` in one pass, which is what stops the
 * tiles at the top disagreeing with the lists below them - the failure mode of
 * a panel that derives each section where it renders it.
 *
 * WHAT IS AND IS NOT PUBLISHED HERE
 *
 * This panel is reachable by anybody, because the leaderboard is. It shows a
 * name, totals, what was passed and failed, and every recorded action with its
 * time. It shows **no account id** (see `matchesQuery` in the engine for why
 * even the search does not match one) and **no content** - not an answer, not a
 * question, and not what was copied. `practiceIntegrity.describeCopy` turns a
 * copied selection into a character count before it ever leaves the browser,
 * and app 20 truncates the detail again on the way in, because the text copied
 * during an exam is the exam paper and this page needs no account.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import LeaderboardChart from '@/components/leaderboard/LeaderboardChart.vue';
import type { Params } from '@/i18n';
import { getProxiedImageUrl } from '@/utils/imageUtils';
import { initialsOf, type Achievement, type LeaderRow } from '@/utils/leaderboardEngine';
import {
    KIND_LABELS,
    activeDays,
    pointsBySource,
    pointsSeries,
    reasonFor,
    type Dossier,
    type LedgerLine,
} from '@/utils/learnerDossier';

/*
  ITS OWN STYLESHEET, loaded from here rather than from the view.

  Global rather than `<style scoped>` because the sheet wraps
  `LeaderboardChart`, whose card a scoped sheet could not reach - the same
  reason `Leaderboard.vue` loads its own that way. Loaded HERE so it travels
  in this component's chunk: the view defers this component, and a stylesheet
  imported by the view would stay in the entry chunk and undo half the split.

  Every selector in it is `lb-`-prefixed and used by this file alone, which is
  what `check:cssleaks` requires of a globally loaded page stylesheet - and it
  is in that check's GATED set, so it has to stay at zero.
*/
import '@/assets/css/leaderboard-activity.css';

const props = defineProps<{
    dossier: Dossier;
    row?: LeaderRow | null;
    /** The page's own `now`, so every panel and chart measures from one moment. */
    now: number;
}>();

const emit = defineEmits<{ (event: 'close'): void }>();

/** How many ledger lines a click of "Show more" reveals. */
const LEDGER_PAGE = 40;

const active = ref<'ledger' | 'conduct' | 'results' | 'work' | 'charts'>('ledger');
const ledgerShown = ref(LEDGER_PAGE);
const brokenAvatar = ref(false);
const panel = ref<HTMLElement | null>(null);

const tabs = computed(() => [
    { id: 'ledger' as const, label: 'Everything', count: props.dossier.ledger.length },
    { id: 'conduct' as const, label: 'Conduct', count: props.dossier.conduct.negatives + props.dossier.conduct.positives },
    { id: 'results' as const, label: 'Results', count: props.dossier.exams.passed.length + props.dossier.exams.failed.length + props.dossier.quizzes.passed.length + props.dossier.quizzes.failed.length },
    { id: 'work' as const, label: 'Labs and courses', count: props.dossier.labsCompleted.length + props.dossier.labsCurrent.length + props.dossier.enrolments.length },
    { id: 'charts' as const, label: 'Charts', count: null },
]);

const shownLedger = computed(() => props.dossier.ledger.slice(0, ledgerShown.value));

const series = computed(() => pointsSeries(props.dossier.ledger, { now: props.now }));

/** The busiest period, lifted out of the set. Null when there is no single one. */
const busiestIndex = computed(() => {
    const counts = series.value.map(point => point.count);
    const peak = Math.max(...counts, 0);
    if (peak <= 0) return null;
    // A single peak only. Two periods tied for the lead is not "the one the
    // story is about", and emphasising the first would be arbitrary.
    return counts.filter(count => count === peak).length === 1
        ? counts.indexOf(peak) : null;
});

const sources = computed(() =>
    pointsBySource(props.dossier.ledger).filter(row => row.points > 0));

const activeDayCount = computed(() => activeDays(props.dossier.ledger));

const conductPeak = computed(() => Math.max(
    1, ...props.dossier.conduct.byAction.map(row => Math.abs(row.points))));

function conductWidth(points: number): number {
    // Floored at 4% so a single-point action still shows a mark rather than an
    // empty track, which reads as missing data.
    return Math.max(4, Math.min(100, (Math.abs(points) / conductPeak.value) * 100));
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

function signed(value: number): string {
    if (!Number.isFinite(value)) return '0';
    // A MINUS SIGN, not a hyphen. Inside Arabic prose a hyphen is a neutral
    // character and the bidi algorithm is free to move it away from its digits;
    // U+2212 is not, and it is also what a typographer would use.
    return value > 0 ? `+${value.toLocaleString()}`
        : value < 0 ? `−${Math.abs(value).toLocaleString()}`
            : '0';
}

/*
  The table lives in `learnerDossier.ts`, not here.

  It is reached through a variable, so `check:i18n` can only verify it by
  importing it - and it cannot import a `.vue` file. Same reason
  `BADGE_NAMES` is in `dashboardProgress.ts` rather than in Home.vue.
*/
function kindLabel(kind: Achievement): string {
    return KIND_LABELS[kind] || String(kind);
}

/**
 * The params a ledger line's reason needs.
 *
 * Derived by asking `reasonFor` again rather than stored on the line, because
 * the params are numbers out of `POINTS` and a copy on every line would be a
 * copy that goes stale the day one of them changes. The line carries the KEY,
 * which is what has to survive translation.
 */
function reasonParams(line: LedgerLine): Params {
    if (line.kind === 'practice') return {};
    return reasonFor({
        kind: line.kind,
        userId: '',
        name: '',
        subjectId: line.title,
        passed: !!line.passed,
        at: line.at,
        labPoints: line.kind === 'lab' ? Math.round(line.points / 4) : undefined,
    } as any).params;
}

/** "3 days ago", and never "Invalid Date" — an undated line says nothing. */
function when(at: number): string {
    if (!Number.isFinite(at) || at <= 0) return '';
    const days = Math.floor((props.now - at) / 86_400_000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    const years = Math.round(days / 365);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

function shortDate(at: number): string {
    if (!Number.isFinite(at) || at <= 0) return '';
    return new Date(at).toLocaleDateString(undefined,
                                           { month: 'short', year: 'numeric' });
}

/** The exact moment, for the title attribute. Timestamps are the point here. */
function fullDate(at: number): string {
    if (!Number.isFinite(at) || at <= 0) return '';
    return new Date(at).toLocaleString();
}

/* ------------------------------------------------------------------ *
 * The dialog's own behaviour
 * ------------------------------------------------------------------ */

function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') emit('close');
}

onMounted(() => {
    document.addEventListener('keydown', onKey);
    /*
      The scroll lock is on `documentElement` as well as on `body`.

      iOS Safari scrolls the document element when only `body` is locked, so the
      page behind the sheet drifts under the reader's finger while they are
      scrolling the sheet - which reads as the sheet being broken rather than as
      a scroll container being wrong.
    */
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    // Focus the panel rather than the close button: a screen reader should hear
    // the heading, and focusing the only way out reads it first.
    panel.value?.focus();
});

onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
});
</script>
