<!--
  The ambient background behind every page.

  ==========================================================================
  WHAT THIS REPLACED, AND WHY IT HAD TO GO
  ==========================================================================
  This used to be a three.js scene: a WebGL context, a 4-arm log-spiral galaxy
  of up to 9,000 shader-drawn particles, a 3,000-star field, eight textured
  planet meshes with a canvas texture each, two lights, fog, and a
  requestAnimationFrame loop running on EVERY route for as long as the tab was
  open. Switching galaxy tore the whole scene down and rebuilt it.

  It was reported, correctly, as "the site is slow". Three separate costs:

   1. **A permanent WebGL context and render loop.** ~12,000 particles, two
      shader programs and a 60 fps loop — on the login page, on a text-only
      lesson page, on a form. The Courses page then opens a SECOND context for
      the <Planet> cards, and browsers cap live contexts at around sixteen.
   2. **It made every glass card expensive.** This is the non-obvious one and
      it is the reason this file is now static by default. `backdrop-filter`
      has to snapshot and blur whatever is behind the element, and a browser
      can cache that snapshot only while the backdrop does not change. With an
      animated background NOTHING is cacheable, so all ~20 blurred cards on a
      dashboard re-blurred a large region 60 times a second. Most of the blur
      cost was being paid for by the background's motion, not by the cards.
   3. **Memory.** Per-particle position/colour/size buffers plus nine canvas
      textures, held for the lifetime of the tab, on a phone.

  ==========================================================================
  WHAT IT IS NOW
  ==========================================================================
  CSS gradients. There is no <script> block at all: no WebGL, no canvas, no
  rAF, no resize listener, no IntersectionObserver, no teardown, and nothing
  that can leak. The paint is layered gradients plus one tiled lattice, all of
  which the compositor rasterises once and then leaves alone.

  It reads as a STUDY SPACE rather than as outer space, which is the brief: a
  soft overhead light, two low auroras, a grounded floor, and a faint
  graph-paper lattice that fades out before it reaches the content. Paper and
  a desk lamp, not a nebula.

  THE TEN GALAXIES STILL WORK, and switching is now instant and free. Every
  colour here is a `var(--sfs-…)` read live off <html>, so `applyTheme()`
  changing one custom property repaints this one element — where the old
  version had to dispose a WebGL context and rebuild ~12,000 floats. That is
  also why there is no `watch(themeId)` any more.

  ==========================================================================
  MOTION IS OPT-IN, AND THE GATE IS DELIBERATE
  ==========================================================================
  A slow drift is applied only when all three of these hold:

    * `prefers-reduced-motion: no-preference` — the usual courtesy;
    * `pointer: fine`   — a mouse, so not a phone, not a tablet, not a TV
                          remote. Those are the weakest GPUs, they are the
                          devices the slowness was reported on, and a
                          96-second drift is the least noticeable thing on a
                          six-inch screen;
    * `min-width: 1024px` — the same reasoning by area.

  Exactly ONE element ever animates, so at most one extra composited layer
  exists, and it animates `transform` only, so no frame does any painting. The
  lattice deliberately does NOT drift: a second moving layer would double both
  the layer memory and the backdrop-filter invalidation above, for an effect
  nobody would notice behind a card.

  Every keyframe track ends where it began. Under `prefers-reduced-motion`,
  `responsive.css` forces `animation-duration: 0.01ms`, which lands an element
  on its LAST keyframe immediately — so a track ending somewhere else would
  park the aurora off-position for exactly the people who cannot see it move.
-->
<template>
  <div class="sfs-bg" aria-hidden="true">
    <!-- The room: an overhead light and a grounded floor. -->
    <div class="sfs-bg__room"></div>

    <!-- Graph paper. Static, masked so it never reaches the reading area. -->
    <div class="sfs-bg__paper"></div>

    <!-- The only thing that ever moves. One layer, transform only. -->
    <div class="sfs-bg__aurora"></div>

    <!-- Painted last, so it sits on top and keeps the corners quiet. -->
    <div class="sfs-bg__vignette"></div>
  </div>
</template>

<style scoped>
/* --------------------------------------------------------------------------
   The shell
   --------------------------------------------------------------------------
   `contain: strict` promises the browser that nothing in here can affect
   layout or paint outside it, so a repaint of the page never reaches the
   background and vice versa.

   No `will-change` here. Promoting the shell would promote a full-viewport
   layer on every device including a 4K television, for an element that never
   moves. Only the one animated child asks for it, and only inside the media
   query that animates it.
   -------------------------------------------------------------------------- */
.sfs-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  contain: strict;
  background-color: var(--sfs-space, #03030f);

  /* The four knobs. Re-set wholesale for the three light galaxies below —
     alphas that read as a soft glow over a dark page read as grey smears over
     a pale one. */
  --bg-light: 0.1;
  --bg-aurora: 0.14;
  --bg-lattice: 0.05;
  --bg-floor: 0.5;
}

.sfs-bg > * {
  position: absolute;
  inset: 0;
}

/* --------------------------------------------------------------------------
   1. The room — an overhead light and a floor
   --------------------------------------------------------------------------
   Three radial gradients and one linear, all with wide soft stops, which is
   why there is no `filter: blur()` anywhere in this file. A blur filter over a
   full viewport is one of the most expensive things CSS can be asked for; a
   gradient with a wide stop range costs nothing and looks the same.
   -------------------------------------------------------------------------- */
.sfs-bg__room {
  background-image:
    /* the desk lamp, above and slightly behind the reader */
    radial-gradient(
      120% 70% at 50% -12%,
      rgb(var(--sfs-accent-rgb, 102 126 234) / var(--bg-light)) 0%,
      transparent 62%
    ),
    /* a second, cooler source off to one side, so the light is not symmetrical */
    radial-gradient(
      80% 55% at 88% 8%,
      rgb(var(--sfs-accent-3-rgb, 56 189 248) / calc(var(--bg-light) * 0.62)) 0%,
      transparent 58%
    ),
    /* the floor: grounds the page so the content does not float in a void */
    linear-gradient(
      to bottom,
      transparent 45%,
      rgb(var(--sfs-space-rgb, 3 3 15) / var(--bg-floor)) 100%
    );
}

/* --------------------------------------------------------------------------
   2. Graph paper
   --------------------------------------------------------------------------
   Two 1px lines tiled at 64px. This is the one detail that makes the
   background read as educational rather than merely decorative, and the round
   64px is not arbitrary: a lattice on a fractional grid shimmers under
   non-integer device pixel ratios.

   `mask-image` fades it out well before the middle of the screen, which is
   where the text is. An unmasked lattice behind body copy is a legibility
   problem dressed up as a style.
   -------------------------------------------------------------------------- */
.sfs-bg__paper {
  background-image:
    linear-gradient(
      to right,
      rgb(var(--sfs-line-rgb, 255 255 255) / var(--bg-lattice)) 0 1px,
      transparent 1px 100%
    ),
    linear-gradient(
      to bottom,
      rgb(var(--sfs-line-rgb, 255 255 255) / var(--bg-lattice)) 0 1px,
      transparent 1px 100%
    );
  background-size: 64px 64px;
  /* Strongest at the top edge, gone by the time it reaches the content. */
  -webkit-mask-image: radial-gradient(120% 90% at 50% 0%, #000 0%, transparent 70%);
  mask-image: radial-gradient(120% 90% at 50% 0%, #000 0%, transparent 70%);
}

/* --------------------------------------------------------------------------
   3. The aurora — the only moving thing
   --------------------------------------------------------------------------
   Oversized on purpose: 130% of the viewport and offset, so a drift of a few
   per cent can never bring an edge into view. An edge appearing is what makes
   a cheap gradient look cheap.
   -------------------------------------------------------------------------- */
.sfs-bg__aurora {
  inset: -15%;
  background-image:
    radial-gradient(
      46% 38% at 18% 82%,
      rgb(var(--sfs-accent-2-rgb, 118 75 162) / var(--bg-aurora)) 0%,
      transparent 68%
    ),
    radial-gradient(
      40% 34% at 86% 72%,
      rgb(var(--sfs-accent-rgb, 102 126 234) / calc(var(--bg-aurora) * 0.85)) 0%,
      transparent 66%
    ),
    radial-gradient(
      52% 30% at 50% 106%,
      rgb(var(--sfs-accent-3-rgb, 56 189 248) / calc(var(--bg-aurora) * 0.55)) 0%,
      transparent 70%
    );
}

/* --------------------------------------------------------------------------
   4. Vignette
   --------------------------------------------------------------------------
   Painted last and therefore on top: it pulls the four corners back down so a
   glass card near an edge has something quiet behind it. Without it the
   aurora competes with the card borders.
   -------------------------------------------------------------------------- */
.sfs-bg__vignette {
  background-image: radial-gradient(
    130% 120% at 50% 42%,
    transparent 0%,
    transparent 52%,
    rgb(var(--sfs-space-rgb, 3 3 15) / 0.55) 100%
  );
}

/* --------------------------------------------------------------------------
   5. The light galaxies
   --------------------------------------------------------------------------
   Three of the ten are light, and the floor and the vignette invert in
   MEANING there, not just in value: over a pale page, "grounding" is a touch
   more colour at the bottom rather than more of the page colour. So the four
   knobs are re-set and the vignette switches from the page colour to a wash
   of the accent, rather than any rule being rewritten.
   -------------------------------------------------------------------------- */
:root[data-mode='light'] .sfs-bg {
  --bg-light: 0.16;
  --bg-aurora: 0.13;
  --bg-lattice: 0.14;
  --bg-floor: 0.16;
}

:root[data-mode='light'] .sfs-bg__vignette {
  background-image: radial-gradient(
    130% 120% at 50% 42%,
    transparent 0%,
    transparent 58%,
    rgb(var(--sfs-accent-rgb, 102 126 234) / 0.07) 100%
  );
}

/* --------------------------------------------------------------------------
   6. Motion
   --------------------------------------------------------------------------
   See the header for why the gate is this narrow. 96 seconds is not a style
   choice either: below about a minute the drift becomes something the eye
   tracks, and a background that pulls the eye off the text is worse than a
   still one.
   -------------------------------------------------------------------------- */
@media (prefers-reduced-motion: no-preference) and (pointer: fine) and (min-width: 1024px) {
  .sfs-bg__aurora {
    will-change: transform;
    animation: sfs-bg-drift 96s ease-in-out infinite;
  }
}

@keyframes sfs-bg-drift {
  /* Ends where it starts, so the reduced-motion snap lands on the design. */
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  33% {
    transform: translate3d(1.6%, -1.2%, 0) scale(1.05);
  }
  66% {
    transform: translate3d(-1.4%, 1%, 0) scale(1.03);
  }
}

/* --------------------------------------------------------------------------
   7. Forced colours
   --------------------------------------------------------------------------
   Windows High Contrast replaces the palette wholesale; an ambient wash there
   is noise over a palette the user chose deliberately. theme.css hides this
   element for print.
   -------------------------------------------------------------------------- */
@media (forced-colors: active) {
  .sfs-bg {
    display: none;
  }
}
</style>
