<template>
  <div class="iptv-page">
    <div class="iptv-bar">
      <IptvTabs tab="series" />
    </div>

    <header v-if="series" class="iptv-hero iptv-hero--compact"
            :style="backdrop">
      <div class="iptv-hero__scrim"></div>
      <div class="iptv-hero__body">
        <router-link class="iptv-crumb" to="/tv/series">
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                 stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </span>
          {{ $t('Series') }}
        </router-link>
        <p class="iptv-hero__eyebrow">
          <span class="iptv-hero__kind">{{ $t('Series') }}</span>
        </p>
        <h1 class="iptv-hero__title">{{ $td(series) }}</h1>
        <p v-if="facts.length" class="iptv-hero__facts">
          <span v-for="fact in facts" :key="fact" class="iptv-fact">
            {{ fact }}
          </span>
        </p>
        <p v-if="$td(series, 'description')" class="iptv-hero__blurb">
          {{ $td(series, 'description') }}
        </p>
        <div class="iptv-hero__actions">
          <button type="button" class="iptv-btn iptv-btn--primary"
                  :disabled="!first" @click="play(first)">
            <span class="iptv-btn__glyph" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="15" height="15"
                   fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>
            </span>
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
      <div v-if="seasons.length > 1" class="iptv-segmented" role="tablist"
           :aria-label="$t('Episodes')">
        <button v-for="group in seasons" :key="group.season" type="button"
                class="iptv-segment" role="tab"
                :class="{ 'is-on': group.season === openSeason }"
                :aria-selected="group.season === openSeason"
                @click="openSeason = group.season">
          {{ $t('Season {v0}', { v0: $n(group.season) }) }}
          <span class="iptv-segment__count">{{ $n(group.episodes.length) }}</span>
        </button>
      </div>

      <section class="iptv-shelf">
        <div class="iptv-shelf__head">
          <h2 class="iptv-shelf__title">
            {{ $t('Episodes') }}
            <span class="iptv-shelf__count">{{ $n(visible.length) }}</span>
          </h2>
        </div>

        <div class="iptv-episodes">
          <p v-if="!visible.length" class="iptv-empty">
            {{ $t('No episodes have been published yet.') }}
          </p>
          <button v-for="row in visible" :key="row.id" type="button"
                  class="iptv-episode" :disabled="!row.video_asset"
                  :class="{ 'is-on': playingId === row.id }"
                  @click="play(row)">
            <span class="iptv-episode__art">
              <img v-if="row.thumb_url && !failedArt.has(row.id)"
                   :src="row.thumb_url" alt="" loading="lazy"
                   @error="failedArt.add(row.id)">
              <span v-else class="iptv-episode__num">
                {{ $n(row.episode) }}
              </span>
              <span v-if="row.video_asset" class="iptv-episode__play"
                    aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16"
                     fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>
              </span>
              <span v-if="progressFor(row.id) > 0" class="iptv-card__progress">
                <span :style="{ width: (progressFor(row.id) * 100).toFixed(1) + '%' }"></span>
              </span>
            </span>
            <span class="iptv-episode__body">
              <span class="iptv-episode__title">
                <span class="iptv-episode__ord">{{ $n(row.episode) }}</span>
                {{ $td(row) || $t('Untitled') }}
              </span>
              <span v-if="episodeFacts(row).length" class="iptv-episode__meta">
                <span v-for="fact in episodeFacts(row)" :key="fact"
                      class="iptv-fact iptv-fact--quiet">{{ fact }}</span>
              </span>
              <span v-if="$td(row, 'description')" class="iptv-episode__blurb">
                {{ $td(row, 'description') }}
              </span>
            </span>
            <span v-if="!row.video_asset" class="iptv-episode__soon">
              {{ $t('Coming soon') }}
            </span>
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
/*
  One series: its seasons, and its episodes in running order.

  The order is imposed twice — by app 38 and again by `inOrder()` — and that is
  not distrust. Every piece of index arithmetic on the player page (Next,
  Previous, "3 of 16") is only correct if the array is in the order the reader
  sees, and app 19 has already shown what a client that assumes an order it did
  not impose costs: nineteen of twenty courses came back reversed, so Next walked
  backwards through the syllabus and the counter counted down.
*/
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import IptvTabs from '@/components/iptv/IptvTabs.vue';
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

/** The episode the Play button would open, so the row can be marked. */
const playingId = computed(() => first.value?.id || '');

/*
  The facts as a LIST of chips rather than one ` · `-joined sentence: joined, the
  neutral characters between a year, a rating and a season count are free to be
  reordered by the bidi algorithm inside an Arabic page. Each of these was also a
  plain English literal before — `'1 season'`, `` `${count} seasons` `` — under a
  translated title, which is the half-translated state working rule 41 exists to
  end.
*/
const facts = computed<string[]>(() => {
    const row = series.value;
    if (!row) return [];
    const parts: string[] = [];
    if (row.year) parts.push(String(row.year));
    if (row.rating) parts.push(row.rating);
    const count = seasons.value.length;
    if (count) {
        parts.push(count === 1 ? t('1 season')
            : t('{v0} seasons', { v0: String(count) }));
    }
    parts.push(episodes.value.length === 1 ? t('1 episode')
        : t('{v0} episodes', { v0: String(episodes.value.length) }));
    (row.genres || []).slice(0, 3).forEach(genre => parts.push(genre));
    return parts.filter(Boolean);
});

const backdrop = computed(() => {
    const url = series.value?.backdrop_url || series.value?.poster_url;
    if (!url || /["')(]/.test(url)) return {};
    return { backgroundImage: 'url("' + url + '")' };
});

/**
 * Where a returning viewer left off, if anywhere.
 *
 * The FIRST episode with something to resume, in running order — not the most
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

function episodeFacts(row: Episode): string[] {
    const parts: string[] = [];
    const length = runtime(row.duration_seconds);
    if (length) parts.push(length);
    if (row.air_date) parts.push(row.air_date);
    const done = progressFor(row.id);
    if (done > 0) parts.push(`${Math.round(done * 100)}%`);
    return parts;
}

function play(target: Episode | null) {
    if (!target || !series.value) return;
    router.push('/tv/watch/episode/' + series.value.id + '/' + target.id);
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
