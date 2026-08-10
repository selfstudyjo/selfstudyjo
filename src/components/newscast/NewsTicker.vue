<script setup lang="ts">
/**
 * The strap along the bottom — headlines going by while the anchors talk.
 *
 * Two things here are not cosmetic:
 *
 * 1. **Direction follows the language, not the page.** An Arabic ticker
 *    scrolling left-to-right is not untidy, it is unreadable: the eye meets the
 *    end of each headline first. So the animation direction is bound to `rtl`.
 *
 * 2. **The list is duplicated in the DOM and the duplicate is
 *    `aria-hidden`.** A seamless marquee needs two copies to translate between,
 *    and without hiding the second one a screen reader reads every headline
 *    twice. The whole strip is also `aria-live="off"` — a ticker that announced
 *    itself would talk over the anchor, which is the one thing a newsreader
 *    must never do.
 *
 * Pausing on hover is deliberate too: the headlines are links, and a link that
 * moves away as you reach for it is a link nobody clicks.
 */
import { computed } from 'vue';
import type { NewsHeadline } from '@/services/news.service';

interface Props {
    headlines: NewsHeadline[];
    rtl?: boolean;
    /** Seconds for one full pass. Scaled by how much text there is. */
    speed?: number;
    label?: string;
}

const props = withDefaults(defineProps<Props>(), {
    rtl: false,
    speed: 0,
    label: 'BREAKING',
});

/**
 * A fixed duration would crawl for three headlines and blur for forty, so the
 * duration is derived from the amount of text — roughly constant pixels per
 * second whatever the bulletin looks like.
 */
const duration = computed(() => {
    if (props.speed) return props.speed;
    const characters = props.headlines.reduce((total, h) => total + (h.title?.length || 0) + 6, 0);
    return Math.max(24, Math.min(180, Math.round(characters / 7)));
});

const hasHeadlines = computed(() => props.headlines.length > 0);
</script>

<template>
    <div class="ticker" :class="{ 'ticker--rtl': props.rtl }" :dir="props.rtl ? 'rtl' : 'ltr'">
        <span class="ticker__flag">{{ props.label }}</span>

        <div class="ticker__viewport" aria-live="off">
            <div
                v-if="hasHeadlines"
                class="ticker__track"
                :style="{ animationDuration: `${duration}s` }"
            >
                <span v-for="(headline, index) in props.headlines" :key="`a-${headline.id}-${index}`"
                      class="ticker__item">
                    <span class="ticker__source">{{ headline.source_label }}</span>
                    <a :href="headline.url" target="_blank" rel="noopener noreferrer"
                       class="ticker__link">{{ headline.title }}</a>
                    <span class="ticker__sep" aria-hidden="true">◆</span>
                </span>
                <!-- The seam. Hidden from assistive tech so nothing is read twice. -->
                <span v-for="(headline, index) in props.headlines" :key="`b-${headline.id}-${index}`"
                      class="ticker__item" aria-hidden="true">
                    <span class="ticker__source">{{ headline.source_label }}</span>
                    <span class="ticker__link">{{ headline.title }}</span>
                    <span class="ticker__sep">◆</span>
                </span>
            </div>
            <div v-else class="ticker__empty">
                <slot name="empty">No headlines yet.</slot>
            </div>
        </div>
    </div>
</template>

<style scoped>
.ticker {
    display: flex;
    align-items: stretch;
    width: 100%;
    min-width: 0;
    border-radius: 0.5rem;
    overflow: hidden;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
}

.ticker__flag {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    padding: 0 0.85rem;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.09em;
    background: var(--sfs-danger, #d24b5a);
    color: var(--sfs-on-danger, #ffffff);
    white-space: nowrap;
}

.ticker__viewport {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    height: 2.5rem;
}

.ticker__track {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    white-space: nowrap;
    will-change: transform;
    animation-name: marquee;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
}

/* Both copies sit in one flex row, so one pass is exactly -50%. */
@keyframes marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
}

/* RTL reads the other way, so the strip has to travel the other way too. */
.ticker--rtl .ticker__track {
    animation-name: marquee-rtl;
}

@keyframes marquee-rtl {
    from { transform: translateX(0); }
    to   { transform: translateX(50%); }
}

.ticker__viewport:hover .ticker__track,
.ticker__viewport:focus-within .ticker__track {
    animation-play-state: paused;
}

.ticker__item {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding-inline-end: 0.5rem;
}

.ticker__source {
    font-size: 0.63rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
    background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.28);
    color: var(--sfs-accent-text, #cfd6ff);
    white-space: nowrap;
}

.ticker__link {
    font-size: 0.86rem;
    color: var(--sfs-text, #eef1f8);
    text-decoration: none;
}

a.ticker__link:hover,
a.ticker__link:focus-visible {
    color: var(--sfs-accent-text, #cfd6ff);
    text-decoration: underline;
}

.ticker__sep {
    color: var(--sfs-accent, #667eea);
    font-size: 0.6rem;
    opacity: 0.75;
}

.ticker__empty {
    padding-inline: 0.85rem;
    font-size: 0.84rem;
    color: var(--sfs-text-muted, #a8b0c5);
}

@media (prefers-reduced-motion: reduce) {
    /* Motion off, but the headlines must still be reachable — so the strip
       becomes a scrollable row rather than a static crop that hides most of it. */
    .ticker__track {
        animation: none;
    }
    .ticker__viewport {
        overflow-x: auto;
    }
    .ticker__track > .ticker__item[aria-hidden='true'] {
        display: none;
    }
}
</style>
