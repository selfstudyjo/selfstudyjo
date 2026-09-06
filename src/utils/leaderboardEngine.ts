/**
 * The leaderboard's model: what an achievement is worth, who is ahead, and what
 * the charts plot.
 *
 * A plain module — no Vue, no Pinia, no router, and no reading of the clock —
 * for the same reason as `photoMask.ts`, `drawEngine.ts`, `chatMedia.ts`,
 * `appNav.ts`, `examShuffle.ts`, `proctorQueue.ts` and `newscastEngine.ts`:
 * everything here is decidable without a browser, so `npm run check:leaderboard`
 * can assert the properties that are invisible until somebody notices them in
 * front of a ranked list of real people.
 *
 * WHY A MODULE RATHER THAN A COMPUTED IN THE VIEW
 *
 * Three of the properties below cannot be seen by looking at one afternoon's
 * board, and all three are the kind of wrong that gets *believed*:
 *
 *  1. **One attempt per assessment.** Points from every attempt means a learner
 *     who re-sits one quiz forty times outranks one who passed twelve courses.
 *     Nothing raises; the board is simply a ranking of persistence.
 *     `bestAttempts` is the single funnel every figure on the page goes through,
 *     so no caller can accidentally count a retake.
 *  2. **Deterministic ties.** Two learners on the same points must not swap
 *     places between renders. The rows are recomputed inside a computed that
 *     re-evaluates on every filter keystroke, so an unstable sort is a list that
 *     visibly reshuffles under the reader's cursor — the same trap
 *     `examShuffle.ts` documents for option order, and `sortScene` in
 *     `drawEngine.ts` for an equal `z`.
 *  3. **The window filters EVENTS, not rows.** Deduping over all time and then
 *     filtering would show a learner's all-time best attempt under a heading
 *     that says "this week", and drop the attempt they actually made this week.
 *     The order matters and it is asserted.
 *
 * `now` is always a parameter and never read from the clock, so what gets tested
 * is the windows rather than the hour the check happened to run.
 */

/* ------------------------------------------------------------------ *
 * What the platform produces
 * ------------------------------------------------------------------ */

/**
 * The five things a learner can earn that this platform actually records.
 *
 * Deliberately not "everything a learner does". A drawing and a message are
 * activity and neither is an *achievement* anybody could be ranked on without
 * the board turning into a volume contest — see `POINTS`.
 *
 * **A LAB IS THE ONE THAT LOOKS LIKE ACTIVITY AND IS NOT.** It was excluded on
 * exactly that reasoning when this file was written, and the reasoning was about
 * a *lab session* — opening a terminal and typing in it, which is unrankable.
 * What app 11 records now is not a session: it is `tasks_done`, and a task is
 * only done when the service INSPECTED THE ENVIRONMENT and found what the lab
 * asked for. That is a measured achievement, it is the same shape as a quiz
 * question marked right, and leaving it out meant a learner who had finished a
 * twelve-task Hadoop lab scored zero for it.
 */
import {
    PENALTY_CAP,
    afterClosure,
    closureOf,
    type PracticeContext,
} from './practiceIntegrity';

export type Achievement = 'exam' | 'quiz' | 'course_certificate' | 'exam_certificate'
    | 'lab' | 'practice';

/**
 * One earned thing, flattened out of whichever service holds it.
 *
 * `subjectId` is what makes an attempt unique — the exam, the quiz or the
 * course. It is the second half of the dedupe key, so a record without one
 * cannot be deduped and `bestAttempts` drops it rather than letting it inflate
 * somebody's total.
 */
export interface LeaderboardEvent {
    kind: Achievement;
    /** App 13's uuid. The join key across services, and never rendered. */
    userId: string;
    /** What the board prints. Already resolved by the service layer. */
    name: string;
    avatarUrl?: string;
    subjectId: string;
    subjectName?: string;
    /** 0-100 for an assessment; null for a certificate, which has no score. */
    score?: number | null;
    passed: boolean;
    /** Epoch ms. NaN for an unparseable date — see `isDated`. */
    at: number;
    /** Course certificates carry taught hours; nothing else does. */
    hours?: number;
    /**
     * A lab's own earned task points, out of `labPossible`. Nothing else carries
     * them.
     *
     * The lab's points rather than its task COUNT, because a lab weights its
     * harder tasks at 2 — using the count would pay the same for a lab that took
     * one command and one that took six.
     */
    labPoints?: number;
    labPossible?: number;
    /**
     * A name to print only when no other event supplied one.
     *
     * App 11's progress records carry a `username` and, on live data, an empty
     * `full_name` — so a learner known ONLY by their lab progress would otherwise
     * be printed as the literal "Learner". It cannot be `name`, because
     * `aggregate` prefers the FRESHEST name and a lab record's `last_active` is
     * routinely newer than a certificate's issue date: a username would then
     * displace the real full name somebody's certificate carries, which is a
     * visible regression in the one thing this page is for.
     */
    fallbackName?: string;
    /**
     * What makes THIS event unique, where the subject is not enough.
     *
     * `bestAttempts` dedupes on `(userId, kind, subjectId)`, which is exactly
     * right for an attempt at an exam and exactly wrong for a practice action:
     * a sitting produces a dozen of them against one subject and every one of
     * them happened. Set to the record's own id for those, so the dedupe key
     * discriminates rather than collapsing eleven events into one.
     *
     * Optional and unset everywhere else, because for an assessment the
     * collapsing IS the feature - see the note on `bestAttempts`.
     */
    unique?: string;
    /**
     * The points this event carries, for a kind whose value is not a constant.
     *
     * Only `practice` uses it. Everything else is looked up in `POINTS`,
     * because the platform decides what an exam pass is worth; a practice
     * action's value is decided by app 20's `utils/integrity.py` and travels
     * with the record, so that the browser cannot be the place a penalty is
     * chosen. See `pointsFor`.
     */
    points?: number;
    /** `practice` only: which way the points went, for the conduct counts. */
    severity?: 'positive' | 'negative' | 'neutral';
    /** `practice` only: what the ledger prints for it. An English key. */
    label?: string;
    /** `practice` only: bounded, and never the copied text. */
    detail?: string;
    /** `practice` only: which sitting it belongs to. */
    sessionId?: string;
    /** `practice` only: the catalogue key, e.g. `window.alt_tab`. */
    action?: string;
    /** `practice` only: why it is worth what it is worth. An English key. */
    reason?: string;
    /**
     * How the sitting that produced this attempt was judged for conduct.
     *
     * Empty on a record written before the ledger existed, and on every
     * submission that carried no sitting - which is most of them, so an absent
     * value is read as "not judged" and never as "judged clean". Only
     * `failed` changes anything: an attempt the service voided for misconduct
     * earns no credit for having been attempted, because it was not one.
     */
    integrityStatus?: string;
    /**
     * `practice` only: which kind of sitting it happened in.
     *
     * Not the same thing as `kind`. A practice action's `kind` is always
     * `practice` because that is what it is to the scoring; its `context` is
     * whether it happened during an exam, a quiz or a lab, which is what decides
     * whether five of them void anything. Collapsing the two would make a lab's
     * window-switching void a lab, which is the one thing the ledger must never
     * do.
     */
    context?: 'exam' | 'quiz' | 'lab';
    /**
     * `practice` only: this action's arithmetic was reduced or dropped.
     *
     * Set by `applyConductCaps` when a breach fell past the per-sitting cap or
     * landed after the sitting had ended. The line stays in the feed with its
     * label and its time - the evidence is the point of publishing a ledger -
     * and this is what lets a reader be told why it reads zero rather than
     * left to conclude the page has lost the number.
     */
    capped?: boolean;
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

/**
 * What each achievement is worth.
 *
 * A table rather than numbers spread through the view, so the page can *print*
 * it — a leaderboard whose scoring nobody can read is a leaderboard people
 * assume is rigged — and so the check can assert the relationships that have to
 * hold.
 *
 * **An exam certificate is worth nothing, and that is the considered answer
 * rather than an oversight.** App 20 issues one automatically on a pass
 * (`utils/certificates.py`), so scoring both pays twice for a single
 * achievement: every exam pass would quietly be worth 250 rather than 100, and
 * the handful of certificates issued *by hand* before that mechanism existed
 * would pay their owners for exams they may never have sat. It is still counted
 * and shown as a credential, because that is the thing a learner is proud of —
 * it just is not where the points come from. A **course** certificate is the
 * opposite case: an operator issues it for finishing a course, there is no
 * assessment record behind it, so it is the one credential that earns anything.
 */
export const POINTS = {
    examPassed: 100,
    quizPassed: 20,
    courseCertificate: 150,
    examCertificate: 0,
    /**
     * THE MARK IS WORTH SOMETHING, AND IT IS A SLOPE RATHER THAN A CLIFF.
     *
     * This replaced a flat +25 awarded at exactly 90. Two things were wrong
     * with that and both were visible to anybody who looked at two rows of the
     * board:
     *
     *  * **70% and 89% scored identically.** Nineteen marks of difference,
     *    hours of the difference in preparation, and the same 100 points. That
     *    is the "underestimating" half - a learner who very nearly aced a paper
     *    was told it counted for no more than scraping through.
     *  * **89% and 90% differed by 25.** One question, a quarter of what the
     *    whole pass was worth. That is the "overestimating" half, and a cliff
     *    at a round number is the shape a scoring system has when nobody has
     *    thought about the middle of it.
     *
     * It is now `mastery * (score - MASTERY_FROM) / (100 - MASTERY_FROM)`,
     * clamped at both ends, so the scale runs smoothly: 70 -> 100, 80 -> 113,
     * 90 -> 127, 100 -> 140. Deliberately anchored so that the old distinction
     * mark lands within two points of where it used to, because the top of the
     * scale was not the part that was wrong.
     */
    mastery: 40,
    /**
     * For a best attempt that FAILED, and was not voided for misconduct.
     *
     * The other cliff, and the sharper one: 69% earned nothing at all and 70%
     * earned a hundred, so a learner who sat four papers honestly and missed
     * three of them scored exactly as much as one who had never opened the
     * platform. Sitting a paper is work, and the board is a record of work.
     *
     * **It cannot be farmed**, and that is why it is safe to pay at all:
     * `bestAttempts` keeps ONE attempt per learner per subject, so forty
     * re-sits of one quiz are one credit. And a sitting the service voided for
     * cheating earns nothing - see `integrityStatus`, without which this would
     * pay somebody for being caught.
     *
     * Small on purpose. It is a fifth of a quiz pass and a twentieth of an exam
     * pass: enough that trying is not indistinguishable from not trying, never
     * enough that failing is a strategy.
     */
    attempted: 5,
    /**
     * A lab is scored on ITS OWN POINTS, plus a bonus for finishing it.
     *
     * Two numbers rather than one flat award, because a lab is the only
     * achievement here that is legitimately PARTIAL: `tasks_done` is checked task
     * by task against the environment, so somebody six tasks into a twelve-task
     * lab has genuinely done six tasks' worth of work. A flat "completed" award
     * would pay them nothing, which is the same wrongness as reporting a
     * `percent: 0` for a learner who has started.
     *
     * The scale is chosen so a finished lab lands just below an exam pass and
     * well above a quiz: labs run 4-13 task points, so a completed one is worth
     * 56 (a short Linux lab) to 92 (a full AWS lab) against 100 for an exam and
     * 20 for a quiz. Half an hour of hands-on work that the service verified is
     * worth more than a twenty-question quiz and less than a forty-question
     * paper, which is the ordering a reader would expect — and the whole table is
     * printed on the page, so if it is wrong it is arguable rather than hidden.
     *
     * **There is no distinction bonus on a lab.** A lab's score IS its
     * completion, so a 100% lab already earns the completion award; adding the
     * bonus on top would pay twice for one thing, which is the mistake
     * `examCertificate: 0` exists to avoid.
     */
    labCompleted: 40,
    labTaskPoint: 4,
} as const;

/**
 * Where the mastery slope starts.
 *
 * App 20's `DEFAULT_PASS_SCORE`, and it has to be a constant here rather than
 * the exam's own pass mark for a reason worth stating plainly: **the leaderboard
 * never fetches `/exams/`**, deliberately, because that route ships every
 * question with its `is_correct` flag and this page needs no account. So the
 * pass mark is not on the wire and cannot be.
 *
 * The consequence is honest and bounded: an exam with a pass mark BELOW 70
 * pays no mastery for the marks between its own mark and 70. That is the right
 * way round - mastery is a claim about how well the paper was answered, not
 * about clearing a bar somebody else set low - and it can never pay MORE than
 * it should, which is the direction that would matter.
 */
export const MASTERY_FROM = 70;

/**
 * The mark a best attempt has to reach to be COUNTED as a distinction.
 *
 * A label and a band edge, no longer a payment: `row.distinctions` and
 * `SCORE_BANDS` both use it and the points come from the slope above. Keeping
 * the two apart is what removed the cliff without removing the honour.
 */
export const DISTINCTION_SCORE = 90;

/**
 * What the mark itself is worth, on top of the pass.
 *
 * Zero at `MASTERY_FROM` and `POINTS.mastery` at 100, linear between, clamped
 * at both ends. Rounded, because a leaderboard that prints 113.33 is a
 * leaderboard nobody trusts the arithmetic of.
 */
export function masteryBonus(score: number | null | undefined): number {
    if (typeof score !== 'number' || !Number.isFinite(score)) return 0;
    const span = 100 - MASTERY_FROM;
    const over = Math.min(100, Math.max(MASTERY_FROM, score)) - MASTERY_FROM;
    return Math.round((POINTS.mastery * over) / span);
}

/**
 * What one event is worth on its own.
 *
 * A failed attempt is worth zero and is deliberately still an event: it is what
 * makes the pass rate honest. Drop failures and every learner on the board sits
 * at 100%, which tells the reader nothing and flatters everybody equally.
 */
export function pointsFor(event: LeaderboardEvent): number {
    /*
      THE LAB IS HANDLED BEFORE THE `passed` GATE, and that is the point of it
      being its own case.

      For every other kind, `passed: false` means the achievement did not happen
      and is worth nothing. A lab has no pass mark — `passed` on one means
      `status === 'completed'` — and a half-finished lab is not a failure, it is
      six tasks the service confirmed. Gated behind the early return, every
      in-progress lab on the platform would score zero and the board would only
      move when somebody finished one.
    */
    /*
      A PRACTICE ACTION CARRIES ITS OWN VALUE, and it is the only kind that
      does.

      Every other number in this file is a constant here, because what an exam
      pass is worth is a platform decision. What a breach costs is app 20's
      decision - `utils/integrity.py` looks the action up in its own catalogue
      on the way out, so the value on the record is authoritative and a browser
      that decided its own would be a browser that could forgive itself.

      Handled before the `passed` gate for the same reason a lab is: a practice
      event has no pass mark, and `passed` on one is meaningless.
    */
    if (event.kind === 'practice') {
        const carried = Number(event.points);
        return Number.isFinite(carried) ? carried : 0;
    }
    if (event.kind === 'lab') {
        const earned = Number(event.labPoints);
        const scored = Number.isFinite(earned) && earned > 0
            ? Math.round(earned) * POINTS.labTaskPoint : 0;
        return scored + (event.passed ? POINTS.labCompleted : 0);
    }
    /*
      A FAILED ATTEMPT IS NOT NOTHING, and this is the branch that says so.

      One credit per learner per subject, because `bestAttempts` has already
      collapsed the re-sits - so this cannot be farmed by sitting the same quiz
      forty times, which is the objection that kept it at zero for so long.

      A VOIDED sitting is excluded. Paying somebody for an attempt the service
      ended for cheating would be the ledger and the board disagreeing about the
      same event, and the board is the louder of the two.
    */
    if (!event.passed) {
        if (event.kind !== 'exam' && event.kind !== 'quiz') return 0;
        if (String(event.integrityStatus || '') === 'failed') return 0;
        // A certificate has no score and neither has an unattempted record;
        // what is being paid for is a paper somebody actually sat.
        return typeof event.score === 'number' ? POINTS.attempted : 0;
    }
    const mastery = masteryBonus(event.score);
    switch (event.kind) {
        case 'exam': return POINTS.examPassed + mastery;
        case 'quiz': return POINTS.quizPassed + mastery;
        case 'course_certificate': return POINTS.courseCertificate;
        case 'exam_certificate': return POINTS.examCertificate;
        default: return 0;
    }
}

/* ------------------------------------------------------------------ *
 * Conduct: bounded per sitting, and nothing after the end
 * ------------------------------------------------------------------ */

/**
 * The practice events, re-priced so one sitting cannot dominate a total.
 *
 * **Why here and not in `verdictFor`.** The verdict is what the meter shows and
 * what app 20 stamps on the result; the BOARD adds up the value carried on each
 * record, one event at a time, so a cap applied only in the verdict would be
 * cosmetic - the total would still be the uncapped sum. This is the one place
 * the two can be made to agree, and `buildBoard` and `buildDossier` both run it
 * before anything is aggregated.
 *
 * Three things it does, per `(user, context, sitting)`:
 *
 *  1. **Nothing after the sitting ended scores.** `assessment.submitted` closes
 *     a paper and `lab.completed` closes a lab. This is the reported bug and it
 *     is fixed here as well as on the service, because the records written
 *     before the service learned it are still in the store and still add up.
 *  2. **The penalty stops at `PENALTY_CAP`.** Charged exactly to the cap and
 *     then zero, rather than the whole event being dropped at the boundary: a
 *     learner two points over should be charged the two.
 *  3. **The order is the sitting's own.** Sorted by time and then by id, so the
 *     EARLIEST breaches are the ones that score and two renders of the same
 *     data cap the same events. An unstable order here would move points
 *     between reloads, which is the one thing a scoreboard may never do.
 *
 * A capped event keeps its label, its time and its place in the feed. What it
 * loses is its arithmetic - the evidence is the point of a published ledger and
 * `capped` is set so a reader can be told why the line reads zero.
 */
export function applyConductCaps(
    events: readonly LeaderboardEvent[],
): LeaderboardEvent[] {
    const sittings = new Map<string, LeaderboardEvent[]>();
    const out: LeaderboardEvent[] = [];
    for (const event of events || []) {
        if (event?.kind !== 'practice') { out.push(event); continue; }
        const key = [event.userId, event.context ?? '', event.sessionId ?? ''].join(SEP);
        const held = sittings.get(key);
        if (held) held.push(event); else sittings.set(key, [event]);
    }
    for (const group of sittings.values()) {
        const ordered = [...group].sort((a, b) =>
            (a.at || 0) - (b.at || 0)
            || String(a.unique ?? '').localeCompare(String(b.unique ?? '')));
        const context = (ordered[0]?.context ?? 'exam') as PracticeContext;
        const cap = PENALTY_CAP[context] ?? PENALTY_CAP.exam;
        const [stamp, atIndex] = closureOf(
            ordered.map(row => ({ action: row.action ?? '', at: row.at })), context);
        let spent = 0;
        ordered.forEach((event, index) => {
            const points = Number(event.points) || 0;
            const closed = afterClosure(
                { action: event.action ?? '', at: event.at }, index, stamp, atIndex);
            if (closed) { out.push({ ...event, points: 0, capped: true }); return; }
            if (points >= 0) { out.push(event); return; }
            const room = cap - spent;
            if (room >= 0) { out.push({ ...event, points: 0, capped: true }); return; }
            const charged = Math.max(points, room);
            spent += charged;
            out.push(charged === points ? event : { ...event, points: charged, capped: true });
        });
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * Windows
 * ------------------------------------------------------------------ */

export type BoardWindow = 'all' | '90d' | '30d' | '7d';

export const WINDOWS: readonly BoardWindow[] = ['all', '90d', '30d', '7d'];

/** How many days each window covers; `null` is "since the beginning". */
export const WINDOW_DAYS: Record<BoardWindow, number | null> = {
    all: null, '90d': 90, '30d': 30, '7d': 7,
};

export const WINDOW_LABEL: Record<BoardWindow, string> = {
    all: 'All time', '90d': 'Last 90 days', '30d': 'Last 30 days', '7d': 'Last 7 days',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** A timestamp that survived parsing. Everything else is undated, never zero. */
export function isDated(event: LeaderboardEvent): boolean {
    return Number.isFinite(event.at);
}

/**
 * The half-open interval a window covers: `[from, to)`.
 *
 * A null `from` means unbounded. Half-open rather than closed so consecutive
 * windows tile without an event landing in both — the same reason
 * `activitySeries` buckets the way it does.
 */
export function windowRange(win: BoardWindow, now: number): { from: number | null; to: number } {
    const days = WINDOW_DAYS[win];
    return { from: days === null ? null : now - days * DAY_MS, to: now };
}

/**
 * The window immediately before this one, for the rank movement column.
 *
 * Null for `all`, because there is no period before all time — and that is
 * exactly why movement has to be nullable rather than defaulting to zero. A
 * board showing a flat zero against every learner reads as "nobody moved", which
 * is a claim rather than the absence of one.
 */
export function previousRange(win: BoardWindow, now: number): { from: number; to: number } | null {
    const days = WINDOW_DAYS[win];
    if (days === null) return null;
    const span = days * DAY_MS;
    return { from: now - 2 * span, to: now - span };
}

/** Events inside `[from, to)`. An undated event only ever appears in `all`. */
export function inRange(
    events: readonly LeaderboardEvent[],
    range: { from: number | null; to: number },
): LeaderboardEvent[] {
    const from = range.from;
    if (from === null) return events.slice();
    return events.filter(e => isDated(e) && e.at >= from && e.at < range.to);
}

/* ------------------------------------------------------------------ *
 * One attempt per assessment
 * ------------------------------------------------------------------ */

/**
 * The separator inside a composite key.
 *
 * A NUL rather than a space or a dash: an exam's `external_id` is
 * operator-supplied and app 20 does not forbid punctuation in one, so any
 * printable separator could appear inside a component and let two different
 * keys collide. Written as an escape rather than as a literal control character
 * so this file stays plain ASCII — a stray NUL in the source makes `grep` treat
 * it as a binary file and silently stop printing matches, which is exactly how
 * it was found.
 */
const SEP = '\u0000';

/** The dedupe key. Not a string any caller outside this file ever sees. */
function attemptKey(event: LeaderboardEvent): string {
    // `unique` when the event has one. A practice action's subject is the exam
    // it happened during, and a sitting produces a dozen against one subject -
    // so without this the whole ledger collapses to one event per paper and the
    // conduct score is whatever the last one happened to be.
    return [event.userId, event.kind, event.subjectId,
            event.unique ?? ''].join(SEP);
}

/**
 * The best attempt at each assessment, per learner.
 *
 * **The single most important function here**, and the one every figure on the
 * page goes through. Without it the board ranks persistence: forty attempts at
 * one quiz is 800 points and beats passing eight exams, and nothing anywhere
 * says so.
 *
 * "Best" is the highest score, and on a tie the **earliest** — so a learner who
 * re-sits an exam they had already aced keeps the date they first did it, which
 * is what the activity chart and the "first to get there" tie-break both want. A
 * certificate has no score, so for those the tie rule is the whole rule and the
 * earliest issue date wins; two certificates for one course is a merge artefact
 * rather than a second achievement.
 *
 * A record with no `userId` or no `subjectId` is dropped rather than kept: it
 * cannot be deduped, so keeping it means one learner's total quietly growing by
 * however many malformed rows a replica happens to hold.
 */
export function bestAttempts(events: readonly LeaderboardEvent[]): LeaderboardEvent[] {
    const best = new Map<string, LeaderboardEvent>();
    for (const event of events) {
        if (!event || !event.userId || !event.subjectId) continue;
        const key = attemptKey(event);
        const held = best.get(key);
        if (!held) { best.set(key, event); continue; }
        const mine = typeof event.score === 'number' ? event.score : -1;
        const theirs = typeof held.score === 'number' ? held.score : -1;
        if (mine > theirs) { best.set(key, event); continue; }
        if (mine < theirs) continue;
        // Same score, or neither carries one: the earlier attempt is the one that
        // happened. An undated record never displaces a dated one.
        if (isDated(event) && (!isDated(held) || event.at < held.at)) best.set(key, event);
    }
    return [...best.values()];
}

/* ------------------------------------------------------------------ *
 * The rows
 * ------------------------------------------------------------------ */

export interface LeaderRow {
    /** Competition rank: equal points share it and the next rank skips. */
    rank: number;
    userId: string;
    name: string;
    avatarUrl: string;
    points: number;
    /** Every credential, course and exam alike. Not all of them score. */
    certificates: number;
    courseCertificates: number;
    examCertificates: number;
    examsPassed: number;
    quizzesPassed: number;
    /** Distinct assessments attempted, passed or not. The pass-rate denominator. */
    assessmentsTaken: number;
    assessmentsPassed: number;
    /** 0-1, over best attempts only. Zero when nothing scoreable was attempted. */
    passRate: number;
    /** Mean of the best attempts that carry a score. Zero when there are none. */
    averageScore: number;
    bestScore: number;
    distinctions: number;
    /** Taught hours, from course certificates. */
    learningHours: number;
    /** Labs finished — every task checked. A credential-shaped count. */
    labsCompleted: number;
    /** Labs with at least one task done, finished or not. */
    labsStarted: number;
    /** Task points earned across every lab, out of `labPointsPossible`. */
    labPoints: number;
    labPointsPossible: number;
    firstActiveAt: number;
    lastActiveAt: number;
    /**
     * Points earned and lost through CONDUCT, kept apart from the rest.
     *
     * Broken out rather than folded into `points` alone because the two answer
     * different questions and a reader is owed both: `points` is where somebody
     * stands, and this is how they got there. It is also the only figure on the
     * board that can be negative, which is the whole reason it is worth showing
     * separately - a total that quietly went down tells nobody why.
     */
    conductPoints: number;
    /** Conduct actions that earned. */
    positiveActions: number;
    /** Conduct actions that cost, which is what the strike limit counts. */
    negativeActions: number;
    /** Places gained since the previous window; null when there is no previous. */
    movement: number | null;
}

function blankRow(event: LeaderboardEvent): LeaderRow {
    return {
        rank: 0, userId: event.userId, name: '', avatarUrl: '',
        points: 0, certificates: 0, courseCertificates: 0, examCertificates: 0,
        examsPassed: 0, quizzesPassed: 0,
        assessmentsTaken: 0, assessmentsPassed: 0, passRate: 0,
        averageScore: 0, bestScore: 0, distinctions: 0, learningHours: 0,
        labsCompleted: 0, labsStarted: 0, labPoints: 0, labPointsPossible: 0,
        conductPoints: 0, positiveActions: 0, negativeActions: 0,
        firstActiveAt: Number.POSITIVE_INFINITY, lastActiveAt: Number.NEGATIVE_INFINITY,
        movement: null,
    };
}

/**
 * One row per learner, unranked and unsorted.
 *
 * Takes events that have **already** been deduped and windowed. Splitting it
 * this way is what lets `buildBoard` compute the previous window from the same
 * event list without either pass being able to see the other's dedupe.
 */
export function aggregate(events: readonly LeaderboardEvent[]): LeaderRow[] {
    const rows = new Map<string, LeaderRow>();
    const scores = new Map<string, number[]>();
    /* The timestamp each row's current name and picture came from. Tracked
       separately from `lastActiveAt` because that one moves for every event,
       including the ones carrying no name at all. */
    const nameAt = new Map<string, number>();
    /* A username, used only if nothing else ever supplied a name. See
       `LeaderboardEvent.fallbackName`. */
    const fallbackNames = new Map<string, string>();

    for (const event of events) {
        if (!event || !event.userId) continue;
        let row = rows.get(event.userId);
        if (!row) { row = blankRow(event); rows.set(event.userId, row); }

        /*
          The freshest name and picture win.

          `username` off an exam result and `user_full_name` off a certificate
          can legitimately disagree, and somebody who has changed their name
          should be printed under the new one. Taking whichever record was
          scanned first would make the answer depend on which service replied
          quicker — a display that changes for no reason the reader can see.

          A blank never displaces a filled value, which is the half that matters
          in practice: most exam certificates carry no picture (29 of 38 live
          profiles have no image at all), and one of those arriving later must
          not wipe the avatar a course certificate supplied.
        */
        const stamp = isDated(event) ? event.at : Number.NEGATIVE_INFINITY;
        const held = nameAt.get(event.userId);
        if (event.name && (held === undefined || stamp >= held)) {
            row.name = event.name;
            nameAt.set(event.userId, stamp);
        } else if (!row.name && event.name) {
            row.name = event.name;
        }
        if (event.fallbackName && !fallbackNames.has(event.userId)) {
            fallbackNames.set(event.userId, event.fallbackName);
        }
        if (event.avatarUrl) row.avatarUrl = event.avatarUrl;

        row.points += pointsFor(event);

        if (event.kind === 'exam' || event.kind === 'quiz') {
            row.assessmentsTaken += 1;
            if (event.passed) {
                row.assessmentsPassed += 1;
                if (event.kind === 'exam') row.examsPassed += 1; else row.quizzesPassed += 1;
                if (typeof event.score === 'number' && event.score >= DISTINCTION_SCORE) {
                    row.distinctions += 1;
                }
            }
            const score = Number(event.score);
            if (typeof event.score === 'number' && Number.isFinite(score)) {
                const list = scores.get(event.userId) ?? [];
                list.push(score);
                scores.set(event.userId, list);
                if (score > row.bestScore) row.bestScore = score;
            }
        } else if (event.kind === 'practice') {
            /*
              ITS OWN BRANCH, and for the reason the lab needed one.

              Left to fall through to the `else` below, a practice action would
              be counted as a CERTIFICATE - so "Credentials earned" and every
              row's credential count would include a student's window-switching,
              and somebody who lost focus five times would appear to hold five
              certificates nobody issued. That is not a hypothetical: it is
              exactly what happened to the labs before they were given a branch.

              It is also outside the assessment branch: a practice action has no
              pass mark, so folding it into `assessmentsTaken` would move the
              platform pass rate for a reason no reader could account for.
            */
            const carried = Number(event.points);
            if (Number.isFinite(carried)) row.conductPoints += carried;
            if (event.severity === 'negative') row.negativeActions += 1;
            else if (carried > 0) row.positiveActions += 1;
        } else if (event.kind === 'lab') {
            /*
              ITS OWN BRANCH, and not for tidiness.

              Left to fall through to the `else` below, a lab would have been
              counted as a CERTIFICATE — so the "Credentials earned" tile and
              every row's credential count would have silently included lab
              progress, and a learner five labs in would appear to hold five
              certificates they were never issued.

              It is also deliberately outside the assessment branch: a lab has no
              pass mark, so folding it into `assessmentsTaken` would move the
              platform pass rate for a reason no reader could account for.
            */
            const earned = Number(event.labPoints);
            const possible = Number(event.labPossible);
            if (Number.isFinite(earned) && earned > 0) row.labsStarted += 1;
            if (event.passed) row.labsCompleted += 1;
            if (Number.isFinite(earned)) row.labPoints += Math.max(0, earned);
            if (Number.isFinite(possible)) row.labPointsPossible += Math.max(0, possible);
        } else {
            row.certificates += 1;
            if (event.kind === 'course_certificate') {
                row.courseCertificates += 1;
                if (Number.isFinite(Number(event.hours))) row.learningHours += Number(event.hours);
            } else {
                row.examCertificates += 1;
            }
        }

        if (isDated(event)) {
            if (event.at < row.firstActiveAt) row.firstActiveAt = event.at;
            if (event.at > row.lastActiveAt) row.lastActiveAt = event.at;
        }
    }

    for (const row of rows.values()) {
        const list = scores.get(row.userId) ?? [];
        row.averageScore = list.length
            ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10
            : 0;
        row.passRate = row.assessmentsTaken ? row.assessmentsPassed / row.assessmentsTaken : 0;
        if (!row.name) row.name = fallbackNames.get(row.userId) || '';
        if (!row.name) row.name = 'Learner';
        if (row.firstActiveAt === Number.POSITIVE_INFINITY) row.firstActiveAt = 0;
        if (row.lastActiveAt === Number.NEGATIVE_INFINITY) row.lastActiveAt = 0;
    }

    return [...rows.values()];
}

/**
 * The order the board is read in, and it is total.
 *
 * Points decide it. Everything after that exists so the result cannot depend on
 * which order the replicas answered in: certificates, then average score, then
 * whoever got there first, then the id. The last is never a *meaningful*
 * tie-break and is not meant to be — it is there so the comparator is a total
 * order, which is what stops two learners trading places every time the reader
 * types a character into the filter box.
 */
export function compareRows(a: LeaderRow, b: LeaderRow): number {
    if (b.points !== a.points) return b.points - a.points;
    if (b.certificates !== a.certificates) return b.certificates - a.certificates;
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    const mine = a.firstActiveAt || Number.POSITIVE_INFINITY;
    const theirs = b.firstActiveAt || Number.POSITIVE_INFINITY;
    if (mine !== theirs) return mine - theirs;
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
}

/**
 * Sort and number the rows.
 *
 * **Competition ranking** — equal points share a rank and the next rank skips
 * (1, 2, 2, 4), because that is what "joint second" means to a reader. The rank
 * is shared on **points alone** rather than on the whole comparator: the rest of
 * the chain is there to make the order deterministic, and letting it split a tie
 * would print two different ranks for two learners the scoring cannot separate.
 *
 * A learner with no points is left off entirely. Zero-point rows are every
 * account that ever opened a quiz and closed it again, and they would be most of
 * the list.
 */
export function rank(rows: LeaderRow[]): LeaderRow[] {
    const ordered = rows.filter(row => row.points > 0).sort(compareRows);
    let lastPoints: number | null = null;
    let lastRank = 0;
    ordered.forEach((row, index) => {
        if (lastPoints === null || row.points !== lastPoints) {
            lastRank = index + 1;
            lastPoints = row.points;
        }
        row.rank = lastRank;
    });
    return ordered;
}

/* ------------------------------------------------------------------ *
 * The board
 * ------------------------------------------------------------------ */

export interface Totals {
    learners: number;
    /** Conduct points across the board. Can be negative. */
    conductPoints?: number;
    /** Breaches recorded across the board, for the transparency line. */
    negativeActions?: number;
    points: number;
    certificates: number;
    assessmentsPassed: number;
    assessmentsTaken: number;
    /** 0-1 over every best attempt on the board. */
    passRate: number;
    /** Mean of every scored best attempt. */
    averageScore: number;
    learningHours: number;
    /** Labs finished across the board. */
    labsCompleted: number;
}

export interface Board {
    window: BoardWindow;
    rows: LeaderRow[];
    totals: Totals;
    /** The same totals for the window before, or null for `all`. */
    previousTotals: Totals | null;
    /** Best attempts inside the window — what the charts plot. */
    events: LeaderboardEvent[];
}

function totalsOf(rows: readonly LeaderRow[], events: readonly LeaderboardEvent[]): Totals {
    const scored = events.filter(event =>
        (event.kind === 'exam' || event.kind === 'quiz')
        && typeof event.score === 'number' && Number.isFinite(event.score));
    const taken = rows.reduce((n, row) => n + row.assessmentsTaken, 0);
    const passed = rows.reduce((n, row) => n + row.assessmentsPassed, 0);
    return {
        learners: rows.length,
        points: rows.reduce((n, row) => n + row.points, 0),
        certificates: rows.reduce((n, row) => n + row.certificates, 0),
        assessmentsPassed: passed,
        assessmentsTaken: taken,
        passRate: taken ? passed / taken : 0,
        averageScore: scored.length
            ? Math.round((scored.reduce((n, e) => n + Number(e.score), 0) / scored.length) * 10) / 10
            : 0,
        learningHours: rows.reduce((n, row) => n + row.learningHours, 0),
        labsCompleted: rows.reduce((n, row) => n + row.labsCompleted, 0),
        conductPoints: rows.reduce((n, row) => n + row.conductPoints, 0),
        negativeActions: rows.reduce((n, row) => n + row.negativeActions, 0),
    };
}

/**
 * Everything the page renders, from one pass over the raw events.
 *
 * The order is the property worth protecting: **window, then dedupe, then
 * aggregate.** Deduping first would pick a learner's all-time best attempt and
 * only then ask whether it happened this week — so somebody who sat an exam
 * twice, scoring 95 last year and 71 on Monday, would vanish from the weekly
 * board entirely. `check:leaderboard` builds exactly that case.
 */
export function buildBoard(
    rawEvents: readonly LeaderboardEvent[],
    opts: { now: number; window?: BoardWindow },
): Board {
    /*
      THE CAPS RUN FIRST, over the WHOLE list rather than per window.

      A sitting is not a window: a paper sat on a Sunday night produces events
      either side of midnight, and capping inside a window would charge the cap
      twice for one sitting - once in each. Applied first, every window then
      reads the same already-priced events, which is also what makes the weekly
      board and the all-time board agree about the same afternoon.
    */
    const events = applyConductCaps(rawEvents);
    const win = opts.window ?? 'all';
    const current = bestAttempts(inRange(events, windowRange(win, opts.now)));
    const rows = rank(aggregate(current));

    const previous = previousRange(win, opts.now);
    let previousTotals: Totals | null = null;
    if (previous) {
        const before = bestAttempts(inRange(events, { from: previous.from, to: previous.to }));
        const beforeRows = rank(aggregate(before));
        previousTotals = totalsOf(beforeRows, before);
        const wasAt = new Map(beforeRows.map(row => [row.userId, row.rank]));
        for (const row of rows) {
            const then = wasAt.get(row.userId);
            // Absent from the previous window is not "climbed to fourth" — it is a
            // learner the board has nothing to compare against, and saying so is
            // the honest answer. The view renders it as NEW.
            row.movement = then === undefined ? null : then - row.rank;
        }
    }

    return { window: win, rows, totals: totalsOf(rows, current), previousTotals, events: current };
}

/* ------------------------------------------------------------------ *
 * What the charts plot
 * ------------------------------------------------------------------ */

/**
 * The score bands.
 *
 * Fixed rather than derived from the data, because a histogram whose buckets
 * move is a histogram nobody can compare between two windows. The boundaries are
 * the ones the platform already talks in — app 20's `DEFAULT_PASS_SCORE` is 70
 * and `DISTINCTION_SCORE` is 90 — so they are real boundaries rather than round
 * numbers.
 *
 * They are **ordinal, and the x-axis carries the order**, which is why nothing
 * here names a colour. Measured across the ten galaxies, no ramp built from a
 * single accent clears the ordinal light-end contrast floor in all of them — and
 * it does not need to, because left-to-right already says low-to-high, so colour
 * has no ordering work left to do and every bar wears the one accent. The
 * reasoning is in the stylesheet's header.
 */
export const SCORE_BANDS: readonly { min: number; max: number; label: string }[] = [
    { min: 0, max: 49, label: '0-49' },
    { min: 50, max: 69, label: '50-69' },
    { min: 70, max: 79, label: '70-79' },
    { min: 80, max: 89, label: '80-89' },
    { min: 90, max: 100, label: '90-100' },
];

export interface Bucket { label: string; count: number; }

/** How the scored best attempts fall across `SCORE_BANDS`. Empty bands included. */
export function scoreDistribution(events: readonly LeaderboardEvent[]): Bucket[] {
    const buckets = SCORE_BANDS.map(band => ({ label: band.label, count: 0 }));
    for (const event of events) {
        if (event.kind !== 'exam' && event.kind !== 'quiz') continue;
        const score = Number(event.score);
        if (typeof event.score !== 'number' || !Number.isFinite(score)) continue;
        const clamped = Math.max(0, Math.min(100, score));
        const index = SCORE_BANDS.findIndex(band => clamped >= band.min && clamped <= band.max);
        if (index >= 0) buckets[index].count += 1;
    }
    return buckets;
}

export interface SeriesPoint {
    /** Start of the bucket, epoch ms. */
    start: number;
    label: string;
    count: number;
}

/**
 * Achievements per bucket across the window, **including the empty ones**.
 *
 * The empty buckets are the whole point. A series built by grouping only the
 * events that exist skips every quiet day, so a line drawn through it implies
 * activity that did not happen and compresses the axis into whichever days were
 * busy — two weeks of silence render as one step. It is also the only way two
 * windows are comparable: seven points always means seven days.
 *
 * Buckets are half-open, `[start, next)`, so nothing lands in two of them.
 */
export function activitySeries(
    events: readonly LeaderboardEvent[],
    opts: { now: number; window: BoardWindow },
): SeriesPoint[] {
    const dated = events.filter(isDated);
    const { window: win, now } = opts;

    let from: number;
    let step: number;
    if (win === 'all') {
        const earliest = dated.length ? Math.min(...dated.map(event => event.at)) : now - 30 * DAY_MS;
        const span = Math.max(now - earliest, 30 * DAY_MS);
        // Roughly two dozen buckets whatever the span, so the axis stays readable
        // on a platform three weeks old and on one three years old.
        step = Math.max(DAY_MS, Math.ceil(span / 24 / DAY_MS) * DAY_MS);
        from = now - Math.ceil(span / step) * step;
    } else {
        const days = WINDOW_DAYS[win] as number;
        step = days > 45 ? 7 * DAY_MS : DAY_MS;
        from = now - days * DAY_MS;
    }

    const points: SeriesPoint[] = [];
    /*
      `start < now`, so a 7-day window is seven buckets and not eight.

      The obvious `<= now` opens one more bucket starting exactly at `now`, which
      covers the future and is therefore always empty — a permanently blank
      column at the right-hand edge that reads as today having no activity. The
      bucket the present moment belongs to is the last one this loop makes, and
      the clamp below is what puts `now` itself in it.
    */
    for (let start = from; start < now; start += step) {
        points.push({ start, label: bucketLabel(start, step), count: 0 });
    }
    if (!points.length) return points;

    const origin = points[0].start;
    for (const event of dated) {
        if (event.at < origin || event.at > now) continue;
        const index = Math.min(points.length - 1, Math.floor((event.at - origin) / step));
        points[index].count += 1;
    }
    return points;
}

/**
 * How long one bucket of a series is, in days.
 *
 * Derived from the series rather than re-deriving the window arithmetic, so the
 * caption cannot disagree with the axis. It said "per week" for the all-time
 * window while the buckets were nine days apart, which is the kind of small
 * wrongness a reader notices and then stops trusting the rest of the page over.
 */
export function stepDays(points: readonly SeriesPoint[]): number {
    if (points.length < 2) return 1;
    return Math.max(1, Math.round((points[1].start - points[0].start) / DAY_MS));
}

/** "day", "week", "9 days", "month" — whichever the buckets actually are. */
export function describeStep(points: readonly SeriesPoint[]): string {
    const days = stepDays(points);
    if (days === 1) return 'day';
    if (days === 7) return 'week';
    if (days >= 28 && days <= 31) return 'month';
    return `${days} days`;
}

function bucketLabel(start: number, step: number): string {
    const date = new Date(start);
    if (step <= 14 * DAY_MS) {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

export interface SubjectRow {
    subjectId: string;
    name: string;
    kind: Achievement;
    /** Distinct learners, not attempts — see below. */
    learners: number;
    passed: number;
    averageScore: number;
}

/**
 * The most-taken assessments and most-completed courses.
 *
 * Counted in **distinct learners**, not events. The events are already one per
 * learner per subject, so the two agree today — stating it in learners is what
 * keeps it true if the dedupe is ever relaxed, and it is the number a reader
 * assumes they are being shown anyway.
 *
 * **A subject nothing can name is left out, not labelled.** This used to fall
 * back to the string "Untitled", and on live data the result was a chart whose
 * rows read `Untitled 9`, `Untitled 7`, `Untitled 6` — six bars, five of them
 * indistinguishable. That is worse than a shorter chart in every way: it carries
 * no information, it looks like a rendering fault, and it invites the reader to
 * distrust the figures beside it.
 *
 * The reasoning it replaces was wrong rather than unlucky. "An assessment nothing
 * else names is counted without being named — the board needs to know a learner
 * passed *an* exam far more than which one" is a fair argument about the
 * *ranking*, where a subject name is never printed, and it does not survive being
 * carried over to a chart whose category axis IS the name. A count with no label
 * is not a data point.
 *
 * A name learned from ANY event for that subject names the whole row, so this is
 * as generous as it can be: only a subject that no record anywhere identifies is
 * dropped.
 */
export function topSubjects(
    events: readonly LeaderboardEvent[],
    kinds: readonly Achievement[],
    limit = 6,
): SubjectRow[] {
    interface Working extends SubjectRow { people: Set<string>; scores: number[] }
    const rows = new Map<string, Working>();
    for (const event of events) {
        if (!kinds.includes(event.kind) || !event.subjectId) continue;
        const key = [event.kind, event.subjectId].join(SEP);
        let row = rows.get(key);
        if (!row) {
            row = {
                subjectId: event.subjectId, kind: event.kind,
                // Deliberately empty rather than a placeholder: there is no
                // string here that would be safe to render.
                name: '',
                learners: 0, passed: 0, averageScore: 0,
                people: new Set<string>(), scores: [],
            };
            rows.set(key, row);
        }
        const named = String(event.subjectName ?? '').trim();
        if (named) row.name = named;
        row.people.add(event.userId);
        if (event.passed) row.passed += 1;
        const score = Number(event.score);
        if (typeof event.score === 'number' && Number.isFinite(score)) row.scores.push(score);
    }
    return [...rows.values()]
        .filter(row => row.name !== '')
        .map(row => ({
            subjectId: row.subjectId, kind: row.kind, name: row.name,
            learners: row.people.size, passed: row.passed,
            averageScore: row.scores.length
                ? Math.round((row.scores.reduce((a, b) => a + b, 0) / row.scores.length) * 10) / 10
                : 0,
        }))
        // The same shape of tie-break as `compareRows`, and for the same reason:
        // the list is re-derived on every filter change and must not reshuffle.
        .sort((a, b) => b.learners - a.learners
            || b.passed - a.passed
            || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * Presentation helpers the view and the check share
 * ------------------------------------------------------------------ */

/** 1284 becomes "1,284"; 12934 becomes "12.9K". Stat-tile compaction. */
export function compact(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const n = Math.round(value);
    if (Math.abs(n) < 10000) return n.toLocaleString();
    if (Math.abs(n) < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/**
 * The signed change between two totals, or null when there is nothing to compare
 * against.
 *
 * Null rather than zero, for the reason on `previousRange`: "no previous period"
 * and "no change" are different statements and only one of them is a fact.
 */
export function delta(current: number, previous: number | null | undefined): number | null {
    if (previous === null || previous === undefined || !Number.isFinite(previous)) return null;
    return current - previous;
}

/** Initials for the avatar fallback. Never more than two letters. */
export function initialsOf(name: string): string {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'L';
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * A learner's own filter match.
 *
 * Name only, and deliberately not the id: the board never prints a `user_id`
 * (see the view's header comment), and a search that matched something invisible
 * would be a way to confirm an id exists from a page open to the whole internet.
 */
export function matchesQuery(row: LeaderRow, query: string): boolean {
    const wanted = String(query || '').trim().toLowerCase();
    if (!wanted) return true;
    return row.name.toLowerCase().includes(wanted);
}

/* ------------------------------------------------------------------ *
 * The table view
 * ------------------------------------------------------------------ */

/**
 * Every chart's WCAG-clean twin.
 *
 * Not a nicety: a chart is colour and geometry, and a reader who cannot use
 * either — a screen reader, a printout, `forced-colors` — has no other way to
 * reach the numbers. Generating it from the same arrays the chart is drawn from
 * is what keeps the two from disagreeing, which is the failure mode of a
 * hand-written table beside a chart.
 */
export function tableFor(rows: readonly { label: string; value: number }[]): {
    label: string; value: number; share: number;
}[] {
    const total = rows.reduce((n, row) => n + row.value, 0);
    return rows.map(row => ({
        label: row.label, value: row.value,
        share: total > 0 ? row.value / total : 0,
    }));
}
