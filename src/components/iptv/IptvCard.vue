<template>
  <button type="button" class="iptv-card" @click="$emit('open')">
    <span class="iptv-card__art">
      <img v-if="art" :src="art" alt="" loading="lazy" @error="artFailed = true">
      <span v-else class="iptv-card__initial">{{ initial }}</span>

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

    <span class="iptv-card__title">{{ $td(record) || $t('Untitled') }}</span>
    <span v-if="meta" class="iptv-card__meta">{{ meta }}</span>
  </button>
</template>

<script setup lang="ts">
/*
  One tile: a film, a series or an episode.

  A `<button>` rather than a `<div>` with a click handler, and rather than a
  `<router-link>`. A button because the parent decides where a tile leads - a
  series goes to its own page and a film goes straight to the player - so the
  destination is not this component's business; and a button rather than a div
  because a tile has to be reachable by keyboard and announced as something that
  can be activated, which a div with `@click` is not.
*/
import { computed, ref } from 'vue';

import type { Channel, Episode, Movie, Series } from '@/services/iptv.service';
import { runtime } from '@/utils/iptvEngine';

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
        if (seasons) parts.push(seasons === 1 ? '1 season' : `${seasons} seasons`);
    }
    if (row.year) parts.push(String(row.year));
    const length = runtime(row.duration_seconds);
    if (length) parts.push(length);
    if (props.kind === 'channel' && row.category) parts.push(row.category);
    return parts.join(' · ');
});
</script>
