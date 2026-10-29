// Verifies src/utils/liveTurns.ts without a browser.
//
//   npm run check:liveturns
//
// Every property here is a property of a LEVEL SEQUENCE, and every one of them
// fails in a way a single sitting would not show: a cough that opened a turn, a
// breath that closed one, the interviewer's own voice leaking out of the
// speakers and counted as the candidate talking over them, one interruption
// counted fourteen times. The module is imported, not re-implemented -- a check
// against a second copy of the logic proves nothing about the first.

import {
    LiveTurns, cleanInterruptions, rmsDb, DEFAULT_LIVE_OPTIONS, type LiveEvent, type LiveFrame,
} from '../../src/utils/liveTurns';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

const FRAME = 50;
const FLOOR = -60;

/** A segment of the synthetic room: `ms` long at `db`, with these flags. */
interface Seg { ms: number; db: number; listening?: boolean; ai?: boolean; muted?: boolean; hold?: boolean; jitter?: number }

/** Drive a LiveTurns through segments. Deterministic jitter, no Math.random. */
function run(segs: Seg[], lt = new LiveTurns(), startAt = 0): { events: LiveEvent[]; lt: LiveTurns; at: number } {
    const events: LiveEvent[] = [];
    let at = startAt;
    let n = 0;
    for (const s of segs) {
        for (let t = 0; t < s.ms; t += FRAME) {
            n++;
            const wobble = s.jitter ? Math.sin(n * 1.7) * s.jitter : 0;
            const frame: LiveFrame = {
                db: s.db + wobble, at, listening: !!s.listening, aiSpeaking: !!s.ai,
                muted: s.muted, hold: s.hold,
            };
            events.push(...lt.push(frame));
            at += FRAME;
        }
    }
    return { events, lt, at };
}
const of = (events: LiveEvent[], type: LiveEvent['type']) => events.filter(e => e.type === type);
const quiet = (ms: number, extra: Partial<Seg> = {}): Seg => ({ ms, db: FLOOR, jitter: 1.5, listening: true, ...extra });
const voice = (ms: number, extra: Partial<Seg> = {}): Seg => ({ ms, db: FLOOR + 25, jitter: 4, listening: true, ...extra });
const off = (ms: number): Seg => quiet(ms, { listening: false });
const ai = (ms: number, above: number, jitter = 2): Seg => ({ ms, db: FLOOR + above, jitter, ai: true });

console.log('\n1. An ordinary answer');
{
    const { events } = run([quiet(1000), voice(3000), quiet(2500)]);
    check('one speech-start', of(events, 'speech-start').length === 1, events);
    const ends = of(events, 'turn-end') as Extract<LiveEvent, { type: 'turn-end' }>[];
    check('one turn-end', ends.length === 1, events);
    const end = ends[0];
    check('the turn ends ~1.8 s after the voice stops, not sooner',
        !!end && end.at >= 4000 + DEFAULT_LIVE_OPTIONS.endSilenceMs - FRAME && end.at <= 4000 + 2100, end);
    check('the voiced time is roughly the three seconds spoken',
        !!end && end.voicedMs >= 2600 && end.voicedMs <= 3200, end);
}

console.log('\n2. Pauses inside an answer do not end it');
{
    const { events } = run([quiet(500), voice(2000), quiet(1000), voice(1500), quiet(1200), voice(1000), quiet(2500)]);
    check('a one-second breath and a 1.2 s pause do not end the turn early',
        of(events, 'turn-end').length === 1, events);
    const end = of(events, 'turn-end')[0];
    check('it ends after the LAST burst', !!end && end.at >= 8700, end);
}

console.log('\n3. Clicks, coughs and blips are not a turn');
{
    const { events } = run([quiet(1000), voice(150), quiet(3000)]);
    check('a 150 ms blip is not speech', of(events, 'speech-start').length === 0, events);
    check('and ends nothing', of(events, 'turn-end').length === 0, events);
    const short = run([quiet(1000), voice(500), quiet(3000)]).events;
    check('half a second of voice starts speech', of(short, 'speech-start').length === 1, short);
    check('but is too little to END a turn', of(short, 'turn-end').length === 0, short);
}

console.log('\n4. A turn is never ended while it is held, nor before anything is said');
{
    const { events } = run([quiet(500), voice(2000), quiet(4000, { hold: true })]);
    check('editing the transcript holds the turn open', of(events, 'turn-end').length === 0, events);
    const released = run([quiet(500), voice(2000), quiet(4000, { hold: true }), quiet(2000)]).events;
    check('and releasing it ends the turn after a fresh silence gap', of(released, 'turn-end').length === 1, released);
    const silent = run([quiet(10000)]).events;
    check('ten seconds of silence with nothing said ends nothing', silent.length === 0, silent);
    const notListening = run([voice(3000, { listening: false }), off(3000)]).events;
    check('voice outside a turn starts and ends nothing', notListening.length === 0, notListening);
}

console.log('\n5. One turn ends once; the next turn re-arms');
{
    const { events } = run([quiet(500), voice(2000), quiet(5000), voice(2000), quiet(3000)]);
    check('speech after the end of a turn does not end it twice', of(events, 'turn-end').length === 1, events);
    const two = run([quiet(500), voice(2000), quiet(2500), off(500), quiet(500), voice(2000), quiet(2500)]).events;
    check('a new listening window is a new turn', of(two, 'turn-end').length === 2, two);
}

console.log('\n6. The floor follows the room');
{
    // A fan coming on: the floor rises ~13 dB over ten seconds. Not speech.
    const segs: Seg[] = [];
    for (let i = 0; i < 20; i++) segs.push({ ms: 500, db: FLOOR + i * 0.7, jitter: 1, listening: true });
    const first = run(segs);
    check('a slowly rising room noise never "starts speaking"', first.events.length === 0, first.events);
    check('and the floor has followed it up', first.lt.floor > FLOOR + 8, first.lt.floor);
    const after = run([off(200), { ms: 1000, db: FLOOR + 13, listening: true },
        { ms: 2000, db: FLOOR + 13 + 25, jitter: 3, listening: true },
        { ms: 2500, db: FLOOR + 13, listening: true }], first.lt, first.at).events;
    check('speech over the noisier room still ends a turn', of(after, 'turn-end').length === 1, after);
    const down = run([quiet(2000, { db: -80 })]).lt;
    check('a quieter room is believed quickly', down.floor < -75, down.floor);
}

console.log('\n7. Muted is silence');
{
    const { events } = run([quiet(500), voice(3000, { muted: true }), quiet(3000)]);
    check('speech with the mic muted counts for nothing', events.length === 0, events);
    const m = run([{ ms: 3000, db: FLOOR + 30, ai: true, muted: true }]).events;
    check('and cannot interrupt anybody', m.length === 0, m);
}

console.log('\n8. The interviewer\'s own voice is not an interruption');
{
    const leak = run([off(1000), ai(6000, 8, 5)]).events;
    check('echo 8 dB over the floor for six seconds: no interruption', leak.length === 0, leak);
    const loud = run([off(1000), ai(6000, 22, 4)]).events;
    check('a LOUD leak (22 dB) is learned in the grace period: no interruption', loud.length === 0, loud);
    const bursty: Seg[] = [off(1000)];
    for (let i = 0; i < 12; i++) bursty.push(ai(300, 18, 0), ai(200, 6, 0));
    const b = run(bursty).events;
    check('syllable-shaped echo bursts never add up to an interruption', b.length === 0, b);
}

console.log('\n9. Talking over the interviewer IS an interruption');
{
    const { events } = run([off(1000), ai(1000, 6), ai(800, 30, 3), ai(1000, 6)]);
    const ints = of(events, 'interruption') as Extract<LiveEvent, { type: 'interruption' }>[];
    check('one interruption', ints.length === 1, events);
    check('reported ~1.6 s into the line (1 s + 600 ms sustained)',
        !!ints[0] && ints[0].msIntoUtterance >= 1500 && ints[0].msIntoUtterance <= 1750, ints[0]);
    const half = run([off(1000), ai(1000, 6), ai(500, 30), ai(1000, 6)]).events;
    check('half a second over the interviewer is not an interruption', half.length === 0, half);
    const grace = run([off(1000), ai(250, 30), ai(2000, 6)]).events;
    check('a sound only inside the first 300 ms counts for nothing', grace.length === 0, grace);
}

console.log('\n10. One interruption counts once');
{
    const long = run([off(1000), ai(600, 6), ai(4000, 30, 3)]).events;
    check('four seconds over one line is ONE interruption', of(long, 'interruption').length === 1, long);
    const twice = run([off(1000), ai(600, 6), ai(900, 30), ai(600, 6), ai(900, 30)]).events;
    check('even when it stops and starts again within the same line', of(twice, 'interruption').length === 1, twice);
    const next = run([off(1000), ai(600, 6), ai(900, 30), off(500), ai(600, 6), ai(900, 30)]).events;
    check('the NEXT line re-arms it', of(next, 'interruption').length === 2, next);
}

console.log('\n11. The AI\'s echo never teaches the room floor');
{
    const { lt } = run([off(1000), ai(8000, 20)]);
    check('eight seconds of loud interviewer leave the room floor where it was', lt.floor < FLOOR + 2, lt.floor);
}

console.log('\n12. Determinism, and the helpers');
{
    const segs = [quiet(700), voice(2300), quiet(2400)];
    check('the same levels give the same events', JSON.stringify(run(segs).events) === JSON.stringify(run(segs).events));
    check('rmsDb of silence is -Infinity', rmsDb(new Float32Array(64)) === -Infinity);
    const halfBuf = new Float32Array(64).fill(0.5);
    check('rmsDb of a 0.5 DC buffer is about -6 dB', Math.abs(rmsDb(halfBuf) + 6.02) < 0.05, rmsDb(halfBuf));
    // A throttled tab: two seconds of voice, then the next frame arrives a
    // minute later. The gap is clamped to one frame, so it is not 1.8 s of
    // silence and the turn does not end on it.
    const throttled = run([quiet(500), voice(2000)]);
    const gapEvents = throttled.lt.push({ db: FLOOR, at: throttled.at + 60000, listening: true, aiSpeaking: false });
    check('a long gap between frames is clamped (a throttled tab is not a silence)',
        of(gapEvents, 'turn-end').length === 0, gapEvents);
    const cleaned = cleanInterruptions([{ at: 'x', question: 2.4, ms_into_utterance: '1200.6' }, null, 'junk', { role: 'timer' }]);
    check('cleanInterruptions keeps well-formed records only', cleaned.length === 2 && cleaned[0].question === 2
        && cleaned[0].ms_into_utterance === 1201 && cleaned[1].role === 'timer', cleaned);
    check('and is bounded', cleanInterruptions(new Array(80).fill({ ms_into_utterance: 1 })).length === 50);
    check('and answers [] for anything not a list', cleanInterruptions('nope').length === 0);
}

console.log('');
if (failures) {
    console.log(`❌ liveTurns: ${failures} check(s) failed\n`);
    process.exit(1);
}
console.log('✅ liveTurns: all checks passed\n');
