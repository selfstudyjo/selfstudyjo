<template>
  <!--
    `iptv-card--wide` for an episode, because an episode STILL is landscape.
    Cropped to a 2/3 poster it loses two thirds of the frame - and the frame is
    all the tile has to say which episode this is, since the titles in a series
    are routinely three words that mean nothing out of context. A film keeps the
    poster shape, because that is the shape a poster is drawn in.
  -->
  <button type="button" class="iptv-card"
          :class="{ 'is-soon': !playable, 'iptv-card--wide': kind === 'episode' }"
          @click="$emit('open')">
    <span class="iptv-card__art">
      <img v-if="art" class="iptv-card__img" :src="art" alt="" loading="lazy"
           @error="artFailed = true">
      <span v-else class="iptv-card__initial">{{ initial }}</span>

      <!--
        The gradient foot. It is here rather than on the title because the title
        sits BELOW the poster: what this darkens is the bottom of the artwork, so
        the tag and the resume bar have something to be legible against whatever
        the still happens to be. A poster is an arbitrary photograph and no token
        can measure it.
      -->
      <span class="iptv-card__sheen" aria-hidden="true"></span>

      <!--
        The play affordance, on hover and on keyboard focus. `aria-hidden`,
        because the tile is already a button and announcing "play" a second time
        is noise to a screen reader.
      -->
      <span v-if="playable" class="iptv-card__play" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M7 4l13 8-13 8z" />
        </svg>
      </span>

      <span v-if="kind === 'series'" class="iptv-card__tag">
        {{ $t('Series') }}
      </span>
      <span v-else-if="kind === 'episode'" class="iptv-card__tag">
        {{ episodeLabel }}
      </span>

      <!-- Resume bar. Only when there is something to resume: a hairline at 0%
           on every card reads as a rendering artefact rather than as progress. -->
      <span v-if="progress > 0" class="iptv-card__progress">
        <span :style="{ width: (progress * 100).toFixed(1) + '%' }"></span>
      </span>

      <span v-if="!playable" class="iptv-card__soon">{{ $t('Coming soon') }}</span>
    </span>

    <span class="iptv-card__lines">
      <span class="iptv-card__title">{{ $td(record) || $t('Untitled') }}</span>
      <span v-if="meta" class="iptv-card__meta">{{ meta }}</span>
    </span>
  </button>
</template>

<script setup lang="ts">
/*
  One tile: a film, a series or an episode.

  A `<button>` rather than a `<div>` with a click handler, and rather than a
  `<router-link>`. A button because the parent decides where a tile leads — a
  series goes to its own page and a film goes straight to the player — so the
  destination is not this component's business; and a button rather than a div
  because a tile has to be reachable by keyboard and announced as something that
  can be activated, which a div with `@click` is not.
*/
import { computed, ref } from 'vue';

import type { Channel, Episode, Movie, Series } from '@/services/iptv.service';
import { runtime } from '@/utils/iptvEngine';
import { t } from '@/i18n/runtime';

const props = withDefaults(defineProps<{
    record: Movie | Series | Episode | Channel;
    kind: 'movie' | 'series' | 'episode' | 'channel';
    /** 0..1. Anything above 0 draws the resume bar. */
    progress?: number;
}>(), { progress: 0 });

defineEmits<{ (event: 'open'): void }>();

/*
  A poster URL carries an expiring ticket, so one on a page left open all
  afternoon eventually 404s. Falling back to the initial rather than leaving a
  broken-image icon, which reads as the upload having failed rather than as a
  credential having lapsed.
*/
const artFailed = ref(false);

const art = computed(() => {
    if (artFailed.value) return '';
    const row = props.record as any;
    return row.poster_url || row.thumb_url || row.logo || '';
});

const initial = computed(() => {
    const row = props.record as any;
    return String(row.title || row.name || '?').charAt(0).toUpperCase();
});

const playable = computed(() => {
    const row = props.record as any;
    if (props.kind === 'series') {
        return (row.seasons || []).some((season: any) =>
            (season.published_count ?? season.episode_count) > 0);
    }
    if (props.kind === 'channel') return !!row.stream_url;
    return !!(row.video_url || row.video_asset);
});

const episodeLabel = computed(() => {
    const row = props.record as Episode;
    return `S${row.season}E${row.episode}`;
});

const meta = computed(() => {
    const row = props.record as any;
    const parts: string[] = [];
    if (props.kind === 'series') {
        const seasons = (row.seasons || []).length;
        /*
          Translated rather than interpolated in English. These two were plain
          literals — `'1 season'` and `` `${seasons} seasons` `` — so every tile
          on an Arabic or Chinese shelf carried an English word under a
          translated title, which is the half-translated state that reads worse
          than no translation at all (working rule 41).
        */
        if (seasons) {
            parts.push(seasons === 1 ? t('1 season')
                : t('{v0} seasons', { v0: String(seasons) }));
        }
    }
    if (row.year) parts.push(String(row.year));
    const length = runtime(row.duration_seconds);
    if (length) parts.push(length);
    if (props.kind === 'channel' && row.category) parts.push(row.category);
    return parts.join(' · ');
});
</script>
