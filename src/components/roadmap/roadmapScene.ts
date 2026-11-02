/**
 * The 3D roadmap scene — three.js, imported ONLY when somebody opens 3D.
 *
 * `three` is never statically imported anywhere on this route (working rule
 * 47): the view chunk carries none of it, and a learner who stays in 2D never
 * downloads a 3D engine. The import promise is cached, failures included, so
 * two mounts join one download and a chunk that 404s after a deploy is not
 * retried per mount.
 *
 * What DECIDES lives in `@/utils/roadmapLayout` (positions, tour stops,
 * progress) and is checked in node. This file only draws, and the five ways a
 * renderer fails silently here are each handled on purpose:
 *
 *  - **a canvas cannot read a CSS custom property** (working rule 37): every
 *    colour is resolved off `<html>` with getComputedStyle, and the component
 *    REBUILDS the scene when `data-theme` changes rather than recolouring it;
 *  - **a renderer nobody is looking at still burns a GPU**: the loop stops when
 *    the host is off screen or the tab is hidden, and under
 *    prefers-reduced-motion it renders only on demand;
 *  - **everything allocated is disposed** — geometries, materials, the label
 *    layer's DOM, the context itself — or ten visits leak ten WebGL contexts
 *    and the browser silently drops the oldest;
 *  - **labels are DOM** (CSS2DRenderer), so they are real text: crisp at any
 *    zoom, readable by a screen reader, and never `innerHTML` — a title is
 *    record text and is set with `textContent`;
 *  - **a click is not a drag**: a pointer that moved more than a few pixels
 *    between down and up was orbiting, and selecting a node at the end of
 *    every orbit is how a 3D map becomes unusable.
 */

import {
    KIND_META, STATUS_META, easeInOut, lerp3, progressStats, statusOf,
    type Layout3D, type NodeKind, type RoadmapDoc, type Vec3,
} from '@/utils/roadmapLayout';

/* eslint-disable @typescript-eslint/no-explicit-any */

// three ships no type declarations in this repo; the scene types it as `any`,
// exactly as HelperGuide3D.ts does.
let pending: Promise<{ THREE: any; OrbitControls: any; CSS2DRenderer: any; CSS2DObject: any }> | null = null;
export function loadThree() {
    if (!pending) {
        pending = Promise.all([
            // @ts-ignore
            import('three'),
            // @ts-ignore
            import('three/examples/jsm/controls/OrbitControls.js'),
            // @ts-ignore
            import('three/examples/jsm/renderers/CSS2DRenderer.js'),
        ]).then(([THREE, orbit, css2d]: any[]) => ({
            THREE, OrbitControls: orbit.OrbitControls,
            CSS2DRenderer: css2d.CSS2DRenderer, CSS2DObject: css2d.CSS2DObject,
        })).catch((e: unknown) => { pending = null; throw e; });
    }
    return pending;
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

export async function createRoadmapScene(opts: SceneOptions): Promise<RoadmapScene> {
    const { THREE, OrbitControls, CSS2DRenderer, CSS2DObject } = await loadThree();
    const { host, canvas, labelLayer, motion } = opts;

    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));

    const labelRenderer = new CSS2DRenderer({ element: labelLayer });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
    camera.position.set(40, 30, 40);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 4;
    controls.maxDistance = 220;
    controls.rotateSpeed = 0.7;

    let doc: RoadmapDoc | null = null;
    let layout: Layout3D | null = null;
    let content: any = null;           // the group holding everything rebuildable
    let selectedId: string | null = null;
    let hoverId: string | null = null;
    let focusStage: string | null = null;
    const nodeMeshes = new Map<string, any>();
    const nodeLabels = new Map<string, HTMLElement>();
    const pickables: any[] = [];
    let depLines: any = null;
    let pulse: any = null;
    let curve: any = null;
    let tube: any = null;
    let tubeIndexCount = 0;

    let active = true;
    let raf = 0;
    let disposed = false;
    let dirty = true;
    let introStart = 0;
    let introDone = !motion;
    let fly: { from: Vec3; to: Vec3; fromT: Vec3; toT: Vec3; start: number; dur: number } | null = null;
    let tour: { index: number; until: number } | null = null;

    const v3 = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z);
    const color = (name: string, fallback: string) => {
        const c = new THREE.Color();
        try { c.setStyle(token(name, fallback)); } catch { c.set(fallback); }
        return c;
    };

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
        nodeMeshes.clear();
        nodeLabels.clear();
        pickables.length = 0;
        depLines = null;
        pulse = null;
        tube = null;
        curve = null;
    }

    function labelEl(cls: string, text: string, sub?: string): HTMLElement {
        const el = document.createElement('div');
        el.className = cls;
        const a = document.createElement('span');
        a.className = 'rm3d-label__title';
        a.textContent = text;
        el.appendChild(a);
        if (sub) {
            const b = document.createElement('span');
            b.className = 'rm3d-label__sub';
            b.textContent = sub;
            el.appendChild(b);
        }
        return el;
    }

    function geometryFor(kind: NodeKind, s: number) {
        switch (KIND_META[kind].shape3d) {
            case 'octahedron': return new THREE.OctahedronGeometry(s * 1.15);
            case 'sphere': return new THREE.SphereGeometry(s, 24, 16);
            case 'box': return new THREE.BoxGeometry(s * 1.45, s * 1.45, s * 1.45);
            case 'cylinder': return new THREE.CylinderGeometry(s * 0.72, s * 0.72, s * 1.6, 20);
            default: return new THREE.TetrahedronGeometry(s * 1.25);
        }
    }

    function build() {
        disposeContent();
        if (!doc || !layout) return;
        const C = {
            space: color('--sfs-space', '#0b1020'),
            text: color('--sfs-text', '#f1f5f9'),
            line: color('--sfs-border-strong', '#64748b'),
            accent: color('--sfs-accent', '#667eea'),
            surface: color('--sfs-surface-2', '#1e2235'),
            star: color('--sfs-galaxy-star', '#ffffff'),
            done: color(STATUS_META.done.token, STATUS_META.done.fallback),
            doing: color(STATUS_META.doing.token, STATUS_META.doing.fallback),
        };
        const light = token('--sfs-mode', '').includes('light')
            || document.documentElement.getAttribute('data-mode') === 'light';

        scene.background = C.space.clone();
        scene.fog = new THREE.Fog(C.space.clone(), layout.extent * 2.2, layout.extent * 6);

        content = new THREE.Group();
        scene.add(content);

        content.add(new THREE.HemisphereLight(0xffffff, C.space.clone(), light ? 1.4 : 1.1));
        const sun = new THREE.DirectionalLight(0xffffff, light ? 1.4 : 1.8);
        sun.position.set(20, 60, 30);
        content.add(sun);

        // A deterministic star field: a few hundred points, no Math.random,
        // so two renders of the same roadmap are the same picture.
        {
            const count = 420;
            const pos = new Float32Array(count * 3);
            let seed = 2166136261;
            const rnd = () => { seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0; seed ^= seed >>> 13; return (seed >>> 0) / 4294967295; };
            const R = layout.extent * 3.2;
            for (let i = 0; i < count; i++) {
                const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = R * (0.7 + rnd() * 0.3);
                const s = Math.sqrt(1 - u * u);
                pos[i * 3] = layout.center.x + r * s * Math.cos(th);
                pos[i * 3 + 1] = layout.center.y + r * u;
                pos[i * 3 + 2] = layout.center.z + r * s * Math.sin(th);
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const m = new THREE.PointsMaterial({
                color: light ? C.line : C.star, size: light ? 0.35 : 0.45, sizeAttenuation: true,
                transparent: true, opacity: light ? 0.35 : 0.75, depthWrite: false,
            });
            content.add(new THREE.Points(g, m));
        }

        // The journey: a tube along the helix, drawn on during the intro.
        if (layout.path.length > 1) {
            curve = new THREE.CatmullRomCurve3(layout.path.map(v3), false, 'centripetal');
            const segs = Math.max(32, layout.path.length * 8);
            const g = new THREE.TubeGeometry(curve, segs, 0.2, 10, false);
            tubeIndexCount = g.index ? g.index.count : 0;
            const m = new THREE.MeshStandardMaterial({
                color: C.accent, emissive: C.accent, emissiveIntensity: light ? 0.25 : 0.55,
                roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.85,
            });
            tube = new THREE.Mesh(g, m);
            if (!introDone) g.setDrawRange(0, 0);
            content.add(tube);

            if (motion) {
                pulse = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12),
                    new THREE.MeshBasicMaterial({ color: C.text, transparent: true, opacity: 0.9 }));
                content.add(pulse);
            }
        }

        const stats = progressStats(doc);
        const geomCache = new Map<NodeKind, any>();
        const linePoints: number[] = [];

        layout.stages.forEach((ps, i) => {
            const stage = doc!.stages[i];
            const g = new THREE.Group();
            g.position.set(ps.x, ps.y, ps.z);
            g.userData = { stageId: ps.id, index: i, kind: 'stage' };

            const platform = new THREE.Mesh(
                new THREE.CylinderGeometry(ps.radius, ps.radius * 1.12, 0.45, 48),
                new THREE.MeshStandardMaterial({ color: C.surface, roughness: 0.55, metalness: 0.25,
                    emissive: C.accent, emissiveIntensity: light ? 0.05 : 0.12 }),
            );
            g.add(platform);

            // The rim: a full ring in the line colour, and over it the done
            // fraction of this stage as an arc in the success hue.
            const rim = new THREE.Mesh(new THREE.TorusGeometry(ps.radius + 0.25, 0.07, 8, 72),
                new THREE.MeshBasicMaterial({ color: C.line, transparent: true, opacity: 0.6 }));
            rim.rotation.x = Math.PI / 2;
            rim.position.y = 0.25;
            g.add(rim);
            const pct = (stats.stages[i]?.percent ?? 0) / 100;
            if (pct > 0) {
                const arc = new THREE.Mesh(new THREE.TorusGeometry(ps.radius + 0.25, 0.14, 8, 72, Math.PI * 2 * pct),
                    new THREE.MeshBasicMaterial({ color: C.done }));
                arc.rotation.x = Math.PI / 2;
                arc.position.y = 0.27;
                g.add(arc);
            }

            const stageLabel = new CSS2DObject(labelEl('rm3d-label rm3d-label--stage',
                opts.labels.stage(i, stage?.title || ''), stage?.weeks ? `${stage.weeks}` : undefined));
            stageLabel.position.set(0, -0.9, 0);
            g.add(stageLabel);

            if (!introDone) g.scale.setScalar(0.001);
            content.add(g);
        });

        for (const pn of layout.nodes) {
            const node = doc.stages.find(s => s.id === pn.stageId)?.nodes.find(n => n.id === pn.id);
            if (!node) continue;
            const status = statusOf(doc, pn.id);
            let geom = geomCache.get(pn.kind);
            if (!geom) { geom = geometryFor(pn.kind, pn.size); geomCache.set(pn.kind, geom); }
            const kindColor = color(KIND_META[pn.kind].token, KIND_META[pn.kind].fallback);
            const mat = new THREE.MeshStandardMaterial({
                color: kindColor, roughness: 0.35, metalness: 0.15,
                emissive: status === 'done' ? C.done : status === 'doing' ? C.doing : kindColor,
                emissiveIntensity: status ? 0.55 : (light ? 0.08 : 0.18),
                transparent: node.optional, opacity: node.optional ? 0.72 : 1,
            });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(pn.x, pn.y, pn.z);
            mesh.userData = { nodeId: pn.id, stageId: pn.stageId, baseY: pn.y, phase: (pickables.length * 0.7) % 6.28 };
            if (status) {
                const halo = new THREE.Mesh(new THREE.TorusGeometry(pn.size * 1.45, 0.06, 8, 40),
                    new THREE.MeshBasicMaterial({ color: status === 'done' ? C.done : C.doing }));
                halo.rotation.x = Math.PI / 2;
                halo.userData = { halo: true };
                mesh.add(halo);
            }
            if (!introDone) mesh.scale.setScalar(0.001);
            content.add(mesh);
            nodeMeshes.set(pn.id, mesh);
            pickables.push(mesh);

            const label = new CSS2DObject(labelEl('rm3d-label rm3d-label--node', node.title, opts.labels.kind(pn.kind)));
            label.position.set(0, pn.size + 0.55, 0);
            label.element.dataset.node = pn.id;
            mesh.add(label);
            nodeLabels.set(pn.id, label.element);

            const ps = layout.stages.find(s => s.id === pn.stageId)!;
            linePoints.push(ps.x, ps.y + 0.25, ps.z, pn.x, pn.y, pn.z);
        }
        geomCache.clear(); // owned by the meshes now; disposed through them

        {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
            content.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({
                color: C.line, transparent: true, opacity: light ? 0.45 : 0.35 })));
        }

        applySelection();
        dirty = true;
    }

    /** Dependency lines and labels for the selection and the focused stage. */
    function applySelection() {
        if (!doc || !content) return;
        if (depLines) {
            content.remove(depLines);
            depLines.geometry.dispose();
            depLines.material.dispose();
            depLines = null;
        }
        const pts: number[] = [];
        if (selectedId) {
            const found = doc.stages.flatMap(s => s.nodes);
            for (const n of found) {
                const linked = n.id === selectedId ? n.depends_on : n.depends_on.includes(selectedId) ? [selectedId] : [];
                for (const dep of linked) {
                    const a = nodeMeshes.get(dep), b = nodeMeshes.get(n.id);
                    if (!a || !b) continue;
                    pts.push(a.position.x, a.position.y, a.position.z, b.position.x, b.position.y, b.position.z);
                }
            }
        }
        if (pts.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
            depLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: color('--sfs-accent', '#667eea') }));
            content.add(depLines);
        }
        for (const [id, mesh] of nodeMeshes) {
            const sel = id === selectedId;
            const target = sel ? 1.45 : id === hoverId ? 1.2 : 1;
            if (introDone) mesh.scale.setScalar(target);
            mesh.userData.target = target;
            const el = nodeLabels.get(id);
            if (el) {
                const show = sel || id === hoverId || mesh.userData.stageId === focusStage;
                el.classList.toggle('is-shown', show);
                el.classList.toggle('is-selected', sel);
                el.classList.toggle('is-hover', id === hoverId);
            }
        }
        canvas.style.cursor = hoverId ? 'pointer' : '';
        dirty = true;
    }

    /* ---------------------------------------------------------- camera */

    function startFly(cam: Vec3, target: Vec3, dur = 1400) {
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
        fly = { from, to: cam, fromT, toT: target, start: performance.now(), dur };
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
        const mesh = nodeMeshes.get(id);
        const stop = layout?.tour.find(s => s.stageId === mesh?.userData.stageId);
        if (!mesh || !stop) return;
        focusStage = stop.stageId;
        opts.onFocus(stop.stageId);
        const p = mesh.position;
        const dir = { x: stop.camera.x - stop.target.x, y: stop.camera.y - stop.target.y, z: stop.camera.z - stop.target.z };
        const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
        const k = 7.5 / len;
        startFly({ x: p.x + dir.x * k, y: p.y + dir.y * k, z: p.z + dir.z * k }, { x: p.x, y: p.y, z: p.z }, 1100);
        applySelection();
    }

    /**
     * The whole-map camera for THIS canvas shape. The layout's overview is
     * framed for a landscape canvas; a portrait phone canvas has far less
     * horizontal field, so the camera stands further back by the aspect.
     */
    function overviewPose(): { camera: Vec3; target: Vec3 } {
        const o = layout!.overview;
        const k = camera.aspect < 1 ? Math.min(1.8, 1 / Math.max(0.3, camera.aspect)) : 1;
        const c = o.target;
        return {
            target: c,
            camera: { x: c.x + (o.camera.x - c.x) * k, y: c.y + (o.camera.y - c.y) * k, z: c.z + (o.camera.z - c.z) * k },
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
        tour = { index: 0, until: performance.now() + (motion ? 1400 + DWELL : DWELL) };
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
        tour.until = now + (motion ? 1400 + DWELL : DWELL);
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
        const id = pick(ev);
        opts.onSelect(id);
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

    /* ---------------------------------------------------------- loop */

    function animating(): boolean {
        return !introDone || !!fly || !!tour || motion;
    }

    function frame(now: number) {
        raf = 0;
        if (disposed || !active) return;

        if (!introDone && layout) {
            if (!introStart) introStart = now;
            const t = now - introStart;
            const total = 1200 + layout.stages.length * 220;
            if (tube && tubeIndexCount) {
                tube.geometry.setDrawRange(0, Math.floor(tubeIndexCount * Math.min(1, t / total) / 3) * 3);
            }
            content?.children.forEach((o: any) => {
                if (o.userData?.kind === 'stage') {
                    const k = easeInOut((t - o.userData.index * 220) / 500);
                    o.scale.setScalar(Math.max(0.001, k));
                }
            });
            for (const [, mesh] of nodeMeshes) {
                const si = layout.stages.findIndex(s => s.id === mesh.userData.stageId);
                const k = easeInOut((t - si * 220 - 260) / 450);
                mesh.scale.setScalar(Math.max(0.001, k * (mesh.userData.target || 1)));
            }
            if (t > total + 700) {
                introDone = true;
                if (tube) tube.geometry.setDrawRange(0, Infinity);
                content?.children.forEach((o: any) => { if (o.userData?.kind === 'stage') o.scale.setScalar(1); });
                for (const [, mesh] of nodeMeshes) mesh.scale.setScalar(mesh.userData.target || 1);
            }
            dirty = true;
        }

        if (fly) {
            const k = easeInOut((now - fly.start) / fly.dur);
            const p = lerp3(fly.from, fly.to, k), q = lerp3(fly.fromT, fly.toT, k);
            camera.position.set(p.x, p.y, p.z);
            controls.target.set(q.x, q.y, q.z);
            if (k >= 1) fly = null;
            dirty = true;
        }
        stepTour(now);

        if (motion && introDone) {
            const s = now / 1000;
            for (const [, mesh] of nodeMeshes) {
                mesh.position.y = mesh.userData.baseY + Math.sin(s * 1.3 + mesh.userData.phase) * 0.12;
                mesh.rotation.y = s * 0.4 + mesh.userData.phase;
                const target = mesh.userData.target || 1;
                const cur = mesh.scale.x;
                if (Math.abs(cur - target) > 0.002) mesh.scale.setScalar(cur + (target - cur) * 0.2);
            }
            if (pulse && curve) {
                const u = (s * 0.06) % 1;
                const p = curve.getPointAt(u);
                pulse.position.copy(p);
            }
            dirty = true;
        }

        const settling = controls.update();
        if (settling) dirty = true;
        if (dirty) {
            renderer.render(scene, camera);
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
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
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
            if (first) {
                const o = overviewPose();
                if (motion) {
                    camera.position.set(o.camera.x * 1.7, o.camera.y * 1.5 + 10, o.camera.z * 1.7);
                    controls.target.set(o.target.x, o.target.y, o.target.z);
                    startFly(o.camera, o.target, 2200);
                } else {
                    camera.position.set(o.camera.x, o.camera.y, o.camera.z);
                    controls.target.set(o.target.x, o.target.y, o.target.z);
                    controls.update();
                }
            }
            kick();
        },
        rebuild() { build(); kick(); },
        select(id) { selectedId = id; applySelection(); kick(); },
        flyToStage, flyToNode, overview, playTour, stopTour, resize,
        setActive(next) {
            active = next;
            if (next) { dirty = true; kick(); }
            else if (raf) { cancelAnimationFrame(raf); raf = 0; }
        },
        sample() {
            renderer.render(scene, camera);
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
            disposeContent();
            renderer.dispose();
            try { renderer.forceContextLoss(); } catch { /* already gone */ }
            while (labelLayer.firstChild) labelLayer.removeChild(labelLayer.firstChild);
        },
    };
}
