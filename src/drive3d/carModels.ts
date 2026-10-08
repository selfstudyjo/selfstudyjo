/**
 * The cars, built from the catalogue's real dimensions.
 *
 * A car is two swept surfaces and four wheels. The **lower body** is a
 * rounded-rectangle cross-section swept from bumper to bumper along a height
 * profile (deck, belt line, bonnet, nose); the **greenhouse** is a second sweep
 * in tinted glass from the rear screen over the roof to the windscreen, with
 * tumblehome so the roof is narrower than the doors. Where those stations sit
 * is the whole difference between a saloon, a hatchback, an SUV, a coupe, a
 * van and a bus - so one builder draws all nine bodies from a table, and a new
 * blueprint in the `selfstudylab_carla_data` repo gets a correct-looking car
 * from its `body` and its length, width and height alone.
 *
 * The front wheels STEER by the angle the replay recorded and every wheel
 * spins with the speed, the brake lamps light when the car decelerates, and
 * the hero car carries a ring so a student can find their own car in traffic.
 */

import type * as BJS from '../stage3d/babylon';
import { parseColor, type VehicleSpec } from '../utils/driveSim';

type B = typeof BJS;

/** Profile per body. Stations are fractions of the length, 0 = rear, 1 = front. */
interface BodyShape {
    belt: number;
    hood: number;
    deck: number;
    /** rear-screen base, roof rear, roof front, windscreen base */
    cabin: [number, number, number, number];
    clearance: number;
    round: number;
}

const SHAPES: Record<string, BodyShape> = {
    sedan:  { belt: 0.56, hood: 0.52, deck: 0.58, cabin: [0.12, 0.30, 0.58, 0.72], clearance: 0.20, round: 0.16 },
    hatch:  { belt: 0.56, hood: 0.52, deck: 0.62, cabin: [0.03, 0.10, 0.60, 0.74], clearance: 0.20, round: 0.16 },
    suv:    { belt: 0.60, hood: 0.58, deck: 0.64, cabin: [0.02, 0.06, 0.66, 0.77], clearance: 0.30, round: 0.14 },
    coupe:  { belt: 0.53, hood: 0.47, deck: 0.54, cabin: [0.10, 0.34, 0.52, 0.70], clearance: 0.16, round: 0.18 },
    sports: { belt: 0.50, hood: 0.43, deck: 0.52, cabin: [0.12, 0.36, 0.50, 0.68], clearance: 0.14, round: 0.2 },
    pickup: { belt: 0.56, hood: 0.56, deck: 0.54, cabin: [0.42, 0.46, 0.66, 0.74], clearance: 0.32, round: 0.1 },
    van:    { belt: 0.46, hood: 0.50, deck: 0.46, cabin: [0.02, 0.04, 0.86, 0.95], clearance: 0.24, round: 0.12 },
    bus:    { belt: 0.40, hood: 0.40, deck: 0.40, cabin: [0.02, 0.03, 0.97, 0.995], clearance: 0.28, round: 0.08 },
    truck:  { belt: 0.48, hood: 0.50, deck: 0.92, cabin: [0.80, 0.82, 0.95, 0.985], clearance: 0.42, round: 0.06 },
};

export interface CarHandle {
    root: BJS.TransformNode;
    meshes: BJS.Mesh[];
    /** Pose and motion, once per rendered frame. */
    update(speed: number, steer: number, braking: boolean, reverse: boolean,
           dt: number, time: number, night: boolean): void;
    dispose(): void;
}

function smooth(a: number, b: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

/** Rounded-rectangle cross-section in the car's (lateral, up) plane. */
function section(V: B['Vector3'], x: number, bottom: number, top: number, half: number,
                 round: number, points = 14): BJS.Vector3[] {
    const r = Math.max(0.01, Math.min(round, (top - bottom) / 2, half));
    const out: BJS.Vector3[] = [];
    // Corners: top-right, top-left, bottom-left, bottom-right (lateral = z).
    const corners: Array<[number, number, number]> = [
        [half - r, top - r, 0], [-(half - r), top - r, Math.PI / 2],
        [-(half - r), bottom + r, Math.PI], [half - r, bottom + r, Math.PI * 1.5],
    ];
    const per = Math.max(2, Math.floor(points / 4));
    for (const [cz, cy, a0] of corners) {
        for (let k = 0; k <= per; k += 1) {
            const a = a0 + (Math.PI / 2) * (k / per);
            out.push(new V(x, cy + Math.sin(a) * r, cz + Math.cos(a) * r));
        }
    }
    return out;
}

function material(Bn: B, scene: BJS.Scene, name: string, rgb: [number, number, number],
                  spec = 0.6, power = 64): BJS.StandardMaterial {
    const m = new Bn.StandardMaterial(name, scene);
    m.diffuseColor = new Bn.Color3(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
    m.specularColor = new Bn.Color3(spec, spec, spec);
    m.specularPower = power;
    m.backFaceCulling = false;
    m.twoSidedLighting = true;
    return m;
}

export function buildCar(Bn: B, scene: BJS.Scene, spec: VehicleSpec, color: string,
                         options: { hero?: boolean; quality?: 'high' | 'low' } = {}): CarHandle {
    const V = Bn.Vector3;
    const shape = SHAPES[spec.body] || SHAPES.sedan;
    const L = spec.length;
    const W = spec.width;
    const H = spec.height;
    const hw = W / 2;
    const root = new Bn.TransformNode(`car-${spec.id}`, scene);
    const meshes: BJS.Mesh[] = [];
    const mats: BJS.Material[] = [];
    const rgb = parseColor(color);
    const paint = material(Bn, scene, 'paint', rgb, 0.7, 96);
    const glass = material(Bn, scene, 'glass', [16, 22, 30], 0.95, 160);
    glass.alpha = 0.9;
    const dark = material(Bn, scene, 'trim', [24, 25, 28], 0.2, 16);
    const tyre = material(Bn, scene, 'tyre', [20, 20, 22], 0.05, 8);
    const rim = material(Bn, scene, 'rim', [180, 184, 190], 0.9, 64);
    mats.push(paint, glass, dark, tyre, rim);
    const stations = options.quality === 'low' ? 14 : 24;
    const xAt = (f: number) => -L / 2 + f * L;

    // -- the lower body ------------------------------------------------------
    const lower: BJS.Vector3[][] = [];
    for (let k = 0; k <= stations; k += 1) {
        const f = k / stations;
        const endTaper = Math.min(smooth(0, 0.05, f), smooth(1, 0.94, f));
        const topF = f < 0.5
            ? shape.deck + (shape.belt - shape.deck) * smooth(0.05, 0.4, f)
            : shape.belt + (shape.hood - shape.belt) * smooth(0.6, 0.95, f);
        const nose = shape.hood * (1 - 0.18 * smooth(0.9, 1.0, f));
        const top = H * (f > 0.9 ? Math.min(topF, nose) : topF);
        const bottom = shape.clearance + 0.06 * (1 - endTaper);
        const half = hw * (0.86 + 0.14 * endTaper);
        lower.push(section(V, xAt(f), bottom, Math.max(bottom + 0.15, top), half,
            shape.round * H));
    }
    // Close both ends with a collapsed station.
    lower.unshift(lower[0].map(p => new V(p.x, (shape.clearance + H * shape.deck) / 2, 0)));
    lower.push(lower[lower.length - 1].map(p =>
        new V(p.x, (shape.clearance + H * shape.hood) / 2, 0)));
    const body = Bn.CreateRibbon('body', { pathArray: lower, closePath: true,
        sideOrientation: Bn.Mesh.DOUBLESIDE }, scene);
    body.material = paint;
    body.parent = root;
    meshes.push(body);

    // -- the greenhouse --------------------------------------------------------
    const [r0, r1, f1, f0] = shape.cabin;
    const cabin: BJS.Vector3[][] = [];
    const belt = H * shape.belt;
    const cabinStations = 12;
    for (let k = 0; k <= cabinStations; k += 1) {
        const f = r0 + (f0 - r0) * (k / cabinStations);
        let top: number;
        if (f < r1) top = belt + (H - belt) * smooth(r0, r1, f);
        else if (f > f1) top = belt + (H - belt) * (1 - smooth(f1, f0, f));
        else top = H;
        top = Math.max(belt + 0.04, top);
        const half = hw * (0.84 - 0.1 * ((top - belt) / Math.max(0.1, H - belt)));
        cabin.push(section(V, xAt(f), belt - 0.02, top, half, 0.1, 12));
    }
    const greenhouse = Bn.CreateRibbon('cabin', { pathArray: cabin, closePath: true,
        sideOrientation: Bn.Mesh.DOUBLESIDE }, scene);
    greenhouse.material = glass;
    greenhouse.parent = root;
    meshes.push(greenhouse);
    // A painted roof panel on cars, so the roof is the body colour.
    if (!['bus', 'van', 'truck'].includes(spec.body) && f1 > r1) {
        const roof = Bn.CreateBox('roof', { width: L * (f1 - r1) * 0.98, height: 0.04,
            depth: W * 0.62 }, scene);
        roof.position = new V(xAt((r1 + f1) / 2), H + 0.005, 0);
        roof.material = paint;
        roof.parent = root;
        meshes.push(roof);
    }
    // Pickup bed walls / truck box.
    if (spec.body === 'pickup') {
        for (const side of [-1, 1]) {
            const wall = Bn.CreateBox('bed', { width: L * 0.38, height: 0.35, depth: 0.08 },
                scene);
            wall.position = new V(xAt(0.2), H * shape.deck + 0.15, side * hw * 0.9);
            wall.material = paint;
            wall.parent = root;
            meshes.push(wall);
        }
    }
    if (spec.body === 'truck') {
        const box = Bn.CreateBox('box', { width: L * 0.74, height: H * 0.52, depth: W * 0.98 },
            scene);
        box.position = new V(xAt(0.39), shape.clearance + H * 0.62, 0);
        box.material = paint;
        box.parent = root;
        meshes.push(box);
    }

    // -- bumpers, lamps -----------------------------------------------------------
    const bumperF = Bn.CreateBox('bumper-f', { width: 0.12, height: 0.18, depth: W * 0.92 },
        scene);
    bumperF.position = new V(L / 2 - 0.06, shape.clearance + 0.18, 0);
    bumperF.material = dark;
    bumperF.parent = root;
    const bumperR = bumperF.clone('bumper-r');
    bumperR.position = new V(-L / 2 + 0.06, shape.clearance + 0.2, 0);
    bumperR.parent = root;
    meshes.push(bumperF, bumperR as BJS.Mesh);

    const head = material(Bn, scene, 'headlamp', [240, 240, 230], 1, 128);
    head.emissiveColor = new Bn.Color3(0.55, 0.55, 0.5);
    const tail = material(Bn, scene, 'taillamp', [180, 20, 20], 0.8, 64);
    tail.emissiveColor = new Bn.Color3(0.25, 0.02, 0.02);
    mats.push(head, tail);
    const lampY = Math.max(shape.clearance + 0.3, H * shape.hood * 0.86);
    for (const side of [-1, 1]) {
        const hl = Bn.CreateBox('headlight', { width: 0.06, height: 0.1, depth: W * 0.2 },
            scene);
        hl.position = new V(L / 2 - 0.02, lampY, side * hw * 0.66);
        hl.material = head;
        hl.parent = root;
        const tl = Bn.CreateBox('taillight', { width: 0.06, height: 0.12, depth: W * 0.22 },
            scene);
        tl.position = new V(-L / 2 + 0.02, Math.max(shape.clearance + 0.32,
            H * shape.deck * 0.9), side * hw * 0.68);
        tl.material = tail;
        tl.parent = root;
        meshes.push(hl, tl);
    }

    // -- trims ------------------------------------------------------------------------
    const flashers: Array<{ mat: BJS.StandardMaterial; phase: number; rgb: number[] }> = [];
    const trim = spec.trim;
    if (trim === 'taxi') {
        const sign = Bn.CreateBox('taxi', { width: 0.55, height: 0.16, depth: 0.22 }, scene);
        sign.position = new V(xAt((r1 + f1) / 2), H + 0.1, 0);
        const m = material(Bn, scene, 'taxi-sign', [250, 210, 40], 0.4, 32);
        m.emissiveColor = new Bn.Color3(0.5, 0.42, 0.05);
        sign.material = m;
        sign.parent = root;
        meshes.push(sign);
        mats.push(m);
    }
    if (trim === 'police' || trim === 'ambulance' || trim === 'fire') {
        for (const [side, rgbL] of [[-1, [255, 30, 30]], [1, trim === 'police'
            ? [40, 90, 255] : [255, 30, 30]]] as Array<[number, number[]]>) {
            const bar = Bn.CreateBox('lightbar', { width: 0.26, height: 0.1, depth: W * 0.3 },
                scene);
            const roofX = trim === 'fire' ? xAt(0.9) : xAt((r1 + f1) / 2);
            bar.position = new V(roofX, H + 0.07, side * W * 0.16);
            const m = material(Bn, scene, 'bar', rgbL as [number, number, number], 0.5, 32);
            bar.material = m;
            bar.parent = root;
            meshes.push(bar);
            mats.push(m);
            flashers.push({ mat: m, phase: side > 0 ? 0 : Math.PI, rgb: rgbL });
        }
        if (trim === 'ambulance' || trim === 'police') {
            const stripeColor: [number, number, number] = trim === 'ambulance'
                ? [210, 30, 30] : [240, 240, 240];
            const sm = material(Bn, scene, 'stripe', stripeColor, 0.3, 16);
            mats.push(sm);
            for (const side of [-1, 1]) {
                const stripe = Bn.CreateBox('stripe', { width: L * 0.8, height: 0.14,
                    depth: 0.02 }, scene);
                stripe.position = new V(0, H * shape.belt * 0.78, side * (hw * 0.995));
                stripe.material = sm;
                stripe.parent = root;
                meshes.push(stripe);
            }
        }
        if (trim === 'fire') {
            const ladder = Bn.CreateBox('ladder', { width: L * 0.62, height: 0.16,
                depth: 0.6 }, scene);
            ladder.position = new V(xAt(0.4), shape.clearance + H * 0.9 + 0.1, 0);
            ladder.material = rim;
            ladder.parent = root;
            meshes.push(ladder);
        }
    }

    // -- wheels -------------------------------------------------------------------------
    const radius = spec.wheel_radius;
    const width = ['bus', 'truck'].includes(spec.body) ? 0.34 : 0.24;
    const track = W * 0.86;
    const wb = spec.wheelbase;
    const segments = options.quality === 'low' ? 12 : 20;
    const steerNodes: BJS.TransformNode[] = [];
    const spinNodes: BJS.TransformNode[] = [];
    const axles = spec.body === 'truck' || spec.body === 'bus'
        ? [wb / 2, -wb / 2, -wb / 2 + 1.35] : [wb / 2, -wb / 2];
    axles.forEach((ax, ai) => {
        for (const side of [-1, 1]) {
            const steer = new Bn.TransformNode('steer', scene);
            steer.parent = root;
            steer.position = new V(ax + (L / 2 - (wb / 2 + L / 2) * 1) * 0, radius,
                side * (track / 2 + (spec.body === 'bus' ? 0 : 0.02)));
            const spin = new Bn.TransformNode('spin', scene);
            spin.parent = steer;
            const t = Bn.CreateCylinder('tyre', { height: width, diameter: radius * 2,
                tessellation: segments }, scene);
            t.rotation.x = Math.PI / 2;
            t.material = tyre;
            t.parent = spin;
            const r = Bn.CreateCylinder('rim', { height: width + 0.02,
                diameter: radius * 1.25, tessellation: segments }, scene);
            r.rotation.x = Math.PI / 2;
            r.material = rim;
            r.parent = spin;
            // A spoke, so a spinning wheel visibly spins.
            const spoke = Bn.CreateBox('spoke', { width: radius * 1.2, height: 0.06,
                depth: width + 0.04 }, scene);
            spoke.material = dark;
            spoke.parent = spin;
            meshes.push(t, r, spoke);
            if (ai === 0) steerNodes.push(steer);
            spinNodes.push(spin);
        }
    });
    // Position the axles along the car (the wheelbase is centred on the body).
    void L;

    // -- the hero ring ------------------------------------------------------------------
    let ring: BJS.Mesh | null = null;
    if (options.hero) {
        ring = Bn.CreateTorus('hero-ring', { diameter: 1, thickness: 0.05, tessellation: 40 },
            scene);
        ring.scaling = new V(L * 1.05, 1, W * 1.25);
        ring.position = new V(0, 0.06, 0);
        const rm = new Bn.StandardMaterial('hero-ring', scene);
        rm.emissiveColor = new Bn.Color3(0.2, 0.85, 1.0);
        rm.diffuseColor = new Bn.Color3(0.2, 0.85, 1.0);
        rm.disableLighting = true;
        ring.material = rm;
        ring.parent = root;
        meshes.push(ring);
        mats.push(rm);
    }
    for (const m of meshes) m.isPickable = false;

    let spinAngle = 0;
    return {
        root,
        meshes,
        update(speed, steer, braking, reverse, dt, time, night) {
            for (const node of steerNodes) node.rotation.y = steer;
            spinAngle -= (speed / Math.max(0.2, radius)) * dt;
            for (const node of spinNodes) node.rotation.z = spinAngle;
            const glow = braking ? 1.0 : night ? 0.45 : 0.22;
            tail.emissiveColor = new Bn.Color3(glow, braking ? 0.05 : 0.02, 0.02);
            head.emissiveColor = night ? new Bn.Color3(1, 1, 0.92)
                : new Bn.Color3(0.45, 0.45, 0.42);
            if (reverse) tail.emissiveColor = new Bn.Color3(0.8, 0.8, 0.8);
            for (const f of flashers) {
                const on = Math.sin(time * 9 + f.phase) > 0;
                f.mat.emissiveColor = on
                    ? new Bn.Color3(f.rgb[0] / 255, f.rgb[1] / 255, f.rgb[2] / 255)
                    : new Bn.Color3(0.05, 0.05, 0.05);
            }
            if (ring) {
                const pulse = 0.65 + 0.35 * Math.sin(time * 3);
                (ring.material as BJS.StandardMaterial).emissiveColor =
                    new Bn.Color3(0.15 * pulse, 0.8 * pulse, 1.0 * pulse);
            }
        },
        dispose() {
            for (const m of meshes) m.dispose();
            for (const m of mats) m.dispose();
            root.dispose();
        },
    };
}
