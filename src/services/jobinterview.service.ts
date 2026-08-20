import { apiService } from './api';
import { serviceRegistry } from './config';

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
    /** A strong answer to this question, in the first person. */
    model_answer: string;
    /** What any strong answer to this question has to contain. */
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
    created_at: string;
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
                body
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
                body
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
                body
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

    async saveSession(data: Partial<JobInterviewSession>): Promise<{ success: boolean; id: string }> {
        const baseUrl = await this.getBaseUrl();
        return await apiService.post(baseUrl, '/api/jobinterview/sessions', data);
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