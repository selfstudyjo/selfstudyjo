<template>
  <div class="planet-wrapper">
    <canvas
      v-if="webglOk"
      ref="canvas"
      :width="width"
      :height="height"
      class="planet-canvas"
    />
    <div
      v-else
      class="planet-fallback"
      :style="fallbackStyle"
      :title="courseName"
    >
      <span class="planet-fallback-text">{{ initials }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { planetRenderer } from './planetRenderer'

const props = defineProps<{
  imageUrl?: string
  courseName: string
  width: number
  height: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const webglOk = ref(true)
let planetId: number | null = null
let mounted = false

webglOk.value = planetRenderer.isWebGLAvailable()

const initials = computed(() => {
  const name = (props.courseName || 'C').trim()
  const parts = name.split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || 'C'
})

const fallbackStyle = computed(() => {
  const name = props.courseName || 'Course'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i) | 0
  const hue = Math.abs(hash) % 360
  return {
    width: `${props.width}px`,
    height: `${props.height}px`,
    background: `radial-gradient(circle at 30% 30%,
      hsl(${hue},70%,60%) 0%,
      hsl(${(hue + 40) % 360},70%,30%) 70%,
      hsl(${(hue + 80) % 360},70%,15%) 100%)`,
  }
})

async function register() {
  if (!canvas.value || !webglOk.value) return
  const id = await planetRenderer.register({
    canvas: canvas.value,
    imageUrl: props.imageUrl,
    courseName: props.courseName,
    width: props.width,
    height: props.height,
  })
  if (mounted && id !== null) planetId = id
  else if (id !== null) planetRenderer.unregister(id) // unmounted while loading
}

function unregister() {
  if (planetId !== null) {
    planetRenderer.unregister(planetId)
    planetId = null
  }
}

onMounted(() => {
  mounted = true
  register()
})

onBeforeUnmount(() => {
  mounted = false
  unregister()
})

// Re-register when source props change
watch(() => [props.imageUrl, props.courseName], () => {
  unregister()
  register()
})

// Resize without re-registering
watch(() => [props.width, props.height], ([w, h]) => {
  if (planetId !== null) planetRenderer.resize(planetId, w as number, h as number)
})
</script>

<style scoped>
.planet-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.planet-canvas {
  display: block;
  max-width: 100%;
  height: auto;
  /* prevent layout shift / blurry scaling */
  image-rendering: -webkit-optimize-contrast;
}

.planet-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: 1 / 1;
  box-shadow:
    inset -10px -10px 30px rgba(0, 0, 0, 0.4),
    inset 10px 10px 30px rgba(255, 255, 255, 0.15),
    0 0 30px rgba(0, 217, 255, 0.2);
  animation: planet-spin 18s linear infinite;
}

.planet-fallback-text {
  font-size: clamp(28px, 8vw, 60px);
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  letter-spacing: -0.02em;
}

@keyframes planet-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .planet-fallback {
    animation: none;
  }
}
</style>