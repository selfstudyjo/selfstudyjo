/**
 * The self-driving simulator's browser half, as a PLAIN module.
 *
 * No Vue, no DOM, no Babylon — the `photoMask.ts` / `drawEngine.ts` precedent —
 * so `npm run check:drive` can drive every decision here in node. What lives
 * here is everything the 3D studio DECIDES and none of what it draws:
 *
 * - the **shapes** of what app 11 sends: a town (`DriveMap`) and a run
 *   (`Replay`), so a field renamed on one side is a type error on this one;
 * - **playback**: which recorded frame is on screen at time `t`, and every car
 *   between two frames — interpolated, with yaw interpolated the SHORT way
 *   round, or a car crossing ±180° spins a full turn in one tenth of a second;
 * - **the frame mapping** between CARLA's left-handed world (x forward, y
 *   right, z up) and Babylon's (x right, y up, z forward). One function, used
 *   everywhere: two copies of a handedness flip is a mirrored city the day they
 *   disagree;
 * - **manual driving**: the same dynamic bicycle model the server runs
 *   (`carlart/sfscarla/physics.py`), ported line for line, so a car driven by
 *   hand in the browser handles like the one a script drives;
 * - **what the HUD reports**: the nearest lane, its speed limit, and the events
 *   on the timeline.
 */

/* ─────────────────── what app 11 sends ─────────────────── */

export interface DriveLane {
    id: number;
    road: number;
    lane: number;
    j: number;
    w: number;
    turn: string;
    speed: number;
    pts: number[][];
}

export interface DriveMap {
    id: string;
    name: string;
    style: string;
    summary: string;
    bounds: number[];
    lane_width: number;
    lanes: DriveLane[];
    junctions: Array<{ id: number; poly: number[][] }>;
    lights: Array<{ id: number; x: number; y: number; yaw: number; span: number;
        junction: number }>;
    spawn_points: number[][];
    surfaces: Array<{ road: number; left: number[][]; right: number[][] }>;
    markings: Array<{ pts: number[][]; type: string; color: string }>;
    crosswalks: Array<{ pts: number[][]; yaw: number }>;
    blocks: Array<{ poly: number[][]; kind: string }>;
    shoulders: Array<{ pts: number[][]; w: number; kind: string }>;
    /** `[cx, cy, width, depth, height, yaw, kind, colour index]` */
    buildings: Array<[number, number, number, number, number, number, string, number]>;
    trees: number[][];
    lamps: number[][];
    props: Array<Record<string, any>>;
}

export interface VehicleSpec {
    id: string;
    make: string;
    model: string;
    body: string;
    length: number;
    width: number;
    height: number;
    wheelbase: number;
    mass: number;
    power_kw: number;
    top_speed_kmh: number;
    max_steer: number;
    colors: string[];
    trim?: string;
    electric?: boolean;
    wheel_radius: number;
    cda: number;
    brake_decel: number;
}

export interface TownSummary {
    id: string;
    name: string;
    summary: string;
    style: string;
    speed_limit: number;
    speed_major: number;
}

export interface WeatherPreset {
    name: string;
    friction: number;
    night: boolean;
    cloudiness: number;
    precipitation: number;
    precipitation_deposits: number;
    wetness: number;
    fog_density: number;
    sun_altitude_angle: number;
    sun_azimuth_angle: number;
}

/** `[id, x, y, yaw, speed, steer angle, braking, reverse]` */
export type CarSample = [number, number, number, number, number, number, number, number];
/** `[id, x, y, yaw, speed, knocked]` */
export type WalkerSample = [number, number, number, number, number, number];

export interface Frame {
    t: number;
    v: CarSample[];
    w: WalkerSample[];
    /** One character per traffic light, in map order: g / y / r. */
    l: string;
    /** The spectator: `[x, y, z, yaw (rad), pitch (deg)]`. */
    s: number[];
}

export interface Replay {
    frames: Frame[];
    vehicles: Record<string, { type: string; role: string; color: string;
        autopilot: boolean }>;
    lights: number[][];
    debug: Array<{ t: number; kind: string; data: any; life: number }>;
    events: Array<Record<string, any>>;
    invasions: Array<Record<string, any>>;
    route: number[][];
    images: Array<{ frame: number; name: string; png: string }>;
    submissions: Record<string, Array<[number, any, any]>>;
    map: string;
    weather: string;
    weather_params?: Record<string, number>;
    ego: number | null;
    run: number;
    metrics: Record<string, any>;
    goals: Array<{ id: string; ok: boolean; detail?: any }>;
    status: string;
    stdout: string;
    stderr: string;
}

/* ─────────────────── frames ─────────────────── */

const TAU = Math.PI * 2;

export function wrapAngle(a: number): number {
    let x = (a + Math.PI) % TAU;
    if (x < 0) x += TAU;
    return x - Math.PI;
}

/** Index of the last frame at or before `t`. Binary search; frames are sorted. */
export function frameIndexAt(frames: Frame[], t: number): number {
    if (!frames.length) return -1;
    if (t <= frames[0].t) return 0;
    let lo = 0;
    let hi = frames.length - 1;
    if (t >= frames[hi].t) return hi;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (frames[mid].t <= t) lo = mid; else hi = mid;
    }
    return lo;
}

export interface Pose {
    x: number;
    y: number;
    yaw: number;
    v: number;
    steer: number;
    braking: boolean;
    reverse: boolean;
}

/**
 * Every car's pose at time `t`, interpolated between the two frames around it.
 *
 * A car present in the earlier frame and absent from the later one (destroyed,
 * or spawned between them) is drawn at its last pose rather than lerped
 * towards the origin — which is what an absent id would otherwise default to.
 */
export function carsAt(frames: Frame[], t: number): Map<number, Pose> {
    const out = new Map<number, Pose>();
    const i = frameIndexAt(frames, t);
    if (i < 0) return out;
    const a = frames[i];
    const b = frames[Math.min(i + 1, frames.length - 1)];
    const span = b.t - a.t;
    const k = span > 1e-6 ? Math.max(0, Math.min(1, (t - a.t) / span)) : 0;
    const later = new Map<number, CarSample>();
    for (const car of b.v) later.set(car[0], car);
    for (const car of a.v) {
        const next = later.get(car[0]);
        if (!next) {
            out.set(car[0], { x: car[1], y: car[2], yaw: car[3], v: car[4],
                steer: car[5], braking: !!car[6], reverse: !!car[7] });
            continue;
        }
        out.set(car[0], {
            x: car[1] + (next[1] - car[1]) * k,
            y: car[2] + (next[2] - car[2]) * k,
            yaw: car[3] + wrapAngle(next[3] - car[3]) * k,
            v: car[4] + (next[4] - car[4]) * k,
            steer: car[5] + (next[5] - car[5]) * k,
            braking: !!(k < 0.5 ? car[6] : next[6]),
            reverse: !!(k < 0.5 ? car[7] : next[7]),
        });
    }
    return out;
}

export function walkersAt(frames: Frame[], t: number): Map<number, Pose & { knocked: boolean }> {
    const out = new Map<number, Pose & { knocked: boolean }>();
    const i = frameIndexAt(frames, t);
    if (i < 0) return out;
    const a = frames[i];
    const b = frames[Math.min(i + 1, frames.length - 1)];
    const span = b.t - a.t;
    const k = span > 1e-6 ? Math.max(0, Math.min(1, (t - a.t) / span)) : 0;
    const later = new Map<number, WalkerSample>();
    for (const w of b.w || []) later.set(w[0], w);
    for (const w of a.w || []) {
        const n = later.get(w[0]) || w;
        out.set(w[0], { x: w[1] + (n[1] - w[1]) * k, y: w[2] + (n[2] - w[2]) * k,
            yaw: w[3] + wrapAngle(n[3] - w[3]) * k, v: w[4], steer: 0,
            braking: false, reverse: false, knocked: !!w[5] });
    }
    return out;
}

/** The light states on screen at `t`: `'g' | 'y' | 'r'` per light. */
export function lightsAt(frames: Frame[], t: number): string {
    const i = frameIndexAt(frames, t);
    return i < 0 ? '' : (frames[i].l || '');
}

export function duration(replay: Replay | null): number {
    const frames = replay?.frames || [];
    return frames.length ? frames[frames.length - 1].t : 0;
}

/* ─────────────────── frames of reference ─────────────────── */

/**
 * CARLA (x forward, y right, z up — left-handed) to Babylon (x right, y up,
 * z forward — also left-handed). `(x, z, -y)`: swapping two axes alone would
 * flip the handedness and mirror the city, and the `-y` flips it back.
 *
 * With this mapping a mesh whose forward is +X faces CARLA yaw `ψ` with
 * `rotation.y = ψ`, which is the one identity the studio relies on.
 */
export function toScene(x: number, y: number, z = 0): [number, number, number] {
    return [x, z, -y];
}

export function yawToRotationY(yaw: number): number {
    return yaw;
}

/* ─────────────────── the HUD ─────────────────── */

export interface LaneHit {
    lane: DriveLane;
    distance: number;
    lateral: number;
}

/**
 * The nearest lane to a point, through a coarse grid built once per town.
 * For the HUD's speed limit and the manual-drive "off road" warning — the
 * simulator itself never asks the browser anything.
 */
export class LaneIndex {
    private cells = new Map<string, Array<[number, number]>>();
    private lanes: DriveLane[];
    private readonly size = 10;

    constructor(map: DriveMap) {
        this.lanes = map.lanes || [];
        this.lanes.forEach((lane, li) => {
            const pts = lane.pts || [];
            for (let i = 0; i < pts.length - 1; i += 1) {
                const [ax, ay] = pts[i];
                const [bx, by] = pts[i + 1];
                const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / this.size));
                for (let s = 0; s <= steps; s += 1) {
                    const x = ax + (bx - ax) * s / steps;
                    const y = ay + (by - ay) * s / steps;
                    const key = `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`;
                    const list = this.cells.get(key) || [];
                    if (!list.some(([l, seg]) => l === li && seg === i)) list.push([li, i]);
                    this.cells.set(key, list);
                }
            }
        });
    }

    nearest(x: number, y: number): LaneHit | null {
        const cx = Math.floor(x / this.size);
        const cy = Math.floor(y / this.size);
        let best: LaneHit | null = null;
        for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
            for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
                for (const [li, i] of this.cells.get(`${gx},${gy}`) || []) {
                    const lane = this.lanes[li];
                    const [ax, ay] = lane.pts[i];
                    const [bx, by] = lane.pts[i + 1];
                    const dx = bx - ax;
                    const dy = by - ay;
                    const len2 = dx * dx + dy * dy || 1e-9;
                    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
                    const qx = ax + dx * t;
                    const qy = ay + dy * t;
                    const d = Math.hypot(x - qx, y - qy);
                    if (!best || d < best.distance) {
                        const lateral = ((x - qx) * -dy + (y - qy) * dx) / Math.sqrt(len2);
                        best = { lane, distance: d, lateral };
                    }
                }
            }
        }
        return best;
    }
}

export interface TimelineMark {
    t: number;
    kind: 'collision' | 'red_light' | 'invasion' | 'speeding' | 'other';
    label: string;
}

/** What goes on the scrubber, de-duplicated within half a second. */
export function timelineMarks(replay: Replay | null): TimelineMark[] {
    if (!replay) return [];
    const out: TimelineMark[] = [];
    const push = (t: number, kind: TimelineMark['kind'], label: string) => {
        if (out.some(m => m.kind === kind && Math.abs(m.t - t) < 0.5)) return;
        out.push({ t, kind, label });
    };
    for (const e of replay.events || []) {
        const kind = String(e.kind || '');
        if (kind === 'collision' || kind.startsWith('collision_')) {
            push(Number(e.t) || 0, 'collision', String(e.with || 'collision'));
        } else if (kind === 'red_light') {
            push(Number(e.t) || 0, 'red_light', 'red light');
        } else if (kind === 'speeding') {
            push(Number(e.t) || 0, 'speeding', `${e.kmh} km/h in a ${e.limit}`);
        }
    }
    for (const inv of replay.invasions || []) {
        push(Number(inv.t) || 0, 'invasion', String(inv.what || 'lane invasion'));
    }
    return out.sort((a, b) => a.t - b.t);
}

/* ─────────────────── weather ─────────────────── */

export interface WeatherLook {
    night: boolean;
    dusk: boolean;
    sunAltitude: number;
    sunAzimuth: number;
    cloud: number;
    rain: number;
    wet: number;
    fog: number;
}

export function weatherLook(params: Record<string, number> | null | undefined): WeatherLook {
    const p = params || {};
    const alt = Number(p.sun_altitude_angle ?? 75);
    return {
        night: alt < 0,
        dusk: alt >= 0 && alt < 22,
        sunAltitude: alt,
        sunAzimuth: Number(p.sun_azimuth_angle ?? 45),
        cloud: Math.max(0, Math.min(1, Number(p.cloudiness ?? 5) / 100)),
        rain: Math.max(0, Math.min(1, Number(p.precipitation ?? 0) / 100)),
        wet: Math.max(0, Math.min(1, Math.max(Number(p.wetness ?? 0),
            Number(p.precipitation_deposits ?? 0)) / 100)),
        fog: Math.max(0, Math.min(1, Number(p.fog_density ?? 0) / 100)),
    };
}

/** Tyre grip for a weather, the same formula as `sfscarla/weather.py`. */
export function friction(params: Record<string, number> | null | undefined): number {
    const p = params || {};
    const wet = Math.max(Number(p.wetness ?? 0), Number(p.precipitation_deposits ?? 0)) / 100;
    const rain = Number(p.precipitation ?? 0) / 100;
    return Math.max(0.45, 0.9 - 0.3 * Math.min(1, wet) - 0.1 * Math.min(1, rain));
}

/* ─────────────────── manual driving ─────────────────── */

export interface CarState {
    x: number;
    y: number;
    yaw: number;
    v: number;
    delta: number;
    yawRate: number;
    aLong: number;
}

export interface DriveInput {
    throttle: number;
    brake: number;
    steer: number;
    handbrake: boolean;
    reverse: boolean;
}

const G = 9.81;
const AIR = 1.2;

export function newCar(x: number, y: number, yaw: number): CarState {
    return { x, y, yaw, v: 0, delta: 0, yawRate: 0, aLong: 0 };
}

/**
 * One step of the dynamic bicycle model — a line-for-line port of
 * `step()` in app 11's `sfscarla/physics.py`. Kept in step BY HAND, which is
 * working rule 10's cost paid deliberately: the alternative is a car that
 * handles one way when the script drives it and another when the student does.
 */
export function stepCar(state: CarState, input: DriveInput, dt: number,
                        spec: VehicleSpec, mu: number): CarState {
    const s = { ...state };
    const m = spec.mass;
    const L = spec.wheelbase;
    const maxSteer = spec.max_steer * Math.PI / 180;
    const power = spec.power_kw * 1000;
    const vmax = spec.top_speed_kmh / 3.6;
    const throttle = Math.max(0, Math.min(1, input.throttle));
    const steer = Math.max(-1, Math.min(1, input.steer));
    const brake = Math.max(0, Math.min(1, input.brake));
    let remaining = dt;
    while (remaining > 1e-9) {
        const h = Math.min(0.01, remaining);
        remaining -= h;
        const target = steer * maxSteer;
        const rate = 3.6 * h;
        s.delta += Math.max(-rate, Math.min(rate, target - s.delta));
        let v = s.v;
        const direction = input.reverse ? -1 : 1;
        const traction = mu * m * G * 0.72;
        const drive = Math.pow(throttle, 1.6) * Math.min(power / Math.max(Math.abs(v), 2.5), traction);
        let force = direction * drive;
        force -= 0.5 * AIR * spec.cda * v * Math.abs(v);
        if (Math.abs(v) > 0.05) {
            const sign = v > 0 ? 1 : -1;
            force -= 0.012 * m * G * sign;
            force -= 0.02 * m * Math.abs(v) * sign;
            if (throttle < 0.05) force -= 0.55 * m * sign;
        }
        let a = force / m;
        let decel = brake * spec.brake_decel * Math.min(1, mu / 0.9);
        if (input.handbrake) decel += 0.7 * mu * G;
        if (Math.abs(v) > vmax && a * v > 0) a = 0;
        if (input.reverse && v < -8 && a < 0) a = 0;
        let vNew = v + a * h;
        if (decel > 0) {
            if (vNew > 0) vNew = Math.max(0, vNew - decel * h);
            else if (vNew < 0) vNew = Math.min(0, vNew + decel * h);
        }
        if (throttle < 0.01 && Math.abs(vNew) < 0.03) vNew = 0;
        s.aLong = (vNew - v) / h;
        v = vNew;
        let curvature = Math.tan(s.delta) / L;
        const demand = v * v * Math.abs(curvature);
        const limit = mu * G * 0.95;
        if (demand > limit && demand > 1e-6) curvature *= limit / demand;
        const tau = 0.12 + 0.012 * Math.abs(v);
        s.yawRate += (v * curvature - s.yawRate) * Math.min(1, h / tau);
        s.yaw = wrapAngle(s.yaw + s.yawRate * h);
        s.x += v * Math.cos(s.yaw) * h;
        s.y += v * Math.sin(s.yaw) * h;
        s.v = v;
    }
    return s;
}

/** A building box contains a point (for the manual-drive crash check). */
export function inBuilding(map: DriveMap, x: number, y: number): boolean {
    for (const b of map.buildings || []) {
        const [cx, cy, w, d, , yaw] = b;
        const c = Math.cos(-yaw);
        const sn = Math.sin(-yaw);
        const lx = (x - cx) * c - (y - cy) * sn;
        const ly = (x - cx) * sn + (y - cy) * c;
        if (Math.abs(lx) <= w / 2 + 0.6 && Math.abs(ly) <= d / 2 + 0.6) return true;
    }
    return false;
}

/* ─────────────────── small things the panel prints ─────────────────── */

export function kmh(ms: number): number {
    return Math.round(Math.abs(ms) * 3.6);
}

export function parseColor(rgb: string | undefined, fallback: [number, number, number] =
    [200, 200, 205]): [number, number, number] {
    const parts = String(rgb || '').split(',').map(n => Number(n.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every(n => Number.isFinite(n))) {
        return [parts[0], parts[1], parts[2]].map(n => Math.max(0, Math.min(255, n))) as
            [number, number, number];
    }
    return fallback;
}

/** Which body shape a blueprint is drawn with, defaulting sensibly. */
export const BODIES = ['sedan', 'coupe', 'hatch', 'suv', 'pickup', 'van', 'bus',
    'truck', 'sports'] as const;

export function bodyOf(spec: VehicleSpec | undefined): string {
    const body = spec?.body || 'sedan';
    return (BODIES as readonly string[]).includes(body) ? body : 'sedan';
}

/**
 * The submissions as `{t, value, truth}` rows for the estimate chart. A
 * vector estimate (a position) is reduced to its ERROR, because two lines of
 * x-coordinates drawn over each other show nothing a reader can judge.
 */
export function estimateSeries(rows: Array<[number, any, any]>):
    Array<{ t: number; value: number; truth: number }> {
    const out: Array<{ t: number; value: number; truth: number }> = [];
    for (const [t, value, truth] of rows || []) {
        if (Array.isArray(value) && Array.isArray(truth)) {
            const err = Math.hypot(Number(value[0]) - Number(truth[0]),
                Number(value[1]) - Number(truth[1]));
            out.push({ t, value: err, truth: 0 });
        } else if (Number.isFinite(Number(value)) && Number.isFinite(Number(truth))) {
            out.push({ t, value: Number(value), truth: Number(truth) });
        }
    }
    return out;
}

export function rmse(rows: Array<{ value: number; truth: number }>): number | null {
    if (!rows.length) return null;
    return Math.sqrt(rows.reduce((acc, r) => acc + (r.value - r.truth) ** 2, 0) / rows.length);
}
