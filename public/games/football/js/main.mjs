// Self-Study Football - menus, the match loop, and the multiplayer lobbies.
import { allTeams, teamById, leagues, teamsOf, competitions, competitionById, FORMATIONS, DEFAULT_FORMATION, DIFFICULTIES, stadiumFor, teamStats, PITCHES } from './data.mjs';
import { Renderer3D, webglOK, QUALITY, CAMERAS3D } from './render3d.mjs';
import { Match, DT, viewFrom } from './engine.mjs';
import { Renderer, CAMERAS, readable } from './render.mjs';
import { Sound } from './audio.mjs';
import { Input, touchControls, KEY_HELP } from './input.mjs';
import * as Cup from './tournament.mjs';
import { lanHost, lanGuest, rtcHost, rtcGuest, parseInvite, newId } from './net.mjs';
import { detect, signaller, inviteLink } from './platform.mjs';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#f43f5e', '#14b8a6', '#8b5cf6'];
const SKEY = 'sfs-football-settings';
const S = Object.assign({ camera: 'broadcast', quality: 'medium', volume: 0.85, sound: true, commentary: true, voice: 'auto', time: 'night', weather: 'clear', name: '', minutes: 4, difficulty: 'pro', size: 11, fullscreen: true },
  (() => { try { return JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch { return {}; } })());
if (!QUALITY[S.quality]) S.quality = 'medium';
const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch { /* */ } };

const app = $('#app');
const input = new Input();
const sound = new Sound();
sound.setVolume(S.volume); sound.setOn(S.sound); sound.commentary = S.commentary; sound.comm.setVoice(S.voice);
let env = { kind: 'plain' };
let screenTick = null;      // per-frame menu handler (controller-select, lobbies)
let net = null;             // { role: 'host'|'guest', api, kind: 'lan'|'online' }
const isTouch = matchMedia('(pointer: coarse)').matches;

// --------------------------------------------------------------- screens
let currentTab = 'home';
function screen(html, tick, tab) {
  screenTick = tick || null;
  if (!game) startBackground();
  input.inGame = false;
  if (tab) currentTab = tab;
  app.innerHTML = `<div class="screen">${html}</div><footer class="hints"><span><kbd>A</kbd> / <kbd>Enter</kbd> Select</span><span><kbd>B</kbd> / <kbd>Esc</kbd> Back</span><span><kbd>F11</kbd> Full screen</span><span class="padcount">🎮 ${pads().length}</span></footer>`;
  const first = app.querySelector('[autofocus], .screen .feature, .screen .tile, .screen button.primary, .screen button');
  if (first && !isTouch) first.focus({ preventScroll: true });
}
const TABS = [['home', 'Play'], ['cups', 'Tournaments'], ['multi', 'Multiplayer'], ['settings', 'Settings'], ['controls', 'Controls']];
function header(title, back) {
  return `<header class="topbar"><div class="logo"><span class="ballicon"></span><span><b>SELF-STUDY</b><i>FOOTBALL</i></span></div>
    <nav class="tabs">${TABS.map(([a, l]) => `<button class="tab ${currentTab === a ? 'on' : ''}" data-act="${a}">${l}</button>`).join('')}</nav>
    <div class="tright"><button class="iconbtn" data-act="fs" title="Full screen (F11)" aria-label="Full screen">⛶</button></div></header>
    ${title ? `<div class="crumb">${back ? `<button class="back" data-act="${back}">‹ Back</button>` : ''}<h1>${esc(title)}</h1></div>` : ''}`;
}
app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  sound.menu();
  const fn = ACTIONS[b.dataset.act];
  if (fn) fn(b.dataset, b);
});

// Gamepad/keyboard menu navigation: move focus, press A to click, B to go back.
function menuNav(events) {
  for (const e of events) {
    const items = [...app.querySelectorAll('button:not([disabled]), select, input')].filter((x) => x.offsetParent);
    const i = items.indexOf(document.activeElement);
    if (e.act === 'down' || e.act === 'right' && document.activeElement?.tagName !== 'SELECT') { (items[i + 1] || items[0])?.focus(); }
    else if (e.act === 'up' || e.act === 'left' && document.activeElement?.tagName !== 'SELECT') { (items[i - 1] || items[items.length - 1])?.focus(); }
    else if (e.act === 'ok' && e.id[0] !== 'k') { document.activeElement?.click(); }
    else if (e.act === 'back' && e.id[0] !== 'k') { app.querySelector('[data-act^="home"], .crumb [data-act]')?.click(); }
  }
}
function loop() {
  requestAnimationFrame(loop);
  if (game) return;
  const ev = input.menuEvents();
  if (screenTick) screenTick(ev); else menuNav(ev.filter((e) => e.id[0] !== 'k' || false));
}

// --------------------------------------------------------------- home
function home() {
  currentTab = 'home';
  const online = env.kind === 'desktop' || env.kind === 'web';
  const pool = allTeams().filter((t) => t.kind === 'club').sort((a, b) => b.strength - a.strength).slice(0, 12);
  const fa = pool[Math.floor(Math.random() * pool.length)];
  let fb; do { fb = pool[Math.floor(Math.random() * pool.length)]; } while (fb === fa);
  featured = [fa.id, fb.id];
  screen(`${header('')}
  <section class="home">
    <button class="feature" data-act="featured" style="--a:${fa.kit.primary};--b:${fb.kit.primary}">
      <span class="kicker">Featured match</span>
      <span class="big">KICK-OFF</span>
      <span class="fixture"><span class="club">${shirt(fa.kit)}<b>${esc(fa.name)}</b></span><em>VS</em><span class="club">${shirt(fb.kit)}<b>${esc(fb.name)}</b></span></span>
      <span class="go">Press <kbd>A</kbd> to play</span>
    </button>
    <div class="stack">
      <button class="tile hero2" data-act="cups"><span class="ic">🏆</span><b>Tournaments</b><span>Leagues, champions cups, World Nations Cup 2026</span></button>
      <button class="tile hero3" data-act="quick"><span class="ic">⚽</span><b>Custom match</b><span>Any two teams, any stadium, any weather</span></button>
      <button class="tile hero4" data-act="street"><span class="ic">🧱</span><b>Street cage</b><span>5 v 5 with walls, fast and wild</span></button>
    </div>
  </section>
  <div class="row4">
    <button class="tile" data-act="local"><span class="ic">🎮</span><b>Local multiplayer</b><span>Same screen, up to 4 pads + 2 keyboards</span></button>
    <button class="tile" data-act="lan"><span class="ic">📶</span><b>LAN · Hotspot</b><span>${env.kind === 'desktop' ? 'Host or join, no internet needed' : 'Join a game on this network'}</span></button>
    <button class="tile" data-act="online" ${online ? '' : 'disabled'}><span class="ic">🌐</span><b>Online</b><span>${online ? 'Invite a friend with a link' : 'Use the app or selfstudyjo.com'}</span></button>
    <button class="tile" data-act="settings"><span class="ic">⚙️</span><b>Settings</b><span>Graphics, camera, commentary</span></button>
  </div>`, null, 'home');
}
let featured = null;
function multi() {
  currentTab = 'multi';
  const online = env.kind === 'desktop' || env.kind === 'web';
  screen(`${header('Multiplayer')}<div class="row4 tall">
    <button class="tile" data-act="local"><span class="ic">🎮</span><b>Same screen</b><span>Keyboards and gamepads on this device</span></button>
    <button class="tile" data-act="lan"><span class="ic">📶</span><b>LAN · Wi-Fi · Hotspot</b><span>One computer hosts, others and phones join, no internet</span></button>
    <button class="tile" data-act="online" ${online ? '' : 'disabled'}><span class="ic">🌐</span><b>Online with a friend</b><span>Create an invite link and send it</span></button>
  </div>`, null, 'multi');
}
let shirtId = 0;
function shirt(kit) {
  const id = 'sh' + (++shirtId), sec = kit.secondary === kit.primary ? '#f8fafc' : kit.secondary;
  const pat = kit.pattern === 'stripes' ? [14, 26, 38, 50].map((x) => `<rect x="${x}" y="0" width="6" height="64" fill="${sec}"/>`).join('')
    : kit.pattern === 'hoops' ? [22, 36, 50].map((y) => `<rect x="0" y="${y}" width="64" height="6" fill="${sec}"/>`).join('')
    : kit.pattern === 'half' ? `<rect x="32" y="0" width="32" height="64" fill="${sec}"/>` : kit.pattern === 'sash' ? `<path d="M10 10 L60 60 L52 64 L2 18Z" fill="${sec}"/>` : '';
  const path = 'M21 5 L8 13 L2 27 L12 32 L15 27 L15 60 L49 60 L49 27 L52 32 L62 27 L56 13 L43 5 Q32 13 21 5Z';
  return `<svg class="shirt" viewBox="0 0 64 64" aria-hidden="true"><defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><path d="${path}" fill="${kit.primary}"/><g clip-path="url(#${id})">${pat}<rect x="0" y="0" width="64" height="5" fill="${sec}" opacity=".9"/></g><path d="${path}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/></svg>`;
}
const stars = (n) => { const k = Math.max(1, Math.min(5, Math.round(n))); return '★'.repeat(k) + '☆'.repeat(5 - k); };
const pads = () => input.list().filter((c) => c.kind === 'gamepad');

// --------------------------------------------------------------- team pickers
function teamOptions(selected, filter) {
  const groups = [...leagues().map((l) => [l.name, teamsOf(l.id)]), ['National teams', teamsOf('nations')], ['Street crews', teamsOf('street')]];
  return groups.filter(([, ts]) => !filter || ts.some(filter)).map(([name, ts]) => `<optgroup label="${esc(name)}">${ts.filter((t) => !filter || filter(t)).sort((a, b) => b.strength - a.strength)
    .map((t) => `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${esc(t.name)} · ${t.strength}</option>`).join('')}</optgroup>`).join('');
}
const formationOptions = (size, sel) => Object.keys(FORMATIONS[size]).map((f) => `<option ${f === sel ? 'selected' : ''}>${f}</option>`).join('');
const diffOptions = (sel) => DIFFICULTIES.map((d) => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${d.name}</option>`).join('');

let setup = null;   // the next match: { home, away, size, formations, minutes, difficulty, knockout, fixture }
function quick(size) {
  const clubs = allTeams().filter((t) => (size === 5 ? t.kind === 'street' : t.kind !== 'street'));
  setup = { size: size || S.size || 11, home: (setup && setup.home) || clubs[0].id, away: (setup && setup.away) || clubs[1].id, minutes: S.minutes, difficulty: S.difficulty };
  if (setup.size === 5) { setup.home = teamsOf('street')[0].id; setup.away = teamsOf('street')[1].id; }
  setup.hf = DEFAULT_FORMATION[setup.size]; setup.af = DEFAULT_FORMATION[setup.size];
  renderSetup();
}
function renderSetup() {
  const s = setup, H = teamById(s.home), A = teamById(s.away);
  screen(`${header('Kick-off', 'home')}
  <div class="setup">
    ${teamCard('home', 'Home', H, s.hf, s.size)}
    <div class="vs"><span>VS</span><button class="iconbtn" data-act="swap" title="Swap sides">⇄</button><button class="iconbtn" data-act="random" title="Random teams">🎲</button></div>
    ${teamCard('away', 'Away', A, s.af, s.size)}
  </div>
  <div class="opts">
    <label>Mode<select data-f="size">${[[11, '11-a-side'], [7, '7-a-side'], [5, '5-a-side street cage']].map(([v, n]) => `<option value="${v}" ${+s.size === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>Match length<select data-f="minutes">${[2, 3, 4, 5, 6, 8, 10].map((m) => `<option value="${m}" ${+s.minutes === m ? 'selected' : ''}>${m * 2} minutes</option>`).join('')}</select></label>
    <label>Difficulty<select data-f="difficulty">${diffOptions(s.difficulty)}</select></label>
    <label>Time of day<select data-f="time">${[['day', 'Day'], ['dusk', 'Sunset'], ['night', 'Night (floodlights)']].map(([x, n]) => `<option value="${x}" ${S.time === x ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>Weather<select data-f="weather">${[['clear', 'Clear'], ['rain', 'Rain']].map(([x, n]) => `<option value="${x}" ${S.weather === x ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  </div>
  <div class="menu row"><button data-act="toSides" class="primary big" autofocus>Choose controllers ›</button></div>`, null, 'home');
  app.querySelectorAll('select').forEach((el) => el.addEventListener('change', () => {
    const f = el.dataset.f, v = el.value;
    if (f === 'home' || f === 'away' || f === 'hf' || f === 'af') s[f] = v;
    else if (f === 'size') { s.size = +v; s.hf = s.af = DEFAULT_FORMATION[s.size]; S.size = s.size; if (s.size === 5) { s.home = teamsOf('street')[0].id; s.away = teamsOf('street')[1].id; } }
    else if (f === 'minutes') { s.minutes = +v; S.minutes = +v; }
    else if (f === 'difficulty') { s.difficulty = v; S.difficulty = v; }
    else S[f] = v;
    saveSettings(); renderSetup();
  }));
}
function teamCard(side, label, T, form, size) {
  const st = teamStats(T), bar = (n, v) => `<div class="stat"><span>${n}</span><i style="--v:${v}%"></i><b>${v}</b></div>`;
  return `<div class="team" style="--kit:${T.kit.primary};--kit2:${T.kit.secondary}">
    <div class="tside">${label}</div>
    <div class="tcrest">${shirt(T.kit)}</div>
    <div class="tname"><button class="iconbtn sm" data-act="prevTeam" data-side="${side}" aria-label="Previous team">◀</button><b>${esc(T.name)}</b><button class="iconbtn sm" data-act="nextTeam" data-side="${side}" aria-label="Next team">▶</button></div>
    <div class="tmeta">${esc(T.kind === 'nation' ? 'National team' : T.city)} · <span class="stars">${stars(st.stars)}</span> · OVR ${st.ovr}</div>
    ${bar('ATT', st.att)}${bar('MID', st.mid)}${bar('DEF', st.def)}
    <label>Team<select data-f="${side}">${teamOptions(T.id)}</select></label>
    <label>Formation<select data-f="${side === 'home' ? 'hf' : 'af'}">${formationOptions(size, form)}</select></label></div>`;
}

// --------------------------------------------------------------- controller select
// Every controller starts in the middle (AI vs AI). Push left for the home team,
// right for the away team, press Start/A (or the button) to kick off.
let sides = new Map();
function controllerSelect(opts = {}) {
  const lock = opts.lockTeam;  // tournaments: humans may only join the student's team
  const draw = () => {
    const list = input.list().filter((c) => c.kind !== 'keyboard' || input.usedKeys[c.id] || c.id === 'k1');
    const H = teamById(setup.home), A = teamById(setup.away);
    const rows = list.map((c, i) => {
      const s = sides.get(c.id) || 0;
      return `<div class="crow"><div class="slot ${s === -1 ? 'on' : ''}">${s === -1 ? pill(c, i) : ''}</div><div class="slot mid">${s === 0 ? pill(c, i) : ''}</div><div class="slot ${s === 1 ? 'on' : ''}">${s === 1 ? pill(c, i) : ''}</div></div>`;
    }).join('');
    $('#crows').innerHTML = rows || '<p>No controllers yet.</p>';
    $('#cfoot').textContent = `${[...sides.values()].filter((v) => v).length} human player(s) · ${list.length} controller(s) seen`;
    if (net && net.role === 'host') net.api.broadcast({ t: 'lobby', teams: [H.name, A.name], rows: list.map((c) => ({ name: c.name, side: sides.get(c.id) || 0 })) });
    function pill(c, i) { return `<button class="pill" data-act="cycle" data-id="${esc(c.id)}" style="--c:${COLORS[i % COLORS.length]}">${icon(c.kind)} ${esc(c.name)}</button>`; }
  };
  const H = teamById(setup.home), A = teamById(setup.away);
  screen(`${header('Choose your side', opts.back || 'quick')}
    <div class="sidehead"><div style="--kit:${H.kit.primary};--ink:${readable(H.kit.primary)}" class="tag">${esc(H.name)}</div><div class="tag mid">AI</div><div class="tag" style="--kit:${A.kit.primary};--ink:${readable(A.kit.primary)}">${esc(A.name)}</div></div>
    <div id="crows" class="crows"></div><p id="cfoot" class="foot"></p>
    <p class="hint">Push ◀ for ${esc(H.short)}, ▶ for ${esc(A.short)} · click a controller to cycle · press Start (or A on a gamepad in the middle) to kick off</p>
    <div class="menu row"><button data-act="kick" class="primary" autofocus>Kick off ⚽</button></div>`, (events) => {
    let changed = false;
    for (const e of events) {
      const cur = sides.get(e.id) || 0;
      if (e.act === 'left' || e.act === 'right') {
        let n = Math.max(-1, Math.min(1, cur + (e.act === 'left' ? -1 : 1)));
        if (lock != null && n !== 0 && n !== lock) n = 0;
        sides.set(e.id, n); changed = true;
      } else if (e.act === 'start' || (e.act === 'ok' && e.id[0] === 'g')) { ACTIONS.kick(); return; }
      else if (e.act === 'back' && e.id[0] === 'g') { app.querySelector('.crumb [data-act]')?.click(); return; }
    }
    if (changed || (performance.now() - (draw.t || 0) > 500)) { draw.t = performance.now(); draw(); }
  });
  ACTIONS.cycle = (d) => { const cur = sides.get(d.id) || 0; let n = cur === 0 ? -1 : cur === -1 ? 1 : 0; if (lock != null && n !== 0 && n !== lock) n = n === -1 ? lock : 0; sides.set(d.id, n); draw(); };
  if (lock != null && !sides.size) sides.set(pads()[0] ? pads()[0].id : 'k1', lock);
  draw();
}
const icon = (k) => ({ keyboard: '⌨', gamepad: '🎮', touch: '📱', remote: '🌐' })[k] || '🎮';

// --------------------------------------------------------------- match
let game = null;
function startMatch(extra = {}) {
  const H = teamById(setup.home), A = teamById(setup.away);
  const humans = [];
  let i = 0;
  for (const c of input.list()) {
    const s = sides.get(c.id) || 0;
    if (!s) continue;
    humans.push({ id: c.id, team: s < 0 ? 0 : 1, color: COLORS[input.list().findIndex((x) => x.id === c.id) % COLORS.length], label: c.kind === 'remote' ? c.name.slice(0, 6) : 'P' + (++i) });
  }
  const m = new Match({ home: H, away: A, size: setup.size, homeFormation: setup.hf, awayFormation: setup.af, minutes: setup.minutes, difficulty: setup.difficulty, knockout: !!setup.knockout, humans, seed: Date.now() });
  runGame({ match: m, stadium: stadiumFor(H, setup.size === 5 ? 'street' : ''), ...extra });
}
function makeRenderer(cv, g) {
  const opts = { camera: S.camera, quality: S.quality, time: S.time, weather: S.weather, stadium: g.stadium };
  if (S.camera !== 'top' && webglOK()) { try { return new Renderer3D(cv, opts); } catch (e) { console.warn('3D unavailable', e); } }
  return new Renderer(cv, { ...opts, quality: 1, camera: 'top', hud: false });
}
function runGame(g) {
  input.inGame = true; screenTick = null;
  stopBackground();
  app.innerHTML = `<div class="game"><canvas id="cv"></canvas>
    <div class="hud"><div class="bug"><i class="hk"></i><span class="hn"></span><b class="sc">0 - 0</b><span class="an"></span><i class="ak"></i><span class="clk">00:00</span></div>
    <div class="banner" id="banner"></div><canvas class="radar" id="radar" width="220" height="142"></canvas><div class="netst" id="netst"></div></div><div id="ov"></div></div>`;
  const cv = $('#cv');
  game = { ...g, rd: makeRenderer(cv, g), acc: 0, last: performance.now(), paused: false, sendT: 0, inT: 0, hud: {} };
  if (isTouch) touchControls($('.game'), input);
  sound.unlock();
  const frame = (now) => {
    if (!game) return;
    const dt = Math.min(0.1, (now - game.last) / 1000); game.last = now;
    const m = game.match;
    if (m) {
      const ev = input.menuEvents();
      if (ev.some((e) => e.act === 'start') && !net && !game.done) togglePause();
      if (game.paused) menuNav(ev.filter((e) => e.id[0] !== 'k'));
      else {
        for (const h of m.humans) m.setInput(h.id, input.read(h.id));
        game.acc += dt;
        while (game.acc >= DT) { m.step(DT); game.acc -= DT; }
        const events = m.takeEvents();
        const v = m.view();
        sound.events(events, v, m.humans.map((h) => h.team));
        sound.crowd(excitement(v), dt);
        if (net && net.role === 'host') {
          game.sendT -= dt;
          if (game.sendT <= 0) { game.sendT = 0.05; net.api.broadcast(m.snapshot()); }
          if (events.length) net.api.broadcast({ t: 'ev', e: events.filter((x) => x.type !== 'bounce') });
        }
        game.rd.draw(v, dt, {});
        updateHud(v, net ? `${net.kind.toUpperCase()} · ${net.api.peers ? net.api.peers.size : 0} guest(s)` : '');
        if (m.over && !game.done) { game.done = true; setTimeout(() => fullTime(m), 2600); }
      }
    } else if (game.view) {
      smooth(game, dt);
      game.rd.draw(game.view, dt, {});
      updateHud(game.view, 'Guest');
      game.inT -= dt;
      if (game.inT <= 0) { game.inT = 1 / 30; sendPads(); }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  if (net && net.role === 'host' && g.match) net.api.broadcast(g.match.setup());
}
function updateHud(v, status) {
  const h = game.hud, el = (k, sel) => h[k] || (h[k] = $(sel));
  const t = v.teams;
  if (!h.init) {
    h.init = true;
    el('hn', '.hud .hn').textContent = t[0].short; el('an', '.hud .an').textContent = t[1].short;
    el('hk', '.hud .hk').style.background = t[0].kit.primary; el('ak', '.hud .ak').style.background = t[1].kit.primary;
  }
  const sc = `${v.score[0]} - ${v.score[1]}`;
  if (h.sc !== sc) { h.sc = sc; el('scEl', '.hud .sc').textContent = sc; }
  const min = Math.floor(v.clock / 60), clk = `${String(min).padStart(2, '0')}:${String(Math.floor(v.clock % 60)).padStart(2, '0')}`;
  if (h.clk !== clk) { h.clk = clk; el('clkEl', '.hud .clk').textContent = clk; }
  const bn = v.banner || '';
  if (h.bn !== bn) { h.bn = bn; const b = el('bnEl', '#banner'); b.textContent = bn; b.className = 'banner' + (bn ? ' on' : '') + (/GOAL/.test(bn) ? ' goal' : ''); }
  if (h.st !== status) { h.st = status; el('stEl', '#netst').textContent = status; }
  h.n = (h.n || 0) + 1;
  if (h.n % 3 === 0) drawRadar(el('rdEl', '#radar'), v);
}
function drawRadar(c, v) {
  if (!c) return;
  const g = c.getContext('2d'), w = c.width, hh = c.height, pad = 6;
  g.clearRect(0, 0, w, hh);
  g.fillStyle = 'rgba(8,20,12,0.55)'; g.fillRect(0, 0, w, hh);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; g.strokeRect(pad, pad, w - 2 * pad, hh - 2 * pad);
  g.beginPath(); g.moveTo(w / 2, pad); g.lineTo(w / 2, hh - pad); g.stroke();
  g.beginPath(); g.arc(w / 2, hh / 2, 12, 0, 7); g.stroke();
  const X = (x) => pad + (x / v.L) * (w - 2 * pad), Y = (y) => pad + (1 - y / v.W) * (hh - 2 * pad);
  for (const p of v.players) {
    const hu = p.human != null ? v.humans.find((o) => o.id === p.human) : null;
    g.fillStyle = hu ? hu.color : v.teams[p.team].kit.primary; g.strokeStyle = 'rgba(0,0,0,.6)';
    g.beginPath(); g.arc(X(p.x), Y(p.y), hu ? 4.5 : 3.2, 0, 7); g.fill(); g.stroke();
  }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(X(v.ball.x), Y(v.ball.y), 2.6, 0, 7); g.fill();
}
function excitement(v) {
  const b = v.ball, near = Math.min(Math.abs(b.x), Math.abs(v.L - b.x)) / (v.L / 2);
  return v.phase === 'goal' ? 1 : Math.max(0.1, 1 - near) * 0.8;
}
function togglePause() {
  game.paused = !game.paused;
  const ov = $('#ov');
  if (!game.paused) { ov.innerHTML = ''; return; }
  ov.innerHTML = `<div class="pause"><h2>PAUSED</h2><div class="menu">
    <button data-act="resume" autofocus>Resume</button>
    <label>Camera<select id="camsel">${CAMERAS3D.map((c) => `<option value="${c.id}" ${S.camera === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></label>
    <button data-act="fs">Full screen</button>
    <button data-act="quitMatch" class="ghost">Quit match</button></div><p class="hint">${esc(KEY_HELP.pad)}</p></div>`;
  $('#camsel').addEventListener('change', (e) => {
    const was3d = S.camera !== 'top';
    S.camera = e.target.value; saveSettings();
    if (was3d !== (S.camera !== 'top')) {
      if (game.rd.dispose) game.rd.dispose();
      const old = $('#cv'), cv = document.createElement('canvas'); cv.id = 'cv'; old.replaceWith(cv);
      game.rd = makeRenderer(cv, game);
      if (game.match) game.rd.draw(game.match.view(), 0, {});
    } else game.rd.cam = S.camera;
  });
  $('#ov button').focus();
}
function fullTime(m) {
  const st = m.stats, t = m.teams;
  const total = st[0].poss + st[1].poss || 1;
  const row = (label, a, b) => { const sum = (+a || 0) + (+b || 0) || 1; return `<div class="srow"><b>${a}</b><div class="sbar"><i style="width:${((+a || 0) / sum) * 100}%;background:${m.kits[0].primary}"></i><i style="width:${((+b || 0) / sum) * 100}%;background:${m.kits[1].primary}"></i></div><b>${b}</b><span>${label}</span></div>`; };
  const scorers = (i) => st[i].goals.map((g) => `⚽ ${esc(g.name)} ${g.minute}'`).join('<br>') || '&nbsp;';
  const after = game.onEnd;
  $('#ov').innerHTML = `<div class="pause wide"><span class="kicker">FULL TIME</span>
    <div class="final"><div>${shirt(m.kits[0])}<span>${esc(t[0].name)}</span></div><b>${m.score[0]} - ${m.score[1]}</b><div>${shirt(m.kits[1])}<span>${esc(t[1].name)}</span></div></div>
    ${m.pens ? `<p class="hint">Penalties ${m.pens.kicks[0].filter(Boolean).length} - ${m.pens.kicks[1].filter(Boolean).length}</p>` : ''}
    <div class="scorers"><div>${scorers(0)}</div><div>${scorers(1)}</div></div>
    <div class="stats">${row('Possession %', Math.round((st[0].poss / total) * 100), Math.round((st[1].poss / total) * 100))}${row('Shots', st[0].shots, st[1].shots)}${row('On target', st[0].onTarget, st[1].onTarget)}${row('Passes', st[0].passes, st[1].passes)}${row('Tackles won', st[0].tackles, st[1].tackles)}${row('Saves', st[0].saves, st[1].saves)}</div>
    <div class="menu row">${after ? '<button data-act="afterMatch" class="primary" autofocus>Continue ›</button>' : '<button data-act="rematch" class="primary" autofocus>Rematch</button><button data-act="endMatch">Main menu</button>'}</div></div>`;
  if (net && net.role === 'host') net.api.broadcast({ t: 'end', score: m.score });
  $('#ov button').focus();
  game.paused = true;
}

// --------------------------------------------------------------- tournaments
let cup = null;
function cups() {
  currentTab = 'cups';
  const saved = Cup.saved();
  const byRegion = {};
  for (const c of competitions()) (byRegion[c.region] = byRegion[c.region] || []).push(c);
  screen(`${header('Tournaments', 'home')}
    ${saved.length ? `<h3>Continue</h3><div class="menu grid">${saved.map((t) => `<button class="tile" data-act="resumeCup" data-id="${t.id}"><b>${esc(t.name)}</b><span>${esc(teamById(t.team).name)} · ${t.champion ? 'finished' : t.out ? 'eliminated' : 'in progress'}</span></button>`).join('')}</div>` : ''}
    ${Object.entries(byRegion).map(([r, list]) => `<h3>${esc(r)}</h3><div class="menu grid">${list.map((c) => `<button class="tile" data-act="pickCup" data-id="${c.id}"><b>${esc(c.name)}</b><span>${c.kind === 'league' ? 'League' : c.kind === 'groups' ? 'Groups + knockout' : 'Knockout cup'} · ${c.teams.length} teams</span></button>`).join('')}</div>`).join('')}`);
}
function pickCup(id) {
  const c = competitionById(id);
  const teams = c.teams.map(teamById).sort((a, b) => b.strength - a.strength);
  screen(`${header(c.name, 'cups')}
    <div class="opts"><label>Your team<select id="cteam">${teams.map((t) => `<option value="${t.id}">${esc(t.name)} · ${t.strength}</option>`).join('')}</select></label>
    <label>Difficulty<select id="cdiff">${diffOptions(S.difficulty)}</select></label>
    <label>Half length<select id="cmin">${[2, 3, 4, 5, 6].map((m) => `<option value="${m}" ${S.minutes === m ? 'selected' : ''}>${m * 2} min match</option>`).join('')}</select></label></div>
    <div class="menu row"><button class="primary" data-act="newCup" data-id="${c.id}" autofocus>Start ${esc(c.name)} ›</button></div>`);
}
function hub() {
  const t = cup, me = teamById(t.team), next = Cup.nextMatch(t);
  const table = (ids) => `<table class="table"><tr><th></th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>${Cup.standings(t, ids).map((r, i) => `<tr class="${r.id === t.team ? 'me' : ''}"><td>${i + 1}</td><td>${esc(teamById(r.id).name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</table>`;
  const ko = t.fixtures.filter((f) => f.stage === 'ko');
  const rounds = [...new Set(ko.map((f) => f.round))];
  const status = t.champion ? (t.champion === t.team ? `🏆 ${esc(me.name)} are champions!` : `Champions: ${esc(teamById(t.champion).name)}`) : t.out ? `${esc(me.name)} are out.` : next ? `Next: ${esc(Cup.roundName(t, next))} · ${esc(teamById(next.home).name)} v ${esc(teamById(next.away).name)}` : '';
  screen(`${header(t.name, 'cups')}<p class="status">${status}</p>
    <div class="menu row">${next ? '<button class="primary" data-act="playCup" autofocus>Play match ›</button><button data-act="simCup">Simulate match</button>' : ''}${!t.champion && !next ? '<button data-act="simRound" class="primary">Simulate next round ›</button>' : ''}<button data-act="delCup" class="ghost">Delete</button></div>
    <div class="hubcols">
      ${t.stage === 'league' || t.kind === 'league' ? `<div><h3>Table</h3>${table()}</div>` : ''}
      ${t.groups.length ? `<div><h3>Groups</h3><div class="groups">${t.groups.map((g, i) => `<div><h4>Group ${String.fromCharCode(65 + i)}</h4>${table(g)}</div>`).join('')}</div></div>` : ''}
      ${rounds.length ? `<div><h3>Knockout</h3><div class="bracket">${rounds.map((r) => `<div class="kr"><h4>${esc(Cup.roundName(t, ko.find((f) => f.round === r)))}</h4>${ko.filter((f) => f.round === r).map((f) => `<div class="tie ${[f.home, f.away].includes(t.team) ? 'me' : ''}"><span>${esc(teamById(f.home).short)}</span><b>${f.result ? f.result.score.join('-') + (f.result.pens ? ` (${f.result.pens.join('-')}p)` : '') : 'v'}</b><span>${esc(teamById(f.away).short)}</span></div>`).join('')}</div>`).join('')}</div></div>` : ''}
      <div><h3>Results</h3><ul class="log">${t.log.slice(-12).reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>
    </div>`);
}

// --------------------------------------------------------------- multiplayer
function lanMenu() {
  if (env.kind === 'lan') return lanJoin(location.origin.replace(/^http/, 'ws') + '/ws', env.info.needPass);
  const desktop = env.kind === 'desktop';
  screen(`${header('LAN · Wi-Fi · Hotspot', 'home')}
    <div class="cols">
      <div class="card"><h3>Host a game</h3>${desktop ? `<p>Other computers and phones on this network join you. With "Make a hotspot" this computer creates its own Wi-Fi, so no router or internet is needed.</p>
        <label>Your name<input id="hname" value="${esc(S.name || 'Host')}" maxlength="16"></label>
        <label>Password (optional)<input id="hpass" type="password" maxlength="32" placeholder="none"></label>
        <label class="check"><input id="hspot" type="checkbox"> Make a hotspot on this computer</label>
        <div class="menu row"><button class="primary" data-act="lanHost">Host ›</button><button class="ghost" data-act="fw">Allow through firewall</button></div><p class="hint">If others cannot connect (Windows treats a hotspot as a public network), press "Allow through firewall" once.</p>` : '<p>Hosting needs the Self-Study Football desktop app (Windows, macOS or Linux). Phones and browsers can join.</p>'}</div>
      <div class="card"><h3>Join a game</h3><p>Type the address the host shows, e.g. 192.168.137.1:47900</p>
        <div id="found" class="found"></div>
        <label>Host address<input id="jaddr" placeholder="192.168.1.20:47900"></label>
        <label>Your name<input id="jname" value="${esc(S.name || 'Player')}" maxlength="16"></label>
        <label>Password<input id="jpass" type="password" maxlength="32"></label>
        <div class="menu row"><button data-act="lanJoinBtn" class="primary">Join ›</button></div></div>
    </div>`);
  if (desktop) env.api.lan.discover().then((list) => {
    const el = $('#found'); if (!el || !list.length) return;
    el.innerHTML = '<p>Found on this network:</p>' + list.map((h) => `<button class="ghost" data-act="fill" data-addr="${esc(h.address)}:${h.port}">${esc(h.name)} · ${esc(h.address)}${h.needPass ? ' 🔒' : ''}</button>`).join('');
  }).catch(() => {});
}
async function hostLobby(kind) {
  if (!setup) quick();
  sides = new Map();
  if (kind === 'lan') {
    const name = $('#hname').value.trim() || 'Host', pass = $('#hpass').value, spot = $('#hspot').checked;
    S.name = name; saveSettings();
    let info;
    try {
      if (spot) {
        screen(`${header('Starting the hotspot…')}<p class="status">Creating the Wi-Fi network…</p>`);
        await env.api.hotspot.start();
      }
      info = await env.api.lan.start({ name, password: pass });
    } catch (e) { return notice('Could not host', e.message || String(e), 'lan'); }
    const api = lanHost(`ws://127.0.0.1:${info.port}/ws`, info.hostKey);
    net = { role: 'host', kind: 'lan', api, info };
    wireHost(api);
    api.onOpen = () => lobbyScreen();
  } else {
    const sig = signaller(env);
    try {
      screen(`${header('Online')}<p class="status">Creating your invite…</p>`);
      const api = await rtcHost(sig, S.name || 'Host');
      net = { role: 'host', kind: 'online', api };
      wireHost(api);
      lobbyScreen();
    } catch (e) { return notice('Could not create an invite', e.code === 'NO_TOKEN' || e.status === 401 ? 'Sign in first (Online → Sign in).' : e.message, 'online'); }
  }
}
function wireHost(api) {
  api.onPeer = (peer, name, joined) => {
    if (!joined) input.dropRemote('r:' + peer + ':');
    if (!game && $('#lobbyMark')) lobbyScreen();
    if (joined && game && game.match) api.send(peer, game.match.setup());
  };
  api.onMessage = (peer, m) => {
    if (m.t === 'pads') for (const [id, st] of Object.entries(m.pads || {})) input.setRemote(`r:${peer}:${id}`, `${String(m.name || 'Guest').slice(0, 12)} ${st.n || ''}`.trim(), st);
  };
}
function lobbyScreen() {
  if (!net || net.role !== 'host') return;
  const n = net.api.peers ? net.api.peers.size : 0;
  const where = net.kind === 'lan'
    ? `<p>Players join at <b>${net.info.addresses.map((a) => `${esc(a)}:${net.info.port}`).join('</b> or <b>')}</b>${net.info.hotspot ? ` · Wi-Fi <b>${esc(net.info.hotspot.ssid)}</b> password <b>${esc(net.info.hotspot.password)}</b>` : ''}${net.info.password ? ' · password protected' : ''}.<br>Phones: open <b>http://${esc(net.info.addresses[0] || '')}:${net.info.port}</b> in a browser.</p>`
    : `<p>Send this link to your friend:</p><div class="link"><input readonly id="ilink" value="${esc(inviteLink(net.api.room, net.api.secret))}"><button data-act="copyLink">Copy</button></div>`;
  screen(`${header(net.kind === 'lan' ? 'LAN lobby' : 'Online lobby', 'leaveNet')}${where}
    <p class="status" id="lobbyMark">${n} guest(s) connected</p><ul class="log">${[...(net.api.peers || new Map()).values()].map((p) => `<li>🌐 ${esc(p)}</li>`).join('')}</ul>
    <div class="menu row"><button data-act="quickNet" class="primary" autofocus>Pick teams ›</button></div>`);
}
async function lanJoin(url, needPass) {
  const name = (($('#jname') && $('#jname').value) || S.name || 'Player').trim();
  const pass = $('#jpass') ? $('#jpass').value : (needPass ? prompt('Password') || '' : '');
  const api = lanGuest(url, name, pass);
  guestWire(api, 'lan', name);
}
async function onlineJoin(code) {
  const inv = parseInvite(code);
  if (!inv) return notice('That is not an invite link', 'Paste the whole link your friend sent.', 'online');
  const sig = signaller(env);
  screen(`${header('Joining…', 'home')}<p class="status">Connecting to your friend…</p>`);
  try { const api = await rtcGuest(sig, inv.room, inv.secret, S.name || 'Guest'); guestWire(api, 'online', S.name || 'Guest'); }
  catch (e) { notice('Could not join', e.status === 404 ? 'This invite has expired or the host closed the game.' : e.status === 401 ? 'Sign in first.' : e.message, 'online'); }
}
function guestWire(api, kind, name) {
  net = { role: 'guest', kind, api, name };
  api.onOpen = () => { screen(`${header('Connected', 'leaveNet')}<p class="status">Waiting for the host to pick teams… Push ◀ / ▶ on your controller when the host shows the side screen.</p><div id="globby"></div>`); sendPadsLoop(); };
  api.onClose = (why) => { if (net && net.api === api) { net = null; game = null; notice('Disconnected', why || 'The host is gone.', 'home'); } };
  api.onMessage = (m) => {
    if (m.t === 'lobby') {
      const el = $('#globby'); if (el) el.innerHTML = `<div class="sidehead"><div class="tag">${esc(m.teams[0])}</div><div class="tag mid">AI</div><div class="tag">${esc(m.teams[1])}</div></div>` + m.rows.map((r) => `<div class="crow"><div class="slot">${r.side === -1 ? esc(r.name) : ''}</div><div class="slot mid">${r.side === 0 ? esc(r.name) : ''}</div><div class="slot">${r.side === 1 ? esc(r.name) : ''}</div></div>`).join('');
    } else if (m.t === 'setup') {
      runGame({ match: null, stadium: stadiumFor(null), setupMsg: m });
      game.setup = m;
    } else if (m.t === 's' && game && game.setup) {
      const v = viewFrom(game.setup, m);
      game.target = v; if (!game.view) game.view = v;
    } else if (m.t === 'ev' && game && game.view) { sound.events(m.e, game.view, []); sound.crowd(excitement(game.view)); }
    else if (m.t === 'end' && game) { $('#ov').innerHTML = `<div class="pause"><h2>Full time ${m.score.join(' - ')}</h2><p class="hint">Waiting for the host…</p><button data-act="leaveNet">Leave</button></div>`; }
    else if (m.t === 'menu') { game = null; screen(`${header('Connected', 'leaveNet')}<p class="status">The host is choosing the next game…</p><div id="globby"></div>`); sendPadsLoop(); }
  };
}
function sendPads() {
  if (!net || net.role !== 'guest') return;
  const pads = {};
  for (const c of input.list()) {
    if (c.kind === 'remote') continue;
    if (c.kind === 'keyboard' && !input.usedKeys[c.id]) continue;
    const s = input.read(c.id);
    pads[c.id] = { ...s, n: c.kind === 'keyboard' ? '⌨' : c.kind === 'touch' ? '📱' : '🎮' + c.id.slice(1) };
  }
  net.api.send({ t: 'pads', name: net.name, pads });
}
function sendPadsLoop() { if (!net || net.role !== 'guest' || game) return; sendPads(); setTimeout(sendPadsLoop, 60); }
function smooth(g, dt) {
  const v = g.view, t = g.target;
  if (!t) return;
  const k = Math.min(1, dt * 14);
  for (let i = 0; i < v.players.length; i++) {
    const a = v.players[i], b = t.players[i];
    if (Math.hypot(a.x - b.x, a.y - b.y) > 6) { a.x = b.x; a.y = b.y; } else { a.x += (b.x - a.x) * k; a.y += (b.y - a.y) * k; }
    Object.assign(a, { fx: b.fx, fy: b.fy, anim: b.anim, action: b.action, dive: b.dive, human: b.human });
  }
  const bk = Math.min(1, dt * 18);
  v.ball.x += (t.ball.x - v.ball.x) * bk; v.ball.y += (t.ball.y - v.ball.y) * bk; v.ball.z += (t.ball.z - v.ball.z) * bk;
  Object.assign(v, { score: t.score, clock: t.clock, half: t.half, phase: t.phase, banner: t.banner, pens: t.pens, humans: t.humans });
}

async function onlineMenu() {
  const acct = env.kind === 'desktop' ? await env.api.account.status().catch(() => ({ signedIn: false })) : await env.api.user();
  const signed = acct && acct.signedIn;
  screen(`${header('Online with a friend', 'home')}
    ${signed ? `<p class="status">Signed in as ${esc(acct.username || '')}</p>` : env.kind === 'desktop'
    ? `<div class="card"><h3>Sign in with your SelfStudyJo account</h3><label>Username or email<input id="lu" autocomplete="username"></label><label>Password<input id="lp" type="password" autocomplete="current-password"></label><div class="menu row"><button class="primary" data-act="login">Sign in</button></div><p class="hint">Free with any account. Offline and LAN play need no account.</p></div>`
    : '<div class="card"><p>Sign in on SelfStudyJo to play online. Offline and LAN play need no account.</p><button class="primary" data-act="webLogin">Sign in</button></div>'}
    <div class="cols"><div class="card"><h3>Invite a friend</h3><p>You host; your friend opens the link (in the app or on selfstudyjo.com).</p><button class="primary" data-act="onlineHost" ${signed ? '' : 'disabled'}>Create invite link ›</button></div>
    <div class="card"><h3>Join with a link</h3><input id="ijoin" placeholder="Paste the invite link"><div class="menu row"><button data-act="onlineJoinBtn" ${signed ? '' : 'disabled'}>Join ›</button></div></div></div>`);
}

// --------------------------------------------------------------- settings
function settings() {
  currentTab = 'settings';
  const voices = sound.comm.list();
  screen(`${header('Settings')}<div class="opts col">
    <label>Your name<input id="sname" value="${esc(S.name)}" maxlength="16"></label>
    <label>Graphics quality<select id="sq">${Object.entries(QUALITY).map(([k, q]) => `<option value="${k}" ${S.quality === k ? 'selected' : ''}>${q.label}</option>`).join('')}</select></label>
    <label>Camera<select id="scam">${CAMERAS3D.map((c) => `<option value="${c.id}" ${S.camera === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></label>
    <label>Commentary voice<select id="svoice"><option value="auto">Best available (automatic)</option>${voices.map((v) => `<option value="${esc(v.voiceURI)}" ${S.voice === v.voiceURI ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
    <label>Volume<input id="svol" type="range" min="0" max="1" step="0.05" value="${S.volume}"></label>
    <label class="check"><input id="ssnd" type="checkbox" ${S.sound ? 'checked' : ''}> Sound and crowd</label>
    <label class="check"><input id="scom" type="checkbox" ${S.commentary ? 'checked' : ''}> Commentary</label>
    ${env.kind === 'desktop' ? `<label class="check"><input id="sfs" type="checkbox" ${S.fullscreen ? 'checked' : ''}> Start in full screen</label>` : ''}
    <p class="hint">${webglOK() ? '3D graphics are available on this device.' : 'This device has no 3D graphics (WebGL): the 2D camera is used.'} For the most natural commentary use Windows 11, macOS or the Edge/Chrome browser, which have natural-sounding voices.</p>
  </div><div class="menu row"><button class="ghost" data-act="testVoice">▶ Test commentary</button><button class="primary" data-act="saveSettings" autofocus>Save</button></div>`, null, 'settings');
}
function controls() {
  currentTab = 'controls';
  screen(`${header('Controls', 'home')}<div class="cols">
    <div class="card"><h3>🎮 Gamepad</h3><p>${esc(KEY_HELP.pad)}</p><p>Defending: A/✕ press, B/○ tackle, X/□ slide, LB/L1 switch player.</p><p>Any USB, Bluetooth or wireless pad your system recognises works. One device reads up to 4 pads; more players join from other devices on the LAN or online.</p></div>
    <div class="card"><h3>⌨ Keyboard (left player)</h3><p>${esc(KEY_HELP.k1)}</p></div><div class="card"><h3>⌨ Keyboard (right player)</h3><p>${esc(KEY_HELP.k2)}</p></div>
    <div class="card"><h3>📱 Touch</h3><p>A stick on the left and A B X Y RT LB on the right appear in a match on a phone or tablet.</p></div></div>
    <p class="foot">Connected now: ${input.list().map((c) => esc(c.name)).join(' · ')}</p>`);
}
function notice(title, text, back) { screen(`${header(title, back || 'home')}<p class="status">${esc(text)}</p><div class="menu row"><button data-act="${back || 'home'}" autofocus>OK</button></div>`); }

// --------------------------------------------------------------- actions
const ACTIONS = {
  home: () => { leaveNet(); home(); }, multi, fs: () => toggleFs(),
  featured: () => { quick(); if (featured) { setup.home = featured[0]; setup.away = featured[1]; renderSetup(); } },
  prevTeam: (d) => cycleTeam(d.side, -1), nextTeam: (d) => cycleTeam(d.side, 1),
  testVoice: () => { sound.unlock(); sound.comm.setVoice($('#svoice').value); sound.comm.enabled = true; sound.comm.say('GOAL! What a strike, and the stadium is on its feet!', { prio: 3, excite: 1 }); sound.comm.say('Clinical. You give him a sight of goal and he punishes you.', { co: true, prio: 2, ttl: 12 }); }, quick: () => quick(), street: () => quick(5), cups, local: () => { setup = null; quick(); },
  lan: lanMenu, online: onlineMenu, settings, controls,
  swap: () => { [setup.home, setup.away] = [setup.away, setup.home]; [setup.hf, setup.af] = [setup.af, setup.hf]; renderSetup(); },
  random: () => { const pool = allTeams().filter((t) => (setup.size === 5 ? t.kind === 'street' : t.kind !== 'street')); const a = pool[Math.floor(Math.random() * pool.length)]; let b; do { b = pool[Math.floor(Math.random() * pool.length)]; } while (b === a); setup.home = a.id; setup.away = b.id; renderSetup(); },
  toSides: () => controllerSelect(),
  kick: () => { const after = setup.onEnd; startMatch(after ? { onEnd: after } : {}); },
  resume: () => togglePause(),
  quitMatch: () => { game = null; if (net && net.role === 'host') { net.api.broadcast({ t: 'menu' }); lobbyScreen(); } else home(); },
  rematch: () => { game = null; startMatch(); },
  endMatch: () => { game = null; if (net && net.role === 'host') { net.api.broadcast({ t: 'menu' }); lobbyScreen(); } else home(); },
  afterMatch: () => { const f = game.onEnd; const m = game.match; game = null; f(m); },
  pickCup: (d) => pickCup(d.id),
  newCup: (d) => { cup = Cup.createTournament(d.id, $('#cteam').value, { difficulty: $('#cdiff').value, minutes: +$('#cmin').value }); Cup.save(cup); hub(); },
  resumeCup: (d) => { cup = Cup.saved().find((t) => t.id === d.id); hub(); },
  delCup: () => { Cup.remove(cup.id); cups(); },
  simRound: () => { Cup.simulateRound(cup); Cup.save(cup); hub(); },
  simCup: () => { const f = Cup.nextMatch(cup); Cup.record(cup, f, quickResultFor(f)); Cup.save(cup); hub(); },
  playCup: () => {
    const f = Cup.nextMatch(cup);
    setup = { size: cup.size, home: f.home, away: f.away, hf: DEFAULT_FORMATION[cup.size], af: DEFAULT_FORMATION[cup.size], minutes: cup.minutes, difficulty: cup.difficulty, knockout: f.stage === 'ko',
      onEnd: (m) => { Cup.record(cup, f, { score: m.score, pens: m.pens ? m.pens.kicks.map((k) => k.filter(Boolean).length) : null }); Cup.save(cup); hub(); } };
    sides = new Map();
    controllerSelect({ lockTeam: f.home === cup.team ? -1 : 1, back: 'hubBack' });
  },
  hubBack: () => hub(),
  cups2: cups,
  lanHost: () => hostLobby('lan'),
  lanJoinBtn: () => { let a = $('#jaddr').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); if (!a) return; if (!/:\d+$/.test(a)) a += ':47900'; S.name = $('#jname').value.trim(); saveSettings(); lanJoin(`ws://${a}/ws`); },
  fill: (d) => { $('#jaddr').value = d.addr; },
  fw: async () => { try { const r = await env.api.lan.firewall(); notice('Firewall', r.note || 'Self-Study Football may now accept players on every network.', 'lan'); } catch (e) { notice('Firewall', e.message, 'lan'); } },
  onlineHost: () => hostLobby('online'),
  onlineJoinBtn: () => onlineJoin($('#ijoin').value),
  login: async () => { try { await env.api.account.login($('#lu').value.trim(), $('#lp').value); onlineMenu(); } catch (e) { notice('Sign-in failed', e.message || 'Check your username and password.', 'online'); } },
  webLogin: () => env.api.login(),
  copyLink: () => { const el = $('#ilink'); el.select(); navigator.clipboard?.writeText(el.value).catch(() => document.execCommand('copy')); },
  quickNet: () => { quick(); },
  leaveNet: () => { leaveNet(); home(); },
  saveSettings: () => {
    S.name = $('#sname').value.trim(); S.camera = $('#scam').value; S.quality = $('#sq').value; S.volume = +$('#svol').value; S.sound = $('#ssnd').checked; S.commentary = $('#scom').checked; S.voice = $('#svoice').value;
    if ($('#sfs')) S.fullscreen = $('#sfs').checked;
    saveSettings(); sound.setVolume(S.volume); sound.setOn(S.sound); sound.commentary = S.commentary; sound.comm.setVoice(S.voice); restartBackground(); home();
  },
};
function cycleTeam(side, dir) {
  const cur = teamById(setup[side]);
  const pool = allTeams().filter((t) => t.league === cur.league);
  const i = pool.findIndex((t) => t.id === cur.id);
  setup[side] = pool[(i + dir + pool.length) % pool.length].id;
  if (setup.home === setup.away) setup[side] = pool[(i + 2 * dir + pool.length * 2) % pool.length].id;
  renderSetup();
}
async function toggleFs(force) {
  try {
    if (env.kind === 'desktop' && env.api.window) return await env.api.window.fullscreen(force);
    if (document.fullscreenElement && force !== true) await document.exitFullscreen();
    else if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  } catch { /* the browser refused (no user gesture) */ }
}
let bg = null;
function menuView() {
  const p = PITCHES[11];
  return { size: 11, pitch: p, L: p.L, W: p.W, teams: [], players: [], humans: [], ball: { x: p.L / 2, y: p.W / 2, z: 0 }, score: [0, 0], phase: 'menu', clock: 0 };
}
function startBackground() {
  if (bg || !webglOK() || game) return;
  const cv = document.createElement('canvas'); cv.id = 'bg3d'; document.body.prepend(cv);
  let rd;
  try { rd = new Renderer3D(cv, { menu: true, quality: S.quality === 'ultra' ? 'high' : S.quality, time: 'night', stadium: { ...stadiumFor(allTeams()[1]), roof: true } }); } catch { cv.remove(); return; }
  bg = { cv, rd, last: performance.now(), acc: 0 };
  const view = menuView();
  const tick = (now) => {
    if (!bg || bg.rd !== rd) return;
    requestAnimationFrame(tick);
    const dt = (now - bg.last) / 1000; bg.last = now; bg.acc += dt;
    if (bg.acc < 1 / 30) return;
    rd.draw(view, bg.acc); bg.acc = 0;
  };
  requestAnimationFrame(tick);
}
function stopBackground() { if (!bg) return; try { bg.rd.dispose(); } catch { /* */ } bg.cv.remove(); bg = null; }
function restartBackground() { stopBackground(); startBackground(); }
function leaveNet() {
  if (!net) return;
  try { net.api.close(); } catch { /* */ }
  if (net.role === 'host' && net.kind === 'lan' && env.api) env.api.lan.stop().catch(() => {});
  input.dropRemote('r:');
  net = null;
}
function quickResultFor(f) { const H = teamById(f.home), A = teamById(f.away); const d = (H.strength - A.strength) / 12; const g = () => Math.max(0, Math.round(1.3 + (Math.random() - 0.5) * 2.4)); const s = [g() + (d > 0.4 ? 1 : 0), g() + (d < -0.4 ? 1 : 0)]; return { score: s, pens: f.stage === 'ko' && s[0] === s[1] ? (Math.random() < 0.5 ? [5, 4] : [4, 5]) : null }; }

// --------------------------------------------------------------- boot
addEventListener('gamepadconnected', () => { if (!game && app.querySelector('.foot') && !screenTick) home(); });
addEventListener('pointerdown', () => sound.unlock(), { once: true });
addEventListener('keydown', (e) => {
  sound.unlock();
  if (e.code === 'F11') { e.preventDefault(); toggleFs(); }
  if (e.code === 'Escape' && game && game.match && !net && !game.done) togglePause();
  else if (e.code === 'Escape' && !game) app.querySelector('.crumb [data-act]')?.click();
});
(async () => {
  env = await detect();
  document.body.dataset.env = env.kind;
  if (env.kind === 'desktop' && S.fullscreen && env.api.window) env.api.window.fullscreen(true).catch(() => {});
  const join = new URLSearchParams(location.search).get('join');
  home();
  loop();
  if (env.kind === 'lan') lanMenu();
  else if (join && (env.kind === 'web' || env.kind === 'desktop')) {
    const u = env.kind === 'web' ? await env.api.user() : await env.api.account.status().catch(() => ({}));
    if (u && u.signedIn) onlineJoin('join=' + join); else onlineMenu();
  }
  if (env.kind === 'desktop' && env.api.onJoin) env.api.onJoin((code) => onlineJoin(code));
})();
