/**
 * Shared Planet Renderer — singleton that drives ALL <Planet /> instances
 * with ONE WebGL context, ONE rAF loop, shared geometry & cached textures.
 */
import * as THREE from 'three'
import { getSecureMediaUrl } from '@/utils/mediaUtils'

interface PlanetHandle {
  id: number
  outCanvas: HTMLCanvasElement
  outCtx: CanvasRenderingContext2D
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  mesh: THREE.Mesh
  material: THREE.MeshLambertMaterial
  textureKey: string
  width: number
  height: number
  rotSpeed: number
  visible: boolean
}

interface CachedTexture {
  texture: THREE.Texture
  refs: number
}

const TARGET_FPS = 30
const MAX_PIXEL_RATIO = 1.5
const SPHERE_SEGMENTS = 32
const TEXTURE_SIZE = 256

class PlanetRenderer {
  private static _instance: PlanetRenderer | null = null
  static get(): PlanetRenderer {
    if (!PlanetRenderer._instance) PlanetRenderer._instance = new PlanetRenderer()
    return PlanetRenderer._instance
  }

  private renderer: THREE.WebGLRenderer | null = null
  private offscreen: HTMLCanvasElement | null = null
  private sharedGeometry: THREE.SphereGeometry | null = null
  private ambient: THREE.AmbientLight | null = null
  private dirLight: THREE.DirectionalLight | null = null

  private planets = new Map<number, PlanetHandle>()
  private textureCache = new Map<string, CachedTexture>()

  private rafId = 0
  private lastFrame = 0
  private frameInterval = 1000 / TARGET_FPS

  private intersectionObserver: IntersectionObserver | null = null
  private nextId = 1
  private webglOk = true

  // ----- Lifecycle -----
  private ensureInit() {
    if (this.renderer || !this.webglOk) return

    try {
      this.offscreen = document.createElement('canvas')
      this.offscreen.width = 384
      this.offscreen.height = 384

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.offscreen,
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
        precision: 'mediump',
        stencil: false,
        depth: true,
      })
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))

      // Shared geometry — one sphere for ALL planets
      this.sharedGeometry = new THREE.SphereGeometry(1, SPHERE_SEGMENTS, SPHERE_SEGMENTS)

      // Lights live in EACH scene (cheap to clone refs but easier to attach per-scene)

      this.intersectionObserver = new IntersectionObserver(entries => {
        for (const e of entries) {
          const id = Number((e.target as HTMLCanvasElement).dataset.planetId || 0)
          const p = this.planets.get(id)
          if (p) p.visible = e.isIntersecting
        }
      }, { threshold: 0, rootMargin: '100px' })

      document.addEventListener('visibilitychange', this.onVisibilityChange)

      this.startLoop()
    } catch (err) {
      console.warn('[PlanetRenderer] WebGL unavailable:', err)
      this.webglOk = false
    }
  }

  isWebGLAvailable(): boolean {
    if (!this.webglOk) return false
    if (this.renderer) return true
    try {
      const c = document.createElement('canvas')
      const ok = !!(c.getContext('webgl2') || c.getContext('webgl'))
      this.webglOk = ok
      return ok
    } catch { this.webglOk = false; return false }
  }

  // ----- Texture handling (cached + reference-counted) -----
  private getEffectiveUrl(url: string): string {
    if (!url) return url
    if (import.meta.env.DEV) {
      const m1 = /^https?:\/\/selfstudymedia1\.pythonanywhere\.com/
      const m2 = /^https?:\/\/selfstudymedia2\.pythonanywhere\.com/
      if (m1.test(url)) return url.replace(m1, '/media1')
      if (m2.test(url)) return url.replace(m2, '/media2')
      return url
    }
    return getSecureMediaUrl(url)
  }

  private hashString(s: string): number {
    let h = 0
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
    return Math.abs(h)
  }

  private generateNamedTexture(name: string): THREE.Texture {
    const c = document.createElement('canvas')
    c.width = c.height = TEXTURE_SIZE
    const ctx = c.getContext('2d')!

    const display = name || 'Course'
    const hue = this.hashString(display) % 360

    const grad = ctx.createLinearGradient(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    grad.addColorStop(0, `hsl(${hue}, 70%, 55%)`)
    grad.addColorStop(1, `hsl(${(hue + 50) % 360}, 70%, 30%)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)

    // Light surface noise (cheap)
    const seed = this.hashString(display) || 1
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    for (let i = 0; i < 25; i++) {
      const x = (seed * (i + 1) * 13) % TEXTURE_SIZE
      const y = (seed * (i + 7) * 17) % TEXTURE_SIZE
      const r = ((seed * (i + 3)) % 14) + 4
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }

    // Label
    const fontSize = Math.floor(TEXTURE_SIZE * 0.16)
    ctx.font = `bold ${fontSize}px system-ui, Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.strokeText(display, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(display, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2)

    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  private isFallback1x1(tex: THREE.Texture): boolean {
    const img = tex.image as HTMLImageElement
    return img?.width === 1 && img?.height === 1
  }

  private async acquireTexture(imageUrl: string | undefined, courseName: string): Promise<{ tex: THREE.Texture, key: string }> {
    const key = imageUrl ? `img:${imageUrl}` : `gen:${courseName}`

    const cached = this.textureCache.get(key)
    if (cached) {
      cached.refs++
      return { tex: cached.texture, key }
    }

    let tex: THREE.Texture
    if (imageUrl) {
      const finalUrl = this.getEffectiveUrl(imageUrl)
      tex = await new Promise<THREE.Texture>((resolve) => {
        const loader = new THREE.TextureLoader()
        loader.crossOrigin = 'anonymous'
        loader.load(
          finalUrl,
          t => {
            if (this.isFallback1x1(t)) {
              t.dispose()
              resolve(this.generateNamedTexture(courseName))
            } else {
              t.colorSpace = THREE.SRGBColorSpace
              resolve(t)
            }
          },
          undefined,
          () => resolve(this.generateNamedTexture(courseName))
        )
      })
    } else {
      tex = this.generateNamedTexture(courseName)
    }

    this.textureCache.set(key, { texture: tex, refs: 1 })
    return { tex, key }
  }

  private releaseTexture(key: string) {
    const c = this.textureCache.get(key)
    if (!c) return
    c.refs--
    if (c.refs <= 0) {
      c.texture.dispose()
      this.textureCache.delete(key)
    }
  }

  // ----- Public API: register / update / unregister a planet -----
  async register(opts: {
    canvas: HTMLCanvasElement
    imageUrl?: string
    courseName: string
    width: number
    height: number
  }): Promise<number | null> {
    this.ensureInit()
    if (!this.renderer || !this.sharedGeometry) return null

    const id = this.nextId++
    const ctx = opts.canvas.getContext('2d')
    if (!ctx) return null

    opts.canvas.dataset.planetId = String(id)

    const { tex, key } = await this.acquireTexture(opts.imageUrl, opts.courseName)

    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0x6677aa, 0.7))
    const dir = new THREE.DirectionalLight(0xffffff, 1.0)
    dir.position.set(2, 2, 3)
    scene.add(dir)

    const camera = new THREE.PerspectiveCamera(45, opts.width / opts.height, 0.1, 100)
    camera.position.set(0, 0, 3)

    const material = new THREE.MeshLambertMaterial({ map: tex })
    const mesh = new THREE.Mesh(this.sharedGeometry, material)
    scene.add(mesh)

    const handle: PlanetHandle = {
      id,
      outCanvas: opts.canvas,
      outCtx: ctx,
      scene,
      camera,
      mesh,
      material,
      textureKey: key,
      width: opts.width,
      height: opts.height,
      rotSpeed: 0.3,
      visible: true,
    }
    this.planets.set(id, handle)
    this.intersectionObserver?.observe(opts.canvas)

    return id
  }

  resize(id: number, width: number, height: number) {
    const p = this.planets.get(id)
    if (!p) return
    p.width = width
    p.height = height
    p.outCanvas.width = width
    p.outCanvas.height = height
    p.camera.aspect = width / height
    p.camera.updateProjectionMatrix()
  }

  unregister(id: number) {
    const p = this.planets.get(id)
    if (!p) return
    this.intersectionObserver?.unobserve(p.outCanvas)

    p.material.dispose() // geometry is shared, do NOT dispose
    this.releaseTexture(p.textureKey)

    // Help GC
    p.scene.clear()
    this.planets.delete(id)

    if (this.planets.size === 0) this.shutdown()
  }

  // ----- Render loop -----
  private startLoop() {
    if (this.rafId) return
    const tick = (now: number) => {
      this.rafId = requestAnimationFrame(tick)
      if (document.hidden) return
      const since = now - this.lastFrame
      if (since < this.frameInterval) return
      this.lastFrame = now - (since % this.frameInterval)

      if (!this.renderer || this.planets.size === 0) return

      const delta = Math.min(since / 1000, 0.1)

      for (const p of this.planets.values()) {
        if (!p.visible) continue

        p.mesh.rotation.y += delta * p.rotSpeed

        // Sync renderer size to this planet's output size
        if (this.offscreen!.width !== p.width || this.offscreen!.height !== p.height) {
          this.renderer.setSize(p.width, p.height, false)
        }
        this.renderer.render(p.scene, p.camera)

        // Copy WebGL canvas → planet's 2D canvas
        p.outCtx.clearRect(0, 0, p.width, p.height)
        p.outCtx.drawImage(this.offscreen!, 0, 0, p.width, p.height)
      }
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private onVisibilityChange = () => {
    // Loop already checks document.hidden; nothing else to do
  }

  private shutdown() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0 }
    document.removeEventListener('visibilitychange', this.onVisibilityChange)

    this.intersectionObserver?.disconnect()
    this.intersectionObserver = null

    for (const c of this.textureCache.values()) c.texture.dispose()
    this.textureCache.clear()

    this.sharedGeometry?.dispose()
    this.sharedGeometry = null

    this.renderer?.dispose()
    this.renderer?.forceContextLoss?.()
    this.renderer = null
    this.offscreen = null
  }
}

export const planetRenderer = PlanetRenderer.get()