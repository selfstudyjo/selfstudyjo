<template>
  <div class="uc-layout" :class="{ 'thread-open': threadOpen, 'aside-open': asideOpen }">
    <div class="uc-shell">
      <aside class="pane pane-sidebar">
        <slot name="sidebar" />
      </aside>

      <section class="pane pane-main">
        <slot name="main" />
      </section>

      <aside v-if="asideOpen" class="pane pane-aside">
        <slot name="aside" />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The responsive shell for the Messages page: room list · conversation ·
 * details, and the five viewport targets those three have to survive.
 *
 * It owns geometry and nothing else — no data, no state beyond the two booleans
 * below — so the breakpoints live in one file rather than being re-derived in
 * each pane. Every child fills the box it is given and scrolls its own body.
 */
withDefaults(defineProps<{
  /** Mobile is a single pane. This says which one: the conversation when a room
   *  is open, the list when it is not. Above 768px it means nothing. */
  threadOpen?: boolean;
  /** Whether the details panel is showing. Docked as a third column from
   *  1440px; an overlay below that, because three columns in 1100px leaves a
   *  conversation about 400px wide, which is where bubbles start wrapping every
   *  few words. */
  asideOpen?: boolean;
}>(), { threadOpen: false, asideOpen: false });
</script>

<style scoped>
/*
  Full height, and getting this right is what fixes the layout rather than any
  amount of tuning further down. Two traps, both producing the same symptom — a
  page taller than the screen, the input below the fold, rows squeezed until
  their contents overlap:

  1. `100vh` on a phone is the viewport *with the browser chrome hidden*, which
     is taller than what you can see. `100dvh` is the visible height and tracks
     the URL bar sliding away. The `100vh` line before it is the fallback.
  2. `.main-content` in side-nav.css adds `padding-top: 4.5rem` at ≤768px to
     clear the floating menu button. A child asking for the full viewport height
     inside that padding overflows by exactly 4.5rem — subtracted in the mobile
     block at the bottom of this file.
*/
.uc-layout {
  height: 100vh;
  height: 100dvh;
  display: flex;
  justify-content: center;
  overflow: hidden;
  /* The panes own their scrolling; nothing here should ever scroll the page. */
  overscroll-behavior: contain;
}

.uc-shell {
  position: relative;           /* the anchor for the overlaid details panel */
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  grid-template-columns: var(--uc-sidebar-w) minmax(0, 1fr);
  overflow: hidden;
}

.pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.pane-sidebar {
  background: var(--uc-panel);
  backdrop-filter: var(--uc-blur);
  -webkit-backdrop-filter: var(--uc-blur);
  border-right: 1px solid var(--uc-border);
}

/*
  The conversation pane gets two soft brand glows baked into its background
  rather than a flat wash. They are `background-image` layers, not a pseudo
  element, on purpose: slot content carries the *parent's* scope id, so a
  `.pane-main > *` rule from this file would never match the header, list and
  input, and the pseudo would have to be lifted over them with z-index games.
  Two gradients cost nothing and cannot be painted over anything.
*/
.pane-main {
  background-color: var(--uc-panel-2);
  background-image:
    radial-gradient(1200px 460px at 82% -14%, rgba(118, 75, 162, 0.20), transparent 62%),
    radial-gradient(940px 400px at 8% 112%, rgba(102, 126, 234, 0.16), transparent 60%);
  backdrop-filter: var(--uc-blur);
  -webkit-backdrop-filter: var(--uc-blur);
}

/*
  Below 1440 the details panel floats over the conversation rather than taking a
  column from it. Rendering it into the same grid cell and repositioning it here
  keeps one instance and one set of props, so opening it never remounts the
  panel and loses a half-typed group name.
*/
.pane-aside {
  position: absolute;
  inset: 0 0 0 auto;
  z-index: 20;
  width: min(340px, 100%);
  box-shadow: -16px 0 44px rgba(4, 6, 20, 0.5);
  animation: uc-slide-in var(--uc-t-base) both;
}

@keyframes uc-slide-in {
  from { transform: translateX(14px); opacity: 0; }
  to   { transform: none; opacity: 1; }
}

/* ==========================================================================
   1 · MOBILE  (≤ 768px) — one pane at a time
   The side-nav switches to its drawer at exactly this width, so the two agree
   rather than leaving a band where the sidebar is squeezed *and* the floating
   menu button is overlapping it.
   ========================================================================== */
@media (max-width: 768px) {
  .uc-layout { height: calc(100dvh - 4.5rem); }

  .uc-shell { grid-template-columns: minmax(0, 1fr); }

  .pane-sidebar { border-right: 0; }
  .pane-main { display: none; }

  .thread-open .pane-sidebar { display: none; }
  .thread-open .pane-main { display: flex; }

  /* Full screen, because 340px of panel over a 380px phone is a panel with a
     20px sliver of context behind it — which is not context, just clutter. */
  .pane-aside { position: fixed; inset: 0; width: 100%; z-index: 55; }
}

/* ==========================================================================
   2 · TABLET  (769px – 1023px) — narrow list beside a fluid conversation
   ========================================================================== */
@media (min-width: 769px) and (max-width: 1023px) {
  .uc-shell { --uc-sidebar-w: 280px; }
}

/* ==========================================================================
   3 · LAPTOP / DESKTOP  (1024px – 1439px) — the default above
   `--uc-sidebar-w: 340px` from user-chat.css. Nothing to override.
   ========================================================================== */

/* ==========================================================================
   4 · LARGE & ULTRAWIDE  (≥ 1440px) — the details panel earns a column
   ========================================================================== */
@media (min-width: 1440px) {
  .uc-shell { --uc-sidebar-w: 360px; }

  .aside-open .uc-shell {
    grid-template-columns: var(--uc-sidebar-w) minmax(0, 1fr) var(--uc-aside-w);
  }
  .aside-open .pane-aside {
    position: static;
    width: auto;
    box-shadow: none;
    animation: none;
  }
}

/* ==========================================================================
   5 · TV / 4K  (≥ 1920px)
   A conversation stretched across 3840px is a line of text nobody can track
   back to the start of, and 13px type read from a sofa is nothing at all. So
   the shell is capped and centred, the panes get wider, and `--uc-scale` lifts
   every font token together.
   ========================================================================== */
@media (min-width: 1920px) {
  .uc-layout {
    padding: clamp(16px, 1.2vw, 32px);
  }
  .uc-shell {
    --uc-sidebar-w: 400px;
    --uc-aside-w: 380px;
    max-width: 2200px;
    border: 1px solid var(--uc-border);
    border-radius: var(--uc-r-xl);
    box-shadow: var(--uc-shadow-lg);
  }
  /* `--uc-scale` is bumped on `.uc-root` in user-chat.css, not here — see the
     note there about when a var() inside a custom property is substituted. */
}

@media (min-width: 2560px) {
  .uc-shell {
    --uc-sidebar-w: 460px;
    --uc-aside-w: 420px;
  }
}
</style>
