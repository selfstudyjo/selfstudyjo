import { apiService } from './api';
import { serviceRegistry } from './config';
import { normalizePaginatedResponse } from '@/utils/api-utils';

export interface Quiz {
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
    external_id: string;
    quiz: string;
    text: string;
    score: number;
    answers?: QuizAnswer[];
}

export interface QuizAnswer {
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

class QuizService {
    private readonly APP_ID = 20;
    private cache = new Map<string, { quiz: Quiz; timestamp: number }>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    async getQuizReplicas(): Promise<string[]> {
        return serviceRegistry.getServiceReplicas(this.APP_ID, 'exam');
    }

    async getRandomQuizReplica(): Promise<string | null> {
        const replicas = await this.getQuizReplicas();
        return serviceRegistry.getRandomReplica(replicas);
    }

    // --- Lightweight batch fetch for quizzes (only id + lesson_id) ---
    async getQuizzesForCourseLight(courseId: string, baseUrl?: string): Promise<Pick<Quiz, 'external_id' | 'lesson_id'>[]> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');

        try {
            const response = await apiService.get<any>(url, `/quizzes/?course_id=${courseId}`);
            const quizzes = normalizePaginatedResponse<Quiz>(response).results;
            return quizzes.map(q => ({
                external_id: q.external_id,
                lesson_id: q.lesson_id
            }));
        } catch (error) {
            console.error('Failed to fetch quizzes for course:', error);
            return [];
        }
    }

    // --- Optimized getQuizByLessonId with batch answer fetching ---
    async getQuizByLessonId(lessonId: string, baseUrl?: string): Promise<Quiz | null> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');

        const cacheKey = `lesson_${lessonId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.quiz;
        }

        try {
            const response = await apiService.get<any>(url, `/quizzes/?lesson_id=${lessonId}`);
            const quizzes = normalizePaginatedResponse<Quiz>(response).results;
            if (quizzes.length === 0) return null;
            const quiz = quizzes[0];

            // Fetch questions
            const questionsResponse = await apiService.get<any>(url, `/quiz-questions/?quiz=${quiz.external_id}`);
            const questions = normalizePaginatedResponse<QuizQuestion>(questionsResponse).results;
            const filteredQuestions = questions.filter(q => q.quiz === quiz.external_id);

            // Fetch all answers for these questions in one batch request
            await this.populateAnswersBatch(filteredQuestions, url);

            quiz.questions = filteredQuestions;
            this.cache.set(cacheKey, { quiz, timestamp: Date.now() });
            return quiz;
        } catch (error) {
            console.error('Failed to fetch quiz by lesson ID:', error);
            throw error;
        }
    }

    // --- Optimized getQuiz with batch answer fetching ---
    async getQuiz(quizId: string, baseUrl?: string): Promise<Quiz> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');

        const cacheKey = `quiz_${quizId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.quiz;
        }

        try {
            const quiz = await apiService.get<Quiz>(url, `/quizzes/${quizId}/`);

            // Fetch questions
            const questionsResponse = await apiService.get<any>(url, `/quiz-questions/?quiz=${quiz.external_id}`);
            const questions = normalizePaginatedResponse<QuizQuestion>(questionsResponse).results;
            const filteredQuestions = questions.filter(q => q.quiz === quiz.external_id);

            // Fetch all answers in one batch
            await this.populateAnswersBatch(filteredQuestions, url);

            quiz.questions = filteredQuestions;
            this.cache.set(cacheKey, { quiz, timestamp: Date.now() });
            return quiz;
        } catch (error) {
            console.error('Failed to fetch quiz:', error);
            throw error;
        }
    }

    // --- Batch answer fetcher (attempts single request, falls back to parallel) ---
    private async populateAnswersBatch(questions: QuizQuestion[], baseUrl: string): Promise<void> {
        if (questions.length === 0) return;

        // Try to fetch all answers in one request using ?quiz_question__in=id1,id2,...
        const questionIds = questions.map(q => q.external_id).join(',');
        try {
            const answersResponse = await apiService.get<any>(baseUrl, `/quiz-answers/?quiz_question__in=${questionIds}`);
            const allAnswers = normalizePaginatedResponse<QuizAnswer>(answersResponse).results;

            // Group answers by question ID
            const answersByQuestion = new Map<string, QuizAnswer[]>();
            allAnswers.forEach(answer => {
                if (!answersByQuestion.has(answer.quiz_question)) {
                    answersByQuestion.set(answer.quiz_question, []);
                }
                answersByQuestion.get(answer.quiz_question)!.push(answer);
            });

            // Assign to each question
            questions.forEach(question => {
                question.answers = answersByQuestion.get(question.external_id) || [];
            });
        } catch (error) {
            // If batch request fails (e.g., endpoint doesn't support __in), fall back to parallel per-question requests
            console.warn('Batch answer fetch failed, falling back to parallel requests', error);
            await this.populateAnswersParallel(questions, baseUrl);
        }
    }

    // --- Parallel fallback (existing logic) ---
    private async populateAnswersParallel(questions: QuizQuestion[], baseUrl: string): Promise<void> {
        const answerPromises = questions.map(async (question) => {
            try {
                const answersResponse = await apiService.get<any>(baseUrl, `/quiz-answers/?quiz_question=${question.external_id}`);
                const answers = normalizePaginatedResponse<QuizAnswer>(answersResponse).results;
                question.answers = answers.filter(answer => answer.quiz_question === question.external_id);
            } catch (err) {
                question.answers = [];
            }
        });
        await Promise.all(answerPromises);
    }

    // --- All other methods remain the same (already accept baseUrl) ---
    async getQuizzesByCourseId(courseId: string, baseUrl?: string): Promise<Quiz[]> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');

        try {
            const response = await apiService.get<any>(url, `/quizzes/?course_id=${courseId}`);
            const quizzes = normalizePaginatedResponse<Quiz>(response).results;
            for (const quiz of quizzes) {
                const questionsResponse = await apiService.get<any>(url, `/quiz-questions/?quiz=${quiz.external_id}`);
                const questions = normalizePaginatedResponse<QuizQuestion>(questionsResponse).results;
                const filteredQuestions = questions.filter(q => q.quiz === quiz.external_id);
                await this.populateAnswersBatch(filteredQuestions, url);
                quiz.questions = filteredQuestions;
            }
            return quizzes;
        } catch (error) {
            console.error('Failed to fetch quizzes by course ID:', error);
            throw error;
        }
    }

    async submitQuiz(submission: SubmitQuizRequest, baseUrl?: string): Promise<SubmitQuizResponse> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');

        try {
            const completeSubmission: SubmitQuizRequest = {
                ...submission,
                external_id: submission.external_id || `quiz_result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                result_message: submission.result_message || '',
                user_answers: submission.user_answers.map((answer, index) => ({
                    ...answer,
                    external_id: answer.external_id || `user_answer_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                    flagged: answer.flagged || false
                }))
            };
            const result = await apiService.post<SubmitQuizResponse>(url, '/submit-quiz/', completeSubmission);
            return result;
        } catch (error) {
            console.error('Failed to submit quiz:', error);
            throw error;
        }
    }

    async getUserQuizResult(userId: string, quizId: string, baseUrl?: string): Promise<UserQuizResult | null> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');

        try {
            const response = await apiService.get<any>(url, `/user-quiz-results/?user_id=${userId}&quiz_id=${quizId}`);
            const results = normalizePaginatedResponse<UserQuizResult>(response).results;
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('Failed to fetch user quiz result:', error);
            return null;
        }
    }

    async getUserQuizResults(userId: string, baseUrl?: string): Promise<UserQuizResult[]> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');

        try {
            const response = await apiService.get<any>(url, `/user-quiz-results/?user_id=${userId}`);
            const results = normalizePaginatedResponse<UserQuizResult>(response).results;
            const enriched = await Promise.all(
                results.map(async (result) => {
                    try {
                        const quiz = await this.getQuiz(result.quiz, url);
                        return { ...result, quiz_title: quiz.title };
                    } catch {
                        return result;
                    }
                })
            );
            return enriched;
        } catch (error) {
            console.error('Failed to fetch user quiz results:', error);
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
        let correctAnswers = 0;
        let total = 0;
        if (!quiz.questions || quiz.questions.length === 0) {
            return { score: 0, total: 0, percentage: 0, passed: false, correctAnswers: 0 };
        }
        for (const question of quiz.questions) {
            total += question.score || 1;
            const userAnswerId = userAnswers.get(question.external_id);
            if (!userAnswerId) continue;
            const correctAnswer = question.answers?.find(answer => answer.is_correct);
            if (correctAnswer && correctAnswer.external_id === userAnswerId) {
                correctAnswers += 1;
            }
        }
        const score = correctAnswers;
        const percentage = total > 0 ? (correctAnswers / quiz.questions.length) * 100 : 0;
        const passed = percentage >= 70;
        return { score, total: quiz.questions.length, percentage, passed, correctAnswers };
    }

    createUserQuizResult(
        userId: string,
        username: string,
        quizId: string,
        scoreData: { score: number; total: number; percentage: number; passed: boolean; correctAnswers: number },
        userAnswers: Map<string, string>
    ): SubmitQuizRequest {
        const userAnswersArray: {
            external_id?: string;
            quiz_question: string;
            quiz_answer?: string;
            flagged?: boolean;
        }[] = [];
        userAnswers.forEach((answerId, questionId) => {
            userAnswersArray.push({
                quiz_question: questionId,
                quiz_answer: answerId || undefined,
                flagged: false
            });
        });
        const resultMessage = `You answered ${scoreData.correctAnswers} out of ${scoreData.total} questions correctly. Score: ${scoreData.percentage.toFixed(2)}%.`;
        return {
            external_id: `quiz_result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user_id: userId,
            username: username,
            quiz: quizId,
            score: scoreData.percentage,
            result_status: scoreData.passed ? 'PASSED' : 'FAILED',
            result_message: resultMessage,
            user_answers: userAnswersArray
        };
    }

    async getQuizResultById(resultId: string, baseUrl?: string): Promise<UserQuizResult> {
        const url = baseUrl || await this.getRandomQuizReplica();
        if (!url) throw new Error('No exam service replicas available');

        try {
            return await apiService.get<UserQuizResult>(url, `/user-quiz-results/${resultId}/`);
        } catch (error: any) {
            if (error.status === 404) {
                throw new Error('Quiz result not found');
            }
            throw error;
        }
    }

    async getQuizWithDetails(quizId: string, baseUrl?: string): Promise<Quiz> {
        return this.getQuiz(quizId, baseUrl);
    }

    clearCache() {
        this.cache.clear();
    }
}

export const quizService = new QuizService();