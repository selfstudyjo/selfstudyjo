<template>
  <div class="iptv-page">
    <!-- The tab strip and the search, in one bar -------------------- -->
    <div class="iptv-bar">
      <IptvTabs :counts="tabCounts" />
      <label class="iptv-search">
        <span class="iptv-search__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-4.2-4.2" />
          </svg>
        </span>
        <input v-model="query" type="search"
               :placeholder="$t('Search films, series and channels…')"
               :aria-label="$t('Search films, series and channels…')">
        <button v-if="query" type="button" class="iptv-search__clear"
                :aria-label="$t('Clear')" @click="query = ''">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
               stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </label>
    </div>

    <!-- Loading ----------------------------------------------------- -->
    <template v-if="loading">
      <div class="iptv-hero iptv-hero--skeleton"></div>
      <div class="iptv-shelf">
        <div class="iptv-shelf__head">
          <h2 class="iptv-shelf__title">{{ $t('Loading…') }}</h2>
        </div>
        <div class="iptv-shelf__track">
          <div v-for="n in 8" :key="n" class="iptv-card iptv-card--skeleton">
            <span class="iptv-card__art"></span>
            <span class="iptv-card__lines"><i></i><i></i></span>
          </div>
        </div>
      </div>
    </template>

    <!--
      Unreachable and empty are DIFFERENT STATES and are shown differently.
      "We could not reach the service" wants a retry; "there is nothing here
      yet" does not, and offering one is a button that cannot work — the same
      mistake `/exam-approval` made with a missing appointment id.
    -->
    <div v-else-if="error" class="iptv-notice iptv-notice--error" role="alert">
      <h2>{{ $t('Self Study TV is not answering') }}</h2>
      <p>{{ error }}</p>
      <button type="button" class="iptv-btn iptv-btn--primary" @click="load">
        {{ $t('Try again') }}
      </button>
    </div>

    <div v-else-if="isEmpty" class="iptv-notice">
      <h2>{{ $t('Nothing to watch yet') }}</h2>
      <p>{{ $t('Films, series and channels appear here as soon as they are published.') }}</p>
    </div>

    <!-- Search results, which take over whichever tab is open ------- -->
    <section v-else-if="query.trim()" class="iptv-shelf">
      <div class="iptv-shelf__head">
        <h2 class="iptv-shelf__title">
          {{ $t('Results') }}
          <span class="iptv-shelf__count">{{ $n(results.length) }}</span>
        </h2>
      </div>
      <p v-if="!results.length" class="iptv-empty">
        {{ $t('Nothing matched that.') }}
      </p>
      <div v-else class="iptv-grid">
        <IptvCard v-for="entry in results" :key="entry.kind + entry.record.id"
                  :record="entry.record" :kind="entry.kind"
                  :progress="progressFor(entry.kind, entry.record.id)"
                  @open="open(entry.kind, entry.record)" />
      </div>
    </section>

    <!-- Browse ------------------------------------------------------ -->
    <template v-else-if="tab === 'home'">
      <!--
        A header only when there is no hero, because the hero carries the page
        when there is one and two titles would be one too many. It is not a
        fallback for an EMPTY library - that has its own notice above - but for a
        library whose newest records have no video uploaded yet, where `heroOf`
        correctly refuses to feature a play button that would do nothing.
      -->
      <header v-if="!hero" class="iptv-head">
        <h1>{{ $t('Self Study TV') }}</h1>
        <p>{{ $t('Films, series and live channels — free with your account.') }}</p>
      </header>

      <section v-if="hero" class="iptv-hero" :style="heroBackdrop">
        <div class="iptv-hero__scrim"></div>
        <div class="iptv-hero__body">
          <p class="iptv-hero__eyebrow">
            <span class="iptv-hero__kind">
              {{ hero.kind === 'movie' ? $t('Film') : $t('Series') }}
            </span>
            <span class="iptv-hero__featured">{{ $t('Featured') }}</span>
          </p>
          <h1 class="iptv-hero__title">{{ $td(hero.record) }}</h1>
          <p v-if="heroFacts.length" class="iptv-hero__facts">
            <span v-for="fact in heroFacts" :key="fact" class="iptv-fact">
              {{ fact }}
            </span>
          </p>
          <p v-if="$td(hero.record, 'description')" class="iptv-hero__blurb">
            {{ $td(hero.record, 'description') }}
          </p>
          <div class="iptv-hero__actions">
            <button type="button" class="iptv-btn iptv-btn--primary"
                    @click="openHero">
              <span class="iptv-btn__glyph" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="15" height="15"
                     fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>
              </span>
              {{ $t('Watch now') }}
            </button>
            <router-link v-if="hero.kind === 'series'"
                         class="iptv-btn iptv-btn--glass"
                         :to="'/tv/series/' + hero.record.id">
              {{ $t('Episodes') }}
            </router-link>
          </div>
        </div>
      </section>

      <section v-if="resumable.length" class="iptv-shelf">
        <div class="iptv-shelf__head">
          <h2 class="iptv-shelf__title">{{ $t('Continue watching') }}</h2>
        </div>
        <div class="iptv-shelf__track">
          <IptvCard v-for="entry in resumable"
                    :key="'r' + entry.kind + entry.record.id"
                    :record="entry.record" :kind="entry.kind"
                    :progress="entry.fraction"
                    @open="open(entry.kind, entry.record)" />
        </div>
      </section>

      <section v-for="rail in rails" :key="rail.key" class="iptv-shelf">
        <div class="iptv-shelf__head">
          <h2 class="iptv-shelf__title">
            {{ $t(rail.key) }}
            <span class="iptv-shelf__count">{{ $n(rail.items.length) }}</span>
          </h2>
          <router-link v-if="railTab(rail.key)" class="iptv-shelf__more"
                       :to="railTab(rail.key) as string">
            {{ $t('See all') }}
          </router-link>
        </div>
        <div class="iptv-shelf__track">
          <IptvCard v-for="record in rail.items" :key="rail.key + record.id"
                    :record="record"
                    :kind="kindOf(record)"
                    :progress="progressFor(kindOf(record), record.id)"
                    @open="open(kindOf(record), record)" />
        </div>
      </section>

      <section v-if="liveRail.length" class="iptv-shelf">
        <div class="iptv-shelf__head">
          <h2 class="iptv-shelf__title">
            {{ $t('Live channels') }}
            <span class="iptv-shelf__count">
              {{ $n(library.channels.length) }}
            </span>
          </h2>
          <router-link class="iptv-shelf__more" to="/tv/live">
            {{ $t('See all') }}
          </router-link>
        </div>
        <div class="iptv-shelf__track">
          <router-link v-for="channel in liveRail" :key="channel.id"
                       class="iptv-channel iptv-channel--tile"
                       :to="'/tv/live?channel=' + channel.id">
            <span class="iptv-channel__art">
              <img v-if="channel.logo && !failedLogos.has(channel.id)"
                   :src="channel.logo" alt="" loading="lazy"
                   @error="failedLogos.add(channel.id)">
              <span v-else class="iptv-channel__initial">
                {{ channel.name.charAt(0) }}
              </span>
              <span class="iptv-channel__live">
                <i aria-hidden="true"></i>{{ $t('On air') }}
              </span>
            </span>
            <span class="iptv-channel__name">{{ channel.name }}</span>
            <span v-if="channel.category" class="iptv-channel__cat">
              {{ channel.category }}
            </span>
          </router-link>
        </div>
      </section>
    </template>

    <!-- Films, or Series -------------------------------------------- -->
    <template v-else>
      <header class="iptv-head">
        <h1>{{ tab === 'movies' ? $t('Films') : $t('Series') }}</h1>
        <p>{{ tabBlurb }}</p>
      </header>

      <div v-if="genres.length" class="iptv-genres" role="group"
           :aria-label="$t('All genres')">
        <button type="button" class="iptv-chip"
                :class="{ 'is-on': !genre }"
                :aria-pressed="!genre" @click="genre = ''">
          {{ $t('All genres') }}
          <span class="iptv-chip__count">{{ $n(tabAll.length) }}</span>
        </button>
        <button v-for="entry in genres" :key="entry.genre" type="button"
                class="iptv-chip"
                :class="{ 'is-on': genre === entry.genre }"
                :aria-pressed="genre === entry.genre"
                @click="toggleGenre(entry.genre)">
          {{ entry.genre }}
          <span class="iptv-chip__count">{{ $n(entry.count) }}</span>
        </button>
      </div>

      <p v-if="!tabItems.length" class="iptv-empty">
        {{ $t('Nothing matched that.') }}
      </p>
      <div v-else class="iptv-grid">
        <IptvCard v-for="record in tabItems" :key="record.id"
                  :record="record" :kind="tabKind"
                  :progress="progressFor(tabKind, record.id)"
                  @open="open(tabKind, record)" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/*
  Self Study TV — the hub, and the Films and Series shelves.

  ONE COMPONENT, THREE TABS, AND EVERY ONE OF THEM IS A ROUTE
  ==========================================================

  `/tv`, `/tv/movies` and `/tv/series` all render this file; the segment says
  which shelf it draws. That is the Labs precedent rather than an `activeTab`
  ref, and for the reason the Labs page proved: a tab held in component state
  cannot be linked to, cannot be reached with Back, and loses the reader's place
  on reload. `/tv/live` stays a page of its own because it owns a player.

  It draws; it decides almost nothing. The rails, the hero, the genre list, the
  resume decisions and which tab a path belongs to all come from
  `utils/iptvEngine.ts`, which is a plain module with `npm run check:iptv` over
  it — same precedent as `photoMask.ts` and `leaderboardEngine.ts`, and for the
  same reason: every one of those properties is invisible in a screenshot and
  wrong in a way nobody can see.
*/
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import IptvCard from '@/components/iptv/IptvCard.vue';
import IptvTabs from '@/components/iptv/IptvTabs.vue';
import {
    iptvService, type Channel, type Episode, type Library, type Movie,
    type Series,
} from '@/services/iptv.service';
import {
    buildRails, continueWatching, firstPlayable, genresOf, heroOf,
    progressId, resumeAt, runtime, tabFor, type ProgressMap, type TabId,
} from '@/utils/iptvEngine';
import { loadProgress } from '@/utils/iptvProgress';
import { t } from '@/i18n/runtime';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref<string | null>(null);
const query = ref('');
const genre = ref('');
const library = ref<Library>({
    movies: [], series: [], channels: [], counts: {}, episode_parts: {},
});
const progress = ref<ProgressMap>({});
const results = ref<Array<{ kind: 'movie' | 'series' | 'channel'; record: any }>>([]);
const failedLogos = reactive(new Set<string>());

/*
  Episodes are NOT in the library payload — a library with 20,000 of them is
  megabytes on every load. So "Continue watching" can only offer the films it
  knows about plus whatever episode records have been seen this session. That is
  a real limitation and it is the right trade: fetching every series' episodes to
  build one rail would make the home page cost one request per series.
*/
const knownEpisodes = ref<Episode[]>([]);

/* The open tab, read off the PATH rather than held here — see `tabFor`. */
const tab = computed<TabId>(() => tabFor(route.path));

const tabKind = computed<'movie' | 'series'>(() =>
    (tab.value === 'series' ? 'series' : 'movie'));

const isEmpty = computed(() =>
    !library.value.movies.length && !library.value.series.length
    && !library.value.channels.length);

/*
  Counts for the strip. Only what is actually known: an omitted count draws
  nothing, where `0` would draw a truthful zero. While the library is loading the
  strip is therefore bare rather than claiming an empty library.
*/
const tabCounts = computed(() => (loading.value ? {} : {
    movies: library.value.movies.length,
    series: library.value.series.length,
    live: library.value.channels.length,
}));

const hero = computed(() =>
    heroOf(library.value.movies, library.value.series));

const heroBackdrop = computed(() => {
    const record: any = hero.value?.record;
    const url = record?.backdrop_url || record?.poster_url;
    /*
      A CSS `url()` around an operator-supplied string is the one place a media
      URL could break out of the declaration, so the quote and paren characters
      are refused rather than escaped. These URLs are built by app 38 and cannot
      contain them; a check that costs nothing is still worth having on a value
      that reaches a style attribute.
    */
    if (!url || /["')(]/.test(url)) return {};
    return { backgroundImage: 'url("' + url + '")' };
});

/*
  The hero's facts as a LIST rather than one ` · `-joined sentence.

  Joined, a year, a rating and a runtime read as prose and inherit the bidi
  hazard of every neutral character between them: in Arabic the algorithm is free
  to reorder `2019 · PG-13 · 1h 52m` around those separators. As separate
  isolated chips each is its own run, they cannot swap places, and the row reads
  as the metadata strip a viewer expects on a film rather than as a sentence.
*/
const heroFacts = computed<string[]>(() => {
    const record: any = hero.value?.record;
    if (!record) return [];
    const parts: string[] = [];
    if (record.year) parts.push(String(record.year));
    if (record.rating) parts.push(record.rating);
    if (record.duration_seconds) parts.push(runtime(record.duration_seconds));
    const seasons = (record.seasons || []).length;
    if (seasons) {
        parts.push(seasons === 1 ? t('1 season')
            : t('{v0} seasons', { v0: String(seasons) }));
    }
    (record.genres || []).slice(0, 3).forEach((row: string) => parts.push(row));
    return parts.filter(Boolean);
});

/** Every film, or every series — before the genre filter. */
const tabAll = computed<Array<Movie | Series>>(() =>
    (tab.value === 'series' ? library.value.series : library.value.movies));

const tabItems = computed<Array<Movie | Series>>(() => {
    const rows = tabAll.value;
    if (!genre.value) return rows;
    const wanted = genre.value.toLowerCase();
    return rows.filter(row =>
        (row.genres || []).some(g => String(g).toLowerCase() === wanted));
});

const tabBlurb = computed(() => (tab.value === 'movies'
    ? t('Every film in the library.')
    : t('Every series in the library, season by season.')));

const rails = computed(() =>
    buildRails(library.value.movies, library.value.series));

/*
  The genre chips are built from THIS tab's rows, never from the whole library. A
  chip counting films while the Series shelf is open sends a reader to an empty
  grid, which reads as the filter being broken rather than as the count having
  been about something else.
*/
const genres = computed(() => (tab.value === 'series'
    ? genresOf([], library.value.series)
    : genresOf(library.value.movies, [])));

const resumable = computed(() =>
    continueWatching(progress.value, library.value.movies, knownEpisodes.value));

const liveRail = computed(() => library.value.channels.slice(0, 14));

/** Where a rail's "See all" leads, or nothing for a rail that mixes both. */
function railTab(key: string): string | null {
    if (key === 'Films') return '/tv/movies';
    if (key === 'Series') return '/tv/series';
    return null;
}

function kindOf(record: Movie | Series): 'movie' | 'series' {
    return (record as Series).seasons !== undefined
        || (record as any).kind === 'series' ? 'series' : 'movie';
}

function progressFor(kind: string, id: string): number {
    const entry = progress.value[progressId(kind as 'movie' | 'episode', id)];
    const verdict = resumeAt(entry);
    if (verdict.action !== 'resume' || !entry || !entry.duration) return 0;
    return Math.min(1, entry.position / entry.duration);
}

function toggleGenre(value: string) {
    genre.value = genre.value === value ? '' : value;
}

function open(kind: string, record: Movie | Series | Episode | Channel) {
    if (kind === 'series') {
        router.push('/tv/series/' + (record as Series).id);
        return;
    }
    if (kind === 'channel') {
        router.push('/tv/live?channel=' + (record as Channel).id);
        return;
    }
    if (kind === 'episode') {
        const episode = record as Episode;
        router.push('/tv/watch/episode/' + episode.series_id + '/' + episode.id);
        return;
    }
    router.push('/tv/watch/movie/' + (record as Movie).id);
}

async function openHero() {
    const current = hero.value;
    if (!current) return;
    if (current.kind === 'movie') {
        open('movie', current.record);
        return;
    }
    /*
      A series' Play button has to land on an EPISODE, so the episode list is
      fetched at the moment it is pressed rather than on page load. That is one
      request the reader is waiting for on purpose, against one request per
      series on every visit.
    */
    try {
        const detail = await iptvService.getSeries(current.record.id);
        const first = firstPlayable(detail.episodes || []);
        if (first) {
            router.push('/tv/watch/episode/' + detail.id + '/' + first.id);
            return;
        }
    } catch {
        /* Fall through to the series page, which explains itself. */
    }
    router.push('/tv/series/' + current.record.id);
}

let searchTimer: number | undefined;

async function runSearch() {
    const text = query.value.trim();
    if (!text) { results.value = []; return; }
    try {
        results.value = await iptvService.search(text) as any;
    } catch {
        /* A failed search is a quiet empty result rather than an error banner:
           the rails behind it are still perfectly good, and a reader who has
           typed one letter has not asked for a diagnosis. */
        results.value = [];
    }
}

async function load() {
    loading.value = true;
    error.value = null;
    const { library: payload, error: failure } = await iptvService.librarySafe();
    library.value = payload;
    error.value = failure;
    loading.value = false;
}

onMounted(() => {
    progress.value = loadProgress();
    load();
});

/* Debounced, because every keystroke is a request to a replica. 300ms is the
   platform's usual and is below what a reader reads as lag. */
watch(query, () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(runSearch, 300);
});

/*
  A genre chosen on the Films shelf means nothing on the Series one — the two
  lists are built from different rows — so moving between tabs clears it. Left
  in place, a reader arriving at Series with `Documentary` still selected sees an
  empty grid and no visible reason for it.
*/
watch(tab, () => { genre.value = ''; });

/*
  Loaded globally rather than through `<style scoped>`, because the card and the
  tab strip are their own components and a scoped sheet would not reach them.
  Every selector in the file is `iptv-`-prefixed and anchored on a page root,
  which is what `npm run check:cssleaks` requires of a globally loaded page
  stylesheet.
*/
import '@/assets/css/iptv.css';
</script>
