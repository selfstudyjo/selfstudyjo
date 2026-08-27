<!--
  The 3D cast, on a page with nothing else on it.

  Four controls, and each of them exists because a specific mistake was only
  visible with it:

    * WHO — one figure or all eight. Six at once is the only way to see that
      they read as six people rather than one model in six colours.
    * ZOOM — `tile` is the size the meeting actually renders at (~180px) and
      `head` is a face at 520px. A wrong eyelid angle is not legible at tile
      size, which is how the eyes first shipped reading as two dark holes.
    * SPEAKING — the jaw, the brows and the gestures, without waiting for a
      language model to answer.
    * ENERGY — what `speechAudio` would be reporting. At 0 the mouth must be
      exactly shut; anything else is chewing.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import PersonStage from '@/components/stage3d/PersonStage.vue';
import StudioPreview from './StudioPreview.vue';
import { ANCHOR_FIGURES, FIGURES } from '@/stage3d/figures';

const params = new URLSearchParams(location.search);

/**
 * `?stage=studio` renders the newscast SET instead of the tile grid.
 *
 * A different stage, not a different zoom: `createStudioStage` builds a room and
 * places the camera the room is derived from, and nothing about it is reachable
 * through `PersonStage`. Until this existed the set could only be seen by
 * opening `/newscast` against a live backend and waiting for a story, which is
 * how a lamp came to be hanging in front of the video wall.
 */
const stageKind = ref(params.get('stage') || 'portrait');
const live = ref(params.get('live') !== '0');
const headline = ref(params.get('headline')
    ?? 'Ministers agree emergency funding for the northern water network');
const rtl = ref(params.get('rtl') === '1');

const ALL = [...FIGURES, ...ANCHOR_FIGURES];

const who = ref(params.get('who') || 'all');
const zoom = ref(params.get('zoom') || 'tile');
const speaking = ref(params.get('speaking') === '1');
const energy = ref(Number(params.get('energy') ?? 0.75));

const seats = computed(() => (who.value === 'all' ? ALL : ALL.filter(f => f.id === who.value))
    .map(f => ({ key: f.id, figure: f.id, label: `${f.name} · ${f.hairStyle}` })));

/** Which seat is talking. `all` speaks through the first, so a handover shows. */
const speaker = computed(() => (speaking.value ? seats.value[0]?.key ?? null : null));
</script>

<template>
    <div class="cp">
        <header class="cp__bar">
            <label>stage
                <select v-model="stageKind">
                    <option value="portrait">portraits (meeting / interview)</option>
                    <option value="studio">newscast studio</option>
                </select>
            </label>
            <label>who
                <select v-model="who">
                    <option value="all">all eight</option>
                    <option v-for="f in ALL" :key="f.id" :value="f.id">{{ f.name }}</option>
                </select>
            </label>
            <label>zoom
                <select v-model="zoom">
                    <option value="tile">tile (as the meeting renders)</option>
                    <option value="head">head (520px)</option>
                    <option value="wide">wide (16/10, as the interview)</option>
                </select>
            </label>
            <label><input type="checkbox" v-model="speaking"> speaking</label>
            <label>energy
                <input type="range" min="0" max="1" step="0.05" v-model.number="energy">
                {{ energy.toFixed(2) }}
            </label>
        </header>

        <StudioPreview
            v-if="stageKind === 'studio'"
            :speaking="speaking ? 'male' : (params.get('reading') === 'female' ? 'female' : null)"
            :energy="energy"
            :live="live"
            :headline="headline"
            kicker="World · Self Study News"
            :rtl="rtl"
        />

        <PersonStage
            v-else
            :seats="seats"
            :speaking="speaker"
            :energy="energy"
            :grid-class="`cp__grid cp__grid--${zoom}`"
            tile-class="cp__tile"
        >
            <template #tile="{ seat }">
                <span class="cp__name">{{ seat.label }}</span>
            </template>
        </PersonStage>
    </div>
</template>

<!--
  NOT `scoped`.

  The grid and the tile are rendered by `PersonStage`, not by this template, and
  a scoped style only reaches elements the component itself wrote (plus a child's
  root). Scoped, `.cp__tile` matched nothing, the tiles collapsed to zero height
  and every shot came out as an empty page — which reads as a broken renderer
  rather than as a stylesheet that never applied.

  The app has the same shape and is fine for the same reason from the other
  direction: `toastmasters.css` and `job-interview.css` are loaded globally.
-->
<style>
.cp {
    padding: 12px;
    font: 13px/1.4 system-ui, sans-serif;
    color: #e8edf7;
}

.cp__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: center;
    margin-bottom: 12px;
}

.cp__bar label { display: inline-flex; gap: 6px; align-items: center; }
.cp__bar select, .cp__bar input { font: inherit; }

.cp__grid { display: grid; gap: 10px; }
/* The size the meeting renders at, so a change can be judged where it lands. */
.cp__grid--tile { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
/* A face big enough that geometry is legible. */
.cp__grid--head { grid-template-columns: repeat(auto-fill, minmax(500px, 1fr)); }
.cp__grid--wide { grid-template-columns: repeat(auto-fill, minmax(460px, 1fr)); }

.cp__tile {
    position: relative;
    aspect-ratio: 1;
    border: 2px solid #26304a;
    border-radius: 12px;
    overflow: hidden;
}

.cp__grid--wide .cp__tile { aspect-ratio: 16 / 10; }

.cp__tile.speaking { border-color: #35c88a; }

.cp__name {
    position: absolute;
    inset-inline-start: 8px;
    bottom: 8px;
    padding: 2px 7px;
    border-radius: 5px;
    background: rgb(0 0 0 / 0.6);
    font-size: 11px;
}
</style>
