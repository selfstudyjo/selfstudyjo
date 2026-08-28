<template>
  <div class="iptv-page iptv-live">
    <div class="iptv-bar">
      <IptvTabs tab="live" :counts="{ live: channels.length }" />
      <label class="iptv-search">
        <span class="iptv-search__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-4.2-4.2" />
          </svg>
        </span>
        <input v-model="query" type="search"
               :placeholder="$t('Search channels…')"
               :aria-label="$t('Search channels…')">
        <button v-if="query" type="button" class="iptv-search__clear"
                :aria-label="$t('Clear')" @click="query = ''">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
               stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
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

    <!--
      THE THEATRE: the player on one side, the channel list on the other.

      One layout whether or not anything is tuned, because the alternative — a
      grid that is replaced by a player once something is picked — moves the
      whole list out from under the reader's pointer the moment they click, and
      changing channels then means scrolling past the video every time. On a
      narrow screen the two columns become two rows, so the list is directly
      under the picture.
    -->
    <section v-else class="iptv-theatre">
      <div class="iptv-theatre__main">
        <div class="iptv-stage">
          <!--
            `dir="ltr"` is pinned on the stage in the stylesheet: a video frame
            is a place, not a paragraph, and mirroring the controls of a live
            channel in Arabic moves them away from where the reader of that
            channel expects them.
          -->
          <!--
            NO `poster`. It used to be the channel's own logo, and a broadcaster's
            logo is a couple of hundred pixels wide: scaled to fill a 16/9 frame
            it is a blurry mark several times its own size, which reads as a
            broken image rather than as a channel identity. The frame is black
            until the stream arrives and the veil says "Tuning in…" over it,
            which is what a television does.
          -->
          <video v-if="current" ref="video" class="iptv-video" controls
                 playsinline></video>

          <!-- Nothing tuned yet. A plate rather than an empty black box, which
               reads as the player having failed. -->
          <div v-else class="iptv-stage__idle">
            <span class="iptv-stage__idleGlyph" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none"
                   stroke="currentColor" stroke-width="1.6"
                   stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <path d="M8 2l4 4 4-4" />
              </svg>
            </span>
            <p>{{ $t('Pick a channel to start watching.') }}</p>
            <!--
              What this page IS, said where somebody is looking before they have
              chosen anything - rather than in a subtitle above the player, which
              is height taken off the picture on every visit including the ones
              where a channel is already playing.
            -->
            <p class="iptv-stage__idleNote">
              {{ $t('Broadcast streams, playing straight from the broadcaster.') }}
            </p>
          </div>

          <div v-if="current && playerState === 'loading'" class="iptv-stage__veil">
            {{ $t('Tuning in…') }}
          </div>
          <div v-else-if="current && playerState === 'error'"
               class="iptv-stage__veil iptv-stage__veil--error" role="alert">
            <p>{{ playerError }}</p>
            <button type="button" class="iptv-btn iptv-btn--primary"
                    @click="tune(current)">
              {{ $t('Try again') }}
            </button>
          </div>
        </div>

        <div v-if="current" class="iptv-now">
          <span class="iptv-now__art">
            <img v-if="current.logo && !failedArt.has(current.id)"
                 :src="current.logo" alt="">
            <span v-else class="iptv-channel__initial">
              {{ current.name.charAt(0) }}
            </span>
          </span>
          <span class="iptv-now__body">
            <span class="iptv-now__head">
              <h2>{{ current.name }}</h2>
              <span v-if="playerState === 'playing'" class="iptv-onair">
                <i aria-hidden="true"></i>{{ $t('On air') }}
              </span>
            </span>
            <p v-if="$td(current, 'tagline')" class="iptv-now__tagline">
              {{ $td(current, 'tagline') }}
            </p>
            <span class="iptv-now__facts">
              <span class="iptv-fact iptv-fact--quiet">
                {{ (current.stream_type || 'hls').toUpperCase() }}
              </span>
              <span v-if="current.category" class="iptv-fact iptv-fact--quiet">
                {{ current.category }}
              </span>
              <span v-if="current.country" class="iptv-fact iptv-fact--quiet">
                {{ current.country }}
              </span>
            </span>
          </span>
        </div>
      </div>

      <aside class="iptv-theatre__side" :aria-label="$t('Live channels')">
        <div class="iptv-theatre__sideHead">
          <h2>{{ $t('Live channels') }}</h2>
          <span class="iptv-shelf__count">{{ $n(filtered.length) }}</span>
        </div>

        <p v-if="!filtered.length" class="iptv-empty">
          {{ $t('Nothing matched that.') }}
        </p>

        <div v-for="group in groups" :key="group.category" class="iptv-chanGroup">
          <h3 class="iptv-chanGroup__title">
            {{ group.category }}
            <span class="iptv-shelf__count">{{ $n(group.channels.length) }}</span>
          </h3>
          <button v-for="channel in group.channels" :key="channel.id"
                  type="button" class="iptv-chan"
                  :class="{ 'is-on': current && current.id === channel.id }"
                  @click="tune(channel)">
            <span class="iptv-chan__art">
              <img v-if="channel.logo && !failedArt.has(channel.id)"
                   :src="channel.logo" alt="" loading="lazy"
                   @error="failedArt.add(channel.id)">
              <span v-else class="iptv-channel__initial">
                {{ channel.name.charAt(0) }}
              </span>
            </span>
            <span class="iptv-chan__body">
              <span class="iptv-chan__name">{{ channel.name }}</span>
              <span v-if="$td(channel, 'tagline')" class="iptv-chan__cat">
                {{ $td(channel, 'tagline') }}
              </span>
            </span>
            <span v-if="current && current.id === channel.id"
                  class="iptv-chan__on" aria-hidden="true">
              <i></i>
            </span>
          </button>
        </div>
      </aside>
    </section>
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

import IptvTabs from '@/components/iptv/IptvTabs.vue';
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
