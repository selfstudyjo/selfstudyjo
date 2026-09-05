/**
 * One learner's whole record, as the leaderboard's activity view reads it.
 *
 * A plain module, no Vue and no clock, on the `leaderboardEngine.ts` precedent
 * and driven by `npm run check:leaderboard`. It exists as a module of its own
 * rather than as a section of the engine for one reason: the engine's job is
 * **who is ahead**, and this file's job is **how one person got there**. Those
 * are different questions with different failure modes - the engine's mistakes
 * are invisible until somebody notices a ranking is wrong, and this file's are
 * visible the moment anybody opens the panel - and keeping them apart is what
 * stops a dossier field creeping into the ranking arithmetic.
 *
 * WHAT IT IS FOR
 *
 * The activity panel has to answer, for one named learner: how the points were
 * accumulated, why any were taken away and when, which courses they are
 * enrolled on, which labs they have finished and which they are in the middle
 * of, which credentials they hold, and which assessments they passed and
 * failed. That is a lot of separate lists, and the reason they are built here
 * in one pass is that they all come out of the SAME event array - so a second
 * pass in a component would be a second chance for one of them to disagree
 * with the totals printed above it.
 *
 * THE ONE DECISION THAT IS NOT OBVIOUS
 *
 * **A failed assessment appears in this panel, and the board still does not
 * print one on a row.** The leaderboard's own header says it publishes no
 * attributed failures, on the reasoning that "this named person failed that
 * exam on Tuesday" is not a fact a public page should carry in a column beside
 * their name. Putting it behind a button the reader has to open, on a panel
 * about one person, headed as their record, is a different act - and it is
 * required for the panel to be honest at all: a record that showed only
 * successes and a points total that had visibly gone down would be a record
 * that hid its own arithmetic.
 *
 * What is still never shown is the `user_id` (see `matchesQuery` in the engine)
 * and the CONTENT of anything - a copied string, an answer, a question. The
 * detail on a breach is a character count, decided in
 * `practiceIntegrity.describeCopy` and truncated again by app 20.
 */

import {
    POINTS,
    isDated,
    pointsFor,
    type Achievement,
    type LeaderboardEvent,
    type LeaderRow,
} from './leaderboardEngine';
import type { Params } from '@/i18n';

/* ------------------------------------------------------------------ *
 * The extra collections that are not achievements
 * ------------------------------------------------------------------ */

/**
 * A course somebody signed up to.
 *
 * Enrolling is not an achievement and earns nothing - the panel shows it
 * because "what are they working on" is most of what a reader wants and none of
 * the achievement events answer it. It is why `Enrolments` is a separate input
 * rather than another `Achievement` kind: a kind would be scored by `pointsFor`
 * and would land in the ranking.
 */
export interface Enrolment {
    courseId: string;
    courseName?: string;
    at: number;
}

/**
 * A lab as app 11 records it, INCLUDING the ones with nothing done yet.
 *
 * The leaderboard drops a lab with no verified task (`earned <= 0`), and it is
 * right to: app 11 writes a record the moment somebody clicks a link, so
 * counting those would put a learner on a public board for following one. A
 * DOSSIER is the opposite case - "currently working on" is exactly the thing a
 * zero-progress record is evidence of - so this input carries them all and the
 * split happens here.
 */
export interface LabRow {
    labId: string;
    labName?: string;
    track?: string;
    status: string;
    earned: number;
    possible: number;
    percent: number;
    startedAt: number;
    lastAt: number;
    completedAt: number;
}

export interface DossierInput {
    userId: string;
    /** Every achievement AND practice event on the platform, unfiltered. */
    events: readonly LeaderboardEvent[];
    row?: LeaderRow | null;
    enrolments?: readonly Enrolment[];
    labs?: readonly LabRow[];
}

/* ------------------------------------------------------------------ *
 * The shapes the panel renders
 * ------------------------------------------------------------------ */

/** One line in "how the points were accumulated". */
export interface LedgerLine {
    id: string;
    kind: Achievement;
    /** What it was: an exam title, a lab name, a conduct action's label. */
    title: string;
    /** Why it is worth what it is worth. Never empty for a conduct line. */
    reason: string;
    points: number;
    at: number;
    /** For a conduct line. Everything else is `neutral`. */
    severity: 'positive' | 'negative' | 'neutral';
    /** 0-100 where there is one. */
    score?: number | null;
    passed?: boolean;
    detail?: string;
}

export interface AssessmentLine {
    subjectId: string;
    title: string;
    score: number | null;
    passed: boolean;
    at: number;
    attempts: number;
}

export interface CredentialLine {
    subjectId: string;
    title: string;
    kind: 'course_certificate' | 'exam_certificate';
    at: number;
    hours: number;
}

export interface ConductCount {
    action: string;
    label: string;
    reason: string;
    count: number;
    points: number;
    severity: 'positive' | 'negative' | 'neutral';
}

export interface Dossier {
    userId: string;
    name: string;
    avatarUrl: string;
    /** Everything, newest first. The panel's main list. */
    ledger: LedgerLine[];
    /** Only the lines that moved the total, newest first. */
    pointLedger: LedgerLine[];
    achievementPoints: number;
    conductPoints: number;
    points: number;
    exams: { passed: AssessmentLine[]; failed: AssessmentLine[] };
    quizzes: { passed: AssessmentLine[]; failed: AssessmentLine[] };
    credentials: CredentialLine[];
    labsCompleted: LabRow[];
    labsCurrent: LabRow[];
    enrolments: Enrolment[];
    conduct: {
        positives: number;
        negatives: number;
        positivePoints: number;
        penaltyPoints: number;
        /** Per action, worst first. What the conduct chart plots. */
        byAction: ConductCount[];
        /** Sittings that reached the strike limit, by session id. */
        voidedSittings: string[];
    };
    firstActiveAt: number;
    lastActiveAt: number;
}

/* ------------------------------------------------------------------ *
 * Building it
 * ------------------------------------------------------------------ */

/**
 * Why a non-conduct achievement earned what it earned, in words.
 *
 * English catalogue keys with `{v0}` placeholders. Returned as a key plus params
 * so the caller can put them through `$t` - a sentence finished here would be
 * untranslatable and `check:i18n` would report every one of them as an orphan,
 * because no source file would contain the literal.
 */
export function reasonFor(event: LeaderboardEvent): { key: string; params: Params } {
    switch (event.kind) {
        case 'exam':
            return event.passed
                ? { key: 'Passed an exam — {v0} points, plus {v1} for a distinction at {v2} or above.', params: { v0: POINTS.examPassed, v1: POINTS.distinction, v2: 90 } }
                : { key: 'An attempt that did not pass. It earns nothing and it counts towards the pass rate, which is the only way that figure means anything.', params: {} };
        case 'quiz':
            return event.passed
                ? { key: 'Passed a quiz — {v0} points, plus {v1} for a distinction.', params: { v0: POINTS.quizPassed, v1: POINTS.distinction } }
                : { key: 'An attempt that did not pass. It earns nothing and it counts towards the pass rate, which is the only way that figure means anything.', params: {} };
        case 'course_certificate':
            return { key: 'A course certificate — {v0} points. It is the one credential that scores, because nothing else records finishing a course.', params: { v0: POINTS.courseCertificate } };
        case 'exam_certificate':
            return { key: 'Issued automatically for passing the exam, so it is worth nothing on its own — the pass already earned the points. It is still a credential.', params: {} };
        case 'lab':
            return { key: '{v0} verified tasks at {v1} points each{v2}.', params: {
                v0: Math.max(0, Math.round(Number(event.labPoints) || 0)),
                v1: POINTS.labTaskPoint,
                v2: event.passed ? `, plus ${POINTS.labCompleted} for finishing it` : '',
            } };
        default:
            return { key: '', params: {} };
    }
}

/**
 * What each kind of line is called, as English catalogue keys.
 *
 * HERE rather than in `LearnerActivity.vue` for the reason `BADGE_NAMES` is in
 * `dashboardProgress.ts`: the component reaches them through a variable
 * (`$t(kindLabel(line.kind))`), so no source file holds the literal and
 * `check:i18n` can neither see them in its coverage scan nor tell them from
 * orphans. Exported from a plain module, that check imports the table and
 * verifies it - so a kind added without its copy fails there instead of
 * rendering its raw id on somebody's public record.
 */
export const KIND_LABELS: Record<Achievement, string> = {
    exam: 'Exam',
    quiz: 'Quiz',
    lab: 'Lab',
    course_certificate: 'Course certificate',
    exam_certificate: 'Exam certificate',
    practice: 'Conduct',
};

/**
 * Every `reasonFor` key, derived by calling it rather than written out.
 *
 * Same argument as `PRACTICE_KEYS`: these are spent as
 * `$t(line.reason, params)` and a hand-written copy would go stale the day
 * somebody rewords one - with the symptom being a sentence that reverts to
 * English on a panel whose entire purpose is explaining an award.
 */
export const REASON_KEYS: readonly string[] = (() => {
    const keys = new Set<string>();
    const kinds: Achievement[] = ['exam', 'quiz', 'course_certificate',
        'exam_certificate', 'lab'];
    for (const kind of kinds) {
        for (const passed of [true, false]) {
            const key = reasonFor({
                kind, userId: '', name: '', subjectId: 's', passed, at: 0,
                labPoints: 3,
            }).key;
            if (key) keys.add(key);
        }
    }
    return [...keys];
})();

/** A stable id for a ledger line, so a re-render does not re-key the list. */
function lineId(event: LeaderboardEvent, index: number): string {
    return event.unique || `${event.kind}:${event.subjectId}:${index}`;
}

/**
 * One learner's record, from the whole platform's events.
 *
 * Filters to the learner FIRST and then builds, which is the opposite order
 * from `buildBoard` and deliberately so: there is no window here. A dossier is
 * somebody's whole history, because the question it answers is "what has this
 * person done", and a panel that silently showed the last thirty days would be
 * the "0 of 4 collections" footer bug in a new place - a number presented as
 * the whole truth when it is not.
 */
export function buildDossier(input: DossierInput): Dossier {
    const userId = String(input.userId || '');
    const mine = input.events.filter(event => event?.userId === userId);

    const ledger: LedgerLine[] = [];
    /** Best attempt per assessment, and how many attempts there were. */
    const assessments = new Map<string, AssessmentLine & { kind: Achievement }>();
    const credentials: CredentialLine[] = [];
    const byAction = new Map<string, ConductCount>();
    const voided = new Set<string>();
    /** Negatives per sitting, so a voided one can be named. */
    const strikes = new Map<string, number>();

    let achievementPoints = 0;
    let conductPoints = 0;
    let positives = 0;
    let negatives = 0;
    let positivePoints = 0;
    let penaltyPoints = 0;
    let name = '';
    let nameAt = Number.NEGATIVE_INFINITY;
    let avatarUrl = '';
    let firstActiveAt = Number.POSITIVE_INFINITY;
    let lastActiveAt = Number.NEGATIVE_INFINITY;

    mine.forEach((event, index) => {
        const stamp = isDated(event) ? event.at : Number.NEGATIVE_INFINITY;
        if (event.name && stamp >= nameAt) { name = event.name; nameAt = stamp; }
        else if (!name && event.name) name = event.name;
        if (event.avatarUrl) avatarUrl = event.avatarUrl;
        if (isDated(event)) {
            if (event.at < firstActiveAt) firstActiveAt = event.at;
            if (event.at > lastActiveAt) lastActiveAt = event.at;
        }

        const value = pointsFor(event);

        if (event.kind === 'practice') {
            conductPoints += value;
            const severity = event.severity || 'neutral';
            if (severity === 'negative') {
                negatives += 1;
                penaltyPoints += value;
                const session = event.sessionId || '';
                if (session) {
                    const count = (strikes.get(session) || 0) + 1;
                    strikes.set(session, count);
                    // Five is the limit app 20 applies, and it is the limit
                    // `practiceIntegrity.FAILS_AT` publishes. Not imported: this
                    // module is about presenting a record and the number is
                    // asserted equal in the check, so an import here would be a
                    // dependency for a constant rather than for a decision.
                    if (count >= 5 && event.context !== 'lab') voided.add(session);
                }
            } else if (value > 0) {
                positives += 1;
                positivePoints += value;
            }
            const action = event.action || '';
            const held = byAction.get(action);
            if (held) { held.count += 1; held.points += value; }
            else {
                byAction.set(action, {
                    action,
                    label: event.label || action,
                    reason: event.reason || '',
                    count: 1,
                    points: value,
                    severity,
                });
            }
            ledger.push({
                id: lineId(event, index),
                kind: 'practice',
                title: event.label || action,
                reason: event.reason || '',
                points: value,
                at: event.at,
                severity,
                detail: event.detail || '',
            });
            return;
        }

        achievementPoints += value;

        if (event.kind === 'exam' || event.kind === 'quiz') {
            const key = `${event.kind}:${event.subjectId}`;
            const held = assessments.get(key);
            const line: AssessmentLine & { kind: Achievement } = {
                kind: event.kind,
                subjectId: event.subjectId,
                title: event.subjectName || '',
                score: typeof event.score === 'number' ? event.score : null,
                passed: !!event.passed,
                at: event.at,
                attempts: 1,
            };
            if (!held) assessments.set(key, line);
            else {
                held.attempts += 1;
                // The BEST attempt is the one shown, matching the board. A
                // panel that showed the latest would contradict the total
                // beside it, which is the fastest way to make a reader stop
                // believing either.
                const mineScore = line.score ?? -1;
                const heldScore = held.score ?? -1;
                if (mineScore > heldScore
                    || (mineScore === heldScore && isDated(event)
                        && (!Number.isFinite(held.at) || event.at < held.at))) {
                    held.score = line.score;
                    held.passed = line.passed;
                    held.at = line.at;
                    held.title = line.title || held.title;
                }
                if (line.title && !held.title) held.title = line.title;
            }
        } else if (event.kind === 'course_certificate'
                   || event.kind === 'exam_certificate') {
            credentials.push({
                subjectId: event.subjectId,
                title: event.subjectName || '',
                kind: event.kind,
                at: event.at,
                hours: Number(event.hours) || 0,
            });
        }

        ledger.push({
            id: lineId(event, index),
            kind: event.kind,
            title: event.subjectName || '',
            // The key, not a sentence. The panel puts it through `$t`.
            reason: reasonFor(event).key,
            points: value,
            at: event.at,
            severity: 'neutral',
            score: typeof event.score === 'number' ? event.score : null,
            passed: !!event.passed,
        });
    });

    const labs = [...(input.labs || [])];
    const labsCompleted = labs
        .filter(lab => lab.status === 'completed')
        .sort((a, b) => (b.completedAt || b.lastAt) - (a.completedAt || a.lastAt));
    /*
      "CURRENT" IS NOT "EVERYTHING ELSE".

      A record app 11 wrote when somebody clicked a link and never came back is
      not a lab in progress - it is a link that was followed - and listing it as
      current would make the panel claim work that has not started. `earned > 0`
      or a status of `in_progress` is the floor, which is the same distinction
      the leaderboard service draws for scoring.
    */
    const labsCurrent = labs
        .filter(lab => lab.status !== 'completed'
            && (lab.earned > 0 || lab.status === 'in_progress'))
        .sort((a, b) => b.lastAt - a.lastAt);

    // Newest first. `id` breaks a tie so two events written in the same
    // millisecond cannot swap places between renders - the same total-order
    // rule `compareRows` follows, for the same reason.
    ledger.sort((a, b) => (b.at || 0) - (a.at || 0)
        || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const list = [...assessments.values()];
    const split = (kind: Achievement) => ({
        passed: list.filter(row => row.kind === kind && row.passed)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.at - a.at),
        failed: list.filter(row => row.kind === kind && !row.passed)
            .sort((a, b) => b.at - a.at),
    });

    return {
        userId,
        name: name || input.row?.name || '',
        avatarUrl: avatarUrl || input.row?.avatarUrl || '',
        ledger,
        pointLedger: ledger.filter(line => line.points !== 0),
        achievementPoints,
        conductPoints,
        points: achievementPoints + conductPoints,
        exams: split('exam'),
        quizzes: split('quiz'),
        credentials: credentials.sort((a, b) => (b.at || 0) - (a.at || 0)),
        labsCompleted,
        labsCurrent,
        enrolments: [...(input.enrolments || [])]
            .sort((a, b) => (b.at || 0) - (a.at || 0)),
        conduct: {
            positives,
            negatives,
            positivePoints,
            penaltyPoints,
            byAction: [...byAction.values()].sort((a, b) =>
                Math.abs(b.points) - Math.abs(a.points)
                || b.count - a.count
                || (a.action < b.action ? -1 : 1)),
            voidedSittings: [...voided].sort(),
        },
        firstActiveAt: Number.isFinite(firstActiveAt) ? firstActiveAt : 0,
        lastActiveAt: Number.isFinite(lastActiveAt) ? lastActiveAt : 0,
    };
}

/* ------------------------------------------------------------------ *
 * The charts
 * ------------------------------------------------------------------ */

export interface PointsPoint {
    start: number;
    label: string;
    /** Points earned in this bucket. Can be negative. */
    points: number;
    /** The total up to and including this bucket. */
    cumulative: number;
    /**
     * How many things happened in this bucket.
     *
     * Beside the points and not instead of them, because the two disagree in a
     * way that is worth seeing: a week with nine actions and two points is a
     * week somebody worked and lost most of it, and a chart of points alone
     * would show that as a quiet week.
     */
    count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Points over time, per bucket AND cumulative, including the empty buckets.
 *
 * Both, because they answer different questions and a panel about one person
 * wants both: the per-bucket series shows when they worked and the cumulative
 * one shows the shape of their progress. Empty buckets are included for the
 * reason `activitySeries` gives - a series built only from the events that
 * exist skips every quiet week, so a line drawn through it implies activity
 * that did not happen and compresses the axis into whichever weeks were busy.
 *
 * `now` is a parameter, never the clock, so what gets tested is the bucketing.
 */
export function pointsSeries(
    ledger: readonly LedgerLine[], opts: { now: number; buckets?: number },
): PointsPoint[] {
    const dated = ledger.filter(line => Number.isFinite(line.at) && line.at > 0);
    const wanted = Math.max(4, opts.buckets ?? 16);
    if (!dated.length) return [];

    const earliest = Math.min(...dated.map(line => line.at));
    const span = Math.max(opts.now - earliest, 7 * DAY_MS);
    const step = Math.max(DAY_MS, Math.ceil(span / wanted / DAY_MS) * DAY_MS);
    const from = opts.now - Math.ceil(span / step) * step;

    const points: PointsPoint[] = [];
    // `start < now`, so the last bucket is the one the present moment is in.
    // `<= now` opens one more that covers the future and is therefore always
    // empty - a permanently blank column at the right edge, which reads as
    // today having no activity.
    for (let start = from; start < opts.now; start += step) {
        points.push({ start, label: bucketLabel(start, step), points: 0,
                      cumulative: 0, count: 0 });
    }
    if (!points.length) return points;

    const origin = points[0].start;
    for (const line of dated) {
        if (line.at < origin || line.at > opts.now) continue;
        const index = Math.min(points.length - 1,
                               Math.floor((line.at - origin) / step));
        points[index].points += line.points;
        points[index].count += 1;
    }
    let running = 0;
    for (const point of points) {
        running += point.points;
        point.cumulative = running;
    }
    return points;
}

function bucketLabel(start: number, step: number): string {
    const date = new Date(start);
    if (step <= 14 * DAY_MS) {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

export interface SourceSlice { label: string; points: number; }

/**
 * Where the points came from, by kind.
 *
 * The labels are English catalogue keys. Ordered by the fixed list rather than
 * by size, because this chart is read beside the scoring table and the two
 * reading in the same order is what lets somebody check one against the other.
 * A source worth nothing is dropped: a bar at zero is not information, and
 * `exam_certificate` is worth nothing by design.
 */
export function pointsBySource(ledger: readonly LedgerLine[]): SourceSlice[] {
    const order: { kind: Achievement; label: string }[] = [
        { kind: 'exam', label: 'Exams' },
        { kind: 'quiz', label: 'Quizzes' },
        { kind: 'lab', label: 'Labs' },
        { kind: 'course_certificate', label: 'Course certificates' },
        { kind: 'practice', label: 'Conduct' },
    ];
    const totals = new Map<Achievement, number>();
    for (const line of ledger) {
        totals.set(line.kind, (totals.get(line.kind) || 0) + line.points);
    }
    return order
        .map(row => ({ label: row.label, points: totals.get(row.kind) || 0 }))
        .filter(row => row.points !== 0);
}

/** "3 days ago" as a bucket count, for the panel's headline figures. */
export function activeDays(ledger: readonly LedgerLine[]): number {
    const days = new Set<string>();
    for (const line of ledger) {
        if (!Number.isFinite(line.at) || line.at <= 0) continue;
        days.add(new Date(line.at).toISOString().slice(0, 10));
    }
    return days.size;
}
