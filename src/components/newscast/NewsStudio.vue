<script setup lang="ts">
/**
 * The studio — one camera, three shots, cut between them like a real gallery.
 *
 * WHAT THE ASSETS ARE, BECAUSE THE DESIGN FOLLOWS FROM THEM
 *
 * The six files are not sprites to be composited: each one is a FULL studio
 * shot, 1408x768, with either nobody at the desk or exactly one presenter at
 * it. So there is no "two anchors side by side" layout to build. There is one
 * stage, and it cuts between:
 *
 *   empty      nobody is reading — the studio is lit and live, waiting
 *   female     ليلى is at the desk
 *   male       آدم is at the desk
 *
 * and within a presenter's shot, between a still (sitting) and a loop
 * (speaking). That is exactly what a newsroom does, and it is the reason the
 * anchor rota — which alternates per story — now reads as a camera cut rather
 * than as two illustrations lighting up.
 *
 * WHY VIDEO AND NOT THE GIFs
 *
 * The three GIFs are 120-123 MB each, 366 MB together. GitHub refuses any file
 * over 100 MB, so they could not be committed at all, and on a public page they
 * would be unusable regardless. Re-encoded to H.264 at the same size they are
 * 513-770 KB — the same pixels, 100x smaller — and the stills are WebP at
 * ~110 KB. The whole studio is 2.1 MB.
 *
 * Three `<video>` elements, not one with a swapped `src`: swapping tears down
 * the decoder and shows a frame of nothing every time an anchor changes, which
 * on a two-anchor bulletin is a black flash between every story. They are
 * stacked, cross-faded on opacity, and only the visible one is playing.
 *
 * THE STILL UNDERNEATH IS NOT A FALLBACK
 *
 * Every shot has its WebP behind it at full opacity, and the video fades in on
 * top. That covers four things at once with no extra code: the first paint
 * before any video has buffered, the `poster` for a browser that refuses
 * autoplay, the "sitting but not speaking" state (video hidden, still shown),
 * and a device that will not play video at all — which still gets a correct,
 * good-looking studio, just without motion.
 */

import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Radio, Volume2 } from 'lucide-vue-next';

import emptyStill from '@/assets/studio/empty_news_studio.webp';
import emptyLoop from '@/assets/studio/empty_news_studio.mp4';
import femaleStill from '@/assets/studio/news_anchor_female.webp';
import femaleLoop from '@/assets/studio/news_anchor_female.mp4';
import maleStill from '@/assets/studio/news_anchor_male.webp';
import maleLoop from '@/assets/studio/news_anchor_male.mp4';

type Shot = 'empty' | 'female' | 'male';

const props = defineProps<{
    /** Who is at the desk, or null for the empty studio. */
    anchor: 'female' | 'male' | null;
    /** Is that person actually talking right now? Drives still vs loop. */
    speaking: boolean;
    /** On air, as opposed to cued up and ready. */
    live: boolean;
    /** The name plate under the lower third. */
    anchorName: string;
    /** What voice they are using — shown small, so it can be checked. */
    voiceLabel: string;
    /** Headline on the lower third. */
    headline: string;
    /** Kicker above it: category · source. */
    kicker: string;
    /** 0-100. */
    progress: number;
    liveLabel: string;
    readyLabel: string;
    freshLabel?: string;
    fresh?: boolean;
    rtl: boolean;
    /** Set when this presenter's voice is the reshaped fallback, not a real one. */
    shapedVoice?: boolean;
    shapedLabel?: string;
}>();

const SHOTS: Record<Shot, { still: string; loop: string }> = {
    empty: { still: emptyStill, loop: emptyLoop },
    female: { still: femaleStill, loop: femaleLoop },
    male: { still: maleStill, loop: maleLoop },
};

const SHOT_ORDER: Shot[] = ['empty', 'female', 'male'];

const shot = computed<Shot>(() => props.anchor ?? 'empty');

/**
 * Which loop should be running.
 *
 * The empty studio always moves — it is a live gallery with nobody at the desk,
 * not a photograph — while a presenter only moves while they are speaking. That
 * asymmetry is the whole point of shipping both a still and a loop per anchor:
 * a mouth moving through two seconds of buffered silence looks broken in a way
 * that a person sitting still does not.
 */
const playing = computed<Shot | null>(() => {
    if (shot.value === 'empty') return 'empty';
    return props.speaking ? shot.value : null;
});

const videos = ref<Record<string, HTMLVideoElement | null>>({});

function setVideo(name: Shot, element: any) {
    videos.value[name] = (element as HTMLVideoElement) || null;
    // Template refs are assigned during mount, which is AFTER the immediate
    // watcher below has already run and found nothing to start. Without this
    // the empty studio — the shot that is showing when the page loads — sits
    // on its still and never moves, and the fault only appears on first paint,
    // where it looks like the loop simply was not shipped.
    if (element && playing.value === name) {
        (element as HTMLVideoElement).play().catch(() => undefined);
    }
}

watch(playing, (now, before) => {
    if (before && before !== now) {
        const previous = videos.value[before];
        // Paused, not reset: a presenter who stops for a breath and starts
        // again should pick up where they were, and rewinding every loop to
        // frame zero makes the studio twitch on every segment boundary.
        if (previous) previous.pause();
    }
    if (!now) return;
    const element = videos.value[now];
    if (!element) return;
    // Autoplay of a muted video is allowed everywhere, but a refusal is still
    // a rejected promise nobody sees — and the still underneath means a refusal
    // costs motion and nothing else.
    element.play().catch(() => undefined);
}, { immediate: true });

onBeforeUnmount(() => {
    for (const element of Object.values(videos.value)) element?.pause();
});
</script>

<template>
    <section class="studio" :class="{ 'studio--live': live }" :dir="rtl ? 'rtl' : 'ltr'">
        <div class="studio__stage">
            <!--
              One layer per shot, all mounted. `v-show`-style opacity rather
              than `v-if`, so cutting between presenters does not re-create a
              <video> and flash black between every story.
            -->
            <div
                v-for="name in SHOT_ORDER" :key="name"
                class="shot" :class="{ 'shot--on': shot === name }"
                aria-hidden="true"
            >
                <img class="shot__still" :src="SHOTS[name].still" alt="" draggable="false" />
                <video
                    :ref="(element) => setVideo(name, element)"
                    class="shot__loop" :class="{ 'shot__loop--on': playing === name }"
                    :src="SHOTS[name].loop"
                    :poster="SHOTS[name].still"
                    muted loop playsinline preload="auto" disablepictureinpicture
                ></video>
            </div>

            <!-- Vignette and scan sheen: it is a camera feed, not a photo. -->
            <span class="stage__vignette" aria-hidden="true"></span>
            <span class="stage__sheen" aria-hidden="true"></span>

            <!-- Top bar: the on-air light and what is being covered. -->
            <div class="bug">
                <span class="bug__live" :class="{ 'bug__live--on': live }">
                    <span class="bug__dot"></span>
                    {{ live ? liveLabel : readyLabel }}
                </span>
                <span v-if="kicker" class="bug__kicker">{{ kicker }}</span>
                <span v-if="fresh && freshLabel" class="bug__fresh">{{ freshLabel }}</span>
            </div>

            <!-- Name plate, at the desk, only while somebody is at it. -->
            <transition name="plate">
                <div v-if="anchor" class="plate">
                    <span class="plate__name">{{ anchorName }}</span>
                    <span class="plate__voice">
                        <Volume2 :size="11" />
                        {{ voiceLabel }}
                        <em v-if="shapedVoice && shapedLabel" class="plate__shaped">
                            {{ shapedLabel }}
                        </em>
                    </span>
                </div>
            </transition>

            <!--
              Lower third — present only when there is something on it. A
              strap carrying an empty line is a broadcast fault, and it read as
              exactly that: a red flag floating in the bottom corner of an
              empty studio with no sentence beside it.
            -->
            <transition name="third">
                <div v-if="headline" class="third">
                    <span class="third__flag"><Radio :size="13" /></span>
                    <p class="third__text">{{ headline }}</p>
                </div>
            </transition>

            <div class="stage__progress" aria-hidden="true">
                <span :style="{ width: progress + '%' }"></span>
            </div>
        </div>

        <!-- The ticker sits inside the frame, where a broadcast puts it. -->
        <div class="studio__strip">
            <slot name="ticker"></slot>
        </div>
    </section>
</template>

<style scoped>
.studio {
    position: relative;
    border-radius: 1rem;
    overflow: hidden;
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.16);
    background: var(--sfs-overlay, #05070f);
    box-shadow: 0 18px 46px rgb(0 0 0 / 0.32);
}

.studio--live {
    border-color: rgb(var(--sfs-danger-rgb, 210 75 90) / 0.55);
    box-shadow: 0 18px 46px rgb(0 0 0 / 0.32),
                0 0 0 1px rgb(var(--sfs-danger-rgb, 210 75 90) / 0.28);
}

/* -- the stage ------------------------------------------------------- */
.studio__stage {
    position: relative;
    width: 100%;
    /* The shots are 1408x768. Reserving the box by ratio means the page does
       not jump when the first still decodes. */
    aspect-ratio: 1408 / 768;
    /* ...but not at the cost of the transport. At full ratio on a laptop the
       stage is ~740px and the play button is below the fold, which on a page
       whose entire purpose is "press play" is the wrong trade. Capped, the
       shot crops a little ceiling truss and a little floor — which is closer
       to how a gallery would frame it anyway. */
    max-height: min(68vh, 44rem);
    overflow: hidden;
    background: var(--sfs-overlay, #05070f);
}

.shot {
    position: absolute;
    inset: 0;
    opacity: 0;
    /* A cut, not a dissolve — 180ms is a hard cut with the edge taken off,
       which is what a gallery does between two cameras. A slow cross-fade
       between two shots of the same room reads as a mistake. */
    transition: opacity 0.18s ease;
}

.shot--on { opacity: 1; }

.shot__still,
.shot__loop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.shot__loop {
    opacity: 0;
    transition: opacity 0.22s ease;
}

.shot__loop--on { opacity: 1; }

.stage__vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(0 0 0 / 0.42) 100%),
        linear-gradient(to bottom, rgb(0 0 0 / 0.28) 0%, transparent 22%,
                        transparent 58%, rgb(0 0 0 / 0.55) 100%);
}

.stage__sheen {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.5;
    background: repeating-linear-gradient(
        to bottom,
        rgb(255 255 255 / 0.025) 0 1px,
        transparent 1px 3px);
    mix-blend-mode: overlay;
}

/* -- on-air bug ------------------------------------------------------ */
.bug {
    position: absolute;
    top: 0;
    inset-inline-start: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    padding: clamp(0.5rem, 1.4vw, 0.9rem);
}

.bug__live,
.bug__kicker,
.bug__fresh {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.22rem 0.5rem;
    border-radius: 0.3rem;
    font-size: clamp(0.58rem, 1.05vw, 0.72rem);
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    backdrop-filter: blur(6px);
}

.bug__live {
    background: rgb(0 0 0 / 0.55);
    color: rgb(255 255 255 / 0.82);
    border: 1px solid rgb(255 255 255 / 0.16);
}

.bug__live--on {
    background: var(--sfs-danger, #d24b5a);
    color: var(--sfs-on-danger, #ffffff);
    border-color: transparent;
}

.bug__dot {
    width: 0.44rem;
    height: 0.44rem;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.55;
}

.bug__live--on .bug__dot {
    opacity: 1;
    animation: onair 1.4s ease-in-out infinite;
}

@keyframes onair {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.35; transform: scale(0.82); }
}

.bug__kicker {
    background: rgb(0 0 0 / 0.5);
    color: rgb(255 255 255 / 0.9);
    letter-spacing: 0.04em;
    text-transform: none;
    font-weight: 700;
}

.bug__fresh {
    background: var(--sfs-success, #3fae76);
    color: var(--sfs-on-success, #041a10);
}

/* -- name plate ------------------------------------------------------ */
.plate {
    position: absolute;
    inset-inline-start: clamp(0.5rem, 1.4vw, 0.9rem);
    bottom: clamp(3.6rem, 9vw, 5.4rem);
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.34rem 0.7rem;
    border-radius: 0.3rem;
    border-inline-start: 3px solid var(--sfs-accent, #667eea);
    background: rgb(0 0 0 / 0.62);
    backdrop-filter: blur(8px);
    max-width: min(60%, 22rem);
}

.plate__name {
    font-size: clamp(0.78rem, 1.7vw, 1.05rem);
    font-weight: 800;
    line-height: 1.15;
    color: rgb(255 255 255 / 0.97);
}

.plate__voice {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: clamp(0.55rem, 1vw, 0.68rem);
    color: rgb(255 255 255 / 0.68);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.plate__shaped {
    font-style: normal;
    padding: 0.02rem 0.28rem;
    border-radius: 0.2rem;
    background: rgb(var(--sfs-warning-rgb, 232 196 92) / 0.9);
    color: rgb(28 22 4);
    font-weight: 800;
}

.plate-enter-active, .plate-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.plate-enter-from, .plate-leave-to { opacity: 0; transform: translateY(0.4rem); }

/* -- lower third ----------------------------------------------------- */
.third {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: clamp(0.5rem, 1.3vw, 0.85rem) clamp(0.6rem, 1.6vw, 1.1rem);
    padding-bottom: calc(clamp(0.5rem, 1.3vw, 0.85rem) + 4px);
    background: linear-gradient(to top, rgb(0 0 0 / 0.86), rgb(0 0 0 / 0.42) 70%, transparent);
}

.third-enter-active, .third-leave-active {
    transition: opacity 0.22s ease, transform 0.22s ease;
}

.third-enter-from, .third-leave-to { opacity: 0; transform: translateY(0.5rem); }

.third__flag {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.28rem;
    background: var(--sfs-danger, #d24b5a);
    color: var(--sfs-on-danger, #ffffff);
}

.third__text {
    margin: 0;
    font-size: clamp(0.8rem, 1.9vw, 1.25rem);
    font-weight: 700;
    line-height: 1.3;
    color: rgb(255 255 255 / 0.97);
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.stage__progress {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: 4px;
    background: rgb(255 255 255 / 0.14);
}

.stage__progress > span {
    display: block;
    height: 100%;
    background: var(--sfs-accent, #667eea);
    transition: width 0.4s ease;
}

/* -- ticker strip ---------------------------------------------------- */
.studio__strip {
    border-top: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
    background: rgb(0 0 0 / 0.42);
}

.studio__strip:empty { display: none; }

/* The ticker is a card of its own everywhere else on the platform. Inside the
   frame it is part of the picture, so its border and corners come off — a
   rounded box floating inside a studio reads as a widget, not as a strap. */
.studio__strip :deep(.ticker) {
    border: 0;
    border-radius: 0;
    background: transparent;
}

@media (prefers-reduced-motion: reduce) {
    /* The stills carry the whole design on their own — this is exactly the
       case the layered still was built for. */
    .shot__loop { display: none; }
    .bug__live--on .bug__dot { animation: none; }
}
</style>
