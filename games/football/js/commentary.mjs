// Self-Study Football - the commentary box: a play-by-play commentator and a
// co-commentator (two different voices), speaking through the system's speech engine.
//
// What makes commentary sound alive is not the voice alone, it is WHAT is said and
// WHEN: lines name the players, know the score and the minute ("late equaliser",
// "they lead 2-0"), never repeat the last thing said, build excitement in rate and
// pitch on a shot and a goal, stay quiet during ordinary passing, and let the
// co-commentator add a line of analysis after the big moments. One line at a time,
// a priority queue, and anything stale is dropped instead of being read late.
//
// The best voice on the system is chosen automatically: "Natural"/"Neural"/"Online"
// voices (Edge, Windows 11, macOS Premium/Enhanced, Chrome's Google voices) before the
// classic ones. Settings can pin a voice.

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const fill = (s, d) => s.replace(/\{(\w+)\}/g, (_, k) => (d[k] == null ? '' : d[k]));
const surname = (n) => String(n || '').replace(/^[A-Z]\.\s*/, '');

const LINES = {
  kickoff: ['And we are under way here, {home} against {away}.', 'The referee blows, and {home} and {away} get us started.', 'Here we go! {home} take on {away}.'],
  shot: ['{name} shoots!', '{name}, has a go!', 'A strike from {name}!', '{name} lets fly!'],
  shotFar: ['{name} tries his luck from distance!', 'From {dist} yards, {name}!'],
  save: ['Saved! Brilliant from {name}.', 'What a stop by {name}!', '{name} gets down well to keep that out.', 'Denied! {name} again.'],
  catch: ['{name} gathers it comfortably.', 'Straight at {name}.', 'Easy for {name}.'],
  miss: ['Just wide!', 'Over the bar!', 'That one goes begging.', 'Off target from {name}.'],
  post: ['Off the woodwork!', 'It hits the post!', 'The frame of the goal saves them!'],
  tackle: ['Great tackle by {name}.', '{name} wins it back.', 'Well timed by {name}.'],
  slide: ['A sliding challenge from {name}, and he takes the ball!'],
  corner: ['Corner kick to {team}.', '{team} will have a corner.'],
  free: ['Free kick. {name} brings his man down.', 'The referee gives a free kick.'],
  penalty: ['Penalty! The referee points to the spot!', 'It is a penalty to {team}!'],
  longPass: ['{name} switches play.', 'A long ball from {name}.', '{name} looks for the run in behind.'],
  goal: {
    opener: ['GOAL! {scorer} opens the scoring for {team}!', 'GOAL! {scorer}! {team} are in front!'],
    lead: ['GOAL! {scorer}! {team} lead {a} {b}!', 'And {scorer} makes it {a} {b}!'],
    equaliser: ['GOAL! {scorer} brings {team} level!', 'They are level! {scorer} with the equaliser!'],
    late: ['GOAL! A late, late goal from {scorer}!', 'In the {minute}th minute, {scorer}! Unbelievable!'],
    consolation: ['{scorer} pulls one back for {team}.', 'A goal for {team}, {scorer} with it.'],
    own: ['Oh no, it is an own goal! {team} gift them a goal.'],
  },
  half: ['That is half time. {home} {a}, {away} {b}.', 'The whistle goes for the break, {a} {b}.'],
  end: ['And that is full time! {winner} win it {a} {b}.', 'Full time, and a draw, {a} each.', 'The final whistle. {home} {a}, {away} {b}.'],
};
const ANALYSIS = {
  goal: ['What a finish, he picked his spot.', 'The defence will not be happy with that one.', 'Clinical. You give him a sight of goal and he punishes you.', 'Brilliant movement to get on the end of it.'],
  save: ['That is a top-class save, strong wrists.', 'Great positioning from the keeper there.'],
  miss: ['He will feel he should have done better.', 'Good chance, that.'],
  half: ['Plenty to think about in the dressing room.', 'It has been an open game so far.'],
};

export class Commentary {
  constructor(sound) {
    this.sound = sound; this.enabled = true; this.voiceURI = 'auto';
    this.queue = []; this.speaking = false; this.last = ''; this.lastAt = 0; this.passTalk = 0;
    this.voices = []; this.lead = null; this.co = null;
    if (typeof speechSynthesis !== 'undefined') {
      const load = () => { this.voices = speechSynthesis.getVoices(); this.pick(); };
      load(); speechSynthesis.addEventListener?.('voiceschanged', load);
    }
  }
  static rank(v) {
    const n = v.name;
    let s = 0;
    if (!/^en/i.test(v.lang)) return -100;
    if (/natural|neural/i.test(n)) s += 50;
    if (/online/i.test(n)) s += 20;
    if (/premium|enhanced/i.test(n)) s += 30;
    if (/google/i.test(n)) s += 18;
    if (/en-GB/i.test(v.lang)) s += 6;
    if (/guy|ryan|thomas|daniel|george|christopher|eric|brian|andrew|mark|david|arthur|oliver/i.test(n)) s += 5;
    if (/zira|hazel|susan/i.test(n)) s -= 2;
    return s;
  }
  list() { return this.voices.filter((v) => /^en/i.test(v.lang)).sort((a, b) => Commentary.rank(b) - Commentary.rank(a)); }
  pick() {
    const list = this.list();
    this.lead = (this.voiceURI !== 'auto' && list.find((v) => v.voiceURI === this.voiceURI)) || list[0] || null;
    this.co = list.find((v) => v !== this.lead && Commentary.rank(v) >= Commentary.rank(this.lead || v) - 25) || list[1] || this.lead;
  }
  setVoice(uri) { this.voiceURI = uri || 'auto'; this.pick(); }
  stop() { this.queue = []; try { speechSynthesis.cancel(); } catch { /* */ } this.speaking = false; }

  say(text, { prio = 1, excite = 0, co = false, ttl = 4 } = {}) {
    if (!this.enabled || !this.sound.on || typeof speechSynthesis === 'undefined' || !text) return;
    if (text === this.last) return;
    const now = performance.now() / 1000;
    if (prio >= 3 && this.speaking) { this.queue = this.queue.filter((q) => q.prio >= 3); speechSynthesis.cancel(); this.speaking = false; }
    this.queue.push({ text, prio, excite, co, until: now + ttl });
    this.queue.sort((a, b) => b.prio - a.prio);
    this.pump();
  }
  pump() {
    if (this.speaking) return;
    const now = performance.now() / 1000;
    this.queue = this.queue.filter((q) => q.until > now);
    const q = this.queue.shift();
    if (!q) return;
    const u = new SpeechSynthesisUtterance(q.text);
    const v = q.co ? this.co : this.lead;
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = 1.0 + q.excite * 0.22 + (q.co ? -0.05 : 0.04);
    u.pitch = (q.co ? 0.92 : 1.0) + q.excite * 0.18;
    u.volume = Math.min(1, this.sound.volume + 0.1);
    this.speaking = true; this.last = q.text; this.lastAt = now;
    this.sound.duck?.(true);
    const done = () => { this.speaking = false; this.sound.duck?.(false); setTimeout(() => this.pump(), 250); };
    u.onend = done; u.onerror = done;
    try { speechSynthesis.speak(u); } catch { done(); }
  }

  events(list, view, humanTeams) {
    if (!this.enabled || !view) return;
    const T = (i) => (view.teams[i] ? view.teams[i].name : '');
    const now = performance.now() / 1000;
    for (const e of list) {
      const d = { ...e, name: surname(e.name), team: T(e.team), home: T(0), away: T(1) };
      switch (e.type) {
        case 'kickoff': if (view.clock < 5) this.say(fill(rand(LINES.kickoff), d), { prio: 2, ttl: 8 }); break;
        case 'shot': this.say(fill(rand(e.dist > 22 ? LINES.shotFar : LINES.shot), d), { prio: 2, excite: 0.6, ttl: 1.6 }); break;
        case 'save':
          this.say(fill(rand(e.catch ? LINES.catch : LINES.save), d), { prio: 2, excite: e.catch ? 0.2 : 0.7, ttl: 2.5 });
          if (!e.catch && Math.random() < 0.4) this.say(rand(ANALYSIS.save), { prio: 1, co: true, ttl: 8 });
          break;
        case 'miss': this.say(fill(rand(LINES.miss), d), { prio: 2, excite: 0.4, ttl: 2 }); if (Math.random() < 0.3) this.say(rand(ANALYSIS.miss), { co: true, ttl: 7 }); break;
        case 'post': this.say(rand(LINES.post), { prio: 2, excite: 0.8, ttl: 2 }); break;
        case 'tackle': if (e.won && Math.random() < 0.35) this.say(fill(rand(e.slide ? LINES.slide : LINES.tackle), d), { ttl: 1.5 }); break;
        case 'pass': if (e.long && now - this.passTalk > 12 && Math.random() < 0.3) { this.passTalk = now; this.say(fill(rand(LINES.longPass), d), { ttl: 1.4 }); } break;
        case 'restart': break;   // spoken below, after the bigger moments of this frame
        case 'goal': {
          const [a, b] = e.score, us = e.team, them = 1 - us;
          const mine = e.score[us], theirs = e.score[them];
          const kind = e.own ? 'own' : e.minute >= 85 && mine >= theirs ? 'late' : a + b === 1 ? 'opener' : mine === theirs ? 'equaliser' : mine < theirs ? 'consolation' : 'lead';
          const dd = { ...d, scorer: surname(e.scorer), a: Math.max(mine, theirs), b: Math.min(mine, theirs), minute: e.minute };
          this.say(fill(rand(LINES.goal[kind]), dd), { prio: 3, excite: 1, ttl: 4 });
          if (kind !== 'own' && Math.random() < 0.7) this.say(rand(ANALYSIS.goal), { prio: 2, co: true, ttl: 12 });
          break;
        }
        case 'half': this.say(fill(rand(LINES.half), { ...d, a: view.score[0], b: view.score[1] }), { prio: 2, ttl: 8 }); this.say(rand(ANALYSIS.half), { co: true, ttl: 14 }); break;
        case 'end': {
          const [a, b] = e.score;
          const line = a === b && !e.pens ? LINES.end[1] : rand([LINES.end[0], LINES.end[2]]);
          const winner = e.pens ? T(e.pens[0] > e.pens[1] ? 0 : 1) : T(a > b ? 0 : 1);
          this.say(fill(line, { ...d, a: Math.max(a, b), b: Math.min(a, b), winner }), { prio: 3, ttl: 10 });
          break;
        }
        default:
      }
    }
    for (const e of list) {
      if (e.type !== 'restart') continue;
      const kind = e.kind;
      if (kind && LINES[kind] && (kind === 'penalty' || Math.random() < 0.5)) this.say(fill(rand(LINES[kind]), { name: surname(e.name), team: T(e.team) }), { prio: kind === 'penalty' ? 3 : 1, excite: kind === 'penalty' ? 0.8 : 0.2, ttl: 3 });
    }
  }
}
