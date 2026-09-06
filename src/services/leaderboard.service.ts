import { apiService, withReplicas } from './api';
import { normalizePaginatedResponse } from '@/utils/api-utils';
import type { Achievement, LeaderboardEvent } from '@/utils/leaderboardEngine';
import {
    CONTEXTS, severityOf, specOf, type PracticeContext,
} from '@/utils/practiceIntegrity';
import type { Enrolment, LabRow } from '@/utils/learnerDossier';

/**
 * The leaderboard's data layer — six collections off three backends, flattened
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
const LAB_APP_ID = Number(import.meta.env.VITE_LAB_APP_ID || '11');

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
    appId: number, serviceName: string, endpoint: string, key?: string,
): Promise<Source<T>> {
    try {
        const rows = await withReplicas(appId, serviceName, async baseUrl => {
            const response = await apiService.get<any>(baseUrl, endpoint);
            /*
              `key` IS NOT OPTIONAL FOR APP 11, and this is the trap that made the
              lab column empty on the first attempt.

              App 11 answers `{count, progress: [...]}` and
              `{count, labs: [...], tracks: [...]}`. `normalizePaginatedResponse`
              sees `count` in the object, reads it as DRF's envelope, looks for
              `results`, finds none — and hands back an EMPTY LIST with a count of
              five. No error, no warning, and a board that silently scores nobody
              for their labs. Anything that names its collection after the
              resource has to say so here.
            */
            if (key && response && typeof response === 'object'
                && Array.isArray((response as any)[key])) {
                return (response as any)[key] as T[];
            }
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
    /**
     * The two collections the RANKING does not use and the activity panel does.
     *
     * Carried on the report rather than fetched by the panel, because a panel
     * that fetched on open would be a request per learner whose row somebody
     * clicked - against a replica whose first answer of the day is ~20 seconds,
     * on a page that has already paid for six collections. They are already in
     * hand, so handing them over costs nothing.
     */
    labRows: Map<string, LabRow[]>;
    enrolments: Map<string, Enrolment[]>;
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
            /*
              HOW THE SITTING WAS JUDGED, carried onto the event.

              Only one value changes anything: a `failed` sitting is one app 20
              voided for misconduct, and `pointsFor` pays no attempted-credit
              for it. Without this the board would pay somebody five points for
              an attempt it had already scored zero for cheating - the ledger
              and the board disagreeing about the same afternoon, on the same
              page, with the board being the louder of the two.
            */
            integrityStatus: String(row?.integrity_status || ''),
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
/** The raw collections, exactly as the services answer them. */
export interface RawSources {
    examResults: readonly any[];
    quizResults: readonly any[];
    examCerts: readonly any[];
    courseCerts: readonly any[];
    /** course_id to title, from app 19. Certificates top it up below. */
    courseTitles: Map<string, string>;
    /** App 11's `lab_progress` — one row per learner per lab, already deduped. */
    labProgress?: readonly any[];
    /** lab_id to title, from app 11's `/api/labs/`. */
    labTitles?: Map<string, string>;
    /**
     * App 20's `practice_events` - every action recorded during a sitting.
     *
     * Read on a page that needs no account, deliberately, and that is a change
     * of posture rather than an oversight: the note at the top of this file
     * says the board publishes no attributed failures, and conduct is now
     * published on purpose because an integrity system nobody can see does not
     * deter anything. What is NOT published is the content - a copy is recorded
     * as a character count and app 20 truncates the detail again on the way in.
     */
    practiceEvents?: readonly any[];
    /** App 19's `/registrations/` - which courses somebody signed up to. */
    enrolments?: readonly any[];
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

    /*
      THE LABS (app 11).

      One record per learner per lab, so there is nothing to dedupe — the uid is
      derived from `(username, lab_id)`, which is what makes a retake an UPDATE
      rather than a second row. `subjectId` is still set because `bestAttempts`
      drops an event without one, and because it is what lets a lab appear in the
      subjects chart.

      A lab MERELY OPENED IS NOT AN EVENT. App 11 writes a `not_started` record
      the moment somebody clicks into a lab, so counting those would put a
      learner on a public leaderboard for following a link — and three of the five
      live records are exactly that. `earned > 0` means the service inspected the
      environment and found what the lab asked for, which is the least that can
      honestly be called an achievement.

      `at` is the completion date when there is one and the last activity
      otherwise, because that is the moment the points were earned and it is what
      the window filter and the activity chart both want.
    */
    const labTitles = raw.labTitles ?? new Map<string, string>();
    for (const row of raw.labProgress ?? []) {
        const userId = String(row?.user_id || '').trim();
        const subjectId = String(row?.lab_id || '').trim();
        if (!userId || !subjectId) continue;
        const earned = Number(row?.earned);
        const possible = Number(row?.possible);
        const done = Number.isFinite(earned) ? Math.max(0, earned) : 0;
        if (done <= 0) continue;
        const status = String(row?.status || '').trim();
        events.push({
            kind: 'lab',
            userId,
            // Blank on every live record, and deliberately still read: an
            // operator may fill it in, and a real name beats a username.
            name: String(row?.full_name || '').trim(),
            // The username only if nothing else on the platform names them —
            // see `LeaderboardEvent.fallbackName`. A learner whose only
            // achievement is a lab was printed as the literal "Learner".
            fallbackName: String(row?.username || '').trim() || undefined,
            subjectId,
            subjectName: labTitles.get(subjectId) || undefined,
            // The lab's own percentage. It does not enter the average score or
            // the score histogram — both filter on kind — but it is what
            // `bestAttempts` would compare on if two rows for one lab ever
            // reached here through a merge artefact.
            score: score(row?.score),
            // `passed` on a lab means FINISHED, not "scored above a mark". There
            // is no pass mark: every task is checked or it is not.
            passed: status === 'completed',
            at: stamp(row?.completed_at || row?.last_active || row?.updated_at),
            labPoints: done,
            labPossible: Number.isFinite(possible) ? Math.max(0, possible) : 0,
        });
    }

    /*
      THE PRACTICE LEDGER (app 20's `practice_events`).

      Every recorded action becomes an event, and `unique` is set to the
      record's own id - because `bestAttempts` dedupes on
      `(userId, kind, subjectId)` and a sitting produces a dozen actions against
      one subject. Without it the whole ledger collapses to one event per paper
      and the conduct score becomes whichever action happened to be scanned
      last.

      `points` is CARRIED rather than looked up, and app 20 derives it from its
      own catalogue on the way out - so a record that arrived through peer sync
      carrying a forged value is still scored from the catalogue. This side
      reads the value it was given and `severity` is re-derived locally as a
      second line of defence, because a severity is what decides whether an
      action counts towards a strike limit and the two catalogues are asserted
      equal by `npm run check:practice`.

      A NEUTRAL action is kept. It is worth zero, so it changes no total, and it
      is what makes the published feed legible: "started the exam at 09:02,
      submitted at 09:41" is the context the breaches in between are read in,
      and a feed showing only misconduct would be an accusation rather than a
      record.
    */
    for (const row of raw.practiceEvents ?? []) {
        const userId = String(row?.user_id || '').trim();
        const action = String(row?.action || '').trim();
        const sessionId = String(row?.session_id || '').trim();
        const externalId = String(row?.external_id || '').trim();
        if (!userId || !action || !externalId) continue;
        const context = String(row?.context || '').trim();
        // A subject is required by `bestAttempts`; a sitting always has one, and
        // an event without one is a record this build cannot attribute.
        const subjectId = String(row?.subject_id || '').trim();
        if (!subjectId) continue;
        const carried = Number(row?.points);
        events.push({
            kind: 'practice',
            userId,
            // A practice event carries a username and never a full name, so it
            // must not be allowed to displace the name a certificate prints -
            // `aggregate` prefers the FRESHEST name and a breach recorded this
            // morning is fresher than a certificate issued last year. Same
            // reasoning as a lab progress record.
            name: '',
            fallbackName: String(row?.username || '').trim() || undefined,
            subjectId,
            subjectName: String(row?.subject_name || '').trim() || undefined,
            unique: externalId,
            score: null,
            // Meaningless for a conduct action, and false rather than true so
            // nothing downstream can read it as an achievement.
            passed: false,
            at: stamp(row?.at || row?.occurred_at),
            points: Number.isFinite(carried) ? carried : 0,
            // Re-derived locally rather than trusted, for the reason above.
            // Falls back to what the service said when this build does not know
            // the action, which is what a replica a release ahead sends.
            severity: specOf(action)
                ? severityOf(action)
                : (row?.severity === 'negative' || row?.severity === 'positive'
                    ? row.severity : 'neutral'),
            label: String(row?.label || '').trim() || action,
            reason: String(row?.why || '').trim(),
            detail: String(row?.detail || '').trim(),
            sessionId,
            action,
            // AGAINST `CONTEXTS`, not against a list written here. A
            // hardcoded triple was correct for as long as there were three,
            // and on the day the speaking rooms arrived it silently dropped
            // `context` from every interview and meeting event - which reads
            // as an exam to `applyConductCaps`, so a -3 window switch in an
            // interview would be capped at the EXAM cap and a nine-breach
            // meeting would be reported as a voided paper.
            context: (CONTEXTS as readonly string[]).includes(context)
                ? (context as PracticeContext) : undefined,
        });
    }

    return events;
}

/**
 * App 11's progress rows as the dossier reads them - INCLUDING the empty ones.
 *
 * `flattenSources` drops a lab with no verified task, and it is right to: app
 * 11 writes a record the moment somebody clicks a link, so scoring those would
 * put a learner on a public board for following one. A dossier wants the
 * opposite, because "currently working on" is exactly what a zero-progress
 * record is evidence of - so this is a second pass over the same rows rather
 * than a change to that filter.
 */
export function labRowsOf(
    rows: readonly any[], titles: Map<string, string>,
): Map<string, LabRow[]> {
    const byUser = new Map<string, LabRow[]>();
    for (const row of rows || []) {
        const labId = String(row?.lab_id || '').trim();
        /*
          KEYED ON `user_id`, and a row without one is dropped.

          App 11 keys its progress uid on a `user_id` where there is one and on
          a lowercased USERNAME otherwise (`progress_uid`), so a row can
          legitimately carry only the username - and the events on this page
          have already resolved everybody to an id. Guessing the join from a
          username would attribute a lab to whoever happens to share it, and a
          lab attributed to the wrong learner is worse than one attributed to
          nobody.
        */
        const userId = String(row?.user_id || '').trim();
        if (!labId || !userId) continue;
        const list = byUser.get(userId) ?? [];
        list.push({
            labId,
            labName: titles.get(labId) || '',
            track: String(row?.track || ''),
            status: String(row?.status || ''),
            earned: Math.max(0, Number(row?.earned) || 0),
            possible: Math.max(0, Number(row?.possible) || 0),
            percent: Math.max(0, Math.min(100, Number(row?.score) || 0)),
            startedAt: stamp(row?.started_at),
            lastAt: stamp(row?.last_active || row?.updated_at),
            completedAt: stamp(row?.completed_at),
        });
        byUser.set(userId, list);
    }
    return byUser;
}

/** Who is enrolled on what, keyed by user. App 19's `/registrations/`. */
export function enrolmentsOf(
    rows: readonly any[], titles: Map<string, string>,
): Map<string, Enrolment[]> {
    const byUser = new Map<string, Enrolment[]>();
    for (const row of rows || []) {
        const userId = String(row?.user_id || '').trim();
        const courseId = String(row?.course_external_id || row?.course || '').trim();
        if (!userId || !courseId) continue;
        const list = byUser.get(userId) ?? [];
        list.push({
            courseId,
            courseName: titles.get(courseId) || '',
            at: stamp(row?.date_registered),
        });
        byUser.set(userId, list);
    }
    return byUser;
}

/**
 * A lab id to its title, for naming a lab in the subjects chart.
 *
 * Safe to fetch on a page that needs no account, unlike app 20's `/exams/`: a
 * lab manifest carries a brief a student is meant to READ and no answer key —
 * what a task checks is a query against the environment, not a stored answer. A
 * failure here is invisible: `topSubjects` drops a subject nothing can name
 * rather than labelling it, so the chart is shorter and never wrong.
 */
async function labTitles(): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    const { rows } = await collection<any>(LAB_APP_ID, 'lab', '/api/labs/', 'labs');
    for (const row of rows) {
        const id = String(row?.id || '').trim();
        const title = String(row?.title || '').trim();
        if (id && title) titles.set(id, title);
    }
    return titles;
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
    const [examResults, quizResults, examCerts, courseCerts, labProgress,
           practiceEvents, enrolments,
           titles, labs] = await Promise.all([
        collection<any>(EXAM_APP_ID, 'exam', '/user-exam-results/'),
        collection<any>(EXAM_APP_ID, 'exam', '/user-quiz-results/'),
        collection<any>(CERTIFICATE_APP_ID, 'certificate', '/exam-certificates/'),
        collection<any>(CERTIFICATE_APP_ID, 'certificate', '/course-certificates/'),
        // `'progress'` names the list. App 11 answers `{count, progress: [...]}`
        // and without the key `normalizePaginatedResponse` reads it as a DRF
        // envelope with nothing in it — see `collection`.
        collection<any>(LAB_APP_ID, 'lab', '/api/labs/progress/', 'progress'),
        // The practice ledger. Eight of the platform's collections now.
        collection<any>(EXAM_APP_ID, 'exam', '/practice-events/'),
        // Enrolments. NOT scored - see `Enrolment` - and read here because the
        // activity panel has to answer "what are they working on", which none
        // of the achievement collections can.
        collection<any>(COURSE_APP_ID, 'course', '/registrations/'),
        courseTitles(),
        labTitles(),
    ]);

    const answered = {
        'Exam results': examResults.answered,
        'Quiz results': quizResults.answered,
        'Exam certificates': examCerts.answered,
        'Course certificates': courseCerts.answered,
        'Lab progress': labProgress.answered,
        'Practice records': practiceEvents.answered,
        'Enrolments': enrolments.answered,
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
            labProgress: labProgress.rows,
            labTitles: labs,
            practiceEvents: practiceEvents.rows,
            enrolments: enrolments.rows,
        }),
        labRows: labRowsOf(labProgress.rows, labs),
        enrolments: enrolmentsOf(enrolments.rows, titles),
    };
}
