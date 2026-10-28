/**
 * The eighteen concept illustrations a glossary term or a track can ask for.
 *
 * Each is a SCHEMATIC, not a picture: a client sends packets to a server, a
 * control node pulses its workers, events flow down a topic's partitions. The
 * point is the motion - it is what a static paragraph cannot show - so every
 * scene is built around one moving thing, and in reduced motion it is posed at
 * a moment where that thing is visibly mid-way.
 *
 * Built from the kit's primitives and coloured from the theme's accents, so a
 * light galaxy gets a light illustration. Labels come from the glossary (<= 6,
 * <= 16 chars) and are drawn as camera-facing sprites.
 */
import * as THREE from 'three';
import type { SceneKind } from '@/utils/labDocs';
import {
    box, cylinder, ease, label, link, sphere, spread, type Stage, type Update,
} from './sceneKit';

type V = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function put(stage: Stage, obj: THREE.Object3D, x: number, y: number, z = 0) {
    obj.position.set(x, y, z);
    stage.root.add(obj);
    return obj;
}

function tag(stage: Stage, text: string | undefined, x: number, y: number, z = 0, size?: number) {
    if (!text) return null;
    return put(stage, label(stage, text, { size }), x, y, z);
}

function colors(stage: Stage) {
    const p = stage.palette;
    return [p.accent, p.accent2, p.accent3, p.good, p.muted, p.accent];
}

/** A packet travelling a->b over `period` seconds, offset by `phase` (0..1). */
function travel(obj: THREE.Object3D, a: V, b: V, t: number, period: number, phase = 0, lift = 0.6) {
    const k = ((t / period + phase) % 1 + 1) % 1;
    obj.position.lerpVectors(a, b, k);
    obj.position.y += Math.sin(k * Math.PI) * lift;
    return k;
}

const SCENES: Record<SceneKind, (stage: Stage, labels: string[]) => Update> = {
    'client-server': (stage, labels) => {
        const c = colors(stage);
        const names = labels.length >= 3 ? labels : [labels[0], '', labels[1] || labels[0]];
        const xs = names[1] ? [-3.6, 0, 3.6] : [-3, 0, 3];
        const client = put(stage, box(stage, 1.5, 1, 0.12, c[0]), xs[0], 0.9);
        put(stage, box(stage, 0.5, 0.5, 0.4, stage.palette.muted), xs[0], 0.15);
        if (names[1]) put(stage, box(stage, 1, 1, 1, c[2]), xs[1], 0.6);
        const server = put(stage, box(stage, 1.1, 2, 1.1, c[1]), xs[2], 1);
        for (let i = 0; i < 3; i += 1) put(stage, box(stage, 0.8, 0.08, 0.02, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.3 }), xs[2], 0.5 + i * 0.5, 0.56);
        names.forEach((n, i) => tag(stage, n, xs[i], -0.45));
        const req = put(stage, sphere(stage, 0.16, c[0], { emissive: c[0], emissiveIntensity: 0.6 }), 0, 0);
        const res = put(stage, sphere(stage, 0.16, c[1], { emissive: c[1], emissiveIntensity: 0.6 }), 0, 0);
        const a = v(xs[0] + 0.8, 0.9, 0), b = v(xs[2] - 0.6, 1, 0);
        return (t) => {
            travel(req, a, b, t, 2.4, 0, 0.8);
            travel(res, b, a, t, 2.4, 0.5, -0.4);
            client.rotation.y = Math.sin(t * 0.6) * 0.08;
            server.rotation.y = Math.sin(t * 0.5) * 0.06;
        };
    },

    layers: (stage, labels) => {
        const c = colors(stage);
        const n = labels.length;
        const slabs = labels.map((name, i) => {
            const slab = put(stage, box(stage, 4.4 - i * 0.25, 0.32, 2.4 - i * 0.12, c[i % c.length], { transparent: true, opacity: 0.88 }), 0, i * 0.62);
            tag(stage, name, 3.4, i * 0.62);
            return slab;
        });
        const dot = put(stage, sphere(stage, 0.15, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.8 }), 0, 0);
        return (t) => {
            const k = (t / 3) % 1;
            dot.position.set(-1.2, k * (n - 1) * 0.62 + 0.25, 0.9);
            slabs.forEach((s, i) => { s.position.x = Math.sin(t * 0.8 + i) * 0.06; });
        };
    },

    pipeline: (stage, labels) => {
        const c = colors(stage);
        const xs = spread(labels.length, 8);
        put(stage, box(stage, 9, 0.08, 0.7, stage.palette.muted), 0, 0.05);
        labels.forEach((name, i) => {
            put(stage, box(stage, 1, 1.1, 1, c[i % c.length], { transparent: true, opacity: 0.85 }), xs[i], 0.65);
            tag(stage, name, xs[i], -0.5);
        });
        const items = Array.from({ length: 5 }, () => put(stage, box(stage, 0.32, 0.32, 0.32, '#ffffff'), 0, 0.3));
        return (t) => {
            items.forEach((item, i) => {
                const k = ((t / 6) + i / items.length) % 1;
                item.position.x = -4.5 + k * 9;
                const stageAt = Math.min(labels.length - 1, Math.floor(k * labels.length));
                (item as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material.color.set(c[stageAt % c.length]);
                item.rotation.y = t + i;
            });
        };
    },

    cluster: (stage, labels) => {
        const c = colors(stage);
        const control = put(stage, box(stage, 1.3, 1.3, 1.3, c[0]), 0, 2.1);
        tag(stage, labels[0], 0, 3.2);
        const workers = labels.slice(1);
        const count = Math.max(2, workers.length);
        const pulses: Array<[THREE.Object3D, V, V]> = [];
        const nodes: THREE.Object3D[] = [];
        for (let i = 0; i < count; i += 1) {
            const ang = (i / count) * Math.PI * 2 + 0.4;
            const x = Math.cos(ang) * 3.4, z = Math.sin(ang) * 1.6;
            const node = put(stage, box(stage, 0.9, 0.9, 0.9, c[1 + (i % 3)]), x, 0.4, z);
            nodes.push(node);
            tag(stage, workers[i] || '', x, -0.45, z);
            stage.root.add(link(stage, v(0, 2.1, 0), v(x, 0.4, z), stage.palette.muted));
            const p = put(stage, sphere(stage, 0.11, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.8 }), 0, 0);
            pulses.push([p, v(0, 2.1, 0), v(x, 0.4, z)]);
        }
        return (t) => {
            control.rotation.y = t * 0.4;
            pulses.forEach(([p, a, b], i) => travel(p, a, b, t, 1.8, i / pulses.length, 0));
            nodes.forEach((n, i) => { n.position.y = 0.4 + Math.sin(t * 2 + i) * 0.06; });
        };
    },

    database: (stage, labels) => {
        const c = colors(stage);
        const db = put(stage, cylinder(stage, 1.2, 1.2, 1.9, c[0]), -2, 1);
        for (let i = 0; i < 3; i += 1) put(stage, cylinder(stage, 1.22, 1.22, 0.05, '#ffffff', { transparent: true, opacity: 0.6 }), -2, 0.4 + i * 0.6);
        tag(stage, labels[0], -2, -0.35);
        const tables = labels.slice(1).length ? labels.slice(1) : [''];
        const rows: THREE.Object3D[] = [];
        tables.forEach((name, ti) => {
            const x = 1.2 + ti * 2.4;
            tag(stage, name, x, 2.4);
            for (let r = 0; r < 5; r += 1) {
                const row = put(stage, box(stage, 2, 0.26, 0.6, r === 0 ? c[1] : stage.palette.surface), x, 1.85 - r * 0.36);
                rows.push(row);
            }
            stage.root.add(link(stage, v(-0.8, 1, 0), v(x - 1, 1.2, 0), stage.palette.muted));
        });
        return (t) => {
            db.rotation.y = t * 0.3;
            rows.forEach((row, i) => { row.scale.x = 0.6 + 0.4 * ease(Math.min(1, Math.max(0, (Math.sin(t * 1.2 - i * 0.35) + 1) / 2))); });
        };
    },

    storage: (stage, labels) => {
        const c = colors(stage);
        const bucket = put(stage, cylinder(stage, 1.5, 1.1, 1.6, c[0], { side: THREE.DoubleSide, transparent: true, opacity: 0.9 }, true), 0, 0.8);
        put(stage, cylinder(stage, 1.1, 1.1, 0.06, c[0]), 0, 0.03);
        tag(stage, labels[0], 0, -0.5);
        const objs = labels.slice(1);
        const items = Array.from({ length: Math.max(3, objs.length) }, (_, i) => put(stage, box(stage, 0.42, 0.42, 0.42, c[1 + (i % 3)]), 0, 3));
        objs.forEach((name, i) => tag(stage, name, -3.2 + i * 2.2, 2.8));
        return (t) => {
            items.forEach((item, i) => {
                const k = ((t / 2.8) + i / items.length) % 1;
                const x0 = -3.2 + (i % 4) * 2.2;
                item.position.set(x0 * (1 - k), 3 - k * 2.6 + Math.sin(k * Math.PI) * 0.8, 0);
                item.rotation.set(t + i, t * 0.7, 0);
                item.visible = k < 0.95;
            });
            bucket.rotation.y = t * 0.2;
        };
    },

    containers: (stage, labels) => {
        const c = colors(stage);
        put(stage, box(stage, 7.4, 0.5, 2.6, stage.palette.muted), 0, 0);
        tag(stage, labels[0], 0, -0.6);
        const boxes = labels.slice(1);
        const xs = spread(Math.max(1, boxes.length), 5.6);
        const made = boxes.map((name, i) => {
            const b = put(stage, box(stage, 1.2, 1, 1.4, c[i % 3]), xs[i], 0.8);
            tag(stage, name, xs[i], 1.75);
            return b;
        });
        return (t) => made.forEach((b, i) => { b.position.y = 0.8 + Math.abs(Math.sin(t * 1.4 + i)) * 0.12; b.rotation.y = Math.sin(t + i) * 0.1; });
    },

    network: (stage, labels) => {
        const c = colors(stage);
        const n = labels.length;
        const pts = labels.map((_, i) => {
            const ang = (i / n) * Math.PI * 2;
            return v(Math.cos(ang) * 3.4, 1 + Math.sin(ang) * 1.3, Math.sin(ang) * 1.2);
        });
        pts.forEach((p, i) => {
            put(stage, sphere(stage, 0.4, c[i % 3]), p.x, p.y, p.z);
            tag(stage, labels[i], p.x, p.y - 0.75, p.z);
            stage.root.add(link(stage, p, pts[(i + 1) % n], stage.palette.muted));
            if (n > 4 && i % 2 === 0) stage.root.add(link(stage, p, pts[(i + Math.floor(n / 2)) % n], stage.palette.muted, 0.015));
        });
        const packet = put(stage, sphere(stage, 0.14, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.9 }), 0, 0);
        return (t) => {
            const hop = Math.floor(t / 0.9);
            const k = (t / 0.9) % 1;
            const a = pts[hop % n], b = pts[(hop + 1) % n];
            packet.position.lerpVectors(a, b, ease(k));
        };
    },

    tree: (stage, labels) => {
        const c = colors(stage);
        const rootPos = v(0, 2.6, 0);
        put(stage, box(stage, 1.4, 0.7, 0.7, c[0]), rootPos.x, rootPos.y);
        tag(stage, labels[0], 0, 3.3);
        const kids = labels.slice(1);
        const xs = spread(Math.max(1, kids.length), 7);
        const ends = kids.map((name, i) => {
            const p = v(xs[i], 0.4, 0);
            put(stage, box(stage, 1.1, 0.6, 0.6, c[1 + (i % 2)]), p.x, p.y);
            tag(stage, name, p.x, -0.3);
            stage.root.add(link(stage, rootPos, p, stage.palette.muted));
            return p;
        });
        const dot = put(stage, sphere(stage, 0.13, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.9 }), 0, 0);
        return (t) => {
            if (!ends.length) return;
            const i = Math.floor(t / 1.2) % ends.length;
            dot.position.lerpVectors(rootPos, ends[i], ease((t / 1.2) % 1));
        };
    },

    branches: (stage, labels) => {
        const c = colors(stage);
        put(stage, box(stage, 9, 0.06, 0.06, c[0]), 0, 0.3);
        tag(stage, labels[0], -4.9, 0.3);
        const commits = spread(7, 8).map((x, i) => put(stage, sphere(stage, 0.2, c[0]), x, 0.3, 0));
        const extra = labels.slice(1).length ? labels.slice(1) : [''];
        const branchCommits: THREE.Object3D[] = [];
        extra.forEach((name, bi) => {
            const y = 1.5 + bi * 1.1;
            const x0 = -2.6 + bi * 0.6, x1 = 2.6 - bi * 0.3;
            stage.root.add(link(stage, v(x0 - 0.8, 0.3, 0), v(x0, y, 0), c[1 + bi], 0.03));
            stage.root.add(link(stage, v(x0, y, 0), v(x1, y, 0), c[1 + bi], 0.03));
            stage.root.add(link(stage, v(x1, y, 0), v(x1 + 0.9, 0.3, 0), c[1 + bi], 0.03));
            tag(stage, name, x0 - 0.2, y + 0.55);
            spread(3, x1 - x0).forEach(dx => branchCommits.push(put(stage, sphere(stage, 0.18, c[1 + bi]), (x0 + x1) / 2 + dx, y, 0)));
        });
        const all = [...commits, ...branchCommits];
        return (t) => {
            const k = (t / 7) % 1;
            all.forEach((cm, i) => {
                const born = (cm.position.x + 4.5) / 9;
                cm.scale.setScalar(k > born ? 1 : 0.25);
            });
        };
    },

    cloud: (stage, labels) => {
        const c = colors(stage);
        const region = put(stage, box(stage, 8, 2.6, 3, c[0], { transparent: true, opacity: 0.16, depthWrite: false }), 0, 1.1);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(8, 2.6, 3)), new THREE.LineBasicMaterial({ color: c[0] }));
        region.add(edges);
        for (let i = 0; i < 5; i += 1) put(stage, sphere(stage, 0.55 + (i % 2) * 0.2, '#ffffff', { transparent: true, opacity: 0.85 }), -1.2 + i * 0.6, 3 + (i % 2) * 0.25, -0.4);
        tag(stage, labels[0], 0, 3.9);
        const res = labels.slice(1);
        const xs = spread(Math.max(1, res.length), 6);
        const items = res.map((name, i) => {
            const shape = i % 3 === 0 ? box(stage, 0.9, 0.9, 0.9, c[1]) : i % 3 === 1 ? cylinder(stage, 0.45, 0.45, 0.9, c[2]) : sphere(stage, 0.5, c[3]);
            put(stage, shape, xs[i], 0.8);
            tag(stage, name, xs[i], -0.05, 1.2);
            return shape;
        });
        return (t) => items.forEach((it, i) => { it.rotation.y = t * 0.6 + i; it.position.y = 0.8 + Math.sin(t + i) * 0.08; });
    },

    stream: (stage, labels) => {
        const c = colors(stage);
        put(stage, box(stage, 1.2, 1.2, 1.2, c[0]), -4, 0.8);
        tag(stage, labels[0], -4, -0.2);
        put(stage, box(stage, 1.2, 1.2, 1.2, c[2]), 4, 0.8);
        tag(stage, labels[2], 4, -0.2);
        const lanes = [0.25, 0.8, 1.35];
        lanes.forEach(y => put(stage, box(stage, 5.2, 0.32, 0.8, stage.palette.muted, { transparent: true, opacity: 0.55 }), 0, y));
        tag(stage, labels[1], 0, 2.1);
        const events = Array.from({ length: 9 }, (_, i) => put(stage, box(stage, 0.24, 0.24, 0.24, c[1 + (i % 2)], { emissive: c[1], emissiveIntensity: 0.25 }), 0, lanes[i % 3]));
        return (t) => events.forEach((e, i) => {
            const k = ((t / 3.2) + i / events.length) % 1;
            e.position.x = -3.3 + k * 6.6;
        });
    },

    security: (stage, labels) => {
        const p = stage.palette;
        put(stage, sphere(stage, 0.35, p.accent), -3.6, 1.6);
        put(stage, cylinder(stage, 0.35, 0.5, 1, p.accent), -3.6, 0.7);
        tag(stage, labels[0], -3.6, -0.2);
        put(stage, box(stage, 0.25, 2.2, 0.25, p.muted), -0.6, 1.1);
        put(stage, box(stage, 0.25, 2.2, 0.25, p.muted), 0.6, 1.1);
        const shield = put(stage, cylinder(stage, 0.6, 0.6, 0.12, p.accent2), 0, 2.5);
        shield.rotation.x = Math.PI / 2;
        tag(stage, labels[1], 0, 3.3);
        put(stage, box(stage, 1.4, 1.4, 1.4, p.accent3), 3.6, 0.8);
        tag(stage, labels[2], 3.6, -0.2);
        const ok = put(stage, sphere(stage, 0.17, p.good, { emissive: p.good, emissiveIntensity: 0.6 }), 0, 0);
        const no = put(stage, sphere(stage, 0.17, p.bad, { emissive: p.bad, emissiveIntensity: 0.6 }), 0, 0);
        return (t) => {
            travel(ok, v(-3, 1, 0), v(3, 1, 0), t, 2.6, 0, 0.3);
            const k = ((t / 2.6) + 0.5) % 1;
            const x = k < 0.5 ? -3 + k * 2 * 2.7 : -0.3 - (k - 0.5) * 2 * 2.7;
            no.position.set(x, 0.7, 0);
            shield.rotation.z = t;
        };
    },

    ai: (stage, labels) => {
        const c = colors(stage);
        const layers = [3, 4, 4, 2];
        const xs = spread(layers.length, 6);
        const nodes = layers.map((n, li) => spread(n, 2.6).map(y => v(xs[li], 1.3 + y, 0)));
        nodes.forEach((col, li) => col.forEach(p => put(stage, sphere(stage, 0.24, c[li === 0 ? 0 : li === layers.length - 1 ? 2 : 1]), p.x, p.y, p.z)));
        for (let li = 0; li < nodes.length - 1; li += 1) for (const a of nodes[li]) for (const b of nodes[li + 1]) stage.root.add(link(stage, a, b, stage.palette.muted, 0.012));
        tag(stage, labels[0], xs[0], -0.3);
        tag(stage, labels[1], (xs[1] + xs[2]) / 2, -0.3);
        tag(stage, labels[2], xs[3], -0.3);
        const sparks = Array.from({ length: 6 }, () => put(stage, sphere(stage, 0.09, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 1 }), 0, 0));
        return (t) => sparks.forEach((s, i) => {
            const k = ((t / 2.4) + i / sparks.length) % 1;
            const seg = Math.min(layers.length - 2, Math.floor(k * (layers.length - 1)));
            const local = k * (layers.length - 1) - seg;
            const a = nodes[seg][i % nodes[seg].length], b = nodes[seg + 1][(i + seg) % nodes[seg + 1].length];
            s.position.lerpVectors(a, b, local);
        });
    },

    vehicle: (stage, labels) => {
        const p = stage.palette;
        put(stage, box(stage, 10, 0.05, 3, '#3a3f4b'), 0, 0);
        const dashes = Array.from({ length: 8 }, (_, i) => put(stage, box(stage, 0.7, 0.02, 0.1, '#f5f5f5'), -5 + i * 1.4, 0.04, 0));
        const car = new THREE.Group();
        const body = box(stage, 2.2, 0.5, 1.1, p.accent); body.position.y = 0.45; car.add(body);
        const cabin = box(stage, 1.2, 0.45, 1, p.accent2); cabin.position.set(-0.15, 0.9, 0); car.add(cabin);
        for (const [x, z] of [[-0.7, 0.55], [0.7, 0.55], [-0.7, -0.55], [0.7, -0.55]]) {
            const w = cylinder(stage, 0.22, 0.22, 0.15, '#111111'); w.rotation.x = Math.PI / 2; w.position.set(x, 0.22, z); car.add(w);
        }
        stage.root.add(car);
        const rays = [-0.35, 0, 0.35].map(a => {
            const r = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3, 12, 1, true), new THREE.MeshBasicMaterial({ color: p.accent3, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
            r.rotation.z = -Math.PI / 2; r.rotation.y = a; r.position.set(2.6, 0.6, Math.sin(a) * 1.4);
            stage.root.add(r);
            return r;
        });
        labels.forEach((name, i) => tag(stage, name, -2 + i * 1.6, 2));
        return (t) => {
            dashes.forEach((d, i) => { d.position.x = ((-5 + i * 1.4 - t * 2.2) % 11.2 + 11.2) % 11.2 - 5.6; });
            car.position.y = Math.sin(t * 9) * 0.015;
            rays.forEach((r, i) => { (r.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.14 * (Math.sin(t * 3 + i) + 1) / 2; });
        };
    },

    cycle: (stage, labels) => {
        const c = colors(stage);
        const n = labels.length;
        const pts = labels.map((_, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return v(Math.cos(a) * 3.2, 1.2 - Math.sin(a) * 1.3, 0); });
        const nodes = pts.map((p, i) => {
            const m = put(stage, box(stage, 1.1, 0.6, 0.6, c[i % 3]), p.x, p.y, p.z);
            tag(stage, labels[i], p.x, p.y - 0.65, p.z + 0.4);
            stage.root.add(link(stage, p, pts[(i + 1) % n], stage.palette.muted));
            return m;
        });
        const token = put(stage, sphere(stage, 0.17, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.9 }), 0, 0);
        return (t) => {
            const pos = (t / 1.3) % n;
            const i = Math.floor(pos);
            token.position.lerpVectors(pts[i], pts[(i + 1) % n], ease(pos - i));
            nodes.forEach((m, j) => m.scale.setScalar(j === i ? 1.15 : 1));
        };
    },

    hub: (stage, labels) => {
        const c = colors(stage);
        const center = v(0, 1, 0);
        const hub = put(stage, sphere(stage, 0.75, c[0]), center.x, center.y);
        tag(stage, labels[0], 0, 2.1);
        const spokes = labels.slice(1);
        const n = Math.max(2, spokes.length);
        const ends = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return v(Math.cos(a) * 3.6, 1 + Math.sin(a) * 1.2, Math.sin(a) * 1.1); });
        ends.forEach((p, i) => {
            put(stage, box(stage, 0.8, 0.8, 0.8, c[1 + (i % 2)]), p.x, p.y, p.z);
            tag(stage, spokes[i] || '', p.x, p.y - 0.7, p.z);
            stage.root.add(link(stage, center, p, stage.palette.muted));
        });
        const pulses = ends.map(() => put(stage, sphere(stage, 0.1, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.9 }), 0, 0));
        return (t) => {
            hub.rotation.y = t * 0.5;
            pulses.forEach((p, i) => travel(p, center, ends[i], t, 1.6, i / pulses.length, 0));
        };
    },

    chart: (stage, labels) => {
        const c = colors(stage);
        put(stage, box(stage, 8, 0.05, 2, stage.palette.muted), 0, 0);
        const groups = labels.length;
        const bars: Array<[THREE.Mesh, number]> = [];
        for (let x = 0; x < 6; x += 1) {
            for (let g = 0; g < groups; g += 1) {
                const bar = box(stage, 0.38, 1, 0.38, c[g % 3]) as THREE.Mesh;
                put(stage, bar, -3.2 + x * 1.3 + g * 0.42 - (groups - 1) * 0.21, 0.5, 0);
                bars.push([bar, x * 0.6 + g]);
            }
        }
        labels.forEach((name, g) => tag(stage, name, -3 + g * 2, 3.2));
        return (t) => bars.forEach(([bar, seed]) => {
            const h = 0.4 + 1.8 * (0.5 + 0.5 * Math.sin(t * 0.9 + seed));
            bar.scale.y = h;
            bar.position.y = h / 2;
        });
    },
};

/** Build one concept scene on a stage. Unknown kinds draw nothing rather than throw. */
export function buildConceptScene(stage: Stage, kind: SceneKind, labels: string[]): void {
    const builder = SCENES[kind];
    if (!builder) return;
    const update = builder(stage, (labels || []).slice(0, 6));
    const sway = stage.reduced ? 0 : 0.22;
    stage.root.rotation.y = -0.12;
    stage.setUpdate((t, dt) => {
        update(t, dt);
        stage.root.rotation.y = -0.12 + Math.sin(t * 0.25) * sway;
    });
}

export const SCENE_BUILDERS = Object.keys(SCENES);
