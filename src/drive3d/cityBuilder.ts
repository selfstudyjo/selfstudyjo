/**
 * A town, built in Babylon from the payload app 11 sends.
 *
 * Everything here is GENERATED from the same list the simulator collides
 * against (`sfscarla/decor.py`), so a tower a script crashes into is a tower
 * the student can see. Three rules keep a whole city cheap enough for a laptop
 * GPU and a phone:
 *
 * - **one mesh per material, not per object.** Road surfaces, markings, kerbs
 *   and facades are merged into a handful of meshes at build time;
 * - **thin instances for anything repeated** - trees, lamp posts, signal
 *   heads: one draw call for 500 trees;
 * - **world-space UVs on facades**, so a window is the same size on a house
 *   and on a 200 m tower instead of being stretched with the box.
 *
 * Coordinates arrive in CARLA's frame and go through `toScene` exactly once.
 */

import type * as BJS from '../stage3d/babylon';
import type { DriveMap } from '../utils/driveSim';

type B = typeof BJS;

export interface CityHandles {
    root: BJS.TransformNode;
    /** Update the signal heads: one `g`/`y`/`r` character per light. */
    setLights(states: string): void;
    /** Day or night: windows, lamps and street lights. */
    setNight(night: boolean, wet: number): void;
    shadowCasters: BJS.Mesh[];
    dispose(): void;
}

interface Geo {
    positions: number[];
    indices: number[];
    uvs: number[];
}

function geo(): Geo {
    return { positions: [], indices: [], uvs: [] };
}

/** CARLA (x, y, z) -> Babylon (x, z, -y). See `toScene` in driveSim.ts. */
function v3(g: Geo, x: number, y: number, z: number, u = 0, v = 0): number {
    const index = g.positions.length / 3;
    g.positions.push(x, z, -y);
    g.uvs.push(u, v);
    return index;
}

function quad(g: Geo, a: number, b: number, c: number, d: number) {
    // Babylon is left-handed with clockwise front faces; a quad given
    // counter-clockwise in CARLA's top view is clockwise in Babylon's.
    g.indices.push(a, b, c, a, c, d);
}

function finish(Bn: B, scene: BJS.Scene, name: string, g: Geo,
                material: BJS.Material, parent: BJS.TransformNode): BJS.Mesh | null {
    if (!g.indices.length) return null;
    const mesh = new Bn.Mesh(name, scene);
    const data = new Bn.VertexData();
    data.positions = g.positions;
    data.indices = g.indices;
    data.uvs = g.uvs;
    const normals: number[] = [];
    Bn.VertexData.ComputeNormals(g.positions, g.indices, normals);
    data.normals = normals;
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.parent = parent;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    return mesh;
}

/** A flat polygon (convex or star-shaped from its first vertex) at height z. */
function fan(g: Geo, poly: number[][], z: number) {
    if (poly.length < 3) return;
    const ids = poly.map(p => v3(g, p[0], p[1], z, p[0] / 4, p[1] / 4));
    for (let i = 1; i < ids.length - 1; i += 1) {
        g.indices.push(ids[0], ids[i + 1], ids[i]);
    }
}

/** A strip between two polylines of possibly different lengths ("zipper"). */
function strip(g: Geo, left: number[][], right: number[][], z: number) {
    if (left.length < 2 || right.length < 2) return;
    const cum = (pts: number[][]) => {
        const out = [0];
        for (let i = 1; i < pts.length; i += 1) {
            out.push(out[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0],
                pts[i][1] - pts[i - 1][1]));
        }
        return out;
    };
    const sl = cum(left);
    const sr = cum(right);
    const tl = sl[sl.length - 1] || 1;
    const tr = sr[sr.length - 1] || 1;
    const L = left.map((p, i) => v3(g, p[0], p[1], z, sl[i] / 6, 0));
    const R = right.map((p, i) => v3(g, p[0], p[1], z, sr[i] / 6, 1));
    let i = 0;
    let j = 0;
    while (i < L.length - 1 || j < R.length - 1) {
        const fl = i < L.length - 1 ? sl[i + 1] / tl : 2;
        const fr = j < R.length - 1 ? sr[j + 1] / tr : 2;
        if (fl <= fr) {
            g.indices.push(L[i], L[i + 1], R[j]);
            i += 1;
        } else {
            g.indices.push(L[i], R[j + 1], R[j]);
            j += 1;
        }
    }
}

/** A line along a polyline as thin quads, optionally dashed. */
function line(g: Geo, pts: number[][], width: number, z: number,
              dash = 0, gap = 0, offset = 0) {
    let run = 0;
    for (let i = 0; i < pts.length - 1; i += 1) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 1e-4) continue;
        const dx = (bx - ax) / len;
        const dy = (by - ay) / len;
        const rx = -dy;
        const ry = dx;
        const ox = rx * offset;
        const oy = ry * offset;
        const emit = (s0: number, s1: number) => {
            const x0 = ax + dx * s0 + ox;
            const y0 = ay + dy * s0 + oy;
            const x1 = ax + dx * s1 + ox;
            const y1 = ay + dy * s1 + oy;
            const h = width / 2;
            const a = v3(g, x0 - rx * h, y0 - ry * h, z);
            const b = v3(g, x0 + rx * h, y0 + ry * h, z);
            const c = v3(g, x1 + rx * h, y1 + ry * h, z);
            const d = v3(g, x1 - rx * h, y1 - ry * h, z);
            quad(g, a, d, c, b);
        };
        if (!dash) {
            emit(0, len);
        } else {
            let s = 0;
            while (s < len) {
                const phase = (run + s) % (dash + gap);
                if (phase < dash) {
                    const e = Math.min(len, s + (dash - phase));
                    emit(s, e);
                    s = e;
                } else {
                    s = Math.min(len, s + (dash + gap - phase));
                }
            }
        }
        run += len;
    }
}

/** A box with world-space UVs on its walls (for facades). */
function building(g: Geo, roof: Geo, cx: number, cy: number, w: number, d: number,
                  h: number, yaw: number, z0 = 0) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const corner = (lx: number, ly: number) =>
        [cx + lx * c - ly * s, cy + lx * s + ly * c];
    const pts = [corner(w / 2, d / 2), corner(w / 2, -d / 2),
        corner(-w / 2, -d / 2), corner(-w / 2, d / 2)];
    let along = 0;
    for (let i = 0; i < 4; i += 1) {
        const p = pts[i];
        const q = pts[(i + 1) % 4];
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const a = v3(g, p[0], p[1], z0, along / 3.2, z0 / 3.4);
        const b = v3(g, q[0], q[1], z0, (along + len) / 3.2, z0 / 3.4);
        const t = v3(g, q[0], q[1], z0 + h, (along + len) / 3.2, (z0 + h) / 3.4);
        const u = v3(g, p[0], p[1], z0 + h, along / 3.2, (z0 + h) / 3.4);
        quad(g, a, b, t, u);
        along += len;
    }
    const ids = pts.map(p => v3(roof, p[0], p[1], z0 + h, p[0] / 5, p[1] / 5));
    roof.indices.push(ids[0], ids[2], ids[1], ids[0], ids[3], ids[2]);
}

/* ─────────────────── materials ─────────────────── */

function std(Bn: B, scene: BJS.Scene, name: string, rgb: [number, number, number],
             spec = 0.08): BJS.StandardMaterial {
    const m = new Bn.StandardMaterial(name, scene);
    m.diffuseColor = new Bn.Color3(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
    m.specularColor = new Bn.Color3(spec, spec, spec);
    // Generated geometry: light both faces rather than trust every winding.
    m.backFaceCulling = false;
    m.twoSidedLighting = true;
    return m;
}

/**
 * A facade texture: a grid of windows on a wall colour, with the variation
 * that stops a city reading as one building repeated. The night version lights
 * a random third of the windows.
 */
function facade(Bn: B, scene: BJS.Scene, kind: string, wall: string, glass: string,
                lit = false): BJS.DynamicTexture {
    const size = 256;
    const tex = new Bn.DynamicTexture(`facade-${kind}-${lit}`, { width: size, height: size },
        scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    let seed = kind.length * 977 + (lit ? 13 : 7);
    const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    ctx.fillStyle = lit ? '#000000' : wall;
    ctx.fillRect(0, 0, size, size);
    const cols = kind === 'tower' || kind === 'glass' ? 4 : 2;
    const rows = 4;
    const cw = size / cols;
    const rh = size / rows;
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const inset = kind === 'glass' ? 2 : kind === 'tower' ? 4 : 10;
            const on = lit ? rnd() < 0.38 : true;
            if (!on) continue;
            ctx.fillStyle = lit ? (rnd() < 0.5 ? '#ffd38a' : '#ffe9c2') : glass;
            ctx.fillRect(c * cw + inset, r * rh + inset * 1.4, cw - inset * 2,
                rh - inset * 2.6);
        }
    }
    tex.update();
    tex.wrapU = 1;
    tex.wrapV = 1;
    return tex;
}

const PALETTES: Record<string, string[]> = {
    tower: ['#5f6f86', '#4d5e78', '#6c7a8f', '#3f4d63', '#768599', '#55657d',
        '#62748e', '#46566e'],
    glass: ['#6f8fb3', '#5a7fa6', '#7aa2c4', '#4f739b', '#86a9c8', '#6185ad',
        '#7395ba', '#5379a2'],
    office: ['#9a9a95', '#a7a39b', '#8e939a', '#b3ada3', '#9fa6ad', '#a8a090',
        '#8f8b84', '#b0b5ba'],
    residential: ['#c9b8a2', '#b7a58e', '#d6c7b1', '#a99780', '#c4b3a0', '#bfa98f',
        '#d2c0a6', '#b29e86'],
    house: ['#e6dccb', '#d9c8ad', '#f0e6d4', '#cbb898', '#e2d2b8', '#d5c3a3',
        '#efe2c8', '#c8b391'],
    shop: ['#d8cfc2', '#c9bba6', '#e3dbcd', '#bfae94', '#d2c6b3', '#c7b8a1',
        '#ddd2c0', '#b9a78c'],
    industrial: ['#8d9297', '#7c8288', '#9aa0a5', '#73797f', '#868c92', '#93999e',
        '#80868c', '#9fa4a9'],
    podium: ['#7d8590', '#6f7781', '#8a929c', '#646c76', '#77808a', '#848c96',
        '#6b737d', '#8f97a0'],
};

const GLASS: Record<string, string> = {
    tower: '#9fc3e6', glass: '#bcd8f2', office: '#5d6f84', residential: '#4f5f73',
    house: '#3f4d5f', shop: '#62788f', industrial: '#5a6470', podium: '#80a3c4',
};

/* ─────────────────── the build ─────────────────── */

export function buildCity(Bn: B, scene: BJS.Scene, map: DriveMap,
                          quality: 'high' | 'low'): CityHandles {
    const root = new Bn.TransformNode('city', scene);
    const meshes: BJS.Mesh[] = [];
    const materials: BJS.Material[] = [];
    const textures: BJS.BaseTexture[] = [];
    const keep = (m: BJS.Mesh | null) => { if (m) meshes.push(m); return m; };
    const style = map.style || 'town';

    // Ground: grass (or, in a city, dull concrete) under everything.
    const [x0, y0, x1, y1] = map.bounds;
    const ground = new Geo0();
    fan(ground.g, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], -0.02);
    const groundMat = std(Bn, scene, 'ground', style === 'highway' || style === 'track'
        ? [92, 120, 70] : [104, 118, 90]);
    materials.push(groundMat);
    const groundMesh = keep(finish(Bn, scene, 'ground', ground.g, groundMat, root));
    if (groundMesh) groundMesh.receiveShadows = true;

    // Blocks: raised pavement slabs, or parks.
    const slab = geo();
    const park = geo();
    const curb = geo();
    for (const block of map.blocks || []) {
        const poly = block.poly;
        const target = block.kind === 'block' ? slab : park;
        fan(target, poly, block.kind === 'block' ? 0.15 : 0.12);
        for (let i = 0; i < poly.length; i += 1) {
            const p = poly[i];
            const q = poly[(i + 1) % poly.length];
            const a = v3(curb, p[0], p[1], 0);
            const b = v3(curb, q[0], q[1], 0);
            const c = v3(curb, q[0], q[1], 0.15);
            const d = v3(curb, p[0], p[1], 0.15);
            quad(curb, a, d, c, b);
        }
    }
    const slabMat = std(Bn, scene, 'pavement', [178, 176, 170]);
    const parkMat = std(Bn, scene, 'park', [92, 138, 74]);
    const curbMat = std(Bn, scene, 'curb', [196, 194, 188]);
    materials.push(slabMat, parkMat, curbMat);
    keep(finish(Bn, scene, 'pavement', slab, slabMat, root))!.receiveShadows = true;
    keep(finish(Bn, scene, 'parks', park, parkMat, root));
    keep(finish(Bn, scene, 'curbs', curb, curbMat, root));

    // Shoulders and kerbs (motorway, track).
    const shoulder = geo();
    const kerbRed = geo();
    const kerbWhite = geo();
    for (const sh of map.shoulders || []) {
        if (sh.kind === 'kerb') {
            line(kerbRed, sh.pts, sh.w, 0.03, 1.5, 1.5);
            line(kerbWhite, sh.pts, sh.w, 0.03, 1.5, 1.5, 0);
        } else {
            line(shoulder, sh.pts, sh.w, 0.0);
        }
    }
    const shoulderMat = std(Bn, scene, 'shoulder', [120, 118, 108]);
    const kerbRedMat = std(Bn, scene, 'kerb-red', [196, 40, 40]);
    const kerbWhiteMat = std(Bn, scene, 'kerb-white', [235, 235, 235]);
    materials.push(shoulderMat, kerbRedMat, kerbWhiteMat);
    keep(finish(Bn, scene, 'shoulders', shoulder, shoulderMat, root));
    keep(finish(Bn, scene, 'kerb-r', kerbRed, kerbRedMat, root));
    // The white half sits in the gaps of the red one.
    const kw = geo();
    for (const sh of map.shoulders || []) {
        if (sh.kind === 'kerb') line(kw, sh.pts, sh.w, 0.031, 1.5, 1.5, 0);
    }
    void kerbWhite;
    keep(finish(Bn, scene, 'kerb-w', kw, kerbWhiteMat, root));

    // Asphalt.
    const road = geo();
    for (const s of map.surfaces || []) strip(road, s.left, s.right, 0.02);
    for (const j of map.junctions || []) fan(road, j.poly, 0.021);
    const roadMat = std(Bn, scene, 'asphalt', [58, 60, 66], 0.12);
    roadMat.specularPower = 32;
    materials.push(roadMat);
    const roadMesh = keep(finish(Bn, scene, 'roads', road, roadMat, root));
    if (roadMesh) roadMesh.receiveShadows = true;

    // Markings.
    const white = geo();
    const yellow = geo();
    for (const m of map.markings || []) {
        const target = m.color === 'yellow' ? yellow : white;
        if (m.type === 'broken') line(target, m.pts, 0.15, 0.035, 3, 3);
        else if (m.type === 'double') {
            line(target, m.pts, 0.12, 0.035, 0, 0, 0.13);
            line(target, m.pts, 0.12, 0.035, 0, 0, -0.13);
        } else if (m.type === 'stop') line(target, m.pts, 0.45, 0.036);
        else line(target, m.pts, 0.15, 0.035);
    }
    for (const cw of map.crosswalks || []) {
        const [p0, p1, p2, p3] = cw.pts;
        const width = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const n = Math.max(1, Math.floor(width / 1.0));
        for (let k = 0; k < n; k += 1) {
            const f0 = (k + 0.2) / n;
            const f1 = (k + 0.7) / n;
            const at = (a: number[], b: number[], f: number) =>
                [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
            const a = at(p0, p1, f0);
            const b = at(p0, p1, f1);
            const c = at(p3, p2, f1);
            const d = at(p3, p2, f0);
            const ia = v3(white, a[0], a[1], 0.034);
            const ib = v3(white, b[0], b[1], 0.034);
            const ic = v3(white, c[0], c[1], 0.034);
            const id = v3(white, d[0], d[1], 0.034);
            quad(white, ia, id, ic, ib);
        }
    }
    const whiteMat = std(Bn, scene, 'paint-white', [236, 236, 230]);
    const yellowMat = std(Bn, scene, 'paint-yellow', [240, 196, 50]);
    whiteMat.emissiveColor = new Bn.Color3(0.12, 0.12, 0.12);
    yellowMat.emissiveColor = new Bn.Color3(0.12, 0.09, 0.0);
    materials.push(whiteMat, yellowMat);
    keep(finish(Bn, scene, 'markings-w', white, whiteMat, root));
    keep(finish(Bn, scene, 'markings-y', yellow, yellowMat, root));

    // Buildings, one merged mesh per kind, two materials (day, night windows).
    const byKind = new Map<string, { walls: Map<number, Geo>; roof: Geo }>();
    for (const b of map.buildings || []) {
        const [cx, cy, w, d, h, yaw, kind, color] = b;
        const entry = byKind.get(kind) || { walls: new Map(), roof: geo() };
        const key = (color || 0) % 8;
        const walls = entry.walls.get(key) || geo();
        building(walls, entry.roof, cx, cy, w, d, h, yaw, 0);
        entry.walls.set(key, walls);
        byKind.set(kind, entry);
    }
    const nightMats: BJS.StandardMaterial[] = [];
    const roofMat = std(Bn, scene, 'roof', [88, 92, 98]);
    materials.push(roofMat);
    for (const [kind, entry] of byKind) {
        for (const [colorIndex, g] of entry.walls) {
            const palette = PALETTES[kind] || PALETTES.office;
            const wall = palette[colorIndex % palette.length];
            const mat = new Bn.StandardMaterial(`wall-${kind}-${colorIndex}`, scene);
            const day = facade(Bn, scene, kind + colorIndex, wall, GLASS[kind] || '#556677');
            const night = facade(Bn, scene, kind + colorIndex, wall, '#000000', true);
            textures.push(day, night);
            mat.diffuseTexture = day;
            mat.emissiveTexture = night;
            mat.emissiveColor = new Bn.Color3(0, 0, 0);
            const glassy = kind === 'glass' || kind === 'tower';
            mat.specularColor = glassy ? new Bn.Color3(0.55, 0.6, 0.7)
                : new Bn.Color3(0.06, 0.06, 0.06);
            mat.specularPower = glassy ? 96 : 16;
            mat.backFaceCulling = false;
            mat.twoSidedLighting = true;
            materials.push(mat);
            nightMats.push(mat);
            keep(finish(Bn, scene, `bld-${kind}-${colorIndex}`, g, mat, root));
        }
        keep(finish(Bn, scene, `roof-${kind}`, entry.roof, roofMat, root));
    }

    // Trees and lamps as thin instances.
    const trunkMat = std(Bn, scene, 'trunk', [92, 66, 44]);
    const leafMat = std(Bn, scene, 'leaves', [64, 118, 58]);
    const leafMat2 = std(Bn, scene, 'leaves-2', [86, 136, 66]);
    materials.push(trunkMat, leafMat, leafMat2);
    const segs = quality === 'high' ? 8 : 5;
    const trunk = Bn.CreateCylinder('trunk', { height: 1, diameter: 1, tessellation: segs },
        scene);
    trunk.material = trunkMat;
    trunk.parent = root;
    const crownA = Bn.CreateSphere('crown-a', { diameter: 1, segments: segs - 2 }, scene);
    crownA.material = leafMat;
    crownA.parent = root;
    const crownB = Bn.CreateCylinder('crown-b', { height: 1, diameterTop: 0,
        diameterBottom: 1, tessellation: segs }, scene);
    crownB.material = leafMat2;
    crownB.parent = root;
    const M = Bn.Matrix;
    const V = Bn.Vector3;
    const Q = Bn.Quaternion;
    const ident = Q.Identity();
    const trees = map.trees || [];
    const trunkMats: BJS.Matrix[] = [];
    const crownAMats: BJS.Matrix[] = [];
    const crownBMats: BJS.Matrix[] = [];
    for (let i = 0; i < trees.length; i += 1) {
        const [tx, ty, sc, kind] = trees[i];
        const k = sc || 1;
        trunkMats.push(M.Compose(new V(0.28 * k, 2.6 * k, 0.28 * k), ident,
            new V(tx, 1.3 * k, -ty)));
        if ((kind === 1 && i % 3 === 0) || style === 'highway' && i % 2 === 0) {
            crownBMats.push(M.Compose(new V(3.2 * k, 6.0 * k, 3.2 * k), ident,
                new V(tx, 2.4 * k + 3.0 * k, -ty)));
        } else {
            crownAMats.push(M.Compose(new V(3.4 * k, 3.0 * k, 3.4 * k), ident,
                new V(tx, 3.6 * k, -ty)));
        }
    }
    const thin = (mesh: BJS.Mesh, mats: BJS.Matrix[]) => {
        if (!mats.length) {
            mesh.setEnabled(false);
            return;
        }
        const buffer = new Float32Array(mats.length * 16);
        mats.forEach((mm, i) => mm.copyToArray(buffer, i * 16));
        mesh.thinInstanceSetBuffer('matrix', buffer, 16, true);
        mesh.isPickable = false;
        meshes.push(mesh);
    };
    thin(trunk, trunkMats);
    thin(crownA, crownAMats);
    thin(crownB, crownBMats);

    const poleMat = std(Bn, scene, 'pole', [70, 74, 80], 0.3);
    const bulbMat = new Bn.StandardMaterial('bulb', scene);
    bulbMat.diffuseColor = new Bn.Color3(0.9, 0.88, 0.8);
    bulbMat.emissiveColor = new Bn.Color3(0.2, 0.2, 0.18);
    materials.push(poleMat, bulbMat);
    const pole = Bn.CreateCylinder('lamp-pole', { height: 1, diameter: 1, tessellation: 6 },
        scene);
    pole.material = poleMat;
    pole.parent = root;
    const arm = Bn.CreateBox('lamp-arm', { size: 1 }, scene);
    arm.material = poleMat;
    arm.parent = root;
    const bulb = Bn.CreateBox('lamp-bulb', { size: 1 }, scene);
    bulb.material = bulbMat;
    bulb.parent = root;
    const poles: BJS.Matrix[] = [];
    const arms: BJS.Matrix[] = [];
    const bulbs: BJS.Matrix[] = [];
    for (const [lx, ly, yaw] of map.lamps || []) {
        const rot = Q.RotationAxis(V.Up(), yaw);
        poles.push(M.Compose(new V(0.18, 8, 0.18), ident, new V(lx, 4, -ly)));
        const ax = lx + Math.cos(yaw) * 1.1;
        const ay = ly + Math.sin(yaw) * 1.1;
        arms.push(M.Compose(new V(2.2, 0.12, 0.12), rot, new V(ax, 7.9, -ay)));
        const bx = lx + Math.cos(yaw) * 2.0;
        const by = ly + Math.sin(yaw) * 2.0;
        bulbs.push(M.Compose(new V(0.7, 0.14, 0.3), rot, new V(bx, 7.8, -by)));
    }
    thin(pole, poles);
    thin(arm, arms);
    thin(bulb, bulbs);

    // Props: grandstands and motorway gantries.
    const propMat = std(Bn, scene, 'props', [150, 154, 160], 0.2);
    materials.push(propMat);
    for (const p of map.props || []) {
        if (p.kind === 'grandstand') {
            const g = geo();
            const roofg = geo();
            building(g, roofg, p.x, p.y, p.w, p.d, p.h, p.yaw, 0);
            keep(finish(Bn, scene, 'grandstand', g, propMat, root));
            keep(finish(Bn, scene, 'grandstand-roof', roofg, roofMat, root));
        } else if (p.kind === 'gantry') {
            const g = geo();
            const roofg = geo();
            const rx = -Math.sin(p.yaw);
            const ry = Math.cos(p.yaw);
            for (const side of [-1, 1]) {
                building(g, roofg, p.x + rx * side * p.w / 2, p.y + ry * side * p.w / 2,
                    0.5, 0.5, p.h, p.yaw, 0);
            }
            building(g, roofg, p.x, p.y, 0.6, p.w, 1.2, p.yaw, p.h - 1.2);
            keep(finish(Bn, scene, 'gantry', g, propMat, root));
            keep(finish(Bn, scene, 'gantry-top', roofg, propMat, root));
        }
    }

    // Traffic signals: a pole, an arm over the lanes and a head with three
    // lamps. The lamps are three on/off pairs of thin-instance meshes, and a
    // state change just moves matrices between them.
    const lights = map.lights || [];
    const signalMat = std(Bn, scene, 'signal', [34, 36, 40], 0.3);
    materials.push(signalMat);
    const sPole = Bn.CreateCylinder('sig-pole', { height: 1, diameter: 1, tessellation: 8 },
        scene);
    sPole.material = signalMat;
    sPole.parent = root;
    const sArm = Bn.CreateBox('sig-arm', { size: 1 }, scene);
    sArm.material = signalMat;
    sArm.parent = root;
    const sHead = Bn.CreateBox('sig-head', { size: 1 }, scene);
    sHead.material = signalMat;
    sHead.parent = root;
    const lampColors: Record<string, [number, number, number]> = {
        r: [1.0, 0.12, 0.08], y: [1.0, 0.72, 0.05], g: [0.1, 1.0, 0.35],
    };
    const lampOn: Record<string, BJS.Mesh> = {};
    const lampOff: Record<string, BJS.Mesh> = {};
    for (const key of ['r', 'y', 'g']) {
        const [r, gg, b] = lampColors[key];
        const on = new Bn.StandardMaterial(`lamp-${key}-on`, scene);
        on.diffuseColor = new Bn.Color3(r, gg, b);
        on.emissiveColor = new Bn.Color3(r, gg, b);
        const off = new Bn.StandardMaterial(`lamp-${key}-off`, scene);
        off.diffuseColor = new Bn.Color3(r * 0.18, gg * 0.18, b * 0.18);
        off.specularColor = new Bn.Color3(0.2, 0.2, 0.2);
        materials.push(on, off);
        lampOn[key] = Bn.CreateSphere(`lamp-${key}-on`, { diameter: 1, segments: 6 }, scene);
        lampOn[key].material = on;
        lampOn[key].parent = root;
        lampOff[key] = Bn.CreateSphere(`lamp-${key}-off`, { diameter: 1, segments: 6 }, scene);
        lampOff[key].material = off;
        lampOff[key].parent = root;
    }
    const poleM: BJS.Matrix[] = [];
    const armM: BJS.Matrix[] = [];
    const headM: BJS.Matrix[] = [];
    const lampAt: Record<string, BJS.Matrix[]> = { r: [], y: [], g: [] };
    for (const L of lights) {
        const rot = Q.RotationAxis(V.Up(), L.yaw);
        // Across the road: the right of the light's facing direction.
        const ax = -Math.sin(L.yaw);
        const ay = Math.cos(L.yaw);
        const reach = Math.max(2.5, L.span * 0.7);
        poleM.push(M.Compose(new V(0.22, 6.0, 0.22), ident, new V(L.x, 3.0, -L.y)));
        const mx = L.x + ax * reach / 2;
        const my = L.y + ay * reach / 2;
        armM.push(M.Compose(new V(0.16, 0.16, reach), rot, new V(mx, 5.9, -my)));
        const hx = L.x + ax * reach;
        const hy = L.y + ay * reach;
        headM.push(M.Compose(new V(0.38, 1.1, 0.42), rot, new V(hx, 5.3, -hy)));
        const fx = Math.cos(L.yaw) * 0.22;
        const fy = Math.sin(L.yaw) * 0.22;
        const order: Array<[string, number]> = [['r', 5.65], ['y', 5.3], ['g', 4.95]];
        for (const [key, z] of order) {
            lampAt[key].push(M.Compose(new V(0.26, 0.26, 0.26), ident,
                new V(hx + fx, z, -(hy + fy))));
        }
    }
    thin(sPole, poleM);
    thin(sArm, armM);
    thin(sHead, headM);
    const hidden = M.Compose(new V(0, 0, 0), ident, new V(0, -100, 0));
    const lampBuffers: Record<string, { on: Float32Array; off: Float32Array }> = {};
    for (const key of ['r', 'y', 'g']) {
        lampBuffers[key] = { on: new Float32Array(lights.length * 16),
            off: new Float32Array(lights.length * 16) };
        if (lights.length) {
            lampOn[key].thinInstanceSetBuffer('matrix', lampBuffers[key].on, 16, false);
            lampOff[key].thinInstanceSetBuffer('matrix', lampBuffers[key].off, 16, false);
            meshes.push(lampOn[key], lampOff[key]);
        } else {
            lampOn[key].setEnabled(false);
            lampOff[key].setEnabled(false);
        }
    }
    let lastStates = '';
    const setLights = (states: string) => {
        if (!lights.length || states === lastStates) return;
        lastStates = states;
        for (const key of ['r', 'y', 'g']) {
            const { on, off } = lampBuffers[key];
            lights.forEach((_l, i) => {
                const lit = (states[i] || 'r') === key;
                (lit ? lampAt[key][i] : hidden).copyToArray(on, i * 16);
                (lit ? hidden : lampAt[key][i]).copyToArray(off, i * 16);
            });
            lampOn[key].thinInstanceBufferUpdated('matrix');
            lampOff[key].thinInstanceBufferUpdated('matrix');
        }
    };
    setLights('r'.repeat(lights.length));

    const setNight = (night: boolean, wet: number) => {
        for (const mat of nightMats) {
            mat.emissiveColor = night ? new Bn.Color3(0.85, 0.8, 0.7) : new Bn.Color3(0, 0, 0);
        }
        bulbMat.emissiveColor = night ? new Bn.Color3(1.0, 0.92, 0.75)
            : new Bn.Color3(0.2, 0.2, 0.18);
        // Wet asphalt is darker and shinier.
        const k = 1 - 0.35 * wet;
        roadMat.diffuseColor = new Bn.Color3(0.23 * k, 0.235 * k, 0.26 * k);
        roadMat.specularColor = new Bn.Color3(0.12 + 0.55 * wet, 0.12 + 0.55 * wet,
            0.14 + 0.6 * wet);
        roadMat.specularPower = 32 + 96 * wet;
    };

    return {
        root,
        setLights,
        setNight,
        shadowCasters: [],
        dispose() {
            for (const m of meshes) m.dispose();
            for (const t of textures) t.dispose();
            for (const m of materials) m.dispose();
            root.dispose();
        },
    };
}

class Geo0 {
    g: Geo = geo();
}
