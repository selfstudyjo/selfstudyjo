<script setup lang="ts">
/**
 * A monitor on the studio wall — the bezel from the supplied artwork, with
 * live content on the glass.
 *
 * WHAT THE ARTWORK GIVES US AND WHAT IT CANNOT
 *
 * `images_screen.png` and `text_screen.png` arrived byte-identical (same
 * SHA256), so there is one graphic here rather than two, used as the frame for
 * both panels. That is fine — a studio's monitors are the same monitor.
 *
 * The graphic is a photograph of a wall-mounted screen with content already on
 * it, and that content is another broadcaster's: a GNN logo, "MARKET UPDATE:
 * KEY METRICS", a ticker about the Fed. None of it can stay legible on a Self
 * Study page. What the photograph is genuinely worth is everything AROUND the
 * pixels — the bezel, the way the panel catches the studio light, the blue cast
 * of a screen that is switched on — so:
 *
 *   * it is cropped to the bezel (the original had a strip of grey wall around
 *     it, which reads as a sticker when laid over the studio);
 *   * the same image is used again INSIDE the bezel, blurred and dimmed, as the
 *     backdrop. That keeps the map, the glow and the data-panel texture and
 *     destroys every word of the foreign branding — a wash rather than a
 *     redaction, which is why it still looks like a screen with something on it
 *     rather than a black rectangle;
 *   * our own content sits on top, laid out the way the artwork lays its own
 *     out: a network chip and a LIVE light at the top, the picture in the
 *     middle, a strap along the bottom.
 *
 * WHY THE INSET IS A PERCENTAGE AND NOT A NUMBER OF PIXELS
 *
 * The glass is inset from the bezel by 0.9% horizontally and 1.2%/1.5%
 * vertically — measured off the artwork, not guessed. As percentages they hold
 * at every size the panel is rendered at, which matters because it is ~27% of
 * the stage on a desktop and the full width of the frame on a phone.
 */

import { Radio } from 'lucide-vue-next';
import frame from '@/assets/studio/studio_screen.webp';

defineProps<{
    /** Small chip, top left — what this monitor is showing. */
    label: string;
    /** Strap along the bottom. Usually the source, or the anchor's name. */
    strap?: string;
    /** Red light, top right. Off when the bulletin is not running. */
    live?: boolean;
    /** Shown in the middle when there is nothing to put on the glass. */
    placeholder?: string;
}>();
</script>

<template>
    <figure class="screen">
        <img class="screen__bezel" :src="frame" alt="" draggable="false" />

        <div class="screen__glass">
            <!--
              The artwork again, blurred past legibility. `scale` first: a blur
              samples outside its own box and would otherwise leave a pale halo
              inside the bezel, which looks like a backlight fault.
            -->
            <img class="screen__wash" :src="frame" alt="" aria-hidden="true" draggable="false" />
            <span class="screen__tint" aria-hidden="true"></span>
            <span class="screen__scan" aria-hidden="true"></span>

            <header class="screen__head">
                <span class="screen__chip">{{ label }}</span>
                <span class="screen__live" :class="{ 'screen__live--on': live }">
                    <span class="screen__dot"></span>LIVE
                </span>
            </header>

            <div class="screen__body">
                <slot>
                    <p v-if="placeholder" class="screen__placeholder">
                        <Radio :size="15" /> {{ placeholder }}
                    </p>
                </slot>
            </div>

            <footer v-if="strap" class="screen__strap">
                <span class="screen__strapFlag"></span>
                <span class="screen__strapText">{{ strap }}</span>
            </footer>
        </div>
    </figure>
</template>

<style scoped>
.screen {
    position: relative;
    margin: 0;
    /* The cropped artwork, so the bezel is never stretched out of shape. */
    aspect-ratio: 917 / 534;
    width: 100%;
    /* A drop shadow to seat it against the wall, and a cold bloom so it reads
       as a panel that is switched ON. Without the second one it is a dark
       rectangle sitting on a photograph of a studio, which is what it looked
       like first time round. */
    filter: drop-shadow(0 10px 22px rgb(0 0 0 / 0.5))
            drop-shadow(0 0 22px rgb(90 140 255 / 0.22));
}

.screen__bezel {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    object-fit: fill;
}

/* Measured off the artwork — see the note at the top. */
.screen__glass {
    position: absolute;
    top: 1.2%;
    bottom: 1.5%;
    left: 0.9%;
    right: 0.9%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--sfs-overlay, #05070f);
    /* The bezel in the artwork is only ~1% wide, so at panel size it is a
       couple of pixels and disappears. This is what actually sells the edge:
       a hairline of reflected light and the corner falloff of a real panel. */
    box-shadow:
        inset 0 0 0 1px rgb(255 255 255 / 0.1),
        inset 0 0 34px rgb(0 0 0 / 0.55);
}

.screen__wash {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* Scale first: a blur samples outside its own box and would leave a pale
       halo inside the bezel, which reads as a backlight fault. */
    transform: scale(1.14);
    /* Bright enough that the map and the data panels still glow through — the
       whole reason the artwork is reused in here rather than replaced with a
       flat gradient — and blurred far past anything legible. */
    filter: blur(9px) brightness(0.68) saturate(1.55);
}

.screen__tint {
    position: absolute;
    inset: 0;
    background:
        radial-gradient(90% 70% at 50% 0%,
            rgb(var(--sfs-accent-rgb, 102 126 234) / 0.3), transparent 70%),
        linear-gradient(to bottom, rgb(4 14 34 / 0.3), rgb(3 9 22 / 0.66));
}

.screen__scan {
    position: absolute;
    inset: 0;
    opacity: 0.35;
    background: repeating-linear-gradient(
        to bottom, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px);
}

/* -- chrome ---------------------------------------------------------- */
.screen__head {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
    padding: 4% 4% 2%;
}

.screen__chip,
.screen__live {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    padding: 0.22em 0.55em;
    border-radius: 0.2em;
    /* `cqw` would be neater and is not needed: the panel's width tracks the
       stage, so vw keeps the chrome in proportion at every breakpoint. */
    font-size: clamp(0.5rem, 0.85vw, 0.72rem);
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
}

.screen__chip {
    background: var(--sfs-accent, #667eea);
    color: var(--sfs-on-accent, #ffffff);
}

.screen__live {
    background: rgb(0 0 0 / 0.45);
    color: rgb(255 255 255 / 0.55);
    border: 1px solid rgb(255 255 255 / 0.14);
}

.screen__live--on {
    background: var(--sfs-danger, #d24b5a);
    color: var(--sfs-on-danger, #ffffff);
    border-color: transparent;
}

.screen__dot {
    width: 0.42em;
    height: 0.42em;
    border-radius: 50%;
    background: currentColor;
}

.screen__live--on .screen__dot { animation: blink 1.4s ease-in-out infinite; }

@keyframes blink {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.3; }
}

.screen__body {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    padding: 0 4%;
}

.screen__placeholder {
    margin: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: clamp(0.55rem, 0.95vw, 0.8rem);
    color: rgb(255 255 255 / 0.5);
    text-align: center;
}

.screen__strap {
    position: relative;
    display: flex;
    align-items: stretch;
    /* Hugs its text instead of running the width of the glass. A strap is a
       label, and a full-width white bar with two words at one end reads as a
       caption that failed to load. Follows `direction`, so it starts at the
       right in Arabic. */
    align-self: flex-start;
    max-width: 100%;
    gap: 0;
    margin: 2.5% 4% 4%;
    border-radius: 0.15em;
    overflow: hidden;
    background: rgb(255 255 255 / 0.94);
}

.screen__strapFlag {
    flex: 0 0 auto;
    width: 0.42rem;
    background: var(--sfs-danger, #d24b5a);
}

.screen__strapText {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0.28em 0.6em;
    font-size: clamp(0.5rem, 0.9vw, 0.74rem);
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: rgb(12 18 34);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
    .screen__live--on .screen__dot { animation: none; }
}
</style>
