/**
 * The animated GUI walkthrough: a monitor showing a schematic of the product's
 * window, and a 3D mouse pointer that travels to each control, clicks it, and
 * types the value - one recipe step at a time.
 *
 * The screen is a CanvasTexture painted from the step (`paintScreen`), not a
 * screenshot: a screenshot of a console is the wrong picture the day the skin
 * changes, while a schematic built from the recipe's own labels - the nav item,
 * the button, the field - says exactly what the text beside it says. The
 * product's brand colour, its top bar and its left navigation come from the
 * recipe map, so "Fabric" looks like Fabric and "AWS" like AWS at a glance.
 *
 * The screen texture is repainted only when what it shows changes (a new step,
 * one more typed character, the click highlight), never per frame.
 */
import * as THREE from 'three';
import type { GuiSection, GuiStep } from '@/utils/labDocs';
import { createStage, ease, type Palette, type Stage } from './sceneKit';

const CW = 1280;
const CH = 800;
const SW = 8;          // screen plane width in world units
const SH = SW * CH / CW;

export interface Rect { x: number; y: number; w: number; h: number }

interface Paint {
    step: GuiStep;
    typed: number;        // characters of the value shown
    pressed: boolean;     // target drawn in its active state
    section: GuiSection;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, weight = 400, max = 0) {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    let out = value;
    if (max) while (out.length > 1 && ctx.measureText(out).width > max) out = out.slice(0, -2) + '…';
    ctx.fillText(out, x, y);
    return ctx.measureText(out).width;
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color = '#e5e7eb') {
    ctx.fillStyle = color;
    rr(ctx, x, y - 6, w, 12, 6);
    ctx.fill();
}

/**
 * Paint one moment of one step and return where its TARGET is, in canvas
 * pixels. Pure 2D, no three.js - so it is also what a check could drive.
 */
export function paintScreen(ctx: CanvasRenderingContext2D, paint: Paint): Rect {
    const { step, section } = paint;
    const brand = section.brand || '#4f46e5';
    const value = step.value || '';
    const shown = value.slice(0, paint.typed);
    ctx.fillStyle = '#f5f6f8';
    ctx.fillRect(0, 0, CW, CH);
    // Top bar.
    ctx.fillStyle = brand;
    ctx.fillRect(0, 0, CW, 64);
    text(ctx, section.top || section.product, 28, 32, 26, '#ffffff', 700, 420);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    rr(ctx, 520, 16, 380, 32, 16); ctx.fill();
    text(ctx, 'Search', 540, 32, 18, 'rgba(255,255,255,0.8)');
    let target: Rect = { x: CW - 200, y: 14, w: 170, h: 36 };
    if (step.zone === 'top') {
        ctx.fillStyle = paint.pressed ? '#ffffff' : 'rgba(255,255,255,0.22)';
        rr(ctx, target.x, target.y, target.w, target.h, 8); ctx.fill();
        text(ctx, step.target, target.x + 14, 32, 18, paint.pressed ? brand : '#ffffff', 600, target.w - 24);
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(CW - 40, 32, 16, 0, Math.PI * 2); ctx.fill();
    }
    // Left navigation.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 64, 250, CH - 64);
    ctx.fillStyle = '#e3e5ea';
    ctx.fillRect(250, 64, 2, CH - 64);
    const nav = [...section.nav];
    if (step.zone === 'nav' && !nav.includes(step.target)) nav.push(step.target);
    const active = step.zone === 'nav' ? step.target : (step.nav || '');
    nav.slice(0, 11).forEach((item, i) => {
        const y = 108 + i * 54;
        const isTarget = step.zone === 'nav' && item === step.target;
        const on = item === active;
        if (on || (isTarget && paint.pressed)) {
            ctx.fillStyle = hexA(brand, 0.14);
            rr(ctx, 12, y - 22, 226, 44, 8); ctx.fill();
            ctx.fillStyle = brand;
            ctx.fillRect(12, y - 14, 4, 28);
        }
        ctx.fillStyle = on ? brand : '#9aa1ad';
        rr(ctx, 30, y - 9, 18, 18, 4); ctx.fill();
        text(ctx, item, 60, y, 19, on ? '#111827' : '#374151', on ? 600 : 400, 170);
        if (isTarget) target = { x: 12, y: y - 22, w: 226, h: 44 };
    });
    // Page header.
    const left = 290;
    text(ctx, step.screen || section.title, left, 112, 32, '#111827', 700, CW - left - 60);
    // Tabs.
    const tabs = step.zone === 'tab' ? ['Overview', step.target, 'Settings'].filter((t, i, a) => a.indexOf(t) === i) : ['Overview', 'Details', 'Settings'];
    let tx = left;
    tabs.forEach((tab, i) => {
        const isTarget = step.zone === 'tab' && tab === step.target;
        const w = text(ctx, tab, tx, 164, 19, isTarget ? brand : '#4b5563', isTarget ? 600 : 400) + 8;
        if ((isTarget && paint.pressed) || (!isTarget && i === 0 && step.zone !== 'tab')) {
            ctx.fillStyle = isTarget ? brand : '#9ca3af';
            ctx.fillRect(tx, 182, w - 8, 3);
        }
        if (isTarget) target = { x: tx - 10, y: 146, w: w + 12, h: 38 };
        tx += w + 28;
    });
    ctx.fillStyle = '#e3e5ea';
    ctx.fillRect(left, 186, CW - left - 40, 2);
    // Toolbar.
    const toolbar = step.zone === 'toolbar' ? [step.target, 'Refresh', 'Filter'] : ['+ Create', 'Refresh', 'Filter'];
    let bx = left;
    toolbar.forEach((btn, i) => {
        ctx.font = '600 18px system-ui, sans-serif';
        const w = Math.min(320, ctx.measureText(btn).width + 36);
        const primary = i === 0;
        const isTarget = step.zone === 'toolbar' && i === 0;
        ctx.fillStyle = primary ? (isTarget && paint.pressed ? shade(brand, -0.2) : brand) : '#ffffff';
        rr(ctx, bx, 206, w, 42, 8); ctx.fill();
        if (!primary) { ctx.strokeStyle = '#cfd4dc'; ctx.lineWidth = 2; ctx.stroke(); }
        text(ctx, btn, bx + 18, 227, 18, primary ? '#ffffff' : '#374151', 600, w - 30);
        if (isTarget) target = { x: bx, y: 206, w, h: 42 };
        bx += w + 14;
    });
    // Main content: a list with the target as one row when the step points there.
    const rows = 6;
    for (let r = 0; r < rows; r += 1) {
        const y = 290 + r * 66;
        const isTarget = step.zone === 'main' && r === 1;
        ctx.fillStyle = isTarget && paint.pressed ? hexA(brand, 0.12) : '#ffffff';
        rr(ctx, left, y - 26, CW - left - 40, 52, 8); ctx.fill();
        ctx.strokeStyle = isTarget ? hexA(brand, 0.5) : '#eceef2';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (isTarget) {
            text(ctx, step.target, left + 22, y, 20, brand, 600, 520);
            bar(ctx, left + 600, y, 120);
            target = { x: left, y: y - 26, w: Math.min(560, CW - left - 40), h: 52 };
        } else {
            bar(ctx, left + 22, y, 180 + ((r * 53) % 90), '#d9dde4');
            bar(ctx, left + 600, y, 90 + ((r * 37) % 60));
        }
    }
    // Editor zone: a code surface in the content area.
    if (step.zone === 'editor') {
        ctx.fillStyle = '#1e1e2e';
        rr(ctx, left, 270, CW - left - 40, 380, 10); ctx.fill();
        const lines = ['', '', ''];
        lines.forEach((_, i) => bar(ctx, left + 30, 310 + i * 36, 160 + i * 70, '#3b3f54'));
        text(ctx, (step.action === 'see' ? step.target : shown) + (paint.typed < value.length ? '▌' : ''), left + 30, 310 + 3 * 36, 20, '#a6e3a1', 500, CW - left - 120);
        target = { x: left + 10, y: 280, w: CW - left - 60, h: 360 };
    }
    // Side panel / dialog: a form containing the target.
    if (step.zone === 'panel' || step.zone === 'dialog') {
        ctx.fillStyle = 'rgba(17, 24, 39, 0.32)';
        ctx.fillRect(0, 64, CW, CH - 64);
        const box: Rect = step.zone === 'panel'
            ? { x: CW - 520, y: 64, w: 520, h: CH - 64 }
            : { x: CW / 2 - 330, y: 170, w: 660, h: 470 };
        ctx.fillStyle = '#ffffff';
        rr(ctx, box.x, box.y, box.w, box.h, step.zone === 'dialog' ? 14 : 0); ctx.fill();
        text(ctx, step.screen || section.title, box.x + 32, box.y + 50, 26, '#111827', 700, box.w - 64);
        const fieldY = box.y + 130;
        const isInput = step.action === 'type' || step.action === 'select';
        if (isInput || step.action === 'check') {
            text(ctx, step.target, box.x + 32, fieldY, 18, '#374151', 600, box.w - 64);
            const f: Rect = { x: box.x + 32, y: fieldY + 18, w: box.w - 64, h: 48 };
            if (step.action === 'check') {
                ctx.strokeStyle = brand; ctx.lineWidth = 3;
                rr(ctx, f.x, f.y + 6, 32, 32, 6); ctx.stroke();
                if (paint.pressed) { ctx.fillStyle = brand; rr(ctx, f.x + 6, f.y + 12, 20, 20, 4); ctx.fill(); }
                target = { x: f.x, y: f.y + 6, w: 32, h: 32 };
            } else {
                ctx.fillStyle = '#ffffff';
                rr(ctx, f.x, f.y, f.w, f.h, 8); ctx.fill();
                ctx.strokeStyle = paint.typed > 0 || paint.pressed ? brand : '#c4c9d2'; ctx.lineWidth = 2; ctx.stroke();
                text(ctx, shown + (paint.pressed && paint.typed < value.length ? '|' : ''), f.x + 16, f.y + f.h / 2, 19, '#111827', 400, f.w - 60);
                if (step.action === 'select') {
                    ctx.fillStyle = '#6b7280';
                    ctx.beginPath(); ctx.moveTo(f.x + f.w - 30, f.y + 20); ctx.lineTo(f.x + f.w - 18, f.y + 20); ctx.lineTo(f.x + f.w - 24, f.y + 28); ctx.fill();
                }
                target = f;
            }
            [0, 1].forEach(i => { bar(ctx, box.x + 32, fieldY + 120 + i * 70, 140); bar(ctx, box.x + 32, fieldY + 150 + i * 70, box.w - 64, '#eef0f3'); });
        } else {
            [0, 1, 2].forEach(i => { bar(ctx, box.x + 32, fieldY + i * 66, 140); bar(ctx, box.x + 32, fieldY + 28 + i * 66, box.w - 64, '#eef0f3'); });
            ctx.font = '600 19px system-ui, sans-serif';
            const w = Math.min(box.w - 64, ctx.measureText(step.target).width + 44);
            const b: Rect = { x: box.x + box.w - 32 - w, y: box.y + box.h - 76, w, h: 46 };
            ctx.fillStyle = paint.pressed ? shade(brand, -0.2) : brand;
            rr(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
            text(ctx, step.target, b.x + 22, b.y + 23, 19, '#ffffff', 600, b.w - 30);
            target = step.action === 'see' ? { x: box.x + 24, y: fieldY - 30, w: box.w - 48, h: 220 } : b;
        }
    }
    // The halo round the target: what the eye should land on.
    if (paint.pressed || step.action === 'see') {
        ctx.strokeStyle = hexA('#f59e0b', 0.95);
        ctx.lineWidth = 4;
        rr(ctx, target.x - 6, target.y - 6, target.w + 12, target.h + 12, 12);
        ctx.stroke();
    }
    return target;
}

function hexA(hex: string, alpha: number) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function shade(hex: string, k: number) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (k < 0 ? c * k : (255 - c) * k))));
    return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function arrowMesh(color: string) {
    const s = new THREE.Shape();
    // A classic pointer, tip at the origin, pointing up-left.
    const pts: Array<[number, number]> = [[0, 0], [0, -0.62], [0.15, -0.48], [0.27, -0.74], [0.37, -0.69], [0.25, -0.44], [0.45, -0.44]];
    s.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    const group = new THREE.Group();
    const fill = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    const edge = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#111111', side: THREE.BackSide }));
    edge.scale.setScalar(1.08);
    edge.position.set(-0.015, 0.02, -0.01);
    group.add(edge, fill);
    return group;
}

export interface Walkthrough {
    play(): void;
    pause(): void;
    goTo(index: number): void;
    setSpeed(speed: number): void;
    dispose(): void;
}

export function createWalkthrough(canvas: HTMLCanvasElement, section: GuiSection, palette: Palette,
                                  opts: { reduced: boolean; onStep: (index: number) => void; onEnd?: () => void }): Walkthrough {
    const stage: Stage = createStage(canvas, palette, { reduced: opts.reduced, camera: [1.1, 0.5, 8.2], target: [0, 0.35, 0], fov: 34 });
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = CW;
    screenCanvas.height = CH;
    const ctx = screenCanvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(screenCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const monitor = new THREE.Group();
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.4, SH + 0.4, 0.3), new THREE.MeshStandardMaterial({ color: '#1f2430', roughness: 0.5 }));
    bezel.position.z = -0.17;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.25), new THREE.MeshStandardMaterial({ color: '#2b3140' }));
    neck.position.set(0, -SH / 2 - 0.55, -0.3);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.2), new THREE.MeshStandardMaterial({ color: '#2b3140' }));
    foot.position.set(0, -SH / 2 - 1.1, -0.2);
    monitor.add(bezel, screen, neck, foot);
    monitor.rotation.y = -0.16;
    monitor.position.y = 0.45;
    stage.root.add(monitor);
    const cursor = arrowMesh('#ffffff');
    cursor.scale.setScalar(0.62);
    monitor.add(cursor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 32), new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0, depthWrite: false }));
    monitor.add(ring);

    const steps = section.steps;
    let index = 0;
    let stepTime = 0;
    let playing = !opts.reduced;
    let speed = 1;
    let from = new THREE.Vector2(SW * 0.3, -SH * 0.25);
    let to = new THREE.Vector2(0, 0);
    let lastKey = '';
    let targetRect: Rect = { x: 0, y: 0, w: 1, h: 1 };

    const toLocal = (r: Rect) => new THREE.Vector2(((r.x + r.w / 2) / CW - 0.5) * SW, (0.5 - (r.y + r.h / 2) / CH) * SH);
    const valueLen = (s: GuiStep) => (s.action === 'type' || s.action === 'select' || (s.zone === 'editor' && s.action !== 'see')) ? (s.value || '').length : 0;
    const MOVE = 1.0, PRESS = 0.3, HOLD = 1.0;
    const typeTime = (s: GuiStep) => Math.min(1.4, valueLen(s) * 0.05);
    const duration = (s: GuiStep) => MOVE + PRESS + typeTime(s) + HOLD;

    const repaint = (typed: number, pressed: boolean) => {
        const key = `${index}|${typed}|${pressed}`;
        if (key === lastKey) return;
        lastKey = key;
        targetRect = paintScreen(ctx, { step: steps[index], typed, pressed, section });
        texture.needsUpdate = true;
    };

    const enterStep = (i: number) => {
        index = Math.max(0, Math.min(steps.length - 1, i));
        stepTime = 0;
        lastKey = '';
        from = new THREE.Vector2(cursor.position.x, cursor.position.y);
        repaint(0, false);
        to = toLocal(targetRect);
        opts.onStep(index);
    };

    const pose = (t: number) => {
        const s = steps[index];
        const move = Math.min(1, t / MOVE);
        const k = ease(move);
        const x = from.x + (to.x - from.x) * k;
        const y = from.y + (to.y - from.y) * k;
        const pressing = t >= MOVE && t < MOVE + PRESS;
        const pressed = t >= MOVE;
        const typed = pressed ? Math.floor(valueLen(s) * Math.min(1, (t - MOVE - PRESS) / Math.max(0.001, typeTime(s)))) : 0;
        repaint(t >= MOVE + PRESS ? typed : 0, pressed && s.action !== 'see');
        cursor.position.set(x, y, 0.12 + Math.sin(move * Math.PI) * 0.5);
        cursor.scale.setScalar(pressing ? 0.54 : 0.62);
        ring.position.set(to.x, to.y, 0.03);
        const rk = t >= MOVE ? Math.min(1, (t - MOVE) / 0.5) : 0;
        ring.scale.setScalar(1 + rk * 2.5);
        (ring.material as THREE.MeshBasicMaterial).opacity = s.action === 'see' ? 0 : (t >= MOVE ? (1 - rk) * 0.9 : 0);
    };

    const show = (i: number, end: boolean) => {
        enterStep(i);
        if (end) {
            cursor.position.set(to.x, to.y, 0.12);
            stepTime = duration(steps[index]) - 0.01;
        }
        pose(stepTime);
        stage.renderOnce();
    };

    enterStep(0);
    stage.pose = 0;
    stage.setUpdate((_, dt) => {
        if (opts.reduced) { pose(duration(steps[index])); return; }
        if (playing) {
            stepTime += dt * speed;
            if (stepTime >= duration(steps[index])) {
                if (index < steps.length - 1) enterStep(index + 1);
                else { playing = false; opts.onEnd?.(); }
            }
        }
        pose(stepTime);
        monitor.rotation.y = -0.16 + Math.sin(stepTime * 0.4 + index) * 0.02;
    });
    if (opts.reduced) show(0, true);

    return {
        play() {
            if (opts.reduced) return;
            if (!playing && index === steps.length - 1 && stepTime >= duration(steps[index]) - 0.02) enterStep(0);
            playing = true;
        },
        pause() { playing = false; },
        goTo(i) { show(i, opts.reduced || !playing); },
        setSpeed(s) { speed = Math.max(0.25, Math.min(3, s)); },
        dispose() { texture.dispose(); stage.dispose(); },
    };
}
