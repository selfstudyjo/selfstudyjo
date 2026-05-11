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

    <!-- Chat (fixed, above everything) -->
    <ChatBox />
  </div>
</template>

<script setup lang="ts">
import SideNav from '@/components/SideNav.vue';
import ChatBox from '@/components/ChatBox.vue';
import AnimatedBackground from '@/components/AnimatedBackground.vue';
</script>