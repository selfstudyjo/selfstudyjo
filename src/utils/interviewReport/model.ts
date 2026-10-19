/**
 * The Job Interview report as a DOCUMENT: what goes in it, in what order, and
 * with which words.
 *
 * Plain module -- no Vue, no DOM, no network -- on the `interviewSetup.ts`
 * precedent, because both writers (`docx.ts` and `pdfLayout.ts`) read this and
 * nothing else. Deciding the content once is what keeps the two files the same
 * report: a section added to one writer and not the other is a PDF and a Word
 * document that disagree about what the candidate was told.
 *
 * Three rules worth not undoing, each checked by `npm run check:interviewreport`:
 *
 *   1. NOTHING IS INVENTED. An empty field is left out, never filled with a
 *      placeholder sentence. A report that says "No red flags" when the
 *      evaluator returned nothing is claiming a judgement nobody made.
 *   2. THE CANDIDATE'S WORDS ARE KEPT VERBATIM, control characters aside. The
 *      answer is the record of what they said; tidying it is editing it.
 *   3. LABELS COME FROM THE CALLER'S `tr`, content comes from the record. The
 *      labels follow the reader's language; the content is whatever language
 *      the interview was conducted in, and each paragraph is laid out in its
 *      OWN direction (`textDir`), so an English answer inside an Arabic report
 *      still reads left to right.
 */

export type Dir = 'ltr' | 'rtl';
export type Tone = 'good' | 'mid' | 'low';

/** Only the parts of a stored session the report reads. */
export interface ReportSession {
    user_full_name?: string;
    username?: string;
    interview_type?: string;
    topic?: string;
    qualifications?: string;
    cv_title?: string;
    attempt?: number;
    created_at?: string;
    duration_seconds?: number;
    planned_minutes?: number;
    planned_questions?: number;
    question_source?: string;
    custom_questions?: string[] | null;
    status?: string;
    score?: number;
    summary?: string;
    strengths?: string;
    improvements?: string;
    technical_assessment?: string;
    communication?: string;
    recommendation?: string;
    action_plan?: string[] | null;
    standout_moment?: string;
    red_flags?: string;
    score_breakdown?: Record<string, number | undefined> | null;
    qa_pairs?: ReportQa[] | null;
}

export interface ReportQa {
    question?: string;
    answer?: string;
    seconds?: number;
    source?: string;
    model_answer?: string;
    coaching?: {
        model_answer?: string;
        improved_answer?: string;
        feedback?: string;
        fix?: string;
        why?: string;
        key_points?: string[];
        rating?: number | null;
        generic?: boolean;
    } | null;
}

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface MetaItem { label: string; value: string }
export interface Dimension { label: string; value: number }

export interface ReportQuestion {
    number: number;
    text: string;
    /** The candidate wrote this question themselves. */
    own: boolean;
    rating: number | null;
    tone: Tone | null;
    answer: string;
    seconds: number;
    feedback: string;
    improved: string;
    model: string;
    fix: string;
    why: string;
    keyPoints: string[];
}

export interface ReportModel {
    /** The direction of the REPORT -- labels, layout. Content has its own. */
    dir: Dir;
    lang: string;
    brand: string;
    title: string;
    candidate: string;
    subtitle: string;
    meta: MetaItem[];
    score: number | null;
    scoreTone: Tone | null;
    recommendation: string;
    breakdown: Dimension[];
    summary: string;
    standout: string;
    redFlags: string;
    strengths: string;
    improvements: string;
    assessmentTitle: string;
    assessment: string;
    communication: string;
    actionPlan: string[];
    questions: ReportQuestion[];
    /** Every heading and caption, already in the reader's language. */
    labels: Record<LabelKey, string>;
    fileBase: string;
    generatedOn: string;
    /** The interview was not finished; said once, at the top. */
    unfinished: boolean;
}

export type LabelKey =
    | 'overall' | 'outOf' | 'recommendation' | 'breakdown' | 'summary' | 'standout'
    | 'redFlags' | 'strengths' | 'improvements' | 'communication' | 'actionPlan'
    | 'coaching' | 'coachingLead' | 'question' | 'yourQuestion' | 'yourAnswer'
    | 'noAnswer' | 'feedback' | 'improved' | 'improvedLead' | 'model' | 'modelLead'
    | 'fix' | 'why' | 'keyPoints' | 'rating' | 'footer' | 'page' | 'unfinished'
    | 'noQuestions' | 'generated';

/** The five score dimensions, in a fixed order -- the room's own order. */
export const DIMENSIONS: readonly { key: string; label: string }[] = [
    { key: 'structure', label: 'Structure' },
    { key: 'relevance', label: 'Relevance' },
    { key: 'depth', label: 'Depth' },
    { key: 'communication', label: 'Communication' },
    { key: 'impact', label: 'Impact' },
];

/**
 * Every English label key this module hands to `tr`. Exported so
 * `check:i18n` and `check:interviewreport` can prove both catalogues cover
 * them -- a key reached through a variable appears in no source file as a
 * literal, so the orphan scan would otherwise report every one of them.
 */
export const LABEL_KEYS: Record<LabelKey, string> = {
    overall: 'Overall score',
    outOf: 'out of 100',
    recommendation: 'Recommendation',
    breakdown: 'Score breakdown',
    summary: 'Summary',
    standout: 'Standout moment',
    redFlags: 'What would worry an interviewer',
    strengths: 'Strengths',
    improvements: 'Areas to improve',
    communication: 'Communication',
    actionPlan: 'Your action plan',
    coaching: 'Question-by-question coaching',
    coachingLead: 'For each question: what you said, feedback on it, your own answer rewritten to be stronger, and a model answer to rehearse.',
    question: 'Question {v0}',
    yourQuestion: 'Your question',
    yourAnswer: 'Your answer',
    noAnswer: 'No answer was captured for this question.',
    feedback: 'Feedback on your answer',
    improved: 'Your answer, improved',
    improvedLead: 'Your facts and examples, told more strongly.',
    model: 'Model answer to rehearse',
    modelLead: 'A short, strong answer you could say out loud.',
    fix: 'The one change that matters most',
    why: 'Why the interviewer asks this',
    keyPoints: 'What a strong answer covers',
    rating: '{v0}/10',
    footer: 'Self Study · Interview Report',
    page: 'Page {v0} of {v1}',
    unfinished: 'This interview was not finished, so the report covers only the questions that were answered.',
    noQuestions: 'No questions were answered.',
    generated: 'Generated {v0}',
};

/** Words a report needs that are not section headings. */
export const OTHER_KEYS = [
    'Interview Report', 'Candidate', 'Interview type', 'Role / topic', 'Date',
    'Duration', 'Questions answered', 'Attempt', 'CV', 'Questions',
    'Technical Assessment', 'Competency Assessment', 'Technical', 'HR',
    'Your own list', 'Your list, then the interviewer’s',
    '{v0} min {v1} s', '{v0} out of {v1}',
    'Structure', 'Relevance', 'Depth', 'Impact',
] as const;

// ---------------------------------------------------------------- text

/**
 * Control characters out, everything else verbatim.
 *
 * A transcript can carry a stray U+0000 or a vertical tab from a paste, and
 * either one makes the DOCX unreadable: XML 1.0 forbids them outright, and Word
 * refuses the whole file rather than the one character.
 */
export function cleanText(value: unknown): string {
    return String(value ?? '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f￾￿]/g, '')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/;
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ぀-ヿ㐀-鿿가-힯]/;

/**
 * The direction a paragraph reads in, from the script that DOMINATES it.
 *
 * A report's content is in the interview's language and its labels in the
 * reader's, so an English answer in an Arabic report must still be laid out
 * left to right -- the job `unicode-bidi: plaintext` does on the page.
 *
 * NOT the first strong character, which is what plaintext uses, and the
 * preview harness is why: a technical answer in Arabic routinely STARTS with a
 * product name ("Docker يبني الحاوية…"), and read by its first letter that
 * whole paragraph was laid out left to right -- every Arabic run in the wrong
 * order, on a page nobody could read.
 *
 * WORDS, not letters -- the second render found that too: "ما الفرق بين Docker
 * و Kubernetes؟" has more Latin LETTERS than Arabic ones, because product names
 * are long and Arabic function words are short, and counted by letter that
 * heading went left to right. By word it is four Arabic to two English. A tie
 * goes to the first strong character, which is the plaintext rule.
 * `fallback` decides a paragraph with no strong character at all ("42%").
 */
export function textDir(text: string, fallback: Dir = 'ltr'): Dir {
    let rtl = 0;
    let ltr = 0;
    let first: Dir | null = null;
    for (const word of text.split(/\s+/)) {
        for (const ch of word) {
            const d: Dir | null = RTL_CHAR.test(ch) ? 'rtl' : LTR_CHAR.test(ch) ? 'ltr' : null;
            if (!d) continue;
            if (d === 'rtl') rtl++; else ltr++;
            first ??= d;
            break;
        }
    }
    if (!first) return fallback;
    if (rtl === ltr) return first;
    return rtl > ltr ? 'rtl' : 'ltr';
}

/** An answer's length as m:ss -- digits only, so an uppercased label cannot turn "74s" into "74S". */
export function clock(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function toneOf(score: number | null | undefined, outOf = 100): Tone | null {
    if (score === null || score === undefined || !Number.isFinite(Number(score))) return null;
    const ratio = Number(score) / outOf;
    if (ratio >= 0.7) return 'good';
    if (ratio >= 0.45) return 'mid';
    return 'low';
}

function clampScore(value: unknown, max: number): number | null {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(max, Math.round(n)));
}

/** A file name a browser and every OS will accept, readable in any script. */
export function safeFileBase(...parts: string[]): string {
    const joined = parts.map(p => cleanText(p)).filter(Boolean).join(' - ');
    const cleaned = joined
        .replace(/[\\/:*?"<>|#%]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 90)
        .trim();
    return (cleaned || 'Interview Report').replace(/ /g, '_');
}

function isoDay(value: string | undefined, now: Date): string {
    const d = value ? new Date(value) : now;
    const ok = !Number.isNaN(d.getTime()) ? d : now;
    return ok.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- model

export interface BuildOptions {
    tr: Translate;
    /** The reader's interface direction and language. */
    dir: Dir;
    lang: string;
    /** Formats a date for the reader. */
    formatDate?: (iso: string) => string;
    now?: Date;
}

export function buildReportModel(session: ReportSession, options: BuildOptions): ReportModel {
    const { tr } = options;
    const now = options.now ?? new Date();
    const fmt = options.formatDate ?? (iso => iso.slice(0, 10));
    const type = String(session.interview_type || '').toUpperCase() === 'HR' ? 'HR' : 'Technical';
    // "HR / General" is what the room stores for an HR interview: a placeholder,
    // not a topic, so it is printed nowhere -- not in the facts, not in the file name.
    const rawTopic = cleanText(session.topic);
    const topic = /^hr \/ general$/i.test(rawTopic) ? '' : rawTopic;
    const candidate = cleanText(session.user_full_name) || cleanText(session.username);

    const labels = {} as Record<LabelKey, string>;
    for (const key of Object.keys(LABEL_KEYS) as LabelKey[]) labels[key] = tr(LABEL_KEYS[key]);

    const qaPairs = (session.qa_pairs || []).filter(qa => qa && cleanText(qa.question));
    const answered = qaPairs.filter(qa => cleanText(qa.answer)).length;
    const own = (session.custom_questions || []).length > 0;

    const meta: MetaItem[] = [];
    const push = (label: string, value: string) => { if (value) meta.push({ label: tr(label), value }); };
    push('Candidate', candidate);
    push('Interview type', tr(type));
    if (topic) push('Role / topic', topic);
    if (session.created_at) push('Date', fmt(session.created_at));
    const secs = Math.max(0, Math.round(Number(session.duration_seconds) || 0));
    if (secs) push('Duration', tr('{v0} min {v1} s', { v0: Math.floor(secs / 60), v1: secs % 60 }));
    // Its own key rather than the shared '{v0} of {v1}', whose Chinese is
    // "item N of M" -- which printed 已回答问题: 第 1 / 1 on the first render.
    push('Questions answered', tr('{v0} out of {v1}', { v0: answered, v1: qaPairs.length }));
    if (own) {
        push('Questions', session.question_source === 'mixed'
            ? tr('Your list, then the interviewer’s') : tr('Your own list'));
    }
    if ((Number(session.attempt) || 1) > 1) push('Attempt', `#${Math.round(Number(session.attempt))}`);
    push('CV', cleanText(session.cv_title));

    const breakdown: Dimension[] = [];
    for (const dim of DIMENSIONS) {
        const v = clampScore(session.score_breakdown?.[dim.key], 100);
        if (v !== null) breakdown.push({ label: tr(dim.label), value: v });
    }

    // A score of 0 with no summary is an evaluation that never ran (an
    // unfinished interview), not a candidate who scored nothing -- drawing a
    // red 0 ring on it would be a judgement nobody made.
    const evaluated = Boolean(cleanText(session.summary) || cleanText(session.recommendation) || breakdown.length);
    const score = evaluated ? clampScore(session.score, 100) : null;

    const questions: ReportQuestion[] = qaPairs.map((qa, i) => {
        const c = qa.coaching || {};
        const rating = clampScore(c.rating, 10);
        const answer = cleanText(qa.answer);
        return {
            number: i + 1,
            text: cleanText(qa.question),
            own: qa.source === 'candidate',
            // A rating on an empty answer is the coach scoring silence; the
            // room does not show one either.
            rating: answer ? rating : null,
            tone: answer ? toneOf(rating, 10) : null,
            answer,
            seconds: Math.max(0, Math.round(Number(qa.seconds) || 0)),
            feedback: cleanText(c.feedback),
            improved: answer ? cleanText(c.improved_answer) : '',
            model: cleanText(c.model_answer) || cleanText(qa.model_answer),
            fix: cleanText(c.fix),
            why: cleanText(c.why),
            keyPoints: (c.key_points || []).map(cleanText).filter(Boolean),
        };
    });

    const subtitleParts = [tr(type === 'HR' ? 'HR' : 'Technical')];
    if (topic && type !== 'HR') subtitleParts.push(topic);

    return {
        dir: options.dir,
        lang: options.lang,
        brand: 'Self Study',
        title: tr('Interview Report'),
        candidate,
        subtitle: subtitleParts.join(' · '),
        meta,
        score,
        scoreTone: toneOf(score),
        recommendation: cleanText(session.recommendation),
        breakdown,
        summary: cleanText(session.summary),
        standout: cleanText(session.standout_moment),
        redFlags: cleanText(session.red_flags),
        strengths: cleanText(session.strengths),
        improvements: cleanText(session.improvements),
        assessmentTitle: tr(type === 'HR' ? 'Competency Assessment' : 'Technical Assessment'),
        assessment: cleanText(session.technical_assessment),
        communication: cleanText(session.communication),
        actionPlan: (session.action_plan || []).map(cleanText).filter(Boolean),
        questions,
        labels,
        fileBase: safeFileBase('Interview Report', topic || type, candidate, isoDay(session.created_at, now)),
        generatedOn: tr(LABEL_KEYS.generated, { v0: fmt(now.toISOString()) }),
        unfinished: isUnfinished(session),
    };
}

/** Whether the interview is unfinished -- said once, at the top of the report. */
export function isUnfinished(session: ReportSession): boolean {
    return session.status === 'in_progress';
}

/** `{v0}`-style substitution for a label that was translated with its placeholders. */
export function fill(template: string, params: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}
