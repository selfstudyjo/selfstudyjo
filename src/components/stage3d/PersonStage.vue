<!--
  A grid of people, rendered.

  Used by the Toastmasters meeting (six seats) and the Job Interview (one
  interviewer). It replaces `SpeakerMedia.vue`, which layered a looping MP4 over
  a WebP still — see `stage3d/figures.ts` for why filmed loops had to go.

  ============================================================
  WHY THIS COMPONENT OWNS THE GRID
  ============================================================

  Because the renderer needs to know where the tiles ARE. There is one WebGL
  canvas for the whole grid — six contexts would be near the browser's cap, and
  a browser at its cap silently kills the oldest rather than refusing the newest
  — so each person is a camera with a `viewport` set to their tile's rectangle.
  Something has to measure those rectangles, and it cannot be the parent view
  without that view growing a `ResizeObserver` and a ref-collection for tiles it
  does not otherwise care about.

  So the grid lives here and the CALLER supplies the class names for it. That is
  the important half: `toastmasters.css` already lays out `.tm-bots-grid`,
  already reflows it from six columns to two on a phone, and already restyles
  `.tm-video-tile` when somebody is speaking. None of that moved. The component
  measures whatever the stylesheet decided, so a change to the breakpoints needs
  no change here at all.

  ============================================================
  THE CANVAS IS UNDERNEATH, NOT INSIDE
  ============================================================

  One canvas spans the whole host and the tiles sit on top of it as ordinary
  DOM. So the name tag, the speaking dot and the tile's border and glow are
  still CSS — they are text and they belong in the document, where they can be
  translated, read by a screen reader and styled by the theme. Only the person
  is drawn.

  The tiles are `pointer-events: none` over the canvas region but their own
  contents are not, so nothing about focus or hit-testing changes.
-->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import { figureById } from '@/stage3d/figures';
import { hasWebGL } from '@/stage3d/loader';
import type { PortraitStage } from '@/stage3d/portraitStage';

export interface StageSeat {
    /** The caller's own identifier for this tile — a seat key, or `interviewer`. */
    key: string;
    /** A figure id from `stage3d/figures.ts`. */
    figure: string;
    /** Caption, used for the accessible name and the no-WebGL fallback. */
    label?: string;
}

const props = withDefaults(defineProps<{
    seats: StageSeat[];
    /** Whose turn it is, by seat KEY, or null when nobody is talking. */
    speaking?: string | null;
    /** 0…1. A live reading off the audio where there is one. Drives the mouth. */
    energy?: number;
    /** Class for the grid element — the caller's existing layout. */
    gridClass?: string;
    /** Class for each tile — the caller's existing tile styling. */
    tileClass?: string;
}>(), { speaking: null, energy: 0.7, gridClass: '', tileClass: '' });

const hostEl = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const tiles = new Map<string, HTMLElement>();
/**
 * `shallowRef`, not `ref`.
 *
 * The stage owns a Babylon scene with tens of thousands of objects in it, and a
 * deep reactive proxy over that is not slow, it is fatal — Vue would walk the
 * whole graph on creation and then intercept every property access the render
 * loop makes, sixty times a second.
 */
const stage = shallowRef<PortraitStage | null>(null);
const ready = ref(false);
const supported = ref(true);

/** The figures that could be resolved. A typo is a blank tile, not a crash. */
const resolved = computed(() => props.seats.map(seat => {
    try {
        const figure = figureById(seat.figure);
        return { ...seat, name: figure.name, accent: figure.outfit.accent, ok: true };
    } catch {
        return { ...seat, name: seat.label || seat.key, accent: '#4a5570', ok: false };
    }
}));

function setTile(key: string, el: unknown) {
    const element = el as HTMLElement | null;
    if (element) tiles.set(key, element);
    else tiles.delete(key);
}

function applyLayout() {
    const active = stage.value;
    if (!active) return;
    active.layout(props.seats
        .map(seat => ({ id: seat.figure, el: tiles.get(seat.key)! }))
        .filter(t => t.el));
}

let observer: ResizeObserver | null = null;

onMounted(async () => {
    supported.value = hasWebGL();
    if (!supported.value || !canvasEl.value || !hostEl.value) return;

    // Imported here rather than at the top of the module: this is what keeps
    // Babylon out of every other route's bundle. `hasWebGL()` above is
    // deliberately synchronous and dependency-free so the fallback can be
    // decided without downloading anything.
    const { createPortraitStage } = await import('@/stage3d/portraitStage');
    if (!canvasEl.value || !hostEl.value) return;      // unmounted mid-download

    stage.value = await createPortraitStage(
        canvasEl.value,
        resolved.value.filter(s => s.ok).map(s => s.figure),
        { hostEl: hostEl.value },
    );
    ready.value = true;
    /*
      PUSH THE CURRENT STATE, because the watch below has already missed it.

      Building this stage means downloading ~700 kB of Babylon and compiling a
      dozen PBR shaders, which is seconds. The `immediate: true` watch fires long
      before that finishes, against a `stage` that is still null — so if the room
      started speaking during the download, nobody ever told the renderer.

      It recovers on the next energy tick in practice, because the energy is
      polled every 40 ms while a line is playing. That is luck rather than
      design, and it is exactly the kind of luck that runs out for whichever
      prop happens not to be changing. `NewsStudio.vue` pushes here for the same
      reason.
    */
    const seat = props.seats.find(s => s.key === props.speaking);
    stage.value.setSpeaking(seat ? seat.figure : null, props.energy ?? 0);
    await nextTick();
    applyLayout();

    /*
      Both the canvas AND the tiles can move without the window resizing: the
      meeting grid reflows when the transcript below it grows, and the sidebar
      drawer shifts the whole page. A window `resize` listener would miss every
      one of those, which is how a viewport ends up showing the neighbouring
      seat's shoulder.
    */
    observer = new ResizeObserver(() => {
        stage.value?.resize();
        applyLayout();
    });
    observer.observe(hostEl.value);
    for (const el of tiles.values()) observer.observe(el);
});

watch(() => [props.speaking, props.energy] as const, ([who, level]) => {
    const seat = props.seats.find(s => s.key === who);
    stage.value?.setSpeaking(seat ? seat.figure : null, level ?? 0);
}, { immediate: true });

watch(() => props.seats.map(s => s.key).join('|'), async () => {
    await nextTick();
    applyLayout();
});

onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
    // Disposing releases the WebGL context immediately. Left to the collector,
    // a reader who opens three interviews in a session is three contexts closer
    // to the browser killing somebody else's canvas.
    stage.value?.dispose();
    stage.value = null;
});
</script>

<template>
    <div class="s3d" ref="hostEl">
        <canvas
            v-if="supported" ref="canvasEl" class="s3d__canvas"
            aria-hidden="true"
        ></canvas>

        <div class="s3d__grid" :class="gridClass">
            <div
                v-for="seat in resolved" :key="seat.key"
                :ref="(el) => setTile(seat.key, el)"
                class="s3d__tile"
                :class="[tileClass, { speaking: speaking === seat.key }]"
                :aria-label="seat.label || seat.name"
            >
                <!--
                  No WebGL, or the renderer has not arrived yet. An initial on a
                  disc in the person's own accent colour: it is what the rest of
                  the platform already draws for somebody with no photograph, so
                  a reader on a machine that cannot render sees a familiar
                  avatar rather than an empty box.
                -->
                <div
                    v-if="!supported || !ready" class="s3d__fallback"
                    :style="{ '--s3d-accent': seat.accent }"
                >
                    <span class="s3d__initial">{{ (seat.name || '?').slice(0, 1) }}</span>
                </div>
                <slot name="tile" :seat="seat"></slot>
            </div>
        </div>
    </div>
</template>

<style scoped>
.s3d {
    position: relative;
    /* The canvas is measured against this box, so it must not be the one thing
       in the layout that has no size of its own. */
    display: block;
    width: 100%;
}

.s3d__canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    /* Under the tiles, and never in the way of a click. Every interactive thing
       on this page is DOM on top. */
    pointer-events: none;
    z-index: 0;
}

.s3d__grid {
    position: relative;
    z-index: 1;
}

.s3d__tile {
    position: relative;
    /* The person is painted by the canvas underneath, so a tile background
       would hide them. The caller's tile class supplies the border, the radius
       and the speaking glow; only the fill is overridden, and it is overridden
       here rather than in the page stylesheet so a page that still wants an
       opaque tile can have one. */
    background: transparent !important;
}

.s3d__fallback {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
        radial-gradient(circle at 50% 38%,
            rgb(var(--sfs-tint-rgb, 255 255 255) / 0.10), transparent 62%),
        var(--sfs-surface, #0f1128);
}

.s3d__initial {
    width: clamp(38px, 34%, 72px);
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: clamp(1rem, 3.4vw, 1.9rem);
    font-weight: 800;
    color: var(--sfs-on-accent, #fff);
    background: var(--s3d-accent, var(--sfs-accent, #667eea));
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.25);
}
</style>
