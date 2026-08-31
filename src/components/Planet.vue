<template>
  <div class="planet-wrapper">
    <canvas
      v-if="webglOk"
      ref="canvas"
      :width="width"
      :height="height"
      :style="canvasStyle"
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
/*
  ==========================================================================
  THREE.JS IS LOADED ON DEMAND, AND THAT IS WORTH ~170 kB GZIP ON EVERY PAGE
  ==========================================================================
  `planetRenderer` imports the whole of `three`. It used to be a static import
  here, and `Planet.vue` is used by `Courses.vue` and `CourseDetails.vue`, both
  of which the router imports statically — so `three` landed in the ENTRY
  chunk. Every visitor downloaded a 3D engine to read the login page, a lesson,
  a certificate or their notifications, and the only two screens that can use
  it are the two course screens.

  It is `await import()` now. The engine arrives while the cards are already on
  screen, and the ~50 routes that have no planet on them never fetch it at all.

  Two consequences, both handled below:

   * **The WebGL probe had to stop coming from the engine.** Deciding whether to
     render a canvas or the CSS fallback is a synchronous decision made during
     setup, and asking the engine would mean downloading it to find out whether
     it can be used — which is the download this change exists to avoid. There
     is a local, dependency-free probe instead, exactly as
     `stage3d/loader.ts` does it for Babylon and for the same reason.
   * **The canvas is painted before the engine exists.** The canvas carries the
     same procedural gradient the fallback uses as a CSS background, so a card
     shows a planet from the first frame and the 3D sphere takes over on top of
     it when the chunk lands. Without that there is a blank hole in the card for
     as long as the download takes, which reads as a broken image.
  ==========================================================================
*/
import type { planetRenderer as PlanetRenderer } from './planetRenderer'

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

/**
 * Can this device do WebGL at all?
 *
 * Local and synchronous on purpose — see the note above. It is the same three
 * lines `planetRenderer.isWebGLAvailable()` runs; duplicating them is the
 * price of being able to answer without downloading the engine, and the answer
 * is a property of the browser rather than of the renderer.
 *
 * The context created here is thrown away immediately. A probe that kept it
 * would hold one of the browser's ~16 live contexts per card on the page.
 */
function hasWebGL(): boolean {
    try {
        const probe = document.createElement('canvas')
        return !!(window.WebGLRenderingContext
            && (probe.getContext('webgl2') || probe.getContext('webgl')))
    } catch {
        return false
    }
}

webglOk.value = hasWebGL()

/**
 * The engine, fetched once per tab and shared by every card.
 *
 * The PROMISE is cached rather than the module, so six cards mounting in the
 * same tick join one download instead of starting six. A failed import is
 * cached as null: a chunk that 404s after a deploy must not be retried once per
 * card, per mount, for the life of the page.
 */
let enginePromise: Promise<typeof PlanetRenderer | null> | null = null

function engine(): Promise<typeof PlanetRenderer | null> {
    if (!enginePromise) {
        enginePromise = import('./planetRenderer')
            .then(m => m.planetRenderer)
            .catch(error => {
                console.warn('[Planet] 3D engine unavailable:', error)
                return null
            })
    }
    return enginePromise
}

const initials = computed(() => {
  const name = (props.courseName || 'C').trim()
  const parts = name.split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || 'C'
})

/**
 * The three colours, derived from the course name.
 *
 * Returned as stops rather than as a finished gradient because two different
 * gradients are built from them: the fallback fills its whole (square) box, and
 * the canvas placeholder has to be a CIRCLE inside a box that is not square.
 * Building the second by string-surgery on the first was the first attempt and
 * it is exactly the kind of thing that breaks silently when somebody edits the
 * other one.
 */
const planetStops = computed(() => {
  const name = props.courseName || 'Course'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i) | 0
  const hue = Math.abs(hash) % 360
  return [
    `hsl(${hue},70%,60%) 0%`,
    `hsl(${(hue + 40) % 360},70%,30%) 70%`,
    `hsl(${(hue + 80) % 360},70%,15%) 100%`,
  ].join(', ')
})

const fallbackStyle = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
  background: `radial-gradient(circle at 30% 30%, ${planetStops.value})`,
}))

/**
 * Has the engine drawn into this canvas yet?
 *
 * It gates the placeholder below, and the gate is the whole point. A canvas
 * bitmap is TRANSPARENT everywhere the sphere is not, so a CSS background on
 * the canvas is not covered by the render — it shows through around the sphere
 * for ever. Left in place it is a coloured halo behind every card's planet,
 * which is what the first version of this change shipped: a wide ellipse,
 * because the canvas is about 320x180 and `border-radius: 50%` on a box that is
 * not square is an oval.
 */
const painted = ref(false)

/**
 * What the canvas shows while the 3D chunk is in flight, and nothing at all
 * once it has arrived.
 *
 * `circle closest-side` gives a circle whose diameter is the canvas's shorter
 * side, centred — roughly where the sphere lands — so the card holds a planet
 * from the first frame and the real one replaces it without the silhouette
 * changing shape.
 */
const canvasStyle = computed(() => painted.value
  ? {}
  : { background: `radial-gradient(circle closest-side at 50% 50%, ${planetStops.value}, transparent 100%)` })

async function register() {
  if (!canvas.value || !webglOk.value) return
  const renderer = await engine()
  /* The card may have been scrolled away, or the props changed, while the chunk
     was in flight. Both are ordinary on a course grid. */
  if (!renderer || !mounted || !canvas.value) return
  const id = await renderer.register({
    canvas: canvas.value,
    imageUrl: props.imageUrl,
    courseName: props.courseName,
    width: props.width,
    height: props.height,
  })
  if (mounted && id !== null) {
    planetId = id
    /* The engine paints its procedural texture on registration, so this is the
       first frame — drop the placeholder before it becomes a permanent halo. */
    painted.value = true
  } else if (id !== null) {
    renderer.unregister(id)
  }
}

function unregister() {
  /* Deliberately does NOT call `engine()`. A card unmounted before the chunk
     landed has nothing registered, and importing a 3D engine in order to tell
     it about a planet that was never created is the whole cost this change
     removes, paid on the way out. */
  if (planetId === null || !enginePromise) return
  const id = planetId
  planetId = null
  /* Back to the placeholder: the canvas is about to hold nothing, and a blank
     hole in a card reads as a broken image. */
  painted.value = false
  enginePromise.then(renderer => renderer?.unregister(id))
}

onMounted(() => {
  mounted = true
  register()
})

onBeforeUnmount(() => {
  mounted = false
  unregister()
})

watch(() => [props.imageUrl, props.courseName], () => {
  unregister()
  register()
})

watch(() => [props.width, props.height], ([w, h]) => {
  if (planetId === null || !enginePromise) return
  /* Captured now, not read inside the callback: `planetId` is nulled by
     `unregister()` and this promise is already resolved in every realistic
     case, so reading it later would occasionally resize a planet id of null. */
  const id = planetId
  enginePromise.then(renderer => renderer?.resize(id, w as number, h as number))
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
    0 0 30px rgb(var(--sfs-info-rgb, 0 217 255) / 0.2);
  animation: planet-spin 18s linear infinite;
}

.planet-fallback-text {
  font-size: clamp(28px, 8vw, 60px);
  font-weight: 800;
  color: var(--sfs-text, #fff);
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