/**
 * The 3D roadmap scene — three.js, imported ONLY when somebody opens 3D.
 *
 * `three` is never statically imported anywhere on this route (working rule
 * 47): the view chunk carries none of it, and a learner who stays in 2D never
 * downloads a 3D engine. The import promises are cached, failures included, so
 * two mounts join one download and a chunk that 404s after a deploy is not
 * retried per mount. Bloom (EffectComposer + UnrealBloomPass) is a SECOND lazy
 * import, fetched only when the quality budget allows it.
 *
 * The visual language (2026-11 redesign): a gradient nebula dome with a
 * twinkling star field and drifting dust; each stage an "island" - a glass
 * deck over a polar light-grid with a glowing rim and its progress arc; each
 * step a bevelled, extruded PLATE in the same silhouette as its 2D glyph
 * (`kindOutline`), billboarded to the camera, the kind's icon on its face and a
 * soft halo behind it; the journey a luminous tube whose shader draws itself on,
 * runs light bands along its length and turns the success hue up to the last
 * finished stage, with comets travelling it. Shape and icon carry the kind and
 * colour only supports it (working rule 37).
 *
 * What DECIDES lives in `@/utils/roadmapLayout` (positions, tour stops,
 * progress, the outlines, the easings) and is checked in node. This file only
 * draws, and the silent failures are each handled on purpose:
 *
 *  - **a canvas cannot read a CSS custom property** (working rule 37): every
 *    colour is resolved off `<html>` with getComputedStyle, and the component
 *    REBUILDS the scene when `data-theme` changes rather than recolouring it;
 *  - **a renderer nobody is looking at still burns a GPU**: the loop stops when
 *    the host is off screen or the tab is hidden, under prefers-reduced-motion
 *    it renders only on demand, and a QUALITY GOVERNOR drops bloom and the
 *    pixel ratio when frames run long;
 *  - **everything allocated is disposed** — geometries, materials, the canvas
 *    textures, the environment map, the composer and its targets, the label
 *    layer's DOM, the context itself;
 *  - **labels are DOM** (CSS2DRenderer), built with createElement/textContent,
 *    never `innerHTML` - a title is record text;
 *  - **a click is not a drag**: more than a few pixels between down and up was
 *    an orbit, not a pick.
 */

import {
    KIND_ICON, KIND_META, STATUS_META, easeInOut, easeOutCubic, kindOutline, lerp3, nextNode,
    progressStats, springOut, statusOf,
    type Layout3D, type NodeKind, type RoadmapDoc, type Vec3,
} from '@/utils/roadmapLayout';
import { pickQuality, pixelRatio } from '@/stage3d/loader';

/* eslint-disable @typescript-eslint/no-explicit-any */

// three ships no type declarations in this repo; the scene types it as `any`,
// exactly as HelperGuide3D.ts does.
type ThreeKit = { THREE: any; OrbitControls: any; CSS2DRenderer: any; CSS2DObject: any; RoomEnvironment: any };
let pending: Promise<ThreeKit> | null = null;
export function loadThree(): Promise<ThreeKit> {
    if (!pending) {
        pending = Promise.all([
            // @ts-ignore
            import('three'),
            // @ts-ignore
            import('three/examples/jsm/controls/OrbitControls.js'),
            // @ts-ignore
            import('three/examples/jsm/renderers/CSS2DRenderer.js'),
            // @ts-ignore
            import('three/examples/jsm/environments/RoomEnvironment.js'),
        ]).then(([THREE, orbit, css2d, room]: any[]) => ({
            THREE, OrbitControls: orbit.OrbitControls,
            CSS2DRenderer: css2d.CSS2DRenderer, CSS2DObject: css2d.CSS2DObject,
            RoomEnvironment: room.RoomEnvironment,
        })).catch((e: unknown) => { pending = null; throw e; });
    }
    return pending;
}

type FxKit = { EffectComposer: any; RenderPass: any; UnrealBloomPass: any; OutputPass: any };
let pendingFx: Promise<FxKit> | null = null;
/** Bloom, fetched only when the budget allows it. */
export function loadBloom(): Promise<FxKit> {
    if (!pendingFx) {
        pendingFx = Promise.all([
            // @ts-ignore
            import('three/examples/jsm/postprocessing/EffectComposer.js'),
            // @ts-ignore
            import('three/examples/jsm/postprocessing/RenderPass.js'),
            // @ts-ignore
            import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
            // @ts-ignore
            import('three/examples/jsm/postprocessing/OutputPass.js'),
        ]).then(([c, r, b, o]: any[]) => ({
            EffectComposer: c.EffectComposer, RenderPass: r.RenderPass,
            UnrealBloomPass: b.UnrealBloomPass, OutputPass: o.OutputPass,
        })).catch((e: unknown) => { pendingFx = null; throw e; });
    }
    return pendingFx;
}

/** A theme token as a colour string three understands, or the fallback. */
export function token(name: string, fallback: string): string {
    try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        if (!v) return fallback;
        if (/^\d+\s+\d+\s+\d+$/.test(v)) return `rgb(${v.split(/\s+/).join(',')})`;
        return v;
    } catch {
        return fallback;
    }
}

export interface SceneLabels {
    stage: (index: number, title: string) => string;
    kind: (kind: NodeKind) => string;
}

export interface SceneOptions {
    host: HTMLElement;
    canvas: HTMLCanvasElement;
    labelLayer: HTMLElement;
    motion: boolean;
    labels: SceneLabels;
    onSelect: (id: string | null) => void;
    onHover: (id: string | null) => void;
    onFocus: (stageId: string | null) => void;
    onTourEnd: () => void;
    onLost: () => void;
}

export interface RoadmapScene {
    setDoc(doc: RoadmapDoc, layout: Layout3D): void;
    rebuild(): void;
    select(id: string | null): void;
    flyToStage(stageId: string): void;
    flyToNode(id: string): void;
    overview(): void;
    playTour(): void;
    stopTour(): void;
    resize(): void;
    setActive(active: boolean): void;
    /** Pixel variance of the last frame, for the preview harness. */
    sample(): number;
    dispose(): void;
}

/* ------------------------------------------------------------------ *
 * Shaders - small, and every one ends in three's own colour-space chunk so a
 * shader colour matches a material colour in both the direct and the bloom
 * (render-target) paths.
 * ------------------------------------------------------------------ */

const DOME_VS = /* glsl */`
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DOME_FS = /* glsl */`
uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlowA; uniform vec3 uGlowB; uniform float uGlow;
varying vec3 vDir;
void main() {
  float h = vDir.y * 0.5 + 0.5;
  vec3 c = mix(uBottom, uTop, smoothstep(0.05, 0.95, h));
  float a = pow(max(dot(vDir, normalize(vec3(0.62, 0.28, -0.72))), 0.0), 5.0);
  float b = pow(max(dot(vDir, normalize(vec3(-0.7, -0.12, 0.52))), 0.0), 7.0);
  c += (uGlowA * a * 0.55 + uGlowB * b * 0.42) * uGlow;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const STAR_VS = /* glsl */`
attribute float aSize; attribute float aPhase;
uniform float uTime; uniform float uScale; uniform float uTwinkle;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vAlpha = mix(1.0, 0.55 + 0.45 * sin(uTime * 1.6 + aPhase), uTwinkle);
  gl_PointSize = clamp(aSize * uScale * (260.0 / -mv.z), 1.0, 9.0);
  gl_Position = projectionMatrix * mv;
}`;
const STAR_FS = /* glsl */`
uniform vec3 uColor; uniform float uOpacity;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(uColor, a * a * uOpacity * vAlpha);
  #include <colorspace_fragment>
}`;

const TUBE_VS = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const TUBE_FS = /* glsl */`
uniform vec3 uA; uniform vec3 uB; uniform vec3 uDone;
uniform float uTime; uniform float uDraw; uniform float uDoneAt; uniform float uFlow; uniform float uBands;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  if (vUv.x > uDraw) discard;
  vec3 c = mix(uA, uB, vUv.x);
  c = mix(c, uDone, step(vUv.x, uDoneAt) * 0.9);
  float facing = abs(dot(vN, vV));
  float band = pow(max(0.0, sin((vUv.x * uBands - uTime * uFlow) * 3.14159)), 14.0);
  float head = smoothstep(uDraw - 0.035, uDraw, vUv.x) * step(uDraw, 0.999);
  vec3 col = c * (0.55 + 0.65 * facing) + vec3(1.0) * (band * 0.6 + head * 0.9);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
const HALO_FS = /* glsl */`
uniform vec3 uA; uniform vec3 uB; uniform float uDraw; uniform float uOpacity;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  if (vUv.x > uDraw) discard;
  float facing = pow(abs(dot(vN, vV)), 2.2);
  gl_FragColor = vec4(mix(uA, uB, vUv.x), facing * uOpacity);
  #include <colorspace_fragment>
}`;

const GRID_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GRID_FS = /* glsl */`
uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float ring = smoothstep(0.9, 1.0, cos((r * 5.0 - uTime * 0.12) * 6.28318) * 0.5 + 0.5);
  float ang = atan(p.y, p.x);
  float spoke = smoothstep(0.985, 1.0, cos(ang * 12.0) * 0.5 + 0.5) * smoothstep(0.25, 0.4, r);
  float core = pow(1.0 - r, 3.0) * 0.35;
  float a = (ring * 0.75 + spoke * 0.45 + core) * (1.0 - smoothstep(0.55, 1.0, r)) * uOpacity;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

const BEAM_VS = GRID_VS;
const BEAM_FS = /* glsl */`
uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
varying vec2 vUv;
void main() {
  float fade = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.06, vUv.y);
  float shimmer = 0.75 + 0.25 * sin(vUv.y * 22.0 - uTime * 2.4);
  gl_FragColor = vec4(uColor, fade * shimmer * uOpacity);
  #include <colorspace_fragment>
}`;

export async function createRoadmapScene(opts: SceneOptions): Promise<RoadmapScene> {
    const { THREE, OrbitControls, CSS2DRenderer, CSS2DObject, RoomEnvironment } = await loadThree();
    const { host, canvas, labelLayer, motion } = opts;

    let quality = pickQuality();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(pixelRatio(quality));
    canvas.dataset.quality = quality;

    const labelRenderer = new CSS2DRenderer({ element: labelLayer });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 900);
    camera.position.set(40, 30, 40);

    // A soft studio environment for the glossy plates and decks. Generated once
    // per scene (PMREM), disposed with it.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTex = pmrem.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose?.();
    scene.environment = envTex;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 4;
    controls.maxDistance = 220;
    controls.rotateSpeed = 0.7;

    /* Bloom: dark galaxies on a capable device only. On a pale sky a bloom
       washes every glyph to white, and on a phone it is the most expensive pass
       in the frame. The governor below can still take it away. */
    let composer: any = null;
    let bloomPass: any = null;
    let bloomWanted = false;

    let doc: RoadmapDoc | null = null;
    let layout: Layout3D | null = null;
    let content: any = null;           // the group holding everything rebuildable
    let selectedId: string | null = null;
    let hoverId: string | null = null;
    let focusStage: string | null = null;
    let light = false;
    const tokens = new Map<string, any>();      // nodeId -> token group
    const nodeLabels = new Map<string, HTMLElement>();
    const pickables: any[] = [];
    const uniformsTimed: any[] = [];             // uniforms objects carrying uTime
    const buildTextures: any[] = [];
    const comets: { sprites: any[]; offset: number }[] = [];
    const bursts: { obj: any; start: number }[] = [];
    let depGroup: any = null;
    let selRing: any = null;
    let curve: any = null;
    let tubeUniforms: any = null;
    let haloUniforms: any = null;
    let beam: any = null;
    let dust: any = null;
    let prevDone: Set<string> | null = null;

    let active = true;
    let raf = 0;
    let disposed = false;
    let dirty = true;
    let introStart = 0;
    let introDone = !motion;
    let fly: { from: Vec3; to: Vec3; fromT: Vec3; toT: Vec3; start: number; dur: number; lift: number } | null = null;
    let tour: { index: number; until: number } | null = null;
    let clock = 0;                 // shader time, seconds; frozen under reduced motion
    let lastNow = 0;
    const frameTimes: number[] = [];

    const color = (name: string, fallback: string) => {
        const c = new THREE.Color();
        try { c.setStyle(token(name, fallback)); } catch { c.set(fallback); }
        return c;
    };

    /* ---------------------------------------------------------- textures */

    function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        const ctx = cv.getContext('2d');
        if (ctx) draw(ctx);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        buildTextures.push(tex);
        return tex;
    }
    const glowTexture = () => canvasTexture(128, ctx => {
        const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
        g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
    });
    /** The kind's lucide icon, white, for tinting with the plate's ink. */
    const iconTexture = (kind: NodeKind) => canvasTexture(128, ctx => {
        ctx.translate(64 - 12 * 3.8, 64 - 12 * 3.8);
        ctx.scale(3.8, 3.8);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const d of KIND_ICON[kind]) {
            try { ctx.stroke(new Path2D(d)); } catch { /* no Path2D(string) */ }
        }
    });
    /** A status badge: a filled disc in the status hue with its own ink mark. */
    const badgeTexture = (fill: string, ink: string, done: boolean) => canvasTexture(64, ctx => {
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = ink; ctx.fillStyle = ink;
        ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (done) { ctx.beginPath(); ctx.moveTo(19, 33); ctx.lineTo(28, 42); ctx.lineTo(45, 23); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(32, 32, 9, 0, Math.PI * 2); ctx.fill(); }
    });

    /* ---------------------------------------------------------- build */

    function disposeContent() {
        if (!content) return;
        content.traverse((o: any) => {
            if (o.geometry) o.geometry.dispose();
            const m = o.material;
            if (Array.isArray(m)) m.forEach((x: any) => x.dispose());
            else if (m) m.dispose();
            if (o.isCSS2DObject && o.element?.parentNode) o.element.parentNode.removeChild(o.element);
        });
        scene.remove(content);
        content = null;
        for (const t of buildTextures) t.dispose();
        buildTextures.length = 0;
        tokens.clear();
        nodeLabels.clear();
        pickables.length = 0;
        uniformsTimed.length = 0;
        comets.length = 0;
        bursts.length = 0;
        depGroup = null;
        selRing = null;
        curve = null;
        tubeUniforms = null;
        haloUniforms = null;
        beam = null;
        dust = null;
    }

    const SVGNS = 'http://www.w3.org/2000/svg';
    function iconSvg(kind: NodeKind): SVGElement {
        const svg = document.createElementNS(SVGNS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('class', 'rm3d-label__icon');
        svg.setAttribute('aria-hidden', 'true');
        for (const d of KIND_ICON[kind]) {
            const p = document.createElementNS(SVGNS, 'path');
            p.setAttribute('d', d);
            svg.appendChild(p);
        }
        return svg;
    }

    function labelEl(cls: string, text: string, sub?: string, kind?: NodeKind): HTMLElement {
        const el = document.createElement('div');
        el.className = cls;
        if (kind) {
            el.dataset.kind = kind;
            el.appendChild(iconSvg(kind));
        }
        const body = document.createElement('span');
        body.className = 'rm3d-label__body';
        const a = document.createElement('span');
        a.className = 'rm3d-label__title';
        a.textContent = text;
        body.appendChild(a);
        if (sub) {
            const b = document.createElement('span');
            b.className = 'rm3d-label__sub';
            b.textContent = sub;
            body.appendChild(b);
        }
        el.appendChild(body);
        return el;
    }

    function plateGeometry(kind: NodeKind, r: number) {
        const pts = kindOutline(kind);
        const shape = new THREE.Shape();
        pts.forEach((p, i) => (i ? shape.lineTo(p.x * r, p.y * r) : shape.moveTo(p.x * r, p.y * r)));
        shape.closePath();
        const g = new THREE.ExtrudeGeometry(shape, {
            depth: r * 0.26, bevelEnabled: true, bevelThickness: r * 0.09, bevelSize: r * 0.08,
            bevelSegments: quality === 'high' ? 4 : 2, curveSegments: 6,
        });
        g.center();
        return g;
    }

    function addStars(R: number, count: number, sizeMin: number, sizeMax: number, colorC: any, opacity: number, twinkle: number, center: Vec3, shell: boolean) {
        const pos = new Float32Array(count * 3);
        const size = new Float32Array(count);
        const phase = new Float32Array(count);
        // Deterministic: no Math.random, so two renders are the same picture.
        let seed = shell ? 2166136261 : 374761393;
        const rnd = () => { seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0; seed ^= seed >>> 13; return (seed >>> 0) / 4294967295; };
        for (let i = 0; i < count; i++) {
            const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2;
            const r = shell ? R * (0.75 + rnd() * 0.25) : R * Math.cbrt(rnd());
            const s = Math.sqrt(1 - u * u);
            pos[i * 3] = center.x + r * s * Math.cos(th);
            pos[i * 3 + 1] = center.y + r * u * (shell ? 1 : 0.6);
            pos[i * 3 + 2] = center.z + r * s * Math.sin(th);
            size[i] = sizeMin + (sizeMax - sizeMin) * Math.pow(rnd(), 3);
            phase[i] = rnd() * 6.28;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
        const uniforms = {
            uTime: { value: clock }, uScale: { value: renderer.getPixelRatio() }, uTwinkle: { value: motion ? twinkle : 0 },
            uColor: { value: colorC }, uOpacity: { value: opacity },
        };
        uniformsTimed.push(uniforms);
        const m = new THREE.ShaderMaterial({
            uniforms, vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, depthWrite: false,
            blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
        });
        const pts = new THREE.Points(g, m);
        content.add(pts);
        return pts;
    }

    function build() {
        disposeContent();
        if (!doc || !layout) return;
        light = document.documentElement.getAttribute('data-mode') === 'light'
            || token('--sfs-mode', '').includes('light');
        const C = {
            space: color('--sfs-space', '#0b1020'),
            text: color('--sfs-text', '#f1f5f9'),
            line: color('--sfs-border-strong', '#64748b'),
            accent: color('--sfs-accent', '#667eea'),
            accent2: color('--sfs-accent-2', '#764ba2'),
            accent3: color('--sfs-accent-3', '#f093fb'),
            surface: color('--sfs-surface-2', '#1e2235'),
            star: color('--sfs-galaxy-star', '#ffffff'),
            focus: color('--sfs-focus', '#a5b4fc'),
            done: color(STATUS_META.done.token, STATUS_META.done.fallback),
            doing: color(STATUS_META.doing.token, STATUS_META.doing.fallback),
        };
        const white = new THREE.Color(1, 1, 1);
        const additive = light ? THREE.NormalBlending : THREE.AdditiveBlending;

        scene.background = C.space.clone();
        scene.fog = new THREE.FogExp2(C.space.clone(), 0.24 / Math.max(10, layout.extent));
        scene.environmentIntensity = light ? 0.9 : 0.55;

        content = new THREE.Group();
        scene.add(content);

        content.add(new THREE.HemisphereLight(0xffffff, C.space.clone(), light ? 1.1 : 0.7));
        const key = new THREE.DirectionalLight(0xffffff, light ? 1.3 : 1.5);
        key.position.set(30, 60, 40);
        content.add(key);
        const rimLight = new THREE.DirectionalLight(C.accent.clone(), light ? 0.4 : 1.1);
        rimLight.position.set(-40, 20, -30);
        content.add(rimLight);

        const center = layout.center;
        const extent = layout.extent;

        // The nebula dome: a gradient sky with two soft glows, inside out.
        {
            const top = C.space.clone().lerp(C.accent, light ? 0.1 : 0.22);
            const bottom = C.space.clone().multiplyScalar(light ? 0.94 : 0.55);
            const g = new THREE.SphereGeometry(extent * 7, 48, 24);
            const m = new THREE.ShaderMaterial({
                uniforms: {
                    uTop: { value: top }, uBottom: { value: bottom },
                    uGlowA: { value: C.accent2.clone() }, uGlowB: { value: C.accent.clone() },
                    uGlow: { value: light ? 0.35 : 1 },
                },
                vertexShader: DOME_VS, fragmentShader: DOME_FS, side: THREE.BackSide, depthWrite: false, fog: false,
            });
            const dome = new THREE.Mesh(g, m);
            dome.position.set(center.x, center.y, center.z);
            dome.renderOrder = -10;
            content.add(dome);
        }

        // Stars on the shell, dust drifting among the stages.
        addStars(extent * 5.5, quality === 'high' ? 1600 : 800, 0.35, 1.7, light ? C.line : C.star, light ? 0.4 : 0.9, 1, center, true);
        dust = addStars(extent * 1.35, quality === 'high' ? 360 : 180, 0.12, 0.42, light ? C.accent : C.accent.clone().lerp(white, 0.4), light ? 0.3 : 0.5, 0.6, center, false);

        const glowTex = glowTexture();
        const stats = progressStats(doc);
        const upNext = nextNode(doc);

        // The journey: a shader tube along the helix, plus a soft halo tube.
        let doneAt = 0;
        if (layout.path.length > 1) {
            curve = new THREE.CatmullRomCurve3(layout.path.map(p => new THREE.Vector3(p.x, p.y, p.z)), false, 'centripetal');
            const segs = Math.max(64, layout.path.length * 10);
            // The success hue runs to the last stage that is fully done.
            let lastDone = -1;
            stats.stages.forEach((s, i) => { if (s.total && s.done === s.total && lastDone === i - 1) lastDone = i; });
            const n = Math.max(1, layout.stages.length - 1);
            doneAt = lastDone < 0 ? 0 : Math.min(1, lastDone / n + 0.0001);
            tubeUniforms = {
                uA: { value: C.accent.clone() }, uB: { value: C.accent3.clone().lerp(C.accent2, 0.35) },
                uDone: { value: C.done.clone() },
                uTime: { value: clock }, uDraw: { value: introDone ? 1 : 0 }, uDoneAt: { value: doneAt },
                uFlow: { value: motion ? 0.55 : 0 }, uBands: { value: Math.max(6, layout.stages.length * 2.5) },
            };
            uniformsTimed.push(tubeUniforms);
            content.add(new THREE.Mesh(new THREE.TubeGeometry(curve, segs, 0.16, 12, false),
                new THREE.ShaderMaterial({ uniforms: tubeUniforms, vertexShader: TUBE_VS, fragmentShader: TUBE_FS })));
            haloUniforms = {
                uA: { value: C.accent.clone() }, uB: { value: C.accent2.clone() },
                uDraw: { value: introDone ? 1 : 0 }, uOpacity: { value: light ? 0.18 : 0.42 },
            };
            content.add(new THREE.Mesh(new THREE.TubeGeometry(curve, segs, 0.62, 12, false),
                new THREE.ShaderMaterial({
                    uniforms: haloUniforms, vertexShader: TUBE_VS, fragmentShader: HALO_FS,
                    transparent: true, depthWrite: false, blending: additive,
                })));

            if (motion) {
                for (let c = 0; c < 4; c++) {
                    const sprites: any[] = [];
                    for (let k = 0; k < 7; k++) {
                        const s = new THREE.Sprite(new THREE.SpriteMaterial({
                            map: glowTex, color: (k ? C.accent.clone().lerp(white, 0.3) : white),
                            transparent: true, depthWrite: false, blending: additive, opacity: (1 - k / 7) * (light ? 0.6 : 0.95),
                        }));
                        const sc = (k ? 0.9 - k * 0.1 : 1.15);
                        s.scale.setScalar(sc);
                        content.add(s);
                        sprites.push(s);
                    }
                    comets.push({ sprites, offset: c / 4 });
                }
            }
        }

        // The stage islands.
        layout.stages.forEach((ps, i) => {
            const stage = doc!.stages[i];
            const st = stats.stages[i];
            const complete = !!st && st.total > 0 && st.done === st.total;
            const g = new THREE.Group();
            g.position.set(ps.x, ps.y, ps.z);
            g.userData = { stageId: ps.id, index: i, kind: 'stage', baseY: ps.y };
            const R = ps.radius;

            const deck = new THREE.Mesh(
                new THREE.CylinderGeometry(R, R * 1.05, 0.16, 72),
                new THREE.MeshPhysicalMaterial({
                    color: C.surface.clone().lerp(complete ? C.done : C.accent, light ? 0.06 : 0.12),
                    roughness: 0.22, metalness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.2,
                    transparent: true, opacity: light ? 0.95 : 0.82,
                    emissive: complete ? C.done : C.accent, emissiveIntensity: light ? 0.03 : 0.08,
                }),
            );
            g.add(deck);

            const gridUniforms = {
                uColor: { value: (complete ? C.done : C.accent).clone() },
                uOpacity: { value: light ? 0.32 : 0.55 }, uTime: { value: clock },
            };
            uniformsTimed.push(gridUniforms);
            const grid = new THREE.Mesh(new THREE.CircleGeometry(R * 2.1, 72), new THREE.ShaderMaterial({
                uniforms: gridUniforms, vertexShader: GRID_VS, fragmentShader: GRID_FS,
                transparent: true, depthWrite: false, blending: additive, side: THREE.DoubleSide,
            }));
            grid.rotation.x = -Math.PI / 2;
            grid.position.y = -0.12;
            g.add(grid);

            const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.1, 0.035, 8, 120),
                new THREE.MeshBasicMaterial({ color: (complete ? C.done : C.accent).clone().lerp(white, light ? 0 : 0.15), transparent: true, opacity: 0.9 }));
            rim.rotation.x = Math.PI / 2;
            rim.position.y = 0.09;
            g.add(rim);
            const pct = (st?.percent ?? 0) / 100;
            if (pct > 0) {
                const arc = new THREE.Mesh(new THREE.TorusGeometry(R + 0.36, 0.07, 8, 120, Math.PI * 2 * pct),
                    new THREE.MeshBasicMaterial({ color: C.done }));
                arc.rotation.x = Math.PI / 2;
                arc.rotation.z = -ps.angle;
                arc.position.y = 0.1;
                g.add(arc);
            }

            // A beam of light over the stage where the next step is.
            if (upNext && stage?.nodes.some(nd => nd.id === upNext.id)) {
                const beamUniforms = { uColor: { value: C.accent.clone().lerp(white, 0.2) }, uOpacity: { value: light ? 0.12 : 0.22 }, uTime: { value: clock } };
                uniformsTimed.push(beamUniforms);
                beam = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.32, R * 0.5, 7, 40, 1, true), new THREE.ShaderMaterial({
                    uniforms: beamUniforms, vertexShader: BEAM_VS, fragmentShader: BEAM_FS,
                    transparent: true, depthWrite: false, blending: additive, side: THREE.DoubleSide,
                }));
                beam.position.y = 3.5;
                beam.userData.uniforms = beamUniforms;
                g.add(beam);
            }

            const stageLabel = new CSS2DObject(labelEl('rm3d-label rm3d-label--stage',
                opts.labels.stage(i, stage?.title || ''), st && st.total ? `${st.done}/${st.total}` : undefined));
            stageLabel.position.set(0, -0.85, 0);
            g.add(stageLabel);

            if (!introDone) g.scale.setScalar(0.001);
            content.add(g);
        });

        // The steps: bevelled plates, billboarded.
        const geomCache = new Map<NodeKind, any>();
        const iconCache = new Map<NodeKind, any>();
        const decalGeo = new THREE.PlaneGeometry(1, 1);
        const doneBadge = badgeTexture(token(STATUS_META.done.token, STATUS_META.done.fallback), token('--sfs-on-success', '#052e16'), true);
        const doingBadge = badgeTexture(token(STATUS_META.doing.token, STATUS_META.doing.fallback), token('--sfs-on-warning', '#451a03'), false);
        const linkPts: number[] = [];
        const linkCols: number[] = [];
        let ordinal = 0;

        for (const pn of layout.nodes) {
            const node = doc.stages.find(s => s.id === pn.stageId)?.nodes.find(n => n.id === pn.id);
            if (!node) continue;
            const status = statusOf(doc, pn.id);
            const r = pn.size * 1.0;
            let geom = geomCache.get(pn.kind);
            if (!geom) { geom = plateGeometry(pn.kind, r); geomCache.set(pn.kind, geom); }
            let icon = iconCache.get(pn.kind);
            if (!icon) { icon = iconTexture(pn.kind); iconCache.set(pn.kind, icon); }
            const meta = KIND_META[pn.kind];
            const kindColor = color(meta.token, meta.fallback);
            const ink = color(meta.onToken, meta.onFallback);
            const glowColor = status === 'done' ? C.done : status === 'doing' ? C.doing : kindColor;

            const group = new THREE.Group();
            group.position.set(pn.x, pn.y, pn.z);
            const si = layout.stages.findIndex(s => s.id === pn.stageId);
            group.userData = {
                nodeId: pn.id, stageId: pn.stageId, baseY: pn.y, phase: (ordinal * 0.73) % 6.28,
                stageIndex: si, order: ordinal, lift: 0, liftTarget: 0, target: 1, glow: 1,
            };
            ordinal++;

            // Face: the kind's own fill (its ink is derived for it, rule 12).
            // Sides and bevel: a lit rim in the kind, or the status, hue.
            const cap = new THREE.MeshPhysicalMaterial({
                color: kindColor, roughness: 0.28, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12,
                emissive: kindColor, emissiveIntensity: light ? 0.02 : 0.04,
                transparent: node.optional, opacity: node.optional ? 0.55 : 1,
            });
            const side = new THREE.MeshStandardMaterial({
                color: glowColor.clone().lerp(white, 0.25), roughness: 0.3, metalness: 0.3,
                emissive: glowColor, emissiveIntensity: light ? 0.35 : (status ? 0.85 : 0.55),
                transparent: node.optional, opacity: node.optional ? 0.6 : 1,
            });
            const plate = new THREE.Mesh(geom, [cap, side]);
            plate.userData = { nodeId: pn.id };
            group.add(plate);
            pickables.push(plate);

            const zFront = r * 0.13 + r * 0.09 + 0.006;
            const decal = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({
                map: icon, color: ink, transparent: true, depthWrite: false, toneMapped: false,
            }));
            decal.scale.setScalar(r * 1.05);
            decal.position.z = zFront;
            group.add(decal);

            if (status) {
                const badge = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({
                    map: status === 'done' ? doneBadge : doingBadge, transparent: true, depthWrite: false,
                }));
                badge.scale.setScalar(r * 0.62);
                badge.position.set(r * 0.72, r * 0.72, zFront + 0.01);
                badge.userData.badge = status;
                badge.userData.base = r * 0.62;
                group.add(badge);
            }

            const halo = new THREE.Sprite(new THREE.SpriteMaterial({
                map: glowTex, color: glowColor.clone(), transparent: true, depthWrite: false, blending: additive,
                opacity: light ? 0.28 : (status ? 0.55 : 0.32),
            }));
            halo.scale.setScalar(r * (status ? 4.0 : 3.3));
            halo.position.z = -r * 0.3;
            halo.userData.halo = { base: halo.material.opacity, scale: halo.scale.x };
            group.add(halo);

            const label = new CSS2DObject(labelEl('rm3d-label rm3d-label--node', node.title, opts.labels.kind(pn.kind), pn.kind));
            label.position.set(0, r + 0.62, 0);
            label.element.dataset.node = pn.id;
            group.add(label);
            nodeLabels.set(pn.id, label.element);

            if (!introDone) group.scale.setScalar(0.001);
            content.add(group);
            tokens.set(pn.id, group);

            // A curved filament from the island to the step.
            const ps = layout.stages[si];
            if (ps) {
                const a = new THREE.Vector3(ps.x, ps.y + 0.1, ps.z);
                const b = new THREE.Vector3(pn.x, pn.y - r * 0.6, pn.z);
                const mid = a.clone().lerp(b, 0.5);
                mid.y = Math.max(a.y, b.y) + 0.15;
                const q = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3(mid.x, a.y + 0.05, mid.z), b);
                const pts = q.getPoints(10);
                const ca = (status === 'done' ? C.done : C.accent).clone().multiplyScalar(light ? 1 : 0.6);
                const cb = glowColor.clone();
                for (let k = 0; k < pts.length - 1; k++) {
                    linkPts.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
                    const c1 = ca.clone().lerp(cb, k / (pts.length - 1)), c2 = ca.clone().lerp(cb, (k + 1) / (pts.length - 1));
                    linkCols.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
                }
            }
        }
        // Geometries shared between tokens are owned by the content tree;
        // the traversal disposes each one (a second dispose is a no-op).
        geomCache.clear();
        iconCache.clear();

        if (linkPts.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(linkPts, 3));
            g.setAttribute('color', new THREE.Float32BufferAttribute(linkCols, 3));
            content.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({
                vertexColors: true, transparent: true, opacity: light ? 0.5 : 0.55, depthWrite: false, blending: additive })));
        }

        // The selection ring, moved to whichever token is chosen.
        selRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 72),
            new THREE.MeshBasicMaterial({ color: C.focus.clone(), transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
        selRing.visible = false;
        content.add(selRing);

        // A step finished since the last build lights up with a ring burst.
        const doneNow = new Set(Object.keys(doc.progress).filter(k => doc!.progress[k] === 'done'));
        if (prevDone && motion) {
            for (const id of doneNow) {
                if (prevDone.has(id)) continue;
                const tok = tokens.get(id);
                if (!tok) continue;
                const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64),
                    new THREE.MeshBasicMaterial({ color: C.done.clone(), transparent: true, opacity: 1, depthWrite: false, blending: additive, side: THREE.DoubleSide }));
                ring.scale.setScalar(0.5);
                tok.add(ring);
                tok.userData.glow = 2.4;
                bursts.push({ obj: ring, start: performance.now() });
            }
        }
        prevDone = doneNow;

        applySelection();
        dirty = true;
    }

    /** Dependency filaments and labels for the selection and the focused stage. */
    function applySelection() {
        if (!doc || !content) return;
        if (depGroup) {
            depGroup.traverse((o: any) => { o.geometry?.dispose(); o.material?.dispose(); });
            content.remove(depGroup);
            depGroup = null;
        }
        if (selectedId) {
            const all = doc.stages.flatMap(s => s.nodes);
            const flows: [any, any][] = [];
            for (const n of all) {
                const linked = n.id === selectedId ? n.depends_on : n.depends_on.includes(selectedId) ? [selectedId] : [];
                for (const dep of linked) {
                    const a = tokens.get(dep), b = tokens.get(n.id);
                    if (a && b) flows.push([a, b]);
                }
            }
            if (flows.length) {
                depGroup = new THREE.Group();
                const accent = color('--sfs-focus', '#a5b4fc');
                for (const [a, b] of flows) {
                    const pa = new THREE.Vector3(a.position.x, a.userData.baseY, a.position.z);
                    const pb = new THREE.Vector3(b.position.x, b.userData.baseY, b.position.z);
                    const mid = pa.clone().lerp(pb, 0.5);
                    mid.y += Math.min(6, pa.distanceTo(pb) * 0.3) + 0.8;
                    const c = new THREE.QuadraticBezierCurve3(pa, mid, pb);
                    const u = {
                        uA: { value: accent.clone() }, uB: { value: accent.clone() }, uDone: { value: accent.clone() },
                        uTime: { value: clock }, uDraw: { value: 1 }, uDoneAt: { value: 0 },
                        uFlow: { value: motion ? 1.4 : 0 }, uBands: { value: 6 },
                    };
                    uniformsTimed.push(u);
                    depGroup.add(new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.05, 6, false),
                        new THREE.ShaderMaterial({ uniforms: u, vertexShader: TUBE_VS, fragmentShader: TUBE_FS })));
                }
                content.add(depGroup);
            }
        }
        for (const [id, tok] of tokens) {
            const sel = id === selectedId;
            const hov = id === hoverId;
            tok.userData.target = sel ? 1.38 : hov ? 1.2 : 1;
            tok.userData.liftTarget = sel ? 0.45 : hov ? 0.3 : 0;
            if (!motion && introDone) {
                tok.scale.setScalar(tok.userData.target);
                tok.userData.lift = tok.userData.liftTarget;
                tok.position.y = tok.userData.baseY + tok.userData.lift;
            }
            const el = nodeLabels.get(id);
            if (el) {
                const show = sel || hov || tok.userData.stageId === focusStage;
                el.classList.toggle('is-shown', show);
                el.classList.toggle('is-selected', sel);
                el.classList.toggle('is-hover', hov);
            }
        }
        if (selRing) {
            const tok = selectedId ? tokens.get(selectedId) : null;
            if (tok) {
                tok.add(selRing);
                const r = 0.55 * 1.55;
                selRing.scale.setScalar(r);
                selRing.position.set(0, 0, -0.02);
                selRing.visible = true;
            } else {
                content.add(selRing);
                selRing.visible = false;
            }
        }
        canvas.style.cursor = hoverId ? 'pointer' : '';
        dirty = true;
    }

    /* ---------------------------------------------------------- camera */

    function startFly(cam: Vec3, target: Vec3, dur = 1500) {
        const from = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
        const fromT = { x: controls.target.x, y: controls.target.y, z: controls.target.z };
        if (!motion) {
            camera.position.set(cam.x, cam.y, cam.z);
            controls.target.set(target.x, target.y, target.z);
            controls.update();
            fly = null;
            dirty = true;
            return;
        }
        const travel = Math.hypot(cam.x - from.x, cam.y - from.y, cam.z - from.z);
        // A flight is an arc, not a dolly: it rises a little in the middle.
        fly = { from, to: cam, fromT, toT: target, start: performance.now(), dur, lift: Math.min(9, travel * 0.14) };
        kick();
    }

    function flyToStage(stageId: string) {
        const stop = layout?.tour.find(s => s.stageId === stageId);
        if (!stop) return;
        focusStage = stageId;
        opts.onFocus(stageId);
        applySelection();
        startFly(stop.camera, stop.target);
    }

    function flyToNode(id: string) {
        const tok = tokens.get(id);
        const stop = layout?.tour.find(s => s.stageId === tok?.userData.stageId);
        if (!tok || !stop) return;
        focusStage = stop.stageId;
        opts.onFocus(stop.stageId);
        const p = { x: tok.position.x, y: tok.userData.baseY, z: tok.position.z };
        const dir = { x: stop.camera.x - stop.target.x, y: stop.camera.y - stop.target.y, z: stop.camera.z - stop.target.z };
        const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
        const k = 7.5 / len;
        startFly({ x: p.x + dir.x * k, y: p.y + dir.y * k, z: p.z + dir.z * k }, p, 1200);
        applySelection();
    }

    /**
     * The whole-map camera for THIS canvas shape. The layout's overview is
     * framed for a landscape canvas; a portrait phone canvas has far less
     * horizontal field, so the camera stands further back by the aspect.
     */
    function overviewPose(): { camera: Vec3; target: Vec3 } {
        const o = layout!.overview;
        // A wide canvas can stand closer than the layout's generic pose.
        const k = camera.aspect < 1 ? Math.min(1.8, 1 / Math.max(0.3, camera.aspect)) : camera.aspect > 1.3 ? 0.9 : 1;
        // Aim a little below the centre: the near (first) stages sit low in a
        // perspective frame, and centring the bounds crops them at the bottom.
        const c = { x: o.target.x, y: o.target.y - layout!.extent * 0.12, z: o.target.z };
        return {
            target: c,
            camera: { x: c.x + (o.camera.x - o.target.x) * k, y: c.y + (o.camera.y - o.target.y) * k, z: c.z + (o.camera.z - o.target.z) * k },
        };
    }

    function overview() {
        if (!layout) return;
        focusStage = null;
        opts.onFocus(null);
        applySelection();
        const o = overviewPose();
        startFly(o.camera, o.target);
    }

    /* ---------------------------------------------------------- tour */

    const DWELL = 3200;
    function playTour() {
        if (!layout || !layout.tour.length) return;
        tour = { index: 0, until: performance.now() + (motion ? 1500 + DWELL : DWELL) };
        flyToStage(layout.tour[0].stageId);
        kick();
    }
    function stopTour() {
        if (!tour) return;
        tour = null;
        opts.onTourEnd();
    }
    function stepTour(now: number) {
        if (!tour || !layout || now < tour.until) return;
        tour.index++;
        if (tour.index >= layout.tour.length) {
            tour = null;
            overview();
            opts.onTourEnd();
            return;
        }
        tour.until = now + (motion ? 1500 + DWELL : DWELL);
        flyToStage(layout.tour[tour.index].stageId);
    }

    /* ---------------------------------------------------------- picking */

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;

    function pick(ev: PointerEvent): string | null {
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
        pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(pickables, false)[0];
        return hit?.object?.userData?.nodeId || null;
    }
    const onMove = (ev: PointerEvent) => {
        if (ev.pointerType === 'touch') return;
        const id = pick(ev);
        if (id !== hoverId) {
            hoverId = id;
            opts.onHover(id);
            applySelection();
            kick();
        }
    };
    const onDown = (ev: PointerEvent) => { down = { x: ev.clientX, y: ev.clientY }; if (tour) stopTour(); };
    const onUp = (ev: PointerEvent) => {
        if (!down) return;
        const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
        down = null;
        if (moved > 6) return;
        opts.onSelect(pick(ev));
    };
    const onLeave = () => { if (hoverId) { hoverId = null; opts.onHover(null); applySelection(); kick(); } };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    const onLost = (e: Event) => { e.preventDefault(); opts.onLost(); };
    canvas.addEventListener('webglcontextlost', onLost);
    controls.addEventListener('change', () => { dirty = true; kick(); });
    controls.addEventListener('start', () => { fly = null; if (tour) stopTour(); kick(); });

    /* ---------------------------------------------------------- bloom */

    async function enableBloom() {
        try {
            const { EffectComposer, RenderPass, UnrealBloomPass, OutputPass } = await loadBloom();
            if (disposed || !bloomWanted || composer) return;
            const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
            composer = new EffectComposer(renderer);
            composer.addPass(new RenderPass(scene, camera));
            bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.48, 0.5, 0.74);
            composer.addPass(bloomPass);
            composer.addPass(new OutputPass());
            composer.setPixelRatio(renderer.getPixelRatio());
            composer.setSize(w, h);
            canvas.dataset.bloom = '1';
            dirty = true;
            kick();
        } catch {
            /* No bloom is a smaller loss than no map. */
        }
    }
    function disableBloom() {
        bloomWanted = false;
        if (composer) {
            bloomPass?.dispose?.();
            composer.dispose?.();
        }
        composer = null;
        bloomPass = null;
        delete canvas.dataset.bloom;
    }
    function updateBloomWish() {
        const want = quality === 'high' && !light;
        if (want && !bloomWanted) { bloomWanted = true; void enableBloom(); }
        else if (!want && bloomWanted) disableBloom();
    }

    /**
     * The quality governor: with motion on, frames are measured, and a device
     * that cannot hold ~24 fps loses bloom and then its pixel ratio. Never the
     * other way round within a session - flapping between the two is worse
     * than either.
     */
    function govern(dt: number) {
        if (!motion || !introDone || quality === 'low' || dt <= 0 || dt > 1000) return;
        frameTimes.push(dt);
        if (frameTimes.length < 90) return;
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        frameTimes.length = 0;
        if (avg > 42) {
            quality = 'low';
            canvas.dataset.quality = 'low';
            disableBloom();
            renderer.setPixelRatio(1);
            resize();
        }
    }

    /* ---------------------------------------------------------- loop */

    function animating(): boolean {
        return !introDone || !!fly || !!tour || motion || bursts.length > 0;
    }

    function draw() {
        // Billboard every token to the camera, keeping a whisper of tilt.
        for (const [, tok] of tokens) {
            tok.quaternion.copy(camera.quaternion);
            if (motion) tok.rotateZ(Math.sin(clock * 0.9 + tok.userData.phase) * 0.06);
        }
        if (composer) composer.render();
        else renderer.render(scene, camera);
    }

    function frame(now: number) {
        raf = 0;
        if (disposed || !active) return;
        const dt = lastNow ? now - lastNow : 16;
        lastNow = now;
        if (motion) clock += Math.min(dt, 64) / 1000;
        for (const u of uniformsTimed) u.uTime.value = clock;

        if (!introDone && layout) {
            if (!introStart) introStart = now;
            const t = now - introStart;
            const total = 1500 + layout.stages.length * 180;
            const drawn = easeOutCubic(t / total);
            if (tubeUniforms) tubeUniforms.uDraw.value = drawn;
            if (haloUniforms) haloUniforms.uDraw.value = drawn;
            content?.children.forEach((o: any) => {
                if (o.userData?.kind === 'stage') {
                    const k = springOut((t - o.userData.index * 180) / 700);
                    o.scale.setScalar(Math.max(0.001, k));
                    o.position.y = o.userData.baseY - 2.5 * (1 - easeOutCubic((t - o.userData.index * 180) / 700));
                }
            });
            for (const [, tok] of tokens) {
                const d = tok.userData.stageIndex * 180 + 380 + (tok.userData.order % 12) * 45;
                tok.scale.setScalar(Math.max(0.001, springOut((t - d) / 620) * tok.userData.target));
            }
            if (t > total + 1300) {
                introDone = true;
                if (tubeUniforms) tubeUniforms.uDraw.value = 1;
                if (haloUniforms) haloUniforms.uDraw.value = 1;
                content?.children.forEach((o: any) => {
                    if (o.userData?.kind === 'stage') { o.scale.setScalar(1); o.position.y = o.userData.baseY; }
                });
                for (const [, tok] of tokens) tok.scale.setScalar(tok.userData.target);
            }
            dirty = true;
        }

        if (fly) {
            const k = easeInOut((now - fly.start) / fly.dur);
            const p = lerp3(fly.from, fly.to, k), q = lerp3(fly.fromT, fly.toT, k);
            camera.position.set(p.x, p.y + Math.sin(Math.PI * k) * fly.lift, p.z);
            controls.target.set(q.x, q.y, q.z);
            if (k >= 1) fly = null;
            dirty = true;
        }
        stepTour(now);

        if (motion && introDone) {
            for (const [, tok] of tokens) {
                const ud = tok.userData;
                ud.lift += (ud.liftTarget - ud.lift) * 0.16;
                tok.position.y = ud.baseY + ud.lift + Math.sin(clock * 1.25 + ud.phase) * 0.1;
                const cur = tok.scale.x;
                if (Math.abs(cur - ud.target) > 0.002) tok.scale.setScalar(cur + (ud.target - cur) * 0.18);
                ud.glow += (1 - ud.glow) * 0.03;
                for (const child of tok.children) {
                    const h = child.userData?.halo;
                    if (h) {
                        const hov = ud.target > 1 ? 1.35 : 1;
                        const breathe = 1 + Math.sin(clock * 2 + ud.phase) * 0.06;
                        child.material.opacity = Math.min(1, h.base * hov * ud.glow);
                        child.scale.setScalar(h.scale * breathe * (0.9 + 0.1 * ud.glow));
                    } else if (child.userData?.badge === 'doing') {
                        child.scale.setScalar(child.userData.base * (1 + Math.sin(clock * 4) * 0.12));
                    }
                }
            }
            if (selRing?.visible) selRing.rotation.z = clock * 0.8;
            if (dust) dust.rotation.y = clock * 0.012;
            if (beam) beam.material.uniforms.uOpacity.value = (light ? 0.12 : 0.22) * (0.8 + 0.2 * Math.sin(clock * 1.8));
            if (curve && comets.length) {
                for (const c of comets) {
                    const head = (clock * 0.045 + c.offset) % 1;
                    c.sprites.forEach((s, k) => {
                        const u = head - k * 0.0065;
                        s.visible = u > 0;
                        if (u > 0) s.position.copy(curve.getPointAt(u));
                    });
                }
            }
            for (let i = bursts.length - 1; i >= 0; i--) {
                const b = bursts[i];
                const k = (now - b.start) / 1100;
                if (k >= 1) {
                    b.obj.parent?.remove(b.obj);
                    b.obj.geometry.dispose();
                    b.obj.material.dispose();
                    bursts.splice(i, 1);
                    continue;
                }
                b.obj.scale.setScalar(0.5 + easeOutCubic(k) * 2.4);
                b.obj.material.opacity = 1 - k;
            }
            dirty = true;
            govern(dt);
        }

        const settling = controls.update();
        if (settling) dirty = true;
        if (dirty) {
            draw();
            labelRenderer.render(scene, camera);
            dirty = false;
            canvas.dataset.painted = '1';
        }
        // On demand otherwise: under reduced motion a still map costs nothing.
        if (animating() || settling) kick();
    }

    function kick() {
        if (!raf && active && !disposed) raf = requestAnimationFrame(frame);
    }

    function resize() {
        const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
        renderer.setSize(w, h, false);
        labelRenderer.setSize(w, h);
        if (composer) {
            composer.setPixelRatio(renderer.getPixelRatio());
            composer.setSize(w, h);
        }
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        for (const u of uniformsTimed) if (u.uScale) u.uScale.value = renderer.getPixelRatio();
        dirty = true;
        kick();
    }

    resize();

    return {
        setDoc(next, nextLayout) {
            const first = !layout;
            doc = next;
            layout = nextLayout;
            controls.maxDistance = Math.max(60, nextLayout.extent * 6);
            build();
            updateBloomWish();
            if (first) {
                const o = overviewPose();
                if (motion) {
                    camera.position.set(o.camera.x * 1.7, o.camera.y * 1.5 + 10, o.camera.z * 1.7);
                    controls.target.set(o.target.x, o.target.y, o.target.z);
                    startFly(o.camera, o.target, 2600);
                } else {
                    camera.position.set(o.camera.x, o.camera.y, o.camera.z);
                    controls.target.set(o.target.x, o.target.y, o.target.z);
                    controls.update();
                }
            }
            kick();
        },
        rebuild() { prevDone = null; build(); updateBloomWish(); kick(); },
        select(id) { selectedId = id; applySelection(); kick(); },
        flyToStage, flyToNode, overview, playTour, stopTour, resize,
        setActive(next) {
            active = next;
            lastNow = 0;
            if (next) { dirty = true; kick(); }
            else if (raf) { cancelAnimationFrame(raf); raf = 0; }
        },
        sample() {
            draw();
            const gl = renderer.getContext();
            const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
            const step = 8;
            const px = new Uint8Array(4);
            let n = 0, sum = 0, sum2 = 0;
            for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 40))) {
                for (let x = 0; x < w; x += Math.max(step, Math.floor(w / 60))) {
                    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
                    const l = 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2];
                    n++; sum += l; sum2 += l * l;
                }
            }
            const mean = sum / (n || 1);
            return Math.round(sum2 / (n || 1) - mean * mean);
        },
        dispose() {
            disposed = true;
            if (raf) cancelAnimationFrame(raf);
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerdown', onDown);
            canvas.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('pointerleave', onLeave);
            canvas.removeEventListener('webglcontextlost', onLost);
            controls.dispose();
            disableBloom();
            disposeContent();
            envTex.dispose();
            pmrem.dispose();
            renderer.dispose();
            try { renderer.forceContextLoss(); } catch { /* already gone */ }
            while (labelLayer.firstChild) labelLayer.removeChild(labelLayer.firstChild);
        },
    };
}
