// Self-Study Football - stadium sound. Everything is synthesised with Web Audio, so the
// game ships no audio files:
//   - the crowd: three bands of filtered noise whose levels wander independently (a
//     real crowd is thousands of voices, never a steady hiss), through a stadium reverb;
//   - swells as the ball nears a box, a groan on a miss, applause after a save, a roar
//     and a celebration chant after a goal;
//   - CHANTS: a choir of detuned voices through vowel formants singing a terrace melody,
//     with rhythmic clapping, every half minute or so when the game is calm;
//   - whistle, kicks, net, woodwork.
// Commentary is commentary.mjs; the crowd ducks under it.
import { Commentary } from './commentary.mjs';

export class Sound {
  constructor() {
    this.ctx = null; this.on = true; this.volume = 0.85; this.excite = 0.2; this.nextChant = 14; this.level = 0.2;
    this.comm = new Commentary(this);
  }
  set commentary(v) { this.comm.enabled = v; }
  get commentary() { return this.comm.enabled; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.on ? this.volume : 0; this.master.connect(c.destination);
    // Stadium reverb: an impulse of decaying noise, 2.6 s.
    this.verb = c.createConvolver();
    const n = c.sampleRate * 2.6, ir = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    this.verb.buffer = ir;
    this.wet = c.createGain(); this.wet.gain.value = 0.35; this.verb.connect(this.wet).connect(this.master);
    this.crowdBus = c.createGain(); this.crowdBus.gain.value = 0; this.crowdBus.connect(this.master); this.crowdBus.connect(this.verb);
    // Pink-ish noise.
    const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.02) * 2.2; }
    this.noise = buf;
    this.bands = [[320, 0.9, 0.5], [850, 0.8, 0.45], [2200, 0.7, 0.18]].map(([f, q, g]) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random();
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const gn = c.createGain(); gn.gain.value = g;
      s.connect(bp).connect(gn).connect(this.crowdBus); s.start(0, Math.random() * 2);
      return { bp, gn, base: g, f };
    });
    this.wander = setInterval(() => this.wanderTick(), 450);
  }
  wanderTick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const b of this.bands) b.gn.gain.setTargetAtTime(b.base * (0.65 + Math.random() * 0.7) * (0.7 + this.excite * 0.9), t, 0.6);
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.on ? v : 0; }
  setOn(on) { this.on = on; if (this.master) this.master.gain.value = on ? this.volume : 0; if (!on) this.comm.stop(); }
  duck(on) { if (this.crowdBus) this.crowdBus.gain.setTargetAtTime(this.level * (on ? 0.55 : 1), this.ctx.currentTime, 0.25); }
  // Called every frame with how dangerous the play is (0..1).
  crowd(level, dt = 1 / 60) {
    if (!this.ctx) return;
    this.excite += (level - this.excite) * 0.04;
    this.level = 0.16 + this.excite * 0.5;
    const t = this.ctx.currentTime;
    this.crowdBus.gain.setTargetAtTime(this.level * (this.comm.speaking ? 0.55 : 1), t, 0.4);
    for (const b of this.bands) b.bp.frequency.setTargetAtTime(b.f * (0.9 + this.excite * 0.35), t, 0.5);
    this.nextChant -= dt;
    if (this.nextChant <= 0) { this.nextChant = 22 + Math.random() * 25; if (this.excite < 0.6) this.chant(); }
  }
  stopCrowd() { if (this.crowdBus) this.crowdBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8); }

  burst({ dur = 0.08, freq = 1200, type = 'lowpass', gain = 0.4, q = 0.7, delay = 0, verb = false }) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master); if (verb) g.connect(this.verb);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }
  tone({ freq = 440, dur = 0.2, gain = 0.2, type = 'sine', delay = 0, slide = 0, verb = false }) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); if (verb) g.connect(this.verb);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // A crowd voice: many detuned sawtooths through two vowel formants.
  choir(notes, { vowel = 'o', gain = 0.12, start = 0, voices = 9 } = {}) {
    const c = this.ctx; if (!c) return;
    const F = { o: [480, 860], a: [750, 1200], e: [520, 1800] }[vowel];
    const bus = c.createGain(); bus.gain.value = gain;
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = F[0]; f1.Q.value = 5;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = F[1]; f2.Q.value = 6;
    const mix = c.createGain(); f1.connect(mix); f2.connect(mix); mix.connect(bus); bus.connect(this.crowdBus); bus.connect(this.verb);
    let t = c.currentTime + start;
    for (const [midi, dur] of notes) {
      for (let v = 0; v < voices; v++) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12) * (1 + (Math.random() - 0.5) * 0.03) * (v % 3 === 0 ? 0.5 : 1);
        const tt = t + Math.random() * 0.05;
        g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.25, tt + 0.06); g.gain.setValueAtTime(0.25, tt + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
        o.connect(g); g.connect(f1); g.connect(f2); o.start(tt); o.stop(tt + dur + 0.05);
      }
      t += dur;
    }
    return t - c.currentTime;
  }
  claps(beats, interval = 0.5, start = 0) {
    for (let i = 0; i < beats.length; i++) if (beats[i]) for (let k = 0; k < 6; k++) this.burst({ dur: 0.06, freq: 1500 + Math.random() * 900, type: 'bandpass', q: 1.2, gain: 0.05, delay: start + i * interval + Math.random() * 0.03, verb: true });
  }
  chant() {
    const songs = [
      [[64, 0.45], [64, 0.45], [67, 0.45], [64, 0.45], [62, 0.9], [60, 0.9]],          // "oh-oh-oh-oh, oh-oh"
      [[67, 0.35], [69, 0.35], [67, 0.35], [64, 0.7], [67, 0.35], [69, 0.35], [72, 1.0]],
      [[60, 0.6], [64, 0.6], [67, 1.2], [64, 0.6], [60, 1.2]],
    ];
    const s = songs[Math.floor(Math.random() * songs.length)];
    const d = this.choir(s, { vowel: Math.random() < 0.5 ? 'o' : 'a', gain: 0.1 });
    this.claps([1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0], 0.45, d + 0.1);
  }
  applause(sec = 2.2, gain = 0.03) { for (let i = 0; i < sec * 70; i++) this.burst({ dur: 0.05, freq: 1800 + Math.random() * 1500, type: 'bandpass', q: 1, gain, delay: Math.random() * sec, verb: true }); }
  groan() {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
    s.buffer = this.noise; f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(380, t + 1.4);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    s.connect(f).connect(g).connect(this.crowdBus); g.connect(this.verb); s.start(t); s.stop(t + 2);
  }
  roar() {
    this.burst({ dur: 4.5, freq: 650, type: 'bandpass', gain: 0.9, q: 0.5, verb: true });
    this.burst({ dur: 4, freq: 1300, type: 'bandpass', gain: 0.5, q: 0.8, delay: 0.05, verb: true });
    this.burst({ dur: 3.2, freq: 2600, type: 'bandpass', gain: 0.2, q: 1, delay: 0.1 });
    // An air horn and the goal song.
    this.tone({ freq: 233, dur: 1.2, gain: 0.08, type: 'sawtooth', delay: 0.6, verb: true }); this.tone({ freq: 294, dur: 1.2, gain: 0.06, type: 'sawtooth', delay: 0.6, verb: true });
    setTimeout(() => { const d = this.choir([[67, 0.4], [67, 0.4], [69, 0.4], [71, 0.8], [69, 0.4], [67, 0.8]], { vowel: 'a', gain: 0.16, voices: 12 }); this.claps([1, 0, 1, 0, 1, 1, 1, 0], 0.4, d); }, 3200);
  }
  whistle(n = 1, long = false) {
    const c = this.ctx; if (!c) return;
    for (let i = 0; i < n; i++) {
      const t = c.currentTime + i * 0.45, dur = long && i === n - 1 ? 0.95 : 0.28;
      const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.frequency.value = 3000; lfo.frequency.value = 42; lg.gain.value = 160;
      lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.02); g.gain.setValueAtTime(0.14, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master); g.connect(this.verb);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    }
  }
  menu() { this.unlock(); this.tone({ freq: 880, dur: 0.06, gain: 0.05, type: 'triangle' }); this.tone({ freq: 1320, dur: 0.05, gain: 0.03, type: 'triangle', delay: 0.03 }); }

  events(list, view, humanTeams = []) {
    if (!this.ctx || !this.on) return;
    for (const e of list) {
      switch (e.type) {
        case 'kick': this.tone({ freq: 80, dur: 0.14, gain: 0.3 + e.power * 0.35, slide: -35 }); this.burst({ dur: 0.04, freq: 2400, gain: 0.1 + e.power * 0.25 }); break;
        case 'bounce': if (e.v > 2) this.tone({ freq: 120, dur: 0.07, gain: Math.min(0.12, e.v * 0.025) }); break;
        case 'wall': this.burst({ dur: 0.14, freq: 380, gain: 0.4, verb: true }); this.tone({ freq: 110, dur: 0.12, gain: 0.22 }); break;
        case 'post': this.tone({ freq: 880, dur: 0.8, gain: 0.16, type: 'triangle', verb: true }); this.tone({ freq: 1310, dur: 0.6, gain: 0.08, verb: true }); this.groan(); break;
        case 'whistle': this.whistle(e.triple ? 3 : e.double ? 2 : 1, !!e.long); break;
        case 'shot': this.excite = Math.min(1, this.excite + 0.45); break;
        case 'save': this.applause(2.5, 0.035); break;
        case 'miss': this.groan(); break;
        case 'tackle': if (e.won) this.burst({ dur: 0.12, freq: 500, gain: 0.22 }); break;
        case 'goal': this.burst({ dur: 0.6, freq: 3200, type: 'highpass', gain: 0.22 }); this.roar(); break;
        case 'end': this.applause(5, 0.03); setTimeout(() => this.stopCrowd(), 6000); break;
        default:
      }
    }
    this.comm.events(list, view, humanTeams);
  }
}
