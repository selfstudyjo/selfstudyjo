// Self-Study Football - leagues, groups and knockout cups. Plain module (no DOM).
//
// The student's own matches are played; every other match of the same round is
// simulated from the two teams' ratings (engine.quickResult), so a 48-nation cup
// costs one played match per round. A tournament is a plain JSON object and is
// saved to localStorage after every round, so it survives a closed window.
import { competitionById, teamById } from './data.mjs';
import { quickResult } from './engine.mjs';

export function createTournament(compId, teamId, opts = {}) {
  const c = competitionById(compId);
  if (!c) throw new Error('Unknown competition');
  const teams = c.teams.slice();
  if (!teams.includes(teamId)) throw new Error('That team is not in this competition');
  const t = { v: 1, id: 't' + Date.now().toString(36), comp: c.id, name: c.name, kind: c.kind, team: teamId,
    difficulty: opts.difficulty || 'pro', minutes: opts.minutes || 4, size: c.size || opts.size || 11,
    teams, stage: '', round: 0, fixtures: [], table: {}, groups: [], champion: null, out: false, log: [] };
  if (c.kind === 'league') { t.stage = 'league'; t.fixtures = roundRobin(teams, c.rounds || 1).map((f) => ({ ...f, stage: 'league' })); initTable(t, teams); }
  else if (c.kind === 'groups') {
    t.stage = 'groups'; t.advance = c.advance || 2; t.bestThirds = c.bestThirds || 0;
    t.groups = drawGroups(teams, c.groups);
    t.groups.forEach((g, gi) => roundRobin(g, 1).forEach((f) => t.fixtures.push({ ...f, stage: 'groups', group: gi })));
    initTable(t, teams);
  } else { t.stage = 'ko'; t.fixtures = koRound(seedOrder(teams), 0); }
  return t;
}

const sortStrength = (ids) => ids.slice().sort((a, b) => teamById(b).strength - teamById(a).strength);
function seedOrder(ids) { // 1 v 8, 4 v 5, 2 v 7, 3 v 6 ...
  const s = sortStrength(ids), n = s.length, out = [];
  const pairs = []; for (let i = 0; i < n / 2; i++) pairs.push([s[i], s[n - 1 - i]]);
  const order = bracketOrder(n / 2);
  for (const i of order) out.push(...pairs[i]);
  return out;
}
function bracketOrder(n) { let o = [0]; while (o.length < n) { const m = o.length * 2; o = o.flatMap((x) => [x, m - 1 - x]); } return o; }
function drawGroups(ids, n) {
  const s = sortStrength(ids), groups = Array.from({ length: n }, () => []);
  s.forEach((id, i) => { const pot = Math.floor(i / n); groups[pot % 2 ? n - 1 - (i % n) : i % n].push(id); });
  return groups;
}
export function roundRobin(ids, rounds = 1) {
  const list = ids.slice(); if (list.length % 2) list.push(null);
  const n = list.length, out = [];
  for (let leg = 0; leg < rounds; leg++) {
    const a = list.slice();
    for (let r = 0; r < n - 1; r++) {
      for (let i = 0; i < n / 2; i++) {
        const h = a[i], w = a[n - 1 - i];
        if (h && w) out.push({ round: leg * (n - 1) + r, home: (r + leg) % 2 ? w : h, away: (r + leg) % 2 ? h : w });
      }
      a.splice(1, 0, a.pop());
    }
  }
  return out;
}
function koRound(order, round) {
  const out = [];
  for (let i = 0; i < order.length; i += 2) out.push({ round, stage: 'ko', home: order[i], away: order[i + 1], slot: i / 2 });
  return out;
}
function initTable(t, ids) { for (const id of ids) t.table[id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; }

export function standings(t, ids) {
  return (ids || Object.keys(t.table)).map((id) => ({ id, ...t.table[id] }))
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || teamById(b.id).strength - teamById(a.id).strength);
}
export function roundName(t, f) {
  if (f.stage === 'league') return `Matchday ${f.round + 1}`;
  if (f.stage === 'groups') return `Group ${String.fromCharCode(65 + f.group)} · Matchday ${f.round + 1}`;
  const left = t.fixtures.filter((x) => x.stage === 'ko' && x.round === f.round).length * 2;
  return { 2: 'Final', 4: 'Semi-final', 8: 'Quarter-final', 16: 'Round of 16', 32: 'Round of 32' }[left] || `Round of ${left}`;
}
const pending = (t) => t.fixtures.filter((f) => !f.result);
const currentRound = (t) => { const p = pending(t); return p.length ? Math.min(...p.map((f) => f.round)) : null; };

// The student's next match, or null when they are out or it is over.
export function nextMatch(t) {
  if (t.champion) return null;
  const r = currentRound(t);
  if (r == null) return null;
  return t.fixtures.find((f) => !f.result && f.round === r && (f.home === t.team || f.away === t.team)) || null;
}

// Record a result (played or simulated) and simulate the rest of the round.
export function record(t, fixture, result) {
  apply(t, fixture, result);
  const r = fixture.round;
  for (const f of t.fixtures) if (!f.result && f.round === r) apply(t, f, quickResult(teamById(f.home), teamById(f.away), t.id + f.home + f.away, f.stage === 'ko'));
  advance(t);
}
// Simulate a whole round the student is not in (after elimination, or a bye).
export function simulateRound(t) {
  const r = currentRound(t);
  if (r == null) return advance(t);
  for (const f of t.fixtures) if (!f.result && f.round === r) apply(t, f, quickResult(teamById(f.home), teamById(f.away), t.id + f.home + f.away + r, f.stage === 'ko'));
  advance(t);
}
function apply(t, f, res) {
  f.result = { score: res.score.slice(), pens: res.pens || null };
  t.log.push(`${roundName(t, f)}: ${teamById(f.home).name} ${res.score[0]}-${res.score[1]} ${teamById(f.away).name}${res.pens ? ` (${res.pens[0]}-${res.pens[1]} pens)` : ''}`);
  if (f.stage !== 'ko') {
    const [a, b] = res.score, H = t.table[f.home], A = t.table[f.away];
    H.p++; A.p++; H.gf += a; H.ga += b; A.gf += b; A.ga += a;
    if (a > b) { H.w++; A.l++; H.pts += 3; } else if (a < b) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  }
}
export function winnerOf(f) {
  if (!f.result) return null;
  const [a, b] = f.result.score;
  if (a !== b) return a > b ? f.home : f.away;
  return f.result.pens && f.result.pens[0] > f.result.pens[1] ? f.home : f.away;
}
function advance(t) {
  if (pending(t).length) return;
  if (t.stage === 'league') {
    t.champion = standings(t)[0].id;
    if (t.champion !== t.team) t.out = true;
    return;
  }
  if (t.stage === 'groups') {
    const qualified = [], thirds = [];
    t.groups.forEach((g) => { const s = standings(t, g); qualified.push(...s.slice(0, t.advance).map((x) => x.id)); if (s[t.advance]) thirds.push(s[t.advance]); });
    if (t.bestThirds) {
      thirds.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      qualified.push(...thirds.slice(0, t.bestThirds).map((x) => x.id));
    }
    let n = 1; while (n * 2 <= qualified.length) n *= 2;
    const through = sortByGroupFinish(t, qualified).slice(0, n);
    if (!through.includes(t.team)) t.out = true;
    t.stage = 'ko';
    const base = Math.max(...t.fixtures.map((f) => f.round)) + 1;
    t.fixtures.push(...koRound(seedOrder(through), base));
    return;
  }
  const last = Math.max(...t.fixtures.map((f) => f.round));
  const round = t.fixtures.filter((f) => f.round === last && f.stage === 'ko');
  const winners = round.sort((a, b) => a.slot - b.slot).map(winnerOf);
  if (!winners.includes(t.team)) t.out = true;
  if (winners.length === 1) { t.champion = winners[0]; return; }
  t.fixtures.push(...koRound(winners, last + 1));
}
function sortByGroupFinish(t, ids) {
  return ids.slice().sort((a, b) => {
    const A = t.table[a], B = t.table[b];
    return B.pts - A.pts || (B.gf - B.ga) - (A.gf - A.ga) || B.gf - A.gf;
  });
}

// ---- saving
const KEY = 'sfs-football-tournaments';
export function saved() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
export function save(t) {
  const all = saved().filter((x) => x.id !== t.id); all.unshift(t);
  try { localStorage.setItem(KEY, JSON.stringify(all.slice(0, 12))); } catch { /* storage full */ }
}
export function remove(id) { try { localStorage.setItem(KEY, JSON.stringify(saved().filter((x) => x.id !== id))); } catch { /* */ } }
