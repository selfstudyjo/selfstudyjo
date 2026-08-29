<!--
  The studio — one room, two anchors, and a video wall between them.

  ============================================================
  WHAT THIS USED TO BE, AND WHY IT IS NOT THAT ANY MORE
  ============================================================

  Ten files: two anchor stills, four anchor loops and four plates of a "set"
  that were three photographs of three different rooms. Most of this component
  was the arithmetic of making those three photographs look like one place —

    * each LISTENING plate matched to its speaking plate by a scale-and-offset
      search scored on the set only, with the middle third masked out;
    * the female pair lifted 26 column-pixels against the male, because the two
      renders sat at different heights in "the" room;
    * two masked `backdrop-filter` strips to DISSOLVE the column joins, tuned
      until the luminance gradient at the seam measured 1.15x the picture's own
      rather than 20.6x;
    * a separately-photographed desk front laid across the bottom 29%, because
      that was the only way to hide the seam where the eye rests.

  Every one of those was solving, in image space, a problem that does not exist
  in a scene. There is one room now, the anchors are in it, and the desk is one
  object: the joins cannot be visible because there are no joins, and the
  columns cannot come apart when `max-height` squeezes the stage because there
  are no columns.

  The half that no amount of image work could ever have bought is the motion.
  A loop is a fixed performance: the mouth stopped when it wrapped and carried
  on after the anchor had finished, which every viewer reads as a video of
  somebody else with audio laid over it. The anchors are animated against the
  ACTUAL WAVEFORM of the clip playing (see `utils/speechAudio.ts`), they blink
  on human intervals, they breathe, and the one who is not reading turns and
  looks at the one who is.

  ============================================================
  WHAT THIS COMPONENT STILL OWNS
  ============================================================

  Everything with words on it. The on-air bug, the two name plates, the lower
  third, the progress bar and the ticker strip are DOM, exactly as they were:
  they are text, so they belong in the document where they can be translated,
  selected, read by a screen reader and coloured by the theme. Only the room is
  drawn.

  The plates are pinned from {@link PLATE_X} rather than from a percentage in
  the stylesheet. The old pair — 12.33% and 87.67% — were the midpoints of two
  photographic plates written down a second time, correct for exactly as long
  as nobody moved anything.

  MALE IS SCREEN-RIGHT AND FEMALE IS SCREEN-LEFT, which is the other way round
  from the photographed set. It is decided once, in `layout.ts`, and both the
  renderer and these plates read it from there.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { Radio, Volume2 } from 'lucide-vue-next';

import { PLATE_X } from '@/stage3d/layout';
import { hasWebGL } from '@/stage3d/loader';
import type { StudioStage } from '@/stage3d/studioStage';

type AnchorId = 'male' | 'female';

/** Left to right, which is also the order the plates are drawn in. */
const SIDES: AnchorId[] = ['female', 'male'];

/** Everything the plate under one presenter needs. */
interface AnchorInfo {
    name: string;
    /** The voice actually speaking, so it can be checked without a debugger. */
    voice: string;
    /** True when this one is on the reshaped stand-in rather than a real voice. */
    shaped: boolean;
}

const props = defineProps<{
    /** Whose turn it is, or null between bulletins. Both stay on camera either way. */
    anchor: AnchorId | null;
    /** Is that person actually talking right now? */
    speaking: boolean;
    /**
     * How loud they are, 0…1.
     *
     * A live reading off the clip that is playing, which is what makes the
     * mouth open on the words. Absent, the syllable model in `figures.ts`
     * carries it — see `jawOpen`.
     */
    energy?: number;
    /** On air, as opposed to cued up and ready. */
    live: boolean;
    male: AnchorInfo;
    female: AnchorInfo;
    /** Headline on the lower third. */
    headline: string;
    /** Kicker on the bug: category · source. */
    kicker: string;
    /** 0-100. */
    progress: number;
    liveLabel: string;
    readyLabel: string;
    freshLabel?: string;
    fresh?: boolean;
    rtl: boolean;
    /** BCP-47 tag for the studio clock — Arabic gets Arabic-Indic digits. */
    locale?: string;
    shapedLabel?: string;
    /** The article picture, for the video wall. */
    articleImage?: string;
    /** Attribution strap on the wall while a picture is up. */
    screenSource?: string;
}>();

const info = computed<Record<AnchorId, AnchorInfo>>(() => ({
    male: props.male,
    female: props.female,
}));

/* ---- the renderer ---------------------------------------------------- */

const stageEl = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
/**
 * `shallowRef`, not `ref`.
 *
 * The stage owns a Babylon scene with tens of thousands of objects in it, and a
 * deep reactive proxy over that is not slow, it is fatal — Vue would walk the
 * whole graph on creation and then intercept every property access the render
 * loop makes, sixty times a second.
 */
const stage = shallowRef<StudioStage | null>(null);
const supported = ref(true);
/** True once the renderer is up. Until then the flat backdrop stands in. */
const ready = ref(false);

let observer: ResizeObserver | null = null;

onMounted(async () => {
    supported.value = hasWebGL();
    if (!supported.value || !canvasEl.value || !stageEl.value) return;

    // Dynamic, and this is what keeps Babylon out of every other route's
    // bundle. `hasWebGL()` above is deliberately synchronous and dependency-
    // free so the fallback can be decided without downloading the renderer to
    // find out it cannot run.
    const { createStudioStage } = await import('@/stage3d/studioStage');
    if (!canvasEl.value || !stageEl.value) return;       // unmounted mid-download

    stage.value = await createStudioStage(canvasEl.value, { hostEl: stageEl.value });
    ready.value = true;
    push();

    observer = new ResizeObserver(() => stage.value?.resize());
    observer.observe(stageEl.value);
});

onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
    // Releases the WebGL context immediately. Left to the collector, a reader
    // who opens the Newscast three times in a session is three contexts closer
    // to the browser killing somebody else's canvas.
    stage.value?.dispose();
    stage.value = null;
});

/** Everything the stage needs, pushed in one place so nothing can be forgotten. */
function push(): void {
    const active = stage.value;
    if (!active) return;
    active.setSpeaking(props.speaking ? props.anchor : null, props.energy ?? 0.7);
    active.setLive(props.live);
    active.setScreen({
        image: props.articleImage || '',
        title: props.headline,
        kicker: props.screenSource || props.kicker,
        rtl: props.rtl,
    });
}

watch(() => [props.anchor, props.speaking, props.energy] as const, () => {
    stage.value?.setSpeaking(props.speaking ? props.anchor : null, props.energy ?? 0.7);
});
watch(() => props.live, live => stage.value?.setLive(live));
/*
  The wall is only redrawn when what is ON it changes.

  Not on every prop tick: drawing it means a 1024x576 canvas pass and a texture
  upload, and the headline prop changes on every segment while the picture
  changes once per story. Keyed on the tuple so a story with no picture still
  refreshes its title card when the headline moves.
*/
watch(() => [props.articleImage, props.headline, props.screenSource, props.rtl] as const, () => {
    stage.value?.setScreen({
        image: props.articleImage || '',
        title: props.headline,
        kicker: props.screenSource || props.kicker,
        rtl: props.rtl,
    });
});

/* -- studio clock ----------------------------------------------------
   Furniture, and the cheapest authenticity there is: every rolling-news
   channel has the time in the corner, and on a bulletin that is rebuilt every
   hour it is genuinely informative rather than decorative. Ticks on the
   minute-ish rather than the second, because the seconds are not shown and a
   1Hz timer on a public page is a wakeful tab for no reason. */
const clock = ref('');
let clockTimer: ReturnType<typeof setInterval> | undefined;

function tick() {
    try {
        clock.value = new Intl.DateTimeFormat(props.locale || 'en', {
            hour: '2-digit', minute: '2-digit',
        }).format(new Date());
    } catch {
        clock.value = '';
    }
}

watch(() => props.locale, tick, { immediate: true });
onMounted(() => { tick(); clockTimer = setInterval(tick, 15_000); });
onBeforeUnmount(() => clearInterval(clockTimer));
</script>

<template>
    <section class="studio" :class="{ 'studio--live': live }" :dir="rtl ? 'rtl' : 'ltr'">
        <div class="studio__stage" ref="stageEl">
            <!--
              The room. One canvas, one scene: the cyclorama, the rig, the desk,
              the video wall and both anchors. Everything below it in this
              template is an overlay ON the picture, which is why the vignette
              and the sheen come first and the graphics after — the bottom of
              the vignette is black at 55% and would otherwise be sitting on top
              of the name plates it exists to make readable.
            -->
            <canvas
                v-if="supported" ref="canvasEl" class="stage__canvas"
                aria-hidden="true"
            ></canvas>

            <!--
              No WebGL — OR the renderer has not finished arriving.

              Both get the same lit gradient, and covering the second case is
              the point: the Babylon chunk is the largest thing this app ships
              and building the scene compiles a dozen PBR shaders, so on a cold
              cache or a slow machine there are a few seconds during which the
              canvas is genuinely empty. Left uncovered that is a black
              rectangle where the studio should be, which reads as broken rather
              than as loading — and the audio is unaffected either way, because
              it never depended on the picture.
            -->
            <div v-if="!supported || !ready" class="stage__flat" aria-hidden="true">
                <span class="stage__flatGlow"></span>
            </div>

            <span class="stage__vignette" aria-hidden="true"></span>
            <span class="stage__sheen" aria-hidden="true"></span>

            <!-- Top corner: the on-air light and what is being covered. -->
            <div class="bug" :dir="rtl ? 'rtl' : 'ltr'">
                <span class="bug__live" :class="{ 'bug__live--on': live }">
                    <span class="bug__dot"></span>
                    {{ live ? liveLabel : readyLabel }}
                </span>
                <span v-if="kicker" class="bug__kicker">{{ kicker }}</span>
                <span v-if="fresh && freshLabel" class="bug__fresh">{{ freshLabel }}</span>
                <!-- `tabular-nums` in the CSS: without it the chip twitches
                     wider and narrower as the digits change. -->
                <span v-if="clock" class="bug__clock">{{ clock }}</span>
            </div>

            <!--
              A name plate per presenter, both always up, the reader's one lit.
              Both, because "which voice is آدم actually on?" is the question
              this page has been asked four times and could not answer; lit,
              because with two people permanently on camera a reader needs some
              cue as to which of them is talking that is not just watching for a
              moving mouth.

              `left` comes from the same constant the renderer places the anchor
              with, so the plate cannot drift off the person it names. The
              camera is HORIZONTAL-fov-fixed precisely so that constant stays
              true when `max-height` makes the stage squatter than its ratio.
            -->
            <div v-for="side in SIDES" :key="`plate-${side}`"
                 class="plate"
                 :class="{
                     'plate--on': anchor === side,
                     'plate--dim': anchor !== null && anchor !== side,
                 }"
                 :style="{ left: `${PLATE_X[side] * 100}%` }"
                 :dir="rtl ? 'rtl' : 'ltr'">
                <span class="plate__name">{{ info[side].name }}</span>
                <span class="plate__voice">
                    <Volume2 :size="11" />
                    {{ info[side].voice }}
                    <em v-if="info[side].shaped && shapedLabel" class="plate__shaped">
                        {{ shapedLabel }}
                    </em>
                </span>
            </div>

            <!--
              Lower third — present only when there is something on it. A strap
              carrying an empty line is a broadcast fault, and it read as
              exactly that: a red flag floating in the corner of an empty studio
              with no sentence beside it.
            -->
            <transition name="third">
                <div v-if="headline" class="third" :dir="rtl ? 'rtl' : 'ltr'">
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
    display: grid;
    grid-template-columns: minmax(0, 1fr);
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
    /* The set's own aspect. Reserving the box by ratio means the page does not
       jump when the renderer arrives. */
    aspect-ratio: 1428 / 788;
    /* ...but not at the cost of the transport. At full ratio on a laptop the
       stage is ~740px and the play button is below the fold, which on a page
       whose entire purpose is "press play" is the wrong trade. */
    max-height: min(68vh, 44rem);
    /*
      ============================================================
      AND THE WIDTH IS CAPPED TO MATCH, WHICH IS THE ACTUAL BUG FIX
      ============================================================

      Reported as "the display screen does not appear completely", and this line
      is where that came from. `aspect-ratio` is a PREFERENCE, not a constraint:
      with `width: 100%` and a `max-height` that binds, the box keeps its full
      width and loses height, so its real aspect goes well past 1.812. A 1920x800
      window gives a ~1400px stage capped at 544px -- an aspect of 2.6.

      The camera is HORIZONTAL-fixed (see `layout.ts`), deliberately, because that
      is what lets the DOM name plates be pinned to constants. The consequence
      nobody had written down is that a squatter box therefore loses VERTICAL
      field: at 2.6 the visible height at the wall plane falls from 2.73 m to
      1.92 m and a third of the video wall is above the top of the picture. The
      lighting rig went with it.

      Capping the width at the same ratio means the box can never be squatter
      than it was designed for: whichever of the two caps binds, the other
      follows, and the aspect is exactly 1428/788 at every viewport. What is
      given up is some width on a wide, short window -- which is why it centres.

      `layout.ts` places everything from `SAFE_ASPECT` anyway. This file, the
      preview harness and any future embed are three places to forget a cap, and
      a set that is only composed correctly when the CSS is right is a set that
      will be wrong again.
    */
    max-width: calc(min(68vh, 44rem) * 1428 / 788);
    margin-inline: auto;
    overflow: hidden;
    background: var(--sfs-overlay, #05070f);
    /*
      NOT MIRRORED, EVER.

      The set is a place, not a paragraph: آدم sits screen-right and the desk,
      the wall and the lighting are built around that. Following `dir` would put
      the whole room in a mirror — which for a photographed set broke the desk
      at both joins, and for a rendered one simply puts the presenters in the
      wrong seats, contradicting the plates that name them. The overlays that
      carry TEXT set their own direction; see the `:dir` bindings above.
    */
    direction: ltr;
}

.stage__canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    /* Nothing in the room is interactive; every control on this page is DOM. */
    pointer-events: none;
}

/* -- no WebGL --------------------------------------------------------- */
.stage__flat {
    position: absolute;
    inset: 0;
    background:
        radial-gradient(120% 90% at 50% 8%, rgb(30 52 104 / 0.55), transparent 62%),
        linear-gradient(180deg, #0b1730 0%, #060b18 62%, #04070f 100%);
}

.stage__flatGlow {
    position: absolute;
    inset-inline: 8%;
    bottom: 22%;
    height: 3px;
    border-radius: 3px;
    background: linear-gradient(90deg, transparent,
        rgb(var(--sfs-accent-rgb, 102 126 234) / 0.85), transparent);
    box-shadow: 0 0 22px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.55);
}

/* -- camera feel ------------------------------------------------------ */
.stage__vignette,
.stage__sheen {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.stage__vignette {
    background:
        radial-gradient(120% 90% at 50% 42%, transparent 52%, rgb(0 0 0 / 0.55) 100%);
}

.stage__sheen {
    background: linear-gradient(180deg,
        rgb(255 255 255 / 0.05) 0%, transparent 22%, transparent 78%,
        rgb(0 0 0 / 0.22) 100%);
}

/* -- the on-air bug --------------------------------------------------- */
.bug {
    position: absolute;
    top: clamp(0.5rem, 1.4vw, 0.9rem);
    inset-inline-start: clamp(0.5rem, 1.4vw, 0.9rem);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    max-width: 70%;
}

.bug__live,
.bug__kicker,
.bug__fresh,
.bug__clock {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.5rem;
    border-radius: 0.28rem;
    font-size: clamp(0.55rem, 1.05vw, 0.72rem);
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    white-space: nowrap;
}

.bug__live {
    background: rgb(0 0 0 / 0.55);
    color: rgb(255 255 255 / 0.78);
}

.bug__live--on {
    background: var(--sfs-danger, #d24b5a);
    color: var(--sfs-on-danger, #ffffff);
}

.bug__dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.6;
}

.bug__live--on .bug__dot {
    opacity: 1;
    animation: bug-pulse 1.4s ease-in-out infinite;
}

@keyframes bug-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%      { transform: scale(1.35); opacity: 0.55; }
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

.bug__clock {
    background: rgb(0 0 0 / 0.5);
    color: rgb(255 255 255 / 0.9);
    /* Or the chip changes width as the digits do, twitching the whole row. */
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
}

/* -- name plates ------------------------------------------------------ */
/*
  Centred on their presenter. `left` is an inline style from `PLATE_X`, which
  is the same constant the renderer places the anchor with — the pair of
  percentages that used to live here were the midpoints of two photographic
  plates, written down a second time and true only until something moved.

  Clear of the lower third: the strap's gradient reaches ~30% up the stage, and
  a name plate inside it is a name plate nobody can read.
*/
.plate {
    position: absolute;
    transform: translateX(-50%);
    bottom: clamp(3.4rem, 8.5vw, 5.2rem);
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.3rem 0.65rem;
    border-radius: 0.3rem;
    border-bottom: 2px solid rgb(255 255 255 / 0.22);
    background: rgb(0 0 0 / 0.55);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    max-width: 26%;
    text-align: center;
    transition: opacity 0.28s ease, border-color 0.28s ease, background 0.28s ease;
}

.plate--dim { opacity: 0.6; }

.plate--on {
    border-bottom-color: var(--sfs-accent, #667eea);
    background: rgb(0 0 0 / 0.68);
}

.plate__name {
    font-size: clamp(0.7rem, 1.4vw, 0.98rem);
    font-weight: 800;
    line-height: 1.15;
    color: rgb(255 255 255 / 0.97);
}

.plate__voice {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    font-size: clamp(0.5rem, 0.9vw, 0.64rem);
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

/*
  THE NAME PLATES ON A SMALL SCREEN.

  Reported the first time round as "the face of the anchor does not appear
  because of the labels": the voice ID is the longest string on the page and at
  200px of stage height it parked across a presenter's chin.

  The names stay — a broadcast always has room for a name plate. The voice goes
  to the chip row under the transport, where it has a whole line to itself. It
  is a diagnostic, not a caption.
*/
@media (max-width: 900px) {
    .plate__voice { display: none; }

    .plate {
        bottom: clamp(2.2rem, 6vw, 3.4rem);
        padding: 0.18rem 0.4rem;
        max-width: 30%;
    }
}

@media (max-width: 760px) {
    .third { padding-block: 0.45rem; }
}

@media (max-width: 560px) {
    /* Under a phone's width the plates are wider than the space between the
       presenters, so they overlap the wall and each other. Both anchors are on
       camera, which is what matters; who is speaking is carried by the moving
       mouth and by the chip row below. */
    .plate { display: none; }

    .bug { max-width: 100%; }

    /* Four chips wrap to two rows here and the bug then covers a third of the
       picture. The clock is the one of the four that nothing depends on and
       that the device already shows in its own status bar. */
    .bug__clock { display: none; }
}

/* Shorter than it is narrow — a landscape phone, where the stage is a
   letterbox and every overlay competes for the same few pixels. */
@media (max-height: 460px) and (orientation: landscape) {
    .plate { display: none; }
}

@media (prefers-reduced-motion: reduce) {
    /* The renderer scales its own idle amplitudes down rather than freezing —
       see `loader.ts`. This is only the DOM half. */
    .bug__live--on .bug__dot { animation: none; }
}
</style>
