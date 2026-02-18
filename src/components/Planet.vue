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

const props = defineProps<{
  imageUrl?: string
  courseName: string
  width: number
  height: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)

let scene: any
let camera: any
let renderer: any
let sphere: any
let animationFrame: number

// Convert absolute media URLs to local proxy URLs (development only)
function getProxiedUrl(url: string): string {
  if (!url) return url
  if (import.meta.env.DEV) {
    // Match both http:// and https:// versions of the media domains
    const media1Pattern = /^https?:\/\/selfstudymedia1\.pythonanywhere\.com/
    const media2Pattern = /^https?:\/\/selfstudymedia2\.pythonanywhere\.com/
    if (media1Pattern.test(url)) {
      return url.replace(media1Pattern, '/media1')
    }
    if (media2Pattern.test(url)) {
      return url.replace(media2Pattern, '/media2')
    }
  }
  return url
}

// Simple hash function to get a number from a string
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// Generate a unique hue (0-360) based on course name
function getHueFromName(name: string): number {
  if (!name) return 0
  return hashString(name) % 360
}

// Generate a canvas texture with course name and a unique gradient
function generateNameTexture(name: string): any {
  const THREE = window.THREE
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

  // Deterministic stars
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

// Check if a loaded texture is the fallback 1x1 transparent image
function isFallbackImage(texture: any): boolean {
  const img = texture.image
  if (!img) return false
  return img.width === 1 && img.height === 1
}

// Load image texture, fallback to generated texture on error or if fallback detected
function loadImageTexture(url: string): Promise<any> {
  const THREE = window.THREE
  const proxiedUrl = getProxiedUrl(url)

  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'
    loader.load(
      proxiedUrl,
      (texture) => {
        if (isFallbackImage(texture)) {
          resolve(generateNameTexture(props.courseName))
        } else {
          resolve(texture)
        }
      },
      undefined,
      () => resolve(generateNameTexture(props.courseName))
    )
  })
}

async function initPlanet() {
  if (!canvas.value) return
  const THREE = window.THREE
  const { width, height } = props

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

  // If no imageUrl, use generated texture immediately (no attempt to load)
  const texture = props.imageUrl
    ? await loadImageTexture(props.imageUrl)
    : generateNameTexture(props.courseName)

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
  if (animationFrame) cancelAnimationFrame(animationFrame)
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss?.()
  }
  if (scene) {
    scene.traverse((obj: any) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material))
          obj.material.forEach((m: any) => m.dispose())
        else obj.material.dispose()
      }
    })
  }
}

onMounted(() => {
  initPlanet()
})

onUnmounted(() => {
  cleanup()
})

watch(
  () => [props.imageUrl, props.courseName],
  () => {
    cleanup()
    initPlanet()
  }
)
</script>

<style scoped>
.planet-canvas {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
