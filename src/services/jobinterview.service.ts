import { apiService } from './api';
import { serviceRegistry } from './config';
import { aiLanguageHeaders } from '@/i18n/runtime';

/**
 * What the report shows under a question, beyond the model answer itself.
 *
 * The model answer used to be the whole of it, and for most of this feature's
 * life it was the same sentence under every question -- app 27 asked for all
 * twelve answers in one 1400-token call, the reply was cut off, the JSON failed
 * to parse and every question fell back to one generic line. That is fixed at
 * the other end (batched, salvaged, retried); this is the shape that makes the
 * report worth reading once the answers are real.
 *
 * Every field is optional. App 27 and this bundle deploy independently, so a
 * replica that has not pulled yet answers with `model_answer` alone and the
 * report renders exactly as it did before.
 */
export interface QACoaching {
    /**
     * A strong answer to this question, in the first person -- SHORT.
     *
     * Two to four sentences, the way somebody would actually say it out loud.
     * It used to be a paragraph of structural advice ("answer in layers: how
     * long and in what settings, the two most relevant things...") because that
     * is what the fallback produced whenever the AI could not be reached, and
     * the fallback was reached constantly. A candidate cannot rehearse a
     * paragraph about how to answer; they can rehearse an answer.
     */
    model_answer: string;
    /**
     * The candidate's OWN answer, rewritten to be stronger.
     *
     * The single most useful thing in the report, and the thing a model answer
     * cannot do: it keeps their content, their projects and their numbers, and
     * fixes the structure, the hedging and the "we" that should be "I". Absent
     * when they said nothing -- there is nothing to improve.
     */
    improved_answer?: string;
    /** The one change that would most improve this answer. One line. */
    fix?: string;
    /**
     * What any strong answer has to contain.
     *
     * Kept for records written before 2026-08-22, which stored it, and no
     * longer requested: a generic checklist under every question is what the
     * report looked like when the AI was unreachable, and it read as the AI
     * having said the same thing about all ten answers.
     *
     * @deprecated Not produced for new interviews.
     */
    key_points?: string[];
    /** What the interviewer is really assessing, and the usual mistake. */
    why?: string;
    /** What the candidate actually said: what worked, what was missing. */
    feedback?: string;
    /** 0-10 for the candidate's own answer. Null when they said nothing. */
    rating?: number | null;
    /**
     * True when this is structural guidance rather than a tailored answer,
     * because no AI provider could be reached.
     *
     * Surfaced in the report rather than hidden. A stand-in that cannot do the
     * job must say so -- passing generic advice off as a model answer is what
     * made this feature look broken for as long as it did.
     */
    generic?: boolean;
}

export interface QAPair {
    question: string;
    answer: string;
    /** The model answer as a plain string. The original contract; still sent. */
    model_answer?: string;
    /** The full coaching block. Absent on sessions recorded before 2026-08-20. */
    coaching?: QACoaching;
    /** How long the candidate spent answering. Purely informational. */
    seconds?: number;
    /**
     * Whether the coaching for this question is still being written.
     *
     * The report is built DURING the interview -- each answer is coached the
     * moment it is submitted rather than all of them at the end -- so a question
     * can legitimately be on screen with nothing under it yet. Saying so is the
     * difference between a report that is filling in and one that looks broken.
     */
    coaching_pending?: boolean;
}

export interface JobInterviewSession {
    id: string;
    user_id: string;
    username: string;
    user_full_name?: string;
    interview_type: string;          // 'Technical' | 'HR'
    topic: string;
    qualifications: string;
    /**
     * The CV the candidate attached, if any.
     *
     * `cv_summary` is the digest that was actually sent to the interviewer, not
     * a live reference to app 33 — a CV since edited or deleted must not
     * silently change what a past report says the candidate was interviewed
     * against. It is also what a redo re-sends, so a redo of an old interview
     * uses the CV as it stood that day.
     */
    cv_id?: string;
    cv_title?: string;
    cv_summary?: string;
    /** 1 for a first sitting, 2+ for a redo of the same role and requirements. */
    attempt?: number;
    planned_minutes: number;
    /** How many questions the candidate asked for. Absent on older sessions. */
    planned_questions?: number;
    /**
     * `in_progress` while the interview is running, `complete` once it has been
     * evaluated.
     *
     * The session is now saved when the interview STARTS and updated after each
     * answer, so a browser that dies at question seven leaves seven coached
     * answers behind instead of nothing at all. Without this field a
     * half-finished interview is indistinguishable from a finished one that
     * scored zero.
     */
    status?: 'in_progress' | 'complete';
    duration_seconds: number;
    qa_pairs: QAPair[];
    transcript: string;
    score: number;
    summary: string;
    strengths: string;
    improvements: string;
    technical_assessment: string;
    communication: string;
    recommendation: string;
    /** Three to five things to do before the next interview. */
    action_plan?: string[];
    /** The single best moment of the interview, quoted back. */
    standout_moment?: string;
    /** What would worry a real hiring manager. Empty when nothing would. */
    red_flags?: string;
    /** 0-100 per dimension, so a candidate can see WHERE the score came from. */
    score_breakdown?: ScoreBreakdown;
    created_at: string;
}

/**
 * Where the overall score came from.
 *
 * One number out of a hundred tells a candidate they did badly and nothing
 * about what to practise. Five tell them their content was fine and their
 * structure was not, which is a different evening's work.
 */
export interface ScoreBreakdown {
    /** Was there a shape to the answers, or were they streams of thought? */
    structure?: number;
    /** Did they answer the question that was asked? */
    relevance?: number;
    /** Concrete detail, or generalities? */
    depth?: number;
    /** Clarity, pace, filler, hedging. */
    communication?: number;
    /** Results and numbers, or activity? */
    impact?: number;
}

export interface InterviewerCallBody {
    stage?: string;                  // 'intro' | 'question' | 'closing'
    interview_type?: string;
    topic?: string;
    qualifications?: string;
    user_name?: string;
    question_number?: number;
    previous_qa?: QAPair[];
    /**
     * Who is conducting this one. The interviewer is cast at random from
     * src/cast/actors.ts, so the name the AI introduces itself by has to come
     * from here — app 27 shipped with one hardcoded persona per interview type
     * ('Alex' for Technical, 'Rachel' for HR) and would otherwise greet the
     * candidate as somebody other than the person on screen.
     *
     * Both are optional and app 27 falls back to those personas, because the two
     * are deployed independently: a replica that has not pulled yet simply keeps
     * saying Alex. Deploy app 27 before this frontend.
     */
    interviewer_name?: string;
    interviewer_role?: string;
    /**
     * The candidate's CV, already rendered to text by `cvDigest()`.
     *
     * Sent on every question, not only the intro. The model is stateless, so a
     * CV mentioned once in the greeting is a CV forgotten by question three —
     * which is the difference between an interviewer who has read it and one
     * who was handed it and put it down.
     */
    cv_summary?: string;
    /**
     * Questions this candidate was asked in EARLIER sittings of the same
     * interview. Sitting it again is only worth doing if the questions change.
     */
    avoid_questions?: string[];
    /**
     * Which sitting this is. App 27 rotates its own fallback question pool by
     * it, so a redo differs even when no AI provider answers — which is
     * precisely when an un-rotated pool would hand back the identical interview.
     */
    attempt?: number;
    /**
     * Every question asked SO FAR IN THIS INTERVIEW.
     *
     * `previous_qa` only ever carried the last five, because it also carries the
     * answers and the prompt has a budget -- so in a twelve-question interview
     * the model was free to re-ask question two at question nine, and did,
     * constantly. This is the questions alone, all of them, which costs almost
     * nothing and is the single biggest cause of "the questions repeat".
     */
    asked_questions?: string[];
    /**
     * The area this question is supposed to cover, from the plan drawn up at
     * the start of the interview.
     *
     * Telling a stateless model "ask something different" is advice; telling it
     * "ask about incident response" is an instruction. This is what turns a
     * generic anti-repeat prompt into an interview that covers ground on
     * purpose.
     */
    focus?: string;
    /** Different for every sitting, so identical settings are not one interview. */
    session_seed?: number;
}

/** What the interview will cover, decided once at the start. */
export interface QuestionPlanBody {
    interview_type?: string;
    topic?: string;
    qualifications?: string;
    cv_summary?: string;
    /** How many areas to plan. One per question. */
    count: number;
    avoid_questions?: string[];
    attempt?: number;
    session_seed?: number;
}

export interface EvaluateBody {
    interview_type?: string;
    topic?: string;
    qualifications?: string;
    cv_summary?: string;
    qa_pairs: QAPair[];
}

export interface ModelAnswersBody {
    interview_type?: string;
    topic?: string;
    qualifications?: string;
    cv_summary?: string;
    /**
     * Preferred: carries what the candidate said, which is what lets the coach
     * comment on their actual answer rather than only describing a good one.
     */
    qa_pairs?: QAPair[];
    /** The older shape. App 27 still accepts it and returns no per-answer feedback. */
    questions?: string[];
}

export interface EvaluationResult {
    score: number;
    summary: string;
    strengths: string;
    improvements: string;
    technical_assessment: string;
    communication: string;
    recommendation: string;
    action_plan?: string[];
    standout_moment?: string;
    red_flags?: string;
    score_breakdown?: ScoreBreakdown;
}

class JobInterviewService {
    /**
     * Job Interview shares the SAME Flask backend (app.py) as Toastmasters,
     * so we reuse the existing, guaranteed-present replica resolver.
     */
    private async getBaseUrl(): Promise<string> {
        const reg: any = serviceRegistry as any;
        let url: string | null = null;
        if (typeof reg.getRandomJobInterviewReplica === 'function') {
            url = await reg.getRandomJobInterviewReplica();
        }
        if (!url) {
            url = await serviceRegistry.getRandomToastmastersReplica();
        }
        if (!url) throw new Error('Job Interview service is unavailable');
        return url;
    }

    /** Public helper so the session view can resolve the same base URL for transcription. */
    async resolveBaseUrl(): Promise<string | null> {
        try {
            return await this.getBaseUrl();
        } catch {
            return null;
        }
    }

    async callInterviewer(body: InterviewerCallBody): Promise<string | null> {
        try {
            const baseUrl = await this.getBaseUrl();
            const r = await apiService.post<{ text: string }>(
                baseUrl,
                `/api/jobinterview/bot/interviewer`,
                body,
                aiLanguageHeaders()
            );
            return r.text;
        } catch (e) {
            console.error('Interviewer bot failed:', e);
            return null;
        }
    }

    async evaluate(body: EvaluateBody): Promise<EvaluationResult | null> {
        try {
            const baseUrl = await this.getBaseUrl();
            return await apiService.post<EvaluationResult>(
                baseUrl,
                `/api/jobinterview/bot/evaluate`,
                body,
                aiLanguageHeaders()
            );
        } catch (e) {
            console.error('Evaluate failed:', e);
            return null;
        }
    }

    /**
     * Per-question coaching for the report: a model answer, the key points a
     * strong answer needs, why the question is asked, and a note on what the
     * candidate actually said.
     *
     * Returns one entry per question asked, in order — including when app 27 is
     * a release behind and answers with `answers` alone, which is why the plain
     * strings are folded back into the coaching shape here rather than at every
     * call site. An entry is never null: a question with no coaching renders a
     * blank block in the report, which reads as the report being broken.
     */
    async getModelAnswers(body: ModelAnswersBody): Promise<QACoaching[]> {
        const expected = (body.qa_pairs?.length ?? body.questions?.length ?? 0);
        try {
            const baseUrl = await this.getBaseUrl();
            const r = await apiService.post<{ answers?: string[]; coaching?: QACoaching[] }>(
                baseUrl,
                `/api/jobinterview/bot/model-answers`,
                body,
                aiLanguageHeaders()
            );
            if (Array.isArray(r.coaching) && r.coaching.length) {
                return r.coaching.slice(0, expected || r.coaching.length);
            }
            const answers = Array.isArray(r.answers) ? r.answers : [];
            return answers.map(a => ({ model_answer: String(a || '') }));
        } catch (e) {
            console.error('Model answers failed:', e);
            return [];
        }
    }

    /**
     * Coaching for ONE answer, asked for the moment it is submitted.
     *
     * The report used to be built entirely at the end: one evaluate call plus a
     * coaching call per batch of three, all after the closing speech, which on
     * two cold PythonAnywhere replicas is most of a minute of a spinner. The
     * candidate has nothing to do during it and no idea whether it is working.
     *
     * Coaching is per question and does not depend on the questions after it, so
     * there is no reason to wait: this is fired while the interviewer is asking
     * the next question, and by the time the interview ends the only thing left
     * is the overall evaluation. A single question is also the shape the AI
     * handles most reliably -- one short answer inside the whole token budget is
     * what stops a reply being truncated, which is what made every question in
     * the report share one paragraph of generic advice.
     *
     * Never throws: a coaching call that fails leaves that question uncoached
     * and the interview entirely unaffected, and `endInterview` retries whatever
     * is still missing.
     */
    async coachOne(
        body: Omit<ModelAnswersBody, 'qa_pairs' | 'questions'> & { qa: QAPair },
    ): Promise<QACoaching | null> {
        const { qa, ...rest } = body;
        const coaching = await this.getModelAnswers({ ...rest, qa_pairs: [qa] });
        return coaching[0] || null;
    }

    /**
     * The areas this interview will cover, one per question, decided up front.
     *
     * Repetition was never really a prompt-wording problem. Each question was
     * generated on its own, told only about the last five answers, by a model
     * with no memory -- so on a technical interview it would open with "walk me
     * through your experience", and then, four questions later, ask it again in
     * different words. Asking for a PLAN first fixes the cause: every question
     * then has ground of its own to cover and the model is not choosing a topic
     * from nothing twelve times.
     *
     * Returns an empty list rather than throwing. The room asks its questions
     * exactly as it used to when there is no plan, so a cold replica or an
     * unreachable provider costs variety and never an interview.
     */
    async planQuestions(body: QuestionPlanBody): Promise<string[]> {
        try {
            const baseUrl = await this.getBaseUrl();
            const r = await apiService.post<{ areas?: string[] }>(
                baseUrl, `/api/jobinterview/bot/plan`, body, aiLanguageHeaders());
            const areas = Array.isArray(r.areas) ? r.areas : [];
            return areas.map(a => String(a || '').trim()).filter(Boolean);
        } catch (e) {
            console.error('Question plan failed:', e);
            return [];
        }
    }

    async saveSession(data: Partial<JobInterviewSession>): Promise<{ success: boolean; id: string }> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post(baseUrl, '/api/jobinterview/sessions', data, aiLanguageHeaders());
    }

    async getUserSessions(userId: string): Promise<JobInterviewSession[]> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.get(baseUrl, `/api/jobinterview/sessions?user_id=${encodeURIComponent(userId)}`);
    }

    async getSession(id: string): Promise<JobInterviewSession> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.get(baseUrl, `/api/jobinterview/sessions/${id}`);
    }

    async deleteSession(id: string, userId: string): Promise<{ success: boolean }> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.delete(baseUrl, `/api/jobinterview/sessions/${id}?user_id=${encodeURIComponent(userId)}`);
    }
}

export const jobInterviewService = new JobInterviewService();