/**
 * The Roblox Studio viewport: a real WebGL scene (three.js), Studio's camera,
 * the Select / Move / Scale / Rotate tools, and Play mode with a character you
 * walk around with.
 *
 * Fast by construction:
 *  - ONE shared unit geometry per shape; a part is that geometry scaled to its
 *    Size, so Scale is `mesh.scale` and nothing is ever rebuilt on a resize.
 *  - Materials are cached by colour + material + transparency.
 *  - The scene is diffed by part key, never rebuilt, when the view refreshes.
 *  - In edit mode a frame is drawn only when something changed.
 *  - Play collisions use a uniform spatial hash (16-stud cells) of axis-aligned
 *    boxes, resolved one axis at a time - a handful of box tests per frame.
 *
 * Coordinates are Roblox's: Y up, studs, Orientation in degrees applied Y,
 * then X, then Z (three's 'YXZ' order).
 */
import type * as THREE_NS from 'three';

type THREE = typeof THREE_NS;

export interface PartSpec {
    key: string | number;
    path: string;
    name: string;
    cls: string;
    pos: number[];
    size: number[];
    rot: number[];
    color: number[];
    transparency: number;
    material: string;
    shape: string;
    collide: boolean;
    touch: boolean;
    gone?: boolean;
    locked?: boolean;
}

export type Tool = 'select' | 'move' | 'scale' | 'rotate';

export interface ViewportEvents {
    select(key: string | number | null): void;
    transform(key: string | number, pos: number[], size: number[], rot: number[]): void;
    touch(path: string): void;
    prompt(path: string): void;
    click(path: string): void;
    fell(): void;
    hover?(text: string): void;
}

interface Box { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number;
    spec: PartSpec; }

const CELL = 16;
const SELECT_BLUE = 0x0d99ff;

export class StudioViewport {
    private T!: THREE;
    private renderer!: THREE_NS.WebGLRenderer;
    private scene!: THREE_NS.Scene;
    private camera!: THREE_NS.PerspectiveCamera;
    private gizmo: any = null;
    private gizmoHelper: THREE_NS.Object3D | null = null;
    private meshes = new Map<string | number, THREE_NS.Mesh>();
    private specs = new Map<string | number, PartSpec>();
    private geometries: Record<string, THREE_NS.BufferGeometry> = {};
    private materials = new Map<string, THREE_NS.Material>();
    private outline: THREE_NS.BoxHelper | null = null;
    private raycaster!: THREE_NS.Raycaster;
    private dirty = true;
    private frame = 0;
    private last = 0;
    private destroyed = false;
    private resize?: ResizeObserver;
    private keys = new Set<string>();
    private yaw = Math.PI / 4;
    private pitch = -0.5;
    private looking = false;
    private panning = false;
    private lastMouse = [0, 0];
    private downAt = [0, 0];
    private dragging: { key: string | number; offset: THREE_NS.Vector3; plane: THREE_NS.Plane } | null = null;
    selected: string | number | null = null;
    tool: Tool = 'select';
    snap = 1;
    rotateSnap = 15;
    space: 'world' | 'local' = 'world';
    mode: 'edit' | 'play' = 'edit';

    // -- play state
    private character: THREE_NS.Group | null = null;
    private velocity = [0, 0, 0];
    private onGround = false;
    private walkSpeed = 16;
    private jumpPower = 50;
    private gravity = 196.2;
    private grid = new Map<string, Box[]>();
    private boxes: Box[] = [];
    private touching = new Set<string>();
    private camDistance = 16;
    private prompts: { path: string; text: string; key: string; distance: number }[] = [];
    private clickable = new Set<string>();
    private joy = [0, 0];
    private jumpHeld = false;
    private facing = 0;
    private nearPrompt: { path: string; text: string; key: string } | null = null;

    constructor(private host: HTMLElement, private on: ViewportEvents) {}

    async init() {
        const T = (await import('three')) as unknown as THREE;
        const { TransformControls } = await import('three/examples/jsm/controls/TransformControls.js');
        if (this.destroyed) return;
        this.T = T;
        const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFShadowMap;
        renderer.domElement.tabIndex = 0;
        renderer.domElement.className = 'rs-gl';
        this.host.appendChild(renderer.domElement);
        this.renderer = renderer;

        const scene = new T.Scene();
        scene.background = new T.Color(0xa9cdf2);
        scene.fog = new T.Fog(0xc7def5, 400, 1400);
        this.scene = scene;
        scene.add(new T.HemisphereLight(0xdfefff, 0x5a5550, 1.1));
        const sun = new T.DirectionalLight(0xffffff, 1.6);
        sun.position.set(120, 200, 80);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 1, far: 600 });
        scene.add(sun);
        scene.add(sun.target);

        this.camera = new T.PerspectiveCamera(70, 1, 0.1, 5000);
        this.camera.position.set(30, 26, 30);
        this.raycaster = new T.Raycaster();

        this.geometries.Block = new T.BoxGeometry(1, 1, 1);
        this.geometries.Ball = new T.SphereGeometry(0.5, 24, 16);
        const cyl = new T.CylinderGeometry(0.5, 0.5, 1, 24);
        cyl.rotateZ(Math.PI / 2);                       // Roblox cylinders run along X
        this.geometries.Cylinder = cyl;
        const wedge = new T.BufferGeometry();
        const v = [-.5, -.5, -.5, .5, -.5, -.5, .5, -.5, .5, -.5, -.5, .5, -.5, .5, .5, .5, .5, .5];
        wedge.setAttribute('position', new T.Float32BufferAttribute(v, 3));
        wedge.setIndex([0, 2, 1, 0, 3, 2, 3, 4, 5, 3, 5, 2, 0, 1, 5, 0, 5, 4, 0, 4, 3, 1, 2, 5]);
        wedge.computeVertexNormals();
        this.geometries.Wedge = wedge;

        const gizmo = new TransformControls(this.camera, renderer.domElement);
        gizmo.setSize(0.9);
        gizmo.addEventListener('dragging-changed', (e: any) => {
            if (!e.value) this.commitGizmo();
        });
        gizmo.addEventListener('change', () => { this.dirty = true; this.outline?.update(); });
        this.gizmo = gizmo;
        this.gizmoHelper = typeof gizmo.getHelper === 'function' ? gizmo.getHelper() : gizmo;
        scene.add(this.gizmoHelper!);

        this.bindInput();
        this.resize = new ResizeObserver(() => this.fit());
        this.resize.observe(this.host);
        this.fit();
        this.aim();
        this.loop(performance.now());
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.frame);
        this.resize?.disconnect();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('pointerup', this.onPointerUp);
        window.removeEventListener('pointermove', this.onPointerMove);
        this.gizmo?.dispose?.();
        for (const m of this.materials.values()) m.dispose();
        for (const g of Object.values(this.geometries)) g.dispose();
        this.renderer?.dispose();
        this.renderer?.domElement.remove();
    }

    // =====================================================================
    // Parts
    // =====================================================================
    private material(spec: PartSpec): THREE_NS.Material {
        const T = this.T;
        const t = Math.max(0, Math.min(1, Number(spec.transparency) || 0));
        const key = `${spec.color.join(',')}|${spec.material}|${t.toFixed(2)}`;
        let m = this.materials.get(key);
        if (m) return m;
        const color = new T.Color(spec.color[0] / 255, spec.color[1] / 255, spec.color[2] / 255);
        const opts: THREE_NS.MeshStandardMaterialParameters = { color, roughness: 0.75, metalness: 0 };
        switch (spec.material) {
            case 'Neon': Object.assign(opts, { emissive: color, emissiveIntensity: 0.9 }); break;
            case 'Metal': case 'DiamondPlate': case 'CorrodedMetal': case 'Foil':
                Object.assign(opts, { metalness: 0.75, roughness: 0.35 }); break;
            case 'SmoothPlastic': Object.assign(opts, { roughness: 0.4 }); break;
            case 'Glass': Object.assign(opts, { roughness: 0.05, metalness: 0.1 }); break;
            case 'Ice': Object.assign(opts, { roughness: 0.1 }); break;
            case 'Wood': case 'WoodPlanks': case 'Grass': case 'Sand': case 'Fabric':
                Object.assign(opts, { roughness: 0.95 }); break;
        }
        const alpha = spec.material === 'Glass' ? Math.min(1 - t, 0.55) : 1 - t;
        if (alpha < 1) Object.assign(opts, { transparent: true, opacity: Math.max(alpha, 0.06), depthWrite: alpha > 0.5 });
        if (spec.material === 'ForceField') Object.assign(opts, { wireframe: true, transparent: true, opacity: 0.5 });
        m = new T.MeshStandardMaterial(opts);
        if (spec.name === 'Baseplate' && !spec.material.includes('Grass')) this.applyGrid(m as THREE_NS.MeshStandardMaterial, spec);
        this.materials.set(key + (spec.name === 'Baseplate' ? '|bp' + spec.size.join(',') : ''), m);
        return m;
    }

    /** Studio's baseplate grid: a 4-stud checker drawn once on a canvas. */
    private applyGrid(m: THREE_NS.MeshStandardMaterial, spec: PartSpec) {
        const T = this.T;
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d')!;
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, 64, 64);
        g.strokeStyle = 'rgba(0,0,0,0.22)';
        g.lineWidth = 2;
        g.strokeRect(1, 1, 62, 62);
        const tex = new T.CanvasTexture(c);
        tex.wrapS = tex.wrapT = T.RepeatWrapping;
        tex.repeat.set(spec.size[0] / 4, spec.size[2] / 4);
        tex.colorSpace = T.SRGBColorSpace;
        tex.anisotropy = 8;
        m.map = tex;
    }

    private placeMesh(mesh: THREE_NS.Mesh, spec: PartSpec) {
        const [x, y, z] = spec.pos;
        mesh.position.set(x, y, z);
        mesh.scale.set(Math.max(spec.size[0], 0.05), Math.max(spec.size[1], 0.05), Math.max(spec.size[2], 0.05));
        const d = Math.PI / 180;
        mesh.rotation.set(spec.rot[0] * d, spec.rot[1] * d, spec.rot[2] * d, 'YXZ');
    }

    /** Diff the scene against a list of parts. Returns nothing; marks dirty. */
    setParts(parts: PartSpec[]) {
        if (!this.T) return;
        const seen = new Set<string | number>();
        for (const spec of parts) {
            if (spec.gone) continue;
            seen.add(spec.key);
            const shape = this.geometries[spec.shape] ? spec.shape : (spec.cls === 'WedgePart' ? 'Wedge' : 'Block');
            let mesh = this.meshes.get(spec.key);
            const prev = this.specs.get(spec.key);
            if (!mesh || prev?.shape !== spec.shape || prev?.cls !== spec.cls) {
                if (mesh) this.scene.remove(mesh);
                mesh = new this.T.Mesh(this.geometries[shape], this.material(spec));
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData.key = spec.key;
                this.scene.add(mesh);
                this.meshes.set(spec.key, mesh);
            } else if (prev && (prev.color.join() !== spec.color.join() || prev.material !== spec.material
                || prev.transparency !== spec.transparency || prev.size.join() !== spec.size.join())) {
                mesh.material = this.material(spec);
            }
            if (!(this.gizmo?.dragging && this.gizmo.object === mesh) && this.dragging?.key !== spec.key) {
                this.placeMesh(mesh, spec);
            }
            mesh.castShadow = spec.transparency < 0.9;
            this.specs.set(spec.key, spec);
        }
        for (const [key, mesh] of this.meshes) {
            if (!seen.has(key)) {
                this.scene.remove(mesh);
                this.meshes.delete(key);
                this.specs.delete(key);
            }
        }
        if (this.selected != null && !this.meshes.has(this.selected)) this.setSelected(null);
        else this.refreshSelection();
        if (this.mode === 'play') this.buildGrid();
        this.dirty = true;
    }

    setSelected(key: string | number | null) {
        this.selected = key;
        this.refreshSelection();
    }

    private refreshSelection() {
        const T = this.T;
        if (!T) return;
        const mesh = this.selected != null ? this.meshes.get(this.selected) : undefined;
        if (this.outline) { this.scene.remove(this.outline); this.outline.dispose?.(); this.outline = null; }
        if (mesh && this.mode === 'edit') {
            this.outline = new T.BoxHelper(mesh, SELECT_BLUE);
            this.scene.add(this.outline);
        }
        const locked = mesh ? this.specs.get(this.selected!)?.locked : false;
        if (mesh && this.mode === 'edit' && this.tool !== 'select' && !locked) {
            if (this.gizmo.object !== mesh) this.gizmo.attach(mesh);
            this.gizmo.setMode(this.tool === 'move' ? 'translate' : this.tool);
            this.gizmo.setSpace(this.tool === 'scale' ? 'local' : this.space);
            this.gizmo.setTranslationSnap(this.snap || null);
            this.gizmo.setScaleSnap(this.snap ? this.snap : null);
            this.gizmo.setRotationSnap(this.rotateSnap ? (this.rotateSnap * Math.PI) / 180 : null);
        } else {
            this.gizmo?.detach();
        }
        this.dirty = true;
    }

    setTool(tool: Tool) { this.tool = tool; this.refreshSelection(); }
    setSnap(move: number, rotate: number) { this.snap = move; this.rotateSnap = rotate; this.refreshSelection(); }
    setSpace(space: 'world' | 'local') { this.space = space; this.refreshSelection(); }

    private commitGizmo() {
        const mesh = this.gizmo?.object as THREE_NS.Mesh | undefined;
        if (!mesh) return;
        const key = mesh.userData.key;
        const spec = this.specs.get(key);
        if (!spec) return;
        const d = 180 / Math.PI;
        const r = mesh.rotation.clone();
        r.reorder('YXZ');
        const pos = [mesh.position.x, mesh.position.y, mesh.position.z].map(n => round(n));
        const size = [mesh.scale.x, mesh.scale.y, mesh.scale.z].map(n => round(Math.abs(n)));
        const rot = [r.x * d, r.y * d, r.z * d].map(n => round(n));
        Object.assign(spec, { pos, size, rot });
        this.on.transform(key, pos, size, rot);
    }

    focusSelected() {
        const mesh = this.selected != null ? this.meshes.get(this.selected) : undefined;
        if (!mesh) return;
        const radius = Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z) * 1.6 + 6;
        const dir = this.forward();
        this.camera.position.copy(mesh.position).addScaledVector(dir, -radius);
        this.dirty = true;
    }

    /** Where a new part should go: in front of the camera, on the ground. */
    spawnPoint(): number[] {
        if (!this.T) return [0, 3, 0];
        const hit = this.pick(0, 0, true);
        const p = hit ? hit.point : this.camera.position.clone().addScaledVector(this.forward(), 20);
        return [Math.round(p.x), Math.max(0.5, Math.round(p.y) + 0.5), Math.round(p.z)];
    }

    // =====================================================================
    // Camera and input
    // =====================================================================
    private forward() {
        const T = this.T;
        return new T.Vector3(Math.cos(this.pitch) * Math.sin(this.yaw) * -1, Math.sin(this.pitch),
            Math.cos(this.pitch) * Math.cos(this.yaw) * -1).normalize();
    }

    private aim() {
        const f = this.forward();
        this.camera.lookAt(this.camera.position.clone().add(f));
        this.dirty = true;
    }

    private fit() {
        if (!this.renderer) return;
        const w = Math.max(10, this.host.clientWidth);
        const h = Math.max(10, this.host.clientHeight);
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.dirty = true;
    }

    private pick(nx: number, ny: number, groundOnly = false): THREE_NS.Intersection | null {
        this.raycaster.setFromCamera(new this.T.Vector2(nx, ny), this.camera);
        const list = [...this.meshes.values()].filter(m => !groundOnly || this.specs.get(m.userData.key)?.name === 'Baseplate'
            || !this.selected || m.userData.key !== this.selected);
        const hits = this.raycaster.intersectObjects(list, false);
        return hits[0] || null;
    }

    private ndc(e: PointerEvent | MouseEvent) {
        const r = this.renderer.domElement.getBoundingClientRect();
        return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (!this.renderer || !this.focused(e)) return;
        const k = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'q', 'e', ' ', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
            this.keys.add(k);
            if (this.mode === 'play' && k === ' ') { this.jumpHeld = true; e.preventDefault(); }
            if (this.mode === 'play' && k === 'e' && this.nearPrompt) this.on.prompt(this.nearPrompt.path);
            if (k.startsWith('arrow') || k === ' ') e.preventDefault();
        }
        if (this.mode === 'edit' && k === 'f' && !e.ctrlKey) this.focusSelected();
    };

    private onKeyUp = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        this.keys.delete(k);
        if (k === ' ') this.jumpHeld = false;
    };

    /** Keys only drive the viewport when no text field has focus. */
    private focused(e: KeyboardEvent) {
        const t = e.target as HTMLElement;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return false;
        return this.host.closest('.rs')?.contains(document.activeElement) || document.activeElement === document.body;
    }

    private onPointerUp = (e: PointerEvent) => {
        if (e.button === 2) this.looking = false;
        if (e.button === 1) this.panning = false;
        if (e.button === 0 && this.dragging) {
            const mesh = this.meshes.get(this.dragging.key);
            const spec = this.specs.get(this.dragging.key);
            if (mesh && spec) {
                const pos = [mesh.position.x, mesh.position.y, mesh.position.z].map(n => round(n));
                if (pos.join() !== spec.pos.join()) {
                    spec.pos = pos;
                    this.on.transform(spec.key, pos, spec.size, spec.rot);
                }
            }
            this.dragging = null;
        }
    };

    private onPointerMove = (e: PointerEvent) => {
        const dx = e.clientX - this.lastMouse[0];
        const dy = e.clientY - this.lastMouse[1];
        this.lastMouse = [e.clientX, e.clientY];
        if (this.looking) {
            if (this.mode === 'play') {
                this.yaw -= dx * 0.008;
                this.pitch = clamp(this.pitch - dy * 0.006, -1.3, 0.6);
            } else {
                this.yaw -= dx * 0.005;
                this.pitch = clamp(this.pitch - dy * 0.005, -1.5, 1.5);
                this.aim();
            }
            this.dirty = true;
        } else if (this.panning && this.mode === 'edit') {
            const T = this.T;
            const right = new T.Vector3().crossVectors(this.forward(), new T.Vector3(0, 1, 0)).normalize();
            const up = new T.Vector3().crossVectors(right, this.forward()).normalize();
            const s = 0.05 + this.camera.position.y * 0.002;
            this.camera.position.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
            this.dirty = true;
        } else if (this.dragging) {
            const [nx, ny] = this.ndc(e);
            this.raycaster.setFromCamera(new this.T.Vector2(nx, ny), this.camera);
            const p = new this.T.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragging.plane, p)) {
                p.add(this.dragging.offset);
                const mesh = this.meshes.get(this.dragging.key)!;
                const s = this.snap || 0;
                mesh.position.x = s ? Math.round(p.x / s) * s : p.x;
                mesh.position.z = s ? Math.round(p.z / s) * s : p.z;
                this.outline?.update();
                this.dirty = true;
            }
        }
    };

    private bindInput() {
        const el = this.renderer.domElement;
        el.addEventListener('contextmenu', e => e.preventDefault());
        el.addEventListener('pointerdown', e => {
            el.focus();
            this.lastMouse = [e.clientX, e.clientY];
            this.downAt = [e.clientX, e.clientY];
            if (e.button === 2) { this.looking = true; return; }
            if (e.button === 1) { this.panning = true; e.preventDefault(); return; }
            if (e.button !== 0) return;
            if (this.gizmo?.dragging || (this.gizmo?.axis && this.tool !== 'select')) return;
            const [nx, ny] = this.ndc(e);
            this.raycaster.setFromCamera(new this.T.Vector2(nx, ny), this.camera);
            const hit = this.raycaster.intersectObjects([...this.meshes.values()], false)[0];
            if (this.mode === 'play') {
                const key = hit?.object.userData.key;
                const spec = key != null ? this.specs.get(key) : null;
                if (spec && this.clickable.has(spec.path)) this.on.click(spec.path);
                else this.looking = true;
                return;
            }
            const key = hit ? hit.object.userData.key : null;
            this.on.select(key);
            this.setSelected(key);
            const spec = key != null ? this.specs.get(key) : null;
            if (hit && spec && this.tool === 'select' && !spec.locked) {
                const mesh = hit.object as THREE_NS.Mesh;
                const plane = new this.T.Plane(new this.T.Vector3(0, 1, 0), -mesh.position.y);
                const onPlane = new this.T.Vector3();
                this.raycaster.ray.intersectPlane(plane, onPlane);
                this.dragging = { key, offset: mesh.position.clone().sub(onPlane), plane };
            }
        });
        el.addEventListener('wheel', e => {
            e.preventDefault();
            if (this.mode === 'play') {
                this.camDistance = clamp(this.camDistance * (e.deltaY > 0 ? 1.12 : 0.89), 0.5, 120);
                return;
            }
            const [nx, ny] = this.ndc(e);
            this.raycaster.setFromCamera(new this.T.Vector2(nx, ny), this.camera);
            const step = clamp(this.camera.position.length() * 0.08, 1, 60) * (e.deltaY > 0 ? -1 : 1);
            this.camera.position.addScaledVector(this.raycaster.ray.direction, step);
            this.dirty = true;
        }, { passive: false });
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    }

    // =====================================================================
    // Play mode
    // =====================================================================
    startPlay(spawn: number[] | null) {
        const T = this.T;
        this.mode = 'play';
        this.gizmo?.detach();
        if (this.outline) { this.scene.remove(this.outline); this.outline = null; }
        const g = new T.Group();
        const part = (w: number, h: number, d: number, x: number, y: number, z: number, c: number) => {
            const m = new T.Mesh(this.geometries.Block, new T.MeshStandardMaterial({ color: c, roughness: 0.6 }));
            m.scale.set(w, h, d);
            m.position.set(x, y, z);
            m.castShadow = true;
            g.add(m);
            return m;
        };
        // A classic blocky avatar, 5 studs tall; the group origin is at the feet.
        part(1, 2, 1, -0.5, 1, 0, 0x4b974b);                // legs
        part(1, 2, 1, 0.5, 1, 0, 0x4b974b);
        part(2, 2, 1, 0, 3, 0, 0x0d69ac);                   // torso
        part(1, 2, 1, -1.5, 3, 0, 0xf5cd30);                // arms
        part(1, 2, 1, 1.5, 3, 0, 0xf5cd30);
        const head = part(1.2, 1.2, 1.2, 0, 4.6, 0, 0xf5cd30);
        const face = new T.Mesh(this.geometries.Block, new T.MeshBasicMaterial({ color: 0x1b1b1b }));
        face.scale.set(0.5, 0.12, 0.02);
        face.position.set(0, -0.2, -0.61);
        head.add(face);
        face.scale.set(0.42 / 1.2, 0.1 / 1.2, 0.02);
        this.scene.add(g);
        this.character = g;
        this.respawn(spawn);
        this.buildGrid();
        this.pitch = -0.35;
        this.camDistance = 16;
    }

    stopPlay() {
        this.mode = 'edit';
        if (this.character) { this.scene.remove(this.character); this.character = null; }
        this.touching.clear();
        this.nearPrompt = null;
        this.on.hover?.('');
        this.pitch = clamp(this.pitch, -1.5, 1.5);
        this.aim();
        this.refreshSelection();
    }

    respawn(at: number[] | null) {
        if (!this.character) return;
        const [x, y, z] = at || [0, 4, 0];
        this.character.position.set(x, y - 2.5, z);
        this.velocity = [0, 0, 0];
        this.touching.clear();
        this.dirty = true;
    }

    setPlayInfo(info: { walkSpeed?: number; jumpPower?: number; gravity?: number;
        prompts?: { path: string; text: string; key: string; distance: number }[]; clicks?: { path: string }[] }) {
        if (info.walkSpeed != null) this.walkSpeed = info.walkSpeed;
        if (info.jumpPower != null) this.jumpPower = info.jumpPower;
        if (info.gravity != null) this.gravity = info.gravity;
        this.prompts = info.prompts || [];
        this.clickable = new Set((info.clicks || []).map(c => c.path));
    }

    setJoystick(x: number, y: number) { this.joy = [x, y]; }
    setJump(down: boolean) { this.jumpHeld = down; }

    private buildGrid() {
        this.grid.clear();
        this.boxes = [];
        const T = this.T;
        const box = new T.Box3();
        for (const [key, mesh] of this.meshes) {
            const spec = this.specs.get(key);
            if (!spec) continue;
            mesh.updateMatrixWorld();
            box.setFromObject(mesh);
            const b: Box = { minX: box.min.x, minY: box.min.y, minZ: box.min.z, maxX: box.max.x, maxY: box.max.y,
                maxZ: box.max.z, spec };
            this.boxes.push(b);
            for (let cx = Math.floor(b.minX / CELL); cx <= Math.floor(b.maxX / CELL); cx++) {
                for (let cz = Math.floor(b.minZ / CELL); cz <= Math.floor(b.maxZ / CELL); cz++) {
                    const k = cx + ',' + cz;
                    let list = this.grid.get(k);
                    if (!list) { list = []; this.grid.set(k, list); }
                    if (list.length < 400) list.push(b);
                }
            }
        }
    }

    private near(minX: number, minZ: number, maxX: number, maxZ: number): Box[] {
        const out = new Set<Box>();
        for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
            for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
                for (const b of this.grid.get(cx + ',' + cz) || []) out.add(b);
            }
        }
        return [...out];
    }

    private stepPlay(dt: number) {
        const ch = this.character;
        if (!ch) return;
        const k = this.keys;
        let mx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0) + this.joy[0];
        let mz = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0) + this.joy[1];
        const len = Math.hypot(mx, mz);
        if (len > 1) { mx /= len; mz /= len; }
        const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
        const wx = mx * cos + mz * sin;
        const wz = -mx * sin + mz * cos;
        this.velocity[0] = wx * this.walkSpeed;
        this.velocity[2] = wz * this.walkSpeed;
        if (len > 0.05) this.facing = Math.atan2(-wx, -wz);
        if (this.jumpHeld && this.onGround) { this.velocity[1] = this.jumpPower; this.onGround = false; }
        this.velocity[1] -= this.gravity * dt;
        if (this.velocity[1] < -250) this.velocity[1] = -250;

        const half = [1, 2.5, 0.75];
        const p = ch.position;                 // feet
        const centre = [p.x, p.y + half[1], p.z];
        const candidates = this.near(centre[0] - 4, centre[2] - 4, centre[0] + 4, centre[2] + 4)
            .filter(b => b.spec.collide && !b.spec.gone);
        this.onGround = false;
        for (let axis = 0; axis < 3; axis++) {
            const order = [1, 0, 2][axis];
            centre[order] += this.velocity[order] * dt;
            for (const b of candidates) {
                if (centre[0] + half[0] <= b.minX || centre[0] - half[0] >= b.maxX ||
                    centre[1] + half[1] <= b.minY || centre[1] - half[1] >= b.maxY ||
                    centre[2] + half[2] <= b.minZ || centre[2] - half[2] >= b.maxZ) continue;
                if (order === 1) {
                    if (this.velocity[1] <= 0) { centre[1] = b.maxY + half[1]; this.onGround = true; }
                    else centre[1] = b.minY - half[1];
                    this.velocity[1] = 0;
                } else {
                    // Step up anything below 2.1 studs, like a Humanoid.
                    const feet = centre[1] - half[1];
                    if (b.maxY - feet <= 2.1 && b.maxY - feet > 0) { centre[1] = b.maxY + half[1]; continue; }
                    const lo = order === 0 ? b.minX : b.minZ, hi = order === 0 ? b.maxX : b.maxZ;
                    centre[order] = this.velocity[order] > 0 ? lo - half[order] : hi + half[order];
                }
            }
        }
        p.set(centre[0], centre[1] - half[1], centre[2]);
        ch.rotation.y += angleDelta(ch.rotation.y, this.facing) * Math.min(1, dt * 12);

        // Touched: entering a part's box (slightly inflated) fires once.
        const now = new Set<string>();
        for (const b of this.near(centre[0] - 3, centre[2] - 3, centre[0] + 3, centre[2] + 3)) {
            if (!b.spec.touch || b.spec.gone || b.spec.name === 'Baseplate') continue;
            if (centre[0] + half[0] + 0.1 < b.minX || centre[0] - half[0] - 0.1 > b.maxX ||
                centre[1] + half[1] + 0.1 < b.minY || centre[1] - half[1] - 0.15 > b.maxY ||
                centre[2] + half[2] + 0.1 < b.minZ || centre[2] - half[2] - 0.1 > b.maxZ) continue;
            const key = String(b.spec.key);
            now.add(key);
            if (!this.touching.has(key)) this.on.touch(b.spec.path);
        }
        this.touching = now;

        // ProximityPrompts within reach.
        let best: { path: string; text: string; key: string } | null = null;
        let bestDist = Infinity;
        for (const prompt of this.prompts) {
            const b = this.boxes.find(x => x.spec.path === prompt.path);
            if (!b) continue;
            const d = Math.hypot((b.minX + b.maxX) / 2 - centre[0], (b.minY + b.maxY) / 2 - centre[1],
                (b.minZ + b.maxZ) / 2 - centre[2]);
            if (d <= prompt.distance && d < bestDist) { best = prompt; bestDist = d; }
        }
        if ((best?.path || '') !== (this.nearPrompt?.path || '')) {
            this.on.hover?.(best ? `[${best.key}] ${best.text}` : '');
        }
        this.nearPrompt = best;
        if (p.y < -200) this.on.fell();

        // Third-person camera.
        const T = this.T;
        const target = new T.Vector3(p.x, p.y + 4.5, p.z);
        const back = this.forward().multiplyScalar(-this.camDistance);
        this.camera.position.copy(target).add(back);
        this.camera.lookAt(target);
    }

    // =====================================================================
    // The loop
    // =====================================================================
    private loop = (t: number) => {
        if (this.destroyed) return;
        this.frame = requestAnimationFrame(this.loop);
        const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016);
        this.last = t;
        if (this.mode === 'play') {
            this.stepPlay(dt);
            this.dirty = true;
        } else if (this.keys.size && !this.gizmo?.dragging) {
            const T = this.T;
            const k = this.keys;
            const speed = (k.has('shift') ? 12 : 48) * dt;
            const f = this.forward();
            const right = new T.Vector3().crossVectors(f, new T.Vector3(0, 1, 0)).normalize();
            const move = new T.Vector3();
            if (k.has('w')) move.add(f);
            if (k.has('s')) move.sub(f);
            if (k.has('d')) move.add(right);
            if (k.has('a')) move.sub(right);
            if (k.has('e')) move.y += 1;
            if (k.has('q')) move.y -= 1;
            if (move.lengthSq()) { this.camera.position.addScaledVector(move.normalize(), speed); this.dirty = true; }
        }
        if (this.dirty && this.renderer) {
            this.renderer.render(this.scene, this.camera);
            this.dirty = false;
        }
    };
}

function round(n: number) { return Math.round(n * 1000) / 1000; }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
function angleDelta(from: number, to: number) {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
}
