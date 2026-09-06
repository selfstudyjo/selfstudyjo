/**
 * src/services/assistant.service.ts — what Noor is allowed to fetch.
 *
 * Three jobs, and the third is the one with a rule attached:
 *
 *  1. **Ask the model.** App 27's `/v1/chat/completions`, through the pinned
 *     replica. The prompt is built in the browser by `assistantEngine.ts` and
 *     not on the backend, because what she knows is the FRONTEND's route table
 *     and page catalogue — a copy of that on app 27 would be a cross-repo
 *     contract with nothing keeping the two in step (working rule 10), and its
 *     failure mode is an assistant confidently offering a page that was renamed
 *     last week.
 *  2. **Transcribe the microphone.** App 27's `/api/assistant/transcribe`,
 *     which is Whisper. Not the Web Speech API: `SpeechRecognition` is absent
 *     from Firefox entirely and its Arabic support varies by build, and this
 *     platform serves three languages. Chunked exactly as the Job Interview
 *     room does it, because that is the arrangement that already works here.
 *  3. **Load the student's own record**, so "how did I do in the Linux exam"
 *     has an exact answer rather than a guess.
 *
 * ============================================================
 * WHAT THIS FILE MUST NEVER FETCH
 * ============================================================
 *
 * `/exams/`, `/quizzes/`, `/exam-questions/`, `/quiz-questions/`,
 * `/exam-answers/` or `/quiz-answers/` on app 20. Every one of those nests the
 * whole paper: `_exam_out` and `_quiz_out` attach each question with each
 * answer and its `is_correct`. Two reasons, and the second is the one that
 * cannot be argued away:
 *
 *  * **Weight.** 34 papers and 290 quizzes is 2,090 questions and 8,360
 *    options — megabytes, to render two hundred titles.
 *  * **An assistant must not be holding the answer key.** She is told not to
 *    answer an exam question and a prompt is a request; not having the key in
 *    the process is a guarantee. It also means no future change to the prompt
 *    builder can accidentally put one in front of a model.
 *
 * App 20's `GET /assessment-titles/` was added for exactly this: one request,
 * titles and pass marks only, structurally incapable of carrying a key.
 * `npm run check:assistant` reads this file and fails on any of the six paths
 * above appearing in it.
 */

import { apiService, ApiError } from './api';
import { serviceRegistry } from './config';
import { certificateService } from './certificate.service';
import { courseService } from './course.service';
import { examService } from './exam.service';
import { labsService } from './labs.service';
import { runbookService } from './runbook.service';
import { subscriptionService } from './subscription.service';
import { aiLanguage, aiLanguageHeaders, td } from '@/i18n/runtime';
import {
    bestAttempts, emptySnapshot,
    type Attempt, type CatalogueEntry, type SnapshotSection, type StudentSnapshot,
} from '@/utils/assistantEngine';

const EXAM_APP_ID = parseInt(import.meta.env.VITE_EXAM_APP_ID || '20');

/** One `{role, content}` pair on the way to the model. */
export interface ChatTurn {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * A title from `/assessment-titles/`.
 *
 * `pass_score` is carried because a caller reporting a score has to say whether
 * it was a pass, and a second copy of `DEFAULT_PASS_SCORE` in this repo is how
 * a student is shown a pass and never gets a certificate.
 */
interface TitleRow {
    external_id: string;
    title: string;
    course_id: string;
    lesson_id: string;
    pass_score: number | null;
    translations?: Record<string, Record<string, string>>;
}

interface RawResult {
    external_id?: string;
    exam?: string;
    quiz?: string;
    score?: number;
    date_taken?: string;
    result_status?: string;
}

function ok<T>(rows: T[]): SnapshotSection<T> {
    return { state: 'ok', rows };
}

/** A section nothing could be read for. NOT an empty one — see the engine. */
function down<T>(): SnapshotSection<T> {
    return { state: 'unavailable', rows: [] };
}

/**
 * Settle a section without letting one dead service take the rest with it.
 *
 * `Promise.allSettled` over the whole load would do the same thing, and this
 * says which section failed rather than which promise did — which is the only
 * form the engine can act on, because the sentence it puts in the prompt names
 * the section.
 */
async function section<T>(load: () => Promise<T[]>): Promise<SnapshotSection<T>> {
    try {
        return ok(await load());
    } catch {
        return down<T>();
    }
}

class AssistantService {
    /**
     * The pinned app 27 replica.
     *
     * Through the shared `getRandomAiReplica()` rather than an inlined
     * `Math.random()`, which is working rule 31's worst instance: it picks once
     * per tab and then STAYS there. Re-picking per call under push-then-repair
     * replication is a coin flip on whether the reply was composed against the
     * message just sent.
     */
    private async aiBase(): Promise<string> {
        const url = await serviceRegistry.getRandomAiReplica();
        if (!url) throw new Error('The assistant service is unavailable');
        return url;
    }

    private async examBase(): Promise<string> {
        const replicas = await serviceRegistry.getServiceReplicas(EXAM_APP_ID, 'exam');
        const url = await serviceRegistry.getRandomReplica(replicas, EXAM_APP_ID);
        if (!url) throw new Error('The exam service is unavailable');
        return url;
    }

    /**
     * One turn. Returns the model's raw text; the engine parses it.
     *
     * `temperature` is low rather than the endpoint's 0.7 default: this reply
     * is a JSON document whose `target` has to be an id off a list, and a
     * creative model invents a nicer-sounding one. `max_tokens` is small for
     * the same reason the bubbles are short — and because a truncated JSON
     * document does not parse, so a long answer is not a long answer, it is no
     * answer at all.
     */
    async ask(turns: ChatTurn[]): Promise<string> {
        const base = await this.aiBase();
        const response = await apiService.post<{
            choices?: Array<{ message?: { content?: string } }>;
        }>(base, '/v1/chat/completions', {
            messages: turns,
            temperature: 0.25,
            max_tokens: 700,
        }, aiLanguageHeaders());
        return response?.choices?.[0]?.message?.content || '';
    }

    /**
     * A recorded chunk, as text.
     *
     * `fetch` rather than `apiService`, because this is a multipart upload and
     * the shared client is JSON-shaped for it. The language travels as a form
     * field AND a header for the reason the Job Interview room documents:
     * `language.from_request` reads the body first, and
     * `request.get_json(silent=True)` sees nothing in a multipart request — so
     * the header is what actually carries it, and both are sent so neither the
     * service nor a future proxy has to be the one that works.
     *
     * Never throws. A dropped chunk is a normal event on a flaky connection and
     * the caller counts them; one that took the whole handler down would stop
     * the recording loop for the rest of the session.
     */
    async transcribe(blob: Blob): Promise<string> {
        if (blob.size < 1000) return '';
        try {
            const base = await this.aiBase();
            const form = new FormData();
            form.append('audio', blob, 'audio.webm');
            form.append('language', aiLanguage());
            const response = await fetch(`${base}/api/assistant/transcribe`, {
                method: 'POST',
                headers: {
                    Authorization: `Token ${import.meta.env.VITE_AUTH_TOKEN}`,
                    ...aiLanguageHeaders(),
                },
                body: form,
                mode: 'cors',
                credentials: 'omit',
            });
            if (!response.ok) return '';
            const result = await response.json();
            return String(result?.text || '').trim();
        } catch {
            return '';
        }
    }

    /* -------------------------------------------------------------- *
     * Naming an assessment without its answer key
     * -------------------------------------------------------------- */

    private titles: Promise<{ exams: Map<string, TitleRow>; quizzes: Map<string, TitleRow> }> | null = null;

    /**
     * `GET /assessment-titles/` — every exam and quiz, as a name.
     *
     * The PROMISE is cached, not the result, so several sections asking at once
     * join one request rather than starting several. That is the fix
     * `ensureCourse` on the dashboard needed after it issued ~200 requests to
     * render a page.
     *
     * A replica that has not pulled the route answers 404, which reads here as
     * "nothing can be named": every result still carries its score and its
     * date, and the engine renders an unnamed one as "an unnamed quiz" rather
     * than dropping it. Degraded, not broken.
     */
    private assessmentTitles() {
        if (!this.titles) {
            this.titles = (async () => {
                const empty = { exams: new Map<string, TitleRow>(), quizzes: new Map<string, TitleRow>() };
                try {
                    const base = await this.examBase();
                    const payload = await apiService.get<{ exams?: TitleRow[]; quizzes?: TitleRow[] }>(
                        base, '/assessment-titles/');
                    for (const row of payload?.exams || []) {
                        if (row?.external_id) empty.exams.set(row.external_id, row);
                    }
                    for (const row of payload?.quizzes || []) {
                        if (row?.external_id) empty.quizzes.set(row.external_id, row);
                    }
                } catch {
                    /* an older replica: results stay unnamed, nothing else changes */
                }
                return empty;
            })();
        }
        return this.titles;
    }

    /**
     * Raw results, unenriched.
     *
     * Deliberately NOT `examService.getUserExamResults()` /
     * `quizService.getUserQuizResults()`, which are the right calls for the My
     * Results page and the wrong ones here: both graft a title on by fetching
     * each assessment individually, so sixty attempts is sixty round trips —
     * and each of those responses carries the paper. One `/assessment-titles/`
     * names all of them for one request and no key.
     */
    private async rawResults(userId: string, path: string): Promise<RawResult[]> {
        const base = await this.examBase();
        const payload = await apiService.get<{ results?: RawResult[] } | RawResult[]>(
            base, `${path}?user_id=${encodeURIComponent(userId)}`);
        if (Array.isArray(payload)) return payload;
        return payload?.results || [];
    }

    private async attempts(userId: string, kind: 'exam' | 'quiz'): Promise<Attempt[]> {
        const [rows, titles] = await Promise.all([
            this.rawResults(userId,
                kind === 'exam' ? '/user-exam-results/' : '/user-quiz-results/'),
            this.assessmentTitles(),
        ]);
        const named = kind === 'exam' ? titles.exams : titles.quizzes;
        return bestAttempts(rows.map(row => {
            const subject = String((kind === 'exam' ? row.exam : row.quiz) || '');
            const title = named.get(subject);
            return {
                subject,
                // Through `td` so an Arabic reader is told the Arabic name of
                // the quiz they sat. The record carries all three languages and
                // reading `title` by hand would put an English quiz name in an
                // otherwise Arabic sentence — the half-translated state working
                // rule 41 exists to end.
                title: title ? td(title, 'title') : '',
                score: Number(row.score) || 0,
                passed: String(row.result_status || '').toUpperCase() === 'PASSED',
                at: String(row.date_taken || ''),
                attempts: 1,
            };
        }));
    }

    /* -------------------------------------------------------------- *
     * The snapshot
     * -------------------------------------------------------------- */

    private snapshots = new Map<string, Promise<StudentSnapshot>>();

    /** Forget the cached record — on sign-out, and when the reader asks. */
    reset(): void {
        this.snapshots.clear();
        this.titles = null;
        this.catalogue = null;
    }

    /**
     * Everything the platform knows about this student, in one object.
     *
     * The PROMISE is cached per user for the life of the tab. Reasons, in
     * order: opening the dock twice must not re-fetch it; two questions asked
     * three seconds apart must not race; and a student's results do not change
     * while they are talking to an assistant about them. `reset()` is the way
     * back, and the dock calls it when the username changes.
     *
     * Every section settles on its own. One cold replica costs one section, and
     * the engine's `unavailable` state is what stops that reading as "you have
     * none" — the difference between "I could not reach your certificates just
     * now" and telling somebody their credentials have gone.
     */
    async snapshot(userId: string, username: string, fullName = ''): Promise<StudentSnapshot> {
        const key = `${userId}|${username}`;
        const cached = this.snapshots.get(key);
        if (cached) return cached;

        const pending = (async (): Promise<StudentSnapshot> => {
            const snapshot = emptySnapshot(username, fullName);
            if (!userId) {
                // Signed out. Every section is settled and empty rather than
                // pending, or the dock would wait for a load that is never
                // going to happen before answering a question about the site.
                snapshot.quizzes = ok([]);
                snapshot.exams = ok([]);
                snapshot.certificates = ok([]);
                snapshot.courses = ok([]);
                snapshot.labs = ok([]);
                snapshot.plan = ok([]);
                snapshot.appointments = ok([]);
                return snapshot;
            }

            const [quizzes, exams, certificates, courses, labs, plan, appointments] =
                await Promise.all([
                    section(() => this.attempts(userId, 'quiz')),
                    section(() => this.attempts(userId, 'exam')),
                    section(() => this.credentials(userId)),
                    section(() => this.enrolled(userId)),
                    section(() => this.labProgress(username)),
                    section(() => this.plan(userId)),
                    section(() => this.upcoming(userId)),
                ]);

            snapshot.quizzes = quizzes;
            snapshot.exams = exams;
            snapshot.certificates = certificates;
            snapshot.courses = courses;
            snapshot.labs = labs;
            snapshot.plan = plan;
            snapshot.appointments = appointments;
            return snapshot;
        })();

        this.snapshots.set(key, pending);
        return pending;
    }

    private async credentials(userId: string) {
        const all = await certificateService.getUserCertificates(userId);
        const course = (all?.course_certificates || []).map(c => ({
            id: c.certificate_id,
            title: c.course_name || 'a course',
            kind: 'course' as const,
            at: c.date || c.created_at || '',
        }));
        const exam = (all?.exam_certificates || []).map(c => ({
            id: c.certificate_id,
            title: c.exam_name || c.course_name || 'an exam',
            kind: 'exam' as const,
            at: c.taken_date || c.created_at || '',
        }));
        return [...course, ...exam].sort((a, b) =>
            (a.at === b.at ? (a.id < b.id ? -1 : 1) : (a.at < b.at ? 1 : -1)));
    }

    private async enrolled(userId: string): Promise<CatalogueEntry[]> {
        const [registrations, all] = await Promise.all([
            courseService.getUserRegistrations(userId),
            this.courses(),
        ]);
        const byId = new Map(all.map(c => [c.id, c]));
        const seen = new Set<string>();
        const out: CatalogueEntry[] = [];
        for (const row of registrations || []) {
            const id = String(row.course_external_id || row.course || '');
            if (!id || seen.has(id)) continue;
            seen.add(id);
            out.push({ id, title: byId.get(id)?.title || id });
        }
        return out;
    }

    private async labProgress(username: string) {
        if (!username) return [];
        const [progress, catalogue] = await Promise.all([
            labsService.getProgress(username),
            this.labs(),
        ]);
        const byId = new Map(catalogue.map(l => [l.id, l.title]));
        return (progress || [])
            // A record app 11 wrote the moment somebody clicked a link is not
            // work they did, and listing it would have her congratulating a
            // student on a lab they have not opened. Same floor the leaderboard
            // applies before putting anybody on a public page.
            .filter(p => (p.earned || 0) > 0 || p.status === 'completed')
            .map(p => ({
                id: p.lab_id,
                title: byId.get(p.lab_id) || p.lab_id,
                status: p.status,
                points: p.earned || 0,
            }));
    }

    private async plan(userId: string) {
        const [active, features] = await Promise.all([
            subscriptionService.getActiveUserSubscription(userId),
            subscriptionService.getUserFeatures(userId).catch(() => [] as string[]),
        ]);
        if (!active) return [];
        return [{
            title: td(active.subscription_type || active, 'title')
                || active.title || 'your plan',
            expires: active.expire_date || '',
            features: features || [],
        }];
    }

    private async upcoming(userId: string) {
        const rows = await examService.getExamAppointments(userId);
        const titles = await this.assessmentTitles();
        const now = Date.now();
        return (rows || [])
            .filter(a => {
                const when = Date.parse(a.appointment_date || '');
                // An appointment from last month is history and she is being
                // asked what is coming up. A row with no readable date is kept
                // rather than dropped: an unparseable date is a data fault, and
                // hiding the record makes it look like the booking vanished.
                return Number.isNaN(when) || when >= now - 12 * 3600 * 1000;
            })
            .map(a => ({
                exam: a.exam_title
                    || (titles.exams.get(String(a.exam)) ? td(titles.exams.get(String(a.exam))!, 'title') : '')
                    || 'an exam',
                at: a.appointment_date || '',
                status: a.appointment_status || '',
            }))
            .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    }

    /* -------------------------------------------------------------- *
     * The catalogues an action is resolved against
     * -------------------------------------------------------------- */

    private catalogue: Promise<{
        courses: CatalogueEntry[]; labs: CatalogueEntry[]; runbooks: CatalogueEntry[];
    }> | null = null;

    /**
     * What `open_course` / `open_lab` / `open_runbook` may name.
     *
     * Loaded once per tab and settled per source, so a cold app 17 costs the
     * runbook button and nothing else. All three are light list routes that
     * carry no assessment content.
     */
    private catalogues() {
        if (!this.catalogue) {
            this.catalogue = (async () => {
                const [courses, labs, runbooks] = await Promise.all([
                    courseService.getAllCourses()
                        .then(rows => rows.map(c => ({
                            // `external_course_id`, which is what app 19 keys a
                            // registration on and what `/course/:id` resolves —
                            // the numeric `id` is the store's derived sha1 fold
                            // and routing on it would 404.
                            id: String(c.external_course_id || c.id || ''),
                            title: td(c, 'title') || c.title || '',
                        })))
                        .then(rows => rows.filter(c => c.id))
                        .catch(() => [] as CatalogueEntry[]),
                    labsService.getCatalogue()
                        .then(c => (c?.labs || []).map(l => ({ id: l.id, title: l.title })))
                        .catch(() => [] as CatalogueEntry[]),
                    runbookService.getAllRunbooks()
                        .then(rows => rows.map(r => ({
                            id: String(r.id),
                            title: td(r, 'title') || r.title || '',
                        })))
                        .catch(() => [] as CatalogueEntry[]),
                ]);
                return { courses, labs, runbooks };
            })();
        }
        return this.catalogue;
    }

    async courses(): Promise<CatalogueEntry[]> {
        return (await this.catalogues()).courses;
    }

    async labs(): Promise<CatalogueEntry[]> {
        return (await this.catalogues()).labs;
    }

    async runbooks(): Promise<CatalogueEntry[]> {
        return (await this.catalogues()).runbooks;
    }
}

export const assistantService = new AssistantService();

/**
 * True when app 27 refused the request rather than the network dropping it.
 *
 * The distinction is what the bubble says: a 503 from `/v1/chat/completions`
 * means every provider in the rotation failed and `describe_failure()` has a
 * sentence about which and why, so "the assistant is out of capacity, try in a
 * moment" is honest. Anything else and it is the connection, and telling
 * somebody the AI is down when their wifi dropped sends them to the wrong fix.
 */
export function isServiceRefusal(error: unknown): boolean {
    return error instanceof ApiError && (error.status || 0) >= 500;
}
