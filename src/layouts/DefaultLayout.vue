<template>
  <div class="default-layout">
    <!-- Animated 3D Space Background -->
    <AnimatedBackground />
    
    <!-- ALWAYS show SideNav for both authenticated and anonymous users -->
    <SideNav />

    <main :class="['main-content', { 'with-sidenav': true }]">
      <router-view />
    </main>

    <!-- Show ChatBox for ALL users (authenticated and anonymous) -->
    <ChatBox />
  </div>
</template>

<script setup lang="ts">
import SideNav from '@/components/SideNav.vue';
import ChatBox from '@/components/ChatBox.vue';
import AnimatedBackground from '@/components/AnimatedBackground.vue';
</script>

<style src="@/assets/css/default-layout.css"></style>