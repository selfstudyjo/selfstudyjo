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
 * So exam and quiz titles come from the certificates, which carry `exam_name`
 * and `course_name` already denormalised, and from app 19's `/courses/`, which
 * is a light list with no questions in it. An assessment nothing else names is
 * counted without being named — the board needs to know a learner passed *an*
 * exam far more than it needs to print which one, and a missing title costs a
 * label while the alternative costs the question bank.
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

function assessmentEvents(
    rows: readonly any[], kind: Extract<Achievement, 'exam' | 'quiz'>,
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
            subjectName: String(row?.[titleField] || '').trim() || undefined,
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
export async function loadAchievements(): Promise<SourceReport> {
    const [examResults, quizResults, examCerts, courseCerts, titles] = await Promise.all([
        collection<any>(EXAM_APP_ID, 'exam', '/user-exam-results/'),
        collection<any>(EXAM_APP_ID, 'exam', '/user-quiz-results/'),
        collection<any>(CERTIFICATE_APP_ID, 'certificate', '/exam-certificates/'),
        collection<any>(CERTIFICATE_APP_ID, 'certificate', '/course-certificates/'),
        courseTitles(),
    ]);

    const events: LeaderboardEvent[] = [
        ...assessmentEvents(examResults.rows, 'exam'),
        ...assessmentEvents(quizResults.rows, 'quiz'),
    ];

    for (const cert of examCerts.rows) {
        const userId = String(cert?.user_id || '').trim();
        const subjectId = String(cert?.exam_id || '').trim();
        if (!userId || !subjectId) continue;
        events.push({
            kind: 'exam_certificate',
            userId,
            name: String(cert?.user_full_name || '').trim(),
            avatarUrl: String(cert?.user_image_url || '').trim() || undefined,
            subjectId,
            subjectName: String(cert?.exam_name || '').trim() || undefined,
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

    for (const cert of courseCerts.rows) {
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

    const answered = {
        'Exam results': examResults.answered,
        'Quiz results': quizResults.answered,
        'Exam certificates': examCerts.answered,
        'Course certificates': courseCerts.answered,
    };

    return {
        answered,
        allFailed: Object.values(answered).every(ok => !ok),
        events,
    };
}
