import { apiService, withReplicas } from './api';
import { normalizePaginatedResponse } from '@/utils/api-utils';
import type { Achievement, LeaderboardEvent } from '@/utils/leaderboardEngine';

/**
 * The leaderboard's data layer — four collections off two backends, flattened
 * into the one event shape `leaderboardEngine.ts` ranks.
 *
 * WHY IT READS WHAT IT READS, AND NOT WHAT IT DOES NOT
 *
 * **App 20's `/exams/` is deliberately never fetched, and that is a security
 * decision rather than a performance one.** `_exam_out` serialises every exam
 * with its questions nested, and every question with its answers — including
 * `is_correct`. CLAUDE.md already flags that the answer key travels to the
 * browser inside the exam payload for a candidate sitting a paper; pulling the
 * whole collection onto a page that needs **no account at all** would widen that
 * from "a candidate mid-exam" to "anybody on the internet, in one request".
 *
 * So titles come from the certificates, which carry `exam_name` and
 * `course_name` already denormalised and are keyed on the same ids the results
 * use, and from app 19's `/courses/`, which is a light list with no questions in
 * it. An **exam certificate is issued automatically on a pass**, so that names
 * every exam anybody has passed, for free.
 *
 * Two things it still cannot name, and the page must not pretend otherwise: an
 * exam nobody has ever passed, and a **quiz** — no certificate is issued for one
 * and `/quizzes/` nests answers exactly as `/exams/` does. `topSubjects` drops an
 * unnamed subject rather than labelling it, because the first version did label
 * it and the live chart came out as five rows of "Untitled". A count with no
 * label is not a data point; the note on `topSubjects` has the full retraction.
 *
 * **Every read is a plain collection GET with no `user_id`.** Those routes were
 * already list routes and are guarded by the shared service token like
 * everything else; nothing here is a new surface. What *is* new is that the
 * answers are aggregated in the browser, which is why the whole page is one
 * pass over four arrays rather than a request per learner. A request per learner
 * against a cold PythonAnywhere replica is ~20 seconds each, and there is no
 * per-learner endpoint that would help — `/user-exam-results/?user_id=` needs
 * the list first to know who to ask about.
 *
 * **The payload carries weight nobody here wants.** `_exam_result_out` always
 * nests `user_answers`, so every result arrives with its answer rows attached —
 * ids and a `flagged` flag, no correctness, so nothing leaks, but it is bytes
 * the board never reads. There is no `?fields=` on those routes. Trimming it
 * means a light list route on app 20, which is the obvious follow-up and is not
 * something the frontend can do from here.
 */

const EXAM_APP_ID = Number(import.meta.env.VITE_EXAM_APP_ID || '20');
const CERTIFICATE_APP_ID = Number(import.meta.env.VITE_CERTIFICATE_APP_ID || '24');
const COURSE_APP_ID = Number(import.meta.env.VITE_COURSE_APP_ID || '19');

/** Epoch ms, or NaN — which the engine reads as undated rather than as 1970. */
function stamp(value: unknown): number {
    if (!value) return Number.NaN;
    const ms = new Date(String(value)).getTime();
    return Number.isFinite(ms) ? ms : Number.NaN;
}

/** 0-100, or null. A blank, a `"none"` or an out-of-range figure is null. */
function score(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, n));
}

/**
 * Whether a result counts as a pass.
 *
 * `result_status` is authoritative and nothing here re-derives it from a
 * literal, for exactly the reason `UserResults.vue` records: app 20 computed it
 * against *that exam's own* `exam_pass_score`, so a 75 on an exam passed at 85
 * is a FAIL and any local threshold would contradict the record. The band is
 * only reached for a record written before the status field existed.
 */
function passed(status: unknown, value: number | null): boolean {
    const verdict = String(status || '').trim().toUpperCase();
    if (verdict === 'PASSED') return true;
    if (verdict === 'FAILED') return false;
    return typeof value === 'number' && value >= 70;
}

/**
 * One collection off one service, through the pinned replica with failover.
 *
 * **Answers three states, never two.** `answered: false` is the service not
 * replying; `answered: true` with an empty list is the service saying there is
 * nothing there. Collapsing them into "did we get any rows?" is the mistake
 * `utils/identity.py` on app 23 exists to avoid one layer down, and here it has
 * a specific cost: a platform with no quizzes yet would be reported as a partial
 * load for ever, so the warning would be permanent and therefore ignored — and
 * then the day a service really did fail, nothing would have changed on screen.
 */
interface Source<T> { answered: boolean; rows: T[] }

async function collection<T>(
    appId: number, serviceName: string, endpoint: string,
): Promise<Source<T>> {
    try {
        const rows = await withReplicas(appId, serviceName, async baseUrl => {
            const response = await apiService.get<any>(baseUrl, endpoint);
            return normalizePaginatedResponse<T>(response).results;
        });
        return { answered: true, rows };
    } catch {
        /*
          A leaderboard is worth less than a page that renders.

          Four collections off two services, each two cold PythonAnywhere
          replicas: on the first load of the day the odds of all four answering
          are not good, and a board missing its quiz column is far better than an
          error screen where the board should be. The page says which sources are
          missing, which is the honest version of degrading — the reader is told
          the total is partial rather than shown a smaller number as though it
          were the whole truth.
        */
        return { answered: false, rows: [] };
    }
}

export interface SourceReport {
    /** Which collections replied at all. The page reports a partial load from this. */
    answered: Record<string, boolean>;
    /** True when nothing replied — the page shows an error rather than an empty board. */
    allFailed: boolean;
    events: LeaderboardEvent[];
}

/**
 * A course id to its title, for naming a course certificate whose own record
 * omits one.
 *
 * `/courses/` is paginated only when asked, so one request is the whole
 * catalogue — and unlike `/exams/` it is a light list. A failure here is
 * invisible: the certificate's own `course_name` is used first and covers almost
 * every record.
 */
async function courseTitles(): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    const { rows } = await collection<any>(COURSE_APP_ID, 'course', '/courses/');
    for (const course of rows) {
        const id = String(course?.external_course_id ?? course?.id ?? '');
        if (id && course?.title) titles.set(id, String(course.title));
    }
    return titles;
}

/**
 * Exam and quiz results, named from `titles` where they can be.
 *
 * **A result record carries no title of its own.** `user_exam_result` in app 20's
 * serializer is `external_id`, `user_id`, `username`, `exam`, `score`,
 * `date_taken`, the two `result_*` fields and the certificate pair — and nothing
 * else. `exam_title` exists only because `exam.service.ts` fetches each exam and
 * grafts it on, which this page will not do (see the header).
 *
 * The field is still read first, so a replica that ever starts sending one is
 * believed; `titles` is the fallback and, today, the only thing that names an
 * exam at all.
 */
function assessmentEvents(
    rows: readonly any[],
    kind: Extract<Achievement, 'exam' | 'quiz'>,
    titles: Map<string, string>,
): LeaderboardEvent[] {
    const subjectField = kind === 'exam' ? 'exam' : 'quiz';
    const titleField = kind === 'exam' ? 'exam_title' : 'quiz_title';
    const out: LeaderboardEvent[] = [];
    for (const row of rows) {
        const userId = String(row?.user_id || '').trim();
        const subjectId = String(row?.[subjectField] || '').trim();
        if (!userId || !subjectId) continue;
        const value = score(row?.score);
        out.push({
            kind,
            userId,
            // A result carries a username and not a full name; the certificates
            // carry the full name. `aggregate` prefers whichever is freshest and
            // never lets a blank win, so a learner with a certificate is printed
            // under the name their certificate prints.
            name: String(row?.username || '').trim(),
            subjectId,
            subjectName: String(row?.[titleField] || '').trim()
                || titles.get(subjectId) || undefined,
            score: value,
            passed: passed(row?.result_status, value),
            at: stamp(row?.date_taken),
        });
    }
    return out;
}

/**
 * Every achievement on the platform, as one flat list.
 *
 * The four reads run in parallel and none of them can fail the page. What comes
 * back is raw — retakes included, unwindowed, unranked — because the engine owns
 * every one of those decisions and a service that pre-deduped would be a second
 * place the dedupe rule lives.
 */
/** The four raw collections, exactly as the services answer them. */
export interface RawSources {
    examResults: readonly any[];
    quizResults: readonly any[];
    examCerts: readonly any[];
    courseCerts: readonly any[];
    /** course_id to title, from app 19. Certificates top it up below. */
    courseTitles: Map<string, string>;
}

/**
 * Raw rows in, `LeaderboardEvent[]` out. No network.
 *
 * Split out from `loadAchievements` **so the preview harness cannot bypass it**.
 * `tools/leaderboard-preview/` stubs the service, and if the flattening lived
 * inside the fetch then the harness would be testing its own sample data rather
 * than this code — which is precisely how the "Untitled" chart got past a green
 * check and a screenshot: the stub handed the view a title that production never
 * sends. Now the stub fakes the HTTP rows and this function is the real one.
 */
export function flattenSources(raw: RawSources): LeaderboardEvent[] {
    /*
      NAMING AN EXAM WITHOUT ASKING APP 20 WHAT IT IS CALLED.

      A result record has no title (see `assessmentEvents`) and `/exams/` is off
      limits on a page that needs no account, because it serialises every
      question with `is_correct`. So the names come from data already in hand:
      **an exam certificate carries `exam_name` and is keyed on the same
      `exam_id` the results use.** App 20 issues one automatically on a pass, so
      every exam anybody has passed is named for free, with no extra request and
      nothing leaked.

      What this cannot name is an exam nobody has ever passed, and a **quiz** —
      no certificate is issued for one and `/quizzes/` nests answers exactly as
      `/exams/` does. Those subjects are dropped by `topSubjects` rather than
      labelled, which is why the chart is titled for exams and courses.

      `course_name` off a course certificate is folded into the same course map,
      because a certificate names a course whose own record app 19 might not have
      answered for.
    */
    // A COPY, not the caller's map. Topping up an input in place would make a
    // second call with the same map see the first call's additions - harmless
    // today because every caller builds a fresh one, and the kind of coupling
    // that is only ever discovered by the bug it causes.
    const titles = new Map(raw.courseTitles);
    const examTitles = new Map<string, string>();
    for (const cert of raw.examCerts) {
        const id = String(cert?.exam_id || '').trim();
        const name = String(cert?.exam_name || '').trim();
        if (id && name && !examTitles.has(id)) examTitles.set(id, name);
    }
    for (const cert of raw.courseCerts) {
        const id = String(cert?.course_id || '').trim();
        const name = String(cert?.course_name || '').trim();
        if (id && name && !titles.has(id)) titles.set(id, name);
    }

    const events: LeaderboardEvent[] = [
        ...assessmentEvents(raw.examResults, 'exam', examTitles),
        // Nothing on the platform names a quiz without also shipping its answer
        // key, so this map is deliberately empty rather than absent: the code
        // path is identical, and the day a `quiz_title` appears on the record or
        // a safe listing exists, one map is all that has to change.
        ...assessmentEvents(raw.quizResults, 'quiz', new Map()),
    ];

    for (const cert of raw.examCerts) {
        const userId = String(cert?.user_id || '').trim();
        const subjectId = String(cert?.exam_id || '').trim();
        if (!userId || !subjectId) continue;
        events.push({
            kind: 'exam_certificate',
            userId,
            name: String(cert?.user_full_name || '').trim(),
            avatarUrl: String(cert?.user_image_url || '').trim() || undefined,
            subjectId,
            subjectName: String(cert?.exam_name || '').trim()
                || examTitles.get(subjectId) || undefined,
            score: null,
            // A certificate exists because somebody passed. An expired one is
            // still an achievement that happened — `is_valid` is about whether it
            // can be presented today, which is a different question from whether
            // it was earned, and a board that quietly deleted last year's passes
            // would rewrite its own history every twelve months.
            passed: true,
            at: stamp(cert?.taken_date || cert?.created_at),
        });
    }

    for (const cert of raw.courseCerts) {
        const userId = String(cert?.user_id || '').trim();
        const subjectId = String(cert?.course_id || '').trim();
        if (!userId || !subjectId) continue;
        const hours = Number(cert?.hours);
        events.push({
            kind: 'course_certificate',
            userId,
            name: String(cert?.user_full_name || '').trim(),
            avatarUrl: String(cert?.user_image_url || '').trim() || undefined,
            subjectId,
            subjectName: String(cert?.course_name || '').trim()
                || titles.get(subjectId) || undefined,
            score: null,
            passed: true,
            at: stamp(cert?.date || cert?.created_at),
            hours: Number.isFinite(hours) ? hours : 0,
        });
    }

    return events;
}

/**
 * Every achievement on the platform, as one flat list.
 *
 * The four reads run in parallel and none of them can fail the page. What comes
 * back is raw — retakes included, unwindowed, unranked — because the engine owns
 * every one of those decisions and a service that pre-deduped would be a second
 * place the dedupe rule lives.
 */
export async function loadAchievements(): Promise<SourceReport> {
    const [examResults, quizResults, examCerts, courseCerts, titles] = await Promise.all([
        collection<any>(EXAM_APP_ID, 'exam', '/user-exam-results/'),
        collection<any>(EXAM_APP_ID, 'exam', '/user-quiz-results/'),
        collection<any>(CERTIFICATE_APP_ID, 'certificate', '/exam-certificates/'),
        collection<any>(CERTIFICATE_APP_ID, 'certificate', '/course-certificates/'),
        courseTitles(),
    ]);

    const answered = {
        'Exam results': examResults.answered,
        'Quiz results': quizResults.answered,
        'Exam certificates': examCerts.answered,
        'Course certificates': courseCerts.answered,
    };

    return {
        answered,
        allFailed: Object.values(answered).every(ok => !ok),
        events: flattenSources({
            examResults: examResults.rows,
            quizResults: quizResults.rows,
            examCerts: examCerts.rows,
            courseCerts: courseCerts.rows,
            courseTitles: titles,
        }),
    };
}
