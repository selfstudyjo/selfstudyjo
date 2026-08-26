import { apiService } from './api';
import { serviceRegistry } from './config';
import { normalizePaginatedResponse } from '@/utils/api-utils';
import type { TranslationMap } from '@/i18n/records';

export interface Quiz {
    /**
     * The Arabic and Chinese copies of this record's own text, keyed by language
     * then by field. English is NOT in here -- it is the field beside it.
     *
     * Always present from a backend carrying `utils/translations.py`, and `{}`
     * when nothing has been translated yet; optional here because this bundle
     * and those services deploy separately, so a record from an older replica
     * has no such key at all. Read it with `$td(record)` / `td(record)` rather
     * than by hand -- see `src/i18n/records.ts`.
     */
    translations?: TranslationMap;
    external_id: string;
    title: string;
    course_id: string;
    lesson_id: string;
    quiz_duration: number;
    description: string;
    date_added?: string;
    questions?: QuizQuestion[];
}

export interface QuizQuestion {
    /**
     * The Arabic and Chinese copies of this record's own text, keyed by language
     * then by field. English is NOT in here -- it is the field beside it.
     *
     * Always present from a backend carrying `utils/translations.py`, and `{}`
     * when nothing has been translated yet; optional here because this bundle
     * and those services deploy separately, so a record from an older replica
     * has no such key at all. Read it with `$td(record)` / `td(record)` rather
     * than by hand -- see `src/i18n/records.ts`.
     */
    translations?: TranslationMap;
    external_id: string;
    quiz: string;
    text: string;
    score: number;
    answers?: QuizAnswer[];
}

export interface QuizAnswer {
    /**
     * The Arabic and Chinese copies of this record's own text, keyed by language
     * then by field. English is NOT in here -- it is the field beside it.
     *
     * Always present from a backend carrying `utils/translations.py`, and `{}`
     * when nothing has been translated yet; optional here because this bundle
     * and those services deploy separately, so a record from an older replica
     * has no such key at all. Read it with `$td(record)` / `td(record)` rather
     * than by hand -- see `src/i18n/records.ts`.
     */
    translations?: TranslationMap;
    external_id: string;
    quiz_question: string;
    text: string;
    is_correct: boolean;
}

export interface UserQuizResult {
    external_id: string;
    user_id: string;
    username: string;
    quiz: string;
    quiz_title?: string;
    score: number;
    date_taken?: string;
    result_message?: string;
    result_status: 'PASSED' | 'FAILED';
    user_answers?: UserQuizAnswer[];
}

export interface UserQuizAnswer {
    external_id: string;
    user_quiz_result?: string;
    quiz_question: string;
    quiz_answer?: string;
    flagged: boolean;
}

export interface SubmitQuizRequest {
    external_id?: string;
    user_id: string;
    username: string;
    quiz: string;
    score: number;
    result_status: 'PASSED' | 'FAILED';
    result_message?: string;
    user_answers: {
        external_id?: string;
        quiz_question: string;
        quiz_answer?: string;
        flagged?: boolean;
    }[];
}

export interface SubmitQuizResponse {
    external_id: string;
    user_id: string;
    username: string;
    quiz: string;
    score: number;
    date_taken: string;
    result_message: string;
    result_status: 'PASSED' | 'FAILED';
}

const DEBUG = true;
const dlog  = (...a: any[]) => { if (DEBUG) console.log('[QuizService]', ...a); };
const dwarn = (...a: any[]) => { if (DEBUG) console.warn('[QuizService]', ...a); };
const derr  = (...a: any[]) => console.error('[QuizService]', ...a);

/** Round a number to 1 decimal place (e.g. 85.7364 -> 85.7) */
const round1 = (n: number): number => {
    if (!isFinite(n)) return 0;
    return Math.round(n * 10) / 10;
};

class QuizService {
    private readonly APP_ID = 20;
    private cache = new Map<string, { quiz: Quiz; timestamp: number }>();
    private readonly CACHE_TTL = 5 * 60 * 1000;

    async getQuizReplicas(): Promise<string[]> {
        return serviceRegistry.getServiceReplicas(this.APP_ID, 'exam');
    }

    async getRandomQuizReplica(): Promise<string | null> {
        const replicas = await this.getQuizReplicas();
        return serviceRegistry.getRandomReplica(replicas, this.APP_ID);
    }

    /**
     * Lightweight: returns just {external_id, lesson_id} for all quizzes of a course.
     * Tries course_id filter first; if empty, falls back to fetching ALL quizzes
     * and filtering client-side (in case the backend filter is case-sensitive or
     * the field name differs).
     */
    async getQuizzesForCourseLight(
        courseId: string,
        baseUrl?: string
    ): Promise<Pick<Quiz, 'external_id' | 'lesson_id' | 'course_id'>[]> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');

        // Primary: server-side filter
        try {
            dlog(`GET ${url}/quizzes/?course_id=${courseId}`);
            const resp = await apiService.get<any>(url, `/quizzes/?course_id=${encodeURIComponent(courseId)}`);
            const quizzes = normalizePaginatedResponse<Quiz>(resp).results;
            dlog(`Server returned ${quizzes.length} quizzes for course=${courseId}`,
                 quizzes.map(q => ({ external_id: q.external_id, lesson_id: q.lesson_id, course_id: q.course_id })));

            if (quizzes.length > 0) {
                return quizzes.map(q => ({
                    external_id: q.external_id,
                    lesson_id: q.lesson_id,
                    course_id: q.course_id,
                }));
            }
        } catch (err) {
            dwarn('getQuizzesForCourseLight server filter failed:', err);
        }

        // Fallback: fetch ALL quizzes and filter client-side
        try {
            dlog(`Fallback: fetching ALL quizzes and filtering client-side for course=${courseId}`);
            const allResp = await apiService.get<any>(url, `/quizzes/`);
            const allQuizzes = normalizePaginatedResponse<Quiz>(allResp).results;
            const wanted = courseId.toLowerCase().trim();
            const filtered = allQuizzes.filter(q =>
                (q.course_id || '').toLowerCase().trim() === wanted
            );
            dlog(`Fallback: total=${allQuizzes.length}, matched course=${filtered.length}`);
            return filtered.map(q => ({
                external_id: q.external_id,
                lesson_id: q.lesson_id,
                course_id: q.course_id,
            }));
        } catch (err) {
            derr('getQuizzesForCourseLight fallback failed:', err);
            return [];
        }
    }

    /** Fetch all quizzes (or filter by lesson_id list) for a given set of lessons. */
    async getQuizzesForLessons(
        lessonIds: string[],
        baseUrl?: string
    ): Promise<Pick<Quiz, 'external_id' | 'lesson_id'>[]> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) return [];
        const results: Pick<Quiz, 'external_id' | 'lesson_id'>[] = [];
        for (const lid of lessonIds) {
            try {
                const resp = await apiService.get<any>(url, `/quizzes/?lesson_id=${encodeURIComponent(lid)}`);
                const list = normalizePaginatedResponse<Quiz>(resp).results;
                list.forEach(q => results.push({
                    external_id: q.external_id,
                    lesson_id: q.lesson_id || lid,
                }));
            } catch (e) {
                dwarn(`getQuizzesForLessons failed for lesson=${lid}`, e);
            }
        }
        dlog(`getQuizzesForLessons total=${results.length}`);
        return results;
    }

    async getQuizByLessonId(lessonId: string, baseUrl?: string): Promise<Quiz | null> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');

        const cacheKey = `lesson_${lessonId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.quiz;
        }

        try {
            const response = await apiService.get<any>(url, `/quizzes/?lesson_id=${encodeURIComponent(lessonId)}`);
            const quizzes = normalizePaginatedResponse<Quiz>(response).results;
            if (quizzes.length === 0) return null;
            const quiz = quizzes[0];

            const questionsResponse = await apiService.get<any>(url, `/quiz-questions/?quiz=${encodeURIComponent(quiz.external_id)}`);
            const questions = normalizePaginatedResponse<QuizQuestion>(questionsResponse).results;
            const filteredQuestions = questions.filter(q => q.quiz === quiz.external_id);
            await this.populateAnswersBatch(filteredQuestions, url);

            quiz.questions = filteredQuestions;
            this.cache.set(cacheKey, { quiz, timestamp: Date.now() });
            return quiz;
        } catch (err) {
            derr('getQuizByLessonId failed:', err);
            throw err;
        }
    }

    async getQuiz(quizId: string, baseUrl?: string): Promise<Quiz> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');

        const cacheKey = `quiz_${quizId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) return cached.quiz;

        try {
            const quiz = await apiService.get<Quiz>(url, `/quizzes/${quizId}/`);
            const questionsResponse = await apiService.get<any>(url, `/quiz-questions/?quiz=${encodeURIComponent(quiz.external_id)}`);
            const questions = normalizePaginatedResponse<QuizQuestion>(questionsResponse).results;
            const filteredQuestions = questions.filter(q => q.quiz === quiz.external_id);
            await this.populateAnswersBatch(filteredQuestions, url);
            quiz.questions = filteredQuestions;
            this.cache.set(cacheKey, { quiz, timestamp: Date.now() });
            return quiz;
        } catch (err) {
            derr('getQuiz failed:', err);
            throw err;
        }
    }

    private async populateAnswersBatch(questions: QuizQuestion[], baseUrl: string): Promise<void> {
        if (questions.length === 0) return;
        const questionIds = questions.map(q => q.external_id).join(',');
        try {
            const answersResponse = await apiService.get<any>(baseUrl, `/quiz-answers/?quiz_question__in=${questionIds}`);
            const allAnswers = normalizePaginatedResponse<QuizAnswer>(answersResponse).results;
            const answersByQuestion = new Map<string, QuizAnswer[]>();
            allAnswers.forEach(a => {
                if (!answersByQuestion.has(a.quiz_question)) answersByQuestion.set(a.quiz_question, []);
                answersByQuestion.get(a.quiz_question)!.push(a);
            });
            questions.forEach(q => { q.answers = answersByQuestion.get(q.external_id) || []; });

            // If batch produced nothing → fallback parallel
            if (allAnswers.length === 0) {
                await this.populateAnswersParallel(questions, baseUrl);
            }
        } catch (e) {
            dwarn('Batch answer fetch failed, falling back to parallel:', e);
            await this.populateAnswersParallel(questions, baseUrl);
        }
    }

    private async populateAnswersParallel(questions: QuizQuestion[], baseUrl: string): Promise<void> {
        await Promise.all(questions.map(async (question) => {
            try {
                const resp = await apiService.get<any>(baseUrl, `/quiz-answers/?quiz_question=${encodeURIComponent(question.external_id)}`);
                const answers = normalizePaginatedResponse<QuizAnswer>(resp).results;
                question.answers = answers.filter(a => a.quiz_question === question.external_id);
            } catch {
                question.answers = [];
            }
        }));
    }

    async getQuizzesByCourseId(courseId: string, baseUrl?: string): Promise<Quiz[]> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');
        const response = await apiService.get<any>(url, `/quizzes/?course_id=${encodeURIComponent(courseId)}`);
        const quizzes = normalizePaginatedResponse<Quiz>(response).results;
        for (const quiz of quizzes) {
            const questionsResponse = await apiService.get<any>(url, `/quiz-questions/?quiz=${encodeURIComponent(quiz.external_id)}`);
            const questions = normalizePaginatedResponse<QuizQuestion>(questionsResponse).results;
            const filtered = questions.filter(q => q.quiz === quiz.external_id);
            await this.populateAnswersBatch(filtered, url);
            quiz.questions = filtered;
        }
        return quizzes;
    }

    async submitQuiz(submission: SubmitQuizRequest, baseUrl?: string): Promise<SubmitQuizResponse> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');
        const completeSubmission: SubmitQuizRequest = {
            ...submission,
            external_id: submission.external_id || `quiz_result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            // Make sure score is rounded to 1 decimal before sending
            score: round1(submission.score),
            result_message: submission.result_message || '',
            user_answers: submission.user_answers.map((answer, i) => ({
                ...answer,
                external_id: answer.external_id || `user_answer_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
                flagged: answer.flagged || false
            }))
        };
        const response = await apiService.post<SubmitQuizResponse>(url, '/submit-quiz/', completeSubmission);
        // Defensive: round on the way back too, in case the server stored more decimals
        if (response && typeof response.score === 'number') {
            response.score = round1(response.score);
        }
        return response;
    }

    async getUserQuizResult(userId: string, quizId: string, baseUrl?: string): Promise<UserQuizResult | null> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');
        try {
            const response = await apiService.get<any>(url, `/user-quiz-results/?user_id=${encodeURIComponent(userId)}&quiz_id=${encodeURIComponent(quizId)}`);
            const results = normalizePaginatedResponse<UserQuizResult>(response).results;
            if (results.length === 0) return null;
            const r = results[0];
            if (typeof r.score === 'number') r.score = round1(r.score);
            return r;
        } catch (err) {
            derr('getUserQuizResult failed:', err);
            return null;
        }
    }

    async getUserQuizResults(userId: string, baseUrl?: string): Promise<UserQuizResult[]> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');
        try {
            const response = await apiService.get<any>(url, `/user-quiz-results/?user_id=${encodeURIComponent(userId)}`);
            const results = normalizePaginatedResponse<UserQuizResult>(response).results;
            return await Promise.all(results.map(async (r) => {
                if (typeof r.score === 'number') r.score = round1(r.score);
                try {
                    const quiz = await this.getQuiz(r.quiz, url);
                    return { ...r, quiz_title: quiz.title };
                } catch { return r; }
            }));
        } catch (err) {
            derr('getUserQuizResults failed:', err);
            return [];
        }
    }

    async hasUserTakenQuiz(userId: string, quizId: string, baseUrl?: string): Promise<boolean> {
        const result = await this.getUserQuizResult(userId, quizId, baseUrl);
        return result !== null;
    }

    calculateQuizResult(
        quiz: Quiz,
        userAnswers: Map<string, string>
    ): { score: number; total: number; percentage: number; passed: boolean; correctAnswers: number } {
        let correctAnswers = 0; let total = 0;
        if (!quiz.questions || quiz.questions.length === 0) {
            return { score: 0, total: 0, percentage: 0, passed: false, correctAnswers: 0 };
        }
        for (const question of quiz.questions) {
            total += question.score || 1;
            const userAnswerId = userAnswers.get(question.external_id);
            if (!userAnswerId) continue;
            const correct = question.answers?.find(a => a.is_correct);
            if (correct && correct.external_id === userAnswerId) correctAnswers += 1;
        }
        const rawPercentage = total > 0 ? (correctAnswers / quiz.questions.length) * 100 : 0;
        // Round percentage to 1 decimal place
        const percentage = round1(rawPercentage);
        return {
            score: correctAnswers,
            total: quiz.questions.length,
            percentage,
            passed: percentage >= 70,
            correctAnswers
        };
    }

    createUserQuizResult(
        userId: string,
        username: string,
        quizId: string,
        scoreData: { score: number; total: number; percentage: number; passed: boolean; correctAnswers: number },
        userAnswers: Map<string, string>
    ): SubmitQuizRequest {
        const userAnswersArray: any[] = [];
        userAnswers.forEach((answerId, questionId) => {
            userAnswersArray.push({
                quiz_question: questionId,
                quiz_answer: answerId || undefined,
                flagged: false
            });
        });

        // Ensure 1 decimal place for both the message and the stored score
        const finalScore = round1(scoreData.percentage);
        const resultMessage = `You answered ${scoreData.correctAnswers} out of ${scoreData.total} questions correctly. Score: ${finalScore.toFixed(1)}%.`;

        return {
            external_id: `quiz_result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user_id: userId,
            username,
            quiz: quizId,
            score: finalScore,
            result_status: scoreData.passed ? 'PASSED' : 'FAILED',
            result_message: resultMessage,
            user_answers: userAnswersArray
        };
    }

    async getQuizResultById(resultId: string, baseUrl?: string): Promise<UserQuizResult> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');
        try {
            const r = await apiService.get<UserQuizResult>(url, `/user-quiz-results/${resultId}/`);
            if (r && typeof r.score === 'number') r.score = round1(r.score);
            return r;
        } catch (error: any) {
            if (error.status === 404) throw new Error('Quiz result not found');
            throw error;
        }
    }

    async getQuizWithDetails(quizId: string, baseUrl?: string): Promise<Quiz> {
        return this.getQuiz(quizId, baseUrl);
    }

    clearCache() { this.cache.clear(); }
}

export const quizService = new QuizService();