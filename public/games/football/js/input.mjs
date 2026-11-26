// Self-Study Football - controllers.
//
// Every controller is a SOURCE with an id: 'k1' and 'k2' (two players on one
// keyboard), 'g0', 'g1', ... (gamepads), 't0' (on-screen touch pad) and, from the
// network, 'r:<peer>:<id>'. A source answers one state:
//   { mx, my, sprint, pass, shoot, through, lob, switch, skill, start }
// with mx/my in WORLD terms (my > 0 is up the screen, towards the far touchline).
//
// Gamepads: the browser's Gamepad API sees any pad the operating system sees -
// USB, Bluetooth or a wireless dongle - with the "standard" Xbox/PlayStation layout
// where the OS reports one and a positional fallback where it does not. One
// browser engine reads at most four pads at once (Chromium's limit); more players
// join from other devices on the LAN, from phones (touch pad), or online - each
// device adds its own pads - which is how a match takes 7, 10 or 22 humans.

const KEYS = {
  k1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], pass: ['KeyJ', 'Space'], shoot: ['KeyK'], through: ['KeyL'], lob: ['KeyI'],
    sprint: ['ShiftLeft'], switch: ['KeyQ'], skill: ['KeyE'], start: ['Escape'] },
  k2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], pass: ['Numpad1', 'Comma'], shoot: ['Numpad2', 'Period'],
    through: ['Numpad3', 'Slash'], lob: ['Numpad5', 'Semicolon'], sprint: ['Numpad0', 'ShiftRight'], switch: ['Numpad4', 'Quote'], skill: ['Numpad6', 'BracketRight'], start: ['Backspace'] },
};
export const KEY_HELP = {
  k1: 'Move W A S D · Pass J/Space · Shoot K (hold for power) · Through L · Lob/Cross I · Sprint Shift · Switch Q',
  k2: 'Move arrows · Pass , or Num1 · Shoot . or Num2 · Through / or Num3 · Lob ; or Num5 · Sprint R-Shift/Num0 · Switch \' or Num4',
  pad: 'Move left stick/d-pad · Pass A/✕ · Shoot B/○ (hold) · Through X/□ · Lob Y/△ · Sprint RT/R2 · Switch LB/L1 · Pause Start',
};
const BUTTONS = ['pass', 'shoot', 'through', 'lob', 'switch', 'sprint', 'skill', 'start'];
const blank = () => ({ mx: 0, my: 0, sprint: false, pass: false, shoot: false, through: false, lob: false, switch: false, skill: false, start: false });

export class Input {
  constructor() {
    this.down = new Set();
    this.touch = null;
    this.remote = new Map();
    this.prev = new Map();
    this.usedKeys = { k1: false, k2: false };
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      this.down.add(e.code);
      for (const k of ['k1', 'k2']) if (Object.values(KEYS[k]).some((l) => l.includes(e.code))) this.usedKeys[k] = true;
      if (/^(Arrow|Space)/.test(e.code) && this.inGame) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
  }
  key(id) {
    const m = KEYS[id], has = (l) => l.some((c) => this.down.has(c)), s = blank();
    s.mx = (has(m.right) ? 1 : 0) - (has(m.left) ? 1 : 0);
    s.my = (has(m.up) ? 1 : 0) - (has(m.down) ? 1 : 0);
    if (s.mx && s.my) { s.mx *= 0.7071; s.my *= 0.7071; }
    for (const b of BUTTONS) s[b] = has(m[b]);
    return s;
  }
  pads() { try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean); } catch { return []; } }
  pad(gp) {
    const s = blank(), b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
    if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
    // Some pads report the d-pad as a hat on axis 9.
    if (gp.mapping !== 'standard' && gp.axes.length > 9 && Math.abs(gp.axes[9]) <= 1 && gp.axes[9] !== 0) {
      const hat = Math.round((gp.axes[9] + 1) * 3.5);
      if (hat <= 7) { x = [0, 1, 1, 1, 0, -1, -1, -1][hat]; y = [-1, -1, 0, 1, 1, 1, 0, -1][hat]; }
    }
    const m = Math.hypot(x, y);
    if (m < 0.22) { x = 0; y = 0; } else if (m > 1) { x /= m; y /= m; }
    s.mx = x; s.my = -y;
    s.pass = b(0); s.shoot = b(1); s.through = b(2); s.lob = b(3); s.switch = b(4); s.skill = b(5);
    s.sprint = b(7) || b(6) || (gp.mapping !== 'standard' && (b(6) || b(7)));
    s.start = b(9);
    return s;
  }
  // Every controller that can play right now.
  list() {
    const out = [{ id: 'k1', name: 'Keyboard (left)', kind: 'keyboard' }, { id: 'k2', name: 'Keyboard (right)', kind: 'keyboard' }];
    for (const gp of this.pads()) out.push({ id: 'g' + gp.index, name: cleanPadName(gp.id), kind: 'gamepad' });
    if (this.touch) out.push({ id: 't0', name: 'Touch pad', kind: 'touch' });
    for (const [id, r] of this.remote) out.push({ id, name: r.name, kind: 'remote' });
    return out;
  }
  read(id) {
    if (id === 'k1' || id === 'k2') return this.key(id);
    if (id === 't0') return this.touch ? { ...this.touch.state } : blank();
    if (id[0] === 'g') { const gp = this.pads().find((p) => 'g' + p.index === id); return gp ? this.pad(gp) : blank(); }
    if (id.startsWith('r:')) { const r = this.remote.get(id); return r ? r.state : blank(); }
    return blank();
  }
  // Edge-detected menu events from every controller: [{ id, act }].
  menuEvents() {
    const out = [];
    for (const { id } of this.list()) {
      const s = this.read(id), p = this.prev.get(id) || blank();
      const dir = (v, pv, a, b) => { if (v > 0.5 && !(pv > 0.5)) out.push({ id, act: a }); if (v < -0.5 && !(pv < -0.5)) out.push({ id, act: b }); };
      dir(s.mx, p.mx, 'right', 'left'); dir(s.my, p.my, 'up', 'down');
      if (s.pass && !p.pass) out.push({ id, act: 'ok' });
      if (s.shoot && !p.shoot) out.push({ id, act: 'back' });
      if (s.start && !p.start) out.push({ id, act: 'start' });
      this.prev.set(id, s);
    }
    return out;
  }
  setRemote(id, name, state) { this.remote.set(id, { name, state: { ...blank(), ...state } }); }
  dropRemote(prefix) { for (const k of [...this.remote.keys()]) if (k.startsWith(prefix)) this.remote.delete(k); }
}

function cleanPadName(s) {
  const n = String(s || 'Gamepad').replace(/\(.*?Vendor.*?\)/i, '').replace(/STANDARD GAMEPAD/i, '').trim();
  return n.length > 34 ? n.slice(0, 34) + '…' : n || 'Gamepad';
}

// A thumb stick and five buttons for phones and tablets.
export function touchControls(host, input) {
  const root = document.createElement('div');
  root.className = 'touch';
  root.innerHTML = '<div class="stick"><div class="nub"></div></div><div class="tbtns">'
    + ['pass:A', 'shoot:B', 'through:X', 'lob:Y', 'sprint:RT', 'switch:LB'].map((s) => { const [k, l] = s.split(':'); return `<button data-k="${k}">${l}<small>${k}</small></button>`; }).join('') + '</div>';
  host.appendChild(root);
  const state = blank();
  input.touch = { state };
  const stick = root.querySelector('.stick'), nub = root.querySelector('.nub');
  let sid = null, ox = 0, oy = 0;
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; stick.setPointerCapture(sid); move(e); });
  const move = (e) => {
    if (e.pointerId !== sid) return;
    let dx = (e.clientX - ox) / 50, dy = (e.clientY - oy) / 50; const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    state.mx = Math.abs(dx) > 0.15 ? dx : 0; state.my = Math.abs(dy) > 0.15 ? -dy : 0;
    nub.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
  };
  stick.addEventListener('pointermove', move);
  const end = (e) => { if (e.pointerId !== sid) return; sid = null; state.mx = 0; state.my = 0; nub.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  for (const b of root.querySelectorAll('button')) {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); state[k] = true; b.classList.add('on'); });
    const up = () => { state[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  }
  return root;
}
