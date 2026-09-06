// Verifies the public leaderboard without a browser.
//
//   npm run check:leaderboard
//
// Two halves, and the second one is the unusual part.
//
// THE MODEL. `src/utils/leaderboardEngine.ts` is imported, never
// re-implemented — a check written against a second copy of the logic proves
// nothing about the first, which is the trap app 23's identity e2e fell into
// (its stub answered the same wrong endpoint the code did, so eight checks
// passed against a validator that refused the entire happy path). What is
// asserted here is the set of properties nobody can see by looking at one
// afternoon's board: that a retake cannot buy a rank, that the order is total,
// that equal points share a number, and that the window filters events before
// the dedupe rather than after it.
//
// THE PALETTE. The page draws charts into a canvas, and a canvas cannot read a
// CSS custom property — so the colours are resolved from the theme at runtime
// and there is nothing in the stylesheets for `check:theme` to verify. This
// check closes that gap: it resolves `--sfs-accent` against the card surface in
// all ten galaxies and asserts the 3:1 mark-contrast floor, and it reads the
// chart component as text and fails if a SECOND accent is ever introduced as a
// series colour. That second assertion is the important one, because the reason
// there is only one hue is measured rather than stylistic: no pair of a
// galaxy's accents clears the normal-vision separation floor in all ten, and
// Triangulum's accent and accent-2 are ΔE 0.8 apart under deuteranopia — the
// same colour to a deuteranope. A future "let us colour exams and quizzes
// differently" would be unreadable in a third of the galaxies and would look
// completely fine to whoever wrote it.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    DISTINCTION_SCORE,
    MASTERY_FROM,
    masteryBonus,
    POINTS,
    SCORE_BANDS,
    WINDOWS,
    WINDOW_DAYS,
    WINDOW_LABEL,
    activitySeries,
    aggregate,
    bestAttempts,
    buildBoard,
    compact,
    compareRows,
    delta,
    inRange,
    initialsOf,
    isDated,
    matchesQuery,
    pointsFor,
    previousRange,
    rank,
    scoreDistribution,
    tableFor,
    topSubjects,
    windowRange,
    type BoardWindow,
    type LeaderboardEvent,
} from '../../src/utils/leaderboardEngine';
import { contrastRatio, over, parseColor, toHex } from '../../src/theme/contrast';
import { THEMES } from '../../src/theme/themes';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
}

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

/**
 * Source with its comments removed.
 *
 * Needed because several assertions below are of the form "this file must not
 * mention X", and the comment explaining *why* it must not mention X naturally
 * mentions X. Without this, the service's own paragraph on why `/exams/` is
 * never fetched is what fails the check that `/exams/` is never fetched.
 */
function code(relative: string): string {
    return source(relative)
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * CSS with every `var(...)` removed, parens balanced.
 *
 * A regex cannot do this: the fallback is itself a function call —
 * `var(--sfs-border, rgba(255, 255, 255, 0.14))` — so `var\([^()]*\)` stops at
 * the first inner `)` and leaves the literal behind. That is not a nitpick; it
 * is the difference between the "no colour literal" check reading the fallbacks,
 * where literals belong, and reading the declarations, where they do not.
 */
function stripVars(css: string): string {
    let out = '';
    for (let i = 0; i < css.length;) {
        if (css.startsWith('var(', i)) {
            let depth = 0;
            let j = i + 3;
            for (; j < css.length; j++) {
                if (css[j] === '(') depth++;
                else if (css[j] === ')') { depth--; if (depth === 0) { j++; break; } }
            }
            i = j;
            continue;
        }
        out += css[i++];
    }
    return out;
}

// A fixed "now", so what is tested is the windows and not the clock.
const NOW = new Date('2026-08-24T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => NOW - days * DAY;

function ev(over_: Partial<LeaderboardEvent> = {}): LeaderboardEvent {
    return {
        kind: 'exam', userId: 'u1', name: 'Aya Nasser',
        subjectId: 's1', score: 80, passed: true, at: ago(1),
        ...over_,
    };
}

/* ================================================================== */
console.log('\n1. What an achievement is worth');
{
    check('an exam outranks a quiz', POINTS.examPassed > POINTS.quizPassed);
    check('a course certificate outranks an exam', POINTS.courseCertificate > POINTS.examPassed);
    /*
      The one that is easy to "fix" and must not be.

      App 20 issues an exam certificate automatically on a pass, so scoring both
      pays twice for one achievement — every exam pass would quietly be worth
      250 rather than 100, and the certificates issued by hand before that
      mechanism existed would pay their owners for exams they may never have sat.
    */
    check('an exam certificate is worth nothing — the pass already scored',
        POINTS.examCertificate === 0);

    /*
      THE MARK IS A SLOPE, NOT A CLIFF.

      These four checks used to lock in a flat 100 for every pass from 70 to 89
      and a flat +25 at exactly 90. Both halves of that were wrong in ways
      anybody could see on two rows of the board: nineteen marks of difference
      scoring identically, and one question either side of a round number
      scoring a quarter of the whole pass apart. `masteryBonus` replaced it and
      these are the properties that replaced them.
    */
    check('a bare pass at the reference mark earns the base and no more',
        pointsFor(ev({ score: MASTERY_FROM })) === POINTS.examPassed);
    check('full marks earn the base plus the whole mastery award',
        pointsFor(ev({ score: 100 })) === POINTS.examPassed + POINTS.mastery);
    check('70 and 89 are no longer the same score',
        pointsFor(ev({ score: 89 })) > pointsFor(ev({ score: 70 })),
        [pointsFor(ev({ score: 70 })), pointsFor(ev({ score: 89 }))]);
    check('and the old distinction mark is no longer a cliff',
        pointsFor(ev({ score: DISTINCTION_SCORE }))
        - pointsFor(ev({ score: DISTINCTION_SCORE - 1 })) <= 3,
        [pointsFor(ev({ score: 89 })), pointsFor(ev({ score: 90 }))]);
    check('the slope is monotone across the whole range',
        Array.from({ length: 101 }, (_, s) => pointsFor(ev({ score: s })))
            .every((value, index, all) => index === 0 || value >= all[index - 1]!));
    check('DISTINCTION_SCORE is still a real threshold, for the COUNT and the '
        + 'band edge rather than for a payment',
        DISTINCTION_SCORE > MASTERY_FROM && DISTINCTION_SCORE < 100);

    /*
      AND A FAILED ATTEMPT IS NOT NOTHING.

      The other cliff, and the sharper one: 69 earned zero and 70 earned a
      hundred, so four honest papers and three near misses scored the same as
      never having opened the platform. It is safe to pay for because
      `bestAttempts` collapses the re-sits - checked below.
    */
    check('an honest failed attempt earns the attempt credit',
        pointsFor(ev({ score: 64, passed: false })) === POINTS.attempted);
    check('and it is small enough that failing is never a strategy',
        POINTS.attempted < POINTS.quizPassed
        && POINTS.attempted * 8 < POINTS.examPassed);
    check('a sitting voided for cheating earns nothing at all - the board and '
        + 'the ledger must not disagree about the same afternoon',
        pointsFor(ev({ score: 99, passed: false, integrityStatus: 'failed' })) === 0);
    check('a WARNED sitting is not a voided one and keeps the credit',
        pointsFor(ev({ score: 40, passed: false, integrityStatus: 'warned' }))
        === POINTS.attempted);
    check('a failed attempt with no score is not an attempt',
        pointsFor(ev({ score: null, passed: false })) === 0);
    check('and a failed certificate is still worth nothing - there is no such '
        + 'thing as attempting one',
        pointsFor(ev({ kind: 'course_certificate', score: null, passed: false }))
        === 0);
    check('a certificate has no score and takes no mastery bonus',
        pointsFor(ev({ kind: 'course_certificate', score: null }))
        === POINTS.courseCertificate);
}

/* ================================================================== */
console.log('\n2. One attempt per assessment — the property the board rests on');
{
    // Forty attempts at one quiz. Without the dedupe this is 800 points and
    // beats passing eight exams, and nothing anywhere says so.
    const grinder = Array.from({ length: 40 }, (_, i) => ev({
        kind: 'quiz', userId: 'grinder', subjectId: 'q1', score: 71, at: ago(40 - i),
    }));
    const board = buildBoard(grinder, { now: NOW });
    check('forty attempts at one quiz is one quiz',
        board.rows.length === 1
        && board.rows[0].points === POINTS.quizPassed + masteryBonus(71),
        board.rows.map(r => r.points));
    check('and it counts as one assessment taken, not forty',
        board.rows[0].assessmentsTaken === 1, board.rows[0].assessmentsTaken);

    const attempts = [
        ev({ subjectId: 'x', score: 55, passed: false, at: ago(9) }),
        ev({ subjectId: 'x', score: 91, passed: true, at: ago(5) }),
        ev({ subjectId: 'x', score: 74, passed: true, at: ago(1) }),
    ];
    const best = bestAttempts(attempts);
    check('the best attempt is the highest score', best.length === 1 && best[0].score === 91);

    // The tie rule: same score, earliest wins. A learner re-sitting something
    // they had already aced keeps the date they first did it, which is what the
    // activity chart and the "first to get there" tie-break both want.
    const tied = bestAttempts([
        ev({ subjectId: 'y', score: 88, at: ago(2) }),
        ev({ subjectId: 'y', score: 88, at: ago(20) }),
    ]);
    check('a tie on score keeps the earlier attempt',
        tied.length === 1 && tied[0].at === ago(20));

    check('an undated attempt never displaces a dated one',
        bestAttempts([
            ev({ subjectId: 'z', score: 60, at: ago(3) }),
            ev({ subjectId: 'z', score: 60, at: Number.NaN }),
        ])[0].at === ago(3));

    check('two learners at one assessment are two events',
        bestAttempts([
            ev({ userId: 'a', subjectId: 'same' }),
            ev({ userId: 'b', subjectId: 'same' }),
        ]).length === 2);

    check('one learner at two assessments is two events',
        bestAttempts([
            ev({ subjectId: 'one' }),
            ev({ subjectId: 'two' }),
        ]).length === 2);

    // An exam and a quiz can legitimately share an id across two collections;
    // the kind is part of the key so one never eats the other.
    check('the kind is part of the key',
        bestAttempts([
            ev({ kind: 'exam', subjectId: 'shared' }),
            ev({ kind: 'quiz', subjectId: 'shared' }),
        ]).length === 2);

    // A duplicate certificate for one course is a merge artefact, not a second
    // achievement — and at 150 points each it is an expensive one.
    check('a duplicated certificate is one credential',
        bestAttempts([
            ev({ kind: 'course_certificate', subjectId: 'c9', score: null, at: ago(4) }),
            ev({ kind: 'course_certificate', subjectId: 'c9', score: null, at: ago(4) }),
        ]).length === 1);

    check('a record with no user id is dropped, not counted',
        bestAttempts([ev({ userId: '' })]).length === 0);
    check('a record with no subject id is dropped, not counted',
        bestAttempts([ev({ subjectId: '' })]).length === 0);
}

/* ================================================================== */
console.log('\n3. Windows, and the order they are applied in');
{
    for (const win of WINDOWS) {
        check(`${win} has a label`, !!WINDOW_LABEL[win]);
    }
    check('all time is unbounded', windowRange('all', NOW).from === null);
    check('7d starts seven days back', windowRange('7d', NOW).from === ago(7));
    check('there is no period before all time', previousRange('all', NOW) === null);
    const before = previousRange('30d', NOW)!;
    check('the previous 30 days abuts this one',
        before.to === ago(30) && before.from === ago(60), before);

    // Half-open, so two consecutive windows tile without an event in both.
    check('the lower bound is inclusive',
        inRange([ev({ at: ago(7) })], windowRange('7d', NOW)).length === 1);
    check('the upper bound is exclusive',
        inRange([ev({ at: NOW })], windowRange('7d', NOW)).length === 0);
    check('an undated event appears only in all time',
        inRange([ev({ at: Number.NaN })], windowRange('7d', NOW)).length === 0
        && inRange([ev({ at: Number.NaN })], windowRange('all', NOW)).length === 1);
    check('isDated agrees', !isDated(ev({ at: Number.NaN })) && isDated(ev()));

    /*
      THE ORDERING BUG THIS EXISTS TO CATCH.

      A learner sat one exam twice: 95 last year, 71 on Monday. Dedupe first and
      the board picks the 95, then asks whether it happened this week, decides it
      did not, and drops the learner from the weekly board entirely — while they
      plainly sat an exam on Monday. Window first and the 71 is the only attempt
      in range, which is the right answer.
    */
    const straddling = [
        ev({ userId: 'u9', subjectId: 'e1', score: 95, at: ago(300) }),
        ev({ userId: 'u9', subjectId: 'e1', score: 71, at: ago(2) }),
    ];
    const weekly = buildBoard(straddling, { now: NOW, window: '7d' });
    check('a learner whose in-window attempt is not their best still appears',
        weekly.rows.length === 1, weekly.rows.length);
    check('and it is the in-window attempt that is scored',
        weekly.rows[0]?.averageScore === 71, weekly.rows[0]?.averageScore);
    const allTime = buildBoard(straddling, { now: NOW, window: 'all' });
    check('all time still picks the better of the two',
        allTime.rows[0]?.averageScore === 95, allTime.rows[0]?.averageScore);
}

/* ================================================================== */
console.log('\n4. The ranking is total, stable and shares its ties');
{
    const rows = aggregate([
        ev({ userId: 'a', subjectId: 'e1', score: 90 }),                     // 125
        ev({ userId: 'b', subjectId: 'e1', score: 80 }),                     // 100
        ev({ userId: 'c', subjectId: 'e1', score: 80 }),                     // 100
        ev({ userId: 'd', kind: 'quiz', subjectId: 'q1', score: 75 }),       // 20
    ]);
    const ranked = rank(rows);
    check('competition ranking: 1, 2, 2, 4',
        ranked.map(r => r.rank).join(',') === '1,2,2,4', ranked.map(r => [r.userId, r.points, r.rank]));

    /*
      The rank is shared on POINTS alone, not on the whole comparator.

      The rest of the chain exists to make the order deterministic; letting it
      split a tie would print two different ranks for two learners the scoring
      cannot separate.
    */
    const split = rank(aggregate([
        ev({ userId: 'p', subjectId: 'e1', score: 80, at: ago(2) }),
        ev({ userId: 'q', subjectId: 'e1', score: 80, at: ago(9) }),
        ev({ userId: 'q', kind: 'course_certificate', subjectId: 'c1', score: null, at: ago(9) }),
        ev({ userId: 'r', subjectId: 'e1', score: 80, at: ago(1) }),
    ]));
    const pAndR = split.filter(r => r.userId === 'p' || r.userId === 'r');
    check('two learners on equal points share a rank even when ordered by a tie-break',
        pAndR.length === 2 && pAndR[0].rank === pAndR[1].rank,
        split.map(r => [r.userId, r.points, r.rank]));

    /*
      WHO IS ON THE BOARD, and it moved when a failed attempt started earning.

      The filter is still `points > 0` and the rule it enforces is still the
      same one: the board lists people who have done something, not every
      account that ever opened a quiz and closed it again. What changed is that
      SITTING a paper is now something - so a learner whose only event is an
      honest failed attempt appears, at the attempt credit, and one who merely
      opened a page still does not.

      It does not put an attributed failure on the board, which is the posture
      the page's header commits to: the row carries a name and a total, and the
      per-learner pass rate is deliberately not a column. The failures are
      inside the activity record, which is opened on purpose.
    */
    check('a learner who has done nothing at all is not on the board',
        rank(aggregate([ev({ kind: 'lab', passed: false, score: null,
            labPoints: 0, labPossible: 8 })])).length === 0);
    check('but one who SAT a paper and missed it is - the credit is what puts '
        + 'them there, and it is the smallest thing on the table',
        rank(aggregate([ev({ passed: false, score: 12 })]))
            .map(row => row.points).join() === String(POINTS.attempted));

    // Stability: the same events in any order must give the same board. The rows
    // are recomputed inside a computed that re-evaluates on every keystroke, so
    // an unstable sort is a list that visibly reshuffles under the cursor.
    const many: LeaderboardEvent[] = [];
    for (let i = 0; i < 24; i++) {
        many.push(ev({
            userId: `user-${i % 8}`, subjectId: `e${i}`,
            // Deliberately lots of exact ties, which is where an unstable sort
            // shows itself.
            score: 70 + (i % 3) * 10, at: ago(i + 1),
        }));
    }
    const straight = rank(aggregate(many)).map(r => r.userId).join(',');
    const reversed = rank(aggregate([...many].reverse())).map(r => r.userId).join(',');
    // A deterministic shuffle, so the check is reproducible run to run.
    const shuffled = [...many].sort((a, b) =>
        (a.subjectId.length - b.subjectId.length) || (a.subjectId < b.subjectId ? 1 : -1));
    const third = rank(aggregate(shuffled)).map(r => r.userId).join(',');
    check('the order does not depend on the input order',
        straight === reversed && straight === third,
        { straight, reversed, third });

    check('the comparator never reports two distinct learners as equal',
        rank(aggregate(many)).every((row, i, all) =>
            i === 0 || compareRows(all[i - 1], row) !== 0));
}

/* ================================================================== */
console.log('\n5. What a row says about a learner');
{
    const rows = aggregate(bestAttempts([
        ev({ userId: 'z', subjectId: 'e1', score: 95, at: ago(10) }),
        ev({ userId: 'z', subjectId: 'e2', score: 62, passed: false, at: ago(8) }),
        ev({ userId: 'z', kind: 'quiz', subjectId: 'q1', score: 100, at: ago(6) }),
        ev({ userId: 'z', kind: 'course_certificate', subjectId: 'c1', score: null,
             at: ago(4), hours: 18 }),
        ev({ userId: 'z', kind: 'exam_certificate', subjectId: 'e1', score: null, at: ago(3) }),
    ]));
    const row = rows[0];
    check('exams passed counts only passes', row.examsPassed === 1, row.examsPassed);
    check('quizzes passed is separate', row.quizzesPassed === 1, row.quizzesPassed);
    check('credentials count both kinds', row.certificates === 2, row.certificates);
    check('learning hours come from the course certificate',
        row.learningHours === 18, row.learningHours);
    check('assessments taken includes the failure', row.assessmentsTaken === 3);
    // A failure that earned nothing still counts against the pass rate. Drop it
    // and every learner sits at 100%, which flatters everybody equally and tells
    // the reader nothing.
    check('the pass rate is honest about the failure',
        Math.abs(row.passRate - 2 / 3) < 1e-9, row.passRate);
    check('the average score includes the failed attempt',
        row.averageScore === Math.round(((95 + 62 + 100) / 3) * 10) / 10, row.averageScore);
    check('the best score is the best score', row.bestScore === 100);
    check('distinctions count attempts at or above the threshold',
        row.distinctions === 2, row.distinctions);
    check('points are the sum of the parts',
        row.points === (POINTS.examPassed + masteryBonus(95))
            + (POINTS.quizPassed + masteryBonus(100))
            + POINTS.courseCertificate
            + POINTS.attempted,
        row.points);
    check('first and last activity bracket the events',
        row.firstActiveAt === ago(10) && row.lastActiveAt === ago(3),
        [row.firstActiveAt, row.lastActiveAt]);

    // The name: freshest wins, and a blank never displaces a filled value. Most
    // exam certificates carry no picture, and one arriving later must not wipe
    // the avatar a course certificate supplied.
    const named = aggregate([
        ev({ userId: 'n', subjectId: 'e1', name: 'old name', at: ago(9) }),
        ev({ userId: 'n', subjectId: 'e2', name: 'New Name', at: ago(1),
             avatarUrl: 'https://example.test/a.jpg' }),
        ev({ userId: 'n', subjectId: 'e3', name: '', at: NOW - 1 }),
    ])[0];
    check('the freshest non-empty name wins', named.name === 'New Name', named.name);
    check('a later blank does not wipe the name', named.name !== '');
    check('nor the picture', named.avatarUrl === 'https://example.test/a.jpg');
    check('a learner with no name at all still has a label',
        aggregate([ev({ userId: 'blank', name: '' })])[0].name === 'Learner');
}

/* ================================================================== */
console.log('\n6. Movement, and why it is nullable');
{
    const history = [
        // Last month: b ahead of a.
        ev({ userId: 'a', subjectId: 'o1', score: 80, at: ago(45) }),
        ev({ userId: 'b', subjectId: 'o2', score: 80, at: ago(45) }),
        ev({ userId: 'b', subjectId: 'o3', score: 80, at: ago(44) }),
        // This month: a overtakes, and c appears for the first time.
        ev({ userId: 'a', subjectId: 'n1', score: 80, at: ago(5) }),
        ev({ userId: 'a', subjectId: 'n2', score: 80, at: ago(4) }),
        ev({ userId: 'a', subjectId: 'n3', score: 80, at: ago(3) }),
        ev({ userId: 'b', subjectId: 'n4', score: 80, at: ago(2) }),
        ev({ userId: 'c', subjectId: 'n5', score: 80, at: ago(1) }),
    ];
    const board = buildBoard(history, { now: NOW, window: '30d' });
    const byId = new Map(board.rows.map(r => [r.userId, r]));
    check('the climber is reported as having climbed',
        (byId.get('a')?.movement ?? 0) > 0, byId.get('a')?.movement);
    check('the learner they passed is reported as having dropped',
        (byId.get('b')?.movement ?? 0) < 0, byId.get('b')?.movement);
    /*
      Absent from the previous window is NOT "climbed to third". It is a learner
      the board has nothing to compare against, and saying so is the honest
      answer — the view renders it as NEW.
    */
    check('a learner with no previous ranking has null movement, not a number',
        byId.get('c')?.movement === null, byId.get('c')?.movement);

    const forever = buildBoard(history, { now: NOW, window: 'all' });
    check('all time has no previous period, so nothing has movement',
        forever.rows.every(r => r.movement === null));
    check('and no previous totals to compare against',
        forever.previousTotals === null);
    check('a bounded window does have previous totals',
        board.previousTotals !== null);
}

/* ================================================================== */
console.log('\n7. Totals');
{
    const board = buildBoard([
        ev({ userId: 'a', subjectId: 'e1', score: 90, at: ago(2) }),
        ev({ userId: 'b', subjectId: 'e1', score: 50, passed: false, at: ago(2) }),
        ev({ userId: 'b', kind: 'course_certificate', subjectId: 'c1', score: null,
             at: ago(2), hours: 6 }),
    ], { now: NOW });
    check('learners counted are ranked learners', board.totals.learners === 2);
    check('credentials are counted', board.totals.certificates === 1);
    check('assessments taken counts both attempts', board.totals.assessmentsTaken === 2);
    check('the platform pass rate is honest', board.totals.passRate === 0.5);
    check('the average score spans every scored attempt',
        board.totals.averageScore === 70, board.totals.averageScore);
    check('learning hours are summed', board.totals.learningHours === 6);

    // A certificate has no score and must not be averaged in as a zero, which
    // would drag the platform average down by however many credentials exist.
    check('a certificate does not count as a zero score',
        buildBoard([ev({ kind: 'course_certificate', score: null })],
            { now: NOW }).totals.averageScore === 0);
}

/* ================================================================== */
console.log('\n8. The score distribution');
{
    check('there are five bands and they tile 0-100',
        SCORE_BANDS.length === 5
        && SCORE_BANDS[0].min === 0
        && SCORE_BANDS[SCORE_BANDS.length - 1].max === 100
        && SCORE_BANDS.every((band, i) => i === 0 || band.min === SCORE_BANDS[i - 1].max + 1),
        SCORE_BANDS);

    // The pass mark and the distinction mark are band edges, so the boundaries a
    // reader cares about are real boundaries rather than round numbers.
    check('the pass mark is a band edge', SCORE_BANDS.some(band => band.min === 70));
    check('the distinction mark is a band edge',
        SCORE_BANDS.some(band => band.min === DISTINCTION_SCORE));

    const dist = scoreDistribution([
        ev({ subjectId: 'a', score: 0 }),
        ev({ subjectId: 'b', score: 49 }),
        ev({ subjectId: 'c', score: 70 }),
        ev({ subjectId: 'd', score: 100 }),
    ]);
    check('every band is present, including the empty ones',
        dist.length === SCORE_BANDS.length, dist);
    check('the edges land in the band they belong to',
        dist[0].count === 2 && dist[2].count === 1 && dist[4].count === 1, dist);
    check('an empty band reads as zero rather than being absent',
        dist[1].count === 0 && dist[3].count === 0);

    check('an out-of-range score is clamped rather than dropped',
        scoreDistribution([ev({ score: 140 })])[4].count === 1);
    check('a negative score is clamped too',
        scoreDistribution([ev({ score: -5 })])[0].count === 1);
    check('a certificate has no score and is not plotted',
        scoreDistribution([ev({ kind: 'course_certificate', score: null })])
            .every(bucket => bucket.count === 0));
    check('a non-numeric score is not plotted',
        scoreDistribution([ev({ score: null })]).every(bucket => bucket.count === 0));
}

/* ================================================================== */
console.log('\n9. The activity series, and its empty buckets');
{
    /*
      The empty buckets are the whole point.

      A series built only from the events that exist skips every quiet day, so a
      line drawn through it implies activity that did not happen and compresses
      the axis into whichever days were busy — two weeks of silence render as one
      step. It is also the only thing that makes two windows comparable.
    */
    const sparse = [ev({ subjectId: 'a', at: ago(1) }), ev({ subjectId: 'b', at: ago(6) })];
    const week = activitySeries(sparse, { now: NOW, window: '7d' });
    check('a 7-day window is seven daily buckets, not eight',
        week.length === 7, week.length);
    check('the quiet days are present and zero',
        week.filter(point => point.count === 0).length === 5, week.map(p => p.count));
    check('every event landed in exactly one bucket',
        week.reduce((n, point) => n + point.count, 0) === sparse.length,
        week.map(p => p.count));
    check('the buckets ascend in time',
        week.every((point, i) => i === 0 || point.start > week[i - 1].start));
    check('every bucket has a label', week.every(point => point.label.length > 0));

    const month = activitySeries(sparse, { now: NOW, window: '30d' });
    check('a 30-day window is thirty daily buckets', month.length === 30, month.length);
    // Past ~45 days a daily bucket is unreadable, so the window steps to weeks.
    const quarter = activitySeries(sparse, { now: NOW, window: '90d' });
    check('a 90-day window steps to weeks rather than 90 columns',
        quarter.length > 10 && quarter.length < 16, quarter.length);

    // The present moment belongs in the last bucket, and it gets there by the
    // clamp rather than by an extra always-empty column at the right edge.
    const rightNow = activitySeries([ev({ at: NOW })], { now: NOW, window: '7d' });
    check('an event at this instant is in the final bucket',
        rightNow[rightNow.length - 1].count === 1, rightNow.map(p => p.count));

    check('an undated event is not plotted',
        activitySeries([ev({ at: Number.NaN })], { now: NOW, window: '7d' })
            .every(point => point.count === 0));
    check('an event outside the window is not plotted',
        activitySeries([ev({ at: ago(400) })], { now: NOW, window: '7d' })
            .every(point => point.count === 0));

    // No events at all still draws an axis, so the card says "nothing here"
    // rather than rendering a chart with no x-axis at all.
    const nothing = activitySeries([], { now: NOW, window: 'all' });
    check('all time with no events still produces buckets', nothing.length > 0, nothing.length);
    const long = activitySeries([ev({ at: ago(1500) }), ev({ at: ago(1) })],
        { now: NOW, window: 'all' });
    check('all time stays at a readable number of buckets over four years',
        long.length >= 20 && long.length <= 30, long.length);
    check('and it still accounts for both events',
        long.reduce((n, point) => n + point.count, 0) === 2, long.map(p => p.count));
}

/* ================================================================== */
console.log('\n10. Most studied');
{
    const events = [
        ev({ userId: 'a', subjectId: 'e1', subjectName: 'Networking' }),
        ev({ userId: 'b', subjectId: 'e1', subjectName: 'Networking' }),
        ev({ userId: 'c', subjectId: 'e1', subjectName: 'Networking', passed: false }),
        ev({ userId: 'a', subjectId: 'e2', subjectName: 'Databases' }),
        ev({ userId: 'a', kind: 'quiz', subjectId: 'q1', subjectName: 'Lesson 1' }),
    ];
    const top = topSubjects(events, ['exam', 'quiz'], 6);
    check('the most-taken assessment leads', top[0].name === 'Networking', top.map(t => t.name));
    check('counted in distinct learners', top[0].learners === 3, top[0].learners);
    check('passes are counted separately from learners', top[0].passed === 2, top[0].passed);
    check('a kind that was not asked for is excluded',
        topSubjects(events, ['course_certificate']).length === 0);
    check('the limit is honoured', topSubjects(events, ['exam', 'quiz'], 1).length === 1);
    check('an exam and a quiz sharing an id stay separate',
        topSubjects([
            ev({ kind: 'exam', subjectId: 'same', subjectName: 'A' }),
            ev({ kind: 'quiz', subjectId: 'same', subjectName: 'B' }),
        ], ['exam', 'quiz']).length === 2);
    /*
      THE BUG THIS BLOCK EXISTS FOR.

      `topSubjects` used to fall back to the string "Untitled", and on live data
      the chart came out as `Untitled 9`, `Untitled 7`, `Untitled 6`,
      `Web Technologies 6`, `Untitled 5`, `Untitled 2` - five of six rows
      indistinguishable, which reads as a rendering fault rather than as data.

      The cause was that a result record carries no title at all: app 20's
      `user_exam_result` has `exam` and no `exam_title`, and `/exams/` is off
      limits here because it ships `is_correct`. So an unnamed subject is now
      DROPPED, and the names that do exist are resolved from the certificates -
      section 17.
    */
    check('a subject nothing names is dropped, not labelled',
        topSubjects([ev({ subjectName: undefined })], ['exam']).length === 0);
    check('nor is a blank or whitespace-only name allowed through',
        topSubjects([
            ev({ subjectId: 'a', subjectName: '' }),
            ev({ subjectId: 'b', subjectName: '   ' }),
        ], ['exam']).length === 0);
    /* Comment-stripped, because the paragraphs retracting the placeholder
       naturally quote it. Same reason `code()` exists at the top of this file. */
    check('no placeholder subject name survives in code',
        !/Untitled/.test(code('src/utils/leaderboardEngine.ts'))
        && !/Untitled/.test(code('src/views/Leaderboard.vue')));
    /*
      One named event names the whole row. A subject is usually seen several
      times - a result and a certificate - and only some of those carry a title,
      so dropping on the FIRST unnamed sighting would throw away a subject the
      data does identify.
    */
    check('a name on any one event names the subject',
        topSubjects([
            ev({ userId: 'a', subjectId: 'e9', subjectName: undefined }),
            ev({ userId: 'b', subjectId: 'e9', subjectName: 'Web Technologies' }),
            ev({ userId: 'c', subjectId: 'e9', subjectName: undefined }),
        ], ['exam']).map(subject => subject.name + ':' + subject.learners).join()
        === 'Web Technologies:3');
    check('a padded name is stored trimmed',
        topSubjects([ev({ subjectName: '  Databases  ' })], ['exam'])[0].name === 'Databases');

    // Same reason as the board: re-derived on every filter change, so it must
    // not reshuffle. Two subjects with identical counts are ordered by name.
    const tiedA = topSubjects([
        ev({ userId: 'a', subjectId: 's1', subjectName: 'Zebra' }),
        ev({ userId: 'a', subjectId: 's2', subjectName: 'Alpha' }),
    ], ['exam']).map(s => s.name).join(',');
    const tiedB = topSubjects([
        ev({ userId: 'a', subjectId: 's2', subjectName: 'Alpha' }),
        ev({ userId: 'a', subjectId: 's1', subjectName: 'Zebra' }),
    ], ['exam']).map(s => s.name).join(',');
    check('a tie is broken by name, not by input order',
        tiedA === 'Alpha,Zebra' && tiedA === tiedB, { tiedA, tiedB });
}

/* ================================================================== */
console.log('\n11. Formatting, and the table twin');
{
    check('a small number is grouped', compact(1284) === (1284).toLocaleString());
    check('ten thousand compacts', compact(12934) === '12.9K');
    check('a round thousand loses its .0', compact(12000) === '12K');
    check('a million compacts', compact(2_400_000) === '2.4M');
    check('a non-number is zero, never NaN', compact(Number.NaN) === '0');

    // Null rather than zero: "no previous period" and "no change" are different
    // statements and only one of them is a fact.
    check('a missing previous period gives no delta', delta(10, null) === null);
    check('an undefined previous period gives no delta', delta(10, undefined) === null);
    check('a real previous period gives a signed delta', delta(10, 4) === 6 && delta(4, 10) === -6);
    check('no change is zero, not null', delta(7, 7) === 0);

    check('two names give two initials', initialsOf('Aya Nasser') === 'AN');
    check('one name gives one', initialsOf('Aya') === 'A');
    check('a long name uses the first and last', initialsOf('Aya Bint Al Nasser') === 'AN');
    check('extra whitespace is ignored', initialsOf('  Aya   Nasser  ') === 'AN');
    check('an empty name still has a letter', initialsOf('') === 'L');

    const row = aggregate([ev({ userId: 'u', name: 'Aya Nasser' })])[0];
    check('an empty query matches everybody', matchesQuery(row, ''));
    check('the search is case-insensitive', matchesQuery(row, 'aya'));
    check('and matches inside the name', matchesQuery(row, 'nass'));
    check('a non-match does not match', !matchesQuery(row, 'zzz'));
    /*
      The search deliberately does not match the id.

      The board never prints a `user_id` — see the view's header — and a filter
      that matched something invisible would be a way to confirm an id exists
      from a page open to the whole internet.
    */
    check('the search never matches an account id', !matchesQuery(row, row.userId));

    const table = tableFor([{ label: 'a', value: 3 }, { label: 'b', value: 1 }]);
    check('the table twin carries shares', Math.abs(table[0].share - 0.75) < 1e-9);
    check('the shares sum to one',
        Math.abs(table.reduce((n, r) => n + r.share, 0) - 1) < 1e-9);
    check('an all-zero table has zero shares, not NaN',
        tableFor([{ label: 'a', value: 0 }]).every(r => r.share === 0));
}

/* ================================================================== */
console.log('\n12. The engine never reads the clock');
{
    /*
      Every window, bucket boundary and movement figure is measured from a `now`
      the caller passes in. An engine that read the clock itself would make the
      check depend on the hour it ran, and — worse — would let one render put an
      event in one chart and not another if it straddled midnight.
    */
    /*
      COMMENTS STRIPPED, and the reason is this check's own history.

      `code()` exists a few lines up for exactly this and was not used here.
      The engine's doc comment names `window.alt_tab` as an example of a
      practice action's catalogue key, and the DOM assertion below matched the
      word "window." inside it - so a rule fired on the paragraph explaining
      the rule, which is a rule nobody can document. `check:aichat` and this
      file's own "no email is rendered" assertion have both been corrected for
      the same shape (working rule 44).
    */
    const engine = code('src/utils/leaderboardEngine.ts');
    check('no Date.now() in the engine', !/Date\.now\s*\(/.test(engine));
    check('no argument-less new Date() in the engine', !/new Date\s*\(\s*\)/.test(engine));
    check('no Math.random() in the engine', !/Math\.random\s*\(/.test(engine));
    /* Property access, not the bare word: `BoardWindow`, `windowRange` and
       `{ window: win }` are all legitimate here, and a check that banned the
       string would be a check that forced the model to be renamed. */
    check('and no DOM reference, so it loads in node',
        !/\bdocument\s*\.|\bwindow\s*\.|\blocalStorage\b/.test(engine));
}

/* ================================================================== */
console.log('\n13. The page is public, and says so in both places');
{
    /*
      The whole premise of this page is that a stranger can read it, so the two
      declarations that make that true are asserted together — `check:appnav`
      covers the nav side in general, and this is the pair specifically.
    */
    const router = source('src/router/index.ts');
    const route = router.match(/path:\s*'leaderboard'[\s\S]{0,240}?\}/);
    check('the route exists', !!route, route?.[0]);
    check('and carries requiresAuth: false',
        !!route && /requiresAuth:\s*false/.test(route[0]), route?.[0]);
    check('and is not subscription-gated',
        !!route && !/requiresSubscription|requiredFeatures/.test(route[0]), route?.[0]);

    const nav = source('src/navigation/appNav.ts');
    const entry = nav.match(/const LEADERBOARD: NavEntry = \{[^}]*\}/);
    check('the nav entry exists', !!entry, entry?.[0]);
    check("and carries requires: 'public'",
        !!entry && /requires:\s*'public'/.test(entry[0]), entry?.[0]);

    /*
      No account id on screen, and no email.

      `/all-certificates` prints the first eight characters of a `user_id`, which
      is defensible there — a certificate is a thing somebody presents and
      support has to look it up. A leaderboard has no such use, so the view must
      not render one at all.
    */
    const view = source('src/views/Leaderboard.vue');
    const rawTemplate = view.slice(0, view.indexOf('<script'));
    /*
     * Translated COPY is not a data binding, and telling them apart is what
     * this strip is for.
     *
     * These two checks look for `userId` or `email` inside a `{{ }}`, on the
     * reasoning that the page's prose is plain text and anything interpolated
     * is data. That stopped being true when the templates were wrapped for
     * i18n: the sentence promising the reader that no email is published is now
     * `{{ $t('… no account id, no email, and no list of …') }}`, so the check
     * matched its own reassurance copy and failed on a page that renders no
     * email at all.
     *
     * So every `$t('…')` string literal is removed before the test. What is
     * left is the expressions — which is exactly what the check was always
     * about, and is now what it actually reads.
     */
    const template = rawTemplate
        .replace(/\$tc?\(\s*'(?:[^'\\]|\\.)*'/g, '$t(')
        .replace(/\$tc?\(\s*"(?:[^"\\]|\\.)*"/g, '$t(');
    check('the template never renders a user id',
        !/\{\{[^}]*userId[^}]*\}\}/.test(template) && !/user_id/.test(template));
    /* An email must not be RENDERED. The word itself is on the page, in the
       sentence promising the reader that no email is published — so the check
       looks for a binding or a link, and for the field never being read at all
       one layer down. */
    check('nor an email',
        !/\{\{[^}]*email[^}]*\}\}/i.test(template)
        && !/mailto:/i.test(template)
        && !/\bemail\b/i.test(code('src/services/leaderboard.service.ts')));
    // Every name on this page came out of a backend. Interpolation escapes;
    // `v-html` does not, and `CourseDetails.vue` is the reason that rule exists.
    check('and nothing on the page is written with v-html', !/v-html/.test(view));
}

/* ================================================================== */
console.log('\n14. The chart palette — one hue, and it is measured');
{
    /*
      A canvas cannot read a CSS custom property, so there is nothing in the
      stylesheets for `check:theme` to verify about the chart colours. These are
      the assertions that stand in for it.

      The card the charts sit on is the page tint over deep space — the same
      composite `themes.ts` measures text against, because measuring a mark
      against the tint would be measuring against something the eye never sees.
    */
    const MARK_FLOOR = 3;      // WCAG non-text contrast, and the dataviz mark floor
    const AXIS_FLOOR = 4.5;    // axis ticks and labels are text

    const offenders: unknown[] = [];
    const axisOffenders: unknown[] = [];
    const measured: [string, number][] = [];

    for (const theme of THEMES) {
        const tint = parseColor(`rgb(${theme.vars['--sfs-tint-rgb']})`);
        check(`${theme.id}: the tint parses`, tint !== null);
        if (!tint) continue;
        // 0.06, matching `.lb-chart`'s background in leaderboard.css.
        const card = over(toHex(tint), 0.06, theme.space);

        const accent = theme.vars['--sfs-accent'];
        const ratio = contrastRatio(accent, card);
        measured.push([theme.id, Math.round(ratio * 100) / 100]);
        if (ratio < MARK_FLOOR) offenders.push([theme.id, accent, card, ratio]);

        const axis = theme.vars['--sfs-text-muted'];
        if (contrastRatio(axis, card) < AXIS_FLOOR) {
            axisOffenders.push([theme.id, axis, contrastRatio(axis, card)]);
        }
    }

    check(`the one series colour clears ${MARK_FLOOR}:1 on the card in all ten galaxies`,
        offenders.length === 0, offenders);
    check(`axis text clears ${AXIS_FLOOR}:1 in all ten`, axisOffenders.length === 0, axisOffenders);
    console.log('  note  accent contrast on the chart card: '
        + measured.map(([id, ratio]) => `${id} ${ratio}`).join(', '));

    /*
      THE GUARD THAT MATTERS MOST HERE.

      "Let us colour exams and quizzes differently" is an obvious, reasonable
      change that would be unreadable in a third of the galaxies and would look
      completely fine to whoever made it. Measured across the ten trios, no pair
      of a galaxy's accents clears the normal-vision separation floor in all of
      them, and Triangulum's accent and accent-2 are ΔE 0.8 apart under
      deuteranopia — the same colour to a deuteranope.

      So the chart component may spend exactly one accent. A second series is two
      charts or small multiples, never a second hue.
    */
    const chart = source('src/components/leaderboard/LeaderboardChart.vue');
    const code = chart.slice(chart.indexOf('<script'))
        // Comments are where this rule is explained, so they may name the tokens.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
    check('the chart component names no second accent',
        !/--sfs-accent-2|--sfs-accent-3/.test(code),
        code.match(/--sfs-accent-[23][a-z-]*/g));
    check('it resolves its colours from the theme rather than hardcoding them',
        /getComputedStyle/.test(code));
    check('it watches data-theme, so a galaxy change repaints the canvas',
        /data-theme/.test(code) && /MutationObserver/.test(code));
    check('and it destroys the chart on unmount, so navigating away leaks nothing',
        /onBeforeUnmount/.test(code) && /destroy\(\)/.test(code));
    // A status hue is reserved: it means good or bad, never "series 2".
    check('no status hue is used as a series colour',
        !/--sfs-(success|warning|danger|info)\b/.test(code),
        code.match(/--sfs-(success|warning|danger|info)[a-z-]*/g));
}

/* ================================================================== */
console.log('\n15. The stylesheet cannot leak, and spends no literal colour');
{
    const css = source('src/assets/css/leaderboard.css');

    /*
      Loaded globally, so in production it is concatenated into one always-present
      stylesheet — which is how `roblox-tool.css`'s bare `.placeholder` came to
      cover the Schedule Exam calendar. `check:cssleaks` gates this file; this is
      the narrower, local version of the same rule: every selector is `lb-`.
    */
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const stray: string[] = [];
    for (const rule of body.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
        for (const raw of rule[1].split(',')) {
            const selector = raw.trim();
            if (!selector || selector.startsWith('@')) continue;
            if (/^(from|to|\d)/.test(selector)) continue;
            // Every selector has to mention the namespace somewhere.
            if (!selector.includes('.lb-')) stray.push(selector.slice(0, 70));
        }
    }
    check('every selector is namespaced lb-', stray.length === 0, stray.slice(0, 10));

    // Working rule 12. A hardcoded colour is right in the default galaxy and
    // wrong in the other nine, which is nine bugs nobody sees until a reader
    // picks that theme. Inside a var() fallback is exactly where they belong.
    const noVars = stripVars(body);
    const literals = [
        ...noVars.matchAll(/#[0-9a-fA-F]{3,8}\b/g),
        ...noVars.matchAll(/rgba?\(\s*\d/g),
        ...noVars.matchAll(/\bhsla?\(\s*\d/g),
    ].map(m => m[0]);
    check('no colour literal outside a var() fallback', literals.length === 0, literals);

    check('every var(--sfs-…) carries a fallback',
        [...body.matchAll(/var\(\s*--sfs-[a-z0-9-]+\s*(,?)/g)].every(m => m[1] === ','),
        [...body.matchAll(/var\(\s*(--sfs-[a-z0-9-]+)\s*\)/g)].map(m => m[1]));

    // `responsive.css` scales the ROOT font size, so 2.75rem measures 41.5px on
    // a 390px phone — under the 44px minimum, on exactly the device the rule
    // exists for. A touch target is one of the few things that must not scale.
    check('touch targets are pinned in px as well as rem',
        /min-height:\s*max\(2\.75rem,\s*44px\)/.test(body));
    // Below 16px iOS zooms the page on focus and never zooms back.
    check('the search field cannot trigger an iOS zoom',
        /font-size:\s*max\(1rem,\s*16px\)/.test(body));
    // A name and a course title are untrusted-length data; `break-word` breaks
    // only at permitted points and is not counted when min-content is computed.
    check('unbreakable text can wrap and let its column shrink',
        /overflow-wrap:\s*anywhere/.test(body));
    check('and the reduced-motion case is handled',
        /prefers-reduced-motion/.test(body));
}

/* ================================================================== */
console.log('\n16. The data layer reads what it should, and not what it should not');
{
    const service = code('src/services/leaderboard.service.ts');

    /*
      THE ONE THAT IS A SECURITY PROPERTY RATHER THAN A STYLE PREFERENCE.

      App 20's `/exams/` serialises every exam with its questions nested, and
      every question with its answers — including `is_correct`. Fetching that
      collection onto a page that needs NO ACCOUNT would hand the whole answer
      key to anybody who opened the site, in one request. Titles come from the
      certificates (which carry `exam_name` already denormalised) and from app
      19's `/courses/`, which is a light list with no questions in it.
    */
    check('the exam collection is never fetched',
        !/['"`]\/exams\//.test(service), service.match(/['"`]\/exams\/[^'"`]*/g));
    check('nor the quiz collection, for the same reason',
        !/['"`]\/quizzes\//.test(service));
    check('nor a question or answer collection',
        !/(exam|quiz)-(questions|answers)/.test(service));

    check('it reads results and certificates',
        /\/user-exam-results\//.test(service)
        && /\/user-quiz-results\//.test(service)
        && /\/exam-certificates\//.test(service)
        && /\/course-certificates\//.test(service));

    // Working rule 1: resolve, never hardcode. Working rule 3: fail over.
    check('no replica domain is hardcoded', !/pythonanywhere/.test(service));
    check('it resolves through withReplicas, so a dead replica is survivable',
        /withReplicas\(/.test(service));

    // Read-only by construction. A public page that could write would be a much
    // bigger hole than one that reports the wrong total.
    check('the leaderboard writes nothing',
        !/apiService\.(post|put|patch|delete)/.test(service));

    /*
      Three states, never two.

      "Answered with an empty list" and "did not answer" are different facts, and
      collapsing them has a specific cost here: a platform with no quizzes yet
      would report a partial load for ever, so the warning would be permanent and
      therefore ignored — and the day a service really failed, nothing on screen
      would change.
    */
    check('a source reports whether it answered, separately from what it held',
        /answered:\s*true/.test(service) && /answered:\s*false/.test(service));
    check('and the view distinguishes a total failure from an empty platform',
        /allFailed/.test(service) && /allFailed/.test(source('src/views/Leaderboard.vue')));
}

/* ================================================================== */
console.log('\n17. Where a subject name can honestly come from');
{
    const service = code('src/services/leaderboard.service.ts');

    /*
      An exam certificate carries `exam_name` and is keyed on the same `exam_id`
      the results use, and app 20 issues one automatically on a pass - so every
      exam anybody has passed is named from data already fetched, with no extra
      request and nothing leaked. That is the only reason the chart has labels at
      all, so it is asserted rather than left for whoever next wonders why the
      map exists.
    */
    check('exam names are resolved from the exam certificates',
        /examTitles/.test(service) && /exam_name/.test(service));
    check('course names come from the course records and their certificates',
        /course_name/.test(service) && /courseTitles/.test(service));
    check('a result title field is still preferred when a replica sends one',
        /exam_title/.test(service));
    // Still true, and still the point: naming must not cost the answer key.
    check('and none of it fetches the exam or quiz collections',
        !/['"`]\/exams\//.test(service) && !/['"`]\/quizzes\//.test(service));

    /*
      A quiz cannot be named by anything that does not also ship its answers, so
      the caption is derived from what is actually plotted rather than written by
      hand - the same correction as the activity caption that claimed "per week"
      while the buckets were nine days.
    */
    const view = source('src/views/Leaderboard.vue');
    check('the Most studied caption is derived, not hardcoded',
        /subjectsSubtitle/.test(view)
        && !/Distinct learners who took each assessment/.test(view));
}

console.log('\n18. The labs (app 11), and the four ways counting them goes wrong');
{
    const lab = (over: Partial<LeaderboardEvent> = {}): LeaderboardEvent => ({
        kind: 'lab', userId: 'u1', name: '', subjectId: 'docker-01',
        score: 100, passed: true, at: ago(1), labPoints: 8, labPossible: 8,
        ...over,
    });

    /* ---- what a lab is worth ---- */
    check('a lab is scored on its own task points plus a completion bonus',
        pointsFor(lab({ labPoints: 8, passed: true }))
        === 8 * POINTS.labTaskPoint + POINTS.labCompleted);

    /*
      THE ONE THAT WOULD BE "FIXED" BY MOVING THE LAB BEHIND THE `passed` GATE.

      A lab has no pass mark - `passed` means finished - so a half-done lab is not
      a failure, it is tasks the service inspected the environment for and
      confirmed. Gated like an exam, every in-progress lab on the platform scores
      zero and the board only ever moves when somebody finishes one.
    */
    check('AN UNFINISHED LAB STILL SCORES ITS FINISHED TASKS',
        pointsFor(lab({ labPoints: 3, passed: false })) === 3 * POINTS.labTaskPoint);

    check('...and earns no completion bonus for it',
        pointsFor(lab({ labPoints: 3, passed: false })) < POINTS.labCompleted
        + 3 * POINTS.labTaskPoint);

    check('a lab with nothing done is worth nothing',
        pointsFor(lab({ labPoints: 0, passed: false })) === 0);

    /*
      No distinction bonus on a lab. A lab's score IS its completion, so a 100%
      lab already earns the completion award and the bonus would pay twice - the
      same mistake `examCertificate: 0` exists to avoid.
    */
    check('a 100% lab gets no distinction bonus on top',
        pointsFor(lab({ score: 100, labPoints: 8, passed: true }))
        === 8 * POINTS.labTaskPoint + POINTS.labCompleted);

    check('a finished lab lands below an exam pass and above a quiz pass, which '
        + 'is the ordering the printed table promises',
        pointsFor(lab({ labPoints: 4, passed: true })) > POINTS.quizPassed
        && pointsFor(lab({ labPoints: 13, passed: true })) < POINTS.examPassed);

    /* ---- what a lab is NOT ---- */
    const rows = aggregate([lab({ labPoints: 8, passed: true })]);
    check('one learner, one row', rows.length === 1);

    /*
      THE BUG THIS SECTION EXISTS FOR. Without its own branch in `aggregate` a
      lab falls through to the certificate `else`, so "Credentials earned" and
      every row's credential count silently include lab progress - and a learner
      five labs in appears to hold five certificates nobody issued.
    */
    check('A LAB IS NOT A CERTIFICATE',
        rows[0].certificates === 0 && rows[0].courseCertificates === 0
        && rows[0].examCertificates === 0);

    /*
      And not an assessment. A lab has no pass mark, so folding it into the
      pass-rate denominator would move the platform pass rate for a reason no
      reader could account for.
    */
    check('a lab is not an assessment, so the pass rate does not move',
        rows[0].assessmentsTaken === 0 && rows[0].assessmentsPassed === 0
        && rows[0].passRate === 0);

    check('and a lab does not enter the average score',
        rows[0].averageScore === 0 && rows[0].bestScore === 0);

    check('a lab counts as a lab', rows[0].labsCompleted === 1
        && rows[0].labsStarted === 1 && rows[0].labPoints === 8);

    const partial = aggregate([lab({ labPoints: 3, passed: false })]);
    check('an unfinished lab is started and not completed',
        partial[0].labsStarted === 1 && partial[0].labsCompleted === 0);

    /* ---- the score histogram and the totals ---- */
    check('the score histogram ignores labs - it plots assessment marks',
        scoreDistribution([lab({ score: 100 })]).every(bucket => bucket.count === 0));

    const board = buildBoard([
        lab({ labPoints: 8, passed: true }),
        ev({ userId: 'u2', subjectId: 'e1', score: 80 }),
    ], { now: NOW });
    check('the totals report labs completed separately from credentials',
        board.totals.labsCompleted === 1 && board.totals.certificates === 0);
    check('and a lab earns its learner a place on the board',
        board.rows.some(row => row.userId === 'u1' && row.points > 0));

    /* ---- the activity chart ---- */
    const series = activitySeries([lab({ at: ago(1) })], { now: NOW, window: '7d' });
    check('a lab IS activity, so it appears in the activity series',
        series.reduce((n, point) => n + point.count, 0) === 1);

    /* ---- the name ---- */
    const onlyLabs = aggregate([lab({ name: '', fallbackName: 'mahmoud' })]);
    check('a learner known only by their lab progress is printed under their '
        + 'username rather than as the literal "Learner"',
        onlyLabs[0].name === 'mahmoud');

    /*
      And the half that matters more: a username must NOT displace a real name.
      `aggregate` prefers the freshest name, and a lab record's `last_active` is
      routinely newer than a certificate's issue date - so carrying the username
      as `name` would replace the full name somebody's certificate carries.
    */
    const both = aggregate([
        ev({ kind: 'course_certificate', subjectId: 'c1', name: 'Aya Nasser',
             score: null, at: ago(10) }),
        lab({ name: '', fallbackName: 'aya', at: ago(1) }),
    ]);
    check('A USERNAME NEVER DISPLACES A REAL NAME, however much fresher it is',
        both[0].name === 'Aya Nasser');

    /* ---- the subjects chart ---- */
    const subjects = topSubjects([
        lab({ subjectId: 'docker-01', subjectName: 'Your first container' }),
        lab({ userId: 'u2', subjectId: 'docker-01',
              subjectName: 'Your first container' }),
        lab({ userId: 'u3', subjectId: 'linux-01' }),
    ], ['lab'], 6);
    check('a named lab reaches the subjects chart, counted in learners',
        subjects.length === 1 && subjects[0].learners === 2
        && subjects[0].name === 'Your first container');
    check('and a lab nothing can name is dropped rather than labelled',
        !subjects.some(row => row.subjectId === 'linux-01'));

    /* ---- the window ---- */
    const windowed = buildBoard([lab({ at: ago(40), labPoints: 8 })],
        { now: NOW, window: '7d' });
    check('a lab finished forty days ago is outside the seven-day window',
        windowed.rows.length === 0);
}

console.log('\n19. The lab data layer names its collection');
{
    // `code`, not `source`: comments stripped. This file explains at length why
    // it never fetches `/exams/`, and a check that fires on the paragraph
    // documenting it is a check nobody can document (working rule 44). Section
    // 16 already learned this; the first version of this section did not, and it
    // failed on its own prose.
    const service = code('src/services/leaderboard.service.ts');

    /*
      THE TRAP THAT MADE THIS EMPTY ON THE FIRST ATTEMPT.

      App 11 answers `{count, progress: [...]}` and
      `{count, labs: [...], tracks: [...]}`. `normalizePaginatedResponse` sees
      `count` in the object, reads it as DRF's envelope, looks for `results`,
      finds none, and hands back an EMPTY LIST with a count of five - no error,
      no warning, and a board that silently scores nobody for their labs. The
      same shape broke the console's lesson form on the same day.
    */
    check('the lab progress read NAMES its list',
        /'\/api\/labs\/progress\/',\s*'progress'/.test(service));
    check('and so does the lab title read',
        /'\/api\/labs\/',\s*'labs'/.test(service));
    check('the collection helper can name a list at all',
        /Array\.isArray\(\(response as any\)\[key\]\)/.test(service));

    /*
      A lab merely OPENED is not an achievement. App 11 writes a `not_started`
      record the moment somebody clicks into a lab - three of the five live
      records are exactly that - so counting them would put a learner on a public
      leaderboard for following a link.
    */
    check('a lab with no earned points is not an event',
        /if \(done <= 0\) continue;/.test(service));

    check('the lab source is reported like the others, so a partial load says so',
        /'Lab progress'/.test(service));

    /*
      THE ENGINE HONOURS THE DISTINCTION AND THE SERVICE HAS TO USE IT.

      The check above proves `fallbackName` is not allowed to displace a real
      name; nothing proved the service puts the username THERE rather than in
      `name`. Carried as `name` it would displace one, because `aggregate` prefers
      the freshest and a lab's `last_active` is routinely newer than a
      certificate's issue date - a regression invisible to every engine test.
    */
    check('the username is carried as `fallbackName`, never as `name`',
        /fallbackName: String\(row\?\.username/.test(service)
        && !/name: String\(row\?\.full_name \|\| row\?\.username/.test(service));

    // Still true of the new read: naming a subject must not cost an answer key.
    check('and reading the labs did not bring the exam collections back',
        !/['"`]\/exams\//.test(service) && !/['"`]\/quizzes\//.test(service));

    const view = source('src/views/Leaderboard.vue');
    check('the page prints what a lab is worth, like every other award',
        /POINTS\.labTaskPoint/.test(view) && /POINTS\.labCompleted/.test(view));
    check('and shows labs completed as its own figure rather than folded into '
        + 'credentials',
        /totals\.labsCompleted/.test(view) && /row\.labsCompleted/.test(view));
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
