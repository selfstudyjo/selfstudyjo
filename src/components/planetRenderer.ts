/**
 * Shared Planet Renderer — singleton that drives ALL <Planet /> instances
 * with ONE WebGL context, ONE rAF loop, shared geometry & cached textures.
 *
 * Speed strategy:
 *  - register() returns IMMEDIATELY with a procedurally-generated planet
 *    texture, so the rotating 3D sphere appears with zero perceived delay.
 *  - The real course image is fetched in the background through a parallel
 *    CORS-proxy race (Promise.any). The first proxy to respond wins, gets
 *    persisted to localStorage, and is reused for the rest of the page.
 *  - When the real image arrives the material.map is hot-swapped on the
 *    live mesh — no reflow, no flicker, no re-creation of scene/camera.
 *  - Textures are reference-counted and shared across cards that use the
 *    same image_url, so 6 cards never start 6 duplicate fetches.
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
  objectUrl?: string
}

const TARGET_FPS = 30
const MAX_PIXEL_RATIO = 1.5
const SPHERE_SEGMENTS = 32
const TEXTURE_SIZE = 256

/* -------------------------------------------------------------------------
 * CORS proxy chain (production only).
 * Place your own Cloudflare Worker URL FIRST for best reliability.
 * ------------------------------------------------------------------------- */
const CORS_PROXY_TEMPLATES: Array<(u: string) => string> = [
  // (u) => `https://YOUR-NAME.YOUR-SUBDOMAIN.workers.dev/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://cors.eu.org/${u}`,
]

const FETCH_TIMEOUT_MS = 9000
const STICKY_PROXY_KEY = 'sfs_planet_proxy_idx'

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

  /** Tracks one in-flight fetch per image URL so 6 cards never start 6
   *  duplicate proxy races for the same image. */
  private imageLoadInFlight = new Map<string, Promise<{
    img: HTMLImageElement, objectUrl?: string
  } | null>>()

  private rafId = 0
  private lastFrame = 0
  private frameInterval = 1000 / TARGET_FPS

  private intersectionObserver: IntersectionObserver | null = null
  private nextId = 1
  private webglOk = true

  /** First successful proxy (persisted across page-loads in localStorage). */
  private workingProxy: ((u: string) => string) | null = null

  private constructor() {
    this.restoreStickyProxy()
  }

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

      this.sharedGeometry = new THREE.SphereGeometry(1, SPHERE_SEGMENTS, SPHERE_SEGMENTS)

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

  // ----- Sticky proxy persistence -----
  private restoreStickyProxy() {
    try {
      const raw = localStorage.getItem(STICKY_PROXY_KEY)
      if (raw == null) return
      const idx = parseInt(raw, 10)
      if (Number.isFinite(idx) && idx >= 0 && idx < CORS_PROXY_TEMPLATES.length) {
        this.workingProxy = CORS_PROXY_TEMPLATES[idx]
      }
    } catch { /* ignore */ }
  }
  private rememberStickyProxy(proxy: (u: string) => string) {
    this.workingProxy = proxy
    try {
      const idx = CORS_PROXY_TEMPLATES.indexOf(proxy)
      if (idx >= 0) localStorage.setItem(STICKY_PROXY_KEY, String(idx))
    } catch { /* ignore */ }
  }
  private forgetStickyProxy() {
    this.workingProxy = null
    try { localStorage.removeItem(STICKY_PROXY_KEY) } catch { /* ignore */ }
  }

  // ----- Texture generation -----
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

    const seed = this.hashString(display) || 1
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    for (let i = 0; i < 25; i++) {
      const x = (seed * (i + 1) * 13) % TEXTURE_SIZE
      const y = (seed * (i + 7) * 17) % TEXTURE_SIZE
      const r = ((seed * (i + 3)) % 14) + 4
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }

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

  // ----- Image pipeline -----
  private decodeImageFromUrl(src: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        if (img.naturalWidth === 0) reject(new Error('Empty image'))
        else resolve(img)
      }
      img.onerror = () => reject(new Error('Image decode failed'))
      img.src = src
    })
  }

  /** Fetch via proxy URL → blob → object URL → decoded <img>. */
  private async fetchImageAsObjectUrl(url: string):
      Promise<{ img: HTMLImageElement, objectUrl: string } | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
      })
      if (!res.ok) return null
      const blob = await res.blob()
      if (!blob.type.startsWith('image/') || blob.size < 64) return null

      const objectUrl = URL.createObjectURL(blob)
      try {
        const img = await this.decodeImageFromUrl(objectUrl)
        return { img, objectUrl }
      } catch {
        URL.revokeObjectURL(objectUrl)
        return null
      }
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  /** Race every proxy in parallel; first success wins and becomes sticky. */
  private async raceProxies(url: string):
      Promise<{ img: HTMLImageElement, objectUrl?: string } | null> {
    const attempts = CORS_PROXY_TEMPLATES.map((buildProxy) =>
      this.fetchImageAsObjectUrl(buildProxy(url)).then(result => {
        if (!result) return Promise.reject(new Error('failed'))
        if (!this.workingProxy) this.rememberStickyProxy(buildProxy)
        return result
      })
    )
    try {
      return await Promise.any(attempts)
    } catch {
      return null
    }
  }

  /** Top-level: dev-proxy in dev, sticky → race in prod. Returns null if all fail. */
  private async loadCourseImageInternal(rawUrl: string):
      Promise<{ img: HTMLImageElement, objectUrl?: string } | null> {

    if (import.meta.env.DEV) {
      const m1 = /^https?:\/\/selfstudymedia1\.pythonanywhere\.com/
      const m2 = /^https?:\/\/selfstudymedia2\.pythonanywhere\.com/
      let devUrl = rawUrl
      if (m1.test(rawUrl)) devUrl = rawUrl.replace(m1, '/media1')
      else if (m2.test(rawUrl)) devUrl = rawUrl.replace(m2, '/media2')
      try {
        const img = await this.decodeImageFromUrl(devUrl)
        return { img }
      } catch { return null }
    }

    const finalUrl = getSecureMediaUrl(rawUrl)
    const isMediaUrl = /^https?:\/\/selfstudymedia\d+\.pythonanywhere\.com\//.test(finalUrl)

    if (!isMediaUrl) {
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image()
          i.crossOrigin = 'anonymous'
          i.onload = () => resolve(i)
          i.onerror = () => reject(new Error('direct failed'))
          i.src = finalUrl
        })
        return { img }
      } catch { return null }
    }

    // Sticky path — single fetch, ~one round-trip
    if (this.workingProxy) {
      const r = await this.fetchImageAsObjectUrl(this.workingProxy(finalUrl))
      if (r) return r
      this.forgetStickyProxy()
    }

    // First time / sticky failed: race them in parallel
    return await this.raceProxies(finalUrl)
  }

  /** De-duplicated loader: if the same image_url is already loading, await
   *  the existing promise instead of starting a second fetch. */
  private loadCourseImage(rawUrl: string):
      Promise<{ img: HTMLImageElement, objectUrl?: string } | null> {
    const existing = this.imageLoadInFlight.get(rawUrl)
    if (existing) return existing
    const p = this.loadCourseImageInternal(rawUrl).finally(() => {
      this.imageLoadInFlight.delete(rawUrl)
    })
    this.imageLoadInFlight.set(rawUrl, p)
    return p
  }

  // ----- Texture cache + ref counting -----
  private releaseTexture(key: string) {
    const c = this.textureCache.get(key)
    if (!c) return
    c.refs--
    if (c.refs <= 0) {
      c.texture.dispose()
      if (c.objectUrl) { try { URL.revokeObjectURL(c.objectUrl) } catch {} }
      this.textureCache.delete(key)
    }
  }

  private applyTextureToPlanet(planetId: number, newTex: THREE.Texture, newKey: string) {
    const p = this.planets.get(planetId)
    if (!p) {
      // Planet was unregistered while we were loading — release the texture.
      this.releaseTexture(newKey)
      return
    }
    const oldKey = p.textureKey
    p.material.map = newTex
    p.material.needsUpdate = true
    p.textureKey = newKey
    this.releaseTexture(oldKey)
  }

  /** Run image load + texture creation in the background, then hot-swap onto the live planet. */
  private async upgradeToRealImage(planetId: number, imageUrl: string) {
    const cacheKey = `img:${imageUrl}`

    // Cached already?
    const cached = this.textureCache.get(cacheKey)
    if (cached) {
      cached.refs++
      this.applyTextureToPlanet(planetId, cached.texture, cacheKey)
      return
    }

    const loaded = await this.loadCourseImage(imageUrl)
    if (!loaded) return  // Keep generated planet — same fallback you already had.

    // Re-check cache (a sibling card may have populated it while we were loading).
    const winnerCached = this.textureCache.get(cacheKey)
    if (winnerCached) {
      if (loaded.objectUrl) { try { URL.revokeObjectURL(loaded.objectUrl) } catch {} }
      winnerCached.refs++
      this.applyTextureToPlanet(planetId, winnerCached.texture, cacheKey)
      return
    }

    const tex = new THREE.Texture(loaded.img)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true

    this.textureCache.set(cacheKey, {
      texture: tex,
      refs: 1,
      objectUrl: loaded.objectUrl,
    })

    this.applyTextureToPlanet(planetId, tex, cacheKey)
  }

  // ----- Public API -----
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

    // 1) IMMEDIATE: build the planet with a procedurally-generated texture.
    //    This is what makes the perceived load instant.
    const genKey = `gen:${id}:${opts.courseName}`
    const genTex = this.generateNamedTexture(opts.courseName)
    this.textureCache.set(genKey, { texture: genTex, refs: 1 })

    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0x6677aa, 0.7))
    const dir = new THREE.DirectionalLight(0xffffff, 1.0)
    dir.position.set(2, 2, 3)
    scene.add(dir)

    const camera = new THREE.PerspectiveCamera(45, opts.width / opts.height, 0.1, 100)
    camera.position.set(0, 0, 3)

    const material = new THREE.MeshLambertMaterial({ map: genTex })
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
      textureKey: genKey,
      width: opts.width,
      height: opts.height,
      rotSpeed: 0.3,
      visible: true,
    }
    this.planets.set(id, handle)
    this.intersectionObserver?.observe(opts.canvas)

    // 2) BACKGROUND: fetch the real image and swap the material's map.
    if (opts.imageUrl) {
      this.upgradeToRealImage(id, opts.imageUrl).catch(() => { /* keep generated */ })
    }

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

    p.scene.clear()
    this.planets.delete(id)

    if (this.planets.size === 0) this.shutdown()
  }

  // ----- Render loop (UNCHANGED) -----
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

        if (this.offscreen!.width !== p.width || this.offscreen!.height !== p.height) {
          this.renderer.setSize(p.width, p.height, false)
        }
        this.renderer.render(p.scene, p.camera)

        p.outCtx.clearRect(0, 0, p.width, p.height)
        p.outCtx.drawImage(this.offscreen!, 0, 0, p.width, p.height)
      }
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private onVisibilityChange = () => { /* loop already checks document.hidden */ }

  private shutdown() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0 }
    document.removeEventListener('visibilitychange', this.onVisibilityChange)

    this.intersectionObserver?.disconnect()
    this.intersectionObserver = null

    for (const c of this.textureCache.values()) {
      c.texture.dispose()
      if (c.objectUrl) { try { URL.revokeObjectURL(c.objectUrl) } catch {} }
    }
    this.textureCache.clear()
    this.imageLoadInFlight.clear()

    this.sharedGeometry?.dispose()
    this.sharedGeometry = null

    this.renderer?.dispose()
    this.renderer?.forceContextLoss?.()
    this.renderer = null
    this.offscreen = null
  }
}

export const planetRenderer = PlanetRenderer.get()