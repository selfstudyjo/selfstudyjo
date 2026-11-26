// Self-Study Football - sound. Every sound is SYNTHESISED with Web Audio, so the game
// ships no audio files at all: the crowd is filtered noise that swells with the play,
// the whistle is an oscillator with a pea-rattle vibrato, a kick is a thud plus a
// short noise burst, the net is a swish, the woodwork a metallic ring. Commentary is
// optional and uses the system voice (speechSynthesis), so it costs nothing either.

export class Sound {
  constructor() { this.ctx = null; this.on = true; this.volume = 0.8; this.commentary = true; this.excite = 0; this.lastLine = 0; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.volume; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = last * 6 + (Math.random() * 2 - 1) * 0.15; }
    this.noise = buf;
    // The crowd bed.
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    this.crowdF = c.createBiquadFilter(); this.crowdF.type = 'bandpass'; this.crowdF.frequency.value = 600; this.crowdF.Q.value = 0.6;
    this.crowdG = c.createGain(); this.crowdG.gain.value = 0;
    src.connect(this.crowdF).connect(this.crowdG).connect(this.master); src.start();
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.on ? v : 0; }
  setOn(on) { this.on = on; if (this.master) this.master.gain.value = on ? this.volume : 0; if (!on && window.speechSynthesis) speechSynthesis.cancel(); }
  crowd(level) {
    if (!this.ctx) return;
    this.excite += (level - this.excite) * 0.05;
    const t = this.ctx.currentTime;
    this.crowdG.gain.setTargetAtTime(0.06 + this.excite * 0.22, t, 0.3);
    this.crowdF.frequency.setTargetAtTime(500 + this.excite * 500, t, 0.3);
  }
  stopCrowd() { if (this.crowdG) this.crowdG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4); }
  burst({ dur = 0.08, freq = 1200, type = 'lowpass', gain = 0.4, q = 0.7, delay = 0 }) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone({ freq = 440, dur = 0.2, gain = 0.2, type = 'sine', delay = 0, slide = 0 }) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  whistle(n = 1, long = false) {
    const c = this.ctx; if (!c) return;
    for (let i = 0; i < n; i++) {
      const t = c.currentTime + i * 0.45, dur = long && i === n - 1 ? 0.9 : 0.28;
      const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.frequency.value = 2900; lfo.frequency.value = 38; lg.gain.value = 140;
      lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.setValueAtTime(0.16, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    }
  }
  roar(big = true) {
    this.burst({ dur: big ? 3.5 : 1.4, freq: 700, type: 'bandpass', gain: big ? 0.9 : 0.4, q: 0.4 });
    this.burst({ dur: big ? 3 : 1.1, freq: 1150, type: 'bandpass', gain: big ? 0.5 : 0.2, q: 0.9, delay: 0.05 });
  }
  menu() { this.unlock(); this.tone({ freq: 660, dur: 0.07, gain: 0.08, type: 'triangle' }); }

  // Turn the engine's events into sound and (optionally) a spoken line.
  events(list, view, humanTeams = []) {
    if (!this.ctx || !this.on) return;
    for (const e of list) {
      switch (e.type) {
        case 'kick': this.tone({ freq: 95, dur: 0.12, gain: 0.25 + e.power * 0.3, slide: -40 }); this.burst({ dur: 0.05, freq: 1800, gain: 0.15 + e.power * 0.3 }); break;
        case 'bounce': if (e.v > 2) this.tone({ freq: 140, dur: 0.06, gain: Math.min(0.15, e.v * 0.03) }); break;
        case 'wall': this.burst({ dur: 0.12, freq: 400, gain: 0.35 }); this.tone({ freq: 120, dur: 0.1, gain: 0.2 }); break;
        case 'post': this.tone({ freq: 880, dur: 0.6, gain: 0.18, type: 'triangle' }); this.tone({ freq: 1320, dur: 0.5, gain: 0.1 }); this.roar(false); this.say('Off the woodwork!'); break;
        case 'whistle': this.whistle(e.triple ? 3 : e.double ? 2 : 1, !!e.long); break;
        case 'shot': this.excite = Math.min(1, this.excite + 0.4); break;
        case 'save': this.roar(false); if (!e.pens) this.say(pickLine(SAVES)); break;
        case 'tackle': if (e.won) this.burst({ dur: 0.1, freq: 500, gain: 0.25 }); break;
        case 'goal':
          this.burst({ dur: 0.5, freq: 3000, type: 'highpass', gain: 0.25 });
          this.roar(!e.pens || true);
          if (!e.pens && view) {
            const team = view.teams[e.team].name;
            this.say(humanTeams.length && !humanTeams.includes(e.team) ? `${team} score. ${e.scorer || ''}` : `Goal! ${e.scorer ? e.scorer + ' for ' : ''}${team}!`, true);
          }
          break;
        case 'half': this.say('That is half time.'); break;
        case 'end': this.say('And that is full time.', true); this.stopCrowd(); break;
        default:
      }
    }
  }
  say(text, force) {
    if (!this.commentary || !this.on || !window.speechSynthesis) return;
    const now = performance.now();
    if (!force && now - this.lastLine < 6000) return;
    this.lastLine = now;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.rate = 1.12; u.pitch = 0.9; u.volume = this.volume;
      const v = speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch { /* no voice on this system */ }
  }
}
const SAVES = ['What a save!', 'Denied by the keeper!', 'Great stop.', 'Kept out!'];
const pickLine = (l) => l[Math.floor(Math.random() * l.length)];
