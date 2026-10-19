// npm run check:speechcapture
//
// The answer microphone's decisions: what is speech, where an utterance ends,
// and which transcript lands first. No browser -- the segmenter is fed levels
// directly, which is the only way to replay "a quiet room, then a fan, then a
// cough, then a sentence" the same way every time.
//
// The two reported bugs are the first two sections: words appearing while
// nobody spoke (silence must never be SENT), and words being changed (a cut
// must never land inside speech).

import {
    DEFAULT_SEGMENTER, OrderedResults, SpeechSegmenter, rmsDb, transcriptContext,
} from '../../src/utils/speechSegmenter';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

const F = DEFAULT_SEGMENTER.frameMs;

/** Feed `ms` of one level; collect every cut. */
function feed(seg: SpeechSegmenter, db: number, ms: number, cuts: any[] = [], speaking: boolean[] = []) {
    for (let t = 0; t < ms; t += F) {
        const r = seg.push(db);
        speaking.push(r.speaking);
        if (r.cut) cuts.push(r.cut);
    }
    return cuts;
}

/** Speech that wobbles like a voice: syllables a few dB apart. */
function speech(seg: SpeechSegmenter, baseDb: number, ms: number, cuts: any[] = []) {
    for (let t = 0, i = 0; t < ms; t += F, i++) {
        const r = seg.push(baseDb + ((i % 4) - 1.5) * 2);
        if (r.cut) cuts.push(r.cut);
    }
    return cuts;
}

console.log('\n1. Silence is never sent');
{
    for (const [room, db] of [['a quiet bedroom', -70], ['a laptop fan', -48], ['a busy café', -38]] as const) {
        const seg = new SpeechSegmenter();
        const cuts = feed(seg, db, 30000);
        check(`${room} (${db} dB) for 30 s: nothing is kept`, cuts.every(c => !c.keep), cuts.filter(c => c.keep));
        check(`${room}: the recorder is recycled rather than growing for ever`, cuts.length >= 5, cuts.length);
        const flush = seg.flush();
        check(`${room}: pausing in silence sends nothing`, !flush.keep);
    }
    // Room noise that WOBBLES -- breathing, a fan's beat -- is still not speech.
    const seg = new SpeechSegmenter();
    const cuts: any[] = [];
    for (let i = 0; i < 600; i++) { const r = seg.push(-50 + (i % 3) * 2); if (r.cut) cuts.push(r.cut); }
    check('fluctuating room noise is learned as the floor, not taken for speech', cuts.every(c => !c.keep), cuts);
}

console.log('\n2. Typing and coughs are not speech');
{
    const seg = new SpeechSegmenter();
    feed(seg, -65, 1000);
    const cuts: any[] = [];
    // Key presses: single loud frames among quiet ones -- the candidate edits
    // their answer while the microphone is open.
    for (let k = 0; k < 40; k++) { const a = seg.push(-25); if (a.cut) cuts.push(a.cut); feed(seg, -65, 200, cuts); }
    feed(seg, -65, 1000, cuts);
    const flush = seg.flush();
    check('forty key presses produce no kept segment', cuts.every(c => !c.keep) && !flush.keep, { cuts, flush });
    const seg2 = new SpeechSegmenter();
    feed(seg2, -65, 1000);
    const cough = feed(seg2, -20, 100);
    feed(seg2, -65, 2000, cough);
    check('a single cough is not an utterance', cough.every(c => !c.keep) && !seg2.flush().keep, cough);
}

console.log('\n3. Speech is kept, and cut only in a pause');
{
    const seg = new SpeechSegmenter();
    feed(seg, -60, 1000);
    const cuts: any[] = [];
    speech(seg, -30, 2500, cuts);
    check('no cut while speaking', cuts.length === 0, cuts);
    feed(seg, -60, 300, cuts);
    check('a 300 ms breath between words is NOT a cut -- that is where words got split', cuts.length === 0, cuts);
    speech(seg, -30, 1500, cuts);
    feed(seg, -60, 900, cuts);
    check('a real pause after a phrase ends the utterance', cuts.length === 1 && cuts[0].keep && cuts[0].reason === 'pause', cuts);
    check('and it carries the voiced time', cuts[0]?.voicedMs >= 3500, cuts[0]);

    // A quiet speaker in a quiet room.
    const quiet = new SpeechSegmenter();
    feed(quiet, -72, 1000);
    const q: any[] = [];
    speech(quiet, -52, 2000, q);
    feed(quiet, -72, 900, q);
    check('a quiet speaker in a quiet room is kept', q.length === 1 && q[0].keep, q);

    // A loud room: speech well above the café floor.
    const cafe = new SpeechSegmenter();
    feed(cafe, -38, 2000);
    const c: any[] = [];
    speech(cafe, -22, 2000, c);
    feed(cafe, -38, 900, c);
    check('speech over a café is kept -- the threshold follows the room', c.length === 1 && c[0].keep, c);
    check('and the café is not mistaken for speech beforehand', cafe.noiseFloor < -30, cafe.noiseFloor);
}

console.log('\n4. Somebody who never pauses');
{
    const seg = new SpeechSegmenter();
    feed(seg, -60, 500);
    const cuts: any[] = [];
    speech(seg, -30, 13000, cuts);
    check('no cut inside continuous speech before the soft limit', cuts.length === 0, cuts);
    feed(seg, -60, 300, cuts);
    check('past twelve seconds a SHORT pause is enough', cuts.length === 1 && cuts[0].reason === 'soft-max', cuts);
    const run = new SpeechSegmenter();
    feed(run, -60, 500);
    const r: any[] = [];
    speech(run, -30, 21000, r);
    check('with no pause at all, cut at twenty seconds as a last resort', r.length === 1 && r[0].reason === 'hard-max' && r[0].keep, r);
}

console.log('\n5. The floor follows the room, slowly enough');
{
    const seg = new SpeechSegmenter();
    feed(seg, -70, 1000);
    speech(seg, -30, 15000);
    check('fifteen seconds of speech does not teach the floor that speech is background',
        seg.noiseFloor < -55, seg.noiseFloor);
    // The speech segment is closed first, so what follows measures the FAN
    // alone -- otherwise the kept segment is the fifteen seconds of speech.
    seg.flush();
    const fanCuts = feed(seg, -45, 6000);
    const fanTail = seg.flush();
    if (fanTail.voicedMs) fanCuts.push(fanTail);
    check('a fan that starts is learned within seconds', seg.noiseFloor > -48, seg.noiseFloor);
    check('and the fan itself is never sent as speech -- beyond the moment it starts',
        fanCuts.filter(c => c.keep).every(c => c.voicedMs <= 2000), fanCuts);
    const after: any[] = [];
    speech(seg, -25, 2000, after);
    feed(seg, -45, 900, after);
    check('speech over the fan is still heard once the fan is learned', after.length === 1 && after[0].keep, after);
    check('the threshold is never below the absolute minimum', seg.threshold() >= DEFAULT_SEGMENTER.minSpeechDb);
}

console.log('\n6. Levels');
{
    check('silence is -100 dB, not -Infinity', rmsDb(new Float32Array(1024)) === -100);
    const full = new Float32Array(1024).fill(1);
    check('a full-scale signal is 0 dB', Math.abs(rmsDb(full)) < 0.001);
    const half = new Float32Array(1024).fill(0.5);
    check('half amplitude is about -6 dB', Math.abs(rmsDb(half) + 6.02) < 0.05, rmsDb(half));
    check('a NaN level counts as silence, not speech', !new SpeechSegmenter().push(NaN).speaking);
}

console.log('\n7. Transcripts land in the order they were spoken');
{
    const applied: string[] = [];
    const o = new OrderedResults(t => applied.push(t));
    const a = o.issue(); const b = o.issue(); const c = o.issue();
    check('three sent, three pending', o.pending === 3);
    o.resolve(c, 'third');
    o.resolve(b, 'second');
    check('later utterances wait for the first', applied.length === 0 && o.pending === 3, applied);
    o.resolve(a, 'first');
    check('then all three apply, in spoken order', applied.join(' ') === 'first second third', applied);
    check('nothing pending', o.pending === 0);
    const d = o.issue(); const e = o.issue();
    o.resolve(e, 'after the gap');
    o.resolve(d, '');
    check('a failed upload resolves as empty and does not block the rest', applied[applied.length - 1] === 'after the gap' && o.pending === 0, applied);
    o.resolve(a, 'duplicate');
    check('a late duplicate is ignored', !applied.includes('duplicate'));
}

console.log('\n8. Context for Whisper');
{
    check('a short answer is passed whole', transcriptContext('I used Helm') === 'I used Helm');
    const long = 'word '.repeat(300).trim();
    const ctx = transcriptContext(long, 100);
    check('a long one keeps the END, within the limit', ctx.length <= 100 && long.endsWith(ctx), ctx.length);
    check('and starts on a word', !ctx.startsWith('ord'), ctx.slice(0, 10));
    check('whitespace is collapsed', transcriptContext('a\n\n  b') === 'a b');
}

console.log(failures === 0
    ? '\n✅ speech capture: all checks passed\n'
    : `\n❌ speech capture: ${failures} check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
