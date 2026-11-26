// Self-Study Football - the match engine. Pure: no DOM, no clock of its own.
//
// The host steps it at a fixed 60 Hz and every client (a LAN guest, an online guest)
// only draws the snapshots it broadcasts, so a match can never disagree with itself.
//
//   pitch:  x 0..L along the length (goals at x=0 and x=L), y 0..W across, z up.
//   team 0 is home, team 1 away. attack(team) is +1 or -1 and flips at half time.
import { PITCHES, FORMATIONS, DEFAULT_FORMATION, lineup, difficultyById, rng } from './data.mjs';

export const DT = 1 / 60;
const G = 9.81;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const len = (x, y) => Math.hypot(x, y);
const EMPTY = Object.freeze({ mx: 0, my: 0, pass: false, shoot: false, through: false, lob: false, switch: false, sprint: false, skill: false });

export class Match {
  constructor(o) {
    this.size = o.size || 11;
    this.pitch = PITCHES[this.size];
    const { L, W } = this.pitch;
    this.L = L; this.W = W;
    this.teams = [o.home, o.away];
    this.formation = [o.homeFormation || DEFAULT_FORMATION[this.size], o.awayFormation || DEFAULT_FORMATION[this.size]];
    this.kits = [o.homeKit || o.home.kit, o.awayKit || (clash(o.home.kit, o.away.kit) ? o.away.away : o.away.kit)];
    this.diff = difficultyById(o.difficulty);
    this.knockout = !!o.knockout;
    this.r = rng(o.seed || Date.now());
    this.realSeconds = Math.max(60, (o.minutes || 4) * 60);
    this.clockRate = 5400 / this.realSeconds;       // game seconds per real second
    this.clock = 0; this.half = 1; this.score = [0, 0];
    this.stats = [blankStats(), blankStats()];
    this.events = []; this.banner = ''; this.bannerT = 0;
    this.players = [];
    for (let t = 0; t < 2; t++) {
      const shape = FORMATIONS[this.size][this.formation[t]];
      lineup(this.teams[t], this.size, this.formation[t]).forEach((info, i) => {
        const pace = info.attrs.pace;
        this.players.push({ id: this.players.length, team: t, slot: i, info, anchor: shape[i], gk: i === 0,
          x: 0, y: 0, vx: 0, vy: 0, fx: t === 0 ? 1 : -1, fy: 0, anim: 0, stamina: 1, stun: 0, cd: 0, think: 0,
          speed: 4.4 + pace * 0.022, human: null, action: '', dive: 0 });
      });
    }
    this.ball = { x: L / 2, y: W / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, shot: null };
    this.humans = (o.humans || []).map((h) => ({ ...h, player: null, prev: EMPTY, input: EMPTY, charge: 0, charging: false, pending: null }));
    this.phase = 'kickoff'; this.phaseT = 1.6; this.kickTeam = 0; this.restart = null;
    this.pens = null; this.over = false;
    this.resetPositions(0);
    this.say('Kick off');
    this.emit('kickoff', { home: this.teams[0].name, away: this.teams[1].name });
    this.emit('whistle', { long: false });
  }

  attack(team) { return (team === 0) === (this.half === 1) ? 1 : -1; }
  goalX(team) { return this.attack(team) > 0 ? this.L : 0; }   // the goal `team` shoots at
  ownGoalX(team) { return this.attack(team) > 0 ? 0 : this.L; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  say(text, t = 2.2) { this.banner = text; this.bannerT = t; }
  takeEvents() { const e = this.events; this.events = []; return e; }
  setInput(id, state) { const h = this.humans.find((x) => x.id === id); if (h) h.input = state || EMPTY; }

  // ------------------------------------------------------------- positions
  formationSpot(p, inPossession) {
    const { L, W } = this, b = this.ball, atk = this.attack(p.team);
    if (p.gk) return this.keeperSpot(p);
    const prog = atk > 0 ? b.x / L : 1 - b.x / L;
    const shift = (prog - 0.5) * 0.55 + (inPossession ? 0.1 : -0.04);
    const fwd = inPossession && p.anchor[0] > 0.46 ? 0.06 : 0;
    const nx = clamp(p.anchor[0] + shift + fwd, 0.04, 0.9);
    const spread = inPossession ? 0.94 : 0.76;
    return { x: atk > 0 ? nx * L : L - nx * L, y: clamp(W * (0.5 + (p.anchor[1] - 0.5) * spread) + (b.y - W / 2) * 0.28, 1.5, W - 1.5) };
  }
  keeperSpot(p) {
    const gx = this.ownGoalX(p.team), b = this.ball, W = this.W;
    const d = Math.abs(b.x - gx);
    const out = Math.min(this.size === 11 ? 5 : 2.5, d * 0.12) + 0.6;
    const t = out / Math.max(1, len(b.x - gx, b.y - W / 2));
    return { x: gx + (b.x - gx) * t, y: clamp(W / 2 + (b.y - W / 2) * t * 1.4, W / 2 - this.pitch.goal / 2 - 0.6, W / 2 + this.pitch.goal / 2 + 0.6) };
  }
  resetPositions(kickTeam) {
    const { L, W } = this;
    for (const p of this.players) {
      const atk = this.attack(p.team);
      const nx = p.gk ? 0.02 : clamp(p.anchor[0] * 0.92, 0.04, 0.47);
      p.x = atk > 0 ? nx * L : L - nx * L;
      p.y = W * (0.5 + (p.anchor[1] - 0.5) * 0.85);
      p.vx = p.vy = 0; p.fx = atk; p.fy = 0; p.stun = 0; p.cd = 0; p.dive = 0;
    }
    const b = this.ball;
    Object.assign(b, { x: L / 2, y: W / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, shot: null });
    // The kicking team's most advanced player stands on the ball.
    const kicker = this.players.filter((p) => p.team === kickTeam && !p.gk).sort((a, c) => c.anchor[0] - a.anchor[0])[0];
    kicker.x = L / 2 - this.attack(kickTeam) * 0.4; kicker.y = W / 2;
    this.give(kicker);
    for (const h of this.humans) h.player = null;
    this.assignHumans(true);
  }

  // ------------------------------------------------------------- humans
  assignHumans(force) {
    for (let t = 0; t < 2; t++) {
      const hs = this.humans.filter((h) => h.team === t);
      if (!hs.length) continue;
      const taken = new Set();
      for (const h of hs) {
        if (!force && h.player && !h.player.gk) { taken.add(h.player.id); continue; }
        const p = this.nearestToBall(t, taken);
        if (h.player) h.player.human = null;
        h.player = p; p.human = h.id; taken.add(p.id);
      }
    }
  }
  nearestToBall(team, exclude, noGk = true) {
    let best = null, bd = 1e9;
    for (const p of this.players) {
      if (p.team !== team || (noGk && p.gk) || (exclude && exclude.has(p.id))) continue;
      const d = len(p.x - this.ball.x, p.y - this.ball.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  switchHuman(h, to) {
    const target = to || (() => {
      const taken = new Set(this.humans.filter((o) => o !== h && o.player).map((o) => o.player.id));
      if (h.player) taken.add(h.player.id);
      return this.nearestToBall(h.team, taken);
    })();
    if (!target || target.human) return;
    if (h.player) h.player.human = null;
    h.player = target; target.human = h.id;
  }

  // ------------------------------------------------------------- ball
  give(p) {
    const b = this.ball;
    if (b.owner && b.owner !== p) b.owner.cd = 0.25;
    b.owner = p; b.last = p; b.shot = null; b.z = 0; b.vz = 0;
    p.cd = 0;
    // A teammate receiving the ball from a human becomes that human's player.
    const h = this.humans.find((x) => x.team === p.team && !p.human && x.player && x.player !== p &&
      (x.player === this._passer || len(x.player.x - p.x, x.player.y - p.y) > 6));
    if (h && !p.gk) this.switchHuman(h, p);
    this._passer = null;
    const hp = this.humans.find((x) => x.player === p);
    if (hp && hp.pending && hp.pending.t > 0) { const a = hp.pending; hp.pending = null; this.humanAct(hp, a.act, a.power); }
  }
  kick(p, vx, vy, vz, kind) {
    const b = this.ball;
    b.owner = null; b.last = p; b.vx = vx; b.vy = vy; b.vz = vz; b.z = Math.max(b.z, 0.12);
    p.cd = 0.3; p.kickT = 0.28;
    if (kind === 'shot') { b.shot = { team: p.team, decided: false, saveAt: 0 }; this.stats[p.team].shots++; }
    if (kind === 'pass') { this.stats[p.team].passes++; this._passer = p; this.emit('pass', { team: p.team, name: p.info.name, long: len(vx, vy) > 20 || vz > 3 }); }
    this.emit('kick', { power: len(vx, vy) / 30, kind });
  }
  passTo(p, target, mode) {
    const lead = mode === 'through' ? 0.9 : 0.35;
    let tx = target.x + target.vx * lead, ty = target.y + target.vy * lead;
    if (mode === 'through') { const a = this.attack(p.team); tx += a * (this.size === 11 ? 7 : 4); }
    tx = clamp(tx, 1, this.L - 1); ty = clamp(ty, 1, this.W - 1);
    this.passToPoint(p, tx, ty, mode);
  }
  passToPoint(p, tx, ty, mode) {
    const dx = tx - this.ball.x, dy = ty - this.ball.y, d = Math.max(1, len(dx, dy));
    const skill = (p.info.attrs.passing / 100) * (p.human ? 1 : this.aiSkill(p.team));
    const err = (1 - skill) * 0.22 * (this.r() - 0.5);
    const ang = Math.atan2(dy, dx) + err;
    if (mode === 'lob') {
      const T = 0.55 + d * 0.032, h = d / T;
      this.kick(p, Math.cos(ang) * h, Math.sin(ang) * h, (G * T) / 2, 'pass');
    } else {
      const v = clamp(7 + d * (mode === 'through' ? 1.0 : 0.85), 9, mode === 'through' ? 28 : 25);
      this.kick(p, Math.cos(ang) * v, Math.sin(ang) * v, d > 28 ? 1.6 : 0.2, 'pass');
    }
  }
  shoot(p, power, aim) {
    const gx = this.goalX(p.team), W = this.W, half = this.pitch.goal / 2;
    const skill = (p.info.attrs.shooting / 100) * (p.human ? 1 : this.aiSkill(p.team));
    const ty = W / 2 + clamp(aim, -1, 1) * half * 0.82;
    const dx = gx - this.ball.x, dy = ty - this.ball.y, d = len(dx, dy);
    const err = ((1 - skill) * 0.2 + power * 0.05) * (this.r() - 0.5) * 2;
    const ang = Math.atan2(dy, dx) + err;
    const scale = this.size === 11 ? 1 : 0.78;
    const v = (15 + power * 16) * scale;
    const vz = clamp((0.8 + power * 4.6) * (d / 20) * (0.75 + this.r() * 0.5), 0.4, 9) * scale + (power > 0.92 ? 1.5 : 0);
    this.kick(p, Math.cos(ang) * v, Math.sin(ang) * v, vz, 'shot');
    this.emit('shot', { team: p.team, power, name: p.info.name, dist: Math.round(len(this.goalX(p.team) - this.ball.x, this.W / 2 - this.ball.y)) });
  }
  bestPassTarget(p, dirx, diry, mode) {
    let best = null, bs = -1e9;
    const n = len(dirx, diry) || 1; dirx /= n; diry /= n;
    for (const q of this.players) {
      if (q.team !== p.team || q === p) continue;
      const dx = q.x - p.x, dy = q.y - p.y, d = len(dx, dy);
      if (d < 3 || d > (mode === 'lob' ? 55 : 42)) continue;
      const cos = (dx * dirx + dy * diry) / d;
      if (cos < 0.45) continue;
      let open = 99;
      for (const o of this.players) if (o.team !== p.team) open = Math.min(open, segDist(o.x, o.y, p.x, p.y, q.x, q.y));
      const s = cos * 3 - d / 30 + Math.min(open, 4) * 0.6 - (q.gk ? 3 : 0);
      if (s > bs) { bs = s; best = q; }
    }
    return best;
  }
  aiSkill(team) { return this.humans.some((h) => h.team === team) ? 0.9 : this.diff.skill; }

  // ------------------------------------------------------------- step
  step(dt = DT) {
    if (this.over) return;
    if (this.bannerT > 0) this.bannerT -= dt;
    for (const h of this.humans) { if (h.pending) h.pending.t -= dt; }
    if (this.phase === 'goal' || this.phase === 'half' || this.phase === 'kickoff') {
      this.phaseT -= dt;
      this.movePlayers(dt, true);
      if (this.phase === 'goal' && this.phaseT > 1.2) this.ballPhysics(dt);
      if (this.phaseT <= 0) {
        if (this.phase === 'goal' || this.phase === 'half') { this.resetPositions(this.kickTeam); this.phase = 'kickoff'; this.phaseT = 1.2; this.emit('whistle', {}); }
        else this.phase = 'play';
      }
      this.inputs(dt, true);
      return;
    }
    if (this.phase === 'restart') {
      this.phaseT -= dt;
      this.restartTick(dt);
      this.movePlayers(dt);
      return;
    }
    if (this.phase === 'pens') { this.pensTick(dt); return; }
    this.clock += dt * this.clockRate;
    if (this.half === 1 && this.clock >= 2700) return this.halfTime();
    if (this.clock >= 5400) return this.fullTime();
    this.inputs(dt, false);
    this.ai(dt);
    this.movePlayers(dt);
    this.ballPhysics(dt);
    this.possession(dt);
    this.keepers(dt);
    this.rules();
    if (this.ball.owner) this.stats[this.ball.owner.team].poss += dt;
  }

  halfTime() {
    this.clock = 2700; this.half = 2; this.phase = 'half'; this.phaseT = 3; this.kickTeam = 1;
    this.say('Half time'); this.emit('whistle', { long: true, double: true }); this.emit('half', {});
  }
  fullTime() {
    this.clock = 5400;
    if (this.knockout && this.score[0] === this.score[1]) return this.startPens();
    this.phase = 'end'; this.over = true;
    this.say('Full time', 99); this.emit('whistle', { long: true, triple: true }); this.emit('end', { score: this.score.slice() });
  }

  // ------------------------------------------------------------- human input
  inputs(dt, frozen) {
    for (const h of this.humans) {
      const i = h.input, pv = h.prev;
      h.prev = i;
      const p = h.player;
      if (!p) continue;
      const pressed = (k) => i[k] && !pv[k];
      if (pressed('switch') && this.ball.owner !== p) this.switchHuman(h);
      if (frozen) { if (this.phase === 'kickoff' && this.ball.owner === h.player && (pressed('pass') || pressed('shoot'))) { this.phase = 'play'; this.humanAct(h, 'pass', 0); } continue; }
      const own = this.ball.owner === p;
      if (i.shoot) { h.charge = Math.min(1, h.charge + dt * 1.1); h.charging = true; }
      if (h.charging && !i.shoot) {
        h.charging = false;
        const power = h.charge; h.charge = 0;
        if (own) this.humanAct(h, 'shoot', power);
        else if (this.ballNear(p, 2.2) && !this.ball.owner) { h.pending = { act: 'shoot', power, t: 0.45 }; this.oneTouch(h); }
        else this.tackle(p, false);
      }
      for (const act of ['pass', 'through', 'lob']) {
        if (!pressed(act)) continue;
        if (own) this.humanAct(h, act, 0);
        else if (!this.ball.owner && this.ballNear(p, 3)) { h.pending = { act, power: 0, t: 0.45 }; this.oneTouch(h); }
        else if (act === 'through') this.tackle(p, true);
      }
    }
  }
  oneTouch(h) { const b = this.ball, p = h.player; if (!b.owner && b.z < 1.6 && this.ballNear(p, 1.1) && p.cd <= 0) this.give(p); }
  ballNear(p, r) { return len(p.x - this.ball.x, p.y - this.ball.y) < r; }
  humanAct(h, act, power) {
    const p = h.player, i = h.input;
    let dx = i.mx, dy = i.my;
    if (Math.abs(dx) + Math.abs(dy) < 0.2) { dx = p.fx; dy = p.fy; }
    if (act === 'shoot') return this.shoot(p, Math.max(0.25, power), Math.abs(i.my) > 0.2 ? i.my : (this.r() - 0.5) * 0.8);
    const target = this.bestPassTarget(p, dx, dy, act);
    if (target) this.passTo(p, target, act);
    else { const n = len(dx, dy) || 1; this.passToPoint(p, this.ball.x + (dx / n) * 18, this.ball.y + (dy / n) * 18, act); }
  }
  tackle(p, slide) {
    const b = this.ball, o = b.owner;
    if (p.stun > 0) return;
    const reach = slide ? 2.8 : 1.7;
    p.action = slide ? 'slide' : 'tackle'; p.anim = 0;
    if (slide) { p.stun = 0.9; p.vx = p.fx * 7; p.vy = p.fy * 7; } else p.stun = 0.25;
    if (!o || o.team === p.team) {
      if (!b.owner && this.ballNear(p, reach) && b.z < 1) { this.give(p); this.emit('tackle', {}); }
      return;
    }
    if (len(o.x - p.x, o.y - p.y) > reach) return;
    const att = o.info.attrs.dribbling, def = p.info.attrs.defending * (p.human ? 1 : this.aiSkill(p.team));
    const chance = clamp(0.42 + (def - att) / 110 + (slide ? 0.14 : 0), 0.12, 0.88);
    if (this.r() < chance) {
      this.stats[p.team].tackles++;
      this.emit('tackle', { won: true, team: p.team, name: p.info.name, victim: o.info.name, slide });
      if (slide) { b.owner = null; b.vx = p.fx * 6 + (this.r() - 0.5) * 4; b.vy = p.fy * 6 + (this.r() - 0.5) * 4; b.last = p; o.cd = 0.6; }
      else { o.cd = 0.5; o.stun = 0.35; this.give(p); }
    } else if (slide && this.r() < 0.22) {
      this.foul(p, o);
    }
  }
  foul(p, victim) {
    this.stats[p.team].fouls++;
    const b = this.ball;
    const goalX = this.goalX(victim.team);
    const inBox = Math.abs(victim.x - goalX) < this.pitch.box && Math.abs(victim.y - this.W / 2) < this.pitch.boxW / 2;
    this.emit('whistle', {});
    if (inBox && !this.pitch.walls) {
      this.say('Penalty!'); this.emit('restart', { kind: 'penalty', team: victim.team, name: p.info.name });
      this.setRestart('penalty', victim.team, goalX - this.attack(victim.team) * (this.size === 11 ? 11 : 7), this.W / 2);
    } else {
      this.say('Free kick'); this.emit('restart', { kind: 'free', team: victim.team, name: p.info.name });
      this.setRestart('free', victim.team, b.x, b.y);
    }
  }

  // ------------------------------------------------------------- AI
  ai(dt) {
    const b = this.ball, owner = b.owner;
    const possTeam = owner ? owner.team : null;
    const chaser = [null, null];
    if (!owner) {
      for (let t = 0; t < 2; t++) {
        let best = null, bt = 1e9;
        for (const p of this.players) {
          if (p.team !== t || p.gk) continue;
          const tt = len(p.x - (b.x + b.vx * 0.4), p.y - (b.y + b.vy * 0.4)) / p.speed;
          if (tt < bt) { bt = tt; best = p; }
        }
        chaser[t] = best;
      }
    }
    const react = this.diff.react;
    for (const p of this.players) {
      if (p.human || p.stun > 0) continue;
      const humanTeam = this.humans.some((h) => h.team === p.team);
      const lag = humanTeam ? 0.12 : react;
      let tx, ty, sprint = false;
      if (owner === p) {
        p.think -= dt;
        if (p.think <= 0) { p.think = 0.18 + lag * 0.6 + this.r() * 0.1; if (this.carrierDecide(p)) continue; }
        const g = this.goalX(p.team);
        let dx = g - p.x, dy = this.W / 2 - p.y;
        const n = this.nearestOpp(p);
        if (n && n.d < 4) { dx -= (n.p.x - p.x) * 1.2; dy -= (n.p.y - p.y) * 1.6; }
        const m = len(dx, dy) || 1;
        tx = p.x + (dx / m) * 5; ty = p.y + (dy / m) * 5; sprint = !n || n.d > 3;
      } else if (!owner && chaser[p.team] === p && !this.humans.some((h) => h.team === p.team && h.player && len(h.player.x - b.x, h.player.y - b.y) < len(p.x - b.x, p.y - b.y))) {
        tx = b.x + b.vx * 0.35; ty = b.y + b.vy * 0.35; sprint = true;
      } else if (owner && owner.team !== p.team && !p.gk && this.isPresser(p, owner)) {
        tx = owner.x - this.attack(owner.team) * 0.6; ty = owner.y; sprint = true;
        p.think -= dt;
        if (p.think <= 0 && len(owner.x - p.x, owner.y - p.y) < 1.8) { p.think = 0.5 + lag * 2 + this.r() * 0.6; this.tackle(p, this.r() < 0.12); }
      } else {
        const s = this.formationSpot(p, possTeam === p.team);
        tx = s.x; ty = s.y;
      }
      p.goal = { x: tx, y: ty, sprint };
    }
  }
  isPresser(p, owner) {
    let first = null, second = null, d1 = 1e9, d2 = 1e9;
    for (const q of this.players) {
      if (q.team !== p.team || q.gk) continue;
      const d = len(q.x - owner.x, q.y - owner.y);
      if (d < d1) { second = first; d2 = d1; first = q; d1 = d; } else if (d < d2) { second = q; d2 = d; }
    }
    if (p === first) return !this.humans.some((h) => h.player === first) || false;
    return p === second && this.diff.skill > 0.8 && d2 < 14 && !this.humans.some((h) => h.team === p.team);
  }
  nearestOpp(p) {
    let best = null, bd = 1e9;
    for (const q of this.players) if (q.team !== p.team) { const d = len(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } }
    return best ? { p: best, d: bd } : null;
  }
  carrierDecide(p) {
    const g = this.goalX(p.team), dg = len(g - p.x, this.W / 2 - p.y);
    const range = this.size === 11 ? 26 : this.size === 7 ? 18 : 13;
    const angleOk = Math.abs(p.y - this.W / 2) < this.W * 0.3;
    const press = this.nearestOpp(p);
    const skill = this.aiSkill(p.team);
    if (p.gk) {
      const t = this.bestPassTarget(p, this.attack(p.team), 0, 'pass') || this.bestPassTarget(p, this.attack(p.team), 0, 'lob');
      if (t) this.passTo(p, t, len(t.x - p.x, t.y - p.y) > 30 ? 'lob' : 'pass');
      else this.passToPoint(p, this.L / 2, this.W / 2 + (this.r() - 0.5) * 30, 'lob');
      return true;
    }
    if (dg < range && angleOk && (dg < range * 0.55 || this.r() < 0.35 * skill)) {
      this.shoot(p, 0.55 + this.r() * 0.4 * skill, (this.r() - 0.5) * 1.8);
      return true;
    }
    const pressured = press && press.d < 2.6;
    if (pressured ? this.r() < 0.75 : this.r() < 0.07) {
      const a = this.attack(p.team);
      const mode = this.r() < 0.12 ? 'through' : this.r() < 0.08 ? 'lob' : 'pass';
      const t = this.bestPassTarget(p, a, (this.r() - 0.5) * 1.5, mode) || this.bestPassTarget(p, a * 0.2, p.y > this.W / 2 ? -1 : 1, 'pass');
      if (t) { this.passTo(p, t, mode); return true; }
    }
    return false;
  }

  // ------------------------------------------------------------- movement
  movePlayers(dt, idle) {
    const acc = 16;
    for (const p of this.players) {
      if (p.stun > 0) p.stun -= dt;
      if (p.cd > 0) p.cd -= dt;
      if (p.kickT > 0) p.kickT -= dt;
      let wx = 0, wy = 0, sprint = false;
      const h = p.human != null ? this.humans.find((x) => x.id === p.human) : null;
      if (idle) { wx = 0; wy = 0; }
      else if (h) { wx = h.input.mx; wy = h.input.my; sprint = h.input.sprint; }
      else if (p.goal) { wx = p.goal.x - p.x; wy = p.goal.y - p.y; sprint = p.goal.sprint; }
      let max = p.speed * (sprint && p.stamina > 0.1 ? 1.32 : 1);
      if (!p.human && !this.humans.some((x) => x.team === p.team)) max *= this.diff.speed;
      if (this.ball.owner === p) max *= 0.9;
      const m = len(wx, wy);
      let tvx = 0, tvy = 0;
      if (h) { const k = Math.min(1, m); if (m > 0.15) { tvx = (wx / m) * max * k; tvy = (wy / m) * max * k; } }
      else if (m > 0.4) { const sp = Math.min(max, m * 2.2); tvx = (wx / m) * sp; tvy = (wy / m) * sp; }
      if (p.stun > 0 && p.action === 'slide') { tvx = p.vx * 0.96; tvy = p.vy * 0.96; }
      else if (p.stun > 0) { tvx *= 0.2; tvy *= 0.2; }
      const ax = tvx - p.vx, ay = tvy - p.vy, am = len(ax, ay), lim = acc * dt;
      if (am > lim) { p.vx += (ax / am) * lim; p.vy += (ay / am) * lim; } else { p.vx = tvx; p.vy = tvy; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.x = clamp(p.x, -2, this.L + 2); p.y = clamp(p.y, -2, this.W + 2);
      const sp = len(p.vx, p.vy);
      if (sp > 0.3) { p.fx = p.vx / sp; p.fy = p.vy / sp; }
      p.anim += sp * dt * 1.7;
      p.stamina = clamp(p.stamina + (sprint && sp > 5 ? -0.05 : 0.025) * dt, 0, 1);
      if (p.stun <= 0) p.action = '';
    }
    // A light shove apart so two players are never drawn on the same spot.
    for (let i = 0; i < this.players.length; i++) for (let j = i + 1; j < this.players.length; j++) {
      const a = this.players[i], c = this.players[j], dx = c.x - a.x, dy = c.y - a.y, d = len(dx, dy);
      if (d > 0 && d < 0.7) { const k = (0.7 - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; c.x += dx * k; c.y += dy * k; }
    }
  }

  ballPhysics(dt) {
    const b = this.ball, { L, W } = this;
    if (b.owner) {
      const p = b.owner;
      const sp = len(p.vx, p.vy), ahead = 0.45 + Math.min(0.5, sp * 0.06);
      b.x = p.x + p.fx * ahead; b.y = p.y + p.fy * ahead; b.z = 0; b.vx = p.vx; b.vy = p.vy; b.vz = 0;
      return;
    }
    b.vz -= G * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < -1.2) { b.vz = -b.vz * 0.5; this.emit('bounce', { v: Math.abs(b.vz) }); } else b.vz = 0;
    }
    const drag = b.z > 0.05 ? 0.12 : 0.9;
    const f = Math.exp(-drag * dt);
    b.vx *= f; b.vy *= f;
    if (len(b.vx, b.vy) < 0.25 && b.z === 0) { b.vx = 0; b.vy = 0; }
    if (this.pitch.walls) {
      const inMouth = Math.abs(b.y - W / 2) < this.pitch.goal / 2 && b.z < this.pitch.goalH;
      if (b.y < 0.15 || b.y > W - 0.15) { b.y = clamp(b.y, 0.15, W - 0.15); b.vy = -b.vy * 0.75; this.emit('wall', {}); }
      if ((b.x < 0 || b.x > L) && !inMouth) { b.x = clamp(b.x, 0, L); b.vx = -b.vx * 0.75; this.emit('wall', {}); }
    }
    // The woodwork.
    for (const gx of [0, L]) {
      if (Math.abs(b.x - gx) > 0.4) continue;
      const half = this.pitch.goal / 2;
      const offPost = Math.abs(Math.abs(b.y - W / 2) - half);
      if ((offPost < 0.16 && b.z < this.pitch.goalH) || (Math.abs(b.y - W / 2) < half && Math.abs(b.z - this.pitch.goalH) < 0.14)) {
        b.vx = -b.vx * 0.6; b.x = gx + Math.sign(L / 2 - gx) * 0.45; b.vz *= -0.4;
        if (!b.postT || b.postT < this.clock) { this.emit('post', {}); this.say('Off the woodwork!'); b.postT = this.clock + 30; }
      }
    }
  }

  possession() {
    const b = this.ball;
    if (b.owner || b.z > 1.25) return;
    let best = null, bd = 1e9;
    for (const p of this.players) {
      if (p.cd > 0 || (p.stun > 0 && p.action !== 'tackle')) continue;
      const reach = p.gk ? 1.1 : 0.62 + p.info.attrs.dribbling / 400;
      const d = len(p.x - b.x, p.y - b.y);
      if (d < reach && d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    // A hard ball can run off a first touch.
    const speed = len(b.vx, b.vy);
    const control = best.info.attrs.dribbling / 100;
    if (speed > 22 && this.r() > control * 0.8) { b.vx *= 0.4; b.vy *= 0.4; best.cd = 0.15; return; }
    if (b.last && b.last.team !== best.team && b.shot == null) this.stats[best.team].intercepts++;
    this.give(best);
  }

  keepers(dt) {
    const b = this.ball, W = this.W;
    if (!b.shot || b.owner) return;
    const defTeam = 1 - b.shot.team;
    const gk = this.players.find((p) => p.team === defTeam && p.gk);
    const gx = this.ownGoalX(defTeam);
    const vxToGoal = (gx - b.x) * b.vx;
    if (vxToGoal <= 0) return;
    const t = (gx - b.x) / b.vx;
    if (!b.shot.decided && t < 0.75) {
      b.shot.decided = true;
      const py = b.y + b.vy * t, pz = b.z + b.vz * t - 0.5 * G * t * t;
      const onTarget = Math.abs(py - W / 2) < this.pitch.goal / 2 && pz < this.pitch.goalH && pz > -0.5;
      if (onTarget) this.stats[b.shot.team].onTarget++;
      const keeping = gk.info.attrs.keeping / 100;
      const human = this.humans.some((h) => h.team === defTeam);
      const kf = human ? 0.82 : this.diff.keeper;
      const reach = 1.1 + 2.1 * keeping * kf;
      const d = Math.abs(gk.y - py) + Math.max(0, pz - 1.8) * 0.8;
      const speed = len(b.vx, b.vy);
      const p = clamp(0.95 - (d / reach) * 0.55 - (speed - 16) / 45 + (keeping - 0.7) * 0.5, 0.03, 0.96) * (d > reach * 1.5 ? 0.15 : 1);
      b.shot.save = onTarget && this.r() < p;
      b.shot.saveY = py; b.shot.catch = speed < 21 && this.r() < keeping;
      gk.dive = d > 1.2 ? Math.sign(py - gk.y) : 0;
    }
    if (b.shot.decided) {
      gk.goal = null;
      const ty = clamp(b.shot.saveY, W / 2 - this.pitch.goal / 2 - 0.3, W / 2 + this.pitch.goal / 2 + 0.3);
      gk.y += clamp(ty - gk.y, -9 * dt, 9 * dt);
      if (b.shot.save && Math.abs(b.x - gk.x) < 1.2) {
        this.emit('save', { team: defTeam, catch: b.shot.catch, name: gk.info.name, shooter: b.last ? b.last.info.name : '' });
        this.say(b.shot.catch ? 'Great catch!' : 'Saved!');
        this.stats[defTeam].saves++;
        if (b.shot.catch) { this.give(gk); gk.cd = 0; gk.think = 1.1; }
        else { b.vx = -b.vx * 0.35; b.vy = (this.r() - 0.5) * 14; b.vz = 2 + this.r() * 3; b.last = gk; b.shot = null; }
      }
    }
  }

  // ------------------------------------------------------------- rules
  rules() {
    const b = this.ball, { L, W } = this;
    const half = this.pitch.goal / 2;
    for (const [gx, side] of [[0, -1], [L, 1]]) {
      if ((side < 0 && b.x > gx) || (side > 0 && b.x < gx)) continue;
      if (Math.abs(b.y - W / 2) < half && b.z < this.pitch.goalH) return this.goal(this.attack(0) * side > 0 ? 0 : 1);
      if (this.pitch.walls) continue;
      const defending = this.attack(0) * side > 0 ? 1 : 0;   // the team whose goal this is
      const lastDef = b.last && b.last.team === defending;
      this.emit('whistle', {});
      if (b.shot) this.emit('miss', { team: b.shot.team, name: b.last ? b.last.info.name : '' });
      this.emit('restart', { kind: lastDef ? 'corner' : 'goalkick', team: lastDef ? 1 - defending : defending });
      if (lastDef) { this.say('Corner'); this.setRestart('corner', 1 - defending, gx, b.y < W / 2 ? 0.3 : W - 0.3); }
      else { this.say('Goal kick'); this.setRestart('goalkick', defending, gx - side * 5.5, W / 2 + (b.y < W / 2 ? -4 : 4)); }
      return;
    }
    if (!this.pitch.walls && (b.y < -0.1 || b.y > W + 0.1)) {
      const team = b.last ? 1 - b.last.team : 0;
      this.say('Throw-in'); this.emit('restart', { kind: 'throw', team });
      this.setRestart('throw', team, clamp(b.x, 1, L - 1), b.y < 0 ? 0 : W);
    }
  }
  goal(team) {
    this.score[team]++;
    const scorer = this.ball.last && this.ball.last.team === team ? this.ball.last : null;
    this.stats[team].goals.push({ minute: Math.ceil(this.clock / 60), name: scorer ? scorer.info.name : 'Own goal' });
    this.lastScorer = scorer ? scorer.id : -1;
    this.emit('goal', { team, scorer: scorer ? scorer.info.name : '', score: this.score.slice(), minute: Math.ceil(this.clock / 60), own: !scorer });
    this.say('GOAL! ' + this.teams[team].name, 3);
    this.phase = 'goal'; this.phaseT = 3.2; this.kickTeam = 1 - team;
    this.ball.shot = null; this.ball.owner = null;
  }
  setRestart(type, team, x, y) {
    const b = this.ball;
    Object.assign(b, { x, y: clamp(y, 0, this.W), z: 0, vx: 0, vy: 0, vz: 0, owner: null, shot: null });
    let taker;
    if (type === 'goalkick') taker = this.players.find((p) => p.team === team && p.gk);
    else if (type === 'penalty') taker = this.players.filter((p) => p.team === team && !p.gk).sort((a, c) => c.info.attrs.shooting - a.info.attrs.shooting)[0];
    else taker = this.nearestToBall(team, null);
    taker.x = x - this.attack(team) * (type === 'corner' ? -0.5 : 0.5); taker.y = y; taker.vx = taker.vy = 0;
    this.restart = { type, team, taker, t: 0 };
    this.phase = 'restart'; this.phaseT = type === 'penalty' ? 2.2 : 1.1;
    const h = this.humans.find((x) => x.team === team);
    if (h && !taker.gk) this.switchHuman(h, taker);
    // Opponents give the taker room.
    for (const p of this.players) {
      if (p.team === team || p.gk) continue;
      const d = len(p.x - x, p.y - y);
      if (d < 9.15) { const k = 9.15 / Math.max(0.1, d); p.x = clamp(x + (p.x - x) * k, 1, this.L - 1); p.y = clamp(y + (p.y - y) * k, 1, this.W - 1); }
    }
    if (type === 'penalty') {
      for (const p of this.players) if (p !== taker && !p.gk) { p.x = this.L / 2 + (p.x - this.L / 2) * 0.3; }
    }
  }
  restartTick(dt) {
    const r = this.restart;
    if (!r) { this.phase = 'play'; return; }
    for (const p of this.players) if (!p.human) p.goal = p === r.taker ? { x: r.taker.x, y: r.taker.y } : { ...this.formationSpot(p, p.team === r.team) };
    if (this.phaseT > 0) return;
    if (this.ball.owner !== r.taker) this.give(r.taker);
    const h = this.humans.find((x) => x.player === r.taker);
    if (h) {
      r.t += dt;
      this.inputs(dt, false);
      if (this.ball.owner !== r.taker || r.t > 6) { if (this.ball.owner === r.taker) this.aiRestart(r); this.phase = 'play'; this.restart = null; }
      return;
    }
    this.aiRestart(r);
    this.phase = 'play'; this.restart = null;
  }
  aiRestart(r) {
    const p = r.taker;
    if (r.type === 'penalty') return this.shoot(p, 0.7, (this.r() < 0.5 ? -1 : 1) * (0.5 + this.r() * 0.5));
    if (r.type === 'corner') {
      const box = this.goalX(p.team) - this.attack(p.team) * 9;
      return this.passToPoint(p, box, this.W / 2 + (this.r() - 0.5) * 10, 'lob');
    }
    if (r.type === 'goalkick') return this.carrierDecide(p);
    const t = this.bestPassTarget(p, this.attack(p.team), 0, 'pass') || this.bestPassTarget(p, 0, r.taker.y < this.W / 2 ? 1 : -1, 'pass') || this.bestPassTarget(p, -this.attack(p.team), 0, 'pass');
    if (t) this.passTo(p, t, 'pass'); else this.passToPoint(p, this.L / 2, this.W / 2, 'lob');
  }

  // ------------------------------------------------------------- penalties
  startPens() {
    this.phase = 'pens'; this.pens = { kicks: [[], []], turn: 0, t: 1.5 };
    this.say('Penalty shoot-out', 3); this.emit('whistle', { long: true });
  }
  pensTick(dt) {
    const P = this.pens;
    P.t -= dt;
    if (P.t > 0) return;
    const t = P.turn % 2, n = Math.floor(P.turn / 2);
    const takers = this.players.filter((p) => p.team === t && !p.gk).sort((a, c) => c.info.attrs.shooting - a.info.attrs.shooting);
    const k = takers[n % takers.length], gk = this.players.find((p) => p.team === 1 - t && p.gk);
    const scored = this.r() < clamp(0.76 + (k.info.attrs.shooting - gk.info.attrs.keeping) / 200, 0.5, 0.92);
    P.kicks[t].push(scored);
    this.emit(scored ? 'goal' : 'save', { team: scored ? t : 1 - t, pens: true });
    this.say(`${this.teams[t].short}: ${k.info.name} ${scored ? 'scores' : 'is saved'}`, 1.6);
    P.turn++; P.t = 1.7;
    const [a, c] = P.kicks.map((x) => x.filter(Boolean).length);
    const ta = P.kicks[0].length, tc = P.kicks[1].length;
    const left = (taken) => Math.max(0, 5 - taken);
    const done = (ta >= 5 && tc >= 5 && ta === tc && a !== c) || (ta <= 5 && (a > c + left(tc) || c > a + left(ta)));
    if (done) {
      this.phase = 'end'; this.over = true; this.pens.winner = a > c ? 0 : 1;
      this.say(`${this.teams[this.pens.winner].name} win on penalties ${a}-${c}`, 99);
      this.emit('end', { score: this.score.slice(), pens: [a, c] });
    }
  }

  winner() {
    if (this.score[0] !== this.score[1]) return this.score[0] > this.score[1] ? 0 : 1;
    return this.pens && this.pens.winner != null ? this.pens.winner : -1;
  }

  // ------------------------------------------------------------- views
  view() {
    const b = this.ball;
    return {
      size: this.size, pitch: this.pitch, L: this.L, W: this.W,
      teams: this.teams.map((t, i) => ({ name: t.name, short: t.short, kit: this.kits[i] })),
      players: this.players.map((p) => ({ team: p.team, gk: p.gk, x: p.x, y: p.y, fx: p.fx, fy: p.fy, anim: p.anim,
        action: p.action, dive: p.dive, kick: p.kickT > 0, human: p.human, number: p.info.number, skin: p.info.skin, hair: p.info.hair, name: p.info.name })),
      ball: { x: b.x, y: b.y, z: b.z, owner: b.owner ? b.owner.id : -1 },
      score: this.score.slice(), scorer: this.phase === 'goal' ? this.lastScorer : -1, clock: this.clock, half: this.half, phase: this.phase,
      banner: this.bannerT > 0 ? this.banner : '', pens: this.pens ? this.pens.kicks : null,
      humans: this.humans.map((h) => ({ id: h.id, team: h.team, color: h.color, label: h.label, player: h.player ? h.player.id : -1, charge: h.charging ? h.charge : 0 })),
    };
  }
  // Compact form of view() for the network: the static parts travel once, in setup().
  snapshot() {
    const v = this.view(), f = [];
    for (const p of v.players) f.push(r1(p.x), r1(p.y), r2(p.fx), r2(p.fy), r1(p.anim), p.action === 'slide' ? 2 : p.action === 'tackle' ? 1 : p.kickT > 0 ? 3 : 0, p.dive);
    return { t: 's', p: f, b: [r1(v.ball.x), r1(v.ball.y), r1(v.ball.z), v.ball.owner], sc: v.score, sr: v.scorer, c: Math.round(v.clock), h: v.half, ph: v.phase, bn: v.banner,
      hu: v.humans.map((h) => [h.id, h.player, Math.round(h.charge * 20) / 20]), pe: v.pens };
  }
  setup() {
    const v = this.view();
    return { t: 'setup', size: v.size, teams: v.teams, players: v.players.map(({ team, gk, number, skin, hair, name }) => ({ team, gk, number, skin, hair, name })),
      humans: v.humans.map(({ id, team, color, label }) => ({ id, team, color, label })) };
  }
}

// Rebuild a full view on a client from setup() + snapshot().
export function viewFrom(setup, s) {
  const pitch = PITCHES[setup.size];
  const players = setup.players.map((p, i) => ({ ...p, x: s.p[i * 7], y: s.p[i * 7 + 1], fx: s.p[i * 7 + 2], fy: s.p[i * 7 + 3], anim: s.p[i * 7 + 4],
    action: ['', 'tackle', 'slide', ''][s.p[i * 7 + 5]], kick: s.p[i * 7 + 5] === 3, dive: s.p[i * 7 + 6], human: null }));
  const humans = setup.humans.map((h) => { const e = s.hu.find((x) => x[0] === h.id); return { ...h, player: e ? e[1] : -1, charge: e ? e[2] : 0 }; });
  for (const h of humans) if (players[h.player]) players[h.player].human = h.id;
  return { size: setup.size, pitch, L: pitch.L, W: pitch.W, teams: setup.teams, players, ball: { x: s.b[0], y: s.b[1], z: s.b[2], owner: s.b[3] },
    score: s.sc, scorer: s.sr == null ? -1 : s.sr, clock: s.c, half: s.h, phase: s.ph, banner: s.bn, pens: s.pe, humans };
}

function blankStats() { return { goals: [], shots: 0, onTarget: 0, passes: 0, tackles: 0, saves: 0, fouls: 0, intercepts: 0, poss: 0 }; }
function clash(a, b) { return colourDist(a.primary, b.primary) < 90; }
function colourDist(a, b) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return len(px - ax - t * dx, py - ay - t * dy);
}
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

// Simulate a match nobody is watching (the rest of a tournament round), from ratings.
export function quickResult(home, away, seed, knockout) {
  const r = rng(seed);
  const diff = (home.strength - away.strength) / 10;
  const lam = (base) => Math.max(0.2, base);
  const poisson = (l) => { let k = 0, p = 1; const L = Math.exp(-l); do { k++; p *= r(); } while (p > L); return k - 1; };
  const a = poisson(lam(1.35 + diff * 0.45 + 0.15)), b = poisson(lam(1.2 - diff * 0.45));
  let pens = null;
  if (knockout && a === b) pens = r() < 0.5 + diff * 0.05 ? [5, 4] : [3, 4];
  return { score: [a, b], pens };
}
