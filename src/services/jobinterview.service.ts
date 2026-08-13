import { apiService } from './api';
import { serviceRegistry } from './config';

export interface QAPair {
    question: string;
    answer: string;
    model_answer?: string;
}

export interface JobInterviewSession {
    id: string;
    user_id: string;
    username: string;
    user_full_name?: string;
    interview_type: string;          // 'Technical' | 'HR'
    topic: string;
    qualifications: string;
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
}

export interface EvaluateBody {
    interview_type?: string;
    topic?: string;
    qualifications?: string;
    qa_pairs: QAPair[];
}

export interface ModelAnswersBody {
    interview_type?: string;
    topic?: string;
    qualifications?: string;
    questions: string[];
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

    /** Generate short ideal/model answers for each question (for training). */
    async getModelAnswers(body: ModelAnswersBody): Promise<string[]> {
        try {
            const baseUrl = await this.getBaseUrl();
            const r = await apiService.post<{ answers: string[] }>(
                baseUrl,
                `/api/jobinterview/bot/model-answers`,
                body
            );
            return Array.isArray(r.answers) ? r.answers : [];
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