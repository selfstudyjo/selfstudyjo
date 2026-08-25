<template>
  <div class="lb-page">
    <!-- ---------------------------------------------------------------- -->
    <!-- Masthead                                                          -->
    <!-- ---------------------------------------------------------------- -->
    <header class="lb-masthead">
      <div class="lb-masthead__text">
        <p class="lb-masthead__eyebrow">
          <span class="lb-live" :class="{ 'lb-live--stale': !!error }" aria-hidden="true"></span>
          {{ $t('Open leaderboard') }}
        </p>
        <h1 class="lb-masthead__title">{{ $t('Self Study Leaderboard') }}</h1>
        <p class="lb-masthead__lede">
          {{ $t('Every exam passed, quiz cleared and certificate earned across the platform, ranked. No account needed — this page is public.') }}
        </p>
      </div>

      <button
        type="button"
        class="lb-refresh"
        :disabled="loading"
        @click="load"
      >
        <span class="lb-refresh__spin" :class="{ 'is-spinning': loading }" aria-hidden="true"></span>
        {{ loading ? 'Refreshing' : 'Refresh' }}
      </button>
    </header>

    <!-- ---------------------------------------------------------------- -->
    <!-- One filter row, above everything it scopes                        -->
    <!-- ---------------------------------------------------------------- -->
    <section class="lb-filters" :aria-label="$t('Filter the board')">
      <div class="lb-segmented" role="group" :aria-label="$t('Period')">
        <button
          v-for="option in WINDOWS"
          :key="option"
          type="button"
          class="lb-segmented__btn"
          :class="{ 'is-active': win === option }"
          :aria-pressed="win === option"
          @click="win = option"
        >
          {{ shortWindow(option) }}
        </button>
      </div>

      <label class="lb-search">
        <span class="lb-search__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4.2-4.2" />
          </svg>
        </span>
        <input
          v-model="query"
          type="search"
          :placeholder="$t('Find a learner')"
          :aria-label="$t('Find a learner')"
        />
      </label>

      <label class="lb-select">
        <span class="lb-select__label">{{ $t('Sort') }}</span>
        <select v-model="sortKey" :aria-label="$t('Sort the board by')">
          <option value="points">{{ $t('Points') }}</option>
          <option value="certificates">{{ $t('Certificates') }}</option>
          <option value="averageScore">{{ $t('Average score') }}</option>
          <option value="lastActiveAt">{{ $t('Most recent') }}</option>
        </select>
      </label>

      <!--
        Hidden while the load is failing. "0 of 0 ranked" beside an error is the
        same mistake as the empty state one level up: a count is a claim about the
        platform, and nothing was counted.
      -->
      <p v-if="!error" class="lb-filters__count" aria-live="polite">
        {{ $t('{v0} of {v1} ranked', { v0: visibleRows.length.toLocaleString(), v1: board.rows.length.toLocaleString() }) }}
      </p>
    </section>

    <!-- A source that did not answer is named, never rounded into the total. -->
    <p v-if="partialSources.length && !loading" class="lb-notice" role="status">
      {{ $t('Showing a partial board — {v0} did not answer. A replica is probably still waking up; try Refresh in a moment.', { v0: partialSources.join(' and ') }) }}
    </p>

    <div v-if="error" class="lb-error" role="alert">
      <h2>{{ $t('The board could not be loaded') }}</h2>
      <p>{{ error }}</p>
      <button type="button" class="lb-btn" @click="load">{{ $t('Try again') }}</button>
    </div>

    <!--
      Refetch keeps the frame: the previous render is held at reduced opacity
      rather than replaced by a skeleton, so nothing jumps under the reader.
      The very first load has nothing to hold, so that one gets the skeleton.
    -->
    <div v-else class="lb-body" :class="{ 'is-refetching': loading && hasLoadedOnce }">
      <template v-if="!hasLoadedOnce && loading">
        <div class="lb-skeleton lb-skeleton--hero"></div>
        <div class="lb-skeleton lb-skeleton--row"></div>
        <div class="lb-skeleton lb-skeleton--block"></div>
      </template>

      <template v-else-if="!board.rows.length">
        <!--
          Two different empty states, because they are two different facts.

          On a bounded window the board is empty because nothing happened
          *lately*, and the way out is a longer period. On All time there is no
          longer period, so "try a longer period" is advice the reader cannot
          take — and the honest reading is that the platform has not issued
          anything yet, which is a sentence about the platform rather than about
          the filter.
        -->
        <div class="lb-empty">
          <span class="lb-empty__mark" aria-hidden="true"></span>
          <template v-if="win === 'all'">
            <h2>{{ $t('The board is empty') }}</h2>
            <p>
              {{ $t('Nothing has been earned across the platform yet. The first exam passed, quiz cleared or certificate issued will appear here.') }}
            </p>
          </template>
          <template v-else>
            <h2>{{ $t('Nothing ranked for this period') }}</h2>
            <p>
              {{ $t('No exam, quiz or certificate was earned in the last {v0} days. Try a longer period.', { v0: WINDOW_DAYS[win] }) }}
            </p>
            <button type="button" class="lb-btn" @click="win = 'all'">
              {{ $t('Show all time') }}
            </button>
          </template>
        </div>
      </template>

      <template v-else>
        <!-- ------------------------------------------------------------ -->
        <!-- The headline, and the four numbers under it                   -->
        <!-- ------------------------------------------------------------ -->
        <section class="lb-summary" :aria-label="$t('Platform totals')">
          <div class="lb-hero">
            <p class="lb-hero__label">{{ $t('Points earned · {v0}', { v0: WINDOW_LABEL[win].toLowerCase() }) }}</p>
            <p class="lb-hero__value">{{ compact(board.totals.points) }}</p>
            <p class="lb-hero__meta">
              <span
                v-if="pointsDelta !== null"
                class="lb-delta"
                :class="pointsDelta >= 0 ? 'is-up' : 'is-down'"
              >
                <span aria-hidden="true">{{ pointsDelta >= 0 ? '▲' : '▼' }}</span>
                {{ compact(Math.abs(pointsDelta)) }}
                <span class="lb-delta__vs">{{ $t('vs previous {v0} days', { v0: WINDOW_DAYS[win] }) }}</span>
              </span>
              <span v-else class="lb-hero__note">
                {{ $t('across {v0} {v1}', { v0: board.totals.learners.toLocaleString(), v1: board.totals.learners === 1 ? 'learner' : 'learners' }) }}
              </span>
            </p>
          </div>

          <div class="lb-kpis">
            <article v-for="tile in kpis" :key="tile.label" class="lb-kpi">
              <p class="lb-kpi__label">{{ tile.label }}</p>
              <p class="lb-kpi__value">{{ tile.value }}</p>
              <p class="lb-kpi__foot">
                <span
                  v-if="tile.delta !== null"
                  class="lb-delta"
                  :class="tile.delta >= 0 ? 'is-up' : 'is-down'"
                >
                  <span aria-hidden="true">{{ tile.delta >= 0 ? '▲' : '▼' }}</span>
                  {{ tile.deltaText }}
                </span>
                <span v-else class="lb-kpi__hint">{{ tile.hint }}</span>
              </p>
            </article>
          </div>
        </section>

        <!-- ------------------------------------------------------------ -->
        <!-- Pass rate: one ratio against a limit, so a meter             -->
        <!-- ------------------------------------------------------------ -->
        <section class="lb-meterCard" :aria-label="$t('Pass rate')">
          <div class="lb-meterCard__head">
            <h2>{{ $t('Pass rate') }}</h2>
            <p class="lb-meterCard__value">
              {{ (board.totals.passRate * 100).toFixed(1) }}%
              <span class="lb-meterCard__of">
                {{ $t('{v0} of {v1} assessments', { v0: board.totals.assessmentsPassed.toLocaleString(), v1: board.totals.assessmentsTaken.toLocaleString() }) }}
              </span>
            </p>
          </div>
          <div
            class="lb-meter"
            role="meter"
            :aria-valuenow="Math.round(board.totals.passRate * 100)"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Pass rate ${(board.totals.passRate * 100).toFixed(1)} percent`"
          >
            <span class="lb-meter__fill" :style="{ width: (board.totals.passRate * 100) + '%' }"></span>
          </div>
          <p class="lb-meterCard__note">
            {{ $t('Counted over each learner\'s best attempt at each assessment, so a retake never appears twice.') }}
          </p>
        </section>

        <!-- ------------------------------------------------------------ -->
        <!-- The podium                                                    -->
        <!-- ------------------------------------------------------------ -->
        <section v-if="podium.length" class="lb-podium" :aria-label="$t('Top three learners')">
          <article
            v-for="(row, index) in podium"
            :key="row.userId"
            class="lb-podium__slot"
            :class="`lb-podium__slot--${row.rank <= 3 ? row.rank : 3}`"
          >
            <p class="lb-podium__rank">
              <span class="lb-medal" :class="`lb-medal--${row.rank}`" aria-hidden="true">
                {{ row.rank }}
              </span>
              <span class="lb-sr">{{ $t('Rank {v0}', { v0: row.rank }) }}</span>
            </p>
            <div class="lb-avatar lb-avatar--lg">
              <img
                v-if="row.avatarUrl && !brokenAvatars[row.userId]"
                :src="getProxiedImageUrl(row.avatarUrl)"
                :alt="`${row.name}'s picture`"
                loading="lazy"
                decoding="async"
                @error="brokenAvatars[row.userId] = true"
              />
              <span v-else aria-hidden="true">{{ initialsOf(row.name) }}</span>
            </div>
            <h3 class="lb-podium__name">{{ row.name }}</h3>
            <p class="lb-podium__points">{{ $t('{v0} pts', { v0: row.points.toLocaleString() }) }}</p>
            <ul class="lb-podium__facts">
              <li>
                <span>{{ row.examsPassed }}</span>
                {{ row.examsPassed === 1 ? 'exam' : 'exams' }}
              </li>
              <li>
                <span>{{ row.certificates }}</span>
                {{ row.certificates === 1 ? 'credential' : 'credentials' }}
              </li>
              <li v-if="row.averageScore > 0"><span>{{ row.averageScore }}</span> {{ $t('avg') }}</li>
            </ul>
            <p v-if="index === 0" class="lb-podium__crown" aria-hidden="true"></p>
          </article>
        </section>

        <!-- ------------------------------------------------------------ -->
        <!-- Charts                                                        -->
        <!-- ------------------------------------------------------------ -->
        <section class="lb-charts" :aria-label="$t('Trends')">
          <LeaderboardChart
            :title="$t('Achievements over time')"
            :subtitle="activitySubtitle"
            kind="area"
            :labels="activity.map(point => point.label)"
            :values="activity.map(point => point.count)"
            category-label="Period"
            value-label="Achievements"
            :height="260"
            empty-text="No achievements were earned in this period."
          />

          <LeaderboardChart
            :title="$t('Score distribution')"
            subtitle="Best attempt per learner per assessment. The pass mark is 70."
            kind="column"
            :labels="distribution.map(bucket => bucket.label)"
            :values="distribution.map(bucket => bucket.count)"
            :emphasis="topBandIndex"
            category-label="Score band"
            value-label="Attempts"
            :height="260"
            empty-text="No scored assessments in this period."
          />
        </section>

        <section v-if="subjects.length" class="lb-charts lb-charts--single" :aria-label="$t('Most studied')">
          <LeaderboardChart
            :title="$t('Most studied')"
            :subtitle="subjectsSubtitle"
            :badge="WINDOW_LABEL[win]"
            kind="bar"
            :labels="subjects.map(subject => subject.name)"
            :values="subjects.map(subject => subject.learners)"
            :emphasis="0"
            category-label="Exam or course"
            value-label="Learners"
            :height="Math.max(200, subjects.length * 42 + 48)"
            empty-text="Nothing was studied in this period."
          />
        </section>

        <!-- ------------------------------------------------------------ -->
        <!-- The board                                                     -->
        <!-- ------------------------------------------------------------ -->
        <section class="lb-boardCard" :aria-label="$t('Full ranking')">
          <div class="lb-boardCard__head">
            <h2>{{ $t('The ranking') }}</h2>
            <p>{{ WINDOW_LABEL[win] }}</p>
          </div>

          <div class="lb-tableWrap">
            <table class="lb-table">
              <caption class="lb-sr">
                {{ $t('Learners ranked by points. Rank is always the points rank, whatever the table is sorted by.') }}
              </caption>
              <thead>
                <tr>
                  <th scope="col" class="lb-table__rank">#</th>
                  <th scope="col">{{ $t('Learner') }}</th>
                  <th scope="col" class="lb-num">{{ $t('Points') }}</th>
                  <th scope="col" class="lb-num lb-hide-sm">{{ $t('Exams') }}</th>
                  <th scope="col" class="lb-num lb-hide-sm">{{ $t('Quizzes') }}</th>
                  <th scope="col" class="lb-num lb-hide-md">{{ $t('Credentials') }}</th>
                  <th scope="col" class="lb-num lb-hide-md">{{ $t('Avg score') }}</th>
                  <th scope="col" class="lb-hide-md">{{ $t('Progress') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in pagedRows" :key="row.userId">
                  <td class="lb-table__rank">
                    <span class="lb-medal" :class="row.rank <= 3 ? `lb-medal--${row.rank}` : ''">
                      {{ row.rank }}
                    </span>
                    <span
                      v-if="row.movement !== null && row.movement !== 0"
                      class="lb-move"
                      :class="row.movement > 0 ? 'is-up' : 'is-down'"
                      :title="`${Math.abs(row.movement)} ${Math.abs(row.movement) === 1 ? 'place' : 'places'} ${row.movement > 0 ? 'up' : 'down'} since the previous period`"
                    >
                      <span aria-hidden="true">{{ row.movement > 0 ? '▲' : '▼' }}</span>
                      {{ Math.abs(row.movement) }}
                    </span>
                    <span
                      v-else-if="row.movement === null && board.previousTotals"
                      class="lb-move is-new"
                      :title="$t('Not ranked in the previous period')"
                    >{{ $t('NEW') }}</span>
                  </td>

                  <td>
                    <div class="lb-who">
                      <span class="lb-avatar">
                        <img
                          v-if="row.avatarUrl && !brokenAvatars[row.userId]"
                          :src="getProxiedImageUrl(row.avatarUrl)"
                          :alt="`${row.name}'s picture`"
                          loading="lazy"
                          decoding="async"
                          @error="brokenAvatars[row.userId] = true"
                        />
                        <span v-else aria-hidden="true">{{ initialsOf(row.name) }}</span>
                      </span>
                      <span class="lb-who__text">
                        <span class="lb-who__name">{{ row.name }}</span>
                        <span class="lb-who__meta">
                          <span v-if="row.distinctions" class="lb-chip lb-chip--star">
                            {{ row.distinctions }}×
                            {{ row.distinctions === 1 ? 'distinction' : 'distinctions' }}
                          </span>
                          <span class="lb-who__seen">{{ lastSeen(row.lastActiveAt) }}</span>
                        </span>
                      </span>
                    </div>
                  </td>

                  <td class="lb-num lb-num--lead">{{ row.points.toLocaleString() }}</td>
                  <td class="lb-num lb-hide-sm">{{ row.examsPassed }}</td>
                  <td class="lb-num lb-hide-sm">{{ row.quizzesPassed }}</td>
                  <td class="lb-num lb-hide-md">{{ row.certificates }}</td>
                  <td class="lb-num lb-hide-md">
                    <span v-if="row.averageScore > 0">{{ row.averageScore }}</span>
                    <span v-else class="lb-dash" :aria-label="$t('no scored assessment')">—</span>
                  </td>
                  <td class="lb-hide-md">
                    <div
                      class="lb-meter lb-meter--row"
                      role="meter"
                      :aria-valuenow="Math.round(shareOfLeader(row))"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      :aria-label="`${Math.round(shareOfLeader(row))} percent of the leader's points`"
                    >
                      <span class="lb-meter__fill" :style="{ width: shareOfLeader(row) + '%' }"></span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="!visibleRows.length" class="lb-noMatch">
            <p>{{ $t('No learner matches “{v0}”.', { v0: query }) }}</p>
            <button type="button" class="lb-btn" @click="query = ''">{{ $t('Clear the search') }}</button>
          </div>

          <div v-if="pagedRows.length < visibleRows.length" class="lb-more">
            <button type="button" class="lb-btn" @click="shown += PAGE">
              {{ $t('Show {v0} more', { v0: Math.min(PAGE, visibleRows.length - pagedRows.length) }) }}
            </button>
            <p>
              {{ $t('Showing {v0} of {v1}', { v0: pagedRows.length.toLocaleString(), v1: visibleRows.length.toLocaleString() }) }}
            </p>
          </div>
        </section>

        <!-- ------------------------------------------------------------ -->
        <!-- How the scoring works, printed rather than assumed             -->
        <!-- ------------------------------------------------------------ -->
        <section class="lb-explain" :aria-label="$t('How points work')">
          <div class="lb-explain__col">
            <h2>{{ $t('How points work') }}</h2>
            <table class="lb-points">
              <tbody>
                <tr>
                  <th scope="row">{{ $t('Exam passed') }}</th>
                  <td>{{ POINTS.examPassed }}</td>
                </tr>
                <tr>
                  <th scope="row">{{ $t('Quiz passed') }}</th>
                  <td>{{ POINTS.quizPassed }}</td>
                </tr>
                <tr>
                  <th scope="row">{{ $t('Course certificate') }}</th>
                  <td>{{ POINTS.courseCertificate }}</td>
                </tr>
                <tr>
                  <th scope="row">{{ $t('Distinction · best attempt {v0} or above', { v0: DISTINCTION_SCORE }) }}</th>
                  <td>+{{ POINTS.distinction }}</td>
                </tr>
                <tr class="lb-points__zero">
                  <th scope="row">{{ $t('Exam certificate') }}</th>
                  <td>{{ POINTS.examCertificate }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="lb-explain__col">
            <h2>{{ $t('The rules behind it') }}</h2>
            <ul class="lb-rules">
              <li>
                <strong>{{ $t('One attempt each.') }}</strong> {{ $t('Only your best attempt at any exam or quiz counts, so re-sitting something you have already passed does not move you up.') }}
              </li>
              <li>
                <strong>{{ $t('An exam certificate is worth nothing.') }}</strong> {{ $t('It is issued automatically for a pass, and the pass already earned the points — scoring both would pay twice for one achievement. It is still counted as a credential.') }}
              </li>
              <li>
                <strong>{{ $t('Failures stay on the record.') }}</strong> {{ $t('They earn nothing and they count towards the pass rate, which is the only way that figure means anything.') }}
              </li>
              <li>
                <strong>{{ $t('Equal points share a rank.') }}</strong> {{ $t('Two learners on the same total are both shown at the same number, and the next learner takes the rank after both of them.') }}
              </li>
              <li>
                <strong>{{ $t('No identifiers are published.') }}</strong> {{ $t('The board shows the name a learner\'s own certificates carry, their totals, and nothing else — no account id, no email, and no list of what anybody failed.') }}
              </li>
            </ul>
          </div>
        </section>

        <footer class="lb-foot">
          <p>
            {{ $t('Built from {v0} of 4 public collections across the exam and certificate services. Figures are recomputed in the browser each time this page is opened.', { v0: sourceCount }) }}
          </p>
        </footer>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The public leaderboard.
 *
 * PUBLIC MEANS THE WHOLE INTERNET, AND THAT SHAPES WHAT IS ON SCREEN
 *
 * This route carries `requiresAuth: false` and its nav entry `requires:
 * 'public'`, which puts it with the Newscast, Courses, Exams and All
 * Certificates rather than with Drawing Papers and Messages — those are ungated
 * but still need an account. So everything here is readable by a stranger, and
 * three things are deliberately absent as a result:
 *
 *  - **No `user_id`, anywhere.** `/all-certificates` prints the first eight
 *    characters of one, which is defensible there because a certificate is a
 *    thing somebody presents and support has to look it up. A leaderboard has no
 *    such use, and the search deliberately does not match ids either — a filter
 *    that matched something invisible would be a way to confirm an id exists.
 *  - **No attributed failures.** The aggregate pass rate is on the page and the
 *    per-learner one is not, because "this named person failed that exam on
 *    Tuesday" is not a fact a public page should carry. The distribution chart
 *    shows the low bands without naming anybody in them.
 *  - **No link to a profile.** There is no public profile route (`/profile` is
 *    your own), so a name here is a label and not a doorway.
 *
 * A learner's *name* is published, and that is a real choice rather than an
 * oversight: `/all-certificates` has published `user_full_name` for as long as
 * it has existed, so this is the platform's existing posture rather than a new
 * one. The honest limitation is that there is no opt-out — no service on the
 * platform has a "leave me off public listings" field — and adding one is a
 * change to app 13 and to both public pages, not something this view can do.
 *
 * EVERYTHING ELSE OF SUBSTANCE IS IN THE ENGINE
 *
 * Ranking, dedupe, windowing and the chart series are all in
 * `src/utils/leaderboardEngine.ts`, checked by `npm run check:leaderboard`. This
 * file fetches, filters and draws; it decides nothing about who is ahead. That
 * split is what makes the invariants testable — see the module's header for the
 * three that cannot be seen by looking at one afternoon's board.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue';
import LeaderboardChart from '@/components/leaderboard/LeaderboardChart.vue';
import { loadAchievements } from '@/services/leaderboard.service';
import { getProxiedImageUrl } from '@/utils/imageUtils';
import {
    DISTINCTION_SCORE,
    POINTS,
    WINDOWS,
    WINDOW_DAYS,
    WINDOW_LABEL,
    activitySeries,
    buildBoard,
    compact,
    delta,
    describeStep,
    initialsOf,
    matchesQuery,
    scoreDistribution,
    topSubjects,
    type Board,
    type BoardWindow,
    type LeaderRow,
    type LeaderboardEvent,
} from '@/utils/leaderboardEngine';

/** How many rows a click of "Show more" reveals. */
const PAGE = 25;

const loading = ref(true);
const hasLoadedOnce = ref(false);
const error = ref<string | null>(null);
const events = ref<LeaderboardEvent[]>([]);
const answered = ref<Record<string, boolean>>({});
const brokenAvatars = reactive<Record<string, boolean>>({});

const win = ref<BoardWindow>('all');
const query = ref('');
const sortKey = ref<'points' | 'certificates' | 'averageScore' | 'lastActiveAt'>('points');
const shown = ref(PAGE);

/*
  One `now` per load, held in a ref rather than read at each use.

  Every window, every bucket boundary and the movement column are all measured
  from it, and reading the clock separately in each computed would let a render
  that straddles midnight put an event in one chart and not the other. It is the
  same discipline the engine enforces by taking `now` as a parameter.
*/
const now = ref(Date.now());

async function load() {
    loading.value = true;
    error.value = null;
    try {
        const report = await loadAchievements();
        // Nothing answered at all is an outage, not an empty platform. Saying
        // "no learners ranked" there would be reporting a network failure as a
        // fact about the community.
        if (report.allFailed) {
            throw new Error(
                'No replica of the exam or certificate service answered. '
                + 'They may be waking up — this usually clears within a minute.',
            );
        }
        events.value = report.events;
        answered.value = report.answered;
        now.value = Date.now();
        hasLoadedOnce.value = true;
    } catch (caught: any) {
        error.value = caught?.message || 'Something went wrong loading the board.';
    } finally {
        loading.value = false;
    }
}

onMounted(load);

/* ------------------------------------------------------------------ *
 * Derived state — all of it from the engine
 * ------------------------------------------------------------------ */

const board = computed<Board>(() =>
    buildBoard(events.value, { now: now.value, window: win.value }));

const visibleRows = computed<LeaderRow[]>(() => {
    const rows = board.value.rows.filter(row => matchesQuery(row, query.value));
    if (sortKey.value === 'points') return rows;   // already in rank order
    /*
      Sorting reorders the rows; it never renumbers them.

      `#` is the learner's points rank and stays with the learner whatever the
      table is sorted by — the same rule the chart palette follows, where colour
      follows the entity and not its current row. Renumbering on sort would print
      "1" against whoever happens to have the highest average score, which is a
      different claim from the one the column heading makes.
    */
    const key = sortKey.value;
    return [...rows].sort((a, b) => (b[key] as number) - (a[key] as number)
        // Fall back to the engine's own total order, so a tie in the chosen
        // column cannot make the list reshuffle between keystrokes.
        || b.points - a.points
        || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
});

const pagedRows = computed(() => visibleRows.value.slice(0, shown.value));

// A narrower filter must not leave the reader looking at page four of nothing.
watch([query, win, sortKey], () => { shown.value = PAGE; });

const podium = computed(() => board.value.rows.slice(0, 3));

const activity = computed(() =>
    activitySeries(board.value.events, { now: now.value, window: win.value }));

/*
  The caption names the bucket the axis is actually drawn in.

  It used to say "per week" for the all-time window on the reasoning that a long
  span must be weekly — and `activitySeries` sizes its own step to keep the axis
  readable, which over a seven-month platform is nine days, not seven. Deriving
  the wording from the series is the only way the caption and the axis cannot
  disagree.
*/
const activitySubtitle = computed(() =>
    `Per ${describeStep(activity.value)}, including the quiet ones — a series that `
    + 'skipped them would imply activity that never happened.');

const distribution = computed(() => scoreDistribution(board.value.events));

/** The fullest band, lifted out of the set. Null when there is nothing to lift. */
const topBandIndex = computed(() => {
    const counts = distribution.value.map(bucket => bucket.count);
    const peak = Math.max(...counts, 0);
    if (peak <= 0) return null;
    // A single peak only. Two bands tied for the lead is not "the one the story
    // is about", and emphasising the first of them would be arbitrary.
    return counts.filter(count => count === peak).length === 1 ? counts.indexOf(peak) : null;
});

/*
  Only named subjects reach this chart, and its caption says what that leaves.

  `topSubjects` drops a subject nothing can name — see its own note; the short
  version is that the first version labelled them "Untitled" and the live chart
  came out as five identical rows. In practice that means **exams and courses**:
  an exam is named by the certificate its pass issued, a course by app 19 or by
  its certificate, and a quiz by nothing that does not also ship an answer key.

  `quiz` stays in the list deliberately. It costs nothing while no quiz can be
  named, and the day a `quiz_title` lands on the result record or a safe listing
  exists, quizzes appear here with no change to this file.
*/
const subjects = computed(() =>
    topSubjects(board.value.events, ['exam', 'quiz', 'course_certificate'], 6));

/**
 * The caption, worded from what is actually plotted rather than from what was
 * asked for.
 *
 * A chart headed "each assessment" that lists no quizzes is a chart that has
 * misled the reader about its own scope — the same class of small wrongness as
 * the activity caption that claimed "per week" while the buckets were nine days.
 */
const subjectsSubtitle = computed(() => {
    const kinds = new Set(subjects.value.map(subject => subject.kind));
    // Singular, because it reads "per exam and course" - "per exams and
    // courses" is what a template built by concatenation gives you and it is
    // the kind of small wrongness that makes a page feel machine-written.
    const parts: string[] = [];
    if (kinds.has('exam')) parts.push('exam');
    if (kinds.has('quiz')) parts.push('quiz');
    if (kinds.has('course_certificate')) parts.push('course');
    const what = parts.length ? parts.join(' and ') : 'exam and course';
    return `Distinct learners per ${what}. Anything the platform cannot name is left out.`;
});

const pointsDelta = computed(() =>
    delta(board.value.totals.points, board.value.previousTotals?.points ?? null));

const kpis = computed(() => {
    const totals = board.value.totals;
    const before = board.value.previousTotals;
    const signed = (value: number | null) =>
        value === null ? '' : `${compact(Math.abs(value))} vs previous period`;

    return [
        {
            label: 'Learners ranked',
            value: compact(totals.learners),
            delta: delta(totals.learners, before?.learners ?? null),
            deltaText: signed(delta(totals.learners, before?.learners ?? null)),
            hint: 'anybody with at least one point',
        },
        {
            label: 'Credentials earned',
            value: compact(totals.certificates),
            delta: delta(totals.certificates, before?.certificates ?? null),
            deltaText: signed(delta(totals.certificates, before?.certificates ?? null)),
            hint: 'course and exam certificates',
        },
        {
            label: 'Assessments passed',
            value: compact(totals.assessmentsPassed),
            delta: delta(totals.assessmentsPassed, before?.assessmentsPassed ?? null),
            deltaText: signed(delta(totals.assessmentsPassed, before?.assessmentsPassed ?? null)),
            hint: 'best attempt per assessment',
        },
        {
            label: 'Average score',
            value: totals.averageScore ? String(totals.averageScore) : '—',
            delta: delta(totals.averageScore, before?.averageScore ?? null),
            deltaText: (() => {
                const change = delta(totals.averageScore, before?.averageScore ?? null);
                return change === null ? '' : `${Math.abs(change).toFixed(1)} vs previous period`;
            })(),
            hint: 'across every scored attempt',
        },
    ];
});

const partialSources = computed(() =>
    Object.entries(answered.value).filter(([, ok]) => !ok).map(([name]) => name.toLowerCase()));

const sourceCount = computed(() =>
    Object.values(answered.value).filter(Boolean).length);

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

/** How far along the leader's total this learner is, as a percentage. */
function shareOfLeader(row: LeaderRow): number {
    const leader = board.value.rows[0]?.points ?? 0;
    if (leader <= 0) return 0;
    // Floored at 2% so a learner with a single quiz still shows a mark rather
    // than an empty track that reads as missing data.
    return Math.max(2, Math.min(100, (row.points / leader) * 100));
}

function shortWindow(option: BoardWindow): string {
    return option === 'all' ? 'All time' : `${WINDOW_DAYS[option]}d`;
}

/** "3 days ago", and never "Invalid Date" — an undated row says nothing. */
function lastSeen(at: number): string {
    if (!Number.isFinite(at) || at <= 0) return '';
    const days = Math.floor((now.value - at) / 86_400_000);
    if (days <= 0) return 'active today';
    if (days === 1) return 'active yesterday';
    if (days < 30) return `active ${days} days ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `active ${months} ${months === 1 ? 'month' : 'months'} ago`;
    const years = Math.round(days / 365);
    return `active ${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/*
  Loaded globally rather than through `<style scoped>`, because the chart card is
  its own component and a scoped sheet would not reach it. Every selector in the
  file is `lb-`-prefixed and no other view uses that namespace, which is what
  `npm run check:cssleaks` requires of a globally loaded page stylesheet.
*/
import '@/assets/css/leaderboard.css';
</script>
