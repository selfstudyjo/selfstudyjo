/**
 * The three.js half of the lab documentation: one renderer, its lifecycle, and
 * the few primitives every illustration is built from.
 *
 * ONLY EVER REACHED THROUGH `await import()` (working rule 47): `three` is the
 * second-largest thing this app ships and the Definitions window is opened by a
 * minority of visits. This file and the two that build on it land in one chunk
 * with the engine.
 *
 * Cost discipline, because these illustrations sit beside text a student is
 * READING and must never be the reason a laptop fan spins up:
 *   - one canvas per open illustration, disposed (context and all) on close;
 *   - the loop stops when the canvas scrolls out of view or the tab is hidden;
 *   - device pixel ratio capped at 1.75, low-poly geometry, no shadow maps;
 *   - `prefers-reduced-motion`: ONE frame is drawn, posed mid-animation so it
 *     still explains something, and nothing moves afterwards.
 */
import * as THREE from 'three';

export interface Palette {
    ink: string;
    muted: string;
    accent: string;
    accent2: string;
    accent3: string;
    surface: string;
    good: string;
    bad: string;
}

export type Update = (t: number, dt: number) => void;

export interface Stage {
    THREE: typeof THREE;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    root: THREE.Group;
    palette: Palette;
    reduced: boolean;
    setUpdate(fn: Update | null): void;
    /** Pose time used for the single reduced-motion frame. */
    pose: number;
    renderOnce(): void;
    dispose(): void;
}

export function createStage(canvas: HTMLCanvasElement, palette: Palette,
                            opts: { reduced: boolean; camera?: [number, number, number]; target?: [number, number, number]; fov?: number } ) : Stage {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power',
        // Kept so the preview harness can read the pixels back and prove the
        // scene painted; at these canvas sizes the cost is nil.
        preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(opts.fov ?? 38, 16 / 9, 0.1, 100);
    const [cx, cy, cz] = opts.camera ?? [0, 3.4, 9.2];
    camera.position.set(cx, cy, cz);
    const [tx, ty, tz] = opts.target ?? [0, 0.4, 0];
    camera.lookAt(tx, ty, tz);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(4, 8, 6);
    scene.add(sun);
    const root = new THREE.Group();
    scene.add(root);

    let update: Update | null = null;
    let frame = 0;
    let running = false;
    let visible = true;
    let last = 0;
    let elapsed = 0;

    const stage: Stage = {
        THREE, scene, camera, root, palette, reduced: opts.reduced, pose: 2.2,
        setUpdate(fn) { update = fn; if (stage.reduced) stage.renderOnce(); },
        renderOnce() {
            if (update) update(stage.pose, 0);
            renderer.render(scene, camera);
        },
        dispose() {
            running = false;
            cancelAnimationFrame(frame);
            observer.disconnect();
            seen?.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
            scene.traverse(obj => {
                const mesh = obj as THREE.Mesh;
                mesh.geometry?.dispose?.();
                const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
                for (const m of mats) {
                    (m as THREE.MeshBasicMaterial).map?.dispose();
                    m.dispose();
                }
            });
            renderer.dispose();
            renderer.forceContextLoss();
        },
    };

    const resize = () => {
        const host = canvas.parentElement || canvas;
        const w = Math.max(120, host.clientWidth);
        const h = Math.max(90, host.clientHeight || Math.round(w * 9 / 16));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (stage.reduced || !running) stage.renderOnce();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement || canvas);

    const tick = (now: number) => {
        if (!running) return;
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        elapsed += dt;
        if (update) update(elapsed, dt);
        renderer.render(scene, camera);
        frame = requestAnimationFrame(tick);
    };
    const start = () => {
        if (running || stage.reduced || !visible || document.hidden) return;
        running = true;
        last = 0;
        frame = requestAnimationFrame(tick);
    };
    const stop = () => { running = false; cancelAnimationFrame(frame); };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    const seen = typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(entries => {
            visible = entries.some(e => e.isIntersecting);
            if (visible) start(); else stop();
        })
        : null;
    seen?.observe(canvas);
    resize();
    start();
    return stage;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function mat(stage: Stage, color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08, ...extra });
}

export function box(stage: Stage, w: number, h: number, d: number, color: string, extra?: THREE.MeshStandardMaterialParameters) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(stage, color, extra));
    return mesh;
}

export function sphere(stage: Stage, r: number, color: string, extra?: THREE.MeshStandardMaterialParameters) {
    return new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(stage, color, extra));
}

export function cylinder(stage: Stage, rt: number, rb: number, h: number, color: string, extra?: THREE.MeshStandardMaterialParameters, open = false) {
    return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 28, 1, open), mat(stage, color, extra));
}

/** A straight connector between two points, as a thin cylinder (lines are 1px on most GPUs). */
export function link(stage: Stage, a: THREE.Vector3, b: THREE.Vector3, color: string, radius = 0.025) {
    const len = a.distanceTo(b);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 8), mat(stage, color, { transparent: true, opacity: 0.75 }));
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return mesh;
}

/**
 * A text label as a sprite from a 2D canvas: always faces the camera, crisp at
 * any rotation, and costs one quad. Text is drawn by the browser, so Arabic and
 * Chinese shape correctly - the labels in the glossary are English today, the
 * next language should not need a font atlas.
 */
export function label(stage: Stage, text: string, opts: { size?: number; color?: string; bg?: string } = {}) {
    const size = opts.size ?? 0.34;
    const font = 44;
    const pad = 18;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    ctx.font = `600 ${font}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    const h = font + pad * 1.4;
    c.width = w;
    c.height = h;
    ctx.font = `600 ${font}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = opts.bg ?? 'rgba(15, 18, 32, 0.78)';
    const r = 16;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r); ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r);
    ctx.fill();
    ctx.fillStyle = opts.color ?? '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad, h / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 2;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(size * (w / h), size, 1);
    sprite.renderOrder = 10;
    return sprite;
}

export function ease(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

/** Evenly spread n values across [-span/2, span/2]. */
export function spread(n: number, span: number): number[] {
    if (n <= 1) return [0];
    return Array.from({ length: n }, (_, i) => -span / 2 + (span * i) / (n - 1));
}
