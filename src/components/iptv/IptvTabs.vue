<template>
  <nav class="iptv-tabs" :aria-label="$t('Self Study TV')">
    <router-link v-for="tab in TV_TABS" :key="tab.id" class="iptv-tab"
                 :class="{ 'is-on': tab.id === active }" :to="tab.to"
                 :aria-current="tab.id === active ? 'page' : undefined">
      <span class="iptv-tab__icon" aria-hidden="true">
        <!--
          Inline SVG rather than a glyph from a font. The glyphs this page used
          before ("▶", "⌕") render as a completely different weight on Windows
          from macOS and are missing outright on some Android builds, where they
          come out as a replacement box in the middle of the header.
        -->
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round">
          <template v-if="tab.id === 'home'">
            <rect x="2" y="4" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
          </template>
          <template v-else-if="tab.id === 'movies'">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M7 3v18M17 3v18M3 12h18" />
          </template>
          <template v-else-if="tab.id === 'series'">
            <path d="M3 7h18v13H3zM8 3l4 4M16 3l-4 4" />
          </template>
          <template v-else>
            <circle cx="12" cy="12" r="3" />
            <path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" />
          </template>
        </svg>
      </span>
      <span class="iptv-tab__text">{{ $t(tab.label) }}</span>
      <!--
        A count is drawn only when there is one to draw. `0` is not "no count" —
        an empty library legitimately has zero films, and a tab reading `Films 0`
        says something true that a blank tab does not.
      -->
      <span v-if="countFor(tab.id) !== null" class="iptv-tab__count">
        {{ $n(countFor(tab.id) as number) }}
      </span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
/*
  The tab strip: Browse · Films · Series · Live TV.

  ONE COMPONENT, ON ALL FOUR PAGES
  ================================

  It is rendered by the hub, the series page, the player and the live page, so
  the strip is in the same place with the same items wherever a viewer is. That
  is the whole point of it: before, the only way from a series back to the
  channels was the browser's Back button or a link that happened to be in the
  hero.

  `router-link`s, not buttons. A tab is a ROUTE here (see `TV_TABS` in
  `iptvEngine.ts`), so middle-click opens one in a new tab, Back and Forward
  work, and the strip can be told which item to light by asking the path rather
  than by holding state of its own.

  WHICH ITEM IS LIT IS `tabFor`'s DECISION, NOT THIS FILE'S
  ========================================================

  `tabFor` is in the plain module with `npm run check:iptv` over it, because the
  interesting cases are the ones that are not a tab's own path — a series' own
  page, a channel query string, the player — and every one of them is a strip
  that goes blank and reads as broken. None of that is visible in a screenshot
  of the hub.
*/
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { TV_TABS, tabFor, type TabId } from '@/utils/iptvEngine';

const props = defineProps<{
    /** Library sizes, when the page knows them. Omitted rather than zero. */
    counts?: Partial<Record<TabId, number>>;
    /** Overrides the path, for a page that is a tab's child. */
    tab?: TabId;
}>();

const route = useRoute();

const active = computed<TabId>(() => props.tab || tabFor(route.path));

function countFor(id: TabId): number | null {
    const value = props.counts?.[id];
    return typeof value === 'number' ? value : null;
}
</script>
