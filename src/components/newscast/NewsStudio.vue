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

import StudioScreen from './StudioScreen.vue';

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
    /** The article picture, for the left-hand monitor. */
    articleImage?: string;
    /** The line being read right now, for the right-hand monitor. */
    liveText?: string;
    /** Straps and chips on the two monitors. */
    screenImageLabel: string;
    screenTextLabel: string;
    screenSource?: string;
    screenIdle: string;
}>();

const SHOTS: Record<Shot, { still: string; loop: string }> = {
    empty: { still: emptyStill, loop: emptyLoop },
    female: { still: femaleStill, loop: femaleLoop },
    male: { still: maleStill, loop: maleLoop },
};

const SHOT_ORDER: Shot[] = ['empty', 'female', 'male'];

const shot = computed<Shot>(() => props.anchor ?? 'empty');

/**
 * Neither monitor has anything on it yet.
 *
 * Only used by the stacked layout, and it earns its place there: overlaid, two
 * standby monitors cost nothing, but stacked they are ~440px of "Studio
 * standby" sitting between the studio and the play button on a phone — so the
 * first thing a visitor has to do on the one page that needs no account is
 * scroll past two empty screens to find out how to start it.
 */
const monitorsIdle = computed(() => !props.articleImage && !props.liveText);

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

        <!--
          The two studio monitors.

          A SIBLING of the stage rather than a child of it, and that is what
          makes the two layouts possible without duplicating them in the DOM:
          on a wide screen they are placed into the stage's own grid cell and
          float over the picture, over-the-shoulder, the way a broadcast puts
          them. Below 1100px they fall back into normal flow underneath it —
          because the phone complaint that started this was overlays covering
          the presenter's face, and the answer to that is not smaller overlays.
        -->
        <div class="screens" :class="{ 'screens--idle': monitorsIdle }">
            <StudioScreen
                class="screens__one"
                :label="screenImageLabel"
                :strap="screenSource"
                :live="live"
                :placeholder="screenIdle"
            >
                <img v-if="articleImage" class="screens__photo" :src="articleImage"
                     alt="" loading="lazy" referrerpolicy="no-referrer" />
            </StudioScreen>

            <!--
              Between bulletins there is no presenter to name, and a monitor
              with a blank strap looks like a monitor with a fault — so the
              brand fills the gap, as it does on the studio wall behind it.
            -->
            <StudioScreen
                class="screens__two"
                :label="screenTextLabel"
                :strap="anchorName || 'Self Study JO'"
                :live="live && speaking"
                :placeholder="screenIdle"
            >
                <p v-if="liveText" class="screens__script" :key="liveText">{{ liveText }}</p>
            </StudioScreen>
        </div>

        <!-- The ticker sits inside the frame, where a broadcast puts it. -->
        <div class="studio__strip">
            <slot name="ticker"></slot>
        </div>
    </section>
</template>

<style scoped>
/*
  A grid, so the monitor row can either sit in its own row under the picture or
  be dropped into the picture's cell and overlap it — with one DOM, no
  duplication, and no JavaScript watching the viewport.
*/
.studio {
    position: relative;
    display: grid;
    /* ONE column, stated explicitly. Without it, giving `.screens` the stage's
       row does not stack the two — auto-placement looks for the next FREE slot
       in that row, invents a second column, and puts the monitors in a 236px
       gutter beside the picture. Sharing a cell needs both the row and the
       column pinned. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto auto;
    border-radius: 1rem;
    overflow: hidden;
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.16);
    background: var(--sfs-overlay, #05070f);
    box-shadow: 0 18px 46px rgb(0 0 0 / 0.32);
}

.studio__stage { grid-area: 1 / 1; }
.screens { grid-area: 2 / 1; }
.studio__strip { grid-area: 3 / 1; }

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

/* -- the two monitors ------------------------------------------------ */
.screens {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
    padding: 0.7rem;
    background: linear-gradient(to bottom,
        rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05), transparent);
    border-top: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.1);
}

.screens__photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 0.1rem;
    display: block;
}

.screens__script {
    margin: auto 0;
    width: 100%;
    max-height: 100%;
    overflow: hidden;
    font-size: clamp(0.62rem, 1.15vw, 0.95rem);
    font-weight: 600;
    line-height: 1.5;
    color: rgb(255 255 255 / 0.96);
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.7);
    /* Clamped, never scrolled: a monitor that scrolls under the reader's own
       hand is a control, and this is a display. The line being read is short
       by construction — the engine caps a detail at three sentences. */
    display: -webkit-box;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    -webkit-box-orient: vertical;
    /* Each new line fades up, so the glass reads as changing rather than as
       text being retyped in place. */
    animation: cue 0.32s ease;
}

@keyframes cue {
    from { opacity: 0; transform: translateY(0.35rem); }
    to   { opacity: 1; transform: none; }
}

/*
  Into the top corners, once there is room for it — desktops, laptops and TVs.

  `grid-area: 1 / 1` drops the monitor row into the stage's own cell; grid lets
  two items share one cell, which is what makes the overlay and the stacked
  layout the same markup. Both the row AND the column have to be pinned — with
  the row alone, auto-placement hunts for the next free slot and invents a
  second column beside the picture.

  Flush: no padding, no gap, so each monitor's outer corner meets the frame's
  own corner and the studio's rounded corner clips it. Floated inwards they read
  as two windows dropped on top of a photograph; in the corners they read as
  part of the set. The presenter is dead centre in every shot, so 27% a side
  leaves them clear either way.
*/
@media (min-width: 1100px) {
    .screens {
        grid-area: 1 / 1;
        align-self: start;
        z-index: 2;
        padding: 0;
        gap: 0;
        justify-content: space-between;
        grid-template-columns: 27% 27%;
        background: none;
        border-top: 0;
        /* The picture behind stays draggable/selectable; nothing here is a
           control, so nothing here should swallow a click. */
        pointer-events: none;
    }

    .screens__one { justify-self: start; }
    .screens__two { justify-self: end; }

    /*
      Both top corners are monitors now, so the on-air bug takes the only piece
      of frame left to it: the gap between them. That is 46% of the width, more
      than twice what the chips need, and a centred live bug over a two-screen
      wall is what the corner arrangement asks for — left-aligned it would sit
      underneath the left monitor.
    */
    .bug {
        inset-inline: 0;
        justify-content: center;
    }
}

/* Stacked, they take real vertical space, so they wait until they have
   something to show. Overlaid (above) they cost none and stay on standby. */
@media (max-width: 1099px) {
    .screens--idle { display: none; }
}

@media (max-width: 560px) {
    /* Two monitors side by side on a phone are two unreadable monitors. */
    .screens {
        grid-template-columns: minmax(0, 1fr);
        gap: 0.5rem;
    }
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

/*
  THE NAME PLATE ON A SMALL SCREEN.

  Reported as "the face of the anchor does not appear because of the
  خدمة سيلف ستدي الصوتية and Microsoft Zira - English (United States) labels".
  The plate is anchored a fixed distance off the bottom of the stage, which is
  fine at 740px tall and is most of the way up the presenter's chest at 200px —
  so on a phone a technical voice ID was parked across their chin.

  The name stays, because a name plate under a presenter is the one caption a
  broadcast always has room for. The VOICE goes: it is a diagnostic, it is the
  longest string on the page, and the page shows it under the transport
  controls where there is a whole line for it. Nothing is lost and the face is
  the face again.
*/
@media (max-width: 760px) {
    .plate {
        bottom: auto;
        top: 2.6rem;
        inset-inline-start: 0.45rem;
        max-width: 52%;
        padding: 0.22rem 0.5rem;
    }

    .plate__voice { display: none; }

    .third { padding-block: 0.45rem; }
    .third__text { -webkit-line-clamp: 2; line-clamp: 2; }
}

/* Shorter than it is narrow — a landscape phone, where the stage is a letterbox
   and every overlay is competing for the same few pixels. */
@media (max-height: 460px) and (orientation: landscape) {
    .plate { top: 2.4rem; bottom: auto; }
    .plate__voice { display: none; }
}

@media (prefers-reduced-motion: reduce) {
    /* The stills carry the whole design on their own — this is exactly the
       case the layered still was built for. */
    .shot__loop { display: none; }
    .bug__live--on .bug__dot { animation: none; }
    .screens__script { animation: none; }
}
</style>
