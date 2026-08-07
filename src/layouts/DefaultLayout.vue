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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import SideNav from '@/components/SideNav.vue';
import ChatBox from '@/components/ChatBox.vue';
import AnimatedBackground from '@/components/AnimatedBackground.vue';

const route = useRoute();
const hideSupportChat = computed(() => Boolean(route.meta?.hideSupportChat));
</script>