<script setup lang="ts">
/**
 * The studio — one set, three columns, both presenters on camera the whole time.
 *
 * WHAT CHANGED, AND WHY THE OLD SHAPE HAD TO GO
 *
 * The first studio was six FULL-STAGE shots — an empty room, ليلى at the desk,
 * آدم at the desk — and the bulletin cut between them like a gallery. It read
 * well and it had one flaw that no amount of tuning fixes: for the whole of
 * every story, one of the two presenters was not in the programme. A viewer
 * watching a handover saw one person vanish and another appear in the same
 * chair. Worse, it made every voice problem invisible — the four separate
 * reports of "the man sounds like a woman" all happened while the man was, for
 * most of the bulletin, not on screen to be looked at.
 *
 * The set is now three plates that join into one continuous room:
 *
 *   left    آدم at his desk, facing in
 *   centre  the lighting rig, the video wall, and the desk front
 *   right   ليلى at her desk, facing in
 *
 * Both anchors are always there. What changes when the rota moves is which of
 * the two is MOVING: the speaker's loop plays and the other sits on their still.
 * That is what a two-shot newsroom actually looks like, and it means the reader
 * can always see who is talking rather than having to infer it from a name plate.
 *
 * WHERE THE GEOMETRY COMES FROM — none of it is guessed
 *
 * Every number in the CSS was measured off the supplied files:
 *
 *   anchor plate  916x2050 after the letterbox comes off  -> aspect 0.4468
 *   set plates    724 wide, all three, once their flat pad columns come off
 *   set column    137 + 268 + 383 = 788 tall, stacked
 *   side column   788 * 0.4468 = 352
 *   the stage     352 + 724 + 352 = 1428 x 788  ->  1.812
 *
 * So the three columns are one grid row — equal height by construction, not by
 * a rule that has to be maintained — and the two side columns are equal width
 * because they are the same plate shape. 1.812 is within 1% of the 1408x768
 * the old stage used, which is why nothing else on the page had to move.
 *
 * WHY VIDEO AND NOT THE GIFs
 *
 * The two GIFs are 98.7 MB and 108 MB, 207 MB together. GitHub refuses anything
 * over 100 MB outright, and a public page could not serve either regardless.
 * Re-encoded to H.264 they are 314 KB and 236 KB — denoised first, because GIF
 * dither is what the encoder would otherwise spend its whole bitrate on — and
 * the stills are WebP at ~115 KB. The five set files are WebP at 46 KB. The
 * whole studio is 826 KB:
 *
 *   ffmpeg -i <gif> -vf "crop=916:2050:0:104,hqdn3d=4:3:6:4,scale=640:-2:flags=lanczos" \
 *          -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -an -movflags +faststart <mp4>
 *
 * Both GIFs are cropped to the SAME box even though only the male one is
 * letterboxed. That is what makes the two side columns identical in shape; what
 * the female plate gives up is 104px of ceiling and 106px of desk front, which
 * is exactly what `object-fit: cover` would have taken anyway — only now it is
 * taken once, predictably, and those pixels are never shipped.
 *
 * THE STILL UNDERNEATH IS NOT A FALLBACK
 *
 * Each anchor's WebP sits behind their video at full opacity and the video
 * fades in on top. One arrangement covers four things: the first paint before
 * anything has buffered, the poster for a browser that refuses autoplay, the
 * sitting-but-not-speaking state, and `prefers-reduced-motion` — where the
 * loops are simply switched off and the studio still looks right.
 */

import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Radio, Volume2 } from 'lucide-vue-next';

import maleStill from '@/assets/studio/anchor_male.webp';
import maleLoop from '@/assets/studio/anchor_male.mp4';
import femaleStill from '@/assets/studio/anchor_female.webp';
import femaleLoop from '@/assets/studio/anchor_female.mp4';
import setLamp from '@/assets/studio/set_lamp.webp';
import setScreen from '@/assets/studio/set_screen.webp';
import setTable from '@/assets/studio/set_table.webp';

type AnchorId = 'male' | 'female';

/** Left to right, which is also the order the two columns are drawn in. */
const SIDES: AnchorId[] = ['male', 'female'];

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
    /** Is that person actually talking right now? Drives still vs loop. */
    speaking: boolean;
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
    shapedLabel?: string;
    /** The article picture, for the video wall. */
    articleImage?: string;
    /** Attribution strap on the wall while a picture is up. */
    screenSource?: string;
}>();

const ANCHORS: Record<AnchorId, { still: string; loop: string }> = {
    male: { still: maleStill, loop: maleLoop },
    female: { still: femaleStill, loop: femaleLoop },
};

const info = computed<Record<AnchorId, AnchorInfo>>(() => ({
    male: props.male,
    female: props.female,
}));

/**
 * Which anchor's loop should be running, or null for a still studio.
 *
 * Only ever one. Two mouths moving at once is the single most obviously wrong
 * thing a two-anchor studio can do, and it is what a naive "play while the
 * bulletin is live" rule produces on every handover.
 */
const moving = computed<AnchorId | null>(() =>
    props.speaking && props.anchor ? props.anchor : null);

/**
 * A third-party picture that failed to load leaves the wall washed in nothing —
 * a dark rectangle where the ident used to be, which reads as the wall being
 * broken rather than as a missing photo. Remember the miss and fall back to the
 * ident, which is what the wall shows between stories anyway.
 */
const failedImage = ref('');

const wallImage = computed(() =>
    props.articleImage && props.articleImage !== failedImage.value
        ? props.articleImage
        : '');

const videos = ref<Record<string, HTMLVideoElement | null>>({});

function setVideo(name: AnchorId, element: unknown) {
    videos.value[name] = (element as HTMLVideoElement) || null;
    // Template refs are assigned during mount, which is AFTER the immediate
    // watcher below has already run. Without this, a bulletin that is already
    // playing when the component mounts sits on both stills.
    if (element && moving.value === name) {
        (element as HTMLVideoElement).play().catch(() => undefined);
    }
}

watch(moving, (now, before) => {
    if (before && before !== now) {
        // Paused, not reset: a presenter who stops for a breath and starts
        // again should pick up where they were, and rewinding to frame zero
        // makes them twitch on every segment boundary.
        videos.value[before]?.pause();
    }
    if (!now) return;
    // Autoplay of a muted video is allowed everywhere, but a refusal is still a
    // rejected promise nobody sees — and the still underneath means a refusal
    // costs motion and nothing else.
    videos.value[now]?.play().catch(() => undefined);
}, { immediate: true });

onBeforeUnmount(() => {
    for (const element of Object.values(videos.value)) element?.pause();
});
</script>

<template>
    <section class="studio" :class="{ 'studio--live': live }" :dir="rtl ? 'rtl' : 'ltr'">
        <div class="studio__stage">
            <!--
              THE ROOM — the three columns, and nothing that carries text.

              It is a separate box from the stage so that the whole set scales
              as ONE picture: it holds the set's own aspect and the stage clips
              it, which is `object-fit: cover` applied to a grid. See the CSS.
            -->
            <div class="stage__room">
                <!--
                  LEFT is آدم and RIGHT is ليلى. Both columns are the same
                  markup; all that differs is which plate and which name.
                -->
                <div v-for="side in SIDES" :key="side"
                     class="col col--anchor"
                     :class="[`col--${side}`, {
                         'col--dim': anchor !== null && anchor !== side,
                     }]">
                    <img class="col__still" :src="ANCHORS[side].still" alt="" draggable="false" />
                    <video
                        :ref="(element) => setVideo(side, element)"
                        class="col__loop" :class="{ 'col__loop--on': moving === side }"
                        :src="ANCHORS[side].loop"
                        :poster="ANCHORS[side].still"
                        muted loop playsinline preload="auto" disablepictureinpicture
                    ></video>
                </div>

                <!--
                  CENTRE — the set. Three static plates in one column: the
                  lighting rig, the video wall, the desk front. Their rows are
                  in the plates' own proportions (137 / 268 / 383), so the join
                  lines land where the photograph put them.
                -->
                <div class="col col--set">
                    <img class="set__plate" :src="setLamp" alt="" draggable="false" />

                    <div class="wall">
                        <img class="wall__ident" :src="setScreen" alt="" draggable="false" />

                        <!--
                          The picture goes on the wall, whole — contained, never
                          cropped, because the point of putting it up is that
                          the viewer sees the photograph the newsroom filed. A
                          news photo is 16:9 or 4:3 and the wall is nearly 3:1,
                          so there is always slack at the sides; it is filled by
                          the same photo blurred, which is what a real video
                          wall does with an off-shape source and is the only
                          thing that stops the ident showing through beside it.
                        -->
                        <transition name="wall">
                            <div v-if="wallImage" :key="wallImage" class="wall__feed">
                                <img class="wall__wash" :src="wallImage" alt="" aria-hidden="true"
                                     referrerpolicy="no-referrer" />
                                <span class="wall__scrim" aria-hidden="true"></span>
                                <img class="wall__photo" :src="wallImage" alt=""
                                     loading="lazy" referrerpolicy="no-referrer"
                                     @error="failedImage = wallImage" />
                                <span v-if="screenSource" class="wall__strap">
                                    <span class="wall__strapFlag"></span>
                                    <span class="wall__strapText">{{ screenSource }}</span>
                                </span>
                            </div>
                        </transition>

                        <span class="wall__scan" aria-hidden="true"></span>
                    </div>

                    <img class="set__plate" :src="setTable" alt="" draggable="false" />
                </div>
            </div>

            <!--
              Vignette and scan sheen: it is a camera feed, not a photo. They
              go over the ROOM and under everything below, which is the whole
              reason the graphics are written after them — the bottom of the
              vignette is black at 55% and it would otherwise be sitting on top
              of the name plates, dimming the one caption they exist to make
              readable.
            -->
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
            </div>

            <!--
              A name plate per presenter, both always up, the reader's one lit.
              Both, because "which voice is آدم actually on?" is the question
              this page has been asked four times and could not answer; lit,
              because with two people permanently on camera a reader needs some
              cue as to which of them is talking that is not just watching for a
              moving mouth.

              Pinned to the STAGE rather than dropped inside its column, even
              though a column is exactly where it belongs visually. The room is
              clipped top and bottom whenever `max-height` bites, and a plate
              riding inside it goes down with the ship — straight behind the
              lower third, which is the one place it cannot be read. Its column
              is a fixed share of the width, so `left` reaches the same spot.
            -->
            <div v-for="side in SIDES" :key="`plate-${side}`"
                 class="plate" :class="[`plate--${side}`, {
                     'plate--on': anchor === side,
                     'plate--dim': anchor !== null && anchor !== side,
                 }]"
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
    /* 352 + 724 + 352 by 788 — the three plates at their measured sizes.
       Reserving the box by ratio means the page does not jump when the first
       plate decodes. */
    aspect-ratio: 1428 / 788;
    /* ...but not at the cost of the transport. At full ratio on a laptop the
       stage is ~740px and the play button is below the fold, which on a page
       whose entire purpose is "press play" is the wrong trade. Capped, the set
       loses a little ceiling and a little desk front — closer to how a gallery
       would frame it anyway. */
    max-height: min(68vh, 44rem);
    overflow: hidden;
    background: var(--sfs-overlay, #05070f);
}

/*
  THE WHOLE SET SCALES AS ONE PICTURE.

  The room carries the set's own aspect and the stage clips it, which is
  `object-fit: cover` for a grid — and it is not a nicety. The stage is capped
  at `max-height`, so on most laptops it is shorter than the ratio asks for.
  Let the columns absorb that individually and they absorb it DIFFERENTLY: the
  anchors are `cover` so they crop, the set plates are `fill` so they squash,
  and the desk that runs through all three columns steps by ~20px at both
  seams. One continuous room stops reading as one room.

  Scaled and clipped as a unit, every column loses exactly the same strip of
  ceiling and floor, so the desk line cannot come apart however short the stage
  gets.
*/
.stage__room {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    transform: translateY(-50%);
    aspect-ratio: 1428 / 788;

    display: grid;
    /* The measured plate widths, as ratios. Equal column HEIGHT is then a
       property of the grid — one row — rather than a rule somebody has to
       maintain, and the two side columns are equal because they are literally
       the same plate shape. */
    grid-template-columns: 352fr 724fr 352fr;
    /* Needed even though the room's height is definite: the anchor columns
       hold nothing but absolutely positioned children, so an `auto` row
       measures them at zero and the set column — whose rows are `fr` — then
       has nothing to resolve against. */
    grid-template-rows: minmax(0, 1fr);

    /*
      THE SET DOES NOT MIRROR, EVER.

      These are photographs of one room: آدم is lit from the left and faces
      right, ليلى is lit from the right and faces left, and the desk runs
      continuously through the middle plate. Let the grid follow `dir` and an
      Arabic bulletin swaps the two columns, so both presenters face off the
      edge of the screen and the desk breaks at both joins. A set is not a
      paragraph. The overlays that carry TEXT set their own direction — see the
      `:dir` bindings in the template.
    */
    direction: ltr;
}

.col {
    position: relative;
    min-width: 0;
    overflow: hidden;
}

/*
  Placed by number, not by source order. The two anchor columns come out of one
  `v-for` so their markup is written once, which puts them adjacent in the DOM —
  and the set belongs BETWEEN them. Explicit tracks are safe here precisely
  because the grid is forced `ltr` above: in an `rtl` grid, column 1 is the
  rightmost one and this would silently mirror the room.

  THE ROW HAS TO BE PINNED TOO, and leaving it out does not misplace anything —
  it collapses the anchors to nothing. Source order is male, female, set while
  column order is male, set, female, so by the time the set is placed the
  auto-placement cursor has already passed column 2. Sparse flow never steps
  backwards, so the set is given an IMPLICIT second row; that row then takes the
  height, the explicit `1fr` row is left with 0.015625px, and the two anchor
  columns render as two black rectangles the exact width they should be. The
  stage looks like the images failed to load, and every one of them is present,
  decoded and correct.
*/
.col { grid-row: 1; }

.col--male   { grid-column: 1; }
.col--set    { grid-column: 2; }
.col--female { grid-column: 3; }

/* -- the two anchor columns ------------------------------------------ */
.col__still,
.col__loop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    /* `cover`, never `fill`: the column is within a fraction of a percent of
       the plate's own aspect at the natural stage size, so nothing is cropped
       there — and when `max-height` shortens the stage, losing a strip of
       ceiling is the right answer and stretching a person is not. */
    object-fit: cover;
    display: block;
}

.col__loop {
    opacity: 0;
    /* A shade slower than a cut: the two shots are the same person in the same
       chair, so this is a dissolve between stillness and motion rather than a
       change of camera, and a hard switch reads as a dropped frame. */
    transition: opacity 0.22s ease;
}

.col__loop--on { opacity: 1; }

/*
  The presenter who is not reading is held a touch back — not dimmed to the
  point of looking switched off, just far enough that the eye lands on the one
  who is talking. Both faces stay fully legible, which is the whole point of
  having both on camera.

  Keyed on "is somebody ELSE reading" rather than on "is this one reading",
  because between bulletins nobody is and the difference matters: the second
  spelling darkens BOTH columns whenever there is no reader, so the page opens
  on a studio that looks switched off.
*/
.col--anchor::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    background: rgb(3 6 16 / 0.34);
    transition: opacity 0.28s ease;
}

.col--dim::after { opacity: 1; }

/* -- the set column --------------------------------------------------- */
.col--set {
    display: grid;
    /* The plates' own heights. */
    grid-template-rows: 137fr 268fr 383fr;
}

.set__plate,
.wall__ident {
    width: 100%;
    height: 100%;
    /* `fill` here, and this is the one place it is right: the three plates were
       cut from one photograph and their join lines only stay joined if all
       three are scaled identically. `cover` would centre-crop each one
       independently and the desk would step at both seams as soon as
       `max-height` squeezed the stage. Stretching a photograph of a wall by a
       few percent is invisible; a broken desk is not. */
    object-fit: fill;
    display: block;
}

/* -- the video wall --------------------------------------------------- */
.wall {
    position: relative;
    overflow: hidden;
}

/*
  The lit glass, measured off the plate: the wall runs to both edges of the
  724-wide crop, starts 4px down and ends 15px up from a 268-tall plate.
  Percentages rather than pixels, because the plate renders anywhere from
  ~360px wide on a phone to ~1000px on a bounded 4K shell.
*/
.wall__feed {
    position: absolute;
    top: 1.6%;
    bottom: 5.5%;
    left: 0.8%;
    right: 0.8%;
    overflow: hidden;
}

.wall__wash,
.wall__photo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
}

.wall__wash {
    object-fit: cover;
    /* Scale first: a blur samples outside its own box and would otherwise
       leave a pale halo against the bezel, which reads as a backlight fault. */
    transform: scale(1.18);
    filter: blur(14px) brightness(0.5) saturate(1.3);
}

.wall__scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgb(3 9 22 / 0.34), rgb(3 9 22 / 0.5));
}

.wall__photo {
    /* Whole, never cropped — the requirement, and the reason the wash exists. */
    object-fit: contain;
}

.wall__scan {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.3;
    background: repeating-linear-gradient(
        to bottom, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px);
}

/* A cross-fade, not a cut: both frames are absolutely positioned and so both
   occupy the glass while it runs, which is what stops the ident flashing
   through for a frame between two stories. */
.wall-enter-active, .wall-leave-active { transition: opacity 0.35s ease; }
.wall-enter-from, .wall-leave-to { opacity: 0; }

.wall__strap {
    position: absolute;
    left: 1.6%;
    bottom: 4%;
    display: flex;
    align-items: stretch;
    max-width: 60%;
    border-radius: 0.15em;
    overflow: hidden;
    background: rgb(255 255 255 / 0.94);
}

.wall__strapFlag {
    flex: 0 0 auto;
    width: 0.34rem;
    background: var(--sfs-danger, #d24b5a);
}

.wall__strapText {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0.22em 0.55em;
    font-size: clamp(0.45rem, 0.72vw, 0.66rem);
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: rgb(12 18 34);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* -- stage treatment -------------------------------------------------- */
.stage__vignette,
.stage__sheen {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.stage__vignette {
    background:
        radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(0 0 0 / 0.42) 100%),
        linear-gradient(to bottom, rgb(0 0 0 / 0.28) 0%, transparent 22%,
                        transparent 58%, rgb(0 0 0 / 0.55) 100%);
}

.stage__sheen {
    opacity: 0.5;
    background: repeating-linear-gradient(
        to bottom,
        rgb(255 255 255 / 0.025) 0 1px,
        transparent 1px 3px);
    mix-blend-mode: overlay;
}

/* -- on-air bug ------------------------------------------------------ */
/*
  Back in the corner. The old stage had a monitor in each top corner and the
  bug had to sit centred between them; the wall is in the middle of the set
  now, so the corner is free and the corner is where a bug goes.
*/
.bug {
    position: absolute;
    top: 0;
    inset-inline-start: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    padding: clamp(0.5rem, 1.4vw, 0.9rem);
    max-width: 60%;
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

/* -- name plates ------------------------------------------------------ */
/*
  Centred on their own column — 12.33% and 87.67% are the midpoints of the two
  352/1428 side tracks, so a plate sits under its presenter without being a
  child of the column. Centring is also the one placement that needs no thought
  about direction: the columns do not mirror but the text inside them does.

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
    backdrop-filter: blur(8px);
    max-width: 22%;
    text-align: center;
    transition: opacity 0.28s ease, border-color 0.28s ease, background 0.28s ease;
}

/* The midpoint of each side track: 352/2 / 1428 and 1 - that. */
.plate--male   { left: 12.33%; }
.plate--female { left: 87.67%; }

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
  200px of stage height it parked across a presenter's chin. There are two
  plates now, in columns a third the width, so it is worse rather than better.

  The names stay — a broadcast always has room for a name plate. The voice goes
  to the chip row under the transport, where it has a whole line to itself. It
  is a diagnostic, not a caption.
*/
@media (max-width: 900px) {
    .plate__voice { display: none; }

    .plate {
        bottom: clamp(2.2rem, 6vw, 3.4rem);
        padding: 0.18rem 0.4rem;
    }
}

@media (max-width: 760px) {
    .third { padding-block: 0.45rem; }
    .third__text { -webkit-line-clamp: 2; line-clamp: 2; }
    .wall__strap { display: none; }
}

@media (max-width: 560px) {
    /* Under a phone's width the plates are wider than the columns holding
       them, so they overlap the set and each other. The presenters are on
       camera, which is the thing that matters; who is speaking is carried by
       the moving mouth and by the chip row below. */
    .plate { display: none; }

    .bug { max-width: 100%; }
}

/* Shorter than it is narrow — a landscape phone, where the stage is a
   letterbox and every overlay competes for the same few pixels. */
@media (max-height: 460px) and (orientation: landscape) {
    .plate { display: none; }
}

@media (prefers-reduced-motion: reduce) {
    /* The stills carry the whole design on their own — this is exactly the
       case the layered still was built for. */
    .col__loop { display: none; }
    .bug__live--on .bug__dot { animation: none; }
    .wall-enter-active, .wall-leave-active { transition: none; }
}
</style>
