// Self-Study Football - the 3D renderer (WebGL, three.js).
//
// A real stadium: a textured pitch with mowing stripes and crisp lines, goals with
// nets, tiered stands filled with a crowd of thousands that bounces with the game
// (animated on the GPU, one draw call per stand), LED boards that scroll, floodlight
// towers, a roof, day / dusk / night skies, rain, and 22 jointed 3D players that run,
// kick, slide, dive and celebrate, with real-time shadows.
//
// It draws the same `view` object the engine (or a network snapshot) gives, so the
// game logic never knows which renderer is on screen. Quality presets decide the
// resolution, shadows, antialiasing and crowd density, so a school laptop and a
// gaming PC both get a smooth frame.
import * as THREE from '../vendor/three.module.min.js';
import { PITCHES } from './data.mjs';

export function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
export const CAMERAS3D = [
  { id: 'broadcast', name: 'Broadcast' }, { id: 'tele', name: 'Tele broadcast' }, { id: 'wide', name: 'Wide' },
  { id: 'pro', name: 'Behind the player' }, { id: 'top', name: 'Tactical 2D' },
];
const GK_KITS = [{ primary: '#facc15', secondary: '#111827', shorts: '#111827' }, { primary: '#22c55e', secondary: '#0f172a', shorts: '#0f172a' }];
export const QUALITY = {
  low: { ratio: 0.75, shadows: 0, aa: false, crowd: 1.3, label: 'Fast (older computers)' },
  medium: { ratio: 1, shadows: 1024, aa: false, crowd: 0.9, label: 'Balanced' },
  high: { ratio: 1.5, shadows: 2048, aa: true, crowd: 0.7, label: 'High' },
  ultra: { ratio: 2, shadows: 4096, aa: true, crowd: 0.6, label: 'Ultra (4K)' },
};

export class Renderer3D {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.q = QUALITY[opts.quality] || QUALITY.medium;
    this.cam = opts.camera || 'broadcast';
    this.time = opts.time || 'day';
    this.weather = opts.weather || 'clear';
    this.stadium = opts.stadium || {};
    this.menu = !!opts.menu;
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: this.q.aa, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * this.q.ratio / Math.max(1, (window.devicePixelRatio || 1) > 1 ? 1 : 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = this.time === 'night' ? 1.15 : 1.0;
    r.shadowMap.enabled = this.q.shadows > 0;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 900);
    this.clock = 0; this.size = 0; this.models = []; this.excite = 0.2;
    this.camPos = new THREE.Vector3(0, 30, 60); this.camLook = new THREE.Vector3();
    this.resize();
  }
  resize() {
    const w = Math.max(320, this.c.clientWidth), h = Math.max(200, this.c.clientHeight);
    if (w !== this.w || h !== this.h) {
      this.w = w; this.h = h;
      this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * this.q.ratio);
      this.r.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
  }
  dispose() {
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { if (x.map) x.map.dispose(); x.dispose(); }); });
    this.r.dispose();
  }

  // ------------------------------------------------------------------ world
  build(v) {
    const s = this.scene;
    while (s.children.length) s.remove(s.children[0]);
    this.size = v.size; this.L = v.L; this.W = v.W; this.pitch = v.pitch;
    const night = this.time === 'night', dusk = this.time === 'dusk';
    s.background = skyTexture(this.time);
    s.fog = new THREE.Fog(night ? 0x060a18 : dusk ? 0x6b3a2a : 0xb8d8f0, 160, 520);
    s.add(new THREE.HemisphereLight(night ? 0x8fa8ff : 0xdbeaff, night ? 0x10220f : 0x2f5d22, night ? 0.75 : 0.85));
    const sun = this.sun = new THREE.DirectionalLight(night ? 0xf2f6ff : dusk ? 0xffc89a : 0xfff4e0, night ? 2.1 : dusk ? 1.7 : 2.4);
    sun.position.set(night ? 0 : -40, 90, night ? 10 : 45);
    if (this.q.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(this.q.shadows, this.q.shadows);
      const e = Math.max(this.L, this.W) / 2 + 6;
      Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 10, far: 220 });
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    }
    s.add(sun); s.add(sun.target);
    // A soft key light from the broadcast side, so faces and kits read toward the camera.
    const fill = new THREE.DirectionalLight(0xffffff, night ? 1.1 : 0.8); fill.position.set(0, 35, 120); s.add(fill);
    this.buildPitch(v);
    this.buildGoals(v);
    if (this.pitch.walls) this.buildCage(v); else this.buildStadium(v);
    this.buildBall();
    this.models = [];
    if (!this.menu) v.players.forEach((p) => { const m = this.buildPlayer(v, p); this.models.push(m); s.add(m.root); });
    this.markers = new Map();
    if (this.weather === 'rain') this.buildRain();
  }
  X(x) { return x - this.L / 2; }
  Z(y) { return this.W / 2 - y; }

  buildPitch(v) {
    const { L, W } = this, walls = this.pitch.walls, m = walls ? 1.2 : 5;
    const tw = 2048, th = Math.round((tw * (W + 2 * m)) / (L + 2 * m));
    const c = document.createElement('canvas'); c.width = tw; c.height = th;
    const g = c.getContext('2d'), k = tw / (L + 2 * m), P = (x, y) => [(x + m) * k, (y + m) * k];
    g.fillStyle = walls ? '#2f7d3a' : '#2e8b3e'; g.fillRect(0, 0, tw, th);
    const n = walls ? 8 : 18;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; g.fillRect(P((L / n) * i, 0)[0], 0, (L / n) * k, th); }
    // A little grain so the grass is not a flat colour up close.
    const img = g.getImageData(0, 0, tw, th), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const r = (Math.random() - 0.5) * 14; d[i] += r * 0.4; d[i + 1] += r; d[i + 2] += r * 0.3; }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = Math.max(3, 0.12 * k); g.lineCap = 'round';
    const rect = (x0, y0, x1, y1) => { const [a, b] = P(x0, y0), [c2, d2] = P(x1, y1); g.strokeRect(a, b, c2 - a, d2 - b); };
    const arc = (x, y, r, a0, a1) => { const [a, b] = P(x, y); g.beginPath(); g.arc(a, b, r * k, a0, a1); g.stroke(); };
    const p = this.pitch;
    rect(0, 0, L, W);
    g.beginPath(); g.moveTo(...P(L / 2, 0)); g.lineTo(...P(L / 2, W)); g.stroke();
    const cr = walls ? 3 : v.size === 11 ? 9.15 : 6;
    arc(L / 2, W / 2, cr, 0, Math.PI * 2);
    g.fillStyle = 'white'; g.beginPath(); g.arc(...P(L / 2, W / 2), 0.25 * k, 0, 7); g.fill();
    for (const [gx, sgn] of [[0, 1], [L, -1]]) {
      const bw = p.boxW / 2, sb = p.box * 0.33, sw = p.goal / 2 + p.box * 0.33;
      rect(Math.min(gx, gx + sgn * p.box), W / 2 - bw, Math.max(gx, gx + sgn * p.box), W / 2 + bw);
      rect(Math.min(gx, gx + sgn * sb), W / 2 - sw, Math.max(gx, gx + sgn * sb), W / 2 + sw);
      if (!walls) {
        const spot = gx + sgn * p.box * 0.67;
        g.beginPath(); g.arc(...P(spot, W / 2), 0.22 * k, 0, 7); g.fill();
        const a = Math.acos(Math.min(1, (p.box * 0.33) / cr));
        arc(spot, W / 2, cr, sgn > 0 ? -a : Math.PI - a, sgn > 0 ? a : Math.PI + a);
        for (const cy of [0, W]) arc(gx, cy, 1, 0, Math.PI * 2);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = this.r.capabilities.getMaxAnisotropy();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(L + 2 * m, W + 2 * m), new THREE.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.scene.add(ground);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(L + 120, W + 120), new THREE.MeshLambertMaterial({ color: walls ? 0x1e293b : 0x24692f }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; apron.receiveShadow = true;
    this.scene.add(apron);
  }

  buildGoals(v) {
    const p = this.pitch, half = p.goal / 2, h = p.goalH, depth = p.walls ? 1 : 2;
    const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const net = new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85 });
    for (const [gx, s] of [[0, -1], [this.L, 1]]) {
      const grp = new THREE.Group(); grp.position.set(this.X(gx), 0, 0);
      const post = new THREE.CylinderGeometry(0.06, 0.06, h, 10);
      for (const z of [-half, half]) { const m = new THREE.Mesh(post, white); m.position.set(0, h / 2, z); m.castShadow = true; grp.add(m); }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, p.goal + 0.12, 10), white); bar.rotation.x = Math.PI / 2; bar.position.set(0, h, 0); bar.castShadow = true; grp.add(bar);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(p.goal, h * 0.85), net); back.position.set(s * depth, h * 0.42, 0); back.rotation.y = Math.PI / 2; grp.add(back);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(depth, p.goal), net); top.rotation.x = -Math.PI / 2; top.rotation.z = 0.08 * s; top.position.set((s * depth) / 2, h * 0.93, 0); grp.add(top);
      for (const z of [-half, half]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(depth, h), net); side.position.set((s * depth) / 2, h / 2, z); grp.add(side); }
      this.scene.add(grp);
    }
  }

  buildStadium(v) {
    const { L, W } = this, st = this.stadium, big = v.size === 11;
    const gap = big ? 7 : 5, depth = big ? 30 : 16, rise = big ? 18 : 9;
    const concrete = new THREE.MeshLambertMaterial({ color: new THREE.Color(st.stand || '#3b4252'), side: THREE.DoubleSide });
    const sides = [
      { len: L + 2 * gap + 20, cx: 0, cz: W / 2 + gap, dir: 1, rot: 0 },
      { len: L + 2 * gap + 20, cx: 0, cz: -(W / 2 + gap), dir: -1, rot: Math.PI },
      { len: W + 2 * gap, cx: L / 2 + gap, cz: 0, dir: 1, rot: Math.PI / 2 },
      { len: W + 2 * gap, cx: -(L / 2 + gap), cz: 0, dir: -1, rot: -Math.PI / 2 },
    ];
    const fans = [];
    for (const sd of sides) {
      const g = new THREE.Group(); g.position.set(sd.cx, 0, sd.cz); g.rotation.y = sd.rot;
      // The tiered bowl: a sloped slab, a front wall and a back wall.
      const slope = Math.hypot(depth, rise);
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(sd.len, slope), concrete);
      // A vertical plane tilted back by (90deg - slope angle) about X: its top edge goes
      // away from the pitch and up, from (y 1.2, z 0) to (y rise + 1.2, z depth).
      slab.rotation.x = Math.PI / 2 - Math.atan2(rise, depth);
      slab.position.set(0, rise / 2 + 1.2, depth / 2);
      g.add(slab);
      const front = new THREE.Mesh(new THREE.BoxGeometry(sd.len, 1.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x1f2937 })); front.position.set(0, 0.6, 0); g.add(front);
      const back = new THREE.Mesh(new THREE.BoxGeometry(sd.len, rise + 8, 1), concrete); back.position.set(0, (rise + 8) / 2, depth + 0.5); g.add(back);
      if (st.roof !== false && big) {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(sd.len, 0.6, depth * 0.75), new THREE.MeshLambertMaterial({ color: 0x111827 }));
        roof.position.set(0, rise + 9, depth * 0.62); g.add(roof);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(sd.len * 0.96, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: this.time === 'night' ? 0xffffff : 0xdbeafe }));
        strip.position.set(0, rise + 8.6, depth * 0.26); g.add(strip);
      }
      // Seat positions for the crowd, in this group's frame.
      const spacing = this.q.crowd;
      for (let z = 1.4; z < depth - 0.6; z += spacing * 1.25) {
        const y = 1.2 + (z / depth) * rise;
        for (let x = -sd.len / 2 + 1; x < sd.len / 2 - 1; x += spacing) {
          if (Math.random() < 0.08) continue;
          fans.push({ g, x: x + (Math.random() - 0.5) * 0.15, y, z });
        }
      }
      this.scene.add(g);
    }
    this.buildCrowd(fans);
    this.buildBoards(L + 6, W + 4, 1.0);
    if (big) this.buildFloodlights();
  }
  buildCage(v) {
    const { L, W } = this;
    const board = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const fence = new THREE.MeshBasicMaterial({ map: netTexture(true), transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const half = this.pitch.goal / 2;
    const wall = (len, x, z, ry, gapHalf) => {
      const parts = gapHalf ? [[-len / 2, -gapHalf], [gapHalf, len / 2]] : [[-len / 2, len / 2]];
      for (const [a, b] of parts) {
        const w = b - a, m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, 0.15), board);
        m.position.set(x, 0.55, z); m.rotation.y = ry;
        const off = (a + b) / 2; m.position.x += Math.cos(ry) * off; m.position.z -= Math.sin(ry) * off;
        this.scene.add(m);
      }
      const f = new THREE.Mesh(new THREE.PlaneGeometry(len, 4), fence); f.position.set(x, 3.1, z); f.rotation.y = ry; this.scene.add(f);
    };
    wall(L, 0, W / 2 + 0.08, 0); wall(L, 0, -W / 2 - 0.08, 0);
    wall(W, L / 2 + 0.08, 0, Math.PI / 2, half + 0.1); wall(W, -L / 2 - 0.08, 0, Math.PI / 2, half + 0.1);
    this.buildBoards(L + 0.4, W + 0.4, 1.12, true);
    // A street crowd on low bleachers on the two long sides.
    const fans = [];
    for (const sz of [1, -1]) {
      const g = new THREE.Group(); g.position.set(0, 0, sz * (W / 2 + 2.5)); g.rotation.y = sz > 0 ? 0 : Math.PI; this.scene.add(g);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(L, 1.5, 5), new THREE.MeshLambertMaterial({ color: 0x334155 })); bench.position.set(0, 0.4, 2.5); g.add(bench);
      for (let z = 0.6; z < 5; z += 1) for (let x = -L / 2 + 1; x < L / 2 - 1; x += 0.7) if (Math.random() > 0.15) fans.push({ g, x, y: 1.2 + z * 0.35, z });
    }
    this.buildCrowd(fans);
    for (const [x, z] of [[-L / 2, W / 2 + 6], [L / 2, W / 2 + 6], [-L / 2, -W / 2 - 6], [L / 2, -W / 2 - 6]]) this.lightTower(x, z, 12);
  }

  // Thousands of fans in ONE instanced mesh. Each bounces in the vertex shader, so the
  // CPU does nothing per fan per frame - the excitement is a single uniform.
  buildCrowd(fans) {
    if (!fans.length) return;
    const geo = new THREE.BoxGeometry(0.42, 0.85, 0.3); geo.translate(0, 0.42, 0);
    const head = new THREE.SphereGeometry(0.13, 6, 5); head.translate(0, 0.98, 0);
    const merged = mergeGeometries([geo, head]);
    const phase = new Float32Array(fans.length);
    for (let i = 0; i < fans.length; i++) phase[i] = Math.random() * 100;
    merged.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    const mat = new THREE.MeshLambertMaterial();
    this.crowdU = { uTime: { value: 0 }, uExcite: { value: 0.2 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.crowdU);
      sh.vertexShader = 'attribute float aPhase;\nuniform float uTime;\nuniform float uExcite;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nfloat rate = 5.0 + fract(aPhase) * 4.0;\nfloat jump = max(0.0, sin(uTime * rate + aPhase));\ntransformed.y += jump * jump * (0.05 + uExcite * 0.42) * step(0.35 - uExcite * 0.4, fract(aPhase * 7.13));\ntransformed.x += sin(uTime * 1.3 + aPhase) * 0.04;');
    };
    const mesh = new THREE.InstancedMesh(merged, mat, fans.length);
    const st = this.stadium, home = new THREE.Color(st.seat || '#1d4ed8'), away = new THREE.Color(st.away || '#e11d48');
    const others = ['#f8fafc', '#1f2937', '#fde68a', '#64748b', '#a3a3a3', '#0ea5e9', '#7c2d12'].map((c) => new THREE.Color(c));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
    fans.forEach((f, i) => {
      f.g.updateMatrixWorld(true);
      pos.set(f.x, f.y, f.z).applyMatrix4(f.g.matrixWorld);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.g.rotation.y + Math.PI + (Math.random() - 0.5) * 0.4);
      const s = 0.85 + Math.random() * 0.3; sc.set(s, s, s);
      mesh.setMatrixAt(i, m4.compose(pos, q, sc));
      const r = Math.random();
      col.copy(r < 0.45 ? home : r < 0.65 ? away : others[(i * 7) % others.length]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.12);
      mesh.setColorAt(i, col);
    });
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  buildBoards(len, wid, h, cage) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 64;
    const g = c.getContext('2d');
    const ads = [['SELF-STUDY', '#16a34a'], ['LEARN · PLAY · WIN', '#1d4ed8'], ['SELFSTUDYJO.COM', '#0f172a'], ['FOOTBALL', '#be123c']];
    ads.forEach(([t, bg], i) => { g.fillStyle = bg; g.fillRect(i * 256, 0, 256, 64); g.fillStyle = '#fff'; g.font = '900 25px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, i * 256 + 128, 33); });
    const tex = this.adTex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const add = (w, x, z, ry) => {
      const t = tex.clone(); t.repeat.set(w / 24, 1); t.needsUpdate = true; this.boardTex = this.boardTex || []; this.boardTex.push(t);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), [mat, mat, mat, mat, new THREE.MeshBasicMaterial({ map: t }), mat]);
      m.position.set(x, h / 2, z); m.rotation.y = ry; this.scene.add(m);
    };
    if (cage) return add(len, 0, -wid / 2 - 0.02, 0);
    add(len, 0, -wid / 2 - 1, 0); add(wid + 2, -len / 2 - 1, 0, Math.PI / 2); add(wid + 2, len / 2 + 1, 0, -Math.PI / 2);
  }
  buildFloodlights() {
    const { L, W } = this;
    for (const [x, z] of [[-L / 2 - 14, W / 2 + 22], [L / 2 + 14, W / 2 + 22], [-L / 2 - 14, -W / 2 - 22], [L / 2 + 14, -W / 2 - 22]]) this.lightTower(x, z, 42);
  }
  lightTower(x, z, h) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, h, 8), new THREE.MeshLambertMaterial({ color: 0x64748b }));
    pole.position.set(x, h / 2, z); this.scene.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 0.6), new THREE.MeshBasicMaterial({ color: this.time === 'night' ? 0xffffff : 0xe2e8f0 }));
    panel.position.set(x, h + 1.5, z); panel.lookAt(0, 0, 0); this.scene.add(panel);
    if (this.time !== 'day') {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff7e0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(22, 22, 1); glow.position.copy(panel.position); this.scene.add(glow);
    }
  }
  buildBall() {
    const tex = ballTexture();
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 16), new THREE.MeshLambertMaterial({ map: tex }));
    this.ball.castShadow = true; this.scene.add(this.ball);
    this.ballPrev = null;
  }
  buildRain() {
    const n = 2500, pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 120, y = Math.random() * 40, z = (Math.random() - 0.5) * 90; pos.set([x, y, z, x + 0.2, y - 0.9, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc7d2fe, transparent: true, opacity: 0.35 }));
    this.scene.add(this.rain);
  }

  // ------------------------------------------------------------------ players
  buildPlayer(v, p) {
    const kit = p.gk ? GK_KITS[p.team] : v.teams[p.team].kit;
    const M = (c) => mat(c);
    const shirt = M(kit.primary), shorts = M(kit.shorts || kit.secondary), socks = M(kit.secondary === kit.primary ? '#f8fafc' : kit.secondary);
    const skin = M(p.skin || '#e0ac69'), hair = M(p.hair || '#1f1300'), boot = M('#111827');
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const add = (geo, m, parent, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
    const G = GEO();
    add(G.torso, shirt, body, 0, 1.22, 0).scale.set(1, 1, 0.62);
    add(G.hips, shorts, body, 0, 0.93, 0).scale.set(1, 1, 0.7);
    add(G.neck, skin, body, 0, 1.53, 0);
    const head = add(G.head, skin, body, 0, 1.68, 0);
    add(G.hair, hair, head, 0, 0.02, -0.005);
    const legs = [], arms = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(sx * 0.1, 0.9, 0); body.add(hip);
      add(G.thigh, shorts, hip, 0, -0.1, 0).scale.set(1.05, 0.45, 1.05);
      add(G.thighSkin, skin, hip, 0, -0.3, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.44, 0); hip.add(knee);
      add(G.shin, socks, knee, 0, -0.2, 0);
      add(G.boot, boot, knee, 0, -0.42, 0.05);
      legs.push({ hip, knee });
      const sh = new THREE.Group(); sh.position.set(sx * 0.25, 1.44, 0); body.add(sh);
      add(G.upper, shirt, sh, 0, -0.13, 0);
      const el = new THREE.Group(); el.position.set(0, -0.28, 0); sh.add(el);
      add(G.fore, p.gk ? M('#f1f5f9') : skin, el, 0, -0.13, 0);
      arms.push({ sh, el, sx });
    }
    // The shirt number, on the back.
    const nm = new THREE.Mesh(G.numberPlane, new THREE.MeshBasicMaterial({ map: numberTexture(p.number, kit), transparent: true }));
    nm.position.set(0, 1.27, -0.155); nm.rotation.y = Math.PI; body.add(nm);
    const ring = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false; root.add(ring);
    return { root, body, legs, arms, ring, px: p.x, py: p.y, speed: 0, label: null };
  }
  label(text, color) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = color; g.beginPath(); g.roundRect(14, 4, 100, 44, 12); g.fill();
    g.beginPath(); g.moveTo(52, 46); g.lineTo(64, 66); g.lineTo(76, 46); g.fill();
    g.fillStyle = '#fff'; g.font = '900 30px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 27);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.scale.set(1.1, 0.82, 1); s.renderOrder = 10;
    return s;
  }
  posePlayer(m, p, dt) {
    const x = this.X(p.x), z = this.Z(p.y);
    const dx = p.x - m.px, dy = p.y - m.py;
    m.speed += (Math.min(9, Math.hypot(dx, dy) / Math.max(dt, 1e-3)) - m.speed) * Math.min(1, dt * 8);
    m.px = p.x; m.py = p.y;
    m.root.position.set(x, 0, z);
    const target = Math.atan2(p.fx, -p.fy);
    let d = target - m.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    m.root.rotation.y += d * Math.min(1, dt * 12);
    const run = Math.min(1, m.speed / 7), ph = p.anim * 2.4;
    const swing = Math.sin(ph) * (0.15 + 0.75 * run);
    m.legs[0].hip.rotation.x = swing; m.legs[1].hip.rotation.x = -swing;
    m.legs[0].knee.rotation.x = -Math.max(0, Math.sin(ph + 1.4)) * (0.2 + 1.0 * run);
    m.legs[1].knee.rotation.x = -Math.max(0, Math.sin(ph + 1.4 + Math.PI)) * (0.2 + 1.0 * run);
    m.arms[0].sh.rotation.x = -swing * 0.8; m.arms[1].sh.rotation.x = swing * 0.8;
    for (const a of m.arms) { a.el.rotation.x = -0.3 - run * 0.6; a.sh.rotation.z = a.sx * 0.12; }
    m.body.rotation.set(run * 0.18, 0, 0); m.body.position.set(0, Math.abs(Math.sin(ph)) * 0.04 * run, 0);
    if (p.kick) { m.legs[1].hip.rotation.x = -1.25; m.legs[1].knee.rotation.x = -0.15; m.legs[0].hip.rotation.x = 0.3; m.arms[0].sh.rotation.z = -0.9; }
    if (p.action === 'slide') { m.body.rotation.x = -1.25; m.body.position.y = 0.3; m.legs[0].hip.rotation.x = -1.2; m.legs[1].hip.rotation.x = -0.9; }
    else if (p.dive) { m.body.rotation.z = -p.dive * 1.25; m.body.position.y = 0.5; for (const a of m.arms) { a.sh.rotation.x = -3; } }
    if (this.celebrate === p) { m.body.position.y += Math.abs(Math.sin(this.clock * 7)) * 0.35; for (const a of m.arms) { a.sh.rotation.x = -2.9; a.sh.rotation.z = a.sx * 0.4; } }
  }

  // ------------------------------------------------------------------ frame
  draw(v, dt) {
    this.resize();
    if (this.size !== v.size || this.models.length !== (this.menu ? 0 : v.players.length)) this.build(v);
    this.clock += dt;
    if (this.crowdU) {
      const b = v.ball, near = Math.min(Math.abs(b.x), Math.abs(v.L - b.x)) / (v.L / 2);
      const want = v.phase === 'goal' ? 1 : this.menu ? 0.35 : Math.max(0.12, (1 - near) * 0.75);
      this.excite += (want - this.excite) * Math.min(1, dt * 1.5);
      this.crowdU.uTime.value = this.clock; this.crowdU.uExcite.value = this.excite;
    }
    if (this.boardTex) for (const t of this.boardTex) t.offset.x = (this.clock * 0.04) % 1;
    if (this.rain) { this.rain.position.y = -((this.clock * 22) % 40) + 20; }
    this.celebrate = v.phase === 'goal' && v.scorer >= 0 ? v.players[v.scorer] : null;
    if (!this.menu) {
      v.players.forEach((p, i) => this.posePlayer(this.models[i], p, dt));
      const want = new Set();
      for (const h of v.humans) {
        if (h.player < 0 || !this.models[h.player]) continue;
        const m = this.models[h.player]; want.add(h.id);
        let mk = this.markers.get(h.id);
        if (!mk) { mk = { label: this.label(h.label, h.color), color: new THREE.Color(h.color) }; this.markers.set(h.id, mk); this.scene.add(mk.label); }
        mk.label.position.set(m.root.position.x, 2.45 + (h.charge > 0 ? 0.15 : 0), m.root.position.z);
        mk.label.visible = true;
        mk.label.scale.set(1.1 + h.charge * 0.6, 0.82 + h.charge * 0.45, 1);
        if (mk.on && mk.on !== m) mk.on.ring.visible = false;
        mk.on = m; m.ring.visible = true; m.ring.material.color.copy(mk.color);
        m.ring.scale.setScalar(1 + h.charge * 0.8);
      }
      for (const [id, mk] of this.markers) if (!want.has(id)) { mk.label.visible = false; if (mk.on) mk.on.ring.visible = false; }
      // The ball: position, and a roll that matches how far it travelled.
      const b = v.ball, bx = this.X(b.x), bz = this.Z(b.y);
      if (this.ballPrev) {
        const ddx = bx - this.ballPrev.x, ddz = bz - this.ballPrev.z, dist = Math.hypot(ddx, ddz);
        if (dist > 1e-4 && dist < 5) { const axis = new THREE.Vector3(ddz, 0, -ddx).normalize(); this.ball.rotateOnWorldAxis(axis, dist / 0.115); }
      }
      this.ballPrev = { x: bx, z: bz };
      this.ball.position.set(bx, Math.max(0.115, b.z + 0.115), bz);
    } else this.ball.position.set(0, 0.115, 0);
    this.moveCamera(v, dt);
    this.r.render(this.scene, this.camera);
  }
  moveCamera(v, dt) {
    const L = this.L, W = this.W, s = v.size === 11 ? 1 : v.size === 7 ? 0.72 : 0.5;
    let pos, look, fov;
    const b = v.ball, bx = this.X(b.x), bz = this.Z(b.y);
    if (this.menu) {
      const a = this.clock * 0.06;
      pos = new THREE.Vector3(Math.sin(a) * L * 0.42, 15, Math.cos(a) * W * 0.62); look = new THREE.Vector3(0, 2, 0); fov = 55;
    } else if (this.celebrate) {
      const m = this.models[v.scorer];
      const a = this.clock * 0.5;
      look = m.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      pos = look.clone().add(new THREE.Vector3(Math.sin(a) * 7, 2.5, Math.cos(a) * 7)); fov = 38;
    } else if (this.cam === 'pro') {
      const h = v.humans[0], p = h && h.player >= 0 ? v.players[h.player] : null;
      const atk = (h ? h.team : 0) === 0 ? (v.half === 1 ? 1 : -1) : (v.half === 1 ? -1 : 1);
      const fx = p ? this.X(p.x) : bx, fz = p ? this.Z(p.y) : bz;
      pos = new THREE.Vector3(fx - atk * 16 * s, 8 * s + 2, fz); look = new THREE.Vector3(fx + atk * 12 * s, 0, fz * 0.9); fov = 50;
    } else {
      const preset = { broadcast: [24, 13, 27], tele: [17, 8, 27], wide: [40, 24, 32] }[this.cam] || [24, 13, 27];
      const span = L * (v.size === 11 ? 0.32 : 0.3);
      const fx = Math.max(-span, Math.min(span, bx));
      pos = new THREE.Vector3(fx * 0.94, preset[1] * s + 3, Math.max(bz + 16 * s, W / 2 * 0.55) + preset[0] * s); look = new THREE.Vector3(fx, 0, bz * 0.8); fov = preset[2];
    }
    const k = Math.min(1, dt * (this.celebrate ? 1.5 : 3));
    this.camPos.lerp(pos, k); this.camLook.lerp(look, Math.min(1, dt * 4));
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * k; this.camera.updateProjectionMatrix(); }
  }
}

// ------------------------------------------------------------------ shared geometry / textures
let _geo = null;
function GEO() {
  if (_geo) return _geo;
  _geo = {
    torso: new THREE.CylinderGeometry(0.22, 0.17, 0.56, 12), hips: new THREE.CylinderGeometry(0.18, 0.19, 0.24, 12),
    neck: new THREE.CylinderGeometry(0.055, 0.06, 0.12, 8), head: new THREE.SphereGeometry(0.115, 16, 12),
    hair: new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    thigh: new THREE.CylinderGeometry(0.085, 0.075, 0.42, 10), thighSkin: new THREE.CylinderGeometry(0.072, 0.06, 0.28, 10),
    shin: new THREE.CylinderGeometry(0.06, 0.045, 0.42, 10), boot: new THREE.BoxGeometry(0.1, 0.07, 0.24),
    upper: new THREE.CylinderGeometry(0.058, 0.05, 0.28, 8), fore: new THREE.CylinderGeometry(0.045, 0.038, 0.28, 8),
    numberPlane: new THREE.PlaneGeometry(0.26, 0.26), ring: new THREE.RingGeometry(0.42, 0.56, 32),
  };
  return _geo;
}
const _mats = new Map();
function mat(c) { if (!_mats.has(c)) _mats.set(c, new THREE.MeshLambertMaterial({ color: new THREE.Color(c) })); return _mats.get(c); }
function mergeGeometries(list) {
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0;
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    const ix = g.index ? Array.from(g.index.array) : Array.from({ length: p.count }, (_, i) => i);
    for (const i of ix) idx.push(i + off);
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx);
  return out;
}
function skyTexture(time) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  const stops = time === 'night' ? ['#02040b', '#0b1530', '#1c2b52'] : time === 'dusk' ? ['#1e1b4b', '#9a3412', '#fdba74'] : ['#3b82c4', '#8cc4ec', '#e6f3fb'];
  gr.addColorStop(0, stops[0]); gr.addColorStop(0.6, stops[1]); gr.addColorStop(1, stops[2]);
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function netTexture(fence) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.strokeStyle = fence ? 'rgba(148,163,184,0.7)' : 'rgba(255,255,255,0.85)'; g.lineWidth = fence ? 2 : 1.5;
  for (let i = 0; i <= 64; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(fence ? i : 64 - i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, fence ? i : 64 - i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(fence ? 20 : 6, fence ? 3 : 2); return t;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,240,200,0.5)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
function ballTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#111827';
  for (let i = 0; i < 12; i++) { const x = (i % 6) * 43 + (i > 5 ? 21 : 0), y = i > 5 ? 88 : 36; g.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); } g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function numberTexture(n, kit) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.font = '900 46px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const hex = kit.primary || '#ffffff'; const [r, gg, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  g.fillStyle = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255 > 0.55 ? '#0f172a' : '#f8fafc'; g.fillText(String(n), 32, 35);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export { PITCHES };
