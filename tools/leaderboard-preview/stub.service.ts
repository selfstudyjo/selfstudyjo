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
 * **ONLY THE NETWORK IS STUBBED, AND THAT IS NOT A DETAIL.**
 *
 * The first version of this file handed the view finished `LeaderboardEvent`s
 * with titles already on them. Production sends no such thing — app 20's
 * `user_exam_result` carries an `exam` id and no `exam_title` — so the preview
 * was exercising its own sample data, and a chart reading `Untitled 9`,
 * `Untitled 7`, `Untitled 6` shipped past a green check *and* a screenshot
 * because the stub was kinder than the platform.
 *
 * So it now fakes the four HTTP payloads **in the shape each service really
 * answers** and calls the real `flattenSources` to turn them into events. Every
 * line of name resolution, date parsing and pass/fail interpretation the live
 * page runs, this preview runs too. The rule generalises, and app 23's identity
 * e2e learned it the same way: a fake that models the happy path faithfully is
 * the most convincing kind of wrong.
 *
 * The data is deliberately awkward: a 41-character name, a one-word name, an
 * Arabic name, exact point ties, a retake that must not double-count, a learner
 * with nothing but a failure, an exam nobody has ever passed (so nothing names
 * it), an undated record, and a title long enough to set a bar chart's width if
 * the label were allowed to.
 */
/*
  A RELATIVE path on purpose. This folder aliases `@/services/leaderboard.service`
  to this file, so importing the real flattening through the alias would resolve
  straight back here — a module importing itself. The relative path steps around
  the alias and reaches the genuine article.
*/
import { flattenSources } from '../../src/services/leaderboard.service';
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

const EXAMS: [string, string][] = [
    ['e-net', 'Computer Networks and Internet Protocols — Final Assessment'],
    ['e-db', 'Database Systems'],
    ['e-sec', 'Information Security Fundamentals'],
    ['e-os', 'Operating Systems'],
    ['e-web', 'Web Technologies'],
];

const QUIZZES = ['q-1', 'q-2', 'q-3', 'q-4', 'q-5', 'q-6'];

const COURSES: [string, string][] = [
    ['c-net', 'CS471 Computer Networks'],
    ['c-db', 'CS331 Databases'],
    ['c-sec', 'CS455 Security'],
];

export interface SourceReport {
    answered: Record<string, boolean>;
    allFailed: boolean;
    events: LeaderboardEvent[];
}

const iso = (ms: number) => new Date(ms).toISOString();

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
        return {
            answered: {
                'Exam results': false, 'Quiz results': false,
                'Exam certificates': false, 'Course certificates': false,
            },
            allFailed: true, events: [],
        };
    }
    if (flags.has('empty')) {
        return {
            answered: {
                'Exam results': true, 'Quiz results': true,
                'Exam certificates': true, 'Course certificates': true,
            },
            allFailed: false, events: [],
        };
    }

    seed = 20260824;
    const now = Date.now();

    /*
      Exactly the fields each serializer emits, and no more.

      `user_exam_result` is external_id, user_id, username, exam, score,
      date_taken, the two result_* fields and the certificate pair. **No title.**
      An exam's name reaches the page only through its certificate, which is what
      `flattenSources` resolves — so a stub that added one here would be hiding
      the whole problem this file exists to expose.
    */
    const examResults: any[] = [];
    const quizResults: any[] = [];
    const examCerts: any[] = [];
    const courseCerts: any[] = [];

    NAMES.forEach((name, index) => {
        const user_id = `u-${index}`;

        for (let n = 0; n < 1 + Math.floor(random() * 5); n++) {
            const [exam, examName] = EXAMS[Math.floor(random() * EXAMS.length)];
            const score = Math.round(35 + random() * 65);
            const at = now - Math.floor(random() * 200) * DAY - DAY;
            examResults.push({
                external_id: `r-${user_id}-${n}`, user_id, username: name,
                exam, score, date_taken: iso(at),
                result_status: score >= 70 ? 'PASSED' : 'FAILED',
            });
            // A retake of the same exam, which the engine must collapse to one.
            if (random() > 0.7) {
                examResults.push({
                    external_id: `r-${user_id}-${n}-again`, user_id, username: name,
                    exam, score: Math.round(35 + random() * 65),
                    date_taken: iso(at + 3 * DAY), result_status: 'FAILED',
                });
            }
            // App 20 issues one automatically on a pass, and it is the only thing
            // that names the exam.
            if (score >= 70) {
                examCerts.push({
                    certificate_id: `ec-${user_id}-${n}`, user_id,
                    user_full_name: name, user_image_url: '',
                    exam_id: exam, exam_name: examName,
                    taken_date: iso(at + DAY), created_at: iso(at + DAY),
                });
            }
        }

        for (let n = 0; n < Math.floor(random() * 6); n++) {
            const quiz = QUIZZES[Math.floor(random() * QUIZZES.length)];
            const score = Math.round(40 + random() * 60);
            // Nothing anywhere names a quiz without also shipping its answer key,
            // so quizzes are correctly absent from the Most studied chart.
            quizResults.push({
                external_id: `qr-${user_id}-${n}`, user_id, username: name,
                quiz, score,
                date_taken: iso(now - Math.floor(random() * 120) * DAY - DAY),
                result_status: score >= 70 ? 'PASSED' : 'FAILED',
            });
        }

        if (random() > 0.6) {
            const [course, courseName] = COURSES[Math.floor(random() * COURSES.length)];
            courseCerts.push({
                certificate_id: `cc-${user_id}`, user_id,
                user_full_name: name, user_image_url: '',
                course_id: course, course_name: courseName,
                hours: 12 + Math.floor(random() * 30),
                date: iso(now - Math.floor(random() * 150) * DAY - DAY),
            });
        }
    });

    // A learner with nothing but a failure, who must not appear on the board.
    examResults.push({
        external_id: 'r-nil', user_id: 'u-nil', username: 'Nobody Ranked',
        exam: 'e-net', score: 31, date_taken: iso(now - 5 * DAY),
        result_status: 'FAILED',
    });

    /*
      An exam nobody has ever passed, so no certificate exists to name it. It has
      to be counted in the totals and left off the Most studied chart — the case
      that separates "drop the unnamed" from "label the unnamed".
    */
    examResults.push({
        external_id: 'r-nameless', user_id: 'u-1', username: NAMES[1],
        exam: 'e-nameless', score: 44, date_taken: iso(now - 9 * DAY),
        result_status: 'FAILED',
    });

    // An undated record, which may only ever appear under All time.
    quizResults.push({
        external_id: 'qr-undated', user_id: 'u-0', username: 'Aya Nasser',
        quiz: 'q-undated', score: 88, date_taken: '', result_status: 'PASSED',
    });

    /*
      App 19's side of the course-title path. `flattenSources` prefers a
      certificate's own `course_name` and falls back to this, so both halves are
      exercised.
    */
    const courseTitles = new Map<string, string>(COURSES);

    /*
      APP 11'S LAB PROGRESS, in the shape the service really answers.

      Rows, not events - `flattenSources` does the mapping, exactly as with the
      four collections above, so the preview cannot pass while the real
      flattening is broken. That is not hypothetical here: the first version of
      the lab read handed `{count, progress: [...]}` to
      `normalizePaginatedResponse`, which saw `count`, read it as DRF's envelope,
      found no `results` and returned an empty list. A stub that supplied ready
      events would have looked perfect.

      Four deliberately awkward cases:
        * a finished lab, which earns its task points AND the completion bonus;
        * a half-finished one, which earns its task points and no bonus - the
          case that scores zero if a lab is ever moved behind the `passed` gate;
        * a `not_started` row with nothing earned, which app 11 writes the moment
          somebody clicks into a lab and which must NOT put anybody on the board;
        * a learner with NO certificate and no exam, so the only name available is
          their username - the `fallbackName` path, which otherwise renders as the
          literal "Learner".
    */
    const labProgress: any[] = [
        {
            user_id: 'u-0', username: 'aya', full_name: '',
            lab_id: 'docker-01', track: 'docker', status: 'completed',
            tasks_done: ['t1', 't2', 't3', 't4'], score: 100,
            earned: 9, possible: 9,
            completed_at: new Date(now - 2 * DAY).toISOString(),
            last_active: new Date(now - 2 * DAY).toISOString(),
        },
        {
            user_id: 'u-0', username: 'aya', full_name: '',
            lab_id: 'bigdata-01', track: 'bigdata', status: 'in_progress',
            tasks_done: ['t2'], score: 17, earned: 2, possible: 12,
            completed_at: '',
            last_active: new Date(now - 1 * DAY).toISOString(),
        },
        {
            user_id: 'u-3', username: 'omar', full_name: '',
            lab_id: 'linux-01', track: 'linux', status: 'not_started',
            tasks_done: [], score: 0, earned: 0, possible: 4,
            completed_at: '',
            last_active: new Date(now - 3 * DAY).toISOString(),
        },
        {
            user_id: 'u-labs-only', username: 'kareem', full_name: '',
            lab_id: 'k8s-01', track: 'kubernetes', status: 'completed',
            tasks_done: ['t1', 't2', 't3', 't4', 't5'], score: 100,
            earned: 10, possible: 10,
            completed_at: new Date(now - 4 * DAY).toISOString(),
            last_active: new Date(now - 4 * DAY).toISOString(),
        },
    ];

    // App 11's `/api/labs/` side of the title path. `linux-01` is deliberately
    // absent so the "a lab nothing can name is dropped" branch is exercised too.
    const labTitles = new Map<string, string>([
        ['docker-01', 'Images and your first container'],
        ['bigdata-01', 'HDFS: the file system'],
        ['k8s-01', 'The cluster, nodes and namespaces'],
    ]);

    return {
        answered: {
            'Exam results': true, 'Quiz results': true,
            'Exam certificates': true, 'Course certificates': true,
            'Lab progress': true,
        },
        allFailed: false,
        events: flattenSources({
            examResults, quizResults, examCerts, courseCerts, courseTitles,
            labProgress, labTitles,
        }),
    };
}
