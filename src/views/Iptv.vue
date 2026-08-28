<template>
  <div class="iptv-page">
    <!-- Hero -------------------------------------------------------- -->
    <section v-if="hero" class="iptv-hero"
             :style="heroBackdrop">
      <div class="iptv-hero__scrim"></div>
      <div class="iptv-hero__body">
        <span class="iptv-hero__kind">
          {{ hero.kind === 'movie' ? $t('Film') : $t('Series') }}
        </span>
        <h1 class="iptv-hero__title">{{ $td(hero.record) }}</h1>
        <p class="iptv-hero__meta">{{ heroMeta }}</p>
        <p v-if="$td(hero.record, 'description')" class="iptv-hero__blurb">
          {{ $td(hero.record, 'description') }}
        </p>
        <div class="iptv-hero__actions">
          <button type="button" class="iptv-btn iptv-btn--primary"
                  @click="openHero">
            <span aria-hidden="true">▶</span> {{ $t('Watch now') }}
          </button>
          <router-link v-if="hero.kind === 'series'"
                       class="iptv-btn iptv-btn--ghost"
                       :to="`/tv/series/${hero.record.id}`">
            {{ $t('Episodes') }}
          </router-link>
          <router-link class="iptv-btn iptv-btn--ghost" to="/tv/live">
            {{ $t('Live channels') }}
          </router-link>
        </div>
      </div>
    </section>

    <!-- Header when there is no hero to carry it -------------------- -->
    <header v-else class="iptv-head">
      <h1>{{ $t('Self Study TV') }}</h1>
      <p>{{ $t('Films, series and live channels — free with your account.') }}</p>
    </header>

    <!-- Search and the way to the channels ------------------------- -->
    <div class="iptv-toolbar">
      <label class="iptv-search">
        <span class="iptv-search__icon" aria-hidden="true">⌕</span>
        <input v-model="query" type="search"
               :placeholder="$t('Search films, series and channels…')"
               :aria-label="$t('Search films, series and channels…')">
      </label>
      <router-link class="iptv-btn iptv-btn--ghost" to="/tv/live">
        {{ $t('Live channels') }}
        <span v-if="library.channels.length" class="iptv-pill">
          {{ $n(library.channels.length) }}
        </span>
      </router-link>
    </div>

    <!-- Loading ---------------------------------------------------- -->
    <div v-if="loading" class="iptv-rail">
      <h2 class="iptv-rail__title">{{ $t('Loading…') }}</h2>
      <div class="iptv-rail__track">
        <div v-for="n in 6" :key="n" class="iptv-card iptv-card--skeleton"></div>
      </div>
    </div>

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

    <!-- Search results --------------------------------------------- -->
    <section v-else-if="query.trim()" class="iptv-rail">
      <h2 class="iptv-rail__title">
        {{ $t('Results') }}
        <span class="iptv-rail__count">{{ $n(results.length) }}</span>
      </h2>
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

    <!-- Rails ------------------------------------------------------- -->
    <template v-else>
      <section v-if="resumable.length" class="iptv-rail">
        <h2 class="iptv-rail__title">{{ $t('Continue watching') }}</h2>
        <div class="iptv-rail__track">
          <IptvCard v-for="entry in resumable"
                    :key="'r' + entry.kind + entry.record.id"
                    :record="entry.record" :kind="entry.kind"
                    :progress="entry.fraction"
                    @open="open(entry.kind, entry.record)" />
        </div>
      </section>

      <section v-if="genres.length" class="iptv-genres">
        <button v-for="entry in genres" :key="entry.genre" type="button"
                class="iptv-chip"
                :class="{ 'is-on': genre === entry.genre }"
                @click="toggleGenre(entry.genre)">
          {{ entry.genre }}
          <span class="iptv-chip__count">{{ $n(entry.count) }}</span>
        </button>
      </section>

      <section v-for="rail in rails" :key="rail.key" class="iptv-rail">
        <h2 class="iptv-rail__title">
          {{ $t(rail.key) }}
          <span class="iptv-rail__count">{{ $n(rail.items.length) }}</span>
        </h2>
        <div class="iptv-rail__track">
          <IptvCard v-for="record in rail.items" :key="rail.key + record.id"
                    :record="record"
                    :kind="kindOf(record)"
                    :progress="progressFor(kindOf(record), record.id)"
                    @open="open(kindOf(record), record)" />
        </div>
      </section>

      <section v-if="liveRail.length" class="iptv-rail">
        <h2 class="iptv-rail__title">
          {{ $t('Live channels') }}
          <router-link class="iptv-rail__more" to="/tv/live">
            {{ $t('See all') }}
          </router-link>
        </h2>
        <div class="iptv-rail__track">
          <router-link v-for="channel in liveRail" :key="channel.id"
                       class="iptv-channel" :to="`/tv/live?channel=${channel.id}`">
            <span class="iptv-channel__art">
              <img v-if="channel.logo" :src="channel.logo" alt="" loading="lazy"
                   @error="onLogoError">
              <span v-else class="iptv-channel__initial">
                {{ channel.name.charAt(0) }}
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
  </div>
</template>

<script setup lang="ts">
/*
  Self Study TV — the hub.

  It draws; it decides almost nothing. The rails, the hero, the genre list and
  the resume decisions all come from `utils/iptvEngine.ts`, which is a plain
  module with `npm run check:iptv` over it — same precedent as `photoMask.ts`
  and `leaderboardEngine.ts`, and for the same reason: every one of those
  properties is invisible in a screenshot and wrong in a way nobody can see.
*/
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import IptvCard from '@/components/iptv/IptvCard.vue';
import {
    iptvService, type Channel, type Episode, type Library, type Movie,
    type Series,
} from '@/services/iptv.service';
import {
    buildRails, continueWatching, firstPlayable, genresOf, heroOf,
    progressId, resumeAt, runtime, type ProgressMap,
} from '@/utils/iptvEngine';
import { loadProgress } from '@/utils/iptvProgress';

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

/*
  Episodes are NOT in the library payload — a library with 20,000 of them is
  megabytes on every load. So "Continue watching" can only offer the films it
  knows about plus whatever episode records have been seen this session. That is
  a real limitation and it is the right trade: fetching every series' episodes to
  build one rail would make the home page cost one request per series.
*/
const knownEpisodes = ref<Episode[]>([]);

const isEmpty = computed(() =>
    !library.value.movies.length && !library.value.series.length
    && !library.value.channels.length);

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
    return { backgroundImage: `url("${url}")` };
});

const heroMeta = computed(() => {
    const record: any = hero.value?.record;
    if (!record) return '';
    const parts: string[] = [];
    if (record.year) parts.push(String(record.year));
    if (record.rating) parts.push(record.rating);
    if (record.duration_seconds) parts.push(runtime(record.duration_seconds));
    const seasons = (record.seasons || []).length;
    if (seasons) parts.push(seasons === 1 ? '1 season' : `${seasons} seasons`);
    if ((record.genres || []).length) parts.push(record.genres.slice(0, 3).join(' · '));
    return parts.join(' · ');
});

const filtered = computed(() => {
    if (!genre.value) {
        return { movies: library.value.movies, series: library.value.series };
    }
    const wanted = genre.value.toLowerCase();
    const has = (row: Movie | Series) =>
        (row.genres || []).some(g => String(g).toLowerCase() === wanted);
    return {
        movies: library.value.movies.filter(has),
        series: library.value.series.filter(has),
    };
});

const rails = computed(() =>
    buildRails(filtered.value.movies, filtered.value.series));

const genres = computed(() =>
    genresOf(library.value.movies, library.value.series));

const resumable = computed(() =>
    continueWatching(progress.value, library.value.movies, knownEpisodes.value));

const liveRail = computed(() => library.value.channels.slice(0, 14));

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
        router.push(`/tv/series/${(record as Series).id}`);
        return;
    }
    if (kind === 'channel') {
        router.push(`/tv/live?channel=${(record as Channel).id}`);
        return;
    }
    if (kind === 'episode') {
        const episode = record as Episode;
        router.push(`/tv/watch/episode/${episode.series_id}/${episode.id}`);
        return;
    }
    router.push(`/tv/watch/movie/${(record as Movie).id}`);
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
            router.push(`/tv/watch/episode/${detail.id}/${first.id}`);
            return;
        }
    } catch {
        /* Fall through to the series page, which explains itself. */
    }
    router.push(`/tv/series/${current.record.id}`);
}

function onLogoError(event: Event) {
    /* A linked logo is somebody else's URL and routinely 404s. Removing it
       leaves the initial behind rather than a broken-image icon, which reads as
       the channel being broken. */
    const img = event.target as HTMLImageElement;
    img.remove();
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
import { watch } from 'vue';
watch(query, () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(runSearch, 300);
});

/*
  Loaded globally rather than through `<style scoped>`, because the card is its
  own component and a scoped sheet would not reach it. Every selector in the file
  is `iptv-`-prefixed and no other view uses that namespace, which is what
  `npm run check:cssleaks` requires of a globally loaded page stylesheet.
*/
import '@/assets/css/iptv.css';
</script>
