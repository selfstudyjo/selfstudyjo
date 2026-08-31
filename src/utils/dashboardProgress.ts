/**
 * What the dashboard says about a learner's progress.
 *
 * A PLAIN module — no Vue, no DOM, no service imports — on the precedent of
 * `photoMask.ts`, `drawEngine.ts`, `newscastEngine.ts`, `appNav.ts`,
 * `examShuffle.ts` and `leaderboardEngine.ts`. The view fetches and renders;
 * every number on the screen is decided here, where it can be read in one
 * place and driven in node.
 *
 * ---------------------------------------------------------------------------
 * THE HONESTY PROBLEM, WHICH IS THE WHOLE DESIGN
 * ---------------------------------------------------------------------------
 * An e-learning dashboard is expected to show "68% of this course complete".
 * **This platform cannot compute that**, and inventing it would be worse than
 * omitting it. There is no lesson-completion record anywhere: app 19 stores a
 * course, its lessons, its homeworks and a registration, and nothing that says
 * a person has READ a lesson. A percentage derived from "lessons that happen to
 * have a quiz you passed" would be a number that moves for reasons the learner
 * cannot see and stalls at 40% on a course whose remaining lessons have no quiz
 * — and they would reasonably read that as the platform losing their work.
 *
 * So every figure here is something the records actually support, and it is
 * LABELLED as what it is:
 *
 *   * average score        — the mean of their best attempt per quiz;
 *   * pass rate            — how many of those they passed;
 *   * per course           — quizzes passed out of quizzes taken IN that course,
 *                            never "course completion";
 *   * counts               — courses enrolled, certificates earned, homework
 *                            assigned.
 *
 * If a lesson-progress record is ever added to app 19, `courseProgress()` is
 * the one function that changes.
 *
 * ---------------------------------------------------------------------------
 * ONE ATTEMPT PER QUIZ
 * ---------------------------------------------------------------------------
 * Same rule, and the same reason, as `bestAttempts()` in `leaderboardEngine.ts`
 * — stated again here rather than imported because that module works on a
 * platform-wide event shape carrying a `userId` and a subject, and this one is
 * a single learner's own quiz rows. Counting every attempt means somebody who
 * re-sat one quiz eleven times has "11 quizzes passed" and an average dragged
 * down by their own early tries. Best attempt, earliest on a tie, so a re-sit
 * of something already aced does not move the date anything is ordered by.
 */

/* -------------------------------------------------------------------------- *
 * Input
 *
 * Deliberately minimal shapes rather than the service interfaces: this module
 * must stay loadable in node, and a `import type { UserQuizResult }` drags in
 * the whole service module graph. The view maps its records onto these, which
 * is also the seam that makes the mapping visible.
 * -------------------------------------------------------------------------- */

export interface QuizAttempt {
    /** The quiz's id. Attempts sharing one are the same quiz re-sat. */
    quizId: string;
    /** 0–100. */
    score: number;
    /**
     * The backend's own verdict where it has one.
     *
     * A quiz record carries `result_status`; unlike an exam it carries NO pass
     * mark, so there is nothing to re-derive it from. Where it is missing —
     * an older record, or a replica a release behind — `QUIZ_PASS_FALLBACK`
     * stands in, and it is a named constant precisely so nobody reads a bare
     * `>= 70` here as authoritative.
     */
    passed?: boolean;
    /** ISO date, or undefined on a record written before the field existed. */
    takenAt?: string;
    /** Which course the quiz belongs to, when the view managed to resolve it. */
    courseId?: string;
}

export interface ProgressInput {
    /** Registered courses, by external id. */
    courseIds: readonly string[];
    quizzes: readonly QuizAttempt[];
    examCertificates: number;
    courseCertificates: number;
    /** Homework assigned across the learner's courses. */
    homeworks: number;
}

/**
 * The mark a quiz is treated as passed at when the record does not say.
 *
 * 70 matches `DEFAULT_PASS_SCORE` on app 20, which is where the exam pass mark
 * comes from. It is a fallback and not a policy: a quiz result that carries
 * `result_status` always wins, because the backend marked it and this does not.
 */
export const QUIZ_PASS_FALLBACK = 70;

/** A score at or above this is a distinction. Matches the leaderboard's. */
export const DISTINCTION_SCORE = 90;

export function isPassed(attempt: QuizAttempt): boolean {
    return attempt.passed ?? attempt.score >= QUIZ_PASS_FALLBACK;
}

/* -------------------------------------------------------------------------- *
 * One row per quiz
 * -------------------------------------------------------------------------- */

/**
 * The learner's best attempt at each quiz.
 *
 * Highest score wins; on a tie the EARLIEST attempt wins, so re-sitting
 * something already at 100 does not move it to today. An attempt with no date
 * loses a tie against one that has a date rather than sorting as the epoch,
 * which would make every undated record look like the earliest thing they ever
 * did.
 */
export function bestPerQuiz(attempts: readonly QuizAttempt[]): QuizAttempt[] {
    const best = new Map<string, QuizAttempt>();
    for (const a of attempts) {
        if (!a || !a.quizId) continue;
        const held = best.get(a.quizId);
        if (!held) {
            best.set(a.quizId, a);
            continue;
        }
        if (a.score > held.score) {
            best.set(a.quizId, a);
            continue;
        }
        if (a.score === held.score && earlier(a, held)) best.set(a.quizId, a);
    }
    return [...best.values()];
}

function earlier(a: QuizAttempt, b: QuizAttempt): boolean {
    const ta = time(a.takenAt);
    const tb = time(b.takenAt);
    if (ta === null) return false;
    if (tb === null) return true;
    return ta < tb;
}

function time(iso?: string): number | null {
    if (!iso) return null;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? null : t;
}

/* -------------------------------------------------------------------------- *
 * The headline figures
 * -------------------------------------------------------------------------- */

export interface Summary {
    courses: number;
    quizzesTaken: number;
    quizzesPassed: number;
    /** 0–100, or null when nothing has been taken. */
    passRate: number | null;
    /** 0–100, or null when nothing has been taken. */
    averageScore: number | null;
    /** 0–100, or null when nothing has been taken. */
    bestScore: number | null;
    certificates: number;
    examCertificates: number;
    courseCertificates: number;
    homeworks: number;
    /** Quizzes at or above `DISTINCTION_SCORE`. */
    distinctions: number;
}

/**
 * `null`, never `0`, for the three rates.
 *
 * A learner who has taken no quiz has no average, and reporting 0% is not a
 * softer version of that — it is a specific claim that they scored nothing,
 * rendered as an empty red ring on their own dashboard on their first day. The
 * view has an "on your first quiz" state for null and must not be given a
 * number it would draw as failure. Same call as `delta()` in
 * `leaderboardEngine.ts` returning null rather than 0 for "nothing to compare
 * against".
 */
export function summarise(input: ProgressInput): Summary {
    const best = bestPerQuiz(input.quizzes ?? []);
    const taken = best.length;
    const passed = best.filter(isPassed).length;
    const scores = best.map(a => clampScore(a.score));

    return {
        courses: (input.courseIds ?? []).length,
        quizzesTaken: taken,
        quizzesPassed: passed,
        passRate: taken ? round((passed / taken) * 100) : null,
        averageScore: taken ? round(scores.reduce((n, s) => n + s, 0) / taken) : null,
        bestScore: taken ? Math.max(...scores) : null,
        certificates: (input.examCertificates ?? 0) + (input.courseCertificates ?? 0),
        examCertificates: input.examCertificates ?? 0,
        courseCertificates: input.courseCertificates ?? 0,
        homeworks: input.homeworks ?? 0,
        distinctions: scores.filter(s => s >= DISTINCTION_SCORE).length,
    };
}

/**
 * A score can arrive outside 0–100 — nothing on app 20 constrains it, and a
 * negative or 130 would put the meter fill outside its own track and, in the
 * average, produce a figure no band matches.
 */
export function clampScore(score: number): number {
    if (!Number.isFinite(score)) return 0;
    return Math.min(100, Math.max(0, score));
}

function round(n: number): number {
    return Math.round(n * 10) / 10;
}

/* -------------------------------------------------------------------------- *
 * Per course
 * -------------------------------------------------------------------------- */

export interface CourseProgress {
    courseId: string;
    quizzesTaken: number;
    quizzesPassed: number;
    /** 0–100 of the quizzes taken in this course, or null if none were. */
    passRate: number | null;
    averageScore: number | null;
}

/**
 * One row per REGISTERED course, including the ones with no quiz activity.
 *
 * Dropping the quiet courses is the tempting simplification and it is wrong in
 * both directions: a learner's newest enrolment is the one with no attempts
 * yet, so it would vanish from the tracker exactly when they most want to see
 * it, and the list would then not match the course count in the tile above it.
 * A course with nothing in it is a real state and the view renders it as one.
 *
 * Ordered by the registration list rather than by score. A tracker that
 * reorders itself as somebody's marks change makes the row they were looking at
 * move under the pointer, and it quietly ranks a person's own courses worst
 * first.
 */
export function courseProgress(input: ProgressInput): CourseProgress[] {
    const best = bestPerQuiz(input.quizzes ?? []);
    return (input.courseIds ?? []).map(courseId => {
        const mine = best.filter(a => a.courseId === courseId);
        const scores = mine.map(a => clampScore(a.score));
        const passed = mine.filter(isPassed).length;
        return {
            courseId,
            quizzesTaken: mine.length,
            quizzesPassed: passed,
            passRate: mine.length ? round((passed / mine.length) * 100) : null,
            averageScore: mine.length
                ? round(scores.reduce((n, s) => n + s, 0) / mine.length)
                : null,
        };
    });
}

/* -------------------------------------------------------------------------- *
 * Achievements
 * -------------------------------------------------------------------------- */

export type BadgeTier = 'bronze' | 'silver' | 'gold';

export interface BadgeSpec {
    id: string;
    tier: BadgeTier;
    /** The icon name the view maps to a glyph. */
    icon: 'compass' | 'flame' | 'target' | 'award' | 'crown' | 'star';
    /** What has to be true. Takes the summary so every badge is derived. */
    earned: (s: Summary) => boolean;
    /** How far along, 0–1, for the ones that are a count toward a threshold. */
    progress?: (s: Summary) => number;
}

/**
 * The badges, in the order they are shown.
 *
 * Three rules, and the third is the one that makes this a system rather than
 * decoration:
 *
 *  1. **Every threshold is reachable from the data on this dashboard.** No
 *     badge depends on a streak, a login count or a time spent — none of which
 *     this platform records, and all of which are what a badge system usually
 *     invents.
 *  2. **A locked badge is SHOWN, with what it needs.** A row that only shows
 *     what somebody has already done tells a new learner nothing and reads as
 *     an empty feature. Locked badges are what make the row motivating on day
 *     one, which is the entire point of having it.
 *  3. **Nothing is awarded for merely being present.** The first badge needs an
 *     enrolment, not a visit. A badge given for arriving devalues the rest of
 *     the row, and learners notice.
 *
 * The English text lives here too, as `BADGE_NAMES` and `BADGE_NOTES` below —
 * keys, not translations. The view calls `t()` on them, so this module stays
 * loadable in node, and `npm run check:i18n` imports the same two tables to
 * prove both catalogues cover them. That last part is the reason they are not
 * inside the component: a key reached through a VARIABLE
 * (`t(BADGE_NAMES[id])`) appears in no source file as a literal, so the check's
 * scan reads every one of them as an orphaned catalogue entry — which is
 * exactly the shape the sidebar's labels and the AI Chat's date headings have,
 * and they are handled the same way.
 */
export const BADGES: readonly BadgeSpec[] = [
    {
        id: 'first-steps',
        tier: 'bronze',
        icon: 'compass',
        earned: s => s.courses >= 1,
    },
    {
        id: 'scholar',
        tier: 'silver',
        icon: 'flame',
        earned: s => s.courses >= 3,
        progress: s => s.courses / 3,
    },
    {
        id: 'quiz-taker',
        tier: 'bronze',
        icon: 'target',
        earned: s => s.quizzesPassed >= 1,
    },
    {
        id: 'sharp-shooter',
        tier: 'silver',
        icon: 'target',
        earned: s => s.quizzesPassed >= 5,
        progress: s => s.quizzesPassed / 5,
    },
    {
        id: 'certified',
        tier: 'gold',
        icon: 'award',
        earned: s => s.certificates >= 1,
    },
    {
        id: 'honour-roll',
        tier: 'gold',
        icon: 'crown',
        // Deliberately gated on having taken enough to mean something: an
        // average of 100 over a single quiz is not an honour roll, and awarding
        // it there makes the badge worthless to everybody who has taken twenty.
        earned: s => s.quizzesTaken >= 3 && (s.averageScore ?? 0) >= DISTINCTION_SCORE,
        progress: s => Math.min(s.quizzesTaken / 3, (s.averageScore ?? 0) / DISTINCTION_SCORE),
    },
    {
        id: 'perfect-score',
        tier: 'gold',
        icon: 'star',
        earned: s => (s.bestScore ?? 0) >= 100,
    },
];

/* -------------------------------------------------------------------------- *
 * Badge copy
 *
 * ENGLISH TEXT, NOT TRANSLATIONS. The key on this platform IS the English
 * string, so these are catalogue keys; the view spends them through `t()`.
 *
 * Every note is the REQUIREMENT rather than a congratulation, and the view
 * shows it on an earned badge as well as a locked one — on an earned badge it
 * reads as the reason it was earned, which is what makes a row of seven names
 * interpretable at a glance instead of being seven words nobody can act on.
 *
 * `check:i18n` imports both tables. Adding a badge without its copy therefore
 * fails the build rather than rendering a raw id.
 * -------------------------------------------------------------------------- */

export const BADGE_NAMES: Record<string, string> = {
    'first-steps': 'First Steps',
    'scholar': 'Scholar',
    'quiz-taker': 'Quiz Taker',
    'sharp-shooter': 'Sharp Shooter',
    'certified': 'Certified',
    'honour-roll': 'Honour Roll',
    'perfect-score': 'Perfect Score',
};

export const BADGE_NOTES: Record<string, string> = {
    'first-steps': 'Enrol in a course',
    'scholar': 'Enrol in 3 courses',
    'quiz-taker': 'Pass a quiz',
    'sharp-shooter': 'Pass 5 quizzes',
    'certified': 'Earn a certificate',
    'honour-roll': 'Average 90% over 3 quizzes',
    'perfect-score': 'Score 100% on a quiz',
};

/** Every badge string, for the i18n check and for nothing else. */
export const BADGE_STRINGS: readonly string[] = [
    ...Object.values(BADGE_NAMES),
    ...Object.values(BADGE_NOTES),
];

export interface Badge {
    id: string;
    tier: BadgeTier;
    icon: BadgeSpec['icon'];
    earned: boolean;
    /** 0–1. Always 1 once earned, and 0 where the badge has no partial state. */
    progress: number;
}

export function badges(summary: Summary): Badge[] {
    return BADGES.map(spec => {
        const earned = spec.earned(summary);
        return {
            id: spec.id,
            tier: spec.tier,
            icon: spec.icon,
            earned,
            progress: earned ? 1 : clamp01(spec.progress?.(summary) ?? 0),
        };
    });
}

export function earnedCount(summary: Summary): number {
    return badges(summary).filter(b => b.earned).length;
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
}

/* -------------------------------------------------------------------------- *
 * Presentation helpers
 *
 * Here rather than in the component because both of them are decisions, not
 * formatting: which of four bands a score falls in decides its colour, and a
 * null has to render as something other than "0".
 * -------------------------------------------------------------------------- */

export type ScoreBand = 'excellent' | 'good' | 'average' | 'poor';

/**
 * The bands the platform already uses — `getScoreClass` in Home.vue and the
 * same four thresholds in the results screens. Moved here so there is one copy.
 */
export function scoreBand(score: number): ScoreBand {
    const s = clampScore(score);
    if (s >= DISTINCTION_SCORE) return 'excellent';
    if (s >= 70) return 'good';
    if (s >= 50) return 'average';
    return 'poor';
}

/** For `--meter-fill`. A null is an empty track, never a full one. */
export function meterWidth(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '0%';
    return `${Math.min(100, Math.max(0, value))}%`;
}
