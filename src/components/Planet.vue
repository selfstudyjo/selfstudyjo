<template>
  <canvas
    ref="canvas"
    :width="width"
    :height="height"
    class="planet-canvas"
  ></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { getSecureMediaUrl } from '@/utils/mediaUtils'

const props = defineProps<{
  imageUrl?: string
  courseName: string
  width: number
  height: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let sphere: THREE.Mesh
let animationFrame: number
let fallbackTimer: ReturnType<typeof setTimeout>

// Convert absolute media URLs to local proxy URLs (development only)
// In production, use secure endpoint
function getEffectiveUrl(url: string): string {
  if (!url) return url

  // In development, use proxy
  if (import.meta.env.DEV) {
    const media1Pattern = /^https?:\/\/selfstudymedia1\.pythonanywhere\.com/
    const media2Pattern = /^https?:\/\/selfstudymedia2\.pythonanywhere\.com/
    if (media1Pattern.test(url)) return url.replace(media1Pattern, '/media1')
    if (media2Pattern.test(url)) return url.replace(media2Pattern, '/media2')
    return url
  }

  // In production, rewrite to secure-media endpoint
  return getSecureMediaUrl(url)
}

// Unique color based on course name
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i), hash |= 0
  return Math.abs(hash)
}
function getHueFromName(name: string): number {
  return name ? hashString(name) % 360 : 0
}

// Generate a textured canvas with course name
function generateNameTexture(name: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  const displayName = name || 'Course'
  const hue = getHueFromName(displayName)
  const color1 = `hsl(${hue}, 80%, 60%)`
  const color2 = `hsl(${(hue + 40) % 360}, 80%, 40%)`

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, color1)
  gradient.addColorStop(1, color2)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Stars
  ctx.fillStyle = 'white'
  const seed = hashString(displayName)
  for (let i = 0; i < 50; i++) {
    const x = ((seed * (i + 1)) % canvas.width)
    const y = ((seed * (i + 100)) % canvas.height)
    const r = ((seed * (i + 200)) % 3) + 1
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Course name
  ctx.font = 'Bold 60px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'white'
  ctx.strokeStyle = 'black'
  ctx.lineWidth = 4
  ctx.strokeText(displayName, canvas.width / 2, canvas.height / 2)
  ctx.fillText(displayName, canvas.width / 2, canvas.height / 2)

  return new THREE.CanvasTexture(canvas)
}

// Check if loaded texture is the 1x1 fallback
function isFallbackImage(texture: THREE.Texture): boolean {
  const img = texture.image as HTMLImageElement
  return img?.width === 1 && img?.height === 1
}

// Load texture with fallback
function loadImageTexture(url: string): Promise<THREE.Texture> {
  const finalUrl = getEffectiveUrl(url)
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous' // Request CORS access
    loader.load(
      finalUrl,
      (texture) => {
        // If the image is a fallback (1x1), generate a named texture instead
        if (isFallbackImage(texture)) {
          console.warn(`Image at ${finalUrl} is a 1x1 fallback, using generated texture`)
          resolve(generateNameTexture(props.courseName))
        } else {
          resolve(texture)
        }
      },
      undefined,
      (error) => {
        console.warn(`Failed to load image from ${finalUrl}, using generated texture`, error)
        resolve(generateNameTexture(props.courseName))
      }
    )
  })
}

async function initPlanet() {
  if (!canvas.value) return
  const { width, height } = props

  // Safety timeout: if texture loading takes >3 seconds, force generated texture
  fallbackTimer = setTimeout(() => {
    if (sphere) {
      console.log('Fallback timer triggered, using generated texture')
      const generated = generateNameTexture(props.courseName)
      sphere.material.map = generated
      sphere.material.needsUpdate = true
    }
  }, 3000)

  scene = new THREE.Scene()
  scene.background = null

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.set(0, 0, 3)

  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)

  const ambientLight = new THREE.AmbientLight(0x404060)
  scene.add(ambientLight)
  const dirLight = new THREE.DirectionalLight(0xffffff, 1)
  dirLight.position.set(1, 1, 1)
  scene.add(dirLight)
  const backLight = new THREE.PointLight(0x4466aa, 0.5)
  backLight.position.set(-1, -1, -1)
  scene.add(backLight)

  const geometry = new THREE.SphereGeometry(1, 64, 64)

  const texture = props.imageUrl
    ? await loadImageTexture(props.imageUrl)
    : generateNameTexture(props.courseName)

  clearTimeout(fallbackTimer) // cancel safety timeout

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.4,
    metalness: 0.1,
    emissive: 0x111111,
  })
  sphere = new THREE.Mesh(geometry, material)
  scene.add(sphere)

  function animate() {
    if (sphere) sphere.rotation.y += 0.005
    renderer.render(scene, camera)
    animationFrame = requestAnimationFrame(animate)
  }
  animate()
}

function cleanup() {
  clearTimeout(fallbackTimer)
  if (animationFrame) cancelAnimationFrame(animationFrame)
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss?.()
  }
  if (scene) {
    scene.traverse((obj: any) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose())
        else obj.material.dispose()
      }
    })
  }
}

onMounted(() => initPlanet())
onUnmounted(() => cleanup())
watch(() => [props.imageUrl, props.courseName], () => { cleanup(); initPlanet() })
</script>

<style scoped>
/* ===== GLOBAL RESET & BASE ===== */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ===== CSS CUSTOM PROPERTIES (DEFAULT: ~600px MEDIUM SCREEN) ===== */
:root {
  /* Typography */
  --font-base: 14px;                /* base font size for ~600px */
  --font-scale-h1: 2.5rem;
  --font-scale-h2: 2rem;
  --font-scale-h3: 1.75rem;
  --font-scale-h4: 1.5rem;
  --font-scale-h5: 1.25rem;
  --font-scale-h6: 1rem;
  --line-height-base: 1.5;
  --letter-spacing-base: 0.01em;

  /* Spacing */
  --spacing-unit: 4px;              /* base unit for margins/paddings */
  --container-max: 1000px;           /* default max container width */
  --border-radius-base: 4px;

  /* Touch targets */
  --button-min-height: 40px;
  --input-min-height: 40px;

  /* Colors (preserve existing, only define neutrals) */
  --color-text: #333;
  --color-background: #fff;
  --color-border: #ddd;
  --color-primary: #0066cc;
  --color-primary-hover: #0052a3;
  --color-focus-ring: rgba(0, 102, 204, 0.4);
}

/* ===== BASE ELEMENTS ===== */
html {
  font-size: var(--font-base);
  scroll-behavior: smooth;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 1rem;
  line-height: var(--line-height-base);
  letter-spacing: var(--letter-spacing-base);
  color: var(--color-text);
  background-color: var(--color-background);
  min-height: 100vh;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ===== TYPOGRAPHY ===== */
h1, h2, h3, h4, h5, h6 {
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: calc(var(--spacing-unit) * 2);
  color: currentColor;
}

h1 { font-size: var(--font-scale-h1); }
h2 { font-size: var(--font-scale-h2); }
h3 { font-size: var(--font-scale-h3); }
h4 { font-size: var(--font-scale-h4); }
h5 { font-size: var(--font-scale-h5); }
h6 { font-size: var(--font-scale-h6); }

p {
  margin-bottom: calc(var(--spacing-unit) * 2);
}

small, .text-small {
  font-size: 0.875rem;
}

/* ===== CONTAINERS ===== */
.container {
  width: 100%;
  max-width: var(--container-max);
  margin-left: auto;
  margin-right: auto;
  padding-left: calc(var(--spacing-unit) * 2);
  padding-right: calc(var(--spacing-unit) * 2);
}

.container-fluid {
  width: 100%;
  padding-left: calc(var(--spacing-unit) * 2);
  padding-right: calc(var(--spacing-unit) * 2);
}

/* ===== LAYOUT UTILITIES ===== */
.flex {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--spacing-unit) * 2);
}

.grid {
  display: grid;
  gap: calc(var(--spacing-unit) * 2);
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

/* ===== BUTTONS ===== */
button,
.btn,
.button,
input[type="button"],
input[type="submit"],
input[type="reset"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--button-min-height);
  padding: 0 calc(var(--spacing-unit) * 3);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1;
  color: white;
  background-color: var(--color-primary);
  border: 1px solid transparent;
  border-radius: var(--border-radius-base);
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
  white-space: nowrap;
  user-select: none;
}

button:hover,
.btn:hover,
.button:hover {
  background-color: var(--color-primary-hover);
}

button:focus,
.btn:focus,
.button:focus {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

button:active,
.btn:active,
.button:active {
  transform: translateY(1px);
}

/* Secondary button style (preserve existing colors, just structure) */
.btn-secondary {
  background-color: transparent;
  color: var(--color-primary);
  border-color: var(--color-border);
}

.btn-secondary:hover {
  background-color: rgba(0,0,0,0.05);
}

/* ===== FORM INPUTS ===== */
input,
textarea,
select {
  width: 100%;
  min-height: var(--input-min-height);
  padding: calc(var(--spacing-unit) * 1.5) calc(var(--spacing-unit) * 2);
  font-size: 1rem;
  line-height: 1.5;
  color: var(--color-text);
  background-color: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-base);
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

label {
  display: block;
  margin-bottom: calc(var(--spacing-unit) * 1);
  font-weight: 500;
}

/* ===== ICONS & IMAGES ===== */
img,
svg,
.icon {
  max-width: 100%;
  height: auto;
  display: inline-block;
  vertical-align: middle;
}

/* Preserve original icon colors — only adjust sizing if needed */
.sidebar-toggle,
.chat-icon,
[class*="icon"],
[class*="Icon"] {
  color: inherit;  /* do not override existing colors */
  fill: currentColor;
  width: auto;
  height: auto;
}

/* ===== ORIGINAL COMPONENT STYLES (PRESERVED) ===== */
.planet-canvas {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ===== MEDIA QUERIES – ORDERED SMALLEST TO LARGEST ===== */

/* ----- Breakpoint: 200px – 250px | Micro Screens ----- */
@media only screen and (min-width: 200px) and (max-width: 250px) {
  :root {
    --font-base: 8px;
    --spacing-unit: 2px;
    --container-max: 100%;
    --border-radius-base: 2px;
    --button-min-height: 32px;
    --input-min-height: 32px;
  }
  h1 { --font-scale-h1: 2rem; }
  h2 { --font-scale-h2: 1.75rem; }
  h3 { --font-scale-h3: 1.5rem; }
  h4 { --font-scale-h4: 1.25rem; }
  h5 { --font-scale-h5: 1rem; }
  h6 { --font-scale-h6: 0.875rem; }
  .grid { grid-template-columns: 1fr; } /* single column */
}

/* ----- Breakpoint: 250px – 300px | Tiny Screens ----- */
@media only screen and (min-width: 250px) and (max-width: 300px) {
  :root {
    --font-base: 9px;
    --spacing-unit: 2px;
    --container-max: 100%;
    --border-radius-base: 2px;
    --button-min-height: 34px;
    --input-min-height: 34px;
  }
  h1 { --font-scale-h1: 2rem; }
  h2 { --font-scale-h2: 1.75rem; }
  h3 { --font-scale-h3: 1.5rem; }
  h4 { --font-scale-h4: 1.25rem; }
  h5 { --font-scale-h5: 1rem; }
  h6 { --font-scale-h6: 0.875rem; }
  .grid { grid-template-columns: 1fr; }
}

/* ----- Breakpoint: 300px – 350px | X-Small Screens ----- */
@media only screen and (min-width: 300px) and (max-width: 350px) {
  :root {
    --font-base: 10px;
    --spacing-unit: 3px;
    --container-max: 100%;
    --border-radius-base: 3px;
    --button-min-height: 36px;
    --input-min-height: 36px;
  }
  h1 { --font-scale-h1: 2rem; }
  h2 { --font-scale-h2: 1.75rem; }
  h3 { --font-scale-h3: 1.5rem; }
  h4 { --font-scale-h4: 1.25rem; }
  h5 { --font-scale-h5: 1rem; }
  h6 { --font-scale-h6: 0.875rem; }
  .grid { grid-template-columns: 1fr; }
}

/* ----- Breakpoint: 350px – 400px | Small- Screens ----- */
@media only screen and (min-width: 350px) and (max-width: 400px) {
  :root {
    --font-base: 11px;
    --spacing-unit: 3px;
    --container-max: 100%;
    --border-radius-base: 3px;
    --button-min-height: 38px;
    --input-min-height: 38px;
  }
  h1 { --font-scale-h1: 2.25rem; }
  h2 { --font-scale-h2: 2rem; }
  h3 { --font-scale-h3: 1.75rem; }
  h4 { --font-scale-h4: 1.5rem; }
  h5 { --font-scale-h5: 1.25rem; }
  h6 { --font-scale-h6: 1rem; }
  .grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
}

/* ----- Breakpoint: 400px – 450px | Small Screens ----- */
@media only screen and (min-width: 400px) and (max-width: 450px) {
  :root {
    --font-base: 12px;
    --spacing-unit: 4px;
    --container-max: 100%;
    --border-radius-base: 4px;
    --button-min-height: 40px;
    --input-min-height: 40px;
  }
  h1 { --font-scale-h1: 2.5rem; }
  h2 { --font-scale-h2: 2.2rem; }
  h3 { --font-scale-h3: 1.9rem; }
  h4 { --font-scale-h4: 1.6rem; }
  h5 { --font-scale-h5: 1.3rem; }
  h6 { --font-scale-h6: 1.1rem; }
  .grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
}

/* ----- Breakpoint: 450px – 500px | Small+ Screens ----- */
@media only screen and (min-width: 450px) and (max-width: 500px) {
  :root {
    --font-base: 13px;
    --spacing-unit: 4px;
    --container-max: 100%;
    --border-radius-base: 4px;
    --button-min-height: 42px;
    --input-min-height: 42px;
  }
  h1 { --font-scale-h1: 2.6rem; }
  h2 { --font-scale-h2: 2.3rem; }
  h3 { --font-scale-h3: 2rem; }
  h4 { --font-scale-h4: 1.7rem; }
  h5 { --font-scale-h5: 1.4rem; }
  h6 { --font-scale-h6: 1.2rem; }
  .grid { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
}

/* ----- Breakpoint: 500px – 550px | Medium- Screens ----- */
@media only screen and (min-width: 500px) and (max-width: 550px) {
  :root {
    --font-base: 13.5px;
    --spacing-unit: 4px;
    --container-max: 540px;
    --border-radius-base: 4px;
    --button-min-height: 44px;
    --input-min-height: 44px;
  }
  h1 { --font-scale-h1: 2.7rem; }
  h2 { --font-scale-h2: 2.4rem; }
  h3 { --font-scale-h3: 2.1rem; }
  h4 { --font-scale-h4: 1.8rem; }
  h5 { --font-scale-h5: 1.5rem; }
  h6 { --font-scale-h6: 1.2rem; }
}

/* ----- Breakpoint: 550px – 600px | Medium Screens ----- */
@media only screen and (min-width: 550px) and (max-width: 600px) {
  :root {
    --font-base: 14px;
    --spacing-unit: 5px;
    --container-max: 600px;
    --border-radius-base: 5px;
    --button-min-height: 45px;
    --input-min-height: 45px;
  }
  h1 { --font-scale-h1: 2.8rem; }
  h2 { --font-scale-h2: 2.5rem; }
  h3 { --font-scale-h3: 2.2rem; }
  h4 { --font-scale-h4: 1.9rem; }
  h5 { --font-scale-h5: 1.6rem; }
  h6 { --font-scale-h6: 1.3rem; }
}

/* ----- Breakpoint: 600px – 650px | Medium+ Screens ----- */
@media only screen and (min-width: 600px) and (max-width: 650px) {
  :root {
    --font-base: 14.5px;
    --spacing-unit: 5px;
    --container-max: 640px;
    --border-radius-base: 5px;
    --button-min-height: 46px;
    --input-min-height: 46px;
  }
  h1 { --font-scale-h1: 2.9rem; }
  h2 { --font-scale-h2: 2.6rem; }
  h3 { --font-scale-h3: 2.3rem; }
  h4 { --font-scale-h4: 2rem; }
  h5 { --font-scale-h5: 1.7rem; }
  h6 { --font-scale-h6: 1.4rem; }
}

/* ----- Breakpoint: 650px – 700px | Large- Screens ----- */
@media only screen and (min-width: 650px) and (max-width: 700px) {
  :root {
    --font-base: 15px;
    --spacing-unit: 6px;
    --container-max: 680px;
    --border-radius-base: 6px;
    --button-min-height: 48px;
    --input-min-height: 48px;
  }
  h1 { --font-scale-h1: 3rem; }
  h2 { --font-scale-h2: 2.7rem; }
  h3 { --font-scale-h3: 2.4rem; }
  h4 { --font-scale-h4: 2.1rem; }
  h5 { --font-scale-h5: 1.8rem; }
  h6 { --font-scale-h6: 1.5rem; }
}

/* ----- Breakpoint: 700px – 750px | Large Screens ----- */
@media only screen and (min-width: 700px) and (max-width: 750px) {
  :root {
    --font-base: 15.5px;
    --spacing-unit: 6px;
    --container-max: 720px;
    --border-radius-base: 6px;
    --button-min-height: 48px;
    --input-min-height: 48px;
  }
  h1 { --font-scale-h1: 3.1rem; }
  h2 { --font-scale-h2: 2.8rem; }
  h3 { --font-scale-h3: 2.5rem; }
  h4 { --font-scale-h4: 2.2rem; }
  h5 { --font-scale-h5: 1.9rem; }
  h6 { --font-scale-h6: 1.6rem; }
}

/* ----- Breakpoint: 750px – 800px | Large+ Screens ----- */
@media only screen and (min-width: 750px) and (max-width: 800px) {
  :root {
    --font-base: 16px;
    --spacing-unit: 7px;
    --container-max: 760px;
    --border-radius-base: 7px;
    --button-min-height: 50px;
    --input-min-height: 50px;
  }
  h1 { --font-scale-h1: 3.2rem; }
  h2 { --font-scale-h2: 2.9rem; }
  h3 { --font-scale-h3: 2.6rem; }
  h4 { --font-scale-h4: 2.3rem; }
  h5 { --font-scale-h5: 2rem; }
  h6 { --font-scale-h6: 1.7rem; }
}

/* ----- Breakpoint: 800px – 850px | XL- Screens ----- */
@media only screen and (min-width: 800px) and (max-width: 850px) {
  :root {
    --font-base: 16.5px;
    --spacing-unit: 7px;
    --container-max: 820px;
    --border-radius-base: 7px;
    --button-min-height: 50px;
    --input-min-height: 50px;
  }
  h1 { --font-scale-h1: 3.3rem; }
  h2 { --font-scale-h2: 3rem; }
  h3 { --font-scale-h3: 2.7rem; }
  h4 { --font-scale-h4: 2.4rem; }
  h5 { --font-scale-h5: 2.1rem; }
  h6 { --font-scale-h6: 1.8rem; }
}

/* ----- Breakpoint: 850px – 900px | XL Screens ----- */
@media only screen and (min-width: 850px) and (max-width: 900px) {
  :root {
    --font-base: 17px;
    --spacing-unit: 8px;
    --container-max: 860px;
    --border-radius-base: 8px;
    --button-min-height: 52px;
    --input-min-height: 52px;
  }
  h1 { --font-scale-h1: 3.4rem; }
  h2 { --font-scale-h2: 3.1rem; }
  h3 { --font-scale-h3: 2.8rem; }
  h4 { --font-scale-h4: 2.5rem; }
  h5 { --font-scale-h5: 2.2rem; }
  h6 { --font-scale-h6: 1.9rem; }
}

/* ----- Breakpoint: 900px – 950px | XL+ Screens ----- */
@media only screen and (min-width: 900px) and (max-width: 950px) {
  :root {
    --font-base: 17.5px;
    --spacing-unit: 8px;
    --container-max: 920px;
    --border-radius-base: 8px;
    --button-min-height: 52px;
    --input-min-height: 52px;
  }
  h1 { --font-scale-h1: 3.5rem; }
  h2 { --font-scale-h2: 3.2rem; }
  h3 { --font-scale-h3: 2.9rem; }
  h4 { --font-scale-h4: 2.6rem; }
  h5 { --font-scale-h5: 2.3rem; }
  h6 { --font-scale-h6: 2rem; }
}

/* ----- Breakpoint: 950px – 1000px | 2XL- Screens ----- */
@media only screen and (min-width: 950px) and (max-width: 1000px) {
  :root {
    --font-base: 17.5px;
    --spacing-unit: 9px;
    --container-max: 960px;
    --border-radius-base: 9px;
    --button-min-height: 54px;
    --input-min-height: 54px;
  }
  h1 { --font-scale-h1: 3.5rem; }
  h2 { --font-scale-h2: 3.2rem; }
  h3 { --font-scale-h3: 2.9rem; }
  h4 { --font-scale-h4: 2.6rem; }
  h5 { --font-scale-h5: 2.3rem; }
  h6 { --font-scale-h6: 2rem; }
}

/* ----- Breakpoint: 1000px – 1050px | 2XL Screens ----- */
@media only screen and (min-width: 1000px) and (max-width: 1050px) {
  :root {
    --font-base: 18px;
    --spacing-unit: 9px;
    --container-max: 1000px;
    --border-radius-base: 9px;
    --button-min-height: 54px;
    --input-min-height: 54px;
  }
  h1 { --font-scale-h1: 3.6rem; }
  h2 { --font-scale-h2: 3.3rem; }
  h3 { --font-scale-h3: 3rem; }
  h4 { --font-scale-h4: 2.7rem; }
  h5 { --font-scale-h5: 2.4rem; }
  h6 { --font-scale-h6: 2.1rem; }
}

/* ----- Breakpoint: 1050px – 1100px | 2XL+ Screens ----- */
@media only screen and (min-width: 1050px) and (max-width: 1100px) {
  :root {
    --font-base: 18px;
    --spacing-unit: 10px;
    --container-max: 1040px;
    --border-radius-base: 10px;
    --button-min-height: 56px;
    --input-min-height: 56px;
  }
  h1 { --font-scale-h1: 3.6rem; }
  h2 { --font-scale-h2: 3.3rem; }
  h3 { --font-scale-h3: 3rem; }
  h4 { --font-scale-h4: 2.7rem; }
  h5 { --font-scale-h5: 2.4rem; }
  h6 { --font-scale-h6: 2.1rem; }
}

/* ----- Breakpoint: 1100px – 1150px | 3XL- Screens ----- */
@media only screen and (min-width: 1100px) and (max-width: 1150px) {
  :root {
    --font-base: 18.5px;
    --spacing-unit: 10px;
    --container-max: 1100px;
    --border-radius-base: 10px;
    --button-min-height: 56px;
    --input-min-height: 56px;
  }
  h1 { --font-scale-h1: 3.7rem; }
  h2 { --font-scale-h2: 3.4rem; }
  h3 { --font-scale-h3: 3.1rem; }
  h4 { --font-scale-h4: 2.8rem; }
  h5 { --font-scale-h5: 2.5rem; }
  h6 { --font-scale-h6: 2.2rem; }
}

/* ----- Breakpoint: 1150px – 1200px | 3XL Screens ----- */
@media only screen and (min-width: 1150px) and (max-width: 1200px) {
  :root {
    --font-base: 18.5px;
    --spacing-unit: 11px;
    --container-max: 1140px;
    --border-radius-base: 11px;
    --button-min-height: 58px;
    --input-min-height: 58px;
  }
  h1 { --font-scale-h1: 3.7rem; }
  h2 { --font-scale-h2: 3.4rem; }
  h3 { --font-scale-h3: 3.1rem; }
  h4 { --font-scale-h4: 2.8rem; }
  h5 { --font-scale-h5: 2.5rem; }
  h6 { --font-scale-h6: 2.2rem; }
}

/* ----- Breakpoint: 1200px+ | 4XL and larger (up to 2560px+) ----- */
@media only screen and (min-width: 1200px) {
  :root {
    --font-base: 19px;
    --spacing-unit: 12px;
    --container-max: 1400px;  /* wider for large screens, can be adjusted */
    --border-radius-base: 12px;
    --button-min-height: 60px;
    --input-min-height: 60px;
  }
  h1 { --font-scale-h1: 4rem; }
  h2 { --font-scale-h2: 3.5rem; }
  h3 { --font-scale-h3: 3rem; }
  h4 { --font-scale-h4: 2.5rem; }
  h5 { --font-scale-h5: 2rem; }
  h6 { --font-scale-h6: 1.5rem; }
  .container {
    max-width: var(--container-max);
  }
}

/* Extra large TVs: we can cap container width for readability */
@media only screen and (min-width: 1800px) {
  :root {
    --container-max: 1600px;
  }
}

@media only screen and (min-width: 2200px) {
  :root {
    --container-max: 1800px;
  }
}

/* ===== ACCESSIBILITY & UTILITIES ===== */
.visually-hidden:not(:focus):not(:active) {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  border: 0;
  padding: 0;
  white-space: nowrap;
  clip-path: inset(100%);
  clip: rect(0 0 0 0);
  overflow: hidden;
}

/* Focus styles for keyboard navigation */
:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* Prevent horizontal overflow */
html, body {
  overflow-x: hidden;
}

/* Ensure all interactive elements have sufficient contrast */
::selection {
  background: var(--color-primary);
  color: white;
}
</style>
