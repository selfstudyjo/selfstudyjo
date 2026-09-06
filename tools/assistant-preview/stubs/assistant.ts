/**
 * The assistant service, stubbed at the SERVICE boundary and nowhere deeper.
 *
 * Everything above this line is the real thing: `buildSystemPrompt` really
 * assembles the site map from `appNav.ts`, `parseReply` really reads the
 * envelope, `resolveAction` really validates the target against the catalogue,
 * and the bubble really renders whatever comes out. What is faked is the model
 * call and the seven network reads behind the snapshot.
 *
 * **`ask` returns a STRING, not a parsed object**, and that is the whole
 * discipline: a stub that handed the component a finished `{say, action}` would
 * skip the parser, which is the part most likely to be wrong. The leaderboard's
 * preview handed its view finished events with titles already on them and hid
 * the "Untitled" defect completely — a stub that is kinder than production
 * tests nothing.
 *
 * The snapshot deliberately carries one `unavailable` section, because "could
 * not be read" is a state the prompt has to render differently from "none" and
 * it is the one nobody would think to look at.
 */

import type { CatalogueEntry, StudentSnapshot } from '@/utils/assistantEngine';

const params = new URLSearchParams(location.search);
const long = params.get('state') === 'long';

const COURSES: CatalogueEntry[] = [
    { id: 'course-docker', title: 'Docker Mastery' },
    { id: 'course-linux', title: 'Linux and Git Fundamentals' },
    { id: 'course-web', title: 'Web Technologies' },
];

const LABS: CatalogueEntry[] = [
    { id: 'dk-01-basics', title: 'Your first container' },
    { id: 'lx-03-permissions', title: 'Users, groups and permissions' },
];

const RUNBOOKS: CatalogueEntry[] = [
    { id: '12', title: 'Runbook: the production readiness review' },
];

/**
 * What the model actually sends back, as text.
 *
 * The long variant is deliberately awkward: a uuid with no break opportunity in
 * it, which is precisely what sets a bubble's width when `overflow-wrap` is
 * `break-word` rather than `anywhere` — the fault `exam-system.css` documents
 * across 32 declarations.
 */
const REPLY = long
    ? '{"say":"Your best result on the Docker exam is 88%, a pass, taken on '
        + '3 September 2026 — that is your highest of three attempts. The '
        + 'certificate app 24 issued for it is 470a401f-f7ec-48ad-8c21-9b2e4f0a1d33, '
        + 'and it is on your certificates page along with the two course '
        + 'certificates you earned in July.","action":{"kind":"navigate","target":"my-results"}}'
    : '{"say":"Your best quiz score is 92% on the Containers quiz. Here are all '
        + 'of them.","action":{"kind":"navigate","target":"my-results"}}';

class StubAssistantService {
    async ask(): Promise<string> {
        await new Promise(r => setTimeout(r, 120));
        return REPLY;
    }

    async transcribe(): Promise<string> {
        return 'where are my labs';
    }

    async snapshot(username: string): Promise<StudentSnapshot> {
        return {
            username: username || 'sami',
            fullName: 'Sami Qudah',
            quizzes: {
                state: 'ok',
                rows: [
                    { subject: 'q1', title: 'Containers', score: 92, passed: true, at: '2026-09-01', attempts: 3 },
                    { subject: 'q2', title: 'Images and layers', score: 64, passed: false, at: '2026-08-20', attempts: 1 },
                ],
            },
            exams: {
                state: 'ok',
                rows: [{ subject: 'e1', title: 'Docker Mastery final', score: 88, passed: true, at: '2026-09-03', attempts: 1 }],
            },
            // The state nobody would think to look at, and the one the whole
            // three-state design exists for.
            certificates: { state: 'unavailable', rows: [] },
            courses: { state: 'ok', rows: COURSES },
            labs: {
                state: 'ok',
                rows: [{ id: 'dk-01-basics', title: 'Your first container', status: 'completed', points: 56 }],
            },
            plan: {
                state: 'ok',
                rows: [{ title: 'Professional Annual', expires: '2027-03-01', features: ['ai_feature', 'lab_feature'] }],
            },
            appointments: { state: 'ok', rows: [] },
        };
    }

    reset(): void { /* nothing cached here */ }
    async courses(): Promise<CatalogueEntry[]> { return COURSES; }
    async labs(): Promise<CatalogueEntry[]> { return LABS; }
    async runbooks(): Promise<CatalogueEntry[]> { return RUNBOOKS; }
}

export const assistantService = new StubAssistantService();
export function isServiceRefusal(): boolean { return false; }
export type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string };
