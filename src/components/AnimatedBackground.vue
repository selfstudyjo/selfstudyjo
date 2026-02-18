<template>
  <div ref="container" class="three-background"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

const container = ref<HTMLElement | null>(null)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let clock: THREE.Clock
let planets: Array<{ mesh: THREE.Mesh; group: THREE.Group; speed: number; radius: number; angle: number; height: number; initialZ: number; rotSpeed: number }> = []
let stars: THREE.Points
let galaxy: THREE.Points
let nebulaMeshes: THREE.Mesh[] = []

// --- Helper: create a soft circular texture for stars and nebulae sprites ---
function createSoftTexture(color: string = 'white'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, color)
  gradient.addColorStop(0.4, color)
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.5)')
  gradient.addColorStop(0.8, 'rgba(255,255,255,0.2)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

// --- Helper: create a planet texture with name and surface detail ---
function createPlanetTexture(name: string, baseColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  // Base gradient
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  grad.addColorStop(0, baseColor)
  grad.addColorStop(0.5, lightenColor(baseColor, 40))
  grad.addColorStop(1, darkenColor(baseColor, 40))
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
  ctx.font = 'Bold 140px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 8
  ctx.strokeText(name, canvas.width / 2, canvas.height / 2)
  ctx.fillStyle = 'white'
  ctx.fillText(name, canvas.width / 2, canvas.height / 2)

  return new THREE.CanvasTexture(canvas)
}

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

onMounted(() => {
  init()
  animate()
})

onUnmounted(() => {
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
  window.removeEventListener('resize', onWindowResize)
})

function init() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x03030f) // deeper space
  scene.fog = new THREE.FogExp2(0x03030f, 0.0012)

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(0, 2, 0)
  camera.lookAt(0, 2, -10)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  container.value?.appendChild(renderer.domElement)

  // Lighting
  const ambient = new THREE.AmbientLight(0x404060)
  scene.add(ambient)
  const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2)
  dirLight.position.set(2, 5, 5)
  dirLight.castShadow = true
  scene.add(dirLight)
  const backLight = new THREE.PointLight(0x4466aa, 0.8)
  backLight.position.set(-3, 2, -10)
  scene.add(backLight)

  // Create elements
  createStars()
  createGalaxy()
  createNebulae() // now uses spheres, not points
  createPlanets()

  clock = new THREE.Clock()
  window.addEventListener('resize', onWindowResize)
}

function createStars() {
  const geometry = new THREE.BufferGeometry()
  const count = 5000
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    // Distribute in a large sphere
    const r = 200 + Math.random() * 400
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi) - 300

    // Random color temperature
    const tint = Math.random() * 0.5 + 0.5
    colors[i * 3] = tint * (0.8 + 0.4 * Math.random())
    colors[i * 3 + 1] = tint * (0.7 + 0.4 * Math.random())
    colors[i * 3 + 2] = 1.0
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const texture = createSoftTexture()
  const material = new THREE.PointsMaterial({
    size: 0.9,
    map: texture,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    sizeAttenuation: true
  })
  stars = new THREE.Points(geometry, material)
  scene.add(stars)
}

function createGalaxy() {
  const geometry = new THREE.BufferGeometry()
  const count = 8000
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const radius = 60 + Math.random() * 100
    const angle = Math.random() * Math.PI * 2
    const spiral = 15
    const x = Math.cos(angle) * radius + Math.sin(angle) * spiral
    const y = (Math.random() - 0.5) * 20
    const z = Math.sin(angle) * radius - Math.cos(angle) * spiral
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z - 400

    // Core warmer, arms cooler
    if (radius < 90) {
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

  const texture = createSoftTexture()
  const material = new THREE.PointsMaterial({
    size: 0.7,
    map: texture,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    sizeAttenuation: true
  })
  galaxy = new THREE.Points(geometry, material)
  scene.add(galaxy)
}

function createNebulae() {
  // Create a few large, soft spheres to act as nebulae
  const colors = [0x8844aa, 0x4488ff, 0xff5588, 0x88ff88]
  for (let i = 0; i < 6; i++) {
    const color = colors[i % colors.length]
    const geometry = new THREE.SphereGeometry(30 + Math.random() * 50, 32, 32)
    const material = new THREE.MeshPhongMaterial({
      color: color,
      emissive: color,
      transparent: true,
      opacity: 0.03 + Math.random() * 0.04,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const sphere = new THREE.Mesh(geometry, material)
    sphere.position.set(
      (Math.random() - 0.5) * 400,
      (Math.random() - 0.5) * 200,
      -300 - Math.random() * 300
    )
    scene.add(sphere)
    nebulaMeshes.push(sphere)
  }
}

function createPlanets() {
  const planetData = [
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
    { name: 'Web Scraping', color: '#45B7D1', size: 0.8, hasRing: false }
  ]

  planetData.forEach(data => {
    const group = new THREE.Group()

    // Planet sphere with custom texture
    const texture = createPlanetTexture(data.name, data.color)
    const geo = new THREE.SphereGeometry(data.size, 128, 128) // high resolution
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      emissive: 0x222222,
      roughness: 0.4,
      metalness: 0.1
    })
    const sphere = new THREE.Mesh(geo, mat)
    sphere.castShadow = true
    sphere.receiveShadow = true
    group.add(sphere)

    // Optional ring
    if (data.hasRing) {
      const ringGeo = new THREE.TorusGeometry(data.size * 1.5, 0.12, 16, 100)
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        emissive: 0x111111,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = Math.PI / 2
      ring.rotation.z = 0.3
      group.add(ring)
    }

    // Random position far ahead
    const angle = Math.random() * Math.PI * 2
    const radius = 15 + Math.random() * 40
    const height = (Math.random() - 0.5) * 25
    group.position.x = Math.cos(angle) * radius
    group.position.y = height
    group.position.z = -100 - Math.random() * 200

    scene.add(group)

    planets.push({
      mesh: sphere, // store reference for rotation
      group,
      speed: 0.1 + Math.random() * 0.2,
      radius,
      angle,
      height,
      initialZ: group.position.z,
      rotSpeed: 0.005 + Math.random() * 0.01 // faster, noticeable rotation
    })
  })
}

function animate() {
  requestAnimationFrame(animate)

  const delta = clock.getDelta()
  const worldSpeed = 0.35 // forward speed

  // Move planets toward camera and rotate them
  planets.forEach(p => {
    p.group.position.z += worldSpeed

    // Rotate the sphere mesh itself for self-rotation (more reliable)
    p.mesh.rotation.y += p.rotSpeed * delta * 30 // scaled by delta for consistency

    // Reset when past camera
    if (p.group.position.z > 40) {
      p.group.position.z = -250 - Math.random() * 200
      const angle = Math.random() * Math.PI * 2
      const radius = 15 + Math.random() * 50
      const height = (Math.random() - 0.5) * 30
      p.group.position.x = Math.cos(angle) * radius
      p.group.position.y = height
      // Also randomize rotation speed for variety
      p.rotSpeed = 0.005 + Math.random() * 0.012
    }
  })

  // Galaxy and stars slowly drift / rotate
  if (galaxy) {
    galaxy.rotation.y += 0.00015
    galaxy.position.z += worldSpeed * 0.25
    if (galaxy.position.z > 150) galaxy.position.z = -500
  }
  if (stars) {
    stars.rotation.y += 0.00005
  }

  // Nebulae spheres slowly float
  nebulaMeshes.forEach(mesh => {
    mesh.position.z += worldSpeed * 0.2
    if (mesh.position.z > 100) {
      mesh.position.z = -400 - Math.random() * 300
      mesh.position.x = (Math.random() - 0.5) * 500
      mesh.position.y = (Math.random() - 0.5) * 250
    }
  })

  renderer.render(scene, camera)
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}
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
}
</style>
