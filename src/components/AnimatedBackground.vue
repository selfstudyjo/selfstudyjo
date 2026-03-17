<template>
  <div ref="container" class="three-background"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

// ----------------------------------------------------------------------------
// Types & Configuration
// ----------------------------------------------------------------------------

type DeviceTier = 'low' | 'medium' | 'high'

interface PlanetData {
  name: string
  color: string
  size: number
  hasRing: boolean
}

interface PlanetInstance {
  group: THREE.Group
  sphere: THREE.Mesh
  glow?: THREE.Mesh
  ring?: THREE.Mesh
  light?: THREE.PointLight
  speed: number
  radius: number
  angle: number
  height: number
  initialZ: number
  rotSpeed: number
  active: boolean
}

interface StarLayer {
  points: THREE.Points
  baseOpacity: number
  speed: number
  offset: number
}

interface NebulaInstance {
  group: THREE.Group
  planes: THREE.Mesh[]
  baseOpacity: number
  speed: number
  offset: number
  active: boolean
}

// Tier‑specific configuration (will be set after device detection)
const TIER_CONFIG = {
  low: {
    planetCount: 6,
    planetSegments: 16,
    starCount: 1500,
    galaxyCount: 2000,
    nebulaCount: 2,
    textureSize: 256,
    pixelRatio: 1.5,
    precision: 'mediump' as THREE.WebGLRendererParameters['precision'],
    powerPreference: 'low-power' as WebGLPowerPreference,
  },
  medium: {
    planetCount: 10,
    planetSegments: 32,
    starCount: 3000,
    galaxyCount: 4000,
    nebulaCount: 4,
    textureSize: 512,
    pixelRatio: 2,
    precision: 'highp' as THREE.WebGLRendererParameters['precision'],
    powerPreference: 'default' as WebGLPowerPreference,
  },
  high: {
    planetCount: 18,
    planetSegments: 64,
    starCount: 5000,
    galaxyCount: 8000,
    nebulaCount: 6,
    textureSize: 1024,
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    precision: 'highp' as THREE.WebGLRendererParameters['precision'],
    powerPreference: 'high-performance' as WebGLPowerPreference,
  },
}

// Static planet data (max 18)
const PLANET_DATA: PlanetData[] = [
  { name: 'Python', color: '#3776AB', size: 0.9, hasRing: false },
  { name: 'Java', color: '#007396', size: 1.0, hasRing: true },
  { name: 'CSS', color: '#1572B6', size: 0.8, hasRing: false },
  { name: 'JavaScript', color: '#F7DF1E', size: 1.1, hasRing: true },
  { name: 'Computer Science', color: '#8A2BE2', size: 1.2, hasRing: false },
  { name: 'Math', color: '#FF6B6B', size: 0.8, hasRing: true },
  { name: 'Self Study', color: '#4ECDC4', size: 1.0, hasRing: false },
  { name: 'Django', color: '#092E20', size: 0.9, hasRing: false },
  { name: 'Flask', color: '#000000', size: 0.8, hasRing: true },
  { name: 'IONIC', color: '#3880FF', size: 1.0, hasRing: false },
  { name: 'HTML', color: '#E34F26', size: 0.9, hasRing: true },
  { name: 'Docker', color: '#2496ED', size: 0.9, hasRing: false },
  { name: 'Kubernetes', color: '#326CE5', size: 1.1, hasRing: true },
  { name: 'Virtualization', color: '#96CEB4', size: 0.9, hasRing: false },
  { name: 'AWS Cloud', color: '#FF9900', size: 1.2, hasRing: true },
  { name: 'Azure Cloud', color: '#0089D6', size: 1.1, hasRing: false },
  { name: 'Google Cloud', color: '#4285F4', size: 1.1, hasRing: true },
  { name: 'Web Scraping', color: '#45B7D1', size: 0.8, hasRing: false },
]

// ----------------------------------------------------------------------------
// Refs & State
// ----------------------------------------------------------------------------

const container = ref<HTMLElement | null>(null)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let clock: THREE.Clock
let animationId: number

// Tier & config
let tier: DeviceTier = 'high' // default, will be overridden
let config: typeof TIER_CONFIG.low

// Object pools
let planets: PlanetInstance[] = []
let starLayers: StarLayer[] = []
let galaxyPoints: THREE.Points
let nebulas: NebulaInstance[] = []

// Moving light
let travelingLight: THREE.PointLight

// Cache for generated textures
const textureCache = new Map<string, THREE.CanvasTexture>()

// Disposables tracker
const disposables: (THREE.Object3D | THREE.Material | THREE.Texture | THREE.Geometry)[] = []

// Time accumulator for camera sway
let time = 0

// Visibility handling
let isTabVisible = true

// ----------------------------------------------------------------------------
// Device Tier Detection
// ----------------------------------------------------------------------------

function getDeviceTier(): DeviceTier {
  const ua = navigator.userAgent
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const screenWidth = window.innerWidth
  const cores = navigator.hardwareConcurrency || 2
  const dpr = window.devicePixelRatio || 1

  if (isMobile || screenWidth < 768 || cores <= 2 || dpr <= 1) {
    return 'low'
  } else if (screenWidth < 1280 || cores <= 4) {
    return 'medium'
  } else {
    return 'high'
  }
}

// ----------------------------------------------------------------------------
// Helper: color utilities
// ----------------------------------------------------------------------------

function lightenColor(color: string, percent: number): string {
  const num = parseInt(color.slice(1), 16)
  const r = Math.min(255, (num >> 16) + percent)
  const g = Math.min(255, ((num >> 8) & 0x00ff) + percent)
  const b = Math.min(255, (num & 0x0000ff) + percent)
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

function darkenColor(color: string, percent: number): string {
  const num = parseInt(color.slice(1), 16)
  const r = Math.max(0, (num >> 16) - percent)
  const g = Math.max(0, ((num >> 8) & 0x00ff) - percent)
  const b = Math.max(0, (num & 0x0000ff) - percent)
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

// ----------------------------------------------------------------------------
// Texture Generators (with caching)
// ----------------------------------------------------------------------------

function createSoftTexture(color: string = 'white', size: number): THREE.CanvasTexture {
  const cacheKey = `soft_${color}_${size}`
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, color)
  gradient.addColorStop(0.4, color)
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.5)')
  gradient.addColorStop(0.8, 'rgba(255,255,255,0.2)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  textureCache.set(cacheKey, texture)
  disposables.push(texture)
  return texture
}

function createPlanetTexture(data: PlanetData, textureSize: number): THREE.CanvasTexture {
  const cacheKey = `planet_${data.name}_${textureSize}`
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!

  const canvas = document.createElement('canvas')
  canvas.width = textureSize
  canvas.height = textureSize
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  // Base gradient
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  grad.addColorStop(0, data.color)
  grad.addColorStop(0.5, lightenColor(data.color, 40))
  grad.addColorStop(1, darkenColor(data.color, 40))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Random craters / noise
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`
    ctx.beginPath()
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 30 + 5, 0, Math.PI * 2)
    ctx.fill()
  }

  // Name in large letters across the planet (will wrap)
  const fontSize = Math.floor(textureSize * 0.14) // scale font with texture size
  ctx.font = `Bold ${fontSize}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeStyle = 'white'
  ctx.lineWidth = Math.max(4, fontSize / 20)
  ctx.strokeText(data.name, canvas.width / 2, canvas.height / 2)
  ctx.fillStyle = 'white'
  ctx.fillText(data.name, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  textureCache.set(cacheKey, texture)
  disposables.push(texture)
  return texture
}

function createRingTexture(): THREE.CanvasTexture {
  const cacheKey = 'ring_gradient'
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!

  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
  gradient.addColorStop(0, 'rgba(255,255,255,0.8)')
  gradient.addColorStop(0.3, 'rgba(200,200,200,0.3)')
  gradient.addColorStop(0.7, 'rgba(200,200,200,0.3)')
  gradient.addColorStop(1, 'rgba(255,255,255,0.8)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  textureCache.set(cacheKey, texture)
  disposables.push(texture)
  return texture
}

function createGlowTexture(size: number): THREE.CanvasTexture {
  const cacheKey = `glow_${size}`
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.8)')
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.2)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  textureCache.set(cacheKey, texture)
  disposables.push(texture)
  return texture
}

// ----------------------------------------------------------------------------
// Scene Creation (pooling)
// ----------------------------------------------------------------------------

function createStars(): void {
  // Two layers: distant (small) and close (large)
  const layers = [
    { count: Math.floor(config.starCount * 0.7), size: 0.5, baseOpacity: 0.8, speed: 0.5, offset: 0 },
    { count: Math.floor(config.starCount * 0.3), size: 1.2, baseOpacity: 1.0, speed: 0.8, offset: Math.PI },
  ]

  layers.forEach((layer, idx) => {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(layer.count * 3)
    const colors = new Float32Array(layer.count * 3)

    for (let i = 0; i < layer.count; i++) {
      // Distribute in a large sphere
      const r = 200 + Math.random() * 400
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi) - 300

      // Color temperature
      const tint = Math.random() * 0.5 + 0.5
      colors[i * 3] = tint * (0.8 + 0.4 * Math.random())
      colors[i * 3 + 1] = tint * (0.7 + 0.4 * Math.random())
      colors[i * 3 + 2] = 1.0
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    disposables.push(geometry)

    const texture = createSoftTexture('white', 64)
    const material = new THREE.PointsMaterial({
      size: layer.size,
      map: texture,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
      opacity: layer.baseOpacity,
    })
    disposables.push(material)

    const points = new THREE.Points(geometry, material)
    scene.add(points)
    disposables.push(points)

    starLayers.push({
      points,
      baseOpacity: layer.baseOpacity,
      speed: layer.speed,
      offset: layer.offset,
    })
  })
}

function createGalaxy(): void {
  const geometry = new THREE.BufferGeometry()
  const count = config.galaxyCount
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    // Archimedean spiral: r = a + b * theta
    const a = 40
    const b = 2.5
    const theta = Math.random() * Math.PI * 6 // multiple turns
    const r = a + b * theta
    const angle = theta + (Math.random() - 0.5) * 0.5 // slight spread

    const x = Math.cos(angle) * r
    const y = (Math.random() - 0.5) * 15 * (r / 150) // thinner arms outward
    const z = Math.sin(angle) * r

    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z - 400

    // Color: core warmer, arms cooler
    if (r < 90) {
      colors[i * 3] = 1.0
      colors[i * 3 + 1] = 0.8
      colors[i * 3 + 2] = 0.6
    } else {
      colors[i * 3] = 0.6
      colors[i * 3 + 1] = 0.8
      colors[i * 3 + 2] = 1.0
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  disposables.push(geometry)

  const texture = createSoftTexture('white', 64)
  const material = new THREE.PointsMaterial({
    size: 0.7,
    map: texture,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    sizeAttenuation: true,
  })
  disposables.push(material)

  galaxyPoints = new THREE.Points(geometry, material)
  scene.add(galaxyPoints)
  disposables.push(galaxyPoints)

  // Add bright core sprite
  const coreTexture = createGlowTexture(128)
  const coreMaterial = new THREE.SpriteMaterial({ map: coreTexture, blending: THREE.AdditiveBlending, depthWrite: false })
  const coreSprite = new THREE.Sprite(coreMaterial)
  coreSprite.scale.set(40, 40, 1)
  coreSprite.position.set(0, 0, -400)
  scene.add(coreSprite)
  disposables.push(coreSprite, coreMaterial)
}

function createNebulae(): void {
  const colors = [0x6b2fa0, 0x1a6fbf, 0xbf1a6f, 0x1abf8a]
  const count = config.nebulaCount

  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length]
    const group = new THREE.Group()
    const planes: THREE.Mesh[] = []
    const baseOpacity = 0.03 + Math.random() * 0.04

    // Create 3 crossed planes
    for (let j = 0; j < 3; j++) {
      const geometry = new THREE.PlaneGeometry(80 + Math.random() * 40, 80 + Math.random() * 40)
      disposables.push(geometry)

      const texture = createSoftTexture(`#${color.toString(16).padStart(6, '0')}`, 128)
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: baseOpacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      disposables.push(material)

      const plane = new THREE.Mesh(geometry, material)
      // Rotate each plane differently
      if (j === 0) plane.rotation.y = 0
      else if (j === 1) plane.rotation.y = Math.PI / 3
      else plane.rotation.x = Math.PI / 2

      group.add(plane)
      planes.push(plane)
    }

    // Random position
    group.position.set(
      (Math.random() - 0.5) * 400,
      (Math.random() - 0.5) * 200,
      -300 - Math.random() * 300
    )

    scene.add(group)
    disposables.push(group)

    nebulas.push({
      group,
      planes,
      baseOpacity,
      speed: 0.3 + Math.random() * 0.2,
      offset: Math.random() * Math.PI * 2,
      active: true,
    })
  }
}

function createPlanets(): void {
  const maxCount = PLANET_DATA.length
  const activeCount = config.planetCount

  for (let i = 0; i < maxCount; i++) {
    const data = PLANET_DATA[i]
    const group = new THREE.Group()

    // Sphere with adaptive segments
    const geometry = new THREE.SphereGeometry(data.size, config.planetSegments, config.planetSegments)
    disposables.push(geometry)

    const texture = createPlanetTexture(data, config.textureSize)
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      emissive: 0x222222,
      roughness: 0.3,
      metalness: 0.2,
      emissiveIntensity: 0.1,
    })
    disposables.push(material)

    const sphere = new THREE.Mesh(geometry, material)
    sphere.castShadow = true
    sphere.receiveShadow = true
    group.add(sphere)

    // Atmospheric glow
    const glowGeo = new THREE.SphereGeometry(data.size * 1.15, 16, 16)
    disposables.push(glowGeo)
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x88aaff,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    })
    disposables.push(glowMat)
    const glow = new THREE.Mesh(glowGeo, glowMat)
    group.add(glow)

    // Ring (if hasRing)
    let ring: THREE.Mesh | undefined
    if (data.hasRing) {
      const ringGeo = new THREE.RingGeometry(data.size * 1.4, data.size * 2.0, 64)
      disposables.push(ringGeo)
      const ringMat = new THREE.MeshStandardMaterial({
        map: createRingTexture(),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
        emissive: 0x222222,
      })
      disposables.push(ringMat)
      ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = Math.PI / 2
      ring.rotation.z = 0.2
      group.add(ring)
    }

    // Local point light
    const light = new THREE.PointLight(0xffffff, 0.4, 20)
    light.position.set(0, 0, 0)
    group.add(light)

    // Initial random position
    const angle = Math.random() * Math.PI * 2
    const radius = 15 + Math.random() * 40
    const height = (Math.random() - 0.5) * 25
    group.position.x = Math.cos(angle) * radius
    group.position.y = height
    group.position.z = -100 - Math.random() * 200

    scene.add(group)
    disposables.push(group)

    planets.push({
      group,
      sphere,
      glow,
      ring,
      light,
      speed: 0.1 + Math.random() * 0.2,
      radius,
      angle,
      height,
      initialZ: group.position.z,
      rotSpeed: 0.005 + Math.random() * 0.01,
      active: i < activeCount, // only first activeCount are visible
    })

    // Set visibility based on active
    group.visible = i < activeCount
  }
}

function createTravelingLight(): void {
  travelingLight = new THREE.PointLight(0xffaa88, 1.0, 100)
  travelingLight.position.set(10, 5, -200)
  scene.add(travelingLight)
  disposables.push(travelingLight)
}

// ----------------------------------------------------------------------------
// Initialization
// ----------------------------------------------------------------------------

function init() {
  try {
    tier = getDeviceTier()
    config = TIER_CONFIG[tier]

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x03030f)
    scene.fog = new THREE.FogExp2(0x03030f, 0.0012)

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 2, 0)
    camera.lookAt(0, 2, -10)

    renderer = new THREE.WebGLRenderer({
      antialias: tier !== 'low',
      alpha: false,
      powerPreference: config.powerPreference,
      precision: config.precision,
    })
    renderer.setSize(window.innerWidth, window.innerHeight, false) // third arg false to avoid style override
    renderer.setPixelRatio(config.pixelRatio)
    renderer.shadowMap.enabled = tier === 'high' // shadows only on high-end
    container.value?.appendChild(renderer.domElement)

    // iOS Safari touch-action fix
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      renderer.domElement.style.touchAction = 'none'
    }

    // Lighting
    const hemisphereLight = new THREE.HemisphereLight(0x0a0a2e, 0x000005, 0.8)
    scene.add(hemisphereLight)

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2)
    dirLight.position.set(2, 5, 5)
    dirLight.castShadow = renderer.shadowMap.enabled
    scene.add(dirLight)

    const backLight = new THREE.PointLight(0x4466aa, 0.8)
    backLight.position.set(-3, 2, -10)
    scene.add(backLight)

    // Create elements
    createStars()
    createGalaxy()
    createNebulae()
    createPlanets()
    createTravelingLight()

    clock = new THREE.Clock()

    // Event listeners
    window.addEventListener('resize', onWindowResizeDebounced, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, { passive: true })
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, { passive: true })

  } catch (error) {
    console.error('WebGL initialization failed, using fallback gradient.', error)
    if (container.value) {
      container.value.style.background = 'linear-gradient(135deg, #03030f, #0a0a2e)'
    }
  }
}

// ----------------------------------------------------------------------------
// Animation Loop
// ----------------------------------------------------------------------------

function animate() {
  if (!isTabVisible) return

  animationId = requestAnimationFrame(animate)

  const delta = Math.min(clock.getDelta(), 0.05) // clamp to avoid spiral of death
  time += delta

  // Camera sway
  camera.position.x = 1.5 * Math.sin(time * 0.3) // gentle sway
  camera.position.y = 2 + 0.3 * Math.sin(time * 0.5)
  camera.rotation.z = 0.008 * Math.sin(time * 0.4)
  camera.lookAt(0, 2, -10)

  const worldSpeed = 0.12 // slowed down

  // Update planets (only active ones)
  for (let i = 0; i < config.planetCount; i++) {
    const p = planets[i]
    p.group.position.z += worldSpeed

    // Self-rotation
    p.sphere.rotation.y += p.rotSpeed * delta * 15

    // Reset when past camera
    if (p.group.position.z > 40) {
      p.group.position.z = -250 - Math.random() * 200
      const angle = Math.random() * Math.PI * 2
      const radius = 15 + Math.random() * 50
      const height = (Math.random() - 0.5) * 30
      p.group.position.x = Math.cos(angle) * radius
      p.group.position.y = height
      p.rotSpeed = 0.005 + Math.random() * 0.012
    }
  }

  // Galaxy rotation and drift
  if (galaxyPoints) {
    galaxyPoints.rotation.y += 0.00008
    galaxyPoints.position.z += worldSpeed * 0.25
    if (galaxyPoints.position.z > 150) galaxyPoints.position.z = -500
  }

  // Star twinkling (per layer)
  starLayers.forEach((layer, idx) => {
    const opacity = layer.baseOpacity + 0.2 * Math.sin(time * layer.speed + layer.offset)
    ;(layer.points.material as THREE.PointsMaterial).opacity = opacity
  })

  // Nebulae opacity pulsing
  nebulas.forEach(neb => {
    if (!neb.active) return
    const opacity = neb.baseOpacity + 0.01 * Math.sin(time * neb.speed + neb.offset)
    neb.planes.forEach(plane => {
      (plane.material as THREE.MeshBasicMaterial).opacity = opacity
    })

    // Move slowly
    neb.group.position.z += worldSpeed * 0.2
    if (neb.group.position.z > 100) {
      neb.group.position.z = -400 - Math.random() * 300
      neb.group.position.x = (Math.random() - 0.5) * 500
      neb.group.position.y = (Math.random() - 0.5) * 250
    }
  })

  // Traveling light
  travelingLight.position.z += worldSpeed * 0.5
  if (travelingLight.position.z > 100) travelingLight.position.z = -300

  renderer.render(scene, camera)
}

// ----------------------------------------------------------------------------
// Event Handlers
// ----------------------------------------------------------------------------

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight, false)
}

const onWindowResizeDebounced = debounce(onWindowResize, 200)

function onVisibilityChange() {
  isTabVisible = !document.hidden
  if (isTabVisible) {
    if (!animationId) animate()
  } else {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = 0
    }
  }
}

function onContextLost(event: Event) {
  event.preventDefault()
  cancelAnimationFrame(animationId)
  animationId = 0
}

function onContextRestored() {
  init()
  animate()
}

function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: number
  return ((...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

// ----------------------------------------------------------------------------
// Lifecycle
// ----------------------------------------------------------------------------

onMounted(() => {
  init()
  animate()
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)

  // Remove event listeners
  window.removeEventListener('resize', onWindowResizeDebounced)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  if (renderer) {
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
    renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored)
  }

  // Dispose all Three.js resources
  disposables.forEach(item => {
    if (item instanceof THREE.Mesh || item instanceof THREE.Points || item instanceof THREE.Group) {
      if (item.geometry) item.geometry.dispose()
      if (Array.isArray(item.material)) {
        item.material.forEach((m: THREE.Material) => m.dispose())
      } else if (item.material) {
        item.material.dispose()
      }
    } else if (item instanceof THREE.Material) {
      item.dispose()
    } else if (item instanceof THREE.Texture) {
      item.dispose()
    } else if (item instanceof THREE.BufferGeometry) {
      item.dispose()
    }
  })

  // Clear texture cache
  textureCache.clear()

  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
})
</script>

<style scoped>
.three-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  background: #03030f; /* fallback while loading */
}
</style>