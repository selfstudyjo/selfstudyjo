<template>
  <svg class="jk-weather" viewBox="0 0 24 24" :width="size" :height="size" role="img" :aria-label="text || 'No builds'">
    <title>{{ text || 'No builds' }}</title>
    <g v-if="icon === 'sunny' || icon === 'partly'" :transform="icon === 'partly' ? 'translate(-2 -2) scale(.85)' : ''">
      <circle cx="12" cy="12" r="4.2" fill="#f5b400" />
      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7"
            stroke="#f5b400" stroke-width="1.8" stroke-linecap="round" />
    </g>
    <path v-if="icon === 'partly'" d="M9 20h9.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.2A2.9 2.9 0 0 0 9 20z"
          fill="#fff" stroke="#8b8a90" stroke-width="1.4" />
    <path v-if="icon === 'cloudy' || icon === 'rain' || icon === 'storm'"
          d="M6.5 17h11a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.3A3.4 3.4 0 0 0 6.5 17z"
          :fill="icon === 'storm' ? '#6f6e75' : '#d9d8dd'" stroke="#77767c" stroke-width="1.3" />
    <path v-if="icon === 'rain'" d="M8.5 19l-.8 2.3M12.3 19l-.8 2.3M16 19l-.8 2.3" stroke="#3d7be0" stroke-width="1.6" stroke-linecap="round" />
    <path v-if="icon === 'storm'" d="M12.8 17.2l-2.3 3.4h2.4l-1.6 2.8" fill="none" stroke="#f5b400" stroke-width="1.6"
          stroke-linecap="round" stroke-linejoin="round" />
    <circle v-if="icon === 'none'" cx="12" cy="12" r="3" fill="none" stroke="#c4c3c8" stroke-width="1.4" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ icon: string; text?: string; size?: number }>(), { size: 22, text: '' });
</script>

<style scoped>
.jk-weather { flex: none; display: inline-block; vertical-align: middle; }
</style>
