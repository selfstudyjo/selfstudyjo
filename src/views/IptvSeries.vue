<template>
  <div class="iptv-page">
    <header v-if="series" class="iptv-hero iptv-hero--compact"
            :style="backdrop">
      <div class="iptv-hero__scrim"></div>
      <div class="iptv-hero__body">
        <router-link class="iptv-btn iptv-btn--ghost iptv-hero__back" to="/tv">
          <span aria-hidden="true">←</span> {{ $t('Self Study TV') }}
        </router-link>
        <span class="iptv-hero__kind">{{ $t('Series') }}</span>
        <h1 class="iptv-hero__title">{{ $td(series) }}</h1>
        <p class="iptv-hero__meta">{{ meta }}</p>
        <p v-if="$td(series, 'description')" class="iptv-hero__blurb">
          {{ $td(series, 'description') }}
        </p>
        <div class="iptv-hero__actions">
          <button type="button" class="iptv-btn iptv-btn--primary"
                  :disabled="!first" @click="play(first)">
            <span aria-hidden="true">▶</span>
            {{ resumeTarget ? $t('Continue watching') : $t('Play') }}
          </button>
        </div>
      </div>
    </header>

    <div v-if="loading" class="iptv-notice">{{ $t('Loading…') }}</div>

    <div v-else-if="failure" class="iptv-notice iptv-notice--error" role="alert">
      <h2>{{ $t('That series could not be loaded') }}</h2>
      <p>{{ failure }}</p>
      <button type="button" class="iptv-btn iptv-btn--primary" @click="load">
        {{ $t('Try again') }}
      </button>
    </div>

    <template v-else-if="series">
      <!--
        Season tabs, and only when there is more than one. A single tab reading
        "Season 1" above a list is furniture that says nothing.
      -->
      <div v-if="seasons.length > 1" class="iptv-seasons" role="tablist">
        <button v-for="group in seasons" :key="group.season" type="button"
                class="iptv-chip" role="tab"
                :class="{ 'is-on': group.season === openSeason }"
                :aria-selected="group.season === openSeason"
                @click="openSeason = group.season">
          {{ $t('Season {v0}', { v0: $n(group.season) }) }}
          <span class="iptv-chip__count">{{ $n(group.episodes.length) }}</span>
        </button>
      </div>

      <section class="iptv-episodes">
        <p v-if="!visible.length" class="iptv-empty">
          {{ $t('No episodes have been published yet.') }}
        </p>
        <button v-for="row in visible" :key="row.id" type="button"
                class="iptv-episode" :disabled="!row.video_asset"
                @click="play(row)">
          <span class="iptv-episode__art">
            <img v-if="row.thumb_url && !failedArt.has(row.id)"
                 :src="row.thumb_url" alt="" loading="lazy"
                 @error="failedArt.add(row.id)">
            <span v-else class="iptv-episode__num">
              {{ row.episode }}
            </span>
            <span v-if="progressFor(row.id) > 0" class="iptv-card__progress">
              <span :style="{ width: (progressFor(row.id) * 100).toFixed(1) + '%' }"></span>
            </span>
          </span>
          <span class="iptv-episode__body">
            <span class="iptv-episode__title">
              {{ row.episode }}. {{ $td(row) || $t('Untitled') }}
            </span>
            <span class="iptv-episode__meta">
              {{ episodeMeta(row) }}
            </span>
            <span v-if="$td(row, 'description')" class="iptv-episode__blurb">
              {{ $td(row, 'description') }}
            </span>
          </span>
          <span v-if="!row.video_asset" class="iptv-episode__soon">
            {{ $t('Coming soon') }}
          </span>
        </button>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
/*
  One series: its seasons, and its episodes in running order.

  The order is imposed twice - by app 38 and again by `inOrder()` - and that is
  not distrust. Every piece of index arithmetic on the player page (Next,
  Previous, "3 of 16") is only correct if the array is in the order the reader
  sees, and app 19 has already shown what a client that assumes an order it did
  not impose costs: nineteen of twenty courses came back reversed, so Next walked
  backwards through the syllabus and the counter counted down.
*/
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
    iptvService, isUnreachable, type Episode, type Series,
} from '@/services/iptv.service';
import {
    bySeason, firstPlayable, inOrder, progressId, resumeAt, runtime,
    type ProgressMap,
} from '@/utils/iptvEngine';
import { loadProgress } from '@/utils/iptvProgress';
import { t, td } from '@/i18n/runtime';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const failure = ref<string | null>(null);
const series = ref<Series | null>(null);
const episodes = ref<Episode[]>([]);
const openSeason = ref(1);
const progress = ref<ProgressMap>({});
const failedArt = reactive(new Set<string>());

const seasons = computed(() => bySeason(episodes.value));

const visible = computed(() => {
    const group = seasons.value.find(entry => entry.season === openSeason.value);
    return group ? group.episodes : (seasons.value[0]?.episodes || []);
});

const meta = computed(() => {
    const row = series.value;
    if (!row) return '';
    const parts: string[] = [];
    if (row.year) parts.push(String(row.year));
    if (row.rating) parts.push(row.rating);
    const count = seasons.value.length;
    if (count) parts.push(count === 1 ? '1 season' : `${count} seasons`);
    parts.push(episodes.value.length === 1 ? '1 episode'
        : `${episodes.value.length} episodes`);
    if ((row.genres || []).length) parts.push(row.genres.slice(0, 3).join(' · '));
    return parts.join(' · ');
});

const backdrop = computed(() => {
    const url = series.value?.backdrop_url || series.value?.poster_url;
    if (!url || /["')(]/.test(url)) return {};
    return { backgroundImage: `url("${url}")` };
});

/**
 * Where a returning viewer left off, if anywhere.
 *
 * The FIRST episode with something to resume, in running order - not the most
 * recently touched. Somebody working through a series wants the earliest thing
 * they have not finished; the most-recent rule sends them forward past an
 * episode they abandoned halfway.
 */
const resumeTarget = computed<Episode | null>(() => {
    for (const row of inOrder(episodes.value)) {
        const entry = progress.value[progressId('episode', row.id)];
        if (resumeAt(entry).action === 'resume') return row;
    }
    return null;
});

const first = computed(() =>
    resumeTarget.value || firstPlayable(episodes.value));

function progressFor(id: string): number {
    const entry = progress.value[progressId('episode', id)];
    const verdict = resumeAt(entry);
    if (verdict.action !== 'resume' || !entry?.duration) return 0;
    return Math.min(1, entry.position / entry.duration);
}

function episodeMeta(row: Episode): string {
    const parts: string[] = [];
    const length = runtime(row.duration_seconds);
    if (length) parts.push(length);
    if (row.air_date) parts.push(row.air_date);
    const done = progressFor(row.id);
    if (done > 0) parts.push(`${Math.round(done * 100)}%`);
    return parts.join(' · ');
}

function play(target: Episode | null) {
    if (!target || !series.value) return;
    router.push(`/tv/watch/episode/${series.value.id}/${target.id}`);
}

async function load() {
    loading.value = true;
    failure.value = null;
    try {
        const detail = await iptvService.getSeries(String(route.params.id || ''));
        series.value = detail;
        episodes.value = inOrder(detail.episodes || []);
        /* Open the season the viewer is partway through, else the first. */
        openSeason.value = resumeTarget.value?.season
            || seasons.value[0]?.season || 1;
    } catch (error) {
        failure.value = isUnreachable(error)
            ? t('Self Study TV is not answering. Try again in a moment.')
            : (error instanceof Error ? error.message
                : t('That series could not be loaded.'));
    }
    loading.value = false;
}

/* `td` is used in the script; `$td` is the template global and is `undefined`
   here, which `check:i18n` fails a build over. */
void td;

watch(() => route.params.id, () => { load(); });

progress.value = loadProgress();
load();

import '@/assets/css/iptv.css';
</script>
