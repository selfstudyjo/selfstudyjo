<template>
  <div class="iptv-watch">
    <!--
      The same strip as every other Self Study TV page. `tabFor` lights BROWSE
      here rather than guessing at Films or Series: the player is reachable from
      all three (a film from the Films grid, an episode from a series page, a
      resume tile from Browse), so any more specific answer is wrong more often
      than it is right. Getting back to the thing you came from is what the
      breadcrumb below is for.
    -->
    <div class="iptv-bar">
      <IptvTabs />
    </div>

    <header class="iptv-watch__head">
      <router-link class="iptv-crumb" :to="backTo">
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
               stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
               stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </span>
        {{ $t('Back') }}
      </router-link>
      <div class="iptv-watch__titles">
        <h1>{{ title }}</h1>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
    </header>

    <div class="iptv-stage">
      <!--
        `playsinline` is not optional: without it iOS takes any playing video
        fullscreen, which breaks out of the page and loses the episode list and
        the Next button underneath. `preload="metadata"` so the element learns
        the duration - which is what a timeline needs - without pulling the film.
      -->
      <video ref="video" class="iptv-video" controls playsinline
             preload="metadata"
             :poster="posterUrl || undefined"
             @loadedmetadata="onMetadata"
             @timeupdate="onTimeUpdate"
             @ended="onEnded"
             @error="onVideoError"></video>

      <div v-if="loading" class="iptv-stage__veil">{{ $t('Loading…') }}</div>

      <div v-else-if="failure" class="iptv-stage__veil iptv-stage__veil--error"
           role="alert">
        <p>{{ failure }}</p>
        <button type="button" class="iptv-btn iptv-btn--primary" @click="load">
          {{ $t('Try again') }}
        </button>
      </div>
    </div>

    <!--
      The resume prompt is a CHOICE rather than an automatic seek. Seeking
      silently on load is the behaviour people report as "it started in the
      middle": somebody who watched half of something last month and opened it
      to show a friend the beginning gets dropped 40 minutes in with no way to
      know why.
    -->
    <div v-if="resumeOffer !== null" class="iptv-resume" role="status">
      <p>{{ $t('You stopped at {v0}.', { v0: timecode(resumeOffer) }) }}</p>
      <div class="iptv-resume__actions">
        <button type="button" class="iptv-btn iptv-btn--primary" @click="resume">
          {{ $t('Resume') }}
        </button>
        <button type="button" class="iptv-btn iptv-btn--ghost"
                @click="resumeOffer = null">
          {{ $t('Start from the beginning') }}
        </button>
      </div>
    </div>

    <section v-if="description" class="iptv-watch__about">
      <p>{{ description }}</p>
    </section>

    <!-- Episode navigation ----------------------------------------- -->
    <section v-if="isEpisode" class="iptv-watch__nav">
      <button type="button" class="iptv-btn iptv-btn--ghost"
              :disabled="!previous" @click="goTo(previous)">
        <span aria-hidden="true">←</span> {{ $t('Previous episode') }}
      </button>
      <span class="iptv-watch__position">
        {{ $t('{v0} of {v1}', { v0: $n(position), v1: $n(episodes.length) }) }}
      </span>
      <button type="button" class="iptv-btn iptv-btn--primary"
              :disabled="!next" @click="goTo(next)">
        {{ $t('Next episode') }} <span aria-hidden="true">→</span>
      </button>
    </section>

    <section v-if="isEpisode && episodes.length" class="iptv-shelf">
      <div class="iptv-shelf__head">
        <h2 class="iptv-shelf__title">
          {{ $t('Episodes') }}
          <span class="iptv-shelf__count">{{ $n(episodes.length) }}</span>
        </h2>
        <router-link v-if="series" class="iptv-shelf__more"
                     :to="'/tv/series/' + series.id">
          {{ $t('See all') }}
        </router-link>
      </div>
      <div class="iptv-shelf__track">
        <IptvCard v-for="row in episodes" :key="row.id" :record="row"
                  kind="episode"
                  :progress="progressFor(row.id)"
                  @open="goTo(row)" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/*
  The player, for a film or an episode.

  WHY THERE IS NO CUSTOM PLAYER UI
  ================================

  `controls` on the element, and nothing else. A hand-built control bar means
  reimplementing the timeline, the volume, fullscreen, picture-in-picture,
  keyboard shortcuts, captions and the AirPlay/Cast affordances - and getting
  every one of them right for a keyboard and a screen reader. The native
  controls already are right, they are the ones a viewer knows, and they are
  translated by the browser into whatever language the reader's OS is in. What
  this page adds is the thing native controls cannot know about: where somebody
  stopped, and what to play next.

  THE TICKET IS FETCHED HERE, NOT REUSED FROM THE GRID
  ===================================================

  A media URL carries a short-lived ticket. One captured when the home page was
  drawn is dead by the evening, and the symptom is a player that spins - which
  reads as the film being broken rather than as a credential having lapsed. So
  the URL is minted at the moment somebody opens this page.
*/
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import IptvCard from '@/components/iptv/IptvCard.vue';
import IptvTabs from '@/components/iptv/IptvTabs.vue';
import {
    iptvService, isUnreachable, type Episode, type Movie, type Series,
} from '@/services/iptv.service';
import {
    inOrder, nextEpisode, positionOf, previousEpisode, progressId, resumeAt,
    timecode, type ProgressMap,
} from '@/utils/iptvEngine';
import { loadProgress, noteProgress } from '@/utils/iptvProgress';
import { t } from '@/i18n/runtime';

const route = useRoute();
const router = useRouter();

const video = ref<HTMLVideoElement | null>(null);
const loading = ref(true);
const failure = ref<string | null>(null);
const movie = ref<Movie | null>(null);
const series = ref<Series | null>(null);
const episode = ref<Episode | null>(null);
const episodes = ref<Episode[]>([]);
const posterUrl = ref('');
const progress = ref<ProgressMap>({});
const resumeOffer = ref<number | null>(null);

const isEpisode = computed(() => route.params.kind === 'episode');

const record = computed<Movie | Episode | null>(() =>
    isEpisode.value ? episode.value : movie.value);

const title = computed(() => {
    if (isEpisode.value) {
        return series.value ? tdOf(series.value) : t('Episode');
    }
    return movie.value ? tdOf(movie.value) : t('Loading…');
});

const subtitle = computed(() => {
    if (!isEpisode.value || !episode.value) return '';
    const row = episode.value;
    return `S${row.season}E${row.episode} · ${tdOf(row)}`;
});

const description = computed(() => {
    const row = record.value as any;
    if (!row) return '';
    return tdOf(row, 'description');
});

const backTo = computed(() =>
    isEpisode.value && series.value
        ? '/tv/series/' + series.value.id : '/tv');

const next = computed(() =>
    isEpisode.value && episode.value
        ? nextEpisode(episodes.value, episode.value.id) : null);
const previous = computed(() =>
    isEpisode.value && episode.value
        ? previousEpisode(episodes.value, episode.value.id) : null);
const position = computed(() =>
    isEpisode.value && episode.value
        ? positionOf(episodes.value, episode.value.id) : 0);

/*
  `$td` is a template global and is `undefined` in a script block, which is one
  of the things `check:i18n` fails on. `td` from the runtime is the same function
  under its real name.
*/
import { td } from '@/i18n/runtime';
function tdOf(row: any, field = 'title'): string {
    return td(row, field);
}

function progressFor(id: string): number {
    const entry = progress.value[progressId('episode', id)];
    const verdict = resumeAt(entry);
    if (verdict.action !== 'resume' || !entry?.duration) return 0;
    return Math.min(1, entry.position / entry.duration);
}

function currentKey(): string {
    const row = record.value;
    if (!row) return '';
    return progressId(isEpisode.value ? 'episode' : 'movie', row.id);
}

async function load() {
    loading.value = true;
    failure.value = null;
    resumeOffer.value = null;
    posterUrl.value = '';

    try {
        if (isEpisode.value) {
            const seriesId = String(route.params.seriesId || '');
            const episodeId = String(route.params.id || '');
            const detail = await iptvService.getSeries(seriesId);
            series.value = detail;
            episodes.value = inOrder(detail.episodes || []);
            episode.value = episodes.value.find(row => row.id === episodeId) || null;
            if (!episode.value) {
                failure.value = t('That episode is not in this series.');
                loading.value = false;
                return;
            }
            posterUrl.value = episode.value.thumb_url || detail.backdrop_url
                || detail.poster_url || '';
        } else {
            const found = await iptvService.movie(String(route.params.id || ''));
            movie.value = found;
            posterUrl.value = found.backdrop_url || found.poster_url || '';
        }

        const row = record.value as any;
        const assetId = row?.video_asset;
        if (!assetId) {
            /*
              Not a failure of anything: the record exists and its video has not
              been uploaded yet. Saying so is the difference between "we are
              still working on this" and a player that spins for ever.
            */
            failure.value = t('This has not been uploaded yet.');
            loading.value = false;
            return;
        }

        const ticket = await iptvService.ticket(assetId);
        if (!video.value) { loading.value = false; return; }
        video.value.src = ticket.url;
        video.value.load();

        const entry = progress.value[currentKey()];
        const verdict = resumeAt(entry);
        if (verdict.action === 'resume') resumeOffer.value = verdict.position;
    } catch (error) {
        failure.value = isUnreachable(error)
            ? t('Self Study TV is not answering. Try again in a moment.')
            : (error instanceof Error ? error.message
                : t('That could not be played.'));
    }
    loading.value = false;
}

function resume() {
    const at = resumeOffer.value;
    resumeOffer.value = null;
    if (video.value && at !== null) {
        video.value.currentTime = at;
        /*
          `play()` is refused without a gesture and the refusal is a rejected
          promise nobody sees - the same trap the chimes and the newscast hit.
          This IS inside a click, so it is allowed; the catch is for a browser
          that refuses anyway rather than for the policy.
        */
        video.value.play().catch(() => { /* the viewer can press play */ });
    }
}

function onMetadata() {
    /* Nothing to do but note that the duration is known; the resume offer is
       already on screen and does not depend on it. */
}

let lastNoted = 0;

function onTimeUpdate() {
    const element = video.value;
    const key = currentKey();
    if (!element || !key) return;
    /*
      `timeupdate` fires about four times a second. Writing to localStorage that
      often is pointless work on the main thread during playback, so a position
      is recorded at most every five seconds - which is finer than anybody
      notices in a resume point.
    */
    const now = Date.now();
    if (now - lastNoted < 5000) return;
    lastNoted = now;
    progress.value = noteProgress(progress.value, key, element.currentTime,
                                  element.duration || 0);
}

function onEnded() {
    const element = video.value;
    const key = currentKey();
    if (element && key) {
        /* Recorded at the full duration so `resumeAt` reads it as watched rather
           than as "resume four seconds from the end". */
        progress.value = noteProgress(progress.value, key,
                                      element.duration || 0,
                                      element.duration || 0);
    }
    /*
      Auto-advance, and only for a series. Deliberately no countdown overlay: a
      thing that navigates away on its own while somebody is reading the
      description is worse than one more click.
    */
    if (next.value) goTo(next.value);
}

function onVideoError() {
    /*
      The element failed rather than the fetch. Almost always an expired ticket
      on a page that has been open for hours, so the message says what to do
      rather than naming a media error nobody can act on.
    */
    if (!failure.value && !loading.value) {
        failure.value = t('Playback stopped. The link may have expired — try again.');
    }
}

function goTo(target: Episode | null) {
    if (!target || !series.value) return;
    router.push('/tv/watch/episode/' + series.value.id + '/' + target.id);
}

/* A route change within this component (Next episode) has to reload. */
watch(() => [route.params.kind, route.params.id, route.params.seriesId],
      () => { load(); });

onBeforeUnmount(() => {
    /*
      Pause and drop the source. Without it the element keeps streaming through
      the replica after the page has gone - which is real bandwidth on a
      PythonAnywhere app, not a tidiness point.
    */
    const element = video.value;
    if (element) {
        element.pause();
        element.removeAttribute('src');
        element.load();
    }
});

progress.value = loadProgress();
load();

import '@/assets/css/iptv.css';
</script>
