<template>
  <div class="default-layout">
    <!-- Animated 3D Galaxy Background (fixed, z-index: 0) -->
    <AnimatedBackground />

    <!--
      SideNav owns the .app-container + .main-content shell.
      <router-view /> is passed through its default slot so the
      sidebar's collapse / drawer states physically SHIFT the
      content (sibling selector .sidebar ~ .main-content).
    -->
    <SideNav>
      <!--
        The top bar: a terminal, a SQL editor and a Python compiler, on every
        page. Inside SideNav's slot rather than above it, so the sidebar's
        collapse and its mobile drawer physically shift it with the content -
        placed outside, it would sit under the rail at every width.

        Hidden on any route that asks for it with `meta.hideTopBar`, which is the
        lab workspace: that page has its own workbench with the same three tools
        in it, and two consoles for one command is a student wondering which one
        they are typing into.
      -->
      <TopBar v-if="!hideTopBar" />
      <router-view />
    </SideNav>

    <!--
      Support chat (app 9) — fixed, above everything.

      Hidden on any route that asks for it with `meta.hideSupportChat`. That is
      the Messages page (app 35): the toggle is a fixed circle in the
      bottom-right corner and it lands exactly on top of the composer's
      microphone button, so somebody trying to record a voice note opens the
      support widget instead.

      Driven off route meta rather than a path check so a future full-height page
      can opt out the same way, and `v-if` rather than a CSS hide because leaving
      it mounted keeps it polling app 9 in the background of a page that has
      nothing to do with it.
    -->
    <ChatBox v-if="!hideSupportChat" />

    <!--
      The guided tour, mounted ONCE and outside SideNav's slot.

      Outside because it teleports itself to <body> anyway and because it must
      survive `meta.hideTopBar` - the lab workspace hides the top bar, which is
      where the button normally lives, and that page is the one with the most to
      explain. The button appears there in the workbench's own header instead;
      both reach this through `useTour`.
    -->
    <TourGuide />

    <!--
      Noor, mounted ONCE and outside SideNav's slot, for the same two reasons
      the tour is: she teleports herself to <body> anyway, and she must survive
      `meta.hideTopBar` - the lab workspace hides the top bar, which is where
      her button normally lives, and that is the page with the most to explain.
      The button appears there in the workbench's own header instead; both
      reach this one window through `useAssistant`.
    -->
    <AssistantDock v-if="assistantOpen" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';

import SideNav from '@/components/SideNav.vue';
import TopBar from '@/components/TopBar.vue';
import ChatBox from '@/components/ChatBox.vue';
import AnimatedBackground from '@/components/AnimatedBackground.vue';
import TourGuide from '@/components/TourGuide.vue';
import { useAssistant } from '@/composables/useAssistant';
/**
 * DEFERRED, on the `LearnerActivity` precedent (working rule 47).
 *
 * The router imports ~50 views statically, so anything reachable from module
 * scope is downloaded by a visitor reading the login page. Her window is the
 * biggest part of this feature and most readers never open it, so it is fetched
 * on the first press of the button instead — the BUTTON stays eager, because it
 * is in the top bar on every page.
 *
 * `v-if` as well as the async import, so the chunk is not even requested until
 * somebody opens her. Unmounting on close is deliberate rather than incidental:
 * it releases the WebGL context (a browser caps them and silently kills the
 * oldest, which looks like somebody else's canvas going black) and it ends the
 * conversation, which is what `useAssistant`'s header says it should do.
 */
const AssistantDock = defineAsyncComponent(
    () => import('@/components/assistant/AssistantDock.vue'));

const route = useRoute();
const hideSupportChat = computed(() => Boolean(route.meta?.hideSupportChat));
const hideTopBar = computed(() => Boolean(route.meta?.hideTopBar));

// One window for every button that can open it - the top bar's and the lab
// workbench's. See `composables/useAssistant.ts`.
const { open: assistantOpen } = useAssistant();
</script>