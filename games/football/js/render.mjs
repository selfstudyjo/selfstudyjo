// Self-Study Football - the renderer. One <canvas>, 2D context only.
//
// "3D" here is a real perspective camera (lookAt + focal length) projecting the pitch,
// the stands, the goals and every player onto the canvas, painter-sorted by depth.
// Nothing is a WebGL dependency, so it runs on a school laptop's integrated graphics
// and in any browser. The "2D" camera is an orthographic tactical view of the whole
// pitch. Both draw from the same view object the engine (or a network snapshot) gives.

const TAU = Math.PI * 2;
const GK_KITS = [{ primary: '#facc15', secondary: '#111827', shorts: '#111827', pattern: 'plain' }, { primary: '#22c55e', secondary: '#111827', shorts: '#111827', pattern: 'plain' }];

export const CAMERAS = [
  { id: 'broadcast', name: 'Broadcast' },
  { id: 'tele', name: 'Tele' },
  { id: 'wide', name: 'Wide' },
  { id: 'top', name: 'Tactical 2D' },
];

export class Renderer {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.g = canvas.getContext('2d', { alpha: false });
    this.cam = opts.camera || 'broadcast';
    this.quality = opts.quality || 1;
    this.time = opts.time || 'day';
    this.weather = opts.weather || 'clear';
    this.stadium = opts.stadium || { stand: '#334155', seat: '#64748b', roof: true, tiers: 2, name: '' };
    this.cx = 52; this.cy = 30; this.crowd = null; this.drops = [];
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.quality;
    const w = Math.max(320, Math.floor(this.c.clientWidth * dpr)), h = Math.max(200, Math.floor(this.c.clientHeight * dpr));
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
    this.w = w; this.h = h; this.ui = h / 720;
  }

  // ----------------------------------------------------------- camera
  setupCamera(v, dt) {
    const { L, W } = v;
    const b = v.ball;
    const k = Math.min(1, dt * 2.4);
    if (this.cam === 'top') { this.cx = L / 2; this.cy = W / 2; }
    else {
      const span = v.size === 11 ? 0.2 : v.size === 7 ? 0.26 : 0.4;
      this.cx += (clamp(b.x, L * span, L * (1 - span)) - this.cx) * k;
      this.cy += (W * 0.42 + (b.y - W / 2) * 0.32 - this.cy) * k;
    }
    if (this.cam === 'top') {
      const kk = Math.min(this.w / (L + 8), this.h / (W + 10));
      this.ortho = { k: kk, ox: (this.w - L * kk) / 2, oy: (this.h - W * kk) / 2 + kk * 1.5 };
      return;
    }
    this.ortho = null;
    const s = v.size === 11 ? 1 : v.size === 7 ? 0.78 : 0.62;
    const preset = { broadcast: [27, 19, 2.0], tele: [20, 12, 2.25], wide: [40, 30, 1.55] }[this.cam] || [27, 19, 2.0];
    const C = [this.cx, -preset[0] * s, preset[1] * s];
    const T = [this.cx, this.cy, 0];
    const f = norm(sub(T, C));
    const r = norm([f[1], -f[0], 0]);
    const u = cross(r, f);
    this.C = C; this.f = f; this.r = r; this.u = u;
    this.F = this.h * preset[2] * (this.w / this.h > 1.6 ? 1 : (this.w / this.h) / 1.6);
  }
  // world -> [screen x, screen y, pixels per metre, depth]
  P(x, y, z = 0) {
    if (this.ortho) { const o = this.ortho; return [o.ox + x * o.k, o.oy + (this.W - y) * o.k - z * o.k * 0.5, o.k, -y]; }
    const v = [x - this.C[0], y - this.C[1], z - this.C[2]];
    const zc = dot(v, this.f);
    if (zc < 0.5) return null;
    return [this.w / 2 + (this.F * dot(v, this.r)) / zc, this.h / 2 - (this.F * dot(v, this.u)) / zc, this.F / zc, zc];
  }
  quad(pts, fill) {
    const p = pts.map((q) => this.P(q[0], q[1], q[2] || 0));
    if (p.some((q) => !q)) return;
    const g = this.g; g.beginPath(); g.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]);
    g.closePath(); g.fillStyle = fill; g.fill();
  }
  line(pts, width, colour) {
    const g = this.g; g.beginPath(); let started = false;
    for (const q of pts) { const p = this.P(q[0], q[1], q[2] || 0); if (!p) { started = false; continue; } if (!started) { g.moveTo(p[0], p[1]); started = true; } else g.lineTo(p[0], p[1]); }
    const mid = this.P(pts[0][0], pts[0][1], 0);
    g.lineWidth = Math.max(1, width * (mid ? mid[2] : 1)); g.strokeStyle = colour; g.stroke();
  }

  // ----------------------------------------------------------- frame
  draw(v, dt, overlay = {}) {
    this.resize();
    this.W = v.W;
    this.setupCamera(v, dt);
    const g = this.g, night = this.time === 'night';
    const sky = g.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, night ? '#050816' : this.time === 'dusk' ? '#7c2d12' : '#7dd3fc');
    sky.addColorStop(1, night ? '#111827' : this.time === 'dusk' ? '#fb923c' : '#e0f2fe');
    g.fillStyle = sky; g.fillRect(0, 0, this.w, this.h);
    this.drawStands(v);
    this.drawPitch(v);
    this.drawGoal(v, 0); this.drawGoal(v, v.L);
    const items = [];
    for (let i = 0; i < v.players.length; i++) { const p = v.players[i]; const q = this.P(p.x, p.y, 0); if (q) items.push({ d: q[3], i, q }); }
    const bq = this.P(v.ball.x, v.ball.y, 0);
    for (const it of items) this.shadow(it.q, 0.42);
    if (bq) this.shadow(bq, 0.14 + v.ball.z * 0.02, 0.35);
    if (bq) items.push({ d: bq[3] - 0.01, ball: true });
    items.sort((a, b) => b.d - a.d);
    for (const it of items) it.ball ? this.drawBall(v.ball) : this.drawPlayer(v, v.players[it.i], it.q);
    if (night) { g.fillStyle = 'rgba(10,20,60,0.12)'; g.fillRect(0, 0, this.w, this.h); }
    if (this.weather === 'rain') this.rain(dt);
    this.hud(v, overlay);
  }

  drawStands(v) {
    const { L, W } = v, g = this.g, st = this.stadium;
    if (!this.crowd) this.crowd = this.crowdPattern(st);
    if (this.ortho) return;
    const walls = v.pitch.walls;
    const back = walls ? 3 : 6, depth = walls ? 6 : 26, height = walls ? 3.5 : 16;
    // The far stand, in tiers.
    const tiers = walls ? 1 : st.tiers;
    for (let t = 0; t < tiers; t++) {
      const y0 = W + back + (depth / tiers) * t, y1 = W + back + (depth / tiers) * (t + 1);
      const z0 = (height / tiers) * t, z1 = (height / tiers) * (t + 1);
      this.quad([[-18, y0, z0 + 0.6], [L + 18, y0, z0 + 0.6], [L + 18, y1, z1], [-18, y1, z1]], this.crowd);
      this.quad([[-18, y0, z0], [L + 18, y0, z0], [L + 18, y0, z0 + 0.6], [-18, y0, z0 + 0.6]], st.stand);
    }
    if (st.roof && !walls) this.quad([[-18, W + back + depth - 4, height + 2], [L + 18, W + back + depth - 4, height + 2], [L + 18, W + back + depth + 2, height + 6], [-18, W + back + depth + 2, height + 6]], 'rgba(15,23,42,0.85)');
    // End stands behind each goal.
    for (const [x0, x1] of [[-back, -back - depth * 0.8], [L + back, L + back + depth * 0.8]]) {
      this.quad([[x0, -12, 0], [x0, W + back, 0], [x1, W + back, height * 0.8], [x1, -12, height * 0.8]], this.crowd);
    }
    // Advertising boards (or the cage boards).
    const bh = walls ? 1.1 : 0.9, by = W + (walls ? 0.05 : 2);
    const seg = walls ? 4 : 10;
    for (let x = -4, i = 0; x < L + 4; x += seg, i++) {
      this.quad([[x, by, 0], [x + seg, by, 0], [x + seg, by, bh], [x, by, bh]], i % 2 ? '#0f172a' : '#1d4ed8');
      const mid = this.P(x + seg / 2, by, bh * 0.45);
      if (mid && mid[2] > 6) { g.fillStyle = '#f8fafc'; g.font = `700 ${Math.round(mid[2] * 0.55)}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillText(i % 3 === 0 ? 'SELF-STUDY' : i % 3 === 1 ? 'LEARN • PLAY' : 'SELFSTUDYJO', mid[0], mid[1]); }
    }
    if (walls) for (const x of [-0.05, L + 0.05]) this.quad([[x, 0, 0], [x, W, 0], [x, W, 1.1], [x, 0, 1.1]], '#1e293b');
  }
  crowdPattern(st) {
    const c = document.createElement('canvas'); c.width = 96; c.height = 48;
    const g = c.getContext('2d');
    g.fillStyle = st.stand; g.fillRect(0, 0, 96, 48);
    const cols = [st.seat, '#f8fafc', '#e2e8f0', '#fca5a5', '#fde68a', '#93c5fd', '#1f2937', st.seat];
    for (let y = 2; y < 48; y += 5) for (let x = (y % 10) ? 1 : 3; x < 96; x += 4) {
      g.fillStyle = cols[(x * 7 + y * 13) % cols.length]; g.fillRect(x, y, 2.4, 3);
    }
    return this.g.createPattern(c, 'repeat');
  }

  drawPitch(v) {
    const { L, W, pitch } = v;
    const m = pitch.walls ? 0.6 : 4;
    this.quad([[-m - 6, -m - 4], [L + m + 6, -m - 4], [L + m + 6, W + m + 2], [-m - 6, W + m + 2]], pitch.walls ? '#334155' : '#166534');
    const n = pitch.walls ? 8 : 14;
    for (let i = 0; i < n; i++) this.quad([[(L / n) * i, 0], [(L / n) * (i + 1), 0], [(L / n) * (i + 1), W], [(L / n) * i, W]], i % 2 ? '#2f8f3a' : '#36a043');
    const lw = 0.12, white = 'rgba(255,255,255,0.88)';
    this.line([[0, 0], [L, 0], [L, W], [0, W], [0, 0]], lw, white);
    this.line([[L / 2, 0], [L / 2, W]], lw, white);
    const r = pitch.walls ? 3 : v.size === 11 ? 9.15 : 6;
    this.line(arc(L / 2, W / 2, r, 0, TAU, 40), lw, white);
    for (const [gx, s] of [[0, 1], [L, -1]]) {
      const bw = pitch.boxW / 2, bx = gx + s * pitch.box;
      this.line([[gx, W / 2 - bw], [bx, W / 2 - bw], [bx, W / 2 + bw], [gx, W / 2 + bw]], lw, white);
      const sb = pitch.box * 0.33, sw = pitch.goal / 2 + pitch.box * 0.33;
      this.line([[gx, W / 2 - sw], [gx + s * sb, W / 2 - sw], [gx + s * sb, W / 2 + sw], [gx, W / 2 + sw]], lw, white);
      if (!pitch.walls) {
        const spot = gx + s * pitch.box * 0.67;
        this.line(arc(spot, W / 2, 0.18, 0, TAU, 8), lw * 1.5, white);
        const a = Math.acos(Math.min(1, (pitch.box - pitch.box * 0.67) / r));
        this.line(s > 0 ? arc(spot, W / 2, r, -a, a, 16) : arc(spot, W / 2, r, Math.PI - a, Math.PI + a, 16), lw, white);
      }
    }
  }
  drawGoal(v, gx) {
    const { W, pitch } = v, half = pitch.goal / 2, h = pitch.goalH, s = gx === 0 ? -1 : 1, d = pitch.walls ? 1 : 2;
    const net = 'rgba(241,245,249,0.35)';
    this.quad([[gx + s * d, W / 2 - half, 0], [gx + s * d, W / 2 + half, 0], [gx + s * d, W / 2 + half, h * 0.8], [gx + s * d, W / 2 - half, h * 0.8]], 'rgba(226,232,240,0.12)');
    for (let i = 0; i <= 8; i++) { const y = W / 2 - half + (pitch.goal / 8) * i; this.line([[gx, y, h], [gx + s * d, y, h * 0.8], [gx + s * d, y, 0]], 0.03, net); }
    for (let k = 1; k < 4; k++) this.line([[gx + s * d, W / 2 - half, (h * 0.8 * k) / 4], [gx + s * d, W / 2 + half, (h * 0.8 * k) / 4]], 0.03, net);
    const post = '#f8fafc';
    this.line([[gx, W / 2 - half, 0], [gx, W / 2 - half, h], [gx, W / 2 + half, h], [gx, W / 2 + half, 0]], 0.12, post);
  }
  shadow(q, rx, alpha = 0.28) {
    const g = this.g; g.fillStyle = `rgba(0,0,0,${alpha})`; g.beginPath();
    g.ellipse(q[0], q[1], Math.max(1, rx * q[2]), Math.max(1, rx * q[2] * (this.ortho ? 1 : 0.32)), 0, 0, TAU); g.fill();
  }

  drawPlayer(v, p, q) {
    const g = this.g, s = q[2], [x, y] = q;
    const kit = p.gk ? GK_KITS[p.team] : v.teams[p.team].kit;
    if (this.ortho) {
      g.fillStyle = kit.primary; g.strokeStyle = kit.secondary; g.lineWidth = Math.max(1, s * 0.12);
      g.beginPath(); g.arc(x, y, s * 0.65, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = '#0f172a'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + p.fx * s, y - p.fy * s); g.stroke();
      if (s > 6) { g.fillStyle = readable(kit.primary); g.font = `700 ${Math.round(s * 0.7)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.number, x, y + 0.5); g.textBaseline = 'alphabetic'; }
      this.marker(v, p, x, y - s * 1.1, s * 1.4);
      return;
    }
    g.save(); g.translate(x, y);
    if (p.action === 'slide') g.rotate((p.fx >= 0 ? -1 : 1) * 1.15);
    else if (p.dive) { g.rotate(p.dive * -1.1); g.translate(0, -s * 0.3); }
    const swing = Math.sin(p.anim * 2.4) * 0.28 * s, arm = Math.sin(p.anim * 2.4 + Math.PI) * 0.22 * s;
    const face = p.fx * s * 0.05;
    g.lineCap = 'round';
    // legs
    g.lineWidth = Math.max(1.5, s * 0.15);
    g.strokeStyle = kit.secondary === kit.primary ? '#f8fafc' : kit.secondary;
    g.beginPath(); g.moveTo(-0.08 * s, -0.86 * s); g.lineTo(-0.08 * s + swing, 0); g.moveTo(0.08 * s, -0.86 * s); g.lineTo(0.08 * s - swing, 0); g.stroke();
    g.strokeStyle = '#0f172a'; g.lineWidth = Math.max(1.5, s * 0.17);
    g.beginPath(); g.moveTo(-0.08 * s + swing - 0.04 * s, -0.02 * s); g.lineTo(-0.08 * s + swing + p.fx * 0.1 * s, -0.02 * s);
    g.moveTo(0.08 * s - swing - 0.04 * s, -0.02 * s); g.lineTo(0.08 * s - swing + p.fx * 0.1 * s, -0.02 * s); g.stroke();
    // shorts
    g.fillStyle = kit.shorts; rr(g, -0.22 * s, -1.06 * s, 0.44 * s, 0.26 * s, 0.05 * s); g.fill();
    // arms
    g.strokeStyle = p.skin; g.lineWidth = Math.max(1.2, s * 0.11);
    g.beginPath(); g.moveTo(-0.25 * s, -1.42 * s); g.lineTo(-0.3 * s + arm, -1.0 * s); g.moveTo(0.25 * s, -1.42 * s); g.lineTo(0.3 * s - arm, -1.0 * s); g.stroke();
    // shirt
    g.fillStyle = kit.primary; rr(g, -0.27 * s, -1.55 * s, 0.54 * s, 0.55 * s, 0.09 * s); g.fill();
    if (kit.pattern === 'stripes' && s > 5) { g.fillStyle = kit.secondary; for (let i = -1; i <= 1; i++) g.fillRect((i * 0.16 - 0.04) * s, -1.53 * s, 0.08 * s, 0.5 * s); }
    else if (kit.pattern === 'hoops' && s > 5) { g.fillStyle = kit.secondary; g.fillRect(-0.27 * s, -1.38 * s, 0.54 * s, 0.1 * s); g.fillRect(-0.27 * s, -1.18 * s, 0.54 * s, 0.1 * s); }
    else if (kit.pattern === 'half' && s > 5) { g.fillStyle = kit.secondary; g.fillRect(0, -1.53 * s, 0.25 * s, 0.51 * s); }
    else if (kit.pattern === 'sash' && s > 5) { g.strokeStyle = kit.secondary; g.lineWidth = 0.1 * s; g.beginPath(); g.moveTo(-0.24 * s, -1.5 * s); g.lineTo(0.24 * s, -1.05 * s); g.stroke(); }
    if (s > 16) { g.fillStyle = readable(kit.primary); g.font = `800 ${Math.round(s * 0.26)}px system-ui`; g.textAlign = 'center'; g.fillText(p.number, 0, -1.2 * s); }
    // head
    g.fillStyle = p.skin; g.beginPath(); g.arc(face, -1.7 * s, 0.14 * s, 0, TAU); g.fill();
    g.fillStyle = p.hair; g.beginPath(); g.arc(face, -1.74 * s, 0.14 * s, Math.PI, TAU); g.fill();
    g.restore();
    this.marker(v, p, x, y - 2.0 * s, s);
  }
  marker(v, p, x, y, s) {
    if (p.human == null) return;
    const h = v.humans.find((o) => o.id === p.human);
    if (!h) return;
    const g = this.g, sz = Math.max(7, s * 0.32) * (this.ortho ? 1.2 : 1);
    g.fillStyle = h.color; g.strokeStyle = '#0f172a'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x - sz * 0.7, y - sz); g.lineTo(x + sz * 0.7, y - sz); g.lineTo(x, y); g.closePath(); g.fill(); g.stroke();
    g.font = `800 ${Math.round(Math.max(10, sz * 0.95))}px system-ui`; g.textAlign = 'center';
    g.lineWidth = 3; g.strokeText(h.label, x, y - sz * 1.25); g.fillText(h.label, x, y - sz * 1.25);
    if (h.charge > 0) {
      const w = Math.max(30, s * 1.4);
      g.fillStyle = 'rgba(15,23,42,0.7)'; g.fillRect(x - w / 2, y - sz * 2.6, w, 6);
      g.fillStyle = h.charge > 0.85 ? '#ef4444' : '#facc15'; g.fillRect(x - w / 2, y - sz * 2.6, w * h.charge, 6);
    }
  }
  drawBall(b) {
    const q = this.P(b.x, b.y, b.z + 0.11);
    if (!q) return;
    const g = this.g, r = Math.max(2.2, q[2] * 0.11 * (this.ortho ? 4 : 1.7));
    g.fillStyle = '#f8fafc'; g.strokeStyle = '#0f172a'; g.lineWidth = Math.max(0.8, r * 0.16);
    g.beginPath(); g.arc(q[0], q[1], r, 0, TAU); g.fill(); g.stroke();
    const a = (b.x + b.y) * 1.7;
    g.fillStyle = '#111827';
    for (let i = 0; i < 3; i++) { const t = a + (i * TAU) / 3; g.beginPath(); g.arc(q[0] + Math.cos(t) * r * 0.5, q[1] + Math.sin(t) * r * 0.5, r * 0.26, 0, TAU); g.fill(); }
  }
  rain(dt) {
    const g = this.g;
    while (this.drops.length < 140) this.drops.push({ x: Math.random() * this.w, y: Math.random() * this.h, v: 600 + Math.random() * 400 });
    g.strokeStyle = 'rgba(203,213,225,0.45)'; g.lineWidth = 1; g.beginPath();
    for (const d of this.drops) { d.y += d.v * dt; d.x -= d.v * dt * 0.15; if (d.y > this.h) { d.y = -10; d.x = Math.random() * this.w * 1.2; } g.moveTo(d.x, d.y); g.lineTo(d.x + 3, d.y - 12); }
    g.stroke();
  }

  // ----------------------------------------------------------- HUD
  hud(v, o) {
    const g = this.g, u = this.ui;
    const x = 16 * u, y = 14 * u, hgt = 34 * u;
    g.font = `800 ${Math.round(17 * u)}px system-ui,sans-serif`; g.textBaseline = 'middle';
    const minute = Math.floor(v.clock / 60), sec = Math.floor(v.clock % 60);
    const parts = [[v.teams[0].short, v.teams[0].kit.primary], [`${v.score[0]} - ${v.score[1]}`, '#0f172a'], [v.teams[1].short, v.teams[1].kit.primary], [`${String(minute).padStart(2, '0')}:${String(sec).padStart(2, '0')}`, '#1e293b']];
    let cx = x;
    for (const [text, bg] of parts) {
      const w = g.measureText(text).width + 22 * u;
      g.fillStyle = bg; g.fillRect(cx, y, w, hgt);
      g.fillStyle = readable(bg); g.textAlign = 'center'; g.fillText(text, cx + w / 2, y + hgt / 2 + 1);
      cx += w;
    }
    if (v.banner) {
      g.font = `900 ${Math.round(38 * u)}px system-ui,sans-serif`; g.textAlign = 'center';
      const w = g.measureText(v.banner).width + 60 * u;
      g.fillStyle = 'rgba(15,23,42,0.72)'; g.fillRect((this.w - w) / 2, this.h * 0.2 - 30 * u, w, 60 * u);
      g.fillStyle = '#f8fafc'; g.fillText(v.banner, this.w / 2, this.h * 0.2);
    }
    if (v.pens) {
      g.font = `700 ${Math.round(16 * u)}px system-ui`; g.textAlign = 'left';
      v.pens.forEach((row, t) => {
        g.fillStyle = 'rgba(15,23,42,0.75)'; g.fillRect(x, y + hgt + 8 * u + t * 26 * u, 230 * u, 24 * u);
        g.fillStyle = '#f8fafc'; g.fillText(v.teams[t].short, x + 8 * u, y + hgt + 20 * u + t * 26 * u);
        row.forEach((ok, i) => { g.fillStyle = ok ? '#22c55e' : '#ef4444'; g.beginPath(); g.arc(x + 70 * u + i * 20 * u, y + hgt + 20 * u + t * 26 * u, 7 * u, 0, TAU); g.fill(); });
      });
    }
    if (o.status) { g.font = `600 ${Math.round(13 * u)}px system-ui`; g.textAlign = 'right'; g.fillStyle = 'rgba(15,23,42,0.75)'; const w = g.measureText(o.status).width + 16 * u; g.fillRect(this.w - w - 14 * u, y, w, 24 * u); g.fillStyle = '#f8fafc'; g.fillText(o.status, this.w - 22 * u, y + 12 * u); }
    if (this.cam !== 'top' && o.radar !== false) this.radar(v);
    g.textBaseline = 'alphabetic';
  }
  radar(v) {
    const g = this.g, u = this.ui;
    const w = Math.min(this.w * 0.18, 180 * u), h = (w * v.W) / v.L;
    const x0 = (this.w - w) / 2, y0 = this.h - h - 12 * u;
    g.fillStyle = 'rgba(15,23,42,0.4)'; g.fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.strokeRect(x0, y0, w, h);
    g.beginPath(); g.moveTo(x0 + w / 2, y0); g.lineTo(x0 + w / 2, y0 + h); g.stroke();
    for (const p of v.players) {
      g.fillStyle = p.human != null ? (v.humans.find((o) => o.id === p.human) || {}).color || '#fff' : v.teams[p.team].kit.primary;
      g.beginPath(); g.arc(x0 + (p.x / v.L) * w, y0 + (1 - p.y / v.W) * h, p.human != null ? 3.4 : 2.4, 0, TAU); g.fill();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x0 + (v.ball.x / v.L) * w, y0 + (1 - v.ball.y / v.W) * h, 2.2, 0, TAU); g.fill();
  }
}

function arc(cx, cy, r, a0, a1, n) { const out = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function readable(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#f8fafc';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? '#0f172a' : '#f8fafc';
}
