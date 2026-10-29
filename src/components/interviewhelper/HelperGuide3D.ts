/*
  The 3D "how to use it" guide on /interview-helper: a laptop on a desk whose
  screen shows a stylised Interview Helper window, a video-call window beside
  it, sound waves travelling from the call into the app, and an answer card
  coming out of the screen. Six steps; the CAPTIONS are DOM text in the Vue
  wrapper (translatable, readable by a screen reader) - nothing here draws text.

  three.js is imported DYNAMICALLY, here and nowhere else on this route
  (working rule 47): the router imports ~50 views and anything a view imports
  statically lands in the entry chunk every visitor downloads. The WebGL probe
  is in the wrapper and does not touch three.

  Colours are read from the theme's CSS tokens at build time, so the scene
  follows the galaxy. The wrapper rebuilds it when `data-theme` changes.
*/

export const GUIDE_STEPS = 6;

export interface HelperGuide {
  setStep(step: number): void;
  /** Start or stop the render loop (off-screen, tab hidden, unmounted). */
  setRunning(on: boolean): void;
  resize(): void;
  dispose(): void;
}

interface Options {
  reducedMotion: boolean;
  onFirstFrame?: () => void;
}

/** A theme token as a colour three understands, or the fallback. */
function token(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!v) return fallback;
    if (/^\d+\s+\d+\s+\d+$/.test(v)) return `rgb(${v.split(/\s+/).join(',')})`;
    return v;
  } catch {
    return fallback;
  }
}

// One cached download for every guide on the page, failures included.
let threePromise: Promise<any> | null = null;
function loadThree(): Promise<any> {
  // three ships no type declarations in this repo; the scene types it as `any`.
  // @ts-ignore
  if (!threePromise) threePromise = import('three').catch((e: unknown) => { threePromise = null; throw e; });
  return threePromise;
}

export async function createHelperGuide(canvas: HTMLCanvasElement, opts: Options): Promise<HelperGuide> {
  const THREE: any = await loadThree();

  const col = (name: string, fb: string) => {
    const c = new THREE.Color();
    try { c.setStyle(token(name, fb)); } catch { c.set(fb); }
    return c;
  };
  const C = {
    accent: col('--sfs-accent', '#667eea'),
    accent2: col('--sfs-accent-2', '#764ba2'),
    success: col('--sfs-success', '#34d399'),
    warning: col('--sfs-warning', '#fbbf24'),
    paper: col('--sfs-paper', '#ffffff'),
    ink: col('--sfs-on-paper', '#0f172a'),
    metal: col('--sfs-text-muted', '#94a3b8'),
    dark: new THREE.Color('#0b1020'),
    cream: new THREE.Color('#fff6d8'),
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 50);
  camera.position.set(0, 1.55, 5.2);
  camera.lookAt(0, 0.75, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2.5, 4, 4);
  scene.add(key);

  const disposables: any[] = [];
  const mat = (color: any, extra: Record<string, unknown> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });
    disposables.push(m);
    return m;
  };
  const basic = (color: any, extra: Record<string, unknown> = {}) => {
    const m = new THREE.MeshBasicMaterial({ color, ...extra });
    disposables.push(m);
    return m;
  };
  const geo = (g: any) => { disposables.push(g); return g; };
  const box = (w: number, h: number, d: number, m: any) => new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), m);
  const plane = (w: number, h: number, m: any) => new THREE.Mesh(geo(new THREE.PlaneGeometry(w, h)), m);

  // ---- the desk and the laptop ------------------------------------------
  const desk = box(6.5, 0.08, 2.6, mat(C.metal.clone().multiplyScalar(0.45)));
  desk.position.set(0, -0.04, 0.2);
  scene.add(desk);

  const laptop = new THREE.Group();
  scene.add(laptop);
  const shell = mat(C.metal.clone().lerp(new THREE.Color('#ffffff'), 0.35), { metalness: 0.4, roughness: 0.35 });
  const base = box(2.1, 0.07, 1.35, shell);
  base.position.set(0, 0.035, 0.45);
  laptop.add(base);
  const deck = plane(1.8, 0.75, mat(C.metal.clone().multiplyScalar(0.6)));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0.072, 0.35);
  laptop.add(deck);
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.07, -0.2);
  hinge.rotation.x = -0.18;
  laptop.add(hinge);
  const lid = box(2.1, 1.35, 0.05, shell);
  lid.position.set(0, 0.675, 0);
  hinge.add(lid);
  // The screen surface; everything the app "shows" is a child of it.
  const screen = new THREE.Group();
  screen.position.set(0, 0.675, 0.03);
  hinge.add(screen);
  screen.add(plane(1.96, 1.2, basic(C.dark)));
  const appWin = plane(1.84, 1.08, basic(C.paper.clone().lerp(C.dark, 0.05)));
  appWin.position.z = 0.002;
  screen.add(appWin);
  const titleBar = plane(1.84, 0.1, basic(C.accent));
  titleBar.position.set(0, 0.49, 0.004);
  screen.add(titleBar);

  // ---- per-step elements ------------------------------------------------
  // Each has the steps it belongs to; every frame its scale eases toward 1 or 0.
  interface Item { obj: any; steps: number[]; s: number; tick?: (t: number, k: number) => void }
  const items: Item[] = [];
  const add = (parent: any, obj: any, steps: number[], tick?: Item['tick']) => {
    obj.scale.setScalar(0.0001);
    obj.visible = false;
    parent.add(obj);
    items.push({ obj, steps, s: 0, tick });
    return obj;
  };
  const bar = (w: number, h: number, color: any, x: number, y: number) => {
    const m = plane(w, h, basic(color));
    m.position.set(x, y, 0.006);
    return m;
  };
  const inkSoft = C.ink.clone().lerp(C.paper, 0.6);

  // 1. Download & install: an arrow drops into an installer box; a progress bar fills.
  const dl = new THREE.Group();
  dl.position.set(1.9, 0, 0.6);
  const pkg = box(0.55, 0.42, 0.55, mat(C.accent2));
  pkg.position.y = 0.21;
  dl.add(pkg);
  const arrow = new THREE.Group();
  const shaft = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 20)), mat(C.success));
  shaft.position.y = 0.17;
  const head = new THREE.Mesh(geo(new THREE.ConeGeometry(0.16, 0.22, 24)), mat(C.success));
  head.rotation.x = Math.PI;
  arrow.add(shaft, head);
  dl.add(arrow);
  add(scene, dl, [0], (t) => { arrow.position.y = 0.75 + 0.45 * (1 - ((t * 0.7) % 1)); });
  const prog = new THREE.Group();
  prog.add(bar(1.2, 0.08, inkSoft, 0, 0));
  const fill = bar(1.2, 0.08, C.success, 0, 0);
  fill.position.z = 0.008;
  prog.add(fill);
  add(screen, prog, [0], (t) => {
    const p = Math.min(1, (t * 0.35) % 1.2);
    fill.scale.x = Math.max(0.001, p);
    fill.position.x = -0.6 + 0.6 * p;
  });

  // 2. Sign in: an avatar, two fields and a button; a tick appears.
  const signin = new THREE.Group();
  const avatar = new THREE.Mesh(geo(new THREE.CircleGeometry(0.13, 32)), basic(C.accent));
  avatar.position.set(0, 0.22, 0.006);
  signin.add(avatar, bar(0.9, 0.09, inkSoft, 0, 0.0), bar(0.9, 0.09, inkSoft, 0, -0.15), bar(0.5, 0.1, C.accent, 0, -0.32));
  const tick = new THREE.Mesh(geo(new THREE.TorusGeometry(0.07, 0.022, 10, 32)), basic(C.success));
  tick.position.set(0.55, -0.32, 0.01);
  signin.add(tick);
  add(screen, signin, [1], (t) => { tick.scale.setScalar(Math.min(1, Math.max(0.001, (t % 3) - 1))); });

  // 3. Interview setup: the position field, and a CV page flying into the screen.
  const setup = new THREE.Group();
  setup.add(bar(0.35, 0.05, C.accent, -0.52, 0.32), bar(1.4, 0.1, inkSoft, 0, 0.2), bar(0.35, 0.05, C.accent, -0.52, 0.02));
  const cvField = bar(1.4, 0.36, inkSoft.clone().lerp(C.paper, 0.6), 0, -0.2);
  setup.add(cvField);
  add(screen, setup, [2]);
  const cv = new THREE.Group();
  cv.add(plane(0.55, 0.75, basic(C.paper)));
  for (let i = 0; i < 6; i++) cv.add(bar(i === 0 ? 0.3 : 0.42, 0.035, i === 0 ? C.accent : inkSoft, i === 0 ? -0.06 : 0, 0.26 - i * 0.1));
  cv.position.set(1.8, 1.1, 0.8);
  add(scene, cv, [2], (t, k) => {
    const p = (t * 0.4) % 1;
    const e = p * p * (3 - 2 * p);
    cv.position.set(1.8 - 1.6 * e, 1.15 - 0.25 * e, 0.8 - 0.55 * e);
    cv.rotation.set(0, -0.6 * (1 - e), 0.2 * (1 - e));
    const fade = p > 0.85 ? (1 - p) / 0.15 : 1;
    cv.scale.setScalar(Math.max(0.001, fade * 0.9 * k));
  });

  // 4. The call: a video-call window, an interviewer, sound waves into the app.
  const call = new THREE.Group();
  call.position.set(-2.05, 1.05, 0.2);
  call.rotation.y = 0.45;
  call.add(plane(1.15, 0.8, basic(C.dark)));
  const callBar = bar(1.15, 0.08, C.accent2, 0, 0.36);
  call.add(callBar);
  const person = new THREE.Group();
  const face = new THREE.Mesh(geo(new THREE.CircleGeometry(0.12, 28)), basic(new THREE.Color('#e7b48f')));
  face.position.set(0, 0.06, 0.01);
  const body = new THREE.Mesh(geo(new THREE.CircleGeometry(0.24, 28, 0, Math.PI)), basic(C.accent));
  body.position.set(0, -0.33, 0.01);
  person.add(face, body);
  call.add(person);
  const rings: any[] = [];
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(geo(new THREE.TorusGeometry(0.16, 0.018, 8, 40)), basic(C.accent, { transparent: true, opacity: 0.8 }));
    rings.push(r);
    call.add(r);
  }
  add(scene, call, [3], (t) => {
    rings.forEach((r, i) => {
      const p = (t * 0.55 + i / rings.length) % 1;
      // Out of the call window toward the laptop (to its right, in its own frame).
      r.position.set(0.55 + p * 1.4, -0.1 - p * 0.25, 0.1 + p * 0.25);
      r.rotation.y = Math.PI / 2 - 0.4;
      r.scale.setScalar(0.6 + p * 1.2);
      (r.material as any).opacity = 0.85 * (1 - p);
    });
  });
  const wave = new THREE.Group();
  const waveBars: any[] = [];
  for (let i = 0; i < 18; i++) {
    const b = bar(0.05, 0.3, C.accent, -0.6 + i * 0.07, 0);
    waveBars.push(b);
    wave.add(b);
  }
  add(screen, wave, [3], (t) => {
    waveBars.forEach((b, i) => { b.scale.y = 0.2 + Math.abs(Math.sin(t * 5 + i * 0.7)) * (0.5 + 0.5 * Math.sin(i * 1.3)); });
  });

  // 5. The answer: the question, its Arabic line, and the cream READ THIS NOW box.
  const ans = new THREE.Group();
  ans.add(bar(1.3, 0.07, C.ink, -0.2, 0.36), bar(0.9, 0.06, inkSoft, 0.38, 0.24));
  const readBox = plane(1.6, 0.55, basic(C.cream));
  readBox.position.set(0, -0.15, 0.004);
  ans.add(readBox);
  ans.add(bar(0.35, 0.04, C.warning, -0.55, 0.06));
  for (let i = 0; i < 3; i++) ans.add(bar([1.3, 1.1, 1.2][i] ?? 1, 0.06, C.ink, -0.1 + ([0, -0.1, -0.05][i] ?? 0), -0.07 - i * 0.12));
  add(screen, ans, [4]);
  const card = new THREE.Group();
  card.add(plane(0.95, 0.42, basic(C.cream)));
  for (let i = 0; i < 3; i++) card.add(bar(0.7 - i * 0.08, 0.045, C.ink, -0.05, 0.1 - i * 0.1));
  card.position.set(0.25, 1.2, 0.6);
  add(scene, card, [4], (t) => { card.position.y = 1.25 + Math.sin(t * 1.6) * 0.04; card.rotation.y = -0.15 + Math.sin(t * 0.9) * 0.05; });

  // 6. After End: the report - a score ring and bars rising.
  const rep = new THREE.Group();
  const ringBack = new THREE.Mesh(geo(new THREE.RingGeometry(0.17, 0.23, 48)), basic(inkSoft));
  ringBack.position.set(-0.5, 0.05, 0.006);
  const ringFront = new THREE.Mesh(geo(new THREE.RingGeometry(0.17, 0.23, 48, 1, Math.PI / 2, -Math.PI * 1.5)), basic(C.success));
  ringFront.position.set(-0.5, 0.05, 0.008);
  rep.add(ringBack, ringFront);
  const repBars: any[] = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(geo(new THREE.PlaneGeometry(0.11, 0.5)), basic(i % 2 ? C.accent2 : C.accent));
    b.geometry.translate(0, 0.25, 0);
    b.position.set(0.05 + i * 0.16, -0.3, 0.006);
    repBars.push(b);
    rep.add(b);
  }
  add(screen, rep, [5], (t) => {
    repBars.forEach((b, i) => { b.scale.y = Math.max(0.01, Math.min(1, t * 0.8 - i * 0.12) * ([0.9, 0.6, 1, 0.75, 0.85][i] ?? 1)); });
  });

  // ---- the loop ---------------------------------------------------------
  let step = 0;
  let stepClock = 0;
  let running = false;
  let raf = 0;
  let last = 0;
  let first = true;
  let disposed = false;

  const resize = () => {
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 360;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // A narrow canvas needs to step back to keep the call window and the laptop in frame.
    const back = camera.aspect < 1.3 ? 1 + (1.3 - camera.aspect) * 1.6 : 1;
    camera.position.set(0, 1.55 * back, 5.2 * back);
    camera.lookAt(0, 0.75, 0);
    camera.updateProjectionMatrix();
  };

  const frame = (dt: number, snap: boolean) => {
    stepClock += dt;
    const k = snap ? 1 : 1 - Math.pow(0.0015, dt);
    for (const it of items) {
      const want = it.steps.includes(step) ? 1 : 0;
      it.s += (want - it.s) * k;
      if (snap || Math.abs(want - it.s) < 0.002) it.s = want;
      it.obj.visible = it.s > 0.01;
      if (it.obj.visible) {
        const e = it.s * it.s * (3 - 2 * it.s);
        it.obj.scale.setScalar(Math.max(0.0001, e));
        if (it.tick) it.tick(opts.reducedMotion ? 1.9 : stepClock, e);
      }
    }
    if (!opts.reducedMotion) {
      // A slow drift so the scene reads as a place, not a picture.
      const a = Math.sin(performance.now() / 4200) * 0.12;
      laptop.rotation.y = a * 0.6;
    }
    renderer.render(scene, camera);
    if (first) { first = false; opts.onFirstFrame?.(); }
  };

  const loop = (now: number) => {
    if (!running || disposed) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    frame(dt, false);
    raf = requestAnimationFrame(loop);
  };

  const guide: HelperGuide = {
    setStep(n: number) {
      step = Math.max(0, Math.min(GUIDE_STEPS - 1, n));
      stepClock = 0;
      if (!running) frame(0, true);
    },
    setRunning(on: boolean) {
      if (disposed) return;
      // Under reduced motion nothing animates: each step is drawn once, settled.
      if (opts.reducedMotion) { running = false; frame(0, true); return; }
      if (on === running) return;
      running = on;
      cancelAnimationFrame(raf);
      if (on) { last = 0; raf = requestAnimationFrame(loop); }
    },
    resize() { resize(); if (!running) frame(0, true); },
    dispose() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      for (const d of disposables) d.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
  resize();
  frame(0, true);
  return guide;
}
