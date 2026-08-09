<template>
  <div ref="container" class="three-background" aria-hidden="true"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { useThemeStore } from '@/store/theme'
import type { GalaxyPalette, ThemeMode } from '@/theme/themes'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DeviceTier = 'low' | 'medium' | 'high' | 'ultra'

interface PlanetData {
  name: string
  color: string
  size: number
  hasRing: boolean
}

interface PlanetInstance {
  group: THREE.Group
  sphere: THREE.Mesh
  ring?: THREE.Mesh
  speed: number
  rotSpeed: number
}

// ---------------------------------------------------------------------------
// Tier configuration — heavily tuned for low memory & CPU usage
// ---------------------------------------------------------------------------
const TIER_CONFIG = {
  low: {
    planetCount: 3,
    planetSegments: 16,
    starCount: 600,
    galaxyCount: 1500,
    pixelRatio: 1,
    antialias: false,
    fpsCap: 30,
  },
  medium: {
    planetCount: 5,
    planetSegments: 24,
    starCount: 1200,
    galaxyCount: 3500,
    pixelRatio: 1.25,
    antialias: false,
    fpsCap: 60,
  },
  high: {
    planetCount: 6,
    planetSegments: 32,
    starCount: 2000,
    galaxyCount: 6000,
    pixelRatio: 1.5,
    antialias: true,
    fpsCap: 60,
  },
  ultra: {
    planetCount: 8,
    planetSegments: 32,
    starCount: 3000,
    galaxyCount: 9000,
    pixelRatio: 1.5,
    antialias: true,
    fpsCap: 60,
  },
} as const

// Curated planet list (only 8, smaller memory footprint)
const PLANET_DATA: PlanetData[] = [
  { name: 'Python',     color: '#3776AB', size: 0.9, hasRing: false },
  { name: 'JavaScript', color: '#F7DF1E', size: 1.1, hasRing: true  },
  { name: 'AWS',        color: '#FF9900', size: 1.2, hasRing: true  },
  { name: 'Docker',     color: '#2496ED', size: 0.9, hasRing: false },
  { name: 'Vue',        color: '#41B883', size: 1.0, hasRing: false },
  { name: 'K8s',        color: '#326CE5', size: 1.1, hasRing: true  },
  { name: 'Azure',      color: '#0089D6', size: 1.0, hasRing: false },
  { name: 'GCP',        color: '#4285F4', size: 1.0, hasRing: true  },
]

// ---------------------------------------------------------------------------
// Refs / State
// ---------------------------------------------------------------------------
const container = ref<HTMLElement | null>(null)
const themeStore = useThemeStore()

/**
 * The scene's colours come from the active theme, which is what makes the ten
 * themes ten GALAXIES rather than ten button colours. `palette` and `mode` are
 * read once per build and then used everywhere a literal used to be.
 */
let palette: GalaxyPalette = themeStore.theme.galaxy
let mode: ThemeMode = themeStore.theme.mode

/**
 * Additive blending is what makes a star field glow — each particle ADDS light
 * to what is behind it. Over a pale sky that saturates to white almost at
 * once, so on the three light galaxies the particles are composited normally
 * and drawn in colours darker than the sky instead. Without this switch a
 * light theme's background is a blank sheet of paper.
 */
const blending = () => (mode === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let clock: THREE.Clock
let rafId = 0

let tier: DeviceTier = 'medium'
let config: typeof TIER_CONFIG.low
let frameInterval = 1000 / 60
let lastFrame = 0

let planets: PlanetInstance[] = []
let starField: THREE.Points | null = null
let galaxy: THREE.Points | null = null
let galaxyCore: THREE.Sprite | null = null

// IO + visibility
let isRunning = true
let intersectionObserver: IntersectionObserver | null = null

// Disposables
const disposables: Array<{ dispose: () => void }> = []

// Time (single source of truth)
let elapsed = 0

// ---------------------------------------------------------------------------
// Device detection
// ---------------------------------------------------------------------------
function detectTier(): DeviceTier {
  const ua = navigator.userAgent
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const cores = navigator.hardwareConcurrency || 2
  const mem = (navigator as any).deviceMemory || 4 // GB, Chrome only
  const w = window.innerWidth

  if (isMobile || cores <= 2 || mem <= 2 || w < 600) return 'low'
  if (cores <= 4 || mem <= 4 || w < 1024)            return 'medium'
  if (w >= 2560)                                      return 'high'   // 4K/TV → balanced
  return 'ultra'
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch { return false }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function track<T extends { dispose: () => void }>(o: T): T {
  disposables.push(o); return o
}

// ---------------------------------------------------------------------------
// Star field — GPU shader based (no canvas textures, very low memory)
// ---------------------------------------------------------------------------
function createStarField(): void {
  const count = config.starCount
  const positions = new Float32Array(count * 3)
  const colors    = new Float32Array(count * 3)
  const sizes     = new Float32Array(count)
  const phases    = new Float32Array(count)
  const starTint  = new THREE.Color(palette.star)

  for (let i = 0; i < count; i++) {
    // Spread on a big sphere
    const r = 250 + Math.random() * 450
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)

    /*
      Star colour temperature, tinted toward the galaxy's own light.
      The physical distribution is kept — mostly blue-white main sequence,
      some yellow, a few orange, the odd red giant — and then pulled 45%
      toward the theme's star colour. Replacing the distribution outright
      would give ten fields of one flat colour; leaving it alone would give
      ten identical fields. The blend is what makes Sombrero's sky read as
      gold and Whirlpool's as green while both still look like stars.
    */
    const t = Math.random()
    let sr: number, sg: number, sb: number
    if (t < 0.6) {        // white-blue main sequence
      sr = 0.85; sg = 0.9;  sb = 1.0
    } else if (t < 0.85) {// yellow
      sr = 1.0;  sg = 0.95; sb = 0.75
    } else if (t < 0.95) {// orange
      sr = 1.0;  sg = 0.7;  sb = 0.5
    } else {              // red giants (rare)
      sr = 1.0;  sg = 0.5;  sb = 0.4
    }
    colors[i * 3]     = sr + (starTint.r - sr) * 0.45
    colors[i * 3 + 1] = sg + (starTint.g - sg) * 0.45
    colors[i * 3 + 2] = sb + (starTint.b - sb) * 0.45

    sizes[i]  = 0.5 + Math.random() * 2.0
    phases[i] = Math.random() * Math.PI * 2
  }

  const geom = track(new THREE.BufferGeometry())
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geom.setAttribute('color',    new THREE.BufferAttribute(colors, 3))
  geom.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1))
  geom.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1))

  const mat = track(new THREE.ShaderMaterial({
    uniforms: {
      uTime:   { value: 0 },
      uPxRatio:{ value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uTime;
      uniform float uPxRatio;
      void main() {
        vColor = color;
        vTwinkle = 0.6 + 0.4 * sin(uTime * 1.5 + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPxRatio * (300.0 / -mv.z);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        // soft round star with bright core
        float core = exp(-d * 12.0);
        float halo = exp(-d * 3.0) * 0.4;
        float a = (core + halo) * vTwinkle;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: blending(),
    vertexColors: true,
  }))

  starField = new THREE.Points(geom, mat)
  scene.add(starField)
}

// ---------------------------------------------------------------------------
// Realistic Spiral Galaxy — log spiral with 4 arms, bulge & halo
// ---------------------------------------------------------------------------
function createGalaxy(): void {
  const count = config.galaxyCount
  const positions = new Float32Array(count * 3)
  const colors    = new Float32Array(count * 3)
  const sizes     = new Float32Array(count)

  const ARMS = 4
  const ARM_SEPARATION = (Math.PI * 2) / ARMS
  const SPIN = 1.2          // how tightly wound (smaller = looser)
  const RADIUS = 130
  const RANDOMNESS = 0.35

  // Colour gradient, core → disc → arm tips. Four of the theme's five galaxy
  // colours; the fifth (star) belongs to the field around the camera.
  const insideColor  = new THREE.Color(palette.core)
  const middleColor  = new THREE.Color(palette.inner)
  const outsideColor = new THREE.Color(palette.outer)
  const discColor    = new THREE.Color(palette.mid)

  for (let i = 0; i < count; i++) {
    let r: number, isHalo = false, isBulge = false

    const roll = Math.random()
    if (roll < 0.15) {                // 15% bulge
      r = Math.pow(Math.random(), 2.0) * 25
      isBulge = true
    } else if (roll < 0.92) {          // disk + arms
      r = Math.pow(Math.random(), 0.7) * RADIUS
    } else {                           // 8% halo
      r = 30 + Math.pow(Math.random(), 0.5) * (RADIUS * 1.4)
      isHalo = true
    }

    const branchAngle = (i % ARMS) * ARM_SEPARATION
    const spinAngle   = Math.log(r + 1) * SPIN

    // Random scatter — tighter at center, wider at edges
    const scatter = RANDOMNESS * (r / RADIUS) * 0.8 + 0.05
    const rx = (Math.random() - 0.5) * scatter * r * 0.5
    const ry = (Math.random() - 0.5) * scatter * r * (isBulge ? 0.6 : 0.15) // disk thinness
    const rz = (Math.random() - 0.5) * scatter * r * 0.5

    let angle = branchAngle + spinAngle
    if (isHalo) angle = Math.random() * Math.PI * 2

    positions[i * 3]     = Math.cos(angle) * r + rx
    positions[i * 3 + 1] = ry
    positions[i * 3 + 2] = Math.sin(angle) * r + rz

    // Colour: core → inner → disc → arm tips.
    const tColor = Math.min(r / RADIUS, 1.0)
    const c = new THREE.Color()
    if (tColor < 0.3)      c.copy(insideColor).lerp(middleColor, tColor / 0.3)
    else if (tColor < 0.6) c.copy(middleColor).lerp(discColor, (tColor - 0.3) / 0.3)
    else                   c.copy(discColor).lerp(outsideColor, (tColor - 0.6) / 0.4)
    // On a light sky, dimming a halo particle moves it TOWARD the background
    // and it disappears; it has to be darkened relative to the sky instead,
    // which for a normally-blended particle means lowering the value.
    if (isHalo) c.multiplyScalar(mode === 'dark' ? 0.55 : 0.75)

    colors[i * 3]     = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b

    sizes[i] = (isBulge ? 1.4 : 0.8) + Math.random() * 1.0
  }

  const geom = track(new THREE.BufferGeometry())
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geom.setAttribute('color',    new THREE.BufferAttribute(colors, 3))
  geom.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1))

  const mat = track(new THREE.ShaderMaterial({
    uniforms: {
      uPxRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float aSize;
      varying vec3 vColor;
      uniform float uPxRatio;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPxRatio * (260.0 / -mv.z);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float a = exp(-d * 8.0);
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: blending(),
    vertexColors: true,
  }))

  galaxy = new THREE.Points(geom, mat)
  galaxy.position.set(-80, -40, -350)
  galaxy.rotation.x = -Math.PI / 6
  galaxy.rotation.z =  Math.PI / 8
  scene.add(galaxy)

  // Bright bloom core sprite (procedural, no texture upload). Drawn from the
  // theme's core and inner colours so the brightest thing on screen is the one
  // that most identifies the galaxy.
  const coreCanvas = document.createElement('canvas')
  coreCanvas.width = coreCanvas.height = 128
  const ctx = coreCanvas.getContext('2d')!
  const core = new THREE.Color(palette.core)
  const inner = new THREE.Color(palette.inner)
  const rgb = (c: THREE.Color) =>
    `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0,   `rgba(${rgb(core)},1)`)
  grad.addColorStop(0.3, `rgba(${rgb(core)},0.6)`)
  grad.addColorStop(0.7, `rgba(${rgb(inner)},0.15)`)
  grad.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128)
  const tex = track(new THREE.CanvasTexture(coreCanvas))

  const coreMat = track(new THREE.SpriteMaterial({
    map: tex,
    blending: blending(),
    depthWrite: false,
    transparent: true,
    // Normally blended, the bloom would be an opaque disc; on a light sky it
    // is a soft glow instead.
    opacity: mode === 'dark' ? 1 : 0.5,
  }))
  galaxyCore = new THREE.Sprite(coreMat)
  galaxyCore.scale.set(35, 35, 1)
  galaxyCore.position.copy(galaxy.position)
  scene.add(galaxyCore)
}

// ---------------------------------------------------------------------------
// Planets — minimal & efficient
// ---------------------------------------------------------------------------
function createPlanetTexture(data: PlanetData): THREE.CanvasTexture {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!

  // Base
  const g = ctx.createLinearGradient(0, 0, size, size)
  g.addColorStop(0, data.color)
  g.addColorStop(1, '#000000')
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size)

  // Noise / craters (light)
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 18 + 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // Label
  ctx.font = `bold ${Math.floor(size * 0.16)}px system-ui, Arial`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)'
  ctx.strokeText(data.name, size / 2, size / 2)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(data.name, size / 2, size / 2)

  return track(new THREE.CanvasTexture(c))
}

function createPlanets(): void {
  const ringTexCanvas = document.createElement('canvas')
  ringTexCanvas.width = 64; ringTexCanvas.height = 8
  const rctx = ringTexCanvas.getContext('2d')!
  const rg = rctx.createLinearGradient(0, 0, 64, 0)
  rg.addColorStop(0, 'rgba(255,255,255,0.0)')
  rg.addColorStop(0.5, 'rgba(220,200,170,0.7)')
  rg.addColorStop(1, 'rgba(255,255,255,0.0)')
  rctx.fillStyle = rg; rctx.fillRect(0, 0, 64, 8)
  const ringTex = track(new THREE.CanvasTexture(ringTexCanvas))

  const used = PLANET_DATA.slice(0, config.planetCount)

  used.forEach((data, i) => {
    const group = new THREE.Group()

    const geom = track(new THREE.SphereGeometry(data.size, config.planetSegments, config.planetSegments))
    const mat  = track(new THREE.MeshLambertMaterial({
      map: createPlanetTexture(data),
      emissive: 0x111122,
      emissiveIntensity: 0.25,
    }))
    const sphere = new THREE.Mesh(geom, mat)
    group.add(sphere)

    let ring: THREE.Mesh | undefined
    if (data.hasRing) {
      const rGeom = track(new THREE.RingGeometry(data.size * 1.4, data.size * 1.95, 48))
      const rMat  = track(new THREE.MeshBasicMaterial({
        map: ringTex, side: THREE.DoubleSide, transparent: true, opacity: 0.7,
      }))
      ring = new THREE.Mesh(rGeom, rMat)
      ring.rotation.x = Math.PI / 2.2
      ring.rotation.z = 0.3
      group.add(ring)
    }

    // Distribute around camera, on a big tube
    const a = (i / used.length) * Math.PI * 2 + Math.random() * 0.4
    const radius = 18 + Math.random() * 30
    group.position.set(
      Math.cos(a) * radius,
      (Math.random() - 0.5) * 18,
      -60 - Math.random() * 220,
    )
    scene.add(group)

    planets.push({
      group, sphere, ring,
      speed: 0.05 + Math.random() * 0.08,
      rotSpeed: 0.15 + Math.random() * 0.25,
    })
  })
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
/**
 * No WebGL, or the visitor asked for no motion. Still themed: this is what a
 * low-end phone and anyone with `prefers-reduced-motion` actually sees, so it
 * has to be the right galaxy rather than a fixed indigo one.
 */
function showFallback() {
  if (container.value) {
    container.value.style.background =
      `radial-gradient(ellipse at center, ${palette.outer} 0%, ${palette.space} 70%)`
  }
}

function init(): boolean {
  palette = themeStore.theme.galaxy
  mode = themeStore.theme.mode

  if (!hasWebGL()) { showFallback(); return false }

  tier = detectTier()
  config = TIER_CONFIG[tier]
  frameInterval = 1000 / config.fpsCap

  try {
    scene = new THREE.Scene()
    const space = new THREE.Color(palette.space)
    scene.background = space
    // The fog is the same colour as the sky, which is what makes distant
    // particles fade out rather than pile up into a bright band at the horizon.
    scene.fog = new THREE.FogExp2(space.getHex(), 0.0014)

    const w = window.innerWidth, h = window.innerHeight
    camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 1500)
    camera.position.set(0, 2, 0)

    renderer = new THREE.WebGLRenderer({
      antialias: config.antialias,
      alpha: false,
      powerPreference: tier === 'low' ? 'low-power' : 'high-performance',
      precision: tier === 'low' ? 'mediump' : 'highp',
      stencil: false,
      depth: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.pixelRatio))
    renderer.setSize(w, h, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.value!.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'

    // Lights — minimal but effective. The ambient half is the galaxy's own
    // mid tone so the planets pick up the sky they are floating in, and the
    // key light is the theme's, which is what stops a warm galaxy having
    // cold-lit planets in it.
    scene.add(new THREE.HemisphereLight(
      new THREE.Color(palette.mid).getHex(),
      new THREE.Color(palette.space).getHex(),
      mode === 'dark' ? 0.7 : 1.1,
    ))
    const dir = new THREE.DirectionalLight(new THREE.Color(palette.light).getHex(), 1.0)
    dir.position.set(3, 5, 4)
    scene.add(dir)

    createStarField()
    createGalaxy()
    createPlanets()

    clock = new THREE.Clock()

    window.addEventListener('resize', onResizeDebounced, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    renderer.domElement.addEventListener('webglcontextlost', onContextLost as any, false)

    // Pause if container scrolled out of view
    if ('IntersectionObserver' in window && container.value) {
      intersectionObserver = new IntersectionObserver(entries => {
        isRunning = entries[0].isIntersecting && !document.hidden
      })
      intersectionObserver.observe(container.value)
    }

    return true
  } catch (err) {
    console.warn('[AnimatedBackground] init failed:', err)
    showFallback()
    return false
  }
}

// ---------------------------------------------------------------------------
// Animation loop — FPS capped
// ---------------------------------------------------------------------------
function animate(now = 0) {
  rafId = requestAnimationFrame(animate)
  if (!isRunning) return

  const since = now - lastFrame
  if (since < frameInterval) return
  lastFrame = now - (since % frameInterval)

  const delta = Math.min(clock.getDelta(), 0.05)
  elapsed += delta

  // Subtle camera sway
  camera.position.x = Math.sin(elapsed * 0.15) * 1.2
  camera.position.y = 2 + Math.sin(elapsed * 0.22) * 0.25
  camera.lookAt(0, 2, -10)

  // Star shader uniform
  if (starField) {
    (starField.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed
    starField.rotation.y = elapsed * 0.005
  }

  // Galaxy slow rotation
  if (galaxy) galaxy.rotation.y += delta * 0.04

  // Planets — drift + rotate; recycle positions when behind camera
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i]
    p.group.position.z += p.speed
    p.sphere.rotation.y += p.rotSpeed * delta
    if (p.group.position.z > 25) {
      p.group.position.z = -260 - Math.random() * 180
      p.group.position.x = (Math.random() - 0.5) * 70
      p.group.position.y = (Math.random() - 0.5) * 25
    }
  }

  renderer.render(scene, camera)
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function onResize() {
  if (!renderer || !camera) return
  const w = window.innerWidth, h = window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}

function debounce<T extends (...args: any[]) => void>(fn: T, wait: number): T {
  let t: number | undefined
  return ((...args: any[]) => {
    if (t) clearTimeout(t)
    t = window.setTimeout(() => fn(...args), wait)
  }) as T
}
const onResizeDebounced = debounce(onResize, 200)

function onVisibility() {
  isRunning = !document.hidden
}

function onContextLost(e: Event) {
  e.preventDefault()
  cancelAnimationFrame(rafId)
  rafId = 0
}

// ---------------------------------------------------------------------------
// Teardown — also used between galaxies, not only on unmount
// ---------------------------------------------------------------------------
function teardown(): void {
  cancelAnimationFrame(rafId)
  rafId = 0
  isRunning = false

  window.removeEventListener('resize', onResizeDebounced)
  document.removeEventListener('visibilitychange', onVisibility)
  intersectionObserver?.disconnect()
  intersectionObserver = null

  // Dispose every tracked resource
  for (const d of disposables) {
    try { d.dispose() } catch { /* ignore */ }
  }
  disposables.length = 0
  planets.length = 0
  starField = null
  galaxy = null
  galaxyCore = null

  if (renderer) {
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost as any)
    renderer.dispose()
    renderer.forceContextLoss?.()
    renderer.domElement.parentNode?.removeChild(renderer.domElement)
    renderer = undefined as any
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
onMounted(() => {
  if (prefersReducedMotion()) { showFallback(); return }
  if (init()) animate()
})

/*
  Switching galaxy rebuilds the scene rather than recolouring it in place.

  Colour is baked into a BufferAttribute per particle and into two procedural
  canvas textures, so "recolour" would mean rewriting ~12000 floats, both
  textures and three materials' blend modes — most of a rebuild, with a second
  code path that only runs on a theme change and would therefore be the one
  nobody notices is broken. A rebuild reuses the path that runs on every page
  load, and it happens once per deliberate click.

  `teardown()` disposes everything first: without it, ten theme changes leak
  ten WebGL contexts and the browser silently drops the oldest, which appears
  as the background vanishing rather than as an error.
*/
watch(() => themeStore.themeId, () => {
  if (prefersReducedMotion()) {
    palette = themeStore.theme.galaxy
    showFallback()
    return
  }
  teardown()
  elapsed = 0
  lastFrame = 0
  isRunning = true
  if (init()) animate()
})

onBeforeUnmount(teardown)
</script>

<style scoped>
/* ---------------------------------------------------------------
   The canvas wrapper — fixed, fully responsive, behind everything
   --------------------------------------------------------------- */
.three-background {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh; /* mobile-safe viewport */
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background: radial-gradient(
    ellipse at center,
    var(--sfs-surface-2, #0a0a1f) 0%,
    var(--sfs-space, #03030f) 70%
  );
  /* keep canvas crisp on every device */
  contain: strict;
  will-change: transform;
}

.three-background :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

/* Respect users who prefer no motion */
@media (prefers-reduced-motion: reduce) {
  .three-background :deep(canvas) {
    display: none;
  }
}
</style>