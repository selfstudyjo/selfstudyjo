// Verifies src/utils/examShuffle.ts without a browser.
//
//   npm run check:examshuffle
//
// The module reorders exam answers so the correct one is not always first.
// Measured against the live exams on 2026-08-19: **70 of 89 questions had the
// correct answer at index 0** (79%), against a 70% pass mark, so the papers were
// passable without reading them.
//
// Four of the properties below are the ones that fail silently, and they are why
// this is a plain module rather than four lines inside the component:
//
//   * STABILITY. The order is read inside a computed that re-evaluates on every
//     selection, every timer tick and every re-render. A shuffle that is not a
//     pure function of its inputs walks the options around under the candidate's
//     finger and makes the selected row appear to move.
//   * IT MUST BE A PERMUTATION. A shuffle that drops or duplicates an option is a
//     question with a missing answer, and it would look like bad exam data.
//   * ALL PERMUTATIONS MUST BE REACHABLE. The classic off-by-one Fisher-Yates
//     (`random() * n` instead of `random() * (i + 1)`) is biased and cannot
//     produce some orders at all - which on a 4-option question means one option
//     that never appears in a given slot.
//   * AND THE DISTRIBUTION HAS TO ACTUALLY BE FLAT, or the exercise is pointless.

import {
    attemptSeed,
    shuffleAnswers,
    type ShufflableAnswer,
} from '../../src/utils/examShuffle';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

interface A extends ShufflableAnswer { external_id: string; is_correct: boolean }

const answers = (n: number, correctAt = 0): A[] =>
    Array.from({ length: n }, (_, i) => ({ external_id: `a${i}`, is_correct: i === correctAt }));

const ids = (rows: ShufflableAnswer[]) => rows.map(r => r.external_id).join(',');

console.log('\n1. The order never moves');
{
    const list = answers(4);
    const first = ids(shuffleAnswers(list, 'q1', 'appt-1'));
    let stable = true;
    for (let i = 0; i < 200; i++) {
        if (ids(shuffleAnswers(list, 'q1', 'appt-1')) !== first) stable = false;
    }
    check('200 calls with the same seed and question give the same order', stable, first);

    // The component re-reads this on every keystroke and every second of the
    // timer; a fresh array each time (Vue hands a new one after a store update)
    // must not change the answer.
    const copy = list.map(a => ({ ...a }));
    check('and a structurally equal but different array gives the same order',
        ids(shuffleAnswers(copy, 'q1', 'appt-1')) === first);
}

console.log('\n2. It is a permutation, and the input is left alone');
{
    const list = answers(5);
    const before = ids(list);
    const out = shuffleAnswers(list, 'q9', 'appt-1');
    check('the input array is not mutated', ids(list) === before, ids(list));
    check('nothing is lost or duplicated',
        [...out].map(a => a.external_id).sort().join(',')
        === [...list].map(a => a.external_id).sort().join(','), ids(out));
    check('the count is unchanged', out.length === list.length);
    check('the objects are the SAME references, so `selected` comparisons hold',
        out.every(a => list.includes(a as A)));
}

console.log('\n3. Edge cases return something usable');
{
    check('undefined answers give an empty array',
        Array.isArray(shuffleAnswers(undefined, 'q')) && shuffleAnswers(undefined, 'q').length === 0);
    check('null answers give an empty array',
        shuffleAnswers(null, 'q').length === 0);
    check('an empty list stays empty', shuffleAnswers([], 'q').length === 0);
    const one = answers(1);
    check('a single answer is returned as-is', ids(shuffleAnswers(one, 'q')) === 'a0');
    check('and is still a copy, not the original array',
        shuffleAnswers(one, 'q') !== one);
    check('an empty seed still produces a stable order',
        ids(shuffleAnswers(answers(4), 'q', '')) === ids(shuffleAnswers(answers(4), 'q', '')));
}

console.log('\n4. Every permutation is reachable - the shuffle is not biased');
{
    // A 3-option question has 6 orders. The off-by-one Fisher-Yates cannot
    // produce all of them; this is the cheapest test that catches it.
    const seen = new Set<string>();
    for (let i = 0; i < 4000; i++) seen.add(ids(shuffleAnswers(answers(3), `q${i}`, 'appt-1')));
    check('all 6 orders of a 3-option question appear', seen.size === 6,
        [...seen].sort());

    const seen4 = new Set<string>();
    for (let i = 0; i < 20000; i++) seen4.add(ids(shuffleAnswers(answers(4), `q${i}`, 'appt-1')));
    check('all 24 orders of a 4-option question appear', seen4.size === 24, seen4.size);
}

console.log('\n5. The correct answer is spread across the positions');
{
    // The real shape: 4 options, correct one first, which is what 79% of the live
    // questions look like. If the distribution is not flat this whole module is
    // theatre.
    const at = [0, 0, 0, 0];
    const N = 8000;
    for (let i = 0; i < N; i++) {
        const out = shuffleAnswers(answers(4, 0), `question-${i}`, 'appt-1');
        at[out.findIndex(a => (a as A).is_correct)]++;
    }
    const expected = N / 4;
    const worst = Math.max(...at.map(n => Math.abs(n - expected) / expected));
    console.log(`        positions: ${at.join(', ')}   (expected ~${expected} each)`);
    check('the correct answer lands in every slot', at.every(n => n > 0), at);
    check('and within 10% of even - not 79% at index 0', worst < 0.1,
        { at, worstDeviation: `${Math.round(worst * 1000) / 10}%` });
}

console.log('\n5b. Unbiased on REAL key shapes, not just tidy ones');
{
    // Section 5 keys on `question-0`, `question-1`, ... which differ in the last
    // character or two. Real ids are uuid4s and the seed is an
    // `exam_appt_1787154047017_p7hppxakf` - long, high-entropy, and similar to
    // each other only in their prefix. A hash that mixes badly can be flat on tidy
    // keys and skewed on those, so the realistic shape is checked too.
    //
    // This was worth doing rather than assuming: sampling ONE appointment against
    // the 89 live questions gave 36% at index 0, not 25%. Across 2000 seeds the
    // shares are 25.01 / 25.03 / 25.01 / 24.94 - so that was one unlucky draw
    // (2.4 sd, and 1.7% of seeds are at least that high), not a weak hash. Worth
    // knowing when reading a single paper: the per-paper share has a standard
    // deviation of about 4.6 points, so one candidate's exam can easily show the
    // correct answer first a third of the time by chance.
    const uuid = (n: number) => {
        // Deterministic uuid4-shaped ids, so the check does not need a fixture
        // file and does not vary between runs.
        let x = 0x9e3779b1 ^ n;
        const hex = (len: number) => {
            let out = '';
            for (let i = 0; i < len; i++) {
                x = (Math.imul(x ^ (x >>> 15), 0x85ebca6b) + 0x165667b1) >>> 0;
                out += (x & 0xf).toString(16);
            }
            return out;
        };
        return `${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`;
    };

    const SEEDS = 300;
    const QUESTIONS = 89;                       // the live count
    const at = [0, 0, 0, 0];
    const perSeed: number[] = [];
    for (let sIdx = 0; sIdx < SEEDS; sIdx++) {
        const seed = `exam_appt_17871540470${String(sIdx).padStart(4, '0')}_p7hppxakf`;
        let zero = 0;
        for (let q = 0; q < QUESTIONS; q++) {
            const out = shuffleAnswers(answers(4, 0), uuid(q), seed);
            const i = out.findIndex(a => (a as A).is_correct);
            at[i]++;
            if (i === 0) zero++;
        }
        perSeed.push(zero / QUESTIONS);
    }
    const total = SEEDS * QUESTIONS;
    const shares = at.map(v => v / total);
    console.log(`        positions: ${shares.map(v => (v * 100).toFixed(2) + '%').join('  ')}`);
    check('uuid-shaped question ids give a flat distribution',
        shares.every(v => Math.abs(v - 0.25) < 0.02), shares);

    // And no single seed may be catastrophic - a paper where the correct answer is
    // first most of the time would be back where we started.
    const worst = Math.max(...perSeed);
    check('no single paper has the correct answer first more than half the time',
        worst < 0.5, { worstSeedShare: worst });
}

console.log('\n6. Two candidates do not see the same paper');
{
    // The point of seeding on the appointment: neighbours cannot compare
    // "it's the second one".
    let differ = 0;
    const QUESTIONS = 40;
    for (let i = 0; i < QUESTIONS; i++) {
        const a = ids(shuffleAnswers(answers(4), `q${i}`, 'user-alice'));
        const b = ids(shuffleAnswers(answers(4), `q${i}`, 'user-bob'));
        if (a !== b) differ++;
    }
    check('most questions differ between two candidates', differ >= QUESTIONS * 0.6,
        `${differ}/${QUESTIONS}`);

    // A retake DOES repeat the order, and that is the documented trade: the seed
    // is the candidate, so `ReviewResults` can reproduce the paper they sat. Held
    // as an assertion rather than left implicit, because it is the kind of
    // property somebody "fixes" by seeding on the appointment again - which
    // silently makes the review screen disagree with the exam.
    let retakeSame = 0;
    for (let i = 0; i < QUESTIONS; i++) {
        if (ids(shuffleAnswers(answers(4), `q${i}`, 'user-alice'))
            === ids(shuffleAnswers(answers(4), `q${i}`, 'user-alice'))) retakeSame++;
    }
    check('a retake by the same candidate repeats the order - so the review '
        + 'screen can reproduce it', retakeSame === QUESTIONS,
        `${retakeSame}/${QUESTIONS}`);

    // Different questions in one paper must not share one permutation either.
    const orders = new Set<string>();
    for (let i = 0; i < QUESTIONS; i++) orders.add(ids(shuffleAnswers(answers(4), `q${i}`, 'appt-1')));
    check('and questions within one paper vary', orders.size >= 8, orders.size);
}

console.log('\n7. The seed');
{
    check('the USER wins when present - the review screen depends on it',
        attemptSeed('user-1', 'appt-1') === 'user-1');
    check('the appointment is the fallback, so a signed-out practice run still '
        + 'gets its own order', attemptSeed(null, 'appt-1') === 'appt-1');
    check('and neither gives an empty seed, not "null"',
        attemptSeed(null, null) === '' && attemptSeed(undefined, undefined) === '');
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
