<template>
  <div class="iptv-page iptv-live">
    <header class="iptv-head">
      <router-link class="iptv-btn iptv-btn--ghost" to="/tv">
        <span aria-hidden="true">←</span> {{ $t('Self Study TV') }}
      </router-link>
      <h1>{{ $t('Live channels') }}</h1>
      <p>{{ $t('Broadcast streams, playing straight from the broadcaster.') }}</p>
    </header>

    <!-- The player, only once something is chosen ------------------- -->
    <section v-if="current" class="iptv-live__stage">
      <div class="iptv-stage">
        <!--
          `dir="ltr"` is pinned on the stage: a video frame is a place, not a
          paragraph, and mirroring the controls of a live channel in Arabic moves
          them away from where the reader of that channel expects them.
        -->
        <video ref="video" class="iptv-video" controls playsinline
               :poster="current.logo || undefined"></video>
        <div v-if="playerState === 'loading'" class="iptv-stage__veil">
          {{ $t('Tuning in…') }}
        </div>
        <div v-else-if="playerState === 'error'"
             class="iptv-stage__veil iptv-stage__veil--error" role="alert">
          <p>{{ playerError }}</p>
          <button type="button" class="iptv-btn iptv-btn--primary"
                  @click="tune(current)">
            {{ $t('Try again') }}
          </button>
        </div>
      </div>
      <div class="iptv-live__now">
        <h2>{{ current.name }}</h2>
        <p v-if="$td(current, 'tagline')">{{ $td(current, 'tagline') }}</p>
        <p class="iptv-live__tech">
          {{ (current.stream_type || 'hls').toUpperCase() }}
          <span v-if="current.category"> · {{ current.category }}</span>
          <span v-if="current.country"> · {{ current.country }}</span>
        </p>
      </div>
    </section>

    <div class="iptv-toolbar">
      <label class="iptv-search">
        <span class="iptv-search__icon" aria-hidden="true">⌕</span>
        <input v-model="query" type="search"
               :placeholder="$t('Search channels…')"
               :aria-label="$t('Search channels…')">
      </label>
    </div>

    <div v-if="loading" class="iptv-notice">{{ $t('Loading…') }}</div>

    <div v-else-if="failure" class="iptv-notice iptv-notice--error" role="alert">
      <h2>{{ $t('Channels could not be loaded') }}</h2>
      <p>{{ failure }}</p>
      <button type="button" class="iptv-btn iptv-btn--primary" @click="load">
        {{ $t('Try again') }}
      </button>
    </div>

    <div v-else-if="!channels.length" class="iptv-notice">
      <h2>{{ $t('No channels yet') }}</h2>
      <p>{{ $t('Live channels appear here as soon as they are published.') }}</p>
    </div>

    <template v-else>
      <section v-for="group in groups" :key="group.category" class="iptv-rail">
        <h2 class="iptv-rail__title">
          {{ group.category }}
          <span class="iptv-rail__count">{{ $n(group.channels.length) }}</span>
        </h2>
        <div class="iptv-channels">
          <button v-for="channel in group.channels" :key="channel.id"
                  type="button" class="iptv-channel"
                  :class="{ 'is-on': current && current.id === channel.id }"
                  @click="tune(channel)">
            <span class="iptv-channel__art">
              <img v-if="channel.logo && !failedArt.has(channel.id)"
                   :src="channel.logo" alt="" loading="lazy"
                   @error="failedArt.add(channel.id)">
              <span v-else class="iptv-channel__initial">
                {{ channel.name.charAt(0) }}
              </span>
            </span>
            <span class="iptv-channel__name">{{ channel.name }}</span>
            <span v-if="$td(channel, 'tagline')" class="iptv-channel__cat">
              {{ $td(channel, 'tagline') }}
            </span>
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
/*
  Live channels.

  THIS PAGE COSTS THE PLATFORM ALMOST NOTHING, AND THAT IS THE POINT
  =================================================================

  A stored film is streamed THROUGH a replica - see `routes/watch.py` on app 38,
  which states that trade plainly. A live channel is a third party's HLS URL and
  the browser fetches it directly, so a hundred people watching the news costs
  this platform one catalogue read. That asymmetry is most of why live channels
  are worth having on a free service at all.

  WHY hls.js, AND WHY IT IS A DYNAMIC IMPORT
  ==========================================

  `.m3u8` plays natively on Safari and iOS and nowhere else: Chrome, Firefox and
  Android need a library to turn the playlist into segments a MediaSource can
  take. So `hls.js` is a real requirement rather than a nicety - without it this
  page works for a minority of readers.

  It is behind `await import()` for the reason Babylon is: it is a few hundred
  kilobytes, and the other ~55 routes must not download it. `canPlayType` decides
  whether to fetch it at all, so a Safari reader never does.

  What the library is NOT used for: a stored film. Those are ordinary byte ranges
  over a plain `<video src>`, which needs nothing.
*/
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { iptvService, isUnreachable, type Channel } from '@/services/iptv.service';
import { byCategory, needsHlsLibrary } from '@/utils/iptvEngine';
import { t } from '@/i18n/runtime';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const failure = ref<string | null>(null);
const channels = ref<Channel[]>([]);
const current = ref<Channel | null>(null);
const query = ref('');
const video = ref<HTMLVideoElement | null>(null);
const playerState = ref<'idle' | 'loading' | 'playing' | 'error'>('idle');
const playerError = ref('');
const failedArt = reactive(new Set<string>());

/* The hls.js instance, if one was needed. Held so it can be destroyed - an
   abandoned one keeps fetching segments for ever, which is somebody's data
   allowance as well as the broadcaster's bandwidth. */
let hls: any = null;

const filtered = computed(() => {
    const text = query.value.trim().toLowerCase();
    if (!text) return channels.value;
    return channels.value.filter(row => {
        const hay = [row.name, row.tagline, row.category, row.language,
                     row.country];
        const translations = row.translations || {};
        Object.keys(translations).forEach(locale => {
            Object.values(translations[locale] || {}).forEach(value => {
                if (value) hay.push(String(value));
            });
        });
        return hay.filter(Boolean).join(' ').toLowerCase().includes(text);
    });
});

const groups = computed(() => byCategory(filtered.value, t('Other')));

function canPlayHlsNatively(): boolean {
    const element = document.createElement('video');
    /* Both spellings: Safari answers to the first and some older builds to the
       second. `'maybe'` counts - a browser saying "probably not" is not the same
       as "no", and treating `maybe` as no would load the library on Safari for
       nothing. */
    return !!(element.canPlayType('application/vnd.apple.mpegurl')
        || element.canPlayType('application/x-mpegURL'));
}

function teardown() {
    if (hls) {
        try { hls.destroy(); } catch { /* already gone */ }
        hls = null;
    }
    const element = video.value;
    if (element) {
        element.pause();
        element.removeAttribute('src');
        element.load();
    }
}

async function tune(channel: Channel | null) {
    if (!channel) return;
    current.value = channel;
    playerState.value = 'loading';
    playerError.value = '';
    teardown();

    /* Reflected in the URL so a channel can be linked to and survives a reload -
       `replace` rather than `push`, because flicking through channels is not
       navigation and would otherwise fill the back button. */
    router.replace({ path: '/tv/live', query: { channel: channel.id } });

    /* Wait a tick for the `<video>` to exist: it is inside `v-if="current"`, so
       on the first tune it is not in the DOM yet. */
    await Promise.resolve();
    const element = video.value;
    if (!element) return;

    const type = channel.stream_type || 'hls';
    try {
        if (needsHlsLibrary(type, canPlayHlsNatively())) {
            const module = await import('hls.js');
            const Hls = module.default;
            if (!Hls.isSupported()) {
                playerState.value = 'error';
                playerError.value = t('This browser cannot play live streams.');
                return;
            }
            hls = new Hls({ enableWorker: true, lowLatencyMode: true });
            hls.on(Hls.Events.ERROR, (_event: unknown, data: any) => {
                /*
                  Only a FATAL error is reported. hls.js emits recoverable ones
                  constantly on a live stream - a dropped segment, a gap in the
                  timeline - and surfacing those would put an error banner over a
                  channel that is playing perfectly well.
                */
                if (!data?.fatal) return;
                playerState.value = 'error';
                playerError.value = t('That channel is not responding. It may be off air.');
                teardown();
            });
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                playerState.value = 'playing';
                element.play().catch(() => { /* the viewer can press play */ });
            });
            hls.loadSource(channel.stream_url);
            hls.attachMedia(element);
        } else {
            element.src = channel.stream_url;
            element.load();
            element.addEventListener('loadedmetadata', () => {
                playerState.value = 'playing';
            }, { once: true });
            element.addEventListener('error', () => {
                playerState.value = 'error';
                playerError.value = t('That channel is not responding. It may be off air.');
            }, { once: true });
            element.play().catch(() => { /* the viewer can press play */ });
        }
    } catch {
        playerState.value = 'error';
        playerError.value = t('The live player could not be loaded.');
    }
}

async function load() {
    loading.value = true;
    failure.value = null;
    try {
        const payload = await iptvService.channels();
        channels.value = payload.channels;
        const wanted = String(route.query.channel || '');
        const found = wanted
            ? channels.value.find(row => row.id === wanted) : null;
        /*
          Only a channel named in the URL autoplays. Landing on this page must
          not start a broadcast at whoever opened it - and a browser refuses
          unmuted autoplay anyway, so the alternative is a silent picture and a
          confused reader.
        */
        if (found) tune(found);
    } catch (error) {
        failure.value = isUnreachable(error)
            ? t('Self Study TV is not answering. Try again in a moment.')
            : (error instanceof Error ? error.message
                : t('Channels could not be loaded.'));
    }
    loading.value = false;
}

watch(() => route.query.channel, (value) => {
    const wanted = String(value || '');
    if (!wanted || (current.value && current.value.id === wanted)) return;
    const found = channels.value.find(row => row.id === wanted);
    if (found) tune(found);
});

onBeforeUnmount(teardown);

load();

import '@/assets/css/iptv.css';
</script>
