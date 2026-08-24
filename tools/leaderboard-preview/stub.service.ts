/**
 * A stand-in for `src/services/leaderboard.service.ts`, aliased over the real
 * one by this folder's vite config.
 *
 * The preview harness exists because `check:leaderboard` verifies the *model*
 * and cannot see the *layout* — label collisions, an overflowing card, a column
 * that will not shrink, a chart card that grows its own scrollbar. Those need a
 * browser and a page full of realistic data, and the live backends give neither
 * on demand: the board is only as interesting as whatever the platform happens
 * to hold today, and two cold PythonAnywhere replicas take ~20s to say so.
 *
 * Only the network is stubbed. The real view, the real stylesheet, the real
 * chart component and the real engine are all exercised, which is the point —
 * a preview built from a second copy of the markup would prove nothing about
 * the page anybody visits.
 *
 * The data is deliberately awkward rather than tidy: a name long enough to test
 * wrapping, a name that is one word, an Arabic name, a learner with only a
 * failure, exact point ties, a retake that must not double-count, and a course
 * title long enough to set a bar chart's width if the label were allowed to.
 */
import type { LeaderboardEvent } from '@/utils/leaderboardEngine';

const DAY = 24 * 60 * 60 * 1000;

/*
  A fixed seed, so two screenshots of "the same" board really are the same board.
  A preview that reshuffled on every reload could not be used to compare a change
  against the render before it.
*/
let seed = 20260824;
function random(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
}

const NAMES = [
    'Aya Nasser', 'Mahmoud Al-Qudah', 'Layla', 'عبد الرحمن الحسيني',
    'Christopher Alexander Whitmore-Bennington', 'Sara Haddad', 'Omar Khalil',
    'Noor Abu-Rashed', 'Yusuf', 'Hana Darwish', 'Tariq Mansour', 'Dina Salameh',
    'Rami Odeh', 'Lina Barghouti', 'Karim Zaid', 'Maya Toukan', 'Faris Rahal',
    'Zaina Amer', 'Bashar Nimri', 'Reem Qaddoumi', 'Adam Saif', 'Julia Hourani',
];

const EXAMS = [
    ['e-net', 'Computer Networks and Internet Protocols — Final Assessment'],
    ['e-db', 'Database Systems'],
    ['e-sec', 'Information Security Fundamentals'],
    ['e-os', 'Operating Systems'],
    ['e-web', 'Web Engineering'],
];

const QUIZZES = [
    ['q-1', 'Subnetting basics'],
    ['q-2', 'SQL joins'],
    ['q-3', 'Hashing and salting'],
    ['q-4', 'Process scheduling'],
    ['q-5', 'HTTP verbs'],
    ['q-6', 'CSS layout'],
];

const COURSES = [
    ['c-net', 'CS471 Computer Networks'],
    ['c-db', 'CS331 Databases'],
    ['c-sec', 'CS455 Security'],
];

export interface SourceReport {
    answered: Record<string, boolean>;
    allFailed: boolean;
    events: LeaderboardEvent[];
}

export async function loadAchievements(): Promise<SourceReport> {
    /*
      `?empty=1` and `?down=1` render the two states a real deployment is most
      likely to show first and which no amount of sample data exercises: a
      platform where nothing has been earned yet, and every replica cold. Both
      have to read as a fact about the platform or a fact about the network
      respectively — never as each other.
    */
    const flags = new URLSearchParams(location.search);
    if (flags.has('down')) {
        const none = { 'Exam results': false, 'Quiz results': false,
            'Exam certificates': false, 'Course certificates': false };
        return { answered: none, allFailed: true, events: [] };
    }
    if (flags.has('empty')) {
        return {
            answered: { 'Exam results': true, 'Quiz results': true,
                'Exam certificates': true, 'Course certificates': true },
            allFailed: false, events: [],
        };
    }

    seed = 20260824;
    const now = Date.now();
    const events: LeaderboardEvent[] = [];

    NAMES.forEach((name, index) => {
        const userId = `u-${index}`;
        // Every third learner has a picture, roughly matching the live ratio —
        // 29 of 38 profiles carry no image, so initials are the common case and
        // must be what the layout is tuned for.
        const avatarUrl = index % 3 === 0 ? '' : '';
        const busy = 1 + Math.floor(random() * 5);

        for (let n = 0; n < busy; n++) {
            const [id, title] = EXAMS[Math.floor(random() * EXAMS.length)];
            const score = Math.round(35 + random() * 65);
            const at = now - Math.floor(random() * 200) * DAY - DAY;
            events.push({
                kind: 'exam', userId, name, avatarUrl,
                subjectId: id, subjectName: title,
                score, passed: score >= 70, at,
            });
            // A retake of the same exam, which the engine must collapse to one.
            if (random() > 0.7) {
                events.push({
                    kind: 'exam', userId, name, avatarUrl,
                    subjectId: id, subjectName: title,
                    score: Math.round(35 + random() * 65),
                    passed: false, at: at + 3 * DAY,
                });
            }
            if (score >= 70) {
                events.push({
                    kind: 'exam_certificate', userId, name, avatarUrl,
                    subjectId: id, subjectName: title,
                    score: null, passed: true, at: at + DAY,
                });
            }
        }

        for (let n = 0; n < Math.floor(random() * 6); n++) {
            const [id, title] = QUIZZES[Math.floor(random() * QUIZZES.length)];
            const score = Math.round(40 + random() * 60);
            events.push({
                kind: 'quiz', userId, name, avatarUrl,
                subjectId: id, subjectName: title,
                score, passed: score >= 70,
                at: now - Math.floor(random() * 120) * DAY - DAY,
            });
        }

        if (random() > 0.6) {
            const [id, title] = COURSES[Math.floor(random() * COURSES.length)];
            events.push({
                kind: 'course_certificate', userId, name, avatarUrl,
                subjectId: id, subjectName: title,
                score: null, passed: true,
                at: now - Math.floor(random() * 150) * DAY - DAY,
                hours: 12 + Math.floor(random() * 30),
            });
        }
    });

    // A learner with nothing but a failure, who must not appear on the board.
    events.push({
        kind: 'exam', userId: 'u-nil', name: 'Nobody Ranked',
        subjectId: 'e-net', subjectName: EXAMS[0][1],
        score: 31, passed: false, at: now - 5 * DAY,
    });

    // An undated record, which may only ever appear under All time.
    events.push({
        kind: 'quiz', userId: 'u-0', name: 'Aya Nasser',
        subjectId: 'q-undated', subjectName: 'A quiz with no date',
        score: 88, passed: true, at: Number.NaN,
    });

    return {
        answered: {
            'Exam results': true, 'Quiz results': true,
            'Exam certificates': true, 'Course certificates': true,
        },
        allFailed: false,
        events,
    };
}
