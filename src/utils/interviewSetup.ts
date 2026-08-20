/**
 * The Job Interview setup model: what a redo carries over, what the interviewer
 * is told about the candidate, and which fallback question comes next.
 *
 * Plain module -- no Vue, no DOM, no network -- for the same reason
 * `appNav.ts`, `linkify.ts`, `proctorQueue.ts` and `newscastEngine.ts` are: the
 * three properties that matter here are invariants over arbitrary input, and
 * none of them is visible by running one interview once.
 *
 *   1. A redo must produce DIFFERENT questions. The AI is told which ones were
 *      already asked, and when the AI is unavailable the fallback pool has to
 *      rotate too -- otherwise "redo" hands back the identical ten questions
 *      and the feature does nothing on exactly the day the AI is down.
 *   2. Within one interview no fallback question may repeat, at any attempt
 *      number. That is a property of the rotation arithmetic, not of the pool.
 *   3. A CV digest must fit the prompt budget whatever CV it is given, and cut
 *      on a line boundary -- half a sentence about a previous employer reads to
 *      the model as a fact about the candidate.
 *
 * Verified by `npm run check:interview`.
 */

// ============ CONFIG ============

export type InterviewType = 'Technical' | 'HR';

/**
 * What the pre-session page hands to the interview room, via sessionStorage.
 *
 * It is the config -- not component state -- that survives a reload mid-interview,
 * which is why who is conducting it lives here (see JobInterviewSession.vue) and
 * why the CV is carried as already-rendered TEXT rather than as an id: the room
 * must not have to reach app 33 again to know who it is talking to.
 */
export interface InterviewConfig {
    type: InterviewType;
    topic: string;
    qualifications: string;
    minutes: number;
    /** Which of the six conducts it; see src/cast/actors.ts. */
    interviewer?: string;
    /** The CV the candidate attached, if any. */
    cvId?: string;
    cvTitle?: string;
    /** The CV rendered for the interviewer to read. Never the raw record. */
    cvSummary?: string;
    /** 1 for a fresh interview, 2+ for a redo of the same role and requirements. */
    attempt?: number;
    /** Questions this candidate has already been asked on this topic. */
    avoidQuestions?: string[];
}

/** The shape a past session has to have for a redo to be built from it. */
export interface PastSession {
    interview_type?: string;
    topic?: string;
    qualifications?: string;
    planned_minutes?: number;
    attempt?: number;
    cv_id?: string;
    cv_title?: string;
    cv_summary?: string;
    created_at?: string;
    qa_pairs?: { question?: string }[] | null;
}

export const MIN_MINUTES = 3;
export const MAX_MINUTES = 60;
export const MIN_QUESTIONS = 4;
export const MAX_QUESTIONS = 12;

/**
 * How much of a CV the interviewer is given.
 *
 * It rides along on EVERY question call, not just the intro, because the model
 * is stateless and a CV mentioned once at the start is a CV forgotten by
 * question three. So the budget is per-call and deliberately modest: app 27's
 * question prompt already carries the qualifications and the last five answers.
 */
export const CV_DIGEST_LIMIT = 2600;

/**
 * How many previously-asked questions travel with a redo.
 *
 * Capped because they are spent on every question call. Twenty-four is two
 * full interviews' worth, which is the point at which a candidate redoing a
 * third time is genuinely running out of unasked ground and the model should
 * be free to revisit an area from a different angle.
 */
export const MAX_AVOID_QUESTIONS = 24;

export function clampMinutes(minutes: unknown): number {
    const n = Math.round(Number(minutes));
    if (!Number.isFinite(n)) return 15;
    return Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, n));
}

/** The number of questions a given duration is worth. */
export function questionCountFor(minutes: unknown): number {
    const m = clampMinutes(minutes);
    return Math.max(MIN_QUESTIONS, Math.min(MAX_QUESTIONS, Math.round(m / 1.5)));
}

export function normaliseType(value: unknown): InterviewType {
    return String(value ?? '').trim().toUpperCase() === 'HR' ? 'HR' : 'Technical';
}

// ============ QUESTION DEDUPE ============

/**
 * A question reduced to what makes it the same question.
 *
 * Used to decide whether a redo is repeating itself. Case, punctuation and
 * whitespace are dropped because the AI re-asks the same question with a
 * different comma constantly, and a dedupe that misses that is a dedupe that
 * lets the redo hand back the interview the candidate just sat.
 */
export function normaliseQuestion(question: unknown): string {
    return String(question ?? '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Every question this candidate has already been asked on the same ground,
 * newest first.
 *
 * Matched on interview TYPE and topic rather than on the session id, because
 * the thing a redo must not repeat is a question about this role -- whichever
 * sitting it came from. An HR interview and a Technical one for the same topic
 * are different ground and do not filter each other.
 */
export function askedQuestionsFrom(
    sessions: PastSession[] | null | undefined,
    match: { type: unknown; topic: unknown },
    limit = MAX_AVOID_QUESTIONS,
): string[] {
    const wantType = normaliseType(match.type);
    const wantTopic = String(match.topic ?? '').trim().toLowerCase();

    const relevant = (sessions || [])
        .filter(s => normaliseType(s.interview_type) === wantType)
        .filter(s => String(s.topic ?? '').trim().toLowerCase() === wantTopic)
        // Newest first, so a cap keeps the most recent interview's questions --
        // the ones the candidate would most obviously notice being re-asked.
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));

    const seen = new Set<string>();
    const out: string[] = [];
    for (const session of relevant) {
        for (const qa of session.qa_pairs || []) {
            const question = String(qa?.question ?? '').trim();
            if (!question) continue;
            const key = normaliseQuestion(question);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(question);
            if (out.length >= Math.max(0, limit)) return out;
        }
    }
    return out;
}

/**
 * The config for sitting the same interview again.
 *
 * Same role, same requirements, same attached CV, same duration -- which is the
 * whole feature: re-typing a page of job requirements to practise the same role
 * twice is why nobody practises the same role twice. What does NOT carry over
 * is the interviewer (a different person each sitting is closer to the real
 * thing, and the caller passes one in) and the questions.
 */
export function redoConfigFrom(
    session: PastSession,
    extra: { interviewer?: string; avoidQuestions?: string[]; minutes?: number } = {},
): InterviewConfig {
    const type = normaliseType(session.interview_type);
    const topic = String(session.topic ?? '').trim();
    return {
        type,
        topic: topic || (type === 'HR' ? 'HR / General' : ''),
        qualifications: String(session.qualifications ?? '').trim(),
        minutes: clampMinutes(extra.minutes ?? session.planned_minutes),
        interviewer: extra.interviewer,
        cvId: String(session.cv_id ?? '') || undefined,
        cvTitle: String(session.cv_title ?? '') || undefined,
        cvSummary: String(session.cv_summary ?? '') || undefined,
        // A session written before this existed has no attempt number and is
        // attempt 1 by definition, so its redo is 2.
        attempt: Math.max(1, Math.round(Number(session.attempt) || 1)) + 1,
        avoidQuestions: (extra.avoidQuestions || []).slice(0, MAX_AVOID_QUESTIONS),
    };
}

// ============ FALLBACK QUESTIONS ============

/**
 * Twelve, not ten, and that is arithmetic rather than taste: `questionCountFor`
 * tops out at {@link MAX_QUESTIONS}, so a pool shorter than that repeats a
 * question inside a single 60-minute interview.
 */
export const HR_FALLBACKS: readonly string[] = [
    'Tell me about yourself and your professional background.',
    'Why are you interested in this role and our company?',
    'Describe a challenging situation at work and how you handled it.',
    'What are your greatest strengths, and one area you are working to improve?',
    'Tell me about a time you worked in a team to achieve a difficult goal.',
    'Where do you see yourself in five years?',
    'How do you handle pressure and competing deadlines?',
    'Why should we hire you over other candidates?',
    'Describe a time you received difficult feedback. How did you respond?',
    'Tell me about a time you disagreed with a manager or a colleague. What did you do?',
    'Describe a decision you made with incomplete information.',
    'What kind of working environment brings out your best work?',
];

export function techFallbacks(topic: string): string[] {
    const role = String(topic || '').trim() || 'this field';
    return [
        `Can you walk me through your hands-on experience related to ${role}?`,
        `What core concepts should every ${role} professional master, and why?`,
        `Describe the most difficult technical problem you solved involving ${role}.`,
        `How do you approach debugging a complex, intermittent issue in ${role}?`,
        `What best practices and design principles do you follow when working with ${role}?`,
        `How do you keep your ${role} skills current with industry changes?`,
        `Describe a project where you applied ${role} and the impact it had.`,
        `What tools, frameworks or technologies do you rely on for ${role} work?`,
        `How would you explain a complex ${role} concept to a non-technical stakeholder?`,
        `Tell me about a trade-off decision you made in a ${role} project.`,
        `How do you test and validate your work in a ${role} context?`,
        `Where do you think ${role} is heading over the next few years, and how are you preparing?`,
    ];
}

/**
 * Coprime with the pool length, which is what makes the rotation work.
 *
 * The offset has to be coprime with 12 or successive attempts land on a subset
 * of the pool and the redo starts repeating early -- an offset of 4 would give
 * attempts 1 and 4 the identical interview. 5 walks the whole pool before
 * coming back, so a candidate gets twelve distinct openings before any repeat.
 */
const ATTEMPT_STRIDE = 5;

/**
 * The question to ask when the AI could not be reached.
 *
 * Rotated by attempt, because a redo whose fallback is the same list in the
 * same order is not a redo. Rotated by a stride rather than reshuffled so that
 * it stays a pure function of (type, topic, qnum, attempt) -- the interview room
 * re-derives this after a reload, and a random order would hand the candidate a
 * different question than the one they were part-way through answering.
 */
export function fallbackQuestion(
    type: unknown, topic: string, questionNumber: number, attempt = 1,
): string {
    const pool = normaliseType(type) === 'HR' ? HR_FALLBACKS : techFallbacks(topic);
    const n = Math.max(1, Math.round(Number(questionNumber) || 1));
    const a = Math.max(1, Math.round(Number(attempt) || 1));
    const offset = (a - 1) * ATTEMPT_STRIDE;
    const index = (n - 1 + offset) % pool.length;
    return pool[index];
}

// ============ CV DIGEST ============

/** Only the parts of a CV record this module reads. Mirrors cvbuilder.service.ts. */
export interface DigestibleCv {
    title?: string;
    personal?: {
        full_name?: string; headline?: string; summary?: string;
        location?: string; nationality?: string;
    } | null;
    experience?: {
        role?: string; company?: string; location?: string;
        start?: string; end?: string; current?: boolean;
        description?: string; bullets?: string[]; tech?: string[];
    }[] | null;
    education?: {
        degree?: string; field?: string; institution?: string;
        start?: string; end?: string; grade?: string;
    }[] | null;
    skills?: { category?: string; items?: string[] }[] | null;
    projects?: { name?: string; description?: string; tech?: string[] }[] | null;
    certifications?: { name?: string; issuer?: string; date?: string }[] | null;
    languages?: { name?: string; level?: string }[] | null;
}

function clean(value: unknown): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function dateRange(start: unknown, end: unknown, current?: boolean): string {
    const from = clean(start);
    const to = current ? 'present' : clean(end);
    if (!from && !to) return '';
    return `${from || '?'} - ${to || 'present'}`;
}

/**
 * A CV rendered for an interviewer to read aloud from.
 *
 * Plain text rather than JSON, and that is deliberate on two counts: it is
 * roughly 40% fewer characters for the same content, and the model is being
 * asked to interview from it rather than to edit it -- app 33's `_cv_digest`
 * sends JSON precisely because its model has to patch the record back.
 *
 * Nothing contactable goes in. Email, phone, links and date of birth are not
 * things an interviewer asks about, and a prompt is the last place to put a
 * candidate's phone number.
 *
 * Truncation drops WHOLE LINES from the end rather than cutting mid-sentence:
 * half a bullet about a previous employer reads to the model as a completed
 * fact, and the questions it then asks are about something the candidate never
 * claimed.
 */
export function cvDigest(cv: DigestibleCv | null | undefined, limit = CV_DIGEST_LIMIT): string {
    if (!cv) return '';
    const cap = Math.max(200, Math.round(Number(limit) || CV_DIGEST_LIMIT));
    const lines: string[] = [];

    const personal = cv.personal || {};
    const name = clean(personal.full_name);
    const headline = clean(personal.headline);
    if (name || headline) {
        lines.push(`Candidate: ${[name, headline].filter(Boolean).join(' — ')}`);
    }
    const where = clean(personal.location);
    if (where) lines.push(`Location: ${where}`);

    const summary = clean(personal.summary);
    if (summary) lines.push(`Profile: ${summary}`);

    const experience = (cv.experience || []).filter(Boolean);
    if (experience.length) {
        lines.push('Experience:');
        for (const role of experience) {
            const title = clean(role.role) || 'Role';
            const company = clean(role.company);
            const when = dateRange(role.start, role.end, role.current);
            const head = [title, company && `at ${company}`, when && `(${when})`]
                .filter(Boolean).join(' ');
            lines.push(`- ${head}`);
            // Three bullets per role. A CV with eight roles and six bullets each
            // is 48 lines, and the ones past the third are where a CV starts
            // repeating itself -- the budget is better spent reaching the older
            // roles at all than on exhausting the newest one.
            const bullets = (role.bullets || []).map(clean).filter(Boolean).slice(0, 3);
            if (!bullets.length) {
                const description = clean(role.description);
                if (description) lines.push(`  · ${description}`);
            }
            for (const bullet of bullets) lines.push(`  · ${bullet}`);
            const tech = (role.tech || []).map(clean).filter(Boolean);
            if (tech.length) lines.push(`  · Tech: ${tech.join(', ')}`);
        }
    }

    const skills = (cv.skills || []).filter(Boolean);
    if (skills.length) {
        lines.push('Skills:');
        for (const group of skills) {
            const items = (group.items || []).map(clean).filter(Boolean);
            if (!items.length) continue;
            lines.push(`- ${clean(group.category) || 'General'}: ${items.join(', ')}`);
        }
    }

    const education = (cv.education || []).filter(Boolean);
    if (education.length) {
        lines.push('Education:');
        for (const entry of education) {
            const what = [clean(entry.degree), clean(entry.field)].filter(Boolean).join(' in ');
            const at = clean(entry.institution);
            const when = dateRange(entry.start, entry.end);
            lines.push(`- ${[what || 'Studies', at && `— ${at}`, when && `(${when})`]
                .filter(Boolean).join(' ')}`);
        }
    }

    const projects = (cv.projects || []).filter(Boolean).slice(0, 5);
    if (projects.length) {
        lines.push('Projects:');
        for (const project of projects) {
            const description = clean(project.description);
            const tech = (project.tech || []).map(clean).filter(Boolean);
            lines.push(`- ${clean(project.name) || 'Project'}${description ? `: ${description}` : ''}${
                tech.length ? ` [${tech.join(', ')}]` : ''}`);
        }
    }

    const certifications = (cv.certifications || []).map(c => clean(c?.name)).filter(Boolean);
    if (certifications.length) lines.push(`Certifications: ${certifications.join(', ')}`);

    const languages = (cv.languages || [])
        .map(l => [clean(l?.name), clean(l?.level)].filter(Boolean).join(' (') + (clean(l?.level) ? ')' : ''))
        .filter(s => s && s !== '');
    if (languages.length) lines.push(`Languages: ${languages.join(', ')}`);

    // Assemble under budget, dropping whole lines off the end.
    const out: string[] = [];
    let used = 0;
    for (const line of lines) {
        const cost = line.length + (out.length ? 1 : 0);
        if (used + cost > cap) break;
        out.push(line);
        used += cost;
    }
    return out.join('\n');
}

/** A one-line label for a CV in the picker and on a past result. */
export function cvLabel(cv: { title?: string; full_name?: string; headline?: string } | null | undefined): string {
    if (!cv) return '';
    const title = clean(cv.title) || 'Untitled CV';
    const who = clean(cv.headline) || clean(cv.full_name);
    return who ? `${title} — ${who}` : title;
}
