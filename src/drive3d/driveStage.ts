/**
 * The self-driving studio: one Babylon scene that REPLAYS a run, or lets the
 * student drive by hand.
 *
 * The component (`LabDrive.vue`) owns the controls and the HUD; this owns the
 * pixels. It is reached only through `await loadBabylon()`, so the ~700 kB
 * renderer is downloaded by nobody who never opens the Simulator pane
 * (working rule 47).
 *
 * Playback is a clock this module keeps: `play`, `pause`, `seek` and `speed`
 * move it, and every rendered frame interpolates every car between the two
 * recorded frames around it (`carsAt` in driveSim.ts). Manual driving runs the
 * same bicycle model the server runs, ported to TypeScript, at the display's
 * frame rate.
 */

import type * as BJS from '../stage3d/babylon';
import { loadBabylon, pickQuality, pixelRatio } from '../stage3d/loader';
import {
    carsAt, duration, friction, inBuilding, lightsAt, newCar, stepCar,
    walkersAt, weatherLook, type CarState, type DriveInput, type DriveMap,
    type Pose, type Replay, type VehicleSpec, type WeatherLook,
} from '../utils/driveSim';
import { buildCity, type CityHandles } from './cityBuilder';
import { buildCar, type CarHandle } from './carModels';

type B = typeof BJS;

export type CameraMode = 'chase' | 'hood' | 'top' | 'orbit' | 'spectator';

export interface StageTick {
    t: number;
    duration: number;
    playing: boolean;
    manual: boolean;
    ego: Pose | null;
    crashed: boolean;
}

const FALLBACK_SPEC: VehicleSpec = {
    id: 'vehicle.tesla.model3', make: 'Tesla', model: 'Model 3', body: 'sedan',
    length: 4.69, width: 1.85, height: 1.44, wheelbase: 2.875, mass: 1760,
    power_kw: 283, top_speed_kmh: 225, max_steer: 70, colors: ['255,255,255'],
    wheel_radius: 0.33, cda: 0.62, brake_decel: 8.5,
};

export class DriveStage {
    private Bn!: B;
    private engine!: BJS.Engine;
    private scene!: BJS.Scene;
    private camera!: BJS.UniversalCamera;
    private orbit!: BJS.ArcRotateCamera;
    private sun!: BJS.DirectionalLight;
    private hemi!: BJS.HemisphericLight;
    private glow: BJS.GlowLayer | null = null;
    private shadows: BJS.ShadowGenerator | null = null;
    private sky: BJS.Mesh | null = null;
    private skyTex: BJS.DynamicTexture | null = null;
    private rain: BJS.Mesh | null = null;
    private rainBuffer: Float32Array | null = null;
    private city: CityHandles | null = null;
    private map: DriveMap | null = null;
    private replay: Replay | null = null;
    private specs: Record<string, VehicleSpec> = {};
    private cars = new Map<number, CarHandle>();
    private walkers = new Map<number, BJS.TransformNode>();
    private walkerMats: BJS.Material[] = [];
    private debugMesh: BJS.Mesh | null = null;
    private debugKey = '';
    private routeMesh: BJS.Mesh | null = null;
    private look: WeatherLook = weatherLook(null);
    private quality: 'high' | 'low' = 'high';
    private mode: CameraMode = 'chase';
    private clock = 0;
    private rate = 1;
    private playing = false;
    private manual: { state: CarState; spec: VehicleSpec; car: CarHandle; input: DriveInput;
        crashed: boolean } | null = null;
    private preview: { car: CarHandle; spec: VehicleSpec } | null = null;
    private listener: ((tick: StageTick) => void) | null = null;
    private lastTick = 0;
    private elapsed = 0;
    private camPos: BJS.Vector3 | null = null;
    private disposed = false;

    static async create(canvas: HTMLCanvasElement): Promise<DriveStage> {
        const stage = new DriveStage();
        await stage.init(canvas);
        return stage;
    }

    private async init(canvas: HTMLCanvasElement) {
        const Bn = await loadBabylon();
        this.Bn = Bn;
        this.quality = pickQuality();
        this.engine = new Bn.Engine(canvas, true, { preserveDrawingBuffer: false,
            stencil: true, antialias: this.quality === 'high' }, true);
        this.engine.setHardwareScalingLevel(1 / pixelRatio(this.quality));
        const scene = new Bn.Scene(this.engine);
        this.scene = scene;
        scene.clearColor = new Bn.Color4(0.62, 0.74, 0.88, 1);
        scene.fogMode = Bn.Scene.FOGMODE_EXP2;
        scene.fogDensity = 0.0012;
        scene.fogColor = new Bn.Color3(0.72, 0.8, 0.9);
        scene.skipPointerMovePicking = true;
        scene.ambientColor = new Bn.Color3(0.25, 0.25, 0.28);

        this.camera = new Bn.UniversalCamera('cam', new Bn.Vector3(0, 40, 40), scene);
        this.camera.minZ = 0.2;
        this.camera.maxZ = 4000;
        this.camera.fov = 1.0;
        this.camera.inputs.clear();
        this.orbit = new Bn.ArcRotateCamera('orbit', -Math.PI / 2, 1.0, 28,
            Bn.Vector3.Zero(), scene);
        this.orbit.minZ = 0.2;
        this.orbit.maxZ = 4000;
        this.orbit.lowerRadiusLimit = 4;
        this.orbit.upperRadiusLimit = 900;
        this.orbit.upperBetaLimit = Math.PI / 2 - 0.03;
        this.orbit.wheelPrecision = 18;
        this.orbit.panningSensibility = 60;
        scene.activeCamera = this.camera;

        this.hemi = new Bn.HemisphericLight('sky', new Bn.Vector3(0, 1, 0), scene);
        this.hemi.groundColor = new Bn.Color3(0.32, 0.32, 0.3);
        this.sun = new Bn.DirectionalLight('sun', new Bn.Vector3(-0.4, -1, -0.3), scene);
        this.sun.position = new Bn.Vector3(200, 300, 200);
        if (this.quality === 'high') {
            this.shadows = new Bn.ShadowGenerator(1024, this.sun);
            this.shadows.usePercentageCloserFiltering = true;
            this.shadows.bias = 0.0008;
        }
        this.glow = new Bn.GlowLayer('glow', scene, { mainTextureSamples: 1,
            blurKernelSize: 24 });
        this.glow.intensity = 0.5;
        this.buildSky();

        this.engine.runRenderLoop(() => this.frame());
    }

    on(listener: (tick: StageTick) => void) {
        this.listener = listener;
    }

    /* ─────────────────── the world ─────────────────── */

    setMap(map: DriveMap) {
        if (this.map && this.map.id === map.id && this.city) return;
        this.clearCars();
        this.city?.dispose();
        this.map = map;
        this.city = buildCity(this.Bn, this.scene, map, this.quality);
        this.city.setNight(this.look.night, this.look.wet);
        const [x0, y0, x1, y1] = map.bounds;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        this.orbit.target = new this.Bn.Vector3(cx, 0, -cy);
        this.orbit.radius = Math.max(x1 - x0, y1 - y0) * 0.7;
        this.sun.position = new this.Bn.Vector3(cx + 300, 400, -cy + 300);
        this.camPos = null;
        this.drawRoute();
    }

    setSpecs(specs: Record<string, VehicleSpec>) {
        this.specs = specs;
    }

    setWeather(params: Record<string, number> | null | undefined) {
        this.look = weatherLook(params);
        const Bn = this.Bn;
        const L = this.look;
        const day = L.night ? 0.12 : L.dusk ? 0.55 : 1.0;
        const cloudDim = 1 - 0.35 * L.cloud;
        this.hemi.intensity = (L.night ? 0.25 : 0.55 + 0.25 * day) * (0.85 + 0.15 * cloudDim);
        this.sun.intensity = L.night ? 0.05 : (L.dusk ? 0.75 : 1.25) * cloudDim;
        const alt = Math.max(5, L.sunAltitude) * Math.PI / 180;
        const az = L.sunAzimuth * Math.PI / 180;
        // Direction the light TRAVELS, in Babylon coordinates.
        this.sun.direction = new Bn.Vector3(-Math.cos(alt) * Math.cos(az), -Math.sin(alt),
            Math.cos(alt) * Math.sin(az));
        this.sun.diffuse = L.dusk ? new Bn.Color3(1, 0.72, 0.5) : new Bn.Color3(1, 0.97, 0.9);
        const fog = L.night ? new Bn.Color3(0.05, 0.06, 0.1)
            : L.dusk ? new Bn.Color3(0.86, 0.66, 0.54)
                : new Bn.Color3(0.72 - 0.1 * L.cloud, 0.8 - 0.08 * L.cloud, 0.9 - 0.05 * L.cloud);
        this.scene.fogColor = fog;
        this.scene.fogDensity = 0.0009 + 0.006 * L.fog + 0.0012 * L.rain;
        this.scene.clearColor = new Bn.Color4(fog.r, fog.g, fog.b, 1);
        if (this.glow) this.glow.intensity = L.night ? 0.9 : 0.45;
        this.paintSky();
        this.city?.setNight(L.night, L.wet);
        this.setRain(L.rain);
    }

    /* ─────────────────── a run ─────────────────── */

    setReplay(replay: Replay | null) {
        this.stopManual();
        this.clearPreview();
        this.clearCars();
        this.replay = replay;
        this.clock = 0;
        this.playing = !!replay && (replay.frames || []).length > 1;
        this.debugKey = '';
        this.drawRoute();
        if (replay?.weather_params) this.setWeather(replay.weather_params);
        this.camPos = null;
        this.frameReplay(0);
    }

    play() { this.playing = true; }
    pause() { this.playing = false; }
    seek(t: number) {
        this.clock = Math.max(0, Math.min(duration(this.replay), t));
        this.frameReplay(0);
    }
    setRate(rate: number) { this.rate = rate; }
    setCamera(mode: CameraMode) {
        this.mode = mode;
        this.camPos = null;
        if (mode === 'orbit') {
            this.scene.activeCamera = this.orbit;
            this.orbit.attachControl(true);
        } else {
            this.orbit.detachControl();
            this.scene.activeCamera = this.camera;
        }
    }

    /** Show a parked car where a run would start: the car picker's preview. */
    showPreview(spec: VehicleSpec, color: string) {
        if (this.replay || this.manual) return;
        this.clearPreview();
        const car = buildCar(this.Bn, this.scene, spec, color,
            { hero: true, quality: this.quality });
        const sp = this.map?.spawn_points?.[0] || [0, 0, 0];
        car.root.position = new this.Bn.Vector3(sp[0], 0, -sp[1]);
        car.root.rotation.y = sp[2];
        this.addShadow(car);
        this.preview = { car, spec };
        this.orbit.target = new this.Bn.Vector3(sp[0], 1, -sp[1]);
        this.orbit.radius = Math.max(9, spec.length * 2.6);
        this.orbit.beta = 1.15;
        this.setCamera('orbit');
    }

    /* ─────────────────── driving by hand ─────────────────── */

    startManual(spec: VehicleSpec, color: string, spawn?: number[]) {
        this.clearPreview();
        this.stopManual();
        this.playing = false;
        const sp = spawn || this.map?.spawn_points?.[0] || [0, 0, 0];
        const car = buildCar(this.Bn, this.scene, spec, color,
            { hero: true, quality: this.quality });
        this.addShadow(car);
        this.manual = { state: newCar(sp[0], sp[1], sp[2]), spec, car, crashed: false,
            input: { throttle: 0, brake: 0, steer: 0, handbrake: false, reverse: false } };
        for (const handle of this.cars.values()) handle.root.setEnabled(false);
        if (this.mode === 'orbit' || this.mode === 'spectator') this.setCamera('chase');
        this.camPos = null;
    }

    setInput(input: Partial<DriveInput>) {
        if (this.manual) this.manual.input = { ...this.manual.input, ...input };
    }

    resetManual() {
        if (!this.manual) return;
        const sp = this.map?.spawn_points?.[0] || [0, 0, 0];
        this.manual.state = newCar(sp[0], sp[1], sp[2]);
        this.manual.crashed = false;
    }

    stopManual() {
        if (!this.manual) return;
        this.manual.car.dispose();
        this.manual = null;
        for (const handle of this.cars.values()) handle.root.setEnabled(true);
    }

    get isManual() { return !!this.manual; }

    /* ─────────────────── housekeeping ─────────────────── */

    resize() { this.engine?.resize(); }

    dispose() {
        this.disposed = true;
        this.engine?.stopRenderLoop();
        this.clearCars();
        this.clearPreview();
        this.stopManual();
        this.city?.dispose();
        this.scene?.dispose();
        this.engine?.dispose();
    }

    private clearCars() {
        for (const car of this.cars.values()) car.dispose();
        this.cars.clear();
        for (const w of this.walkers.values()) w.dispose();
        this.walkers.clear();
        this.debugMesh?.dispose();
        this.debugMesh = null;
    }

    private clearPreview() {
        if (this.preview) {
            this.preview.car.dispose();
            this.preview = null;
        }
    }

    private addShadow(car: CarHandle) {
        if (!this.shadows) return;
        for (const m of car.meshes) this.shadows.addShadowCaster(m, false);
    }

    /* ─────────────────── sky, rain ─────────────────── */

    private buildSky() {
        const Bn = this.Bn;
        const sky = Bn.CreateSphere('sky', { diameter: 3600, segments: 16,
            sideOrientation: Bn.Mesh.BACKSIDE }, this.scene);
        const mat = new Bn.StandardMaterial('sky', this.scene);
        this.skyTex = new Bn.DynamicTexture('sky-grad', { width: 4, height: 256 },
            this.scene, false);
        mat.emissiveTexture = this.skyTex;
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        mat.fogEnabled = false;
        sky.material = mat;
        sky.isPickable = false;
        sky.infiniteDistance = true;
        this.sky = sky;
        this.paintSky();
    }

    private paintSky() {
        if (!this.skyTex) return;
        const ctx = this.skyTex.getContext() as unknown as CanvasRenderingContext2D;
        const L = this.look;
        const g = ctx.createLinearGradient(0, 0, 0, 256);
        const grey = (c: string, k: number) => k > 0.5 ? '#9aa1aa' : c;
        if (L.night) {
            g.addColorStop(0, '#050816');
            g.addColorStop(0.5, '#0c1430');
            g.addColorStop(1, '#141c33');
        } else if (L.dusk) {
            g.addColorStop(0, grey('#3b4d86', L.cloud));
            g.addColorStop(0.45, grey('#e69a6a', L.cloud));
            g.addColorStop(0.5, '#f2b88a');
            g.addColorStop(1, '#6d6a72');
        } else {
            g.addColorStop(0, grey('#2f6fc0', L.cloud));
            g.addColorStop(0.47, grey('#a9cdee', L.cloud));
            g.addColorStop(0.5, '#d6e4f0');
            g.addColorStop(1, '#8e9aa6');
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 4, 256);
        this.skyTex.update();
    }

    private setRain(amount: number) {
        const Bn = this.Bn;
        if (amount <= 0.01) {
            this.rain?.setEnabled(false);
            return;
        }
        const count = Math.round((this.quality === 'high' ? 1400 : 500) * amount);
        if (!this.rain) {
            this.rain = Bn.CreateBox('rain', { width: 0.015, height: 0.6, depth: 0.015 },
                this.scene);
            const m = new Bn.StandardMaterial('rain', this.scene);
            m.diffuseColor = new Bn.Color3(0.75, 0.8, 0.9);
            m.alpha = 0.45;
            m.disableLighting = true;
            m.emissiveColor = new Bn.Color3(0.6, 0.65, 0.75);
            this.rain.material = m;
            this.rain.isPickable = false;
        }
        this.rainBuffer = new Float32Array(count * 16);
        const M = Bn.Matrix;
        for (let i = 0; i < count; i += 1) {
            M.Translation((Math.random() - 0.5) * 60, Math.random() * 25,
                (Math.random() - 0.5) * 60).copyToArray(this.rainBuffer, i * 16);
        }
        this.rain.thinInstanceSetBuffer('matrix', this.rainBuffer, 16, false);
        this.rain.setEnabled(true);
    }

    private stepRain(dt: number, around: BJS.Vector3) {
        if (!this.rain || !this.rainBuffer || !this.rain.isEnabled()) return;
        const buf = this.rainBuffer;
        const n = buf.length / 16;
        for (let i = 0; i < n; i += 1) {
            const o = i * 16;
            let y = buf[o + 13] - dt * 18;
            if (y < 0) {
                y = 25;
                buf[o + 12] = around.x + (Math.random() - 0.5) * 60;
                buf[o + 14] = around.z + (Math.random() - 0.5) * 60;
            }
            buf[o + 13] = y;
        }
        this.rain.thinInstanceBufferUpdated('matrix');
    }

    /* ─────────────────── debug drawings and the route ─────────────────── */

    private drawRoute() {
        this.routeMesh?.dispose();
        this.routeMesh = null;
        const route = this.replay?.route || [];
        if (route.length < 2) return;
        const Bn = this.Bn;
        const pts = route.map(p => new Bn.Vector3(p[0], 0.12, -p[1]));
        this.routeMesh = Bn.CreateLineSystem('route', { lines: [pts],
            colors: [pts.map(() => new Bn.Color4(0.2, 0.9, 1, 1))] }, this.scene);
        this.routeMesh.isPickable = false;
    }

    private drawDebug(t: number) {
        const items = (this.replay?.debug || []).filter(d =>
            d.t <= t + 1e-6 && (d.life <= 0 || d.t + d.life >= t));
        const key = `${items.length}:${items.length ? items[items.length - 1].t : 0}`;
        if (key === this.debugKey) return;
        this.debugKey = key;
        this.debugMesh?.dispose();
        this.debugMesh = null;
        if (!items.length) return;
        const Bn = this.Bn;
        const lines: BJS.Vector3[][] = [];
        const colors: BJS.Color4[][] = [];
        const col = (c: number[] | undefined) =>
            new Bn.Color4((c?.[0] ?? 255) / 255, (c?.[1] ?? 0) / 255, (c?.[2] ?? 0) / 255, 1);
        const P = (p: number[]) => new Bn.Vector3(p[0], (p[2] || 0) + 0.05, -p[1]);
        for (const d of items.slice(-1500)) {
            const data = d.data || {};
            const c = col(data.c);
            if ((d.kind === 'line' || d.kind === 'arrow') && data.a && data.b) {
                lines.push([P(data.a), P(data.b)]);
                colors.push([c, c]);
            } else if (d.kind === 'point' && data.p) {
                const p = P(data.p);
                const s = Math.max(0.15, Number(data.size) || 0.1) * 2;
                lines.push([p.add(new Bn.Vector3(-s, 0, 0)), p.add(new Bn.Vector3(s, 0, 0))]);
                lines.push([p.add(new Bn.Vector3(0, 0, -s)), p.add(new Bn.Vector3(0, 0, s))]);
                lines.push([p.add(new Bn.Vector3(0, -s, 0)), p.add(new Bn.Vector3(0, s, 0))]);
                colors.push([c, c], [c, c], [c, c]);
            } else if (d.kind === 'box' && data.p && data.e) {
                const [ex, ey] = data.e;
                const yaw = (Number(data.yaw) || 0) * Math.PI / 180;
                const corner = (sx: number, sy: number) => {
                    const lx = sx * ex;
                    const ly = sy * ey;
                    return P([data.p[0] + lx * Math.cos(yaw) - ly * Math.sin(yaw),
                        data.p[1] + lx * Math.sin(yaw) + ly * Math.cos(yaw), data.p[2]]);
                };
                const ring = [corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1),
                    corner(1, 1)];
                lines.push(ring);
                colors.push(ring.map(() => c));
            }
        }
        if (lines.length) {
            this.debugMesh = Bn.CreateLineSystem('debug', { lines, colors }, this.scene);
            this.debugMesh.isPickable = false;
        }
    }

    /* ─────────────────── every frame ─────────────────── */

    private specFor(typeId: string): VehicleSpec {
        return this.specs[typeId] || FALLBACK_SPEC;
    }

    private frameReplay(dt: number) {
        const replay = this.replay;
        if (!replay || !this.map) return;
        const frames = replay.frames || [];
        const t = this.clock;
        const poses = carsAt(frames, t);
        const meta = replay.vehicles || {};
        const Bn = this.Bn;
        for (const [id, pose] of poses) {
            let car = this.cars.get(id);
            if (!car) {
                const info = meta[String(id)] || { type: 'vehicle.tesla.model3',
                    color: '', role: '', autopilot: false };
                const spec = this.specFor(info.type);
                car = buildCar(Bn, this.scene, spec, info.color || spec.colors[0],
                    { hero: id === replay.ego, quality: this.quality });
                if (id === replay.ego || this.cars.size < 6) this.addShadow(car);
                this.cars.set(id, car);
            }
            car.root.setEnabled(!this.manual);
            car.root.position.set(pose.x, 0, -pose.y);
            car.root.rotation.y = pose.yaw;
            car.update(pose.v, pose.steer, pose.braking, pose.reverse, dt, this.elapsed,
                this.look.night);
        }
        for (const [id, car] of this.cars) {
            if (!poses.has(id)) car.root.setEnabled(false);
        }
        const people = walkersAt(frames, t);
        for (const [id, w] of people) {
            let node = this.walkers.get(id);
            if (!node) node = this.buildWalker(id);
            node.position.set(w.x, 0, -w.y);
            node.rotation.y = w.yaw;
            node.rotation.z = w.knocked ? Math.PI / 2 : 0;
            node.position.y = w.knocked ? 0.25 : Math.abs(Math.sin(this.elapsed * 8)) * 0.04
                * Math.min(1, w.v);
        }
        this.city?.setLights(lightsAt(frames, t));
        this.drawDebug(t);
    }

    private buildWalker(id: number): BJS.TransformNode {
        const Bn = this.Bn;
        const node = new Bn.TransformNode(`walker-${id}`, this.scene);
        const hues = [[0.85, 0.3, 0.25], [0.25, 0.45, 0.8], [0.3, 0.6, 0.35],
            [0.7, 0.6, 0.2], [0.55, 0.3, 0.6]];
        const hue = hues[id % hues.length];
        const shirt = new Bn.StandardMaterial('shirt', this.scene);
        shirt.diffuseColor = new Bn.Color3(hue[0], hue[1], hue[2]);
        const skin = new Bn.StandardMaterial('skin', this.scene);
        skin.diffuseColor = new Bn.Color3(0.82, 0.64, 0.5);
        const legs = new Bn.StandardMaterial('legs', this.scene);
        legs.diffuseColor = new Bn.Color3(0.18, 0.2, 0.28);
        this.walkerMats.push(shirt, skin, legs);
        const body = Bn.CreateCapsule('torso', { height: 0.8, radius: 0.2 }, this.scene);
        body.position.y = 1.15;
        body.material = shirt;
        body.parent = node;
        const head = Bn.CreateSphere('head', { diameter: 0.24, segments: 8 }, this.scene);
        head.position.y = 1.68;
        head.material = skin;
        head.parent = node;
        const leg = Bn.CreateBox('legs', { width: 0.22, height: 0.8, depth: 0.3 }, this.scene);
        leg.position.y = 0.4;
        leg.material = legs;
        leg.parent = node;
        this.walkers.set(id, node);
        return node;
    }

    private egoPose(): Pose | null {
        if (this.manual) {
            const s = this.manual.state;
            return { x: s.x, y: s.y, yaw: s.yaw, v: s.v, steer: s.delta, braking:
                this.manual.input.brake > 0.05, reverse: this.manual.input.reverse };
        }
        if (this.replay?.ego != null) {
            return carsAt(this.replay.frames || [], this.clock).get(this.replay.ego) || null;
        }
        return null;
    }

    private frame() {
        if (this.disposed) return;
        const dtMs = this.engine.getDeltaTime();
        const dt = Math.min(0.1, dtMs / 1000);
        this.elapsed += dt;
        const Bn = this.Bn;

        if (this.manual) {
            const m = this.manual;
            const mu = friction(this.replay?.weather_params || null);
            const prev = { ...m.state };
            m.state = stepCar(m.state, m.input, dt, m.spec, mu);
            if (this.map && inBuilding(this.map, m.state.x, m.state.y)) {
                m.state = { ...prev, v: 0, yawRate: 0 };
                m.crashed = true;
            }
            const s = m.state;
            m.car.root.position.set(s.x, 0, -s.y);
            m.car.root.rotation.y = s.yaw;
            m.car.update(s.v, s.delta, m.input.brake > 0.05 || s.aLong < -2,
                m.input.reverse, dt, this.elapsed, this.look.night);
        } else if (this.replay) {
            const end = duration(this.replay);
            if (this.playing) {
                this.clock += dt * this.rate;
                if (this.clock >= end) {
                    this.clock = end;
                    this.playing = false;
                }
            }
            this.frameReplay(dt);
        } else if (this.preview) {
            this.preview.car.update(0, 0, false, false, dt, this.elapsed, this.look.night);
        }

        this.updateCamera(dt);
        const around = this.scene.activeCamera?.position || Bn.Vector3.Zero();
        this.stepRain(dt, around);
        this.scene.render();

        if (this.listener && this.elapsed - this.lastTick > 0.08) {
            this.lastTick = this.elapsed;
            this.listener({ t: this.clock, duration: duration(this.replay),
                playing: this.playing, manual: !!this.manual, ego: this.egoPose(),
                crashed: !!this.manual?.crashed });
        }
    }

    private updateCamera(dt: number) {
        const Bn = this.Bn;
        const ego = this.egoPose();
        if (this.mode === 'orbit') {
            if (ego) {
                const target = new Bn.Vector3(ego.x, 1, -ego.y);
                this.orbit.target = Bn.Vector3.Lerp(this.orbit.target, target,
                    Math.min(1, dt * 4));
            }
            return;
        }
        if (this.mode === 'spectator' && this.replay) {
            const frames = this.replay.frames || [];
            const s = frames.length ? frames[Math.min(frames.length - 1,
                Math.max(0, Math.round(this.clock / 0.1)))].s : null;
            if (s && s.length >= 5) {
                this.camera.position.set(s[0], Math.max(0.5, s[2]), -s[1]);
                const yaw = s[3];
                const pitch = (s[4] || 0) * Math.PI / 180;
                const dir = new Bn.Vector3(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch),
                    -Math.cos(pitch) * Math.sin(yaw));
                this.camera.setTarget(this.camera.position.add(dir));
                return;
            }
        }
        if (!ego) {
            // Nothing to follow: an overview of the town.
            if (this.map) {
                const [x0, y0, x1, y1] = this.map.bounds;
                const cx = (x0 + x1) / 2;
                const cy = (y0 + y1) / 2;
                const span = Math.max(x1 - x0, y1 - y0);
                this.camera.position.set(cx - span * 0.35, span * 0.45, -cy + span * 0.35);
                this.camera.setTarget(new Bn.Vector3(cx, 0, -cy));
            }
            return;
        }
        const spec = this.manual?.spec || (this.replay?.ego != null
            ? this.specFor(this.replay.vehicles?.[String(this.replay.ego)]?.type || '')
            : FALLBACK_SPEC);
        const fx = Math.cos(ego.yaw);
        const fz = -Math.sin(ego.yaw);
        const base = new Bn.Vector3(ego.x, 0, -ego.y);
        let want: BJS.Vector3;
        let look: BJS.Vector3;
        let smoothK = 6;
        if (this.mode === 'hood') {
            want = base.add(new Bn.Vector3(fx * spec.length * 0.1, spec.height * 0.92,
                fz * spec.length * 0.1));
            look = base.add(new Bn.Vector3(fx * 30, spec.height * 0.8, fz * 30));
            smoothK = 1000;
        } else if (this.mode === 'top') {
            want = base.add(new Bn.Vector3(-fx * 8, 75, -fz * 8));
            look = base;
            smoothK = 4;
        } else {
            const back = spec.length + 6.5;
            want = base.add(new Bn.Vector3(-fx * back, 2.6 + spec.height * 0.6, -fz * back));
            look = base.add(new Bn.Vector3(fx * 5, 1.2, fz * 5));
        }
        if (!this.camPos) this.camPos = want.clone();
        this.camPos = Bn.Vector3.Lerp(this.camPos, want, Math.min(1, dt * smoothK));
        this.camera.position.copyFrom(this.camPos);
        this.camera.setTarget(look);
        if (this.shadows) this.sun.position = base.add(new Bn.Vector3(80, 160, 80));
    }
}
