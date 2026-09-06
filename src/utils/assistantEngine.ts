/**
 * Noor, the site assistant — everything she DECIDES.
 *
 * A plain module: no Vue, no DOM, no service imports, no `fetch`. Same
 * precedent as `photoMask.ts`, `drawEngine.ts`, `appNav.ts`, `newscastEngine.ts`
 * and `labCatalogue.ts`, and for the same reason — `npm run check:assistant`
 * drives it in node, and almost everything in here fails SILENTLY:
 *
 *  * a destination whose `to` the router cannot match is a button that does
 *    nothing, and the only symptom is the reader pressing it twice;
 *  * a model reply that does not parse would, done naively, throw inside the
 *    send handler and leave the bot mid-sentence for ever;
 *  * a navigation target the model INVENTED is the assistant confidently
 *    sending somebody to a page that has never existed;
 *  * a snapshot section that failed to load, reported as "you have none", is
 *    the assistant telling a student their certificates are gone;
 *  * an unstable sort is a list that reorders itself between two questions
 *    about it.
 *
 * ============================================================
 * WHAT SHE IS FOR, AND THE ONE THING SHE MUST NOT DO
 * ============================================================
 *
 * She explains the platform, takes the reader to a page, and reports back
 * things the platform already knows about them — their results, their plan,
 * their certificates, their labs. She does **not** answer an exam question, a
 * quiz question, a lab task or a homework, and that is enforced in three
 * places rather than asked for once:
 *
 *  1. {@link looksLikeSolveRequest} refuses before a model call is spent, so
 *     the commonest phrasings never reach a provider at all.
 *  2. The system prompt forbids it in as many words, with the reason, because a
 *     detector cannot catch every phrasing.
 *  3. **The service never fetches a collection that carries an answer key** —
 *     no `/exams/`, no `/quizzes/`, no `/exam-questions/`, no `/quiz-answers/`.
 *     That is the only one of the three that is a guarantee rather than a
 *     request, and `check:assistant` asserts it against the service's source.
 *     App 20's `/assessment-titles/` exists precisely so a result can be NAMED
 *     without the key travelling.
 *
 * ============================================================
 * WHY THE MODEL PICKS AN ID AND NOT A URL
 * ============================================================
 *
 * The obvious protocol is `{"action": {"kind": "navigate", "to": "/labs"}}` and
 * it is wrong twice over. A model asked for a URL will invent a plausible one —
 * `/my-courses`, `/dashboard`, `/settings` — none of which is a route here, and
 * the reader gets the catch-all. And a free-text `to` is a string this code
 * would then be handing to the router, which is a redirect somebody else's
 * text controls.
 *
 * So the model picks an **id from a closed list** that is itself derived from
 * `appNav.ts`, and this module maps the id to the path. An id it made up
 * resolves to nothing and the action is DROPPED while the sentence is still
 * shown — the same rule the guided tour applies to a step whose target is not
 * on the page. A reader gets an answer with no button rather than a button to
 * nowhere.
 */

import {
    APP_SECTIONS, canSee, globalGroups, HOME_ENTRY,
    type Access, type AccessKey, type NavEntry,
} from '@/navigation/appNav';

/** The 3D figure she is rendered as. See `stage3d/figures.ts`. */
export const ASSISTANT_FIGURE_ID = 'noor';
export const ASSISTANT_NAME = 'Noor';

/* ------------------------------------------------------------------ *
 * Destinations
 * ------------------------------------------------------------------ */

export interface Destination {
    /** What the model says. Derived from the path, so it is readable and stable. */
    id: string;
    to: string;
    label: string;
    /** One line of what the page is for. Fed to the model, never rendered. */
    about: string;
    requires: AccessKey;
}

/**
 * A path turned into the token the model uses.
 *
 * `/research/my-projects` becomes `research-my-projects`. Readable in a reply,
 * stable across renames of the LABEL (which is translated and therefore not a
 * key), and derived rather than written down — a hand-maintained second list of
 * ids is a list that acquires a typo nobody can see, because a typo here is an
 * action that is silently dropped.
 */
export function destinationId(to: string): string {
    return to.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\//g, '-') || 'home';
}

/**
 * Every page the assistant may send somebody to, from the navigation registry.
 *
 * Derived rather than restated, so a page added to the sidebar is a page she
 * can reach on the same commit. Only entries with a STATIC path are included:
 * `/course/:id` needs an id, and that is what {@link resolveAction}'s deep
 * kinds are for.
 */
export function destinations(): Destination[] {
    const out = new Map<string, Destination>();

    const add = (to: string, label: string, about: string, requires: AccessKey) => {
        // A path with a parameter in it cannot be navigated to as it stands.
        if (!to.startsWith('/') || to.includes(':')) return;
        const id = destinationId(to);
        // First writer wins: a section's own landing page carries the
        // section's subtitle, which is a better sentence than an entry's
        // keyword list, and sections are walked first below.
        if (!out.has(id)) out.set(id, { id, to, label, about, requires });
    };

    add(HOME_ENTRY.to, HOME_ENTRY.text,
        'The learner dashboard: their score, their courses and their badges.',
        HOME_ENTRY.requires || 'auth');

    for (const section of APP_SECTIONS) {
        add(section.home, section.title, section.subtitle,
            (section.items.find(i => i.to === section.home)?.requires) || 'auth');
        for (const entry of section.items) {
            add(entry.to, entry.text,
                `${section.title} — ${entry.keywords || entry.text}`,
                entry.requires || 'auth');
        }
    }

    // The platform menu, which carries entries no section lists as its own.
    const everything: Access = {
        auth: true, ai: true, lab: true, runbook: true,
        research: true, toastmasters: true, exam: true, proctor: true,
    };
    for (const group of globalGroups(everything)) {
        for (const entry of group.items) {
            add(entry.to, entry.text, `${group.label} — ${entry.keywords || entry.text}`,
                entry.requires || 'auth');
        }
    }

    // Sorted by id rather than left in walk order. The list goes into a prompt
    // and into a check; an order that depends on how `APP_SECTIONS` happens to
    // be arranged is one that changes for reasons nothing here controls.
    return [...out.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The ones this reader can actually open. */
export function visibleDestinations(access: Access): Destination[] {
    return destinations().filter(d => canSee({ requires: d.requires } as NavEntry, access));
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

export type ActionKind =
    | 'none'
    | 'navigate'
    | 'open_course'
    | 'open_lesson'
    | 'open_lab'
    | 'open_runbook';

/** What the model produced. Every field is untrusted. */
export interface RawAction {
    kind?: unknown;
    target?: unknown;
    id?: unknown;
    courseId?: unknown;
}

/** What the dock may act on. `to` is always a path this build can match. */
export interface ResolvedAction {
    kind: ActionKind;
    to: string;
    /** The button's text — the destination's own name, never the model's. */
    label: string;
}

export interface CatalogueEntry {
    id: string;
    title: string;
    /** Lessons only. */
    courseId?: string;
}

/**
 * What the deep kinds may be resolved against.
 *
 * These come from what the CLIENT has actually loaded — the student's courses,
 * the lab catalogue — so an id the model invented matches nothing and the
 * action is dropped. Passing the catalogue in rather than importing a service
 * is what keeps this module plain.
 */
export interface ActionContext {
    access: Access;
    courses: CatalogueEntry[];
    lessons: CatalogueEntry[];
    labs: CatalogueEntry[];
    runbooks: CatalogueEntry[];
}

export const NO_ACCESS: Access = {
    auth: false, ai: false, lab: false, runbook: false,
    research: false, toastmasters: false, exam: false, proctor: false,
};

export const EMPTY_CONTEXT: ActionContext = {
    access: NO_ACCESS,
    courses: [], lessons: [], labs: [], runbooks: [],
};

function asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function findEntry(rows: CatalogueEntry[], id: string): CatalogueEntry | null {
    if (!id) return null;
    const exact = rows.find(r => r.id === id);
    if (exact) return exact;
    // A model handed a list of ids will occasionally hand one back with
    // different case. Matching loosely is safe because it can still only reach
    // something already in the list.
    const loose = id.toLowerCase();
    return rows.find(r => r.id.toLowerCase() === loose) || null;
}

/**
 * Turn what the model said into something safe to navigate to, or null.
 *
 * **Null is a normal outcome, not an error.** It means the model asked for a
 * page that does not exist, a record this reader does not have, or a page their
 * plan does not include — and in every one of those the right behaviour is the
 * same: show the sentence, draw no button. A button that bounces off the
 * subscription guard reads as broken where no button reads as "she just
 * answered the question".
 */
export function resolveAction(raw: RawAction | null | undefined,
                              ctx: ActionContext): ResolvedAction | null {
    if (!raw || typeof raw !== 'object') return null;
    const kind = asString(raw.kind);
    if (!kind || kind === 'none') return null;

    if (kind === 'navigate') {
        const target = asString(raw.target);
        const found = visibleDestinations(ctx.access)
            .find(d => d.id === target || d.to === target);
        return found ? { kind: 'navigate', to: found.to, label: found.label } : null;
    }

    // The deep kinds. Each needs a record the client is holding, and the LABEL
    // comes from that record rather than from the model — so a button can never
    // promise a page it is not about to open.
    if (kind === 'open_course') {
        const course = findEntry(ctx.courses, asString(raw.id));
        return course
            ? { kind: 'open_course', to: `/course/${course.id}`, label: course.title }
            : null;
    }
    if (kind === 'open_lesson') {
        const lesson = findEntry(ctx.lessons, asString(raw.id));
        // A lesson's route carries its course, so a lesson with no course
        // recorded against it cannot be opened at all.
        const courseId = asString(raw.courseId) || lesson?.courseId || '';
        return lesson && courseId
            ? {
                kind: 'open_lesson',
                to: `/course/${courseId}/lesson/${lesson.id}`,
                label: lesson.title,
            }
            : null;
    }
    if (kind === 'open_lab') {
        // `lab_feature` gates `/lab/:labId`, so without it the guard bounces the
        // click and the reader is shown a button that punishes them for pressing
        // it. Same rule the course page follows before drawing a runbook link.
        if (!ctx.access.lab) return null;
        const lab = findEntry(ctx.labs, asString(raw.id));
        return lab ? { kind: 'open_lab', to: `/lab/${lab.id}`, label: lab.title } : null;
    }
    if (kind === 'open_runbook') {
        if (!ctx.access.runbook) return null;
        const runbook = findEntry(ctx.runbooks, asString(raw.id));
        return runbook
            ? { kind: 'open_runbook', to: `/runbooks/${runbook.id}`, label: runbook.title }
            : null;
    }
    return null;
}

/* ------------------------------------------------------------------ *
 * Reading what the model said
 * ------------------------------------------------------------------ */

export interface AssistantReply {
    say: string;
    action: RawAction | null;
}

/**
 * Pull the balanced `{...}` starting at `from`, or ''.
 *
 * A brace scan rather than a regex, and it tracks strings and escapes, because
 * the `say` field routinely contains a brace — she is explaining a JSON lab, or
 * quoting a path — and a non-greedy regex would cut the document at the first
 * one inside a value. This is the same fault `_extract_json_blob` had on the
 * backend, where a fenced block inside a value truncated the whole reply.
 */
function balancedObject(text: string, from: number): string {
    if (from < 0) return '';
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = from; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return text.slice(from, i + 1);
        }
    }
    return '';
}

/**
 * The model's answer, as a sentence and an optional action.
 *
 * **Never throws, for any input.** It is called from the send handler, and a
 * throw there leaves the bot with a spinner that never stops — which is
 * indistinguishable from the provider having gone away, so nobody would look
 * here. Every failure degrades to "show whatever text arrived", because a
 * plausible sentence with no button is a far better outcome than an error card.
 */
export function parseReply(text: unknown): AssistantReply {
    const raw = typeof text === 'string' ? text.trim() : '';
    if (!raw) return { say: '', action: null };

    const start = raw.indexOf('{');
    if (start >= 0) {
        const blob = balancedObject(raw, start);
        if (blob) {
            try {
                const parsed = JSON.parse(blob) as { say?: unknown; action?: unknown };
                const say = typeof parsed?.say === 'string' ? parsed.say.trim() : '';
                const action = parsed?.action && typeof parsed.action === 'object'
                    ? parsed.action as RawAction
                    : null;
                // A document that parsed but said nothing is worse than the
                // prose around it: `{"action": {...}}` alone would render an
                // empty bubble. Fall through to the text in that case.
                if (say) return { say, action };
            } catch {
                /* not JSON after all — fall through and show the prose */
            }
        }
    }

    // Prose. Strip a code fence if the model wrapped its whole answer in one,
    // and drop a JSON blob it left dangling beside the sentence rather than
    // reading it out to the reader.
    let prose = raw.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
    const blob = balancedObject(prose, prose.indexOf('{'));
    if (blob && blob.length > 20) prose = prose.replace(blob, '').trim();
    return { say: prose, action: null };
}

/* ------------------------------------------------------------------ *
 * The one thing she will not do
 * ------------------------------------------------------------------ */

/**
 * A verb that means "do it for me", per script.
 *
 * Split from the nouns below and required TOGETHER, because either half alone
 * is ordinary vocabulary here: "answer" appears in "where do I see the answers
 * after an exam", and "quiz" appears in "how many quizzes are in this course".
 * Requiring one of each is what keeps a legitimate question out of the refusal.
 *
 * The first entry is the paired one; everything after it is standalone — a
 * phrasing that cannot be about anything else.
 */
const SOLVE_VERBS = [
    /\b(solve|answer|complete|finish)\b/i,
    /\b(give|tell|show)\s+(me|us)\b.{0,24}\banswers?\b/i,
    /\bwhat('?s| is)\s+the\s+(correct\s+)?answer\b/i,
    /\bwhich\s+(option|choice|one)\s+is\s+(correct|right)\b/i,
    /\bdo\s+(my|this|the)\s+(homework|assignment|lab|quiz|exam|task)\b/i,
    /(حل هذا|حل هذه|ما هي الإجابة|الإجابة الصحيحة|أعطني الحل|أعطني الإجابة)/,
    /(帮我解答|替我做|答案是什么|正确选项|帮我做作业)/,
];

const ASSESSMENT_NOUNS = [
    /\b(exam|quiz|question|homework|assignment|task|lab|test|paper)s?\b/i,
    /(امتحان|اختبار|سؤال|أسئلة|واجب|مهمة|مختبر)/,
    /(考试|测验|问题|作业|任务|实验)/,
];

/**
 * Is this "do my assessment for me"?
 *
 * A deliberately conservative detector in front of the model, not instead of
 * it. Two properties decide its shape:
 *
 *  * **A false positive costs a sentence.** The reader is told what she does
 *    not do and offered the lesson, the runbook and the lab brief instead, and
 *    asked to rephrase — annoying, recoverable, and no data is lost.
 *  * **A false negative costs nothing extra**, because the system prompt
 *    forbids the same thing and no answer key is in reach either way.
 *
 * So it fires only when a do-it-for-me verb and an assessment noun are BOTH
 * present. The standalone phrasings above ("what is the correct answer", "give
 * me the answers") are the exception: those cannot be about anything else.
 */
export function looksLikeSolveRequest(text: unknown): boolean {
    const value = typeof text === 'string' ? text : '';
    if (!value.trim()) return false;
    if (SOLVE_VERBS.slice(1).some(re => re.test(value))) return true;
    return SOLVE_VERBS[0].test(value) && ASSESSMENT_NOUNS.some(re => re.test(value));
}

/**
 * What she says instead. An English catalogue KEY, translated at the call site.
 *
 * Reached through this constant rather than written into the component so
 * `check:i18n` can prove both catalogues carry it — a key that appears in no
 * source file as a literal is one the orphan scan would otherwise report, which
 * is the same shape as the sidebar's labels and the dashboard's badge copy.
 */
export const REFUSAL =
    'I can help you find your way around and look things up, but I do not answer '
    + 'exam, quiz, lab or homework questions — working them out is the part that '
    + 'teaches you something. I can open the lesson, the runbook or the lab brief '
    + 'that covers it. If you meant something else, ask me again in other words.';

/* ------------------------------------------------------------------ *
 * The student's own record
 * ------------------------------------------------------------------ */

/**
 * How a section of the snapshot turned out.
 *
 * Three states and not two, for the reason `utils/identity.py` answers three on
 * app 23 and `collection()` answers three on the leaderboard: "she has no
 * certificates" and "app 24 did not answer" are different facts, and rounding
 * the second into the first has the assistant telling somebody their
 * credentials are gone. `pending` matters as well — a question asked while the
 * snapshot is still loading must not be answered from an empty one.
 */
export type SectionState = 'pending' | 'ok' | 'unavailable';

export interface Attempt {
    /** The exam or quiz id. */
    subject: string;
    /** Its title, where `/assessment-titles/` could name it. */
    title: string;
    score: number;
    passed: boolean;
    at: string;
    /** How many times they sat it. `bestAttempts` folds the rest away. */
    attempts: number;
}

export interface Credential {
    id: string;
    title: string;
    kind: 'course' | 'exam';
    at: string;
}

export interface LabRow {
    id: string;
    title: string;
    status: string;
    points: number;
}

export interface PlanRow {
    title: string;
    expires: string;
    features: string[];
}

export interface AppointmentRow {
    exam: string;
    at: string;
    status: string;
}

export interface SnapshotSection<T> {
    state: SectionState;
    rows: T[];
}

export interface StudentSnapshot {
    username: string;
    fullName: string;
    quizzes: SnapshotSection<Attempt>;
    exams: SnapshotSection<Attempt>;
    certificates: SnapshotSection<Credential>;
    courses: SnapshotSection<CatalogueEntry>;
    labs: SnapshotSection<LabRow>;
    plan: SnapshotSection<PlanRow>;
    appointments: SnapshotSection<AppointmentRow>;
}

export function emptySnapshot(username = '', fullName = ''): StudentSnapshot {
    const pending = <T>(): SnapshotSection<T> => ({ state: 'pending', rows: [] });
    return {
        username, fullName,
        quizzes: pending(), exams: pending(), certificates: pending(),
        courses: pending(), labs: pending(), plan: pending(), appointments: pending(),
    };
}

/** True once nothing is still loading — what the dock waits for before asking. */
export function snapshotSettled(snapshot: StudentSnapshot): boolean {
    return ([snapshot.quizzes, snapshot.exams, snapshot.certificates,
             snapshot.courses, snapshot.labs, snapshot.plan, snapshot.appointments]
        .every(s => s.state !== 'pending'));
}

/**
 * One attempt per assessment — the best, earliest on a tie.
 *
 * The same rule and the same reason as `bestAttempts` in `leaderboardEngine.ts`
 * and `dashboardProgress.ts`: counting every attempt means somebody who re-sat
 * one quiz eleven times is told they have "11 quizzes passed" and shown an
 * average dragged down by their own early tries. Earliest on a tie so the date
 * she quotes is the day they first got there.
 *
 * `attempts` is kept rather than discarded, because "your best of four attempts"
 * is a materially different sentence from "your score", and a student who has
 * sat something four times knows it.
 */
export function bestAttempts(rows: Attempt[]): Attempt[] {
    const best = new Map<string, Attempt>();
    for (const row of rows) {
        const seen = best.get(row.subject);
        if (!seen) {
            best.set(row.subject, { ...row, attempts: 1 });
            continue;
        }
        const better = row.score > seen.score
            || (row.score === seen.score && row.at !== '' && row.at < seen.at);
        best.set(row.subject, {
            ...(better ? row : seen),
            attempts: seen.attempts + 1,
        });
    }
    // Newest first, broken on the subject id. A comparator that can call two
    // rows equal is a list that reorders itself between two questions about it,
    // because it is rebuilt per turn — the trap `sortLabs`, `examShuffle` and
    // `sortScene` all document.
    return [...best.values()].sort((a, b) => {
        if (a.at !== b.at) return a.at < b.at ? 1 : -1;
        return a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0;
    });
}

/** Rows a prompt can afford, per section. */
export const MAX_ROWS = 40;

function pct(value: number): string {
    return `${Math.round(value * 10) / 10}%`;
}

function day(value: string): string {
    // The ISO date only. A prompt does not need the milliseconds, and the model
    // renders the date in the reader's own language anyway.
    return (value || '').slice(0, 10);
}

/**
 * A section, or the sentence that says why it is not there.
 *
 * The `unavailable` wording is the point of the whole three-state design: told
 * "(none)", a model says "you have no certificates", which is a claim. Told
 * "could not be read just now", it says so, and the reader retries instead of
 * opening a support ticket about missing credentials.
 */
function sectionLines<T>(name: string, section: SnapshotSection<T>,
                         render: (row: T) => string): string[] {
    if (section.state === 'unavailable') {
        return [`${name}: COULD NOT BE READ just now — say so if asked; do not say they have none.`];
    }
    if (section.state === 'pending') {
        return [`${name}: still loading — say you are still fetching it.`];
    }
    if (!section.rows.length) return [`${name}: none yet.`];
    const rows = section.rows.slice(0, MAX_ROWS).map(render);
    const more = section.rows.length > MAX_ROWS
        ? [`  …and ${section.rows.length - MAX_ROWS} more`]
        : [];
    return [`${name}:`, ...rows.map(r => `  ${r}`), ...more];
}

/**
 * The student's record, as prompt text.
 *
 * Bounded on purpose: every provider in the rotation refuses a body past its
 * own size limit, and `aiprovider.call_ai` then LEARNS that limit for the
 * model — so one student with three hundred attempts would degrade the model
 * line-up for every other AI feature on the replica. Forty rows a section is
 * about 1,200 tokens at the worst.
 */
export function summariseStudent(snapshot: StudentSnapshot): string {
    if (!snapshot.username) {
        return 'THE READER IS NOT SIGNED IN. You cannot look anything up about '
            + 'them. Offer to explain the platform, and point them at Sign in '
            + '(target `login`) or Create account (target `register`) when they '
            + 'ask about their own records.';
    }

    const lines: string[] = [
        `THE READER: ${snapshot.fullName || snapshot.username} (username ${snapshot.username}).`,
        '',
        'THEIR RECORD — quote these figures exactly, never estimate one:',
    ];

    lines.push(...sectionLines('Courses they are enrolled in', snapshot.courses,
        c => `${c.title} [id ${c.id}]`));
    lines.push(...sectionLines('Quiz results (best attempt each)', snapshot.quizzes,
        q => `${q.title || 'an unnamed quiz'} — ${pct(q.score)} ${q.passed ? 'PASSED' : 'FAILED'}`
            + ` on ${day(q.at)}${q.attempts > 1 ? ` (best of ${q.attempts} attempts)` : ''}`));
    lines.push(...sectionLines('Exam results (best attempt each)', snapshot.exams,
        e => `${e.title || 'an unnamed exam'} — ${pct(e.score)} ${e.passed ? 'PASSED' : 'FAILED'}`
            + ` on ${day(e.at)}${e.attempts > 1 ? ` (best of ${e.attempts} attempts)` : ''}`));
    lines.push(...sectionLines('Certificates', snapshot.certificates,
        c => `${c.title} (${c.kind}) issued ${day(c.at)}`));
    lines.push(...sectionLines('Labs', snapshot.labs,
        l => `${l.title} [id ${l.id}] — ${l.status}, ${l.points} points`));
    lines.push(...sectionLines('Subscription', snapshot.plan,
        p => `${p.title} — expires ${day(p.expires)}; includes ${p.features.join(', ') || 'nothing recorded'}`));
    lines.push(...sectionLines('Upcoming exam appointments', snapshot.appointments,
        a => `${a.exam} on ${day(a.at)} — ${a.status}`));

    return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * The prompt
 * ------------------------------------------------------------------ */

export interface PromptContext {
    snapshot: StudentSnapshot;
    access: Access;
    /** Where the reader is right now, so "take me back" and "what is this page" work. */
    currentPath: string;
    /** From the client's catalogues, so the model can only name ids that exist. */
    courses: CatalogueEntry[];
    labs: CatalogueEntry[];
    runbooks: CatalogueEntry[];
}

function catalogueLines(name: string, rows: CatalogueEntry[], limit: number): string {
    if (!rows.length) return `${name}: none loaded.`;
    const shown = rows.slice(0, limit).map(r => `  ${r.id} = ${r.title}`);
    const more = rows.length > limit ? [`  …and ${rows.length - limit} more`] : [];
    return [`${name}:`, ...shown, ...more].join('\n');
}

/**
 * Everything she is told, once per turn.
 *
 * Rebuilt per turn rather than cached because the snapshot fills in behind her
 * and the reader moves between pages while talking to her — a prompt built when
 * the dock opened would answer "what is this page" about the page they were on
 * three clicks ago.
 *
 * The word JSON is in here deliberately and must stay: app 27's `call_ai`
 * wrapper detects it and appends the JSON language directive rather than the
 * prose one, which is what keeps the KEYS English while translating the VALUES.
 * Told plainly "answer in Chinese", a model renames `say` to `说`, the reply
 * parses, nothing raises, and every bubble comes out empty. That is
 * `language.py`'s own most-likely-failure warning and it applies exactly here.
 */
export function buildSystemPrompt(ctx: PromptContext): string {
    const list = visibleDestinations(ctx.access)
        .map(d => `  ${d.id} — ${d.label}: ${d.about}`)
        .join('\n');

    return `You are ${ASSISTANT_NAME}, the assistant for Self Study Jo — an online
learning platform with courses and lessons, quizzes and proctored exams,
certificates, hands-on labs, a network simulator, a CV builder, a mock job
interview room, a Toastmasters practice meeting, an AI chat assistant, a
research workspace, a shared drawing board, messaging between students, a public
leaderboard and an hourly world-news bulletin. You are warm, brief and exact.

WHAT YOU DO
  * Explain what the platform and any of its pages are for.
  * Take the reader to a page, by returning an action.
  * Report back what the platform already knows about THEM — their results,
    certificates, courses, labs, plan and appointments — from the record below.

WHAT YOU MUST NOT DO
  * Never answer or work out an exam question, a quiz question, a lab task or a
    homework. Not a hint at the answer, not "the answer is probably", not a
    worked example of the same question with the numbers changed. Working it out
    is the part that teaches them something, and a platform whose own assistant
    sits the paper is not a platform anybody's certificate means anything on.
    Offer the lesson, the runbook or the lab brief instead.
  * Never invent a figure. If the record below does not have it, say you could
    not find it and offer the page that would show it.
  * Never invent a page, a course, a lab or an id. Only the ids listed here
    exist; anything else is dropped and the reader gets a dead end.
  * Never claim they have none of something the record says COULD NOT BE READ.

HOW YOU ANSWER — reply with ONE JSON object and nothing else:

  {"say": "<what to tell them, 1-4 short sentences>",
   "action": {"kind": "<one of the kinds below>", ...}}

  {"kind": "none"}                              — just talking
  {"kind": "navigate", "target": "<page id>"}   — a page from the list below
  {"kind": "open_course", "id": "<course id>"}  — one of their courses
  {"kind": "open_lab", "id": "<lab id>"}        — one lab
  {"kind": "open_runbook", "id": "<runbook id>"}

  Include an action whenever the reader asked to GO somewhere or would obviously
  want to. Answer the question in "say" as well — never reply with only a
  button, and never say "click the button below": the reader may be listening
  rather than looking.

PAGES YOU MAY SEND THEM TO (use the id on the left as "target"):
${list}

${catalogueLines('COURSES (for open_course)', ctx.courses, 40)}

${catalogueLines('LABS (for open_lab)', ctx.labs, 60)}

${catalogueLines('RUNBOOKS (for open_runbook)', ctx.runbooks, 30)}

THEY ARE CURRENTLY ON: ${ctx.currentPath || '/'}

${summariseStudent(ctx.snapshot)}`;
}

/* ------------------------------------------------------------------ *
 * Talking rather than typing
 * ------------------------------------------------------------------ */

/** How long the transcript must stop growing before a spoken turn is sent. */
export const AUTO_SEND_SILENCE_MS = 2200;
/** Below this a "sentence" is a cough, a keyboard click or a door. */
export const AUTO_SEND_MIN_CHARS = 2;

/**
 * Has the reader finished speaking?
 *
 * The whole of hands-free mode, and it is here rather than in the component
 * because both of its failure modes are invisible in a screenshot: too short a
 * pause cuts somebody off mid-question and sends half of it, and too long makes
 * the assistant look broken while they wait. 2.2 seconds is a deliberate
 * compromise — a natural pause between clauses is under a second, and a
 * three-second gap reads as "she is not listening".
 *
 * `chars` rather than `words`, because `'这是什么'.split()` has length one and a
 * word floor would refuse every Chinese question — the fault `count_words` was
 * written for, arriving from a third direction.
 */
export function shouldAutoSend(text: string, msSinceGrowth: number): boolean {
    const value = (text || '').trim();
    if (value.length < AUTO_SEND_MIN_CHARS) return false;
    return msSinceGrowth >= AUTO_SEND_SILENCE_MS;
}

/* ------------------------------------------------------------------ *
 * Copy
 * ------------------------------------------------------------------ */

/**
 * What she opens with, and the four things worth trying.
 *
 * English catalogue KEYS, reached through these constants for the same reason
 * {@link REFUSAL} is: `$t` on a variable leaves no literal in any source file,
 * so `check:i18n` verifies them against this table instead of reporting them as
 * orphans.
 */
export const GREETING_SIGNED_IN = 'Hi {name} — I am Noor. Ask me about anything on '
    + 'Self Study Jo, or tell me where you want to go and I will take you there.';
export const GREETING_SIGNED_OUT = 'Hi — I am Noor, the Self Study Jo assistant. Ask '
    + 'me what the platform does or where to find something. Sign in and I can look '
    + 'up your own results too.';

export const SUGGESTIONS_SIGNED_IN = [
    'What is Self Study Jo?',
    'Show me my quiz results',
    'Take me to the labs',
    'When does my plan expire?',
];

export const SUGGESTIONS_SIGNED_OUT = [
    'What is Self Study Jo?',
    'What can I learn here?',
    'Take me to the courses',
    'How do the labs work?',
];

/**
 * What the plate under her says. Reached as `$t(stateLabel)`.
 *
 * A table rather than four `$t('…')` calls in a computed, so `check:i18n` can
 * verify all four the same way it verifies the badges and the tour captions —
 * and so a fifth state cannot be added without its copy.
 */
export const STATE_LABELS = {
    idle: 'here to help',
    thinking: 'thinking…',
    speaking: 'speaking',
    listening: 'listening…',
} as const;

/**
 * The two states of the "read her replies aloud" toggle.
 *
 * A table rather than `$t(on ? 'Voice on' : 'Voice off')` in the template, and
 * this one is not a style preference: `check:i18n`'s orphan scan recognises
 * `$t('literal')` and does NOT see a literal inside a ternary, so both strings
 * were translated, present in both catalogues, and reported as orphans — which
 * is the report saying "these have silently reverted to English" about strings
 * that were about to do exactly that if anybody reworded them.
 */
export const VOICE_LABELS = { on: 'Voice on', off: 'Voice off' } as const;

/**
 * The three things that go wrong, as named constants.
 *
 * **Not written inline at the call site, and the reason is a bug the coverage
 * scan caught rather than a preference.** Written as
 * `t('I could not open your ' + 'microphone…')` the RUNTIME key is the joined
 * sentence while every scanner — the coverage report, the orphan pass, the
 * wrap codemod — sees only the first fragment. So the catalogue would be keyed
 * on half a sentence, the lookup would miss, and the message would render in
 * English in both languages for ever, with `check:i18n` reporting the fragment
 * as the untranslated key and nobody able to work out why translating it
 * changed nothing.
 *
 * MIC_FAILED deliberately does not say "permission denied". `getUserMedia` has
 * at least six distinct failures and only one of them is a refusal; telling
 * somebody whose microphone is held by another application to grant a
 * permission they have already granted sends them to the one place that cannot
 * help. `utils/mediaDevices.ts` makes the same point at length.
 */
export const MIC_FAILED = 'I could not open your microphone. Check that one is connected, '
    + 'that this site is allowed to use it, and that another application is not holding it.';
export const NO_ANSWER = 'I did not get an answer that time. Ask me again?';
export const SERVICE_BUSY = 'The assistant is out of capacity just now. Try again in a moment.';
export const SERVICE_UNREACHABLE = 'I could not reach the assistant service. '
    + 'Check your connection and try again.';

/**
 * Every catalogue key this module owns, for `check:i18n` to verify.
 *
 * DERIVED from the constants rather than written out a second time — a
 * hand-copied list is what goes stale the day somebody rewords one of them,
 * and the symptom is a sentence that silently reverts to English in both
 * languages. Same rule `TOUR_KEYS` and `PRACTICE_KEYS` follow.
 */
export const ASSISTANT_KEYS: readonly string[] = [...new Set([
    REFUSAL, GREETING_SIGNED_IN, GREETING_SIGNED_OUT,
    MIC_FAILED, NO_ANSWER, SERVICE_BUSY, SERVICE_UNREACHABLE,
    ...Object.values(STATE_LABELS), ...Object.values(VOICE_LABELS),
    // Deduped: "What is Self Study Jo?" is offered to a signed-in reader AND to
    // a signed-out one, deliberately — it is the first thing anybody asks
    // either way — so the two lists genuinely overlap and a straight spread
    // would count it twice. `LAB_STRINGS` in `check:i18n` does the same.
    ...SUGGESTIONS_SIGNED_IN, ...SUGGESTIONS_SIGNED_OUT,
])];

/* ------------------------------------------------------------------ *
 * Messages
 * ------------------------------------------------------------------ */

export interface AssistantMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    action?: ResolvedAction | null;
    /** Set on a bubble that failed, so Retry knows which one to resend. */
    failed?: boolean;
    at: number;
}

/**
 * A message id minted in the browser.
 *
 * Same reason as `newMessageId` in `aichatRooms.ts`: it is what makes a Retry
 * an update of the bubble that failed rather than a second copy of the same
 * question in the transcript.
 */
export function newMessageId(): string {
    const cryptoRef = (globalThis as { crypto?: Crypto }).crypto;
    if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
    return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * How many turns of history go to the model.
 *
 * Bounded for the reason the snapshot is: an unbounded transcript is a body
 * that eventually trips a provider's size limit, and `call_ai` then learns that
 * limit for the model and degrades every other AI feature on the replica. Eight
 * turns is enough for "and the other one?" to make sense.
 */
export const HISTORY_TURNS = 8;

export function historyFor(messages: AssistantMessage[]): AssistantMessage[] {
    return messages.filter(m => !m.failed && m.content.trim()).slice(-HISTORY_TURNS * 2);
}
