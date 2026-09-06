<template>
  <!--
    Teleported to <body>, and that is not a nicety.

    The tour is drawn over whatever page is open, and half of them wrap their
    content in a positioned box with a z-index - which makes a stacking context,
    and a descendant cannot escape its ancestor's. Left in place the overlay
    would paint UNDER the sidebar on exactly the nine screens CLAUDE.md already
    records for the admin console's modals. At <body> there is no ancestor to
    be trapped by.
  -->
  <Teleport to="body">
    <div
      v-if="running"
      class="sfs-tour"
      :class="`is-${placed.placement}`"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('Guided tour')"
      dir="ltr"
    >
      <!--
        The scrim, in FOUR pieces rather than one with a hole.

        A single box with a `clip-path` cut-out is the obvious version and it
        cannot be done accessibly: the cut-out has to be re-cut on every scroll
        and resize, and a browser that does not support the path renders a
        solid sheet over the whole page with no way to tell. Four rectangles
        around the target are plain boxes that degrade to nothing.

        With no target the four collapse to zero and the page is simply dimmed,
        which is right for a step about the page as a whole.
      -->
      <div class="sfs-tour__scrim" :style="scrim.top"></div>
      <div class="sfs-tour__scrim" :style="scrim.bottom"></div>
      <div class="sfs-tour__scrim" :style="scrim.left"></div>
      <div class="sfs-tour__scrim" :style="scrim.right"></div>

      <!-- THE SQUARE. A box round the thing being described. -->
      <div v-if="box" class="sfs-tour__box" :style="boxStyle"></div>

      <!-- THE LINE AND THE ARROW, from the caption to the box. -->
      <div v-if="line" class="sfs-tour__line" :style="lineStyle">
        <span class="sfs-tour__arrow"></span>
      </div>

      <!-- THE CAPTION. -->
      <section class="sfs-tour__card" :style="cardStyle" :dir="pageDir">
        <header class="sfs-tour__head">
          <span class="sfs-tour__chapter">{{ $t(chapterTitle) }}</span>
          <span class="sfs-tour__count">{{ index + 1 }} / {{ steps.length }}</span>
        </header>

        <h2 class="sfs-tour__title">{{ $t(step.title) }}</h2>
        <p class="sfs-tour__body">{{ $t(step.body) }}</p>

        <div class="sfs-tour__pips" aria-hidden="true">
          <span
            v-for="(row, n) in steps"
            :key="row.id"
            class="sfs-tour__pip"
            :class="{ 'is-done': n < index, 'is-here': n === index }"
          ></span>
        </div>

        <footer class="sfs-tour__foot">
          <button type="button" class="sfs-tour__stop" @click="stop">
            {{ $t('Stop the tour') }}
          </button>
          <span class="sfs-tour__grow"></span>
          <button
            type="button"
            class="sfs-tour__btn2"
            :disabled="index === 0"
            @click="back"
          >{{ $t('Back') }}</button>
          <button ref="nextEl" type="button" class="sfs-tour__btn1" @click="next">
            {{ index + 1 >= steps.length ? $t('Done') : $t('Next') }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * The guided tour, drawn.
 *
 * Every JUDGEMENT is `tourSteps.ts`'s - which steps a path has, which of them
 * have something to point at, where the caption goes and where the line runs.
 * This file measures the DOM, scrolls, listens and paints, which is the half a
 * check cannot see anyway. Same split as `practiceMonitor.ts` against
 * `practiceIntegrity.ts`.
 *
 * FOUR THINGS THAT ARE NOT OBVIOUS
 *
 * **A step whose target is not on this page is dropped before the tour
 * starts.** Half these screens render conditionally, so the list is resolved
 * against the live DOM at the moment the reader presses Tour rather than
 * declared as true of the route. `visibleSteps` is that filter, and the tour
 * can never be empty because the platform tail's first step needs no target.
 *
 * **The target is scrolled into view and then MEASURED AGAIN.** Scrolling is
 * asynchronous and smooth, so a rect read before it settles points at where the
 * element used to be - which is the single most likely way a tour ends up
 * drawing a box around blank page.
 *
 * **Nothing behind the scrim can be clicked**, deliberately. A tour is a
 * sequence and a stray click that navigated away would leave the overlay
 * describing a page that is no longer there. Escape stops it, the Stop button
 * stops it, and both are always on screen.
 *
 * **The card is pinned `dir` to the page and the overlay to `ltr`.** The
 * geometry is measured in viewport coordinates, which do not mirror; the TEXT
 * inside the card is the reader's language and must. Getting that backwards
 * puts an Arabic caption's punctuation in the wrong place or the whole overlay
 * on the wrong side of the screen.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useTour } from '@/composables/useTour';

import {
    chapterFor,
    connector,
    isPointable,
    placeCard,
    stepsFor,
    visibleSteps,
    targetFor,
    type Placed,
    type Rect,
    type TourStep,
} from '@/utils/tourSteps';

/*
  NO PROPS. The state is a shared ref (`useTour`), because the one page that
  needs a tour most - the lab workspace - deliberately hides the top bar, so the
  button and the overlay cannot be in the same component. See `useTour.ts`.
*/
const { open, stop } = useTour();

const route = useRoute();

const steps = ref<TourStep[]>([]);
const index = ref(0);
const box = ref<Rect | null>(null);
const card = ref<Rect>({ x: 0, y: 0, width: 340, height: 240 });
const placed = ref<Placed>({ x: 0, y: 0, placement: 'center' });
const view = ref({ width: 1024, height: 768 });
const nextEl = ref<HTMLElement | null>(null);

const running = computed(() => open.value && steps.value.length > 0);
const step = computed<TourStep>(() =>
    steps.value[index.value] ?? { id: 'x', title: '', body: '' });
const chapterTitle = computed(() => chapterFor(route.path).title);
const pageDir = computed(() =>
    (typeof document !== 'undefined' && document.documentElement.dir) || 'ltr');

/* ------------------------------------------------------------------ *
 * Measuring
 * ------------------------------------------------------------------ */

/**
 * The target's rectangle, or null.
 *
 * A zero-sized element counts as ABSENT. `display: none` measures 0x0 and so
 * does an element inside a collapsed panel, and a box drawn round nothing at
 * the top-left corner of the page is the failure this whole module is trying
 * not to have.
 */
function rectOf(selector: string): Rect | null {
    if (!selector || typeof document === 'undefined') return null;
    const node = document.querySelector(selector);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return { x: r.left, y: r.top, width: r.width, height: r.height };
}

const present = (selector: string) => rectOf(selector) !== null;

/** Re-read everything: the viewport, the target and where the caption goes. */
function measure() {
    if (typeof window === 'undefined') return;
    view.value = { width: window.innerWidth, height: window.innerHeight };
    const selector = targetFor(step.value, present);
    const found = selector ? rectOf(selector) : null;
    /*
      A TARGET THAT IS MOST OF THE SCREEN IS NOT DRAWN AS ONE.

      A box round a 1,300 x 1,900 grid highlights nothing and leaves the caption
      nowhere to sit that is not on top of it - which the shot harness reported
      on five steps before the selectors were narrowed. `isPointable` is the
      backstop for the ones that are legitimately that big: the step still runs
      and reads as a statement about the page, which is what it was.
    */
    box.value = isPointable(found, view.value) ? found : null;
    const size = { width: card.value.width, height: card.value.height };
    placed.value = placeCard(box.value, size, view.value, step.value.prefer);
    card.value = { ...size, x: placed.value.x, y: placed.value.y };
}

/**
 * Bring the target into view, then measure once it has stopped moving.
 *
 * `scrollIntoView` is asynchronous and, with smooth behaviour, takes several
 * hundred milliseconds - so a rect read on the next tick is where the element
 * WAS. Two measurements: one straight away so nothing flickers at the old
 * position, and one after the scroll has settled, which is the one that is
 * right.
 */
async function focusStep() {
    await nextTick();
    const selector = targetFor(step.value, present);
    if (selector && typeof document !== 'undefined') {
        const node = document.querySelector(selector);
        /*
          SMOOTH ONLY WHERE MOTION IS WANTED, and instant otherwise.

          Two reasons and the second is the one that caught this. A page that
          slides under somebody who asked for reduced motion is the thing the
          query exists to stop. And a smooth scroll is ASYNCHRONOUS for as long
          as it takes: the box is placed from a rect read afterwards, so under
          an instant scroll the measurement is right on the next frame, where
          under a smooth one it is right whenever the browser decides it has
          arrived. The shot harness emulates reduced motion and caught a box
          drawn 900px below a 860px viewport for exactly that reason.
        */
        const still = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        node?.scrollIntoView({ block: 'center', inline: 'nearest',
                               behavior: still ? 'auto' : 'smooth' });
    }
    measure();
    // Once on the next frame, for the instant scroll, and once after the
    // smooth one has had time to land. Both are cheap and neither is enough
    // on its own.
    window.requestAnimationFrame(measure);
    window.setTimeout(measure, 420);
    // The caption's own height depends on how long the sentence is, and in
    // Arabic and Chinese that is a different number - so it is read back off
    // the DOM rather than assumed, and the placement redone with the truth.
    await nextTick();
    const node = document.querySelector('.sfs-tour__card') as HTMLElement | null;
    if (node) {
        card.value = { ...card.value, width: node.offsetWidth, height: node.offsetHeight };
        measure();
    }
    nextEl.value?.focus();
}

/* ------------------------------------------------------------------ *
 * Running
 * ------------------------------------------------------------------ */

function start() {
    steps.value = visibleSteps(stepsFor(route.path), present);
    index.value = 0;
    void focusStep();
}

function next() {
    if (index.value + 1 >= steps.value.length) { stop(); return; }
    index.value += 1;
    void focusStep();
}

function back() {
    if (index.value === 0) return;
    index.value -= 1;
    void focusStep();
}

function onKey(event: KeyboardEvent) {
    if (!running.value) return;
    if (event.key === 'Escape') { event.preventDefault(); stop(); return; }
    if (event.key === 'ArrowRight' || event.key === 'Enter') { event.preventDefault(); next(); return; }
    if (event.key === 'ArrowLeft') { event.preventDefault(); back(); }
}

watch(open, isOpen => {
    if (isOpen) start();
    else steps.value = [];
});

/*
  A ROUTE CHANGE STOPS THE TOUR.

  The steps were resolved against the page that was on screen; carried across a
  navigation they describe elements that are gone, and `visibleSteps` cannot
  help because it already ran. Restarting silently would be worse - the reader
  pressed a link, not Tour.
*/
watch(() => route.path, () => { if (open.value) stop(); });

if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', measure);
    // Passive and on the capture phase, so a page that scrolls its own
    // container still moves the box with it.
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    onBeforeUnmount(() => {
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('resize', measure);
        window.removeEventListener('scroll', measure, { capture: true } as any);
    });
}

/* ------------------------------------------------------------------ *
 * Painting
 * ------------------------------------------------------------------ */

const PAD = 6;

const boxStyle = computed(() => {
    const r = box.value;
    if (!r) return {};
    return {
        left: `${r.x - PAD}px`,
        top: `${r.y - PAD}px`,
        width: `${r.width + PAD * 2}px`,
        height: `${r.height + PAD * 2}px`,
    };
});

const cardStyle = computed(() => ({
    left: `${placed.value.x}px`,
    top: `${placed.value.y}px`,
}));

const line = computed(() => {
    const r = box.value;
    if (!r) return null;
    const cardRect: Rect = {
        x: placed.value.x, y: placed.value.y,
        width: card.value.width, height: card.value.height,
    };
    const padded: Rect = {
        x: r.x - PAD, y: r.y - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2,
    };
    const joined = connector(cardRect, padded);
    // Below the arrowhead's own length the line reads as a smudge between two
    // edges that are already touching. `GAP` is set well clear of this, so the
    // ordinary case always draws one; what this excludes is the clamped
    // placement on a phone, where the caption can end up against its target.
    return joined.length > 14 ? joined : null;
});

const lineStyle = computed(() => {
    const l = line.value;
    if (!l) return {};
    return {
        left: `${l.from.x}px`,
        top: `${l.from.y}px`,
        width: `${l.length}px`,
        transform: `rotate(${l.angle}deg)`,
    };
});

/**
 * The scrim, as four rectangles around the target.
 *
 * Sized in viewport units so nothing has to be recomputed on a page that is
 * taller than the window, and collapsed to zero when there is no target - a
 * step about the page as a whole dims the whole page.
 */
const scrim = computed(() => {
    const r = box.value;
    const w = view.value.width;
    const h = view.value.height;
    if (!r) {
        return {
            top: { left: '0px', top: '0px', width: `${w}px`, height: `${h}px` },
            bottom: { display: 'none' }, left: { display: 'none' },
            right: { display: 'none' },
        };
    }
    const x = Math.max(0, r.x - PAD);
    const y = Math.max(0, r.y - PAD);
    const right = Math.min(w, r.x + r.width + PAD);
    const bottom = Math.min(h, r.y + r.height + PAD);
    return {
        top: { left: '0px', top: '0px', width: `${w}px`, height: `${y}px` },
        bottom: { left: '0px', top: `${bottom}px`, width: `${w}px`,
                  height: `${Math.max(0, h - bottom)}px` },
        left: { left: '0px', top: `${y}px`, width: `${x}px`,
                height: `${Math.max(0, bottom - y)}px` },
        right: { left: `${right}px`, top: `${y}px`,
                 width: `${Math.max(0, w - right)}px`,
                 height: `${Math.max(0, bottom - y)}px` },
    };
});
</script>
