<template>
  <div class="sl-catalogue">
    <header class="sl-hero">
      <div class="sl-hero__text">
        <h1 class="sl-hero__title">{{ $t('Labs') }}</h1>
        <p class="sl-hero__lede">
          {{ $t('Playgrounds, not exercises. Every lab hands you the real tools for a subject and a list of things to make happen - and it checks the environment, not what you typed.') }}
        </p>
      </div>
      <!-- The three practice tools are on the top bar now, on every page, and
           the pointer stays here because that is where somebody looks for
           them. -->
      <div class="sl-hero__tools">
        <p class="sl-hero__toolsline">{{ $t('Just want a scratchpad?') }}</p>
        <div class="sl-hero__toolbtns">
          <router-link to="/tools/linux" class="sl-btn sl-btn--ghost sl-btn--sm">
            <Terminal class="sl-i" /> {{ $t('Terminal') }}
          </router-link>
          <router-link to="/tools" class="sl-btn sl-btn--ghost sl-btn--sm">
            <Database class="sl-i" /> {{ $t('SQL') }}
          </router-link>
          <router-link to="/tools/python" class="sl-btn sl-btn--ghost sl-btn--sm">
            <FileCode class="sl-i" /> {{ $t('Python') }}
          </router-link>
        </div>
      </div>
    </header>

    <div v-if="!hasLabAccess" class="sl-gate">
      <FlaskConical class="sl-i sl-i--lg" />
      <h3>{{ $t('No Lab Access') }}</h3>
      <p>{{ $t('Your plan does not include the labs. Add the lab feature to your subscription to open every track.') }}</p>
      <router-link to="/plans" class="sl-btn sl-btn--primary">
        <Crown class="sl-i" /> {{ $t('View Plans') }}
      </router-link>
    </div>

    <template v-else>
      <!-- Their own totals. `percent` is null, never 0, before anything has
           been started - see `summariseProgress`. -->
      <section v-if="mine.started > 0" class="sl-mine">
        <div class="sl-mine__stat">
          <span class="sl-mine__value">{{ mine.completed }}</span>
          <span class="sl-mine__label">{{ $t('Labs completed') }}</span>
        </div>
        <div class="sl-mine__stat">
          <span class="sl-mine__value">{{ mine.started }}</span>
          <span class="sl-mine__label">{{ $t('Labs started') }}</span>
        </div>
        <div class="sl-mine__stat">
          <span class="sl-mine__value">{{ mine.points }}</span>
          <span class="sl-mine__label">{{ $t('Points') }}</span>
        </div>
        <div class="sl-mine__stat">
          <span class="sl-mine__value">{{ mine.tasks }}</span>
          <span class="sl-mine__label">{{ $t('Tasks done') }}</span>
        </div>
      </section>

      <!--
        HOW POINTS WORK, above the filters and below their own totals.

        Above the list rather than under it, because a student who has just
        seen "3 labs completed, 48 points" is at the exact moment of asking
        where the 48 came from - and a scoring system nobody can read is one
        everybody assumes is rigged. The leaderboard prints its own table for
        the same reason one layer up.
      -->
      <LabScoring />

      <div class="sl-filters">
        <label class="sl-search">
          <Search class="sl-i" />
          <input
            v-model="query"
            type="search"
            :placeholder="$t('Search labs, topics and tools')"
            :aria-label="$t('Search labs, topics and tools')"
          >
        </label>
        <div class="sl-chips">
          <button
            type="button"
            class="sl-chip"
            :class="{ 'is-active': !track }"
            @click="track = ''"
          >{{ $t('All tracks') }}</button>
          <button
            v-for="group in groups"
            :key="group.track.id"
            type="button"
            class="sl-chip"
            :class="{ 'is-active': track === group.track.id }"
            @click="track = group.track.id"
          >{{ $td(group.track, 'title') }}<span class="sl-chip__count">{{ group.labs.length }}</span></button>
        </div>
      </div>

      <div v-if="loading" class="sl-loading">
        <div class="sl-spinner"></div>
        <p>{{ $t('Loading the labs...') }}</p>
      </div>

      <div v-else-if="error" class="sl-gate">
        <AlertTriangle class="sl-i sl-i--lg" />
        <h3>{{ $t('The labs are not reachable right now') }}</h3>
        <p>{{ error }}</p>
        <button type="button" class="sl-btn sl-btn--primary" @click="load">
          <RotateCw class="sl-i" /> {{ $t('Try Again') }}
        </button>
      </div>

      <template v-else>
        <section v-for="group in visible" :key="group.track.id" class="sl-track">
          <header class="sl-track__head">
            <div>
              <h2 class="sl-track__title">{{ $td(group.track, 'title') }}</h2>
              <p class="sl-track__sub">{{ group.track.subtitle }}</p>
            </div>
            <div class="sl-track__meta">
              <span>{{ $t('{v0} labs', { v0: group.labs.length }) }}</span>
              <span v-if="group.completed">
                {{ $t('{v0} completed', { v0: group.completed }) }}
              </span>
            </div>
          </header>
          <p v-if="group.track.blurb" class="sl-track__blurb">{{ group.track.blurb }}</p>

          <!-- `minmax(min(100%, ...), 1fr)`, never `1fr`: a `1fr` track's
               automatic minimum is min-content, so one unbreakable lab id would
               force its track wider than its share and overflow the row. -->
          <div class="sl-grid">
            <router-link
              v-for="lab in group.labs"
              :key="lab.id"
              :to="`/lab/${lab.id}`"
              class="sl-labcard"
              :class="statusClass(lab.id)"
            >
              <div class="sl-labcard__top">
                <span class="sl-badge" :class="`sl-badge--${diffBadge(lab.difficulty)}`">
                  {{ $t(difficultyLabel(lab.difficulty)) }}
                </span>
                <span v-if="progressFor(lab.id)" class="sl-badge"
                      :class="`sl-badge--${statusBadge(lab.id)}`">
                  {{ $t(statusLabel(lab.id)) }}
                </span>
                <span v-if="lab.simulated" class="sl-tag sl-tag--sim">
                  {{ $t('Simulated') }}
                </span>
              </div>
              <h3 class="sl-labcard__title">{{ $td(lab, 'title') }}</h3>
              <p class="sl-labcard__summary">{{ $td(lab, 'summary') }}</p>
              <ul class="sl-labcard__tools">
                <li v-for="label in lab.tool_labels.slice(0, 4)" :key="label">
                  {{ $t(label) }}
                </li>
                <li v-if="lab.tool_labels.length > 4" class="sl-labcard__more">
                  +{{ lab.tool_labels.length - 4 }}
                </li>
              </ul>
              <footer class="sl-labcard__foot">
                <span><Clock class="sl-i" /> {{ $t('{v0} min', { v0: lab.minutes }) }}</span>
                <span><ListChecks class="sl-i" /> {{ $t('{v0} tasks', { v0: lab.task_count }) }}</span>
                <span v-if="progressFor(lab.id)" class="sl-labcard__score">
                  {{ progressFor(lab.id)?.score }}%
                </span>
              </footer>
            </router-link>
          </div>
        </section>

        <p v-if="visible.length === 0" class="sl-empty">
          {{ query
            ? $t('No lab matches that.')
            : $t('No labs are published yet.') }}
        </p>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * The lab catalogue.
 *
 * This page USED to be the three practice tools - a SQL box, a terminal and a
 * Python editor behind three tabs. Those are not labs; they are a scratchpad, and
 * they now live on the top bar of every page and at `/tools`. A lab is a
 * playground: a subject, the real tools for it, a brief, and a list of things to
 * make happen that the environment is checked against.
 *
 * Everything the page decides is in `labCatalogue.ts` - a plain module with
 * `npm run check:labs` over it - for the reason `dashboardProgress.ts` gives:
 * the grouping, the ordering and the null-not-zero rule are all invisible in a
 * screenshot and all wrong in ways nobody would notice for weeks.
 */
import { computed, onMounted, ref, watch } from 'vue';
import {
  AlertTriangle, Clock, Crown, Database, FileCode, FlaskConical, ListChecks,
  RotateCw, Search, Terminal,
} from 'lucide-vue-next';
import { useAuthStore } from '@/store/auth';
import { labsService } from '@/services/labs.service';
import LabScoring from '@/components/practice/LabScoring.vue';
import {
  DIFFICULTY_LABELS, STATUS_LABELS, filterLabs, groupByTrack,
  summariseProgress, type LabProgress, type LabSummary, type LabTrack,
} from '@/utils/labCatalogue';

const authStore = useAuthStore();

const tracks = ref<LabTrack[]>([]);
const labs = ref<LabSummary[]>([]);
const progress = ref<LabProgress[]>([]);
const loading = ref(true);
const error = ref('');
const query = ref('');
const track = ref('');

const hasLabAccess = computed(() => authStore.hasLabAccess);
const username = computed(() => authStore.user?.username || '');
const userId = computed(() => String(authStore.user?.user_id || ''));

const groups = computed(() =>
  groupByTrack(tracks.value, labs.value, progress.value));

/**
 * The groups after the filter.
 *
 * The filter is applied to the LABS and the groups are then rebuilt, rather than
 * filtering the groups: a query that matches two labs in one track should show
 * that track with two cards, not the whole track or nothing.
 */
const visible = computed(() => {
  const matched = filterLabs(labs.value, query.value);
  const scoped = track.value
    ? matched.filter(lab => lab.track === track.value)
    : matched;
  return groupByTrack(tracks.value, scoped, progress.value);
});

const mine = computed(() => summariseProgress(progress.value));

function progressFor(labId: string): LabProgress | null {
  return progress.value.find(row => row.lab_id === labId) || null;
}

function statusClass(labId: string): string {
  const row = progressFor(labId);
  return row ? `is-${row.status.replace('_', '-')}` : '';
}

function statusLabel(labId: string): string {
  const row = progressFor(labId);
  return row ? STATUS_LABELS[row.status] : STATUS_LABELS.not_started;
}

function statusBadge(labId: string): string {
  const row = progressFor(labId);
  if (!row) return 'quiet';
  if (row.status === 'completed') return 'good';
  if (row.status === 'in_progress') return 'warn';
  return 'quiet';
}

function difficultyLabel(value: string): string {
  return DIFFICULTY_LABELS[String(value || '').toLowerCase()]
    || DIFFICULTY_LABELS.intermediate;
}

function diffBadge(value: string): string {
  const key = String(value || '').toLowerCase();
  if (key === 'beginner') return 'good';
  if (key === 'advanced') return 'bad';
  return 'warn';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [catalogue, mineRows] = await Promise.all([
      labsService.getCatalogue(),
      username.value
        ? labsService.getProgress(username.value, userId.value)
        : Promise.resolve([] as LabProgress[]),
    ]);
    tracks.value = catalogue.tracks;
    labs.value = catalogue.labs;
    progress.value = mineRows;
    if (catalogue.labs.length === 0) {
      error.value = 'The lab service answered with no labs. It may still be '
        + 'starting up - try again in a moment.';
    }
  } catch (problem: any) {
    error.value = problem?.message || 'The lab service could not be reached.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (hasLabAccess.value) load();
  else loading.value = false;
});

watch(hasLabAccess, value => {
  if (value) load();
});
</script>

<!--
  NO <style> BLOCK, and that is deliberate rather than an omission.

  `labs.css` is imported from `main.ts` and is GLOBAL, because the lab UI is
  eight components deep - the console, the query box, the file editor, the web
  playground, the dashboards, the task list, the tutor - and scoped CSS reaches
  a child component's ROOT element and no further. Scoped here, every one of
  those would render unstyled.

  What makes a global sheet safe is the naming: every selector in it is
  `sl-`-prefixed and no other view uses those names, which is the escape
  `check:cssleaks` allows. See working rule 49 - and `lab.css`, which spent
  months declaring its tokens on a `:root` that a scoped import had rewritten
  into nothing.
-->
